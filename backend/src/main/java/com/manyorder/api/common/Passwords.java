package com.manyorder.api.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Shared password rules applied at every set-password point (register, reset,
 *  change). Verify points (login, archive-confirm) only trim, since no valid
 *  stored password can contain whitespace once this rule is in force. */
public final class Passwords {

    private Passwords() {}

    /** Minimum length for a bootstrap secret (ADMIN_PASSWORD / DEMO_PASSWORD). */
    public static final int MIN_SECRET_LENGTH = 12;

    /** Reject a new password containing any whitespace (space, tab, newline). */
    public static void requireNoWhitespace(String raw) {
        if (raw != null && raw.chars().anyMatch(Character::isWhitespace)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password can't contain spaces.");
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
