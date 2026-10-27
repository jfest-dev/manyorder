package com.manyorder.api.domain.auth;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.manyorder.api.email.EmailLayout;
import com.manyorder.api.email.ResendEmail;

/**
 * Delivers account-security notices through Resend, on the shared email layout.
 * No-ops with a log line when the Resend key is blank (tests, local dev), so the
 * sign-in flow is never affected by email delivery.
 */
@Component
public class ResendAccountSecurityMailer implements AccountSecurityMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendAccountSecurityMailer.class);

    private final String apiKey;
    private final String fromAddress;
    private final String supportEmail;
    private final RestClient restClient = RestClient.create();

    public ResendAccountSecurityMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress,
            @Value("${app.support.email:support@manyorder.app}") String supportEmail) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
        this.supportEmail = supportEmail;
    }

    @Override
    public void sendAccountLocked(String email) {
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping account-locked email to {}", email);
            return;
        }
        Map<String, Object> payload = ResendEmail.payload(
                fromAddress, email, supportEmail,
                "Your ManyOrder account was temporarily locked", buildHtml());
        try {
            restClient.post()
                    .uri(ResendEmail.RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to send account-locked email to {}: {}", email, e.getMessage());
        }
    }

    private String buildHtml() {
        String inner = """
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">Your account was temporarily locked after repeated failed sign-ins. If this wasn't you, reset your password.</p>
                """;
        return EmailLayout.shell("Account temporarily locked", inner, supportEmail);
    }
}
