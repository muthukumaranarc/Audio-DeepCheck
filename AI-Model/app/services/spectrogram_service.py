# Audio DeepCheck - Spectrogram Analysis Evidence Service
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, Union

import matplotlib
matplotlib.use('Agg')  # Headless backend for thread-safe CLI and server execution
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf
import librosa


@dataclass
class SpectrogramConfig:
    """Configurable STFT and Mel-spectrogram parameters."""
    sr: int = 16000
    n_fft: int = 1024
    hop_length: int = 256
    win_length: Optional[int] = 1024
    window: str = "hann"
    n_mels: int = 80
    fmin: float = 0.0
    fmax: Optional[float] = 8000.0


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


def load_and_preprocess_audio(
    file_path: Union[str, Path],
    target_sr: int = 16000
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Load an audio file, convert multi-channel (stereo) to mono via channel averaging,
    and resample to target sampling rate.
    """
    file_path = Path(file_path)
    metadata = inspect_audio(file_path)

    audio, sr = sf.read(str(file_path), dtype="float32")

    # Downmix multi-channel to mono
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    if len(audio) == 0:
        raise ValueError("Audio file contains zero samples.")

    # Resample to target sample rate if needed
    if sr != target_sr:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)

    return audio.astype(np.float32), metadata


def compute_stats(arr: np.ndarray, prefix: str = "") -> Dict[str, float]:
    """Compute standard summary statistics for a 1D or 2D feature array."""
    flat = np.asarray(arr).flatten()
    if len(flat) == 0 or np.all(np.isnan(flat)):
        return {
            f"{prefix}mean": 0.0,
            f"{prefix}std": 0.0,
            f"{prefix}min": 0.0,
            f"{prefix}max": 0.0,
            f"{prefix}median": 0.0,
            f"{prefix}p90": 0.0,
        }

    # Filter out NaNs and Infs if any
    valid = flat[np.isfinite(flat)]
    if len(valid) == 0:
        valid = np.zeros(1, dtype=np.float32)

    return {
        f"{prefix}mean": round(float(np.mean(valid)), 4),
        f"{prefix}std": round(float(np.std(valid)), 4),
        f"{prefix}min": round(float(np.min(valid)), 4),
        f"{prefix}max": round(float(np.max(valid)), 4),
        f"{prefix}median": round(float(np.median(valid)), 4),
        f"{prefix}p90": round(float(np.percentile(valid, 90)), 4),
    }


class SpectrogramService:
    """
    Spectrogram Analysis & Feature Extraction Service.
    Calculates STFT, Mel spectrograms, and numerical acoustic/psychoacoustic features.
    Treats spectral patterns as forensic evidence, not definitive standalone verdicts.
    """

    def __init__(self, config: Optional[SpectrogramConfig] = None):
        self.config = config or SpectrogramConfig()

    def validate_audio(self, y: np.ndarray) -> np.ndarray:
        """Validate input waveform array and convert to 1D float32."""
        if y is None or len(y) == 0:
            raise ValueError("Audio waveform cannot be empty.")
        if not np.all(np.isfinite(y)):
            raise ValueError("Audio waveform contains NaN or Inf values.")

        # If 2D (multi-channel), downmix to mono
        if y.ndim > 1:
            y = np.mean(y, axis=-1)

        return y.astype(np.float32)

    def compute_stft(self, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute Short-Time Fourier Transform (STFT).
        Returns:
            mag: Linear magnitude spectrogram (shape: [1 + n_fft/2, num_frames])
            stft_db: Decibel-scaled power spectrogram
        """
        y = self.validate_audio(y)
        stft_complex = librosa.stft(
            y,
            n_fft=self.config.n_fft,
            hop_length=self.config.hop_length,
            win_length=self.config.win_length,
            window=self.config.window,
        )
        mag = np.abs(stft_complex)
        stft_db = librosa.amplitude_to_db(mag, ref=np.max)
        return mag, stft_db

    def compute_mel(self, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute Mel Spectrogram.
        Returns:
            mel: Linear Mel-power spectrogram (shape: [n_mels, num_frames])
            mel_db: Decibel-scaled Mel-spectrogram
        """
        y = self.validate_audio(y)
        mel = librosa.feature.melspectrogram(
            y=y,
            sr=self.config.sr,
            n_fft=self.config.n_fft,
            hop_length=self.config.hop_length,
            win_length=self.config.win_length,
            window=self.config.window,
            n_mels=self.config.n_mels,
            fmin=self.config.fmin,
            fmax=self.config.fmax,
        )
        mel_db = librosa.power_to_db(mel, ref=np.max)
        return mel, mel_db

    def extract_features(self, y: np.ndarray, sr: Optional[int] = None) -> Dict[str, Any]:
        """
        Extract numerical spectral features and calculate summary statistics.
        Features computed:
          1. Spectral Centroid
          2. Spectral Bandwidth
          3. Spectral Rolloff (85% and 95%)
          4. Spectral Flatness
          5. Zero-Crossing Rate
          6. Spectral Contrast
          7. RMS Energy
          8. Harmonic / Percussive Energy Relationship
          9. Mel-Band Energy Distribution (Low, Mid, High bands)
          10. Temporal Spectral Flux
        """
        y = self.validate_audio(y)
        sr = sr or self.config.sr

        t0 = time.perf_counter()

        # 1. Linear magnitude spectrogram for feature computation
        mag, stft_db = self.compute_stft(y)
        mel, mel_db = self.compute_mel(y)

        # 1. Spectral Centroid (Hz)
        centroid = librosa.feature.spectral_centroid(S=mag, sr=sr)
        # 2. Spectral Bandwidth (Hz)
        bandwidth = librosa.feature.spectral_bandwidth(S=mag, sr=sr)
        # 3. Spectral Rolloff (85% and 95% energy frequencies)
        rolloff_85 = librosa.feature.spectral_rolloff(S=mag, sr=sr, roll_percent=0.85)
        rolloff_95 = librosa.feature.spectral_rolloff(S=mag, sr=sr, roll_percent=0.95)
        # 4. Spectral Flatness (tonality vs noise, range [0, 1])
        flatness = librosa.feature.spectral_flatness(S=mag)
        # 5. Zero-Crossing Rate (sign changes per frame)
        zcr = librosa.feature.zero_crossing_rate(y, frame_length=self.config.n_fft, hop_length=self.config.hop_length)
        # 6. Spectral Contrast (peak-to-valley energy difference across octaves)
        contrast = librosa.feature.spectral_contrast(S=mag, sr=sr, n_fft=self.config.n_fft)
        # 7. RMS Energy (frame-level signal power)
        rms = librosa.feature.rms(y=y, frame_length=self.config.n_fft, hop_length=self.config.hop_length)

        # 8. Harmonic / Percussive Energy Relationship (HPSS)
        try:
            y_harm, y_perc = librosa.effects.hpss(y)
            rms_harm = float(np.sqrt(np.mean(y_harm ** 2)))
            rms_perc = float(np.sqrt(np.mean(y_perc ** 2)))
            hpr_ratio = float(rms_harm / (rms_perc + 1e-8))
        except Exception:
            rms_harm = 0.0
            rms_perc = 0.0
            hpr_ratio = 1.0

        # 9. Mel-Band Energy Statistics (Low: 0-20, Mid: 20-50, High: 50-80 mels)
        n_mels = mel.shape[0]
        split1 = int(n_mels * 0.25)  # 0 to ~20
        split2 = int(n_mels * 0.65)  # ~20 to ~52
        mel_low = np.mean(mel[:split1, :], axis=0)
        mel_mid = np.mean(mel[split1:split2, :], axis=0)
        mel_high = np.mean(mel[split2:, :], axis=0)

        total_mel_energy = float(np.sum(mel) + 1e-8)
        low_energy_fraction = float(np.sum(mel[:split1, :]) / total_mel_energy)
        mid_energy_fraction = float(np.sum(mel[split1:split2, :]) / total_mel_energy)
        high_energy_fraction = float(np.sum(mel[split2:, :]) / total_mel_energy)

        # 10. Temporal Spectral Flux (frame-to-frame spectral difference)
        # Normalize magnitude frames to unit sum to capture spectral distribution changes
        mag_norm = mag / (np.sum(mag, axis=0, keepdims=True) + 1e-8)
        spectral_flux = np.sqrt(np.sum(np.diff(mag_norm, axis=1) ** 2, axis=0))

        extraction_latency = time.perf_counter() - t0

        features = {
            "spectral_centroid": compute_stats(centroid),
            "spectral_bandwidth": compute_stats(bandwidth),
            "spectral_rolloff_85": compute_stats(rolloff_85),
            "spectral_rolloff_95": compute_stats(rolloff_95),
            "spectral_flatness": compute_stats(flatness),
            "zero_crossing_rate": compute_stats(zcr),
            "spectral_contrast": compute_stats(contrast),
            "rms_energy": compute_stats(rms),
            "harmonic_percussive": {
                "harmonic_rms": round(rms_harm, 6),
                "percussive_rms": round(rms_perc, 6),
                "harmonic_percussive_ratio": round(hpr_ratio, 4),
            },
            "mel_band_distribution": {
                "low_band_energy_fraction": round(low_energy_fraction, 4),
                "mid_band_energy_fraction": round(mid_energy_fraction, 4),
                "high_band_energy_fraction": round(high_energy_fraction, 4),
                "low_band_stats": compute_stats(mel_low),
                "mid_band_stats": compute_stats(mel_mid),
                "high_band_stats": compute_stats(mel_high),
            },
            "spectral_flux": compute_stats(spectral_flux),
            "extraction_latency_seconds": round(extraction_latency, 4),
        }

        return features

    def analyze_waveform(self, y: np.ndarray, sr: Optional[int] = None) -> Dict[str, Any]:
        """Run full spectrogram analysis on a waveform array."""
        sr = sr or self.config.sr
        y = self.validate_audio(y)

        mag, stft_db = self.compute_stft(y)
        mel, mel_db = self.compute_mel(y)
        features = self.extract_features(y, sr)

        return {
            "component": "spectrogram_evidence_layer",
            "sample_rate": sr,
            "duration_seconds": round(len(y) / sr, 3),
            "stft_dimensions": {
                "frequency_bins": int(mag.shape[0]),
                "time_frames": int(mag.shape[1]),
                "n_fft": self.config.n_fft,
                "hop_length": self.config.hop_length,
            },
            "mel_dimensions": {
                "mel_bands": int(mel.shape[0]),
                "time_frames": int(mel.shape[1]),
                "fmin": self.config.fmin,
                "fmax": self.config.fmax,
            },
            "features": features,
            "forensic_note": (
                "Spectral features represent physical acoustic and frequency dynamics. "
                "They serve as forensic evidence and are not standalone classification verdicts."
            ),
        }

    def analyze_file(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """Load audio file, inspect properties, and run full spectrogram analysis."""
        file_path = Path(file_path).resolve()
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found at: {file_path}")

        y, metadata = load_and_preprocess_audio(file_path, target_sr=self.config.sr)
        result = self.analyze_waveform(y, sr=self.config.sr)
        result["audio_metadata"] = metadata
        return result

    def render_plots(
        self,
        y: np.ndarray,
        file_name: str,
        output_dir: Union[str, Path],
        sr: Optional[int] = None
    ) -> Dict[str, str]:
        """
        Generate and save publication-quality visual plots:
          1. Waveform plot
          2. Linear STFT Spectrogram
          3. Mel Spectrogram
          4. Combined 3-panel Summary Figure
        Returns a dictionary mapping plot keys to output file paths.
        """
        sr = sr or self.config.sr
        y = self.validate_audio(y)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        _, stft_db = self.compute_stft(y)
        _, mel_db = self.compute_mel(y)

        stem = Path(file_name).stem
        saved_paths = {}

        # 1. Waveform Plot
        plt.figure(figsize=(10, 3), dpi=120)
        time_axis = np.linspace(0, len(y) / sr, len(y))
        plt.plot(time_axis, y, color="#2b5c8f", linewidth=0.7)
        plt.title(f"Waveform — {file_name}", fontsize=11, fontweight="bold")
        plt.xlabel("Time (seconds)", fontsize=9)
        plt.ylabel("Amplitude", fontsize=9)
        plt.grid(True, linestyle="--", alpha=0.5)
        plt.tight_layout()
        waveform_path = output_dir / f"{stem}_waveform.png"
        plt.savefig(waveform_path)
        plt.close()
        saved_paths["waveform"] = str(waveform_path)

        # 2. Linear STFT Spectrogram
        plt.figure(figsize=(10, 4), dpi=120)
        librosa.display.specshow(
            stft_db,
            sr=sr,
            hop_length=self.config.hop_length,
            x_axis="time",
            y_axis="linear",
            cmap="magma",
        )
        plt.colorbar(format="%+2.0f dB", label="Energy (dB)")
        plt.title(f"Linear STFT Spectrogram — {file_name}", fontsize=11, fontweight="bold")
        plt.xlabel("Time (seconds)", fontsize=9)
        plt.ylabel("Frequency (Hz)", fontsize=9)
        plt.tight_layout()
        stft_path = output_dir / f"{stem}_linear_spectrogram.png"
        plt.savefig(stft_path)
        plt.close()
        saved_paths["linear_spectrogram"] = str(stft_path)

        # 3. Mel Spectrogram
        plt.figure(figsize=(10, 4), dpi=120)
        librosa.display.specshow(
            mel_db,
            sr=sr,
            hop_length=self.config.hop_length,
            x_axis="time",
            y_axis="mel",
            fmin=self.config.fmin,
            fmax=self.config.fmax,
            cmap="viridis",
        )
        plt.colorbar(format="%+2.0f dB", label="Mel Energy (dB)")
        plt.title(f"Mel Spectrogram (80 bands) — {file_name}", fontsize=11, fontweight="bold")
        plt.xlabel("Time (seconds)", fontsize=9)
        plt.ylabel("Mel Frequency", fontsize=9)
        plt.tight_layout()
        mel_path = output_dir / f"{stem}_mel_spectrogram.png"
        plt.savefig(mel_path)
        plt.close()
        saved_paths["mel_spectrogram"] = str(mel_path)

        # 4. Combined 3-Panel Summary Plot
        fig, axes = plt.subplots(3, 1, figsize=(11, 9), dpi=130, sharex=True)
        fig.suptitle(f"Forensic Acoustic & Spectral Evidence — {file_name}", fontsize=12, fontweight="bold")

        # Top: Waveform
        axes[0].plot(time_axis, y, color="#1f4e79", linewidth=0.6)
        axes[0].set_ylabel("Amplitude", fontsize=9)
        axes[0].set_title("Waveform (Time Domain)", fontsize=10)
        axes[0].grid(True, linestyle=":", alpha=0.6)

        # Middle: Linear STFT
        img1 = librosa.display.specshow(
            stft_db,
            sr=sr,
            hop_length=self.config.hop_length,
            x_axis="time",
            y_axis="linear",
            ax=axes[1],
            cmap="magma",
        )
        axes[1].set_ylabel("Linear Freq (Hz)", fontsize=9)
        axes[1].set_title("Linear STFT Spectrogram (Harmonic Distribution & High-Frequency Cutoff)", fontsize=10)
        fig.colorbar(img1, ax=axes[1], format="%+2.0f dB", pad=0.01)

        # Bottom: Mel Spectrogram
        img2 = librosa.display.specshow(
            mel_db,
            sr=sr,
            hop_length=self.config.hop_length,
            x_axis="time",
            y_axis="mel",
            fmin=self.config.fmin,
            fmax=self.config.fmax,
            ax=axes[2],
            cmap="viridis",
        )
        axes[2].set_ylabel("Mel Freq", fontsize=9)
        axes[2].set_title("Mel Spectrogram (Perceptual Sub-band Formant Dynamics)", fontsize=10)
        axes[2].set_xlabel("Time (seconds)", fontsize=9)
        fig.colorbar(img2, ax=axes[2], format="%+2.0f dB", pad=0.01)

        plt.tight_layout()
        summary_path = output_dir / f"{stem}_analysis_summary.png"
        plt.savefig(summary_path)
        plt.close()
        saved_paths["combined_summary"] = str(summary_path)

        return saved_paths
