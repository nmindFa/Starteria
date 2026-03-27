/**
 * Bidirectional mapping between frontend Spanish status strings
 * and Prisma database enum values.
 */

// ─── ProjectStatus ──────────────────────────────────────────────────────────

const projectStatusToDb = {
  Draft: 'DRAFT',
  'En progreso': 'IN_PROGRESS',
  'En revisión IA': 'AI_REVIEW',
  Iteración: 'ITERATION',
  'Sesión experto pendiente': 'EXPERT_SESSION_PENDING',
  'Paso aprobado': 'STEP_APPROVED',
  Finalizado: 'COMPLETED',
} as const;

const projectStatusToFrontend = Object.fromEntries(
  Object.entries(projectStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── StepStatus ─────────────────────────────────────────────────────────────

const stepStatusToDb = {
  'No iniciado': 'NOT_STARTED',
  'En progreso': 'IN_PROGRESS',
  Enviado: 'SUBMITTED',
  'Feedback IA': 'AI_FEEDBACK',
  Ajustado: 'ADJUSTED',
  'Sesión experto pendiente': 'EXPERT_SESSION_PENDING',
  Aprobado: 'APPROVED',
  Bloqueado: 'BLOCKED',
} as const;

const stepStatusToFrontend = Object.fromEntries(
  Object.entries(stepStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── ModuleStatus ───────────────────────────────────────────────────────────

const moduleStatusToDb = {
  Draft: 'DRAFT',
  'En progreso': 'IN_PROGRESS',
  Completado: 'COMPLETED',
  Bloqueado: 'BLOCKED',
  Enviado: 'SUBMITTED',
  'Feedback IA': 'AI_FEEDBACK',
  Ajustado: 'ADJUSTED',
  Aprobado: 'APPROVED',
} as const;

const moduleStatusToFrontend = Object.fromEntries(
  Object.entries(moduleStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── Step0Status ────────────────────────────────────────────────────────────

const step0StatusToDb = {
  'No iniciado': 'NOT_STARTED',
  'En progreso': 'IN_PROGRESS',
  Completado: 'COMPLETED',
} as const;

const step0StatusToFrontend = Object.fromEntries(
  Object.entries(step0StatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── RunStatus ──────────────────────────────────────────────────────────────

const runStatusToDb = {
  Draft: 'DRAFT',
  'En ejecución': 'RUNNING',
  Cerrado: 'CLOSED',
  'Revisar cambios': 'REVIEW_CHANGES',
} as const;

const runStatusToFrontend = Object.fromEntries(
  Object.entries(runStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── EvidenceStatus ─────────────────────────────────────────────────────────

const evidenceStatusToDb = {
  Subida: 'UPLOADED',
  Verificada: 'VERIFIED',
  Rechazada: 'REJECTED',
} as const;

const evidenceStatusToFrontend = Object.fromEntries(
  Object.entries(evidenceStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── EvidenceType ───────────────────────────────────────────────────────────

const evidenceTypeToDb = {
  Imagen: 'IMAGE',
  PDF: 'PDF',
  Video: 'VIDEO',
  Link: 'LINK',
  Otro: 'OTHER',
} as const;

const evidenceTypeToFrontend = Object.fromEntries(
  Object.entries(evidenceTypeToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── SessionStatus ──────────────────────────────────────────────────────────

const sessionStatusToDb = {
  'Pendiente agendar': 'PENDING_SCHEDULE',
  Agendada: 'SCHEDULED',
  Realizada: 'COMPLETED',
} as const;

const sessionStatusToFrontend = Object.fromEntries(
  Object.entries(sessionStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── SessionResult / FeedbackStatus ─────────────────────────────────────────

const resultStatusToDb = {
  Aprobado: 'APPROVED',
  Iterar: 'ITERATE',
  Bloqueado: 'BLOCKED',
} as const;

const resultStatusToFrontend = Object.fromEntries(
  Object.entries(resultStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── RiskLevel ──────────────────────────────────────────────────────────────

const riskLevelToDb = {
  Bajo: 'LOW',
  Medio: 'MEDIUM',
  Alto: 'HIGH',
} as const;

const riskLevelToFrontend = Object.fromEntries(
  Object.entries(riskLevelToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── TeamRole ───────────────────────────────────────────────────────────────

const teamRoleToDb = {
  Owner: 'OWNER',
  Editor: 'EDITOR',
  Viewer: 'VIEWER',
} as const;

const teamRoleToFrontend = Object.fromEntries(
  Object.entries(teamRoleToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── TeamMemberStatus ───────────────────────────────────────────────────────

const teamMemberStatusToDb = {
  Activo: 'ACTIVE',
  Pendiente: 'PENDING',
} as const;

const teamMemberStatusToFrontend = Object.fromEntries(
  Object.entries(teamMemberStatusToDb).map(([k, v]) => [v, k]),
) as Record<string, string>;

// ─── Exported mapper ────────────────────────────────────────────────────────

export const StatusMapper = {
  projectStatus: { toDb: projectStatusToDb, toFrontend: projectStatusToFrontend },
  stepStatus: { toDb: stepStatusToDb, toFrontend: stepStatusToFrontend },
  moduleStatus: { toDb: moduleStatusToDb, toFrontend: moduleStatusToFrontend },
  step0Status: { toDb: step0StatusToDb, toFrontend: step0StatusToFrontend },
  runStatus: { toDb: runStatusToDb, toFrontend: runStatusToFrontend },
  evidenceStatus: { toDb: evidenceStatusToDb, toFrontend: evidenceStatusToFrontend },
  evidenceType: { toDb: evidenceTypeToDb, toFrontend: evidenceTypeToFrontend },
  sessionStatus: { toDb: sessionStatusToDb, toFrontend: sessionStatusToFrontend },
  resultStatus: { toDb: resultStatusToDb, toFrontend: resultStatusToFrontend },
  riskLevel: { toDb: riskLevelToDb, toFrontend: riskLevelToFrontend },
  teamRole: { toDb: teamRoleToDb, toFrontend: teamRoleToFrontend },
  teamMemberStatus: { toDb: teamMemberStatusToDb, toFrontend: teamMemberStatusToFrontend },
} as const;
