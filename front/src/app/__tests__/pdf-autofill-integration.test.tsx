/* ------------------------------------------------------------------ */
/*  pdf-autofill-integration.test.tsx                                    */
/*                                                                       */
/*  Full end-to-end regression for the PDF auto-fill flow                */
/*  (PRD-002 / SPEC-002 / TASK-009). Covers:                             */
/*                                                                       */
/*    1. Drag & drop a PDF → service.uploadPdf called → onUploadComplete */
/*    2. Hook's polling lifecycle with 500/1000/2000 backoff + proposals */
/*       merged into AutofillContext                                     */
/*    3. AutofillField renders the proposed value (unconfirmed visual    */
/*       state) and exposes provenance                                   */
/*    4. Confirm action calls confirmProposal() and transitions state    */
/*    5. ApprovalGateBanner pending count reflects unconfirmed proposals */
/*    6. Feature flag OFF hides the Step0 uploader section               */
/*    7. Polling timeout → status 'timeout' after MAX_POLL_DURATION_MS   */
/*                                                                       */
/*  Mocking strategy (mirrors usePdfAutofill.test.tsx): we mock the      */
/*  `pdfAutofillService` module so no real axios/fetch traffic occurs.   */
/* ------------------------------------------------------------------ */

import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

// ── Module mocks (hoisted) ─────────────────────────────────────────────────

// Feature flag — default ON; overridden per test where needed.
vi.mock('../services/featureFlags', () => ({
  isEnabled: () => true,
  isPdfAutofillEnabled: () => true,
}));

// Telemetry — silence the console.info spam.
vi.mock('../services/autofillTelemetry', () => ({
  trackAutofillEvent: vi.fn(),
}));

// The HTTP layer. Tests configure each mocked function per-scenario.
vi.mock('../services/pdfAutofillService', () => ({
  uploadPdf: vi.fn(),
  startExtractionRun: vi.fn(),
  getExtractionRunStatus: vi.fn(),
  listProposals: vi.fn(),
  confirmProposal: vi.fn(),
  editProposal: vi.fn(),
  discardProposal: vi.fn(),
  restoreProposal: vi.fn(),
  resolveConflict: vi.fn(),
}));

import * as svc from '../services/pdfAutofillService';
import type { AutofillProposalDto } from '../services/pdfAutofillService';
import * as featureFlags from '../services/featureFlags';
import {
  AutofillProvider,
  useAutofillContext,
} from '../context/AutofillContext';
import { PdfInitiativeUploader } from '../components/PdfInitiativeUploader';
import { AutofillField } from '../components/autofill/AutofillField';
import { ApprovalGateBanner } from '../components/autofill/ApprovalGateBanner';
import { usePdfAutofill } from '../hooks/usePdfAutofill';
import { BACKOFF_INTERVALS_MS } from '../hooks/usePdfAutofill';

// ── Fixtures (drawn from evals/golden/pdf-extraction/test-iniciativa) ──────

function makeProposal(
  fieldPath: string,
  overrides: Partial<AutofillProposalDto> = {},
): AutofillProposalDto {
  return {
    fieldPath,
    proposedValue: 'placeholder',
    status: 'unconfirmed',
    provenance: {
      sourcePdfId: 'pdf-x',
      sourcePdfName: 'iniciativa.pdf',
      pageNumbers: [3],
      quotedExcerpt: 'Fragmento citado del PDF',
      confidenceScore: 0.9,
      confidenceBand: 'high',
    },
    confidenceScore: 0.9,
    confidenceBand: 'high',
    runId: 'run-1',
    ...overrides,
  };
}

const PROPOSAL_ORIGEN = makeProposal('step0.origen', {
  proposedValue: 'problema',
  provenance: {
    sourcePdfId: 'pdf-x',
    sourcePdfName: 'iniciativa.pdf',
    pageNumbers: [3],
    quotedExcerpt:
      'El Reto: Rigidez Operativa — 6,000+ excepciones en 2025 — 5h+ lead time',
    confidenceScore: 0.92,
    confidenceBand: 'high',
  },
  confidenceScore: 0.92,
});

const PROPOSAL_QUIEBRE = makeProposal('step1.asisData.quiebre', {
  proposedValue: 'Esperar autorización desde Lima',
  provenance: {
    sourcePdfId: 'pdf-x',
    sourcePdfName: 'iniciativa.pdf',
    pageNumbers: [2],
    quotedExcerpt: 'necesitamos esperar la autorización desde Lima',
    confidenceScore: 0.85,
    confidenceBand: 'high',
  },
  confidenceScore: 0.85,
});

// ── Helpers ────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }) {
  return <AutofillProvider>{children}</AutofillProvider>;
}

/**
 * Mounts <usePdfAutofill> alongside the AutofillProvider and exposes the
 * hook's value via a global ref so tests can drive it.
 */
function PdfAutofillHarness({
  initiativeId,
  onReady,
}: {
  initiativeId: string;
  onReady: (api: ReturnType<typeof usePdfAutofill>) => void;
}) {
  const api = usePdfAutofill(initiativeId);
  React.useEffect(() => {
    onReady(api);
  });
  return (
    <div>
      <span data-testid="status">{api.status}</span>
      <span data-testid="proposals-count">{api.proposals.length}</span>
      <span data-testid="error-code">{api.error?.code ?? ''}</span>
    </div>
  );
}

/**
 * Seeds a list of proposals into the AutofillContext for the given
 * initiative. Useful for the visual-state and ApprovalGate tests that
 * don't care about the upload+poll round-trip.
 */
function ProposalSeeder({
  initiativeId,
  proposals,
  children,
}: {
  initiativeId: string;
  proposals: AutofillProposalDto[];
  children: React.ReactNode;
}) {
  const { dispatch } = useAutofillContext();
  React.useEffect(() => {
    dispatch({
      type: 'MERGE_FROM_RUN',
      initiativeId,
      proposals,
    });
  }, [dispatch, initiativeId, proposals]);
  return <>{children}</>;
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('PDF autofill — end-to-end integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. PdfInitiativeUploader: drop a PDF → upload triggered + callback
  // ──────────────────────────────────────────────────────────────────────
  it('1. dropping a PDF triggers uploadPdf and fires onUploadComplete', async () => {
    (svc.uploadPdf as ReturnType<typeof vi.fn>).mockResolvedValue({
      pdfId: 'pdf-x',
      fileName: 'test.pdf',
      sizeBytes: 1024,
    });

    const onComplete = vi.fn();

    render(
      <Wrapper>
        <PdfInitiativeUploader
          initiativeId="proj-1"
          onUploadComplete={onComplete}
        />
      </Wrapper>,
    );

    const file = new File(['%PDF-1.4 fake'], 'test.pdf', {
      type: 'application/pdf',
    });

    // The hidden <input type="file"> is the simplest entry-point for fireEvent
    // — drag-and-drop in jsdom is notoriously flaky. Both code paths funnel
    // through handleFiles → enqueueAndUpload.
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(svc.uploadPdf).toHaveBeenCalledTimes(1);
    });
    expect(svc.uploadPdf).toHaveBeenCalledWith(
      'proj-1',
      expect.any(File),
      expect.any(Function),
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(onComplete).toHaveBeenCalledWith(
      'pdf-x',
      expect.objectContaining({ pdfId: 'pdf-x', state: 'ready' }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. usePdfAutofill happy-path with the documented backoff sequence
  // ──────────────────────────────────────────────────────────────────────
  describe('2. polling lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('progresses idle → running → done and merges proposals into context', async () => {
      (svc.startExtractionRun as ReturnType<typeof vi.fn>).mockResolvedValue({
        runId: 'run-1',
      });
      (svc.getExtractionRunStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ runId: 'run-1', status: 'queued' })
        .mockResolvedValueOnce({ runId: 'run-1', status: 'running' })
        .mockResolvedValueOnce({ runId: 'run-1', status: 'completed' });
      (svc.listProposals as ReturnType<typeof vi.fn>).mockResolvedValue([
        PROPOSAL_ORIGEN,
        PROPOSAL_QUIEBRE,
      ]);

      let hookApi: ReturnType<typeof usePdfAutofill> | null = null;
      const onReady = (api: ReturnType<typeof usePdfAutofill>) => {
        hookApi = api;
      };

      render(
        <Wrapper>
          <PdfAutofillHarness initiativeId="proj-1" onReady={onReady} />
        </Wrapper>,
      );

      expect(screen.getByTestId('status').textContent).toBe('idle');

      // Kick off the run.
      await act(async () => {
        await hookApi!.startExtraction('pdf-x', 'all');
      });
      expect(screen.getByTestId('status').textContent).toBe('running');

      // Drive the backoff. The hook fires the first poll after 500ms, then
      // 1000ms, then 2000ms…
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BACKOFF_INTERVALS_MS[0] + 5); // 500
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BACKOFF_INTERVALS_MS[1] + 5); // 1000
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BACKOFF_INTERVALS_MS[2] + 5); // 2000
      });

      // finalizeRun runs after the completed poll resolves; with fake timers
      // installed, the standard waitFor polls would never tick — instead we
      // flush the pending microtasks via the act() above.
      // Allow one extra tick to drain finalizeRun's async chain.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId('status').textContent).toBe('done');

      expect(svc.getExtractionRunStatus).toHaveBeenCalledTimes(3);
      expect(svc.listProposals).toHaveBeenCalledWith('proj-1', 'run-1');
      expect(screen.getByTestId('proposals-count').textContent).toBe('2');
      expect(hookApi!.proposals.map((p) => p.fieldPath)).toEqual([
        'step0.origen',
        'step1.asisData.quiebre',
      ]);
    });

    // ────────────────────────────────────────────────────────────────────
    // 7. Polling timeout — returned in this block to reuse fake timers
    // ────────────────────────────────────────────────────────────────────
    it('7. emits AUTOFILL_TIMEOUT when polling exceeds MAX_POLL_DURATION_MS', async () => {
      (svc.startExtractionRun as ReturnType<typeof vi.fn>).mockResolvedValue({
        runId: 'run-timeout',
      });
      (svc.getExtractionRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        { runId: 'run-timeout', status: 'running' },
      );

      let hookApi: ReturnType<typeof usePdfAutofill> | null = null;
      render(
        <Wrapper>
          <PdfAutofillHarness
            initiativeId="proj-1"
            onReady={(api) => {
              hookApi = api;
            }}
          />
        </Wrapper>,
      );

      await act(async () => {
        await hookApi!.startExtraction('pdf-x');
      });
      expect(screen.getByTestId('status').textContent).toBe('running');

      // Crank far past MAX_POLL_DURATION_MS (600s after the bump documented in
      // usePdfAutofill.ts). Each tick is capped at 5s once we exhaust the
      // initial backoff, so 130 iterations × 5s = 650s comfortably crosses it.
      for (let i = 0; i < 130; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });
        if (screen.getByTestId('status').textContent === 'timeout') break;
      }

      expect(screen.getByTestId('status').textContent).toBe('timeout');
      expect(screen.getByTestId('error-code').textContent).toBe(
        'AUTOFILL_TIMEOUT',
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. AutofillField renders the proposed value with the IA chip
  // ──────────────────────────────────────────────────────────────────────
  it('3. AutofillField renders proposed value + provenance affordance', async () => {
    const onChange = vi.fn();

    render(
      <Wrapper>
        <ProposalSeeder
          initiativeId="proj-1"
          proposals={[PROPOSAL_ORIGEN]}
        >
          <AutofillField
            fieldPath="step0.origen"
            initiativeId="proj-1"
            value=""
            onChange={onChange}
            label="Origen"
          >
            {({ value, onChange: localChange, readOnly }) => (
              <input
                aria-label="origen-input"
                value={String(value ?? '')}
                onChange={(e) => localChange(e.target.value)}
                readOnly={readOnly}
              />
            )}
          </AutofillField>
        </ProposalSeeder>
      </Wrapper>,
    );

    // The wrapper exposes the visual state as a data attribute (see ADR-005).
    const wrapper = await screen.findByLabelText(
      /Valor propuesto por inteligencia artificial/i,
    );
    expect(wrapper.getAttribute('data-autofill-state')).toBe(
      'ai-proposed-unconfirmed',
    );
    expect(wrapper.getAttribute('data-field-path')).toBe('step0.origen');

    // Proposed value should be reflected in the input (effectiveValue path).
    const input = screen.getByLabelText('origen-input') as HTMLInputElement;
    expect(input.value).toBe('problema');
    expect(input.readOnly).toBe(true);

    // "Ver origen" button opens the provenance popover.
    const openOrigin = screen.getByRole('button', {
      name: /Ver origen de la propuesta/i,
    });
    fireEvent.click(openOrigin);

    const popover = await screen.findByRole('dialog', {
      name: /Origen de la propuesta IA/i,
    });
    expect(popover).toBeInTheDocument();
    expect(popover.textContent).toMatch(/iniciativa\.pdf/);
    expect(popover.textContent).toMatch(/p\.\s*3/);
    expect(popover.textContent).toMatch(/Rigidez Operativa/);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. Confirm action calls backend AND transitions state
  // ──────────────────────────────────────────────────────────────────────
  it('4. clicking Confirmar calls confirmProposal and updates onChange', async () => {
    (svc.confirmProposal as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...PROPOSAL_ORIGEN,
      status: 'confirmed',
    });

    const onChange = vi.fn();

    render(
      <Wrapper>
        <ProposalSeeder
          initiativeId="proj-1"
          proposals={[PROPOSAL_ORIGEN]}
        >
          <AutofillField
            fieldPath="step0.origen"
            initiativeId="proj-1"
            value=""
            onChange={onChange}
            label="Origen"
          >
            {({ value, onChange: localChange, readOnly }) => (
              <input
                aria-label="origen-input"
                value={String(value ?? '')}
                onChange={(e) => localChange(e.target.value)}
                readOnly={readOnly}
              />
            )}
          </AutofillField>
        </ProposalSeeder>
      </Wrapper>,
    );

    const confirmBtn = await screen.findByRole('button', {
      name: /Confirmar/i,
    });

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(svc.confirmProposal).toHaveBeenCalledTimes(1);
    });
    // confirmProposal(initiativeId, runId, fieldPath)
    expect(svc.confirmProposal).toHaveBeenCalledWith(
      'proj-1',
      'run-1',
      'step0.origen',
    );

    // The render-prop's onChange must receive the proposed value.
    expect(onChange).toHaveBeenCalledWith('problema');

    // State transitions to ai-proposed-confirmed (the wrapper no longer
    // carries the "unconfirmed" data-attribute and the toolbar disappears).
    await waitFor(() => {
      const wrapper = screen.queryByLabelText(
        /Valor propuesto por inteligencia artificial/i,
      );
      expect(wrapper).toBeNull();
    });

    // Confirmed-state wrapper exposes the new data-attribute.
    const confirmedWrapper = screen.getByLabelText(
      /Campo confirmado por el founder/i,
    );
    expect(confirmedWrapper.getAttribute('data-autofill-state')).toBe(
      'ai-proposed-confirmed',
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. ApprovalGateBanner pending count
  // ──────────────────────────────────────────────────────────────────────
  it('5. ApprovalGateBanner reflects the unconfirmed count (US-017)', async () => {
    (svc.confirmProposal as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined,
    );

    function GateHarness() {
      const { dispatch } = useAutofillContext();
      React.useEffect(() => {
        dispatch({
          type: 'MERGE_FROM_RUN',
          initiativeId: 'proj-1',
          proposals: [
            PROPOSAL_ORIGEN,
            PROPOSAL_QUIEBRE,
            makeProposal('step0.respaldo', { proposedValue: 'datos' }),
          ],
        });
      }, [dispatch]);

      const confirmOne = () => {
        dispatch({
          type: 'CONFIRM',
          initiativeId: 'proj-1',
          fieldPath: 'step0.origen',
        });
      };

      return (
        <>
          <button type="button" onClick={confirmOne} data-testid="confirm-one">
            confirm-one
          </button>
          <ApprovalGateBanner initiativeId="proj-1" />
        </>
      );
    }

    render(
      <Wrapper>
        <GateHarness />
      </Wrapper>,
    );

    // 3 pending → banner displays "3"
    await waitFor(() => {
      expect(
        screen.getByText(/Tienes 3 campos propuestos por IA sin confirmar/i),
      ).toBeInTheDocument();
    });

    const linksBefore = screen.getAllByRole('link');
    expect(linksBefore).toHaveLength(3);

    // Confirm one → drops to 2.
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-one'));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Tienes 2 campos propuestos por IA sin confirmar/i),
      ).toBeInTheDocument();
    });

    const linksAfter = screen.getAllByRole('link');
    expect(linksAfter).toHaveLength(2);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Feature flag OFF hides the uploader section
  // ──────────────────────────────────────────────────────────────────────
  it('6. when feature flag is OFF, the Step0 uploader section is not rendered', () => {
    // The actual <Step0Page /> pulls in AppContext, react-router useParams,
    // and a number of nested side-effects (autosave, etc.) that are too
    // heavy for a focused regression on the feature-flag gate. Per the
    // brief, we isolate the conditional render here by reproducing the
    // exact gating expression used in Step0Page.tsx:
    //
    //   {autofillEnabled && projectId && ( <Section …> )}
    //
    // — flipping isPdfAutofillEnabled() to false must suppress the heading
    // copy "¿Tienes un documento de tu iniciativa?".
    const enabledSpy = vi
      .spyOn(featureFlags, 'isPdfAutofillEnabled')
      .mockReturnValue(false);

    function FlaggedSection() {
      const enabled = featureFlags.isPdfAutofillEnabled();
      const projectId = 'proj-1';
      return (
        <div>
          <h1>Punto de partida</h1>
          {enabled && projectId && (
            <section data-testid="pdf-uploader-section">
              <h2>¿Tienes un documento de tu iniciativa?</h2>
              <PdfInitiativeUploader initiativeId={projectId} />
            </section>
          )}
          {/* Rest of the form stays visible — uploader is additive. */}
          <form data-testid="step0-form">
            <input aria-label="nombre" />
          </form>
        </div>
      );
    }

    render(
      <Wrapper>
        <FlaggedSection />
      </Wrapper>,
    );

    expect(
      screen.queryByText(/¿Tienes un documento de tu iniciativa\?/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-uploader-section')).not.toBeInTheDocument();

    // The form below the gated section must remain — gate is additive.
    expect(screen.getByTestId('step0-form')).toBeInTheDocument();
    expect(screen.getByLabelText('nombre')).toBeInTheDocument();

    enabledSpy.mockRestore();
  });
});
