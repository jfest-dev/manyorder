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

    /** The latest entry of one action for one store (rate limit + "Reminded ago"). */
    java.util.Optional<AdminAuditLog> findTop1ByMerchantIdAndActionOrderByCreatedAtDesc(Long merchantId, String action);

    /** Latest createdAt of one action per store, over a set of stores (for the dashboard
     *  rows). Returns [merchantId, maxCreatedAt]. */
    @org.springframework.data.jpa.repository.Query("SELECT a.merchantId, MAX(a.createdAt) FROM AdminAuditLog a "
            + "WHERE a.action = :action AND a.merchantId IN :ids GROUP BY a.merchantId")
    List<Object[]> latestByMerchantIdInAndAction(@org.springframework.data.repository.query.Param("ids") List<Long> ids,
                                                 @org.springframework.data.repository.query.Param("action") String action);
}
