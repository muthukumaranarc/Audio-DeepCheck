# Audio DeepCheck - Application Configuration
import os
from pathlib import Path
from typing import Set

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Service metadata
APP_TITLE = "Audio DeepCheck - Voice Authenticity API"
APP_DESCRIPTION = (
    "Forensic multi-evidence voice authenticity detection API. "
    "Combines acoustic deep learning classifiers (Wav2Vec2, DF Arena 500M), "
    "spectral representations, prosodic pitch tracking, and speech representation flux. "
    "Confidence assessments are PROVISIONAL and reflect forensic evidence strength."
)
APP_VERSION = "1.0.0"
API_V1_PREFIX = "/api/v1"

# Upload and Audio Limits
MAX_UPLOAD_MB: int = int(os.getenv("AUDIO_DEEPCHECK_MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES: int = MAX_UPLOAD_MB * 1024 * 1024
MAX_DURATION_SEC: float = float(os.getenv("AUDIO_DEEPCHECK_MAX_DURATION_SEC", "180.0"))

# Hardware & Concurrency Controls
# Default to 1 for strict memory safety on 8 GB RAM CPU environments
ANALYSIS_CONCURRENCY: int = max(1, int(os.getenv("ANALYSIS_CONCURRENCY", "1")))
SEMAPHORE_TIMEOUT_SEC: float = float(os.getenv("ANALYSIS_SEMAPHORE_TIMEOUT_SEC", "30.0"))

# Allowed Audio File Extensions
ALLOWED_EXTENSIONS: Set[str] = {".wav", ".mp3", ".flac", ".ogg"}

# Allowed MIME types (includes common audio container types and octet-stream fallback)
ALLOWED_MIME_TYPES: Set[str] = {
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/flac",
    "audio/x-flac",
    "audio/ogg",
    "audio/vorbis",
    "application/ogg",
    "application/octet-stream",
}

# Network Defaults
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
