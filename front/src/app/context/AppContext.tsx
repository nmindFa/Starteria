import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/auth.service';
import * as projectService from '../services/projectService';
import { initAuth, setAccessToken } from '../services/api';

export type Role = 'participante' | 'mentor' | 'admin' | 'sponsor' | 'colaborador' | 'viewer';

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
  isLoading: boolean;
  projects: Project[];
  currentProject: Project | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
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
  const fallbackName = inferNameFromEmail(normalizedEmail);

  return {
    id: `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: fallbackName,
    email: normalizedEmail,
    role,
    status: statusOverride ?? 'Pendiente',
    initials: inferInitials(fallbackName || normalizedEmail),
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


const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount via httpOnly refresh cookie
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        await initAuth();
        const backendUser = await authService.getMe();
        if (cancelled) return;
        setUser({
          id: backendUser.id,
          name: backendUser.name,
          email: backendUser.email,
          role: backendUser.role as Role,
          initials: backendUser.initials ?? backendUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          skills: [],
          cohort: backendUser.cohort ?? undefined,
        });
        setIsAuthenticated(true);
        // Load projects from backend
        try {
          const backendProjects = await projectService.list();
          if (!cancelled) setProjects(backendProjects as unknown as Project[]);
        } catch (err) {
          console.error('Error loading projects from backend:', err);
          // No fallback a mocks — mostrar estado vacío
        }
      } catch {
        // No valid session - user must login
        if (!cancelled) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authService.login(email, password);
      const u = result.user;
      setUser({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as Role,
        initials: u.initials ?? u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        skills: [],
        cohort: u.cohort ?? undefined,
      });
      setIsAuthenticated(true);
      // Load projects after login
      try {
        const backendProjects = await projectService.list();
        setProjects(backendProjects as unknown as Project[]);
      } catch (err) {
        console.error('Error loading projects from backend:', err);
        // No fallback a mocks — mostrar estado vacío
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de autenticación';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout errors
    }
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setCurrentProject(null);
    setProjects([]);
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
    setUser({ ...user, role });
  };

  return (
    <AppContext.Provider value={{ user, isAuthenticated, isLoading, projects, currentProject, login, logout, setCurrentProject, updateProject, createProject, setUserRole, updateStep0, getProjectMember, canAccessProject, markSponsorInvitationSent, acceptSponsorInvitation, updateSponsorTouchpoint, addSponsorComment }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
