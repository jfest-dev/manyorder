package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.admin.AdminAuditLogRepository;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Admin can manage ANY merchant's customers, discounts, and orders; deletes audited; non-admins blocked. */
class AdminMerchantDataMgmtIntegrationTest extends IntegrationTestBase {

    @Autowired private AdminAuditLogRepository auditRepo;

    private boolean audited(String action, long targetId) {
        return auditRepo.findAllByOrderByCreatedAtDesc().stream()
                .anyMatch(l -> action.equals(l.getAction()) && Long.valueOf(targetId).equals(l.getTargetId()));
    }

    @Test
    void admin_managesCustomersDiscountsAndOrdersOfAnotherMerchant() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String merchant = registerAndGetToken("data-owner@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Data Store", "admin-data-store");

        // --- Customer: create + delete (audited) ---
        String cbase = "/admin/merchants/" + storeId + "/customers";
        MvcResult c = mockMvc.perform(post(cbase).header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "Bob", "phoneNumber", "+6591230000"))))
                .andExpect(status().isCreated()).andReturn();
        long custId = json(c).get("id").asLong();
        mockMvc.perform(delete(cbase + "/" + custId).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        assertTrue(audited("DELETE_CUSTOMER", custId), "customer delete audited");

        // --- Discount: create + delete (audited) ---
        String dbase = "/admin/merchants/" + storeId + "/discounts";
        MvcResult d = mockMvc.perform(post(dbase).header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "ADMIN10", "type", "PERCENTAGE", "value", 10))))
                .andExpect(status().isCreated()).andReturn();
        long discId = json(d).get("id").asLong();
        mockMvc.perform(delete(dbase + "/" + discId).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        assertTrue(audited("DELETE_DISCOUNT", discId), "discount delete audited");

        // --- Order: created by the merchant, then acted on by admin (list + payment status) ---
        long orderId = createManualOrder(merchant, storeId, "Buyer", "+6592340000");
        String obase = "/admin/merchants/" + storeId + "/orders";
        assertTrue(json(getWithToken(obase, admin, 200)).toString().contains("\"id\":" + orderId),
                "admin sees the merchant's order");
        mockMvc.perform(patch(obase + "/" + orderId + "/payment-status").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("paymentStatus", "PAID"))))
                .andExpect(status().isOk());
        assertTrue(audited("UPDATE_ORDER_PAYMENT_STATUS", orderId), "payment-status change audited");

        // Order status change is also audited (PENDING -> CANCELLED).
        mockMvc.perform(patch(obase + "/" + orderId + "/status").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CANCELLED"))))
                .andExpect(status().isOk());
        assertTrue(audited("UPDATE_ORDER_STATUS", orderId), "order-status change audited");
    }

    @Test
    void adminDataEndpoints_forbiddenForMerchant() throws Exception {
        String merchant = registerAndGetToken("data-nonadmin@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Data NonAdmin", "admin-data-nonadmin");
        getWithToken("/admin/merchants/" + storeId + "/customers", merchant, 403);
        getWithToken("/admin/merchants/" + storeId + "/discounts", merchant, 403);
        getWithToken("/admin/merchants/" + storeId + "/orders", merchant, 403);
    }
}
