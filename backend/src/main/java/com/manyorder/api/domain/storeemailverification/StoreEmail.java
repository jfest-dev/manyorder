package com.manyorder.api.domain.storeemailverification;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.user.User;

/**
 * The store-email verification rule and the alert-recipient list, in one place.
 *
 * <p>The store email counts as verified when its normalized value equals the
 * store's confirmed {@code verifiedEmail}, or equals the owner's login email and
 * the owner's email is verified. Because it is a comparison, changing the store
 * email makes it unverified automatically with no backfill.
 */
public final class StoreEmail {

    private StoreEmail() {}

    /** Trimmed, lowercased, or null when blank. */
    public static String normalize(String raw) {
        if (raw == null) return null;
        String t = raw.trim().toLowerCase();
        return t.isEmpty() ? null : t;
    }

    /** True when the store's contact email is confirmed (directly, or via the verified owner login). */
    public static boolean isVerified(Merchant merchant) {
        String store = normalize(merchant.getEmail());
        if (store == null) return false;
        if (store.equals(merchant.getVerifiedEmail())) return true;
        User owner = merchant.getOwner();
        return owner != null && owner.isVerified() && store.equals(normalize(owner.getEmail()));
    }

    /**
     * Who order and low-stock alerts go to: always the owner's login email, plus
     * the store email only when it counts as verified, de-duplicated ignoring case.
     * A blank store email means the owner only.
     */
    public static List<String> alertRecipients(Merchant merchant) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        User owner = merchant.getOwner();
        if (owner != null && owner.getEmail() != null && !owner.getEmail().isBlank()) {
            seen.add(owner.getEmail().trim().toLowerCase());
            out.add(owner.getEmail().trim());
        }
        if (isVerified(merchant)) {
            String store = merchant.getEmail().trim();
            if (seen.add(store.toLowerCase())) out.add(store);
        }
        return out;
    }
}
