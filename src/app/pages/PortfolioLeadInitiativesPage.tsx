import React, { useMemo } from 'react';
import { ArrowRight, FolderKanban, ListFilter, ShieldAlert, Signal, TimerReset } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { InitiativeExecutiveDetailDrawer } from '../components/portfolio/InitiativeExecutiveDetailDrawer';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { challengeTypeLabel, initiativeStatusLabel, portfolioDecisionLabel } from '../portfolio/portfolioLeadCopy';
import { PortfolioLeadBreadcrumbs, PortfolioLeadContextStrip, PortfolioLeadEmptyState } from '../components/portfolio/PortfolioLeadPageElements';

function getDecisionEntryLabel(initiative: ReturnType<typeof usePortfolioLead>['initiatives'][number]) {
  if (initiative.status === 'lista_para_decision') return 'Lista para decision';
  if (initiative.status === 'bloqueada') return 'Bloqueada y requiere destrabe';
  if (initiative.currentStep === 'Step 4') return 'Step 4 con evidencia suficiente';
  return 'Sigue en seguimiento';
}

function getRiskSignals(
  initiative: ReturnType<typeof usePortfolioLead>['initiatives'][number],
  overlaps: ReturnType<typeof usePortfolioLead>['initiativeOverlaps'],
) {
  const items: string[] = [];
  if (initiative.status === 'bloqueada') items.push('Bloqueada');
  if (initiative.blockedDays >= 14) items.push('Sin actividad reciente');
  if (initiative.partialSignal && !initiative.readyForDecision) items.push('Requiere redefinicion');
  if (overlaps.some(item => item.initiativeAId === initiative.id || item.initiativeBId === initiative.id)) items.push('Posible solapamiento');
  return items;
}

function getTouchpointSignals(initiative: ReturnType<typeof usePortfolioLead>['initiatives'][number]) {
  const items: string[] = [];
  if (initiative.status === 'esperando_revision' || initiative.mentor.trim()) items.push(initiative.mentor.trim() ? 'Mentor touchpoint visible' : 'Revision pendiente');
  if (initiative.requiresSponsor || initiative.sponsorTouchpoint.trim()) items.push(initiative.sponsorTouchpoint.trim() ? 'Sponsor touchpoint visible' : 'Sponsor touchpoint pendiente');
  return items;
}

function getEvidenceStatus(initiative: ReturnType<typeof usePortfolioLead>['initiatives'][number]) {
  if (initiative.deliverables.length === 0) return 'Sin evidencia visible';
  if (initiative.currentStep === 'Step 4' || initiative.readyForDecision) return 'Evidencia cargada y lista para lectura';
  if (initiative.currentStep === 'Step 3') return 'Evidencia en construccion';
  return 'Evidencia inicial cargada';
}

export function PortfolioLeadInitiativesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { strategicFronts, challenges, initiatives, initiativeOverlaps, portfolioDecisions, executiveOutputs, createExecutiveOutput } = usePortfolioLead();

  const challengeId = searchParams.get('challengeId') ?? '';
  const frontId = searchParams.get('frontId') ?? '';
  const initiativeId = searchParams.get('initiativeId') ?? '';
  const selectedChallenge = challenges.find(item => item.id === challengeId) ?? null;
  const selectedFront = strategicFronts.find(item => item.id === frontId)
    ?? strategicFronts.find(item => item.id === selectedChallenge?.strategicFrontId)
    ?? null;

  const visibleInitiatives = useMemo(() => {
    if (selectedChallenge) return initiatives.filter(item => item.challengeId === selectedChallenge.id);
    if (selectedFront) return initiatives.filter(item => item.strategicFrontId === selectedFront.id);
    return [];
  }, [initiatives, selectedChallenge, selectedFront]);

  const activeInitiative = visibleInitiatives.find(item => item.id === initiativeId)
    ?? initiatives.find(item => item.id === initiativeId)
    ?? null;

  const grouped = useMemo(() => {
    if (!selectedFront) return [];
    return challenges
      .filter(item => item.strategicFrontId === selectedFront.id)
      .map(challenge => ({
        challenge,
        initiatives: initiatives.filter(item => item.challengeId === challenge.id),
      }));
  }, [challenges, initiatives, selectedFront]);

  const contextSummary = useMemo(() => ({
    total: visibleInitiatives.length,
    pendingReview: visibleInitiatives.filter(item => item.status === 'esperando_revision').length,
    pendingDecision: visibleInitiatives.filter(item => item.readyForDecision || item.status === 'bloqueada').length,
    withRisk: visibleInitiatives.filter(item => getRiskSignals(item, initiativeOverlaps).length > 0).length,
  }), [initiativeOverlaps, visibleInitiatives]);

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    navigate(`/portfolio/iniciativas?${next.toString()}`);
  };

  if (!selectedFront && !selectedChallenge) {
    return (
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Iniciativas' }]} />
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <PortfolioLeadEmptyState
            title="Primero entra por un frente o por un reto"
            description="Esta vista no funciona como repositorio plano. Necesita contexto de portafolio para leer que iniciativa aborda que reto, con que senal avanza y cual es el siguiente paso."
            primaryAction={{ label: 'Ir a Retos', onClick: () => navigate('/portfolio/retos') }}
            secondaryAction={{ label: 'Ir a Frentes', onClick: () => navigate('/portfolio/frentes-estrategicos') }}
          />
        </section>
      </div>
    );
  }

  const currentChallenge = selectedChallenge ?? grouped.find(item => item.initiatives.length > 0)?.challenge ?? null;
  const contextNextAction = selectedChallenge
    ? !selectedChallenge.visibleToParticipants
      ? 'El reto existe, pero todavia no esta activo. Primero conviene completar activacion.'
      : visibleInitiatives.length === 0
        ? 'El reto ya esta activo, pero todavia no genera iniciativas visibles. Conviene revisar convocatoria, invitaciones o squad.'
        : contextSummary.pendingDecision > 0
          ? 'Hay iniciativas que ya piden decision. Conviene revisar esa cola.'
          : challengeExecutiveSummary(selectedChallenge, initiatives).nextAction
    : selectedFront
      ? grouped.some(item => item.initiatives.length === 0)
        ? 'Hay retos del frente sin iniciativas visibles. Conviene revisar cobertura y activacion.'
        : contextSummary.pendingDecision > 0
          ? 'El frente ya acumula casos que piden decision.'
          : 'Mantener seguimiento contextual del frente sin perder la lectura por reto.'
      : 'Sin contexto suficiente';

  const contextCta = selectedChallenge
    ? !selectedChallenge.visibleToParticipants
      ? { label: 'Activar reto', onClick: () => navigate(`/portfolio/retos?challengeId=${encodeURIComponent(selectedChallenge.id)}`) }
      : visibleInitiatives.length === 0
        ? { label: 'Revisar reto activo', onClick: () => navigate(`/portfolio/retos?challengeId=${encodeURIComponent(selectedChallenge.id)}`) }
        : contextSummary.pendingDecision > 0
          ? { label: 'Revisar decisiones', onClick: () => navigate(`/portfolio/decisiones?challengeId=${encodeURIComponent(selectedChallenge.id)}`) }
          : { label: 'Volver al reto', onClick: () => navigate(`/portfolio/retos?challengeId=${encodeURIComponent(selectedChallenge.id)}`) }
    : selectedFront
      ? { label: grouped.every(item => item.initiatives.length === 0) ? 'Crear primer reto' : 'Volver a retos', onClick: () => navigate(`/portfolio/retos?frontId=${encodeURIComponent(selectedFront.id)}`) }
      : { label: 'Ir a Retos', onClick: () => navigate('/portfolio/retos') };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs
        items={[
          { label: 'Portfolio Lead', path: '/portfolio/inicio' },
          selectedFront ? { label: selectedFront.name, path: `/portfolio/retos?frontId=${encodeURIComponent(selectedFront.id)}` } : { label: 'Retos', path: '/portfolio/retos' },
          selectedChallenge ? { label: selectedChallenge.name, path: `/portfolio/retos?challengeId=${encodeURIComponent(selectedChallenge.id)}` } : { label: 'Iniciativas' },
        ]}
      />

      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f7f3e4_0%,#ffffff_60%,#eef3ea_100%)] p-6 md:p-8">
        <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>INICIATIVAS</p>
        <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          Seguimiento contextual del trabajo ya activado
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Esta vista muestra que iniciativa aborda que reto, que parte cubre, que senal ya genero y que apoyo necesita sin romper el contexto del frente.
        </p>

        <PortfolioLeadContextStrip
          items={[
            { label: 'Frente padre visible', value: selectedFront?.name ?? 'Sin frente visible' },
            { label: 'Reto seleccionado', value: currentChallenge?.name ?? 'Comparacion por frente' },
            { label: 'Estado de activacion', value: currentChallenge ? challengeStatusLabel(currentChallenge.status) : 'Lectura agregada del frente' },
            { label: 'Iniciativas asociadas', value: `${visibleInitiatives.length}` },
            { label: 'Siguiente accion recomendada', value: contextNextAction },
          ]}
        />
      </div>

      {selectedFront ? (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>CONTEXTO PADRE</p>
              <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>
                {selectedChallenge ? 'Seguimiento contextual por reto' : 'Seguimiento contextual por frente'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Frente: {selectedFront.name}
                {selectedChallenge ? ` · Reto: ${selectedChallenge.name}` : ''}
              </p>
            </div>
            <button
              onClick={contextCta.onClick}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              style={{ fontWeight: 600 }}
            >
              {contextCta.label}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <ContextMetric icon={FolderKanban} label="Iniciativas visibles" value={`${contextSummary.total}`} hint="Trabajo asociado al contexto actual" />
            <ContextMetric icon={ListFilter} label="Revision pendiente" value={`${contextSummary.pendingReview}`} hint="Casos que todavia piden lectura o ajuste" />
            <ContextMetric icon={Signal} label="Con senal de decision" value={`${contextSummary.pendingDecision}`} hint="Casos que podrian escalar o destrabarse" />
            <ContextMetric icon={ShieldAlert} label="Con riesgo visible" value={`${contextSummary.withRisk}`} hint="Bloqueos, inactividad o solapamientos" />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <InfoPill label="Frente estrategico" value={selectedFront.name} />
            <InfoPill label="Sponsor principal" value={selectedFront.sponsor} />
            <InfoPill label="KPI del frente" value={selectedFront.mainKpi} />
            <InfoPill label="Contexto actual" value={selectedChallenge ? 'Comparacion dentro del reto' : 'Comparacion entre retos del frente'} />
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <ListFilter size={16} className="text-slate-700" />
          <h2 className="text-lg text-slate-950" style={{ fontWeight: 700 }}>Seguimiento, senal y riesgo</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Cada iniciativa se lee desde su reto padre y separa capas de seguimiento, senal de avance y riesgo.
        </p>

        {selectedChallenge && visibleInitiatives.length === 0 ? (
          <EmptyStateCard
            title="Este reto todavia no tiene iniciativas bajo seguimiento"
            description={!selectedChallenge.visibleToParticipants
              ? 'Primero conviene publicar el reto. Mientras siga antes de publicacion, esta vista no debe leerse como seguimiento activo.'
              : 'El reto ya es visible, pero aun no hay iniciativas suficientes para compararlo con contexto.'}
            actionLabel={!selectedChallenge.visibleToParticipants ? 'Activar reto' : 'Volver al reto'}
            onAction={() => navigate(`/portfolio/retos?challengeId=${encodeURIComponent(selectedChallenge.id)}`)}
          />
        ) : !selectedChallenge && grouped.length === 0 ? (
          <EmptyStateCard
            title="Este frente todavia no tiene retos con iniciativas"
            description="Primero crea o publica retos dentro de este frente para que la lectura de iniciativas tenga contexto real."
            actionLabel="Ir a retos"
            onAction={() => navigate(`/portfolio/retos?frontId=${encodeURIComponent(selectedFront?.id ?? '')}`)}
          />
        ) : (
          <div className="mt-5 space-y-5">
            {(selectedChallenge
              ? [{ challenge: selectedChallenge, initiatives: visibleInitiatives }]
              : grouped
            ).map(group => (
              <article key={group.challenge.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{selectedFront?.name ?? 'Sin frente'}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{challengeTypeLabel(group.challenge.challengeType)}</span>
                    </div>
                    <p className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{group.challenge.name}</p>
                    <p className="mt-2 text-sm text-slate-600">{group.challenge.objective}</p>
                  </div>
                  {!selectedChallenge ? (
                    <button
                      onClick={() => navigate(`/portfolio/iniciativas?challengeId=${encodeURIComponent(group.challenge.id)}`)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      style={{ fontWeight: 600 }}
                    >
                      Ver solo este reto
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <InfoPill label="Parte del frente que cubre" value={group.challenge.whatWeWantToMove} />
                  <InfoPill label="Criterio de exito" value={group.challenge.successCriteria} />
                  <InfoPill label="Estado del reto" value={challengeStatusLabel(group.challenge.status)} />
                  <InfoPill label="Siguiente accion del reto" value={challengeExecutiveSummary(group.challenge, initiatives).nextAction} />
                </div>

                {group.initiatives.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Sin iniciativas todavia</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {!group.challenge.visibleToParticipants
                        ? 'El reto aun no fue publicado. Todavia no corresponde leer trabajo activo.'
                        : 'El reto ya es visible, pero aun no vuelve como iniciativa para seguimiento.'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    {group.initiatives.map(initiative => {
                      const decision = portfolioDecisions.find(item => item.initiativeId === initiative.id);
                      const riskSignals = getRiskSignals(initiative, initiativeOverlaps);
                      const touchpoints = getTouchpointSignals(initiative);
                      const overlap = initiativeOverlaps.find(item => item.initiativeAId === initiative.id || item.initiativeBId === initiative.id);
                      return (
                        <InitiativeContextCard
                          key={initiative.id}
                          initiative={initiative}
                          frontName={selectedFront?.name ?? 'Sin frente'}
                          challengeName={group.challenge.name}
                          challengeType={challengeTypeLabel(group.challenge.challengeType)}
                          decisionLabel={decision ? portfolioDecisionLabel(decision.recommendation) : 'Sin decision provisional'}
                          evidenceLabel={getEvidenceStatus(initiative)}
                          riskSignals={riskSignals}
                          touchpoints={touchpoints}
                          overlapNote={overlap?.rationale ?? null}
                          onOpenDetail={() => updateQuery({ challengeId: group.challenge.id, initiativeId: initiative.id })}
                          onOpenDecision={decision ? () => navigate(`/portfolio/decisiones?challengeId=${encodeURIComponent(group.challenge.id)}&initiativeId=${encodeURIComponent(initiative.id)}`) : null}
                        />
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {activeInitiative ? (
        <InitiativeExecutiveDetailDrawer
          initiative={activeInitiative}
          frontName={strategicFronts.find(item => item.id === activeInitiative.strategicFrontId)?.name ?? 'Sin frente'}
          challengeName={challenges.find(item => item.id === activeInitiative.challengeId)?.name ?? 'Sin reto'}
          recommendation={portfolioDecisions.find(item => item.initiativeId === activeInitiative.id)?.recommendation ?? 'iterar_desde_otro_angulo'}
          executiveOutputId={executiveOutputs.find(item => item.initiativeId === activeInitiative.id)?.id ?? null}
          onOpenExecutiveOutput={() => {
            const existingOutput = executiveOutputs.find(item => item.initiativeId === activeInitiative.id);
            const output = existingOutput ?? createExecutiveOutput(
              activeInitiative.id,
              portfolioDecisions.find(item => item.initiativeId === activeInitiative.id)?.recommendation ?? 'iterar_desde_otro_angulo',
            );
            if (!output) return;
            navigate(`/portfolio/salida-ejecutiva?outputId=${encodeURIComponent(output.id)}`);
          }}
          onClose={() => updateQuery({ initiativeId: null })}
        />
      ) : null}
    </div>
  );
}

function InitiativeContextCard({
  initiative,
  frontName,
  challengeName,
  challengeType,
  decisionLabel,
  evidenceLabel,
  riskSignals,
  touchpoints,
  overlapNote,
  onOpenDetail,
  onOpenDecision,
}: {
  initiative: ReturnType<typeof usePortfolioLead>['initiatives'][number];
  frontName: string;
  challengeName: string;
  challengeType: string;
  decisionLabel: string;
  evidenceLabel: string;
  riskSignals: string[];
  touchpoints: string[];
  overlapNote: string | null;
  onOpenDetail: () => void;
  onOpenDecision: (() => void) | null;
}) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-4xl">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{initiative.currentStep}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{initiativeStatusLabel(initiative.status)}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{initiative.contributionType.replaceAll('_', ' ')}</span>
          </div>
          <h3 className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{initiative.name}</h3>
          <p className="mt-2 text-sm text-slate-600">{initiative.executiveSummary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onOpenDetail} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
            Ver detalle
          </button>
          {onOpenDecision ? (
            <button onClick={onOpenDecision} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
              Ir a decision
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <InfoPill label="Frente estrategico" value={frontName} />
        <InfoPill label="Reto asociado" value={challengeName} />
        <InfoPill label="Tipo de reto" value={challengeType} />
        <InfoPill label="Foco / objetivo" value={initiative.attackedArea} />
        <InfoPill label="Metrica principal" value={initiative.mainMetric} />
        <InfoPill label="Tiempo activa" value={initiative.lastActivity} />
        <InfoPill label="Equipo" value={initiative.teamMembers.length > 0 ? initiative.teamMembers.join(', ') : initiative.teamLabel} />
        <InfoPill label="Initiative owner" value={initiative.teamOwner} />
        <InfoPill label="Mentor" value={initiative.mentor || 'Sin mentor visible'} />
        <InfoPill label="Sponsor relacionado" value={initiative.sponsorTouchpoint || 'Sin sponsor touchpoint visible'} />
        <InfoPill label="Bloqueos" value={initiative.mainBlocker || 'Sin bloqueo visible'} />
        <InfoPill label="Siguiente hito" value={initiative.nextActionRecommended} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <SignalPanel
          title="Seguimiento"
          icon={TimerReset}
          items={[
            `Progreso Step 0-4: ${initiative.stepsTimeline.filter(item => item.state === 'completado').length}/5 completados`,
            initiative.status === 'esperando_revision' ? 'Revision pendiente visible' : 'Revision pendiente no visible',
            touchpoints.find(item => item.includes('Mentor')) ?? 'Mentor touchpoint no visible',
            touchpoints.find(item => item.includes('Sponsor')) ?? 'Sponsor touchpoint no visible',
          ]}
          tone="slate"
        />
        <SignalPanel
          title="Senal de avance"
          icon={Signal}
          items={[
            `Evidencia: ${evidenceLabel}`,
            `Metrica base: ${initiative.mainMetric}`,
            `Senal obtenida: ${initiative.signalSummary}`,
            `Decision provisional: ${decisionLabel}`,
          ]}
          tone="emerald"
        />
        <SignalPanel
          title="Riesgo"
          icon={ShieldAlert}
          items={riskSignals.length > 0 ? riskSignals : ['Sin riesgo visible ahora']}
          tone={riskSignals.length > 0 ? 'rose' : 'slate'}
        />
      </div>

      {overlapNote ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Posible solapamiento</p>
          <p className="mt-2 text-sm text-amber-800">{overlapNote}</p>
        </div>
      ) : null}
    </article>
  );
}

function ContextMetric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
        <Icon size={18} />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-3xl text-slate-950" style={{ fontWeight: 700 }}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function SignalPanel({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: string[];
  tone: 'slate' | 'emerald' | 'rose';
}) {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  };

  return (
    <div className={`rounded-2xl border p-4 ${classes[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <p className="text-sm" style={{ fontWeight: 700 }}>{title}</p>
      </div>
      <div className="mt-3 space-y-2">
        {items.map(item => (
          <p key={item} className="text-sm opacity-90">{item}</p>
        ))}
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function EmptyStateCard({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="mt-5">
      <PortfolioLeadEmptyState
        title={title}
        description={description}
        primaryAction={{ label: actionLabel, onClick: onAction }}
      />
    </div>
  );
}
