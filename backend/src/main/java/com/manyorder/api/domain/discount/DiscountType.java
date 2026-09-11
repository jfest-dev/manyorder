package com.manyorder.api.domain.discount;

/** How a discount's value is interpreted. */
public enum DiscountType {
    /** value is a percent off the subtotal (1–100). */
    PERCENTAGE,
    /** value is a fixed amount off, in the store's currency. */
    FIXED,
    /** Waives the delivery fee for the order; value is unused. */
    FREE_DELIVERY
}
