package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StoreSettingsIntegrationTest extends IntegrationTestBase {

    @Test
    void owner_canUpdateSettings_andTheyPersist() throws Exception {
        String token = registerAndGetToken("settings-owner@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Settings Store", "settings-store");

        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "storeName", "Settings Store 2",
                                "currency", "IDR",
                                "city", "Singapore",
                                "notifyLowStockEmail", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Settings Store 2"))
                .andExpect(jsonPath("$.currency").value("IDR"))
                .andExpect(jsonPath("$.city").value("Singapore"))
                .andExpect(jsonPath("$.notifyLowStockEmail").value(false));
    }

    @Test
    void staff_cannotUpdateSettings() throws Exception {
        String ownerToken = registerAndGetToken("settings-owner2@test.com", "MERCHANT", null);
        createStore(ownerToken, "Locked Store", "locked-store");
        String staffToken = registerAndGetToken("settings-staff@test.com", "STAFF", "locked-store");

        MvcResult stores = getWithToken("/merchant/stores", ownerToken, 200);
        long storeId = json(stores).get("stores").get(0).get("id").asLong();

        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storeName\":\"Hacked\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void slugChange_toATakenSlug_isRejected() throws Exception {
        String token = registerAndGetToken("settings-slug@test.com", "MERCHANT", null);
        createStore(token, "Slug One", "settings-slug-one");
        long second = createStore(token, "Slug Two", "settings-slug-two");

        mockMvc.perform(patch("/merchant/stores/" + second)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"settings-slug-one\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void manualOrder_withItems_computesTotalFromLivePrices() throws Exception {
        String token = registerAndGetToken("settings-items@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Items Store", "items-store");

        MvcResult productResult = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Latte", "description", "Hot", "price", 6.50))))
                .andExpect(status().isCreated())
                .andReturn();
        long productId = json(productResult).get("id").asLong();

        MvcResult orderResult = mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Counter Sale",
                                "phoneNumber", "+6577777777",
                                "paymentStatus", "PAID",
                                "paymentMethod", "Cash",
                                "items", List.of(Map.of("productId", productId, "quantity", 3))))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.paymentMethod").value("Cash"))
                .andReturn();

        assertEquals(19.50, json(orderResult).get("totalAmount").asDouble(), 0.001);
        assertEquals(1, json(orderResult).get("items").size());
    }
}
