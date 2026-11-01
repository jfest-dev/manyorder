package com.manyorder.api.domain.authevent;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * Records {@link AuthEvent} rows from the normal auth flows and sweeps old ones. Every
 * write is best-effort and isolated: it goes through {@link AuthEventWriter} (its own
 * transaction), and a failure here is caught and logged, so recording an event can never
 * break or roll back the sign-in, sign-up, verification or reset the user is performing.
 * The successful-sign-in stamp is deferred to after the sign-in commits, so it never
 * contends with a lock the sign-in holds. This is not an admin write.
 */
@Service
public class AuthEventService {

    private static final Logger log = LoggerFactory.getLogger(AuthEventService.class);
    /** Rows older than this are deleted by the daily sweep, so no long-term history is kept. */
    static final int RETENTION_DAYS = 90;
    /** At most this many failed-sign-in rows are written per clock hour, platform-wide. A
     *  flood of wrong passwords (unauthenticated, one row each) is the only unbounded write;
     *  past the cap the rows are dropped, so the table cannot grow without limit. The
     *  failed-sign-ins metric therefore saturates at this cap per hour, which still shows a
     *  spike. Other event types are bounded by real actions or existing rate limits. */
    static final int MAX_FAILED_WRITES_PER_HOUR = 2000;
    /** Rows deleted per committed batch in the sweep, so each statement is short. */
    static final int SWEEP_BATCH_SIZE = 5000;

    private final AuthEventWriter writer;
    private final Clock clock;

    /** Failed-sign-in write counters per clock hour, to enforce {@link #MAX_FAILED_WRITES_PER_HOUR}. */
    private final Cache<Long, AtomicLong> failedWritesThisHour =
            Caffeine.newBuilder().expireAfterWrite(2, TimeUnit.HOURS).maximumSize(8).build();

    public AuthEventService(AuthEventWriter writer, Clock clock) {
        this.writer = writer;
        this.clock = clock;
    }

    /** Record a successful sign-in and stamp last_login_at. The event is written in its
     *  own transaction now; the stamp is deferred to after the sign-in commits. Both are
     *  best-effort and never affect the sign-in. */
    public void recordLoginSuccess(Long userId, AuthMethod method) {
        write(AuthEventType.LOGIN, method, true, userId);
        Runnable stamp = () -> {
            try {
                writer.stampLastLogin(userId, LocalDateTime.now(clock));
            } catch (RuntimeException e) {
                log.debug("Skipped last_login stamp (non-fatal): {}", e.toString());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { stamp.run(); }
            });
        } else {
            stamp.run();
        }
    }

    /** A failed sign-in. No user id and no email are stored, even for a known address.
     *  Capped per hour so a flood of wrong passwords cannot grow the table without limit. */
    public void recordLoginFailed(AuthMethod method) {
        if (!underFailedWriteCap()) {
            return;
        }
        write(AuthEventType.LOGIN_FAILED, method, false, null);
    }

    /** True if another failed-sign-in row may be written this clock hour (and counts it). */
    private boolean underFailedWriteCap() {
        long hour = clock.instant().truncatedTo(ChronoUnit.HOURS).getEpochSecond();
        long count = failedWritesThisHour.get(hour, h -> new AtomicLong()).incrementAndGet();
        return count <= MAX_FAILED_WRITES_PER_HOUR;
    }

    public void recordSignup(Long userId, AuthMethod method) {
        write(AuthEventType.SIGNUP, method, true, userId);
    }

    public void recordEmailVerified(Long userId) {
        write(AuthEventType.EMAIL_VERIFIED, null, true, userId);
    }

    public void recordAccountLocked(Long userId) {
        write(AuthEventType.ACCOUNT_LOCKED, null, true, userId);
    }

    /** A password-reset request. The user id is included only when the account is known;
     *  the email is never stored. */
    public void recordPasswordResetRequested(Long userId) {
        write(AuthEventType.PASSWORD_RESET_REQUESTED, null, true, userId);
    }

    /** Best-effort, isolated insert. The writer's own transaction rolls back on failure;
     *  catching it here (outside that transaction) keeps the caller's transaction clean. */
    private void write(AuthEventType type, AuthMethod method, boolean success, Long userId) {
        try {
            writer.insert(type, method, success, userId, LocalDateTime.now(clock));
        } catch (RuntimeException e) {
            log.debug("Skipped recording auth event {} (non-fatal): {}", type, e.toString());
        }
    }

    /** Daily retention sweep: delete rows older than {@link #RETENTION_DAYS} days, in
     *  committed batches so it never holds a long lock on the table. */
    @Scheduled(cron = "0 15 3 * * *")
    public int sweepOldEvents() {
        LocalDateTime cutoff = LocalDateTime.now(clock).minusDays(RETENTION_DAYS);
        int total = 0;
        int batch;
        do {
            batch = writer.deleteOlderThanBatch(cutoff, SWEEP_BATCH_SIZE);
            total += batch;
        } while (batch == SWEEP_BATCH_SIZE);
        if (total > 0) {
            log.info("auth_events retention sweep removed {} rows older than {} days", total, RETENTION_DAYS);
        }
        return total;
    }
}
