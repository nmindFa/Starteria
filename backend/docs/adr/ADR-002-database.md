# ADR-002: Database and ORM Selection

## Status
Accepted

## Date
2026-03-03

## Context
Dashboard Starteria manages innovation projects through a structured 4-step process with mentor support, cohort management, and role-based access. The data model involves complex relationships:

- Projects belong to users (owners) and cohorts
- Projects contain 4 ordered steps, each with multiple modules
- Steps and modules have independent status lifecycles
- Evidence records link to steps/modules with file metadata
- Mentor sessions connect mentors to projects with scheduling and feedback
- Users have roles within cohorts (owner, mentor, admin, leader)

These relationships are inherently relational — projects reference users, steps reference projects, evidence references steps, and cohort membership creates many-to-many relationships. We need a database that enforces referential integrity and an ORM that provides type-safe query building with a good migration system.

## Decision
We will use **PostgreSQL** as the primary database with **Prisma ORM** for data access and schema management.

Configuration:
- PostgreSQL 15+ for production (hosted on Supabase, Neon, or AWS RDS)
- Prisma ORM with declarative schema (`prisma/schema.prisma`)
- Prisma Migrate for version-controlled schema migrations
- Prisma Client for type-safe database queries auto-generated from the schema
- Connection pooling via PgBouncer or Prisma Accelerate for serverless environments

## Consequences

### Positive
- PostgreSQL enforces referential integrity via foreign keys, preventing orphaned records in the project -> step -> module hierarchy
- Prisma generates TypeScript types directly from the schema, providing compile-time safety for all database queries
- Prisma Migrate produces SQL migration files that can be reviewed, versioned, and applied deterministically across environments
- PostgreSQL supports JSON/JSONB columns for semi-structured data (AI feedback responses, flexible metadata)
- PostgreSQL's ACID compliance ensures consistent state transitions for project/step status changes
- Rich ecosystem of PostgreSQL extensions (pg_trgm for search, pgcrypto for hashing)
- Prisma's relation API makes nested queries intuitive (e.g., fetching a project with all steps and modules in one query)

### Negative
- PostgreSQL requires a managed hosting service, adding infrastructure cost compared to SQLite
- Prisma adds a generation step to the build process (prisma generate) and a binary engine dependency
- Prisma's query engine has overhead compared to raw SQL for highly optimized queries
- Schema changes require migration files, adding process overhead for rapid prototyping
- Prisma does not support all PostgreSQL features natively (e.g., materialized views, custom types require raw SQL)

### Neutral
- PostgreSQL is the industry standard for relational data, widely supported by all hosting providers
- Prisma schema serves as the single source of truth for the data model, which is both a benefit (clarity) and a constraint (all changes go through Prisma)

## Alternatives Considered

### MongoDB (with Mongoose)
- **Pros**: Flexible schema for rapid prototyping, native JSON storage, easy horizontal scaling, good developer experience with Mongoose
- **Cons**: No referential integrity enforcement — orphaned documents are common, denormalization leads to data consistency issues, not ideal for the deeply relational project -> step -> module -> evidence hierarchy, transaction support is newer and less mature

### SQLite (with better-sqlite3 or Drizzle)
- **Pros**: Zero infrastructure cost, embedded database, excellent for development and testing, fast for read-heavy workloads
- **Cons**: Not suitable for production with concurrent writes (file-level locking), no built-in user management or network access, limited to single-server deployment, no connection pooling

### Supabase (PostgreSQL-as-a-Service with built-in API)
- **Pros**: Managed PostgreSQL with auto-generated REST/GraphQL APIs, built-in auth, real-time subscriptions, generous free tier
- **Cons**: Vendor lock-in to Supabase platform, auto-generated APIs may not match custom business logic needs, less control over query optimization, adds an opinionated layer over PostgreSQL

## References
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Prisma ORM documentation: https://www.prisma.io/docs
- Prisma Migrate: https://www.prisma.io/docs/concepts/components/prisma-migrate
