package com.audiodeepcheck.backend.repository.mongo;

import com.audiodeepcheck.backend.domain.AudioChunkAnalysis;
import com.audiodeepcheck.backend.domain.ConflictLevel;
import com.audiodeepcheck.backend.domain.ModuleEvidence;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB document storing the forensic analysis details, timeline chunks,
 * specialist evidence records, and raw AI output.
 */
@Document(collection = "analysis_results")
public class AnalysisResultDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String callId;

    private List<AudioChunkAnalysis> chunks = new ArrayList<>();
    private List<ModuleEvidence> evidence = new ArrayList<>();
    private ConflictLevel conflictLevel;
    private FastApiAnalyzeDto rawFastApiResponse;

    @Indexed
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public AnalysisResultDocument() {}

    public AnalysisResultDocument(String callId) {
        this.id = callId;
        this.callId = callId;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public List<AudioChunkAnalysis> getChunks() { return chunks; }
    public void setChunks(List<AudioChunkAnalysis> chunks) { this.chunks = chunks; }
    public List<ModuleEvidence> getEvidence() { return evidence; }
    public void setEvidence(List<ModuleEvidence> evidence) { this.evidence = evidence; }
    public ConflictLevel getConflictLevel() { return conflictLevel; }
    public void setConflictLevel(ConflictLevel conflictLevel) { this.conflictLevel = conflictLevel; }
    public FastApiAnalyzeDto getRawFastApiResponse() { return rawFastApiResponse; }
    public void setRawFastApiResponse(FastApiAnalyzeDto rawFastApiResponse) { this.rawFastApiResponse = rawFastApiResponse; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
