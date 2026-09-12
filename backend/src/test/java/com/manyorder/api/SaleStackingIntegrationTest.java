package com.manyorder.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Interaction of discount codes with an active product sale, gated per-code by
 * canStackWithSale (default false = the code skips on-sale lines).
 */
class SaleStackingIntegrationTest extends IntegrationTestBase {

    private static final String FUTURE = "2099-12-31T23:59:59";

    private long createProduct(String token, long storeId, Map<String, Object> body) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    private void createDiscount(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated());
    }

    private MvcResult checkout(long storeId, List<long[]> items, String code, int expected) throws Exception {
        List<Map<String, Object>> itemBodies = new ArrayList<>();
        for (long[] it : items) itemBodies.add(Map.of("productId", it[0], "quantity", it[1]));
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId, "customerName", "Guest", "customerPhone", "+6588880000",
                "fulfilmentMethod", "PICKUP", "items", itemBodies));
        if (code != null) body.put("discountCode", code);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected)).andReturn();
    }

    @Test
    void nonStacking_default_excludesSaleLine_butDiscountsFullPriceLine() throws Exception {
        String token = registerAndGetToken("ss-nonstack@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SS NonStack", "ss-nonstack-store");
        long a = createProduct(token, storeId, Map.of("name", "A", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));
        long b = createProduct(token, storeId, Map.of("name", "B", "price", 20.00));
        // Store-wide 50%, canStackWithSale defaults false.
        createDiscount(token, storeId, Map.of("code", "HALF", "type", "PERCENTAGE", "value", 50));

        // Cart A(sale 6) + B(20) = 26 subtotal. Discount applies to B only: 50% of 20 = 10.
        MvcResult r = checkout(storeId, List.of(new long[]{a, 1}, new long[]{b, 1}), "HALF", 201);
        assertEquals(26.0, json(r).get("subtotal").asDouble(), 0.001);
        assertEquals(10.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(16.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void stackingEnabled_discountsTheSalePriceToo() throws Exception {
        String token = registerAndGetToken("ss-stack@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SS Stack", "ss-stack-store");
        long a = createProduct(token, storeId, Map.of("name", "A", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));
        long b = createProduct(token, storeId, Map.of("name", "B", "price", 20.00));
        createDiscount(token, storeId, Map.of("code", "HALF", "type", "PERCENTAGE", "value", 50, "canStackWithSale", true));

        // Discount applies to the whole 26 (sale price included): 50% = 13.
        MvcResult r = checkout(storeId, List.of(new long[]{a, 1}, new long[]{b, 1}), "HALF", 201);
        assertEquals(13.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(13.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void nonStacking_allSaleCart_isRejected() throws Exception {
        String token = registerAndGetToken("ss-allsale@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SS AllSale", "ss-allsale-store");
        long a = createProduct(token, storeId, Map.of("name", "A", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));
        createDiscount(token, storeId, Map.of("code", "HALF", "type", "PERCENTAGE", "value", 50));

        // Every line is on sale and the code can't stack -> nothing to discount -> reject.
        checkout(storeId, List.of(new long[]{a, 2}), "HALF", 400);
    }

    @Test
    void nonStacking_productSpecificOnSaleProduct_isRejected() throws Exception {
        String token = registerAndGetToken("ss-pspecific@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SS PSpec", "ss-pspec-store");
        long a = createProduct(token, storeId, Map.of("name", "A", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));
        long b = createProduct(token, storeId, Map.of("name", "B", "price", 20.00));
        // Code targets A only, which is on sale, and can't stack -> nothing to discount.
        createDiscount(token, storeId, Map.of("code", "AONLY", "type", "PERCENTAGE", "value", 50, "productIds", List.of(a)));

        checkout(storeId, List.of(new long[]{a, 1}, new long[]{b, 1}), "AONLY", 400);
    }

    @Test
    void stacking_productSpecificOnSaleProduct_discountsSalePrice() throws Exception {
        String token = registerAndGetToken("ss-pstack@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SS PStack", "ss-pstack-store");
        long a = createProduct(token, storeId, Map.of("name", "A", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));
        createDiscount(token, storeId, Map.of(
                "code", "AONLY", "type", "PERCENTAGE", "value", 50, "productIds", List.of(a), "canStackWithSale", true));

        // 50% of A's sale price 6 = 3.
        MvcResult r = checkout(storeId, List.of(new long[]{a, 1}), "AONLY", 201);
        assertEquals(3.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(3.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    @Test
    void minSpend_measuredOnSalePricedSubtotal() throws Exception {
        String token = registerAndGetToken("ss-min@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SS Min", "ss-min-store");
        long a = createProduct(token, storeId, Map.of("name", "A", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));
        // Min spend 20, stacking allowed so the sale line is discountable.
        createDiscount(token, storeId, Map.of(
                "code", "MIN20", "type", "PERCENTAGE", "value", 10, "minSpend", 20, "canStackWithSale", true));

        // 3 x sale 6 = 18 < 20 -> rejected (min spend is measured on the actual sale-priced subtotal).
        checkout(storeId, List.of(new long[]{a, 3}), "MIN20", 400);
        // 4 x sale 6 = 24 >= 20 -> applies.
        checkout(storeId, List.of(new long[]{a, 4}), "MIN20", 201);
    }
}
