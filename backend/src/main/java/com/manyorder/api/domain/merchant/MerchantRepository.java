package com.manyorder.api.domain.merchant;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.user.User;

public interface MerchantRepository extends JpaRepository<Merchant, Long> {
    List<Merchant> findByOwnerOrderByCreatedAtAsc(User owner);
    long countByOwner(User owner);
    Optional<Merchant> findBySlug(String slug);
    // existsBySlug intentionally scans ALL rows (incl. archived) so a slug
    // stays reserved after archiving and can never be reassigned.
    boolean existsBySlug(String slug);

    // Active-only variants: archived stores are excluded from listing, the
    // store-limit count, and public/staff slug lookups.
    List<Merchant> findByOwnerAndArchivedAtIsNullOrderByCreatedAtAsc(User owner);
    long countByOwnerAndArchivedAtIsNull(User owner);
    Optional<Merchant> findBySlugAndArchivedAtIsNull(String slug);
}
