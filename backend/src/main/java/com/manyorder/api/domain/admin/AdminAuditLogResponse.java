package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;

/** One audit-log row for the admin UI. No actor password or token is ever included. */
public record AdminAuditLogResponse(
        Long id,
        String actorEmail,
        String action,
        String targetType,
        Long targetId,
        Long merchantId,
        String detail,
        LocalDateTime createdAt,
        Boolean emailSent,
        String storeName,
        String targetLabel) {

    public static AdminAuditLogResponse from(AdminAuditLog log) {
        return new AdminAuditLogResponse(
                log.getId(), log.getActorEmail(), log.getAction(), log.getTargetType(),
                log.getTargetId(), log.getMerchantId(), log.getDetail(), log.getCreatedAt(), log.getEmailSent(),
                log.getStoreName(), log.getTargetLabel());
    }
}
