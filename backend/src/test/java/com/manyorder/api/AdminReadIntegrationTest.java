package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Admin read surface: cross-merchant list, drill-down, metrics — PLATFORM_ADMIN only. */
class AdminReadIntegrationTest extends IntegrationTestBase {

    @Test
    void admin_listsMerchants_drillsDown_andReadsMetrics() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String merchant = registerAndGetToken("read-owner@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Read Test", "read-test-store");

        // List includes the new store, with ACTIVE status and zero data counts.
        JsonNode list = json(getWithToken("/admin/merchants", admin, 200));
        JsonNode row = null;
        for (JsonNode n : list) {
            if ("read-test-store".equals(n.get("slug").asText())) { row = n; break; }
        }
        assertTrue(row != null, "new store appears in the admin list");
        assertEquals("ACTIVE", row.get("status").asText());
        assertEquals(0, row.get("productCount").asInt());
        assertEquals("read-owner@test.com", row.get("ownerEmail").asText());

        // Drill-down on that store.
        JsonNode detail = json(getWithToken("/admin/merchants/" + storeId, admin, 200));
        assertEquals("Read Test", detail.get("name").asText());

        // Metrics: at least our merchant is counted.
        JsonNode metrics = json(getWithToken("/admin/metrics", admin, 200));
        assertTrue(metrics.get("totalMerchants").asLong() >= 1);
        assertTrue(metrics.has("suspendedMerchants") && metrics.has("newMerchantsLast30Days"));
    }

    @Test
    void adminRead_isForbiddenForNonAdmin() throws Exception {
        String merchant = registerAndGetToken("read-nonadmin@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "NonAdmin Store", "nonadmin-read-store");

        getWithToken("/admin/merchants", merchant, 403);
        getWithToken("/admin/merchants/" + storeId, merchant, 403);
        getWithToken("/admin/metrics", merchant, 403);
    }
}
