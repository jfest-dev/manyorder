package com.manyorder.api.domain.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

/**
 * Resolves an admin-analytics date range to UTC bounds, with all day boundaries in
 * Asia/Singapore (UTC+8, fixed), never the server or viewer zone. A "day" is an SGT
 * calendar day: a late-evening UTC event falls on the next SGT day.
 *
 * <p>Windows are half-open [from, to) in the entities' timestamp space (UTC
 * LocalDateTime, matching how created_at is stored). The previous-period window is
 * the immediately preceding window of equal length, for compare mode; ALL has none.
 */
public final class AdminMetricsRange {

    public static final ZoneId SGT = ZoneId.of("Asia/Singapore");
    /** Cap a custom span so a query can't scan an unbounded range. */
    public static final int MAX_CUSTOM_DAYS = 366;

    public enum Named { TODAY, YESTERDAY, D7, D30, ALL }

    /** Half-open [from, to) in UTC (as LocalDateTime), plus the equal-length window
     *  immediately before it (null for ALL, which has no comparison). */
    public record Window(LocalDateTime fromUtc, LocalDateTime toUtc, LocalDateTime prevFromUtc, LocalDateTime prevToUtc) {
        public boolean hasPrevious() { return prevFromUtc != null; }
    }

    private AdminMetricsRange() {}

    /** SGT start-of-day for the given SGT date, as a UTC LocalDateTime. */
    private static LocalDateTime startUtc(LocalDate sgtDate) {
        ZonedDateTime sgtMidnight = sgtDate.atStartOfDay(SGT);
        return sgtMidnight.withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private static Window withPrevious(LocalDateTime from, LocalDateTime to) {
        long seconds = java.time.Duration.between(from, to).getSeconds();
        return new Window(from, to, from.minusSeconds(seconds), from);
    }

    /** Resolve a named range against a reference instant (usually Instant.now()). */
    public static Window resolve(Named named, Instant now) {
        LocalDate today = now.atZone(SGT).toLocalDate();
        LocalDateTime startToday = startUtc(today);
        LocalDateTime startTomorrow = startUtc(today.plusDays(1));
        return switch (named) {
            case TODAY -> withPrevious(startToday, startTomorrow);
            case YESTERDAY -> withPrevious(startUtc(today.minusDays(1)), startToday);
            case D7 -> withPrevious(startUtc(today.minusDays(6)), startTomorrow);
            case D30 -> withPrevious(startUtc(today.minusDays(29)), startTomorrow);
            // ALL: from the epoch to the end of today SGT; no meaningful previous period.
            case ALL -> new Window(startUtc(LocalDate.of(1970, 1, 1)), startTomorrow, null, null);
        };
    }

    /**
     * Resolve an inclusive custom range of SGT calendar days: from 00:00 of
     * {@code fromDate} to 00:00 of the day after {@code toDate} (so {@code toDate}
     * is fully included). Rejects a reversed or too-long span.
     */
    public static Window resolveCustom(LocalDate fromDate, LocalDate toDate) {
        if (fromDate == null || toDate == null) {
            throw new IllegalArgumentException("Both from and to dates are required.");
        }
        if (toDate.isBefore(fromDate)) {
            throw new IllegalArgumentException("The end date must not be before the start date.");
        }
        if (fromDate.plusDays(MAX_CUSTOM_DAYS).isBefore(toDate)) {
            throw new IllegalArgumentException("The range is too long (max " + MAX_CUSTOM_DAYS + " days).");
        }
        return withPrevious(startUtc(fromDate), startUtc(toDate.plusDays(1)));
    }

    /** Parse a named range token (today|yesterday|7d|30d|all), case-insensitive. */
    public static Named parse(String token) {
        return switch (token == null ? "" : token.trim().toLowerCase()) {
            case "today" -> Named.TODAY;
            case "yesterday" -> Named.YESTERDAY;
            case "7d" -> Named.D7;
            case "30d" -> Named.D30;
            case "all" -> Named.ALL;
            default -> throw new IllegalArgumentException("Unknown range: " + token);
        };
    }
}
