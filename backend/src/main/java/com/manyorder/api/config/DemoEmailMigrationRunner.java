package com.manyorder.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.user.UserRepository;

/**
 * One-time, guarded, idempotent rename of the demo account's login email from
 * {@code DEMO_EMAIL_FROM} to {@code DEMO_EMAIL}. Runs after the seeder and
 * SecurityBootstrap (Order 3). It acts only when DEMO_EMAIL is set, an account with
 * DEMO_EMAIL_FROM exists, and no account with DEMO_EMAIL exists; otherwise it does
 * nothing and never touches another user. The account keeps its stores (ownership is
 * by id, which the rename does not change). It is reversible by swapping the two
 * values, since the live database has no public access.
 */
@Component
@Order(3)
public class DemoEmailMigrationRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoEmailMigrationRunner.class);

    private final DemoAccount demoAccount;
    private final UserRepository userRepository;

    public DemoEmailMigrationRunner(DemoAccount demoAccount, UserRepository userRepository) {
        this.demoAccount = demoAccount;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        migrate();
    }

    /** Package-visible so the guard/round-trip can be tested without a full startup. */
    @Transactional
    void migrate() {
        if (!demoAccount.isEnabled()) {
            return; // feature off
        }
        if (demoAccount.email().equalsIgnoreCase(demoAccount.emailFrom())) {
            return; // nothing to move
        }
        if (userRepository.existsByEmail(demoAccount.email())) {
            return; // already renamed, or a fresh seed already used DEMO_EMAIL
        }
        userRepository.findByEmail(demoAccount.emailFrom()).ifPresent(user -> {
            user.setEmail(demoAccount.email());
            userRepository.save(user);
            log.info("Renamed the demo account to DEMO_EMAIL; its stores are kept.");
        });
    }
}
