# Audio DeepCheck - Specialist Models & Evidence Contract Tests
import json
import math
from pathlib import Path
import numpy as np
import pytest
import soundfile as sf

PROJECT_ROOT = Path(__file__).resolve().parent.parent

from app.services.evidence_contract import (
    EvidenceRecord,
    EvidenceType,
    CalibrationStatus,
    ScoreDirection,
    ProvenanceState,
    AudioChunk,
    create_audio_chunks,
    adapt_wav2vec2_evidence,
    adapt_df_arena_evidence,
    adapt_spectrogram_evidence,
    adapt_prosody_evidence,
)
from app.services.whisper_rep_service import WhisperRepService
from app.services.watermark_service import WatermarkService

SAMPLE_HUMAN = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
SAMPLE_AI = PROJECT_ROOT / "data" / "samples" / "ai_voice.wav"


class TestEvidenceContract:
    """Test standard EvidenceRecord container, serialization, and long-audio chunking."""

    def test_evidence_record_schema_and_serialization(self):
        """EvidenceRecord must serialize cleanly to JSON."""
        rec = EvidenceRecord(
            module="test_module",
            evidence_type=EvidenceType.CLASSIFIER,
            raw_output={"logit": 1.25, "class": "fake"},
            synthetic_score=0.78,
            score_direction=ScoreDirection.HIGHER_MEANS_SYNTHETIC,
            quality_score=0.95,
            quality_metadata={"duration_sec": 4.5},
            calibration_status=CalibrationStatus.NOT_CALIBRATED,
            metadata={"version": "1.0"},
        )
        d = rec.to_dict()
        assert d["module"] == "test_module"
        assert d["evidence_type"] == "classifier"
        assert d["synthetic_score"] == 0.78
        assert d["score_direction"] == "higher_means_synthetic"

        # Verify JSON serializability
        serialized = json.dumps(d)
        assert "test_module" in serialized

    def test_audio_chunking_utility(self):
        """create_audio_chunks must correctly slice waveforms into overlapping windows."""
        sr = 16000
        # 10 seconds of audio
        waveform = np.ones(10 * sr, dtype=np.float32)
        # 4-second chunks with 1-second overlap (step = 3s)
        chunks = create_audio_chunks(waveform, sr=sr, chunk_sec=4.0, overlap_sec=1.0)

        # Expected chunks:
        # Chunk 0: [0s, 4s]
        # Chunk 1: [3s, 7s]
        # Chunk 2: [6s, 10s]
        assert len(chunks) == 3
        c0_arr, c0_meta = chunks[0]
        assert len(c0_arr) == 4 * sr
        assert c0_meta.chunk_index == 0
        assert c0_meta.start_sec == 0.0
        assert c0_meta.end_sec == 4.0

        c1_arr, c1_meta = chunks[1]
        assert c1_meta.start_sec == 3.0
        assert c1_meta.end_sec == 7.0

        c2_arr, c2_meta = chunks[2]
        assert c2_meta.start_sec == 6.0
        assert c2_meta.end_sec == 10.0

    def test_audio_chunking_short_audio(self):
        """Audio shorter than chunk duration must return a single chunk."""
        sr = 16000
        short_wave = np.ones(2 * sr, dtype=np.float32)
        chunks = create_audio_chunks(short_wave, sr=sr, chunk_sec=4.0, overlap_sec=1.0)
        assert len(chunks) == 1
        assert chunks[0][1].duration_sec == 2.0

    def test_existing_adapters(self):
        """Existing module outputs must adapt to EvidenceRecord cleanly."""
        # 1. Wav2Vec2 adapter
        w2v_mock = {
            "prediction": "fake",
            "assessment": "LIKELY_SYNTHETIC",
            "fake_probability": 0.88,
            "real_probability": 0.12,
            "raw_logits": {"fake_logit": 1.2, "real_logit": -1.2},
            "audio_metadata": {"duration_seconds": 4.6},
        }
        w2v_rec = adapt_wav2vec2_evidence(w2v_mock)
        assert w2v_rec.module == "wav2vec2"
        assert w2v_rec.synthetic_score == 0.88
        assert w2v_rec.score_direction == ScoreDirection.HIGHER_MEANS_SYNTHETIC

        # 2. DF Arena adapter
        df_mock = {
            "prediction": "spoof",
            "assessment": "LIKELY_SYNTHETIC",
            "spoof_probability": 0.999,
            "bona_fide_probability": 0.001,
            "spoof_score": 5.2,
            "bona_fide_score": -4.5,
            "audio_metadata": {"duration_seconds": 4.6},
        }
        df_rec = adapt_df_arena_evidence(df_mock)
        assert df_rec.module == "df_arena"
        assert df_rec.synthetic_score == 0.999

        # 3. Spectrogram adapter
        spec_mock = {
            "features": {
                "spectral_centroid": {"mean": 1892.2},
                "spectral_flatness": {"mean": 0.033},
                "spectral_rolloff_95": {"mean": 5764.9},
            },
            "stft_dimensions": {"frequency_bins": 513, "time_frames": 246},
        }
        spec_rec = adapt_spectrogram_evidence(spec_mock)
        assert spec_rec.module == "spectrogram"
        assert spec_rec.synthetic_score is None
        assert spec_rec.metadata["spectral_centroid_hz"] == 1892.2

        # 4. Prosody adapter
        pros_mock = {
            "status": "ok",
            "analysis_quality": {"duration_sec": 4.6, "voiced_ratio": 0.26, "usable_for_pitch_features": True},
            "features": {"f0_mean_hz": 178.2, "f0_std_hz": 19.4, "syllable_peak_rate": 2.58},
        }
        pros_rec = adapt_prosody_evidence(pros_mock)
        assert pros_rec.module == "prosody"
        assert pros_rec.synthetic_score is None
        assert pros_rec.metadata["f0_mean_hz"] == 178.2


class TestWhisperRepresentationSpecialist:
    """Test Whisper representation specialist lifecycle and representation extraction."""

    @pytest.fixture(scope="class")
    @classmethod
    def service(cls):
        s = WhisperRepService()
        s.load()
        yield s
        s.unload()

    def test_whisper_rep_lifecycle(self):
        """Model must support explicit load() and unload() freeing memory."""
        svc = WhisperRepService()
        assert svc._is_loaded is False
        svc.load()
        assert svc._is_loaded is True
        assert svc.model is not None
        svc.unload()
        assert svc._is_loaded is False
        assert svc.model is None

    def test_whisper_rep_waveform_extraction(self, service):
        """Waveform extraction must produce 384-dimensional representation with finite statistics."""
        t = np.linspace(0, 1.0, 16000, dtype=np.float32)
        y = 0.4 * np.sin(2 * np.pi * 220 * t)

        res = service.extract_waveform(y, sr=16000)
        metrics = res["metrics"]
        assert metrics["hidden_dimension"] == 384
        assert metrics["effective_frames"] > 0
        assert metrics["representation_norm"] > 0.0
        assert metrics["temporal_representation_flux"] >= 0.0
        assert metrics["representation_dispersion"] >= 0.0

        ev = res["evidence_record"]
        assert ev["module"] == "whisper_representation"
        assert ev["evidence_type"] == "embedding"
        assert ev["synthetic_score"] is None  # Never outputs pseudo-probability

    def test_whisper_rep_empty_rejection(self, service):
        """Empty waveform must raise ValueError."""
        with pytest.raises(ValueError, match="Audio waveform cannot be empty"):
            service.validate_waveform(np.array([], dtype=np.float32))

    def test_whisper_rep_nan_rejection(self, service):
        """Waveform with NaN must raise ValueError."""
        bad_audio = np.array([0.1, np.nan, 0.3], dtype=np.float32)
        with pytest.raises(ValueError, match="NaN or Inf"):
            service.validate_waveform(bad_audio)

    def test_whisper_rep_file_extraction(self, service):
        """Must extract representation on benchmark human voice file."""
        assert SAMPLE_HUMAN.exists()
        res = service.extract_file(SAMPLE_HUMAN)
        assert res["metrics"]["hidden_dimension"] == 384
        assert res["metrics"]["inference_time_sec"] > 0.0


class TestWatermarkService:
    """Test Watermark & Provenance Scanner states and forensic rules."""

    @pytest.fixture(scope="class")
    @classmethod
    def service(cls):
        return WatermarkService()

    def test_watermark_scanner_states(self, service):
        """Scan on clean benchmark sample must return valid ProvenanceState."""
        assert SAMPLE_HUMAN.exists()
        res = service.scan_file(SAMPLE_HUMAN)
        assert res["provenance_state"] in (ProvenanceState.NOT_DETECTED, ProvenanceState.NOT_APPLICABLE)
        assert res["module"] == "watermark_scanner"
        assert "CRITICAL" in res["forensic_rule"]

    def test_watermark_ultrasonic_detection(self, service):
        """Injected ultrasonic spike in 48kHz audio must be detected."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, dtype=np.float32)
        # Base speech-like tone at 200 Hz + strong ultrasonic pilot carrier spike at 18 kHz
        y = 0.3 * np.sin(2 * np.pi * 200 * t) + 0.3 * np.sin(2 * np.pi * 18000 * t)

        state, details = service.scan_frequency_watermark(y, sr=sr)
        assert state == ProvenanceState.DETECTED
        assert details["watermark_type"] == "ultrasonic_pilot_tone"

    def test_watermark_narrowband_not_applicable(self, service):
        """Audio below 32 kHz must return NOT_APPLICABLE for ultrasonic scan."""
        sr = 16000
        y = np.ones(sr, dtype=np.float32) * 0.1
        state, details = service.scan_frequency_watermark(y, sr=sr)
        assert state == ProvenanceState.NOT_APPLICABLE
        assert "below ultrasonic watermark band" in details["reason"]
