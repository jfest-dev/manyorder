package com.manyorder.api;

import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A pre-order's ready date must be today or later; same-day is allowed, past is rejected. */
class ProductPreOrderIntegrationTest extends IntegrationTestBase {

    private ResultActions createPreOrder(String token, long storeId, String readyDate, int expect) throws Exception {
        return mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Pre-order Item", "price", 5.0, "stock", 0,
                                "preOrder", true, "preOrderReadyDate", readyDate))))
                .andExpect(status().is(expect));
    }

    @Test
    void preOrder_pastReadyDate_rejected() throws Exception {
        String token = registerAndGetToken("preorder-past@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Pre Past Store", "pre-past-store");
        createPreOrder(token, storeId, LocalDate.now().minusDays(1).toString(), 400);
    }

    @Test
    void preOrder_todayAndFuture_accepted() throws Exception {
        String token = registerAndGetToken("preorder-ok@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Pre OK Store", "pre-ok-store");
        createPreOrder(token, storeId, LocalDate.now().toString(), 201);            // same-day is fine
        createPreOrder(token, storeId, LocalDate.now().plusDays(10).toString(), 201);
    }

    @Test
    void preOrder_updateToPastDate_rejected() throws Exception {
        String token = registerAndGetToken("preorder-update@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Pre Upd Store", "pre-upd-store");
        MvcResult created = createPreOrder(token, storeId, LocalDate.now().plusDays(5).toString(), 201).andReturn();
        long productId = json(created).get("id").asLong();

        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "preOrder", true, "preOrderReadyDate", LocalDate.now().minusDays(1).toString()))))
                .andExpect(status().isBadRequest());
    }
}
