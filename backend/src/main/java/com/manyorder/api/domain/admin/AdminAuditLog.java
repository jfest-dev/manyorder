package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An immutable record of a Platform Admin action taken against a merchant's
 * account or data (suspend, unsuspend, edit, delete). Actor and target are
 * stored as plain snapshots (id + email/label), not foreign keys, so the log
 * survives deletion of the very rows it describes and can never cascade away.
 */
@Entity
@Table(name = "admin_audit_log")
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The admin who performed the action (snapshot, not a FK). */
    @Column(nullable = false)
    private Long actorUserId;

    @Column(nullable = false)
    private String actorEmail;

    /** Machine-readable action, e.g. SUSPEND_MERCHANT, DELETE_PRODUCT. */
    @Column(nullable = false, length = 64)
    private String action;

    /** What kind of thing was acted on, e.g. MERCHANT, PRODUCT, ORDER, CUSTOMER, DISCOUNT. */
    @Column(length = 32)
    private String targetType;

    /** Id of the acted-on row (null for actions without a single target). */
    private Long targetId;

    /** The store (merchant) the action is scoped to, so the log can be filtered
     *  per store. Set for every admin action (they are all store-scoped). */
    private Long merchantId;

    /** Human-readable context, e.g. the store name or product name at the time. */
    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    /** Whether an owner email was sent for this action (null for actions that never email). */
    @Column(name = "email_sent")
    private Boolean emailSent;

    protected AdminAuditLog() {
        // JPA only
    }

    public AdminAuditLog(Long actorUserId, String actorEmail, String action,
                         String targetType, Long targetId, Long merchantId, String detail) {
        this.actorUserId = actorUserId;
        this.actorEmail = actorEmail;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.merchantId = merchantId;
        this.detail = detail;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getActorUserId() { return actorUserId; }
    public String getActorEmail() { return actorEmail; }
    public String getAction() { return action; }
    public String getTargetType() { return targetType; }
    public Long getTargetId() { return targetId; }
    public Long getMerchantId() { return merchantId; }
    public String getDetail() { return detail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Boolean getEmailSent() { return emailSent; }
    public void setEmailSent(Boolean emailSent) { this.emailSent = emailSent; }
}
