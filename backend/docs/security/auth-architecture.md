# Authentication Architecture - Dashboard Starteria

## Overview

Dashboard Starteria uses a stateless JWT-based authentication system with RS256-signed access tokens and rotating refresh tokens. The system supports four roles: `owner`, `mentor`, `admin`, and `leader`.

## Token Strategy

### Access Token (JWT)

| Property | Value |
|----------|-------|
| Algorithm | RS256 (asymmetric) |
| Expiry | 15 minutes |
| Transport | `Authorization: Bearer <token>` header |
| Storage (client) | In-memory only (never localStorage) |
| Signing key | RSA-2048 private key (env: `JWT_PRIVATE_KEY`) |
| Verification key | RSA-2048 public key (env: `JWT_PUBLIC_KEY`) |

**Payload structure:**

```typescript
interface AccessTokenPayload {
  sub: string;        // userId (e.g., "usr_abc123")
  role: Role;         // "owner" | "mentor" | "admin" | "leader"
  email: string;      // user email
  cohort?: string;    // cohort identifier (optional)
  iat: number;        // issued at (unix timestamp)
  exp: number;        // expiration (unix timestamp)
  iss: string;        // "starteria-api"
  aud: string;        // "starteria-dashboard"
}
```

### Refresh Token

| Property | Value |
|----------|-------|
| Format | Opaque random string (crypto.randomBytes(64).toString('hex')) |
| Expiry | 7 days |
| Transport | HTTP-only secure cookie (`starteria_rt`) |
| Storage (server) | `refresh_tokens` table in PostgreSQL |
| Rotation | New token issued on every use; old token invalidated |
| Family tracking | Each token belongs to a `tokenFamily` for reuse detection |

**Cookie configuration:**

```typescript
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,               // HTTPS only
  sameSite: 'strict' as const,
  path: '/api/auth/refresh',  // Scoped to refresh endpoint only
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  domain: process.env.COOKIE_DOMAIN, // e.g., ".starteria.io"
};
```

### Refresh Token Database Schema

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(128) NOT NULL UNIQUE,  -- SHA-256 hash, never store plaintext
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_family UUID NOT NULL,               -- Rotation family for reuse detection
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,                   -- NULL = active
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,                           -- For audit trail
  ip_address INET                           -- For audit trail
);

CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

## Password Hashing

| Property | Value |
|----------|-------|
| Algorithm | bcrypt |
| Rounds | 12 |
| Library | `bcryptjs` (pure JS, no native deps) |

```typescript
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

**Password requirements (enforced at registration and change):**

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- No maximum length (bcrypt truncates at 72 bytes; warn if exceeded)

```typescript
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
```

## Authentication Flows

### 1. Login Flow

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@empresa.com",
  "password": "SecurePass1"
}
```

**Sequence:**

1. Validate input with Zod schema (email format, password non-empty)
2. Find user by email (case-insensitive) in `users` table
3. If not found: return 401 `{ error: "Credenciales invalidas" }` (generic message)
4. Compare password against stored bcrypt hash
5. If mismatch: increment `failed_login_count`, check lockout threshold
   - After 5 failed attempts: lock account for 15 minutes
   - Return 401 `{ error: "Credenciales invalidas" }`
6. If match: reset `failed_login_count`
7. Generate access token (JWT RS256, 15 min)
8. Generate refresh token (random, 7 days)
9. Store refresh token hash in DB with `token_family` = new UUID
10. Set refresh token as HTTP-only cookie
11. Log successful login in `audit_log`

**Response (200):**

```json
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "usr_abc123",
    "name": "Ana Rodriguez",
    "email": "participante@starteria.io",
    "role": "owner",
    "initials": "AR",
    "cohort": "Cohorte 2025-A"
  }
}
```

**Error responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Invalid input | `{ error: "Correo electronico requerido" }` |
| 401 | Wrong credentials | `{ error: "Credenciales invalidas" }` |
| 423 | Account locked | `{ error: "Cuenta bloqueada temporalmente. Intenta en 15 minutos." }` |
| 429 | Rate limit exceeded | `{ error: "Demasiados intentos. Intenta mas tarde." }` |

### 2. Register Flow

```
POST /api/auth/register
Content-Type: application/json

{
  "email": "nuevo@empresa.com",
  "password": "SecurePass1",
  "name": "Juan Garcia",
  "role": "owner"
}
```

**Sequence:**

1. Validate input with Zod schema:
   - `email`: valid email format
   - `password`: meets complexity requirements
   - `name`: 2-100 characters, trimmed
   - `role`: must be `"owner"` (other roles are admin-assigned only)
2. Check if email already exists (case-insensitive)
   - If exists: return 409 `{ error: "Ya existe una cuenta con ese correo" }`
3. Hash password with bcrypt (12 rounds)
4. Create user record in `users` table
5. Generate access token and refresh token (same as login steps 7-10)
6. Log registration in `audit_log`

**Response (201):**

```json
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "usr_xyz789",
    "name": "Juan Garcia",
    "email": "nuevo@empresa.com",
    "role": "owner",
    "initials": "JG"
  }
}
```

**Note:** Only `owner` role can self-register. Roles `mentor`, `admin`, and `leader` are created by an admin via `POST /api/admin/users`.

### 3. Refresh Flow

```
POST /api/auth/refresh
Cookie: starteria_rt=<refresh_token>
```

**Sequence:**

1. Extract refresh token from HTTP-only cookie
2. If no cookie: return 401
3. Compute SHA-256 hash of token
4. Look up token hash in `refresh_tokens` where `revoked_at IS NULL`
5. If not found: return 401
6. If expired (`expires_at < NOW()`): revoke, return 401
7. **Reuse detection:** If token was already used (found in revoked state with same family):
   - Revoke ALL tokens in the same `token_family` (compromised family)
   - Log security event: "Refresh token reuse detected"
   - Return 401
8. Revoke current token (`revoked_at = NOW()`)
9. Generate new refresh token with same `token_family`
10. Store new token hash in DB
11. Generate new access token
12. Set new refresh token cookie
13. Return new access token

**Response (200):**

```json
{
  "accessToken": "eyJhbG..."
}
```

### 4. Logout Flow

```
POST /api/auth/logout
Authorization: Bearer <access_token>
Cookie: starteria_rt=<refresh_token>
```

**Sequence:**

1. Extract and verify access token (optional; logout should work even with expired access token)
2. Extract refresh token from cookie
3. If refresh token exists:
   - Compute hash
   - Revoke token in DB (`revoked_at = NOW()`)
   - Optionally: revoke ALL tokens for this user (full logout)
4. Clear the refresh cookie
5. Log logout in `audit_log`

**Response (200):**

```json
{
  "message": "Sesion cerrada exitosamente"
}
```

## Key Generation

RS256 keys must be generated before deployment:

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem
```

Store keys as environment variables (base64 encoded for single-line storage):

```bash
JWT_PRIVATE_KEY=$(base64 -w 0 private.pem)
JWT_PUBLIC_KEY=$(base64 -w 0 public.pem)
```

## Token Service Implementation

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY!, 'base64').toString('utf-8');
const publicKey = Buffer.from(process.env.JWT_PUBLIC_KEY!, 'base64').toString('utf-8');

interface TokenPayload {
  sub: string;
  role: Role;
  email: string;
  cohort?: string;
}

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
    issuer: 'starteria-api',
    audience: 'starteria-dashboard',
  });
}

function verifyAccessToken(token: string): TokenPayload & jwt.JwtPayload {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: 'starteria-api',
    audience: 'starteria-dashboard',
  }) as TokenPayload & jwt.JwtPayload;
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

## Account Lockout Policy

| Parameter | Value |
|-----------|-------|
| Max failed attempts | 5 |
| Lockout duration | 15 minutes |
| Counter reset | On successful login |
| Storage | `failed_login_count` and `locked_until` columns in `users` table |

## Session Invalidation Strategies

| Scenario | Action |
|----------|--------|
| User logs out | Revoke current refresh token |
| User changes password | Revoke ALL refresh tokens for user |
| Admin deactivates user | Revoke ALL refresh tokens for user |
| Suspicious activity detected | Revoke entire token family |
| Refresh token reuse detected | Revoke entire token family |

## Environment Variables

```
JWT_PRIVATE_KEY=<base64-encoded RSA private key>
JWT_PUBLIC_KEY=<base64-encoded RSA public key>
COOKIE_DOMAIN=.starteria.io
NODE_ENV=production
```

## Security Considerations

1. **Access tokens are NOT stored** - They live in memory only. On page refresh, the client calls `/api/auth/refresh` to get a new one.
2. **Refresh tokens are hashed** - Only SHA-256 hashes are stored in the database. A database breach does not expose valid tokens.
3. **Token family tracking** - If an attacker steals and uses a refresh token, the legitimate user's next refresh attempt triggers reuse detection, revoking the entire family.
4. **Asymmetric signing (RS256)** - Microservices can verify tokens with the public key without accessing the private key. Enables future API gateway or service mesh verification.
5. **Constant-time comparison** - Always use `crypto.timingSafeEqual` when comparing token hashes to prevent timing attacks.
6. **No token in URL** - Tokens are never passed as query parameters (prevents logging/caching exposure).
