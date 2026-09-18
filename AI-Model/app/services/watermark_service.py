# Audio DeepCheck - Watermark & Provenance Forensic Scanner
import math
import time
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, Union, List
import numpy as np
import soundfile as sf
import scipy.signal

from app.services.evidence_contract import (
    EvidenceRecord,
    EvidenceType,
    ProvenanceState,
    ScoreDirection,
    CalibrationStatus,
)

KNOWN_AI_METADATA_SIGNATURES = [
    "elevenlabs",
    "kokoro",
    "piper",
    "luvvoice",
    "coqui",
    "bark",
    "styletts",
    "tortoise",
    "vits",
    "hifigan",
    "diffsinger",
]


class WatermarkService:
    """
    Forensic scanner evaluating audio files for provenance metadata and frequency-domain watermarks.
    States:
        DETECTED: Definite verifiable watermark or generator signature detected.
        NOT_DETECTED: Analyzed audio and found no watermark or signature.
        NOT_APPLICABLE: Audio sample rate/bandwidth is too narrow to support watermarks (e.g. <32 kHz for ultrasonic).
        UNAVAILABLE: Scanner unable to evaluate format or file.

    CRITICAL RULE:
        Absence of a watermark does NOT mean the voice is human.
    """

    def __init__(self, ultrasonic_freq_min: float = 16000.0, ultrasonic_freq_max: float = 22000.0):
        self.ultrasonic_freq_min = ultrasonic_freq_min
        self.ultrasonic_freq_max = ultrasonic_freq_max

    def scan_container_metadata(self, file_path: Path) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Inspect container tags and raw metadata headers for known AI synthesis signatures.
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        found_tag = None
        is_detected = False
        scanned_info = {}

        try:
            info = sf.info(str(file_path))
            scanned_info = {
                "format": info.format,
                "subtype": info.subtype,
                "sample_rate": info.samplerate,
                "channels": info.channels,
            }

            # Scan raw header bytes for known ASCII signatures (first 4096 bytes and last 4096 bytes)
            with open(file_path, "rb") as f:
                header = f.read(4096).lower()
                f.seek(max(0, file_path.stat().st_size - 4096))
                footer = f.read(4096).lower()

            combined_raw = header + b" " + footer

            for sig in KNOWN_AI_METADATA_SIGNATURES:
                sig_bytes = sig.encode("ascii", errors="ignore")
                if sig_bytes in combined_raw:
                    is_detected = True
                    found_tag = sig
                    break

        except Exception as e:
            scanned_info["error"] = str(e)

        return is_detected, found_tag, scanned_info

    def scan_frequency_watermark(
        self, y: np.ndarray, sr: int
    ) -> Tuple[ProvenanceState, Dict[str, Any]]:
        """
        Inspect frequency spectrum for ultrasonic carrier tones or narrowband pilot watermarks.
        If sampling rate is <= 32 kHz, Nyquist limit is <= 16 kHz, rendering ultrasonic watermarks NOT_APPLICABLE.
        """
        if sr < 32000:
            return ProvenanceState.NOT_APPLICABLE, {
                "reason": f"Sample rate ({sr} Hz) has Nyquist ({sr/2} Hz) below ultrasonic watermark band (16-22 kHz).",
                "carrier_energy_ratio": 0.0,
            }

        if len(y) < sr * 0.5:
            return ProvenanceState.NOT_APPLICABLE, {
                "reason": "Audio too short for reliable frequency watermark detection (<0.5s).",
                "carrier_energy_ratio": 0.0,
            }

        # Compute power spectrum via Welch's method
        freqs, psd = scipy.signal.welch(y, fs=sr, nperseg=min(len(y), 2048))
        ultrasonic_mask = (freqs >= self.ultrasonic_freq_min) & (freqs <= self.ultrasonic_freq_max)
        total_energy = float(np.sum(psd)) + 1e-12

        if np.sum(ultrasonic_mask) == 0:
            return ProvenanceState.NOT_APPLICABLE, {"reason": "No ultrasonic frequency bins available."}

        ultra_energy = float(np.sum(psd[ultrasonic_mask]))
        ultra_ratio = ultra_energy / total_energy

        # Check for isolated sharp spectral spike in ultrasonic band (prominence > 15 dB over local median)
        ultra_psd = psd[ultrasonic_mask]
        median_ultra = float(np.median(ultra_psd)) + 1e-12
        max_ultra = float(np.max(ultra_psd))
        spike_ratio = max_ultra / median_ultra

        if ultra_ratio > 0.05 and spike_ratio > 50.0:
            return ProvenanceState.DETECTED, {
                "watermark_type": "ultrasonic_pilot_tone",
                "ultrasonic_energy_fraction": round(ultra_ratio, 5),
                "spectral_spike_ratio": round(spike_ratio, 2),
            }

        return ProvenanceState.NOT_DETECTED, {
            "ultrasonic_energy_fraction": round(ultra_ratio, 6),
            "spectral_spike_ratio": round(spike_ratio, 2),
        }

    def scan_file(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """
        Perform full forensic provenance and watermark scan on an audio file.
        Returns a structured dictionary and an EvidenceRecord.
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        t0 = time.perf_counter()

        # 1. Metadata container scan
        meta_detected, meta_tag, container_info = self.scan_container_metadata(file_path)

        # 2. Raw audio frequency scan
        y, orig_sr = sf.read(str(file_path), dtype="float32")
        if y.ndim > 1:
            y = np.mean(y, axis=1)

        freq_state, freq_details = self.scan_frequency_watermark(y, orig_sr)

        # 3. Aggregate State
        if meta_detected:
            final_state = ProvenanceState.DETECTED
            detected_scheme = f"container_metadata_signature ({meta_tag})"
        elif freq_state == ProvenanceState.DETECTED:
            final_state = ProvenanceState.DETECTED
            detected_scheme = freq_details.get("watermark_type", "frequency_watermark")
        elif freq_state == ProvenanceState.NOT_APPLICABLE:
            final_state = ProvenanceState.NOT_APPLICABLE
            detected_scheme = None
        else:
            final_state = ProvenanceState.NOT_DETECTED
            detected_scheme = None

        elapsed = time.perf_counter() - t0

        evidence = EvidenceRecord(
            module="watermark_scanner",
            evidence_type=EvidenceType.PROVENANCE,
            raw_output={
                "provenance_state": final_state,
                "detected_scheme": detected_scheme,
                "metadata_scan": {"detected": meta_detected, "tag": meta_tag, "container": container_info},
                "frequency_scan": {"state": freq_state, "details": freq_details},
                "scan_time_sec": round(elapsed, 4),
            },
            synthetic_score=1.0 if final_state == ProvenanceState.DETECTED else None,
            score_direction=ScoreDirection.HIGHER_MEANS_SYNTHETIC,
            quality_score=1.0 if final_state != ProvenanceState.UNAVAILABLE else 0.0,
            quality_metadata={
                "sample_rate": orig_sr,
                "channels": container_info.get("channels", 1),
                "format": container_info.get("format", "unknown"),
            },
            calibration_status=CalibrationStatus.NOT_APPLICABLE,
            metadata={
                "state": final_state,
                "scheme": detected_scheme,
                "note": "Absence of watermark does not prove audio is human.",
            },
        )

        return {
            "module": "watermark_scanner",
            "provenance_state": final_state,
            "detected_scheme": detected_scheme,
            "metadata_scan": {"detected": meta_detected, "tag": meta_tag},
            "frequency_scan": {"state": freq_state, "details": freq_details},
            "evidence_record": evidence.to_dict(),
            "scan_time_sec": round(elapsed, 4),
            "forensic_rule": (
                "CRITICAL: A detected watermark verifies synthetic provenance, but absence of a "
                "watermark provides zero evidence of human speech (most AI speech contains no watermark, "
                "and telephony compression strips ultrasonic frequencies and non-standard metadata)."
            ),
        }
