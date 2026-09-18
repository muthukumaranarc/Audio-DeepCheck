# Audio DeepCheck — Milestone 7: Multi-Evidence Fusion / Master Decision Layer

## Status
- Current: Milestone 6 complete
- Next: Milestone 7
- Scope: `AI-Model/` only
- Current baseline: 54/54 tests passing
- Active evidence: Wav2Vec2, DF Arena 500M, Spectrogram, Prosody/F0, Whisper Tiny representation
- Watermark/provenance: deferred from primary telephony pipeline

The current walkthrough explicitly identifies Milestone 7 as the next stage: score calibration, telephony quality gating, and weighted multi-evidence arbitration. fileciteturn4file0L156-L159

## 1. Goal

Build a transparent, quality-aware master decision layer producing:

```text
HUMAN
AI_GENERATED
UNCERTAIN
```

It must combine heterogeneous evidence without pretending that every feature or embedding is a probability.

## 2. Architecture

```text
Long Audio
  ↓
Existing 5s / 2.5s-hop chunker
  ↓
Signal Quality
  ↓
Wav2Vec2 ─┐
DF Arena  ├─→ Evidence Contract
Spectrogram ┤
Prosody   ┤
Whisper   ┘
  ↓
Normalization
  ↓
Quality Gating
  ↓
Chunk Fusion
  ↓
Temporal Aggregation
  ↓
Conflict + Uncertainty
  ↓
MASTER DECISION
```

## 3. Evidence Semantics

### Wav2Vec2 / DF Arena
Classifier evidence. Preserve raw outputs, score direction, and calibration status.

### Spectrogram / Prosody
Feature evidence. Do not fabricate probabilities.

### Whisper
Embedding evidence. Do not fabricate a Human/AI probability.

Reuse `EvidenceRecord`; do not create a competing evidence schema.

## 4. New Components

Recommended:

```text
app/services/evidence_normalizer.py
app/services/quality_service.py
app/services/calibration_service.py
app/services/fusion_service.py
scripts/run_fusion.py
scripts/benchmark_fusion.py
tests/test_fusion.py
```

Add an ablation capability if practical.

## 5. Signal Quality

Measure where defensible:

- duration
- sample rate
- RMS/peak
- clipping ratio
- silence ratio
- voiced ratio
- spectral bandwidth/rolloff
- estimated SNR where reliable

Expose:

```text
quality_score
quality_flags
```

Possible flags:

```text
LOW_DURATION
LOW_SNR
HEAVY_CLIPPING
NARROWBAND
EXCESSIVE_SILENCE
LOW_VOICING
HIGH_NOISE
```

Never invent an unreliable measurement.

## 6. Quality Gating

Each module must be marked:

```text
USED
DOWNWEIGHTED
UNAVAILABLE
REJECTED
```

Examples:
- narrowband audio reduces reliance on high-frequency spectral evidence;
- heavy noise reduces reliability of prosody/spectral evidence;
- insufficient speech can force `UNCERTAIN`.

Record why evidence was gated.

## 7. Transparent Fusion Baseline

Do not simply average scores.

Use an internally documented signed evidence scale, for example:

```text
-1 = human evidence
 0 = neutral/unavailable
+1 = synthetic evidence
```

Preserve:

```text
raw_score
normalized_score
quality_weight
configured_weight
effective_weight
contribution
status
```

Use explicit baseline weights, not weights tuned on the eight-sample benchmark.

## 8. Conflict Handling

Detect disagreement between modules.

Example:

```text
Wav2Vec2 → human
DF Arena → synthetic
Prosody → human-like
Whisper → divergent
```

Expose:

```text
conflict_level = LOW / MEDIUM / HIGH
```

Strong unresolved conflict should be able to produce `UNCERTAIN`.

## 9. Uncertainty

Never force a binary decision when:

- audio quality is poor,
- evidence conflicts strongly,
- too little speech is available,
- only one weak source is usable,
- chunk decisions are highly unstable.

Use:

```text
HUMAN
AI_GENERATED
UNCERTAIN
```

## 10. Chunk Fusion

Reuse the existing `AudioChunk` / `create_audio_chunks` implementation:

```text
window = 5.0 sec
hop = 2.5 sec
```

For each chunk:

```text
quality → evidence → normalization → fusion
```

Then aggregate using at least:

- mean
- median
- trimmed mean where valid
- variance/IQR
- AI-chunk fraction
- human-chunk fraction
- uncertain-chunk fraction

Do not let one pathological chunk dominate.

## 11. Master Output Contract

Use a stable structure similar to:

```json
{
  "decision": "AI_GENERATED",
  "decision_strength": 0.84,
  "confidence_status": "PROVISIONAL",
  "quality": {
    "score": 0.84,
    "flags": []
  },
  "fusion": {
    "synthetic_evidence_score": 0.84,
    "human_evidence_score": 0.16,
    "uncertainty_score": 0.12,
    "conflict_level": "LOW"
  },
  "modules": [],
  "chunks": {
    "count": 10,
    "ai_fraction": 0.8,
    "human_fraction": 0.1,
    "uncertain_fraction": 0.1
  }
}
```

`decision_strength` is NOT a calibrated probability.

## 12. Calibration

Create a calibration abstraction supporting:

```text
NOT_CALIBRATED
CALIBRATED
UNKNOWN
```

Prepare for future methods such as:

- Platt scaling
- Isotonic regression
- temperature scaling

Do not calibrate on the current 8-sample development set.

## 13. Feature Evidence

Keep Spectrogram, Prosody and Whisper in future-ready feature structures.

Do not train a feature classifier on eight samples.

## 14. CLI

Implement:

```bash
python scripts/run_fusion.py --input data/samples/ai_voice.wav
```

Optional flags:

```text
--json
--save-evidence
--chunk-size
--hop-size
--show-breakdown
```

## 15. Ablation

Compare:

```text
ALL
-Wav2Vec2
-DF Arena
-Prosody
-Spectrogram
-Whisper
```

Purpose: understand dependence/redundancy, not optimize eight-sample accuracy.

## 16. Tests

Cover:

- score normalization
- score direction
- raw output preservation
- quality on clean/noisy/silent/narrowband/clipped audio
- gating
- all-agree fusion
- detector conflict
- missing module
- feature-only evidence
- no usable evidence
- uncertainty
- one/multiple chunks
- overlapping chunks
- poor chunk
- JSON/schema/finite values

Existing tests must remain passing.

## 17. Evaluation

Use the current 8 samples only as a sanity benchmark.

Report:

```text
sample
truth
decision
synthetic evidence score
quality score
conflict level
chunk count
AI fraction
human fraction
uncertain fraction
```

Do not call this production validation and do not optimize weights on it.

## 18. Performance

Keep heavy models sequential:

```text
Wav2Vec2 → unload
DF Arena → unload
Spectrogram
Prosody
Whisper → unload
Fusion
```

Measure:

- end-to-end latency
- per-module latency
- peak RAM
- chunks
- time/chunk
- cleanup

## 19. Non-Goals

Do not:

- modify Backend or Frontend
- build FastAPI/WebSockets
- build full real-time streaming
- train a final learned fusion model
- claim calibrated probabilities
- claim production accuracy
- make watermark absence evidence of human speech

## 20. Definition of Done

- [ ] normalization implemented
- [ ] quality service implemented
- [ ] quality gates implemented
- [ ] deterministic fusion implemented
- [ ] conflict + uncertainty implemented
- [ ] chunk-level fusion implemented
- [ ] temporal aggregation implemented
- [ ] master output contract implemented
- [ ] calibration abstraction implemented
- [ ] CLI implemented
- [ ] ablation implemented
- [ ] benchmark generated
- [ ] performance measured
- [ ] tests added and passing
- [ ] existing 54 tests remain passing
- [ ] no learned fusion model trained
- [ ] Backend/Frontend untouched

### After Milestone 7

The next major stage should be a larger dataset/evaluation/calibration phase before a learned fusion model or production deployment.
