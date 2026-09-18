package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.dto.HealthResponse;
import com.audiodeepcheck.backend.dto.fastapi.FastApiHealthDto;
import com.audiodeepcheck.backend.exception.AiServiceUnavailableException;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BackendHealthServiceTest {

    @Mock
    private FastApiAiClient aiClient;

    @Mock
    private MongoTemplate mongoTemplate;

    @InjectMocks
    private BackendHealthService healthService;

    @Test
    @DisplayName("Health is UP when AI service and Database are healthy")
    void testGetHealthAllUp() {
        when(mongoTemplate.executeCommand(any(Document.class))).thenReturn(new Document("ok", 1));
        when(aiClient.checkHealth()).thenReturn(new FastApiHealthDto(
                "healthy", "1.0.0", "cpu", List.of("wav2vec2"), 1, "2026-09-18T19:00:00"
        ));

        HealthResponse health = healthService.getHealth();
        assertThat(health.status()).isEqualTo("UP");
        assertThat(health.components().get("backend")).isEqualTo("UP");
        assertThat(health.components().get("aiService")).isEqualTo("UP");
        assertThat(health.components().get("database")).isEqualTo("UP");
    }

    @Test
    @DisplayName("Health is DEGRADED when AI service is unreachable but DB is UP")
    void testGetHealthDegradedWhenAiDown() {
        when(mongoTemplate.executeCommand(any(Document.class))).thenReturn(new Document("ok", 1));
        when(aiClient.checkHealth()).thenThrow(new AiServiceUnavailableException("Connection refused"));

        HealthResponse health = healthService.getHealth();
        assertThat(health.status()).isEqualTo("DEGRADED");
        assertThat(health.components().get("backend")).isEqualTo("UP");
        assertThat(health.components().get("database")).isEqualTo("UP");
        assertThat(health.components().get("aiService")).isEqualTo("DOWN");
    }

    @Test
    @DisplayName("Health is DEGRADED when Database is down but AI service is UP")
    void testGetHealthDegradedWhenDbDown() {
        when(mongoTemplate.executeCommand(any(Document.class))).thenThrow(new RuntimeException("Mongo connection timeout"));
        when(aiClient.checkHealth()).thenReturn(new FastApiHealthDto(
                "healthy", "1.0.0", "cpu", List.of("wav2vec2"), 1, "2026-09-18T19:00:00"
        ));

        HealthResponse health = healthService.getHealth();
        assertThat(health.status()).isEqualTo("DEGRADED");
        assertThat(health.components().get("backend")).isEqualTo("UP");
        assertThat(health.components().get("database")).isEqualTo("DOWN");
        assertThat(health.components().get("aiService")).isEqualTo("UP");
    }

    @Test
    @DisplayName("Health is DOWN when both Database and AI service are down")
    void testGetHealthDownWhenBothDown() {
        when(mongoTemplate.executeCommand(any(Document.class))).thenThrow(new RuntimeException("Mongo connection timeout"));
        when(aiClient.checkHealth()).thenThrow(new AiServiceUnavailableException("Connection refused"));

        HealthResponse health = healthService.getHealth();
        assertThat(health.status()).isEqualTo("DOWN");
        assertThat(health.components().get("backend")).isEqualTo("UP");
        assertThat(health.components().get("database")).isEqualTo("DOWN");
        assertThat(health.components().get("aiService")).isEqualTo("DOWN");
    }
}
