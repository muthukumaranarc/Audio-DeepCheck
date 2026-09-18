# Audio DeepCheck - Signal-Level Quality Assessment & Telephony Diagnostics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import soundfile as sf
import librosa


@dataclass
class AudioQualityReport:
    """
    Standard container for objective signal-level quality diagnostics.
    Used for quality gating across all specialist evidence modules.
    """
    quality_score: float              # 0.0 (unusable) to 1.0 (pristine)
    quality_flags: List[str]          # Triggered diagnostic warning flags
    metrics: Dict[str, float]         # Measured physical acoustic attributes
    usable_for_voice_analysis: bool   # Overall gate: does signal contain usable speech?

    def to_dict(self) -> Dict[str, Any]:
        q_score = round(float(self.quality_score), 4)
        q_flags = list(self.quality_flags)
        return {
            "score": q_score,
            "quality_score": q_score,
            "flags": q_flags,
            "quality_flags": q_flags,
            "metrics": {k: round(float(v), 4) if isinstance(v, (float, np.floating)) else v for k, v in self.metrics.items()},
            "usable_for_voice_analysis": bool(self.usable_for_voice_analysis),
        }


class QualityService:
    """
    Evaluates physical signal properties to detect corruption, silence, heavy clipping,
    low SNR, and narrowband telephony filtering.
    """

    def __init__(
        self,
        min_duration_sec: float = 0.8,
        silence_threshold_db: float = 35.0,
        clipping_threshold: float = 0.999,
        max_clipping_ratio: float = 0.01,
        min_snr_db: float = 10.0,
        narrowband_rolloff_hz: float = 3500.0,
        min_voicing_ratio: float = 0.05,
    ):
        self.min_duration_sec = min_duration_sec
        self.silence_threshold_db = silence_threshold_db
        self.clipping_threshold = clipping_threshold
        self.max_clipping_ratio = max_clipping_ratio
        self.min_snr_db = min_snr_db
        self.narrowband_rolloff_hz = narrowband_rolloff_hz
        self.min_voicing_ratio = min_voicing_ratio

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

    def assess_waveform(self, y: np.ndarray, sr: int = 16000) -> AudioQualityReport:
        """
        Compute objective quality metrics and diagnostic flags on a waveform.
        """
        y = self.validate_waveform(y)
        num_samples = len(y)
        duration_sec = num_samples / sr

        # Extreme edge case: pure silence or zero energy
        peak_amp = float(np.max(np.abs(y)))
        rms_energy = float(np.sqrt(np.mean(y ** 2)))

        if peak_amp < 1e-6 or rms_energy < 1e-6:
            return AudioQualityReport(
                quality_score=0.0,
                quality_flags=["EXCESSIVE_SILENCE", "LOW_VOICING", "LOW_SNR"],
                metrics={
                    "duration_sec": round(duration_sec, 3),
                    "sample_rate": sr,
                    "rms_energy": 0.0,
                    "peak_amplitude": 0.0,
                    "dynamic_range_db": 0.0,
                    "clipping_ratio": 0.0,
                    "silence_ratio": 1.0,
                    "voiced_ratio": 0.0,
                    "spectral_bandwidth_hz": 0.0,
                    "spectral_rolloff_85_hz": 0.0,
                    "snr_db": 0.0,
                },
                usable_for_voice_analysis=False,
            )

        # 1. Clipping detection
        clipped_samples = np.sum(np.abs(y) >= self.clipping_threshold)
        clipping_ratio = float(clipped_samples / num_samples)

        # 2. Frame-level RMS & silence analysis (frame = 25ms, hop = 10ms)
        frame_len = max(16, int(0.025 * sr))
        hop_len = max(8, int(0.010 * sr))
        num_frames = max(1, (num_samples - frame_len) // hop_len + 1)

        frame_energies = []
        for i in range(num_frames):
            start = i * hop_len
            frame = y[start : start + frame_len]
            frame_energies.append(np.mean(frame ** 2))
        frame_energies = np.array(frame_energies, dtype=np.float32)

        peak_frame_rms = float(np.sqrt(np.max(frame_energies))) if len(frame_energies) > 0 else rms_energy
        silence_thresh = peak_frame_rms * (10.0 ** (-self.silence_threshold_db / 20.0))
        frame_rms = np.sqrt(np.maximum(frame_energies, 1e-12))
        silence_frames = np.sum(frame_rms < silence_thresh)
        silence_ratio = float(silence_frames / len(frame_rms)) if len(frame_rms) > 0 else 0.0

        # Spectral flatness to distinguish stationary clean tone from stationary broadband noise
        try:
            flatness = float(np.mean(librosa.feature.spectral_flatness(y=y, n_fft=1024, hop_length=hop_len)[0]))
        except Exception:
            flatness = 0.5

        # 3. Dynamic range & SNR estimation
        sorted_energies = np.sort(frame_energies)
        n_top = max(1, int(0.20 * len(sorted_energies)))
        n_bot = max(1, int(0.10 * len(sorted_energies)))

        signal_energy_proxy = float(np.mean(sorted_energies[-n_top:]))
        noise_energy_proxy = float(np.mean(sorted_energies[:n_bot]))
        noise_energy_proxy = max(noise_energy_proxy, 1e-10)

        ratio = signal_energy_proxy / noise_energy_proxy
        if ratio < 1.5:
            # All frames have roughly identical energy.
            # If flatness is very low (tonal/harmonic), signal is a clean continuous tone -> high SNR.
            # If flatness is high (broadband), signal is stationary noise -> low SNR.
            if flatness < 0.15:
                snr_db = 40.0
            else:
                snr_db = 3.0
        else:
            raw_snr = 10.0 * np.log10(ratio)
            snr_db = float(np.clip(raw_snr, 0.0, 60.0))

        dynamic_range_db = float(np.clip(20.0 * np.log10(max(peak_amp, 1e-6) / np.sqrt(noise_energy_proxy)), 0.0, 96.0))

        # 4. Voicing proxy (zero-crossing rate + energy thresholding)
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y, frame_length=frame_len, hop_length=hop_len)[0]))
        voiced_frames_est = np.sum((frame_rms >= silence_thresh) & (frame_energies > 0.05 * np.max(frame_energies)))
        voiced_ratio = float(np.clip(voiced_frames_est / max(1, len(frame_rms)), 0.0, 1.0))

        # 5. Spectral bandwidth and roll-off
        try:
            rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85, n_fft=1024, hop_length=hop_len)[0]))
            bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr, n_fft=1024, hop_length=hop_len)[0]))
        except Exception:
            rolloff = float(sr / 2)
            bandwidth = float(sr / 4)

        # 6. Flag evaluation
        flags: List[str] = []
        score = 1.0

        if duration_sec < self.min_duration_sec:
            flags.append("LOW_DURATION")
            score -= 0.20

        if clipping_ratio > self.max_clipping_ratio:
            flags.append("HEAVY_CLIPPING")
            score -= 0.30

        if silence_ratio > 0.70:
            flags.append("EXCESSIVE_SILENCE")
            score -= 0.35

        if snr_db < 6.0:
            flags.append("HIGH_NOISE")
            score -= 0.30
        elif snr_db < self.min_snr_db:
            flags.append("LOW_SNR")
            score -= 0.15

        if rolloff < self.narrowband_rolloff_hz or sr < 16000:
            flags.append("NARROWBAND")
            score -= 0.15

        if voiced_ratio < self.min_voicing_ratio:
            flags.append("LOW_VOICING")
            score -= 0.20

        quality_score = float(np.clip(score, 0.0, 1.0))
        usable = bool(quality_score >= 0.20 and rms_energy >= 1e-5 and duration_sec >= 0.20 and silence_ratio < 0.95)

        metrics = {
            "duration_sec": round(duration_sec, 3),
            "sample_rate": int(sr),
            "rms_energy": round(rms_energy, 6),
            "peak_amplitude": round(peak_amp, 4),
            "dynamic_range_db": round(dynamic_range_db, 2),
            "clipping_ratio": round(clipping_ratio, 6),
            "silence_ratio": round(silence_ratio, 4),
            "voiced_ratio": round(voiced_ratio, 4),
            "spectral_bandwidth_hz": round(bandwidth, 2),
            "spectral_rolloff_85_hz": round(rolloff, 2),
            "snr_db": round(snr_db, 2),
            "zero_crossing_rate": round(zcr, 4),
            "spectral_flatness": round(flatness, 4),
        }

        return AudioQualityReport(
            quality_score=quality_score,
            quality_flags=flags,
            metrics=metrics,
            usable_for_voice_analysis=usable,
        )

    def assess_file(self, file_path: Union[str, Path]) -> AudioQualityReport:
        """Load an audio file and assess its quality."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file does not exist: {path}")

        y, sr = sf.read(str(path), dtype="float32")
        return self.assess_waveform(y, sr)
