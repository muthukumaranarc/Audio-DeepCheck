# Audio DeepCheck - Prosody & F0 Analysis CLI Runner
import argparse
import json
import sys
import time
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.prosody_service import (
    ProsodyService,
    ProsodyConfig,
    inspect_audio,
    load_and_preprocess_audio,
)

DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "test" / "prosody"


def print_banner(title: str):
    print("=" * 80)
    print(title)
    print("=" * 80)


def analyze_file(
    audio_path: Path,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    generate_plots: bool = False,
    config: ProsodyConfig = None,
):
    audio_path = Path(audio_path).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not audio_path.exists():
        print(f"Error: Audio file not found at: {audio_path}")
        sys.exit(1)

    config = config or ProsodyConfig()
    service = ProsodyService(config=config)

    print_banner("AUDIO DEEPCHECK — PROSODY & F0 EVIDENCE LAYER")
    meta = inspect_audio(audio_path)
    print(f"  File Name:            {meta['file_name']}")
    print(f"  Source Sample Rate:   {meta['sample_rate']} Hz")
    print(f"  Source Channels:      {meta['channels']} ({'Mono' if meta['channels'] == 1 else 'Stereo/Multi-channel'})")
    print(f"  Duration:             {meta['duration_seconds']} seconds")
    print(f"  Audio Format:         {meta['format']} ({meta['subtype']})")

    print("\n" + "-" * 80)
    print("PROSODY CONFIGURATION")
    print("-" * 80)
    print(f"  Analysis Sample Rate: {config.sr} Hz")
    print(f"  F0 Pitch Search:      {config.fmin} Hz – {config.fmax} Hz")
    print(f"  Window / Frame Size:  {config.frame_length} samples ({config.frame_length / config.sr * 1000:.1f} ms)")
    print(f"  Hop Length:           {config.hop_length} samples ({config.hop_length / config.sr * 1000:.1f} ms)")
    print(f"  Silence Threshold:    {config.silence_db_threshold} dB below peak")
    print(f"  Min Pause / Voicing:  {config.min_pause_sec*1000:.0f} ms pause / {config.min_voiced_sec*1000:.0f} ms voicing")

    print("\n" + "-" * 80)
    print("EXTRACTING PROSODIC & TIME-DOMAIN ACOUSTIC FEATURES")
    print("-" * 80)

    t0 = time.perf_counter()
    y, _ = load_and_preprocess_audio(audio_path, target_sr=config.sr)
    result = service.analyze_waveform(y, sr=config.sr)
    result["audio_metadata"] = meta

    plot_paths = {}
    if generate_plots:
        plot_paths = service.render_plots(
            y=y,
            file_name=audio_path.name,
            output_dir=output_dir,
            sr=config.sr,
            analysis_result=result,
        )
        result["visual_outputs"] = {k: str(v) for k, v in plot_paths.items()}

    # Remove non-serializable internal arrays before JSON export
    internal_data = result.pop("_internal", None)
    elapsed = time.perf_counter() - t0

    qual = result["analysis_quality"]
    feat = result["features"]

    print(f"  Processing Status:    {result['status']}")
    print(f"  Extraction Latency:   {elapsed:.3f} seconds")
    print(f"  Analysis Quality:")
    print(f"    - Total Audio Frames:        {qual['total_frames']} frames")
    print(f"    - Voiced Frames Count:       {qual['voiced_frames']} ({qual['voiced_ratio']*100:.1f}%)")
    print(f"    - Valid F0 Frames Count:     {qual['valid_f0_frames']} ({qual['valid_f0_frame_ratio']*100:.1f}%)")
    print(f"    - Usable for Pitch Stats:    {qual['usable_for_pitch_features']}")

    print(f"\n  1. Fundamental Frequency (F0) Statistics:")
    print(f"    - F0 Mean ± Std:             {feat['f0_mean_hz']:.1f} ± {feat['f0_std_hz']:.1f} Hz")
    print(f"    - F0 Median:                 {feat['f0_median_hz']:.1f} Hz")
    print(f"    - F0 Range (Min – Max):      {feat['f0_range_hz']:.1f} Hz ({feat['f0_min_hz']:.1f} – {feat['f0_max_hz']:.1f} Hz)")
    print(f"    - F0 Interquartile Range:    {feat['f0_iqr_hz']:.1f} Hz")
    print(f"    - F0 Coeff of Variation:     {feat['f0_cov']:.4f}")

    print(f"\n  2. Pitch Contour Dynamics:")
    print(f"    - Frame-to-Frame Abs Change: {feat['mean_abs_f0_change_hz']:.2f} Hz (median: {feat['median_abs_f0_change_hz']:.2f} Hz)")
    print(f"    - Pitch Slope (Mean):        {feat['pitch_slope_mean_hz_per_sec']:.2f} Hz/s")
    print(f"    - Rising / Falling Segments: {feat['rising_segments_count']} rising / {feat['falling_segments_count']} falling")
    print(f"    - Local Pitch Variability:   {feat['local_pitch_variability']:.4f}")

    print(f"\n  3. Voicing & Temporal Structure:")
    print(f"    - Voiced / Unvoiced Ratio:   {feat['voiced_ratio']*100:.1f}% / {feat['unvoiced_ratio']*100:.1f}%")
    print(f"    - Voiced Segment Count:      {feat['voiced_segment_count']}")
    print(f"    - Voiced Segment Duration:   {feat['mean_voiced_segment_duration_sec']:.3f} s (median: {feat['median_voiced_segment_duration_sec']:.3f} s)")
    print(f"    - Voicing Transition Count:  {feat['voicing_transition_count']}")

    print(f"\n  4. Energy & Loudness Dynamics:")
    print(f"    - Short-Time RMS Mean ± Std: {feat['mean_rms']:.5f} ± {feat['std_rms']:.5f}")
    print(f"    - Dynamic Range (p90/p10):   {feat['dynamic_range_db']:.1f} dB")
    print(f"    - Frame-to-Frame RMS Change: {feat['frame_to_frame_rms_change']:.5f}")
    print(f"    - Voiced/Unvoiced Energy:    {feat['voiced_unvoiced_energy_ratio']:.2f}x")

    print(f"\n  5. Pause & Silence Behavior:")
    print(f"    - Silence Ratio:             {feat['silence_ratio']*100:.1f}%")
    print(f"    - Pause Count:               {feat['pause_count']}")
    print(f"    - Pause Duration (Mean/Max): {feat['mean_pause_duration_sec']:.3f} s / {feat['max_pause_duration_sec']:.3f} s")
    print(f"    - Speech-Silence Transitions:{feat['voice_to_silence_transition_count']}")

    print(f"\n  6. Speaking Rate Acoustic Proxies:")
    print(f"    - Voiced Segments / Sec:     {feat['voiced_segments_per_sec']:.2f} seg/s")
    print(f"    - Temporal Speech Activity:  {feat['temporal_activity_ratio']*100:.1f}%")
    print(f"    - Syllable Nucleus Peak Rate:{feat['syllable_peak_rate']:.2f} peaks/s")
    print(f"    - Pause-Adjusted Syllable:   {feat['pause_adjusted_activity_rate']:.2f} peaks/active-s")

    print(f"\n  7. Micro-Variation Perturbations:")
    print(f"    - Local F0 Jitter Proxy:     {feat['jitter_local_proxy']:.5f}")
    print(f"    - Local RMS Shimmer Proxy:   {feat['shimmer_local_proxy']:.5f}")

    print("\n" + "-" * 80)
    print("SAVED ARTIFACTS")
    print("-" * 80)
    json_path = output_dir / f"{audio_path.stem}_prosody_features.json"
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(result, jf, indent=2)
    print(f"  Feature JSON:         {json_path}")

    if generate_plots:
        for k, p in plot_paths.items():
            print(f"  Diagnostic Plot ({k}): {p}")

    print("\n" + "=" * 80)
    print("FORENSIC NOTE")
    print("=" * 80)
    print(f"  {result['forensic_note']}")
    print("=" * 80)

    return result


def main():
    parser = argparse.ArgumentParser(description="Run prosodic & F0 analysis on an audio file.")
    parser.add_argument("audio_path", nargs="?", help="Path to input audio file")
    parser.add_argument("--input", "-i", dest="input_path", help="Path to input audio file")
    parser.add_argument("--output", "--output-dir", "-o", dest="output_dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory to save JSON and plots")
    parser.add_argument("--plot", "-p", action="store_true", help="Generate diagnostic PNG plots")
    parser.add_argument("--fmin", type=float, default=50.0, help="Minimum F0 frequency in Hz (default: 50.0)")
    parser.add_argument("--fmax", type=float, default=500.0, help="Maximum F0 frequency in Hz (default: 500.0)")
    parser.add_argument("--hop-length", type=int, default=256, help="Hop length in samples (default: 256)")
    parser.add_argument("--sample-rate", type=int, default=16000, help="Target sample rate in Hz (default: 16000)")

    args = parser.parse_args()
    target_path = args.input_path or args.audio_path

    config = ProsodyConfig(
        sr=args.sample_rate,
        fmin=args.fmin,
        fmax=args.fmax,
        hop_length=args.hop_length,
    )

    if target_path:
        analyze_file(
            audio_path=Path(target_path),
            output_dir=Path(args.output_dir),
            generate_plots=args.plot,
            config=config,
        )
    else:
        sample_path = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
        if sample_path.exists():
            print("\nNo audio file provided. Running on standard benchmark human sample:\n")
            analyze_file(
                audio_path=sample_path,
                output_dir=Path(args.output_dir),
                generate_plots=args.plot,
                config=config,
            )
        else:
            parser.print_help()


if __name__ == "__main__":
    main()
