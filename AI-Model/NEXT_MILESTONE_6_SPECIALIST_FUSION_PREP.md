# Audio DeepCheck — Milestone 6
## Additional Specialist Models & Multi-Evidence Fusion Preparation

### Document Status

- Project: `Audio-DeepCheck`
- Working area: `AI-Model/`
- Current milestone: **Milestone 5 — Prosody / F0 Evidence Layer COMPLETE**
- Next milestone: **Milestone 6 — Additional Specialist Models & Multi-Evidence Fusion Preparation**
- Scope: evaluate whether additional specialist evidence should be added before the final fusion model.
- Development environment: Windows 11 first, Ubuntu deployment later.
- Current execution style: CPU-first, sequential heavy-model loading where useful.
- Repository boundary: modify **only `AI-Model/`**.

---

# 1. Current State

Milestone 5 is complete.

The current AI-Model now contains four independent evidence layers:

```text
Audio
  │
  ├── Wav2Vec2 INT8 ONNX          ✅
  ├── DF Arena 500M               ✅
  ├── Spectrogram Evidence        ✅
  └── Prosody / F0 Evidence       ✅
                                  │
                                  ▼
                         Future Multi-Evidence
                              Fusion Layer
```

The latest walkthrough reports:

- Prosody/F0 implemented as an independent evidence source.
- Seven prosodic feature groups are available.
- `librosa.pyin` is used for F0/voicing tracking.
- Four diagnostic plot types are generated.
- 12 prosody tests were added.
- The complete test suite is **42/42 passing**.
- The benchmark currently contains **4 human + 4 AI samples**.
- The prosody benchmark is explicitly evidence-only; no classifier was trained on the eight samples.
- Backend and Frontend were untouched.

These facts come directly from the current Milestone 5 walkthrough. fileciteturn3file0L5-L14

The walkthrough also reports current approximate performance:

```text
Wav2Vec2 INT8 ONNX
  ~2.1–4.5 s on ~5 s audio
  ~460 MB RAM
  338 MB disk

DF Arena 500M
  ~7.5–7.8 s on ~5 s audio
  ~1.7 GB RAM
  ~1.66 GB disk

Spectrogram
  ~0.25–0.35 s
  ~35–70 MB RAM

Prosody/F0
  ~2.1–3.5 s
  ~20–60 MB RAM
  0 MB model disk footprint
```

fileciteturn3file0L113-L119

---

# 2. What Milestone 6 Is Actually For

Do **not** immediately add another large AI model.

Milestone 6 is an **evaluation and architecture-preparation gate**.

The core question is:

> Does an additional specialist evidence source provide useful information that is not already adequately represented by Wav2Vec2, DF Arena, Spectrogram, and Prosody?

The answer may be:

- yes, add one specialist;
- yes, add more than one specialist;
- no, current evidence is sufficient;
- or uncertain, defer until a larger benchmark exists.

There is intentionally **no fixed model count**.

---

# 3. Current Evidence Sources

## 3.1 Wav2Vec2

Type:

```text
learned waveform/speech-representation detector
```

Preserve its raw output and model-specific semantics.

Do not assume its output is automatically calibrated probability.

---

## 3.2 DF Arena 500M

Type:

```text
broad anti-spoofing specialist
```

Again, retain:

- raw logits where available,
- model output,
- interpreted score,
- metadata,
- model identity.

Do not treat its score as universal probability.

---

## 3.3 Spectrogram

Type:

```text
frequency-domain acoustic evidence
```

Current feature family includes spectral shape and energy-distribution measurements.

These are evidence features, not independently validated Human/AI probabilities.

---

## 3.4 Prosody / F0

Type:

```text
time-domain / prosodic acoustic evidence
```

The current service extracts:

- F0 statistics,
- pitch contour dynamics,
- voicing/temporal structure,
- energy dynamics,
- pause/silence behavior,
- speaking-rate proxies,
- jitter/shimmer-style local variation proxies.

The current 8-sample benchmark found exploratory group differences, but the sample size is too small for generalization claims. The current walkthrough explicitly preserves this as an evidence-only layer. fileciteturn3file0L34-L44

---

# 4. Specialist Candidates To Evaluate

Evaluate candidates sequentially rather than implementing all of them immediately.

## Candidate A — Speech Representation Specialist

Possible families:

- WavLM
- Whisper encoder representations
- Conformer-based encoders
- another compact self-supervised speech representation

### Important rule

A speech recognition model is **not automatically a synthetic-speech detector**.

For example:

```text
Whisper available
        ≠
Whisper is a deepfake classifier
```

Therefore, an embedding/representation candidate may initially be evaluated as:

```text
audio → embedding → exploratory feature analysis
```

rather than:

```text
audio → fake probability
```

Only use a public classifier checkpoint as a classifier if the checkpoint's intended task and score semantics are documented.

---

# 5. Candidate B — Watermark / Provenance

Investigate whether relevant synthetic voice generators expose detectable provenance or watermark signals.

The output contract should distinguish:

```text
DETECTED
NOT_DETECTED
NOT_APPLICABLE
UNAVAILABLE
```

Never implement:

```text
watermark absent → human
```

Watermark detection is:

- generator-specific,
- scheme-specific,
- potentially destroyed or weakened by transformations such as compression or resampling.

If the project cannot identify a sufficiently reliable applicable watermark scheme, document the finding and move on.

Do not force a watermark subsystem into the architecture just because it sounds useful.

---

# 6. Candidate Evaluation Order

Use this order:

```text
1. Inspect existing evidence
        ↓
2. Select one candidate
        ↓
3. Functional test
        ↓
4. Hardware benchmark
        ↓
5. Existing 8-sample benchmark
        ↓
6. Compare errors / evidence
        ↓
7. Decide KEEP / DEFER / REJECT
        ↓
8. Only then evaluate the next candidate
```

This prevents the project from accumulating large models without evidence of usefulness.

---

# 7. Required Candidate Report

Every evaluated specialist must have a machine-readable and human-readable record.

Recommended structure:

```json
{
  "candidate": {
    "name": "...",
    "type": "...",
    "checkpoint": "...",
    "revision": "...",
    "license": "..."
  },
  "task": {
    "intended_task": "...",
    "project_usage": "..."
  },
  "runtime": {
    "device": "cpu",
    "load_time_sec": 0.0,
    "inference_time_sec": 0.0,
    "peak_ram_mb": 0.0,
    "disk_mb": 0.0
  },
  "evidence": {
    "raw_outputs": {},
    "normalized_outputs": {},
    "calibration_status": "not_calibrated"
  },
  "benchmark": {},
  "decision": {
    "status": "KEEP|DEFER|REJECT",
    "reason": "..."
  }
}
```

Never silently convert:

- logits to probabilities,
- arbitrary scores to percentages,
- embeddings into Human/AI predictions.

---

# 8. Evidence Normalization Contract

Before the final fusion model, define a standard internal evidence object.

Example:

```python
EvidenceRecord(
    module="wav2vec2",
    evidence_type="classifier",
    raw_output={...},
    synthetic_score=None,
    quality_score=None,
    calibration_status="not_calibrated",
    metadata={...},
)
```

Possible `evidence_type` values:

```text
classifier
embedding
spectral
prosody
provenance
```

The goal is interoperability, not forcing unrelated outputs into one artificial scale.

---

# 9. Quality-Aware Evidence

Every future evidence source should expose quality information where possible.

Examples:

```text
duration_sec
usable
valid_frame_ratio
voiced_ratio
signal_quality
chunk_count
```

A future fusion layer must be able to distinguish:

```text
low detector score because the model saw strong human evidence
```

from:

```text
low detector score because the audio segment was too poor to analyze
```

---

# 10. Error Complementarity Analysis

Create a benchmark matrix:

| Sample | Truth | Wav2Vec2 | DF Arena | Spectrogram | Prosody | Candidate |
|---|---|---|---|---|---|---|
| human_voice.wav | HUMAN | … | … | … | … | … |
| human_kennedy.ogg | HUMAN | … | … | … | … | … |
| human_churchill.wav | HUMAN | … | … | … | … | … |
| human_armstrong.wav | HUMAN | … | … | … | … | … |
| ai_voice.wav | AI | … | … | … | … | … |
| ai_luvvoice.wav | AI | … | … | … | … | … |
| ai_kokoro_heart0.wav | AI | … | … | … | … | … |
| ai_piper_amy.mp3 | AI | … | … | … | … | … |

The purpose is to identify:

- shared mistakes,
- unique mistakes,
- contradictory evidence,
- missing evidence,
- evidence that is mostly redundant.

Do not collapse this into a single "best model" ranking.

---

# 11. Complementarity Questions

For every candidate answer:

### Q1 — Does it see something the current system does not?

### Q2 — Does it fail on different samples?

### Q3 — Does it remain useful across different durations?

### Q4 — Is the result affected by recording conditions?

### Q5 — Is the result computationally practical?

### Q6 — Can its output be explained to the future fusion layer?

### Q7 — Does it provide enough value to justify its memory and latency?

A candidate that is only a duplicate of an existing evidence source should not automatically be retained.

---

# 12. Exploratory Correlation Analysis

Where technically meaningful, compare candidate outputs with existing evidence.

Possible analyses:

```text
candidate vs Wav2Vec2
candidate vs DF Arena
candidate vs spectral features
candidate vs prosody features
```

Possible statistics:

- Pearson correlation,
- Spearman correlation,
- feature-distance comparisons.

Because N=8 is extremely small, these are only exploratory diagnostics.

Do not use a correlation coefficient from eight samples as proof that two detectors are redundant.

---

# 13. Long-Audio Preparation

The final target is phone-call audio, not only 4–5 second clips.

Prepare a common future chunking interface:

```text
Long Recording
      ↓
Overlapping Chunks
      ↓
Evidence Modules
      ↓
Chunk-Level Evidence
      ↓
Temporal Aggregation
      ↓
Fusion
```

Define a reusable chunk metadata structure:

```json
{
  "chunk_index": 0,
  "start_sec": 0.0,
  "end_sec": 4.0,
  "duration_sec": 4.0,
  "evidence": {}
}
```

Do not implement full real-time streaming in Milestone 6.

The purpose here is to avoid designing every later model around only whole-file inference.

---

# 14. Model Lifecycle

Heavy models should support:

```python
load()
predict(...)
unload()
```

Sequential execution remains the preferred option on limited hardware:

```text
load Wav2Vec2
→ inference
→ unload

load DF Arena
→ inference
→ unload

run Spectrogram
→ run Prosody

load additional specialist
→ inference
→ unload

store evidence
→ future fusion
```

Do not keep all heavyweight models resident unnecessarily.

---

# 15. Security and Reproducibility

For each external model/checkpoint, document:

- model identifier,
- exact revision if available,
- source,
- license,
- size,
- parameters,
- intended task,
- training dataset information when documented,
- limitations,
- output semantics.

Do not commit weights.

Do not commit secrets.

Do not silently execute arbitrary remote model code.

---

# 16. Testing Requirements

Every implemented specialist must have tests covering:

- valid audio,
- missing input,
- invalid audio,
- output schema,
- finite values,
- lifecycle,
- expected device selection,
- deterministic behavior where applicable.

The complete existing suite must remain green:

```text
42/42 currently passing
```

Do not weaken or delete existing tests to accommodate the new module.

---

# 17. Performance Gate

For every evaluated candidate report:

```text
disk size
parameter count
load time
inference time
peak RAM
unload behavior
```

Use approximately 5 seconds of reference audio wherever practical.

Do not interpret model score magnitude as a runtime metric or as cross-model probability.

---

# 18. Decision Gate

At the end of the milestone, create a report containing:

```text
Candidate:
Evidence Type:
Intended Task:
Works Technically:
CPU Practical:
RAM Practical:
Latency:
Unique Evidence:
Redundancy:
Generalization Confidence:
Decision:
Reason:
```

Allowed decision values:

```text
KEEP
DEFER
REJECT
```

### Important

The current benchmark is only eight samples.

Therefore:

```text
KEEP
```

means:

> Keep as an evidence source for further evaluation.

It does **not** mean:

> This model has been proven accurate for production.

---

# 19. Definition of Done

Milestone 6 is complete when:

- [ ] current evidence modules are inventoried,
- [ ] a standard EvidenceRecord contract exists,
- [ ] at least one serious specialist candidate is evaluated,
- [ ] candidate runtime and memory are measured,
- [ ] benchmark comparison is completed,
- [ ] complementarity/error analysis is documented,
- [ ] watermark/provenance feasibility is assessed or explicitly deferred,
- [ ] long-audio chunk metadata contract is prepared,
- [ ] tests remain passing,
- [ ] no unsupported accuracy claim is made,
- [ ] no final fusion classifier is trained yet,
- [ ] Backend remains untouched,
- [ ] Frontend remains untouched.

---

# 20. Next Milestone After This One

Only after Milestone 6 should the project move to:

## Milestone 7 — Multi-Evidence Fusion / Master Decision Layer

Expected architecture:

```text
Wav2Vec2
    │
DF Arena
    │
Spectrogram
    │
Prosody
    │
Additional Specialist(s)
    │
Watermark / Provenance
    │
    ▼
Evidence Normalization
    ▼
Quality / Calibration Handling
    ▼
Fusion / Master Model
    ▼
Human / AI / Uncertain
```

The fusion model must be trained/evaluated on a substantially larger and more diverse dataset. The current eight benchmark files are useful for debugging and exploration, not for validating a production detector.
