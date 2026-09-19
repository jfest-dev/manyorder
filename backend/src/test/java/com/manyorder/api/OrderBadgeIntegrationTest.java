package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The sidebar "new orders" badge: per-store unseen count (storefront orders since
 * the Orders screen was last opened) via /merchant/orders/unseen-counts, cleared
 * by /merchant/stores/{id}/orders/mark-seen. Manual and cancelled orders don't
 * count; counts are isolated per store; staff see only their own store.
 */
class OrderBadgeIntegrationTest extends IntegrationTestBase {

    // ---------- helpers ----------

    private long createProduct(String token, long storeId, int stock) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Item", "price", 5.00, "stock", stock))))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    /** A customer places a storefront order (source STOREFRONT). */
    private long placeStorefrontOrder(long merchantId, long productId, String phone) throws Exception {
        MvcResult r = mockMvc.perform(post("/public/checkout").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "merchantId", merchantId, "customerName", "Guest", "customerPhone", phone,
                                "fulfilmentMethod", "PICKUP",
                                "items", List.of(Map.of("productId", productId, "quantity", 1))))))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("orderId").asLong();
    }

    /** The merchant enters an order manually (source MANUAL). */
    private void createManualOrder(String token, long storeId, long productId) throws Exception {
        mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk-in", "phoneNumber", "+6590000000",
                                "items", List.of(Map.of("productId", productId, "quantity", 1))))))
                .andExpect(status().isCreated());
    }

    /** This store's unseen count from the cross-store overview endpoint. */
    private long unseenCount(String token, long storeId) throws Exception {
        JsonNode arr = json(getWithToken("/merchant/orders/unseen-counts", token, 200));
        for (JsonNode n : arr) {
            if (n.get("storeId").asLong() == storeId) return n.get("count").asLong();
        }
        throw new AssertionError("store " + storeId + " not in unseen-counts: " + arr);
    }

    private void markSeen(String token, long storeId, int expectedStatus) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/mark-seen")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().is(expectedStatus));
    }

    private void cancel(String token, long storeId, long orderId) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CANCELLED"))))
                .andExpect(status().isOk());
    }

    // ---------- tests ----------

    @Test
    void unseenCount_countsStorefrontOrders() throws Exception {
        String token = registerAndGetToken("badge-count@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Badge", "badge-count-store");
        long productId = createProduct(token, storeId, 100);

        assertEquals(0, unseenCount(token, storeId), "no orders yet");
        placeStorefrontOrder(storeId, productId, "+6591111111");
        placeStorefrontOrder(storeId, productId, "+6592222222");
        assertEquals(2, unseenCount(token, storeId), "two storefront orders are unseen");
    }

    @Test
    void manualOrders_areNotCounted() throws Exception {
        String token = registerAndGetToken("badge-manual@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Manual", "badge-manual-store");
        long productId = createProduct(token, storeId, 100);

        createManualOrder(token, storeId, productId); // merchant-entered: they already know
        assertEquals(0, unseenCount(token, storeId), "manual orders never badge");
    }

    @Test
    void cancelledStorefrontOrder_isNotCounted() throws Exception {
        String token = registerAndGetToken("badge-cancel@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Cancel", "badge-cancel-store");
        long productId = createProduct(token, storeId, 100);

        long orderId = placeStorefrontOrder(storeId, productId, "+6593333333");
        assertEquals(1, unseenCount(token, storeId));
        cancel(token, storeId, orderId);
        assertEquals(0, unseenCount(token, storeId), "a cancelled order drops out of the count");
    }

    @Test
    void markSeen_zeroesCount_andLaterOrdersCountAgain() throws Exception {
        String token = registerAndGetToken("badge-seen@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Seen", "badge-seen-store");
        long productId = createProduct(token, storeId, 100);

        placeStorefrontOrder(storeId, productId, "+6594444444");
        assertEquals(1, unseenCount(token, storeId));

        markSeen(token, storeId, 200);
        assertEquals(0, unseenCount(token, storeId), "opening Orders clears the badge");

        placeStorefrontOrder(storeId, productId, "+6595555555");
        assertEquals(1, unseenCount(token, storeId), "an order after mark-seen is unseen again");
    }

    @Test
    void counts_areIsolatedPerStore() throws Exception {
        String token = registerAndGetToken("badge-multi@test.com", "MERCHANT", null);
        long storeA = createStore(token, "A", "badge-multi-a");
        long storeB = createStore(token, "B", "badge-multi-b");
        long prodA = createProduct(token, storeA, 100);
        long prodB = createProduct(token, storeB, 100);

        placeStorefrontOrder(storeA, prodA, "+6596666666");
        placeStorefrontOrder(storeB, prodB, "+6597777777");
        placeStorefrontOrder(storeB, prodB, "+6598888888");

        // The overview returns both stores with their own counts.
        JsonNode arr = json(getWithToken("/merchant/orders/unseen-counts", token, 200));
        assertEquals(2, arr.size(), "both owned stores are listed");
        assertEquals(1, unseenCount(token, storeA));
        assertEquals(2, unseenCount(token, storeB));

        // Marking store A seen doesn't touch store B.
        markSeen(token, storeA, 200);
        assertEquals(0, unseenCount(token, storeA));
        assertEquals(2, unseenCount(token, storeB));
    }

    @Test
    void staff_seeOnlyTheirStore_andCannotMarkAnother() throws Exception {
        String owner = registerAndGetToken("badge-owner@test.com", "MERCHANT", null);
        long storeA = createStore(owner, "StaffStore", "badge-staff-store");
        long storeB = createStore(owner, "OtherStore", "badge-other-store");
        long prodA = createProduct(owner, storeA, 100);
        placeStorefrontOrder(storeA, prodA, "+6591212121");

        String staff = registerAndGetToken("badge-staff@test.com", "STAFF", "badge-staff-store");

        // Staff overview lists only their assigned store, with its count.
        JsonNode arr = json(getWithToken("/merchant/orders/unseen-counts", staff, 200));
        assertEquals(1, arr.size(), "staff see only their one store");
        assertEquals(storeA, arr.get(0).get("storeId").asLong());
        assertEquals(1, arr.get(0).get("count").asLong());

        // Staff may clear their own store, but not another store. Non-members get
        // 404 (the app hides store existence), same as reading that store's orders.
        markSeen(staff, storeA, 200);
        assertEquals(0, unseenCount(staff, storeA));
        markSeen(staff, storeB, 404);
    }
}
