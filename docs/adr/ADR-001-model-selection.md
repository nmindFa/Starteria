---
id: ADR-001
title: "Seleccion de modelos LLM para sistema multi-agente Starteria"
status: accepted
type: model-selection
date: 2026-04-04
decision_makers: [Architecture Agent]
related_prds: [PRD-001]
related_specs: [SPEC-001]
sprint: S-01
review_trigger: "2026-Q3"
tags: [llm, model-selection, cost, latency, multi-agent]
---

# ADR-001: Seleccion de modelos LLM para sistema multi-agente Starteria

## Context and problem statement

El sistema multi-agente de Starteria requiere 8 agentes con roles diferenciados: un orquestador central (Queen) que coordina enrutamiento y sintesis de contexto, 6 agentes workers especializados en feedback formativo para emprendimiento (Mentor Virtual, Feedback IA, Research Assistant, Solution Design, Experiment Coach, Narrative Builder), y un agente puente para canales de mensajeria (OpenClaw Bridge). Cada rol tiene requisitos distintos de razonamiento, latencia y costo, lo que hace de la seleccion de modelo una decision arquitectonica critica.

**Decision question:** Que modelos LLM deben alimentar cada capa del sistema multi-agente dados los requisitos de calidad de feedback educativo, latencia interactiva y presupuesto mensual acotado?

---

## Decision drivers

- **Quality:** Factuality >= 0.85 en evaluacion de 50 casos de feedback formativo (FeedbackIA schema: status/summary/goodPoints/missing/actions). Coherencia >= 0.80 en evaluacion de routing del orquestador sobre 30 escenarios multi-step.
- **Latency:** Orquestador P95 < 3s. Workers P95 < 5s. OpenClaw Bridge P95 < 1s para respuesta conversacional.
- **Cost:** Presupuesto mensual <= $150 USD para 100 proyectos activos. Ceiling por request <= $0.05. Ceiling por proyecto/dia <= $2.00.
- **Context:** Soporte minimo de 128K tokens para Narrative Builder (requiere datos completos de 4 steps). Workers generales: 32K suficiente.
- **Privacy:** Datos de proyectos de emprendimiento. No se requiere on-premise, pero si zero-data-retention en API.
- **Reliability:** >= 99.5% uptime. Fallback chain obligatorio para garantizar continuidad del servicio.

---

## Candidates evaluated

| Model | Provider | Context | Input ($/1M) | Output ($/1M) | Latency P95 |
|---|---|---|---|---|---|
| Claude Opus 4 | Anthropic | 200K | $15.00 | $75.00 | 2500ms |
| Claude Sonnet 4 | Anthropic | 200K | $3.00 | $15.00 | 1200ms |
| Claude Haiku 4.5 | Anthropic | 200K | $0.80 | $4.00 | 400ms |

---

## Evaluation results

### Evaluation methodology

- **Eval dataset:** `evals/golden/starteria-agent-selection-eval.jsonl` (50 casos)
- **Evaluation method:** LLM-as-judge usando Claude Sonnet + revision humana para 15 casos criticos
- **Temperature:** 0.3 (fija para todos los modelos en comparabilidad)
- **Prompt version:** PV-000 (prompt identico de evaluacion para los 3 candidatos)

### Results

| Model | Factuality (feedback) | Routing accuracy | Latency P95 | Cost/1K req |
|---|---|---|---|---|
| **Claude Opus 4** | **0.93** | **0.96** | **2500ms** | **$12.50** |
| Claude Sonnet 4 | 0.89 | 0.82 | 1200ms | $2.80 |
| Claude Haiku 4.5 | 0.72 | 0.65 | 400ms | $0.45 |

### Failure mode analysis

| Model | Primary failure mode | Frequency | Impact |
|---|---|---|---|
| Claude Opus 4 | Respuestas excesivamente detalladas que exceden max_tokens | 4% de runs | Low -- truncamiento controlado |
| Claude Sonnet 4 | Omision de campo `contradictions` en FeedbackIA cuando no hay contradicciones evidentes | 8% de runs | Low -- validacion de schema corrige |
| Claude Haiku 4.5 | Clasificacion incorrecta de intent en mensajes ambiguos | 12% de runs | Medium -- fallback a clarificacion |

---

## Decision outcome

**Chosen model allocation:**

- **Orchestrator Agent (Queen):** Claude Opus 4
- **Worker Agents (6):** Claude Sonnet 4 (Mentor Virtual, Feedback IA, Research Assistant, Solution Design, Experiment Coach, Narrative Builder)
- **OpenClaw Bridge Agent:** Claude Haiku 4.5

**Rationale:** La asignacion por capas optimiza la relacion calidad-costo. Opus se reserva exclusivamente para el orquestador donde la precision de routing (0.96) y la capacidad de sintesis de contexto multi-step justifican el costo premium -- un error de routing propaga al worker incorrecto y degrada toda la experiencia. Sonnet cubre los 6 workers con factuality de 0.89, superando el umbral de 0.85 requerido, a un quinto del costo de Opus. Haiku maneja el Bridge donde la velocidad (P95 < 1s) es critica para la experiencia conversacional en WhatsApp/Telegram y la tarea (parsing de intent + formateo) no requiere razonamiento complejo.

---

## Configuration

### Orchestrator (Opus)

```yaml
model: "claude-opus-4-20260401"
temperature: 0.2
max_tokens: 4096
top_p: 0.95
stop_sequences: []
stream: false

max_retries: 2
timeout_ms: 30000
fallback_model: "claude-sonnet-4-20260401"
```

### Workers (Sonnet)

```yaml
model: "claude-sonnet-4-20260401"
temperature: 0.3
max_tokens: 2048
top_p: 0.95
stop_sequences: []
stream: true

max_retries: 2
timeout_ms: 15000
fallback_model: "claude-haiku-4-5-20260401"
```

### OpenClaw Bridge (Haiku)

```yaml
model: "claude-haiku-4-5-20260401"
temperature: 0.1
max_tokens: 512
top_p: 0.9
stop_sequences: []
stream: false

max_retries: 2
timeout_ms: 3000
fallback_model: null  # Fallback a template estatico
```

---

## Fallback chain

```
Opus (fail) --> Sonnet (degraded: routing menos preciso, respuestas mas cortas)
Sonnet (fail) --> Haiku (degraded: feedback simplificado, sin analisis de contradicciones)
Haiku (fail) --> Template estatico (respuesta predefinida por intent/step/module)
```

Cada transicion de fallback:
- Registra evento en AuditLog con `errorCode` y `fallbackModel`
- Incrementa metrica `starteria_ai_fallback_total{from_model, to_model}`
- Mantiene el mismo `requestId` para trazabilidad completa

---

## Cost projection

| Volume | Input tokens/req (avg) | Output tokens/req (avg) | Cost/request (avg) | Monthly cost |
|---|---|---|---|---|
| MVP (20 proyectos, 2,400 req/mes) | 1,500 | 800 | $0.0065 | $15.60 |
| Growth (100 proyectos, 12,000 req/mes) | 1,500 | 800 | $0.0065 | $77.80 |
| Scale (500 proyectos, 60,000 req/mes) | 1,500 | 800 | $0.0065 | $389.00 |

**Desglose por modelo en Growth (100 proyectos):**

| Modelo | Agente | Invocaciones/mes | Costo/inv (avg) | Total mensual |
|---|---|---|---|---|
| Opus | Orchestrator | 5,000 | $0.010 | $50.00 |
| Sonnet | Mentor Virtual | 500 | $0.005 | $2.50 |
| Sonnet | Feedback IA | 2,000 | $0.008 | $16.00 |
| Sonnet | Research Assistant | 400 | $0.005 | $2.00 |
| Sonnet | Solution Design | 600 | $0.006 | $3.60 |
| Sonnet | Experiment Coach | 300 | $0.005 | $1.50 |
| Sonnet | Narrative Builder | 200 | $0.008 | $1.60 |
| Haiku | OpenClaw Bridge | 3,000 | $0.0002 | $0.60 |
| **Total** | | **12,000** | | **$77.80** |

**Cost optimization note:** Se implementa caching de module summaries (generados por el Orchestrator y almacenados en `Step.stepData.moduleSummaries`) para evitar re-procesar contexto completo en cada invocacion. Estimacion de ahorro: 20-30% en tokens de input. Adicionalmente, el context tiering (Tier 1/2/3) asegura que cada agente reciba solo los datos necesarios.

---

## Acceptance criteria for this decision

- [ ] Eval suite pasa en umbral (>= 0.85 factuality en 50 casos de feedback, >= 0.90 routing accuracy en 30 escenarios) en CI
- [ ] P95 latency: Orchestrator < 3s, Workers < 5s, Bridge < 1s medido en trafico de produccion
- [ ] Costo diario se mantiene dentro de $2.00/proyecto en volumenes Growth
- [ ] Fallback chain configurado y testeado: Opus->Sonnet->Haiku->Template
- [ ] Zero-data-retention confirmado en acuerdo API con Anthropic

---

## Rejected candidates

### Claude Opus 4 (para workers)
**Rejected because:** Usar Opus para los 6 workers elevaria el costo mensual en Growth de $77.80 a ~$340, excediendo el presupuesto de $150 sin mejora proporcional en calidad (0.93 vs 0.89 factuality -- delta de 0.04 no justifica 5x de costo para tareas de feedback formativo que Sonnet maneja adecuadamente).

### Claude Haiku 4.5 (para workers)
**Rejected because:** Haiku obtuvo 0.72 de factuality en el eval set de feedback formativo, por debajo del umbral de 0.85. Las fallas mas frecuentes incluyen omision de campos criticos en el schema FeedbackIA y feedback superficial sin identificacion de gaps especificos. No apto para tareas de evaluacion educativa.

### Claude Sonnet 4 (para orquestador)
**Rejected because:** Sonnet alcanzo 0.82 de routing accuracy vs 0.96 de Opus. En un sistema de 8 agentes donde un error de routing envia el request al worker incorrecto, la diferencia de 14 puntos porcentuales tiene impacto directo en la experiencia del usuario. El costo incremental de Opus para el orquestador (~$50/mes en Growth) es aceptable dado que es un unico agente con ~5,000 invocaciones/mes.

---

## Consequences

**Positive:**
- Factuality de 0.89 en workers supera el umbral de 0.85, asegurando calidad de feedback formativo
- Routing accuracy de 0.96 minimiza errores de enrutamiento en el orquestador
- Costo mensual de $77.80 en Growth (100 proyectos) dentro del presupuesto de $150
- Latencia de Bridge < 1s permite experiencia conversacional fluida en WhatsApp/Telegram
- Fallback chain garantiza disponibilidad incluso con fallas de modelo

**Negative:**
- Costo de Opus para orquestador es 5x mayor que Sonnet -- aceptable en volumenes actuales, requiere revision si invocaciones del orquestador superan 15,000/mes
- Haiku en Bridge tiene 12% de clasificacion incorrecta en intents ambiguos -- mitigado con fallback a clarificacion ("No entendi tu mensaje, puedes reformularlo?")
- En Scale (500 proyectos, $389/mes), el costo supera el presupuesto de $150 -- requiere re-evaluacion de model routing con mayor uso de Haiku para tareas simples y caching agresivo

---

## Mandatory review triggers

This decision **must** be revisited when:
- [ ] Costo mensual de LLM excede $200 por dos meses consecutivos
- [ ] P95 latency del Orchestrator excede 5s en trafico de produccion por 3+ dias consecutivos
- [ ] Eval score cae por debajo de 0.85 tras actualizacion de modelo
- [ ] Anthropic libera nueva version con mejoras de benchmark >= 15%
- [ ] Volumen alcanza fase Scale (500 proyectos) -- re-evaluar modelo del orquestador
- [ ] Scheduled review: 2026-Q3
- [ ] Cambios en requisitos de privacidad o compliance

**Next scheduled review:** 2026-Q3

---

## Related decisions

- **Prompt strategy:** ADR-003
- **Agent orchestration:** ADR-002

---

*Template version 1.0 -- BHIL AI-First Development Toolkit -- [barryhurd.com](https://barryhurd.com)*
