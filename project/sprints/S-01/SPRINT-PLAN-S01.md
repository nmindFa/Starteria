---
id: S-01
title: "Sprint 01: Sistema Multi-Agente IA Starteria"
status: active
start: 2026-04-07
end: 2026-06-06
velocity_target: 5
velocity_actual: null
---

# Sprint 01: Sistema Multi-Agente IA Starteria

**Duration:** 2026-04-07 -> 2026-06-06 (9 semanas)
**Sprint goal:** Implementar el sistema multi-agente de IA con 8 agentes en topologia Orchestrator-Worker, integrando el modulo backend `ai/` con endpoints reales, el servicio frontend `aiService.ts`, y el bridge OpenClaw para canales WhatsApp/Telegram.

---

## Features in this sprint

| Feature | PRD | SPEC | Status | Priority |
|---|---|---|---|---|
| Sistema Multi-Agente IA (8 agentes, Orchestrator-Worker) | PRD-001 | SPEC-001 | approved | high |

---

## ADRs required before implementation begins

| Decision area | ADR | Status | Blocking feature |
|---|---|---|---|
| Topologia jerarquica Orchestrator-Worker con enrutamiento basado en paso/modulo | ADR-001 | accepted | Sistema Multi-Agente IA |
| Ensamblaje de contexto por capas (Tier 1/2/3) para control de tokens | ADR-002 | accepted | Sistema Multi-Agente IA |
| Enrutamiento de modelos por tiers (Template/Haiku/Sonnet/Opus) segun complejidad | ADR-003 | accepted | Sistema Multi-Agente IA |

**ADR gate:** No task may start implementation until all blocking ADRs are `accepted`.

---

## Task board

### Sequential tasks (must run in order)

| Order | Task | Spec | Est. tokens | Status | Session date |
|---|---|---|---|---|---|
| 1 | TASK-001: Backend scaffolding (Phase 0) | SPEC-001 | 16K | ready | Semana 1 |
| 2 | TASK-002: Orchestrator + Feedback IA (Phase 1) | SPEC-001 | 64K | blocked (needs TASK-001) | Semana 2-3 |
| 3 | TASK-005: OpenClaw Bridge (Phase 4) | SPEC-001 | 32K | blocked (needs TASK-002) | Semana 8-9 |

### Parallel tasks (can run in any order / simultaneously after TASK-002)

| Task | Spec | Est. tokens | Status | Session date |
|---|---|---|---|---|
| TASK-003: Mentor Virtual + Research Assistant (Phase 2) [P] | SPEC-001 | 32K | blocked (needs TASK-002) | Semana 4-5 |
| TASK-004: Solution Design + Experiment Coach + Narrative (Phase 3) [P] | SPEC-001 | 64K | blocked (needs TASK-002) | Semana 5-7 |

**Nota:** TASK-003 y TASK-004 son paralelos entre si. Ambos dependen de TASK-002. TASK-005 depende de TASK-002 y se ejecuta en las ultimas semanas del sprint.

---

## Session schedule

### Semana 1 (2026-04-07 -- 2026-04-11)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Revisar PRD-001, confirmar SPECs y ADRs | Ninguna |
| Mar | Aprobar ADR-001, ADR-002, ADR-003 | Ninguna |
| Mie | Iniciar TASK-001 | TASK-001: Backend scaffolding |
| Jue | Revisar PR de TASK-001 | TASK-001: completar y merge |
| Vie | Validar migration, confirmar rutas registradas | Ninguna |

### Semana 2 (2026-04-14 -- 2026-04-18)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Iniciar TASK-002 | TASK-002: Orchestrator + context assembly |
| Mar | Monitorear progreso TASK-002 | TASK-002: model-router + cost-tracker |
| Mie | Revision intermedia de TASK-002 | TASK-002: feedback-ia.agent.ts |
| Jue | Revisar schemas de structured output | TASK-002: ai.router + ai.controller |
| Vie | Revisar PR parcial de TASK-002 | Ninguna |

### Semana 3 (2026-04-21 -- 2026-04-25)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Continuar TASK-002 | TASK-002: aiService.ts frontend |
| Mar | Testing integracion FeedbackIAPanel | TASK-002: conexion frontend endpoints |
| Mie | Revisar PR completo de TASK-002 | TASK-002: tests + finalizacion |
| Jue | Merge TASK-002, habilitar TASK-003 y TASK-004 | Ninguna |
| Vie | Planificar ejecucion paralela | Ninguna |

### Semana 4 (2026-04-28 -- 2026-05-02)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Iniciar TASK-003 (paralelo) | TASK-003: mentor-virtual.agent.ts |
| Mar | Monitorear TASK-003 | TASK-003: research-assist.agent.ts |
| Mie | Iniciar TASK-004 (paralelo) | TASK-004: solution-design.agent.ts |
| Jue | Monitorear TASK-003 y TASK-004 | TASK-003: frontend integration |
| Vie | Revisar PR de TASK-003 | TASK-004: experiment-coach.agent.ts |

### Semana 5 (2026-05-05 -- 2026-05-09)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Merge TASK-003 | TASK-004: narrative-builder.agent.ts |
| Mar | Testing Mentor Virtual + Research en staging | TASK-004: Step2Page + Step3Page integration |
| Mie | Monitorear TASK-004 | TASK-004: Step4Page integration |
| Jue | Revisar PR de TASK-004 | TASK-004: tests + finalizacion |
| Vie | Merge TASK-004 | Ninguna |

### Semana 6 (2026-05-12 -- 2026-05-16)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Testing integracion completa Steps 0-4 | Fixes si necesario |
| Mar | Revisar flujo end-to-end web | Fixes si necesario |
| Mie | Ejecutar eval suites | Ajustes de prompts si score < umbral |
| Jue | Revision de costos y latencia | Optimizacion de context assembly |
| Vie | Preparar TASK-005 | Ninguna |

### Semana 7 (2026-05-19 -- 2026-05-23)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Confirmar acceso a OpenClaw API | Ninguna |
| Mar | Configurar variables de entorno OpenClaw | Ninguna |
| Mie | Iniciar TASK-005 | TASK-005: openclaw.router + controller |
| Jue | Monitorear TASK-005 | TASK-005: openclaw.client + intent-detector |
| Vie | Revision intermedia de TASK-005 | TASK-005: response-formatter + state |

### Semana 8 (2026-05-26 -- 2026-05-30)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Continuar TASK-005 | TASK-005: webhook verification |
| Mar | Testing webhook con OpenClaw sandbox | TASK-005: tests + finalizacion |
| Mie | Revisar PR de TASK-005 | Ninguna |
| Jue | Merge TASK-005 | Ninguna |
| Vie | Testing end-to-end WhatsApp/Telegram | Fixes si necesario |

### Semana 9 (2026-06-02 -- 2026-06-06)

| Dia | Actividad humana | Claude Code sessions |
|---|---|---|
| Lun | Ejecutar todas las eval suites | Ajustes finales si necesario |
| Mar | Deploy detras de feature flags | Ninguna |
| Mie | Monitoreo en staging | Ninguna |
| Jue | Retrospectiva de sprint | Ninguna |
| Vie | Sprint close, documentar learnings | Ninguna |

---

## AI-native quality gates

Para features conteniendo componentes LLM:

| Feature | Eval suite | Threshold | Status |
|---|---|---|---|
| Feedback IA (evaluacion formativa) | `evals/feedback-ia.yaml` | Factuality >= 0.85, Rubric compliance >= 0.80, 50 cases | pending |
| Mentor Virtual (feedback Step 0) | `evals/mentor-virtual.yaml` | Relevance >= 0.80, Completeness >= 0.75, 30 cases | pending |
| Research Assistant (plan investigacion) | `evals/research-assist.yaml` | Relevance >= 0.80, 30 cases | pending |
| Solution Design (HMW + ideacion) | `evals/solution-design.yaml` | Creativity >= 0.75, Relevance >= 0.80, 30 cases | pending |
| Experiment Coach (Go/No-Go) | `evals/experiment-coach.yaml` | Accuracy >= 0.80, 30 cases | pending |
| Narrative Builder (slides) | `evals/narrative-builder.yaml` | Coherence >= 0.80, Completeness >= 0.75, 20 cases | pending |
| OpenClaw Bridge (intent detection) | `evals/openclaw-intent.yaml` | Intent accuracy >= 0.90, 50 cases | pending |

**Eval gate:** No feature deploys until its eval suite passes threshold in CI.

---

## PR review checklist

Use this checklist for every PR review this sprint:

**Specification alignment**
- [ ] Implementation matches SPEC-001 -- estructuralmente, no solo funcionalmente
- [ ] API contracts coinciden con schemas especificados (field names, types, status codes)
- [ ] No hay cambios fuera de scope (verificar contra seccion Scope del TASK)

**Architecture compliance**
- [ ] No hay violaciones de limites de dependencia
- [ ] No hay dependencias externas nuevas sin ADR
- [ ] Prompt versions coinciden con versiones registradas en `project/prompts/PROMPT-REGISTRY.md`

**Test quality**
- [ ] Tests fueron escritos antes de la implementacion (verificar via git log)
- [ ] Tests son no-triviales (assertions coinciden con comportamiento esperado)
- [ ] Para componentes IA: eval suite pasa al umbral definido

**Security**
- [ ] No hay secrets o credenciales en el codigo
- [ ] Input validation en todos los inputs externos
- [ ] Manejo de PII sigue la spec de guardrails

**Documentation**
- [ ] `progress.md` fue escrito al cierre de sesion
- [ ] Nuevas decisiones arquitectonicas capturadas como ADR drafts
- [ ] SPEC actualizada si la implementacion revelo gaps en la spec

**Merge criteria:** All boxes checked OR explicit waiver documented in PR comment.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Umbral de eval no alcanzado para Feedback IA | Medium | High (bloquea deploy) | Ejecutar eval suite a mitad de sprint; ajustar prompts si score < 0.80 en semana 6 |
| Costo de tokens excede presupuesto por proyecto | Medium | High | Implementar cost ceiling en Orchestrator desde TASK-002; monitorear con endpoint /ai/usage |
| Latencia de Orchestrator > 3s por context assembly pesado | Medium | Medium | Context tiering (Tier 1/2/3); cachear module summaries; optimizar en semana 6 |
| OpenClaw API no disponible o cambios en contrato | Low | High (bloquea TASK-005) | Iniciar TASK-005 solo con acceso confirmado; implementar client con retry y circuit breaker |
| Degradacion de contexto en sesion larga de TASK-002 (64K tokens) | High | Medium | Dividir TASK-002 en dos sesiones con checkpoint intermedio en semana 2-3 |

---

## Definition of done (sprint level)

This sprint is COMPLETE when:

**Artifact chain**
- [ ] PRD-001: `status: complete`
- [ ] SPEC-001: `status: complete`
- [ ] ADR-001, ADR-002, ADR-003: `status: accepted`
- [ ] TASK-001, TASK-002, TASK-003, TASK-004, TASK-005: `status: complete`

**Code quality**
- [ ] All PRs reviewed and merged
- [ ] `npm test` passes on main branch
- [ ] No open security findings
- [ ] TypeScript compila sin errores

**AI quality**
- [ ] All eval suites passing at defined thresholds
- [ ] All prompts versioned in `project/prompts/PROMPT-REGISTRY.md`
- [ ] Golden datasets creados para cada agente con al menos 20 casos

**Deployment**
- [ ] Todos los nuevos features deployed behind feature flags (flags: OFF)
- [ ] Monitoring configurado para cada componente IA (tokens, costo, latencia)
- [ ] `project/.sdlc/context/architecture.md` actualizado con learnings del sprint

---

*Sprint plan generado siguiendo BHIL AI-First Development Toolkit*
