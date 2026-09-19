# Audio DeepCheck — Milestone 14
## Full End-to-End System Verification

**Status:** Next milestone after Milestone 13  
**Scope:** Entire Audio-DeepCheck system  
**Primary goal:** Prove that the existing AI, backend, two-user call simulator, database, and dashboard work correctly together as one end-to-end system.

---

## 1. Current Baseline

Milestone 13 is complete.

The current system already contains:

```text
CallSimulator
    ↓
Spring Boot
    ├── Voice relay
    └── AI analysis scheduling
              ↓
          FastAPI AI
              ↓
          AI Fusion
              ↓
           MongoDB
              ↓
         Spring Boot APIs
              ↓
          Dashboard
```

Milestone 13 delivered:

- live operations dashboard
- active-call monitoring
- dedicated two-user live call monitor
- participant-separated timelines
- 5-model AI telemetry
- master decision and provisional strength
- acoustic quality diagnostics
- call history and forensic reports
- WebSocket monitoring
- stale-event protection
- reconnect with REST reconciliation
- fallback polling
- 35/35 Frontend tests
- 79/79 Backend tests
- 32/32 CallSimulator tests
- 92/92 AI-Model tests
- 238/238 cross-project tests
- clean Frontend production build

**Do not rewrite or replace these existing capabilities.**

---

# 2. Milestone Objective

The objective is to validate the complete system in realistic end-to-end scenarios.

The milestone is successful when one can demonstrate:

```text
Device A
   ↓
Creates / places call
   ↓
Device B receives incoming call
   ↓
B accepts
   ↓
Full-duplex audio works
   ↓
Spring Boot relays audio
   ↓
Audio is scheduled into AI windows
   ↓
FastAPI analyzes the audio
   ↓
Multi-evidence fusion produces a decision
   ↓
Spring Boot persists the analysis
   ↓
Dashboard receives live telemetry
   ↓
Call ends
   ↓
Final analysis/report is available
```

This milestone is primarily a **verification and reliability milestone**, not a feature-expansion milestone.

---

# 3. Strict Scope Boundaries

## Allowed

The work may touch:

- `Backend/`
- `CallSimulator/`
- `Frontend/`
- `AI-Model/` only when required to expose an existing integration defect that prevents verification
- test files
- project-level documentation under `NewFlow/`

## Do not

- train or fine-tune a new model
- replace the current AI architecture
- restore AASIST
- redesign the fusion algorithm
- change the 5-second / 2.5-second analysis schedule
- store raw audio permanently
- move Dashboard logic directly onto FastAPI
- move Dashboard logic directly onto MongoDB
- create another Git repository
- run `git init`
- rewrite unrelated components for cleanup
- introduce a second live telemetry protocol if the current WebSocket + REST reconciliation already works

The objective is to verify and harden what already exists.

---

# 4. Verification Architecture

Verify these independent paths.

## 4.1 Call signaling path

```text
Caller
  ↓
Spring Boot
  ↓
Call state machine
  ↓
Receiver
```

Verify:

```text
IDLE
→ CREATED
→ RINGING
→ ACCEPTED
→ CONNECTING_MEDIA
→ ACTIVE
→ ENDING
→ ENDED
→ COMPLETED
```

Also verify supported negative states such as:

```text
REJECTED
CANCELLED
MISSED
BUSY
```

---

# 5. Full-Duplex Media Path

Verify both directions independently:

```text
A microphone
    ↓
A audio frames
    ↓
Spring Boot
    ↓
B playback

B microphone
    ↓
B audio frames
    ↓
Spring Boot
    ↓
A playback
```

Confirm:

- caller and receiver identities are not mixed
- audio sequence ordering is preserved sufficiently for playback
- no cross-participant audio routing occurs
- audio continues while AI is processing
- call media does not depend on successful AI inference

---

# 6. AI Analysis Path

Do not alter the existing AI architecture.

Verify that:

```text
audio frames
   ↓
participant buffer
   ↓
5.0 second window
   ↓
2.5 second hop
   ↓
Wav2Vec2
DF Arena
Spectrogram
Prosody/F0
Whisper
   ↓
quality gating
   ↓
signed normalization
   ↓
fusion
   ↓
HUMAN /
AI_GENERATED /
UNCERTAIN
```

Verify:

- participant-specific analysis
- correct chunk ordering
- no duplicate chunk persistence
- no stale result overriding a newer result
- backpressure remains bounded
- call-end residual buffer is flushed according to the existing rules
- low-quality audio does not bypass the quality gate

---

# 7. Dashboard Verification

The Dashboard must remain a consumer of Spring Boot only.

Verify:

```text
Spring Boot
   ↓
REST + WebSocket
   ↓
Frontend Dashboard
```

Confirm:

- active calls appear
- participant names/numbers are correct
- live decision updates arrive
- timeline chunks appear in chronological order
- caller and receiver lanes remain separate
- AI specialist telemetry updates
- acoustic quality indicators update
- diagnostic alerts appear when applicable
- call ending is reflected
- final report becomes available
- WebSocket disconnect recovery works
- REST reconciliation restores authoritative state

Do not add direct FastAPI or MongoDB access to the Dashboard.

---

# 8. End-to-End Test Matrix

## Test Group A — Normal Human Call

### Setup

```text
Device A = caller
Device B = receiver
```

### Steps

1. Start Spring Boot.
2. Start FastAPI.
3. Start MongoDB.
4. Start the Dashboard.
5. Open CallSimulator on Device A and Device B.
6. Assign distinct identities/numbers.
7. Place a call from A to B.
8. Accept on B.
9. Speak in both directions.
10. Observe live analysis.
11. End the call.
12. Open the call report.

### Verify

- call state transitions are correct
- both directions have audio
- analysis windows are created
- Dashboard updates in real time
- final session state is correct
- report contains expected persisted analysis

---

# 9. Test Group B — Incoming Call Rejection

Verify:

```text
A → B
B rejects
```

Confirm:

- receiver sees incoming call
- receiver can reject
- media does not start
- no active-call leak remains
- session reaches an expected terminal state
- dashboard reflects the result

---

# 10. Test Group C — Caller Cancellation

Verify:

```text
A → B
B has not accepted
A cancels
```

Confirm:

- incoming UI closes
- call terminates cleanly
- no media connection remains
- no orphaned active session remains

---

# 11. Test Group D — FastAPI Unavailable

This is a critical resilience test.

### Procedure

1. Start a normal call.
2. Confirm voice relay is working.
3. Stop FastAPI during the active call.
4. Continue speaking.

### Expected architecture behavior

```text
FastAPI unavailable
        ↓
AI analysis unavailable/degraded
        ↓
Voice relay continues
        ↓
Call remains usable
```

The system must not terminate the phone simulation solely because the AI service is unavailable.

When FastAPI returns, verify that new analysis windows can resume.

---

# 12. Test Group E — WebSocket Disconnect

During an active call:

1. Interrupt the Dashboard WebSocket.
2. Keep the call running.
3. Observe reconnect attempts.
4. Confirm exponential backoff.
5. Confirm REST reconciliation.
6. Confirm current authoritative call state is restored.

Verify that stale events do not overwrite newer timeline state.

---

# 13. Test Group F — Browser Refresh

During an active call:

1. Open the live monitor.
2. Refresh the browser.
3. Re-enter the call monitor.
4. Verify current state is reconstructed from authoritative backend data.

The Dashboard must not depend exclusively on in-memory browser state.

---

# 14. Test Group G — Poor-Quality Audio

Use audio with intentionally poor quality.

Verify:

```text
poor audio
   ↓
quality metrics
   ↓
quality gate
   ↓
degraded / uncertain result
```

Check:

- SNR handling
- bandwidth gating
- clipping detection
- quality status
- decision behavior
- dashboard alert behavior

Do not force an artificial binary result from poor-quality evidence.

---

# 15. Test Group H — Backpressure

Create enough analysis load to trigger the existing bounded AI queue.

Verify:

- queue remains bounded
- the voice path continues
- oldest pending analysis work is handled according to the existing policy
- `STREAM_BACKPRESSURE` telemetry/alert is emitted when applicable
- Dashboard remains responsive
- no unbounded memory growth occurs

Do not remove backpressure simply to make the test pass.

---

# 16. Test Group I — Out-of-Order Events

Simulate delayed or out-of-order analysis updates.

Verify:

```text
chunk 10
chunk 11
chunk 9   ← stale
chunk 12
```

Expected:

```text
10 accepted
11 accepted
9 rejected/ignored
12 accepted
```

Verify this independently for:

```text
CALLER
RECEIVER
```

---

# 17. Test Group J — Long-Running Call

Run a sustained test call.

Measure:

- RAM
- CPU
- audio buffer growth
- AI queue size
- MongoDB write behavior
- Dashboard timeline retention
- WebSocket stability

Confirm that memory remains bounded according to the existing retention policies.

---

# 18. Test Group K — Call-End Flush

End a call with partially accumulated audio.

Verify the existing end-of-call behavior:

```text
remaining buffered audio
        ↓
flush rule
        ↓
final eligible analysis
        ↓
persist
        ↓
final call state
```

Do not invent a new flush algorithm.

---

# 19. Persistence Verification

For every completed call verify:

```text
call_sessions
analysis_results
```

contain consistent identifiers.

Check:

- `callId`
- participant
- chunk index
- timestamps
- decision
- quality information
- model evidence
- final state

Also verify that **raw audio is not permanently stored**.

---

# 20. Required Automated Tests

Add or extend tests only where current coverage does not prove the new end-to-end behavior.

Recommended layers:

### Backend

- complete call lifecycle
- AI-unavailable resilience
- call-end flush
- backpressure
- participant routing
- duplicate/out-of-order handling
- persistence consistency

### CallSimulator

- caller/receiver behavior
- incoming call handling
- media lifecycle
- reconnect/cleanup behavior

### Frontend

- live state restoration
- terminal state rendering
- stale event protection
- offline/reconnect handling
- report availability after call completion

### AI-Model

Only add tests if an integration contract is actually failing.

Do not create new AI model behavior for this milestone.

---

# 21. Manual Two-Device Acceptance Test

This test is mandatory.

Use two real browser/device instances.

Example:

```text
Device A
+91 90000 00001

Device B
+91 90000 00002
```

Perform:

```text
A calls B
B receives
B accepts
A speaks
B speaks
Dashboard observes
AI analyzes
Call ends
Final report opens
```

Capture evidence of:

- incoming call
- connected call
- full-duplex voice
- live AI telemetry
- Dashboard timeline
- final report

---

# 22. Acceptance Criteria

Milestone 14 is complete only when:

### Functional

- [ ] Two-device call works end to end.
- [ ] Incoming call works.
- [ ] Accept/reject/cancel/end work.
- [ ] Full-duplex audio works.
- [ ] AI analysis happens during the call.
- [ ] Dashboard updates live.
- [ ] Final report is available.

### Resilience

- [ ] FastAPI failure does not terminate the voice call.
- [ ] WebSocket reconnects.
- [ ] REST reconciliation restores state.
- [ ] Stale events are rejected.
- [ ] Backpressure remains bounded.
- [ ] Browser refresh restores state.
- [ ] Long calls do not cause unbounded memory growth.

### Persistence

- [ ] Call session is persisted.
- [ ] Analysis windows are persisted.
- [ ] Participant identity is preserved.
- [ ] Final state is persisted.
- [ ] Raw audio is not permanently stored.

### Quality

- [ ] Poor-quality audio is handled through the existing quality gate.
- [ ] No fabricated calibrated probability is shown.
- [ ] `UNCERTAIN` remains possible where evidence is insufficient.

### Regression

- [ ] Backend tests pass.
- [ ] CallSimulator tests pass.
- [ ] Frontend tests pass.
- [ ] AI tests pass.
- [ ] Frontend production build passes.

---

# 23. Required Final Verification Report

At completion create:

```text
NewFlow/MILESTONE_14_END_TO_END_VERIFICATION_REPORT.md
```

The report must contain:

```text
1. Environment
2. Services Started
3. Test Matrix
4. Automated Test Results
5. Two-Device Manual Test
6. Failure Injection Results
7. Performance Observations
8. Persistence Verification
9. Known Limitations
10. Final Acceptance Status
```

For every failed test, document:

```text
Test
Expected
Actual
Root Cause
Fix
Retest Result
```

Do not hide failures.

---

# 24. Deliverables

At the end of this milestone:

```text
NewFlow/
└── MILESTONE_14_END_TO_END_VERIFICATION_REPORT.md
```

plus any focused test files needed to prove uncovered behavior.

No unnecessary architecture rewrite.

---

# 25. Next Milestone

After Milestone 14:

```text
Milestone 15
Failure & Recovery Engineering
```

Milestone 15 should focus on systematically hardening the failure cases discovered during this verification phase.

---

## Final Principle

**Milestone 14 is about proving the system you already built.**

Do not chase new features.

The success condition is:

```text
Real devices
     ↓
Real call
     ↓
Real audio
     ↓
Real-time AI
     ↓
Real persistence
     ↓
Real dashboard
     ↓
Reliable final report
```
