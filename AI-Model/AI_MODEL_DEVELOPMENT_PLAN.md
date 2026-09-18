# Audio DeepCheck — AI Model Development Plan

> **Scope:** This document is the complete implementation plan for the `AI-Model` folder only.
>
> **Important:** The repository also contains `Backend/` and `Frontend/`. During the AI/ML development phase, **DO NOT modify, delete, rename, or refactor those folders** unless explicitly instructed by the human developer.

---

## 1. Project Goal

Build an AI-assisted audio-forensics system that estimates whether a recorded phone-call voice is:

- **Likely Human**
- **Likely Synthetic / AI-Generated**
- **Uncertain**

### Target scenario

#### Scenario A — Human voice

```text
Person A
  ↓
Phone microphone
  ↓
Cellular / VoIP call
  ↓
Person B phone
  ↓
Person B records audio
  ↓
Our system
```

#### Scenario B — AI-generated voice

```text
AI / TTS / Voice Cloning
  ↓
Phone / calling device
  ↓
Cellular / VoIP call
  ↓
Person B phone
  ↓
Person B records audio
  ↓
Our system
```

The important challenge is that the detector must eventually work on **phone-call recordings**, not only clean studio audio.

---

# 2. High-Level Architecture

The AI system uses several specialized evidence sources rather than trusting one model.

```text
                         RECORDED AUDIO
                                │
                                ▼
                       AUDIO PREPROCESSING
                                │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
           ▼                     ▼                     ▼
      Wav2Vec2             DF Arena 500M          Prosody/F0
      Detector             Anti-Spoofing           Analysis
           │                     │                     │
           ▼                     ▼                     ▼
       AI score              spoof score         feature score
           │                     │                     │
           └─────────────────────┼─────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
           Spectrogram                    Watermark
            Analysis                     Detection
                 │                             │
                 └──────────────┬──────────────┘
                                │
                                ▼
                       MASTER / FUSION MODEL
                                │
                                ▼
                      FINAL SYNTHETIC SCORE
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
                Assessment               Evidence
```

### Important architecture decision

**Use multiple specialized detectors + one small master/fusion model.**

Do **not** initially build one giant model responsible for everything.

---

# 3. Component Responsibilities

## 3.1 Wav2Vec2 — Primary detector

### Purpose

Detect patterns in speech/audio that are associated with synthetic speech.

### Input

Raw mono audio, normalized/resampled as required by the model.

### Output

Example:

```json
{
  "real_probability": 0.16,
  "fake_probability": 0.84
}
```

### Starting model

Use a public pretrained Wav2Vec2-based deepfake voice detector:

```text
garystafford/wav2vec2-deepfake-voice-detector
```

Do not train from zero initially.

---

## 3.2 DF Arena 500M — Universal Anti-spoofing detector

### Purpose

Provide an independent universal anti-spoofing signal based on multi-dataset pretraining (ASVspoof 2019/2024, Codecfake, LibriSeVoc, DFADD, CTRSVDD, SpoofCeleb, MLAAD, EnvSDD). Replaces legacy AASIST due to significantly higher out-of-domain generalization (1.76% EER on *InTheWild* vs 43.01% for AASIST).

### Output

Example:

```json
{
  "model": "df_arena_500m",
  "prediction": "spoof",
  "assessment": "LIKELY_SYNTHETIC",
  "bona_fide_score": -4.6425,
  "spoof_score": 5.5258,
  "bona_fide_probability": 0.0000,
  "spoof_probability": 1.0000
}
```

### Implementation

Use `Speech-Arena-2025/DF_Arena_500M_V_1` (436M parameters, PyTorch CPU).
Deterministic 64,600-sample windowing (~4.04s at 16 kHz).
Explicit `load()`, `predict_waveform()`, `predict_file()`, and `unload()` lifecycle for memory release.
*(Legacy AASIST is superseded and cleanly removed).*

---

## 3.3 Spectrogram Analysis

### Purpose

Represent frequency content over time.

A spectrogram has:

- X axis = time
- Y axis = frequency
- intensity/color = energy

### First implementation

Do NOT immediately create a separate huge neural network.

Initially:

1. Calculate the spectrogram.
2. Save/render it for visualization.
3. Extract useful signal statistics/features.
4. Investigate whether a dedicated spectrogram CNN adds measurable value.

### Important

A spectrogram alone is **not proof** that audio is AI-generated.

---

## 3.4 Prosody / F0 Analysis

Analyze how speech changes over time.

Extract features such as:

- F0 / pitch mean
- F0 standard deviation
- F0 range
- energy mean
- energy variation
- pause ratio
- speaking rate
- voiced/unvoiced statistics
- pitch movement

### First ML model

Use a lightweight model such as:

- Random Forest
- XGBoost
- Logistic Regression

Do not use a large neural network for this component initially.

---

## 3.5 Watermark / Provenance Detection

### Purpose

Detect supported invisible AI-audio watermark schemes.

### Important limitation

Watermark detection is **scheme-specific**.

Therefore:

```text
watermark found
    ≠ universal proof that all AI systems were detected

watermark not found
    ≠ proof that audio is human
```

Keep watermark output separate from acoustic AI probability.

Possible states:

```text
FOUND
NOT_FOUND
UNSUPPORTED
ERROR
```

---

## 3.6 Master / Fusion Model

The fusion model does not need to process raw audio directly.

It receives evidence from the specialized components.

Example feature vector:

```text
wav2vec_fake_probability
aasist_spoof_probability
prosody_score
spectrogram_score
watermark_found
audio_quality
duration
```

Example:

```text
[
  0.84,
  0.79,
  0.68,
  0.81,
  0.0,
  0.73
]
```

### Initial fusion approach

Start simple:

```text
Logistic Regression
```

or:

```text
XGBoost
```

Only use a more complex neural fusion model when experiments demonstrate that it is useful.

---

# 4. Final Version-1 ML Stack

| Component | Initial technology | Purpose |
|---|---|---|
| Primary detector | Wav2Vec2-based pretrained detector | Synthetic speech classification |
| Anti-spoof detector | AASIST | Independent spoof evidence |
| Audio processing | Librosa + NumPy + SciPy | Signal processing |
| Spectrogram | STFT / Mel features | Frequency/time evidence + visualization |
| Prosody | F0 + energy + timing features | Speaking-pattern evidence |
| Prosody classifier | Random Forest / XGBoost | Prosody-based score |
| Watermark | Scheme-specific detector | Provenance evidence |
| Fusion | Logistic Regression / XGBoost | Final combined score |
| API | FastAPI + Uvicorn | Serve AI inference |
| Runtime | PyTorch + ONNX Runtime | Model execution |

---

# 5. Development Strategy

## Phase 1 — Environment

Set up:

- Python 3
- Python virtual environment
- CPU PyTorch
- Transformers
- Hugging Face Hub
- Librosa
- SoundFile
- NumPy
- SciPy
- scikit-learn
- pandas
- matplotlib
- FastAPI
- Uvicorn
- python-multipart
- ONNX Runtime
- Git

### Server constraints

The current target server is an older Ubuntu laptop/server with limited RAM and no suitable CUDA GPU.

Therefore:

- Prefer CPU inference.
- Avoid unnecessarily large models.
- Avoid loading multiple huge models simultaneously until tested.
- Do not train large models on the server.
- Keep training/fine-tuning available for a GPU environment later.

---

# 6. Repository Structure

The `AI-Model` folder should eventually look like:

```text
AI-Model/
│
├── .venv/
│
├── app/
│   ├── main.py
│   ├── api/
│   ├── services/
│   │   ├── wav2vec_service.py
│   │   ├── aasist_service.py
│   │   ├── spectrogram_service.py
│   │   ├── prosody_service.py
│   │   ├── watermark_service.py
│   │   └── fusion_service.py
│   ├── schemas/
│   └── utils/
│
├── models/
│   ├── wav2vec2/
│   ├── aasist/
│   └── huggingface/
│
├── data/
│   ├── samples/
│   ├── test/
│   └── datasets/
│
├── experiments/
│
├── scripts/
│   ├── download_models.py
│   └── env.sh
│
├── tests/
│
├── logs/
│
├── requirements.txt
├── .gitignore
└── README.md
```

---

# 7. Git Rules

This repository is shared with:

```text
Audio-DeepCheck/
├── AI-Model/
├── Backend/
└── Frontend/
```

The AI agent must obey:

### Never modify automatically

```text
Backend/
Frontend/
```

unless the human developer explicitly requests cross-folder integration work.

### Never create a second Git repository

Do not run:

```bash
git init
```

inside `AI-Model/`.

The parent repository remains the single Git repository.

### Never commit

- `.venv/`
- model weights
- large datasets
- audio samples
- Hugging Face cache
- secret tokens
- `.env`

unless explicitly requested.

---

# 8. Model Download Order

Do NOT download everything at once.

Use this order:

```text
1. Python environment
2. PyTorch
3. Audio libraries
4. Wav2Vec2 detector
5. Test Wav2Vec2
6. AASIST
7. Test AASIST
8. Spectrogram
9. F0 / Prosody
10. Fusion
11. FastAPI
12. Watermark
13. Fine-tuning
14. Real-time streaming
```

---

# 9. Initial Wav2Vec2 Test

The first milestone is:

```text
sample.wav
    ↓
Python
    ↓
Wav2Vec2
    ↓
REAL / FAKE + scores
```

Create a small test script before creating FastAPI.

The test must prove that:

1. The Python environment works.
2. The model loads.
3. Audio can be read.
4. Audio is converted to the model's expected format.
5. Inference works.
6. The result is printed clearly.

---

# 10. Audio Preprocessing Standard

Our pipeline should normalize input audio before model inference.

Initial target:

```text
Channels: Mono
Sample rate: 16,000 Hz
Floating point waveform
```

But each model's exact input requirements must be checked before implementation.

Never assume all models have identical preprocessing requirements.

---

# 11. Long Audio Handling

The first public Wav2Vec2 model is not intended for arbitrarily long files.

Therefore:

```text
Long call recording
        ↓
quality check
        ↓
split into short overlapping chunks
        ↓
run detectors per chunk
        ↓
aggregate results
```

Later this becomes the basis of real-time analysis.

---

# 12. Phone-Call Data Strategy

This is critical for the project.

A clean synthetic dataset is not enough.

Eventually create:

```text
data/datasets/phone-call/
├── real/
└── synthetic/
```

Include:

### Human samples

- Different speakers
- Different phones
- Different environments
- Different call conditions

### Synthetic samples

- Different TTS systems
- Different voice-cloning systems
- Different speakers/voices
- Different recording conditions
- Phone-call transmission before recording

The model should learn synthetic artifacts, not simply memorize speakers/devices.

---

# 13. Dataset Progression

Use this order:

```text
Level 1
Small manually selected audio
        ↓
Level 2
Small public deepfake-audio dataset
        ↓
Level 3
Our phone-call dataset
        ↓
Level 4
ASVspoof benchmark datasets
        ↓
Level 5
Combined evaluation dataset
```

Do not download very large benchmarks before the initial inference pipeline works.

---

# 14. Fine-Tuning Strategy

Do not train from scratch.

Use:

```text
pretrained model
      +
our labeled data
      ↓
fine-tuned model
```

Recommended progression:

### First

Fine-tune Wav2Vec2 on a small public dataset.

### Then

Evaluate against unseen audio.

### Then

Fine-tune with our phone-call dataset.

### Then

Evaluate on completely held-out speakers and recordings.

---

# 15. Evaluation

Do not report only accuracy.

Track:

- Accuracy
- Precision
- Recall
- F1
- ROC-AUC
- Confusion matrix
- EER where appropriate

Always separate:

```text
training
validation
test
```

The test set must remain unseen until final evaluation.

---

# 16. Avoid Dataset Leakage

The same speaker should not appear in both training and test in a way that allows speaker memorization to make the result look better.

Where metadata allows it, use speaker-disjoint splits.

Likewise, avoid having nearly identical recordings in both training and test.

---

# 17. Explainability Requirement

The final API should not return only:

```json
{
  "result": "AI"
}
```

It should return evidence.

Example:

```json
{
  "assessment": "POSSIBLY_SYNTHETIC",
  "synthetic_probability": 0.86,
  "evidence": {
    "wav2vec2": {
      "fake_probability": 0.84
    },
    "aasist": {
      "spoof_probability": 0.79
    },
    "prosody": {
      "score": 0.68
    },
    "spectrogram": {
      "score": 0.81
    },
    "watermark": {
      "status": "NOT_FOUND"
    }
  }
}
```

---

# 18. Confidence Language

The application must avoid pretending that detection is perfect.

Use:

```text
LIKELY_HUMAN
LIKELY_SYNTHETIC
UNCERTAIN
```

and/or:

```text
synthetic_probability = 0.86
```

Do not display:

```text
100% AI
```

unless a future provenance system provides definitive evidence for a supported watermark scheme.

---

# 19. Watermark Logic

Watermark evidence must be handled separately.

Example:

```text
watermark = FOUND
```

may be strong provenance evidence.

But:

```text
watermark = NOT_FOUND
```

must never automatically increase the human probability to 100%.

The system must support:

```text
FOUND
NOT_FOUND
UNSUPPORTED
ERROR
```

---

# 20. Real-Time Architecture — Later

Once offline analysis works:

```text
Audio stream
    ↓
1–3 second chunks
    ↓
audio preprocessing
    ↓
Wav2Vec2
AASIST
F0
Spectrogram
    ↓
rolling aggregation
    ↓
fusion model
    ↓
live synthetic probability
```

Example UI data:

```json
{
  "timestamp": 12.0,
  "synthetic_probability": 0.78
}
```

Do not implement streaming first.

Offline analysis must work first.

---

# 21. FastAPI Architecture — Later

The AI service will eventually expose endpoints such as:

```text
POST /api/v1/analyze
POST /api/v1/analyze/chunk
GET  /api/v1/health
GET  /api/v1/models
```

Example:

```text
Spring Boot Backend
        │
        │ HTTP
        ▼
AI-Model FastAPI
        │
        ├── Wav2Vec2
        ├── AASIST
        ├── Prosody
        ├── Spectrogram
        ├── Watermark
        └── Fusion
```

The FastAPI service is the only application that runs from `AI-Model`.

---

# 22. Integration Boundary

### AI-Model owns

- Python
- ML models
- audio processing
- inference
- fusion
- FastAPI AI service

### Backend owns

- Spring Boot
- business logic
- authentication
- database
- user/call records
- calling the AI service

### Frontend owns

- UI
- live visualization
- audio upload
- model/evidence display

Do not mix these responsibilities unnecessarily.

---

# 23. Development Milestones

## Milestone 1 — Environment

```text
Python works
PyTorch works
audio libraries work
```

## Milestone 2 — Audio basics

```text
Load WAV
Waveform
Spectrogram
F0
```

## Milestone 3 — Wav2Vec2

```text
Load model
Run prediction
```

## Milestone 4 — AASIST

```text
Load model
Run prediction
```

## Milestone 5 — Evidence extraction

```text
Wav2Vec2 score
AASIST score
Spectrogram features
F0/prosody features
```

## Milestone 6 — Fusion

```text
features
 ↓
fusion model
 ↓
synthetic probability
```

## Milestone 7 — API

```text
POST audio
 ↓
JSON result
```

## Milestone 8 — Phone-call dataset

```text
real call recordings
synthetic call recordings
```

## Milestone 9 — Fine-tuning

```text
pretrained model
 +
phone-call data
 ↓
custom detector
```

## Milestone 10 — Real-time

```text
streaming chunks
 ↓
rolling prediction
```

---

# 24. Rules for the AI Coding Agent

The AI coding agent must:

1. Read this document before modifying code.
2. Work only inside `AI-Model/` by default.
3. Never modify `Backend/` or `Frontend/` without explicit permission.
4. Make small, testable changes.
5. Explain what it changed and why.
6. Run tests after meaningful changes.
7. Never silently download huge datasets.
8. Ask before starting a long training job.
9. Prefer pretrained models before implementing training from scratch.
10. Keep CPU compatibility for the current server.
11. Never hard-code secrets or credentials.
12. Never commit model weights or large datasets to Git.
13. Keep model-loading code separate from API code.
14. Keep preprocessing deterministic and documented.
15. Never claim that a detector is 100% accurate.
16. Record model name/version/configuration in code and documentation.
17. Add unit tests for preprocessing and output schemas.
18. Do not create unnecessary dependencies.
19. Do not replace working implementations with speculative rewrites.
20. When uncertain, inspect official documentation/source first.

---

# 25. AI Agent Working Style

The AI coding agent should work in this loop:

```text
UNDERSTAND
   ↓
PLAN
   ↓
IMPLEMENT SMALL CHANGE
   ↓
RUN TEST
   ↓
CHECK RESULT
   ↓
DOCUMENT
   ↓
MOVE TO NEXT STEP
```

Never perform the entire project in one giant modification.

---

# 26. First Task For The Agent

The first task is ONLY:

### Environment setup and verification

It should:

1. Inspect the current `AI-Model` directory.
2. Verify Python version.
3. Create `.venv` if missing.
4. Install required packages.
5. Create the planned directory structure.
6. Create `.gitignore`.
7. Create `requirements.txt`.
8. Verify PyTorch CPU operation.
9. Download the Wav2Vec2 model.
10. Run a minimal model-loading test.
11. Report the result.

It must NOT:

- build FastAPI yet
- modify Backend
- modify Frontend
- download large datasets
- fine-tune models
- train models
- implement a giant architecture

---

# 27. Definition of Done for the First Task

The first milestone is complete only if:

```text
✅ .venv exists
✅ Python can execute
✅ PyTorch imports
✅ CUDA status is known
✅ Transformers imports
✅ Librosa imports
✅ Wav2Vec2 model downloads
✅ Wav2Vec2 model loads
✅ A local sample WAV can be passed to the model
✅ A prediction is printed
```

Only after all of these pass should the agent move to AASIST.

---

# 28. Long-Term Goal

The final AI application should provide:

```text
INPUT
Recorded phone-call audio
        ↓
PREPROCESS
        ↓
MULTI-MODEL ANALYSIS
        ├── Wav2Vec2
        ├── AASIST
        ├── Spectrogram
        ├── Prosody/F0
        └── Watermark
        ↓
FUSION
        ↓
FINAL ASSESSMENT
        ↓
Evidence + Probability + Explainable Analysis
```

The system should be treated as an **audio forensic probability system**, not an infallible oracle.

---

# 29. Current Priority

**Current priority:**

> Get one real audio file through the Wav2Vec2 pretrained detector on the Ubuntu server.

Everything else comes after that.

---

# 30. Do Not Skip Ahead

Do not implement all components at once.

Required sequence:

```text
Wav2Vec2
  ↓
AASIST
  ↓
Spectrogram
  ↓
Prosody/F0
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
```

This order is intentional because it keeps the system debuggable and gives us a working milestone at every stage.
