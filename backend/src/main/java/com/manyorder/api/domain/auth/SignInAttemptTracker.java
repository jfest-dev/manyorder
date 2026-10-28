package com.manyorder.api.domain.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * In-memory, per-email sign-in failure counter. Keyed by a SHA-256 hash of the
 * normalized (trimmed, lowercased) email, so no address is held in clear and the
 * map never touches the database. An entry counts consecutive failures and lapses
 * {@value #WINDOW_MINUTES} minutes after the most recent failure; a successful
 * sign-in clears the key.
 *
 * <p>The map is bounded at {@code app.signin.throttle.max-entries} (default
 * {@value #DEFAULT_MAX_ENTRIES}). Every failure moves its key to the most-recent
 * position, so when the map is full the oldest entry (the one whose last failure is
 * furthest in the past) is evicted first. A scheduled sweep also removes lapsed
 * entries every five minutes, so idle keys do not linger until a restart.
 *
 * <p>This counter is per instance (per running process). With more than one backend
 * instance the effective limit is multiplied by the instance count; the durable,
 * cross-instance guard for real accounts is the database lock in {@link AuthService}.
 */
@Component
public class SignInAttemptTracker {

    static final int WINDOW_MINUTES = 15;
    static final int DEFAULT_MAX_ENTRIES = 10_000;

    private final Clock clock;
    private final int maxEntries;
    private final LinkedHashMap<String, Entry> entries;

    private static final class Entry {
        int count;
        LocalDateTime expiresAt;
    }

    @Autowired
    public SignInAttemptTracker(Clock clock,
                                @Value("${app.signin.throttle.max-entries:10000}") int maxEntries) {
        this.clock = clock;
        this.maxEntries = maxEntries > 0 ? maxEntries : DEFAULT_MAX_ENTRIES;
        this.entries = new LinkedHashMap<>(256, 0.75f, false) {
            private static final long serialVersionUID = 1L;
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Entry> eldest) {
                return size() > SignInAttemptTracker.this.maxEntries;
            }
        };
    }

    /** Test convenience: system clock and the default cap. */
    SignInAttemptTracker() {
        this(Clock.systemUTC(), DEFAULT_MAX_ENTRIES);
    }

    /** Test convenience: system clock and an explicit cap. */
    SignInAttemptTracker(int maxEntries) {
        this(Clock.systemUTC(), maxEntries);
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
        synchronized (entries) {
            Entry e = entries.get(hash(email));
            return e != null && now.isBefore(e.expiresAt) && e.count >= threshold;
        }
    }

    /** Record one failure (starting a fresh window if the previous one lapsed) and
     *  return the new consecutive count. Moves the key to the most-recent position so
     *  eviction, when the map is full, falls on the oldest key first. */
    int recordFailure(String email, LocalDateTime now) {
        String key = hash(email);
        synchronized (entries) {
            Entry e = entries.remove(key);
            if (e == null || !now.isBefore(e.expiresAt)) {
                e = new Entry();
            }
            e.count++;
            e.expiresAt = now.plusMinutes(WINDOW_MINUTES);
            entries.put(key, e); // re-inserted at the tail; may evict the eldest over cap
            return e.count;
        }
    }

    /** Whole seconds until the current window lapses (0 when there is no live entry). */
    long retryAfterSeconds(String email, LocalDateTime now) {
        synchronized (entries) {
            Entry e = entries.get(hash(email));
            if (e == null || !now.isBefore(e.expiresAt)) {
                return 0;
            }
            return Math.max(1, Duration.between(now, e.expiresAt).toSeconds());
        }
    }

    /** Clear the counter for this email after a successful sign-in. */
    void reset(String email) {
        synchronized (entries) {
            entries.remove(hash(email));
        }
    }

    /** Remove entries whose window has lapsed as of {@code now}; returns the count removed. */
    int sweep(LocalDateTime now) {
        synchronized (entries) {
            int before = entries.size();
            entries.values().removeIf(e -> !now.isBefore(e.expiresAt));
            return before - entries.size();
        }
    }

    /** Periodic cleanup so idle, lapsed keys are released without waiting for a restart. */
    @Scheduled(fixedRateString = "${app.signin.throttle.sweep-ms:300000}")
    void scheduledSweep() {
        sweep(LocalDateTime.now(clock));
    }

    /** Current number of tracked keys. Test/diagnostics visibility. */
    int size() {
        synchronized (entries) {
            return entries.size();
        }
    }

    /** Drop all counters. Used by tests to isolate the shared singleton. */
    void clear() {
        synchronized (entries) {
            entries.clear();
        }
    }
}
