package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The range-scoped analytics endpoint: PLATFORM_ADMIN only, read-only, echoes its window. */
class AdminAnalyticsIntegrationTest extends IntegrationTestBase {

    @Test
    void analytics_returnsResolvedWindowForAdmin() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);

        JsonNode r = json(getWithToken("/admin/metrics/analytics?range=7d&compare=true", admin, 200));

        JsonNode window = r.get("window");
        assertEquals("7d", window.get("range").asText());
        assertTrue(window.get("compare").asBoolean(), "compare echoed back");
        assertTrue(window.get("fromUtc").asText().endsWith("Z"), "bounds are UTC instants");
        // The core sections are always present.
        assertTrue(r.get("orders").get("byCurrency").isArray());
        assertTrue(r.get("orders").get("byDay").isArray());
        assertTrue(r.get("funnel").get("steps").isArray());
        assertTrue(r.get("timingsMs").has("total"), "query timings are reported");
    }

    @Test
    void analytics_acceptsACustomRange() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);

        JsonNode r = json(getWithToken("/admin/metrics/analytics?from=2026-03-01&to=2026-03-03", admin, 200));
        assertEquals("custom", r.get("window").get("range").asText());
        assertEquals("2026-03-01", r.get("window").get("fromDate").asText());
        assertEquals("2026-03-03", r.get("window").get("toDate").asText());
    }

    @Test
    void analytics_rejectsAnOverLongCustomRangeWithAClear400() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        // More than the 366-day cap.
        getWithToken("/admin/metrics/analytics?from=2026-01-01&to=2027-06-01", admin, 400);
    }

    @Test
    void analytics_rejectsAReversedCustomRangeWithAClear400() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        getWithToken("/admin/metrics/analytics?from=2026-03-03&to=2026-03-01", admin, 400);
    }

    @Test
    void analytics_isForbiddenForNonAdminAndUnauthenticated() throws Exception {
        String merchant = registerAndGetToken("an-nonadmin@test.com", "MERCHANT", null);
        getWithToken("/admin/metrics/analytics?range=30d", merchant, 403);
        mockMvc.perform(get("/admin/metrics/analytics?range=30d")).andExpect(status().isUnauthorized());
    }
}
