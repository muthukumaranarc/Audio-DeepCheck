package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.domain.*;
import com.audiodeepcheck.backend.dto.*;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.exception.CallNotFoundException;
import com.audiodeepcheck.backend.repository.InMemoryAnalysisRepository;
import com.audiodeepcheck.backend.repository.InMemoryCallSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CallSessionServiceTest {

    private InMemoryCallSessionRepository sessionRepository;
    private InMemoryAnalysisRepository analysisRepository;
    private CallSessionService service;

    @BeforeEach
    void setUp() {
        sessionRepository = new InMemoryCallSessionRepository();
        analysisRepository = new InMemoryAnalysisRepository();
        service = new CallSessionService(sessionRepository, analysisRepository);
    }

    @Test
    @DisplayName("createCall assigns sequential ID and saves session")
    void testCreateCall() {
        CreateCallRequest req = new CreateCallRequest("Alice", "Bob");
        CreateCallResponse resp = service.createCall(req);

        assertThat(resp.callId()).startsWith("CALL-");
        assertThat(resp.caller()).isEqualTo("Alice");
        assertThat(resp.receiver()).isEqualTo("Bob");
        assertThat(resp.status()).isEqualTo(CallStatus.CREATED);

        CallResponse fetched = service.getCall(resp.callId());
        assertThat(fetched.caller()).isEqualTo("Alice");
    }

    @Test
    @DisplayName("startCall moves session to ACTIVE")
    void testStartCall() {
        CreateCallResponse resp = service.createCall(new CreateCallRequest("Alice", "Bob"));
        StartCallResponse startResp = service.startCall(resp.callId());

        assertThat(startResp.status()).isEqualTo(CallStatus.ACTIVE);
        assertThat(startResp.startedAt()).isNotNull();

        CallResponse call = service.getCall(resp.callId());
        assertThat(call.status()).isEqualTo(CallStatus.ACTIVE);
    }

    @Test
    @DisplayName("endCall moves session to ENDED then COMPLETED")
    void testEndCall() {
        CreateCallResponse resp = service.createCall(new CreateCallRequest("Alice", "Bob"));
        service.startCall(resp.callId());

        EndCallRequest endReq = new EndCallRequest(Instant.now(), "USER_DISCONNECT");
        EndCallResponse endResp = service.endCall(resp.callId(), endReq);

        assertThat(endResp.status()).isEqualTo(CallStatus.COMPLETED);
    }

    @Test
    @DisplayName("getCall throws CallNotFoundException for unknown ID")
    void testGetCallNotFound() {
        assertThatThrownBy(() -> service.getCall("UNKNOWN-ID"))
                .isInstanceOf(CallNotFoundException.class)
                .hasMessageContaining("UNKNOWN-ID");
    }

    @Test
    @DisplayName("getActiveCalls returns only active, analyzing, and connecting sessions")
    void testGetActiveCalls() {
        CreateCallResponse c1 = service.createCall(new CreateCallRequest("A1", "B1"));
        CreateCallResponse c2 = service.createCall(new CreateCallRequest("A2", "B2"));
        service.startCall(c1.callId());

        ActiveCallsResponse active = service.getActiveCalls();
        assertThat(active.calls()).hasSize(1);
        assertThat(active.calls().get(0).callId()).isEqualTo(c1.callId());
    }

    @Test
    @DisplayName("getCalls returns paged and filtered results")
    void testGetCallsPaged() {
        for (int i = 0; i < 5; i++) {
            service.createCall(new CreateCallRequest("Caller" + i, "Receiver" + i));
        }

        PagedCallsResponse paged = service.getCalls(0, 3, null, null);
        assertThat(paged.page()).isEqualTo(0);
        assertThat(paged.size()).isEqualTo(3);
        assertThat(paged.totalElements()).isEqualTo(5);
        assertThat(paged.totalPages()).isEqualTo(2);
        assertThat(paged.content()).hasSize(3);
    }

    @Test
    @DisplayName("getEvidence and getChunks return empty or populated structures")
    void testGetEvidenceAndChunks() {
        CreateCallResponse c = service.createCall(new CreateCallRequest("A", "B"));
        String callId = c.callId();

        EvidenceResponse emptyEvidence = service.getEvidence(callId);
        assertThat(emptyEvidence.modules()).isEmpty();
        assertThat(emptyEvidence.conflictLevel()).isEqualTo(ConflictLevel.LOW);

        ChunksTimelineResponse emptyChunks = service.getChunks(callId);
        assertThat(emptyChunks.chunks()).isEmpty();

        // Populate
        analysisRepository.saveChunk(callId, new AudioChunkAnalysis(
                0, 0.0, 5.0, CallDecision.HUMAN, -0.5, 0.9, Instant.now()
        ));
        analysisRepository.saveEvidence(callId, List.of(
                new ModuleEvidence("wav2vec2", "USED", "HUMAN", 0.35, Map.of())
        ), ConflictLevel.LOW);

        EvidenceResponse populatedEvidence = service.getEvidence(callId);
        assertThat(populatedEvidence.modules()).hasSize(1);

        ChunksTimelineResponse populatedChunks = service.getChunks(callId);
        assertThat(populatedChunks.chunks()).hasSize(1);
    }

    @Test
    @DisplayName("getReport assembles comprehensive audit summary")
    void testGetReport() {
        CreateCallResponse c = service.createCall(new CreateCallRequest("A", "B"));
        String callId = c.callId();
        service.startCall(callId);

        FastApiAnalyzeDto.QualityDto qualityDto = new FastApiAnalyzeDto.QualityDto(true, 0.9, 25.0, List.of());
        FastApiAnalyzeDto.ChunksSummaryDto chunksSummary = new FastApiAnalyzeDto.ChunksSummaryDto(
                1, 1, 0, 1, 0, 0.0, -0.4
        );
        FastApiAnalyzeDto.ProcessingMetadataDto meta = new FastApiAnalyzeDto.ProcessingMetadataDto(
                5.0, "req-report", List.of(), 5.0, 2.5
        );
        FastApiAnalyzeDto raw = new FastApiAnalyzeDto(
                "HUMAN", 0.4, "PROVISIONAL", 0.1, "LOW",
                qualityDto, chunksSummary, List.of(), Map.of(), meta
        );
        analysisRepository.saveFastApiResponse(callId, raw);

        CallSession session = sessionRepository.findById(callId).orElseThrow();
        session.recordAnalysisResult(CallDecision.HUMAN, 0.4, 0.1, ConflictLevel.LOW, AudioQuality.pristine(), 1, "req-report");
        session.end(Instant.now(), "USER_ENDED");
        session.complete();
        sessionRepository.save(session);

        CallReportResponse report = service.getReport(callId);
        assertThat(report.callId()).isEqualTo(callId);
        assertThat(report.status()).isEqualTo(CallStatus.COMPLETED);
        assertThat(report.finalDecision()).isEqualTo(CallDecision.HUMAN);
        assertThat(report.chunksSummary()).isNotNull();
        assertThat(report.chunksSummary().humanChunks()).isEqualTo(1);
    }
}
