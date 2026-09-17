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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Public "Available offers": only public AND currently-live discounts are ever
 * exposed; private (code-only) codes never appear, and a public offer still
 * enforces its own eligibility rules when applied (public != a bypass).
 */
class PublicOffersIntegrationTest extends IntegrationTestBase {

    @Autowired private DiscountRepository discountRepository;
    @Autowired private MerchantRepository merchantRepository;

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price, "stock", 100000))))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    private void createDiscount(String token, long storeId, Map<String, Object> body) throws Exception {
        mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated());
    }

    private JsonNode offers(long storeId) throws Exception {
        return json(mockMvc.perform(get("/public/storefront/" + storeId + "/offers"))
                .andExpect(status().isOk()).andReturn());
    }

    private boolean hasCode(JsonNode arr, String code) {
        for (JsonNode n : arr) if (code.equalsIgnoreCase(n.get("code").asText())) return true;
        return false;
    }

    private JsonNode byCode(JsonNode arr, String code) {
        for (JsonNode n : arr) if (code.equalsIgnoreCase(n.get("code").asText())) return n;
        throw new AssertionError("offer not found: " + code);
    }

    @Test
    void offers_returnOnlyPublicAndLive() throws Exception {
        String token = registerAndGetToken("offers-list@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Offers", "offers-list-store");

        createDiscount(token, storeId, Map.of("code", "PUBLIC10", "type", "PERCENTAGE", "value", 10, "isPublic", true));
        createDiscount(token, storeId, Map.of("code", "SECRET5", "type", "FIXED", "value", 5)); // private (default)
        createDiscount(token, storeId, Map.of("code", "PUBOFF", "type", "FIXED", "value", 5, "isPublic", true, "active", false)); // inactive
        // Public but expired: create it live, then expire it directly, since the
        // API now blocks creating a past-end code.
        createDiscount(token, storeId, Map.of("code", "PUBEXP", "type", "FIXED", "value", 5, "isPublic", true));
        Merchant merchant = merchantRepository.findById(storeId).orElseThrow();
        Discount expired = discountRepository.findByMerchantAndCodeIgnoreCase(merchant, "PUBEXP").orElseThrow();
        expired.setEndsAt(java.time.LocalDateTime.now().minusDays(1));
        discountRepository.save(expired);

        JsonNode arr = offers(storeId);
        assertEquals(1, arr.size(), "only the public, active, in-window offer is listed");
        assertTrue(hasCode(arr, "PUBLIC10"));
        assertFalse(hasCode(arr, "SECRET5"), "a private code is never exposed");
        assertFalse(hasCode(arr, "PUBOFF"), "an inactive public offer is excluded");
        assertFalse(hasCode(arr, "PUBEXP"), "an expired public offer is excluded");
    }

    @Test
    void offers_reflectMerchantDisplayOrder() throws Exception {
        String token = registerAndGetToken("offers-order@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Order", "offers-order-store");
        long first = json(mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "FIRST", "type", "PERCENTAGE", "value", 10, "isPublic", true))))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
        long second = json(mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "SECOND", "type", "PERCENTAGE", "value", 20, "isPublic", true))))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();

        // Default order matches creation order.
        JsonNode arr = offers(storeId);
        assertEquals("FIRST", arr.get(0).get("code").asText());
        assertEquals("SECOND", arr.get(1).get("code").asText());

        // Reorder on the merchant side flips the storefront offers order.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/reorder")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("discountIds", List.of(second, first)))))
                .andExpect(status().isOk());
        JsonNode reordered = offers(storeId);
        assertEquals("SECOND", reordered.get(0).get("code").asText());
        assertEquals("FIRST", reordered.get(1).get("code").asText());
    }

    @Test
    void offers_carryScopeLabelAndEndsAt() throws Exception {
        String token = registerAndGetToken("offers-rich@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Rich", "offers-rich-store");
        long pid = createProduct(token, storeId, "Latte", 6.00);

        // Store-wide offer with an end date.
        createDiscount(token, storeId, Map.of("code", "STOREWIDE", "type", "PERCENTAGE", "value", 10,
                "isPublic", true, "endsAt", "2030-09-30T23:59:59"));
        // Offer scoped to a single product.
        createDiscount(token, storeId, Map.of("code", "LATTEONLY", "type", "FIXED", "value", 2,
                "isPublic", true, "productIds", List.of(pid)));

        JsonNode arr = offers(storeId);
        JsonNode storeWide = byCode(arr, "STOREWIDE");
        JsonNode latteOnly = byCode(arr, "LATTEONLY");

        assertEquals("All products", storeWide.get("scopeLabel").asText());
        assertTrue(storeWide.get("endsAt").asText().startsWith("2030-09-30"), "end date is exposed");
        assertEquals("Latte", latteOnly.get("scopeLabel").asText(), "single-product scope names the product");
        assertTrue(latteOnly.get("endsAt").isNull(), "no end date -> null");
    }

    @Test
    void createAndUpdate_roundTripIsPublic_defaultFalse() throws Exception {
        String token = registerAndGetToken("offers-flag@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Flag", "offers-flag-store");

        createDiscount(token, storeId, Map.of("code", "DEF", "type", "FIXED", "value", 5)); // no isPublic -> false
        createDiscount(token, storeId, Map.of("code", "PUB", "type", "FIXED", "value", 5, "isPublic", true));

        JsonNode list = json(getWithToken("/merchant/stores/" + storeId + "/discounts", token, 200));
        long defId = -1;
        for (JsonNode d : list) {
            if ("DEF".equals(d.get("code").asText())) { assertFalse(d.get("isPublic").asBoolean(), "default is private"); defId = d.get("id").asLong(); }
            if ("PUB".equals(d.get("code").asText())) assertTrue(d.get("isPublic").asBoolean());
        }
        assertFalse(hasCode(offers(storeId), "DEF"), "private offer not listed publicly");

        // Flip DEF to public via update -> it now appears in the offers list.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/discounts/" + defId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("isPublic", true))))
                .andExpect(status().isOk());
        assertTrue(hasCode(offers(storeId), "DEF"), "now public and live, appears in offers");
    }

    @Test
    void offers_excludeExhausted() throws Exception {
        String token = registerAndGetToken("offers-exh@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Exh", "offers-exh-store");
        long productId = createProduct(token, storeId, "Item", 20.00);
        createDiscount(token, storeId, Map.of("code", "ONCE", "type", "FIXED", "value", 5, "isPublic", true, "usageLimit", 1));

        assertTrue(hasCode(offers(storeId), "ONCE"), "listed before it is used");

        // Redeem once via checkout to reach the usage limit.
        mockMvc.perform(post("/public/checkout").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "customerName", "G", "customerPhone", "+6588881111",
                                "fulfilmentMethod", "PICKUP", "discountCode", "ONCE",
                                "items", List.of(Map.of("productId", productId, "quantity", 1))))))
                .andExpect(status().isCreated());

        assertFalse(hasCode(offers(storeId), "ONCE"), "excluded once its usage limit is reached");
    }

    @Test
    void publicOffer_stillEnforcesEligibility_minSpend() throws Exception {
        String token = registerAndGetToken("offers-min@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Min", "offers-min-store");
        long productId = createProduct(token, storeId, "Cheap", 5.00);
        createDiscount(token, storeId, Map.of("code", "BIG", "type", "FIXED", "value", 3, "isPublic", true, "minSpend", 50));

        // It IS a public offer the customer can see...
        assertTrue(hasCode(offers(storeId), "BIG"));
        // ...but applying it below the minimum is still rejected (public is not a bypass).
        mockMvc.perform(post("/public/discounts/validate").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId, "code", "BIG", "fulfilmentMethod", "PICKUP",
                                "items", List.of(Map.of("productId", productId, "quantity", 1))))))
                .andExpect(status().is4xxClientError());
    }
}
