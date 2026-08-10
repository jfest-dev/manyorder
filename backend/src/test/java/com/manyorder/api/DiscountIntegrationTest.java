package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Discount codes: merchant CRUD + RBAC, and the public redemption path
 * (validate endpoint + application at guest checkout, usage limits, expiry).
 */
class DiscountIntegrationTest extends IntegrationTestBase {

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

    private long createDiscount(String token, long storeId, Map<String, Object> body) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private MvcResult checkout(long storeId, long productId, int qty, String discountCode, int expectedStatus) throws Exception {
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId,
                "customerName", "Guest",
                "customerPhone", "+6588880000",
                "fulfilmentMethod", "PICKUP",
                "items", List.of(Map.of("productId", productId, "quantity", qty))));
        if (discountCode != null) body.put("discountCode", discountCode);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expectedStatus))
                .andReturn();
    }

    // ---------- CRUD ----------

    @Test
    void createListAndDelete_discount() throws Exception {
        String token = registerAndGetToken("disc-crud@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Disc Store", "disc-crud-store");

        long id = createDiscount(token, storeId, Map.of("code", "save10", "type", "PERCENTAGE", "value", 10));

        // Code is normalised to upper case.
        mockMvc.perform(get("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].code").value("SAVE10"))
                .andExpect(jsonPath("$[0].type").value("PERCENTAGE"))
                .andExpect(jsonPath("$[0].usedCount").value(0));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void duplicateCode_caseInsensitive_returns409() throws Exception {
        String token = registerAndGetToken("disc-dupe@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Dupe", "disc-dupe-store");
        createDiscount(token, storeId, Map.of("code", "WELCOME", "type", "FIXED", "value", 5));

        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "welcome", "type", "FIXED", "value", 3))))
                .andExpect(status().isConflict());
    }

    @Test
    void percentageOver100_isRejected() throws Exception {
        String token = registerAndGetToken("disc-pct@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Pct", "disc-pct-store");
        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "TOOBIG", "type", "PERCENTAGE", "value", 150))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void staffMayRead_butNotCreate() throws Exception {
        String ownerToken = registerAndGetToken("disc-staff-owner@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Staff", "disc-staff-store");
        createDiscount(ownerToken, storeId, Map.of("code", "STAFF5", "type", "FIXED", "value", 5));

        String staffToken = registerAndGetToken("disc-staff@test.com", "STAFF", "disc-staff-store");
        getWithToken("/merchant/stores/" + storeId + "/discounts", staffToken, 200);

        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("code", "NOPE", "type", "FIXED", "value", 5))))
                .andExpect(status().isForbidden());
    }

    // ---------- public validation + redemption ----------

    @Test
    void validate_returnsAmount_forPercentage() throws Exception {
        String token = registerAndGetToken("disc-val@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Val", "disc-val-store");
        createDiscount(token, storeId, Map.of("code", "TEN", "type", "PERCENTAGE", "value", 10));

        MvcResult r = mockMvc.perform(post("/public/discounts/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("merchantId", storeId, "code", "ten", "subtotal", 50.00))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("TEN"))
                .andReturn();
        assertEquals(5.0, json(r).get("discountAmount").asDouble(), 0.001);
    }

    @Test
    void validate_invalidCode_returns400() throws Exception {
        String token = registerAndGetToken("disc-bad@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Bad", "disc-bad-store");
        mockMvc.perform(post("/public/discounts/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("merchantId", storeId, "code", "NOPE", "subtotal", 10.00))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkout_appliesDiscount_incrementsUsage_snapshotsCode() throws Exception {
        String token = registerAndGetToken("disc-apply@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Apply", "disc-apply-store");
        long productId = createProduct(token, storeId, "Widget", 10.00);
        createDiscount(token, storeId, Map.of("code", "HALF", "type", "PERCENTAGE", "value", 50));

        // 2 x 10.00 = 20.00 subtotal, 50% off -> 10.00 discount -> 10.00 total.
        MvcResult r = checkout(storeId, productId, 2, "half", 201);
        assertEquals(20.0, json(r).get("subtotal").asDouble(), 0.001);
        assertEquals(10.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(10.0, json(r).get("totalAmount").asDouble(), 0.001);
        assertEquals("HALF", json(r).get("discountCode").asText());

        // usedCount incremented on the discount.
        MvcResult list = getWithToken("/merchant/stores/" + storeId + "/discounts", token, 200);
        assertEquals(1, json(list).get(0).get("usedCount").asInt());
    }

    @Test
    void fixedDiscount_cappedAtSubtotal() throws Exception {
        String token = registerAndGetToken("disc-cap@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Cap", "disc-cap-store");
        long productId = createProduct(token, storeId, "Cheap", 3.00);
        createDiscount(token, storeId, Map.of("code", "BIG", "type", "FIXED", "value", 100));

        // 1 x 3.00 subtotal, fixed 100 off -> capped to 3.00 -> total 0.
        MvcResult r = checkout(storeId, productId, 1, "BIG", 201);
        assertEquals(3.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(0.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void usageLimit_reached_blocksFurtherRedemption() throws Exception {
        String token = registerAndGetToken("disc-limit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Limit", "disc-limit-store");
        long productId = createProduct(token, storeId, "One", 5.00);
        createDiscount(token, storeId, Map.of(
                "code", "ONCE", "type", "FIXED", "value", 1, "usageLimit", 1));

        checkout(storeId, productId, 1, "ONCE", 201);       // first use ok
        checkout(storeId, productId, 1, "ONCE", 400);       // limit reached
    }

    @Test
    void expiredCode_isRejected() throws Exception {
        String token = registerAndGetToken("disc-exp@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Exp", "disc-exp-store");
        long productId = createProduct(token, storeId, "Old", 5.00);
        createDiscount(token, storeId, Map.of(
                "code", "GONE", "type", "FIXED", "value", 1,
                "endsAt", "2020-01-01T00:00:00"));

        checkout(storeId, productId, 1, "GONE", 400);
    }

    @Test
    void inactiveCode_isRejected() throws Exception {
        String token = registerAndGetToken("disc-off@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Off", "disc-off-store");
        long productId = createProduct(token, storeId, "Item", 5.00);
        createDiscount(token, storeId, Map.of(
                "code", "OFF", "type", "FIXED", "value", 1, "active", false));

        checkout(storeId, productId, 1, "OFF", 400);
    }
}
