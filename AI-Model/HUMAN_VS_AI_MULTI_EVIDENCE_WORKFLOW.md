# Audio DeepCheck — Human vs AI Multi-Evidence Workflow

## Core Problem

The final problem is **Human vs AI-generated voice detection**.

DF Arena 500M is not the final verdict. It is one evidence source inside the final Human-vs-AI system.

```text
Audio
  ↓
Shared preprocessing
  ├── Wav2Vec2 → acoustic AI evidence
  ├── DF Arena 500M → anti-spoofing evidence
  ├── Spectrogram → frequency/time evidence
  ├── Prosody/F0 → speech-behavior evidence
  └── additional specialist detectors when useful
  ↓
Evidence fusion
  ↓
HUMAN / AI / UNCERTAIN
```

## DF Arena Role

Use DF Arena's output as a feature/evidence value, not as the final answer.

Keep its raw model score and documented semantics. Do not rename a raw anti-spoof score as a calibrated "AI probability" unless calibration has been established.

## Model Count

There is no fixed limit such as four models. Add a specialist detector only when testing shows that it contributes useful independent evidence.

## Hardware Strategy

Models may run sequentially or in small groups:

```text
Wav2Vec2
  ↓ release
DF Arena
  ↓ release
Prosody
  ↓
Fusion
```

or:

```text
Wav2Vec2 + DF Arena
       ↓ release
Other detectors
       ↓
Fusion
```

Store outputs/features instead of requiring every model to stay loaded.

## Final Fusion

The fusion layer should eventually combine:

- Wav2Vec2 evidence
- DF Arena evidence
- spectrogram features
- prosody/F0 features
- additional specialist-model evidence
- watermark/provenance evidence
- audio-quality metadata

The final `synthetic_probability` belongs to this evaluated/calibrated fusion system, not to one individual model.

## Current benchmark insight

The current benchmark shows complementary behavior:

- Wav2Vec2 correctly identifies the tested human samples but misses some modern TTS samples.
- DF Arena catches the tested modern TTS samples but false-alarms on the tested human recordings.

Therefore both are useful evidence sources, and fusion is justified.

## Development sequence

```text
Wav2Vec2 ✅
DF Arena 500M ✅
    ↓
Spectrogram ← CURRENT NEXT MILESTONE
    ↓
Prosody/F0
    ↓
Additional useful specialist models
    ↓
Fusion/calibration
    ↓
Watermark/provenance
    ↓
Long-audio/chunk orchestration
    ↓
Phone-call robustness
    ↓
Fine-tuning
    ↓
FastAPI
    ↓
Real-time
    ↓
Ubuntu deployment
    ↓
Spring Boot integration
```
