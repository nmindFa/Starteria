# ADR-009: Role Model Evolution (4 roles to 6 roles)

**Status**: Proposed
**Date**: 2026-03-24
**Author**: Architecture Agent

## Context

The current system uses a flat 4-role enum at the platform level (`owner`, `mentor`, `admin`, `leader`) and a separate 3-value `TeamRole` enum at the project level (`OWNER`, `EDITOR`, `VIEWER`). This model has several limitations:

1. **Naming confusion**: `owner` (platform) means "participante" in business terms; `OWNER` (TeamRole) means "project creator". Two different concepts share the name.
2. **No sponsor per-project assignment**: The `leader` role is platform-global, but sponsors must be assigned per initiative at specific checkpoints.
3. **No colaborador concept**: Team collaborators exist only through `TeamRole.EDITOR`, which conflates "invited collaborator" with "permission level".
4. **No read-only viewer at platform level**: External stakeholders cannot be modeled.
5. **Frontend already diverged**: The frontend already uses `sponsor` instead of `leader`, creating a backend/frontend mismatch.

## Decision

### 1. Split into PlatformRole + ProjectRole (two enums)

We adopt a **two-enum model** that cleanly separates platform identity from project-level permissions.

**Rationale for splitting rather than a single expanded enum:**

- A user's *platform identity* (participante, mentor, admin) is stable and determines what they can do across the system.
- A user's *project-level role* varies per project. The same user can be the project owner in one project and a sponsor in another.
- `colaborador` and `viewer` are inherently project-scoped -- they make no sense at the platform level since they are always relative to a specific project.
- Sponsors act per-project at defined checkpoints, not as a global platform capability.

### 2. New Enum Definitions

```prisma
// Platform-level identity: what kind of user are you in the system?
enum PlatformRole {
  participante   // Creates and develops initiatives (was: owner)
  mentor         // Expert reviewer assigned to initiatives
  admin          // Governance and platform management
}

// Project-level role: what is your role within a specific project?
enum ProjectRole {
  OWNER          // Project creator, full control (1 per project)
  SPONSOR        // Strategic leader at checkpoints (was: leader, via TeamRole)
  COLABORADOR    // Invited contributor with edit permissions
  VIEWER         // Read-only observer
}
```

**Key decisions in this design:**

- **`sponsor` is NOT a PlatformRole.** A sponsor is always assigned per-project. A user with PlatformRole `participante` can be a sponsor in another project. This is modeled through `TeamMember.role = SPONSOR`.
- **`colaborador` and `viewer` are NOT PlatformRoles.** They are project-scoped. A person invited as a colaborador in one project has no implicit access to other projects.
- **`PlatformRole` has only 3 values**, keeping it tight and unambiguous. Platform role determines system-wide capabilities (can create projects, can review projects, can manage the platform).
- **`EDITOR` is renamed to `COLABORADOR`** for domain clarity. The old name described a permission; the new name describes a business role.
- **`leader` is removed entirely.** It is replaced by `ProjectRole.SPONSOR` at the project level.

### 3. Modified Model Definitions

```prisma
// ─── Enums ──────────────────────────────────────────────────────────────────

enum PlatformRole {
  participante
  mentor
  admin
}

enum ProjectRole {
  OWNER
  SPONSOR
  COLABORADOR
  VIEWER
}

enum TeamMemberStatus {
  ACTIVE
  PENDING
  DECLINED
}

// ─── User ───────────────────────────────────────────────────────────────────

model User {
  id                  String       @id @default(cuid())
  email               String       @unique
  name                String
  passwordHash        String
  role                PlatformRole              // <-- was: Role
  initials            String
  skills              String[]
  bio                 String?
  avatarUrl           String?
  isActive            Boolean      @default(true)
  failedLoginAttempts Int          @default(0)
  lockedUntil         DateTime?
  cohortId            String?
  cohort              Cohort?      @relation(fields: [cohortId], references: [id])
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  projects            Project[]               // Projects this user owns (via Project.ownerId)
  teamMemberships     TeamMember[]             // All project memberships
  mentorSessions      MentorSession[]
  evidence            Evidence[]
  refreshTokens       RefreshToken[]
  auditLogs           AuditLog[]
  helpRequests        HelpRequest[]  @relation("HelpRequester")
  mentorHelpRequests  HelpRequest[]  @relation("HelpMentor")
  sponsorComments     SponsorComment[]         // <-- NEW relation

  @@index([email])
  @@index([role])
  @@index([cohortId])
}

// ─── TeamMember (project-level role assignment) ─────────────────────────────

model TeamMember {
  id        String           @id @default(cuid())
  projectId String
  project   Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  role      ProjectRole      @default(VIEWER)  // <-- was: TeamRole
  status    TeamMemberStatus @default(PENDING)
  invitedAt DateTime         @default(now())
  joinedAt  DateTime?

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
  @@index([role])                              // <-- NEW index for role-based queries
}

// ─── SponsorTouchpoint (NEW model for sponsor checkpoints) ──────────────────

model SponsorTouchpoint {
  id         String                  @id @default(cuid())
  projectId  String
  project    Project                 @relation(fields: [projectId], references: [id], onDelete: Cascade)
  checkpoint SponsorCheckpoint                  // Which checkpoint this represents
  title      String
  stageLabel String
  status     SponsorTouchpointStatus @default(PENDING_INVITATION)
  date       DateTime?
  createdAt  DateTime                @default(now())
  updatedAt  DateTime                @updatedAt

  comments   SponsorComment[]

  @@unique([projectId, checkpoint])            // One touchpoint per checkpoint per project
  @@index([projectId])
  @@index([status])
}

enum SponsorCheckpoint {
  STEP0     // Initial alignment
  STEP2     // Mid-point review
  STEP4     // Final review
}

enum SponsorTouchpointStatus {
  PENDING_INVITATION
  REVIEW_REQUESTED
  SESSION_SCHEDULED
  COMMENT_SENT
  CLOSED
}

// ─── SponsorComment (NEW model) ─────────────────────────────────────────────

model SponsorComment {
  id            String            @id @default(cuid())
  touchpointId  String
  touchpoint    SponsorTouchpoint @relation(fields: [touchpointId], references: [id], onDelete: Cascade)
  authorId      String
  author        User              @relation(fields: [authorId], references: [id])
  message       String
  createdAt     DateTime          @default(now())

  @@index([touchpointId])
  @@index([authorId])
}

// ─── Project (updated relations) ────────────────────────────────────────────

model Project {
  id            String        @id @default(cuid())
  name          String
  description   String?
  status        ProjectStatus @default(DRAFT)
  currentStep   Int           @default(0)
  step0Status   Step0Status   @default(NOT_STARTED)
  step0Data     Json?
  mentorCredits Int           @default(3)
  riskLevel     RiskLevel?
  isArchived    Boolean       @default(false)
  createdAt     DateTime      @default(now())
  lastModified  DateTime      @updatedAt

  ownerId  String
  owner    User    @relation(fields: [ownerId], references: [id])
  cohortId String?
  cohort   Cohort? @relation(fields: [cohortId], references: [id])

  steps               Step[]
  evidence            Evidence[]
  teamMembers         TeamMember[]
  mentorSessions      MentorSession[]
  helpRequests        HelpRequest[]
  sponsorTouchpoints  SponsorTouchpoint[]      // <-- NEW relation

  @@index([ownerId])
  @@index([cohortId])
  @@index([status])
}
```

### 4. Role Capability Matrix

| Capability                       | participante | mentor | admin | OWNER (proj) | SPONSOR (proj) | COLABORADOR (proj) | VIEWER (proj) |
|----------------------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create projects                  | Y | - | Y | - | - | - | - |
| Edit project data                | - | - | Y | Y | - | Y | - |
| View project data                | - | Y | Y | Y | Y | Y | Y |
| Manage team members              | - | - | Y | Y | - | - | - |
| Submit steps for review          | - | - | - | Y | - | Y | - |
| Conduct mentor sessions          | - | Y | Y | - | - | - | - |
| Comment on sponsor touchpoints   | - | - | - | - | Y | - | - |
| Manage cohorts                   | - | - | Y | - | - | - | - |
| Manage users/roles               | - | - | Y | - | - | - | - |
| Upload evidence                  | - | - | Y | Y | - | Y | - |

### 5. Sponsor Assignment and Gate Model

Sponsors are assigned via `TeamMember` with `role = SPONSOR`. A project can have **multiple sponsors**. Sponsor touchpoints at Steps 0, 2, 4 are **soft gates** (advisory, not blocking) -- the project can progress while awaiting sponsor feedback, but feedback is tracked and surfaced. This replaces the current JSON-embedded approach in the frontend.

**State machine integration (see ADR-006):** Transition guards for steps at sponsor checkpoints (0, 2, 4) should emit `SponsorReviewRequested` events but NOT block the `approved -> completed` transition. Admin can override if sponsor feedback is absent.

### 6. Multi-Role Support

Cross-project multi-role is native: a user has one `PlatformRole` and one `ProjectRole` per project via `TeamMember` (`@@unique([projectId, userId])`). A `participante` can be a SPONSOR in another project. PlatformRole does not restrict which ProjectRoles a user can hold.

### 7. Permission Resolution Logic

```typescript
function resolveProjectAccess(
  user: { id: string; role: PlatformRole },
  project: {
    id: string;
    teamMembers: Array<{ userId: string; role: ProjectRole }>;
  },
): 'none' | 'read' | 'write' | 'admin' {
  // Admin always has full access
  if (user.role === 'admin') return 'admin';

  // Mentor has read access to assigned projects
  if (user.role === 'mentor') {
    const isMember = project.teamMembers.some(m => m.userId === user.id);
    if (isMember) return 'read';
  }

  // For all users: resolve based on project role
  const membership = project.teamMembers.find(m => m.userId === user.id);
  if (!membership) return 'none';

  switch (membership.role) {
    case 'OWNER':        return 'write';
    case 'COLABORADOR':  return 'write';
    case 'SPONSOR':      return 'read';   // sponsors read + comment via touchpoints
    case 'VIEWER':       return 'read';
    default:             return 'none';
  }
}
```

### 8. Migration SQL Pseudocode

```sql
-- ============================================================
-- MIGRATION: Evolve from 4-role to 6-role model
-- ============================================================

-- STEP 1: Create new PlatformRole enum
CREATE TYPE "PlatformRole" AS ENUM ('participante', 'mentor', 'admin');

-- STEP 2: Create new ProjectRole enum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'SPONSOR', 'COLABORADOR', 'VIEWER');

-- STEP 3: Create new SponsorCheckpoint and SponsorTouchpointStatus enums
CREATE TYPE "SponsorCheckpoint" AS ENUM ('STEP0', 'STEP2', 'STEP4');
CREATE TYPE "SponsorTouchpointStatus" AS ENUM (
  'PENDING_INVITATION', 'REVIEW_REQUESTED',
  'SESSION_SCHEDULED', 'COMMENT_SENT', 'CLOSED'
);

-- STEP 4: Add DECLINED to TeamMemberStatus
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- In Prisma, wrap this step in a separate migration or use executeRaw outside a transaction.
ALTER TYPE "TeamMemberStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

-- STEP 5: Migrate User.role from Role to PlatformRole
--   owner  -> participante
--   mentor -> mentor
--   admin  -> admin
--   leader -> participante (leaders become participantes at platform level;
--             their sponsor role is project-scoped via TeamMember)

ALTER TABLE "User" ADD COLUMN "role_new" "PlatformRole";

UPDATE "User" SET "role_new" = CASE
  WHEN "role" = 'owner'  THEN 'participante'::"PlatformRole"
  WHEN "role" = 'mentor' THEN 'mentor'::"PlatformRole"
  WHEN "role" = 'admin'  THEN 'admin'::"PlatformRole"
  WHEN "role" = 'leader' THEN 'participante'::"PlatformRole"
END;

ALTER TABLE "User" ALTER COLUMN "role_new" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";

-- STEP 6: Migrate TeamMember.role from TeamRole to ProjectRole
--   OWNER  -> OWNER
--   EDITOR -> COLABORADOR
--   VIEWER -> VIEWER

ALTER TABLE "TeamMember" ADD COLUMN "role_new" "ProjectRole";

UPDATE "TeamMember" SET "role_new" = CASE
  WHEN "role" = 'OWNER'  THEN 'OWNER'::"ProjectRole"
  WHEN "role" = 'EDITOR' THEN 'COLABORADOR'::"ProjectRole"
  WHEN "role" = 'VIEWER' THEN 'VIEWER'::"ProjectRole"
END;

ALTER TABLE "TeamMember" ALTER COLUMN "role_new" SET NOT NULL;
ALTER TABLE "TeamMember" DROP COLUMN "role";
ALTER TABLE "TeamMember" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "TeamMember" ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"ProjectRole";

-- STEP 7: Insert sponsor TeamMember records for existing leaders
--   For each user with old role = 'leader', find projects they were
--   associated with and create SPONSOR TeamMember entries.
--   (This depends on how leaders were previously associated with projects;
--    if via cohort, iterate cohort projects.)

-- NOTE: This requires application-level logic since the old schema
-- had no explicit leader-to-project assignment. A manual mapping
-- or admin action may be needed for existing leaders.

-- STEP 8: Create SponsorTouchpoint table
CREATE TABLE "SponsorTouchpoint" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "projectId"  TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "checkpoint" "SponsorCheckpoint" NOT NULL,
  "title"      TEXT NOT NULL,
  "stageLabel" TEXT NOT NULL,
  "status"     "SponsorTouchpointStatus" NOT NULL DEFAULT 'PENDING_INVITATION',
  "date"       TIMESTAMP,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("projectId", "checkpoint")
);

CREATE INDEX "SponsorTouchpoint_projectId_idx" ON "SponsorTouchpoint"("projectId");
CREATE INDEX "SponsorTouchpoint_status_idx" ON "SponsorTouchpoint"("status");

-- STEP 9: Create SponsorComment table
CREATE TABLE "SponsorComment" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "touchpointId" TEXT NOT NULL REFERENCES "SponsorTouchpoint"("id") ON DELETE CASCADE,
  "authorId"     TEXT NOT NULL REFERENCES "User"("id"),
  "message"      TEXT NOT NULL,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE INDEX "SponsorComment_touchpointId_idx" ON "SponsorComment"("touchpointId");
CREATE INDEX "SponsorComment_authorId_idx" ON "SponsorComment"("authorId");

-- STEP 10: Add role index on TeamMember
CREATE INDEX "TeamMember_role_idx" ON "TeamMember"("role");

-- STEP 11: Seed default SponsorTouchpoints for existing projects
INSERT INTO "SponsorTouchpoint" ("id", "projectId", "checkpoint", "title", "stageLabel")
SELECT
  gen_random_uuid()::text,
  p."id",
  checkpoint,
  CASE checkpoint
    WHEN 'STEP0' THEN 'Alineamiento inicial'
    WHEN 'STEP2' THEN 'Revision intermedia'
    WHEN 'STEP4' THEN 'Revision final'
  END,
  CASE checkpoint
    WHEN 'STEP0' THEN 'Step 0'
    WHEN 'STEP2' THEN 'Step 2'
    WHEN 'STEP4' THEN 'Step 4'
  END
FROM "Project" p
CROSS JOIN (VALUES ('STEP0'::"SponsorCheckpoint"), ('STEP2'::"SponsorCheckpoint"), ('STEP4'::"SponsorCheckpoint")) AS c(checkpoint);

-- STEP 12: Drop old enums (after verifying no columns reference them)
DROP TYPE "Role";
DROP TYPE "TeamRole";
```

### 9. Backend Code Changes Required

| File | Change | Impact |
|------|--------|--------|
| `shared/types/user.types.ts` | `Role` type: `'owner'\|'mentor'\|'admin'\|'leader'` becomes `'participante'\|'mentor'\|'admin'`. `TeamMember.role` type becomes `'OWNER'\|'SPONSOR'\|'COLABORADOR'\|'VIEWER'`. | **Breaking**: all imports of `Role` |
| `modules/auth/auth.schemas.ts` | `registerSchema.role`: change enum to `['participante', 'mentor', 'admin']`, default to `'participante'` | **Breaking**: API contract |
| `modules/auth/auth.service.ts` | `data.role !== 'owner'` becomes `data.role !== 'participante'`, error message updated | Functional change |
| `modules/auth/auth.middleware.ts` | `requireRole()` parameter type changes from `Role` to `PlatformRole`. `resolveProjectAccess()` rewritten per section 7 above. References to `'leader'` removed. | **Breaking**: middleware signatures |
| `modules/projects/project.service.ts` | Add `case 'participante'` as default in `listProjects()` | Minor update |
| `modules/users/user.service.ts` | Default role: `'owner'` becomes `'participante'` | Data change |
| `shared/utils/status-mapper.ts` | Add `Sponsor: 'SPONSOR'`, rename `Editor: 'COLABORADOR'`. Add `platformRole` mapper. | **Breaking** |

### 10. Frontend Code Changes Required

| File | Change |
|------|--------|
| `AppContext.tsx` | Rename `'owner'` to `'participante'` in Role type. Remove `'sponsor'` from platform Role. `TeamMember.role`: add `'Sponsor'\|'Colaborador'`. Align `SponsorTouchpoint`/`SponsorComment` fields with backend. |

### 11. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `leader` users lose role identity | Map to `participante`; admin re-assigns as SPONSOR per project. Email notice before migration. |
| `EDITOR` -> `COLABORADOR` rename | Update `StatusMapper` bidirectionally. Atomic deploy or feature flag. |
| No historical sponsor-project data | Admin UI/CLI to bulk-assign existing leaders as sponsors on cohort projects. |
| API consumers using `owner` | Accept both `owner` and `participante` via Zod transform for 30 days. |

### 12. Backward Compatibility Strategy

During a 30-day transition, the backend accepts legacy values via Zod transform (`'owner'` -> `'participante'`) and `StatusMapper` aliases (`Owner: 'participante'`, `Leader: 'participante'`). See section 11 risk table for timeline.

### 13. Middleware Chain (4-layer)

1. `authenticate` -- verify JWT, extract PlatformRole from token
2. `requireRole(...roles)` -- check PlatformRole against allowed list
3. `requireProjectAccess(level)` -- resolve ProjectRole from TeamMember table
4. Resource-specific guards (e.g., `requireSponsorTouchpointAccess`, `requireColaboradorWriteAccess`)

### 14. Domain Events (new)

- `PlatformRoleMigrated` -- emitted during migration for each user whose role changed
- `SponsorAssignedToProject` / `SponsorRemovedFromProject`
- `SponsorTouchpointStatusChanged` -- when touchpoint transitions status
- `SponsorCommentAdded` -- when sponsor leaves feedback
- `ColaboradorInvited` / `ColaboradorAccepted` / `ColaboradorDeclined`

### 15. JWT Impact

JWT payload `role` field changes from `'owner'|'mentor'|'admin'|'leader'` to `'participante'|'mentor'|'admin'`. Project-level roles (SPONSOR, COLABORADOR, VIEWER) are NOT in the JWT -- resolved per-request via TeamMember. Existing tokens with `role='owner'` or `role='leader'` become invalid but expire within 15 minutes (ADR-003). Force re-login is recommended during deployment.

## Consequences

**Positive:**
- Clean separation between platform identity and project permissions
- Sponsor is properly modeled per-project with structured touchpoints at Steps 0, 2, 4
- Multi-role across projects is naturally supported via TeamMember
- Aligns backend with frontend's existing `sponsor` terminology

**Negative:**
- Breaking change for API consumers (role enum values change)
- Migration requires coordinated backend/frontend deploy
- Existing `leader` users need manual re-assignment as sponsors on specific projects

**Neutral:**
- Total enum values: 3 (PlatformRole) + 4 (ProjectRole) = 7, vs old 4 (Role) + 3 (TeamRole) = 7. Same total, better organized.

## Alternatives Considered

### Single expanded enum (6 platform roles)
- **Pros**: Simpler -- one enum to manage, all roles in JWT
- **Cons**: Conflates platform identity with project-level permissions; `colaborador` and `viewer` are meaningless without a project context; sponsor would need a separate assignment table anyway

### ABAC (Attribute-Based Access Control)
- **Pros**: Fine-grained, policy-driven, handles complex cross-role scenarios
- **Cons**: Overkill for 3+4 role model, requires policy engine, harder to audit and reason about

## References
- ADR-003: Authentication Strategy (JWT payload, token expiry)
- ADR-004: Authorization Model (RBAC middleware, permission matrix)
- ADR-006: State Machine (transition guards, role-gated transitions)
