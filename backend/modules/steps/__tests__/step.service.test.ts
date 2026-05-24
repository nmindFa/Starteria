/**
 * step.service.test.ts — TASK-010 round-trip persistence for Steps 2/3/4.
 *
 * Uses an in-memory fake of the Prisma `step` model so the test is independent
 * of the database. Validates the contract the controller relies on:
 *   - saveStepData stores the payload verbatim
 *   - getStepData returns what was saved (round-trip)
 *   - missing step row raises STEP_NOT_FOUND
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { StepService } from '../step.service';

type StepRow = {
  id: string;
  projectId: string;
  number: number;
  stepData: Record<string, unknown> | null;
};

function buildFakePrisma(initialRows: StepRow[]) {
  const rows = [...initialRows];

  const fake = {
    step: {
      findFirst: async ({ where }: { where: { projectId: string; number: number } }) => {
        return rows.find((r) => r.projectId === where.projectId && r.number === where.number) ?? null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { stepData: Record<string, unknown> };
      }) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('row not found');
        rows[idx] = { ...rows[idx], stepData: data.stepData };
        return rows[idx];
      },
    },
  };

  return { fake, rows };
}

describe('StepService — TASK-010 Steps 2/3/4 persistence', () => {
  const projectId = '11111111-1111-1111-1111-111111111111';

  let fakePrisma: ReturnType<typeof buildFakePrisma>;
  let service: StepService;

  beforeEach(() => {
    fakePrisma = buildFakePrisma([
      { id: 's1', projectId, number: 1, stepData: null },
      { id: 's2', projectId, number: 2, stepData: null },
      { id: 's3', projectId, number: 3, stepData: null },
      { id: 's4', projectId, number: 4, stepData: null },
    ]);
    // The service expects a PrismaClient; we cast our minimal fake.
    service = new StepService(fakePrisma.fake as unknown as Parameters<typeof StepService.prototype['constructor']>[0]);
  });

  it('round-trips Step 2 envelope (hmw + testCard payload)', async () => {
    const payload = {
      _meta: { version: 1, lastSavedAt: '2026-05-19T00:00:00Z', lastSavedBy: 'user-1' },
      formData: {
        hmw: 'How might we reduce onboarding friction?',
        testCard: {
          hipotesis: 'Si simplificamos el form, completan en <24h',
          metrica: '80% completion en <24h',
        },
      },
    };

    await service.saveStepData(projectId, 2, payload);
    const loaded = await service.getStepData(projectId, 2);

    expect(loaded).toEqual(payload);
  });

  it('round-trips Step 3 envelope (testCycles + diagnostico)', async () => {
    const payload = {
      _meta: { version: 1, lastSavedAt: '2026-05-19T01:00:00Z', lastSavedBy: 'user-1' },
      formData: {
        formatoExp: 'piloto-3-personas',
        testCycles: [
          {
            id: 'c1',
            queValidamos: 'velocidad de aprobación',
            metricaPrincipal: 'tiempo p50',
            resultadoEsperado: '< 24h',
          },
        ],
        diagnostico: { senales: ['onboarding más rápido', 'menos retrabajo'] },
      },
    };

    await service.saveStepData(projectId, 3, payload);
    const loaded = await service.getStepData(projectId, 3);
    expect(loaded).toEqual(payload);
  });

  it('round-trips Step 4 envelope (presentation + audience + meetingGoal)', async () => {
    const payload = {
      _meta: { version: 2, lastSavedAt: '2026-05-19T02:00:00Z', lastSavedBy: 'user-1' },
      formData: {
        audience: 'comité ejecutivo',
        meetingGoal: 'aprobar piloto extendido',
        presentation: {
          problem: 'onboarding de 5 días',
          proposal: 'piloto a 2 áreas adicionales',
        },
      },
    };

    await service.saveStepData(projectId, 4, payload);
    const loaded = await service.getStepData(projectId, 4);
    expect(loaded).toEqual(payload);
  });

  it('raises STEP_NOT_FOUND when saving a step number that has no row', async () => {
    await expect(service.saveStepData('does-not-exist', 2, { foo: 'bar' })).rejects.toMatchObject({
      code: 'STEP_NOT_FOUND',
    });
  });

  it('returns null when a step has never been saved', async () => {
    const loaded = await service.getStepData(projectId, 2);
    expect(loaded).toBeNull();
  });
});
