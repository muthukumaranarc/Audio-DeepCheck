package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.repository.AnalysisRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BackpressureAndQueueBoundingTest {

    private FastApiAiClient aiClient;
    private CallSessionService sessionService;
    private AnalysisRepository analysisRepository;
    private UserPresenceService presenceService;
    private CallAiWindowScheduler aiScheduler;

    private CallSession testSession;

    @BeforeEach
    void setUp() {
        aiClient = mock(FastApiAiClient.class);
        sessionService = mock(CallSessionService.class);
        analysisRepository = mock(AnalysisRepository.class);
        presenceService = mock(UserPresenceService.class);

        // 1 worker thread to simulate slower processing
        aiScheduler = new CallAiWindowScheduler(aiClient, sessionService, analysisRepository, presenceService, 1);

        testSession = new CallSession("CALL-1001", "Muthu", "Friend");
        testSession.setCallerUserId("USER-A");
        testSession.setReceiverUserId("USER-B");
        testSession.start(Instant.now());

        when(sessionService.getSessionOrThrow("CALL-1001")).thenReturn(testSession);
    }

    @Test
    @DisplayName("Inference queue bounding: Excess windows dropped when MAX_PENDING_ANALYSES (4) is reached")
    void testBackpressureDropsExcessWindows() throws Exception {
        CountDownLatch pauseLatch = new CountDownLatch(1);

        // Block the worker thread in analyzeAudio to force queue accumulation
        when(aiClient.analyzeAudio(any(), anyString(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), anyString()))
                .thenAnswer(invocation -> {
                    pauseLatch.await(2, TimeUnit.SECONDS);
                    return null;
                });

        byte[] window = new byte[CallAiWindowScheduler.WINDOW_BYTES];

        // Submit 6 audio windows (more than MAX_PENDING_ANALYSES = 4)
        for (int i = 0; i < 6; i++) {
            aiScheduler.appendAudio("CALL-1001", "CALLER", "USER-A", window, i);
        }

        // Verify pending jobs count is bounded <= 4
        int pending = aiScheduler.getPendingJobCount();
        assertTrue(pending <= CallAiWindowScheduler.MAX_PENDING_ANALYSES,
                "Pending jobs must not exceed MAX_PENDING_ANALYSES=" + CallAiWindowScheduler.MAX_PENDING_ANALYSES + ", but was " + pending);

        // Verify session was marked with backpressure
        verify(sessionService, atLeastOnce()).save(argThat(CallSession::isBackpressureDetected));

        pauseLatch.countDown();
    }
}
