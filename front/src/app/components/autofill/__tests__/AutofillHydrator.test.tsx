/**
 * Tests for `AutofillHydrator` — the side-effect-only component mounted in
 * AppLayout that backfills the autofill context on hard refresh / direct
 * navigation. Without this component the user only sees chips immediately
 * after a fresh extraction run because the polling hook is the only writer to
 * `MERGE_FROM_RUN`.
 *
 * Verified behaviours:
 *   1. On mount, calls `listProposals(initiativeId)` and dispatches
 *      `MERGE_FROM_RUN`.
 *   2. Does NOT re-fetch when the slice for that initiative already contains
 *      proposals (avoids clobbering data the polling hook just wrote).
 *   3. Resolves `initiativeId` from `useParams().projectId` when the prop is
 *      omitted — this is how AppLayout uses it.
 *   4. Bails out silently when the feature flag is off (kill-switch parity
 *      with `AutofillField`).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { AutofillProvider, useAutofillContext } from '../../../context/AutofillContext';
import type { AutofillProposalDto } from '../../../services/pdfAutofillService';

// Mock the feature flag — flip per test by toggling the const below.
let featureOn = true;
vi.mock('../../../services/featureFlags', () => ({
  isEnabled: () => true,
  isPdfAutofillEnabled: () => featureOn,
}));

// Mock the service so we never hit HTTP.
vi.mock('../../../services/pdfAutofillService', async () => {
  const actual = await vi.importActual<
    typeof import('../../../services/pdfAutofillService')
  >('../../../services/pdfAutofillService');
  return {
    ...actual,
    listProposals: vi.fn(),
  };
});

import * as svc from '../../../services/pdfAutofillService';
import { AutofillHydrator } from '../AutofillHydrator';

const listProposalsMock = svc.listProposals as ReturnType<typeof vi.fn>;

function makeProposal(fieldPath: string): AutofillProposalDto {
  return {
    fieldPath,
    proposedValue: 'value',
    status: 'unconfirmed',
    provenance: {
      sourcePdfId: 'pdf-1',
      sourcePdfName: 'plan.pdf',
      pageNumbers: [1],
      quotedExcerpt: 'q',
      confidenceScore: 0.9,
      confidenceBand: 'high',
    },
    confidenceScore: 0.9,
    confidenceBand: 'high',
    runId: 'run-1',
  };
}

/**
 * Tiny probe component that exposes the slice for a given initiative so we
 * can assert what the reducer has after the hydrator runs.
 */
function SliceProbe({ initiativeId }: { initiativeId: string }) {
  const { state } = useAutofillContext();
  const slice = state.byInitiative[initiativeId];
  const fieldPaths = slice ? Object.keys(slice).sort().join(',') : '';
  return <div data-testid="slice">{fieldPaths}</div>;
}

beforeEach(() => {
  featureOn = true;
  listProposalsMock.mockReset();
});

describe('AutofillHydrator', () => {
  it('calls listProposals on mount and dispatches MERGE_FROM_RUN with the result', async () => {
    listProposalsMock.mockResolvedValueOnce([
      makeProposal('step0.nombreParticipante'),
      makeProposal('step1.asisData.quiebre'),
    ]);

    const { getByTestId } = render(
      <AutofillProvider>
        <AutofillHydrator initiativeId="init-1" />
        <SliceProbe initiativeId="init-1" />
      </AutofillProvider>,
    );

    await waitFor(() => {
      expect(listProposalsMock).toHaveBeenCalledWith('init-1');
    });

    await waitFor(() => {
      expect(getByTestId('slice').textContent).toBe(
        'step0.nombreParticipante,step1.asisData.quiebre',
      );
    });
  });

  it('does not refetch when the slice for that initiative already has proposals', async () => {
    // Resolve to [] so even if the guard ever lets us through we don't crash the reducer.
    listProposalsMock.mockResolvedValue([]);

    /**
     * Two-phase harness: SeedFirst renders the seeder alone and only mounts
     * the hydrator AFTER React has flushed the seed dispatch. This lets us
     * unambiguously assert that the hydrator skips the network call when the
     * slice it observes on mount already contains proposals — independent of
     * effect-order timing between siblings.
     */
    function SeedThenHydrate() {
      const { dispatch, state } = useAutofillContext();
      React.useEffect(() => {
        dispatch({
          type: 'MERGE_FROM_RUN',
          initiativeId: 'init-2',
          proposals: [makeProposal('step0.x')],
        });
      }, [dispatch]);
      const seeded = !!state.byInitiative['init-2'];
      return seeded ? <AutofillHydrator initiativeId="init-2" /> : null;
    }

    render(
      <AutofillProvider>
        <SeedThenHydrate />
      </AutofillProvider>,
    );

    // Give the seed dispatch a tick and then a second tick for the hydrator's
    // own effect to (not) fire. listProposals must not have been called.
    await new Promise((r) => setTimeout(r, 20));
    expect(listProposalsMock).not.toHaveBeenCalled();
  });

  it('reads initiativeId from useParams().projectId when the prop is omitted', async () => {
    listProposalsMock.mockResolvedValueOnce([makeProposal('step0.origen')]);

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/projects/init-from-route/step/0']}>
        <Routes>
          <Route
            path="/projects/:projectId/step/:stepId"
            element={
              <AutofillProvider>
                <AutofillHydrator />
                <SliceProbe initiativeId="init-from-route" />
              </AutofillProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listProposalsMock).toHaveBeenCalledWith('init-from-route');
    });
    await waitFor(() => {
      expect(getByTestId('slice').textContent).toBe('step0.origen');
    });
  });

  it('is a no-op when the feature flag is off', async () => {
    featureOn = false;
    listProposalsMock.mockResolvedValueOnce([makeProposal('step0.x')]);

    render(
      <AutofillProvider>
        <AutofillHydrator initiativeId="init-3" />
      </AutofillProvider>,
    );

    // Effect should bail out before the network call.
    await new Promise((r) => setTimeout(r, 20));
    expect(listProposalsMock).not.toHaveBeenCalled();
  });
});
