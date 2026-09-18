package com.audiodeepcheck.backend.repository;

import com.audiodeepcheck.backend.domain.AudioChunkAnalysis;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.domain.ModuleEvidence;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Repository
public class InMemoryAnalysisRepository implements AnalysisRepository {

    private final ConcurrentMap<String, List<AudioChunkAnalysis>> chunksStore = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, EvidenceRecord> evidenceStore = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, FastApiAnalyzeDto> rawResponses = new ConcurrentHashMap<>();

    @Override
    public void saveChunk(String callId, AudioChunkAnalysis chunk) {
        chunksStore.computeIfAbsent(callId, k -> new CopyOnWriteArrayList<>()).add(chunk);
    }

    @Override
    public void saveChunks(String callId, List<AudioChunkAnalysis> chunks) {
        chunksStore.computeIfAbsent(callId, k -> new CopyOnWriteArrayList<>()).addAll(chunks);
    }

    @Override
    public List<AudioChunkAnalysis> findChunksByCallId(String callId) {
        List<AudioChunkAnalysis> list = chunksStore.get(callId);
        return list != null ? Collections.unmodifiableList(new ArrayList<>(list)) : Collections.emptyList();
    }

    @Override
    public void saveEvidence(String callId, List<ModuleEvidence> evidence, ConflictLevel conflictLevel) {
        evidenceStore.put(callId, new EvidenceRecord(evidence, conflictLevel));
    }

    @Override
    public Optional<EvidenceRecord> findEvidenceByCallId(String callId) {
        return Optional.ofNullable(evidenceStore.get(callId));
    }

    @Override
    public void saveFastApiResponse(String callId, FastApiAnalyzeDto response) {
        rawResponses.put(callId, response);
    }

    @Override
    public Optional<FastApiAnalyzeDto> findFastApiResponseByCallId(String callId) {
        return Optional.ofNullable(rawResponses.get(callId));
    }

    @Override
    public void clear() {
        chunksStore.clear();
        evidenceStore.clear();
        rawResponses.clear();
    }
}
