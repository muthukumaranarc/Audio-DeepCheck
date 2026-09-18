package com.audiodeepcheck.backend.repository;

import com.audiodeepcheck.backend.domain.AudioChunkAnalysis;
import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.domain.ModuleEvidence;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class MongoPerformanceTest {

    private static final Logger log = LoggerFactory.getLogger(MongoPerformanceTest.class);

    @Autowired
    private CallSessionRepository callSessionRepository;

    @Autowired
    private AnalysisRepository analysisRepository;

    @BeforeEach
    void setUp() {
        callSessionRepository.clear();
        analysisRepository.clear();
    }

    @Test
    @DisplayName("Benchmark MongoDB operations latency: Insert, FindById, SaveChunk, FilteredQuery")
    void testMongoPerformanceBenchmark() {
        int sampleCount = 50;

        // 1. Benchmark CallSession inserts
        long startInsert = System.nanoTime();
        for (int i = 0; i < sampleCount; i++) {
            CallSession session = new CallSession("PERF-" + i, "Caller-" + i, "Receiver-" + i);
            if (i % 2 == 0) {
                session.start(Instant.now());
                session.recordAnalysisResult(CallDecision.AI_GENERATED, 0.92, 0.85, ConflictLevel.LOW, null, 1, "req-" + i);
            } else {
                session.start(Instant.now());
                session.recordAnalysisResult(CallDecision.HUMAN, 0.95, 0.12, ConflictLevel.LOW, null, 1, "req-" + i);
                session.end(Instant.now(), "NORMAL");
                session.complete();
            }
            callSessionRepository.save(session);
        }
        long totalInsertNanos = System.nanoTime() - startInsert;
        double avgInsertMs = (totalInsertNanos / 1_000_000.0) / sampleCount;

        // 2. Benchmark CallSession indexed lookups by callId
        long startFind = System.nanoTime();
        for (int i = 0; i < sampleCount; i++) {
            var found = callSessionRepository.findById("PERF-" + i);
            assertThat(found).isPresent();
        }
        long totalFindNanos = System.nanoTime() - startFind;
        double avgFindMs = (totalFindNanos / 1_000_000.0) / sampleCount;

        // 3. Benchmark Chunk Analysis saves
        long startChunk = System.nanoTime();
        for (int i = 0; i < sampleCount; i++) {
            AudioChunkAnalysis chunk = new AudioChunkAnalysis(
                    1, 0.0, 3.0, CallDecision.AI_GENERATED, 0.91, 0.82, Instant.now()
            );
            analysisRepository.saveChunk("PERF-" + i, chunk);
        }
        long totalChunkNanos = System.nanoTime() - startChunk;
        double avgChunkMs = (totalChunkNanos / 1_000_000.0) / sampleCount;

        // 4. Benchmark Evidence persistence
        long startEvidence = System.nanoTime();
        for (int i = 0; i < sampleCount; i++) {
            List<ModuleEvidence> evidence = List.of(
                    new ModuleEvidence("wav2vec2", "READY", "SUSPICIOUS", 0.95, Map.of()),
                    new ModuleEvidence("df_arena", "READY", "SUSPICIOUS", 0.90, Map.of())
            );
            analysisRepository.saveEvidence("PERF-" + i, evidence, ConflictLevel.LOW);
        }
        long totalEvidenceNanos = System.nanoTime() - startEvidence;
        double avgEvidenceMs = (totalEvidenceNanos / 1_000_000.0) / sampleCount;

        // 5. Benchmark Filtered pagination query
        long startFilter = System.nanoTime();
        for (int i = 0; i < sampleCount; i++) {
            List<CallSession> filtered = callSessionRepository.findFiltered(CallStatus.COMPLETED, CallDecision.HUMAN, 0, 10);
            assertThat(filtered).isNotEmpty();
        }
        long totalFilterNanos = System.nanoTime() - startFilter;
        double avgFilterMs = (totalFilterNanos / 1_000_000.0) / sampleCount;

        log.info("================ MONGO PERFORMANCE BENCHMARK ================");
        log.info("Samples per test: {}", sampleCount);
        log.info(String.format("Avg CallSession Insert:        %.3f ms", avgInsertMs));
        log.info(String.format("Avg CallSession FindById:      %.3f ms", avgFindMs));
        log.info(String.format("Avg Chunk Save:                %.3f ms", avgChunkMs));
        log.info(String.format("Avg Evidence Save:             %.3f ms", avgEvidenceMs));
        log.info(String.format("Avg Filtered History Query:    %.3f ms", avgFilterMs));
        log.info("=============================================================");

        // SLA validations
        assertThat(avgFindMs).isLessThan(20.0); // Indexed lookup must be fast (< 20ms)
        assertThat(avgInsertMs).isLessThan(50.0); // Single document insert < 50ms
        assertThat(avgChunkMs).isLessThan(50.0);
    }
}
