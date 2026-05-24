/* ----------------------------------------------------------------------- */
/*  DashboardPdfDropzone — Mis proyectos / dashboard-level PDF entry.      */
/*                                                                          */
/*  Flow:                                                                   */
/*    1. User drops a PDF (or picks from picker).                          */
/*    2. We auto-derive the initiative name from the filename.             */
/*    3. createProject(name) via AppContext → new projectId.               */
/*    4. uploadPdf(projectId, file) → pdfId.                               */
/*    5. startExtraction(pdfId, 'all') via pdfAutofillService.             */
/*    6. Redirect to /projects/:projectId — the ProjectHomePage's          */
/*       autofill card will display the polling state + final proposals.   */
/*                                                                          */
/*  Gated by `feature.pdfAutofill` (VITE_FEATURE_PDF_AUTOFILL=true).        */
/* ----------------------------------------------------------------------- */

import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkles, Loader2, AlertCircle, FileText, UploadCloud } from 'lucide-react';

import { useApp } from '../context/AppContext';
import { isPdfAutofillEnabled } from '../services/featureFlags';
import { uploadPdf, startExtractionRun } from '../services/pdfAutofillService';

const MAX_BYTES = 50 * 1024 * 1024; // 50MB per TASK-006
const ACCEPTED_MIME = 'application/pdf';

type Phase = 'idle' | 'creating' | 'uploading' | 'extracting' | 'failed';

function nameFromFile(file: File): string {
  // Strip .pdf, replace separators with spaces, trim, fall back if empty.
  const raw = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  return raw.length >= 3 ? raw : 'Iniciativa sin nombre';
}

export function DashboardPdfDropzone() {
  const enabled = isPdfAutofillEnabled();
  const { createProject } = useApp();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]; // dashboard intake = single file

    setError(null);

    // Client-side validation mirrors TASK-006 backend limits.
    if (file.type !== ACCEPTED_MIME && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se aceptan archivos PDF.');
      setPhase('failed');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`El PDF supera los 50MB (peso: ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      setPhase('failed');
      return;
    }

    const initiativeName = nameFromFile(file);

    setPhase('creating');
    setProgressPct(5);
    const result = await createProject(initiativeName);
    if (!result.success) {
      setError(result.error ?? 'No pudimos crear la iniciativa.');
      setPhase('failed');
      return;
    }
    const projectId = result.project.id;
    setProgressPct(15);

    setPhase('uploading');
    let upload;
    try {
      upload = await uploadPdf(projectId, file, (pct) => {
        // Map upload pct to 15..70 range so the bar feels continuous.
        setProgressPct(15 + Math.floor(pct * 0.55));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos subir el PDF.');
      setPhase('failed');
      // Still redirect to the project — the user can retry from the home card.
      navigate(`/projects/${projectId}`);
      return;
    }
    setProgressPct(75);

    setPhase('extracting');
    try {
      await startExtractionRun(projectId, upload.pdfId, 'all');
    } catch (err) {
      // Extraction failure is non-fatal here — the project exists, the PDF is stored,
      // and the user can retry from the ProjectHomePage card. Just surface a warning.
      setError(
        err instanceof Error
          ? `Iniciativa creada pero la extracción no arrancó: ${err.message}. Entra al proyecto para reintentar.`
          : 'La extracción no pudo iniciarse. Entra al proyecto para reintentar.',
      );
    }
    setProgressPct(100);

    // Land on the project home where the existing autofill card shows polling.
    navigate(`/projects/${projectId}`);
  }, [createProject, navigate]);

  if (!enabled) return null;

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (phase === 'creating' || phase === 'uploading' || phase === 'extracting') return;
    void handleFiles(e.dataTransfer.files);
  };

  const onPickClick = () => {
    if (phase === 'creating' || phase === 'uploading' || phase === 'extracting') return;
    inputRef.current?.click();
  };

  const isBusy = phase === 'creating' || phase === 'uploading' || phase === 'extracting';

  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 mb-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Sparkles size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
            ¿Tienes un documento de tu iniciativa?
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
            Sube un PDF (plan, propuesta, deck, investigación) y crearemos una iniciativa nueva
            con los Pasos 0–4 pre-llenados por el agente. Tú revisas y confirmas cada campo
            antes de avanzar.
          </p>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Subir PDF para crear iniciativa con autocompletado"
        aria-disabled={isBusy}
        onClick={onPickClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPickClick();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-amber-500 bg-amber-100/60'
            : isBusy
              ? 'border-slate-300 bg-white cursor-not-allowed'
              : 'border-amber-300 bg-white hover:bg-amber-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
          disabled={isBusy}
        />
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <UploadCloud size={32} className="text-amber-600" />
            <p className="text-sm" style={{ fontWeight: 600 }}>
              Arrastra tu PDF aquí o haz click para seleccionar
            </p>
            <p className="text-xs text-slate-500">
              Solo PDF · máximo 50MB · 1 archivo
            </p>
          </div>
        )}
        {phase === 'creating' && (
          <Phase label="Creando iniciativa…" pct={progressPct} icon={<Loader2 className="animate-spin" size={20} />} />
        )}
        {phase === 'uploading' && (
          <Phase label="Subiendo PDF…" pct={progressPct} icon={<FileText size={20} />} />
        )}
        {phase === 'extracting' && (
          <Phase label="Iniciando extracción y redirigiendo…" pct={progressPct} icon={<Sparkles size={20} className="text-amber-600" />} />
        )}
        {phase === 'failed' && error && (
          <div className="flex flex-col items-center gap-2 text-rose-700">
            <AlertCircle size={24} />
            <p className="text-sm" style={{ fontWeight: 600 }}>No pudimos procesar el PDF</p>
            <p className="text-xs text-rose-600 max-w-md">{error}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPhase('idle'); setError(null); setProgressPct(0); }}
              className="text-xs underline text-rose-700 mt-1"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Phase({ label, pct, icon }: { label: string; pct: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-amber-600">{icon}</div>
      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</p>
      <div className="w-full max-w-xs h-2 bg-amber-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-500">{pct}%</p>
    </div>
  );
}
