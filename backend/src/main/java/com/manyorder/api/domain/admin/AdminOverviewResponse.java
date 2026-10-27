package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * The admin Overview payload, assembled from grouped queries (no per-store loops).
 * Order value is only what merchants recorded on completed/delivered orders;
 * ManyOrder does not process payments, so this is reporting, not settlement.
 */
public record AdminOverviewResponse(
        List<CurrencyValue> valueLast30Days,
        List<CurrencyValue> valueAllTime,
        List<DayCount> ordersPerDay,
        List<TopStore> topStores,
        NeedsAttention needsAttention,
        List<NewStore> newestStores,
        List<AdminAuditLogResponse> recentActions) {

    /** Recorded order value and order count for one currency. */
    public record CurrencyValue(String currency, BigDecimal total, long orders) {}

    /** Orders placed on one calendar day. */
    public record DayCount(LocalDate date, long count) {}

    /** A store in the top-5-by-orders list. */
    public record TopStore(Long id, String name, String slug, String currency, long orders, BigDecimal value) {}

    /** A minimal store reference for the attention lists. */
    public record StoreRef(Long id, String name, String slug) {}

    /** One attention category: a capped sample plus the true total count. */
    public record AttentionGroup(long count, List<StoreRef> items) {}

    public record NeedsAttention(
            AttentionGroup unverifiedOwners,
            AttentionGroup noProducts,
            AttentionGroup noOrders30Days,
            AttentionGroup suspended) {}

    /** A newly created store with its owner and creation date. */
    public record NewStore(Long id, String name, String slug, String ownerName, LocalDateTime createdAt) {}
}
