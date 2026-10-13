package com.manyorder.api.domain.admin;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.manyorder.api.domain.merchant.Merchant;

/**
 * Delivers admin-action notices to store owners through Resend's REST API.
 *
 * <p>From "ManyOrder &lt;no-reply@manyorder.app&gt;" with Reply-To
 * admin@manyorder.app. Like the other Resend mailers, it no-ops (with a log
 * line) when {@code app.resend.api-key} is blank, and every send failure is
 * swallowed so it can never undo the action that triggered it. All
 * owner/store/reason text is HTML-escaped before it reaches the body.
 */
@Component
public class ResendMerchantActionMailer implements MerchantActionMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendMerchantActionMailer.class);
    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";
    private static final String FROM = "ManyOrder <no-reply@manyorder.app>";
    private static final String REPLY_TO = "admin@manyorder.app";

    private final String apiKey;
    private final RestClient restClient = RestClient.create();

    public ResendMerchantActionMailer(@Value("${app.resend.api-key:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    @Override
    public void notifyOwner(Merchant merchant, Action action, String reason) {
        String to = merchant.getOwner() == null ? null : merchant.getOwner().getEmail();
        if (to == null || to.isBlank()) {
            log.info("Store {} owner has no email — skipping admin-action notice", merchant.getId());
            return;
        }
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping {} notice to {} (store {})",
                    action, to, merchant.getId());
            return;
        }

        Map<String, Object> payload = Map.of(
                "from", FROM,
                "to", to,
                "reply_to", REPLY_TO,
                "subject", "Update to your ManyOrder store: " + merchant.getName(),
                "html", buildHtml(merchant, action, reason));
        try {
            restClient.post()
                    .uri(RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to send {} notice to {}: {}", action, to, e.getMessage());
        }
    }

    private String buildHtml(Merchant merchant, Action action, String reason) {
        return """
                <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
                  <h2 style="margin-bottom: 4px;">Update to your store</h2>
                  <p style="color: #4b5563;">ManyOrder has %s.</p>
                  <p style="color: #4b5563; margin: 0 0 4px;"><strong>Store:</strong> %s</p>
                  <p style="color: #4b5563; margin: 0 0 16px;"><strong>Reason:</strong> %s</p>
                  <p style="color: #6b7280; font-size: 13px;">Reply to this email to reach the ManyOrder admin team.</p>
                </div>
                """.formatted(action.phrase(), escape(merchant.getName()), escape(reason));
    }

    /** Minimal HTML-escaping for store name and the admin-supplied reason. */
    private static String escape(String raw) {
        if (raw == null) return "";
        return raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
