package com.manyorder.api.domain.storeemailverification;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.merchant.Merchant;

public interface StoreEmailVerificationTokenRepository extends JpaRepository<StoreEmailVerificationToken, Long> {

    Optional<StoreEmailVerificationToken> findByTokenHash(String tokenHash);

    /** Per-store rate limit: how many confirmations this store sent recently. */
    long countByMerchantAndCreatedAtAfter(Merchant merchant, LocalDateTime after);

    /** Per-address daily cap: how many confirmations went to this address platform-wide recently. */
    long countByEmailAndCreatedAtAfter(String email, LocalDateTime after);
}
