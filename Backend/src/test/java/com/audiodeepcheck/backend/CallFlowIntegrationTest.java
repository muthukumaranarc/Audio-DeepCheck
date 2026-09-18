package com.audiodeepcheck.backend;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.dto.*;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.dto.fastapi.FastApiHealthDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CallFlowIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private FastApiAiClient aiClient;

    @Test
    @DisplayName("Complete end-to-end call simulation workflow: health -> create -> start -> audio -> analysis -> end -> report")
    void testFullCallLifecycleWorkflow() {
        // 1. Health check probe
        when(aiClient.checkHealth()).thenReturn(new FastApiHealthDto(
                "healthy", "1.0.0", "cpu", List.of("wav2vec2", "df_arena_500m"), 1, "2026-09-18T19:00:00"
        ));

        ResponseEntity<HealthResponse> healthResp = restTemplate.getForEntity("/api/v1/health", HealthResponse.class);
        assertThat(healthResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(healthResp.getBody()).isNotNull();
        assertThat(healthResp.getBody().status()).isEqualTo("UP");
        assertThat(healthResp.getBody().components().get("backend")).isEqualTo("UP");
        assertThat(healthResp.getBody().components().get("aiService")).isEqualTo("UP");

        // 2. Create Call
        CreateCallRequest createReq = new CreateCallRequest("E2E Caller", "E2E Receiver");
        ResponseEntity<CreateCallResponse> createResp = restTemplate.postForEntity(
                "/api/v1/calls", createReq, CreateCallResponse.class
        );
        assertThat(createResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createResp.getBody()).isNotNull();
        String callId = createResp.getBody().callId();
        assertThat(callId).startsWith("CALL-");

        // 3. Start Call
        ResponseEntity<StartCallResponse> startResp = restTemplate.postForEntity(
                "/api/v1/calls/" + callId + "/start", null, StartCallResponse.class
        );
        assertThat(startResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(startResp.getBody().status().name()).isEqualTo("ACTIVE");

        // 4. Mock AI service response
        FastApiAnalyzeDto.QualityDto qualityDto = new FastApiAnalyzeDto.QualityDto(true, 0.98, 35.0, List.of());
        FastApiAnalyzeDto.ChunksSummaryDto chunksSummary = new FastApiAnalyzeDto.ChunksSummaryDto(
                1, 1, 1, 0, 0, 1.0, 0.4121
        );
        FastApiAnalyzeDto.ChunkDetailDto chunkDetail = new FastApiAnalyzeDto.ChunkDetailDto(
                0, 0.0, 5.0, 5.0, 0.4121, "AI_GENERATED", 0.98, List.of(), 5
        );
        FastApiAnalyzeDto.ModuleDetailDto modDetail = new FastApiAnalyzeDto.ModuleDetailDto(
                "df_arena", "CLASSIFIER", 0.99, 0.35, 0.98, "USED", 1.0, Map.of()
        );
        FastApiAnalyzeDto.ProcessingMetadataDto meta = new FastApiAnalyzeDto.ProcessingMetadataDto(
                2.5, "req-e2e", List.of(), 5.0, 2.5
        );

        FastApiAnalyzeDto aiResponse = new FastApiAnalyzeDto(
                "AI_GENERATED", 0.4121, "PROVISIONAL", 0.8115, "LOW",
                qualityDto, chunksSummary, List.of(chunkDetail), Map.of("df_arena", modDetail), meta
        );

        when(aiClient.analyzeAudio(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(aiResponse);

        // 5. Submit Audio Multipart
        ByteArrayResource audioResource = new ByteArrayResource(new byte[]{1, 2, 3, 4}) {
            @Override
            public String getFilename() {
                return "sample.wav";
            }
        };

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("X-Request-ID", "req-e2e-client");

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("audio", audioResource);
        form.add("sequenceNumber", 1);

        HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(form, headers);
        ResponseEntity<AudioUploadResponse> uploadResp = restTemplate.postForEntity(
                "/api/v1/calls/" + callId + "/audio", entity, AudioUploadResponse.class
        );
        assertThat(uploadResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(uploadResp.getBody().received()).isTrue();

        // 6. Inspect Analysis Status
        ResponseEntity<AnalysisStatusResponse> analysisResp = restTemplate.getForEntity(
                "/api/v1/calls/" + callId + "/analysis", AnalysisStatusResponse.class
        );
        assertThat(analysisResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(analysisResp.getBody().latestDecision().name()).isEqualTo("AI_GENERATED");
        assertThat(analysisResp.getBody().decisionStrength()).isEqualTo(0.4121);

        // 7. Inspect Evidence Breakdown
        ResponseEntity<EvidenceResponse> evidenceResp = restTemplate.getForEntity(
                "/api/v1/calls/" + callId + "/evidence", EvidenceResponse.class
        );
        assertThat(evidenceResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(evidenceResp.getBody().modules()).isNotEmpty();

        // 8. Inspect Chunk Timeline
        ResponseEntity<ChunksTimelineResponse> chunksResp = restTemplate.getForEntity(
                "/api/v1/calls/" + callId + "/chunks", ChunksTimelineResponse.class
        );
        assertThat(chunksResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(chunksResp.getBody().chunks()).hasSize(1);

        // 9. End Call
        EndCallRequest endReq = new EndCallRequest(null, "HANGUP");
        ResponseEntity<EndCallResponse> endResp = restTemplate.postForEntity(
                "/api/v1/calls/" + callId + "/end", endReq, EndCallResponse.class
        );
        assertThat(endResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(endResp.getBody().status().name()).isEqualTo("COMPLETED");

        // 10. Retrieve Comprehensive Final Report
        ResponseEntity<CallReportResponse> reportResp = restTemplate.getForEntity(
                "/api/v1/calls/" + callId + "/report", CallReportResponse.class
        );
        assertThat(reportResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reportResp.getBody().callId()).isEqualTo(callId);
        assertThat(reportResp.getBody().finalDecision().name()).isEqualTo("AI_GENERATED");
        assertThat(reportResp.getBody().chunksSummary()).isNotNull();
        assertThat(reportResp.getBody().chunksSummary().aiChunks()).isEqualTo(1);
    }
}
