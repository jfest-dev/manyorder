package com.manyorder.api.email;

import java.util.List;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The shared email shell: header, title, summary, button, reply line, and escaping. */
class EmailLayoutTest {

    @Test
    void rendersTheSharedShellAndEscapesValues() {
        String html = EmailLayout.render(
                "Your store is active again",
                "Good news: your store is active again.",
                List.of(new EmailLayout.Row("Store", "Kiri <b>Brew</b>"),
                        new EmailLayout.Row("Reason", "")),
                "https://app.manyorder.app");

        assertTrue(html.contains(">ManyOrder<"), "black header wordmark");
        assertTrue(html.contains("Your store is active again"), "title");
        assertTrue(html.contains("Open your dashboard"), "primary button");
        assertTrue(html.contains("https://app.manyorder.app"), "dashboard link");
        assertTrue(html.contains("Questions? Reply to this email."), "reply line");
        // Values are escaped; a blank row is dropped.
        assertTrue(html.contains("Kiri &lt;b&gt;Brew&lt;/b&gt;"), "store name escaped");
        assertFalse(html.contains("<b>Brew</b>"), "no raw markup from a value");
        assertFalse(html.contains(">Reason<"), "blank summary row omitted");
    }
}
