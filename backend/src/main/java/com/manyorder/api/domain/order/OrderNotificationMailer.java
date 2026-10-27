package com.manyorder.api.domain.order;

import java.util.List;

import com.manyorder.api.domain.merchant.Merchant;

/**
 * Notifies a merchant that a new storefront order came in. Extracted behind an
 * interface so tests can assert it fires (or doesn't) without calling out.
 */
public interface OrderNotificationMailer {

    /**
     * Send a "new order" email to the store's contact address. {@code orders}
     * is the group from one checkout (one order, or a ready + pre-order split).
     * Implementations must not throw — a send failure can never break checkout.
     */
    void sendNewOrder(Merchant merchant, List<Order> orders);
}
