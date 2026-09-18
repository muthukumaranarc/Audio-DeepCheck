# Audio DeepCheck - CLI Runner for Multi-Evidence Master Fusion
import argparse
import json
from pathlib import Path
import sys
import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.fusion_service import FusionService, FusionConfig


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder handling NumPy scalars and arrays."""
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.floating, np.float32, np.float64)):
            return float(obj)
        if isinstance(obj, (np.integer, np.int32, np.int64)):
            return int(obj)
        if isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        return super().default(obj)


def format_breakdown_table(modules: list) -> str:
    """Format module breakdown into a clean ASCII table."""
    lines = []
    lines.append(f"{'Module':<24} | {'Type':<12} | {'Raw':<8} | {'Norm':<8} | {'Eff.W':<8} | {'Contrib':<8} | {'Status':<12}")
    lines.append("-" * 92)
    for m in modules:
        mod_name = m["module"]
        ev_type = m["evidence_type"]
        raw = f"{m['raw_score']:.4f}" if m.get("raw_score") is not None else "N/A"
        norm = f"{m['normalized_score']:+.4f}"
        eff_w = f"{m['effective_weight']:.4f}"
        contrib = f"{m['contribution']:+.4f}"
        status = m["status"]
        lines.append(f"{mod_name:<24} | {ev_type:<12} | {raw:<8} | {norm:<8} | {eff_w:<8} | {contrib:<8} | {status:<12}")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Audio DeepCheck - Multi-Evidence Master Decision & Fusion CLI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--input",
        "-i",
        type=str,
        default="data/samples/ai_voice.wav",
        help="Path to input audio file (.wav, .mp3, .flac, .ogg)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Optional path to save JSON assessment report",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON format to stdout",
    )
    parser.add_argument(
        "--save-evidence",
        action="store_true",
        help="Automatically save structured JSON evidence to data/test/fusion/",
    )
    parser.add_argument(
        "--chunk-size",
        type=float,
        default=5.0,
        help="Sliding window duration in seconds",
    )
    parser.add_argument(
        "--hop-size",
        type=float,
        default=2.5,
        help="Sliding window hop step in seconds",
    )
    parser.add_argument(
        "--show-breakdown",
        action="store_true",
        help="Display detailed module-level weights and chunk fractions",
    )
    parser.add_argument(
        "--ablate",
        type=str,
        default="",
        help="Comma-separated list of modules to ablate/disable (e.g. wav2vec2,df_arena,prosody,spectrogram,whisper)",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        # Try resolving relative to AI-Model
        candidate = PROJECT_ROOT / args.input
        if candidate.exists():
            input_path = candidate
        else:
            print(f"Error: Input audio file does not exist: {args.input}", file=sys.stderr)
            sys.exit(1)

    ablate_list = [m.strip() for m in args.ablate.split(",") if m.strip()]

    config = FusionConfig(
        chunk_sec=args.chunk_size,
        hop_sec=args.hop_size,
        ablate_modules=ablate_list,
    )

    service = FusionService(config=config)

    if not args.json:
        print(f"\n=======================================================")
        print(f" Audio DeepCheck — Multi-Evidence Master Fusion Layer ")
        print(f"=======================================================")
        print(f"Evaluating: {input_path.name}")
        if ablate_list:
            print(f"Ablated Modules: {', '.join(ablate_list)}")
        print("Executing sequential multi-evidence analysis...")

    result = service.analyze_file(input_path)

    if args.json:
        print(json.dumps(result, indent=2, cls=NumpyEncoder))
    else:
        q = result["quality"]
        f = result["fusion"]
        c = result["chunks"]

        print("\n---------------- Signal Quality Report ----------------")
        print(f"Quality Score:     {q['score']:.4f} / 1.0000")
        print(f"Quality Flags:     {', '.join(q['flags']) if q['flags'] else 'NONE (Clean audio)'}")
        print(f"Duration:          {q['metrics']['duration_sec']:.2f} s")
        print(f"Estimated SNR:     {q['metrics']['snr_db']:.2f} dB")
        print(f"Clipping Ratio:    {q['metrics']['clipping_ratio'] * 100:.2f}%")

        print("\n---------------- MASTER DECISION ---------------------")
        decision_color = result["decision"]
        print(f"Final Decision:    [{decision_color}]")
        print(f"Decision Strength: {result['decision_strength']:.4f} ({result['confidence_status']})")
        print(f"Synthetic Score:   {f['synthetic_evidence_score']:.4f}")
        print(f"Human Score:       {f['human_evidence_score']:.4f}")
        print(f"Uncertainty:       {f['uncertainty_score']:.4f}")
        print(f"Conflict Level:    {f['conflict_level']}")

        print("\n---------------- Temporal Chunk Summary --------------")
        print(f"Total Chunks:      {c['count']} (window: {args.chunk_size}s, hop: {args.hop_size}s)")
        print(f"AI Fraction:       {c['ai_fraction'] * 100:.1f}%")
        print(f"Human Fraction:    {c['human_fraction'] * 100:.1f}%")
        print(f"Uncertain Fraction:{c['uncertain_fraction'] * 100:.1f}%")
        print(f"Score Variance:    {f['score_variance']:.4f} (IQR: {f['score_iqr']:.4f})")

        if args.show_breakdown:
            print("\n---------------- Specialist Evidence Breakdown -------")
            print(format_breakdown_table(result["modules"]))

        print("\n* Note: Decision strength is provisional evidence alignment, NOT a calibrated Bayes probability.\n")

    # Save output if requested
    out_dest = None
    if args.output:
        out_dest = Path(args.output)
    elif args.save_evidence:
        out_dir = PROJECT_ROOT / "data" / "test" / "fusion"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_dest = out_dir / f"{input_path.stem}_fusion_report.json"

    if out_dest:
        out_dest.parent.mkdir(parents=True, exist_ok=True)
        with open(out_dest, "w", encoding="utf-8") as fp:
            json.dump(result, fp, indent=2, cls=NumpyEncoder)
        if not args.json:
            print(f"Evidence report saved to: {out_dest}")


if __name__ == "__main__":
    main()
