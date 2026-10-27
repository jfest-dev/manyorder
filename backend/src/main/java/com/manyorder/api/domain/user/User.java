package com.manyorder.api.domain.user;

import java.time.LocalDateTime;

import com.manyorder.api.domain.merchant.Merchant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullName;

    /** Optional contact phone for the account holder. Nullable so the column can be
     *  added to an existing users table without a backfill. */
    private String phone;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    /**
     * Whether the account's email address has been confirmed via a verification
     * link. Unverified accounts can still sign in (verification is a nag, not a
     * gate). The DB-level default lets the not-null column be added to a table
     * that already has rows (Postgres backfills existing users with false).
     */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean verified = false;

    /**
     * The single store a STAFF account is bound to.
     * Always null for MERCHANT and PLATFORM_ADMIN.
     */
    @ManyToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_store_id")
    private Merchant staffStore;

    private LocalDateTime createdAt;

    /**
     * Consecutive failed sign-in attempts since the last success. Nullable (treated
     * as zero when null) so the column can be added to a table that already has
     * rows. Only counted for existing accounts; reset on a successful sign-in or a
     * successful password reset.
     */
    @Column(nullable = true)
    private Integer failedLoginAttempts;

    /**
     * When set and in the future, sign-in is refused regardless of the password.
     * Nullable (no lock when null). Cleared on a successful sign-in or password
     * reset, and lazily when an expired lock is seen on the next failed attempt.
     */
    @Column(nullable = true)
    private LocalDateTime lockedUntil;

    /**
     * When the "account locked" email was last sent, used to cap it to one per
     * hour. Nullable (never sent yet). Not security-sensitive on its own.
     */
    @Column(nullable = true)
    private LocalDateTime lockedNoticeSentAt;

    protected User() {
        // JPA only
    }

    public User(String fullName, String email, String passwordHash, UserRole role) {
        this.fullName = fullName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setEmail(String email) { this.email = email; }
    public UserRole getRole() { return role; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    public Merchant getStaffStore() { return staffStore; }
    public void setStaffStore(Merchant staffStore) { this.staffStore = staffStore; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Integer getFailedLoginAttempts() { return failedLoginAttempts; }
    public void setFailedLoginAttempts(Integer failedLoginAttempts) { this.failedLoginAttempts = failedLoginAttempts; }
    public LocalDateTime getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(LocalDateTime lockedUntil) { this.lockedUntil = lockedUntil; }
    public LocalDateTime getLockedNoticeSentAt() { return lockedNoticeSentAt; }
    public void setLockedNoticeSentAt(LocalDateTime v) { this.lockedNoticeSentAt = v; }
}
