package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Products module: new fields (category/stock/sku/photo/pre-order), the single
 * GET, units-sold derivation, and the photo endpoint's server-side guards. The
 * image host is unconfigured in tests, so real uploads surface 503; the happy
 * path is covered with a mock in {@link ProductPhotoWiringIntegrationTest}.
 */
class ProductIntegrationTest extends IntegrationTestBase {

    @Autowired private OrderRepository orderRepository;

    // 89 50 4E 47 0D 0A 1A 0A — a real PNG signature.
    private static final byte[] PNG_MAGIC =
            {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, String bodyJson) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private long createCategory(String token, long storeId, String name) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    /** Manual order with one line item; returns the order id. */
    private long createOrderWithItem(String token, long storeId, long productId, int qty) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Buyer",
                                "phoneNumber", "+6590000000",
                                "items", List.of(Map.of("productId", productId, "quantity", qty))))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private void advance(String token, long storeId, long orderId, String... statuses) throws Exception {
        for (String s : statuses) patchStatus(token, storeId, orderId, s, 200);
    }

    private MockMultipartFile file(byte[] bytes) {
        return new MockMultipartFile("file", "photo.png", "image/png", bytes);
    }

    // ---------- create / update / get ----------

    @Test
    void createProduct_persistsAllNewFields() throws Exception {
        String token = registerAndGetToken("prod-create@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Prod Store", "prod-store");
        long categoryId = createCategory(token, storeId, "Drinks");

        mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Matcha Latte",
                                  "description": "Ceremonial grade",
                                  "price": 7.50,
                                  "categoryId": %d,
                                  "stock": 25,
                                  "sku": "MAT-001",
                                  "photoUrl": "https://res.cloudinary.com/x/image/upload/v1/manyorder/1/9/products/1/a.png",
                                  "preOrder": true,
                                  "preOrderReadyDate": "2026-09-01",
                                  "preOrderReadyTimeStart": "14:00",
                                  "preOrderReadyTimeEnd": "18:00",
                                  "preOrderNote": "Ships in September"
                                }
                                """.formatted(categoryId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Matcha Latte"))
                .andExpect(jsonPath("$.categoryId").value((int) categoryId))
                .andExpect(jsonPath("$.categoryName").value("Drinks"))
                .andExpect(jsonPath("$.stock").value(25))
                .andExpect(jsonPath("$.sku").value("MAT-001"))
                .andExpect(jsonPath("$.photoUrl").value("https://res.cloudinary.com/x/image/upload/v1/manyorder/1/9/products/1/a.png"))
                .andExpect(jsonPath("$.preOrder").value(true))
                .andExpect(jsonPath("$.preOrderReadyDate").value("2026-09-01"))
                .andExpect(jsonPath("$.preOrderReadyTimeStart").value(org.hamcrest.Matchers.startsWith("14:00")))
                .andExpect(jsonPath("$.preOrderReadyTimeEnd").value(org.hamcrest.Matchers.startsWith("18:00")))
                .andExpect(jsonPath("$.preOrderNote").value("Ships in September"))
                .andExpect(jsonPath("$.unitsSold").value(0));
    }

    @Test
    void createProduct_defaultsStockZeroAndPreOrderFalse() throws Exception {
        String token = registerAndGetToken("prod-defaults@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Def Store", "def-store");
        long id = createProduct(token, storeId, "{\"name\":\"Plain\",\"price\":3.00}");

        MvcResult r = getWithToken("/merchant/stores/" + storeId + "/products/" + id, token, 200);
        assertEquals(0, json(r).get("stock").asInt());
        assertEquals(false, json(r).get("preOrder").asBoolean());
    }

    @Test
    void updateProduct_patchesNewFields() throws Exception {
        String token = registerAndGetToken("prod-update@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Upd Store", "upd-store");
        long bakeryId = createCategory(token, storeId, "Bakery");
        long pastryId = createCategory(token, storeId, "Pastry");
        long id = createProduct(token, storeId,
                "{\"name\":\"Bun\",\"price\":2.00,\"categoryId\":" + bakeryId + ",\"stock\":10,\"preOrder\":true}");

        // Move to a different category, then verify the sentinel 0 clears it.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stock\":42,\"categoryId\":" + pastryId + ",\"sku\":\"BUN-9\",\"preOrder\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stock").value(42))
                .andExpect(jsonPath("$.categoryId").value((int) pastryId))
                .andExpect(jsonPath("$.categoryName").value("Pastry"))
                .andExpect(jsonPath("$.sku").value("BUN-9"))
                .andExpect(jsonPath("$.preOrder").value(false));

        // categoryId = 0 clears the category to none.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryId").doesNotExist())
                .andExpect(jsonPath("$.categoryName").doesNotExist());
    }

    @Test
    void getSingleProduct_ownerAndStaffRead_foreignStore404() throws Exception {
        String ownerToken = registerAndGetToken("prod-get-owner@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Get Store", "get-store");
        long id = createProduct(ownerToken, storeId, "{\"name\":\"Item\",\"price\":5.00}");

        getWithToken("/merchant/stores/" + storeId + "/products/" + id, ownerToken, 200);

        // Assigned staff may read.
        String staffToken = registerAndGetToken("prod-get-staff@test.com", "STAFF", "get-store");
        getWithToken("/merchant/stores/" + storeId + "/products/" + id, staffToken, 200);

        // A different owner's store can't see it.
        String otherToken = registerAndGetToken("prod-get-other@test.com", "MERCHANT", null);
        long otherStore = createStore(otherToken, "Other Store", "other-store");
        getWithToken("/merchant/stores/" + otherStore + "/products/" + id, otherToken, 404);
    }

    @Test
    void negativeStock_isRejected() throws Exception {
        String token = registerAndGetToken("prod-negstock@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Neg Store", "neg-store");

        mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"price\":1.00,\"stock\":-1}"))
                .andExpect(status().isBadRequest());
    }

    // ---------- units sold ----------

    @Test
    void unitsSold_sumsQuantityAcrossCompletedAndDelivered_excludesOthers() throws Exception {
        String token = registerAndGetToken("prod-units@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Units Store", "units-store");
        long productId = createProduct(token, storeId, "{\"name\":\"Coffee\",\"price\":4.00}");

        // COMPLETED order, qty 3.
        long o1 = createOrderWithItem(token, storeId, productId, 3);
        advance(token, storeId, o1, "CONFIRMED", "PREPARING", "READY", "COMPLETED");

        // DELIVERED order, qty 2.
        long o2 = createOrderWithItem(token, storeId, productId, 2);
        advance(token, storeId, o2, "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED");

        // PENDING order, qty 10 — not counted.
        createOrderWithItem(token, storeId, productId, 10);

        // CANCELLED order, qty 5 — not counted.
        long o4 = createOrderWithItem(token, storeId, productId, 5);
        patchStatus(token, storeId, o4, "CANCELLED", 200);

        // 3 (completed) + 2 (delivered) = 5.
        MvcResult r = getWithToken("/merchant/stores/" + storeId + "/products/" + productId, token, 200);
        assertEquals(5, json(r).get("unitsSold").asLong());

        // And it also shows up in the list response.
        MvcResult list = getWithToken("/merchant/stores/" + storeId + "/products", token, 200);
        assertEquals(5, json(list).get(0).get("unitsSold").asLong());
    }

    @Test
    void unitsSold_isZero_forNeverOrderedProduct() throws Exception {
        String token = registerAndGetToken("prod-unsold@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Unsold Store", "unsold-store");
        long id = createProduct(token, storeId, "{\"name\":\"NeverSold\",\"price\":9.00}");

        MvcResult r = getWithToken("/merchant/stores/" + storeId + "/products/" + id, token, 200);
        assertEquals(0, json(r).get("unitsSold").asLong());
    }

    // ---------- order source ----------

    @Test
    void manualOrder_isTaggedSourceManual() throws Exception {
        String token = registerAndGetToken("prod-source@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Src Store", "src-store");
        long productId = createProduct(token, storeId, "{\"name\":\"Thing\",\"price\":1.00}");
        long orderId = createOrderWithItem(token, storeId, productId, 1);

        assertEquals(OrderSource.MANUAL, orderRepository.findById(orderId).orElseThrow().getSource());
    }

    // ---------- photo endpoint guards ----------

    @Test
    void photo_nonImageBytes_rejected() throws Exception {
        String token = registerAndGetToken("prod-photo-bad@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Photo Store", "photo-store");
        long id = createProduct(token, storeId, "{\"name\":\"P\",\"price\":1.00}");

        mockMvc.perform(multipart("/merchant/stores/" + storeId + "/products/" + id + "/photo")
                        .file(file("not an image".getBytes()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void photo_staffForbidden() throws Exception {
        String ownerToken = registerAndGetToken("prod-photo-owner@test.com", "MERCHANT", null);
        long storeId = createStore(ownerToken, "Photo2 Store", "photo2-store");
        long id = createProduct(ownerToken, storeId, "{\"name\":\"P\",\"price\":1.00}");
        String staffToken = registerAndGetToken("prod-photo-staff@test.com", "STAFF", "photo2-store");

        mockMvc.perform(multipart("/merchant/stores/" + storeId + "/products/" + id + "/photo")
                        .file(file(PNG_MAGIC))
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void photo_validImage_butHostUnconfigured_returns503() throws Exception {
        String token = registerAndGetToken("prod-photo-503@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Photo3 Store", "photo3-store");
        long id = createProduct(token, storeId, "{\"name\":\"P\",\"price\":1.00}");

        mockMvc.perform(multipart("/merchant/stores/" + storeId + "/products/" + id + "/photo")
                        .file(file(PNG_MAGIC))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void photo_forProductNotInStore_returns404() throws Exception {
        String token = registerAndGetToken("prod-photo-foreign@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Photo4 Store", "photo4-store");

        mockMvc.perform(multipart("/merchant/stores/" + storeId + "/products/99999/photo")
                        .file(file(PNG_MAGIC))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }
}
