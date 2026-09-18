# Audio DeepCheck - Spectrogram Service Test Suite
import math
import sys
from pathlib import Path
import numpy as np
import pytest

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.spectrogram_service import (
    SpectrogramService,
    SpectrogramConfig,
    load_and_preprocess_audio,
    inspect_audio,
)

SAMPLE_HUMAN = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
SAMPLE_AI = PROJECT_ROOT / "data" / "samples" / "ai_voice.wav"


class TestSpectrogramService:
    """Test STFT, Mel-spectrogram, feature extraction, and input validation."""

    @pytest.fixture(scope="class")
    @classmethod
    def service(cls):
        """Shared SpectrogramService instance."""
        config = SpectrogramConfig(sr=16000, n_fft=1024, hop_length=256, n_mels=80)
        return SpectrogramService(config=config)

    def test_empty_input_rejection(self, service):
        """Empty waveform must raise ValueError."""
        with pytest.raises(ValueError, match="Audio waveform cannot be empty"):
            service.validate_audio(np.array([], dtype=np.float32))

    def test_nan_inf_rejection(self, service):
        """Waveform with NaN or Inf values must raise ValueError."""
        bad_audio = np.array([0.1, np.nan, 0.3], dtype=np.float32)
        with pytest.raises(ValueError, match="NaN or Inf"):
            service.validate_audio(bad_audio)

    def test_mono_stereo_handling(self, service):
        """2D stereo audio must be cleanly downmixed to 1D mono."""
        stereo = np.ones((16000, 2), dtype=np.float32) * 0.5
        mono = service.validate_audio(stereo)
        assert mono.ndim == 1
        assert len(mono) == 16000
        assert np.isclose(mono[0], 0.5)

    def test_nonexistent_file_rejection(self, service):
        """Nonexistent audio file must raise FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            service.analyze_file("nonexistent_path.wav")

    def test_stft_dimensions(self, service):
        """Verify STFT frequency bins and time frame dimensions."""
        sr = 16000
        duration = 1.0  # 1 second = 16000 samples
        t = np.linspace(0, duration, int(sr * duration), endpoint=False, dtype=np.float32)
        y = 0.5 * np.sin(2 * np.pi * 440 * t)

        mag, stft_db = service.compute_stft(y)
        expected_freq_bins = 1 + service.config.n_fft // 2  # 1024 // 2 + 1 = 513
        assert mag.shape[0] == expected_freq_bins
        assert stft_db.shape == mag.shape
        # Expected frames: ~16000 // hop_length + 1
        expected_frames = 1 + int(len(y) // service.config.hop_length)
        assert abs(mag.shape[1] - expected_frames) <= 2

    def test_mel_dimensions(self, service):
        """Verify Mel spectrogram dimensions."""
        sr = 16000
        duration = 1.0
        t = np.linspace(0, duration, int(sr * duration), endpoint=False, dtype=np.float32)
        y = 0.5 * np.sin(2 * np.pi * 1000 * t)

        mel, mel_db = service.compute_mel(y)
        assert mel.shape[0] == service.config.n_mels  # 80
        assert mel_db.shape == mel.shape
        assert mel.ndim == 2

    def test_spectral_feature_keys(self, service):
        """Ensure all required physical and psychoacoustic features are present."""
        sr = 16000
        t = np.linspace(0, 0.5, 8000, endpoint=False, dtype=np.float32)
        y = 0.4 * np.sin(2 * np.pi * 440 * t)

        features = service.extract_features(y, sr)
        expected_keys = [
            "spectral_centroid",
            "spectral_bandwidth",
            "spectral_rolloff_85",
            "spectral_rolloff_95",
            "spectral_flatness",
            "zero_crossing_rate",
            "spectral_contrast",
            "rms_energy",
            "harmonic_percussive",
            "mel_band_distribution",
            "spectral_flux",
            "extraction_latency_seconds",
        ]
        for key in expected_keys:
            assert key in features, f"Missing expected feature: {key}"

        # Check sub-keys for stats
        for stat_feature in ["spectral_centroid", "spectral_bandwidth", "spectral_flatness"]:
            for stat in ["mean", "std", "min", "max", "median", "p90"]:
                assert stat in features[stat_feature], f"Missing {stat} in {stat_feature}"

    def test_finite_numeric_outputs(self, service):
        """Verify that all extracted numerical values are finite floats."""
        sr = 16000
        t = np.linspace(0, 0.5, 8000, endpoint=False, dtype=np.float32)
        y = 0.3 * np.sin(2 * np.pi * 500 * t)

        features = service.extract_features(y, sr)
        for name, data in features.items():
            if isinstance(data, dict):
                for k, v in data.items():
                    if isinstance(v, (int, float)):
                        assert math.isfinite(v), f"Non-finite value {v} for {name}.{k}"
                    elif isinstance(v, dict):
                        for sub_k, sub_v in v.items():
                            assert math.isfinite(sub_v), f"Non-finite value {sub_v} for {name}.{k}.{sub_k}"

    def test_end_to_end_on_human_sample(self, service):
        """Verify end-to-end analysis on benchmark human sample."""
        assert SAMPLE_HUMAN.exists()
        result = service.analyze_file(SAMPLE_HUMAN)
        assert result["component"] == "spectrogram_evidence_layer"
        assert result["stft_dimensions"]["frequency_bins"] == 513
        assert result["mel_dimensions"]["mel_bands"] == 80
        assert "audio_metadata" in result
        assert result["features"]["spectral_centroid"]["mean"] > 0

    def test_end_to_end_on_ai_sample(self, service):
        """Verify end-to-end analysis on benchmark AI sample."""
        assert SAMPLE_AI.exists()
        result = service.analyze_file(SAMPLE_AI)
        assert result["component"] == "spectrogram_evidence_layer"
        assert result["stft_dimensions"]["frequency_bins"] == 513
        assert result["mel_dimensions"]["mel_bands"] == 80
        assert "audio_metadata" in result
        assert result["features"]["spectral_centroid"]["mean"] > 0

    def test_render_plots_generation(self, service, tmp_path):
        """Verify that render_plots generates all 4 PNG files on disk."""
        sr = 16000
        t = np.linspace(0, 0.5, 8000, endpoint=False, dtype=np.float32)
        y = 0.3 * np.sin(2 * np.pi * 440 * t)

        plots = service.render_plots(y, "test_synth.wav", tmp_path, sr=sr)
        assert "waveform" in plots
        assert "linear_spectrogram" in plots
        assert "mel_spectrogram" in plots
        assert "combined_summary" in plots

        for p in plots.values():
            assert Path(p).exists()
            assert Path(p).stat().st_size > 1000
