package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.UserPresence;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SignalingTerminalStatesTest {

    private CallSessionService sessionService;
    private UserPresenceService presenceService;
    private CallMediaRelayService mediaRelayService;
    private CallAiWindowScheduler aiScheduler;
    private CallSignalingService signalingService;

    @BeforeEach
    void setUp() {
        sessionService = mock(CallSessionService.class);
        presenceService = mock(UserPresenceService.class);
        mediaRelayService = mock(CallMediaRelayService.class);
        aiScheduler = mock(CallAiWindowScheduler.class);

        signalingService = new CallSignalingService(sessionService, presenceService, mediaRelayService, aiScheduler);
    }

    @Test
    @DisplayName("Signaling: Call to BUSY receiver produces FAILED state and sends CALL_BUSY")
    void testCallToBusyReceiver() {
        UserPresence caller = new UserPresence("USER-A", "+919000000001", "Muthu");
        caller.setStatus(UserPresence.Status.ONLINE);

        UserPresence receiver = new UserPresence("USER-B", "+919000000002", "Friend");
        receiver.setStatus(UserPresence.Status.BUSY);

        when(presenceService.getPresence("USER-A")).thenReturn(caller);
        when(presenceService.getPresence("+919000000002")).thenReturn(null);
        when(presenceService.getPresenceByPhone("+919000000002")).thenReturn(receiver);

        CallSession busySession = new CallSession("CALL-BUSY-1", "Muthu", "Friend");
        when(sessionService.createCallWithParticipants(any(), any(), any(), any())).thenReturn(busySession);

        CallSession result = signalingService.initiateCall("USER-A", "+919000000002");

        assertEquals(CallStatus.FAILED, result.getStatus());
        assertEquals("RECEIVER_BUSY", result.getEndReason());
        verify(presenceService).sendToUser(eq("USER-A"), contains("CALL_BUSY"));
    }

    @Test
    @DisplayName("Signaling: Receiver rejects call -> transitions to REJECTED and notifies caller")
    void testRejectCall() {
        CallSession session = new CallSession("CALL-1001", "Muthu", "Friend");
        session.setCallerUserId("USER-A");
        session.setReceiverUserId("USER-B");
        session.ring();

        when(sessionService.getSessionOrThrow("CALL-1001")).thenReturn(session);

        CallSession rejected = signalingService.rejectCall("CALL-1001", "USER-B", "DECLINED_BY_USER");

        assertEquals(CallStatus.REJECTED, rejected.getStatus());
        assertEquals("DECLINED_BY_USER", rejected.getEndReason());
        verify(presenceService).sendToUser(eq("USER-A"), contains("CALL_REJECTED"));
        verify(presenceService).setUserStatus("USER-A", UserPresence.Status.ONLINE, null);
        verify(presenceService).setUserStatus("USER-B", UserPresence.Status.ONLINE, null);
    }

    @Test
    @DisplayName("Signaling: Caller cancels call before answer -> transitions to CANCELLED and notifies receiver")
    void testCancelCall() {
        CallSession session = new CallSession("CALL-1001", "Muthu", "Friend");
        session.setCallerUserId("USER-A");
        session.setReceiverUserId("USER-B");
        session.ring();

        when(sessionService.getSessionOrThrow("CALL-1001")).thenReturn(session);

        CallSession cancelled = signalingService.cancelCall("CALL-1001", "USER-A", "HANG_UP_EARLY");

        assertEquals(CallStatus.CANCELLED, cancelled.getStatus());
        assertEquals("HANG_UP_EARLY", cancelled.getEndReason());
        verify(presenceService).sendToUser(eq("USER-B"), contains("CALL_CANCELLED"));
        verify(presenceService).setUserStatus("USER-A", UserPresence.Status.ONLINE, null);
        verify(presenceService).setUserStatus("USER-B", UserPresence.Status.ONLINE, null);
    }

    @Test
    @DisplayName("Security: Unauthorized third party cannot accept or reject calls")
    void testUnauthorizedUserActionsRejected() {
        CallSession session = new CallSession("CALL-1001", "Muthu", "Friend");
        session.setCallerUserId("USER-A");
        session.setReceiverUserId("USER-B");
        session.ring();

        when(sessionService.getSessionOrThrow("CALL-1001")).thenReturn(session);

        assertThrows(IllegalArgumentException.class, () ->
                signalingService.acceptCall("CALL-1001", "USER-ATTACKER"));

        assertThrows(IllegalArgumentException.class, () ->
                signalingService.rejectCall("CALL-1001", "USER-ATTACKER", "REASON"));

        assertThrows(IllegalArgumentException.class, () ->
                signalingService.cancelCall("CALL-1001", "USER-ATTACKER", "REASON"));
    }
}
