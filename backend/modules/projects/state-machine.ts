import { ProjectStatus, StepStatus, ModuleStatus } from '../../shared/types';
import { AppError } from '../../shared/errors/AppError';

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
