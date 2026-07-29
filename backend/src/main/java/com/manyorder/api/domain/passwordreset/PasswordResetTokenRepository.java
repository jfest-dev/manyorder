package com.manyorder.api.domain.passwordreset;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.manyorder.api.domain.user.User;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /** Rate-limit input: how many reset requests this user made since {@code cutoff}. */
    long countByUserAndCreatedAtAfter(User user, LocalDateTime cutoff);

    /**
     * Consume every still-outstanding token for a user in one statement — called
     * after a successful reset so any other links already in the user's inbox
     * stop working immediately.
     */
    @Modifying
    @Query("update PasswordResetToken t set t.usedAt = :now where t.user = :user and t.usedAt is null")
    void markAllUsedForUser(@Param("user") User user, @Param("now") LocalDateTime now);
}
