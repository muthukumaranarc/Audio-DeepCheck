# Audio DeepCheck - Spectrogram Analysis CLI Runner
import argparse
import json
import sys
import time
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.spectrogram_service import (
    SpectrogramService,
    SpectrogramConfig,
    inspect_audio,
    load_and_preprocess_audio,
)

DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "test" / "spectrogram"


def print_banner(title: str):
    print("=" * 80)
    print(title)
    print("=" * 80)


def analyze_file(audio_path: Path, output_dir: Path = DEFAULT_OUTPUT_DIR):
    audio_path = Path(audio_path).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not audio_path.exists():
        print(f"Error: Audio file not found at: {audio_path}")
        sys.exit(1)

    print_banner("AUDIO DEEPCHECK — SPECTROGRAM ANALYSIS EVIDENCE LAYER")
    meta = inspect_audio(audio_path)
    print(f"  File Name:            {meta['file_name']}")
    print(f"  Source Sample Rate:   {meta['sample_rate']} Hz")
    print(f"  Source Channels:      {meta['channels']} ({'Mono' if meta['channels'] == 1 else 'Stereo/Multi-channel'})")
    print(f"  Duration:             {meta['duration_seconds']} seconds")
    print(f"  Sample Count:         {meta['sample_count']} frames")
    print(f"  Audio Format:         {meta['format']} ({meta['subtype']})")

    print("\n" + "-" * 80)
    print("SPECTROGRAM CONFIGURATION (STFT & MEL-SCALE)")
    print("-" * 80)
    config = SpectrogramConfig()
    print(f"  Target Sample Rate:   {config.sr} Hz")
    print(f"  FFT Window Size:      {config.n_fft} samples ({config.n_fft/config.sr*1000:.1f} ms)")
    print(f"  Hop Length:           {config.hop_length} samples ({config.hop_length/config.sr*1000:.1f} ms)")
    print(f"  Window Type:          {config.window}")
    print(f"  Mel Frequency Bands:  {config.n_mels} bands ({config.fmin} Hz – {config.fmax} Hz)")

    print("\n" + "-" * 80)
    print("EXTRACTING SPECTRAL FEATURES & GENERATING VISUALIZATIONS")
    print("-" * 80)

    service = SpectrogramService(config=config)
    t0 = time.perf_counter()

    # 1. Load and preprocess audio (mono, 16 kHz)
    y, _ = load_and_preprocess_audio(audio_path, target_sr=config.sr)

    # 2. Extract features
    analysis_result = service.analyze_waveform(y, sr=config.sr)
    analysis_result["audio_metadata"] = meta
    feat = analysis_result["features"]

    # 3. Render visual plots
    plot_paths = service.render_plots(
        y=y,
        file_name=audio_path.name,
        output_dir=output_dir,
        sr=config.sr
    )
    analysis_result["visual_outputs"] = plot_paths

    elapsed = time.perf_counter() - t0

    # Print Key Extracted Statistics
    print(f"  STFT Matrix Shape:    {analysis_result['stft_dimensions']['frequency_bins']} frequency bins x {analysis_result['stft_dimensions']['time_frames']} time frames")
    print(f"  Mel Matrix Shape:     {analysis_result['mel_dimensions']['mel_bands']} mel bands x {analysis_result['mel_dimensions']['time_frames']} time frames")
    print(f"  Processing Time:      {elapsed:.3f} seconds\n")

    print(f"  Key Extracted Numerical Evidence:")
    print(f"    - Spectral Centroid (mean ± std):    {feat['spectral_centroid']['mean']:.1f} ± {feat['spectral_centroid']['std']:.1f} Hz")
    print(f"    - Spectral Bandwidth (mean ± std):   {feat['spectral_bandwidth']['mean']:.1f} ± {feat['spectral_bandwidth']['std']:.1f} Hz")
    print(f"    - Spectral Rolloff 85% (mean):       {feat['spectral_rolloff_85']['mean']:.1f} Hz")
    print(f"    - Spectral Rolloff 95% (mean):       {feat['spectral_rolloff_95']['mean']:.1f} Hz")
    print(f"    - Spectral Flatness (mean ± std):    {feat['spectral_flatness']['mean']:.4f} ± {feat['spectral_flatness']['std']:.4f}")
    print(f"    - Zero-Crossing Rate (mean):         {feat['zero_crossing_rate']['mean']:.4f}")
    print(f"    - Spectral Contrast (mean):          {feat['spectral_contrast']['mean']:.2f} dB")
    print(f"    - RMS Energy (mean ± std):           {feat['rms_energy']['mean']:.4f} ± {feat['rms_energy']['std']:.4f}")
    print(f"    - Harmonic/Percussive Ratio:         {feat['harmonic_percussive']['harmonic_percussive_ratio']:.2f}")
    print(f"    - Low / Mid / High Mel Energy Split: {feat['mel_band_distribution']['low_band_energy_fraction']*100:.1f}% / {feat['mel_band_distribution']['mid_band_energy_fraction']*100:.1f}% / {feat['mel_band_distribution']['high_band_energy_fraction']*100:.1f}%")
    print(f"    - Spectral Flux / Delta (mean):      {feat['spectral_flux']['mean']:.4f}")

    print("\n" + "-" * 80)
    print("SAVED VISUALIZATIONS & ARTIFACTS")
    print("-" * 80)
    for k, p in plot_paths.items():
        print(f"  {k:<20}: {p}")

    json_path = output_dir / f"{audio_path.stem}_spectral_features.json"
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(analysis_result, jf, indent=2)
    print(f"  {'feature_json':<20}: {json_path}")

    print("\n" + "=" * 80)
    print("FORENSIC NOTE")
    print("=" * 80)
    print(f"  {analysis_result['forensic_note']}")
    print("=" * 80)

    return analysis_result


def show_usage():
    print_banner("AUDIO DEEPCHECK — SPECTROGRAM ANALYSIS CLI")
    print("Usage:")
    print("  py -3.11 scripts/analyze_spectrogram.py \"<path_to_audio_file>\" [--output-dir <path>]\n")
    print("Examples:")
    print("  py -3.11 scripts/analyze_spectrogram.py data/samples/human_voice.wav")
    print("  py -3.11 scripts/analyze_spectrogram.py data/samples/ai_voice.wav\n")
    print("Output:")
    print("  - Waveform plot (.png)")
    print("  - Linear STFT Spectrogram (.png)")
    print("  - Mel Spectrogram (.png)")
    print("  - Combined 3-panel Summary Plot (.png)")
    print("  - Complete Feature Statistics (.json)")
    print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run spectrogram analysis on an audio file.")
    parser.add_argument("audio_path", nargs="?", help="Path to input audio file")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Directory to save plots and JSON")
    args = parser.parse_args()

    if args.audio_path:
        analyze_file(Path(args.audio_path), Path(args.output_dir))
    else:
        human_sample = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
        if human_sample.exists():
            print("\nNo file specified. Running on standard human benchmark sample:\n")
            analyze_file(human_sample, Path(args.output_dir))
        else:
            show_usage()
