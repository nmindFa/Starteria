# Security Checklist - Dashboard Starteria

## 1. Input Validation

### Zod Schema Validation

All API inputs are validated with Zod at the controller boundary before any processing.

```typescript
import { z } from 'zod';

// Login schema
const loginSchema = z.object({
  email: z.string().email('Correo electronico invalido').max(255).trim().toLowerCase(),
  password: z.string().min(1, 'Contrasena requerida').max(128),
});

// Registration schema
const registerSchema = z.object({
  email: z.string().email('Correo electronico invalido').max(255).trim().toLowerCase(),
  password: z.string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .max(128)
    .regex(/[a-z]/, 'Debe contener al menos una minuscula')
    .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
    .regex(/\d/, 'Debe contener al menos un numero'),
  name: z.string().min(2, 'Nombre muy corto').max(100).trim(),
  role: z.literal('owner'),  // Only owner can self-register
});

// Project creation schema
const createProjectSchema = z.object({
  name: z.string().min(3, 'Nombre muy corto').max(200).trim(),
  description: z.string().max(2000).trim().optional(),
});

// Step update schema
const updateStepSchema = z.object({
  modules: z.array(z.object({
    id: z.string().max(10),
    content: z.string().max(10000),
  })).optional(),
  status: z.enum(['No iniciado', 'En progreso', 'Enviado']).optional(),
});

// UUID parameter validation
const uuidParam = z.string().uuid('ID invalido');
```

**Validation middleware helper:**

```typescript
function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Datos invalidos',
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    req.body = result.data;  // Use sanitized data
    next();
  };
}

// Usage: router.post('/login', validate(loginSchema), authController.login);
```

### Rules

- [ ] Every API endpoint has a Zod schema for its request body
- [ ] Path parameters (IDs) are validated as UUIDs before database queries
- [ ] Query parameters have explicit types and limits
- [ ] String inputs are trimmed and length-limited
- [ ] Numeric inputs have min/max bounds
- [ ] Enum values are validated against allowed lists
- [ ] File names are sanitized (strip path separators, null bytes)
- [ ] Never trust client-side validation alone

## 2. SQL Injection Prevention

### Prisma ORM (Parameterized Queries)

All database access goes through Prisma, which uses parameterized queries by default.

**Rules:**

- [ ] ALL database queries use Prisma Client (never raw SQL)
- [ ] If `$queryRaw` is absolutely necessary, ALWAYS use tagged template literals (`Prisma.sql`) for parameter binding
- [ ] Never concatenate user input into query strings
- [ ] Never use `$queryRawUnsafe` or `$executeRawUnsafe`

```typescript
// SAFE - Prisma parameterized query
const user = await prisma.user.findUnique({
  where: { email: sanitizedEmail },
});

// SAFE - Raw query with parameterized input (if needed)
const results = await prisma.$queryRaw(
  Prisma.sql`SELECT * FROM users WHERE email = ${sanitizedEmail}`
);

// NEVER DO THIS
const results = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${userInput}'`  // SQL INJECTION!
);
```

## 3. XSS Prevention

### Output Encoding

- [ ] React handles JSX escaping by default (never use `dangerouslySetInnerHTML`)
- [ ] API responses use `Content-Type: application/json` (no HTML responses from API)
- [ ] User-generated content displayed in frontend is escaped by React's JSX
- [ ] Evidence file names are sanitized before display
- [ ] CSP headers restrict inline scripts (configured via Helmet)

### Specific Measures

```typescript
// Sanitize file names for display
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"\/\\|?*\x00-\x1f]/g, '_')  // Remove dangerous chars
    .slice(0, 255);                               // Length limit
}

// Never render raw HTML from user input
// React JSX auto-escapes: <p>{userInput}</p> is safe
// NEVER: <div dangerouslySetInnerHTML={{ __html: userInput }} />
```

## 4. CSRF Protection

### Strategy: SameSite Cookies + Origin Verification

Since the API uses JWT in Authorization headers (not cookies) for access tokens, traditional CSRF is mitigated. The refresh token cookie is additionally protected:

- [ ] Refresh token cookie has `SameSite: Strict`
- [ ] Refresh token cookie has `HttpOnly: true`
- [ ] Refresh token cookie has `Secure: true` (HTTPS only)
- [ ] Refresh token cookie is scoped to `path: '/api/auth/refresh'`
- [ ] CORS is configured to only allow the frontend origin
- [ ] `Origin` header is verified on mutation requests

```typescript
// Origin verification middleware for extra safety
function verifyOrigin(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    const allowedOrigin = process.env.FRONTEND_URL;

    if (origin && origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
  }
  next();
}
```

## 5. File Upload Validation

### Evidence Upload Security

- [ ] MIME type whitelist enforced server-side (not just client)
- [ ] File extension validated against MIME type (no mismatch)
- [ ] Maximum file size: 50MB per file
- [ ] Maximum 5 files per upload request
- [ ] File content validated (magic bytes check for images/PDFs)
- [ ] Files stored outside the web root (S3 or dedicated storage)
- [ ] File names are regenerated server-side (UUID-based)
- [ ] Original file name stored in database only (not on filesystem)
- [ ] Signed URLs for download (time-limited, user-scoped)

```typescript
// Allowed file types
const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
};

// Magic bytes validation
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

async function validateFileContent(buffer: Buffer, declaredMime: string): boolean {
  const expected = MAGIC_BYTES[declaredMime];
  if (!expected) return true;  // No magic bytes check for this type
  return expected.every((byte, i) => buffer[i] === byte);
}
```

## 6. Password Requirements

### Policy

| Requirement | Value |
|-------------|-------|
| Minimum length | 8 characters |
| Maximum length | 128 characters |
| Uppercase required | At least 1 |
| Lowercase required | At least 1 |
| Digit required | At least 1 |
| Special chars | Not required (encouraged) |
| Common password check | Reject top 10,000 common passwords |
| Password history | Cannot reuse last 5 passwords |

### Implementation Checklist

- [ ] Password complexity validated at registration and password change
- [ ] Passwords hashed with bcrypt (12 rounds) before storage
- [ ] Plaintext passwords never logged or stored
- [ ] Password comparison uses constant-time comparison (bcrypt.compare)
- [ ] Failed login attempts tracked and account locked after 5 failures
- [ ] Lockout duration: 15 minutes
- [ ] Password change requires current password verification
- [ ] Password change invalidates all existing refresh tokens
- [ ] Password reset tokens are single-use and expire in 1 hour

```typescript
import commonPasswords from './data/common-passwords.json'; // Top 10k

function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) errors.push('Minimo 8 caracteres');
  if (password.length > 128) errors.push('Maximo 128 caracteres');
  if (!/[a-z]/.test(password)) errors.push('Debe contener al menos una minuscula');
  if (!/[A-Z]/.test(password)) errors.push('Debe contener al menos una mayuscula');
  if (/\d/.test(password) === false) errors.push('Debe contener al menos un numero');
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Esta contrasena es demasiado comun');
  }

  return { valid: errors.length === 0, errors };
}
```

## 7. Audit Logging

### Events to Log

| Category | Events |
|----------|--------|
| **Authentication** | Login success, login failure, logout, token refresh, password change, password reset request |
| **Authorization** | Access denied (403), role escalation attempt |
| **Data Mutation** | Project create/update/delete, evidence upload/delete, step submit |
| **Admin Actions** | User create/update/deactivate, cohort create/update, mentor/leader assignment |
| **Security Events** | Refresh token reuse detected, account lockout, rate limit exceeded |

### Log Structure

```typescript
interface AuditEntry {
  id: string;            // UUID
  timestamp: string;     // ISO 8601
  userId: string | null; // NULL for unauthenticated events
  action: string;        // e.g., "auth.login.success"
  resourceType: string;  // e.g., "user", "project", "evidence"
  resourceId: string | null;
  details: Record<string, unknown>;  // Action-specific data
  ipAddress: string;
  userAgent: string;
  requestId: string;     // Correlate with request logs
}
```

### Audit Service

```typescript
async function audit(
  req: Request,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.sub || null,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
      requestId: req.id,
    },
  });
}

// Usage:
// await audit(req, 'auth.login.success', 'user', user.id);
// await audit(req, 'project.create', 'project', newProject.id, { name: newProject.name });
// await audit(req, 'auth.login.failure', 'user', null, { email: req.body.email });
```

### Checklist

- [ ] All authentication events are logged
- [ ] All authorization failures (403) are logged
- [ ] All data mutations are logged
- [ ] All admin actions are logged
- [ ] Audit logs are immutable (append-only, no UPDATE/DELETE on audit_log)
- [ ] Sensitive data is NOT included in logs (passwords, tokens, PII beyond user ID)
- [ ] Logs include request ID for tracing
- [ ] Audit log retention: 90 days minimum
- [ ] Admin can view audit log via `/api/admin/audit-log`

## 8. Environment Variable Management

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_PRIVATE_KEY` | Base64-encoded RSA private key | (long base64 string) |
| `JWT_PUBLIC_KEY` | Base64-encoded RSA public key | (long base64 string) |
| `FRONTEND_URL` | Allowed CORS origin | `https://app.starteria.io` |
| `COOKIE_DOMAIN` | Domain for cookies | `.starteria.io` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `S3_BUCKET` | Evidence file storage bucket | `starteria-evidence` |
| `S3_REGION` | AWS region | `us-east-1` |

### Checklist

- [ ] All secrets in environment variables, never in code
- [ ] `.env` file in `.gitignore` (verified)
- [ ] `.env.example` exists with placeholder values (no real secrets)
- [ ] Production secrets managed via cloud provider secret manager
- [ ] No secrets in Docker images, CI logs, or error messages
- [ ] `DATABASE_URL` uses SSL in production (`?sslmode=require`)
- [ ] RSA keys generated fresh per environment (never shared between envs)

### .env.example

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/starteria_dev

# JWT (generate with: openssl genrsa 2048 | base64 -w 0)
JWT_PRIVATE_KEY=<base64-encoded-private-key>
JWT_PUBLIC_KEY=<base64-encoded-public-key>

# Frontend
FRONTEND_URL=http://localhost:5173
COOKIE_DOMAIN=localhost

# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# File Storage
S3_BUCKET=starteria-evidence-dev
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

## 9. Additional Security Measures

### HTTP Security

- [ ] HTTPS enforced in production (redirect HTTP to HTTPS)
- [ ] HSTS header with preload
- [ ] No sensitive data in URL query parameters
- [ ] API versioning via URL path (`/api/v1/`) not headers
- [ ] Response does not leak server version or framework info

### Session Security

- [ ] Access tokens stored in memory only (not localStorage, not sessionStorage)
- [ ] Refresh tokens in HTTP-only cookies only
- [ ] Tokens cleared on logout
- [ ] Automatic token refresh before expiry (client-side interceptor)
- [ ] Idle timeout: redirect to login after 30 minutes of inactivity (client-side)

### Database Security

- [ ] Prisma ORM for all queries (parameterized by default)
- [ ] Database user has minimum required privileges (no SUPERUSER)
- [ ] Soft deletes preferred over hard deletes (audit trail)
- [ ] Sensitive columns (password_hash) excluded from default select
- [ ] Connection pooling configured (PgBouncer or Prisma connection pool)
- [ ] Database accessible only from application servers (no public access)

### Error Handling

- [ ] Generic error messages in production (no stack traces)
- [ ] Detailed errors only in development mode
- [ ] Authentication errors use generic "Credenciales invalidas" (no user enumeration)
- [ ] 404 for missing resources (not 403, to prevent enumeration)
- [ ] All errors return consistent JSON structure

### Dependency Security

- [ ] `npm audit` run in CI pipeline
- [ ] Dependabot or Renovate for automated dependency updates
- [ ] No `eval()`, `new Function()`, or dynamic `require()` with user input
- [ ] Lockfile (`package-lock.json`) committed to repo

## 10. Pre-Launch Security Review

Before production deployment:

- [ ] All checklist items above completed
- [ ] OWASP Top 10 reviewed against implementation
- [ ] Rate limiting tested under load
- [ ] Authentication flows tested (login, register, refresh, logout)
- [ ] Authorization tested for every endpoint and role combination
- [ ] File upload tested with malicious files (wrong MIME, oversized, path traversal names)
- [ ] Error responses reviewed for information leakage
- [ ] CORS tested (only allowed origin can make requests)
- [ ] CSP headers tested (no inline script execution)
- [ ] Penetration testing scheduled for post-MVP
