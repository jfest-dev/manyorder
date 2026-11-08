package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * The redesigned admin dashboard, in plain sections: what happened in the chosen dates,
 * what needs action right now, where people drop off, and the right-now snapshot. Every
 * number can point at the store or person behind it. The admin stays read-only.
 *
 * <p>Date-range sections carry the previous equal-length period for the up/down arrows.
 * The right-now section ignores the dates. "More details" (the technical breakdowns)
 * stays on the existing analytics endpoint.
 */
public record AdminDashboardResponse(
        Window window,
        Happened happened,
        List<ActionItem> needsAction,
        List<DropStep> dropOff,
        RightNow rightNow,
        Map<String, Long> timingsMs) {

    /** The resolved date range, echoed back (dates are Singapore calendar days). */
    public record Window(String range, String fromDate, String toDate, String fromUtc, String toUtc,
                         String previousFromUtc, String previousToUtc) {}

    /** A current value with the previous period's value for an up/down arrow (previous is
     *  null only when there is no comparable previous period). */
    public record Trend(long current, Long previous) {}

    public record CurrencySales(String currency, BigDecimal value, BigDecimal previousValue) {}

    /** One store in the "what happened" table. */
    public record StoreRow(Long id, String name, String slug, String currency, long orders,
                           BigDecimal sales, String lastOrderAt) {}

    /** One recent order in the "latest orders" list. */
    public record OrderRow(Long id, Long storeId, String storeName, String at, BigDecimal amount,
                           String currency, String status) {}

    public record Happened(
            Trend orders,
            List<CurrencySales> sales,
            Trend signUps,
            Trend signIns,
            List<StoreRow> stores,
            List<OrderRow> latestOrders) {}

    /** One row in "needs your action": the rule {@code kind} (whose plain-words problem and
     *  action live in the frontend strings file) and the store or person it names. */
    /** ownerEmail/ownerPhone are the store owner's contact for the reminder buttons
     *  (null for a row with no store); lastRemindedAt is the ISO time of the last
     *  owner reminder for this store, from the audit log (null if never). */
    public record ActionItem(String kind, String name, Long storeId, Long userId,
                             String ownerEmail, String ownerPhone, String lastRemindedAt) {
        public ActionItem(String kind, String name, Long storeId, Long userId) {
            this(kind, name, storeId, userId, null, null, null);
        }
    }

    /** One funnel step: how many reached it, and (where it is not the last step) the stores or
     *  people who got this far but no further. */
    public record DropStep(String step, long count, List<Entity> stuck) {}

    public record Entity(String kind, Long id, String name) {}

    /** The right-now snapshot (ignores the dates). */
    public record RightNow(long activeStores, long suspendedStores, long protectedStores,
                           long ownersActive7Days, long ownersActive30Days) {}
}
