/**
 * Flatten the nested InitiativeExtraction tree returned by ai-service into
 * a list of FieldProposal rows, each addressed by a dotted fieldPath that
 * matches the eval ground-truth keys (e.g. "step0.origen", "step1.asisData.quiebre",
 * "step3.testCycles[0].queValidamos").
 *
 * The tree shape mirrors `ai-service/schemas/pdf_extraction.py::InitiativeExtraction`.
 * Each leaf that has shape `{ value, provenance: [...], confidence }` is a FieldProposal.
 */

import type { ConfidenceBandValue } from './pdf.types';

export interface FlatFieldProposal {
  fieldPath: string;
  value: unknown;
  provenance: unknown;
  confidence: number;
  confidenceBand: ConfidenceBandValue;
}

function isFieldProposalLeaf(node: unknown): node is {
  value: unknown;
  provenance: unknown[];
  confidence: number;
} {
  if (typeof node !== 'object' || node === null) return false;
  const obj = node as Record<string, unknown>;
  return (
    'value' in obj &&
    'confidence' in obj &&
    typeof obj.confidence === 'number'
  );
}

function bandOf(confidence: number): ConfidenceBandValue {
  if (confidence >= 0.8) return 'HIGH';
  if (confidence >= 0.6) return 'MED';
  return 'LOW';
}

/**
 * True iff `node` is a FieldProposal wrapper whose `.value` is a list of objects
 * where each object contains nested FieldProposal sub-fields (e.g. `testCycles`).
 * In that case we must DESCEND into the list with indexed paths, not emit the
 * wrapper as a single terminal leaf.
 */
function isWrappedListOfFieldProposalObjects(
  node: unknown,
): node is { value: Record<string, unknown>[]; provenance?: unknown; confidence: number } {
  if (!isFieldProposalLeaf(node)) return false;
  const value = (node as { value: unknown }).value;
  if (!Array.isArray(value) || value.length === 0) return false;
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    for (const v of Object.values(item)) {
      if (isFieldProposalLeaf(v)) return true;
    }
  }
  return false;
}

function walk(node: unknown, prefix: string, out: FlatFieldProposal[]): void {
  if (node === null || node === undefined) return;
  if (isFieldProposalLeaf(node)) {
    if (isWrappedListOfFieldProposalObjects(node)) {
      // Descend: each list element becomes `prefix[idx]` and its FieldProposal
      // sub-fields emit as `prefix[idx].subField`. The wrapper itself does not
      // become a row — the per-cycle FieldProposals are the source of truth.
      const list = (node as { value: Record<string, unknown>[] }).value;
      list.forEach((item, idx) => walk(item, `${prefix}[${idx}]`, out));
      return;
    }
    out.push({
      fieldPath: prefix,
      value: node.value,
      provenance: node.provenance ?? [],
      confidence: node.confidence,
      confidenceBand: bandOf(node.confidence),
    });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, idx) => walk(child, `${prefix}[${idx}]`, out));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      // Skip the harness metadata keys
      if (key === 'must_omit_violations' || key === 'extraction_metadata') continue;
      const nextPrefix = prefix === '' ? key : `${prefix}.${key}`;
      walk(value, nextPrefix, out);
    }
  }
}

export function flattenFieldProposals(
  extraction: Record<string, unknown> | unknown,
): FlatFieldProposal[] {
  const out: FlatFieldProposal[] = [];
  walk(extraction, '', out);
  return out;
}
