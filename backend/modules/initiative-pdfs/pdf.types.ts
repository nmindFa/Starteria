/**
 * Shared types for the initiative-pdfs module.
 *
 * Field-proposal shapes mirror the Pydantic models in
 * `ai-service/schemas/pdf_extraction.py` so the contract with TASK-008 stays
 * symmetric. Keep them in sync if the AI side changes.
 */

export type PdfStatusValue =
  | 'UPLOADED'
  | 'PARSING'
  | 'EXTRACTING'
  | 'READY'
  | 'FAILED'
  | 'DELETED';

export type ExtractionRunStatusValue =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'COST_CAPPED';

export type ConfidenceBandValue = 'HIGH' | 'MED' | 'LOW';

export type ProposalStatusValue = 'PENDING' | 'CONFIRMED' | 'EDITED' | 'DISCARDED';

/** One excerpt of evidence backing a proposal value (mirror of Python `Provenance`). */
export interface ProvenanceItem {
  page: number;
  quote: string;
  confidence: number;
}

/** Aggregate provenance attached to a `PdfFieldProposal.provenance` jsonb cell. */
export interface ProvenanceEnvelope {
  pdfId: string;
  pages: number[];
  excerpt: string;
  sources: ProvenanceItem[];
}

export interface InitiativePdfDTO {
  pdfId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: PdfStatusValue;
  uploadedBy: string;
  uploadedAt: string;
  languageDetected?: string | null;
  retentionUntil?: string | null;
}

export interface PdfExtractionRunDTO {
  runId: string;
  pdfId: string;
  projectId: string;
  status: ExtractionRunStatusValue;
  startedAt?: string | null;
  finishedAt?: string | null;
  costUsd?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  model?: string | null;
  language?: string | null;
  errorReason?: string | null;
}

export interface PdfFieldProposalDTO {
  id: string;
  runId: string;
  fieldPath: string;
  proposedValue: unknown;
  provenance: ProvenanceEnvelope;
  confidence: number;
  confidenceBand: ConfidenceBandValue;
  status: ProposalStatusValue;
  finalValue?: unknown;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
}

/** Body the ai-service is expected to return once TASK-008 lands. */
export interface AiServiceExtractAck {
  runId: string;
  status: ExtractionRunStatusValue | 'pending' | 'running' | 'completed' | 'failed';
}

export const PROPOSAL_RESOLVED_STATUSES: ProposalStatusValue[] = [
  'CONFIRMED',
  'EDITED',
  'DISCARDED',
];
