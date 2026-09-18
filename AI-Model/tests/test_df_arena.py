# Audio DeepCheck - DF Arena 500M Test Suite
import sys
import math
from pathlib import Path
import numpy as np
import pytest

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.df_arena_service import (
    DFArenaDetector,
    pad_fixed,
    load_and_preprocess_audio,
    inspect_audio,
    DF_ARENA_WINDOW_SAMPLES,
    TARGET_SAMPLE_RATE,
)

SAMPLE_HUMAN_PATH = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
SAMPLE_AI_PATH = PROJECT_ROOT / "data" / "samples" / "ai_voice.wav"


class TestDFArenaPreprocessing:
    """Test preprocessing and deterministic window padding."""

    def test_pad_fixed_short_waveform(self):
        """Short waveforms (< 64600 samples) must be tiled/repeated deterministically."""
        short_wave = np.array([0.1, 0.2, 0.3, 0.4, 0.5], dtype=np.float32)
        padded = pad_fixed(short_wave, max_len=DF_ARENA_WINDOW_SAMPLES)
        assert len(padded) == DF_ARENA_WINDOW_SAMPLES
        assert padded.dtype == np.float32
        # Check first 5 samples and next 5 samples match repeat pattern
        np.testing.assert_allclose(padded[:5], short_wave)
        np.testing.assert_allclose(padded[5:10], short_wave)

    def test_pad_fixed_exact_length(self):
        """Waveforms with exact 64,600 samples must be untouched."""
        exact_wave = np.sin(np.linspace(0, 100, DF_ARENA_WINDOW_SAMPLES, dtype=np.float32))
        padded = pad_fixed(exact_wave, max_len=DF_ARENA_WINDOW_SAMPLES)
        assert len(padded) == DF_ARENA_WINDOW_SAMPLES
        np.testing.assert_allclose(padded, exact_wave)

    def test_pad_fixed_long_waveform(self):
        """Long waveforms (> 64600 samples) must be deterministically sliced to first 64600 samples."""
        long_wave = np.arange(100000, dtype=np.float32)
        padded = pad_fixed(long_wave, max_len=DF_ARENA_WINDOW_SAMPLES)
        assert len(padded) == DF_ARENA_WINDOW_SAMPLES
        np.testing.assert_allclose(padded, long_wave[:DF_ARENA_WINDOW_SAMPLES])

    def test_pad_fixed_empty_rejection(self):
        """Empty waveform must raise ValueError."""
        empty_wave = np.array([], dtype=np.float32)
        with pytest.raises(ValueError, match="Audio waveform is empty"):
            pad_fixed(empty_wave, max_len=DF_ARENA_WINDOW_SAMPLES)

    def test_inspect_and_preprocess_file(self):
        """Verify audio inspection and end-to-end preprocessing on sample audio."""
        assert SAMPLE_HUMAN_PATH.exists(), f"Benchmark sample missing at {SAMPLE_HUMAN_PATH}"
        waveform, meta = load_and_preprocess_audio(SAMPLE_HUMAN_PATH)
        assert len(waveform) == DF_ARENA_WINDOW_SAMPLES
        assert waveform.dtype == np.float32
        assert meta["sample_rate"] in [44100, 48000, 16000]
        assert meta["channels"] >= 1
        assert "duration_seconds" in meta
        assert "format" in meta


@pytest.fixture(scope="module")
def shared_df_detector():
    """Shared detector fixture across tests to avoid reloading 1.7GB model."""
    det = DFArenaDetector(auto_load=True)
    yield det
    det.unload()


class TestDFArenaDetector:
    """Test DFArenaDetector model lifecycle, execution, and outputs."""

    def test_model_initialization_deferred(self):
        """Verify detector initializes with auto_load=False without immediate model loading."""
        det = DFArenaDetector(auto_load=False)
        assert det.model is None
        assert det.backend == "pytorch_cpu"

    def test_lifecycle_load_unload(self):
        """Verify explicit load and unload lifecycle frees model reference."""
        det = DFArenaDetector(auto_load=False)
        assert det.model is None
        det.load()
        assert det.model is not None
        det.unload()
        assert det.model is None

    def test_predict_waveform_structure(self, shared_df_detector):
        """Verify output dictionary schema and keys on synthetic test waveform."""
        # 1-second 440 Hz test tone
        t = np.linspace(0, 1.0, 16000, endpoint=False, dtype=np.float32)
        synth_tone = 0.5 * np.sin(2 * np.pi * 440 * t)

        result = shared_df_detector.predict_waveform(synth_tone)
        assert isinstance(result, dict)
        expected_keys = [
            "model",
            "backend",
            "prediction",
            "assessment",
            "bona_fide_score",
            "spoof_score",
            "bona_fide_probability",
            "spoof_probability",
            "logits",
            "probabilities",
            "score_semantics",
            "inference_time_seconds",
        ]
        for key in expected_keys:
            assert key in result, f"Missing key: {key}"

        assert result["model"] == "df_arena_500m"
        assert result["backend"] == "pytorch_cpu"
        assert result["prediction"] in ["spoof", "bonafide"]
        assert result["assessment"] in ["LIKELY_HUMAN", "LIKELY_SYNTHETIC", "UNCERTAIN"]

    def test_score_range_and_probabilities(self, shared_df_detector):
        """Verify probability boundaries and softmax sum = 1.0."""
        t = np.linspace(0, 0.5, 8000, endpoint=False, dtype=np.float32)
        synth_tone = 0.3 * np.sin(2 * np.pi * 300 * t)

        result = shared_df_detector.predict_waveform(synth_tone)
        bf_prob = result["bona_fide_probability"]
        sp_prob = result["spoof_probability"]

        assert 0.0 <= bf_prob <= 1.0
        assert 0.0 <= sp_prob <= 1.0
        assert math.isclose(bf_prob + sp_prob, 1.0, abs_tol=1e-3)

    def test_empty_waveform_rejection(self, shared_df_detector):
        """Verify detector rejects empty waveforms with ValueError."""
        with pytest.raises(ValueError, match="Audio waveform cannot be empty"):
            shared_df_detector.predict_waveform(np.array([], dtype=np.float32))

    def test_nonexistent_file_rejection(self, shared_df_detector):
        """Verify detector rejects non-existent files with FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            shared_df_detector.predict_file(Path("non_existent_audio_file.wav"))

    def test_predict_human_sample(self, shared_df_detector):
        """Verify prediction runs on benchmark human sample."""
        assert SAMPLE_HUMAN_PATH.exists()
        result = shared_df_detector.predict_file(SAMPLE_HUMAN_PATH)
        assert result["model"] == "df_arena_500m"
        assert result["prediction"] in ["spoof", "bonafide"]
        assert "audio_metadata" in result
        assert result["inference_time_seconds"] > 0

    def test_predict_ai_sample(self, shared_df_detector):
        """Verify prediction runs on benchmark AI sample."""
        assert SAMPLE_AI_PATH.exists()
        result = shared_df_detector.predict_file(SAMPLE_AI_PATH)
        assert result["model"] == "df_arena_500m"
        assert result["prediction"] in ["spoof", "bonafide"]
        assert "audio_metadata" in result
        assert result["inference_time_seconds"] > 0
