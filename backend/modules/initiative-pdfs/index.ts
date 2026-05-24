/**
 * Public surface of the initiative-pdfs module.
 *
 * Other backend modules (portfolio guard, future sweepers) and the frontend
 * (TASK-009 dropzone + review panel via shared types) import from here.
 */

export * from './pdf.types';
export { pdfRouter, initiativePdfService } from './pdf.router';
export { PdfService } from './pdf.service';
export { LocalDiskPdfStorage } from './storage.service';
export type { IPdfStorage, PdfStorageMetadata, SavePdfInput } from './storage.service';
export { AiServiceClient } from './ai-client';
export {
  ALLOWED_PDF_MIME,
  MAX_PDF_BYTES,
  extractRequestSchema,
  editProposalSchema,
} from './pdf.schemas';
