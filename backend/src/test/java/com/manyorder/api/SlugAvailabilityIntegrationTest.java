package com.manyorder.api;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Public slug-availability endpoint: available for a free valid name, and the SAME
 * neutral {available:false} for taken, reserved and invalid names, so it leaks
 * nothing. Uses the same normalization as create (so it is case-insensitive).
 */
class SlugAvailabilityIntegrationTest extends IntegrationTestBase {

    private String body(String slug) throws Exception {
        return mockMvc.perform(get("/public/store-slug-available").param("slug", slug))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void freeValidSlug_isAvailable() throws Exception {
        mockMvc.perform(get("/public/store-slug-available").param("slug", "a-brand-new-slug"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void takenReservedAndInvalid_allReturnTheSameNeutralResponse() throws Exception {
        // Taken: create a store, then check its slug.
        String token = registerAndGetToken("avail-taken@test.com", "MERCHANT", null);
        createStore(token, "Taken Store", "taken-slug");

        String taken = body("taken-slug");
        String reserved = body("admin");
        String invalid = body("Not A Slug!");
        String tooLong = body("a".repeat(51));

        assertEquals("{\"available\":false}", taken, "taken is neutral false");
        assertEquals(taken, reserved, "reserved identical to taken");
        assertEquals(taken, invalid, "invalid identical to taken");
        assertEquals(taken, tooLong, "over-length identical to taken");
    }

    @Test
    void reservedCheck_isCaseInsensitive() throws Exception {
        // Upper case normalizes to the reserved lower-case form, so it is unavailable.
        mockMvc.perform(get("/public/store-slug-available").param("slug", "ADMIN"))
                .andExpect(jsonPath("$.available").value(false));
    }

    @Test
    void blankSlug_isNotAvailable() throws Exception {
        mockMvc.perform(get("/public/store-slug-available").param("slug", "   "))
                .andExpect(jsonPath("$.available").value(false));
    }
}
