package com.manyorder.api.email;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The shared Resend body every platform mailer sends: the sender stays no-reply
 * and replies are pointed at the support address, so an owner who hits Reply
 * reaches support rather than an unmonitored inbox.
 */
class ResendEmailTest {

    @Test
    void setsReplyToTheSupportAddress_andCarriesTheCoreFields() {
        Map<String, Object> body = ResendEmail.payload(
                "ManyOrder <no-reply@manyorder.app>",
                "owner@store.example",
                "support@manyorder.app",
                "New order at Kiri Brew",
                "<p>hi</p>");

        assertThat(body).containsEntry("from", "ManyOrder <no-reply@manyorder.app>");
        assertThat(body).containsEntry("to", "owner@store.example");
        assertThat(body).containsEntry("reply_to", "support@manyorder.app");
        assertThat(body).containsEntry("subject", "New order at Kiri Brew");
        assertThat(body).containsEntry("html", "<p>hi</p>");
    }

    @Test
    void acceptsAListOfRecipients() {
        Map<String, Object> body = ResendEmail.payload(
                "from@x", List.of("a@x", "b@x"), "support@manyorder.app", "s", "<p>h</p>");
        assertThat(body.get("to")).isEqualTo(List.of("a@x", "b@x"));
    }

    @Test
    void omitsReplyTo_whenBlank() {
        Map<String, Object> body = ResendEmail.payload("from@x", "to@x", "  ", "s", "<p>h</p>");
        assertThat(body).doesNotContainKey("reply_to");
    }
}
