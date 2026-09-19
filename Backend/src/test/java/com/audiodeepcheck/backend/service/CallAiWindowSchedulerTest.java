package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.repository.InMemoryAnalysisRepository;
import com.audiodeepcheck.backend.repository.InMemoryCallSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.io.Resource;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CallAiWindowSchedulerTest {

    private FastApiAiClient aiClient;
    private CallSessionService sessionService;
    private InMemoryAnalysisRepository analysisRepository;
    private UserPresenceService presenceService;
    private CallAiWindowScheduler scheduler;

    @BeforeEach
    void setUp() {
        aiClient = Mockito.mock(FastApiAiClient.class);
        sessionService = new CallSessionService(new InMemoryCallSessionRepository(), new InMemoryAnalysisRepository());
        analysisRepository = new InMemoryAnalysisRepository();
        presenceService = new UserPresenceService();

        scheduler = new CallAiWindowScheduler(
                aiClient, sessionService, analysisRepository, presenceService, 1
        );
    }

    private CallSession createActiveCall() {
        CallSession session = sessionService.createCallWithParticipants("Muthu", "Friend", "USER-A", "USER-B");
        session.start(Instant.now());
        return sessionService.save(session);
    }

    private FastApiAnalyzeDto mockAnalyzeDto() {
        return new FastApiAnalyzeDto(
                "HUMAN",
                -0.65,
                "PROVISIONAL",
                0.15,
                "LOW",
                new FastApiAnalyzeDto.QualityDto(true, 0.95, 28.5, List.of()),
                new FastApiAnalyzeDto.ChunksSummaryDto(1, 1, 0, 1, 0, 0.0, -0.65),
                List.of(new FastApiAnalyzeDto.ChunkDetailDto(0, 0.0, 5.0, 5.0, -0.65, "HUMAN", 0.95, List.of(), 5)),
                Map.of(),
                new FastApiAnalyzeDto.ProcessingMetadataDto(5.0, "req-1", List.of(), 5.0, 2.5)
        );
    }

    @Test
    @DisplayName("Should extract 5.0s window when 160,000 bytes are accumulated and dispatch to FastAPI")
    void shouldExtractWindowAndDispatch() throws Exception {
        CallSession call = createActiveCall();
        when(aiClient.analyzeAudio(any(), any(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), any()))
                .thenReturn(mockAnalyzeDto());

        // Feed 160,000 bytes in 40 chunks of 4,000 bytes (PCM16)
        byte[] chunk = new byte[4000];
        for (int i = 0; i < 40; i++) {
            scheduler.appendAudio(call.getCallId(), "CALLER", "USER-A", chunk, i);
        }

        // Wait briefly for asynchronous dispatcher thread
        Thread.sleep(250);

        verify(aiClient, atLeastOnce()).analyzeAudio(
                any(Resource.class), anyString(), eq(5.0), eq(2.5), any(), eq(true), eq(true), anyString()
        );

        CallSession updated = sessionService.getSessionOrThrow(call.getCallId());
        assertEquals(CallDecision.HUMAN, updated.getLatestDecision());
        assertEquals(-0.65, updated.getDecisionStrength());
    }

    @Test
    @DisplayName("Should flush residual audio of at least 1.0 second on call end")
    void shouldFlushOnCallEnd() throws Exception {
        CallSession call = createActiveCall();
        when(aiClient.analyzeAudio(any(), any(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), any()))
                .thenReturn(mockAnalyzeDto());

        // Feed 40,000 bytes (1.25 seconds of audio, < 5.0s window but >= 1.0s flush threshold)
        byte[] data = new byte[40000];
        scheduler.appendAudio(call.getCallId(), "CALLER", "USER-A", data, 1);

        // Verify not yet dispatched (not 5.0s)
        verify(aiClient, never()).analyzeAudio(any(), any(), any(), any(), any(), any(), any(), any());

        // Trigger flush
        scheduler.flushAndFinish(call.getCallId());

        Thread.sleep(250);

        // Now verify it was dispatched as the final flushed window
        verify(aiClient, times(1)).analyzeAudio(any(), any(), any(), any(), any(), any(), any(), any());
    }
}
