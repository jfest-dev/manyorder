package com.manyorder.api.domain.passwordreset;

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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;

/**
 * Core of the forgot/reset-password flow.
 *
 * Security posture:
 *  - forgotPassword never reveals whether an account exists — the caller always
 *    sees the same generic outcome regardless of lookup result or rate limit.
 *  - Tokens are 32 bytes of {@link SecureRandom}, Base64URL-encoded; only their
 *    SHA-256 hash is persisted, so the raw token lives solely in the email.
 *  - Tokens expire after {@value #TOKEN_TTL_MINUTES} minutes and are single-use;
 *    a successful reset also invalidates any other outstanding tokens.
 *  - Requests are rate-limited to {@value #MAX_REQUESTS_PER_WINDOW} per
 *    {@value #RATE_WINDOW_MINUTES}-minute window per account.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    static final String GENERIC_MESSAGE =
            "If an account exists with that email, we've sent a reset link.";
    private static final String INVALID_TOKEN_MESSAGE =
            "This reset link is invalid or has expired.";

    private static final int TOKEN_BYTES = 32;
    private static final long TOKEN_TTL_MINUTES = 30;
    private static final int MAX_REQUESTS_PER_WINDOW = 3;
    private static final long RATE_WINDOW_MINUTES = 15;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordResetMailer mailer;
    private final PasswordEncoder passwordEncoder;
    private final String frontendBaseUrl;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Base64.Encoder base64Url = Base64.getUrlEncoder().withoutPadding();

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetTokenRepository tokenRepository,
                                PasswordResetMailer mailer,
                                PasswordEncoder passwordEncoder,
                                @Value("${app.frontend.base-url:http://localhost:3000}") String frontendBaseUrl) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.mailer = mailer;
        this.passwordEncoder = passwordEncoder;
        // Trim a trailing slash so URL building is predictable.
        this.frontendBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1)
                : frontendBaseUrl;
    }

    /**
     * Issue a reset link if the email maps to an account and the account is
     * under its rate limit. Always returns the same generic message; any
     * skip (unknown email, over limit) is silent.
     */
    @Transactional
    public String requestReset(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim();

        userRepository.findByEmail(email).ifPresent(user -> {
            LocalDateTime windowStart = LocalDateTime.now().minusMinutes(RATE_WINDOW_MINUTES);
            long recent = tokenRepository.countByUserAndCreatedAtAfter(user, windowStart);
            if (recent >= MAX_REQUESTS_PER_WINDOW) {
                log.info("Password-reset rate limit hit for user {} — skipping send", user.getId());
                return;
            }

            String rawToken = generateToken();
            PasswordResetToken token = new PasswordResetToken(
                    user, sha256Hex(rawToken), LocalDateTime.now().plusMinutes(TOKEN_TTL_MINUTES));
            tokenRepository.save(token);

            String resetUrl = frontendBaseUrl + "/reset-password?token=" + rawToken;
            mailer.sendResetLink(user.getEmail(), resetUrl);
        });

        return GENERIC_MESSAGE;
    }

    /**
     * Consume a token and set the user's new password. Throws 400 for any token
     * that is unknown, expired, or already used — deliberately with the same
     * message so nothing about the reason leaks.
     */
    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository.findByTokenHash(sha256Hex(rawToken))
                .filter(t -> !t.isUsed() && !t.isExpired())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_MESSAGE));

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
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
