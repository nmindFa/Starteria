---
id: TASK-006
title: "Backend: almacenamiento PDF + endpoints de extracción y revisión"
status: ready
date: 2026-05-19
author: BHIL Tasks (Swarm)
parent: SPEC-002
sprint: S-02
estimate: 8d
adrs: [ADR-007-backend, ADR-012-backend, ADR-008-backend, ADR-005-backend, ADR-010-backend]
depends_on: []
unblocks: [TASK-007, TASK-008, TASK-009]
---

# TASK-006: Backend — almacenamiento PDF + endpoints de extracción y revisión

## Objetivo

Implementar en el backend Express/Prisma la columna vertebral de PRD-002: una capa de almacenamiento S3-compatible (ADR-007) que **hoy no existe en el código** y, sobre ella, el módulo `backend/modules/initiative-pdfs/` que expone los ocho endpoints REST para subir un PDF de iniciativa, disparar una extracción asíncrona contra el microservicio Python (ADR-008 + ADR-011), exponer el estado de la corrida, devolver las propuestas de campo con provenance y permitir al founder confirmar, editar o descartar cada propuesta de forma autoritativa. Esta TASK es la pieza de servidor sin la cual TASK-007 (puente HMAC), TASK-008 (agente extractor) y TASK-009 (frontend dropzone + panel de revisión) no tienen contraparte de persistencia ni superficie HTTP que consumir.

---

## Pre-requisitos

ADR-007 está `Accepted` pero — confirmado por la auditoría de Fase 0 — **sin implementación en el código** (no hay cliente S3 cableado, no hay `MinIO` en `docker-compose`, no hay ruta `/evidence/presign` aunque exista el módulo `evidence/` con stubs). ADR-012 declara explícitamente que su Step 1 es "implementar ADR-007". Por lo tanto **la Fase A de esta TASK es implementar ADR-007** (substrato compartido `evidence/` + `initiative-pdfs/`). No se permite empezar Prisma de PDFs (Fase B) ni endpoints (Fase C) sin que la Fase A esté verde con un upload de prueba round-trip de ≥ 50 MB a MinIO local en < 8 s P95.

| Pre-requisito | Estado actual | Quién lo cierra |
|---|---|---|
| Cliente S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) instalado y configurado | No | Esta TASK, Fase A |
| MinIO en `docker-compose.dev.yml` con bucket bootstrapping | No | Esta TASK, Fase A |
| Variables de entorno S3 documentadas en `.env.example` | No | Esta TASK, Fase A |
| Política CORS del bucket aplicable a PUT directo desde browser | No | Esta TASK, Fase A |
| Tabla `Evidence` mapeada a S3 (ADR-007) | No | Esta TASK, Fase A (extiende el módulo `evidence/` existente para que use el cliente nuevo) |
| Microservicio Python AI base | Scaffolded (commit `6f30329`) | Ya existe; TASK-007 lo cablea con HMAC |
| `AuditLog` model en Prisma | Existe (ADR-002) | — |
| `Project`, `User`, `Step` models en Prisma | Existen (ADR-002) | — |

Si MinIO no levanta limpio en CI tras esta TASK, la TASK se considera incompleta — el extractor de TASK-008 y el dropzone de TASK-009 no pueden integrarse contra un sustrato roto.

---

## Alcance (in scope)

- Implementar el cliente S3 (`backend/modules/storage/s3.client.ts`) y la fábrica de URLs prefirmadas (PUT + GET) parametrizable por TTL.
- Añadir el servicio MinIO al `docker-compose.dev.yml` con bootstrap del bucket único `starteria-files`, cuentas dev embebidas en `.env.local.example` (nunca commiteadas con valores reales).
- Cablear el módulo `evidence/` existente al nuevo cliente — la TASK no rediseña evidence, solo le da la implementación que ADR-007 prometió.
- Crear el módulo `backend/modules/initiative-pdfs/` con `router.ts`, `controller.ts`, `service.ts`, `repository.ts`, `schemas.ts` (Zod), `pii-prescan.ts`, `retention-sweeper.ts`, `client.ts` (cliente HTTP hacia el microservicio Python — la firma HMAC delegada a TASK-007).
- Definir tres modelos Prisma — `InitiativePdf`, `PdfExtractionRun`, `PdfFieldProposal` — con su migración forward + reversible (per ADR-012 §Data model).
- Implementar los 8 endpoints REST listados en §Endpoints HTTP, todos detrás de `authenticate` + chequeo por rol (founder-owner para mutaciones; mentor / portfolio-lead solo lectura de derivados — no de original).
- Aplicar el envelope tipado de ADR-010 a cada respuesta de error y propagar `requestId`.
- Escribir entradas en `AuditLog` para cada acción listada en §Audit trail.
- Stage A del PII pre-scan (cheap, server-side, post-confirm, pre-enqueue) dentro de esta TASK; Stage B (Presidio en el microservicio) es propiedad de TASK-008.
- Hook con la máquina de estados de proyecto (ADR-002 + reglas de SPEC-001) para bloquear `en_step_4 → esperando_revision` mientras existan `PdfFieldProposal.status = 'pending'` (US-017).
- Job nocturno `pdf-retention-sweeper` con su entrada en el scheduler (cron o `bullmq` repeat) que aplica la política de retención de ADR-012.

## Fuera de alcance

| Fuera | Quién lo hace |
|---|---|
| Firma HMAC + correlación de `requestId` end-to-end entre Express y el microservicio Python | **TASK-007** (Puente AI-service) |
| Implementación del agente `pdf_extractor` (parsing, page-map, embeddings, llamada al LLM, Stage B PII con Presidio) | **TASK-008** (Agente de extracción) |
| Dropzone, panel de revisión, indicadores visuales de provenance, modal de conflicto multi-PDF, banner de techo de costo | **TASK-009** (Frontend PDF Autofill) |
| Cliente-side encryption | Explícitamente rechazado en ADR-012 |
| Cohort-level data export | Fuera del PRD-002 |
| Cambios al módulo `evidence/` más allá de cablear el cliente S3 nuevo | Otra TASK futura si fuera necesario; aquí solo se le da el cliente |
| Cambios a `auth/` | Reutilizamos `authenticate` + `requireRole` tal cual existen tras ADR-010 |
| KMS real en dev | MinIO no soporta KMS de AWS; en dev se usa SSE-S3 mockeado y la `kmsKeyAlias` se persiste con el valor placeholder `local-minio-sse-s3` |

---

## Schemas Prisma

Esta sección describe en prosa los tres modelos nuevos. La migración real vivirá en `backend/prisma/migrations/2026MMDD_initiative_pdfs/`. Los nombres de campos respetan la convención `camelCase` ya usada en `Project`, `User`, `Evidence`.

### Modelo: `InitiativePdf`

Una fila por PDF subido a una iniciativa. La fila precede al objeto S3 (se crea al `presign`, no al `confirm`) para permitir el cleanup de uploads abandonados.

| Campo | Tipo lógico | Notas / índices |
|---|---|---|
| `id` | UUIDv7 | PK. Reusado como stem del key S3 (`initiative-pdfs/originals/{projectId}/{id}.pdf`). Índice único implícito. |
| `projectId` | UUID, FK → `Project.id` | Índice. `ON DELETE CASCADE` deferido — el delete real lo hace el cascade-aware `pdfService.purge`. |
| `uploadedBy` | UUID, FK → `User.id` | Quién hizo el upload. Se usa en `AuditLog`. |
| `fileName` | string ≤ 255 chars | Original. UI lo muestra; NO se usa en el key S3 para no leak PII en logs. |
| `mimeType` | string | Solo `application/pdf` aceptado en V1 (validado en Zod). |
| `fileSizeBytes` | int | Enforced ≤ `PDF_MAX_BYTES` (52428800 = 50 MB). |
| `pageCount` | int? | Null hasta que el extractor lo rellene; constraint aplicacional ≤ 200. |
| `languageDetected` | enum (`es`, `en`, `unsupported`) | Null hasta Stage B del extractor. |
| `fileKey` | string | Path completo S3 (`initiative-pdfs/originals/{projectId}/{id}.pdf`). Único. |
| `derivedPrefix` | string | Prefijo S3 de derivados (`initiative-pdfs/derived/{projectId}/{id}/`). |
| `kmsKeyAlias` | string | `alias/starteria-pdf` en prod, `local-minio-sse-s3` en dev. |
| `status` | enum (`pending_upload`, `uploaded`, `pii_blocked`, `extraction_eligible`, `purged`) | `pending_upload` al `presign`; `uploaded` al `confirm`; `pii_blocked` si Stage A falla; `extraction_eligible` tras Stage A OK; `purged` al cascade de delete. Índice. |
| `piiPreScanFlags` | jsonb | Resultado Stage A (lista de patrones detectados + página estimada). `[]` si limpio. |
| `retentionUntil` | timestamptz | Fecha de purga. Default `uploadedAt + PDF_RETENTION_DEFAULT_DAYS`. Min `now + 7d`, max `now + 365d`. Índice — el sweeper hace `WHERE retentionUntil < now() AND deletedAt IS NULL`. |
| `uploadedAt` | timestamptz | Default `now()`. Solo se setea en `confirm`, no en `presign`. |
| `deletedAt` | timestamptz? | Null hasta que arranque el cascade. Soft-delete. |
| `createdAt` / `updatedAt` | timestamptz | Convención ADR-002. |

Constraint adicional: por trigger SQL `(projectId, deletedAt IS NULL)` agrupa máximo `PDF_MAX_PER_INITIATIVE = 10` PDFs activos. La aplicación lo valida también (defensa en profundidad).

### Modelo: `PdfExtractionRun`

Una fila por (pdfId, requestedStep) tuple. Si el founder corre el mismo Step dos veces, hay dos filas — la última es la `effective`.

| Campo | Tipo lógico | Notas / índices |
|---|---|---|
| `id` | UUIDv7 | PK. Coincide con el `requestId` del envelope ADR-011 (TASK-007). |
| `pdfId` | UUID, FK → `InitiativePdf.id` | Índice. |
| `projectId` | UUID, FK → `Project.id` | Denormalizado para queries de costo por proyecto sin join. Índice (compuesto con `startedAt`). |
| `requestedStep` | enum (`step_0`, `step_1`, `step_2`, `step_3`, `step_4`) | Driver del prompt y del field-map. |
| `status` | enum (`pending`, `running`, `completed`, `failed`, `cancelled`) | Per ADR-008 polling. Índice. |
| `startedAt` | timestamptz | Default `now()` al crear. |
| `finishedAt` | timestamptz? | Null hasta status terminal. |
| `costUsd` | decimal(10,4) | Acumulado del run. Default 0 hasta que el worker lo rellene. Se suma al techo PRD-002 NFR ($150 / cohorte / mes). |
| `modelVersion` | string | Trazabilidad. P. ej. `claude-sonnet-4.7-20260417`. |
| `languageProcessed` | enum (`es`, `en`) | Diferencia de US-016 (in→es se traduce, fidelidad ≥ 0.85). |
| `errorReason` | string? | Solo si `status = failed`. Texto humano corto (≤ 280 chars). El stack queda en `logger`, no aquí. |
| `extractedTextRef` | string? | Key S3 del `text.jsonl` derivado. Nulled en cascade de purge. |
| `pdfContentPurged` | bool | `false` por defecto; pasa a `true` cuando el PDF se borra y la fila sobrevive por audit. |
| `requestId` | string (UUIDv4) | Header de ADR-011 propagado. Igual al `id` por convención. |
| `createdAt` / `updatedAt` | timestamptz | — |

### Modelo: `PdfFieldProposal`

Una fila por (extractionRunId, fieldPath). Es la unidad que el founder revisa una a una (US-009).

| Campo | Tipo lógico | Notas / índices |
|---|---|---|
| `id` | UUIDv7 | PK. |
| `runId` | UUID, FK → `PdfExtractionRun.id` | `ON DELETE CASCADE` deferido (se conservan tras purge — ADR-012 §Right-to-delete cascade item 5). |
| `projectId` | UUID, denormalizado | Para list endpoints sin join. Índice compuesto `(projectId, status)`. |
| `fieldPath` | string ≤ 255 chars | Dotted path. P. ej. `step1.moduleB.profiles[0].segment`. |
| `proposedValue` | jsonb | Valor sugerido por el modelo. Estructura libre por field. |
| `provenance` | jsonb | `{ pdfId, pages: [int], excerpt: string ≤ 280, sources: [{pdfId, confidence}] }`. La forma con `sources[]` cubre el merge multi-PDF (US-010) y la presentación de conflictos (US-011). |
| `confidence` | decimal(3,2) | 0.00-1.00. |
| `confidenceBand` | enum (`alta`, `media`, `baja`) | Derivado en INSERT trigger desde `confidence` (≥ 0.80 / 0.60-0.79 / < 0.60) — US-008. |
| `status` | enum (`pending`, `confirmed`, `edited`, `discarded`) | Default `pending`. Solo `confirmed` y `edited` cuentan como autoritativos (US-009). Índice `(projectId, status)`. |
| `finalValue` | jsonb? | Null hasta acción del founder. En `confirmed` copia `proposedValue`; en `edited` guarda el nuevo valor del founder; en `discarded` queda null. |
| `confirmedBy` | UUID, FK → `User.id`? | Quién resolvió la propuesta. Null hasta acción. |
| `confirmedAt` | timestamptz? | Idem. |
| `createdAt` / `updatedAt` | timestamptz | — |

Constraint clave: el bloqueo de transición `en_step_4 → esperando_revision` se implementa como un check en `project.service.transitionTo()` que cuenta `PdfFieldProposal` con `status = 'pending' AND projectId = ?` y rechaza la transición si el conteo es > 0. La cuenta es exacta gracias al índice compuesto.

---

## Endpoints HTTP

Todos bajo `/api/v1/initiatives/:id/pdfs/*`. `id` se valida UUID; el chequeo de ownership está en `requireOwnership('project', 'id')` (middleware existente ADR-004). Todas las respuestas de error siguen el envelope ADR-010 (`{ success: false, error: { code, message, requestId, ... } }`). Todas las respuestas de éxito incluyen `requestId` en el body para correlación. Latencia P95 medida en CI con MinIO local; los presupuestos son objetivos, no contratos.

### 1. `POST /api/v1/initiatives/:id/pdfs/presign`

| Campo | Valor |
|---|---|
| Verbo / path | `POST /api/v1/initiatives/:id/pdfs/presign` |
| Auth | JWT obligatorio; `requireRole('owner')` + `requireOwnership('project', 'id')` |
| Request body (prosa) | `fileName: string`, `mimeType: 'application/pdf'`, `fileSizeBytes: int ≤ 52428800`. |
| Response 200 body | `{ pdfId, presignedUrl, headers: { 'x-amz-server-side-encryption': '...' }, expiresAt }`. |
| 400 | `VALIDATION_ERROR` — mime no PDF, size sobre 50 MB, fileName > 255 chars. |
| 401 | `UNAUTHORIZED` — no JWT. |
| 403 | `FORBIDDEN` — JWT válido pero no es owner del project. |
| 404 | `NOT_FOUND` — project no existe o pertenece a otra cohorte. |
| 409 | `CONFLICT` con `code: PDF_LIMIT_REACHED` — la iniciativa ya tiene 10 PDFs activos (PRD-002 constraint). |
| 429 | `AUTH_RATE_LIMITED` — más de N presigns / min por user (defensa anti-abuse). |
| 5xx | `INTERNAL_ERROR` — S3 unreachable. |
| Latencia P95 | < 200 ms (no toca S3 — solo firma local). |

### 2. `POST /api/v1/initiatives/:id/pdfs`

| Campo | Valor |
|---|---|
| Verbo / path | `POST /api/v1/initiatives/:id/pdfs` |
| Auth | JWT + owner. |
| Query | `?extract=true` opcional — dispara extracción automática del Step actual de la iniciativa al confirmar. |
| Request body | `{ pdfId, fileKey, fileSizeBytes }`. El backend hace `HEAD` a S3 para verificar que el objeto subido coincide en tamaño y tiene el header SSE esperado. |
| Response 201 body | `{ pdf: InitiativePdfDTO, piiPreScan: { passed: bool, flags: [...] }, runId?: string }`. `runId` solo si `?extract=true` y `passed = true`. |
| 400 | `VALIDATION_ERROR`. |
| 401 / 403 / 404 | Igual a (1). |
| 409 | `code: PDF_NOT_UPLOADED` — el objeto no existe en S3 al hacer HEAD. |
| 413 | `PAYLOAD_TOO_LARGE` — el tamaño real del objeto en S3 excede el declarado en `presign`. |
| 422 | `code: PDF_PII_BLOCKED` — Stage A detecta PII catastrófica en la cover page (ej. > 5 DNIs únicos). Estado del PDF queda en `pii_blocked`; el founder ve el motivo. |
| 5xx | `INTERNAL_ERROR`. |
| Latencia P95 | < 600 ms (incluye HEAD a S3 + Stage A regex en primer page text, que aquí aún no se ha parseado — Stage A V1 corre solo sobre `fileName` + tamaño + checks de header PDF; el text de página llega en TASK-008. Documentado como gap aceptado en §Riesgos). |

### 3. `POST /api/v1/initiatives/:id/pdfs/:pdfId/extract`

| Campo | Valor |
|---|---|
| Verbo / path | `POST /api/v1/initiatives/:id/pdfs/:pdfId/extract` |
| Auth | JWT + owner. |
| Request body | `{ targetStep: 'step_0' \| 'step_1' \| ... \| 'step_4' }`. La iniciativa debe estar en `en_step_N` correspondiente (US-003 a US-007). |
| Response 202 body | `{ runId, status: 'pending', pollUrl, costEstimateUsd }`. 202 (no 201) porque el resultado aún no existe. |
| 400 | `VALIDATION_ERROR` o `code: PDF_STATE_MISMATCH` si `pdf.status != extraction_eligible`. |
| 401 / 403 / 404 | Igual a (1). |
| 409 | `code: PROJECT_STATE_MISMATCH` — initiative no está en el step pedido. |
| 422 | `code: COST_CEILING_REACHED` — la cohorte ya consumió ≥ $150 USD en el mes (US-013). |
| 5xx | `INTERNAL_ERROR` — fallo al encolar contra microservicio Python. |
| Latencia P95 | < 400 ms (solo encola — el trabajo real es asíncrono per ADR-008). |

### 4. `GET /api/v1/initiatives/:id/pdfs/runs/:runId`

| Campo | Valor |
|---|---|
| Verbo / path | `GET /api/v1/initiatives/:id/pdfs/runs/:runId` |
| Auth | JWT + owner OR mentor asignado OR portfolio-lead. |
| Response 200 body | `{ runId, status, startedAt, finishedAt, costUsd, modelVersion, errorReason? }`. Polling. |
| 401 / 403 / 404 | Igual a (1). |
| Cache | `Cache-Control: no-store` — el status cambia. |
| Latencia P95 | < 100 ms. Recomendado client poll cada 2 s (per ADR-008). |

### 5. `GET /api/v1/initiatives/:id/pdfs/runs/:runId/proposals`

| Campo | Valor |
|---|---|
| Verbo / path | `GET /api/v1/initiatives/:id/pdfs/runs/:runId/proposals` |
| Auth | Owner full; mentor / portfolio-lead reciben la respuesta pero con `provenance.excerpt` redactado a primeros 80 chars (no a la versión completa de 280) por política de minimización (ADR-012 §Access control). |
| Query | `?status=pending\|confirmed\|edited\|discarded` opcional. |
| Response 200 body | `{ proposals: [PdfFieldProposalDTO], meta: { total, pendingCount } }`. Solo se devuelve si el run está `completed`. |
| 409 | `code: RUN_NOT_READY` si `run.status != completed`. |
| 401 / 403 / 404 | Igual a (1). |
| Latencia P95 | < 250 ms para hasta 200 propuestas. |

### 6. `POST /api/v1/initiatives/:id/pdfs/runs/:runId/proposals/:fieldPath/confirm`

`:fieldPath` se envía URL-encoded para acomodar puntos y corchetes.

| Campo | Valor |
|---|---|
| Verbo / path | `POST .../proposals/:fieldPath/confirm` |
| Auth | JWT + owner. |
| Request body | Vacío. La acción es idempotente solo si la propuesta sigue en `pending`. |
| Response 200 body | `{ proposal: PdfFieldProposalDTO (status now 'confirmed') }`. El backend copia `proposedValue → finalValue` y escribe al `step_data` autoritativo del proyecto en una transacción Prisma (per US-009). |
| 409 | `code: PROPOSAL_ALREADY_RESOLVED` si ya estaba `confirmed/edited/discarded`. |
| 401 / 403 / 404 | Igual a (1). |
| Latencia P95 | < 200 ms. |

### 7. `POST /api/v1/initiatives/:id/pdfs/runs/:runId/proposals/:fieldPath/edit`

| Campo | Valor |
|---|---|
| Verbo / path | `POST .../proposals/:fieldPath/edit` |
| Auth | JWT + owner. |
| Request body | `{ value: <any JSON> }`. Validado contra el field-schema del Step correspondiente. |
| Response 200 body | `{ proposal: PdfFieldProposalDTO (status now 'edited', finalValue = body.value) }`. También escribe a `step_data`. |
| 400 | `VALIDATION_ERROR` — el value no respeta el schema del campo. |
| 409 | `code: PROPOSAL_ALREADY_RESOLVED`. |
| 401 / 403 / 404 | Igual a (1). |
| Latencia P95 | < 250 ms. |

### 8. `DELETE /api/v1/initiatives/:id/pdfs/runs/:runId/proposals/:fieldPath`

| Campo | Valor |
|---|---|
| Verbo / path | `DELETE .../proposals/:fieldPath` |
| Auth | JWT + owner. |
| Response 204 | No body. `status` pasa a `discarded`, `finalValue = null`. No se toca `step_data`. |
| 409 | `code: PROPOSAL_ALREADY_RESOLVED`. |
| 401 / 403 / 404 | Igual a (1). |
| Latencia P95 | < 200 ms. |

Adicionalmente, `DELETE /api/v1/initiatives/:id/pdfs/:pdfId` se considera necesario para US-015 + right-to-delete, pero queda **explícitamente fuera de los 8** que pide la consigna y se difiere a una TASK posterior — el comportamiento de retención automática del sweeper cubre el path mínimo.

---

## Storage layer (implementación de ADR-007)

| Aspecto | Decisión |
|---|---|
| Bucket único | `starteria-files` (compartido con `evidence/` per ADR-012). |
| Layout de prefijos PDF | `initiative-pdfs/originals/{projectId}/{pdfId}.pdf` y `initiative-pdfs/derived/{projectId}/{pdfId}/{text.jsonl,pages.json,pii-mask.json,embeddings.bin}`. |
| Encriptación at-rest | Prod: SSE-KMS con `alias/starteria-pdf`. Dev: MinIO SSE-S3 con master key local (no commiteada). El campo `kmsKeyAlias` del modelo guarda el alias real para auditoría. |
| Encriptación in-transit | TLS 1.2+ enforced en bucket policy (prod). Dev MinIO sirve sobre HTTP en `localhost:9000` — aceptable, marcado en docs. |
| TTL presigned PUT | 600 s (10 min) per ADR-012 §Presigned URLs (stricter que los 15 min de ADR-007 evidence). Env: `PDF_PRESIGN_UPLOAD_TTL_S=600`. |
| TTL presigned GET (founder) | 300 s (5 min) per ADR-012. Env: `PDF_PRESIGN_DOWNLOAD_TTL_S=300`. |
| TTL presigned GET (worker) | 120 s (2 min) per ADR-012. Env: `PDF_WORKER_PRESIGN_TTL_S=120`. Esta URL se entrega al microservicio Python — pero el handoff con HMAC es propiedad de **TASK-007**. |
| CORS | `PUT,GET,HEAD` permitidos desde `https://*.starteria.app` (prod) y `http://localhost:5173` (dev). Aplicada por script de bootstrap. |
| Bucket policy | Deny public ACL en todo el bucket. Deny PUT sin header SSE. Asserts cubiertos por test de CI (per ADR-012 §Testing). |
| Servicio MinIO en `docker-compose.dev.yml` | Imagen `minio/minio:RELEASE.2026-04-15Z`, puertos 9000/9001, volumen `minio-data`, healthcheck contra `/minio/health/live`, init container que crea bucket y CORS al primer arranque. |

El cliente vive en `backend/modules/storage/s3.client.ts` y expone `presignPut`, `presignGet`, `headObject`, `deleteObject`, `deleteObjects`. Es reutilizable por `evidence/` (que hasta hoy no lo tenía) y por `initiative-pdfs/`.

---

## Lifecycle (retención + sweeper)

Política exacta per ADR-012 §Retention and lifecycle:

| Día | Acción |
|---|---|
| 0 a 30 | Storage class `STANDARD`. El founder puede re-correr extracciones; la latencia de GET importa. |
| 31 a `retentionUntil` | Lifecycle rule de S3 transiciona a `STANDARD_IA`. |
| `retentionUntil` + 1 | Lifecycle rule programa `DELETE`. |
| Cada noche 03:00 (cohorte America/Lima) | `pdf-retention-sweeper` corre. Para cada `InitiativePdf` con `retentionUntil < now AND deletedAt IS NULL`: (a) emite `AuditLog: pdf.delete.scheduled`, (b) hace `DeleteObject` original + `DeleteObjects` derivados (idempotente — si lifecycle ya borró, S3 devuelve 204 igual), (c) `UPDATE` la fila con `deletedAt = now`, `status = 'purged'`, (d) `UPDATE PdfExtractionRun SET pdfContentPurged = true, extractedTextRef = null` donde `pdfId = ?`, (e) emite `AuditLog: pdf.delete.completed`. Las filas de `PdfFieldProposal` no se tocan. |

Implementación: `node-cron` con expresión `0 8 * * *` en UTC (= 03:00 GMT-5). Lock distribuido vía advisory lock de Postgres (`pg_try_advisory_lock(hashtext('pdf-retention-sweeper'))`) para sobrevivir a múltiples réplicas del Express.

---

## Integración con `ai-service`

Esta TASK monta el cliente HTTP en `backend/modules/initiative-pdfs/client.ts` con:

- Base URL en `AI_SERVICE_BASE_URL` (env).
- `POST /v1/pdf-extractions` para encolar el run.
- `GET /v1/pdf-extractions/:runId` (opcional — se prefiere polling local contra la fila `PdfExtractionRun` para no acoplar) **o** webhook entrante en `POST /api/v1/initiatives/internal/pdf-extractions/:runId/complete` autenticado por HMAC (TASK-007).

**Decisión de pull vs push:** preferimos polling local de la fila — Express marca `pending → running → completed` en respuesta a un webhook de finalización del worker. Frontend hace polling cada 2 s contra Express (endpoint 4), no contra el microservicio Python — Express es la única superficie pública. ADR-008 ya valida el patrón.

**El handshake completo (HMAC, request-id, retry-with-jitter, circuit breaker) es responsabilidad de TASK-007.** Esta TASK deja el cliente con un stub `signRequest(body): { headers, body }` que TASK-007 implementa. Mientras tanto el cliente en dev firma con un placeholder y rechaza arrancar si `NODE_ENV=production AND AI_SERVICE_HMAC_SECRET no está seteado`.

---

## PII detection placement (Stage A — owned here)

Stage A vive en `backend/modules/initiative-pdfs/pii-prescan.ts`. Es **lightweight, server-side, sin LLM, sin parseo de PDF**. Corre en `POST /pdfs` (endpoint 2) y bloquea la transición a `extraction_eligible` si dispara.

Detecciones V1 (todas regex / dictionary, sin libpostal aún):

| Patrón | Heurística |
|---|---|
| DNI peruano | `\b\d{8}\b` con check de no estar precedido por palabras como "página", "tel", "ruc" — si > 5 distintos en `fileName` → flag. |
| Email | RFC 5322-ish — si > 3 distintos en `fileName` → flag. |
| Teléfono PE / MX / AR | Prefijos comunes — si > 3 distintos → flag. |
| Filename giveaways | `cv|curriculum|resume|dni|pasaporte|payslip` substring case-insensitive → flag inmediata. |

**Importante**: Stage A V1 corre **solo sobre el `fileName`**. La página 1 text no está disponible — el parseo es de TASK-008. Esta es una limitación deliberada para no acoplar TASK-006 con un parser PDF. Se acepta el riesgo (ver §Riesgos R3) y se documenta como gap.

Stage B (Presidio en Python, recall ≥ 0.95 per PRD-002 US-015 acceptance band) corre en TASK-008 dentro del microservicio. Esta TASK provee el modelo donde Stage B persistirá su `pii-mask.json` (la fila `PdfExtractionRun.extractedTextRef` apunta al derivado, y el masking detail vive en S3, no en Prisma).

---

## Audit trail

Cada endpoint y cada acción del sweeper escribe a `AuditLog` (modelo existente, ADR-002). Esquema mínimo de cada entrada: `{ actorId, actorType, action, resourceType, resourceId, before, after, requestId, costUsd?, hash, prevHash }`. El hash chain ya existe (US-014 cobertura ≥ 0.999).

| Acción | Acción AuditLog | resourceType | before / after |
|---|---|---|---|
| `POST /pdfs/presign` | `pdf.presign.requested` | `InitiativePdf` | before: null; after: `{ pdfId, fileName, sizeBytes }` |
| `POST /pdfs` (confirm OK) | `pdf.upload.confirmed` | `InitiativePdf` | after añade `piiPreScanFlags`, `retentionUntil` |
| `POST /pdfs` (PII block) | `pdf.upload.pii_blocked` | `InitiativePdf` | after: `{ status: 'pii_blocked', flags: [...] }` |
| `POST /pdfs/:pdfId/extract` | `pdf.extraction.requested` | `PdfExtractionRun` | after: `{ runId, requestedStep, costEstimateUsd }` |
| Worker webhook complete | `pdf.extraction.completed` | `PdfExtractionRun` | after: `{ status, costUsd, modelVersion, proposalsCount }` |
| Worker webhook failed | `pdf.extraction.failed` | `PdfExtractionRun` | after: `{ status: 'failed', errorReason }` |
| `POST .../confirm` | `pdf.proposal.confirmed` | `PdfFieldProposal` | before: `{ status: 'pending', proposedValue }`; after: `{ status: 'confirmed', finalValue }` |
| `POST .../edit` | `pdf.proposal.edited` | `PdfFieldProposal` | before idem; after: `{ status: 'edited', finalValue }` |
| `DELETE .../:fieldPath` | `pdf.proposal.discarded` | `PdfFieldProposal` | after: `{ status: 'discarded' }` |
| Sweeper schedule | `pdf.delete.scheduled` | `InitiativePdf` | reason: `retention_expired` |
| Sweeper complete | `pdf.delete.completed` | `InitiativePdf` | derivedKeysDeleted: int |
| Founder extends retention (futuro, fuera de los 8 endpoints) | `pdf.retention.extended` | `InitiativePdf` | before/after `retentionUntil` |

`costUsd` se suma desde `pdf.extraction.completed` al rollup mensual por proyecto que alimenta el guard de US-013 en el endpoint 3.

---

## Tests

### Unit

| Archivo | Cubre |
|---|---|
| `backend/__tests__/modules/storage/s3.client.test.ts` | Generación de URL presigned, headers SSE, expiración. Mocks de `@aws-sdk` con `aws-sdk-client-mock`. |
| `backend/__tests__/modules/initiative-pdfs/pii-prescan.test.ts` | Casos positivos (DNI x6 en filename, archivo `dni-scan.pdf`) y negativos (filename limpio). |
| `backend/__tests__/modules/initiative-pdfs/repository.test.ts` | Constraints: 11vo PDF activo es rechazado, `retentionUntil` respeta min/max. |
| `backend/__tests__/modules/initiative-pdfs/service.test.ts` | Lógica de transición de status, cascade de purge, guard de cost ceiling, escritura a step_data en confirm/edit. |
| `backend/__tests__/modules/initiative-pdfs/retention-sweeper.test.ts` | El sweeper procesa, marca `deletedAt`, escribe AuditLog, es idempotente, respeta el lock. |

### Integration

| Archivo | Cubre |
|---|---|
| `backend/__tests__/modules/initiative-pdfs/initiative-pdfs.integration.test.ts` | Suite end-to-end contra Postgres real + MinIO real (CI service container). Cubre los 8 endpoints. |

### Acceptance criteria mapeados a PRD-002

| AC | Endpoints / código | PRD-002 US |
|---|---|---|
| AC-001 | `POST /pdfs/presign` + `POST /pdfs` round-trip 50 MB en MinIO < 8 s P95; rechazo de mime no-PDF / > 50 MB / > 10 archivos | US-001 |
| AC-002 | `POST /pdfs/:pdfId/extract` solo se acepta en estado correcto; `?extract=true` también respeta el estado | US-003 a US-007 |
| AC-003 | `POST .../confirm` y `POST .../edit` escriben `step_data` y solo entonces el campo es autoritativo | US-009 |
| AC-004 | `project.service.transitionTo('esperando_revision')` rechaza con `code: AUTOFILL_PROPOSALS_PENDING` si hay propuestas `pending` | US-017 |
| AC-005 | Tabla `AuditLog` muestra ≥ 0.999 cobertura sobre escenario sintético de 1000 acciones | US-014 |
| AC-006 | `POST /pdfs/:pdfId/extract` rechaza con `code: COST_CEILING_REACHED` cuando rollup ≥ $150 USD en mes | US-013 |
| AC-007 | Stage A bloquea archivos con filename `dni-*.pdf` y > 5 emails en filename con `code: PDF_PII_BLOCKED` | US-015 (parcial; recall completo es TASK-008) |

### Definition of Done

- Los 8 endpoints listados devuelven envelope ADR-010 en cada path de error.
- Round-trip MinIO local de PDF de 50 MB completa en < 8 s P95 con red local sin contención.
- Migración Prisma forward (`npx prisma migrate dev`) y backward (`prisma migrate reset` con seed) ejecuta limpio en CI 3 veces consecutivas sin warnings.
- Sweeper corre en CI contra base de prueba con 5 PDFs vencidos y limpia los 5 + emite 5 + 5 `AuditLog` (scheduled + completed).
- Cobertura de unit tests del módulo `initiative-pdfs/` ≥ 0.85 lines / ≥ 0.80 branches.
- `npm run lint`, `npm run build`, `npx prisma format` salen con 0 errores.
- `docker-compose.dev.yml` con servicio MinIO documentado en `backend/README.md` (sección de dev setup).
- Variables nuevas (`S3_PDF_KMS_KEY_ALIAS`, `PDF_RETENTION_DEFAULT_DAYS`, `PDF_RETENTION_MAX_DAYS`, `PDF_PRESIGN_UPLOAD_TTL_S`, `PDF_PRESIGN_DOWNLOAD_TTL_S`, `PDF_WORKER_PRESIGN_TTL_S`, `PDF_MAX_PER_INITIATIVE`, `PDF_MAX_BYTES`, `PDF_MAX_PAGES`, `AI_SERVICE_BASE_URL`) presentes en `.env.example` con descripciones.
- PR abierto (no mergeado) con título `feat(TASK-006): backend PDF storage + extraction route`.
- `project/.sdlc/knowledge/progress-TASK-006-2026-MM-DD.md` escrito.
- No se tocan archivos fuera del scope listado.
- **Hand-offs documentados**: el cliente HTTP a `ai-service` deja un TODO claramente comentado para TASK-007; el modelo `PdfExtractionRun` deja `extractedTextRef` listo para que TASK-008 lo escriba; los DTOs de proposals quedan exportados desde `backend/modules/initiative-pdfs/index.ts` para que TASK-009 los consuma.

---

## Estimación

| Fase | Trabajo | Duración |
|---|---|---|
| A | Implementación de ADR-007: cliente S3, MinIO en docker-compose, CORS, bucket policy, cableado del módulo `evidence/` al cliente nuevo, smoke test de round-trip | 3 días |
| B | Modelos Prisma (`InitiativePdf`, `PdfExtractionRun`, `PdfFieldProposal`) + migración forward/backward + seeds de dev | 1 día |
| C | Endpoints (8) + Zod schemas + middleware de auth/role + servicio + repository + Stage A PII pre-scan + cliente stub al ai-service + sweeper de retención + guard de transición de project state | 3 días |
| D | Tests unitarios e integración + observabilidad (logging estructurado por `requestId`, contadores Prometheus stub para errores 4xx/5xx por endpoint) + actualización de OpenAPI | 1 día |
| **Total** | | **8 días** |

Esta es la estimación que viaja en el frontmatter (`estimate: 8d`). Cualquier desvío > 1 día se reporta antes de cerrar la TASK.

---

## Riesgos

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | **Sorpresa de costo S3 en prod** — un cohort piloto sube los 10 PDFs × 50 MB × 100 founders y el bill mensual sale del rango "negligible" de ADR-012 ($0.63/cohorte) por un mal lifecycle (transition rule no se aplica, todo queda en STANDARD). | Media | Medio | Test de CI que parsea la lifecycle policy del bucket y assertea las dos reglas. Alarma CloudWatch en bytes-bajo-STANDARD por encima de un umbral por cohorte. Documentado para que TASK-009 ponga un counter visible al admin. |
| R2 | **Race condition en el sweeper** — dos réplicas de Express arrancan el sweeper simultáneamente, hacen `DeleteObject` dobles y dejan filas `InitiativePdf` con `deletedAt` desfasado del estado real en S3, o peor, intentan borrar un PDF que el founder acaba de extender la retención. | Media | Alto | Advisory lock de Postgres por nombre del job (`pg_try_advisory_lock`). Read-then-write transaccional con `SELECT ... FOR UPDATE` sobre cada fila. Las extensiones de retención (endpoint futuro) re-validan `retentionUntil > now` antes de cualquier DeleteObject. |
| R3 | **Stage A V1 muerde la mano que da de comer** — solo escanea filename, sin parsear el PDF. Un founder sube `Plan-2026-final.pdf` que internamente es un escaneo de DNIs y pasa Stage A; luego TASK-008 detecta PII en Stage B pero entretanto la URL prefirmada y el run ya están encolados. | Alta | Medio | Stage A no es Stage B y eso queda documentado en el copy del UI (TASK-009). El run sin completar no es leak — Stage B (TASK-008) enmascara antes del LLM. Cost ya está protegido por el ceiling de US-013. Para la próxima iteración (post-MVP) Stage A se extiende a leer la primera página del PDF con `pdf-parse` (Node-only, sin LLM). |
| R4 | **HEAD a S3 en `/pdfs` confirma agrega latencia** — el budget P95 < 600 ms se rompe si MinIO está bajo carga o si S3 prod tiene cold-start de la región. | Baja | Bajo | El HEAD es opcional en dev (toggle por env `PDF_CONFIRM_HEAD_CHECK=true/false`); en prod se mantiene con `s3.headObject` con `ExpiresIn: 5`. Si latencia > 600 ms en 3 muestras consecutivas, el sistema cae al modo "trust-but-verify-later" donde un job de reconciliación 5 min después verifica que el objeto realmente existe. |
| R5 | **Migración Prisma colisiona con cambios en `Project`** — TASK-000 modificó `Project.lastPosition`; si TASK-006 corre la migración antes de un fast-forward, los FK de `PdfExtractionRun.projectId` pueden no compilar. | Baja | Bajo | Se hace `git pull` al inicio de Fase B y se chequea `prisma migrate status` antes de generar la nueva migración. La migración usa nombres únicos con fecha (`2026MMDD_initiative_pdfs`). |

---

*Task generada siguiendo BHIL AI-First Development Toolkit. Mirror de TASK-000 y TASK-005 en estructura. Hand-offs explícitos: TASK-007 (HMAC), TASK-008 (extractor + Stage B PII), TASK-009 (frontend dropzone + revisión).*
