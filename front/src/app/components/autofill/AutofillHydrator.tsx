/* ------------------------------------------------------------------ */
/*  AutofillHydrator.tsx — Hydrates the autofill context on mount         */
/*                                                                        */
/*  Why it exists:                                                        */
/*    `AutofillProvider` lives in RootLayout (ABOVE the router) so it     */
/*    can't read `:projectId` from `useParams`. The only writer to        */
/*    `MERGE_FROM_RUN` was `usePdfAutofill.finalizeRun`, which only fires */
/*    AFTER a fresh extraction run completes. That means a hard refresh, */
/*    a navigation away-and-back, or any direct landing on                */
/*    `/projects/:id/step/N` leaves the context empty and the user sees   */
/*    NO chips, even though the proposals are happily persisted server-   */
/*    side.                                                               */
/*                                                                        */
/*  What it does:                                                         */
/*    - Reads the active `initiativeId` (either from props, or from       */
/*      `useParams` so it auto-discovers `:projectId` when mounted in a   */
/*      shared layout).                                                   */
/*    - Once per `initiativeId`, calls                                    */
/*      `GET /initiatives/:id/autofill-proposals` and dispatches          */
/*      `MERGE_FROM_RUN` with the result.                                 */
/*    - Returns `null` — pure side effect, no DOM.                        */
/*    - Skips refetch when the slice for that initiative already has at   */
/*      least one proposal (the polling hook may have populated it first).*/
/*    - Coexists safely with `usePdfAutofill` because the reducer's       */
/*      `MERGE_FROM_RUN` never demotes a confirmed/edited proposal back   */
/*      to unconfirmed and only overwrites unconfirmed entries when a new */
/*      candidate beats existing confidence by ≥ 0.10                     */
/*      (AutofillContext.tsx:124).                                        */
/*                                                                        */
/*  Feature flag: when `isPdfAutofillEnabled()` is false we bail out      */
/*  before making the network call so the flag remains a strict kill-     */
/*  switch (matches the gating in `AutofillField`).                       */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { useAutofillContext } from '../../context/AutofillContext';
import { listProposals } from '../../services/pdfAutofillService';
import { isPdfAutofillEnabled } from '../../services/featureFlags';

export interface AutofillHydratorProps {
  /**
   * Explicit initiative id. When omitted the hydrator falls back to
   * `useParams().projectId`, which lets the component be mounted in a shared
   * layout (e.g. AppLayout) without each page needing to forward the id.
   */
  initiativeId?: string;
}

export function AutofillHydrator({ initiativeId }: AutofillHydratorProps = {}) {
  const params = useParams<{ projectId?: string }>();
  const resolvedId = initiativeId ?? params.projectId;

  const { state, dispatch } = useAutofillContext();

  // Track which initiativeIds we've already hydrated so we don't refire on
  // every re-render. A ref (not state) is used so flipping it doesn't trigger
  // another render itself.
  const hydratedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!resolvedId) return;
    if (!isPdfAutofillEnabled()) return;
    if (hydratedRef.current.has(resolvedId)) return;

    // If the polling hook already populated the slice for this initiative,
    // skip the network round-trip. The slice is keyed by initiativeId and
    // each value is a `Record<fieldPath, AutofillProposalState>`; a populated
    // bucket means at least one MERGE_FROM_RUN has already landed.
    const existing = state.byInitiative[resolvedId];
    if (existing && Object.keys(existing).length > 0) {
      hydratedRef.current.add(resolvedId);
      return;
    }

    let cancelled = false;
    hydratedRef.current.add(resolvedId);

    void (async () => {
      try {
        const proposals = await listProposals(resolvedId);
        if (cancelled) return;
        // Defensive: backend may return [] (no completed runs yet) — dispatching
        // with an empty list is a cheap no-op for the reducer and keeps the
        // hydrated set honest. Guard against non-array payloads (a stubbed
        // service returning `undefined` would crash the reducer's `for..of`).
        dispatch({
          type: 'MERGE_FROM_RUN',
          initiativeId: resolvedId,
          proposals: Array.isArray(proposals) ? proposals : [],
        });
      } catch {
        // Hydration is best-effort. A 4xx/5xx here should NOT bubble up to the
        // user — the page still renders, just without autofill chips. Drop the
        // entry from the hydrated set so a subsequent mount can retry.
        hydratedRef.current.delete(resolvedId);
      }
    })();

    return () => {
      cancelled = true;
    };
    // We intentionally exclude `state.byInitiative` from deps: it would re-run
    // the effect every time the reducer updated, defeating the once-per-id
    // guard. The hydratedRef set is the source of truth instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId, dispatch]);

  return null;
}
