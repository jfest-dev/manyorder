package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Storefront + checkout money paths: delivery fee (delivery-only, merchant
 * default + per-order edit), notes/payment-method capture, the extended public
 * store projection (fee/logo/phone/totalItemsSold), and reserved-slug rejection.
 */
class StorefrontCheckoutIntegrationTest extends IntegrationTestBase {

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private void patchStore(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private MvcResult guestCheckout(long storeId, long productId, int qty, String fulfilment,
                                    Map<String, Object> extra) throws Exception {
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId,
                "customerName", "Guest",
                "customerPhone", "+6588881234",
                "fulfilmentMethod", fulfilment,
                "items", List.of(Map.of("productId", productId, "quantity", qty))));
        if (extra != null) body.putAll(extra);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private long createManualOrderWithItems(String token, long storeId, long productId, int qty) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk In",
                                "phoneNumber", "+6588885555",
                                "items", List.of(Map.of("productId", productId, "quantity", qty))))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private void advanceToCompleted(String token, long storeId, long orderId) throws Exception {
        for (String s : List.of("CONFIRMED", "PREPARING", "READY", "COMPLETED")) {
            patchStatus(token, storeId, orderId, s, 200);
        }
    }

    // ---------- delivery fee ----------

    @Test
    void deliveryFee_appliesToDeliveryOnly() throws Exception {
        String token = registerAndGetToken("sf-fee@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Fee Store", "sf-fee-store");
        long productId = createProduct(token, storeId, "Boba", 10.00);
        patchStore(token, storeId, Map.of("deliveryFee", 2.50));

        MvcResult delivery = guestCheckout(storeId, productId, 1, "DELIVERY",
                Map.of("deliveryAddress", "1 Test Road"));
        assertEquals(10.0, json(delivery).get("subtotal").asDouble(), 0.001);
        assertEquals(2.5, json(delivery).get("deliveryFee").asDouble(), 0.001);
        assertEquals(12.5, json(delivery).get("totalAmount").asDouble(), 0.001);

        MvcResult pickup = guestCheckout(storeId, productId, 1, "PICKUP", null);
        assertEquals(0.0, json(pickup).get("deliveryFee").asDouble(), 0.001);
        assertEquals(10.0, json(pickup).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void checkout_capturesNotesAndPaymentMethod_andStorePhone() throws Exception {
        String token = registerAndGetToken("sf-notes@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Notes Store", "sf-notes-store");
        long productId = createProduct(token, storeId, "Cake", 8.00);
        patchStore(token, storeId, Map.of("storePhone", "+6591234567",
                "paymentInstruction", "PayNow to 91234567"));

        MvcResult r = guestCheckout(storeId, productId, 1, "PICKUP",
                Map.of("notes", "No candles please", "paymentMethod", "PayNow"));
        mockMvc.perform(get("/merchant/stores/" + storeId + "/orders/" + json(r).get("orderId").asLong())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").value("No candles please"))
                .andExpect(jsonPath("$.paymentMethod").value("PayNow"));

        assertEquals("+6591234567", json(r).get("storePhone").asText());
        assertEquals("PayNow to 91234567", json(r).get("paymentInstruction").asText());
    }

    // ---------- public store projection ----------

    @Test
    void publicStore_exposesFeeLogoPhone_andTotalItemsSold() throws Exception {
        String token = registerAndGetToken("sf-pub@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Pub Store", "sf-pub-store");
        long productId = createProduct(token, storeId, "Roll", 4.00);
        patchStore(token, storeId, Map.of(
                "deliveryFee", 3.00,
                "storePhone", "+6590001111",
                "logoUrl", "https://res.cloudinary.com/x/image/upload/v1/manyorder/1/logo.png"));

        // Before any completed order, totalItemsSold is 0.
        mockMvc.perform(get("/public/stores/sf-pub-store"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryFee").value(3.00))
                .andExpect(jsonPath("$.phoneNumber").value("+6590001111"))
                .andExpect(jsonPath("$.logoUrl").value("https://res.cloudinary.com/x/image/upload/v1/manyorder/1/logo.png"))
                .andExpect(jsonPath("$.totalItemsSold").value(0));

        // A completed MANUAL order does NOT count toward the public tally —
        // only STOREFRONT orders do (so a merchant can't self-inflate).
        long manualOrder = createManualOrderWithItems(token, storeId, productId, 3);
        advanceToCompleted(token, storeId, manualOrder);
        mockMvc.perform(get("/public/stores/sf-pub-store"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItemsSold").value(0));

        // A completed STOREFRONT (guest) order of qty 2 lifts it to 2.
        MvcResult guest = guestCheckout(storeId, productId, 2, "PICKUP", null);
        advanceToCompleted(token, storeId, json(guest).get("orderId").asLong());
        mockMvc.perform(get("/public/stores/sf-pub-store"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItemsSold").value(2));

        // Per-product public unitsSold reflects the storefront order only (2), not the manual 3.
        MvcResult products = mockMvc.perform(get("/public/storefront/" + storeId + "/products"))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(2, json(products).get(0).get("unitsSold").asInt());
    }

    // ---------- merchant per-order fee edit ----------

    @Test
    void merchantCanEditDeliveryFee_perOrder_recomputesTotal() throws Exception {
        String token = registerAndGetToken("sf-edit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit Store", "sf-edit-store");
        long productId = createProduct(token, storeId, "Tea", 6.00);
        long orderId = createManualOrderWithItems(token, storeId, productId, 2); // subtotal 12

        MvcResult r = mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk In", "deliveryFee", 4.00))))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(12.0, json(r).get("subtotal").asDouble(), 0.001);
        assertEquals(4.0, json(r).get("deliveryFee").asDouble(), 0.001);
        assertEquals(16.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    // ---------- reserved slug ----------

    @Test
    void reservedSlug_isRejected_atCreateAndUpdate() throws Exception {
        String token = registerAndGetToken("sf-slug@test.com", "MERCHANT", null);

        mockMvc.perform(post("/merchant/stores")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storeName\":\"Reserved\",\"slug\":\"app\"}"))
                .andExpect(status().isBadRequest());

        long storeId = createStore(token, "Fine", "sf-fine-store");
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"admin\"}"))
                .andExpect(status().isBadRequest());
    }
}
