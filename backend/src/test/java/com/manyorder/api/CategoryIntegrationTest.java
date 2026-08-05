package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Categories module: per-store managed list — create/list/rename/delete, the
 * derived productCount, duplicate-name conflict, ownership isolation, staff
 * read-only access, and the delete-uncategorizes-products behaviour.
 */
class CategoryIntegrationTest extends IntegrationTestBase {

    // ---------- helpers ----------

    private long createCategory(String token, long storeId, String bodyJson) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private long createProduct(String token, long storeId, String bodyJson) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    // ---------- create / list ----------

    @Test
    void createCategory_persistsFieldsAndZeroCount() throws Exception {
        String token = registerAndGetToken("cat-create@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Cat Store", "cat-store");

        mockMvc.perform(post("/merchant/stores/" + storeId + "/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Drinks\",\"color\":\"#3B82F6\",\"displayOrder\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Drinks"))
                .andExpect(jsonPath("$.color").value("#3B82F6"))
                .andExpect(jsonPath("$.displayOrder").value(2))
                .andExpect(jsonPath("$.productCount").value(0));
    }

    @Test
    void listCategories_isOrderedAndCarriesProductCount() throws Exception {
        String token = registerAndGetToken("cat-list@test.com", "MERCHANT", null);
        long storeId = createStore(token, "List Store", "cat-list-store");

        // Insert out of display order; the list must come back ordered.
        long drinks = createCategory(token, storeId, "{\"name\":\"Drinks\",\"displayOrder\":1}");
        createCategory(token, storeId, "{\"name\":\"Bakery\",\"displayOrder\":0}");

        // Two products in Drinks, none in Bakery.
        createProduct(token, storeId, "{\"name\":\"Latte\",\"price\":4.00,\"categoryId\":" + drinks + "}");
        createProduct(token, storeId, "{\"name\":\"Mocha\",\"price\":4.50,\"categoryId\":" + drinks + "}");

        mockMvc.perform(get("/merchant/stores/" + storeId + "/categories")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("Bakery"))
                .andExpect(jsonPath("$[0].productCount").value(0))
                .andExpect(jsonPath("$[1].name").value("Drinks"))
                .andExpect(jsonPath("$[1].productCount").value(2));
    }

    // ---------- update ----------

    @Test
    void updateCategory_renamesAndRecolors() throws Exception {
        String token = registerAndGetToken("cat-update@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Upd Store", "cat-upd-store");
        long id = createCategory(token, storeId, "{\"name\":\"Old\",\"color\":\"#000000\"}");

        mockMvc.perform(patch("/merchant/stores/" + storeId + "/categories/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New\",\"color\":\"#EC4899\",\"displayOrder\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New"))
                .andExpect(jsonPath("$.color").value("#EC4899"))
                .andExpect(jsonPath("$.displayOrder").value(5));
    }

    // ---------- delete uncategorizes ----------

    @Test
    void deleteCategory_uncategorizesProductsAndRemovesCategory() throws Exception {
        String token = registerAndGetToken("cat-delete@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Del Store", "cat-del-store");
        long id = createCategory(token, storeId, "{\"name\":\"Seasonal\"}");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Pumpkin Spice\",\"price\":6.00,\"categoryId\":" + id + "}");

        mockMvc.perform(delete("/merchant/stores/" + storeId + "/categories/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // Category is gone; the product survives, now uncategorized.
        MvcResult r = getWithToken("/merchant/stores/" + storeId + "/products/" + productId, token, 200);
        org.junit.jupiter.api.Assertions.assertTrue(
                json(r).get("categoryId").isNull(), "product should be uncategorized after delete");
    }

    // ---------- duplicate name ----------

    @Test
    void duplicateName_returns409_caseInsensitive() throws Exception {
        String token = registerAndGetToken("cat-dupe@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Dupe Store", "cat-dupe-store");
        createCategory(token, storeId, "{\"name\":\"Drinks\"}");

        mockMvc.perform(post("/merchant/stores/" + storeId + "/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"drinks\"}"))
                .andExpect(status().isConflict());
    }

    // ---------- ownership & role ----------

    @Test
    void foreignOwner_cannotListOrCreate() throws Exception {
        String ownerToken = registerAndGetToken("cat-own@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Owned Store", "cat-own-store");

        String otherToken = registerAndGetToken("cat-other@test.com", "MERCHANT", null);
        createStore(otherToken, "Other Store", "cat-other-store");

        // Missing or foreign stores both look like 404 to avoid probing.
        getWithToken("/merchant/stores/" + storeId + "/categories", otherToken, 404);
        mockMvc.perform(post("/merchant/stores/" + storeId + "/categories")
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Sneaky\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void staff_mayReadButNotCreate() throws Exception {
        String ownerToken = registerAndGetToken("cat-staff-owner@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Staff Store", "cat-staff-store");
        createCategory(ownerToken, storeId, "{\"name\":\"Drinks\"}");

        String staffToken = registerAndGetToken("cat-staff@test.com", "STAFF", "cat-staff-store");

        // Staff can list.
        getWithToken("/merchant/stores/" + storeId + "/categories", staffToken, 200);

        // Staff cannot create (owner-only).
        mockMvc.perform(post("/merchant/stores/" + storeId + "/categories")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nope\"}"))
                .andExpect(status().isForbidden());
    }

    // ---------- cross-store category rejection on product ----------

    @Test
    void product_rejectsCategoryFromAnotherStore() throws Exception {
        String ownerToken = registerAndGetToken("cat-xstore-a@test.com", "MERCHANT", null);
        long storeA = createStore(ownerToken, "Store A", "cat-xstore-a");
        long storeB = createStore(ownerToken, "Store B", "cat-xstore-b");
        long catInB = createCategory(ownerToken, storeB, "{\"name\":\"Bees\"}");

        // Using store B's category id while creating a product in store A → 400.
        mockMvc.perform(post("/merchant/stores/" + storeA + "/products")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Honey\",\"price\":3.00,\"categoryId\":" + catInB + "}"))
                .andExpect(status().isBadRequest());
    }
}
