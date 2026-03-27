# ADR-006: State Machine for Project and Step Lifecycle

## Status
Accepted

## Date
2026-03-03

## Context
Dashboard Starteria manages innovation projects through a structured lifecycle with multiple status transitions. The domain has three independent but related status lifecycles:

**Project statuses (7)**:
`draft` -> `in_progress` -> `under_review` -> `approved` -> `completed` | `rejected` -> `in_progress` | `archived`

**Step statuses (8)**:
`locked` -> `available` -> `in_progress` -> `submitted` -> `under_review` -> `approved` | `needs_revision` -> `in_progress` | `completed`

**Module statuses (8)**:
`locked` -> `available` -> `in_progress` -> `submitted` -> `under_review` -> `approved` | `needs_revision` -> `in_progress` | `completed`

Invalid transitions must be prevented — for example, a step cannot go from `locked` directly to `submitted`, and a project cannot be `approved` without all steps being `completed`. These rules are core business logic that must be enforced server-side regardless of what the frontend sends.

## Decision
We will implement **explicit state machines with allowed transition maps, validated in the domain layer** before any persistence occurs.

### Architecture
- Each entity type (Project, Step, Module) has a `StatusMachine` class defining valid transitions
- Transitions are defined as a map: `Map<Status, Set<Status>>` — the current status maps to a set of allowed next statuses
- Transition methods validate the requested transition and throw a domain error (`InvalidTransitionError`) if the transition is not allowed
- Transition guards can enforce preconditions (e.g., "all modules must be `completed` before step can transition to `completed`")
- All status changes go through the state machine — direct status field updates are not allowed

### Transition Map Example (Step)

```typescript
const stepTransitions: TransitionMap<StepStatus> = {
  locked:         new Set(['available']),
  available:      new Set(['in_progress']),
  in_progress:    new Set(['submitted']),
  submitted:      new Set(['under_review']),
  under_review:   new Set(['approved', 'needs_revision']),
  approved:       new Set(['completed']),
  needs_revision: new Set(['in_progress']),
  completed:      new Set([]),  // terminal state
};
```

### Transition Guards

```typescript
// Before step -> completed: all modules must be completed
function canCompleteStep(step: Step): boolean {
  return step.modules.every(m => m.status === 'completed');
}

// Before project -> approved: all steps must be completed
function canApproveProject(project: Project): boolean {
  return project.steps.every(s => s.status === 'completed');
}
```

### Domain Layer Integration
- State machine validation happens in the domain/service layer, not in controllers or middleware
- The service layer calls `statusMachine.transition(currentStatus, requestedStatus)` which either returns the new status or throws
- Persistence only occurs after successful validation

## Consequences

### Positive
- Invalid state transitions are impossible — the state machine rejects them before persistence
- Business rules are explicit and readable in the transition map — serves as executable documentation
- Transition guards enforce complex preconditions (all modules complete before step completion) consistently
- State machine is pure logic with no side effects, making it trivially unit-testable
- Centralized status logic prevents duplication across controllers and services
- The API returns `409 Conflict` for invalid transitions, giving the frontend clear feedback

### Negative
- Adding new statuses requires updating the transition map and all guards, which is manual work
- The state machine adds a layer of indirection — developers must look at the transition map to understand allowed flows
- Complex multi-entity transitions (approving a step should unlock the next step) require orchestration logic outside the simple state machine
- No built-in persistence of transition history — must be implemented separately if audit trail is needed

### Neutral
- The state machine is framework-agnostic and can be tested independently of Express, Prisma, or any infrastructure
- Terminal states (completed, archived) have no outgoing transitions by design

## Alternatives Considered

### Free-Form Status Changes (Direct Field Updates)
- **Pros**: Simplest implementation — just update the status field in the database, no validation layer needed
- **Cons**: No protection against invalid transitions, business rules scattered across controllers, impossible to enforce preconditions consistently, debugging invalid states requires manual database inspection

### XState Library
- **Pros**: Industry-standard state machine library, supports hierarchical states, parallel states, guards, actions, and visualizations; can generate state diagrams
- **Cons**: Significant dependency for what are relatively simple linear state machines, learning curve for the XState configuration DSL, serialization complexity when persisting machine state, overkill for transition maps that fit in ~20 lines of code

## References
- State Machine Pattern: https://refactoring.guru/design-patterns/state
- Domain-Driven Design State Transitions: https://www.domainlanguage.com/
