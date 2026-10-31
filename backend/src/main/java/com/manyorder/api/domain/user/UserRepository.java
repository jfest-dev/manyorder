package com.manyorder.api.domain.user;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
// UserRole is in this same package.

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    /**
     * Load the account with its {@code staffStore} eagerly fetched. Used by the auth
     * filter so the resolved user can be reused for the whole request (including its
     * store association) without a second query or a lazy-load outside the session.
     */
    @EntityGraph(attributePaths = "staffStore")
    Optional<User> findWithStaffStoreByEmail(String email);

    boolean existsByEmail(String email);
    /** The platform admin, if one exists (there is at most one). */
    Optional<User> findFirstByRole(UserRole role);

    // --- Admin analytics funnel: the cohort of accounts that signed up within a
    //     half-open [from, to) range, and current-state counts for each later step. ---

    /** Accounts of a role created within the range (the funnel cohort / "signed up"). */
    long countByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole role, LocalDateTime from, LocalDateTime to);

    /** Of the cohort, those whose account is now verified. */
    long countByRoleAndVerifiedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole role, LocalDateTime from, LocalDateTime to);

    /** Of the cohort, those who own at least one store. */
    @Query("""
            SELECT COUNT(u) FROM User u
            WHERE u.role = :role AND u.createdAt >= :from AND u.createdAt < :to
              AND EXISTS (SELECT 1 FROM Merchant m WHERE m.owner = u)
            """)
    long countCohortWithStore(@Param("role") UserRole role, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Of the cohort, those who own a store that has at least one product. */
    @Query("""
            SELECT COUNT(u) FROM User u
            WHERE u.role = :role AND u.createdAt >= :from AND u.createdAt < :to
              AND EXISTS (SELECT 1 FROM Merchant m WHERE m.owner = u
                          AND EXISTS (SELECT 1 FROM Product p WHERE p.merchant = m))
            """)
    long countCohortWithProduct(@Param("role") UserRole role, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Of the cohort, those who own a store that has at least one order. */
    @Query("""
            SELECT COUNT(u) FROM User u
            WHERE u.role = :role AND u.createdAt >= :from AND u.createdAt < :to
              AND EXISTS (SELECT 1 FROM Merchant m WHERE m.owner = u
                          AND EXISTS (SELECT 1 FROM Order o WHERE o.merchant = m))
            """)
    long countCohortWithOrder(@Param("role") UserRole role, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}