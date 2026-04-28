# ADR-010: Typed Auth Error Envelope V1

## Status
Accepted

## Date
2026-04-26

## Authors
Elite Swarm (security-architect, backend-dev, coder, adr-architect)

## Related
- ADR-003: Authentication Strategy
- ADR-004: Authorization Model
- ADR-005: API Design and Documentation

## Context
The frontend `AppContext.parseAuthError` reads `response.data.error.message`, expecting an object. The backend `error-handler.ts` historically emitted `error` as a bare string, so the lookup resolved to `undefined` and the UI fell back to a generic "No pudimos iniciar sesión." This swallowed every meaningful failure mode the backend already knew about:

- bcrypt mismatch on a known account (should surface "Correo o contraseña incorrectos")
- repeated failures triggering lockout (should surface "Cuenta bloqueada por intentos fallidos")
- per-IP rate limit breach (should surface "Demasiados intentos en poco tiempo")
- registration with an existing email (should surface "Ya existe una cuenta con ese correo")
- Zod validation failures on email format, password complexity, name length (should surface per-input affordances)

The impact splits across two concerns:

- **UX**: Users blame the product because it cannot tell them what went wrong. Sign-up funnel attrition is silent — we cannot distinguish "user gave up" from "user typed the wrong password three times and got rate-limited with no feedback".
- **Operations**: Without stable machine-readable codes, support agents cannot triage tickets, analytics cannot bucket failures, and engineers cannot correlate a user report to a specific request because there is no `requestId` field on the wire.

The auth domain is the most visible failure surface in the product and the highest-risk surface for security regressions. Fixing the envelope here, with security review baked in, sets the contract every other module will adopt.

## Decision
We will adopt a **Typed Auth Error Envelope V1** for every auth flow (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`) and migrate the remaining modules in a follow-up ADR. The shape, codes, and frontend contract below are normative.

### Envelope shape

```ts
type ApiErrorBody = {
  code: string;            // SCREAMING_SNAKE_CASE catalog
  message: string;         // human, espanol latino
  field?: string;          // dotted path for single-field errors
  hint?: string;           // actionable next-step copy
  retryAfterSeconds?: number;
  details?: Array<{ field: string; code: string; message: string }>;
  requestId?: string;
};
type ApiErrorEnvelope = { success: false; error: ApiErrorBody };
```

This shape is a strict superset of the error envelope sketched in ADR-005; it adds `field`, `hint`, `retryAfterSeconds`, and `requestId`. The envelope is emitted exclusively by the central `errorHandler` middleware. Controllers throw `AppError` (or let `ZodError` bubble) — they never hand-build response JSON.

### Code catalog (auth domain)

| Code | HTTP | Message (es-LATAM) | Hint | When emitted | Security note |
|------|------|--------------------|------|--------------|---------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Correo o contraseña incorrectos. | Verifica tus datos o restablece tu contraseña. | Login: user not found OR bcrypt mismatch. | Anti-enumeration: identical code/message/status for both branches. Server runs a constant-time dummy bcrypt compare in the user-not-found branch (CWE-203). |
| `AUTH_EMAIL_TAKEN` | 409 | Ya existe una cuenta con ese correo. | Inicia sesión o recupera tu acceso. | Register: email already in `users`. | Discloses existence by design — the registration form inherently does. Mitigated by per-email rate limiter + CAPTCHA in production. Documented as accepted risk. |
| `AUTH_ACCOUNT_LOCKED` | 423 | Cuenta bloqueada por intentos fallidos. | Intenta de nuevo en {minutes} minutos o restablece tu contraseña. | Login: failure count over threshold. | Includes `retryAfterSeconds` in body and HTTP `Retry-After` header (RFC 6585). |
| `AUTH_RATE_LIMITED` | 429 | Demasiados intentos en poco tiempo. | Espera {seconds} segundos antes de reintentar. | Per-IP and per-email limiters on `/login`, `/register`. | `retryAfterSeconds` in body and HTTP `Retry-After` header. |
| `AUTH_REGISTER_ROLE_FORBIDDEN` | 403 | Solo participantes pueden registrarse aquí. | Otros roles los crea un administrador. | Public register endpoint with non-`owner` role in body. | Aligns with ADR-004 RBAC: only `owner` self-registers. |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Tu sesión expiró. | Inicia sesión nuevamente. | Refresh: token absent, malformed, or unknown. | Server logs distinguish invalid vs. expired vs. reused; client only ever sees the unified message. See "Refresh token codes" below. |
| `AUTH_REFRESH_TOKEN_EXPIRED` | 401 | Tu sesión expiró. | Inicia sesión nuevamente. | Refresh: token past TTL. | Same client-facing copy as above. |
| `AUTH_REFRESH_TOKEN_REUSED` | 401 | Tu sesión expiró. | Inicia sesión nuevamente. | Refresh: rotated token replayed (token-reuse detection per ADR-003). | Server-side log retains the reuse signal for SOC; client copy is intentionally generic so an attacker cannot tell a family was killed. |
| `VALIDATION_ERROR` | 400 | Revisa los datos ingresados. | — | Any `ZodError` from request validation. | `details[]` carries per-field codes (see subcodes below). |
| `AUTH_EMAIL_INVALID` | (sub) | (Zod message) | — | Validation: email format. | Detail subcode under `VALIDATION_ERROR.details[]`. |
| `AUTH_PASSWORD_TOO_SHORT` | (sub) | (Zod message) | — | Validation: password min length. | Detail subcode. |
| `AUTH_PASSWORD_NO_UPPER` | (sub) | (Zod message) | — | Validation: password missing uppercase. | Detail subcode. |
| `AUTH_PASSWORD_NO_LOWER` | (sub) | (Zod message) | — | Validation: password missing lowercase. | Detail subcode. |
| `AUTH_PASSWORD_NO_DIGIT` | (sub) | (Zod message) | — | Validation: password missing digit. | Detail subcode. |
| `AUTH_NAME_TOO_SHORT` | (sub) | (Zod message) | — | Validation: name min length. | Detail subcode. |
| `AUTH_NAME_TOO_LONG` | (sub) | (Zod message) | — | Validation: name max length. | Detail subcode. |
| `UNAUTHORIZED` | 401 | No autorizado. | — | `authenticate` middleware: no/invalid bearer. | Generic; do not specialize for missing-vs-invalid. |
| `FORBIDDEN` | 403 | No tienes permiso. | — | `requireRole` / `requireOwnership` denial (ADR-004). | Generic; do not leak which guard failed. |
| `NOT_FOUND` | 404 | Recurso no encontrado. | — | Resource id miss. | — |
| `CONFLICT` | 409 | Conflicto de datos. | — | Generic conflict (non-auth). | — |
| `INTERNAL_ERROR` | 500 | Error interno del servidor. | — | Any unhandled `Error`. | Body carries `requestId` only — never the stack, never the cause. Stack goes to `logger.error`. |

### Anti-enumeration policy

- **Login**: unknown user and wrong password emit the same `AUTH_INVALID_CREDENTIALS` (401) with the same message. To eliminate the timing oracle (CWE-203 — bcrypt compare on a real user is ~250ms, an early `if (!user) throw` returns in ~5ms), the service runs a constant dummy bcrypt compare in the unknown-user branch and discards the result. This makes both branches indistinguishable to a remote attacker on response time, in line with OWASP ASVS V2.1.11.
- **Register**: `AUTH_EMAIL_TAKEN` (409) does disclose that an email is registered. This is an accepted product trade-off — the sign-up form must tell the user "this account exists, sign in instead" to be usable. The risk is mitigated by:
  - Per-email rate limiter (10 per 15 minutes on the normalized email) layered with the per-IP limiter.
  - CAPTCHA recommended at production launch.
  - Aggressive monitoring of register-endpoint failure cardinality.

### Refresh token codes

The catalog above lists three refresh failure codes (`AUTH_REFRESH_TOKEN_INVALID`, `AUTH_REFRESH_TOKEN_EXPIRED`, `AUTH_REFRESH_TOKEN_REUSED`) for server-side log fidelity (SOC needs to distinguish "user idle" from "rotated-token replay"). On the wire, all three carry the same client-facing `message` and `hint`. This prevents an attacker from learning whether a stolen token has been detected as replayed (which would prompt them to abandon the family and switch to fresh credential phishing). The frontend treats all three identically: clear session, route to `/auth`.

### Lockout & rate-limit headers

Per RFC 6585 / RFC 7231 §7.1.3:

- `AUTH_ACCOUNT_LOCKED` (423) and `AUTH_RATE_LIMITED` (429) include `retryAfterSeconds` in the body **and** set the HTTP `Retry-After` header.
- The frontend prefers the body for UI display (countdown). CDNs, proxies, and SDKs honor the header.
- Implementation: `AppError` carries an optional `retryAfterSeconds` field; `error-handler.ts` reads it once and writes both surfaces.

Lockout policy (per security review): replace the previous fixed 5-failure / 15-minute hard lockout with an escalating ladder — CAPTCHA at 3 failures, throttled 60s back-off at 5, full 15-minute lockout at 10. This reduces the DoS-via-lockout amplifier that NIST SP 800-63B §5.2.2 warns against (an attacker who knows a victim's email can lock them out at will under the simpler policy).

Rate limit policy (per security review): the per-IP limiter alone is trivially defeated via residential proxies / IPv6 rotation. We add a parallel per-email limiter (10 per 15 minutes on the normalized email) on `/login` and `/register`. Either limiter denying short-circuits the request to `AUTH_RATE_LIMITED`.

### Validation error mapping

`ZodError` → `VALIDATION_ERROR` (400) with `details[]`. Mapping logic lives in `error-handler.ts` (`mapZodIssue`). Field-level codes are derived from the issue path + Zod issue code + a regex-message heuristic (see code in `error-handler.ts` for the `mayuscula`/`minuscula`/`numero` lowering trick). The schema and the user-facing Zod messages live alongside the schema in `auth.schemas.ts` to keep field codes and copy in one place.

The frontend distributes `details[]` into per-input error states keyed by `detail.field`.

### Frontend contract

- `front/src/app/services/api.ts` exports `parseApiError(err): AuthError`. It tolerates both the old (`error: string`) and the new (`error: ApiErrorBody`) shapes during the migration window, returning a normalized `AuthError` either way.
- `AppContext` returns `{ success: boolean; error?: AuthError }` from `login` / `register` instead of `{ success, error?: string }`. Consumers downstream rely on `error.code` and `error.details`, not on string parsing.
- `AuthPage.tsx` renders:
  - Per-field errors mapped from `error.details[]`.
  - A top banner with `error.message` and an optional `error.hint`.
  - Code-aware UX:
    - `AUTH_EMAIL_TAKEN` → inline "Inicia sesión" link that swaps the form mode.
    - `AUTH_INVALID_CREDENTIALS` → "¿Olvidaste tu contraseña?" placeholder (route stub until the password-reset flow ships).
    - `AUTH_ACCOUNT_LOCKED` / `AUTH_RATE_LIMITED` → countdown driven by `retryAfterSeconds`; submit button disabled until zero.

## Consequences

### Positive
- Users see actionable, specific Spanish error messages instead of a generic fallback.
- Per-field UI affordances eliminate "what did I do wrong?" friction at the input level.
- Stable codes enable analytics bucketing, support escalation, and i18n later (codes survive copy changes).
- `requestId` in the body short-circuits "send us a screenshot" support flows — the user can paste an id we can grep against `logger`.
- The envelope is consistent with ADR-005's response contract, just with richer body fields.
- Security baseline raised: timing oracle on login closed, per-email limiter added, `Retry-After` header always set on 423/429.

### Negative
- Other modules still emit `error: string`. They become inconsistent with auth until migrated. The migration is mechanical and tracked as a follow-up ticket; until then the frontend `parseApiError` shim absorbs the shape mismatch.
- The frontend must handle both old and new shapes during the migration window. Mitigated by `parseApiError`.
- Server-side Spanish messages complicate i18n later. The security review flags this both as a usability blocker for non-LATAM markets and as a pen-test fingerprinting vector. The plan is to switch to client-side rendering keyed by `code` once we add a second locale; for now the V1 envelope keeps `message` so the curl/SDK consumer experience is not broken.
- Three refresh codes collapse to one wire message — server logs retain the granularity, but client analytics cannot distinguish reuse from expiry without an additional channel.

### Neutral
- The envelope adds bytes per error response (`hint`, `requestId`, `details`). Negligible vs. payload sizes elsewhere in the API.
- `AppError` grows two optional fields (`hint`, `retryAfterSeconds`). Existing throw sites need no change unless they want to populate them.

### Security
The security-architect review (memory key `security-review-envelope-v1`, namespace `architecture-login-error-handler-2026-04-26`) returned an overall posture of **B+** with three BLOCK items, all addressed in this ADR:

1. **CWE-203 timing oracle on login (BLOCK → resolved)**: the unknown-user branch now runs a constant dummy bcrypt compare so wall-clock response time does not distinguish "user does not exist" from "wrong password".
2. **IP-only rate limit (BLOCK → resolved)**: a per-email limiter is added in parallel; either denial returns `AUTH_RATE_LIMITED`.
3. **Missing `Retry-After` header on 423/429 (BLOCK → resolved)**: the central error handler reads `err.retryAfterSeconds` and writes both the body field and the HTTP header per RFC 6585.

IMPROVE-tier items reflected in the design:

- **Login anti-enumeration (PASS)** — same code/message/status for unknown user and wrong password, confirmed at the service layer.
- **Register enumeration (IMPROVE, accepted)** — `AUTH_EMAIL_TAKEN` discloses by design; mitigated by per-email limiter and a CAPTCHA recommendation for production.
- **Lockout policy (IMPROVE)** — ladder replaces hard lockout: CAPTCHA at 3, throttle at 5, lockout at 10.
- **Refresh token client-facing collapse (IMPROVE)** — three server codes, one wire message.
- **`requestId` (PASS)** — UUID v4 only, non-PII, ASVS V7.1.1 logging traceability.
- **No password/PII in logs (PASS)** — verified by grep across `backend/modules/auth/`. Loggers carry `userId`, `failedAttempts`, `family` only.

Server-side i18n is a known IMPROVE-tier finding deferred to the i18n initiative (see Future work). It is not a launch blocker but is mandatory before public launch in non-Spanish markets.

## Alternatives Considered

### RFC 7807 Problem Details
- **Pros**: IETF standard; tooling support (Spring, ASP.NET); `type` URI gives a stable extension point; widely understood by external integrators.
- **Cons**: Heavier shape with mandatory `type` URI; no first-class `field` / `details[]` semantics, so multi-field validation becomes awkward (typically extension members); collides with the `success` discriminator already established in ADR-005; the per-field UX patterns we need on `AuthPage` are easier with our own shape.

Could be revisited if and when we expose the API to external clients or partners; the V1 envelope is internal-first.

### GraphQL-style errors array
- **Pros**: Multiple errors per response; well-suited to partial-success scenarios; aligns with how some SDKs handle batched mutations.
- **Cons**: No batched mutations in the auth domain (every error response represents a single failed action); REST keeps the single-envelope contract simpler; the discriminator `success: true | false` is incompatible with a partial-success model and we do not need one.

### String-only `error` field
- **Pros**: Simpler, what was there before.
- **Cons**: This is the bug we are fixing. No machine-readable code, no per-field affordance, no `requestId`, no `retryAfterSeconds`. Rejected.

## Migration plan

1. **Auth module (this ADR)** — landing now.
2. **Sweep other modules** — `grep -RIn "success: false" backend/modules` and convert any inline error JSON to `next(err)` with the appropriate `AppError` factory. Tracked as a follow-up ticket; mechanical, low-risk, no behavioral change beyond shape.
3. **Frontend tolerance** — `parseApiError` accepts both the old (`error: string`) and the new (`error: ApiErrorBody`) shapes during the transition.
4. **Test coverage** — add a backend test that asserts the envelope shape on each error path. Currently absent because there is no test infrastructure in `backend/`. Tracked as a follow-up ticket; see Future work.

## Risks

- **No backend test framework yet.** This ADR specifies a contract that has no automated assertion against it. The follow-up ticket to add `vitest + supertest` is a prerequisite for declaring V1 stable.
- **Migration window leakage.** If a non-auth module emits the old string shape and the frontend `parseApiError` shim regresses, the user sees the generic fallback again. Mitigated by a contract test on `parseApiError` and by the migration sweep tracked above.
- **i18n debt.** Server-side Spanish copy is a known finding; revisit before launching outside LATAM.

## Future work

- Password reset flow + `AUTH_PASSWORD_RESET_*` codes.
- Centralized i18n: server emits `code` + variables, client renders. Deprecate `message` for i18n consumers (keep for curl/SDK).
- Backend test framework (`vitest` + `supertest`) and a contract test asserting the envelope shape per error path.
- Telemetry: ship `code` + `requestId` to analytics; bucket failures and feed back into product decisions.
- Migrate remaining modules off `error: string`; deprecate the legacy shape in `parseApiError` once the sweep lands.

## References
- ADR-003: Authentication Strategy
- ADR-004: Authorization Model
- ADR-005: API Design and Documentation
- OWASP ASVS v4 — V2 Authentication: https://owasp.org/www-project-application-security-verification-standard/
- NIST SP 800-63B — Digital Identity Guidelines: https://pages.nist.gov/800-63-3/sp800-63b.html
- CWE-203 — Observable Discrepancy (timing oracles): https://cwe.mitre.org/data/definitions/203.html
- RFC 6585 — Additional HTTP Status Codes (429, `Retry-After`): https://datatracker.ietf.org/doc/html/rfc6585
- RFC 7231 §7.1.3 — `Retry-After` semantics: https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.3
- RFC 7519 — JSON Web Token (referenced from ADR-003): https://datatracker.ietf.org/doc/html/rfc7519
- OWASP Access Control Cheat Sheet (referenced from ADR-004): https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html
