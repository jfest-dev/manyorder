package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.customer.CustomerRepository;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.product.ProductRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderLifecycleIntegrationTest extends IntegrationTestBase {

    @Autowired MerchantRepository merchantRepository;
    @Autowired CustomerRepository customerRepository;
    @Autowired ProductRepository productRepository;

    @Test
    void statusChain_followsTheStateMachine() throws Exception {
        String token = registerAndGetToken("order-chain@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Chain Store", "chain-store");
        long orderId = createManualOrder(token, storeId, "Chain Cust", "+6533333333");

        patchStatus(token, storeId, orderId, "READY", 400);
        patchStatus(token, storeId, orderId, "CONFIRMED", 200);
        patchStatus(token, storeId, orderId, "CONFIRMED", 400);
        patchStatus(token, storeId, orderId, "PREPARING", 200);
        patchStatus(token, storeId, orderId, "READY", 200);
        patchStatus(token, storeId, orderId, "COMPLETED", 200);
    }

    @Test
    void completedOrders_canNoLongerBeCancelled() throws Exception {
        String token = registerAndGetToken("order-done@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Done Store", "done-store");
        long orderId = createManualOrder(token, storeId, "Done Cust", "+6544444444");

        for (String s : List.of("CONFIRMED", "PREPARING", "READY", "COMPLETED")) {
            patchStatus(token, storeId, orderId, s, 200);
        }
        patchStatus(token, storeId, orderId, "CANCELLED", 400);
    }

    @Test
    void deliveredOrders_canStillBeCancelled_forRefundFlows() throws Exception {
        String token = registerAndGetToken("order-deliv@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Deliv Store", "deliv-store");
        long orderId = createManualOrder(token, storeId, "Deliv Cust", "+6555555555");

        for (String s : List.of("CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED")) {
            patchStatus(token, storeId, orderId, s, 200);
        }
        patchStatus(token, storeId, orderId, "CANCELLED", 200);
    }

    @Test
    void guestCheckout_reusesTheSameCustomerWithinAStore() throws Exception {
        String token = registerAndGetToken("order-guest@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Guest Store", "guest-store");

        MvcResult productResult = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Kopi", "description", "Hot", "price", 3.5))))
                .andExpect(status().isCreated())
                .andReturn();
        long productId = json(productResult).get("id").asLong();

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/public/checkout")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "merchantId", storeId,
                                    "customerName", "Repeat Guest",
                                    "customerPhone", "+6566666666",
                                    "customerEmail", "repeat@guest.com",
                                    "fulfilmentMethod", "PICKUP",
                                    "items", List.of(Map.of("productId", productId, "quantity", 1))))))
                    .andExpect(status().isCreated());
        }

        var store = merchantRepository.findById(storeId).orElseThrow();
        long matches = customerRepository.findByMerchant(store).stream()
                .filter(c -> "+6566666666".equals(c.getPhoneNumber()))
                .count();
        assertEquals(1, matches, "same phone within one store must map to one customer record");
    }
}
