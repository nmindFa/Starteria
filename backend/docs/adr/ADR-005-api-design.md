# ADR-005: API Design and Documentation

## Status
Accepted

## Date
2026-03-03

## Context
The React SPA frontend needs a well-defined API contract to communicate with the Express.js backend (ADR-001). The frontend currently uses mock data and hardcoded function calls — these must be replaced with real HTTP API calls. The API must support:

- Standard CRUD operations for all domain resources (projects, steps, evidence, users, cohorts)
- Business actions beyond CRUD (submit step for review, approve/reject, trigger AI review)
- Pagination, filtering, and sorting for list endpoints
- Consistent error responses that the frontend can handle uniformly
- API documentation that serves as the contract between frontend and backend teams
- Versioning to allow non-breaking evolution

## Decision
We will implement a **RESTful API with resource-based routes and OpenAPI 3.0 documentation**.

### Base Configuration
- **Base URL**: `/api/v1`
- **Content Type**: `application/json` (file uploads use `multipart/form-data`)
- **Versioning**: URL path versioning (`/api/v1`, `/api/v2`)
- **Documentation**: OpenAPI 3.0 spec generated from route definitions using `swagger-jsdoc`
- **Validation**: Request body/query validation using `zod` with shared schemas between frontend and backend

### Resource Routes

| Resource | Endpoint | Methods | Description |
|----------|----------|---------|-------------|
| Auth | `/api/v1/auth` | POST | Register, login, refresh, logout |
| Users | `/api/v1/users` | GET, PATCH, DELETE | User management |
| Projects | `/api/v1/projects` | GET, POST, PUT, DELETE | Project CRUD |
| Steps | `/api/v1/projects/:projectId/steps` | GET, PUT | Step management (nested) |
| Modules | `/api/v1/projects/:projectId/steps/:stepId/modules` | GET, PUT | Module management (nested) |
| Evidence | `/api/v1/evidence` | GET, POST, DELETE | Evidence uploads |
| Mentor Sessions | `/api/v1/mentor-sessions` | GET, POST, PUT, DELETE | Mentor session scheduling |
| Cohorts | `/api/v1/cohorts` | GET, POST, PUT, DELETE | Cohort management |
| AI Review | `/api/v1/ai-review` | POST, GET | Trigger and retrieve AI reviews |

### Response Envelope

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 45 }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  }
}
```

### HTTP Status Codes
- `200` — Success (GET, PUT, PATCH)
- `201` — Created (POST)
- `204` — No Content (DELETE)
- `400` — Validation error
- `401` — Unauthenticated
- `403` — Unauthorized (insufficient role)
- `404` — Resource not found
- `409` — Conflict (invalid state transition)
- `422` — Unprocessable entity (business rule violation)
- `500` — Internal server error

### Business Action Endpoints
- `POST /api/v1/projects/:id/submit` — Submit project for review
- `POST /api/v1/projects/:id/steps/:stepId/submit` — Submit step for mentor review
- `POST /api/v1/projects/:id/steps/:stepId/approve` — Mentor approves step
- `POST /api/v1/projects/:id/steps/:stepId/reject` — Mentor rejects step with feedback
- `POST /api/v1/ai-review/steps/:stepId` — Trigger AI review for a step

## Consequences

### Positive
- RESTful conventions make the API predictable — developers can guess endpoint patterns
- Resource-based URLs map cleanly to the domain model (projects, steps, evidence)
- OpenAPI 3.0 spec enables auto-generated API documentation (Swagger UI), client SDK generation, and contract testing
- Consistent response envelope simplifies frontend error handling (always check `success` field)
- URL versioning allows breaking changes in `/api/v2` without affecting existing clients
- Zod schemas shared between frontend and backend ensure type-safe validation on both sides
- Nested routes (`/projects/:id/steps`) express domain relationships in the URL structure

### Negative
- REST does not map perfectly to all business actions — "submit for review" is not a resource CRUD operation, requiring custom action endpoints
- Nested routes can become deeply nested (`/projects/:id/steps/:stepId/modules/:moduleId`), making URLs long
- Over-fetching is possible when the frontend only needs a subset of fields (no field selection without GraphQL)
- OpenAPI spec maintenance adds documentation overhead that must be kept in sync with implementation

### Neutral
- URL versioning is simple but creates parallel route trees when V2 is introduced
- The response envelope adds a small payload overhead but provides consistency

## Alternatives Considered

### GraphQL
- **Pros**: Client-specified queries eliminate over/under-fetching, strong type system with codegen, single endpoint simplifies routing, real-time subscriptions
- **Cons**: Significant learning curve for the team, requires schema design upfront, caching is more complex (no HTTP caching by URL), N+1 query problem needs DataLoader, overkill for a CRUD-heavy domain

### tRPC
- **Pros**: End-to-end type safety between frontend and backend, no API contract to maintain separately, excellent DX with auto-complete, zero overhead for TypeScript projects
- **Cons**: Tightly couples frontend and backend codebases, harder to expose API to third parties, less ecosystem support for middleware/validation patterns, locks into TypeScript-only clients

## References
- OpenAPI 3.0 Specification: https://swagger.io/specification/
- REST API Design Best Practices: https://restfulapi.net/
- Zod Validation Library: https://zod.dev/
