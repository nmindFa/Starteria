import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Role = 'owner' | 'mentor' | 'admin' | 'leader';

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

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  status: 'Activo' | 'Pendiente';
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
  date?: string;
  status: 'Pendiente agendar' | 'Agendada' | 'Realizada';
  result?: 'Aprobado' | 'Iterar' | 'Bloqueado';
  comments?: string;
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

interface DemoStepApproval {
  step2Approved: boolean;
  step3Approved: boolean;
}

type DemoStepApprovals = Record<string, DemoStepApproval>;

interface DemoUnlockState {
  enabled: boolean;
  approvals: DemoStepApprovals;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  projects: Project[];
  currentProject: Project | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setCurrentProject: (project: Project | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  createProject: (name: string, description?: string) => Project;
  setUserRole: (role: Role) => void;
  updateStep0: (projectId: string, data: Partial<Step0Data>, status: Step0Status) => void;
  demoUnlockSteps: boolean;
  setDemoUnlockSteps: (enabled: boolean) => void;
  demoStepApprovals: DemoStepApprovals;
  isDemoMode: boolean;
  isStepDemoApproved: (projectId: string, stepNumber: 2 | 3) => boolean;
  demoApproveStep: (projectId: string, stepNumber: 2 | 3) => void;
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
  'lider@starteria.io': {
    password: 'demo123',
    user: {
      id: 'u4',
      name: 'Roberto Jiménez',
      email: 'lider@starteria.io',
      role: 'leader',
      initials: 'RJ',
      skills: ['Liderazgo', 'Transformación digital'],
    },
  },
};

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
          { id: 'C', name: 'Restricciones', status: 'En progreso' },
          { id: 'D', name: 'Actores y entrevistas', status: 'Bloqueado' },
          { id: 'S', name: 'Síntesis y revisión de rumbo', status: 'Bloqueado' },
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
          { id: 'C', name: 'Restricciones', status: 'Aprobado' },
          { id: 'D', name: 'Actores y entrevistas', status: 'Aprobado' },
          { id: 'S', name: 'Síntesis y revisión de rumbo', status: 'Aprobado' },
        ],
        feedbackIA: {
          status: 'Aprobado',
          summary: 'El análisis del proceso actual está bien documentado. Las métricas son sólidas y tienen contexto real.',
          goodPoints: ['Caso real bien contextualizado con recorrido completo', 'Métrica operativa con línea base definida (8 horas semanales)', 'Restricciones identificadas con claridad'],
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
    steps: [
      {
        number: 1,
        name: 'Claridad en el desafío',
        status: 'No iniciado',
        progress: 0,
        modules: [
          { id: 'A', name: 'Proceso actual', status: 'Draft' },
          { id: 'B', name: 'Medición e impacto', status: 'Bloqueado' },
          { id: 'C', name: 'Restricciones', status: 'Bloqueado' },
          { id: 'D', name: 'Actores y entrevistas', status: 'Bloqueado' },
          { id: 'S', name: 'Síntesis y revisión de rumbo', status: 'Bloqueado' },
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

const DEMO_UNLOCK_STORAGE_KEY = 'starteria-demo-unlock-steps';

const emptyApproval = (): DemoStepApproval => ({
  step2Approved: false,
  step3Approved: false,
});

const normalizeApproval = (value: unknown): DemoStepApproval => {
  if (!value || typeof value !== 'object') return emptyApproval();
  const candidate = value as Partial<DemoStepApproval>;
  return {
    step2Approved: candidate.step2Approved === true,
    step3Approved: candidate.step3Approved === true,
  };
};

const normalizeApprovalsMap = (value: unknown): DemoStepApprovals => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).map(([projectId, approval]) => [
    projectId,
    normalizeApproval(approval),
  ]);
  return Object.fromEntries(entries);
};

const readDemoUnlockState = (): DemoUnlockState => {
  if (typeof window === 'undefined') return { enabled: false, approvals: {} };

  const raw = localStorage.getItem(DEMO_UNLOCK_STORAGE_KEY);
  if (!raw) return { enabled: false, approvals: {} };

  // Backward compatibility with older boolean value.
  if (raw === 'true' || raw === 'false') {
    return { enabled: raw === 'true', approvals: {} };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed === 'boolean') {
      return { enabled: parsed, approvals: {} };
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const maybeState = parsed as { enabled?: unknown; approvals?: unknown };
      const hasStateShape = Object.prototype.hasOwnProperty.call(maybeState, 'enabled')
        || Object.prototype.hasOwnProperty.call(maybeState, 'approvals');

      if (hasStateShape) {
        return {
          enabled: maybeState.enabled === true,
          approvals: normalizeApprovalsMap(maybeState.approvals),
        };
      }

      // Compatibility if the stored object is directly { [projectId]: { ... } }.
      return {
        enabled: false,
        approvals: normalizeApprovalsMap(parsed),
      };
    }
  } catch {
    return { enabled: false, approvals: {} };
  }

  return { enabled: false, approvals: {} };
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [demoUnlockState, setDemoUnlockState] = useState<DemoUnlockState>(readDemoUnlockState);
  const demoUnlockSteps = demoUnlockState.enabled;
  const demoStepApprovals = demoUnlockState.approvals;

  const setDemoUnlockSteps = (enabled: boolean) => {
    setDemoUnlockState(prev => ({ ...prev, enabled }));
  };

  const isDemoMode = (
    import.meta.env.VITE_DEMO_MODE === 'true'
    || (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  );

  const isStepDemoApproved = (projectId: string, stepNumber: 2 | 3): boolean => {
    const approval = demoStepApprovals[projectId];
    if (!approval) return false;
    return stepNumber === 2 ? approval.step2Approved : approval.step3Approved;
  };

  const demoApproveStep = (projectId: string, stepNumber: 2 | 3) => {
    if (!isDemoMode) return;
    setDemoUnlockState(prev => {
      const currentApproval = prev.approvals[projectId] ?? emptyApproval();
      const nextApproval: DemoStepApproval = {
        ...currentApproval,
        step2Approved: stepNumber === 2 ? true : currentApproval.step2Approved,
        step3Approved: stepNumber === 3 ? true : currentApproval.step3Approved,
      };

      return {
        ...prev,
        approvals: {
          ...prev.approvals,
          [projectId]: nextApproval,
        },
      };
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DEMO_UNLOCK_STORAGE_KEY, JSON.stringify(demoUnlockState));
  }, [demoUnlockState]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const entry = MOCK_USERS[email.toLowerCase()];
    if (!entry) return { success: false, error: 'No existe una cuenta con ese correo.' };
    if (entry.password !== password) return { success: false, error: 'Contraseña incorrecta. Vuelve a intentar.' };
    setUser(entry.user);
    setIsAuthenticated(true);
    return { success: true };
  };

  const logout = () => {
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

  const updateStep0 = (projectId: string, data: Partial<Step0Data>, status: Step0Status) => {
    updateProject(projectId, { step0Data: data, step0Status: status });
  };

  const createProject = (name: string, description?: string): Project => {
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
      steps: [
        {
          number: 1, name: 'Claridad en el desafío', status: 'No iniciado', progress: 0, modules: [
            { id: 'A', name: 'Proceso actual', status: 'Draft' },
            { id: 'B', name: 'Medición e impacto', status: 'Bloqueado' },
            { id: 'C', name: 'Restricciones', status: 'Bloqueado' },
            { id: 'D', name: 'Actores y entrevistas', status: 'Bloqueado' },
            { id: 'S', name: 'Síntesis y revisión de rumbo', status: 'Bloqueado' },
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
      team: user ? [{ id: user.id, name: user.name, email: user.email, role: 'Owner', status: 'Activo', initials: user.initials }] : [],
      evidence: [],
      createdAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString(),
    };
    setProjects(prev => [newProject, ...prev]);
    return newProject;
  };

  const setUserRole = (role: Role) => {
    if (user) setUser({ ...user, role });
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        projects,
        currentProject,
        login,
        logout,
        setCurrentProject,
        updateProject,
        createProject,
        setUserRole,
        updateStep0,
        demoUnlockSteps,
        setDemoUnlockSteps,
        demoStepApprovals,
        isDemoMode,
        isStepDemoApproved,
        demoApproveStep,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
