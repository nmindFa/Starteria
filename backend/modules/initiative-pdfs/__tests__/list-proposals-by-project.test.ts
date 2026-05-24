/**
 * Tests for `GET /initiatives/:id/autofill-proposals` — the project-scoped
 * proposal listing used by the frontend hydration path.
 *
 * Coverage:
 *  1. Without `runId` → returns proposals across every COMPLETED run for the
 *     project, sorted by `fieldPath`, with per-row pdfId/pdfName resolved via
 *     the owning run's PDF relation.
 *  2. With `runId` query filter → behaves identically to the existing per-run
 *     endpoint (single-run scope, requires that run to be COMPLETED).
 *  3. Project that exists but has no COMPLETED runs → returns an empty array
 *     (NOT 404), so the hydrator can poll defensively on every page mount.
 *
 * The tests exercise the service layer directly (mock Prisma) — the same
 * pattern as the existing pdf.service.test.ts so we stay hermetic and fast.
 * Wiring through the Express router is covered indirectly by the existing
 * integration tests; here we focus on the new code path.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PdfService } from '../pdf.service';
import type { IPdfStorage } from '../storage.service';
import type { AiServiceClient } from '../ai-client';

type PrismaMock = ReturnType<typeof makePrismaMock>;

function makePrismaMock() {
  return {
    project: { findUnique: vi.fn() },
    initiativePdf: { create: vi.fn(), findFirst: vi.fn() },
    pdfExtractionRun: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    pdfFieldProposal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    $transaction: vi.fn(async (ops: unknown) => (Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : [])),
  } as const;
}

function makeStorage(): IPdfStorage {
  return {
    savePdf: vi.fn(),
    readPdf: vi.fn(),
    deletePdf: vi.fn(),
    exists: vi.fn().mockResolvedValue(true),
    getMetadata: vi.fn().mockResolvedValue(null),
  } as unknown as IPdfStorage;
}

function makeAiClient(): AiServiceClient {
  return {
    callPdfExtract: vi.fn(),
    fetchRunState: vi.fn(),
  } as unknown as AiServiceClient;
}

const PROJECT_ID = 'cproject0000000000000000';

function makeRow(opts: {
  id?: string;
  runId: string;
  fieldPath: string;
  status?: 'PENDING' | 'CONFIRMED' | 'EDITED' | 'DISCARDED';
  proposedValue?: unknown;
  confidence?: number;
  confidenceBand?: 'HIGH' | 'MED' | 'LOW';
  provenance?: unknown;
}) {
  return {
    id: opts.id ?? `prop-${opts.fieldPath}`,
    runId: opts.runId,
    projectId: PROJECT_ID,
    fieldPath: opts.fieldPath,
    proposedValue: opts.proposedValue ?? 'stub',
    provenance: opts.provenance ?? [{ page: 1, quote: 'q', confidence: opts.confidence ?? 0.9 }],
    confidence: opts.confidence ?? 0.9,
    confidenceBand: opts.confidenceBand ?? 'HIGH',
    status: opts.status ?? 'PENDING',
    finalValue: null,
    confirmedBy: null,
    confirmedAt: null,
  };
}

describe('PdfService.listWireProposalsForProject', () => {
  let prisma: PrismaMock;
  let service: PdfService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new PdfService(prisma as any, makeStorage(), makeAiClient());
    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
  });

  it('returns proposals from all COMPLETED runs sorted by fieldPath when no runId filter is given', async () => {
    prisma.pdfExtractionRun.findMany.mockResolvedValue([
      {
        id: 'run-A',
        projectId: PROJECT_ID,
        status: 'COMPLETED',
        pdf: { id: 'pdf-A', fileName: 'plan-a.pdf' },
      },
      {
        id: 'run-B',
        projectId: PROJECT_ID,
        status: 'COMPLETED',
        pdf: { id: 'pdf-B', fileName: 'plan-b.pdf' },
      },
    ]);
    // Intentionally out-of-order so we can assert sorting at the service level.
    prisma.pdfFieldProposal.findMany.mockResolvedValue([
      makeRow({ runId: 'run-A', fieldPath: 'step0.origen', proposedValue: 'problema' }),
      makeRow({ runId: 'run-B', fieldPath: 'step0.nombreParticipante', proposedValue: 'Ana' }),
    ]);

    const proposals = await service.listWireProposalsForProject(PROJECT_ID);

    // Sanity: prisma queries used the COMPLETED runs filter and the right IN-list.
    const runArgs = (prisma.pdfExtractionRun.findMany as any).mock.calls[0][0];
    expect(runArgs.where).toEqual({ projectId: PROJECT_ID, status: 'COMPLETED' });
    const findArgs = (prisma.pdfFieldProposal.findMany as any).mock.calls[0][0];
    expect(findArgs.where).toEqual({ runId: { in: ['run-A', 'run-B'] } });
    expect(findArgs.orderBy).toEqual({ fieldPath: 'asc' });

    expect(proposals).toHaveLength(2);

    // Wire format: each row carries the originating PDF metadata.
    const byPath = Object.fromEntries(proposals.map((p) => [p.fieldPath, p]));
    expect(byPath['step0.origen'].provenance.sourcePdfId).toBe('pdf-A');
    expect(byPath['step0.origen'].provenance.sourcePdfName).toBe('plan-a.pdf');
    expect(byPath['step0.nombreParticipante'].provenance.sourcePdfId).toBe('pdf-B');
    expect(byPath['step0.nombreParticipante'].provenance.sourcePdfName).toBe('plan-b.pdf');

    // Wire-format enums: lowercase status + lowercase band.
    expect(byPath['step0.origen'].status).toBe('unconfirmed');
    expect(byPath['step0.origen'].confidenceBand).toBe('high');
  });

  it('delegates to single-run listing when a runId query filter is provided', async () => {
    // Single-run path requires the run row + COMPLETED status; mock findFirst.
    prisma.pdfExtractionRun.findFirst.mockResolvedValueOnce({
      id: 'run-X',
      projectId: PROJECT_ID,
      status: 'COMPLETED',
    });
    prisma.pdfFieldProposal.findMany.mockResolvedValueOnce([
      makeRow({ runId: 'run-X', fieldPath: 'step1.asisData.quiebre', proposedValue: 'esperar Lima' }),
    ]);
    // getPdfMetaForRun is invoked next.
    prisma.pdfExtractionRun.findFirst.mockResolvedValueOnce({
      id: 'run-X',
      projectId: PROJECT_ID,
      status: 'COMPLETED',
      pdf: { id: 'pdf-X', fileName: 'plan-x.pdf' },
    });

    const proposals = await service.listWireProposalsForProject(PROJECT_ID, 'run-X');

    expect(proposals).toHaveLength(1);
    expect(proposals[0].fieldPath).toBe('step1.asisData.quiebre');
    expect(proposals[0].runId).toBe('run-X');
    expect(proposals[0].provenance.sourcePdfId).toBe('pdf-X');
    // The project-wide branch (findMany over runs) must NOT have run.
    expect(prisma.pdfExtractionRun.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array (not 404) when the project has no completed runs', async () => {
    prisma.pdfExtractionRun.findMany.mockResolvedValue([]);

    const proposals = await service.listWireProposalsForProject(PROJECT_ID);

    expect(proposals).toEqual([]);
    // Never hit the proposals table if there are no runs to filter by.
    expect(prisma.pdfFieldProposal.findMany).not.toHaveBeenCalled();
  });

  it('still 404s when the project itself does not exist', async () => {
    prisma.project.findUnique.mockResolvedValue(null);

    let thrown: any = null;
    try {
      await service.listWireProposalsForProject('cnope0000000000000000nope');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeTruthy();
    expect(thrown.code).toBe('PROJECT_NOT_FOUND');
    expect(thrown.statusCode).toBe(404);
  });
});
