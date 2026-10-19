package com.manyorder.api.domain.emailverification;

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
 * Delivers verification links through Resend's REST API.
 *
 * When {@code app.resend.api-key} is blank (tests, local dev without a key) the
 * mailer no-ops with a log line instead of calling out — this keeps the test
 * suite hermetic and lets the verification flow be exercised end-to-end with a
 * spy.
 */
@Component
public class ResendEmailVerificationMailer implements EmailVerificationMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendEmailVerificationMailer.class);

    private final String apiKey;
    private final String fromAddress;
    private final String supportEmail;
    private final RestClient restClient = RestClient.create();

    public ResendEmailVerificationMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress,
            @Value("${app.support.email:support@manyorder.app}") String supportEmail) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
        this.supportEmail = supportEmail;
    }

    @Override
    public void sendVerificationLink(String email, String verifyUrl) {
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping verification email to {} (link: {})", email, verifyUrl);
            return;
        }

        Map<String, Object> payload = ResendEmail.payload(
                fromAddress, email, supportEmail,
                "Confirm your ManyOrder email", buildHtml(verifyUrl));

        try {
            restClient.post()
                    .uri(ResendEmail.RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            // A send failure must never break sign-up or surface to the caller.
            log.warn("Failed to send verification email to {}: {}", email, e.getMessage());
        }
    }

    private String buildHtml(String verifyUrl) {
        String inner = """
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">Welcome to ManyOrder. Confirm this email address so we can send you notifications and account updates. This link expires in 24 hours.</p>
                %s
                <p style="color:#6b7280;font-size:13px;">If you didn't create a ManyOrder account, you can safely ignore this email.</p>
                <p style="color:#9ca3af;font-size:12px;word-break:break-all;">Or paste this link into your browser:<br>%s</p>
                """.formatted(EmailLayout.button("Confirm my email", verifyUrl), EmailLayout.escape(verifyUrl));
        return EmailLayout.shell("Confirm your email", inner, supportEmail);
    }
}
