# Audio DeepCheck — Roadmap From Current Stage

## Project Goal

Build a complete **real-time voice analysis platform** that simulates a phone call, streams the call audio to the backend, analyzes it through the AI engine, stores the results, and displays the analysis in a separate dashboard.

The project is **not focused on training new AI models**. The existing pretrained models and current fusion architecture are the AI foundation.

## Current Architecture

```text
                    ┌──────────────────────────┐
                    │ Mobile Call Simulator    │
                    │ Frontend                  │
                    │                          │
                    │ Microphone / Call UI     │
                    └────────────┬─────────────┘
                                 │
                         live audio stream
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ Spring Boot Backend      │
                    │                          │
                    │ Call Sessions            │
                    │ Voice Ingestion          │
                    │ AI Service Client        │
                    │ Database                 │
                    └───────┬──────────┬───────┘
                            │          │
                   audio/data          │ results
                            │          │
                            ▼          │
                    ┌──────────────────┐
                    │ FastAPI AI       │
                    │ Service          │
                    │                  │
                    │ Wav2Vec2         │
                    │ DF Arena         │
                    │ Spectrogram      │
                    │ Prosody/F0       │
                    │ Whisper          │
                    │ Fusion           │
                    └────────┬─────────┘
                             │
                       AI evidence/result
                             │
                             ▼
                    Spring Boot Backend
                             │
                     ┌───────┴───────┐
                     ▼               ▼
                  Database       Dashboard API
                                     │
                                     ▼
                           ┌─────────────────────┐
                           │ Dashboard Frontend  │
                           │                     │
                           │ Call list           │
                           │ Live analysis       │
                           │ Evidence            │
                           │ History             │
                           └─────────────────────┘
```

## Completed

### Milestones 1–7 — AI Engine

Completed:

- Environment
- Wav2Vec2
- DF Arena 500M
- Spectrogram evidence
- Prosody/F0 evidence
- Specialist evaluation
- Evidence contract
- Long-audio chunking
- Quality gating
- Multi-evidence fusion
- Conflict handling
- Uncertainty handling

The AI engine currently produces:

```text
HUMAN
AI_GENERATED
UNCERTAIN
```

## Milestone 8 — FastAPI AI REST Service
**Status: 🔵 CURRENT**

### Goal

Expose the existing AI engine as a Python REST service.

### Main endpoints

```text
GET  /api/v1/health
POST /api/v1/analyze
```

### Responsibilities

- audio upload
- input validation
- temporary-file management
- FusionService execution
- JSON response
- request ID
- concurrency protection
- error handling
- API tests

### Output

A stable FastAPI contract that Spring Boot can consume.

---

# Milestone 9 — Spring Boot Contract + Backend Foundation
**Complexity: 🟠 Medium–High**

### Goal

Create the Java backend that becomes the central application server.

### Responsibilities

```text
Spring Boot
├── REST API
├── Call sessions
├── Audio ingestion
├── FastAPI client
├── Database
├── History
└── Dashboard API
```

### Deliverables

- Spring Boot project structure
- configuration
- DTOs
- entities/documents
- repositories
- services
- controllers
- global exception handling
- FastAPI client
- `SPRING_BOOT_ENDPOINTS.md`

The Spring Boot endpoint document must describe the APIs used by the two frontends.

---

# Milestone 10 — Database Integration
**Complexity: 🟠 Medium**

### Recommended first choice

Use the database that fits the team's implementation speed and result structure.

Core data:

```text
User
CallSession
CallParticipant
AudioSegment / ChunkMetadata
AnalysisResult
EvidenceResult
CallEvent
```

The exact schema should be finalized during implementation rather than duplicated across multiple layers.

### Database must support

- call history
- current call state
- analysis results
- module evidence
- timestamps
- session status
- retrieval for dashboard

---

# Milestone 11 — Mobile Call Simulator Frontend
**Complexity: 🔴 High**

This is a separate frontend from the dashboard.

### Purpose

Simulate a telephone call and act as the source of live microphone audio.

### Core flow

```text
Open app
 ↓
Create / join call
 ↓
Start call
 ↓
Microphone permission
 ↓
Capture audio
 ↓
Send audio continuously
 ↓
Receive call/analysis state
 ↓
End call
```

### Important

The mobile simulator is a **voice source**, not the analytics dashboard.

---

# Milestone 12 — Live Audio Ingestion Pipeline
**Complexity: 🔴 Very High**

### Goal

Move the voice while the call is happening.

```text
Microphone
 ↓
Audio Frames
 ↓
Network Transport
 ↓
Spring Boot
 ↓
Audio Buffer / Session
```

### Requirements

- continuous audio capture
- chunk sequencing
- call/session ID
- timestamps
- missing-chunk handling
- duplicate-chunk handling
- reconnect handling
- backpressure
- stream termination

### Important design decision

Do not treat the live stream as one giant file.

Use:

```text
Call
 └── ordered audio chunks
```

---

# Milestone 13 — Spring Boot ↔ FastAPI Real-Time Analysis
**Complexity: 🔴 Very High**

### Goal

Connect the live audio ingestion layer to the AI service.

```text
Mobile
 ↓
Spring Boot
 ↓
Audio Chunk
 ↓
FastAPI
 ↓
Fusion
 ↓
AI Result
 ↓
Spring Boot
 ↓
Database
```

### Requirements

- asynchronous processing where appropriate
- analysis request IDs
- chunk indexes
- AI timeout handling
- FastAPI failure handling
- result ordering
- partial results
- final result
- uncertainty propagation

Do not change the trained/pretrained models.

---

# Milestone 14 — Call State + Analysis Persistence
**Complexity: 🟠 Medium–High**

Implement a call state machine:

```text
CREATED
 ↓
CONNECTING
 ↓
ACTIVE
 ↓
ANALYZING
 ↓
ENDED
 ↓
COMPLETED
```

Failure states may include:

```text
FAILED
INTERRUPTED
AI_UNAVAILABLE
```

Persist:

- call session
- start/end time
- chunk status
- analysis results
- evidence
- final decision

---

# Milestone 15 — Dashboard Frontend
**Complexity: 🟡 Medium**

This is a different frontend from the mobile simulator.

### Dashboard responsibilities

- active calls
- call history
- call details
- analysis status
- signal quality
- evidence breakdown
- final decision
- chunk timeline
- processing information

The dashboard communicates with:

```text
Dashboard
   ↓
Spring Boot
   ↓
Database / active analysis state
```

The dashboard should NOT directly depend on FastAPI.

---

# Milestone 16 — End-to-End Call Simulation
**Complexity: 🔴 Very High**

Validate the complete system:

```text
Mobile Simulator
      ↓
Live Audio
      ↓
Spring Boot
      ↓
FastAPI
      ↓
AI Fusion
      ↓
Spring Boot
      ↓
Database
      ↓
Dashboard
```

Test:

- human call
- AI-generated voice playback
- network interruptions
- call ending
- slow analysis
- FastAPI failure
- backend restart
- multiple chunks
- long calls

---

# Milestone 17 — Reliability + Security
**Complexity: 🔴 High**

Handle:

- authentication
- authorization
- request validation
- upload/stream limits
- timeouts
- rate limits
- session cleanup
- secret management
- error handling
- privacy
- audio retention/deletion policy
- audit events

---

# Milestone 18 — Deployment / Final System
**Complexity: 🟠 Medium–High**

Final system:

```text
Mobile Simulator
        │
        ▼
Spring Boot
   │         │
   │         └──── Database
   │
   ▼
FastAPI
   │
   ▼
AI Engine
   │
   ▼
Spring Boot
   │
   ▼
Dashboard
```

Deployment should make the system reproducible on the target environment.

---

# Recommended Implementation Order

```text
Milestone 8   FastAPI
      ↓
Milestone 9   Spring Boot foundation + API contract
      ↓
Milestone 10  Database
      ↓
Milestone 11  Mobile simulator
      ↓
Milestone 12  Live audio ingestion
      ↓
Milestone 13  Spring Boot ↔ FastAPI live pipeline
      ↓
Milestone 14  Persistence + call state
      ↓
Milestone 15  Dashboard
      ↓
Milestone 16  Full end-to-end test
      ↓
Milestone 17  Reliability/security
      ↓
Milestone 18  Deployment/final integration
```

## Out of Scope for This Project Version

Do not block the project on:

- training Wav2Vec2
- training DF Arena
- fine-tuning Whisper
- training a new fusion neural network
- building a large research dataset
- research-grade probability calibration

Those can become future improvements.

## Critical Architecture Rule

The responsibilities should remain separated:

```text
Mobile Frontend
→ captures/sends voice

Spring Boot
→ owns application/business/session/database logic

FastAPI
→ owns AI inference and fusion

Database
→ stores application and analysis state

Dashboard Frontend
→ displays information
```
