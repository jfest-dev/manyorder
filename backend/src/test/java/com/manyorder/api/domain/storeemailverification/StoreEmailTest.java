package com.manyorder.api.domain.storeemailverification;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRole;

import static org.assertj.core.api.Assertions.assertThat;

/** The store-email verified rule and the alert-recipient list. */
class StoreEmailTest {

    private Merchant store(String ownerEmail, boolean ownerVerified, String storeEmail, String verifiedEmail) {
        User owner = new User("Owner", ownerEmail, "hash", UserRole.MERCHANT);
        owner.setVerified(ownerVerified);
        Merchant m = new Merchant(owner, "Shop", "shop", storeEmail, "123");
        m.setVerifiedEmail(verifiedEmail);
        return m;
    }

    @Test
    void verifiedWhenStoreEmailMatchesConfirmedValue() {
        assertThat(StoreEmail.isVerified(store("owner@x.com", false, "shop@x.com", "shop@x.com"))).isTrue();
    }

    @Test
    void verifiedWhenStoreEmailEqualsVerifiedOwnerLogin_butNotWhenOwnerUnverified() {
        assertThat(StoreEmail.isVerified(store("owner@x.com", true, "Owner@X.com", null))).isTrue();
        assertThat(StoreEmail.isVerified(store("owner@x.com", false, "owner@x.com", null))).isFalse();
    }

    @Test
    void unverifiedWhenNoMatch_orBlank() {
        assertThat(StoreEmail.isVerified(store("owner@x.com", true, "shop@x.com", null))).isFalse();
        assertThat(StoreEmail.isVerified(store("owner@x.com", true, "  ", null))).isFalse();
        assertThat(StoreEmail.isVerified(store("owner@x.com", true, null, null))).isFalse();
    }

    @Test
    void recipients_ownerAlways_storeOnlyWhenVerified_dedupedIgnoringCase() {
        // Verified distinct store email: both, owner first.
        assertThat(StoreEmail.alertRecipients(store("owner@x.com", true, "shop@x.com", "shop@x.com")))
                .containsExactly("owner@x.com", "shop@x.com");
        // Unverified store email: owner only.
        assertThat(StoreEmail.alertRecipients(store("owner@x.com", true, "shop@x.com", null)))
                .containsExactly("owner@x.com");
        // Blank store email: owner only.
        assertThat(StoreEmail.alertRecipients(store("owner@x.com", true, "", null)))
                .containsExactly("owner@x.com");
        // Store email same as owner (case-insensitive) and verified: deduped to one.
        List<String> same = StoreEmail.alertRecipients(store("Owner@X.com", true, "owner@x.com", null));
        assertThat(same).hasSize(1);
    }
}
