import React from 'react';
import { ArrowLeft, Download, Send, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ExecutiveOutputStatusBadge,
  InfoCard,
} from '../components/portfolio/InitiativeExecutiveComponents';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { challengeTypeLabel, executiveOutputStatusLabel, portfolioDecisionLabel } from '../portfolio/portfolioLeadCopy';

const STATUS_ACTIONS = [
  { status: 'borrador_ejecutivo', label: 'Marcar como borrador ejecutivo' },
  { status: 'listo_para_compartir', label: 'Marcar como listo para compartir' },
  { status: 'compartido_con_sponsor', label: 'Compartir con sponsor' },
  { status: 'compartido_con_gerencia', label: 'Compartir con gerencia' },
  { status: 'decision_recibida', label: 'Registrar decision recibida' },
  { status: 'cerrado', label: 'Cerrar salida ejecutiva' },
] as const;

export function PortfolioLeadExecutiveOutputPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { executiveOutputs, initiatives, challenges, strategicFronts, updateExecutiveOutputStatus } = usePortfolioLead();

  const outputId = searchParams.get('outputId') ?? '';
  const initiativeId = searchParams.get('initiativeId') ?? '';
  const output = executiveOutputs.find(item => item.id === outputId || item.initiativeId === initiativeId) ?? null;
  const initiative = initiatives.find(item => item.id === output?.initiativeId) ?? null;
  const challenge = challenges.find(item => item.id === output?.challengeId) ?? null;
  const front = strategicFronts.find(item => item.id === challenge?.strategicFrontId) ?? null;

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!output || !initiative || !challenge || !front) {
    return (
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <div className="rounded-3xl border border-dashed border-slate-300 bg-[#faf8f2] p-6">
          <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Todavia no existe una salida ejecutiva para esta iniciativa</p>
          <p className="mt-2 text-sm text-slate-600">Primero preparala desde Decisiones o desde el detalle ejecutivo de la iniciativa.</p>
          <button onClick={() => navigate('/portfolio/decisiones')} className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
            Volver a Decisiones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <button
        onClick={() => navigate(`/portfolio/decisiones?initiativeId=${encodeURIComponent(initiative.id)}`)}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={14} />
        Volver a Decisiones
      </button>

      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff4d8_0%,#ffffff_56%,#eef3ea_100%)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-4xl">
            <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>SALIDA EJECUTIVA</p>
            <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
              Traduccion ejecutiva lista para sponsor, comite o gerencia
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Esta capa toma la decision interna del portafolio y la convierte en una recomendacion clara sobre contexto, evidencia, apoyo requerido y siguiente paso.
            </p>
          </div>
          <ExecutiveOutputStatusBadge status={output.status} />
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>SECUENCIA VISIBLE</p>
            <p className="mt-2 text-sm text-slate-600">
              Iniciativa avanza → Portfolio Lead revisa → Portfolio Lead decide → Starteria traduce → Gerencia recibe una recomendacion clara.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => downloadText(`${initiative.id}-salida-ejecutiva.txt`, `${initiative.name}\n\nContexto: ${front.name} / ${challenge.name}\n\nRecomendacion: ${portfolioDecisionLabel(output.recommendation)}\n\nEvidencia: ${output.evidenceSummary}\n\nQue se necesita de gerencia: ${output.managementNeeds.join(', ')}\n\nProximo paso: ${output.nextStepSummary}`)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              style={{ fontWeight: 600 }}
            >
              <Download size={14} className="mr-2 inline-flex" />
              Descargar resumen ejecutivo
            </button>
            <button
              onClick={() => downloadText(`${initiative.id}-resumen-experimento.txt`, `${initiative.name}\n\n${initiative.experimentSummary}\n\nEntregables:\n${initiative.deliverables.map(item => `- ${item.title}: ${item.note}`).join('\n')}`)}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
              style={{ fontWeight: 600 }}
            >
              <Download size={14} className="mr-2 inline-flex" />
              Descargar resumen del experimento
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>CONTEXTO</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoCard label="Frente estrategico" value={front.name} />
              <InfoCard label="Reto" value={challenge.name} />
              <InfoCard label="Iniciativa" value={initiative.name} />
              <InfoCard label="Tipo de reto" value={challengeTypeLabel(challenge.challengeType)} />
              <InfoCard label="Por que importa ahora" value={output.whyNow} />
              <InfoCard label="KPI o senal a mover" value={output.kpiToMove} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>QUE HIZO EL EQUIPO</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoCard label="Approach o enfoque" value={output.approachSummary} />
              <InfoCard label="Alcance del trabajo" value={output.scopeSummary} />
              <InfoCard label="Step alcanzado" value={initiative.currentStep} />
              <InfoCard label="Equipo responsable" value={initiative.teamMembers.length > 0 ? initiative.teamMembers.join(', ') : initiative.teamLabel || 'Sin equipo visible'} />
              <InfoCard label="Mentor" value={initiative.mentor || 'Sin mentor asignado'} />
              <InfoCard label="Sponsor touchpoint" value={initiative.sponsorTouchpoint || 'No aplica por ahora'} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>QUE EVIDENCIA SE OBTUVO</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoCard label="Senal principal" value={output.evidenceSummary} />
              <InfoCard label="Lectura resumida" value={initiative.signalSummary} />
              <InfoCard label="Entregable mas importante" value={output.keyDeliverableSummary} />
              <InfoCard label="Limitaciones o cautelas" value={output.cautionSummary} />
              <InfoCard label="Comentario IA clave" value={initiative.aiCommentSummary} />
              <InfoCard label="Comentario mentor clave" value={initiative.mentorCommentSummary} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>RECOMENDACION</p>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-amber-800" />
                <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>
                  {portfolioDecisionLabel(output.recommendation)}
                </p>
              </div>
              <p className="mt-2 text-sm text-amber-800">{output.recommendationWhy}</p>
              <p className="mt-3 text-sm text-amber-800">
                <span style={{ fontWeight: 700 }}>Otras opciones en segundo plano:</span> {output.secondaryOptions}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>QUE SE NECESITA DE GERENCIA</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {output.managementNeeds.map(item => (
                <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>PROXIMO PASO</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoCard label="Que sigue" value={output.nextStepSummary} />
              <InfoCard label="Quien lo lidera" value={output.nextStepOwner} />
              <InfoCard label="Horizonte" value={output.nextStepHorizon} />
              <InfoCard label="Resultado esperado" value={output.nextStepExpectedResult} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>ESTADO FRENTE A GERENCIA</p>
            <div className="mt-4">
              <ExecutiveOutputStatusBadge status={output.status} />
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Estado actual: {executiveOutputStatusLabel(output.status)}. La UI deja visible si la propuesta sigue en borrador, si ya fue compartida o si ya hubo respuesta.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>ACCIONES VISIBLES</p>
            <div className="mt-4 grid gap-2">
              {STATUS_ACTIONS.map(action => (
                <button
                  key={action.status}
                  onClick={() => updateExecutiveOutputStatus(output.id, action.status)}
                  className={`rounded-2xl px-4 py-3 text-sm text-left ${output.status === action.status ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
                  style={{ fontWeight: 600 }}
                >
                  {action.label}
                </button>
              ))}
              <button
                onClick={() => updateExecutiveOutputStatus(output.id, 'aprobado')}
                className={`rounded-2xl px-4 py-3 text-sm text-left ${output.status === 'aprobado' ? 'bg-emerald-700 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}
                style={{ fontWeight: 600 }}
              >
                Registrar aprobado
              </button>
              <button
                onClick={() => updateExecutiveOutputStatus(output.id, 'aprobado_con_ajustes')}
                className={`rounded-2xl px-4 py-3 text-sm text-left ${output.status === 'aprobado_con_ajustes' ? 'bg-orange-700 text-white' : 'border border-orange-200 bg-orange-50 text-orange-800'}`}
                style={{ fontWeight: 600 }}
              >
                Registrar aprobado con ajustes
              </button>
              <button
                onClick={() => updateExecutiveOutputStatus(output.id, 'rechazado')}
                className={`rounded-2xl px-4 py-3 text-sm text-left ${output.status === 'rechazado' ? 'bg-rose-700 text-white' : 'border border-rose-200 bg-rose-50 text-rose-800'}`}
                style={{ fontWeight: 600 }}
              >
                Registrar rechazado
              </button>
              <button
                onClick={() => updateExecutiveOutputStatus(output.id, 'transferido')}
                className={`rounded-2xl px-4 py-3 text-sm text-left ${output.status === 'transferido' ? 'bg-cyan-700 text-white' : 'border border-cyan-200 bg-cyan-50 text-cyan-800'}`}
                style={{ fontWeight: 600 }}
              >
                Registrar transferido
              </button>
              <button
                onClick={() => updateExecutiveOutputStatus(output.id, 'escalado_a_segunda_fase')}
                className={`rounded-2xl px-4 py-3 text-sm text-left ${output.status === 'escalado_a_segunda_fase' ? 'bg-teal-700 text-white' : 'border border-teal-200 bg-teal-50 text-teal-800'}`}
                style={{ fontWeight: 600 }}
              >
                Registrar escalado a segunda fase
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>TRAZABILIDAD SIMPLE</p>
            <div className="mt-4 space-y-3">
              {output.timeline.map(item => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{item.label}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>SALIDA SIMPLE</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/portfolio/decisiones?initiativeId=${encodeURIComponent(initiative.id)}`)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                style={{ fontWeight: 600 }}
              >
                Ver decision interna
              </button>
              <button
                onClick={() => navigate(`/portfolio/iniciativas?challengeId=${encodeURIComponent(challenge.id)}&initiativeId=${encodeURIComponent(initiative.id)}`)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                style={{ fontWeight: 600 }}
              >
                Ver detalle ejecutivo de iniciativa
              </button>
              <button
                onClick={() => downloadText(`${initiative.id}-entregables-clave.txt`, initiative.deliverables.map(item => `- ${item.title}: ${item.note}`).join('\n'))}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                style={{ fontWeight: 600 }}
              >
                Ver entregables clave
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
