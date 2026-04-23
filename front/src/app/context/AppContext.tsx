import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUser } from '../services/auth.service';
import { initAuth, getAccessToken } from '../services/api';
import * as projectService from '../services/projectService';

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
  projectsLoading: boolean;
  currentProject: Project | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  createProject: (name: string, description?: string, teamMembers?: TeamMember[]) => Promise<{ success: true; project: Project } | { success: false; error: string }>;
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
  role: TeamMember['role'] = 'Editor',
  status: TeamMember['status'] = 'Pendiente',
  initials?: string
): TeamMember {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
  const fallbackName = inferNameFromEmail(normalizedEmail) || localPart;
  const derivedInitials = initials ?? localPart.slice(0, 2).toUpperCase();

  return {
    id: `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: fallbackName,
    email: normalizedEmail,
    role,
    status,
    initials: derivedInitials,
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

function enrichProject(raw: any, currentUser: User | null): Project {
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((s: any, idx: number) => ({
        ...s,
        number: s.number ?? s.stepNumber ?? idx,
        name: s.name ?? s.title ?? `Paso ${idx}`,
        status: s.status ?? 'No iniciado',
        progress: typeof s.progress === 'number' ? s.progress : 0,
        modules: Array.isArray(s.modules)
          ? s.modules.map((m: any) => ({ ...m, name: m.name ?? m.title ?? '' }))
          : [],
      }))
    : [];

  const capitalize = (r: string) =>
    r ? r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() : 'Editor';

  let team: TeamMember[] = Array.isArray(raw.team)
    ? raw.team.map((m: any) => ({
        id: m.id ?? `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: m.name ?? m.email?.split('@')[0] ?? '',
        email: m.email ?? '',
        role: capitalize(m.role ?? 'editor') as TeamMemberRole,
        status: (m.status ?? 'Activo') as TeamMemberStatus,
        initials:
          m.initials ?? (m.name ?? m.email ?? '').toString().slice(0, 2).toUpperCase(),
      }))
    : [];

  if (team.length === 0 && raw.ownerId && currentUser && raw.ownerId === currentUser.id) {
    team = [
      {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: 'Owner',
        status: 'Activo',
        initials: currentUser.initials,
      },
    ];
  }

  return {
    ...raw,
    steps,
    team,
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    sponsorTouchpoints: raw.sponsorTouchpoints ?? DEFAULT_SPONSOR_TOUCHPOINTS,
    sponsorComments: Array.isArray(raw.sponsorComments) ? raw.sponsorComments : [],
    lastModified: raw.lastModified ?? raw.updatedAt ?? new Date().toISOString(),
    riskLevel: raw.riskLevel ?? 'Bajo',
    mentorCredits: typeof raw.mentorCredits === 'number' ? raw.mentorCredits : 3,
    step0Status: raw.step0Status ?? 'No iniciado',
  } as unknown as Project;
}

const BACKEND_TO_FRONTEND_ROLE: Record<string, Role> = {
  participante: 'owner',
  colaborador: 'owner',
  viewer: 'owner',
  mentor: 'mentor',
  admin: 'admin',
  sponsor: 'sponsor',
};

function mapBackendUser(raw: AuthUser): User {
  const rawAny = raw as AuthUser & { cohortCode?: string | null };
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: BACKEND_TO_FRONTEND_ROLE[raw.role] ?? 'owner',
    initials: raw.initials || inferInitials(raw.name),
    skills: [],
    cohort: rawAny.cohortCode ?? raw.cohort ?? '',
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const loadProjects = async (currentUser: User | null) => {
    try {
      setProjectsLoading(true);
      const list = await projectService.list();
      setProjects(list.map(p => enrichProject(p, currentUser)));
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        if (cancelled) return;
        if (getAccessToken()) {
          const me = await authService.getMe();
          if (cancelled) return;
          const mappedUser = mapBackendUser(me);
          setUser(mappedUser);
          setIsAuthenticated(true);
          if (cancelled) return;
          await loadProjects(mappedUser);
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
      const mappedUser = mapBackendUser(result.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      await loadProjects(mappedUser);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseAuthError(err, 'No pudimos iniciar sesión. Intenta de nuevo.') };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await authService.register(name, email, password);
      const mappedUser = mapBackendUser(result.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      await loadProjects(mappedUser);
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

  const createProject = async (
    name: string,
    description?: string,
    teamMembers: TeamMember[] = []
  ): Promise<{ success: true; project: Project } | { success: false; error: string }> => {
    try {
      const response = await projectService.create({ name, description });
      const ownerMember: TeamMember | null = user
        ? { id: user.id, name: user.name, email: user.email, role: 'Owner', status: 'Activo', initials: user.initials }
        : null;
      const merged = {
        ...response,
        sponsorTouchpoints: DEFAULT_SPONSOR_TOUCHPOINTS,
        sponsorComments: [],
        team: ownerMember ? [ownerMember, ...teamMembers] : teamMembers,
        evidence: (response.evidence as Evidence[] | undefined) ?? [],
        lastModified: (response.lastModified as string | undefined) ?? new Date().toISOString(),
      } as unknown as Project;
      setProjects(prev => [merged, ...prev]);
      return { success: true, project: merged };
    } catch (err) {
      return { success: false, error: parseAuthError(err, 'No pudimos guardar tu proyecto. Intenta de nuevo.') };
    }
  };

  const setUserRole = (role: Role) => {
    setUser(prev => prev ? { ...prev, role } : prev);
  };

  return (
    <AppContext.Provider value={{ user, isAuthenticated, authLoading, projects, projectsLoading, currentProject, login, register, logout, setCurrentProject, updateProject, createProject, setUserRole, updateStep0, getProjectMember, canAccessProject, markSponsorInvitationSent, acceptSponsorInvitation, updateSponsorTouchpoint, addSponsorComment }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
