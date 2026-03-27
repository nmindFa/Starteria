import { PrismaClient, EvidenceStatus as PrismaEvidenceStatus } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { Evidence, EvidenceStatus } from '../../shared/types';
import { StatusMapper } from '../../shared/utils/status-mapper';
import { CreateEvidenceInput } from './evidence.schemas';

export class EvidenceService {
  constructor(private prisma: PrismaClient) {}

  async listEvidence(projectId: string): Promise<Evidence[]> {
    const evidence = await this.prisma.evidence.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return evidence as unknown as Evidence[];
  }

  async createEvidence(
    projectId: string,
    ownerId: string,
    data: CreateEvidenceInput
  ): Promise<Evidence> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppError.notFound('Proyecto');
    }

    const dbType = StatusMapper.evidenceType.toDb[data.type as keyof typeof StatusMapper.evidenceType.toDb];

    const evidence = await this.prisma.evidence.create({
      data: {
        projectId,
        name: data.name,
        type: dbType || 'OTHER',
        size: data.size,
        url: data.url,
        stepRef: data.stepRef,
        moduleRef: data.moduleRef,
        ownerId,
        status: 'UPLOADED',
      },
    });

    return evidence as unknown as Evidence;
  }

  async updateEvidenceStatus(
    projectId: string,
    evidenceId: string,
    newStatus: EvidenceStatus
  ): Promise<Evidence> {
    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, projectId },
    });

    if (!evidence) {
      throw AppError.notFound('Evidencia');
    }

    const dbStatus = StatusMapper.evidenceStatus.toDb[newStatus as keyof typeof StatusMapper.evidenceStatus.toDb] as PrismaEvidenceStatus;

    const updated = await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { status: dbStatus },
    });

    return updated as unknown as Evidence;
  }

  async deleteEvidence(projectId: string, evidenceId: string): Promise<void> {
    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, projectId },
    });

    if (!evidence) {
      throw AppError.notFound('Evidencia');
    }

    await this.prisma.evidence.delete({ where: { id: evidenceId } });
  }
}
