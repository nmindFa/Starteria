# Domain Events -- Dashboard Starteria

## Overview

Domain events represent significant occurrences within the system. They are the primary mechanism for cross-context communication and form the foundation for event sourcing. Each event is immutable and captures the state change that occurred.

### Event Envelope

All domain events share a common envelope:

```typescript
interface DomainEvent {
  eventId: string;          // Unique event identifier (UUID)
  eventType: string;        // Discriminator (e.g., "ProjectCreated")
  aggregateId: string;      // ID of the aggregate that raised the event
  aggregateType: string;    // "Project" | "User" | "MentorSession" | "Evidence" | "Cohort"
  occurredAt: string;       // ISO 8601 timestamp
  version: number;          // Aggregate version (for optimistic concurrency)
  metadata: {
    userId: string;         // Actor who triggered the event
    correlationId: string;  // Trace correlation
    causationId?: string;   // ID of the command/event that caused this
  };
  payload: Record<string, unknown>;
}
```

---

## Identity & Access Context Events

### UserRegistered
Raised when a new user account is created.
```typescript
{
  eventType: "UserRegistered";
  payload: {
    userId: string;
    name: string;
    email: string;
    role: "owner" | "mentor" | "admin" | "leader";
    cohort?: string;
  }
}
```

### UserLoggedIn
Raised when a user successfully authenticates.
```typescript
{
  eventType: "UserLoggedIn";
  payload: {
    userId: string;
    email: string;
    role: string;
    loginAt: string;
  }
}
```

### UserLoggedOut
Raised when a user ends their session.
```typescript
{
  eventType: "UserLoggedOut";
  payload: {
    userId: string;
    logoutAt: string;
  }
}
```

### UserRoleChanged
Raised when a user's role is updated.
```typescript
{
  eventType: "UserRoleChanged";
  payload: {
    userId: string;
    previousRole: string;
    newRole: string;
  }
}
```

### UserProfileUpdated
Raised when user profile details change (name, skills, etc.).
```typescript
{
  eventType: "UserProfileUpdated";
  payload: {
    userId: string;
    changes: Record<string, { from: unknown; to: unknown }>;
  }
}
```

---

## Project Management Context Events

### ProjectCreated
Raised when a new project is created with default structure.
```typescript
{
  eventType: "ProjectCreated";
  payload: {
    projectId: string;
    name: string;
    description?: string;
    ownerId: string;
    ownerName: string;
    cohort?: string;
    mentorCredits: number;       // default: 3
    stepsCreated: number;        // always 4
  }
}
```
**Listeners:** Cohort Administration (add project to cohort metrics)

### ProjectStatusChanged
Raised when the overall project status transitions.
```typescript
{
  eventType: "ProjectStatusChanged";
  payload: {
    projectId: string;
    previousStatus: string;
    newStatus: string;
  }
}
```
**Listeners:** Cohort Administration (update dashboard KPIs)

### Step0Started
Raised when a participant begins filling the intake questionnaire.
```typescript
{
  eventType: "Step0Started";
  payload: {
    projectId: string;
    participantId: string;
  }
}
```

### Step0Updated
Raised when Step 0 data is saved (autosave or manual).
```typescript
{
  eventType: "Step0Updated";
  payload: {
    projectId: string;
    fieldsUpdated: string[];     // which fields changed
    completionPercentage: number;
  }
}
```

### Step0Completed
Raised when all required Step 0 fields are filled and status becomes "Completado".
```typescript
{
  eventType: "Step0Completed";
  payload: {
    projectId: string;
    step0Data: {
      origen: string;
      impacta: string[];
      parteProceso: string;
      impacto3meses: string;
      respaldo: string;
    }
  }
}
```
**Side effect:** Unlocks Step 1 (Step 1 status changes from "No iniciado" to available)

### StepStarted
Raised when a participant begins working on a step (first module interaction).
```typescript
{
  eventType: "StepStarted";
  payload: {
    projectId: string;
    stepNumber: number;
    stepName: string;
  }
}
```

### StepStatusChanged
Raised when a step's status transitions.
```typescript
{
  eventType: "StepStatusChanged";
  payload: {
    projectId: string;
    stepNumber: number;
    previousStatus: string;
    newStatus: string;
  }
}
```

### StepSubmitted
Raised when a step is submitted for AI review.
```typescript
{
  eventType: "StepSubmitted";
  payload: {
    projectId: string;
    stepNumber: number;
    submittedBy: string;
    moduleCount: number;
    completedModules: number;
  }
}
```
**Listeners:** Mentoring context (triggers AI review)

### StepApproved
Raised when a mentor approves a step after validation session.
```typescript
{
  eventType: "StepApproved";
  payload: {
    projectId: string;
    stepNumber: number;
    mentorId: string;
    mentorName: string;
    rubricTotal: number;           // out of 25
    nextStepUnlocked: number;      // stepNumber + 1
  }
}
```
**Side effect:** Next step status changes from "Bloqueado" to "No iniciado"
**Listeners:** Cohort Administration (update funnel, approved steps count)

### StepBlocked
Raised when a mentor blocks a step.
```typescript
{
  eventType: "StepBlocked";
  payload: {
    projectId: string;
    stepNumber: number;
    mentorId: string;
    reason: string;
  }
}
```

### StepIterationRequested
Raised when a mentor sends a step back for revision.
```typescript
{
  eventType: "StepIterationRequested";
  payload: {
    projectId: string;
    stepNumber: number;
    mentorId: string;
    comments: string;
  }
}
```

### ModuleStatusChanged
Raised when a module's status transitions.
```typescript
{
  eventType: "ModuleStatusChanged";
  payload: {
    projectId: string;
    stepNumber: number;
    moduleId: string;
    moduleName: string;
    previousStatus: string;
    newStatus: string;
  }
}
```
**Side effect:** Recalculates step progress percentage

### ModuleCompleted
Raised specifically when a module reaches "Completado" or "Aprobado".
```typescript
{
  eventType: "ModuleCompleted";
  payload: {
    projectId: string;
    stepNumber: number;
    moduleId: string;
    moduleName: string;
  }
}
```
**Side effect:** Unlocks next sequential module in the step

### ProgressRecalculated
Raised when step or project progress percentages are updated.
```typescript
{
  eventType: "ProgressRecalculated";
  payload: {
    projectId: string;
    stepNumber?: number;
    previousProgress: number;
    newProgress: number;
    completedModules: number;
    totalModules: number;
  }
}
```

### RunCreated
Raised when a new experiment run is created in Step 3.
```typescript
{
  eventType: "RunCreated";
  payload: {
    projectId: string;
    runId: string;
    runName: string;
  }
}
```

### RunStatusChanged
Raised when a run transitions status.
```typescript
{
  eventType: "RunStatusChanged";
  payload: {
    projectId: string;
    runId: string;
    previousStatus: string;
    newStatus: string;
  }
}
```

### RunClosed
Raised when a run is completed with metrics and learning card.
```typescript
{
  eventType: "RunClosed";
  payload: {
    projectId: string;
    runId: string;
    metricsCount: number;
    metricsPassed: number;
    learningDecision: "Iterar" | "Pivot" | "Kill" | null;
  }
}
```

### TeamMemberAdded
Raised when a new member is invited to a project team.
```typescript
{
  eventType: "TeamMemberAdded";
  payload: {
    projectId: string;
    memberId: string;
    memberName: string;
    memberEmail: string;
    role: "Owner" | "Editor" | "Viewer";
    status: "Activo" | "Pendiente";
    invitedBy: string;
  }
}
```
**Listeners:** Evidence Management (grant access to evidence)

### TeamMemberRemoved
Raised when a member is removed from a project team.
```typescript
{
  eventType: "TeamMemberRemoved";
  payload: {
    projectId: string;
    memberId: string;
    memberEmail: string;
    removedBy: string;
  }
}
```
**Listeners:** Evidence Management (revoke access to evidence)

### TeamMemberRoleChanged
Raised when a team member's project role changes.
```typescript
{
  eventType: "TeamMemberRoleChanged";
  payload: {
    projectId: string;
    memberId: string;
    previousRole: string;
    newRole: string;
  }
}
```

### ProjectRiskLevelChanged
Raised when project risk assessment changes.
```typescript
{
  eventType: "ProjectRiskLevelChanged";
  payload: {
    projectId: string;
    previousRisk: string;
    newRisk: string;
  }
}
```
**Listeners:** Cohort Administration (update risk monitoring)

---

## Mentoring Context Events

### AIReviewRequested
Raised when a step is submitted for AI analysis.
```typescript
{
  eventType: "AIReviewRequested";
  payload: {
    projectId: string;
    stepNumber: number;
    requestedBy: string;
  }
}
```

### AIReviewCompleted
Raised when the AI produces a FeedbackIA.
```typescript
{
  eventType: "AIReviewCompleted";
  payload: {
    projectId: string;
    stepNumber: number;
    result: "Aprobado" | "Iterar" | "Bloqueado";
    goodPointsCount: number;
    missingCount: number;
    actionsCount: number;
    questionsCount: number;
    hasContradictions: boolean;
  }
}
```
**Listeners:** Project Management (update step feedbackIA snapshot)

### MentorHelpRequested
Raised when a participant sends an async help request (no credit consumed).
```typescript
{
  eventType: "MentorHelpRequested";
  payload: {
    projectId: string;
    stepNumber: number;
    context: string;
    message: string;
    requestedBy: string;
  }
}
```

### MentorSessionScheduled
Raised when a validation session is requested (consumes 1 credit).
```typescript
{
  eventType: "MentorSessionScheduled";
  payload: {
    sessionId: string;
    projectId: string;
    stepNumber: number;
    requestedBy: string;
    validationTopic: string;
    creditsRemaining: number;
  }
}
```
**Side effect:** Decrements mentorCredits by 1
**Listeners:** Project Management (update step status to "Sesion experto pendiente")

### MentorSessionConfirmed
Raised when a mentor confirms date/time for the session.
```typescript
{
  eventType: "MentorSessionConfirmed";
  payload: {
    sessionId: string;
    mentorId: string;
    mentorName: string;
    scheduledDate: string;
  }
}
```

### MentorSessionCompleted
Raised when a mentor finishes the validation session and records their decision.
```typescript
{
  eventType: "MentorSessionCompleted";
  payload: {
    sessionId: string;
    projectId: string;
    stepNumber: number;
    mentorId: string;
    result: "Aprobado" | "Iterar" | "Bloqueado";
    rubricScores: {
      evidencia: number;
      consistencia: number;
      claridad: number;
      accionabilidad: number;
      riesgos: number;
    };
    totalScore: number;
    comments: string;
  }
}
```
**Listeners:** Project Management (triggers StepApproved, StepBlocked, or StepIterationRequested)

### MentorCreditConsumed
Raised when a mentor credit is used.
```typescript
{
  eventType: "MentorCreditConsumed";
  payload: {
    projectId: string;
    creditsBefore: number;
    creditsAfter: number;
    consumedFor: "validation_session";
  }
}
```

---

## Evidence Management Context Events

### EvidenceUploaded
Raised when a file is uploaded or a link is registered.
```typescript
{
  eventType: "EvidenceUploaded";
  payload: {
    evidenceId: string;
    projectId: string;
    name: string;
    type: "Imagen" | "PDF" | "Video" | "Link" | "Otro";
    size?: string;
    stepRef: number;
    moduleRef?: string;
    uploadedBy: string;
  }
}
```

### EvidenceVerified
Raised when a mentor verifies (approves) an evidence artifact.
```typescript
{
  eventType: "EvidenceVerified";
  payload: {
    evidenceId: string;
    projectId: string;
    verifiedBy: string;
  }
}
```

### EvidenceRejected
Raised when a mentor rejects an evidence artifact.
```typescript
{
  eventType: "EvidenceRejected";
  payload: {
    evidenceId: string;
    projectId: string;
    rejectedBy: string;
    reason?: string;
  }
}
```

### EvidenceDeleted
Raised when evidence is removed (policy TBD: archive vs. permanent).
```typescript
{
  eventType: "EvidenceDeleted";
  payload: {
    evidenceId: string;
    projectId: string;
    deletedBy: string;
    deletionType: "archive" | "permanent";
  }
}
```

---

## Cohort Administration Context Events

### CohortCreated
Raised when a new cohort is set up.
```typescript
{
  eventType: "CohortCreated";
  payload: {
    cohortId: string;
    name: string;
    startDate?: string;
    endDate?: string;
  }
}
```

### ProjectAssignedToCohort
Raised when a project is added to a cohort.
```typescript
{
  eventType: "ProjectAssignedToCohort";
  payload: {
    cohortId: string;
    projectId: string;
  }
}
```

### CohortMetricsUpdated
Raised when cohort KPIs are recalculated.
```typescript
{
  eventType: "CohortMetricsUpdated";
  payload: {
    cohortId: string;
    activeProjects: number;
    highRiskCount: number;
    approvedSteps: number;
    pendingSessions: number;
  }
}
```

### CohortDataExported
Raised when an admin exports cohort data.
```typescript
{
  eventType: "CohortDataExported";
  payload: {
    cohortId: string;
    exportedBy: string;
    format: "csv";
    projectCount: number;
  }
}
```

---

## Event Flow Diagrams

### Happy Path: Step Completion Flow

```
Owner fills modules
    |
    v
ModuleStatusChanged (x N)
    |
    v
ModuleCompleted (unlocks next module)
    |
    v
ProgressRecalculated
    |
    v
StepSubmitted (all modules completed)
    |
    v
AIReviewRequested
    |
    v
AIReviewCompleted (status: Aprobado)
    |
    v
MentorSessionScheduled (consumes 1 credit)
    |
    v
MentorCreditConsumed
    |
    v
MentorSessionConfirmed
    |
    v
MentorSessionCompleted (result: Aprobado)
    |
    v
StepApproved (unlocks Step N+1)
    |
    v
ProjectStatusChanged
    |
    v
CohortMetricsUpdated
```

### Iteration Path: AI Requests Changes

```
StepSubmitted
    |
    v
AIReviewRequested
    |
    v
AIReviewCompleted (status: Iterar)
    |
    v
StepStatusChanged (status: "Feedback IA")
    |
    v
Owner makes corrections
    |
    v
ModuleStatusChanged (x N)
    |
    v
StepStatusChanged (status: "Ajustado")
    |
    v
StepSubmitted (resubmit)
    |
    v
AIReviewRequested (second pass)
    ...
```

---

## Event Catalog Summary

| # | Event | Context | Triggers |
|---|-------|---------|----------|
| 1 | UserRegistered | Identity | Account creation |
| 2 | UserLoggedIn | Identity | Authentication |
| 3 | UserLoggedOut | Identity | Session end |
| 4 | UserRoleChanged | Identity | Admin action |
| 5 | UserProfileUpdated | Identity | Profile edit |
| 6 | ProjectCreated | Project Mgmt | New project |
| 7 | ProjectStatusChanged | Project Mgmt | Status transition |
| 8 | Step0Started | Project Mgmt | Intake begin |
| 9 | Step0Updated | Project Mgmt | Autosave |
| 10 | Step0Completed | Project Mgmt | Intake finish |
| 11 | StepStarted | Project Mgmt | First interaction |
| 12 | StepStatusChanged | Project Mgmt | Any step transition |
| 13 | StepSubmitted | Project Mgmt | Submit for review |
| 14 | StepApproved | Project Mgmt | Mentor approval |
| 15 | StepBlocked | Project Mgmt | Mentor blocks |
| 16 | StepIterationRequested | Project Mgmt | Mentor requests changes |
| 17 | ModuleStatusChanged | Project Mgmt | Module transition |
| 18 | ModuleCompleted | Project Mgmt | Module done |
| 19 | ProgressRecalculated | Project Mgmt | Derived update |
| 20 | RunCreated | Project Mgmt | New experiment |
| 21 | RunStatusChanged | Project Mgmt | Run transition |
| 22 | RunClosed | Project Mgmt | Experiment complete |
| 23 | TeamMemberAdded | Project Mgmt | Invite |
| 24 | TeamMemberRemoved | Project Mgmt | Removal |
| 25 | TeamMemberRoleChanged | Project Mgmt | Role change |
| 26 | ProjectRiskLevelChanged | Project Mgmt | Risk update |
| 27 | AIReviewRequested | Mentoring | Submit for AI |
| 28 | AIReviewCompleted | Mentoring | AI produces feedback |
| 29 | MentorHelpRequested | Mentoring | Async question |
| 30 | MentorSessionScheduled | Mentoring | Session request |
| 31 | MentorSessionConfirmed | Mentoring | Mentor confirms |
| 32 | MentorSessionCompleted | Mentoring | Session done |
| 33 | MentorCreditConsumed | Mentoring | Credit used |
| 34 | EvidenceUploaded | Evidence | File/link added |
| 35 | EvidenceVerified | Evidence | Mentor verifies |
| 36 | EvidenceRejected | Evidence | Mentor rejects |
| 37 | EvidenceDeleted | Evidence | Removal |
| 38 | CohortCreated | Cohort Admin | New cohort |
| 39 | ProjectAssignedToCohort | Cohort Admin | Assignment |
| 40 | CohortMetricsUpdated | Cohort Admin | KPI recalc |
| 41 | CohortDataExported | Cohort Admin | CSV export |
