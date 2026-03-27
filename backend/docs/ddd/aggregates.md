# Aggregates -- Dashboard Starteria

## Overview

This document defines aggregate roots, entities, and value objects for each bounded context following DDD tactical patterns. Aggregates enforce consistency boundaries and invariants.

---

## 1. Project Aggregate

**Context:** Project Management
**Aggregate Root:** `Project`

This is the largest and most central aggregate in the system. It owns the complete lifecycle of an innovation project including its steps, modules, runs, and team.

### Aggregate Root: Project

```typescript
interface Project {
  // Identity
  id: ProjectId;                    // Value Object

  // Core attributes
  name: string;
  description?: string;
  status: ProjectStatus;            // Value Object (enum)
  currentStep: StepNumber;          // Value Object (0-4)
  riskLevel?: RiskLevel;            // Value Object (Bajo|Medio|Alto)

  // Step 0 (intake)
  step0Status: Step0Status;         // Value Object (enum)
  step0Data?: Step0Data;            // Value Object

  // Mentor credits
  mentorCredits: MentorCreditBalance; // Value Object

  // Entities (owned by this aggregate)
  steps: Step[];                    // Entity collection (always 4)
  team: TeamMember[];               // Entity collection

  // Cross-context references
  evidence: EvidenceId[];           // References to Evidence aggregate

  // Temporal
  cohort?: CohortId;               // Reference to Cohort aggregate
  createdAt: Timestamp;             // Value Object
  lastModified: Timestamp;          // Value Object
}
```

### Entity: Step

Part of the Project aggregate. Not an aggregate root -- it cannot exist independently.

```typescript
interface Step {
  // Identity (local to Project)
  number: StepNumber;               // 1 | 2 | 3 | 4

  // Attributes
  name: string;
  status: StepStatus;               // Value Object (enum)
  progress: Percentage;             // Value Object (0-100)

  // Owned entities
  modules: Module[];                // Entity collection

  // Cross-context references (from Mentoring context)
  feedbackIA?: FeedbackIA | null;   // Value Object (snapshot from Mentoring)
  mentorSession?: MentorSession | null; // Value Object (snapshot from Mentoring)

  // Step 3 only
  runs?: Run[];                     // Entity collection (only for Step 3)
}
```

### Entity: Module

Part of a Step, which is part of the Project aggregate.

```typescript
interface Module {
  // Identity (local to Step)
  id: ModuleId;                     // e.g., 'A', 'B', 'C', 'D', 'S', 'R', 'L', 'O', 'P'

  // Attributes
  name: string;
  status: ModuleStatus;             // Value Object (enum)
}
```

### Entity: Run

Experiment execution within Step 3. Part of the Project aggregate.

```typescript
interface Run {
  // Identity
  id: RunId;

  // Attributes
  name: string;
  status: RunStatus;                // Value Object (Draft|En ejecucion|Cerrado|Revisar cambios)
  createdAt: Timestamp;

  // Owned value objects
  metrics?: Metric[];               // Value Object collection
  learningCard?: LearningCard;      // Value Object
}
```

### Entity: TeamMember

A user's membership within a project. Part of the Project aggregate.

```typescript
interface TeamMember {
  // Identity
  id: TeamMemberId;

  // Attributes
  name: string;
  email: Email;                     // Value Object
  role: TeamRole;                   // Value Object (Owner|Editor|Viewer)
  status: MemberStatus;            // Value Object (Activo|Pendiente)
  initials: Initials;              // Value Object
}
```

### Value Objects

```typescript
// --- Identity Value Objects ---
type ProjectId = string;            // Unique project identifier
type ModuleId = string;             // Module identifier within step (A, B, C, etc.)
type RunId = string;                // Run identifier
type TeamMemberId = string;         // Team member identifier

// --- Status Enums (Value Objects) ---
type ProjectStatus =
  | 'Draft'
  | 'En progreso'
  | 'En revision IA'
  | 'Iteracion'
  | 'Sesion experto pendiente'
  | 'Paso aprobado'
  | 'Finalizado';

type StepStatus =
  | 'No iniciado'
  | 'En progreso'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Sesion experto pendiente'
  | 'Aprobado'
  | 'Bloqueado';

type ModuleStatus =
  | 'Draft'
  | 'En progreso'
  | 'Completado'
  | 'Bloqueado'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Aprobado';

type Step0Status = 'No iniciado' | 'En progreso' | 'Completado';

type RunStatus = 'Draft' | 'En ejecucion' | 'Cerrado' | 'Revisar cambios';

type RiskLevel = 'Bajo' | 'Medio' | 'Alto';

type TeamRole = 'Owner' | 'Editor' | 'Viewer';

type MemberStatus = 'Activo' | 'Pendiente';

type StepNumber = 0 | 1 | 2 | 3 | 4;

// --- Composite Value Objects ---
interface Step0Data {
  nombreParticipante: string;
  rolArea: string;
  origen: '' | 'problema' | 'oportunidad' | 'idea' | 'explorando' | 'otra';
  quePasaQueQuieres: string;
  impacta: string[];
  parteProceso: '' | 'antes' | 'durante' | 'despues' | 'transversal' | 'otra';
  impacto3meses: '' | 'ingresos' | 'costos' | 'riesgo' | 'cliente' | 'productividad' | 'no_claro' | 'otro';
  respaldo: '' | 'datos' | 'testimonios' | 'benchmark' | 'hipotesis' | 'otro';
  quienEscuchar: string;
  siMinimo: string[];
}

interface Metric {
  name: string;
  expected: string;
  actual?: string;
  passed?: boolean;
}

interface LearningCard {
  what: string;
  learned: string;
  decision: 'Iterar' | 'Pivot' | 'Kill' | null;
}

type Percentage = number;           // 0-100
type Timestamp = string;            // ISO 8601
type Email = string;
type Initials = string;             // 2-letter abbreviation
type MentorCreditBalance = number;  // >= 0
```

### Aggregate Invariants
1. A Project always has exactly 4 Steps (number 1-4).
2. Step modules are predefined per step number and cannot be added/removed.
3. At least one TeamMember with role "Owner" must exist.
4. `currentStep` must reference a valid step (0-4).
5. `mentorCredits` cannot go below 0.
6. Step N+1 cannot have status other than "Bloqueado" or "No iniciado" unless Step N is "Aprobado".
7. Step 1 remains "No iniciado" until `step0Status` = "Completado".
8. Runs are only valid on Step 3.
9. `progress` is a derived value: `(completedModules / totalModules) * 100`.

---

## 2. User Aggregate

**Context:** Identity & Access
**Aggregate Root:** `User`

```typescript
interface User {
  // Identity
  id: UserId;

  // Profile
  name: string;
  email: Email;
  role: Role;                       // Value Object (owner|mentor|admin|leader)
  initials: Initials;
  skills: string[];

  // Cohort reference
  cohort?: CohortId;
}
```

### Value Objects

```typescript
type UserId = string;
type Role = 'owner' | 'mentor' | 'admin' | 'leader';
type CohortId = string;
```

### Aggregate Invariants
1. Email must be unique across all Users.
2. A User has exactly one Role.
3. Initials are derived from name (first letters of first and last name).

---

## 3. MentorSession Aggregate

**Context:** Mentoring
**Aggregate Root:** `MentorSession`

Note: FeedbackIA is a Value Object, not an entity, because it has no lifecycle -- it is generated once and stored as a snapshot. MentorSession has identity and a lifecycle (scheduling, conducting, completing).

```typescript
interface MentorSession {
  // Identity
  id: MentorSessionId;

  // References
  projectId: ProjectId;
  stepNumber: StepNumber;
  mentorId: UserId;                 // Reference to User aggregate

  // Attributes
  mentor: string;                   // Mentor display name
  date?: Timestamp;
  status: SessionStatus;            // Value Object
  result?: SessionResult;           // Value Object
  comments?: string;

  // Evaluation (filled during session)
  rubricScores?: RubricScores;      // Value Object
}
```

### Value Objects

```typescript
type MentorSessionId = string;

type SessionStatus = 'Pendiente agendar' | 'Agendada' | 'Realizada';

type SessionResult = 'Aprobado' | 'Iterar' | 'Bloqueado';

interface RubricScores {
  evidencia: RubricScore;           // 0-5
  consistencia: RubricScore;        // 0-5
  claridad: RubricScore;            // 0-5
  accionabilidad: RubricScore;      // 0-5
  riesgos: RubricScore;             // 0-5
}

type RubricScore = 0 | 1 | 2 | 3 | 4 | 5;

interface FeedbackIA {
  status: 'Aprobado' | 'Iterar' | 'Bloqueado';
  summary: string;
  goodPoints: string[];
  missing: string[];
  actions: string[];                // max 5
  questions: string[];              // max 5
  contradictions?: string[];
  timestamp: Timestamp;
}

interface HelpRequest {
  id: HelpRequestId;
  projectId: ProjectId;
  stepNumber: StepNumber;
  context: string;                  // e.g., "Paso 2 - Disenar solucion"
  message: string;
  requestedAt: Timestamp;
  respondedAt?: Timestamp;
  response?: string;
}

type HelpRequestId = string;
```

### Aggregate Invariants
1. A session can only transition: `Pendiente agendar` --> `Agendada` --> `Realizada`.
2. `result` can only be set when status = "Realizada".
3. `rubricScores` can only be set when status = "Realizada".
4. Total rubric score is out of 25 (5 categories x 5 max).
5. Scheduling a session requires the project to have >= 1 mentorCredit.

---

## 4. Evidence Aggregate

**Context:** Evidence Management
**Aggregate Root:** `Evidence`

```typescript
interface Evidence {
  // Identity
  id: EvidenceId;

  // Attributes
  name: string;
  type: EvidenceType;               // Value Object
  size?: FileSize;                  // Value Object
  url?: URL;                        // Value Object

  // References
  projectId: ProjectId;
  stepRef: StepNumber;
  moduleRef?: ModuleId;
  ownerId: UserId;

  // Status
  status: EvidenceStatus;           // Value Object
  date: DateString;                 // Value Object

  // Audit trail
  auditLog: AuditEntry[];          // Value Object collection
}
```

### Value Objects

```typescript
type EvidenceId = string;
type EvidenceType = 'Imagen' | 'PDF' | 'Video' | 'Link' | 'Otro';
type EvidenceStatus = 'Subida' | 'Verificada' | 'Rechazada';
type FileSize = string;             // e.g., "2.4 MB", "890 KB"
type DateString = string;           // YYYY-MM-DD

interface AuditEntry {
  action: string;                   // e.g., "Subida", "Verificada por mentor"
  user: string;                     // Actor display name
  timestamp: Timestamp;
}

// Validation rules (used at aggregate boundary)
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4'];
const MAX_FILE_SIZE_MB = 50;
```

### Aggregate Invariants
1. File extension must be in ALLOWED_EXTENSIONS.
2. File size must not exceed MAX_FILE_SIZE_MB.
3. Links must start with "http://" or "https://".
4. `stepRef` must be a valid step number (1-4).
5. `auditLog` is append-only (immutable trail).
6. Status transitions: `Subida` --> `Verificada` or `Subida` --> `Rechazada`.
7. Only active project team members can upload evidence.

---

## 5. Cohort Aggregate

**Context:** Cohort Administration
**Aggregate Root:** `Cohort`

```typescript
interface Cohort {
  // Identity
  id: CohortId;

  // Attributes
  name: string;                     // e.g., "Cohorte 2025-A"
  startDate?: DateString;
  endDate?: DateString;

  // References
  projectIds: ProjectId[];          // Projects in this cohort
  participantIds: UserId[];         // Users enrolled

  // Read models (derived/cached)
  metrics?: CohortMetrics;          // Value Object
}
```

### Value Objects

```typescript
interface CohortMetrics {
  activeProjects: number;
  highRiskCount: number;
  approvedSteps: number;
  pendingSessions: number;
}

interface StepFunnelEntry {
  step: string;                     // "Step 1", "Step 2", etc.
  total: number;
  completed: number;
  label: string;                    // "Claridad", "Diseno", etc.
}

interface ProjectOverview {
  id: ProjectId;
  name: string;
  team: string;
  step: StepNumber;
  status: string;
  risk: RiskLevel;
  lastActivity: string;
  blocked: boolean;
}
```

### Aggregate Invariants
1. A Cohort can contain zero or more Projects.
2. A Project belongs to at most one Cohort.
3. CohortMetrics are derived and eventually consistent.

---

## Aggregate Relationship Diagram

```
                    +------------------+
                    |      User        |  (Identity & Access)
                    |  Aggregate Root  |
                    +--------+---------+
                             |
                    referenced by
                             |
          +------------------+-------------------+
          |                  |                   |
+---------v--------+ +------v---------+ +-------v--------+
|     Project      | | MentorSession  | |    Evidence     |
| Aggregate Root   | | Aggregate Root | | Aggregate Root  |
|                  | |                | |                 |
| +- Step (E)      | | rubricScores   | | auditLog (VO)  |
| |  +- Module (E) | | (VO)           | |                 |
| |  +- Run (E)    | |                | +--------+--------+
| |     +- Metric  | +-------+--------+          |
| |     +- LC (VO) |         |           referenced by
| +- TeamMember(E) |         |                    |
| +- Step0Data(VO) | references             +----v--------+
+--------+---------+         |              |   Cohort    |
         |                   |              | Aggregate   |
         +-------------------+              |   Root      |
              referenced by                 +-------------+

Legend: (E) = Entity, (VO) = Value Object, LC = LearningCard
```

---

## Design Decisions

### Why Project is a single large aggregate

The Project aggregate is intentionally large because Steps, Modules, and Runs cannot exist independently and their invariants (sequential unlocking, progress calculation) require transactional consistency with the Project root. In a CQRS/Event Sourcing implementation, this aggregate would be the primary event source.

### Why FeedbackIA is a Value Object

FeedbackIA is generated once by the AI system and stored as an immutable snapshot on the Step. It has no independent lifecycle or identity beyond its timestamp. Treating it as a value object simplifies the model and avoids unnecessary entity management.

### Why MentorSession is a separate aggregate

Although MentorSession references a Project and Step, it has its own lifecycle (scheduling, conducting, completing) that is managed by the Mentoring context. It crosses context boundaries and is managed by mentors, not project owners. Keeping it as a separate aggregate prevents the Project aggregate from growing even larger and respects context boundaries.

### Why Evidence is a separate aggregate

Evidence has its own audit trail, verification lifecycle, and access control rules. It references projects but can be managed independently (upload, verify, reject, delete). Keeping it separate supports the Evidence Management context's autonomy.
