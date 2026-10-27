package com.manyorder.api.domain.auth;

/**
 * Sends account-security notices to the account owner. Behind an interface so
 * tests can substitute a spy/mock. Implementations must never throw on delivery
 * failure in a way that affects the sign-in flow; failures are logged.
 */
public interface AccountSecurityMailer {

    /** Tell the owner their account was temporarily locked after repeated failed sign-ins. */
    void sendAccountLocked(String email);
}
