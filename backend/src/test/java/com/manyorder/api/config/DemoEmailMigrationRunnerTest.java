package com.manyorder.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The guarded, reversible demo-email rename. Renames only when DEMO_EMAIL is set, the
 * from-account exists and no to-account exists; keeps the account (same id, so its
 * stores stay); is reversible by swapping the values; does nothing when disabled; and
 * never touches another user.
 */
@SpringBootTest
class DemoEmailMigrationRunnerTest {

    @Autowired private UserRepository userRepository;

    private User createMerchant(String email) {
        User u = new User("Demo", email, "HASH", UserRole.MERCHANT);
        return userRepository.save(u);
    }

    private DemoEmailMigrationRunner runner(String demoEmail, String demoEmailFrom) {
        return new DemoEmailMigrationRunner(new DemoAccount(demoEmail, demoEmailFrom), userRepository);
    }

    @Test
    void renamesWhenGuarded_keepsSameId_andIsReversible() {
        String from = "mig-from@test.com";
        String to = "mig-to@test.com";
        Long id = createMerchant(from).getId();

        runner(to, from).migrate();
        assertTrue(userRepository.findByEmail(to).isPresent(), "renamed to DEMO_EMAIL");
        assertFalse(userRepository.findByEmail(from).isPresent(), "old email gone");
        assertEquals(id, userRepository.findByEmail(to).get().getId(), "same account id (stores kept)");

        // Reversible by swapping the two values.
        runner(from, to).migrate();
        assertTrue(userRepository.findByEmail(from).isPresent(), "renamed back");
        assertFalse(userRepository.findByEmail(to).isPresent(), "to email gone again");
        assertEquals(id, userRepository.findByEmail(from).get().getId());
    }

    @Test
    void doesNothingWhenDisabled() {
        String from = "mig-disabled@test.com";
        createMerchant(from);
        runner("", from).migrate();
        assertTrue(userRepository.findByEmail(from).isPresent(), "unchanged when DEMO_EMAIL is empty");
    }

    @Test
    void doesNothingWhenTargetAlreadyExists() {
        String from = "mig-both-from@test.com";
        String to = "mig-both-to@test.com";
        createMerchant(from);
        Long toId = createMerchant(to).getId();

        runner(to, from).migrate();
        // The from-account is left as-is and the existing to-account is untouched.
        assertTrue(userRepository.findByEmail(from).isPresent(), "from untouched");
        assertEquals(toId, userRepository.findByEmail(to).get().getId(), "existing target untouched");
    }

    @Test
    void neverTouchesAnotherUser() {
        String from = "mig-solo-from@test.com";
        String to = "mig-solo-to@test.com";
        String other = "mig-other@test.com";
        createMerchant(from);
        Long otherId = createMerchant(other).getId();

        runner(to, from).migrate();
        assertEquals(otherId, userRepository.findByEmail(other).get().getId(), "unrelated user untouched");
    }
}
