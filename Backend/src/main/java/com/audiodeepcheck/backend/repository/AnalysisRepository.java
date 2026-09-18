package com.audiodeepcheck.backend.repository;

import com.audiodeepcheck.backend.domain.AudioChunkAnalysis;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.domain.ModuleEvidence;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AnalysisRepository {
    void saveChunk(String callId, AudioChunkAnalysis chunk);
    void saveChunks(String callId, List<AudioChunkAnalysis> chunks);
    List<AudioChunkAnalysis> findChunksByCallId(String callId);

    void saveEvidence(String callId, List<ModuleEvidence> evidence, ConflictLevel conflictLevel);
    Optional<EvidenceRecord> findEvidenceByCallId(String callId);

    void saveFastApiResponse(String callId, FastApiAnalyzeDto response);
    Optional<FastApiAnalyzeDto> findFastApiResponseByCallId(String callId);

    void clear();

    record EvidenceRecord(List<ModuleEvidence> modules, ConflictLevel conflictLevel) {}
}
