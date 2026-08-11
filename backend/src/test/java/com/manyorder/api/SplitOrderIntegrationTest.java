package com.manyorder.api;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A storefront checkout that mixes ready and pre-order items splits into two
 * linked orders: delivery fee once (on the ready order), discount redeemed once
 * and allocated by subtotal share, both tied by orderGroupId.
 */
class SplitOrderIntegrationTest extends IntegrationTestBase {

    private long createReadyProduct(String token, long storeId, String name, double price, int stock) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price, "stock", stock))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private long createPreorderProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price, "preOrder", true))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private long createDiscount(String token, long storeId, String code, String type, int value) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", code, "type", type, "value", value))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private MvcResult checkout(long storeId, List<Map<String, Object>> items, String fulfilment, String discountCode) throws Exception {
        var body = new java.util.HashMap<String, Object>(Map.of(
                "merchantId", storeId,
                "customerName", "Split Guest",
                "customerPhone", "+6577770000",
                "fulfilmentMethod", fulfilment,
                "items", items));
        if ("DELIVERY".equals(fulfilment)) body.put("deliveryAddress", "1 Split Road");
        if (discountCode != null) body.put("discountCode", discountCode);
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private JsonNode orderOfKind(JsonNode body, String kind) {
        for (JsonNode o : body.get("orders")) {
            if (kind.equals(o.get("kind").asText())) return o;
        }
        throw new AssertionError("no order of kind " + kind);
    }

    @Test
    void mixedCart_splitsIntoTwoLinkedOrders() throws Exception {
        String token = registerAndGetToken("split-basic@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Split Store", "split-basic-store");
        long readyId = createReadyProduct(token, storeId, "Latte", 10.00, 20);
        long preId = createPreorderProduct(token, storeId, "Festive Cake", 5.00);

        MvcResult r = checkout(storeId, List.of(
                Map.of("productId", readyId, "quantity", 2),   // ready subtotal 20
                Map.of("productId", preId, "quantity", 1)),    // pre subtotal 5
                "PICKUP", null);
        JsonNode body = json(r);

        // Two orders, linked by a shared group id.
        assertTrue(!body.get("orderGroupId").isNull(), "split must carry an orderGroupId");
        assertEquals(2, body.get("orders").size());
        assertEquals(25.0, body.get("subtotal").asDouble(), 0.001);   // combined
        assertEquals(25.0, body.get("totalAmount").asDouble(), 0.001);

        JsonNode ready = orderOfKind(body, "READY");
        JsonNode pre = orderOfKind(body, "PREORDER");
        assertEquals(20.0, ready.get("subtotal").asDouble(), 0.001);
        assertEquals(5.0, pre.get("subtotal").asDouble(), 0.001);
        assertNotNull(ready.get("orderId"));
        assertTrue(ready.get("orderId").asLong() != pre.get("orderId").asLong(), "two distinct orders");
    }

    @Test
    void split_deliveryFeeOnReadyOnly_discountAllocatedProportionally() throws Exception {
        String token = registerAndGetToken("split-money@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Money", "split-money-store");
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deliveryFee\":3.00}"))
                .andExpect(status().isOk());
        long readyId = createReadyProduct(token, storeId, "Brew", 10.00, 20);
        long preId = createPreorderProduct(token, storeId, "Preorder Bun", 5.00);
        createDiscount(token, storeId, "TWENTY", "PERCENTAGE", 20);

        // ready 20 + pre 5 = 25 subtotal; fee 3 (delivery); 20% off = 5 total discount.
        MvcResult r = checkout(storeId, List.of(
                Map.of("productId", readyId, "quantity", 2),
                Map.of("productId", preId, "quantity", 1)),
                "DELIVERY", "TWENTY");
        JsonNode body = json(r);

        assertEquals(3.0, body.get("deliveryFee").asDouble(), 0.001);       // combined fee once
        assertEquals(5.0, body.get("discountAmount").asDouble(), 0.001);    // combined discount
        assertEquals(23.0, body.get("totalAmount").asDouble(), 0.001);      // 25 + 3 - 5

        JsonNode ready = orderOfKind(body, "READY");
        JsonNode pre = orderOfKind(body, "PREORDER");
        assertEquals(3.0, ready.get("deliveryFee").asDouble(), 0.001);      // fee only on ready
        assertEquals(0.0, pre.get("deliveryFee").asDouble(), 0.001);
        assertEquals(4.0, ready.get("discountAmount").asDouble(), 0.001);   // 5 * 20/25
        assertEquals(1.0, pre.get("discountAmount").asDouble(), 0.001);     // 5 * 5/25
        assertEquals(19.0, ready.get("totalAmount").asDouble(), 0.001);     // 20 + 3 - 4
        assertEquals(4.0, pre.get("totalAmount").asDouble(), 0.001);        // 5 + 0 - 1

        // Code redeemed exactly once across the split.
        MvcResult list = getWithToken("/merchant/stores/" + storeId + "/discounts", token, 200);
        assertEquals(1, json(list).get(0).get("usedCount").asInt());
    }

    @Test
    void bothSplitOrders_visibleToMerchant_withSameGroupId() throws Exception {
        String token = registerAndGetToken("split-merchant@test.com", "MERCHANT", null);
        long storeId = createStore(token, "MView", "split-merchant-store");
        long readyId = createReadyProduct(token, storeId, "Tea", 4.00, 10);
        long preId = createPreorderProduct(token, storeId, "Preorder Tart", 6.00);

        JsonNode body = json(checkout(storeId, List.of(
                Map.of("productId", readyId, "quantity", 1),
                Map.of("productId", preId, "quantity", 1)),
                "PICKUP", null));
        String groupId = body.get("orderGroupId").asText();
        long readyOrderId = orderOfKind(body, "READY").get("orderId").asLong();
        long preOrderId = orderOfKind(body, "PREORDER").get("orderId").asLong();

        MvcResult a = getWithToken("/merchant/stores/" + storeId + "/orders/" + readyOrderId, token, 200);
        MvcResult b = getWithToken("/merchant/stores/" + storeId + "/orders/" + preOrderId, token, 200);
        assertEquals(groupId, json(a).get("orderGroupId").asText());
        assertEquals(groupId, json(b).get("orderGroupId").asText());
    }

    @Test
    void allReadyCart_staysSingleOrder() throws Exception {
        String token = registerAndGetToken("split-none@test.com", "MERCHANT", null);
        long storeId = createStore(token, "NoSplit", "split-none-store");
        long readyId = createReadyProduct(token, storeId, "Only Ready", 8.00, 10);

        JsonNode body = json(checkout(storeId, List.of(Map.of("productId", readyId, "quantity", 1)), "PICKUP", null));
        assertTrue(body.get("orderGroupId").isNull(), "single order has no group id");
        assertEquals(1, body.get("orders").size());
        assertEquals("STANDARD", body.get("orders").get(0).get("kind").asText());
    }

    @Test
    void allPreorderCart_staysSingleOrder() throws Exception {
        String token = registerAndGetToken("split-preonly@test.com", "MERCHANT", null);
        long storeId = createStore(token, "PreOnly", "split-preonly-store");
        long preId = createPreorderProduct(token, storeId, "Only Preorder", 9.00);

        JsonNode body = json(checkout(storeId, List.of(Map.of("productId", preId, "quantity", 1)), "PICKUP", null));
        assertTrue(body.get("orderGroupId").isNull(), "single order has no group id");
        assertEquals(1, body.get("orders").size());
        assertEquals("STANDARD", body.get("orders").get(0).get("kind").asText());
    }
}
