package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
 * Delivers admin-action notices to store owners through Resend, on the shared
 * email layout. From "ManyOrder &lt;no-reply@manyorder.app&gt;" with the support
 * address as Reply-To. No-ops (returning false) when the Resend key is blank or
 * the owner has no email, and swallows send failures so a notice can never undo
 * the action. Returns true only when an email was actually dispatched.
 */
@Component
public class ResendMerchantActionMailer implements MerchantActionMailer {

    private static final Logger log = LoggerFactory.getLogger(ResendMerchantActionMailer.class);
    private static final String FROM = "ManyOrder <no-reply@manyorder.app>";
    private static final DateTimeFormatter WHEN =
            DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.ENGLISH);

    private final String apiKey;
    private final String dashboardUrl;
    private final String supportEmail;
    private final RestClient restClient = RestClient.create();

    public ResendMerchantActionMailer(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.frontend.base-url:http://localhost:3000}") String frontendBaseUrl,
            @Value("${app.support.email:support@manyorder.app}") String supportEmail) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.dashboardUrl = frontendBaseUrl;
        this.supportEmail = supportEmail;
    }

    @Override
    public boolean notifyOwner(Merchant merchant, Action action, String reason) {
        String to = merchant.getOwner() == null ? null : merchant.getOwner().getEmail();
        if (to == null || to.isBlank()) {
            log.info("Store {} owner has no email — skipping {} notice", merchant.getId(), action);
            return false;
        }
        if (apiKey.isEmpty()) {
            log.info("Resend API key not configured — skipping {} notice to store {}", action, merchant.getId());
            return false;
        }

        List<EmailLayout.Row> rows = new ArrayList<>();
        rows.add(new EmailLayout.Row("Store", merchant.getName()));
        rows.add(new EmailLayout.Row("What happened", action.whatHappened()));
        if (reason != null && !reason.isBlank()) rows.add(new EmailLayout.Row("Reason", reason.trim()));
        rows.add(new EmailLayout.Row("Date and time", LocalDateTime.now().format(WHEN)));

        // A suspended owner cannot sign in, so that notice carries no dashboard
        // button; every other action leaves the account usable and keeps it.
        String button = action == Action.SUSPENDED ? null : dashboardUrl;
        Map<String, Object> payload = ResendEmail.payload(
                FROM, to, supportEmail,
                action.subject(merchant.getName()),
                EmailLayout.render(action.whatHappened(), action.intro(), rows, button, supportEmail));
        try {
            restClient.post()
                    .uri(ResendEmail.RESEND_EMAILS_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception e) {
            log.warn("Failed to send {} notice to store {}: {}", action, merchant.getId(), e.getMessage());
            return false;
        }
    }
}
