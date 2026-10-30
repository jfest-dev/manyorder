package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The POST /public/discounts/evaluate endpoint: a 200 in every case carrying a
 * status and, when not available, structured reasons - the contract the richer
 * apply UI relies on. Complements the unit-level DiscountEvaluationTest (gate
 * logic) by covering the HTTP wiring and that an unknown code reveals nothing.
 */
class DiscountEvaluateEndpointIntegrationTest extends IntegrationTestBase {

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price, "stock", 100000))))
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

    private MvcResult evaluate(Object body) throws Exception {
        return mockMvc.perform(post("/public/discounts/evaluate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
    }

    @Test
    void minSpendNotMet_returns200_withStructuredReasonAndRemaining() throws Exception {
        String token = registerAndGetToken("eval-min@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Eval Min", "eval-min-store");
        long productId = createProduct(token, storeId, "Item", 10.00);
        createDiscount(token, storeId, Map.of("code", "SPEND30", "type", "PERCENTAGE", "value", 10, "minSpend", 30));

        // 1 x 10.00 = 10.00 subtotal, below the 30.00 minimum -> remaining 20.00.
        MvcResult r = evaluate(Map.of(
                "merchantId", storeId, "code", "spend30", "fulfilmentMethod", "PICKUP",
                "items", List.of(Map.of("productId", productId, "quantity", 1))));
        assertEquals("NOT_AVAILABLE", json(r).get("status").asText());
        assertEquals("MIN_SPEND", json(r).get("reasons").get(0).get("code").asText());
        assertEquals(20.0, json(r).get("reasons").get(0).get("amount").asDouble(), 0.001);
    }

    @Test
    void unknownCode_returns200_invalid_withNoReasons() throws Exception {
        String token = registerAndGetToken("eval-bad@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Eval Bad", "eval-bad-store");
        long productId = createProduct(token, storeId, "Item", 10.00);

        MvcResult r = evaluate(Map.of(
                "merchantId", storeId, "code", "GHOST", "fulfilmentMethod", "PICKUP",
                "items", List.of(Map.of("productId", productId, "quantity", 1))));
        assertEquals("INVALID", json(r).get("status").asText());
        assertEquals(0, json(r).get("reasons").size(), "an unknown code reveals nothing");
    }

    @Test
    void allGatesPass_returns200_applied_withAmount() throws Exception {
        String token = registerAndGetToken("eval-ok@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Eval OK", "eval-ok-store");
        long productId = createProduct(token, storeId, "Item", 25.00);
        createDiscount(token, storeId, Map.of("code", "TEN", "type", "PERCENTAGE", "value", 10));

        // 2 x 25.00 = 50.00, 10% -> 5.00.
        MvcResult r = evaluate(Map.of(
                "merchantId", storeId, "code", "ten", "fulfilmentMethod", "PICKUP",
                "items", List.of(Map.of("productId", productId, "quantity", 2))));
        assertEquals("APPLIED", json(r).get("status").asText());
        assertEquals(5.0, json(r).get("discountAmount").asDouble(), 0.001);
        assertEquals(0, json(r).get("reasons").size());
    }
}
