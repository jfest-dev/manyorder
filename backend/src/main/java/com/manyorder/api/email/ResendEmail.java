package com.manyorder.api.email;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Builds the JSON body every platform email sends to Resend, so the shape, and
 * in particular the {@code reply_to} support address, is identical across all
 * mailers and testable in one place. The sender ({@code from}) stays a no-reply
 * address; replies are pointed at {@code replyTo} (the support email).
 */
public final class ResendEmail {

    public static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private ResendEmail() {}

    /**
     * @param to a single address (String) or a list of addresses, as Resend accepts either.
     * @param replyTo the support address; omitted from the body only when null or blank.
     */
    public static Map<String, Object> payload(String from, Object to, String replyTo, String subject, String html) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", from);
        body.put("to", to);
        if (replyTo != null && !replyTo.isBlank()) body.put("reply_to", replyTo);
        body.put("subject", subject);
        body.put("html", html);
        return body;
    }
}
