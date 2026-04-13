import React, { useMemo, useState } from 'react';
import { AlertCircle, FileBarChart, Flag, Layers3, PenSquare, Plus, Target } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  Challenge,
  CreateStrategicFrontInput,
  Initiative,
  StrategicFront,
  StrategicFrontPriority,
  StrategicFrontStatus,
  usePortfolioLead,
} from '../portfolio/PortfolioLeadContext';
import { challengeStatusLabel, challengeTypeLabel } from '../portfolio/portfolioLeadCopy';
import { PortfolioLeadBreadcrumbs, PortfolioLeadContextStrip, PortfolioLeadEmptyState } from '../components/portfolio/PortfolioLeadPageElements';

const STATUS_OPTIONS: Array<{ value: StrategicFrontStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Activo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'closed', label: 'Cerrado' },
];

const PRIORITY_OPTIONS: StrategicFrontPriority[] = ['Alta', 'Media', 'Baja'];

const EMPTY_FORM: CreateStrategicFrontInput = {
  name: '',
  strategicObjective: '',
  whyNow: '',
  mainKpi: '',
  baseline: '',
  target: '',
  horizon: '',
  sponsor: '',
  priority: 'Alta',
  status: 'draft',
};

type FrontCoverage = 'sin_cobertura' | 'cobertura_parcial' | 'cobertura_suficiente' | 'necesita_reformulacion';

type FrontInsight = {
  coverage: FrontCoverage;
  nextAction: string;
  report: string;
};

function statusLabel(status: StrategicFrontStatus) {
  return STATUS_OPTIONS.find(option => option.value === status)?.label ?? status;
}

function statusClasses(status: StrategicFrontStatus) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'paused':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'closed':
      return 'border-slate-300 bg-slate-100 text-slate-600';
    default:
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }
}

function coverageLabel(coverage: FrontCoverage) {
  const labels: Record<FrontCoverage, string> = {
    sin_cobertura: 'Sin cobertura',
    cobertura_parcial: 'Cobertura parcial',
    cobertura_suficiente: 'Cobertura suficiente',
    necesita_reformulacion: 'Necesita reformulacion',
  };
  return labels[coverage];
}

function coverageClasses(coverage: FrontCoverage) {
  switch (coverage) {
    case 'cobertura_suficiente':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'cobertura_parcial':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'necesita_reformulacion':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getFrontInsight(front: StrategicFront, challenges: Challenge[], initiatives: Initiative[]): FrontInsight {
  const frontChallenges = challenges.filter(challenge => challenge.strategicFrontId === front.id);
  const frontInitiatives = initiatives.filter(initiative => initiative.strategicFrontId === front.id);
  const readyForDecision = frontInitiatives.filter(initiative => initiative.readyForDecision || initiative.status === 'bloqueada').length;
  const blocked = frontInitiatives.filter(initiative => initiative.status === 'bloqueada').length;
  const inactiveChallenges = frontChallenges.filter(challenge => !challenge.visibleToParticipants).length;
  const needsReformulation = frontChallenges.some(challenge => challenge.coverageStatus === 'reformular');
  const enoughCoverage = frontChallenges.some(challenge => challenge.coverageStatus === 'cobertura_suficiente' || challenge.coverageStatus === 'resuelto');

  let coverage: FrontCoverage = 'sin_cobertura';
  if (needsReformulation) coverage = 'necesita_reformulacion';
  else if (frontChallenges.length === 0 || frontInitiatives.length === 0) coverage = 'sin_cobertura';
  else if (enoughCoverage && blocked === 0) coverage = 'cobertura_suficiente';
  else coverage = 'cobertura_parcial';

  let nextAction = 'Definir el primer reto para convertir esta prioridad en trabajo gobernable.';
  if (inactiveChallenges > 0) nextAction = 'Activar los retos pendientes para que el frente deje de quedarse en definicion.';
  else if (frontChallenges.length > 0 && frontInitiatives.length === 0) nextAction = 'Revisar por que los retos de este frente aun no generan iniciativas visibles.';
  else if (blocked > 0) nextAction = 'Destrabar las iniciativas bloqueadas antes de ampliar el alcance del frente.';
  else if (readyForDecision > 0) nextAction = 'Llevar los casos maduros a decision para cerrar la lectura del frente.';
  else if (frontChallenges.length > 0) nextAction = 'Mantener seguimiento de cobertura y ajustar donde el frente siga flojo.';

  const report = frontChallenges.length === 0
    ? 'Este frente ya define una prioridad, pero todavia no baja a retos concretos.'
    : readyForDecision > 0
      ? `El frente ya concentra ${readyForDecision} caso(s) que requieren decision proxima.`
      : blocked > 0
        ? `El frente acumula ${blocked} iniciativa(s) bloqueada(s) y conviene destrabarlas antes de abrir mas trabajo.`
        : `El frente tiene ${frontChallenges.length} reto(s) y ${frontInitiatives.length} iniciativa(s) asociada(s) bajo seguimiento.`;

  return { coverage, nextAction, report };
}

export function PortfolioLeadStrategicFrontsPage() {
  const navigate = useNavigate();
  const { strategicFronts, challenges, initiatives, createStrategicFront, updateStrategicFront, updateStrategicFrontStatus } = usePortfolioLead();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<CreateStrategicFrontInput>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [selectedFrontId, setSelectedFrontId] = useState<string>(strategicFronts[0]?.id ?? '');

  const selectedFront = strategicFronts.find(front => front.id === selectedFrontId) ?? strategicFronts[0] ?? null;

  const summary = useMemo(() => ({
    total: strategicFronts.length,
    active: strategicFronts.filter(front => front.status === 'active').length,
    withChallenges: strategicFronts.filter(front => challenges.some(challenge => challenge.strategicFrontId === front.id)).length,
    withCoverage: strategicFronts.filter(front => getFrontInsight(front, challenges, initiatives).coverage !== 'sin_cobertura').length,
  }), [challenges, initiatives, strategicFronts]);

  const missingFields = [
    ['nombre', form.name.trim()],
    ['objetivo estrategico', form.strategicObjective.trim()],
    ['por que importa ahora', form.whyNow.trim()],
    ['KPI principal', form.mainKpi.trim()],
    ['baseline', form.baseline.trim()],
    ['meta', form.target.trim()],
    ['horizonte', form.horizon.trim()],
    ['sponsor principal', form.sponsor.trim()],
  ].filter(([, value]) => !value);

  const canSubmit = missingFields.length === 0;
  const createLabel = strategicFronts.length === 0 ? 'Crear primer frente estrategico' : 'Crear nuevo frente estrategico';

  const openCreateForm = () => {
    setFormMode('create');
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setIsFormOpen(true);
  };

  const openEditForm = (front: StrategicFront) => {
    setFormMode('edit');
    setSelectedFrontId(front.id);
    setForm({
      name: front.name,
      strategicObjective: front.strategicObjective,
      whyNow: front.whyNow,
      mainKpi: front.mainKpi,
      baseline: front.baseline,
      target: front.target,
      horizon: front.horizon,
      sponsor: front.sponsor,
      priority: front.priority,
      status: front.status,
    });
    setSubmitted(false);
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setSubmitted(false);
    setForm(EMPTY_FORM);
    setFormMode('create');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;
    if (formMode === 'edit' && selectedFront) updateStrategicFront(selectedFront.id, form);
    else {
      const createdFront = createStrategicFront(form);
      setSelectedFrontId(createdFront.id);
    }
    resetForm();
  };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Frentes estrategicos' }]} />

      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff6d8_0%,#ffffff_54%,#edf4eb_100%)] p-6 md:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>FRENTES ESTRATEGICOS</p>
            <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
              Define prioridades estrategicas gobernables y conecta cada una con cobertura real
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Aqui no solo das de alta un frente. Dejas claro que quiere mover el negocio, con que KPI, desde donde parte, hacia donde va y que tan bien esta cubierto por retos e iniciativas.
            </p>
          </div>
          <button onClick={openCreateForm} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800" style={{ fontWeight: 600 }}>
            <Plus size={16} />
            {createLabel}
          </button>
        </div>

        <PortfolioLeadContextStrip
          items={[
            { label: 'Frente padre visible', value: selectedFront?.name ?? 'Todavia no hay frente seleccionado' },
            { label: 'Reto seleccionado', value: 'Se define despues en Retos' },
            { label: 'Estado de activacion', value: selectedFront ? `${challenges.filter(item => item.strategicFrontId === selectedFront.id && item.visibleToParticipants).length} retos activos` : 'Sin retos activos todavia' },
            { label: 'Iniciativas asociadas', value: selectedFront ? `${initiatives.filter(item => item.strategicFrontId === selectedFront.id).length}` : '0' },
            { label: 'Siguiente accion recomendada', value: selectedFront ? getFrontInsight(selectedFront, challenges, initiatives).nextAction : 'Crear el primer frente estrategico' },
          ]}
        />
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>LECTURA OPERATIVA</p>
            <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Cada frente debe explicar prioridad, cobertura y siguiente paso</h2>
            <p className="mt-2 text-sm text-slate-600">
              Esta pantalla prioriza lectura estrategica con salida accionable. Te muestra que frente sigue solo en definicion y cual ya tiene cobertura visible.
            </p>
          </div>
          <button onClick={() => navigate('/portfolio/inicio')} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50" style={{ fontWeight: 600 }}>
            Volver a Inicio
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Frentes creados" value={summary.total} icon={Flag} hint="Prioridades estrategicas visibles en el portafolio" />
          <SummaryCard label="Frentes activos" value={summary.active} icon={Target} hint="Los que hoy deben gobernarse con seguimiento" />
          <SummaryCard label="Con retos asociados" value={summary.withChallenges} icon={Layers3} hint="Ya bajaron a problemas concretos" />
          <SummaryCard label="Con cobertura visible" value={summary.withCoverage} icon={FileBarChart} hint="Ya muestran una lectura inicial de cobertura" />
        </div>
      </section>

      {isFormOpen ? (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>TAREA ACTUAL</p>
              <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>
                {formMode === 'edit' ? 'Editar frente estrategico' : 'Crear frente estrategico'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Define una prioridad gobernable: que quiere mover el negocio, por que importa ahora, con que KPI se medira y bajo que sponsor quedara sostenida.
              </p>
            </div>
            <button onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50" style={{ fontWeight: 600 }}>
              Cancelar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre del frente" value={form.name} onChange={value => setForm(prev => ({ ...prev, name: value }))} placeholder="Ej. Excelencia operativa transversal" />
              <Field label="Sponsor principal" value={form.sponsor} onChange={value => setForm(prev => ({ ...prev, sponsor: value }))} placeholder="Nombre y area del sponsor" />
              <Field label="KPI principal" value={form.mainKpi} onChange={value => setForm(prev => ({ ...prev, mainKpi: value }))} placeholder="Indicador que quieres mover" />
              <Field label="Horizonte" value={form.horizon} onChange={value => setForm(prev => ({ ...prev, horizon: value }))} placeholder="Ej. Q3 2026 o 6 meses" />
              <Field label="Baseline" value={form.baseline} onChange={value => setForm(prev => ({ ...prev, baseline: value }))} placeholder="Punto de partida actual" />
              <Field label="Meta" value={form.target} onChange={value => setForm(prev => ({ ...prev, target: value }))} placeholder="Resultado esperado" />
            </div>

            <TextAreaField label="Objetivo estrategico" value={form.strategicObjective} onChange={value => setForm(prev => ({ ...prev, strategicObjective: value }))} placeholder="Explica que prioridad del negocio articula este frente y que quiere mover." />
            <TextAreaField label="Por que importa ahora" value={form.whyNow} onChange={value => setForm(prev => ({ ...prev, whyNow: value }))} placeholder="Aclara la urgencia o razon de negocio para atender este frente ahora." />

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Prioridad" value={form.priority} onChange={value => setForm(prev => ({ ...prev, priority: value as StrategicFrontPriority }))} options={PRIORITY_OPTIONS.map(option => ({ value: option, label: option }))} />
              <SelectField label="Estado inicial" value={form.status} onChange={value => setForm(prev => ({ ...prev, status: value as StrategicFrontStatus }))} options={STATUS_OPTIONS.map(option => ({ value: option.value, label: option.label }))} />
            </div>

            {submitted && !canSubmit ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 text-amber-700" />
                  <div className="text-sm text-amber-800">
                    <p style={{ fontWeight: 700 }}>Que falta</p>
                    <p className="mt-1">Completa {missingFields.map(([label]) => label).join(', ')} para definir un frente con base suficiente.</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <InsightCard title="Que define" tone="emerald" text="Una prioridad estrategica con KPI, sponsor, meta y razon de negocio visibles." />
              <InsightCard title="Que habilita" tone="amber" text="Retos multiples bajo el mismo frente, sin perder el hilo estrategico." />
              <InsightCard title="Siguiente paso" tone="slate" text="Despues de guardarlo, toca abrir o revisar los retos que daran cobertura al frente." />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-500">Esta pantalla define el frente, pero no absorbe la gestion detallada de retos ni de iniciativas.</p>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white transition-colors hover:bg-slate-800" style={{ fontWeight: 600 }}>
                <Plus size={16} />
                {formMode === 'edit' ? 'Guardar cambios del frente' : 'Guardar frente estrategico'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.15fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>LISTADO DE FRENTES</p>
              <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Prioridades activas del portafolio</h2>
              <p className="mt-2 text-sm text-slate-600">Cada card comunica estado, hijos, cobertura general y siguiente accion recomendada.</p>
            </div>
            <button onClick={openCreateForm} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50" style={{ fontWeight: 600 }}>
              <Plus size={16} />
              {createLabel}
            </button>
          </div>

          {strategicFronts.length === 0 ? (
            <div className="mt-6">
              <PortfolioLeadEmptyState
                title="Todavia no hay frentes estrategicos"
                description="Empieza creando el primer frente para definir una prioridad con KPI, sponsor, meta y horizonte claros. Esa es la ancla para el resto de la capa Portfolio Lead."
                primaryAction={{ label: createLabel, onClick: openCreateForm }}
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {strategicFronts.map(front => {
                const frontChallenges = challenges.filter(challenge => challenge.strategicFrontId === front.id);
                const frontInitiatives = initiatives.filter(initiative => initiative.strategicFrontId === front.id);
                const insight = getFrontInsight(front, challenges, initiatives);

                return (
                  <article key={front.id} className={`rounded-[28px] border p-5 transition-colors ${selectedFront?.id === front.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button className="max-w-xl text-left" onClick={() => setSelectedFrontId(front.id)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Prioridad {front.priority}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs ${statusClasses(front.status)}`}>{statusLabel(front.status)}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs ${coverageClasses(insight.coverage)}`}>{coverageLabel(insight.coverage)}</span>
                        </div>
                        <h3 className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{front.name}</h3>
                        <p className="mt-2 text-sm text-slate-600">{front.strategicObjective}</p>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedFrontId(front.id)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100" style={{ fontWeight: 600 }}>
                          Ver detalle
                        </button>
                        <button onClick={() => openEditForm(front)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100" style={{ fontWeight: 600 }}>
                          <PenSquare size={14} className="mr-2 inline-flex" />
                          Editar
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <OperationalCard title="Sponsor" value={front.sponsor} />
                      <OperationalCard title="Retos asociados" value={`${frontChallenges.length} reto${frontChallenges.length === 1 ? '' : 's'}`} />
                      <OperationalCard title="Iniciativas asociadas" value={`${frontInitiatives.length} iniciativa${frontInitiatives.length === 1 ? '' : 's'}`} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MetricCard label="KPI principal" value={front.mainKpi} />
                      <MetricCard label="Horizonte" value={front.horizon} />
                      <MetricCard label="Baseline" value={front.baseline} />
                      <MetricCard label="Meta" value={front.target} />
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Siguiente accion recomendada</p>
                      <p className="mt-2 text-sm text-slate-600">{insight.nextAction}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          {selectedFront ? (
            <FrontDetailPanel
              front={selectedFront}
              challenges={challenges.filter(challenge => challenge.strategicFrontId === selectedFront.id)}
              initiatives={initiatives.filter(initiative => initiative.strategicFrontId === selectedFront.id)}
              insight={getFrontInsight(selectedFront, challenges, initiatives)}
              onEdit={() => openEditForm(selectedFront)}
              onOpenChallenges={() => navigate(`/portfolio/retos?frontId=${encodeURIComponent(selectedFront.id)}`)}
              onOpenInitiatives={() => navigate(`/portfolio/iniciativas?frontId=${encodeURIComponent(selectedFront.id)}`)}
              onUpdateStatus={status => updateStrategicFrontStatus(selectedFront.id, status)}
            />
          ) : (
            <PortfolioLeadEmptyState
              title="Selecciona un frente para ver su detalle"
              description="Aqui apareceran su resumen estrategico, los retos asociados, la cobertura visible y el siguiente paso recomendado para mover el portafolio."
              primaryAction={{ label: createLabel, onClick: openCreateForm }}
            />
          )}
        </section>
      </section>
    </div>
  );
}

function FrontDetailPanel({
  front,
  challenges,
  initiatives,
  insight,
  onEdit,
  onOpenChallenges,
  onOpenInitiatives,
  onUpdateStatus,
}: {
  front: StrategicFront;
  challenges: Challenge[];
  initiatives: Initiative[];
  insight: FrontInsight;
  onEdit: () => void;
  onOpenChallenges: () => void;
  onOpenInitiatives: () => void;
  onUpdateStatus: (status: StrategicFrontStatus) => void;
}) {
  const blocked = initiatives.filter(initiative => initiative.status === 'bloqueada').length;
  const readyForDecision = initiatives.filter(initiative => initiative.readyForDecision || initiative.status === 'bloqueada').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>DETALLE DEL FRENTE</p>
          <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{front.name}</h2>
          <p className="mt-2 text-sm text-slate-600">{front.strategicObjective}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onEdit} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50" style={{ fontWeight: 600 }}>
            Editar frente
          </button>
          <button onClick={onOpenChallenges} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800" style={{ fontWeight: 600 }}>
            Ver retos asociados
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>1. RESUMEN ESTRATEGICO</p>
            <p className="mt-2 text-sm text-slate-600">Este frente quiere mover una prioridad concreta del negocio con una lectura visible de resultado, horizonte y sponsor.</p>
          </div>
          <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-white p-3">
            <label className="block text-xs text-slate-500" style={{ fontWeight: 700 }}>Estado</label>
            <select value={front.status} onChange={event => onUpdateStatus(event.target.value as StrategicFrontStatus)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <MetricCard label="Objetivo estrategico" value={front.strategicObjective} />
          <MetricCard label="Por que importa ahora" value={front.whyNow} />
          <MetricCard label="KPI principal" value={front.mainKpi} />
          <MetricCard label="Sponsor principal" value={front.sponsor} />
          <MetricCard label="Baseline" value={front.baseline} />
          <MetricCard label="Meta" value={front.target} />
          <MetricCard label="Horizonte" value={front.horizon} />
          <MetricCard label="Prioridad" value={front.priority} />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>2. RETOS ASOCIADOS</p>
            <p className="mt-2 text-sm text-slate-600">Un frente puede sostener varios retos. Aqui se deja visible cuantos existen y en que estado general se encuentran.</p>
          </div>
          <button onClick={onOpenChallenges} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50" style={{ fontWeight: 600 }}>
            Ir a retos
          </button>
        </div>

        {challenges.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-[#faf8f2] p-4">
            <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Todavia no hay retos asociados</p>
            <p className="mt-2 text-sm text-slate-600">El frente ya existe como prioridad, pero aun no baja a varios problemas concretos que le den cobertura.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {challenges.map(challenge => (
              <div key={challenge.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-xl">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{challengeStatusLabel(challenge.status)}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{challengeTypeLabel(challenge.challengeType)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-900" style={{ fontWeight: 700 }}>{challenge.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{challenge.whatWeWantToMove}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    {challenge.initiativeCount} iniciativa{challenge.initiativeCount === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>3. SEGUIMIENTO Y COBERTURA</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <OperationalCard title="Cobertura general" value={coverageLabel(insight.coverage)} />
          <OperationalCard title="Retos asociados" value={`${challenges.length}`} />
          <OperationalCard title="Iniciativas asociadas" value={`${initiatives.length}`} />
          <OperationalCard title="Casos para decision" value={`${readyForDecision}`} />
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Lectura de cobertura</p>
          <p className="mt-2 text-sm text-amber-800">{insight.nextAction}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-amber-300" style={{ fontWeight: 700 }}>4. REPORTE BREVE DEL FRENTE</p>
            <p className="mt-2 text-sm text-slate-300">{insight.report}</p>
          </div>
          <button onClick={onOpenInitiatives} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white transition-colors hover:bg-white/15" style={{ fontWeight: 600 }}>
            Ver iniciativas del frente
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <DarkMetric label="Estado actual" value={statusLabel(front.status)} />
          <DarkMetric label="Bloqueos visibles" value={`${blocked}`} />
          <DarkMetric label="Siguiente lectura" value={readyForDecision > 0 ? 'Decision proxima' : 'Seguimiento de cobertura'} />
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-800" style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function OperationalCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{title}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function InsightCard({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: 'emerald' | 'amber' | 'slate';
}) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-sm" style={{ fontWeight: 700 }}>{title}</p>
      <p className="mt-2 text-sm opacity-90">{text}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-800">
        <Icon size={18} />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-3xl text-slate-950" style={{ fontWeight: 700 }}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs text-slate-300" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-white" style={{ fontWeight: 700 }}>{value}</p>
    </div>
  );
}
