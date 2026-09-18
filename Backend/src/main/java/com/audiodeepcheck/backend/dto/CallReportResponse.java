package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.AudioQuality;
import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.ConflictLevel;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record CallReportResponse(
        String callId,
        String caller,
        String receiver,
        CallStatus status,
        Instant startedAt,
        Instant endedAt,
        Long durationSec,
        CallDecision finalDecision,
        Double decisionStrength,
        String confidenceStatus,
        Double syntheticEvidenceScore,
        ConflictLevel conflictLevel,
        AudioQuality quality,
        ChunksSummaryReport chunksSummary,
        List<EvidenceResponse.ModuleItem> modules,
        List<ChunksTimelineResponse.ChunkItem> chunks,
        Map<String, Object> processingMetadata,
        String requestId
) {
    public record ChunksSummaryReport(
            Integer totalChunks,
            Integer usableChunks,
            Integer aiChunks,
            Integer humanChunks,
            Integer uncertainChunks,
            Double aiChunkRatio,
            Double trimmedMeanScore
    ) {}
}
