package com.manyorder.api.domain.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Per-email sign-in throttling. Failures 1 to 4 return a plain 401 "Invalid email or
 * password."; the fifth returns 429 "Too many attempts..." with a Retry-After header.
 * The counter is kept per normalized email even when no account exists, so an existing
 * and an unknown email return an identical status, message and header at every step
 * (no existence leak). A successful sign-in resets the counter. Uses a fixed clock.
 */
class SignInThrottleTest {

    private static final String PLAIN = "Invalid email or password.";
    private static final String TOO_MANY = "Too many attempts. Try again in 15 minutes, or reset your password.";

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
    private PasswordEncoder passwordEncoder;
    private JwtUtil jwtUtil;
    private MutableClock clock;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        MerchantRepository merchantRepository = mock(MerchantRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtUtil = mock(JwtUtil.class);
        EmailVerificationService emailVerificationService = mock(EmailVerificationService.class);
        AccountSecurityMailer mailer = mock(AccountSecurityMailer.class);

        when(passwordEncoder.encode(anyString())).thenReturn("DUMMY");
        when(passwordEncoder.matches("correct", "HASH")).thenReturn(true);

        clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        authService = new AuthService(userRepository, merchantRepository, passwordEncoder, jwtUtil,
                emailVerificationService, "", "support@manyorder.app", clock, mailer,
                new SignInAttemptTracker());
    }

    private User existingMerchant(String email) {
        User u = new User("Name", email, "HASH", UserRole.MERCHANT);
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(u));
        return u;
    }

    private LoginRequest req(String email, String password) {
        LoginRequest r = mock(LoginRequest.class);
        when(r.getEmail()).thenReturn(email);
        when(r.getPassword()).thenReturn(password);
        return r;
    }

    private ResponseStatusException attempt(String email, String password) {
        return assertThrows(ResponseStatusException.class, () -> authService.login(req(email, password)));
    }

    @Test
    void firstFourFailuresArePlain401_fifthIs429WithRetryAfter() {
        existingMerchant("known@test.com");
        for (int i = 1; i <= 4; i++) {
            ResponseStatusException e = attempt("known@test.com", "wrong");
            assertEquals(HttpStatus.UNAUTHORIZED, e.getStatusCode(), "failure " + i + " is 401");
            assertEquals(PLAIN, e.getReason(), "failure " + i + " is the plain message");
        }
        ResponseStatusException fifth = attempt("known@test.com", "wrong");
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, fifth.getStatusCode());
        assertEquals(TOO_MANY, fifth.getReason());
        String retryAfter = ((TooManyAttemptsException) fifth).getHeaders().getFirst(HttpHeaders.RETRY_AFTER);
        assertNotNull(retryAfter, "429 carries a Retry-After header");
        assertTrue(Long.parseLong(retryAfter) > 0, "Retry-After is a positive number of seconds");
    }

    @Test
    void unknownEmailIsCountedAndThrottledToo() {
        when(userRepository.findByEmail("nobody@test.com")).thenReturn(Optional.empty());
        for (int i = 1; i <= 4; i++) {
            assertEquals(HttpStatus.UNAUTHORIZED, attempt("nobody@test.com", "wrong").getStatusCode());
        }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, attempt("nobody@test.com", "wrong").getStatusCode());
    }

    @Test
    void existingAndUnknownEmailsAreIndistinguishableAtEveryStep() {
        existingMerchant("known@test.com");
        when(userRepository.findByEmail("nobody@test.com")).thenReturn(Optional.empty());

        for (int i = 1; i <= 5; i++) {
            ResponseStatusException known = attempt("known@test.com", "wrong");
            ResponseStatusException unknown = attempt("nobody@test.com", "wrong");
            assertEquals(known.getStatusCode(), unknown.getStatusCode(), "same status at step " + i);
            assertEquals(known.getReason(), unknown.getReason(), "same message at step " + i);
        }
        // At the throttled step both carry an identical Retry-After header.
        String knownRetry = ((TooManyAttemptsException) attempt("known@test.com", "wrong"))
                .getHeaders().getFirst(HttpHeaders.RETRY_AFTER);
        String unknownRetry = ((TooManyAttemptsException) attempt("nobody@test.com", "wrong"))
                .getHeaders().getFirst(HttpHeaders.RETRY_AFTER);
        assertEquals(knownRetry, unknownRetry, "identical Retry-After header");
    }

    @Test
    void throttleBlocksCorrectPasswordUntilWindowExpires_thenSucceeds() {
        existingMerchant("known@test.com");
        for (int i = 0; i < 5; i++) attempt("known@test.com", "wrong");

        // Correct password while throttled is still refused with the 429 message.
        ResponseStatusException blocked = attempt("known@test.com", "correct");
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, blocked.getStatusCode());
        assertEquals(TOO_MANY, blocked.getReason());

        clock.advance(Duration.ofMinutes(16));
        when(jwtUtil.generateToken(org.mockito.ArgumentMatchers.nullable(Long.class), anyString(), anyString(),
                org.mockito.ArgumentMatchers.anyBoolean())).thenReturn("token");
        assertNotNull(authService.login(req("known@test.com", "correct")), "succeeds once the window lapses");
    }

    @Test
    void successResetsTheCounterSoThrottlingRestartsFromZero() {
        existingMerchant("known@test.com");
        when(jwtUtil.generateToken(org.mockito.ArgumentMatchers.nullable(Long.class), anyString(), anyString(),
                org.mockito.ArgumentMatchers.anyBoolean())).thenReturn("token");

        for (int i = 0; i < 4; i++) attempt("known@test.com", "wrong");
        assertNotNull(authService.login(req("known@test.com", "correct")), "4 failures then a success");

        // After the reset, four more failures are still plain 401 (counter started over).
        for (int i = 1; i <= 4; i++) {
            assertEquals(HttpStatus.UNAUTHORIZED, attempt("known@test.com", "wrong").getStatusCode(),
                    "post-reset failure " + i + " is still 401");
        }
    }
}
