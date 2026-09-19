# Audio DeepCheck — Milestone 12
## Two-User Call Simulation + Live Audio Streaming & WebSocket Ingestion

### Current Status

Milestone 11 — **Mobile Call Simulator Frontend** is complete.

The latest walkthrough reports:

- React 18 + TypeScript + Vite + Tailwind implementation.
- Call lifecycle state machine is complete.
- Spring Boot call APIs are integrated.
- Microphone capture is implemented using the Web Audio API.
- `AudioCaptureService` has **zero network transport** by design.
- Audio is captured as mono 16 kHz Float32 PCM with 2048-sample frames.
- **23/23 CallSimulator tests pass** and the production build succeeds.
- The next documented stage is live audio streaming and WebSocket ingestion. fileciteturn10file0L5-L15 fileciteturn10file0L145-L153

This milestone therefore expands Milestone 12 into the **actual two-person call simulation** the team needs.

---

# 1. Core Goal

Two team members must be able to use the **same CallSimulator application on two different devices/browser instances**, each with a different phone number/account.

Example:

```text
Friend's Device
Account: +91 90000 00001
        │
        │ calls
        ▼
Your Device
Account: +91 90000 00002
```

The system should behave like a real simulated phone call:

```text
Friend
  ↓
CallSimulator A
  ↓
Spring Boot
  ↓
Call Signaling
  ↓
CallSimulator B
  ↓
You receive call
```

After the call is accepted:

```text
Friend microphone
        ↓
Audio frames
        ↓
WebSocket
        ↓
Spring Boot
        ├──────────────→ Your CallSimulator speaker
        │
        └──────────────→ AI analysis pipeline
                         ↓
                       FastAPI
                         ↓
                     AI Fusion
```

For the return direction:

```text
Your microphone
        ↓
WebSocket
        ↓
Spring Boot
        ├──────────────→ Friend's CallSimulator speaker
        │
        └──────────────→ AI analysis pipeline
```

This creates a **server-mediated simulated phone call** while simultaneously allowing the backend to inspect the voice.

---

# 2. Why This Is Better Than a Simple Audio Upload

The earlier Milestone 11 only proved:

```text
one simulator
 ↓
microphone
 ↓
local capture
```

Now the project needs the real interaction:

```text
User A calls User B
User B receives
User B accepts
Both sides talk
Backend receives live audio
Backend forwards audio
AI analyzes voice
Call ends
```

This is the first milestone where the project becomes a genuine **voice-analysis call simulation** rather than an audio-upload application.

---

# 3. Scope

This milestone affects:

```text
CallSimulator/
Backend/
AI-Model/
```

But each area has a strict responsibility.

### CallSimulator

Implement:

- login/identity selection
- incoming call UI
- outgoing call UI
- accept/reject
- WebSocket connection
- microphone streaming
- speaker playback
- reconnect handling

### Backend

Implement:

- user identity/session handling
- call signaling
- WebSocket endpoint
- call participant association
- ordered audio frame ingestion
- audio forwarding to the other participant
- AI-analysis dispatch
- stream lifecycle/state management

### AI-Model / FastAPI

Only integrate existing analysis.

Do not redesign or retrain models.

The existing FastAPI AI service remains the analysis engine.

---

# 4. Two-User Identity System

For the simulator, use two independent identities.

Example:

```text
User A
Phone: +91 90000 00001

User B
Phone: +91 90000 00002
```

Each simulator instance must know:

```text
userId
phoneNumber
displayName
sessionToken / auth state
```

For the hackathon/demo version, authentication can remain intentionally lightweight, but each simulator must have a unique identity.

Do not allow two clients to masquerade as the same active call participant.

---

# 5. Login / Identity Screen

Add a simple simulator identity screen.

Example:

```text
┌──────────────────────────┐
│    Audio DeepCheck       │
│                          │
│  Phone Number            │
│  +91 90000 00001         │
│                          │
│  Name                    │
│  Muthu                   │
│                          │
│       CONTINUE           │
└──────────────────────────┘
```

The app then enters the dialer.

A second device can use:

```text
+91 90000 00002
```

and a different name.

For this milestone, identity management is primarily for **call routing**, not full production authentication.

---

# 6. User Presence

Spring Boot should know whether a simulator is available.

Possible presence states:

```text
ONLINE
OFFLINE
BUSY
IN_CALL
```

The dialer should show whether a target user is reachable.

Example:

```text
Muthu
+91 90000 00002
● ONLINE
```

---

# 7. Outgoing Call Flow

User A:

```text
Select User B
      ↓
POST /api/v1/calls
      ↓
Spring Boot creates call
      ↓
Call status = RINGING
      ↓
notify User B
```

User A sees:

```text
Calling Muthu...
```

---

# 8. Incoming Call Flow

User B receives a real simulated incoming-call screen:

```text
┌──────────────────────────┐
│                          │
│      📞 Incoming Call    │
│                          │
│        Friend Name       │
│        +91 XXXXX         │
│                          │
│   🔴 Reject   🟢 Accept  │
└──────────────────────────┘
```

Backend event:

```text
CALL_INCOMING
```

must identify:

```text
callId
caller
receiver
timestamp
```

---

# 9. Call Signaling State Machine

The call should have explicit signaling states:

```text
IDLE
 ↓
CREATED
 ↓
RINGING
 ↓
ACCEPTED
 ↓
CONNECTING_MEDIA
 ↓
ACTIVE
 ↓
ENDING
 ↓
ENDED
```

Failure/cancel states:

```text
REJECTED
MISSED
CANCELLED
BUSY
FAILED
DISCONNECTED
```

Both clients must remain consistent with the server's authoritative call state.

---

# 10. WebSocket Connection

Once the callee accepts:

```text
Client A
   ↓
WebSocket
   ↓
Spring Boot
   ↑
WebSocket
   ↑
Client B
```

Prefer one persistent WebSocket per participant/call session.

The WebSocket must be associated with:

```text
userId
callId
participantRole
```

Example:

```text
callId = CALL-1001
caller = USER-A
receiver = USER-B
```

---

# 11. Audio Transport

Milestone 11 captures:

```text
16 kHz
mono
Float32 PCM
2048 samples/frame
```

The latest walkthrough also explicitly states that these Float32 chunks are ready for conversion to signed 16-bit PCM or Opus for the streaming milestone. fileciteturn10file0L147-L153

For network transport, evaluate:

### Option A — PCM16

```text
Float32
 ↓
PCM16
 ↓
WebSocket binary frame
```

Advantages:

- simple
- deterministic
- easy backend processing
- directly compatible with many Python audio tools

Disadvantage:

- higher bandwidth than compressed audio

### Option B — Opus

```text
Audio
 ↓
Opus
 ↓
WebSocket binary frame
```

Advantages:

- much lower bandwidth
- better for realistic voice streaming

Disadvantage:

- more implementation complexity
- browser/mobile encoding support must be verified

For this milestone, **measure the actual environment before locking the final format**.

---

# 12. Frame Metadata

Each audio frame should carry metadata.

At minimum:

```text
callId
userId
participant
sequenceNumber
timestampMs
durationMs
sampleRate
channels
encoding
```

Example:

```json
{
  "callId": "CALL-1001",
  "userId": "USER-A",
  "participant": "CALLER",
  "sequenceNumber": 42,
  "timestampMs": 1712345678901,
  "durationMs": 128,
  "sampleRate": 16000,
  "channels": 1,
  "encoding": "PCM16"
}
```

Keep metadata and binary audio transport separable so the implementation can evolve.

---

# 13. Sequence Numbers

Every audio frame must have:

```text
0
1
2
3
...
```

The backend must detect:

```text
duplicate
missing
out-of-order
```

frames.

Never rely solely on WebSocket arrival order.

---

# 14. Backend Audio Routing

Spring Boot acts as the media relay for the simulator.

For User A:

```text
A → Spring Boot
```

Spring Boot should:

```text
1. validate call
2. validate participant
3. validate sequence
4. forward audio to B
5. dispatch a copy for AI analysis
```

For User B:

```text
B → Spring Boot
```

perform the same logic in reverse.

This means the backend receives the voice from both sides.

---

# 15. What the Other User Hears

The receiving simulator should play the caller's incoming voice.

Example:

```text
Friend speaks
    ↓
Friend microphone
    ↓
WebSocket
    ↓
Spring Boot
    ↓
Receiver WebSocket
    ↓
Receiver audio playback
```

The call simulator should therefore eventually have:

```text
AudioCaptureService
AudioPlaybackService
AudioStreamingService
```

The existing Milestone 11 `AudioCaptureService` should remain focused on capture.

---

# 16. AI Analysis Copy

Every audio direction should also have a copy sent to the AI pipeline.

Example:

```text
Friend → You

                   ┌→ Receiver playback
Friend audio → SB ─┤
                   └→ FastAPI analysis
```

The AI result should be associated with:

```text
callId
participant
sequence/chunk range
```

This allows the Dashboard later to answer:

```text
Whose voice was analyzed?
At what time?
What evidence was produced?
```

---

# 17. Chunking Strategy

Do not send each 128 ms frame individually to FastAPI for deep analysis.

Use the existing AI architecture:

```text
WebSocket frames
      ↓
Spring Boot buffer
      ↓
5-second analysis window
      ↓
2.5-second hop
      ↓
FastAPI
```

The raw WebSocket transport can operate at small frame sizes, while the AI engine continues using its existing analysis window.

This avoids unnecessary AI calls.

---

# 18. AI Scheduling

The current FastAPI configuration allows only one heavy analysis job concurrently on the CPU environment.

Therefore:

```text
WebSocket frames
       ↓
Buffer
       ↓
AI analysis queue
       ↓
FastAPI
```

Do not send every chunk immediately when the AI service is already busy.

Need:

```text
bounded queue
backpressure
drop/merge policy
analysis status
```

Define what happens when analysis falls behind real time.

For the demo, prioritize **correct ordered analysis over unlimited concurrency**.

---

# 19. Live Analysis Events

Spring Boot should eventually send analysis updates to the relevant Dashboard/backend consumers.

Example event:

```json
{
  "event": "ANALYSIS_UPDATE",
  "callId": "CALL-1001",
  "participant": "CALLER",
  "chunkIndex": 8,
  "decision": "UNCERTAIN",
  "decisionStrength": 0.18,
  "conflictLevel": "HIGH"
}
```

This milestone should at least establish the internal event structure even if the Dashboard itself is implemented later.

---

# 20. Reconnection

If one mobile client disconnects:

```text
WebSocket disconnected
      ↓
Spring Boot marks participant disconnected
      ↓
Call remains recoverable for a short window
      ↓
Client reconnects
      ↓
resume
```

Use:

```text
callId
userId
sessionId
lastSequenceNumber
```

to support recovery.

Do not automatically create a new call.

---

# 21. Backpressure

The streaming system must protect the backend.

If:

```text
audio arrives faster than it can be processed
```

the system must not grow an unlimited in-memory queue.

Define:

```text
MAX_BUFFER_DURATION
MAX_PENDING_CHUNKS
```

When limits are exceeded:

- log the condition,
- expose stream health,
- apply a documented drop/merge strategy,
- never silently corrupt sequence state.

For the first demo implementation, a bounded queue with explicit `STREAM_BACKPRESSURE` status is acceptable.

---

# 22. Call End

When User A ends:

```text
A sends END_CALL
      ↓
Spring Boot
      ↓
stop accepting new audio
      ↓
flush pending audio buffers
      ↓
finish final AI analysis
      ↓
notify B
      ↓
persist final state
      ↓
close both WebSockets
```

The same must happen if User B ends.

---

# 23. Dashboard Is NOT This Milestone

Do not build the complete dashboard here.

However, make sure the backend produces enough data for the later Dashboard:

```text
callId
participants
call state
stream state
chunk sequence
analysis updates
final decision
quality
evidence
```

---

# 24. Testing

## Call signaling

Test:

- user registration/identity
- call creation
- incoming call
- accept
- reject
- busy
- cancel
- end

## WebSocket

Test:

- connect
- authenticate/identify
- join call
- send frame
- receive frame
- close
- reconnect

## Audio

Test:

- valid sequence
- duplicate sequence
- missing sequence
- out-of-order sequence
- invalid metadata
- unsupported encoding

## Routing

Test:

```text
A → B
B → A
```

and verify the AI analysis copy is generated.

## Buffering

Test:

- normal flow
- analysis delay
- backpressure
- queue limit
- call termination while buffers exist

---

# 25. Manual Two-Device Test

This is REQUIRED.

Use two devices/browser instances:

### Device A

```text
+91 90000 00001
Muthu
```

### Device B

```text
+91 90000 00002
Friend
```

Run:

```text
Device A logs in
Device B logs in

A calls B

B receives incoming call

B accepts

A speaks
  ↓
B hears A

B speaks
  ↓
A hears B

Spring Boot receives both directions

FastAPI receives analysis windows

Analysis results are associated with each participant

A ends call

B sees call ended

Final state is persisted
```

This is the **actual two-person demonstration scenario** for the project.

---

# 26. Non-Goals

Do NOT:

- build Dashboard UI
- add new AI models
- train models
- fine-tune models
- change fusion architecture
- persist raw audio
- allow unlimited queues
- send every 128 ms frame independently to FastAPI
- create a P2P/WebRTC architecture unless the project later requires it

The first implementation should remain:

```text
Mobile A
 ↕
Spring Boot relay
 ↕
Mobile B

and

Spring Boot
 ↓
FastAPI
```

---

# 27. Definition of Done

- [ ] Two simulator identities supported.
- [ ] Different phone numbers supported.
- [ ] User presence implemented.
- [ ] Outgoing call implemented.
- [ ] Incoming call implemented.
- [ ] Accept/reject implemented.
- [ ] Server-authoritative call state implemented.
- [ ] WebSocket connection implemented.
- [ ] Audio frame metadata implemented.
- [ ] Sequence numbers implemented.
- [ ] A → B audio routing works.
- [ ] B → A audio routing works.
- [ ] Receiver playback works.
- [ ] AI analysis copy is generated.
- [ ] Existing 5s / 2.5s AI chunking reused.
- [ ] Bounded buffering/backpressure implemented.
- [ ] Reconnect behavior implemented.
- [ ] Call-end flush implemented.
- [ ] Raw audio not persisted.
- [ ] Unit/integration tests added.
- [ ] Two-device manual test passes.
- [ ] Dashboard remains separate.

---

# 28. Next Milestone

## Milestone 13 — Live AI Analysis + Dashboard Integration

After this milestone:

```text
Mobile A
   ↕
Spring Boot
   ↕
Mobile B
   │
   └──→ FastAPI AI
           ↓
       Fusion Result
           ↓
      MongoDB
           ↓
       Dashboard
```

Milestone 13 will focus on delivering live analysis results to the separate Dashboard and presenting the call timeline/evidence in real time.
