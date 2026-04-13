import React, { useMemo, useState } from 'react';
import { Globe2, Layers3, Plus, Target, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import type {
  Challenge,
  ChallengeActivationMode,
  ChallengeCoverageStatus,
  ChallengeType,
  CreateChallengeInput,
  InvitationStatus,
  SquadRole,
  StakeholderStatus,
} from '../portfolio/PortfolioLeadContext';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import {
  activationLabel,
  challengeExecutiveSummary,
  challengeStatusLabel,
  challengeTypeLabel,
  publicationToneClasses,
} from '../portfolio/portfolioLeadCopy';
import { PortfolioLeadBreadcrumbs, PortfolioLeadContextStrip, PortfolioLeadEmptyState } from '../components/portfolio/PortfolioLeadPageElements';

const ACTIVATION_OPTIONS: Array<{ value: ChallengeActivationMode; label: string; description: string }> = [
  { value: 'convocatoria_abierta', label: 'Convocatoria abierta', description: 'El reto se prepara para abrirse a participantes habilitados del programa.' },
  { value: 'personas_seleccionadas', label: 'Personas seleccionadas', description: 'El reto se activa para una lista concreta de personas invitadas.' },
  { value: 'squad_asignado', label: 'Squad asignado', description: 'El reto se activa con un squad ya definido desde Portfolio Lead.' },
];

const CHALLENGE_TYPE_OPTIONS: Array<{ value: ChallengeType | ''; label: string }> = [
  { value: '', label: 'Selecciona tipo de reto' },
  { value: 'correccion', label: 'Correccion' },
  { value: 'crecimiento', label: 'Crecimiento' },
  { value: 'exploracion', label: 'Exploracion' },
];

const STAKEHOLDER_STATUS_OPTIONS: Array<{ value: StakeholderStatus; label: string }> = [
  { value: 'definido', label: 'Definido' },
  { value: 'notificado', label: 'Notificado' },
  { value: 'confirmado', label: 'Confirmado' },
];

const INVITATION_STATUS_OPTIONS: Array<{ value: InvitationStatus; label: string }> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'notificado', label: 'Notificado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'declinado', label: 'Declinado' },
];

const SQUAD_ROLE_OPTIONS: Array<{ value: SquadRole; label: string }> = [
  { value: 'lider', label: 'Lider' },
  { value: 'colaborador', label: 'Colaborador' },
];

const EMPTY_FORM: CreateChallengeInput = {
  name: '',
  strategicFrontId: '',
  challengeType: '',
  whatWeWantToMove: '',
  objective: '',
  whyNow: '',
  successCriteria: '',
  challengeOwner: '',
  activationMode: 'convocatoria_abierta',
  status: 'draft',
};

function coverageLabel(status: ChallengeCoverageStatus) {
  const labels: Record<ChallengeCoverageStatus, string> = {
    sin_cobertura: 'Sin cobertura',
    cobertura_parcial: 'Cobertura parcial',
    cobertura_suficiente: 'Cobertura suficiente',
    resuelto: 'Resuelto',
    reformular: 'Reformular',
    cerrar: 'Cerrar',
  };
  return labels[status];
}

function coverageClasses(status: ChallengeCoverageStatus) {
  switch (status) {
    case 'cobertura_suficiente':
    case 'resuelto':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'cobertura_parcial':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'reformular':
    case 'cerrar':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getActivationPhaseLabel(challenge: Challenge) {
  if (challenge.visibleToParticipants) return 'Publicado';
  if (challenge.status === 'activo_interno') return 'Activo interno';
  if (challenge.status === 'listo_para_activar') return 'Listo para activar';
  return 'Solo definido';
}

function getReadinessItems(challenge: Challenge) {
  return [
    { label: 'Challenge owner propuesto', done: challenge.challengeOwner.trim().length > 0 },
    { label: 'Challenge owner confirmado', done: challenge.challengeOwnerStatus === 'confirmado' },
    { label: 'Sponsor visible y confirmado', done: challenge.sponsorStatus === 'confirmado' },
    {
      label: 'Modalidad preparada',
      done:
        challenge.activationMode === 'convocatoria_abierta'
          ? challenge.openCallStatus === 'activa'
          : challenge.activationMode === 'personas_seleccionadas'
            ? challenge.selectedPeople.length > 0
            : challenge.assignedSquad.length > 0,
    },
  ];
}

function getMissingToActivate(challenge: Challenge) {
  return getReadinessItems(challenge).filter(item => !item.done).map(item => item.label);
}

function getPeopleCount(challenge: Challenge) {
  return challenge.activationMode === 'squad_asignado' ? challenge.assignedSquad.length : challenge.selectedPeople.length;
}

function getChallengeNextAction(challenge: Challenge, initiatives: ReturnType<typeof usePortfolioLead>['initiatives']) {
  const related = initiatives.filter(item => item.challengeId === challenge.id);
  const missingActivation = getMissingToActivate(challenge);

  if (challenge.status === 'draft') return 'Completar la definicion del reto antes de llevarlo a activacion.';
  if (!challenge.visibleToParticipants && missingActivation.length > 0) return `Preparar activacion: ${missingActivation[0]}.`;
  if (!challenge.visibleToParticipants) return 'Publicar el reto cuando la activacion ya este completa.';
  if (related.length === 0) return 'El reto ya esta activo. Ahora conviene revisar por que aun no recibe iniciativas.';
  if (related.some(item => item.readyForDecision)) return 'Hay iniciativas maduras. Conviene llevarlas a decision.';
  if (related.some(item => item.status === 'bloqueada')) return 'Hay iniciativas bloqueadas. Conviene destrabar antes de seguir abriendo trabajo.';
  return 'Mantener seguimiento del reto sin mezclarlo con gestion profunda de iniciativas.';
}

function getOverlapWarning(challenge: Challenge, challenges: Challenge[]) {
  const current = `${challenge.name} ${challenge.whatWeWantToMove}`.toLowerCase();
  return challenges.find(other =>
    other.id !== challenge.id
    && other.strategicFrontId === challenge.strategicFrontId
    && current.split(' ').filter(word => word.length > 5).some(word => (`${other.name} ${other.whatWeWantToMove}`).toLowerCase().includes(word)),
  ) ?? null;
}

export function PortfolioLeadChallengesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    strategicFronts,
    challenges,
    initiatives,
    createChallenge,
    updateChallengeActivationMode,
    updateChallengeStakeholderStatus,
    activateOpenCall,
    addSelectedPerson,
    updateSelectedPersonStatus,
    addSquadMember,
    updateSquadMemberRole,
    confirmAssignedSquad,
    publishChallenge,
    loadChallengeCoverageDemo,
  } = usePortfolioLead();

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<CreateChallengeInput>(EMPTY_FORM);
  const [personInput, setPersonInput] = useState('');
  const [squadInput, setSquadInput] = useState('');
  const [squadRoleInput, setSquadRoleInput] = useState<SquadRole>('lider');
  const [activeChallengeId, setActiveChallengeId] = useState(searchParams.get('challengeId'));

  const activeChallenge = challenges.find(item => item.id === activeChallengeId) ?? challenges[0] ?? null;
  const activeFront = strategicFronts.find(item => item.id === activeChallenge?.strategicFrontId) ?? null;

  const summary = useMemo(() => ({
    total: challenges.length,
    definedOnly: challenges.filter(item => item.status === 'draft' || item.status === 'listo_para_activar').length,
    activeInternally: challenges.filter(item => item.status === 'activo_interno').length,
    published: challenges.filter(item => item.visibleToParticipants).length,
  }), [challenges]);

  const canSubmit = [
    form.name,
    form.strategicFrontId,
    form.challengeType,
    form.whatWeWantToMove,
    form.objective,
    form.successCriteria,
    form.challengeOwner,
  ].every(value => value.trim().length > 0);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const created = createChallenge(form);
    setActiveChallengeId(created.id);
    setForm(EMPTY_FORM);
    setIsCreating(false);
  };

  const moduleCta = strategicFronts.length === 0
    ? { label: 'Crear primer frente estrategico', onClick: () => navigate('/portfolio/frentes-estrategicos') }
    : challenges.length === 0
      ? { label: 'Definir primer reto', onClick: () => setIsCreating(true) }
      : activeChallenge && !activeChallenge.visibleToParticipants
        ? { label: activeChallenge.activationMode === 'convocatoria_abierta' ? 'Abrir convocatoria' : activeChallenge.activationMode === 'squad_asignado' ? 'Asignar squad' : 'Activar reto', onClick: () => window.document.getElementById('bloque-activacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
        : activeChallenge && activeChallenge.visibleToParticipants && activeChallenge.initiativeCount === 0
          ? { label: activeChallenge.activationMode === 'convocatoria_abierta' ? 'Reforzar convocatoria' : activeChallenge.activationMode === 'squad_asignado' ? 'Revisar squad' : 'Revisar invitaciones', onClick: () => window.document.getElementById('bloque-cobertura')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
          : activeChallenge && initiatives.some(item => item.readyForDecision && item.challengeId === activeChallenge.id)
            ? { label: 'Revisar decisiones', onClick: () => navigate(`/portfolio/decisiones?challengeId=${encodeURIComponent(activeChallenge.id)}`) }
            : { label: 'Definir nuevo reto', onClick: () => setIsCreating(true) };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs
        items={[
          { label: 'Portfolio Lead', path: '/portfolio/inicio' },
          activeFront ? { label: activeFront.name, path: `/portfolio/frentes-estrategicos` } : { label: 'Frentes estrategicos', path: '/portfolio/frentes-estrategicos' },
          { label: 'Retos' },
        ]}
      />

      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff4d8_0%,#ffffff_58%,#eef3ea_100%)] p-6 md:p-8">
        <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>RETOS</p>
        <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          Define el reto primero y activalo despues con criterio visible
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Un reto aterriza un frente estrategico en una unidad accionable. Crear el reto no significa que ya este operativo.
        </p>

        <PortfolioLeadContextStrip
          items={[
            { label: 'Frente padre visible', value: activeFront?.name ?? 'Selecciona o crea un frente primero' },
            { label: 'Reto seleccionado', value: activeChallenge?.name ?? 'Todavia no hay reto seleccionado' },
            { label: 'Estado de activacion', value: activeChallenge ? getActivationPhaseLabel(activeChallenge) : 'Sin activacion todavia' },
            { label: 'Iniciativas asociadas', value: activeChallenge ? `${activeChallenge.initiativeCount}` : '0' },
            { label: 'Siguiente accion recomendada', value: activeChallenge ? getChallengeNextAction(activeChallenge, initiatives) : strategicFronts.length === 0 ? 'Crear el primer frente estrategico' : 'Definir el primer reto o seleccionar uno para activarlo' },
          ]}
        />
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>LECTURA DEL MODULO</p>
            <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Definir reto y activar reto son dos momentos distintos</h2>
            <p className="mt-2 text-sm text-slate-600">
              Esta pantalla separa la definicion del reto de su activacion. Primero se formula con claridad y luego se prepara su modalidad de entrada.
            </p>
          </div>
          <button onClick={moduleCta.onClick} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800" style={{ fontWeight: 600 }}>
            <Plus size={14} className="mr-2 inline-flex" />
            {moduleCta.label}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Retos definidos" value={summary.total} hint="Base total del portafolio" icon={Target} />
          <SummaryCard label="Solo definidos" value={summary.definedOnly} hint="Aun no pasan a activacion real" icon={Layers3} />
          <SummaryCard label="Activos internamente" value={summary.activeInternally} hint="Ya tienen activacion preparada dentro de Portfolio Lead" icon={Users} />
          <SummaryCard label="Publicados" value={summary.published} hint="Ya visibles segun su modalidad" icon={Globe2} />
        </div>
      </section>

      {isCreating ? (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="max-w-3xl">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>1. DEFINIR RETO</p>
            <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Aterriza un frente estrategico en una unidad accionable</h2>
            <p className="mt-2 text-sm text-slate-600">
              Aqui defines el reto. La activacion viene despues en un bloque separado, para que “reto creado” no se lea como “reto operativo”.
            </p>
          </div>

          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre del reto" value={form.name} onChange={value => setForm(prev => ({ ...prev, name: value }))} />
              <SelectField label="Frente estrategico padre" value={form.strategicFrontId} onChange={value => setForm(prev => ({ ...prev, strategicFrontId: value }))} options={[{ value: '', label: 'Selecciona un frente' }, ...strategicFronts.map(front => ({ value: front.id, label: front.name }))]} />
              <SelectField label="Tipo de reto" value={form.challengeType} onChange={value => setForm(prev => ({ ...prev, challengeType: value as ChallengeType | '' }))} options={CHALLENGE_TYPE_OPTIONS} />
              <Field label="Challenge owner propuesto" value={form.challengeOwner} onChange={value => setForm(prev => ({ ...prev, challengeOwner: value }))} />
            </div>
            <TextAreaField label="Problema / oportunidad / incertidumbre que aborda" value={form.whatWeWantToMove} onChange={value => setForm(prev => ({ ...prev, whatWeWantToMove: value }))} />
            <TextAreaField label="Objetivo del reto" value={form.objective} onChange={value => setForm(prev => ({ ...prev, objective: value }))} />
            <TextAreaField label="Criterio de exito" value={form.successCriteria} onChange={value => setForm(prev => ({ ...prev, successCriteria: value }))} />

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Que pasa cuando lo guardas</p>
              <p className="mt-2 text-sm text-amber-800">
                El reto queda <span style={{ fontWeight: 700 }}>definido</span>, pero todavia no se considera activo. Luego debes completar su activacion segun modalidad, owner confirmado y personas asignadas o invitadas.
              </p>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={!canSubmit} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ fontWeight: 600 }}>
                Guardar reto definido
              </button>
              <button type="button" onClick={() => setIsCreating(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.35fr]">
        <div className="space-y-4">
          {strategicFronts.length === 0 ? (
            <PortfolioLeadEmptyState
              title="Todavia no puedes bajar a retos"
              description="Primero necesitas al menos un frente estrategico. Sin ese padre visible, el reto pierde ancla y no deberia leerse como trabajo real."
              primaryAction={{ label: 'Crear primer frente estrategico', onClick: () => navigate('/portfolio/frentes-estrategicos') }}
            />
          ) : challenges.length === 0 ? (
            <PortfolioLeadEmptyState
              title="Todavia no hay retos definidos"
              description="El siguiente paso es definir el primer reto para aterrizar un frente en una unidad accionable y luego activar su modalidad."
              primaryAction={{ label: 'Definir primer reto', onClick: () => setIsCreating(true) }}
              secondaryAction={{ label: 'Volver a frentes', onClick: () => navigate('/portfolio/frentes-estrategicos') }}
            />
          ) : challenges.map(challenge => {
            const front = strategicFronts.find(item => item.id === challenge.strategicFrontId);
            const overlap = getOverlapWarning(challenge, challenges);
            const peopleCount = getPeopleCount(challenge);
            const nextAction = getChallengeNextAction(challenge, initiatives);
            return (
              <button
                key={challenge.id}
                onClick={() => setActiveChallengeId(challenge.id)}
                className={`w-full rounded-3xl border p-5 text-left transition-colors ${activeChallenge?.id === challenge.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs ${publicationToneClasses(challenge.status)}`}>{challengeStatusLabel(challenge.status)}</span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{activationLabel(challenge.activationMode)}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs ${coverageClasses(challenge.coverageStatus)}`}>{coverageLabel(challenge.coverageStatus)}</span>
                </div>
                <p className="mt-3 text-base text-slate-950" style={{ fontWeight: 700 }}>{challenge.name}</p>
                <p className="mt-1 text-sm text-slate-600">{front?.name ?? 'Sin frente'} · {challengeTypeLabel(challenge.challengeType)}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <MiniInfo label="Challenge owner" value={challenge.challengeOwner} />
                  <MiniInfo label="Personas invitadas o asignadas" value={`${peopleCount}`} />
                  <MiniInfo label="Iniciativas asociadas" value={`${challenge.initiativeCount}`} />
                  <MiniInfo label="Fase de activacion" value={getActivationPhaseLabel(challenge)} />
                </div>
                {overlap ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-900" style={{ fontWeight: 700 }}>Posible solapamiento</p>
                    <p className="mt-1 text-sm text-amber-800">Podria superponerse con "{overlap.name}" dentro del mismo frente. Conviene revisar si ambos retos realmente son distintos.</p>
                  </div>
                ) : null}
                <p className="mt-4 text-sm text-slate-900"><span style={{ fontWeight: 700 }}>Siguiente accion:</span> {nextAction}</p>
              </button>
            );
          })}
        </div>

        {activeChallenge ? (
          <div className="space-y-6">
            <section id="bloque-activacion" className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>RETO SELECCIONADO</p>
                  <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{activeChallenge.name}</h2>
                  <p className="mt-2 text-sm text-slate-600">{activeChallenge.whatWeWantToMove}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${coverageClasses(activeChallenge.coverageStatus)}`}>
                  {coverageLabel(activeChallenge.coverageStatus)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoCard label="Frente estrategico padre" value={activeFront?.name ?? 'Sin frente'} />
                <InfoCard label="Sponsor del frente" value={activeFront?.sponsor ?? 'Sin sponsor visible'} />
                <InfoCard label="Tipo de reto" value={challengeTypeLabel(activeChallenge.challengeType)} />
                <InfoCard label="Challenge owner propuesto" value={activeChallenge.challengeOwner} />
                <InfoCard label="Objetivo del reto" value={activeChallenge.objective} />
                <InfoCard label="Criterio de exito" value={activeChallenge.successCriteria} />
              </div>
            </section>

            <section id="bloque-cobertura" className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>1. DEFINICION DEL RETO</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoCard label="Problema / oportunidad / incertidumbre" value={activeChallenge.whatWeWantToMove} />
                <InfoCard label="Objetivo del reto" value={activeChallenge.objective} />
                <InfoCard label="Estado del reto" value={challengeStatusLabel(activeChallenge.status)} />
                <InfoCard label="Siguiente accion recomendada" value={getChallengeNextAction(activeChallenge, initiatives)} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>2. ACTIVACION DEL RETO</p>
              <p className="mt-2 text-sm text-slate-600">
                Este bloque existe para volver visible cuando el reto ya puede operar. Hasta completar activacion, el reto no debe leerse como activo.
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                <div className="space-y-4">
                  <SelectField label="Modalidad de activacion" value={activeChallenge.activationMode} onChange={value => updateChallengeActivationMode(activeChallenge.id, value as ChallengeActivationMode)} options={ACTIVATION_OPTIONS.map(option => ({ value: option.value, label: option.label }))} />

                  <div className="grid gap-4 md:grid-cols-2">
                    <StakeholderCard title="Challenge owner confirmado" value={activeChallenge.challengeOwnerStatus} onChange={value => updateChallengeStakeholderStatus(activeChallenge.id, 'challengeOwnerStatus', value)} />
                    <StakeholderCard title="Sponsor visible" value={activeChallenge.sponsorStatus} onChange={value => updateChallengeStakeholderStatus(activeChallenge.id, 'sponsorStatus', value)} />
                  </div>

                  {activeChallenge.activationMode === 'convocatoria_abierta' ? (
                    <ActivationPanel title="Convocatoria abierta" description="El reto se considera activado internamente cuando ya puede pasar a preparacion de convocatoria.">
                      <button onClick={() => activateOpenCall(activeChallenge.id)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
                        Marcar convocatoria lista
                      </button>
                      <p className="text-sm text-slate-600">Estado actual: {activeChallenge.openCallStatus === 'activa' ? 'Activa internamente' : 'Todavia inactiva'}</p>
                    </ActivationPanel>
                  ) : null}

                  {activeChallenge.activationMode === 'personas_seleccionadas' ? (
                    <ActivationPanel title="Personas seleccionadas" description="Agrega las personas invitadas y deja visible su estado antes de publicar el reto.">
                      <div className="flex gap-2">
                        <input value={personInput} onChange={event => setPersonInput(event.target.value)} placeholder="Correo o nombre" className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                        <button
                          onClick={() => {
                            addSelectedPerson(activeChallenge.id, personInput);
                            setPersonInput('');
                          }}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                          style={{ fontWeight: 600 }}
                        >
                          Agregar
                        </button>
                      </div>
                      <div className="space-y-2">
                        {activeChallenge.selectedPeople.map(person => (
                          <div key={person.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{person.value}</p>
                              <select value={person.status} onChange={event => updateSelectedPersonStatus(activeChallenge.id, person.id, event.target.value as InvitationStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                {INVITATION_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ActivationPanel>
                  ) : null}

                  {activeChallenge.activationMode === 'squad_asignado' ? (
                    <ActivationPanel title="Squad asignado" description="Define quienes entran al reto y con que rol antes de considerarlo activo internamente.">
                      <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
                        <input value={squadInput} onChange={event => setSquadInput(event.target.value)} placeholder="Nombre de integrante" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                        <select value={squadRoleInput} onChange={event => setSquadRoleInput(event.target.value as SquadRole)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                          {SQUAD_ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <button
                          onClick={() => {
                            addSquadMember(activeChallenge.id, squadInput, squadRoleInput);
                            setSquadInput('');
                          }}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                          style={{ fontWeight: 600 }}
                        >
                          Agregar
                        </button>
                      </div>
                      <div className="space-y-2">
                        {activeChallenge.assignedSquad.map(member => (
                          <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{member.value}</p>
                              <select value={member.role} onChange={event => updateSquadMemberRole(activeChallenge.id, member.id, event.target.value as SquadRole)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                {SQUAD_ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => confirmAssignedSquad(activeChallenge.id)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
                        Confirmar squad para activacion
                      </button>
                    </ActivationPanel>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Que falta para activarlo o publicarlo</p>
                    {getMissingToActivate(activeChallenge).length === 0 ? (
                      <p className="mt-2 text-sm text-amber-800">La activacion ya esta lista. Ahora puedes publicarlo segun modalidad.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {getMissingToActivate(activeChallenge).map(item => (
                          <p key={item} className="text-sm text-amber-800">- {item}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Lifecycle visible</p>
                    <div className="mt-4 grid gap-3">
                      <StepCard title="Reto definido" done />
                      <StepCard title="Reto activado internamente" done={['activo_interno', 'publicado', 'recibiendo_iniciativas', 'con_iniciativas_activas', 'pendiente_de_decision', 'cerrado'].includes(activeChallenge.status)} />
                      <StepCard title="Reto publicado" done={activeChallenge.visibleToParticipants} />
                    </div>
                    <button onClick={() => publishChallenge(activeChallenge.id)} disabled={getMissingToActivate(activeChallenge).length > 0} className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ fontWeight: 600 }}>
                      Publicar reto
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>3. COBERTURA Y LECTURA BREVE</p>
              <div className="mt-4 grid gap-4 md:grid-cols-5">
                {(() => {
                  const exec = challengeExecutiveSummary(activeChallenge, initiatives);
                  return (
                    <>
                      <InfoCard label="Cobertura" value={coverageLabel(activeChallenge.coverageStatus)} />
                      <InfoCard label="Iniciativas asociadas" value={`${exec.total}`} />
                      <InfoCard label="Activas" value={`${exec.active}`} />
                      <InfoCard label="Bloqueadas" value={`${exec.blocked}`} />
                      <InfoCard label="Siguiente accion" value={getChallengeNextAction(activeChallenge, initiatives)} />
                    </>
                  );
                })()}
              </div>

              {activeChallenge.initiativeCount === 0 ? (
                <div className="mt-5">
                  <PortfolioLeadEmptyState
                    title="Todavia no hay iniciativas asociadas"
                    description={!activeChallenge.visibleToParticipants
                      ? 'Este reto existe, pero todavia no deberia leerse como activo hacia participantes porque sigue antes de publicacion.'
                      : 'El reto ya esta activo, pero aun no genera iniciativas visibles. Conviene revisar modalidad, convocatoria o squad antes de abrir mas trabajo.'}
                    primaryAction={{
                      label: !activeChallenge.visibleToParticipants
                        ? activeChallenge.activationMode === 'convocatoria_abierta'
                          ? 'Abrir convocatoria'
                          : activeChallenge.activationMode === 'squad_asignado'
                            ? 'Asignar squad'
                            : 'Activar reto'
                        : 'Cargar ejemplo de cobertura',
                      onClick: !activeChallenge.visibleToParticipants
                        ? () => window.document.getElementById('bloque-activacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        : () => loadChallengeCoverageDemo(activeChallenge.id),
                    }}
                    secondaryAction={{ label: 'Volver al frente', onClick: () => navigate(`/portfolio/frentes-estrategicos`) }}
                  />
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function StakeholderCard({ title, value, onChange }: { title: string; value: StakeholderStatus; onChange: (value: StakeholderStatus) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{title}</p>
      <select value={value} onChange={event => onChange(event.target.value as StakeholderStatus)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
        {STAKEHOLDER_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function ActivationPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{title}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function SummaryCard({ label, value, hint, icon: Icon }: { label: string; value: number; hint: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
        <Icon size={18} />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-3xl text-slate-950" style={{ fontWeight: 700 }}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function StepCard({ title, done }: { title: string; done: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-sm" style={{ fontWeight: 700 }}>{title}</p>
      <p className="mt-2 text-sm opacity-90">{done ? 'Ya visible.' : 'Todavia pendiente.'}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>{value}</p>
    </div>
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
