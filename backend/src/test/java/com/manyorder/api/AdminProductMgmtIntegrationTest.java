package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.admin.AdminAuditLogRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Admin can manage ANY merchant's products; delete is audited; non-admins are blocked. */
class AdminProductMgmtIntegrationTest extends IntegrationTestBase {

    @Autowired private AdminAuditLogRepository adminAuditLogRepository;

    @Test
    void admin_createsUpdatesAndDeletesAnotherMerchantsProduct_deleteAudited() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String merchant = registerAndGetToken("prod-owner@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Prod Store", "admin-prod-store");
        String base = "/admin/merchants/" + storeId + "/products";

        // Create under the merchant's store, as admin.
        MvcResult created = mockMvc.perform(post(base).header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Admin Latte", "price", 5.50))))
                .andExpect(status().isCreated()).andReturn();
        long productId = json(created).get("id").asLong();

        // Update it.
        mockMvc.perform(patch(base + "/" + productId).header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Admin Latte v2"))))
                .andExpect(status().isOk());

        // List reflects the created product.
        assertTrue(json(getWithToken(base, admin, 200)).toString().contains("Admin Latte v2"));

        // Delete it (204) and confirm an audit row was written.
        mockMvc.perform(delete(base + "/" + productId).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        assertTrue(adminAuditLogRepository.findAllByOrderByCreatedAtDesc().stream()
                .anyMatch(l -> "DELETE_PRODUCT".equals(l.getAction()) && Long.valueOf(productId).equals(l.getTargetId())),
                "product delete is audited");
    }

    @Test
    void adminProductEndpoints_forbiddenForMerchant() throws Exception {
        String merchant = registerAndGetToken("prod-nonadmin@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Prod NonAdmin", "admin-prod-nonadmin");
        // The store owner's own token cannot use the /admin path (URL role gate → 403).
        getWithToken("/admin/merchants/" + storeId + "/products", merchant, 403);
    }
}
