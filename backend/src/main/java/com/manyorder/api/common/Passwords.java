package com.manyorder.api.common;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

/** Shared password rules applied at every set-password point (register, reset,
 *  change). Verify points (login, archive-confirm) only trim, since no valid
 *  stored password can contain whitespace once this rule is in force. */
public final class Passwords {

    private Passwords() {}

    /** Minimum length for a bootstrap secret (ADMIN_PASSWORD / DEMO_PASSWORD). */
    public static final int MIN_SECRET_LENGTH = 12;

    /**
     * Sentinel stored in {@code passwordHash} for an account that has no usable
     * password (created by, or taken over by, Google sign-in). It is not a valid
     * encoder output, so it must never be passed to the encoder directly; use
     * {@link #matches} and {@link #hasUsablePassword} instead. Detecting a no-password
     * account this way needs no extra column.
     */
    public static final String NO_PASSWORD = "{none}no-usable-password";

    /** True when the stored hash is a real, verifiable password (not the sentinel). */
    public static boolean hasUsablePassword(String storedHash) {
        return storedHash != null && !NO_PASSWORD.equals(storedHash);
    }

    /** Verify a raw password against a stored hash, returning false (never throwing)
     *  when the account has no usable password, so the sentinel is never handed to the
     *  encoder. */
    public static boolean matches(PasswordEncoder encoder, String rawPassword, String storedHash) {
        return hasUsablePassword(storedHash) && encoder.matches(rawPassword, storedHash);
    }

    /**
     * bcrypt only considers the first 72 bytes of a password, so anything longer is
     * silently truncated (and some encoder versions reject it outright). Cap new
     * passwords at this size so what the user types is what is actually hashed.
     */
    public static final int MAX_PASSWORD_BYTES = 72;

    /** Reject a new password containing any whitespace (space, tab, newline). */
    public static void requireNoWhitespace(String raw) {
        if (raw != null && raw.chars().anyMatch(Character::isWhitespace)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password can't contain spaces.");
        }
    }

    /**
     * Reject a new password longer than {@value #MAX_PASSWORD_BYTES} bytes in UTF-8
     * (so multi-byte characters count by their byte size). Applied at every
     * set-password point; login never checks length, so an existing longer password
     * still verifies (bcrypt compares only the first 72 bytes).
     */
    public static void requireWithinMaxLength(String raw) {
        if (raw != null && raw.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password must be " + MAX_PASSWORD_BYTES + " bytes or fewer.");
        }
    }

    /**
     * Validate a startup secret supplied by env (admin/demo password). A blank/unset
     * value is left alone (caller decides whether it's required); a present value must
     * be at least {@value #MIN_SECRET_LENGTH} chars and contain no whitespace, else we
     * fail fast at startup. The message names the variable and rule, never the value.
     */
    public static void requireValidStartupSecret(String varName, String value) {
        if (value == null || value.isEmpty()) {
            return;
        }
        if (value.length() < MIN_SECRET_LENGTH || value.chars().anyMatch(Character::isWhitespace)) {
            throw new IllegalStateException(
                    varName + " must be at least " + MIN_SECRET_LENGTH + " characters and contain no spaces.");
        }
    }
}
