package com.audiodeepcheck.backend.client;

import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.dto.fastapi.FastApiHealthDto;
import com.audiodeepcheck.backend.exception.AiServiceBusyException;
import com.audiodeepcheck.backend.exception.AiServiceUnavailableException;
import com.audiodeepcheck.backend.exception.AudioTooLargeException;
import com.audiodeepcheck.backend.exception.InvalidAudioException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class FastApiAiClientTest {

    private MockRestServiceServer server;
    private FastApiAiClientImpl client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost:8000");
        this.server = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        this.client = new FastApiAiClientImpl(restClient);
    }

    @Test
    @DisplayName("checkHealth() returns FastApiHealthDto on 200 OK")
    void testCheckHealthSuccess() {
        String json = """
            {
              "status": "healthy",
              "version": "1.0.0",
              "device": "cpu",
              "active_detectors": ["wav2vec2", "df_arena_500m", "spectrogram", "prosody", "whisper_rep"],
              "concurrency_limit": 1,
              "timestamp": "2026-09-18T18:53:04"
            }
            """;

        server.expect(requestTo("http://localhost:8000/api/v1/health"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        FastApiHealthDto health = client.checkHealth();
        assertThat(health).isNotNull();
        assertThat(health.status()).isEqualTo("healthy");
        assertThat(health.device()).isEqualTo("cpu");
        assertThat(health.activeDetectors()).contains("wav2vec2", "df_arena_500m");
        server.verify();
    }

    @Test
    @DisplayName("checkHealth() throws AiServiceUnavailableException on 500 error")
    void testCheckHealthFailureThrowsAiServiceUnavailable() {
        server.expect(requestTo("http://localhost:8000/api/v1/health"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withServerError());

        assertThatThrownBy(() -> client.checkHealth())
                .isInstanceOf(AiServiceUnavailableException.class);
        server.verify();
    }

    @Test
    @DisplayName("analyzeAudio() returns FastApiAnalyzeDto on 200 OK and propagates X-Request-ID")
    void testAnalyzeAudioSuccess() {
        String json = """
            {
              "master_decision": "AI_GENERATED",
              "decision_strength": 0.4121,
              "confidence_status": "PROVISIONAL",
              "synthetic_evidence_score": 0.8115,
              "conflict_level": "MEDIUM",
              "quality": {
                "usable": true,
                "quality_score": 1.0,
                "snr_db": 34.2,
                "flags": []
              },
              "chunks_summary": {
                "total_chunks": 1,
                "usable_chunks": 1,
                "ai_chunks": 1,
                "human_chunks": 0,
                "uncertain_chunks": 0,
                "ai_chunk_ratio": 1.0,
                "trimmed_mean_score": 0.4121
              },
              "chunk_details": [
                {
                  "chunk_index": 0,
                  "start_sec": 0.0,
                  "end_sec": 5.0,
                  "duration_sec": 5.0,
                  "fusion_score": 0.4121,
                  "effective_decision": "AI_GENERATED",
                  "quality_score": 1.0,
                  "quality_flags": [],
                  "active_modules_count": 5
                }
              ],
              "modules": {
                "wav2vec2": {
                  "module": "wav2vec2",
                  "evidence_type": "CLASSIFIER",
                  "synthetic_score": 0.8897,
                  "effective_weight": 0.35,
                  "normalized_score": 0.7794,
                  "status": "USED",
                  "quality_score": 1.0
                }
              },
              "processing_metadata": {
                "duration_sec": 46.91,
                "request_id": "req-custom-99",
                "ablated_modules": [],
                "chunk_sec": 5.0,
                "hop_sec": 2.5
              }
            }
            """;

        server.expect(requestTo("http://localhost:8000/api/v1/analyze?chunk_sec=5.0&hop_sec=2.5&return_chunks=true&return_modules=true"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-Request-ID", "req-custom-99"))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        Resource resource = new ByteArrayResource(new byte[]{0, 1, 2, 3});
        FastApiAnalyzeDto result = client.analyzeAudio(
                resource,
                "test.wav",
                5.0,
                2.5,
                null,
                true,
                true,
                "req-custom-99"
        );

        assertThat(result).isNotNull();
        assertThat(result.masterDecision()).isEqualTo("AI_GENERATED");
        assertThat(result.decisionStrength()).isEqualTo(0.4121);
        assertThat(result.conflictLevel()).isEqualTo("MEDIUM");
        assertThat(result.quality().usable()).isTrue();
        assertThat(result.chunkDetails()).hasSize(1);
        assertThat(result.getEffectiveModuleList()).isNotEmpty();
        server.verify();
    }

    @Test
    @DisplayName("analyzeAudio() throws AudioTooLargeException on 413 Payload Too Large")
    void testAnalyzeAudio413ThrowsAudioTooLargeException() {
        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.PAYLOAD_TOO_LARGE).body("{\"detail\":\"File exceeds 25 MB limit\"}"));

        Resource resource = new ByteArrayResource(new byte[]{0, 1});
        assertThatThrownBy(() -> client.analyzeAudio(resource, "test.wav", null, null, null, null, null, null))
                .isInstanceOf(AudioTooLargeException.class)
                .hasMessageContaining("25 MB");
        server.verify();
    }

    @Test
    @DisplayName("analyzeAudio() throws InvalidAudioException on 415 Unsupported Media Type")
    void testAnalyzeAudio415ThrowsInvalidAudioException() {
        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body("{\"detail\":\"Corrupt or unsupported format\"}"));

        Resource resource = new ByteArrayResource(new byte[]{0, 1});
        assertThatThrownBy(() -> client.analyzeAudio(resource, "bad.txt", null, null, null, null, null, null))
                .isInstanceOf(InvalidAudioException.class)
                .hasMessageContaining("Unsupported audio format");
        server.verify();
    }

    @Test
    @DisplayName("analyzeAudio() throws InvalidAudioException on 400 Bad Request")
    void testAnalyzeAudio400ThrowsInvalidAudioException() {
        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withBadRequest().body("{\"detail\":\"Audio duration exceeds 180s\"}"));

        Resource resource = new ByteArrayResource(new byte[]{0, 1});
        assertThatThrownBy(() -> client.analyzeAudio(resource, "test.wav", null, null, null, null, null, null))
                .isInstanceOf(InvalidAudioException.class);
        server.verify();
    }

    @Test
    @DisplayName("analyzeAudio() throws InvalidAudioException on 422 Unprocessable Entity")
    void testAnalyzeAudio422ThrowsInvalidAudioException() {
        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY).body("{\"detail\":\"Validation error\"}"));

        Resource resource = new ByteArrayResource(new byte[]{0, 1});
        assertThatThrownBy(() -> client.analyzeAudio(resource, "test.wav", null, null, null, null, null, null))
                .isInstanceOf(InvalidAudioException.class);
        server.verify();
    }

    @Test
    @DisplayName("analyzeAudio() throws AiServiceBusyException on 503 Service Unavailable")
    void testAnalyzeAudio503ThrowsAiServiceBusyException() {
        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body("{\"detail\":\"Queue is saturated\"}"));

        Resource resource = new ByteArrayResource(new byte[]{0, 1});
        assertThatThrownBy(() -> client.analyzeAudio(resource, "test.wav", null, null, null, null, null, null))
                .isInstanceOf(AiServiceBusyException.class)
                .hasMessageContaining("busy");
        server.verify();
    }

    @Test
    @DisplayName("analyzeAudio() throws AiServiceUnavailableException on 500 Internal Server Error")
    void testAnalyzeAudio500ThrowsAiServiceUnavailableException() {
        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError().body("{\"detail\":\"Internal engine fault\"}"));

        Resource resource = new ByteArrayResource(new byte[]{0, 1});
        assertThatThrownBy(() -> client.analyzeAudio(resource, "test.wav", null, null, null, null, null, null))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessageContaining("HTTP 500");
        server.verify();
    }
}
