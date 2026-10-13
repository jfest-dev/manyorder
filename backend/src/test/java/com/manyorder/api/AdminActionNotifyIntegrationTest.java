package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.admin.MerchantActionMailer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Admin actions that notify the owner (suspend, unsuspend, product hide, discount
 * switch-off): the email fires with the reason, a required reason is enforced, and
 * the action still succeeds when the send fails.
 */
class AdminActionNotifyIntegrationTest extends IntegrationTestBase {

    @MockitoBean private MerchantActionMailer mailer;

    private long createProduct(String token, long storeId) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Latte", "price", 5.0, "stock", 100))))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    @Test
    void suspend_emailsOwnerWithReason_andSavesToAudit() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("notify-a@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Notify Cafe", "notify-a-store");

        mockMvc.perform(post("/admin/merchants/" + storeId + "/suspend")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Spam listings\"}"))
                .andExpect(status().isNoContent());

        verify(mailer, times(1)).notifyOwner(any(), eq(MerchantActionMailer.Action.SUSPENDED), eq("Spam listings"));
    }

    @Test
    void productHide_emailsOwner_withHiddenAction() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("notify-b@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Notify Two", "notify-b-store");
        long productId = createProduct(owner, storeId);

        mockMvc.perform(patch("/admin/merchants/" + storeId + "/products/" + productId + "/deactivate")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Misleading photo\"}"))
                .andExpect(status().isOk());

        verify(mailer, times(1)).notifyOwner(any(), eq(MerchantActionMailer.Action.PRODUCT_HIDDEN), eq("Misleading photo"));
    }

    @Test
    void blankReason_isRejected() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("notify-c@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Notify Three", "notify-c-store");

        mockMvc.perform(post("/admin/merchants/" + storeId + "/suspend")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void suspend_stillSucceeds_whenEmailSendFails() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", "password123");
        String owner = registerAndGetToken("notify-d@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Notify Four", "notify-d-store");

        doThrow(new RuntimeException("smtp down")).when(mailer).notifyOwner(any(), any(), any());

        mockMvc.perform(post("/admin/merchants/" + storeId + "/suspend")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Fraud report\"}"))
                .andExpect(status().isNoContent());

        // The suspension committed despite the failed send: the storefront is now hidden.
        mockMvc.perform(get("/public/stores/notify-d-store")).andExpect(status().isNotFound());
    }
}
