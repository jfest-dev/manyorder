package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.manyorder.api.domain.discount.Discount;
import com.manyorder.api.domain.discount.DiscountRepository;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Discount codes: merchant CRUD + RBAC, and the public redemption path
 * (validate endpoint + application at guest checkout, usage limits, expiry).
 */
class DiscountIntegrationTest extends IntegrationTestBase {

    @Autowired private DiscountRepository discountRepository;
    @Autowired private MerchantRepository merchantRepository;

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price, "stock", 100000))))
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

    /** The store's discount codes in list order (top-to-bottom). */
    private java.util.List<String> discountCodes(String token, long storeId) throws Exception {
        JsonNode arr = json(getWithToken("/merchant/stores/" + storeId + "/discounts", token, 200));
        java.util.List<String> codes = new java.util.ArrayList<>();
        for (JsonNode n : arr) codes.add(n.get("code").asText());
        return codes;
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

        long id = createDiscount(token, storeId, Map.of("code", "save10", "name", "Ten Percent Off", "type", "PERCENTAGE", "value", 10));

        // Code is normalised to upper case; the optional name round-trips.
        mockMvc.perform(get("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].code").value("SAVE10"))
                .andExpect(jsonPath("$[0].name").value("Ten Percent Off"))
                .andExpect(jsonPath("$[0].type").value("PERCENTAGE"))
                .andExpect(jsonPath("$[0].usedCount").value(0));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void editFreeDeliveryDiscount_doesNotRequireValue() throws Exception {
        String token = registerAndGetToken("disc-fd-edit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FD Edit", "disc-fd-edit-store");
        long id = createDiscount(token, storeId, Map.of("code", "FREESHIP", "type", "FREE_DELIVERY"));

        // A free-delivery voucher's value is unused (0). Editing it (the client sends
        // value 0) must not be blocked by a value>0 rule. Regression: @Positive on
        // the update DTO's value rejected 0 at the @Valid layer, before validateShape.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Free shipping", "value", 0))))
                .andExpect(status().isOk());
    }

    @Test
    void editPercentageDiscount_toZeroValue_stillRejected() throws Exception {
        String token = registerAndGetToken("disc-pct-zero@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Pct Zero", "disc-pct-zero-store");
        long id = createDiscount(token, storeId, Map.of("code", "TEN", "type", "PERCENTAGE", "value", 10));

        // The value>0 rule still applies to percentage/fixed on update (validateShape).
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("value", 0))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reorderDiscounts_setsOrder_andNewOnesAppend() throws Exception {
        String token = registerAndGetToken("disc-reorder@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Reorder", "disc-reorder-store");
        long a = createDiscount(token, storeId, Map.of("code", "AAA", "type", "FIXED", "value", 5));
        long b = createDiscount(token, storeId, Map.of("code", "BBB", "type", "FIXED", "value", 5));
        long c = createDiscount(token, storeId, Map.of("code", "CCC", "type", "FIXED", "value", 5));

        // Default order is creation order (each new discount appends at the end).
        assertEquals(java.util.List.of("AAA", "BBB", "CCC"), discountCodes(token, storeId));

        // Reorder to C, A, B.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/reorder")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("discountIds", java.util.List.of(c, a, b)))))
                .andExpect(status().isOk());
        assertEquals(java.util.List.of("CCC", "AAA", "BBB"), discountCodes(token, storeId));

        // A brand-new discount appends at the very end of the current order.
        createDiscount(token, storeId, Map.of("code", "DDD", "type", "FIXED", "value", 5));
        assertEquals(java.util.List.of("CCC", "AAA", "BBB", "DDD"), discountCodes(token, storeId));
    }

    @Test
    void reorderDiscounts_asStaff_isForbidden() throws Exception {
        String owner = registerAndGetToken("disc-reorder-owner@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "ReorderStaff", "disc-reorder-staff-store");
        long a = createDiscount(owner, storeId, Map.of("code", "AAA", "type", "FIXED", "value", 5));
        long b = createDiscount(owner, storeId, Map.of("code", "BBB", "type", "FIXED", "value", 5));

        String staff = registerAndGetToken("disc-reorder-staff@test.com", "STAFF", "disc-reorder-staff-store");
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/reorder")
                        .header("Authorization", "Bearer " + staff).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("discountIds", java.util.List.of(b, a)))))
                .andExpect(status().isForbidden());
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
        long productId = createProduct(token, storeId, "Item", 25.00);
        createDiscount(token, storeId, Map.of("code", "TEN", "type", "PERCENTAGE", "value", 10));

        // The validate contract now takes the cart items and prices them
        // server-side: 2 x 25.00 = 50.00 subtotal, 10% off -> 5.00.
        MvcResult r = mockMvc.perform(post("/public/discounts/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "code", "ten",
                                "items", List.of(Map.of("productId", productId, "quantity", 2))))))
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
        // The API now blocks creating a past-end code, so make a valid one and
        // expire it directly (simulating time passing after it was set up).
        createDiscount(token, storeId, Map.of("code", "GONE", "type", "FIXED", "value", 1));
        Merchant merchant = merchantRepository.findById(storeId).orElseThrow();
        Discount d = discountRepository.findByMerchantAndCodeIgnoreCase(merchant, "GONE").orElseThrow();
        d.setEndsAt(java.time.LocalDateTime.now().minusDays(1));
        discountRepository.save(d);

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

    @Test
    void updateDiscount_clearsValidityWindow_whenDatesSentNull() throws Exception {
        String token = registerAndGetToken("disc-clear-dates@test.com", "MERCHANT", null);
        long storeId = createStore(token, "ClearDates", "disc-clear-dates-store");
        long id = createDiscount(token, storeId, Map.of(
                "code", "WINDOW", "type", "FIXED", "value", 5,
                "startsAt", "2030-01-01T00:00:00", "endsAt", "2030-12-31T23:59:59"));

        // Both bounds are set to begin with.
        JsonNode before = firstDiscount(token, storeId);
        assertEquals("2030-01-01T00:00:00", before.get("startsAt").asText());
        assertEquals("2030-12-31T23:59:59", before.get("endsAt").asText());

        // The edit form always sends the whole window, so an explicit null clears
        // it (open-ended), rather than leaving the old value in place.
        java.util.HashMap<String, Object> clear = new java.util.HashMap<>();
        clear.put("code", "WINDOW");
        clear.put("type", "FIXED");
        clear.put("value", 5);
        clear.put("startsAt", null);
        clear.put("endsAt", null);
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(clear)))
                .andExpect(status().isOk());

        JsonNode after = firstDiscount(token, storeId);
        assertEquals(true, after.get("startsAt").isNull());
        assertEquals(true, after.get("endsAt").isNull());

        // A later edit can set the window again (normal round-trip still works).
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "code", "WINDOW", "type", "FIXED", "value", 5,
                                "endsAt", "2031-06-30T23:59:59"))))
                .andExpect(status().isOk());
        JsonNode reset = firstDiscount(token, storeId);
        assertEquals("2031-06-30T23:59:59", reset.get("endsAt").asText());
    }

    @Test
    void createDiscount_withPastEndDate_isRejected() throws Exception {
        String token = registerAndGetToken("disc-pastend-create@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PastEnd", "disc-pastend-store");
        String pastEnd = java.time.LocalDate.now().minusDays(1) + "T00:00:00";

        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "code", "STALE", "type", "FIXED", "value", 5, "endsAt", pastEnd))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateDiscount_toPastEndDate_isRejected() throws Exception {
        String token = registerAndGetToken("disc-pastend-update@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PastEndUpd", "disc-pastend-upd-store");
        long id = createDiscount(token, storeId, Map.of("code", "OKAY", "type", "FIXED", "value", 5));
        String pastEnd = java.time.LocalDate.now().minusDays(1) + "T00:00:00";

        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "code", "OKAY", "type", "FIXED", "value", 5, "endsAt", pastEnd))))
                .andExpect(status().isBadRequest());
    }

    /** The store's first (and here only) discount, as JSON. */
    private JsonNode firstDiscount(String token, long storeId) throws Exception {
        return json(getWithToken("/merchant/stores/" + storeId + "/discounts", token, 200)).get(0);
    }
}
