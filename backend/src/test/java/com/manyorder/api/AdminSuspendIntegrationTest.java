package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.manyorder.api.domain.admin.AdminAuditLogRepository;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Admin suspend/unsuspend: hides the storefront, blocks owner login (and any
 * pre-suspension token), is PLATFORM_ADMIN-only, reversible, and audited.
 */
class AdminSuspendIntegrationTest extends IntegrationTestBase {

    @Autowired private AdminAuditLogRepository adminAuditLogRepository;

    private String adminToken() throws Exception {
        // Seeded platform admin (DataSeeder runs against the fresh test DB).
        return loginAndGetToken("admin@manyorder.app", "password123");
    }

    private void suspend(long storeId, String token, int expected) throws Exception {
        mockMvc.perform(post("/admin/merchants/" + storeId + "/suspend")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().is(expected));
    }

    @Test
    void suspend_hidesStorefront_blocksLogin_thenUnsuspendRestores() throws Exception {
        String admin = adminToken();
        String merchant = registerAndGetToken("suspend-me@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Suspend Test", "suspend-test-store");

        // Visible + owner can manage before suspension.
        mockMvc.perform(get("/public/stores/suspend-test-store")).andExpect(status().isOk());
        getWithToken("/merchant/stores/" + storeId + "/products", merchant, 200);

        // Suspend (admin only, 204).
        suspend(storeId, admin, 204);

        // Storefront hidden, guest offers hidden, owner login blocked (403), and the
        // still-valid pre-suspension token can no longer manage the store (404).
        mockMvc.perform(get("/public/stores/suspend-test-store")).andExpect(status().isNotFound());
        mockMvc.perform(get("/public/storefront/" + storeId + "/offers")).andExpect(status().isNotFound());
        mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", "suspend-me@test.com", "password", "password123"))))
                .andExpect(status().isForbidden());
        getWithToken("/merchant/stores/" + storeId + "/products", merchant, 404);

        // Audit row recorded.
        assertTrue(adminAuditLogRepository.findAllByOrderByCreatedAtDesc().stream()
                .anyMatch(l -> "SUSPEND_MERCHANT".equals(l.getAction()) && Long.valueOf(storeId).equals(l.getTargetId())),
                "suspend is audited");

        // Unsuspend restores storefront + login.
        mockMvc.perform(post("/admin/merchants/" + storeId + "/unsuspend")
                        .header("Authorization", "Bearer " + admin)).andExpect(status().isNoContent());
        mockMvc.perform(get("/public/stores/suspend-test-store")).andExpect(status().isOk());
        assertTrue(loginAndGetToken("suspend-me@test.com", "password123").length() > 0, "login works again");
        assertTrue(adminAuditLogRepository.findAllByOrderByCreatedAtDesc().stream()
                .anyMatch(l -> "UNSUSPEND_MERCHANT".equals(l.getAction()) && Long.valueOf(storeId).equals(l.getTargetId())),
                "unsuspend is audited");
    }

    @Test
    void suspend_isForbiddenForNonAdmins() throws Exception {
        String owner = registerAndGetToken("owner-x@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Owner X Store", "owner-x-store");
        String otherMerchant = registerAndGetToken("other-merchant@test.com", "MERCHANT", null);

        // A MERCHANT token cannot reach the admin endpoint at all (URL role gate → 403).
        suspend(storeId, otherMerchant, 403);
        suspend(storeId, owner, 403);
    }
}
