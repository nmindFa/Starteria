---
id: SPEC-002
title: "Integración PDF auto-fill end-to-end"
status: draft
date: 2026-05-19
author: BHIL Architecture (Swarm)
sprint: S-02
parent: PRD-002
children:
  - TASK-006
  - TASK-007
  - TASK-008
  - TASK-009
adrs: [ADR-004, ADR-005, ADR-012-backend, ADR-007-backend, ADR-008-backend, ADR-011-backend]
---

# SPEC-002: Integración PDF auto-fill end-to-end -- Especificación técnica

## Specification summary

Esta especificación define el contrato técnico que conecta los cuatro componentes implementados por TASK-006 (persistencia + endpoints), TASK-007 (worker `pdf_extractor` en `ai-service`), TASK-008 (UI de provenance + gate de aprobación) y TASK-009 (observabilidad + cost guardrails) para hacer realidad PRD-002. El feature opera como una capa pre-submission sobre los Steps 0-4: el founder sube PDFs por presigned URL (substrato de ADR-007 extendido por ADR-012), una extracción async-polling (ADR-008) ejecuta el worker en `ai-service` con Claude Haiku 4.5 + function calling (ADR-004) detrás del bridge HMAC de ADR-011, y la UI muestra propuestas con provenance + tres acciones explícitas (ADR-005). El feature no transiciona la iniciativa a `esperando_revision` sin confirmación campo a campo (US-017). El spike `ai-service/spikes/pdf_extractor/` validó el approach contra el gold set inicial (precisión 0.800, recall 0.772, alucinaciones 0.000, provenance 0.964) pero N=1 — la promoción a producción exige el gold set N≥50 de ADR-004 §5.

---

## End-to-end flow

Flujo happy-path para una sola sesión de upload (founder, una iniciativa en estado `en_step_*`, un PDF de 50pp, los 5 Steps relevantes). Cada paso identifica el sistema cruzado (Front, Express, S3, ai-service, Postgres).

1. **Front → Express:** El founder arrastra el PDF al dropzone en cualquier `StepNPage`. Front llama `POST /api/v1/pdfs/presign` con metadata mínima (filename, mimeType, sizeBytes). Express valida JWT (ADR-003), valida ownership de la iniciativa, valida límites duros (≤ 50 MB, ≤ 200 páginas estimadas por sizeBytes, ≤ 10 PDFs por iniciativa) y devuelve presigned PUT URL (TTL 10 min, SSE-KMS `alias/starteria-pdf`) más un `pdfId` UUIDv7.
2. **Front → S3:** Front ejecuta `PUT` directo al presigned URL. El binario nunca cruza el proceso Express.
3. **Front → Express:** Tras éxito del PUT, Front llama `POST /api/v1/pdfs/confirm` con `pdfId` y sizeBytes/pageCount finales. Express valida que el objeto existe en S3, ejecuta **Stage A PII scan** (regex/diccionario sobre filename + primera página extraída sincrónicamente, ADR-012), crea fila `InitiativePdf` con `retentionUntil = now() + 90 días` y emite `AuditLog` `pdf.uploaded`.
4. **Front → Express → ai-service (encolado):** Front llama `POST /api/v1/pdfs/:pdfId/extract` indicando los Steps objetivo (`[0,1,2,3,4]` por default). Express crea filas `PdfExtractionRun` (una por Step solicitado, status `pending`), genera presigned GET URL del original (TTL 2 min) más presigned PUTs de derivados, y encola un job HTTP a `POST {ai-service}/pdf-extract` firmado con HMAC + `X-Request-Id` (ADR-011). Express responde HTTP 202 con `taskId` y `pollUrl` (`/api/v1/pdfs/extract-tasks/:taskId`).
5. **ai-service (worker):** El worker `pdf_extractor` GET el PDF, ejecuta `pypdf+pdfplumber` para extraer texto por página con bounding box, detecta idioma, ejecuta **Stage B PII masking** (Presidio) — el binario y el texto no enmascarado nunca cruzan al modelo —, chunka a 6000 tokens con overlap 400, invoca Haiku 4.5 con function calling por Step (paralelismo 5, timeout 15s/chunk), construye `StepProposal` por Step y los devuelve al callback de Express. Stream de progreso opcional vía Server-Sent Events sobre `pollUrl`.
6. **ai-service → Express → Postgres:** Express recibe los `StepProposal`, valida schema con Pydantic/Zod compartido, persiste filas `PdfFieldProposal` (status `proposed`, una por campo) y actualiza `PdfExtractionRun.status='succeeded'` con `costUsd` agregado. Si algún campo tiene `confidence < 0.60` se persiste con `status='omitted'` y `omissionReason` (US-012); nunca se inventa valor.
7. **Front → Express (polling):** Front hace polling cada 1s/2s/4s/8s con jitter ±20% (ADR-011 §3). Al recibir `status='succeeded'`, llama `GET /api/v1/projects/:id/autofill-proposals` y mergea los `PdfFieldProposal` en el slice `autofillProposals` de Redux/Zustand. Los campos del Step entran en estado `ai-proposed-unconfirmed` (ADR-005).
8. **Front (review):** Cada campo renderiza inline su provenance (PDF + página + extracto ≤ 280 chars + chip de confianza Alta/Media) y las tres acciones obligatorias: Confirmar, Editar, Descartar. El gate de US-017 cuenta los `unconfirmed` en banner persistente.
9. **Front → Express:** Por cada acción, Front llama `PATCH /api/v1/pdfs/proposals/:proposalId` con `action ∈ {confirm, edit, discard}` y `editedValue` si aplica. Express actualiza `PdfFieldProposal.status` y emite `AuditLog`. Si la acción es `confirm` o `edit`, además persiste el valor en la tabla del Step correspondiente (TASK-010 — ver §6 persistencia prereq) marcando origen `autofill_confirmed` o `autofill_edited`.
10. **Submit gate:** Cuando el founder pulsa "Enviar a revisión" en Step 4, Express ejecuta `verifyNoUnconfirmedProposals(projectId)`. Si > 0, responde 409 con `code='AUTOFILL_UNCONFIRMED'` y la lista de `proposalId` pendientes. Solo cuando = 0 permite la transición `en_step_4 → esperando_revision`.

Boundaries cruzadas en el flujo: Front↔Express (JWT, envelope V1), Front↔S3 (presigned URL), Express↔ai-service (HMAC + request-id, red Docker interna), ai-service↔Anthropic/Google (zero-data-retention, fallback chain), Express↔Postgres (Prisma).

---

## Component allocation

| Componente | TASK owner | ADR primario | Notas |
|---|---|---|---|
| Endpoints `/api/v1/pdfs/*` (presign, confirm, extract, delete, proposals) | TASK-006 | ADR-012-backend | Reutilizan substrato ADR-007 |
| Prisma models `InitiativePdf`, `PdfExtractionRun`, `PdfFieldProposal` | TASK-006 | ADR-012-backend §Data model | Schema field-by-field es responsabilidad de la TASK |
| HMAC bridge + envelope a `ai-service` | TASK-006 | ADR-011 | Reusa middleware si TASK-006 SPEC-001 (ai bridge) ya aterrizó |
| Worker `pdf_extractor` en `ai-service` (parser + chunker + extractor Haiku 4.5) | TASK-007 | ADR-004 | Promueve el spike `ai-service/spikes/pdf_extractor/` a `ai-service/agents/pdf_extractor/` |
| Stage B PII masking (Presidio en Python) | TASK-007 | ADR-012-backend §PII | Recall ≥ 0.95 obligatorio antes de release |
| Fallback chain Haiku → Gemini 1.5 Flash → "sin propuesta" | TASK-007 | ADR-004 §6 | Loggear cada transición |
| Frontend dropzone + estado `autofillProposals` + 4 estados de campo | TASK-008 | ADR-005 | Renderiza inline provenance (NO modal) |
| Banner del gate US-017 + lista de pendientes + bloqueo del submit | TASK-008 | ADR-005 §Patrón de aprobación gate | |
| Conflicto multi-fuente UI (US-011) | TASK-008 | ADR-005 §Patrón de conflicto | Variante del estado `ai-proposed-unconfirmed` |
| Métricas Prometheus + dashboards de costo + alertas 80% techo cohorte | TASK-009 | ADR-004 §Configuration | Cost tracker autoritativo en `ai-service` |
| Feature flag `feature.pdfAutofill` + canary 20-founder beta | TASK-009 | n/a (rollout) | Servido desde Express via `/api/v1/config/features` |
| Persistencia de Steps 2/3/4 (prereq) | TASK-010 (nueva) | n/a | Ver §6 |

---

## Public contracts

Cada subsección define el contrato. El field-by-field (request/response schema completo, columnas de tabla, tipos exhaustivos) vive en la TASK que lo implementa. Si una TASK necesita extender un contrato, primero actualiza este SPEC.

### Backend HTTP endpoints (`/api/v1/pdfs/*`)

Todos requieren JWT (ADR-003) y ownership check de `projectId` (ADR-004 backend). Todos devuelven el envelope V1 de ADR-010 en errores. Owner: TASK-006.

| Endpoint | Verb | Status códigos | Propósito |
|---|---|---|---|
| `/api/v1/pdfs/presign` | POST | 200, 400, 403, 413, 429 | Devuelve presigned PUT URL + `pdfId`. Body: `{projectId, fileName, mimeType, sizeBytes}`. |
| `/api/v1/pdfs/confirm` | POST | 200, 400, 404, 409 | Confirma upload, ejecuta Stage A PII, crea `InitiativePdf`. Body: `{pdfId, sizeBytes, pageCount?}`. |
| `/api/v1/pdfs/:pdfId/extract` | POST | 202, 400, 404, 409, 429, 402 | Encola extracción. Body: `{steps: number[]}`. 202 devuelve `{taskId, pollUrl, estimatedSec}`. |
| `/api/v1/pdfs/extract-tasks/:taskId` | GET | 200, 404 | Devuelve `{status, progress?, errorCode?}`. Status ∈ `queued`, `running`, `succeeded`, `failed`, `partial`. |
| `/api/v1/projects/:projectId/autofill-proposals` | GET | 200, 403, 404 | Lista `PdfFieldProposal[]` filtrados por `status` y `stepNumber`. |
| `/api/v1/pdfs/proposals/:proposalId` | PATCH | 200, 400, 403, 404, 409 | Acción del founder. Body: `{action: 'confirm'\|'edit'\|'discard', editedValue?}`. |
| `/api/v1/pdfs/:pdfId` | DELETE | 204, 403, 404 | Right-to-delete cascade (ADR-012 §Cascade). |
| `/api/v1/pdfs/:pdfId/download` | GET | 302, 403, 404 | Redirect a presigned GET URL (TTL 5 min). Solo founder-owner. |

Códigos de error específicos (extienden ADR-010): `AUTOFILL_UNCONFIRMED`, `AUTOFILL_CONFLICT`, `AUTOFILL_TECHO_UPLOAD`, `AUTOFILL_TECHO_INITIATIVE`, `AUTOFILL_PII_BLOCKED`, `AUTOFILL_LANGUAGE_UNSUPPORTED`, `AUTOFILL_IMAGE_ONLY_PDF`, `AUTOFILL_EXTRACTOR_UNAVAILABLE`.

### ai-service HTTP endpoints (llamados por Express)

Owner: TASK-007. Bridge HMAC + `X-Request-Id` por ADR-011. Red Docker interna; nunca expuesta al host.

| Endpoint | Verb | Propósito |
|---|---|---|
| `POST /pdf-extract` | POST | Recibe `{requestId, userId, pdfId, presignedGetUrl, presignedPutUrls, steps, language?}` y dispara el worker. Devuelve 202 con `taskId` propio del worker o 200 sync si el cliente prefiere. |
| `GET /pdf-extract/:taskId` | GET | Devuelve estado del worker para que Express agregue al `extract-tasks` público. |

El worker NUNCA recibe credenciales S3 directas (ADR-012 §Extraction worker access pattern); siempre presigned URLs de 2 minutos.

### Database tables (Postgres vía Prisma)

Owner: TASK-006. Schema columnar exhaustivo en TASK-006 SPEC. Nombres y rol son contrato:

| Tabla | Rol | FKs |
|---|---|---|
| `InitiativePdf` | Una fila por PDF subido (metadata + S3 keys + retención + KMS alias + Stage A flags). | `Project.id`, `User.id` (uploadedBy). |
| `PdfExtractionRun` | Una fila por `(pdfId, requestedStep)`. Estado de la corrida + `requestId` + `costUsd` + `extractedTextRef`. | `InitiativePdf.id`. |
| `PdfFieldProposal` | Una fila por `(extractionRunId, fieldPath)`. `proposedValue` JSON + `confidenceScore` + `provenancePage` + `provenanceExcerpt` ≤ 280 chars + `status` + `resolvedAt/By`. | `PdfExtractionRun.id`, `Step.id`. |
| `AuditLog` (existente, NO crear) | Registra eventos `pdf.*` y `proposal.*` (US-014). | n/a |

Índices mínimos (definitivos en TASK-006): `InitiativePdf(projectId, deletedAt)`, `PdfExtractionRun(pdfId, status)`, `PdfFieldProposal(extractionRunId, status)`, `PdfFieldProposal(stepId, fieldPath)`.

### Frontend state shape

Owner: TASK-008. Se introduce un slice nuevo `autofillProposals` en el store global (Zustand/Context, alineado con el patrón existente de `AppContext.tsx`). NO se almacena dentro del form state de cada Step — los `StepNPage` leen del slice por `(stepId, fieldPath)` y renderizan según el estado de campo (ADR-005 §Estados del campo).

Slice mínimo (forma lógica, tipos exactos en TASK-008):

- `byProject: Record<projectId, { proposals: PdfFieldProposal[]; runs: PdfExtractionRun[]; pdfs: InitiativePdfSummary[] }>`
- `unconfirmedCount(projectId): number` — selector que alimenta el banner del gate.
- `getProposal(stepId, fieldPath): PdfFieldProposal | undefined` — usado por cada campo del Step.

Reglas de mutación: solo se actualiza por respuestas del backend, nunca optimistic-write para `status`. La UI marca "saving..." mientras el PATCH está en vuelo.

### Shared types: `PdfFieldProposal` y `Provenance`

Owner: TASK-006 (canónico backend), TASK-007 (mirror Python), TASK-008 (consumer TS). Source of truth: Pydantic en `ai-service/agents/pdf_extractor/schemas.py` promovido desde el spike. TS se genera vía `openapi-typescript` contra FastAPI (ADR-011 §4) — un solo schema.

Campos lógicos del `PdfFieldProposal` (contrato; tipo exacto en cada TASK):
- Identificación: `id`, `extractionRunId`, `stepId`, `fieldPath` (dotted path tipo `step1.moduleB.profiles`).
- Valor: `proposedValue` (JSON), `editedValue` (JSON nullable), `status`.
- Provenance: objeto `Provenance` con `sourcePdfId`, `sourcePdfName`, `pageNumbers[]`, `quotedExcerpt` ≤ 280 chars, `originalExcerpt?` si hubo traducción (US-016), `confidenceScore` 0.00-1.00, `confidenceBand` enum `high|medium|low`, `agentRunId`, `proposedAt`, `secondarySources[]` (US-010), `conflict?` (US-011), `omissionReason?` (US-012).
- Resolución: `resolvedAt`, `resolvedBy`, `resolutionAction` ∈ `confirm|edit|discard`.

El contrato es idéntico al definido en ADR-005 §Provenance data contract. Cualquier campo extra es prohibido en V1 sin extender este SPEC.

---

## State machine

Una corrida de upload + extracción + revisión recorre exactamente estos estados por (pdf, step, fieldPath). Reglas duras entre paréntesis.

```
upload session:
  uploading → parsing → extracting → review → (per field) confirmed | edited | discarded | omitted

PdfExtractionRun:
  pending → running → succeeded | partial | failed | cancelled

PdfFieldProposal:
  proposed → confirmed | edited | discarded
           ↘ omitted (alcanzado directamente cuando confidence < 0.60)
```

Reglas no negociables:
- **US-009:** ningún `PdfFieldProposal` puede saltar de `proposed` a "campo autoritativo en la tabla del Step" sin un PATCH explícito del founder con `action ∈ {confirm, edit}`.
- **US-017 (gate):** Express rechaza `POST /api/v1/projects/:id/submit-for-review` (o el endpoint equivalente que hoy transiciona a `esperando_revision`) si existe al menos un `PdfFieldProposal` con `status='proposed'` para ese `projectId`. Respuesta: 409 `AUTOFILL_UNCONFIRMED` con `pendingProposals: ProposalRef[]`.
- **US-011 (conflicto):** una propuesta puede tener `status='proposed'` con `conflict != null`. El founder debe seleccionar una de las opciones; selecciona vía PATCH con `action='confirm'` y `selectedSourceId` en el body. No se aplican defaults.
- **US-003 / no sobrescritura silenciosa:** una nueva corrida sobre un campo en estado `confirmed` o `edited` (en la tabla del Step, no en `PdfFieldProposal`) NO sobrescribe — crea un `PdfFieldProposal` nuevo con flag `secondary=true` que la UI expone bajo demanda en el historial del campo.
- **Reversibilidad (US-009, ADR-005):** `discard` se puede revertir vía PATCH con `action='restore'` mientras la iniciativa esté en `en_step_*`. Una vez en `esperando_revision`, queda bloqueada hasta que el mentor devuelva.

---

## Persistencia prereq (hard blocker)

PRD-002 asume que Steps 0-4 pueden persistir campos individuales contra el backend. Hoy la auditoría de TASK-000 + el repo confirman que **solo Step 1 (parcialmente) escribe vía API**; Step 0, Step 2, Step 3, Step 4 siguen viviendo en memoria del `AppContext` o en localStorage. SPEC-002 no puede entregar el flujo completo (PATCH del founder → escritura en la tabla del Step) sin esta capa.

**Acción:** Se declara **TASK-010: Step 2/3/4 persistence parity**, prerequisito duro de TASK-008 y TASK-009. Si TASK-000 ya cubre Step 0/1 pero no 2/3/4, TASK-010 extiende su alcance. Si TASK-000 está in-flight, TASK-010 se merge con su backlog.

Scope mínimo de TASK-010 (resumen — el detalle vive en su propia TASK):
- Endpoints `PATCH /api/v1/projects/:id/steps/:n/modules/:m/fields/:fieldPath` con escritura por campo y `origin ∈ {manual, autofill_confirmed, autofill_edited}`.
- Migración Prisma para que cada Step tenga su tabla módulo-por-módulo (hoy existen `Step1ModuleA..D`; deben existir las análogas de Steps 2/3/4).
- Autosave indicator en frontend conectado a writes reales (reemplazar `AutosaveIndicator` fake citado en TASK-000).

Hand-off explícito: TASK-008 y TASK-009 NO pueden marcar acceptance criteria como cumplidos hasta que TASK-010 mergee. TASK-006 y TASK-007 pueden avanzar en paralelo a TASK-010 porque no dependen de ella.

---

## Observability

Owner: TASK-009. Toda métrica se correlaciona por `requestId` (UUIDv7, generado en Front o en Express si falta; propagado a ai-service vía header `X-Request-Id` por ADR-011 §10).

Métricas por capa (Prometheus):

- **Front:** `starteria_pdf_upload_attempt_total{outcome}`, `starteria_pdf_upload_duration_ms` (histograma), `starteria_pdf_proposal_action_total{action,confidenceBand}` para confirmar/editar/descartar.
- **Express:** `starteria_pdf_presign_total{outcome}`, `starteria_pdf_confirm_total{outcome,piiPreflagged}`, `starteria_pdf_extract_queued_total{steps}`, `starteria_pdf_extract_task_duration_ms`, `starteria_pdf_proposals_persisted_total{status}`, `starteria_pdf_gate_block_total` (cuántas veces el submit fue rechazado por US-017).
- **ai-service:** `starteria_ai_pdf_parse_latency_seconds{lang}`, `starteria_ai_pdf_extract_latency_seconds{step,model}`, `starteria_ai_pdf_cost_usd_total{initiative,cohort}`, `starteria_ai_pdf_extract_fallback_total{from_model,to_model}`, `starteria_ai_pdf_pii_masked_spans_total{type}`, `starteria_ai_pdf_chunks_total{step}`.

Trace correlation: cada `PdfExtractionRun` persiste `requestId`. Logs estructurados de Express y ai-service incluyen `requestId` siempre. El audit trail (`AuditLog`) referencia `requestId` para que el mentor o un investigador post-incidente reconstruyan el camino completo.

Dashboards mínimos (TASK-009):
1. **Cost dashboard:** USD por upload, por iniciativa/mes, por cohorte/mes. Alertas a 80% del techo de cohorte ($120) y bloqueo automático a 100% ($150).
2. **Quality dashboard:** confirm/edit/discard rates por confidenceBand; tasa de alucinaciones (campos confirmados que luego se reportan como incorrectos vía `report_hallucination` action en UI — futuro).
3. **Latency dashboard:** P50/P95/P99 de parseo y de extracción por Step, contra los SLOs PRD-002 (parseo ≤ 30s para ≤ 50pp, extract ≤ 20s por Step).

---

## Security model

- **JWT propagation:** Front → Express usa el bearer existente (ADR-003). Express NUNCA pasa el JWT a ai-service; el `userId` viaja como campo del body firmado HMAC (ADR-011 §5).
- **HMAC bridge:** Cada llamada Express → ai-service firma `HMAC-SHA256(secret, timestamp + body)` con ventana de 30s anti-replay. Secreto rotado trimestralmente con ventana dual de 5 min. Owner del secreto: TASK-006 (Express side) + TASK-007 (ai-service side).
- **PII detection placement (ADR-012 §PII):**
  - **Stage A:** Express, sincrónico en `confirm`. Regex/diccionario sobre filename + primera página. Si detecta sobrepasa umbral, rechaza con `AUTOFILL_PII_BLOCKED` y no encola extracción.
  - **Stage B:** ai-service worker, antes de llamar al LLM. Presidio (es+en). Persiste `derived/{pdfId}/pii-mask.json` como receipt. Recall ≥ 0.95 verificado en CI por TASK-007 antes de promover release.
- **Retención (ADR-012):** PDF original 90 días por defecto, configurable 7-365 por founder. Derivados siguen la misma ventana. `AuditLog` persiste 365 días sin contenido del PDF. Right-to-delete cascade descrito en ADR-012 §Cascade.
- **Key rotation:** `alias/starteria-pdf` KMS rota anualmente automático (AWS). `AI_SERVICE_SHARED_SECRET` HMAC trimestralmente. `ANTHROPIC_API_KEY` y `GOOGLE_API_KEY` (fallback) viven solo en `ai-service/.env`, nunca en Express.
- **Bucket policy:** `initiative-pdfs/*` rechaza GET sin presigned URL; CI policy test obligatorio (ADR-012 §Testing). Worker nunca tiene IAM directa.

---

## Cost budgets

Techos (PRD-002 NFR + ADR-004 §Configuration):

| Nivel | Techo USD | Trigger de alerta | Trigger de bloqueo |
|---|---|---|---|
| Por upload session (parseo + 5 Steps) | $0.30 | n/a | Circuit breaker en `ai-service`: `costUsd ≥ $0.30` aborta Steps pendientes con `partial` y motivo `techo_upload_alcanzado`. |
| Por iniciativa / mes natural | $1.50 | 80% ($1.20): warning en UI | 100%: nuevas extracciones rechazadas con `AUTOFILL_TECHO_INITIATIVE` (US-013); uploads sin extract siguen disponibles. |
| Por cohorte / mes natural | $150 | 80% ($120): pageDuty + email a portfolio lead | 100%: degradación a cola best-effort, no rechazo duro. |

Cálculo de referencia (spike calibration): $0.052 por Step × 5 Steps = $0.26 por upload de 50pp; margen 13% bajo el techo. Cualquier upload que el pre-flight estime > $0.30 se rechaza con `AUTOFILL_TECHO_UPLOAD` antes de invocar el extractor (ADR-004 §Pre-flight cost estimate). Aviso: el spike midió $0.26 sobre **un solo PDF** y el modelo del spike fue DeepSeek vía OpenRouter (deviación documentada en `evals/golden/pdf-extraction/README.md`). Producción usará Haiku 4.5 y debe re-calibrar el costo medio sobre el gold set N≥50.

---

## Rollout plan

Feature flag: `feature.pdfAutofill` (boolean por usuario, servido vía `/api/v1/config/features`, owner TASK-009). Default `false`.

Fases:

1. **Internal dogfood (semana 1):** equipo Starteria + 2 founders piloto identificados por Portfolio Lead. Métrica de salida: cero errores de schema, cero fugas de PII detectadas en log de `pii-mask.json`, ≤ 1 ticket de soporte / founder / semana.
2. **Beta 20-founder (semanas 2-4):** opt-in con consentimiento explícito (US-015). Selección estratificada: 10 founders nuevos (sin iniciativa previa), 10 con iniciativa en curso. Cohorte aislada en métricas. Criterios de éxito acumulados durante las 3 semanas:
   - Precisión por campo medida ≥ 0.80 sobre las propuestas que el founder marca como `confirm` sin editar.
   - Recall medido ≥ 0.70 sobre el gold set de QA N=50 (esto exige que el gold set N≥50 de ADR-004 §5 esté listo antes de iniciar la beta).
   - Tasa de descarte ≤ 0.10 (PRD-002 success metric).
   - Costo medio por upload medido ≤ $0.26.
   - Zero incidentes de PII leak verificados por sampling semanal.
3. **General release:** flag a `true` para todos los founders. Mantener kill-switch operativo (rollback en 5 minutos vía flag).
4. **Post-release (continuo):** sampling semanal de 50 propuestas para auditoría manual de alucinaciones (objetivo ≤ 0.03). Review mandatorio si precisión cae bajo 0.80 dos semanas consecutivas (ADR-004 §Mandatory review triggers).

---

## Out of scope (re-afirmado desde PRD-002)

- Formatos distintos a PDF (DOCX, imágenes, audio, video, planillas).
- OCR sobre PDFs imagen-pura. Heurística: `image_only_threshold_chars_per_page=50` y `image_only_threshold_pages_ratio=0.80` (ADR-004 §Chunker) — si se gatilla, abortar con `AUTOFILL_IMAGE_ONLY_PDF`.
- Auto-confirmación de campos por threshold alto (rechazado en ADR-005 alternativa C — viola US-009).
- Envío automático al mentor sin gate explícito (US-017).
- Integración con Google Drive / Dropbox / SharePoint para descubrir PDFs.
- Sugerencias proactivas tipo "subiste un PDF, quieres auto-rellenar X?". El founder dispara explícitamente cada corrida.
- Edición colaborativa multi-usuario en tiempo real sobre las propuestas.
- Auto-rellenado de campos fuera de Steps 0-4.
- Mentor ve el binario original del PDF (ADR-012 §Access control — solo founder-owner descarga).

---

## Open contract questions

Específicas a la integración. Deben resolverse antes de status → approved.

- [ ] **Trigger de extracción:** ¿extracción se dispara automáticamente al `confirm` del upload (un solo flujo), o requiere acción explícita del founder ("Auto-rellenar Step N") con selección de Steps objetivo? PRD-002 US-003..US-007 sugiere acción explícita por Step; el flujo descrito en §End-to-end asume disparador único con todos los Steps. **Owner:** Product + UX. **Resuelve antes de:** TASK-006 + TASK-008 start.
- [ ] **Comportamiento ante cola saturada:** si la cola de `ai-service` está saturada (rate limit upstream Anthropic, o más de N=50 jobs en flight), ¿el upload responde 202 con `estimatedSec` elevado, 429 con retry-after, o 503 con sugerencia de reintentar? Afecta UX del founder y métricas de availability. **Owner:** Tech Lead. **Resuelve antes de:** TASK-006 + TASK-009 dashboards.
- [ ] **Exposición del confidence score:** ADR-005 define `confidenceBand` categórico (high/medium/low) como contrato de UI, pero también persiste `confidenceScore` numérico. ¿La UI expone alguna vez el score numérico (e.g. en hover, tooltip de auditoría, panel de historial)? ¿O queda 100% interno y solo visible vía audit trail por portfolio lead? **Owner:** Product + UX. **Resuelve antes de:** TASK-008 visual design lockdown.
- [ ] **Política de reintento del founder:** si una corrida falla (`PdfExtractionRun.status='failed'`), ¿el founder puede reintentar manualmente, hay reintento automático limitado, y cuenta el reintento contra el techo `$1.50/iniciativa/mes`? **Owner:** Product + Finance. **Resuelve antes de:** TASK-009 cost guardrails.
- [ ] **Granularidad del audit trail expuesto al mentor:** ADR-012 dice que el mentor ve derivados, no binarios. ¿El mentor también ve la lista de propuestas descartadas (con motivo) y de propuestas editadas (con diff vs. valor original), o solo el estado final? Afecta el slice `byProject.proposals` que retorna el GET para rol mentor. **Owner:** Product. **Resuelve antes de:** TASK-008 mentor view.
- [ ] **Comportamiento al expirar la retención del PDF:** cuando `retentionUntil` se cumple y el cascade de ADR-012 ejecuta, los `PdfFieldProposal` confirmados retienen la página y el extracto, pero la `provenance.sourcePdfName` debe degradar a "PDF eliminado el {fecha}". ¿Esto rompe el contrato UI de ADR-005 (que asume `sourcePdfName` siempre presente)? ¿O introducimos `provenance.sourcePdfDeleted: boolean` y el frontend renderiza diferente? **Owner:** Architecture. **Resuelve antes de:** TASK-008 finalización del componente provenance.

---

## Sign-off checklist

Antes de mover `status: approved`:

- [ ] Las 6 open contract questions están resueltas y reflejadas en este SPEC o en las TASKs.
- [ ] TASK-010 (persistencia Steps 2/3/4) declarada y con owner asignado.
- [ ] TASK-006..TASK-009 escritas en `project/.sdlc/specs/` con frontmatter `parent: SPEC-002` y `adrs` consistentes.
- [ ] Gold set N≥50 de ADR-004 §5 con cronograma de anotación.
- [ ] HMAC secret y KMS key alias provisionados en infra (no hard-coded).
- [ ] Feature flag `feature.pdfAutofill` registrado en el sistema de config.
- [ ] Dashboards de costo (TASK-009) maquetados — al menos diseño aprobado.
- [ ] Política de rollback documentada (kill-switch via flag en ≤ 5 minutos).
- [ ] Bucket policy CI test para `initiative-pdfs/*` mergeado (ADR-012 §Testing).
- [ ] Recall de PII masking ≥ 0.95 sobre el suite de Stage B verificado antes del beta.

---

*SPEC-002 -- BHIL AI-First Development Toolkit -- Starteria PDF Autofill Integration*
