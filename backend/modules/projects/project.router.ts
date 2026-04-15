import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { validate } from '../../shared/middleware/validate';
import { createProjectSchema, updateProjectSchema, updateStep0Schema, updateSponsorDataSchema } from './project.schemas';

import { authenticate } from '../auth/auth.middleware';
const service = new ProjectService(prisma);
const controller = new ProjectController(service);

export const projectRouter = Router();

projectRouter.use(authenticate);

projectRouter.get('/', controller.list);
projectRouter.post('/', validate(createProjectSchema), controller.create);
projectRouter.get('/:id', controller.getById);
projectRouter.patch('/:id', validate(updateProjectSchema), controller.update);
projectRouter.delete('/:id', controller.archive);
projectRouter.get('/:id/step0', controller.getStep0);
projectRouter.patch('/:id/step0', validate(updateStep0Schema), controller.updateStep0);
projectRouter.patch('/:id/position', controller.updatePosition);
projectRouter.patch('/:id/sponsor-data', validate(updateSponsorDataSchema), controller.updateSponsorData);
