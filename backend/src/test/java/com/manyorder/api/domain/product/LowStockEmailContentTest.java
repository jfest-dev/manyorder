package com.manyorder.api.domain.product;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The low-stock alert uses a single trigger (stock at or below the threshold),
 * but the wording must reflect which case it actually is: genuinely out of stock
 * (0) versus merely running low (1..threshold).
 */
class LowStockEmailContentTest {

    @Test
    void outOfStock_wordsItAsOutOfStock() {
        assertThat(ResendLowStockMailer.subjectFor("Flat White", 0))
                .isEqualTo("Out of stock: Flat White");

        String body = ResendLowStockMailer.buildHtml("Kiri Brew", "Flat White", 0);
        assertThat(body).contains("Out of stock at Kiri Brew");
        assertThat(body).contains("is now out of stock");
        assertThat(body).doesNotContain("running low");
    }

    @Test
    void runningLow_wordsItAsRunningLow_withTheCount() {
        assertThat(ResendLowStockMailer.subjectFor("Flat White", 3))
                .isEqualTo("Low stock: Flat White");

        String body = ResendLowStockMailer.buildHtml("Kiri Brew", "Flat White", 3);
        assertThat(body).contains("Low stock at Kiri Brew");
        assertThat(body).contains("is running low, with 3 left");
        assertThat(body).doesNotContain("out of stock");
    }

    @Test
    void productAndStoreNames_areHtmlEscaped() {
        String body = ResendLowStockMailer.buildHtml("A & B", "<script>", 2);
        assertThat(body).contains("A &amp; B");
        assertThat(body).contains("&lt;script&gt;");
        assertThat(body).doesNotContain("<script>");
    }
}
