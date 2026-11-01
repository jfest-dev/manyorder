package com.manyorder.api.domain.authevent;

import java.time.LocalDateTime;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.user.UserRepository;

/**
 * The transactional writes behind {@link AuthEventService}, in a separate bean so the
 * {@code REQUIRES_NEW} boundary is reached through the Spring proxy (a self-invocation
 * from the service would silently bypass it). Each write runs in its own transaction, so
 * when {@link AuthEventService} catches a failure the caller's transaction (the sign-in,
 * sign-up, verification or reset) is never marked rollback-only by it.
 *
 * <p>These methods deliberately do NOT catch: a failure must roll back this isolated
 * transaction and propagate so the service's own try/catch can swallow it cleanly.
 */
@Component
public class AuthEventWriter {

    private final AuthEventRepository repository;
    private final UserRepository userRepository;

    public AuthEventWriter(AuthEventRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void insert(AuthEventType type, AuthMethod method, boolean success, Long userId, LocalDateTime occurredAt) {
        repository.save(new AuthEvent(occurredAt, type, method, success, userId));
    }

    /** Stamp the account's last successful sign-in. Runs after the sign-in has committed
     *  (see the service), so it never contends with a lock the sign-in holds. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void stampLastLogin(Long userId, LocalDateTime at) {
        userRepository.updateLastLoginAt(userId, at);
    }

    /** Delete rows older than the cutoff (used by tests and as a fallback). */
    @Transactional
    public int deleteOlderThan(LocalDateTime cutoff) {
        return repository.deleteOlderThan(cutoff);
    }

    /** One committed batch of the retention sweep. Each batch is its own transaction so
     *  locks are released between batches and the sweep never holds a long lock. */
    @Transactional
    public int deleteOlderThanBatch(LocalDateTime cutoff, int limit) {
        return repository.deleteOlderThanBatch(cutoff, limit);
    }
}
