# Audio DeepCheck — Frontend Features Specification

## Frontend Architecture

There are **two separate frontend applications**.

```text
1. Mobile Call Simulator
   └── captures and streams call audio

2. Dashboard
   └── monitors calls and displays AI analysis
```

They have different responsibilities and should remain separate.

---

# Part A — Mobile Call Simulator

## 1. Purpose

The mobile application simulates a phone call.

Its primary job is:

```text
Microphone
 ↓
Call UI
 ↓
Audio capture
 ↓
Audio streaming
 ↓
Spring Boot
```

It is NOT the analysis dashboard.

---

# 2. Screens

## A. Home / Dialer

Features:

- contact/number input
- call button
- recent simulated calls
- connection status
- microphone permission status

Example:

```text
┌─────────────────────┐
│       DeepCheck     │
│                     │
│  +91 XXXXX XXXXX    │
│                     │
│       ☎ CALL        │
│                     │
│ Recent Calls        │
│ ──────────────────  │
│ Muthu       02:14   │
└─────────────────────┘
```

## B. Incoming Call

Display:

- caller identity
- call accept
- call reject
- connection state

## C. Active Call

Display:

- caller/receiver
- call timer
- microphone state
- connection state
- streaming state
- end call button

Example:

```text
┌─────────────────────┐
│       Muthu         │
│                     │
│       02:14         │
│                     │
│   🎙 Microphone     │
│   ● Streaming       │
│                     │
│     🔴 END CALL     │
└─────────────────────┘
```

Do not expose complicated AI evidence here unless specifically needed.

The main purpose is believable call simulation.

---

# 3. Audio Capture

The simulator must:

- request microphone permission
- capture microphone audio
- encode into the agreed transport format
- divide the stream into ordered chunks
- attach sequence number
- attach timestamp
- attach call/session ID
- send continuously to Spring Boot

Concept:

```text
CallSession ID
Chunk 0
Chunk 1
Chunk 2
Chunk 3
...
```

---

# 4. Streaming State

Display whether the app is:

```text
CONNECTED
CONNECTING
STREAMING
RECONNECTING
DISCONNECTED
```

If network connection drops:

```text
RECONNECTING...
```

rather than silently stopping the call.

---

# 5. Call End

When the user ends the call:

```text
Stop microphone
 ↓
Flush pending audio
 ↓
Send final chunk
 ↓
Notify Spring Boot
 ↓
Close call session
```

The server must receive an explicit call-ended event.

---

# Part B — Dashboard Frontend

## 6. Dashboard Purpose

The dashboard monitors calls and displays analysis.

It does NOT capture the microphone.

```text
Dashboard
   ↓
Spring Boot
   ↓
Call state / analysis data
```

---

# 7. Dashboard Home

Show:

- active calls
- total calls
- recent analyses
- calls requiring attention
- current AI-analysis status

Suggested cards:

```text
ACTIVE CALLS
12

ANALYZING
4

COMPLETED
87

UNCERTAIN
9
```

Avoid presenting provisional confidence as a calibrated probability.

---

# 8. Active Calls Page

Display table/cards:

```text
Call ID
Caller
Receiver
Duration
Status
Current analysis
Last update
```

Possible statuses:

```text
CONNECTING
ACTIVE
ANALYZING
ENDED
COMPLETED
FAILED
```

---

# 9. Live Call Details

When opening an active call:

Display:

- caller
- receiver
- duration
- call status
- audio/stream connection status
- analysis state
- current master decision
- latest chunk state

Example:

```text
CALL-1001

Status: ACTIVE
Duration: 02:14
Audio: STREAMING
AI Analysis: RUNNING

Current:
UNCERTAIN
```

---

# 10. Evidence Breakdown

Show the separate evidence sources:

```text
Wav2Vec2
DF Arena
Spectrogram
Prosody
Whisper
```

For each display:

- status
- direction/evidence
- contribution
- availability
- quality warnings

Do not convert feature/embedding evidence into fake probabilities.

---

# 11. Master Decision

Display:

```text
HUMAN
AI_GENERATED
UNCERTAIN
```

Also show:

- provisional decision strength
- confidence status
- conflict level
- signal quality
- quality flags

Example:

```text
┌───────────────────────────────┐
│ MASTER DECISION               │
│                               │
│ AI_GENERATED                  │
│ Strength: Provisional         │
│                               │
│ Signal Quality: GOOD          │
│ Conflict: LOW                 │
└───────────────────────────────┘
```

---

# 12. Chunk Timeline

Display how the analysis evolved during the call.

Example:

```text
00:00  HUMAN
00:05  HUMAN
00:10  UNCERTAIN
00:15  AI_GENERATED
00:20  AI_GENERATED
00:25  AI_GENERATED
```

Allow selecting a chunk to inspect its evidence.

---

# 13. Call History

Show:

- previous calls
- caller
- receiver
- duration
- date/time
- final decision
- quality
- call status

Filters:

```text
All
Human
AI Generated
Uncertain
Failed
```

---

# 14. Call Details / Report

Display:

```text
Call information
Analysis summary
Signal quality
Evidence breakdown
Chunk timeline
Processing information
Final decision
```

Optional export later:

```text
JSON
PDF
```

Do not add export until the core API is stable.

---

# 15. Error States

Dashboard should handle:

```text
AI service unavailable
Backend unavailable
Analysis timeout
Call interrupted
No audio received
Insufficient speech
Poor audio quality
```

Example:

```text
AI analysis unavailable.
The call was recorded, but analysis could not be completed.
```

---

# 16. Frontend Data Rules

Mobile Simulator communicates with:

```text
Spring Boot
```

Dashboard communicates with:

```text
Spring Boot
```

Neither frontend should directly depend on the internal FastAPI AI service.

Architecture:

```text
Mobile ──────→ Spring Boot ←────── Dashboard
                    │
                    ▼
                 FastAPI
                    │
                    ▼
                 AI Model
```

---

# 17. Responsive / UX Requirements

Mobile simulator:

- touch-friendly
- large call controls
- low-latency visual feedback
- clear microphone/network states

Dashboard:

- desktop-first
- responsive layout
- readable evidence cards
- live status updates
- clear distinction between final decision and provisional evidence

---

# 18. Frontend Delivery Order

### Mobile Simulator

```text
1. Home/Dialer
2. Call screen
3. Audio capture
4. Streaming
5. Call lifecycle
6. Error/reconnect handling
```

### Dashboard

```text
1. Dashboard home
2. Active calls
3. Call details
4. Evidence view
5. Chunk timeline
6. History
7. Report
```
