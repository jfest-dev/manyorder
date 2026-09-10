package com.manyorder.api.domain.product;

import com.manyorder.api.domain.merchant.Merchant;

/**
 * Notifies a merchant that a product has just dropped into low-stock territory.
 * Extracted behind an interface so tests can assert it fires (or doesn't)
 * without calling out.
 */
public interface LowStockMailer {

    /**
     * Send a low-stock alert to the store's contact address for one product that
     * has just crossed at or below the low-stock threshold. Implementations must
     * not throw — a send failure can never break the product save.
     */
    void sendLowStock(Merchant merchant, Product product, int stock);
}
