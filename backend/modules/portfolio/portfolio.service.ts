import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import {
  CreateStrategicFrontInput,
  UpdateStrategicFrontInput,
  CreateChallengeInput,
  UpdateChallengeInput,
  AddInvitationInput,
  UpdateInvitationInput,
  AddSquadMemberInput,
  UpdateSquadMemberInput,
  UpsertInitiativeMetaInput,
  CreateOverlapInput,
  CreateExecutiveOutputInput,
  UpdateExecutiveOutputInput,
} from './portfolio.schemas';

export class PortfolioService {
  constructor(private prisma: PrismaClient) {}

  // ─── Strategic Fronts ────────────────────────────────────────────────────────

  async listStrategicFronts() {
    return this.prisma.strategicFront.findMany({
      include: {
        _count: { select: { challenges: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStrategicFront(input: CreateStrategicFrontInput) {
    return this.prisma.strategicFront.create({
      data: input as any,
      include: {
        _count: { select: { challenges: true } },
      },
    });
  }

  async updateStrategicFront(id: string, input: UpdateStrategicFrontInput) {
    const existing = await this.prisma.strategicFront.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    return this.prisma.strategicFront.update({
      where: { id },
      data: input as any,
      include: {
        _count: { select: { challenges: true } },
      },
    });
  }

  async deleteStrategicFront(id: string) {
    const existing = await this.prisma.strategicFront.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    await this.prisma.strategicFront.delete({ where: { id } });
  }

  // ─── Challenges ──────────────────────────────────────────────────────────────

  async listChallenges(strategicFrontId: string) {
    const front = await this.prisma.strategicFront.findUnique({
      where: { id: strategicFrontId },
    });
    if (!front) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    return this.prisma.challenge.findMany({
      where: { strategicFrontId },
      include: {
        selectedPeople: true,
        assignedSquad: true,
        _count: { select: { initiativeMetas: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createChallenge(strategicFrontId: string, input: CreateChallengeInput) {
    const front = await this.prisma.strategicFront.findUnique({
      where: { id: strategicFrontId },
    });
    if (!front) throw AppError.notFound('Frente estratégico', 'FRONT_NOT_FOUND', { hint: 'Confirma el ID del frente.' });

    return this.prisma.challenge.create({
      data: {
        ...(input as any),
        strategicFrontId,
      },
      include: {
        selectedPeople: true,
        assignedSquad: true,
        _count: { select: { initiativeMetas: true } },
      },
    });
  }

  async updateChallenge(id: string, input: UpdateChallengeInput) {
    const existing = await this.prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.challenge.update({
      where: { id },
      data: input as any,
      include: {
        selectedPeople: true,
        assignedSquad: true,
        _count: { select: { initiativeMetas: true } },
      },
    });
  }

  async activateOpenCall(id: string) {
    const existing = await this.prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.challenge.update({
      where: { id },
      data: {
        activationMode: 'convocatoria_abierta',
        status: 'activo_interno',
      } as any,
    });
  }

  async publishChallenge(id: string) {
    const existing = await this.prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.challenge.update({
      where: { id },
      data: { status: 'publicado' } as any,
    });
  }

  // ─── Invitations ─────────────────────────────────────────────────────────────

  async addInvitation(challengeId: string, input: AddInvitationInput) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.challengeInvitation.create({
      data: {
        challengeId,
        value: input.value,
      },
    });
  }

  async updateInvitation(invId: string, input: UpdateInvitationInput) {
    const existing = await this.prisma.challengeInvitation.findUnique({ where: { id: invId } });
    if (!existing) throw AppError.notFound('Invitación', 'INVITATION_NOT_FOUND', { hint: 'Es posible que haya sido cancelada.' });

    return this.prisma.challengeInvitation.update({
      where: { id: invId },
      data: { status: input.status as any },
    });
  }

  // ─── Squad Members ────────────────────────────────────────────────────────────

  async addSquadMember(challengeId: string, input: AddSquadMemberInput) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.challengeSquadMember.create({
      data: {
        challengeId,
        value: input.value,
        role: input.role,
      },
    });
  }

  async updateSquadMember(memberId: string, input: UpdateSquadMemberInput) {
    const existing = await this.prisma.challengeSquadMember.findUnique({
      where: { id: memberId },
    });
    if (!existing) throw AppError.notFound('Miembro del squad', 'SQUAD_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario forme parte del squad.' });

    return this.prisma.challengeSquadMember.update({
      where: { id: memberId },
      data: { role: input.role },
    });
  }

  // ─── Initiatives ──────────────────────────────────────────────────────────────

  async listInitiativesForChallenge(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.initiativePortfolioMeta.findMany({
      where: { challengeId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            currentStep: true,
            owner: { select: { id: true, name: true, email: true, initials: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInitiativeMeta(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', { hint: 'Verifica el ID o vuelve al listado.' });

    return this.prisma.initiativePortfolioMeta.findFirst({
      where: { projectId },
      include: {
        challenge: {
          select: { id: true, title: true, strategicFrontId: true, status: true },
        },
      },
    });
  }

  async upsertInitiativeMeta(
    projectId: string,
    input: UpsertInitiativeMetaInput,
  ) {
    const { challengeId, ...rest } = input;

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', { hint: 'Verifica el ID o vuelve al listado.' });

    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    // TASK-006 / SPEC-002 US-017 guard:
    // Block the `en_step_4 → esperando_revision` transition while any PDF autofill
    // proposal is still PENDING for this project. The founder MUST confirm,
    // edit, or discard every proposal before the initiative can move forward.
    if (input.status === 'esperando_revision') {
      const existing = await this.prisma.initiativePortfolioMeta.findUnique({
        where: { projectId_challengeId: { projectId, challengeId } },
        select: { status: true },
      });
      if (existing?.status === 'en_step_4') {
        const pending = await this.prisma.pdfFieldProposal.findMany({
          where: { projectId, status: 'PENDING' },
          select: { fieldPath: true },
        });
        if (pending.length > 0) {
          throw AppError.conflict(
            'Hay propuestas de autofill sin confirmar.',
            'AUTOFILL_UNCONFIRMED',
            {
              hint: 'Confirma, edita o descarta cada propuesta antes de avanzar.',
              details: pending.slice(0, 50).map((p) => ({
                field: p.fieldPath,
                code: 'PDF_PROPOSAL_PENDING',
                message: 'Propuesta de autofill sin resolver.',
              })),
            },
          );
        }
      }
    }

    return this.prisma.initiativePortfolioMeta.upsert({
      where: { projectId_challengeId: { projectId, challengeId } },
      create: {
        projectId,
        challengeId,
        ...(rest as any),
      },
      update: rest as any,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  // ─── Overlaps ─────────────────────────────────────────────────────────────────

  async listOverlaps(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.initiativeOverlap.findMany({
      where: { challengeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOverlap(challengeId: string, input: CreateOverlapInput) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.initiativeOverlap.create({
      data: {
        challengeId,
        ...(input as any),
      },
    });
  }

  // ─── Executive Outputs ────────────────────────────────────────────────────────

  async listExecutiveOutputs(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    return this.prisma.executiveOutput.findMany({
      where: { challengeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createExecutiveOutput(challengeId: string, input: CreateExecutiveOutputInput) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw AppError.notFound('Desafío', 'CHALLENGE_NOT_FOUND', { hint: 'Verifica el ID del desafío.' });

    const { projectId, sharedAt, decisionAt, ...rest } = input;

    return this.prisma.executiveOutput.upsert({
      where: { projectId_challengeId: { projectId, challengeId } },
      create: {
        projectId,
        challengeId,
        ...(rest as any),
        sharedAt: sharedAt ? new Date(sharedAt) : undefined,
        decisionAt: decisionAt ? new Date(decisionAt) : undefined,
      },
      update: {
        ...(rest as any),
        sharedAt: sharedAt ? new Date(sharedAt) : undefined,
        decisionAt: decisionAt ? new Date(decisionAt) : undefined,
      },
    });
  }

  async updateExecutiveOutput(id: string, input: UpdateExecutiveOutputInput) {
    const existing = await this.prisma.executiveOutput.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Output ejecutivo', 'OUTPUT_NOT_FOUND', { hint: 'Verifica el ID o crea uno nuevo.' });

    const { sharedAt, decisionAt, ...rest } = input;

    return this.prisma.executiveOutput.update({
      where: { id },
      data: {
        ...(rest as any),
        sharedAt: sharedAt ? new Date(sharedAt) : undefined,
        decisionAt: decisionAt ? new Date(decisionAt) : undefined,
      },
    });
  }
}
