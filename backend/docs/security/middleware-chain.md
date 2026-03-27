# Middleware Chain - Dashboard Starteria

## Overview

The Express middleware chain processes each request through a series of security layers before reaching the route handler. Middleware executes in the order listed below.

## Middleware Execution Order

```
Request
  |
  v
1. CORS
  |
  v
2. Helmet (Security Headers)
  |
  v
3. Body Parser (with size limits)
  |
  v
4. Request ID
  |
  v
5. Request Logger
  |
  v
6. Rate Limiter
  |
  v
7. Auth Middleware (extract + verify JWT)
  |
  v
8. Role Guard (per-route)
  |
  v
9. Resource Guard (per-route)
  |
  v
10. Route Handler
  |
  v
11. Error Handler
  |
  v
Response
```

## 1. CORS Configuration

```typescript
import cors from 'cors';

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,          // e.g., "https://app.starteria.io"
      ...(process.env.NODE_ENV === 'development'
        ? ['http://localhost:5173', 'http://localhost:3000']
        : []),
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,               // Required for cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,                    // Preflight cache: 24 hours
};

app.use(cors(corsOptions));
```

## 2. Helmet Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Required for inline styles
      imgSrc: ["'self'", "data:", "blob:"],      // For evidence previews
      connectSrc: ["'self'", process.env.API_URL],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // Allow loading external images
  hsts: {
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' },
}));
```

**Headers set:**

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer info |
| `Content-Security-Policy` | (see above) | Prevent code injection |

## 3. Body Parser with Limits

```typescript
import express from 'express';

// JSON body parser - 1MB limit
app.use(express.json({ limit: '1mb' }));

// URL-encoded body parser - 1MB limit
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// For file uploads (evidence), use multer on specific routes only
import multer from 'multer';

const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024,  // 50MB max per file
    files: 5,                     // Max 5 files per request
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'video/mp4', 'video/quicktime',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  },
});
```

## 4. Request ID

```typescript
import { randomUUID } from 'crypto';

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
```

## 5. Request Logger

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.sub,
    });
  });
  next();
});
```

## 6. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Global API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 100,                   // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: {
    error: 'Demasiadas solicitudes. Intenta en un momento.',
  },
});

// Strict login rate limit
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 5,                     // 5 attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de inicio de sesion. Intenta en un minuto.',
  },
});

// Password reset rate limit
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: {
    error: 'Demasiados intentos. Intenta mas tarde.',
  },
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
```

## 7. Auth Middleware

Extracts and verifies the JWT access token from the `Authorization` header.

```typescript
import { verifyAccessToken } from '../services/token.service';

interface AuthenticatedUser {
  sub: string;
  role: Role;
  email: string;
  cohort?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      id: string;
    }
  }
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      sub: payload.sub,
      role: payload.role as Role,
      email: payload.email,
      cohort: payload.cohort,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token invalido' });
  }
}

// Optional auth - attaches user if token present, but doesn't fail
function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(authHeader.slice(7));
      req.user = {
        sub: payload.sub,
        role: payload.role as Role,
        email: payload.email,
        cohort: payload.cohort,
      };
    } catch {
      // Token invalid or expired - continue without user
    }
  }
  next();
}
```

## 8. Role Guard Middleware

Restricts access based on the user's role.

```typescript
type Role = 'owner' | 'mentor' | 'admin' | 'leader';

function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticacion requerida' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'No tienes permiso para acceder a este recurso',
      });
    }

    next();
  };
}

// Usage examples:
// router.get('/admin/users', authMiddleware, requireRole('admin'), adminController.listUsers);
// router.post('/projects', authMiddleware, requireRole('owner', 'admin'), projectController.create);
```

## 9. Resource Guard Middleware

Enforces resource-level access (e.g., "can this user access this project?").

```typescript
import { prisma } from '../lib/prisma';

function requireProjectAccess(...requiredLevels: AccessLevel[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticacion requerida' });
    }

    const projectId = req.params.projectId || req.params.id;
    if (!projectId) {
      return res.status(400).json({ error: 'ID de proyecto requerido' });
    }

    // Validate UUID format to prevent injection
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(projectId)) {
      return res.status(400).json({ error: 'ID de proyecto invalido' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        assignments: {
          select: { userId: true, role: true },
        },
        team: {
          select: { userId: true },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const accessLevel = resolveProjectAccess(req.user, project);

    if (accessLevel === 'none' || !requiredLevels.includes(accessLevel)) {
      return res.status(403).json({
        error: 'No tienes acceso a este proyecto',
      });
    }

    // Attach resolved access level for use in route handlers
    req.projectAccess = accessLevel;
    next();
  };
}

type AccessLevel = 'none' | 'read' | 'write' | 'admin';

function resolveProjectAccess(
  user: AuthenticatedUser,
  project: { ownerId: string; assignments: { userId: string; role: string }[]; team: { userId: string }[] }
): AccessLevel {
  if (user.role === 'admin') return 'admin';
  if (project.ownerId === user.sub) return 'write';
  if (project.assignments.some(a => a.userId === user.sub && a.role === 'mentor')) return 'read';
  if (project.assignments.some(a => a.userId === user.sub && a.role === 'leader')) return 'read';
  if (project.team.some(t => t.userId === user.sub)) return 'read';
  return 'none';
}

// Usage examples:
// router.get('/projects/:id', authMiddleware, requireProjectAccess('read', 'write', 'admin'), projectController.get);
// router.put('/projects/:id', authMiddleware, requireProjectAccess('write', 'admin'), projectController.update);
// router.delete('/projects/:id', authMiddleware, requireProjectAccess('admin'), projectController.delete);
```

## 10. Error Handler Middleware

Catches all errors and returns consistent JSON responses.

```typescript
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  // Log the error
  logger.error({
    requestId: req.id,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.sub,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos invalidos',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'El recurso ya existe' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
  }

  // Multer file errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo excede el tamano maximo permitido (50MB)' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Maximo 5 archivos por solicitud' });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500
      ? 'Error interno del servidor'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// Must be registered AFTER all routes
app.use(errorHandler);
```

## Complete App Setup

```typescript
import express from 'express';

const app = express();

// 1. CORS
app.use(cors(corsOptions));

// 2. Security headers
app.use(helmet(helmetOptions));

// 3. Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// 4. Request ID
app.use(requestIdMiddleware);

// 5. Request logger
app.use(requestLogger);

// 6. Rate limiters
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);

// 7-9. Auth + guards applied per-route (see route definitions)

// Routes
app.use('/api/auth', authRouter);                     // Public + loginLimiter
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/projects', authMiddleware, projectRouter);
app.use('/api/mentor', authMiddleware, requireRole('mentor', 'admin'), mentorRouter);
app.use('/api/admin', authMiddleware, requireRole('admin'), adminRouter);
app.use('/api/profile', authMiddleware, profileRouter);

// 11. Error handler (always last)
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});
```

## Route-Level Middleware Stacking Examples

```typescript
// Project routes with layered middleware
const projectRouter = Router();

// List projects - any authenticated user (filtered by role in controller)
projectRouter.get('/', projectController.list);

// Create project - owner or admin only
projectRouter.post('/',
  requireRole('owner', 'admin'),
  projectController.create
);

// Get single project - must have at least read access
projectRouter.get('/:id',
  requireProjectAccess('read', 'write', 'admin'),
  projectController.get
);

// Update project - must have write or admin access
projectRouter.put('/:id',
  requireProjectAccess('write', 'admin'),
  projectController.update
);

// Delete project - admin only
projectRouter.delete('/:id',
  requireRole('admin'),
  projectController.delete
);

// Upload evidence - owner or admin, with file validation
projectRouter.post('/:id/evidencias',
  requireProjectAccess('write', 'admin'),
  upload.array('files', 5),
  evidenceController.upload
);

// Verify evidence - mentor or admin on assigned project
projectRouter.post('/:id/evidencias/:evidenceId/verify',
  requireProjectAccess('read', 'admin'),  // mentor has 'read' on assigned
  requireRole('mentor', 'admin'),
  evidenceController.verify
);
```
