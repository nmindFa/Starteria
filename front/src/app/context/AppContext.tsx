import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUser } from '../services/auth.service';
import { initAuth, getAccessToken } from '../services/api';

export type Role = 'owner' | 'mentor' | 'admin' | 'sponsor' | 'portfolio_lead';

export type Step0Status = 'No iniciado' | 'En progreso' | 'Completado';

export type ProjectStatus =
  | 'Draft'
  | 'En progreso'
  | 'En revisión IA'
  | 'Iteración'
  | 'Sesión experto pendiente'
  | 'Paso aprobado'
  | 'Finalizado';

export type StepStatus =
  | 'No iniciado'
  | 'En progreso'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Sesión experto pendiente'
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

export type RunStatus = 'Draft' | 'En ejecución' | 'Cerrado' | 'Revisar cambios';
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

export type TeamMemberRole = 'Owner' | 'Editor' | 'Viewer' | 'Sponsor';
export type TeamMemberStatus = 'Pendiente' | 'Enviado' | 'Activo';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  initials: string;
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
  learningCard?: { what: string; learned: string; decision: 'Iterar' | 'Pivot' | 'Kill' | null };
}

export interface Step {
  number: 1 | 2 | 3 | 4;
  name: string;
  status: StepStatus;
  progress: number;
  modules: { id: string; name: string; status: ModuleStatus }[];
  feedbackIA?: FeedbackIA | null;
  mentorSession?: MentorSession | null;
  runs?: Run[];
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
  mode?: 'meeting' | 'async_review';
  date?: string;
  status: 'Pendiente agendar' | 'Agendada' | 'Pendiente revisión' | 'Realizada';
  result?: 'Aprobado' | 'Iterar' | 'Bloqueado';
  comments?: string;
}

export type SponsorTouchpointId = 'step0' | 'step2' | 'step4';
export type SponsorTouchpointStatus =
  | 'Pendiente de convocatoria'
  | 'Revisión solicitada'
  | 'Sesión agendada'
  | 'Comentario enviado'
  | 'Cerrado';

export interface SponsorTouchpoint {
  id: SponsorTouchpointId;
  title: string;
  stageLabel: string;
  status: SponsorTouchpointStatus;
  date?: string;
  actionLabel: string;
}

export interface SponsorComment {
  id: string;
  touchpointId: SponsorTouchpointId;
  authorName: string;
  authorRole: 'Sponsor';
  message: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  currentStep: number;
  step0Status: Step0Status;
  step0Data?: Partial<Step0Data>;
  mentorCredits: number; // POR DEFINIR: cantidad, recarga y qué consume crédito
  steps: Step[];
  team: TeamMember[];
  sponsorTouchpoints?: SponsorTouchpoint[];
  sponsorComments?: SponsorComment[];
  evidence: Evidence[];
  createdAt: string;
  lastModified: string;
  cohort?: string;
  riskLevel?: 'Bajo' | 'Medio' | 'Alto';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  skills: string[];
  cohort?: string;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  projects: Project[];
  currentProject: Project | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  createProject: (name: string, description?: string, teamMembers?: TeamMember[]) => Project;
  setUserRole: (role: Role) => void;
  updateStep0: (projectId: string, data: Partial<Step0Data>, status: Step0Status) => void;
  getProjectMember: (projectId: string, email?: string) => TeamMember | null;
  canAccessProject: (projectId: string, accessLevel?: 'overview' | 'step' | 'evidence') => boolean;
  markSponsorInvitationSent: (projectId: string, sponsorEmail: string) => void;
  acceptSponsorInvitation: (projectId: string) => void;
  updateSponsorTouchpoint: (
    projectId: string,
    touchpointId: SponsorTouchpointId,
    updates: Partial<SponsorTouchpoint>
  ) => void;
  addSponsorComment: (projectId: string, touchpointId: SponsorTouchpointId, message: string) => void;
}

const MOCK_USERS: Record<string, { user: User; password: string }> = {
  'participante@starteria.io': {
    password: 'demo123',
    user: {
      id: 'u1',
      name: 'Ana Rodríguez',
      email: 'participante@starteria.io',
      role: 'owner',
      initials: 'AR',
      skills: ['Design Thinking', 'Facilitación', 'Investigación UX'],
      cohort: 'Cohorte 2025-A',
    },
  },
  'mentor@starteria.io': {
    password: 'demo123',
    user: {
      id: 'u2',
      name: 'Carlos Méndez',
      email: 'mentor@starteria.io',
      role: 'mentor',
      initials: 'CM',
      skills: ['Estrategia', 'Innovación', 'Gestión de producto'],
    },
  },
  'admin@starteria.io': {
    password: 'demo123',
    user: {
      id: 'u3',
      name: 'Laura Pérez',
      email: 'admin@starteria.io',
      role: 'admin',
      initials: 'LP',
      skills: ['Gestión de programas', 'Coaching', 'Facilitación'],
    },
  },
  'sponsor@starteria.io': {
    password: 'demo123',
    user: {
      id: 'u4',
      name: 'Roberto Jiménez',
      email: 'sponsor@starteria.io',
      role: 'sponsor',
      initials: 'RJ',
      skills: ['Liderazgo', 'Transformación digital'],
    },
  },
  'portfolio@starteria.io': {
    password: 'demo123',
    user: {
      id: 'u5',
      name: 'Valeria Castro',
      email: 'portfolio@starteria.io',
      role: 'portfolio_lead',
      initials: 'VC',
      skills: ['Portafolio', 'Estrategia', 'Gobernanza'],
    },
  },
};

const getKnownUserByEmail = (email: string) =>
  Object.values(MOCK_USERS).find(entry => entry.user.email.toLowerCase() === email.toLowerCase())?.user;

const inferNameFromEmail = (email: string) =>
  email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const inferInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

export function createTeamMember(
  email: string,
  role: TeamMemberRole,
  statusOverride?: TeamMemberStatus
): TeamMember {
  const normalizedEmail = email.trim().toLowerCase();
  const knownUser = getKnownUserByEmail(normalizedEmail);
  const fallbackName = inferNameFromEmail(normalizedEmail);

  return {
    id: `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: knownUser?.name ?? fallbackName,
    email: normalizedEmail,
    role,
    status: statusOverride ?? (knownUser ? 'Activo' : 'Pendiente'),
    initials: knownUser?.initials ?? inferInitials(fallbackName || normalizedEmail),
  };
}

export const DEFAULT_SPONSOR_TOUCHPOINTS: SponsorTouchpoint[] = [
  {
    id: 'step0',
    title: 'Alineamiento inicial',
    stageLabel: 'Step 0',
    status: 'Pendiente de convocatoria',
    actionLabel: 'Confirmar contexto inicial',
  },
  {
    id: 'step2',
    title: 'Revisión estratégica',
    stageLabel: 'Cierre Step 2',
    status: 'Pendiente de convocatoria',
    actionLabel: 'Revisar definición del problema',
  },
  {
    id: 'step4',
    title: 'Presentación final',
    stageLabel: 'Step 4',
    status: 'Pendiente de convocatoria',
    actionLabel: 'Preparar decisión final',
  },
];

const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Onboarding Digital',
    description: 'Reducir el tiempo de incorporación de nuevos empleados de 3 semanas a 5 días.',
    status: 'En progreso',
    currentStep: 1,
    cohort: 'Cohorte 2025-A',
    riskLevel: 'Medio',
    mentorCredits: 3,
    step0Status: 'Completado',
    sponsorTouchpoints: [
      {
        id: 'step0',
        title: 'Alineamiento inicial',
        stageLabel: 'Step 0',
        status: 'Cerrado',
        date: '2025-02-03',
        actionLabel: 'Validar contexto inicial',
      },
      {
        id: 'step2',
        title: 'Revisión estratégica',
        stageLabel: 'Cierre Step 2',
        status: 'Pendiente de convocatoria',
        actionLabel: 'Revisar definición del problema',
      },
      {
        id: 'step4',
        title: 'Presentación final',
        stageLabel: 'Step 4',
        status: 'Pendiente de convocatoria',
        actionLabel: 'Preparar decisión final',
      },
    ],
    sponsorComments: [
      {
        id: 'sc-1',
        touchpointId: 'step0',
        authorName: 'Roberto Jiménez',
        authorRole: 'Sponsor',
        message: 'El problema se entiende. Quiero ver una versión más acotada antes de pasar a solución.',
        createdAt: '2025-02-03',
      },
    ],
    step0Data: {
      nombreParticipante: 'Ana Rodríguez',
      rolArea: 'Gerente de Recursos Humanos · Talento',
      origen: 'problema',
      quePasaQueQuieres: 'El proceso de incorporación de empleados nuevos tarda entre 15 y 21 días. Mientras tanto, la persona no puede trabajar porque no tiene accesos ni herramientas.',
      impacta: ['Operaciones', 'TI', 'Gerencias'],
      parteProceso: 'durante',
      impacto3meses: 'productividad',
      respaldo: 'datos',
      quienEscuchar: 'La Directora de Operaciones, porque aprueba cambios que afectan a más de un área.',
      siMinimo: ['Reunión 30 min con el decisor correcto', 'Acceso a datos'],
    },
    steps: [
      {
        number: 1,
        name: 'Claridad en el desafío',
        status: 'En progreso',
        progress: 65,
        modules: [
          { id: 'A', name: 'Proceso actual', status: 'Completado' },
          { id: 'B', name: 'Medición e impacto', status: 'Completado' },
          { id: 'C', name: 'Captura de informacion y sintesis', status: 'En progreso' },
        ],
        feedbackIA: null,
        mentorSession: null,
      },
      {
        number: 2,
        name: 'Diseñar solución',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'A', name: '¿Cómo podríamos…?', status: 'Bloqueado' },
          { id: 'B', name: 'Explorar ideas', status: 'Bloqueado' },
          { id: 'C', name: 'Elegir la mejor opción', status: 'Bloqueado' },
          { id: 'D', name: 'Tarjetas de solución y prueba', status: 'Bloqueado' },
        ],
      },
      {
        number: 3,
        name: 'Probar en pequeño',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'R', name: 'Experimentos', status: 'Bloqueado' },
          { id: 'L', name: 'Tarjeta de aprendizaje', status: 'Bloqueado' },
        ],
        runs: [],
      },
      {
        number: 4,
        name: 'Contar la historia',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'S', name: 'Construcción del relato', status: 'Bloqueado' },
          { id: 'O', name: 'Resumen ejecutivo', status: 'Bloqueado' },
          { id: 'P', name: 'Presentación final', status: 'Bloqueado' },
        ],
      },
    ],
    team: [
      { id: 'm1', name: 'Ana Rodríguez', email: 'participante@starteria.io', role: 'Owner', status: 'Activo', initials: 'AR' },
      { id: 'm2', name: 'Miguel Torres', email: 'miguel@empresa.com', role: 'Editor', status: 'Activo', initials: 'MT' },
      { id: 'm3', name: 'Sofía Vargas', email: 'sofia@empresa.com', role: 'Editor', status: 'Pendiente', initials: 'SV' },
      { id: 'm3s', name: 'Roberto Jiménez', email: 'sponsor@starteria.io', role: 'Sponsor', status: 'Activo', initials: 'RJ' },
      { id: 'm3sp', name: 'Sponsor Finanzas', email: 'sponsor-finanzas@empresa.com', role: 'Sponsor', status: 'Pendiente', initials: 'SF' },
    ],
    evidence: [
      { id: 'e1', name: 'Mapa_proceso_actual.pdf', type: 'PDF', size: '2.4 MB', stepRef: 1, moduleRef: 'A', owner: 'Ana Rodríguez', date: '2025-02-15', status: 'Verificada' },
      { id: 'e2', name: 'Entrevista_RRHH_video.mp4', type: 'Video', size: '45 MB', stepRef: 1, moduleRef: 'A', owner: 'Miguel Torres', date: '2025-02-17', status: 'Subida' },
      { id: 'e3', name: 'Dashboard_metricas.png', type: 'Imagen', size: '890 KB', stepRef: 1, moduleRef: 'B', owner: 'Ana Rodríguez', date: '2025-02-18', status: 'Verificada' },
    ],
    createdAt: '2025-02-01',
    lastModified: '2025-02-19T10:30:00Z',
  },
  {
    id: 'p2',
    name: 'Portal de Reportes Automáticos',
    description: 'Automatizar la generación de reportes operativos que hoy toma 8 horas semanales.',
    status: 'Sesión experto pendiente',
    currentStep: 2,
    cohort: 'Cohorte 2025-A',
    riskLevel: 'Bajo',
    mentorCredits: 2,
    step0Status: 'Completado',
    sponsorTouchpoints: [
      {
        id: 'step0',
        title: 'Alineamiento inicial',
        stageLabel: 'Step 0',
        status: 'Cerrado',
        date: '2025-01-18',
        actionLabel: 'Validar contexto inicial',
      },
      {
        id: 'step2',
        title: 'Revisión estratégica',
        stageLabel: 'Cierre Step 2',
        status: 'Sesión agendada',
        date: '2025-02-20',
        actionLabel: 'Dar señal estratégica',
      },
      {
        id: 'step4',
        title: 'Presentación final',
        stageLabel: 'Step 4',
        status: 'Pendiente de convocatoria',
        actionLabel: 'Preparar decisión final',
      },
    ],
    sponsorComments: [],
    step0Data: {
      nombreParticipante: 'Pedro Alvarado',
      rolArea: 'Jefe de Análisis · Finanzas',
      origen: 'problema',
      quePasaQueQuieres: 'Generamos reportes operativos manualmente cada semana. Eso toma 8 horas de un analista y retrasa la toma de decisiones del directorio.',
      impacta: ['Gerencias', 'Finanzas'],
      parteProceso: 'durante',
      impacto3meses: 'productividad',
      respaldo: 'datos',
      quienEscuchar: 'El Director Financiero, quien lidera la iniciativa de eficiencia operativa.',
      siMinimo: ['Reunión 30 min con el decisor correcto', 'Acceso a datos'],
    },
    steps: [
      {
        number: 1,
        name: 'Claridad en el desafío',
        status: 'Aprobado',
        progress: 100,
        modules: [
          { id: 'A', name: 'Proceso actual', status: 'Aprobado' },
          { id: 'B', name: 'Medición e impacto', status: 'Aprobado' },
          { id: 'C', name: 'Captura de informacion y sintesis', status: 'Aprobado' },
        ],
        feedbackIA: {
          status: 'Aprobado',
          summary: 'El análisis del proceso actual está bien documentado. Las métricas son sólidas y tienen contexto real.',
          goodPoints: ['Caso real bien contextualizado con recorrido completo', 'Métrica operativa con línea base definida (8 horas semanales)', 'Hallazgos del campo consolidados con claridad'],
          missing: [],
          actions: [],
          questions: [],
          timestamp: '2025-02-10T09:00:00Z',
        },
        mentorSession: { id: 's1', mentor: 'Carlos Méndez', date: '2025-02-12', status: 'Realizada', result: 'Aprobado', comments: 'Excelente claridad del problema. Avanzar.' },
      },
      {
        number: 2,
        name: 'Diseñar solución',
        status: 'Sesión experto pendiente',
        progress: 85,
        modules: [
          { id: 'A', name: '¿Cómo podríamos…?', status: 'Aprobado' },
          { id: 'B', name: 'Explorar ideas', status: 'Aprobado' },
          { id: 'C', name: 'Elegir la mejor opción', status: 'Aprobado' },
          { id: 'D', name: 'Tarjetas de solución y prueba', status: 'Aprobado' },
        ],
        feedbackIA: {
          status: 'Aprobado',
          summary: 'La solución propuesta es coherente con el desafío identificado.',
          goodPoints: ['Pregunta "¿Cómo podríamos…?" bien alineada al reto', '12 ideas generadas y bien agrupadas', 'Matriz de decisión completa'],
          missing: [],
          actions: [],
          questions: ['¿Cómo validarán la hipótesis con usuarios reales antes del experimento?'],
          timestamp: '2025-02-18T14:00:00Z',
        },
        mentorSession: { id: 's2', mentor: 'Carlos Méndez', status: 'Pendiente agendar' },
      },
      {
        number: 3,
        name: 'Probar en pequeño',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'R', name: 'Experimentos', status: 'Bloqueado' },
          { id: 'L', name: 'Tarjeta de aprendizaje', status: 'Bloqueado' },
        ],
        runs: [],
      },
      {
        number: 4,
        name: 'Contar la historia',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'S', name: 'Construcción del relato', status: 'Bloqueado' },
          { id: 'O', name: 'Resumen ejecutivo', status: 'Bloqueado' },
          { id: 'P', name: 'Presentación final', status: 'Bloqueado' },
        ],
      },
    ],
    team: [
      { id: 'm4', name: 'Pedro Alvarado', email: 'pedro@empresa.com', role: 'Owner', status: 'Activo', initials: 'PA' },
      { id: 'm5', name: 'Claudia Ruiz', email: 'claudia@empresa.com', role: 'Editor', status: 'Activo', initials: 'CR' },
      { id: 'm5s', name: 'Roberto Jiménez', email: 'sponsor@starteria.io', role: 'Sponsor', status: 'Activo', initials: 'RJ' },
    ],
    evidence: [],
    createdAt: '2025-01-15',
    lastModified: '2025-02-18T16:00:00Z',
  },
  {
    id: 'p3',
    name: 'Reducir Tiempo de Cierre Mensual',
    description: 'El cierre contable tarda 10 días hábiles. El objetivo es reducirlo a 3 días.',
    status: 'Draft',
    currentStep: 1,
    cohort: 'Cohorte 2025-A',
    riskLevel: 'Alto',
    mentorCredits: 3,
    step0Status: 'No iniciado',
    sponsorTouchpoints: DEFAULT_SPONSOR_TOUCHPOINTS,
    sponsorComments: [],
    steps: [
      {
        number: 1,
        name: 'Claridad en el desafío',
        status: 'No iniciado',
        progress: 0,
        modules: [
          { id: 'A', name: 'Proceso actual', status: 'Draft' },
          { id: 'B', name: 'Medición e impacto', status: 'Bloqueado' },
          { id: 'C', name: 'Captura de informacion y sintesis', status: 'Bloqueado' },
        ],
      },
      {
        number: 2,
        name: 'Diseñar solución',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'A', name: '¿Cómo podríamos…?', status: 'Bloqueado' },
          { id: 'B', name: 'Explorar ideas', status: 'Bloqueado' },
          { id: 'C', name: 'Elegir la mejor opción', status: 'Bloqueado' },
          { id: 'D', name: 'Tarjetas de solución y prueba', status: 'Bloqueado' },
        ],
      },
      {
        number: 3,
        name: 'Probar en pequeño',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'R', name: 'Experimentos', status: 'Bloqueado' },
          { id: 'L', name: 'Tarjeta de aprendizaje', status: 'Bloqueado' },
        ],
        runs: [],
      },
      {
        number: 4,
        name: 'Contar la historia',
        status: 'Bloqueado',
        progress: 0,
        modules: [
          { id: 'S', name: 'Construcción del relato', status: 'Bloqueado' },
          { id: 'O', name: 'Resumen ejecutivo', status: 'Bloqueado' },
          { id: 'P', name: 'Presentación final', status: 'Bloqueado' },
        ],
      },
    ],
    team: [
      { id: 'm6', name: 'Ana Rodríguez', email: 'participante@starteria.io', role: 'Owner', status: 'Activo', initials: 'AR' },
    ],
    evidence: [],
    createdAt: '2025-02-19',
    lastModified: '2025-02-19T08:00:00Z',
  },
];

const AppContext = createContext<AppContextType | null>(null);

const BACKEND_TO_FRONTEND_ROLE: Record<string, Role> = {
  participante: 'owner',
  colaborador: 'owner',
  viewer: 'owner',
  mentor: 'mentor',
  admin: 'admin',
  sponsor: 'sponsor',
};

function mapBackendUser(raw: AuthUser): User {
  const mockMatch = getKnownUserByEmail(raw.email);
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: BACKEND_TO_FRONTEND_ROLE[raw.role] ?? 'owner',
    initials: raw.initials || inferInitials(raw.name),
    skills: mockMatch?.skills ?? [],
    cohort: raw.cohort ?? mockMatch?.cohort,
  };
}

function parseAuthError(err: unknown, fallback: string): string {
  const maybe = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
  return (
    maybe?.response?.data?.error?.message ??
    maybe?.response?.data?.message ??
    fallback
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        if (cancelled) return;
        if (getAccessToken()) {
          const me = await authService.getMe();
          if (cancelled) return;
          setUser(mapBackendUser(me));
          setIsAuthenticated(true);
        }
      } catch {
        // no session — stay logged out
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authService.login(email, password);
      setUser(mapBackendUser(result.user));
      setIsAuthenticated(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseAuthError(err, 'No pudimos iniciar sesión. Intenta de nuevo.') };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authService.register(name, email, password);
      setUser(mapBackendUser(result.user));
      setIsAuthenticated(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseAuthError(err, 'No pudimos crear la cuenta. Intenta de nuevo.') };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null);
    setIsAuthenticated(false);
    setCurrentProject(null);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...updates, lastModified: new Date().toISOString() } : p)));
    if (currentProject?.id === id) {
      setCurrentProject(prev => prev ? { ...prev, ...updates, lastModified: new Date().toISOString() } : null);
    }
  };

  const getProjectMember = (projectId: string, email = user?.email ?? ''): TeamMember | null => {
    const project = projects.find(item => item.id === projectId);
    if (!project || !email) return null;
    return project.team.find(member => member.email.toLowerCase() === email.toLowerCase()) ?? null;
  };

  const canAccessProject = (
    projectId: string,
    accessLevel: 'overview' | 'step' | 'evidence' = 'overview'
  ) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'mentor') return true;
    if (user.role === 'portfolio_lead') return false;

    const member = getProjectMember(projectId, user.email);
    if (!member) return false;

    if (user.role === 'sponsor') {
      if (member.role !== 'Sponsor') return false;
      if (accessLevel === 'overview') return member.status === 'Enviado' || member.status === 'Activo';
      return false;
    }

    return member.status === 'Activo';
  };

  const updateStep0 = (projectId: string, data: Partial<Step0Data>, status: Step0Status) => {
    updateProject(projectId, { step0Data: data, step0Status: status });
  };

  const markSponsorInvitationSent = (projectId: string, sponsorEmail: string) => {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      team: project.team.map(member =>
        member.role === 'Sponsor' && member.email.toLowerCase() === sponsorEmail.toLowerCase()
          ? { ...member, status: member.status === 'Activo' ? member.status : 'Enviado' }
          : member
      ),
    });
  };

  const acceptSponsorInvitation = (projectId: string) => {
    if (!user || user.role !== 'sponsor') return;
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      team: project.team.map(member =>
        member.role === 'Sponsor' && member.email.toLowerCase() === user.email.toLowerCase()
          ? { ...member, status: 'Activo' }
          : member
      ),
    });
  };

  const updateSponsorTouchpoint = (
    projectId: string,
    touchpointId: SponsorTouchpointId,
    updates: Partial<SponsorTouchpoint>
  ) => {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      sponsorTouchpoints: (project.sponsorTouchpoints ?? DEFAULT_SPONSOR_TOUCHPOINTS).map(item =>
        item.id === touchpointId ? { ...item, ...updates } : item
      ),
    });
  };

  const addSponsorComment = (projectId: string, touchpointId: SponsorTouchpointId, message: string) => {
    if (!user || user.role !== 'sponsor' || !message.trim()) return;
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    const newComment: SponsorComment = {
      id: `sc-${Date.now()}`,
      touchpointId,
      authorName: user.name,
      authorRole: 'Sponsor',
      message: message.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };

    updateProject(projectId, {
      sponsorComments: [...(project.sponsorComments ?? []), newComment],
      sponsorTouchpoints: (project.sponsorTouchpoints ?? DEFAULT_SPONSOR_TOUCHPOINTS).map(item =>
        item.id === touchpointId ? { ...item, status: 'Comentario enviado' } : item
      ),
    });
  };

  const createProject = (name: string, description?: string, teamMembers: TeamMember[] = []): Project => {
    const newProject: Project = {
      id: `p${Date.now()}`,
      name,
      description,
      status: 'Draft',
      currentStep: 1,
      step0Status: 'No iniciado',
      mentorCredits: 3,
      cohort: user?.cohort,
      riskLevel: 'Bajo',
      sponsorTouchpoints: DEFAULT_SPONSOR_TOUCHPOINTS,
      sponsorComments: [],
      steps: [
        {
          number: 1, name: 'Claridad en el desafío', status: 'No iniciado', progress: 0, modules: [
            { id: 'A', name: 'Proceso actual', status: 'Draft' },
            { id: 'B', name: 'Medición e impacto', status: 'Bloqueado' },
            { id: 'C', name: 'Captura de informacion y sintesis', status: 'Bloqueado' },
          ]
        },
        {
          number: 2, name: 'Diseñar solución', status: 'Bloqueado', progress: 0, modules: [
            { id: 'A', name: '¿Cómo podríamos…?', status: 'Bloqueado' },
            { id: 'B', name: 'Explorar ideas', status: 'Bloqueado' },
            { id: 'C', name: 'Elegir la mejor opción', status: 'Bloqueado' },
            { id: 'D', name: 'Tarjetas de solución y prueba', status: 'Bloqueado' },
          ]
        },
        {
          number: 3, name: 'Probar en pequeño', status: 'Bloqueado', progress: 0, modules: [
            { id: 'R', name: 'Experimentos', status: 'Bloqueado' },
            { id: 'L', name: 'Tarjeta de aprendizaje', status: 'Bloqueado' },
          ], runs: []
        },
        {
          number: 4, name: 'Contar la historia', status: 'Bloqueado', progress: 0, modules: [
            { id: 'S', name: 'Construcción del relato', status: 'Bloqueado' },
            { id: 'O', name: 'Resumen ejecutivo', status: 'Bloqueado' },
            { id: 'P', name: 'Presentación final', status: 'Bloqueado' },
          ]
        },
      ],
      team: user
        ? [
            { id: user.id, name: user.name, email: user.email, role: 'Owner', status: 'Activo', initials: user.initials },
            ...teamMembers,
          ]
        : teamMembers,
      evidence: [],
      createdAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString(),
    };
    setProjects(prev => [newProject, ...prev]);
    return newProject;
  };

  const setUserRole = (role: Role) => {
    if (!user) return;
    const matchedDemoUser = Object.values(MOCK_USERS).find(entry => entry.user.role === role)?.user;
    if (matchedDemoUser) {
      setUser(matchedDemoUser);
      return;
    }
    setUser({ ...user, role });
  };

  return (
    <AppContext.Provider value={{ user, isAuthenticated, authLoading, projects, currentProject, login, register, logout, setCurrentProject, updateProject, createProject, setUserRole, updateStep0, getProjectMember, canAccessProject, markSponsorInvitationSent, acceptSponsorInvitation, updateSponsorTouchpoint, addSponsorComment }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
