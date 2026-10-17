package com.manyorder.api.email;

import java.util.List;

/**
 * The one shared HTML shell for every platform email: a black header bar with
 * the ManyOrder wordmark, a title, the caller's body, a "Questions? Reply to
 * this email." line, and a quiet footer. {@link #shell} is the primitive every
 * email uses; {@link #render} is the convenience form for the admin notices
 * (intro + summary box + "Open your dashboard" button).
 *
 * <p>All caller-supplied text must be escaped with {@link #escape}; the helpers
 * here ({@link #button}, {@link #summaryTable}) escape their own inputs.
 */
public final class EmailLayout {

    public record Row(String label, String value) {}

    private EmailLayout() {}

    /** Header + title + the caller's inner body (already HTML) + reply line + footer. */
    public static String shell(String title, String innerHtml) {
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
                        <p style="margin:16px 0 4px;color:#374151;font-size:14px;">Questions? Reply to this email.</p>
                      </div>
                      <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">
                        ManyOrder. You're receiving this because you have a store on ManyOrder.
                      </div>
                    </div>
                  </body>
                </html>
                """.formatted(escape(title), innerHtml);
    }

    /** A primary button (escaped label + url). */
    public static String button(String label, String url) {
        return """
                <div style="margin:4px 0 16px;">
                  <a href="%s" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">%s</a>
                </div>
                """.formatted(escape(url), escape(label));
    }

    /** A label/value summary box; blank-valued rows are dropped. */
    public static String summaryTable(List<Row> rows) {
        StringBuilder body = new StringBuilder();
        if (rows != null) {
            for (Row r : rows) {
                if (r == null || r.value() == null || r.value().isBlank()) continue;
                body.append("""
                        <tr>
                          <td style="padding:6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">%s</td>
                          <td style="padding:6px 0 6px 16px;color:#111827;font-size:14px;">%s</td>
                        </tr>
                        """.formatted(escape(r.label()), escape(r.value())));
            }
        }
        if (body.length() == 0) return "";
        return """
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:8px 14px;margin:0 0 20px;">
                  %s
                </table>
                """.formatted(body.toString());
    }

    /** Convenience for the admin owner notices: intro + summary box + dashboard button. */
    public static String render(String title, String intro, List<Row> summary, String dashboardUrl) {
        String introHtml = intro == null || intro.isBlank() ? ""
                : "<p style=\"margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;\">" + escape(intro) + "</p>";
        String inner = introHtml + summaryTable(summary) + button("Open your dashboard", dashboardUrl);
        return shell(title, inner);
    }

    /** Minimal HTML-escaping for all caller-supplied text. */
    public static String escape(String raw) {
        if (raw == null) return "";
        return raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
