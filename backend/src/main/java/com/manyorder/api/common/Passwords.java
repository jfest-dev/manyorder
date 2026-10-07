package com.manyorder.api.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Shared password rules applied at every set-password point (register, reset,
 *  change). Verify points (login, archive-confirm) only trim, since no valid
 *  stored password can contain whitespace once this rule is in force. */
public final class Passwords {

    private Passwords() {}

    /** Reject a new password containing any whitespace (space, tab, newline). */
    public static void requireNoWhitespace(String raw) {
        if (raw != null && raw.chars().anyMatch(Character::isWhitespace)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password can't contain spaces.");
        }
    }
}
