package com.manyorder.api;

import java.time.LocalDateTime;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.emailverification.EmailVerificationMailer;
import com.manyorder.api.domain.emailverification.EmailVerificationToken;
import com.manyorder.api.domain.emailverification.EmailVerificationTokenRepository;
import com.manyorder.api.domain.user.UserRepository;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Email verification at sign-up — Module: Auth / Email Verification.
 *
 * The mailer is a spy so we can recover the raw token from the built verify URL
 * (only its hash is stored). The Resend key is blank in test config, so the
 * real mailer method is a harmless no-op and never calls out.
 */
class EmailVerificationIntegrationTest extends IntegrationTestBase {

    @MockitoSpyBean private EmailVerificationMailer mailer;
    @Autowired private EmailVerificationTokenRepository tokenRepository;
    @Autowired private UserRepository userRepository;

    // ---------- helpers ----------

    /** Register sends the verification email on the spy; recover its raw token. */
    private String tokenFromRegistration(String email) throws Exception {
        registerAndGetToken(email, "MERCHANT", null);
        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendVerificationLink(eq(email), urlCaptor.capture());
        String url = urlCaptor.getValue();
        return url.substring(url.indexOf("token=") + "token=".length());
    }

    private void verifyEmail(String token, int expected) throws Exception {
        mockMvc.perform(post("/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", token))))
                .andExpect(status().is(expected));
    }

    private boolean isVerified(String email) {
        return userRepository.findByEmail(email).orElseThrow().isVerified();
    }

    private EmailVerificationToken tokenFor(String email) {
        Long uid = userRepository.findByEmail(email).orElseThrow().getId();
        return tokenRepository.findAll().stream()
                .filter(t -> t.getUser().getId().equals(uid))
                .reduce((a, b) -> b)
                .orElseThrow();
    }

    // ---------- tests ----------

    @Test
    void newAccount_startsUnverified_andLoginReportsIt() throws Exception {
        String email = "ev-new@test.com";
        MvcResult reg = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "New User", "email", email,
                                "password", "password123", "role", "MERCHANT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(false))
                .andReturn();
        assertFalse(json(reg).get("verified").asBoolean());
        assertFalse(isVerified(email));
    }

    @Test
    void verifyLink_marksAccountVerified() throws Exception {
        String email = "ev-happy@test.com";
        String token = tokenFromRegistration(email);
        assertFalse(isVerified(email));

        verifyEmail(token, 204);

        assertTrue(isVerified(email));
    }

    @Test
    void expiredToken_returns400_andStaysUnverified() throws Exception {
        String email = "ev-expired@test.com";
        String token = tokenFromRegistration(email);

        EmailVerificationToken row = tokenFor(email);
        row.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        tokenRepository.save(row);

        verifyEmail(token, 400);
        assertFalse(isVerified(email));
    }

    @Test
    void usedToken_cannotBeReused_returns400() throws Exception {
        String email = "ev-onetime@test.com";
        String token = tokenFromRegistration(email);

        verifyEmail(token, 204); // first use verifies
        verifyEmail(token, 400); // second use rejected
        assertTrue(isVerified(email)); // first verification stuck
    }

    @Test
    void invalidToken_returns400() throws Exception {
        verifyEmail("this-is-not-a-real-token", 400);
    }

    @Test
    void demoAccount_isSeededVerified() throws Exception {
        // The seeded demo merchant ships pre-verified so recruiters never see
        // the nag banner. Proven through the login response's verified flag.
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "hello@manyorder.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(true));
        assertTrue(isVerified("hello@manyorder.com"));
    }

    @Test
    void me_reflectsVerifiedState_afterVerifying() throws Exception {
        String email = "ev-me@test.com";
        String token = tokenFromRegistration(email);
        String jwt = loginAndGetToken(email, "password123");

        mockMvc.perform(get("/auth/me").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(false));

        verifyEmail(token, 204);

        mockMvc.perform(get("/auth/me").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(true));
    }

    @Test
    void resendVerification_sendsAnotherLink_forSignedInUser() throws Exception {
        String email = "ev-resend@test.com";
        tokenFromRegistration(email); // 1st send (on registration)
        String jwt = loginAndGetToken(email, "password123");

        mockMvc.perform(post("/auth/resend-verification").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());

        // Registration + resend = two sends to this address.
        verify(mailer, org.mockito.Mockito.times(2)).sendVerificationLink(eq(email), any());
    }
}
