# Audio DeepCheck - DF Arena 500M Anti-Spoofing Service
import gc
import os
import time
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, Union

import numpy as np
import soundfile as sf
import scipy.signal
import torch

# Paths & environment setup
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = PROJECT_ROOT / "models" / "huggingface"
os.environ["HF_HOME"] = str(CACHE_DIR)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

DF_ARENA_MODEL_ID = "Speech-Arena-2025/DF_Arena_500M_V_1"
TARGET_SAMPLE_RATE = 16000
DF_ARENA_WINDOW_SAMPLES = 64600  # ~4.0375s at 16 kHz


def inspect_audio(file_path: Union[str, Path]) -> Dict[str, Any]:
    """Inspect an audio file and return its technical properties."""
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Audio file not found at: {file_path}")

    info = sf.info(str(file_path))
    return {
        "file_name": file_path.name,
        "sample_rate": info.samplerate,
        "channels": info.channels,
        "duration_seconds": round(info.duration, 3),
        "sample_count": info.frames,
        "format": info.format,
        "subtype": info.subtype,
    }


def pad_fixed(x: np.ndarray, max_len: int = DF_ARENA_WINDOW_SAMPLES) -> np.ndarray:
    """
    Deterministic fixed-length window padding matching DF Arena 500M specifications.
    - If len(x) >= max_len: truncate to first max_len samples.
    - If len(x) < max_len: tile/repeat until length >= max_len, then slice to max_len.
    - If len(x) == 0: raise ValueError.
    """
    x_len = x.shape[0]
    if x_len == 0:
        raise ValueError("Audio waveform is empty (zero samples).")

    if x_len >= max_len:
        return x[:max_len].astype(np.float32)

    num_repeats = int(max_len / x_len) + 1
    # np.tile on 1D array repeats along axis 0
    padded_x = np.tile(x, num_repeats)[:max_len]
    return padded_x.astype(np.float32)


def load_and_preprocess_audio(
    file_path: Union[str, Path],
    target_sr: int = TARGET_SAMPLE_RATE,
    max_len: int = DF_ARENA_WINDOW_SAMPLES
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Load an audio file, inspect metadata, convert multi-channel to mono,
    resample to 16 kHz, and apply deterministic fixed 64,600-sample padding.
    """
    file_path = Path(file_path)
    metadata = inspect_audio(file_path)

    audio, sr = sf.read(str(file_path), dtype="float32")

    # Downmix multi-channel (stereo / 5.1) to mono
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    # Resample to 16,000 Hz if needed
    if sr != target_sr:
        try:
            import librosa
            audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
        except Exception:
            try:
                # Polyphase resample with GCD reduction
                gcd = np.gcd(sr, target_sr)
                up = target_sr // gcd
                down = sr // gcd
                audio = scipy.signal.resample_poly(audio, up, down)
            except Exception:
                num_samples = int(len(audio) * target_sr / sr)
                audio = scipy.signal.resample(audio, num_samples)

    # Deterministic fixed-length windowing (tile if short, truncate if long)
    processed_audio = pad_fixed(audio, max_len=max_len)
    return processed_audio, metadata


class DFArenaDetector:
    """
    DF Arena 500M Anti-Spoofing Detector (Speech-Arena-2025/DF_Arena_500M_V_1).
    Universal anti-spoofing detector with XLS-R 300M front-end and Conformer head.
    Classes:
      index 0 -> 'spoof' (synthetic / deepfake speech)
      index 1 -> 'bonafide' (genuine human speech)
    """

    def __init__(
        self,
        model_id: str = DF_ARENA_MODEL_ID,
        cache_dir: Optional[Path] = None,
        auto_load: bool = True
    ):
        self.model_id = model_id
        self.cache_dir = Path(cache_dir) if cache_dir else CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.model = None
        self.device = "cpu"
        self.backend = "pytorch_cpu"

        if auto_load:
            self.load()

    def load(self):
        """Load the model weights into memory on CPU."""
        if self.model is not None:
            return

        from transformers import AutoModel

        # Set environment for HF cache
        os.environ["HF_HOME"] = str(self.cache_dir)
        os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

        self.model = AutoModel.from_pretrained(
            self.model_id,
            trust_remote_code=True,
            cache_dir=str(self.cache_dir)
        )
        self.model.eval()
        self.model.to(self.device)

    def unload(self):
        """Unload the model and release RAM."""
        if self.model is not None:
            del self.model
            self.model = None

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        gc.collect()

    def predict_waveform(self, waveform: np.ndarray) -> Dict[str, Any]:
        """
        Run inference on a 1D raw waveform array.
        Pads or truncates deterministically to 64,600 samples.
        """
        if waveform is None or len(waveform) == 0:
            raise ValueError("Audio waveform cannot be empty.")

        # Ensure model is loaded
        if self.model is None:
            self.load()

        # Handle 2D if passed
        if waveform.ndim > 1:
            waveform = np.mean(waveform, axis=-1)

        # Pad or truncate deterministically to 64,600 samples
        padded_waveform = pad_fixed(waveform, DF_ARENA_WINDOW_SAMPLES)

        # Convert to torch tensor: shape (64600,) as expected by backbone
        input_tensor = torch.tensor(padded_waveform, dtype=torch.float32).to(self.device)

        t_start = time.perf_counter()
        with torch.no_grad():
            outputs = self.model(input_tensor)
            logits = outputs["logits"]  # Shape: (1, 2)
            probs = torch.softmax(logits, dim=-1)[0]
        inference_time = time.perf_counter() - t_start

        # Extract raw logits and uncalibrated softmax probabilities
        # id2label: {0: 'spoof', 1: 'bonafide'}
        spoof_score = float(logits[0][0].item())
        bona_fide_score = float(logits[0][1].item())
        spoof_prob = float(probs[0].item())
        bona_fide_prob = float(probs[1].item())

        prediction = "spoof" if spoof_prob > bona_fide_prob else "bonafide"

        # Forensic assessment thresholding
        if bona_fide_prob >= 0.70:
            assessment = "LIKELY_HUMAN"
        elif spoof_prob >= 0.70:
            assessment = "LIKELY_SYNTHETIC"
        else:
            assessment = "UNCERTAIN"

        return {
            "model": "df_arena_500m",
            "backend": self.backend,
            "prediction": prediction,
            "assessment": assessment,
            "bona_fide_score": round(bona_fide_score, 4),
            "spoof_score": round(spoof_score, 4),
            "bona_fide_probability": round(bona_fide_prob, 4),
            "spoof_probability": round(spoof_prob, 4),
            "logits": {
                "spoof": round(spoof_score, 4),
                "bonafide": round(bona_fide_score, 4),
            },
            "probabilities": {
                "spoof": round(spoof_prob, 4),
                "bonafide": round(bona_fide_prob, 4),
            },
            "score_semantics": (
                "index 0 = spoof (synthetic speech), index 1 = bonafide (genuine human speech). "
                "bona_fide_score and spoof_score are raw model logits. "
                "bona_fide_probability and spoof_probability are uncalibrated softmax scores."
            ),
            "inference_time_seconds": round(inference_time, 4),
        }

    def predict_file(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """Load audio file, preprocess, and run DF Arena 500M inference."""
        file_path = Path(file_path).resolve()
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found at: {file_path}")

        waveform, metadata = load_and_preprocess_audio(file_path)
        result = self.predict_waveform(waveform)
        result["audio_metadata"] = metadata
        return result
