# Audio DeepCheck - Wav2Vec2 Unit & Integration Tests
import sys
from pathlib import Path
import numpy as np
import soundfile as sf
import pytest

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.wav2vec_service import (
    Wav2Vec2Detector,
    inspect_audio,
    load_and_preprocess_audio,
    TARGET_SAMPLE_RATE
)


class TestAudioPreprocessing:

    def test_inspect_and_preprocess(self, tmp_path: Path):
        """Test audio inspection, mono conversion, resampling, and normalization."""
        sr = 44100
        duration_s = 0.5
        t = np.linspace(0, duration_s, int(sr * duration_s), endpoint=False)
        # 2-channel stereo signal
        channel1 = (0.6 * np.sin(2 * np.pi * 300.0 * t)).astype(np.float32)
        channel2 = (0.4 * np.sin(2 * np.pi * 600.0 * t)).astype(np.float32)
        stereo_signal = np.stack([channel1, channel2], axis=1)

        test_file = tmp_path / "test_stereo_44k.wav"
        sf.write(str(test_file), stereo_signal, samplerate=sr)

        # Inspect raw file
        metadata = inspect_audio(test_file)
        assert metadata["file_name"] == "test_stereo_44k.wav"
        assert metadata["sample_rate"] == 44100
        assert metadata["channels"] == 2
        assert metadata["duration_seconds"] == 0.5

        # Preprocess
        waveform, meta = load_and_preprocess_audio(test_file, target_sr=TARGET_SAMPLE_RATE)
        assert waveform.ndim == 1  # Converted to mono
        assert len(waveform) == int(TARGET_SAMPLE_RATE * duration_s)  # Resampled to 16000
        assert np.max(np.abs(waveform)) <= 1.0  # Normalized


class TestWav2Vec2Detector:

    @classmethod
    def setup_class(cls):
        """Instantiate detector once for tests."""
        cls.detector = Wav2Vec2Detector()

    def test_model_initialization(self):
        """Verify model, feature extractor, and labels are configured correctly."""
        assert self.detector is not None
        assert self.detector.device.type == "cpu"
        assert self.detector.label2id["real"] == 0
        assert self.detector.label2id["fake"] == 1
        assert self.detector.feature_extractor.sampling_rate == TARGET_SAMPLE_RATE

    def test_predict_waveform_structure(self):
        """Test inference on a test waveform to verify pipeline integrity."""
        duration_s = 1.0
        t = np.linspace(0, duration_s, int(TARGET_SAMPLE_RATE * duration_s), endpoint=False)
        test_waveform = (0.5 * np.sin(2 * np.pi * 440.0 * t)).astype(np.float32)

        result = self.detector.predict_waveform(test_waveform, sample_rate=TARGET_SAMPLE_RATE)

        assert "prediction" in result
        assert result["prediction"] in ["real", "fake"]
        assert "assessment" in result
        assert result["assessment"] in ["LIKELY_HUMAN", "LIKELY_SYNTHETIC", "UNCERTAIN"]
        assert "real_probability" in result
        assert "fake_probability" in result
        assert 0.0 <= result["real_probability"] <= 1.0
        assert 0.0 <= result["fake_probability"] <= 1.0
        assert pytest.approx(result["real_probability"] + result["fake_probability"], abs=1e-3) == 1.0
        assert "logits" in result
        assert "real" in result["logits"]
        assert "fake" in result["logits"]

    def test_empty_waveform_rejection(self):
        """Verify that empty waveform raises ValueError."""
        empty_waveform = np.array([], dtype=np.float32)
        with pytest.raises(ValueError):
            self.detector.predict_waveform(empty_waveform)

    def test_predict_human_sample(self):
        """Test inference on downloaded real human voice recording."""
        human_sample = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
        if not human_sample.exists():
            pytest.skip("human_voice.wav sample not found")

        result = self.detector.predict_file(human_sample)
        assert result["prediction"] == "real"
        assert result["assessment"] == "LIKELY_HUMAN"
        assert result["real_probability"] > 0.70
        assert result["fake_probability"] < 0.30

    def test_predict_ai_sample(self):
        """Test inference on downloaded synthetic AI voice recording."""
        ai_sample = PROJECT_ROOT / "data" / "samples" / "ai_voice.wav"
        if not ai_sample.exists():
            pytest.skip("ai_voice.wav sample not found")

        result = self.detector.predict_file(ai_sample)
        assert result["prediction"] == "fake"
        assert result["assessment"] == "LIKELY_SYNTHETIC"
        assert result["fake_probability"] > 0.70
        assert result["real_probability"] < 0.30


if __name__ == "__main__":
    pytest.main(["-v", __file__])
