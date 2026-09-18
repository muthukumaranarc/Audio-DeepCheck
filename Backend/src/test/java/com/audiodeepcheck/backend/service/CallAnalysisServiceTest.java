package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.domain.*;
import com.audiodeepcheck.backend.dto.AudioUploadResponse;
import com.audiodeepcheck.backend.dto.CreateCallRequest;
import com.audiodeepcheck.backend.dto.CreateCallResponse;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.exception.AiServiceUnavailableException;
import com.audiodeepcheck.backend.exception.InvalidAudioException;
import com.audiodeepcheck.backend.exception.InvalidCallStateException;
import com.audiodeepcheck.backend.repository.InMemoryAnalysisRepository;
import com.audiodeepcheck.backend.repository.InMemoryCallSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CallAnalysisServiceTest {

    private InMemoryCallSessionRepository sessionRepository;
    private InMemoryAnalysisRepository analysisRepository;
    private CallSessionService sessionService;
    private CallAnalysisService analysisService;

    @Mock
    private FastApiAiClient aiClient;

    @BeforeEach
    void setUp() {
        sessionRepository = new InMemoryCallSessionRepository();
        analysisRepository = new InMemoryAnalysisRepository();
        sessionService = new CallSessionService(sessionRepository, analysisRepository);
        analysisService = new CallAnalysisService(sessionService, sessionRepository, analysisRepository, aiClient);
    }

    @Test
    @DisplayName("Audio analysis on active call updates session and persists chunks and evidence")
    void testAnalyzeCallAudioSuccess() {
        CreateCallResponse created = sessionService.createCall(new CreateCallRequest("Alice", "Bob"));
        String callId = created.callId();
        sessionService.startCall(callId);

        FastApiAnalyzeDto.QualityDto qualityDto = new FastApiAnalyzeDto.QualityDto(true, 0.95, 31.0, List.of());
        FastApiAnalyzeDto.ChunksSummaryDto chunksSummary = new FastApiAnalyzeDto.ChunksSummaryDto(
                1, 1, 1, 0, 0, 1.0, 0.45
        );
        FastApiAnalyzeDto.ChunkDetailDto chunkDetail = new FastApiAnalyzeDto.ChunkDetailDto(
                0, 0.0, 5.0, 5.0, 0.45, "AI_GENERATED", 0.95, List.of(), 5
        );
        FastApiAnalyzeDto.ModuleDetailDto moduleDetail = new FastApiAnalyzeDto.ModuleDetailDto(
                "wav2vec2", "CLASSIFIER", 0.88, 0.35, 0.76, "USED", 1.0, Map.of()
        );
        FastApiAnalyzeDto.ProcessingMetadataDto meta = new FastApiAnalyzeDto.ProcessingMetadataDto(
                12.5, "req-xyz", List.of(), 5.0, 2.5
        );

        FastApiAnalyzeDto mockResponse = new FastApiAnalyzeDto(
                "AI_GENERATED",
                0.45,
                "PROVISIONAL",
                0.85,
                "LOW",
                qualityDto,
                chunksSummary,
                List.of(chunkDetail),
                Map.of("wav2vec2", moduleDetail),
                meta
        );

        when(aiClient.analyzeAudio(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(mockResponse);

        MockMultipartFile file = new MockMultipartFile(
                "audio", "voice.wav", "audio/wav", new byte[]{0, 1, 2, 3, 4}
        );

        AudioUploadResponse response = analysisService.analyzeCallAudio(
                callId, file, 1, 5.0, 2.5, null
        );

        assertThat(response.callId()).isEqualTo(callId);
        assertThat(response.received()).isTrue();
        assertThat(response.analysisStatus()).isEqualTo("COMPLETED");

        CallSession session = sessionRepository.findById(callId).orElseThrow();
        assertThat(session.getLatestDecision()).isEqualTo(CallDecision.AI_GENERATED);
        assertThat(session.getDecisionStrength()).isEqualTo(0.45);
        assertThat(session.getConflictLevel()).isEqualTo(ConflictLevel.LOW);
        assertThat(session.getQuality().usable()).isTrue();

        List<AudioChunkAnalysis> chunks = analysisRepository.findChunksByCallId(callId);
        assertThat(chunks).hasSize(1);
        assertThat(chunks.get(0).decision()).isEqualTo(CallDecision.AI_GENERATED);

        assertThat(analysisRepository.findEvidenceByCallId(callId)).isPresent();
    }

    @Test
    @DisplayName("Audio analysis on CREATED call throws InvalidCallStateException")
    void testAnalyzeCallAudioWhenCallNotActiveThrowsInvalidCallState() {
        CreateCallResponse created = sessionService.createCall(new CreateCallRequest("Alice", "Bob"));
        String callId = created.callId();

        MockMultipartFile file = new MockMultipartFile(
                "audio", "voice.wav", "audio/wav", new byte[]{0, 1, 2, 3}
        );

        assertThatThrownBy(() -> analysisService.analyzeCallAudio(callId, file, 1, null, null, null))
                .isInstanceOf(InvalidCallStateException.class)
                .hasMessageContaining("Call must be ACTIVE");
    }

    @Test
    @DisplayName("AI service outage transitions call status to AI_UNAVAILABLE")
    void testAnalyzeCallAudioWhenAiUnavailableSetsAiUnavailableState() {
        CreateCallResponse created = sessionService.createCall(new CreateCallRequest("Alice", "Bob"));
        String callId = created.callId();
        sessionService.startCall(callId);

        when(aiClient.analyzeAudio(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new AiServiceUnavailableException("Connection refused"));

        MockMultipartFile file = new MockMultipartFile(
                "audio", "voice.wav", "audio/wav", new byte[]{0, 1, 2, 3}
        );

        assertThatThrownBy(() -> analysisService.analyzeCallAudio(callId, file, 1, null, null, null))
                .isInstanceOf(AiServiceUnavailableException.class);

        CallSession session = sessionRepository.findById(callId).orElseThrow();
        assertThat(session.getStatus()).isEqualTo(CallStatus.AI_UNAVAILABLE);
        assertThat(session.getLatestAnalysisStatus()).isEqualTo("AI_UNAVAILABLE");
    }

    @Test
    @DisplayName("Empty audio upload throws InvalidAudioException")
    void testAnalyzeCallAudioWithEmptyFileThrowsInvalidAudioException() {
        CreateCallResponse created = sessionService.createCall(new CreateCallRequest("Alice", "Bob"));
        String callId = created.callId();
        sessionService.startCall(callId);

        MockMultipartFile emptyFile = new MockMultipartFile("audio", "empty.wav", "audio/wav", new byte[0]);

        assertThatThrownBy(() -> analysisService.analyzeCallAudio(callId, emptyFile, 1, null, null, null))
                .isInstanceOf(InvalidAudioException.class);
    }
}
