# Audio DeepCheck — Milestone 10: Database Integration & Persistence

## Current Status

Milestone 9 — Spring Boot Backend Foundation & FastAPI Integration — is complete.

The backend currently has the call-session domain, state machine, FastAPI client, request correlation, error translation, composite health, all 11 REST endpoints, and in-memory repositories. The latest walkthrough reports 48/48 backend tests passing. The documented next milestone is Database Integration & Persistence. fileciteturn7file0L363-L373

## Goal

Replace:

```text
InMemoryCallSessionRepository
InMemoryAnalysisRepository
```

with real persistent storage so that call sessions, AI analysis, evidence, and chunk results survive application restarts and can later be consumed by the Dashboard.

Target:

```text
Mobile / Dashboard
        ↓
    Spring Boot
        ↓
     Database
        ↑
     FastAPI
```

## Database Choice

Prefer **MongoDB / MongoDB Atlas** if the current Backend has no already-established database direction.

Reason: the current analysis result is hierarchical:

```text
Call
 ├── quality
 ├── fusion
 ├── modules
 └── chunks
```

However, inspect the current Backend first. If MySQL/JPA is already committed, keep that choice. Do not introduce both databases.

## Scope

Work only in `Backend/`, with necessary project-level documentation updates in `NewFlow/SPRING_BOOT_ENDPOINTS.md`.

Do not:
- modify `AI-Model/`
- modify `Frontend/`
- train models
- implement WebSockets/live streaming
- store raw audio unnecessarily
- create a second database

## Data Model

### Call Session

```text
callId
caller
receiver
status
createdAt
startedAt
endedAt
durationSec
latestAnalysisStatus
latestDecision
latestDecisionStrength
confidenceStatus
qualitySummary
conflictLevel
requestId
```

### Analysis Result

```text
analysisId
callId
processedAt
masterDecision
decisionStrength
syntheticEvidenceScore
confidenceStatus
conflictLevel
quality
processingMetadata
```

### Module Evidence

```text
module
status
evidenceType
direction
contribution
metadata
```

### Chunk Analysis

```text
callId
chunkIndex
startSec
endSec
decision
decisionStrength
qualityScore
moduleSummary
processedAt
```

Do not persist raw uploaded audio unless explicitly required.

## Repository Design

Keep the existing abstractions:

```text
CallSessionRepository
AnalysisRepository
```

Replace only their storage implementations.

The service layer must not know whether storage is in-memory, MongoDB, or MySQL.

## Configuration

All database credentials must come from environment/configuration.

Never hard-code:

```text
URI
username
password
Atlas secrets
```

Document the required environment variables.

## Indexes / Queries

Support the future Dashboard queries:

```text
find call by ID
active calls
recent calls
filter by status
filter by decision
history
chunk timeline
evidence
```

Create only useful indexes such as:

```text
callId
createdAt
status
decision
caller
receiver
```

## Persistence Flow

### Create

```text
POST /calls
 ↓
CallSessionService
 ↓
Repository
 ↓
Database
```

### Start

```text
POST /calls/{id}/start
 ↓
state transition
 ↓
database update
```

### Analyze

```text
POST /calls/{id}/audio
 ↓
FastAPI
 ↓
analysis result
 ↓
persist analysis
 ↓
update latest call state
```

### End

```text
POST /calls/{id}/end
 ↓
state transition
 ↓
database update
```

## Consistency

When analysis completes:

```text
save analysis
+
update latest call analysis state
```

must remain consistent.

Avoid unnecessary distributed transactions.

## Testing

Add database integration tests for:

- create/get/update call
- end/complete call
- save/retrieve analysis
- latest analysis update
- save/retrieve ordered chunks
- evidence retrieval
- active calls
- history
- decision filtering
- restart/persistence where practical

Use an isolated test database or Testcontainers. Never use a shared production database for automated tests.

Maintain all existing tests. Current baseline is 48/48.

## API Contract

Keep `NewFlow/SPRING_BOOT_ENDPOINTS.md` compatible.

Database persistence should normally be an internal change.

## Performance

Measure:

```text
insert latency
read latency
analysis persistence latency
history query latency
```

Do not design database writes around every future microphone frame. Live-stream transport is Milestone 12.

## No Live Streaming

This milestone ends at:

```text
multipart audio
 ↓
FastAPI
 ↓
analysis
 ↓
database
```

Do not implement:

```text
microphone
 ↓
continuous stream
 ↓
database
```

## Definition of Done

- [ ] Database selected
- [ ] Repository interfaces preserved
- [ ] In-memory repositories replaced
- [ ] Call persistence
- [ ] Analysis persistence
- [ ] Evidence persistence
- [ ] Chunk persistence
- [ ] Externalized DB configuration
- [ ] Useful indexes
- [ ] Dashboard queries
- [ ] Integration tests
- [ ] Isolated test DB
- [ ] 48 existing tests still pass
- [ ] API contract remains compatible
- [ ] No raw-audio persistence unless required
- [ ] No WebSockets
- [ ] No live streaming
- [ ] AI-Model untouched
- [ ] Frontend untouched

## Next Milestone

**Milestone 11 — Mobile Call Simulator Frontend**

That stage begins the second frontend: microphone permission, simulated call UI, call-session creation, audio capture, and client-side streaming preparation.
