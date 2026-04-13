import React from 'react';
import { AlertCircle, ChevronRight, Sparkles, Target } from 'lucide-react';
import { ResearchModuleAContext, ResearchObjective } from './step1ResearchV2.types';

interface ResearchObjectiveSectionProps {
  context: ResearchModuleAContext;
  objective: ResearchObjective;
  onChange: (nextDraft: string) => void;
  onUseSuggestion: () => void;
  onSuggest: () => void;
  onOpenModuleASummary: () => void;
  onGoToModuleA: () => void;
  fichaConfirmada: boolean;
  iaLoading: boolean;
}

export function ResearchObjectiveSection({
  context,
  objective,
  onChange,
  onSuggest,
  onOpenModuleASummary,
  onGoToModuleA,
  fichaConfirmada,
  iaLoading,
}: ResearchObjectiveSectionProps) {
  const isAISuggested = objective.draftOrigin === 'sugerido';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex items-start gap-2">
        <Target size={14} className="text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm text-indigo-700">
            Define en una sola idea que necesitas entender o validar antes de salir a capturar evidencia.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenModuleASummary}
              className="text-xs text-indigo-700 hover:text-indigo-900 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg transition-colors"
              style={{ fontWeight: 600 }}
            >
              Ver resumen del Modulo A
            </button>
            {!fichaConfirmada && (
              <button
                onClick={onGoToModuleA}
                className="text-xs text-violet-700 hover:text-violet-900 px-2.5 py-1.5 bg-white border border-violet-200 rounded-lg transition-colors"
                style={{ fontWeight: 600 }}
              >
                Volver al Modulo A <ChevronRight size={12} className="inline ml-1" />
              </button>
            )}
            <button
              onClick={onSuggest}
              disabled={iaLoading}
              className="text-xs text-violet-700 hover:text-violet-900 px-2.5 py-1.5 bg-white border border-violet-200 rounded-lg transition-colors disabled:opacity-50"
              style={{ fontWeight: 600 }}
            >
              {iaLoading ? 'Generando...' : <><Sparkles size={12} className="inline mr-1" /> Sugerir con IA</>}
            </button>
          </div>
          <p className="text-xs text-indigo-600">
            Si te bloqueas para redactarlo, retoma que problema, quiebre o vacio necesitas entender mejor desde el Modulo A.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-600 block" style={{ fontWeight: 600 }}>Objetivo de investigacion</label>
        <textarea
          value={objective.draft}
          onChange={event => onChange(event.target.value)}
          rows={5}
          placeholder="Ej. Entender con que frecuencia aparece este problema, a quienes afecta mas, en que condiciones cambia y que evidencia necesitamos reunir antes de decidir si vale la pena avanzar."
          className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none ${isAISuggested ? 'border border-violet-200 bg-violet-50/60 text-slate-800' : 'border border-slate-200 bg-white text-slate-800'}`}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {isAISuggested && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200" style={{ fontWeight: 700 }}>
              Sugerido por IA
            </span>
          )}
          <p className="text-xs text-slate-500">Este texto siempre es editable. Puedes ajustarlo, recortarlo o reescribirlo por completo.</p>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${isAISuggested ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-start gap-2">
          {isAISuggested ? <Sparkles size={14} className="text-violet-500 shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />}
          <div className="space-y-2">
            <p className={`text-sm ${isAISuggested ? 'text-violet-800' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>
              {isAISuggested ? 'Por que la IA sugirio este borrador' : 'Que debe tener un objetivo viable'}
            </p>
            {isAISuggested ? (
              <>
                <p className="text-xs text-violet-800"><span style={{ fontWeight: 700 }}>Detecto:</span> {objective.trace.problemObserved}</p>
                <p className="text-xs text-violet-800"><span style={{ fontWeight: 700 }}>Vacio que busca responder:</span> {objective.trace.validationNeeds[0] || 'Todavia hay vacios de evidencia por resolver.'}</p>
                <p className="text-xs text-violet-800"><span style={{ fontWeight: 700 }}>Que puedes ajustar:</span> Recorta lo que sobre, cambia el foco o borra cualquier parte que no refleje lo que realmente quieres investigar.</p>
              </>
            ) : (
              <ul className="space-y-2">
                {[
                  'Deja claro que necesitas entender o validar.',
                  'No cierra conclusiones antes de investigar.',
                  'Se conecta con el problema detectado en Modulo A.',
                  'Orienta que evidencia y fuentes conviene buscar.',
                ].map(item => (
                  <li key={item} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
