import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';
import { CreateCheckpointInput, RespondCheckpointInput } from './sponsor.schemas';

export class SponsorService {
  constructor(private prisma: PrismaClient) {}

  async createCheckpoint(data: CreateCheckpointInput) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: data.projectId },
    });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', { hint: 'Verifica el ID o vuelve al listado.' });

    // Verify sponsor exists and has sponsor role
    const sponsor = await this.prisma.user.findUnique({
      where: { id: data.sponsorId },
    });
    if (!sponsor || sponsor.role !== 'sponsor') {
      throw AppError.badRequest('El usuario no tiene rol de sponsor.', 'SPONSOR_ROLE_REQUIRED', { field: 'userId', hint: 'Asigna primero el rol sponsor en el equipo.' });
    }

    // Check if checkpoint already exists
    const existing = await this.prisma.sponsorCheckpoint.findUnique({
      where: {
        projectId_stepNumber: {
          projectId: data.projectId,
          stepNumber: data.stepNumber,
        },
      },
    });
    if (existing) {
      throw AppError.conflict('Ya existe un checkpoint para este step.', 'CHECKPOINT_ALREADY_EXISTS', { hint: 'Revisa el checkpoint existente o repite cuando esté cerrado.' });
    }

    const expiresAt = new Date(Date.now() + (data.expiresInHours || 72) * 60 * 60 * 1000);

    const checkpoint = await this.prisma.sponsorCheckpoint.create({
      data: {
        projectId: data.projectId,
        stepNumber: data.stepNumber,
        sponsorId: data.sponsorId,
        expiresAt,
      },
      include: {
        sponsor: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    logger.info({ checkpointId: checkpoint.id, projectId: data.projectId, step: data.stepNumber }, 'Sponsor checkpoint created');

    return checkpoint;
  }

  async respondToCheckpoint(checkpointId: string, sponsorId: string, data: RespondCheckpointInput) {
    const checkpoint = await this.prisma.sponsorCheckpoint.findUnique({
      where: { id: checkpointId },
    });

    if (!checkpoint) throw AppError.notFound('Checkpoint', 'CHECKPOINT_NOT_FOUND', { hint: 'Verifica el step y el sponsor asignados.' });
    if (checkpoint.sponsorId !== sponsorId) {
      throw AppError.forbidden('Solo el sponsor asignado puede responder este checkpoint.', 'SPONSOR_ASSIGNMENT_REQUIRED', { hint: 'Pide al owner asignarte como sponsor.' });
    }
    if (checkpoint.status !== 'PENDING') {
      throw AppError.badRequest('Este checkpoint ya fue respondido o expiró.', 'CHECKPOINT_NOT_PENDING', { hint: 'Crea uno nuevo si todavía necesitas revisión.' });
    }

    const status = data.alignmentSignal === 'ALIGNED' ? 'APPROVED' : 'FLAGGED';

    const updated = await this.prisma.sponsorCheckpoint.update({
      where: { id: checkpointId },
      data: {
        status: status as any,
        alignmentSignal: data.alignmentSignal as any,
        strategicFeedback: data.strategicFeedback,
        focusRecommendation: data.focusRecommendation,
        respondedAt: new Date(),
      },
      include: {
        sponsor: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    logger.info({ checkpointId, status, signal: data.alignmentSignal }, 'Sponsor checkpoint responded');

    return updated;
  }

  async skipCheckpoint(checkpointId: string, adminId: string) {
    const checkpoint = await this.prisma.sponsorCheckpoint.findUnique({
      where: { id: checkpointId },
    });

    if (!checkpoint) throw AppError.notFound('Checkpoint', 'CHECKPOINT_NOT_FOUND', { hint: 'Verifica el step y el sponsor asignados.' });
    if (checkpoint.status !== 'PENDING') {
      throw AppError.badRequest('Solo los checkpoints pendientes pueden omitirse.', 'CHECKPOINT_NOT_SKIPPABLE', { hint: 'Si ya fue respondido no se puede omitir.' });
    }

    const updated = await this.prisma.sponsorCheckpoint.update({
      where: { id: checkpointId },
      data: { status: 'SKIPPED' as any },
    });

    logger.info({ checkpointId, skippedBy: adminId }, 'Sponsor checkpoint skipped by admin');

    return updated;
  }

  async getCheckpoint(checkpointId: string) {
    const checkpoint = await this.prisma.sponsorCheckpoint.findUnique({
      where: { id: checkpointId },
      include: {
        sponsor: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!checkpoint) throw AppError.notFound('Checkpoint', 'CHECKPOINT_NOT_FOUND', { hint: 'Verifica el step y el sponsor asignados.' });
    return checkpoint;
  }

  async listByProject(projectId: string) {
    return this.prisma.sponsorCheckpoint.findMany({
      where: { projectId },
      include: {
        sponsor: { select: { id: true, name: true } },
      },
      orderBy: { stepNumber: 'asc' },
    });
  }

  async expireOverdueCheckpoints() {
    const result = await this.prisma.sponsorCheckpoint.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' as any },
    });

    if (result.count > 0) {
      logger.info({ expired: result.count }, 'Expired overdue sponsor checkpoints');
    }

    return result.count;
  }
}
