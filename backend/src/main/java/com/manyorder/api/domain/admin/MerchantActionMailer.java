package com.manyorder.api.domain.admin;

import com.manyorder.api.domain.merchant.Merchant;

/**
 * Emails a store owner when a platform admin acts on their store, on the shared
 * email layout. Restricting actions (suspend, hide a product, switch off a
 * discount) always email and carry a reason; restoring actions (unsuspend,
 * unhide, switch on) email by default with an optional reason.
 *
 * <p>Implementations never throw: a failed send can never undo the action. The
 * return value says whether an email was actually dispatched, for the audit log.
 */
public interface MerchantActionMailer {

    enum Action {
        SUSPENDED(true, "Your store %s has been suspended", "Your store has been suspended",
                "Your store has been suspended and is no longer visible to customers."),
        UNSUSPENDED(false, "Your store %s is active again", "Your store is active again",
                "Good news: your store is active again and visible to customers."),
        PRODUCT_HIDDEN(true, "A product on %s was hidden", "A product was hidden",
                "A product in your store was hidden and is no longer visible to customers."),
        PRODUCT_SHOWN(false, "A product on %s is visible again", "A product is visible again",
                "A product in your store is visible to customers again."),
        DISCOUNT_DISABLED(true, "A discount on %s was switched off", "A discount was switched off",
                "A discount in your store was switched off and can no longer be used."),
        DISCOUNT_ENABLED(false, "A discount on %s is active again", "A discount is active again",
                "A discount in your store is active again.");

        private final boolean restricting;
        private final String subjectFormat;
        private final String whatHappened;
        private final String intro;

        Action(boolean restricting, String subjectFormat, String whatHappened, String intro) {
            this.restricting = restricting;
            this.subjectFormat = subjectFormat;
            this.whatHappened = whatHappened;
            this.intro = intro;
        }

        public boolean restricting() { return restricting; }
        public String subject(String storeName) { return subjectFormat.formatted(storeName); }
        public String whatHappened() { return whatHappened; }
        public String intro() { return intro; }
    }

    /** Send the notice. Returns true if an email was actually dispatched. */
    boolean notifyOwner(Merchant merchant, Action action, String reason);
}
