import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { StepController } from './step.controller';
import { StepService } from './step.service';
import { validate } from '../../shared/middleware/validate';
import { updateStepStatusSchema, updateModuleSchema, requestSessionSchema } from './step.schemas';

import { authenticate } from '../auth/auth.middleware';
const service = new StepService(prisma);
const controller = new StepController(service);

export const stepRouter = Router();

stepRouter.use(authenticate);

stepRouter.get('/:projectId/steps', controller.getAll);
stepRouter.get('/:projectId/steps/:number', controller.getByNumber);
stepRouter.patch('/:projectId/steps/:number', validate(updateStepStatusSchema), controller.updateStatus);
stepRouter.get('/:projectId/steps/:number/data', controller.getData);
stepRouter.put('/:projectId/steps/:number/data', controller.saveData);
stepRouter.patch(
  '/:projectId/steps/:number/modules/:moduleId',
  validate(updateModuleSchema),
  controller.updateModule
);
stepRouter.post('/:projectId/steps/:number/ai-review', controller.submitAiReview);
stepRouter.post(
  '/:projectId/steps/:number/session',
  validate(requestSessionSchema),
  controller.requestSession
);
