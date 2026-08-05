package com.manyorder.api.domain.order;

/**
 * How an order was placed. MANUAL = created by the merchant (dashboard);
 * STOREFRONT = placed by a customer through the public storefront checkout.
 * Not read by any feature yet — the column exists so storefront orders are
 * tagged correctly from the start, no migration needed later.
 */
public enum OrderSource {
    MANUAL,
    STOREFRONT
}
