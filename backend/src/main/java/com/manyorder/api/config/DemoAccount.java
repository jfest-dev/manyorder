package com.manyorder.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.manyorder.api.domain.user.User;

/**
 * The optional demo account, identified by {@code DEMO_EMAIL}. When that is empty
 * the whole feature is off and {@link #isEnabled()} is false. {@code DEMO_EMAIL_FROM}
 * (default {@code manyorder.app@gmail.com}) is the previously seeded demo email that
 * the one-time startup rename moves to {@code DEMO_EMAIL}; it is also the email a
 * fresh seed falls back to when {@code DEMO_EMAIL} is unset.
 *
 * <p>Comparisons are case-insensitive; the configured values are kept verbatim for
 * seeding and the rename so the stored email is exactly what the operator set.
 */
@Component
public class DemoAccount {

    private final String email;
    private final String emailFrom;

    public DemoAccount(@Value("${app.demo.email:}") String email,
                       @Value("${app.demo.email-from:manyorder.app@gmail.com}") String emailFrom) {
        this.email = email == null ? "" : email.trim();
        this.emailFrom = emailFrom == null ? "" : emailFrom.trim();
    }

    /** True when a demo email is configured (the protections and rename are active). */
    public boolean isEnabled() {
        return !email.isEmpty();
    }

    /** True when the candidate email is the configured demo account (case-insensitive). */
    public boolean is(String candidateEmail) {
        return isEnabled() && candidateEmail != null && email.equalsIgnoreCase(candidateEmail.trim());
    }

    public boolean is(User user) {
        return user != null && is(user.getEmail());
    }

    /** The configured demo email (verbatim), or "" when disabled. */
    public String email() {
        return email;
    }

    /** The previously seeded demo email that the rename moves from. */
    public String emailFrom() {
        return emailFrom;
    }

    /** The email a fresh seed should use: the demo email when set, else the from-address. */
    public String seedEmail() {
        return isEnabled() ? email : emailFrom;
    }
}
