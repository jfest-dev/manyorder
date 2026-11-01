package com.manyorder.api.domain.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.manyorder.api.domain.admin.AdminMetricsRange.Named;
import com.manyorder.api.domain.admin.AdminMetricsRange.Window;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SGT (UTC+8) range resolution to UTC bounds, including the day boundary (an event
 * late in the UTC evening belongs to the next SGT day), and the equal-length
 * previous-period window.
 */
class AdminMetricsRangeTest {

    // 2026-03-10 18:30 UTC = 2026-03-11 02:30 SGT, so the SGT day is the 11th.
    private static final Instant NOW = Instant.parse("2026-03-10T18:30:00Z");

    @Test
    void today_isTheSgtCalendarDay_notTheUtcDay() {
        Window w = AdminMetricsRange.resolve(Named.TODAY, NOW);
        // SGT 2026-03-11 00:00 == 2026-03-10 16:00 UTC; next day == 2026-03-11 16:00 UTC.
        assertEquals(LocalDateTime.of(2026, 3, 10, 16, 0), w.fromUtc());
        assertEquals(LocalDateTime.of(2026, 3, 11, 16, 0), w.toUtc());
        // previous period = the SGT day before, equal length (24h).
        assertEquals(LocalDateTime.of(2026, 3, 9, 16, 0), w.prevFromUtc());
        assertEquals(LocalDateTime.of(2026, 3, 10, 16, 0), w.prevToUtc());
    }

    @Test
    void yesterday_isTheWholePriorSgtDay() {
        Window w = AdminMetricsRange.resolve(Named.YESTERDAY, NOW);
        assertEquals(LocalDateTime.of(2026, 3, 9, 16, 0), w.fromUtc());
        assertEquals(LocalDateTime.of(2026, 3, 10, 16, 0), w.toUtc());
    }

    @Test
    void sevenDays_spansSevenSgtDaysIncludingToday() {
        Window w = AdminMetricsRange.resolve(Named.D7, NOW);
        // today is the 11th SGT; 7 days incl today => starts the 5th SGT 00:00.
        assertEquals(LocalDateTime.of(2026, 3, 4, 16, 0), w.fromUtc()); // SGT 2026-03-05 00:00
        assertEquals(LocalDateTime.of(2026, 3, 11, 16, 0), w.toUtc());
        assertEquals(7 * 24, java.time.Duration.between(w.fromUtc(), w.toUtc()).toHours());
        assertEquals(7 * 24, java.time.Duration.between(w.prevFromUtc(), w.prevToUtc()).toHours());
    }

    @Test
    void thirtyDays_spansThirtySgtDays() {
        Window w = AdminMetricsRange.resolve(Named.D30, NOW);
        assertEquals(30 * 24, java.time.Duration.between(w.fromUtc(), w.toUtc()).toHours());
    }

    @Test
    void allTime_hasNoPreviousPeriod() {
        Window w = AdminMetricsRange.resolve(Named.ALL, NOW);
        assertFalse(w.hasPrevious());
        assertEquals(LocalDateTime.of(2026, 3, 11, 16, 0), w.toUtc());
    }

    @Test
    void custom_isInclusiveOfBothEndSgtDays() {
        Window w = AdminMetricsRange.resolveCustom(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 3));
        assertEquals(LocalDateTime.of(2026, 2, 28, 16, 0), w.fromUtc()); // SGT 2026-03-01 00:00
        assertEquals(LocalDateTime.of(2026, 3, 3, 16, 0), w.toUtc());    // SGT 2026-03-04 00:00 (end-inclusive)
        assertEquals(3 * 24, java.time.Duration.between(w.fromUtc(), w.toUtc()).toHours());
        assertTrue(w.hasPrevious());
    }

    @Test
    void custom_rejectsReversedAndOverlongSpans() {
        assertThrows(IllegalArgumentException.class,
                () -> AdminMetricsRange.resolveCustom(LocalDate.of(2026, 3, 3), LocalDate.of(2026, 3, 1)));
        assertThrows(IllegalArgumentException.class,
                () -> AdminMetricsRange.resolveCustom(LocalDate.of(2024, 1, 1), LocalDate.of(2026, 1, 1)));
    }

    @Test
    void today_atAYearEnd_rollsIntoTheNextSgtYear() {
        // 2026-12-31 16:30 UTC = 2027-01-01 00:30 SGT, so the SGT day is New Year's Day.
        Instant yearEnd = Instant.parse("2026-12-31T16:30:00Z");
        Window w = AdminMetricsRange.resolve(Named.TODAY, yearEnd);
        assertEquals(LocalDateTime.of(2026, 12, 31, 16, 0), w.fromUtc()); // SGT 2027-01-01 00:00
        assertEquals(LocalDateTime.of(2027, 1, 1, 16, 0), w.toUtc());     // SGT 2027-01-02 00:00
        assertEquals(LocalDateTime.of(2026, 12, 30, 16, 0), w.prevFromUtc());
    }

    @Test
    void today_atAMonthEnd_rollsIntoTheNextSgtMonth() {
        // 2026-03-31 16:30 UTC = 2026-04-01 00:30 SGT, so the SGT day is the 1st of April.
        Instant monthEnd = Instant.parse("2026-03-31T16:30:00Z");
        Window w = AdminMetricsRange.resolve(Named.TODAY, monthEnd);
        assertEquals(LocalDateTime.of(2026, 3, 31, 16, 0), w.fromUtc()); // SGT 2026-04-01 00:00
        assertEquals(LocalDateTime.of(2026, 4, 1, 16, 0), w.toUtc());    // SGT 2026-04-02 00:00
    }

    @Test
    void custom_spanningAMonthAndYearEnd_hasCorrectBounds() {
        Window w = AdminMetricsRange.resolveCustom(LocalDate.of(2026, 12, 30), LocalDate.of(2027, 1, 2));
        assertEquals(LocalDateTime.of(2026, 12, 29, 16, 0), w.fromUtc()); // SGT 2026-12-30 00:00
        assertEquals(LocalDateTime.of(2027, 1, 2, 16, 0), w.toUtc());     // SGT 2027-01-03 00:00 (end-inclusive)
        assertEquals(4 * 24, java.time.Duration.between(w.fromUtc(), w.toUtc()).toHours());
    }

    @Test
    void parse_acceptsTheNamedTokens() {
        assertEquals(Named.TODAY, AdminMetricsRange.parse("today"));
        assertEquals(Named.D7, AdminMetricsRange.parse("7d"));
        assertEquals(Named.ALL, AdminMetricsRange.parse("ALL"));
        assertThrows(IllegalArgumentException.class, () -> AdminMetricsRange.parse("week"));
    }
}
