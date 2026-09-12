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
 * Automatic no-code sale pricing on products: the sale price applies within its
 * window (shop + checkout), reverts on its own once it ends, and never corrupts
 * historical orders (the effective price is snapshotted on the order line).
 */
class SalePriceIntegrationTest extends IntegrationTestBase {

    private static final String FUTURE = "2099-12-31T23:59:59";
    private static final String FAR_FUTURE_START = "2099-01-01T00:00:00";

    private long createProduct(String token, long storeId, Map<String, Object> body) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private JsonNode publicProduct(long storeId, long productId) throws Exception {
        MvcResult r = mockMvc.perform(get("/public/storefront/" + storeId + "/products"))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode p : json(r)) if (p.get("id").asLong() == productId) return p;
        throw new AssertionError("product not in public list: " + productId);
    }

    private MvcResult guestCheckout(long storeId, long productId, int qty) throws Exception {
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "customerName", "Guest", "customerPhone", "+6588880000",
                                "fulfilmentMethod", "PICKUP",
                                "items", List.of(Map.of("productId", productId, "quantity", qty))))))
                .andExpect(status().isCreated())
                .andReturn();
    }

    // ---------- active sale ----------

    @Test
    void activeSale_appliesInShopAndCheckout() throws Exception {
        String token = registerAndGetToken("sp-active@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SP Active", "sp-active-store");
        long p = createProduct(token, storeId, Map.of("name", "Item", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));

        JsonNode pub = publicProduct(storeId, p);
        assertEquals(true, pub.get("onSale").asBoolean());
        assertEquals(10.0, pub.get("price").asDouble(), 0.001);
        assertEquals(6.0, pub.get("salePrice").asDouble(), 0.001);
        assertEquals(6.0, pub.get("effectivePrice").asDouble(), 0.001);

        // Checkout charges the sale price.
        MvcResult r = guestCheckout(storeId, p, 2);
        assertEquals(12.0, json(r).get("subtotal").asDouble(), 0.001); // 2 x 6.00
    }

    @Test
    void scheduledSale_notYetActive_usesBase_andPublicHidesIt() throws Exception {
        String token = registerAndGetToken("sp-sched@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SP Sched", "sp-sched-store");
        long p = createProduct(token, storeId, Map.of(
                "name", "Item", "price", 10.00, "salePrice", 6.00,
                "saleStartsAt", FAR_FUTURE_START, "saleEndsAt", FUTURE));

        // Public: not active, so base price and the sale is hidden.
        JsonNode pub = publicProduct(storeId, p);
        assertEquals(false, pub.get("onSale").asBoolean());
        assertEquals(10.0, pub.get("effectivePrice").asDouble(), 0.001);
        assertEquals(true, pub.get("salePrice").isNull());

        // Merchant: still sees the configured (scheduled) sale for management.
        mockMvc.perform(get("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].salePrice").value(6.00))
                .andExpect(jsonPath("$[0].onSale").value(false));

        // Checkout charges the base price.
        assertEquals(20.0, json(guestCheckout(storeId, p, 2)).get("subtotal").asDouble(), 0.001);
    }

    // ---------- order-history safety ----------

    @Test
    void endingSale_revertsShopPrice_butOrderKeepsSnapshot() throws Exception {
        String token = registerAndGetToken("sp-snap@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SP Snap", "sp-snap-store");
        long p = createProduct(token, storeId, Map.of("name", "Item", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));

        // Buy while on sale -> order total 6.00.
        long orderId = json(guestCheckout(storeId, p, 1)).get("orderId").asLong();
        assertEquals(6.0, json(getWithToken("/merchant/stores/" + storeId + "/orders/" + orderId, token, 200))
                .get("totalAmount").asDouble(), 0.001);

        // End the sale (clear it). Shop reverts to base immediately...
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + p)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("salePrice", 0))))
                .andExpect(status().isOk());
        assertEquals(10.0, publicProduct(storeId, p).get("effectivePrice").asDouble(), 0.001);
        assertEquals(false, publicProduct(storeId, p).get("onSale").asBoolean());

        // ...but the past order still shows the sale price it was charged.
        assertEquals(6.0, json(getWithToken("/merchant/stores/" + storeId + "/orders/" + orderId, token, 200))
                .get("totalAmount").asDouble(), 0.001);
    }

    // ---------- modifiers + manual orders ----------

    @Test
    void modifierDelta_ridesOnSalePrice() throws Exception {
        String token = registerAndGetToken("sp-mod@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SP Mod", "sp-mod-store");
        long p = createProduct(token, storeId, Map.of(
                "name", "Drink", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE,
                "modifierGroups", List.of(Map.of(
                        "name", "Milk", "minSelect", 0, "maxSelect", 1,
                        "options", List.of(Map.of("name", "Oat", "priceDelta", 2.00))))));
        long optId = json(getWithToken("/merchant/stores/" + storeId + "/products", token, 200))
                .get(0).get("modifierGroups").get(0).get("options").get(0).get("id").asLong();

        // Sale base 6 + oat 2 = 8 per unit.
        MvcResult r = mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "customerName", "Guest", "customerPhone", "+6588881111",
                                "fulfilmentMethod", "PICKUP",
                                "items", List.of(Map.of("productId", p, "quantity", 1, "modifierOptionIds", List.of(optId)))))))
                .andExpect(status().isCreated()).andReturn();
        assertEquals(8.0, json(r).get("subtotal").asDouble(), 0.001);
    }

    @Test
    void manualOrder_honoursActiveSale() throws Exception {
        String token = registerAndGetToken("sp-manual@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SP Manual", "sp-manual-store");
        long p = createProduct(token, storeId, Map.of("name", "Item", "price", 10.00, "salePrice", 6.00, "saleEndsAt", FUTURE));

        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk In", "phoneNumber", "+6588882222",
                                "items", List.of(Map.of("productId", p, "quantity", 1))))))
                .andExpect(status().isCreated()).andReturn();
        assertEquals(6.0, json(r).get("totalAmount").asDouble(), 0.001);
    }

    // ---------- validation ----------

    @Test
    void salePriceNotBelowBase_isRejected() throws Exception {
        String token = registerAndGetToken("sp-val1@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SP Val1", "sp-val1-store");
        mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "X", "price", 10.00, "salePrice", 10.00))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void saleEndInPast_isRejected() throws Exception {
        String token = registerAndGetToken("sp-val2@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SP Val2", "sp-val2-store");
        mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "X", "price", 10.00, "salePrice", 6.00, "saleEndsAt", "2020-01-01T00:00:00"))))
                .andExpect(status().isBadRequest());
    }
}
