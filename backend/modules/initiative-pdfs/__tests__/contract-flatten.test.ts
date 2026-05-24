/**
 * Cross-layer CONTRACT test — backend flatten ↔ ai-service shape ↔ ground truth.
 *
 * Goal: the dotted `fieldPath`s produced by `flattenFieldProposals(payload)`,
 * where `payload` mirrors `ai-service/schemas/pdf_extraction.py::InitiativeExtraction`,
 * MUST equal the keys in `evals/golden/pdf-extraction/test-iniciativa.ground-truth.json::fields`.
 *
 * If this test fails:
 *   - Compare the printed "missing" / "extra" lists.
 *   - Decide whether the change is intentional in ai-service (then update the
 *     ground truth + this fixture together) OR a bug in flatten (then fix
 *     extraction-flatten.ts).
 *
 * Also exercises the TASK-008 defensive guards:
 *   - `step3.testCycles` wrapped in a FieldProposal (production shape).
 *   - `step3.testCycles` as a bare list (spike legacy shape).
 *   - Leaves without `confidence` are SKIPPED (not flagged as proposals).
 *   - Nested arrays emit `[N]` indexing.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  flattenFieldProposals,
  type FlatFieldProposal,
} from '../extraction-flatten';

// ---------- ground truth loader (dynamic — do NOT hard-code field lists) ----------

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
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

function normalizeArrayIndices(p: string): string {
  return p.replace(/\[\d+\]/g, '[0]');
}

function toSet(paths: string[]): Set<string> {
  return new Set(paths.map(normalizeArrayIndices));
}

// ---------- helpers to build a Pydantic-shaped payload in TS ----------

interface Provenance {
  page: number;
  quote: string;
  confidence: number;
}
interface FieldProposalLeaf {
  value: unknown;
  provenance: Provenance[];
  confidence: number;
}

function fp(value: unknown = 'stub'): FieldProposalLeaf {
  return {
    value,
    provenance: [{ page: 1, quote: 'stub', confidence: 0.9 }],
    confidence: 0.9,
  };
}

interface TestCycleShape {
  queValidamos: FieldProposalLeaf;
  metricaPrincipal: FieldProposalLeaf;
  resultadoEsperado: FieldProposalLeaf;
  resultadoObservado: FieldProposalLeaf;
  decision: FieldProposalLeaf;
  aprendizaje: FieldProposalLeaf;
}

function oneTestCycle(): TestCycleShape {
  return {
    queValidamos: fp(),
    metricaPrincipal: fp(),
    resultadoEsperado: fp(),
    resultadoObservado: fp(),
    decision: fp(),
    aprendizaje: fp(),
  };
}

/**
 * Build a fully-populated payload mirroring InitiativeExtraction.
 * `testCyclesShape='wrapped'` → production (FieldProposal whose .value is a list).
 * `testCyclesShape='bare'`    → spike legacy (bare list at root).
 *
 * Either shape must produce the canonical `step3.testCycles[N].*` paths.
 */
function buildPayload(testCyclesShape: 'wrapped' | 'bare' = 'wrapped'): Record<string, unknown> {
  const step3Base = {
    formatoExp: fp(),
    logistica: { donde: fp() },
    instrumentacion: fp([{ k: 'v' }]),
    goNoGo: fp(),
    aprendizajes: fp(),
    diagnostico: { senales: fp() },
  };

  const step3 =
    testCyclesShape === 'wrapped'
      ? {
          ...step3Base,
          testCycles: {
            value: [oneTestCycle()],
            provenance: [{ page: 8, quote: 'stub', confidence: 0.9 }],
            confidence: 0.9,
          },
        }
      : {
          ...step3Base,
          // Defensive: spike legacy shape — bare list at root, not wrapped.
          testCycles: [oneTestCycle()],
        };

  return {
    step0: {
      nombreParticipante: fp(),
      rolArea: fp(),
      origen: fp(),
      quePasaQueQuieres: fp(),
      impacta: fp(),
      parteProceso: fp(),
      impacto3meses: fp(),
      respaldo: fp(),
      quienEscuchar: fp(),
    },
    step1: {
      asisData: {
        casoReal: fp(),
        quiebre: fp(),
        quiebreDetalle: fp(),
        consecuencia: fp(),
        consequenceTags: fp(),
        causaInmediata: fp(),
        evidenciaTipo: fp(),
        evidenciaNota: fp(),
        alcance: fp(),
      },
      cData: {
        limitesChips: fp(),
        dependencia: fp(),
        alternativaPiloto: fp(),
      },
    },
    step2: {
      hmw: fp(),
      testCard: {
        hipotesis: fp(),
        queTestan: fp(),
        conQuien: fp(),
        dondeCuando: fp(),
        metodo: fp(),
        metrica: fp(),
      },
    },
    step3,
    step4: {
      audience: fp(),
      meetingGoal: fp(),
      decision: fp(),
      closureType: fp(),
      presentation: {
        problem: fp(),
        urgency: fp(),
        evidence: fp(),
        proposal: fp(),
        solutionComponents: fp(),
        tests: fp(),
        results: fp(),
        recommendation: fp(),
        orgNeeds: fp(),
        nextStep: fp(),
      },
      implementationPlan: fp([{ stage: 's', activity: 'a' }]),
      orgContext: { affectedAreas: fp(), risks: fp() },
    },
    must_omit_violations: [],
    extraction_metadata: {
      model: 'test-model',
      language: 'es',
      pages: 1,
      started_at: '2026-01-01T00:00:00',
      finished_at: '2026-01-01T00:00:00',
      duration_ms: 0,
    },
  };
}

function formatDiff(missing: string[], extra: string[]): string {
  const lines = ['Schema drift detected between flatten output and ground truth.'];
  if (missing.length) {
    lines.push('', 'MISSING IN FLATTEN (ground truth has, flatten did not emit):');
    for (const p of missing) lines.push(`  - ${p}`);
  }
  if (extra.length) {
    lines.push('', 'EXTRA IN FLATTEN (flatten emitted, ground truth does not expect):');
    for (const p of extra) lines.push(`  + ${p}`);
  }
  return lines.join('\n');
}

// ---------- the contract tests ----------

describe('contract: flattenFieldProposals ↔ ai-service shape ↔ ground truth', () => {
  it('emits exactly the ground-truth fieldPaths (production wrapped shape)', () => {
    const gtKeys = toSet(loadGroundTruthKeys());

    const payload = buildPayload('wrapped');
    const flat = flattenFieldProposals(payload);
    const emitted = toSet(flat.map((p) => p.fieldPath));

    const missing = [...gtKeys].filter((k) => !emitted.has(k)).sort();
    const extra = [...emitted].filter((k) => !gtKeys.has(k)).sort();

    if (missing.length || extra.length) {
      throw new Error(formatDiff(missing, extra));
    }

    // Sanity: array indexing path is present and uses `[N]` syntax.
    expect(flat.some((p) => /testCycles\[\d+\]\.queValidamos/.test(p.fieldPath))).toBe(true);
  });

  it('emits the same paths when testCycles is a bare list (defensive)', () => {
    const gtKeys = toSet(loadGroundTruthKeys());

    const payload = buildPayload('bare');
    const flat = flattenFieldProposals(payload);
    const emitted = toSet(flat.map((p) => p.fieldPath));

    // The "wrapped" shape produces N-1 extra leaves vs. "bare" because the
    // wrapper itself is a leaf at `step3.testCycles`. The "bare" shape walks
    // straight into the array and emits only `step3.testCycles[0].*`. Both
    // are acceptable — but we MUST never lose the per-cycle field paths.
    const cycleKeys = [...gtKeys].filter((k) => k.startsWith('step3.testCycles['));
    expect(cycleKeys.length).toBeGreaterThan(0);
    for (const k of cycleKeys) {
      expect(emitted.has(k)).toBe(true);
    }
  });

  it('skips leaves missing `confidence` (not treated as a FieldProposal)', () => {
    const payload = {
      step0: {
        nombreParticipante: { value: 'x' }, // no confidence → NOT a leaf
        rolArea: { value: 'y', provenance: [], confidence: 0.5 }, // is a leaf
      },
      extraction_metadata: {
        model: 'm',
        language: 'es',
        pages: 1,
        started_at: 'now',
        finished_at: 'now',
        duration_ms: 0,
      },
    };

    const flat = flattenFieldProposals(payload);
    const paths = flat.map((p) => p.fieldPath);

    expect(paths).toContain('step0.rolArea');
    // nombreParticipante must be walked-into as an object, but since it lacks
    // a child that itself is a leaf, no path is emitted for it.
    expect(paths.some((p) => p.startsWith('step0.nombreParticipante'))).toBe(false);
  });

  it('emits nested-array paths with [N] indexing for testCycles', () => {
    const payload = {
      step3: {
        testCycles: {
          value: [oneTestCycle(), oneTestCycle()],
          provenance: [{ page: 8, quote: 'q', confidence: 0.9 }],
          confidence: 0.9,
        },
      },
      extraction_metadata: {
        model: 'm',
        language: 'es',
        pages: 1,
        started_at: 'now',
        finished_at: 'now',
        duration_ms: 0,
      },
    };

    const flat = flattenFieldProposals(payload);
    const paths = flat.map((p) => p.fieldPath);

    // POST-FIX SEMANTICS (extraction-flatten.ts isWrappedListOfFieldProposalObjects):
    // when a FieldProposal wrapper's `.value` is a list of objects each containing
    // FieldProposal sub-leaves, we DESCEND into the list — we do NOT emit the
    // wrapper itself. This is the contract the eval scorer + ground-truth keys expect.
    expect(paths).not.toContain('step3.testCycles');
    // Per-cycle indexed paths ARE emitted with `[N].subField` shape.
    expect(paths).toContain('step3.testCycles[0].queValidamos');
    expect(paths).toContain('step3.testCycles[1].queValidamos');
    expect(paths).toContain('step3.testCycles[0].decision');
    expect(paths).toContain('step3.testCycles[1].decision');

    // Defensive: arrays at the ROOT (no wrapper) still emit `[N].field` paths.
    const inner = flattenFieldProposals([oneTestCycle(), oneTestCycle()]);
    const innerPaths = inner.map((p: FlatFieldProposal) => p.fieldPath);
    expect(innerPaths).toContain('[0].queValidamos');
    expect(innerPaths).toContain('[1].queValidamos');
  });

  it('confidence band derivation honours the documented thresholds', () => {
    const payload = {
      step0: {
        a: { value: 'x', provenance: [], confidence: 0.95 }, // HIGH (>=0.8)
        b: { value: 'x', provenance: [], confidence: 0.7 }, // MED  (>=0.6)
        c: { value: 'x', provenance: [], confidence: 0.4 }, // LOW
      },
    };
    const flat = flattenFieldProposals(payload);
    const byPath = Object.fromEntries(flat.map((p) => [p.fieldPath, p.confidenceBand]));
    expect(byPath['step0.a']).toBe('HIGH');
    expect(byPath['step0.b']).toBe('MED');
    expect(byPath['step0.c']).toBe('LOW');
  });
});
