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

    /** As {@link #record}, also noting whether an owner email was sent (null = not applicable). */
    @Transactional
    public AdminAuditLog record(User actor, String action, String targetType,
                                Long targetId, Long merchantId, String detail, Boolean emailSent) {
        AdminAuditLog entry = new AdminAuditLog(
                actor.getId(), actor.getEmail(), action, targetType, targetId, merchantId, detail);
        entry.setEmailSent(emailSent);
        return repository.save(entry);
    }
}
