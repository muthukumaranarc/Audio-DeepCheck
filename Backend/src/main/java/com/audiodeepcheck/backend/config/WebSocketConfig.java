package com.audiodeepcheck.backend.config;

import com.audiodeepcheck.backend.websocket.CallWebSocketHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * WebSocket configuration registering the /ws/call endpoint.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CallWebSocketHandler callWebSocketHandler;

    public WebSocketConfig(CallWebSocketHandler callWebSocketHandler) {
        this.callWebSocketHandler = callWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(callWebSocketHandler, "/ws/call", "/ws", "/ws/call/")
                .setAllowedOriginPatterns("*");
    }
}
