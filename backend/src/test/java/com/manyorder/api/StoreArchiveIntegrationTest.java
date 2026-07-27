package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Store archive (soft-delete) with password re-entry — Module: Store Delete/Archive. */
class StoreArchiveIntegrationTest extends IntegrationTestBase {

    /** POST /merchant/stores/{id}/archive with a password body, asserting the status. */
    private void archive(String token, long storeId, String password, int expected) throws Exception {
        mockMvc.perform(post("/merchant/stores/" + storeId + "/archive")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", password))))
                .andExpect(status().is(expected));
    }

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult result = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", name, "description", "x", "price", price))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(result).get("id").asLong();
    }

    @Test
    void archive_withCorrectPassword_hidesStoreAndFreesSlot() throws Exception {
        String token = registerAndGetToken("arch-slot@test.com", "MERCHANT", null);
        createStore(token, "Slot One", "arch-slot-1");
        long second = createStore(token, "Slot Two", "arch-slot-2");
        createStore(token, "Slot Three", "arch-slot-3");

        // At the 3-store limit, a 4th create is rejected...
        mockMvc.perform(post("/merchant/stores")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storeName\":\"Too Many\",\"slug\":\"arch-slot-x\"}"))
                .andExpect(status().isConflict());

        // ...but archiving one frees a slot.
        archive(token, second, "password123", 204);

        MvcResult stores = getWithToken("/merchant/stores", token, 200);
        org.junit.jupiter.api.Assertions.assertEquals(2, json(stores).get("stores").size());

        createStore(token, "New Fourth", "arch-slot-4");
    }

    @Test
    void archive_withWrongPassword_returns403_andStoreStaysActive() throws Exception {
        String token = registerAndGetToken("arch-wrongpw@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Keep Me", "arch-wrongpw");

        archive(token, storeId, "not-my-password", 403);

        // Still active and readable — nothing was archived.
        getWithToken("/merchant/stores/" + storeId, token, 200);

        // Correct password then archives it.
        archive(token, storeId, "password123", 204);
        getWithToken("/merchant/stores/" + storeId, token, 404);
    }

    @Test
    void archive_withBlankPassword_returns400() throws Exception {
        String token = registerAndGetToken("arch-blankpw@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Blank PW", "arch-blankpw");

        mockMvc.perform(post("/merchant/stores/" + storeId + "/archive")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"\"}"))
                .andExpect(status().isBadRequest());

        // Untouched: still readable.
        getWithToken("/merchant/stores/" + storeId, token, 200);
    }

    @Test
    void archivedStore_returns404_forOwnerReadsAndWrites() throws Exception {
        String token = registerAndGetToken("arch-owner404@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Gone Soon", "arch-owner404");

        archive(token, storeId, "password123", 204);

        getWithToken("/merchant/stores/" + storeId, token, 404);
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storeName\":\"Zombie\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void staff_boundToArchivedStore_areLockedOut() throws Exception {
        String ownerToken = registerAndGetToken("arch-staff-owner@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Staffed Store", "arch-staffed");
        String staffToken = registerAndGetToken("arch-staff@test.com", "STAFF", "arch-staffed");

        // Staff can read the store while it's active...
        getWithToken("/merchant/stores/" + storeId, staffToken, 200);

        archive(ownerToken, storeId, "password123", 204);

        // ...and are locked out once it's archived.
        getWithToken("/merchant/stores/" + storeId, staffToken, 404);
    }

    @Test
    void staffRegistration_againstArchivedSlug_isRejected() throws Exception {
        String ownerToken = registerAndGetToken("arch-staffreg-owner@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Reg Store", "arch-staffreg");
        archive(ownerToken, storeId, "password123", 204);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Late Staff",
                                "email", "arch-latestaff@test.com",
                                "password", "password123",
                                "role", "STAFF",
                                "storeSlug", "arch-staffreg"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void archivedStore_isHiddenFromPublicStorefrontAndCheckout() throws Exception {
        String token = registerAndGetToken("arch-public@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Public Store", "arch-public");
        long productId = createProduct(token, storeId, "Latte", 5.00);

        // Public storefront resolves while active.
        mockMvc.perform(get("/public/stores/arch-public")).andExpect(status().isOk());

        archive(token, storeId, "password123", 204);

        // Storefront lookup now 404s.
        mockMvc.perform(get("/public/stores/arch-public")).andExpect(status().isNotFound());

        // Guest checkout against the archived store is closed.
        mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId,
                                "customerName", "Walk In",
                                "customerPhone", "+6588888888",
                                "fulfilmentMethod", "PICKUP",
                                "items", List.of(Map.of("productId", productId, "quantity", 1))))))
                .andExpect(status().isNotFound());
    }

    @Test
    void slug_staysReserved_afterArchive() throws Exception {
        String token = registerAndGetToken("arch-slug@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Reserved", "arch-reserved-slug");
        archive(token, storeId, "password123", 204);

        // The archived store's slug can't be reused.
        mockMvc.perform(post("/merchant/stores")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storeName\":\"Reuse\",\"slug\":\"arch-reserved-slug\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").exists());
    }
}
