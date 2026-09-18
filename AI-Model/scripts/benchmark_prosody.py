# Audio DeepCheck - Batch Prosody & F0 Benchmark Runner
import json
import sys
import time
import tracemalloc
from pathlib import Path
import numpy as np

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.prosody_service import (
    ProsodyService,
    ProsodyConfig,
    inspect_audio,
    load_and_preprocess_audio,
)

OUTPUT_DIR = PROJECT_ROOT / "data" / "test" / "prosody"
SAMPLES_DIR = PROJECT_ROOT / "data" / "samples"

BENCHMARK_FILES = [
    # Human
    {"name": "human_voice.wav", "label": "HUMAN", "desc": "Clean human studio recording"},
    {"name": "human_kennedy.ogg", "label": "HUMAN", "desc": "Historical speech (JFK Rice Stadium)"},
    {"name": "human_churchill.wav", "label": "HUMAN", "desc": "Historical radio broadcast (Churchill We Shall Fight)"},
    {"name": "human_armstrong.wav", "label": "HUMAN", "desc": "Historic transmission (Apollo 11 One Small Step)"},
    # AI
    {"name": "ai_voice.wav", "label": "AI", "desc": "Synthetic reference voice (ElevenLabs clone)"},
    {"name": "ai_luvvoice.wav", "label": "AI", "desc": "LuvVoice neural TTS synthesis"},
    {"name": "ai_kokoro_heart0.wav", "label": "AI", "desc": "Kokoro-82M ONNX neural TTS"},
    {"name": "ai_piper_amy.mp3", "label": "AI", "desc": "Piper VITS neural TTS (Amy voice)"},
]


def run_batch_benchmark(generate_plots: bool = True):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    config = ProsodyConfig(sr=16000, fmin=50.0, fmax=500.0, hop_length=256, frame_length=2048)
    service = ProsodyService(config=config)

    print("=" * 115)
    print("AUDIO DEEPCHECK — PROSODY & F0 BATCH BENCHMARK (8 SAMPLES)")
    print("=" * 115)
    print(f"Sampling Rate: {config.sr} Hz | F0 Range: {config.fmin}–{config.fmax} Hz | Frame: {config.frame_length} | Hop: {config.hop_length}\n")

    results = []
    total_start_time = time.perf_counter()

    for item in BENCHMARK_FILES:
        filepath = SAMPLES_DIR / item["name"]
        if not filepath.exists():
            print(f"[WARN] File not found: {filepath}")
            continue

        meta = inspect_audio(filepath)

        tracemalloc.start()
        t0 = time.perf_counter()

        y, _ = load_and_preprocess_audio(filepath, target_sr=config.sr)
        analysis = service.analyze_waveform(y, sr=config.sr)

        plots = {}
        if generate_plots:
            plots = service.render_plots(
                y=y,
                file_name=item["name"],
                output_dir=OUTPUT_DIR,
                sr=config.sr,
                analysis_result=analysis,
            )

        elapsed = time.perf_counter() - t0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        # Remove non-serializable internal arrays
        analysis.pop("_internal", None)
        feat = analysis["features"]
        qual = analysis["analysis_quality"]

        record = {
            "file_name": item["name"],
            "ground_truth": item["label"],
            "description": item["desc"],
            "duration_sec": meta["duration_seconds"],
            "format": meta["format"],
            "latency_sec": round(elapsed, 3),
            "peak_mem_mb": round(peak_mem / (1024 * 1024), 2),
            "status": analysis["status"],
            "usable_for_pitch": qual["usable_for_pitch_features"],
            "voiced_ratio": qual["voiced_ratio"],
            "valid_f0_ratio": qual["valid_f0_frame_ratio"],
            "f0_mean_hz": feat["f0_mean_hz"],
            "f0_median_hz": feat["f0_median_hz"],
            "f0_std_hz": feat["f0_std_hz"],
            "f0_range_hz": feat["f0_range_hz"],
            "f0_cov": feat["f0_cov"],
            "pitch_variation_local": feat["local_pitch_variability"],
            "mean_abs_f0_change_hz": feat["mean_abs_f0_change_hz"],
            "voiced_segment_count": feat["voiced_segment_count"],
            "mean_voiced_segment_duration_sec": feat["mean_voiced_segment_duration_sec"],
            "silence_ratio": feat["silence_ratio"],
            "pause_count": feat["pause_count"],
            "mean_pause_duration_sec": feat["mean_pause_duration_sec"],
            "mean_rms": feat["mean_rms"],
            "std_rms": feat["std_rms"],
            "dynamic_range_db": feat["dynamic_range_db"],
            "rate_proxy_syllable_peaks_per_sec": feat["syllable_peak_rate"],
            "voiced_segments_per_sec": feat["voiced_segments_per_sec"],
            "jitter_local_proxy": feat["jitter_local_proxy"],
            "shimmer_local_proxy": feat["shimmer_local_proxy"],
            "plots": {k: str(v) for k, v in plots.items()},
        }
        results.append(record)

        # Save individual JSON
        sample_json = OUTPUT_DIR / f"{Path(item['name']).stem}_prosody_features.json"
        with open(sample_json, "w", encoding="utf-8") as jf:
            json.dump({**analysis, "audio_metadata": meta, "visual_outputs": {k: str(v) for k, v in plots.items()}}, jf, indent=2)

        print(f"[{item['label']:<5}] {item['name']:<24} | Dur: {meta['duration_seconds']:4.1f}s | Latency: {elapsed:5.2f}s | "
              f"Voiced: {qual['voiced_ratio']*100:4.1f}% | F0 Mean: {feat['f0_mean_hz']:5.1f}Hz | F0 Std: {feat['f0_std_hz']:4.1f}Hz | "
              f"Pause: {feat['silence_ratio']*100:4.1f}% | Rate: {feat['syllable_peak_rate']:4.1f}p/s | Jitter: {feat['jitter_local_proxy']:.5f}")

    total_elapsed = time.perf_counter() - total_start_time

    # Group statistics
    human_records = [r for r in results if r["ground_truth"] == "HUMAN"]
    ai_records = [r for r in results if r["ground_truth"] == "AI"]

    def avg(lst, key):
        vals = [r[key] for r in lst if r.get("usable_for_pitch", True) or "f0" not in key]
        return round(float(np.mean(vals)), 3) if vals else 0.0

    def med(lst, key):
        vals = [r[key] for r in lst if r.get("usable_for_pitch", True) or "f0" not in key]
        return round(float(np.median(vals)), 3) if vals else 0.0

    metrics = [
        "voiced_ratio", "valid_f0_ratio", "f0_mean_hz", "f0_median_hz", "f0_std_hz",
        "f0_range_hz", "f0_cov", "pitch_variation_local", "mean_abs_f0_change_hz",
        "voiced_segment_count", "mean_voiced_segment_duration_sec", "silence_ratio",
        "pause_count", "mean_pause_duration_sec", "mean_rms", "std_rms",
        "dynamic_range_db", "rate_proxy_syllable_peaks_per_sec", "voiced_segments_per_sec",
        "jitter_local_proxy", "shimmer_local_proxy"
    ]

    group_stats = {
        "human_stats": {
            "count": len(human_records),
            "means": {m: avg(human_records, m) for m in metrics},
            "medians": {m: med(human_records, m) for m in metrics},
        },
        "ai_stats": {
            "count": len(ai_records),
            "means": {m: avg(ai_records, m) for m in metrics},
            "medians": {m: med(ai_records, m) for m in metrics},
        }
    }

    consolidated = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_samples": len(results),
        "total_benchmark_time_sec": round(total_elapsed, 3),
        "group_summary": group_stats,
        "samples": results,
    }

    summary_file = OUTPUT_DIR / "benchmark_prosody_summary.json"
    with open(summary_file, "w", encoding="utf-8") as sf:
        json.dump(consolidated, sf, indent=2)

    print("\n" + "=" * 115)
    print("PROSODIC BENCHMARK GROUP COMPARISON (HUMAN vs AI)")
    print("=" * 115)
    print(f"{'Feature Metric':<35} | {'Human Mean':<16} | {'AI Mean':<16} | {'Difference (AI-Human)':<22} | {'Forensic Context':<20}")
    print("-" * 115)

    display_metrics = [
        ("Voiced Ratio", "voiced_ratio", "Temporal voicing presence"),
        ("Valid F0 Ratio", "valid_f0_ratio", "Pitch stability ratio"),
        ("F0 Mean (Hz)", "f0_mean_hz", "Speaker pitch level"),
        ("F0 Std (Hz)", "f0_std_hz", "Pitch dispersion / spread"),
        ("F0 Range (Hz)", "f0_range_hz", "Max - Min pitch span"),
        ("F0 Coeff of Variation (cov)", "f0_cov", "Normalized pitch variability"),
        ("Pitch Local Variability", "pitch_variation_local", "Normalized frame-to-frame F0 change"),
        ("Mean Abs F0 Change (Hz)", "mean_abs_f0_change_hz", "Step-to-step pitch delta"),
        ("Voiced Segment Duration (s)", "mean_voiced_segment_duration_sec", "Average continuous voicing"),
        ("Silence Ratio", "silence_ratio", "Proportion of pauses"),
        ("Pause Count", "pause_count", "Discrete acoustic pauses"),
        ("Mean Pause Duration (s)", "mean_pause_duration_sec", "Average pause length"),
        ("Dynamic Range (dB)", "dynamic_range_db", "Loudness contrast"),
        ("Syllable Peak Rate (peaks/s)", "rate_proxy_syllable_peaks_per_sec", "Acoustic articulation tempo"),
        ("Local Jitter Proxy", "jitter_local_proxy", "Short-term cycle pitch perturbation"),
        ("Local Shimmer Proxy", "shimmer_local_proxy", "Short-term cycle amplitude perturbation"),
    ]

    for label, key, context in display_metrics:
        h_val = group_stats["human_stats"]["means"][key]
        a_val = group_stats["ai_stats"]["means"][key]
        diff = round(a_val - h_val, 4)
        print(f"{label:<35} | {h_val:<16} | {a_val:<16} | {diff:<+22} | {context:<20}")

    print("=" * 115)
    print(f"Summary JSON saved: {summary_file}")
    print(f"All artifacts saved in: {OUTPUT_DIR}")
    print("=" * 115)


if __name__ == "__main__":
    run_batch_benchmark(generate_plots=True)
