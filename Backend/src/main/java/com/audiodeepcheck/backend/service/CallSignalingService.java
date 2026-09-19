package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.UserPresence;
import com.audiodeepcheck.backend.exception.InvalidCallStateException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;

/**
 * Server-authoritative call signaling service.
 * Coordinates call invitation, ringing, acceptance, rejection, cancellation, and graceful teardown.
 */
@Service
public class CallSignalingService {

    private static final Logger log = LoggerFactory.getLogger(CallSignalingService.class);

    private final CallSessionService sessionService;
    private final UserPresenceService presenceService;
    private final CallMediaRelayService mediaRelayService;
    private final CallAiWindowScheduler aiScheduler;

    public CallSignalingService(
            CallSessionService sessionService,
            UserPresenceService presenceService,
            CallMediaRelayService mediaRelayService,
            CallAiWindowScheduler aiScheduler
    ) {
        this.sessionService = sessionService;
        this.presenceService = presenceService;
        this.mediaRelayService = mediaRelayService;
        this.aiScheduler = aiScheduler;
    }

    /**
     * Initiate an outgoing call from caller to receiver.
     */
    public CallSession initiateCall(String callerUserId, String receiverPhoneOrId) {
        UserPresence caller = presenceService.getPresence(callerUserId);
        if (caller == null) {
            throw new IllegalArgumentException("Caller not registered: " + callerUserId);
        }

        UserPresence receiver = presenceService.getPresence(receiverPhoneOrId);
        if (receiver == null) {
            receiver = presenceService.getPresenceByPhone(receiverPhoneOrId);
        }

        if (receiver == null) {
            log.warn("Call failed: target receiver '{}' not found", receiverPhoneOrId);
            throw new IllegalArgumentException("Receiver not found: " + receiverPhoneOrId);
        }

        if (receiver.getStatus() == UserPresence.Status.BUSY || receiver.getStatus() == UserPresence.Status.IN_CALL) {
            log.info("Receiver {} is BUSY", receiver.getUserId());
            CallSession busySession = sessionService.createCallWithParticipants(
                    caller.getDisplayName(), receiver.getDisplayName(), caller.getUserId(), receiver.getUserId()
            );
            busySession.fail("RECEIVER_BUSY");
            sessionService.save(busySession);

            presenceService.sendToUser(callerUserId, String.format(Locale.US,
                    "{\"type\":\"CALL_BUSY\",\"callId\":\"%s\",\"receiver\":\"%s\"}",
                    busySession.getCallId(), receiver.getDisplayName()
            ));
            return busySession;
        }

        // Create call session
        CallSession session = sessionService.createCallWithParticipants(
                caller.getDisplayName(), receiver.getDisplayName(), caller.getUserId(), receiver.getUserId()
        );
        session.ring();
        sessionService.save(session);

        // Update presence
        presenceService.setUserStatus(caller.getUserId(), UserPresence.Status.BUSY, session.getCallId());
        presenceService.setUserStatus(receiver.getUserId(), UserPresence.Status.BUSY, session.getCallId());

        // Notify caller that call is ringing
        presenceService.sendToUser(caller.getUserId(), String.format(Locale.US,
                "{\"type\":\"CALL_RINGING\",\"callId\":\"%s\",\"receiver\":{\"userId\":\"%s\",\"phoneNumber\":\"%s\",\"displayName\":\"%s\"}}",
                session.getCallId(), receiver.getUserId(), receiver.getPhoneNumber(), receiver.getDisplayName()
        ));

        // Notify receiver of incoming call
        presenceService.sendToUser(receiver.getUserId(), String.format(Locale.US,
                "{\"type\":\"INCOMING_CALL\",\"callId\":\"%s\",\"caller\":{\"userId\":\"%s\",\"phoneNumber\":\"%s\",\"displayName\":\"%s\"},\"timestamp\":%d}",
                session.getCallId(), caller.getUserId(), caller.getPhoneNumber(), caller.getDisplayName(), System.currentTimeMillis()
        ));

        log.info("Call initiated: callId={}, from={}, to={}", session.getCallId(), caller.getUserId(), receiver.getUserId());
        return session;
    }

    /**
     * Accept an incoming call.
     */
    public CallSession acceptCall(String callId, String userId) {
        CallSession session = sessionService.getSessionOrThrow(callId);

        if (session.getReceiverUserId() != null && !session.getReceiverUserId().equals(userId)) {
            throw new IllegalArgumentException("User " + userId + " is not authorized to accept call " + callId);
        }

        session.accept();
        session.connectMedia();
        session.start(Instant.now());
        sessionService.save(session);

        // Update presence to IN_CALL
        if (session.getCallerUserId() != null) {
            presenceService.setUserStatus(session.getCallerUserId(), UserPresence.Status.IN_CALL, callId);
        }
        if (session.getReceiverUserId() != null) {
            presenceService.setUserStatus(session.getReceiverUserId(), UserPresence.Status.IN_CALL, callId);
        }

        String activeMsg = String.format(Locale.US,
                "{\"type\":\"CALL_ACTIVE\",\"callId\":\"%s\",\"startedAt\":\"%s\"}",
                callId, session.getStartedAt()
        );

        if (session.getCallerUserId() != null) {
            presenceService.sendToUser(session.getCallerUserId(), activeMsg);
        }
        if (session.getReceiverUserId() != null) {
            presenceService.sendToUser(session.getReceiverUserId(), activeMsg);
        }
        // Broadcast to all connected monitoring dashboards
        presenceService.broadcast(activeMsg);

        log.info("Call accepted: callId={}, acceptedBy={}", callId, userId);
        return session;
    }

    /**
     * Reject an incoming call.
     */
    public CallSession rejectCall(String callId, String userId, String reason) {
        CallSession session = sessionService.getSessionOrThrow(callId);

        if (session.getReceiverUserId() != null && !session.getReceiverUserId().equals(userId)) {
            throw new IllegalArgumentException("User " + userId + " is not authorized to reject call " + callId);
        }

        session.reject(reason != null ? reason : "USER_REJECTED");
        sessionService.save(session);

        // Reset presence
        resetCallPresence(session);

        String rejectMsg = String.format(Locale.US,
                "{\"type\":\"CALL_REJECTED\",\"callId\":\"%s\",\"reason\":\"%s\"}",
                callId, session.getEndReason()
        );

        if (session.getCallerUserId() != null) {
            presenceService.sendToUser(session.getCallerUserId(), rejectMsg);
        }

        log.info("Call rejected: callId={}, by={}, reason={}", callId, userId, session.getEndReason());
        return session;
    }

    /**
     * Cancel an outgoing call before it is answered.
     */
    public CallSession cancelCall(String callId, String userId, String reason) {
        CallSession session = sessionService.getSessionOrThrow(callId);

        if (session.getCallerUserId() != null && !session.getCallerUserId().equals(userId)) {
            throw new IllegalArgumentException("User " + userId + " is not authorized to cancel call " + callId);
        }

        session.cancel(reason != null ? reason : "CALLER_CANCELLED");
        sessionService.save(session);

        resetCallPresence(session);

        String cancelMsg = String.format(Locale.US,
                "{\"type\":\"CALL_CANCELLED\",\"callId\":\"%s\",\"reason\":\"%s\"}",
                callId, session.getEndReason()
        );

        if (session.getReceiverUserId() != null) {
            presenceService.sendToUser(session.getReceiverUserId(), cancelMsg);
        }

        log.info("Call cancelled: callId={}, by={}, reason={}", callId, userId, session.getEndReason());
        return session;
    }

    /**
     * Terminate an active call with audio flush and final persistence.
     */
    public CallSession endCall(String callId, String userId, String reason) {
        CallSession session = sessionService.getSessionOrThrow(callId);

        if (session.getStatus().isTerminal()) {
            return session;
        }

        // 1. Mark ending & stop accepting new audio frames
        session.markEnding();
        mediaRelayService.stopAcceptingFrames(callId);

        // 2. Flush pending audio buffers to AI queue
        aiScheduler.flushAndFinish(callId);

        // 3. Mark ended & completed
        session.end(Instant.now(), reason != null ? reason : "USER_ENDED");
        session.complete();
        sessionService.save(session);

        // 4. Reset presence
        resetCallPresence(session);

        // 5. Notify both participants
        String endMsg = String.format(Locale.US,
                "{\"type\":\"CALL_ENDED\",\"callId\":\"%s\",\"reason\":\"%s\",\"durationSec\":%d}",
                callId, session.getEndReason(), session.getDurationSec()
        );

        if (session.getCallerUserId() != null) {
            presenceService.sendToUser(session.getCallerUserId(), endMsg);
        }
        if (session.getReceiverUserId() != null) {
            presenceService.sendToUser(session.getReceiverUserId(), endMsg);
        }
        // Broadcast to all connected monitoring dashboards
        presenceService.broadcast(endMsg);

        log.info("Call ended: callId={}, by={}, duration={}s, reason={}",
                callId, userId, session.getDurationSec(), session.getEndReason());
        return session;
    }

    private void resetCallPresence(CallSession session) {
        if (session.getCallerUserId() != null) {
            presenceService.setUserStatus(session.getCallerUserId(), UserPresence.Status.ONLINE, null);
        }
        if (session.getReceiverUserId() != null) {
            presenceService.setUserStatus(session.getReceiverUserId(), UserPresence.Status.ONLINE, null);
        }
    }
}
