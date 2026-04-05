---
id: TASK-003
title: "Implementar Mentor Virtual Agent + Research Assistant Agent"
status: ready
spec: SPEC-001
adrs: [ADR-001, ADR-002, ADR-003]
sprint: S-01
parallel: true
depends_on: [TASK-002]
estimated_tokens: 32K
session_handoff: null
---

# TASK-003: Mentor Virtual + Research Assistant (Phase 2)

## Task context

**Feature:** Sistema Multi-Agente IA (SPEC-001)
**Purpose:** Implementar los agentes Mentor Virtual (feedback estructurado Step 0) y Research Assistant (plan de investigacion Step 1-B), conectar MentorVirtualPanel y Step1ResearchModuleV2 con los endpoints reales, reemplazando los mocks actuales DEFAULT_FEEDBACK y buildResearchObjective().
**Session type:** Fresh start

---

## Session start instructions

```
Session context for TASK-003:

Read these files in order before doing anything else:
1. project/.sdlc/context/architecture.md        -> project architectural constraints
2. docs/adr/ADR-001.md                          -> topologia Orchestrator-Worker
3. project/.sdlc/specs/SPEC-001-multiagent-system.md -> feature specification (API contracts para /mentor-virtual y /research-assist)
4. docs/architecture-multiagent.md (secciones 2.2, 2.4) -> agent definitions
5. backend/modules/ai/types/agent.types.ts      -> interfaces del sistema
6. backend/modules/ai/agents/orchestrator.agent.ts -> routing logic (de TASK-002)
7. backend/modules/ai/ai.router.ts              -> rutas existentes
8. front/src/app/services/aiService.ts           -> servicio frontend (de TASK-002)
9. front/src/app/pages/Step0Page.tsx             -> componente MentorVirtualPanel actual
10. front/src/app/pages/Step1Page.tsx            -> componente Step1ResearchModuleV2 actual
11. project/.sdlc/knowledge/progress-TASK-002-[date].md -> estado previo

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
| `backend/modules/ai/agents/mentor-virtual.agent.ts` | Agente Mentor Virtual: analisis de Step0Data, feedback estructurado (claro, faltaPrecisar, preguntas, siguienteAccion) |
| `backend/modules/ai/agents/research-assist.agent.ts` | Agente Research Assistant: genera objetivo, temas, perfiles y guia de preguntas desde AS-IS |
| `backend/__tests__/modules/ai/mentor-virtual.test.ts` | Tests unitarios del agente mentor virtual |
| `backend/__tests__/modules/ai/research-assist.test.ts` | Tests unitarios del agente research assistant |
| `backend/__tests__/modules/ai/mentor-research.integration.test.ts` | Tests integracion endpoints mentor-virtual y research-assist |

### Files to MODIFY

| File path | Change description |
|---|---|
| `backend/modules/ai/ai.router.ts` | Agregar rutas POST /mentor-virtual y POST /research-assist si no estan ya implementadas |
| `backend/modules/ai/ai.controller.ts` | Agregar handlers para mentor-virtual y research-assist con validacion Zod |
| `backend/modules/ai/ai.service.ts` | Agregar metodos mentorVirtual() y researchAssist() que invocan los agentes respectivos |
| `front/src/app/pages/Step0Page.tsx` | Reemplazar DEFAULT_FEEDBACK mock en MentorVirtualPanel con llamada a aiService.mentorVirtual() |
| `front/src/app/pages/Step1Page.tsx` | Reemplazar buildResearchObjective() local con llamada a aiService.researchAssist() en Step1ResearchModuleV2 |

### Files to NOT TOUCH

- `backend/modules/ai/agents/orchestrator.agent.ts` -- implementado en TASK-002
- `backend/modules/ai/agents/feedback-ia.agent.ts` -- implementado en TASK-002
- `backend/modules/ai/agents/solution-design.agent.ts` -- se implementa en TASK-004
- `backend/modules/ai/agents/experiment-coach.agent.ts` -- se implementa en TASK-004
- `backend/modules/ai/agents/narrative-builder.agent.ts` -- se implementa en TASK-004
- `backend/modules/openclaw/` -- se implementa en TASK-005
- `front/src/app/pages/Step2Page.tsx` -- se conecta en TASK-004
- `front/src/app/pages/Step3Page.tsx` -- se conecta en TASK-004
- `front/src/app/pages/Step4Page.tsx` -- se conecta en TASK-004
- `docs/adr/` -- ADRs no se modifican en tasks de implementacion

---

## Implementation specification

### Interfaces and signatures

```typescript
// backend/modules/ai/agents/mentor-virtual.agent.ts

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AgentContext, MentorVirtualFeedback } from '../types/agent.types';

export const mentorVirtualOutputSchema = z.object({
  claro: z.array(z.string()).min(1).describe('Aspectos claros y bien definidos del proyecto'),
  faltaPrecisar: z.array(z.string()).describe('Aspectos que necesitan mayor precision'),
  preguntas: z.array(z.string()).min(1).describe('Preguntas guia para profundizar'),
  siguienteAccion: z.string().describe('Siguiente accion concreta recomendada'),
});

export class MentorVirtualAgent {
  async invoke(
    context: AgentContext,
    payload: {
      projectId: string;
      step0Data: {
        origen: string;
        parteProceso: string;
        impacto3meses: string;
        respaldo: string;
        descripcion: string;
        quienImpacta: string;
        siMinimo: string;
      };
    }
  ): Promise<MentorVirtualFeedback> {
    // Implementation
  }
}
```

```typescript
// backend/modules/ai/agents/research-assist.agent.ts

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AgentContext } from '../types/agent.types';

export interface ResearchPlan {
  objetivo: string;
  temas: Array<{ tema: string; justificacion: string }>;
  perfiles: Array<{ perfil: string; razon: string }>;
  guiaPreguntas: string[];
}

export const researchPlanSchema = z.object({
  objetivo: z.string().describe('Objetivo de investigacion derivado del analisis AS-IS'),
  temas: z.array(z.object({
    tema: z.string(),
    justificacion: z.string(),
  })).min(2).max(5),
  perfiles: z.array(z.object({
    perfil: z.string(),
    razon: z.string(),
  })).min(2).max(4),
  guiaPreguntas: z.array(z.string()).min(3).max(8),
});

export class ResearchAssistAgent {
  async invoke(
    context: AgentContext,
    payload: {
      projectId: string;
      moduleAData: {
        casoReal: string;
        pasos: string;
        quiebre: string;
        consecuencia: string;
        causaInmediata: string;
        alcance: string;
      };
    }
  ): Promise<ResearchPlan> {
    // Implementation
  }
}
```

### Business logic (step by step)

```
MENTOR VIRTUAL AGENT:
1. Recibir AgentContext (Tier 1 + Tier 2 step0Data) + payload.step0Data
2. Construir system prompt:
   - Rol: mentor de innovacion experimentado
   - Instrucciones: analizar los 7 campos de Step0Data
   - Criterios: claridad del problema, especificidad del impacto, solidez del respaldo
   - Output: JSON con claro[], faltaPrecisar[], preguntas[], siguienteAccion
3. Construir user message: serializar step0Data con labels descriptivos
4. Invocar generateObject con modelo Sonnet + mentorVirtualOutputSchema
5. Validar output contra schema Zod
   IF validation fails: retry once
   IF second failure: return respuesta generica con siguienteAccion="Revisar los campos marcados"
6. Return MentorVirtualFeedback

RESEARCH ASSISTANT AGENT:
1. Recibir AgentContext (Tier 1 + Tier 2 step0Data + currentStepData) + payload.moduleAData
2. Construir system prompt:
   - Rol: experto en metodologias de investigacion
   - Instrucciones: derivar plan de investigacion desde analisis AS-IS
   - Criterios: relevancia de temas, diversidad de perfiles, calidad de preguntas
   - Output: JSON con objetivo, temas[], perfiles[], guiaPreguntas[]
3. Construir user message:
   - Incluir moduleAData (caso real, pasos, quiebre, consecuencia, causa, alcance)
   - Incluir step0Data como contexto de fondo
4. Invocar generateObject con modelo Sonnet + researchPlanSchema
5. Validar output contra schema Zod
   IF validation fails: retry once
   IF second failure: return plan minimo con objetivo generico
6. Return ResearchPlan
```

### Error handling

| Error condition | Detection | Response |
|---|---|---|
| Step0Data incompleto (campos vacios) | Validacion Zod en controller | Throw `AppError(400, 'INVALID_INPUT', 'step0Data requires all 7 fields')` |
| ModuleAData incompleto | Validacion Zod en controller | Throw `AppError(400, 'INVALID_INPUT', 'moduleAData requires all 6 fields')` |
| Anthropic API timeout | Timeout >15s | Retry once; si falla, throw `AppError(504, 'TIMEOUT', 'Mentor Virtual timeout')` |
| Structured output invalido | Zod parse falla despues de retry | Return respuesta generica degradada (graceful degradation) |
| Proyecto no existe o usuario sin acceso | Prisma query + authz check | Throw `AppError(403, 'FORBIDDEN', 'User has no access to this project')` |

---

## Test requirements

### Write tests FIRST

1. Escribir todos los tests -- deben FALLAR inicialmente
2. Commit: `git commit -m "test: TASK-003 failing tests"`
3. Implementar hasta que tests pasen
4. NO modificar archivos de test durante implementacion

### Unit tests

**File:** `backend/__tests__/modules/ai/mentor-virtual.test.ts`

```typescript
describe('MentorVirtualAgent', () => {
  describe('invoke', () => {
    it('should return MentorVirtualFeedback with claro, faltaPrecisar, preguntas, siguienteAccion', async () => {
      // Mock generateObject with valid output
      const result = await agent.invoke(context, payload);
      expect(result.claro).toBeInstanceOf(Array);
      expect(result.claro.length).toBeGreaterThan(0);
      expect(result.faltaPrecisar).toBeInstanceOf(Array);
      expect(result.preguntas).toBeInstanceOf(Array);
      expect(result.preguntas.length).toBeGreaterThan(0);
      expect(typeof result.siguienteAccion).toBe('string');
    });

    it('should include all 7 step0Data fields in the prompt', async () => {
      // Verify that the prompt builder includes: origen, parteProceso, impacto3meses,
      // respaldo, descripcion, quienImpacta, siMinimo
    });

    it('should return generic fallback on double failure', async () => {
      // Mock generateObject to fail twice
      const result = await agent.invoke(context, payload);
      expect(result.siguienteAccion).toContain('Revisar');
    });

    // Edge cases:
    // - step0Data with very short fields (< 10 chars)
    // - step0Data with very long fields (> 2000 chars)
  });
});
```

**File:** `backend/__tests__/modules/ai/research-assist.test.ts`

```typescript
describe('ResearchAssistAgent', () => {
  describe('invoke', () => {
    it('should return ResearchPlan with objetivo, temas, perfiles, guiaPreguntas', async () => {
      // Mock generateObject with valid output
      const result = await agent.invoke(context, payload);
      expect(typeof result.objetivo).toBe('string');
      expect(result.temas.length).toBeGreaterThanOrEqual(2);
      expect(result.perfiles.length).toBeGreaterThanOrEqual(2);
      expect(result.guiaPreguntas.length).toBeGreaterThanOrEqual(3);
    });

    it('should derive research objective from quiebre and consecuencia', async () => {
      // Verify prompt includes quiebre and consecuencia prominently
    });

    it('should return minimal plan on double failure', async () => {
      // Mock generateObject to fail twice
      const result = await agent.invoke(context, payload);
      expect(result.objetivo).toBeTruthy();
      expect(result.temas.length).toBeGreaterThan(0);
    });

    // Edge cases:
    // - moduleAData with empty alcance field
    // - moduleAData in different language than Spanish
  });
});
```

### Integration tests

**File:** `backend/__tests__/modules/ai/mentor-research.integration.test.ts`

Test the complete flow including:
- [ ] Happy path: POST /api/v1/ai/mentor-virtual con step0Data completo retorna MentorVirtualFeedback
- [ ] Happy path: POST /api/v1/ai/research-assist con moduleAData completo retorna ResearchPlan
- [ ] Error path: POST /api/v1/ai/mentor-virtual sin autenticacion retorna 401
- [ ] Error path: POST /api/v1/ai/mentor-virtual con step0Data incompleto retorna 400
- [ ] Boundary: POST /api/v1/ai/research-assist con moduleAData minimo (campos cortos)

---

## Acceptance criteria

- [ ] **AC-001:** POST /api/v1/ai/mentor-virtual retorna MentorVirtualFeedback con schema valido
- [ ] **AC-002:** POST /api/v1/ai/research-assist retorna ResearchPlan con schema valido
- [ ] **AC-003:** MentorVirtualPanel en Step0Page muestra feedback real de la API (no DEFAULT_FEEDBACK mock)
- [ ] **AC-004:** Step1ResearchModuleV2 muestra sugerencias de investigacion de la API (no buildResearchObjective local)
- [ ] **AC-005:** Ambos agentes usan modelo Sonnet (verificar via AIUsage record)
- [ ] **AC-006:** Context assembler carga step0Data para mentor-virtual (Tier 2)
- [ ] **AC-007:** Context assembler carga step0Data + currentStepData para research-assist (Tier 2)
- [ ] **AC-008:** Latencia < 4s para ambos agentes en condiciones normales

**For AI-native components:**
- [ ] **AC-AI-001:** `npx promptfoo eval --config evals/mentor-virtual.yaml` passes at >= 0.80 relevance
- [ ] **AC-AI-002:** `npx promptfoo eval --config evals/research-assist.yaml` passes at >= 0.80 relevance

---

## Definition of done

This task is COMPLETE when:

- [ ] All acceptance criteria above pass
- [ ] `npm run lint` passes with 0 errors
- [ ] TypeScript compiles with 0 errors (`npm run build`)
- [ ] PR opened (not merged) with title: `feat(TASK-003): Mentor Virtual + Research Assistant agents`
- [ ] `project/.sdlc/knowledge/progress-TASK-003-[date].md` written
- [ ] No files modified outside the scope section above

---

## Session close instructions

Before ending this session, write `project/.sdlc/knowledge/progress-TASK-003-[date].md`:

```markdown
# Progress: TASK-003 -- [date]

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
