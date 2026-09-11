package com.manyorder.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Product-specific discounts: a discount can be limited to a set of the store's
 * products, or left store-wide (empty scope = the original behaviour). Covers the
 * matching-subtotal maths at checkout, the split-order allocation by matching
 * share, ownership validation, and the cart-aware validate endpoint. The flagged
 * edge cases have dedicated tests: empty-match rejection, the FIXED cap on a
 * partial match, and split-allocation rounding.
 */
class ProductDiscountIntegrationTest extends IntegrationTestBase {

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        return createProduct(token, storeId, Map.of("name", name, "price", price));
    }

    private long createProduct(String token, long storeId, Map<String, Object> body) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
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

    /** Guest checkout with arbitrary line items (each [productId, quantity]). */
    private MvcResult checkout(long storeId, List<long[]> items, String discountCode, int expected) throws Exception {
        List<Map<String, Object>> itemBodies = new ArrayList<>();
        for (long[] it : items) itemBodies.add(Map.of("productId", it[0], "quantity", it[1]));
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId,
                "customerName", "Guest",
                "customerPhone", "+6588880000",
                "fulfilmentMethod", "PICKUP",
                "items", itemBodies));
        if (discountCode != null) body.put("discountCode", discountCode);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected))
                .andReturn();
    }

    private JsonNode summaryOfKind(JsonNode response, String kind) {
        for (JsonNode o : response.get("orders")) {
            if (kind.equals(o.get("kind").asText())) return o;
        }
        throw new AssertionError("No order summary of kind " + kind);
    }

    // ---------- matching subtotal (single order) ----------

    @Test
    void percentage_appliesOnlyToMatchingLines() throws Exception {
        String token = registerAndGetToken("pd-pct@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD Pct", "pd-pct-store");
        long a = createProduct(token, storeId, "A", 10.00);
        long b = createProduct(token, storeId, "B", 20.00);
        createDiscount(token, storeId, Map.of(
                "code", "AONLY", "type", "PERCENTAGE", "value", 50, "productIds", List.of(a)));

        // Cart A(10) + B(20) = 30 subtotal. 50% off only A's 10 = 5. Total 25.
        MvcResult r = checkout(storeId, List.of(new long[]{a, 1}, new long[]{b, 1}), "AONLY", 201);
        assertEquals(30.0, json(r).get("subtotal").asDouble(), 0.001);
        assertEquals(5.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(25.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void fixed_cappedAtMatchingSubtotal_notFullOrder() throws Exception {
        String token = registerAndGetToken("pd-fixcap@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD FixCap", "pd-fixcap-store");
        long a = createProduct(token, storeId, "A", 10.00);
        long b = createProduct(token, storeId, "B", 20.00);
        createDiscount(token, storeId, Map.of(
                "code", "AFIX", "type", "FIXED", "value", 15, "productIds", List.of(a)));

        // Cart A(10) + B(20) = 30. Fixed 15 but matching subtotal is only A's 10,
        // so it caps at 10 (not 15, and not the full 30). Total 20.
        MvcResult r = checkout(storeId, List.of(new long[]{a, 1}, new long[]{b, 1}), "AFIX", 201);
        assertEquals(10.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(20.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void productSpecificCode_matchingNothingInCart_returns400() throws Exception {
        String token = registerAndGetToken("pd-empty@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD Empty", "pd-empty-store");
        long a = createProduct(token, storeId, "A", 10.00);
        long b = createProduct(token, storeId, "B", 20.00);
        createDiscount(token, storeId, Map.of(
                "code", "AONLY", "type", "PERCENTAGE", "value", 50, "productIds", List.of(a)));

        // Cart has only B; the A-only code matches nothing -> rejected.
        checkout(storeId, List.of(new long[]{b, 1}), "AONLY", 400);
    }

    @Test
    void emptyScope_isStoreWide_appliesToWholeOrder() throws Exception {
        String token = registerAndGetToken("pd-wide@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD Wide", "pd-wide-store");
        long a = createProduct(token, storeId, "A", 10.00);
        long b = createProduct(token, storeId, "B", 20.00);
        // No productIds -> store-wide, unchanged behaviour.
        createDiscount(token, storeId, Map.of("code", "ALL", "type", "PERCENTAGE", "value", 10));

        MvcResult r = checkout(storeId, List.of(new long[]{a, 1}, new long[]{b, 1}), "ALL", 201);
        assertEquals(3.0, json(r).get("discountAmount").asDouble(), 0.001); // 10% of 30
        assertEquals(27.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    // ---------- split-order allocation ----------

    @Test
    void split_preorderOnlyCode_putsWholeDiscountOnPreorderOrder() throws Exception {
        String token = registerAndGetToken("pd-split-pre@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD SplitPre", "pd-split-pre-store");
        long ready = createProduct(token, storeId, "Ready", 10.00);
        long pre = createProduct(token, storeId, Map.of(
                "name", "Pre", "price", 30.00, "preOrder", true, "preOrderReadyDate", "2099-01-01"));
        createDiscount(token, storeId, Map.of(
                "code", "PONLY", "type", "PERCENTAGE", "value", 50, "productIds", List.of(pre)));

        // Cart mixes ready(10) + pre(30) -> split into two orders. 50% off pre's 30
        // = 15, allocated entirely to the pre-order order (ready share is 0).
        MvcResult r = checkout(storeId, List.of(new long[]{ready, 1}, new long[]{pre, 1}), "PONLY", 201);
        JsonNode resp = json(r);
        assertEquals(15.0, resp.get("discountAmount").asDouble(), 0.001);

        assertEquals(0.0, summaryOfKind(resp, "READY").get("discountAmount").asDouble(), 0.001);
        assertEquals(10.0, summaryOfKind(resp, "READY").get("totalAmount").asDouble(), 0.001);
        assertEquals(15.0, summaryOfKind(resp, "PREORDER").get("discountAmount").asDouble(), 0.001);
        assertEquals(15.0, summaryOfKind(resp, "PREORDER").get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void split_storeWide_allocatesByFullShare_unchanged() throws Exception {
        String token = registerAndGetToken("pd-split-wide@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD SplitWide", "pd-split-wide-store");
        long ready = createProduct(token, storeId, "Ready", 10.00);
        long pre = createProduct(token, storeId, Map.of(
                "name", "Pre", "price", 30.00, "preOrder", true, "preOrderReadyDate", "2099-01-01"));
        createDiscount(token, storeId, Map.of("code", "ALL10", "type", "PERCENTAGE", "value", 10));

        // Store-wide 10% of 40 = 4, split by full share: ready 10/40, pre 30/40.
        MvcResult r = checkout(storeId, List.of(new long[]{ready, 1}, new long[]{pre, 1}), "ALL10", 201);
        JsonNode resp = json(r);
        assertEquals(4.0, resp.get("discountAmount").asDouble(), 0.001);
        assertEquals(1.0, summaryOfKind(resp, "READY").get("discountAmount").asDouble(), 0.001);
        assertEquals(3.0, summaryOfKind(resp, "PREORDER").get("discountAmount").asDouble(), 0.001);
    }

    @Test
    void split_allocationRounds_remainderGoesToPreorderOrder() throws Exception {
        String token = registerAndGetToken("pd-round@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD Round", "pd-round-store");
        long ready = createProduct(token, storeId, "Ready", 10.00);
        long pre = createProduct(token, storeId, Map.of(
                "name", "Pre", "price", 20.00, "preOrder", true, "preOrderReadyDate", "2099-01-01"));
        // Store-wide FIXED 10 off a 30 subtotal (ready 10, pre 20).
        createDiscount(token, storeId, Map.of("code", "TEN", "type", "FIXED", "value", 10));

        MvcResult r = checkout(storeId, List.of(new long[]{ready, 1}, new long[]{pre, 1}), "TEN", 201);
        JsonNode resp = json(r);
        assertEquals(10.0, resp.get("discountAmount").asDouble(), 0.001);
        // ready share = 10 * 10/30 = 3.333 -> 3.33 (HALF_UP); pre gets the exact
        // remainder 6.67 so the two sum to 10.00 with no lost/gained cent.
        double readyDisc = summaryOfKind(resp, "READY").get("discountAmount").asDouble();
        double preDisc = summaryOfKind(resp, "PREORDER").get("discountAmount").asDouble();
        assertEquals(3.33, readyDisc, 0.001);
        assertEquals(6.67, preDisc, 0.001);
        assertEquals(10.0, readyDisc + preDisc, 0.001);
    }

    // ---------- ownership + scope persistence ----------

    @Test
    void create_withForeignProduct_isRejected() throws Exception {
        String owner = registerAndGetToken("pd-own1@test.com", "MERCHANT", null);
        long store1 = createStore(owner, "Store One", "pd-own1-store");
        long foreignProduct = createProduct(owner, store1, "Theirs", 5.00);

        String other = registerAndGetToken("pd-own2@test.com", "MERCHANT", null);
        long store2 = createStore(other, "Store Two", "pd-own2-store");

        // store2 cannot scope a discount to store1's product.
        mockMvc.perform(post("/merchant/stores/" + store2 + "/discounts")
                        .header("Authorization", "Bearer " + other)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "code", "X", "type", "FIXED", "value", 1,
                                "productIds", List.of(foreignProduct)))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_and_update_roundTripProductScope() throws Exception {
        String token = registerAndGetToken("pd-scope@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD Scope", "pd-scope-store");
        long a = createProduct(token, storeId, "A", 10.00);
        long b = createProduct(token, storeId, "B", 20.00);
        long id = createDiscount(token, storeId, Map.of(
                "code", "SCOPED", "type", "PERCENTAGE", "value", 10, "productIds", List.of(a, b)));

        mockMvc.perform(get("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productIds", org.hamcrest.Matchers.containsInAnyOrder((int) a, (int) b)));

        // PATCH to a single product, then clear back to store-wide with an empty list.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productIds", List.of(a)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productIds", org.hamcrest.Matchers.contains((int) a)));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("productIds", List.of()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productIds", org.hamcrest.Matchers.hasSize(0)));
    }

    // ---------- validate endpoint (cart-aware) ----------

    @Test
    void validate_productSpecific_matchingItems_returnsMatchingAmount() throws Exception {
        String token = registerAndGetToken("pd-val-ok@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD ValOk", "pd-val-ok-store");
        long a = createProduct(token, storeId, "A", 10.00);
        long b = createProduct(token, storeId, "B", 20.00);
        createDiscount(token, storeId, Map.of(
                "code", "AONLY", "type", "PERCENTAGE", "value", 50, "productIds", List.of(a)));

        // 50% off A's 10 = 5, even though B(20) is also in the cart.
        MvcResult r = mockMvc.perform(post("/public/discounts/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "code", "aonly",
                                "items", List.of(
                                        Map.of("productId", a, "quantity", 1),
                                        Map.of("productId", b, "quantity", 1))))))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(5.0, json(r).get("discountAmount").asDouble(), 0.001);
    }

    @Test
    void validate_productSpecific_noMatchingItems_returns400() throws Exception {
        String token = registerAndGetToken("pd-val-no@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PD ValNo", "pd-val-no-store");
        long a = createProduct(token, storeId, "A", 10.00);
        long b = createProduct(token, storeId, "B", 20.00);
        createDiscount(token, storeId, Map.of(
                "code", "AONLY", "type", "PERCENTAGE", "value", 50, "productIds", List.of(a)));

        // Cart has only B; the A-only code matches nothing -> 400.
        mockMvc.perform(post("/public/discounts/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "code", "aonly",
                                "items", List.of(Map.of("productId", b, "quantity", 1))))))
                .andExpect(status().isBadRequest());
    }
}
