/* ------------------------------------------------------------------ */
/*  project.adapter.ts - Bidirectional enum mapping & entity adapters  */
/* ------------------------------------------------------------------ */

// ---------- Enum maps: Backend (UPPER_SNAKE) <-> Frontend (Spanish) ----------

const PROJECT_STATUS_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'En progreso',
  AI_REVIEW: 'En revision IA',
  ITERATION: 'Iteracion',
  EXPERT_SESSION_PENDING: 'Sesion experto pendiente',
  STEP_APPROVED: 'Paso aprobado',
  COMPLETED: 'Finalizado',
};

const STEP_STATUS_MAP: Record<string, string> = {
  NOT_STARTED: 'No iniciado',
  IN_PROGRESS: 'En progreso',
  SUBMITTED: 'Enviado',
  AI_FEEDBACK: 'Feedback IA',
  ADJUSTED: 'Ajustado',
  EXPERT_SESSION_PENDING: 'Sesion experto pendiente',
  APPROVED: 'Aprobado',
  BLOCKED: 'Bloqueado',
};

const MODULE_STATUS_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
  BLOCKED: 'Bloqueado',
  SUBMITTED: 'Enviado',
  AI_FEEDBACK: 'Feedback IA',
  ADJUSTED: 'Ajustado',
  APPROVED: 'Aprobado',
};

const STEP0_STATUS_MAP: Record<string, string> = {
  NOT_STARTED: 'No iniciado',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
};

// Build reverse maps lazily
function invertMap(map: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    inverted[value] = key;
  }
  return inverted;
}

const PROJECT_STATUS_REVERSE = invertMap(PROJECT_STATUS_MAP);
const STEP_STATUS_REVERSE = invertMap(STEP_STATUS_MAP);
const MODULE_STATUS_REVERSE = invertMap(MODULE_STATUS_MAP);
const STEP0_STATUS_REVERSE = invertMap(STEP0_STATUS_MAP);

// ---------- Status adapters ----------

export function adaptProjectStatus(backend: string): string {
  return PROJECT_STATUS_MAP[backend] ?? backend;
}

export function adaptProjectStatusToBackend(frontend: string): string {
  return PROJECT_STATUS_REVERSE[frontend] ?? frontend;
}

export function adaptStepStatus(backend: string): string {
  return STEP_STATUS_MAP[backend] ?? backend;
}

export function adaptStepStatusToBackend(frontend: string): string {
  return STEP_STATUS_REVERSE[frontend] ?? frontend;
}

export function adaptModuleStatus(backend: string): string {
  return MODULE_STATUS_MAP[backend] ?? backend;
}

export function adaptModuleStatusToBackend(frontend: string): string {
  return MODULE_STATUS_REVERSE[frontend] ?? frontend;
}

export function adaptStep0Status(backend: string): string {
  return STEP0_STATUS_MAP[backend] ?? backend;
}

export function adaptStep0StatusToBackend(frontend: string): string {
  return STEP0_STATUS_REVERSE[frontend] ?? frontend;
}

// ---------- Entity types (minimal backend shapes) ----------

export interface BackendProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  position?: number;
  currentStep?: number;
  steps?: BackendStep[];
  modules?: BackendModule[];
  team?: unknown[];
  evidence?: unknown[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface BackendStep {
  id: string;
  stepNumber: number;
  title?: string;
  status: string;
  modules?: BackendModule[];
  [key: string]: unknown;
}

export interface BackendModule {
  id: string;
  title?: string;
  status: string;
  [key: string]: unknown;
}

// ---------- Adapted frontend shapes ----------

export interface FrontendProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  position?: number;
  currentStep?: number;
  steps?: FrontendStep[];
  modules?: FrontendModule[];
  team?: unknown[];
  evidence?: unknown[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface FrontendStep {
  id: string;
  stepNumber: number;
  title?: string;
  status: string;
  modules?: FrontendModule[];
  [key: string]: unknown;
}

export interface FrontendModule {
  id: string;
  title?: string;
  status: string;
  [key: string]: unknown;
}

// ---------- Entity adapters ----------

function adaptModules(modules?: BackendModule[]): FrontendModule[] | undefined {
  if (!modules) return undefined;
  return modules.map((m) => ({
    ...m,
    status: adaptModuleStatus(m.status),
  }));
}

function adaptSteps(steps?: BackendStep[]): FrontendStep[] | undefined {
  if (!steps) return undefined;
  return steps.map((s) => ({
    ...s,
    status: adaptStepStatus(s.status),
    modules: adaptModules(s.modules),
  }));
}

export function adaptProject(backend: BackendProject): FrontendProject {
  return {
    ...backend,
    status: adaptProjectStatus(backend.status),
    steps: adaptSteps(backend.steps),
    modules: adaptModules(backend.modules),
  };
}

export function adaptProjectToBackend(
  frontend: Partial<FrontendProject>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...frontend };

  if (frontend.status !== undefined) {
    result.status = adaptProjectStatusToBackend(frontend.status);
  }

  return result;
}

export function adaptStep(backend: BackendStep): FrontendStep {
  return {
    ...backend,
    status: adaptStepStatus(backend.status),
    modules: adaptModules(backend.modules),
  };
}
