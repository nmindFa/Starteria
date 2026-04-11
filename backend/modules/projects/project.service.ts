import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { Role, Project, Step0Data, Step0Status } from '../../shared/types';
import { StatusMapper } from '../../shared/utils/status-mapper';
import { validateTransition } from './state-machine';
import { CreateProjectInput, UpdateProjectInput } from './project.schemas';

const DEFAULT_STEPS = [
  {
    number: 1,
    name: 'Claridad en el desafio',
    modules: [
      { id: 'A', name: 'Proceso actual' },
      { id: 'B', name: 'Medicion e impacto' },
      { id: 'C', name: 'Restricciones' },
      { id: 'D', name: 'Actores y entrevistas' },
      { id: 'S', name: 'Sintesis y revision de rumbo' },
    ],
  },
  {
    number: 2,
    name: 'Disenar solucion',
    modules: [
      { id: 'A', name: 'Como podriamos...?' },
      { id: 'B', name: 'Explorar ideas' },
      { id: 'C', name: 'Elegir la mejor opcion' },
      { id: 'D', name: 'Tarjetas de solucion y prueba' },
    ],
  },
  {
    number: 3,
    name: 'Probar en pequeno',
    modules: [
      { id: 'R', name: 'Experimentos' },
      { id: 'L', name: 'Tarjeta de aprendizaje' },
    ],
  },
  {
    number: 4,
    name: 'Contar la historia',
    modules: [
      { id: 'S', name: 'Construccion del relato' },
      { id: 'O', name: 'Resumen ejecutivo' },
      { id: 'P', name: 'Presentacion final' },
    ],
  },
];

export class ProjectService {
  constructor(private prisma: PrismaClient) {}

  async listProjects(userId: string, role: Role): Promise<Project[]> {
    switch (role) {
      case 'admin':
        return this.prisma.project.findMany({
          include: { steps: { include: { modules: true } }, teamMembers: true, evidence: true },
        }) as unknown as Project[];

      case 'mentor':
        return this.prisma.project.findMany({
          where: {
            OR: [
              { mentorSessions: { some: { mentorId: userId } } },
              { status: 'EXPERT_SESSION_PENDING' },
            ],
          },
          include: { steps: { include: { modules: true } }, teamMembers: true, evidence: true },
        }) as unknown as Project[];

      default:
        return this.prisma.project.findMany({
          where: { teamMembers: { some: { userId } } },
          include: { steps: { include: { modules: true } }, teamMembers: true, evidence: true },
        }) as unknown as Project[];
    }
  }

  async createProject(userId: string, data: CreateProjectInput): Promise<Project> {
    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: userId,
        cohortId: data.cohort,
        status: 'DRAFT',
        currentStep: 1,
        step0Status: 'NOT_STARTED',
        mentorCredits: 3,
        riskLevel: 'LOW',
        teamMembers: {
          create: { userId, role: 'OWNER', status: 'ACTIVE' },
        },
        steps: {
          create: DEFAULT_STEPS.map((s) => ({
            number: s.number,
            name: s.name,
            status: s.number === 1 ? 'NOT_STARTED' : 'BLOCKED',
            progress: 0,
            modules: {
              create: s.modules.map((m, idx) => ({
                moduleId: m.id,
                name: m.name,
                status: s.number === 1 && idx === 0 ? 'DRAFT' : 'BLOCKED',
              })),
            },
          })),
        },
      },
      include: { steps: { include: { modules: true } }, teamMembers: true, evidence: true },
    });

    return project as unknown as Project;
  }

  async getProject(projectId: string, userId: string, role: Role): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { steps: { include: { modules: true } }, teamMembers: true, evidence: true },
    });

    if (!project) {
      throw AppError.notFound('Proyecto');
    }

    if (role !== 'admin' && role !== 'mentor') {
      const isMember = (project as any).teamMembers.some((m: any) => m.userId === userId);
      if (!isMember) {
        throw AppError.forbidden('No tienes acceso a este proyecto');
      }
    }

    return project as unknown as Project;
  }

  async updateProject(
    projectId: string,
    userId: string,
    role: Role,
    data: UpdateProjectInput
  ): Promise<Project> {
    const existing = await this.getProject(projectId, userId, role);

    if (data.status && data.status !== existing.status) {
      validateTransition('project', existing.status, data.status);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...data,
        lastModified: new Date().toISOString(),
      },
      include: { steps: { include: { modules: true } }, teamMembers: true, evidence: true },
    });

    return updated as unknown as Project;
  }

  async archiveProject(projectId: string, userId: string, role: Role): Promise<void> {
    await this.getProject(projectId, userId, role);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { isArchived: true },
    });
  }

  async getStep0(projectId: string, userId: string, role: Role): Promise<Partial<Step0Data> | null> {
    const project = await this.getProject(projectId, userId, role);
    return (project as any).step0Data ?? null;
  }

  async updateStep0(
    projectId: string,
    userId: string,
    role: Role,
    data: Partial<Step0Data>,
    status?: Step0Status
  ): Promise<Project> {
    await this.getProject(projectId, userId, role);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        step0Data: data as any,
        step0Status: status ?? undefined,
        lastModified: new Date().toISOString(),
      },
      include: { steps: { include: { modules: true } }, teamMembers: true, evidence: true },
    });

    return updated as unknown as Project;
  }

  async updateLastPosition(
    projectId: string,
    userId: string,
    position: { stepNumber: number; moduleId?: string }
  ): Promise<void> {
    // Verify project exists and user has access
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw AppError.notFound('Proyecto');

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        lastPosition: {
          stepNumber: position.stepNumber,
          moduleId: position.moduleId ?? null,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
