package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/** The admin audit-log GET (store-filterable) and the store-detail endpoint. */
class AdminAuditLogAndDetailIntegrationTest extends IntegrationTestBase {

    private long kiriBrewId(String merchantToken) throws Exception {
        JsonNode stores = json(getWithToken("/merchant/stores", merchantToken, 200)).get("stores");
        for (JsonNode s : stores) {
            if ("Kiri Brew".equals(s.get("name").asText())) return s.get("id").asLong();
        }
        return stores.get(0).get("id").asLong();
    }

    @Test
    void auditLogIsStoreFilterable_andStoreDetailAggregates() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        String merchant = loginAndGetToken("manyorder.app@gmail.com", SEED_DEMO_PASSWORD);
        long storeId = kiriBrewId(merchant);

        // Generate an audit row: admin deactivates one of the store's products.
        JsonNode products = json(getWithToken("/admin/merchants/" + storeId + "/products", admin, 200));
        long productId = products.get(0).get("id").asLong();
        mockMvc.perform(patch("/admin/merchants/" + storeId + "/products/" + productId + "/deactivate")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Out of policy\"}"))
                .andExpect(status().isOk());

        // Audit log filtered by this store contains the action, scoped to it, with the reason saved.
        JsonNode scoped = json(getWithToken("/admin/audit-log?storeId=" + storeId, admin, 200));
        boolean found = false;
        for (JsonNode row : scoped) {
            assertEquals(storeId, row.get("merchantId").asLong(), "filtered rows are all this store's");
            if ("DEACTIVATE_PRODUCT".equals(row.get("action").asText())
                    && row.get("targetId").asLong() == productId) {
                found = true;
                assertEquals("Out of policy", row.get("detail").asText(), "reason saved on the audit row");
                // Snapshots: store name and the target label (product name) for a readable feed.
                assertEquals("Kiri Brew", row.get("storeName").asText(), "store-name snapshot saved");
                assertTrue(row.get("targetLabel").asText().length() > 0, "target-label snapshot saved");
            }
        }
        assertTrue(found, "deactivate shows in the store-filtered audit log");

        // Unfiltered log also contains it.
        JsonNode all = json(getWithToken("/admin/audit-log", admin, 200));
        assertTrue(all.size() >= scoped.size(), "unfiltered log is a superset");

        // Store detail aggregates owner + profile + counts + currency-scoped revenue + recent actions.
        JsonNode detail = json(getWithToken("/admin/merchants/" + storeId + "/detail", admin, 200));
        assertEquals("Kiri Brew", detail.get("name").asText());
        assertEquals("ACTIVE", detail.get("status").asText());
        assertNotNull(detail.get("owner").get("email").asText());
        assertEquals(detail.get("currency").asText(), detail.get("activity").get("revenueCurrency").asText());
        assertTrue(detail.get("activity").get("productCount").asLong() > 0);
        assertTrue(detail.get("activity").has("lowStockCount"));
        assertTrue(detail.get("activity").has("revenue"));
        assertTrue(detail.get("recentActions").size() > 0, "recent admin actions are listed");
    }

    @Test
    void auditLogIsAdminOnly() throws Exception {
        String merchant = loginAndGetToken("manyorder.app@gmail.com", SEED_DEMO_PASSWORD);
        getWithToken("/admin/audit-log", merchant, 403);
    }
}
