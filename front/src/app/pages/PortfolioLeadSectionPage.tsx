import React, { useState } from 'react';
import { ArrowRight, BellRing, Building2, ShieldAlert, UserCog, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { activationLabel } from '../portfolio/portfolioLeadCopy';
import { PortfolioLeadReportsDecisionsExperience } from '../components/portfolio/PortfolioLeadReportsDecisionsExperience';
import { PortfolioLeadBreadcrumbs, PortfolioLeadContextStrip, PortfolioLeadEmptyState } from '../components/portfolio/PortfolioLeadPageElements';

const SECTION_CONTENT: Record<string, { title: string; summary: string; nextAction: string }> = {
  '/portfolio/reportes': {
    title: 'Reportes',
    summary: 'Esta vista alojara reportes ejecutivos del portafolio con foco en avance, riesgos y decisiones.',
    nextAction: 'Acordar primero que reporte es para seguimiento y cual para gobernanza.',
  },
};

type ActorTab = 'sponsors' | 'owners' | 'mentores';
type StakeholderStatus = 'definido' | 'notificado' | 'confirmado';

function stakeholderLabel(status: StakeholderStatus) {
  const labels = {
    definido: 'Definido',
    notificado: 'Notificado',
    confirmado: 'Confirmado',
  };
  return labels[status];
}

function stakeholderClasses(status: StakeholderStatus) {
  switch (status) {
    case 'confirmado':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'notificado':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function PortfolioLeadSectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { strategicFronts, challenges, initiatives } = usePortfolioLead();
  const [activeTab, setActiveTab] = useState<ActorTab>('sponsors');

  const sponsors = strategicFronts.map(front => ({
    id: front.id,
    name: front.sponsor,
    role: 'Sponsor de frente',
    frontName: front.name,
    status: challenges
      .filter(challenge => challenge.strategicFrontId === front.id)
      .every(challenge => challenge.sponsorStatus === 'confirmado')
      ? 'confirmado'
      : challenges.some(challenge => challenge.strategicFrontId === front.id && challenge.sponsorStatus === 'notificado')
        ? 'notificado'
        : 'definido',
    milestones: challenges.filter(challenge => challenge.strategicFrontId === front.id).length > 0
      ? ['Activacion de retos', 'Decisiones del frente']
      : ['Definicion estrategica del frente'],
    context: `${front.mainKpi} · ${front.horizon}`,
  }));

  const challengeOwners = challenges.map(challenge => {
    const front = strategicFronts.find(item => item.id === challenge.strategicFrontId);
    const relatedInitiatives = initiatives.filter(item => item.challengeId === challenge.id);

    return {
      id: challenge.id,
      name: challenge.challengeOwner,
      challengeName: challenge.name,
      frontName: front?.name ?? 'Sin frente',
      status: challenge.challengeOwnerStatus,
      modality: activationLabel(challenge.activationMode),
      teams: relatedInitiatives.length > 0
        ? relatedInitiatives.map(item => item.teamOwner).join(', ')
        : 'Sin equipos visibles todavia',
      pending: challenge.challengeOwnerStatus !== 'confirmado'
        ? 'Confirmar ownership del reto'
        : challenge.visibleToParticipants
          ? 'Sin pendiente critico'
          : 'Preparar publicacion del reto',
    };
  });

  const mentors = (() => {
    const grouped = new Map<string, {
      id: string;
      name: string;
      specialty: string;
      initiatives: string[];
      currentSteps: string[];
      pendingSessions: number;
      blockedInitiatives: number;
    }>();

    initiatives.forEach(initiative => {
      if (!initiative.mentor.trim()) return;

      const current = grouped.get(initiative.mentor) ?? {
        id: initiative.mentor,
        name: initiative.mentor,
        specialty: initiative.contributionType === 'descubrir'
          ? 'Descubrimiento'
          : initiative.contributionType === 'validar'
            ? 'Validacion'
            : 'Experimentacion y escalamiento',
        initiatives: [],
        currentSteps: [],
        pendingSessions: 0,
        blockedInitiatives: 0,
      };

      current.initiatives.push(initiative.name);
      current.currentSteps.push(initiative.currentStep);
      if (initiative.status === 'esperando_revision') current.pendingSessions += 1;
      if (initiative.status === 'bloqueada') current.blockedInitiatives += 1;
      grouped.set(initiative.mentor, current);
    });

    return Array.from(grouped.values());
  })();

  const pendingTray: Array<{ id: string; tone: 'amber' | 'rose' | 'sky'; title: string; description: string }> = [];

  sponsors
    .filter(item => item.status !== 'confirmado')
    .forEach(item => pendingTray.push({
      id: `sponsor-${item.id}`,
      tone: 'amber',
      title: `Sponsor pendiente en ${item.frontName}`,
      description: `${item.name} sigue en estado ${stakeholderLabel(item.status)}. Conviene cerrar confirmacion antes de escalar decisiones.`,
    }));

  challengeOwners
    .filter(item => item.status !== 'confirmado')
    .forEach(item => pendingTray.push({
      id: `owner-${item.id}`,
      tone: 'rose',
      title: 'Reto sin challenge owner confirmado',
      description: `${item.challengeName} en ${item.frontName} sigue con owner en estado ${stakeholderLabel(item.status)}.`,
    }));

  mentors
    .filter(item => item.pendingSessions > 0 || item.blockedInitiatives > 0)
    .forEach(item => pendingTray.push({
      id: `mentor-${item.id}`,
      tone: 'sky',
      title: 'Mentor con iniciativas que requieren atencion',
      description: `${item.name} tiene ${item.pendingSessions} sesion(es) pendiente(s) y ${item.blockedInitiatives} iniciativa(s) bloqueada(s) con contexto mentor.`,
    }));

  if (location.pathname === '/portfolio/sponsors') {
    const sponsorPendingCount = sponsors.filter(item => item.status !== 'confirmado').length;
    const ownerPendingCount = challengeOwners.filter(item => item.status !== 'confirmado').length;
    const mentorPendingCount = mentors.filter(item => item.pendingSessions > 0 || item.blockedInitiatives > 0).length;
    const primaryAction = sponsorPendingCount + ownerPendingCount > 0
      ? { label: 'Revisar retos con pendientes', onClick: () => navigate('/portfolio/retos') }
      : mentorPendingCount > 0
        ? { label: 'Revisar iniciativas con mentor', onClick: () => navigate('/portfolio/iniciativas') }
        : { label: 'Volver a frentes', onClick: () => navigate('/portfolio/frentes-estrategicos') };

    return (
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Actores clave' }]} />

        <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff4d8_0%,#ffffff_58%,#eef3ea_100%)] p-6 md:p-8">
          <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>ACTORES CLAVE</p>
          <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
            Gestiona sponsors, challenge owners y mentores con contexto real
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            Esta vista no es un directorio estatico. Cada actor aparece vinculado a un frente, reto o iniciativa y deja visible que pendiente conviene destrabar.
          </p>

          <PortfolioLeadContextStrip
            items={[
              { label: 'Frente padre visible', value: sponsors[0]?.frontName ?? 'Sin frentes visibles' },
              { label: 'Reto seleccionado', value: challengeOwners[0]?.challengeName ?? 'Sin reto activo en foco' },
              { label: 'Estado de activacion', value: challengeOwners[0]?.modality ?? 'Sin activacion visible todavia' },
              { label: 'Iniciativas asociadas', value: `${initiatives.length}` },
              { label: 'Siguiente accion recomendada', value: pendingTray.length > 0 ? 'Resolver confirmaciones y asignaciones pendientes antes de escalar nuevos casos.' : 'Mantener visibles sponsor, owner y mentor por nivel de trabajo.' },
            ]}
          />
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>LECTURA DE JERARQUIA</p>
              <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Cada actor vive en un nivel distinto del portafolio</h2>
              <p className="mt-2 text-sm text-slate-600">
                Sponsor a nivel de frente, challenge owner a nivel de reto y mentor a nivel de iniciativa. Aqui se gestionan asignacion y contexto, no la logica metodologica del core.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TabButton active={activeTab === 'sponsors'} onClick={() => setActiveTab('sponsors')} label="Sponsors" />
              <TabButton active={activeTab === 'owners'} onClick={() => setActiveTab('owners')} label="Challenge Owners" />
              <TabButton active={activeTab === 'mentores'} onClick={() => setActiveTab('mentores')} label="Mentores" />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <SummaryCard icon={Building2} label="Sponsors" value={`${sponsors.length}`} hint="Asignados a frentes del portafolio" />
            <SummaryCard icon={UserCog} label="Challenge Owners" value={`${challengeOwners.length}`} hint="Ligados a retos concretos" />
            <SummaryCard icon={Users} label="Mentores" value={`${mentors.length}`} hint="Ligados a iniciativas activas" />
            <SummaryCard icon={BellRing} label="Pendientes" value={`${pendingTray.length}`} hint="Bandeja util para gestion inmediata" />
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            {activeTab === 'sponsors' ? (
              <div>
                <SectionHeader title="Sponsors" description="Se leen en el nivel del frente y muestran el contexto donde intervienen." />
                <div className="mt-5 space-y-4">
                  {sponsors.map(item => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs ${stakeholderClasses(item.status)}`}>{stakeholderLabel(item.status)}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{item.role}</span>
                          </div>
                          <p className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{item.name}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.frontName}</p>
                        </div>
                        <button
                          onClick={() => navigate('/portfolio/frentes-estrategicos')}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                          style={{ fontWeight: 600 }}
                        >
                          Ver frente
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <InfoCard label="Frente asignado" value={item.frontName} />
                        <InfoCard label="Hitos donde interviene" value={item.milestones.join(', ')} />
                        <InfoCard label="Contexto relacionado" value={item.context} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'owners' ? (
              <div>
                <SectionHeader title="Challenge Owners" description="Se leen en el nivel del reto y muestran ownership, modalidad y equipos involucrados." />
                <div className="mt-5 space-y-4">
                  {challengeOwners.map(item => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs ${stakeholderClasses(item.status)}`}>{stakeholderLabel(item.status)}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{item.modality}</span>
                          </div>
                          <p className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{item.name}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.challengeName} · {item.frontName}</p>
                        </div>
                        <button
                          onClick={() => navigate(`/portfolio/retos?challengeId=${encodeURIComponent(item.id)}`)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                          style={{ fontWeight: 600 }}
                        >
                          Ver reto
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <InfoCard label="Reto asignado" value={item.challengeName} />
                        <InfoCard label="Frente padre" value={item.frontName} />
                        <InfoCard label="Equipos involucrados" value={item.teams} />
                        <InfoCard label="Solicitud pendiente" value={item.pending} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'mentores' ? (
              <div>
                <SectionHeader title="Mentores" description="Se leen en el nivel de iniciativa y solo muestran asignacion, pasos actuales y bloqueos que piden contexto mentor." />
                <div className="mt-5 space-y-4">
                  {mentors.length === 0 ? (
                    <PortfolioLeadEmptyState
                      title="Todavia no hay mentores asignados en esta capa"
                      description="Cuando una iniciativa tenga mentor visible, aparecera aqui con sus pendientes y bloqueos relacionados. Mientras tanto conviene revisar iniciativas activas y confirmar si ya requieren mentor."
                      primaryAction={{ label: 'Revisar iniciativas', onClick: () => navigate('/portfolio/iniciativas') }}
                    />
                  ) : (
                    mentors.map(item => (
                      <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg text-slate-950" style={{ fontWeight: 700 }}>{item.name}</p>
                            <p className="mt-1 text-sm text-slate-600">{item.specialty}</p>
                          </div>
                          <button
                            onClick={() => navigate('/portfolio/iniciativas')}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                            style={{ fontWeight: 600 }}
                          >
                            Ver iniciativas
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <InfoCard label="Iniciativas asignadas" value={item.initiatives.join(', ')} />
                          <InfoCard label="Step actual" value={Array.from(new Set(item.currentSteps)).join(', ')} />
                          <InfoCard label="Sesiones pendientes" value={`${item.pendingSessions}`} />
                          <InfoCard label="Iniciativas bloqueadas" value={`${item.blockedInitiatives}`} />
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <ShieldAlert size={17} className="text-amber-700" />
                <h2 className="text-lg text-slate-950" style={{ fontWeight: 700 }}>Bandeja de pendientes</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Esta bandeja sirve para gestionar confirmaciones, asignaciones y casos que ya piden destrabe desde actores clave.
              </p>
              <div className="mt-5 space-y-3">
                {pendingTray.length === 0 ? (
                  <PortfolioLeadEmptyState
                    title="No hay pendientes criticos ahora"
                    description="Sponsors, challenge owners y mentores visibles no muestran pendientes urgentes en este momento. El siguiente paso mas util es volver a frentes o retos para confirmar cobertura y activacion."
                    primaryAction={primaryAction}
                  />
                ) : (
                  pendingTray.map(item => (
                    <PendingCard key={item.id} tone={item.tone} title={item.title} description={item.description} />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-xs text-amber-300" style={{ fontWeight: 700 }}>QUE HACE ESTA VISTA</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>Hace visible quien sostiene cada frente, reto o iniciativa.</p>
                <p>No mezcla roles como si fueran equivalentes: cada uno vive en un nivel distinto del portafolio.</p>
                <p>No mueve la metodologia del mentor ni los touchpoints sponsor del core. Solo representa contexto y asignacion.</p>
              </div>
            </div>
          </section>
        </section>
      </div>
    );
  }

  if (location.pathname === '/portfolio/reportes') {
    return <PortfolioLeadReportsDecisionsExperience basePath="/portfolio/reportes" />;
  }

  const content = SECTION_CONTENT[location.pathname];
  if (!content) return null;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>PORTFOLIO LEAD</p>
        <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          {content.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">{content.summary}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-900" style={{ fontWeight: 700 }}>Que esta bien</p>
          <p className="mt-2 text-sm text-emerald-800">
            La estructura base del rol ya esta separada del participante y del admin operativo.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Que falta</p>
          <p className="mt-2 text-sm text-amber-800">
            Todavia no hay widgets especificos para esta seccion porque esta entrega solo crea la capa base.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
          <p className="text-sm" style={{ fontWeight: 700 }}>Siguiente accion recomendada</p>
          <p className="mt-2 text-sm text-slate-300">{content.nextAction}</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-[#faf8f2] p-6">
        <div className="flex items-center gap-2 text-slate-700">
          <ArrowRight size={16} />
          <p className="text-sm" style={{ fontWeight: 600 }}>
            Vista base preparada para poblar contenido real de {content.title.toLowerCase()}.
          </p>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm transition-colors ${active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
      style={{ fontWeight: 600 }}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{title.toUpperCase()}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function SummaryCard({
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function PendingCard({
  tone,
  title,
  description,
}: {
  tone: 'amber' | 'rose' | 'sky';
  title: string;
  description: string;
}) {
  const classes = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  };

  return (
    <div className={`rounded-2xl border p-4 ${classes[tone]}`}>
      <p className="text-sm" style={{ fontWeight: 700 }}>{title}</p>
      <p className="mt-2 text-sm opacity-90">{description}</p>
    </div>
  );
}
