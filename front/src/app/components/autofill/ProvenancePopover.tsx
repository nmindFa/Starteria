/* ------------------------------------------------------------------ */
/*  ProvenancePopover.tsx - "Where did this come from?" inline popover   */
/*                                                                       */
/*  Renders the dominant provenance for an autofill proposal:            */
/*    - PDF filename                                                     */
/*    - page numbers (compact list, e.g. "p. 3, 4" or "p. 2-3")          */
/*    - excerpt ≤ 280 chars in a semantic <blockquote>                   */
/*    - confidence band label + numeric score                            */
/*    - optional original (untranslated) excerpt in a <details> block    */
/*    - optional secondary sources at the foot                           */
/* ------------------------------------------------------------------ */

import React from 'react';
import { FileText, X } from 'lucide-react';
import type { ProvenanceEntry } from '../../services/pdfAutofillService';

interface ProvenancePopoverProps {
  open: boolean;
  onClose: () => void;
  provenance: ProvenanceEntry;
  secondarySources?: ProvenanceEntry[];
  popoverId: string;
}

const BAND_LABEL: Record<ProvenanceEntry['confidenceBand'], string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

function compactPages(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return sorted.length === 1 ? `p. ${ranges[0]}` : `p. ${ranges.join(', ')}`;
}

export function ProvenancePopover({
  open,
  onClose,
  provenance,
  secondarySources = [],
  popoverId,
}: ProvenancePopoverProps) {
  if (!open) return null;

  return (
    <div
      id={popoverId}
      role="dialog"
      aria-modal="false"
      aria-label="Origen de la propuesta IA"
      className="absolute z-30 mt-2 w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-xs text-slate-700"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText size={13} className="text-violet-500 shrink-0" />
          <span className="truncate" style={{ fontWeight: 600 }}>
            {provenance.sourcePdfName}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600"
        >
          <X size={13} />
        </button>
      </div>

      <p className="text-slate-500 mb-2">{compactPages(provenance.pageNumbers)}</p>

      <blockquote className="border-l-2 border-violet-200 pl-2 italic text-slate-700 mb-2">
        “{provenance.quotedExcerpt.slice(0, 280)}”
      </blockquote>

      <p className="text-slate-500 mb-2">
        Confianza{' '}
        <span style={{ fontWeight: 600 }} className="text-slate-700">
          {BAND_LABEL[provenance.confidenceBand]}
        </span>{' '}
        ({provenance.confidenceScore.toFixed(2)})
      </p>

      {provenance.originalExcerpt && (
        <details className="mb-2">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
            Ver extracto original
          </summary>
          <blockquote className="mt-1 border-l-2 border-slate-200 pl-2 italic text-slate-600">
            “{provenance.originalExcerpt.slice(0, 280)}”
          </blockquote>
        </details>
      )}

      {secondarySources.length > 0 && (
        <p className="text-slate-500 border-t border-slate-100 pt-2">
          Otros documentos también respaldan este valor:{' '}
          {secondarySources
            .map((s) => `${s.sourcePdfName} (${compactPages(s.pageNumbers)})`)
            .join(', ')}
          .
        </p>
      )}
    </div>
  );
}
