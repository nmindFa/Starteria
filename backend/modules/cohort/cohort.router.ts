import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { CohortController } from './cohort.controller';
import { CohortService } from './cohort.service';

import { authenticate, requireRole } from '../auth/auth.middleware';
const service = new CohortService(prisma);
const controller = new CohortController(service);

export const cohortRouter = Router();

cohortRouter.use(authenticate);
cohortRouter.use(requireRole('admin'));

cohortRouter.get('/cohorts', controller.list);
cohortRouter.get('/cohorts/:id', controller.getWithKPIs);
cohortRouter.get('/cohorts/:id/projects', controller.getProjects);
cohortRouter.get('/cohorts/:id/funnel', controller.getFunnel);
cohortRouter.get('/cohorts/:id/export', controller.exportCsv);
