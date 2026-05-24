import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAiWebhookRouter, type WebhookCapablePdfService } from '../webhook.router';
import { errorHandler } from '../../../shared/errors/error-handler';
import { config } from '../../../config';

/**
 * Webhook router tests — proves the ai-service push channel honors auth,
 * delegates to PdfService, and is idempotent on re-delivery.
 *
 * Uses a stubbed service (no Prisma) so the test is fast and doesn't need a DB.
 */

function makeService(): { svc: WebhookCapablePdfService; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn();
  return {
    svc: { applyUpstreamRunUpdate: spy } as WebhookCapablePdfService,
    spy,
  };
}

function buildApp(svc: WebhookCapablePdfService) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/internal/ai/webhooks', createAiWebhookRouter(svc));
  app.use(errorHandler);
  return app;
}

const TOKEN = config.aiServiceToken;

const aiRunId = 'ai-run-abc-123';
const validBody = {
  status: 'completed',
  costUsd: 0.0123,
  errorReason: null,
  proposals: {
    step0: {
      nombreParticipante: {
        value: 'Nancy',
        provenance: [{ page: 1, quote: 'Nancy Andrade', confidence: 0.9 }],
        confidence: 0.9,
      },
    },
  },
};

describe('POST /api/v1/internal/ai/webhooks/pdf-extract/runs/:aiRunId', () => {
  let spy: ReturnType<typeof vi.fn>;
  let app: express.Express;

  beforeEach(() => {
    const made = makeService();
    spy = made.spy;
    app = buildApp(made.svc);
  });

  it('returns 200 and forwards the body to the service on a valid push', async () => {
    spy.mockResolvedValue({ runId: 'backend-run-1', status: 'COMPLETED' });

    const res = await request(app)
      .post(`/api/v1/internal/ai/webhooks/pdf-extract/runs/${aiRunId}`)
      .set('X-Internal-Token', TOKEN)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { runId: 'backend-run-1', status: 'COMPLETED' },
    });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(aiRunId, validBody);
  });

  it('returns 401 when X-Internal-Token is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/internal/ai/webhooks/pdf-extract/runs/${aiRunId}`)
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_AUTH_FAILED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 401 when X-Internal-Token is wrong', async () => {
    const res = await request(app)
      .post(`/api/v1/internal/ai/webhooks/pdf-extract/runs/${aiRunId}`)
      .set('X-Internal-Token', 'not-the-real-token')
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INTERNAL_AUTH_FAILED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 404 when the aiRunId is unknown to backend', async () => {
    spy.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/internal/ai/webhooks/pdf-extract/runs/unknown-id`)
      .set('X-Internal-Token', TOKEN)
      .send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PDF_RUN_NOT_FOUND');
  });

  it('is idempotent on re-delivery — second call still returns 200', async () => {
    spy.mockResolvedValue({ runId: 'backend-run-1', status: 'COMPLETED' });

    const send = () =>
      request(app)
        .post(`/api/v1/internal/ai/webhooks/pdf-extract/runs/${aiRunId}`)
        .set('X-Internal-Token', TOKEN)
        .send(validBody);

    const first = await send();
    const second = await send();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid status with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/internal/ai/webhooks/pdf-extract/runs/${aiRunId}`)
      .set('X-Internal-Token', TOKEN)
      .send({ ...validBody, status: 'not-a-real-status' });

    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
