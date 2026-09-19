package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.repository.InMemoryAnalysisRepository;
import com.audiodeepcheck.backend.repository.InMemoryCallSessionRepository;
import com.audiodeepcheck.backend.websocket.AudioFrame;
import com.audiodeepcheck.backend.websocket.AudioFrameHeader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CallMediaRelayServiceTest {

    private CallSessionService sessionService;
    private UserPresenceService presenceService;
    private CallAiWindowScheduler aiScheduler;
    private CallMediaRelayService mediaRelayService;

    private WebSocketSession callerSession;
    private WebSocketSession receiverSession;

    @BeforeEach
    void setUp() {
        sessionService = new CallSessionService(new InMemoryCallSessionRepository(), new InMemoryAnalysisRepository());
        presenceService = new UserPresenceService();
        aiScheduler = Mockito.mock(CallAiWindowScheduler.class);
        mediaRelayService = new CallMediaRelayService(sessionService, presenceService, aiScheduler);

        callerSession = Mockito.mock(WebSocketSession.class);
        when(callerSession.getId()).thenReturn("sess-caller");
        when(callerSession.isOpen()).thenReturn(true);

        receiverSession = Mockito.mock(WebSocketSession.class);
        when(receiverSession.getId()).thenReturn("sess-receiver");
        when(receiverSession.isOpen()).thenReturn(true);

        presenceService.registerPresence("USER-A", "+91 90000 00001", "Muthu", callerSession);
        presenceService.registerPresence("USER-B", "+91 90000 00002", "Friend", receiverSession);
    }

    private CallSession createActiveCall() {
        CallSession session = sessionService.createCallWithParticipants("Muthu", "Friend", "USER-A", "USER-B");
        session.start(Instant.now());
        return sessionService.save(session);
    }

    private AudioFrame createFrame(String callId, String userId, byte role, long seq) {
        AudioFrameHeader header = new AudioFrameHeader(
                AudioFrameHeader.TYPE_AUDIO,
                role,
                seq,
                System.currentTimeMillis(),
                128,
                16000,
                1,
                AudioFrameHeader.ENCODING_PCM16,
                userId,
                callId
        );
        byte[] payload = new byte[256];
        return new AudioFrame(header, payload);
    }

    @Test
    @DisplayName("Should forward valid audio frame from Caller to Receiver's WebSocket and copy to AI scheduler")
    void shouldRelayFrameFromCallerToReceiver() throws IOException {
        CallSession call = createActiveCall();
        AudioFrame frame = createFrame(call.getCallId(), "USER-A", AudioFrameHeader.ROLE_CALLER, 0);

        boolean processed = mediaRelayService.processAndRelayFrame(frame, callerSession);
        assertTrue(processed);

        // Verify receiver session received binary message
        verify(receiverSession, times(1)).sendMessage(any(BinaryMessage.class));

        // Verify AI scheduler received audio copy
        verify(aiScheduler, times(1)).appendAudio(
                eq(call.getCallId()), eq("CALLER"), eq("USER-A"), eq(frame.getAudioData()), eq(0L)
        );
    }

    @Test
    @DisplayName("Should reject audio frame if sender userId does not match call session membership")
    void shouldRejectUnauthorizedAudio() {
        CallSession call = createActiveCall();
        // Malicious user C attempting to inject audio into call
        AudioFrame maliciousFrame = createFrame(call.getCallId(), "USER-C", AudioFrameHeader.ROLE_CALLER, 0);

        boolean processed = mediaRelayService.processAndRelayFrame(maliciousFrame, callerSession);
        assertFalse(processed);
        verifyNoInteractions(aiScheduler);
    }

    @Test
    @DisplayName("Should reject duplicate sequence numbers")
    void shouldRejectDuplicateSequences() {
        CallSession call = createActiveCall();
        AudioFrame frame0 = createFrame(call.getCallId(), "USER-A", AudioFrameHeader.ROLE_CALLER, 0);
        AudioFrame frame1 = createFrame(call.getCallId(), "USER-A", AudioFrameHeader.ROLE_CALLER, 1);
        AudioFrame frameDup = createFrame(call.getCallId(), "USER-A", AudioFrameHeader.ROLE_CALLER, 1);

        assertTrue(mediaRelayService.processAndRelayFrame(frame0, callerSession));
        assertTrue(mediaRelayService.processAndRelayFrame(frame1, callerSession));
        assertFalse(mediaRelayService.processAndRelayFrame(frameDup, callerSession));
    }

    @Test
    @DisplayName("Should accept frame after sequence gap (packet loss)")
    void shouldHandleSequenceGap() {
        CallSession call = createActiveCall();
        AudioFrame frame0 = createFrame(call.getCallId(), "USER-A", AudioFrameHeader.ROLE_CALLER, 0);
        AudioFrame frameGap = createFrame(call.getCallId(), "USER-A", AudioFrameHeader.ROLE_CALLER, 5);

        assertTrue(mediaRelayService.processAndRelayFrame(frame0, callerSession));
        assertTrue(mediaRelayService.processAndRelayFrame(frameGap, callerSession));
        assertEquals(5L, mediaRelayService.getLastAcceptedSequence(call.getCallId(), true));
    }
}
