# ADR-001: Backend Framework Selection

## Status
Accepted

## Date
2026-03-03

## Context
Dashboard Starteria is an Innovation/Entrepreneurship Project Management Platform with an existing React SPA frontend built on Vite + TypeScript + React Router 7 + Radix UI + Tailwind CSS. The platform currently has no backend — all data is mocked on the client side. We need a backend framework to support real data persistence, authentication, authorization, file uploads, and AI integration. The backend must integrate seamlessly with the existing frontend stack and be deployable to Vercel or similar serverless-friendly platforms.

Key requirements:
- TypeScript support for shared type definitions with the frontend
- Large ecosystem with mature middleware for auth, validation, file uploads
- Team familiarity to minimize onboarding time for an MVP
- Vercel-compatible deployment model
- Support for RESTful API patterns with middleware composition

## Decision
We will use **Node.js with Express.js and TypeScript** as the backend framework.

Express.js will be configured with:
- TypeScript for type safety and shared interfaces with the React frontend
- Middleware-based architecture for cross-cutting concerns (auth, validation, logging)
- Router-based modular route organization aligned with domain boundaries
- Standard error handling middleware with structured error responses

## Consequences

### Positive
- Same language (TypeScript) across frontend and backend enables shared type definitions, reducing serialization bugs
- Express.js has the largest Node.js middleware ecosystem, with mature solutions for every concern (cors, helmet, multer, express-validator)
- Team already has JavaScript/TypeScript experience from the frontend, reducing ramp-up time
- Massive community means abundant documentation, tutorials, and Stack Overflow answers
- Vercel supports Express.js via serverless functions or standalone Node.js deployments
- Simple mental model: request -> middleware chain -> handler -> response

### Negative
- Express.js is not the fastest Node.js framework (Fastify benchmarks ~2x faster for raw throughput)
- No built-in support for dependency injection, validation, or OpenAPI — requires additional libraries
- Callback-oriented legacy API requires careful async/await wrapping to avoid unhandled rejections
- Minimal opinionation means the team must establish and enforce architectural conventions manually
- Express 4.x has been stable for years but Express 5 is still not fully released, creating some ecosystem uncertainty

### Neutral
- Express.js is mature and unlikely to see breaking changes, providing stability but also slower innovation
- The middleware pattern is both a strength (composability) and a risk (ordering bugs, implicit dependencies)

## Alternatives Considered

### Fastify
- **Pros**: ~2x faster than Express in benchmarks, built-in schema validation via JSON Schema, better TypeScript support out of the box, plugin-based architecture
- **Cons**: Smaller ecosystem than Express, fewer third-party middleware options, team would need to learn new patterns, some Vercel deployment edge cases

### NestJS
- **Pros**: Full-featured framework with dependency injection, decorators, built-in support for guards/interceptors/pipes, OpenAPI generation, modular architecture enforced by framework
- **Cons**: Significant learning curve (Angular-style decorators, DI container), overkill for an MVP with 8-10 resources, heavier bundle size, slower development velocity initially

### Hono
- **Pros**: Ultra-fast, designed for edge/serverless, tiny bundle, excellent TypeScript support, multi-runtime (Node, Deno, Bun, Cloudflare Workers)
- **Cons**: Relatively new framework with smaller community, fewer battle-tested middleware, limited ecosystem for complex needs (file uploads, ORM integration), risk of breaking changes

## References
- Express.js documentation: https://expressjs.com/
- Node.js TypeScript setup: https://nodejs.org/en/learn/getting-started/nodejs-with-typescript
- Vercel Node.js deployment: https://vercel.com/docs/functions/runtimes/node-js
