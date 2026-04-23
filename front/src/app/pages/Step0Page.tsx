import React, { useState, useMemo } from 'react';
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
  { value: 'antes', label: 'Antes de iniciar el proceso' },
  { value: 'durante', label: 'Durante la operación o ejecución' },
  { value: 'despues', label: 'En el seguimiento o cierre' },
  { value: 'transversal', label: 'Se siente de forma transversal' },
  { value: 'otra', label: 'En la coordinación entre áreas o atención' },
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
  { value: 'benchmark', label: 'Benchmark o referencias externas' },
  { value: 'hipotesis', label: 'Aún es una hipótesis y necesito validarla' },
  { value: 'otro', label: 'Otro' },
];

const SI_MINIMO_OPTIONS = [
  'Reunión de 30 min con la persona correcta',
  'Asignar sponsor o responsable',
  'Acceso a datos',
  'Permiso para un piloto corto',
  'Tiempo de personas clave',
  'Presupuesto pequeño',
  'Otro',
];

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

  const analysisPreview = useMemo(() => ({
    enunciado: form.quePasaQueQuieres || '',
    impactoPrincipal: IMPACTO_3M_OPTIONS.find(o => o.value === form.impacto3meses)?.label || '',
    aquienImpacta: form.impacta?.join(' · ') || '',
    etapaProceso: PARTE_PROCESO_OPTIONS.find(o => o.value === form.parteProceso)?.label || '',
    respaldoDisponible: RESPALDO_OPTIONS.find(o => o.value === form.respaldo)?.label || '',
    siMinimo: form.siMinimo?.join(', ') || '',
    proximoPaso: form.quienEscuchar || '',
  }), [form]);

  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [iaAnalysisState, setIaAnalysisState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [copyMsg, setCopyMsg] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState('');

  const saveState = useAutosave([form]);
  const firstName = form.nombreParticipante.trim().split(/\s+/)[0];

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
    if (!form.quePasaQueQuieres.trim()) missing.push({ label: 'Qué está pasando (Sección 4)' });
    if (form.impacta.length === 0) missing.push({ label: 'A quién impacta (Sección 5)' });
    if (!form.parteProceso) missing.push({ label: 'Dónde se nota más el reto (Sección 6)' });
    if (!form.impacto3meses) missing.push({ label: 'Impacto principal a 3 meses (Sección 7)' });
    if (!form.respaldo) missing.push({ label: 'Respaldo actual (Sección 8)' });
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
      'STARTERÍA — Resumen inicial de la iniciativa',
      `Proyecto: ${project?.name}`,
      `Participante: ${form.nombreParticipante} · ${form.rolArea}`,
      '---',
      `Enunciado del reto: ${analysisPreview.enunciado}`,
      `Impacto principal: ${analysisPreview.impactoPrincipal}`,
      `A quién impacta: ${analysisPreview.aquienImpacta}`,
      `Etapa: ${analysisPreview.etapaProceso}`,
      `Respaldo: ${analysisPreview.respaldoDisponible}`,
      `Sí mínimo: ${analysisPreview.siMinimo}`,
      `Próximo paso: ${analysisPreview.proximoPaso}`,
    ];
    const blob = new Blob([lines.filter(line => !line.endsWith(': ')).join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Starteria_PuntodePartida_${project?.name ?? 'analisis'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAnalisis = () => {
    const text = [
      `Reto: ${analysisPreview.enunciado}`,
      `Impacto: ${analysisPreview.impactoPrincipal}`,
      `A quién: ${analysisPreview.aquienImpacta}`,
      `Etapa: ${analysisPreview.etapaProceso}`,
      `Respaldo: ${analysisPreview.respaldoDisponible}`,
      `Sí mínimo: ${analysisPreview.siMinimo}`,
      `Próximo paso: ${analysisPreview.proximoPaso}`,
    ].filter(line => !line.endsWith(': ')).join('\n');
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

  const previewBlocks = [
    {
      title: 'Quién impulsa esta iniciativa',
      value:
        form.nombreParticipante || form.rolArea
          ? [form.nombreParticipante, form.rolArea].filter(Boolean).join(' · ')
          : 'Completa tu nombre y rol para personalizar esta ficha.',
      filled: !!form.nombreParticipante.trim() && !!form.rolArea.trim(),
    },
    {
      title: 'Qué está pasando',
      value: form.quePasaQueQuieres || 'Describe con tus palabras qué está pasando o qué quieres lograr.',
      filled: !!form.quePasaQueQuieres.trim(),
    },
    {
      title: 'A quién impacta',
      value: form.impacta.length > 0 ? form.impacta.join(', ') : 'Marca los grupos que hoy sienten este reto más directamente.',
      filled: form.impacta.length > 0,
    },
    {
      title: 'Qué pasa si no se mueve',
      value: IMPACTO_3M_OPTIONS.find(o => o.value === form.impacto3meses)?.label || 'Define el impacto principal de no abordarlo en los próximos 3 meses.',
      filled: !!form.impacto3meses,
    },
    {
      title: 'Qué respaldo existe',
      value: RESPALDO_OPTIONS.find(o => o.value === form.respaldo)?.label || 'Indica qué sustento tienes hoy para mover esta conversación.',
      filled: !!form.respaldo,
    },
    {
      title: 'Qué apoyo mínimo se necesita',
      value:
        form.siMinimo.length > 0
          ? form.siMinimo.join(', ')
          : 'Identifica el primer destrabe real que te permitiría mover la propuesta.',
      filled: form.siMinimo.length > 0,
    },
  ];

  const previewCompletedCount = previewBlocks.filter(block => block.filled).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Scrollable area ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Page header */}
        <div className="px-5 pt-6 pb-5 bg-white border-b border-slate-100 min-[1440px]:px-6 min-[1680px]:px-8">
          <div className="mx-auto w-full max-w-[1380px] min-[1440px]:max-w-[1480px] min-[1680px]:max-w-[1560px]">
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
                <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                  Ordena lo que ya sabes sobre esta iniciativa para construir una primera base clara, compartible y con sentido para avanzar.
                </p>
                <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                  No necesitas tener todas las respuestas. Este paso te ayudará a darle forma inicial a tu propuesta y a preparar una mejor conversación con quien pueda respaldarla.
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
        <div className="mx-auto w-full max-w-[1380px] px-5 py-6 min-[1440px]:max-w-[1480px] min-[1440px]:px-6 min-[1680px]:max-w-[1560px] min-[1680px]:px-8">
          <div className="grid items-start gap-6 min-[1280px]:grid-cols-[minmax(0,880px)_300px] min-[1440px]:grid-cols-[minmax(0,920px)_320px] min-[1680px]:grid-cols-[minmax(0,980px)_340px] min-[1680px]:gap-8">

            {/* ── LEFT: Form ─────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-0">

              {/* ─── Sección 1 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Antes de empezar, ¿cómo te llamas?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Usaremos tu nombre para personalizar esta ficha y el resumen de salida.
                  </p>
                </div>
                <input
                  value={form.nombreParticipante}
                  onChange={e => setForm(p => ({ ...p, nombreParticipante: e.target.value }))}
                  placeholder="Tu nombre completo"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 2 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    {firstName ? `Hola, ${firstName}. ¿Desde qué rol y área nos escribes?` : 'Hola. ¿Desde qué rol y área nos escribes?'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Esto ayuda a entender desde qué parte de la empresa estás viendo esta iniciativa.
                  </p>
                </div>
                <input
                  value={form.rolArea}
                  onChange={e => setForm(p => ({ ...p, rolArea: e.target.value }))}
                  placeholder="Ej. Ejecutivo comercial / Ventas"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 3 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    {firstName ? `Genial, ${firstName}. Para ubicarnos: ¿desde dónde nace tu iniciativa hoy?` : 'Para ubicarnos: ¿desde dónde nace tu iniciativa hoy?'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    No define tu proyecto para siempre. Solo nos ayuda a entender desde qué punto partes hoy.
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

              {/* ─── Sección 4 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Cuéntamelo con tus palabras: ¿qué está pasando o qué quieres lograr?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    No necesitas redactarlo perfecto. Escribe lo que hoy sabes.
                  </p>
                </div>
                <div>
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

              {/* ─── Sección 5 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    ¿A quién impacta más directamente este reto?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Elige hasta 3 grupos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {IMPACTA_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        if (!form.impacta.includes(opt) && form.impacta.length >= 3) return;
                        toggleMulti('impacta', opt);
                      }}
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

              {/* ─── Sección 6 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    ¿En qué momento se nota más este reto?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Más adelante, en el Paso 1, vas a profundizar mejor el proceso. Aquí solo queremos una primera ubicación.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PARTE_PROCESO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(p => ({ ...p, parteProceso: opt.value }))}
                      className={`px-3 py-3 rounded-xl border text-sm text-left transition-all ${
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
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 7 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Si esto no se aborda en los próximos 3 meses, ¿cuál sería el impacto más importante?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Elige el impacto principal, aunque hoy sea una estimación.
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

              {/* ─── Sección 8 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Para moverlo con criterio: ¿qué respaldo tienes hoy?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Elige el respaldo más claro que ya tienes hoy.
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

              {/* ─── Sección 9 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Para que esto avance y no se quede solo en una idea: ¿quién debería escuchar o saber de esto? ¿Y por qué?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ej. Gerente de Operaciones, porque puede habilitar un piloto con dos áreas.
                  </p>
                </div>
                <textarea
                  value={form.quienEscuchar}
                  onChange={e => setForm(p => ({ ...p, quienEscuchar: e.target.value }))}
                  rows={2}
                  placeholder="Ej. La líder de Operaciones, porque puede priorizar el piloto y ayudar a destrabar la coordinación con otras áreas."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                />
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <p className="text-xs text-indigo-700">
                    Una iniciativa interna gana fuerza cuando una persona clave entiende el problema, ve su impacto y ayuda a destrabar el siguiente paso.
                  </p>
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 10 ─── */}
              <section className="space-y-4 pb-8">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    ¿Cuál es el “sí” mínimo que necesitas para mover esta propuesta?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Piensa en el primer destrabe real, no en todo lo ideal.
                  </p>
                </div>
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
                    Este paso busca asegurar el primer respaldo real para que tu iniciativa no se quede solo en una buena intención.
                  </p>
                </div>
              </section>

              <div className="h-px bg-slate-100 mb-8" />

              {/* ─── Sección 11 ─── */}
              <section className="space-y-4 pb-4">
                <div>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    ¿A qué correo te envío el one-pager listo para presentar?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Te enviaremos un resumen claro con lo que acabas de construir para que puedas revisarlo o compartirlo.
                  </p>
                </div>
                <input
                  type="email"
                  value={deliveryEmail}
                  onChange={e => setDeliveryEmail(e.target.value)}
                  placeholder="tu.correo@empresa.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />

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
                            Base inicial para conversar con sponsor o líder
                          </h2>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>
                            Intraemprendimiento
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Aquí vas a convertir lo que escribiste en una base corta, clara y útil para compartir o seguir refinando.
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
                                    Completa {missing.length} {missing.length === 1 ? 'campo' : 'campos'} más para generar una primera base clara:
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
                                  Cuando completes lo mínimo, podrás generar un resumen breve para revisarlo o compartirlo con quien pueda respaldar esta iniciativa.
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
                                <Sparkles size={14} /> Generar resumen inicial
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
                          <p className="text-sm text-slate-600" style={{ fontWeight: 500 }}>Ordenando tu base inicial…</p>
                          <p className="text-xs text-slate-400">Revisando tu punto de partida con criterios de intraemprendimiento</p>
                        </div>
                      )}

                      {/* Estado: done */}
                      {iaAnalysisState === 'done' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-500" />
                            <p className="text-xs text-emerald-700" style={{ fontWeight: 600 }}>Resumen inicial listo</p>
                            <span className="text-xs text-slate-400">· Ya tienes una base clara para conversar</span>
                          </div>

                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                            <p className="text-sm text-emerald-900" style={{ fontWeight: 600 }}>
                              Esta iniciativa ya tiene una base clara para abrir conversación con sponsor, líder o mentor.
                            </p>
                            <p className="text-xs text-emerald-700 mt-1">
                              No está perfecta ni cerrada, pero sí lo suficientemente aterrizada para sostener una conversación útil y avanzar con mejor criterio.
                            </p>
                          </div>

                          {/* Bullets del análisis */}
                          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                            {[
                              { label: 'Enunciado claro del reto', value: analysisPreview.enunciado },
                              { label: 'Impacto principal (3 meses)', value: analysisPreview.impactoPrincipal },
                              { label: 'A quién impacta · Etapa', value: `${analysisPreview.aquienImpacta} · ${analysisPreview.etapaProceso}` },
                              { label: 'Respaldo disponible', value: analysisPreview.respaldoDisponible },
                              { label: '"Sí mínimo" recomendado', value: analysisPreview.siMinimo },
                              { label: 'Próximo paso recomendado', value: analysisPreview.proximoPaso },
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
                              <Download size={14} /> Descargar resumen
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
                              La IA te ayuda a ordenar lo que ya sabes. La validación final la hacen las conversaciones y el trabajo posterior.
                            </p>
                          </div>

                          {/* Microcopy para compartir */}
                          <p className="text-xs text-indigo-500" style={{ fontWeight: 500 }}>
                            Usa este resumen como primer one-pager para compartir el contexto con sponsor o liderazgo.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

              </section>
            </div>

            {/* ── RIGHT: Tu ficha inicial ─────────────────────────────────── */}
            <div className="hidden min-[1280px]:block min-w-0">
              <div className="sticky top-4 space-y-3">

                {/* Preview card */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-indigo-600 px-4 py-3.5">
                    <p className="text-xs text-indigo-300" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>
                      PREVIEW DEL RESUMEN
                    </p>
                    <p className="text-white text-sm mt-0.5" style={{ fontWeight: 600 }}>
                      {project.name}
                    </p>
                  </div>

                  <div className="p-4 space-y-3">
                    {previewBlocks.map((row, i) => (
                      <div key={i}>
                        <p className="text-xs text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.03em' }}>
                          {row.title.toUpperCase()}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            row.filled ? 'text-slate-700' : 'text-slate-400'
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
                      <p className="text-xs text-slate-400">Bloques completos</p>
                      <p className="text-xs text-indigo-600" style={{ fontWeight: 600 }}>{previewCompletedCount}/6</p>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${(previewCompletedCount / 6) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Próximo paso sugerido */}
                {previewCompletedCount >= 3 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 600 }}>
                      Ya tienes una base conversable
                    </p>
                    <p className="text-xs text-emerald-600">
                      Ya puedes usar esta ficha para conversar con sponsor, líder o mentor con más claridad y criterio.
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
      <div className="border-t border-slate-200 bg-white px-5 py-4 shrink-0 min-[1440px]:px-6 min-[1680px]:px-8">
        <div className="mx-auto flex w-full max-w-[1380px] items-center gap-3 flex-wrap min-[1440px]:max-w-[1480px] min-[1680px]:max-w-[1560px]">
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
