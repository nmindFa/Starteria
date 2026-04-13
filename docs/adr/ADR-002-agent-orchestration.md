---
id: ADR-002
title: "Orchestration Hierarchical Orchestrator-Worker con Hybrid Pipeline para Starteria"
status: accepted
type: agent-orchestration
date: 2026-04-04
decision_makers: [Architecture Agent]
related_prds: [PRD-001]
related_specs: [SPEC-001]
related_adrs: [ADR-001]
sprint: S-01
tags: [agent, orchestration, multi-agent, architecture, hierarchical]
---

# ADR-002: Orchestration Hierarchical Orchestrator-Worker con Hybrid Pipeline para Starteria

## Context and problem statement

Starteria es una plataforma de emprendimiento que guia a participantes a traves de 4 steps (Entender, Descubrir, Disenar, Probar) con multiples modulos por step. El sistema requiere 8 agentes de IA con responsabilidades especializadas: orquestacion central, feedback formativo, asistencia de investigacion, diseno de soluciones, coaching de experimentos, construccion narrativa, y adaptacion de canales externos (WhatsApp/Telegram). Un enfoque de agente unico es insuficiente porque cada step requiere capacidades de razonamiento distintas (evaluacion de rubricas, ideacion creativa, analisis de resultados) y los canales externos requieren parsing de baja latencia separado del flujo principal.

**Decision question:** Que patron de orquestacion maneja mejor el workflow multi-step de Starteria dado los requisitos de costo (<= $0.05/request), latencia (< 5s P95 para workers), confiabilidad (fallback chain) y observabilidad (trazabilidad por agente)?

---

## Decision drivers

- **Workflow complexity:** El flujo requiere context assembly (cargar proyecto + step + modulos previos) --> routing basado en step/module/action --> ejecucion especializada --> validacion de schema --> almacenamiento de resultado. Cuatro capacidades especializadas distintas.
- **Latency budget:** Workflow completo < 8s P95. Workers individuales < 5s. OpenClaw Bridge < 1s.
- **Cost ceiling:** Maximo 2 LLM calls por request tipico (orchestrator + 1 worker) = <= $0.05 por request.
- **Error tolerance:** Fallas parciales no deben exponerse al usuario. Degradacion graceful via fallback chain obligatoria.
- **Observability:** Cada invocacion de agente debe ser trazable individualmente con requestId, tokens, costo, latencia.
- **Scalability:** Sistema debe manejar 50 workflows concurrentes (Growth: 100 proyectos activos).

---

## Orchestration patterns evaluated

### Pattern 1: Orchestrator-Worker (Hierarchical)
Un agente orquestador descompone la tarea y delega a workers especializados. Workers retornan resultados al orquestador para sintesis.

**Strengths:** Delegacion clara, facil agregar workers, orquestador mantiene contexto, debuggeable. Alineado con la arquitectura de 1 Queen + 7 workers del sistema.
**Weaknesses:** Orquestador es bottleneck y single point of failure. Especializacion de workers requiere interfaces bien definidas.
**Token overhead:** 1 llamada LLM de orquestador + 1 llamada de worker = 2 LLM calls minimo por request.

### Pattern 2: Pipeline (Sequential)
Output del Agente A se convierte en input del Agente B que se convierte en input del Agente C.

**Strengths:** Simple, predecible, facil de monitorear. Cada agente testeable independientemente.
**Weaknesses:** Secuencial -- latencia total = suma de latencias de todos los agentes. No hay ejecucion paralela. Para Starteria, la mayoria de requests necesitan solo 1 worker, no una cadena.
**Token overhead:** N llamadas LLM en serie. Contexto crece con cada etapa.

### Pattern 3: Swarm (Parallel + Aggregate)
Multiples agentes abordan la misma tarea independientemente. Resultados agregados por votacion o best-of-N.

**Strengths:** Diversidad reduce errores. Optimo para decisiones de alto riesgo.
**Weaknesses:** Nx costo de un solo agente. Para Starteria a $0.05/request ceiling, 3-way swarm a $0.015/request = $0.045, dejando cero margen. Logica de agregacion compleja para feedback formativo estructurado.
**Token overhead:** N x costo de agente individual.

### Pattern 4: Mesh (Peer-to-peer)
Agentes comunican directamente sin coordinador central.

**Strengths:** Sin single point of failure. Coordinacion emergente para tareas mal definidas.
**Weaknesses:** Dificil de debuggear, observar o controlar. Costo impredecible. Para Starteria, los flujos estan bien definidos (step/module/action) y no requieren coordinacion emergente.
**Token overhead:** Impredecible.

### Pattern 5: Hybrid (Hierarchical + Pipeline para feedback loop)
Combina patrones: hierarchical para routing principal con pipeline cuando el output de un worker alimenta a otro (ej: Feedback IA produce "Iterar" --> Orchestrator re-invoca al worker con el feedback incorporado).

**Strengths:** Patron se adapta a la sub-tarea. Permite feedback loops sin sacrificar la claridad del modelo hierarchical.
**Weaknesses:** Mayor complejidad de implementacion. Requiere logica de branching en el orquestador.

---

## Decision outcome

**Chosen pattern: Hierarchical Orchestrator-Worker con Hybrid Pipeline para feedback loops**

**Rationale:** El patron Hierarchical es el ajuste natural para la arquitectura de 8 agentes de Starteria donde el 95% de requests siguen el flujo lineal Orchestrator --> 1 Worker --> Response. El orquestador centralizado permite: (1) context assembly unificado desde Prisma, (2) routing determinista basado en step/module/action, (3) validacion de schema centralizada, (4) cost tracking por request. El componente Hybrid se activa en el caso especifico donde Feedback IA retorna "Iterar" y el participante resubmite -- el orquestador mantiene el feedback anterior en contexto para el siguiente worker call, creando un pipeline de 2 iteraciones. El overhead del orquestador (1 LLM call adicional por request) es aceptable dado que el routing accuracy de Opus (0.96) justifica el costo.

---

## Architecture specification

```
[1] Orchestrator Agent (Queen) -- Opus
    |
    +-- Step-Aware Router (deterministic, no LLM)
    |       |
    |       +-- Step 0 ---------> [2] Mentor Virtual Agent -- Sonnet
    |       |
    |       +-- Steps 1-4 ------> [3] Feedback IA Agent -- Sonnet
    |       |   (module submit)
    |       |
    |       +-- Step 1-B -------> [4] Research Assistant Agent -- Sonnet
    |       |   (assist)
    |       |
    |       +-- Step 2 ---------> [5] Solution Design Agent -- Sonnet
    |       |   (HMW/ideate/DVF)
    |       |
    |       +-- Step 3 ---------> [6] Experiment Coach Agent -- Sonnet
    |       |   (prototype/analyze)
    |       |
    |       +-- Step 4 ---------> [7] Narrative Builder Agent -- Sonnet
    |           (narrative/rehearse)
    |
    +-- [8] OpenClaw Bridge Agent -- Haiku
            (channel adapter, pre-Orchestrator)
```

### Agent definitions

**Orchestrator:**
```yaml
name: orchestrator-queen
description: "Coordinador central. Recibe requests, ensambla contexto desde Prisma, enruta a worker apropiado, valida respuestas, trackea costos."
model: claude-opus-4
tools: [ContextAssembly, AgentRouting, CostTracking, SchemaValidation, AuditLog]
max_tokens: 4096
temperature: 0.2
```

**Worker agents (Sonnet):**

```yaml
# Agent 2
name: mentor-virtual
description: "Asistencia en Step 0. Analiza contexto inicial del proyecto y genera feedback estructurado."
model: claude-sonnet-4
tools: [Step0DataAnalysis, StructuredFeedbackGen]
max_tokens: 2048
temperature: 0.3

# Agent 3
name: feedback-ia
description: "Feedback formativo en Steps 1-4. Evalua modulos contra rubricas, identifica gaps, retorna veredicto."
model: claude-sonnet-4
tools: [RubricEvaluation, GapAnalysis, ContradictionDetection]
max_tokens: 2048
temperature: 0.3

# Agent 4
name: research-assistant
description: "Asistencia en Step 1 Module B. Genera objetivo de investigacion, temas, perfiles, guia de preguntas."
model: claude-sonnet-4
tools: [ObjectiveGeneration, ThemeSuggestion, ProfileRecommendation]
max_tokens: 2048
temperature: 0.4

# Agent 5
name: solution-design
description: "Asistencia en Step 2. Genera HMW, facilita ideacion, asiste evaluacion DVF, sugiere rutas experimentales."
model: claude-sonnet-4
tools: [HMWGeneration, IdeaBrainstorm, DVFScoring, ExperimentRoutes]
max_tokens: 2048
temperature: 0.5

# Agent 6
name: experiment-coach
description: "Asistencia en Step 3. Sugiere componentes de prototipo, analiza resultados, recomienda Go/No-Go."
model: claude-sonnet-4
tools: [PrototypeSuggestion, ResultAnalysis, GoNoGoDecision]
max_tokens: 2048
temperature: 0.3

# Agent 7
name: narrative-builder
description: "Asistencia en Step 4. Genera estructura de presentacion (12 slides), narrativa, feedback de ensayo."
model: claude-sonnet-4
tools: [SlideStructure, NarrativeArc, RehearsalFeedback]
max_tokens: 3072
temperature: 0.4
```

**Bridge agent (Haiku):**
```yaml
name: openclaw-bridge
description: "Adaptador de canales WhatsApp/Telegram. Parsea mensajes, detecta intent, formatea respuestas."
model: claude-haiku-4-5
tools: [IntentDetection, MessageFormatting, SessionMapping]
max_tokens: 512
temperature: 0.1
```

### Context isolation policy

- [x] Cada worker recibe un **context window limpio** -- sin historial conversacional compartido
- [x] Workers reciben solo el contexto necesario para su tarea (context tiering: Tier 1/2/3 segun agente)
- [x] Outputs de workers son estructurados (JSON con schema definido: FeedbackIA, MentorVirtualFeedback, etc.)
- [x] Orchestrator ensambla la respuesta final desde outputs de workers
- [x] Module summaries (2 oraciones) cacheados para evitar pasar datos completos de modulos anteriores

---

## Error handling specification

| Failure scenario | Detection | Recovery action |
|---|---|---|
| Worker timeout | 10-15s timeout por worker (configurable por agente) | Retry 1x con backoff (1s, 3s) --> fallback a modelo inferior (Sonnet-->Haiku) --> template estatico |
| Worker hallucination / schema invalid | Validacion JSON schema del output (FeedbackIA, MentorVirtualFeedback, etc.) | Re-run con temperature 0 --> si falla, retornar respuesta parcial con flag `status: 'partial'` |
| Orchestrator failure | Exception handling + circuit breaker (5 fallas en 60s) | Retornar error graceful al usuario; log trace completo; alerta a equipo |
| Cost runaway | Pre-check de token count en Orchestrator antes de invocar worker | Rechazar requests que excedan $0.05 proyectado; alerta si costo diario de proyecto > $1.50 |
| Todos los workers fallan | Estado de error agregado post-retry + fallback | Retornar template estatico segun step/module; encolar para procesamiento async; notificar al usuario cuando listo |
| OpenClaw Bridge timeout | 3s timeout estricto | Respuesta inmediata: "Procesando tu solicitud, respondere en un momento"; re-try asincrono |
| Rate limiting de API | HTTP 429 / header `Retry-After` | Backoff exponencial respetando `Retry-After`; queue de requests pendientes |

---

## Observability requirements

All agent invocations must emit:
```json
{
  "trace_id": "uuid-v4 (request-level unique ID)",
  "agent_name": "feedback-ia",
  "model": "claude-sonnet-4-20260401",
  "input_tokens": 1500,
  "output_tokens": 800,
  "latency_ms": 2300,
  "status": "success",
  "error_type": null,
  "step": 1,
  "module": "A",
  "action": "feedback",
  "source": "web",
  "fallback_used": false,
  "cost_usd": 0.0165
}
```

Metricas Prometheus:
- `starteria_ai_requests_total{agent, model, status}`
- `starteria_ai_latency_seconds{agent, model}`
- `starteria_ai_tokens_total{agent, model, direction}`
- `starteria_ai_cost_usd_total{agent, model}`
- `starteria_ai_errors_total{agent, error_code}`
- `starteria_ai_circuit_breaker_state{agent}`
- `starteria_ai_fallback_total{from_model, to_model}`

Tracing dashboard: Langfuse (self-hosted) en `/admin/ai/traces`

---

## Cost and latency model

| Scenario | LLM calls | Total tokens (avg) | Estimated cost | Estimated latency |
|---|---|---|---|---|
| Happy path (web) | 2 (orchestrator + 1 worker) | 4,600 (1500+800 in/out x2) | $0.025 | 3,500ms |
| Happy path (OpenClaw) | 3 (bridge + orchestrator + worker) | 5,100 | $0.026 | 4,200ms |
| With retry (1 worker retry) | 3 | 6,900 | $0.034 | 6,500ms |
| Worst case (2 retries + fallback) | 4 | 7,800 | $0.038 | 8,000ms |
| Feedback loop (Iterar + resubmit) | 4 | 9,200 | $0.048 | 7,000ms (2 separate requests) |

**Circuit breaker:** Si el costo por request excede $0.05, abortar workflow y retornar error con mensaje: "El procesamiento de esta solicitud excede el limite. Intenta simplificar los datos del modulo."

---

## RuFlo integration

```javascript
// ruflo configuration for Starteria orchestration
{
  "topology": "hierarchical",
  "queen_type": "Strategic",
  "workers": [
    { "name": "mentor-virtual", "specialization": "step0-feedback", "model_tier": 2 },
    { "name": "feedback-ia", "specialization": "module-evaluation", "model_tier": 2 },
    { "name": "research-assistant", "specialization": "research-planning", "model_tier": 2 },
    { "name": "solution-design", "specialization": "ideation-design", "model_tier": 2 },
    { "name": "experiment-coach", "specialization": "experiment-analysis", "model_tier": 2 },
    { "name": "narrative-builder", "specialization": "presentation-narrative", "model_tier": 2 },
    { "name": "openclaw-bridge", "specialization": "channel-adaptation", "model_tier": 1 }
  ],
  "memory": "ruvector",
  "max_concurrent": 50,
  "cost_ceiling_per_request": 0.05,
  "context_tiers": {
    "tier1": ["project", "user", "currentStep", "currentModule"],
    "tier2": ["step0Data", "currentStepData", "previousModules"],
    "tier3": ["allStepsData", "feedbackHistory", "conversationHistory"]
  }
}
```

---

## Acceptance criteria

- [ ] Workflow end-to-end completa en < 8s P95 (load test con 50 requests concurrentes)
- [ ] Maximo 2 LLM calls por request tipico en web; 3 en OpenClaw (monitoreado via Langfuse)
- [ ] Worker failures disparan path de recovery correcto (90% de fallas inyectadas manejadas correctamente en chaos testing)
- [ ] Todas las invocaciones de agente emiten telemetria estructurada (verificado en integration tests)
- [ ] Costo por request <= $0.05 en el 99% de los casos de test
- [ ] Routing accuracy del orquestador >= 0.95 en 30 escenarios de test (step/module/action combinaciones)
- [ ] Latencia: Orchestrator < 3s, Workers < 5s, Bridge < 1s (P95)
- [ ] Fallback chain funcional: Opus-->Sonnet-->Haiku-->Template verificado en test de integracion

---

## Rejected patterns

### Pattern 3: Swarm (Parallel + Aggregate)
**Rejected because:** El costo de Swarm (3x por agente individual) consumiria el presupuesto de $0.05/request con 3 workers en paralelo evaluando el mismo modulo ($0.015 x 3 = $0.045 solo en workers, sin contar orquestador). La mejora de calidad por diversidad (estimada en 3-5% mejora en factuality) no justifica el 3x de costo. Para feedback formativo educativo, la consistencia de un solo evaluador es preferible a la variabilidad de multiples evaluadores.

### Pattern 4: Mesh (Peer-to-peer)
**Rejected because:** Los requisitos de observabilidad de Starteria (trazabilidad por agente individual con requestId, tokens, costo) no pueden cumplirse con coordinacion peer-to-peer sin instrumentacion custom significativa. Ademas, los flujos de Starteria son deterministas (step/module/action definen exactamente que agente debe actuar), lo que elimina la necesidad de coordinacion emergente.

### Pattern 2: Pipeline (Sequential)
**Rejected because:** El 95% de requests de Starteria requieren exactamente 1 worker (no una cadena). Un pipeline forzaria latencia secuencial innecesaria. La excepcion (feedback loop de "Iterar") se maneja mejor como re-invocacion del orquestador que como pipeline estatico, ya que el usuario decide cuando resubmitir.

---

## Consequences

**Positive:**
- Aislamiento de workers permite actualizar cualquier worker independientemente sin afectar al orquestador ni otros workers
- Context assembly centralizado elimina duplicacion de logica de carga de datos entre agentes
- Observabilidad granular: cada invocacion trazable con metricas individuales por agente/modelo/step
- Routing determinista (step/module/action) hace el sistema predecible y testeable
- Fallback chain garantiza degradacion graceful sin interrumpir la experiencia del usuario

**Negative:**
- Orchestrator como single point of failure: si Opus falla y Sonnet-fallback tambien, todo el sistema se degrada. Mitigacion: circuit breaker + template estaticos como ultima linea de defensa
- LLM call adicional del orquestador agrega ~2500ms y ~$0.010 por request. Dentro del budget de latencia (<8s) y costo (<$0.05), pero es overhead fijo
- Agregar mas de 10 workers requiere re-evaluar la capacidad de contexto del orquestador (actualmente routing logic es determinista, pero podria necesitar restructuracion si la complejidad de routing crece)

---

## Related decisions

- **Model selection (orchestrator + workers):** ADR-001
- **Prompt strategy:** ADR-003

---

*Template version 1.0 -- BHIL AI-First Development Toolkit -- [barryhurd.com](https://barryhurd.com)*
