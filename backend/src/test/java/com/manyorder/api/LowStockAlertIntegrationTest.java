package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.product.LowStockMailer;
import com.manyorder.api.domain.product.Product;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Low-stock email alerts — Module: Products / Inventory notifications.
 *
 * The mailer is a spy; the Resend key is blank in test config so the real send
 * is a no-op. Stock only ever changes through a manual product save, so the
 * alert is driven entirely by the update path. We assert it fires only on a
 * downward crossing into low territory (at or below the threshold, 0 included),
 * for active non-pre-order products, and only when the store preference is on.
 */
class LowStockAlertIntegrationTest extends IntegrationTestBase {

    private static final int LOW_STOCK_AT = 5;

    @MockitoSpyBean private LowStockMailer mailer;

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, Map<String, Object> extra) throws Exception {
        var body = new java.util.HashMap<String, Object>(Map.of("name", "Widget", "price", 4.00));
        if (extra != null) body.putAll(extra);
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private void patchProduct(String token, long storeId, long productId, Map<String, Object> body) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private void setNotifyLowStock(String token, long storeId, boolean on) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("notifyLowStockEmail", on))))
                .andExpect(status().isOk());
    }

    // ---------- tests ----------

    @Test
    void crossingIntoLow_firesOnce() throws Exception {
        String token = registerAndGetToken("ls-cross@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Cross", "ls-cross");
        long productId = createProduct(token, storeId, Map.of("stock", 20));

        patchProduct(token, storeId, productId, Map.of("stock", LOW_STOCK_AT)); // 20 -> 5, crosses

        verify(mailer, times(1)).sendLowStock(
                argThat(m -> m.getId().equals(storeId)),
                argThat((Product p) -> p.getId().equals(productId)),
                eq(LOW_STOCK_AT));
    }

    @Test
    void dropToZero_countsAsLow_andFires() throws Exception {
        String token = registerAndGetToken("ls-zero@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Zero", "ls-zero");
        long productId = createProduct(token, storeId, Map.of("stock", 12));

        patchProduct(token, storeId, productId, Map.of("stock", 0)); // 12 -> 0, crosses

        verify(mailer, times(1)).sendLowStock(any(), any(), eq(0));
    }

    @Test
    void furtherDropWhileAlreadyLow_doesNotRefire() throws Exception {
        String token = registerAndGetToken("ls-already@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Already", "ls-already");
        long productId = createProduct(token, storeId, Map.of("stock", 20));

        patchProduct(token, storeId, productId, Map.of("stock", 5)); // crosses -> fires
        patchProduct(token, storeId, productId, Map.of("stock", 3)); // still low -> silent
        patchProduct(token, storeId, productId, Map.of("stock", 1)); // still low -> silent

        verify(mailer, times(1)).sendLowStock(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void restockAboveThenDropAgain_reArmsAndFiresTwice() throws Exception {
        String token = registerAndGetToken("ls-rearm@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Rearm", "ls-rearm");
        long productId = createProduct(token, storeId, Map.of("stock", 20));

        patchProduct(token, storeId, productId, Map.of("stock", 4));  // crosses -> fires
        patchProduct(token, storeId, productId, Map.of("stock", 30)); // restock above -> silent, re-arms
        patchProduct(token, storeId, productId, Map.of("stock", 2));  // crosses again -> fires

        verify(mailer, times(2)).sendLowStock(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void gradualDepletionToZero_firesOutOfStockOnTheFinalStep() throws Exception {
        String token = registerAndGetToken("ls-gradual@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Gradual", "ls-gradual");
        long productId = createProduct(token, storeId, Map.of("stock", 10));

        patchProduct(token, storeId, productId, Map.of("stock", 5)); // 10->5 running low, fires (5)
        patchProduct(token, storeId, productId, Map.of("stock", 3)); // 5->3 already low, silent
        patchProduct(token, storeId, productId, Map.of("stock", 0)); // 3->0 crosses into empty, fires (0)

        // The low nudge fires once (the 10->5 crossing), the out-of-stock once (3->0).
        verify(mailer, times(1)).sendLowStock(any(), any(), eq(5));
        verify(mailer, times(1)).sendLowStock(any(), any(), eq(0));
        verify(mailer, times(2)).sendLowStock(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void alreadyLowThenToZero_firesOutOfStock() throws Exception {
        String token = registerAndGetToken("ls-low2zero@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Low2Zero", "ls-low2zero");
        // Create low but not empty (no alert on create), then deplete to 0.
        long productId = createProduct(token, storeId, Map.of("stock", 2));

        patchProduct(token, storeId, productId, Map.of("stock", 0)); // 2->0, crosses into empty

        verify(mailer, times(1)).sendLowStock(any(), any(), eq(0));
    }

    @Test
    void stayingAtZero_doesNotRefire() throws Exception {
        String token = registerAndGetToken("ls-zero-stay@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Zero Stay", "ls-zero-stay");
        long productId = createProduct(token, storeId, Map.of("stock", 8));

        patchProduct(token, storeId, productId, Map.of("stock", 0)); // 8->0, fires out-of-stock
        patchProduct(token, storeId, productId, Map.of("name", "Renamed while empty")); // 0->0, silent
        patchProduct(token, storeId, productId, Map.of("stock", 0)); // 0->0, silent

        verify(mailer, times(1)).sendLowStock(any(), any(), eq(0));
    }

    @Test
    void depleteRestockDepleteToZero_firesOutOfStockTwice() throws Exception {
        String token = registerAndGetToken("ls-zero-rearm@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Zero Rearm", "ls-zero-rearm");
        long productId = createProduct(token, storeId, Map.of("stock", 12));

        patchProduct(token, storeId, productId, Map.of("stock", 0));  // fires out-of-stock
        patchProduct(token, storeId, productId, Map.of("stock", 20)); // restock above 0, silent, re-arms
        patchProduct(token, storeId, productId, Map.of("stock", 0));  // fires out-of-stock again

        verify(mailer, times(2)).sendLowStock(any(), any(), eq(0));
    }

    @Test
    void preferenceOff_neverFires() throws Exception {
        String token = registerAndGetToken("ls-off@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Off", "ls-off");
        long productId = createProduct(token, storeId, Map.of("stock", 20));
        setNotifyLowStock(token, storeId, false);

        patchProduct(token, storeId, productId, Map.of("stock", 2)); // would cross, but preference off

        verify(mailer, never()).sendLowStock(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void preOrderProduct_doesNotFire() throws Exception {
        String token = registerAndGetToken("ls-preorder@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Preorder", "ls-preorder");
        // A pre-order product is not live sellable stock, so it never alerts.
        long productId = createProduct(token, storeId, Map.of(
                "stock", 20, "preOrder", true, "preOrderReadyDate", "2099-01-01"));

        patchProduct(token, storeId, productId, Map.of("stock", 2));

        verify(mailer, never()).sendLowStock(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void inactiveProduct_doesNotFire() throws Exception {
        String token = registerAndGetToken("ls-inactive@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Inactive", "ls-inactive");
        long productId = createProduct(token, storeId, Map.of("stock", 20));

        // Deactivate (draft), then drop stock: a draft isn't live inventory.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + productId + "/deactivate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        patchProduct(token, storeId, productId, Map.of("stock", 2));

        verify(mailer, never()).sendLowStock(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void createAlreadyLow_doesNotFire() throws Exception {
        String token = registerAndGetToken("ls-create@test.com", "MERCHANT", null);
        long storeId = createStore(token, "LS Create", "ls-create");
        // A product created already low has no "was above" state, so no alert.
        createProduct(token, storeId, Map.of("stock", 3));

        verify(mailer, never()).sendLowStock(any(), any(), org.mockito.ArgumentMatchers.anyInt());
    }
}
