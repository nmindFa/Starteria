import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { MentorController } from './mentor.controller';
import { MentorService } from './mentor.service';
import { validate } from '../../shared/middleware/validate';
import { submitReviewSchema, helpRequestSchema } from './mentor.schemas';

import { authenticate, requireRole } from '../auth/auth.middleware';

const prisma = new PrismaClient();
const service = new MentorService(prisma);
const controller = new MentorController(service);

export const mentorRouter = Router();

mentorRouter.use(authenticate);
mentorRouter.use(requireRole('mentor', 'admin'));

mentorRouter.get('/reviews', controller.listReviews);
mentorRouter.get('/reviews/:id', controller.getReview);
mentorRouter.post('/reviews/:id', validate(submitReviewSchema), controller.submitReview);

export const helpRouter = Router();
helpRouter.use(authenticate);
helpRouter.post('/:projectId/help', validate(helpRequestSchema), controller.sendHelp);
