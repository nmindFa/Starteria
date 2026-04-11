---
id: TASK-000
title: "Capa base de persistencia y recuperacion de estado"
status: ready
spec: SPEC-001
adrs: []
sprint: S-01
parallel: false
depends_on: []
estimated_tokens: 24K
session_handoff: null
priority: critical
---

# TASK-000: Base Persistence Layer (Pre-sprint Phase 0)

## Task context

**Feature:** Capa de persistencia para todo el sistema multi-agente (SPEC-001)
**Purpose:** Conectar el frontend React con los endpoints backend existentes para que los datos del usuario se persistan en PostgreSQL, el autosave sea real, y el usuario pueda cerrar el navegador y retomar donde se quedo. Sin esta capa, los agentes IA de TASK-002+ recibiran datos vacios o mock, invalidando toda la funcionalidad del sprint S-01.
**Session type:** Fresh start
**Blocking:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005

---

## Session start instructions

```
Session context for TASK-000:

Read these files in order before doing anything else:
1. docs/architecture-persistence-recovery.md        -> architecture decisions for persistence
2. front/src/app/context/AppContext.tsx              -> current frontend state (mock-based)
3. front/src/app/services/api.ts                    -> axios instance with interceptors
4. front/src/app/services/auth.service.ts           -> real auth service (already calls backend)
5. front/src/app/components/AutosaveIndicator.tsx   -> fake autosave (must be replaced)
6. backend/modules/steps/step.router.ts             -> existing step endpoints
7. backend/modules/projects/project.controller.ts   -> existing project endpoints
8. backend/modules/auth/auth.router.ts              -> existing auth endpoints (GET /me, POST /refresh)

Confirm understanding by stating:
- What you will implement
- Which files you will create or modify (list them)
- What the definition of done is

Wait for my confirmation before proceeding.
```

---

## Problem statement

El frontend de Starteria opera 100% con datos mock en memoria:

| Gap | Descripcion | Impacto |
|-----|-------------|---------|
| G1 | `AppContext` usa `MOCK_PROJECTS` y `MOCK_USERS` hardcoded | Todo el estado se pierde al refrescar |
| G2 | `useAutosave()` hace setTimeout sin llamar API | Usuario ve "Guardado" pero nada se persiste |
| G3 | Access token en `sessionStorage` | Se pierde al cerrar pestana |
| G4 | No hay tracking de ultima posicion | Usuario no puede retomar donde estaba |
| G5 | No hay draft autosave real | Formularios parciales se pierden |
| G6 | No hay carga de estado desde backend | Componentes no hidratan datos reales |

El backend YA tiene todos los endpoints necesarios:
- `GET /api/v1/auth/me` -- restaurar sesion
- `POST /api/v1/auth/refresh` -- refresh token (httpOnly cookie)
- `GET /api/v1/projects` -- listar proyectos del usuario
- `GET /api/v1/projects/:id` -- detalle de proyecto
- `GET/PATCH /api/v1/projects/:id/step0` -- datos Step 0
- `GET /api/v1/projects/:id/steps/:n/data` -- leer datos de step
- `PUT /api/v1/projects/:id/steps/:n/data` -- guardar datos de step (JSON blob)

---

## Scope

### Files to CREATE

| File path | Purpose |
|-----------|---------|
| `front/src/app/services/projectService.ts` | Service layer: CRUD de proyectos via API |
| `front/src/app/services/stepService.ts` | Service layer: lectura/escritura de step data via API |
| `front/src/app/services/project.adapter.ts` | Mapeo de enums backend (IN_PROGRESS) a frontend (En progreso) y viceversa |
| `front/src/app/hooks/useAutosave.ts` | Hook real de autosave con debounce, retry y error handling |
| `front/src/app/hooks/useStepData.ts` | Hook para cargar stepData del backend al montar StepPage |
| `front/src/app/hooks/useProjects.ts` | Hook para cargar proyectos del backend |

### Files to MODIFY

| File path | Change description |
|-----------|-------------------|
| `front/src/app/context/AppContext.tsx` | Fase 1: login llama backend real. Fase 2: cargar proyectos de GET /projects en mount. Fase 3: eliminar MOCK_PROJECTS |
| `front/src/app/services/api.ts` | Mover token de sessionStorage a variable in-memory. Agregar silent refresh en mount |
| `front/src/app/services/auth.service.ts` | Eliminar sessionStorage, usar variable in-memory compartida con api.ts |
| `front/src/app/components/AutosaveIndicator.tsx` | Mantener UI, reemplazar hook falso por re-export del hook real |
| `front/src/app/pages/Step0Page.tsx` | Usar useStepData para cargar, useAutosave para guardar, llamar API real en handleSave |
| `front/src/app/pages/Step1Page.tsx` | Idem: cargar stepData del backend, autosave real por modulo |
| `front/src/app/pages/Step2Page.tsx` | Idem |
| `front/src/app/pages/Step3Page.tsx` | Idem |
| `front/src/app/pages/Step4Page.tsx` | Idem |
| `front/prisma/schema.prisma` | Agregar campo `lastPosition Json?` al modelo Project |
| `backend/modules/projects/project.controller.ts` | Agregar endpoint `updatePosition` |
| `backend/modules/projects/project.service.ts` | Agregar metodo `updateLastPosition` |
| `backend/modules/projects/project.router.ts` | Registrar ruta `PATCH /:id/position` |

### Files to NOT TOUCH

- `backend/modules/auth/` -- auth backend ya funciona correctamente
- `backend/modules/ai/` -- se implementa en TASK-001+
- `backend/modules/openclaw/` -- se implementa en TASK-005
- `docs/adr/` -- no se modifican ADRs en tasks de implementacion

---

## Implementation specification

### P1: Token migration + Auth bridge

#### api.ts changes

```typescript
// front/src/app/services/api.ts

// BEFORE: sessionStorage.getItem('accessToken')
// AFTER: in-memory variable
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Request interceptor uses in-memory token
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: on 401, try silent refresh via httpOnly cookie
// (existing logic already does this, just remove sessionStorage calls)
```

#### auth.service.ts changes

```typescript
// Replace all sessionStorage.setItem('accessToken', token) with:
import { setAccessToken } from './api';

// login:
setAccessToken(token);

// logout:
setAccessToken(null);

// isAuthenticated:
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
```

#### AppContext.tsx auth bridge

```typescript
// On mount, try silent refresh to restore session:
useEffect(() => {
  async function restoreSession() {
    try {
      const token = await authService.refreshToken();
      setAccessToken(token);
      const user = await authService.getMe();
      setUser(mapBackendUser(user));
      setIsAuthenticated(true);
    } catch {
      // No valid session, user must login
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }
  restoreSession();
}, []);

// login() calls real backend instead of MOCK_USERS:
async function login(email: string, password: string) {
  try {
    const result = await authService.login(email, password);
    setUser(mapBackendUser(result.user));
    setIsAuthenticated(true);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

### P2: Frontend service layer

#### projectService.ts

```typescript
import api from './api';
import { adaptProject, adaptProjectToBackend } from './project.adapter';

export const projectService = {
  async list() {
    const { data } = await api.get('/projects');
    return data.data.map(adaptProject);
  },

  async getById(id: string) {
    const { data } = await api.get(`/projects/${id}`);
    return adaptProject(data.data);
  },

  async update(id: string, updates: Record<string, unknown>) {
    const { data } = await api.patch(`/projects/${id}`, adaptProjectToBackend(updates));
    return adaptProject(data.data);
  },

  async updatePosition(id: string, position: { stepNumber: number; moduleId?: string }) {
    await api.patch(`/projects/${id}/position`, position);
  },

  async getStep0(id: string) {
    const { data } = await api.get(`/projects/${id}/step0`);
    return data.data;
  },

  async updateStep0(id: string, step0Data: Record<string, unknown>, status: string) {
    const { data } = await api.patch(`/projects/${id}/step0`, { ...step0Data, status });
    return adaptProject(data.data);
  },
};
```

#### stepService.ts

```typescript
import api from './api';

export const stepService = {
  async getAll(projectId: string) {
    const { data } = await api.get(`/projects/${projectId}/steps`);
    return data.data;
  },

  async getData(projectId: string, stepNumber: number) {
    const { data } = await api.get(`/projects/${projectId}/steps/${stepNumber}/data`);
    return data.data;
  },

  async saveData(projectId: string, stepNumber: number, stepData: Record<string, unknown>) {
    await api.put(`/projects/${projectId}/steps/${stepNumber}/data`, stepData);
  },

  async updateModuleStatus(projectId: string, stepNumber: number, moduleId: string, status: string) {
    await api.patch(`/projects/${projectId}/steps/${stepNumber}/modules/${moduleId}`, { status });
  },
};
```

#### project.adapter.ts

```typescript
// Maps backend enums to frontend display strings
const STATUS_MAP = {
  project: {
    toFrontend: {
      DRAFT: 'Draft',
      IN_PROGRESS: 'En progreso',
      AI_REVIEW: 'En revision IA',
      ITERATION: 'Iteracion',
      EXPERT_SESSION_PENDING: 'Sesion experto pendiente',
      STEP_APPROVED: 'Paso aprobado',
      COMPLETED: 'Finalizado',
    },
    toBackend: {} as Record<string, string>, // computed inverse
  },
  step: {
    toFrontend: {
      NOT_STARTED: 'No iniciado',
      IN_PROGRESS: 'En progreso',
      SUBMITTED: 'Enviado',
      AI_FEEDBACK: 'Feedback IA',
      ADJUSTED: 'Ajustado',
      EXPERT_SESSION_PENDING: 'Sesion experto pendiente',
      APPROVED: 'Aprobado',
      BLOCKED: 'Bloqueado',
    },
    toBackend: {} as Record<string, string>,
  },
  module: {
    toFrontend: {
      DRAFT: 'Draft',
      IN_PROGRESS: 'En progreso',
      COMPLETED: 'Completado',
      BLOCKED: 'Bloqueado',
      SUBMITTED: 'Enviado',
      AI_FEEDBACK: 'Feedback IA',
      ADJUSTED: 'Ajustado',
      APPROVED: 'Aprobado',
    },
    toBackend: {} as Record<string, string>,
  },
  step0: {
    toFrontend: {
      NOT_STARTED: 'No iniciado',
      IN_PROGRESS: 'En progreso',
      COMPLETED: 'Completado',
    },
    toBackend: {} as Record<string, string>,
  },
};

// Build inverse maps
for (const entity of Object.values(STATUS_MAP)) {
  entity.toBackend = Object.fromEntries(
    Object.entries(entity.toFrontend).map(([k, v]) => [v, k])
  );
}

export function adaptProject(backend: Record<string, unknown>): Record<string, unknown> {
  return {
    ...backend,
    status: STATUS_MAP.project.toFrontend[backend.status as string] ?? backend.status,
    step0Status: STATUS_MAP.step0.toFrontend[backend.step0Status as string] ?? backend.step0Status,
    steps: (backend.steps as any[])?.map(s => ({
      ...s,
      status: STATUS_MAP.step.toFrontend[s.status] ?? s.status,
      modules: s.modules?.map((m: any) => ({
        ...m,
        status: STATUS_MAP.module.toFrontend[m.status] ?? m.status,
      })),
    })),
  };
}

export function adaptProjectToBackend(frontend: Record<string, unknown>): Record<string, unknown> {
  const result = { ...frontend };
  if (result.status) {
    result.status = STATUS_MAP.project.toBackend[result.status as string] ?? result.status;
  }
  return result;
}
```

### P3: Real useAutosave hook

```typescript
// front/src/app/hooks/useAutosave.ts
import { useState, useEffect, useRef, useCallback } from 'react';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<T> {
  data: T;
  saveFn: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
  maxRetries?: number;
}

interface UseAutosaveReturn {
  state: SaveState;
  lastSavedAt: Date | null;
  error: Error | null;
  isDirty: boolean;
  retrySave: () => void;
}

export function useAutosave<T>({
  data,
  saveFn,
  delay = 2000,
  enabled = true,
  maxRetries = 3,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [state, setState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryCountRef = useRef(0);
  const lastSavedDataRef = useRef<string>('');
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const doSave = useCallback(async (dataToSave: T) => {
    const serialized = JSON.stringify(dataToSave);
    if (serialized === lastSavedDataRef.current) {
      setState('saved');
      setIsDirty(false);
      return;
    }

    setState('saving');
    try {
      await saveFnRef.current(dataToSave);
      lastSavedDataRef.current = serialized;
      setLastSavedAt(new Date());
      setState('saved');
      setIsDirty(false);
      setError(null);
      retryCountRef.current = 0;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const backoff = Math.pow(2, retryCountRef.current) * 1000;
        timerRef.current = setTimeout(() => doSave(dataToSave), backoff);
      } else {
        setState('error');
        setError(e);
      }
    }
  }, [maxRetries]);

  useEffect(() => {
    if (!enabled) return;
    setIsDirty(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSave(data), delay);
    return () => clearTimeout(timerRef.current);
  }, [data, delay, enabled, doSave]);

  const retrySave = useCallback(() => {
    retryCountRef.current = 0;
    setError(null);
    doSave(data);
  }, [data, doSave]);

  return { state, lastSavedAt, error, isDirty, retrySave };
}
```

### P4: lastPosition tracking

#### Prisma schema addition

```prisma
model Project {
  // ... existing fields ...
  lastPosition Json?  // { stepNumber: number, moduleId?: string, timestamp: string }
}
```

#### Backend endpoint

```typescript
// project.controller.ts - new method
updatePosition = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const user = req.user!;
    await this.service.updateLastPosition(req.params.id, user.id, req.body);
    res.json({ success: true, data: { message: 'Posicion actualizada' } });
  } catch (err) {
    next(err);
  }
};

// project.service.ts - new method
async updateLastPosition(projectId: string, userId: string, position: {
  stepNumber: number;
  moduleId?: string;
}) {
  await this.prisma.project.update({
    where: { id: projectId },
    data: {
      lastPosition: {
        ...position,
        userId,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

// project.router.ts - new route
projectRouter.patch('/:id/position', authenticate, controller.updatePosition);
```

### P5: stepData JSON structure for drafts

```typescript
interface StepData {
  _meta: {
    version: number;
    lastSavedAt: string;
    lastSavedBy: string;
  };
  modules: {
    [moduleId: string]: {
      status: 'empty' | 'partial' | 'complete';
      completeness: number;
      updatedAt: string;
      data: Record<string, unknown>;
    };
  };
}
```

---

## Acceptance criteria

| ID | Criteria | Test |
|----|----------|------|
| AC-001 | `AppContext.login()` calls `POST /api/v1/auth/login` (real backend) | Login con credenciales validas retorna usuario real de PG |
| AC-002 | On mount, silent refresh restores session via httpOnly cookie | Cerrar pestana, reabrir, usuario sigue autenticado |
| AC-003 | `GET /api/v1/projects` carga proyectos reales en AppContext | Dashboard muestra proyectos de la DB, no mocks |
| AC-004 | `useAutosave` hace PUT real a `/steps/:n/data` con debounce 2s | Escribir en formulario Step 0, esperar 2s, verificar en DB que step0Data tiene los datos |
| AC-005 | StepPages cargan datos del backend al montar | Navegar a Step 0, los campos se precargan con datos de DB |
| AC-006 | `lastPosition` se actualiza al navegar entre steps | PATCH /projects/:id/position se llama al entrar a un step |
| AC-007 | Al reabrir proyecto, se ofrece "Continuar donde lo dejaste" | lastPosition tiene step 1 modulo A, al abrir proyecto aparece prompt |
| AC-008 | Access token NO esta en sessionStorage ni localStorage | Inspeccion de Storage muestra vacio, token solo en variable JS |
| AC-009 | Retry con backoff exponencial en fallo de autosave | Simular error de red, verificar 3 reintentos con delays crecientes |
| AC-010 | AutosaveIndicator muestra estado real (saving/saved/error) | El indicador refleja el estado actual de la operacion PUT |

---

## Test plan

### Unit tests

```
tests/hooks/useAutosave.test.ts
  - debounce: no llama API antes de 2s
  - debounce: cancela timer previo si data cambia
  - save: llama saveFn con data correcta
  - retry: reintenta con backoff exponencial hasta maxRetries
  - skip: no guarda si data no cambio (mismo JSON)
  - error: state pasa a 'error' tras agotar retries

tests/services/projectService.test.ts
  - list: GET /projects, adapta status backend a frontend
  - getById: GET /projects/:id con adaptacion
  - updatePosition: PATCH /projects/:id/position

tests/services/stepService.test.ts
  - getData: GET /projects/:pid/steps/:n/data
  - saveData: PUT /projects/:pid/steps/:n/data

tests/services/project.adapter.test.ts
  - mapea todos los status de backend a frontend y viceversa
```

### Integration tests

```
tests/integration/persistence-flow.test.ts
  - Login real -> cargar proyectos -> navegar a Step 0 -> llenar formulario -> autosave -> cerrar -> reabrir -> datos presentes
  - Verificar lastPosition se actualiza en cada navegacion
  - Verificar silent refresh funciona tras expirar access token
```

---

## Migration plan

| Work item | Duration | Dependencies |
|-----------|----------|--------------|
| WI-1: Token migration + auth bridge (P1) | 1 dia | Ninguna |
| WI-2: Service layer + adapter (P2) | 1 dia | WI-1 |
| WI-3: useAutosave + AppContext refactor (P3) | 1 dia | WI-2 |
| WI-4: lastPosition + Step page wiring (P4-P5) | 1-2 dias | WI-3 |
| WI-5: Tests + verification | 1 dia | WI-4 |

**Total estimado:** 5-6 dias (1 semana)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DB no tiene datos seed para probar | High | Medium | Crear seed script con proyecto de prueba |
| Step pages tienen estado muy complejo (50+ campos) | Medium | Medium | Migrar step por step, empezando por Step 0 (mas simple) |
| Conflicto entre mock data y real data durante migracion | Medium | Low | Usar feature flag `USE_REAL_BACKEND` en AppContext |
| Frontend types no coinciden exactamente con backend | Low | Medium | El adapter layer maneja las diferencias |

---

*TASK spec generada siguiendo BHIL AI-First Development Toolkit*
