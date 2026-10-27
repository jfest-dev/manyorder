package com.manyorder.api.domain.passwordreset;

/**
 * Sends the password-reset link. Extracted behind an interface so tests can
 * substitute a spy and recover the raw token from the built URL (the database
 * only ever holds its hash).
 */
public interface PasswordResetMailer {

    /**
     * Deliver a reset link to {@code email}. Implementations must not throw on
     * delivery failure in a way that reveals account existence to the caller —
     * failures are logged, not surfaced.
     */
    void sendResetLink(String email, String resetUrl);
}
