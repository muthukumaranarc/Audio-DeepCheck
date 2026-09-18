package com.audiodeepcheck.backend.repository.mongo;

import com.audiodeepcheck.backend.domain.AudioChunkAnalysis;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.domain.ModuleEvidence;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.repository.AnalysisRepository;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Primary
@Repository
public class MongoAnalysisRepository implements AnalysisRepository {

    private final SpringDataAnalysisMongoRepository springDataRepo;

    public MongoAnalysisRepository(SpringDataAnalysisMongoRepository springDataRepo) {
        this.springDataRepo = springDataRepo;
    }

    @Override
    public void saveChunk(String callId, AudioChunkAnalysis chunk) {
        AnalysisResultDocument doc = getOrCreate(callId);
        doc.getChunks().add(chunk);
        doc.setUpdatedAt(Instant.now());
        springDataRepo.save(doc);
    }

    @Override
    public void saveChunks(String callId, List<AudioChunkAnalysis> chunks) {
        AnalysisResultDocument doc = getOrCreate(callId);
        doc.getChunks().addAll(chunks);
        doc.setUpdatedAt(Instant.now());
        springDataRepo.save(doc);
    }

    @Override
    public List<AudioChunkAnalysis> findChunksByCallId(String callId) {
        return springDataRepo.findByCallId(callId)
                .map(AnalysisResultDocument::getChunks)
                .orElse(Collections.emptyList());
    }

    @Override
    public void saveEvidence(String callId, List<ModuleEvidence> evidence, ConflictLevel conflictLevel) {
        AnalysisResultDocument doc = getOrCreate(callId);
        doc.setEvidence(evidence);
        doc.setConflictLevel(conflictLevel);
        doc.setUpdatedAt(Instant.now());
        springDataRepo.save(doc);
    }

    @Override
    public Optional<EvidenceRecord> findEvidenceByCallId(String callId) {
        return springDataRepo.findByCallId(callId)
                .map(doc -> new EvidenceRecord(doc.getEvidence(), doc.getConflictLevel()));
    }

    @Override
    public void saveFastApiResponse(String callId, FastApiAnalyzeDto response) {
        AnalysisResultDocument doc = getOrCreate(callId);
        doc.setRawFastApiResponse(response);
        doc.setUpdatedAt(Instant.now());
        springDataRepo.save(doc);
    }

    @Override
    public Optional<FastApiAnalyzeDto> findFastApiResponseByCallId(String callId) {
        return springDataRepo.findByCallId(callId)
                .map(AnalysisResultDocument::getRawFastApiResponse);
    }

    @Override
    public void clear() {
        springDataRepo.deleteAll();
    }

    private AnalysisResultDocument getOrCreate(String callId) {
        return springDataRepo.findByCallId(callId)
                .orElseGet(() -> new AnalysisResultDocument(callId));
    }
}
