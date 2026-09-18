# Audio DeepCheck — Milestone 8: FastAPI REST Service

## Status
- Current: Milestone 7 complete
- Next: Milestone 8
- Scope: `AI-Model/` only
- Current baseline: 73/73 tests passing
- API goal: expose existing `FusionService` through a clean REST boundary
- Backend/Frontend integration: not part of this milestone

The latest walkthrough explicitly identifies Milestone 8 as a FastAPI REST Service with `/api/v1/analyze`, `/api/v1/health`, streaming/batch analysis preparation, and clean JSON contracts for later Spring Boot integration. fileciteturn5file0L182-L189

## 1. Goal

Build a testable FastAPI application around the existing AI-Model.

```text
HTTP Client
  ↓
FastAPI
  ↓
Request Validation
  ↓
Temporary Audio File
  ↓
FusionService
  ↓
Master Decision JSON
```

FastAPI must NOT reimplement detection, chunking, quality, or fusion logic.

## 2. Hard Boundary

Work only inside:

```text
AI-Model/
```

Do not modify:
- `Backend/`
- `Frontend/`

Do not:
- create another Git repository,
- restore AASIST,
- retrain models,
- alter fusion weights for the 8-sample benchmark,
- build WebSockets/real-time call streaming,
- integrate Spring Boot yet,
- claim production accuracy.

## 3. First Step — Inspect

Before coding:
1. Read current status docs.
2. Inspect `app/services/fusion_service.py`.
3. Inspect `EvidenceRecord` and current result schemas.
4. Inspect dependency configuration.
5. Inspect tests.
6. Run all 73 existing tests and confirm the baseline.

## 4. Project Structure

Adapt to existing conventions. A likely structure is:

```text
app/
  main.py
  api/
    routes.py
    schemas.py
  services/
scripts/
tests/
```

Do not create duplicates where equivalent files already exist.

## 5. Dependencies

Use compatible versions of:
- FastAPI
- Uvicorn
- Pydantic

Do not upgrade unrelated packages.

## 6. Endpoints

### Health

```http
GET /api/v1/health
```

Example:

```json
{
  "status": "ok",
  "service": "audio-deepcheck-ai",
  "version": "0.1.0",
  "fusion_available": true
}
```

Health must not execute a full analysis.

### Analyze

```http
POST /api/v1/analyze
Content-Type: multipart/form-data
```

Form:
```text
file=<audio>
```

Optional parameters may include:
```text
chunk_size
hop_size
return_evidence
return_chunks
```

Reuse existing FusionService defaults. Do not create a second chunker.

## 7. Request Validation

Handle actual failure types with appropriate status codes:

```text
400 invalid parameters
413 upload too large
415 unsupported file/media
422 validation error
500 unexpected internal error
503 AI service unavailable
```

Never return Python stack traces to clients.

## 8. Temporary File Handling

Implement:

```text
upload
→ validate
→ secure temporary path
→ FusionService
→ collect result
→ delete temporary file
```

Requirements:
- cross-platform,
- no hard-coded paths,
- guaranteed cleanup on success/failure,
- no persistent audio storage by default,
- no path traversal.

## 9. API Response

Use Pydantic response schemas matching the real FusionService result.

Conceptual example:

```json
{
  "request_id": "uuid",
  "status": "success",
  "decision": "AI_GENERATED",
  "decision_strength": 0.84,
  "confidence_status": "PROVISIONAL",
  "quality": {},
  "fusion": {},
  "modules": [],
  "chunks": {},
  "processing": {}
}
```

Do not invent fields unsupported by the actual service.

`decision_strength` must remain explicitly **provisional**, not a calibrated probability.

## 10. Error Contract

Use:

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_AUDIO",
    "message": "The uploaded audio could not be processed."
  },
  "request_id": "uuid"
}
```

Never expose:
- filesystem paths,
- tracebacks,
- secrets,
- environment variables,
- unnecessary model internals.

## 11. Request ID and Logging

Generate/validate a request ID and expose it as:

```text
X-Request-ID
```

Log:
- request received,
- analysis started,
- analysis completed,
- failure,
- duration,
- cleanup.

Never log raw audio.

## 12. Concurrency / RAM Protection

The underlying models are memory-sensitive. Do not allow unlimited concurrent heavy analyses.

Implement a configurable guard, with a safe default such as:

```text
ANALYSIS_CONCURRENCY=1
```

Use an async semaphore or equivalent.

Document why the limit exists.

Respect the existing load → predict → unload lifecycle.

## 13. File Limits

Support formats already handled by the AI-Model.

Do not trust file extension alone.

Add configurable limits such as:

```text
AUDIO_DEEPCHECK_MAX_UPLOAD_MB
AUDIO_DEEPCHECK_MAX_DURATION_SEC
```

Keep API configuration separate from model/fusion configuration.

## 14. OpenAPI Docs

Verify:

```text
/docs
/redoc
```

Document:
- request format,
- response schema,
- HUMAN / AI_GENERATED / UNCERTAIN semantics,
- uncertainty meaning,
- error codes,
- provisional confidence semantics.

## 15. Tests

Create/adapt `tests/test_api.py`.

Cover:
- health 200/schema,
- missing file,
- empty file,
- unsupported format,
- oversized upload,
- invalid parameters,
- successful request,
- JSON serialization,
- FusionService error handling,
- temporary-file cleanup on success/failure,
- concurrency guard.

Mock expensive models for most route tests.

Include at least one integration-style test:

```text
HTTP request
→ API
→ FusionService
→ valid response
```

Keep the full suite green:

```text
73 existing + new API tests = all passing
```

## 16. Local Run

Provide a documented command such as:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verify:

```text
http://localhost:8000/docs
```

Do not expose publicly by default during development.

## 17. Example

```bash
curl -X POST   "http://localhost:8000/api/v1/analyze"   -H "accept: application/json"   -H "Content-Type: multipart/form-data"   -F "file=@data/samples/ai_voice.wav"
```

## 18. Performance Benchmark

Measure:
- upload overhead,
- FusionService time,
- total request latency,
- serialization overhead,
- peak RSS.

Separate API overhead from AI inference.

## 19. Security Baseline

Ensure:
- safe temporary files,
- path traversal prevention,
- size/duration limits,
- no arbitrary file execution,
- no raw audio logging,
- no traceback leakage,
- cleanup on all paths.

Authentication can remain a later concern unless needed for local testing.

## 20. Definition of Done

- [ ] FastAPI application
- [ ] `/api/v1/health`
- [ ] `/api/v1/analyze`
- [ ] Pydantic schemas
- [ ] temporary-file lifecycle
- [ ] request ID
- [ ] structured logging
- [ ] error contract
- [ ] concurrency guard
- [ ] configurable file/duration limits
- [ ] OpenAPI verified
- [ ] API tests
- [ ] integration-style API test
- [ ] API performance benchmark
- [ ] 73 existing tests remain passing
- [ ] only `AI-Model/` changed
- [ ] Backend untouched
- [ ] Frontend untouched
- [ ] no Spring Boot integration
- [ ] no WebSocket real-time pipeline

## 21. Next Stage

After Milestone 8, move to API hardening/deployment and then the boundary for Spring Boot integration. Do not modify Spring Boot during this milestone.
