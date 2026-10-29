package com.manyorder.api.domain.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Google sign-in account resolution: a verified account links unchanged, an
 * unverified account is taken over (password rotated, marked verified) so an
 * earlier squatter's password can no longer be used, and a new email creates a
 * verified MERCHANT.
 */
@SpringBootTest
class GoogleSignInLinkingTest {

    @Autowired private AuthService authService;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    void unverifiedPasswordAccount_isTakenOver_passwordRotated_andVerified() {
        String email = "google-squatter@test.com";
        String squatterPassword = "squatter-pass-123";
        User existing = new User("Squatter", email, passwordEncoder.encode(squatterPassword), UserRole.MERCHANT);
        existing.setVerified(false);
        userRepository.save(existing);

        User resolved = authService.resolveGoogleUser(email, "Real Owner");

        assertEquals(existing.getId(), resolved.getId(), "links to the same account");
        assertTrue(resolved.isVerified(), "now verified");
        assertFalse(com.manyorder.api.common.Passwords.hasUsablePassword(resolved.getPasswordHash()),
                "no usable password after takeover, so the squatter's old password no longer works");
    }

    @Test
    void verifiedAccount_linksUnchanged() {
        String email = "google-verified@test.com";
        String ownerPassword = "owner-pass-123";
        User existing = new User("Owner", email, passwordEncoder.encode(ownerPassword), UserRole.MERCHANT);
        existing.setVerified(true);
        userRepository.save(existing);

        User resolved = authService.resolveGoogleUser(email, "Owner");

        assertEquals(existing.getId(), resolved.getId());
        assertTrue(resolved.isVerified());
        assertTrue(passwordEncoder.matches(ownerPassword, resolved.getPasswordHash()),
                "a verified account's password is left untouched");
    }

    @Test
    void newEmail_createsVerifiedMerchant() {
        String email = "google-new@test.com";
        User resolved = authService.resolveGoogleUser(email, "New Person");

        assertTrue(resolved.getId() != null);
        assertEquals(UserRole.MERCHANT, resolved.getRole());
        assertTrue(resolved.isVerified());
    }
}
