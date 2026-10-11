package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Admin Merchants search: filter, sort and paging, with totals for the pager. */
class AdminMerchantSearchIntegrationTest extends IntegrationTestBase {

    @Test
    void search_filtersBySearchTermStatusAndCurrency_andPages() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String ownerA = registerAndGetToken("search-a@test.com", "MERCHANT", null);
        long storeA = createStore(ownerA, "Kiri Coffee", "kiri-coffee-search");
        String ownerB = registerAndGetToken("search-b@test.com", "MERCHANT", null);
        createStore(ownerB, "Momo Bakery", "momo-bakery-search");

        // Search matches the one store by slug (and never the other).
        JsonNode byName = json(getWithToken("/admin/merchants/search?q=kiri-coffee", admin, 200));
        assertEquals(1, byName.get("totalElements").asLong());
        assertEquals(1, byName.get("totalPages").asInt());
        assertEquals(1, byName.get("page").asInt());
        assertEquals("kiri-coffee-search", byName.get("content").get(0).get("slug").asText());

        // Search by owner email also matches.
        JsonNode byOwner = json(getWithToken("/admin/merchants/search?q=search-b@test.com", admin, 200));
        assertEquals(1, byOwner.get("totalElements").asLong());
        assertEquals("momo-bakery-search", byOwner.get("content").get(0).get("slug").asText());

        // Suspend store A, then the SUSPENDED filter returns it and the ACTIVE filter does not.
        mockMvc.perform(post("/admin/merchants/" + storeA + "/suspend")
                .header("Authorization", "Bearer " + admin)).andExpect(status().isNoContent());

        JsonNode suspended = json(getWithToken("/admin/merchants/search?q=search&status=SUSPENDED", admin, 200));
        assertEquals(1, suspended.get("totalElements").asLong());
        assertEquals("kiri-coffee-search", suspended.get("content").get(0).get("slug").asText());

        JsonNode active = json(getWithToken("/admin/merchants/search?q=search&status=ACTIVE", admin, 200));
        for (JsonNode n : active.get("content")) {
            assertTrue(!"kiri-coffee-search".equals(n.get("slug").asText()), "suspended store excluded from ACTIVE");
        }

        // Paging: size=1 over our two search-tagged stores yields 2 pages, 1 row each.
        JsonNode page1 = json(getWithToken("/admin/merchants/search?q=search&size=1&page=1", admin, 200));
        assertEquals(2, page1.get("totalElements").asLong());
        assertEquals(2, page1.get("totalPages").asInt());
        assertEquals(1, page1.get("content").size());

        JsonNode page2 = json(getWithToken("/admin/merchants/search?q=search&size=1&page=2", admin, 200));
        assertEquals(2, page2.get("page").asInt());
        assertEquals(1, page2.get("content").size());
        assertTrue(!page1.get("content").get(0).get("slug").asText()
                .equals(page2.get("content").get(0).get("slug").asText()), "page 2 shows a different store");
    }

    @Test
    void search_isForbiddenForNonAdmin() throws Exception {
        String merchant = registerAndGetToken("search-nonadmin@test.com", "MERCHANT", null);
        getWithToken("/admin/merchants/search?q=x", merchant, 403);
    }
}
