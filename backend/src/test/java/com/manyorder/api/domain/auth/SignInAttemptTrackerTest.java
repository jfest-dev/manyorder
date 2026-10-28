package com.manyorder.api.domain.auth;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Bounding of the in-memory sign-in counter: the map never exceeds its cap under a
 * flood of distinct emails, the scheduled sweep drops lapsed entries while keeping
 * live ones, and eviction falls on the oldest key first (a freshly active key is
 * kept). A fixed set of timestamps drives the window logic deterministically.
 */
class SignInAttemptTrackerTest {

    private static final LocalDateTime T0 = LocalDateTime.of(2026, 1, 1, 0, 0);

    @Test
    void neverExceedsTheCapUnderManyDistinctEmails() {
        SignInAttemptTracker tracker = new SignInAttemptTracker(100);
        for (int i = 0; i < 1000; i++) {
            tracker.recordFailure("user" + i + "@test.com", T0.plusSeconds(i));
            assertTrue(tracker.size() <= 100, "size stays within the cap");
        }
        assertEquals(100, tracker.size(), "map holds exactly the cap after overflow");
    }

    @Test
    void sweepRemovesLapsedEntriesButKeepsLiveOnes() {
        SignInAttemptTracker tracker = new SignInAttemptTracker(10_000);
        tracker.recordFailure("old@test.com", T0);                     // window ends T0+15
        tracker.recordFailure("fresh@test.com", T0.plusMinutes(10));   // window ends T0+25
        assertEquals(2, tracker.size());

        int removed = tracker.sweep(T0.plusMinutes(16));               // past old's window only
        assertEquals(1, removed, "one lapsed entry removed");
        assertEquals(1, tracker.size());
        assertFalse(tracker.isThrottled("old@test.com", 1, T0.plusMinutes(16)), "lapsed key gone");
        assertTrue(tracker.isThrottled("fresh@test.com", 1, T0.plusMinutes(16)), "live key kept");
    }

    @Test
    void oldestEntryIsEvictedBeforeAMoreRecentlyActiveOne() {
        SignInAttemptTracker tracker = new SignInAttemptTracker(2);
        tracker.recordFailure("a@test.com", T0);                 // oldest
        tracker.recordFailure("b@test.com", T0.plusMinutes(1));
        assertEquals(2, tracker.size());

        tracker.recordFailure("c@test.com", T0.plusMinutes(2));  // forces one eviction
        assertEquals(2, tracker.size(), "cap holds");
        assertFalse(tracker.isThrottled("a@test.com", 1, T0.plusMinutes(2)), "oldest a evicted");
        assertTrue(tracker.isThrottled("b@test.com", 1, T0.plusMinutes(2)), "b kept");
        assertTrue(tracker.isThrottled("c@test.com", 1, T0.plusMinutes(2)), "c kept");
    }

    @Test
    void refreshingAnEntryProtectsItFromEviction() {
        SignInAttemptTracker tracker = new SignInAttemptTracker(2);
        tracker.recordFailure("a@test.com", T0);
        tracker.recordFailure("b@test.com", T0.plusMinutes(1));
        tracker.recordFailure("a@test.com", T0.plusMinutes(2));  // a is now the most recent
        tracker.recordFailure("c@test.com", T0.plusMinutes(3));  // evicts the oldest, which is b

        assertTrue(tracker.isThrottled("a@test.com", 1, T0.plusMinutes(3)), "refreshed a kept");
        assertFalse(tracker.isThrottled("b@test.com", 1, T0.plusMinutes(3)), "stale b evicted");
        assertTrue(tracker.isThrottled("c@test.com", 1, T0.plusMinutes(3)), "c kept");
    }
}
