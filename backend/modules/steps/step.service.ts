import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { StatusMapper } from '../../shared/utils/status-mapper';
import { validateTransition } from '../projects/state-machine';
import { Step, StepStatus, ModuleStatus } from '../../shared/types';

export class StepService {
  constructor(private prisma: PrismaClient) {}

  async getSteps(projectId: string): Promise<Step[]> {
    const steps = await this.prisma.step.findMany({
      where: { projectId },
      include: { modules: true },
      orderBy: { number: 'asc' },
    });

    if (!steps.length) {
      throw AppError.notFound('Pasos del proyecto');
    }

    return steps as unknown as Step[];
  }

  async getStep(projectId: string, stepNumber: number): Promise<Step> {
    const step = await this.prisma.step.findFirst({
      where: { projectId, number: stepNumber },
      include: { modules: true },
    });

    if (!step) {
      throw AppError.notFound(`Paso ${stepNumber}`);
    }

    return step as unknown as Step;
  }

  async updateStepStatus(projectId: string, stepNumber: number, newStatus: StepStatus): Promise<Step> {
    const step = await this.getStep(projectId, stepNumber);
    validateTransition('step', step.status, newStatus);

    const dbStatus = StatusMapper.stepStatus.toDb[newStatus as keyof typeof StatusMapper.stepStatus.toDb];

    const updated = await this.prisma.step.update({
      where: { id: (step as any).id },
      data: { status: dbStatus as any },
      include: { modules: true },
    });

    return updated as unknown as Step;
  }

  async getStepData(projectId: string, stepNumber: number): Promise<Record<string, unknown> | null> {
    const step = await this.prisma.step.findFirst({
      where: { projectId, number: stepNumber },
    });

    if (!step) {
      throw AppError.notFound(`Paso ${stepNumber}`);
    }

    return (step.stepData as Record<string, unknown>) ?? null;
  }

  async saveStepData(projectId: string, stepNumber: number, data: Record<string, unknown>): Promise<void> {
    const step = await this.prisma.step.findFirst({
      where: { projectId, number: stepNumber },
    });

    if (!step) {
      throw AppError.notFound(`Paso ${stepNumber}`);
    }

    await this.prisma.step.update({
      where: { id: step.id },
      data: { stepData: data as any },
    });
  }

  async updateModule(
    projectId: string,
    stepNumber: number,
    moduleId: string,
    newStatus: ModuleStatus
  ): Promise<void> {
    const step = await this.prisma.step.findFirst({
      where: { projectId, number: stepNumber },
      include: { modules: true },
    });

    if (!step) {
      throw AppError.notFound(`Paso ${stepNumber}`);
    }

    const mod = step.modules.find((m) => m.moduleId === moduleId);
    if (!mod) {
      throw AppError.notFound(`Modulo ${moduleId}`);
    }

    validateTransition('module', mod.status, newStatus);

    const dbStatus = StatusMapper.moduleStatus.toDb[newStatus as keyof typeof StatusMapper.moduleStatus.toDb];

    await this.prisma.module.update({
      where: { id: mod.id },
      data: { status: dbStatus as any },
    });
  }

  async submitAiReview(projectId: string, stepNumber: number): Promise<{ message: string }> {
    const step = await this.getStep(projectId, stepNumber);

    const stepDb = await this.prisma.step.findFirst({ where: { projectId, number: stepNumber } });
    if (!stepDb) throw AppError.notFound(`Paso ${stepNumber}`);

    if (stepDb.status !== 'SUBMITTED' && stepDb.status !== 'IN_PROGRESS') {
      throw AppError.badRequest('El paso debe estar en progreso o enviado para revision IA');
    }

    await this.prisma.step.update({
      where: { id: stepDb.id },
      data: { status: 'SUBMITTED' },
    });

    // TODO: Trigger AI review pipeline asynchronously
    return { message: 'Revision IA solicitada. Recibirás el feedback pronto.' };
  }

  async requestMentorSession(
    projectId: string,
    stepNumber: number,
    userId: string
  ): Promise<{ sessionId: string }> {
    const step = await this.prisma.step.findFirst({
      where: { projectId, number: stepNumber },
    });

    if (!step) throw AppError.notFound(`Paso ${stepNumber}`);

    // Find an available mentor (assigned to the project or any mentor)
    const mentorAssignment = await this.prisma.mentorSession.findFirst({
      where: { projectId },
      select: { mentorId: true },
    });

    // If no previous mentor, find any mentor user
    let mentorId = mentorAssignment?.mentorId;
    if (!mentorId) {
      const mentor = await this.prisma.user.findFirst({ where: { role: 'mentor' } });
      if (!mentor) throw AppError.badRequest('No hay mentores disponibles');
      mentorId = mentor.id;
    }

    const session = await this.prisma.mentorSession.create({
      data: {
        stepId: step.id,
        projectId,
        stepNumber,
        mentorId,
        status: 'PENDING_SCHEDULE',
      },
    });

    return { sessionId: session.id };
  }
}
