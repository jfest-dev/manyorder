package com.manyorder.api.domain.storeemailverification;

import java.time.LocalDateTime;

import com.manyorder.api.domain.merchant.Merchant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * A one-time token for confirming a store's contact email. Only the SHA-256 hash
 * of the token is stored, so a database leak cannot be used to confirm; the raw
 * token lives solely in the email. Mirrors the user email-verification token.
 */
@Entity
@Table(name = "store_email_verification_tokens")
public class StoreEmailVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    /** The normalized address the confirmation was sent to (drives the per-address cap and the result). */
    @Column(nullable = false)
    private String email;

    @Column(name = "token_hash", unique = true, nullable = false)
    private String tokenHash;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** Set when consumed; a non-null value means it can never be reused. */
    private LocalDateTime usedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    protected StoreEmailVerificationToken() {
        // JPA only
    }

    public StoreEmailVerificationToken(Merchant merchant, String email, String tokenHash, LocalDateTime expiresAt) {
        this.merchant = merchant;
        this.email = email;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = LocalDateTime.now();
    }

    public boolean isUsed() { return usedAt != null; }
    public boolean isExpired() { return expiresAt.isBefore(LocalDateTime.now()); }

    public Long getId() { return id; }
    public Merchant getMerchant() { return merchant; }
    public String getEmail() { return email; }
    public String getTokenHash() { return tokenHash; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public LocalDateTime getUsedAt() { return usedAt; }
    public void setUsedAt(LocalDateTime usedAt) { this.usedAt = usedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
