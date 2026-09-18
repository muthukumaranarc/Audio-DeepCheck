# Audio DeepCheck - Milestone 8 FastAPI Performance & Overhead Benchmark
import gc
import json
from pathlib import Path
import sys
import time
import numpy as np
import psutil
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app
from app.api.dependencies import get_fusion_service
from tests.test_api import get_mock_fusion_result

SAMPLE_DIR = PROJECT_ROOT / "data" / "samples"
OUTPUT_DIR = PROJECT_ROOT / "data" / "test" / "api"
OUTPUT_FILE = OUTPUT_DIR / "benchmark_api_report.json"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = TestClient(app)
    process = psutil.Process()

    print("================================================================================")
    print(" Audio DeepCheck — Milestone 8 FastAPI REST API Performance Benchmark ")
    print("================================================================================")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    # 1. Measure GET /api/v1/health Latency
    print("\n--- Phase 1: Health Endpoint Latency (10 iterations) ---")
    health_latencies = []
    for _ in range(10):
        t0 = time.perf_counter()
        resp = client.get("/api/v1/health")
        lat = (time.perf_counter() - t0) * 1000.0  # ms
        assert resp.status_code == 200
        health_latencies.append(lat)

    avg_health_ms = round(float(np.mean(health_latencies)), 2)
    min_health_ms = round(float(np.min(health_latencies)), 2)
    max_health_ms = round(float(np.max(health_latencies)), 2)
    print(f"Health check latency: avg={avg_health_ms}ms | min={min_health_ms}ms | max={max_health_ms}ms")

    # 2. Measure Pure Framework Overhead (Mocked FusionService, 10 iterations)
    print("\n--- Phase 2: API Layer & Serialization Overhead (Mocked AI Engine) ---")
    mock_service = MagicMock = type("MockSvc", (), {
        "analyze_file": lambda self, path: get_mock_fusion_result()
    })()
    app.dependency_overrides[get_fusion_service] = lambda: lambda **kw: mock_service

    sample_file = SAMPLE_DIR / "ai_voice.wav"
    with open(sample_file, "rb") as f:
        audio_bytes = f.read()

    framework_latencies = []
    for _ in range(10):
        t0 = time.perf_counter()
        resp = client.post("/api/v1/analyze", files={"file": ("ai_voice.wav", audio_bytes, "audio/wav")})
        lat = (time.perf_counter() - t0) * 1000.0  # ms
        assert resp.status_code == 200
        framework_latencies.append(lat)

    avg_framework_ms = round(float(np.mean(framework_latencies)), 2)
    min_framework_ms = round(float(np.min(framework_latencies)), 2)
    max_framework_ms = round(float(np.max(framework_latencies)), 2)
    print(f"Pure API framework overhead (upload + validate + schema serialize):")
    print(f"  avg={avg_framework_ms}ms | min={min_framework_ms}ms | max={max_framework_ms}ms")

    # 3. Real Full Request (FastAPI -> Actual FusionService -> JSON response)
    print("\n--- Phase 3: Real End-to-End Inference Request ---")
    app.dependency_overrides.clear()
    gc.collect()

    ram_before = process.memory_info().rss
    t_start = time.perf_counter()

    real_resp = client.post("/api/v1/analyze", files={"file": ("ai_voice.wav", audio_bytes, "audio/wav")})

    total_real_sec = round(time.perf_counter() - t_start, 3)
    ram_after = process.memory_info().rss
    peak_ram_mb = round(max(ram_before, ram_after) / (1024 * 1024), 2)

    assert real_resp.status_code == 200
    res_json = real_resp.json()
    ai_inference_sec = res_json["processing"]["processing_time_sec"]
    api_overhead_sec = round(total_real_sec - ai_inference_sec, 3)

    print(f"Total HTTP Request Latency:  {total_real_sec:.3f} s")
    print(f"  -> AI Model Inference:     {ai_inference_sec:.3f} s ({ai_inference_sec/total_real_sec*100:.1f}%)")
    print(f"  -> API & Disk Overhead:    {api_overhead_sec:.3f} s ({api_overhead_sec/total_real_sec*100:.1f}%)")
    print(f"Peak RSS Memory:             {peak_ram_mb} MB")
    print(f"Master Verdict:              [{res_json['decision']}]")
    print(f"Decision Strength:           {res_json['decision_strength']:.4f} ({res_json['confidence_status']})")
    print(f"Conflict Level:              {res_json['fusion']['conflict_level']}")
    print(f"Signal Quality Score:        {res_json['quality']['score']:.4f}")

    # 4. Save consolidated benchmark report
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "milestone": "Milestone 8: FastAPI REST Service Layer",
        "health_latency_ms": {
            "avg": avg_health_ms,
            "min": min_health_ms,
            "max": max_health_ms,
        },
        "api_framework_overhead_ms": {
            "avg": avg_framework_ms,
            "min": min_framework_ms,
            "max": max_framework_ms,
        },
        "real_request_profile": {
            "audio_file": "ai_voice.wav",
            "audio_size_bytes": len(audio_bytes),
            "total_roundtrip_sec": total_real_sec,
            "ai_inference_sec": ai_inference_sec,
            "api_overhead_sec": api_overhead_sec,
            "api_overhead_pct": round(api_overhead_sec / total_real_sec * 100, 2),
            "peak_rss_mb": peak_ram_mb,
            "decision": res_json["decision"],
            "decision_strength": res_json["decision_strength"],
            "conflict_level": res_json["fusion"]["conflict_level"],
        },
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f_out:
        json.dump(report, f_out, indent=2)

    print(f"\nReport written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
