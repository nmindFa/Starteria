# ADR-009: Authorization Model v2 -- 6-Role Middleware Architecture

## Status
Proposed

## Date
2026-03-24

## Context

The current authorization model (ADR-004) supports 4 roles: `owner`, `mentor`, `admin`, `leader`. The platform now requires 6 distinct roles with more granular, project-level permission resolution:

1. **Participante** (replaces `owner`): Project creator with write access to own projects
2. **Mentor**: Read + review access to assigned projects, can approve/reject steps
3. **Admin**: Admin access scoped to company or workspace level
4. **Sponsor**: Read + checkpoint access to assigned projects (focused on Steps 0/2/4)
5. **Colaborador**: Configurable per-project access (read or write), set by the participante
6. **Viewer**: Read-only access to shared projects, optional comment capability

Key gaps in the current system:
- `resolveProjectAccess` checks `User.role` but not `TeamMember.role` for project-level resolution
- No action-based authorization (e.g., `step.submit`, `step.approve`)
- No support for configurable per-user-per-project permissions (Colaborador)
- No admin scope differentiation (company-wide vs. workspace-only)
- Access levels limited to `read | write | admin` -- missing `review`, `checkpoint`, `comment`

## Decision

### 1. New Type Definitions

```typescript
// ─── Platform Roles ────────────────────────────────────────────────
// The user's global role, stored in the `users` table and JWT.
type PlatformRole =
  | 'participante'  // was 'owner'
  | 'mentor'
  | 'admin'
  | 'sponsor'
  | 'colaborador'
  | 'viewer';

// ─── Project Roles ─────────────────────────────────────────────────
// The user's role within a specific project, stored in `team_members` table.
type ProjectRole =
  | 'owner'         // project creator (1 per project)
  | 'editor'        // collaborator with write access
  | 'reviewer'      // mentor/sponsor assigned to review
  | 'viewer'        // read-only member
  | 'sponsor';      // strategic checkpoint reviewer

// ─── Access Levels ─────────────────────────────────────────────────
// Expanded hierarchy beyond the current read/write/admin.
type AccessLevel =
  | 'none'
  | 'comment'       // NEW: can view and comment only
  | 'read'          // can view all project data
  | 'review'        // NEW: can read + approve/reject steps, verify evidence
  | 'checkpoint'    // NEW: read + checkpoint actions (Steps 0/2/4 only)
  | 'write'         // can edit project data, submit steps
  | 'admin';        // full control

// Numeric hierarchy for comparison.
const ACCESS_HIERARCHY: Record<AccessLevel, number> = {
  none:       0,
  comment:    1,
  read:       2,
  review:     3,
  checkpoint: 3,   // same level as review but different capabilities
  write:      4,
  admin:      5,
};

// ─── Admin Scope ───────────────────────────────────────────────────
type AdminScope = 'company' | 'workspace';

// ─── Actions ───────────────────────────────────────────────────────
// Granular action identifiers for action-based authorization.
type Action =
  // Project actions
  | 'project.create'
  | 'project.read'
  | 'project.update'
  | 'project.delete'
  | 'project.archive'
  // Step actions
  | 'step.read'
  | 'step.update'
  | 'step.submit'
  | 'step.approve'
  | 'step.reject'
  | 'step.block'
  // Module actions
  | 'module.read'
  | 'module.update'
  | 'module.complete'
  // Evidence actions
  | 'evidence.read'
  | 'evidence.upload'
  | 'evidence.delete'
  | 'evidence.verify'
  | 'evidence.reject'
  // Team actions
  | 'team.read'
  | 'team.invite'
  | 'team.remove'
  | 'team.updateRole'
  // Run/experiment actions
  | 'run.create'
  | 'run.update'
  | 'run.close'
  // Comment actions
  | 'comment.read'
  | 'comment.create'
  // Mentor session actions
  | 'session.request'
  | 'session.schedule'
  | 'session.conduct'
  // AI review actions
  | 'ai.requestReview'
  | 'ai.viewFeedback'
  // Admin actions
  | 'admin.manageUsers'
  | 'admin.manageCohorts'
  | 'admin.viewAuditLog'
  | 'admin.assignMentor'
  | 'admin.assignSponsor'
  // Checkpoint actions (Sponsor)
  | 'checkpoint.read'
  | 'checkpoint.feedback';
```

### 2. JWT Payload Changes

```typescript
// CURRENT payload (ADR-003):
interface TokenPayloadV1 {
  sub: string;        // userId
  role: Role;         // 'owner' | 'mentor' | 'admin' | 'leader'
  email: string;
  cohort?: string;
}

// NEW payload (ADR-009):
interface TokenPayloadV2 {
  sub: string;           // userId (unchanged)
  role: PlatformRole;    // 'participante' | 'mentor' | 'admin' | 'sponsor' | 'colaborador' | 'viewer'
  email: string;         // unchanged
  cohort?: string;       // unchanged
  adminScope?: AdminScope; // NEW: 'company' | 'workspace' (only for admin role)
  workspaceId?: string;  // NEW: scoped workspace ID (only for workspace-scoped admins)
  v: 2;                  // NEW: payload version for backward compatibility
}
```

### 3. Guard Composition Pattern

The new middleware architecture uses three layers of guards that compose declaratively:

```
authenticate --> requireRole --> resolveProjectContext --> requireProjectRole / requireAction
```

#### Layer 1: Authentication (unchanged)
```typescript
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // Same as current -- verify JWT, attach req.user
  // Updated to read PlatformRole and adminScope from payload
  const payload = verifyAccessToken(token);
  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,          // PlatformRole
    cohort: payload.cohort,
    adminScope: payload.adminScope,
    workspaceId: payload.workspaceId,
  };
  next();
}
```

#### Layer 2: Platform Role Guard (updated enum)
```typescript
export function requireRole(
  ...roles: PlatformRole[]
): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Autenticacion requerida'));
    }
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('No tienes permiso para acceder a este recurso'));
    }
    next();
  };
}
```

#### Layer 3: Project Context Resolution (NEW)
```typescript
/**
 * resolveProjectContext -- Loads the project and the user's membership,
 * then attaches resolved access level and project role to the request.
 *
 * This replaces the old `requireProjectAccess` by separating resolution
 * from enforcement. Guards that follow can check either access level
 * or project role or action permission.
 */
export function resolveProjectContext(): RequestHandler {
  return async (req, _res, next) => {
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) return next(AppError.badRequest('ID de proyecto requerido'));
    if (!UUID_REGEX.test(projectId)) return next(AppError.badRequest('ID de proyecto invalido'));

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        cohortId: true,
        teamMembers: {
          where: { userId: req.user!.id },
          select: {
            role: true,           // TeamRole: OWNER | EDITOR | VIEWER
            status: true,
            permissionLevel: true, // NEW column for Colaborador configurable access
            commentEnabled: true,  // NEW column for Viewer comment toggle
          },
        },
        // NEW: project_assignments for mentor/sponsor
        assignments: {
          where: { userId: req.user!.id },
          select: { role: true },  // 'mentor' | 'sponsor'
        },
      },
    });

    if (!project) return next(AppError.notFound('Proyecto'));

    const { accessLevel, projectRole } = resolveProjectAccessV2(
      req.user!,
      project,
    );

    req.projectContext = {
      projectId: project.id,
      accessLevel,
      projectRole,
      cohortId: project.cohortId,
      membership: project.teamMembers[0] ?? null,
      assignment: project.assignments[0] ?? null,
    };

    next();
  };
}
```

#### Layer 4a: Project Role Guard (NEW)
```typescript
/**
 * requireProjectRole -- Checks the user's resolved role within the project.
 * Must run after resolveProjectContext.
 */
export function requireProjectRole(
  ...projectRoles: ProjectRole[]
): RequestHandler {
  return (req, _res, next) => {
    if (!req.projectContext) {
      return next(AppError.internal('resolveProjectContext must run before requireProjectRole'));
    }
    if (!req.projectContext.projectRole) {
      return next(AppError.forbidden('No tienes acceso a este proyecto'));
    }
    if (!projectRoles.includes(req.projectContext.projectRole)) {
      return next(AppError.forbidden('No tienes el rol requerido en este proyecto'));
    }
    next();
  };
}
```

#### Layer 4b: Access Level Guard (updated)
```typescript
/**
 * requireAccessLevel -- Checks that the resolved access level meets
 * the minimum required level. Must run after resolveProjectContext.
 */
export function requireAccessLevel(
  minimumLevel: AccessLevel,
): RequestHandler {
  return (req, _res, next) => {
    if (!req.projectContext) {
      return next(AppError.internal('resolveProjectContext must run before requireAccessLevel'));
    }
    const resolved = req.projectContext.accessLevel;
    if (ACCESS_HIERARCHY[resolved] < ACCESS_HIERARCHY[minimumLevel]) {
      return next(AppError.forbidden('No tienes el nivel de acceso requerido'));
    }
    next();
  };
}
```

#### Layer 4c: Action Guard (NEW)
```typescript
/**
 * requireAction -- Checks if the user is allowed to perform a specific
 * action within the current project context.
 *
 * Action resolution uses the ACTION_POLICY_MAP which maps each action
 * to the set of (platformRole, projectRole, accessLevel) combinations
 * that are allowed.
 */
export function requireAction(
  ...actions: Action[]
): RequestHandler {
  return (req, _res, next) => {
    const user = req.user!;
    const ctx = req.projectContext; // may be null for non-project actions

    for (const action of actions) {
      if (!isActionAllowed(action, user, ctx)) {
        return next(AppError.forbidden(
          `No tienes permiso para la accion: ${action}`
        ));
      }
    }
    next();
  };
}
```

### 4. resolveProjectAccess v2

```typescript
interface ProjectForAccess {
  id: string;
  ownerId: string;
  cohortId: string | null;
  teamMembers: Array<{
    role: TeamRole;
    status: TeamMemberStatus;
    permissionLevel?: 'read' | 'write' | null;  // Colaborador configurable
    commentEnabled?: boolean | null;             // Viewer comment toggle
  }>;
  assignments: Array<{
    role: 'mentor' | 'sponsor';
  }>;
}

interface ResolvedAccess {
  accessLevel: AccessLevel;
  projectRole: ProjectRole | null;
}

function resolveProjectAccessV2(
  user: AuthenticatedUser,
  project: ProjectForAccess,
): ResolvedAccess {

  // ─── 1. Admin: scope-aware resolution ────────────────────────────
  if (user.role === 'admin') {
    if (user.adminScope === 'company') {
      // Company-wide admin: admin access to ALL projects
      return { accessLevel: 'admin', projectRole: null };
    }
    if (user.adminScope === 'workspace') {
      // Workspace-scoped admin: admin access only if project is in their workspace
      // (cohortId serves as workspace boundary in MVP)
      if (project.cohortId && project.cohortId === user.workspaceId) {
        return { accessLevel: 'admin', projectRole: null };
      }
      // Workspace admin has no access to projects outside their workspace
      return { accessLevel: 'none', projectRole: null };
    }
    // Fallback for admins without explicit scope: treat as company
    return { accessLevel: 'admin', projectRole: null };
  }

  // ─── 2. Check project_assignments (mentor / sponsor) ────────────
  const assignment = project.assignments[0];
  if (assignment) {
    if (assignment.role === 'mentor') {
      return { accessLevel: 'review', projectRole: 'reviewer' };
    }
    if (assignment.role === 'sponsor') {
      return { accessLevel: 'checkpoint', projectRole: 'sponsor' };
    }
  }

  // ─── 3. Check team_members ──────────────────────────────────────
  const membership = project.teamMembers[0];
  if (!membership || membership.status !== 'ACTIVE') {
    return { accessLevel: 'none', projectRole: null };
  }

  switch (membership.role) {
    case 'OWNER':
      // Participante who created the project
      return { accessLevel: 'write', projectRole: 'owner' };

    case 'EDITOR':
      // Colaborador: access level is configurable per-project
      // Default to 'write' if permissionLevel not explicitly set
      if (membership.permissionLevel === 'read') {
        return { accessLevel: 'read', projectRole: 'viewer' };
      }
      return { accessLevel: 'write', projectRole: 'editor' };

    case 'VIEWER':
      // Viewer: read-only, optionally with comment capability
      if (membership.commentEnabled) {
        return { accessLevel: 'comment', projectRole: 'viewer' };
      }
      return { accessLevel: 'read', projectRole: 'viewer' };

    default:
      return { accessLevel: 'none', projectRole: null };
  }
}
```

### 5. Action Policy Map

```typescript
/**
 * ACTION_POLICY_MAP defines which combinations of platform role,
 * project role, and access level are allowed for each action.
 *
 * Each entry is an array of policy rules. The action is allowed if
 * ANY rule matches (OR logic). Each rule uses AND logic internally.
 */

interface PolicyRule {
  platformRoles?: PlatformRole[];   // if set, user.role must be in this list
  projectRoles?: ProjectRole[];     // if set, projectContext.projectRole must be in this list
  minAccessLevel?: AccessLevel;     // if set, accessLevel must be >= this
  conditions?: ActionCondition[];   // if set, all conditions must pass
}

type ActionCondition =
  | 'isProjectOwner'         // user.id === project.ownerId
  | 'isSelfResource'         // user.id === resource.ownerId
  | 'isCheckpointStep'       // step.number is 0, 2, or 4
  | 'isAssignedMentor'       // user is in project_assignments as mentor
  | 'isAssignedSponsor'      // user is in project_assignments as sponsor
  | 'commentEnabled';        // viewer has comment capability enabled

const ACTION_POLICY_MAP: Record<Action, PolicyRule[]> = {

  // ─── Project Actions ────────────────────────────────────────────
  'project.create': [
    { platformRoles: ['participante', 'admin'] },
  ],
  'project.read': [
    { minAccessLevel: 'comment' },  // anyone with at least comment access
  ],
  'project.update': [
    { minAccessLevel: 'write' },
  ],
  'project.delete': [
    { platformRoles: ['admin'] },
  ],
  'project.archive': [
    { projectRoles: ['owner'] },
    { platformRoles: ['admin'] },
  ],

  // ─── Step Actions ───────────────────────────────────────────────
  'step.read': [
    { minAccessLevel: 'read' },
  ],
  'step.update': [
    { minAccessLevel: 'write' },
  ],
  'step.submit': [
    { projectRoles: ['owner'] },     // only project owner can submit
  ],
  'step.approve': [
    { projectRoles: ['reviewer'], conditions: ['isAssignedMentor'] },
    { platformRoles: ['admin'] },
  ],
  'step.reject': [
    { projectRoles: ['reviewer'], conditions: ['isAssignedMentor'] },
    { platformRoles: ['admin'] },
  ],
  'step.block': [
    { projectRoles: ['reviewer'], conditions: ['isAssignedMentor'] },
    { platformRoles: ['admin'] },
  ],

  // ─── Module Actions ─────────────────────────────────────────────
  'module.read': [
    { minAccessLevel: 'read' },
  ],
  'module.update': [
    { minAccessLevel: 'write' },
  ],
  'module.complete': [
    { projectRoles: ['owner', 'editor'] },
  ],

  // ─── Evidence Actions ───────────────────────────────────────────
  'evidence.read': [
    { minAccessLevel: 'read' },
  ],
  'evidence.upload': [
    { projectRoles: ['owner', 'editor'] },
  ],
  'evidence.delete': [
    { projectRoles: ['owner'], conditions: ['isSelfResource'] },
    { platformRoles: ['admin'] },
  ],
  'evidence.verify': [
    { projectRoles: ['reviewer'], conditions: ['isAssignedMentor'] },
    { platformRoles: ['admin'] },
  ],
  'evidence.reject': [
    { projectRoles: ['reviewer'], conditions: ['isAssignedMentor'] },
    { platformRoles: ['admin'] },
  ],

  // ─── Team Actions ───────────────────────────────────────────────
  'team.read': [
    { minAccessLevel: 'read' },
  ],
  'team.invite': [
    { projectRoles: ['owner'] },
    { platformRoles: ['admin'] },
  ],
  'team.remove': [
    { projectRoles: ['owner'] },
    { platformRoles: ['admin'] },
  ],
  'team.updateRole': [
    { projectRoles: ['owner'] },
    { platformRoles: ['admin'] },
  ],

  // ─── Run Actions ────────────────────────────────────────────────
  'run.create': [
    { projectRoles: ['owner', 'editor'] },
  ],
  'run.update': [
    { projectRoles: ['owner', 'editor'] },
  ],
  'run.close': [
    { projectRoles: ['owner', 'editor'] },
  ],

  // ─── Comment Actions ────────────────────────────────────────────
  'comment.read': [
    { minAccessLevel: 'comment' },
  ],
  'comment.create': [
    { minAccessLevel: 'comment' },  // viewers with commentEnabled, mentors, sponsors, editors, owners
  ],

  // ─── Session Actions ────────────────────────────────────────────
  'session.request': [
    { projectRoles: ['owner'] },
  ],
  'session.schedule': [
    { projectRoles: ['reviewer'], conditions: ['isAssignedMentor'] },
    { platformRoles: ['admin'] },
  ],
  'session.conduct': [
    { projectRoles: ['reviewer'], conditions: ['isAssignedMentor'] },
  ],

  // ─── AI Review Actions ──────────────────────────────────────────
  'ai.requestReview': [
    { projectRoles: ['owner'] },
  ],
  'ai.viewFeedback': [
    { minAccessLevel: 'read' },
  ],

  // ─── Admin Actions ──────────────────────────────────────────────
  'admin.manageUsers': [
    { platformRoles: ['admin'] },
  ],
  'admin.manageCohorts': [
    { platformRoles: ['admin'] },
  ],
  'admin.viewAuditLog': [
    { platformRoles: ['admin'] },
  ],
  'admin.assignMentor': [
    { platformRoles: ['admin'] },
  ],
  'admin.assignSponsor': [
    { platformRoles: ['admin'] },
  ],

  // ─── Checkpoint Actions (Sponsor-specific) ──────────────────────
  'checkpoint.read': [
    { projectRoles: ['sponsor'], conditions: ['isCheckpointStep'] },
    { platformRoles: ['admin'] },
    { projectRoles: ['owner', 'editor', 'reviewer'] },
  ],
  'checkpoint.feedback': [
    { projectRoles: ['sponsor'], conditions: ['isCheckpointStep', 'isAssignedSponsor'] },
    { platformRoles: ['admin'] },
  ],
};
```

### 6. Action Evaluation Engine

```typescript
function isActionAllowed(
  action: Action,
  user: AuthenticatedUser,
  ctx: ProjectContext | null,
): boolean {
  const rules = ACTION_POLICY_MAP[action];
  if (!rules) return false;

  return rules.some(rule => matchesRule(rule, user, ctx));
}

function matchesRule(
  rule: PolicyRule,
  user: AuthenticatedUser,
  ctx: ProjectContext | null,
): boolean {
  // Check platform role constraint
  if (rule.platformRoles && !rule.platformRoles.includes(user.role)) {
    return false;
  }

  // Check project role constraint (requires project context)
  if (rule.projectRoles) {
    if (!ctx || !ctx.projectRole) return false;
    if (!rule.projectRoles.includes(ctx.projectRole)) return false;
  }

  // Check minimum access level constraint
  if (rule.minAccessLevel) {
    if (!ctx) return false;
    if (ACCESS_HIERARCHY[ctx.accessLevel] < ACCESS_HIERARCHY[rule.minAccessLevel]) {
      return false;
    }
  }

  // Check additional conditions
  if (rule.conditions) {
    for (const condition of rule.conditions) {
      if (!evaluateCondition(condition, user, ctx)) return false;
    }
  }

  return true;
}

function evaluateCondition(
  condition: ActionCondition,
  user: AuthenticatedUser,
  ctx: ProjectContext | null,
): boolean {
  switch (condition) {
    case 'isProjectOwner':
      return ctx?.projectRole === 'owner';

    case 'isSelfResource':
      // Must be evaluated in the route handler with resource data;
      // here we just ensure the user has project access
      return ctx != null && ctx.accessLevel !== 'none';

    case 'isCheckpointStep': {
      // Sponsor access is limited to Steps 0, 2, 4
      // The step number must be extracted from req.params in middleware
      // This condition delegates to the request context
      return ctx?.stepNumber != null && [0, 2, 4].includes(ctx.stepNumber);
    }

    case 'isAssignedMentor':
      return ctx?.assignment?.role === 'mentor';

    case 'isAssignedSponsor':
      return ctx?.assignment?.role === 'sponsor';

    case 'commentEnabled':
      return ctx?.membership?.commentEnabled === true;

    default:
      return false;
  }
}
```

### 7. Extended Request Types

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      projectContext?: ProjectContext;
    }
  }
}

interface AuthenticatedUser {
  id: string;
  email: string;
  role: PlatformRole;
  cohort?: string;
  adminScope?: AdminScope;
  workspaceId?: string;
}

interface ProjectContext {
  projectId: string;
  accessLevel: AccessLevel;
  projectRole: ProjectRole | null;
  cohortId: string | null;
  membership: {
    role: TeamRole;
    status: TeamMemberStatus;
    permissionLevel?: 'read' | 'write' | null;
    commentEnabled?: boolean | null;
  } | null;
  assignment: {
    role: 'mentor' | 'sponsor';
  } | null;
  stepNumber?: number;  // populated by step-aware middleware
}
```

### 8. Middleware Ordering

```
Request
  |
  v
1. CORS
  |
  v
2. Helmet (Security Headers)
  |
  v
3. Body Parser (with size limits)
  |
  v
4. Request ID
  |
  v
5. Request Logger
  |
  v
6. Rate Limiter
  |
  v
7. authenticate (verify JWT, attach req.user with PlatformRole + AdminScope)
  |
  v
8. requireRole (optional, per-route platform role check)
  |
  v
9. resolveProjectContext (per-route, loads project + membership + assignments)
  |
  v
10. resolveStepContext (optional, extracts step number for checkpoint guards)
  |
  v
11. requireProjectRole / requireAccessLevel / requireAction (per-route)
  |
  v
12. Validation (Zod schemas)
  |
  v
13. Route Handler
  |
  v
14. Audit Logger (post-handler, logs action)
  |
  v
15. Error Handler
  |
  v
Response
```

New middleware added at positions 9, 10, 11, and 14 compared to the original chain.

### 9. Step Context Middleware (for Sponsor Checkpoint Guards)

```typescript
/**
 * resolveStepContext -- Extracts step number from route params and
 * attaches it to projectContext. Required for checkpoint-scoped guards.
 */
export function resolveStepContext(): RequestHandler {
  return (req, _res, next) => {
    if (!req.projectContext) {
      return next(AppError.internal('resolveProjectContext must run before resolveStepContext'));
    }

    const stepNumber = parseInt(req.params.number ?? req.params.stepNumber ?? '', 10);
    if (!isNaN(stepNumber) && stepNumber >= 0 && stepNumber <= 4) {
      req.projectContext.stepNumber = stepNumber;
    }

    next();
  };
}
```

### 10. Admin Scope Guard (NEW)

```typescript
/**
 * requireAdminScope -- For admin-only routes, checks that the admin's
 * scope matches the required level.
 *
 * 'company' admins can access everything.
 * 'workspace' admins can only access resources within their workspace.
 */
export function requireAdminScope(
  scope: AdminScope,
): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(AppError.forbidden('Se requiere rol de administrador'));
    }

    if (scope === 'company' && req.user.adminScope !== 'company') {
      return next(AppError.forbidden(
        'Esta accion requiere permisos de administrador a nivel empresa'
      ));
    }

    // Workspace admins pass for workspace scope check
    // Company admins pass for both
    next();
  };
}
```

### 11. Route Usage Examples

```typescript
// ─── Project Routes ────────────────────────────────────────────────

const projectRouter = Router();
projectRouter.use(authenticate);

// List projects (filtered by role in controller)
projectRouter.get('/', controller.list);

// Create project -- only participante or admin
projectRouter.post('/',
  requireRole('participante', 'admin'),
  requireAction('project.create'),
  validate(createProjectSchema),
  controller.create,
);

// Read project -- anyone with at least comment access
projectRouter.get('/:id',
  resolveProjectContext(),
  requireAccessLevel('comment'),
  controller.getById,
);

// Update project -- write access required
projectRouter.patch('/:id',
  resolveProjectContext(),
  requireAction('project.update'),
  validate(updateProjectSchema),
  controller.update,
);

// Delete project -- admin only
projectRouter.delete('/:id',
  requireRole('admin'),
  controller.archive,
);

// ─── Step Routes ───────────────────────────────────────────────────

const stepRouter = Router();
stepRouter.use(authenticate);

// Read step data
stepRouter.get('/:projectId/steps/:number',
  resolveProjectContext(),
  resolveStepContext(),
  requireAction('step.read'),
  controller.getByNumber,
);

// Update step content -- write access
stepRouter.put('/:projectId/steps/:number/data',
  resolveProjectContext(),
  resolveStepContext(),
  requireAction('step.update'),
  controller.saveData,
);

// Submit step for AI review -- only project owner (participante)
stepRouter.post('/:projectId/steps/:number/ai-review',
  resolveProjectContext(),
  requireAction('step.submit'),
  controller.submitAiReview,
);

// Approve step -- mentor (reviewer) or admin
stepRouter.post('/:projectId/steps/:number/approve',
  resolveProjectContext(),
  resolveStepContext(),
  requireAction('step.approve'),
  controller.approveStep,
);

// ─── Evidence Routes ───────────────────────────────────────────────

const evidenceRouter = Router();
evidenceRouter.use(authenticate);

// Upload evidence -- owner or editor
evidenceRouter.post('/:projectId/evidence',
  resolveProjectContext(),
  requireAction('evidence.upload'),
  validate(createEvidenceSchema),
  controller.create,
);

// Verify evidence -- assigned mentor or admin
evidenceRouter.post('/:projectId/evidence/:id/verify',
  resolveProjectContext(),
  requireAction('evidence.verify'),
  controller.verify,
);

// ─── Team Routes ───────────────────────────────────────────────────

const teamRouter = Router();
teamRouter.use(authenticate);

// Invite member -- with configurable permission for Colaborador
teamRouter.post('/:projectId/team/invite',
  resolveProjectContext(),
  requireAction('team.invite'),
  validate(inviteMemberSchema),
  controller.inviteMember,
);

// Update member role / permission level
teamRouter.patch('/:projectId/team/:memberId',
  resolveProjectContext(),
  requireAction('team.updateRole'),
  validate(updateMemberRoleSchema),
  controller.updateMemberRole,
);

// ─── Sponsor Checkpoint Routes ────────────────────────────────────

const checkpointRouter = Router();
checkpointRouter.use(authenticate);

// Read checkpoint data (Steps 0, 2, 4 only)
checkpointRouter.get('/:projectId/checkpoints/:number',
  resolveProjectContext(),
  resolveStepContext(),
  requireAction('checkpoint.read'),
  controller.getCheckpoint,
);

// Submit strategic feedback on checkpoint
checkpointRouter.post('/:projectId/checkpoints/:number/feedback',
  resolveProjectContext(),
  resolveStepContext(),
  requireAction('checkpoint.feedback'),
  validate(checkpointFeedbackSchema),
  controller.submitCheckpointFeedback,
);

// ─── Admin Routes ──────────────────────────────────────────────────

const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(requireRole('admin'));

// Company-level actions
adminRouter.get('/users',
  requireAdminScope('company'),
  controller.listUsers,
);

// Workspace-level actions (workspace admins can do these for their workspace)
adminRouter.get('/cohorts',
  controller.listCohorts,  // filtered by workspace in controller
);

adminRouter.post('/cohorts/:id/assign-mentor',
  requireAction('admin.assignMentor'),
  controller.assignMentor,
);

adminRouter.post('/cohorts/:id/assign-sponsor',
  requireAction('admin.assignSponsor'),
  controller.assignSponsor,
);
```

### 12. Database Schema Changes

```sql
-- 1. Update Role enum to include new roles
ALTER TYPE "Role" ADD VALUE 'participante';
ALTER TYPE "Role" ADD VALUE 'sponsor';
ALTER TYPE "Role" ADD VALUE 'colaborador';
ALTER TYPE "Role" ADD VALUE 'viewer';
-- Note: 'owner' is renamed to 'participante' via data migration
-- Note: 'leader' is removed (replaced by workspace-scoped admin)

-- 2. Add admin scope columns to users table
ALTER TABLE users ADD COLUMN admin_scope VARCHAR(20)
  CHECK (admin_scope IN ('company', 'workspace'));
ALTER TABLE users ADD COLUMN workspace_id TEXT;

-- 3. Add configurable permission columns to team_members table
ALTER TABLE team_members ADD COLUMN permission_level VARCHAR(10)
  CHECK (permission_level IN ('read', 'write'))
  DEFAULT 'write';
ALTER TABLE team_members ADD COLUMN comment_enabled BOOLEAN DEFAULT false;

-- 4. Expand project_assignments to include sponsor role
ALTER TABLE project_assignments
  DROP CONSTRAINT project_assignments_role_check;
ALTER TABLE project_assignments
  ADD CONSTRAINT project_assignments_role_check
  CHECK (role IN ('mentor', 'sponsor'));
-- Remove unique constraint on (project_id, role) to allow both mentor + sponsor
ALTER TABLE project_assignments
  DROP CONSTRAINT project_assignments_project_id_role_key;
ALTER TABLE project_assignments
  ADD CONSTRAINT project_assignments_unique_user_project
  UNIQUE (project_id, user_id);

-- 5. Data migration: rename 'owner' -> 'participante'
UPDATE users SET role = 'participante' WHERE role = 'owner';
-- Migrate 'leader' users to workspace-scoped admin
UPDATE users SET role = 'admin', admin_scope = 'workspace'
  WHERE role = 'leader';
```

### 13. Updated Prisma Schema Changes

```prisma
enum Role {
  participante   // was 'owner'
  mentor
  admin
  sponsor        // NEW
  colaborador    // NEW
  viewer         // NEW
}

model User {
  // ... existing fields ...
  adminScope   String?   // 'company' | 'workspace'
  workspaceId  String?   // workspace scope boundary
}

model TeamMember {
  // ... existing fields ...
  permissionLevel  String?    // 'read' | 'write' (for Colaborador)
  commentEnabled   Boolean    @default(false) // for Viewer
}
```

### 14. Authorization Matrix (6 Roles)

| Resource / Action | Participante | Mentor | Admin (company) | Admin (workspace) | Sponsor | Colaborador | Viewer |
|---|---|---|---|---|---|---|---|
| project.create | OWN | - | ALL | WORKSPACE | - | - | - |
| project.read | OWN | ASSIGNED | ALL | WORKSPACE | ASSIGNED | ASSIGNED | SHARED |
| project.update | OWN | - | ALL | WORKSPACE | - | CONFIGURED | - |
| project.delete | - | - | ALL | - | - | - | - |
| step.read | OWN | ASSIGNED | ALL | WORKSPACE | CHECKPOINT | ASSIGNED | SHARED |
| step.update | OWN | - | ALL | WORKSPACE | - | CONFIGURED | - |
| step.submit | OWN | - | - | - | - | - | - |
| step.approve | - | ASSIGNED | ALL | WORKSPACE | - | - | - |
| evidence.upload | OWN | - | ALL | WORKSPACE | - | CONFIGURED | - |
| evidence.verify | - | ASSIGNED | ALL | WORKSPACE | - | - | - |
| team.invite | OWN | - | ALL | WORKSPACE | - | - | - |
| comment.create | OWN | ASSIGNED | ALL | WORKSPACE | ASSIGNED | ASSIGNED | IF ENABLED |
| checkpoint.read | OWN | ASSIGNED | ALL | WORKSPACE | STEPS 0/2/4 | - | - |
| checkpoint.feedback | - | - | ALL | WORKSPACE | STEPS 0/2/4 | - | - |
| admin.manageUsers | - | - | ALL | - | - | - | - |
| admin.manageCohorts | - | - | ALL | WORKSPACE | - | - | - |

**Legend:**
- `OWN`: Only on user's own projects
- `ASSIGNED`: Only on projects where user is assigned (via project_assignments)
- `ALL`: All projects across the platform
- `WORKSPACE`: All projects within admin's workspace/cohort
- `SHARED`: Only on projects where user is a team member
- `CONFIGURED`: Depends on `permissionLevel` set by participante
- `CHECKPOINT`: Only Steps 0, 2, 4
- `IF ENABLED`: Only if `commentEnabled = true` on team membership

## Consequences

### Positive
- Declarative action-based guards make route definitions self-documenting
- Configurable Colaborador permissions allow project owners to fine-tune team access
- Sponsor checkpoint model prevents scope creep while enabling strategic oversight
- Admin scope separation supports multi-tenant workspace isolation
- The `ACTION_POLICY_MAP` serves as a single source of truth for all authorization decisions
- Backward-compatible JWT versioning (`v: 2`) allows gradual migration

### Negative
- Additional database query in `resolveProjectContext` for every project-scoped request (mitigated by Redis caching of membership data)
- More complex mental model than the current 4-role RBAC (mitigated by centralized policy map)
- `project_assignments` table now stores both mentor and sponsor, requiring migration of the unique constraint
- Checkpoint step filtering adds conditional logic that may be surprising to developers

### Neutral
- `leader` role is deprecated in favor of workspace-scoped `admin`
- `owner` role is renamed to `participante` to better reflect domain language
- The `comment` access level is lower than `read` in the hierarchy, meaning commenters can view project data they comment on

## Migration Strategy

1. Add new enum values to `Role` type
2. Add new columns to `users` and `team_members`
3. Deploy middleware v2 with backward-compatible JWT handling
4. Migrate existing `owner` users to `participante`
5. Migrate existing `leader` users to workspace-scoped `admin`
6. Update JWT token generation to include `v: 2`, `adminScope`, `workspaceId`
7. Remove old role references from codebase

## References
- ADR-003: Authentication (JWT structure)
- ADR-004: Authorization Model v1 (superseded by this ADR)
- ADR-006: State Machine (step status transitions)
- OWASP Authorization Cheat Sheet
