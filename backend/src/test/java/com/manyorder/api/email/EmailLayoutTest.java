package com.manyorder.api.email;

import java.util.List;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The shared email shell: header, title, summary, button, support line, and escaping. */
class EmailLayoutTest {

    private static final String SUPPORT = "support@manyorder.app";

    @Test
    void rendersTheSharedShellAndEscapesValues() {
        String html = EmailLayout.render(
                "Your store is active again",
                "Good news: your store is active again.",
                List.of(new EmailLayout.Row("Store", "Kiri <b>Brew</b>"),
                        new EmailLayout.Row("Reason", "")),
                "https://app.manyorder.app",
                SUPPORT);

        assertTrue(html.contains(">ManyOrder<"), "black header wordmark");
        assertTrue(html.contains("Your store is active again"), "title");
        assertTrue(html.contains("Open your dashboard"), "primary button");
        assertTrue(html.contains("https://app.manyorder.app"), "dashboard link");
        // The footer points at support, as a mailto link, and the old reply line is gone.
        assertTrue(html.contains("Questions? Contact support at"), "support line");
        assertTrue(html.contains("mailto:" + SUPPORT), "support mailto link");
        assertFalse(html.contains("Reply to this email"), "old reply line removed");
        // Values are escaped; a blank row is dropped.
        assertTrue(html.contains("Kiri &lt;b&gt;Brew&lt;/b&gt;"), "store name escaped");
        assertFalse(html.contains("<b>Brew</b>"), "no raw markup from a value");
        assertFalse(html.contains(">Reason<"), "blank summary row omitted");
    }

    @Test
    void render_omitsTheButton_whenNoDashboardUrl() {
        // The suspend notice passes a null url because a suspended owner cannot sign in.
        String suspended = EmailLayout.render(
                "Your store has been suspended",
                "Your store has been suspended and is no longer visible to customers.",
                List.of(new EmailLayout.Row("Store", "Kiri Brew")),
                null,
                SUPPORT);
        assertFalse(suspended.contains("Open your dashboard"), "no dashboard button when suspended");
        assertTrue(suspended.contains("Questions? Contact support at"), "support line still present");

        // A restoring notice keeps the button.
        String active = EmailLayout.render(
                "Your store is active again", "Good news.",
                List.of(new EmailLayout.Row("Store", "Kiri Brew")),
                "https://app.manyorder.app", SUPPORT);
        assertTrue(active.contains("Open your dashboard"), "button present when the owner can sign in");
    }

    @Test
    void shell_usesTheGivenSupportAddress() {
        String html = EmailLayout.shell("Hello", "<p>Body</p>", "help@store.example");
        assertTrue(html.contains("mailto:help@store.example"), "configured support address in the footer");
    }
}
