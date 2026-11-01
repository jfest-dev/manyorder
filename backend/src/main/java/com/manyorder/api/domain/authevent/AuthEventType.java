package com.manyorder.api.domain.authevent;

/** The kinds of account/security events recorded in {@code auth_events}. */
public enum AuthEventType {
    LOGIN,
    LOGIN_FAILED,
    SIGNUP,
    EMAIL_VERIFIED,
    ACCOUNT_LOCKED,
    PASSWORD_RESET_REQUESTED
}
