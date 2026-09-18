# Audio DeepCheck - Multi-Model Batch Benchmark Runner
import gc
import json
import sys
import time
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.wav2vec_service import Wav2Vec2Detector, inspect_audio
from app.services.df_arena_service import DFArenaDetector

SAMPLES_DIR = PROJECT_ROOT / "data" / "samples"
RESULTS_FILE = PROJECT_ROOT / "data" / "benchmark_results.json"


def run_batch_benchmark():
    audio_files = sorted([
        f for f in SAMPLES_DIR.iterdir()
        if f.suffix.lower() in [".wav", ".mp3", ".ogg", ".flac"]
    ])

    if not audio_files:
        print(f"No audio files found in {SAMPLES_DIR}")
        return

    print("=" * 110)
    print(f"AUDIO DEEPCHECK — COMPREHENSIVE MULTI-SAMPLE BENCHMARK EVALUATION")
    print(f"Total Samples to Evaluate: {len(audio_files)}")
    print("=" * 110)

    # 1. Metadata Inspection
    metadata_map = {}
    for f in audio_files:
        metadata_map[f.name] = inspect_audio(f)

    # 2. Phase 1: Wav2Vec2 Batch Execution
    print("\n" + "-" * 110)
    print("PHASE 1: RUNNING WAV2VEC2 PRIMARY DETECTOR (INT8 ONNX)")
    print("-" * 110)
    t0_w2v = time.perf_counter()
    w2v_detector = Wav2Vec2Detector()
    w2v_results = {}
    for f in audio_files:
        t_f = time.perf_counter()
        res = w2v_detector.predict_file(f)
        lat = time.perf_counter() - t_f
        w2v_results[f.name] = res
        print(f"  Processed {f.name:<25} | Pred: {res['prediction'].upper():<6} | Real Prob: {res['real_probability']*100:>5.1f}% | Latency: {lat:.2f}s")
    w2v_total_time = time.perf_counter() - t0_w2v

    # Unload Wav2Vec2 and collect garbage
    del w2v_detector
    gc.collect()
    print(f"Phase 1 Complete in {w2v_total_time:.2f}s. Wav2Vec2 unloaded.")

    # 3. Phase 2: DF Arena 500M Batch Execution
    print("\n" + "-" * 110)
    print("PHASE 2: RUNNING DF ARENA 500M DETECTOR (PyTorch CPU)")
    print("-" * 110)
    t0_df = time.perf_counter()
    df_detector = DFArenaDetector(auto_load=True)
    df_results = {}
    for f in audio_files:
        t_f = time.perf_counter()
        res = df_detector.predict_file(f)
        lat = time.perf_counter() - t_f
        df_results[f.name] = res
        print(f"  Processed {f.name:<25} | Pred: {res['prediction'].upper():<8} | Spoof Prob: {res['spoof_probability']*100:>5.1f}% | Latency: {lat:.2f}s")
    df_detector.unload()
    df_total_time = time.perf_counter() - t0_df
    print(f"Phase 2 Complete in {df_total_time:.2f}s. DF Arena 500M unloaded.")

    # 4. Phase 3: Consolidated Benchmark Summary Table
    print("\n" + "=" * 110)
    print("CONSOLIDATED MULTI-MODEL BENCHMARK MATRIX")
    print("=" * 110)
    header = f"{'Sample File':<24} | {'Ground Truth':<12} | {'Dur(s)':<6} | {'Wav2Vec2 Pred':<14} | {'DF Arena Pred':<15} | {'Agreement':<18}"
    print(header)
    print("-" * 110)

    consolidated_records = []

    for f in audio_files:
        meta = metadata_map[f.name]
        w2v = w2v_results[f.name]
        df = df_results[f.name]

        # Determine ground truth from filename prefix
        if f.name.startswith("human_"):
            truth = "HUMAN"
        elif f.name.startswith("ai_"):
            truth = "AI_VOICE"
        else:
            truth = "UNKNOWN"

        # Determine agreement
        # Wav2Vec2: 'real' / 'fake'; DF Arena: 'bonafide' / 'spoof'
        w2v_is_human = (w2v["prediction"] == "real")
        df_is_human = (df["prediction"] == "bonafide")

        if w2v_is_human == df_is_human:
            agreement = "UNANIMOUS"
        else:
            agreement = "DISAGREEMENT"

        w2v_str = f"{w2v['prediction'].upper()} ({w2v['real_probability']*100:.1f}% R)"
        df_str = f"{df['prediction'].upper()} ({df['spoof_probability']*100:.1f}% Sp)"

        print(f"{f.name:<24} | {truth:<12} | {meta['duration_seconds']:>6.1f} | {w2v_str:<14} | {df_str:<15} | {agreement:<18}")

        consolidated_records.append({
            "file": f.name,
            "ground_truth": truth,
            "duration_seconds": meta["duration_seconds"],
            "sample_rate": meta["sample_rate"],
            "channels": meta["channels"],
            "format": meta["format"],
            "wav2vec2": {
                "prediction": w2v["prediction"],
                "assessment": w2v["assessment"],
                "real_probability": w2v["real_probability"],
                "fake_probability": w2v["fake_probability"],
                "logits": w2v["logits"],
                "latency_seconds": w2v.get("inference_time_seconds")
            },
            "df_arena_500m": {
                "prediction": df["prediction"],
                "assessment": df["assessment"],
                "bona_fide_score": df["bona_fide_score"],
                "spoof_score": df["spoof_score"],
                "bona_fide_probability": df["bona_fide_probability"],
                "spoof_probability": df["spoof_probability"],
                "latency_seconds": df.get("inference_time_seconds")
            },
            "agreement": agreement
        })

    print("-" * 110)
    print(f"Total Evaluation Latency: {w2v_total_time + df_total_time:.2f}s (Wav2Vec2: {w2v_total_time:.2f}s, DF Arena: {df_total_time:.2f}s)")

    # Save to JSON
    with open(RESULTS_FILE, "w", encoding="utf-8") as out_f:
        json.dump(consolidated_records, out_f, indent=2)
    print(f"\nDetailed benchmark results saved to: {RESULTS_FILE}")

    return consolidated_records


if __name__ == "__main__":
    run_batch_benchmark()
