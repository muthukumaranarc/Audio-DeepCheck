# Audio DeepCheck — AI Model Development Plan (Updated)

## Scope
This plan covers `AI-Model/` only. Do not modify `Backend/` or `Frontend/` unless explicitly instructed.

## Goal
Estimate whether recorded speech is `LIKELY_HUMAN`, `LIKELY_SYNTHETIC`, or `UNCERTAIN` using multiple independent evidence sources.

## Current architecture
```text
Recorded Audio
   ↓
Specialist detectors / analyzers
   ├── Wav2Vec2
   ├── DF Arena 500M
   ├── Spectrogram
   ├── Prosody / F0
   ├── additional specialist models if useful
   └── Watermark / provenance
   ↓
Fusion model
   ↓
Final assessment
```

## Current primary detector
### Wav2Vec2
The existing INT8 ONNX Wav2Vec2 detector remains active and must not be broken.

## New secondary detector
### DF Arena 500M
Use:
`Speech-Arena-2025/DF_Arena_500M_V_1`

The current public model documentation describes DF Arena 500M as a universal antispoofing model trained across multiple datasets including ASVspoof 2019/2024, Codecfake, LibriSeVoc, DFADD, CTRSVDD, SpoofCeleb, MLAAD and EnvSDD. The public benchmark repository describes an XLS-R/Wav2Vec2-based frontend with learned layer aggregation and a 4-block Conformer head. The benchmark checkpoint is currently listed as 436M parameters. citeturn341064search0turn341064search1

The current benchmark implementation uses a deterministic first 64,600 samples (~4.04 s at 16 kHz), with tile/repeat when shorter, no random crop, and no resampling inside that wrapper; its documented score is the bona-fide softmax score. Verify the actual repository behavior before implementation. citeturn341064search1turn341064search6

The public repository currently contains a `model.safetensors` file of about 1.74 GB. citeturn341064search2turn341064search9

## Legacy AASIST
The old AASIST integration is superseded. Remove it cleanly after confirming its files and dependencies are AASIST-specific and unused elsewhere. Do not remove shared dependencies blindly.

Expected cleanup candidates:
- `app/services/aasist_service.py`
- `scripts/run_aasist.py`
- `tests/test_aasist.py`
- `models/aasist/`

## Hardware strategy
The project is not restricted to a fixed number of models. Add specialist models when measured experiments show they improve detection.

Hardware is limited, so the final orchestrator must support:
```text
model A → release → model B → release → model C
```
or small batches:
```text
model A + B → release → model C + D → release → fusion
```
Store model outputs/features rather than requiring all models to stay resident in RAM.

## DF Arena service
Create:
`app/services/df_arena_service.py`

Keep loading, preprocessing, inference, and optional unload/release separate.

Do not assume Wav2Vec2 preprocessing is correct for DF Arena. Verify its real requirements.

## DF Arena CLI
Create:
`scripts/run_df_arena.py`

It should accept the existing benchmark samples:
- `data/samples/human_voice.wav`
- `data/samples/ai_voice.wav`
- Luvvoice sample if present

Print:
- file
- duration
- source sample rate/channels
- preprocessing summary
- model
- backend
- prediction
- exact score meaning
- inference time

Do not call raw scores calibrated probabilities unless calibration is established.

## Tests
Create:
`tests/test_df_arena.py`

Cover initialization, preprocessing, input validation, output structure, score range, human inference, AI inference, invalid/empty input, CPU execution, and lifecycle if implemented.

Run:
`py -3.11 -m pytest`

Existing Wav2Vec2 tests must remain passing.

## Benchmark
Compare:
| Sample | Wav2Vec2 | DF Arena 500M |
|---|---|---|
| Human | existing result | new result |
| AI | existing result | new result |
| Luvvoice | existing result | new result |

Do not create the fusion model yet.

## Performance
Measure model load time, inference time, approximate RAM behavior, and whether Wav2Vec2 + DF Arena can coexist. If not, recommend sequential execution rather than removing a useful model.

## Future sequence
```text
Wav2Vec2
  ↓
DF Arena 500M
  ↓
Spectrogram
  ↓
Prosody/F0
  ↓
Additional useful specialist models
  ↓
Fusion
  ↓
Watermark
  ↓
FastAPI
  ↓
Phone-call dataset
  ↓
Fine-tuning
  ↓
Real-time streaming
  ↓
Ubuntu deployment
  ↓
Spring Boot integration
```

## Definition of done for DF Arena migration
- Legacy AASIST cleaned out safely
- DF Arena loads
- Correct preprocessing verified
- Human and AI benchmarks run
- Luvvoice benchmark run if available
- Output semantics verified
- Tests pass
- Performance/RAM measured
- Wav2Vec2 tests remain passing
- `Backend/` and `Frontend/` untouched
- `current-stage.md` updated accurately
