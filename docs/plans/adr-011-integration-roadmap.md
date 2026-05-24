# ADR-011 Integration Roadmap — Front ↔ ai-service Bridge

**Status:** Proposed
**Date:** 2026-05-07
**ADR:** [`backend/docs/adr/ADR-011-frontend-aiservice-bridge.md`](../../backend/docs/adr/ADR-011-frontend-aiservice-bridge.md)
**Diagram:** [`docs/diagrams/adr-011-frontend-aiservice-bridge.drawio`](../diagrams/adr-011-frontend-aiservice-bridge.drawio)
**Related ADRs:** ADR-002 (orchestration), ADR-008 (AI integration), ADR-010 (typed error envelope V1), ADR-001 / ADR-003 (model & prompts)

## Why this plan exists

The audit (2026-05-07) confirmed that the AI bridge is **wired only at infra level** (docker-compose service + `AI_SERVICE_URL` env). The 11 ai-service endpoints are **unreachable from the front today**: `proxyToAiService` has zero callers, `step.service.ts:144` carries a `// TODO: Trigger AI review pipeline`, the Prisma `FeedbackIA` model has zero writes, every AI panel renders mocks from `AppContext.tsx:97-102`. ADR-011 defined the architecture; this roadmap defines how to ship it in **6 phases over ~6 sprints (12 weeks)** with a tracer-bullet vertical slice in Phase 3.

## Conventions

- **Sprint = 2 weeks.** Phase ↦ sprint mapping is a recommendation; reorder if a dependency unblocks.
- **Estimation key:** **S** = <4h · **M** = 4-12h · **L** = >12h.
- **AI is enhancement, never blocking.** Every UI must degrade gracefully when ai-service is down — step/save flows must keep working.
- **Trust boundary = Express.** ai-service stays internal. No auth in ai-service router; HMAC + network isolation enforced from F1/F2.
- **Single source of truth for types:** Pydantic schemas in `ai-service` → OpenAPI → `openapi-typescript` → `front/src/app/services/ai/generated/api.ts`.

## Phase 0 — Tooling bootstrap (prerequisite for everything)

The tester audit flagged a hard blocker: there is no test scaffolding in `backend/` or `front/src/`, and `ai-service/tests/` only has `test_wiring.py`. **Without test infra, no phase is auditable.** Land in S-1, ahead of F1.

- Backend: `jest` + `supertest` + `nock` + `ioredis-mock`. Add `npm test` script. Land one passing "hello world" test.
- Front: `vitest` + `@testing-library/react` + `msw`. Add `npm test` script in `front/`. Land one passing test.
- ai-service: extend `pytest` with `respx` (for stubbing Anthropic), `httpx`, `freezegun`, `schemathesis` for OpenAPI fuzzing.
- Shared: `tests/factories/` with `fakeProject`, `fakeUser`, `fakeJWT`, `fakeAiResponse` builders.
- CI: GitHub Actions workflow that runs all three test suites on PR.

**Exit criteria:** all three suites green on `main`; coverage gate configured (≥80% lines globally, 100% on critical mappers/middleware).

---

## Phase 1 — Network lock-down + observability base

**Sprint:** S-1 · **Dependencies:** Phase 0 · **Reference capability:** none (transversal)

### Goal
Close ai-service from the public internet and stand up request-id propagation that every later phase relies on.

### Backend tasks
- **F1.1** Replace `ports: ["8001:8001"]` with `expose: ["8001"]` in `docker-compose.yml`; add `internal-ai` network (`internal: true` in prod). [S]
- **F1.2** Extend `backend/shared/middleware/request-id.ts` to validate UUID format and expose `getRequestId(req)` helper. [S]
- **F1.3** New `GET /health/ai` route in `backend/modules/ai/ai.health.ts` (cached 5 s in-memory, used later by circuit breaker). [S]
- **F1.4** Inject `X-Request-Id` and `traceparent` (W3C) into `proxyToAiService` signature. [S]
- **F1.5** New FastAPI middleware `ai-service/middleware/request_id.py` with `contextvars.ContextVar` for log enrichment. [S]
- Replace native `fetch` with `undici.Pool` (`connections: 32, keepAliveTimeout: 60s`). [M] *(can slip to F5 if needed)*

### Front tasks
- **F-1.1** Axios interceptor in `front/src/app/services/api.ts` that sets `X-Request-Id` (UUIDv7) on every outgoing request. [S]
- **F-1.2** Surface `requestId` in `parseApiError` and provide `formatRequestIdForSupport(err)` helper for banners/toasts. [S]

### Tests & observability
- Unit: `requestIdMiddleware.spec.ts`, `logger.spec.ts` (asserts no prompts/payloads in stdout), `test_request_id_propagation.py`.
- Integration: `docker-compose.test.yml` + `POST /api/v1/ai/health` round-trips the same `requestId` to logs in both containers (grep stdout).
- **Network smoke (blocking gate):** `scripts/test-network-isolation.sh` runs from outside compose; `curl host:8001/health` MUST fail with connection refused. CI job blocks merge.
- Logger emits only metadata (`userId, projectId, capability, latencyMs, requestId`); no prompts or model output.

### Exit criteria
- `nmap` from host to `:8001` returns refused; backend reaches it via `http://ai-service:8001`.
- Every `/api/v1/*` request carries `X-Request-Id` in req and res; same id appears in ai-service logs.
- `/health/ai` returns 200/503 within 300 ms.
- Logs scrubbed (regex assertion on debug-level run).

### Risks
- Local dev that hits `:8001` directly breaks → mitigate with `npm run dev:proxy` tunnel through backend.
- Health-check consumes tokens → minimal 1-token prompt + 30 s cache.

### KPIs
100% of requests carry `requestId` · 0 host ports exposed for ai-service · `/health/ai` uptime ≥99%.

---

## Phase 2 — HMAC defense-in-depth

**Sprint:** S-1 (second half) · **Dependencies:** F1 · **Reference capability:** none

### Goal
Even if the internal Docker network is compromised, only Express can invoke ai-service.

### Backend tasks
- **F2.1** Generate `AI_SERVICE_SHARED_SECRET` (32-byte base64); add to `.env.example` of both services; new `scripts/gen-ai-secret.sh`; document quarterly rotation in `backend/docs/runbooks/ai-secret-rotation.md`. [S]
- **F2.2** New `backend/modules/ai/hmac.ts` with `signRequest(rawBody, ts, secret)` and `attachHmacHeaders(headers, body)`. [S]
- **F2.3** New FastAPI middleware `ai-service/middleware/hmac.py` with `verify_hmac` and dual-secret support (`AI_SERVICE_SHARED_SECRET_NEXT` for 5-min rotation window). [M]
- **F2.4** Wire HMAC into both sync (`proxyToAiService`) and SSE (`streamToAiService` in F5) paths. [S]

### Front tasks
- N/A — HMAC is server-side. Confirm in review that no front PR touches signing.

### Tests & observability
- Unit: known HMAC vectors (`tests/fixtures/hmac-vectors.json` shared across services); 1-byte mutation must change signature.
- Anti-replay: `freezegun` clock — timestamp ±31 s → 401; mismatched body → 401; dual-secret rotation accepts both during window.
- Integration: MITM proxy mutates body → ai-service 401 → Express maps to `AI_INTERNAL` (no leak per ADR-011 §11).
- Metric `ai_hmac_failures_total{reason}` with alert at >5/min.

### Exit criteria
- Direct call to `ai-service:8001/ai/feedback` without HMAC headers → 401.
- Rotation drill (100 alternating-secret requests) all pass.
- Clock skew ≥30 s rejected with `code: "HMAC_REPLAY"`.
- Secret never appears in `git log -p` or built images.

### Risks
- Container clock drift → NTP + 30 s window.
- Secret leak in logs → header allowlist for logging.

### KPIs
0 unsigned requests accepted · added latency from signing <2 ms P95.

---

## Phase 3 — Tracer-bullet: feedback (sync) end-to-end

**Sprint:** S-2 · **Dependencies:** F1, F2 · **Reference capability:** **`feedback`**

### Goal
Prove the **complete pattern** (front hook → Express middleware stack → HMAC → ai-service → Anthropic → persistence → UI render) on one sync capability. F4-F6 then replicate this slice.

### Backend tasks
- **F3.1** New `backend/modules/ai/ai.router.ts` with `POST /api/v1/ai/feedback`; stack `requireAuth → verifyProjectOwnership → validateAiBody → controller`. Mount at `/api/v1/ai` in `app.ts`. [M]
- **F3.2** New middleware `verify-project-ownership.ts` queries `prisma.project.findFirst({where:{id, userId: jwt.sub}})`; rewrites `req.body.userId = jwt.sub` (drops any front-supplied userId). [S]
- **F3.3** New `backend/modules/ai/ai.service.ts` with `runCapability(cap, input, ctx)`; measures `latencyMs`, persists `AiInvocationLog`, dispatches to capability persistor. [M]
- **F3.4** Prisma migration for `AiInvocationLog` (`id, userId, projectId, capability, model, tokensIn, tokensOut, costUsd, latencyMs, status, errorCode, requestId, createdAt`); enum `AiInvocationStatus`; indexes by user/project/requestId. [S]
- **F3.5** New `backend/modules/ai/persistors/feedback.persistor.ts` upserts `FeedbackIA` post-proxy in a single transaction. [M]
- **F3.6** ai-service `routers/ai.py:62-69` and `schemas/requests.py`: require `userId` in body and use it in `_minimal_context` (kill `"system"` hardcode). [S]

### Front tasks
- **F-3.1** New `front/src/app/services/ai/aiClient.ts` with `aiPost<TPayload, TData>(capability, body)`; envelope V1 unwrap; throws `AiError` with discriminable `code`. [M]
- **F-3.2** New `front/src/app/services/ai/types.ts` with `Capability` union, envelope/error types, handwritten payload shapes (replaced in F4). [S]
- **F-3.3** New `front/src/app/services/ai/capabilities/feedback.ts`: `getFeedback(input): Promise<FeedbackData>`. [S]
- **F-3.4** New `front/src/app/hooks/useAiAgent.ts` (sync). Returns `{data, status, error, meta, run, retry}`; AbortController on unmount. [M]
- **F-3.5** Rewrite `FeedbackIAPanel.tsx` to consume the hook; loading skeleton; degraded banner on `AI_UNAVAILABLE` with `requestId`; retry button. [M]
- **F-3.6** Remove `feedbackIA` mock from `AppContext.tsx:97-111`. [S]

### Tests & observability
- TDD London on `feedback.controller.spec.ts`: order `verifyOwnership → proxy → prisma.$transaction([feedback, log])`; rollback on Prisma failure.
- Ownership integration: user A requesting project P_B → 403, no `AiInvocationLog` row.
- Stub Anthropic via `respx`; assert `AiInvocationLog.costUsd > 0, tokensUsed > 0`.
- Snapshot `ai-service/openapi.json` for `feedback`; pact-lite via `schemathesis run --checks all`.
- Observability gate: `costUsd > 0` rows after suite; zero log lines containing prompt text.

### Exit criteria
- A user on `Step1Page` sees real feedback in <5 s P95.
- Refresh keeps the feedback (re-read from `FeedbackIA`, no second AI call).
- `AiInvocationLog` row per call with non-zero metrics.
- `AppContext.tsx:97-111` no longer mocks feedback.
- Coverage ≥85% in the new path.

### Risks
- `FeedbackIA` shape mismatch with agent output → additive migration + adapter layer.
- Doubled context assembly → reject in code review (ADR-011 §7 forbids it).

### KPIs
P95 `/api/v1/ai/feedback` <5 s · success rate ≥98% · cost/req <$0.05 P95.

---

## Phase 4 — Front foundation: hooks, types, error envelope

**Sprint:** S-3 · **Dependencies:** F3 · **Reference capability:** re-uses `feedback` to validate abstractions

### Goal
Industrialise the front client so phases 5 and 6 are copy-extend, not copy-paste.

### Backend tasks
- **F4.1** Discriminated `AiCapability` union and `AiEnvelope<T>` types in `backend/modules/ai/ai.types.ts`. [S]
- **F4.2** New `backend/modules/ai/ai.errors.ts` with `mapAiServiceError(err)`; integrates with `shared/errors/error-handler.ts`. Implements ADR-011 §11 mapping table; never leaks stack. [M]
- **F4.3** New `scripts/export-ai-openapi.sh`; verify FastAPI `/openapi.json` consumable by `openapi-typescript`. [S]

### Front tasks
- **F-4.1** New `useAiTask.ts` hook: backoff 1s/2s/4s/8s (cap, max 60 polls, jitter ±20%); pauses on hidden tab; AbortController. [M]
- **F-4.2** New `useAiStream.ts` skeleton (filled in F5). [L]
- **F-4.3** Centralise error mapping in `aiClient.ts`: `mapToAiError`, `isRetryable`, `isDegradable`. [S]
- **F-4.4** New `AiUnavailableBanner.tsx`: copy per `code`; auto-dismiss 8 s for `AI_RATE_LIMIT`; persist for `AI_UNAVAILABLE`; surfaces `requestId`. [M]
- **F-4.5** `npm run gen:api` script + CI step (`gen:api && tsc --noEmit && git diff --exit-code`). Add `front/src/app/services/ai/generated/` to `.gitignore`. [M]
- **F-4.6** Replace handwritten payload types with imports from `generated/api.ts`. [S]

### Tests & observability
- `useAiAgent` parametric tests across the 7 envelope codes (loading, success, rate-limit, timeout, cost-limit, validation, network).
- OpenAPI drift check is a CI gate.
- Sentry/equivalent indexes `requestId` as a tag; metric `ai_errors_total{code}` populated for all 8 codes.

### Exit criteria
- `npm run gen:api` fails CI on Pydantic↔TS drift.
- `FeedbackIAPanel` works with `useAiAgent` (no behaviour regression).
- 0 handwritten capability payload interfaces remain.
- Per-code copy renders correctly in Storybook.

### Risks
- FastAPI generates `any` for complex unions → mitigate with `Annotated` + `Field(discriminator=...)` in Pydantic.
- Polling leak on unmount → AbortController in `useAiTask`.

### KPIs
0 TS errors after `gen:api` · ≥50% LOC reduction per new capability vs F3 slice.

---

## Phase 5 — SSE streaming (mentor-virtual)

**Sprint:** S-4 · **Dependencies:** F4 · **Reference capability:** **`mentor-virtual`** (template for `narrative-build` in F6)

### Goal
Prove streaming end-to-end (Anthropic → FastAPI → Express → Nginx → front) and replace the first chat-like mock.

### Backend tasks
- **F5.1** Extend `ai-service/agents/mentor_virtual.py` with `stream(...)` async generator; route returns `StreamingResponse(media_type="text/event-stream")` when `Accept: text/event-stream`; final `event: done` with totals. [M]
- **F5.2** Express SSE pass-through in `ai.router.ts` + new `ai.sse.ts`; sets `Content-Type: text/event-stream, Cache-Control: no-cache, X-Accel-Buffering: no, Connection: keep-alive`; `pipeline()` for backpressure; emits final `AiInvocationLog` with totals from `done` event. [L]
- **F5.3** Nginx `location /api/v1/ai/`: `proxy_buffering off; proxy_cache off; proxy_read_timeout 600s; chunked_transfer_encoding on; gzip off`. [S]
- **F5.4** Replace `fetch` with `undici.Pool` (if not done in F1). [M]
- Persist `AiMentorChatSession` (session-level metadata, **not tokens**) on stream close. [M]

### Front tasks
- **F-5.1** New `capabilities/mentorVirtual.ts`: `startStream(input, signal): AsyncIterable<MentorToken>` using `fetch` + `ReadableStream` (NOT `EventSource`, because we need POST with body and JWT in header). [M]
- **F-5.2** Rewrite `MentorVirtualPanel.tsx` to consume tokens with autoscroll, "Stop" button, cancel-on-unmount, reconnect-with-backoff banner. [L]
- **F-5.3** Reconnect/backoff in `useAiStream` (1s/2s/4s × 3 retries; then `AI_UNAVAILABLE`). [M]

### Tests & observability
- TTFB load test (k6 nightly): 50 concurrent streams × 60 s; P95 TTFB <600 ms; 0 5xx; no socket resets; memory delta <50 MB.
- Cancellation: `EventSource`-style abort closes upstream socket in <500 ms (Prometheus counter `ai_streams_cancelled_total`).
- Nginx config test: real container with the deployed config; 1 token round-trip without batching.
- `ai_streams_active` gauge returns to 0 after each stream.

### Exit criteria
- TTFB <600 ms P95.
- Stream survives 30 s without Nginx cut.
- Clean close emits correct `AiInvocationLog` totals.
- UI cancel aborts upstream call (verify with kill counter).
- `MentorVirtualPanel` and `MentorSupportModal` no longer read mocks.

### Risks
- `EventSource` can't carry custom headers → use fetch+ReadableStream or httpOnly cookie.
- Accidental Nginx/CDN buffering → smoke test with `curl --no-buffer`.

### KPIs
TTFB P95 <600 ms · stream drop rate <1% · avg sessions/user.

---

## Phase 6 — Async polling, capability sweep, hardening

**Sprint:** S-5 + S-6 · **Dependencies:** F4, F5 · **Reference capability:** **`research-assist`** (async); **`narrative-build`** reuses SSE

### Goal
Close the remaining 9 capabilities (including the async pattern) and harden the bridge for production.

### Backend tasks
- **F6.1** New `backend/modules/ai/queue/ai.queue.ts` (BullMQ) + `research.worker.ts`; add `redis` service to `docker-compose.yml`. `POST /api/v1/ai/research-assist` returns 202 `{taskId, pollUrl, estimatedSec: 25}`. [L]
- **F6.2** `GET /api/v1/ai/tasks/:id` with owner check; 404/403 paths. [S]
- **F6.3** Prisma migrations: `AiIdeaSet, AiNarrative, AiLearningCard, AiResearchGuide, AiMentorChatSession`. [M]
- **F6.4** Persistors + Express routes for: `hmw-generate, ideate, experiment-routes, prototype-suggest, experiment-analyze, narrative-build (SSE), narrative-feedback, invoke`. Resolve `step.service.ts:144` TODO (ai-review fires async on SUBMIT). [L]
- **F6.5** Redis sliding-window rate limiter (`research-assist`/`mentor-virtual` 50/day/user; `ai-review` 5/day/project; burst 10/min/user); headers `X-RateLimit-*`; 429 with `AI_RATE_LIMIT`. [M]
- **F6.6** `opossum` per-capability (50% errors / 10 reqs, reset 30 s). Open → 503 `AI_UNAVAILABLE`, `details.retryAfterSec: 30`. Per-capability Prometheus gauges. [M]
- **F6.7** Prometheus metrics + `GET /metrics` + Grafana dashboard `ops/grafana/dashboards/ai-bridge.json` (cost/latency/breaker/rate-limit). [L]
- **F6.8** Idempotent Redis cache in `ai.cache.ts`: `feedback` 24 h, `research-assist` 1 h; key `hash(capability+projectId+stepNumber+moduleId+normalizedPayload+userId)`. NO cache for `mentor-virtual`. [M]

### Front tasks
- **F-6.1** Thin sync capability wrappers (hmw, ideate, experiment, narrative-feedback, invoke). [M]
- **F-6.2** `narrativeBuild.ts` (SSE) and `research.ts` (returns `{taskId, pollUrl}`; consumers use `useAiTask`). [M]
- **F-6.3** Wire `Step1ResearchModuleV2` to `useAiTask`; trigger button + progress; persist via `saveStepData`; refresh re-reads (no double-charge). [M]
- **F-6.4** Wire `Step2Page` (`hmw`+`ideate`), `Step3Page` (`experiment-routes`/`prototype-suggest`/`experiment-analyze`), `Step4Page` (`narrative-build` SSE + `narrative-feedback`). [L]
- **F-6.5** `MentorPanelPage` reads real `aiFeedback` from `mentorService.listReviews()` (populated since F3). [S]
- **F-6.6** Portfolio pages consume aggregated AI capabilities; degrade non-AI metrics keep working. [M]
- **F-6.7** Audit `AppContext.tsx`; `grep -rE "(MOCK_|mockFeedback|mockAI)"` returns 0 matches. [S]
- **F-6.8** Cypress e2e: `ai-feedback`, `ai-mentor-stream`, `ai-research-async`, `ai-degradation`. [L]

### Tests & observability
- `useAiTask` polling test with `vi.useFakeTimers()` and 1000-invocation jitter variance check.
- Cache hit test: second identical request inside TTL doesn't reach upstream (mock `not.toHaveBeenCalled()`).
- Circuit breaker: 5/10 errors → next request <100 ms with 503 (no upstream call); per-capability isolation verified.
- Rate-limit: 51st request in a day → 429 with `Retry-After`; 5/day/project preserves ADR-008.
- Chaos test (nightly): kill ai-service mid-flight; assert step/save flow keeps working.
- Cypress e2e blocks merge for the 3 critical flows; rest run nightly.

### Exit criteria
- All 11 capabilities reachable; 0 mocks in `AppContext.tsx`.
- `step.service.ts:144` TODO gone.
- `research-assist` resolves >8 s jobs without HTTP timeout.
- Cache hit ratio for `feedback` ≥30% in staging after 1 week.
- Grafana FinOps dashboard shows P95 cost/req <$0.05.
- Breaker oscillation (flap) <1/hour with hysteresis (60 s rolling window).

### Risks
- Cache key collisions cross-tenant → include `userId` in hash.
- Job queue overload from research-assist abuse → hard quota before enqueue.
- Breaker flap → hysteresis with 60 s rolling window.

### KPIs
P95 cost/req <$0.05 · AI uptime ≥99% via breaker · cache hit ≥30% · 0 unreachable capabilities.

---

## Cross-cutting: CI gates & eval suite

### CI per PR (blocks merge to `main`)
1. Lint + build (front + backend) + `ruff check` (ai-service).
2. Unit + contract tests, coverage gate ≥80% lines globally, **100% on HMAC, ownership, errorMapper**.
3. Network isolation smoke (F1) — `scripts/test-network-isolation.sh`.
4. OpenAPI drift check (`npm run gen:api && git diff --exit-code`).
5. Integration suite light: 3 critical flows (feedback sync, mentor SSE handshake, research async happy path), timeout 5 min.
6. `npm audit --audit-level=high` + `npx @claude-flow/cli@latest security scan`.
7. PII linter: 100 simulated requests → no DNI/email/payload in stdout.

### CI nightly (release-blocking)
- k6 load: F5 SSE 50 concurrent, F6 mixed 30 rps × 5 min.
- Cypress e2e: 11 capabilities.
- Chaos: kill ai-service mid-flight → step/save keeps working.

### Eval suite IA (quality non-regression)
- LangSmith datasets per capability (`feedback-v1`, `mentor-v1`, `research-v1`) with 20-30 gold cases.
- LLM-as-judge for `feedback` (rubric: clarity, actionability, phase alignment).
- Trajectory eval for `research-assist` (asserts on tool calls).
- Heuristic for `hmw-generate` (≥5 HMWs, "How might we…" verbal form).
- Gate: avg score must not drop >5% vs baseline. Skill helpers already loaded: `langsmith-evaluator`, `langsmith-dataset`.

### Globally non-negotiable before closing any phase
- `requestId` round-trip front ↔ Express ↔ ai-service ↔ logs.
- `costUsd > 0` in `AiInvocationLog` for 100% of real invocations.
- 0 logs containing prompts/responses/PII (automated test).
- 0 eval regressions vs baseline.
- Network isolation: port 8001 unreachable from host.

---

## Sequencing summary

```
Phase 0 ──┬─► Phase 1 ──► Phase 2 ──► Phase 3 (slice)
          │                              │
          │                              ├─► Phase 4 (industrialise)
          │                              │      │
          │                              │      ├─► Phase 5 (SSE)
          │                              │      │      │
          │                              │      │      └─► Phase 6 (sweep + harden)
```

**Parallelisation hints:** Once F3 lands, F4 can run in parallel with the start of F5 (different surfaces). F6.1 (queue) and F6.7 (metrics) can split between two devs.

**Reorder if needed:** if mentor SSE is higher business priority than mass capability rollout, swap the order of F5 and the bulk of F6 (keep F6.1-F6.2 paired with F6 phasing).

## Issue index

GitHub issues in [nmindFa/Starteria](https://github.com/nmindFa/Starteria/issues):

- Phase 0 — Tooling bootstrap → [#1](https://github.com/nmindFa/Starteria/issues/1)
- Phase 1 — Network lock-down + observability → [#2](https://github.com/nmindFa/Starteria/issues/2)
- Phase 2 — HMAC defense-in-depth → [#3](https://github.com/nmindFa/Starteria/issues/3)
- Phase 3 — Tracer-bullet feedback (sync) → [#4](https://github.com/nmindFa/Starteria/issues/4)
- Phase 4 — Front foundation (hooks, types, envelope) → [#5](https://github.com/nmindFa/Starteria/issues/5)
- Phase 5 — SSE streaming (mentor-virtual) → [#6](https://github.com/nmindFa/Starteria/issues/6)
- Phase 6 — Async polling + capability sweep + hardening → [#7](https://github.com/nmindFa/Starteria/issues/7)
