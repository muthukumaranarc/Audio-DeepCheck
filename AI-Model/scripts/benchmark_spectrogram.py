# Audio DeepCheck - Batch Spectrogram Benchmark Runner
import json
import os
import sys
import time
import tracemalloc
from pathlib import Path
import numpy as np

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.spectrogram_service import (
    SpectrogramService,
    SpectrogramConfig,
    inspect_audio,
    load_and_preprocess_audio,
)

OUTPUT_DIR = PROJECT_ROOT / "data" / "test" / "spectrogram"
SAMPLES_DIR = PROJECT_ROOT / "data" / "samples"

BENCHMARK_FILES = [
    # Human
    {"name": "human_voice.wav", "label": "HUMAN", "desc": "Clean human studio recording"},
    {"name": "human_kennedy.ogg", "label": "HUMAN", "desc": "Historical speech (JFK Rice Stadium)"},
    {"name": "human_churchill.wav", "label": "HUMAN", "desc": "Historical radio broadcast (Churchill We Shall Fight)"},
    {"name": "human_armstrong.wav", "label": "HUMAN", "desc": "Historic transmission (Apollo 11 One Small Step)"},
    # AI
    {"name": "ai_voice.wav", "label": "AI", "desc": "Synthetic reference voice"},
    {"name": "ai_luvvoice.wav", "label": "AI", "desc": "LuvVoice neural TTS synthesis"},
    {"name": "ai_kokoro_heart0.wav", "label": "AI", "desc": "Kokoro-82M ONNX neural TTS"},
    {"name": "ai_piper_amy.mp3", "label": "AI", "desc": "Piper VITS neural TTS (Amy voice)"},
]


def run_batch_benchmark():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    config = SpectrogramConfig(sr=16000, n_fft=1024, hop_length=256, n_mels=80)
    service = SpectrogramService(config=config)

    print("=" * 110)
    print("AUDIO DEEPCHECK — SPECTROGRAM ANALYSIS BATCH BENCHMARK (8 SAMPLES)")
    print("=" * 110)
    print(f"Sampling Rate: {config.sr} Hz | FFT Window: {config.n_fft} | Hop: {config.hop_length} | Mel Bands: {config.n_mels}\n")

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
        
        # Render visual plots
        plots = service.render_plots(y=y, file_name=item["name"], output_dir=OUTPUT_DIR, sr=config.sr)
        
        elapsed = time.perf_counter() - t0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        feat = analysis["features"]
        stft_dim = analysis["stft_dimensions"]
        mel_dim = analysis["mel_dimensions"]

        record = {
            "file_name": item["name"],
            "ground_truth": item["label"],
            "description": item["desc"],
            "duration_sec": meta["duration_seconds"],
            "format": meta["format"],
            "stft_shape": f"{stft_dim['frequency_bins']}x{stft_dim['time_frames']}",
            "mel_shape": f"{mel_dim['mel_bands']}x{mel_dim['time_frames']}",
            "latency_sec": round(elapsed, 4),
            "peak_mem_mb": round(peak_mem / (1024 * 1024), 2),
            "spectral_centroid_mean": round(feat["spectral_centroid"]["mean"], 1),
            "spectral_centroid_std": round(feat["spectral_centroid"]["std"], 1),
            "spectral_bandwidth_mean": round(feat["spectral_bandwidth"]["mean"], 1),
            "spectral_rolloff_85_mean": round(feat["spectral_rolloff_85"]["mean"], 1),
            "spectral_rolloff_95_mean": round(feat["spectral_rolloff_95"]["mean"], 1),
            "spectral_flatness_mean": round(feat["spectral_flatness"]["mean"], 5),
            "zero_crossing_rate_mean": round(feat["zero_crossing_rate"]["mean"], 4),
            "spectral_contrast_mean": round(feat["spectral_contrast"]["mean"], 2),
            "rms_energy_mean": round(feat["rms_energy"]["mean"], 4),
            "harmonic_percussive_ratio": round(feat["harmonic_percussive"]["harmonic_percussive_ratio"], 3),
            "low_band_pct": round(feat["mel_band_distribution"]["low_band_energy_fraction"] * 100, 1),
            "mid_band_pct": round(feat["mel_band_distribution"]["mid_band_energy_fraction"] * 100, 1),
            "high_band_pct": round(feat["mel_band_distribution"]["high_band_energy_fraction"] * 100, 1),
            "spectral_flux_mean": round(feat["spectral_flux"]["mean"], 4),
            "plots": {k: str(v) for k, v in plots.items()},
        }
        results.append(record)

        # Also save individual JSON file
        sample_json = OUTPUT_DIR / f"{Path(item['name']).stem}_spectral_features.json"
        with open(sample_json, "w", encoding="utf-8") as jf:
            json.dump({**analysis, "audio_metadata": meta, "visual_outputs": plots}, jf, indent=2)

        print(f"[{item['label']:<5}] {item['name']:<24} | Dur: {meta['duration_seconds']:4.1f}s | Latency: {elapsed:5.3f}s | "
              f"Centroid: {feat['spectral_centroid']['mean']:6.1f}Hz | Flatness: {feat['spectral_flatness']['mean']:.5f} | "
              f"Rolloff95: {feat['spectral_rolloff_95']['mean']:6.1f}Hz | H/P: {feat['harmonic_percussive']['harmonic_percussive_ratio']:5.2f}")

    total_elapsed = time.perf_counter() - total_start_time

    # Group averages
    human_records = [r for r in results if r["ground_truth"] == "HUMAN"]
    ai_records = [r for r in results if r["ground_truth"] == "AI"]

    def avg(lst, key):
        return round(float(np.mean([r[key] for r in lst])), 3) if lst else 0.0

    group_stats = {
        "human_averages": {
            "count": len(human_records),
            "spectral_centroid_mean": avg(human_records, "spectral_centroid_mean"),
            "spectral_bandwidth_mean": avg(human_records, "spectral_bandwidth_mean"),
            "spectral_rolloff_85_mean": avg(human_records, "spectral_rolloff_85_mean"),
            "spectral_rolloff_95_mean": avg(human_records, "spectral_rolloff_95_mean"),
            "spectral_flatness_mean": avg(human_records, "spectral_flatness_mean"),
            "zero_crossing_rate_mean": avg(human_records, "zero_crossing_rate_mean"),
            "spectral_contrast_mean": avg(human_records, "spectral_contrast_mean"),
            "rms_energy_mean": avg(human_records, "rms_energy_mean"),
            "harmonic_percussive_ratio": avg(human_records, "harmonic_percussive_ratio"),
            "low_band_pct": avg(human_records, "low_band_pct"),
            "mid_band_pct": avg(human_records, "mid_band_pct"),
            "high_band_pct": avg(human_records, "high_band_pct"),
            "spectral_flux_mean": avg(human_records, "spectral_flux_mean"),
        },
        "ai_averages": {
            "count": len(ai_records),
            "spectral_centroid_mean": avg(ai_records, "spectral_centroid_mean"),
            "spectral_bandwidth_mean": avg(ai_records, "spectral_bandwidth_mean"),
            "spectral_rolloff_85_mean": avg(ai_records, "spectral_rolloff_85_mean"),
            "spectral_rolloff_95_mean": avg(ai_records, "spectral_rolloff_95_mean"),
            "spectral_flatness_mean": avg(ai_records, "spectral_flatness_mean"),
            "zero_crossing_rate_mean": avg(ai_records, "zero_crossing_rate_mean"),
            "spectral_contrast_mean": avg(ai_records, "spectral_contrast_mean"),
            "rms_energy_mean": avg(ai_records, "rms_energy_mean"),
            "harmonic_percussive_ratio": avg(ai_records, "harmonic_percussive_ratio"),
            "low_band_pct": avg(ai_records, "low_band_pct"),
            "mid_band_pct": avg(ai_records, "mid_band_pct"),
            "high_band_pct": avg(ai_records, "high_band_pct"),
            "spectral_flux_mean": avg(ai_records, "spectral_flux_mean"),
        }
    }

    consolidated = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_samples": len(results),
        "total_benchmark_time_sec": round(total_elapsed, 3),
        "group_summary": group_stats,
        "samples": results,
    }

    summary_file = OUTPUT_DIR / "benchmark_spectral_summary.json"
    with open(summary_file, "w", encoding="utf-8") as sf:
        json.dump(consolidated, sf, indent=2)

    print("\n" + "=" * 110)
    print("SPECTRAL BENCHMARK GROUP COMPARISON (HUMAN vs AI)")
    print("=" * 110)
    print(f"{'Feature Metric':<32} | {'Human Average (N=4)':<22} | {'AI Average (N=4)':<22} | {'Difference':<15}")
    print("-" * 110)
    metrics_to_show = [
        ("Spectral Centroid (Hz)", "spectral_centroid_mean"),
        ("Spectral Bandwidth (Hz)", "spectral_bandwidth_mean"),
        ("Spectral Rolloff 85% (Hz)", "spectral_rolloff_85_mean"),
        ("Spectral Rolloff 95% (Hz)", "spectral_rolloff_95_mean"),
        ("Spectral Flatness", "spectral_flatness_mean"),
        ("Zero-Crossing Rate", "zero_crossing_rate_mean"),
        ("Spectral Contrast (dB)", "spectral_contrast_mean"),
        ("RMS Energy", "rms_energy_mean"),
        ("Harmonic / Percussive Ratio", "harmonic_percussive_ratio"),
        ("Low Mel Energy Band (%)", "low_band_pct"),
        ("Mid Mel Energy Band (%)", "mid_band_pct"),
        ("High Mel Energy Band (%)", "high_band_pct"),
        ("Spectral Flux (Delta)", "spectral_flux_mean"),
    ]
    for label, key in metrics_to_show:
        h_val = group_stats["human_averages"][key]
        a_val = group_stats["ai_averages"][key]
        diff = round(a_val - h_val, 4)
        print(f"{label:<32} | {h_val:<22} | {a_val:<22} | {diff:<+15}")

    print("=" * 110)
    print(f"Summary JSON saved: {summary_file}")
    print(f"All plots and JSONs generated in: {OUTPUT_DIR}")
    print("=" * 110)


if __name__ == "__main__":
    run_batch_benchmark()
