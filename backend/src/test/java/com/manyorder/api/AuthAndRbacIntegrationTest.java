package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthAndRbacIntegrationTest extends IntegrationTestBase {

    @Test
    void registerAndLogin_merchant_ok() throws Exception {
        registerAndGetToken("rbac-m1@test.com", "MERCHANT", null);
        String token = loginAndGetToken("rbac-m1@test.com", "password123");
        getWithToken("/merchant/stores", token, 200);
    }

    @Test
    void duplicateEmail_isRejectedWithConflict() throws Exception {
        registerAndGetToken("dupe@test.com", "MERCHANT", null);
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Dupe", "email", "dupe@test.com",
                                "password", "password123", "role", "MERCHANT"))))
                .andExpect(status().isConflict());
    }

    @Test
    void platformAdmin_isNeverSelfRegisterable() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Sneaky", "email", "sneaky@test.com",
                                "password", "password123", "role", "PLATFORM_ADMIN"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void staffRegistration_requiresValidStoreCode() throws Exception {
        String ownerToken = registerAndGetToken("rbac-owner1@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Staff Code Store", "staff-code-store");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "S", "email", "staff-bad@test.com",
                                "password", "password123", "role", "STAFF",
                                "storeSlug", "no-such-store"))))
                .andExpect(status().isBadRequest());

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "S", "email", "staff-good@test.com",
                                "password", "password123", "role", "STAFF",
                                "storeSlug", "staff-code-store"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("STAFF"))
                .andReturn();
        assertEquals(storeId, json(result).get("staffStoreId").asLong());
    }

    @Test
    void merchant_cannotReachAnotherMerchantsStoreOrOrders() throws Exception {
        String tokenA = registerAndGetToken("rbac-a@test.com", "MERCHANT", null);
        String tokenB = registerAndGetToken("rbac-b@test.com", "MERCHANT", null);
        long storeA = createStore(tokenA, "Store A", "rbac-store-a");
        long orderA = createManualOrder(tokenA, storeA, "Cust A", "+6511111111");

        getWithToken("/merchant/stores/" + storeA, tokenB, 404);
        getWithToken("/merchant/stores/" + storeA + "/orders", tokenB, 404);
        getWithToken("/merchant/stores/" + storeA + "/orders/" + orderA, tokenB, 404);

        mockMvc.perform(patch("/merchant/stores/" + storeA + "/orders/" + orderA + "/payment-status")
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void staff_canWorkOrders_butCannotManageStoresProductsOrCreateOrders() throws Exception {
        String ownerToken = registerAndGetToken("rbac-owner2@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Staffed Store", "staffed-store");
        long orderId = createManualOrder(ownerToken, storeId, "Walk In", "+6522222222");

        String staffToken = registerAndGetToken("rbac-staff@test.com", "STAFF", "staffed-store");

        getWithToken("/merchant/stores/" + storeId + "/orders", staffToken, 200);
        getWithToken("/merchant/stores/" + storeId + "/products", staffToken, 200);
        patchStatus(staffToken, storeId, orderId, "CONFIRMED", 200);
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId + "/payment-status")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentStatus\":\"PAID\"}"))
                .andExpect(status().isOk());

        getWithToken("/merchant/stores", staffToken, 403);
        mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("customerName", "X", "phoneNumber", "+65999"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Latte", "price", 5.0))))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpoints_areGatedToPlatformAdmin() throws Exception {
        String merchantToken = registerAndGetToken("rbac-notadmin@test.com", "MERCHANT", null);
        getWithToken("/admin/orders", merchantToken, 403);

        mockMvc.perform(get("/admin/orders"))
                .andExpect(status().is4xxClientError());

        String adminToken = loginAndGetToken("admin@manyorder.com", "password123");
        getWithToken("/admin/orders", adminToken, 200);
    }

    @Test
    void storeLimit_isThree_andSlugsAreUnique() throws Exception {
        String token = registerAndGetToken("rbac-limit@test.com", "MERCHANT", null);
        createStore(token, "Limit One", "limit-one");
        createStore(token, "Limit Two", "limit-two");
        createStore(token, "Limit Three", "limit-three");

        mockMvc.perform(post("/merchant/stores")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("storeName", "Limit Four"))))
                .andExpect(status().isConflict());

        String other = registerAndGetToken("rbac-limit2@test.com", "MERCHANT", null);
        mockMvc.perform(post("/merchant/stores")
                        .header("Authorization", "Bearer " + other)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("storeName", "Clash", "slug", "limit-one"))))
                .andExpect(status().isConflict());
    }
}
