package com.manyorder.api;

import java.time.LocalDateTime;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.manyorder.api.domain.passwordreset.PasswordResetMailer;
import com.manyorder.api.domain.passwordreset.PasswordResetToken;
import com.manyorder.api.domain.passwordreset.PasswordResetTokenRepository;
import com.manyorder.api.domain.user.UserRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Forgot / reset password — Module: Auth / Password Reset.
 *
 * The mailer is a spy so we can recover the raw token from the built reset URL
 * (only its hash is stored). The Resend key is blank in test config, so the
 * real mailer method is a harmless no-op and never calls out.
 */
class PasswordResetIntegrationTest extends IntegrationTestBase {

    private static final String GENERIC_MESSAGE =
            "If an account exists with that email, we've sent a reset link.";

    @MockitoSpyBean private PasswordResetMailer mailer;
    @Autowired private PasswordResetTokenRepository tokenRepository;
    @Autowired private UserRepository userRepository;

    // ---------- helpers ----------

    private String forgot(String email) throws Exception {
        var result = mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isOk())
                .andReturn();
        return json(result).get("message").asText();
    }

    private void reset(String token, String newPassword, int expected) throws Exception {
        var body = new java.util.HashMap<String, Object>();
        body.put("token", token);
        body.put("newPassword", newPassword);
        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected));
    }

    /** Request a reset once and recover the raw token from the emailed URL. */
    private String forgotAndCaptureToken(String email) throws Exception {
        forgot(email);
        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendResetLink(eq(email), urlCaptor.capture());
        String url = urlCaptor.getValue();
        return url.substring(url.indexOf("token=") + "token=".length());
    }

    /** The single outstanding token belonging to the given account. */
    private PasswordResetToken tokenFor(String email) {
        Long uid = userRepository.findByEmail(email).orElseThrow().getId();
        return tokenRepository.findAll().stream()
                .filter(t -> t.getUser().getId().equals(uid))
                .reduce((a, b) -> b)
                .orElseThrow();
    }

    private void loginExpect(String email, String password, int expected) throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", email, "password", password))))
                .andExpect(status().is(expected));
    }

    // ---------- tests ----------

    @Test
    void happyPath_setsNewPassword_andOldStopsWorking() throws Exception {
        String email = "pr-happy@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        String token = forgotAndCaptureToken(email);
        reset(token, "brandnew1", 204);

        loginExpect(email, "brandnew1", 200);   // new password works
        loginExpect(email, "password123", 401); // old password rejected
    }

    @Test
    void expiredToken_returns400_andPasswordUnchanged() throws Exception {
        String email = "pr-expired@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        String token = forgotAndCaptureToken(email);

        // Age the token past its 30-minute lifetime.
        PasswordResetToken row = tokenFor(email);
        row.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        tokenRepository.save(row);

        reset(token, "brandnew1", 400);

        loginExpect(email, "password123", 200); // original password still works
    }

    @Test
    void usedToken_cannotBeReused_returns400() throws Exception {
        String email = "pr-onetime@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        String token = forgotAndCaptureToken(email);

        reset(token, "brandnew1", 204); // first use succeeds
        reset(token, "another99", 400); // second use rejected

        // The first reset stuck; the second never applied.
        loginExpect(email, "brandnew1", 200);
        loginExpect(email, "another99", 401);
    }

    @Test
    void unknownEmail_returns200_genericMessage_andSendsNothing() throws Exception {
        String message = forgot("nobody-here@test.com");

        assertEquals(GENERIC_MESSAGE, message);
        verify(mailer, never()).sendResetLink(any(), any());
    }

    @Test
    void knownEmail_returnsSameGenericMessage() throws Exception {
        // The message must be identical to the unknown-email case so a caller
        // can't distinguish existing accounts by the response.
        String email = "pr-generic@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        assertEquals(GENERIC_MESSAGE, forgot(email));
    }

    @Test
    void rateLimit_fourthRequestInWindow_isNotSent_butStillReturns200() throws Exception {
        String email = "pr-ratelimit@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        for (int i = 0; i < 3; i++) {
            assertEquals(GENERIC_MESSAGE, forgot(email));
        }
        // The 4th within the 15-minute window is silently skipped.
        assertEquals(GENERIC_MESSAGE, forgot(email));

        verify(mailer, times(3)).sendResetLink(eq(email), any());
    }

    @Test
    void invalidToken_returns400() throws Exception {
        reset("this-is-not-a-real-token", "brandnew1", 400);
    }

    @Test
    void shortPassword_returns400_andPasswordUnchanged() throws Exception {
        String email = "pr-short@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        String token = forgotAndCaptureToken(email);
        reset(token, "123", 400); // fails @Size(min = 6) bean validation

        loginExpect(email, "password123", 200); // unchanged
    }
}
