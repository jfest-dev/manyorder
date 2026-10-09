package com.manyorder.api;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Private tracking link: read-by-token, split orders, 404, no PII, uniqueness, and the number+phone fallback. */
class TrackOrderIntegrationTest extends IntegrationTestBase {

    private long createProduct(String token, long storeId, Map<String, Object> body) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    private MvcResult checkout(Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
    }

    private MvcResult track(String token, int expected) throws Exception {
        return mockMvc.perform(post("/public/orders/track")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", token))))
                .andExpect(status().is(expected)).andReturn();
    }

    @Test
    void validToken_returnsTheOrder_withNoCustomerPii() throws Exception {
        String t = registerAndGetToken("trk-pii@test.com", "MERCHANT", null);
        long storeId = createStore(t, "Track Store", "trk-store");
        long productId = createProduct(t, storeId, Map.of("name", "Latte", "price", 6.0, "stock", 100));

        MvcResult co = checkout(new java.util.HashMap<>(Map.of(
                "merchantId", storeId, "customerName", "Jamie Secret", "customerPhone", "+6588881234",
                "customerEmail", "secret@buyer.test", "fulfilmentMethod", "DELIVERY",
                "deliveryAddress", "42 Private Lane", "notes", "ring the bell",
                "items", List.of(Map.of("productId", productId, "quantity", 1)))));
        String tok = json(co).get("trackingToken").asText();
        long orderId = json(co).get("orderId").asLong();
        assertFalse(tok.isBlank(), "checkout returns a tracking token");

        MvcResult res = track(tok, 200);
        JsonNode body = json(res);
        assertEquals("Track Store", body.get("storeName").asText());
        assertTrue(body.get("contactLink").asText().contains("trk-store"));
        assertEquals("DELIVERY", body.get("orderType").asText());
        assertTrue(body.get("orderNumbers").toString().contains(String.valueOf(orderId)));
        assertTrue(body.get("orders").get(0).get("items").size() > 0, "items with options present");

        // No customer PII anywhere in the payload.
        String raw = res.getResponse().getContentAsString();
        assertFalse(raw.contains("+6588881234"), "no customer phone");
        assertFalse(raw.contains("secret@buyer.test"), "no customer email");
        assertFalse(raw.contains("42 Private Lane"), "no delivery address");
        assertFalse(raw.contains("Jamie Secret"), "no customer name");
    }

    @Test
    void splitCheckout_bothOrdersShareOneToken_andBothShow() throws Exception {
        String t = registerAndGetToken("trk-split@test.com", "MERCHANT", null);
        long storeId = createStore(t, "Split Store", "trk-split-store");
        long ready = createProduct(t, storeId, Map.of("name", "Ready Bun", "price", 4.0, "stock", 100));
        long preorder = createProduct(t, storeId, new java.util.HashMap<>(Map.of(
                "name", "Pre Cake", "price", 20.0, "stock", 100,
                "preOrder", true, "preOrderReadyDate", LocalDate.now().plusDays(3).toString())));

        MvcResult co = checkout(new java.util.HashMap<>(Map.of(
                "merchantId", storeId, "customerName", "Guest", "customerPhone", "+6588882222",
                "fulfilmentMethod", "PICKUP",
                "items", List.of(
                        Map.of("productId", ready, "quantity", 1),
                        Map.of("productId", preorder, "quantity", 1)))));
        assertEquals(2, json(co).get("orders").size(), "checkout split into two orders");
        String tok = json(co).get("trackingToken").asText();

        JsonNode body = json(track(tok, 200));
        assertEquals(2, body.get("orderNumbers").size(), "both split orders are tracked by one token");
        assertEquals(2, body.get("orders").size());
    }

    @Test
    void unknownToken_returns404() throws Exception {
        track("this-token-does-not-exist", 404);
    }

    @Test
    void tokensAreUniquePerCheckout() throws Exception {
        String t = registerAndGetToken("trk-uniq@test.com", "MERCHANT", null);
        long storeId = createStore(t, "Uniq Store", "trk-uniq-store");
        long productId = createProduct(t, storeId, Map.of("name", "Tea", "price", 3.0, "stock", 100));
        Map<String, Object> body = Map.of("merchantId", storeId, "customerName", "G", "customerPhone", "+6588883333",
                "fulfilmentMethod", "PICKUP", "items", List.of(Map.of("productId", productId, "quantity", 1)));
        String a = json(checkout(new java.util.HashMap<>(body))).get("trackingToken").asText();
        String b = json(checkout(new java.util.HashMap<>(body))).get("trackingToken").asText();
        assertNotEquals(a, b, "each checkout gets its own token");
    }

    @Test
    void orderWithoutToken_stillFoundByNumberAndPhone() throws Exception {
        String t = registerAndGetToken("trk-old@test.com", "MERCHANT", null);
        long storeId = createStore(t, "Old Store", "trk-old-store");
        // A manual order has no tracking token.
        long orderId = createManualOrder(t, storeId, "Walk In", "+6588884444");

        mockMvc.perform(post("/public/stores/trk-old-store/orders/lookup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("orderId", orderId, "phone", "+6588884444"))))
                .andExpect(status().isOk());
    }
}
