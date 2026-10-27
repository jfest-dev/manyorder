package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    /** Most-recent-first, for an admin activity feed. */
    List<AdminAuditLog> findAllByOrderByCreatedAtDesc();

    /** The latest admin actions across all stores, for the Overview. */
    List<AdminAuditLog> findTop5ByOrderByCreatedAtDesc();

    /** Most-recent-first, limited to one store's actions. */
    List<AdminAuditLog> findByMerchantIdOrderByCreatedAtDesc(Long merchantId);

    /** The latest actions for one store, for the store-detail "recent activity". */
    List<AdminAuditLog> findTop20ByMerchantIdOrderByCreatedAtDesc(Long merchantId);
}
