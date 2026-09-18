# Audio DeepCheck - Prosody & F0 Unit & Integration Tests
import math
from pathlib import Path
import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent

from app.services.prosody_service import (
    ProsodyService,
    ProsodyConfig,
    load_and_preprocess_audio,
    inspect_audio,
)

SAMPLE_HUMAN = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
SAMPLE_AI = PROJECT_ROOT / "data" / "samples" / "ai_voice.wav"
TEST_OUTPUT_DIR = PROJECT_ROOT / "data" / "test" / "prosody"


class TestProsodyService:
    """Test F0 pitch estimation, voicing detection, energy, pause analysis, and edge cases."""

    @pytest.fixture(scope="class")
    @classmethod
    def service(cls):
        """Shared ProsodyService instance."""
        config = ProsodyConfig(sr=16000, fmin=50.0, fmax=500.0, hop_length=256, frame_length=2048)
        return ProsodyService(config=config)

    def test_empty_input_rejection(self, service):
        """Empty waveform array must raise ValueError."""
        with pytest.raises(ValueError, match="Audio waveform cannot be empty"):
            service.validate_audio(np.array([], dtype=np.float32))

    def test_nan_inf_rejection(self, service):
        """Waveform with NaN or Inf values must raise ValueError."""
        bad_nan = np.array([0.1, np.nan, 0.3], dtype=np.float32)
        with pytest.raises(ValueError, match="NaN or Inf"):
            service.validate_audio(bad_nan)

        bad_inf = np.array([0.1, np.inf, 0.3], dtype=np.float32)
        with pytest.raises(ValueError, match="NaN or Inf"):
            service.validate_audio(bad_inf)

    def test_stereo_to_mono_downmixing(self, service):
        """2D stereo audio must be cleanly downmixed to 1D mono."""
        stereo = np.ones((16000, 2), dtype=np.float32) * 0.4
        mono = service.validate_audio(stereo)
        assert mono.ndim == 1
        assert len(mono) == 16000
        assert np.isclose(mono[0], 0.4)

    def test_nonexistent_file_rejection(self):
        """Missing file path must raise FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            load_and_preprocess_audio(PROJECT_ROOT / "data" / "samples" / "non_existent_audio.wav")

    def test_pure_silence_handling(self, service):
        """All-zero audio array must return insufficient_voicing without crashing."""
        silent_audio = np.zeros(16000 * 2, dtype=np.float32)
        res = service.analyze_waveform(silent_audio, sr=16000)

        assert res["status"] == "insufficient_voicing"
        assert res["analysis_quality"]["usable_for_pitch_features"] is False
        assert res["analysis_quality"]["voiced_ratio"] == 0.0
        assert res["features"]["f0_mean_hz"] == 0.0
        assert res["features"]["silence_ratio"] == 1.0

    def test_short_audio_handling(self, service):
        """Very short audio (<0.2s) must be handled safely and report status accurately."""
        short_audio = np.sin(2 * np.pi * 200 * np.linspace(0, 0.1, 1600, dtype=np.float32))
        res = service.analyze_waveform(short_audio, sr=16000)

        assert res["status"] in ("short_audio", "insufficient_voicing")
        assert res["analysis_quality"]["duration_sec"] == 0.1
        assert "features" in res

    def test_mostly_unvoiced_audio(self, service):
        """Unvoiced white noise must yield zero/near-zero voicing and safe pitch features."""
        np.random.seed(42)
        noise = (np.random.rand(16000 * 2).astype(np.float32) - 0.5) * 0.05
        res = service.analyze_waveform(noise, sr=16000)

        # Voicing should be minimal/absent for random uniform noise
        assert res["analysis_quality"]["voiced_ratio"] < 0.20
        assert isinstance(res["features"]["f0_mean_hz"], (int, float))

    def test_schema_and_keys(self, service):
        """Verify the complete schema and required feature keys."""
        t = np.linspace(0, 1.0, 16000, dtype=np.float32)
        synthetic_tone = 0.5 * np.sin(2 * np.pi * 220 * t)  # 220 Hz harmonic sine
        res = service.analyze_waveform(synthetic_tone, sr=16000)

        assert res["module"] == "prosody"
        assert res["version"] == "1.0"
        assert res["status"] == "ok"
        assert "analysis_quality" in res
        assert "features" in res
        assert "forensic_note" in res

        quality_keys = [
            "duration_sec", "total_frames", "voiced_frames", "valid_f0_frames",
            "voiced_ratio", "valid_f0_frame_ratio", "usable_for_pitch_features"
        ]
        for qk in quality_keys:
            assert qk in res["analysis_quality"]

        required_features = [
            # Pitch Stats
            "f0_mean_hz", "f0_median_hz", "f0_std_hz", "f0_min_hz", "f0_max_hz",
            "f0_range_hz", "f0_iqr_hz", "f0_cov",
            # Pitch Dynamics
            "mean_abs_f0_change_hz", "median_abs_f0_change_hz", "std_abs_f0_change_hz",
            "pitch_slope_mean_hz_per_sec", "rising_segments_count", "falling_segments_count",
            "local_pitch_variability",
            # Voicing
            "voiced_ratio", "unvoiced_ratio", "voiced_segment_count",
            "mean_voiced_segment_duration_sec", "median_voiced_segment_duration_sec",
            "min_voiced_segment_duration_sec", "max_voiced_segment_duration_sec",
            "voicing_transition_count",
            # Energy
            "mean_rms", "median_rms", "std_rms", "dynamic_range_db",
            "rms_p10", "rms_p90", "frame_to_frame_rms_change", "voiced_unvoiced_energy_ratio",
            # Pause / Silence
            "silence_ratio", "pause_count", "mean_pause_duration_sec", "median_pause_duration_sec",
            "max_pause_duration_sec", "pause_duration_std_sec", "voice_to_silence_transition_count",
            # Rate Proxies
            "voiced_segments_per_sec", "temporal_activity_ratio", "syllable_peak_rate",
            "pause_adjusted_activity_rate",
            # Micro-variations
            "jitter_local_proxy", "shimmer_local_proxy",
        ]
        feat = res["features"]
        for rk in required_features:
            assert rk in feat, f"Missing required feature: {rk}"

    def test_finite_numeric_outputs(self, service):
        """All features must be finite real numbers (no NaNs, no Infs)."""
        t = np.linspace(0, 1.0, 16000, dtype=np.float32)
        audio = 0.3 * np.sin(2 * np.pi * 150 * t)
        res = service.analyze_waveform(audio, sr=16000)

        for k, v in res["features"].items():
            assert isinstance(v, (int, float)), f"Feature {k} is not int/float, got {type(v)}"
            assert math.isfinite(v), f"Feature {k} is not finite: {v}"

    def test_end_to_end_on_human_sample(self, service):
        """Verify full feature extraction on actual human speech benchmark file."""
        assert SAMPLE_HUMAN.exists(), f"Benchmark file missing: {SAMPLE_HUMAN}"
        y, meta = load_and_preprocess_audio(SAMPLE_HUMAN, target_sr=16000)
        res = service.analyze_waveform(y, sr=16000)

        assert res["status"] == "ok"
        assert res["analysis_quality"]["usable_for_pitch_features"] is True
        assert res["analysis_quality"]["voiced_ratio"] > 0.10
        # Human adult speech pitch typically sits in 80 - 350 Hz
        assert 80.0 <= res["features"]["f0_mean_hz"] <= 350.0
        assert res["features"]["voiced_segment_count"] >= 1

    def test_end_to_end_on_ai_sample(self, service):
        """Verify full feature extraction on actual AI speech benchmark file."""
        assert SAMPLE_AI.exists(), f"Benchmark file missing: {SAMPLE_AI}"
        y, meta = load_and_preprocess_audio(SAMPLE_AI, target_sr=16000)
        res = service.analyze_waveform(y, sr=16000)

        assert res["status"] == "ok"
        assert res["analysis_quality"]["usable_for_pitch_features"] is True
        assert 80.0 <= res["features"]["f0_mean_hz"] <= 350.0

    def test_render_plots_generation(self, service):
        """Verify diagnostic plots are properly rendered to disk."""
        t = np.linspace(0, 1.5, 24000, dtype=np.float32)
        audio = 0.4 * np.sin(2 * np.pi * 180 * t)
        TEST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        plots = service.render_plots(
            y=audio,
            file_name="test_tone.wav",
            output_dir=TEST_OUTPUT_DIR,
            sr=16000,
        )

        expected_plots = ["waveform_energy", "f0_contour", "pause_segmentation", "combined_summary"]
        for p_key in expected_plots:
            assert p_key in plots, f"Missing plot output: {p_key}"
            assert plots[p_key].exists(), f"Plot file not created: {plots[p_key]}"
            assert plots[p_key].stat().st_size > 5000, f"Plot file too small: {plots[p_key]}"
