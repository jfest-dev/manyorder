package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    /** Most-recent-first, for an admin activity feed. */
    List<AdminAuditLog> findAllByOrderByCreatedAtDesc();
}
