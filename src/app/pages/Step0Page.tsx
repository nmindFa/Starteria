import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Sparkles, CheckCircle2, Info, Calendar, CreditCard,
  ChevronRight, Download, Bot, Loader2, AlertCircle, FileText, Copy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Step0Data } from '../context/AppContext';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import { MentorVirtualPanel } from '../components/MentorVirtualPanel';
import { MentorSupportModal } from '../components/MentorSupportModal';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';

// ─── Types ───────────────────────────────────────────────────────────────────

type OrigenType = Step0Data['origen'];
type ParteProcesoType = Step0Data['parteProceso'];
type Impacto3mesesType = Step0Data['impacto3meses'];
type RespaldoType = Step0Data['respaldo'];

// ─── Options data ─────────────────────────────────────────────────────────────

const ORIGEN_OPTIONS: { value: Exclude<OrigenType, ''>; label: string }[] = [
  { value: 'problema', label: 'Detecté un problema que quiero resolver' },
  { value: 'oportunidad', label: 'Vi una oportunidad que vale la pena aprovechar' },
  { value: 'idea', label: 'Ya tengo una idea o solución bastante pensada' },
  { value: 'explorando', label: 'Estoy explorando y quiero enfocarlo con más claridad' },
  { value: 'otra', label: 'Otra' },
];

const IMPACTA_OPTIONS = [
  'Clientes externos', 'Operaciones', 'Ventas', 'Postventa',
  'Finanzas', 'TI', 'Gerencias', 'Otros',
];

const PARTE_PROCESO_OPTIONS: { value: Exclude<ParteProcesoType, ''>; label: string }[] = [
  { value: 'antes', label: 'Antes' },
  { value: 'durante', label: 'Durante' },
  { value: 'despues', label: 'Después' },
  { value: 'transversal', label: 'Transversal' },
  { value: 'otra', label: 'Otra' },
];

const IMPACTO_3M_OPTIONS: { value: Exclude<Impacto3mesesType, ''>; label: string }[] = [
  { value: 'ingresos', label: 'Pérdida de ingresos' },
  { value: 'costos', label: 'Costos y reprocesos' },
  { value: 'riesgo', label: 'Riesgo' },
  { value: 'cliente', label: 'Experiencia del cliente' },
  { value: 'productividad', label: 'Productividad y clima' },
  { value: 'no_claro', label: 'Aún no lo tengo claro' },
  { value: 'otro', label: 'Otro' },
];

const RESPALDO_OPTIONS: { value: Exclude<RespaldoType, ''>; label: string }[] = [
  { value: 'datos', label: 'Datos internos' },
  { value: 'testimonios', label: 'Testimonios' },
  { value: 'benchmark', label: 'Referencia externa' },
  { value: 'hipotesis', label: 'Aún es hipótesis' },
  { value: 'otro', label: 'Otro' },
];

const SI_MINIMO_OPTIONS = [
  'Reunión 30 min con el decisor correcto',
  'Asignar Sponsor + Responsable',
  'Acceso a datos',
  'Permiso para piloto 7–10 días',
  'Tiempo de personas clave',
  'Presupuesto pequeño',
  'Otro',
];

// ─── Mock IA feedback (para MentorVirtualPanel) ───────────────────────────────

const MOCK_IA_FEEDBACK = {
  claro: [
    'Describiste el origen de tu iniciativa con claridad.',
    'Identificaste a quién impacta directamente.',
    'El respaldo que tienes da un punto de partida concreto.',
  ],
  faltaPrecisar: [
    'El campo "qué está pasando" puede ser más específico: ¿cuántas personas? ¿con qué frecuencia?',
    'El impacto a 3 meses se puede fortalecer con un número o dato.',
    'No queda claro si el "sí mínimo" ya fue conversado con alguien.',
    '"Quién debería escuchar esto" puede ser más específico (nombre o cargo exacto).',
  ],
  preguntas: [
    '¿Cuántas personas se ven afectadas por semana?',
    '¿Alguien ya intentó resolver esto antes? ¿Qué pasó?',
    '¿El decisor que mencionas tiene autoridad real para aprobar?',
    '¿Tienes acceso a datos para cuantificar el impacto hoy?',
  ],
  siguienteAccion:
    'Agrega un número o dato concreto a tu descripción para darle más fuerza a tu iniciativa.',
};

// ─── Mock IA analysis ─────────────────────────────────────────────────────────

const MOCK_IA_ANALYSIS = {
  enunciado: 'El proceso de incorporación de nuevos empleados se rompe en la etapa de alta en sistemas de TI, causando hasta 10 días de espera sin productividad, porque no existe un tiempo objetivo ni priorización formal para este tipo de solicitudes.',
  impactoPrincipal: 'Productividad y clima laboral — riesgo de rotación temprana si no se aborda en los próximos 3 meses.',
  aquienImpacta: 'Empleados nuevos (incorporación) · TI · Operaciones',
  etapaProceso: 'Durante (proceso de incorporación)',
  respaldoDisponible: 'Datos internos — registros de RRHH con tiempos de incorporación 2024.',
  siMinimo: 'Reunión de 30 min con el decisor correcto + acceso a datos de TI para cuantificar el problema.',
  proximoPaso: 'Documentar el proceso actual en el Módulo A del Paso 1, enfocando en el paso de alta en sistemas de TI.',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Step0Page() {
  const { projectId } = useParams();
  const { projects, updateStep0 } = useApp();
  const navigate = useNavigate();

  const project = projects.find(p => p.id === projectId);

  const [form, setForm] = useState<Step0Data>({
    nombreParticipante: project?.step0Data?.nombreParticipante ?? '',
    rolArea: project?.step0Data?.rolArea ?? '',
    origen: project?.step0Data?.origen ?? '',
    quePasaQueQuieres: project?.step0Data?.quePasaQueQuieres ?? '',
    impacta: project?.step0Data?.impacta ?? [],
    parteProceso: project?.step0Data?.parteProceso ?? '',
    impacto3meses: project?.step0Data?.impacto3meses ?? '',
    respaldo: project?.step0Data?.respaldo ?? '',
    quienEscuchar: project?.step0Data?.quienEscuchar ?? '',
    siMinimo: project?.step0Data?.siMinimo ?? [],
  });

  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [iaAnalysisState, setIaAnalysisState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [copyMsg, setCopyMsg] = useState(false);

  const saveState = useAutosave([form]);

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Proyecto no encontrado.</p>
        <button onClick={() => navigate('/dashboard')} className="text-indigo-600 text-sm mt-2">
          ← Volver al inicio
        </button>
      </div>
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleMulti = (field: 'impacta' | 'siMinimo', val: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(val)
        ? (prev[field] as string[]).filter(v => v !== val)
        : [...(prev[field] as string[]), val],
    }));
  };

  const openIA = () => {
    setShowIAPanel(true);
    setIaLoading(true);
    setTimeout(() => setIaLoading(false), 1500);
  };

  const canSave =
    !!form.nombreParticipante.trim() &&
    !!form.rolArea.trim() &&
    !!form.origen &&
    !!form.quePasaQueQuieres.trim();

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    updateStep0(project.id, form, 'Completado');
    setSaving(false);
    setSaved(true);
    setTimeout(() => navigate(`/projects/${project.id}`), 600);
  };

  // ── IA Analysis helpers ────────────────────────────────────────────────────

  const getMissingForAnalysis = () => {
    const missing: { label: string }[] = [];
    if (!form.quePasaQueQuieres.trim()) missing.push({ label: 'Qué está pasando (Sección 3)' });
    if (form.impacta.length === 0) missing.push({ label: 'A quién impacta (Sección 4)' });
    if (!form.parteProceso) missing.push({ label: 'Parte del proceso (Sección 5)' });
    if (!form.impacto3meses) missing.push({ label: 'Impacto a 3 meses (Sección 6)' });
    if (!form.respaldo) missing.push({ label: 'Respaldo disponible (Sección 7)' });
    return missing;
  };

  const handleGenerarAnalisis = () => {
    const missing = getMissingForAnalysis();
    if (missing.length > 0) return; // guarded by button state
    setIaAnalysisState('loading');
    setTimeout(() => setIaAnalysisState('done'), 2200);
  };

  const handleDescargarPDF = () => {
    // Simulación de descarga PDF
    const lines = [
      'STARTERÍA — Análisis de Punto de Partida',
      `Proyecto: ${project?.name}`,
      `Participante: ${form.nombreParticipante} · ${form.rolArea}`,
      '---',
      `Enunciado del reto: ${MOCK_IA_ANALYSIS.enunciado}`,
      `Impacto principal: ${MOCK_IA_ANALYSIS.impactoPrincipal}`,
      `A quién impacta: ${MOCK_IA_ANALYSIS.aquienImpacta}`,
      `Etapa: ${MOCK_IA_ANALYSIS.etapaProceso}`,
      `Respaldo: ${MOCK_IA_ANALYSIS.respaldoDisponible}`,
      `Sí mínimo: ${MOCK_IA_ANALYSIS.siMinimo}`,
      `Próximo paso: ${MOCK_IA_ANALYSIS.proximoPaso}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Starteria_PuntodePartida_${project?.name ?? 'analisis'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAnalisis = () => {
    const text = [
      `Reto: ${MOCK_IA_ANALYSIS.enunciado}`,
      `Impacto: ${MOCK_IA_ANALYSIS.impactoPrincipal}`,
      `A quién: ${MOCK_IA_ANALYSIS.aquienImpacta}`,
      `Etapa: ${MOCK_IA_ANALYSIS.etapaProceso}`,
      `Respaldo: ${MOCK_IA_ANALYSIS.respaldoDisponible}`,
      `Sí mínimo: ${MOCK_IA_ANALYSIS.siMinimo}`,
      `Próximo paso: ${MOCK_IA_ANALYSIS.proximoPaso}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopyMsg(true);
    setTimeout(() => setCopyMsg(false), 2000);
  };

  // ── Progress calc ──────────────────────────────────────────────────────────

  const filledCount = [
    form.nombreParticipante,
    form.rolArea,
    form.origen,
    form.quePasaQueQuieres,
    form.impacta.length > 0,
    form.parteProceso,
    form.impacto3meses,
    form.respaldo,
  ].filter(Boolean).length;

  const progress = Math.round((filledCount / 8) * 100);

  // ─── Ficha data ─────────────────────────────────────────────────────────────

  const fichaRows = [
    { label: 'Nombre', value: form.nombreParticipante || '—' },
    { label: 'Rol / Área', value: form.rolArea || '—' },
    {
      label: 'Origen',
      value: ORIGEN_OPTIONS.find(o => o.value === form.origen)?.label || '—',
    },
    {
      label: 'Qué está pasando',
      value: form.quePasaQueQuieres
        ? form.quePasaQueQuieres.length > 90
          ? form.quePasaQueQuieres.slice(0, 90) + '…'
          : form.quePasaQueQuieres
        : '—',
    },
    { label: 'Impacta a', value: form.impacta.length > 0 ? form.impacta.join(', ') : '—' },
    {
      label: 'Parte del proceso',
      value: PARTE_PROCESO_OPTIONS.find(o => o.value === form.parteProceso)?.label || '—',
    },
    {
      label: 'Impacto a 3 meses',
      value: IMPACTO_3M_OPTIONS.find(o => o.value === form.impacto3meses)?.label || '—',
    },
    {
      label: 'Respaldo disponible',
      value: RESPALDO_OPTIONS.find(o => o.value === form.respaldo)?.label || '—',
    },
    {
      label: 'Sí mínimo',
      value:
        form.siMinimo.length > 0
          ? form.siMinimo[0] + (form.siMinimo.length > 1 ? ` +${form.siMinimo.length - 1} más` : '')
          : '—',
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Scrollable area ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Page header */}
        <div className="px-6 pt-6 pb-5 bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => navigate(`/projects/${project.id}`)}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-4 transition-colors"
            >
              <ArrowLeft size={14} /> Volver al proyecto
            </button>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700"
                    style={{ fontWeight: 600 }}
                  >
                    PASO 0
                  </span>
                  <span className="text-xs text-slate-400">{progress}% completado</span>
                </div>
                <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>
                  Punto de partida
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Aterriza tu iniciativa en 5–7 minutos. Esto te ayuda a conseguir respaldo y avanzar.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowMentorModal(true)}
                  className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm transition-colors"
                >
                  <Calendar size={14} /> Pedir ayuda a un mentor
                </button>
                <AutosaveIndicator state={saveState} />
              </div>
            </div>
          </div>
        </div>

        {/* 2-column content */}
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex gap-6 items-start">

            {/* ── LEFT: Form ─────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-0">

              {/* ─── Sección 1 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 1 — Quién eres
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Esto ayuda a tu mentor a darte acompañamiento más preciso.
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                    Nombre completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.nombreParticipante}
                    onChange={e => setForm(p => ({ ...p, nombreParticipante: e.target.value }))}
                    placeholder="Tu nombre completo"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                    Rol y área <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.rolArea}
                    onChange={e => setForm(p => ({ ...p, rolArea: e.target.value }))}
                    placeholder="Ej. Gerente de Operaciones · Logística"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 2 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 2 — Origen de la iniciativa
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ¿Desde dónde nace tu iniciativa hoy?
                  </p>
                </div>
                <div className="space-y-2">
                  {ORIGEN_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(p => ({ ...p, origen: opt.value }))}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                        form.origen === opt.value
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                          form.origen === opt.value ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                        }`}
                      >
                        {form.origen === opt.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 3 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 3 — Qué está pasando
                  </h2>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                    Cuéntanos qué está pasando o qué quieres lograr (en simple){' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.quePasaQueQuieres}
                    onChange={e => setForm(p => ({ ...p, quePasaQueQuieres: e.target.value }))}
                    rows={4}
                    placeholder="Ej. Nuestro proceso de cierre mensual toma 10 días y debería tomar 3. Eso genera retrasos en reportes que el directorio necesita para tomar decisiones."
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                  />
                  <button
                    onClick={openIA}
                    className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Sparkles size={12} /> Mejorar claridad con IA
                  </button>
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 4 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 4 — A quién impacta
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ¿A quién impacta directamente? Puedes elegir más de uno.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {IMPACTA_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleMulti('impacta', opt)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-all ${
                        form.impacta.includes(opt)
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                      style={{ fontWeight: form.impacta.includes(opt) ? 600 : 400 }}
                    >
                      {form.impacta.includes(opt) && <CheckCircle2 size={12} className="text-indigo-500" />}
                      {opt}
                    </button>
                  ))}
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 5 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 5 — Parte del proceso
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ¿En qué parte del proceso se manifiesta principalmente?
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PARTE_PROCESO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(p => ({ ...p, parteProceso: opt.value }))}
                      className={`px-3 py-2.5 rounded-xl border text-sm transition-all ${
                        form.parteProceso === opt.value
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                      style={{ fontWeight: form.parteProceso === opt.value ? 600 : 400 }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.parteProceso === 'transversal' && (
                  <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Luego te ayudaremos a elegir una etapa principal para poder pilotear.
                    </p>
                  </div>
                )}
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 6 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 6 — Impacto a 3 meses
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Si esto no se aborda en los próximos 3 meses, ¿cuál sería el impacto más importante?
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {IMPACTO_3M_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(p => ({ ...p, impacto3meses: opt.value }))}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                        form.impacto3meses === opt.value
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex-none ${
                          form.impacto3meses === opt.value
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-slate-300'
                        }`}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 7 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 7 — Respaldo disponible
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ¿Con qué respaldo cuentas hoy?
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RESPALDO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(p => ({ ...p, respaldo: opt.value }))}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                        form.respaldo === opt.value
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex-none ${
                          form.respaldo === opt.value
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-slate-300'
                        }`}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 8 ─── */}
              <section className="space-y-4 pb-4">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Sección 8 — Alineación mínima para empezar
                  </h2>
                  <p className="text-xs text-indigo-600 mt-0.5" style={{ fontWeight: 500 }}>
                    Este es el paso más crítico. Sin respaldo, tu iniciativa no avanza.
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                    ¿Quién debería escuchar esto primero y por qué?
                  </label>
                  <textarea
                    value={form.quienEscuchar}
                    onChange={e => setForm(p => ({ ...p, quienEscuchar: e.target.value }))}
                    rows={2}
                    placeholder="Ej. La Gerente de Operaciones, porque aprueba cambios que afectan a más de un área."
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 500 }}>
                    ¿Cuál es el "sí mínimo" que necesitas para empezar?{' '}
                    <span className="text-slate-400 text-xs">(Puedes elegir más de uno)</span>
                  </label>
                  <div className="space-y-2">
                    {SI_MINIMO_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => toggleMulti('siMinimo', opt)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm text-left transition-all ${
                          form.siMinimo.includes(opt)
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                            form.siMinimo.includes(opt)
                              ? 'border-indigo-500 bg-indigo-500'
                              : 'border-slate-300'
                          }`}
                        >
                          {form.siMinimo.includes(opt) && (
                            <span className="text-white" style={{ fontSize: '10px' }}>✓</span>
                          )}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-600">
                      <span style={{ fontWeight: 600 }}>¿Por qué importa esto?</span>{' '}
                      Si no tienes este "sí mínimo", tu iniciativa probablemente no avance.
                      Este paso busca asegurar el primer respaldo real.
                    </p>
                  </div>
                </div>

                <BannerPorDefinir
                  title="Gating del Paso 0"
                  question="¿Cuáles campos son obligatorios para marcar el Paso 0 como Completado y habilitar el Paso 1? ¿Se requieren todas las secciones o solo las marcadas con (*)?"
                  context="pending"
                />

                {/* ─── Divider ─── */}
                <div className="h-px bg-slate-100 my-8" />

                {/* ─── ANÁLISIS POR IA EXPERTA ─── */}
                <section className="space-y-4 pb-6">
                  <div className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-indigo-100 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                        <Bot size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>
                            Análisis por IA experta
                          </h2>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>
                            Intraemprendimiento
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Una IA con experiencia en iniciativas internas resume tu punto de partida y te sugiere cómo avanzar.
                        </p>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Estado: idle */}
                      {iaAnalysisState === 'idle' && (() => {
                        const missing = getMissingForAnalysis();
                        return (
                          <div className="space-y-4">
                            {missing.length > 0 ? (
                              <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs text-amber-800 mb-1.5" style={{ fontWeight: 600 }}>
                                    Te falta completar {missing.length} {missing.length === 1 ? 'campo' : 'campos'} para generar el análisis:
                                  </p>
                                  <ul className="space-y-0.5">
                                    {missing.map((m, i) => (
                                      <li key={i} className="text-xs text-amber-700">· {m.label}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2.5 p-3.5 bg-slate-100 border border-slate-200 rounded-xl">
                                <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-500">
                                  Aún no tienes un análisis. Genera uno para descargarlo o compartirlo con tu líder o sponsor.
                                </p>
                              </div>
                            )}

                            <div className="flex items-center gap-3 flex-wrap">
                              <button
                                onClick={handleGenerarAnalisis}
                                disabled={getMissingForAnalysis().length > 0}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
                                style={{ fontWeight: 500 }}
                              >
                                <Sparkles size={14} /> Generar análisis
                              </button>

                              <div className="relative group">
                                <button
                                  disabled
                                  className="flex items-center gap-2 border border-slate-200 text-slate-400 bg-white cursor-not-allowed px-4 py-2.5 rounded-xl text-sm"
                                  style={{ fontWeight: 500 }}
                                >
                                  <Download size={14} /> Descargar PDF
                                </button>
                                <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block">
                                  <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
                                    Primero genera el análisis
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Estado: loading */}
                      {iaAnalysisState === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <Loader2 size={28} className="text-indigo-500 animate-spin" />
                          <p className="text-sm text-slate-600" style={{ fontWeight: 500 }}>Analizando…</p>
                          <p className="text-xs text-slate-400">Revisando tu punto de partida con criterios de intraemprendimiento</p>
                        </div>
                      )}

                      {/* Estado: done */}
                      {iaAnalysisState === 'done' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-500" />
                            <p className="text-xs text-emerald-700" style={{ fontWeight: 600 }}>Análisis generado</p>
                            <span className="text-xs text-slate-400">· La IA revisó tu punto de partida</span>
                          </div>

                          {/* Bullets del análisis */}
                          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                            {[
                              { label: 'Enunciado claro del reto', value: MOCK_IA_ANALYSIS.enunciado },
                              { label: 'Impacto principal (3 meses)', value: MOCK_IA_ANALYSIS.impactoPrincipal },
                              { label: 'A quién impacta · Etapa', value: `${MOCK_IA_ANALYSIS.aquienImpacta} · ${MOCK_IA_ANALYSIS.etapaProceso}` },
                              { label: 'Respaldo disponible', value: MOCK_IA_ANALYSIS.respaldoDisponible },
                              { label: '"Sí mínimo" recomendado', value: MOCK_IA_ANALYSIS.siMinimo },
                              { label: 'Próximo paso recomendado', value: MOCK_IA_ANALYSIS.proximoPaso },
                            ].map((item, i) => (
                              <div key={i} className="px-4 py-3">
                                <p className="text-xs text-slate-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                                  {item.label.toUpperCase()}
                                </p>
                                <p className="text-xs text-slate-700">{item.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Botones de acción */}
                          <div className="flex items-center gap-3 flex-wrap pt-1">
                            <button
                              onClick={handleDescargarPDF}
                              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              <Download size={14} /> Descargar PDF
                            </button>
                            <button
                              onClick={handleCopyAnalisis}
                              className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 bg-white px-4 py-2.5 rounded-xl text-sm transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              <Copy size={14} /> {copyMsg ? '¡Copiado!' : 'Copiar resumen'}
                            </button>
                            <button
                              onClick={handleGenerarAnalisis}
                              className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              <Sparkles size={12} /> Regenerar
                            </button>
                          </div>

                          {/* Nota de confianza */}
                          <div className="flex items-start gap-2 pt-1">
                            <Info size={12} className="text-slate-300 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-400">
                              La IA te ayuda a ordenar ideas. La validación final la hace un mentor.
                            </p>
                          </div>

                          {/* Microcopy para compartir */}
                          <p className="text-xs text-indigo-500" style={{ fontWeight: 500 }}>
                            💡 Descarga el resumen para compartir con tu líder o sponsor antes de la conversación.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

              </section>
            </div>

            {/* ── RIGHT: Tu ficha inicial ─────────────────────────────────── */}
            <div className="hidden lg:block w-72 shrink-0">
              <div className="sticky top-4 space-y-3">

                {/* Ficha card */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-indigo-600 px-4 py-3.5">
                    <p className="text-xs text-indigo-300" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>
                      TU FICHA INICIAL
                    </p>
                    <p className="text-white text-sm mt-0.5" style={{ fontWeight: 600 }}>
                      {project.name}
                    </p>
                  </div>

                  <div className="p-4 space-y-3">
                    {fichaRows.map((row, i) => (
                      <div key={i}>
                        <p className="text-xs text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.03em' }}>
                          {row.label.toUpperCase()}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            row.value === '—' ? 'text-slate-300 italic' : 'text-slate-700'
                          }`}
                        >
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="px-4 pb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-xs text-slate-400">Completado</p>
                      <p className="text-xs text-indigo-600" style={{ fontWeight: 600 }}>{progress}%</p>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Próximo paso sugerido */}
                {progress >= 50 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 600 }}>
                      Próximo paso sugerido
                    </p>
                    <p className="text-xs text-emerald-600">
                      Agenda una conversación de 30 min con la persona que mencionaste. Lleva esta ficha como agenda.
                    </p>
                  </div>
                )}

                {/* Mejorar con IA */}
                <button
                  onClick={openIA}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-violet-50 border border-violet-100 rounded-xl hover:bg-violet-100 transition-colors"
                >
                  <Sparkles size={14} className="text-violet-500 shrink-0" />
                  <div className="text-left">
                    <p className="text-xs text-violet-700" style={{ fontWeight: 500 }}>
                      Mejorar claridad con IA
                    </p>
                    <p className="text-xs text-violet-400">Recibe sugerencias personalizadas</p>
                  </div>
                </button>

                {/* Ver ejemplo */}
                <button className="w-full text-xs text-slate-400 hover:text-slate-600 text-center py-1.5 transition-colors">
                  Ver ejemplo completo →
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="border-t border-slate-200 bg-white px-6 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={!canSave || saving || saved}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm transition-colors"
            style={{ fontWeight: 500 }}
          >
            {saved ? (
              <><CheckCircle2 size={14} /> Guardado</>
            ) : saving ? (
              'Guardando…'
            ) : (
              <>Guardar y continuar <ChevronRight size={14} /></>
            )}
          </button>

          <button
            onClick={openIA}
            className="flex items-center gap-2 border border-violet-200 text-violet-600 hover:bg-violet-50 px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Sparkles size={14} /> Mejorar claridad con IA
          </button>

          <button className="text-sm text-slate-400 hover:text-slate-600 px-3 py-2.5 transition-colors">
            Ver ejemplo
          </button>

          <div className="ml-auto hidden sm:flex items-center gap-3">
            {project.mentorCredits !== undefined && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <CreditCard size={12} />
                <span>{project.mentorCredits} créditos disponibles</span>
              </div>
            )}
            <AutosaveIndicator state={saveState} />
          </div>
        </div>
      </div>

      {/* ── Panels ── */}
      <MentorVirtualPanel
        open={showIAPanel}
        onClose={() => setShowIAPanel(false)}
        context="Paso 0 · Punto de partida"
        feedback={MOCK_IA_FEEDBACK}
        loading={iaLoading}
      />

      {showMentorModal && (
        <MentorSupportModal
          onClose={() => setShowMentorModal(false)}
          context="Paso 0 · Punto de partida"
          mentorCredits={project.mentorCredits ?? 3}
          onOpenIA={() => { setShowMentorModal(false); openIA(); }}
        />
      )}
    </div>
  );
}