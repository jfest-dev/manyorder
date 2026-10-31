package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A lightweight per-order projection for admin analytics: just the fields the
 * range aggregates need, so a range scan returns small rows and the grouping
 * (per currency, per SGT day, by status/type/source) happens in one pass in memory.
 */
public interface OrderFactRow {
    LocalDateTime getCreatedAt();
    OrderStatus getStatus();
    OrderType getOrderType();
    OrderSource getSource();
    String getCurrency();
    BigDecimal getTotalAmount();
    String getDiscountCode();
    Long getMerchantId();
    String getMerchantName();
    String getMerchantSlug();
}
