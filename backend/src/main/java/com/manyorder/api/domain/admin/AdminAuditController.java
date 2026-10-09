package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only admin audit log. Newest first, optionally filtered to one store via
 * {@code ?storeId=}. PLATFORM_ADMIN-only (SecurityConfig gates /admin/**).
 */
@RestController
@RequestMapping("/admin/audit-log")
public class AdminAuditController {

    private final AdminAuditLogRepository repository;

    public AdminAuditController(AdminAuditLogRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<AdminAuditLogResponse> list(@RequestParam(required = false) Long storeId) {
        List<AdminAuditLog> rows = storeId != null
                ? repository.findByMerchantIdOrderByCreatedAtDesc(storeId)
                : repository.findAllByOrderByCreatedAtDesc();
        return rows.stream().map(AdminAuditLogResponse::from).toList();
    }
}
