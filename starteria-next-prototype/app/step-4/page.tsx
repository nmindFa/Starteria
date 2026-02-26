'use client';

import { ProjectFrame } from '@/components/ProjectFrame';
import { EvidencePicker } from '@/components/EvidencePicker';
import { OnePagerEditor } from '@/components/OnePagerEditor';
import { PitchStudio } from '@/components/PitchStudio';
import { StatusBadge } from '@/components/StatusBadge';
import { StoryBuilder } from '@/components/StoryBuilder';
import { mockProject } from '@/lib/mockData';
import { useLocalStorageState } from '@/lib/storage';
import { OnePagerState } from '@/lib/types';
import { canMarkDemoDayReady } from '@/lib/utils';

function buildPrefillFromStep3(project: typeof mockProject): OnePagerState {
  const closedRuns = project.step3.runs.filter((r) => r.status === 'Cerrado');
  const avg = closedRuns.length
    ? Math.round(closedRuns.reduce((acc, r) => acc + (r.resultado || 0), 0) / closedRuns.length)
    : 0;

  return {
    reto: 'Reducir tiempos de alta TI sin comprometer seguridad.',
    metricaUmbral: `${project.step3.testCard.metrica}. Umbral: ${project.step3.testCard.umbralGoNoGo}`,
    disenoExperimento: project.step3.testCard.experimento,
    runsEjecutados: project.step3.runs.map((r) => `${r.name}: ${r.status}`).join(' | '),
    resultados: `Promedio observado: ${avg}. Estado final run más reciente: ${project.step3.runs[project.step3.runs.length - 1]?.status || 'N/A'}.`,
    aprendizajes: closedRuns.map((r) => r.learning.aprendimos).filter(Boolean).join(' | ') || 'POR DEFINIR',
    recomendacion: project.step3.finalDecision || 'POR DEFINIR',
    pedidoLider: 'Patrocinio para siguiente iteración y capacidad de TI por 4 semanas.',
  };
}

export default function Step4Page() {
  const { state: project, setState: setProject, hydrated } = useLocalStorageState('starteria-prototype-project', mockProject);
  if (!hydrated) return <main className="p-6 text-sm text-slate-600">Cargando prototipo...</main>;

  const allEvidences = project.step3.runs.flatMap((r) => r.evidences);
  const demoDayCheck = canMarkDemoDayReady(project);

  const mergePrefill = () => {
    const newPrefill = buildPrefillFromStep3(project);
    const merged: OnePagerState = {
      ...newPrefill,
      ...project.step4.manualEdits,
    };

    setProject({
      ...project,
      step4: {
        ...project.step4,
        requiereRefrescar: false,
        onePager: merged,
        story: {
          ...project.step4.story,
          queVimos: newPrefill.resultados,
          queAprendimos: newPrefill.aprendizajes,
        },
      },
    });
  };

  const setStep4Status = (status: typeof project.step4.status) => {
    setProject({
      ...project,
      step4: { ...project.step4, status },
      stepStatus: { ...project.stepStatus, 4: status },
      estadoProyecto: status === 'Aprobado' ? 'Finalizado' : project.estadoProyecto,
    });
  };

  return (
    <ProjectFrame project={project} activeStep={4}>
      {project.step4.requiereRefrescar && (
        <section className="card border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Requiere refrescar</p>
          <p className="text-xs text-amber-700">Step 1-3 cambió después de generar este material.</p>
          <button onClick={mergePrefill} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
            Actualizar prefill (mantener mis ediciones)
          </button>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <StoryBuilder
          value={project.step4.story}
          onChange={(patch) => setProject({ ...project, step4: { ...project.step4, story: { ...project.step4.story, ...patch } } })}
        />

        <OnePagerEditor
          value={project.step4.onePager}
          onChange={(patch) =>
            setProject({
              ...project,
              step4: {
                ...project.step4,
                onePager: { ...project.step4.onePager, ...patch },
                manualEdits: { ...project.step4.manualEdits, ...patch },
              },
            })
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EvidencePicker
          evidences={allEvidences}
          selectedIds={project.step4.selectedEvidenceIds}
          onToggle={(id) =>
            setProject({
              ...project,
              step4: {
                ...project.step4,
                selectedEvidenceIds: project.step4.selectedEvidenceIds.includes(id)
                  ? project.step4.selectedEvidenceIds.filter((x) => x !== id)
                  : [...project.step4.selectedEvidenceIds, id],
              },
            })
          }
        />

        <div className="card space-y-3">
          <h3 className="section-title">Recomendación final y pedido al líder</h3>
          <div className="flex gap-2">
            {(['Go', 'Pivotar', 'Stop'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setProject({ ...project, step4: { ...project.step4, recommendation: r } })}
                className={`rounded-lg px-3 py-1.5 text-xs ${project.step4.recommendation === r ? 'bg-brand-600 text-white' : 'border border-slate-200 text-slate-700'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Razón (2-3 bullets)</p>
          {[0, 1, 2].map((idx) => (
            <input
              key={idx}
              value={project.step4.razones[idx] || ''}
              onChange={(e) =>
                setProject({
                  ...project,
                  step4: {
                    ...project.step4,
                    razones: [0, 1, 2].map((i) => (i === idx ? e.target.value : project.step4.razones[i] || '')),
                  },
                })
              }
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              placeholder={`Razón ${idx + 1}`}
            />
          ))}
          <textarea
            value={project.step4.pedidoConcreto}
            onChange={(e) => setProject({ ...project, step4: { ...project.step4, pedidoConcreto: e.target.value } })}
            rows={2}
            placeholder="Pedido concreto (permiso/recursos/decisión)"
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
          <label className="block text-sm text-slate-700">
            Fecha objetivo
            <input
              type="date"
              value={project.step4.fechaObjetivo}
              onChange={(e) => setProject({ ...project, step4: { ...project.step4, fechaObjetivo: e.target.value } })}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>

          <button
            disabled={!demoDayCheck.ok}
            aria-disabled={!demoDayCheck.ok}
            title={!demoDayCheck.ok ? demoDayCheck.reasons.join(' | ') : ''}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${demoDayCheck.ok ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}
          >
            Listo para Demo Day
          </button>
          {!demoDayCheck.ok && (
            <ul className="list-disc pl-5 text-xs text-amber-700">
              {demoDayCheck.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <PitchStudio
        fileName={project.step4.pitchFileName}
        evaluation={project.step4.pitchEvaluation}
        onFile={(name) => setProject({ ...project, step4: { ...project.step4, pitchFileName: name } })}
        onEvaluate={() =>
          setProject({
            ...project,
            step4: {
              ...project.step4,
              pitchEvaluation: {
                score: 82,
                fortalezas: ['Historia clara de problema y experimento', 'Recomendación accionable'],
                confusiones: ['Falta precisar riesgo residual', 'Pedido al líder no tiene costo estimado'],
                reescritura: [
                  'Partimos de un problema concreto de onboarding TI.',
                  'Probamos un flujo mínimo con dos corridas controladas.',
                  'Vimos mejora, pero aún hay fricción en ownership.',
                  'Recomendamos iterar con sponsor y metas de 4 semanas.',
                ],
                tipDelivery: 'Abre con resultado numérico y cierra con pedido concreto en menos de 2 minutos.',
              },
            },
          })
        }
      />

      <section className="card space-y-3">
        <h2 className="text-base font-bold">Enviar a revisión y gating</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setStep4Status('Enviado a revisión')} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Enviar a revisión IA</button>
          <button
            onClick={() =>
              setProject({
                ...project,
                step4: {
                  ...project.step4,
                  status: 'Feedback IA',
                  feedback: {
                    score: 84,
                    acciones: ['Ajustar recomendación con riesgo residual', 'Mejorar pedido con fecha de decisión'],
                    preguntas: ['Qué pasa si no se aprueba el pedido?', 'Cómo escalarías a otra área?'],
                  },
                },
                stepStatus: { ...project.stepStatus, 4: 'Feedback IA' },
              })
            }
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            Simular feedback IA
          </button>
          <button onClick={() => setStep4Status('Ajustado')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Marcar acciones resueltas</button>
          <button onClick={() => setStep4Status('Sesión experto pendiente')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Solicitar sesión experto</button>
          <button onClick={() => setStep4Status('Aprobado')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Aprobar experto</button>
          <StatusBadge status={project.step4.status} />
        </div>
        {project.step4.feedback && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800">
            Score: {project.step4.feedback.score}. Acciones: {project.step4.feedback.acciones.slice(0, 5).join(' | ')}. Preguntas: {project.step4.feedback.preguntas.slice(0, 5).join(' | ')}.
          </div>
        )}
      </section>
    </ProjectFrame>
  );
}
