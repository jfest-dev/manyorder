package com.manyorder.api.domain.emailverification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;

/**
 * Core of the email-verification flow — the sign-up counterpart to
 * {@code PasswordResetService}, sharing the same hashed-token machinery.
 *
 * Security posture:
 *  - Tokens are 32 bytes of {@link SecureRandom}, Base64URL-encoded; only their
 *    SHA-256 hash is persisted, so the raw token lives solely in the email.
 *  - Tokens expire after {@value #TOKEN_TTL_HOURS} hours and are single-use; a
 *    successful verification also invalidates any other outstanding tokens.
 *  - Resend requests are rate-limited to {@value #MAX_REQUESTS_PER_WINDOW} per
 *    {@value #RATE_WINDOW_MINUTES}-minute window per account.
 *  - Verifying is a nag-clearing convenience, not a gate: an already-verified
 *    account is a silent no-op on both send and verify.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);

    private static final String INVALID_TOKEN_MESSAGE =
            "This verification link is invalid or has expired.";

    private static final int TOKEN_BYTES = 32;
    private static final long TOKEN_TTL_HOURS = 24;
    private static final int MAX_REQUESTS_PER_WINDOW = 3;
    private static final long RATE_WINDOW_MINUTES = 15;

    private final UserRepository userRepository;
    private final EmailVerificationTokenRepository tokenRepository;
    private final EmailVerificationMailer mailer;
    private final String frontendBaseUrl;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Base64.Encoder base64Url = Base64.getUrlEncoder().withoutPadding();

    public EmailVerificationService(UserRepository userRepository,
                                    EmailVerificationTokenRepository tokenRepository,
                                    EmailVerificationMailer mailer,
                                    @Value("${app.frontend.base-url:http://localhost:3000}") String frontendBaseUrl) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.mailer = mailer;
        // Trim a trailing slash so URL building is predictable.
        this.frontendBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1)
                : frontendBaseUrl;
    }

    /**
     * Issue a verification link to a user, unless they are already verified or
     * over their rate limit (both silent). Safe to call from sign-up and from an
     * authenticated resend; never throws on send failure.
     */
    @Transactional
    public void sendVerification(User user) {
        if (user.isVerified()) {
            return; // nothing to confirm
        }

        LocalDateTime windowStart = LocalDateTime.now().minusMinutes(RATE_WINDOW_MINUTES);
        long recent = tokenRepository.countByUserAndCreatedAtAfter(user, windowStart);
        if (recent >= MAX_REQUESTS_PER_WINDOW) {
            log.info("Email-verification rate limit hit for user {} — skipping send", user.getId());
            return;
        }

        String rawToken = generateToken();
        EmailVerificationToken token = new EmailVerificationToken(
                user, sha256Hex(rawToken), LocalDateTime.now().plusHours(TOKEN_TTL_HOURS));
        tokenRepository.save(token);

        String verifyUrl = frontendBaseUrl + "/verify-email?token=" + rawToken;
        mailer.sendVerificationLink(user.getEmail(), verifyUrl);
    }

    /**
     * Consume a token and mark the user verified. Throws 400 for any token that
     * is unknown, expired, or already used.
     */
    @Transactional
    public void verify(String rawToken) {
        EmailVerificationToken token = tokenRepository.findByTokenHash(sha256Hex(rawToken))
                .filter(t -> !t.isUsed() && !t.isExpired())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_MESSAGE));

        User user = token.getUser();
        user.setVerified(true);
        userRepository.save(user);

        LocalDateTime now = LocalDateTime.now();
        token.setUsedAt(now);
        tokenRepository.save(token);
        // Invalidate any other links already sitting in the user's inbox.
        tokenRepository.markAllUsedForUser(user, now);
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return base64Url.encodeToString(bytes);
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed present on every JVM.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
