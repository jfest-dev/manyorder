package com.manyorder.api.domain.discount;

/**
 * Why a code does (or does not) apply to a cart, as a structured reason the
 * storefront renders into its own currency-aware, human wording. Keeping the
 * reason structured (code + amount + productName) rather than a server-built
 * sentence lets the client format money in the store's currency ("S$12.50",
 * "Rp 12.500") from one source of truth, and show several reasons at once.
 */
public enum DiscountReasonCode {
    /** The merchant switched the code off. */
    INACTIVE,
    /** The code's start date is in the future. */
    NOT_STARTED,
    /** The code's end date has passed. */
    EXPIRED,
    /** The code hit its total-redemptions limit. */
    USAGE_LIMIT,
    /** Valid on a customer's first order only, and this isn't one. */
    FIRST_ORDER_ONLY,
    /** Cart subtotal is below the minimum; {@code amount} = how much more to spend. */
    MIN_SPEND,
    /** None of the code's products are in the cart; {@code productName} = the scope label. */
    PRODUCT_SCOPE,
    /** The matching items are all on sale and the code can't stack with a sale. */
    SALE_CONFLICT,
    /** A delivery code on a pickup order. */
    DELIVERY_ONLY,
    /** A partial delivery code, but the delivery fee is still to be confirmed. */
    DELIVERY_PENDING,
    /** A delivery code, but delivery is already free on this order. */
    DELIVERY_ALREADY_FREE,
    /** No such code at this store (the only reason revealed for an unknown code). */
    INVALID
}
