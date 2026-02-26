import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Send } from 'lucide-react';
import { StatusChip } from './StatusChip';

interface StoryState {
  contexto: string;
  problema: string;
  queProbamos: string;
  queVimos: string;
  queAprendimos: string;
  recomendacion: string;
  pedidoLider: string;
}

interface OnePagerState {
  reto: string;
  metricaUmbral: string;
  disenoExperimento: string;
  runsEjecutados: string;
  resultados: string;
  aprendizajes: string;
  recomendacion: string;
  pedidoLider: string;
}

interface Step4State {
  status: 'En progreso' | 'Enviado' | 'Feedback IA' | 'Ajustado' | 'Sesión experto pendiente' | 'Aprobado';
  requiereRefrescar: boolean;
  story: StoryState;
  onePager: OnePagerState;
  manualEdits: Partial<OnePagerState>;
  selectedEvidenceIds: string[];
  recommendation?: 'Go' | 'Pivotar' | 'Stop';
  razones: string[];
  pedidoConcreto: string;
  fechaObjetivo: string;
  pitchFileName?: string;
  pitchEval?: { score: number; fortalezas: string[]; confusiones: string[]; sugerencias: string[]; tip: string };
  feedback?: { score: number; acciones: string[]; preguntas: string[] };
}

const getDefaultStep4 = (): Step4State => ({
  status: 'En progreso',
  requiereRefrescar: true,
  story: {
    contexto: 'El onboarding tiene demoras por alta de accesos en TI.',
    problema: 'Nuevos ingresos pierden productividad por falta de accesos.',
    queProbamos: 'Piloto con solicitud unificada y seguimiento de SLA.',
    queVimos: 'Run 1 mejora parcial, Run 2 en ejecución.',
    queAprendimos: 'Ownership del caso define la velocidad.',
    recomendacion: 'Iterar con owner explicito.',
    pedidoLider: 'Patrocinio para escalar 4 semanas.',
  },
  onePager: {
    reto: 'Reducir demora de accesos sin bajar seguridad.',
    metricaUmbral: 'Tiempo de activacion <= 24h.',
    disenoExperimento: 'Piloto RRHH + TI',
    runsEjecutados: 'Run 1 cerrado, Run 2 en ejecución',
    resultados: 'Mejora parcial de tiempos',
    aprendizajes: 'Sin owner el flujo se estanca',
    recomendacion: 'Iterar',
    pedidoLider: 'Asignar sponsor y capacidad de TI',
  },
  manualEdits: {},
  selectedEvidenceIds: [],
  razones: ['', '', ''],
  pedidoConcreto: '',
  fechaObjetivo: '',
});

interface Step3EvidenceLite {
  id: string;
  name: string;
  type: 'adjunto' | 'link';
  tag?: string;
}

interface Step4DetailProps {
  projectId: string;
  readOnly: boolean;
  isDemo: boolean;
}

export function Step4Detail({ projectId, readOnly, isDemo }: Step4DetailProps) {
  const key = `starteria-step4-detail-${projectId}`;
  const [state, setState] = useState<Step4State>(() => {
    if (typeof window === 'undefined') return getDefaultStep4();
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : getDefaultStep4();
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  const step3Key = `starteria-step3-detail-${projectId}`;
  const evidenceOptions: Step3EvidenceLite[] = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(step3Key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { runs?: Array<{ evidences?: Step3EvidenceLite[] }> };
      return (parsed.runs || []).flatMap(r => r.evidences || []);
    } catch {
      return [];
    }
  }, [step3Key, state.status]);

  const canDemoDay = state.selectedEvidenceIds.length >= 3 && !!state.recommendation && state.razones.filter(r => r.trim()).length >= 2 && !!state.pedidoConcreto.trim() && !!state.fechaObjetivo;

  const updateStory = (k: keyof StoryState, v: string) => setState(prev => ({ ...prev, story: { ...prev.story, [k]: v } }));
  const updateOnePager = (k: keyof OnePagerState, v: string) => setState(prev => ({ ...prev, onePager: { ...prev.onePager, [k]: v }, manualEdits: { ...prev.manualEdits, [k]: v } }));

  const mergePrefill = () => {
    const prefill: OnePagerState = {
      reto: 'Reto actualizado desde Steps 1-3',
      metricaUmbral: 'Tiempo activacion <= 24h en 80%',
      disenoExperimento: 'Piloto actualizado con owner por caso',
      runsEjecutados: 'Run 1 cerrado | Run 2 en ejecución',
      resultados: 'Resultado parcial con mejora y riesgo residual',
      aprendizajes: 'Owner explicito reduce friccion',
      recomendacion: 'Iterar',
      pedidoLider: 'Asignar sponsor y recursos por 4 semanas',
    };
    setState(prev => ({
      ...prev,
      requiereRefrescar: false,
      onePager: { ...prefill, ...prev.manualEdits },
      story: { ...prev.story, queVimos: prefill.resultados, queAprendimos: prefill.aprendizajes },
    }));
  };

  return (
    <div className="mt-4 space-y-4">
      {isDemo && <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 inline-flex"><span style={{ fontWeight: 600 }}>Vista demo</span></div>}
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <span style={{ fontWeight: 600 }}>Vista previa de solo lectura.</span> Puedes revisar la estructura, pero no editar ni enviar.
        </div>
      )}

      {state.requiereRefrescar && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800" style={{ fontWeight: 600 }}>Requiere refrescar</p>
          <p className="text-xs text-amber-700 mt-1">Cambios en Steps 1-3 detectados despues de generar el deck.</p>
          {!readOnly && <button onClick={mergePrefill} className="mt-2 text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg">Actualizar prefill (mantener mis ediciones)</button>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>Story Builder (1-3 min)</p>
        {([
          ['contexto', 'Contexto'],
          ['problema', 'Problema y quien sufre'],
          ['queProbamos', 'Que probamos'],
          ['queVimos', 'Que vimos (resultado vs umbral)'],
          ['queAprendimos', 'Que aprendimos'],
          ['recomendacion', 'Recomendacion'],
          ['pedidoLider', 'Pedido al lider'],
        ] as const).map(([k, label]) => (
          <label key={k} className="block text-xs text-slate-600 mb-2">
            {label}
            <textarea disabled={readOnly} value={state.story[k]} onChange={e => updateStory(k, e.target.value)} rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm resize-none" />
          </label>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>One-pager precompletado (editable)</p>
        {([
          ['reto', 'Reto'],
          ['metricaUmbral', 'Metrica y umbral'],
          ['disenoExperimento', 'Diseño del experimento'],
          ['runsEjecutados', 'Runs ejecutados'],
          ['resultados', 'Resultados'],
          ['aprendizajes', 'Aprendizajes'],
          ['recomendacion', 'Recomendacion'],
          ['pedidoLider', 'Pedido al lider'],
        ] as const).map(([k, label]) => (
          <label key={k} className="block text-xs text-slate-600 mb-2">
            {label}
            <textarea disabled={readOnly} value={state.onePager[k]} onChange={e => updateOnePager(k, e.target.value)} rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm resize-none" />
          </label>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-800 mb-2" style={{ fontWeight: 600 }}>Evidencias top seleccionadas</p>
        <p className="text-xs text-slate-500 mb-2">Selecciona al menos 3 evidencias del Step 3.</p>
        <div className="space-y-2">
          {evidenceOptions.length === 0 && <p className="text-xs text-slate-400">No hay evidencias disponibles aun.</p>}
          {evidenceOptions.map(ev => {
            const checked = state.selectedEvidenceIds.includes(ev.id);
            return (
              <label key={ev.id} className={`flex items-center justify-between border rounded-lg px-3 py-2 text-xs ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}>
                <span>{ev.name} · {ev.tag || 'sin tag'}</span>
                <input
                  disabled={readOnly}
                  type="checkbox"
                  checked={checked}
                  onChange={() => !readOnly && setState(prev => ({
                    ...prev,
                    selectedEvidenceIds: checked ? prev.selectedEvidenceIds.filter(x => x !== ev.id) : [...prev.selectedEvidenceIds, ev.id],
                  }))}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>Recomendacion final + pedido al lider</p>
        <div className="flex gap-2 mb-2">
          {(['Go', 'Pivotar', 'Stop'] as const).map(r => (
            <button key={r} disabled={readOnly} onClick={() => setState(prev => ({ ...prev, recommendation: r }))} className={`px-3 py-1.5 rounded-lg text-xs border ${state.recommendation === r ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>{r}</button>
          ))}
        </div>
        {[0, 1, 2].map(i => (
          <input key={i} disabled={readOnly} value={state.razones[i] || ''} onChange={e => setState(prev => ({ ...prev, razones: [0, 1, 2].map(idx => idx === i ? e.target.value : prev.razones[idx] || '') }))} placeholder={`Razon ${i + 1}`} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm mb-2" />
        ))}
        <textarea disabled={readOnly} value={state.pedidoConcreto} onChange={e => setState(prev => ({ ...prev, pedidoConcreto: e.target.value }))} rows={2} placeholder="Pedido concreto (permiso/recursos/decision)" className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none mb-2" />
        <input disabled={readOnly} type="date" value={state.fechaObjetivo} onChange={e => setState(prev => ({ ...prev, fechaObjetivo: e.target.value }))} className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
        <div className="mt-3">
          <button disabled={!canDemoDay || readOnly} aria-disabled={!canDemoDay || readOnly} className={`${!canDemoDay || readOnly ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'} px-4 py-2 rounded-lg text-sm`}>
            Listo para Demo Day
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>Pitch Studio (mock)</p>
        <input disabled={readOnly} type="file" accept="audio/*,video/*" onChange={e => setState(prev => ({ ...prev, pitchFileName: e.target.files?.[0]?.name || '' }))} className="text-xs" />
        {state.pitchFileName && <p className="text-xs text-slate-500 mt-1">Archivo: {state.pitchFileName}</p>}
        {!readOnly && (
          <button onClick={() => setState(prev => ({ ...prev, pitchEval: { score: 83, fortalezas: ['Historia clara'], confusiones: ['Pedido no cuantificado'], sugerencias: ['Abre con resultado', 'Cierra con pedido y fecha'], tip: 'Mantén 2 minutos maximo' } }))} className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white">
            Evaluar pitch
          </button>
        )}
        {state.pitchEval && (
          <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">
            Score {state.pitchEval.score}. Fortalezas: {state.pitchEval.fortalezas.join(' | ')}. Confusiones: {state.pitchEval.confusiones.join(' | ')}.
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>Enviar a revisión y gating</p>
        <div className="flex flex-wrap gap-2 items-center">
          <button disabled={readOnly || isDemo} title={isDemo ? 'En vista demo no se permite enviar a revisión.' : ''} onClick={() => setState(prev => ({ ...prev, status: 'Enviado' }))} className={`${readOnly || isDemo ? 'bg-slate-100 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700'} px-3 py-2 rounded-lg text-xs inline-flex items-center gap-1`}>
            <Send size={12} /> Enviar a revisión IA
          </button>
          <button disabled={readOnly} onClick={() => setState(prev => ({ ...prev, status: 'Feedback IA', feedback: { score: 84, acciones: ['Ajustar recomendacion'], preguntas: ['Que riesgo residual queda?'] } }))} className="px-3 py-2 rounded-lg text-xs border border-slate-200">Simular feedback IA</button>
          <button disabled={readOnly} onClick={() => setState(prev => ({ ...prev, status: 'Ajustado' }))} className="px-3 py-2 rounded-lg text-xs border border-slate-200">Marcar acciones resueltas</button>
          <button disabled={readOnly} onClick={() => setState(prev => ({ ...prev, status: 'Sesión experto pendiente' }))} className="px-3 py-2 rounded-lg text-xs border border-slate-200 inline-flex items-center gap-1"><Calendar size={12} /> Solicitar sesión experto</button>
          <button disabled={readOnly} onClick={() => setState(prev => ({ ...prev, status: 'Aprobado' }))} className="px-3 py-2 rounded-lg text-xs bg-emerald-600 text-white">Aprobar experto</button>
          <StatusChip status={state.status} size="sm" />
        </div>
        {state.feedback && (
          <div className="mt-3 text-xs bg-violet-50 border border-violet-200 rounded-lg p-3 text-violet-700">
            Feedback IA {state.feedback.score}/100 · Acciones: {state.feedback.acciones.slice(0, 5).join(' | ')} · Preguntas: {state.feedback.preguntas.slice(0, 5).join(' | ')}
          </div>
        )}
      </div>
    </div>
  );
}

