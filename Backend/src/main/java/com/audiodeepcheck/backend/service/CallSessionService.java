package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.config.RequestIdFilter;
import com.audiodeepcheck.backend.domain.*;
import com.audiodeepcheck.backend.dto.*;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.exception.CallNotFoundException;
import com.audiodeepcheck.backend.repository.AnalysisRepository;
import com.audiodeepcheck.backend.repository.CallSessionRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class CallSessionService {

    private final CallSessionRepository sessionRepository;
    private final AnalysisRepository analysisRepository;
    private final AtomicLong callIdSequence = new AtomicLong(1000);

    public CallSessionService(CallSessionRepository sessionRepository, AnalysisRepository analysisRepository) {
        this.sessionRepository = sessionRepository;
        this.analysisRepository = analysisRepository;
    }

    public CreateCallResponse createCall(CreateCallRequest request) {
        String callId = "CALL-" + callIdSequence.incrementAndGet();
        String requestId = RequestIdFilter.getCurrentRequestId();

        CallSession session = new CallSession(callId, request.caller(), request.receiver(), requestId);
        sessionRepository.save(session);

        return new CreateCallResponse(
                session.getCallId(),
                session.getStatus(),
                session.getCaller(),
                session.getReceiver(),
                session.getCreatedAt()
        );
    }

    public StartCallResponse startCall(String callId) {
        CallSession session = getSessionOrThrow(callId);
        session.start(Instant.now());
        sessionRepository.save(session);

        return new StartCallResponse(session.getCallId(), session.getStatus(), session.getStartedAt());
    }

    public EndCallResponse endCall(String callId, EndCallRequest request) {
        CallSession session = getSessionOrThrow(callId);
        Instant endedAt = (request != null && request.endedAt() != null) ? request.endedAt() : Instant.now();
        String reason = (request != null && request.reason() != null) ? request.reason() : "USER_ENDED";

        session.end(endedAt, reason);
        // Transition to COMPLETED once ended
        session.complete();
        sessionRepository.save(session);

        return new EndCallResponse(session.getCallId(), session.getStatus(), session.getEndedAt());
    }

    public CallResponse getCall(String callId) {
        CallSession session = getSessionOrThrow(callId);
        return toCallResponse(session);
    }

    public ActiveCallsResponse getActiveCalls() {
        List<CallSession> active = sessionRepository.findByStatusIn(
                List.of(CallStatus.ACTIVE, CallStatus.ANALYZING, CallStatus.CONNECTING)
        );

        List<CallSummaryResponse> summaries = active.stream()
                .map(this::toCallSummary)
                .toList();

        return new ActiveCallsResponse(summaries);
    }

    public PagedCallsResponse getCalls(int page, int size, CallStatus status, CallDecision decision) {
        int sanitizedPage = Math.max(0, page);
        int sanitizedSize = Math.max(1, Math.min(size, 100));

        List<CallSession> items = sessionRepository.findFiltered(status, decision, sanitizedPage, sanitizedSize);
        long totalElements = sessionRepository.countFiltered(status, decision);
        int totalPages = (int) Math.ceil((double) totalElements / sanitizedSize);

        List<CallSummaryResponse> summaries = items.stream()
                .map(this::toCallSummary)
                .toList();

        return new PagedCallsResponse(summaries, sanitizedPage, sanitizedSize, totalElements, totalPages);
    }

    public AnalysisStatusResponse getAnalysisStatus(String callId) {
        CallSession session = getSessionOrThrow(callId);
        return new AnalysisStatusResponse(
                session.getCallId(),
                session.getStatus(),
                session.getLatestDecision(),
                session.getDecisionStrength(),
                session.getConfidenceStatus(),
                session.getQuality() != null ? session.getQuality().score() : null,
                session.getConflictLevel(),
                session.getLastProcessedSequence()
        );
    }

    public EvidenceResponse getEvidence(String callId) {
        getSessionOrThrow(callId);
        Optional<AnalysisRepository.EvidenceRecord> recordOpt = analysisRepository.findEvidenceByCallId(callId);

        if (recordOpt.isEmpty()) {
            return new EvidenceResponse(callId, Collections.emptyList(), ConflictLevel.LOW);
        }

        AnalysisRepository.EvidenceRecord record = recordOpt.get();
        List<EvidenceResponse.ModuleItem> items = record.modules().stream()
                .map(m -> new EvidenceResponse.ModuleItem(m.module(), m.status(), m.direction(), m.contribution()))
                .toList();

        return new EvidenceResponse(callId, items, record.conflictLevel());
    }

    public ChunksTimelineResponse getChunks(String callId) {
        getSessionOrThrow(callId);
        List<AudioChunkAnalysis> chunks = analysisRepository.findChunksByCallId(callId);

        List<ChunksTimelineResponse.ChunkItem> items = chunks.stream()
                .map(c -> new ChunksTimelineResponse.ChunkItem(
                        c.chunkIndex(),
                        c.startSec(),
                        c.endSec(),
                        c.decision(),
                        c.decisionStrength(),
                        c.qualityScore()
                ))
                .toList();

        return new ChunksTimelineResponse(callId, items);
    }

    public CallReportResponse getReport(String callId) {
        CallSession session = getSessionOrThrow(callId);
        Optional<FastApiAnalyzeDto> rawOpt = analysisRepository.findFastApiResponseByCallId(callId);
        List<AudioChunkAnalysis> chunks = analysisRepository.findChunksByCallId(callId);
        Optional<AnalysisRepository.EvidenceRecord> evidenceOpt = analysisRepository.findEvidenceByCallId(callId);

        CallReportResponse.ChunksSummaryReport summaryReport = null;
        Map<String, Object> processingMeta = new HashMap<>();

        if (rawOpt.isPresent()) {
            FastApiAnalyzeDto raw = rawOpt.get();
            if (raw.chunks() != null) {
                FastApiAnalyzeDto.ChunksSummaryDto cs = raw.chunks();
                summaryReport = new CallReportResponse.ChunksSummaryReport(
                        cs.count(),                             // totalChunks
                        cs.count(),                             // usableChunks (same as count)
                        cs.aiFraction() != null
                                ? (int) Math.round(cs.aiFraction() * cs.count()) : 0,
                        cs.humanFraction() != null
                                ? (int) Math.round(cs.humanFraction() * cs.count()) : 0,
                        cs.uncertainFraction() != null
                                ? (int) Math.round(cs.uncertainFraction() * cs.count()) : 0,
                        cs.aiFraction(),
                        null                                    // trimmedMeanScore not in new schema
                );
            }
            if (raw.processingMetadata() != null) {
                processingMeta.put("durationSec", raw.processingMetadata().durationSec());
                processingMeta.put("requestId", raw.processingMetadata().requestId());
                processingMeta.put("ablatedModules", raw.processingMetadata().ablatedModules());
            }
        }

        List<EvidenceResponse.ModuleItem> moduleItems = evidenceOpt.map(r -> r.modules().stream()
                .map(m -> new EvidenceResponse.ModuleItem(m.module(), m.status(), m.direction(), m.contribution()))
                .toList()).orElse(Collections.emptyList());

        List<ChunksTimelineResponse.ChunkItem> chunkItems = chunks.stream()
                .map(c -> new ChunksTimelineResponse.ChunkItem(
                        c.chunkIndex(),
                        c.startSec(),
                        c.endSec(),
                        c.decision(),
                        c.decisionStrength(),
                        c.qualityScore()
                ))
                .toList();

        return new CallReportResponse(
                session.getCallId(),
                session.getCaller(),
                session.getReceiver(),
                session.getStatus(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getDurationSec(),
                session.getLatestDecision(),
                session.getDecisionStrength(),
                session.getConfidenceStatus(),
                session.getSyntheticEvidenceScore(),
                session.getConflictLevel(),
                session.getQuality(),
                summaryReport,
                moduleItems,
                chunkItems,
                processingMeta,
                session.getRequestId()
        );
    }

    public CallSession getSessionOrThrow(String callId) {
        return sessionRepository.findById(callId)
                .orElseThrow(() -> new CallNotFoundException(callId));
    }

    private CallResponse toCallResponse(CallSession session) {
        return new CallResponse(
                session.getCallId(),
                session.getCaller(),
                session.getReceiver(),
                session.getStatus(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getDurationSec(),
                session.getLatestDecision(),
                session.getDecisionStrength(),
                session.getConfidenceStatus(),
                session.getQuality(),
                session.getRequestId()
        );
    }

    private CallSummaryResponse toCallSummary(CallSession session) {
        return new CallSummaryResponse(
                session.getCallId(),
                session.getCaller(),
                session.getReceiver(),
                session.getStatus(),
                session.getDurationSec(),
                session.getLatestDecision(),
                session.getCreatedAt()
        );
    }

    public CallSession save(CallSession session) {
        return sessionRepository.save(session);
    }

    public CallSession createCallWithParticipants(String caller, String receiver, String callerUserId, String receiverUserId) {
        String callId = "CALL-" + callIdSequence.incrementAndGet();
        String requestId = RequestIdFilter.getCurrentRequestId();

        CallSession session = new CallSession(callId, caller, receiver, requestId);
        session.setCallerUserId(callerUserId);
        session.setReceiverUserId(receiverUserId);
        return sessionRepository.save(session);
    }

    // ── Developer Utilities ────────────────────────────────────────────────────

    /** Purge all call sessions and analysis data; reset ID sequence to 1000. */
    public void clearAllData() {
        sessionRepository.clear();
        analysisRepository.clear();
        callIdSequence.set(1000);
    }

    /** Delete a single call session by callId. Returns false if not found. */
    public boolean deleteCall(String callId) {
        if (!sessionRepository.existsById(callId)) {
            return false;
        }
        sessionRepository.deleteById(callId);
        return true;
    }

    /** Seed a standard demo call for immediate testing after a reset. */
    public CallSession seedDemoCall() {
        String callId = "CALL-" + callIdSequence.incrementAndGet();
        CallSession demo = new CallSession(callId, "Muthu (Demo)", "Friend (Demo)", "SEED-REQUEST");
        demo.setCallerUserId("USER-DEMO-A");
        demo.setReceiverUserId("USER-DEMO-B");
        return sessionRepository.save(demo);
    }

    /** Return live counts for the developer stats panel. */
    public Map<String, Object> getStats() {
        long sessions = sessionRepository.count();
        Map<String, Object> stats = new java.util.LinkedHashMap<>();
        stats.put("totalSessions", sessions);
        stats.put("callIdSequence", callIdSequence.get());
        stats.put("timestamp", Instant.now().toString());
        return stats;
    }
}
