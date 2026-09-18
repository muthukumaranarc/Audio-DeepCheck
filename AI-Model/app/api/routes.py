# Audio DeepCheck - API Routes
from datetime import datetime, timezone
import logging
from pathlib import Path
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

from app.config import (
    APP_VERSION,
    ANALYSIS_CONCURRENCY,
)
from app.api.schemas import (
    HealthResponse,
    AnalyzeAudioResponse,
    ProcessingMetadataSchema,
    ChunksSummarySchema,
    ChunkDetailSchema,
)
from app.api.dependencies import acquire_concurrency_permit, get_fusion_service
from app.utils.file_security import secure_temp_audio_file

logger = logging.getLogger("audio_deepcheck.api")
router = APIRouter(prefix="/api/v1", tags=["Voice Authenticity"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Health Check",
    description=(
        "Lightweight health probe confirming API service readiness and reporting active detectors. "
        "Does NOT trigger expensive neural network model inference."
    ),
)
async def health_check() -> HealthResponse:
    """Fast health status endpoint."""
    return HealthResponse(
        status="healthy",
        version=APP_VERSION,
        active_detectors=[
            "wav2vec2",
            "df_arena",
            "spectrogram",
            "prosody",
            "whisper_representation",
        ],
        device="cpu",
        concurrency_limit=ANALYSIS_CONCURRENCY,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.post(
    "/analyze",
    response_model=AnalyzeAudioResponse,
    summary="Analyze Audio for Synthetic Voice / Deepfake Forensic Evidence",
    description=(
        "Upload an audio recording to run the multi-evidence voice authenticity pipeline. "
        "Audio is pre-filtered for telephony signal quality, evaluated through sliding temporal chunks "
        "across sequential specialist forensic models (Wav2Vec2, DF Arena 500M, Spectrogram, Prosody, Whisper), "
        "and synthesized via trimmed-mean aggregation and conflict arbitration. "
        "Confidence is PROVISIONAL and does not represent an empirically calibrated probability."
    ),
    responses={
        200: {"description": "Audio successfully analyzed"},
        400: {"description": "Invalid audio data, duration limit exceeded, or parameter conflict"},
        413: {"description": "Uploaded file exceeds maximum size limit"},
        415: {"description": "Unsupported audio container or corrupted file format"},
        422: {"description": "Validation error in request parameters"},
        503: {"description": "Inference server busy (concurrency capacity reached)"},
    },
)
async def analyze_audio(
    request: Request,
    file: UploadFile = File(..., description="Audio recording (.wav, .mp3, .flac, .ogg)"),
    chunk_sec: Optional[float] = Query(None, ge=1.0, le=30.0, description="Sliding window chunk duration in seconds"),
    hop_sec: Optional[float] = Query(None, ge=0.5, le=15.0, description="Sliding window hop step in seconds"),
    ablate: Optional[List[str]] = Query(None, description="Optional modules to ablate from fusion"),
    return_chunks: bool = Query(True, description="Whether to include temporal chunk breakdown"),
    return_modules: bool = Query(True, description="Whether to include specialist module breakdown"),
    _permit: None = Depends(acquire_concurrency_permit),
    service_factory = Depends(get_fusion_service),
) -> AnalyzeAudioResponse:
    """Analyze uploaded audio file with guaranteed temporary file cleanup and concurrency gating."""
    req_id = getattr(request.state, "request_id", "unknown-request")
    t0 = time.perf_counter()

    # Parameter consistency check
    if chunk_sec is not None and hop_sec is not None and hop_sec > chunk_sec:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"hop_sec ({hop_sec:.1f}s) cannot be greater than chunk_sec ({chunk_sec:.1f}s).",
        )

    logger.info(
        "Request %s: Received audio upload '%s' for analysis",
        req_id,
        file.filename or "unknown",
    )

    # Secure temporary file lifecycle (size validation, duration check, guaranteed cleanup)
    async with secure_temp_audio_file(file) as (temp_path, clean_filename, file_size, duration_sec):
        logger.info(
            "Request %s: Upload validated (size=%d bytes, duration=%.2fs). Starting fusion pipeline.",
            req_id,
            file_size,
            duration_sec,
        )

        try:
            fusion_service = service_factory(
                chunk_sec=chunk_sec,
                hop_sec=hop_sec,
                ablate=ablate,
            )
            raw_result = fusion_service.analyze_file(temp_path)
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Request %s: Fusion pipeline execution failed: %s", req_id, str(exc), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Voice authenticity analysis failed during inference execution.",
            )

        elapsed_sec = round(time.perf_counter() - t0, 3)

        processing_meta = ProcessingMetadataSchema(
            request_id=req_id,
            filename=clean_filename,
            file_size_bytes=file_size,
            duration_sec=duration_sec,
            processing_time_sec=elapsed_sec,
        )

        # Assemble chunk details according to query flags
        chunks_payload = None
        if return_chunks and "chunks" in raw_result:
            c = raw_result["chunks"]
            chunk_details = [
                ChunkDetailSchema(**cd) for cd in c.get("chunk_details", [])
            ]
            chunks_payload = ChunksSummarySchema(
                count=c["count"],
                ai_fraction=c["ai_fraction"],
                human_fraction=c["human_fraction"],
                uncertain_fraction=c["uncertain_fraction"],
                chunk_details=chunk_details,
            )

        modules_payload = raw_result["modules"] if return_modules else None

        response = AnalyzeAudioResponse(
            decision=raw_result["decision"],
            decision_strength=raw_result["decision_strength"],
            confidence_status=raw_result.get("confidence_status", "PROVISIONAL"),
            quality=raw_result["quality"],
            fusion=raw_result["fusion"],
            modules=modules_payload,
            chunks=chunks_payload,
            processing=processing_meta,
        )

        logger.info(
            "Request %s: Completed in %.2fs -> Decision: [%s] | Strength: %.4f | Conflict: %s",
            req_id,
            elapsed_sec,
            response.decision,
            response.decision_strength,
            response.fusion.conflict_level,
        )

        return response
