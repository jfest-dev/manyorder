package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Range-scoped admin analytics. Every number follows the selected range, whose
 * day boundaries are in Asia/Singapore (see {@link AdminMetricsRange}). The admin
 * stays read-only: this is assembled from grouped GET queries only.
 *
 * <p>Cross-currency figures are never summed into one total: merchants record in
 * different currencies, so order value is grouped per currency. {@code previous*}
 * fields carry the equal-length preceding window when compare mode is on, else null.
 */
public record AdminAnalyticsResponse(
        Window window,
        Orders orders,
        Stores stores,
        Funnel funnel,
        Snapshot snapshot,
        Map<String, Long> timingsMs) {

    /** The resolved range, echoed back so the client never does the zone math. */
    public record Window(
            String range,          // the named range, or "custom"
            LocalDate fromDate,    // inclusive first SGT day
            LocalDate toDate,      // inclusive last SGT day
            String fromUtc,        // half-open [fromUtc, toUtc) in UTC, ISO-8601
            String toUtc,
            boolean compare,
            String prevFromUtc,    // null unless compare and a previous period exists
            String prevToUtc) {}

    /** Recorded value and order count for one currency (revenue statuses only), with
     *  its average order value. {@code previousValue}/{@code previousOrders} are null
     *  outside compare mode. */
    public record CurrencyValue(
            String currency,
            long orders,
            BigDecimal value,
            BigDecimal averageOrderValue,
            Long previousOrders,
            BigDecimal previousValue) {}

    /** Orders on one SGT calendar day. */
    public record DayCount(LocalDate date, long count) {}

    public record TopStore(Long id, String name, String slug, String currency, long orders, BigDecimal value) {}

    public record Orders(
            long total,
            Long previousTotal,
            List<CurrencyValue> byCurrency,
            List<DayCount> byDay,
            Map<String, Long> byStatus,
            long delivery,
            long pickup,
            long guest,          // placed through storefront checkout (OrderSource.STOREFRONT)
            long cancelled,
            long withDiscount,   // carried a discount code
            List<TopStore> topStores) {}

    public record Stores(
            long newInRange,
            Long previousNewInRange,
            long active,         // current snapshot, not range-scoped
            long suspended,
            long archived,
            long firstProductInRange,  // earliest product landed in this range
            long firstOrderInRange) {} // earliest order landed in this range

    /** One funnel step and its drop-off from the previous step (null for the first). */
    public record FunnelStep(String step, long count, Double retentionFromPrev) {}

    /** Cohort funnel for merchant accounts that signed up within the range. Current-state
     *  counts (did they, by now, verify / create a store / add a product / get an order). */
    public record Funnel(List<FunnelStep> steps) {}

    /** Point-in-time figures that are not range-scoped, labelled as such for the client. */
    public record Snapshot(long outOfStockProducts) {}
}
