package com.manyorder.api.domain.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * In-memory, per-email sign-in failure counter. Keyed by a SHA-256 hash of the
 * normalized (trimmed, lowercased) email, so no address is held in clear and the
 * map never touches the database. An entry counts consecutive failures and lapses
 * {@value #WINDOW_MINUTES} minutes after the most recent failure, so the map
 * self-prunes on the next touch of a stale key. A successful sign-in clears the key.
 *
 * <p>This counter is per instance (per running process). With more than one backend
 * instance the effective limit is multiplied by the instance count; the durable,
 * cross-instance guard for real accounts is the database lock in {@link AuthService}.
 */
@Component
public class SignInAttemptTracker {

    static final int WINDOW_MINUTES = 15;

    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();

    private static final class Entry {
        int count;
        LocalDateTime expiresAt;
    }

    static String hash(String email) {
        String normalized = email == null ? "" : email.trim().toLowerCase();
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required but unavailable", e);
        }
    }

    /** True when this email has reached the threshold and the window has not lapsed. */
    boolean isThrottled(String email, int threshold, LocalDateTime now) {
        Entry e = entries.get(hash(email));
        return e != null && now.isBefore(e.expiresAt) && e.count >= threshold;
    }

    /** Record one failure (starting a fresh window if the previous one lapsed) and
     *  return the new consecutive count. */
    int recordFailure(String email, LocalDateTime now) {
        return entries.compute(hash(email), (k, e) -> {
            if (e == null || !now.isBefore(e.expiresAt)) {
                e = new Entry();
            }
            e.count++;
            e.expiresAt = now.plusMinutes(WINDOW_MINUTES);
            return e;
        }).count;
    }

    /** Whole seconds until the current window lapses (0 when there is no live entry). */
    long retryAfterSeconds(String email, LocalDateTime now) {
        Entry e = entries.get(hash(email));
        if (e == null || !now.isBefore(e.expiresAt)) {
            return 0;
        }
        return Math.max(1, Duration.between(now, e.expiresAt).toSeconds());
    }

    /** Clear the counter for this email after a successful sign-in. */
    void reset(String email) {
        entries.remove(hash(email));
    }

    /** Drop all counters. Used by tests to isolate the shared singleton. */
    void clear() {
        entries.clear();
    }
}
