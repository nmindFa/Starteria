import { ProjectStatus, StepStatus, ModuleStatus } from '../../shared/types';
import { AppError } from '../../shared/errors/AppError';
import { Role } from '../../shared/types/user.types';

const projectTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  'Draft': ['En progreso'],
  'En progreso': ['En revision IA'],
  'En revision IA': ['Iteracion', 'Sesion experto pendiente'],
  'Iteracion': ['En progreso'],
  'Sesion experto pendiente': ['Paso aprobado', 'Iteracion'],
  'Paso aprobado': ['En progreso', 'Finalizado'],
  'Finalizado': [],
};

const stepTransitions: Record<StepStatus, StepStatus[]> = {
  'No iniciado': ['En progreso'],
  'En progreso': ['Enviado'],
  'Enviado': ['Feedback IA'],
  'Feedback IA': ['Ajustado', 'Bloqueado'],
  'Ajustado': ['Sesion experto pendiente'],
  'Sesion experto pendiente': ['Aprobado', 'En progreso', 'Bloqueado'],
  'Aprobado': [],
  'Bloqueado': ['En progreso'],
};

const moduleTransitions: Record<ModuleStatus, ModuleStatus[]> = {
  'Draft': ['En progreso'],
  'En progreso': ['Completado', 'Enviado'],
  'Completado': ['En progreso'],
  'Bloqueado': ['En progreso'],
  'Enviado': ['Feedback IA'],
  'Feedback IA': ['Ajustado', 'Bloqueado'],
  'Ajustado': ['Aprobado', 'En progreso'],
  'Aprobado': [],
};

export function canTransitionProject(current: ProjectStatus, next: ProjectStatus): boolean {
  return projectTransitions[current]?.includes(next) ?? false;
}

export function canTransitionStep(current: StepStatus, next: StepStatus): boolean {
  return stepTransitions[current]?.includes(next) ?? false;
}

export function canTransitionModule(current: ModuleStatus, next: ModuleStatus): boolean {
  return moduleTransitions[current]?.includes(next) ?? false;
}

type EntityType = 'project' | 'step' | 'module';

export function validateTransition(
  entity: EntityType,
  current: string,
  next: string
): void {
  let valid = false;

  switch (entity) {
    case 'project':
      valid = canTransitionProject(current as ProjectStatus, next as ProjectStatus);
      break;
    case 'step':
      valid = canTransitionStep(current as StepStatus, next as StepStatus);
      break;
    case 'module':
      valid = canTransitionModule(current as ModuleStatus, next as ModuleStatus);
      break;
  }

  if (!valid) {
    throw AppError.badRequest(
      `Transicion invalida para ${entity}: "${current}" -> "${next}"`,
      'INVALID_TRANSITION'
    );
  }
}

// ---------------------------------------------------------------------------
// Role-gated transition guards (ADR-009)
// ---------------------------------------------------------------------------

export interface TransitionContext {
  entity: 'project' | 'step' | 'module';
  currentStatus: string;
  targetStatus: string;
  actorRole: Role;
  actorId: string;
  projectId: string;
  stepNumber?: number;
  moduleId?: string;
  metadata?: {
    isProjectOwner: boolean;
    isSponsorCheckpointStep: boolean;
    sponsorValidationStatus?: 'pending' | 'approved' | 'flagged' | 'expired' | 'skipped';
    mentorSessionResult?: 'APPROVED' | 'ITERATE' | 'BLOCKED';
    colaboradorPermissions?: string[];
  };
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  requiredActions?: string[];
}

/**
 * Maps entity:currentStatus:targetStatus to the roles allowed to perform that
 * transition. An empty array means the transition is SYSTEM-only (no human
 * role may trigger it).
 *
 * Status values use the Spanish labels defined in project.types.ts.
 */
const roleTransitionMap: Record<string, Role[]> = {
  // Step transitions
  'step:No iniciado:En progreso':                     ['participante', 'admin'],
  'step:En progreso:Enviado':                         ['participante', 'admin'],
  'step:Enviado:Feedback IA':                         [], // SYSTEM only
  'step:Feedback IA:Ajustado':                        ['participante', 'admin'],
  'step:Feedback IA:Bloqueado':                       ['mentor', 'admin'],
  'step:Ajustado:Sesion experto pendiente':           ['participante', 'admin'],
  'step:Sesion experto pendiente:Aprobado':           ['mentor', 'admin'],
  'step:Sesion experto pendiente:En progreso':        ['mentor', 'admin'],
  'step:Sesion experto pendiente:Bloqueado':          ['mentor', 'admin'],
  'step:Bloqueado:En progreso':                       ['mentor', 'admin'],

  // Module transitions
  'module:Draft:En progreso':                         ['participante', 'admin', 'colaborador'],
  'module:Bloqueado:En progreso':                     ['participante', 'admin', 'colaborador'],
  'module:En progreso:Completado':                    ['participante', 'admin', 'colaborador'],
  'module:En progreso:Enviado':                       ['participante', 'admin'],
  'module:Completado:En progreso':                    ['participante', 'admin'],
  'module:Enviado:Feedback IA':                       [], // SYSTEM only
  'module:Feedback IA:Ajustado':                      ['participante', 'admin'],
  'module:Feedback IA:Bloqueado':                     ['mentor', 'admin'],
  'module:Ajustado:Aprobado':                         ['mentor', 'admin'],
  'module:Ajustado:En progreso':                      ['participante', 'admin'],

  // Project transitions
  'project:Draft:En progreso':                        ['participante', 'admin'],
  'project:En progreso:En revision IA':               [], // SYSTEM
  'project:En revision IA:Iteracion':                 [], // SYSTEM
  'project:En revision IA:Sesion experto pendiente':  ['participante', 'admin'],
  'project:Iteracion:En progreso':                    ['participante', 'admin'],
  'project:Sesion experto pendiente:Paso aprobado':   ['mentor', 'admin'],
  'project:Sesion experto pendiente:Iteracion':       ['mentor', 'admin'],
  'project:Paso aprobado:En progreso':                ['participante', 'admin'],
  'project:Paso aprobado:Finalizado':                 ['mentor', 'admin'],
};

// ---------------------------------------------------------------------------
// Composite guards
// ---------------------------------------------------------------------------

type TransitionGuard = (ctx: TransitionContext) => TransitionResult;

function guardViewerReadOnly(ctx: TransitionContext): TransitionResult {
  if (ctx.actorRole === 'viewer') {
    return { allowed: false, reason: 'Viewers tienen acceso de solo lectura' };
  }
  return { allowed: true };
}

function guardNoSelfApproval(ctx: TransitionContext): TransitionResult {
  if (ctx.actorRole !== 'participante') return { allowed: true };
  if (['Aprobado', 'Paso aprobado', 'Finalizado'].includes(ctx.targetStatus)) {
    return { allowed: false, reason: 'Participantes no pueden aprobar sus propios steps o proyectos' };
  }
  return { allowed: true };
}

function guardColaboradorModuleAccess(ctx: TransitionContext): TransitionResult {
  if (ctx.actorRole !== 'colaborador') return { allowed: true };
  const permissions = ctx.metadata?.colaboradorPermissions ?? [];
  if (ctx.entity === 'module' && ctx.moduleId && !permissions.includes(ctx.moduleId)) {
    return { allowed: false, reason: 'Colaborador no tiene permiso para este modulo' };
  }
  return { allowed: true };
}

function guardSponsorCheckpoint(ctx: TransitionContext): TransitionResult {
  if (ctx.entity !== 'step' || ctx.targetStatus !== 'Aprobado') return { allowed: true };
  const checkpointSteps = [0, 2, 4];
  if (!checkpointSteps.includes(ctx.stepNumber ?? -1)) return { allowed: true };
  if (!ctx.metadata?.isSponsorCheckpointStep) return { allowed: true };
  if (ctx.metadata.sponsorValidationStatus === 'pending') {
    return {
      allowed: false,
      reason: 'Validacion del sponsor pendiente para este checkpoint',
      requiredActions: ['sponsor_validation_pending'],
    };
  }
  return { allowed: true };
}

const transitionGuards: TransitionGuard[] = [
  guardViewerReadOnly,
  guardNoSelfApproval,
  guardColaboradorModuleAccess,
  guardSponsorCheckpoint,
];

// ---------------------------------------------------------------------------
// Main role-gated validation
// ---------------------------------------------------------------------------

export function validateTransitionWithRole(ctx: TransitionContext): void {
  // 1. Structural validation (existing logic)
  const entityMap = {
    project: 'project' as const,
    step: 'step' as const,
    module: 'module' as const,
  };
  validateTransition(entityMap[ctx.entity], ctx.currentStatus, ctx.targetStatus);

  // 2. Role authorization
  const key = `${ctx.entity}:${ctx.currentStatus}:${ctx.targetStatus}`;
  const allowedRoles = roleTransitionMap[key];

  if (!allowedRoles) {
    throw AppError.badRequest(`Transicion no configurada: ${key}`, 'TRANSITION_NOT_CONFIGURED');
  }

  if (allowedRoles.length === 0) {
    throw AppError.forbidden('Esta transicion solo puede ser ejecutada por el sistema', 'SYSTEM_ONLY_TRANSITION');
  }

  if (!allowedRoles.includes(ctx.actorRole)) {
    throw AppError.forbidden(
      `El rol "${ctx.actorRole}" no puede ejecutar la transicion: ${ctx.currentStatus} -> ${ctx.targetStatus}`,
      'ROLE_NOT_AUTHORIZED',
    );
  }

  // 3. Composite guards
  for (const guard of transitionGuards) {
    const result = guard(ctx);
    if (!result.allowed) {
      throw AppError.forbidden(result.reason ?? 'Transicion bloqueada', 'GUARD_REJECTED');
    }
  }
}
