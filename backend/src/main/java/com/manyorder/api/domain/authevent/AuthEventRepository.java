package com.manyorder.api.domain.authevent;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthEventRepository extends JpaRepository<AuthEvent, Long> {

    /** All events for one account, oldest first. */
    List<AuthEvent> findByUserIdOrderByIdAsc(Long userId);

    /** Count events of a type in the half-open range (e.g. failed sign-ins, locks, resets). */
    long countByEventTypeAndSuccessAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
            AuthEventType eventType, boolean success, LocalDateTime from, LocalDateTime to);

    /** Distinct accounts with a successful login in the half-open range (sign-ins / active owners). */
    @Query("""
            SELECT COUNT(DISTINCT e.userId) FROM AuthEvent e
            WHERE e.eventType = :type AND e.success = true AND e.userId IS NOT NULL
              AND e.occurredAt >= :from AND e.occurredAt < :to
            """)
    long countDistinctUsers(@Param("type") AuthEventType type,
                            @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Successful events of a type grouped by method in the range (e.g. sign-ups by method). */
    @Query("""
            SELECT e.method AS method, COUNT(e) AS count FROM AuthEvent e
            WHERE e.eventType = :type AND e.success = true
              AND e.occurredAt >= :from AND e.occurredAt < :to
            GROUP BY e.method
            """)
    List<MethodCount> countByMethod(@Param("type") AuthEventType type,
                                    @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Retention sweep: drop rows older than the cutoff. Returns how many were removed. */
    @Modifying
    @Query("DELETE FROM AuthEvent e WHERE e.occurredAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);

    /** Projection for {@link #countByMethod}. A null method groups as its own row. */
    interface MethodCount {
        AuthMethod getMethod();
        long getCount();
    }
}
