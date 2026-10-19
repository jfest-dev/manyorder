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

/**
 * Delivers store-email confirmations through Resend, on the shared email layout.
 * No-ops when the Resend key is blank, swallows failures, and never logs the
 * address or token (only the store id).
 */
@Component
public class ResendStoreEmailConfirmationMailer implements StoreEmailConfirmationMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendStoreEmailConfirmationMailer.class);
    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private final String apiKey;
    private final String fromAddress;
    private final RestClient restClient = RestClient.create();

    public ResendStoreEmailConfirmationMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
    }

    @Override
    public void sendConfirmation(Merchant merchant, String toEmail, String confirmUrl) {
        if (toEmail == null || toEmail.isBlank()) return;
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping store-email confirmation for store {}", merchant.getId());
            return;
        }
        String store = merchant.getName();
        String inner = """
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">You added this address as the contact email for %s on ManyOrder. Confirm it so order and low-stock alerts reach this inbox. This link expires in 24 hours.</p>
                %s
                """.formatted(EmailLayout.escape(store), EmailLayout.button("Confirm store email", confirmUrl));
        Map<String, Object> payload = Map.of(
                "from", fromAddress,
                "to", toEmail,
                "subject", "Confirm the email for " + store,
                "html", EmailLayout.shell("Confirm your store email", inner));
        try {
            restClient.post()
                    .uri(RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to send store-email confirmation for store {}", merchant.getId());
        }
    }
}
