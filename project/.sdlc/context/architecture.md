---
project: Starteria
stack: TypeScript, React, Express, Prisma, PostgreSQL
last_updated: 2026-04-04
sprint: S-01
---

# Starteria — Architecture Context

> Load this file at the start of every implementation session.
> Updated at the end of each sprint retrospective.

## Project description

Starteria es una plataforma de gestion de proyectos de innovacion corporativa con sistema multi-agente IA y bridge OpenClaw para WhatsApp/Telegram. Los participantes ejecutan proyectos en 5 Steps (0-4) con asistencia de 8 agentes IA especializados.

## Tech stack

| Layer | Technology | Version | ADR |
|---|---|---|---|
| Language | TypeScript | 5.x | -- |
| Runtime | Node.js | 22.x | -- |
| Framework (backend) | Express.js | 4.x | -- |
| Framework (frontend) | React | 19.x | -- |
| Database | PostgreSQL | 16.x | -- |
| ORM | Prisma | 6.x | -- |
| LLM provider | Anthropic | -- | ADR-001 |
| Primary model (workers) | Claude Sonnet 4 | -- | ADR-001 |
| Orchestrator model | Claude Opus 4 | -- | ADR-001 |
| Bridge model | Claude Haiku 4.5 | -- | ADR-001 |
| AI SDK | Vercel AI SDK | 4.x | -- |
| Messaging bridge | OpenClaw | -- | ADR-002 |
| Build tool | Vite | 6.x | -- |
| CI/CD | GitHub Actions | -- | -- |

## ADR registry

| ADR | Type | Decision | Status | Sprint |
|---|---|---|---|---|
| ADR-001 | model-selection | Opus orchestrator, Sonnet workers, Haiku bridge | accepted | S-01 |
| ADR-002 | agent-orchestration | Hierarchical Orchestrator-Worker pattern, 8 agents | accepted | S-01 |
| ADR-003 | prompt-strategy | Structured output + few-shot for formative feedback | accepted | S-01 |

## Key architectural principles

1. **Orchestrator-Worker**: Un agente Queen (Opus) coordina 7 workers especializados con contexto aislado
2. **Formative over evaluative**: Los agentes dan feedback formativo (que esta claro, que falta, preguntas socraticas) no scores numericos
3. **Multi-channel**: Participantes interactuan via web o WhatsApp/Telegram (OpenClaw bridge)
4. **Cost-controlled**: Ceilings por request ($0.05), por proyecto/dia ($2.00), por cohorte/mes ($100)
5. **State-machine driven**: Las transiciones de estado del proyecto gobiernan cuando se activan los agentes

## Dependency boundaries

```
ALLOWED:
  backend/modules/ai/ -> backend/modules/projects/, backend/modules/steps/, backend/shared/
  backend/modules/openclaw/ -> backend/modules/ai/, backend/shared/
  front/src/app/services/aiService.ts -> front/src/app/services/api.ts

FORBIDDEN:
  backend/modules/ai/ X backend/modules/auth/ (use middleware, not direct import)
  backend/modules/openclaw/ X front/ (backend-only module)
  backend/modules/projects/ X backend/modules/ai/ (no circular dependency)
```

## Known constraints

- No PII en logs o inputs LLM sin redaccion
- Todas las llamadas API a Anthropic requieren timeout <= 15,000ms
- Feature flags requeridos para todos los agentes antes de deploy
- OpenClaw webhook requiere verificacion HMAC-SHA256
- Maximo 12 endpoints AI nuevos (rate limited: 10 req/min participante, 50 req/min mentor/admin)

## Sprint history

| Sprint | Theme | Completed | Key decisions made |
|---|---|---|---|
| S-01 | Sistema Multi-Agente IA | En progreso | ADR-001 model selection, ADR-002 orchestration, ADR-003 prompts |
