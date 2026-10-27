package com.manyorder.api.domain.admin;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.user.User;

/**
 * Records Platform Admin actions to the audit log. {@link #record} participates
 * in the caller's transaction, so the log entry commits atomically with the
 * action it describes (a rolled-back action leaves no misleading audit row).
 */
@Service
public class AdminAuditService {

    private final AdminAuditLogRepository repository;

    public AdminAuditService(AdminAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public AdminAuditLog record(User actor, String action, String targetType,
                                Long targetId, Long merchantId, String detail) {
        return record(actor, action, targetType, targetId, merchantId, detail, null);
    }

    @Transactional
    public AdminAuditLog record(User actor, String action, String targetType,
                                Long targetId, Long merchantId, String detail, Boolean emailSent) {
        return record(actor, action, targetType, targetId, merchantId, detail, emailSent, null, null);
    }

    /**
     * Fullest form: also records the email-sent flag and snapshots of the store
     * name and the target label (product name, discount code) at the time, so the
     * Activity feed still reads correctly if the store or item is later renamed
     * or removed.
     */
    @Transactional
    public AdminAuditLog record(User actor, String action, String targetType, Long targetId, Long merchantId,
                                String detail, Boolean emailSent, String storeName, String targetLabel) {
        AdminAuditLog entry = new AdminAuditLog(
                actor.getId(), actor.getEmail(), action, targetType, targetId, merchantId, detail);
        entry.setActorName(actor.getFullName());
        entry.setEmailSent(emailSent);
        entry.setStoreName(storeName);
        entry.setTargetLabel(targetLabel);
        return repository.save(entry);
    }
}
