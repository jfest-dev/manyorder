package com.manyorder.api;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.manyorder.api.domain.admin.AdminAuditLogRepository;
import com.manyorder.api.domain.admin.MerchantActionMailer;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Store deletion, Stage 1: the protect flag and admin Restore. Delete-now and the
 * erase routine are not built yet (Stage 2). The restore email is verified against
 * a mocked mailer.
 */
class AdminStoreDeletionStage1IntegrationTest extends IntegrationTestBase {

    @MockitoBean private MerchantActionMailer mailer;
    @Autowired private MerchantRepository merchantRepository;
    @Autowired private AdminAuditLogRepository adminAuditLogRepository;

    private boolean auditHas(String action, long storeId) {
        return adminAuditLogRepository.findAllByOrderByCreatedAtDesc().stream()
                .anyMatch(l -> action.equals(l.getAction()) && Long.valueOf(storeId).equals(l.getTargetId()));
    }

    @Test
    void protect_thenUnprotect_togglesTheFlag_andAudits() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("del1-a@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Del One", "del-one-store");

        mockMvc.perform(post("/admin/merchants/" + storeId + "/protect").header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/admin/merchants/" + storeId + "/detail").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.protectedFromDeletion").value(true));
        assertTrue(auditHas("PROTECT_STORE", storeId), "protect audited");

        mockMvc.perform(post("/admin/merchants/" + storeId + "/unprotect").header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/admin/merchants/" + storeId + "/detail").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.profile.protectedFromDeletion").value(false));
        assertTrue(auditHas("UNPROTECT_STORE", storeId), "unprotect audited");
    }

    @Test
    void restore_clearsOwnerDeletion_emailsOwnerByDefault_andAudits() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("del1-b@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Del Two", "del-two-store");

        // Simulate the owner having deleted (archived) the store.
        Merchant m = merchantRepository.findById(storeId).orElseThrow();
        m.setArchivedAt(LocalDateTime.now());
        merchantRepository.save(m);
        mockMvc.perform(get("/public/stores/del-two-store")).andExpect(status().isNotFound());

        mockMvc.perform(post("/admin/merchants/" + storeId + "/restore").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNoContent());

        // Storefront is back, the deleted marker is cleared, the owner was emailed, and it is audited.
        mockMvc.perform(get("/public/stores/del-two-store")).andExpect(status().isOk());
        assertFalse(merchantRepository.findById(storeId).orElseThrow().isArchived(), "restore clears archivedAt");
        verify(mailer, times(1)).notifyOwner(any(), eq(MerchantActionMailer.Action.STORE_RESTORED), any());
        assertTrue(auditHas("RESTORE_STORE", storeId), "restore audited");
    }

    @Test
    void restore_canSkipTheEmail_whenUnticked() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("del1-c@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Del Three", "del-three-store");
        Merchant m = merchantRepository.findById(storeId).orElseThrow();
        m.setArchivedAt(LocalDateTime.now());
        merchantRepository.save(m);

        mockMvc.perform(post("/admin/merchants/" + storeId + "/restore").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"emailOwner\":false}"))
                .andExpect(status().isNoContent());

        verify(mailer, never()).notifyOwner(any(), eq(MerchantActionMailer.Action.STORE_RESTORED), any());
    }

    @Test
    void restore_onAStoreNotDeletedByOwner_is409() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("del1-d@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Del Four", "del-four-store");

        mockMvc.perform(post("/admin/merchants/" + storeId + "/restore").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void seededDemoStores_areProtected() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        // The seeded demo merchant owns the demo stores; pick one by its known slug.
        Merchant kiri = merchantRepository.findBySlug("kirikiri-brew").orElseThrow();
        mockMvc.perform(get("/admin/merchants/" + kiri.getId() + "/detail").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.profile.protectedFromDeletion").value(true));
    }
}
