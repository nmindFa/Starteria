import React, { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Compass, FileSearch, Lightbulb, ShieldAlert } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { InitiativeExecutiveDetailDrawer } from './InitiativeExecutiveDetailDrawer';
import { usePortfolioLead, type Initiative, type PortfolioDecisionOutcome } from '../../portfolio/PortfolioLeadContext';
import {
  challengeTypeLabel,
  executiveOutputStatusLabel,
  initiativeStatusLabel,
  portfolioDecisionLabel,
} from '../../portfolio/portfolioLeadCopy';
import { PortfolioLeadBreadcrumbs, PortfolioLeadContextStrip, PortfolioLeadEmptyState } from './PortfolioLeadPageElements';

function coverageLabel(value: string) {
  const labels: Record<string, string> = {
    sin_cobertura: 'Sin cobertura',
    cobertura_parcial: 'Cobertura parcial',
    cobertura_suficiente: 'Cobertura suficiente',
    resuelto: 'Resuelto',
    reformular: 'Necesita reformulacion',
    cerrar: 'Cerrar',
  };
  return labels[value] ?? value;
}

function estimateVisibleDays(lastActivity: string) {
  const normalized = lastActivity.toLowerCase();
  if (normalized.includes('hoy')) return 1;
  if (normalized.includes('ayer')) return 2;
  const daysMatch = normalized.match(/(\d+)/);
  if (daysMatch) return Number(daysMatch[1]);
  if (normalized.includes('semana')) return 7;
  return 5;
}

function noCloseCause(initiative: Initiative, sponsorPending: boolean, ownerPending: boolean) {
  if (ownerPending || !initiative.teamOwner.trim()) return 'Falta de owner';
  if (sponsorPending || (initiative.requiresSponsor && !initiative.sponsorTouchpoint.trim())) return 'Falta de sponsor';
  if (initiative.requiresExternalCapability || /tecnic|integraci|sistema/i.test(initiative.mainBlocker)) return 'Bloqueo tecnico';
  if (initiative.partialSignal || initiative.currentStep !== 'Step 4' || initiative.status === 'esperando_revision') return 'Evidencia insuficiente';
  if (/reto|enfoque|defini/i.test(initiative.mainBlocker)) return 'Reto mal definido';
  return 'Otra causa';
}

function recommendationOptions(): Array<{ value: PortfolioDecisionOutcome; label: string }> {
  return [
    { value: 'transferir_a_ti', label: 'Escalar a TI / producto / data' },
    { value: 'transferir_al_area_afectada', label: 'Transferir al area duena' },
    { value: 'iterar_desde_otro_angulo', label: 'Seguir experimentando' },
    { value: 'escalar_piloto', label: 'Abrir piloto formal' },
    { value: 'pasar_a_segunda_fase', label: 'Buscar inversion para implementacion' },
    { value: 'evaluar_innovacion_abierta', label: 'Derivar a innovacion abierta' },
    { value: 'cerrar_con_aprendizaje', label: 'Cerrar con aprendizaje' },
  ];
}

export function PortfolioLeadReportsDecisionsExperience({ basePath }: { basePath: '/portfolio/decisiones' | '/portfolio/reportes' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { strategicFronts, challenges, initiatives, portfolioDecisions, executiveOutputs, createExecutiveOutput } = usePortfolioLead();

  const selectedInitiativeId = searchParams.get('initiativeId') ?? '';
  const selectedInitiative = initiatives.find(item => item.id === selectedInitiativeId) ?? null;

  const decisionItems = useMemo(() => {
    return portfolioDecisions
      .map(item => {
        const initiative = initiatives.find(entry => entry.id === item.initiativeId);
        const challenge = challenges.find(entry => entry.id === item.challengeId);
        const front = strategicFronts.find(entry => entry.id === challenge?.strategicFrontId);
        const output = executiveOutputs.find(entry => entry.initiativeId === item.initiativeId) ?? null;

        if (!initiative || !challenge || !front) return null;

        const visibleDays = estimateVisibleDays(initiative.lastActivity);
        const prototype = initiative.deliverables.find(entry => entry.type === 'Link');
        const videoPitch = initiative.deliverables.find(entry => entry.type === 'Video');
        const evidencePieces = initiative.deliverables.slice(0, 3).map(entry => entry.title);
        const ownerPending = challenge.challengeOwnerStatus !== 'confirmado';
        const sponsorPending = challenge.sponsorStatus !== 'confirmado';
        const closed = initiative.currentStep === 'Step 4' || initiative.status === 'lista_para_decision' || initiative.status === 'cerrada';

        return {
          item,
          initiative,
          challenge,
          front,
          output,
          visibleDays,
          prototype,
          videoPitch,
          evidencePieces,
          ownerPending,
          sponsorPending,
          closed,
          noCloseReason: closed ? 'Cierre visible' : noCloseCause(initiative, sponsorPending, ownerPending),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0;
        if (a.closed !== b.closed) return a.closed ? 1 : -1;
        return b.visibleDays - a.visibleDays;
      });
  }, [challenges, executiveOutputs, initiatives, portfolioDecisions, strategicFronts]);

  const frontSummaries = useMemo(() => {
    return strategicFronts.map(front => {
      const relatedChallenges = challenges.filter(item => item.strategicFrontId === front.id);
      const relatedInitiatives = initiatives.filter(item => item.strategicFrontId === front.id);
      const step4 = relatedInitiatives.filter(item => item.currentStep === 'Step 4').length;
      const blocked = relatedInitiatives.filter(item => item.status === 'bloqueada').length;
      const avgVisibleDays = relatedInitiatives.length > 0
        ? Math.round(relatedInitiatives.reduce((total, item) => total + estimateVisibleDays(item.lastActivity), 0) / relatedInitiatives.length)
        : 0;
      const mainBlockers = Array.from(new Set(relatedInitiatives.map(item => item.mainBlocker).filter(Boolean))).slice(0, 2);
      const learnings = Array.from(new Set(relatedInitiatives.map(item => item.signalSummary).filter(Boolean))).slice(0, 2);

      return {
        id: front.id,
        name: front.name,
        initiatives: relatedInitiatives.length,
        step4,
        blocked,
        avgVisibleDays,
        coverage: relatedChallenges.length > 0
          ? coverageLabel(relatedChallenges.some(item => item.coverageStatus === 'cobertura_suficiente')
            ? 'cobertura_suficiente'
            : relatedChallenges.some(item => item.coverageStatus === 'cobertura_parcial')
              ? 'cobertura_parcial'
              : relatedChallenges.some(item => item.coverageStatus === 'reformular')
                ? 'reformular'
                : 'sin_cobertura')
          : 'Sin cobertura',
        blockers: mainBlockers.length > 0 ? mainBlockers.join(' · ') : 'Sin bloqueo principal visible',
        learnings: learnings.length > 0 ? learnings.join(' · ') : 'Todavia no hay aprendizaje consolidado visible',
      };
    });
  }, [challenges, initiatives, strategicFronts]);

  const challengeSummaries = useMemo(() => {
    return challenges.map(challenge => {
      const front = strategicFronts.find(item => item.id === challenge.strategicFrontId);
      const relatedInitiatives = initiatives.filter(item => item.challengeId === challenge.id);
      const step4 = relatedInitiatives.filter(item => item.currentStep === 'Step 4').length;
      const blocked = relatedInitiatives.filter(item => item.status === 'bloqueada').length;
      const avgVisibleDays = relatedInitiatives.length > 0
        ? Math.round(relatedInitiatives.reduce((total, item) => total + estimateVisibleDays(item.lastActivity), 0) / relatedInitiatives.length)
        : 0;
      const learnings = Array.from(new Set(relatedInitiatives.map(item => item.signalSummary).filter(Boolean))).slice(0, 2);
      const blocker = relatedInitiatives.find(item => item.mainBlocker)?.mainBlocker ?? 'Sin bloqueo principal visible';

      return {
        id: challenge.id,
        name: challenge.name,
        frontName: front?.name ?? 'Sin frente',
        initiatives: relatedInitiatives.length,
        step4,
        blocked,
        avgVisibleDays,
        coverage: coverageLabel(challenge.coverageStatus),
        blocker,
        learnings: learnings.length > 0 ? learnings.join(' · ') : 'Todavia no hay aprendizaje consolidado visible',
      };
    });
  }, [challenges, initiatives, strategicFronts]);

  const summary = {
    initiatives: initiatives.length,
    completed: initiatives.filter(item => item.currentStep === 'Step 4' || item.status === 'cerrada' || item.status === 'lista_para_decision').length,
    blocked: initiatives.filter(item => item.status === 'bloqueada').length,
    nonClosed: initiatives.filter(item => item.currentStep !== 'Step 4' && item.status !== 'cerrada' && item.status !== 'lista_para_decision').length,
    outputsReady: executiveOutputs.length,
  };

  const updateQuery = (initiativeId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!initiativeId) next.delete('initiativeId');
    else next.set('initiativeId', initiativeId);
    navigate(`${basePath}?${next.toString()}`);
  };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Reportes y decisiones' }]} />

      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#eef3ea_0%,#ffffff_58%,#fff4d8_100%)] p-6 md:p-8">
        <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>REPORTES Y DECISIONES</p>
        <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          Cierre ejecutivo del portafolio con evidencia, lectura y siguiente paso
        </h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-600">
          Esta experiencia une lo que paso con las iniciativas y la decision que corresponde ahora. No mezcla evidencia con juicio: primero muestra senales y cierre, despues explicita recomendacion, decision sugerida y siguiente paso organizacional.
        </p>

        <PortfolioLeadContextStrip
          items={[
            { label: 'Frente padre visible', value: decisionItems[0]?.front.name ?? 'Portafolio completo' },
            { label: 'Reto seleccionado', value: decisionItems[0]?.challenge.name ?? 'Sin reto en foco' },
            { label: 'Estado de activacion', value: decisionItems[0] ? coverageLabel(decisionItems[0].challenge.coverageStatus) : 'Sin cobertura visible todavia' },
            { label: 'Iniciativas asociadas', value: `${summary.initiatives}` },
            { label: 'Siguiente accion recomendada', value: decisionItems.length > 0 ? 'Revisar la cola de decision y traducir el siguiente paso organizacional.' : 'Aun no hay decisiones abiertas. Conviene seguir retos e iniciativas hasta que aparezca un caso maduro.' },
          ]}
        />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-5">
        <SummaryCard label="Iniciativas lanzadas" value={`${summary.initiatives}`} hint="Casos visibles en esta capa" />
        <SummaryCard label="Llegaron a Step 4" value={`${summary.completed}`} hint="Cierre visible o lista para decision" />
        <SummaryCard label="Bloqueadas" value={`${summary.blocked}`} hint="Requieren destrabe o cambio de destino" />
        <SummaryCard label="No terminadas" value={`${summary.nonClosed}`} hint="Se muestran con causa visible" />
        <SummaryCard label="Salidas ejecutivas" value={`${summary.outputsReady}`} hint="Borradores ya preparados" />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Compass size={17} className="text-slate-700" />
          <h2 className="text-xl text-slate-950" style={{ fontWeight: 700 }}>Resumen consolidado por frente y por reto</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Este bloque resume que paso en el portafolio: cuantas iniciativas se lanzaron, cuales llegaron a cierre, donde se concentraron los bloqueos y que cobertura real se logro.
        </p>

        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>POR FRENTE</p>
            <div className="mt-3 space-y-3">
              {frontSummaries.map(item => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{item.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.learnings}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{item.coverage}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <MiniInfo label="Iniciativas lanzadas" value={`${item.initiatives}`} />
                    <MiniInfo label="Llegaron a Step 4" value={`${item.step4}`} />
                    <MiniInfo label="Bloqueadas" value={`${item.blocked}`} />
                    <MiniInfo label="Tiempo promedio visible" value={item.initiatives > 0 ? `${item.avgVisibleDays} dias` : 'Sin dato visible'} />
                    <MiniInfo label="Bloqueos principales" value={item.blockers} />
                    <MiniInfo label="Cobertura lograda" value={item.coverage} />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>POR RETO</p>
            <div className="mt-3 space-y-3">
              {challengeSummaries.map(item => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{item.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.frontName}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{item.coverage}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <MiniInfo label="Iniciativas lanzadas" value={`${item.initiatives}`} />
                    <MiniInfo label="Llegaron a Step 4" value={`${item.step4}`} />
                    <MiniInfo label="Bloqueadas" value={`${item.blocked}`} />
                    <MiniInfo label="Tiempo promedio visible" value={item.initiatives > 0 ? `${item.avgVisibleDays} dias` : 'Sin dato visible'} />
                    <MiniInfo label="Bloqueo principal" value={item.blocker} />
                    <MiniInfo label="Aprendizajes acumulados" value={item.learnings} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <FileSearch size={17} className="text-slate-700" />
          <h2 className="text-xl text-slate-950" style={{ fontWeight: 700 }}>Cola de decision</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Cada item deja visible que evidencia existe, que lectura se esta haciendo y que decision conviene discutir ahora. Las iniciativas no terminadas tambien aparecen con causa de no cierre.
        </p>

        <div className="mt-5 space-y-4">
          {decisionItems.length === 0 ? (
            <PortfolioLeadEmptyState
              title="Todavia no hay casos en cola de decision"
              description="Aun no hay una iniciativa con evidencia suficiente o bloqueo visible para traerla a cierre ejecutivo. El siguiente paso es revisar retos activos e iniciativas maduras."
              primaryAction={{ label: 'Seguir iniciativas', onClick: () => navigate('/portfolio/iniciativas') }}
              secondaryAction={{ label: 'Revisar retos', onClick: () => navigate('/portfolio/retos') }}
            />
          ) : decisionItems.map(entry => (
            <article key={entry.item.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{entry.front.name}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{entry.challenge.name}</span>
                    <span className={`rounded-full px-3 py-1 text-xs ${entry.closed ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'}`}>
                      {entry.closed ? 'Cierre visible' : `No terminada · ${entry.noCloseReason}`}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{entry.initiative.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {challengeTypeLabel(entry.challenge.challengeType)} · {initiativeStatusLabel(entry.initiative.status)} · {entry.initiative.currentStep}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => updateQuery(entry.initiative.id)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    style={{ fontWeight: 600 }}
                  >
                    Ver detalle breve
                  </button>
                  <button
                    onClick={() => {
                      const output = entry.output ?? createExecutiveOutput(entry.initiative.id, entry.item.recommendation);
                      if (!output) return;
                      navigate(`/portfolio/salida-ejecutiva?outputId=${encodeURIComponent(output.id)}`);
                    }}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                    style={{ fontWeight: 600 }}
                  >
                    {entry.output ? 'Ver salida ejecutiva' : 'Preparar salida ejecutiva'}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-5">
                <DecisionBlock
                  icon={CheckCircle2}
                  title="Evidencia"
                  tone="emerald"
                  items={[
                    `Avance: ${entry.initiative.currentStep}`,
                    `Evidencia clave: ${entry.evidencePieces.join(' · ') || 'Sin entregables visibles'}`,
                    `Metrica o senal lograda: ${entry.initiative.signalSummary}`,
                    `Roadmap a 3 meses: ${entry.output?.nextStepSummary ?? entry.initiative.nextActionRecommended}`,
                    `Prototipo: ${entry.prototype?.title ?? 'No visible'}`,
                    `Video pitch: ${entry.videoPitch?.title ?? 'No visible'}`,
                  ]}
                />
                <DecisionBlock
                  icon={Lightbulb}
                  title="Inferencia"
                  tone="sky"
                  items={[
                    entry.item.successReading,
                    `Lectura de cierre: ${entry.closed ? 'La iniciativa ya permite leer un destino ejecutivo.' : `Aun no cierra y la causa principal visible es ${entry.noCloseReason.toLowerCase()}.`}`,
                    `Bloqueo o motivo: ${entry.item.reviewReason || entry.initiative.mainBlocker}`,
                  ]}
                />
                <DecisionBlock
                  icon={ArrowRight}
                  title="Recomendacion"
                  tone="violet"
                  items={[
                    entry.item.summary,
                    `Recomendacion visible: ${portfolioDecisionLabel(entry.item.recommendation)}`,
                    `Esta lectura no es un hecho. Resume la mejor opcion visible con la evidencia actual.`,
                  ]}
                />
                <DecisionBlock
                  icon={ShieldAlert}
                  title="Decision"
                  tone="amber"
                  items={[
                    `Decision sugerida: ${recommendationOptions().find(option => option.value === entry.item.recommendation)?.label ?? portfolioDecisionLabel(entry.item.recommendation)}`,
                    `Estado ejecutivo: ${entry.output ? executiveOutputStatusLabel(entry.output.status) : 'Aun no convertida en salida ejecutiva'}`,
                    `Cobertura del reto: ${coverageLabel(entry.challenge.coverageStatus)}`,
                  ]}
                />
                <DecisionBlock
                  icon={Compass}
                  title="Siguiente paso"
                  tone="slate"
                  items={[
                    entry.output?.nextStepSummary ?? entry.initiative.nextActionRecommended,
                    `Owner sugerido: ${entry.output?.nextStepOwner ?? entry.initiative.teamOwner}`,
                    `Horizonte visible: ${entry.output?.nextStepHorizon ?? 'Definir tras decision'}`,
                  ]}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {selectedInitiative ? (
        <InitiativeExecutiveDetailDrawer
          initiative={selectedInitiative}
          frontName={strategicFronts.find(item => item.id === selectedInitiative.strategicFrontId)?.name ?? 'Sin frente'}
          challengeName={challenges.find(item => item.id === selectedInitiative.challengeId)?.name ?? 'Sin reto'}
          recommendation={portfolioDecisions.find(item => item.initiativeId === selectedInitiative.id)?.recommendation ?? 'iterar_desde_otro_angulo'}
          executiveOutputId={executiveOutputs.find(item => item.initiativeId === selectedInitiative.id)?.id ?? null}
          onOpenExecutiveOutput={() => {
            const output = executiveOutputs.find(item => item.initiativeId === selectedInitiative.id)
              ?? createExecutiveOutput(
                selectedInitiative.id,
                portfolioDecisions.find(item => item.initiativeId === selectedInitiative.id)?.recommendation ?? 'iterar_desde_otro_angulo',
              );
            if (!output) return;
            navigate(`/portfolio/salida-ejecutiva?outputId=${encodeURIComponent(output.id)}`);
          }}
          onClose={() => updateQuery(null)}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-3xl text-slate-950" style={{ fontWeight: 700 }}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function DecisionBlock({
  icon: Icon,
  title,
  tone,
  items,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  tone: 'emerald' | 'sky' | 'violet' | 'amber' | 'slate';
  items: string[];
}) {
  const classes = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-white text-slate-900',
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
