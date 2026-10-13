package com.manyorder.api.domain.admin;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * The written reason an admin must give for a notifiable action (suspend,
 * unsuspend, product hide, discount switch-off). Required, trimmed, 1 to 300
 * characters. The reason is stored in the audit log and emailed to the owner.
 */
public record AdminReasonRequest(String reason) {

    public static final int MAX_LENGTH = 300;

    /** The trimmed reason, or a 400 if it is missing or too long. */
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
}
