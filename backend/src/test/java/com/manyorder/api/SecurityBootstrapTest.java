package com.manyorder.api;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.manyorder.api.config.SecurityBootstrap;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** SecurityBootstrap must never crash on blank secrets; only a set-but-invalid one fails fast. */
class SecurityBootstrapTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final UserRepository userRepository = mock(UserRepository.class);

    private SecurityBootstrap bootstrap(String adminEmail, String adminPassword, String demoPassword) {
        return new SecurityBootstrap(userRepository, encoder, adminEmail, adminPassword, demoPassword);
    }

    @Test
    void adminEmailSet_withNoPassword_startsNormally_andChangesNothing() {
        // The production regression: ADMIN_EMAIL present, ADMIN_PASSWORD removed.
        assertDoesNotThrow(() -> bootstrap("admin@manyorder.app", "", "").run());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void everythingUnset_startsNormally_andChangesNothing() {
        assertDoesNotThrow(() -> bootstrap("", "", "").run());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void invalidAdminPassword_failsFast() {
        assertThrows(IllegalStateException.class, () -> bootstrap("admin@manyorder.app", "short", "").run());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void invalidDemoPassword_failsFast() {
        assertThrows(IllegalStateException.class, () -> bootstrap("", "", "has space 12+").run());
    }

    @Test
    void validAdminConfig_createsAdminWhenNoneExists() {
        when(userRepository.findFirstByRole(UserRole.PLATFORM_ADMIN)).thenReturn(Optional.empty());
        bootstrap("admin@manyorder.app", "a-strong-password-123", "").run();
        verify(userRepository).save(any(User.class));
    }
}
