# Context Map -- Dashboard Starteria

## Overview

This document describes the relationships between bounded contexts, their integration patterns, and data flow directions. The context map follows DDD strategic patterns to define how contexts collaborate, which context is upstream/downstream, and what anti-corruption mechanisms are needed.

---

## Context Map Diagram

```
                         +-----------------------+
                         |   Identity & Access   |
                         |     (Generic)         |
                         |                       |
                         |  User, Role, Session  |
                         +-----------+-----------+
                                     |
                           [Published Language]
                           (User identity shared
                            via UserRef/UserId)
                                     |
              +----------------------+----------------------+
              |                      |                      |
              v                      v                      v
+-------------+--------+  +---------+---------+  +---------+---------+
| Project Management   |  |    Mentoring       |  | Cohort Admin      |
|     (Core)           |  |  (Core Subdomain)  |  | (Supporting)      |
|                      |  |                    |  |                   |
| Project, Step,       |  | FeedbackIA,        |  | Cohort, Funnel,   |
| Module, Run,         |  | MentorSession,     |  | KPIs, Risk        |
| TeamMember, Step0    |  | MentorCredit,      |  | Monitoring        |
|                      |  | Rubric, HelpReq    |  |                   |
+---+--+----------+---+  +---+-------+--------+  +---------+---------+
    |  |          |           |       |                     |
    |  |          |           |       |                     |
    |  |    [Customer-        |       |             [Conformist]
    |  |     Supplier]        |       |             (Cohort reads
    |  |   (Project defines   |       |              Project state)
    |  |    what mentoring    |       |
    |  |    needs)            |       |
    |  |          |           |       |
    |  |          +-----+-----+       |
    |  |                |             |
    |  |          [Domain Events]     |
    |  |          (StepSubmitted -->  |
    |  |           AIReviewReq -->   |
    |  |           SessionCompleted  |
    |  |           --> StepApproved) |
    |  |                             |
    |  +----------+------------------+
    |             |
    |       [Anti-Corruption Layer]
    |       (Evidence context shields
    |        from Project internals)
    |             |
    |             v
    |  +----------+-----------+
    |  | Evidence Management  |
    |  |   (Supporting)       |
    |  |                      |
    |  | Evidence, AuditLog,  |
    |  | FileValidation       |
    |  +----------------------+
    |
    +-- [Shared Kernel] (ProjectId, StepNumber, UserId used across contexts)
```

---

## Context Relationships

### 1. Identity & Access --> All Contexts
**Pattern:** Published Language (Open Host Service)
**Direction:** Identity & Access is UPSTREAM; all others are DOWNSTREAM.

Identity & Access provides the canonical User identity (UserId, Role) consumed by every other context. It exposes a stable interface that other contexts conform to.

| Shared Concept | Type | Description |
|---------------|------|-------------|
| UserId | Value Object | Unique user identifier |
| Role | Value Object | User's system role (owner/mentor/admin/leader) |
| UserRef | Reference | Lightweight reference (id, name, email, initials) |

**Integration:** Other contexts reference users by UserId. They may cache a UserRef (name, email, initials) for display but do not own user identity. If a user is renamed, an event propagates the change.

---

### 2. Project Management <--> Mentoring
**Pattern:** Customer-Supplier + Domain Events
**Direction:** Bidirectional with Project Management as the CUSTOMER and Mentoring as the SUPPLIER of review/approval services.

This is the most critical relationship in the system. Project Management triggers mentoring workflows, and Mentoring results flow back to update project state.

**Upstream flow (Project --> Mentoring):**
- `StepSubmitted` event triggers `AIReviewRequested`
- `MentorSessionScheduled` consumes `MentorCredit`
- `MentorHelpRequested` sends async question

**Downstream flow (Mentoring --> Project):**
- `AIReviewCompleted` updates step's `feedbackIA` snapshot
- `MentorSessionCompleted` triggers `StepApproved`, `StepBlocked`, or `StepIterationRequested`
- `MentorCreditConsumed` decrements project's `mentorCredits`

**Anti-corruption:** The Project aggregate stores FeedbackIA and MentorSession as Value Object snapshots, not live references. This prevents the Project aggregate from depending on Mentoring's internal lifecycle.

```
Project Management                    Mentoring
+-------------------+                +-------------------+
| StepSubmitted     |----Event------>| AIReviewRequested  |
|                   |                | (processes review) |
|                   |<---Event------| AIReviewCompleted   |
| (stores snapshot) |                |                    |
|                   |                |                    |
| SessionScheduled  |----Event------>| MentorSession      |
|                   |                | (lifecycle mgmt)   |
|                   |<---Event------| SessionCompleted    |
| StepApproved      |                |                    |
+-------------------+                +-------------------+
```

---

### 3. Project Management --> Evidence Management
**Pattern:** Anti-Corruption Layer
**Direction:** Project Management is UPSTREAM; Evidence Management is DOWNSTREAM.

Evidence Management references projects by ProjectId and steps by StepNumber but does not directly couple to the Project aggregate's internals. It maintains its own audit trail and verification lifecycle independently.

| Shared Concept | Direction | Description |
|---------------|-----------|-------------|
| ProjectId | PM --> Evidence | Evidence belongs to a project |
| StepNumber | PM --> Evidence | Evidence references a step |
| ModuleId | PM --> Evidence | Evidence optionally references a module |
| TeamMemberId | PM --> Evidence | Access control based on membership |

**Integration events:**
- `TeamMemberAdded` --> Evidence grants access
- `TeamMemberRemoved` --> Evidence revokes access
- `EvidenceUploaded` --> Project may reference evidence count

**ACL Behavior:** Evidence Management validates that a user is an active team member before allowing upload/download, but it queries this through a stable interface, not by reaching into the Project aggregate's team collection.

---

### 4. Project Management --> Cohort Administration
**Pattern:** Conformist
**Direction:** Project Management is UPSTREAM; Cohort Administration is DOWNSTREAM.

Cohort Administration conforms to the data model of Project Management. It reads project state (status, step, risk, team) to build dashboards and analytics. It does not modify project state.

| Consumed Data | Purpose |
|--------------|---------|
| Project status | Dashboard KPIs |
| Step statuses | Funnel analytics |
| Risk level | Risk monitoring |
| Team composition | Team size metrics |
| Last activity | Activity tracking |

**Integration events:**
- `ProjectCreated` --> Add to cohort
- `ProjectStatusChanged` --> Update KPIs
- `StepApproved` --> Update funnel
- `ProjectRiskLevelChanged` --> Update risk monitoring

**Note:** Cohort Administration is a read-heavy context. It primarily consumes events and builds read models (projections). It produces no events that other contexts depend on (except `CohortDataExported` for audit).

---

### 5. Identity & Access --> Cohort Administration
**Pattern:** Published Language
**Direction:** Identity & Access is UPSTREAM.

Cohort Administration uses user identity to determine which admin/leader can see which cohort. Cohort assignment (`user.cohort`) is owned by Identity & Access but consumed by both Project Management and Cohort Administration.

---

### 6. Mentoring --> Cohort Administration
**Pattern:** Published Language (indirect via events)
**Direction:** Mentoring is UPSTREAM; Cohort is DOWNSTREAM.

Cohort Administration consumes mentoring events to track pending sessions and mentor activity metrics.

| Consumed Event | Purpose |
|---------------|---------|
| `MentorSessionScheduled` | Pending sessions count |
| `MentorSessionCompleted` | Sessions this month count |

---

## Shared Kernel

A minimal set of value objects is shared across all contexts to enable cross-context references:

```typescript
// Shared Kernel -- used by all contexts
type ProjectId = string;
type UserId = string;
type StepNumber = 0 | 1 | 2 | 3 | 4;
type ModuleId = string;
type Timestamp = string;        // ISO 8601
```

**Rules for the Shared Kernel:**
1. Changes to shared types require agreement from all context owners.
2. Shared types are value objects only (no entities, no business logic).
3. Each context may extend these locally but must not break the contract.

---

## Integration Patterns Summary

| From | To | Pattern | Mechanism |
|------|----|---------|-----------|
| Identity & Access | All | Published Language | UserRef, Role via API |
| Project Management | Mentoring | Customer-Supplier | Domain Events |
| Mentoring | Project Management | Domain Events | AI/Session result events |
| Project Management | Evidence | Anti-Corruption Layer | ProjectId reference + ACL |
| Project Management | Cohort Admin | Conformist | Domain Events, Read Models |
| Mentoring | Cohort Admin | Published Language | Session events |
| Identity & Access | Cohort Admin | Published Language | Cohort assignment |

---

## Data Flow Matrix

This matrix shows which context produces or consumes each major data entity.

| Data | Identity | Project Mgmt | Mentoring | Evidence | Cohort |
|------|----------|-------------|-----------|----------|--------|
| User identity | PRODUCES | consumes | consumes | consumes | consumes |
| Role/Permission | PRODUCES | consumes | consumes | consumes | consumes |
| Project | -- | PRODUCES | consumes | consumes | consumes |
| Step/Module | -- | PRODUCES | consumes | -- | consumes |
| Step0Data | -- | PRODUCES | -- | -- | -- |
| TeamMember | -- | PRODUCES | -- | consumes | consumes |
| FeedbackIA | -- | consumes (snapshot) | PRODUCES | -- | -- |
| MentorSession | -- | consumes (snapshot) | PRODUCES | -- | consumes |
| MentorCredit | -- | PRODUCES (balance) | PRODUCES (consumption) | -- | -- |
| Rubric scores | -- | -- | PRODUCES | -- | -- |
| Evidence | -- | consumes (ref) | -- | PRODUCES | -- |
| AuditLog | -- | -- | -- | PRODUCES | -- |
| Cohort | consumes | consumes | -- | -- | PRODUCES |
| KPIs/Funnel | -- | -- | -- | -- | PRODUCES |

---

## Deployment Considerations

### Monolith-First Strategy

Given the current state of the application (React frontend with mock data, no backend), the recommended deployment approach is:

1. **Phase 1 -- Modular Monolith**: All 5 contexts in a single deployable unit with clear module boundaries. Internal communication via in-process domain events.

2. **Phase 2 -- Extract Supporting Contexts**: Evidence Management and Cohort Administration can be extracted as separate services first, as they have the loosest coupling.

3. **Phase 3 -- Extract Core Contexts**: Project Management and Mentoring can be separated when scaling demands it, but they should remain closely deployed due to their tight bidirectional event flow.

### Communication in Monolith Phase

```
+----------------------------------------------------------+
|                    Modular Monolith                        |
|                                                           |
|  [Identity]  [Project Mgmt]  [Mentoring]                 |
|      |             |  ^           |  ^                    |
|      |             |  |           |  |                    |
|      +-----+-------+--+-----------+--+-------+           |
|            |         In-Process Event Bus      |           |
|            +----+----------------------------+-+           |
|                 |                            |             |
|           [Evidence]                  [Cohort Admin]      |
+----------------------------------------------------------+
```

In the monolith phase, domain events are dispatched synchronously via an in-process event bus. When contexts are extracted, these become asynchronous messages over a message broker.
