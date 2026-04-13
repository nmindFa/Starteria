import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FolderKanban,
  ShieldCheck,
  Target,
  TimerReset,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { PortfolioLeadBreadcrumbs, PortfolioLeadEmptyState } from '../components/portfolio/PortfolioLeadPageElements';

type ExecutiveMetric = {
  label: string;
  value: string;
  hint: string;
  tone: 'slate' | 'amber' | 'emerald' | 'rose' | 'violet' | 'sky';
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type FrontPriorityCard = {
  id: string;
  name: string;
  status: string;
  rawStatus: string;
  sponsor: string;
  mainKpi: string;
  targetOrHorizon: string;
  blockingIssue: string;
  checklist: string[];
  actionLabel: string;
  actionPath: string;
  score: number;
};

type OperationalAlert = {
  id: string;
  tone: 'amber' | 'rose' | 'violet' | 'sky';
  title: string;
  description: string;
  actionLabel: string;
  path: string;
};

function frontStatusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Activo',
    paused: 'Pausado',
    closed: 'Cerrado',
    draft: 'Borrador',
  };
  return labels[status] ?? status;
}

function frontStatusClasses(status: string) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'paused':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'closed':
      return 'border-slate-300 bg-slate-200 text-slate-700';
    default:
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }
}

function metricToneClasses(tone: ExecutiveMetric['tone']) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  return tones[tone];
}

function alertToneClasses(tone: OperationalAlert['tone']) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  return tones[tone];
}

export function PortfolioLeadHomePage() {
  const navigate = useNavigate();
  const { strategicFronts, challenges, initiatives } = usePortfolioLead();

  const pendingDecisions = useMemo(
    () => initiatives.filter(item => item.readyForDecision || item.status === 'bloqueada').length,
    [initiatives],
  );

  const operationalAlerts = useMemo<OperationalAlert[]>(() => {
    const alerts: OperationalAlert[] = [];

    strategicFronts.forEach(front => {
      const frontChallenges = challenges.filter(challenge => challenge.strategicFrontId === front.id);
      const inactiveChallenges = frontChallenges.filter(challenge => !challenge.visibleToParticipants);
      if (inactiveChallenges.length > 0) {
        alerts.push({
          id: `front-inactive-${front.id}`,
          tone: 'amber',
          title: `${front.name} tiene retos definidos pero todavía no activados`,
          description: `${inactiveChallenges.length} reto(s) siguen solo en control interno y frenan la llegada de iniciativas al frente.`,
          actionLabel: 'Activar retos del frente',
          path: `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`,
        });
      }
    });

    challenges.forEach(challenge => {
      const relatedInitiatives = initiatives.filter(initiative => initiative.challengeId === challenge.id);
      if (challenge.visibleToParticipants && relatedInitiatives.length === 0) {
        alerts.push({
          id: `challenge-empty-${challenge.id}`,
          tone: 'sky',
          title: `${challenge.name} ya está activo pero aún no recibe iniciativas`,
          description: 'El reto ya está publicado, pero todavía no vuelve como trabajo visible para seguimiento.',
          actionLabel: challenge.activationMode === 'convocatoria_abierta' ? 'Revisar convocatoria' : challenge.activationMode === 'squad_asignado' ? 'Revisar squad' : 'Revisar reto',
          path: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
        });
      }

      if (challenge.challengeOwnerStatus !== 'confirmado') {
        alerts.push({
          id: `owner-${challenge.id}`,
          tone: 'amber',
          title: `${challenge.name} todavía no tiene challenge owner confirmado`,
          description: `Estado actual: ${challenge.challengeOwnerStatus}. Sin owner confirmado, el reto pierde tracción operativa.`,
          actionLabel: 'Confirmar owner',
          path: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
        });
      }

      if (challenge.sponsorStatus !== 'confirmado') {
        alerts.push({
          id: `sponsor-${challenge.id}`,
          tone: 'rose',
          title: `${challenge.name} todavía no tiene sponsor confirmado`,
          description: `Estado actual: ${challenge.sponsorStatus}. Conviene destrabar sponsor antes de escalar o pedir recursos.`,
          actionLabel: 'Revisar sponsor',
          path: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
        });
      }
    });

    initiatives
      .filter(initiative => initiative.readyForDecision || initiative.status === 'bloqueada')
      .forEach(initiative => {
        const challenge = challenges.find(item => item.id === initiative.challengeId);
        const front = strategicFronts.find(item => item.id === initiative.strategicFrontId);
        alerts.push({
          id: `initiative-${initiative.id}`,
          tone: initiative.status === 'bloqueada' ? 'rose' : 'violet',
          title: `${initiative.name} ${initiative.status === 'bloqueada' ? 'sigue bloqueada' : 'ya requiere decisión'}`,
          description: `${front?.name ?? 'Sin frente'} · ${challenge?.name ?? 'Sin reto'}. ${initiative.nextActionRecommended}`,
          actionLabel: initiative.status === 'bloqueada' ? 'Ir a seguimiento' : 'Revisar decisiones',
          path: initiative.status === 'bloqueada'
            ? `/portfolio/iniciativas?challengeId=${encodeURIComponent(initiative.challengeId)}&initiativeId=${encodeURIComponent(initiative.id)}`
            : `/portfolio/decisiones?challengeId=${encodeURIComponent(initiative.challengeId)}&initiativeId=${encodeURIComponent(initiative.id)}`,
        });
      });

    return alerts.slice(0, 8);
  }, [challenges, initiatives, strategicFronts]);

  const executiveMetrics = useMemo<ExecutiveMetric[]>(() => {
    const activeFronts = strategicFronts.filter(front => front.status === 'active').length;
    const activeChallenges = challenges.filter(challenge => challenge.visibleToParticipants).length;
    const activeInitiatives = initiatives.filter(initiative => initiative.status !== 'cerrada').length;
    const blockedInitiatives = initiatives.filter(initiative => initiative.status === 'bloqueada').length;

    return [
      {
        label: 'Frentes activos',
        value: `${activeFronts}`,
        hint: activeFronts === 0 ? 'Todavía no hay prioridad en movimiento.' : 'Prioridades con seguimiento ejecutivo activo.',
        tone: 'emerald',
        icon: Target,
      },
      {
        label: 'Retos activos',
        value: `${activeChallenges}`,
        hint: activeChallenges === 0 ? 'Aún no hay retos publicados.' : 'Retos ya visibles para activar trabajo.',
        tone: 'slate',
        icon: TimerReset,
      },
      {
        label: 'Iniciativas activas',
        value: `${activeInitiatives}`,
        hint: activeInitiatives === 0 ? 'Todavía no hay iniciativas bajo seguimiento.' : 'Trabajo visible en el portafolio.',
        tone: 'sky',
        icon: FolderKanban,
      },
      {
        label: 'Iniciativas bloqueadas',
        value: `${blockedInitiatives}`,
        hint: blockedInitiatives === 0 ? 'No hay bloqueos visibles ahora.' : 'Casos que necesitan destrabe o redefinición.',
        tone: 'rose',
        icon: AlertTriangle,
      },
      {
        label: 'Decisiones pendientes',
        value: `${pendingDecisions}`,
        hint: pendingDecisions === 0 ? 'La cola está despejada por ahora.' : 'Casos que ya deben entrar a decisión.',
        tone: 'violet',
        icon: ShieldCheck,
      },
    ];
  }, [challenges, initiatives, pendingDecisions, strategicFronts]);

  const frontPriorityCards = useMemo<FrontPriorityCard[]>(() => {
    return strategicFronts
      .map(front => {
        const frontChallenges = challenges.filter(challenge => challenge.strategicFrontId === front.id);
        const frontInitiatives = initiatives.filter(initiative => initiative.strategicFrontId === front.id);
        const inactiveChallenges = frontChallenges.filter(challenge => !challenge.visibleToParticipants);
        const blockedInitiatives = frontInitiatives.filter(initiative => initiative.status === 'bloqueada');
        const decisionReady = frontInitiatives.filter(initiative => initiative.readyForDecision || initiative.status === 'bloqueada');
        const challengeWithoutInitiatives = frontChallenges.find(challenge => challenge.visibleToParticipants && challenge.initiativeCount === 0);
        const unconfirmedOwner = frontChallenges.find(challenge => challenge.challengeOwnerStatus !== 'confirmado');
        const unconfirmedSponsor = frontChallenges.find(challenge => challenge.sponsorStatus !== 'confirmado');

        let blockingIssue = 'Sin bloqueo principal visible';
        let actionLabel = 'Ver frentes';
        let actionPath = `/portfolio/frentes-estrategicos`;
        const checklist: string[] = [];

        if (inactiveChallenges.length > 0) {
          blockingIssue = `${inactiveChallenges.length} reto(s) todavía no activados`;
          actionLabel = 'Activar retos';
          actionPath = `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`;
          checklist.push('Activar retos pendientes');
        }

        if (challengeWithoutInitiatives) {
          blockingIssue = `El reto ${challengeWithoutInitiatives.name} sigue sin iniciativas visibles`;
          actionLabel = 'Revisar reto activo';
          actionPath = `/portfolio/retos?challengeId=${encodeURIComponent(challengeWithoutInitiatives.id)}`;
          checklist.push('Confirmar convocatoria o squad');
        }

        if (unconfirmedOwner) {
          blockingIssue = `Falta challenge owner confirmado en ${unconfirmedOwner.name}`;
          actionLabel = 'Confirmar owner';
          actionPath = `/portfolio/retos?challengeId=${encodeURIComponent(unconfirmedOwner.id)}`;
          checklist.push('Cerrar confirmación de owner');
        }

        if (unconfirmedSponsor) {
          blockingIssue = `Falta sponsor confirmado en ${unconfirmedSponsor.name}`;
          actionLabel = 'Revisar sponsor';
          actionPath = `/portfolio/retos?challengeId=${encodeURIComponent(unconfirmedSponsor.id)}`;
          checklist.push('Cerrar confirmación de sponsor');
        }

        if (blockedInitiatives.length > 0) {
          blockingIssue = `${blockedInitiatives.length} iniciativa(s) bloqueada(s)`;
          actionLabel = 'Destrabar iniciativas';
          actionPath = `/portfolio/iniciativas?frontId=${encodeURIComponent(front.id)}`;
          checklist.push('Revisar bloqueos críticos');
        }

        if (decisionReady.length > 0) {
          blockingIssue = `${decisionReady.length} caso(s) piden decisión`;
          actionLabel = 'Revisar decisiones';
          actionPath = `/portfolio/decisiones`;
          checklist.push('Llevar casos maduros a decisión');
        }

        if (frontChallenges.length === 0) {
          blockingIssue = 'Todavía no baja a retos concretos';
          actionLabel = 'Crear primer reto';
          actionPath = `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`;
          checklist.push('Definir primer reto');
        }

        if (checklist.length === 0) {
          checklist.push('Mantener seguimiento');
          checklist.push('Revisar cobertura de retos');
        } else if (frontChallenges.length > 0) {
          checklist.push(`${frontChallenges.length} reto(s) asociados`);
          checklist.push(`${frontInitiatives.length} iniciativa(s) asociadas`);
        }

        const score = inactiveChallenges.length * 4 + blockedInitiatives.length * 5 + decisionReady.length * 6 + (frontChallenges.length === 0 ? 3 : 0);

        return {
          id: front.id,
          name: front.name,
          status: frontStatusLabel(front.status),
          rawStatus: front.status,
          sponsor: front.sponsor,
          mainKpi: front.mainKpi,
          targetOrHorizon: `${front.target} · ${front.horizon}`,
          blockingIssue,
          checklist: checklist.slice(0, 3),
          actionLabel,
          actionPath,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }, [challenges, initiatives, strategicFronts]);

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Inicio' }]} />

      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff6df_0%,#ffffff_62%,#edf4eb_100%)] p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>INICIO PORTFOLIO LEAD</p>
            <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 700 }}>
              Esta vista sirve para priorizar urgencias del portafolio y decidir por dónde entrar.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Aquí no haces seguimiento profundo de cada iniciativa ni cierras la decisión final. Eso vive en Retos, Iniciativas y Reportes y decisiones.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>HOY</p>
            <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 700 }}>
              {operationalAlerts.length} alerta(s) y {pendingDecisions} decisión(es) pendiente(s)
            </p>
          </div>
        </div>

        {pendingDecisions > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
            <div>
              <p className="text-sm text-violet-900" style={{ fontWeight: 700 }}>{pendingDecisions} decisiones pendientes</p>
              <p className="mt-1 text-sm text-violet-800">La Home solo te orienta. El cierre ejecutivo y la definición final están en Reportes y decisiones.</p>
            </div>
            <button
              onClick={() => navigate('/portfolio/decisiones')}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
              style={{ fontWeight: 600 }}
            >
              Revisar ahora
            </button>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>RESUMEN EJECUTIVO</p>
            <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Estado general del portafolio</h2>
            <p className="mt-2 text-sm text-slate-600">
              Este bloque resume qué está activo, qué está frenado y si ya conviene pasar a cierre ejecutivo.
            </p>
          </div>
          <button
            onClick={() => navigate('/portfolio/decisiones')}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            style={{ fontWeight: 600 }}
          >
            Ir a reportes y decisiones
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {executiveMetrics.map(metric => (
            <ExecutiveMetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>ALERTAS OPERATIVAS</p>
        <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Qué requiere atención ahora</h2>
        <p className="mt-2 text-sm text-slate-600">
          Esta es la primera capa de urgencia. Cada alerta te dice qué está pasando y cuál es la acción más útil para destrabarlo.
        </p>

        <div className="mt-5 space-y-3">
          {operationalAlerts.length === 0 ? (
            <PortfolioLeadEmptyState
              title="No hay alertas operativas críticas ahora"
              description="El portafolio no muestra retos atorados, actores pendientes ni iniciativas frenadas en este momento. El siguiente paso más útil es revisar frentes y confirmar si conviene abrir nuevo trabajo."
              primaryAction={{ label: strategicFronts.length === 0 ? 'Crear primer frente estratégico' : 'Ver frentes estratégicos', onClick: () => navigate('/portfolio/frentes-estrategicos') }}
            />
          ) : (
            operationalAlerts.map(alert => (
              <article key={alert.id} className={`rounded-2xl border p-4 ${alertToneClasses(alert.tone)}`}>
                <p className="text-sm" style={{ fontWeight: 700 }}>{alert.title}</p>
                <p className="mt-2 text-sm opacity-90">{alert.description}</p>
                <button
                  onClick={() => navigate(alert.path)}
                  className="mt-4 inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                  style={{ fontWeight: 700 }}
                >
                  {alert.actionLabel}
                  <ArrowRight size={14} />
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>FRENTES PRIORIZADOS</p>
            <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Seguimiento de prioridades estratégicas</h2>
            <p className="mt-2 text-sm text-slate-600">
              Esta es la segunda capa del dashboard. Cada frente muestra su bloqueo principal, pendientes concretos y la acción que más conviene ahora.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {frontPriorityCards.length === 0 ? (
            <PortfolioLeadEmptyState
              title="Todavía no hay frentes para priorizar"
              description="Empieza creando el primer frente estratégico. Sin esa prioridad base, la Home no puede ordenar urgencias ni conducir a decisión."
              primaryAction={{ label: 'Crear primer frente estratégico', onClick: () => navigate('/portfolio/frentes-estrategicos') }}
            />
          ) : (
            frontPriorityCards.map(front => (
              <article key={front.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs ${frontStatusClasses(front.rawStatus)}`}>
                        {front.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{front.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">Sponsor: {front.sponsor}</p>
                  </div>

                  <button
                    onClick={() => navigate(front.actionPath)}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
                    style={{ fontWeight: 600 }}
                  >
                    {front.actionLabel}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <InfoStat label="KPI principal" value={front.mainKpi} />
                  <InfoStat label="Meta u horizonte" value={front.targetOrHorizon} />
                  <InfoStat label="Bloqueo principal" value={front.blockingIssue} />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Pendientes clave</p>
                  <div className="mt-3 space-y-2">
                    {front.checklist.map(item => (
                      <p key={item} className="text-sm text-slate-700">- {item}</p>
                    ))}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ExecutiveMetricCard({ metric }: { metric: ExecutiveMetric }) {
  const Icon = metric.icon;

  return (
    <div className={`rounded-2xl border p-5 ${metricToneClasses(metric.tone)}`}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-black/5">
        <Icon size={18} />
      </div>
      <p className="text-xs opacity-70">{metric.label}</p>
      <p className="mt-1 text-3xl" style={{ fontWeight: 700 }}>{metric.value}</p>
      <p className="mt-2 text-xs opacity-80">{metric.hint}</p>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}
