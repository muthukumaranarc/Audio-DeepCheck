# Audio DeepCheck - Multi-Model Pipeline CLI Runner
import sys
import os
import json
import time
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.wav2vec_service import Wav2Vec2Detector, inspect_audio, TARGET_SAMPLE_RATE
from app.services.df_arena_service import DFArenaDetector


def print_banner(title: str):
    print("=" * 70)
    print(title)
    print("=" * 70)


def analyze_file(audio_path: Path):
    audio_path = Path(audio_path).resolve()
    if not audio_path.exists():
        print(f"Error: Audio file not found at: {audio_path}")
        sys.exit(1)

    print_banner("AUDIO DEEPCHECK - MULTI-MODEL FORENSIC ANALYSIS")
    meta = inspect_audio(audio_path)
    print(f"  File Name:        {meta['file_name']}")
    print(f"  Sample Rate:      {meta['sample_rate']} Hz")
    print(f"  Channels:         {meta['channels']} ('Mono' if meta['channels'] == 1 else 'Stereo/Multi-channel')")
    print(f"  Duration:         {meta['duration_seconds']} seconds")
    print(f"  Sample Count:     {meta['sample_count']} frames")
    print(f"  Audio Format:     {meta['format']} ({meta['subtype']})")

    t_total_start = time.perf_counter()

    # 1. Run Wav2Vec2 Primary Detector
    print("\n" + "-" * 70)
    print("1. RUNNING WAV2VEC2 PRIMARY DETECTOR (Acoustic Artifacts)")
    print("-" * 70)
    t0 = time.perf_counter()
    w2v_detector = Wav2Vec2Detector()
    w2v_result = w2v_detector.predict_file(audio_path)
    t_w2v = time.perf_counter() - t0

    print(f"  Prediction:           {w2v_result['prediction'].upper()}")
    print(f"  Forensic Assessment:  {w2v_result['assessment']}")
    print(f"  Real Probability:     {w2v_result['real_probability']:.4f} ({w2v_result['real_probability'] * 100:.2f}%)")
    print(f"  Fake Probability:     {w2v_result['fake_probability']:.4f} ({w2v_result['fake_probability'] * 100:.2f}%)")
    print(f"  Logits (Real/Fake):   [{w2v_result['logits']['real']}, {w2v_result['logits']['fake']}]")
    print(f"  Execution Time:       {t_w2v:.4f} seconds")

    # 2. Run DF Arena 500M Anti-Spoofing Detector (Sequential Execution: release after use)
    print("\n" + "-" * 70)
    print("2. RUNNING DF ARENA 500M DETECTOR (Universal Multi-Dataset)")
    print("-" * 70)
    t0 = time.perf_counter()
    df_detector = DFArenaDetector()
    df_result = df_detector.predict_file(audio_path)
    df_detector.unload()
    t_df = time.perf_counter() - t0

    print(f"  Prediction:           {df_result['prediction'].upper()}")
    print(f"  Forensic Assessment:  {df_result['assessment']}")
    print(f"  Bona-fide Score:      {df_result['bona_fide_score']:+.4f} (raw logit index 1)")
    print(f"  Spoof Score:          {df_result['spoof_score']:+.4f} (raw logit index 0)")
    print(f"  Bona-fide Prob:       {df_result['bona_fide_probability']:.4f} ({df_result['bona_fide_probability'] * 100:.2f}%)")
    print(f"  Spoof Prob:           {df_result['spoof_probability']:.4f} ({df_result['spoof_probability'] * 100:.2f}%)")
    print(f"  Execution Time:       {t_df:.4f} seconds")

    total_time = time.perf_counter() - t_total_start

    # -- Priority-Weighted Fusion Decision -------------------------------------
    # Wav2Vec2 is PRIMARY (weight 0.55); DF Arena is SECONDARY (weight 0.15).
    # DF Arena has a known systematic bias toward flagging compressed/historical
    # human recordings as synthetic - so Wav2Vec2 dominates the final verdict.
    W2V_W = 0.55
    DF_W  = 0.15
    total_w = W2V_W + DF_W

    w2v_signed = w2v_result["fake_probability"] - w2v_result["real_probability"]
    df_signed  = df_result["spoof_probability"] - df_result["bona_fide_probability"]
    fused_score = (W2V_W * w2v_signed + DF_W * df_signed) / total_w

    if fused_score > 0.10:
        final_decision = "AI_VOICE  [SYNTHETIC]"
    elif fused_score < -0.10:
        final_decision = "HUMAN     [AUTHENTIC]"
    else:
        final_decision = "UNCERTAIN [INCONCLUSIVE]"

    # Consolidated Side-by-Side Summary
    print("\n" + "=" * 70)
    print("INDEPENDENT DETECTOR RESULTS")
    print("=" * 70)
    print(f"{'Detector':<20} | {'Prediction':<10} | {'Human %':<10} | {'AI %':<10} | {'Weight'}")
    print("-" * 70)
    print(
        f"{'Wav2Vec2 (PRIMARY)':<20} | {w2v_result['prediction'].upper():<10} | "
        f"{w2v_result['real_probability']*100:>6.1f}%    | "
        f"{w2v_result['fake_probability']*100:>6.1f}%    | {W2V_W:.0%}"
    )
    print(
        f"{'DF Arena 500M (2nd)':<20} | {df_result['prediction'].upper():<10} | "
        f"{df_result['bona_fide_probability']*100:>6.1f}%    | "
        f"{df_result['spoof_probability']*100:>6.1f}%    | {DF_W:.0%}"
    )
    print("-" * 70)
    print(f"\n  WEIGHTED FUSION SCORE : {fused_score:+.4f}  (+ = AI evidence, - = Human evidence)")
    print(f"  FINAL DECISION        : {final_decision}")
    print(f"  Pipeline Latency      : {total_time:.4f} seconds")
    print(f"\n  Note: Wav2Vec2 ({W2V_W:.0%}) leads the decision.")
    print(f"  DF Arena ({DF_W:.0%}) is secondary - it has a known bias toward flagging")
    print(f"  historical/compressed audio as synthetic.\n")


    # Structured Output Summary
    summary = {
        "file": meta["file_name"],
        "audio_properties": meta,
        "detectors": {
            "wav2vec2": {
                "prediction": w2v_result["prediction"],
                "assessment": w2v_result["assessment"],
                "real_probability": w2v_result["real_probability"],
                "fake_probability": w2v_result["fake_probability"],
                "logits": w2v_result["logits"],
                "backend": w2v_result.get("backend", "onnx_cpu")
            },
            "df_arena_500m": {
                "prediction": df_result["prediction"],
                "assessment": df_result["assessment"],
                "bona_fide_score": df_result["bona_fide_score"],
                "spoof_score": df_result["spoof_score"],
                "bona_fide_probability": df_result["bona_fide_probability"],
                "spoof_probability": df_result["spoof_probability"],
                "score_semantics": df_result["score_semantics"],
                "backend": df_result.get("backend", "pytorch_cpu")
            }
        },
        "total_latency_seconds": round(total_time, 4)
    }

    print("\n" + "=" * 70)
    print("CONSOLIDATED JSON SUMMARY")
    print("=" * 70)
    print(json.dumps(summary, indent=2))
    return summary


def show_usage():
    print_banner("AUDIO DEEPCHECK - MULTI-MODEL PIPELINE RUNNER")
    print("Usage:")
    print("  py -3.11 scripts/run_pipeline.py \"<path_to_audio_file>\"\n")
    print("Examples:")
    print("  py -3.11 scripts/run_pipeline.py data/samples/human_voice.wav")
    print("  py -3.11 scripts/run_pipeline.py data/samples/ai_voice.wav")
    print("  py -3.11 scripts/run_pipeline.py \"C:\\Users\\Muthu\\Downloads\\recording.wav\"\n")
    print("Supported Audio Formats:")
    print("  WAV, MP3, FLAC, OGG")
    print("=" * 70)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_file(Path(sys.argv[1]))
    else:
        human_sample = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
        if human_sample.exists():
            print("\nNo file specified. Running demonstration on standard human benchmark sample:\n")
            analyze_file(human_sample)
        else:
            show_usage()
