package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.storeemailverification.StoreEmail;
import com.manyorder.api.email.EmailLayout;
import com.manyorder.api.email.ResendEmail;

/**
 * Delivers "new order" notifications to merchants through Resend's REST API.
 *
 * Shares the same gating as the other Resend mailers: when
 * {@code app.resend.api-key} is blank (tests, local dev) it no-ops with a log
 * line. Send failures are swallowed so a checkout can never fail because a
 * notification couldn't be delivered.
 */
@Component
public class ResendOrderNotificationMailer implements OrderNotificationMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendOrderNotificationMailer.class);

    private final String apiKey;
    private final String fromAddress;
    private final String supportEmail;
    private final String frontendBaseUrl;
    private final OrderItemRepository orderItemRepository;
    private final RestClient restClient = RestClient.create();

    public ResendOrderNotificationMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress,
            @Value("${app.support.email:support@manyorder.app}") String supportEmail,
            @Value("${app.frontend.base-url:http://localhost:3000}") String frontendBaseUrl,
            OrderItemRepository orderItemRepository) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
        this.supportEmail = supportEmail;
        this.frontendBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1)
                : frontendBaseUrl;
        this.orderItemRepository = orderItemRepository;
    }

    @Override
    public void sendNewOrder(Merchant merchant, List<Order> orders) {
        // Owner login email always, plus the store email only when verified, deduped.
        List<String> to = StoreEmail.alertRecipients(merchant);
        if (to.isEmpty()) {
            log.info("Store {} has no alert recipients — skipping new-order notification", merchant.getId());
            return;
        }
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping new-order email (store {})", merchant.getId());
            return;
        }

        Map<String, Object> payload = ResendEmail.payload(
                fromAddress, to, supportEmail,
                "New order at " + merchant.getName(), buildHtml(merchant, orders));

        try {
            restClient.post()
                    .uri(ResendEmail.RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Failed to send new-order email to {}: {}", to, e.getMessage());
        }
    }

    private String buildHtml(Merchant merchant, List<Order> orders) {
        Order primary = orders.get(0);
        String currency = merchant.getCurrency();

        StringBuilder lines = new StringBuilder();
        BigDecimal grandTotal = BigDecimal.ZERO;
        for (Order order : orders) {
            for (OrderItem item : orderItemRepository.findByOrder(order)) {
                lines.append("<tr><td style=\"padding:4px 0;\">")
                        .append(item.getQuantity()).append(" x ").append(escape(item.getProductName()))
                        .append("</td><td style=\"padding:4px 0;text-align:right;\">")
                        .append(money(item.getLineSubtotal(), currency))
                        .append("</td></tr>");
            }
            grandTotal = grandTotal.add(order.getTotalAmount());
        }

        String orderRef = orders.size() > 1
                ? "Orders #" + orders.get(0).getId() + " and #" + orders.get(1).getId() + " (ready and pre-order)"
                : "Order #" + primary.getId();

        String inner = """
                <p style="color:#4b5563;margin:0 0 4px;">%s</p>
                <p style="color:#4b5563;margin:0 0 4px;"><strong>Customer:</strong> %s</p>
                <p style="color:#4b5563;margin:0 0 16px;"><strong>Fulfilment:</strong> %s</p>
                <table style="width:100%%;border-collapse:collapse;font-size:14px;">
                  %s
                  <tr><td style="padding:8px 0 0;border-top:1px solid #e5e7eb;font-weight:700;">Total</td>
                      <td style="padding:8px 0 0;border-top:1px solid #e5e7eb;text-align:right;font-weight:700;">%s</td></tr>
                </table>
                <div style="margin-top:20px;">%s</div>
                """.formatted(
                escape(orderRef),
                escape(primary.getContactName()),
                primary.getOrderType().name().equals("DELIVERY") ? "Delivery" : "Pickup",
                lines.toString(),
                money(grandTotal, currency),
                EmailLayout.button("View order", frontendBaseUrl + "/app?screen=orders-all"));
        return EmailLayout.shell("New order at " + merchant.getName(), inner, supportEmail);
    }

    private static String money(BigDecimal amount, String currency) {
        BigDecimal value = amount == null ? BigDecimal.ZERO : amount;
        String symbol = "IDR".equalsIgnoreCase(currency) ? "Rp " : "$";
        return symbol + value.toPlainString();
    }

    /** Minimal HTML-escaping for customer- and merchant-supplied text. */
    private static String escape(String raw) {
        if (raw == null) return "";
        return raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
