package com.manyorder.api.domain.passwordreset;

import com.manyorder.api.email.EmailLayout;
import com.manyorder.api.email.ResendEmail;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Delivers reset links through Resend's REST API.
 *
 * When {@code app.resend.api-key} is blank (tests, local dev without a key) the
 * mailer no-ops with a log line instead of calling out — this keeps the test
 * suite hermetic and lets the reset flow be exercised end-to-end with a spy.
 */
@Component
public class ResendPasswordResetMailer implements PasswordResetMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendPasswordResetMailer.class);

    private final String apiKey;
    private final String fromAddress;
    private final String supportEmail;
    private final RestClient restClient = RestClient.create();

    public ResendPasswordResetMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress,
            @Value("${app.support.email:support@manyorder.app}") String supportEmail) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
        this.supportEmail = supportEmail;
    }

    @Override
    public void sendResetLink(String email, String resetUrl) {
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping reset email to {} (link: {})", email, resetUrl);
            return;
        }

        Map<String, Object> payload = ResendEmail.payload(
                fromAddress, email, supportEmail,
                "Reset your ManyOrder password", buildHtml(resetUrl));

        try {
            restClient.post()
                    .uri(ResendEmail.RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            // Never surface delivery failure to the caller: doing so would leak
            // whether the address exists. Log for operators and move on.
            log.warn("Failed to send password-reset email to {}: {}", email, e.getMessage());
        }
    }

    private String buildHtml(String resetUrl) {
        String inner = """
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">We received a request to reset your ManyOrder password. Click the button below to choose a new one. This link expires in 30 minutes and can be used once.</p>
                %s
                <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email, your password won't change.</p>
                <p style="color:#9ca3af;font-size:12px;word-break:break-all;">Or paste this link into your browser:<br>%s</p>
                """.formatted(EmailLayout.button("Set a new password", resetUrl), EmailLayout.escape(resetUrl));
        return EmailLayout.shell("Reset your password", inner, supportEmail);
    }
}
