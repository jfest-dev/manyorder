package com.manyorder.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.manyorder.api.domain.authevent.AuthEvent;
import com.manyorder.api.domain.authevent.AuthEventRepository;
import com.manyorder.api.domain.authevent.AuthEventType;
import com.manyorder.api.domain.authevent.AuthMethod;
import com.manyorder.api.domain.emailverification.EmailVerificationToken;
import com.manyorder.api.domain.emailverification.EmailVerificationTokenRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * The auth flows write one privacy-preserving auth_event each, and the retention sweep
 * drops old rows. No IPs, no passwords, no tokens, and no email for failed attempts.
 */
class AuthEventTrackingIntegrationTest extends IntegrationTestBase {

    @Autowired AuthEventRepository authEvents;
    @Autowired com.manyorder.api.domain.authevent.AuthEventService authEventService;
    @Autowired UserRepository userRepository;
    @Autowired EmailVerificationTokenRepository tokenRepository;

    private Long userId(String email) {
        return userRepository.findByEmail(email).map(User::getId).orElseThrow();
    }

    private List<AuthEvent> eventsFor(String email) {
        return authEvents.findByUserIdOrderByIdAsc(userId(email));
    }

    @Test
    void registerWritesASignupEvent() throws Exception {
        String email = "ae-signup@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        List<AuthEvent> rows = eventsFor(email).stream().filter(e -> e.getEventType() == AuthEventType.SIGNUP).toList();
        assertEquals(1, rows.size());
        assertEquals(AuthMethod.PASSWORD, rows.get(0).getMethod());
        assertTrue(rows.get(0).isSuccess());
        assertEquals(userId(email), rows.get(0).getUserId());
    }

    @Test
    void successfulLoginWritesLoginAndStampsLastLogin() throws Exception {
        String email = "ae-login@test.com";
        registerAndGetToken(email, "MERCHANT", null);
        assertNull(userRepository.findByEmail(email).orElseThrow().getLastLoginAt(), "no sign-in yet after register");

        loginAndGetToken(email, "password123");

        List<AuthEvent> rows = eventsFor(email).stream().filter(e -> e.getEventType() == AuthEventType.LOGIN).toList();
        assertEquals(1, rows.size());
        assertEquals(AuthMethod.PASSWORD, rows.get(0).getMethod());
        assertTrue(rows.get(0).isSuccess());
        assertNotNull(userRepository.findByEmail(email).orElseThrow().getLastLoginAt(), "last_login_at is stamped");
    }

    @Test
    void failedLoginWritesLoginFailedWithoutUserIdOrEmail() throws Exception {
        String email = "ae-fail@test.com";
        registerAndGetToken(email, "MERCHANT", null);
        long before = authEvents.count();

        mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "wrong-password"))));

        // A new LOGIN_FAILED row exists, and no failed row carries this account's id.
        List<AuthEvent> added = authEvents.findAll().stream().filter(e -> e.getId() != null).toList();
        assertTrue(authEvents.count() > before, "a failed attempt was recorded");
        assertTrue(added.stream().anyMatch(e -> e.getEventType() == AuthEventType.LOGIN_FAILED
                && !e.isSuccess() && e.getUserId() == null && e.getMethod() == AuthMethod.PASSWORD));
        assertFalse(eventsFor(email).stream().anyMatch(e -> e.getEventType() == AuthEventType.LOGIN_FAILED),
                "a failed attempt is never tied to the account");
    }

    @Test
    void fiveFailuresLockTheAccountAndRecordIt() throws Exception {
        String email = "ae-lock@test.com";
        registerAndGetToken(email, "MERCHANT", null);
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "wrong-password"))));
        }
        assertTrue(eventsFor(email).stream().anyMatch(e -> e.getEventType() == AuthEventType.ACCOUNT_LOCKED),
                "crossing the threshold records a lock");
    }

    @Test
    void forgotPasswordForAKnownAccountWritesAResetRequest() throws Exception {
        String email = "ae-reset@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        mockMvc.perform(post("/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email))));

        List<AuthEvent> rows = eventsFor(email).stream()
                .filter(e -> e.getEventType() == AuthEventType.PASSWORD_RESET_REQUESTED).toList();
        assertEquals(1, rows.size());
        assertTrue(rows.get(0).isSuccess());
    }

    @Test
    void verifyingEmailWritesEmailVerified() throws Exception {
        String email = "ae-verify@test.com";
        registerAndGetToken(email, "MERCHANT", null);
        User user = userRepository.findByEmail(email).orElseThrow();
        assertFalse(user.isVerified());

        // Plant a verification token whose hash matches a known raw value, then confirm it.
        String raw = "known-raw-token-ae-verify";
        tokenRepository.save(new EmailVerificationToken(user, sha256Hex(raw), LocalDateTime.now().plusHours(1)));

        mockMvc.perform(post("/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("token", raw))));

        assertTrue(userRepository.findByEmail(email).orElseThrow().isVerified());
        assertEquals(1, eventsFor(email).stream().filter(e -> e.getEventType() == AuthEventType.EMAIL_VERIFIED).count());
    }

    @Test
    void retentionSweepDropsRowsOlderThanNinetyDaysAndKeepsNewer() {
        LocalDateTime now = LocalDateTime.now();
        AuthEvent old = authEvents.save(new AuthEvent(now.minusDays(100), AuthEventType.LOGIN, AuthMethod.PASSWORD, true, null));
        AuthEvent recent = authEvents.save(new AuthEvent(now.minusDays(10), AuthEventType.LOGIN, AuthMethod.PASSWORD, true, null));

        authEventService.sweepOldEvents();

        assertFalse(authEvents.findById(old.getId()).isPresent(), "a 100-day-old row is swept");
        assertTrue(authEvents.findById(recent.getId()).isPresent(), "a 10-day-old row is kept");
    }

    private static String sha256Hex(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(digest.length * 2);
        for (byte b : digest) sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        return sb.toString();
    }
}
