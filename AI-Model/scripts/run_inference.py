# Audio DeepCheck - Minimal Inference Script
import sys
import os
from pathlib import Path
import json

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.wav2vec_service import Wav2Vec2Detector, inspect_audio, load_and_preprocess_audio, TARGET_SAMPLE_RATE


def print_banner(title: str):
    print("=" * 65)
    print(title)
    print("=" * 65)


def run_inference_on_file(audio_path: Path):
    audio_path = Path(audio_path).resolve()
    if not audio_path.exists():
        print(f"Error: Audio file not found at: {audio_path}")
        sys.exit(1)

    print_banner("AUDIO INSPECTION (RAW INPUT)")
    metadata = inspect_audio(audio_path)
    print(f"  File:             {metadata['file_name']}")
    print(f"  Sample Rate:      {metadata['sample_rate']} Hz")
    print(f"  Channels:         {metadata['channels']} ('Mono' if metadata['channels'] == 1 else 'Stereo/Multi-channel')")
    print(f"  Duration:         {metadata['duration_seconds']} seconds")
    print(f"  Sample Count:     {metadata['sample_count']} frames")
    print(f"  Audio Format:     {metadata['format']} ({metadata['subtype']})")

    print("\n" + "=" * 65)
    print("PREPROCESSING FOR WAV2VEC2")
    print("=" * 65)
    print(f"  Target format:    Mono, {TARGET_SAMPLE_RATE} Hz, Float32 normalized")
    waveform, _ = load_and_preprocess_audio(audio_path, target_sr=TARGET_SAMPLE_RATE)
    print(f"  Processed shape:  {waveform.shape} samples ({waveform.shape[0] / TARGET_SAMPLE_RATE:.3f} s)")
    print(f"  Amplitude range:  [{waveform.min():.4f}, {waveform.max():.4f}]")

    print("\n" + "=" * 65)
    print("RUNNING WAV2VEC2 DETECTOR INFERENCE")
    print("=" * 65)
    detector = Wav2Vec2Detector()
    result = detector.predict_waveform(waveform, sample_rate=TARGET_SAMPLE_RATE)
    result["audio_properties"] = metadata

    print(f"  Prediction:           {result['prediction'].upper()}")
    print(f"  Forensic Assessment:  {result['assessment']}")
    print(f"  Real Probability:     {result['real_probability']:.4f} ({result['real_probability'] * 100:.2f}%)")
    print(f"  Fake Probability:     {result['fake_probability']:.4f} ({result['fake_probability'] * 100:.2f}%)")
    print(f"  Logits (Real/Fake):   [{result['logits']['real']}, {result['logits']['fake']}]")

    print("\n" + "=" * 65)
    print("DETECTION SUMMARY (JSON OUTPUT)")
    print("=" * 65)
    print(json.dumps(result, indent=2))
    return result


def show_test_procedure():
    print_banner("AUDIO DEEPCHECK - WAV2VEC2 INFERENCE UTILITY")
    print("Usage:")
    print("  python scripts/run_inference.py <path_to_audio_file.wav>\n")
    print("Test Procedure:")
    print("  1. Place a test voice recording (human or synthetic) in:")
    print("     data/samples/sample.wav")
    print("  2. Run the inference command:")
    print("     python scripts/run_inference.py data/samples/sample.wav\n")
    print("Supported Audio Formats:")
    print("  WAV, FLAC, OGG, MP3 (soundfile-compatible formats)")
    print("  Audio will be automatically converted to Mono @ 16,000 Hz float32.")
    print("=" * 65)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_inference_on_file(Path(sys.argv[1]))
    else:
        human_sample = PROJECT_ROOT / "data" / "samples" / "human_voice.wav"
        ai_sample = PROJECT_ROOT / "data" / "samples" / "ai_voice.wav"
        default_sample = PROJECT_ROOT / "data" / "samples" / "sample.wav"

        if human_sample.exists() and ai_sample.exists():
            print("\nFound downloaded test samples! Running evaluation on both:\n")
            print(">>> 1. Testing Real Human Voice:")
            run_inference_on_file(human_sample)
            print("\n" + "#" * 65 + "\n")
            print(">>> 2. Testing AI Synthetic Voice:")
            run_inference_on_file(ai_sample)
        elif default_sample.exists():
            print(f"Found default test sample at: {default_sample}")
            run_inference_on_file(default_sample)
        else:
            show_test_procedure()
