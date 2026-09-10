package com.manyorder.api.domain.product;

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
 * Delivers low-stock alerts to merchants through Resend's REST API.
 *
 * Shares the same gating as the other Resend mailers: when
 * {@code app.resend.api-key} is blank (tests, local dev) it no-ops with a log
 * line. Send failures are swallowed so a product save can never fail because an
 * alert couldn't be delivered.
 */
@Component
public class ResendLowStockMailer implements LowStockMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendLowStockMailer.class);
    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private final String apiKey;
    private final String fromAddress;
    private final RestClient restClient = RestClient.create();

    public ResendLowStockMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
    }

    @Override
    public void sendLowStock(Merchant merchant, Product product, int stock) {
        String to = merchant.getEmail();
        if (to == null || to.isBlank()) {
            log.info("Store {} has no contact email — skipping low-stock alert", merchant.getId());
            return;
        }
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping low-stock email to {} (product {}, stock {})",
                    to, product.getId(), stock);
            return;
        }

        Map<String, Object> payload = Map.of(
                "from", fromAddress,
                "to", to,
                "subject", subjectFor(product.getName(), stock),
                "html", buildHtml(merchant.getName(), product.getName(), stock));

        try {
            restClient.post()
                    .uri(RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to send low-stock email to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Subject line, distinguishing a genuine out-of-stock (0) from merely
     * running low (1..threshold). Package-private and primitive-typed so the
     * wording can be unit-tested without constructing entities.
     */
    static String subjectFor(String productName, int stock) {
        return (stock == 0 ? "Out of stock: " : "Low stock: ") + productName;
    }

    /** Email body, with wording that reflects out-of-stock vs running-low. */
    static String buildHtml(String storeName, String productName, int stock) {
        boolean outOfStock = stock == 0;
        String headingPrefix = outOfStock ? "Out of stock at " : "Low stock at ";
        String level = outOfStock
                ? "is now out of stock"
                : "is running low, with " + stock + " left";
        String action = outOfStock
                ? "Restock it from your Products screen to put it back on sale."
                : "Restock it from your Products screen to keep it available to customers.";
        return """
                <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
                  <h2 style="margin-bottom: 8px;">%s%s</h2>
                  <p style="color: #4b5563;"><strong>%s</strong> %s.</p>
                  <p style="color: #4b5563;">%s</p>
                  <p style="color: #9ca3af; font-size: 12px;">You are receiving this because low inventory alerts are on for this store. You can turn them off in Settings.</p>
                </div>
                """.formatted(headingPrefix, escape(storeName), escape(productName), level, action);
    }

    /** Minimal HTML-escaping for merchant-supplied text. */
    private static String escape(String raw) {
        if (raw == null) return "";
        return raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
