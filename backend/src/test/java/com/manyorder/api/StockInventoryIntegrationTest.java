package com.manyorder.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Automatic inventory tracking: every product's orders atomically draw down stock
 * and are rejected rather than oversell; cancelling restocks. Only pre-order lines
 * are exempt. The atomic conditional UPDATE is what makes two concurrent last-unit
 * checkouts safe without locking, so the concurrency test leads.
 */
class StockInventoryIntegrationTest extends IntegrationTestBase {

    // ---------- helpers ----------

    /** Create a product and return its id. Body is raw JSON so tests can set
     *  stock / preOrder freely. */
    private long createProduct(String token, long storeId, String json) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    private int stockOf(String token, long storeId, long productId) throws Exception {
        return json(getWithToken("/merchant/stores/" + storeId + "/products/" + productId, token, 200))
                .get("stock").asInt();
    }

    /** POST a single-line guest checkout without asserting status (caller decides). */
    private MvcResult postCheckout(long merchantId, long productId, int qty, String phone) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "merchantId", merchantId,
                "customerName", "Guest",
                "customerPhone", phone,
                "fulfilmentMethod", "PICKUP",
                "items", List.of(Map.of("productId", productId, "quantity", qty))));
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn();
    }

    private MvcResult postManualOrder(String token, long storeId, long productId, int qty) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "customerName", "Walk-in",
                "phoneNumber", "+6590000000",
                "items", List.of(Map.of("productId", productId, "quantity", qty))));
        return mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
    }

    private void cancelOrder(String token, long storeId, long orderId) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CANCELLED"))))
                .andExpect(status().isOk());
    }

    // ---------- concurrency (leads) ----------

    @Test
    void concurrentLastUnit_exactlyOneSucceeds_stockNeverNegative() throws Exception {
        String token = registerAndGetToken("stock-race@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Race", "stock-race-store");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Last One\",\"price\":5.00,\"stock\":1}");

        // Two shoppers (distinct phones, so customer creation can't confound the
        // result) fire the last-unit checkout at the same instant.
        int threads = 2;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            final String phone = "+65900000" + i;
            results.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return postCheckout(storeId, productId, 1, phone).getResponse().getStatus();
            }));
        }
        ready.await();
        go.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(30, TimeUnit.SECONDS), "checkouts should finish");

        int created = 0;
        int rejected = 0;
        for (Future<Integer> f : results) {
            int s = f.get();
            if (s == 201) created++;
            else rejected++;
        }
        assertEquals(1, created, "exactly one checkout may take the last unit");
        assertEquals(1, rejected, "the other must be rejected, not oversold");
        assertEquals(0, stockOf(token, storeId, productId), "stock lands at 0, never negative");
    }

    // ---------- insufficient stock ----------

    @Test
    void checkout_insufficientStock_rejectsWholeOrder() throws Exception {
        String token = registerAndGetToken("stock-short@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Short", "stock-short-store");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Scarce\",\"price\":5.00,\"stock\":1}");

        MvcResult r = postCheckout(storeId, productId, 2, "+6591111111");
        assertEquals(400, r.getResponse().getStatus());
        assertTrue(r.getResponse().getContentAsString().contains("Only 1 of Scarce left"),
                "message names the quantity left: " + r.getResponse().getContentAsString());
        assertEquals(1, stockOf(token, storeId, productId), "rejected order leaves stock untouched");
    }

    @Test
    void multiItemCheckout_oneLineShort_rollsBackEveryDecrement() throws Exception {
        String token = registerAndGetToken("stock-multi@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Multi", "stock-multi-store");
        long ok = createProduct(token, storeId,
                "{\"name\":\"Plenty\",\"price\":5.00,\"stock\":10}");
        long shortP = createProduct(token, storeId,
                "{\"name\":\"OnlyOne\",\"price\":5.00,\"stock\":1}");

        String body = objectMapper.writeValueAsString(Map.of(
                "merchantId", storeId, "customerName", "Guest", "customerPhone", "+6592222222",
                "fulfilmentMethod", "PICKUP",
                "items", List.of(
                        Map.of("productId", ok, "quantity", 2),
                        Map.of("productId", shortP, "quantity", 5))));
        mockMvc.perform(post("/public/checkout").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());

        assertEquals(10, stockOf(token, storeId, ok), "the in-stock line's decrement is rolled back");
        assertEquals(1, stockOf(token, storeId, shortP), "the short line never decremented");
    }

    // ---------- restock on cancel ----------

    @Test
    void cancel_restocksInventory() throws Exception {
        String token = registerAndGetToken("stock-cancel@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Cancel", "stock-cancel-store");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Refundable\",\"price\":5.00,\"stock\":5}");

        MvcResult r = postCheckout(storeId, productId, 2, "+6593333333");
        assertEquals(201, r.getResponse().getStatus());
        assertEquals(3, stockOf(token, storeId, productId), "order drew down 2 of 5");

        long orderId = json(r).get("orderId").asLong();
        cancelOrder(token, storeId, orderId);
        assertEquals(5, stockOf(token, storeId, productId), "cancelling returns the 2 units");
    }

    // ---------- decrement + the pre-order exception ----------

    @Test
    void checkout_decrementsStock() throws Exception {
        String token = registerAndGetToken("stock-dec@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Dec", "stock-dec-store");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Regular\",\"price\":5.00,\"stock\":5}");

        assertEquals(201, postCheckout(storeId, productId, 2, "+6594444444").getResponse().getStatus());
        assertEquals(3, stockOf(token, storeId, productId));
    }

    @Test
    void checkout_preOrderProduct_neverDecrements() throws Exception {
        String token = registerAndGetToken("stock-preorder@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Pre", "stock-preorder-store");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Coming Soon\",\"price\":5.00,\"stock\":5,\"preOrder\":true}");

        assertEquals(201, postCheckout(storeId, productId, 2, "+6596666666").getResponse().getStatus());
        assertEquals(5, stockOf(token, storeId, productId), "pre-order lines are not in current stock");
    }

    // ---------- manual orders ----------

    @Test
    void manualOrder_decrementsStock() throws Exception {
        String token = registerAndGetToken("stock-manual@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Manual", "stock-manual-store");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Counter\",\"price\":5.00,\"stock\":5}");

        postManualOrder(token, storeId, productId, 2);
        assertEquals(3, stockOf(token, storeId, productId), "manual orders decrement too");
    }

    @Test
    void manualOrderEdit_restocksOldThenDecrementsNew() throws Exception {
        String token = registerAndGetToken("stock-edit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit", "stock-edit-store");
        long productId = createProduct(token, storeId,
                "{\"name\":\"Editable\",\"price\":5.00,\"stock\":5}");

        long orderId = json(postManualOrder(token, storeId, productId, 2)).get("id").asLong();
        assertEquals(3, stockOf(token, storeId, productId));

        // Edit the line down to qty 1: the old 2 are returned, the new 1 is taken.
        String edit = objectMapper.writeValueAsString(Map.of(
                "customerName", "Walk-in", "phoneNumber", "+6590000000",
                "items", List.of(Map.of("productId", productId, "quantity", 1))));
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(edit))
                .andExpect(status().isOk());
        assertEquals(4, stockOf(token, storeId, productId), "net stock reflects the edited quantity");
    }
}
