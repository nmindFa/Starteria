import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { validate } from '../../shared/middleware/validate';
import { updateProfileSchema, inviteMemberSchema, updateMemberRoleSchema } from './user.schemas';

import { authenticate } from '../auth/auth.middleware';

const prisma = new PrismaClient();
const service = new UserService(prisma);
const controller = new UserController(service);

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/profile', controller.getProfile);
userRouter.patch('/profile', validate(updateProfileSchema), controller.updateProfile);

export const teamRouter = Router();

teamRouter.use(authenticate);

teamRouter.get('/:projectId/team', controller.getTeam);
teamRouter.post('/:projectId/team/invite', validate(inviteMemberSchema), controller.inviteMember);
teamRouter.patch(
  '/:projectId/team/:memberId',
  validate(updateMemberRoleSchema),
  controller.updateMemberRole
);
teamRouter.delete('/:projectId/team/:memberId', controller.removeMember);
