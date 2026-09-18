# Audio DeepCheck - FastAPI Endpoint & Service Test Suite
import io
from pathlib import Path
from unittest.mock import patch, MagicMock
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.main import app
from app.config import MAX_DURATION_SEC, ALLOWED_EXTENSIONS
from app.api.dependencies import get_fusion_service
from app.api.schemas import AnalyzeAudioResponse, HealthResponse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DIR = PROJECT_ROOT / "data" / "samples"


def create_test_wav_bytes(duration_sec: float = 2.0, sr: int = 16000, freq: float = 440.0) -> bytes:
    """Generate in-memory WAV audio bytes for testing."""
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False, dtype=np.float32)
    y = 0.5 * np.sin(2 * np.pi * freq * t)
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    buf.seek(0)
    return buf.read()


def get_mock_fusion_result(decision: str = "HUMAN", strength: float = 0.42):
    """Generate a valid dictionary matching FusionService.analyze_file() output."""
    return {
        "decision": decision,
        "decision_strength": strength,
        "confidence_status": "PROVISIONAL",
        "quality": {
            "score": 1.0,
            "quality_score": 1.0,
            "flags": [],
            "quality_flags": [],
            "metrics": {
                "duration_sec": 2.0,
                "sample_rate": 16000,
                "rms_energy": 0.05,
                "peak_amplitude": 0.5,
                "dynamic_range_db": 30.0,
                "clipping_ratio": 0.0,
                "silence_ratio": 0.0,
                "voiced_ratio": 0.9,
                "spectral_bandwidth_hz": 1500.0,
                "spectral_rolloff_85_hz": 3000.0,
                "snr_db": 25.0,
                "zero_crossing_rate": 0.05,
                "spectral_flatness": 0.01,
            },
            "usable_for_voice_analysis": True,
        },
        "fusion": {
            "synthetic_evidence_score": 0.20,
            "human_evidence_score": 0.80,
            "uncertainty_score": 0.25,
            "conflict_level": "LOW",
            "aggregation_method": "trimmed_mean",
            "raw_aggregate_score": -0.60,
            "mean_chunk_score": -0.60,
            "median_chunk_score": -0.60,
            "score_variance": 0.0,
            "score_iqr": 0.0,
        },
        "modules": [
            {
                "module": "wav2vec2",
                "evidence_type": "classifier",
                "raw_score": 0.10,
                "normalized_score": -0.80,
                "configured_weight": 0.35,
                "quality_weight": 1.0,
                "effective_weight": 0.50,
                "contribution": -0.40,
                "status": "USED",
                "reason": "Quality passed",
                "calibration_status": "not_calibrated",
            }
        ],
        "chunks": {
            "count": 1,
            "ai_fraction": 0.0,
            "human_fraction": 1.0,
            "uncertain_fraction": 0.0,
            "chunk_details": [
                {
                    "chunk_index": 0,
                    "start_sec": 0.0,
                    "end_sec": 2.0,
                    "duration_sec": 2.0,
                    "fusion_score": -0.60,
                    "quality_score": 1.0,
                    "quality_flags": [],
                    "conflict_level": "LOW",
                    "active_modules_count": 1,
                }
            ],
        },
    }


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


class TestHealthEndpoint:
    """Verification of GET /api/v1/health."""

    def test_health_check_status_code(self, client):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert isinstance(data["active_detectors"], list)
        assert len(data["active_detectors"]) == 5
        assert data["device"] == "cpu"
        assert "concurrency_limit" in data
        assert "timestamp" in data

    def test_root_redirects_to_docs(self, client):
        response = client.get("/", follow_redirects=False)
        assert response.status_code in (302, 307)
        assert response.headers["location"] == "/docs"

    def test_openapi_schema(self, client):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert schema["info"]["title"] == "Audio DeepCheck - Voice Authenticity API"
        assert "/api/v1/health" in schema["paths"]
        assert "/api/v1/analyze" in schema["paths"]

    def test_docs_and_redoc_endpoints(self, client):
        docs_res = client.get("/docs")
        assert docs_res.status_code == 200
        redoc_res = client.get("/redoc")
        assert redoc_res.status_code == 200


class TestUploadValidationAndErrors:
    """Verification of file validation, error status codes, and edge cases."""

    def test_missing_file_payload(self, client):
        response = client.post("/api/v1/analyze")
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "VALIDATION_ERROR"
        assert "detail" in data

    def test_empty_audio_file(self, client):
        files = {"file": ("empty.wav", b"", "audio/wav")}
        response = client.post("/api/v1/analyze", files=files)
        assert response.status_code == 400
        data = response.json()
        assert "empty" in data["detail"].lower()
        assert data["error_code"] == "HTTP_400"

    def test_unsupported_file_extension(self, client):
        files = {"file": ("malicious.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")}
        response = client.post("/api/v1/analyze", files=files)
        assert response.status_code == 415
        data = response.json()
        assert "unsupported file extension" in data["detail"].lower()

    def test_corrupted_audio_file(self, client):
        files = {"file": ("corrupted.wav", b"RIFF1234WAVEfmt not real audio data", "audio/wav")}
        response = client.post("/api/v1/analyze", files=files)
        assert response.status_code == 415
        data = response.json()
        assert "audio decoding error" in data["detail"].lower()

    def test_duration_limit_exceeded(self, client):
        with patch("app.utils.file_security.MAX_DURATION_SEC", 1.0):
            wav_bytes = create_test_wav_bytes(duration_sec=2.0)
            files = {"file": ("toolong.wav", wav_bytes, "audio/wav")}
            response = client.post("/api/v1/analyze", files=files)
            assert response.status_code == 400
            data = response.json()
            assert "exceeds maximum allowed limit" in data["detail"]

    def test_file_size_limit_exceeded(self, client):
        # Set artificially tiny limit (100 bytes)
        with patch("app.utils.file_security.MAX_UPLOAD_BYTES", 100):
            wav_bytes = create_test_wav_bytes(duration_sec=1.0)
            files = {"file": ("toobig.wav", wav_bytes, "audio/wav")}
            response = client.post("/api/v1/analyze", files=files)
            assert response.status_code == 413
            data = response.json()
            assert "exceeds maximum limit" in data["detail"].lower()

    def test_invalid_parameters_hop_greater_than_chunk(self, client):
        wav_bytes = create_test_wav_bytes(duration_sec=1.0)
        files = {"file": ("test.wav", wav_bytes, "audio/wav")}
        response = client.post("/api/v1/analyze?chunk_sec=2.0&hop_sec=3.0", files=files)
        assert response.status_code == 400
        data = response.json()
        assert "hop_sec" in data["detail"]

    def test_invalid_parameters_negative_chunk_size(self, client):
        wav_bytes = create_test_wav_bytes(duration_sec=1.0)
        files = {"file": ("test.wav", wav_bytes, "audio/wav")}
        response = client.post("/api/v1/analyze?chunk_sec=-5.0", files=files)
        assert response.status_code == 422


class TestAnalyzeEndpointWithMock:
    """Verification of successful analysis, schema conformance, and lifecycle."""

    def test_analyze_success_response_structure(self, client):
        mock_service = MagicMock()
        mock_service.analyze_file.return_value = get_mock_fusion_result(decision="HUMAN", strength=0.45)

        app.dependency_overrides[get_fusion_service] = lambda: lambda **kwargs: mock_service
        try:
            wav_bytes = create_test_wav_bytes(duration_sec=2.0)
            files = {"file": ("sample.wav", wav_bytes, "audio/wav")}
            response = client.post("/api/v1/analyze", files=files)

            assert response.status_code == 200
            assert "X-Request-ID" in response.headers

            data = response.json()
            # Schema validation
            parsed = AnalyzeAudioResponse(**data)
            assert parsed.decision == "HUMAN"
            assert parsed.decision_strength == 0.45
            assert parsed.confidence_status == "PROVISIONAL"
            assert parsed.quality.score == 1.0
            assert parsed.fusion.conflict_level == "LOW"
            assert parsed.processing.filename == "sample.wav"
            assert parsed.processing.duration_sec == 2.0
            assert parsed.processing.request_id == response.headers["X-Request-ID"]
            assert len(parsed.modules) == 1
            assert parsed.chunks.count == 1
        finally:
            app.dependency_overrides.pop(get_fusion_service, None)

    def test_custom_request_id_propagation(self, client):
        mock_service = MagicMock()
        mock_service.analyze_file.return_value = get_mock_fusion_result()

        app.dependency_overrides[get_fusion_service] = lambda: lambda **kwargs: mock_service
        try:
            wav_bytes = create_test_wav_bytes(duration_sec=1.0)
            files = {"file": ("sample.wav", wav_bytes, "audio/wav")}
            custom_id = "test-custom-trace-999"
            response = client.post(
                "/api/v1/analyze",
                files=files,
                headers={"X-Request-ID": custom_id},
            )

            assert response.status_code == 200
            assert response.headers["X-Request-ID"] == custom_id
            data = response.json()
            assert data["processing"]["request_id"] == custom_id
        finally:
            app.dependency_overrides.pop(get_fusion_service, None)

    def test_temporary_file_cleanup_on_success(self, client):
        created_temp_files = []

        mock_service = MagicMock()
        def mock_analyze(file_path):
            created_temp_files.append(Path(file_path))
            assert Path(file_path).exists()
            return get_mock_fusion_result()

        mock_service.analyze_file.side_effect = mock_analyze

        app.dependency_overrides[get_fusion_service] = lambda: lambda **kwargs: mock_service
        try:
            wav_bytes = create_test_wav_bytes(duration_sec=1.0)
            files = {"file": ("test_cleanup.wav", wav_bytes, "audio/wav")}
            response = client.post("/api/v1/analyze", files=files)

            assert response.status_code == 200
            assert len(created_temp_files) == 1
            # After request completes, the temp file MUST be deleted!
            assert not created_temp_files[0].exists()
        finally:
            app.dependency_overrides.pop(get_fusion_service, None)

    def test_temporary_file_cleanup_on_pipeline_failure(self, client):
        created_temp_files = []

        mock_service = MagicMock()
        def mock_fail(file_path):
            created_temp_files.append(Path(file_path))
            assert Path(file_path).exists()
            raise RuntimeError("Simulated internal GPU/CPU engine crash")

        mock_service.analyze_file.side_effect = mock_fail

        app.dependency_overrides[get_fusion_service] = lambda: lambda **kwargs: mock_service
        try:
            wav_bytes = create_test_wav_bytes(duration_sec=1.0)
            files = {"file": ("test_fail_cleanup.wav", wav_bytes, "audio/wav")}
            response = client.post("/api/v1/analyze", files=files)

            assert response.status_code == 500
            data = response.json()
            # Verify no stack trace leaked
            assert "crash" not in data["detail"].lower()
            assert data["error_code"] == "HTTP_500"
            assert len(created_temp_files) == 1
            # Temporary file MUST be cleaned up even on failure!
            assert not created_temp_files[0].exists()
        finally:
            app.dependency_overrides.pop(get_fusion_service, None)

    def test_selective_breakdown_flags(self, client):
        mock_service = MagicMock()
        mock_service.analyze_file.return_value = get_mock_fusion_result()

        app.dependency_overrides[get_fusion_service] = lambda: lambda **kwargs: mock_service
        try:
            wav_bytes = create_test_wav_bytes(duration_sec=1.0)
            files = {"file": ("sample.wav", wav_bytes, "audio/wav")}
            response = client.post("/api/v1/analyze?return_chunks=false&return_modules=false", files=files)

            assert response.status_code == 200
            data = response.json()
            assert data["chunks"] is None
            assert data["modules"] is None
        finally:
            app.dependency_overrides.pop(get_fusion_service, None)

    def test_concurrency_guard_timeout(self, client):
        import asyncio

        async def mock_wait_for(fut, timeout):
            if asyncio.iscoroutine(fut):
                fut.close()
            raise asyncio.TimeoutError()

        with patch.object(asyncio, "wait_for", side_effect=mock_wait_for):
            wav_bytes = create_test_wav_bytes(duration_sec=1.0)
            files = {"file": ("test_busy.wav", wav_bytes, "audio/wav")}
            response = client.post("/api/v1/analyze", files=files)
            assert response.status_code == 503
            data = response.json()
            assert "capacity reached" in data["detail"].lower()
            assert data["error_code"] == "HTTP_503"


class TestRealIntegrationPipeline:
    """
    Real end-to-end integration test:
    HTTP request -> FastAPI -> Actual FusionService -> Complete JSON response
    """

    def test_real_audio_file_inference(self, client):
        sample_path = SAMPLE_DIR / "ai_voice.wav"
        if not sample_path.exists():
            pytest.skip(f"Sample audio not found: {sample_path}")

        # Ensure no mocks are active
        app.dependency_overrides.clear()

        with open(sample_path, "rb") as f_in:
            audio_bytes = f_in.read()

        files = {"file": ("ai_voice.wav", audio_bytes, "audio/wav")}
        response = client.post("/api/v1/analyze", files=files)

        assert response.status_code == 200
        data = response.json()

        # Schema & functional validation
        parsed = AnalyzeAudioResponse(**data)
        assert parsed.decision in ("AI_GENERATED", "UNCERTAIN")
        assert parsed.decision_strength >= 0.0
        assert parsed.confidence_status == "PROVISIONAL"
        assert parsed.quality.usable_for_voice_analysis is True
        assert parsed.processing.duration_sec > 0.0
        assert parsed.processing.processing_time_sec > 0.0
        assert parsed.processing.filename == "ai_voice.wav"
