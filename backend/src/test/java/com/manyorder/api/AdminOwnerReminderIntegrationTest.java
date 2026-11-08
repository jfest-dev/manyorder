package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.manyorder.api.domain.admin.MerchantActionMailer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Part 3(c): the owner reminder endpoint emails once per click, records the audit row,
 *  rate-limits to once per 3 days, and never emails without the admin's click. */
class AdminOwnerReminderIntegrationTest extends IntegrationTestBase {

    @MockitoBean
    private MerchantActionMailer mailer;

    @Test
    void remind_sendsOneEmail_recordsAudit_andIsRateLimited() throws Exception {
        when(mailer.sendReminder(any())).thenReturn(true);
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        String owner = registerAndGetToken("remind-a@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Remind Cafe", "remind-a-store");

        // No email is sent until the admin clicks (no reminder action occurred yet).
        verify(mailer, never()).sendReminder(any());

        // First click: one email, recorded in the audit log as REMIND_OWNER.
        mockMvc.perform(post("/admin/merchants/" + storeId + "/remind-owner")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailSent").value(true));
        verify(mailer, times(1)).sendReminder(any());

        mockMvc.perform(get("/admin/audit-log?storeId=" + storeId)
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.action == 'REMIND_OWNER')]").exists());

        // Second click within the cooldown: rejected, and no second email.
        mockMvc.perform(post("/admin/merchants/" + storeId + "/remind-owner")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isTooManyRequests());
        verify(mailer, times(1)).sendReminder(any());
    }

    @Test
    void remind_requiresAdmin() throws Exception {
        String owner = registerAndGetToken("remind-b@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Remind Two", "remind-b-store");
        // A store owner (non-admin) cannot send reminders.
        mockMvc.perform(post("/admin/merchants/" + storeId + "/remind-owner")
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isForbidden());
        verify(mailer, never()).sendReminder(any());
    }
}
