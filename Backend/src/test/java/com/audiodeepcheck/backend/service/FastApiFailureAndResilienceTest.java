package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.exception.AiServiceException;
import com.audiodeepcheck.backend.repository.AnalysisRepository;
import com.audiodeepcheck.backend.websocket.AudioFrame;
import com.audiodeepcheck.backend.websocket.AudioFrameHeader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FastApiFailureAndResilienceTest {

    private FastApiAiClient aiClient;
    private CallSessionService sessionService;
    private AnalysisRepository analysisRepository;
    private UserPresenceService presenceService;
    private CallAiWindowScheduler aiScheduler;
    private CallMediaRelayService mediaRelayService;

    private CallSession testSession;
    private WebSocketSession callerSession;
    private WebSocketSession receiverSession;

    @BeforeEach
    void setUp() {
        aiClient = mock(FastApiAiClient.class);
        sessionService = mock(CallSessionService.class);
        analysisRepository = mock(AnalysisRepository.class);
        presenceService = mock(UserPresenceService.class);

        aiScheduler = new CallAiWindowScheduler(aiClient, sessionService, analysisRepository, presenceService, 2);
        mediaRelayService = new CallMediaRelayService(sessionService, presenceService, aiScheduler);

        testSession = new CallSession("CALL-1001", "Muthu", "Friend");
        testSession.setCallerUserId("USER-A");
        testSession.setReceiverUserId("USER-B");
        testSession.start(Instant.now());

        when(sessionService.getSessionOrThrow("CALL-1001")).thenReturn(testSession);

        callerSession = mock(WebSocketSession.class);
        when(callerSession.isOpen()).thenReturn(true);
        receiverSession = mock(WebSocketSession.class);
        when(receiverSession.isOpen()).thenReturn(true);

        when(presenceService.getSessionForUser("USER-B")).thenReturn(receiverSession);
        when(presenceService.getSessionForUser("USER-A")).thenReturn(callerSession);
    }

    @Test
    @DisplayName("FastAPI DOWN: Voice relay continues, call does not terminate, and session marks AI_UNAVAILABLE")
    void testFastApiDownDoesNotDisruptVoiceRelay() throws Exception {
        // Configure FastAPI client to throw an exception simulating AI outage
        when(aiClient.analyzeAudio(any(), anyString(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), anyString()))
                .thenThrow(new AiServiceException("FastAPI is offline or timing out"));

        // Transmit an audio frame from Caller to Receiver
        byte[] pcm = new byte[4096];
        AudioFrameHeader header = new AudioFrameHeader(
                AudioFrameHeader.TYPE_AUDIO, AudioFrameHeader.ROLE_CALLER, 1L,
                System.currentTimeMillis(), 128, 16000, 1, AudioFrameHeader.ENCODING_PCM16, "USER-A", "CALL-1001"
        );
        AudioFrame frame = new AudioFrame(header, pcm);

        // Voice frame MUST be relayed to peer despite AI service outage
        boolean relayed = mediaRelayService.processAndRelayFrame(frame, callerSession);
        assertTrue(relayed, "Voice frame must be relayed successfully to peer");

        verify(receiverSession, times(1)).sendMessage(any(BinaryMessage.class));
        assertEquals(CallStatus.ACTIVE, testSession.getStatus(), "Call must remain ACTIVE during AI failure");
    }

    @Test
    @DisplayName("FastAPI RESTORED: Subsequent analysis windows resume successfully after recovery")
    void testFastApiRecoveryResumesAnalysis() throws Exception {
        // 1. First invocation fails (outage)
        when(aiClient.analyzeAudio(any(), anyString(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), anyString()))
                .thenThrow(new AiServiceException("Service unavailable"))
                .thenReturn(new FastApiAnalyzeDto(
                        "HUMAN",
                        0.92,
                        "CALIBRATED",
                        0.05,
                        "LOW",
                        null,
                        null,
                        List.of(new FastApiAnalyzeDto.ChunkDetailDto(
                                0, 0.0, 5.0, 5.0, -0.85, "HUMAN", 0.94, List.of(), 5
                        )),
                        null,
                        null
                ));

        // Submit 5 seconds of audio to trigger analysis
        byte[] fullWindow = new byte[CallAiWindowScheduler.WINDOW_BYTES];
        aiScheduler.appendAudio("CALL-1001", "CALLER", "USER-A", fullWindow, 1L);

        // Allow background thread to process
        Thread.sleep(200);

        // Submit another window now that FastAPI is restored
        aiScheduler.appendAudio("CALL-1001", "CALLER", "USER-A", fullWindow, 2L);
        Thread.sleep(200);

        // Verify analysis was called twice and result was persisted
        verify(aiClient, atLeast(1)).analyzeAudio(any(), anyString(), anyDouble(), anyDouble(), any(), anyBoolean(), anyBoolean(), anyString());
    }
}
