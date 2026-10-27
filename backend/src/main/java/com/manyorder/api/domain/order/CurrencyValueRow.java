package com.manyorder.api.domain.order;

import java.math.BigDecimal;

/** Grouped order value for one currency: how much was recorded and over how many orders. */
public interface CurrencyValueRow {
    String getCurrency();
    BigDecimal getTotal();
    long getOrders();
}
