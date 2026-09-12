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
 * First-order-only vouchers (Discount.firstOrderOnly): valid only for a customer
 * with no prior non-cancelled order at the store. The check runs before the new
 * order is persisted, so a genuine first order is never disqualified by itself.
 * Customers are matched by phone at guest checkout.
 */
class FirstOrderDiscountIntegrationTest extends IntegrationTestBase {

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private void createDiscount(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated());
    }

    /** Guest checkout for a given customer phone, optionally with a code. */
    private MvcResult checkout(long storeId, long productId, int qty, String phone, String code, int expected) throws Exception {
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId,
                "customerName", "Guest",
                "customerPhone", phone,
                "fulfilmentMethod", "PICKUP",
                "items", List.of(Map.of("productId", productId, "quantity", qty))));
        if (code != null) body.put("discountCode", code);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected))
                .andReturn();
    }

    private void validate(long storeId, String code, String phone, long productId, int expected) throws Exception {
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId, "code", code, "fulfilmentMethod", "PICKUP",
                "items", List.of(Map.of("productId", productId, "quantity", 1))));
        if (phone != null) body.put("customerPhone", phone);
        mockMvc.perform(post("/public/discounts/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected));
    }

    // ---------- the critical regression ----------

    @Test
    void genuineFirstOrder_succeeds_notDisqualifiedByItsOwnOrder() throws Exception {
        String token = registerAndGetToken("fo-first@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FO First", "fo-first-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        createDiscount(token, storeId, Map.of("code", "NEW10", "type", "PERCENTAGE", "value", 10, "firstOrderOnly", true));

        // A brand-new customer (never ordered): the code applies. The in-progress
        // order must NOT count against the first-order check.
        MvcResult r = checkout(storeId, p, 2, "+6590000001", "NEW10", 201);
        assertEquals(20.0, json(r).get("subtotal").asDouble(), 0.001);
        assertEquals(2.0, json(r).get("discountAmount").asDouble(), 0.001); // 10% of 20
        assertEquals("NEW10", json(r).get("discountCode").asText());
    }

    // ---------- returning customer ----------

    @Test
    void returningCustomer_isRejected_atCheckoutAndValidate() throws Exception {
        String token = registerAndGetToken("fo-return@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FO Return", "fo-return-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        createDiscount(token, storeId, Map.of("code", "NEW10", "type", "PERCENTAGE", "value", 10, "firstOrderOnly", true));

        String phone = "+6590000002";
        checkout(storeId, p, 1, phone, "NEW10", 201);   // first order: applies
        checkout(storeId, p, 1, phone, "NEW10", 400);   // now has a prior order: rejected
        validate(storeId, "NEW10", phone, p, 400);      // preview with that phone also rejects
    }

    // ---------- cancelled-only prior ----------

    @Test
    void cancelledOnlyPrior_countsAsFirstTime() throws Exception {
        String token = registerAndGetToken("fo-cancel@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FO Cancel", "fo-cancel-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        createDiscount(token, storeId, Map.of("code", "NEW10", "type", "PERCENTAGE", "value", 10, "firstOrderOnly", true));

        String phone = "+6590000003";
        // A prior order that then gets cancelled by the merchant.
        MvcResult first = checkout(storeId, p, 1, phone, null, 201);
        long orderId = json(first).get("orderId").asLong();
        patchStatus(token, storeId, orderId, "CANCELLED", 200);

        // Only prior order is cancelled -> still a first-timer -> the code applies.
        MvcResult r = checkout(storeId, p, 1, phone, "NEW10", 201);
        assertEquals(1.0, json(r).get("discountAmount").asDouble(), 0.001);
    }

    // ---------- validate graceful fallback ----------

    @Test
    void validate_noContact_previewsAsApplied() throws Exception {
        String token = registerAndGetToken("fo-nocontact@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FO NoContact", "fo-nocontact-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        createDiscount(token, storeId, Map.of("code", "NEW10", "type", "PERCENTAGE", "value", 10, "firstOrderOnly", true));

        // No phone/email entered yet -> assume first-order, preview succeeds.
        validate(storeId, "NEW10", null, p, 200);
    }

    // ---------- combines with other conditions + persists ----------

    @Test
    void firstOrderOnly_roundTrips() throws Exception {
        String token = registerAndGetToken("fo-crud@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FO Crud", "fo-crud-store");
        createDiscount(token, storeId, Map.of("code", "NEW10", "type", "PERCENTAGE", "value", 10, "firstOrderOnly", true));

        mockMvc.perform(get("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].firstOrderOnly").value(true));
    }

    @Test
    void nonFirstOrderCode_isUnaffected_forReturningCustomer() throws Exception {
        String token = registerAndGetToken("fo-normal@test.com", "MERCHANT", null);
        long storeId = createStore(token, "FO Normal", "fo-normal-store");
        long p = createProduct(token, storeId, "Item", 10.00);
        // A normal code (not first-order-only) still works for a returning customer.
        createDiscount(token, storeId, Map.of("code", "ANY10", "type", "PERCENTAGE", "value", 10));

        String phone = "+6590000004";
        checkout(storeId, p, 1, phone, "ANY10", 201);
        checkout(storeId, p, 1, phone, "ANY10", 201); // still fine on a repeat order
    }
}
