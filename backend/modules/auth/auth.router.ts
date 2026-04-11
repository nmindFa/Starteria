import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { authenticate } from './auth.middleware';
import { validate } from '../../shared/middleware/validate';
import { registerSchema, loginSchema } from './auth.schemas';
import { loginLimiter } from './rate-limiter';

// Dependencies: cookie-parser must be applied at app level for req.cookies
const service = new AuthService(prisma);
const controller = new AuthController(service);

export const authRouter = Router();

// POST /api/v1/auth/register — Register new user (owner only)
authRouter.post('/register', validate(registerSchema), controller.register);

// POST /api/v1/auth/login — Login with email/password (rate-limited)
authRouter.post('/login', loginLimiter, validate(loginSchema), controller.login);

// POST /api/v1/auth/refresh — Refresh access token via HTTP-only cookie
authRouter.post('/refresh', controller.refresh);

// POST /api/v1/auth/logout — Logout and invalidate refresh token family
authRouter.post('/logout', authenticate, controller.logout);

// GET  /api/v1/auth/me — Get current authenticated user
authRouter.get('/me', authenticate, controller.me);
