package com.manyorder.api.domain.storeemailverification;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The store-email confirmation copy: generic wording, no specific alert types named. */
class StoreEmailConfirmationContentTest {

    private static final String URL = "http://localhost:3000/confirm-store-email?token=abc";
    private static final String SUPPORT = "support@manyorder.app";

    @Test
    void confirmationBody_usesTheAgreedCopy_andAButton() {
        String html = ResendStoreEmailConfirmationMailer.buildHtml("Kiri Brew", URL, SUPPORT);

        assertThat(html).contains("Confirm your store email"); // title
        assertThat(html).contains(
                "Please confirm that you want to receive notifications for Kiri Brew at this address. "
                        + "This link expires in 24 hours. If you didn't add this address, you can ignore this email.");
        assertThat(html).contains(">Confirm email<"); // button label
        // Does not name specific alert types.
        assertThat(html).doesNotContain("low-stock");
        assertThat(html).doesNotContain("order and low-stock");
    }

    @Test
    void storeName_isHtmlEscaped() {
        String html = ResendStoreEmailConfirmationMailer.buildHtml("A & <b>B</b>", URL, SUPPORT);
        assertThat(html).contains("A &amp; &lt;b&gt;B&lt;/b&gt;");
        assertThat(html).doesNotContain("<b>B</b>");
    }
}
