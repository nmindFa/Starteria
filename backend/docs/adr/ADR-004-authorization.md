# ADR-004: Authorization Model

## Status
Accepted

## Date
2026-03-03

## Context
Dashboard Starteria has 4 distinct user roles with different access patterns across the platform:

- **Admin**: Full platform access — manage users, cohorts, view all projects, system configuration
- **Mentor**: Review assigned projects, provide feedback on steps/modules, conduct mentor sessions, view mentee progress
- **Owner** (Entrepreneur): Create and manage own projects, submit evidence, respond to feedback, view own progress
- **Leader**: View projects assigned to their cohort, monitor progress, limited administrative actions within their cohort

The authorization model must:
- Enforce role-based access at the API level (not just UI hiding)
- Support resource ownership checks (owners can only modify their own projects)
- Be simple enough for 4 roles without over-engineering
- Integrate with JWT claims from the authentication system (ADR-003)
- Be testable in isolation (unit tests for permission logic)

## Decision
We will implement **Role-Based Access Control (RBAC) with Express middleware guards**.

Architecture:
- **Role guard middleware**: `requireRole(...roles)` — checks JWT `role` claim against allowed roles
- **Ownership guard middleware**: `requireOwnership(resourceExtractor)` — verifies the authenticated user owns the requested resource
- **Combined guards**: Middleware can be composed — e.g., `requireRole('admin', 'owner'), requireOwnership(...)` means admins bypass ownership check, owners must own the resource
- **Permission matrix** enforced at the route level, not in business logic

### Permission Matrix

| Resource | Admin | Mentor | Owner | Leader |
|----------|-------|--------|-------|--------|
| Users (CRUD) | All | Read own | Read/Update own | Read assigned |
| Cohorts | All | Read assigned | Read own | Read assigned |
| Projects | All | Read/Review assigned | CRUD own | Read assigned |
| Steps/Modules | All | Read/Review assigned | Update own | Read assigned |
| Evidence | All | Read assigned | CRUD own | Read assigned |
| Mentor Sessions | All | CRUD own sessions | Read own | Read assigned |
| AI Review | All | Trigger for assigned | Trigger for own | View assigned |

### Middleware Implementation Pattern

```typescript
// Route definition
router.put('/projects/:id',
  authenticate,                           // Verify JWT (ADR-003)
  requireRole('admin', 'owner'),          // Must be admin or owner
  requireOwnership(extractProjectOwner),  // Owners must own the project
  projectController.update
);
```

## Consequences

### Positive
- Simple mental model: 4 roles with clear boundaries, easy to explain and audit
- Middleware composition allows declarative permission definitions at the route level
- Permission logic is separated from business logic, improving testability
- JWT role claim enables authorization checks without database queries for role verification
- Permission matrix serves as living documentation of access control
- Easy to add new roles in the future by extending the role enum and updating the matrix

### Negative
- RBAC cannot express fine-grained attribute-based rules (e.g., "mentors can only review projects in active cohorts") without additional middleware
- Ownership checks require database queries to verify resource ownership, adding latency
- Role is embedded in the JWT, so role changes don't take effect until the next token refresh (max 15 minutes)
- No built-in audit trail for authorization decisions — must be added separately via logging middleware

### Neutral
- The 4-role model is sufficient for the MVP but may need to evolve toward ABAC if more granular permissions are needed
- Guard middleware ordering matters — authenticate must run before role checks, role checks before ownership checks

## Alternatives Considered

### Attribute-Based Access Control (ABAC)
- **Pros**: Fine-grained policies based on user attributes, resource attributes, and environment context; very flexible and expressive
- **Cons**: Significant implementation complexity for 4 roles, requires a policy engine, harder to reason about and audit, overkill for the current permission model

### Casbin
- **Pros**: Mature authorization library with support for RBAC, ABAC, and custom models; policy defined in configuration files; supports multiple enforcement paradigms
- **Cons**: Adds a significant dependency for what is essentially 4-role RBAC, learning curve for the Casbin model/policy/effect DSL, overhead of policy file management

### Custom ACL (Access Control Lists)
- **Pros**: Per-resource permission assignments, very granular control over who can access what
- **Cons**: High maintenance burden — every resource needs explicit ACL entries, ACL management UI required, scales poorly as the number of resources grows, complex permission resolution logic

## References
- OWASP Access Control Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html
- Express.js Middleware: https://expressjs.com/en/guide/using-middleware.html
