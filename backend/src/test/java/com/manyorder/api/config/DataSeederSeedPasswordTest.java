package com.manyorder.api.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Demo seeding has no built-in password. When SEED_DEMO is on but DEMO_PASSWORD is
 * unset, the seeder fails fast at startup with a message that names the variable and
 * the rule, and never a value. When SEED_DEMO is off, nothing is required.
 */
class DataSeederSeedPasswordTest {

    /** Seeder with the given flags and no collaborators: run() must decide before touching any. */
    private static DataSeeder seeder(boolean seedDemo, String demoPassword) {
        return new DataSeeder(null, null, null, null, null, null, null, null, seedDemo, demoPassword);
    }

    @Test
    void failsFastWhenSeedDemoOnButPasswordMissing() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> seeder(true, "").run());
        assertTrue(ex.getMessage().contains("DEMO_PASSWORD"), "message names the variable");
        assertTrue(ex.getMessage().contains("12 or more characters"), "message states the length rule");
        assertTrue(ex.getMessage().contains("no spaces"), "message states the no-spaces rule");
    }

    @Test
    void failsFastWhenPasswordIsNull() {
        assertThrows(IllegalStateException.class, () -> seeder(true, null).run());
    }

    @Test
    void doesNothingWhenSeedDemoOff() {
        assertDoesNotThrow(() -> seeder(false, "").run());
    }
}
