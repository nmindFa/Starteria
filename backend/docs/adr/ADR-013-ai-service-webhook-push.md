# ADR-013: ai-service → backend Webhook Push for PDF Extraction

## Status
Proposed — 2026-05-23

## Date
2026-05-23

## Context
PDF extraction (TASK-008, governed by ADR-012 storage and ADR-011 bridge) runs
asynchronously in the Python `ai-service` and takes ~5 minutes p95 for a typical
14-page Starteria initiative PDF. The V1 sync pattern was **purely reactive**:

```
ai-service              backend                       DB
  │ extract (~5min) ────│                              │
  │ status=completed    │ ← poll only when frontend    │
  │ in RunRegistry      │   asks                       │
  │ (in-memory)         │ ───────────────────────────→ │ persist proposals
```

In production this produced a race condition the QA log on 2026-05-22 caught:

- Frontend `usePdfAutofill.ts` capped polling at **2 minutes** (`MAX_POLL_DURATION_MS = 120_000`).
- Real DeepSeek extraction took ~5 minutes.
- Frontend gave up at 2:00, surfaced an `AUTOFILL_TIMEOUT` to the user.
- ai-service finished correctly at ~5:00 and parked the `InitiativeExtraction` in
  its in-memory `RunRegistry`.
- Backend was never told — nobody was polling anymore — so the DB stayed empty.
- Refreshing the page lost the run id; the proposals were stranded until the
  ai-service container restarted (which wiped them entirely).

The frontend timeout was bumped to 10 minutes as a stop-gap, but the underlying
fragility remained: **the only signal that "extraction is done, persist now"
came from the frontend polling**. Any user behavior that interrupted polling —
navigation, refresh, network blip, sleep, closing the laptop — broke the
persistence path.

ADR-008 (AI Integration) established the async-polling pattern but did not
specify what happens to terminal state if the client stops polling. ADR-012
(PDF Storage) defines where proposals land in DB but is silent on who triggers
the write. This ADR fills that gap for the PDF extraction subset.

The decision question: **how does ai-service notify backend that an extraction
has reached a terminal state, without depending on a live frontend client?**

Constraints inherited from prior ADRs:

- **ADR-011 (Bridge)** mandates that all backend → ai-service traffic flow
  through `bridge.service.ts` with the `X-Internal-Token` (TASK-007 V1) /
  HMAC-SHA256 (TASK-007 full) envelope. The reverse direction (ai-service →
  backend) was not previously specified.
- **ADR-008 (AI Integration)** established the async-polling pattern; webhook
  is an *addition*, not a replacement — the polling path remains as a fallback.
- **ADR-010 (Auth Error Envelope)** governs how the new endpoint surfaces 4xx /
  5xx to ai-service for retry decisions.
- **ADR-012 (PDF Storage)** owns `PdfExtractionRun.aiRunId`, the join key the
  webhook uses to find the backend row from the ai-service's own run id.

## Decision
The ai-service **pushes terminal `PdfExtractRunState` to backend** via an
internal webhook the moment an extraction reaches `completed`, `failed`, or
`cost_capped`. The frontend polling path is retained as a fallback so a missed
webhook delivery still converges.

### Architecture

```
ai-service                                    backend
  │ extract async (~5min)                       │
  │ ─── terminal status reached ───→ POST /api/v1/internal/ai/webhooks/
  │       (fire-and-forget,                       pdf-extract/runs/:aiRunId
  │        3 retries w/ exp backoff)              │
  │                                               │ verifyInternalToken()
  │                                               │ applyUpstreamRunUpdate(...)
  │                                               │ syncRunFromUpstream(...)
  │                                               │ persistProposals(...)
  │                                               │ → DB row + proposals
```

### Endpoint
- **`POST /api/v1/internal/ai/webhooks/pdf-extract/runs/:aiRunId`**
- Auth: `X-Internal-Token` shared-secret (V1) — same secret + rotation surface as
  the outbound `AiServiceClient`. TASK-007 will swap both directions for HMAC at
  the same time.
- Body matches the `PdfExtractRunState` wire shape minus `runId` (in URL) and
  `progress` (registry-internal):
  ```json
  {
    "status": "completed" | "failed" | "cost_capped" | "running" | "pending",
    "costUsd": number | null,
    "errorReason": string | null,
    "proposals": { /* InitiativeExtraction tree */ } | null
  }
  ```
- Responses: `200 { success: true, data: { runId, status } }`, `401` on token
  mismatch, `404` if no `PdfExtractionRun` has the supplied `aiRunId`, `400` on
  schema violation. All errors use the ADR-010 envelope.

### Idempotency
The handler delegates to `PdfService.applyUpstreamRunUpdate(aiRunId, body)`
which is a thin wrapper over `syncRunFromUpstream(run, upstream)`. The latter
is a **no-op when the mapped status equals the current row state**. Re-deliveries
(network retries, ai-service crash-and-recover) are safe — at-least-once
delivery is sufficient.

### Push semantics (ai-service side)
`BackendWebhookClient.push_run_state(run_id, state)`:

- Disabled when `BACKEND_WEBHOOK_URL` is empty (defaults to enabled in the
  shipping `docker-compose.yml`; tests and local-only runs leave it off and
  fall back to reactive polling).
- POSTs `state.model_dump(exclude={runId, progress})` to `{base_url}/{run_id}`.
- 3 retries with exponential backoff (1s / 3s / 9s, total ~13s).
- Retries on 5xx and network errors; **does not retry on 4xx** (deterministic).
- **Fire-and-forget**: never raises. The extraction worker awaits the push
  inline so the asyncio task does not return before delivery is attempted, but
  the client itself absorbs every predictable failure. A misconfigured webhook
  URL cannot crash an extraction.

### Reactive polling stays as fallback
`PdfService.getRun()` retains its reactive `fetchRunState` → `syncRunFromUpstream`
path. When the frontend (or any client) polls a `PENDING`/`RUNNING` run, backend
still queries ai-service and reconciles. This means:

- Lost webhook (backend down, network partition, transient 502 after 3 retries):
  next frontend poll converges the DB.
- Disabled webhook (env unset): system degrades cleanly to the V1 reactive
  pattern — slower convergence, no correctness loss.

The webhook is a **liveness optimization**, not a correctness primitive.

### Data model touch
- Added `@@index([aiRunId])` to `PdfExtractionRun` (`schema.prisma`). The
  webhook does a `findFirst({ where: { aiRunId } })` on every push; without the
  index, the lookup degrades to a sequential scan as the table grows.
- Migration: `20260523120000_pdf_extraction_run_ai_run_id_index`.

### Configuration surface
New env vars (ai-service side; backend reuses `AI_SERVICE_TOKEN`):

| Variable | Default | Purpose |
|---|---|---|
| `BACKEND_WEBHOOK_URL` | (compose default `http://backend:3001/api/v1/internal/ai/webhooks/pdf-extract/runs`) | Push target prefix; empty disables the push |
| `BACKEND_WEBHOOK_TOKEN` | (compose default `${AI_SERVICE_TOKEN}`) | Shared secret in `X-Internal-Token` |
| `BACKEND_WEBHOOK_TIMEOUT_SEC` | `10.0` | Per-request timeout on httpx call |

## Consequences

### Positive
- Persistence path no longer depends on a live frontend. Founders can close the
  tab the instant they kick off extraction and return an hour later to find the
  proposals in the DB.
- The 10-minute frontend timeout becomes a non-issue rather than the
  load-bearing UX guarantee.
- Idempotency by construction (shared `syncRunFromUpstream` helper) means we can
  add a third caller (sweeper, replay, manual admin retrigger) without rewriting
  the persistence path.
- Single shared secret across both directions keeps the rotation surface
  single-keyed; when TASK-007 swaps to HMAC, both directions move together.
- `aiRunId` index quietly fixes a future scaling cliff that was latent in the
  V1 reactive design.

### Negative
- New endpoint family `/api/v1/internal/...` with a different auth class than
  the rest of the API. Reviewers must remember it is not behind JWT.
- Webhook adds an outbound dependency for ai-service: when backend is down, the
  push retries 3× before giving up (~13s of wasted asyncio time per stranded
  extraction). Cost is bounded but non-zero.
- Two persistence paths to reason about (push + poll). The shared
  `syncRunFromUpstream` keeps the divergence to one branch (which is the
  intent), but new contributors must be told both paths exist.
- ai-service must now know a URL for backend. Coupling that ADR-011 had
  carefully made one-directional is now bidirectional. We pay this cost
  knowingly — the dual-direction is V1 simple-secret, and TASK-007 already
  planned for HMAC in both directions.

### Trade-offs
- **Webhook vs. background worker (Option B in the design discussion)** —
  chose webhook because the push happens at the natural completion boundary
  (the `_run` task already knows the terminal state). A separate worker would
  duplicate that knowledge and add a polling cadence to tune.
- **Webhook vs. WebSocket/SSE (Option C)** — chose webhook because a WebSocket
  from backend to ai-service inverts the existing trust boundary (ai-service
  becomes the connection initiator) and adds a stateful channel to operate.
  WebSocket also forces the frontend ↔ backend leg to become real-time, which
  is outside the scope of this fix.
- **Fire-and-forget vs. transactional outbox in ai-service** — chose
  fire-and-forget. The registry is in-memory by design (TODO in `runs.py`
  notes Redis/Postgres is deferred to a separate ADR); adding a persistent
  outbox here would force that decision now. The reactive polling fallback
  makes at-most-three-retry fire-and-forget acceptable for V1.

## Alternatives Considered

### Option B — Background worker in backend that polls ai-service
Polls `ai-service:/runs/{aiRunId}` every N seconds for any `PdfExtractionRun`
where `status IN ('PENDING','RUNNING')`.

- **Pros**: backend stays the active party, ai-service has no outbound
  coupling, no new endpoint required.
- **Cons**: introduces a job runner (BullMQ or cron loop) that does not exist
  elsewhere in the codebase yet; tuning the polling cadence is a knob with
  real cost (too fast = wasted RPS, too slow = bad UX); a worker crashed
  mid-iteration leaves runs stuck until the next tick.
- **Rejected**: webhook gives lower-latency convergence (~13s vs. cadence-bound)
  with a smaller operational footprint at MVP scale. Revisit if we ever need
  to also poll for *liveness* signals that ai-service can't emit (e.g. detecting
  a stuck-but-not-failed run — the webhook tells us nothing if the run never
  reaches a terminal state).

### Option C — WebSocket / SSE from backend to frontend
Eliminate polling end-to-end by streaming run status from backend to the
frontend over a persistent connection.

- **Pros**: most responsive UX; no polling at any layer.
- **Cons**: forces ai-service → backend communication regardless (the question
  this ADR set out to answer); adds an SSE/WS server abstraction to Express and
  a reconnection state-machine to the frontend; the load-balancer / nginx
  config in `k8s/nginx.conf` would need sticky connections.
- **Rejected for V1**: out of scope for the persistence fragility this ADR
  addresses. Could be layered *on top of* the webhook later — backend would
  push to the frontend the moment a webhook arrives.

### Option D — Persistent outbox in ai-service + delivery worker
ai-service writes terminal RunStates to a durable queue; a separate worker
delivers them to backend with at-least-once guarantees.

- **Pros**: webhook reliability becomes a property of the queue, not the
  network attempt.
- **Cons**: ai-service has no durable storage yet (`RunRegistry` is in-memory
  by explicit TODO in `runs.py`); standing up Redis/Postgres for the outbox is
  out of scope for a delivery-reliability fix.
- **Rejected for V1**: reactive polling fallback covers the "missed delivery"
  case sufficiently. Revisit when ai-service state is persisted (separate ADR).

## Implementation Notes

### Sequencing
This ADR ships standalone — no hard prerequisite beyond TASK-008 (PDF extractor
in production) and ADR-012 (storage + `PdfExtractionRun.aiRunId` column),
both already merged.

```
1. Refactor PdfService.getRun() → extract syncRunFromUpstream helper.
2. Add applyUpstreamRunUpdate(aiRunId, upstream) for webhook entry point.
3. Add webhook router (createAiWebhookRouter) + mount in app.ts.
4. Add @@index([aiRunId]) + migration.
5. Add BackendWebhookClient + wire from PdfExtractorAgent._notify_backend.
6. Add env vars to docker-compose for ai-service.
7. Vitest + pytest coverage for both sides.
```

Each step is independently revertable — the system degrades to V1 reactive
behavior if any one component is rolled back.

### Testing
- **Backend** (`backend/modules/initiative-pdfs/__tests__/webhook.router.test.ts`):
  happy-path 200, 401 missing / wrong token, 404 unknown `aiRunId`, 400 schema
  violation, idempotent re-delivery (same payload twice → both return 200).
- **ai-service** (`ai-service/tests/test_pdf_extractor_webhook.py`):
  disabled-when-URL-empty, payload + headers, 5xx retry until 2xx, 4xx
  no-retry, network-error swallowed after 3 retries. Uses `httpx.MockTransport`
  (no extra deps).
- **Regression**: existing `pdf.service.test.ts` (11 tests) and ai-service
  `test_routers_ai.py` (38 tests) all green after the refactor.

### Operational notes
- The webhook is opt-in via env. Local dev without docker-compose can leave
  `BACKEND_WEBHOOK_URL` unset and the system behaves exactly as it did before
  this ADR.
- When TASK-007 lands HMAC, the webhook is in scope: both the outbound
  `AiServiceClient.callPdfExtract` and the inbound `BackendWebhookClient.push`
  must move together so token rotation stays single-keyed.
- The reactive polling path in `getRun()` is now technically redundant when the
  webhook is reachable. We retain it deliberately as a fallback. Removal is
  **not** in scope and should not be undertaken without a separate ADR
  weighing the loss of the convergence guarantee.

## Compliance
- **Audit trail**: no new audit rows are emitted by the webhook handler — the
  existing `syncRunFromUpstream` path already covers status transitions. The
  ai-service emits structured logs (`webhook delivered run=... status=...
  http=... attempt=...`) that ship to the same logging substrate.
- **PII**: the webhook body carries the same `proposals` tree that already
  crosses the ADR-011 bridge in the reverse direction. PII Stage B masking
  (per ADR-012) has already been applied upstream of any LLM call; the webhook
  carries the post-mask, model-derived proposals, not raw PDF text.
- **No new data classes**: the webhook reads and writes the same
  `PdfExtractionRun` + `PdfFieldProposal` rows defined by ADR-012. No new
  retention obligations.

## References
- `backend/docs/adr/ADR-008-ai-integration.md` — async-polling pattern this ADR
  augments (not replaces).
- `backend/docs/adr/ADR-010-auth-error-envelope.md` — envelope returned by the
  new webhook endpoint on 4xx / 5xx.
- `backend/docs/adr/ADR-011-frontend-aiservice-bridge.md` — V1 shared-secret
  auth this ADR reuses for the reverse direction; HMAC migration (TASK-007)
  will cover both directions together.
- `backend/docs/adr/ADR-012-pdf-storage.md` — owns `PdfExtractionRun.aiRunId`,
  the join key between ai-service's `RunRegistry` and the backend's DB.
- `ai-service/agents/pdf_extractor/runs.py` — in-memory `RunRegistry` whose
  fragility motivates this ADR; the TODO at the top is partially addressed
  here (push) and remains open for the persistence half (deferred).
- `ai-service/agents/pdf_extractor/webhook.py` — `BackendWebhookClient`
  implementing the push.
- `backend/modules/initiative-pdfs/webhook.router.ts` — receive side.
- `backend/modules/initiative-pdfs/pdf.service.ts:312` — shared
  `syncRunFromUpstream` helper used by both polling and webhook paths.
