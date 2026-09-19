package com.audiodeepcheck.backend.websocket;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.UserPresence;
import com.audiodeepcheck.backend.service.CallMediaRelayService;
import com.audiodeepcheck.backend.service.CallSignalingService;
import com.audiodeepcheck.backend.service.UserPresenceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Collection;
import java.util.Locale;

/**
 * WebSocket handler managing signaling events (JSON) and real-time audio transport (Binary frames).
 */
@Component
public class CallWebSocketHandler extends AbstractWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CallWebSocketHandler.class);

    private final UserPresenceService presenceService;
    private final CallSignalingService signalingService;
    private final CallMediaRelayService mediaRelayService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CallWebSocketHandler(
            UserPresenceService presenceService,
            CallSignalingService signalingService,
            CallMediaRelayService mediaRelayService
    ) {
        this.presenceService = presenceService;
        this.signalingService = signalingService;
        this.mediaRelayService = mediaRelayService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket connected: sessionId={}, remoteAddress={}", session.getId(), session.getRemoteAddress());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        try {
            JsonNode json = objectMapper.readTree(payload);
            String type = json.path("type").asText("");

            switch (type) {
                case "REGISTER_PRESENCE" -> handleRegisterPresence(session, json);
                case "HEARTBEAT" -> handleHeartbeat(session, json);
                case "GET_PRESENCE" -> handleGetPresence(session);
                case "CALL_INVITE" -> handleCallInvite(session, json);
                case "CALL_ACCEPT" -> handleCallAccept(session, json);
                case "CALL_REJECT" -> handleCallReject(session, json);
                case "CALL_CANCEL" -> handleCallCancel(session, json);
                case "CALL_END" -> handleCallEnd(session, json);
                case "RECONNECT" -> handleReconnect(session, json);
                default -> {
                    log.warn("Unknown text signaling message type: {}", type);
                    sendError(session, "UNKNOWN_MESSAGE_TYPE", "Unrecognized signaling message type: " + type);
                }
            }
        } catch (Exception e) {
            log.error("Error processing text signaling message: {}", e.getMessage(), e);
            sendError(session, "BAD_REQUEST", "Failed to process message: " + e.getMessage());
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        ByteBuffer byteBuffer = message.getPayload();
        try {
            AudioFrame frame = AudioFrameHeader.decode(byteBuffer);
            mediaRelayService.processAndRelayFrame(frame, session);
        } catch (IllegalArgumentException e) {
            log.warn("Corrupt or invalid binary frame received: {}", e.getMessage());
        } catch (Exception e) {
            log.error("Error processing binary audio frame: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("WebSocket closed: sessionId={}, status={}", session.getId(), status);
        presenceService.removeSession(session);
        broadcastPresenceUpdate();
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WebSocket transport error: sessionId={}, error={}", session.getId(), exception.getMessage());
    }

    // --- Signaling Handlers ---

    private void handleRegisterPresence(WebSocketSession session, JsonNode json) {
        String userId = json.path("userId").asText();
        String phone = json.path("phoneNumber").asText();
        String name = json.path("displayName").asText(userId);

        UserPresence presence = presenceService.registerPresence(userId, phone, name, session);
        String ack = String.format(Locale.US,
                "{\"type\":\"PRESENCE_REGISTERED\",\"userId\":\"%s\",\"status\":\"%s\"}",
                presence.getUserId(), presence.getStatus()
        );
        sendRaw(session, ack);
        broadcastPresenceUpdate();
    }

    private void handleHeartbeat(WebSocketSession session, JsonNode json) {
        String userId = json.path("userId").asText();
        presenceService.recordHeartbeat(userId);
    }

    private void handleGetPresence(WebSocketSession session) {
        sendRaw(session, buildPresenceListJson());
    }

    private void handleCallInvite(WebSocketSession session, JsonNode json) {
        String callerUserId = json.path("callerUserId").asText();
        String receiverTarget = json.path("receiverTarget").asText();
        try {
            signalingService.initiateCall(callerUserId, receiverTarget);
        } catch (IllegalArgumentException e) {
            sendError(session, "CALL_INVITE_FAILED", e.getMessage());
        }
    }

    private void handleCallAccept(WebSocketSession session, JsonNode json) {
        String callId = json.path("callId").asText();
        String userId = json.path("userId").asText();
        try {
            signalingService.acceptCall(callId, userId);
        } catch (Exception e) {
            sendError(session, "CALL_ACCEPT_FAILED", e.getMessage());
        }
    }

    private void handleCallReject(WebSocketSession session, JsonNode json) {
        String callId = json.path("callId").asText();
        String userId = json.path("userId").asText();
        String reason = json.path("reason").asText("USER_REJECTED");
        try {
            signalingService.rejectCall(callId, userId, reason);
        } catch (Exception e) {
            sendError(session, "CALL_REJECT_FAILED", e.getMessage());
        }
    }

    private void handleCallCancel(WebSocketSession session, JsonNode json) {
        String callId = json.path("callId").asText();
        String userId = json.path("userId").asText();
        String reason = json.path("reason").asText("CALLER_CANCELLED");
        try {
            signalingService.cancelCall(callId, userId, reason);
        } catch (Exception e) {
            sendError(session, "CALL_CANCEL_FAILED", e.getMessage());
        }
    }

    private void handleCallEnd(WebSocketSession session, JsonNode json) {
        String callId = json.path("callId").asText();
        String userId = json.path("userId").asText();
        String reason = json.path("reason").asText("USER_ENDED");
        try {
            signalingService.endCall(callId, userId, reason);
        } catch (Exception e) {
            sendError(session, "CALL_END_FAILED", e.getMessage());
        }
    }

    private void handleReconnect(WebSocketSession session, JsonNode json) {
        String callId = json.path("callId").asText();
        String userId = json.path("userId").asText();
        boolean isCaller = json.path("isCaller").asBoolean(true);

        long lastSeq = mediaRelayService.getLastAcceptedSequence(callId, isCaller);
        String ack = String.format(Locale.US,
                "{\"type\":\"RECONNECT_ACK\",\"callId\":\"%s\",\"userId\":\"%s\",\"lastAcceptedSequence\":%d}",
                callId, userId, lastSeq
        );
        sendRaw(session, ack);
    }

    private void broadcastPresenceUpdate() {
        presenceService.broadcast(buildPresenceListJson());
    }

    private String buildPresenceListJson() {
        Collection<UserPresence> users = presenceService.getAllPresences();
        try {
            return String.format(Locale.US, "{\"type\":\"PRESENCE_UPDATE\",\"users\":%s}",
                    objectMapper.writeValueAsString(users));
        } catch (Exception e) {
            return "{\"type\":\"PRESENCE_UPDATE\",\"users\":[]}";
        }
    }

    private void sendRaw(WebSocketSession session, String text) {
        if (session != null && session.isOpen()) {
            try {
                synchronized (session) {
                    session.sendMessage(new TextMessage(text));
                }
            } catch (IOException e) {
                log.error("Failed to send text message to session {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    private void sendError(WebSocketSession session, String code, String message) {
        String err = String.format(Locale.US,
                "{\"type\":\"ERROR\",\"code\":\"%s\",\"message\":\"%s\"}",
                code, message != null ? message.replace("\"", "\\\"") : ""
        );
        sendRaw(session, err);
    }
}
