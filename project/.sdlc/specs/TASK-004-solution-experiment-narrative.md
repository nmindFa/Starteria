---
id: TASK-004
title: "Implementar Solution Design + Experiment Coach + Narrative Builder agents"
status: ready
spec: SPEC-001
adrs: [ADR-001, ADR-002, ADR-003]
sprint: S-01
parallel: true
depends_on: [TASK-002]
estimated_tokens: 64K
session_handoff: null
---

# TASK-004: Solution Design + Experiment Coach + Narrative Builder (Phase 3)

## Task context

**Feature:** Sistema Multi-Agente IA (SPEC-001)
**Purpose:** Implementar los agentes Solution Design (HMW, ideacion, DVF, experiment routes para Step 2), Experiment Coach (prototype suggest, experiment analyze para Step 3) y Narrative Builder (slides, elevator pitch, rehearsal para Step 4). Conectar Step2Page, Step3Page y Step4Page con los endpoints reales.
**Session type:** Fresh start

---

## Session start instructions

```
Session context for TASK-004:

Read these files in order before doing anything else:
1. project/.sdlc/context/architecture.md        -> project architectural constraints
2. docs/adr/ADR-001.md                          -> topologia Orchestrator-Worker
3. project/.sdlc/specs/SPEC-001-multiagent-system.md -> feature specification (API contracts para /hmw-generate, /ideate, /experiment-routes, /prototype-suggest, /experiment-analyze, /narrative-build, /narrative-feedback)
4. docs/architecture-multiagent.md (secciones 2.5, 2.6, 2.7) -> agent definitions
5. backend/modules/ai/types/agent.types.ts      -> interfaces del sistema
6. backend/modules/ai/agents/orchestrator.agent.ts -> routing logic
7. backend/modules/ai/ai.router.ts              -> rutas existentes
8. front/src/app/services/aiService.ts           -> servicio frontend
9. front/src/app/pages/Step2Page.tsx             -> componente Step 2 actual
10. front/src/app/pages/Step3Page.tsx            -> componente Step 3 actual (si existe)
11. front/src/app/pages/Step4Page.tsx            -> componente Step 4 actual (si existe)
12. project/.sdlc/knowledge/progress-TASK-002-[date].md -> estado previo

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
| `backend/modules/ai/agents/solution-design.agent.ts` | Agente Solution Design: HMW generation, ideation + clustering, DVF assist, experiment routes |
| `backend/modules/ai/agents/experiment-coach.agent.ts` | Agente Experiment Coach: prototype suggest, experiment analyze con Go/No-Go |
| `backend/modules/ai/agents/narrative-builder.agent.ts` | Agente Narrative Builder: slide structure (12 slides), elevator pitch, rehearsal feedback |
| `backend/__tests__/modules/ai/solution-design.test.ts` | Tests unitarios del agente solution design |
| `backend/__tests__/modules/ai/experiment-coach.test.ts` | Tests unitarios del agente experiment coach |
| `backend/__tests__/modules/ai/narrative-builder.test.ts` | Tests unitarios del agente narrative builder |
| `backend/__tests__/modules/ai/steps-2-3-4.integration.test.ts` | Tests integracion para todos los endpoints de Steps 2, 3, 4 |

### Files to MODIFY

| File path | Change description |
|---|---|
| `backend/modules/ai/ai.router.ts` | Agregar rutas POST /hmw-generate, /ideate, /experiment-routes, /prototype-suggest, /experiment-analyze, /narrative-build, /narrative-feedback |
| `backend/modules/ai/ai.controller.ts` | Agregar handlers para los 7 endpoints nuevos con validacion Zod |
| `backend/modules/ai/ai.service.ts` | Agregar metodos hmwGenerate(), ideate(), experimentRoutes(), prototypeSuggest(), experimentAnalyze(), narrativeBuild(), narrativeFeedback() |
| `front/src/app/pages/Step2Page.tsx` | Conectar secciones HMW, ideacion, y test card con endpoints IA |
| `front/src/app/pages/ProjectHomePage.tsx` | Conectar Step3 (si prototype/analyze se accede desde aqui) |

### Files to NOT TOUCH

- `backend/modules/ai/agents/orchestrator.agent.ts` -- implementado en TASK-002
- `backend/modules/ai/agents/feedback-ia.agent.ts` -- implementado en TASK-002
- `backend/modules/ai/agents/mentor-virtual.agent.ts` -- implementado en TASK-003
- `backend/modules/ai/agents/research-assist.agent.ts` -- implementado en TASK-003
- `backend/modules/openclaw/` -- se implementa en TASK-005
- `front/src/app/pages/Step0Page.tsx` -- ya conectado en TASK-003
- `docs/adr/` -- ADRs no se modifican en tasks de implementacion

---

## Implementation specification

### Interfaces and signatures

```typescript
// backend/modules/ai/agents/solution-design.agent.ts

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AgentContext } from '../types/agent.types';

export interface HmwOption {
  hmw: string;
  rationale: string;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  cluster: string;
}

export interface ExperimentRoute {
  hypothesis: string;
  experiment: string;
  metric: string;
}

export const hmwOutputSchema = z.object({
  options: z.array(z.object({
    hmw: z.string(),
    rationale: z.string(),
  })).min(3).max(6),
});

export const ideateOutputSchema = z.object({
  ideas: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    cluster: z.string(),
  })).min(5).max(15),
});

export const experimentRoutesSchema = z.object({
  routes: z.array(z.object({
    hypothesis: z.string(),
    experiment: z.string(),
    metric: z.string(),
  })).min(2).max(4),
});

export class SolutionDesignAgent {
  async hmwGenerate(
    context: AgentContext,
    payload: { projectId: string; synthesisData: Record<string, unknown> }
  ): Promise<{ options: HmwOption[] }> {}

  async ideate(
    context: AgentContext,
    payload: { projectId: string; hmw: string; context: Record<string, unknown> }
  ): Promise<{ ideas: Idea[] }> {}

  async experimentRoutes(
    context: AgentContext,
    payload: {
      projectId: string;
      selectedIdea: { id: string; title: string; description: string };
      dvfScores: Record<string, unknown>;
    }
  ): Promise<{ routes: ExperimentRoute[] }> {}
}
```

```typescript
// backend/modules/ai/agents/experiment-coach.agent.ts

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AgentContext } from '../types/agent.types';

export interface PrototypeSuggestion {
  components: string[];
  instrumentation: string[];
  tips: string[];
}

export interface ExperimentAnalysis {
  findings: string[];
  recommendation: 'GO' | 'NO_GO' | 'PIVOT';
  rationale: string;
  learningCard: Record<string, unknown>;
}

export const prototypeSuggestSchema = z.object({
  components: z.array(z.string()).min(2).max(6),
  instrumentation: z.array(z.string()).min(1).max(4),
  tips: z.array(z.string()).min(1).max(5),
});

export const experimentAnalyzeSchema = z.object({
  findings: z.array(z.string()).min(1),
  recommendation: z.enum(['GO', 'NO_GO', 'PIVOT']),
  rationale: z.string(),
  learningCard: z.record(z.unknown()),
});

export class ExperimentCoachAgent {
  async prototypeSuggest(
    context: AgentContext,
    payload: { projectId: string; testCard: Record<string, unknown> }
  ): Promise<PrototypeSuggestion> {}

  async experimentAnalyze(
    context: AgentContext,
    payload: {
      projectId: string;
      runId: string;
      metrics: Record<string, unknown>;
      evidence: string[];
    }
  ): Promise<ExperimentAnalysis> {}
}
```

```typescript
// backend/modules/ai/agents/narrative-builder.agent.ts

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AgentContext } from '../types/agent.types';

export interface Slide {
  number: number;
  title: string;
  keyMessage: string;
  content: string;
  speakerNotes: string;
}

export interface NarrativeOutput {
  slides: Slide[];
  elevatorPitch: string;
  narrativeArc: string;
}

export interface RehearsalFeedback {
  feedback: string[];
  suggestions: string[];
}

export const narrativeBuildSchema = z.object({
  slides: z.array(z.object({
    number: z.number(),
    title: z.string(),
    keyMessage: z.string(),
    content: z.string(),
    speakerNotes: z.string(),
  })).length(12),
  elevatorPitch: z.string(),
  narrativeArc: z.string(),
});

export const rehearsalFeedbackSchema = z.object({
  feedback: z.array(z.string()).min(1),
  suggestions: z.array(z.string()).min(1),
});

export class NarrativeBuilderAgent {
  async narrativeBuild(
    context: AgentContext,
    payload: { projectId: string; audience: string }
  ): Promise<NarrativeOutput> {}

  async narrativeFeedback(
    context: AgentContext,
    payload: {
      projectId: string;
      slides: Record<string, unknown>[];
      notes: string;
    }
  ): Promise<RehearsalFeedback> {}
}
```

### Business logic (step by step)

```
SOLUTION DESIGN AGENT:

hmwGenerate:
1. Recibir AgentContext (Tier 1 + Tier 2: step0Data, currentStepData, previousModules) + synthesisData
2. Construir system prompt:
   - Rol: facilitador de innovacion con metodologia Design Thinking
   - Instrucciones: generar reformulaciones "How Might We" desde la sintesis
   - Criterios: diversidad, actionable, scope adecuado
3. Incluir synthesisData + step0Data como contexto
4. Invocar generateObject con Sonnet + hmwOutputSchema
5. Return { options: HmwOption[] }

ideate:
1. Recibir AgentContext + HMW seleccionado + contexto adicional
2. Construir system prompt:
   - Rol: facilitador de brainstorming
   - Instrucciones: generar ideas diversas agrupadas por clusters
   - Criterios: originalidad, viabilidad, relevancia al HMW
3. Invocar generateObject con Sonnet + ideateOutputSchema
4. Return { ideas: Idea[] }

experimentRoutes:
1. Recibir AgentContext + idea seleccionada + puntuaciones DVF
2. Construir system prompt:
   - Rol: coach de experimentacion Lean Startup
   - Instrucciones: generar rutas de experimento con hipotesis/experimento/metrica
3. Invocar generateObject con Sonnet + experimentRoutesSchema
4. Return { routes: ExperimentRoute[] }

EXPERIMENT COACH AGENT:

prototypeSuggest:
1. Recibir AgentContext (Tier 1 + Tier 2: currentStepData con test card) + testCard
2. Construir system prompt:
   - Rol: coach de prototipado rapido
   - Instrucciones: sugerir componentes, instrumentacion, y tips
3. Invocar generateObject con Sonnet + prototypeSuggestSchema
4. Return PrototypeSuggestion

experimentAnalyze:
1. Recibir AgentContext + runId + metrics + evidence
2. Construir system prompt:
   - Rol: analista de experimentos
   - Instrucciones: analizar metricas vs hipotesis, emitir recomendacion Go/No-Go/Pivot
3. Invocar generateObject con Sonnet + experimentAnalyzeSchema
4. Return ExperimentAnalysis

NARRATIVE BUILDER AGENT:

narrativeBuild:
1. Recibir AgentContext (Tier 1 + Tier 2: step0Data + Tier 3: allStepsData) + audience
2. Construir system prompt:
   - Rol: coach de storytelling y presentaciones
   - Instrucciones: generar estructura de 12 slides + elevator pitch + arco narrativo
   - Estructura de slides: contexto(1-2), problema(3-4), investigacion(5-6), solucion(7-8), experimento(9-10), resultados(11), llamada a accion(12)
3. Invocar generateObject con Sonnet + narrativeBuildSchema
4. Return NarrativeOutput

narrativeFeedback:
1. Recibir AgentContext + slides editados + notas del participante
2. Construir system prompt:
   - Rol: coach de comunicacion
   - Instrucciones: evaluar coherencia narrativa, claridad, impacto
3. Invocar generateObject con Sonnet + rehearsalFeedbackSchema
4. Return RehearsalFeedback
```

### Error handling

| Error condition | Detection | Response |
|---|---|---|
| SynthesisData vacio o incompleto | Validacion Zod en controller | Throw `AppError(400, 'INVALID_INPUT', 'synthesisData is required')` |
| TestCard sin hipotesis | Validacion Zod | Throw `AppError(400, 'INVALID_INPUT', 'testCard must include hypothesis')` |
| Anthropic API timeout | Timeout >15s | Retry once; si falla, throw `AppError(504, 'TIMEOUT')` |
| Structured output invalido | Zod parse falla | Retry once; si falla, return respuesta degradada con minimos |
| Narrative allStepsData faltante | Prisma query incompleta | Log warning, generar narrativa solo con datos disponibles |
| Evidence URLs no accesibles | URL validation | Log warning, proceder sin evidence metadata |

---

## Test requirements

### Write tests FIRST

1. Escribir todos los tests -- deben FALLAR inicialmente
2. Commit: `git commit -m "test: TASK-004 failing tests"`
3. Implementar hasta que tests pasen
4. NO modificar archivos de test durante implementacion

### Unit tests

**File:** `backend/__tests__/modules/ai/solution-design.test.ts`

```typescript
describe('SolutionDesignAgent', () => {
  describe('hmwGenerate', () => {
    it('should return 3-6 HMW options with rationale', async () => {
      const result = await agent.hmwGenerate(context, payload);
      expect(result.options.length).toBeGreaterThanOrEqual(3);
      expect(result.options.length).toBeLessThanOrEqual(6);
      result.options.forEach(opt => {
        expect(opt.hmw).toMatch(/^(Como|How)/i);
        expect(opt.rationale).toBeTruthy();
      });
    });
  });

  describe('ideate', () => {
    it('should return 5-15 ideas with clusters', async () => {
      const result = await agent.ideate(context, payload);
      expect(result.ideas.length).toBeGreaterThanOrEqual(5);
      result.ideas.forEach(idea => {
        expect(idea.id).toBeTruthy();
        expect(idea.cluster).toBeTruthy();
      });
    });
  });

  describe('experimentRoutes', () => {
    it('should return 2-4 experiment routes with hypothesis/experiment/metric', async () => {
      const result = await agent.experimentRoutes(context, payload);
      expect(result.routes.length).toBeGreaterThanOrEqual(2);
      result.routes.forEach(route => {
        expect(route.hypothesis).toBeTruthy();
        expect(route.experiment).toBeTruthy();
        expect(route.metric).toBeTruthy();
      });
    });
  });
});
```

**File:** `backend/__tests__/modules/ai/experiment-coach.test.ts`

```typescript
describe('ExperimentCoachAgent', () => {
  describe('prototypeSuggest', () => {
    it('should return components, instrumentation, and tips', async () => {
      const result = await agent.prototypeSuggest(context, payload);
      expect(result.components.length).toBeGreaterThanOrEqual(2);
      expect(result.instrumentation.length).toBeGreaterThanOrEqual(1);
      expect(result.tips.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('experimentAnalyze', () => {
    it('should return GO, NO_GO, or PIVOT recommendation', async () => {
      const result = await agent.experimentAnalyze(context, payload);
      expect(['GO', 'NO_GO', 'PIVOT']).toContain(result.recommendation);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.rationale).toBeTruthy();
    });
  });
});
```

**File:** `backend/__tests__/modules/ai/narrative-builder.test.ts`

```typescript
describe('NarrativeBuilderAgent', () => {
  describe('narrativeBuild', () => {
    it('should return exactly 12 slides with all fields', async () => {
      const result = await agent.narrativeBuild(context, payload);
      expect(result.slides).toHaveLength(12);
      result.slides.forEach((slide, i) => {
        expect(slide.number).toBe(i + 1);
        expect(slide.title).toBeTruthy();
        expect(slide.keyMessage).toBeTruthy();
        expect(slide.content).toBeTruthy();
        expect(slide.speakerNotes).toBeTruthy();
      });
    });

    it('should include elevatorPitch and narrativeArc', async () => {
      const result = await agent.narrativeBuild(context, payload);
      expect(result.elevatorPitch).toBeTruthy();
      expect(result.narrativeArc).toBeTruthy();
    });
  });

  describe('narrativeFeedback', () => {
    it('should return feedback and suggestions arrays', async () => {
      const result = await agent.narrativeFeedback(context, payload);
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
```

### Integration tests

**File:** `backend/__tests__/modules/ai/steps-2-3-4.integration.test.ts`

Test the complete flow including:
- [ ] Happy path: POST /api/v1/ai/hmw-generate retorna opciones HMW
- [ ] Happy path: POST /api/v1/ai/ideate retorna ideas agrupadas
- [ ] Happy path: POST /api/v1/ai/experiment-routes retorna rutas de experimento
- [ ] Happy path: POST /api/v1/ai/prototype-suggest retorna sugerencia de prototipo
- [ ] Happy path: POST /api/v1/ai/experiment-analyze retorna analisis con recomendacion
- [ ] Happy path: POST /api/v1/ai/narrative-build retorna 12 slides
- [ ] Happy path: POST /api/v1/ai/narrative-feedback retorna feedback de ensayo
- [ ] Error path: POST sin autenticacion retorna 401
- [ ] Error path: POST con payload invalido retorna 400

---

## Acceptance criteria

- [ ] **AC-001:** POST /api/v1/ai/hmw-generate retorna 3-6 opciones HMW con rationale
- [ ] **AC-002:** POST /api/v1/ai/ideate retorna 5-15 ideas agrupadas por cluster
- [ ] **AC-003:** POST /api/v1/ai/experiment-routes retorna 2-4 rutas con hipotesis/experimento/metrica
- [ ] **AC-004:** POST /api/v1/ai/prototype-suggest retorna components, instrumentation, tips
- [ ] **AC-005:** POST /api/v1/ai/experiment-analyze retorna recommendation GO/NO_GO/PIVOT con findings y rationale
- [ ] **AC-006:** POST /api/v1/ai/narrative-build retorna exactamente 12 slides + elevatorPitch + narrativeArc
- [ ] **AC-007:** POST /api/v1/ai/narrative-feedback retorna feedback + suggestions
- [ ] **AC-008:** Step2Page conecta secciones HMW, ideacion y test card con endpoints IA
- [ ] **AC-009:** Step3Page conecta prototype suggest y experiment analyze con endpoints IA
- [ ] **AC-010:** Step4Page conecta narrative build con endpoint IA
- [ ] **AC-011:** Todos los agentes usan modelo Sonnet (verificar via AIUsage)
- [ ] **AC-012:** Latencia < 5s para cada endpoint en condiciones normales

**For AI-native components:**
- [ ] **AC-AI-001:** `npx promptfoo eval --config evals/solution-design.yaml` passes at >= 0.75 creativity, >= 0.80 relevance
- [ ] **AC-AI-002:** `npx promptfoo eval --config evals/experiment-coach.yaml` passes at >= 0.80 accuracy
- [ ] **AC-AI-003:** `npx promptfoo eval --config evals/narrative-builder.yaml` passes at >= 0.80 coherence, >= 0.75 completeness

---

## Definition of done

This task is COMPLETE when:

- [ ] All acceptance criteria above pass
- [ ] `npm run lint` passes with 0 errors
- [ ] TypeScript compiles with 0 errors (`npm run build`)
- [ ] PR opened (not merged) with title: `feat(TASK-004): Solution Design + Experiment Coach + Narrative Builder agents`
- [ ] `project/.sdlc/knowledge/progress-TASK-004-[date].md` written
- [ ] No files modified outside the scope section above

---

## Session close instructions

Before ending this session, write `project/.sdlc/knowledge/progress-TASK-004-[date].md`:

```markdown
# Progress: TASK-004 -- [date]

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
