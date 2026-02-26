import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Plus, Send } from 'lucide-react';
import { StatusChip } from './StatusChip';

type RunDecision = 'Iterar' | 'Pivotar' | 'Parar';
type RunStatus = 'Draft' | 'En ejecución' | 'Cerrado' | 'Revisar cambios';

interface Step3Evidence {
  id: string;
  type: 'adjunto' | 'link';
  name: string;
  label?: string;
  url?: string;
  tag?: string;
}

interface Step3Run {
  id: string;
  name: string;
  status: RunStatus;
  sampleType: 'cualitativo' | 'cuantitativo';
  sampleSize: number;
  planCaptura: string;
  evidences: Step3Evidence[];
  resultado?: number;
  fuente?: 'medición directa' | 'reporte' | 'proxy';
  creiamos: string;
  observamos: string;
  aprendimos: string;
  haremos: string;
  decision?: RunDecision;
  justificacionParar?: string;
  needsUpstreamReview?: boolean;
}

interface Step3Data {
  status: 'En progreso' | 'Enviado' | 'Feedback IA' | 'Ajustado' | 'Sesión experto pendiente' | 'Aprobado';
  testCardVersion: string;
  testCard: {
    hipotesisRiesgosa: string;
    experimento: string;
    metrica: string;
    umbral: number;
    escenario: string;
    conQuien: string;
    evidenciaCapturar: string;
    riesgos: string;
  };
  upstreamChanged: boolean;
  runs: Step3Run[];
  finalDecision?: RunDecision;
  changeLog: string[];
  feedback?: { score: number; acciones: string[]; preguntas: string[] };
}

const getDefaultStep3 = (): Step3Data => ({
  status: 'En progreso',
  testCardVersion: 'v1',
  testCard: {
    hipotesisRiesgosa: 'Si TI no toma ownership del flujo, la solucion no sera adoptada.',
    experimento: 'Piloto con formulario unico para solicitud de accesos.',
    metrica: 'Tiempo solicitud -> activacion',
    umbral: 24,
    escenario: 'Onboarding de unidad comercial',
    conQuien: 'RRHH + TI + 5 ingresos',
    evidenciaCapturar: 'Timestamps, conteos SLA y capturas',
    riesgos: 'No comprometer seguridad ni auditoria',
  },
  upstreamChanged: false,
  runs: [
    {
      id: 'run-1',
      name: 'Run #1',
      status: 'Cerrado',
      sampleType: 'cualitativo',
      sampleSize: 5,
      planCaptura: 'Entrevistas y medicion del tiempo de activacion.',
      evidences: [
        { id: 'ev-1', type: 'adjunto', name: 'captura-tablero.png', tag: 'tiempo' },
        { id: 'ev-2', type: 'link', name: 'reporte-sla', url: 'https://example.com', label: 'SLA', tag: 'conteo' },
      ],
      resultado: 26,
      fuente: 'medición directa',
      creiamos: 'Que el flujo bajaria a 24h en la mayoria de casos.',
      observamos: 'Mejora, pero hay casos sin owner claro.',
      aprendimos: 'Sin owner explicito hay cuellos de botella.',
      haremos: 'Asignar owner por caso y checklist de traspaso.',
      decision: 'Iterar',
    },
    {
      id: 'run-2',
      name: 'Run #2',
      status: 'En ejecución',
      sampleType: 'cuantitativo',
      sampleSize: 10,
      planCaptura: '',
      evidences: [],
      creiamos: '',
      observamos: '',
      aprendimos: '',
      haremos: '',
      needsUpstreamReview: false,
    },
  ],
  changeLog: ['Se agrego owner explicito en flujo TI.'],
});

const getGoNoGo = (resultado: number | undefined, umbral: number) => {
  if (typeof resultado !== 'number') return 'Inconcluso';
  return resultado >= umbral ? 'Go' : 'No-Go';
};

const canCloseRun = (run: Step3Run, umbral: number) => {
  const reasons: string[] = [];
  if (!run.evidences.some(e => !!e.tag?.trim())) reasons.push('Agrega al menos 1 evidencia con etiqueta.');
  if (typeof run.resultado !== 'number') reasons.push('Registra resultado numérico.');
  if (!run.fuente) reasons.push('Selecciona la fuente del resultado.');
  if (!run.creiamos.trim() || !run.observamos.trim() || !run.aprendimos.trim() || !run.haremos.trim()) reasons.push('Completa la Learning Card.');
  if (!run.decision) reasons.push('Selecciona una decision del Run.');
  if (getGoNoGo(run.resultado, umbral) === 'Go' && run.decision === 'Parar' && !run.justificacionParar?.trim()) reasons.push('Si es Go y decides Parar, agrega justificacion.');
  return { ok: reasons.length === 0, reasons };
};

interface Step3DetailProps {
  projectId: string;
  readOnly: boolean;
  isDemo: boolean;
}

export function Step3Detail({ projectId, readOnly, isDemo }: Step3DetailProps) {
  const storageKey = `starteria-step3-detail-${projectId}`;
  const [data, setData] = useState<Step3Data>(() => {
    if (typeof window === 'undefined') return getDefaultStep3();
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : getDefaultStep3();
  });
  const [selectedRunId, setSelectedRunId] = useState<string>(data.runs[0]?.id || '');

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, storageKey]);

  const selectedRun = useMemo(() => data.runs.find(r => r.id === selectedRunId) || data.runs[0], [data.runs, selectedRunId]);
  if (!selectedRun) return null;

  const closeCheck = canCloseRun(selectedRun, data.testCard.umbral);
  const run1Closed = data.runs.some(r => r.name === 'Run #1' && r.status === 'Cerrado');
  const run2Closed = data.runs.some(r => r.name === 'Run #2' && r.status === 'Cerrado');
  const pivotDocumentado = data.runs.some(r => r.status === 'Cerrado' && r.decision === 'Pivotar');
  const canSubmitStep3 = run1Closed && (run2Closed || pivotDocumentado) && !!data.finalDecision && data.changeLog.some(c => c.trim()) && !data.upstreamChanged && !data.runs.some(r => r.needsUpstreamReview);

  const updateRun = (patch: Partial<Step3Run>) => {
    setData(prev => ({ ...prev, runs: prev.runs.map(r => (r.id === selectedRun.id ? { ...r, ...patch } : r)) }));
  };

  return (
    <div className="mt-4 space-y-4">
      {isDemo && <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 inline-flex"><span style={{ fontWeight: 600 }}>Vista demo</span></div>}
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <span style={{ fontWeight: 600 }}>Vista previa de solo lectura.</span> El contenido se muestra como referencia y no se guarda.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Ancla del experimento</p>
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setData(prev => ({
              ...prev,
              upstreamChanged: true,
              testCardVersion: `v${Number(prev.testCardVersion.replace('v', '')) + 1}`,
              runs: prev.runs.map(r => ({ ...r, needsUpstreamReview: true, status: r.status === 'Cerrado' ? 'Revisar cambios' : r.status })),
            }))}
            className="text-xs text-indigo-600 disabled:text-slate-300"
          >
            Simular cambio en Test Card (upstream)
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
          <p><b>Version:</b> {data.testCardVersion}</p>
          <p><b>Hipotesis:</b> {data.testCard.hipotesisRiesgosa}</p>
          <p><b>Experimento:</b> {data.testCard.experimento}</p>
          <p><b>Metrica:</b> {data.testCard.metrica}</p>
          <p><b>Umbral Go/No-Go:</b> {data.testCard.umbral}</p>
          <p><b>Escenario:</b> {data.testCard.escenario}</p>
          <p><b>Con quien:</b> {data.testCard.conQuien}</p>
          <p><b>Evidencia:</b> {data.testCard.evidenciaCapturar}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Runs (corridas)</p>
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setData(prev => ({
              ...prev,
              runs: [...prev.runs, {
                id: `run-${Date.now()}`,
                name: `Run #${prev.runs.length + 1}`,
                status: 'Draft',
                sampleType: 'cualitativo',
                sampleSize: 5,
                planCaptura: '',
                evidences: [],
                creiamos: '',
                observamos: '',
                aprendimos: '',
                haremos: '',
              }],
            }))}
            className="text-xs text-indigo-600 disabled:text-slate-300 inline-flex items-center gap-1"
          >
            <Plus size={12} /> Crear Run
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {data.runs.map(run => (
            <button key={run.id} onClick={() => setSelectedRunId(run.id)} className={`px-2.5 py-1 rounded-lg text-xs border ${selectedRunId === run.id ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 bg-white'}`}>
              {run.name} <span className="ml-1"><StatusChip status={run.status} size="sm" /></span>
            </button>
          ))}
        </div>

        {selectedRun.needsUpstreamReview && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            Revisar cambios (cambio upstream). Debes confirmar coherencia antes de enviar.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-slate-600">Tipo de muestra
            <select disabled={readOnly} value={selectedRun.sampleType} onChange={e => updateRun({ sampleType: e.target.value as Step3Run['sampleType'] })} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
              <option value="cualitativo">cualitativo</option>
              <option value="cuantitativo">cuantitativo</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">Tamaño
            <input disabled={readOnly} type="number" value={selectedRun.sampleSize} onChange={e => updateRun({ sampleSize: Number(e.target.value || 0) })} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
          </label>
        </div>
        {selectedRun.sampleType === 'cualitativo' && <p className="text-xs text-blue-600 mb-3">Tip: para cualitativo/usabilidad, usa 5 personas por corrida.</p>}

        <label className="text-xs text-slate-600">Plan de captura
          <textarea disabled={readOnly} value={selectedRun.planCaptura} onChange={e => updateRun({ planCaptura: e.target.value })} rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white resize-none" />
        </label>

        <div className="mt-3">
          <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Evidencias del Run</p>
          {!readOnly && (
            <div className="flex gap-2 mb-2">
              <button onClick={() => updateRun({ evidences: [...selectedRun.evidences, { id: `ev-${Date.now()}`, type: 'adjunto', name: 'nuevo-adjunto', tag: '' }] })} className="text-xs border border-slate-200 px-2 py-1 rounded-md">+ Adjunto</button>
              <button onClick={() => updateRun({ evidences: [...selectedRun.evidences, { id: `ev-${Date.now()}`, type: 'link', name: 'nuevo-link', url: '', tag: '' }] })} className="text-xs border border-slate-200 px-2 py-1 rounded-md">+ Link</button>
            </div>
          )}
          <div className="space-y-2">
            {selectedRun.evidences.map(ev => (
              <div key={ev.id} className="border border-slate-200 rounded-lg p-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                <input disabled={readOnly} value={ev.name} onChange={e => updateRun({ evidences: selectedRun.evidences.map(x => x.id === ev.id ? { ...x, name: e.target.value } : x) })} placeholder="Nombre" className="border border-slate-200 rounded px-2 py-1 text-xs" />
                <input disabled={readOnly} value={ev.label || ''} onChange={e => updateRun({ evidences: selectedRun.evidences.map(x => x.id === ev.id ? { ...x, label: e.target.value } : x) })} placeholder="Label" className="border border-slate-200 rounded px-2 py-1 text-xs" />
                <input disabled={readOnly} value={ev.url || ''} onChange={e => updateRun({ evidences: selectedRun.evidences.map(x => x.id === ev.id ? { ...x, url: e.target.value } : x) })} placeholder="URL" className="border border-slate-200 rounded px-2 py-1 text-xs" />
                <input disabled={readOnly} value={ev.tag || ''} onChange={e => updateRun({ evidences: selectedRun.evidences.map(x => x.id === ev.id ? { ...x, tag: e.target.value } : x) })} placeholder="Etiqueta" className="border border-slate-200 rounded px-2 py-1 text-xs" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Resultado vs umbral</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">Resultado
              <input disabled={readOnly} type="number" value={selectedRun.resultado ?? ''} onChange={e => updateRun({ resultado: e.target.value ? Number(e.target.value) : undefined })} className="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-slate-600">Fuente
              <select disabled={readOnly} value={selectedRun.fuente || ''} onChange={e => updateRun({ fuente: (e.target.value || undefined) as Step3Run['fuente'] })} className="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm">
                <option value="">Seleccionar</option>
                <option value="medición directa">medición directa</option>
                <option value="reporte">reporte</option>
                <option value="proxy">proxy</option>
              </select>
            </label>
          </div>
          <div className="mt-2 text-xs text-slate-600">Go/No-Go automatico: <span style={{ fontWeight: 600 }}>{getGoNoGo(selectedRun.resultado, data.testCard.umbral)}</span></div>
        </div>

        <div className="mt-3 border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Learning Card (obligatoria para cerrar)</p>
          <textarea disabled={readOnly} value={selectedRun.creiamos} onChange={e => updateRun({ creiamos: e.target.value })} rows={2} placeholder="Creiamos que..." className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none" />
          <textarea disabled={readOnly} value={selectedRun.observamos} onChange={e => updateRun({ observamos: e.target.value })} rows={2} placeholder="Observamos..." className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none" />
          <textarea disabled={readOnly} value={selectedRun.aprendimos} onChange={e => updateRun({ aprendimos: e.target.value })} rows={2} placeholder="Aprendimos..." className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none" />
          <textarea disabled={readOnly} value={selectedRun.haremos} onChange={e => updateRun({ haremos: e.target.value })} rows={2} placeholder="Haremos..." className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none" />
        </div>

        <div className="mt-3">
          <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Decision del Run</p>
          <div className="flex gap-2">
            {(['Iterar', 'Pivotar', 'Parar'] as RunDecision[]).map(d => (
              <button key={d} disabled={readOnly} onClick={() => updateRun({ decision: d })} className={`px-3 py-1.5 rounded-lg text-xs border ${selectedRun.decision === d ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>{d}</button>
            ))}
          </div>
          {selectedRun.decision === 'Parar' && getGoNoGo(selectedRun.resultado, data.testCard.umbral) === 'Go' && (
            <textarea disabled={readOnly} value={selectedRun.justificacionParar || ''} onChange={e => updateRun({ justificacionParar: e.target.value })} rows={2} placeholder="Justificacion adicional obligatoria" className="mt-2 w-full border border-amber-300 rounded px-2 py-1.5 text-sm resize-none" />
          )}
        </div>

        {!readOnly && (
          <div className="mt-3">
            <button
              onClick={() => setData(prev => ({
                ...prev,
                runs: prev.runs.map(r => r.id === selectedRun.id ? { ...r, status: 'Cerrado', needsUpstreamReview: false } : r),
              }))}
              disabled={!closeCheck.ok}
              aria-disabled={!closeCheck.ok}
              title={!closeCheck.ok ? closeCheck.reasons.join(' | ') : ''}
              className={`px-4 py-2 rounded-lg text-sm ${closeCheck.ok ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              Cerrar Run
            </button>
            {!closeCheck.ok && <div className="mt-2 text-xs text-amber-700">{closeCheck.reasons[0]}</div>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>Cierre Step 3</p>
        <div className="space-y-2 text-xs">
          <p className={`${run1Closed ? 'text-emerald-700' : 'text-slate-500'}`}>• Run #1 cerrado</p>
          <p className={`${run2Closed || pivotDocumentado ? 'text-emerald-700' : 'text-slate-500'}`}>• Run #2 cerrado o Pivot documentado</p>
          <p className={`${data.finalDecision ? 'text-emerald-700' : 'text-slate-500'}`}>• Decision final registrada</p>
          <p className={`${data.changeLog.some(c => c.trim()) ? 'text-emerald-700' : 'text-slate-500'}`}>• Change-log completado</p>
        </div>
        {!readOnly && (
          <>
            <div className="mt-3 flex gap-2">
              {(['Iterar', 'Pivotar', 'Parar'] as RunDecision[]).map(d => (
                <button key={d} onClick={() => setData(prev => ({ ...prev, finalDecision: d }))} className={`px-3 py-1.5 rounded-lg text-xs border ${data.finalDecision === d ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>{d}</button>
              ))}
            </div>
            <div className="mt-2 space-y-2">
              {data.changeLog.map((line, idx) => (
                <input key={idx} value={line} onChange={e => setData(prev => ({ ...prev, changeLog: prev.changeLog.map((c, i) => i === idx ? e.target.value : c) }))} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm" placeholder={`Cambio ${idx + 1}`} />
              ))}
              <button onClick={() => setData(prev => ({ ...prev, changeLog: [...prev.changeLog, ''] }))} className="text-xs text-slate-600">+ Agregar cambio</button>
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            disabled={!canSubmitStep3 || readOnly || isDemo}
            title={isDemo ? 'En vista demo no se permite enviar a revisión.' : ''}
            onClick={() => setData(prev => ({ ...prev, status: 'Enviado' }))}
            className={`px-3 py-2 rounded-lg text-xs inline-flex items-center gap-1 ${!canSubmitStep3 || readOnly || isDemo ? 'bg-slate-100 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
          >
            <Send size={12} /> Enviar a revisión IA
          </button>
          <button disabled={readOnly} onClick={() => setData(prev => ({ ...prev, status: 'Feedback IA', feedback: { score: 79, acciones: ['Cerrar run 2 con evidencia etiquetada'], preguntas: ['Como escalaras a otra area?'] } }))} className="px-3 py-2 rounded-lg text-xs border border-slate-200">Simular feedback IA</button>
          <button disabled={readOnly} onClick={() => setData(prev => ({ ...prev, status: 'Ajustado' }))} className="px-3 py-2 rounded-lg text-xs border border-slate-200">Marcar acciones resueltas</button>
          <button disabled={readOnly} onClick={() => setData(prev => ({ ...prev, status: 'Sesión experto pendiente' }))} className="px-3 py-2 rounded-lg text-xs border border-slate-200 inline-flex items-center gap-1"><Calendar size={12} /> Solicitar sesión experto</button>
          <button disabled={readOnly} onClick={() => setData(prev => ({ ...prev, status: 'Aprobado' }))} className="px-3 py-2 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700">Aprobar experto</button>
          <StatusChip status={data.status} size="sm" />
        </div>

        {data.feedback && (
          <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-700">
            <p style={{ fontWeight: 600 }}>Feedback IA: {data.feedback.score}/100</p>
            <p>Acciones: {data.feedback.acciones.slice(0, 5).join(' | ')}</p>
            <p>Preguntas: {data.feedback.preguntas.slice(0, 5).join(' | ')}</p>
          </div>
        )}

        {data.upstreamChanged && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <div>
              Cambios upstream pendientes de coherencia. No se puede enviar a revision.
              {!readOnly && <button onClick={() => setData(prev => ({ ...prev, upstreamChanged: false, runs: prev.runs.map(r => ({ ...r, needsUpstreamReview: false, status: r.status === 'Revisar cambios' ? 'Cerrado' : r.status })) }))} className="ml-2 text-red-800 underline">Confirmar coherencia</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

