package com.manyorder.api.domain.authevent;

import java.time.Clock;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.when;

/** The recorder never lets a tracking failure break the user action it accompanies. */
@ExtendWith(MockitoExtension.class)
class AuthEventServiceTest {

    @Mock AuthEventRepository repository;

    @Test
    void aFailedInsertIsSwallowedAndNeverPropagates() {
        when(repository.save(org.mockito.ArgumentMatchers.any()))
                .thenThrow(new RuntimeException("db down"));
        AuthEventService service = new AuthEventService(repository, Clock.systemUTC());

        // Each recorder call must complete normally even though the insert throws.
        assertDoesNotThrow(() -> service.recordLoginSuccess(1L, AuthMethod.PASSWORD));
        assertDoesNotThrow(() -> service.recordLoginFailed(AuthMethod.PASSWORD));
        assertDoesNotThrow(() -> service.recordSignup(1L, AuthMethod.GOOGLE));
        assertDoesNotThrow(() -> service.recordEmailVerified(1L));
        assertDoesNotThrow(() -> service.recordAccountLocked(1L));
        assertDoesNotThrow(() -> service.recordPasswordResetRequested(1L));
    }

    @Test
    void sweepDeletesRowsOlderThanTheCutoff() {
        AuthEventService service = new AuthEventService(repository, Clock.systemUTC());
        when(repository.deleteOlderThan(org.mockito.ArgumentMatchers.any(LocalDateTime.class))).thenReturn(4);

        int removed = service.sweepOldEvents();

        org.junit.jupiter.api.Assertions.assertEquals(4, removed);
        // The cutoff passed to the delete is ~90 days before now.
        org.mockito.ArgumentCaptor<LocalDateTime> cutoff = org.mockito.ArgumentCaptor.forClass(LocalDateTime.class);
        org.mockito.Mockito.verify(repository).deleteOlderThan(cutoff.capture());
        LocalDateTime expected = LocalDateTime.now(Clock.systemUTC()).minusDays(90);
        long diffMinutes = java.time.Duration.between(cutoff.getValue(), expected).abs().toMinutes();
        org.junit.jupiter.api.Assertions.assertTrue(diffMinutes < 5, "cutoff is about 90 days ago");
    }
}
