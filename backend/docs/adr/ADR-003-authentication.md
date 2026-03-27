# ADR-003: Authentication Strategy

## Status
Accepted

## Date
2026-03-03

## Context
Dashboard Starteria currently uses mock authentication with hardcoded users in the frontend. The `AuthContext` and `ProtectedRoute` components exist but authenticate against static data. We need real authentication that:

- Works with a React SPA (no server-side rendering of login pages)
- Supports multiple user roles (owner, mentor, admin, leader) for downstream authorization
- Is stateless to allow horizontal scaling without sticky sessions
- Provides secure token storage resistant to XSS and CSRF attacks
- Supports token refresh without forcing users to re-login frequently
- Integrates with the Express.js backend (ADR-001)

## Decision
We will implement **JWT-based authentication with short-lived access tokens and HTTP-only cookie refresh tokens**.

Token configuration:
- **Access token**: JWT signed with RS256, 15-minute expiry, sent via `Authorization: Bearer` header
  - Payload: `{ sub: userId, role: userRole, cohortId: activeCohortId }`
- **Refresh token**: Opaque token stored in PostgreSQL, 7-day expiry, sent via HTTP-only secure cookie
  - Cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth/refresh`
- **Password hashing**: bcrypt with cost factor 12
- **Token refresh flow**: Client calls `/api/v1/auth/refresh` when access token expires; server validates refresh token, rotates it (one-time use), and issues new access token

Auth endpoints:
- `POST /api/v1/auth/register` — Create account with email/password
- `POST /api/v1/auth/login` — Authenticate, return access token + set refresh cookie
- `POST /api/v1/auth/refresh` — Rotate refresh token, return new access token
- `POST /api/v1/auth/logout` — Invalidate refresh token, clear cookie
- `GET /api/v1/auth/me` — Return current user profile from access token

## Consequences

### Positive
- Stateless access tokens allow horizontal scaling without shared session storage
- Short 15-minute access token lifetime limits the window of exposure if a token is compromised
- HTTP-only cookies for refresh tokens prevent JavaScript access, mitigating XSS token theft
- Refresh token rotation (one-time use) detects token reuse, indicating potential compromise
- RS256 signing allows the frontend to verify tokens without knowing the private key (future use)
- Role embedded in JWT payload enables fast authorization checks without database queries on every request
- Standard JWT approach is well-understood by the team and has mature library support (jsonwebtoken, jose)

### Negative
- JWTs cannot be individually revoked before expiry without a blacklist (mitigated by short 15-minute lifetime)
- Refresh token in HTTP-only cookie requires CSRF protection for the refresh endpoint
- Token refresh adds complexity to the frontend HTTP client (interceptor to retry on 401)
- RS256 key pair management adds operational overhead (key rotation, secure storage)
- Storing refresh tokens in PostgreSQL adds database queries to the refresh flow

### Neutral
- The frontend AuthContext must be updated to store the access token in memory (not localStorage) and call the refresh endpoint on app load
- Logout is not instant — the access token remains valid until expiry (max 15 minutes)

## Alternatives Considered

### Session-Based Authentication (express-session + Redis)
- **Pros**: Simple to implement, immediate revocation by deleting session, no token expiry complexity
- **Cons**: Requires shared session store (Redis) for horizontal scaling, sticky sessions or session replication, not ideal for SPA architecture, CORS cookie complexity

### OAuth2 / OpenID Connect Only (Auth0, Clerk, Firebase Auth)
- **Pros**: Offloads auth complexity to a managed service, social login support, MFA out of the box, compliance features
- **Cons**: Vendor dependency and cost, adds external service latency, complex redirect-based flows for SPA, less control over user data and token claims, overkill for an MVP with email/password only

### Passport.js
- **Pros**: Well-known Node.js auth library, 500+ authentication strategies, modular approach
- **Cons**: Adds an abstraction layer over what is fundamentally simple JWT logic, strategy pattern adds indirection, documentation quality varies across strategies, serialization/deserialization overhead when not using sessions

## References
- JSON Web Token RFC 7519: https://datatracker.ietf.org/doc/html/rfc7519
- OWASP JWT Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
- HTTP Cookie Security: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
