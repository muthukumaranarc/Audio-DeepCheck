package com.audiodeepcheck.backend.dto.fastapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FastApiAnalyzeDto(
        @JsonProperty("master_decision") String masterDecision,
        @JsonProperty("decision_strength") Double decisionStrength,
        @JsonProperty("confidence_status") String confidenceStatus,
        @JsonProperty("synthetic_evidence_score") Double syntheticEvidenceScore,
        @JsonProperty("conflict_level") String conflictLevel,
        QualityDto quality,
        @JsonProperty("chunks_summary") ChunksSummaryDto chunksSummary,
        @JsonProperty("chunk_details") List<ChunkDetailDto> chunkDetails,
        Map<String, ModuleDetailDto> modules,
        @JsonProperty("processing_metadata") ProcessingMetadataDto processingMetadata
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QualityDto(
            Boolean usable,
            @JsonProperty("quality_score") Double qualityScore,
            @JsonProperty("snr_db") Double snrDb,
            List<String> flags
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChunksSummaryDto(
            @JsonProperty("total_chunks") Integer totalChunks,
            @JsonProperty("usable_chunks") Integer usableChunks,
            @JsonProperty("ai_chunks") Integer aiChunks,
            @JsonProperty("human_chunks") Integer humanChunks,
            @JsonProperty("uncertain_chunks") Integer uncertainChunks,
            @JsonProperty("ai_chunk_ratio") Double aiChunkRatio,
            @JsonProperty("trimmed_mean_score") Double trimmedMeanScore
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChunkDetailDto(
            @JsonProperty("chunk_index") Integer chunkIndex,
            @JsonProperty("start_sec") Double startSec,
            @JsonProperty("end_sec") Double endSec,
            @JsonProperty("duration_sec") Double durationSec,
            @JsonProperty("fusion_score") Double fusionScore,
            @JsonProperty("effective_decision") String effectiveDecision,
            @JsonProperty("quality_score") Double qualityScore,
            @JsonProperty("quality_flags") List<String> qualityFlags,
            @JsonProperty("active_modules_count") Integer activeModulesCount
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ModuleDetailDto(
            String module,
            @JsonProperty("evidence_type") String evidenceType,
            @JsonProperty("synthetic_score") Double syntheticScore,
            @JsonProperty("effective_weight") Double effectiveWeight,
            @JsonProperty("normalized_score") Double normalizedScore,
            String status,
            @JsonProperty("quality_score") Double qualityScore,
            Map<String, Object> metadata
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProcessingMetadataDto(
            @JsonProperty("duration_sec") Double durationSec,
            @JsonProperty("request_id") String requestId,
            @JsonProperty("ablated_modules") List<String> ablatedModules,
            @JsonProperty("chunk_sec") Double chunkSec,
            @JsonProperty("hop_sec") Double hopSec
    ) {}
}
