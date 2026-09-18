# Audio DeepCheck - Pydantic Request & Response Schemas
from typing import Dict, Any, List, Optional, Literal
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Lightweight health status response."""
    status: str = Field(default="healthy", description="Service health state")
    version: str = Field(..., description="API Version")
    active_detectors: List[str] = Field(..., description="List of integrated evidence detectors")
    device: str = Field(default="cpu", description="Execution device")
    concurrency_limit: int = Field(..., description="Maximum allowed concurrent inference jobs")
    timestamp: str = Field(..., description="Server timestamp (ISO 8601 or UTC)")


class QualityMetricsSchema(BaseModel):
    """Objective signal health and acoustic metrics."""
    duration_sec: float
    sample_rate: int
    rms_energy: float
    peak_amplitude: float
    dynamic_range_db: float
    clipping_ratio: float
    silence_ratio: float
    voiced_ratio: float
    spectral_bandwidth_hz: float
    spectral_rolloff_85_hz: float
    snr_db: float
    zero_crossing_rate: float
    spectral_flatness: float


class QualityReportSchema(BaseModel):
    """Signal quality report and telephony artifact flags."""
    score: float = Field(..., description="Signal quality score [0.0 - 1.0]")
    quality_score: float = Field(..., description="Alias for score")
    flags: List[str] = Field(default_factory=list, description="Degradation flags (e.g. LOW_SNR, NARROWBAND)")
    quality_flags: List[str] = Field(default_factory=list, description="Alias for flags")
    metrics: QualityMetricsSchema
    usable_for_voice_analysis: bool = Field(..., description="Whether audio contains sufficient voiced speech")


class ModuleEvidenceSchema(BaseModel):
    """Forensic evidence contribution from a single specialist detector."""
    module: str = Field(..., description="Originating module name")
    evidence_type: str = Field(..., description="Type of evidence (classifier, spectral, prosody, embedding)")
    raw_score: Optional[float] = Field(None, description="Uncalibrated raw model output")
    normalized_score: float = Field(..., description="Signed score on [-1.0, +1.0] scale")
    configured_weight: float = Field(..., description="Initial module weight")
    quality_weight: float = Field(..., description="Quality-dependent attenuation factor")
    effective_weight: float = Field(..., description="Final dynamically normalized weight")
    contribution: float = Field(..., description="Effective contribution to fusion sum")
    status: str = Field(..., description="USED, DOWNWEIGHTED, UNAVAILABLE, REJECTED, or MIXED")
    reason: str = Field(..., description="Explanation for status and weight adjustments")
    calibration_status: str = Field(..., description="State of score calibration")


class ChunkDetailSchema(BaseModel):
    """Analysis result for a single temporal chunk."""
    chunk_index: int
    start_sec: float
    end_sec: float
    duration_sec: float = 0.0
    fusion_score: float
    quality_score: float
    quality_flags: List[str] = Field(default_factory=list)
    conflict_level: str
    active_modules_count: int = 0


class ChunksSummarySchema(BaseModel):
    """Sliding-window temporal chunking summary."""
    count: int = Field(..., description="Total number of evaluated chunks")
    ai_fraction: float = Field(..., description="Fraction of chunks classified as AI")
    human_fraction: float = Field(..., description="Fraction of chunks classified as Human")
    uncertain_fraction: float = Field(..., description="Fraction of chunks marked uncertain")
    chunk_details: Optional[List[ChunkDetailSchema]] = Field(None, description="Detailed per-chunk results")


class FusionSummarySchema(BaseModel):
    """Multi-evidence master fusion synthesis."""
    synthetic_evidence_score: float = Field(..., description="Overall synthetic likelihood on [0.0, 1.0]")
    human_evidence_score: float = Field(..., description="Overall human likelihood on [0.0, 1.0]")
    uncertainty_score: float = Field(..., description="Epistemic uncertainty score on [0.0, 1.0]")
    conflict_level: Literal["LOW", "MEDIUM", "HIGH"] = Field(..., description="Pairwise disagreement level between detectors")
    aggregation_method: str = Field(default="trimmed_mean", description="Temporal aggregation method")
    raw_aggregate_score: float = Field(..., description="Signed aggregate score on [-1.0, +1.0]")
    mean_chunk_score: float = Field(..., description="Arithmetic mean across chunk scores")
    median_chunk_score: float = Field(..., description="Median across chunk scores")
    score_variance: float = Field(..., description="Variance across chunk scores")
    score_iqr: float = Field(..., description="Interquartile range across chunk scores")


class ProcessingMetadataSchema(BaseModel):
    """Audit and telemetry metadata for the request."""
    request_id: str = Field(..., description="Unique request tracing identifier")
    filename: str = Field(..., description="Sanitized uploaded filename")
    file_size_bytes: int = Field(..., description="Audio file size in bytes")
    duration_sec: float = Field(..., description="Audio duration in seconds")
    processing_time_sec: float = Field(..., description="Server inference latency in seconds")


class AnalyzeAudioResponse(BaseModel):
    """Master response schema for Audio DeepCheck analysis."""
    decision: Literal["HUMAN", "AI_GENERATED", "UNCERTAIN"] = Field(
        ...,
        description="Final master decision. UNCERTAIN is assigned when models conflict or quality is poor.",
    )
    decision_strength: float = Field(
        ...,
        description="Provisional forensic decision strength [0.0 - 1.0]. Not a calibrated probability.",
    )
    confidence_status: Literal["PROVISIONAL"] = Field(
        default="PROVISIONAL",
        description="Explicit status indicating the confidence strength is uncalibrated/provisional.",
    )
    quality: QualityReportSchema
    fusion: FusionSummarySchema
    modules: Optional[List[ModuleEvidenceSchema]] = None
    chunks: Optional[ChunksSummarySchema] = None
    processing: ProcessingMetadataSchema


class ErrorResponse(BaseModel):
    """Standardized error contract preventing stack trace leakage."""
    detail: str = Field(..., description="Human-readable error description")
    error_code: str = Field(..., description="Machine-readable error classification")
    request_id: Optional[str] = Field(None, description="Associated request ID for support/tracing")
