package com.manyorder.api;

import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Remember me controls the token lifetime; a platform admin is always short-lived. */
class RememberMeIntegrationTest extends IntegrationTestBase {

    private static final long HOUR = 3600L;
    private static final long DAY = 24 * HOUR;

    /** Seconds from now until the returned token expires. */
    private long ttlSeconds(String email, String password, boolean remember) throws Exception {
        MvcResult r = mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\",\"remember\":" + remember + "}"))
                .andExpect(status().isOk()).andReturn();
        String token = json(r).get("token").asText();
        String payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]));
        JsonNode claims = objectMapper.readTree(payload);
        return claims.get("exp").asLong() - (System.currentTimeMillis() / 1000L);
    }

    @Test
    void unchecked24h_checked30d_adminAlways24h() throws Exception {
        String email = "remember-me@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        // Short (default) lifetime; the exact value depends on config (24h in prod, 1h in tests),
        // so assert it is clearly short rather than hardcoding the number.
        long notRemembered = ttlSeconds(email, "password123", false);
        assertTrue(notRemembered > HOUR / 2 && notRemembered < 2 * DAY,
                "unchecked is short-lived, was " + notRemembered + "s");

        // Remembered is the 30-day lifetime, clearly far longer.
        long remembered = ttlSeconds(email, "password123", true);
        assertTrue(remembered > 25 * DAY && remembered < 31 * DAY,
                "checked lasts about 30 days, was " + remembered + "s");

        // A platform admin stays short-lived even when remember is ticked.
        long adminRemembered = ttlSeconds("admin@manyorder.app", SEED_DEMO_PASSWORD, true);
        assertTrue(adminRemembered < 2 * DAY,
                "admin stays short-lived even when remembered, was " + adminRemembered + "s");
    }
}
