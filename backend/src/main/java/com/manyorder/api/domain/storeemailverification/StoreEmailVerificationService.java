package com.manyorder.api.domain.storeemailverification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;

/**
 * Confirms a store's contact email. Mirrors the user email-verification token
 * machinery: 32 bytes of SecureRandom, only the SHA-256 hash stored, single-use,
 * 24-hour expiry, with a generic error for any bad/expired/used token. Rate
 * limited per store and capped per destination address so it cannot spam anyone.
 * Never logs the token or the address.
 */
@Service
public class StoreEmailVerificationService {

    static final int TOKEN_TTL_HOURS = 24;
    static final int STORE_WINDOW_MINUTES = 15;
    static final int STORE_MAX = 3;      // per store per 15 minutes
    static final int ADDRESS_WINDOW_HOURS = 24;
    static final int ADDRESS_MAX = 3;    // per destination address per day, platform-wide

    private static final String GENERIC_ERROR = "This confirmation link is invalid or has expired.";

    private final StoreEmailVerificationTokenRepository tokenRepository;
    private final MerchantRepository merchantRepository;
    private final StoreEmailConfirmationMailer mailer;
    private final String frontendBaseUrl;
    private final SecureRandom secureRandom = new SecureRandom();

    public StoreEmailVerificationService(StoreEmailVerificationTokenRepository tokenRepository,
                                         MerchantRepository merchantRepository,
                                         StoreEmailConfirmationMailer mailer,
                                         @Value("${app.frontend.base-url:http://localhost:3000}") String frontendBaseUrl) {
        this.tokenRepository = tokenRepository;
        this.merchantRepository = merchantRepository;
        this.mailer = mailer;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    /** Owner-requested send. Enforces both rate limits; 400 when there is no store email. */
    @Transactional
    public void sendConfirmation(Merchant merchant) {
        String normalized = StoreEmail.normalize(merchant.getEmail());
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add a store email first.");
        }
        LocalDateTime now = LocalDateTime.now();
        if (tokenRepository.countByMerchantAndCreatedAtAfter(merchant, now.minusMinutes(STORE_WINDOW_MINUTES)) >= STORE_MAX) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait before sending another confirmation.");
        }
        if (tokenRepository.countByEmailAndCreatedAtAfter(normalized, now.minusHours(ADDRESS_WINDOW_HOURS)) >= ADDRESS_MAX) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "That address has been sent too many confirmations today.");
        }

        String rawToken = generateToken();
        tokenRepository.save(new StoreEmailVerificationToken(
                merchant, normalized, sha256Hex(rawToken), now.plusHours(TOKEN_TTL_HOURS)));
        String confirmUrl = frontendBaseUrl + "/confirm-store-email?token=" + rawToken;
        mailer.sendConfirmation(merchant, merchant.getEmail().trim(), confirmUrl);
    }

    /** Auto-send after a store email is set or changed, unless it is already verified. Never throws. */
    @Transactional
    public void autoSendIfNeeded(Merchant merchant) {
        try {
            if (StoreEmail.normalize(merchant.getEmail()) == null) return;
            if (StoreEmail.isVerified(merchant)) return; // already verified, or equals the verified login email
            sendConfirmation(merchant);
        } catch (Exception e) {
            // Best effort: a confirmation (or its rate limit) must never break saving the store.
        }
    }

    /** Consume a token and mark the store email verified. Generic 400 for bad/expired/used tokens. */
    @Transactional
    public String confirm(String rawToken) {
        StoreEmailVerificationToken token = tokenRepository.findByTokenHash(sha256Hex(rawToken))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, GENERIC_ERROR));
        if (token.isUsed() || token.isExpired()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, GENERIC_ERROR);
        }
        Merchant merchant = token.getMerchant();
        merchant.setVerifiedEmail(token.getEmail());
        merchantRepository.save(merchant);
        token.setUsedAt(LocalDateTime.now());
        tokenRepository.save(token);
        return merchant.getName();
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256Hex(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
