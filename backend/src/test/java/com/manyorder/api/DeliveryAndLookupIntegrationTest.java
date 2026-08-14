package com.manyorder.api;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Delivery-fee modes (free-delivery threshold, "to be confirmed" when unset,
 * explicit-free, per-order clear) and the public store-scoped order lookup.
 */
class DeliveryAndLookupIntegrationTest extends IntegrationTestBase {

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, String name, double price, boolean preOrder) throws Exception {
        var body = new HashMap<String, Object>(Map.of("name", name, "price", price));
        if (preOrder) body.put("preOrder", true);
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    /** Absolute delivery config; keys absent from the map become null on the server. */
    private void patchDelivery(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/delivery")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private MvcResult checkout(long storeId, String phone, String fulfilment,
                              List<Map<String, Object>> items, Map<String, Object> extra) throws Exception {
        var body = new HashMap<String, Object>(Map.of(
                "merchantId", storeId, "customerName", "Guest", "customerPhone", phone,
                "fulfilmentMethod", fulfilment, "items", items));
        if (extra != null) body.putAll(extra);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
    }

    private List<Map<String, Object>> item(long productId, int qty) {
        return List.of(Map.of("productId", productId, "quantity", qty));
    }

    // ---------- delivery fee modes ----------

    @Test
    void freeDeliveryThreshold_waivesFeeAtOrAboveAmount() throws Exception {
        String token = registerAndGetToken("dl-thresh@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Thresh", "dl-thresh-store");
        long pid = createProduct(token, storeId, "Boba", 10.00, false);
        patchDelivery(token, storeId, Map.of("deliveryFee", 5.00, "freeDeliveryThreshold", 20.00));

        // Subtotal 30 >= 20 -> fee waived.
        MvcResult big = checkout(storeId, "+6590001111", "DELIVERY", item(pid, 3), Map.of("deliveryAddress", "1 Rd"));
        assertEquals(0.0, json(big).get("deliveryFee").asDouble(), 0.001);
        assertEquals(30.0, json(big).get("totalAmount").asDouble(), 0.001);

        // Subtotal 10 < 20 -> fee applies.
        MvcResult small = checkout(storeId, "+6590001111", "DELIVERY", item(pid, 1), Map.of("deliveryAddress", "1 Rd"));
        assertEquals(5.0, json(small).get("deliveryFee").asDouble(), 0.001);
        assertEquals(15.0, json(small).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void unsetFee_deliveryIsToBeConfirmed_pickupUnaffected() throws Exception {
        String token = registerAndGetToken("dl-tbc@test.com", "MERCHANT", null);
        long storeId = createStore(token, "TBC", "dl-tbc-store");
        long pid = createProduct(token, storeId, "Cake", 8.00, false);
        // No delivery config at all -> deliveryFee null -> to-be-confirmed.

        MvcResult delivery = checkout(storeId, "+6590002222", "DELIVERY", item(pid, 1), Map.of("deliveryAddress", "2 Rd"));
        assertEquals(true, json(delivery).get("deliveryFeePending").asBoolean());
        assertEquals(0.0, json(delivery).get("deliveryFee").asDouble(), 0.001);
        assertEquals(8.0, json(delivery).get("totalAmount").asDouble(), 0.001); // estimate = subtotal

        MvcResult pickup = checkout(storeId, "+6590002222", "PICKUP", item(pid, 1), null);
        assertEquals(false, json(pickup).get("deliveryFeePending").asBoolean());
    }

    @Test
    void explicitZeroFee_isFreeNotPending() throws Exception {
        String token = registerAndGetToken("dl-free@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Free", "dl-free-store");
        long pid = createProduct(token, storeId, "Tea", 6.00, false);
        patchDelivery(token, storeId, Map.of("deliveryFee", 0.00));

        MvcResult r = checkout(storeId, "+6590003333", "DELIVERY", item(pid, 1), Map.of("deliveryAddress", "3 Rd"));
        assertEquals(false, json(r).get("deliveryFeePending").asBoolean());
        assertEquals(0.0, json(r).get("deliveryFee").asDouble(), 0.001);
    }

    @Test
    void perOrderFeeEdit_clearsPending_andRecomputesTotal() throws Exception {
        String token = registerAndGetToken("dl-edit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit", "dl-edit-store");
        long pid = createProduct(token, storeId, "Latte", 6.00, false);
        // Unset fee -> delivery order is pending.
        MvcResult r = checkout(storeId, "+6590004444", "DELIVERY", item(pid, 2), Map.of("deliveryAddress", "4 Rd"));
        long orderId = json(r).get("orderId").asLong();

        MvcResult before = getWithToken("/merchant/stores/" + storeId + "/orders/" + orderId, token, 200);
        assertEquals(true, json(before).get("deliveryFeePending").asBoolean());

        MvcResult after = mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("customerName", "Guest", "deliveryFee", 3.00))))
                .andExpect(status().isOk()).andReturn();
        assertEquals(false, json(after).get("deliveryFeePending").asBoolean());
        assertEquals(3.0, json(after).get("deliveryFee").asDouble(), 0.001);
        assertEquals(15.0, json(after).get("totalAmount").asDouble(), 0.001); // 12 + 3
    }

    // ---------- order lookup ----------

    @Test
    void orderLookup_byNumberAndPhone_matchesLeniently() throws Exception {
        String token = registerAndGetToken("dl-look@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Look", "dl-look-store");
        long pid = createProduct(token, storeId, "Roll", 4.00, false);
        MvcResult r = checkout(storeId, "+6591112222", "PICKUP", item(pid, 2), null);
        long orderId = json(r).get("orderId").asLong();

        // Correct number + phone (given without country code) resolves the order.
        mockMvc.perform(post("/public/stores/dl-look-store/orders/lookup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("orderId", orderId, "phone", "91112222"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value((int) orderId))
                .andExpect(jsonPath("$.subtotal").value(8.00))
                .andExpect(jsonPath("$.orders", org.hamcrest.Matchers.hasSize(1)));

        // Wrong phone -> 404 (no existence leak).
        mockMvc.perform(post("/public/stores/dl-look-store/orders/lookup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("orderId", orderId, "phone", "80000000"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void orderLookup_foreignStore_returns404() throws Exception {
        String token = registerAndGetToken("dl-look2@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Look2", "dl-look2-store");
        long pid = createProduct(token, storeId, "Bun", 3.00, false);
        long orderId = json(checkout(storeId, "+6593334444", "PICKUP", item(pid, 1), null)).get("orderId").asLong();

        // Different store's slug can't resolve this order even with the right phone.
        String other = registerAndGetToken("dl-look3@test.com", "MERCHANT", null);
        createStore(other, "Other", "dl-look-other");
        mockMvc.perform(post("/public/stores/dl-look-other/orders/lookup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("orderId", orderId, "phone", "93334444"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void orderLookup_followsSplitGroup() throws Exception {
        String token = registerAndGetToken("dl-look-split@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Split", "dl-look-split-store");
        long ready = createProduct(token, storeId, "Iced", 5.00, false);
        long pre = createProduct(token, storeId, "Espresso", 4.00, true);

        var items = List.of(Map.<String, Object>of("productId", ready, "quantity", 1),
                            Map.<String, Object>of("productId", pre, "quantity", 1));
        MvcResult r = checkout(storeId, "+6595556666", "PICKUP", items, null);
        long primaryId = json(r).get("orderId").asLong();
        // The checkout itself split into two.
        org.junit.jupiter.api.Assertions.assertEquals(2, json(r).get("orders").size());

        // Lookup by the primary (ready) order id returns BOTH group orders.
        mockMvc.perform(post("/public/stores/dl-look-split-store/orders/lookup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("orderId", primaryId, "phone", "95556666"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderGroupId").isNotEmpty())
                .andExpect(jsonPath("$.orders", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$.orders[0].kind").value("READY"))
                .andExpect(jsonPath("$.orders[1].kind").value("PREORDER"));
    }
}
