package com.manyorder.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.common.Passwords;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

/**
 * Keeps privileged accounts off the repo's fixed passwords in real environments.
 *
 * <ul>
 *   <li>If ADMIN_EMAIL + ADMIN_PASSWORD are set, upsert the platform admin at
 *       startup (create one if none exists, else reconcile its email + password
 *       hash). Idempotent.</li>
 *   <li>If DEMO_PASSWORD is set, rotate the hash of the existing demo merchant and
 *       demo staff accounts (independent of SEED_DEMO), so a previously-seeded
 *       environment stops using the public password.</li>
 *   <li>A set-but-invalid ADMIN_PASSWORD or DEMO_PASSWORD (under 12 chars or
 *       containing whitespace) fails startup with a clear, value-free message.</li>
 *   <li>Unset values do nothing. No password or hash is ever logged.</li>
 * </ul>
 */
@Component
@Order(2) // after DataSeeder, so freshly seeded rows can be reconciled/rotated
public class SecurityBootstrap implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SecurityBootstrap.class);

    // The seeded demo accounts, rotated when DEMO_PASSWORD is provided.
    private static final String DEMO_MERCHANT_EMAIL = "manyorder.app@gmail.com";
    private static final String DEMO_STAFF_EMAIL = "staff@manyorder.com";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;
    private final String demoPassword;

    public SecurityBootstrap(UserRepository userRepository,
                             PasswordEncoder passwordEncoder,
                             @Value("${app.admin.email:}") String adminEmail,
                             @Value("${app.admin.password:}") String adminPassword,
                             @Value("${app.demo.password:}") String demoPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail == null ? "" : adminEmail.trim();
        this.adminPassword = adminPassword == null ? "" : adminPassword;
        this.demoPassword = demoPassword == null ? "" : demoPassword;
    }

    @Override
    @Transactional
    public void run(String... args) {
        // Fail fast on a set-but-invalid secret (names the rule, never the value).
        Passwords.requireValidStartupSecret("ADMIN_PASSWORD", adminPassword);
        Passwords.requireValidStartupSecret("DEMO_PASSWORD", demoPassword);

        bootstrapAdmin();
        rotateDemoPasswords();
    }

    private void bootstrapAdmin() {
        boolean hasEmail = !adminEmail.isEmpty();
        boolean hasPassword = !adminPassword.isEmpty();
        if (!hasEmail && !hasPassword) {
            return; // unset: do nothing
        }
        if (hasEmail ^ hasPassword) {
            throw new IllegalStateException("ADMIN_EMAIL and ADMIN_PASSWORD must both be set, or both unset.");
        }
        if (adminEmail.chars().anyMatch(Character::isWhitespace)) {
            throw new IllegalStateException("ADMIN_EMAIL must not contain spaces.");
        }

        User admin = userRepository.findFirstByRole(UserRole.PLATFORM_ADMIN).orElse(null);
        if (admin == null) {
            User created = new User("Platform Admin", adminEmail,
                    passwordEncoder.encode(adminPassword), UserRole.PLATFORM_ADMIN);
            created.setVerified(true);
            userRepository.save(created);
            log.info("Platform admin created from ADMIN_EMAIL/ADMIN_PASSWORD.");
            return;
        }
        boolean changed = false;
        if (!adminEmail.equals(admin.getEmail())) {
            admin.setEmail(adminEmail);
            changed = true;
        }
        if (!passwordEncoder.matches(adminPassword, admin.getPasswordHash())) {
            admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            changed = true;
        }
        if (changed) {
            userRepository.save(admin);
            log.info("Platform admin reconciled from ADMIN_EMAIL/ADMIN_PASSWORD.");
        }
    }

    private void rotateDemoPasswords() {
        if (demoPassword.isEmpty()) {
            return;
        }
        rotate(DEMO_MERCHANT_EMAIL);
        rotate(DEMO_STAFF_EMAIL);
    }

    private void rotate(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            if (!passwordEncoder.matches(demoPassword, user.getPasswordHash())) {
                user.setPasswordHash(passwordEncoder.encode(demoPassword));
                userRepository.save(user);
                log.info("Rotated the stored password for a seeded demo account.");
            }
        });
    }
}
