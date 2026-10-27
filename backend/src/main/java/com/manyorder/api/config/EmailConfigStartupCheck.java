package com.manyorder.api.config;

import jakarta.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Logs a one-time warning at startup when the Resend API key is blank, so a
 * misconfigured environment (outbound email disabled) is obvious in the boot
 * logs instead of only surfacing later as a silent per-send skip. Mirrors the
 * mailers' own trim-then-isEmpty check, so a whitespace-only value counts as
 * blank here too.
 */
@Component
public class EmailConfigStartupCheck {

    private static final Logger log = LoggerFactory.getLogger(EmailConfigStartupCheck.class);

    private final String resendApiKey;

    public EmailConfigStartupCheck(@Value("${app.resend.api-key:}") String resendApiKey) {
        this.resendApiKey = resendApiKey == null ? "" : resendApiKey.trim();
    }

    @PostConstruct
    void warnIfOutboundEmailDisabled() {
        if (resendApiKey.isEmpty()) {
            log.warn("app.resend.api-key (env RESEND_API_KEY) is blank - outbound email is DISABLED. "
                    + "Verification, new-order, low-stock and password-reset emails will be skipped until it is set.");
        }
    }
}
