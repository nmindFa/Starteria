import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { StatusMapper } from '../../shared/utils/status-mapper';
import { SubmitReviewInput, HelpRequestInput } from './mentor.schemas';

export class MentorService {
  constructor(private prisma: PrismaClient) {}

  async listPendingReviews(mentorId: string) {
    const reviews = await this.prisma.mentorSession.findMany({
      where: {
        OR: [
          { mentorId },
          { status: 'PENDING_SCHEDULE' },
        ],
      },
      include: {
        project: { select: { id: true, name: true, cohortId: true } },
        step: { select: { number: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews;
  }

  async getReviewDetails(reviewId: string, mentorId: string) {
    const review = await this.prisma.mentorSession.findUnique({
      where: { id: reviewId },
      include: {
        project: {
          include: {
            steps: { include: { modules: true } },
            teamMembers: true,
          },
        },
        step: { include: { modules: true } },
      },
    });

    if (!review) {
      throw AppError.notFound('Revision');
    }

    return review;
  }

  async submitReview(reviewId: string, mentorId: string, data: SubmitReviewInput) {
    const review = await this.prisma.mentorSession.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw AppError.notFound('Revision');
    }

    const dbResult = StatusMapper.resultStatus.toDb[data.decision as keyof typeof StatusMapper.resultStatus.toDb];

    const updated = await this.prisma.mentorSession.update({
      where: { id: reviewId },
      data: {
        mentorId,
        status: 'COMPLETED',
        result: dbResult as any,
        comments: data.summary,
        rubricScores: {
          goodPoints: data.goodPoints,
          missing: data.missing,
          actions: data.actions,
          questions: data.questions,
          scores: data.rubricScores,
        },
      },
    });

    // Update step status based on decision
    if (review.stepId) {
      const newStepStatus = data.decision === 'Aprobado'
        ? 'APPROVED'
        : data.decision === 'Bloqueado'
        ? 'BLOCKED'
        : 'IN_PROGRESS';

      await this.prisma.step.update({
        where: { id: review.stepId },
        data: { status: newStepStatus as any },
      });
    }

    return updated;
  }

  async sendHelpRequest(projectId: string, userId: string, data: HelpRequestInput) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppError.notFound('Proyecto');
    }

    const helpRequest = await this.prisma.helpRequest.create({
      data: {
        projectId,
        userId,
        message: data.message,
        status: 'PENDING',
      },
    });

    return helpRequest;
  }
}
