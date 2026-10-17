package com.manyorder.api.email;

import java.util.List;

/**
 * The one shared HTML shell for every platform email: a black header bar with
 * the ManyOrder wordmark, a title, an optional intro line, a summary box of
 * label/value rows, a primary "Open your dashboard" button, a "Questions? Reply
 * to this email." line, and a quiet footer. Calm and professional.
 *
 * <p>The shell is fixed; callers supply only the title, intro, summary rows and
 * the dashboard URL. All caller-supplied text is HTML-escaped here, so a store
 * name or reason can never inject markup.
 */
public final class EmailLayout {

    public record Row(String label, String value) {}

    private EmailLayout() {}

    public static String render(String title, String intro, List<Row> summary, String dashboardUrl) {
        StringBuilder rows = new StringBuilder();
        if (summary != null) {
            for (Row r : summary) {
                if (r == null || r.value() == null || r.value().isBlank()) continue;
                rows.append("""
                        <tr>
                          <td style="padding:6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">%s</td>
                          <td style="padding:6px 0 6px 16px;color:#111827;font-size:14px;">%s</td>
                        </tr>
                        """.formatted(escape(r.label()), escape(r.value())));
            }
        }
        String introHtml = intro == null || intro.isBlank() ? ""
                : "<p style=\"margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;\">" + escape(intro) + "</p>";
        String summaryHtml = rows.length() == 0 ? ""
                : """
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:8px 14px;margin:0 0 20px;">
                    %s
                  </table>
                  """.formatted(rows.toString());

        return """
                <!doctype html>
                <html>
                  <body style="margin:0;padding:0;background:#f3f4f6;">
                    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
                      <div style="background:#111111;padding:16px 24px;">
                        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.02em;">ManyOrder</span>
                      </div>
                      <div style="padding:24px;color:#111827;">
                        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">%s</h1>
                        %s
                        %s
                        <div style="margin:0 0 20px;">
                          <a href="%s" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Open your dashboard</a>
                        </div>
                        <p style="margin:0 0 4px;color:#374151;font-size:14px;">Questions? Reply to this email.</p>
                      </div>
                      <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">
                        ManyOrder. You're receiving this because you have a store on ManyOrder.
                      </div>
                    </div>
                  </body>
                </html>
                """.formatted(escape(title), introHtml, summaryHtml, escape(dashboardUrl));
    }

    /** Minimal HTML-escaping for all caller-supplied text. */
    public static String escape(String raw) {
        if (raw == null) return "";
        return raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
