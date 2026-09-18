# Audio DeepCheck - Multi-Evidence Master Fusion Benchmark & Ablation Study
import gc
import json
import pickle
from dataclasses import is_dataclass, asdict
from pathlib import Path
import sys
import time
from typing import Dict, Any, List
import psutil
import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.fusion_service import FusionService, FusionConfig
from app.services.evidence_contract import EvidenceRecord

SAMPLE_DIR = PROJECT_ROOT / "data" / "samples"
OUTPUT_DIR = PROJECT_ROOT / "data" / "test" / "fusion"
CACHE_DIR = OUTPUT_DIR / "cache"
OUTPUT_FILE = OUTPUT_DIR / "benchmark_fusion_report.json"

BENCHMARK_SAMPLES = [
    {"file": "human_voice.wav", "ground_truth": "HUMAN", "desc": "Clean human studio recording"},
    {"file": "human_kennedy.ogg", "ground_truth": "HUMAN", "desc": "Historical speech (JFK)"},
    {"file": "human_churchill.wav", "ground_truth": "HUMAN", "desc": "Historical radio broadcast (Winston Churchill)"},
    {"file": "human_armstrong.wav", "ground_truth": "HUMAN", "desc": "Apollo 11 transmission (Neil Armstrong)"},
    {"file": "ai_voice.wav", "ground_truth": "AI", "desc": "ElevenLabs synthetic speech"},
    {"file": "ai_luvvoice.wav", "ground_truth": "AI", "desc": "LuvVoice neural TTS"},
    {"file": "ai_kokoro_heart0.wav", "ground_truth": "AI", "desc": "Kokoro-82M modern neural TTS"},
    {"file": "ai_piper_amy.mp3", "ground_truth": "AI", "desc": "Piper fast neural TTS"},
]

ABLATION_CONFIGS = [
    {"name": "ALL", "desc": "Full 5-evidence pipeline", "ablate": []},
    {"name": "-Wav2Vec2", "desc": "Without Wav2Vec2 classifier", "ablate": ["wav2vec2"]},
    {"name": "-DF Arena", "desc": "Without DF Arena classifier", "ablate": ["df_arena"]},
    {"name": "-Prosody", "desc": "Without Prosody/F0 analysis", "ablate": ["prosody"]},
    {"name": "-Spectrogram", "desc": "Without Spectrogram analysis", "ablate": ["spectrogram"]},
    {"name": "-Whisper", "desc": "Without Whisper representations", "ablate": ["whisper_representation"]},
]


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.floating, np.float32, np.float64)):
            return float(obj)
        if isinstance(obj, (np.integer, np.int32, np.int64)):
            return int(obj)
        if isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        if hasattr(obj, "to_dict"):
            return obj.to_dict()
        if is_dataclass(obj):
            return asdict(obj)
        return super().default(obj)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    print("================================================================================")
    print(" Audio DeepCheck — Milestone 7 Multi-Evidence Fusion Benchmark & Ablation ")
    print("================================================================================")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Total benchmark samples: {len(BENCHMARK_SAMPLES)}")
    print(f"Ablation configurations: {len(ABLATION_CONFIGS)}\n")

    sample_benchmarks = []
    sample_caches = {}

    # 1. Full Pipeline Run Across All 8 Benchmark Samples
    print("--- Phase 1: Full 5-Evidence Pipeline Evaluation ---")
    full_service = FusionService(config=FusionConfig())

    for item in BENCHMARK_SAMPLES:
        file_path = SAMPLE_DIR / item["file"]
        if not file_path.exists():
            print(f"Warning: Missing sample {item['file']}, skipping.")
            continue

        print(f"Evaluating {item['file']} ({item['ground_truth']})...", end="", flush=True)

        cache_file = CACHE_DIR / f"{Path(item['file']).stem}.pkl"
        cached_payload = None
        if cache_file.exists():
            try:
                with open(cache_file, "rb") as f_cache:
                    cached_payload = pickle.load(f_cache)
            except Exception:
                cache_file.unlink(missing_ok=True)
                cached_payload = None

        if cached_payload is not None:
            result = full_service.fuse_from_cache(cached_payload["cache"])
            sample_caches[item["file"]] = cached_payload["cache"]
            elapsed = cached_payload.get("elapsed", 0.0)
            peak_mb = cached_payload.get("peak_mb", 0.0)
            print(" (cached)", end="")
        else:
            process = psutil.Process()
            t0 = time.perf_counter()
            ram_before = process.memory_info().rss

            result = full_service.analyze_file(file_path)

            elapsed = time.perf_counter() - t0
            ram_after = process.memory_info().rss
            peak_mb = round(max(ram_before, ram_after) / (1024 * 1024), 2)
            gc.collect()

            cache = result.get("_internal_cache")
            sample_caches[item["file"]] = cache
            with open(cache_file, "wb") as f_cache:
                pickle.dump({"cache": cache, "elapsed": elapsed, "peak_mb": peak_mb}, f_cache)

        clean_result = {k: v for k, v in result.items() if k != "_internal_cache"}
        q = clean_result["quality"]
        f = clean_result["fusion"]
        c = clean_result["chunks"]

        print(f" -> Decision: [{clean_result['decision']}] | Strength: {clean_result['decision_strength']:.4f} | Synth: {f['synthetic_evidence_score']:.4f} | Conflict: {f['conflict_level']} | Latency: {elapsed:.2f}s | RAM: {peak_mb:.1f}MB")

        sample_benchmarks.append({
            "file_name": item["file"],
            "ground_truth": item["ground_truth"],
            "description": item["desc"],
            "decision": clean_result["decision"],
            "decision_strength": clean_result["decision_strength"],
            "confidence_status": clean_result["confidence_status"],
            "synthetic_evidence_score": f["synthetic_evidence_score"],
            "human_evidence_score": f["human_evidence_score"],
            "uncertainty_score": f["uncertainty_score"],
            "conflict_level": f["conflict_level"],
            "quality_score": q["score"],
            "quality_flags": q["flags"],
            "chunk_count": c["count"],
            "ai_fraction": c["ai_fraction"],
            "human_fraction": c["human_fraction"],
            "uncertain_fraction": c["uncertain_fraction"],
            "latency_sec": round(elapsed, 3),
            "peak_ram_mb": peak_mb,
            "full_result": clean_result,
        })

    # 2. Phase 2: Systematic Ablation Study Across All Samples
    print("\n--- Phase 2: Systematic Ablation Study ---")
    ablation_results = {}

    for abl in ABLATION_CONFIGS:
        abl_name = abl["name"]
        print(f"Evaluating Ablation: {abl_name} ({abl['desc']})...", end="", flush=True)
        abl_service = FusionService(config=FusionConfig(ablate_modules=abl["ablate"]))
        abl_sample_decisions = []

        for row in sample_benchmarks:
            cache = sample_caches[row["file_name"]]
            res = abl_service.fuse_from_cache(cache)
            f = res["fusion"]
            abl_sample_decisions.append({
                "file": row["file_name"],
                "ground_truth": row["ground_truth"],
                "decision": res["decision"],
                "decision_strength": res["decision_strength"],
                "synthetic_evidence_score": f["synthetic_evidence_score"],
                "conflict_level": f["conflict_level"],
                "uncertainty_score": f["uncertainty_score"],
            })

        print(" Done.")
        ablation_results[abl_name] = {
            "name": abl_name,
            "description": abl["desc"],
            "ablated_modules": abl["ablate"],
            "sample_results": abl_sample_decisions,
        }

    # Summary Table Display
    print("\n" + "=" * 115)
    print(f"{'File':<24} | {'Truth':<6} | {'Decision':<14} | {'Strength':<9} | {'Synth':<7} | {'Conflict':<9} | {'Quality':<8} | {'Chunks':<6} | {'AI %':<6} | {'Human %':<7}")
    print("-" * 115)
    for row in sample_benchmarks:
        print(f"{row['file_name']:<24} | {row['ground_truth']:<6} | {row['decision']:<14} | {row['decision_strength']:<9.4f} | {row['synthetic_evidence_score']:<7.4f} | {row['conflict_level']:<9} | {row['quality_score']:<8.4f} | {row['chunk_count']:<6} | {row['ai_fraction']*100:<5.1f}% | {row['human_fraction']*100:<6.1f}%")
    print("=" * 115)

    # Save consolidated report
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "milestone": "Milestone 7: Multi-Evidence Fusion & Master Decision Layer",
        "sample_benchmarks": sample_benchmarks,
        "ablation_study": ablation_results,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fp:
        json.dump(report, fp, indent=2, cls=NumpyEncoder)

    print(f"\nConsolidated benchmark report written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
