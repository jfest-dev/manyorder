package com.manyorder.api.domain.product;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The low-stock alert uses a single trigger (stock at or below the threshold),
 * but the wording must reflect which case it actually is: genuinely out of stock
 * (0) versus merely running low (1..threshold).
 */
class LowStockEmailContentTest {

    private static final String URL = "http://localhost:3000/app";

    @Test
    void outOfStock_wordsItAsOutOfStock() {
        assertThat(ResendLowStockMailer.subjectFor("Flat White", 0))
                .isEqualTo("Flat White is out of stock");

        String body = ResendLowStockMailer.buildHtml("Kiri Brew", "Flat White", 0, URL);
        assertThat(body).contains("Flat White is out of stock");
        assertThat(body).contains("Customers can't order it until you restock.");
        assertThat(body).contains("Open Products");
        assertThat(body).contains("Turn off low stock emails in Settings.");
        assertThat(body).doesNotContain("almost out");
    }

    @Test
    void runningLow_wordsItAsAlmostOut_withTheCount() {
        assertThat(ResendLowStockMailer.subjectFor("Flat White", 3))
                .isEqualTo("Flat White is almost out (3 left)");

        String body = ResendLowStockMailer.buildHtml("Kiri Brew", "Flat White", 3, URL);
        assertThat(body).contains("Flat White is almost out (3 left)");
        assertThat(body).contains("Flat White at Kiri Brew has 3 left. Update its stock in Products so customers can keep ordering.");
        assertThat(body).contains("Open Products");
        assertThat(body).contains("Turn off low stock emails in Settings.");
        assertThat(body).doesNotContain("out of stock");
    }

    @Test
    void productAndStoreNames_areHtmlEscaped() {
        String body = ResendLowStockMailer.buildHtml("A & B", "<script>", 2, URL);
        assertThat(body).contains("A &amp; B");
        assertThat(body).contains("&lt;script&gt;");
        assertThat(body).doesNotContain("<script>");
    }
}
