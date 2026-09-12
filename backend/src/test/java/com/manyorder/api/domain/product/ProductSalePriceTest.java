package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Sale-window logic on Product: effectivePriceAt/isOnSaleAt across the window
 * boundaries, including the after-end case that the save-time validation won't
 * let us persist through the API (so it's covered here directly).
 */
class ProductSalePriceTest {

    private Product product(BigDecimal base) {
        return new Product(null, "Item", "d", base);
    }

    private static final BigDecimal BASE = new BigDecimal("10.00");
    private static final BigDecimal SALE = new BigDecimal("6.00");
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 6, 1, 12, 0);

    @Test
    void noSalePrice_usesBase() {
        Product p = product(BASE);
        assertFalse(p.isOnSaleAt(NOW));
        assertEquals(BASE, p.effectivePriceAt(NOW));
    }

    @Test
    void activeWindow_usesSale() {
        Product p = product(BASE);
        p.setSalePrice(SALE);
        p.setSaleStartsAt(NOW.minusDays(1));
        p.setSaleEndsAt(NOW.plusDays(1));
        assertTrue(p.isOnSaleAt(NOW));
        assertEquals(SALE, p.effectivePriceAt(NOW));
    }

    @Test
    void beforeStart_scheduled_usesBase() {
        Product p = product(BASE);
        p.setSalePrice(SALE);
        p.setSaleStartsAt(NOW.plusDays(1)); // starts tomorrow
        assertFalse(p.isOnSaleAt(NOW));
        assertEquals(BASE, p.effectivePriceAt(NOW));
    }

    @Test
    void afterEnd_expired_revertsToBase() {
        Product p = product(BASE);
        p.setSalePrice(SALE);
        p.setSaleStartsAt(NOW.minusDays(2));
        p.setSaleEndsAt(NOW.minusDays(1)); // ended yesterday
        assertFalse(p.isOnSaleAt(NOW));
        assertEquals(BASE, p.effectivePriceAt(NOW)); // auto-reverts, no flag flip
    }

    @Test
    void openEndedBounds_active() {
        Product p = product(BASE);
        p.setSalePrice(SALE);
        // No start and no end = always on while a sale price is set.
        assertTrue(p.isOnSaleAt(NOW));
        assertEquals(SALE, p.effectivePriceAt(NOW));
    }
}
