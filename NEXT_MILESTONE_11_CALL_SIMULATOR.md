# Audio DeepCheck — Milestone 11: Mobile Call Simulator Frontend

## Current Status

Milestone 10 — Database Integration & Persistence — is complete.

The current Backend has MongoDB persistence for call sessions and analysis results, dashboard-oriented indexes, MongoDB health checks, isolated embedded-Mongo tests, and 59/59 passing tests. The documented next stage is Milestone 11: Mobile Call Simulator Frontend, followed by Milestone 12: Live Audio Streaming & WebSocket Ingestion. fileciteturn8file0L303-L310

## Goal

Build the separate `CallSimulator/` frontend that behaves like a mobile phone call.

Its responsibility is:

```text
Call UI
  ↓
Spring Boot call session
  ↓
Microphone permission
  ↓
Audio capture
  ↓
Future streaming layer
```

The Dashboard remains a separate frontend.

## Scope

Work only inside:

```text
CallSimulator/
```

Read:

```text
NewFlow/FRONTEND_FEATURES_SPEC.md
NewFlow/SPRING_BOOT_ENDPOINTS.md
NewFlow/AUDIO_DEEPCHECK_ROADMAP_FROM_NOW.md
```

Do not modify `AI-Model/` or `Backend/` source code. Do not implement WebSocket/live audio transport yet. Do not build the Dashboard in this milestone.

## 1. Inspect Before Coding

Determine the existing:

- frontend framework
- language
- package manager
- build system
- screens/components
- navigation
- API layer
- microphone/audio dependencies
- styles/theme

Preserve the existing framework and working code.

## 2. Call Flow

Implement:

```text
IDLE
 ↓
CREATING_CALL
 ↓
CONNECTING
 ↓
ACTIVE
 ↓
ENDING
 ↓
COMPLETED
```

Failure states:

```text
CREATE_FAILED
CONNECT_FAILED
MIC_PERMISSION_DENIED
MIC_PERMISSION_BLOCKED
NETWORK_INTERRUPTED
END_FAILED
```

The UI must reflect real backend state.

## 3. Home / Dialer

Features:

- Audio DeepCheck branding
- contact/number input
- Call button
- recent calls
- backend connectivity state
- microphone permission state

Keep this screen focused on call simulation, not analytics.

## 4. Create and Start Call

Use:

```text
POST /api/v1/calls
POST /api/v1/calls/{callId}/start
```

Flow:

```text
tap Call
 → create call
 → store callId
 → start call
 → wait for ACTIVE
 → show active call UI
```

Do not fake ACTIVE before backend confirmation.

## 5. Active Call Screen

Display:

- caller/receiver
- elapsed call timer
- microphone state
- capture state
- connection state
- end-call button

The user must clearly see whether the microphone is capturing.

## 6. Microphone Permission

Implement real platform permission states:

```text
UNKNOWN
REQUESTING
GRANTED
DENIED
BLOCKED
```

When denied, show a clear recovery path.

## 7. Audio Capture Abstraction

Create a dedicated layer such as:

```text
AudioCaptureService
```

with:

```text
startCapture()
pauseCapture()
resumeCapture()
stopCapture()
```

Expose:

```text
audio data
sample rate
channel count
sample format
timestamps
duration
audio level
```

### Critical separation

Do not put network transport into `AudioCaptureService`.

Prepare this boundary:

```text
AudioCaptureService
      ↓
AudioStreamingService   ← Milestone 12
```

## 8. Determine Actual Audio Format

Inspect what the current mobile framework can reliably capture and document:

```text
sample rate
channels
sample format
frame/chunk size
encoding/container
```

Do not invent a final WebSocket format yet.

## 9. Local Audio Visualization

Show a simple:

- volume meter
- waveform
- audio-level bars

This is only a local microphone activity indicator. It must never be presented as AI confidence or Human/AI evidence.

## 10. Timer

Start when the backend confirms `ACTIVE`.

Stop when the call enters `ENDING` or `COMPLETED`.

Use elapsed time, not render count.

## 11. API Layer

Create a dedicated:

```text
CallApiService
```

Methods:

```text
createCall()
startCall(callId)
getCall(callId)
endCall(callId)
getRecentCalls()
```

Do not place HTTP calls directly inside UI components.

## 12. End Call

Use:

```text
stop capture
 ↓
flush local capture state
 ↓
POST /api/v1/calls/{callId}/end
 ↓
show ended
 ↓
return home
```

Microphone cleanup must happen even when the backend request fails.

## 13. Connection State

Represent:

```text
ONLINE
OFFLINE
CONNECTING
CONNECTED
RECONNECTING
DISCONNECTED
```

Do not silently create a new call on reconnect.

Preserve the existing `callId`.

## 14. Recent Calls

Use:

```text
GET /api/v1/calls
```

Display a lightweight list:

```text
receiver
date/time
duration
status
```

Do not turn the CallSimulator into the analytics Dashboard.

## 15. Error Handling

Handle:

- backend unavailable
- create failure
- start failure
- microphone denied/blocked
- network interruption
- invalid call state
- end failure

Translate backend errors to friendly messages. Never expose stack traces.

## 16. Resource Cleanup

Guarantee that microphone capture stops on:

- normal call end
- navigation away
- permission loss
- backend failure
- app interruption
- component unmount

No microphone should remain active after the call ends.

## 17. Testing

Add framework-appropriate tests for:

### Call API
- create
- start
- get
- end
- recent calls

### State machine
- valid transitions
- invalid transitions
- failure states

### Microphone
- permission granted
- denied
- blocked
- capture start
- capture stop

### Audio capture
- metadata
- data availability
- start/stop lifecycle
- cleanup

### Network
- online
- offline
- reconnect

Mock backend, microphone, and network where possible.

## 18. Manual Device/Emulator Verification

Run:

```text
Launch
 ↓
Create call
 ↓
Start
 ↓
Grant microphone
 ↓
Verify audio level
 ↓
Run 30–60 seconds
 ↓
End call
 ↓
Verify microphone stops
 ↓
Verify backend call becomes COMPLETED
```

## 19. Non-Goals

Do not implement:

```text
WebSocket
continuous network audio
FastAPI live analysis
Dashboard
database access
live AI-result display
production authentication
```

Those come later.

## 20. Definition of Done

- [ ] Existing CallSimulator inspected.
- [ ] Existing framework preserved.
- [ ] Home/dialer.
- [ ] Create/start call integration.
- [ ] Connecting state.
- [ ] Active call screen.
- [ ] End-call flow.
- [ ] Microphone permission.
- [ ] `AudioCaptureService`.
- [ ] Actual audio format documented.
- [ ] Local audio visualization.
- [ ] Timer.
- [ ] `CallApiService`.
- [ ] Network states.
- [ ] Recent calls.
- [ ] Error handling.
- [ ] Guaranteed microphone cleanup.
- [ ] Automated tests.
- [ ] Manual device/emulator verification.
- [ ] No WebSocket.
- [ ] No FastAPI streaming.
- [ ] Dashboard untouched.
- [ ] Backend source untouched.
- [ ] AI-Model untouched.

## Next Milestone

**Milestone 12 — Live Audio Streaming & WebSocket Ingestion**

```text
Mobile Microphone
      ↓
Audio frames
      ↓
WebSocket
      ↓
Spring Boot
      ↓
Ordered audio chunks
      ↓
FastAPI
      ↓
AI analysis
```
