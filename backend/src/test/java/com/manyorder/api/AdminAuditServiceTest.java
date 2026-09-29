package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.manyorder.api.domain.admin.AdminAuditLog;
import com.manyorder.api.domain.admin.AdminAuditLogRepository;
import com.manyorder.api.domain.admin.AdminAuditService;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The audit log records who did what to which target, as an immutable snapshot. */
class AdminAuditServiceTest extends IntegrationTestBase {

    @Autowired private AdminAuditService adminAuditService;
    @Autowired private AdminAuditLogRepository adminAuditLogRepository;
    @Autowired private UserRepository userRepository;

    @Test
    void record_writesAnImmutableSnapshotOfTheAction() {
        User admin = userRepository.save(
                new User("Platform Admin", "audit-actor@test.com", "x", UserRole.PLATFORM_ADMIN));

        AdminAuditLog saved = adminAuditService.record(
                admin, "SUSPEND_MERCHANT", "MERCHANT", 4242L, "Kiri Brew");

        assertNotNull(saved.getId(), "row is persisted");
        assertNotNull(saved.getCreatedAt(), "timestamp is stamped");
        assertEquals(admin.getId(), saved.getActorUserId());
        assertEquals("audit-actor@test.com", saved.getActorEmail(), "actor email snapshotted");
        assertEquals("SUSPEND_MERCHANT", saved.getAction());
        assertEquals("MERCHANT", saved.getTargetType());
        assertEquals(4242L, saved.getTargetId());
        assertEquals("Kiri Brew", saved.getDetail());

        // Reloadable by id, and appears in the most-recent-first feed.
        AdminAuditLog reloaded = adminAuditLogRepository.findById(saved.getId()).orElseThrow();
        assertEquals("SUSPEND_MERCHANT", reloaded.getAction());
        assertTrue(adminAuditLogRepository.findAllByOrderByCreatedAtDesc().stream()
                .anyMatch(l -> l.getId().equals(saved.getId())), "shows in the audit feed");
    }
}
