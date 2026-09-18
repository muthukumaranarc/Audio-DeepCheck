package com.audiodeepcheck.backend.repository;

import com.audiodeepcheck.backend.domain.AudioChunkAnalysis;
import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.domain.ModuleEvidence;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.repository.mongo.CallSessionDocument;
import com.audiodeepcheck.backend.repository.mongo.SpringDataCallSessionMongoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class MongoPersistenceIntegrationTest {

    @Autowired
    private CallSessionRepository callSessionRepository;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private SpringDataCallSessionMongoRepository springDataCallSessionMongoRepository;

    @BeforeEach
    void setUp() {
        callSessionRepository.clear();
        analysisRepository.clear();
    }

    @Test
    @DisplayName("Persist and retrieve CallSession with exact field mapping")
    void testSaveAndFindCallSession() {
        CallSession session = new CallSession("CALL-001", "+1234567890", "+0987654321");
        callSessionRepository.save(session);

        Optional<CallSession> found = callSessionRepository.findById("CALL-001");
        assertThat(found).isPresent();
        CallSession loaded = found.get();
        assertThat(loaded.getCallId()).isEqualTo("CALL-001");
        assertThat(loaded.getCaller()).isEqualTo("+1234567890");
        assertThat(loaded.getReceiver()).isEqualTo("+0987654321");
        assertThat(loaded.getStatus()).isEqualTo(CallStatus.CREATED);
        assertThat(loaded.getLatestDecision()).isNull();
        assertThat(loaded.getDecisionStrength()).isNull();
    }

    @Test
    @DisplayName("Persist call lifecycle status transitions and decision updates")
    void testCallLifecyclePersistence() {
        CallSession session = new CallSession("CALL-002", "Alice", "Bob");
        callSessionRepository.save(session);

        // Transition to ACTIVE
        session.start(Instant.now());
        callSessionRepository.save(session);
        assertThat(callSessionRepository.findById("CALL-002").get().getStatus()).isEqualTo(CallStatus.ACTIVE);

        // Transition to ANALYZING
        session.beginAnalyzing();
        callSessionRepository.save(session);
        assertThat(callSessionRepository.findById("CALL-002").get().getStatus()).isEqualTo(CallStatus.ANALYZING);

        // Update latest decision
        session.recordAnalysisResult(CallDecision.AI_GENERATED, 0.95, 0.88, ConflictLevel.LOW, null, 1, "req-test");
        callSessionRepository.save(session);
        CallSession analyzingSession = callSessionRepository.findById("CALL-002").get();
        assertThat(analyzingSession.getLatestDecision()).isEqualTo(CallDecision.AI_GENERATED);
        assertThat(analyzingSession.getDecisionStrength()).isEqualTo(0.95);
        assertThat(analyzingSession.getSyntheticEvidenceScore()).isEqualTo(0.88);

        // End and complete call
        session.end(Instant.now(), "USER_ENDED");
        session.complete();
        callSessionRepository.save(session);

        CallSession completedSession = callSessionRepository.findById("CALL-002").get();
        assertThat(completedSession.getStatus()).isEqualTo(CallStatus.COMPLETED);
        assertThat(completedSession.getEndedAt()).isNotNull();
    }

    @Test
    @DisplayName("Query active calls using findByStatusIn")
    void testFindByStatusIn() {
        CallSession s1 = new CallSession("C-1", "A", "B");
        s1.start(Instant.now()); // ACTIVE

        CallSession s2 = new CallSession("C-2", "C", "D");
        s2.start(Instant.now());
        s2.beginAnalyzing(); // ANALYZING

        CallSession s3 = new CallSession("C-3", "E", "F");
        s3.start(Instant.now());
        s3.end(Instant.now(), "NORMAL");
        s3.complete(); // COMPLETED

        callSessionRepository.save(s1);
        callSessionRepository.save(s2);
        callSessionRepository.save(s3);

        List<CallSession> activeCalls = callSessionRepository.findByStatusIn(List.of(CallStatus.ACTIVE, CallStatus.ANALYZING));
        assertThat(activeCalls).hasSize(2);
        List<String> ids = activeCalls.stream().map(CallSession::getCallId).toList();
        assertThat(ids).containsExactlyInAnyOrder("C-1", "C-2");
    }

    @Test
    @DisplayName("Filter and paginate historical calls")
    void testFilteredAndPaginatedQueries() {
        for (int i = 1; i <= 5; i++) {
            CallSession s = new CallSession("CALL-HIST-" + i, "Caller" + i, "Receiver" + i);
            s.start(Instant.now());
            if (i <= 3) {
                s.recordAnalysisResult(CallDecision.AI_GENERATED, 0.90, 0.85, ConflictLevel.LOW, null, 1, "req-" + i);
            } else {
                s.recordAnalysisResult(CallDecision.HUMAN, 0.95, 0.10, ConflictLevel.LOW, null, 1, "req-" + i);
            }
            s.end(Instant.now(), "NORMAL");
            s.complete();
            callSessionRepository.save(s);
        }

        // Filter by COMPLETED and AI_GENERATED
        List<CallSession> aiCallsPage0 = callSessionRepository.findFiltered(CallStatus.COMPLETED, CallDecision.AI_GENERATED, 0, 2);
        assertThat(aiCallsPage0).hasSize(2);

        List<CallSession> aiCallsPage1 = callSessionRepository.findFiltered(CallStatus.COMPLETED, CallDecision.AI_GENERATED, 1, 2);
        assertThat(aiCallsPage1).hasSize(1);

        long count = callSessionRepository.countFiltered(CallStatus.COMPLETED, CallDecision.AI_GENERATED);
        assertThat(count).isEqualTo(3);

        // Filter by HUMAN
        long humanCount = callSessionRepository.countFiltered(CallStatus.COMPLETED, CallDecision.HUMAN);
        assertThat(humanCount).isEqualTo(2);
    }

    @Test
    @DisplayName("Persist sequential audio chunks and retrieve chronologically")
    void testSaveAndRetrieveChunks() {
        String callId = "CALL-CHUNKS-01";
        AudioChunkAnalysis chunk1 = new AudioChunkAnalysis(
                1, 0.0, 3.0, CallDecision.HUMAN, 0.85, 0.15, Instant.now()
        );
        AudioChunkAnalysis chunk2 = new AudioChunkAnalysis(
                2, 3.0, 6.0, CallDecision.AI_GENERATED, 0.92, 0.88, Instant.now()
        );

        analysisRepository.saveChunk(callId, chunk1);
        analysisRepository.saveChunk(callId, chunk2);

        List<AudioChunkAnalysis> chunks = analysisRepository.findChunksByCallId(callId);
        assertThat(chunks).hasSize(2);
        assertThat(chunks.get(0).chunkIndex()).isEqualTo(1);
        assertThat(chunks.get(0).decision()).isEqualTo(CallDecision.HUMAN);
        assertThat(chunks.get(1).chunkIndex()).isEqualTo(2);
        assertThat(chunks.get(1).decision()).isEqualTo(CallDecision.AI_GENERATED);
    }

    @Test
    @DisplayName("Persist module evidence and conflict level")
    void testSaveAndRetrieveEvidence() {
        String callId = "CALL-EV-01";
        List<ModuleEvidence> modules = List.of(
                new ModuleEvidence("wav2vec2", "READY", "SUSPICIOUS", 0.95, Map.of("latencyMs", 42)),
                new ModuleEvidence("df_arena", "READY", "SUSPICIOUS", 0.90, Map.of("latencyMs", 120)),
                new ModuleEvidence("spectrogram", "READY", "CLEAN", 0.30, Map.of())
        );

        analysisRepository.saveEvidence(callId, modules, ConflictLevel.LOW);

        Optional<AnalysisRepository.EvidenceRecord> record = analysisRepository.findEvidenceByCallId(callId);
        assertThat(record).isPresent();
        assertThat(record.get().conflictLevel()).isEqualTo(ConflictLevel.LOW);
        assertThat(record.get().modules()).hasSize(3);
        assertThat(record.get().modules().get(0).module()).isEqualTo("wav2vec2");
        assertThat(record.get().modules().get(0).direction()).isEqualTo("SUSPICIOUS");
    }

    @Test
    @DisplayName("Persist and retrieve raw FastApiAnalyzeDto response")
    void testSaveAndRetrieveFastApiResponse() {
        String callId = "CALL-FASTAPI-01";
        FastApiAnalyzeDto fastApiDto = new FastApiAnalyzeDto(
                "ai_generated",
                0.92,
                "VERY_HIGH",
                0.88,
                "LOW",
                new FastApiAnalyzeDto.QualityDto(true, 0.95, 28.5, List.of()),
                new FastApiAnalyzeDto.ChunksSummaryDto(2, 2, 2, 0, 0, 1.0, 0.88),
                List.of(new FastApiAnalyzeDto.ChunkDetailDto(0, 0.0, 3.0, 3.0, 0.88, "ai_generated", 0.95, List.of(), 3)),
                Map.of("wav2vec2", new FastApiAnalyzeDto.ModuleDetailDto("wav2vec2", "deepfake_prob", 0.88, 0.35, 0.88, "READY", 0.95, Map.of())),
                new FastApiAnalyzeDto.ProcessingMetadataDto(3.0, "req-test-999", List.of(), 3.0, 1.5)
        );

        analysisRepository.saveFastApiResponse(callId, fastApiDto);

        Optional<FastApiAnalyzeDto> loaded = analysisRepository.findFastApiResponseByCallId(callId);
        assertThat(loaded).isPresent();
        assertThat(loaded.get().masterDecision()).isEqualTo("ai_generated");
        assertThat(loaded.get().confidenceStatus()).isEqualTo("VERY_HIGH");
        assertThat(loaded.get().processingMetadata().requestId()).isEqualTo("req-test-999");
        assertThat(loaded.get().quality().usable()).isTrue();
    }

    @Test
    @DisplayName("Unique index on callId prevents duplicate session records")
    void testUniqueCallIdConstraint() {
        CallSessionDocument doc1 = new CallSessionDocument("CALL-DUP", "Caller1", "Receiver1");
        springDataCallSessionMongoRepository.save(doc1);

        CallSessionDocument doc2 = new CallSessionDocument("CALL-DUP", "Caller2", "Receiver2");
        assertThatThrownBy(() -> springDataCallSessionMongoRepository.insert(doc2))
                .isInstanceOf(DuplicateKeyException.class);
    }
}
