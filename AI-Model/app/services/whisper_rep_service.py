# Audio DeepCheck - Speech Representation Specialist (Whisper Encoder)
import gc
import os
import time
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, Union
import numpy as np
import soundfile as sf
import torch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = PROJECT_ROOT / "models" / "huggingface"

os.environ["HF_HOME"] = str(CACHE_DIR)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from app.services.evidence_contract import (
    EvidenceRecord,
    EvidenceType,
    ScoreDirection,
    CalibrationStatus,
)

DEFAULT_MODEL_ID = "openai/whisper-tiny"
TARGET_SR = 16000


class WhisperRepService:
    """
    Speech representation specialist service using a pretrained Whisper encoder.
    Extracts foundation acoustic/linguistic representations, temporal representation flux,
    and representation dispersion.
    CRITICAL: Does NOT output fake/human probabilities. Returns raw representations and statistics.
    """

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL_ID,
        device: str = "cpu",
        cache_dir: Optional[Path] = None,
    ):
        self.model_id = model_id
        self.device = torch.device(device)
        self.cache_dir = Path(cache_dir) if cache_dir else CACHE_DIR
        self.model = None
        self.feature_extractor = None
        self._is_loaded = False

    def load(self):
        """Load Whisper feature extractor and model encoder into CPU memory."""
        if self._is_loaded:
            return

        from transformers import WhisperModel, WhisperFeatureExtractor

        self.feature_extractor = WhisperFeatureExtractor.from_pretrained(
            self.model_id,
            cache_dir=str(self.cache_dir),
        )
        self.model = WhisperModel.from_pretrained(
            self.model_id,
            cache_dir=str(self.cache_dir),
        )
        self.model.to(self.device)
        self.model.eval()
        self._is_loaded = True

    def unload(self):
        """Unload model and free memory."""
        if not self._is_loaded:
            return
        del self.model
        del self.feature_extractor
        self.model = None
        self.feature_extractor = None
        self._is_loaded = False
        gc.collect()

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

    def extract_waveform(
        self, y: np.ndarray, sr: int = TARGET_SR
    ) -> Dict[str, Any]:
        """
        Extract encoder hidden representations and temporal statistics from audio.
        Returns:
            Dictionary containing representation metrics, pooling statistics, and an EvidenceRecord.
        """
        if not self._is_loaded:
            self.load()

        y = self.validate_waveform(y)
        duration_sec = len(y) / sr

        # Whisper expects 16 kHz audio
        if sr != TARGET_SR:
            import librosa
            y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)
            sr = TARGET_SR

        t0 = time.perf_counter()

        # Compute log-mel spectrogram features [1, 80, 3000]
        inputs = self.feature_extractor(
            y,
            sampling_rate=TARGET_SR,
            return_tensors="pt",
        )
        input_features = inputs.input_features.to(self.device)

        with torch.no_grad():
            encoder_outputs = self.model.encoder(input_features)
            # Hidden states shape: [1, 1500, hidden_size] (hidden_size=384 for tiny)
            hidden_states = encoder_outputs.last_hidden_state.cpu().numpy()[0]

        # Effective frames corresponding to actual audio length (Whisper hop is 20ms -> 50 fps)
        effective_frames = min(hidden_states.shape[0], max(1, int(duration_sec * 50)))
        active_states = hidden_states[:effective_frames, :]  # [effective_frames, 384]

        # 1. Pooled mean representation vector across time
        mean_vec = np.mean(active_states, axis=0)  # [384]
        std_vec = np.std(active_states, axis=0)    # [384]

        rep_norm = float(np.linalg.norm(mean_vec))
        rep_variance = float(np.mean(std_vec ** 2))

        # 2. Temporal representation flux: frame-to-frame Euclidean step
        if active_states.shape[0] > 1:
            diffs = np.diff(active_states, axis=0)
            step_norms = np.linalg.norm(diffs, axis=1)
            temporal_flux = float(np.mean(step_norms))
        else:
            temporal_flux = 0.0

        # 3. Representation dispersion: average cosine distance from frames to mean
        norm_states = active_states / (np.linalg.norm(active_states, axis=1, keepdims=True) + 1e-8)
        norm_mean = mean_vec / (np.linalg.norm(mean_vec) + 1e-8)
        cos_similarities = np.dot(norm_states, norm_mean)
        dispersion = float(np.mean(1.0 - cos_similarities))

        elapsed = time.perf_counter() - t0

        raw_metrics = {
            "model_id": self.model_id,
            "hidden_dimension": int(active_states.shape[1]),
            "effective_frames": int(effective_frames),
            "representation_norm": round(rep_norm, 4),
            "representation_variance": round(rep_variance, 4),
            "temporal_representation_flux": round(temporal_flux, 4),
            "representation_dispersion": round(dispersion, 4),
            "inference_time_sec": round(elapsed, 4),
        }

        # Adapt to standard EvidenceRecord
        evidence = EvidenceRecord(
            module="whisper_representation",
            evidence_type=EvidenceType.EMBEDDING,
            raw_output=raw_metrics,
            synthetic_score=None,  # No pseudo-probability; representation features only
            score_direction=ScoreDirection.NOT_APPLICABLE,
            quality_score=round(min(1.0, duration_sec / 1.0), 3),
            quality_metadata={
                "duration_sec": round(duration_sec, 3),
                "effective_frames": int(effective_frames),
            },
            calibration_status=CalibrationStatus.NOT_APPLICABLE,
            metadata={
                "model_id": self.model_id,
                "hidden_dim": int(active_states.shape[1]),
                "temporal_flux": round(temporal_flux, 4),
                "dispersion": round(dispersion, 4),
                "norm": round(rep_norm, 4),
            },
        )

        return {
            "metrics": raw_metrics,
            "evidence_record": evidence.to_dict(),
            "mean_representation_first_10": [round(float(x), 4) for x in mean_vec[:10]],
            "_internal": {
                "mean_vector": mean_vec,
                "hidden_states": active_states,
            }
        }

    def extract_file(
        self, file_path: Union[str, Path]
    ) -> Dict[str, Any]:
        """Load audio file from disk, inspect, and extract representations."""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        info = sf.info(str(file_path))
        y, sr = sf.read(str(file_path), dtype="float32")
        if y.ndim > 1:
            y = np.mean(y, axis=1)

        result = self.extract_waveform(y, sr=sr)
        result["audio_metadata"] = {
            "file_name": file_path.name,
            "sample_rate": info.samplerate,
            "duration_seconds": round(info.duration, 3),
            "format": info.format,
        }
        return result
