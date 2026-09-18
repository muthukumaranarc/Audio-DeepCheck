# Audio DeepCheck - DF Arena 500M CLI Runner
import json
import sys
import time
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.df_arena_service import DFArenaDetector, inspect_audio, TARGET_SAMPLE_RATE, DF_ARENA_WINDOW_SAMPLES


def print_banner(title: str):
    print("=" * 70)
    print(title)
    print("=" * 70)


def analyze_file(audio_path: Path):
    audio_path = Path(audio_path).resolve()
    if not audio_path.exists():
        print(f"Error: Audio file not found at: {audio_path}")
        sys.exit(1)

    print_banner("AUDIO DEEPCHECK — DF ARENA 500M DETECTOR")
    meta = inspect_audio(audio_path)
    print(f"  File Name:            {meta['file_name']}")
    print(f"  Source Sample Rate:   {meta['sample_rate']} Hz")
    print(f"  Channels:             {meta['channels']} ({'Mono' if meta['channels'] == 1 else 'Stereo/Multi-channel'})")
    print(f"  Duration:             {meta['duration_seconds']} seconds")
    print(f"  Sample Count:         {meta['sample_count']} frames")
    print(f"  Audio Format:         {meta['format']} ({meta['subtype']})")

    print("\n" + "-" * 70)
    print("PREPROCESSING PIPELINE")
    print("-" * 70)
    print(f"  Target Sample Rate:   {TARGET_SAMPLE_RATE} Hz")
    print(f"  Channel Processing:   Downmixed to 1D mono (mean across channels)")
    print(f"  Window Formulation:   Deterministic {DF_ARENA_WINDOW_SAMPLES} samples (~{DF_ARENA_WINDOW_SAMPLES/TARGET_SAMPLE_RATE:.2f}s)")
    if meta['duration_seconds'] < (DF_ARENA_WINDOW_SAMPLES / TARGET_SAMPLE_RATE):
        print(f"  Padding Policy:       Audio < 4.04s -> Tiled/repeated to reach {DF_ARENA_WINDOW_SAMPLES} samples")
    else:
        print(f"  Padding Policy:       Audio >= 4.04s -> Deterministically sliced to first {DF_ARENA_WINDOW_SAMPLES} samples")

    print("\n" + "-" * 70)
    print("RUNNING INFERENCE")
    print("-" * 70)
    t_load_start = time.perf_counter()
    detector = DFArenaDetector(auto_load=True)
    t_load = time.perf_counter() - t_load_start

    result = detector.predict_file(audio_path)

    # Release memory after run
    detector.unload()

    print(f"  Model ID:             {result['model']}")
    print(f"  Execution Backend:    {result['backend']}")
    print(f"  Model Load Latency:   {t_load:.4f} seconds")
    print(f"  Inference Latency:    {result['inference_time_seconds']:.4f} seconds")
    print(f"  Prediction:           {result['prediction'].upper()}")
    print(f"  Forensic Assessment:  {result['assessment']}")
    print(f"  Bona-fide Score:      {result['bona_fide_score']:+.4f} (raw logit index 1)")
    print(f"  Spoof Score:          {result['spoof_score']:+.4f} (raw logit index 0)")
    print(f"  Bona-fide Probability:{result['bona_fide_probability']:.4f} ({result['bona_fide_probability'] * 100:.2f}%)")
    print(f"  Spoof Probability:    {result['spoof_probability']:.4f} ({result['spoof_probability'] * 100:.2f}%)")
    print(f"\n  Score Semantics:")
    print(f"    {result['score_semantics']}")

    print("\n" + "=" * 70)
    print("STRUCTURED JSON RESULT")
    print("=" * 70)
    print(json.dumps(result, indent=2))
    return result


def show_usage():
    print_banner("AUDIO DEEPCHECK — DF ARENA 500M CLI RUNNER")
    print("Usage:")
    print("  py -3.11 scripts/run_df_arena.py \"<path_to_audio_file>\"\n")
    print("Examples:")
    print("  py -3.11 scripts/run_df_arena.py data/samples/human_voice.wav")
    print("  py -3.11 scripts/run_df_arena.py data/samples/ai_voice.wav")
    print("  py -3.11 scripts/run_df_arena.py \"C:\\Users\\Muthu\\Downloads\\voice_sample.wav\"\n")
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
