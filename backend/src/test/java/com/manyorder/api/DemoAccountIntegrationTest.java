package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.manyorder.api.domain.passwordreset.PasswordResetMailer;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Demo-account protections, with the seeded merchant configured as the demo account
 * via DEMO_EMAIL. It cannot change its password or archive a store, cannot use the
 * reset flow, is exempt from the per-email lock/throttle, and /account marks it demo.
 */
@TestPropertySource(properties = "app.demo.email=manyorder.app@gmail.com")
class DemoAccountIntegrationTest extends IntegrationTestBase {

    private static final String DEMO = "manyorder.app@gmail.com";

    @MockitoSpyBean private PasswordResetMailer mailer;

    private String demoToken() throws Exception {
        return loginAndGetToken(DEMO, SEED_DEMO_PASSWORD);
    }

    @Test
    void accountMarksTheUserAsDemo() throws Exception {
        MvcResult r = getWithToken("/account", demoToken(), 200);
        assertTrue(json(r).get("demo").asBoolean(), "the demo account is flagged");
    }

    @Test
    void demoCannotChangePassword() throws Exception {
        MvcResult r = mockMvc.perform(post("/account/change-password")
                        .header("Authorization", "Bearer " + demoToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", SEED_DEMO_PASSWORD, "newPassword", "a-new-password-1"))))
                .andExpect(status().isForbidden())
                .andReturn();
        assertTrue(r.getResponse().getContentAsString().contains("This is a demo account."));
    }

    @Test
    void demoCannotArchiveAStore() throws Exception {
        String token = demoToken();
        JsonNode stores = json(getWithToken("/merchant/stores", token, 200)).get("stores");
        long storeId = stores.get(0).get("id").asLong();

        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/archive")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", SEED_DEMO_PASSWORD))))
                .andExpect(status().isForbidden())
                .andReturn();
        assertTrue(r.getResponse().getContentAsString().contains("This is a demo account."));
    }

    @Test
    void demoCannotUsePasswordReset_noEmailSent() throws Exception {
        mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", DEMO))))
                .andExpect(status().isOk()); // generic message, but nothing is sent
        verify(mailer, never()).sendResetLink(eq(DEMO), any());
    }

    @Test
    void demoIsExemptFromTheEmailLockAndThrottle() throws Exception {
        // Six wrong passwords would lock/throttle a normal account; the demo stays 401.
        for (int i = 0; i < 6; i++) {
            int status = mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("email", DEMO, "password", "wrong-pw"))))
                    .andReturn().getResponse().getStatus();
            assertFalse(status == 429, "demo login is never throttled (attempt " + (i + 1) + ")");
        }
        // And the real password still signs in (never locked out).
        loginAndGetToken(DEMO, SEED_DEMO_PASSWORD);
    }
}
