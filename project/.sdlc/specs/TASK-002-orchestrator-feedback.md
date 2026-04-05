---
id: TASK-002
title: "Implementar Orchestrator Agent + Feedback IA Agent con aiService frontend"
status: ready
spec: SPEC-001
adrs: [ADR-001, ADR-002, ADR-003]
sprint: S-01
parallel: false
depends_on: [TASK-001]
estimated_tokens: 64K
session_handoff: null
---

# TASK-002: Orchestrator + Feedback IA (Phase 1)

## Task context

**Feature:** Sistema Multi-Agente IA (SPEC-001)
**Purpose:** Implementar el agente Orchestrator (Queen) con context assembly, routing y cost tracking, el agente Feedback IA con evaluacion formativa estructurada, el layer completo ai.router/controller/service, y el servicio frontend aiService.ts que conecta FeedbackIAPanel con el endpoint real.
**Session type:** Fresh start

---

## Session start instructions

```
Session context for TASK-002:

Read these files in order before doing anything else:
1. project/.sdlc/context/architecture.md        -> project architectural constraints
2. docs/adr/ADR-001.md                          -> topologia Orchestrator-Worker
3. docs/adr/ADR-002.md                          -> context assembly tiers
4. docs/adr/ADR-003.md                          -> model routing tiers
5. project/.sdlc/specs/SPEC-001-multiagent-system.md -> feature specification (API contracts)
6. docs/architecture-multiagent.md (secciones 4, 5, 7, 12) -> data flow, context assembly, message schema
7. backend/modules/ai/types/agent.types.ts      -> interfaces creadas en TASK-001
8. project/.sdlc/knowledge/progress-TASK-001-[date].md -> estado previo

Confirm understanding by stating:
- What you will implement
- Which files you will create or modify (list them)
- What the definition of done is

Wait for my confirmation before proceeding.
```

---

## Scope

### Files to CREATE

| File path | Purpose |
|---|---|
| `backend/modules/ai/agents/orchestrator.agent.ts` | Agente orquestador: context assembly, routing a workers, cost tracking, error recovery |
| `backend/modules/ai/agents/feedback-ia.agent.ts` | Agente Feedback IA: evaluacion formativa con structured output, rubric evaluation, verdict |
| `backend/modules/ai/context/context-assembler.ts` | Construye AgentContext desde datos Prisma con tiers 1/2/3 |
| `backend/modules/ai/context/module-summarizer.ts` | Genera y cachea resumenes de 2 frases por modulo completado |
| `backend/modules/ai/cost/cost-tracker.ts` | Registra AIUsage en Prisma, calcula costos, verifica ceilings |
| `backend/modules/ai/cost/model-router.ts` | Seleccion de modelo por tier segun agente/accion/complejidad |
| `front/src/app/services/aiService.ts` | Servicio frontend que centraliza llamadas a /api/v1/ai/* |
| `backend/__tests__/modules/ai/orchestrator.test.ts` | Tests unitarios del orchestrator |
| `backend/__tests__/modules/ai/feedback-ia.test.ts` | Tests unitarios del feedback-ia agent |
| `backend/__tests__/modules/ai/context-assembler.test.ts` | Tests unitarios del context assembler |
| `backend/__tests__/modules/ai/cost-tracker.test.ts` | Tests unitarios del cost tracker |
| `backend/__tests__/modules/ai/ai-invoke.integration.test.ts` | Test integracion endpoint /ai/invoke |

### Files to MODIFY

| File path | Change description |
|---|---|
| `backend/modules/ai/ai.router.ts` | Reemplazar stubs 501 con rutas reales: POST /invoke, POST /feedback, POST /mentor-virtual, GET /usage/:projectId |
| `backend/modules/ai/ai.controller.ts` | Implementar handlers con validacion Zod y response formatting |
| `backend/modules/ai/ai.service.ts` | Implementar logica de orquestacion: recibir request, invocar orchestrator, retornar response |
| `front/src/app/pages/Step1Page.tsx` | Conectar FeedbackIAPanel con endpoint real (reemplazar mock) |

### Files to NOT TOUCH

- `backend/modules/auth/` -- modulo de autenticacion existente
- `backend/modules/projects/` -- modulo de proyectos existente
- `backend/modules/openclaw/` -- se implementa en TASK-005
- `front/src/app/pages/Step0Page.tsx` -- se conecta en TASK-003
- `front/src/app/pages/Step2Page.tsx` -- se conecta en TASK-004
- `front/src/app/pages/Step3Page.tsx` -- se conecta en TASK-004
- `front/src/app/pages/Step4Page.tsx` -- se conecta en TASK-004
- `docs/adr/` -- ADRs no se modifican en tasks de implementacion

---

## Implementation specification

### Interfaces and signatures

```typescript
// backend/modules/ai/agents/orchestrator.agent.ts

import { AgentContext, OrchestratorRequest, AgentResponse, AgentId, ActionType } from '../types/agent.types';

export class OrchestratorAgent {
  constructor(
    private readonly contextAssembler: ContextAssembler,
    private readonly costTracker: CostTracker,
    private readonly modelRouter: ModelRouter
  ) {}

  async invoke(request: AIInvokeRequest, userId: string, projectId: string): Promise<AIInvokeResponse> {
    // 1. Assemble context
    // 2. Resolve target agent
    // 3. Select model tier
    // 4. Invoke worker agent
    // 5. Track cost
    // 6. Return response
  }

  private resolveAgent(step: number, module: string | undefined, action: ActionType): AgentId {
    // Routing logic based on step/module/action
  }
}
```

```typescript
// backend/modules/ai/agents/feedback-ia.agent.ts

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AgentContext, FeedbackIAOutput } from '../types/agent.types';

export const feedbackIAOutputSchema = z.object({
  status: z.enum(['Aprobado', 'Iterar', 'Bloqueado']),
  summary: z.string(),
  goodPoints: z.array(z.string()),
  missing: z.array(z.string()),
  actions: z.array(z.string()),
  questions: z.array(z.string()),
  contradictions: z.array(z.string()),
});

export class FeedbackIAAgent {
  async invoke(
    context: AgentContext,
    payload: { stepNumber: number; moduleId: string; moduleData: Record<string, unknown> }
  ): Promise<FeedbackIAOutput> {
    // 1. Build system prompt with rubric for step/module
    // 2. Assemble user message with moduleData + context
    // 3. Call generateObject with Sonnet + feedbackIAOutputSchema
    // 4. Return validated output
  }
}
```

```typescript
// backend/modules/ai/context/context-assembler.ts

import { PrismaClient } from '@prisma/client';
import { AgentContext, AgentId } from '../types/agent.types';

export class ContextAssembler {
  constructor(private readonly prisma: PrismaClient) {}

  async assemble(
    projectId: string,
    userId: string,
    targetAgent: AgentId,
    currentStep: number,
    currentModule: string
  ): Promise<AgentContext> {
    // Tier 1: Always load project compact + user
    // Tier 2: Load based on agent needs (step0Data, currentStepData, previousModules)
    // Tier 3: Load only when required (allStepsData, feedbackHistory, conversationHistory)
  }
}
```

```typescript
// backend/modules/ai/cost/cost-tracker.ts

export class CostTracker {
  constructor(private readonly prisma: PrismaClient) {}

  async track(params: {
    projectId: string;
    agentId: string;
    model: string;
    action: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
    status: string;
    source: 'web' | 'openclaw';
  }): Promise<void> {
    // Insert AIUsage record via Prisma
  }

  async getUsage(projectId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    byAgent: Record<string, { tokens: number; cost: number; invocations: number }>;
  }> {
    // Aggregate AIUsage records by agent
  }

  async checkCeiling(projectId: string, additionalCost: number): Promise<boolean> {
    // Return true if within ceiling, false if would exceed
  }
}
```

```typescript
// backend/modules/ai/cost/model-router.ts

import { ModelTier, AgentId } from '../types/agent.types';

export class ModelRouter {
  getModelForAgent(agentId: AgentId): { model: string; tier: ModelTier } {
    // Map agent to model:
    // orchestrator-queen -> opus
    // openclaw-bridge -> haiku
    // all others -> sonnet
  }

  getModelConfig(tier: ModelTier): { maxTokens: number; temperature: number } {
    // Return tier-specific config
  }
}
```

```typescript
// front/src/app/services/aiService.ts

import api from './api';

export const aiService = {
  invoke: (params: {
    agentHint?: string;
    step: number;
    module?: string;
    action: string;
    payload: Record<string, unknown>;
  }) => api.post('/api/v1/ai/invoke', params),

  mentorVirtual: (projectId: string, step0Data: Record<string, unknown>) =>
    api.post('/api/v1/ai/mentor-virtual', { projectId, step0Data }),

  feedback: (projectId: string, stepNumber: number, moduleId: string, moduleData: Record<string, unknown>) =>
    api.post('/api/v1/ai/feedback', { projectId, stepNumber, moduleId, moduleData }),

  researchAssist: (projectId: string, moduleAData: Record<string, unknown>) =>
    api.post('/api/v1/ai/research-assist', { projectId, moduleAData }),

  hmwGenerate: (projectId: string, synthesisData: Record<string, unknown>) =>
    api.post('/api/v1/ai/hmw-generate', { projectId, synthesisData }),

  ideate: (projectId: string, hmw: string, context: Record<string, unknown>) =>
    api.post('/api/v1/ai/ideate', { projectId, hmw, context }),

  experimentRoutes: (projectId: string, selectedIdea: Record<string, unknown>, dvfScores: Record<string, unknown>) =>
    api.post('/api/v1/ai/experiment-routes', { projectId, selectedIdea, dvfScores }),

  prototypeSuggest: (projectId: string, testCard: Record<string, unknown>) =>
    api.post('/api/v1/ai/prototype-suggest', { projectId, testCard }),

  experimentAnalyze: (projectId: string, runId: string, metrics: Record<string, unknown>, evidence: string[]) =>
    api.post('/api/v1/ai/experiment-analyze', { projectId, runId, metrics, evidence }),

  narrativeBuild: (projectId: string, audience: string) =>
    api.post('/api/v1/ai/narrative-build', { projectId, audience }),

  narrativeFeedback: (projectId: string, slides: Record<string, unknown>[], notes: string) =>
    api.post('/api/v1/ai/narrative-feedback', { projectId, slides, notes }),

  getUsage: (projectId: string) =>
    api.get(`/api/v1/ai/usage/${projectId}`),
};
```

### Business logic (step by step)

```
ORCHESTRATOR AGENT:
1. Recibir AIInvokeRequest del controller
2. Resolver agente destino con resolveAgent(step, module, action):
   - Step 0, any action        -> mentor-virtual
   - Steps 1-4, module submit  -> feedback-ia
   - Step 1, module B assist   -> research-assistant
   - Step 2, HMW/ideate/DVF    -> solution-design
   - Step 3, prototype/analyze -> experiment-coach
   - Step 4, narrative/rehearse -> narrative-builder
3. Invocar contextAssembler.assemble() para construir AgentContext
4. Invocar modelRouter.getModelForAgent() para obtener modelo
5. Verificar cost ceiling con costTracker.checkCeiling()
   IF exceeds: return error COST_EXCEEDED
6. Invocar worker agent con context + payload
7. Registrar uso con costTracker.track()
8. Retornar AIInvokeResponse con data, agent, model, tokensUsed, latencyMs

FEEDBACK IA AGENT:
1. Recibir AgentContext + payload (stepNumber, moduleId, moduleData)
2. Construir system prompt con rubrica del step/module actual
3. Construir user message con moduleData serializado + previousModules como contexto
4. Invocar generateObject con modelo Sonnet y feedbackIAOutputSchema
5. Validar output contra schema Zod
   IF validation fails: retry once con prompt ajustado
   IF second failure: return status 'Iterar' con mensaje generico
6. Return FeedbackIAOutput validado
```

### Error handling

| Error condition | Detection | Response |
|---|---|---|
| Agente destino no resuelto | resolveAgent retorna undefined | Throw `AppError(400, 'INVALID_INPUT', 'Cannot resolve agent for step/module/action')` |
| Cost ceiling excedido | checkCeiling retorna false | Throw `AppError(429, 'COST_EXCEEDED', 'Project AI budget exceeded')` |
| Anthropic API timeout | Timeout >30s | Retry once; si falla, throw `AppError(504, 'TIMEOUT', 'AI service timeout')` |
| Anthropic API rate limit | 429 response | Throw `AppError(429, 'RATE_LIMIT', 'AI service rate limited')` |
| Structured output validation falla | Zod parse error | Retry once; si falla, return respuesta parcial con status 'partial' |
| Proyecto no encontrado | Prisma findUnique retorna null | Throw `AppError(404, 'NOT_FOUND', 'Project not found')` |

---

## Test requirements

### Write tests FIRST

Este task usa patron test-first:
1. Escribir todos los tests -- deben FALLAR inicialmente
2. Commit: `git commit -m "test: TASK-002 failing tests"`
3. Implementar hasta que tests pasen
4. NO modificar archivos de test durante implementacion

### Unit tests

**File:** `backend/__tests__/modules/ai/orchestrator.test.ts`

```typescript
describe('OrchestratorAgent', () => {
  describe('resolveAgent', () => {
    it('should route step 0 to mentor-virtual', async () => {
      const result = orchestrator.resolveAgent(0, undefined, 'assist');
      expect(result).toBe('mentor-virtual');
    });

    it('should route step 1-4 module submit to feedback-ia', async () => {
      const result = orchestrator.resolveAgent(1, 'A', 'feedback');
      expect(result).toBe('feedback-ia');
    });

    it('should route step 1 module B assist to research-assistant', async () => {
      const result = orchestrator.resolveAgent(1, 'B', 'assist');
      expect(result).toBe('research-assistant');
    });

    it('should route step 2 HMW to solution-design', async () => {
      const result = orchestrator.resolveAgent(2, undefined, 'generate');
      expect(result).toBe('solution-design');
    });

    it('should route step 3 analyze to experiment-coach', async () => {
      const result = orchestrator.resolveAgent(3, undefined, 'analyze');
      expect(result).toBe('experiment-coach');
    });

    it('should route step 4 generate to narrative-builder', async () => {
      const result = orchestrator.resolveAgent(4, undefined, 'generate');
      expect(result).toBe('narrative-builder');
    });
  });

  describe('invoke', () => {
    it('should assemble context, invoke worker, track cost, and return response', async () => {
      // Mock contextAssembler, costTracker, modelRouter, worker agent
      // Verify full orchestration flow
    });

    it('should throw COST_EXCEEDED when ceiling is reached', async () => {
      // Mock costTracker.checkCeiling to return false
      await expect(orchestrator.invoke(request, userId, projectId))
        .rejects.toThrow('COST_EXCEEDED');
    });
  });
});
```

**File:** `backend/__tests__/modules/ai/feedback-ia.test.ts`

```typescript
describe('FeedbackIAAgent', () => {
  describe('invoke', () => {
    it('should return FeedbackIAOutput with valid schema', async () => {
      // Mock generateObject to return valid feedback
      const result = await agent.invoke(context, payload);
      expect(result.status).toMatch(/Aprobado|Iterar|Bloqueado/);
      expect(result.goodPoints).toBeInstanceOf(Array);
      expect(result.missing).toBeInstanceOf(Array);
    });

    it('should retry once on schema validation failure', async () => {
      // Mock generateObject to fail once, succeed second time
    });

    it('should return generic Iterar on double failure', async () => {
      // Mock generateObject to fail twice
      const result = await agent.invoke(context, payload);
      expect(result.status).toBe('Iterar');
    });
  });
});
```

### Integration tests

**File:** `backend/__tests__/modules/ai/ai-invoke.integration.test.ts`

Test the complete flow including:
- [ ] Happy path: POST /api/v1/ai/invoke con step=1, module=A, action=feedback retorna FeedbackIAOutput
- [ ] Happy path: POST /api/v1/ai/feedback retorna evaluacion formativa
- [ ] Error path: POST /api/v1/ai/invoke sin autenticacion retorna 401
- [ ] Error path: POST /api/v1/ai/invoke con step invalido retorna 400
- [ ] Boundary: POST /api/v1/ai/invoke con proyecto sin datos de step retorna respuesta parcial

---

## Acceptance criteria

- [ ] **AC-001:** POST /api/v1/ai/invoke enruta correctamente a los 6 agentes segun tabla de routing
- [ ] **AC-002:** POST /api/v1/ai/feedback retorna FeedbackIAOutput con schema valido (status, summary, goodPoints, missing, actions, questions, contradictions)
- [ ] **AC-003:** Context assembler construye AgentContext con tiers correctos por agente
- [ ] **AC-004:** Cost tracker registra AIUsage en Prisma con todos los campos requeridos
- [ ] **AC-005:** Model router asigna Opus al orchestrator, Sonnet a workers, Haiku a openclaw-bridge
- [ ] **AC-006:** `front/src/app/services/aiService.ts` exporta metodos para todos los endpoints de IA
- [ ] **AC-007:** FeedbackIAPanel se conecta con endpoint real (reemplaza mock)
- [ ] **AC-008:** Latencia de orchestrator routing (sin AI call) < 100ms

**For AI-native components:**
- [ ] **AC-AI-001:** `npx promptfoo eval --config evals/feedback-ia.yaml` passes at >= 0.85 factuality
- [ ] **AC-AI-002:** Output de Feedback IA valida contra feedbackIAOutputSchema en 100% de eval cases

---

## Definition of done

This task is COMPLETE when:

- [ ] All acceptance criteria above pass
- [ ] `npm run lint` passes with 0 errors
- [ ] TypeScript compiles with 0 errors (`npm run build`)
- [ ] PR opened (not merged) with title: `feat(TASK-002): Orchestrator + Feedback IA con aiService frontend`
- [ ] `project/.sdlc/knowledge/progress-TASK-002-[date].md` written
- [ ] No files modified outside the scope section above

---

## Session close instructions

Before ending this session, write `project/.sdlc/knowledge/progress-TASK-002-[date].md`:

```markdown
# Progress: TASK-002 -- [date]

## Completed
- [bullet: what was done]
- [bullet: what was done]

## Test status
- Unit tests: [X]/[total] passing
- Integration tests: [X]/[total] passing
- Known failures: [describe if any]

## Files created/modified
- `[path]` -- [what changed]

## Decisions made
- [Any decision that should become an ADR draft]

## Next steps
- [Exact first action for next session]
- [Any remaining acceptance criteria not yet met]

## Questions for spec update
- [Any ambiguity discovered that should update SPEC-001]
```

---

*Task generado siguiendo BHIL AI-First Development Toolkit*
