package com.manyorder.api.domain.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
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
}