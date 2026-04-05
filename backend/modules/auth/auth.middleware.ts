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
 * Supports the 6-role model: admin, participante, mentor, sponsor, colaborador, viewer.
 */
function resolveProjectAccess(
  user: { id: string; role: Role },
  project: {
    id: string;
    teamMembers: Array<{ userId: string; role: string }>;
  },
): 'none' | 'read' | 'write' | 'admin' {
  // Admin: full access
  if (user.role === 'admin') return 'admin';

  // Participante (was owner): write access to own projects
  if (user.role === 'participante') {
    const isOwner = project.teamMembers.some(
      (m) => m.userId === user.id && m.role === 'OWNER',
    );
    if (isOwner) return 'write';
  }

  // Mentor: read access to assigned projects
  if (user.role === 'mentor') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'read';
  }

  // Sponsor: read access to projects they are assigned to
  if (user.role === 'sponsor') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'read';
  }

  // Colaborador: write access (module-level restrictions enforced by transition guards)
  if (user.role === 'colaborador') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'write';
  }

  // Viewer: read-only access
  if (user.role === 'viewer') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'read';
  }

  // General fallback: any team member gets read
  const isMember = project.teamMembers.some((m) => m.userId === user.id);
  if (isMember) return 'read';

  return 'none';
}

/**
 * requireTransitionAuth — Combines structural validation + role authorization + guards.
 * Must be used after `authenticate`.
 * Expects req.body to contain { currentStatus, status } for the transition.
 */
export function requireTransitionAuth(
  entity: 'project' | 'step' | 'module',
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Autenticacion requerida');
      }

      const { validateTransitionWithRole } = await import('../projects/state-machine');

      const projectId = req.params.projectId || req.params.id;
      const stepNumber = req.params.number ? Number(req.params.number) : undefined;
      const moduleId = req.params.moduleId;

      // Build metadata for guards
      let metadata;
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            teamMembers: {
              where: { userId: req.user.id },
              select: { role: true, modulePermissions: true },
            },
          },
        });

        const membership = project?.teamMembers[0];
        metadata = {
          isProjectOwner: membership?.role === 'OWNER',
          isSponsorCheckpointStep: [0, 2, 4].includes(stepNumber ?? -1),
          colaboradorPermissions: membership?.modulePermissions ?? [],
        };
      }

      validateTransitionWithRole({
        entity,
        currentStatus: req.body.currentStatus,
        targetStatus: req.body.status,
        actorRole: req.user.role,
        actorId: req.user.id,
        projectId: projectId || '',
        stepNumber,
        moduleId,
        metadata,
      });

      next();
    } catch (err) {
      next(err);
    }
  };
}
