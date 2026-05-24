# ADR-012: PDF Storage for Initiative Auto-Fill

## Status
Proposed — 2026-05-17

## Date
2026-05-17

## Context
PRD-002 introduces an Auto-Fill agent that lets founders drop PDFs (business plans, market research, interview transcripts, internal reports, surveys) onto an initiative and have Steps 0-4 proposed by an AI extractor. This creates a new storage workload that did not exist when ADR-007 was written: documents that are (a) high in PII density, (b) the source-of-truth for provenance shown to mentors, (c) cost-bounded per cohort, and (d) subject to a founder-controlled right to delete.

The decision question is: **where and how does Starteria store PDF originals, derived text/page maps, and extraction artifacts, and how does it enforce retention, encryption, access, and deletion — without forking from ADR-007 and without blocking the Express server with large file proxying?**

Precedent and constraints:

- **ADR-007 (File Storage for Evidence)** is `Accepted` but, per the Phase 0 researcher audit, has not yet been implemented in the codebase. It mandates S3-compatible object storage (AWS S3 in prod, MinIO in dev) with presigned URLs, two-step upload (`presign` → direct PUT → `confirm`), and metadata in PostgreSQL. ADR-012 **must extend ADR-007, not replace it**: same storage substrate, same upload pattern, same metadata-in-Postgres principle.
- **PRD-002 NFR Security** mandates encryption at rest and in transit, PII detection and masking *before content leaves for the model*, default retention of 90 days for the original PDF, configurable by the founder up to 12 months, and audit-trail retention of 12 months *without* the PDF content.
- **PRD-002 Constraints** cap initiatives at 10 PDFs, 50 MB each, 200 pages each. Cost ceiling is $150 USD/cohort/month — but that ceiling is allocated to *IA* (model + parsing), not storage. Storage must therefore be incrementally cheap (< $5/cohort/month).
- **ADR-002 (Database)** sets Prisma + PostgreSQL as the only persistence layer for relational/metadata. Binary content does not belong there.
- **ADR-003 (JWT) / ADR-004 (Authorization, role-based)** define the auth substrate. Access to PDFs reuses those middlewares; no new auth flow is introduced.
- **ADR-008 (AI Integration)** establishes async-polling for AI work. The PDF extractor follows the same pattern: enqueue, poll, deliver.
- **ADR-011 (Frontend ↔ AI Service Bridge)** defines HMAC signing and request IDs for backend ↔ Python AI microservice traffic. The PDF extractor worker calls AgentDB/LLM via that bridge.

ADR-007 deliberately did not address: a separate retention class for PII-heavy documents, presigned URL TTLs by document type, PII-detection placement, right-to-delete cascade across derived artifacts, or per-document KMS encryption. ADR-012 fills those gaps for the PDF subset.

## Decision
PDFs and their derived artifacts are stored on the **same S3-compatible substrate** declared by ADR-007 (AWS S3 in prod, MinIO in dev) but under a **dedicated prefix with stricter encryption, shorter presigned URL TTLs, and an explicit lifecycle policy**. Originals and derived text are governed by the same logical retention clock, owned by the founder.

### Architecture
- **Same bucket as ADR-007 evidence**, partitioned by prefix (see Bucket layout). Operating one bucket keeps IAM, CORS, and lifecycle policies single-sourced; the prefix is the security and lifecycle boundary.
- **Production**: AWS S3 with SSE-KMS using a dedicated customer-managed KMS key alias `alias/starteria-pdf` (separate from the evidence default-key). Key rotation: annual, automatic.
- **Development**: MinIO with server-side encryption enabled (SSE-S3 equivalent). The KMS key is mocked; secrets come from `.env` and never touch the repo.
- **Upload path**: identical to ADR-007 — `POST /api/v1/pdfs/presign` → direct PUT to S3 → `POST /api/v1/pdfs/confirm` writes the `InitiativePdf` row. **No file content ever transits the Express process.**
- **Extraction path**: async-polling per ADR-008. The `pdf_extractor` worker reads the object via a **backend-issued presigned GET URL** (not a direct IAM role on the worker), so the access boundary stays on the Express side and ADR-011's HMAC + request-ID envelope governs the Python ↔ Node hop.

### Bucket and prefix layout
Single bucket, three top-level prefixes:

```
{bucket}/
  evidence/{projectId}/{stepId}/{uuid}-{filename}        ← ADR-007 (unchanged)
  initiative-pdfs/originals/{projectId}/{pdfId}.pdf      ← ADR-012, this doc
  initiative-pdfs/derived/{projectId}/{pdfId}/
    text.jsonl                                            ← per-page text + bbox
    pages.json                                            ← page map (numbers, language)
    embeddings.bin                                        ← optional, deferred
    pii-mask.json                                         ← spans masked before LLM
```

The `originals/` and `derived/` sub-prefixes share retention but have **distinct lifecycle rules** — see Retention. Object keys never contain founder PII (no names, no emails) — `pdfId` is a UUIDv7.

### Encryption
- **At rest**: SSE-KMS with the dedicated `alias/starteria-pdf` CMK for everything under `initiative-pdfs/`. Evidence under `evidence/` continues to use the default SSE-S3 from ADR-007 — PDFs are a stricter class.
- **At rest, dev**: MinIO SSE-S3 with a local master key in `.env.local`, never committed.
- **In transit**: TLS 1.2+ enforced on the bucket policy; presigned URLs are generated with `https://` only.
- **Client-side encryption is explicitly not adopted** for v1: the operational cost of key management on the browser outweighs the marginal threat model (the attacker that defeats SSE-KMS likely also defeats CSE). Revisit if/when Starteria onboards regulated cohorts.

### Retention and lifecycle
Two clocks, one source of truth (`InitiativePdf.retentionUntil`):

| Artifact | Default | Min | Max | Founder-controllable |
|---|---|---|---|---|
| Original PDF (`originals/`) | 90 days | 7 days | 365 days | Yes — via initiative settings |
| Derived text + page map (`derived/`) | Same as original | — | — | Tracks original |
| Embeddings (`derived/embeddings.bin`) | 30 days | — | 90 days | No (regeneratable) |
| Audit trail row (`AuditLog`) | 365 days | 365 | 365 | No |
| `PdfFieldProposal` rows (proposed values + provenance, **no PDF content**) | 365 days | — | — | No |

S3 lifecycle rules applied to `initiative-pdfs/`:

1. Day 0-30: `STANDARD` storage class (hot path; extraction may be re-run).
2. Day 31-retentionUntil: transition to `STANDARD_IA` (infrequent access) — extraction reruns become rare after the founder has confirmed the Step.
3. Day `retentionUntil` + 1: scheduled `DELETE`. A nightly reconciliation job (`pdf-retention-sweeper`) verifies the S3 lifecycle deletion happened and updates `InitiativePdf.deletedAt`. If S3 lifecycle has not yet acted, the job issues an explicit `DeleteObject`.
4. Cold archival to Glacier is **not** used for PDFs — the latency on restore (hours) breaks the "founder requests their PDF back" UX. IA is the floor.

Audit-trail rows persist 12 months **without** the binary content — only `pdfId`, page numbers, extracted-field deltas, costs, actor IDs.

### Access control
- All `/api/v1/pdfs/*` routes sit behind the existing JWT middleware (ADR-003).
- Authorization (ADR-004) extends the per-initiative role check to **three principals** for PDFs:
  - **Founder-owner** of the initiative — full read/write/delete.
  - **Assigned mentor** — read of derived text and proposed-field provenance only; *no* download of the original binary.
  - **Portfolio lead** of the cohort — same as mentor; aggregate cost dashboards.
- Sponsor and admin roles do **not** get PDF access by default (they review autoritative field values, not source documents). Override requires an explicit `RoleGrant` row + audit entry.
- The S3 bucket itself denies all public access; the only path to an object is a backend-issued presigned URL.

### Presigned URLs
Stricter than ADR-007 evidence defaults — PDFs are higher PII risk:

| Operation | TTL | Notes |
|---|---|---|
| Upload (PUT) | 10 min | shorter than ADR-007's 15 min |
| Download original (founder) | 5 min | ADR-007 evidence is 60 min |
| Download derived text (founder/mentor/lead) | 5 min | same envelope |
| Worker GET (Python `pdf_extractor`) | 2 min | one-shot, scoped to single `pdfId` |

Each presigned URL includes the request ID from ADR-011 in the `x-amz-meta-request-id` header so failures can be correlated end-to-end.

### PII detection placement
**Two stages, both server-side, before any model call.** No client-side detection (the browser is untrusted for this).

1. **Stage A — Pre-upload sanity (lightweight, post-confirm, pre-parse)**: when the `confirm` endpoint records the PDF, a synchronous regex/dictionary pass on the filename and on the first page's extracted text flags obvious giveaways (national-ID patterns, emails). Purpose: refuse documents whose *cover page* alone is a PII firehose — informs the founder and stops the worker from being scheduled.
2. **Stage B — Pre-LLM mask (authoritative)**: inside `pdf_extractor` after page-text extraction and *before* any chunk is included in the prompt to the LLM. Uses a dedicated PII service (Presidio-compatible, runs in the Python AI microservice — see ADR-011). Masked spans are persisted as `derived/{pdfId}/pii-mask.json` so audit can answer "what did the model never see?" The model receives the masked text only; the original PDF and unmasked text never cross the ADR-011 bridge.

Pages marked by the founder as "do not process" (PRD-002 US-015) are dropped at this stage — the worker never reads them.

### Right-to-delete cascade
A founder-initiated delete (or retention expiry, or initiative deletion) is the same transactional cascade:

1. Mark `InitiativePdf.deletedAt = now()` and emit `AuditLog` event `pdf.delete.requested`.
2. Issue `DeleteObject` on `initiative-pdfs/originals/{projectId}/{pdfId}.pdf`.
3. Issue `DeleteObjects` on every key under `initiative-pdfs/derived/{projectId}/{pdfId}/`.
4. Soft-delete `PdfExtractionRun` rows by setting `pdfContentPurged = true` (the rows survive for audit, but their `extractedTextRef` is nulled).
5. **`PdfFieldProposal` rows persist** — they carry the value, the confidence, and the *page reference*, but no PDF text. Mentors retain visibility of confirmed fields; the provenance string degrades to "PDF deleted on {date}".
6. `AuditLog` is **never** cascaded — it is the immutable record (PRD-002 US-014, hash-chained).

This means: deleting a PDF erases content but not the fact that it existed and what was confirmed from it. That is intentional and disclosed to the founder at upload time.

### Data model (logical fields, schema lives in SPEC)
Three new Prisma models, all FK'd to existing `Project` (per ADR-002):

**`InitiativePdf`** — one row per uploaded PDF.

| Field | Intent |
|---|---|
| `id` | UUIDv7, also the S3 object key stem |
| `projectId` | FK → `Project.id` |
| `uploadedBy` | FK → `User.id` (founder) |
| `fileName` | original filename, displayed in UI |
| `fileSizeBytes` | enforced ≤ 50 MB |
| `pageCount` | enforced ≤ 200 |
| `languageDetected` | `es` / `en` / `unsupported` |
| `s3KeyOriginal` | full key under `initiative-pdfs/originals/` |
| `s3KeyDerivedPrefix` | full prefix under `initiative-pdfs/derived/` |
| `kmsKeyAlias` | for audit/forensics |
| `retentionUntil` | timestamp — drives the lifecycle clock |
| `uploadedAt` | timestamp |
| `deletedAt` | null until purge; set when cascade starts |
| `piiPreScanFlags` | JSON — Stage A findings |

**`PdfExtractionRun`** — one row per (pdfId, requestedStep) tuple.

| Field | Intent |
|---|---|
| `id` | UUIDv7 |
| `pdfId` | FK → `InitiativePdf.id` |
| `requestedStep` | `step_0` … `step_4` |
| `status` | `pending` / `running` / `succeeded` / `failed` / `cancelled` |
| `requestId` | ADR-011 correlation ID |
| `modelVersion` | for reproducibility |
| `costUsd` | aggregated for PRD-002 NFR Cost ceiling |
| `startedAt` / `finishedAt` | timestamps |
| `extractedTextRef` | S3 key to `text.jsonl` — nulled on purge |
| `pdfContentPurged` | boolean |

**`PdfFieldProposal`** — one row per (extractionRunId, fieldPath).

| Field | Intent |
|---|---|
| `id` | UUIDv7 |
| `extractionRunId` | FK → `PdfExtractionRun.id` |
| `stepId` | FK → existing `Step.id` from ADR-002 |
| `fieldPath` | dotted path, e.g. `step1.moduleB.profiles` |
| `proposedValue` | JSON |
| `confidenceScore` | 0.00-1.00 |
| `provenancePage` | int |
| `provenanceExcerpt` | ≤ 280 chars (PRD-002 US-008) |
| `status` | `proposed` / `confirmed` / `edited` / `discarded` |
| `resolvedAt` / `resolvedBy` | who acted, when |

All three models emit rows to the existing `AuditLog` (ADR-002) on every state change — same audit substrate, no parallel log.

### Extraction worker access pattern
The `pdf_extractor` (Python, in the AI microservice per ADR-011) never holds long-lived S3 credentials. The flow on each run:

1. Express enqueues an extraction job and writes `PdfExtractionRun` (status `pending`).
2. Express generates a **2-minute presigned GET URL** for the original and short-lived presigned PUT URLs for the derived keys.
3. Express POSTs the job to the AI microservice with the HMAC envelope from ADR-011 — body contains the presigned URLs, not credentials.
4. Worker GETs the original, extracts text, writes derived artifacts via the presigned PUTs, runs PII masking (Stage B), calls the LLM with masked text only, returns proposals.
5. Express writes `PdfFieldProposal` rows and flips `PdfExtractionRun.status = succeeded`.

The worker has **no IAM identity in S3**. If the worker is compromised, the blast radius is one PDF for two minutes.

## Consequences

### Positive
- Reuses ADR-007's substrate, IAM, CORS, and MinIO dev story — no new infrastructure surface area.
- PDFs sit under a separate prefix with a separate KMS key, so a leaked evidence URL can never expose a PDF, and KMS audit logs cleanly separate the two classes.
- Two-stage PII detection (server-only) makes "no PII to the model" a verifiable property (`pii-mask.json` is the receipt).
- Right-to-delete is mechanical: one founder click, one cascade, audit row remains. Disclosable to legal/compliance without code spelunking.
- Presigned-URL-only worker access caps blast radius without needing IAM tinkering in the Python service.
- Storage cost is negligible vs. the LLM cost: 10 PDFs × 50 MB × 100 initiatives ≈ 50 GB; at S3 STANDARD-IA (~$0.0125/GB-month) ≈ $0.63/cohort/month. Well within the < $5 budget; the $150 PRD-002 ceiling stays effectively reserved for AI.

### Negative
- Adds operational complexity: lifecycle rules, KMS key, retention-sweeper job, three new Prisma models, two new endpoint families.
- KMS adds per-decrypt cost (~$0.03 per 10,000 requests) — negligible at MVP scale but visible at growth.
- Two presigned URLs per extraction (GET + multiple PUTs) means more URLs to log, audit, and rotate.
- Mentor cannot download the source PDF, only the derived text. Some mentors will ask why. Disclosed in UI copy per ADR-005 (UX).

### Trade-offs
- **Same bucket vs. separate bucket** — chose same. Lifecycle rules and IAM are easier with one bucket and prefix-scoped policies; the cost is that a misconfigured `evidence/` policy could spill into `initiative-pdfs/`. Mitigated by automated bucket-policy tests in CI.
- **SSE-KMS vs. SSE-S3** — chose SSE-KMS for PDFs only. Marginal cost, real per-request audit logging via CloudTrail. Worth it for the document class with the highest PII density.
- **Glacier vs. STANDARD-IA** — chose IA. Founder UX of "give me my PDF back" outweighs the ~$0.001/GB-month savings on Glacier at MVP scale.

## Alternatives Considered

### Store PDFs as PostgreSQL `bytea` blobs (extend ADR-002 instead of ADR-007)
- **Pros**: One backup story, transactional cascade between metadata and bytes, no S3 IAM at all.
- **Cons**: 50 MB blobs blow up backup time, connection pool exhaustion on upload, PostgreSQL is not a content store, presigned-URL economics disappear (every download proxies through Express, defeating ADR-007's whole point). Rejected.

### Reuse the `Evidence` table from ADR-007 with a `type = 'initiative-pdf'` discriminator
- **Pros**: No new tables, no new endpoints, one upload path.
- **Cons**: `Evidence` is scoped per `stepId` — PDFs are per-initiative and feed multiple Steps. Lifecycle rules diverge (evidence may live the lifetime of the initiative; PDFs are 90 days by default). Retention controls on `Evidence` would have to grow conditionals on `type`. PII handling diverges. Conflating the two would force every evidence query to remember which rows are PDFs. Rejected — clean separation is cheaper than the conditional logic.

### Separate bucket per cohort (`starteria-pdfs-{cohortId}`)
- **Pros**: Hard isolation between cohorts; deleting a cohort = deleting a bucket; per-cohort cost visibility falls out for free.
- **Cons**: Bucket creation/deletion is a privileged ops action that does not belong in the application runtime; AWS soft-limits buckets per account (~100 default); MinIO dev parity is awkward; the same isolation is achievable with prefix-scoped IAM. Rejected for MVP, revisit at scale.

### Client-side encryption (founder holds key in browser)
- **Pros**: Strongest confidentiality story; not even Starteria infra can read the PDF.
- **Cons**: Key recovery on lost-laptop UX is hostile; the model cannot read encrypted content, so the entire extraction feature breaks unless the browser also decrypts and forwards plaintext — at which point CSE is theatre. Rejected.

## Implementation Notes

### Sequencing — hard prerequisite
**ADR-007 must be implemented before ADR-012 can be enacted.** The Phase 0 researcher audit confirmed ADR-007 is `Accepted` but unimplemented (no S3 client wired, no MinIO container in docker-compose, no `/evidence/presign` route). ADR-012 takes the ADR-007 substrate as given. Sequencing:

```
1. Implement ADR-007 (evidence/ presign, confirm, MinIO docker-compose, IAM policy, CORS).
2. Add KMS key alias/starteria-pdf and prefix-scoped bucket policy for initiative-pdfs/.
3. Add Prisma migration for InitiativePdf, PdfExtractionRun, PdfFieldProposal.
4. Implement /api/v1/pdfs/{presign,confirm,extract,delete} endpoints.
5. Implement pdf_extractor worker in the AI microservice (ADR-011 envelope).
6. Implement pdf-retention-sweeper nightly job.
7. Wire frontend dropzone (Step 0-4 pages, see ADR-005 UX).
```

Steps 2-7 cannot start without step 1. SPEC-002 (to be written) will own the field-level Prisma schema and the OpenAPI for the four endpoints, citing this ADR.

### Configuration surface
New environment variables (never committed): `S3_PDF_KMS_KEY_ALIAS`, `PDF_RETENTION_DEFAULT_DAYS=90`, `PDF_RETENTION_MAX_DAYS=365`, `PDF_PRESIGN_UPLOAD_TTL_S=600`, `PDF_PRESIGN_DOWNLOAD_TTL_S=300`, `PDF_WORKER_PRESIGN_TTL_S=120`, `PDF_MAX_PER_INITIATIVE=10`, `PDF_MAX_BYTES=52428800`, `PDF_MAX_PAGES=200`.

### Testing
- CI integration test: upload → confirm → extract → confirm field → delete → verify all derived keys gone, audit rows present, `PdfFieldProposal.provenanceExcerpt` survives.
- CI policy test: assert `initiative-pdfs/` rejects unauthenticated GET, asserts SSE-KMS header on every PUT, asserts no public ACL anywhere.

## Compliance
- **Right to delete (GDPR-style)**: founders can purge originals before the 90-day default. Cascade is documented above. Audit-trail metadata persists 12 months; founders are told this at upload time via the consent string.
- **PII handling**: PRD-002 US-015 requires masking before model exposure. Stage B (server-side, pre-LLM, in the AI microservice) is the authoritative point and produces `pii-mask.json` as the receipt. Recall target ≥ 0.95 (PRD-002 acceptance band) lives in the PII service's eval suite, not in this ADR.
- **Retention disclosure**: the upload UI shows "this PDF will be deleted on {retentionUntil} unless you extend retention or delete it sooner" — non-negotiable per ADR-005 (UX) and required for consent.
- **Mentor / portfolio-lead access**: derived text only, never the original binary. Documented in the consent string and surfaced in the role matrix.
- **Cohort-level data export**: not in scope for ADR-012; will be addressed when a separate "founder data export" feature is prioritised.

## References
- `backend/docs/adr/ADR-007-file-storage.md` — substrate this ADR extends (Accepted, unimplemented; sequencing prerequisite).
- `backend/docs/adr/ADR-002-database.md` — Prisma + PostgreSQL for the three new models.
- `backend/docs/adr/ADR-003-authentication.md` — JWT middleware reused on all `/api/v1/pdfs/*` routes.
- `backend/docs/adr/ADR-004-authorization.md` — role-based check extended to founder-owner / mentor / portfolio-lead for PDFs.
- `backend/docs/adr/ADR-005-api-design.md` — REST + OpenAPI conventions for the new endpoint family.
- `backend/docs/adr/ADR-008-ai-integration.md` — async-polling pattern the extraction worker follows.
- `backend/docs/adr/ADR-010-auth-error-envelope.md` — typed error envelope returned by `/api/v1/pdfs/*`.
- `backend/docs/adr/ADR-011-frontend-aiservice-bridge.md` — HMAC + request-ID envelope used to hand presigned URLs to the Python `pdf_extractor`.
- `project/.sdlc/specs/PRD-002-pdf-autofill-agent.md` — driver, especially US-001 (upload), US-013 (cost ceiling), US-014 (audit trail), US-015 (PII).
- Forthcoming `ADR-PDF-EXTRACTION-MODEL` (IA-methodology, model selection) — chooses the LLM and structured-output schema used downstream of this storage layer.
- Forthcoming `ADR-AUTOFILL-PROVENANCE-UX` — UX rules for how provenance from this storage is displayed (Step-page chrome, the 280-char excerpt, the confidence badge).
