# Audio DeepCheck - Common Evidence Normalization Contract & Long-Audio Interface
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, Any, Optional, List, Union, Tuple
import numpy as np


class EvidenceType(str, Enum):
    """Category of acoustic or forensic evidence."""
    CLASSIFIER = "classifier"      # Supervised model outputting scores/classes (e.g. Wav2Vec2, DF Arena)
    EMBEDDING = "embedding"        # Learned representations / features (e.g. Whisper representations)
    SPECTRAL = "spectral"          # Frequency-domain signal analysis (STFT, Mel, Spectral stats)
    PROSODY = "prosody"            # Time-domain pitch and energy dynamics (F0, voicing, pauses)
    PROVENANCE = "provenance"      # Watermarking, metadata, generator signatures


class CalibrationStatus(str, Enum):
    """Calibration state of numeric detector scores."""
    NOT_CALIBRATED = "not_calibrated"      # Raw logits or uncalibrated softmax
    CALIBRATED_PLATT = "calibrated_platt"  # Platt scaling / logistic calibration
    CALIBRATED_ISOTONIC = "calibrated_iso" # Isotonic regression calibration
    NOT_APPLICABLE = "not_applicable"      # Not a continuous probability (e.g. embeddings)


class ScoreDirection(str, Enum):
    """Directionality of numeric synthetic score."""
    HIGHER_MEANS_SYNTHETIC = "higher_means_synthetic"
    HIGHER_MEANS_HUMAN = "higher_means_human"
    DISTANCE_TO_CENTROID = "distance_to_centroid"
    NOT_APPLICABLE = "not_applicable"


class ProvenanceState(str, Enum):
    """Provenance & watermark detection states."""
    DETECTED = "DETECTED"                  # Definite verifiable watermark / signature detected
    NOT_DETECTED = "NOT_DETECTED"          # Scanner evaluated file and found no watermark
    NOT_APPLICABLE = "NOT_APPLICABLE"      # File format or bandwidth does not support scheme
    UNAVAILABLE = "UNAVAILABLE"            # Scanner unavailable or failed to execute


@dataclass
class EvidenceRecord:
    """
    Standardized container for independent evidence sources feeding
    into the future Multi-Evidence Fusion Layer.
    Preserves raw outputs, score direction, quality indicators, and module identity.
    """
    module: str
    evidence_type: str
    raw_output: Dict[str, Any]
    synthetic_score: Optional[float] = None
    score_direction: str = ScoreDirection.NOT_APPLICABLE
    quality_score: Optional[float] = None
    quality_metadata: Dict[str, Any] = field(default_factory=dict)
    calibration_status: str = CalibrationStatus.NOT_CALIBRATED
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert record to a clean, JSON-serializable Python dictionary."""
        return {
            "module": self.module,
            "evidence_type": self.evidence_type,
            "synthetic_score": float(self.synthetic_score) if self.synthetic_score is not None else None,
            "score_direction": self.score_direction,
            "quality_score": float(self.quality_score) if self.quality_score is not None else None,
            "quality_metadata": self.quality_metadata,
            "calibration_status": self.calibration_status,
            "metadata": self.metadata,
            "raw_output": self.raw_output,
        }


@dataclass
class AudioChunk:
    """
    Standard metadata container for long-audio chunking.
    Prepares future phone-call and long-recording pipelines.
    """
    chunk_index: int
    start_sec: float
    end_sec: float
    duration_sec: float
    sample_count: int
    evidence: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_index": self.chunk_index,
            "start_sec": round(self.start_sec, 3),
            "end_sec": round(self.end_sec, 3),
            "duration_sec": round(self.duration_sec, 3),
            "sample_count": self.sample_count,
            "evidence": self.evidence,
        }


def create_audio_chunks(
    waveform: np.ndarray,
    sr: int = 16000,
    chunk_sec: float = 4.0,
    overlap_sec: float = 1.0,
) -> List[Tuple[np.ndarray, AudioChunk]]:
    """
    Slice an audio waveform into fixed-duration overlapping chunks.
    Returns:
        List of (chunk_waveform, AudioChunk) tuples.
    """
    if len(waveform) == 0:
        return []

    chunk_samples = int(chunk_sec * sr)
    step_samples = int((chunk_sec - overlap_sec) * sr)
    total_samples = len(waveform)

    # If audio is shorter than or equal to one chunk, return single chunk
    if total_samples <= chunk_samples:
        chunk = AudioChunk(
            chunk_index=0,
            start_sec=0.0,
            end_sec=round(total_samples / sr, 3),
            duration_sec=round(total_samples / sr, 3),
            sample_count=total_samples,
        )
        return [(waveform, chunk)]

    chunks = []
    chunk_idx = 0
    start_sample = 0

    while start_sample < total_samples:
        end_sample = min(start_sample + chunk_samples, total_samples)
        chunk_arr = waveform[start_sample:end_sample]

        # Avoid trailing fragment that is too short (< 0.5s)
        if len(chunk_arr) < int(0.5 * sr) and chunk_idx > 0:
            break

        chunk_meta = AudioChunk(
            chunk_index=chunk_idx,
            start_sec=round(start_sample / sr, 3),
            end_sec=round(end_sample / sr, 3),
            duration_sec=round(len(chunk_arr) / sr, 3),
            sample_count=len(chunk_arr),
        )
        chunks.append((chunk_arr, chunk_meta))

        if end_sample >= total_samples:
            break

        start_sample += step_samples
        chunk_idx += 1

    return chunks


# =========================================================================
# Adapters for Existing Evidence Sources
# =========================================================================

def adapt_wav2vec2_evidence(w2v_result: Dict[str, Any]) -> EvidenceRecord:
    """Convert Wav2Vec2 detector output into standard EvidenceRecord."""
    pred = w2v_result.get("prediction", "unknown")
    fake_prob = w2v_result.get("fake_probability", 0.5)
    real_prob = w2v_result.get("real_probability", 0.5)
    raw_logits = w2v_result.get("raw_logits", {})

    return EvidenceRecord(
        module="wav2vec2",
        evidence_type=EvidenceType.CLASSIFIER,
        raw_output=w2v_result,
        synthetic_score=round(float(fake_prob), 4),
        score_direction=ScoreDirection.HIGHER_MEANS_SYNTHETIC,
        quality_score=round(max(float(fake_prob), float(real_prob)), 4),
        quality_metadata={
            "duration_sec": w2v_result.get("audio_metadata", {}).get("duration_seconds", 0.0),
            "assessment": w2v_result.get("assessment", "UNCERTAIN"),
        },
        calibration_status=CalibrationStatus.NOT_CALIBRATED,
        metadata={
            "backend": w2v_result.get("backend", "onnx"),
            "prediction": pred,
            "raw_logits": raw_logits,
        },
    )


def adapt_df_arena_evidence(df_result: Dict[str, Any]) -> EvidenceRecord:
    """Convert DF Arena 500M detector output into standard EvidenceRecord."""
    pred = df_result.get("prediction", "unknown")
    spoof_prob = df_result.get("spoof_probability", 0.5)
    bona_prob = df_result.get("bona_fide_probability", 0.5)
    spoof_logit = df_result.get("spoof_score", 0.0)
    bona_logit = df_result.get("bona_fide_score", 0.0)

    return EvidenceRecord(
        module="df_arena",
        evidence_type=EvidenceType.CLASSIFIER,
        raw_output=df_result,
        synthetic_score=round(float(spoof_prob), 4),
        score_direction=ScoreDirection.HIGHER_MEANS_SYNTHETIC,
        quality_score=round(max(float(spoof_prob), float(bona_prob)), 4),
        quality_metadata={
            "duration_sec": df_result.get("audio_metadata", {}).get("duration_seconds", 0.0),
            "assessment": df_result.get("assessment", "UNCERTAIN"),
        },
        calibration_status=CalibrationStatus.NOT_CALIBRATED,
        metadata={
            "backend": df_result.get("backend", "pytorch_cpu"),
            "prediction": pred,
            "raw_logits": {"spoof_logit": spoof_logit, "bona_fide_logit": bona_logit},
        },
    )


def adapt_spectrogram_evidence(spec_result: Dict[str, Any]) -> EvidenceRecord:
    """Convert Spectrogram analysis output into standard EvidenceRecord."""
    feat = spec_result.get("features", {})
    # Extract continuous key features: centroid, flatness, rolloff95, h/p ratio
    return EvidenceRecord(
        module="spectrogram",
        evidence_type=EvidenceType.SPECTRAL,
        raw_output=spec_result,
        synthetic_score=None,  # Continuous spectral features, no artificial single probability
        score_direction=ScoreDirection.NOT_APPLICABLE,
        quality_score=1.0,
        quality_metadata={
            "stft_shape": spec_result.get("stft_dimensions", {}),
            "mel_shape": spec_result.get("mel_dimensions", {}),
        },
        calibration_status=CalibrationStatus.NOT_APPLICABLE,
        metadata={
            "spectral_centroid_hz": feat.get("spectral_centroid", {}).get("mean"),
            "spectral_flatness": feat.get("spectral_flatness", {}).get("mean"),
            "spectral_rolloff_95_hz": feat.get("spectral_rolloff_95", {}).get("mean"),
            "harmonic_percussive_ratio": feat.get("harmonic_percussive", {}).get("harmonic_percussive_ratio"),
            "low_band_pct": feat.get("mel_band_distribution", {}).get("low_band_energy_fraction"),
        },
    )


def adapt_prosody_evidence(prosody_result: Dict[str, Any]) -> EvidenceRecord:
    """Convert Prosody/F0 analysis output into standard EvidenceRecord."""
    qual = prosody_result.get("analysis_quality", {})
    feat = prosody_result.get("features", {})
    usable = qual.get("usable_for_pitch_features", False)

    return EvidenceRecord(
        module="prosody",
        evidence_type=EvidenceType.PROSODY,
        raw_output=prosody_result,
        synthetic_score=None,  # Continuous prosodic dynamics, no artificial single probability
        score_direction=ScoreDirection.NOT_APPLICABLE,
        quality_score=round(float(qual.get("voiced_ratio", 0.0)), 4),
        quality_metadata={
            "status": prosody_result.get("status", "ok"),
            "duration_sec": qual.get("duration_sec", 0.0),
            "voiced_ratio": qual.get("voiced_ratio", 0.0),
            "valid_f0_frame_ratio": qual.get("valid_f0_frame_ratio", 0.0),
            "usable_for_pitch_features": usable,
        },
        calibration_status=CalibrationStatus.NOT_APPLICABLE,
        metadata={
            "f0_mean_hz": feat.get("f0_mean_hz"),
            "f0_std_hz": feat.get("f0_std_hz"),
            "f0_cov": feat.get("f0_cov"),
            "pitch_local_variability": feat.get("local_pitch_variability"),
            "syllable_peak_rate": feat.get("syllable_peak_rate"),
            "silence_ratio": feat.get("silence_ratio"),
            "jitter_local_proxy": feat.get("jitter_local_proxy"),
            "shimmer_local_proxy": feat.get("shimmer_local_proxy"),
        },
    )
