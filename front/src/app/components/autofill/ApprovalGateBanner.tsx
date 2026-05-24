/* ------------------------------------------------------------------ */
/*  ApprovalGateBanner.tsx - Step-4 gate that blocks "Enviar a revisión" */
/*                                                                       */
/*  Reads the autofill slice for `initiativeId`, lists every unconfirmed */
/*  field, and exposes deep-links that scroll-to-field on click. While   */
/*  N > 0 the parent's submit CTA must be disabled (the caller wires     */
/*  this with the `disabled` flag returned by useApprovalGate).          */
/* ------------------------------------------------------------------ */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  selectUnconfirmedList,
  useAutofillContext,
  type AutofillProposalState,
} from '../../context/AutofillContext';
import { trackAutofillEvent } from '../../services/autofillTelemetry';

interface ApprovalGateBannerProps {
  initiativeId: string;
  /** Optional custom anchor resolver: maps fieldPath → element id. */
  anchorFor?: (fieldPath: string) => string;
}

/** Hook for the consumer to know if the gate is open. */
export function useApprovalGate(initiativeId: string): { count: number; cleared: boolean } {
  const { state } = useAutofillContext();
  const count = useMemo(
    () => selectUnconfirmedList(state, initiativeId).length,
    [state, initiativeId],
  );
  return { count, cleared: count === 0 };
}

export function ApprovalGateBanner({ initiativeId, anchorFor }: ApprovalGateBannerProps) {
  const { state } = useAutofillContext();
  const pending = useMemo(
    () => selectUnconfirmedList(state, initiativeId),
    [state, initiativeId],
  );

  const [expanded, setExpanded] = useState(false);
  const announcedRef = useRef<number | null>(null);
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    if (pending.length > 0 && announcedRef.current !== pending.length) {
      announcedRef.current = pending.length;
      setLiveMessage(`Envío bloqueado. ${pending.length} campos pendientes de confirmación.`);
      trackAutofillEvent('approval_gate_blocked', {
        initiativeId,
        count: pending.length,
      });
    } else if (pending.length === 0 && announcedRef.current !== 0) {
      announcedRef.current = 0;
      setLiveMessage('Todos los campos confirmados. Puedes enviar a revisión.');
      trackAutofillEvent('approval_gate_cleared', { initiativeId });
    }
  }, [pending.length, initiativeId]);

  const handleDeepLink = (fieldPath: string) => {
    const id = anchorFor ? anchorFor(fieldPath) : defaultAnchor(fieldPath);
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the first focusable child for keyboard users
      const focusable = el.querySelector<HTMLElement>(
        'input, textarea, button, [tabindex]',
      );
      focusable?.focus();
    }
  };

  if (pending.length === 0) {
    return (
      <div
        role="region"
        aria-labelledby="approval-gate-title"
        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      >
        <CheckCircle2 size={14} />
        <span id="approval-gate-title" style={{ fontWeight: 500 }}>
          Todos los campos confirmados. Puedes enviar a revisión.
        </span>
        <span aria-live="polite" className="sr-only">
          {liveMessage}
        </span>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-labelledby="approval-gate-title"
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-700 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p
            id="approval-gate-title"
            className="text-sm text-amber-900"
            style={{ fontWeight: 600 }}
          >
            Tienes {pending.length}{' '}
            {pending.length === 1
              ? 'campo propuesto por IA sin confirmar'
              : 'campos propuestos por IA sin confirmar'}
            . Revísalos antes de enviar a tu mentor.
          </p>
          {pending.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-900 underline"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp size={12} /> Ocultar lista
                </>
              ) : (
                <>
                  <ChevronDown size={12} /> Ver los {pending.length} campos
                </>
              )}
            </button>
          )}
          {(expanded || pending.length <= 5) && (
            <ul className="mt-2 space-y-1">
              {pending.map((p) => (
                <li key={p.fieldPath}>
                  <a
                    href={`#${anchorFor ? anchorFor(p.fieldPath) : defaultAnchor(p.fieldPath)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeepLink(p.fieldPath);
                    }}
                    className="inline-flex items-center gap-2 text-xs text-amber-800 hover:text-amber-900 underline"
                  >
                    <span>{labelForFieldPath(p)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <span aria-live="assertive" className="sr-only">
        {liveMessage}
      </span>
    </div>
  );
}

function defaultAnchor(fieldPath: string): string {
  return `field-${fieldPath.replace(/[.[\]]/g, '-')}`;
}

function labelForFieldPath(p: AutofillProposalState): string {
  // Lightweight humanisation; deep label resolution is left to the page.
  const parts = p.fieldPath.split('.');
  const step = parts[0] ?? '';
  const tail = parts.slice(1).join(' · ') || p.fieldPath;
  return `${step.toUpperCase()} — ${tail}`;
}
