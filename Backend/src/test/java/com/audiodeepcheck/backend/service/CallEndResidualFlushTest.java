package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.repository.AnalysisRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CallEndResidualFlushTest {

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

        aiScheduler = new CallAiWindowScheduler(aiClient, sessionService, analysisRepository, presenceService, 2);

        testSession = new CallSession("CALL-1001", "Muthu", "Friend");
        testSession.setCallerUserId("USER-A");
        testSession.setReceiverUserId("USER-B");
        testSession.start(Instant.now());

        when(sessionService.getSessionOrThrow("CALL-1001")).thenReturn(testSession);
    }

    @Test
    @DisplayName("Residual audio >= 1.0s is flushed and evaluated when call ends")
    void testResidualAudioFlushedWhenGreaterThanOneSecond() throws Exception {
        when(aiClient.analyzeAudio(any(), anyString(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), anyString()))
                .thenReturn(new FastApiAnalyzeDto(
                        "HUMAN",
                        0.88,
                        "CALIBRATED",
                        0.05,
                        "LOW",
                        null,
                        null,
                        List.of(),
                        null,
                        null
                ));

        // Submit 1.5 seconds of audio (48,000 bytes = 24,000 samples @ 16kHz PCM16, > MIN_FLUSH_BYTES 32,000)
        byte[] partialAudio = new byte[48000];
        aiScheduler.appendAudio("CALL-1001", "CALLER", "USER-A", partialAudio, 1L);

        // Call ends: trigger flushAndFinish
        aiScheduler.flushAndFinish("CALL-1001");

        // Allow background thread to dispatch
        Thread.sleep(150);

        // Verify analyzeAudio was called for the residual window
        verify(aiClient, times(1)).analyzeAudio(any(), anyString(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), anyString());
    }

    @Test
    @DisplayName("Residual audio < 1.0s is discarded to prevent sub-second noisy inference")
    void testResidualAudioDiscardedWhenLessThanOneSecond() throws Exception {
        // Submit 0.5 seconds of audio (16,000 bytes, < MIN_FLUSH_BYTES 32,000)
        byte[] tinyAudio = new byte[16000];
        aiScheduler.appendAudio("CALL-1001", "CALLER", "USER-A", tinyAudio, 1L);

        // Call ends: trigger flushAndFinish
        aiScheduler.flushAndFinish("CALL-1001");

        Thread.sleep(150);

        // Verify analyzeAudio was NOT called
        verify(aiClient, never()).analyzeAudio(any(), anyString(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), anyString());
    }
}
