package com.manyorder.api.domain.admin;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Body for a notifiable admin action. Restricting actions (suspend, product
 * hide, discount switch-off) require a reason via {@link #validated()} and
 * always email. Restoring actions (unsuspend, unhide, switch-on) use
 * {@link #optionalReason()} and {@link #shouldEmail()} (email on by default,
 * the admin can untick it). Reason is at most 300 characters either way.
 */
public record AdminReasonRequest(String reason, Boolean emailOwner) {

    public static final int MAX_LENGTH = 300;

    /** The trimmed reason, or a 400 if it is missing or too long (restricting actions). */
    public String validated() {
        String trimmed = reason == null ? "" : reason.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reason is required.");
        }
        if (trimmed.length() > MAX_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reason must be " + MAX_LENGTH + " characters or fewer.");
        }
        return trimmed;
    }

    /** The trimmed reason or null when blank; a 400 if too long (restoring actions). */
    public String optionalReason() {
        String trimmed = reason == null ? "" : reason.trim();
        if (trimmed.length() > MAX_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reason must be " + MAX_LENGTH + " characters or fewer.");
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Email the owner unless the admin explicitly unticked the box. */
    public boolean shouldEmail() {
        return emailOwner == null || emailOwner;
    }
}
