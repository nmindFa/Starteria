import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { corsOptions } from './config/cors';
import { config } from './config';
import { requestId } from './shared/middleware/request-id';
import { errorHandler } from './shared/errors/error-handler';
import { logger } from './shared/utils/logger';
import { AppError } from './shared/errors/AppError';

import { authRouter } from './modules/auth/auth.router';
import { projectRouter } from './modules/projects/project.router';
import { stepRouter } from './modules/steps/step.router';
import { evidenceRouter } from './modules/evidence/evidence.router';
import { mentorRouter } from './modules/mentor/mentor.router';
import { cohortRouter } from './modules/cohort/cohort.router';
import { userRouter, teamRouter } from './modules/users/user.router';
import { helpRouter } from './modules/mentor/mentor.router';
import { sponsorRouter } from './modules/sponsor/sponsor.router';
import { portfolioRouter } from './modules/portfolio/portfolio.router';
import { pdfRouter, initiativePdfService } from './modules/initiative-pdfs/pdf.router';
import { createAiWebhookRouter } from './modules/initiative-pdfs/webhook.router';

export function createApp() {
  const app = express();

  // Global middleware
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(pinoHttp({ logger }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API v1 routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/projects', projectRouter);
  app.use('/api/v1/projects', stepRouter);
  app.use('/api/v1/projects', evidenceRouter);
  app.use('/api/v1/mentor', mentorRouter);
  app.use('/api/v1/admin', cohortRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/projects', teamRouter);
  app.use('/api/v1/projects', helpRouter);
  app.use('/api/v1/sponsor', sponsorRouter);
  app.use('/api/v1/portfolio', portfolioRouter);
  // TASK-006: PDF storage + extraction routes mirror evidence/step registration.
  app.use('/api/v1/initiatives', pdfRouter);
  // Internal ai-service → backend push channel (X-Internal-Token only; no JWT).
  // Lets ai-service notify backend the moment an extraction finishes so the DB is
  // updated even when no frontend client is actively polling.
  app.use('/api/v1/internal/ai/webhooks', createAiWebhookRouter(initiativePdfService));

  // 404 handler
  app.use((_req, _res, next) => {
    next(AppError.notFound('Ruta'));
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
