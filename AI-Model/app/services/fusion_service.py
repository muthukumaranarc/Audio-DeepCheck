# Audio DeepCheck - Multi-Evidence Master Decision & Fusion Engine
from dataclasses import dataclass, field, asdict
import gc
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import soundfile as sf
import librosa

from app.services.evidence_contract import (
    EvidenceRecord,
    AudioChunk,
    create_audio_chunks,
    adapt_wav2vec2_evidence,
    adapt_df_arena_evidence,
    adapt_spectrogram_evidence,
    adapt_prosody_evidence,
)
from app.services.quality_service import QualityService, AudioQualityReport
from app.services.calibration_service import CalibrationRegistry
from app.services.evidence_normalizer import EvidenceNormalizer, NormalizedEvidence


@dataclass
class FusionConfig:
    """Configuration parameters for the Master Fusion Engine."""
    chunk_sec: float = 5.0
    hop_sec: float = 2.5
    synthetic_threshold: float = 0.25
    human_threshold: float = -0.25
    max_uncertainty_threshold: float = 0.50
    min_quality_threshold: float = 0.35
    custom_weights: Optional[Dict[str, float]] = None
    ablate_modules: List[str] = field(default_factory=list)


class FusionService:
    """
    Master Decision Engine combining multiple specialist forensic evidence sources
    into an explainable, quality-gated assessment.
    Executes models sequentially with explicit lifecycle management to enforce
    strict 8 GB RAM CPU safety.
    """

    def __init__(
        self,
        config: Optional[FusionConfig] = None,
        quality_service: Optional[QualityService] = None,
        normalizer: Optional[EvidenceNormalizer] = None,
        calibration_registry: Optional[CalibrationRegistry] = None,
    ):
        self.config = config or FusionConfig()
        self.quality_service = quality_service or QualityService()
        self.calibration_registry = calibration_registry or CalibrationRegistry()
        self.normalizer = normalizer or EvidenceNormalizer(
            weights=self.config.custom_weights,
            calibration_registry=self.calibration_registry,
        )

        # Deferred model instances
        self._wav2vec_detector = None
        self._df_arena_detector = None
        self._spectrogram_service = None
        self._prosody_service = None
        self._whisper_rep_service = None

    def _is_ablated(self, module_name: str) -> bool:
        """Check if a module is currently ablated (disabled)."""
        ablate_lower = [m.lower().replace("-", "").replace("_", "") for m in self.config.ablate_modules]
        mod_clean = module_name.lower().replace("-", "").replace("_", "")
        return mod_clean in ablate_lower

    def validate_waveform(self, y: np.ndarray) -> np.ndarray:
        """Validate input waveform and ensure 1D mono float32."""
        if not isinstance(y, np.ndarray):
            raise TypeError(f"Expected numpy.ndarray, got {type(y).__name__}")
        if y.size == 0:
            raise ValueError("Audio waveform cannot be empty.")
        if np.any(np.isnan(y)) or np.any(np.isinf(y)):
            raise ValueError("Audio waveform contains NaN or Inf values.")

        if y.ndim > 1:
            y = np.mean(y, axis=1)

        return y.astype(np.float32)

    def analyze_waveform(
        self,
        y: np.ndarray,
        sr: int = 16000,
    ) -> Dict[str, Any]:
        """
        Execute full multi-evidence fusion pipeline on an in-memory audio waveform.
        """
        y = self.validate_waveform(y)

        # Standardize sample rate to 16,000 Hz if necessary
        if sr != 16000:
            y = librosa.resample(y, orig_sr=sr, target_sr=16000)
            sr = 16000

        duration_sec = len(y) / sr

        # 1. Overall file-level quality assessment
        overall_quality = self.quality_service.assess_waveform(y, sr)

        # If overall file is unusable (e.g. pure silence, <0.2s duration), return early UNCERTAIN
        if not overall_quality.usable_for_voice_analysis:
            return self._build_unusable_result(overall_quality, duration_sec)

        # 2. Slice audio into overlapping chunks
        chunks = create_audio_chunks(
            y,
            sr=sr,
            chunk_sec=self.config.chunk_sec,
            overlap_sec=self.config.chunk_sec - self.config.hop_sec,
        )

        chunk_results: List[Dict[str, Any]] = []

        # 3. Sequential Evidence Extraction Across All Chunks
        # To strictly enforce 8 GB RAM constraints, we execute one heavy model family
        # across all chunks at a time, releasing its memory before the next model runs.
        chunk_evidence_records = [{} for _ in range(len(chunks))]
        chunk_qualities = [
            self.quality_service.assess_waveform(c_arr, sr) for c_arr, _ in chunks
        ]

        # --- Stream 1: Wav2Vec2 ---
        if not self._is_ablated("wav2vec2"):
            try:
                from app.services.wav2vec_service import Wav2Vec2Detector
                w2v = Wav2Vec2Detector()
                for i, (c_arr, _) in enumerate(chunks):
                    if chunk_qualities[i].usable_for_voice_analysis:
                        res = w2v.predict_waveform(c_arr, sr)
                        chunk_evidence_records[i]["wav2vec2"] = adapt_wav2vec2_evidence(res)
                    else:
                        chunk_evidence_records[i]["wav2vec2"] = None
                del w2v
                gc.collect()
            except Exception as e:
                for i in range(len(chunks)):
                    chunk_evidence_records[i]["wav2vec2"] = None

        # --- Stream 2: DF Arena 500M ---
        if not self._is_ablated("df_arena"):
            try:
                from app.services.df_arena_service import DFArenaDetector
                df_det = DFArenaDetector()
                df_det.load()
                for i, (c_arr, _) in enumerate(chunks):
                    if chunk_qualities[i].usable_for_voice_analysis:
                        res = df_det.predict_waveform(c_arr)
                        chunk_evidence_records[i]["df_arena"] = adapt_df_arena_evidence(res)
                    else:
                        chunk_evidence_records[i]["df_arena"] = None
                df_det.unload()
                del df_det
                gc.collect()
            except Exception as e:
                for i in range(len(chunks)):
                    chunk_evidence_records[i]["df_arena"] = None

        # --- Stream 3: Spectrogram Analysis ---
        if not self._is_ablated("spectrogram"):
            try:
                from app.services.spectrogram_service import SpectrogramService
                spec_svc = SpectrogramService()
                for i, (c_arr, _) in enumerate(chunks):
                    if chunk_qualities[i].usable_for_voice_analysis:
                        res = spec_svc.extract_features(c_arr, sr)
                        chunk_evidence_records[i]["spectrogram"] = adapt_spectrogram_evidence(res)
                    else:
                        chunk_evidence_records[i]["spectrogram"] = None
                del spec_svc
                gc.collect()
            except Exception as e:
                for i in range(len(chunks)):
                    chunk_evidence_records[i]["spectrogram"] = None

        # --- Stream 4: Prosody / F0 Analysis ---
        if not self._is_ablated("prosody"):
            try:
                from app.services.prosody_service import ProsodyService
                prosody_svc = ProsodyService()
                for i, (c_arr, _) in enumerate(chunks):
                    if chunk_qualities[i].usable_for_voice_analysis:
                        res = prosody_svc.analyze_waveform(c_arr, sr)
                        chunk_evidence_records[i]["prosody"] = adapt_prosody_evidence(res)
                    else:
                        chunk_evidence_records[i]["prosody"] = None
                del prosody_svc
                gc.collect()
            except Exception as e:
                for i in range(len(chunks)):
                    chunk_evidence_records[i]["prosody"] = None

        # --- Stream 5: Whisper Tiny Representation ---
        if not self._is_ablated("whisper_representation") and not self._is_ablated("whisper"):
            try:
                from app.services.whisper_rep_service import WhisperRepService
                whisper_svc = WhisperRepService()
                whisper_svc.load()
                for i, (c_arr, _) in enumerate(chunks):
                    if chunk_qualities[i].usable_for_voice_analysis:
                        res = whisper_svc.extract_waveform(c_arr, sr)
                        chunk_evidence_records[i]["whisper_representation"] = res["evidence_record"]
                    else:
                        chunk_evidence_records[i]["whisper_representation"] = None
                whisper_svc.unload()
                del whisper_svc
                gc.collect()
            except Exception as e:
                for i in range(len(chunks)):
                    chunk_evidence_records[i]["whisper_representation"] = None

        result = self._fuse_chunk_records(
            chunk_evidence_records=chunk_evidence_records,
            chunk_qualities=chunk_qualities,
            overall_quality=overall_quality,
            chunks=chunks,
        )
        result["_internal_cache"] = {
            "chunk_evidence_records": chunk_evidence_records,
            "chunk_qualities": chunk_qualities,
            "overall_quality": overall_quality,
            "chunks": [(None, c_meta) for _, c_meta in chunks],
        }
        return result

    def fuse_from_cache(self, cache: Dict[str, Any]) -> Dict[str, Any]:
        """Fast fusion from precomputed chunk evidence records, supporting instant ablation evaluation."""
        chunk_evidence_records = cache["chunk_evidence_records"]
        chunk_qualities = cache["chunk_qualities"]
        overall_quality = cache["overall_quality"]
        chunks = cache["chunks"]

        filtered_records = []
        for rec_dict in chunk_evidence_records:
            filtered = {}
            for mod_name, rec in rec_dict.items():
                if self._is_ablated(mod_name):
                    filtered[mod_name] = None
                else:
                    filtered[mod_name] = rec
            filtered_records.append(filtered)

        return self._fuse_chunk_records(filtered_records, chunk_qualities, overall_quality, chunks)

    def _fuse_chunk_records(
        self,
        chunk_evidence_records: List[Dict[str, Any]],
        chunk_qualities: List[AudioQualityReport],
        overall_quality: AudioQualityReport,
        chunks: List[Any],
    ) -> Dict[str, Any]:
        """Fuse pre-extracted chunk evidence records and compute master decision."""
        chunk_scores: List[float] = []
        chunk_details: List[Dict[str, Any]] = []
        all_normalized_modules_acc: Dict[str, List[NormalizedEvidence]] = {}

        for i, chunk_item in enumerate(chunks):
            c_meta = chunk_item[1] if isinstance(chunk_item, tuple) else chunk_item
            c_qual = chunk_qualities[i]
            records = chunk_evidence_records[i]

            norm_ev_list = self.normalizer.normalize_and_gate_records(records, c_qual)

            for item in norm_ev_list:
                all_normalized_modules_acc.setdefault(item.module, []).append(item)

            chunk_score = float(sum(item.contribution for item in norm_ev_list))
            chunk_scores.append(chunk_score)

            c_conflict = self._calculate_conflict(norm_ev_list)

            chunk_details.append({
                "chunk_index": getattr(c_meta, "chunk_index", i),
                "start_sec": getattr(c_meta, "start_sec", 0.0),
                "end_sec": getattr(c_meta, "end_sec", 0.0),
                "duration_sec": getattr(c_meta, "duration_sec", 0.0),
                "fusion_score": round(chunk_score, 4),
                "quality_score": round(c_qual.quality_score, 4),
                "quality_flags": c_qual.quality_flags,
                "conflict_level": c_conflict,
                "active_modules_count": sum(1 for item in norm_ev_list if item.status in ("USED", "DOWNWEIGHTED")),
            })

        # 5. Temporal Aggregation Across Chunks
        raw_mean = float(np.mean(chunk_scores))
        median_score = float(np.median(chunk_scores))
        trimmed_mean_score = self._compute_trimmed_mean(chunk_scores)
        score_variance = float(np.var(chunk_scores))
        score_iqr = float(np.percentile(chunk_scores, 75) - np.percentile(chunk_scores, 25)) if len(chunk_scores) > 1 else 0.0

        ai_chunks = sum(1 for s in chunk_scores if s >= self.config.synthetic_threshold)
        human_chunks = sum(1 for s in chunk_scores if s <= self.config.human_threshold)
        uncertain_chunks = len(chunk_scores) - (ai_chunks + human_chunks)

        ai_fraction = round(ai_chunks / max(1, len(chunk_scores)), 4)
        human_fraction = round(human_chunks / max(1, len(chunk_scores)), 4)
        uncertain_fraction = round(uncertain_chunks / max(1, len(chunk_scores)), 4)

        aggregate_evidence_score = float(np.clip(trimmed_mean_score, -1.0, 1.0))

        # 6. Global Module Summaries (averaged across chunks)
        aggregated_modules: List[Dict[str, Any]] = []
        for mod_name, items in all_normalized_modules_acc.items():
            used_items = [it for it in items if it.status in ("USED", "DOWNWEIGHTED")]
            avg_raw = np.mean([it.raw_score for it in used_items if it.raw_score is not None]) if any(it.raw_score is not None for it in used_items) else None
            avg_norm = float(np.mean([it.normalized_score for it in items]))
            avg_conf_w = items[0].configured_weight if items else 0.0
            avg_qual_w = float(np.mean([it.quality_weight for it in items]))
            avg_eff_w = float(np.mean([it.effective_weight for it in items]))
            avg_contrib = float(np.mean([it.contribution for it in items]))
            primary_status = items[0].status if all(it.status == items[0].status for it in items) else "MIXED"
            primary_reason = items[0].reason

            aggregated_modules.append({
                "module": mod_name,
                "evidence_type": items[0].evidence_type,
                "raw_score": round(float(avg_raw), 4) if avg_raw is not None else None,
                "normalized_score": round(avg_norm, 4),
                "configured_weight": round(avg_conf_w, 4),
                "quality_weight": round(avg_qual_w, 4),
                "effective_weight": round(avg_eff_w, 4),
                "contribution": round(avg_contrib, 4),
                "status": primary_status,
                "reason": primary_reason,
                "calibration_status": items[0].calibration_status,
            })

        # 7. Global Conflict Assessment
        global_conflict = self._calculate_global_conflict(aggregated_modules)

        # 8. Uncertainty Computation
        uncertainty_score = self._compute_uncertainty(
            aggregate_score=aggregate_evidence_score,
            conflict_level=global_conflict,
            quality_score=overall_quality.quality_score,
            aggregated_modules=aggregated_modules,
            chunk_scores=chunk_scores,
        )

        # 9. Synthetic and Human Evidence Proportions [0.0, 1.0]
        synthetic_evidence_score = round(float(np.clip((aggregate_evidence_score + 1.0) / 2.0, 0.0, 1.0)), 4)
        human_evidence_score = round(float(1.0 - synthetic_evidence_score), 4)

        # 10. Master Decision Gate
        if (
            uncertainty_score >= self.config.max_uncertainty_threshold
            or global_conflict == "HIGH"
            or overall_quality.quality_score < self.config.min_quality_threshold
            or abs(aggregate_evidence_score) < abs(self.config.synthetic_threshold)
        ):
            decision = "UNCERTAIN"
        elif aggregate_evidence_score >= self.config.synthetic_threshold:
            decision = "AI_GENERATED"
        elif aggregate_evidence_score <= self.config.human_threshold:
            decision = "HUMAN"
        else:
            decision = "UNCERTAIN"

        decision_strength = round(float(abs(aggregate_evidence_score) * (1.0 - uncertainty_score)), 4)

        return {
            "decision": decision,
            "decision_strength": decision_strength,
            "confidence_status": "PROVISIONAL",
            "quality": overall_quality.to_dict(),
            "fusion": {
                "synthetic_evidence_score": synthetic_evidence_score,
                "human_evidence_score": human_evidence_score,
                "uncertainty_score": round(float(uncertainty_score), 4),
                "conflict_level": global_conflict,
                "aggregation_method": "trimmed_mean",
                "raw_aggregate_score": round(aggregate_evidence_score, 4),
                "mean_chunk_score": round(raw_mean, 4),
                "median_chunk_score": round(median_score, 4),
                "score_variance": round(score_variance, 4),
                "score_iqr": round(score_iqr, 4),
            },
            "modules": aggregated_modules,
            "chunks": {
                "count": len(chunks),
                "ai_fraction": ai_fraction,
                "human_fraction": human_fraction,
                "uncertain_fraction": uncertain_fraction,
                "chunk_details": chunk_details,
            },
        }

    def analyze_file(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """Load an audio file and execute full multi-evidence fusion."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file does not exist: {path}")

        y, sr = sf.read(str(path), dtype="float32")
        return self.analyze_waveform(y, sr)

    def _compute_trimmed_mean(self, scores: List[float], trim_ratio: float = 0.10) -> float:
        """Compute trimmed mean to prevent single-chunk artifact dominance."""
        if len(scores) <= 2:
            return float(np.mean(scores))
        sorted_scores = sorted(scores)
        n_trim = max(1, int(len(scores) * trim_ratio)) if len(scores) >= 5 else 0
        if n_trim > 0 and 2 * n_trim < len(scores):
            trimmed = sorted_scores[n_trim : -n_trim]
            return float(np.mean(trimmed))
        return float(np.mean(sorted_scores))

    def _calculate_conflict(self, normalized_ev_list: List[NormalizedEvidence]) -> str:
        """Measure directional disagreement between active modules within a chunk."""
        active = [it for it in normalized_ev_list if it.status in ("USED", "DOWNWEIGHTED")]
        if len(active) < 2:
            return "LOW"

        pos_scores = [it.normalized_score for it in active if it.normalized_score > 0.30]
        neg_scores = [it.normalized_score for it in active if it.normalized_score < -0.30]

        if pos_scores and neg_scores:
            max_pos = max(pos_scores)
            min_neg = min(neg_scores)
            if max_pos >= 0.50 and min_neg <= -0.50:
                return "HIGH"
            if (max_pos - min_neg) >= 0.70:
                return "MEDIUM"

        return "LOW"

    def _calculate_global_conflict(self, module_summaries: List[Dict[str, Any]]) -> str:
        """Measure directional disagreement across all active modules globally."""
        active = [m for m in module_summaries if m["status"] in ("USED", "DOWNWEIGHTED", "MIXED")]
        if len(active) < 2:
            return "LOW"

        # Check primary classifiers (Wav2Vec2 vs DF Arena)
        w2v = next((m for m in active if m["module"] == "wav2vec2"), None)
        df_arena = next((m for m in active if m["module"] == "df_arena"), None)

        if w2v and df_arena:
            # If one says strongly human (<= -0.4) and other says strongly synthetic (>= 0.4)
            if (w2v["normalized_score"] <= -0.40 and df_arena["normalized_score"] >= 0.40) or (
                w2v["normalized_score"] >= 0.40 and df_arena["normalized_score"] <= -0.40
            ):
                return "HIGH"

        # General score range check
        scores = [m["normalized_score"] for m in active]
        spread = max(scores) - min(scores)
        if spread > 1.2:
            return "HIGH"
        elif spread > 0.75:
            return "MEDIUM"

        return "LOW"

    def _compute_uncertainty(
        self,
        aggregate_score: float,
        conflict_level: str,
        quality_score: float,
        aggregated_modules: List[Dict[str, Any]],
        chunk_scores: List[float],
    ) -> float:
        """Compute composite uncertainty score [0.0, 1.0]."""
        # 1. Base uncertainty from distance to decision boundary
        base_u = 1.0 - abs(aggregate_score)

        # 2. Conflict penalty
        conflict_penalty = 0.0
        if conflict_level == "HIGH":
            conflict_penalty = 0.35
        elif conflict_level == "MEDIUM":
            conflict_penalty = 0.15

        # 3. Quality penalty
        quality_penalty = 0.0
        if quality_score < 0.60:
            quality_penalty = (0.60 - quality_score) * 0.50

        # 4. Usable weight penalty (if modules were ablated or rejected)
        total_usable_w = sum(m["configured_weight"] for m in aggregated_modules if m["status"] in ("USED", "DOWNWEIGHTED", "MIXED"))
        weight_penalty = max(0.0, (0.70 - total_usable_w) * 0.40)

        # 5. Chunk variance penalty
        variance_penalty = float(min(0.20, np.var(chunk_scores) * 0.5)) if len(chunk_scores) > 1 else 0.0

        total_u = base_u * 0.5 + conflict_penalty + quality_penalty + weight_penalty + variance_penalty
        return float(np.clip(total_u, 0.0, 1.0))

    def _build_unusable_result(self, quality: AudioQualityReport, duration_sec: float) -> Dict[str, Any]:
        """Generate guaranteed safe result object when audio quality rejects analysis."""
        return {
            "decision": "UNCERTAIN",
            "decision_strength": 0.0,
            "confidence_status": "PROVISIONAL",
            "quality": quality.to_dict(),
            "fusion": {
                "synthetic_evidence_score": 0.50,
                "human_evidence_score": 0.50,
                "uncertainty_score": 1.0,
                "conflict_level": "LOW",
                "aggregation_method": "none",
                "raw_aggregate_score": 0.0,
                "mean_chunk_score": 0.0,
                "median_chunk_score": 0.0,
                "score_variance": 0.0,
                "score_iqr": 0.0,
            },
            "modules": [
                {
                    "module": mod_name,
                    "evidence_type": "unknown",
                    "raw_score": None,
                    "normalized_score": 0.0,
                    "configured_weight": conf_w,
                    "quality_weight": 0.0,
                    "effective_weight": 0.0,
                    "contribution": 0.0,
                    "status": "REJECTED",
                    "reason": "Audio quality unusable for voice analysis (silence, extreme clipping, or corruption)",
                    "calibration_status": "not_applicable",
                }
                for mod_name, conf_w in EvidenceNormalizer.DEFAULT_WEIGHTS.items()
            ],
            "chunks": {
                "count": 0,
                "ai_fraction": 0.0,
                "human_fraction": 0.0,
                "uncertain_fraction": 1.0,
                "chunk_details": [],
            },
        }
