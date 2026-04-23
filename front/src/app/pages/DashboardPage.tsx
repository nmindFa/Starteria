import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Clock, Users, AlertTriangle, ChevronRight, Search, Folder, BellRing, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Project, SponsorTouchpoint } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { activationLabel, challengeStatusLabel, challengeTypeLabel, participantCtaLabel } from '../portfolio/portfolioLeadCopy';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-full mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="h-2 bg-slate-100 rounded w-full" />
    </div>
  );
}

type SponsorAlert = {
  projectId: string;
  projectName: string;
  touchpoint: SponsorTouchpoint;
  commentCount: number;
};

function buildSponsorAlerts(projects: Project[]): SponsorAlert[] {
  return projects.flatMap(project =>
    (project.sponsorTouchpoints ?? [])
      .filter(touchpoint => touchpoint.status !== 'Cerrado')
      .map(touchpoint => ({
        projectId: project.id,
        projectName: project.name,
        touchpoint,
        commentCount: (project.sponsorComments ?? []).filter(comment => comment.touchpointId === touchpoint.id).length,
      }))
  );
}

function getSponsorMilestone(project: Project) {
  const step2 = project.steps.find(step => step.number === 2);
  const step4 = project.steps.find(step => step.number === 4);

  if (project.step0Status !== 'Completado') {
    return {
      label: 'Step 0',
      summary: 'Definir el contexto y convocar el alineamiento inicial.',
    };
  }

  if (step2 && ['En progreso', 'Enviado', 'Feedback IA', 'Ajustado', 'Sesión experto pendiente', 'Aprobado'].includes(step2.status)) {
    return {
      label: 'Cierre Step 2',
      summary: 'Revisar la definición estratégica del problema antes de seguir.',
    };
  }

  if (step4 && step4.status !== 'Bloqueado' && step4.status !== 'No iniciado') {
    return {
      label: 'Step 4',
      summary: 'Participar en la presentación final y acordar el siguiente paso.',
    };
  }

  return {
    label: 'Seguimiento',
    summary: 'La iniciativa sigue avanzando. Aún no tienes una intervención inmediata.',
  };
}

export function DashboardPage() {
  const { projects, projectsLoading, setCurrentProject, user, getProjectMember, acceptSponsorInvitation } = useApp();
  const { challenges, strategicFronts } = usePortfolioLead();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const loading = projectsLoading;

  const isOwner = user?.role === 'owner';
  const isSponsor = user?.role === 'sponsor';
  const filtered = projects.filter(project =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.description?.toLowerCase().includes(search.toLowerCase())
  );

  const visibleProjects = isOwner
    ? filtered.filter(project => project.team.some(member => member.email === user?.email))
    : isSponsor
      ? filtered.filter(project =>
          project.team.some(
            member =>
              member.email === user?.email &&
              member.role === 'Sponsor' &&
              member.status !== 'Pendiente'
          )
        )
      : filtered;

  const sponsorAlerts = isSponsor ? buildSponsorAlerts(visibleProjects) : [];
  const participantEmail = user?.email?.toLowerCase() ?? '';
  const publishedChallenges = challenges.filter(challenge => challenge.visibleToParticipants);
  const openChallenges = publishedChallenges.filter(challenge => challenge.activationMode === 'convocatoria_abierta');
  const invitedChallenges = publishedChallenges.filter(challenge =>
    challenge.activationMode !== 'convocatoria_abierta'
      && (challenge.activationMode === 'squad_asignado'
        || challenge.selectedPeople.some(person => person.value.toLowerCase() === participantEmail)),
  );

  const handleOpenProject = (id: string) => {
    const project = projects.find(item => item.id === id);
    if (!project) return;
    setCurrentProject(project);
    navigate(`/projects/${id}`);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`;
    if (hrs > 0) return `Hace ${hrs} h`;
    return `Hace ${mins} min`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>
            {user?.role === 'owner'
              ? 'Mis proyectos'
              : user?.role === 'mentor'
                ? 'Proyectos a revisar'
                : user?.role === 'admin'
                  ? 'Todos los proyectos'
                  : 'Iniciativas con sponsor'}
          </h1>
          <p className="text-sm text-slate-500">
            {user?.cohort ? `${user.cohort} · ` : ''}
            {visibleProjects.length} proyecto{visibleProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        {user?.role === 'owner' && (
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
            style={{ fontWeight: 500 }}
          >
            <Plus size={16} /> Crear proyecto
          </button>
        )}
      </div>

      {isSponsor && (
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>Vista sponsor</p>
          <p className="text-xs text-indigo-700 mt-1">
            Aquí ves solo las iniciativas donde fuiste asignado como sponsor, sus hitos clave y los pendientes donde debes intervenir.
          </p>
        </div>
      )}

      {isSponsor && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <BellRing size={16} className="text-indigo-600" />
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Pendientes del sponsor</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Aquí aparece cuándo el equipo te solicita revisión, agenda una sesión o deja listo un espacio para comentario.
          </p>

          {sponsorAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>No tienes alertas activas.</p>
              <p className="text-xs text-slate-500 mt-1">
                Cuando el equipo te convoque en Step 0, cierre Step 2 o Step 4, verás el pendiente aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sponsorAlerts.map(alert => (
                <div key={`${alert.projectId}-${alert.touchpoint.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{alert.projectName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {alert.touchpoint.stageLabel} · {alert.touchpoint.title}
                      </p>
                    </div>
                    <StatusChip status={alert.touchpoint.status} size="sm" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Acción: {alert.touchpoint.actionLabel}</span>
                    <span>•</span>
                    <span>{alert.touchpoint.date ? `Fecha: ${alert.touchpoint.date}` : 'Sin fecha confirmada'}</span>
                    <span>•</span>
                    <span>{alert.commentCount > 0 ? `${alert.commentCount} comentario(s) registrados` : 'Sin comentarios aún'}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleOpenProject(alert.projectId)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => handleOpenProject(alert.projectId)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-white transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Dejar comentario
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <ParticipantChallengePanel
            title="Retos abiertos"
            description="Aqui ves retos ya publicados para participantes. Esta bandeja no reemplaza el workspace de la iniciativa."
            emptyTitle="No hay retos abiertos por ahora"
            emptyDescription="Cuando Portfolio Lead publique una convocatoria abierta, aparecera aqui."
            challenges={openChallenges}
          />
          <ParticipantChallengePanel
            title="Retos donde fui invitado"
            description="Aqui aparecen retos publicados para ti por invitacion o por squad."
            emptyTitle="No tienes invitaciones activas"
            emptyDescription="Cuando te inviten a un reto publicado, aparecera aqui con una accion contextual."
            challenges={invitedChallenges}
          />
        </div>
      )}

      <div className="relative mb-6">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar proyectos..."
          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(index => <SkeletonCard key={index} />)}
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <Folder size={24} className="text-indigo-400" />
          </div>
          <h3 className="text-slate-800 mb-2" style={{ fontWeight: 600 }}>
            {search ? 'Sin resultados' : isSponsor ? 'No tienes iniciativas asignadas como sponsor' : 'No tienes proyectos aún'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs">
            {search
              ? `No encontramos proyectos con "${search}". Prueba con otro término.`
              : isSponsor
                ? 'Cuando te asignen como sponsor verás aquí el avance, los hitos donde debes intervenir y la siguiente convocatoria.'
                : 'Crea tu primer proyecto y empieza a trabajar en tu desafío.'}
          </p>
          {!search && user?.role === 'owner' && (
            <button
              onClick={() => navigate('/projects/new')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Plus size={16} /> Crear primer proyecto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map(project => {
            const currentStep = project.steps.find(step => step.number === project.currentStep);
            const hasBlock = project.steps.some(step => step.status === 'Bloqueado' && step.number === project.currentStep);
            const pendingSession = project.steps.some(step => step.status === 'Sesión experto pendiente');
            const sponsorMilestone = isSponsor ? getSponsorMilestone(project) : null;
            const sponsorMember = isSponsor ? getProjectMember(project.id, user?.email) : null;
            const sponsorInvitationPendingAcceptance = sponsorMember?.role === 'Sponsor' && sponsorMember.status === 'Enviado';
            const lastTouchpoint = (project.sponsorTouchpoints ?? []).find(item => item.status !== 'Cerrado');

            return (
              <button
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <StatusChip status={project.status} size="sm" />
                  {sponsorMember?.role === 'Sponsor' && <StatusChip status={sponsorMember.status} size="sm" />}
                  {pendingSession && <StatusChip status="Sesión experto pendiente" size="sm" />}
                </div>

                <div className="flex gap-1 mb-3">
                  {project.steps.map(step => (
                    <div key={step.number} className="flex-1" title={`Step ${step.number}: ${step.name} — ${step.status}`}>
                      <div className={`h-1.5 rounded-full ${
                        step.status === 'Aprobado'
                          ? 'bg-emerald-500'
                          : ['En progreso', 'Enviado', 'Feedback IA', 'Ajustado', 'Sesión experto pendiente'].includes(step.status)
                            ? 'bg-indigo-500'
                            : step.status === 'No iniciado'
                              ? 'bg-slate-200'
                              : 'bg-slate-100'
                      }`} />
                      <p className="text-xs text-slate-400 mt-1 text-center">{step.number}</p>
                    </div>
                  ))}
                </div>

                {currentStep && (
                  <div className="mb-3">
                    <ProgressBar value={currentStep.progress} size="sm" label={`Step ${currentStep.number}: ${currentStep.name}`} />
                  </div>
                )}

                {(hasBlock || pendingSession) && (
                  <div className={`flex items-center gap-1.5 text-xs p-2 rounded-lg mb-2 ${
                    hasBlock ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'
                  }`}>
                    <AlertTriangle size={11} />
                    {hasBlock ? 'Hay módulos bloqueados que requieren atención' : 'Sesión con experto pendiente de agendar'}
                  </div>
                )}

                {sponsorMilestone && (
                  <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-700" style={{ fontWeight: 600 }}>
                      Próxima intervención · {sponsorMilestone.label}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1">{sponsorMilestone.summary}</p>
                    {lastTouchpoint && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-indigo-700">
                        <BellRing size={12} />
                        <span>{lastTouchpoint.stageLabel} · {lastTouchpoint.status}</span>
                      </div>
                    )}
                    {sponsorInvitationPendingAcceptance && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-white px-3 py-2">
                        <div>
                          <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Invitación enviada</p>
                          <p className="text-xs text-slate-500">Acepta el acceso para habilitar tu seguimiento formal en Startería.</p>
                        </div>
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            acceptSponsorInvitation(project.id);
                          }}
                          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          Aceptar acceso
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(project.sponsorComments ?? []).length > 0 && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                    <MessageSquare size={12} />
                    <span>{project.sponsorComments?.length} comentario(s) del sponsor registrados</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1">
                    <Users size={11} /> {project.team.length} miembro{project.team.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={11} /> {timeAgo(project.lastModified)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ParticipantChallengePanel({
  title,
  description,
  emptyTitle,
  emptyDescription,
  challenges,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  challenges: ReturnType<typeof usePortfolioLead>['challenges'];
}) {
  const { user } = useApp();
  const { strategicFronts } = usePortfolioLead();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{title}</h2>
      <p className="mt-2 text-xs text-slate-500">{description}</p>

      {challenges.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {challenges.map(challenge => {
            const front = strategicFronts.find(item => item.id === challenge.strategicFrontId);
            const invited = challenge.selectedPeople.some(person => person.value.toLowerCase() === (user?.email?.toLowerCase() ?? ''));
            return (
              <div key={challenge.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{challengeStatusLabel(challenge.status)}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{activationLabel(challenge.activationMode)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-900" style={{ fontWeight: 700 }}>{challenge.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{front?.name ?? 'Sin frente'} · {challengeTypeLabel(challenge.challengeType)}</p>
                  </div>
                  <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800 transition-colors" style={{ fontWeight: 600 }}>
                    {participantCtaLabel(challenge, invited)}
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <MiniInfo label="Que se quiere mover" value={challenge.whatWeWantToMove} />
                  <MiniInfo label="Por que importa ahora" value={challenge.whyNow} />
                  <MiniInfo label="Challenge owner" value={challenge.challengeOwner} />
                  <MiniInfo label="Estado de publicacion" value={challenge.publicationNotes} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-1 text-xs text-slate-700">{value}</p>
    </div>
  );
}
