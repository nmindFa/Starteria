import React from 'react';
import type {
  ExecutiveOutputStatus,
  Initiative,
  InitiativePortfolioStatus,
  InitiativeStepProgressState,
  PortfolioDecisionOutcome,
} from '../../portfolio/PortfolioLeadContext';
import { executiveOutputStatusLabel, initiativeStatusLabel, portfolioDecisionLabel } from '../../portfolio/portfolioLeadCopy';

export function initiativeExecutiveStatusLabel(status: InitiativePortfolioStatus) {
  const labels: Record<InitiativePortfolioStatus, string> = {
    en_step_0: 'En progreso',
    en_step_1: 'En progreso',
    en_step_2: 'En progreso',
    en_step_3: 'En progreso',
    en_step_4: 'En progreso',
    bloqueada: 'Bloqueada',
    esperando_revision: 'Esperando revision',
    lista_para_decision: 'Lista para decision',
    cerrada: 'Cerrada',
  };
  return labels[status];
}

export function InitiativeStatusBadge({ status }: { status: InitiativePortfolioStatus }) {
  const classes: Record<InitiativePortfolioStatus, string> = {
    en_step_0: 'border-sky-200 bg-sky-50 text-sky-700',
    en_step_1: 'border-sky-200 bg-sky-50 text-sky-700',
    en_step_2: 'border-sky-200 bg-sky-50 text-sky-700',
    en_step_3: 'border-sky-200 bg-sky-50 text-sky-700',
    en_step_4: 'border-sky-200 bg-sky-50 text-sky-700',
    bloqueada: 'border-rose-200 bg-rose-50 text-rose-700',
    esperando_revision: 'border-amber-200 bg-amber-50 text-amber-700',
    lista_para_decision: 'border-violet-200 bg-violet-50 text-violet-700',
    cerrada: 'border-slate-300 bg-slate-200 text-slate-700',
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${classes[status]}`}>
      {initiativeExecutiveStatusLabel(status)}
    </span>
  );
}

export function ExecutiveOutputStatusBadge({ status }: { status: ExecutiveOutputStatus }) {
  const classes: Record<ExecutiveOutputStatus, string> = {
    borrador_ejecutivo: 'border-slate-200 bg-slate-100 text-slate-700',
    listo_para_compartir: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    compartido_con_sponsor: 'border-amber-200 bg-amber-50 text-amber-700',
    compartido_con_gerencia: 'border-sky-200 bg-sky-50 text-sky-700',
    decision_recibida: 'border-violet-200 bg-violet-50 text-violet-700',
    aprobado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    aprobado_con_ajustes: 'border-orange-200 bg-orange-50 text-orange-700',
    rechazado: 'border-rose-200 bg-rose-50 text-rose-700',
    transferido: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    escalado_a_segunda_fase: 'border-teal-200 bg-teal-50 text-teal-700',
    cerrado: 'border-slate-300 bg-slate-200 text-slate-700',
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${classes[status]}`}>
      {executiveOutputStatusLabel(status)}
    </span>
  );
}

export function ExecutiveStepTimeline({ initiative }: { initiative: Initiative }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {initiative.stepsTimeline.map(item => (
        <div key={item.step} className={`rounded-2xl border p-4 ${stepStateClasses(item.state)}`}>
          <p className="text-xs" style={{ fontWeight: 700 }}>{item.step}</p>
          <p className="mt-2 text-xs opacity-80">{stepStateLabel(item.state)}</p>
          <p className="mt-2 text-sm opacity-90">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

export function DeliverablesList({ initiative }: { initiative: Initiative }) {
  return (
    <div className="grid gap-3">
      {initiative.deliverables.map(item => (
        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.type}</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

export function DecisionRecommendationPanel({
  recommendation,
  reason,
  evidence,
}: {
  recommendation: PortfolioDecisionOutcome;
  reason: string;
  evidence: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Recomendacion visible de Starteria</p>
      <p className="mt-2 text-sm text-amber-800">
        <span style={{ fontWeight: 700 }}>{portfolioDecisionLabel(recommendation)}.</span> {reason}
      </p>
      <p className="mt-3 text-sm text-amber-800">
        <span style={{ fontWeight: 700 }}>Evidencia que la respalda:</span> {evidence}
      </p>
    </div>
  );
}

export function InitiativeMiniMeta({ initiative }: { initiative: Initiative }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <InfoCard label="Owner" value={initiative.teamOwner} />
      <InfoCard label="Equipo" value={initiative.teamMembers.length > 0 ? initiative.teamMembers.join(', ') : initiative.teamLabel || 'Sin equipo visible'} />
      <InfoCard label="Mentor" value={initiative.mentor || 'Sin mentor asignado'} />
      <InfoCard label="Estado" value={`${initiativeExecutiveStatusLabel(initiative.status)} · ${initiativeStatusLabel(initiative.status)}`} />
      <InfoCard label="Ultima actividad" value={initiative.lastActivity} />
      <InfoCard label="Bloqueo principal" value={initiative.mainBlocker || 'Sin bloqueo visible'} />
    </div>
  );
}

export function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function stepStateLabel(state: InitiativeStepProgressState) {
  const labels: Record<InitiativeStepProgressState, string> = {
    completado: 'Completado',
    en_progreso: 'En progreso',
    pendiente: 'Pendiente',
    bloqueado: 'Bloqueado',
  };
  return labels[state];
}

function stepStateClasses(state: InitiativeStepProgressState) {
  switch (state) {
    case 'completado':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'en_progreso':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'bloqueado':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900';
  }
}
