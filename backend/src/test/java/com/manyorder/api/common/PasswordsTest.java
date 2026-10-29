package com.manyorder.api.common;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The no-usable-password sentinel: detection and a guarded verify that never hands
 *  the sentinel to the encoder. */
class PasswordsTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    @Test
    void hasUsablePassword_isFalseForSentinelOrNull() {
        assertFalse(Passwords.hasUsablePassword(Passwords.NO_PASSWORD));
        assertFalse(Passwords.hasUsablePassword(null));
        assertTrue(Passwords.hasUsablePassword(encoder.encode("real-password-1")));
    }

    @Test
    void matches_returnsFalseForSentinel_withoutCallingTheEncoder() {
        // The sentinel is not a valid encoder output; matches must not throw.
        assertFalse(Passwords.matches(encoder, "anything", Passwords.NO_PASSWORD));
    }

    @Test
    void matches_verifiesARealHash() {
        String hash = encoder.encode("correct-horse-1");
        assertTrue(Passwords.matches(encoder, "correct-horse-1", hash));
        assertFalse(Passwords.matches(encoder, "wrong", hash));
    }
}
