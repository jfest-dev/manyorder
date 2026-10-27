package com.manyorder.api.domain.auth;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;

import com.manyorder.api.IntegrationTestBase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * End-to-end sign-in throttling over HTTP: failures 1 to 4 return a plain 401, the
 * fifth returns 429 with a Retry-After header, and an existing and an unknown email
 * produce an identical status, message and header (no existence leak). The in-memory
 * counter is reset between tests so this shared singleton stays isolated.
 */
class SignInThrottleIntegrationTest extends IntegrationTestBase {

    private static final String PLAIN = "Invalid email or password.";
    private static final String TOO_MANY = "Too many attempts. Try again in 15 minutes, or reset your password.";

    @Autowired private SignInAttemptTracker attemptTracker;

    @BeforeEach
    void resetTracker() {
        attemptTracker.clear();
    }

    private MockHttpServletResponse login(String email, String password) throws Exception {
        return mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andReturn().getResponse();
    }

    @Test
    void fourPlainFailuresThenA429WithRetryAfter() throws Exception {
        registerAndGetToken("throttle-known@test.com", "MERCHANT", null);

        for (int i = 1; i <= 4; i++) {
            MockHttpServletResponse r = login("throttle-known@test.com", "wrong-password");
            assertEquals(401, r.getStatus(), "failure " + i + " is 401");
            assertTrue(r.getContentAsString().contains(PLAIN), "failure " + i + " shows the plain message");
        }
        MockHttpServletResponse fifth = login("throttle-known@test.com", "wrong-password");
        assertEquals(429, fifth.getStatus(), "fifth failure is throttled");
        assertTrue(fifth.getContentAsString().contains(TOO_MANY));
        assertNotNull(fifth.getHeader("Retry-After"), "429 carries a Retry-After header");
        assertTrue(Long.parseLong(fifth.getHeader("Retry-After")) > 0);
    }

    @Test
    void existingAndUnknownEmailsReturnAnIdenticalThrottleResponse() throws Exception {
        registerAndGetToken("throttle-exists@test.com", "MERCHANT", null);

        MockHttpServletResponse existing = null;
        MockHttpServletResponse unknown = null;
        for (int i = 1; i <= 5; i++) {
            existing = login("throttle-exists@test.com", "wrong-password");
        }
        for (int i = 1; i <= 5; i++) {
            unknown = login("throttle-missing@test.com", "wrong-password");
        }

        // Identical status, Retry-After header and message body for both.
        assertEquals(429, existing.getStatus());
        assertEquals(existing.getStatus(), unknown.getStatus(), "same status");
        assertEquals(existing.getHeader("Retry-After"), unknown.getHeader("Retry-After"), "same Retry-After");
        assertTrue(existing.getContentAsString().contains(TOO_MANY));
        assertTrue(unknown.getContentAsString().contains(TOO_MANY));
        // The response never echoes the email, so it cannot reveal which one exists.
        assertFalse(existing.getContentAsString().contains("throttle-exists@test.com"));
        assertFalse(unknown.getContentAsString().contains("throttle-missing@test.com"));
    }
}
