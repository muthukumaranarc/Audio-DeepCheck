package com.audiodeepcheck.backend.dto.fastapi;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.*;

/**
 * DTO matching the actual FastAPI AnalyzeAudioResponse schema.
 *
 * FastAPI top-level: decision, decision_strength, confidence_status,
 *                    quality, fusion, modules, chunks, processing
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FastApiAnalyzeDto(

        // "decision" in FastAPI (HUMAN | AI_GENERATED | UNCERTAIN)
        @JsonAlias({"decision", "master_decision", "final_decision"})
        @JsonProperty("decision")
        String masterDecision,

        @JsonProperty("decision_strength")
        Double decisionStrength,

        @JsonProperty("confidence_status")
        String confidenceStatus,

        // Nested quality report from FastAPI
        QualityReportDto quality,

        // Nested fusion summary (contains conflict_level, synthetic_evidence_score, etc.)
        FusionSummaryDto fusion,

        // List of specialist module evidences
        @JsonAlias({"modules", "module_details"})
        List<ModuleDetailDto> modules,

        // Nested chunks summary (contains chunk_details list)
        @JsonAlias({"chunks", "chunks_summary"})
        ChunksSummaryDto chunks,

        // Processing metadata
        @JsonAlias({"processing", "processing_metadata"})
        ProcessingMetadataDto processing

) {
    // ── Convenience accessors for backward-compatible callsites ──────────────

    public String getEffectiveDecision() {
        if (masterDecision != null && !masterDecision.isBlank()) return masterDecision;
        return "UNCERTAIN";
    }

    public Double getEffectiveSyntheticScore() {
        if (fusion != null && fusion.syntheticEvidenceScore() != null) return fusion.syntheticEvidenceScore();
        return 0.5;
    }

    public Double getEffectiveHumanScore() {
        if (fusion != null && fusion.humanEvidenceScore() != null) return fusion.humanEvidenceScore();
        return 1.0 - getEffectiveSyntheticScore();
    }

    public String getEffectiveConflictLevel() {
        if (fusion != null && fusion.conflictLevel() != null && !fusion.conflictLevel().isBlank())
            return fusion.conflictLevel();
        return "LOW";
    }

    /** Flat list of chunk details extracted from the nested chunks object. */
    public List<ChunkDetailDto> getEffectiveChunkDetails() {
        if (chunks != null && chunks.chunkDetails() != null && !chunks.chunkDetails().isEmpty())
            return chunks.chunkDetails();
        return Collections.emptyList();
    }

    /** Returns module list directly (FastAPI always sends as a List). */
    public List<ModuleDetailDto> getEffectiveModuleList() {
        if (modules == null) return Collections.emptyList();
        return modules;
    }

    /** Legacy accessor — returns top-level processing_metadata record. */
    public ProcessingMetadataDto processingMetadata() {
        return processing;
    }

    // ── Nested record types ─────────────────────────────────────────────────

    /**
     * QualityReportSchema from FastAPI.
     * Fields: score, quality_score, flags, quality_flags, metrics, usable_for_voice_analysis
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QualityReportDto(
            Double score,
            @JsonProperty("quality_score")
            Double qualityScore,
            List<String> flags,
            @JsonProperty("quality_flags")
            List<String> qualityFlags,
            @JsonProperty("usable_for_voice_analysis")
            @JsonAlias({"usable_for_voice_analysis", "usable"})
            Boolean usable,
            QualityMetricsDto metrics
    ) {
        /** Convenience: get SNR from nested metrics. */
        public Double snrDb() {
            return metrics != null ? metrics.snrDb() : null;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QualityMetricsDto(
            @JsonProperty("duration_sec") Double durationSec,
            @JsonProperty("sample_rate") Integer sampleRate,
            @JsonProperty("snr_db") Double snrDb,
            @JsonProperty("rms_energy") Double rmsEnergy,
            @JsonProperty("silence_ratio") Double silenceRatio,
            @JsonProperty("voiced_ratio") Double voicedRatio
    ) {}

    /**
     * FusionSummarySchema from FastAPI.
     * Contains: synthetic_evidence_score, human_evidence_score, conflict_level, etc.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FusionSummaryDto(
            @JsonProperty("synthetic_evidence_score")
            Double syntheticEvidenceScore,
            @JsonProperty("human_evidence_score")
            Double humanEvidenceScore,
            @JsonProperty("uncertainty_score")
            Double uncertaintyScore,
            @JsonProperty("conflict_level")
            String conflictLevel,
            @JsonProperty("aggregation_method")
            String aggregationMethod,
            @JsonProperty("raw_aggregate_score")
            Double rawAggregateScore,
            @JsonProperty("mean_chunk_score")
            Double meanChunkScore,
            @JsonProperty("median_chunk_score")
            Double medianChunkScore,
            @JsonProperty("score_variance")
            Double scoreVariance,
            @JsonProperty("score_iqr")
            Double scoreIqr
    ) {}

    /**
     * ChunksSummarySchema from FastAPI.
     * Contains: count, ai_fraction, human_fraction, uncertain_fraction, chunk_details
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChunksSummaryDto(
            Integer count,
            @JsonProperty("ai_fraction") Double aiFraction,
            @JsonProperty("human_fraction") Double humanFraction,
            @JsonProperty("uncertain_fraction") Double uncertainFraction,
            @JsonProperty("chunk_details") List<ChunkDetailDto> chunkDetails
    ) {}

    /**
     * ChunkDetailSchema from FastAPI.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ChunkDetailDto(
            @JsonProperty("chunk_index") Integer chunkIndex,
            @JsonProperty("start_sec") Double startSec,
            @JsonProperty("end_sec") Double endSec,
            @JsonProperty("duration_sec") Double durationSec,
            @JsonProperty("fusion_score") Double fusionScore,
            @JsonProperty("quality_score") Double qualityScore,
            @JsonProperty("quality_flags") List<String> qualityFlags,
            @JsonProperty("conflict_level") String conflictLevel,
            @JsonProperty("active_modules_count") Integer activeModulesCount,
            // legacy alias used by CallAiWindowScheduler
            @JsonProperty("effective_decision")
            @JsonAlias({"decision", "effective_decision"})
            String effectiveDecision
    ) {}

    /**
     * ModuleEvidenceSchema from FastAPI.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ModuleDetailDto(
            String module,
            @JsonProperty("evidence_type") String evidenceType,
            @JsonProperty("raw_score") Double syntheticScore,
            @JsonProperty("effective_weight") Double effectiveWeight,
            @JsonProperty("normalized_score") Double normalizedScore,
            String status,
            String reason,
            @JsonProperty("calibration_status") String calibrationStatus
    ) {
        /** Legacy compat: qualityScore not in schema, return null */
        public Double qualityScore() { return null; }
        /** Legacy compat: metadata not in schema, return empty map */
        public Map<String, Object> metadata() { return Collections.emptyMap(); }
    }

    /**
     * ProcessingMetadataSchema from FastAPI.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProcessingMetadataDto(
            @JsonProperty("duration_sec") Double durationSec,
            @JsonProperty("request_id") String requestId,
            @JsonProperty("filename") String filename,
            @JsonProperty("file_size_bytes") Long fileSizeBytes,
            @JsonProperty("processing_time_sec") Double processingTimeSec,
            // kept for legacy callers
            @JsonProperty("ablated_modules") List<String> ablatedModules,
            @JsonProperty("chunk_sec") Double chunkSec,
            @JsonProperty("hop_sec") Double hopSec
    ) {}
}
