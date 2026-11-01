package com.manyorder.api.domain.authevent;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * An append-only, minimal, privacy-preserving record of an account or security event,
 * written by the app in its normal auth flows (not by the admin). It deliberately holds
 * NO IP addresses, NO passwords, NO tokens, and NO email address for failed attempts:
 * a failed login stores only its type, time, method and success, never which address
 * was tried. Rows older than 90 days are swept daily, so this is not a durable store
 * of personal history. It exists only to feed aggregate admin analytics.
 */
@Entity
@Table(name = "auth_events", indexes = {
        @Index(name = "idx_auth_events_occurred", columnList = "occurred_at"),
        @Index(name = "idx_auth_events_type_occurred", columnList = "event_type, occurred_at"),
        @Index(name = "idx_auth_events_user_occurred", columnList = "user_id, occurred_at"),
})
public class AuthEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private AuthEventType eventType;

    /** The sign-in/sign-up method where relevant; null otherwise. */
    @Enumerated(EnumType.STRING)
    @Column(name = "method")
    private AuthMethod method;

    @Column(nullable = false)
    private boolean success;

    /** The account this event belongs to, when known. Null for failed or unknown-email
     *  attempts (we never store which address was tried). Not a hard FK, so a later user
     *  deletion cannot fail on this append-only table. */
    @Column(name = "user_id")
    private Long userId;

    protected AuthEvent() {
        // JPA only
    }

    public AuthEvent(LocalDateTime occurredAt, AuthEventType eventType, AuthMethod method, boolean success, Long userId) {
        this.occurredAt = occurredAt;
        this.eventType = eventType;
        this.method = method;
        this.success = success;
        this.userId = userId;
    }

    public Long getId() { return id; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public AuthEventType getEventType() { return eventType; }
    public AuthMethod getMethod() { return method; }
    public boolean isSuccess() { return success; }
    public Long getUserId() { return userId; }
}
