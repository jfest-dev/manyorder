package com.manyorder.api.domain.authevent;

import java.time.Clock;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

/** The recorder never lets a tracking failure propagate; the sweep delegates to the writer. */
@ExtendWith(MockitoExtension.class)
class AuthEventServiceTest {

    @Mock AuthEventWriter writer;

    @Test
    void aFailedWriteIsSwallowedAndNeverPropagates() {
        AuthEventService service = new AuthEventService(writer, Clock.systemUTC());
        doThrow(new RuntimeException("db down")).when(writer)
                .insert(ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.anyBoolean(),
                        ArgumentMatchers.any(), ArgumentMatchers.any());
        doThrow(new RuntimeException("db down")).when(writer)
                .stampLastLogin(ArgumentMatchers.any(), ArgumentMatchers.any());

        // Every recorder call completes normally even though the underlying write throws.
        assertDoesNotThrow(() -> service.recordLoginSuccess(1L, AuthMethod.PASSWORD));
        assertDoesNotThrow(() -> service.recordLoginFailed(AuthMethod.PASSWORD));
        assertDoesNotThrow(() -> service.recordSignup(1L, AuthMethod.GOOGLE));
        assertDoesNotThrow(() -> service.recordEmailVerified(1L));
        assertDoesNotThrow(() -> service.recordAccountLocked(1L));
        assertDoesNotThrow(() -> service.recordPasswordResetRequested(1L));
    }

    @Test
    void sweepDelegatesToTheWriterWithA90DayCutoff() {
        AuthEventService service = new AuthEventService(writer, Clock.systemUTC());
        when(writer.deleteOlderThan(ArgumentMatchers.any(LocalDateTime.class))).thenReturn(4);

        assertEquals(4, service.sweepOldEvents());

        org.mockito.ArgumentCaptor<LocalDateTime> cutoff = org.mockito.ArgumentCaptor.forClass(LocalDateTime.class);
        Mockito.verify(writer).deleteOlderThan(cutoff.capture());
        LocalDateTime expected = LocalDateTime.now(Clock.systemUTC()).minusDays(90);
        long diffMinutes = java.time.Duration.between(cutoff.getValue(), expected).abs().toMinutes();
        org.junit.jupiter.api.Assertions.assertTrue(diffMinutes < 5, "cutoff is about 90 days ago");
    }
}
