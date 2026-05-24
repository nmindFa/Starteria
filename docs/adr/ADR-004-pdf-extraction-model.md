---
id: ADR-004
title: "Selección de modelo y estrategia de extracción para auto-rellenado desde PDFs"
status: proposed
type: model-selection
date: 2026-05-17
decision_makers: [Architecture Agent (Swarm)]
related_prds: [PRD-002]
related_specs: []
sprint: S-02
review_trigger: "2026-Q4 o al alcanzar 80% del techo mensual de cohorte"
tags: [llm, model-selection, pdf-extraction, structured-output, cost, latency]
---

# ADR-004: Selección de modelo y estrategia de extracción para auto-rellenado desde PDFs

## Context and problem statement

PRD-002 introduce el worker `pdf_extractor` que convierte el texto de PDFs cargados por el founder (planes de negocio, investigaciones, transcripciones, reportes) en propuestas estructuradas para los campos de Steps 0-4 (onboarding, problema, oportunidad, experimento, resultados, storytelling). El feature debe operar bajo techos duros de costo (≤ $0.30/upload, ≤ $1.50/iniciativa/mes, ≤ $150/cohorte/mes), latencia (parseo P95 ≤ 30s para 50pp; extracción P95 ≤ 20s por Step) y calidad (precisión por campo ≥ 0.80, recall ≥ 0.70, alucinaciones ≤ 0.03). Hoy los agentes del stack usan `openrouter:qwen/qwen3.6-flash` con JSON-in-prompt + validación Pydantic, lo que ofrece un baseline barato pero no ha sido evaluado contra tareas de extracción multi-página con provenance por campo.

**Decision question:** Qué modelo LLM y qué estrategia de extracción (parseo, chunking, structured output, especialización por Step) debe usar el worker `pdf_extractor` para cumplir los umbrales de calidad de PRD-002 sin exceder los techos de costo y latencia?

---

## Decision drivers

- **Quality:** Precisión por campo ≥ 0.80, recall ≥ 0.70, alucinaciones ≤ 0.03 sobre el gold set de PRD-002 (50 PDFs anotados mix es/en). Calibración de confianza Pearson ≥ 0.65 entre score y acierto. Conformidad de schema de output ≥ 0.98.
- **Latency:** Parseo P95 ≤ 30s para PDFs hasta 50pp; ≤ 90s para 50-150pp. Extracción de un Step completo P95 ≤ 20s. Soporte de 50 cargas concurrentes sin degradación P95.
- **Cost:** Techo de $0.30/upload (parseo + extracción de todos los Steps relevantes), $1.50/iniciativa/mes, $150/cohorte de 100 iniciativas/mes. Implica costo medio efectivo ≤ $0.25/upload asumiendo ≤ 5 uploads/iniciativa/mes.
- **Context size:** PDFs hasta 200 páginas (≈ 80K-120K tokens en español equivalente). El modelo o la estrategia de chunking debe acomodar documentos > 100K tokens sin perder provenance página-a-página.
- **Privacy:** Datos potencialmente con PII (nombres, correos, teléfonos, DNI). Requisito de zero-data-retention con el proveedor de API y enmascarado pre-envío (US-015).
- **Reliability + fallback:** ≥ 99.0% uptime en horario de negocio. Fallback chain obligatorio: extractor primario → modelo más barato → degradación a "sin propuesta" con motivo registrado (no inventar valores).

---

## Candidates evaluated

| Modelo | Provider | Context window | Input ($/1M) | Output ($/1M) | Latencia P95 típica | Native PDF support | Structured output nativo |
|---|---|---|---|---|---|---|---|
| Claude Sonnet 4 | Anthropic | 200K | $3.00 | $15.00 | 1,200ms | Sí (Files API + native PDF input) | Tool use / function calling |
| Claude Haiku 4.5 | Anthropic | 200K | $0.80 | $4.00 | 400ms | Sí (Files API + native PDF input) | Tool use / function calling |
| GPT-4o | OpenAI | 128K | $2.50 | $10.00 | 1,500ms | No (requiere parseo previo) | JSON mode + function calling |
| GPT-4o-mini | OpenAI | 128K | $0.15 | $0.60 | 800ms | No (requiere parseo previo) | JSON mode + function calling |
| Gemini 1.5 Pro | Google | 1M | $1.25 | $5.00 | 2,000ms | Sí (multimodal con páginas como imagen) | Controlled generation (schema) |
| Gemini 1.5 Flash | Google | 1M | $0.075 | $0.30 | 900ms | Sí (multimodal con páginas como imagen) | Controlled generation (schema) |
| Qwen 3.6 Flash (baseline actual) | OpenRouter | 128K | $0.18 | $0.54 | 1,100ms | No (requiere parseo previo) | JSON-in-prompt + regex extract |

---

## Evaluation methodology

- **Gold set propuesto:** `evals/golden/starteria-pdf-extraction-eval.jsonl` (a crear como parte de SPEC-002). N=50 PDFs anotados (25 español, 25 inglés), distribución: 30% planes de negocio, 30% investigaciones/entrevistas, 20% reportes/métricas, 20% mixtos. Anotación por campo con valor esperado, página origen y extracto canónico.
- **Métricas comparadas:** precisión por campo (campos correctos / campos extraídos), recall por campo (campos detectados / campos presentes), tasa de alucinaciones (campos con valor sin respaldo en PDF, vía LLM-judge con PDF como ground truth), calibración de confianza (Pearson score vs. acierto sobre 200 propuestas), latencia P95 wall-clock por Step, costo efectivo por upload (parse + extract para Steps 0-4).
- **Temperature:** 0.1 fija para todos los candidatos (priorizando determinismo en extracción factual).
- **Prompt:** estrategia idéntica entre candidatos para comparabilidad — system prompt + 2-shot por Step (siguiendo ADR-003) + bloque de contexto + chunk de PDF.
- **Eval method:** LLM-as-judge (Claude Sonnet) sobre conformidad de schema y verificación de provenance + revisión humana sobre 15 casos críticos (mixtos es/en con PII y métricas numéricas).

---

## Evaluation results

| Modelo | Precisión campo | Recall campo | Alucinaciones | Latencia P95 (Step) | Costo/upload (avg) | Schema compliance |
|---|---|---|---|---|---|---|
| Claude Sonnet 4 | TBD — pending eval run | TBD | TBD | TBD | TBD | TBD |
| Claude Haiku 4.5 | TBD — pending eval run | TBD | TBD | TBD | TBD | TBD |
| GPT-4o | TBD — pending eval run | TBD | TBD | TBD | TBD | TBD |
| GPT-4o-mini | TBD — pending eval run | TBD | TBD | TBD | TBD | TBD |
| Gemini 1.5 Flash | TBD — pending eval run | TBD | TBD | TBD | TBD | TBD |
| Qwen 3.6 Flash (baseline) | TBD — pending eval run | TBD | TBD | TBD | TBD | TBD |

> El eval suite vive en `evals/golden/starteria-pdf-extraction-eval.jsonl` (a crear con SPEC-002). Esta tabla se actualiza tras el primer run de la suite y la ADR transita a `accepted` cuando los umbrales se cumplen contra la combinación recomendada en la sección Decision.

### Failure modes esperados (a verificar en eval)

| Modelo | Modo de falla anticipado | Frecuencia esperada | Impacto |
|---|---|---|---|
| Claude Haiku 4.5 | Sub-extracción en chunks con tablas densas (números pegados al texto narrativo) | 8-12% de chunks con tablas | Medium — mitigado por overlap de 400 tokens y validación de calibración |
| Claude Sonnet 4 | Verbosidad en extractos citados que excede 280 chars de US-008 | 6% de propuestas | Low — truncamiento controlado en post-procesamiento |
| Gemini 1.5 Flash | Drift de página en provenance cuando se procesan páginas como imagen | 5-10% de provenance | Medium — usar solo en fallback, no como primario |
| GPT-4o-mini | Schema compliance < 0.95 en JSON mode con campos opcionales (questions, contradictions) | 10-15% | High — descalifica como primario |
| Qwen 3.6 Flash | Mezcla de idiomas en outputs cuando input es es/en mixto | 12% | Medium — incompatible con US-016 |

---

## Decision

**Combinación recomendada (capa por capa):**

1. **Parsing layer (texto + posición por página):** `pypdf` + `pdfplumber` como librerías deterministas para extraer la capa de texto con bounding boxes y número de página por bloque. No se ejecuta OCR sobre imágenes puras — PRD-002 los declara fuera de scope (US-002, out-of-scope). Para PDFs detectados como imagen pura (heurística: < 50 caracteres extraíbles en ≥ 80% de las páginas) se aborta con motivo `cobertura_insuficiente`.
2. **Chunking strategy:** chunks por página con merging adyacente hasta un máximo de 6,000 tokens por chunk y overlap de 400 tokens entre chunks contiguos. Cada chunk retiene metadatos `{file_id, page_start, page_end}` para provenance exacta. Esta estrategia mantiene fidelidad de página y permite que documentos de 200 páginas se procesen en ~25-35 chunks sin saturar el context window del extractor.
3. **Extractor model (primary):** **Claude Haiku 4.5** vía Anthropic API con zero-data-retention. Justificación: (a) input cost de $0.80/1M permite procesar un PDF de 50pp (~40K tokens de input efectivo) por ≈ $0.032 + output ≈ $0.020 = $0.052/Step; con 5 Steps relevantes promedio = $0.26/upload, dentro del techo $0.30. (b) Soporte nativo de PDF en Files API elimina latencia de parseo intermedio. (c) Latencia P95 de 400ms por chunk permite cumplir extracción P95 ≤ 20s por Step incluso con 25 chunks paralelizados de a 5.
4. **Structured output mechanism:** **Function calling nativo (tool use)** con un schema Pydantic por Step convertido a JSON Schema. Razón: (a) Anthropic tool use garantiza conformidad ≥ 98% sin retry, superando JSON-in-prompt + regex extract (baseline Qwen) cuyo schema compliance se midió en 85% en ADR-003. (b) Pydantic con `with_structured_output` permite reutilizar el modelo de datos del backend para validación end-to-end. (c) Elimina el regex extract pattern que es frágil ante variaciones de wrapping en español.
5. **Per-step specialist vs. generalist:** **Generalista único con prompt switching por Step.** Razón: el routing por Step ya lo hace el Orchestrator (ADR-002), y el costo de mantener 5 fine-tuned prompts especializados (Step 0-4) supera el beneficio cuando el modelo subyacente es el mismo. Se reserva la opción de especialistas si el eval muestra que un Step específico cae bajo umbral (≥ 0.10 absoluto de diferencia frente al promedio).
6. **Fallback chain:** Haiku 4.5 (timeout 15s/chunk, 2 retries con temp 0) → Gemini 1.5 Flash (provider redundante, mismo schema) → degradación a "sin propuesta" con motivo `extractor_unavailable` registrado en provenance (US-012). Nunca se inventa un valor para mantener tasa de alucinaciones ≤ 0.03.

**Costo estimado por upload promedio (50pp, 5 Steps relevantes):** ≈ $0.26 USD (parse $0 + 5 × extract $0.052), dentro del techo PRD-002 de $0.30/upload.

**Latencia estimada (50pp):** parseo ≈ 8s P95 (pypdf+pdfplumber sobre 50 páginas), extracción por Step ≈ 12-18s P95 (25 chunks, paralelismo 5, Haiku P95 400ms/chunk + overhead de tool use), dentro del techo PRD-002.

---

## Configuration

### Extractor primario (Haiku 4.5)

```yaml
model: "claude-haiku-4-5-20260401"
temperature: 0.1
max_tokens: 1536
top_p: 0.9
stop_sequences: []
stream: false

# Structured output
tool_choice: { type: "tool", name: "propose_step_fields" }
response_schema: "pydantic://ai_service.pdf_extractor.schemas.StepProposal"

# Cost + latency controls
max_retries: 2
retry_backoff_ms: [1000, 3000]
timeout_ms_per_chunk: 15000
timeout_ms_per_step: 20000
max_parallel_chunks: 5
fallback_model: "gemini-1.5-flash-001"

# Privacy
zero_data_retention: true
pii_masking: pre_send_required
```

### Chunker

```yaml
parser: "pypdf+pdfplumber"
max_tokens_per_chunk: 6000
overlap_tokens: 400
preserve_page_metadata: true
abort_on_image_only_pdf: true
image_only_threshold_chars_per_page: 50
image_only_threshold_pages_ratio: 0.80
```

### Cost tracker

```yaml
ceilings:
  per_upload_usd: 0.30
  per_initiative_per_month_usd: 1.50
  per_cohort_per_month_usd: 150.00
alerts:
  cohort_warning_pct: 80
  cohort_block_pct: 100
metrics:
  - starteria_ai_pdf_cost_usd_total{initiative, cohort}
  - starteria_ai_pdf_extract_latency_seconds{step, model}
  - starteria_ai_pdf_extract_fallback_total{from_model, to_model}
```

---

## Acceptance criteria for this decision

- [ ] Eval suite `evals/golden/starteria-pdf-extraction-eval.jsonl` ejecuta en CI con precisión por campo ≥ 0.80, recall ≥ 0.70, alucinaciones ≤ 0.03 sobre los 50 PDFs.
- [ ] Schema compliance ≥ 0.98 medido sobre 200 propuestas en eval (tool use nativo de Anthropic).
- [ ] Calibración de confianza Pearson ≥ 0.65 sobre 200 propuestas.
- [ ] P95 latencia: parseo ≤ 30s para 50pp; extracción por Step ≤ 20s en muestra de tráfico (50 cargas concurrentes simuladas).
- [ ] Costo medio por upload ≤ $0.26 USD verificado en producción durante 2 semanas consecutivas; sin uploads que excedan $0.30.
- [ ] Fallback chain Haiku → Gemini 1.5 Flash → "sin propuesta" testeada en chaos test con 30 fallas inyectadas.
- [ ] Zero-data-retention confirmado por contrato con Anthropic y Google para los modelos usados.
- [ ] Recall de PII masking ≥ 0.95 sobre 100 PDFs con PII inyectada antes de cualquier deploy a producción.

---

## Consequences

**Positive:**
- Costo de $0.26/upload deja margen del 13% frente al techo $0.30 para absorber picos de tamaño o reintentos sin disparar el circuit breaker.
- Function calling nativo eleva schema compliance esperado a ≥ 0.98 (vs. 0.85 con JSON-in-prompt baseline), reduciendo retries y errores de UI por payloads malformados.
- Chunking con overlap 400 tokens preserva provenance página-a-página, habilitando el indicador visual de US-008 (PDF origen + página + extracto ≤ 280 chars).
- Haiku 4.5 ya está dentro del stack contractual de ADR-001 (mismo proveedor, mismo zero-data-retention), evitando un nuevo acuerdo de privacidad.
- Generalista único reduce superficie de prompts a mantener (1 system prompt + 5 few-shot files vs. 5 system prompts independientes).

**Negative:**
- Haiku 4.5 obtuvo 0.72 factuality en feedback formativo (ADR-001) — la extracción factual desde PDFs es una tarea distinta, pero el eval suite **debe** verificar que precisión por campo se mantenga ≥ 0.80 antes de promover a `accepted`. Si cae, se escala a Sonnet 4 como extractor primario con re-cálculo de costo (que sube a ≈ $0.70/upload y excede el techo, requiriendo replantear chunking).
- PDFs imagen pura quedan sin soporte (out-of-scope PRD-002). Esto impactará un porcentaje estimado < 10% de uploads y debe comunicarse con mensaje específico al founder (`idioma_no_soportado` o `cobertura_insuficiente`).
- Fallback a Gemini 1.5 Flash implica un segundo acuerdo de zero-data-retention con Google y duplica la superficie de auditoría de PII. Mitigación: enmascarado pre-envío idéntico en ambos proveedores.

**Neutral:**
- La estrategia generalista facilita migración a especialistas Step-por-Step más adelante sin rediseñar el worker — solo agregar prompts adicionales y un selector.
- El cost ceiling de $0.30/upload es ajustado: cualquier subida sostenida del precio de tokens de Haiku 4.5 dispararía un review (ver Mandatory review triggers).

---

## Alternatives considered

### Gemini 1.5 Pro como extractor primario
**Rejected because:** Context window de 1M tokens permitiría one-shot full-document sin chunking, pero el costo de input ($1.25/1M) y output ($5/1M) eleva el upload promedio a ≈ $0.42, excediendo el techo $0.30 de PRD-002 en un 40%. Adicionalmente, su latencia P95 de 2,000ms por llamada sobre 50pp completos comprime peligrosamente el budget de 20s/Step con cero margen para retries.

### GPT-4o con JSON mode + parseo externo
**Rejected because:** GPT-4o no soporta PDF nativamente, exigiendo una capa de parseo + re-tokenización que agrega 3-5s de latencia y consume ~15% adicional de tokens por verbosidad de JSON mode vs. tool use de Anthropic. El costo efectivo se estimó en $0.34/upload y la schema compliance histórica de JSON mode (≈ 0.94) es inferior al ≥ 0.98 de tool use nativo.

### Qwen 3.6 Flash (mantener baseline actual)
**Rejected because:** Aunque su costo ($0.18/$0.54 por 1M) es el más bajo, no expone PDF nativo y depende de JSON-in-prompt + regex extract (patrón actual del stack), cuyo schema compliance medido en ADR-003 fue 85% — incompatible con el ≥ 0.98 requerido para evitar fallas de UI en US-008/US-009. Adicionalmente, no hay acuerdo de zero-data-retention disponible vía OpenRouter para Qwen, lo que choca con el requisito de privacidad para PDFs con PII.

### One-shot full-document con Gemini 1.5 Pro
**Rejected because:** Procesar 200 páginas en una sola llamada destruye la provenance página-a-página (el modelo cita pero no garantiza el número de página exacto), incumpliendo US-008 que requiere página(s) referenciada(s) por campo. La estrategia de chunking con overlap es preferible aunque agregue ~15% de overhead de tokens.

### Per-step specialist sub-agents (5 extractores especializados)
**Rejected because:** El routing por Step ya lo hace el Orchestrator (ADR-002); especializar a nivel de modelo o prompt agrega 5x la superficie de mantenimiento de prompts (5 system prompts + 5 few-shot files + 5 ADR-003 entries) sin evidencia de que un único generalista no alcance los umbrales. Se reserva como path de escalamiento si el eval muestra brecha ≥ 0.10 absoluto en un Step específico.

---

## Compliance + cost guardrails

| Guardrail | Implementación | Trigger |
|---|---|---|
| Pre-flight cost estimate | Calcular tokens estimados de input (parseo previo) × pricing del modelo antes de invocar extractor | Si estimación > $0.30 para el upload, rechazar con mensaje `tamano_excede_techo` |
| Per-upload cost circuit breaker | Tracker en memoria por upload session; agrega input+output tokens × pricing tras cada chunk | Si acumulado ≥ $0.30, abortar Steps pendientes y retornar parcial con motivo `techo_upload_alcanzado` |
| Per-initiative monthly tracker | Suma de costUsd en AuditLog filtrado por initiativeId y mes natural | Al alcanzar $1.50/mes, rechazar nuevas extracciones para esa iniciativa (US-013); permitir uploads sin extract |
| Per-cohort monthly tracker | Suma de costUsd agregado por cohorteId y mes natural | Alerta operativa a 80% ($120). A 100% ($150) degradar a cola best-effort |
| Confidence floor | Score de confianza por campo < 0.60 | Omitir campo, registrar motivo `confianza_insuficiente` (US-012) — nunca inventar valor |
| PII masking pre-envío | Pasada de detector de PII sobre cada chunk antes de invocar API | Si recall de masking < 0.95 (verificado en CI), bloquear release |
| Fallback transitions | Cada transición Haiku → Gemini → "sin propuesta" se loggea en AuditLog | Métrica `starteria_ai_fallback_total{from_model, to_model}` (ver ADR-001) |
| Provenance integrity | Cada propuesta DEBE incluir `{file_id, page, excerpt ≤ 280 chars, confidence}` | Validación de schema rechaza propuestas sin provenance completo |

**Mandatory review triggers:**
- Costo mensual de cohorte excede $120 (80% del techo) por dos meses consecutivos.
- Precisión por campo cae bajo 0.80 tras una actualización del modelo Haiku 4.5.
- Tasa de alucinaciones supera 0.03 medida en propuestas de producción (sampling semanal de 50 propuestas).
- Anthropic libera nueva versión con mejora benchmark ≥ 15% o cambia pricing.
- Scheduled review: 2026-Q4.

---

## References

- **PRD que motiva la decisión:** PRD-002 — Auto-rellenado de Steps con extracción IA desde PDFs (`project/.sdlc/specs/PRD-002-pdf-autofill-agent.md`)
- **Modelos y stack base:** ADR-001 — Selección de modelos LLM para sistema multi-agente Starteria
- **Orquestación del worker `pdf_extractor`:** ADR-002 — Hierarchical Orchestrator-Worker con Hybrid Pipeline
- **Estrategia de prompts y few-shot por Step:** ADR-003 — Structured output con system prompts especializados
- **Backend bridge para invocación desde Node a `ai-service` Python:** ADR-011 (`backend/docs/adr/ADR-011-*`)
- **Modelo de datos Prisma extendido para PDFs y propuestas:** ADR-008 backend (`backend/docs/adr/ADR-008-*`)
- **Flujo de aprobación que la feature no debe romper:** `docs/diagrams/initiative-approval-flow.drawio`

---

*Template version 1.0 — BHIL AI-First Development Toolkit — [barryhurd.com](https://barryhurd.com)*
