package com.manyorder.api.domain.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.config.JwtUtil;
import com.manyorder.api.domain.emailverification.EmailVerificationService;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sign-in lockout: a wrong password for an existing account is counted, the account
 * locks for 15 minutes after 5 failures (10 for a platform admin), a correct
 * password during the lock is still refused, the lock expires, a success resets the
 * counter, and an unknown email returns the same status and message as a wrong
 * password. Uses a controllable clock.
 */
class AuthServiceLockoutTest {

    private static final String MESSAGE = "Invalid email or password.";
    private static final String TOO_MANY =
            "Too many attempts. Try again in 15 minutes, or reset your password.";

    /** A clock whose instant the test can advance. */
    static final class MutableClock extends Clock {
        private Instant instant;
        private final ZoneId zone;
        MutableClock(Instant instant, ZoneId zone) { this.instant = instant; this.zone = zone; }
        @Override public ZoneId getZone() { return zone; }
        @Override public Clock withZone(ZoneId z) { return new MutableClock(instant, z); }
        @Override public Instant instant() { return instant; }
        void advance(Duration d) { this.instant = this.instant.plus(d); }
    }

    private UserRepository userRepository;
    private MerchantRepository merchantRepository;
    private PasswordEncoder passwordEncoder;
    private JwtUtil jwtUtil;
    private MutableClock clock;
    private AccountSecurityMailer mailer;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        merchantRepository = mock(MerchantRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtUtil = mock(JwtUtil.class);
        EmailVerificationService emailVerificationService = mock(EmailVerificationService.class);

        when(passwordEncoder.encode(anyString())).thenReturn("DUMMY");
        when(passwordEncoder.matches("correct", "HASH")).thenReturn(true);
        when(passwordEncoder.matches("wrong", "HASH")).thenReturn(false);
        when(jwtUtil.generateToken(nullable(Long.class), anyString(), anyString(), anyBoolean()))
                .thenReturn("token");

        clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        mailer = mock(AccountSecurityMailer.class);
        authService = new AuthService(userRepository, merchantRepository, passwordEncoder, jwtUtil,
                emailVerificationService, "", "support@manyorder.app", clock, mailer,
                new SignInAttemptTracker());
    }

    private User existing(UserRole role) {
        User u = new User("Name", "known@test.com", "HASH", role);
        when(userRepository.findByEmail("known@test.com")).thenReturn(java.util.Optional.of(u));
        return u;
    }

    private LoginRequest req(String email, String password) {
        LoginRequest r = mock(LoginRequest.class);
        when(r.getEmail()).thenReturn(email);
        when(r.getPassword()).thenReturn(password);
        when(r.isRemember()).thenReturn(false);
        return r;
    }

    private ResponseStatusException attempt(String email, String password) {
        return assertThrows(ResponseStatusException.class, () -> authService.login(req(email, password)));
    }

    @Test
    void countsFailures_butDoesNotLockBelowThreshold() {
        User u = existing(UserRole.MERCHANT);
        for (int i = 0; i < 4; i++) attempt("known@test.com", "wrong");
        assertEquals(4, u.getFailedLoginAttempts());
        assertNull(u.getLockedUntil(), "not locked yet after 4 failures");
    }

    @Test
    void locksAfterFifthFailure() {
        User u = existing(UserRole.MERCHANT);
        for (int i = 0; i < 5; i++) attempt("known@test.com", "wrong");
        assertNotNull(u.getLockedUntil(), "locked after 5 failures");
        assertEquals(clock.instant().plus(Duration.ofMinutes(15)),
                u.getLockedUntil().toInstant(ZoneOffset.UTC), "locked for 15 minutes");
    }

    @Test
    void correctPasswordDuringLock_isStillRejected() {
        User u = existing(UserRole.MERCHANT);
        for (int i = 0; i < 5; i++) attempt("known@test.com", "wrong");

        ResponseStatusException e = attempt("known@test.com", "correct");
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatusCode(), "locked -> 429");
        assertEquals(TOO_MANY, e.getReason());
        assertNotNull(u.getLockedUntil(), "still locked");
        verify(jwtUtil, never()).generateToken(nullable(Long.class), anyString(), anyString(), anyBoolean());
    }

    @Test
    void lockExpires_thenCorrectPasswordSucceeds() {
        User u = existing(UserRole.MERCHANT);
        for (int i = 0; i < 5; i++) attempt("known@test.com", "wrong");

        clock.advance(Duration.ofMinutes(16));
        LoginResponse response = authService.login(req("known@test.com", "correct"));

        assertNotNull(response, "login succeeds once the lock has expired");
        assertNull(u.getFailedLoginAttempts(), "counter cleared");
        assertNull(u.getLockedUntil(), "lock cleared");
    }

    @Test
    void successResetsTheCounter() {
        User u = existing(UserRole.MERCHANT);
        attempt("known@test.com", "wrong");
        attempt("known@test.com", "wrong");
        assertEquals(2, u.getFailedLoginAttempts());

        LoginResponse response = authService.login(req("known@test.com", "correct"));
        assertNotNull(response);
        assertNull(u.getFailedLoginAttempts(), "a success resets the counter");
    }

    @Test
    void unknownEmail_matchesWrongPasswordResponse_andKeepsNoCounter() {
        existing(UserRole.MERCHANT);
        ResponseStatusException wrong = attempt("known@test.com", "wrong");

        // Scope the save check to the unknown-email call only (the wrong attempt above saved).
        clearInvocations(userRepository);
        when(userRepository.findByEmail("nobody@test.com")).thenReturn(java.util.Optional.empty());
        ResponseStatusException unknown = attempt("nobody@test.com", "wrong");

        assertEquals(wrong.getStatusCode(), unknown.getStatusCode(), "same status");
        assertEquals(wrong.getReason(), unknown.getReason(), "same message");
        assertEquals(MESSAGE, unknown.getReason());
        // No user is saved for a non-existent account (it never gets a counter).
        verify(userRepository, never()).save(nullable(User.class));
        // And an unknown email never triggers an account-locked email.
        verify(mailer, never()).sendAccountLocked(anyString());
    }

    @Test
    void lockEmail_sentOncePerHour_whenLockStarts() {
        existing(UserRole.MERCHANT);
        // First lock -> one email.
        for (int i = 0; i < 5; i++) attempt("known@test.com", "wrong");
        verify(mailer, times(1)).sendAccountLocked("known@test.com");

        // Lock expires, a fresh lock within the hour -> no second email.
        clock.advance(Duration.ofMinutes(16));
        for (int i = 0; i < 5; i++) attempt("known@test.com", "wrong");
        verify(mailer, times(1)).sendAccountLocked("known@test.com");

        // More than an hour after the first email, a new lock emails again.
        clock.advance(Duration.ofMinutes(50));
        for (int i = 0; i < 5; i++) attempt("known@test.com", "wrong");
        verify(mailer, times(2)).sendAccountLocked("known@test.com");
    }

    @Test
    void adminLocksAfterTenFailures() {
        User admin = existing(UserRole.PLATFORM_ADMIN);
        for (int i = 0; i < 9; i++) attempt("known@test.com", "wrong");
        assertNull(admin.getLockedUntil(), "admin not locked after 9 failures");

        attempt("known@test.com", "wrong");
        assertNotNull(admin.getLockedUntil(), "admin locks after 10 failures");
    }
}
