import { TeamMember } from './user.types';

export type Step0Status = 'No iniciado' | 'En progreso' | 'Completado';

export type ProjectStatus =
  | 'Draft'
  | 'En progreso'
  | 'En revision IA'
  | 'Iteracion'
  | 'Sesion experto pendiente'
  | 'Paso aprobado'
  | 'Finalizado';

export type StepStatus =
  | 'No iniciado'
  | 'En progreso'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Sesion experto pendiente'
  | 'Aprobado'
  | 'Bloqueado';

export type ModuleStatus =
  | 'Draft'
  | 'En progreso'
  | 'Completado'
  | 'Bloqueado'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Aprobado';

export type RunStatus = 'Draft' | 'En ejecucion' | 'Cerrado' | 'Revisar cambios';
export type EvidenceStatus = 'Subida' | 'Verificada' | 'Rechazada';

export interface Step0Data {
  nombreParticipante: string;
  rolArea: string;
  origen: '' | 'problema' | 'oportunidad' | 'idea' | 'explorando' | 'otra';
  quePasaQueQuieres: string;
  impacta: string[];
  parteProceso: '' | 'antes' | 'durante' | 'despues' | 'transversal' | 'otra';
  impacto3meses: '' | 'ingresos' | 'costos' | 'riesgo' | 'cliente' | 'productividad' | 'no_claro' | 'otro';
  respaldo: '' | 'datos' | 'testimonios' | 'benchmark' | 'hipotesis' | 'otro';
  quienEscuchar: string;
  siMinimo: string[];
}

export interface Evidence {
  id: string;
  name: string;
  type: 'Imagen' | 'PDF' | 'Video' | 'Link' | 'Otro';
  size?: string;
  url?: string;
  stepRef: number;
  moduleRef?: string;
  owner: string;
  date: string;
  status: EvidenceStatus;
}

export interface Run {
  id: string;
  name: string;
  status: RunStatus;
  createdAt: string;
  metrics?: { name: string; expected: string; actual?: string; passed?: boolean }[];
  learningCard?: {
    what: string;
    learned: string;
    decision: 'Iterar' | 'Pivot' | 'Kill' | null;
  };
}

export interface FeedbackIA {
  status: 'Aprobado' | 'Iterar' | 'Bloqueado';
  summary: string;
  goodPoints: string[];
  missing: string[];
  actions: string[];
  questions: string[];
  contradictions?: string[];
  timestamp: string;
}

export interface MentorSession {
  id: string;
  mentor: string;
  date?: string;
  status: 'Pendiente agendar' | 'Agendada' | 'Realizada';
  result?: 'Aprobado' | 'Iterar' | 'Bloqueado';
  comments?: string;
}

export interface Module {
  id: string;
  name: string;
  status: ModuleStatus;
}

export interface Step {
  number: 1 | 2 | 3 | 4;
  name: string;
  status: StepStatus;
  progress: number;
  modules: Module[];
  feedbackIA?: FeedbackIA | null;
  mentorSession?: MentorSession | null;
  runs?: Run[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  currentStep: number;
  step0Status: Step0Status;
  step0Data?: Partial<Step0Data>;
  mentorCredits: number;
  steps: Step[];
  team: TeamMember[];
  evidence: Evidence[];
  createdAt: string;
  lastModified: string;
  cohort?: string;
  riskLevel?: 'Bajo' | 'Medio' | 'Alto';
}
