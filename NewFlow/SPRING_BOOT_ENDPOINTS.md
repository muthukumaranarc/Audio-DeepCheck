# Audio DeepCheck — Spring Boot API Endpoints

## Purpose

This document defines the **Spring Boot APIs used by the two frontend applications**:

```text
Mobile Call Simulator
        ↓
   Spring Boot

Dashboard Frontend
        ↓
   Spring Boot
```

Spring Boot is the public application/backend API.

The Python FastAPI AI service is an internal dependency of Spring Boot and is NOT the frontend-facing API.

---

# 1. Base URL

Development:

```text
http://localhost:8080/api/v1
```

Production base URL depends on deployment.

---

# 2. API Consumers

| Client | Main responsibilities |
|---|---|
| Mobile Call Simulator | create calls, stream voice, update/end calls |
| Dashboard | active calls, history, analysis state, evidence, reports |

---

# 3. Call Lifecycle

Recommended state model:

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

Failure states:

```text
FAILED
INTERRUPTED
AI_UNAVAILABLE
```

---

# 4. Health

## GET `/health`

Purpose:

Check whether Spring Boot is running.

### Response

```json
{
  "status": "UP",
  "service": "audio-deepcheck-backend",
  "timestamp": "2026-09-18T12:00:00Z",
  "components": {
    "backend": "UP",
    "aiService": "UP",
    "database": "UP"
  }
}
```

---

# 5. Create Call

## POST `/calls`

Purpose:

Create a simulated call session.

### Request

```json
{
  "caller": "Muthu",
  "receiver": "Demo Receiver"
}
```

### Response

```json
{
  "callId": "CALL-1001",
  "status": "CREATED",
  "caller": "Muthu",
  "receiver": "Demo Receiver",
  "createdAt": "2026-09-18T12:00:00Z"
}
```

---

# 6. Start Call

## POST `/calls/{callId}/start`

Purpose:

Move a call from `CREATED`/`CONNECTING` to `ACTIVE`.

### Response

```json
{
  "callId": "CALL-1001",
  "status": "ACTIVE",
  "startedAt": "2026-09-18T12:00:05Z"
}
```

---

# 7. Audio Streaming

## POST `/calls/{callId}/audio`

Purpose:

Send an audio chunk from the Mobile Call Simulator to Spring Boot.

This is the core voice-ingestion endpoint for the initial implementation.

### Content Type

```text
multipart/form-data
```

### Form fields

```text
audio=<audio chunk>
sequenceNumber=12
timestampMs=123456
durationMs=500
```

Recommended metadata:

```text
callId
sequenceNumber
timestampMs
durationMs
sampleRate
channels
```

### Response

```json
{
  "callId": "CALL-1001",
  "sequenceNumber": 12,
  "received": true,
  "analysisStatus": "QUEUED"
}
```

### Important

The client must not rely on HTTP arrival order.

`sequenceNumber` is the authoritative ordering mechanism.

---

# 8. Audio Chunk Analysis Status

## GET `/calls/{callId}/analysis`

Purpose:

Get the latest analysis state for a live call.

### Response

```json
{
  "callId": "CALL-1001",
  "status": "ANALYZING",
  "latestDecision": "UNCERTAIN",
  "decisionStrength": 0.31,
  "confidenceStatus": "PROVISIONAL",
  "qualityScore": 0.82,
  "conflictLevel": "MEDIUM",
  "lastProcessedSequence": 12
}
```

`decisionStrength` is provisional and must not be presented as a calibrated probability.

---

# 9. End Call

## POST `/calls/{callId}/end`

Purpose:

Tell Spring Boot that the mobile call has ended.

### Request

```json
{
  "endedAt": "2026-09-18T12:05:20Z",
  "reason": "USER_ENDED"
}
```

### Response

```json
{
  "callId": "CALL-1001",
  "status": "ENDED",
  "endedAt": "2026-09-18T12:05:20Z"
}
```

Spring Boot should finish processing any accepted pending chunks before marking the analysis complete.

---

# 10. Get Call Details

## GET `/calls/{callId}`

Purpose:

Return the complete current call state.

### Response

```json
{
  "callId": "CALL-1001",
  "caller": "Muthu",
  "receiver": "Demo Receiver",
  "status": "COMPLETED",
  "startedAt": "2026-09-18T12:00:05Z",
  "endedAt": "2026-09-18T12:05:20Z",
  "durationSec": 315,
  "decision": "AI_GENERATED",
  "decisionStrength": 0.84,
  "confidenceStatus": "PROVISIONAL",
  "quality": {
    "score": 0.84,
    "flags": []
  }
}
```

---

# 11. Live Calls

## GET `/calls/active`

Purpose:

Dashboard gets currently active/analyzing calls.

### Response

```json
{
  "calls": [
    {
      "callId": "CALL-1001",
      "caller": "Muthu",
      "receiver": "Demo Receiver",
      "status": "ANALYZING",
      "durationSec": 134,
      "latestDecision": "UNCERTAIN"
    }
  ]
}
```

---

# 12. Call History

## GET `/calls`

Purpose:

Dashboard retrieves historical calls.

### Query parameters

```text
page
size
status
decision
from
to
```

Example:

```text
GET /api/v1/calls?page=0&size=20&decision=AI_GENERATED
```

### Response

```json
{
  "content": [
    {
      "callId": "CALL-1001",
      "caller": "Muthu",
      "receiver": "Demo Receiver",
      "status": "COMPLETED",
      "decision": "AI_GENERATED",
      "createdAt": "2026-09-18T12:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

---

# 13. Evidence Breakdown

## GET `/calls/{callId}/evidence`

Purpose:

Return module-level evidence for the dashboard.

### Response

```json
{
  "callId": "CALL-1001",
  "modules": [
    {
      "module": "wav2vec2",
      "status": "USED",
      "direction": "SYNTHETIC",
      "contribution": 0.21
    },
    {
      "module": "df_arena",
      "status": "USED",
      "direction": "SYNTHETIC",
      "contribution": 0.18
    },
    {
      "module": "prosody",
      "status": "USED",
      "direction": "MIXED",
      "contribution": 0.05
    },
    {
      "module": "spectrogram",
      "status": "USED",
      "direction": "SUPPORTING",
      "contribution": 0.04
    },
    {
      "module": "whisper",
      "status": "USED",
      "direction": "SUPPORTING",
      "contribution": 0.06
    }
  ],
  "conflictLevel": "LOW"
}
```

---

# 14. Chunk Timeline

## GET `/calls/{callId}/chunks`

Purpose:

Dashboard displays analysis evolution over the call.

### Response

```json
{
  "callId": "CALL-1001",
  "chunks": [
    {
      "chunkIndex": 0,
      "startSec": 0.0,
      "endSec": 5.0,
      "decision": "HUMAN",
      "decisionStrength": -0.42,
      "qualityScore": 0.91
    },
    {
      "chunkIndex": 1,
      "startSec": 2.5,
      "endSec": 7.5,
      "decision": "UNCERTAIN",
      "decisionStrength": 0.06,
      "qualityScore": 0.82
    }
  ]
}
```

---

# 15. Final Report

## GET `/calls/{callId}/report`

Purpose:

Return the full analysis report for a completed call.

### Response should include

```text
call metadata
final decision
decision strength
confidence status
signal quality
quality flags
fusion summary
module evidence
chunk summary
processing information
```

Use the real AI response fields rather than inventing new AI metrics.

---

# 16. Current AI-Service Dependency

Spring Boot internally communicates with the FastAPI AI service.

This is NOT a frontend-facing endpoint.

Conceptually:

```text
Spring Boot
     ↓
FastAPI
     ↓
POST /api/v1/analyze
```

FastAPI remains responsible for:

```text
audio analysis
AI models
fusion
AI result
```

Spring Boot remains responsible for:

```text
call session
audio ingestion
database
business logic
frontend API
```

---

# 17. Error Contract

All Spring Boot APIs should use a consistent error format.

Example:

```json
{
  "timestamp": "2026-09-18T12:00:00Z",
  "status": 400,
  "code": "INVALID_CALL_STATE",
  "message": "Audio cannot be submitted because the call is not active.",
  "path": "/api/v1/calls/CALL-1001/audio",
  "requestId": "req-e193a98f"
}
```

Suggested errors:

```text
CALL_NOT_FOUND
INVALID_CALL_STATE
INVALID_AUDIO_CHUNK
DUPLICATE_SEQUENCE
MISSING_SEQUENCE
AI_SERVICE_UNAVAILABLE
AI_ANALYSIS_FAILED
CALL_ALREADY_ENDED
```

---

# 18. Authentication

Authentication can be added depending on the final application scope.

If authentication is introduced, apply it consistently to:

```text
Dashboard APIs
Call management APIs
Analysis APIs
```

Do not put AI-specific credentials into the mobile frontend.

---

# 19. Important Backend Rules

### Rule 1

The mobile frontend talks to:

```text
Spring Boot
```

not directly to FastAPI.

### Rule 2

The dashboard talks to:

```text
Spring Boot
```

not directly to FastAPI.

### Rule 3

Spring Boot controls:

```text
CallSession
AudioChunk metadata
AI job state
Database
```

### Rule 4

FastAPI controls:

```text
AI inference
Fusion
AI evidence
```

### Rule 5

Every audio chunk needs a:

```text
callId
sequenceNumber
timestamp
```

This is necessary for reliable live processing.

---

# 20. Future Streaming Upgrade

The initial implementation can use:

```text
POST /calls/{callId}/audio
```

for sequential audio chunks.

Later, when the system is stable, this can evolve into:

```text
WebSocket
```

for persistent bidirectional streaming.

Do not require WebSocket architecture before the basic call lifecycle works.

---

# 21. API Delivery Order

Implement in this order:

```text
1. /health
2. /calls
3. /calls/{id}/start
4. /calls/{id}/audio
5. /calls/{id}/analysis
6. /calls/{id}/end
7. /calls/{id}
8. /calls/active
9. /calls history
10. /calls/{id}/evidence
11. /calls/{id}/chunks
12. /calls/{id}/report
```

Then add real-time transport improvements if required.

> **Status Update (Milestone 9 Complete)**:
> All endpoints 1 through 12 above are fully implemented in the Spring Boot backend (`com.audiodeepcheck.backend`), tested with 48 automated tests, and verified for correlation tracking via `X-Request-ID`.
