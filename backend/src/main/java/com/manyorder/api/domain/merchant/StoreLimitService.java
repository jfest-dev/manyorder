package com.manyorder.api.domain.merchant;

import org.springframework.stereotype.Service;

import com.manyorder.api.domain.user.User;

/**
 * Single source of truth for how many active (non-archived) stores an owner may
 * have. Every place that must enforce the cap — store creation today, and a
 * future restore path — goes through here, so raising the limit for a future
 * paid tier is a one-line change in {@link #maxActiveStores(User)} rather than a
 * scatter-gun edit across controllers. Nothing paid-tier exists yet.
 */
@Service
public class StoreLimitService {

    private final MerchantRepository merchantRepository;

    public StoreLimitService(MerchantRepository merchantRepository) {
        this.merchantRepository = merchantRepository;
    }

    /** The maximum number of active stores this owner is allowed. */
    public int maxActiveStores(User owner) {
        return Merchant.MAX_STORES_PER_OWNER;
    }

    /** How many active (non-archived) stores the owner currently has. */
    public long activeStoreCount(User owner) {
        return merchantRepository.countByOwnerAndArchivedAtIsNull(owner);
    }

    /**
     * Whether the owner is already at (or over) their active-store cap — i.e.
     * whether adding one more active store (by creating or restoring) must be
     * rejected. The one checkpoint every caller consults.
     */
    public boolean isAtActiveStoreLimit(User owner) {
        return activeStoreCount(owner) >= maxActiveStores(owner);
    }
}
