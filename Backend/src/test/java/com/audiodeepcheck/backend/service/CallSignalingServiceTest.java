package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.UserPresence;
import com.audiodeepcheck.backend.repository.InMemoryAnalysisRepository;
import com.audiodeepcheck.backend.repository.InMemoryCallSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CallSignalingServiceTest {

    private CallSessionService sessionService;
    private UserPresenceService presenceService;
    private CallMediaRelayService mediaRelayService;
    private CallAiWindowScheduler aiScheduler;
    private CallSignalingService signalingService;

    @BeforeEach
    void setUp() {
        sessionService = new CallSessionService(new InMemoryCallSessionRepository(), new InMemoryAnalysisRepository());
        presenceService = new UserPresenceService();
        mediaRelayService = Mockito.mock(CallMediaRelayService.class);
        aiScheduler = Mockito.mock(CallAiWindowScheduler.class);

        signalingService = new CallSignalingService(sessionService, presenceService, mediaRelayService, aiScheduler);

        // Register User A and User B
        presenceService.registerPresence("USER-A", "+91 90000 00001", "Muthu", null);
        presenceService.registerPresence("USER-B", "+91 90000 00002", "Friend", null);
    }

    @Test
    @DisplayName("Should successfully initiate call from User A to User B and transition to RINGING")
    void shouldInitiateCallToRinging() {
        CallSession session = signalingService.initiateCall("USER-A", "+91 90000 00002");

        assertNotNull(session);
        assertEquals(CallStatus.RINGING, session.getStatus());
        assertEquals("USER-A", session.getCallerUserId());
        assertEquals("USER-B", session.getReceiverUserId());
        assertEquals(UserPresence.Status.BUSY, presenceService.getPresence("USER-A").getStatus());
        assertEquals(UserPresence.Status.BUSY, presenceService.getPresence("USER-B").getStatus());
    }

    @Test
    @DisplayName("Should transition call from RINGING to ACTIVE when receiver accepts")
    void shouldAcceptCallToActive() {
        CallSession session = signalingService.initiateCall("USER-A", "+91 90000 00002");
        CallSession activeSession = signalingService.acceptCall(session.getCallId(), "USER-B");

        assertEquals(CallStatus.ACTIVE, activeSession.getStatus());
        assertNotNull(activeSession.getStartedAt());
        assertEquals(UserPresence.Status.IN_CALL, presenceService.getPresence("USER-A").getStatus());
        assertEquals(UserPresence.Status.IN_CALL, presenceService.getPresence("USER-B").getStatus());
    }

    @Test
    @DisplayName("Should reject call when non-receiver attempts to accept")
    void shouldRejectUnauthorizedAccept() {
        CallSession session = signalingService.initiateCall("USER-A", "+91 90000 00002");

        assertThrows(IllegalArgumentException.class, () ->
                signalingService.acceptCall(session.getCallId(), "USER-A")
        );
    }

    @Test
    @DisplayName("Should transition call to REJECTED when receiver declines")
    void shouldRejectCall() {
        CallSession session = signalingService.initiateCall("USER-A", "+91 90000 00002");
        CallSession rejected = signalingService.rejectCall(session.getCallId(), "USER-B", "DECLINED");

        assertEquals(CallStatus.REJECTED, rejected.getStatus());
        assertEquals("DECLINED", rejected.getEndReason());
        assertEquals(UserPresence.Status.ONLINE, presenceService.getPresence("USER-A").getStatus());
        assertEquals(UserPresence.Status.ONLINE, presenceService.getPresence("USER-B").getStatus());
    }

    @Test
    @DisplayName("Should transition call to CANCELLED when caller cancels")
    void shouldCancelCall() {
        CallSession session = signalingService.initiateCall("USER-A", "+91 90000 00002");
        CallSession cancelled = signalingService.cancelCall(session.getCallId(), "USER-A", "MISTAKE");

        assertEquals(CallStatus.CANCELLED, cancelled.getStatus());
        assertEquals("MISTAKE", cancelled.getEndReason());
        assertEquals(UserPresence.Status.ONLINE, presenceService.getPresence("USER-A").getStatus());
        assertEquals(UserPresence.Status.ONLINE, presenceService.getPresence("USER-B").getStatus());
    }

    @Test
    @DisplayName("Should flush audio buffers and transition to COMPLETED when active call is ended")
    void shouldEndCallWithFlush() {
        CallSession session = signalingService.initiateCall("USER-A", "+91 90000 00002");
        signalingService.acceptCall(session.getCallId(), "USER-B");

        CallSession ended = signalingService.endCall(session.getCallId(), "USER-A", "USER_ENDED");

        verify(mediaRelayService, times(1)).stopAcceptingFrames(session.getCallId());
        verify(aiScheduler, times(1)).flushAndFinish(session.getCallId());

        assertEquals(CallStatus.COMPLETED, ended.getStatus());
        assertNotNull(ended.getEndedAt());
        assertEquals(UserPresence.Status.ONLINE, presenceService.getPresence("USER-A").getStatus());
        assertEquals(UserPresence.Status.ONLINE, presenceService.getPresence("USER-B").getStatus());
    }
}
