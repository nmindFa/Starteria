import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { validate } from '../../shared/middleware/validate';
import { createEvidenceSchema, updateEvidenceStatusSchema } from './evidence.schemas';

import { authenticate } from '../auth/auth.middleware';

const prisma = new PrismaClient();
const service = new EvidenceService(prisma);
const controller = new EvidenceController(service);

export const evidenceRouter = Router();

evidenceRouter.use(authenticate);

evidenceRouter.get('/:projectId/evidence', controller.list);
evidenceRouter.post('/:projectId/evidence', validate(createEvidenceSchema), controller.create);
evidenceRouter.patch(
  '/:projectId/evidence/:id',
  validate(updateEvidenceStatusSchema),
  controller.updateStatus
);
evidenceRouter.delete('/:projectId/evidence/:id', controller.delete);
