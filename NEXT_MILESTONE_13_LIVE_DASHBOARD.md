# Audio DeepCheck — Milestone 13: Live Analytics Dashboard & Call Monitoring UI

## Current Status
Milestone 12 is complete. The latest walkthrough reports a full two-user call simulation, bidirectional WebSocket audio relay, 5s/2.5s AI scheduling, bounded backpressure, participant-aware analysis, MongoDB persistence, and 203/203 tests passing across AI-Model, Backend, and CallSimulator. The documented next stage is Milestone 13: Live Analytics Dashboard & Call Monitoring UI. fileciteturn11file0L184-L188

## Goal
Connect the separate `Frontend/` Analytics Dashboard to Spring Boot for historical and live call monitoring.

Architecture:

```text
CallSimulator A
      ↕
Spring Boot
      ↕
CallSimulator B
      │
      └──→ FastAPI → Fusion → MongoDB
                        │
                        ▼
                 Spring Boot
                        │
                        ▼
                  Dashboard
```

The Dashboard must:
- never call FastAPI directly,
- never access MongoDB directly,
- never capture microphone audio,
- never own call signaling/business logic.

## Scope
Work primarily inside `Frontend/`.

Read:
```text
NewFlow/FRONTEND_FEATURES_SPEC.md
NewFlow/SPRING_BOOT_ENDPOINTS.md
NewFlow/AUDIO_DEEPCHECK_ROADMAP_FROM_NOW.md
```

Do not modify `AI-Model/` or `CallSimulator/`. Avoid Backend source changes unless the current dashboard contract is genuinely missing a required field/event; prefer contract-compatible frontend implementation.

## 1. Inspect First
Inspect the existing Dashboard before coding:
- framework/package manager
- routes
- API client
- styling/design system
- current pages/components
- state management
- charts/visualization libraries
- existing tests/build

Run existing tests/build and preserve usable teammate work.

## 2. Dashboard Home
Show operational summaries:
- active calls
- analyzing
- completed
- HUMAN
- AI_GENERATED
- UNCERTAIN
- backend health
- AI service health
- database health

Do not present these counts as accuracy metrics.

## 3. Active Calls
Show:
- call ID
- caller
- receiver
- duration
- status
- stream state
- latest decision
- quality
- last update

Use Spring Boot as authoritative source.

## 4. Live Call Monitoring
Show both participants independently:
```text
CALLER
name / number / state / quality / voice activity / latest AI result

RECEIVER
name / number / state / quality / voice activity / latest AI result
```

## 5. Participant-Specific Timeline
Maintain distinct caller and receiver timelines.

Example:
```text
CALLER
00:00 HUMAN
00:05 HUMAN
00:10 UNCERTAIN
00:15 AI_GENERATED

RECEIVER
00:00 HUMAN
00:05 HUMAN
00:10 HUMAN
00:15 HUMAN
```

Preserve:
- callId
- participant
- chunkIndex
- startSec
- endSec

Never merge both users into an ambiguous timeline.

## 6. Audio Activity Visualization
Use available backend data for waveform/activity display where appropriate.

Clearly separate:
- audio activity
- AI evidence

Never treat a waveform as proof of human/AI speech.

## 7. Live AI Evidence Telemetry
Display:
- Wav2Vec2
- DF Arena
- Spectrogram
- Prosody
- Whisper

For each, show applicable:
- status
- direction
- contribution
- availability
- quality

Do not fabricate probabilities for feature/embedding evidence.

## 8. Master Decision Card
Display:
```text
HUMAN
AI_GENERATED
UNCERTAIN
```
plus:
- decision strength
- confidence status
- quality
- conflict level

Keep `PROVISIONAL` semantics accurate. Do not label provisional strength as calibrated probability.

## 9. Signal Quality
Show:
- SNR
- bandwidth
- clipping
- silence ratio
- voiced ratio
- quality score
- quality flags

Explain why quality is degraded when flags are present.

## 10. Live Updates
Use whatever live mechanism the existing Spring Boot contract actually supports.

Preferred order:
1. existing SSE/WebSocket event support,
2. otherwise controlled polling.

Do not invent a second unnecessary real-time protocol.

Events may include:
```text
ANALYSIS_UPDATE
HIGH_CONFLICT
LOW_AUDIO_QUALITY
STREAM_BACKPRESSURE
AI_SERVICE_UNAVAILABLE
PARTICIPANT_DISCONNECTED
CALL_ENDED
```

These are monitoring/analysis events, not automatic fraud conclusions.

## 11. Reconnection
Handle:
```text
CONNECTED
CONNECTING
RECONNECTING
DISCONNECTED
```

After reconnect:
```text
live channel
↓
REST refresh
↓
authoritative state
```

Use timestamps/chunk indexes/update versions to prevent stale updates overwriting newer data.

## 12. History
Use Spring Boot:
```text
GET /api/v1/calls
```

Support pagination and available status/decision/date filters.

Do not load unlimited history into the browser.

## 13. Call Details / Report
Use:
```text
GET /api/v1/calls/{callId}
GET /api/v1/calls/{callId}/analysis
GET /api/v1/calls/{callId}/evidence
GET /api/v1/calls/{callId}/chunks
GET /api/v1/calls/{callId}/report
```

Build a report containing:
- call metadata
- participants
- final decision
- signal quality
- fusion summary
- module evidence
- chunk timeline
- processing metadata
- state history where available

## 14. Alerts
Display:
```text
HIGH_CONFLICT
LOW_AUDIO_QUALITY
STREAM_BACKPRESSURE
AI_SERVICE_UNAVAILABLE
PARTICIPANT_DISCONNECTED
CALL_ENDED
```

Example:
> High evidence conflict — specialist evidence disagrees; master confidence is reduced.

Do not automatically display a fraud accusation from these operational signals.

## 15. Two-User Demo View
Create the main hackathon monitoring view:
```text
CALL-1001                         ACTIVE

Muthu                         Friend
+91 XXXXX                    +91 XXXXX

My/remote voice activity     My/remote voice activity

Latest decision              Latest decision
Quality                       Quality

Evidence timeline:
Caller:   HUMAN → UNCERTAIN → AI_GENERATED
Receiver: HUMAN → HUMAN → HUMAN
```

Use actual backend data.

## 16. Error / Empty States
Handle:
- no active calls
- no history
- call not found
- backend unavailable
- live channel disconnected
- AI unavailable
- no analysis yet
- insufficient audio
- poor signal quality

## 17. Tests
Add tests for:
- active calls
- details/history/evidence/chunks/report
- live analysis updates
- conflict/backpressure/disconnect
- reconnect recovery
- participant separation
- stale event rejection
- decision/quality/evidence UI

Mock backend/live events.

## 18. Integration Verification
Verify both:
```text
Historical:
MongoDB → Spring Boot → Dashboard

Live:
CallSimulator A ↔ Spring Boot ↔ CallSimulator B
                               ↓
                             FastAPI
                               ↓
                            Spring Boot
                               ↓
                           Dashboard
```

The Dashboard must never directly depend on FastAPI or MongoDB.

## Definition of Done
- [ ] Existing Frontend inspected
- [ ] Existing teammate UI preserved/reused
- [ ] Dashboard home
- [ ] Active calls
- [ ] Live call monitor
- [ ] Two participant panels
- [ ] Participant-specific timeline
- [ ] Audio activity visualization
- [ ] Live AI telemetry
- [ ] Master decision
- [ ] Signal quality
- [ ] Alerts
- [ ] History
- [ ] Report
- [ ] Live updates
- [ ] Reconnect/recovery
- [ ] Stale-event protection
- [ ] API/component tests
- [ ] Historical integration verified
- [ ] Live two-user demo verified
- [ ] Dashboard does not call FastAPI directly
- [ ] Dashboard does not call MongoDB directly
- [ ] AI-Model untouched
- [ ] CallSimulator untouched

## Next Milestone
Milestone 14 — Full End-to-End System Verification & Reliability.
