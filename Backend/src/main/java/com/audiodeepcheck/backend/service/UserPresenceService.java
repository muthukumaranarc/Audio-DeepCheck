package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.UserPresence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service managing real-time presence and active WebSocket sessions for simulated users.
 */
@Service
public class UserPresenceService {

    private static final Logger log = LoggerFactory.getLogger(UserPresenceService.class);

    private final Map<String, UserPresence> usersById = new ConcurrentHashMap<>();
    private final Map<String, String> phoneToUserId = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUserId = new ConcurrentHashMap<>();

    public UserPresenceService() {
        // Seed default simulated identities for the 2-user demo
        seedUser("USER-A", "+91 90000 00001", "Muthu");
        seedUser("USER-B", "+91 90000 00002", "Friend");
    }

    public void seedUser(String userId, String phoneNumber, String displayName) {
        String cleanPhone = normalizePhone(phoneNumber);
        UserPresence user = new UserPresence(userId, cleanPhone, displayName);
        usersById.put(userId, user);
        phoneToUserId.put(cleanPhone, userId);
    }

    public synchronized UserPresence registerPresence(
            String userId,
            String phoneNumber,
            String displayName,
            WebSocketSession session
    ) {
        String cleanPhone = normalizePhone(phoneNumber);
        UserPresence presence = usersById.computeIfAbsent(userId, id -> new UserPresence(id, cleanPhone, displayName));
        presence.setStatus(UserPresence.Status.ONLINE);
        presence.setLastHeartbeat(Instant.now());
        phoneToUserId.put(cleanPhone, userId);

        if (session != null) {
            userSessions.put(userId, session);
            sessionToUserId.put(session.getId(), userId);
        }
        log.info("User registered presence: userId={}, phone={}, name={}", userId, cleanPhone, displayName);
        return presence;
    }

    public synchronized void recordHeartbeat(String userId) {
        UserPresence presence = usersById.get(userId);
        if (presence != null) {
            presence.setLastHeartbeat(Instant.now());
            if (presence.getStatus() == UserPresence.Status.OFFLINE) {
                presence.setStatus(UserPresence.Status.ONLINE);
            }
        }
    }

    public synchronized void setUserStatus(String userId, UserPresence.Status status, String callId) {
        UserPresence presence = usersById.get(userId);
        if (presence != null) {
            presence.setStatus(status);
            presence.setCurrentCallId(callId);
            log.info("Updated presence: userId={}, status={}, callId={}", userId, status, callId);
        }
    }

    public synchronized void removeSession(WebSocketSession session) {
        if (session == null) return;
        String userId = sessionToUserId.remove(session.getId());
        if (userId != null) {
            userSessions.remove(userId);
            UserPresence presence = usersById.get(userId);
            if (presence != null) {
                presence.setStatus(UserPresence.Status.OFFLINE);
                presence.setCurrentCallId(null);
                log.info("User went OFFLINE on session close: userId={}", userId);
            }
        }
    }

    public UserPresence getPresence(String userId) {
        return usersById.get(userId);
    }

    public UserPresence getPresenceByPhone(String phoneNumber) {
        String cleanPhone = normalizePhone(phoneNumber);
        String userId = phoneToUserId.get(cleanPhone);
        if (userId != null) {
            return usersById.get(userId);
        }
        // Fallback search
        for (UserPresence u : usersById.values()) {
            if (cleanPhone.equals(normalizePhone(u.getPhoneNumber()))) {
                return u;
            }
        }
        return null;
    }

    public Collection<UserPresence> getAllPresences() {
        return usersById.values();
    }

    public WebSocketSession getSessionForUser(String userId) {
        return userSessions.get(userId);
    }

    public String getUserIdForSession(String sessionId) {
        return sessionToUserId.get(sessionId);
    }

    public boolean sendToUser(String userId, String jsonMessage) {
        WebSocketSession session = userSessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                synchronized (session) {
                    session.sendMessage(new TextMessage(jsonMessage));
                }
                return true;
            } catch (IOException e) {
                log.error("Failed to send WebSocket message to userId={}: {}", userId, e.getMessage());
            }
        }
        return false;
    }

    public void broadcast(String jsonMessage) {
        TextMessage msg = new TextMessage(jsonMessage);
        for (Map.Entry<String, WebSocketSession> entry : userSessions.entrySet()) {
            WebSocketSession session = entry.getValue();
            if (session != null && session.isOpen()) {
                try {
                    synchronized (session) {
                        session.sendMessage(msg);
                    }
                } catch (IOException e) {
                    log.error("Broadcast failed for userId={}: {}", entry.getKey(), e.getMessage());
                }
            }
        }
    }

    public static String normalizePhone(String phone) {
        if (phone == null) return "";
        return phone.replaceAll("[\\s\\-\\(\\)]", "");
    }
}
