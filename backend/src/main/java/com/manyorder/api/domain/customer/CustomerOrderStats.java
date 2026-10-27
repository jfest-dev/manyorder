package com.manyorder.api.domain.customer;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Per-customer order aggregate, projected from the orders table. Cancelled
 * orders are excluded by the query, so these reflect real completed activity.
 */
public interface CustomerOrderStats {
    Long getCustomerId();
    long getOrderCount();
    BigDecimal getTotalSpent();
    LocalDateTime getFirstOrderAt();
    LocalDateTime getLastOrderAt();
}
