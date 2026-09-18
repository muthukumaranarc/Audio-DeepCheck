# Audio DeepCheck — Next Milestone: Prosody / F0 Analysis

## Document Status

- Project: `Audio-DeepCheck`
- Working area: `AI-Model/`
- Current milestone: **Milestone 4 — Spectrogram Evidence Layer COMPLETE**
- Next milestone: **Milestone 5 — Prosody / F0 Analysis**
- Primary goal: add an independent, lightweight **time-domain/prosodic evidence layer** for Human vs AI-generated voice analysis.
- Development environment: Windows 11 first, then Ubuntu deployment.
- Current hardware target: CPU-first, approximately 8 GB RAM on the Windows development machine.
- Scope boundary: **Do not modify `Backend/` or `Frontend/`.**
- Model-count policy: do not assume a fixed number of specialist models. Add future specialists only when evaluation shows they provide useful independent evidence.

---

# 1. Why This Milestone Exists

The current AI-Model has several complementary evidence sources:

1. **Wav2Vec2 detector**
   - Learns speech representations directly from the waveform.
   - Strong evidence on the current small benchmark for several human/AI samples, but it misses some AI generators.

2. **DF Arena 500M**
   - Broad anti-spoofing evidence source.
   - Strong on the current AI samples, but its behavior on the current human samples shows that its output cannot be treated as the final verdict.

3. **Spectrogram analysis**
   - Provides frequency-domain evidence such as spectral centroid, bandwidth, rolloff, flatness, ZCR, contrast, harmonic/percussive ratio, and Mel-band distribution.
   - Current observations are promising but are based on only 4 human + 4 AI benchmark samples, so they are not a validated classifier.

The next evidence layer should examine **how speech changes over time**, rather than only what is present in the frequency domain.

Prosody analysis focuses on measurable characteristics such as:

- Fundamental frequency (F0 / pitch)
- Pitch trajectory
- Pitch variation
- Voicing behavior
- Energy variation
- Pause/silence behavior
- Speaking-rate-related measurements
- Local irregularity / stability
- Optional micro-variation features

The purpose is **not** to assume that humans are always more variable or AI voices are always more stable. Instead, the goal is to measure these properties and determine through evaluation which features, if any, provide useful independent evidence.

---

# 2. Milestone Goal

Implement a reusable **Prosody/F0 Evidence Layer** that:

- accepts a WAV/audio file,
- performs consistent preprocessing,
- estimates F0/pitch,
- detects voiced/unvoiced regions,
- calculates prosodic statistics,
- extracts a structured feature vector,
- optionally generates diagnostic plots,
- returns machine-readable JSON,
- can be used later by the fusion/master model,
- works independently from Wav2Vec2, DF Arena, and spectrogram analysis,
- uses CPU-friendly algorithms suitable for the current development machine.

This milestone is an **evidence extraction milestone**, not the final Human-vs-AI classifier.

---

# 3. Required Architecture

Add a dedicated service, for example:

```text
AI-Model/
├── app/
│   ├── services/
│   │   └── prosody_service.py
│   └── ...
├── scripts/
│   ├── analyze_prosody.py
│   ├── benchmark_prosody.py
│   └── ...
├── tests/
│   └── test_prosody.py
└── data/
    └── test/
        └── prosody/
```

Use the existing project conventions wherever they are already established.

Do not create a second project, second virtual environment, or another Git repository.

---

# 4. Processing Pipeline

The recommended processing flow is:

```text
Audio File
   ↓
Load Audio
   ↓
Mono Conversion
   ↓
Resample to 16 kHz
   ↓
Basic Validation
   ↓
F0 / Pitch Tracking
   ↓
Voicing Detection
   ↓
Pitch Contour Construction
   ↓
Energy / RMS Tracking
   ↓
Pause / Silence Analysis
   ↓
Rate-Related Measurements
   ↓
Prosodic Feature Extraction
   ↓
Structured Evidence JSON
   ↓
Optional Diagnostic Plots
```

### Why a shared 16 kHz pipeline?

The current AI-Model already standardizes major detector processing around 16 kHz. Reusing this convention keeps downstream features consistent and makes later fusion easier.

The implementation should still be robust to input files with other sample rates.

---

# 5. F0 / Pitch Extraction

## Required objective

Estimate the fundamental frequency of voiced speech while safely handling:

- silence,
- background noise,
- unvoiced consonants,
- very short recordings,
- pitch-tracker failures,
- octave errors,
- invalid or zero-valued estimates.

## Preferred implementation

Use a well-tested CPU-friendly pitch tracker available in the project's Python ecosystem.

Evaluate the available option(s) already compatible with the project, such as a suitable `librosa` pitch-tracking implementation. Do not add a large neural model merely to calculate F0 unless testing demonstrates a clear need.

The implementation should be configurable for:

- `fmin`
- `fmax`
- frame length
- hop length
- voicing threshold/confidence when supported
- minimum usable voiced frames

Do not hard-code one speaker's expected pitch range without documenting the reason.

---

# 6. Required Prosody Features

The first implementation should extract the following groups.

## 6.1 Pitch Statistics

From valid voiced F0 frames:

- mean F0
- median F0
- standard deviation
- minimum
- maximum
- range
- interquartile range
- coefficient of variation when numerically valid

Use robust statistics where appropriate.

### Important

Raw F0 alone is **not** a human/AI decision feature.

A person's pitch varies naturally with speaker identity, sex, age, emotion, language, and speaking style. Therefore the system must not interpret "high pitch" or "low pitch" directly as evidence of synthetic speech.

---

## 6.2 Pitch Contour Dynamics

Measure how the pitch changes over time:

- mean absolute pitch change
- standard deviation of frame-to-frame pitch change
- median absolute pitch change
- pitch slope statistics
- rising/falling segment counts when meaningful
- local pitch variability

Calculate these primarily on valid voiced regions rather than treating silence as pitch zero.

---

## 6.3 Voicing Features

Calculate:

- voiced-frame ratio
- unvoiced-frame ratio
- number of voiced segments
- median voiced-segment duration
- mean voiced-segment duration
- shortest/longest voiced-segment duration when valid
- number of voiced/unvoiced transitions

These features are useful because speech generation systems and natural speech can differ in temporal voicing patterns, but the values must be evaluated rather than interpreted beforehand.

---

## 6.4 Energy / Loudness Dynamics

Using RMS or a similar stable short-time energy measure:

- mean RMS
- median RMS
- standard deviation
- dynamic range
- RMS percentile statistics
- frame-to-frame RMS variation
- voiced-vs-unvoiced energy ratio when valid

Normalize safely so the values are not dominated by recording volume.

A fixed microphone gain or loudness level should not become an accidental detector shortcut.

---

## 6.5 Pause / Silence Features

Estimate low-energy or silent regions and calculate:

- silence ratio
- number of pauses
- average pause duration
- median pause duration
- maximum pause duration
- pause-duration variability
- voiced-to-silence transition count

Use configurable thresholds and document them.

The pause detector must not confuse ordinary low-energy speech with silence without reasonable safeguards.

---

## 6.6 Speaking-Rate-Related Features

For this milestone, do **not** build a speech recognizer unless it is genuinely required.

Instead derive rate-related proxies from acoustic segmentation, for example:

- voiced-segment count per second
- syllable-like peak count when a reliable lightweight method is available
- estimated articulation-event rate
- pause-adjusted temporal activity ratio

Clearly label these as **acoustic rate proxies**, not true words-per-minute.

If a feature cannot be implemented robustly, omit it rather than inventing a misleading metric.

---

## 6.7 Micro-Variation / Tremor-Oriented Features

Explore lightweight measures such as:

- local pitch jitter-like variation,
- short-window F0 variation,
- short-window energy variation.

This should be implemented conservatively.

Do **not** claim that these measures detect a unique "human signature." The goal is only to quantify small temporal variations that may become useful to the later fusion stage.

If terminology such as jitter/shimmer is used, document the exact mathematical definition implemented.

---

# 7. Data Quality and Failure Handling

The service must explicitly handle:

### Valid audio

Return all applicable features.

### Mostly unvoiced audio

Return valid metadata but mark pitch-derived fields as unavailable or low-confidence where necessary.

### Silent audio

Do not crash.

Return an explicit status such as:

```json
{
  "status": "insufficient_voicing"
}
```

or the project's equivalent structured status.

### Very short audio

Handle gracefully and report minimum-data limitations.

### Invalid file

Raise a controlled, useful error rather than producing misleading numbers.

### No valid F0 values

Do not calculate fake statistics from zeros or NaNs.

---

# 8. Confidence and Quality Metadata

The prosody service should expose quality indicators separate from Human-vs-AI evidence.

Suggested metadata:

```json
{
  "analysis_quality": {
    "duration_sec": 4.21,
    "voiced_ratio": 0.63,
    "valid_f0_frame_ratio": 0.59,
    "usable_for_pitch_features": true
  }
}
```

These are **measurement-quality indicators**, not "AI probability."

Do not output:

```text
human_probability = ...
```

from this milestone unless an actual classifier is trained and evaluated later.

---

# 9. CLI Requirements

Add:

```bash
python scripts/analyze_prosody.py --input path/to/audio.wav
```

The CLI should show a concise human-readable summary and optionally write JSON.

Recommended options:

```text
--input
--output
--plot
--sample-rate
--fmin
--fmax
--hop-length
```

Do not make plotting mandatory.

The normal analysis path should remain lightweight.

---

# 10. Diagnostic Visualization

Create optional plots useful for debugging:

1. waveform + RMS
2. F0 contour
3. voiced/unvoiced regions
4. optional energy envelope
5. optional combined prosody summary

Save plots under:

```text
data/test/prosody/
```

Do not render plots during automated tests unless a dedicated visualization test is explicitly intended.

---

# 11. Benchmark Requirements

Create:

```bash
python scripts/benchmark_prosody.py
```

Use the existing 8 benchmark samples where available:

### Human

- `human_voice.wav`
- `human_kennedy.ogg`
- `human_churchill.wav`
- `human_armstrong.wav`

### AI

- `ai_voice.wav`
- `ai_luvvoice.wav`
- `ai_kokoro_heart0.wav`
- `ai_piper_amy.mp3`

The benchmark should report feature values without treating the current 8 samples as a scientifically representative dataset.

Recommended output:

```text
sample
ground_truth
duration_sec
voiced_ratio
f0_mean
f0_median
f0_std
f0_range
pitch_variation
voiced_segments
pause_ratio
mean_pause_sec
rms_mean
rms_std
rate_proxy
analysis_quality
```

Also calculate simple group summaries:

```text
human mean
human median
AI mean
AI median
```

Only add effect-size or separability statistics if they are implemented correctly and clearly labeled as exploratory.

---

# 12. What We Must NOT Do in This Milestone

Do not:

- train the final Human-vs-AI model yet,
- modify Spring Boot,
- modify React,
- add a database,
- expose FastAPI,
- build real-time streaming,
- claim universal human/AI detection,
- claim F0 proves a voice is human or AI,
- use the current 8 files as proof of production accuracy,
- silently download large training datasets,
- introduce a large deep-learning model solely for F0 without justification,
- keep all heavyweight models loaded while running prosody,
- hard-code Windows-only paths.

---

# 13. Testing Strategy

Add unit tests covering:

- file loading,
- mono conversion,
- resampling,
- silence handling,
- valid voiced input,
- all-unvoiced input,
- short audio,
- invalid input,
- feature dictionary schema,
- absence of NaNs where valid statistics are expected,
- deterministic output shape/schema,
- plot generation when enabled.

Keep tests CPU-safe and fast.

The test suite should verify structure and numerical sanity, not pretend to validate real-world AI detection accuracy.

---

# 14. Performance Requirements

The current Windows machine is CPU-only with limited RAM.

Therefore:

- prefer vectorized NumPy/librosa operations,
- avoid unnecessary copies,
- keep plots optional,
- do not load Wav2Vec2 or DF Arena merely to run prosody analysis,
- do not keep heavy models resident,
- process one file at a time,
- release large intermediate arrays when appropriate.

Target a clearly lightweight analysis path for several-second recordings.

If a performance bottleneck is discovered, measure it before optimizing.

---

# 15. Integration Contract for Future Fusion

The eventual master/fusion stage should be able to consume a stable structure such as:

```json
{
  "module": "prosody",
  "version": "1.0",
  "status": "ok",
  "analysis_quality": {
    "duration_sec": 4.21,
    "voiced_ratio": 0.63,
    "valid_f0_frame_ratio": 0.59
  },
  "features": {
    "f0_mean_hz": 182.4,
    "f0_median_hz": 179.7,
    "f0_std_hz": 21.4,
    "f0_range_hz": 87.2,
    "pitch_variation": 8.4,
    "voiced_segment_count": 9,
    "pause_ratio": 0.18,
    "mean_pause_sec": 0.24,
    "rms_mean": 0.031,
    "rms_std": 0.014,
    "rate_proxy": 3.7
  }
}
```

Exact feature names may differ as long as they are:

- documented,
- stable,
- numerically well-defined,
- easy for the future fusion layer to consume.

---

# 16. Evaluation Gate

Milestone 5 is complete when:

- prosody service is implemented,
- CLI works,
- benchmark works,
- diagnostic plots work,
- tests pass,
- outputs are machine-readable,
- edge cases are handled,
- performance is measured,
- benchmark results are documented,
- no unsupported Human-vs-AI claims are made.

### Decision gate after implementation

Do **not** immediately add a prosody classifier.

First inspect:

1. whether measurements are stable,
2. whether features differ across the current sample groups,
3. whether artifacts are caused by recording conditions,
4. whether the prosody evidence adds information that Wav2Vec2, DF Arena, and spectrogram evidence do not already provide.

Only after that evaluation should the project decide whether:

- prosody remains a raw evidence layer,
- some prosody features should enter a future fusion model,
- additional specialist analysis is justified,
- or some features should be removed.

---

# 17. Current Project Sequence After This Milestone

```text
Environment                         ✅
Wav2Vec2                           ✅
AASIST                             ❌ Removed / superseded
DF Arena 500M                      ✅
Spectrogram Evidence               ✅
Prosody / F0                       🔵 NEXT
Additional Specialist Evidence     ⏳ Evaluation-driven
Fusion / Master Model              ⏳
Watermark / Provenance             ⏳
Long-audio chunking                ⏳
Phone-call dataset                 ⏳
Fine-tuning / calibration          ⏳
FastAPI                            ⏳
Real-time streaming                ⏳
Ubuntu deployment                  ⏳
Spring Boot integration            ⏳
```

---

# 18. Definition of Done

At the end of this milestone, the repository should have:

```text
app/services/prosody_service.py
scripts/analyze_prosody.py
scripts/benchmark_prosody.py
tests/test_prosody.py
data/test/prosody/
```

plus:

- documented configuration,
- benchmark output,
- tests,
- updated project status documentation,
- no changes outside `AI-Model/`.

The milestone should produce **reliable prosodic measurements**, not a fake certainty about whether a voice is human or AI.
