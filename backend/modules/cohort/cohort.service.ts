import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { CohortQuery } from './cohort.schemas';

export class CohortService {
  constructor(private prisma: PrismaClient) {}

  async listCohorts(query: CohortQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [cohorts, total] = await Promise.all([
      this.prisma.cohort.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { projects: true } } },
      }),
      this.prisma.cohort.count(),
    ]);

    return {
      items: cohorts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCohortWithKPIs(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        projects: {
          include: {
            steps: true,
            team: true,
          },
        },
      },
    });

    if (!cohort) {
      throw AppError.notFound('Cohorte');
    }

    const projects = (cohort as any).projects || [];
    const kpis = {
      totalProjects: projects.length,
      activeProjects: projects.filter((p: any) => p.status !== 'Draft' && p.status !== 'Finalizado').length,
      completedProjects: projects.filter((p: any) => p.status === 'Finalizado').length,
      avgProgress: projects.length > 0
        ? projects.reduce((sum: number, p: any) => sum + (p.currentStep / 4) * 100, 0) / projects.length
        : 0,
      riskDistribution: {
        Bajo: projects.filter((p: any) => p.riskLevel === 'Bajo').length,
        Medio: projects.filter((p: any) => p.riskLevel === 'Medio').length,
        Alto: projects.filter((p: any) => p.riskLevel === 'Alto').length,
      },
    };

    return { cohort, kpis };
  }

  async getCohortProjects(cohortId: string, query: CohortQuery) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { cohortId };
    if (status) {
      where.status = status;
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          steps: { include: { modules: true } },
          team: true,
        },
        orderBy: { lastModified: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items: projects,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFunnelAnalytics(cohortId: string) {
    const projects = await this.prisma.project.findMany({
      where: { cohortId },
      select: { status: true, currentStep: true },
    });

    const funnel = {
      step0: projects.length,
      step1: projects.filter((p) => p.currentStep >= 1).length,
      step2: projects.filter((p) => p.currentStep >= 2).length,
      step3: projects.filter((p) => p.currentStep >= 3).length,
      step4: projects.filter((p) => p.currentStep >= 4).length,
      completed: projects.filter((p) => p.status === 'Finalizado').length,
    };

    const statusBreakdown: Record<string, number> = {};
    for (const p of projects) {
      statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
    }

    return { funnel, statusBreakdown, totalProjects: projects.length };
  }

  async exportCohortData(cohortId: string, includeEvidence: boolean): Promise<string> {
    const projects = await this.prisma.project.findMany({
      where: { cohortId },
      include: {
        steps: { include: { modules: true } },
        team: true,
        evidence: includeEvidence ? true : false,
      },
    });

    // Generate CSV
    const headers = ['ID', 'Nombre', 'Estado', 'Paso Actual', 'Riesgo', 'Miembros', 'Ultima Modificacion'];
    const rows = projects.map((p) => [
      p.id,
      p.name,
      p.status,
      p.currentStep,
      (p as any).riskLevel || 'N/A',
      (p as any).team?.length || 0,
      p.lastModified,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return csv;
  }
}
