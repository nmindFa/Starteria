import React from 'react';
import { X, Sparkles, CheckCircle2, ArrowRight, Lightbulb, AlertCircle } from 'lucide-react';

export interface MentorVirtualFeedback {
  claro: string[];
  faltaPrecisar: string[];
  preguntas: string[];
  siguienteAccion: string;
}

interface MentorVirtualPanelProps {
  open: boolean;
  onClose: () => void;
  context?: string;
  feedback?: MentorVirtualFeedback;
  loading?: boolean;
}

const DEFAULT_FEEDBACK: MentorVirtualFeedback = {
  claro: [
    'Identificaste el proceso y el área de impacto.',
    'El contexto que describes es concreto y accionable.',
    'Tienes claridad sobre a quién le afecta más.',
  ],
  faltaPrecisar: [
    'El alcance puede ser más específico: ¿qué etapa concreta del proceso?',
    'Falta un número que ancle el impacto real (frecuencia, tiempo, costo).',
    'No queda claro si ya conversaste esto con tu equipo o directivos.',
    'La causa que describes puede ser un síntoma; puede haber una causa más profunda.',
  ],
  preguntas: [
    '¿Cuántas personas se ven afectadas por semana o por mes?',
    '¿Cuánto tiempo llevas observando este problema?',
    '¿Alguien ya intentó resolverlo antes? ¿Qué pasó?',
    '¿Tienes datos concretos para medir el estado actual?',
  ],
  siguienteAccion: 'Agrega un dato concreto —número, frecuencia o impacto medible— para darle más fuerza a lo que describes.',
};

export function MentorVirtualPanel({
  open,
  onClose,
  context,
  feedback = DEFAULT_FEEDBACK,
  loading = false,
}: MentorVirtualPanelProps) {
  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Sliding panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
              <Sparkles size={15} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Mentor virtual</h2>
              {context && (
                <p className="text-xs text-slate-400 mt-0.5">{context}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin" />
              <p className="text-sm text-slate-500">Analizando tu contenido…</p>
            </div>
          ) : (
            <>
              {/* Lo que está claro */}
              <div>
                <p className="text-xs text-emerald-600 mb-2.5" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                  ✓ LO QUE ESTÁ CLARO
                </p>
                <ul className="space-y-2.5">
                  {feedback.claro.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Lo que falta precisar */}
              <div>
                <p className="text-xs text-amber-600 mb-2.5" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                  ⚠ LO QUE FALTA PRECISAR
                </p>
                <ul className="space-y-2.5">
                  {feedback.faltaPrecisar.slice(0, 5).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Preguntas */}
              <div>
                <p className="text-xs text-violet-600 mb-2.5" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                  ? PREGUNTAS PARA REFLEXIONAR
                </p>
                <ul className="space-y-2.5">
                  {feedback.preguntas.slice(0, 5).map((q, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 italic">
                      <ArrowRight size={13} className="text-violet-400 shrink-0 mt-0.5" />
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Siguiente acción sugerida */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <Lightbulb size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-indigo-600 mb-1.5" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                      SIGUIENTE ACCIÓN SUGERIDA
                    </p>
                    <p className="text-sm text-indigo-800">{feedback.siguienteAccion}</p>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <AlertCircle size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  La IA te ayuda a ordenar ideas. La validación final la hace un experto.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
