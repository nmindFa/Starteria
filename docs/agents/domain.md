# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: single-context

- **`CONTEXT.md`** at the repo root — project glossary and ubiquitous language. Currently does **not** exist. `/grill-with-docs` will create it lazily as terms get resolved during work.
- **`backend/docs/adr/`** — product/code architectural decisions. Currently 12 ADRs covering: backend framework, database, authentication, authorization (incl. 6-role model evolution), API design, state machine, file storage, AI integration, role-state integration, and the typed auth error envelope V1 (ADR-010).
- **`docs/adr/`** — meta-methodology ADRs from the BHIL AI-First Development Toolkit (model selection, agent orchestration, prompt strategy). These describe how AI features should be designed/operated, not the product domain. Read them only when working on AI/agent features.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root if it exists.
- **`backend/docs/adr/`** — ADRs that touch the area you're about to work in. Cross-reference by topic:
  - Auth flow → ADR-003 + ADR-010
  - Authorization / roles → ADR-004, ADR-009 (and its three variants)
  - State transitions → ADR-006
  - API conventions → ADR-005
  - File uploads → ADR-007
  - AI integration → ADR-008
- **`docs/adr/`** — only when working on AI/agent code paths.
- **`docs/starteria-ux-writing.md`** — UX writing rules (español latino, claro, directo, orientado a acción) when writing user-facing copy.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (issue title, refactor proposal, hypothesis, test name), use the term as defined in `CONTEXT.md`. Project-specific terms to keep consistent:

- `step` (0–4), `módulo`, `transition`, `state machine`
- `feedback IA`, `mentor session`, `sponsor checkpoint`, `evidence`
- `frente estratégico`, `desafío`, `squad`, `output ejecutivo`, `invitación`
- `cohorte`, `participante`, `colaborador`, `mentor`, `admin`, `sponsor`, `viewer`, `portfolio_lead`
- `AuthError`, `envelope V1`, `requestId`, `retryAfterSeconds`

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-010 (auth error envelope) — but worth reopening because…_
