import React from 'react';
import { AlertCircle, Sparkles, Target } from 'lucide-react';
import { ResearchModuleAContext, ResearchObjective } from './step1ResearchV2.types';

interface ResearchObjectiveSectionProps {
  context: ResearchModuleAContext;
  objective: ResearchObjective;
  onChange: (nextDraft: string) => void;
  onUseSuggestion: () => void;
  onSuggest: () => void;
  iaLoading: boolean;
}

const buildKeywordSuggestions = (context: ResearchModuleAContext) => {
  const suggestions = [
    context.quiebre,
    context.consecuencia,
    context.causaInmediata,
    context.actoresProceso,
  ]
    .flatMap(item => (item || '').split(','))
    .map(item => item.trim())
    .filter(Boolean);

  return Array.from(new Set(suggestions)).slice(0, 6);
};

export function ResearchObjectiveSection({
  context,
  objective,
  onChange,
  onUseSuggestion,
  onSuggest,
  iaLoading,
}: ResearchObjectiveSectionProps) {
  const keywordSuggestions = buildKeywordSuggestions(context);
  const hasSuggestion = objective.suggestedDraft.trim().length > 0;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>1</span>
          <div>
            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Objetivo general de investigacion</p>
            <p className="text-xs text-slate-500">Redacta en una sola idea que quieres entender o validar antes de salir a capturar evidencia.</p>
          </div>
        </div>
        <button
          onClick={onSuggest}
          disabled={iaLoading}
          className="shrink-0 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-colors disabled:opacity-50"
          style={{ fontWeight: 500 }}
        >
          {iaLoading ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full" /> Generando...</> : <><Sparkles size={11} /> Sugerir con IA</>}
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex items-start gap-2">
          <Target size={14} className="text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-indigo-700">
              Este objetivo sirve para enfocar que vas a investigar, que criterios conviene mirar y que fuentes o evidencia necesitas conseguir.
            </p>
            {keywordSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywordSuggestions.map(keyword => (
                  <span key={keyword} className="text-xs px-2 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700" style={{ fontWeight: 500 }}>
                    {keyword}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-indigo-600">Estas palabras clave vienen del Step 1 anterior y solo funcionan como apoyo visual. No rellenan el objetivo por ti.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-600 block" style={{ fontWeight: 600 }}>Escribe tu objetivo general</label>
          <textarea
            value={objective.draft}
            onChange={event => onChange(event.target.value)}
            rows={4}
            placeholder="Ej. Entender con que frecuencia aparece este problema, a quienes afecta mas y que evidencia necesitamos reunir para decidir si vale la pena avanzar."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
          />
          <p className="text-xs text-slate-500">Escribe un objetivo claro y util. Debe orientar la investigacion, no cerrar conclusiones antes de tiempo.</p>
        </div>

        {hasSuggestion && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-violet-500" />
                <p className="text-sm text-violet-800" style={{ fontWeight: 600 }}>Sugerencia de objetivo con IA</p>
              </div>
              <button
                onClick={onUseSuggestion}
                className="text-xs text-violet-700 hover:text-violet-900 px-2.5 py-1.5 bg-white border border-violet-200 rounded-lg transition-colors"
                style={{ fontWeight: 500 }}
              >
                Usar como borrador
              </button>
            </div>
            <p className="text-sm text-violet-700 leading-relaxed">{objective.suggestedDraft}</p>
            <p className="text-xs text-violet-600">La sugerencia no reemplaza tu texto hasta que la apliques. Si la usas, luego puedes editarla libremente.</p>
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-600" />
            <p className="text-sm text-amber-800" style={{ fontWeight: 600 }}>Por que la IA sugiere este objetivo</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-amber-700 mb-1" style={{ fontWeight: 600 }}>Problema observado</p>
              <p className="text-xs text-amber-700 leading-relaxed">{objective.trace.problemObserved}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700 mb-1" style={{ fontWeight: 600 }}>Vacios de informacion detectados</p>
              <ul className="space-y-1">
                {objective.trace.informationGaps.map((item, index) => (
                  <li key={index} className="text-xs text-amber-700 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-amber-700 mb-1" style={{ fontWeight: 600 }}>Lo que hace falta validar</p>
              <ul className="space-y-1">
                {objective.trace.validationNeeds.map((item, index) => (
                  <li key={index} className="text-xs text-amber-700 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-amber-700 mb-1" style={{ fontWeight: 600 }}>Por eso se propone investigar esto</p>
              <p className="text-xs text-amber-700 leading-relaxed">{objective.trace.recommendationReason}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
