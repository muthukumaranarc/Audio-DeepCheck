package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.UserPresence;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.socket.WebSocketSession;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class UserPresenceServiceTest {

    private UserPresenceService presenceService;

    @BeforeEach
    void setUp() {
        presenceService = new UserPresenceService();
    }

    @Test
    @DisplayName("Should seed default simulated identities User A and User B")
    void shouldSeedDefaultIdentities() {
        UserPresence userA = presenceService.getPresence("USER-A");
        assertNotNull(userA);
        assertEquals("Muthu", userA.getDisplayName());
        assertEquals("+919000000001", userA.getPhoneNumber());

        UserPresence userB = presenceService.getPresence("USER-B");
        assertNotNull(userB);
        assertEquals("Friend", userB.getDisplayName());
        assertEquals("+919000000002", userB.getPhoneNumber());
    }

    @Test
    @DisplayName("Should register presence with WebSocket session and lookup by phone")
    void shouldRegisterPresenceAndLookupByPhone() {
        WebSocketSession mockSession = Mockito.mock(WebSocketSession.class);
        when(mockSession.getId()).thenReturn("sess-123");

        UserPresence presence = presenceService.registerPresence("USER-A", "+91 90000 00001", "Muthu", mockSession);
        assertEquals(UserPresence.Status.ONLINE, presence.getStatus());

        UserPresence byPhone = presenceService.getPresenceByPhone("+91 90000 00001");
        assertNotNull(byPhone);
        assertEquals("USER-A", byPhone.getUserId());

        assertEquals("USER-A", presenceService.getUserIdForSession("sess-123"));
        assertEquals(mockSession, presenceService.getSessionForUser("USER-A"));
    }

    @Test
    @DisplayName("Should set status to OFFLINE when session closes")
    void shouldSetOfflineOnSessionClose() {
        WebSocketSession mockSession = Mockito.mock(WebSocketSession.class);
        when(mockSession.getId()).thenReturn("sess-456");

        presenceService.registerPresence("USER-B", "+91 90000 00002", "Friend", mockSession);
        assertEquals(UserPresence.Status.ONLINE, presenceService.getPresence("USER-B").getStatus());

        presenceService.removeSession(mockSession);
        assertEquals(UserPresence.Status.OFFLINE, presenceService.getPresence("USER-B").getStatus());
        assertNull(presenceService.getSessionForUser("USER-B"));
    }
}
