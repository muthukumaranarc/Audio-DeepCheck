# Audio DeepCheck - Prosody & Fundamental Frequency (F0) Evidence Service
import math
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, Union, List

import matplotlib
matplotlib.use('Agg')  # Headless backend for thread-safe CLI and server execution
import matplotlib.pyplot as plt
import numpy as np
import scipy.signal
import soundfile as sf
import librosa


@dataclass
class ProsodyConfig:
    """Configurable parameters for prosodic analysis and F0 tracking."""
    sr: int = 16000
    fmin: float = 50.0          # Minimum F0 search frequency (Hz, covers deep male voices)
    fmax: float = 500.0         # Maximum F0 search frequency (Hz, covers high female/child voices)
    frame_length: int = 2048    # Analysis window size in samples (128 ms at 16 kHz)
    hop_length: int = 256       # Hop length in samples (16 ms at 16 kHz, matches spectrogram hop)
    silence_db_threshold: float = 35.0  # dB threshold relative to max RMS for silence detection
    min_pause_sec: float = 0.100        # Minimum duration (s) to classify contiguous silence as a pause
    min_voiced_sec: float = 0.050       # Minimum duration (s) to classify contiguous voicing as a segment
    min_voiced_frames: int = 5          # Minimum valid F0 frames required for pitch feature extraction
    voicing_prob_threshold: float = 0.3 # Minimum pYIN voicing probability threshold


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


def compute_basic_stats(arr: np.ndarray, prefix: str = "") -> Dict[str, float]:
    """Compute standard summary statistics for a 1D feature array."""
    flat = np.asarray(arr, dtype=np.float64).flatten()
    flat = flat[np.isfinite(flat)]
    if len(flat) == 0:
        return {
            f"{prefix}mean": 0.0,
            f"{prefix}std": 0.0,
            f"{prefix}min": 0.0,
            f"{prefix}max": 0.0,
            f"{prefix}median": 0.0,
            f"{prefix}iqr": 0.0,
        }

    q25, q75 = np.percentile(flat, [25, 75])
    return {
        f"{prefix}mean": round(float(np.mean(flat)), 4),
        f"{prefix}std": round(float(np.std(flat)), 4),
        f"{prefix}min": round(float(np.min(flat)), 4),
        f"{prefix}max": round(float(np.max(flat)), 4),
        f"{prefix}median": round(float(np.median(flat)), 4),
        f"{prefix}iqr": round(float(q75 - q25), 4),
    }


class ProsodyService:
    """
    Extracts fundamental frequency (F0), pitch dynamics, voicing patterns,
    energy envelopes, pause dynamics, and micro-variation features from speech.
    Operates strictly as an evidence extraction layer.
    """

    def __init__(self, config: Optional[ProsodyConfig] = None):
        self.config = config or ProsodyConfig()

    def validate_audio(self, y: np.ndarray) -> np.ndarray:
        """Validate input waveform data and convert to 1D mono float32."""
        if not isinstance(y, np.ndarray):
            raise TypeError(f"Expected numpy.ndarray, got {type(y).__name__}")
        if y.size == 0:
            raise ValueError("Audio waveform cannot be empty.")
        if np.any(np.isnan(y)) or np.any(np.isinf(y)):
            raise ValueError("Audio waveform contains NaN or Inf values.")

        if y.ndim > 1:
            y = np.mean(y, axis=1)

        return y.astype(np.float32)

    def extract_f0_and_voicing(
        self, y: np.ndarray, sr: Optional[int] = None
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Track fundamental frequency (F0) using probabilistic YIN (pYIN).
        Returns:
            f0: Array of F0 values in Hz with NaN for unvoiced frames.
            voiced_flag: Boolean array indicating voiced frames.
            voiced_probs: Continuous probability of voicing per frame.
        """
        sr = sr or self.config.sr
        # If the waveform is completely flat/silent, pYIN might return all NaNs or raise warnings
        if np.max(np.abs(y)) < 1e-6 or len(y) < self.config.frame_length:
            n_frames = max(1, int(np.ceil(len(y) / self.config.hop_length)))
            return np.full(n_frames, np.nan), np.zeros(n_frames, dtype=bool), np.zeros(n_frames, dtype=np.float32)

        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=self.config.fmin,
            fmax=self.config.fmax,
            sr=sr,
            frame_length=self.config.frame_length,
            hop_length=self.config.hop_length,
            fill_na=np.nan,
        )

        # Refine voicing flag with probability threshold and range filter
        valid_mask = voiced_flag & (voiced_probs >= self.config.voicing_prob_threshold)
        valid_mask &= (f0 >= self.config.fmin) & (f0 <= self.config.fmax) & np.isfinite(f0)
        f0_clean = np.where(valid_mask, f0, np.nan)

        return f0_clean, valid_mask, voiced_probs

    def compute_rms_energy(self, y: np.ndarray) -> np.ndarray:
        """Compute short-time RMS energy frame-by-frame."""
        rms = librosa.feature.rms(
            y=y,
            frame_length=self.config.frame_length,
            hop_length=self.config.hop_length,
            center=True,
        )[0]
        return rms.astype(np.float32)

    def find_contiguous_segments(self, boolean_mask: np.ndarray) -> List[Tuple[int, int]]:
        """Find contiguous [start, end) index ranges where boolean_mask is True."""
        segments = []
        in_segment = False
        start_idx = 0
        for i, val in enumerate(boolean_mask):
            if val and not in_segment:
                in_segment = True
                start_idx = i
            elif not val and in_segment:
                in_segment = False
                segments.append((start_idx, i))
        if in_segment:
            segments.append((start_idx, len(boolean_mask)))
        return segments

    def analyze_pitch_statistics(self, f0: np.ndarray, voiced_mask: np.ndarray) -> Dict[str, float]:
        """Compute summary statistics for fundamental frequency on voiced frames."""
        valid_f0 = f0[voiced_mask & np.isfinite(f0)]
        if len(valid_f0) < self.config.min_voiced_frames:
            return {
                "f0_mean_hz": 0.0,
                "f0_median_hz": 0.0,
                "f0_std_hz": 0.0,
                "f0_min_hz": 0.0,
                "f0_max_hz": 0.0,
                "f0_range_hz": 0.0,
                "f0_iqr_hz": 0.0,
                "f0_cov": 0.0,
            }

        mean_f0 = float(np.mean(valid_f0))
        std_f0 = float(np.std(valid_f0))
        min_f0 = float(np.min(valid_f0))
        max_f0 = float(np.max(valid_f0))
        median_f0 = float(np.median(valid_f0))
        q25, q75 = np.percentile(valid_f0, [25, 75])
        cov = std_f0 / mean_f0 if mean_f0 > 1e-5 else 0.0

        return {
            "f0_mean_hz": round(mean_f0, 2),
            "f0_median_hz": round(median_f0, 2),
            "f0_std_hz": round(std_f0, 2),
            "f0_min_hz": round(min_f0, 2),
            "f0_max_hz": round(max_f0, 2),
            "f0_range_hz": round(max_f0 - min_f0, 2),
            "f0_iqr_hz": round(float(q75 - q25), 2),
            "f0_cov": round(float(cov), 4),
        }

    def analyze_pitch_dynamics(
        self, f0: np.ndarray, voiced_mask: np.ndarray, hop_sec: float
    ) -> Dict[str, float]:
        """
        Analyze pitch trajectories across contiguous voiced segments.
        Does not treat unvoiced silence as pitch zero.
        """
        segments = self.find_contiguous_segments(voiced_mask)
        frame_diffs = []
        segment_slopes = []
        rising_count = 0
        falling_count = 0

        for start, end in segments:
            seg_len = end - start
            if seg_len < 2:
                continue

            seg_f0 = f0[start:end]
            valid_vals = seg_f0[np.isfinite(seg_f0)]
            if len(valid_vals) < 2:
                continue

            # Frame-to-frame pitch differences
            diffs = np.abs(np.diff(valid_vals))
            frame_diffs.extend(diffs.tolist())

            # Linear slope (Hz / second)
            t_axis = np.arange(len(valid_vals)) * hop_sec
            if np.max(t_axis) - np.min(t_axis) > 1e-4:
                slope, _ = np.polyfit(t_axis, valid_vals, deg=1)
                segment_slopes.append(slope)
                if slope > 10.0:
                    rising_count += 1
                elif slope < -10.0:
                    falling_count += 1

        if len(frame_diffs) == 0:
            return {
                "mean_abs_f0_change_hz": 0.0,
                "median_abs_f0_change_hz": 0.0,
                "std_abs_f0_change_hz": 0.0,
                "pitch_slope_mean_hz_per_sec": 0.0,
                "rising_segments_count": 0,
                "falling_segments_count": 0,
                "local_pitch_variability": 0.0,
            }

        arr_diffs = np.array(frame_diffs, dtype=np.float64)
        mean_change = float(np.mean(arr_diffs))
        med_change = float(np.median(arr_diffs))
        std_change = float(np.std(arr_diffs))
        mean_slope = float(np.mean(segment_slopes)) if segment_slopes else 0.0

        # Local pitch variability: mean absolute change normalized by voiced F0 median
        valid_all_f0 = f0[voiced_mask & np.isfinite(f0)]
        f0_med = float(np.median(valid_all_f0)) if len(valid_all_f0) > 0 else 1.0
        local_var = mean_change / f0_med if f0_med > 1e-3 else 0.0

        return {
            "mean_abs_f0_change_hz": round(mean_change, 3),
            "median_abs_f0_change_hz": round(med_change, 3),
            "std_abs_f0_change_hz": round(std_change, 3),
            "pitch_slope_mean_hz_per_sec": round(mean_slope, 2),
            "rising_segments_count": int(rising_count),
            "falling_segments_count": int(falling_count),
            "local_pitch_variability": round(float(local_var), 4),
        }

    def analyze_voicing_features(
        self, voiced_mask: np.ndarray, hop_sec: float
    ) -> Dict[str, float]:
        """Compute voicing ratios, segment counts, durations, and transition frequency."""
        total_frames = len(voiced_mask)
        if total_frames == 0:
            return {
                "voiced_ratio": 0.0,
                "unvoiced_ratio": 1.0,
                "voiced_segment_count": 0,
                "mean_voiced_segment_duration_sec": 0.0,
                "median_voiced_segment_duration_sec": 0.0,
                "min_voiced_segment_duration_sec": 0.0,
                "max_voiced_segment_duration_sec": 0.0,
                "voicing_transition_count": 0,
            }

        voiced_frames = int(np.sum(voiced_mask))
        voiced_ratio = voiced_frames / total_frames
        unvoiced_ratio = 1.0 - voiced_ratio

        segments = self.find_contiguous_segments(voiced_mask)
        # Filter segments shorter than min_voiced_sec if applicable
        durations = [(end - start) * hop_sec for start, end in segments]
        filtered_durations = [d for d in durations if d >= self.config.min_voiced_sec]
        if not filtered_durations and durations:
            filtered_durations = durations  # Fallback to unfiltered if none meet threshold

        transitions = int(np.sum(np.diff(voiced_mask.astype(int)) != 0))

        if filtered_durations:
            mean_dur = float(np.mean(filtered_durations))
            med_dur = float(np.median(filtered_durations))
            min_dur = float(np.min(filtered_durations))
            max_dur = float(np.max(filtered_durations))
        else:
            mean_dur = med_dur = min_dur = max_dur = 0.0

        return {
            "voiced_ratio": round(float(voiced_ratio), 4),
            "unvoiced_ratio": round(float(unvoiced_ratio), 4),
            "voiced_segment_count": int(len(filtered_durations)),
            "mean_voiced_segment_duration_sec": round(mean_dur, 3),
            "median_voiced_segment_duration_sec": round(med_dur, 3),
            "min_voiced_segment_duration_sec": round(min_dur, 3),
            "max_voiced_segment_duration_sec": round(max_dur, 3),
            "voicing_transition_count": int(transitions),
        }

    def analyze_energy_dynamics(
        self, rms: np.ndarray, voiced_mask: np.ndarray
    ) -> Dict[str, float]:
        """Compute short-time RMS energy dynamics, dynamic range, and voiced/unvoiced contrast."""
        if len(rms) == 0:
            return {
                "mean_rms": 0.0,
                "median_rms": 0.0,
                "std_rms": 0.0,
                "dynamic_range_db": 0.0,
                "rms_p10": 0.0,
                "rms_p90": 0.0,
                "frame_to_frame_rms_change": 0.0,
                "voiced_unvoiced_energy_ratio": 1.0,
            }

        mean_rms = float(np.mean(rms))
        median_rms = float(np.median(rms))
        std_rms = float(np.std(rms))
        p10, p90 = np.percentile(rms, [10, 90])

        eps = 1e-7
        dynamic_range = 20.0 * math.log10((max(p90, eps)) / (max(p10, eps)))

        diffs = np.abs(np.diff(rms))
        f2f_change = float(np.mean(diffs)) if len(diffs) > 0 else 0.0

        # Voiced vs unvoiced energy ratio
        min_len = min(len(rms), len(voiced_mask))
        rms_aligned = rms[:min_len]
        v_mask_aligned = voiced_mask[:min_len]

        v_rms = rms_aligned[v_mask_aligned]
        u_rms = rms_aligned[~v_mask_aligned]

        v_mean = float(np.mean(v_rms)) if len(v_rms) > 0 else eps
        u_mean = float(np.mean(u_rms)) if len(u_rms) > 0 else eps
        vu_ratio = v_mean / max(u_mean, eps)

        return {
            "mean_rms": round(mean_rms, 5),
            "median_rms": round(median_rms, 5),
            "std_rms": round(std_rms, 5),
            "dynamic_range_db": round(float(dynamic_range), 2),
            "rms_p10": round(float(p10), 5),
            "rms_p90": round(float(p90), 5),
            "frame_to_frame_rms_change": round(f2f_change, 5),
            "voiced_unvoiced_energy_ratio": round(min(float(vu_ratio), 100.0), 3),
        }

    def analyze_pause_and_silence(
        self, rms: np.ndarray, hop_sec: float
    ) -> Tuple[Dict[str, float], np.ndarray]:
        """
        Analyze silence and pauses using an adaptive dB threshold relative to peak energy.
        Minimum pause duration distinguishes genuine pauses from brief acoustic closures.
        Returns:
            pause_features: Dict of metrics
            silence_mask: Boolean array where True indicates silence/pause
        """
        max_rms = float(np.max(rms)) if len(rms) > 0 else 0.0
        if max_rms < 1e-5:
            # Completely silent audio
            total_sec = len(rms) * hop_sec
            return {
                "silence_ratio": 1.0,
                "pause_count": 1,
                "mean_pause_duration_sec": round(total_sec, 3),
                "median_pause_duration_sec": round(total_sec, 3),
                "max_pause_duration_sec": round(total_sec, 3),
                "pause_duration_std_sec": 0.0,
                "voice_to_silence_transition_count": 0,
            }, np.ones(len(rms), dtype=bool)

        # Threshold: 35 dB below peak, bounded by minimal absolute noise floor
        thresh_linear = max_rms * (10.0 ** (-self.config.silence_db_threshold / 20.0))
        thresh_linear = max(thresh_linear, 0.003)

        silence_mask = rms < thresh_linear
        segments = self.find_contiguous_segments(silence_mask)

        # Minimum pause frames
        min_frames = max(2, int(self.config.min_pause_sec / hop_sec))
        pause_segments = [seg for seg in segments if (seg[1] - seg[0]) >= min_frames]

        total_frames = len(rms)
        pause_frames = sum(end - start for start, end in pause_segments)
        silence_ratio = pause_frames / total_frames if total_frames > 0 else 0.0

        durations = [(end - start) * hop_sec for start, end in pause_segments]
        transitions = int(np.sum(np.diff(silence_mask.astype(int)) != 0))

        if durations:
            mean_pause = float(np.mean(durations))
            med_pause = float(np.median(durations))
            max_pause = float(np.max(durations))
            std_pause = float(np.std(durations))
        else:
            mean_pause = med_pause = max_pause = std_pause = 0.0

        pause_feat = {
            "silence_ratio": round(float(silence_ratio), 4),
            "pause_count": int(len(pause_segments)),
            "mean_pause_duration_sec": round(mean_pause, 3),
            "median_pause_duration_sec": round(med_pause, 3),
            "max_pause_duration_sec": round(max_pause, 3),
            "pause_duration_std_sec": round(std_pause, 3),
            "voice_to_silence_transition_count": int(transitions),
        }
        return pause_feat, silence_mask

    def analyze_speaking_rate_proxies(
        self,
        rms: np.ndarray,
        voiced_mask: np.ndarray,
        silence_mask: np.ndarray,
        duration_sec: float,
        hop_sec: float,
    ) -> Dict[str, float]:
        """
        Extract acoustic proxies related to speech tempo and articulation rate.
        Does not perform speech-to-text; uses acoustic segmentation and energy peaks.
        """
        if duration_sec <= 0.1:
            return {
                "voiced_segments_per_sec": 0.0,
                "temporal_activity_ratio": 0.0,
                "syllable_peak_rate": 0.0,
                "pause_adjusted_activity_rate": 0.0,
            }

        # 1. Voiced segments per second
        segments = self.find_contiguous_segments(voiced_mask)
        voiced_seg_count = len(segments)
        voiced_per_sec = voiced_seg_count / duration_sec

        # 2. Temporal speech activity ratio (non-silent frames / total frames)
        min_len = min(len(rms), len(silence_mask))
        speech_frames = int(np.sum(~silence_mask[:min_len]))
        total_frames = max(1, min_len)
        activity_ratio = speech_frames / total_frames

        # 3. Syllable-like nucleus peaks via smoothed RMS envelope
        # Smooth RMS with 50 ms window
        win_size = max(3, int(0.05 / hop_sec))
        if win_size % 2 == 0:
            win_size += 1
        if len(rms) > win_size:
            smoothed_rms = scipy.signal.medfilt(rms, kernel_size=win_size)
        else:
            smoothed_rms = rms

        min_distance = max(2, int(0.12 / hop_sec))  # ~120 ms minimum distance between syllables
        prominence = max(float(np.max(smoothed_rms)) * 0.08, 0.003)
        peaks, _ = scipy.signal.find_peaks(smoothed_rms, distance=min_distance, prominence=prominence)
        syllable_peak_rate = len(peaks) / duration_sec

        # 4. Pause-adjusted activity rate: syllable peaks per active speech second
        active_sec = max(activity_ratio * duration_sec, 0.2)
        pause_adj_rate = len(peaks) / active_sec

        return {
            "voiced_segments_per_sec": round(float(voiced_per_sec), 3),
            "temporal_activity_ratio": round(float(activity_ratio), 4),
            "syllable_peak_rate": round(float(syllable_peak_rate), 3),
            "pause_adjusted_activity_rate": round(float(pause_adj_rate), 3),
        }

    def analyze_micro_variations(
        self, f0: np.ndarray, rms: np.ndarray, voiced_mask: np.ndarray
    ) -> Dict[str, float]:
        """
        Compute conservative local frame-to-frame micro-perturbations:
        - Jitter proxy: Relative frame-to-frame F0 change in contiguous voiced regions:
          jitter = mean(|f0[t+1] - f0[t]|) / mean(f0)
        - Shimmer proxy: Relative frame-to-frame RMS change in contiguous voiced regions:
          shimmer = mean(|rms[t+1] - rms[t]|) / mean(rms)
        These are acoustic perturbation proxies, not invasive medical measurements.
        """
        segments = self.find_contiguous_segments(voiced_mask)
        jitter_vals = []
        shimmer_vals = []

        min_len = min(len(f0), len(rms), len(voiced_mask))
        f0 = f0[:min_len]
        rms = rms[:min_len]

        for start, end in segments:
            if end - start < 3:
                continue

            seg_f0 = f0[start:end]
            seg_rms = rms[start:end]

            valid = np.isfinite(seg_f0) & (seg_f0 > 0)
            if np.sum(valid) < 3:
                continue

            v_f0 = seg_f0[valid]
            v_rms = seg_rms[valid]

            mean_f0 = np.mean(v_f0)
            mean_rms = np.mean(v_rms)

            if mean_f0 > 1e-3:
                f0_diffs = np.abs(np.diff(v_f0))
                jitter = float(np.mean(f0_diffs) / mean_f0)
                jitter_vals.append(jitter)

            if mean_rms > 1e-4:
                rms_diffs = np.abs(np.diff(v_rms))
                shimmer = float(np.mean(rms_diffs) / mean_rms)
                shimmer_vals.append(shimmer)

        mean_jitter = float(np.mean(jitter_vals)) if jitter_vals else 0.0
        mean_shimmer = float(np.mean(shimmer_vals)) if shimmer_vals else 0.0

        return {
            "jitter_local_proxy": round(mean_jitter, 5),
            "shimmer_local_proxy": round(mean_shimmer, 5),
        }

    def analyze_waveform(
        self, y: np.ndarray, sr: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Full prosody and F0 analysis on a preprocessed waveform.
        Returns a structured dictionary with quality metadata, features, and diagnostic notes.
        """
        sr = sr or self.config.sr
        y = self.validate_audio(y)
        hop_sec = self.config.hop_length / sr
        duration_sec = len(y) / sr

        # 1. Pitch & Voicing Tracking
        f0, voiced_mask, voiced_probs = self.extract_f0_and_voicing(y, sr=sr)
        valid_f0_count = int(np.sum(voiced_mask & np.isfinite(f0)))
        total_frames = max(1, len(f0))
        voiced_ratio = float(np.sum(voiced_mask) / total_frames)
        valid_f0_ratio = float(valid_f0_count / total_frames)

        # 2. RMS Energy
        rms = self.compute_rms_energy(y)

        # 3. Quality & Usability Assessment
        is_silent = bool(np.max(np.abs(y)) < 1e-4 or voiced_ratio < 0.02)
        usable_for_pitch = bool(valid_f0_count >= self.config.min_voiced_frames and not is_silent)

        if is_silent:
            status = "insufficient_voicing"
        elif duration_sec < 0.2:
            status = "short_audio"
        else:
            status = "ok"

        # 4. Feature Extraction
        pitch_stats = self.analyze_pitch_statistics(f0, voiced_mask)
        pitch_dynamics = self.analyze_pitch_dynamics(f0, voiced_mask, hop_sec)
        voicing_features = self.analyze_voicing_features(voiced_mask, hop_sec)
        energy_dynamics = self.analyze_energy_dynamics(rms, voiced_mask)
        pause_features, silence_mask = self.analyze_pause_and_silence(rms, hop_sec)
        rate_proxies = self.analyze_speaking_rate_proxies(
            rms, voiced_mask, silence_mask, duration_sec, hop_sec
        )
        micro_variations = self.analyze_micro_variations(f0, rms, voiced_mask)

        features = {
            **pitch_stats,
            **pitch_dynamics,
            **voicing_features,
            **energy_dynamics,
            **pause_features,
            **rate_proxies,
            **micro_variations,
        }

        # Clean all features to native Python floats/ints
        cleaned_features = {
            k: (int(v) if isinstance(v, (int, np.integer)) else float(v))
            for k, v in features.items()
        }

        return {
            "module": "prosody",
            "version": "1.0",
            "status": status,
            "analysis_quality": {
                "duration_sec": round(duration_sec, 3),
                "total_frames": int(total_frames),
                "voiced_frames": int(np.sum(voiced_mask)),
                "valid_f0_frames": int(valid_f0_count),
                "voiced_ratio": round(voiced_ratio, 4),
                "valid_f0_frame_ratio": round(valid_f0_ratio, 4),
                "usable_for_pitch_features": usable_for_pitch,
            },
            "features": cleaned_features,
            "forensic_note": (
                "Prosody features represent continuous time-domain, pitch, and energy dynamics. "
                "They provide complementary evidence for multi-evidence fusion and do not constitute "
                "a standalone classification verdict."
            ),
            # Internal arrays kept for optional diagnostic plotting
            "_internal": {
                "f0": f0,
                "voiced_mask": voiced_mask,
                "rms": rms,
                "silence_mask": silence_mask,
                "hop_sec": hop_sec,
                "sr": sr,
            }
        }

    def render_plots(
        self,
        y: np.ndarray,
        file_name: str,
        output_dir: Union[str, Path],
        sr: Optional[int] = None,
        analysis_result: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Path]:
        """
        Generate headless diagnostic plots for prosody and F0 tracking.
        Saved to output_dir:
          1. Waveform + RMS envelope
          2. F0 Pitch contour (voiced vs unvoiced)
          3. Pause / Silence segmentation
          4. Combined 4-panel prosody summary
        """
        sr = sr or self.config.sr
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        stem = Path(file_name).stem

        if analysis_result is None or "_internal" not in analysis_result:
            analysis_result = self.analyze_waveform(y, sr=sr)

        internal = analysis_result["_internal"]
        f0 = internal["f0"]
        voiced_mask = internal["voiced_mask"]
        rms = internal["rms"]
        silence_mask = internal["silence_mask"]
        hop_sec = internal["hop_sec"]

        time_axis_audio = np.arange(len(y)) / sr
        time_axis_frames = np.arange(len(f0)) * hop_sec
        time_axis_rms = np.arange(len(rms)) * hop_sec

        plot_paths = {}

        # 1. Waveform + RMS Envelope Plot
        fig, ax = plt.subplots(figsize=(10, 3.5), dpi=150)
        ax.plot(time_axis_audio, y, color="#2c3e50", alpha=0.6, linewidth=0.8, label="Waveform")
        ax.plot(time_axis_rms, rms, color="#e74c3c", linewidth=1.5, label="RMS Energy")
        ax.set_title(f"Prosody Analysis — Waveform & Energy Envelope ({file_name})", fontsize=11, fontweight="bold")
        ax.set_xlabel("Time (seconds)")
        ax.set_ylabel("Amplitude / RMS")
        ax.set_xlim(0, max(time_axis_audio[-1], 0.1))
        ax.legend(loc="upper right")
        ax.grid(True, linestyle="--", alpha=0.5)
        plt.tight_layout()
        wf_path = output_dir / f"{stem}_waveform_energy.png"
        fig.savefig(wf_path)
        plt.close(fig)
        plot_paths["waveform_energy"] = wf_path

        # 2. F0 Pitch Contour Plot
        fig, ax = plt.subplots(figsize=(10, 3.5), dpi=150)
        # Highlight voiced regions
        v_f0 = np.where(voiced_mask, f0, np.nan)
        ax.scatter(time_axis_frames, v_f0, color="#2980b9", s=10, alpha=0.8, label="Voiced F0 (Hz)")
        ax.set_title(f"Prosody Analysis — Pitch (F0) Contour ({file_name})", fontsize=11, fontweight="bold")
        ax.set_xlabel("Time (seconds)")
        ax.set_ylabel("Frequency (Hz)")
        ax.set_ylim(0, min(self.config.fmax + 50, 550))
        ax.set_xlim(0, max(time_axis_frames[-1], 0.1))
        ax.legend(loc="upper right")
        ax.grid(True, linestyle="--", alpha=0.5)
        plt.tight_layout()
        f0_path = output_dir / f"{stem}_f0_contour.png"
        fig.savefig(f0_path)
        plt.close(fig)
        plot_paths["f0_contour"] = f0_path

        # 3. Pause & Silence Segmentation Plot
        fig, ax = plt.subplots(figsize=(10, 3.0), dpi=150)
        min_len = min(len(time_axis_rms), len(silence_mask))
        ax.plot(time_axis_rms[:min_len], rms[:min_len], color="#34495e", linewidth=1.2, label="RMS Energy")
        ax.fill_between(
            time_axis_rms[:min_len], 0, np.max(rms),
            where=silence_mask[:min_len], color="#e67e22", alpha=0.3, label="Pause / Silence"
        )
        ax.set_title(f"Prosody Analysis — Silence & Pause Segmentation ({file_name})", fontsize=11, fontweight="bold")
        ax.set_xlabel("Time (seconds)")
        ax.set_ylabel("RMS Energy")
        ax.set_xlim(0, max(time_axis_rms[-1], 0.1))
        ax.legend(loc="upper right")
        ax.grid(True, linestyle="--", alpha=0.5)
        plt.tight_layout()
        pause_path = output_dir / f"{stem}_pause_segmentation.png"
        fig.savefig(pause_path)
        plt.close(fig)
        plot_paths["pause_segmentation"] = pause_path

        # 4. Combined 4-Panel Prosody Summary Dashboard
        fig, axes = plt.subplots(4, 1, figsize=(11, 8.5), dpi=150, sharex=True)

        # Panel 1: Waveform
        axes[0].plot(time_axis_audio, y, color="#2c3e50", alpha=0.7, linewidth=0.7)
        axes[0].set_ylabel("Waveform", fontsize=9)
        axes[0].set_title(f"Prosody Diagnostic Dashboard — {file_name}", fontsize=12, fontweight="bold")
        axes[0].grid(True, linestyle=":", alpha=0.4)

        # Panel 2: F0 Contour
        axes[1].scatter(time_axis_frames, v_f0, color="#16a085", s=8, alpha=0.85)
        axes[1].set_ylabel("F0 (Hz)", fontsize=9)
        axes[1].set_ylim(0, min(self.config.fmax + 50, 550))
        axes[1].grid(True, linestyle=":", alpha=0.4)

        # Panel 3: RMS Energy
        axes[2].plot(time_axis_rms, rms, color="#8e44ad", linewidth=1.2)
        axes[2].set_ylabel("RMS", fontsize=9)
        axes[2].grid(True, linestyle=":", alpha=0.4)

        # Panel 4: Voicing & Pause State
        state_arr = np.zeros(min_len)
        state_arr[voiced_mask[:min_len]] = 1.0     # Voiced = 1.0
        state_arr[silence_mask[:min_len]] = -1.0   # Silence = -1.0
        axes[3].plot(time_axis_frames[:min_len], state_arr, color="#d35400", linewidth=1.2)
        axes[3].set_yticks([-1, 0, 1])
        axes[3].set_yticklabels(["Pause", "Unvoiced", "Voiced"], fontsize=8)
        axes[3].set_ylabel("Acoustic State", fontsize=9)
        axes[3].set_xlabel("Time (seconds)", fontsize=10)
        axes[3].grid(True, linestyle=":", alpha=0.4)

        axes[3].set_xlim(0, max(time_axis_audio[-1], 0.1))
        plt.tight_layout()
        summary_path = output_dir / f"{stem}_prosody_summary.png"
        fig.savefig(summary_path)
        plt.close(fig)
        plot_paths["combined_summary"] = summary_path

        return plot_paths
