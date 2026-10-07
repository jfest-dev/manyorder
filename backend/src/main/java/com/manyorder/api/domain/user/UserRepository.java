package com.manyorder.api.domain.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
// UserRole is in this same package.

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    /** The platform admin, if one exists (there is at most one). */
    Optional<User> findFirstByRole(UserRole role);
}