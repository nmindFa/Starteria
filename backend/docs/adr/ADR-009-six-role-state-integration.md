# ADR-009: Six-Role Model Integration with State Machine (ADR-006)

## Status
Proposed

## Date
2026-03-24

## Context

ADR-004 established a 4-role RBAC model (`owner`, `mentor`, `admin`, `leader`) with route-level guards. ADR-006 defined explicit state machines for Project, Step, and Module lifecycles. However, the current implementation has a critical gap: **state transitions are not role-gated**. The `validateTransition()` function in `state-machine.ts` only checks structural validity (is this transition allowed from this state?) but not authorization (is this actor allowed to trigger this transition?).

The platform is evolving from 4 roles to 6 roles:

| Old Role | New Role(s) | Rationale |
|----------|-------------|-----------|
| `owner` | `participante` | Clearer domain language: they participate in the methodology |
| `mentor` | `mentor` | Unchanged: methodological reviewer |
| `admin` | `admin` | Unchanged: platform administrator |
| `leader` | `viewer` | Leaders with read-only access become viewers |
| _(new)_ | `sponsor` | Strategic stakeholder at milestone checkpoints |
| _(new)_ | `colaborador` | Team contributor with limited transition authority |

The new model must:
1. Gate every state transition by the actor's role
2. Introduce sponsor checkpoints at Steps 0, 2, and 4
3. Support dual approval flows (mentor + sponsor) at critical milestones
4. Restrict colaboradores to content editing without major transition authority
5. Emit role-specific domain events for notification routing

## Decision

### 1. Updated Role Type

```typescript
export type Role = 'participante' | 'mentor' | 'admin' | 'sponsor' | 'colaborador' | 'viewer';
```

**Migration from old roles:**
- `owner` -> `participante` (database migration + JWT claim update)
- `leader` -> `viewer` (database migration + JWT claim update)
- New entries for `sponsor` and `colaborador` in the Role enum

---

### 2. Transition Authorization Matrix

Every state transition is now a tuple: `(currentState, targetState, requiredRoles[])`.

#### 2.1 Step Transitions

| Transition | From | To | participante | mentor | admin | sponsor | colaborador | viewer |
|------------|------|----|:------------:|:------:|:-----:|:-------:|:-----------:|:------:|
| Start step | `No iniciado` | `En progreso` | YES | - | YES | - | - | - |
| Submit for review | `En progreso` | `Enviado` | YES | - | YES | - | - | - |
| AI produces feedback | `Enviado` | `Feedback IA` | SYSTEM | SYSTEM | SYSTEM | SYSTEM | SYSTEM | SYSTEM |
| Adjust after feedback | `Feedback IA` | `Ajustado` | YES | - | YES | - | - | - |
| Block (from feedback) | `Feedback IA` | `Bloqueado` | - | YES | YES | - | - | - |
| Request expert session | `Ajustado` | `Sesion experto pendiente` | YES | - | YES | - | - | - |
| Approve step | `Sesion experto pendiente` | `Aprobado` | - | YES | YES | - | - | - |
| Request iteration | `Sesion experto pendiente` | `En progreso` | - | YES | YES | - | - | - |
| Block step | `Sesion experto pendiente` | `Bloqueado` | - | YES | YES | - | - | - |
| Unblock step | `Bloqueado` | `En progreso` | - | YES | YES | - | - | - |

**Key constraints:**
- `participante` can NEVER approve their own step (prevents self-approval)
- `colaborador` can NEVER trigger any step-level state transition
- `viewer` can NEVER trigger any state transition
- `sponsor` can NEVER directly approve/reject (that is the mentor's domain)
- `SYSTEM` transitions (AI feedback) are triggered by the system, not by any user role directly

#### 2.2 Module Transitions

| Transition | From | To | participante | mentor | admin | sponsor | colaborador | viewer |
|------------|------|----|:------------:|:------:|:-----:|:-------:|:-----------:|:------:|
| Start module | `Draft` / `Bloqueado` | `En progreso` | YES | - | YES | - | YES* | - |
| Complete module | `En progreso` | `Completado` | YES | - | YES | - | YES* | - |
| Submit module | `En progreso` | `Enviado` | YES | - | YES | - | - | - |
| Reopen module | `Completado` | `En progreso` | YES | - | YES | - | - | - |
| AI feedback | `Enviado` | `Feedback IA` | SYSTEM | SYSTEM | SYSTEM | SYSTEM | SYSTEM | SYSTEM |
| Adjust module | `Feedback IA` | `Ajustado` | YES | - | YES | - | - | - |
| Block module | `Feedback IA` | `Bloqueado` | - | YES | YES | - | - | - |
| Approve module | `Ajustado` | `Aprobado` | - | YES | YES | - | - | - |
| Reopen adjusted | `Ajustado` | `En progreso` | YES | - | YES | - | - | - |

**`*` Colaborador module permissions:** Colaboradores can start and complete modules ONLY when they have explicit module-level permissions granted by the participante. They CANNOT submit modules for review or trigger feedback-related transitions.

#### 2.3 Project Transitions

| Transition | From | To | participante | mentor | admin | sponsor | colaborador | viewer |
|------------|------|----|:------------:|:------:|:-----:|:-------:|:-----------:|:------:|
| Start project | `Draft` | `En progreso` | YES | - | YES | - | - | - |
| Enter AI review | `En progreso` | `En revision IA` | SYSTEM | - | YES | - | - | - |
| Request iteration | `En revision IA` | `Iteracion` | SYSTEM | - | YES | - | - | - |
| Request expert | `En revision IA` | `Sesion experto pendiente` | YES | - | YES | - | - | - |
| Return to progress | `Iteracion` | `En progreso` | YES | - | YES | - | - | - |
| Approve step | `Sesion experto pendiente` | `Paso aprobado` | - | YES | YES | - | - | - |
| Request iteration | `Sesion experto pendiente` | `Iteracion` | - | YES | YES | - | - | - |
| Continue next step | `Paso aprobado` | `En progreso` | YES | - | YES | - | - | - |
| Finalize project | `Paso aprobado` | `Finalizado` | - | YES | YES | YES** | - | - |
| Archive project | any | `Archivado` | - | - | YES | - | - | - |

**`**` Sponsor finalization:** The sponsor can signal strategic approval for finalization at Step 4, but the actual `Paso aprobado -> Finalizado` transition requires mentor approval. See Section 4 (Dual Approval).

---

### 3. Transition Guard Architecture

The current `validateTransition()` function is extended with a role-aware layer:

```typescript
// --- New types ---

interface TransitionContext {
  entity: 'project' | 'step' | 'module';
  currentStatus: string;
  targetStatus: string;
  actorRole: Role;
  actorId: string;
  projectId: string;
  stepNumber?: number;
  moduleId?: string;
  /** Additional context for complex guards */
  metadata?: {
    isProjectOwner: boolean;
    isSponsorCheckpointStep: boolean;
    sponsorValidationStatus?: 'pending' | 'approved' | 'flagged';
    mentorSessionResult?: 'Aprobado' | 'Iterar' | 'Bloqueado';
    colaboradorPermissions?: string[]; // module IDs they can edit
  };
}

interface TransitionResult {
  allowed: boolean;
  reason?: string;
  requiredActions?: string[]; // e.g., ['sponsor_validation_pending']
}
```

#### 3.1 Guard Function Registry

```typescript
type TransitionGuard = (ctx: TransitionContext) => TransitionResult;

// Role-level authorization map
// Key format: "entity:fromStatus:toStatus"
const roleTransitionMap: Record<string, Role[]> = {
  // Step transitions
  'step:No iniciado:En progreso':             ['participante', 'admin'],
  'step:En progreso:Enviado':                 ['participante', 'admin'],
  'step:Enviado:Feedback IA':                 [], // SYSTEM only
  'step:Feedback IA:Ajustado':                ['participante', 'admin'],
  'step:Feedback IA:Bloqueado':               ['mentor', 'admin'],
  'step:Ajustado:Sesion experto pendiente':   ['participante', 'admin'],
  'step:Sesion experto pendiente:Aprobado':   ['mentor', 'admin'],
  'step:Sesion experto pendiente:En progreso':['mentor', 'admin'],
  'step:Sesion experto pendiente:Bloqueado':  ['mentor', 'admin'],
  'step:Bloqueado:En progreso':               ['mentor', 'admin'],

  // Module transitions
  'module:Draft:En progreso':                 ['participante', 'admin', 'colaborador'],
  'module:Bloqueado:En progreso':             ['participante', 'admin', 'colaborador'],
  'module:En progreso:Completado':            ['participante', 'admin', 'colaborador'],
  'module:En progreso:Enviado':               ['participante', 'admin'],
  'module:Completado:En progreso':            ['participante', 'admin'],
  'module:Enviado:Feedback IA':               [], // SYSTEM only
  'module:Feedback IA:Ajustado':              ['participante', 'admin'],
  'module:Feedback IA:Bloqueado':             ['mentor', 'admin'],
  'module:Ajustado:Aprobado':                 ['mentor', 'admin'],
  'module:Ajustado:En progreso':              ['participante', 'admin'],

  // Project transitions
  'project:Draft:En progreso':                ['participante', 'admin'],
  'project:En progreso:En revision IA':       [], // SYSTEM
  'project:En revision IA:Iteracion':         [], // SYSTEM
  'project:En revision IA:Sesion experto pendiente': ['participante', 'admin'],
  'project:Iteracion:En progreso':            ['participante', 'admin'],
  'project:Sesion experto pendiente:Paso aprobado': ['mentor', 'admin'],
  'project:Sesion experto pendiente:Iteracion':     ['mentor', 'admin'],
  'project:Paso aprobado:En progreso':        ['participante', 'admin'],
  'project:Paso aprobado:Finalizado':         ['mentor', 'admin'],
};
```

#### 3.2 Composite Guards (Beyond Simple Role Check)

```typescript
// Guard: Colaborador can only edit modules they have explicit permission for
function guardColaboradorModuleAccess(ctx: TransitionContext): TransitionResult {
  if (ctx.actorRole !== 'colaborador') return { allowed: true };

  const permissions = ctx.metadata?.colaboradorPermissions ?? [];
  if (!ctx.moduleId || !permissions.includes(ctx.moduleId)) {
    return {
      allowed: false,
      reason: 'Colaborador does not have permission for this module',
    };
  }
  return { allowed: true };
}

// Guard: Step approval requires completed mentor session with result "Aprobado"
function guardStepApprovalRequiresMentorSession(ctx: TransitionContext): TransitionResult {
  if (ctx.entity !== 'step' || ctx.targetStatus !== 'Aprobado') return { allowed: true };
  if (ctx.metadata?.mentorSessionResult !== 'Aprobado') {
    return {
      allowed: false,
      reason: 'Step approval requires a completed mentor session with result Aprobado',
    };
  }
  return { allowed: true };
}

// Guard: Sponsor checkpoint validation required at Steps 0, 2, 4
function guardSponsorCheckpoint(ctx: TransitionContext): TransitionResult {
  if (ctx.entity !== 'step' || ctx.targetStatus !== 'Aprobado') return { allowed: true };

  const checkpointSteps = [0, 2, 4];
  if (!checkpointSteps.includes(ctx.stepNumber ?? -1)) return { allowed: true };

  if (!ctx.metadata?.isSponsorCheckpointStep) return { allowed: true };

  if (ctx.metadata.sponsorValidationStatus === 'pending') {
    return {
      allowed: false,
      reason: 'Sponsor strategic validation is pending for this checkpoint step',
      requiredActions: ['sponsor_validation_pending'],
    };
  }

  // Sponsor flagged concerns: allow mentor to proceed but record the flag
  // Sponsor approval is not a hard gate; it is a signal
  return { allowed: true };
}

// Guard: Participante cannot self-approve
function guardNoSelfApproval(ctx: TransitionContext): TransitionResult {
  if (ctx.actorRole !== 'participante') return { allowed: true };
  if (['Aprobado', 'Paso aprobado', 'Finalizado'].includes(ctx.targetStatus)) {
    return {
      allowed: false,
      reason: 'Participantes cannot approve their own steps or projects',
    };
  }
  return { allowed: true };
}

// Guard: Viewer cannot trigger any transition
function guardViewerReadOnly(ctx: TransitionContext): TransitionResult {
  if (ctx.actorRole === 'viewer') {
    return {
      allowed: false,
      reason: 'Viewers have read-only access and cannot trigger transitions',
    };
  }
  return { allowed: true };
}
```

#### 3.3 Guard Execution Pipeline

```typescript
const guards: TransitionGuard[] = [
  guardViewerReadOnly,
  guardNoSelfApproval,
  guardColaboradorModuleAccess,
  guardStepApprovalRequiresMentorSession,
  guardSponsorCheckpoint,
];

function validateTransitionWithRole(ctx: TransitionContext): void {
  // 1. Structural validation (existing ADR-006 logic)
  validateTransition(ctx.entity, ctx.currentStatus, ctx.targetStatus);

  // 2. Role authorization check
  const key = `${ctx.entity}:${ctx.currentStatus}:${ctx.targetStatus}`;
  const allowedRoles = roleTransitionMap[key];

  if (!allowedRoles) {
    throw AppError.badRequest(
      `Transition not configured: ${key}`,
      'TRANSITION_NOT_CONFIGURED'
    );
  }

  // Empty array = SYSTEM-only transition
  if (allowedRoles.length === 0) {
    throw AppError.forbidden(
      'This transition can only be triggered by the system',
      'SYSTEM_ONLY_TRANSITION'
    );
  }

  if (!allowedRoles.includes(ctx.actorRole)) {
    throw AppError.forbidden(
      `Role "${ctx.actorRole}" cannot trigger transition: ${key}`,
      'ROLE_NOT_AUTHORIZED'
    );
  }

  // 3. Composite guards (business rule validation)
  for (const guard of guards) {
    const result = guard(ctx);
    if (!result.allowed) {
      throw AppError.forbidden(
        result.reason ?? 'Transition blocked by guard',
        'GUARD_REJECTED',
        { requiredActions: result.requiredActions }
      );
    }
  }
}
```

---

### 4. Sponsor Checkpoint Model

Sponsors provide **strategic validation** at critical milestones (Steps 0, 2, and 4). This is modeled as a **parallel validation track** alongside the mentor's methodological approval, NOT as a hard gate.

#### 4.1 Design Decision: Soft Gate with Visibility

The sponsor checkpoint is a **soft gate**:
- Mentor approval is REQUIRED (hard gate) for step progression
- Sponsor validation is REQUESTED (soft gate) for strategic alignment
- If sponsor has not responded within a configurable window, the mentor CAN still approve
- If sponsor flags concerns, the flag is recorded and visible to mentor and admin, but does NOT block the transition
- Admin can override and force-proceed if sponsor is unresponsive

**Rationale:** Sponsors are external stakeholders with unpredictable availability. Making them a hard gate would create bottlenecks. However, their strategic input is valuable and should be captured when available.

#### 4.2 SponsorCheckpoint Entity

```typescript
interface SponsorCheckpoint {
  id: string;
  projectId: string;
  stepNumber: 0 | 2 | 4;                    // Only at checkpoint steps
  sponsorId: string;
  status: SponsorCheckpointStatus;
  strategicFeedback?: string;                // Free-text strategic comment
  alignmentSignal?: 'aligned' | 'concerns' | 'pivot_suggested';
  focusRecommendation?: string;              // "Narrow scope to X", "Reinforce Y"
  respondedAt?: string;                      // ISO 8601
  createdAt: string;
  expiresAt: string;                         // Auto-expire window (e.g., 72 hours)
}

type SponsorCheckpointStatus =
  | 'pending'          // Awaiting sponsor response
  | 'approved'         // Sponsor confirms strategic alignment
  | 'flagged'          // Sponsor has concerns (not blocking)
  | 'expired'          // Sponsor did not respond within window
  | 'skipped';         // Admin skipped sponsor checkpoint

// Checkpoint trigger points
const SPONSOR_CHECKPOINT_STEPS: Record<number, string> = {
  0: 'Strategic Alignment Check: Does this challenge align with organizational priorities?',
  2: 'Solution Validation Check: Is the proposed solution strategically viable?',
  4: 'Demo/Adoption Check: Is this ready for organizational adoption or demo?',
};
```

#### 4.3 Database Schema Addition

```prisma
enum SponsorCheckpointStatus {
  PENDING
  APPROVED
  FLAGGED
  EXPIRED
  SKIPPED
}

enum AlignmentSignal {
  ALIGNED
  CONCERNS
  PIVOT_SUGGESTED
}

model SponsorCheckpoint {
  id                   String                   @id @default(cuid())
  projectId            String
  project              Project                  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stepNumber           Int                      // 0, 2, or 4
  sponsorId            String
  sponsor              User                     @relation(fields: [sponsorId], references: [id])
  status               SponsorCheckpointStatus  @default(PENDING)
  strategicFeedback    String?
  alignmentSignal      AlignmentSignal?
  focusRecommendation  String?
  respondedAt          DateTime?
  expiresAt            DateTime                 // Configurable window
  createdAt            DateTime                 @default(now())
  updatedAt            DateTime                 @updatedAt

  @@unique([projectId, stepNumber])            // One checkpoint per step per project
  @@index([projectId])
  @@index([sponsorId])
  @@index([status])
}
```

#### 4.4 Sponsor Checkpoint Lifecycle

```
Step reaches "Ajustado" at checkpoint step (0, 2, 4)
    |
    v
SponsorCheckpoint created (status: PENDING)
    |
    +---> Sponsor responds:
    |       |
    |       +--> "aligned" -> status: APPROVED
    |       |      (green signal, mentor proceeds with confidence)
    |       |
    |       +--> "concerns" -> status: FLAGGED
    |       |      (yellow signal, mentor sees flag, can still approve)
    |       |
    |       +--> "pivot_suggested" -> status: FLAGGED
    |              (strong signal, mentor should discuss with team)
    |
    +---> Sponsor does NOT respond within window:
    |       |
    |       +--> status: EXPIRED
    |              (mentor can proceed, admin notified)
    |
    +---> Admin skips checkpoint:
            |
            +--> status: SKIPPED
                   (recorded in audit log)
```

---

### 5. Dual Approval Flows

Some transitions benefit from both mentor methodological approval AND sponsor strategic validation. This is implemented as a **parallel track model**, NOT sequential blocking.

#### 5.1 When Dual Approval Applies

| Step | Mentor Required? | Sponsor Checkpoint? | Behavior |
|------|:----------------:|:-------------------:|----------|
| Step 0 | N/A (no mentor session at Step 0) | YES (alignment) | Sponsor validates strategic alignment before Step 1 starts |
| Step 1 | YES (methodological) | NO | Standard mentor approval only |
| Step 2 | YES (methodological) | YES (solution validation) | Mentor approves methodology; sponsor validates strategic viability |
| Step 3 | YES (methodological) | NO | Standard mentor approval only |
| Step 4 | YES (methodological) | YES (demo/adoption readiness) | Both required before finalization |

#### 5.2 Step 4 Special Case: Finalization Requires Both

For the project to transition from `Paso aprobado` to `Finalizado` at Step 4:
1. Mentor MUST have approved Step 4 (hard requirement)
2. Sponsor checkpoint MUST be in status `approved` OR `expired` (soft requirement -- an unresponsive sponsor should not block graduation)
3. If sponsor checkpoint is `flagged`, the mentor is informed but can still proceed; the flag is recorded on the finalized project record

```typescript
function canFinalizeProject(project: Project): TransitionResult {
  // All 4 steps must be approved
  const allStepsApproved = project.steps.every(s => s.status === 'Aprobado');
  if (!allStepsApproved) {
    return { allowed: false, reason: 'All steps must be approved before finalization' };
  }

  // Step 4 sponsor checkpoint
  const step4Checkpoint = project.sponsorCheckpoints?.find(c => c.stepNumber === 4);
  if (step4Checkpoint?.status === 'pending') {
    return {
      allowed: false,
      reason: 'Sponsor checkpoint for Step 4 is still pending',
      requiredActions: ['await_sponsor_step4'],
    };
  }

  return { allowed: true };
}
```

---

### 6. Colaborador Restrictions (Detailed)

Colaboradores are team members who contribute content but lack authority over the project lifecycle.

#### 6.1 What Colaboradores CAN Do

| Action | Allowed? | Condition |
|--------|:--------:|-----------|
| View all project data | YES | Must be team member |
| Edit module content (save data) | YES | Only modules they have permission for |
| Start module (`Draft` -> `En progreso`) | YES | Only permitted modules |
| Complete module (`En progreso` -> `Completado`) | YES | Only permitted modules |
| Upload evidence | YES | Any step they can view |
| Comment on steps/modules | YES | If commenting is enabled |
| View AI feedback | YES | Read-only |
| View mentor session results | YES | Read-only |

#### 6.2 What Colaboradores CANNOT Do

| Action | Blocked? | Reason |
|--------|:--------:|--------|
| Submit step for review | BLOCKED | Major state transition reserved for participante |
| Approve/reject any entity | BLOCKED | Reserved for mentor/admin |
| Request mentor session | BLOCKED | Reserved for participante |
| Request AI review | BLOCKED | Reserved for participante |
| Submit module for review | BLOCKED | Major state transition |
| Change project status | BLOCKED | Major state transition |
| Invite/remove team members | BLOCKED | Reserved for participante/admin |
| Create new project | BLOCKED | Reserved for participante/admin |

#### 6.3 Permission Model for Colaboradores

```typescript
interface ColaboradorPermission {
  projectId: string;
  userId: string;                    // The colaborador
  grantedBy: string;                 // The participante who granted access
  modulePermissions: string[];       // Module IDs they can edit (e.g., ['A', 'B'])
  canUploadEvidence: boolean;
  canComment: boolean;
  grantedAt: string;
  revokedAt?: string;
}
```

This is stored in the `TeamMember` entity (extending the existing model) or as a separate permissions table.

---

### 7. Updated Project Access Resolution

```typescript
function resolveProjectAccess(
  user: { id: string; role: Role },
  project: {
    id: string;
    ownerId: string;
    teamMembers: Array<{ userId: string; role: string }>;
    sponsorId?: string;
  },
): 'none' | 'read' | 'write' | 'admin' {
  // Admin: full access
  if (user.role === 'admin') return 'admin';

  // Participante: write access to own projects
  if (user.role === 'participante') {
    const isOwner = project.teamMembers.some(
      (m) => m.userId === user.id && m.role === 'OWNER',
    );
    if (isOwner) return 'write';
  }

  // Mentor: read access to assigned projects (write for review actions via guards)
  if (user.role === 'mentor') {
    const isMentor = project.teamMembers.some(
      (m) => m.userId === user.id,
    );
    if (isMentor) return 'read';
  }

  // Sponsor: read access to projects they sponsor
  if (user.role === 'sponsor') {
    if (project.sponsorId === user.id) return 'read';
  }

  // Colaborador: limited write access (module-level, enforced by guards)
  if (user.role === 'colaborador') {
    const isMember = project.teamMembers.some(
      (m) => m.userId === user.id,
    );
    if (isMember) return 'write'; // Write at project level, restricted by guards at module level
  }

  // Viewer: read-only access to assigned projects
  if (user.role === 'viewer') {
    const isMember = project.teamMembers.some(
      (m) => m.userId === user.id,
    );
    if (isMember) return 'read';
  }

  // General team member fallback
  const isMember = project.teamMembers.some((m) => m.userId === user.id);
  if (isMember) return 'read';

  return 'none';
}
```

---

### 8. Event Emission per Role per Transition

Each state transition emits domain events that include the actor's role, enabling role-aware notification routing.

#### 8.1 New Domain Events

```typescript
// --- Sponsor Checkpoint Events ---

interface SponsorCheckpointRequested {
  eventType: 'SponsorCheckpointRequested';
  payload: {
    projectId: string;
    stepNumber: 0 | 2 | 4;
    sponsorId: string;
    checkpointType: string;        // e.g., "Strategic Alignment Check"
    expiresAt: string;
  };
}
// Notify: sponsor (email + in-app), admin (dashboard alert)

interface SponsorCheckpointResponded {
  eventType: 'SponsorCheckpointResponded';
  payload: {
    projectId: string;
    stepNumber: 0 | 2 | 4;
    sponsorId: string;
    status: 'approved' | 'flagged';
    alignmentSignal: 'aligned' | 'concerns' | 'pivot_suggested';
    strategicFeedback?: string;
    focusRecommendation?: string;
  };
}
// Notify: participante, mentor, admin

interface SponsorCheckpointExpired {
  eventType: 'SponsorCheckpointExpired';
  payload: {
    projectId: string;
    stepNumber: 0 | 2 | 4;
    sponsorId: string;
    expirationWindow: string;      // e.g., "72h"
  };
}
// Notify: admin, mentor (can now proceed without sponsor input)

interface SponsorCheckpointSkipped {
  eventType: 'SponsorCheckpointSkipped';
  payload: {
    projectId: string;
    stepNumber: 0 | 2 | 4;
    skippedBy: string;             // Admin who skipped
    reason?: string;
  };
}
// Notify: sponsor (informational), audit log

// --- Colaborador Events ---

interface ColaboradorModuleEdited {
  eventType: 'ColaboradorModuleEdited';
  payload: {
    projectId: string;
    stepNumber: number;
    moduleId: string;
    colaboradorId: string;
    colaboradorName: string;
    changeType: 'content_update' | 'status_change';
  };
}
// Notify: participante (traceable contributions)

interface ColaboradorEvidenceUploaded {
  eventType: 'ColaboradorEvidenceUploaded';
  payload: {
    projectId: string;
    evidenceId: string;
    colaboradorId: string;
    stepRef: number;
  };
}
// Notify: participante

interface ColaboradorPermissionGranted {
  eventType: 'ColaboradorPermissionGranted';
  payload: {
    projectId: string;
    colaboradorId: string;
    grantedBy: string;
    modulePermissions: string[];
  };
}
// Notify: colaborador

// --- Role-Aware Transition Notifications ---

interface TransitionBlockedByRole {
  eventType: 'TransitionBlockedByRole';
  payload: {
    projectId: string;
    entity: 'project' | 'step' | 'module';
    attemptedTransition: string;   // "En progreso -> Enviado"
    actorId: string;
    actorRole: Role;
    reason: string;
  };
}
// Notify: admin (security monitoring), audit log
```

#### 8.2 Existing Event Augmentation

All existing domain events (from the current 41-event catalog) are augmented with the actor's role in the metadata:

```typescript
interface DomainEvent {
  // ... existing fields ...
  metadata: {
    userId: string;
    userRole: Role;              // NEW: actor's role
    correlationId: string;
    causationId?: string;
  };
}
```

#### 8.3 Notification Routing Matrix

| Event | participante | mentor | admin | sponsor | colaborador | viewer |
|-------|:------------:|:------:|:-----:|:-------:|:-----------:|:------:|
| StepSubmitted | - | YES | YES | - | - | - |
| StepApproved | YES | - | YES | YES* | YES | YES |
| StepBlocked | YES | - | YES | - | YES | - |
| StepIterationRequested | YES | - | YES | - | YES | - |
| SponsorCheckpointRequested | - | - | YES | YES | - | - |
| SponsorCheckpointResponded | YES | YES | YES | - | - | - |
| SponsorCheckpointExpired | - | YES | YES | - | - | - |
| ColaboradorModuleEdited | YES | - | - | - | - | - |
| AIReviewCompleted | YES | YES | YES | - | YES | - |
| MentorSessionScheduled | YES | YES | YES | - | - | - |
| MentorSessionCompleted | YES | - | YES | YES* | YES | YES |
| TransitionBlockedByRole | - | - | YES | - | - | - |

`*` Sponsors receive notifications for milestone steps (0, 2, 4) only.

---

### 9. Implementation Sequence

1. **Phase 1: Role Migration** (non-breaking)
   - Add `participante`, `sponsor`, `colaborador`, `viewer` to the Prisma Role enum
   - Migrate existing `owner` -> `participante`, `leader` -> `viewer` in the database
   - Update JWT payload to include new roles
   - Update `requireRole()` middleware to accept new roles
   - Backward-compatible: old role names supported during migration

2. **Phase 2: Role-Aware State Machine** (core change)
   - Implement `roleTransitionMap` in `state-machine.ts`
   - Implement `validateTransitionWithRole()` replacing `validateTransition()`
   - Add composite guards (colaborador, self-approval, viewer)
   - Update `StepService` and `ProjectService` to pass `TransitionContext`

3. **Phase 3: Sponsor Checkpoints** (new feature)
   - Add `SponsorCheckpoint` model to Prisma schema
   - Implement sponsor checkpoint lifecycle service
   - Add sponsor assignment to projects (admin action)
   - Implement checkpoint auto-expiry (cron job or event-driven)
   - Add sponsor notification events

4. **Phase 4: Colaborador Permissions** (new feature)
   - Extend `TeamMember` model with module-level permissions
   - Implement `ColaboradorPermission` check in guards
   - Add UI for participantes to grant/revoke colaborador permissions

5. **Phase 5: Event Augmentation** (observability)
   - Add `userRole` to all event metadata
   - Implement new sponsor and colaborador events
   - Update notification routing to use role-aware dispatch

---

### 10. Updated Authorization Middleware

```typescript
// Updated requireRole to accept new roles
export function requireRole(
  ...roles: Role[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized('Autenticacion requerida'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('No tienes permiso para acceder a este recurso'));
      return;
    }

    next();
  };
}

// New middleware: requireTransitionAuth
// Combines structural validation + role authorization + guards
export function requireTransitionAuth(
  entity: 'project' | 'step' | 'module',
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, _res, next) => {
    try {
      const ctx: TransitionContext = {
        entity,
        currentStatus: req.body.currentStatus,
        targetStatus: req.body.status,
        actorRole: req.user!.role,
        actorId: req.user!.id,
        projectId: req.params.projectId || req.params.id,
        stepNumber: req.params.number ? Number(req.params.number) : undefined,
        moduleId: req.params.moduleId,
        metadata: await buildTransitionMetadata(req),
      };

      validateTransitionWithRole(ctx);
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

## Consequences

### Positive
- Every state transition is explicitly role-gated, closing the authorization gap in ADR-006
- Sponsor strategic validation is captured without blocking the methodology pipeline
- Colaboradores can contribute content without risking unauthorized state changes
- Viewers have guaranteed read-only access enforced at the state machine level, not just the route level
- Guard pipeline is extensible: new business rules can be added as guards without modifying the core state machine
- Event augmentation with role enables precise notification routing
- All decisions documented with clear rationale for audit

### Negative
- Increased complexity: 6 roles x N transitions = larger authorization surface to maintain
- Sponsor checkpoint adds a new entity and lifecycle to manage
- Migration from 4 to 6 roles requires database migration, JWT claim updates, and frontend role handling
- Soft-gate sponsor model may lead to checkpoints being routinely ignored if sponsors are disengaged
- Colaborador module-level permissions add granularity that increases administrative burden for participantes

### Neutral
- The state machine remains pure logic (no side effects), testable in isolation
- The soft-gate vs. hard-gate decision for sponsors can be revisited based on usage data
- The `roleTransitionMap` serves as executable documentation of authorization rules

## Alternatives Considered

### Hard-Gate Sponsor Approval
- **Pros:** Ensures sponsor input is always captured; stronger strategic alignment
- **Cons:** Creates bottlenecks when sponsors are unavailable; punishes engaged teams for unresponsive sponsors
- **Decision:** Rejected in favor of soft gate with visibility. Can be re-evaluated per cohort.

### ABAC (Attribute-Based Access Control)
- **Pros:** Maximum flexibility for complex permission scenarios
- **Cons:** Over-engineered for 6 roles; hard to audit; learning curve for team
- **Decision:** Deferred. Current guard-based approach is sufficient and more transparent.

### Separate State Machine per Role
- **Pros:** Each role gets its own transition map, easier to reason about individually
- **Cons:** Duplication; harder to maintain consistency; same transition appears in multiple maps
- **Decision:** Rejected. A single transition map with role annotations is more maintainable.

## References
- ADR-004: Authorization Model (4-role RBAC)
- ADR-006: State Machine for Project and Step Lifecycle
- Domain Events document: `backend/docs/ddd/domain-events.md`
- Bounded Contexts: `backend/docs/ddd/bounded-contexts.md`
- Aggregates: `backend/docs/ddd/aggregates.md`
