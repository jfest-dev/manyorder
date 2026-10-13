package com.manyorder.api.domain.order;

import java.math.BigDecimal;

/** A store ranked by order count in a window, with its recorded order value. */
public interface TopStoreRow {
    Long getId();
    String getName();
    String getSlug();
    String getCurrency();
    long getOrders();
    BigDecimal getValue();
}
