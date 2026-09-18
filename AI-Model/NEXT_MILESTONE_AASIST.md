# Audio DeepCheck — Next Milestone Plan

## Milestone 3: AASIST Anti-Spoofing Integration and Independent Verification

> Current implementation: Wav2Vec2 primary detector is complete and verified.
>
> Next objective: integrate AASIST as an independent second anti-spoofing detector, run it on the same benchmark samples, measure its behavior/performance, and keep the architecture ready for sequential or small-batch model execution when hardware is limited.

---

## 1. Current State

The current live stage reports:

- Phase 2 complete.
- Primary detector: Wav2Vec2 Large XLSR anti-spoofing/deepfake classifier.
- Current Wav2Vec2 runtime: INT8 ONNX on CPU, with PyTorch fallback.
- Input support currently includes WAV, MP3, FLAC and OGG.
- Target model audio format: mono, 16 kHz, float32 normalized.
- Six Wav2Vec2 tests are passing.
- Two benchmark samples already exist:
  - `data/samples/human_voice.wav`
  - `data/samples/ai_voice.wav`

The project roadmap explicitly places AASIST after Wav2Vec2 and before spectrogram, prosody/F0, fusion, watermark, API, fine-tuning and real-time work.

---

## 2. Milestone Goal

Add AASIST as the second independent acoustic anti-spoofing detector.

For this milestone:

```text
human_voice.wav
        ↓
      AASIST
        ↓
  bona-fide / spoof evidence

ai_voice.wav
        ↓
      AASIST
        ↓
  bona-fide / spoof evidence
```

Then compare AASIST with the already-working Wav2Vec2 detector.

### Important

Do **not** create the fusion/master model yet.

We first need to prove that AASIST works independently.

---

## 3. Why AASIST

The project architecture intentionally uses multiple specialized evidence sources instead of one giant model.

After this milestone:

```text
                 AUDIO
                   │
          ┌────────┴────────┐
          ▼                 ▼
      Wav2Vec2            AASIST
          │                 │
          ▼                 ▼
   synthetic score      spoof evidence
```

The two outputs will eventually become inputs to the fusion layer, but they must first be independently validated.

---

## 4. Model Count Is Not Fixed

The project is **not restricted to exactly four models**.

Additional specialized models may be added later if experiments show that they improve detection quality.

The final architecture may therefore contain:

- multiple acoustic detectors
- spectrogram analysis/model(s)
- prosody/F0 model(s)
- watermark/provenance detection
- additional specialist models discovered during evaluation
- one fusion/master model

The number of models is decided by measured usefulness, not an arbitrary limit.

---

## 5. Hardware-Aware Execution

Hardware is a major constraint.

Do **not** assume that every model must remain loaded simultaneously.

The final inference system should support execution patterns such as:

### Sequential

```text
Audio
 ↓
Wav2Vec2
 ↓
release/unload
 ↓
AASIST
 ↓
release/unload
 ↓
Prosody
 ↓
release/unload
 ↓
...
 ↓
Fusion
```

### Small batches

```text
Audio
 ↓
Wav2Vec2 + AASIST
 ↓
release
 ↓
Spectrogram + Prosody
 ↓
release
 ↓
other specialist models
 ↓
Fusion
```

Detection quality is the priority. Hardware optimization should be achieved through scheduling, model lifecycle management, quantization or optimized runtimes where appropriate—not by arbitrarily removing useful detectors.

For this milestone, measure enough memory/performance information to make an informed decision about whether Wav2Vec2 + AASIST can remain loaded together.

---

## 6. AASIST Model Source

Use the publicly available pretrained AASIST implementation/checkpoint described by the project plan.

Do not:

- train from scratch
- fine-tune
- download a large training dataset
- start an ASVspoof training workflow

This milestone is **inference and verification only**.

Inspect the actual AASIST implementation/documentation before writing integration code.

Do not invent output semantics.

---

## 7. Runtime Strategy

The current development environment is a Windows laptop without an NVIDIA GPU, and the later production target is a CPU-oriented Ubuntu server.

Therefore:

1. Prefer a CPU-compatible inference path.
2. Prefer the available ONNX model when it is reliable.
3. Keep PyTorch as a fallback when necessary.
4. Avoid installing GPU/CUDA packages just for AASIST.
5. Measure inference cost.

If configuration is useful, support a backend concept such as:

```text
AASIST_BACKEND=onnx
```

with a possible fallback:

```text
AASIST_BACKEND=torch
```

Do not add configuration complexity unless the actual implementation needs it.

---

## 8. AASIST Service

Create:

```text
app/services/aasist_service.py
```

Keep model loading and inference separate from CLI code.

Prefer a lifecycle such as:

```python
load()
predict(...)
unload()
```

or an equivalent clean design.

This is important because the future system may contain several models and should be able to release models between stages.

The service should return a stable structured result.

Conceptual example:

```json
{
  "model": "aasist",
  "backend": "onnx",
  "prediction": "spoof",
  "bona_fide_score": 0.21,
  "spoof_score": 0.79
}
```

The exact field names and score meaning must be based on the real AASIST implementation. Do not assume that a raw model output is a calibrated probability.

---

## 9. AASIST Preprocessing

Do not simply reuse the Wav2Vec2 preprocessing without checking AASIST requirements.

Verify:

- expected sample rate
- mono/stereo requirement
- dtype
- normalization
- tensor/input shape
- padding/truncation
- minimum/maximum useful duration

The original source audio should remain unchanged.

Use a dedicated preprocessing path if AASIST needs one.

---

## 10. CLI Utility

Create:

```text
scripts/run_aasist.py
```

It must support commands such as:

```powershell
py -3.11 scripts/run_aasist.py data/samples/human_voice.wav
```

and:

```powershell
py -3.11 scripts/run_aasist.py data/samples/ai_voice.wav
```

The CLI should report:

```text
========================================
AASIST AUDIO ANALYSIS
========================================

File:
Sample rate:
Channels:
Duration:
Model:
Backend:

Prediction:
Bona-fide score:
Spoof score:

Inference time:
========================================
```

Do not present the result as absolute proof of human/AI speech.

---

## 11. Tests

Create:

```text
tests/test_aasist.py
```

Cover:

1. Model initialization.
2. Input validation.
3. AASIST-specific preprocessing.
4. Output structure.
5. Score range/shape validation.
6. Human benchmark inference.
7. AI benchmark inference.
8. Empty/invalid input handling.
9. CPU execution.
10. Backend fallback if implemented.

At least one test must run the real AASIST checkpoint locally.

Do not make all tests mocks.

Run the entire test suite after integration:

```powershell
py -3.11 -m pytest
```

The existing Wav2Vec2 tests must remain passing.

---

## 12. Benchmark

Use the exact existing benchmark samples:

```text
data/samples/human_voice.wav
data/samples/ai_voice.wav
```

Do not replace them.

Create a comparison report:

| Sample | Wav2Vec2 | AASIST |
|---|---|---|
| Human | existing result | new result |
| AI | existing result | new result |

Do not create a combined score yet.

---

## 13. Performance Measurement

Measure:

- model load time
- human inference time
- AI inference time
- approximate RAM behavior if practical
- whether Wav2Vec2 + AASIST together fit comfortably in current memory

The important engineering question is:

```text
Can both models stay loaded?
```

If not:

```text
Wav2Vec2 → unload → AASIST
```

is completely acceptable.

Document the recommended execution strategy.

---

## 14. Interpretation Rules

Do not write logic such as:

```text
Wav2Vec2 says fake
+
AASIST says fake
=
100% AI
```

Two models agreeing is useful evidence, but the current evaluation contains only a very small benchmark set.

This milestone proves implementation and behavior; it does not establish real-world accuracy.

---

## 15. Do NOT Implement Yet

Do not implement:

- Spectrogram ML model
- F0/prosody classifier
- Watermark detector
- Fusion/master model
- FastAPI
- Spring Boot integration
- React integration
- phone-call dataset generation
- fine-tuning
- ASVspoof large-scale downloads
- real-time streaming

These remain later milestones.

---

## 16. Update the Live Stage Tracker

Only after AASIST is fully implemented and verified, update:

```text
current-stage.md
```

Change AASIST:

```text
PENDING
```

to:

```text
COMPLETED
```

Record:

- model/checkpoint
- backend
- preprocessing
- human benchmark output
- AI benchmark output
- tests passed
- performance
- memory/scheduling recommendation
- known limitations

If an important part is incomplete, keep AASIST as:

```text
IN_PROGRESS
```

Do not mark it complete merely because the files were created.

---

## 17. Definition of Done

AASIST is complete only when:

```text
✅ AASIST checkpoint available locally
✅ AASIST loads successfully
✅ Correct preprocessing implemented
✅ CPU inference works
✅ human_voice.wav runs
✅ ai_voice.wav runs
✅ output structure is stable
✅ score semantics are verified
✅ real-model tests pass
✅ full test suite passes
✅ inference timing measured
✅ memory behavior measured/reasonably estimated
✅ existing Wav2Vec2 behavior remains intact
✅ Backend unchanged
✅ Frontend unchanged
✅ current-stage.md updated
```

---

## 18. Expected Architecture After This Milestone

```text
                     AUDIO FILE
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
         Wav2Vec2                  AASIST
             │                       │
             ▼                       ▼
      synthetic score          spoof evidence
             │                       │
             └───────────┬───────────┘
                         ▼
                    comparison
```

There is still **no fusion model** at this point.

---

## 19. Next Milestone After AASIST

After AASIST is complete:

```text
AASIST
  ↓
Spectrogram analysis
  ↓
Prosody/F0
  ↓
Fusion
  ↓
Watermark
  ↓
FastAPI
  ↓
Phone-call data
  ↓
Fine-tuning
  ↓
Real-time
```

The project may add further specialist models if experiments show that they improve the final system.

---

## 20. Core Principle

The goal is:

> **Best detection quality practical for the available hardware.**

We are free to use more models when useful, and free to schedule them one-by-one or in small groups when RAM/CPU is limited.
