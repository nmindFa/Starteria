/**
 * Wire-format transformer for AutofillProposalDto sent to the frontend.
 *
 * Backend storage uses uppercase Prisma enums (HIGH/MED/LOW, PENDING/CONFIRMED/...)
 * and a list-shaped provenance array `[{ page, quote, confidence }]`.
 * Frontend DTOs (front/src/app/services/pdfAutofillService.ts) use lowercase
 * (high/medium/low, unconfirmed/confirmed/...) and a single `ProvenanceEntry`
 * with `secondarySources`. This module is the SINGLE serialization boundary.
 */

import type { PdfFieldProposalDTO } from './pdf.types';

export interface WireProvenanceEntry {
  sourcePdfId: string;
  sourcePdfName: string;
  pageNumbers: number[];
  quotedExcerpt: string;
  confidenceScore: number;
  confidenceBand: 'high' | 'medium' | 'low';
}

export interface WireAutofillProposal {
  fieldPath: string;
  proposedValue: unknown;
  finalValue: unknown | null;
  status: 'unconfirmed' | 'confirmed' | 'edited' | 'discarded';
  provenance: WireProvenanceEntry;
  secondarySources?: WireProvenanceEntry[];
  confidenceScore: number;
  confidenceBand: 'high' | 'medium' | 'low';
  runId: string;
  omissionReason?: string;
}

interface BackendProvenanceItem {
  page: number;
  quote: string;
  confidence?: number;
}

const STATUS_MAP = {
  PENDING: 'unconfirmed',
  CONFIRMED: 'confirmed',
  EDITED: 'edited',
  DISCARDED: 'discarded',
} as const;

const BAND_MAP = {
  HIGH: 'high',
  MED: 'medium',
  LOW: 'low',
} as const;

/**
 * @param dto the service-layer DTO (uppercase enums + raw provenance array)
 * @param pdfMeta the source PDF metadata (needed to populate sourcePdfId/sourcePdfName)
 */
export function toWireProposal(
  dto: PdfFieldProposalDTO,
  pdfMeta: { pdfId: string; fileName: string },
): WireAutofillProposal {
  const rawProv = Array.isArray(dto.provenance) ? (dto.provenance as BackendProvenanceItem[]) : [];

  const buildEntry = (item: BackendProvenanceItem): WireProvenanceEntry => {
    const score = typeof item.confidence === 'number' ? item.confidence : dto.confidence;
    return {
      sourcePdfId: pdfMeta.pdfId,
      sourcePdfName: pdfMeta.fileName,
      pageNumbers: [item.page],
      quotedExcerpt: item.quote,
      confidenceScore: score,
      confidenceBand: BAND_MAP[bandOf(score)],
    };
  };

  // Synthesize a primary entry if backend has none (defensive — should not happen
  // for non-omitted proposals, but the contract is "always at least one source").
  const [first, ...rest] = rawProv;
  const primary = first
    ? buildEntry(first)
    : {
        sourcePdfId: pdfMeta.pdfId,
        sourcePdfName: pdfMeta.fileName,
        pageNumbers: [],
        quotedExcerpt: '',
        confidenceScore: dto.confidence,
        confidenceBand: BAND_MAP[dto.confidenceBand] ?? 'medium',
      };

  return {
    fieldPath: dto.fieldPath,
    proposedValue: dto.proposedValue,
    finalValue: dto.finalValue ?? null,
    status: STATUS_MAP[dto.status],
    provenance: primary,
    secondarySources: rest.length ? rest.map(buildEntry) : undefined,
    confidenceScore: dto.confidence,
    confidenceBand: BAND_MAP[dto.confidenceBand] ?? 'medium',
    runId: dto.runId,
  };
}

function bandOf(score: number): 'HIGH' | 'MED' | 'LOW' {
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.6) return 'MED';
  return 'LOW';
}
