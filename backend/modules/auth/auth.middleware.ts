import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAccessToken } from './token.service';
import { AppError } from '../../shared/errors/AppError';
import { Role } from '../../shared/types/user.types';

// Extend Express Request with authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        cohort?: string;
      };
      projectAccess?: 'none' | 'read' | 'write' | 'admin';
    }
  }
}

const prisma = new PrismaClient();

/**
 * authenticate — Verify JWT access token and attach user to request.
 * Extracts Bearer token from Authorization header.
 * Returns 401 if missing, invalid, or expired.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Token de acceso requerido');
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      cohort: payload.cohort,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireRole — Check that the authenticated user has one of the required roles.
 * Must be used after `authenticate`.
 *
 * Usage: router.get('/admin', authenticate, requireRole('admin'), handler)
 */
export function requireRole(
  ...roles: Role[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Autenticacion requerida'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('No tienes permiso para acceder a este recurso'));
      return;
    }

    next();
  };
}

type AccessLevel = 'read' | 'write' | 'admin';

/**
 * requireProjectAccess — Check that the user has the required access level
 * to a specific project. Reads projectId from req.params.id or req.params.projectId.
 *
 * Resolves access based on:
 * - admin: always 'admin'
 * - owner (project creator): 'write'
 * - assigned mentor: 'read'
 * - assigned leader: 'read'
 * - team member: 'read'
 *
 * Must be used after `authenticate`.
 *
 * Usage: router.get('/projects/:id', authenticate, requireProjectAccess('read'), handler)
 */
export function requireProjectAccess(
  level: AccessLevel,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Autenticacion requerida');
      }

      const projectId = req.params.projectId || req.params.id;
      if (!projectId) {
        throw AppError.badRequest('ID de proyecto requerido');
      }

      // Validate UUID format to prevent injection
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(projectId)) {
        throw AppError.badRequest('ID de proyecto invalido');
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          teamMembers: { select: { userId: true, role: true } },
        },
      });

      if (!project) {
        throw AppError.notFound('Proyecto');
      }

      const resolvedAccess = resolveProjectAccess(req.user, project);

      if (resolvedAccess === 'none') {
        throw AppError.forbidden('No tienes acceso a este proyecto');
      }

      // Check if resolved level meets the required level
      const hierarchy: Record<string, number> = { read: 1, write: 2, admin: 3 };
      if (hierarchy[resolvedAccess] < hierarchy[level]) {
        throw AppError.forbidden('No tienes el nivel de acceso requerido');
      }

      req.projectAccess = resolvedAccess;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Resolve a user's access level to a project based on role and membership.
 */
function resolveProjectAccess(
  user: { id: string; role: Role },
  project: {
    id: string;
    teamMembers: Array<{ userId: string; role: string }>;
  },
): 'none' | 'read' | 'write' | 'admin' {
  if (user.role === 'admin') return 'admin';

  const isOwner = project.teamMembers.some(
    (m) => m.userId === user.id && m.role === 'OWNER',
  );
  if (isOwner) return 'write';

  const isMember = project.teamMembers.some((m) => m.userId === user.id);

  // Mentor role: read access to assigned projects
  if (user.role === 'mentor' && isMember) return 'read';

  // Leader role: read access to assigned projects
  if (user.role === 'leader' && isMember) return 'read';

  // General team member: read access
  if (isMember) return 'read';

  return 'none';
}
