package com.manyorder.api.domain.storeemailverification;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.email.EmailLayout;
import com.manyorder.api.email.ResendEmail;

/**
 * Delivers store-email confirmations through Resend, on the shared email layout.
 * No-ops when the Resend key is blank, swallows failures, and never logs the
 * address or token (only the store id).
 */
@Component
public class ResendStoreEmailConfirmationMailer implements StoreEmailConfirmationMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendStoreEmailConfirmationMailer.class);

    private final String apiKey;
    private final String fromAddress;
    private final String supportEmail;
    private final RestClient restClient = RestClient.create();

    public ResendStoreEmailConfirmationMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress,
            @Value("${app.support.email:support@manyorder.app}") String supportEmail) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
        this.supportEmail = supportEmail;
    }

    @Override
    public void sendConfirmation(Merchant merchant, String toEmail, String confirmUrl) {
        if (toEmail == null || toEmail.isBlank()) return;
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping store-email confirmation for store {}", merchant.getId());
            return;
        }
        String store = merchant.getName();
        Map<String, Object> payload = ResendEmail.payload(
                fromAddress, toEmail, supportEmail,
                "Confirm the email for " + store,
                buildHtml(store, confirmUrl, supportEmail));
        try {
            restClient.post()
                    .uri(ResendEmail.RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to send store-email confirmation for store {}", merchant.getId());
        }
    }

    /** Confirmation body on the shared shell. Package-private and primitive-typed so the
     *  copy can be unit-tested without a store entity or a live Resend key. */
    static String buildHtml(String storeName, String confirmUrl, String supportEmail) {
        String inner = """
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">Please confirm that you want to receive notifications for %s at this address. This link expires in 24 hours. If you didn't add this address, you can ignore this email.</p>
                %s
                """.formatted(EmailLayout.escape(storeName), EmailLayout.button("Confirm email", confirmUrl));
        return EmailLayout.shell("Confirm your store email", inner, supportEmail);
    }
}
