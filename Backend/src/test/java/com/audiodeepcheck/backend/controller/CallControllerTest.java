package com.audiodeepcheck.backend.controller;

import com.audiodeepcheck.backend.domain.AudioQuality;
import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.dto.*;
import com.audiodeepcheck.backend.exception.CallNotFoundException;
import com.audiodeepcheck.backend.exception.InvalidCallStateException;
import com.audiodeepcheck.backend.service.CallAnalysisService;
import com.audiodeepcheck.backend.service.CallSessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CallController.class)
class CallControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CallSessionService sessionService;

    @MockBean
    private CallAnalysisService analysisService;

    @Test
    @DisplayName("POST /api/v1/calls creates a new call session")
    void testCreateCallSuccess() throws Exception {
        CreateCallRequest request = new CreateCallRequest("Muthu", "Demo Receiver");
        CreateCallResponse response = new CreateCallResponse(
                "CALL-1001", CallStatus.CREATED, "Muthu", "Demo Receiver", Instant.now()
        );

        when(sessionService.createCall(any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/calls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("X-Request-ID"))
                .andExpect(jsonPath("$.callId").value("CALL-1001"))
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andExpect(jsonPath("$.caller").value("Muthu"))
                .andExpect(jsonPath("$.receiver").value("Demo Receiver"));
    }

    @Test
    @DisplayName("POST /api/v1/calls with blank fields returns 400 validation failure")
    void testCreateCallValidationFailure() throws Exception {
        CreateCallRequest invalidRequest = new CreateCallRequest("", "");

        mockMvc.perform(post("/api/v1/calls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("POST /api/v1/calls/{callId}/start moves call to ACTIVE")
    void testStartCallSuccess() throws Exception {
        StartCallResponse response = new StartCallResponse("CALL-1001", CallStatus.ACTIVE, Instant.now());
        when(sessionService.startCall("CALL-1001")).thenReturn(response);

        mockMvc.perform(post("/api/v1/calls/CALL-1001/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callId").value("CALL-1001"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("GET /api/v1/calls/{callId} returns complete call state")
    void testGetCallSuccess() throws Exception {
        CallResponse response = new CallResponse(
                "CALL-1001", "Muthu", "Demo Receiver", CallStatus.COMPLETED,
                Instant.now().minusSeconds(300), Instant.now(), 300L,
                CallDecision.AI_GENERATED, 0.84, "PROVISIONAL",
                new AudioQuality(0.84, true, 26.0, List.of()), "req-123"
        );
        when(sessionService.getCall("CALL-1001")).thenReturn(response);

        mockMvc.perform(get("/api/v1/calls/CALL-1001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callId").value("CALL-1001"))
                .andExpect(jsonPath("$.decision").value("AI_GENERATED"))
                .andExpect(jsonPath("$.decisionStrength").value(0.84));
    }

    @Test
    @DisplayName("GET /api/v1/calls/{callId} returns 404 for unknown callId")
    void testGetCallNotFound() throws Exception {
        when(sessionService.getCall("CALL-9999")).thenThrow(new CallNotFoundException("CALL-9999"));

        mockMvc.perform(get("/api/v1/calls/CALL-9999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CALL_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(containsString("CALL-9999")));
    }

    @Test
    @DisplayName("GET /api/v1/calls/active returns active calls list")
    void testGetActiveCalls() throws Exception {
        CallSummaryResponse item = new CallSummaryResponse(
                "CALL-1001", "Muthu", "Demo Receiver", CallStatus.ANALYZING, 45L, CallDecision.UNCERTAIN, Instant.now()
        );
        when(sessionService.getActiveCalls()).thenReturn(new ActiveCallsResponse(List.of(item)));

        mockMvc.perform(get("/api/v1/calls/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calls").isArray())
                .andExpect(jsonPath("$.calls[0].callId").value("CALL-1001"))
                .andExpect(jsonPath("$.calls[0].status").value("ANALYZING"));
    }

    @Test
    @DisplayName("GET /api/v1/calls returns paged historical calls")
    void testGetCallsPaged() throws Exception {
        CallSummaryResponse item = new CallSummaryResponse(
                "CALL-1001", "Muthu", "Demo Receiver", CallStatus.COMPLETED, 120L, CallDecision.HUMAN, Instant.now()
        );
        PagedCallsResponse response = new PagedCallsResponse(List.of(item), 0, 20, 1, 1);
        when(sessionService.getCalls(0, 20, null, null)).thenReturn(response);

        mockMvc.perform(get("/api/v1/calls?page=0&size=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("POST /api/v1/calls/{callId}/audio ingests audio for analysis")
    void testSubmitAudio() throws Exception {
        MockMultipartFile audioFile = new MockMultipartFile(
                "audio", "voice.wav", "audio/wav", new byte[]{0, 1, 2, 3, 4}
        );
        AudioUploadResponse response = new AudioUploadResponse("CALL-1001", 1, true, "COMPLETED");

        when(analysisService.analyzeCallAudio(eq("CALL-1001"), any(), eq(1), any(), any(), any()))
                .thenReturn(response);

        mockMvc.perform(multipart("/api/v1/calls/CALL-1001/audio")
                        .file(audioFile)
                        .param("sequenceNumber", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callId").value("CALL-1001"))
                .andExpect(jsonPath("$.received").value(true))
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));
    }

    @Test
    @DisplayName("POST /api/v1/calls/{callId}/start with invalid state transition returns 400")
    void testStartCallInvalidState() throws Exception {
        when(sessionService.startCall("CALL-1001"))
                .thenThrow(new InvalidCallStateException("Cannot start call CALL-1001 from state ENDED."));

        mockMvc.perform(post("/api/v1/calls/CALL-1001/start"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CALL_STATE"))
                .andExpect(jsonPath("$.message").value(containsString("ENDED")));
    }

    @Test
    @DisplayName("GET /api/v1/calls/{callId}/evidence returns module evidence")
    void testGetEvidence() throws Exception {
        EvidenceResponse.ModuleItem item = new EvidenceResponse.ModuleItem("wav2vec2", "USED", "SYNTHETIC", 0.35);
        EvidenceResponse response = new EvidenceResponse("CALL-1001", List.of(item), ConflictLevel.LOW);
        when(sessionService.getEvidence("CALL-1001")).thenReturn(response);

        mockMvc.perform(get("/api/v1/calls/CALL-1001/evidence"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callId").value("CALL-1001"))
                .andExpect(jsonPath("$.modules[0].module").value("wav2vec2"))
                .andExpect(jsonPath("$.conflictLevel").value("LOW"));
    }

    @Test
    @DisplayName("GET /api/v1/calls/{callId}/chunks returns chunk timeline")
    void testGetChunks() throws Exception {
        ChunksTimelineResponse.ChunkItem item = new ChunksTimelineResponse.ChunkItem(
                0, 0.0, 5.0, CallDecision.HUMAN, -0.42, 0.91
        );
        ChunksTimelineResponse response = new ChunksTimelineResponse("CALL-1001", List.of(item));
        when(sessionService.getChunks("CALL-1001")).thenReturn(response);

        mockMvc.perform(get("/api/v1/calls/CALL-1001/chunks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callId").value("CALL-1001"))
                .andExpect(jsonPath("$.chunks[0].decision").value("HUMAN"));
    }

    @Test
    @DisplayName("GET /api/v1/calls/{callId}/report returns full audit report")
    void testGetReport() throws Exception {
        CallReportResponse response = new CallReportResponse(
                "CALL-1001", "Muthu", "Demo Receiver", CallStatus.COMPLETED,
                Instant.now().minusSeconds(120), Instant.now(), 120L,
                CallDecision.AI_GENERATED, 0.4121, "PROVISIONAL", 0.8115,
                ConflictLevel.MEDIUM, AudioQuality.pristine(),
                new CallReportResponse.ChunksSummaryReport(1, 1, 1, 0, 0, 1.0, 0.4121),
                List.of(), List.of(), Map.of(), "req-123"
        );
        when(sessionService.getReport("CALL-1001")).thenReturn(response);

        mockMvc.perform(get("/api/v1/calls/CALL-1001/report"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.callId").value("CALL-1001"))
                .andExpect(jsonPath("$.finalDecision").value("AI_GENERATED"))
                .andExpect(jsonPath("$.confidenceStatus").value("PROVISIONAL"));
    }
}
