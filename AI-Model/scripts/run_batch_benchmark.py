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
    print(f"AUDIO DEEPCHECK - COMPREHENSIVE MULTI-SAMPLE BENCHMARK EVALUATION")
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
    # Weights mirror EvidenceNormalizer.DEFAULT_WEIGHTS
    W2V_WEIGHT  = 0.55   # PRIMARY
    DF_WEIGHT   = 0.15   # SECONDARY (demoted - systematic bias on real audio)

    print("\n" + "=" * 120)
    print("CONSOLIDATED MULTI-MODEL BENCHMARK MATRIX")
    print(f"  Priority Weights -> Wav2Vec2: {W2V_WEIGHT:.0%}  |  DF Arena: {DF_WEIGHT:.0%}  (Wav2Vec2 is the primary decision model)")
    print("=" * 120)
    header = (
        f"{'Sample File':<24} | {'Truth':<10} | {'Dur(s)':<6} | "
        f"{'Wav2Vec2 (55%)':<20} | {'DF Arena (15%)':<22} | "
        f"{'Weighted Decision':<18} | {'Correct?':<8}"
    )
    print(header)
    print("-" * 120)

    consolidated_records = []
    correct_count = 0
    total_count   = 0

    for f in audio_files:
        meta = metadata_map[f.name]
        w2v  = w2v_results[f.name]
        df   = df_results[f.name]

        # -- Ground truth from filename prefix ---------------------------------
        if f.name.startswith("human_"):
            truth = "HUMAN"
        elif f.name.startswith("ai_"):
            truth = "AI_VOICE"
        else:
            truth = "UNKNOWN"

        # -- Raw probabilities --------------------------------------------------
        # Wav2Vec2 - fake_probability -> synthetic evidence
        w2v_synth_prob = float(w2v["fake_probability"])   # 1.0 = certain AI
        w2v_human_prob = float(w2v["real_probability"])   # 1.0 = certain human

        # DF Arena - spoof_probability -> synthetic evidence
        df_synth_prob  = float(df["spoof_probability"])
        df_human_prob  = float(df["bona_fide_probability"])

        # -- Weighted fusion score: +1 = AI, -1 = human ------------------------
        w2v_signed  = w2v_synth_prob - w2v_human_prob  # in [-1, +1]
        df_signed   = df_synth_prob  - df_human_prob   # in [-1, +1]

        total_w = W2V_WEIGHT + DF_WEIGHT
        fused_score = (W2V_WEIGHT * w2v_signed + DF_WEIGHT * df_signed) / total_w

        # -- Final decision -----------------------------------------------------
        if fused_score > 0.10:
            decision = "AI_VOICE"
        elif fused_score < -0.10:
            decision = "HUMAN"
        else:
            decision = "UNCERTAIN"

        # -- Agreement label ---------------------------------------------------
        w2v_is_human = (w2v["prediction"] == "real")
        df_is_human  = (df["prediction"]  == "bonafide")
        agreement    = "UNANIMOUS" if w2v_is_human == df_is_human else "DISAGREE"

        # -- Correctness -------------------------------------------------------
        if truth != "UNKNOWN":
            total_count += 1
            is_correct = (decision == truth) or (decision == "UNCERTAIN")
            correct_str = "OK" if decision == truth else ("~" if decision == "UNCERTAIN" else "XX")
            if decision == truth:
                correct_count += 1
        else:
            correct_str = "?"

        # -- Format columns ----------------------------------------------------
        w2v_col = f"{w2v['prediction'].upper()} ({w2v_human_prob*100:.1f}%H / {w2v_synth_prob*100:.1f}%AI)"
        df_col  = f"{df['prediction'].upper()} ({df_human_prob*100:.1f}%H / {df_synth_prob*100:.1f}%AI)"
        dec_col = f"{decision} [{fused_score:+.3f}]"

        print(
            f"{f.name:<24} | {truth:<10} | {meta['duration_seconds']:>6.1f} | "
            f"{w2v_col:<20} | {df_col:<22} | "
            f"{dec_col:<18} | {correct_str:<8}"
        )

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
                "latency_seconds": w2v.get("inference_time_seconds"),
            },
            "df_arena_500m": {
                "prediction": df["prediction"],
                "assessment": df["assessment"],
                "bona_fide_score": df["bona_fide_score"],
                "spoof_score": df["spoof_score"],
                "bona_fide_probability": df["bona_fide_probability"],
                "spoof_probability": df["spoof_probability"],
                "latency_seconds": df.get("inference_time_seconds"),
            },
            "weighted_fusion": {
                "fused_score": round(fused_score, 4),
                "decision": decision,
                "wav2vec2_weight": W2V_WEIGHT,
                "df_arena_weight": DF_WEIGHT,
            },
            "agreement": agreement,
            "correct": correct_str,
        })

    # -- Summary footer ---------------------------------------------------------
    print("-" * 120)
    if total_count > 0:
        accuracy = correct_count / total_count * 100
        print(f"\n  ACCURACY (exact match):  {correct_count}/{total_count}  ->  {accuracy:.1f}%")
        print(f"  Legend: OK = correct prediction   XX = wrong prediction   ~ = UNCERTAIN (neither wrong nor right)")
    print(f"\n  Total Evaluation Latency: {w2v_total_time + df_total_time:.2f}s")
    print(f"    Wav2Vec2 phase : {w2v_total_time:.2f}s")
    print(f"    DF Arena phase : {df_total_time:.2f}s")
    print(f"\n  Priority Note: Wav2Vec2 is the primary model (weight={W2V_WEIGHT}).")
    print(f"  DF Arena is secondary (weight={DF_WEIGHT}) - it has a known bias toward")
    print(f"  flagging historical/compressed recordings as synthetic.\n")

    # Save to JSON
    with open(RESULTS_FILE, "w", encoding="utf-8") as out_f:
        json.dump(consolidated_records, out_f, indent=2)
    print(f"  Detailed results saved to: {RESULTS_FILE}")

    return consolidated_records


if __name__ == "__main__":
    run_batch_benchmark()

