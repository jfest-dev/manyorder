package com.manyorder.api;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
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
 * Free-delivery vouchers (DiscountType.FREE_DELIVERY): waive the delivery fee
 * instead of discounting products. Covers the three delivery states (flat fee /
 * to-be-confirmed / already free), pickup rejection, the split-order case (the
 * fee lives on the ready bucket), the cart-aware validate preview, and the
 * value-optional create shape.
 */
class FreeDeliveryDiscountIntegrationTest extends IntegrationTestBase {

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, Map<String, Object> body) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        return createProduct(token, storeId, Map.of("name", name, "price", price));
    }

    private void patchStore(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    /** The store PATCH doesn't carry freeDeliveryThreshold; the /delivery endpoint does. */
    private void patchDelivery(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/delivery")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private void createDiscount(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated());
    }

    /** Guest checkout with one product line and a fulfilment method (+ address for delivery). */
    private MvcResult checkout(long storeId, List<long[]> items, String fulfilment, String code, int expected) throws Exception {
        List<Map<String, Object>> itemBodies = new java.util.ArrayList<>();
        for (long[] it : items) itemBodies.add(Map.of("productId", it[0], "quantity", it[1]));
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId,
                "customerName", "Guest",
                "customerPhone", "+6588880000",
                "fulfilmentMethod", fulfilment,
                "items", itemBodies));
        if ("DELIVERY".equals(fulfilment)) body.put("deliveryAddress", "1 Test Road");
        if (code != null) body.put("discountCode", code);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected))
                .andReturn();
    }

    private MvcResult validate(long storeId, String code, String fulfilment, List<long[]> items, int expected) throws Exception {
        List<Map<String, Object>> itemBodies = new java.util.ArrayList<>();
        for (long[] it : items) itemBodies.add(Map.of("productId", it[0], "quantity", it[1]));
        return mockMvc.perform(post("/public/discounts/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "code", code,
                                "fulfilmentMethod", fulfilment, "items", itemBodies))))
                .andExpect(status().is(expected))
                .andReturn();
    }

    private JsonNode summaryOfKind(JsonNode response, String kind) {
        for (JsonNode o : response.get("orders")) if (kind.equals(o.get("kind").asText())) return o;
        throw new AssertionError("No order summary of kind " + kind);
    }

    // ---------- delivery states ----------

    @Test
    void waivesFlatDeliveryFee() throws Exception {
        String token = registerAndGetToken("fd-flat@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Flat", "fd-flat-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        patchStore(token, storeId, Map.of("deliveryFee", 5.00));
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        // Delivery order: 10 subtotal + 5 delivery, waived -> net delivery 0, total 10.
        MvcResult r = checkout(storeId, List.of(new long[]{p, 1}), "DELIVERY", "FREESHIP", 201);
        JsonNode resp = json(r);
        assertEquals(10.0, resp.get("subtotal").asDouble(), 0.001);
        assertEquals(0.0, resp.get("deliveryFee").asDouble(), 0.001);       // net charge
        assertEquals(5.0, resp.get("deliveryDiscount").asDouble(), 0.001);  // amount waived
        assertEquals(0.0, resp.get("discountAmount").asDouble(), 0.001);    // no product discount
        assertEquals("FREESHIP", resp.get("discountCode").asText());
        assertEquals(10.0, resp.get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void rejectedOnPickup() throws Exception {
        String token = registerAndGetToken("fd-pickup@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Pickup", "fd-pickup-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        patchStore(token, storeId, Map.of("deliveryFee", 5.00));
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        checkout(storeId, List.of(new long[]{p, 1}), "PICKUP", "FREESHIP", 400);
    }

    @Test
    void rejectedWhenDeliveryExplicitlyFree() throws Exception {
        String token = registerAndGetToken("fd-free0@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Free0", "fd-free0-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        patchStore(token, storeId, Map.of("deliveryFee", 0.00)); // explicitly free
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        checkout(storeId, List.of(new long[]{p, 1}), "DELIVERY", "FREESHIP", 400);
    }

    @Test
    void rejectedWhenFreeByThreshold() throws Exception {
        String token = registerAndGetToken("fd-thresh@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Thresh", "fd-thresh-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        patchDelivery(token, storeId, Map.of("deliveryFee", 5.00, "freeDeliveryThreshold", 20.00));
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        // Cart 30 >= 20 threshold -> delivery already free -> reject.
        checkout(storeId, List.of(new long[]{p, 3}), "DELIVERY", "FREESHIP", 400);
    }

    @Test
    void pendingFeeIsForcedFree() throws Exception {
        String token = registerAndGetToken("fd-pending@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Pending", "fd-pending-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        // No delivery fee configured -> normally "to be confirmed" (pending).
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        MvcResult r = checkout(storeId, List.of(new long[]{p, 1}), "DELIVERY", "FREESHIP", 201);
        JsonNode resp = json(r);
        // Forced free: no pending flag, net delivery 0, total = subtotal. Nothing
        // quantifiable to waive, so deliveryDiscount is 0.
        assertEquals(false, resp.get("deliveryFeePending").asBoolean());
        assertEquals(0.0, resp.get("deliveryFee").asDouble(), 0.001);
        assertEquals(0.0, resp.get("deliveryDiscount").asDouble(), 0.001);
        assertEquals(10.0, resp.get("totalAmount").asDouble(), 0.001);
    }

    // ---------- split order ----------

    @Test
    void split_waivesReadyBucketFee() throws Exception {
        String token = registerAndGetToken("fd-split@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Split", "fd-split-store");
        long ready = createProduct(token, storeId, "Ready", 10.00);
        long pre = createProduct(token, storeId, Map.of(
                "name", "Pre", "price", 20.00, "preOrder", true, "preOrderReadyDate", "2099-01-01"));
        patchStore(token, storeId, Map.of("deliveryFee", 5.00));
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        // Mixed cart -> split. The delivery fee (and its waiver) sit on the ready order.
        MvcResult r = checkout(storeId, List.of(new long[]{ready, 1}, new long[]{pre, 1}), "DELIVERY", "FREESHIP", 201);
        JsonNode resp = json(r);
        assertEquals(0.0, resp.get("deliveryFee").asDouble(), 0.001);
        assertEquals(5.0, resp.get("deliveryDiscount").asDouble(), 0.001);
        assertEquals(30.0, resp.get("totalAmount").asDouble(), 0.001); // 10 + 20, delivery waived

        assertEquals(5.0, summaryOfKind(resp, "READY").get("deliveryDiscount").asDouble(), 0.001);
        assertEquals(0.0, summaryOfKind(resp, "READY").get("deliveryFee").asDouble(), 0.001);
        assertEquals(0.0, summaryOfKind(resp, "PREORDER").get("deliveryDiscount").asDouble(), 0.001);
    }

    // ---------- min spend interaction ----------

    @Test
    void freeDelivery_belowMinSpend_isRejected() throws Exception {
        String token = registerAndGetToken("fd-min@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Min", "fd-min-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        patchStore(token, storeId, Map.of("deliveryFee", 5.00));
        createDiscount(token, storeId, Map.of("code", "FREE30", "type", "FREE_DELIVERY", "minSpend", 30));

        checkout(storeId, List.of(new long[]{p, 1}), "DELIVERY", "FREE30", 400); // 10 < 30
        checkout(storeId, List.of(new long[]{p, 3}), "DELIVERY", "FREE30", 201); // 30 >= 30
    }

    // ---------- validate preview ----------

    @Test
    void validate_delivery_previewsWaivedAmount() throws Exception {
        String token = registerAndGetToken("fd-val@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Val", "fd-val-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        patchStore(token, storeId, Map.of("deliveryFee", 5.00));
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        MvcResult r = validate(storeId, "FREESHIP", "DELIVERY", List.of(new long[]{p, 1}), 200);
        JsonNode resp = json(r);
        assertEquals("FREESHIP", resp.get("code").asText());
        assertEquals(true, resp.get("freeDelivery").asBoolean());
        assertEquals(5.0, resp.get("deliveryDiscount").asDouble(), 0.001);
        assertEquals(0.0, resp.get("discountAmount").asDouble(), 0.001);

        // Pickup preview rejects, matching the submit.
        validate(storeId, "FREESHIP", "PICKUP", List.of(new long[]{p, 1}), 400);
    }

    // ---------- create shape ----------

    @Test
    void create_freeDelivery_needsNoValue_andStoresType() throws Exception {
        String token = registerAndGetToken("fd-create@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Create", "fd-create-store");
        // No "value" field at all.
        createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        mockMvc.perform(get("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("FREE_DELIVERY"))
                .andExpect(jsonPath("$[0].value").value(0));
    }

    @Test
    void create_percentage_withoutValue_isRejected() throws Exception {
        String token = registerAndGetToken("fd-noval@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD NoVal", "fd-noval-store");
        // A non-free-delivery code still requires a positive value.
        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "X", "type", "PERCENTAGE"))))
                .andExpect(status().isBadRequest());
    }
}
