package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Currency-aware money-scale guard: SGD amounts allow up to 2 decimals, IDR
 * amounts must be whole. This backstops the frontend so a bad value (most
 * dangerously an IDR price with a stray decimal, a 1000× risk) can't be
 * persisted via the API.
 */
class MoneyValidationIntegrationTest extends IntegrationTestBase {

    private void setCurrency(String token, long storeId, String currency) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"" + currency + "\"}"))
                .andExpect(status().isOk());
    }

    private void createProduct(String token, long storeId, String priceJson, int expectedStatus) throws Exception {
        mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Item\",\"price\":" + priceJson + "}"))
                .andExpect(status().is(expectedStatus));
    }

    // ---------- product price ----------

    @Test
    void idrStore_rejectsDecimalPrice_acceptsWhole() throws Exception {
        String token = registerAndGetToken("money-idr@test.com", "MERCHANT", null);
        long storeId = createStore(token, "IDR Store", "idr-money-store");
        setCurrency(token, storeId, "IDR");

        // 25.50 in IDR is almost certainly a mis-entry (a 1000× risk) — rejected.
        createProduct(token, storeId, "25.50", 400);
        // A whole number is fine.
        createProduct(token, storeId, "25000", 201);
        // 25000.00 is integral once trailing zeros are stripped — also fine.
        createProduct(token, storeId, "25000.00", 201);
    }

    @Test
    void sgdStore_rejectsThreeDecimals_acceptsTwo() throws Exception {
        String token = registerAndGetToken("money-sgd@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SGD Store", "sgd-money-store"); // defaults to SGD

        createProduct(token, storeId, "5.555", 400);
        createProduct(token, storeId, "5.50", 201);
    }

    @Test
    void updateProduct_idr_rejectsDecimalPrice() throws Exception {
        String token = registerAndGetToken("money-idr-upd@test.com", "MERCHANT", null);
        long storeId = createStore(token, "IDR Upd Store", "idr-upd-store");
        setCurrency(token, storeId, "IDR");

        // Create a valid whole-number product first.
        MediaType json = MediaType.APPLICATION_JSON;
        long id = json(mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(json)
                        .content("{\"name\":\"P\",\"price\":10000}"))
                .andExpect(status().isCreated())
                .andReturn()).get("id").asLong();

        // Patching to a fractional price is rejected.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(json)
                        .content("{\"price\":9999.9}"))
                .andExpect(status().isBadRequest());
    }

    // ---------- delivery fee ----------

    @Test
    void deliveryFee_idr_rejectsDecimal_acceptsWhole() throws Exception {
        String token = registerAndGetToken("money-del-idr@test.com", "MERCHANT", null);
        long storeId = createStore(token, "IDR Del Store", "idr-del-store");
        setCurrency(token, storeId, "IDR");

        mockMvc.perform(patch("/merchant/stores/" + storeId + "/delivery")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deliveryFee\":5.5,\"freeDeliveryThreshold\":null}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/merchant/stores/" + storeId + "/delivery")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deliveryFee\":5000,\"freeDeliveryThreshold\":50000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryFee").value(5000))
                .andExpect(jsonPath("$.freeDeliveryThreshold").value(50000));
    }

    @Test
    void deliveryFee_sgd_rejectsThreeDecimals() throws Exception {
        String token = registerAndGetToken("money-del-sgd@test.com", "MERCHANT", null);
        long storeId = createStore(token, "SGD Del Store", "sgd-del-store");

        mockMvc.perform(patch("/merchant/stores/" + storeId + "/delivery")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deliveryFee\":3.555,\"freeDeliveryThreshold\":null}"))
                .andExpect(status().isBadRequest());
    }
}
