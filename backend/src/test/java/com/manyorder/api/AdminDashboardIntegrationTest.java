package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The redesigned dashboard endpoint: PLATFORM_ADMIN only, read-only, opens on Today. */
class AdminDashboardIntegrationTest extends IntegrationTestBase {

    @Test
    void dashboard_defaultsToTodayAndReturnsEverySection() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        JsonNode r = json(getWithToken("/admin/metrics/dashboard", admin, 200));

        assertEquals("today", r.get("window").get("range").asText());
        assertTrue(r.get("happened").has("orders"));
        assertTrue(r.get("happened").get("stores").isArray());
        assertTrue(r.get("happened").get("latestOrders").isArray());
        assertTrue(r.get("needsAction").isArray());
        assertTrue(r.get("dropOff").isArray());
        assertTrue(r.get("rightNow").has("activeStores"));
        assertTrue(r.get("timingsMs").has("total"));
    }

    @Test
    void dashboard_isForbiddenForNonAdminAndUnauthenticated() throws Exception {
        String merchant = registerAndGetToken("dash-nonadmin@test.com", "MERCHANT", null);
        getWithToken("/admin/metrics/dashboard", merchant, 403);
        mockMvc.perform(get("/admin/metrics/dashboard")).andExpect(status().isUnauthorized());
    }
}
