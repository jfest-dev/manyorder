package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.order.OrderNotificationMailer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * New-order merchant notification email — Module: Orders / Notifications.
 *
 * The mailer is a spy; the Resend key is blank in test config so the real send
 * is a no-op. We assert only that checkout fires (or skips) the notification
 * according to the store's notifyNewOrderEmail preference.
 */
class OrderNotificationIntegrationTest extends IntegrationTestBase {

    @MockitoSpyBean private OrderNotificationMailer mailer;

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        var r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private void guestCheckout(long storeId, long productId, int qty) throws Exception {
        mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", storeId,
                                "customerName", "Guest",
                                "customerPhone", "+6588881234",
                                "fulfilmentMethod", "PICKUP",
                                "items", List.of(Map.of("productId", productId, "quantity", qty))))))
                .andExpect(status().isCreated());
    }

    @Test
    void storefrontOrder_notifiesMerchant_whenEnabled() throws Exception {
        String token = registerAndGetToken("on-enabled@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Notify Store", "on-enabled-store");
        long productId = createProduct(token, storeId, "Latte", 5.00);

        guestCheckout(storeId, productId, 1);

        // notifyNewOrderEmail defaults true, so the merchant is notified once.
        verify(mailer, times(1)).sendNewOrder(
                argThat((Merchant m) -> m.getId().equals(storeId)), any());
    }

    @Test
    void storefrontOrder_skipsNotification_whenDisabled() throws Exception {
        String token = registerAndGetToken("on-disabled@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Quiet Store", "on-disabled-store");
        long productId = createProduct(token, storeId, "Mocha", 6.00);

        // Turn the email notification off for this store.
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("notifyNewOrderEmail", false))))
                .andExpect(status().isOk());

        guestCheckout(storeId, productId, 1);

        verify(mailer, never()).sendNewOrder(
                argThat((Merchant m) -> m.getId().equals(storeId)), any());
    }
}
