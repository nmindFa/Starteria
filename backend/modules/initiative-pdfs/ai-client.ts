/**
 * Thin HTTP client to the Python ai-service for PDF extraction.
 *
 * V1 authentication: shared token in the `X-Internal-Token` header.
 * TODO(TASK-007): swap shared token for HMAC signed request + request-id propagation
 *   per ADR-011. The signature surface stays the same (callPdfExtract / fetchRunState)
 *   so TASK-007 only changes the internals of this file.
 *
 * The ai-service exposes (per `ai-service/schemas/pdf_extraction.py`):
 *   POST /ai/pdf-extract              -> { runId, status }
 *   GET  /ai/pdf-extract/runs/{runId} -> { runId, status, costUsd?, errorReason? }
 *
 * If the upstream call fails or the service is unavailable, callers should
 * still create the `PdfExtractionRun` row locally and mark it FAILED so the
 * audit trail is preserved.
 */

import { AiServiceExtractAck } from './pdf.types';

export interface AiClientConfig {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

export interface PdfExtractCallInput {
  projectId: string;
  pdfId: string;
  fileName: string;
  pdfBase64: string;
  language?: 'es' | 'en';
  targetStep?: string;
  /** Echoed to the ai-service so logs on both sides correlate. */
  requestId?: string;
}

export interface RunStateResponse {
  runId: string;
  status: string;
  costUsd?: number | null;
  errorReason?: string | null;
  progress?: number;
  /** When status==='completed', contains the nested InitiativeExtraction with FieldProposals per Step. */
  proposals?: Record<string, unknown> | null;
}

export class AiServiceClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(config: AiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      // TODO(TASK-007): replace with HMAC-signed `X-Signature` + `X-Timestamp`.
      'X-Internal-Token': this.token,
      ...(extra ?? {}),
    };
  }

  async callPdfExtract(input: PdfExtractCallInput): Promise<AiServiceExtractAck> {
    const url = `${this.baseUrl}/api/v1/ai/pdf-extract`;
    const body = {
      projectId: input.projectId,
      pdfId: input.pdfId,
      fileName: input.fileName,
      pdfBase64: input.pdfBase64,
      language: input.language,
      targetStep: input.targetStep,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers(input.requestId ? { 'X-Request-Id': input.requestId } : undefined),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `ai-service /ai/pdf-extract failed: ${response.status} ${response.statusText} ${text}`,
      );
    }
    return (await response.json()) as AiServiceExtractAck;
  }

  async fetchRunState(runId: string): Promise<RunStateResponse> {
    const url = `${this.baseUrl}/api/v1/ai/pdf-extract/runs/${encodeURIComponent(runId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `ai-service /ai/pdf-extract/runs/${runId} failed: ${response.status} ${text}`,
      );
    }
    return (await response.json()) as RunStateResponse;
  }
}
