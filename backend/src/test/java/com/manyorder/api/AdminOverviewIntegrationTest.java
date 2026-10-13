package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Admin Overview: grouped aggregates for the dashboard. PLATFORM_ADMIN only. */
class AdminOverviewIntegrationTest extends IntegrationTestBase {

    @Test
    void overview_reportsValueOrdersAttentionAndRecents() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
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

        // Top stores ranks by order count; our store (2 orders) must appear.
        boolean inTop = false;
        for (JsonNode s : ov.get("topStores")) {
            if ("overview-cafe".equals(s.get("slug").asText())) {
                inTop = true;
                assertTrue(s.get("orders").asLong() >= 2);
                assertEquals("SGD", s.get("currency").asText());
            }
        }
        assertTrue(inTop, "store with orders shows in top stores");

        // Needs attention: unverified owner and no-products both include our store.
        JsonNode attn = ov.get("needsAttention");
        assertTrue(attn.get("unverifiedOwners").get("count").asLong() >= 1);
        assertTrue(attn.get("noProducts").get("count").asLong() >= 1);
        assertTrue(attn.get("noProducts").get("items").isArray());

        // Newest stores includes the one we just made.
        boolean inNewest = false;
        for (JsonNode s : ov.get("newestStores")) {
            if ("overview-cafe".equals(s.get("slug").asText())) {
                inNewest = true;
                assertEquals("Test MERCHANT", s.get("ownerName").asText());
            }
        }
        assertTrue(inNewest, "new store shows in newest list");

        assertTrue(ov.get("recentActions").isArray());
    }

    @Test
    void overview_isForbiddenForNonAdmin() throws Exception {
        String merchant = registerAndGetToken("ov-nonadmin@test.com", "MERCHANT", null);
        getWithToken("/admin/metrics/overview", merchant, 403);
    }
}
