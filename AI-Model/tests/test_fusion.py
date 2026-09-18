# Audio DeepCheck - Milestone 7 Multi-Evidence Fusion Test Suite
import pytest
import numpy as np
from pathlib import Path

from app.services.quality_service import QualityService, AudioQualityReport
from app.services.calibration_service import (
    IdentityCalibrator,
    TemperatureScaler,
    PlattCalibrator,
    CalibrationRegistry,
)
from app.services.evidence_contract import (
    EvidenceRecord,
    EvidenceType,
    ScoreDirection,
    CalibrationStatus,
)
from app.services.evidence_normalizer import EvidenceNormalizer, NormalizedEvidence
from app.services.fusion_service import FusionService, FusionConfig

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "data" / "samples"
HUMAN_SAMPLE = SAMPLE_DIR / "human_voice.wav"
AI_SAMPLE = SAMPLE_DIR / "ai_voice.wav"


class TestQualityService:
    """Tests for signal-level quality estimation and diagnostic flags."""

    def test_quality_pristine_sine_wave(self):
        qs = QualityService()
        sr = 16000
        t = np.linspace(0, 2.0, 2 * sr, endpoint=False)
        # Clean 440 Hz tone with harmonics
        y = 0.5 * np.sin(2 * np.pi * 440 * t) + 0.2 * np.sin(2 * np.pi * 880 * t)
        report = qs.assess_waveform(y.astype(np.float32), sr)

        assert report.usable_for_voice_analysis is True
        assert report.quality_score >= 0.70
        assert "HEAVY_CLIPPING" not in report.quality_flags
        assert "EXCESSIVE_SILENCE" not in report.quality_flags

    def test_quality_clipping_detection(self):
        qs = QualityService()
        sr = 16000
        t = np.linspace(0, 2.0, 2 * sr, endpoint=False)
        # Severely clipped waveform
        y = np.clip(1.5 * np.sin(2 * np.pi * 300 * t), -1.0, 1.0)
        report = qs.assess_waveform(y.astype(np.float32), sr)

        assert "HEAVY_CLIPPING" in report.quality_flags
        assert report.metrics["clipping_ratio"] > 0.05
        assert report.quality_score < 0.85

    def test_quality_pure_silence_rejection(self):
        qs = QualityService()
        sr = 16000
        y = np.zeros(sr * 2, dtype=np.float32)
        report = qs.assess_waveform(y, sr)

        assert report.usable_for_voice_analysis is False
        assert report.quality_score == 0.0
        assert "EXCESSIVE_SILENCE" in report.quality_flags

    def test_quality_short_audio_flag(self):
        qs = QualityService(min_duration_sec=1.0)
        sr = 16000
        y = 0.3 * np.random.randn(int(0.5 * sr)).astype(np.float32)
        report = qs.assess_waveform(y, sr)

        assert "LOW_DURATION" in report.quality_flags


class TestCalibrationService:
    """Tests for score calibration abstraction layer."""

    def test_identity_calibrator_status(self):
        cal = IdentityCalibrator()
        score, status = cal.calibrate(0.85, "wav2vec2")
        assert score == 0.85
        assert status == CalibrationStatus.NOT_CALIBRATED

    def test_temperature_scaler(self):
        scaler = TemperatureScaler(temperature=2.0, is_fitted=True)
        score, status = scaler.calibrate(0.90, "wav2vec2")
        # Temperature > 1 softens overconfident scores
        assert 0.50 < score < 0.90
        assert status == CalibrationStatus.CALIBRATED_PLATT

    def test_platt_calibrator(self):
        cal = PlattCalibrator(a=-2.0, b=1.0, is_fitted=True)
        score, status = cal.calibrate(0.5, "df_arena")
        assert 0.0 <= score <= 1.0
        assert status == CalibrationStatus.CALIBRATED_PLATT

    def test_calibration_registry(self):
        reg = CalibrationRegistry()
        reg.register("wav2vec2", TemperatureScaler(temperature=1.5, is_fitted=False))
        cal = reg.get("wav2vec2")
        assert isinstance(cal, TemperatureScaler)
        # Unknown module falls back to IdentityCalibrator
        fallback = reg.get("unknown_mod")
        assert isinstance(fallback, IdentityCalibrator)


class TestEvidenceNormalizer:
    """Tests for signed evidence mapping [-1.0, 1.0] and quality gating."""

    def test_classifier_signed_mapping(self):
        norm = EvidenceNormalizer()
        qr = AudioQualityReport(
            quality_score=1.0,
            quality_flags=[],
            metrics={"duration_sec": 5.0},
            usable_for_voice_analysis=True,
        )

        record_fake = EvidenceRecord(
            module="wav2vec2",
            evidence_type=EvidenceType.CLASSIFIER,
            raw_output={},
            synthetic_score=0.90,
        )
        record_real = EvidenceRecord(
            module="df_arena",
            evidence_type=EvidenceType.CLASSIFIER,
            raw_output={},
            synthetic_score=0.10,
        )

        results = norm.normalize_and_gate_records(
            {"wav2vec2": record_fake, "df_arena": record_real}, qr
        )

        w2v_item = next(it for it in results if it.module == "wav2vec2")
        df_item = next(it for it in results if it.module == "df_arena")

        # 0.90 -> 2*0.9 - 1.0 = +0.80
        assert pytest.approx(w2v_item.normalized_score, rel=1e-2) == 0.80
        # 0.10 -> 2*0.1 - 1.0 = -0.80
        assert pytest.approx(df_item.normalized_score, rel=1e-2) == -0.80

    def test_effective_weights_sum_to_one(self):
        norm = EvidenceNormalizer()
        qr = AudioQualityReport(
            quality_score=1.0,
            quality_flags=[],
            metrics={"duration_sec": 5.0},
            usable_for_voice_analysis=True,
        )

        records = {
            "wav2vec2": EvidenceRecord("wav2vec2", EvidenceType.CLASSIFIER, {}, synthetic_score=0.8),
            "df_arena": EvidenceRecord("df_arena", EvidenceType.CLASSIFIER, {}, synthetic_score=0.8),
            "prosody": EvidenceRecord("prosody", EvidenceType.PROSODY, {}, quality_metadata={"usable_for_pitch_features": True}, metadata={"f0_std_hz": 20.0}),
            "spectrogram": EvidenceRecord("spectrogram", EvidenceType.SPECTRAL, {}, metadata={"spectral_rolloff_95_hz": 5000.0}),
            "whisper_representation": EvidenceRecord("whisper_representation", EvidenceType.EMBEDDING, {}, metadata={"temporal_representation_flux": 14.5}),
        }

        results = norm.normalize_and_gate_records(records, qr)
        active_weights = [it.effective_weight for it in results if it.status in ("USED", "DOWNWEIGHTED")]
        assert pytest.approx(sum(active_weights), abs=1e-3) == 1.00

    def test_rejection_on_silent_quality(self):
        norm = EvidenceNormalizer()
        silent_qr = AudioQualityReport(
            quality_score=0.0,
            quality_flags=["EXCESSIVE_SILENCE"],
            metrics={"duration_sec": 5.0},
            usable_for_voice_analysis=False,
        )
        records = {
            "wav2vec2": EvidenceRecord("wav2vec2", EvidenceType.CLASSIFIER, {}, synthetic_score=0.9),
        }
        results = norm.normalize_and_gate_records(records, silent_qr)
        assert results[0].status == "REJECTED"
        assert results[0].effective_weight == 0.0

    def test_feature_evidence_bounded(self):
        norm = EvidenceNormalizer()
        qr = AudioQualityReport(quality_score=1.0, quality_flags=[], metrics={}, usable_for_voice_analysis=True)

        # Extremely low pitch variation
        rec_prosody = EvidenceRecord("prosody", EvidenceType.PROSODY, {}, quality_metadata={"usable_for_pitch_features": True}, metadata={"f0_std_hz": 2.0, "f0_cov": 0.01})
        res = norm.normalize_and_gate_records({"prosody": rec_prosody}, qr)
        p_item = next(it for it in res if it.module == "prosody")
        # Should be positive (synthetic indication) but bounded <= 0.25
        assert 0.0 < p_item.normalized_score <= 0.25


class TestFusionService:
    """Tests for Master Decision Fusion logic, chunking, and edge cases."""

    def test_pure_silence_forced_uncertain(self):
        service = FusionService()
        sr = 16000
        silence = np.zeros(sr * 3, dtype=np.float32)
        res = service.analyze_waveform(silence, sr)

        assert res["decision"] == "UNCERTAIN"
        assert res["decision_strength"] == 0.0
        assert res["confidence_status"] == "PROVISIONAL"
        assert res["quality"]["usable_for_voice_analysis"] is False
        assert res["fusion"]["conflict_level"] == "LOW"

    def test_high_conflict_resolution(self):
        """When major classifiers violently disagree, system MUST declare UNCERTAIN."""
        service = FusionService()
        # Mock module summaries with violently disagreeing classifiers
        module_summaries = [
            {"module": "wav2vec2", "status": "USED", "normalized_score": -0.80, "configured_weight": 0.35},
            {"module": "df_arena", "status": "USED", "normalized_score": 0.90, "configured_weight": 0.35},
            {"module": "spectrogram", "status": "USED", "normalized_score": 0.0, "configured_weight": 0.10},
        ]
        conflict = service._calculate_global_conflict(module_summaries)
        assert conflict == "HIGH"

        uncertainty = service._compute_uncertainty(
            aggregate_score=0.05,
            conflict_level=conflict,
            quality_score=0.9,
            aggregated_modules=module_summaries,
            chunk_scores=[0.05],
        )
        assert uncertainty >= 0.50

    def test_trimmed_mean_protects_against_outliers(self):
        service = FusionService()
        # 5 chunks: 4 clean human chunks (-0.7), 1 corrupted synthetic spike (+0.9)
        chunk_scores = [-0.70, -0.72, -0.68, -0.71, 0.90]
        trimmed = service._compute_trimmed_mean(chunk_scores, trim_ratio=0.10)
        # Trimmed mean removes the single spike
        assert trimmed < -0.65

    def test_ablation_handling(self):
        config = FusionConfig(ablate_modules=["wav2vec2"])
        service = FusionService(config=config)
        assert service._is_ablated("wav2vec2") is True
        assert service._is_ablated("df_arena") is False

    def test_schema_conformance(self):
        service = FusionService()
        # Use dummy 2.0s sine wave for schema test
        sr = 16000
        t = np.linspace(0, 2.0, 2 * sr, endpoint=False)
        y = (0.5 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
        res = service.analyze_waveform(y, sr)

        required_keys = ["decision", "decision_strength", "confidence_status", "quality", "fusion", "modules", "chunks"]
        for k in required_keys:
            assert k in res

        assert res["decision"] in ("HUMAN", "AI_GENERATED", "UNCERTAIN")
        assert 0.0 <= res["decision_strength"] <= 1.0
        assert res["confidence_status"] == "PROVISIONAL"
        assert "synthetic_evidence_score" in res["fusion"]
        assert "human_evidence_score" in res["fusion"]
        assert "conflict_level" in res["fusion"]
        assert "ai_fraction" in res["chunks"]
        assert "human_fraction" in res["chunks"]

    @pytest.mark.skipif(not HUMAN_SAMPLE.exists(), reason="Human sample file missing")
    def test_end_to_end_on_human_sample(self):
        service = FusionService()
        res = service.analyze_file(HUMAN_SAMPLE)

        assert res["decision"] in ("HUMAN", "AI_GENERATED", "UNCERTAIN")
        assert res["confidence_status"] == "PROVISIONAL"
        assert len(res["chunks"]["chunk_details"]) >= 1
        assert res["quality"]["score"] > 0.40

    @pytest.mark.skipif(not AI_SAMPLE.exists(), reason="AI sample file missing")
    def test_end_to_end_on_ai_sample(self):
        service = FusionService()
        res = service.analyze_file(AI_SAMPLE)

        assert res["decision"] in ("HUMAN", "AI_GENERATED", "UNCERTAIN")
        assert res["confidence_status"] == "PROVISIONAL"
        assert len(res["chunks"]["chunk_details"]) >= 1
        assert res["quality"]["score"] > 0.40
