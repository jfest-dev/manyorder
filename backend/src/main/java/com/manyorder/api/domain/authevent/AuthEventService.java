package com.manyorder.api.domain.authevent;

import java.time.Clock;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes {@link AuthEvent} rows from the normal auth flows and sweeps old ones. Every
 * write is best-effort and isolated: it runs in its own transaction and swallows any
 * failure, so recording an event can never break the sign-in, sign-up, verification or
 * reset the user is performing. This is not an admin write; the admin stays read-only.
 */
@Service
public class AuthEventService {

    private static final Logger log = LoggerFactory.getLogger(AuthEventService.class);
    /** Rows older than this are deleted by the daily sweep, so no long-term history is kept. */
    static final int RETENTION_DAYS = 90;

    private final AuthEventRepository repository;
    private final Clock clock;

    public AuthEventService(AuthEventRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public void recordLoginSuccess(Long userId, AuthMethod method) {
        record(AuthEventType.LOGIN, method, true, userId);
    }

    /** A failed sign-in. No user id and no email are stored, even for a known address. */
    public void recordLoginFailed(AuthMethod method) {
        record(AuthEventType.LOGIN_FAILED, method, false, null);
    }

    public void recordSignup(Long userId, AuthMethod method) {
        record(AuthEventType.SIGNUP, method, true, userId);
    }

    public void recordEmailVerified(Long userId) {
        record(AuthEventType.EMAIL_VERIFIED, null, true, userId);
    }

    public void recordAccountLocked(Long userId) {
        record(AuthEventType.ACCOUNT_LOCKED, null, true, userId);
    }

    /** A password-reset request. The user id is included only when the account is known;
     *  the email is never stored. */
    public void recordPasswordResetRequested(Long userId) {
        record(AuthEventType.PASSWORD_RESET_REQUESTED, null, true, userId);
    }

    /** Best-effort, isolated insert. A failure here is logged and ignored. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuthEventType type, AuthMethod method, boolean success, Long userId) {
        try {
            repository.save(new AuthEvent(LocalDateTime.now(clock), type, method, success, userId));
        } catch (RuntimeException e) {
            log.debug("Skipped recording auth event {} (non-fatal): {}", type, e.toString());
        }
    }

    /** Daily retention sweep: delete rows older than {@link #RETENTION_DAYS} days. */
    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public int sweepOldEvents() {
        int removed = repository.deleteOlderThan(LocalDateTime.now(clock).minusDays(RETENTION_DAYS));
        if (removed > 0) {
            log.info("auth_events retention sweep removed {} rows older than {} days", removed, RETENTION_DAYS);
        }
        return removed;
    }
}
