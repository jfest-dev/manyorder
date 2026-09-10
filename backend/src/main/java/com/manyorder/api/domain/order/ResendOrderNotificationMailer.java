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
    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private final String apiKey;
    private final String fromAddress;
    private final OrderItemRepository orderItemRepository;
    private final RestClient restClient = RestClient.create();

    public ResendOrderNotificationMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.mail.from:onboarding@resend.dev}") String fromAddress,
            OrderItemRepository orderItemRepository) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
        this.orderItemRepository = orderItemRepository;
    }

    @Override
    public void sendNewOrder(Merchant merchant, List<Order> orders) {
        String to = merchant.getEmail();
        if (to == null || to.isBlank()) {
            log.info("Store {} has no contact email — skipping new-order notification", merchant.getId());
            return;
        }
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping new-order email to {} (order {})",
                    to, orders.isEmpty() ? "?" : orders.get(0).getId());
            return;
        }

        Map<String, Object> payload = Map.of(
                "from", fromAddress,
                "to", to,
                "subject", "New order at " + merchant.getName(),
                "html", buildHtml(merchant, orders));

        try {
            restClient.post()
                    .uri(RESEND_EMAILS_URL)
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

        return """
                <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
                  <h2 style="margin-bottom: 4px;">New order at %s</h2>
                  <p style="color: #4b5563; margin-top: 0;">%s</p>
                  <p style="color: #4b5563; margin: 0 0 4px;"><strong>Customer:</strong> %s</p>
                  <p style="color: #4b5563; margin: 0 0 16px;"><strong>Fulfilment:</strong> %s</p>
                  <table style="width:100%%; border-collapse: collapse; font-size: 14px;">
                    %s
                    <tr><td style="padding:8px 0 0; border-top:1px solid #e5e7eb; font-weight:700;">Total</td>
                        <td style="padding:8px 0 0; border-top:1px solid #e5e7eb; text-align:right; font-weight:700;">%s</td></tr>
                  </table>
                  <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Open your ManyOrder dashboard to confirm and fulfil this order.</p>
                </div>
                """.formatted(
                escape(merchant.getName()),
                orderRef,
                escape(primary.getContactName()),
                primary.getOrderType().name().equals("DELIVERY") ? "Delivery" : "Pickup",
                lines.toString(),
                money(grandTotal, currency));
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
