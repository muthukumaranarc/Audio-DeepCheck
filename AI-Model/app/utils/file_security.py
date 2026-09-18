# Audio DeepCheck - File Security & Temporary File Lifecycle
from contextlib import asynccontextmanager
import os
from pathlib import Path
import re
import tempfile
from typing import AsyncGenerator, Tuple
from fastapi import UploadFile, HTTPException, status
import soundfile as sf

from app.config import (
    ALLOWED_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    MAX_UPLOAD_MB,
    MAX_DURATION_SEC,
)


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and injection attacks."""
    if not filename:
        return "unnamed_audio.wav"
    # Strip path separators
    clean_name = os.path.basename(filename)
    # Remove potentially dangerous characters, keep alphanumeric, underscore, hyphen, dot
    clean_name = re.sub(r"[^\w\.-]", "_", clean_name)
    return clean_name or "unnamed_audio.wav"


def validate_file_extension(filename: str) -> str:
    """Validate that the file extension is among allowed audio formats."""
    ext = Path(filename).suffix.lower()
    if not ext or ext not in ALLOWED_EXTENSIONS:
        allowed_str = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file extension '{ext}'. Allowed formats: {allowed_str}",
        )
    return ext


@asynccontextmanager
async def secure_temp_audio_file(
    upload_file: UploadFile,
) -> AsyncGenerator[Tuple[Path, str, int, float], None]:
    """
    Safely stream an UploadFile to a temporary file, enforcing size limits,
    sanitizing the filename, validating audio container format, and verifying duration limits.
    Guarantees temporary file deletion on both success and error.

    Yields:
        (temp_path, sanitized_filename, file_size_bytes, duration_sec)
    """
    raw_filename = upload_file.filename or ""
    clean_filename = sanitize_filename(raw_filename)
    extension = validate_file_extension(clean_filename)

    # Create secure cross-platform temp file
    temp_fd, temp_path_str = tempfile.mkstemp(suffix=extension, prefix="deepcheck_")
    os.close(temp_fd)
    temp_path = Path(temp_path_str)

    total_bytes = 0
    chunk_size = 64 * 1024  # 64 KB

    try:
        with open(temp_path, "wb") as f_out:
            while True:
                chunk = await upload_file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"Uploaded file size exceeds maximum limit of "
                            f"{MAX_UPLOAD_MB} MB ({MAX_UPLOAD_BYTES} bytes)."
                        ),
                    )
                f_out.write(chunk)

        if total_bytes == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty (0 bytes).",
            )

        # Inspect and validate audio file headers
        try:
            info = sf.info(str(temp_path))
            duration_sec = round(float(info.duration), 3)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Audio decoding error: file is not a valid or supported audio container ({str(e)})",
            )

        # Verify duration limits
        if duration_sec > MAX_DURATION_SEC:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Audio duration of {duration_sec:.1f}s exceeds maximum "
                    f"allowed limit of {MAX_DURATION_SEC:.1f}s."
                ),
            )

        yield temp_path, clean_filename, total_bytes, duration_sec

    finally:
        # Guaranteed cleanup: delete temporary file if it exists
        try:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
        except Exception:
            pass
