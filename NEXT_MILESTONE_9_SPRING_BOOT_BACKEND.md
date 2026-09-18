# Audio DeepCheck — Milestone 9
## Spring Boot Backend Foundation & FastAPI Integration

### Current Status

Milestone 8 — **FastAPI REST Service Layer** is complete.

The current AI service provides:

```text
GET  /api/v1/health
POST /api/v1/analyze
```

with validated audio uploads, JSON schemas, request IDs, concurrency protection, secure temporary files, OpenAPI documentation, and 92/92 passing tests. The FastAPI walkthrough also states that the service is ready for Spring Boot consumption. fileciteturn6file0L5-L30 fileciteturn6file0L199-L223

The next stage is therefore **Spring Boot Backend Integration**, not model training/calibration.

---

# 1. Scope of This Milestone

This milestone creates the Java backend that sits between:

```text
Mobile Call Simulator
        ↓
    Spring Boot
        ↓
      FastAPI
        ↓
      AI Model
```

and later:

```text
Dashboard
        ↓
    Spring Boot
        ↓
    Database
```

### IMPORTANT

For this milestone:

- Work inside the Spring Boot `Backend/` application.
- Do NOT modify `AI-Model/` unless a confirmed API contract mismatch is found.
- Do NOT modify the frontend applications.
- Do NOT train or fine-tune AI models.
- Do NOT implement the complete real-time audio streaming system yet.
- Do NOT build database-heavy analytics before the backend domain is defined.

The primary goal is to establish a **clean backend foundation and a reliable FastAPI client**.

---

# 2. Target Architecture

```text
                         ┌───────────────────────┐
                         │ Mobile Call Simulator │
                         └───────────┬───────────┘
                                     │
                              Spring Boot API
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │    Spring Boot        │
                         │                       │
                         │ Controllers           │
                         │ Services              │
                         │ FastAPI Client        │
                         │ Call Session          │
                         │ DTOs / Validation     │
                         └──────────┬────────────┘
                                    │
                            HTTP / REST client
                                    │
                                    ▼
                         ┌───────────────────────┐
                         │       FastAPI         │
                         │       AI Service      │
                         └──────────┬────────────┘
                                    │
                                    ▼
                              AI Fusion Engine
```

The Dashboard will later consume Spring Boot APIs, not FastAPI directly.

---

# 3. Deliverables

Create/adapt:

```text
Backend/
├── src/main/java/.../
│   ├── controller/
│   ├── service/
│   ├── client/
│   ├── dto/
│   ├── exception/
│   ├── config/
│   └── ...
└── ...
```

The exact package structure should follow the existing backend project conventions.

Also maintain the project-level documentation:

```text
Audio-DeepCheck/
└── SPRING_BOOT_ENDPOINTS.md
```

Use the existing `SPRING_BOOT_ENDPOINTS.md` created for the project as the API contract baseline.

---

# 4. Step 1 — Inspect Existing Backend

Before coding:

1. Inspect the current `Backend/` repository.
2. Identify:
   - Spring Boot version
   - Java version
   - Maven/Gradle
   - existing dependencies
   - current package structure
   - current security setup
   - existing database configuration
3. Do not rewrite existing working code.
4. Determine whether the backend already has controllers/services/configuration that can be extended.

Then create a small implementation plan.

---

# 5. FastAPI Contract To Consume

The Spring Boot client should consume:

```text
GET /api/v1/health
POST /api/v1/analyze
```

Current FastAPI behavior includes:

```text
200  success
400  invalid audio/duration/parameter
413  upload too large
415  unsupported/corrupt audio
422  validation failure
503  analysis queue saturated
500  sanitized internal error
```

The FastAPI walkthrough documents these codes and confirms consistent JSON fields and `X-Request-ID` propagation. fileciteturn6file0L199-L213

Do NOT invent a different FastAPI response contract in Spring Boot.

---

# 6. FastAPI Client

Implement a dedicated client, for example:

```text
FastApiAiClient
```

Use the project's compatible Spring HTTP client:

- `RestClient`, or
- `WebClient`

Prefer the simplest reliable client compatible with the existing Spring Boot version.

The client should support:

```text
health()
analyze(audio, options)
```

It should not contain business logic.

---

# 7. Request Correlation

Spring Boot must generate/propagate:

```text
X-Request-ID
```

Flow:

```text
Mobile/Dashboard
       ↓
Spring Boot request ID
       ↓
FastAPI X-Request-ID
       ↓
FastAPI response
       ↓
Spring Boot logs
```

The FastAPI service already supports request ID tracing. fileciteturn6file0L20-L22

Do not create a second unrelated tracing mechanism.

---

# 8. Backend API Layer

The first backend APIs should follow the existing Spring Boot endpoint contract.

Initial endpoints:

```text
GET  /api/v1/health

POST /api/v1/calls

POST /api/v1/calls/{callId}/start

GET  /api/v1/calls/{callId}

GET  /api/v1/calls/active

GET  /api/v1/calls

GET  /api/v1/calls/{callId}/analysis

POST /api/v1/calls/{callId}/end

GET  /api/v1/calls/{callId}/evidence

GET  /api/v1/calls/{callId}/chunks

GET  /api/v1/calls/{callId}/report
```

Do not implement live binary audio streaming yet unless the backend architecture already requires it.

For Milestone 9, focus on the **application contract and AI-service communication**.

---

# 9. Call Session Domain

Create the first backend domain model around a call session.

Suggested fields:

```text
callId
caller
receiver
status
createdAt
startedAt
endedAt
duration
latestAnalysisStatus
latestDecision
requestId
```

Suggested states:

```text
CREATED
CONNECTING
ACTIVE
ANALYZING
ENDED
COMPLETED
FAILED
INTERRUPTED
AI_UNAVAILABLE
```

Do not over-engineer the model yet.

---

# 10. DTO Separation

Do not expose database entities directly from controllers.

Use DTOs for:

```text
CreateCallRequest
CreateCallResponse
CallResponse
AnalysisResponse
ErrorResponse
```

The FastAPI response DTO should be separate from the public Spring Boot API DTO where appropriate.

This protects the backend API from internal AI-service changes.

---

# 11. AI Analysis Service

Create an application service such as:

```text
CallAnalysisService
```

Responsibilities:

```text
receive analysis request
        ↓
prepare AI-service request
        ↓
FastApiAiClient
        ↓
validate FastAPI response
        ↓
convert to backend domain DTO
        ↓
update call state
```

Do not put this logic directly inside the controller.

---

# 12. Error Translation

Map AI-service errors into clean backend errors.

Example:

```text
FastAPI 413
    ↓
Spring Boot
    ↓
AUDIO_TOO_LARGE
```

Example:

```text
FastAPI 503
    ↓
Spring Boot
    ↓
AI_SERVICE_BUSY
```

Example:

```text
FastAPI connection timeout
    ↓
Spring Boot
    ↓
AI_SERVICE_UNAVAILABLE
```

Do not leak raw FastAPI stack traces to the client.

---

# 13. Timeout / Retry Policy

AI inference is expensive.

Do NOT create aggressive automatic retries.

Define:

```text
connect timeout
read timeout
overall request timeout
```

Retry only failures that are explicitly safe to retry.

Do not retry large audio inference blindly because it can duplicate expensive model work.

---

# 14. Health Integration

Spring Boot health should distinguish:

```text
Spring Boot itself
FastAPI availability
Database availability
```

Example internal state:

```json
{
  "backend": "UP",
  "aiService": "UP",
  "database": "UP"
}
```

Do not make the main `/health` endpoint perform expensive AI inference.

---

# 15. Database Preparation

Database integration is NOT the main task of this milestone.

However, prepare clean interfaces so Milestone 10 can add:

```text
CallSessionRepository
AnalysisRepository
```

Do not lock the whole domain to a database-specific structure yet.

If the project already has MySQL or MongoDB configured, preserve that configuration and extend it carefully.

---

# 16. Testing Requirements

Add tests for:

### Controller

- create call
- start call
- get call
- invalid call ID
- invalid state transition

### FastAPI Client

Mock:

```text
200 response
400
413
415
422
503
timeout
connection failure
```

### Service

- successful AI analysis
- AI failure
- state update
- response mapping
- request ID propagation

### API contract

Verify the JSON shape documented in:

```text
SPRING_BOOT_ENDPOINTS.md
```

---

# 17. Integration Test

At least one integration-style test should execute:

```text
Spring Boot endpoint
      ↓
FastApiAiClient
      ↓
Mock/controlled FastAPI server
      ↓
Spring Boot response
```

Do NOT run the full heavyweight AI models for every Spring Boot unit test.

Keep unit tests fast.

---

# 18. `SPRING_BOOT_ENDPOINTS.md`

At the end of Milestone 9, make sure this file is accurate.

It should contain:

```text
base URL
endpoint
method
purpose
authentication
request headers
request body
query parameters
success response
error response
HTTP status codes
example request
example response
state rules
```

This file is the handoff document for the frontend developer and future integration work.

---

# 19. No Mobile Streaming Yet

Do not fully solve:

```text
microphone
 ↓
continuous binary stream
 ↓
Spring Boot
 ↓
FastAPI
```

in Milestone 9.

Only make Spring Boot ready for it.

The actual live audio transport belongs to the next milestone.

---

# 20. Definition of Done

Milestone 9 is complete when:

- [ ] Spring Boot structure inspected and preserved.
- [ ] FastAPI client implemented.
- [ ] `X-Request-ID` propagated.
- [ ] Call session domain implemented.
- [ ] Controllers implemented for the initial call API.
- [ ] DTOs implemented.
- [ ] AI analysis service implemented.
- [ ] FastAPI errors mapped cleanly.
- [ ] Timeout policy implemented.
- [ ] Backend/FastAPI health integration implemented.
- [ ] Unit tests implemented.
- [ ] Integration-style test implemented.
- [ ] `SPRING_BOOT_ENDPOINTS.md` updated and verified.
- [ ] Database implementation is not over-engineered.
- [ ] Mobile streaming is not implemented yet.
- [ ] `AI-Model/` is not modified unnecessarily.
- [ ] Frontend is untouched.

---

# 21. Next Milestone

After Milestone 9:

## Milestone 10 — Database + Call Persistence

Then:

```text
Milestone 11 — Mobile Call Simulator
Milestone 12 — Live Audio Streaming
Milestone 13 — Spring Boot ↔ FastAPI Streaming Analysis
Milestone 14 — Dashboard
Milestone 15 — Complete End-to-End Call Flow
Milestone 16 — Reliability + Security
Milestone 17 — Deployment / Final Integration
```

This order matches the actual project responsibilities and avoids spending the remaining project time on AI training.
