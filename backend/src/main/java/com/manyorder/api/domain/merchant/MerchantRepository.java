package com.manyorder.api.domain.merchant;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    // Public/staff slug lookup: a store must be neither archived (merchant closed
    // it) nor suspended (admin blocked it) to be reachable.
    Optional<Merchant> findBySlugAndArchivedAtIsNullAndSuspendedAtIsNull(String slug);

    /** True if this owner has at least one admin-suspended store (drives the login gate). */
    boolean existsByOwnerAndSuspendedAtIsNotNull(User owner);

    // Admin dashboard metrics.
    long countByArchivedAtIsNullAndSuspendedAtIsNull();   // active
    long countBySuspendedAtIsNotNull();                   // suspended
    long countByArchivedAtIsNotNull();                    // archived
    long countByCreatedAtAfter(java.time.LocalDateTime cutoff);
    java.util.List<Merchant> findAllByOrderByCreatedAtDesc();

    // --- Admin Overview ---

    /** The newest stores overall (Overview "newest stores"). */
    List<Merchant> findTop5ByOrderByCreatedAtDesc();

    /** Suspended stores, most-recently suspended first (Needs attention). */
    List<Merchant> findTop5BySuspendedAtIsNotNullOrderBySuspendedAtDesc();

    // Needs-attention categories: each returns a capped list plus a true total count.
    // Archived stores are excluded throughout (a closed store needs no attention).

    @Query("SELECT m FROM Merchant m WHERE m.owner.verified = false AND m.archivedAt IS NULL ORDER BY m.createdAt DESC")
    List<Merchant> findUnverifiedOwnerStores(Pageable pageable);
    @Query("SELECT COUNT(m) FROM Merchant m WHERE m.owner.verified = false AND m.archivedAt IS NULL")
    long countUnverifiedOwnerStores();

    @Query("SELECT m FROM Merchant m WHERE m.archivedAt IS NULL AND NOT EXISTS "
            + "(SELECT p FROM Product p WHERE p.merchant = m) ORDER BY m.createdAt DESC")
    List<Merchant> findStoresWithoutProducts(Pageable pageable);
    @Query("SELECT COUNT(m) FROM Merchant m WHERE m.archivedAt IS NULL AND NOT EXISTS "
            + "(SELECT p FROM Product p WHERE p.merchant = m)")
    long countStoresWithoutProducts();

    @Query("SELECT m FROM Merchant m WHERE m.archivedAt IS NULL AND m.suspendedAt IS NULL AND NOT EXISTS "
            + "(SELECT o FROM Order o WHERE o.merchant = m AND o.createdAt >= :since) ORDER BY m.createdAt DESC")
    List<Merchant> findActiveStoresWithoutRecentOrders(@Param("since") LocalDateTime since, Pageable pageable);
    @Query("SELECT COUNT(m) FROM Merchant m WHERE m.archivedAt IS NULL AND m.suspendedAt IS NULL AND NOT EXISTS "
            + "(SELECT o FROM Order o WHERE o.merchant = m AND o.createdAt >= :since)")
    long countActiveStoresWithoutRecentOrders(@Param("since") LocalDateTime since);

    /** Distinct non-blank business-type values across all stores, for the admin filter. */
    @Query("SELECT DISTINCT m.businessType FROM Merchant m WHERE m.businessType IS NOT NULL AND m.businessType <> '' ORDER BY m.businessType")
    List<String> findDistinctBusinessTypes();
}
