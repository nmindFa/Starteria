---
id: TASK-001
title: "Crear scaffolding backend para modulos ai/ y openclaw/"
status: ready
spec: SPEC-001
adrs: [ADR-001, ADR-002, ADR-003]
sprint: S-01
parallel: false
depends_on: []
estimated_tokens: 16K
session_handoff: null
---

# TASK-001: Backend Scaffolding (Phase 0)

## Task context

**Feature:** Sistema Multi-Agente IA (SPEC-001)
**Purpose:** Crear la estructura de directorios, instalar dependencias, ejecutar migracion Prisma para los modelos AIUsage y OpenClawConversation, registrar rutas en app.ts, y definir los tipos compartidos del sistema de agentes.
**Session type:** Fresh start

---

## Session start instructions

```
Session context for TASK-001:

Read these files in order before doing anything else:
1. project/.sdlc/context/architecture.md        -> project architectural constraints
2. docs/adr/ADR-001.md                          -> topologia Orchestrator-Worker
3. docs/adr/ADR-002.md                          -> context assembly tiers
4. docs/adr/ADR-003.md                          -> model routing tiers
5. project/.sdlc/specs/SPEC-001-multiagent-system.md -> feature specification
6. docs/architecture-multiagent.md (seccion 12) -> backend module structure
7. docs/architecture-multiagent.md (Appendix A) -> Prisma schema additions

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
| `backend/modules/ai/ai.router.ts` | Router placeholder con rutas stub para /api/v1/ai/* |
| `backend/modules/ai/ai.controller.ts` | Controller placeholder con handlers stub |
| `backend/modules/ai/ai.service.ts` | Service placeholder con metodos stub |
| `backend/modules/ai/agents/orchestrator.agent.ts` | Placeholder del agente orquestador |
| `backend/modules/ai/agents/mentor-virtual.agent.ts` | Placeholder del agente mentor |
| `backend/modules/ai/agents/feedback-ia.agent.ts` | Placeholder del agente feedback |
| `backend/modules/ai/agents/research-assist.agent.ts` | Placeholder del agente research |
| `backend/modules/ai/agents/solution-design.agent.ts` | Placeholder del agente solucion |
| `backend/modules/ai/agents/experiment-coach.agent.ts` | Placeholder del agente experimento |
| `backend/modules/ai/agents/narrative-builder.agent.ts` | Placeholder del agente narrativa |
| `backend/modules/ai/context/context-assembler.ts` | Placeholder del ensamblador de contexto |
| `backend/modules/ai/context/module-summarizer.ts` | Placeholder del resumidor de modulos |
| `backend/modules/ai/cost/cost-tracker.ts` | Placeholder del rastreador de costos |
| `backend/modules/ai/cost/model-router.ts` | Placeholder del enrutador de modelos |
| `backend/modules/ai/types/agent.types.ts` | Interfaces TypeScript compartidas del sistema |
| `backend/modules/openclaw/openclaw.router.ts` | Router placeholder con rutas stub para /api/v1/openclaw/* |
| `backend/modules/openclaw/openclaw.controller.ts` | Controller placeholder |
| `backend/modules/openclaw/openclaw.service.ts` | Service placeholder |
| `backend/modules/openclaw/openclaw.client.ts` | Client placeholder |
| `backend/modules/openclaw/intent-detector.ts` | Placeholder del detector de intents |
| `backend/modules/openclaw/response-formatter.ts` | Placeholder del formateador |
| `backend/modules/openclaw/conversation-state.ts` | Placeholder de la maquina de estados |

### Files to MODIFY

| File path | Change description |
|---|---|
| `backend/app.ts` | Registrar rutas: `app.use('/api/v1/ai', aiRouter)` y `app.use('/api/v1/openclaw', openclawRouter)` |
| `front/prisma/schema.prisma` | Agregar modelos `AIUsage` y `OpenClawConversation` con indices |
| `backend/package.json` | Agregar dependencias `ai`, `@ai-sdk/anthropic`, `zod` (si no existe ya) |

### Files to NOT TOUCH

- `backend/modules/auth/` -- modulo de autenticacion existente
- `backend/modules/projects/` -- modulo de proyectos existente
- `backend/modules/steps/` -- modulo de steps existente
- `backend/modules/users/` -- modulo de usuarios existente
- `front/src/app/pages/` -- paginas frontend (se modifican en TASK-002+)
- `docs/adr/` -- ADRs no se modifican en tasks de implementacion

---

## Implementation specification

### Interfaces and signatures

```typescript
// backend/modules/ai/types/agent.types.ts

export type AgentId =
  | 'orchestrator-queen'
  | 'mentor-virtual'
  | 'feedback-ia'
  | 'research-assistant'
  | 'solution-design'
  | 'experiment-coach'
  | 'narrative-builder'
  | 'openclaw-bridge';

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export type ActionType = 'feedback' | 'assist' | 'generate' | 'analyze' | 'status';

export type RequestSource = 'web' | 'openclaw';

export interface AgentContext {
  // Tier 1: Always included (compact)
  project: {
    id: string;
    name: string;
    status: string;
    currentStep: number;
    step0Status: string;
  };
  user: {
    id: string;
    role: string;
    name: string;
  };
  currentStep: number;
  currentModule: string;

  // Tier 2: Included based on agent needs (medium)
  step0Data?: Record<string, unknown>;
  currentStepData?: Record<string, unknown>;
  previousModules?: ModuleSummary[];

  // Tier 3: Included only when required (heavy)
  allStepsData?: Record<number, unknown>;
  feedbackHistory?: FeedbackIAOutput[];
  conversationHistory?: ConversationMessage[];
}

export interface ModuleSummary {
  stepNumber: number;
  moduleId: string;
  status: string;
  summary: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface OrchestratorRequest {
  requestId: string;
  userId: string;
  projectId: string;
  targetAgent: AgentId;
  action: ActionType;
  context: AgentContext;
  payload: Record<string, unknown>;
  constraints: {
    maxTokens: number;
    temperature: number;
    costCeiling: number;
    timeoutMs: number;
  };
  metadata: {
    source: RequestSource;
    platform?: 'whatsapp' | 'telegram';
    timestamp: string;
  };
}

export interface AgentResponse {
  requestId: string;
  agentId: AgentId;
  status: 'success' | 'partial' | 'error';
  data: Record<string, unknown>;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface FeedbackIAOutput {
  status: 'Aprobado' | 'Iterar' | 'Bloqueado';
  summary: string;
  goodPoints: string[];
  missing: string[];
  actions: string[];
  questions: string[];
  contradictions: string[];
}

export interface MentorVirtualFeedback {
  claro: string[];
  faltaPrecisar: string[];
  preguntas: string[];
  siguienteAccion: string;
}

export interface AIInvokeRequest {
  agentHint?: string;
  step: number;
  module?: string;
  action: ActionType;
  payload: Record<string, unknown>;
}

export interface AIInvokeResponse {
  data: Record<string, unknown>;
  agent: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}
```

### Business logic (step by step)

```
1. Instalar dependencias: cd backend && npm install ai @ai-sdk/anthropic zod
2. Crear directorios:
   - backend/modules/ai/agents/
   - backend/modules/ai/context/
   - backend/modules/ai/cost/
   - backend/modules/ai/types/
   - backend/modules/openclaw/
3. Crear agent.types.ts con todas las interfaces definidas arriba
4. Crear cada archivo placeholder con exportaciones minimas:
   - Routers: exportar Router de Express con rutas stub que retornan 501 Not Implemented
   - Controllers: exportar funciones handler stub
   - Services: exportar clases con metodos stub que lanzan NotImplementedError
   - Agents: exportar clases con metodo invoke() stub
5. Modificar app.ts:
   - Import aiRouter desde './modules/ai/ai.router'
   - Import openclawRouter desde './modules/openclaw/openclaw.router'
   - Registrar: app.use('/api/v1/ai', aiRouter)
   - Registrar: app.use('/api/v1/openclaw', openclawRouter)
6. Agregar modelos Prisma (AIUsage, OpenClawConversation) al schema
7. Ejecutar: npx prisma migrate dev --name add-ai-usage-openclaw-models
8. Verificar que npm run build compila sin errores
```

### Error handling

| Error condition | Detection | Response |
|---|---|---|
| Dependencia npm no se instala | npm install falla | Verificar version de Node, reintentar con --legacy-peer-deps si necesario |
| Prisma migration falla | prisma migrate retorna error | Verificar schema syntax, verificar conexion a DB |
| TypeScript no compila | npm run build falla | Corregir errores de tipos en archivos creados |

---

## Test requirements

### Write tests FIRST

Este task usa patron test-first simplificado dado que es scaffolding:

1. Escribir test de importacion para verificar que todos los modulos exportan correctamente
2. Verificar que las rutas responden 501 (Not Implemented)
3. Verificar que los tipos compilan sin error

### Unit tests

**File:** `backend/__tests__/modules/ai/scaffolding.test.ts`

```typescript
describe('AI Module Scaffolding', () => {
  describe('agent.types.ts', () => {
    it('should export all agent type interfaces', () => {
      const types = require('../../modules/ai/types/agent.types');
      expect(types).toBeDefined();
    });
  });

  describe('ai.router.ts', () => {
    it('should export a Router instance', () => {
      const { aiRouter } = require('../../modules/ai/ai.router');
      expect(aiRouter).toBeDefined();
    });
  });

  describe('ai.service.ts', () => {
    it('should export AIService class', () => {
      const { AIService } = require('../../modules/ai/ai.service');
      expect(AIService).toBeDefined();
    });
  });
});

describe('OpenClaw Module Scaffolding', () => {
  describe('openclaw.router.ts', () => {
    it('should export a Router instance', () => {
      const { openclawRouter } = require('../../modules/openclaw/openclaw.router');
      expect(openclawRouter).toBeDefined();
    });
  });
});
```

### Integration tests

**File:** `backend/__tests__/modules/ai/routes-stub.integration.test.ts`

Test the complete flow including:
- [ ] Happy path: GET /api/v1/ai/* retorna 501 (rutas stub registradas)
- [ ] Happy path: POST /api/v1/openclaw/webhook retorna 501 (ruta stub registrada)
- [ ] Boundary: rutas inexistentes retornan 404

---

## Acceptance criteria

- [ ] **AC-001:** Directorio `backend/modules/ai/` existe con toda la estructura de archivos segun seccion 12 de architecture-multiagent.md
- [ ] **AC-002:** Directorio `backend/modules/openclaw/` existe con toda la estructura de archivos
- [ ] **AC-003:** `backend/modules/ai/types/agent.types.ts` contiene todas las interfaces: AgentId, AgentContext, OrchestratorRequest, AgentResponse, FeedbackIAOutput, MentorVirtualFeedback, AIInvokeRequest, AIInvokeResponse
- [ ] **AC-004:** `backend/app.ts` registra rutas `/api/v1/ai` y `/api/v1/openclaw`
- [ ] **AC-005:** `front/prisma/schema.prisma` contiene modelos AIUsage y OpenClawConversation con indices correctos
- [ ] **AC-006:** Prisma migration ejecutada exitosamente
- [ ] **AC-007:** `npm run build` compila sin errores de TypeScript
- [ ] **AC-008:** Dependencias `ai`, `@ai-sdk/anthropic`, `zod` presentes en package.json

---

## Definition of done

This task is COMPLETE when:

- [ ] All acceptance criteria above pass
- [ ] `npm run lint` passes with 0 errors
- [ ] TypeScript compiles with 0 errors (`npm run build`)
- [ ] PR opened (not merged) with title: `feat(TASK-001): Backend scaffolding para modulos ai/ y openclaw/`
- [ ] `project/.sdlc/knowledge/progress-TASK-001-[date].md` written
- [ ] No files modified outside the scope section above

---

## Session close instructions

Before ending this session, write `project/.sdlc/knowledge/progress-TASK-001-[date].md`:

```markdown
# Progress: TASK-001 -- [date]

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
