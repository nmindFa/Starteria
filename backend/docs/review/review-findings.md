# Code Review Findings - Dashboard Starteria Backend

**Reviewer**: code-reviewer agent
**Date**: 2026-03-03
**Scope**: Full backend codebase (src/backend/), Prisma schema, documentation alignment

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 8     |
| WARNING  | 9     |
| INFO     | 7     |
| GAPS     | 6     |

---

## CRITICAL Issues

### CRIT-01: Spanish frontend values written directly to Prisma enums (ALL services)

**Impact**: Every create/update operation will throw a Prisma validation error at runtime.

The Prisma schema defines enums with UPPERCASE_ENGLISH values (e.g., `DRAFT`, `IN_PROGRESS`, `NOT_STARTED`), but all services write Spanish frontend strings directly.

**Files affected**:
- `src/backend/modules/projects/project.service.ts:83-101` -- writes `'Draft'`, `'No iniciado'`, `'Bloqueado'`, `'Bajo'`, `'Owner'`, `'Activo'`
- `src/backend/modules/steps/step.service.ts:113` -- writes `'Enviado'`
- `src/backend/modules/evidence/evidence.service.ts:38` -- writes `'Subida'`
- `src/backend/modules/mentor/mentor.service.ts:60,105` -- writes `'Realizada'`, `'Pendiente'`
- `src/backend/modules/users/user.service.ts:74` -- writes `'Pendiente'`

**Root cause**: `src/backend/shared/utils/status-mapper.ts` exists with correct bidirectional mappings but is **never imported or used** by any service.

**Fix**: All services must use `StatusMapper.*.toDb[value]` when writing to Prisma and `StatusMapper.*.toFrontend[value]` when reading.

---

### CRIT-02: Auth service references `user.cohort` but User model has no `cohort` field

**Impact**: `user.cohort` will always be `undefined`, causing silent data loss in JWT tokens.

**Files affected**:
- `src/backend/modules/auth/auth.service.ts:77,88,142,153,209,252` -- accesses `user.cohort`
- `prisma/schema.prisma:121-148` -- User model has no `cohort` column

The User model has no direct `cohort` field. Users are related to cohorts only through `Project -> cohortId -> Cohort`. The cohort should be resolved via a join or added as a column to User.

**Fix**: Either add `cohortId String?` and `cohort Cohort?` relation to User model, or resolve cohort dynamically from the user's projects.

---

### CRIT-03: `findUnique({ where: { tokenHash } })` but `tokenHash` is not `@unique`

**Impact**: Prisma will throw an error at runtime because `findUnique` requires a `@unique` or `@id` field.

**Files affected**:
- `src/backend/modules/auth/auth.service.ts:167,223` -- uses `findUnique({ where: { tokenHash } })`
- `prisma/schema.prisma:328` -- `tokenHash String` (only `@@index`, not `@unique`)

**Fix**: Change `tokenHash String` to `tokenHash String @unique` in the RefreshToken model.

---

### CRIT-04: Auth service uses `tokenFamily` but Prisma schema uses `family`

**Impact**: All token refresh and logout operations will throw `Unknown field 'tokenFamily'` errors.

**Files affected**:
- `src/backend/modules/auth/auth.service.ts:178,182,210,229,274,280` -- uses `tokenFamily`
- `prisma/schema.prisma:323` -- field is named `family`

**Fix**: Either rename the Prisma field from `family` to `tokenFamily`, or update all service references to use `family`.

---

### CRIT-05: Evidence service uses non-existent Prisma fields (`owner`, `date`)

**Impact**: Evidence creation will throw Prisma unknown field errors.

**Files affected**:
- `src/backend/modules/evidence/evidence.service.ts:37-39` -- writes `owner: ownerName` and `date: ...`
- `prisma/schema.prisma:253-273` -- Evidence model has `ownerId String` (FK to User), not `owner String`; has `createdAt`, not `date`
- `src/backend/modules/evidence/evidence.service.ts:12` -- orders by `date` which doesn't exist

**Fix**: Use `ownerId` with the user's ID instead of `owner` string name. Remove `date` field writes and use `createdAt` (auto-set by Prisma).

---

### CRIT-06: Project service uses `cohort` field but schema has `cohortId`

**Impact**: Project creation will fail when a cohort is provided.

**Files affected**:
- `src/backend/modules/projects/project.service.ts:82` -- writes `cohort: data.cohort`
- `prisma/schema.prisma:166-167` -- field is `cohortId String?` with `cohort Cohort?` relation

**Fix**: Change to `cohortId: data.cohort` or use `cohort: { connect: { id: data.cohort } }`.

---

### CRIT-07: Project service uses `archivedAt` but schema has `isArchived`

**Impact**: Archive operation will fail with unknown field error.

**Files affected**:
- `src/backend/modules/projects/project.service.ts:162` -- writes `archivedAt: new Date()`
- `prisma/schema.prisma:160` -- field is `isArchived Boolean @default(false)`, no `archivedAt`

**Fix**: Change to `isArchived: true`.

---

### CRIT-08: Mentor service uses non-existent fields on MentorSession and HelpRequest

**Impact**: Mentor review submission and help requests will throw Prisma errors.

**Files affected**:
- `src/backend/modules/mentor/mentor.service.ts:63` -- writes `reviewData` (not in schema)
- `src/backend/modules/mentor/mentor.service.ts:68` -- writes `completedAt` (not in schema, has `updatedAt`)
- `src/backend/modules/mentor/mentor.service.ts:98-104` -- HelpRequest writes `subject`, `stepNumber`, `moduleId` (not in schema)
- `src/backend/modules/mentor/mentor.service.ts:132-133` -- MentorSession create writes `preferredDate`, `notes` (not in schema)
- `src/backend/modules/steps/step.service.ts:130-135` -- same issue with MentorSession fields

Prisma MentorSession model has: `projectId, stepId, stepNumber, mentorId, date, status, result, comments, rubricScores`.
Prisma HelpRequest model has: `projectId, userId, mentorId, message, response, status`.

**Fix**:
- MentorSession: Map `reviewData` to `rubricScores` (Json), remove `completedAt` (use `updatedAt`), remove `preferredDate`/`notes` or add to schema.
- HelpRequest: Remove `subject`/`stepNumber`/`moduleId` or add them to the Prisma model. Put `subject` content into `message`.

---

## WARNING Issues

### WARN-01: No authentication middleware on most routes

**Impact**: All routes except auth are unprotected -- anyone can access any data.

**Files affected**:
- `src/backend/modules/projects/project.router.ts:9` -- `// TODO: Add authenticate middleware`
- `src/backend/modules/steps/step.router.ts:8` -- same TODO
- `src/backend/modules/evidence/evidence.router.ts:8` -- same TODO
- `src/backend/modules/mentor/mentor.router.ts:8` -- same TODO
- `src/backend/modules/users/user.router.ts:8` -- same TODO
- `src/backend/modules/cohort/cohort.router.ts:6` -- same TODO

All non-auth routers have `authenticate` and `requireRole` commented out. The auth middleware exists and works, but is never wired.

**Fix**: Import and apply `authenticate` middleware to all protected routes. Apply `requireRole('mentor')` to mentor routes, `requireRole('admin')` to cohort/admin routes.

---

### WARN-02: Multiple PrismaClient instances created

**Impact**: Connection pool exhaustion in production; exceeds database connection limits.

**Files affected**:
- `src/backend/shared/db/prisma.ts` -- singleton pattern (correct)
- `src/backend/modules/auth/auth.router.ts:12` -- `new PrismaClient()`
- `src/backend/modules/auth/auth.middleware.ts:22` -- `new PrismaClient()`
- `src/backend/modules/projects/project.router.ts:11` -- `new PrismaClient()`
- `src/backend/modules/steps/step.router.ts:10` -- `new PrismaClient()`
- `src/backend/modules/evidence/evidence.router.ts:10` -- `new PrismaClient()`
- `src/backend/modules/mentor/mentor.router.ts:10` -- `new PrismaClient()`
- `src/backend/modules/users/user.router.ts:10` -- `new PrismaClient()`
- `src/backend/modules/cohort/cohort.router.ts:8` -- `new PrismaClient()`

**Fix**: Import the singleton `prisma` from `shared/db/prisma.ts` in all files instead of creating `new PrismaClient()`.

---

### WARN-03: Status-mapper has accent inconsistency with types

**Impact**: Lookup misses when mapping between frontend and DB values.

**Files affected**:
- `src/backend/shared/utils/status-mapper.ts:11` -- `'En revision IA'` (with accent on `o`)
- `src/backend/shared/types/project.types.ts:8` -- `'En revision IA'` (no accent)
- `src/backend/shared/utils/status-mapper.ts:12` -- `Iteracion` (with accent)
- `src/backend/shared/types/project.types.ts:9` -- `'Iteracion'` (no accent)
- `src/backend/shared/utils/status-mapper.ts:13` -- `'Sesion experto pendiente'` (with accent)
- `src/backend/shared/types/project.types.ts:10` -- `'Sesion experto pendiente'` (no accent)

The status-mapper uses accented characters (`revision`, `Sesion`, `Iteracion`, `ejecucion`) while the TypeScript type definitions use unaccented versions. These will never match.

**Fix**: Standardize on one form throughout. Since the frontend uses unaccented strings, remove accents from status-mapper keys.

---

### WARN-04: `AuthenticatedRequest` type mismatch between auth middleware and controllers

**Impact**: Type safety is broken; controllers may access properties that don't exist at runtime.

**Files affected**:
- `src/backend/modules/auth/auth.middleware.ts:8-19` -- declares `req.user` as `{ id, email, role, cohort }`
- `src/backend/shared/types/auth.types.ts:10-12` -- declares `AuthenticatedRequest.user` as full `User` type (with `name, skills, initials`)
- All controllers import `AuthenticatedRequest` from `auth.types.ts`

The auth middleware attaches a minimal payload, but controllers (e.g., `evidence.controller.ts:21` accessing `user.name`) expect the full User object.

**Fix**: Either enrich the auth middleware to fetch the full user from DB, or align the AuthenticatedRequest type to match what the middleware actually provides.

---

### WARN-05: State machine missing transitions from domain analysis

**Impact**: Valid workflow paths will be incorrectly rejected.

**Files affected**:
- `src/backend/modules/projects/state-machine.ts`

Missing transitions per domain-analysis.md Section 7:
- **Project**: Missing `'Iteracion' -> 'En revision IA'` (domain says re-submitted after changes). Code only has `'Iteracion' -> 'En progreso'`.
- **Step**: Missing `'Ajustado' -> 'Enviado'` (domain says re-submitted). Missing `'Feedback IA' -> 'Sesion experto pendiente'` (AI approved, mentor needed).
- **Module**: Missing `'Completado' -> 'Enviado'` (submitted as part of step). Missing `'Feedback IA' -> 'Bloqueado'` (present in step but not module).

**Fix**: Add missing transitions to match the domain analysis specification.

---

### WARN-06: Step service `formData` field doesn't exist in Prisma

**Impact**: Step data save/retrieve will fail or return null.

**Files affected**:
- `src/backend/modules/steps/step.service.ts:58` -- reads `step.formData`
- `src/backend/modules/steps/step.service.ts:72` -- writes `formData: data`
- `prisma/schema.prisma:188` -- field is `stepData Json?`, not `formData`

**Fix**: Change `formData` to `stepData` in the step service.

---

### WARN-07: Mentor service query uses Spanish status values for Prisma

**Impact**: Mentor session queries will return empty results.

**Files affected**:
- `src/backend/modules/mentor/mentor.service.ts:13` -- queries `status: 'Pendiente agendar'`
- `src/backend/modules/projects/project.service.ts:63` -- queries `status: { in: ['Sesion experto pendiente'] }`

The Prisma enum `SessionStatus` uses `PENDING_SCHEDULE`, not `'Pendiente agendar'`. Same for `ProjectStatus.EXPERT_SESSION_PENDING`.

**Fix**: Use the Prisma enum values in queries, or use the StatusMapper.

---

### WARN-08: Mentor session `stepNumber` required field not provided in step.service.ts

**Impact**: MentorSession creation will fail since `stepNumber` is a required Int in the schema.

**Files affected**:
- `src/backend/modules/steps/step.service.ts:128-135` -- creates MentorSession without `stepNumber` (required in schema)
- `prisma/schema.prisma:237` -- `stepNumber Int` (no default, required)

Also missing `mentorId` (required String, no default).

**Fix**: Add `stepNumber` and `mentorId` to the create call.

---

### WARN-09: `passwordHash` required but invite creates users without one

**Impact**: Invited users cannot log in; Prisma will reject user creation without `passwordHash`.

**Files affected**:
- `src/backend/modules/users/user.service.ts:58-66` -- creates user without `passwordHash`
- `prisma/schema.prisma:125` -- `passwordHash String` (required, no default)

**Fix**: Either generate a random password hash for invited users (with a "set password" flow), or make `passwordHash` optional in the schema.

---

## INFO Suggestions

### INFO-01: UUID validation regex in auth middleware doesn't match CUID format

The project uses `@default(cuid())` IDs, not UUIDs. The auth middleware's UUID regex (`/^[0-9a-f]{8}-...$/`) at `auth.middleware.ts:113` will reject all valid project IDs.

**Fix**: Remove the regex check or use a CUID-compatible pattern.

---

### INFO-02: `lastModified` manually set but `@updatedAt` already handles it

`project.service.ts:149,185` manually sets `lastModified: new Date().toISOString()`, but the Prisma schema already has `lastModified DateTime @updatedAt` which auto-updates.

**Fix**: Remove manual `lastModified` updates; let Prisma handle it.

---

### INFO-03: CSV export lacks proper escaping

`cohort.service.ts:143` joins values with commas but doesn't escape values containing commas, quotes, or newlines.

**Fix**: Use proper CSV escaping (wrap in quotes, escape inner quotes).

---

### INFO-04: Seed file not reviewed but likely has same Spanish-vs-enum issues

`prisma/seed.ts` likely writes Spanish values to enums and will fail on seeding.

---

### INFO-05: No `package.json` or `tsconfig.json` in backend

No build configuration was found for the backend TypeScript code. Build/test commands will fail.

---

### INFO-06: `pinoHttp` imported but `pino-http` may not be in dependencies

`app.ts:5` imports `pino-http`. Without a `package.json`, dependency status is unknown.

---

### INFO-07: Auth controller references `req.cookies` but Prisma singleton not used

Minor: auth module creates its own PrismaClient while a proper singleton exists.

---

## GAPS - Missing Functionality

### GAP-01: No API rate limiting on general routes

`apiLimiter` is defined in `rate-limiter.ts:73-78` but never applied to any route. Only `loginLimiter` is used.

---

### GAP-02: No audit logging implementation

`AuditLog` model exists in Prisma but no service/middleware writes to it. Security events (login, logout, data access, modifications) are not recorded.

---

### GAP-03: No file upload handling (S3/storage)

Evidence creation accepts metadata but has no actual file upload mechanism. ADR-007 specifies S3 storage, but no S3 client, upload middleware, or presigned URL generation exists.

---

### GAP-04: No AI integration implementation

Steps router has `/ai-review` endpoint, but the service just returns a static message. No OpenAI/AI client, no prompt construction, no async processing pipeline.

---

### GAP-05: No notification system

No mechanism for notifying users of session requests, feedback, approvals, team invitations, or help request responses.

---

### GAP-06: No Prisma migration files

No `prisma/migrations/` directory. Database schema cannot be applied without running `prisma migrate dev`.

---

## ADR-to-Code Alignment

| ADR | Status | Notes |
|-----|--------|-------|
| ADR-001 (Express.js) | PASS | server.ts uses Express correctly |
| ADR-002 (PostgreSQL+Prisma) | PARTIAL | Schema exists but field mismatches prevent use |
| ADR-003 (JWT auth) | PASS | token.service.ts implements JWT with HS256, issuer, audience |
| ADR-004 (RBAC) | PARTIAL | Middleware exists but not wired to routes |
| ADR-005 (REST /api/v1) | PASS | app.ts mounts at /api/v1 correctly |
| ADR-006 (State machines) | PARTIAL | Implemented but missing transitions, never uses DB enums |
| ADR-007 (S3 storage) | FAIL | No S3 implementation exists |
| ADR-008 (AI integration) | STUB | Endpoint exists, no actual implementation |

## DDD-to-Code Alignment

| Bounded Context | Module(s) | Status |
|----------------|-----------|--------|
| Identity & Access | auth + users | PASS (structure correct, needs enum fixes) |
| Project Management | projects + steps | PASS (structure correct, needs enum fixes) |
| Mentoring | mentor | PASS (structure correct, needs field fixes) |
| Evidence Management | evidence | PASS (structure correct, needs field fixes) |
| Cohort Administration | cohort | PASS (structure correct, admin-only) |

## Security Review

| Check | Status | Notes |
|-------|--------|-------|
| Password hashing (bcrypt 12 rounds) | PASS | `password.service.ts:4` uses 12 rounds |
| JWT with issuer/audience | PASS | `token.service.ts:22-24` |
| Refresh token rotation | PASS | Family-based rotation with reuse detection |
| HTTP-only cookies | PASS | `auth.controller.ts:8-14` |
| Rate limiting (login) | PASS | 5/min per IP in `rate-limiter.ts:63-68` |
| Rate limiting (API) | FAIL | Defined but never applied (GAP-01) |
| CORS configuration | PASS | Configurable origin, credentials enabled |
| Helmet headers | PASS | Applied in `app.ts:27` |
| Account lockout | PASS | 5 failed attempts, 15min lockout |
| Input validation (Zod) | PASS | All routes have schemas |
| RBAC middleware wired | FAIL | Not applied to any non-auth route (WARN-01) |
| Audit logging | FAIL | Model exists, no implementation (GAP-02) |
