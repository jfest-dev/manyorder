package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Admin Overview: grouped aggregates for the dashboard. PLATFORM_ADMIN only. */
class AdminOverviewIntegrationTest extends IntegrationTestBase {

    @Test
    void overview_reportsValueOrdersAttentionAndRecents() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        String owner = registerAndGetToken("ov-owner@test.com", "MERCHANT", null); // unverified owner
        long storeId = createStore(owner, "Overview Cafe", "overview-cafe");
        createManualOrder(owner, storeId, "Mei", "91112222");
        createManualOrder(owner, storeId, "Sam", "92223333");

        JsonNode ov = json(getWithToken("/admin/metrics/overview", admin, 200));

        // Value blocks are always present lists (empty until orders are completed/delivered).
        assertTrue(ov.get("valueLast30Days").isArray());
        assertTrue(ov.get("valueAllTime").isArray());

        // Orders per day: exactly 30 zero-filled buckets, and today carries our 2 orders.
        JsonNode perDay = ov.get("ordersPerDay");
        assertEquals(30, perDay.size());
        long todays = perDay.get(29).get("count").asLong();
        assertTrue(todays >= 2, "today's bucket counts the new orders");

        // Top stores: capped at 5 and ranked by order count. In the shared test DB
        // many stores have orders, so our store may fall outside the top 5; assert the
        // shape, and our store's figures only when it is present (never a global-rank claim).
        JsonNode top = ov.get("topStores");
        assertTrue(top.size() <= 5, "top stores is capped at five");
        for (JsonNode s : top) {
            assertTrue(s.get("orders").asLong() >= 1, "listed top stores have orders");
            if ("overview-cafe".equals(s.get("slug").asText())) {
                assertTrue(s.get("orders").asLong() >= 2);
                assertEquals("SGD", s.get("currency").asText());
            }
        }

        // Needs attention: unverified owner and no-products both include our store.
        JsonNode attn = ov.get("needsAttention");
        assertTrue(attn.get("unverifiedOwners").get("count").asLong() >= 1);
        assertTrue(attn.get("noProducts").get("count").asLong() >= 1);
        assertTrue(attn.get("noProducts").get("items").isArray());

        // Newest stores: capped at 5, each carrying an owner name and date. Our store may
        // be pushed out by stores other tests create later in the shared context, so assert
        // the shape and our store's owner only when present.
        JsonNode newest = ov.get("newestStores");
        assertTrue(newest.size() <= 5, "newest stores is capped at five");
        for (JsonNode s : newest) {
            assertTrue(s.get("ownerName").asText().length() > 0, "newest rows carry an owner name");
            if ("overview-cafe".equals(s.get("slug").asText())) {
                assertEquals("Test MERCHANT", s.get("ownerName").asText());
            }
        }

        assertTrue(ov.get("recentActions").isArray());
    }

    @Test
    void overview_isForbiddenForNonAdmin() throws Exception {
        String merchant = registerAndGetToken("ov-nonadmin@test.com", "MERCHANT", null);
        getWithToken("/admin/metrics/overview", merchant, 403);
    }
}
