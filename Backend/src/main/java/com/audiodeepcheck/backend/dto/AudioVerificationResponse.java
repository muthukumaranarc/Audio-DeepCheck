package com.audiodeepcheck.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record AudioVerificationResponse(
        @JsonProperty("original_filename") String originalFilename,
        @JsonProperty("processed_filename") String processedFilename,
        @JsonProperty("original_format") String originalFormat,
        @JsonProperty("was_converted") boolean wasConverted,
        String decision,
        @JsonProperty("decision_strength") Double decisionStrength,
        @JsonProperty("confidence_status") String confidenceStatus,
        @JsonProperty("synthetic_evidence_score") Double syntheticEvidenceScore,
        @JsonProperty("human_evidence_score") Double humanEvidenceScore,
        @JsonProperty("conflict_level") String conflictLevel,
        @JsonProperty("duration_sec") Double durationSec,
        QualityReportDto quality,
        List<ModuleResultDto> modules,
        List<ChunkResultDto> chunks
) {
    public record QualityReportDto(
            Double score,
            Boolean usable,
            @JsonProperty("snr_db") Double snrDb,
            List<String> flags
    ) {}

    public record ModuleResultDto(
            String module,
            @JsonProperty("evidence_type") String evidenceType,
            @JsonProperty("raw_score") Double rawScore,
            @JsonProperty("normalized_score") Double normalizedScore,
            @JsonProperty("effective_weight") Double effectiveWeight,
            Double contribution,
            String status,
            String reason
    ) {}

    public record ChunkResultDto(
            @JsonProperty("chunk_index") Integer chunkIndex,
            @JsonProperty("start_sec") Double startSec,
            @JsonProperty("end_sec") Double endSec,
            @JsonProperty("fusion_score") Double fusionScore,
            @JsonProperty("quality_score") Double qualityScore,
            @JsonProperty("conflict_level") String conflictLevel
    ) {}
}
