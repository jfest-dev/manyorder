package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Permanent product delete: removal, order-history survival, and modifier cascade. */
class ProductDeleteIntegrationTest extends IntegrationTestBase {

    private long createProduct(String token, long storeId, Map<String, Object> body) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    private void addItem(String token, long storeId, long orderId, long productId, int qty) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Jo", // the edit endpoint validates the whole order
                                "items", List.of(Map.of("productId", productId, "quantity", qty))))))
                .andExpect(status().isOk());
    }

    private void deleteProduct(String token, long storeId, long productId, int expected) throws Exception {
        mockMvc.perform(delete("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().is(expected));
    }

    @Test
    void delete_removesProductFromStore() throws Exception {
        String token = registerAndGetToken("del-basic@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Del Store", "del-basic-store");
        long productId = createProduct(token, storeId, Map.of("name", "Kopi", "price", 3.5, "stock", 5));

        deleteProduct(token, storeId, productId, 204);

        mockMvc.perform(get("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());

        MvcResult list = getWithToken("/merchant/stores/" + storeId + "/products", token, 200);
        for (JsonNode p : json(list)) {
            assertFalse(p.get("name").asText().equals("Kopi"), "deleted product should be gone from the list");
        }
    }

    @Test
    void delete_withOrderHistory_keepsOrderReadableWithSnapshot() throws Exception {
        String token = registerAndGetToken("del-history@test.com", "MERCHANT", null);
        long storeId = createStore(token, "History Store", "del-history-store");
        long productId = createProduct(token, storeId, Map.of("name", "Latte", "price", 5.0, "stock", 5));
        long orderId = createManualOrder(token, storeId, "Jo", "+6580000000");
        addItem(token, storeId, orderId, productId, 2);

        deleteProduct(token, storeId, productId, 204);

        // The product is gone...
        mockMvc.perform(get("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());

        // ...but the order still reads, with the snapshotted name and a now-null productId.
        MvcResult order = getWithToken("/merchant/stores/" + storeId + "/orders/" + orderId, token, 200);
        JsonNode items = json(order).get("items");
        assertEquals(1, items.size());
        assertEquals("Latte", items.get(0).get("productName").asText(), "order line keeps the product name");
        assertTrue(items.get(0).get("productId").isNull(), "productId is null once the product is deleted");
    }

    @Test
    void delete_withModifiers_cascadesAndSucceeds() throws Exception {
        String token = registerAndGetToken("del-mods@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mods Store", "del-mods-store");
        long productId = createProduct(token, storeId, Map.of(
                "name", "Combo", "price", 9.0, "stock", 5,
                "modifierGroups", List.of(Map.of(
                        "name", "Size", "minSelect", 1, "maxSelect", 1, "sortOrder", 0,
                        "options", List.of(
                                Map.of("name", "Regular", "priceDelta", 0, "sortOrder", 0),
                                Map.of("name", "Large", "priceDelta", 1.0, "sortOrder", 1))))));

        // Deleting a product that owns modifier groups must cascade cleanly.
        deleteProduct(token, storeId, productId, 204);
        mockMvc.perform(get("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }
}
