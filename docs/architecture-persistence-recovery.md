---
id: ARCH-PERSIST-001
status: proposed
date: 2026-04-06
parent: SPEC-001
author: architecture-agent
---

# Architecture: Persistence and State Recovery

## 1. Problem Statement

The Starteria dashboard has six critical gaps between its backend capabilities and frontend behavior:

1. **AppContext** uses `MOCK_PROJECTS` / `MOCK_USERS` hardcoded arrays; login never hits the backend.
2. **useAutosave()** fakes saves with `setTimeout`; no API call is made.
3. **Access token** lives in `sessionStorage` and is lost when the tab closes.
4. **No position tracking**: when a user returns, the app cannot resume where they left off.
5. **No real draft persistence**: module form data never reaches the server.
6. **No conflict resolution**: two tabs can silently overwrite each other.

The backend already exposes the building blocks needed: `PUT /:projectId/steps/:number/data` saves arbitrary JSON into `Step.stepData`, and the auth system has JWT access + httpOnly refresh token rotation.

---

## 2. Architecture Decisions

### 2.1 Autosave: Real `useAutosave` Hook

**Decision**: Replace the fake `useAutosave` with a debounced PATCH/PUT to the existing `PUT /projects/:projectId/steps/:number/data` endpoint.

**Flow**:

```
User types in module form
        |
        v
[Local state update via setState]
        |
        v
[useAutosave hook: reset debounce timer (2000ms)]
        |
        v
(timer fires)
        |
        v
[Build stepData payload from all modules in the step]
        |
        v
[PUT /api/v1/projects/{pid}/steps/{n}/data]
   body: { modules: { [moduleId]: { ...formData } }, _meta: { savedAt, savedBy, version } }
        |
   +----+----+
   |         |
  200       4xx/5xx/network
   |         |
   v         v
[state=saved] [state=error, queue retry (max 3, exponential backoff)]
```

**Endpoint used**: `PUT /api/v1/projects/:projectId/steps/:number/data` (already exists in `step.router.ts`).

**Why PUT, not PATCH**: The `saveStepData` service already does a full replace of the `stepData` JSON field. A partial merge (PATCH) would require a new service method. For MVP, full-document replace is acceptable because the frontend holds the complete step state.

**Debounce strategy**: 2000ms after the last keystroke. The hook accepts an `async saveFn` parameter and returns `{ state, lastSavedAt, error, retry }`.

**Error handling**:
- Network errors: retry up to 3 times with exponential backoff (2s, 4s, 8s).
- 401: let the existing axios interceptor refresh the token and replay.
- 409 (conflict): show user a toast with "Data was modified elsewhere. Reload?"
- 5xx: show `AutosaveIndicator` in error state, stop retrying, let user trigger manual save.

**Hook signature** (new file: `front/src/app/hooks/useAutosave.ts`):

```typescript
interface UseAutosaveOptions<T> {
  data: T;
  saveFn: (data: T) => Promise<void>;
  delay?: number;           // default 2000
  enabled?: boolean;        // default true
  maxRetries?: number;      // default 3
}

interface UseAutosaveReturn {
  state: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  error: Error | null;
  retrySave: () => void;
  isDirty: boolean;
}
```

**Trade-off**: Full-document save is simpler but sends more data per save. At the current payload sizes (< 20KB per step), this is negligible. If payloads grow, switch to JSON Merge Patch (RFC 7396) and add a `PATCH` variant to `StepService`.

---

### 2.2 Backend Data Loading in AppContext

**Decision**: Replace `MOCK_PROJECTS` / `MOCK_USERS` with real API calls. Use **lazy loading per entity** with an eager initial load of the project list.

**Migration strategy (incremental, 3 phases)**:

**Phase 1 -- Auth bridge** (no mock removal yet):
- After `authService.login()` succeeds, store user from response in AppContext.
- After page reload, call `GET /auth/me` to restore user (the refresh-token httpOnly cookie survives reload).
- Keep `MOCK_PROJECTS` as fallback while backend seeds are stabilized.

**Phase 2 -- Project list from backend**:
- On `AppProvider` mount (if authenticated), call `GET /api/v1/projects`.
- Map backend response to the frontend `Project` type using a thin adapter layer.
- Remove `MOCK_PROJECTS`.

**Phase 3 -- Step/module data from backend**:
- When a StepPage mounts, call `GET /api/v1/projects/:id/steps/:n/data` to load `stepData`.
- Populate module forms from `stepData.modules[moduleId]`.

**New hooks**:

| Hook | Endpoint | Trigger |
|------|----------|---------|
| `useProjects()` | `GET /projects` | AppProvider mount |
| `useProject(id)` | `GET /projects/:id` | ProjectHomePage mount |
| `useStepData(pid, n)` | `GET /projects/:pid/steps/:n/data` | StepPage mount |

**Loading states**: Each hook returns `{ data, isLoading, error }`. Pages show skeleton UI while loading.

**Adapter layer** (`front/src/app/services/project.adapter.ts`): Maps backend enums (`IN_PROGRESS`) to frontend display strings (`En progreso`). This is the inverse of the existing `StatusMapper` on the backend.

---

### 2.3 User Position Tracking

**Decision**: Add a `lastPosition` JSON field to the `Project` model. No new Prisma model needed.

**Schema change** (single migration):

```prisma
model Project {
  // ... existing fields ...
  lastPosition Json?  // { stepNumber: number, moduleId: string, scrollY?: number, timestamp: string }
}
```

**JSON structure**:

```typescript
interface LastPosition {
  stepNumber: number;
  moduleId: string | null;
  scrollY?: number;
  timestamp: string; // ISO 8601
}
```

**Why on Project, not on User**: A user can have multiple projects. Position is per-project, not global. Putting it on User would require a map of `projectId -> position`, which is less clean than a field on the entity itself.

**Why not a separate table**: Adding a table for a single JSON blob is over-engineering. The field changes infrequently (when user navigates), and reads happen only on project load.

**New endpoint**:

```
PATCH /api/v1/projects/:id/position
Body: { stepNumber: 1, moduleId: "A" }
```

This is a lightweight addition to `ProjectController`. No state machine validation needed -- position is purely informational.

**Frontend behavior**:
- On step/module navigation, fire a debounced (5s) PATCH to update position.
- On project load, read `lastPosition` from the project response and offer to resume: "Continuar donde lo dejaste (Step 1, Modulo A)?".

**Trade-offs considered**:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Field on User | Global, one query | Multi-project messy, requires map | Rejected |
| Field on Project | Natural, simple | Shared across team members | **Selected** (per-user override via `lastPosition: { [userId]: ... }` if needed later) |
| Separate table `UserProjectPosition` | Normalized, per-user | Extra join, new migration, overkill | Rejected |

---

### 2.4 Session Persistence (Token Storage)

**Decision**: Hybrid approach -- keep access token in memory (JavaScript variable) and rely on httpOnly refresh cookie for persistence across tab closes.

**Current state**:
- Access token: `sessionStorage.setItem('accessToken', token)` -- lost on tab close.
- Refresh token: httpOnly cookie (already set by backend on login/refresh).

**Target state**:

| Token | Storage | Survives tab close | Survives browser close |
|-------|---------|-------------------|----------------------|
| Access token | In-memory variable (module-scoped in `api.ts`) | No | No |
| Refresh token | httpOnly secure cookie | Yes | Yes (until expiry) |

**Flow on page load**:
1. `api.ts` initializes with `let accessToken: string | null = null`.
2. On first API call, interceptor sees no token, triggers silent refresh via `POST /auth/refresh` (cookie sent automatically).
3. If refresh succeeds: store new access token in memory, retry original request.
4. If refresh fails (cookie expired): redirect to `/auth`.

**Why NOT localStorage**:
- XSS vulnerability: any injected script can read `localStorage`.
- `sessionStorage` at least scopes to the tab, but the real fix is to not persist the access token at all.
- The access token is short-lived (15 min) and can always be regenerated from the refresh cookie.

**Migration steps**:
1. Remove `sessionStorage.setItem('accessToken', ...)` from `auth.service.ts`.
2. Replace with module-scoped variable in `api.ts`.
3. Update interceptors to attempt silent refresh on 401.
4. Update `authService.isAuthenticated()` to call a sync check (access token in memory) or an async check (try refresh).

**Trade-off**: The user must wait for one refresh round-trip on page load before the first API call succeeds. This adds ~200-400ms to initial load but eliminates XSS token theft.

---

### 2.5 Draft State Management via `Step.stepData`

**Decision**: Use the existing `Step.stepData` (JSON) field to store all module drafts for a given step. No new Prisma models.

**JSON structure for `stepData`**:

```typescript
interface StepData {
  _meta: {
    version: number;           // Optimistic locking counter
    lastSavedAt: string;       // ISO 8601
    lastSavedBy: string;       // userId
  };
  modules: {
    [moduleId: string]: ModuleDraft;
  };
}

interface ModuleDraft {
  status: 'empty' | 'partial' | 'complete';
  completeness: number;        // 0-100, calculated on save
  updatedAt: string;
  data: Record<string, unknown>; // Module-specific form data
}
```

**Example for Step 1**:

```json
{
  "_meta": {
    "version": 14,
    "lastSavedAt": "2026-04-06T15:30:00Z",
    "lastSavedBy": "clxyz123"
  },
  "modules": {
    "A": {
      "status": "complete",
      "completeness": 100,
      "updatedAt": "2026-04-05T10:00:00Z",
      "data": {
        "casoReal": "El proceso de onboarding tarda 21 dias...",
        "pasos": ["Solicitud", "Aprobacion", "Setup TI", "Capacitacion"],
        "quiebreIndex": 2,
        "quiebreDetalle": "Setup de TI toma 7 dias por falta de automatizacion",
        "quiebre": "Bottleneck en TI",
        "consecuencia": "Empleado sin herramientas la primera semana",
        "consequenceTags": ["operativa", "humana"],
        "causaInmediata": "Proceso manual de creacion de cuentas",
        "evidenciaTipo": "dato",
        "evidenciaNota": "Datos del ticket system muestran 7.2 dias promedio",
        "alcance": "durante",
        "corteAlcance": "Solo nuevos empleados corporativos"
      }
    },
    "B": {
      "status": "partial",
      "completeness": 40,
      "updatedAt": "2026-04-06T15:30:00Z",
      "data": {
        "metricaBase": "21 dias de onboarding",
        "metricaMeta": "5 dias",
        "categoriaImpacto": "productividad"
      }
    },
    "C": {
      "status": "empty",
      "completeness": 0,
      "updatedAt": null,
      "data": {}
    }
  }
}
```

**Completeness calculation**: Each module type defines which fields are required for `complete` status. A helper function (`calculateModuleCompleteness`) counts filled required fields / total required fields. This drives the `ProgressBar` percentage.

**Why this structure**:
- Single read/write per step (one DB call to load all module drafts).
- `_meta.version` enables optimistic locking.
- `modules[id].status` gives quick overview without parsing all form data.
- The structure is extensible: new modules or fields can be added without migration.

---

### 2.6 Conflict Resolution

**Decision**: Optimistic locking with last-write-wins fallback.

**Mechanism**:

1. On load, the frontend receives `stepData._meta.version` (integer).
2. On save, the frontend sends the version it loaded:
   ```
   PUT /projects/:pid/steps/:n/data
   Headers: X-StepData-Version: 14
   Body: { _meta: { version: 15, ... }, modules: { ... } }
   ```
3. Backend checks: if `current DB version > received version`, return `409 Conflict` with the current server data.
4. Frontend shows a non-blocking dialog: "Someone else saved changes. [Load their version] [Overwrite with mine]".

**Backend change** (in `StepService.saveStepData`):

```typescript
async saveStepData(
  projectId: string,
  stepNumber: number,
  data: Record<string, unknown>,
  expectedVersion?: number
): Promise<{ conflict: boolean; currentData?: Record<string, unknown> }> {
  const step = await this.prisma.step.findFirst({
    where: { projectId, number: stepNumber },
  });
  if (!step) throw AppError.notFound(`Paso ${stepNumber}`);

  const currentMeta = (step.stepData as any)?._meta;
  const currentVersion = currentMeta?.version ?? 0;

  if (expectedVersion !== undefined && expectedVersion < currentVersion) {
    return { conflict: true, currentData: step.stepData as any };
  }

  await this.prisma.step.update({
    where: { id: step.id },
    data: { stepData: data as any },
  });

  return { conflict: false };
}
```

**Why not real-time sync (WebSocket/CRDT)**:
- The app is primarily single-user per project at any given time.
- Adding WebSocket infrastructure is a significant complexity increase.
- The two-tab scenario is edge-case, not primary use case.
- Optimistic locking with version numbers is well-understood and cheap.

**Tab coordination** (bonus, low priority): Use `BroadcastChannel` API to notify other tabs of the same origin when a save occurs. This avoids stale reads without server-side push.

```typescript
const channel = new BroadcastChannel('starteria-autosave');
channel.postMessage({ type: 'STEP_DATA_SAVED', projectId, stepNumber, version });
channel.onmessage = (event) => {
  if (event.data.type === 'STEP_DATA_SAVED') {
    // Invalidate local cache, refetch
  }
};
```

---

## 3. Endpoints Summary

### Existing endpoints (no changes needed):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/projects` | List user's projects |
| `GET` | `/projects/:id` | Get project with steps, modules, team |
| `GET` | `/projects/:id/steps/:n/data` | Get stepData JSON |
| `PUT` | `/projects/:id/steps/:n/data` | Save stepData JSON |
| `GET` | `/auth/me` | Get current user from token |
| `POST` | `/auth/refresh` | Refresh access token via cookie |

### Modified endpoints:

| Method | Path | Change |
|--------|------|--------|
| `PUT` | `/projects/:id/steps/:n/data` | Add `X-StepData-Version` header support, return `409` on conflict |

### New endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `PATCH` | `/projects/:id/position` | Update user's last position in project |

---

## 4. New/Modified Files

### Frontend:

| File | Action | Description |
|------|--------|-------------|
| `front/src/app/hooks/useAutosave.ts` | **Create** | Real debounced autosave hook with retry logic |
| `front/src/app/hooks/useProjects.ts` | **Create** | Fetch projects from backend |
| `front/src/app/hooks/useStepData.ts` | **Create** | Load/save stepData with version tracking |
| `front/src/app/hooks/usePosition.ts` | **Create** | Track and restore user position |
| `front/src/app/services/project.adapter.ts` | **Create** | Map backend enums to frontend display strings |
| `front/src/app/context/AppContext.tsx` | **Modify** | Replace mocks with real API calls (phased) |
| `front/src/app/services/api.ts` | **Modify** | Move token to in-memory variable, add silent refresh on load |
| `front/src/app/services/auth.service.ts` | **Modify** | Remove sessionStorage usage |
| `front/src/app/components/AutosaveIndicator.tsx` | **Modify** | Keep UI component, remove fake `useAutosave` (replaced by hook) |
| `front/src/app/pages/Step1Page.tsx` | **Modify** | Wire up `useStepData` + real `useAutosave` |

### Backend:

| File | Action | Description |
|------|--------|-------------|
| `backend/modules/steps/step.service.ts` | **Modify** | Add version check to `saveStepData` |
| `backend/modules/steps/step.controller.ts` | **Modify** | Read `X-StepData-Version` header, return 409 |
| `backend/modules/projects/project.service.ts` | **Modify** | Add `updatePosition` method |
| `backend/modules/projects/project.controller.ts` | **Modify** | Add `updatePosition` handler |
| `backend/modules/projects/project.router.ts` | **Modify** | Add `PATCH /:id/position` route |
| `front/prisma/schema.prisma` | **Modify** | Add `lastPosition Json?` to Project model |

---

## 5. Incremental Migration Plan

### Sprint 1, Week 1: Foundation (No visible UI change)

**Priority: Highest -- unblocks everything else.**

1. **Token storage migration** (api.ts + auth.service.ts)
   - Move access token to in-memory variable.
   - Add silent refresh on first API call after page load.
   - Remove all `sessionStorage` references.
   - Risk: Low. The refresh cookie mechanism already works.

2. **Auth bridge in AppContext** (Phase 1)
   - After login, store user from backend response (not from `MOCK_USERS`).
   - On mount, call `GET /auth/me` to restore session.
   - Keep `MOCK_USERS` as fallback for demo mode (feature flag).

### Sprint 1, Week 2: Data Loading

3. **Project list from backend** (Phase 2)
   - Create `useProjects()` hook.
   - Create `project.adapter.ts` for enum mapping.
   - Replace `MOCK_PROJECTS` initialization with API call.
   - Add loading/error states to DashboardPage.

4. **StepData loading** (Phase 3)
   - Create `useStepData(pid, n)` hook.
   - On Step1Page mount, load `stepData` from backend.
   - Populate module form fields from `stepData.modules[moduleId].data`.

### Sprint 2, Week 1: Autosave and Drafts

5. **Real useAutosave hook**
   - Create `front/src/app/hooks/useAutosave.ts`.
   - Wire into Step1Page: on form change, debounce save to `PUT .../data`.
   - Update `AutosaveIndicator` to use real state.

6. **stepData JSON structure**
   - Define `_meta` + `modules` structure.
   - Backend: add version check to `saveStepData`.
   - Frontend: include `X-StepData-Version` header on save.

### Sprint 2, Week 2: Position and Conflict

7. **Position tracking**
   - Add `lastPosition` field to Prisma schema, run migration.
   - Add `PATCH /projects/:id/position` endpoint.
   - Create `usePosition()` hook.
   - On StepPage navigation, save position (debounced 5s).
   - On ProjectHomePage load, show "Resume" prompt.

8. **Conflict resolution**
   - Backend returns 409 on version mismatch.
   - Frontend shows conflict dialog.
   - Optional: add `BroadcastChannel` for same-browser tab coordination.

---

## 6. Sequence Diagrams

### 6.1 Autosave Flow

```
User          Step1Page        useAutosave       api.ts          Backend
 |  type text    |                |                |                |
 |-------------->| setState()    |                |                |
 |               |--debounce(2s)->|                |                |
 |               |               | (timer fires)  |                |
 |               |               |-- PUT /data --->|                |
 |               |               |                |-- PUT /data --->|
 |               |               |                |<--- 200 --------|
 |               |               |<-- resolved ----|                |
 |               |<- state=saved-|                |                |
 |  (indicator)  |               |                |                |
 |<--------------|               |                |                |
```

### 6.2 Page Load with Session Restore

```
Browser         api.ts         Backend         AppContext       StepPage
 | (page load)   |               |               |               |
 | req /projects |               |               |               |
 |-------------->| no token      |               |               |
 |               |-- POST /refresh (cookie) ---->|               |
 |               |<-- 200 { accessToken } -------|               |
 |               | store in memory               |               |
 |               |-- GET /projects -------------->|               |
 |               |<-- 200 [projects] ------------|               |
 |               |               |               |<- setProjects |
 |               |               |               |----render---->|
 |               |               |               |               |-- GET /steps/1/data -->|
 |               |               |               |               |<-- 200 { stepData } ---|
 |               |               |               |               | populate forms         |
```

### 6.3 Conflict Detection

```
Tab A           Tab B           Backend
 | load v=5      | load v=5      |
 | edit...       | edit...       |
 |               |-- PUT v=6 --->|
 |               |<-- 200 -------|
 |-- PUT v=6 --->|               |
 |<-- 409 -------|               |  (server has v=6, tab A sends v=5+1=6
 |               |               |   but DB already has v=6 from Tab B)
 | show dialog   |               |
 | [Load / Overwrite]            |
```

---

## 7. Risk Analysis

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Backend returns data in different shape than frontend expects | High | Medium | Adapter layer (`project.adapter.ts`) isolates mapping |
| Silent refresh fails on first load (cookie expired) | Medium | Low | Redirect to `/auth` gracefully, user re-logs |
| Autosave fires too frequently under fast typing | Low | Medium | Debounce at 2000ms; skip save if data unchanged (`deepEqual` check) |
| Large stepData JSON slows DB writes | Low | Low | Current payload < 20KB; add monitoring on p95 write latency |
| Version conflict annoys users | Medium | Low | Only show dialog if actual data differs (not just version bump) |
| Demo/seed mode breaks when mocks are removed | Medium | High | Keep a `DEMO_MODE` env flag that loads mock data for demos |

---

## 8. Observability

- **Autosave metrics**: Track `autosave.success`, `autosave.error`, `autosave.retry` counts in frontend analytics (or console in dev).
- **Backend**: Log `stepData` write latency per request in existing pino logger.
- **Conflict rate**: Log 409 responses; if > 5% of saves, consider adding real-time sync.
- **Position tracking**: Log adoption rate (how many users resume vs start fresh).
