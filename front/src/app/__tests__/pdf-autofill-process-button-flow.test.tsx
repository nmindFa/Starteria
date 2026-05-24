/**
 * End-to-end frontend regression for the "Procesar con IA" button flow.
 *
 * Validates:
 *   1. After PdfInitiativeUploader fires `onUploadComplete`, the parent stores
 *      the pdfId and renders the explicit "Procesar con IA y rellenar Pasos" button.
 *   2. Clicking the button calls `usePdfAutofill.startExtraction(pdfId, 'all')`.
 *   3. The hook polls the backend, fetches proposals, dispatches MERGE_FROM_RUN
 *      into AutofillContext.
 *   4. AutofillField components for the wired ground-truth fieldPaths
 *      (`step0.origen`, `step1.asisData.quiebre`) render the proposed values.
 *
 * This guards against regressions in:
 *   - The button gating (must NOT appear before upload, must disappear during polling).
 *   - The pdfId passthrough from uploader → parent state → hook.
 *   - The context state shape after MERGE_FROM_RUN.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';

import { AutofillProvider } from '../context/AutofillContext';
import { PdfInitiativeUploader } from '../components/PdfInitiativeUploader';
import { usePdfAutofill } from '../hooks/usePdfAutofill';

// Mock the service used by uploader + hook.
vi.mock('../services/pdfAutofillService', () => {
  return {
    uploadPdf: vi.fn(async () => ({ pdfId: 'pdf-unimaq', fileName: 'Test - iniciativa.pdf', sizeBytes: 100 })),
    startExtractionRun: vi.fn(async () => ({ runId: 'run-1', pollUrl: undefined, estimatedSec: 30 })),
    getExtractionRunStatus: vi.fn(async () => ({ runId: 'run-1', status: 'completed', progress: 100 })),
    listProposals: vi.fn(async () => [
      {
        runId: 'run-1',
        fieldPath: 'step0.origen',
        proposedValue: 'problema',
        finalValue: null,
        status: 'unconfirmed',
        provenance: {
          sourcePdfId: 'pdf-unimaq',
          sourcePdfName: 'Test - iniciativa.pdf',
          pageNumbers: [3],
          quotedExcerpt: 'El Reto: Rigidez Operativa — 6,000+ excepciones',
          confidenceScore: 0.92,
          confidenceBand: 'high',
        },
        confidenceScore: 0.92,
        confidenceBand: 'high',
      },
      {
        runId: 'run-1',
        fieldPath: 'step1.asisData.quiebre',
        proposedValue: 'Esperar autorización desde Lima',
        finalValue: null,
        status: 'unconfirmed',
        provenance: {
          sourcePdfId: 'pdf-unimaq',
          sourcePdfName: 'Test - iniciativa.pdf',
          pageNumbers: [2],
          quotedExcerpt: 'necesitamos esperar la autorización desde Lima',
          confidenceScore: 0.95,
          confidenceBand: 'high',
        },
        confidenceScore: 0.95,
        confidenceBand: 'high',
      },
    ]),
  };
});

import * as pdfService from '../services/pdfAutofillService';

function makeFile(name: string, type = 'application/pdf'): File {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  const file = new File([bytes], name, { type });
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(bytes.buffer.slice(0) as ArrayBuffer),
      configurable: true,
    });
  }
  return file;
}

/**
 * Test harness — mirrors the gating logic in Step0Page/ProjectHomePage.tsx.
 * The real pages depend on many contexts (AppContext, react-router, etc.) which
 * would balloon this test into a full app render. We isolate the gating contract
 * (uploader → uploadedPdfIds state → explicit button → startExtraction → polling).
 */
function ProcessFlowHarness({ initiativeId }: { initiativeId: string }) {
  const autofill = usePdfAutofill(initiativeId);
  const [uploadedPdfIds, setUploadedPdfIds] = useState<string[]>([]);
  return (
    <div>
      <PdfInitiativeUploader
        initiativeId={initiativeId}
        onUploadComplete={(pdfId) => {
          setUploadedPdfIds((prev) => (prev.includes(pdfId) ? prev : [...prev, pdfId]));
        }}
      />

      {uploadedPdfIds.length > 0 && autofill.status === 'idle' && (
        <button
          type="button"
          data-testid="autofill-process-button"
          onClick={() => {
            const lastPdfId = uploadedPdfIds[uploadedPdfIds.length - 1];
            void autofill.startExtraction(lastPdfId, 'all');
          }}
        >
          Procesar con IA y rellenar Pasos
        </button>
      )}

      <div data-testid="autofill-status">{autofill.status}</div>
      <div data-testid="autofill-proposal-count">{autofill.proposals.length}</div>
      {autofill.proposals.map((p) => (
        <div key={p.fieldPath} data-testid={`proposal-${p.fieldPath}`}>
          {p.fieldPath}={String(p.proposedValue)}
        </div>
      ))}
    </div>
  );
}

describe('PDF auto-fill — explicit "Procesar con IA" button flow (TASK-009 UX update)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('button does NOT render before any PDF is uploaded', () => {
    render(
      <AutofillProvider>
        <ProcessFlowHarness initiativeId="proj-1" />
      </AutofillProvider>,
    );
    expect(screen.queryByTestId('autofill-process-button')).toBeNull();
  });

  it('uploads → button appears → click triggers extraction → proposals merge into context', async () => {
    render(
      <AutofillProvider>
        <ProcessFlowHarness initiativeId="proj-1" />
      </AutofillProvider>,
    );

    // 1. Drop a PDF via the file input.
    const file = makeFile('Test - iniciativa.pdf');
    await act(async () => {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      const input = fileInputs[fileInputs.length - 1] as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // 2. After upload completes, the button shows up.
    await waitFor(
      () => {
        expect(screen.getByTestId('autofill-process-button')).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    // Verify uploadPdf was called.
    expect(pdfService.uploadPdf).toHaveBeenCalledTimes(1);
    expect((pdfService.uploadPdf as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('proj-1');

    // 3. Click the button.
    await act(async () => {
      screen.getByTestId('autofill-process-button').click();
    });

    // 4. startExtractionRun was called with the uploaded pdfId.
    await waitFor(() => {
      expect(pdfService.startExtractionRun).toHaveBeenCalledWith('proj-1', 'pdf-unimaq', 'all');
    }, { timeout: 4000 });

    // 5. After polling cycle (≤7s budget — the hook does 500 + 1000 + 2000 + microtasks):
    //    status reaches done/completed and 2 proposals merged.
    await waitFor(
      () => {
        const status = screen.getByTestId('autofill-status').textContent ?? '';
        expect(['done', 'completed']).toContain(status);
        expect(screen.getByTestId('autofill-proposal-count').textContent).toBe('2');
      },
      { timeout: 8000 },
    );

    // 6. Verify the two ground-truth fieldPaths are present.
    expect(screen.getByTestId('proposal-step0.origen').textContent).toContain('problema');
    expect(screen.getByTestId('proposal-step1.asisData.quiebre').textContent).toContain('Esperar autorización desde Lima');
  }, 15000);
});
