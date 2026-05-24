---
id: TASK-008
title: "ai-service: pdf_extractor agent (producción) + endpoint"
status: ready
date: 2026-05-19
author: BHIL Tasks (Swarm)
parent: SPEC-002
sprint: S-02
estimate: 6d
adrs: [ADR-004, ADR-002, ADR-003, ADR-002-backend, ADR-008-backend]
depends_on: [TASK-007]
unblocks: [TASK-009]
spike_baseline:
  precision: 0.800
  recall: 0.772
  hallucination: 0.000
  provenance_accuracy: 0.964
  source: "ai-service/spikes/pdf_extractor/ (validated 2026-05-19)"
---

# TASK-008: pdf_extractor agent de producción + endpoint `POST /ai/pdf-extract`

## 1. Objetivo

Promover el spike validado `ai-service/spikes/pdf_extractor/` a un worker de producción `ai-service/agents/pdf_extractor.py`, registrado bajo el `OrchestratorAgent` (ADR-002) como ruta nueva `(step="*", action="pdf_extract")`, expuesto vía endpoint asíncrono `POST /ai/pdf-extract` + `GET /ai/pdf-extract/runs/:runId`. El worker debe reemplazar el modelo POC (DeepSeek v4 Flash + JSON-in-prompt) por la decisión de ADR-004 (Claude Haiku 4.5 + function calling con Pydantic `with_structured_output`), mantener DeepSeek como tier de fallback secundario, preservar el motor de prompts validado en el spike (precision 0.800, recall 0.772, hallucination 0.000, provenance 0.964 sobre el PDF de prueba) y agregar PII Stage B, cost enforcement por upload, y eval gate en CI.

## 2. Baseline del spike

Resultado del último run validado contra `evals/golden/pdf-extraction/test-iniciativa.ground-truth.json` (1 PDF, 14pp, español):

| Métrica | Spike (2026-05-19) | Threshold PRD-002 / ADR-004 | Margen |
|---|---|---|---|
| Precisión por campo | **0.800** | ≥ 0.80 | 0.000 (justo en el umbral) |
| Recall por campo | **0.772** | ≥ 0.70 | +0.072 |
| Tasa de alucinaciones | **0.000** | ≤ 0.03 | +0.030 |
| Provenance page accuracy | **0.964** | ≥ 0.90 | +0.064 |
| Schema compliance | n/a (JSON-in-prompt) | ≥ 0.98 (esperado con tool use) | TBD |
| Confidence calibration (Pearson) | no medido en spike | ≥ 0.65 | TBD |
| Latencia P95 / Step (DeepSeek) | ~9-14s | ≤ 20s | OK |
| Costo estimado / upload | ~$0.02 (DeepSeek) | ≤ $0.30 (Haiku) | OK |

**Caveat de muestra:** N=1 PDF. ADR-004 §5 exige N≥50 PDFs anotados (25 es + 25 en) antes de promover esta ADR a `accepted`. TASK-008 desbloquea el camino de producción pero condiciona el merge final a la expansión del gold set (Fase F, ver §16). El run inicial sirve como regression guard; la suite de N=50 se construye en paralelo y reemplaza el seed cuando esté lista.

## 3. Alcance

Lo que TASK-008 implementa en `ai-service`:

1. Promoción del spike a `agents/pdf_extractor.py` (consolidado) + módulos auxiliares `agents/pdf_extractor/` (parser, chunker, schemas, prompts).
2. Swap del extractor: DeepSeek v4 Flash + JSON-in-prompt → Claude Haiku 4.5 + Anthropic tool use + `with_structured_output` sobre los Pydantic models del spike.
3. Cadena de fallback de ADR-004: Haiku (primario) → Sonnet 4 (si confidence agregada < 0.55) → DeepSeek vía OpenRouter (sólo si Anthropic 5xx o circuit breaker abierto) → envelope `sin propuesta` con motivo registrado.
4. Endpoint asíncrono ADR-008: `POST /ai/pdf-extract` retorna `runId` + `status="pending"` inmediato; worker en background ejecuta extracción; `GET /ai/pdf-extract/runs/:runId` polea estado/resultado.
5. PII Stage B (full detector): redacción pre-LLM con detector autoritativo (presidio o regex+spaCy), con retención del original cifrado para la respuesta al backend.
6. Cost cap enforcement: header `X-Cost-Cap-USD` (default $0.30 de TASK-007) verificado pre-call con estimación de tokens; circuit breaker mid-run si el acumulado supera el cap; respuesta 402 cuando el cap es estructuralmente insuficiente.
7. Registro del worker en `OrchestratorAgent` (ADR-002 routing table): nueva ruta `(step="*", action="pdf_extract") → PdfExtractorAgent`.
8. Vector store: deferred a ADR-012 — TASK-008 NO usa pgvector ni AgentDB en runtime (el documento se procesa one-shot full-text como en el spike); se deja un hook explícito para retrieval cuando se escale a PDFs > 50pp.
9. Eval suite del spike (`scorer.py`, `evals/golden/pdf-extraction/`) integrada como CI gate en cualquier PR que toque `ai-service/agents/pdf_extractor*`.

## 4. Fuera de alcance

| Tema | Donde vive |
|---|---|
| Express bridge + HMAC inbound | TASK-007 (`backend/modules/ai-bridge/`) |
| Endpoints REST del backend Node (`POST /pdfs/uploads`, `POST /pdf-extractions`, `GET /pdf-extractions/:id`) | TASK-006 |
| Schema Prisma `pdf_extraction_runs`, `pdf_field_proposals`, `pdf_audit_log` | TASK-006 / backend ADR-008 |
| UI de revisión (overlay de provenance, aceptar/editar/rechazar) | TASK-009 |
| OCR para PDFs imagen-puros | Out-of-scope PRD-002 US-002; stub con motivo `cobertura_insuficiente` |
| Expansión del gold set N=50 a anotación humana 2x | Trabajo paralelo del equipo de evals; TASK-008 entrega solo el harness |
| ADR-012 (vector store production) | Decisión futura; TASK-008 documenta el hook |
| RAG por chunks para PDFs > 100pp | Diferido — Haiku 4.5 con 200K context maneja 50pp one-shot |

## 5. Promoción del código: mapping spike → producción

| Spike file | Producción | Qué se mantiene | Qué cambia |
|---|---|---|---|
| `spikes/pdf_extractor/parser.py` (97 LOC) | `agents/pdf_extractor/parser.py` | API `parse_pdf(path) -> list[PageBlock]`, fallback pypdf→pdfplumber, `detect_language` por stopwords | Acepta `BytesIO` además de `path` (entrada desde S3 stream vía TASK-007); umbral de pdfplumber fallback parametrizable |
| `spikes/pdf_extractor/schemas.py` (228 LOC) | `agents/pdf_extractor/schemas.py` | Todas las clases `Provenance`, `FieldProposal`, `Step{0..4}Extraction`, `InitiativeExtraction`, `ExtractionMetadata` | **Breaking vs. spike:** `Step3Extraction.testCycles` deja de ser `list[TestCycle]` plano y pasa a ser `Optional[FieldProposal]` cuyo `.value` es `list[TestCycle]` (uniformidad de wrapper FieldProposal en todas las listas-de-objetos). Ver §6. |
| `spikes/pdf_extractor/chunker.py` (117 LOC) | **No se promueve a producción** | — | Eliminado del path crítico; Haiku procesa el PDF one-shot (50pp ≈ 40K tokens, dentro de 200K context). El módulo se preserva en `experimental/` como referencia para cuando ADR-012 active el path RAG (PDFs > 100pp). |
| `spikes/pdf_extractor/extractor.py` (430 LOC, incluye prompts) | `agents/pdf_extractor/extractor.py` + `agents/pdf_extractor/prompts.py` | `_SYSTEM_PROMPT_ES`, `_SYSTEM_PROMPT_EN`, `_STEP_SCHEMAS` (con 12 hard rules y few-shot examples por Step) | Reemplaza `ChatOpenAI(base_url=openrouter)` por `ChatAnthropic(model="claude-haiku-4-5-20260401")` con `with_structured_output(StepNExtraction)`. Reemplaza `_extract_json` regex + `_tolerant_validate` peeling por validación nativa de tool use (Anthropic devuelve JSON ya conforme al schema). El `_tolerant_validate` se mantiene como **defensa secundaria** sólo para el fallback DeepSeek. |
| `spikes/pdf_extractor/scorer.py` (398 LOC) | `evals/runners/pdf_extraction_scorer.py` | Toda la lógica de match rules (`exact`, `enum`, `substring`, `list_overlap`, `freeform_long`, `numeric`), agregación de métricas, render `rich.Table`, `save_report` | Se mueve fuera de `agents/` porque es evaluation tooling, no runtime. Importable desde el CI gate. |
| `spikes/pdf_extractor/run.py` | `evals/runners/pdf_extraction_cli.py` | CLI con `--pdf`, `--ground-truth`, `--output` | Acepta `--model` (`haiku-4-5` por default, `deepseek-chat` para comparación) para correr el mismo PDF contra ambos modelos |
| `spikes/pdf_extractor/README.md` | Archivado en `docs/spikes/pdf_extractor-2026-05.md` | — | Se preserva como contexto histórico; el README del spike se borra cuando el directorio se elimina |

**Cleanup post-promoción:** una vez que `agents/pdf_extractor/` está en main y el primer eval CI pasa verde, el directorio `ai-service/spikes/pdf_extractor/` se elimina completo, incluyendo `pgvector` del `docker-compose.yml` (per spike README §Cleanup).

## 6. Schemas Pydantic finales — y el wrapper breaking change

Los 16 modelos del spike se promueven con un cambio de schema crítico:

| Modelo | Producción | Diff vs. spike |
|---|---|---|
| `Provenance` | igual | sin cambios |
| `FieldProposal` | igual | sin cambios |
| `Step0Extraction` | igual | sin cambios |
| `Step1AsisData`, `Step1CData`, `Step1Extraction` | iguales | sin cambios |
| `Step2TestCard`, `Step2Extraction` | iguales | sin cambios |
| `Step3Logistica`, `TestCycle`, `Step3Diagnostico` | iguales | sin cambios |
| `Step3Extraction` | **`testCycles: Optional[FieldProposal]`** | **BREAKING:** en el spike era `list[TestCycle]` plano en la raíz; ahora se envuelve en `FieldProposal` cuyo `.value` es la lista. Razón: uniformidad — todos los campos de tipo lista-de-objetos (`instrumentacion`, `implementationPlan`, `testCycles`) usan el mismo wrapper y por tanto la misma plantilla de provenance. Esto simplifica el prompt (regla 9 deja de tener una excepción) y elimina el bug recurrente del spike donde el LLM confundía a `testCycles` con los otros. |
| `PresentationContent`, `ImplementationPlanRow`, `Step4OrgContext`, `Step4Extraction` | iguales | sin cambios |
| `ExtractionMetadata` | + `cost_usd: float`, + `tokens_estimated_pre_call: int`, + `fallback_chain_used: list[str]`, + `pii_redactions: int` | el spike no medía estos campos; producción los expone para el cost tracker, el audit log y el control panel del founder |
| `InitiativeExtraction` | igual + `run_id: str`, + `pdf_file_key: str`, + `cost_cap_usd: float` | metadata de ejecución que TASK-007 inyecta vía bridge |
| **Nuevo:** `PdfExtractRequest` | `{ projectId: str, fileKey: str, language: Literal["es","en"] \| None, targetSteps: list[Literal[0,1,2,3,4]] \| None, costCapUsd: float \| None }` | request body del endpoint |
| **Nuevo:** `PdfExtractResponse` | `{ runId: str, status: Literal["pending","running","done","failed","cost_capped"], proposals: InitiativeExtraction \| None, error: ErrorEnvelope \| None }` | response del endpoint (sync para pending; full para done vía GET) |

**Migración del breaking change:** el spike-baseline scorer espera `step3.testCycles` como lista. Cuando se promueve, el scorer se actualiza simultáneamente para hacer `_coerce_value(step3.testCycles)` antes de iterar; el ground-truth JSON no cambia. Esto se entrega en el mismo PR para no romper el eval gate.

**Total de Pydantic models en producción:** 19 (16 promovidos + 3 nuevos: `PdfExtractRequest`, `PdfExtractResponse`, `ErrorEnvelope` reutilizado de TASK-007).

## 7. Prompt strategy definitiva

**Prompts promovidos exactos del spike** (no se reescriben):

- **`_SYSTEM_PROMPT_ES`** (líneas 43-63 de `spikes/pdf_extractor/extractor.py`): 12 reglas duras, incluyendo:
  - Contexto: "el PDF es típicamente una presentación EJECUTIVA COMPLETA"
  - Regla 1: omitir campos sin evidencia, proponer si evidencia parcial sintetizable
  - Regla 2: provenance como lista con `page`, `quote ≤280 chars literal`, `confidence`
  - Regla 3: `confidence ≥ 0.55` para proponer (vs 0.60 en EN; ADR-004 deja en 0.60 — TASK-008 alinea ambos en **0.60** para producción)
  - Regla 4: forma `{value, provenance, confidence}` envolviendo
  - Regla 6: un único JSON, sin markdown
  - Regla 7: campos de síntesis narrativa redactan en lugar de citar
  - Regla 8: enums EXACTAMENTE de las opciones declaradas
  - Regla 9: listas de objetos con value=lista completa (sin la excepción de testCycles)
  - Regla 10: incluir NÚMEROS, PORCENTAJES y MÉTRICAS en síntesis narrativa
  - Regla 11: preservar LABELS de bullets ("Capacidad Local: ...")
  - Regla 12: implementationPlan extrae TODAS las filas Gantt, no resúmenes
- **`_SYSTEM_PROMPT_EN`** (líneas 66-78): equivalente en inglés con `confidence ≥ 0.60` ya en producción
- **`_STEP_SCHEMAS`** (líneas 81-251): 5 entradas (`step0..step4`) cada una con:
  - `fields`: descriptores en lenguaje natural (8-13 campos por Step) con hints específicos (p.ej. `origen` ⇒ "si el deck habla de 'Reto' = 'problema'")
  - `context_hint` (Step 3 y Step 4): override de instrucción para casos típicos
  - `example`: 1-3 ejemplos few-shot por Step con la forma `FieldProposal` exacta esperada

**Ajuste de prompt único requerido para Haiku 4.5:**

Anthropic tool use elimina la necesidad de las reglas 4, 6 y la mayor parte de 9 (el wrapper FieldProposal y el formato JSON son enforced por el schema, no por el prompt). Estas reglas se mantienen en el system prompt como redundancia defensiva (cuestan ~80 tokens y endurecen el output del fallback DeepSeek). Las reglas 1, 2, 3, 5, 7, 8, 10, 11, 12 permanecen sin tocar — son la receta probada del spike y modificarlas invalida el baseline.

**Versión del prompt registry (PV-004):**
- `ai-service/prompts/v1/pdf-extractor-system-es.md`
- `ai-service/prompts/v1/pdf-extractor-system-en.md`
- `ai-service/prompts/v1/pdf-extractor-step{0..4}-schema.json`
- registrar en `backend/prompts/PROMPT-REGISTRY.md` siguiendo ADR-003 (freeze inmutable post-deploy)

## 8. Model selection (ADR-004) — cadena de fallback

Decisión primaria (ADR-004 §Decision): **Claude Haiku 4.5 + Anthropic tool use + Pydantic `with_structured_output`**.

```yaml
primary:
  model: "claude-haiku-4-5-20260401"
  provider: "anthropic"
  temperature: 0.1
  max_tokens: 1536
  tool_choice: { type: "tool", name: "propose_step_fields" }
  structured_output: "pydantic://agents.pdf_extractor.schemas.Step{N}Extraction"
  timeout_ms_per_step: 20000
  max_retries: 2
  retry_backoff_ms: [1000, 3000]
  zero_data_retention: true
```

**Árbol de decisión del fallback** (extracto pseudocódigo, ≤15 líneas):

```python
def extract_step_with_fallback(step: str, pdf_text: str, ctx: RunCtx) -> Step:
    try:                                                          # tier 1: Haiku + tool use
        proposal = haiku.with_structured_output(SCHEMAS[step]).invoke(prompt(step, pdf_text))
        if proposal.aggregate_confidence() >= 0.60: return proposal
        ctx.log_fallback("haiku→sonnet", reason="low_confidence")  # tier 2: Sonnet bump
        return sonnet.with_structured_output(SCHEMAS[step]).invoke(prompt(step, pdf_text))
    except AnthropicServerError:
        ctx.log_fallback("haiku→deepseek", reason="anthropic_5xx") # tier 3: DeepSeek + JSON-in-prompt
        raw = deepseek.invoke(prompt_with_legacy_rules(step, pdf_text))
        return tolerant_validate(SCHEMAS[step], raw)               # the spike's peeler
    except (TimeoutError, RateLimitError):
        ctx.log_fallback("haiku→none", reason="provider_unavailable")
        return SCHEMAS[step]()                                     # tier 4: empty envelope "sin propuesta"
```

**Justificación de la cadena:**
- Tier 1 (Haiku): ADR-004 baseline; $0.052/Step esperado; tool use garantiza schema compliance ≥ 0.98.
- Tier 2 (Sonnet): activado **sólo** cuando Haiku devuelve schema válido pero baja confianza agregada (< 0.60 sobre todos los `FieldProposal.confidence` del Step). Costo extra ≈ +$0.20/Step; aceptable porque el cap por upload de $0.30 ya incluye un buffer del 13% según ADR-004 §Consequences.
- Tier 3 (DeepSeek): activado **sólo** ante errores 5xx de Anthropic, no por baja confianza. Reutiliza la receta exacta del spike (JSON-in-prompt + Pydantic `tolerant_validate`) que ya tiene baseline conocido. Costo ≈ $0.02/Step.
- Tier 4 (envelope vacío): la propuesta queda sin valor, motivo `extractor_unavailable` se persiste en `extraction_metadata.fallback_chain_used` y se devuelve al backend, que muestra el motivo al founder vía UI (TASK-009).

**Nunca se inventa un valor** (PRD-002 US-007). El envelope vacío es preferible a una alucinación.

## 9. Async pattern (ADR-008)

El ciclo de vida de un extract no cabe en una respuesta HTTP síncrona (50pp ≈ 90-180s end-to-end con 5 Steps secuenciales o ~40s paralelizados pero aún por encima del timeout de proxies típico). Se implementa el patrón ADR-008 (async work + polling):

| Fase | Operación | Estado |
|---|---|---|
| 1 | `POST /ai/pdf-extract` recibe request, valida headers HMAC (TASK-007), valida payload, genera `runId = uuid4()` | retorna `200 { runId, status: "pending" }` inmediato (<200ms) |
| 2 | Worker en background (asyncio task o RQ/Celery según ADR-008 backend) inicia: parse → PII redact → extract Steps 0-4 → score confidence → write to disk | persiste estado en tabla Postgres `ai_extraction_runs` (schema owned by TASK-006) |
| 3 | El bridge polea `GET /ai/pdf-extract/runs/:runId` cada 2-5s | devuelve `{ status: "running", progress: 0.40 }` mientras corre |
| 4 | Worker completa: validate, sum tokens, calc cost, transition status | `{ status: "done", proposals: InitiativeExtraction, cost_usd: 0.27 }` |
| 5 | Bridge persiste a Prisma vía TASK-006 endpoint, devuelve a founder | — |
| 6 | Cleanup: TTL de 24h para runs `done`; runs `failed` retenidos 7d para debugging | cron job en `ai-service/jobs/cleanup_runs.py` |

**Persistencia:** TASK-008 escribe a `ai_extraction_runs` siguiendo el contrato Prisma que TASK-006 define. Columnas requeridas: `run_id`, `project_id`, `file_key`, `status`, `proposals` (jsonb), `cost_usd`, `tokens_in`, `tokens_out`, `error` (jsonb), `started_at`, `finished_at`, `expires_at`. TASK-008 declara el contrato (Pydantic models + SQL DDL hint) y TASK-006 implementa la migration.

**Timeouts y caducidad:**
- Run completo: P95 ≤ 90s para 50pp; hard timeout 180s. Más allá, se marca `failed` con `error.code = "RUN_TIMEOUT"`.
- Bridge polling: TASK-007 implementa el loop con backoff; TASK-008 sólo expone el endpoint.
- Caducidad de polls: si nadie polea durante 60s estando `done`, no se borra; sólo el TTL de 24h lo limpia.

## 10. PII redaction (Stage B)

**Stage A (TASK-006)** es un gate lightweight: regex para email, DNI, teléfono. Si encuentra hits y el usuario no opt-in, rechaza el upload con 422.

**Stage B (TASK-008)** es el detector autoritativo, corre **antes** de enviar contenido al LLM:

| Aspecto | Decisión |
|---|---|
| Detector | `microsoft/presidio-analyzer` + spaCy `es_core_news_lg` + `en_core_web_lg`; entidades: `PERSON`, `EMAIL_ADDRESS`, `PHONE_NUMBER`, `PE_DNI` (custom regex `\d{8}`), `PE_RUC`, `CREDIT_CARD`, `IBAN`, `LOCATION` (opt-in según política del proyecto) |
| Política de redacción | Reemplazo por placeholder estable `<PII:PERSON_1>`, `<PII:EMAIL_2>` (sufijo numérico por aparición única en el documento); el LLM no ve el valor original |
| Reverso | Mapeo `placeholder → original` se cifra con AES-GCM usando key por-proyecto; se retiene durante el run y se descarta tras persistir las `proposals`. Si una `quote` de provenance contiene un placeholder, queda redactada en la respuesta — el founder ve el placeholder y, en la UI de revisión (TASK-009), puede unredact con justificación auditada |
| Recall target | ≥ 0.95 sobre el set sintético de 100 PDFs con PII inyectada (ADR-004 §Acceptance criteria) |
| Telemetría | `extraction_metadata.pii_redactions: int` por run; métrica Prometheus `starteria_ai_pdf_pii_redactions_total{entity_type}` |
| Latencia | Stage B agrega ~1.5-3s para un PDF de 50pp (presidio + spaCy single-threaded). Se ejecuta en paralelo con la primera llamada de extract para no bloquear el budget de latencia |
| CI gate | Si recall < 0.95 sobre el set sintético, el deploy se bloquea (ADR-004 §Compliance guardrails) |

## 11. Cost enforcement

El header `X-Cost-Cap-USD` lo inyecta TASK-007 (bridge) con valor default `0.30` (PRD-002). TASK-008 lo enforce con tres anillos:

1. **Pre-call estimate (anillo externo):** antes de invocar Haiku, se estima `prompt_tokens_estimated = tokens(system) + tokens(few_shot) + tokens(pdf_text)` y `max_output_tokens = 1536 × 5_steps`. Costo proyectado = `(prompt_tokens × $0.80/1M × 5) + (max_output × $4.00/1M × 5)`. Si proyectado > `costCapUsd` × 0.95 (margen del 5% para overruns), se retorna **402 Payment Required** antes de tocar el LLM, con `error.code = "COST_CAP_INSUFFICIENT"` y `error.suggested_cap_usd` calculado.
2. **Mid-run circuit breaker (anillo medio):** entre Steps, el accumulator suma `cost_usd_so_far`. Si supera `costCapUsd × 0.95`, se aborta y se devuelven los Steps ya extraídos con `status = "cost_capped"`, `extraction_metadata.steps_completed = [0, 1, 2]` por ejemplo.
3. **Post-run accounting (anillo interno):** tras completar todos los Steps, se calcula el costo real `(input_tokens × price_in) + (output_tokens × price_out)` por modelo usado en la cadena de fallback (Haiku, Sonnet o DeepSeek) y se persiste en `cost_usd`. Reembolso conceptual: si `cost_usd < projected × 0.90`, el founder no consume el budget proyectado; sólo el real (importante para los techos mensual de iniciativa y cohorte de ADR-004 §Configuration).

**Métricas Prometheus emitidas (ADR-004 §Configuration):**
- `starteria_ai_pdf_cost_usd_total{initiative_id, cohort_id, model}`
- `starteria_ai_pdf_extract_latency_seconds{step, model}`
- `starteria_ai_pdf_extract_fallback_total{from_model, to_model, reason}`
- `starteria_ai_pdf_cost_cap_rejections_total{reason}`

## 12. Endpoint contract

### `POST /ai/pdf-extract`

**Headers consumidos (inyectados por TASK-007):**
- `Authorization: HMAC <signature>` — verificado contra `BRIDGE_HMAC_SECRET`
- `X-Cost-Cap-USD: 0.30` — cap por upload
- `X-Request-Id: <uuid>` — correlación con audit log
- `X-Initiative-Id: <uuid>` — para métricas y cap mensual
- `X-Cohort-Id: <uuid>` — para cap mensual cohorte

**Body** (`PdfExtractRequest`):
- `projectId` (uuid, required)
- `fileKey` (string, required) — clave en S3/MinIO (URL presigned generada por TASK-006)
- `language` (string `"es"|"en"`, optional) — si se omite, autodetect vía `parser.detect_language`
- `targetSteps` (list de enteros `0..4`, optional) — si se omite, extrae los 5; si se especifica, sólo esos (útil para re-extracción de un Step que el founder rechazó)
- `costCapUsd` (float, optional) — override del header (must be ≤ header value)

**Response 200** (sync, immediate):
- `runId` (uuid)
- `status` (`"pending"`)

**Response 402** (cost cap insuficiente, pre-call):
- `error` (`ErrorEnvelope`): `{ code: "COST_CAP_INSUFFICIENT", message: string, suggested_cap_usd: float }`

**Response 422** (PII gate violation, ya cubierto por Stage A, pero defensa en profundidad si se omitió):
- `error`: `{ code: "PII_BLOCKED", message: string, redactions_required: int }`

**Response 503** (todas las tiers de fallback fallaron pre-start):
- `error`: `{ code: "EXTRACTOR_UNAVAILABLE", message: string }`

### `GET /ai/pdf-extract/runs/:runId`

**Response 200** (en cualquier estado):
- `runId`, `status`, `proposals` (presente sólo si `status="done"` o `status="cost_capped"`), `error` (presente sólo si `status="failed"`), `progress` (float 0..1), `extraction_metadata`

**Response 404:** runId no existe o expiró (TTL 24h para done, 7d para failed).

**Response 410:** runId expirado (info conservada en audit log; el founder debe re-extract).

**Total de endpoints expuestos por TASK-008:** 2.

## 13. OrchestratorAgent integration

ADR-002 declara que el Orchestrator es la única puerta de entrada a los workers. TASK-008 extiende la routing table (PV-001, ADR-003) con:

```
Step "*" (any), action "pdf_extract" → pdf-extractor
```

El Orchestrator se invoca desde el endpoint `POST /ai/pdf-extract` con `action="pdf_extract"`. El context assembly (ADR-002 Tier 1) sigue siendo el mismo: `project` + `user` + `currentStep` (no aplica) + `currentModule` (no aplica). Tier 2 y 3 no se cargan — el PDF mismo provee todo el contexto.

**Cost ceiling check:** el Orchestrator verifica `costTracker.checkCeiling(projectId, additionalCost=costCapUsd)` antes de invocar al worker. Si la iniciativa ya consumió $1.50/mes (ADR-004 cap iniciativa), retorna 429 con `error.code = "INITIATIVE_BUDGET_EXCEEDED"`.

**Sanity check de routing:** un nuevo test del Orchestrator (`tests/unit/orchestrator_pdf_route.py`) verifica que para cualquier `step ∈ {0,1,2,3,4}` con `action="pdf_extract"`, `resolveAgent()` retorna `"pdf-extractor"`. Esto previene que el routing se rompa por una refactorización de la tabla.

## 14. Tests + Eval

### 14.1 Unit

| Archivo | Cobertura |
|---|---|
| `tests/unit/pdf_extractor/test_parser.py` | `parse_pdf` con PDF de texto, PDF imagen-puro (aborto correcto), PDF mixto; `detect_language` con 5 muestras es/en |
| `tests/unit/pdf_extractor/test_schemas.py` | `FieldProposal` valida con value=str/list/dict; `Step3Extraction.testCycles` ahora wrap correctamente; round-trip JSON ↔ Pydantic |
| `tests/unit/pdf_extractor/test_prompts.py` | Build de `_build_user_message` produce string que incluye los 9 (Step 0) / 12 (Step 1) campos esperados; el `example` JSON es parseable |
| `tests/unit/pdf_extractor/test_fallback.py` | Mock de Haiku raising `AnthropicServerError` → switchea a DeepSeek; baja confianza → Sonnet; todo falla → envelope vacío |
| `tests/unit/pdf_extractor/test_cost_enforcement.py` | Estimate retorna 402 cuando proyección > cap; mid-run breaker dispara con cap insuficiente; reembolso correcto cuando real < proyectado |
| `tests/unit/pdf_extractor/test_pii_stage_b.py` | Redact 10 entidades inyectadas; recall ≥ 0.95 sobre fixture; mapeo placeholder→original se cifra y descarta tras run |
| `tests/unit/pdf_extractor/test_orchestrator_route.py` | Nueva ruta `(step="*", action="pdf_extract")` resuelve a `pdf-extractor` para los 5 Steps |

### 14.2 Integration

| Archivo | Escenario |
|---|---|
| `tests/integration/pdf_extractor/test_endpoint_async.py` | POST → status pending → polling → status done con `proposals` completos contra `docs/Test - iniciativa.pdf`. Verifica métricas ≥ spike baseline (precisión ≥ 0.80, recall ≥ 0.70, hallucination ≤ 0.03, provenance ≥ 0.90) |
| `tests/integration/pdf_extractor/test_cost_cap.py` | POST con `X-Cost-Cap-USD: 0.05` (insuficiente) → 402 sin invocar LLM; con `0.30` → 200 + done |
| `tests/integration/pdf_extractor/test_fallback_chain.py` | Chaos test: inyectar 30 fallas (10 Haiku 5xx, 10 baja confianza, 10 timeouts) verificar que la cadena Haiku→Sonnet→DeepSeek→envelope sigue el árbol de §8 en cada caso |
| `tests/integration/pdf_extractor/test_image_only_pdf.py` | PDF imagen-puro → aborto con `status="failed"`, `error.code="COVERAGE_INSUFFICIENT"` |

### 14.3 CI gate (eval suite)

El workflow `.github/workflows/pdf-extractor-eval.yml` corre en todo PR que toque `ai-service/agents/pdf_extractor/**` o `ai-service/prompts/v1/pdf-extractor-*` o `evals/golden/pdf-extraction/**`:

```
1. Build ai-service container con tier 1 model fixed = haiku-4-5
2. Run evals/runners/pdf_extraction_cli.py contra cada PDF de evals/golden/pdf-extraction/
3. Compute deltas vs. baseline almacenado en evals/baselines/pdf-extraction-baseline.json
4. FAIL si:
   - precision regresa > 5% (baseline 0.800 → no menos de 0.760)
   - recall regresa > 5% (baseline 0.772 → no menos de 0.734)
   - hallucination > 0.03 absoluto
   - provenance regresa > 5% (baseline 0.964 → no menos de 0.916)
5. PASS y publica nuevo baseline si métricas iguales o mejores
```

### 14.4 Regression nightly

Cron nightly (`.github/workflows/pdf-extractor-nightly.yml`) corre la suite contra los N=50 PDFs cuando el gold set expandido esté listo (Fase F, ver §16). Alerta vía Slack `#ia-alerts` si cualquier métrica drift > 3% vs. baseline mensual.

## 15. Definition of Done

- [ ] **DoD-001:** `ai-service/agents/pdf_extractor/` existe con `parser.py`, `prompts.py`, `schemas.py`, `extractor.py`, `__init__.py`. Total ≤ 800 LOC (spike consolidado pesa 872; producción debe reducir vía eliminación de regex JSON fallback en el path Haiku).
- [ ] **DoD-002:** El worker invoca `claude-haiku-4-5-20260401` con `with_structured_output(Step{N}Extraction)` y NO incluye llamadas a OpenRouter en el happy path. DeepSeek vive solo en el módulo `fallback.py` y se carga lazy.
- [ ] **DoD-003:** `POST /ai/pdf-extract` y `GET /ai/pdf-extract/runs/:runId` responden a contratos en §12. Latencia del POST < 300ms P95. Status pending → done en ≤ 90s P95 para 50pp.
- [ ] **DoD-004:** El Orchestrator routea `action="pdf_extract"` al worker en los 5 Steps (test §14.1).
- [ ] **DoD-005:** PII Stage B con recall ≥ 0.95 sobre `evals/synthetic/pii-injection-100.jsonl` (set sintético construido en Fase D).
- [ ] **DoD-006:** Cost cap rechaza con 402 cuando insuficiente, abre circuit breaker mid-run, persiste cost real. Sin uploads con cost real > $0.30 en 20 ejecuciones de validación.
- [ ] **DoD-007:** Eval CI gate verde sobre `docs/Test - iniciativa.pdf` con precision ≥ 0.80, recall ≥ 0.70, hallucination ≤ 0.03, provenance ≥ 0.90.
- [ ] **DoD-008:** Spike directory `ai-service/spikes/pdf_extractor/` eliminado del tree; `pgvector` service eliminado de `docker-compose.yml`.
- [ ] **DoD-009:** PV-004 registrado en `backend/prompts/PROMPT-REGISTRY.md`. Prompts v1 inmutables.
- [ ] **DoD-010:** `progress-TASK-008-2026-05-XX.md` escrito con estado por fase A-F.
- [ ] **DoD-011:** `npm run lint`, `ruff check`, `mypy --strict ai-service/agents/pdf_extractor/` todos verdes; `pytest tests/{unit,integration}/pdf_extractor/` con 0 failures.

## 16. Estimación — 6 días, 6 fases

| Fase | Días | Entregable | Riesgo |
|---|---|---|---|
| A. Promote + restructure | 1d | spike code re-ubicado a `agents/pdf_extractor/`; schemas con el wrapper de `testCycles`; scorer movido a `evals/runners/`. Tests unit del spike portados. Eval CI corre verde con el path POC (DeepSeek) como guarda mientras se hace el swap. | Bajo — código ya validado |
| B. ADR-004 model swap (Haiku + tool use) | 1d | Reemplazo de ChatOpenAI por ChatAnthropic con `with_structured_output`. Prompts mantienen sus 12 reglas (defensa en profundidad). Eval CI debe pasar con Haiku con métricas ≥ spike baseline (delta ≤ 5%). | **Alto** — schema strictness de Haiku puede romper edge cases que DeepSeek toleraba (ver §17) |
| C. Async endpoint + persistencia | 1d | `POST/GET /ai/pdf-extract` con asyncio background task, persistencia a `ai_extraction_runs` (asume schema de TASK-006 disponible — coordinación con TASK-006 owner) | Medio — depende de que TASK-006 entregue la migration a tiempo |
| D. PII Stage B | 1d | presidio + spaCy + custom recognizers (PE_DNI, PE_RUC); cifrado del mapeo; eval suite sintético de 100 PDFs con recall ≥ 0.95 | Medio — latencia adicional, requiere benchmark |
| E. Eval CI integration + cost enforcement | 1d | Workflow YAML, baseline snapshot, threshold gates; cost cap rings (pre-call, mid-run, post-run) con tests de cada uno | Bajo |
| F. Regression suite N=50 expansion | 1d | Harness para correr nightly contra `evals/golden/pdf-extraction-n50/`; alertas Slack. **NB:** la anotación humana de los 49 PDFs adicionales es trabajo paralelo del equipo de evals — TASK-008 sólo entrega el runner y el placeholder de baseline. Hasta que N=50 esté completo, la nightly corre sobre N=1 con flag `--seed-only`. | Bajo — desacoplado de la anotación |

**Total:** 6 días de implementación; merge condicionado a Fase A-E verdes. Fase F entrega harness; ADR-004 transiciona de `proposed` a `accepted` cuando el equipo de evals complete N=50 y los thresholds se mantengan.

## 17. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **Haiku 4.5 strict schema rechaza outputs que DeepSeek toleraba** (especialmente listas vacías, `null` vs missing, enums case-mismatch) | Alta | Tier 2 Sonnet bump en baja confianza; defensa: mantener `_tolerant_validate` del spike sólo en el path DeepSeek; un día reservado para re-tune prompts en Fase B con A/B contra el PDF de prueba |
| **Cost cap falsos positivos rechazan uploads válidos** (estimación pre-call sobre-estima por few-shot examples grandes) | Media | Calibrar el factor de margen (default 0.95) con 20 runs reales; documentar ajuste en `docs/runbooks/pdf-extractor-cost-cap.md` |
| **Async poll timeouts del bridge causan UX degradada** (founder espera > 90s y el bridge le devuelve timeout aunque el run termine ok) | Media | TASK-007 implementa polling con backoff exponencial + cap a 3 minutos; TASK-008 expone `GET /runs/:runId` que puede consultarse después con `runId` cacheado en frontend |
| **PII detector latency vuela el budget P95 ≤ 90s** (presidio + spaCy en CPU para 50pp) | Media | Stage B corre en paralelo con la primera invocación de Haiku (Step 0), no en serie; benchmark en Fase D contra `docs/Test - iniciativa.pdf`; si > 3s, evaluar `presidio-analyzer` con `nlp_engine=transformers` y GPU |
| **N=1 baseline es estadísticamente insuficiente** y un cambio menor de prompt parece regresión en el seed pero no lo es en N=50 | Alta hasta Fase F | El delta-gate del CI (5% no absoluto) tolera ruido; nightly N=50 sobre-escribe el baseline mensual; la decisión de ADR-004 `proposed → accepted` se condiciona a N=50 explícitamente |
| **`testCycles` wrapper breaking change rompe el ground-truth scorer** (que asume lista plana) | Cierta | El PR de promoción actualiza scorer y ground-truth scorer-side de forma atómica; el ground-truth JSON no cambia (sigue siendo lista plana en disco), sólo cambia cómo se compara contra el `extraction.step3.testCycles.value` |
| **Anthropic 5xx sostenidos durante el día de demo** (Tier 1 cae a Tier 3 DeepSeek) | Baja | Cadena de fallback es transparente; métrica `fallback_total{to_model="deepseek"}` dispara alerta a 10% de runs en 1h; chaos test de Fase E valida que DeepSeek mantiene precision ≥ 0.70 (más bajo que Haiku pero usable como degradación) |
| **PII redactions afectan la calidad del extract** (un nombre de cliente reemplazado por `<PII:PERSON_1>` rompe la síntesis narrativa de `casoReal`) | Media | El placeholder es estable por documento — la síntesis puede referirse a `<PII:PERSON_1>` consistentemente; la UI de revisión (TASK-009) un-redacta para el founder con justificación; métrica `pii_redactions` monitorea volumen para detectar over-redaction |
