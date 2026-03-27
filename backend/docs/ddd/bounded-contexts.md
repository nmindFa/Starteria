# Bounded Contexts -- Dashboard Starteria

## Overview

Dashboard Starteria is an Innovation/Entrepreneurship Project Management Platform that guides participants through a structured 4-step methodology with AI-assisted reviews and expert mentor validation sessions. The domain is decomposed into five bounded contexts aligned with distinct areas of responsibility.

---

## 1. Identity & Access Context

**Type:** Generic Subdomain
**Responsibility:** User identity, authentication, authorization, role assignment, and session management.

### Core Concepts
- **User**: Authenticated identity with profile (name, email, initials, skills).
- **Role**: One of `owner`, `mentor`, `admin`, `leader` -- determines what the user can see and do.
- **Session**: Authenticated session state (login/logout lifecycle).
- **Permission**: Derived from Role; controls access to projects, steps, evidence, and admin panels.

### Invariants
- A User has exactly one active Role at a time.
- Only authenticated Users can access the platform beyond the auth page.
- Role determines dashboard view: `owner` sees "Mis proyectos", `mentor` sees "Proyectos a revisar", `admin` sees "Todos los proyectos", `leader` sees "Proyectos asignados".

### Boundaries
- This context owns the `User` entity for identity purposes only.
- Skills, cohort assignment, and profile details are owned here but consumed by other contexts.
- Does NOT own project-level team membership (that belongs to Project Management).

### Key Operations
| Operation | Actor | Description |
|-----------|-------|-------------|
| `Login` | Any | Authenticate with email + password |
| `Logout` | Any | End session |
| `SetRole` | Admin | Change a user's role |
| `ViewProfile` | Any | View/edit own profile |

---

## 2. Project Management Context

**Type:** Core Domain
**Responsibility:** Full lifecycle of innovation projects: creation, step progression, module completion, runs (experiments), and team collaboration.

### Core Concepts
- **Project**: The central aggregate. Has a name, description, status, current step, team, and structured progression through Steps 0-4.
- **Step 0 (Punto de partida)**: Initial intake questionnaire capturing context, origin, impact, and minimum viability conditions. Gating mechanism for Step 1.
- **Step (1-4)**: A phase in the methodology, each containing ordered Modules.
- **Module**: A unit of work within a Step (e.g., "Proceso actual", "Medicion e impacto").
- **Run**: An experiment execution within Step 3, with metrics and a learning card.
- **LearningCard**: Structured reflection from a Run (what happened, what was learned, decision: Iterar/Pivot/Kill).
- **TeamMember**: A user's membership on a project with role (Owner/Editor/Viewer) and status (Activo/Pendiente).
- **RiskLevel**: Project risk assessment (Bajo/Medio/Alto).

### Status Machines

**Project Status:**
```
Draft --> En progreso --> En revision IA --> Iteracion --> Sesion experto pendiente --> Paso aprobado --> Finalizado
```

**Step Status:**
```
No iniciado --> En progreso --> Enviado --> Feedback IA --> Ajustado --> Sesion experto pendiente --> Aprobado
                                                                    \--> Bloqueado
```

**Module Status:**
```
Draft --> En progreso --> Completado --> Enviado --> Feedback IA --> Ajustado --> Aprobado
                                                                            \--> Bloqueado
```

**Run Status:**
```
Draft --> En ejecucion --> Cerrado
                      \--> Revisar cambios
```

### Invariants
- Step 1 is blocked until Step 0 status = "Completado".
- Step N+1 is blocked until Step N status = "Aprobado" (requires mentor session).
- Modules within a Step follow sequential unlocking (Module B blocked until Module A completed).
- A Project must have at least one TeamMember with role "Owner".
- New projects start with `status: Draft`, `currentStep: 1`, `step0Status: No iniciado`, `mentorCredits: 3`.

### Key Operations
| Operation | Actor | Description |
|-----------|-------|-------------|
| `CreateProject` | Owner | Create new project with default structure |
| `UpdateStep0` | Owner | Fill/update the intake questionnaire |
| `CompleteModule` | Owner, Editor | Mark a module as completed |
| `SubmitStep` | Owner | Submit step for AI review |
| `IterateStep` | Owner | Revise step after feedback |
| `CreateRun` | Owner, Editor | Start new experiment run (Step 3) |
| `CloseRun` | Owner, Editor | Record metrics and learning card |
| `InviteTeamMember` | Owner | Add member to project team |
| `RemoveTeamMember` | Owner | Remove member from project team |
| `UpdateProgress` | System | Recalculate step/project progress |

---

## 3. Mentoring Context

**Type:** Core Subdomain
**Responsibility:** AI-powered feedback, expert mentor sessions, mentor credits, rubric-based evaluation, and step approval/rejection flow.

### Core Concepts
- **FeedbackIA**: Structured AI review of a step with status (Aprobado/Iterar/Bloqueado), good points, missing items, concrete actions (max 5), reflective questions (max 5), and detected contradictions.
- **MentorSession**: A scheduled or completed validation session between a mentor and a project team. Has states: `Pendiente agendar`, `Agendada`, `Realizada`.
- **MentorCredit**: A consumable resource that participants spend to schedule validation sessions. Each session costs 1 credit.
- **Rubric**: 5-dimension evaluation framework used by mentors (Evidencia, Consistencia, Claridad, Accionabilidad, Riesgos), each scored 1-5.
- **MentorDecision**: The outcome of a mentor review session: Aprobado (unlock next step), Iterar (revise and resubmit), or Bloqueado (does not meet minimum).
- **HelpRequest**: Asynchronous question from participant to mentor (does NOT consume credits).

### Invariants
- A step cannot be Aprobado without a completed MentorSession with result = "Aprobado".
- Scheduling a session consumes exactly 1 MentorCredit.
- A HelpRequest does not consume credits.
- AI review must precede mentor session (AI provides context for mentor).
- Mentor rubric total score is out of 25 (5 dimensions x 5 max each).

### Key Operations
| Operation | Actor | Description |
|-----------|-------|-------------|
| `RequestAIReview` | Owner | Submit step content for AI analysis |
| `GenerateAIFeedback` | System (AI) | Produce structured FeedbackIA |
| `RequestMentorHelp` | Owner | Send async question (no credit) |
| `ScheduleSession` | Owner | Request validation session (1 credit) |
| `ConfirmSession` | Mentor | Confirm date/time for session |
| `ConductSession` | Mentor | Evaluate using rubric, make decision |
| `ApproveStep` | Mentor | Approve step, unlock next |
| `RequestIteration` | Mentor | Send back for revision |
| `BlockStep` | Mentor | Block progress, require corrections |

---

## 4. Evidence Management Context

**Type:** Supporting Subdomain
**Responsibility:** Upload, storage, verification, and audit trail of project artifacts (evidence).

### Core Concepts
- **Evidence**: A file or link associated with a specific Step and optionally a Module. Types: Imagen, PDF, Video, Link, Otro.
- **EvidenceStatus**: Lifecycle state: `Subida` (uploaded, pending review), `Verificada` (confirmed by mentor), `Rechazada` (rejected by mentor).
- **AuditLog**: Immutable trail of actions on evidence (upload, verification, rejection) with actor and timestamp.
- **FileValidation**: Rules for allowed types (JPG, PNG, GIF, WEBP, PDF, MP4) and max file size (50 MB default).

### Invariants
- Only active TeamMembers can upload evidence to a project.
- Evidence must reference a valid Step (stepRef).
- File type must be in the allowed list (jpg, jpeg, png, gif, webp, pdf, mp4).
- File size must not exceed 50 MB.
- Links must start with http:// or https://.
- When a team member is removed from a project, they lose access to all evidence.
- Evidence deletion policy is TBD (archive vs. permanent delete, who can delete).

### Key Operations
| Operation | Actor | Description |
|-----------|-------|-------------|
| `UploadEvidence` | Owner, Editor | Upload file or register link |
| `VerifyEvidence` | Mentor | Mark evidence as verified |
| `RejectEvidence` | Mentor | Mark evidence as rejected |
| `FilterEvidence` | Any member | Filter by step or status |
| `ViewAuditLog` | Any member | View change history for evidence |
| `DownloadEvidence` | Active member | Download file artifact |

---

## 5. Cohort Administration Context

**Type:** Supporting Subdomain
**Responsibility:** Cohort management, cross-project oversight, analytics, risk monitoring, and administrative reporting.

### Core Concepts
- **Cohort**: A named batch of participants/projects (e.g., "Cohorte 2025-A"). Groups projects for administrative purposes.
- **CohortDashboard**: Aggregated view with KPIs: active projects, high-risk count, approved steps, pending sessions.
- **StepFunnel**: Analytics showing how many projects pass through each step (conversion funnel).
- **RiskMonitoring**: Identification and tracking of projects with elevated risk levels.
- **ProjectOverview**: Read model combining project name, team, current step, status, risk, and last activity for admin table view.

### Invariants
- Only `admin` role users can access the cohort panel.
- `leader` role users can view assigned projects (read-only oversight).
- Risk level is computed/assigned per project and surfaced in cohort view.
- Export (CSV) includes all projects in the current cohort.

### Key Operations
| Operation | Actor | Description |
|-----------|-------|-------------|
| `ViewCohortDashboard` | Admin | See KPIs and funnel |
| `FilterProjects` | Admin | Filter by risk, blocked status |
| `ExportCSV` | Admin | Export cohort data |
| `ViewStepFunnel` | Admin | See conversion through steps |
| `AssignCohort` | Admin | Assign project/user to cohort |
| `MonitorRisk` | Admin, Leader | View high-risk projects |

---

## Context Ownership Summary

| Entity / Concept | Owning Context | Consumers |
|-------------------|---------------|-----------|
| User (identity) | Identity & Access | All |
| Role, Permission | Identity & Access | All |
| Project | Project Management | Mentoring, Evidence, Cohort |
| Step, Module | Project Management | Mentoring |
| Step0Data | Project Management | -- |
| TeamMember | Project Management | Evidence |
| Run, LearningCard | Project Management | -- |
| FeedbackIA | Mentoring | Project Management |
| MentorSession | Mentoring | Project Management |
| MentorCredit | Mentoring | Project Management |
| Rubric | Mentoring | -- |
| Evidence | Evidence Management | Project Management |
| AuditLog | Evidence Management | -- |
| Cohort | Cohort Administration | Identity & Access, Project Mgmt |
| StepFunnel, KPIs | Cohort Administration | -- |
