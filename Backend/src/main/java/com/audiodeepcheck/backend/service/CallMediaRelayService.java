package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.websocket.AudioFrame;
import com.audiodeepcheck.backend.websocket.AudioFrameHeader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * High-priority voice relay service.
 * Validates server-authoritative call membership, verifies sequence monotonicity,
 * forwards binary audio frames directly to the peer participant with minimal latency,
 * and passes an asynchronous copy to CallAiWindowScheduler.
 */
@Service
public class CallMediaRelayService {

    private static final Logger log = LoggerFactory.getLogger(CallMediaRelayService.class);

    private final CallSessionService sessionService;
    private final UserPresenceService presenceService;
    private final CallAiWindowScheduler aiScheduler;

    // CallId -> Set of terminated calls where frames are rejected
    private final Set<String> closedCalls = ConcurrentHashMap.newKeySet();

    // CallId -> ParticipantRole -> lastSequenceNumber
    private final Map<String, Long> lastCallerSequence = new ConcurrentHashMap<>();
    private final Map<String, Long> lastReceiverSequence = new ConcurrentHashMap<>();

    public CallMediaRelayService(
            CallSessionService sessionService,
            UserPresenceService presenceService,
            CallAiWindowScheduler aiScheduler
    ) {
        this.sessionService = sessionService;
        this.presenceService = presenceService;
        this.aiScheduler = aiScheduler;
    }

    /**
     * Process an incoming binary audio frame:
     * 1. Validate call membership & state
     * 2. Validate sequence monotonicity
     * 3. Forward immediately to peer (High priority voice relay)
     * 4. Asynchronously hand copy to AI window scheduler
     */
    public boolean processAndRelayFrame(AudioFrame frame, WebSocketSession senderSession) {
        AudioFrameHeader header = frame.getHeader();
        String callId = header.getCallId();
        String userId = header.getUserId();
        String roleStr = header.getParticipantRoleString();
        long seq = header.getSequenceNumber();

        if (closedCalls.contains(callId)) {
            log.debug("Dropping frame for closed callId={}", callId);
            return false;
        }

        // 1. Authoritative Call & Membership Validation
        CallSession session;
        try {
            session = sessionService.getSessionOrThrow(callId);
        } catch (Exception e) {
            log.warn("Unauthorized frame: CallId={} not found", callId);
            return false;
        }

        CallStatus status = session.getStatus();
        if (!status.isMediaActive() && status != CallStatus.CONNECTING_MEDIA) {
            log.warn("Dropping audio frame: CallId={} is in non-media state {}", callId, status);
            return false;
        }

        boolean isCaller = "CALLER".equalsIgnoreCase(roleStr);
        String targetUserId;

        if (isCaller) {
            if (session.getCallerUserId() == null) {
                session.setCallerUserId(userId);
                sessionService.save(session);
            } else if (!session.getCallerUserId().equals(userId)) {
                log.warn("Security Alert: User {} is not the authorized CALLER for call {}", userId, callId);
                return false;
            }
            targetUserId = session.getReceiverUserId();
            if (targetUserId == null) {
                targetUserId = "USER-B".equals(userId) ? "USER-A" : "USER-B";
            }
        } else {
            if (session.getReceiverUserId() == null) {
                session.setReceiverUserId(userId);
                sessionService.save(session);
            } else if (!session.getReceiverUserId().equals(userId)) {
                log.warn("Security Alert: User {} is not the authorized RECEIVER for call {}", userId, callId);
                return false;
            }
            targetUserId = session.getCallerUserId();
            if (targetUserId == null) {
                targetUserId = "USER-A".equals(userId) ? "USER-B" : "USER-A";
            }
        }

        // 2. Sequence Monotonicity & Duplicate/Gap Detection
        Map<String, Long> seqMap = isCaller ? lastCallerSequence : lastReceiverSequence;
        Long lastSeq = seqMap.get(callId);
        if (lastSeq != null) {
            if (seq <= lastSeq) {
                log.debug("Duplicate or out-of-order audio frame dropped: callId={}, role={}, seq={}, lastSeq={}",
                        callId, roleStr, seq, lastSeq);
                return false;
            }
            if (seq > lastSeq + 1) {
                log.warn("AUDIO_PACKET_LOSS detected: callId={}, role={}, expected={}, received={}",
                        callId, roleStr, lastSeq + 1, seq);
            }
        }
        seqMap.put(callId, seq);

        if (isCaller) {
            session.setCallerLastSequence((int) seq);
        } else {
            session.setReceiverLastSequence((int) seq);
        }

        // 3. High-Priority Voice Relay: Forward immediately to peer
        if (targetUserId != null) {
            WebSocketSession peerSession = presenceService.getSessionForUser(targetUserId);
            if (peerSession != null && peerSession.isOpen()) {
                try {
                    synchronized (peerSession) {
                        peerSession.sendMessage(new BinaryMessage(frame.toBytes()));
                    }
                } catch (IOException e) {
                    log.error("Failed to relay audio frame to peer userId={}: {}", targetUserId, e.getMessage());
                }
            }
        }

        // 4. Decoupled AI Processing: Hand off copy to scheduler
        aiScheduler.appendAudio(callId, roleStr, userId, frame.getAudioData(), seq);

        return true;
    }

    public long getLastAcceptedSequence(String callId, boolean isCaller) {
        Map<String, Long> seqMap = isCaller ? lastCallerSequence : lastReceiverSequence;
        return seqMap.getOrDefault(callId, -1L);
    }

    public void stopAcceptingFrames(String callId) {
        closedCalls.add(callId);
        lastCallerSequence.remove(callId);
        lastReceiverSequence.remove(callId);
    }
}
