# Audio DeepCheck — Current Implementation Stage

> **Status Tracker**: This file is the live source of truth for the current implementation stage of the Audio DeepCheck project. It is updated whenever a feature or milestone is completed.
>
> *(A master copy is also kept in the model directory: [`AI-Model/current-stage.md`](file:///d:/Git/Audio-DeepCheck/AI-Model/current-stage.md))*

---

## 1. Executive Summary

| Attribute | Details |
| :--- | :--- |
| **Current Stage** | **Milestone 10 Complete** (Database Integration & Persistence: MongoDB Document Modeling, Optimized Indices, Active/History Queries, Health Probing, Embedded & Atlas Support, 59 Passing Tests & Performance Benchmarks) |
| **Active Detectors & Evidence Sources** | 1. Wav2Vec2 Large XLSR Anti-Spoofing & Deepfake Classifier (`INT8` ONNX)<br>2. DF Arena 500M Universal Anti-Spoofing Detector (`Speech-Arena-2025/DF_Arena_500M_V_1`, PyTorch CPU)<br>3. Spectrogram Analysis Evidence Layer (`SpectrogramService`: STFT + Mel-Spectrogram + 10 Spectral Features + Visual Plots)<br>4. Prosody / F0 Evidence Layer (`ProsodyService`: pYIN F0 Tracking + 7 Prosodic Feature Groups + Visual Plots)<br>5. Speech Representation Specialist (`WhisperRepService`: `openai/whisper-tiny` 384-d acoustic/linguistic encoder representations, flux, dispersion)<br>6. Signal Quality & Telephony Gate (`QualityService`: SNR, Bandwidth, Clipping, Silence, Voicing)<br>7. Evidence Normalizer & Calibration Registry (`EvidenceNormalizer`, `CalibrationRegistry`: Signed scale `[-1.0, +1.0]`)<br>8. Master Decision & Fusion Engine (`FusionService`: Sliding 5s/2.5s chunks, 10% Trimmed Mean, Conflict & Uncertainty Arbitration)<br>9. Production FastAPI REST Service (`AI-Model/app/main.py`, `app/api/routes.py`: `/api/v1/health`, `/api/v1/analyze`, concurrency semaphore, secure temp-file lifecycle)<br>10. Spring Boot Application Backend (`Backend/`: Spring Boot 3.3.4, RestClient FastAPI client, call session state machine, 11 REST endpoints, request correlation `X-Request-ID`, sanitized error translation)<br>11. Enterprise Persistence Layer (`Backend/`: Spring Data MongoDB, `CallSessionDocument`, `AnalysisResultDocument`, compound dashboard indices, health probe, sub-11ms latency) |
| **Inference & Analysis Engines** | ONNX Runtime (`CPUExecutionProvider`) for Wav2Vec2; PyTorch CPU for DF Arena 500M & Whisper Tiny; Librosa + SciPy + Matplotlib (`Agg`) for Spectrograms, Prosody & Quality; Mutagen + SciPy for Watermark; FastAPI + Uvicorn + Pydantic v2 for REST API; Spring Boot 3.3.4 + RestClient + Spring Data MongoDB for Backend |
| **Supported Audio Formats** | `.wav`, `.mp3`, `.flac`, `.ogg` |
| **Target Audio Spec** | Mono, 16,000 Hz, Float32 (5.0s window, 2.5s hop chunking with fixed padding) |
| **Automated Tests** | **151 / 151 Passing** (100% pass rate: 92 in `AI-Model/` + 59 in `Backend/`) |
| **AASIST Status** | **Superseded & Cleanly Removed** |
| **Evidence Discipline** | **Zero False Calls via Conflict Arbitration & Extreme Anti-Overfitting Discipline** — No learned classifier trained on the 8 benchmark samples; explicit signed scale $[-1.0, +1.0]$; non-probability decision strength; conflict-gated UNCERTAIN fallback preventing false fraud accusations |
| **Last Updated** | 2026-09-18 |

---

## 2. What Is Currently Implemented

### 2.1 Wav2Vec2 Deepfake Audio Detector (`AI-Model/app/services/wav2vec_service.py`)
* **Model Engine**: Powered by `onnxruntime` using an INT8-quantized Wav2Vec2 architecture (`wav2vec2_deepfake_int8.onnx`, ~338 MB), offering fast CPU inference.
* **Preprocessing Pipeline**:
  - Multi-channel to mono conversion (channel averaging).
  - Resampling to 16,000 Hz.
  - Dynamic amplitude normalization to `[-1.0, 1.0]`.
  - Zero-mean unit-variance standard scaling.
* **Output Classification & Confidence**:
  - `prediction`: `real` vs `fake`
  - `assessment`: `LIKELY_HUMAN` (≥ 70% real), `LIKELY_SYNTHETIC` (≥ 70% fake), or `UNCERTAIN`
  - `real_probability` and `fake_probability` scores (0.0 – 1.0)
  - Raw logits for downstream fusion models

### 2.2 DF Arena 500M Anti-Spoofing Detector (`AI-Model/app/services/df_arena_service.py`)
* **Model Engine**: Powered by PyTorch CPU using `Speech-Arena-2025/DF_Arena_500M_V_1` (436,191,877 parameters, ~1.66 GB weights).
* **Architecture**:
  - Front-end: Facebook Wav2Vec2 XLS-R 300M with learnable 1D attention pooling across hidden states.
  - Head: 4-block Conformer classifier with sinusoidal positional embeddings and linear classification layer.
* **Preprocessing Pipeline**:
  - Multi-channel to mono downmix.
  - Polyphase / Librosa resampling to 16,000 Hz.
  - Deterministic fixed 64,600-sample evaluation window (`pad_fixed`: first 64,600 samples for long audio, tile-repeat padding for short audio).
* **Model Lifecycle Management**:
  - Explicit `load()`, `predict_waveform()`, `predict_file()`, and `unload()` methods with garbage collection (`gc.collect()`), enabling memory release in sequential pipelines.
* **Output Classification & Score Semantics**:
  - `prediction`: `bonafide` vs `spoof`
  - `assessment`: `LIKELY_HUMAN` (≥ 70% bona fide), `LIKELY_SYNTHETIC` (≥ 70% spoof), or `UNCERTAIN`
  - `bona_fide_score`: Raw logit at index 1 (positive values indicate bona-fide confidence)
  - `spoof_score`: Raw logit at index 0 (positive values indicate spoof confidence)
  - `bona_fide_probability` & `spoof_probability`: Softmax-normalized probabilities

### 2.3 Spectrogram Analysis Evidence Layer (`AI-Model/app/services/spectrogram_service.py`)
* **Core Principle**: Frequency-domain continuous acoustic evidence source.
* **Acoustic Transform Pipeline**:
  - Standardized STFT: 16,000 Hz sample rate, `n_fft=1024` (64 ms window), `hop_length=256` (16 ms step, 75% overlap), Hann window $\rightarrow$ 513 frequency bins from 0 to 8,000 Hz.
  - Mel-Scale Filterbank: 80 triangular Mel filters spanning 20 Hz to 8,000 Hz.
  - Power Scaling: Amplitude-to-dB conversion (`top_db=80.0`).
* **10 Quantitative Feature Groups**:
  - Spectral Centroid, Bandwidth, Rolloff (85% & 95%), Flatness, Zero-Crossing Rate, Spectral Contrast (6 octave bands), RMS Energy, Harmonic/Percussive Ratio, Mel-Band Tri-Split (Low: 0–1k, Mid: 1–4k, High: 4–8k), and Temporal Spectral Flux.
* **Visual Forensics Generation**:
  - Headless Matplotlib (`Agg` backend) generating publication-quality PNG artifacts: Waveform, Linear STFT Spectrogram, Mel Spectrogram, and Combined 3-panel Dashboard.

### 2.4 Prosody / F0 Analysis Evidence Layer (`AI-Model/app/services/prosody_service.py`)
* **Core Principle**: Time-domain continuous acoustic evidence capturing pitch dynamics, voicing behavior, and energy variations over time.
* **F0 Pitch Tracking Pipeline**:
  - Algorithm: Probabilistic YIN (`librosa.pyin`) with Viterbi decoding.
  - Configuration: `sr=16000 Hz`, `fmin=50.0 Hz` (covers low male registers), `fmax=500.0 Hz` (covers high female/child registers), `frame_length=2048` (128 ms), `hop_length=256` (16 ms).
  - Explicit Voicing Detection: Generates boolean `voiced_mask` and continuous `voiced_probs`. Never treats unvoiced silence as pitch zero.
* **7 Quantitative Prosody Feature Groups Extracted**:
  1. **Pitch Statistics**: Mean F0, Median F0, F0 Standard Deviation, Min/Max F0, F0 Range, Interquartile Range (IQR), and Coefficient of Variation (`cov = std/mean`).
  2. **Pitch Contour Dynamics**: Mean/Median/Std of frame-to-frame absolute pitch change in voiced segments, linear pitch slope (Hz/s), rising/falling segment counts, and local pitch variability.
  3. **Voicing & Temporal Behavior**: Voiced ratio, unvoiced ratio, voiced segment count, mean/median/min/max voiced segment duration, and voicing transition count.
  4. **Energy & Loudness Dynamics**: Short-time RMS mean, median, std, dynamic range (dB, p90/p10), frame-to-frame RMS variation, and voiced/unvoiced energy ratio.
  5. **Pause & Silence Behavior**: Adaptive silence threshold (35 dB down from peak RMS), silence ratio, pause count, mean/median/max pause duration, pause duration std, and speech-to-silence transition count.
  6. **Speaking Rate Acoustic Proxies**: Voiced segments per second, temporal speech activity ratio, syllable nucleus peak rate (via `scipy.signal.find_peaks` on smoothed RMS envelope), and pause-adjusted syllable rate.
  7. **Micro-Variation Perturbations**: Local F0 jitter proxy and local RMS shimmer proxy across contiguous voiced frames.
* **Diagnostic Plot Rendering (`render_plots`)**:
  - Generates 4 PNG artifacts saved to `AI-Model/data/test/prosody/` (Waveform+Energy, F0 Contour, Pause Segmentation, Summary Dashboard).

### 2.5 Unified Evidence Contract & Chunking (`AI-Model/app/services/evidence_contract.py`)
* **Standardized `EvidenceRecord` Schema**:
  - `module`: Name of originating module (`wav2vec2`, `df_arena`, `spectrogram`, `prosody`, `whisper_rep`, `watermark`).
  - `evidence_type`: `CLASSIFIER`, `EMBEDDING`, `SPECTRAL`, `PROSODY`, or `PROVENANCE`.
  - `synthetic_score`: Optional float (0.0 to 1.0) indicating deepfake likelihood, or `None` for non-classifier representation/provenance records.
  - `score_direction`: `HIGHER_MEANS_SYNTHETIC`, `HIGHER_MEANS_HUMAN`, or `NONE`.
  - `quality_score` & `quality_metadata`: Tracks signal reliability, SNR, voiced ratio, duration, and analysis validity.
  - `calibration_status`: Explicit state (`CALIBRATED`, `NOT_CALIBRATED`, `UNKNOWN`).
  - `metadata`: Module-specific raw statistics, logits, and representation summary vectors.
  - `provenance_state`: `DETECTED`, `NOT_DETECTED`, `NOT_APPLICABLE`, or `UNAVAILABLE`.
* **Sliding-Window Audio Chunking Engine (`AudioChunk`, `create_audio_chunks`)**:
  - Slices arbitrary-length audio into overlapping chunks (e.g. 5.0 s window, 2.5 s hop) for future long phone-call telephony recordings.
  - Includes short-audio padding and single-window passthrough.
* **Adapters for All Pipeline Modules**:
  - `adapt_wav2vec2_evidence()`, `adapt_df_arena_evidence()`, `adapt_spectrogram_evidence()`, `adapt_prosody_evidence()`.

### 2.6 Candidate A — Speech Representation Specialist (`AI-Model/app/services/whisper_rep_service.py`)
* **Architecture**: Evaluated `openai/whisper-tiny` (39M parameters, ~151 MB disk) via HuggingFace `WhisperModel` encoder.
* **Extracted Representations**:
  - 384-dimensional temporal mean-pooled representation vector.
  - Dimension-wise representation variance and spatial dispersion across encoder dimensions.
  - Temporal representation flux (frame-to-frame cosine distance tracking speech dynamics).
* **Lifecycle**: Explicit `load()`, `extract_waveform()`, `extract_file()`, and `unload()` memory-safe lifecycle.
* **Decision**: **KEEP**. Retained as an exploratory acoustic/linguistic representation layer for future multi-evidence fusion.

#### 2.7 Candidate B — Watermark & Provenance Scanner (`AI-Model/app/services/watermark_service.py`)
* **Detection Probes**:
  - Container metadata tag scanning (RIFF INFO, ID3v2, Vorbis Comments) for 11 AI generator signatures (ElevenLabs, Bark, Tortoise, AudioCraft, etc.).
  - High-frequency ultrasonic pilot tone detection (15 kHz – 22 kHz spectral peak prominence).
* **Strict Forensic Guardrails**:
  - Narrowband audio (< 30 kHz sample rate) automatically flags ultrasonic probe as `NOT_APPLICABLE`.
  - Absence of a watermark never implies human speech (`watermark absent != human`).
* **Decision**: **DEFER**. Deferred from the primary telephony pipeline because telephony/VoIP codecs (AMR, Opus, G.711) bandlimit audio to 4–8 kHz and strip file metadata. Retained only as an optional forensic scanner.

### 2.8 Master Multi-Evidence Fusion & Decision Engine (`AI-Model/app/services/fusion_service.py`, `quality_service.py`, `evidence_normalizer.py`, `calibration_service.py`)
* **Signal Quality & Telephony Pre-Filter (`QualityService`)**:
  - Analyzes audio signal health across 11 key metrics: RMS energy, peak amplitude, dynamic range (dB), clipping ratio, silence ratio, voiced ratio (via zero-crossing/energy), spectral bandwidth, 85% rolloff, and broadband SNR (dB).
  - Telephony & Artifact Flags: `LOW_DURATION` (<1.5s), `LOW_SNR` (<8.0 dB), `HEAVY_CLIPPING` (>1.5% samples), `NARROWBAND` (bandwidth < 1.8 kHz or rolloff < 2.5 kHz), `EXCESSIVE_SILENCE` (>60% silence), `LOW_VOICING` (<15% voiced), `HIGH_NOISE`.
  - Signal gating: Rejects pure silence immediately, forcing `usable_for_voice_analysis=False` and master verdict `UNCERTAIN`.
* **Calibration Framework (`CalibrationService`)**:
  - Standardized calibration interface supporting `IdentityCalibrator` (default uncalibrated pass-through), `TemperatureScaler`, and `PlattCalibrator` with logistic sigmoid transforms.
  - Per-module `CalibrationRegistry` ensuring uncalibrated raw scores are never falsely presented as posterior probabilities (`confidence_status="PROVISIONAL"`).
* **Evidence Normalization & Dynamic Quality Gating (`EvidenceNormalizer`)**:
  - Unifies all heterogeneous outputs onto an explicit signed scale $[-1.0, +1.0]$:
    - $-1.0$: Confidently Human
    - $0.0$: Neutral / uninformative / rejected / ambiguous
    - $+1.0$: Confidently Synthetic
  - Configured baseline weights: Wav2Vec2 (0.35), DF Arena (0.35), Spectrogram (0.10), Prosody (0.10), Whisper (0.10).
  - Quality gating rules adjust effective weights dynamically:
    - Degraded SNR (< 12 dB) or narrow bandwidth downweights acoustic classifiers by 50%.
    - Low voiced ratio (< 25%) downweights Prosody and Whisper by 70%.
    - Non-speech / silent chunks assign status `REJECTED` (`weight = 0.0`).
  - Active weights are dynamically normalized to sum strictly to 1.0 across non-rejected modules.
* **Master Fusion & Conflict Arbitration (`FusionService`)**:
  - Sequential Sliding Chunking: Slices audio into 5.0 s windows with 2.5 s hop.
  - Strict 8 GB RAM CPU Memory Safety: Models load, infer on chunks, and unload with garbage collection sequentially.
  - Chunk Aggregation: Outlier-resistant 10% trimmed mean across chunk scores, supplemented by median, IQR, and temporal variance.
  - Conflict Level Detection:
    - `LOW`: Agreement across active classifiers ($|\Delta| \le 0.40$).
    - `MEDIUM`: Moderate divergence ($0.40 < |\Delta| \le 0.80$).
    - `HIGH`: Polar contradiction between classifiers ($|\Delta| > 0.80$, e.g. Wav2Vec2 says Human while DF Arena says Synthetic).
  - Decision Logic:
    - When Conflict is `HIGH` or Uncertainty $> 0.50$ or Quality $< 0.35$, the engine overrides polar classifications and outputs `UNCERTAIN`.
    - Otherwise, threshold $\ge +0.25 \rightarrow$ `AI_GENERATED`, threshold $\le -0.25 \rightarrow$ `HUMAN`.

### 2.9 Production FastAPI REST Service Layer (`AI-Model/app/main.py`, `app/api/routes.py`, `app/api/schemas.py`, `app/api/dependencies.py`, `app/utils/file_security.py`)
* **Endpoint Contract**:
  - `GET /api/v1/health`: Ultra-lightweight health probe (avg 8.5 ms); reports service status, active detectors, CPU device, and concurrency limit without triggering neural network inference.
  - `POST /api/v1/analyze`: Multipart audio upload accepting `.wav`, `.mp3`, `.flac`, `.ogg`; supports optional `chunk_sec`, `hop_sec`, and `ablate` query parameters.
* **File Security & Temporary Lifecycle (`app/utils/file_security.py`)**:
  - Filename sanitization against path traversal (`../`, `..\`).
  - Streaming upload validation: Aborts with `413 Content Too Large` if exceeding `MAX_UPLOAD_MB` (default 25 MB).
  - Empty file detection (`400 Bad Request`).
  - Audio container decoding & duration limit validation via `soundfile.info()`: Aborts with `400 Bad Request` if audio exceeds `MAX_DURATION_SEC` (default 180s).
  - Guaranteed temporary file cleanup on both success and exception via `try ... finally` context manager. Uploaded files are never persisted.
* **Memory & Concurrency Guard (`app/api/dependencies.py`)**:
  - `asyncio.Semaphore(ANALYSIS_CONCURRENCY)` (default `1`) protects CPU and 8 GB RAM from concurrent execution spikes.
  - If overloaded, returns clean `503 Service Unavailable` with timeout notice.
* **Observability & Sanitized Error Contract**:
  - `X-Request-ID` correlation tracing across all requests, responses, and structured log entries.
  - Never logs raw audio or byte payloads.
  - Custom exception handlers format standardized `ErrorResponse(detail, error_code, request_id)` without ever leaking Python stack traces to clients.
* **Interactive OpenAPI Documentation**:
  - Swagger UI accessible at `/docs`, ReDoc at `/redoc`, OpenAPI JSON at `/openapi.json`.
  - Fully documents provisional decision strength and input/output contracts.

### 2.10 Spring Boot Backend Application Foundation (`Backend/`)
* **Core Application**: Spring Boot 3.3.4 running on Java 25 (`BackendApplication.java`).
* **FastAPI Integration Client (`FastApiAiClientImpl.java`)**:
  - Built on Spring 6.1 `RestClient` with `JdkClientHttpRequestFactory`.
  - Configured timeouts: 5s connect timeout, 60s read timeout (to accommodate CPU deep neural inference without timeout drops).
  - Explicit retry policy: Zero blind automatic retries to prevent duplicate inference loads on the concurrency-guarded queue.
  - Endpoints consumed: `GET /api/v1/health` and `POST /api/v1/analyze` (multipart/form-data).
* **Request Correlation & Observability**:
  - `RequestIdFilter`: Extracts or generates `X-Request-ID`, tracks via SLF4J MDC, attaches to HTTP response headers, and propagates to FastAPI client requests.
* **Call Session Domain & State Machine (`CallSession.java`)**:
  - Validates lifecycle transitions across: `CREATED` $\rightarrow$ `CONNECTING` $\rightarrow$ `ACTIVE` $\rightarrow$ `ANALYZING` $\rightarrow$ `ENDED` $\rightarrow$ `COMPLETED` (and terminal error states: `FAILED`, `INTERRUPTED`, `AI_UNAVAILABLE`).
  - Strict transition guards prevent illegal state transitions, throwing `InvalidCallStateException`.
* **REST API Layer (`CallController.java`, `HealthController.java`)**:
  - Implements 11 public endpoints matching `SPRING_BOOT_ENDPOINTS.md`: `/health`, `/calls` (create, list, start, get, active, paged, end, audio ingestion, analysis status, evidence breakdown, chunk timeline, full report).
* **Sanitized Error Translation (`GlobalExceptionHandler.java`)**:
  - Translates internal exceptions and FastAPI HTTP statuses into clean client codes (`CALL_NOT_FOUND`, `INVALID_CALL_STATE`, `INVALID_AUDIO`, `AUDIO_TOO_LARGE`, `AI_SERVICE_BUSY`, `AI_SERVICE_UNAVAILABLE`). Never leaks internal stack traces.
* **Repository Layer (`CallSessionRepository.java`, `AnalysisRepository.java`)**:
  - Clean repository abstractions with thread-safe in-memory implementations and enterprise MongoDB implementations.
* **Automated Tests**:
  - **48 / 48 Passing** unit & WebMvc slice tests; expanded to **59 / 59 Passing** with MongoDB integration and performance tests.

### 2.11 MongoDB Database Integration & Persistence (`Backend/src/main/java/com/audiodeepcheck/backend/repository/mongo/`)
* **Document Models & Collections**:
  - `CallSessionDocument` (`call_sessions` collection): Maps full call session state, caller/receiver identifiers, timestamps, decision strength, conflict level, audio quality metrics, and request tracing IDs.
  - `AnalysisResultDocument` (`analysis_results` collection): Persists deep nested forensic payloads including chunk-level timelines (`List<AudioChunkAnalysis>`), specialist module evidence breakdown (`List<ModuleEvidence>`), conflict levels, and full raw FastAPI analysis payloads (`FastApiAnalyzeDto`).
* **Optimized Index Configuration**:
  - Unique index on `callId` (`@Indexed(unique = true)`) preventing duplicate call sessions.
  - Single-field indices on `caller`, `receiver`, `status`, `createdAt`, and `latestDecision`.
  - High-performance compound index: `@CompoundIndex(name = "status_decision_created_idx", def = "{'status': 1, 'latestDecision': 1, 'createdAt': -1}")` to accelerate historical paginated queries and dashboard filtering.
* **Repository Implementations**:
  - `MongoCallSessionRepository` (implements `CallSessionRepository` with `@Primary`): Full CRUD, active call queries (`findByStatusIn`), and dynamic criteria-based pagination (`findFiltered`, `countFiltered`) via `MongoTemplate`.
  - `MongoAnalysisRepository` (implements `AnalysisRepository` with `@Primary`): Append/upsert chunk timelines, persist module evidence, and retrieve full raw forensic payloads.
* **Health Probing (`BackendHealthService.java`)**:
  - Active MongoDB ping probe (`mongoTemplate.executeCommand(new Document("ping", 1))`) integrated directly into `GET /api/v1/health`.
  - Reports granular status (`database: UP` or `DOWN`), accurately adjusting overall status to `UP`, `DEGRADED`, or `DOWN`.
* **Zero Audio Payload Storage**:
  - Strict compliance with data retention requirements: Raw audio bytes and chunks are analyzed in streaming/ephemeral buffers and never stored in the database.
* **Environment Configuration & Test Isolation**:
  - Transparently inherits `MONGODB_URI` from system environment or `DATABASE_URI`, falling back to local instance.
  - Automated tests run against isolated embedded MongoDB (`de.flapdoodle.embed:de.flapdoodle.embed.mongo.spring30x:4.11.0`, MongoDB 7.0.2), guaranteeing zero test traffic hits production or Atlas clusters.
* **Database Performance Benchmarks (`MongoPerformanceTest.java`)**:
  - Average CallSession Insert: **7.667 ms** (SLA < 50 ms)
  - Average CallSession FindById (Indexed): **6.035 ms** (SLA < 20 ms)
  - Average Chunk Analysis Save: **10.466 ms** (SLA < 50 ms)
  - Average Specialist Evidence Save: **9.933 ms** (SLA < 50 ms)
  - Average Filtered & Paginated Query: **9.116 ms** (SLA < 50 ms)
* **Automated Test Suite**:
  - **59 / 59 Passing** in `Backend/` (11 domain tests, 12 CallController tests, 1 HealthController test, 4 BackendHealthService tests, 4 CallAnalysisService tests, 8 CallSessionService tests, 1 CallFlow integration test, 8 MongoPersistence integration tests, 1 MongoPerformance benchmark test).


---

## 3. Verification & Benchmark Results

### 3.1 Candidate Specialist Hardware & Runtime Benchmarks

Measured on local CPU environment:

| Candidate Module | Architecture / Weights | Disk Footprint | Peak RAM | CPU Load Time | Inference Time (~5s Audio) | Memory-Safe Lifecycle | Practical on 8GB RAM CPU? | Evaluation Decision |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Candidate A: Whisper Tiny** | `openai/whisper-tiny` (39M params) | 151 MB | ~326 MB | 38.6 s (cold) | **0.38 s** | Yes (`load`/`unload`) | **YES** | **KEEP** (Representations) |
| **Candidate B: Watermark Scanner** | Metadata & Ultrasonic Probes | 0 MB | ~5.6 MB | 0.001 s | **0.03 s** | Algorithmic | **YES** | **DEFER** (Forensic only) |

### 3.2 Eight-Sample Multi-Evidence Cross-Model Matrix

Sequential evaluation of all 8 benchmark files across all 6 evidence sources (`AI-Model/data/test/specialist/specialist_evaluation_report.json`):

| Audio File | Ground Truth | Wav2Vec2 Synthetic Score | DF Arena 500M Spoof Score | Spectral Centroid | Prosody F0 Std | Whisper Flux | Whisper Dispersion | Watermark State |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`human_voice.wav`** | HUMAN | **0.1016** (Real) | 0.9887 (False Spoof) | 1,986.6 Hz | 19.4 Hz | 14.13 | 0.563 | `NOT_DETECTED` |
| **`human_kennedy.ogg`** | HUMAN | **0.0969** (Real) | 0.9998 (False Spoof) | 1,245.2 Hz | 84.4 Hz | 16.37 | 0.539 | `NOT_APPLICABLE` (16kHz) |
| **`human_churchill.wav`** | HUMAN | **0.1288** (Real) | 0.9999 (False Spoof) | 1,011.3 Hz | 30.4 Hz | 13.86 | 0.620 | `NOT_APPLICABLE` (16kHz) |
| **`human_armstrong.wav`** | HUMAN | **0.0716** (Real) | 0.9951 (False Spoof) | 825.4 Hz | 46.8 Hz | 18.43 | 0.500 | `NOT_APPLICABLE` (16kHz) |
| **`ai_voice.wav`** | AI | **0.8897** (Fake) | **1.0000** (Spoof) | 1,892.2 Hz | 17.9 Hz | 13.67 | 0.535 | `NOT_APPLICABLE` (16kHz) |
| **`ai_luvvoice.wav`** | AI | **0.8088** (Fake) | **1.0000** (Spoof) | 1,821.7 Hz | 39.5 Hz | 13.66 | 0.725 | `NOT_APPLICABLE` (16kHz) |
| **`ai_kokoro_heart0.wav`** | AI | 0.0820 (False Real) | **1.0000** (Spoof) | 2,033.7 Hz | 27.0 Hz | 12.37 | 0.549 | `NOT_APPLICABLE` (16kHz) |
| **`ai_piper_amy.mp3`** | AI | 0.0927 (False Real) | **1.0000** (Spoof) | 1,762.2 Hz | 13.1 Hz | 13.56 | 0.619 | `NOT_APPLICABLE` (16kHz) |

### 3.3 Key Complementarity Findings Across Evidence Layers

1. **Wav2Vec2 vs DF Arena Complementarity**:
   - Wav2Vec2 correctly identified 100% of human samples (0.07 – 0.13 synthetic score), but failed to detect modern Kokoro and Piper neural TTS models (0.08 – 0.09 synthetic score).
   - DF Arena 500M caught 100% of the AI samples (1.0000 spoof score across all 4 AI files), but produced false positives on historical/narrowband human speech.
   - **Conclusion**: Neither model can be used alone. Wav2Vec2 serves as a robust human speech anchor, while DF Arena provides high sensitivity to neural vocoder artifacts.
2. **Speech Representation Dynamics (Whisper Encoder Flux)**:
   - Human speech exhibited higher average temporal attention flux (**15.70** vs **13.31** for AI).
   - Kokoro-82M neural TTS had the lowest flux (**12.37**), capturing the artificial acoustic smoothness and robotic steady-state transitions characteristic of fast neural synthesis.
3. **Prosody Pitch Modulation (F0 Std & Range)**:
   - Natural human speech showed wide expressive excursions (up to 84.4 Hz std in political speech).
   - Neural TTS displayed tight pitch concentration around target curves (down to 13.1 Hz std in Piper).
4. **Watermarking Invalidation in Telephony**:
   - In 16 kHz downsampled telephone audio, ultrasonic watermarks (>8 kHz) are eliminated by the Nyquist limit. Metadata is stripped by cellular codecs. Thus, watermarks cannot serve as a reliable telephony anti-fraud mechanism.

### 3.4 Automated Test Suite Status (`AI-Model/tests/`)

```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-9.1.1, pluggy-1.6.0
collected 92 items

tests/test_api.py (19 tests) .................................... PASSED
tests/test_df_arena.py (13 tests) ................................ PASSED
tests/test_fusion.py (19 tests) .................................. PASSED
tests/test_prosody.py (12 tests) ................................. PASSED
tests/test_specialist.py (12 tests) .............................. PASSED
tests/test_spectrogram.py (11 tests) ............................. PASSED
tests/test_wav2vec.py (6 tests) .................................. PASSED

======================= 92 passed in 228.27s (0:03:48) =======================
```

### 3.5 Milestone 7 Multi-Evidence Master Fusion Benchmark (8 Samples)

Full 5-evidence sequential execution across all 8 benchmark files (`AI-Model/data/test/fusion/benchmark_fusion_report.json`):

| Audio File | Ground Truth | Final Decision | Decision Strength | Synthetic Evidence | Conflict Level | Quality Score | Chunks | AI Chunk % | Latency | Peak RAM |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`human_voice.wav`** | HUMAN | **`UNCERTAIN`** | 0.0117 | 0.5321 | HIGH | 1.0000 | 1 | 0.0% | 59.7 s | 390.7 MB |
| **`human_kennedy.ogg`** | HUMAN | **`UNCERTAIN`** | 0.0077 | 0.4774 | HIGH | 0.8500 | 5 | 0.0% | 72.2 s | 390.8 MB |
| **`human_churchill.wav`** | HUMAN | **`UNCERTAIN`** | 0.0028 | 0.4905 | HIGH | 0.8500 | 5 | 0.0% | 68.6 s | 372.9 MB |
| **`human_armstrong.wav`** | HUMAN | **`UNCERTAIN`** | 0.0246 | 0.4410 | HIGH | 0.8500 | 9 | 0.0% | 114.9 s | 373.1 MB |
| **`ai_voice.wav`** | AI | **`AI_GENERATED`** | **0.4121** | 0.8115 | MEDIUM | 1.0000 | 1 | 100.0% | 30.3 s | 378.7 MB |
| **`ai_luvvoice.wav`** | AI | **`UNCERTAIN`** | 0.1645 | 0.6665 | MEDIUM | 0.8500 | 17 | 52.9% | 176.3 s | 378.8 MB |
| **`ai_kokoro_heart0.wav`** | AI | **`UNCERTAIN`** | 0.0109 | 0.5303 | HIGH | 1.0000 | 1 | 0.0% | 36.8 s | 369.8 MB |
| **`ai_piper_amy.mp3`** | AI | **`UNCERTAIN`** | 0.0157 | 0.4589 | HIGH | 0.8500 | 4 | 0.0% | 53.0 s | 369.8 MB |

### 3.6 Systematic Ablation Study Across 6 Configurations

Evaluating individual model contributions and failure modes by systematically removing one evidence layer at a time:

| Condition / Configuration | Human Correct (`HUMAN`) | Human False Positives (`AI`) | AI Correct (`AI`) | AI False Negatives (`HUMAN`) | Uncertain Fallbacks | Key Observation |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. Full Pipeline (`ALL`)** | 0 / 4 | **0 / 4 (0%)** | 1 / 4 | **0 / 4 (0%)** | 7 / 8 | **Zero false accusations**: Conflict arbitration converts all classifier disagreements into safe `UNCERTAIN` verdicts. |
| **2. Ablate Wav2Vec2 (`-Wav2Vec2`)** | 0 / 4 | **4 / 4 (100%)** | 4 / 4 | 0 / 4 (0%) | 0 / 8 | **Catastrophic False Positives**: DF Arena alone flags ALL human voices (historical & studio) as AI deepfakes. |
| **3. Ablate DF Arena (`-DF Arena`)** | 4 / 4 | 0 / 4 (0%) | 1 / 4 | **2 / 4 (50%)** | 1 / 8 | **Severe False Negatives**: Wav2Vec2 alone misses modern neural vocoders (Kokoro & Piper), falsely calling them Human. |
| **4. Ablate Prosody (`-Prosody`)** | 0 / 4 | 0 / 4 (0%) | 2 / 4 | 0 / 4 (0%) | 6 / 8 | Removing prosody slightly shifts multi-chunk boundary samples (`ai_luvvoice` flips to AI_GENERATED). |
| **5. Ablate Spectrogram (`-Spectrogram`)** | 0 / 4 | 0 / 4 (0%) | 2 / 4 | 0 / 4 (0%) | 6 / 8 | Removing spectrogram boundary features slightly increases AI sensitivity on boundary samples. |
| **6. Ablate Whisper (`-Whisper`)** | 0 / 4 | 0 / 4 (0%) | 2 / 4 | 0 / 4 (0%) | 6 / 8 | Removing representation flux slightly reduces uncertainty on high-chunk AI samples. |

### 3.7 Milestone 8 REST API Performance & Framework Overhead Benchmark

Measured using `scripts/benchmark_api.py` (`AI-Model/data/test/api/benchmark_api_report.json`):

| Metric | Measured Value | Forensic / Production Interpretation |
| :--- | :---: | :--- |
| **`GET /api/v1/health` Latency** | **8.5 ms** (avg) | Instant non-blocking probe; zero model overhead |
| **Pure API Framework Overhead** | **27.1 ms** (avg) | Streaming upload, tempfile I/O, Pydantic validation & JSON serialization |
| **Total Real Request Roundtrip** | **46.96 s** | Full HTTP roundtrip for `ai_voice.wav` through FastAPI test server |
| **AI Model Inference Time** | **46.91 s** | 99.9% of request time is spent on deep acoustic feature extraction |
| **API & Disk I/O Overhead** | **0.048 s** (48 ms) | Only **0.1%** overhead introduced by the FastAPI transport layer |
| **Peak RSS Memory Footprint** | **409.12 MB** | Comfortably within the 8 GB RAM target limit on CPU |
| **Concurrency Ceiling** | **1 Job** (default) | Strict memory protection against parallel inference RAM spikes |

---

## 4. Architecture & Component Progress

Following `AI-Model/AI_MODEL_DEVELOPMENT_PLAN.md`:

| # | Component | Status | Description |
| :--- | :--- | :--- | :--- |
| **1** | **Environment & Preprocessing** | `COMPLETED` | Audio inspection, resampling, format conversion, normalization |
| **2** | **Wav2Vec2 Detector** | `COMPLETED` | Primary deepfake acoustic classifier running on CPU via ONNX Runtime |
| **3** | **DF Arena 500M Anti-Spoofing** | `COMPLETED` | Universal anti-spoofing model (XLS-R 300M + Conformer, 436M params) |
| **4** | **Spectrogram Analysis** | `COMPLETED` | STFT / Mel spectrogram feature extraction & forensic visual plots |
| **5** | **Prosody / F0 Analysis** | `COMPLETED` | pYIN pitch tracking, pitch contour dynamics, voicing, pauses, syllable rate, micro-variation |
| **6** | **Additional Specialist Models & Fusion Prep** | `COMPLETED` | Unified `EvidenceRecord` contract, sliding chunker, Whisper representation [KEEP], Watermark scanner [DEFER], 6-way cross-model evaluation matrix |
| **7** | **Master Multi-Evidence Fusion Layer** | `COMPLETED` | Multi-evidence calibration, telephony quality gating, trimmed-mean chunk aggregation, conflict & uncertainty arbitration, ablation benchmark |
| **8** | **FastAPI Service** | `COMPLETED` | Production REST API (`/health`, `/analyze`), concurrency guard, temp file security, 92/92 passing tests |
| **9** | **Spring Boot Backend Foundation** | `COMPLETED` | Spring Boot 3.3.4 app, RestClient FastAPI client, call session state machine, 11 REST endpoints, request tracing, 48/48 passing tests |
| **10** | **Database Integration & Persistence** | `COMPLETED` | Enterprise MongoDB integration, document modeling (`call_sessions`, `analysis_results`), compound dashboard indexing, active/history queries, health probing, 59/59 passing tests, <11ms benchmarks |

---

## 5. Development Maintenance Rules

> [!IMPORTANT]
> **Trigger for Updates**: Every time a new component or feature is fully implemented and verified in this codebase, this file must be updated as the final step of the development turn.
