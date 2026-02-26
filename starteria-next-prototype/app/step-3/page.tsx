'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnchorTestCard } from '@/components/AnchorTestCard';
import { ProjectFrame } from '@/components/ProjectFrame';
import { RunEditor } from '@/components/RunEditor';
import { RunList } from '@/components/RunList';
import { StatusBadge } from '@/components/StatusBadge';
import { mockProject } from '@/lib/mockData';
import { useLocalStorageState } from '@/lib/storage';
import { Decision, Run } from '@/lib/types';
import { canSubmitStep3 } from '@/lib/utils';

export default function Step3Page() {
  const { state: project, setState: setProject, hydrated } = useLocalStorageState('starteria-prototype-project', mockProject);
  const [selectedRunId, setSelectedRunId] = useState<string>(mockProject.step3.runs[0]?.id || '');

  const selectedRun = useMemo(
    () => project.step3.runs.find((r) => r.id === selectedRunId) || project.step3.runs[0],
    [project.step3.runs, selectedRunId]
  );

  const submitCheck = canSubmitStep3(project);

  if (!hydrated || !selectedRun) return <main className="p-6 text-sm text-slate-600">Cargando prototipo...</main>;

  const updateRun = (runId: string, next: Run) => {
    setProject({
      ...project,
      step3: {
        ...project.step3,
        runs: project.step3.runs.map((r) => (r.id === runId ? next : r)),
      },
    });
  };

  const closeRun = (run: Run) => {
    updateRun(run.id, { ...run, status: 'Cerrado', needsUpstreamReview: false });
  };

  const addChangeLog = () => {
    setProject({
      ...project,
      step3: { ...project.step3, changeLog: [...project.step3.changeLog, ''] },
    });
  };

  const createRun = () => {
    const nextNum = project.step3.runs.length + 1;
    const run: Run = {
      id: `run-${Date.now()}`,
      name: `Run #${nextNum}`,
      status: 'Draft',
      sampleType: 'cualitativo',
      sampleSize: 5,
      planCaptura: '',
      evidences: [],
      learning: { creiamos: '', observamos: '', aprendimos: '', haremos: '' },
    };
    setProject({ ...project, step3: { ...project.step3, runs: [...project.step3.runs, run] } });
    setSelectedRunId(run.id);
  };

  const simulateUpstreamChange = () => {
    const currentVersion = Number(project.step3.testCard.version.replace('v', '')) || 1;
    setProject({
      ...project,
      step3: {
        ...project.step3,
        upstreamChanged: true,
        testCard: {
          ...project.step3.testCard,
          version: `v${currentVersion + 1}`,
          hipotesisRiesgosa: `${project.step3.testCard.hipotesisRiesgosa} (actualizada)`,
        },
        runs: project.step3.runs.map((r) => ({ ...r, needsUpstreamReview: true })),
      },
    });
  };

  const confirmUpstreamReview = () => {
    setProject({
      ...project,
      step3: {
        ...project.step3,
        upstreamChanged: false,
        runs: project.step3.runs.map((r) => ({ ...r, needsUpstreamReview: false })),
      },
    });
  };

  const setStep3Status = (status: typeof project.step3.status) => {
    setProject({
      ...project,
      step3: { ...project.step3, status },
      stepStatus: { ...project.stepStatus, 3: status, 4: status === 'Aprobado' ? 'En progreso' : project.stepStatus[4] },
    });
  };

  return (
    <ProjectFrame project={project} activeStep={3}>
      <section className="grid gap-4 lg:grid-cols-[1.1fr,2fr]">
        <AnchorTestCard testCard={project.step3.testCard} onSimulateUpstreamChange={simulateUpstreamChange} />
        <div className="space-y-4">
          <RunList runs={project.step3.runs} selectedRunId={selectedRun.id} onSelectRun={setSelectedRunId} onCreateRun={createRun} />
          {selectedRun.needsUpstreamReview && (
            <div className="card border-red-200 bg-red-50">
              <p className="text-sm font-semibold text-red-800">Revisar cambios (cambio upstream)</p>
              <p className="text-xs text-red-700">Debes confirmar coherencia de los Runs antes de enviar Step 3 a revisión.</p>
              <button onClick={confirmUpstreamReview} className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white">
                Confirmar coherencia
              </button>
            </div>
          )}
          <RunEditor run={selectedRun} testCard={project.step3.testCard} onChange={(next) => updateRun(selectedRun.id, next)} onCloseRun={() => closeRun(selectedRun)} />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold">Cierre Step 3</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {[
            { label: 'Run #1 cerrado', ok: !submitCheck.reasons.includes('Run #1 cerrado') },
            { label: 'Run #2 cerrado O Pivot documentado', ok: !submitCheck.reasons.includes('Run #2 cerrado o Pivot documentado') },
            { label: 'Decisión final + change-log', ok: !submitCheck.reasons.includes('Decisión final registrada') && !submitCheck.reasons.includes('Change-log con al menos 1 cambio') },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl border p-2 text-sm ${item.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {item.ok ? 'Listo' : 'Pendiente'}: {item.label}
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold">Decisión final del Step 3</p>
          <div className="mt-2 flex gap-2">
            {(['Iterar', 'Pivotar', 'Parar'] as Decision[]).map((d) => (
              <button
                key={d}
                onClick={() => setProject({ ...project, step3: { ...project.step3, finalDecision: d } })}
                className={`rounded-lg px-3 py-1.5 text-xs ${project.step3.finalDecision === d ? 'bg-brand-600 text-white' : 'border border-slate-200 text-slate-700'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Change-log</p>
            <button onClick={addChangeLog} className="rounded-md border border-slate-200 px-2 py-1 text-xs">+ Agregar</button>
          </div>
          <div className="space-y-2">
            {project.step3.changeLog.map((line, i) => (
              <input
                key={`${i}-${line}`}
                value={line}
                onChange={(e) =>
                  setProject({
                    ...project,
                    step3: {
                      ...project.step3,
                      changeLog: project.step3.changeLog.map((c, idx) => (idx === i ? e.target.value : c)),
                    },
                  })
                }
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                placeholder={`Cambio ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStep3Status('Enviado a revisión')}
            disabled={!submitCheck.ok}
            aria-disabled={!submitCheck.ok}
            title={!submitCheck.ok ? submitCheck.reasons.join(' | ') : ''}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${submitCheck.ok ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-slate-100 text-slate-400'}`}
          >
            Enviar a revisión (IA)
          </button>
          <button
            onClick={() =>
              setProject({
                ...project,
                step3: {
                  ...project.step3,
                  status: 'Feedback IA',
                  feedback: {
                    score: 78,
                    acciones: ['Ajustar definición de ownership en run 2', 'Asegurar evidencia de fuente en todos los casos'],
                    preguntas: ['Qué harás si el tiempo baja pero suben errores?', 'Qué equipo sostiene esto después del piloto?'],
                  },
                },
                stepStatus: { ...project.stepStatus, 3: 'Feedback IA' },
              })
            }
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            Simular feedback IA
          </button>
          <button onClick={() => setStep3Status('Ajustado')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Marcar acciones como resueltas</button>
          <button onClick={() => setStep3Status('Sesión experto pendiente')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Solicitar sesión experto</button>
          <button onClick={() => setStep3Status('Aprobado')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Aprobar experto
          </button>
          <StatusBadge status={project.step3.status} />
        </div>

        {project.step3.feedback && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
            <p className="text-sm font-semibold text-purple-800">Feedback IA - Score {project.step3.feedback.score}/100</p>
            <p className="mt-1 text-xs font-semibold text-purple-700">Acciones</p>
            <ul className="list-disc pl-5 text-xs text-purple-700">
              {project.step3.feedback.acciones.slice(0, 5).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs font-semibold text-purple-700">Preguntas faltantes</p>
            <ul className="list-disc pl-5 text-xs text-purple-700">
              {project.step3.feedback.preguntas.slice(0, 5).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {project.step3.status === 'Aprobado' && (
          <Link href="/step-4" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black">
            Ir a Step 4: Demo Day ready
          </Link>
        )}
      </section>
    </ProjectFrame>
  );
}
