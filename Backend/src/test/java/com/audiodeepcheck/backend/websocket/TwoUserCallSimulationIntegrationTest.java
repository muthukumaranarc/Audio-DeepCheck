package com.audiodeepcheck.backend.websocket;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.service.CallSessionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.socket.*;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

import java.nio.ByteBuffer;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TwoUserCallSimulationIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private CallSessionService callSessionService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("Complete two-user live call simulation over WebSockets: invite, ring, accept, bidirectional audio relay, and end")
    void testCompleteTwoUserCallSimulation() throws Exception {
        String wsUrl = "ws://localhost:" + port + "/ws/call";
        StandardWebSocketClient client = new StandardWebSocketClient();

        BlockingQueue<String> clientATextMessages = new LinkedBlockingQueue<>();
        BlockingQueue<byte[]> clientABinaryMessages = new LinkedBlockingQueue<>();

        BlockingQueue<String> clientBTextMessages = new LinkedBlockingQueue<>();
        BlockingQueue<byte[]> clientBBinaryMessages = new LinkedBlockingQueue<>();

        // 1. Connect Client A (Muthu)
        WebSocketSession sessionA = client.execute(new WebSocketHandler() {
            @Override
            public void afterConnectionEstablished(WebSocketSession s) {}
            @Override
            public void handleMessage(WebSocketSession s, WebSocketMessage<?> m) {
                if (m instanceof TextMessage tm) clientATextMessages.offer(tm.getPayload());
                else if (m instanceof BinaryMessage bm) clientABinaryMessages.offer(bm.getPayload().array());
            }
            @Override
            public void handleTransportError(WebSocketSession s, Throwable t) {}
            @Override
            public void afterConnectionClosed(WebSocketSession s, CloseStatus cs) {}
            @Override
            public boolean supportsPartialMessages() { return false; }
        }, wsUrl).get(5, TimeUnit.SECONDS);

        // 2. Connect Client B (Friend)
        WebSocketSession sessionB = client.execute(new WebSocketHandler() {
            @Override
            public void afterConnectionEstablished(WebSocketSession s) {}
            @Override
            public void handleMessage(WebSocketSession s, WebSocketMessage<?> m) {
                if (m instanceof TextMessage tm) clientBTextMessages.offer(tm.getPayload());
                else if (m instanceof BinaryMessage bm) clientBBinaryMessages.offer(bm.getPayload().array());
            }
            @Override
            public void handleTransportError(WebSocketSession s, Throwable t) {}
            @Override
            public void afterConnectionClosed(WebSocketSession s, CloseStatus cs) {}
            @Override
            public boolean supportsPartialMessages() { return false; }
        }, wsUrl).get(5, TimeUnit.SECONDS);

        assertNotNull(sessionA);
        assertNotNull(sessionB);

        // 3. Register presence for User A and User B
        sessionA.sendMessage(new TextMessage("{\"type\":\"REGISTER_PRESENCE\",\"userId\":\"USER-A\",\"phoneNumber\":\"+919000000001\",\"displayName\":\"Muthu\"}"));
        sessionB.sendMessage(new TextMessage("{\"type\":\"REGISTER_PRESENCE\",\"userId\":\"USER-B\",\"phoneNumber\":\"+919000000002\",\"displayName\":\"Friend\"}"));

        // Wait for registration ACKs
        assertNotNull(pollForType(clientATextMessages, "PRESENCE_REGISTERED", 3));
        assertNotNull(pollForType(clientBTextMessages, "PRESENCE_REGISTERED", 3));

        // 4. User A calls User B
        sessionA.sendMessage(new TextMessage("{\"type\":\"CALL_INVITE\",\"callerUserId\":\"USER-A\",\"receiverTarget\":\"+919000000002\"}"));

        // User A receives CALL_RINGING
        String ringingMsg = pollForType(clientATextMessages, "CALL_RINGING", 3);
        assertNotNull(ringingMsg, "User A should receive CALL_RINGING");
        JsonNode ringJson = objectMapper.readTree(ringingMsg);
        String callId = ringJson.path("callId").asText();
        assertNotNull(callId);

        // User B receives INCOMING_CALL
        String incomingMsg = pollForType(clientBTextMessages, "INCOMING_CALL", 3);
        assertNotNull(incomingMsg, "User B should receive INCOMING_CALL");
        JsonNode incJson = objectMapper.readTree(incomingMsg);
        assertEquals(callId, incJson.path("callId").asText());
        assertEquals("USER-A", incJson.path("caller").path("userId").asText());

        // 5. User B accepts the call
        sessionB.sendMessage(new TextMessage("{\"type\":\"CALL_ACCEPT\",\"callId\":\"" + callId + "\",\"userId\":\"USER-B\"}"));

        // Both receive CALL_ACTIVE
        assertNotNull(pollForType(clientATextMessages, "CALL_ACTIVE", 3), "User A should receive CALL_ACTIVE");
        assertNotNull(pollForType(clientBTextMessages, "CALL_ACTIVE", 3), "User B should receive CALL_ACTIVE");

        // Verify session state in backend is ACTIVE
        CallSession currentCall = callSessionService.getSessionOrThrow(callId);
        assertEquals(CallStatus.ACTIVE, currentCall.getStatus());

        // 6. User A sends a 128ms audio frame -> User B must receive it
        byte[] fakePcmA = new byte[4096];
        for (int i = 0; i < fakePcmA.length; i++) fakePcmA[i] = 1;
        AudioFrameHeader headerA = new AudioFrameHeader(
                AudioFrameHeader.TYPE_AUDIO, AudioFrameHeader.ROLE_CALLER, 0L,
                System.currentTimeMillis(), 128, 16000, 1, AudioFrameHeader.ENCODING_PCM16, "USER-A", callId
        );
        byte[] frameBytesA = AudioFrameHeader.encode(headerA, fakePcmA);
        sessionA.sendMessage(new BinaryMessage(frameBytesA));

        byte[] receivedByB = clientBBinaryMessages.poll(3, TimeUnit.SECONDS);
        assertNotNull(receivedByB, "User B should receive audio frame sent by User A");
        AudioFrame decodedB = AudioFrameHeader.decode(ByteBuffer.wrap(receivedByB));
        assertEquals("USER-A", decodedB.getHeader().getUserId());
        assertEquals(0L, decodedB.getHeader().getSequenceNumber());
        assertEquals(fakePcmA.length, decodedB.getAudioData().length);

        // 7. User B sends a 128ms audio frame -> User A must receive it
        byte[] fakePcmB = new byte[4096];
        for (int i = 0; i < fakePcmB.length; i++) fakePcmB[i] = 2;
        AudioFrameHeader headerB = new AudioFrameHeader(
                AudioFrameHeader.TYPE_AUDIO, AudioFrameHeader.ROLE_RECEIVER, 0L,
                System.currentTimeMillis(), 128, 16000, 1, AudioFrameHeader.ENCODING_PCM16, "USER-B", callId
        );
        byte[] frameBytesB = AudioFrameHeader.encode(headerB, fakePcmB);
        sessionB.sendMessage(new BinaryMessage(frameBytesB));

        byte[] receivedByA = clientABinaryMessages.poll(3, TimeUnit.SECONDS);
        assertNotNull(receivedByA, "User A should receive audio frame sent by User B");
        AudioFrame decodedA = AudioFrameHeader.decode(ByteBuffer.wrap(receivedByA));
        assertEquals("USER-B", decodedA.getHeader().getUserId());
        assertEquals(0L, decodedA.getHeader().getSequenceNumber());
        assertEquals(fakePcmB.length, decodedA.getAudioData().length);

        // 8. User A ends the call
        sessionA.sendMessage(new TextMessage("{\"type\":\"CALL_END\",\"callId\":\"" + callId + "\",\"userId\":\"USER-A\",\"reason\":\"USER_ENDED\"}"));

        // Both receive CALL_ENDED
        assertNotNull(pollForType(clientATextMessages, "CALL_ENDED", 3), "User A should receive CALL_ENDED");
        assertNotNull(pollForType(clientBTextMessages, "CALL_ENDED", 3), "User B should receive CALL_ENDED");

        // 9. Verify CallSession in backend is now COMPLETED
        CallSession completedCall = callSessionService.getSessionOrThrow(callId);
        assertEquals(CallStatus.COMPLETED, completedCall.getStatus());
        assertNotNull(completedCall.getEndedAt());
        assertEquals("USER_ENDED", completedCall.getEndReason());

        sessionA.close();
        sessionB.close();
    }

    private String pollForType(java.util.concurrent.BlockingQueue<String> queue, String expectedType, int timeoutSeconds) throws InterruptedException {
        long deadline = System.currentTimeMillis() + (timeoutSeconds * 1000L);
        while (System.currentTimeMillis() < deadline) {
            String msg = queue.poll(500, java.util.concurrent.TimeUnit.MILLISECONDS);
            if (msg != null && msg.contains("\"type\":\"" + expectedType + "\"")) {
                return msg;
            }
        }
        return null;
    }
}
