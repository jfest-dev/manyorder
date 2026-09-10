package com.manyorder.api.domain.emailverification;

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
    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private final String apiKey;
    private final String fromAddress;
    private final RestClient restClient = RestClient.create();

    public ResendEmailVerificationMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
    }

    @Override
    public void sendVerificationLink(String email, String verifyUrl) {
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping verification email to {} (link: {})", email, verifyUrl);
            return;
        }

        Map<String, Object> payload = Map.of(
                "from", fromAddress,
                "to", email,
                "subject", "Confirm your ManyOrder email",
                "html", buildHtml(verifyUrl));

        try {
            restClient.post()
                    .uri(RESEND_EMAILS_URL)
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
        return """
                <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
                  <h2 style="margin-bottom: 8px;">Confirm your email</h2>
                  <p style="color: #4b5563;">Welcome to ManyOrder. Confirm this email address so we can send you order notifications and account updates. This link expires in 24 hours.</p>
                  <p style="margin: 24px 0;">
                    <a href="%s" style="background: #111827; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">Confirm my email</a>
                  </p>
                  <p style="color: #6b7280; font-size: 13px;">If you didn't create a ManyOrder account, you can safely ignore this email.</p>
                  <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Or paste this link into your browser:<br>%s</p>
                </div>
                """.formatted(verifyUrl, verifyUrl);
    }
}
