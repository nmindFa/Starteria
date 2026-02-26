import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Plus, Play, CheckCircle2, Lock, Send, TrendingUp, AlertCircle, X, ChevronDown, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { EvidenceUploader } from '../components/EvidenceUploader';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';
import type { Run } from '../context/AppContext';

interface RunDetail extends Run {
  testRef: string;
  metricsData: { name: string; expected: string; actual: string; passed: boolean }[];
  learningCard?: { what: string; learned: string; decision: 'Iterar' | 'Pivot' | 'Kill' | null; evidence: string };
}

const MOCK_S3_FEEDBACK = {
  status: 'Iterar' as const,
  summary: 'El Run 1 muestra resultados prometedores pero la muestra es insuficiente para tomar una decisión con confianza.',
  goodPoints: ['Métricas registradas con timestamps reales', 'Evidencia fotográfica del proceso', 'Learning Card bien estructurada'],
  missing: ['Muestra de sólo 2 casos — necesitas al menos 3', 'No hay evidencia de la encuesta de experiencia del empleado'],
  actions: ['Ejecuta Run 2 con al menos 3 casos adicionales', 'Agrega encuesta de 3 preguntas al empleado el día 3', 'Documenta el tiempo de respuesta de TI en cada caso'],
  questions: ['¿Los 2 casos son representativos del perfil típico de ingreso?', '¿Qué pasó con los accesos especiales fuera del perfil estándar?'],
  timestamp: '2025-02-19T14:00:00Z',
};

export function Step3Page() {
  const { projectId } = useParams();
  const { projects } = useApp();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === projectId);
  const step = project?.steps.find(s => s.number === 3);

  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [newRunName, setNewRunName] = useState('');
  const [selectedRun, setSelectedRun] = useState<string | null>('r1');
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showPivotModal, setShowPivotModal] = useState(false);

  const [runs, setRuns] = useState<RunDetail[]>([
    {
      id: 'r1',
      name: 'Run 1 · Piloto con 2 empleados',
      status: 'Cerrado',
      createdAt: '2025-02-15',
      testRef: 'Formulario Google Forms + seguimiento manual en Sheets',
      metricsData: [
        { name: 'Tiempo formulario → accesos activos', expected: '≤24 horas', actual: '18 horas (caso 1), 22 horas (caso 2)', passed: true },
        { name: 'Casos procesados en tiempo', expected: '80%', actual: '100% (2/2)', passed: true },
        { name: 'NPS empleado nuevo día 3', expected: '>70', actual: '82 promedio', passed: true },
      ],
      learningCard: {
        what: 'Usamos el formulario con los 2 empleados que ingresaron el 15 de febrero. Ambos tuvieron sus accesos antes de 24 horas.',
        learned: 'El formulario funciona bien para perfiles estándar. Para perfiles con accesos especiales, el tiempo se duplica. TI necesita guía específica para esos casos.',
        decision: 'Iterar',
        evidence: 'Screenshots de timestamps, 2 encuestas completadas',
      },
    },
  ]);

  const saveState = useAutosave(runs);

  if (!project || !step) return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;

  const step2Approved = project.steps.find(s => s.number === 2)?.status === 'Aprobado';
  if (!step2Approved) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Step 3 bloqueado</h2>
        <p className="text-sm text-slate-500 mb-4">Para probar en pequeño, primero necesitas la aprobación del mentor en el Step 2.</p>
        <button onClick={() => navigate(`/projects/${projectId}/step/2`)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>→ Ir al Step 2</button>
      </div>
    );
  }

  const activeRun = runs.find(r => r.id === selectedRun);

  const createRun = () => {
    if (!newRunName.trim()) return;
    const newRun: RunDetail = {
      id: `r${Date.now()}`,
      name: newRunName.trim(),
      status: 'Draft',
      createdAt: new Date().toISOString().split('T')[0],
      testRef: '',
      metricsData: [
        { name: 'Tiempo formulario → accesos activos', expected: '≤24 horas', actual: '', passed: false },
        { name: 'Casos procesados en tiempo', expected: '80%', actual: '', passed: false },
        { name: 'NPS empleado nuevo día 3', expected: '>70', actual: '', passed: false },
      ],
    };
    setRuns(p => [...p, newRun]);
    setSelectedRun(newRun.id);
    setShowNewRunModal(false);
    setNewRunName('');
  };

  const canClose = (run: RunDetail) => {
    return run.metricsData.every(m => m.actual.trim()) && run.learningCard?.what;
  };

  return (
    <div className="flex h-full">
      {/* Left nav: Runs list */}
      <div className="hidden md:flex w-56 flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <h2 className="text-sm text-slate-900 mt-2" style={{ fontWeight: 600 }}>Step 3</h2>
          <p className="text-xs text-slate-500">Probar en pequeño</p>
        </div>

        <div className="flex items-center justify-between px-2 mb-1">
          <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>RUNS</p>
          <button onClick={() => setShowNewRunModal(true)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <Plus size={13} className="text-slate-500" />
          </button>
        </div>

        {runs.map(run => (
          <button key={run.id} onClick={() => setSelectedRun(run.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors text-left ${selectedRun === run.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`} style={{ fontWeight: selectedRun === run.id ? 600 : 400 }}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${run.status === 'Cerrado' ? 'bg-emerald-500' : run.status === 'En ejecución' ? 'bg-blue-500' : run.status === 'Revisar cambios' ? 'bg-orange-500' : 'bg-slate-300'}`} />
            <span className="truncate">{run.name}</span>
          </button>
        ))}

        <div className="mt-auto pt-3 border-t border-slate-100">
          <AutosaveIndicator state={saveState} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al proyecto
          </button>

          {/* Test card reference */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 mb-5 text-xs text-violet-700">
            <p style={{ fontWeight: 600 }}>📋 Test Card activa (Step 2)</p>
            <p className="mt-1">Hipótesis: Si usamos el formulario unificado, reduciremos el tiempo de alta en TI de 7 días a 1 día (80% casos)</p>
            <p className="mt-0.5 text-violet-500">Método: Google Forms → seguimiento en Sheets · Umbral: ≤24h en 80%</p>
          </div>

          {!activeRun ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Play size={20} className="text-slate-400" />
              </div>
              <p className="text-slate-700 mb-2" style={{ fontWeight: 500 }}>No hay runs todavía</p>
              <p className="text-sm text-slate-500 mb-4">Crea tu primer Run para empezar a probar el experimento definido en tu Test Card.</p>
              <button onClick={() => setShowNewRunModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
                <Plus size={14} className="inline mr-1.5" /> Crear primer Run
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>{activeRun.name}</h1>
                    <StatusChip status={activeRun.status} />
                  </div>
                  <p className="text-xs text-slate-500">Creado el {activeRun.createdAt}</p>
                </div>
                <div className="flex gap-2">
                  {activeRun.status === 'Draft' && (
                    <button onClick={() => setRuns(p => p.map(r => r.id === activeRun.id ? { ...r, status: 'En ejecución' } : r))} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                      <Play size={13} /> Iniciar
                    </button>
                  )}
                  {activeRun.status === 'En ejecución' && !canClose(activeRun) && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <AlertCircle size={12} /> Completa métricas para cerrar
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div>
                <h3 className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>Métricas: Resultado real vs. Umbral</h3>
                <div className="space-y-3">
                  {activeRun.metricsData.map((m, i) => (
                    <div key={i} className={`border rounded-xl p-4 ${m.passed ? 'border-emerald-200 bg-emerald-50' : m.actual ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>{m.name}</p>
                        {m.actual && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${m.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} style={{ fontWeight: 600 }}>
                            {m.passed ? '✓ Go' : '✗ No-Go'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Umbral esperado</p>
                          <p className="text-sm text-slate-600">{m.expected}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Resultado real</p>
                          {activeRun.status === 'Cerrado' ? (
                            <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>{m.actual || '—'}</p>
                          ) : (
                            <input value={m.actual} onChange={e => { const nm = [...activeRun.metricsData]; nm[i] = { ...nm[i], actual: e.target.value, passed: e.target.value.trim() !== '' }; setRuns(p => p.map(r => r.id === activeRun.id ? { ...r, metricsData: nm } : r)); }} placeholder="Registra el resultado…" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence */}
              <div>
                <h3 className="text-sm text-slate-800 mb-2" style={{ fontWeight: 600 }}>Evidencias del Run</h3>
                {activeRun.status !== 'Cerrado' && <EvidenceUploader />}
              </div>

              {/* Learning Card */}
              <div>
                <h3 className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>Learning Card</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué pasó? (descripción del experimento)</label>
                    {activeRun.status === 'Cerrado' ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-700">{activeRun.learningCard?.what || '—'}</div>
                    ) : (
                      <textarea value={activeRun.learningCard?.what || ''} onChange={e => setRuns(p => p.map(r => r.id === activeRun.id ? { ...r, learningCard: { ...r.learningCard!, what: e.target.value } } : r))} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué aprendimos?</label>
                    {activeRun.status === 'Cerrado' ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-700">{activeRun.learningCard?.learned || '—'}</div>
                    ) : (
                      <textarea value={activeRun.learningCard?.learned || ''} onChange={e => setRuns(p => p.map(r => r.id === activeRun.id ? { ...r, learningCard: { ...r.learningCard!, learned: e.target.value } } : r))} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-2" style={{ fontWeight: 500 }}>Decisión</label>
                    <div className="flex gap-2">
                      {(['Iterar', 'Pivot', 'Kill'] as const).map(d => (
                        <button key={d} onClick={() => activeRun.status !== 'Cerrado' && setRuns(p => p.map(r => r.id === activeRun.id ? { ...r, learningCard: { ...r.learningCard!, decision: d } } : r))} className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${activeRun.learningCard?.decision === d ? d === 'Iterar' ? 'border-blue-400 bg-blue-50 text-blue-700' : d === 'Pivot' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`} style={{ fontWeight: activeRun.learningCard?.decision === d ? 600 : 400 }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {activeRun.status !== 'Cerrado' && (
                <div className="flex gap-3 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => setShowPivotModal(true)}
                    className="border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl px-4 py-2.5 text-sm transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Registrar Pivot / Kill
                  </button>
                  <button
                    onClick={() => {
                      if (!canClose(activeRun)) return;
                      setRuns(p => p.map(r => r.id === activeRun.id ? { ...r, status: 'Cerrado' } : r));
                    }}
                    disabled={!canClose(activeRun)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Cerrar Run
                  </button>
                </div>
              )}

              {/* New iteration */}
              {activeRun.status === 'Cerrado' && activeRun.learningCard?.decision === 'Iterar' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800 mb-2" style={{ fontWeight: 600 }}>Decisión: Iterar</p>
                  <p className="text-xs text-blue-600 mb-3">Crea un nuevo Run para aplicar los aprendizajes y mejorar los resultados. El historial del Run 1 se conserva.</p>
                  <button onClick={() => setShowNewRunModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                    <Plus size={13} /> Crear Run 2 (iteración)
                  </button>
                </div>
              )}

              {/* Send to IA review */}
              {runs.some(r => r.status === 'Cerrado') && (
                <div className="border-t border-slate-200 pt-5">
                  <button onClick={() => setTimeout(() => setHasFeedback(true), 1500)} className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors" style={{ fontWeight: 500 }}>
                    <Send size={15} /> Enviar Step 3 a revisión IA
                  </button>
                  {hasFeedback && (
                    <div className="mt-4">
                      <FeedbackIAPanel feedback={MOCK_S3_FEEDBACK} />
                    </div>
                  )}
                </div>
              )}

              {hasFeedback && MOCK_S3_FEEDBACK.status === 'Aprobado' && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <p className="text-sm text-amber-800 mb-1" style={{ fontWeight: 600 }}>Sesión con experto obligatoria</p>
                  <p className="text-xs text-amber-600 mb-3">Agenda la sesión para validar tu decisión final y desbloquear el Step 4.</p>
                  <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                    <Calendar size={14} /> Agendar sesión con mentor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Run Modal */}
      {showNewRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Crear nuevo Run</h3>
              <button onClick={() => setShowNewRunModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <input value={newRunName} onChange={e => setNewRunName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createRun()} placeholder="Nombre del Run · Ej. Run 2 · 5 casos de ingreso" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" autoFocus />
            <p className="text-xs text-slate-400 mb-4">Este Run se referenciará al Test Card activo del Step 2. El historial de runs anteriores se conserva.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowNewRunModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={createRun} disabled={!newRunName.trim()} className="flex-1 bg-indigo-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>Crear Run</button>
            </div>
          </div>
        </div>
      )}

      {/* Pivot/Kill Modal */}
      {showPivotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Registrar Pivot o Kill</h3>
              <button onClick={() => setShowPivotModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Esta decisión quedará registrada en el historial del proyecto y se informará al mentor.</p>
            <div className="space-y-2 mb-4">
              <button className="w-full text-left p-3 border border-amber-200 bg-amber-50 rounded-xl text-sm text-amber-700" style={{ fontWeight: 500 }}>
                Pivot — Cambio de dirección con aprendizaje
              </button>
              <button className="w-full text-left p-3 border border-red-200 bg-red-50 rounded-xl text-sm text-red-700" style={{ fontWeight: 500 }}>
                Kill — Abandonar este experimento
              </button>
            </div>
            <textarea placeholder="Razón de la decisión (breve)…" rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4" />
            <button onClick={() => setShowPivotModal(false)} className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm hover:bg-slate-900 transition-colors" style={{ fontWeight: 500 }}>
              Guardar decisión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
