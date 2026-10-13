package com.manyorder.api.domain.admin;

import com.manyorder.api.domain.merchant.Merchant;

/**
 * Emails a store owner when a platform admin takes an action against their store
 * (suspend, unsuspend, hide a product, switch off a discount), including the
 * written reason. Extracted behind an interface so tests can assert it fires.
 *
 * <p>Implementations must never throw: a failed send can never undo the action
 * that was already recorded.
 */
public interface MerchantActionMailer {

    enum Action {
        SUSPENDED("suspended your store"),
        UNSUSPENDED("reinstated your store"),
        PRODUCT_HIDDEN("hidden a product in your store"),
        DISCOUNT_DISABLED("switched off a discount in your store");

        private final String phrase;
        Action(String phrase) { this.phrase = phrase; }
        /** Static, developer-authored text (no user data), safe to drop into HTML as-is. */
        public String phrase() { return phrase; }
    }

    void notifyOwner(Merchant merchant, Action action, String reason);
}
