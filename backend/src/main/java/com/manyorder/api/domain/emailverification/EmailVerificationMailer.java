package com.manyorder.api.domain.emailverification;

/**
 * Sends the email-verification link. Extracted behind an interface so tests can
 * substitute a spy and recover the raw token from the built URL (the database
 * only ever holds its hash).
 */
public interface EmailVerificationMailer {

    /**
     * Deliver a verification link to {@code email}. Implementations must not
     * throw on delivery failure — failures are logged, not surfaced.
     */
    void sendVerificationLink(String email, String verifyUrl);
}
