# Audio DeepCheck - Evidence Normalization & Quality Gating
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np

from app.services.evidence_contract import (
    EvidenceRecord,
    EvidenceType,
    ScoreDirection,
    CalibrationStatus,
)
from app.services.quality_service import AudioQualityReport
from app.services.calibration_service import CalibrationRegistry


@dataclass
class NormalizedEvidence:
    """
    Standardized normalized evidence record mapped onto the signed internal evidence scale.
    Scale:
        -1.0: Strong evidence for human voice
         0.0: Neutral, uninformative, unavailable, or rejected
        +1.0: Strong evidence for synthetic / AI-generated voice
    """
    module: str
    evidence_type: str
    raw_score: Optional[float]
    normalized_score: float             # In [-1.0, 1.0]
    configured_weight: float            # Baseline configured weight
    quality_weight: float               # Gating factor in [0.0, 1.0]
    effective_weight: float             # Post-gating normalized weight summing to 1.0 across active modules
    contribution: float                 # normalized_score * effective_weight
    status: str                         # "USED", "DOWNWEIGHTED", "UNAVAILABLE", "REJECTED"
    reason: str                         # Explanation of gating decision
    calibration_status: str             # "not_calibrated", "calibrated", etc.
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "module": self.module,
            "evidence_type": self.evidence_type,
            "raw_score": round(float(self.raw_score), 4) if self.raw_score is not None else None,
            "normalized_score": round(float(self.normalized_score), 4),
            "configured_weight": round(float(self.configured_weight), 4),
            "quality_weight": round(float(self.quality_weight), 4),
            "effective_weight": round(float(self.effective_weight), 4),
            "contribution": round(float(self.contribution), 4),
            "status": self.status,
            "reason": self.reason,
            "calibration_status": self.calibration_status,
            "metadata": self.metadata,
        }


def _extract_record_fields(
    record: Union[EvidenceRecord, Dict[str, Any]]
) -> Tuple[str, str, Optional[float], Dict[str, Any], Dict[str, Any]]:
    """Extract standard evidence attributes from either an EvidenceRecord or dict."""
    if isinstance(record, EvidenceRecord):
        return (
            str(record.evidence_type.value if hasattr(record.evidence_type, "value") else record.evidence_type),
            str(record.calibration_status.value if hasattr(record.calibration_status, "value") else record.calibration_status),
            float(record.synthetic_score) if record.synthetic_score is not None else None,
            record.metadata or {},
            record.quality_metadata or {},
        )
    elif isinstance(record, dict):
        ev_type = record.get("evidence_type", "unknown")
        if hasattr(ev_type, "value"):
            ev_type = ev_type.value
        cal_status = record.get("calibration_status", CalibrationStatus.NOT_CALIBRATED)
        if hasattr(cal_status, "value"):
            cal_status = cal_status.value
        score = record.get("synthetic_score")
        return (
            str(ev_type),
            str(cal_status),
            float(score) if score is not None else None,
            record.get("metadata") or {},
            record.get("quality_metadata") or {},
        )
    return ("unknown", CalibrationStatus.NOT_CALIBRATED, None, {}, {})


class EvidenceNormalizer:
    """
    Normalizes disparate raw module evidence onto the unified signed evidence scale [-1.0, +1.0]
    and applies objective quality gating based on signal diagnostics.
    """

    DEFAULT_WEIGHTS = {
        "wav2vec2": 0.35,
        "df_arena": 0.35,
        "spectrogram": 0.10,
        "prosody": 0.10,
        "whisper_representation": 0.10,
    }

    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        calibration_registry: Optional[CalibrationRegistry] = None,
    ):
        self.weights = dict(self.DEFAULT_WEIGHTS)
        if weights:
            self.weights.update(weights)
        self.calibrators = calibration_registry or CalibrationRegistry()

    def normalize_and_gate_records(
        self,
        records: Dict[str, Optional[Union[EvidenceRecord, Dict[str, Any]]]],
        quality_report: AudioQualityReport,
    ) -> List[NormalizedEvidence]:
        """
        Normalize and gate a dictionary of module EvidenceRecords for a single audio chunk/file.
        """
        pre_gated: List[Dict[str, Any]] = []

        # 1. Process each known module
        for mod_name, conf_w in self.weights.items():
            record = records.get(mod_name)
            norm_res = self._process_module(mod_name, record, conf_w, quality_report)
            pre_gated.append(norm_res)

        # 2. Normalize effective weights across active, non-rejected modules
        total_active_w = sum(
            item["configured_weight"] * item["quality_weight"]
            for item in pre_gated
            if item["status"] in ("USED", "DOWNWEIGHTED")
        )

        results: List[NormalizedEvidence] = []
        for item in pre_gated:
            raw_effective_w = item["configured_weight"] * item["quality_weight"]
            if total_active_w > 0 and item["status"] in ("USED", "DOWNWEIGHTED"):
                final_effective_w = raw_effective_w / total_active_w
            else:
                final_effective_w = 0.0

            norm_score = item["normalized_score"]
            contribution = norm_score * final_effective_w

            results.append(
                NormalizedEvidence(
                    module=item["module"],
                    evidence_type=item["evidence_type"],
                    raw_score=item["raw_score"],
                    normalized_score=round(float(norm_score), 4),
                    configured_weight=round(float(item["configured_weight"]), 4),
                    quality_weight=round(float(item["quality_weight"]), 4),
                    effective_weight=round(float(final_effective_w), 4),
                    contribution=round(float(contribution), 4),
                    status=item["status"],
                    reason=item["reason"],
                    calibration_status=item["calibration_status"],
                    metadata=item.get("metadata", {}),
                )
            )

        return results

    def _process_module(
        self,
        module_name: str,
        record: Optional[Union[EvidenceRecord, Dict[str, Any]]],
        conf_weight: float,
        quality: AudioQualityReport,
    ) -> Dict[str, Any]:
        """Normalize an individual module's evidence and determine its quality gating status."""
        # Case 1: Module unavailable / missing
        if record is None:
            return {
                "module": module_name,
                "evidence_type": "unknown",
                "raw_score": None,
                "normalized_score": 0.0,
                "configured_weight": conf_weight,
                "quality_weight": 0.0,
                "status": "UNAVAILABLE",
                "reason": "Module did not run, returned None, or was ablated",
                "calibration_status": CalibrationStatus.NOT_APPLICABLE,
                "metadata": {},
            }

        ev_type, cal_status, raw_score, meta, qual_meta = _extract_record_fields(record)

        # Case 2: Signal not usable for voice analysis
        if not quality.usable_for_voice_analysis:
            return {
                "module": module_name,
                "evidence_type": ev_type,
                "raw_score": raw_score,
                "normalized_score": 0.0,
                "configured_weight": conf_weight,
                "quality_weight": 0.0,
                "status": "REJECTED",
                "reason": "Audio quality unusable for voice analysis (silence, extreme clipping, or corruption)",
                "calibration_status": cal_status,
                "metadata": meta,
            }

        # Case 3: Classifiers (Wav2Vec2, DF Arena)
        if ev_type in (EvidenceType.CLASSIFIER, "classifier"):
            return self._normalize_classifier(module_name, ev_type, cal_status, raw_score, meta, conf_weight, quality)

        # Case 4: Prosody features
        if ev_type in (EvidenceType.PROSODY, "prosody"):
            return self._normalize_prosody(module_name, ev_type, cal_status, meta, qual_meta, conf_weight, quality)

        # Case 5: Spectrogram features
        if ev_type in (EvidenceType.SPECTRAL, "spectral"):
            return self._normalize_spectrogram(module_name, ev_type, cal_status, meta, conf_weight, quality)

        # Case 6: Whisper representations
        if ev_type in (EvidenceType.EMBEDDING, "embedding"):
            return self._normalize_whisper_rep(module_name, ev_type, cal_status, meta, qual_meta, conf_weight, quality)

        # Fallback default
        return {
            "module": module_name,
            "evidence_type": ev_type,
            "raw_score": raw_score,
            "normalized_score": 0.0,
            "configured_weight": conf_weight,
            "quality_weight": 0.0,
            "status": "REJECTED",
            "reason": f"Unknown evidence type: {ev_type}",
            "calibration_status": cal_status,
            "metadata": meta,
        }

    def _normalize_classifier(
        self,
        module_name: str,
        ev_type: str,
        cal_status: str,
        raw_score: Optional[float],
        meta: Dict[str, Any],
        conf_weight: float,
        quality: AudioQualityReport,
    ) -> Dict[str, Any]:
        if raw_score is None:
            return {
                "module": module_name,
                "evidence_type": ev_type,
                "raw_score": None,
                "normalized_score": 0.0,
                "configured_weight": conf_weight,
                "quality_weight": 0.0,
                "status": "UNAVAILABLE",
                "reason": "Classifier record missing synthetic_score",
                "calibration_status": cal_status,
                "metadata": meta,
            }

        # Calibrate raw score through registry
        cal_score, cal_status = self.calibrators.calibrate(raw_score, module=module_name)

        # Linear mapping from [0.0, 1.0] -> [-1.0, +1.0]
        norm_score = float(np.clip(2.0 * cal_score - 1.0, -1.0, 1.0))

        # Quality gating
        q_weight = 1.0
        status = "USED"
        reasons = []

        if "HEAVY_CLIPPING" in quality.quality_flags:
            q_weight *= 0.5
            status = "DOWNWEIGHTED"
            reasons.append("Heavy clipping induces digital distortion in acoustic model")

        if "HIGH_NOISE" in quality.quality_flags or "LOW_SNR" in quality.quality_flags:
            q_weight *= 0.6
            status = "DOWNWEIGHTED"
            reasons.append("High background noise degrades acoustic embeddings")

        if "NARROWBAND" in quality.quality_flags and module_name == "df_arena":
            q_weight *= 0.6
            status = "DOWNWEIGHTED"
            reasons.append("Narrowband telephony frequency response downweights DF Arena")

        if not reasons:
            reasons.append("Quality checks passed")

        return {
            "module": module_name,
            "evidence_type": ev_type,
            "raw_score": raw_score,
            "normalized_score": norm_score,
            "configured_weight": conf_weight,
            "quality_weight": q_weight,
            "status": status,
            "reason": "; ".join(reasons),
            "calibration_status": cal_status,
            "metadata": meta,
        }

    def _normalize_prosody(
        self,
        module_name: str,
        ev_type: str,
        cal_status: str,
        meta: Dict[str, Any],
        qual_meta: Dict[str, Any],
        conf_weight: float,
        quality: AudioQualityReport,
    ) -> Dict[str, Any]:
        usable = qual_meta.get("usable_for_pitch_features", False)

        if not usable or "EXCESSIVE_SILENCE" in quality.quality_flags or "LOW_VOICING" in quality.quality_flags:
            return {
                "module": module_name,
                "evidence_type": ev_type,
                "raw_score": None,
                "normalized_score": 0.0,
                "configured_weight": conf_weight,
                "quality_weight": 0.0,
                "status": "REJECTED",
                "reason": "Insufficient continuous voicing for pitch tracking",
                "calibration_status": CalibrationStatus.NOT_APPLICABLE,
                "metadata": meta,
            }

        # Pitch dynamics heuristic (bounded to [-0.25, +0.25])
        f0_std = meta.get("f0_std_hz")
        f0_cov = meta.get("f0_cov")

        norm_score = 0.0
        if f0_std is not None and f0_std > 0:
            if f0_std < 16.0:
                norm_score += 0.15 * min(1.0, (16.0 - f0_std) / 8.0)
            elif f0_std > 40.0:
                norm_score -= 0.15 * min(1.0, (f0_std - 40.0) / 40.0)

        if f0_cov is not None and f0_cov > 0:
            if f0_cov < 0.10:
                norm_score += 0.10 * min(1.0, (0.10 - f0_cov) / 0.05)
            elif f0_cov > 0.22:
                norm_score -= 0.10 * min(1.0, (f0_cov - 0.22) / 0.15)

        norm_score = float(np.clip(norm_score, -0.25, 0.25))

        q_weight = 1.0
        status = "USED"
        reasons = []

        if "LOW_SNR" in quality.quality_flags:
            q_weight *= 0.6
            status = "DOWNWEIGHTED"
            reasons.append("Low SNR reduces pitch tracking confidence")

        if not reasons:
            reasons.append("Voicing and pitch tracking confirmed valid")

        return {
            "module": module_name,
            "evidence_type": ev_type,
            "raw_score": None,
            "normalized_score": norm_score,
            "configured_weight": conf_weight,
            "quality_weight": q_weight,
            "status": status,
            "reason": "; ".join(reasons),
            "calibration_status": CalibrationStatus.NOT_APPLICABLE,
            "metadata": meta,
        }

    def _normalize_spectrogram(
        self,
        module_name: str,
        ev_type: str,
        cal_status: str,
        meta: Dict[str, Any],
        conf_weight: float,
        quality: AudioQualityReport,
    ) -> Dict[str, Any]:
        rolloff = meta.get("spectral_rolloff_95_hz") or meta.get("spectral_rolloff_85_hz")
        hp_ratio = meta.get("harmonic_percussive_ratio")

        norm_score = 0.0
        reasons = []
        q_weight = 1.0
        status = "USED"

        if "NARROWBAND" in quality.quality_flags:
            q_weight = 0.3
            status = "DOWNWEIGHTED"
            reasons.append("Narrowband audio truncates high spectral bands")
        else:
            if rolloff is not None and rolloff > 7200.0:
                norm_score -= 0.10
            elif rolloff is not None and rolloff < 3000.0:
                norm_score += 0.10

            if hp_ratio is not None and hp_ratio > 3.5:
                norm_score += 0.05

        norm_score = float(np.clip(norm_score, -0.20, 0.20))
        if not reasons:
            reasons.append("Spectral analysis completed across valid frequency bands")

        return {
            "module": module_name,
            "evidence_type": ev_type,
            "raw_score": None,
            "normalized_score": norm_score,
            "configured_weight": conf_weight,
            "quality_weight": q_weight,
            "status": status,
            "reason": "; ".join(reasons),
            "calibration_status": CalibrationStatus.NOT_APPLICABLE,
            "metadata": meta,
        }

    def _normalize_whisper_rep(
        self,
        module_name: str,
        ev_type: str,
        cal_status: str,
        meta: Dict[str, Any],
        qual_meta: Dict[str, Any],
        conf_weight: float,
        quality: AudioQualityReport,
    ) -> Dict[str, Any]:
        flux = meta.get("temporal_representation_flux") or meta.get("temporal_flux")
        dispersion = meta.get("representation_dispersion") or meta.get("dispersion")

        norm_score = 0.0
        reasons = []
        q_weight = 1.0
        status = "USED"

        if flux is not None and flux > 0:
            if flux < 13.0:
                norm_score += 0.15 * min(1.0, (13.0 - flux) / 3.0)
            elif flux > 16.0:
                norm_score -= 0.15 * min(1.0, (flux - 16.0) / 4.0)

        if dispersion is not None and dispersion > 0.70:
            norm_score -= 0.05

        norm_score = float(np.clip(norm_score, -0.25, 0.25))

        if "LOW_DURATION" in quality.quality_flags:
            q_weight *= 0.5
            status = "DOWNWEIGHTED"
            reasons.append("Short chunk length limits representation temporal stability")

        if not reasons:
            reasons.append("Whisper encoder hidden representation flux evaluated")

        return {
            "module": module_name,
            "evidence_type": ev_type,
            "raw_score": None,
            "normalized_score": norm_score,
            "configured_weight": conf_weight,
            "quality_weight": q_weight,
            "status": status,
            "reason": "; ".join(reasons),
            "calibration_status": CalibrationStatus.NOT_APPLICABLE,
            "metadata": meta,
        }
