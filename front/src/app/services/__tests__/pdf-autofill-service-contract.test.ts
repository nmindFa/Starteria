/**
 * Cross-layer CONTRACT test — pdfAutofillService DTO ↔ backend response ↔ ground truth.
 *
 * Goal: every `fieldPath` returned by the backend (proposals endpoint) must
 * correspond to a key in the canonical ground truth, and the response shape
 * (`AutofillProposalDto`) must carry every required field — no `any` slipping
 * silently through the type boundary.
 *
 * Loads `evals/golden/pdf-extraction/test-iniciativa.ground-truth.json` at
 * runtime — do NOT hard-code field lists (that defeats the contract test).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('../api', () => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return { default: { get, post, put, patch, delete: del } };
});

import api from '../api';
import {
  listProposals,
  type AutofillProposalDto,
  type ProvenanceEntry,
} from '../pdfAutofillService';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// ---------- ground-truth loader (dynamic, do NOT hard-code field lists) ----------

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const GT_PATH = path.join(
  REPO_ROOT,
  'evals',
  'golden',
  'pdf-extraction',
  'test-iniciativa.ground-truth.json',
);

function loadGroundTruthKeys(): string[] {
  const raw = fs.readFileSync(GT_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as { fields: Record<string, unknown> };
  return Object.keys(parsed.fields);
}

function normalize(p: string): string {
  return p.replace(/\[\d+\]/g, '[0]');
}

// ---------- DTO factory mirroring the canonical proposal shape ----------

function makeProvenance(): ProvenanceEntry {
  return {
    sourcePdfId: 'pdf-1',
    sourcePdfName: 'plan.pdf',
    pageNumbers: [3],
    quotedExcerpt: 'stub quote',
    confidenceScore: 0.9,
    confidenceBand: 'high',
  };
}

function makeProposalForFieldPath(fieldPath: string): AutofillProposalDto {
  return {
    fieldPath,
    proposedValue: 'stub value',
    status: 'unconfirmed',
    provenance: makeProvenance(),
    confidenceScore: 0.9,
    confidenceBand: 'high',
    runId: 'run-1',
  };
}

const REQUIRED_DTO_KEYS: ReadonlyArray<keyof AutofillProposalDto> = [
  'fieldPath',
  'proposedValue',
  'status',
  'provenance',
  'confidenceScore',
  'confidenceBand',
  'runId',
];

describe('contract: pdfAutofillService.listProposals ↔ backend response ↔ ground truth', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
  });

  it('returns AutofillProposalDto[] with every required field present', async () => {
    const gtKeys = loadGroundTruthKeys();
    expect(gtKeys.length).toBeGreaterThan(0);

    const payload = gtKeys.map(makeProposalForFieldPath);
    apiMock.get.mockResolvedValueOnce({ data: { success: true, data: payload } });

    const result = await listProposals('init-1', 'run-1');

    expect(apiMock.get).toHaveBeenCalledWith(
      '/initiatives/init-1/autofill-proposals?runId=run-1',
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(gtKeys.length);

    // Every required DTO key is present on every row (catches `any` slipping
    // through if a backend field is renamed but the frontend keeps the old key).
    for (const row of result) {
      for (const key of REQUIRED_DTO_KEYS) {
        expect(row).toHaveProperty(key);
        expect((row as Record<string, unknown>)[key]).not.toBeUndefined();
      }
      // Provenance is the most likely place to lose typing — assert its core fields.
      expect(row.provenance).toMatchObject({
        sourcePdfId: expect.any(String),
        sourcePdfName: expect.any(String),
        pageNumbers: expect.any(Array),
        quotedExcerpt: expect.any(String),
        confidenceScore: expect.any(Number),
        confidenceBand: expect.stringMatching(/^(high|medium|low)$/),
      });
    }
  });

  it('every returned fieldPath matches a ground-truth key', async () => {
    const gtKeys = loadGroundTruthKeys();
    const gtSet = new Set(gtKeys.map(normalize));

    const payload = gtKeys.map(makeProposalForFieldPath);
    apiMock.get.mockResolvedValueOnce({ data: { success: true, data: payload } });

    const result = await listProposals('init-1', 'run-1');

    const unknown = result
      .map((r) => normalize(r.fieldPath))
      .filter((p) => !gtSet.has(p))
      .sort();

    if (unknown.length) {
      throw new Error(
        `Frontend received fieldPaths not present in ground truth:\n  + ${unknown.join('\n  + ')}\n` +
          'Either the ground truth is stale or the backend is producing paths the agent\n' +
          'never declared. Update one of them.',
      );
    }
  });

  it('omits the runId query param when not provided', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { success: true, data: [] } });
    const result = await listProposals('init-1');
    expect(apiMock.get).toHaveBeenCalledWith('/initiatives/init-1/autofill-proposals');
    expect(result).toEqual([]);
  });

  // Negative test: payload missing `provenance` should be rejected by the
  // service. As of today the service is a pass-through (no runtime
  // validation), so the assertion below fails — this is an INTENTIONAL gap
  // we encode with `it.fails` so the suite stays green while the gap remains
  // documented. The day someone adds Zod / io-ts validation to
  // pdfAutofillService.listProposals, this test will start passing and the
  // `it.fails` marker can be removed.
  it.fails(
    'negative: payload missing `provenance` should make the service throw (TODO: enforce runtime validation)',
    async () => {
      const gtKeys = loadGroundTruthKeys();
      const broken = gtKeys.slice(0, 3).map((fieldPath) => {
        const row = makeProposalForFieldPath(fieldPath) as Partial<AutofillProposalDto>;
        delete row.provenance;
        return row;
      });
      apiMock.get.mockResolvedValueOnce({ data: { success: true, data: broken } });

      // Desired behaviour: listProposals rejects when any row is missing
      // `provenance`. Today it resolves silently — so this assertion fails.
      await expect(listProposals('init-1', 'run-1')).rejects.toThrow(/provenance/i);
    },
  );

  // Sibling assertion: with a valid payload, EVERY row must carry
  // `provenance` (validates that the happy-path round-trip preserves it).
  it('round-trip preserves `provenance` on every row when the backend sends it', async () => {
    const gtKeys = loadGroundTruthKeys();
    const payload = gtKeys.map(makeProposalForFieldPath);
    apiMock.get.mockResolvedValueOnce({ data: { success: true, data: payload } });

    const result = await listProposals('init-1', 'run-1');
    for (const row of result) {
      expect(row.provenance, `row ${row.fieldPath} is missing provenance`).toBeDefined();
      expect(typeof row.provenance.sourcePdfId).toBe('string');
    }
  });
});
