import { PrismaClient, TeamRole, TeamMemberStatus } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { User } from '../../shared/types';
import { UpdateProfileInput, InviteMemberInput } from './user.schemas';

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound('Usuario', 'USER_NOT_FOUND', { hint: 'Verifica el correo o el ID.' });
    }

    return user as unknown as User;
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return user as unknown as User;
  }

  async getTeam(projectId: string) {
    const members = await this.prisma.teamMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, initials: true } } },
    });

    return members;
  }

  async inviteMember(projectId: string, data: InviteMemberInput) {
    const existing = await this.prisma.teamMember.findFirst({
      where: { projectId, user: { email: data.email } },
    });

    if (existing) {
      throw AppError.conflict('Este usuario ya es miembro del equipo.', 'TEAM_MEMBER_ALREADY_EXISTS', { hint: 'Quizás quieras cambiar su rol en lugar de agregarlo.' });
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      const initials = (data.name || data.email)
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      user = await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash: '',
          name: data.name || data.email.split('@')[0],
          initials,
          role: 'participante',
          skills: [],
        },
      });
    }

    const member = await this.prisma.teamMember.create({
      data: {
        projectId,
        userId: user.id,
        role: data.role as TeamRole,
        status: TeamMemberStatus.PENDING,
      },
    });

    return member;
  }

  async updateMemberRole(projectId: string, memberId: string, newRole: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw AppError.notFound('Miembro del equipo', 'TEAM_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario sea parte del equipo.' });
    }

    const updated = await this.prisma.teamMember.update({
      where: { id: memberId },
      data: { role: newRole as TeamRole },
    });

    return updated;
  }

  async removeMember(projectId: string, memberId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw AppError.notFound('Miembro del equipo', 'TEAM_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario sea parte del equipo.' });
    }

    if (member.role === TeamRole.OWNER) {
      throw AppError.badRequest('No se puede eliminar al owner del proyecto.', 'CANNOT_REMOVE_OWNER', { hint: 'Transfiere primero el ownership a otro miembro.' });
    }

    await this.prisma.teamMember.delete({ where: { id: memberId } });
  }
}
