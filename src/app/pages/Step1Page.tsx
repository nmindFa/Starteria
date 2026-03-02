import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, CheckCircle2, Lock, Send, Calendar, ChevronRight,
  AlertTriangle, Sparkles, Plus, X, AlertCircle, ChevronDown,
  MessageSquare, Copy, Target, FileText, ExternalLink, Info,
  Users, Trash2, BarChart2, HelpCircle, TrendingUp, Upload,
} from 'lucide-react';
import { MentorSupportModal } from '../components/MentorSupportModal';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { EvidenceUploader } from '../components/EvidenceUploader';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';

type ModuleId = 'A' | 'B' | 'C' | 'D' | 'S';

interface CardRetoData {
  retoFrase: string;
  alcanceEtapa: 'antes' | 'durante' | 'después' | '';
  alcanceLimites: string;
  senalObservable: string;
  evidenciaTexto: string;
}

interface ModuleASISData {
  casoReal: string;
  pasos: string[];
  quiebreIndex: number | null;
  quiebreDetalle: string;
  quiebre: string;
  consecuencia: string;
  causaInmediata: string;
  evidenciaTipo: '' | 'dato' | 'ticket' | 'testimonio' | 'benchmark';
  evidenciaNota: string;
  alcance: '' | 'antes' | 'durante' | 'después' | 'transversal';
  corteAlcance: string;
}

interface PreparacionEntrevistasData {
  conLider: '' | 'prioridad' | 'impacto' | 'alcance';
  conAfectados: '' | 'paso_exacto' | 'parches' | 'frecuencia';
}

interface MetricaB {
  id: string;
  nombre: string;
  tipo: '' | 'tiempo' | 'cantidad' | 'costo' | 'calidad' | 'riesgo' | 'otro';
  baseline: string;
  baselineNoDisponible: boolean;
  fuente: string;
  frecuencia: string;
  senalMejora: string;
  esProxy: boolean;
}

interface ModuleBData {
  cadenaImpacto: string;
  // Estado de medición
  estadoMedicion: '' | 'si' | 'parcial' | 'no';
  mFuente: string;
  mFrecuencia: string;
  queMideHoy: string;
  queFaltaMedir: string;
  porQueNo: '' | 'no_prioridad' | 'no_herramienta' | 'no_responsable' | 'otro';
  datoMinimo: string;
  // Métricas
  metricas: MetricaB[];
  // Plan mínimo
  planMetrica: string;
  planComoObtener: '' | 'entrevista' | 'sistema' | 'observacion' | 'documento' | 'otro';
  planQuienDa: string;
  planPlazo: '' | '24_72h' | '1_semana' | '2_semanas';
}

interface ModuleCData {
  // MUST 1 — Límites no negociables
  limitesChips: string[];
  limitesTexto: string;
  // MUST 2 — Dependencia crítica
  dependencia: string;
  dependenciaDueno: string;
  dependenciaProbabilidad: '' | 'baja' | 'media' | 'alta';
  // MUST 3 — Alternativa para pilotear
  alternativaPiloto: string;
  // Opcionales (colapsados)
  vistoBueno: string;
  capacidadReal: string;
}

interface FuenteD {
  id: string;
  tipo: '' | 'persona' | 'datos' | 'documento';
  rolNombre: string;
  porQue: string;
  queConfirmar: string;
}

interface EvidenciaD {
  id: string;
  tipo: '' | 'nota' | 'audio' | 'captura' | 'link' | 'reporte';
  nombre: string;
  queDemuestra: string;
}

interface ModuleDData {
  objetivos: string[];
  fuentes: FuenteD[];
  guiasGeneradas: boolean;
  evidencias: EvidenciaD[];
  decisionReto: '' | 'mantiene' | 'ajusta' | 'cambia';
  nuevaVersionReto: string;
  queAjusto: string[];
}

interface SintesisData {
  resumen: string;
  pivotCheck: '' | 'mantener' | 'acotar' | 'reformular' | 'cambiar';
  razonPivot: string;
  version: number;
}

const MOCK_FEEDBACK_IA = {
  status: 'Iterar' as const,
  summary: 'El análisis AS-IS está bien documentado y las métricas tienen baseline definido. Sin embargo, faltan los actores clave y hay inconsistencias en las restricciones.',
  goodPoints: ['Caso real bien contextualizado con walkthrough completo', 'Métrica operativa con baseline claro (3 semanas)', 'Quiebre identificado en el paso 3 del proceso'],
  missing: ['Falta definir el decisor Go/No-Go en Módulo C', 'No se identificó evidencia de entrevistas en Módulo D', 'El filtro de alcance dice "transversal" pero no tiene corte definido'],
  actions: [
    'Define quién es el decisor Go/No-Go en las restricciones (nombre + cargo)',
    'Completa el corte de alcance si seleccionaste "transversal"',
    'Agrega al menos 1 evidencia por entrevista en Módulo D',
    'Verifica que la consecuencia descrita sea consistente con las métricas de impacto',
  ],
  questions: [
    '¿Qué pasaría si el decisor no aprueba continuar con este desafío?',
    '¿Cuál es la frecuencia real de medición de tus métricas?',
    '¿El quiebre identificado es el verdadero o hay uno upstream que lo causa?',
  ],
  contradictions: ['Módulo B dice impacto "crítico" pero Módulo C señala riesgo "bajo". Revisa la consistencia.'],
  timestamp: '2025-02-19T09:00:00Z',
};


export function Step1Page() {
  const { projectId } = useParams();
  const { projects, setCurrentProject, updateProject } = useApp();
  const navigate = useNavigate();

  const project = projects.find(p => p.id === projectId);
  const step = project?.steps.find(s => s.number === 1);
  const step0 = project?.step0Data;

  const [activeModule, setActiveModule] = useState<ModuleId>('A');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sendingIA, setSendingIA] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [cardRetoCopyMsg, setCardRetoCopyMsg] = useState(false);
  const [cardRetoGenerada, setCardRetoGenerada] = useState(false);
  const [mejorIAFrase, setMejorIAFrase] = useState(false);
  const [showMentorOptions, setShowMentorOptions] = useState(false);
  const [proxyTooltipId, setProxyTooltipId] = useState<string | null>(null);
  const [iaLoading_B, setIaLoading_B] = useState(false);
  const [showOpcionalesC, setShowOpcionalesC] = useState(false);

  const [cardReto, setCardReto] = useState<CardRetoData>({
    retoFrase: '',
    alcanceEtapa: '',
    alcanceLimites: '',
    senalObservable: '',
    evidenciaTexto: '',
  });

  const [preparacion, setPreparacion] = useState<PreparacionEntrevistasData>({
    conLider: '',
    conAfectados: '',
  });

  // Module data states
  const [asisData, setAsisData] = useState<ModuleASISData>({
    casoReal: 'El proceso de incorporación de nuevos empleados en TechCorp involucra múltiples áreas (RRHH, TI, Finanzas, el área receptora) y actualmente dura entre 15 y 21 días.',
    pasos: ['Firma de contrato y documentos legales', 'Alta en sistemas de TI (correo, accesos, software)', 'Inducción corporativa (2 días presenciales)', 'Inducción específica del área (5 días con jefatura)'],
    quiebreIndex: 1,
    quiebreDetalle: 'El empleado espera entre 7 y 10 días para recibir accesos porque TI no tiene priorización formal para solicitudes de onboarding.',
    quiebre: 'Paso 2 — Alta en sistemas de TI',
    consecuencia: 'El empleado no puede trabajar productivamente durante 7-10 días porque no tiene accesos ni herramientas, generando frustración y costos de productividad.',
    causaInmediata: 'TI recibe las solicitudes por correo informal sin priorización; no hay tiempo objetivo definido ni sistema de asignación para el proceso de incorporación.',
    evidenciaTipo: 'dato',
    evidenciaNota: 'Promedio de 18 días en incorporación según registros de RRHH 2024.',
    alcance: 'durante',
    corteAlcance: '',
  });

  const [bData, setBData] = useState<ModuleBData>({
    cadenaImpacto: 'Solicitud de accesos por correo informal → TI no prioriza → accesos retrasados 7–10 días → empleado sin herramientas → baja productividad → costos de espera y frustración → riesgo de rotación temprana.',
    estadoMedicion: 'parcial',
    mFuente: '',
    mFrecuencia: '',
    queMideHoy: 'Tiempo total de onboarding (días) en reportes de RRHH.',
    queFaltaMedir: 'Tiempo específico de espera de accesos TI. Costo por ingreso sin productividad.',
    porQueNo: '',
    datoMinimo: '',
    metricas: [
      { id: '1', nombre: 'Tiempo de espera de accesos TI', tipo: 'tiempo', baseline: '7–10 días promedio', baselineNoDisponible: false, fuente: 'Estimación RRHH + TI', frecuencia: 'Por ingreso', senalMejora: 'Reducción a menos de 2 días', esProxy: false },
      { id: '2', nombre: 'Costo por empleado sin productividad', tipo: 'costo', baseline: 'No disponible', baselineNoDisponible: true, fuente: '', frecuencia: 'Por ingreso', senalMejora: 'Reducción >50%', esProxy: true },
    ],
    planMetrica: 'Costo por empleado sin productividad',
    planComoObtener: 'entrevista',
    planQuienDa: 'Gerente de Finanzas / RRHH',
    planPlazo: '1_semana',
  });

  const [cData, setCData] = useState<ModuleCData>({
    limitesChips: ['Datos sensibles', 'Legal / regulatorio'],
    limitesTexto: 'No reemplazar al equipo de RRHH sin proceso formal.',
    dependencia: 'Área de TI para gestionar accesos al sistema',
    dependenciaDueno: 'Gerente de TI',
    dependenciaProbabilidad: 'alta',
    alternativaPiloto: '',
    vistoBueno: '',
    capacidadReal: 'Equipo de 2 personas de RRHH + 1 de TI disponibles 20% de su tiempo.',
  });

  const [dData, setDData] = useState<ModuleDData>({
    objetivos: [
      'Confirmar si el reto es real y prioritario para el área',
      'Identificar quién toma la decisión de priorización en TI',
    ],
    fuentes: [
      { id: '1', tipo: 'persona', rolNombre: 'Coordinadora de RRHH', porQue: 'Ejecuta el proceso y tiene contacto directo con el quiebre', queConfirmar: 'Confirmar el tiempo real de espera y los parches que usan hoy' },
      { id: '2', tipo: 'persona', rolNombre: 'Jefe de TI', porQue: 'Responsable del handoff y priorización de solicitudes', queConfirmar: 'Identificar quién decide el orden de las solicitudes de onboarding' },
    ],
    guiasGeneradas: false,
    evidencias: [],
    decisionReto: '',
    nuevaVersionReto: '',
    queAjusto: [],
  });

  const [guiasPreguntas, setGuiasPreguntas] = useState<Record<string, string[]>>({});
  const [generandoGuia, setGenerandoGuia] = useState(false);

  const [sintesisData, setSintesisData] = useState<SintesisData>({
    resumen: '',
    pivotCheck: '',
    razonPivot: '',
    version: 1,
  });

  const saveState = useAutosave([asisData, bData, cData, dData, sintesisData, preparacion]);

  if (!project || !step) return <div className="p-6"><p className="text-slate-500">Proyecto o Step no encontrado.</p></div>;

  const semaforo = (() => {
    const limitesOk = cData.limitesChips.length > 0 || cData.limitesTexto.trim().length > 0;
    const dependenciaOk = cData.dependencia.trim().length > 0;
    const alternativaOk = cData.alternativaPiloto.trim().length > 0;
    // Rojo: hay dependencia pero no existe alternativa para pilotear
    if (dependenciaOk && !alternativaOk) return 'rojo';
    // Amarillo: prob alta sin dueño, o límites aún vacíos
    if (!limitesOk) return 'amarillo';
    if (dependenciaOk && cData.dependenciaProbabilidad === 'alta') return 'amarillo';
    if (dependenciaOk && !cData.dependenciaDueno.trim()) return 'amarillo';
    // Verde: los 3 MUST completos y riesgo controlado
    if (limitesOk && dependenciaOk && alternativaOk) return 'verde';
    return 'amarillo';
  })();

  const semaforoConfig = {
    verde:    { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', label: '🟢 Verde — Listo para avanzar',    desc: 'Los 3 campos MUST están completos y los riesgos están bajo control. Puedes continuar al Módulo D.' },
    amarillo: { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-500',  label: '🟡 Amarillo — Revisar antes de continuar', desc: 'Hay una dependencia de probabilidad alta o falta el dueño. Define quién es responsable antes de avanzar.' },
    rojo:     { color: 'text-red-700',     bg: 'bg-red-50 border-red-200',        dot: 'bg-red-500',    label: '🔴 Rojo — Bloqueado',              desc: 'Tienes una dependencia registrada pero no definiste cómo pilotear sin ella. Sin alternativa, el diseño queda en el aire.' },
  }[semaforo];

  // ── Módulo B helpers — defined before `modules` to avoid temporal dead zone ──

  const necesitaPlanMinimo = () => {
    if (bData.estadoMedicion === 'no') return true;
    return bData.metricas.some(m => m.baselineNoDisponible);
  };

  const getModuloBMissing = () => {
    const m: string[] = [];
    if (!bData.cadenaImpacto.trim()) m.push('Cadena de impacto (¿Qué provoca este reto?)');
    if (!bData.estadoMedicion) m.push('Estado actual de medición');
    if (bData.metricas.length === 0) m.push('Al menos 1 métrica creada');
    else {
      const incompletas = bData.metricas.filter(met => {
        if (!met.nombre.trim()) return true;
        if (!met.tipo) return true;
        if (!met.baseline.trim() && !met.baselineNoDisponible) return true;
        return false;
      });
      if (incompletas.length > 0)
        m.push(`${incompletas.length} métrica(s) sin nombre, tipo o línea base`);
    }
    if (necesitaPlanMinimo()) {
      if (!bData.planMetrica.trim()) m.push('Plan mínimo: qué métrica medir primero');
      if (!bData.planComoObtener) m.push('Plan mínimo: cómo la obtendrás');
      if (!bData.planPlazo) m.push('Plan mínimo: plazo');
    }
    return m;
  };

  const moduloBListo = () => getModuloBMissing().length === 0;

  const getModuloDMissing = () => {
    const m: string[] = [];
    const objetivosValidos = dData.objetivos.filter(o => o.trim()).length;
    if (objetivosValidos === 0) m.push('Al menos 1 objetivo definido (sección 1)');
    if (dData.fuentes.length === 0) m.push('Al menos 1 fuente a consultar (sección 2)');
    const evidenciasConEtiqueta = dData.evidencias.filter(e => e.queDemuestra.trim()).length;
    if (evidenciasConEtiqueta === 0) m.push('Sube al menos 1 evidencia con etiqueta (sección 4)');
    if (!dData.decisionReto) m.push('Decisión sobre el reto seleccionada (sección 5)');
    return m;
  };

  const moduloDListo = () => getModuloDMissing().length === 0;

  const modules: { id: ModuleId; label: string; shortName: string; unlocked: boolean; completed: boolean }[] = [
    { id: 'A', label: 'Módulo A: Proceso actual', shortName: 'A · Proceso actual', unlocked: true, completed: true },
    { id: 'B', label: 'Módulo B: Medición', shortName: 'B · Medición', unlocked: true, completed: moduloBListo() },
    { id: 'C', label: 'Módulo C: Restricciones', shortName: 'C · Restricciones', unlocked: true, completed: semaforo === 'verde' },
    { id: 'D', label: 'Módulo D: Actores y validación', shortName: 'D · Validación', unlocked: semaforo !== 'rojo', completed: moduloDListo() },
    { id: 'S', label: 'Síntesis + Revisión de rumbo', shortName: 'Síntesis', unlocked: false, completed: false },
  ];

  const openIAPanel = () => {
    setShowIAPanel(true);
    setIaLoading(true);
    setTimeout(() => setIaLoading(false), 1500);
  };

  const sendToIA = () => {
    setSendingIA(true);
    setTimeout(() => { setSendingIA(false); setHasFeedback(true); setShowFeedback(true); }, 2000);
  };

  const canSend = modules.slice(0, 4).every(m => m.completed) || true; // for demo

  // ── Card del reto helpers ──────────────────────────────────────────────────

  const autoFillCardReto = () => {
    const pasoNombre = asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex]
      ? `Paso ${asisData.quiebreIndex + 1} — ${asisData.pasos[asisData.quiebreIndex]}`
      : asisData.quiebre || '[paso]';
    const consecuencia = asisData.consecuencia ? asisData.consecuencia.split('.')[0] : '[consecuencia]';
    const causa = asisData.causaInmediata ? asisData.causaInmediata.split('.')[0] : '[causa]';
    const proceso = asisData.casoReal ? asisData.casoReal.split(' ').slice(0, 6).join(' ') + '…' : '[proceso]';
    setCardReto(prev => ({
      ...prev,
      retoFrase: `Hoy ${proceso} se rompe en ${pasoNombre}, causando ${consecuencia}, porque ${causa}.`,
      alcanceEtapa: asisData.alcance === 'transversal' ? '' : (asisData.alcance as 'antes' | 'durante' | 'después' | ''),
    }));
    setCardRetoGenerada(true);
  };

  const mejorarFraseConIA = () => {
    setMejorIAFrase(true);
    setTimeout(() => {
      setCardReto(prev => ({
        ...prev,
        retoFrase: 'Hoy el proceso de incorporación de nuevos empleados se rompe en el alta de sistemas (TI), causando hasta 10 días sin acceso a herramientas y pérdida de productividad, porque no existe un tiempo objetivo ni priorización formal para solicitudes de onboarding.',
      }));
      setMejorIAFrase(false);
    }, 1800);
  };

  const cardRetoCompleta = () => {
    if (!cardRetoGenerada) return false;
    if (!cardReto.retoFrase.trim()) return false;
    if (!cardReto.alcanceEtapa) return false;
    if (!cardReto.senalObservable.trim()) return false;
    if (!cardReto.evidenciaTexto.trim()) return false;
    return true;
  };

  const getModuloAMissing = () => {
    const m: string[] = [];
    if (!asisData.casoReal.trim()) m.push('Cuéntame el reto (Sección 1)');
    if (asisData.pasos.filter(p => p.trim()).length < 2) m.push('Al menos 2 pasos del recorrido (Sección 2)');
    if (asisData.quiebreIndex === null) m.push('Selecciona en qué momento ocurre el reto (Sección 3)');
    if (!asisData.consecuencia.trim()) m.push('Consecuencia del reto (Sección 4)');
    if (!asisData.causaInmediata.trim()) m.push('Causa inmediata (Sección 4)');
    if (!cardRetoGenerada) m.push('Card del reto (genera la card al final)');
    else if (!cardReto.retoFrase.trim()) m.push('Reto en 1 frase (en la Card del reto)');
    return m;
  };

  const addMetrica = () => {
    const nueva: MetricaB = {
      id: Date.now().toString(),
      nombre: '',
      tipo: '',
      baseline: '',
      baselineNoDisponible: false,
      fuente: '',
      frecuencia: '',
      senalMejora: '',
      esProxy: false,
    };
    setBData(p => ({ ...p, metricas: [...p.metricas, nueva] }));
  };

  const updateMetrica = (id: string, changes: Partial<MetricaB>) => {
    setBData(p => ({ ...p, metricas: p.metricas.map(m => m.id === id ? { ...m, ...changes } : m) }));
  };

  const removeMetrica = (id: string) => {
    setBData(p => ({ ...p, metricas: p.metricas.filter(m => m.id !== id) }));
  };

  const suggestCadenaIA = () => {
    setIaLoading_B(true);
    setTimeout(() => {
      const fraseReto = cardReto.retoFrase || asisData.casoReal;
      setBData(p => ({
        ...p,
        cadenaImpacto: fraseReto
          ? `${asisData.causaInmediata ? asisData.causaInmediata.split('.')[0] : 'Falla en el proceso'} → retrasos en ${asisData.quiebre || 'paso clave'} → ${asisData.consecuencia ? asisData.consecuencia.split(',')[0].toLowerCase() : 'impacto operativo'} → costos de reproceso → experiencia negativa y riesgo de pérdida de talento.`
          : p.cadenaImpacto,
      }));
      setIaLoading_B(false);
    }, 1600);
  };

  const TIPO_METRICA_LABELS: Record<string, string> = {
    tiempo: '⏱ Tiempo',
    cantidad: '🔢 Cantidad',
    costo: '💰 Costo',
    calidad: '✅ Calidad',
    riesgo: '⚠️ Riesgo',
    otro: '📐 Otro',
  };

  const PLAN_COMO_LABELS: Record<string, string> = {
    entrevista: 'Entrevista con el responsable',
    sistema: 'Consulta en sistema / base de datos',
    observacion: 'Observación directa del proceso',
    documento: 'Revisión de documentos / reportes',
    otro: 'Otro método',
  };

  // ── Copy Card Reto ──────────────────────────────────────────────────────────

  const handleCopyCardReto = () => {
    const text = [
      `RETO: ${cardReto.retoFrase}`,
      `ALCANCE: ${cardReto.alcanceEtapa} | Límites: ${cardReto.alcanceLimites || 'Sin definir'}`,
      `SEÑAL OBSERVABLE: ${cardReto.senalObservable}`,
      `EVIDENCIA (${asisData.evidenciaTipo || '—'}): ${cardReto.evidenciaTexto || asisData.evidenciaNota}`,
      `PREPARACIÓN ENTREVISTAS — Líder: ${preparacion.conLider || '—'} | Afectados: ${preparacion.conAfectados || '—'}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCardRetoCopyMsg(true);
    setTimeout(() => setCardRetoCopyMsg(false), 2000);
  };

  return (
    <div className="flex h-full">
      {/* Left module nav */}
      <div className="hidden md:flex w-52 flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <h2 className="text-sm text-slate-900 mt-2" style={{ fontWeight: 600 }}>Paso 1</h2>
          <p className="text-xs text-slate-500">Claridad en el desafío</p>
          <div className="mt-2"><ProgressBar value={step.progress} size="sm" /></div>
        </div>

        {modules.map(mod => (
          <button
            key={mod.id}
            onClick={() => mod.unlocked && setActiveModule(mod.id)}
            disabled={!mod.unlocked}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors text-left ${
              activeModule === mod.id ? 'bg-indigo-50 text-indigo-700' :
              mod.unlocked ? 'text-slate-600 hover:bg-slate-50' :
              'text-slate-300 cursor-not-allowed'
            }`}
            style={{ fontWeight: activeModule === mod.id ? 600 : 400 }}
          >
            {mod.completed ? (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            ) : !mod.unlocked ? (
              <Lock size={13} className="text-slate-300 shrink-0" />
            ) : (
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${activeModule === mod.id ? 'border-indigo-400' : 'border-slate-200'}`} />
            )}
            {mod.shortName}
          </button>
        ))}

        <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
          <AutosaveIndicator state={saveState} />
          <button
            onClick={openIAPanel}
            className="w-full flex items-center gap-1.5 text-xs text-violet-600 px-2 py-1.5 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Sparkles size={12} /> Mejorar con IA
          </button>
          {hasFeedback && (
            <button onClick={() => setShowFeedback(!showFeedback)} className="w-full flex items-center gap-1.5 text-xs text-violet-600 px-2 py-1.5 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors" style={{ fontWeight: 500 }}>
              <Sparkles size={12} /> Ver análisis IA
            </button>
          )}
          {/* Mentor con opciones */}
          <div className="relative">
            <button
              onClick={() => setShowMentorOptions(v => !v)}
              className="w-full flex items-center gap-1.5 text-xs text-slate-600 px-2 py-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <MessageSquare size={12} /> Mentor
              <ChevronDown size={10} className="ml-auto" />
            </button>
            {showMentorOptions && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Pedir ayuda (destrabe)
                </button>
                <button
                  onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Agendar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Mobile back */}
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al proyecto
          </button>

          {/* ══════════════════════════════════════════════════════════════
              MODULE A: PROCESO ACTUAL
          ══════════════════════════════════════════════════════════════ */}
          {activeModule === 'A' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo A: Proceso actual</h1>
                    <StatusChip status="Completado" size="sm" />
                  </div>
                  <p className="text-sm text-slate-500">Documenta el proceso tal como ocurre hoy, dónde ocurre el reto y por qué.</p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={openIAPanel} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Mejorar con IA
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Ancla del Paso 0 (solo lectura) ── */}
              <div className={`rounded-xl border p-4 ${step0?.quePasaQueQuieres ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target size={13} className={step0?.quePasaQueQuieres ? 'text-indigo-500' : 'text-slate-400'} />
                    <p className="text-xs" style={{ fontWeight: 700 }}>
                      <span className={step0?.quePasaQueQuieres ? 'text-indigo-700' : 'text-slate-600'}>Ancla del Paso 0</span>
                      <span className="ml-1.5 text-slate-400 text-xs px-1.5 py-0.5 bg-white/60 rounded" style={{ fontWeight: 400 }}>Solo lectura</span>
                    </p>
                  </div>
                  <button onClick={() => navigate(`/projects/${projectId}/step/0`)} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
                    <ExternalLink size={10} /> Ver Paso 0
                  </button>
                </div>
                {step0?.quePasaQueQuieres ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      { label: 'Impacta a', value: step0.impacta?.join(', ') || '—' },
                      { label: 'Etapa del proceso', value: step0.parteProceso ? ({ antes: 'Antes', durante: 'Durante', despues: 'Después', transversal: 'Transversal', otra: 'Otra' } as Record<string,string>)[step0.parteProceso] || '—' : '—' },
                      { label: 'Impacto a 3 meses', value: step0.impacto3meses ? ({ ingresos: 'Pérdida de ingresos', costos: 'Costos y reprocesos', riesgo: 'Riesgo', cliente: 'Exp. del cliente', productividad: 'Productividad y clima', no_claro: 'Por definir', otro: 'Otro' } as Record<string,string>)[step0.impacto3meses] || '—' : '—' },
                      { label: 'Respaldo disponible', value: step0.respaldo ? ({ datos: 'Datos internos', testimonios: 'Testimonios', benchmark: 'Ref. externa', hipotesis: 'Hipótesis', otro: 'Otro' } as Record<string,string>)[step0.respaldo] || '—' : '—' },
                      { label: 'Sí mínimo', value: step0.siMinimo?.length ? step0.siMinimo[0] + (step0.siMinimo.length > 1 ? ` +${step0.siMinimo.length - 1}` : '') : '—' },
                    ].map((row, i) => (
                      <div key={i} className={i === 4 ? 'col-span-2' : ''}>
                        <p className="text-xs text-indigo-400" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>{row.label.toUpperCase()}</p>
                        <p className="text-xs text-indigo-800 mt-0.5">{row.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Paso 0 aún no completado — <span className="text-amber-600" style={{ fontWeight: 600 }}>completa el Paso 0 primero para anclar el reto</span></p>
                )}
              </div>

              {/* ══════════════════════════════════
                  SECCIÓN 1
              ══════════════════════════════════ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>1</span>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Para tener claridad, cuéntame el reto que quieres abordar. <span className="text-red-500">*</span></h2>
                </div>
                <p className="text-xs text-slate-400 ml-8">Describe el proceso y la situación que quieres mejorar, en el contexto real de tu organización.</p>
                <div className="ml-8 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 italic">
                  <span style={{ fontWeight: 600 }} className="not-italic text-slate-600">Ejemplo:</span> "En TechCorp, el proceso de incorporación de nuevos empleados involucra RRHH, TI y el área receptora. Actualmente dura entre 15 y 21 días, y durante ese tiempo el empleado no puede trabajar porque no tiene accesos."
                </div>
                <textarea
                  value={asisData.casoReal}
                  onChange={e => setAsisData(p => ({ ...p, casoReal: e.target.value }))}
                  rows={3}
                  placeholder="Describe el proceso real: qué ocurre, quiénes participan, cuánto dura y cuál es el problema que enfrentan hoy."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
                {asisData.casoReal.trim() && (
                  <div className="flex items-center gap-2 ml-0">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>Listo</span>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════
                  SECCIÓN 2
              ══════════════════════════════════ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>2</span>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Ahora dime el recorrido del proceso donde ocurre ese reto. <span className="text-red-500">*</span></h2>
                </div>
                <p className="text-xs text-slate-400 ml-8">Escribe los pasos principales del proceso, en orden. Empieza con los más relevantes y agrega si necesitas.</p>
                <div className="ml-8 space-y-2">
                  {asisData.pasos.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 600 }}>{i + 1}</span>
                      <input
                        value={p}
                        onChange={e => { const np = [...asisData.pasos]; np[i] = e.target.value; setAsisData(prev => ({ ...prev, pasos: np })); }}
                        placeholder={`Paso ${i + 1}… Ej. Alta en sistemas de TI`}
                        className={`flex-1 border rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${asisData.quiebreIndex === i ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                      />
                      {asisData.pasos.length > 2 && (
                        <button
                          onClick={() => {
                            const np = asisData.pasos.filter((_, j) => j !== i);
                            const newIdx = asisData.quiebreIndex === i ? null : asisData.quiebreIndex !== null && asisData.quiebreIndex > i ? asisData.quiebreIndex - 1 : asisData.quiebreIndex;
                            setAsisData(prev => ({ ...prev, pasos: np, quiebreIndex: newIdx }));
                          }}
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {asisData.pasos.length < 8 && (
                    <button
                      onClick={() => setAsisData(p => ({ ...p, pasos: [...p.pasos, ''] }))}
                      className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 px-3 py-2 border border-dashed border-indigo-200 rounded-xl hover:border-indigo-400 transition-colors ml-8"
                      style={{ fontWeight: 500 }}
                    >
                      <Plus size={12} /> Agregar paso
                    </button>
                  )}
                </div>
                {asisData.pasos.filter(p => p.trim()).length >= 2 && (
                  <div className="flex items-center gap-2 ml-8">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>{asisData.pasos.filter(p => p.trim()).length} pasos registrados</span>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════
                  SECCIÓN 3
              ══════════════════════════════════ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>3</span>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>¿En qué momento ocurre el reto? <span className="text-red-500">*</span></h2>
                </div>
                <p className="text-xs text-slate-400 ml-8">Selecciona el paso donde se produce la falla principal. Ese es el "quiebre".</p>

                {/* Selector de paso */}
                <div className="ml-8 space-y-2">
                  {asisData.pasos.filter(p => p.trim()).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Completa al menos un paso en la Sección 2 para poder seleccionarlo.</p>
                  ) : (
                    asisData.pasos.map((p, i) => p.trim() ? (
                      <button
                        key={i}
                        onClick={() => {
                          setAsisData(prev => ({ ...prev, quiebreIndex: i, quiebre: `Paso ${i + 1} — ${p}` }));
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                          asisData.quiebreIndex === i
                            ? 'border-red-400 bg-red-50 text-red-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        style={{ fontWeight: asisData.quiebreIndex === i ? 600 : 400 }}
                      >
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${
                          asisData.quiebreIndex === i ? 'border-red-500 bg-red-500 text-white' : 'border-slate-300'
                        }`} style={{ fontWeight: 700 }}>
                          {asisData.quiebreIndex === i ? '✗' : i + 1}
                        </span>
                        <span>{p}</span>
                        {asisData.quiebreIndex === i && (
                          <span className="ml-auto text-xs text-red-500 px-2 py-0.5 bg-red-100 rounded-full shrink-0">Aquí ocurre el reto</span>
                        )}
                      </button>
                    ) : null)
                  )}
                </div>

                {/* Detalle del quiebre */}
                {asisData.quiebreIndex !== null && (
                  <div className="ml-8 space-y-1.5">
                    <label className="block text-xs text-slate-600" style={{ fontWeight: 500 }}>
                      Describe brevemente qué pasa en ese momento <span className="text-slate-400">(opcional pero recomendado)</span>
                    </label>
                    <textarea
                      value={asisData.quiebreDetalle}
                      onChange={e => setAsisData(p => ({ ...p, quiebreDetalle: e.target.value }))}
                      rows={2}
                      placeholder="Ej. El empleado espera entre 7 y 10 días para recibir accesos porque TI no tiene priorización formal para estas solicitudes."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                  </div>
                )}

                {asisData.quiebreIndex !== null && (
                  <div className="flex items-center gap-2 ml-8">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>
                      Quiebre en Paso {asisData.quiebreIndex + 1}: {asisData.pasos[asisData.quiebreIndex]}
                    </span>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════
                  SECCIÓN 4
              ══════════════════════════════════ */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>4</span>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Consecuencia, causa inmediata y evidencia del reto. <span className="text-red-500">*</span></h2>
                </div>
                <p className="text-xs text-slate-400 ml-8">Tres preguntas clave para entender el impacto real antes de avanzar.</p>

                <div className="ml-8 space-y-4">
                  {/* 4a. Consecuencia */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-1" style={{ fontWeight: 500 }}>¿Qué consecuencia tiene este reto? <span className="text-red-500">*</span></label>
                    <p className="text-xs text-slate-400 mb-2">
                      <span style={{ fontWeight: 600 }}>Consecuencia</span> = qué pasa cuando el reto ocurre, y a quién afecta. No el síntoma, sino el impacto concreto.
                    </p>
                    <textarea
                      value={asisData.consecuencia}
                      onChange={e => setAsisData(p => ({ ...p, consecuencia: e.target.value }))}
                      rows={2}
                      placeholder="Ej. El empleado no puede trabajar durante 7–10 días, generando frustración y costos de productividad estimados en $3,200 USD por ingreso."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                    {asisData.consecuencia.trim() && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>Listo</span>
                      </div>
                    )}
                  </div>

                  {/* 4b. Causa inmediata */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-1" style={{ fontWeight: 500 }}>¿Cuál es la causa inmediata? <span className="text-red-500">*</span></label>
                    <p className="text-xs text-slate-400 mb-2">
                      <span style={{ fontWeight: 600 }}>Causa inmediata</span> = la razón directa por la que ocurre el quiebre. No el problema de fondo, sino lo que lo dispara hoy.
                    </p>
                    <textarea
                      value={asisData.causaInmediata}
                      onChange={e => setAsisData(p => ({ ...p, causaInmediata: e.target.value }))}
                      rows={2}
                      placeholder="Ej. TI recibe solicitudes por correo informal, sin priorización ni tiempo objetivo definido para onboarding."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                    {asisData.causaInmediata.trim() && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>Listo</span>
                      </div>
                    )}
                  </div>

                  {/* 4c. Evidencia */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <FileText size={13} className="text-slate-500" />
                      <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Sube evidencia de que el reto existe</p>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Tipo de evidencia */}
                      <div>
                        <label className="block text-xs text-slate-600 mb-2" style={{ fontWeight: 500 }}>¿Qué tipo de evidencia tienes?</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { v: 'dato', label: '📊 Dato', desc: 'Número, tiempo o frecuencia medible' },
                            { v: 'ticket', label: '🎫 Ticket / incidente', desc: 'Registro de un sistema de soporte o gestión' },
                            { v: 'testimonio', label: '💬 Testimonio', desc: 'Cita directa de alguien involucrado' },
                            { v: 'benchmark', label: '📌 Referencia externa', desc: 'Cómo lo resuelven en otro lugar' },
                          ] as const).map(opt => (
                            <button
                              key={opt.v}
                              onClick={() => setAsisData(p => ({ ...p, evidenciaTipo: opt.v }))}
                              className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                                asisData.evidenciaTipo === opt.v
                                  ? 'border-indigo-400 bg-indigo-50'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <p className={`text-xs ${asisData.evidenciaTipo === opt.v ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{opt.label}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nota: qué demuestra */}
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
                          ¿Qué demuestra esta evidencia? <span className="text-slate-400">(1–2 líneas)</span>
                        </label>
                        <input
                          value={asisData.evidenciaNota}
                          onChange={e => setAsisData(p => ({ ...p, evidenciaNota: e.target.value }))}
                          placeholder={
                            asisData.evidenciaTipo === 'dato' ? 'Ej. 18 días promedio de incorporación — Registros RRHH Q4 2024' :
                            asisData.evidenciaTipo === 'ticket' ? 'Ej. 47 tickets de "sin accesos" registrados en el último trimestre' :
                            asisData.evidenciaTipo === 'testimonio' ? 'Ej. «Coordinadora RRHH: tardamos más de 2 semanas en dar accesos»' :
                            asisData.evidenciaTipo === 'benchmark' ? 'Ej. En Empresa X, el proceso dura 2 días con un portal self-service' :
                            'Describe brevemente qué demuestra esta evidencia sobre el reto'
                          }
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>

                      {/* Subida de archivo / link */}
                      <div>
                        <label className="block text-xs text-slate-600 mb-2" style={{ fontWeight: 500 }}>Adjunta el archivo o link (opcional)</label>
                        <EvidenceUploader />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Resumen generado — Módulo A ── */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs text-indigo-700 mb-2.5" style={{ fontWeight: 600 }}>📋 Resumen generado — Módulo A</p>
                <div className="space-y-1.5 text-xs text-indigo-600">
                  <p>
                    <span style={{ fontWeight: 600 }}>Proceso:</span>{' '}
                    {asisData.casoReal ? asisData.casoReal.slice(0, 70) + (asisData.casoReal.length > 70 ? '…' : '') : <span className="text-indigo-300 italic">Pendiente</span>}
                  </p>
                  <p>
                    <span style={{ fontWeight: 600 }}>Recorrido:</span>{' '}
                    {asisData.pasos.filter(Boolean).length > 0
                      ? `${asisData.pasos.filter(Boolean).length} pasos · ${asisData.pasos.filter(Boolean).join(' → ').slice(0, 60)}${asisData.pasos.filter(Boolean).join(' → ').length > 60 ? '…' : ''}`
                      : <span className="text-indigo-300 italic">Pendiente</span>}
                  </p>
                  <p>
                    <span style={{ fontWeight: 600 }}>Quiebre:</span>{' '}
                    {asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex]
                      ? `Paso ${asisData.quiebreIndex + 1} — ${asisData.pasos[asisData.quiebreIndex]}`
                      : <span className="text-indigo-300 italic">No seleccionado</span>}
                  </p>
                  <p>
                    <span style={{ fontWeight: 600 }}>Consecuencia:</span>{' '}
                    {asisData.consecuencia ? asisData.consecuencia.slice(0, 70) + (asisData.consecuencia.length > 70 ? '…' : '') : <span className="text-indigo-300 italic">Pendiente</span>}
                  </p>
                  <p>
                    <span style={{ fontWeight: 600 }}>Causa inmediata:</span>{' '}
                    {asisData.causaInmediata ? asisData.causaInmediata.slice(0, 70) + (asisData.causaInmediata.length > 70 ? '…' : '') : <span className="text-indigo-300 italic">Pendiente</span>}
                  </p>
                  {asisData.evidenciaNota && (
                    <p>
                      <span style={{ fontWeight: 600 }}>Evidencia ({asisData.evidenciaTipo || 'sin tipo'}):</span> {asisData.evidenciaNota.slice(0, 60)}{asisData.evidenciaNota.length > 60 ? '…' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════════════════
                  CARD DEL RETO
              ════════════════════════════════════════════════════ */}
              <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="px-5 py-4 bg-slate-900 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white text-sm" style={{ fontWeight: 700 }}>Card del reto</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Output del Módulo A. Sintetiza el reto para conversar con el área y avanzar al siguiente módulo.
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {!cardRetoGenerada && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-600 mb-3">La card se genera con los datos que completaste. Podrás editar cada campo después.</p>
                        <button onClick={autoFillCardReto} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm transition-colors" style={{ fontWeight: 500 }}>
                          <Sparkles size={13} /> Generar Card del reto
                        </button>
                      </div>
                    </div>
                  )}

                  {cardRetoGenerada && (
                    <div className="space-y-5">

                      {/* A — Reto en 1 frase */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>A</span>
                          <label className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Reto en 1 frase <span className="text-red-500">*</span></label>
                        </div>
                        <p className="text-xs text-slate-400 mb-2 ml-7">
                          Formato: "Hoy [proceso] se rompe en [paso], causando [consecuencia], porque [causa]."
                        </p>
                        <div className="ml-7">
                          <textarea value={cardReto.retoFrase} onChange={e => setCardReto(p => ({ ...p, retoFrase: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none" />
                          <button onClick={mejorarFraseConIA} disabled={mejorIAFrase} className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50 transition-colors" style={{ fontWeight: 500 }}>
                            {mejorIAFrase ? <><span className="animate-spin inline-block">⟳</span> Mejorando…</> : <><Sparkles size={11} /> Mejorar con IA</>}
                          </button>
                        </div>
                      </div>

                      {/* B — Alcance */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>B</span>
                          <label className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Alcance</label>
                        </div>
                        <div className="ml-7 space-y-3">
                          <div>
                            <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>Etapa principal</p>
                            <div className="flex gap-2 flex-wrap">
                              {(['antes', 'durante', 'después'] as const).map(opt => (
                                <button key={opt} onClick={() => setCardReto(p => ({ ...p, alcanceEtapa: opt }))} className={`px-3 py-2 rounded-xl border text-sm capitalize transition-colors ${cardReto.alcanceEtapa === opt ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: cardReto.alcanceEtapa === opt ? 600 : 400 }}>{opt}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 500 }}>Qué NO entra en este reto</p>
                            <input value={cardReto.alcanceLimites} onChange={e => setCardReto(p => ({ ...p, alcanceLimites: e.target.value }))} placeholder="Ej. No incluye firma de contratos ni inducción presencial" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                          </div>
                        </div>
                      </div>

                      {/* C — Impacto validado */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>C</span>
                          <label className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Impacto validado</label>
                        </div>
                        <div className="ml-7 space-y-3">
                          {step0?.impacto3meses && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600 }}>IMPACTO PRINCIPAL (3 MESES)</p>
                                <p className="text-xs text-indigo-800">{({ ingresos: 'Pérdida de ingresos', costos: 'Costos y reprocesos', riesgo: 'Riesgo', cliente: 'Exp. del cliente', productividad: 'Productividad y clima', no_claro: 'Por definir', otro: 'Otro' } as Record<string,string>)[step0.impacto3meses] || '—'}</p>
                              </div>
                              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600 }}>A QUIÉN IMPACTA</p>
                                <p className="text-xs text-indigo-800">{step0.impacta?.join(', ') || '—'}</p>
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Señal observable hoy</label>
                            <input value={cardReto.senalObservable} onChange={e => setCardReto(p => ({ ...p, senalObservable: e.target.value }))} placeholder="Ej. 7–10 días sin accesos, retrabajo en RRHH, reclamos en encuesta de ingreso" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                          </div>
                          {asisData.evidenciaNota && (
                            <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                              <Info size={12} className="text-slate-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-slate-600">
                                <span style={{ fontWeight: 600 }}>Evidencia registrada ({asisData.evidenciaTipo || 'sin tipo'}):</span>{' '}{asisData.evidenciaNota}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* D — Evidencia mínima */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>D</span>
                          <label className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Evidencia mínima</label>
                        </div>
                        <div className="ml-7">
                          <textarea value={cardReto.evidenciaTexto} onChange={e => setCardReto(p => ({ ...p, evidenciaTexto: e.target.value }))} rows={2} placeholder="Resume la evidencia en 1–2 líneas para la card. Ej. «18 días promedio — Registros RRHH 2024»" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none" />
                        </div>
                      </div>

                      {/* Botones de la Card */}
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                        <button onClick={handleCopyCardReto} className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 bg-white px-3.5 py-2 rounded-xl text-sm transition-colors" style={{ fontWeight: 500 }}>
                          <Copy size={13} /> {cardRetoCopyMsg ? '¡Copiado!' : 'Copiar resumen'}
                        </button>
                        <button onClick={() => setShowMentorModal(true)} className="flex items-center gap-2 border border-indigo-200 hover:bg-indigo-50 text-indigo-600 bg-white px-3.5 py-2 rounded-xl text-sm transition-colors" style={{ fontWeight: 500 }}>
                          <MessageSquare size={13} /> Pedir ayuda a mentor
                        </button>
                        <button onClick={autoFillCardReto} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 transition-colors" style={{ fontWeight: 500 }}>
                          <Sparkles size={11} /> Regenerar card
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* ─────────────── FIN CARD DEL RETO ─────────────── */}

              {/* ════════════════════════════════════════════════════
                  PREPARACIÓN DE ENTREVISTAS → MÓDULO D
              ════════════════════════════════════════════════════ */}
              <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-100 border-b border-slate-200 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-800 text-sm" style={{ fontWeight: 700 }}>Qué validar en entrevistas</p>
                      <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-200 rounded-full">Se hace en el Módulo D</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Define aquí qué quieres confirmar. Las entrevistas con guía y registro de evidencia las harás en Actores/entrevistas.
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Selector 1: Con el líder */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 500 }}>Con el líder debo confirmar…</label>
                    <div className="space-y-2">
                      {([
                        { v: 'prioridad', label: 'La prioridad del reto', desc: 'Si para el área es un problema urgente o secundario.' },
                        { v: 'impacto', label: 'El impacto real en el negocio', desc: 'Si el daño que describí coincide con lo que ellos perciben.' },
                        { v: 'alcance', label: 'El alcance correcto', desc: 'Si el proceso que delimitamos es el que realmente importa.' },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setPreparacion(p => ({ ...p, conLider: opt.v }))}
                          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            preparacion.conLider === opt.v
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 ${preparacion.conLider === opt.v ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`} />
                          <div>
                            <p className={`text-sm ${preparacion.conLider === opt.v ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: preparacion.conLider === opt.v ? 600 : 500 }}>{opt.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selector 2: Con los afectados */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 500 }}>Con los afectados debo confirmar…</label>
                    <div className="space-y-2">
                      {([
                        { v: 'paso_exacto', label: 'El paso exacto donde ocurre el reto', desc: 'Si el quiebre que identifiqué coincide con lo que ellos experimentan.' },
                        { v: 'parches', label: 'Cómo lo resuelven hoy (parches)', desc: 'Qué hacen para compensar el problema mientras existe.' },
                        { v: 'frecuencia', label: 'Con qué frecuencia ocurre', desc: 'Si es un problema constante o esporádico, y cuánto les afecta.' },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setPreparacion(p => ({ ...p, conAfectados: opt.v }))}
                          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            preparacion.conAfectados === opt.v
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 ${preparacion.conAfectados === opt.v ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`} />
                          <div>
                            <p className={`text-sm ${preparacion.conAfectados === opt.v ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: preparacion.conAfectados === opt.v ? 600 : 500 }}>{opt.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aviso y CTA */}
                  <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-600 mb-3">
                        En el <span style={{ fontWeight: 600 }}>Módulo D</span> harás las entrevistas con guía estructurada y registrarás la evidencia que obtengas. Lo que definiste aquí sirve de brújula.
                      </p>
                      <button
                        onClick={() => setActiveModule('D')}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        Ir a Actores / entrevistas <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* ─────────────── FIN PREPARACIÓN ENTREVISTAS ─────────────── */}

              {/* Gating check + Botón principal */}
              {(() => {
                const missing = getModuloAMissing();
                const listo = missing.length === 0;
                return (
                  <div className="space-y-3">
                    {!listo && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-500" />
                          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Completa estos campos para avanzar a Medición:</p>
                        </div>
                        <ul className="space-y-1">
                          {missing.map((m, i) => <li key={i} className="text-xs text-amber-700">· {m}</li>)}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => listo && setActiveModule('B')}
                      disabled={!listo}
                      className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${listo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {listo ? <>Módulo A listo → Ir a Medición <ChevronRight size={15} /></> : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODULE B: MEDICIÓN E IMPACTO
          ══════════════════════════════════════════════════════════════ */}
          {activeModule === 'B' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo B: Medición e impacto</h1>
                    <StatusChip status={moduloBListo() ? 'Completado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-lg">
                    Define cómo medir la situación de hoy (línea base) y qué señal indicaría mejora. Si hoy no se mide, lo dejamos registrado y definimos cómo lo vas a medir.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={openIAPanel} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Mejorar con IA
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Mini-card: Resumen del reto (Módulo A) — Solo lectura ── */}
              {cardReto.retoFrase ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={13} className="text-indigo-400" />
                    <p className="text-xs text-indigo-600" style={{ fontWeight: 700 }}>Resumen del reto — Módulo A</p>
                    <span className="text-xs text-indigo-300 px-1.5 py-0.5 bg-white/60 rounded ml-1" style={{ fontWeight: 400 }}>Solo lectura</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>RETO</p>
                      <p className="text-xs text-indigo-800" style={{ fontWeight: 500 }}>"{cardReto.retoFrase}"</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {asisData.consecuencia && (
                        <div>
                          <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>CONSECUENCIA</p>
                          <p className="text-xs text-indigo-700">{asisData.consecuencia.slice(0, 60)}{asisData.consecuencia.length > 60 ? '…' : ''}</p>
                        </div>
                      )}
                      {asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex] && (
                        <div>
                          <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>DÓNDE OCURRE</p>
                          <p className="text-xs text-indigo-700">Paso {asisData.quiebreIndex + 1} — {asisData.pasos[asisData.quiebreIndex]}</p>
                        </div>
                      )}
                      {step0?.impacta?.length ? (
                        <div>
                          <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>IMPACTA A</p>
                          <p className="text-xs text-indigo-700">{step0.impacta.join(', ')}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                  <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 mb-2" style={{ fontWeight: 500 }}>
                      No hay reto definido en el Módulo A. Complétalo primero para que las métricas tengan contexto.
                    </p>
                    <button onClick={() => setActiveModule('A')} className="flex items-center gap-1 text-xs text-amber-700 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-200 transition-colors" style={{ fontWeight: 500 }}>
                      Ir al Módulo A <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  1. CADENA DE IMPACTO
              ════════════════════════════════════════ */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <label className="block text-sm text-slate-800 mb-0.5" style={{ fontWeight: 600 }}>
                      ¿Qué provoca este reto? <span className="text-slate-400" style={{ fontWeight: 400 }}>(cadena de impacto)</span> <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-400">Escribe 3–5 efectos en orden: <span className="text-slate-600">problema → efecto → impacto final.</span> Usa flechas (→) para conectarlos.</p>
                  </div>
                  <button
                    onClick={suggestCadenaIA}
                    disabled={iaLoading_B}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-50 border border-violet-100"
                    style={{ fontWeight: 500 }}
                  >
                    {iaLoading_B ? <><span className="animate-spin inline-block">⟳</span> Generando…</> : <><Sparkles size={11} /> Sugerir con IA</>}
                  </button>
                </div>
                <textarea
                  value={bData.cadenaImpacto}
                  onChange={e => setBData(p => ({ ...p, cadenaImpacto: e.target.value }))}
                  rows={3}
                  placeholder="Ej. Solicitud informal → TI sin priorización → accesos retrasados 7–10 días → empleado sin herramientas → baja productividad → costos de espera → riesgo de rotación temprana."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
                {bData.cadenaImpacto.trim() && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>Cadena registrada</span>
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════
                  2. ESTADO ACTUAL DE MEDICIÓN
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <BarChart2 size={14} className="text-slate-400" />
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Estado actual de medición <span className="text-red-500">*</span></p>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm text-slate-600">¿Hoy se está midiendo algo sobre este reto?</p>
                  <div className="space-y-2">
                    {([
                      { v: 'si',      label: 'Sí, ya se mide',                icon: '📊', desc: 'Hay datos o métricas activas sobre este problema.' },
                      { v: 'parcial', label: 'Se mide parcialmente (datos sueltos)', icon: '📋', desc: 'Hay algo, pero falta sistematizarlo.' },
                      { v: 'no',      label: 'No se mide todavía',             icon: '❓', desc: 'No hay datos formales. Lo registramos y definimos cómo medirlo.' },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setBData(p => ({ ...p, estadoMedicion: opt.v }))}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          bData.estadoMedicion === opt.v
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-base shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="flex-1">
                          <p className={`text-sm ${bData.estadoMedicion === opt.v ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: bData.estadoMedicion === opt.v ? 600 : 500 }}>{opt.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center ${bData.estadoMedicion === opt.v ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                          {bData.estadoMedicion === opt.v && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Condicional: Sí */}
                  {bData.estadoMedicion === 'si' && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Fuente donde está el dato <span className="text-red-500">*</span></label>
                        <input
                          value={bData.mFuente}
                          onChange={e => setBData(p => ({ ...p, mFuente: e.target.value }))}
                          placeholder="Ej. Dashboard de RRHH, sistema SAP, Excel de gerencia"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Frecuencia de actualización</label>
                        <input
                          value={bData.mFrecuencia}
                          onChange={e => setBData(p => ({ ...p, mFrecuencia: e.target.value }))}
                          placeholder="Ej. Mensual, por cohorte, en tiempo real"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Condicional: Parcial */}
                  {bData.estadoMedicion === 'parcial' && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>¿Qué se mide hoy? <span className="text-red-500">*</span></label>
                        <input
                          value={bData.queMideHoy}
                          onChange={e => setBData(p => ({ ...p, queMideHoy: e.target.value }))}
                          placeholder="Ej. Tiempo total de onboarding en reportes de RRHH."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>¿Qué falta medir?</label>
                        <input
                          value={bData.queFaltaMedir}
                          onChange={e => setBData(p => ({ ...p, queFaltaMedir: e.target.value }))}
                          placeholder="Ej. Tiempo específico de espera de accesos TI. Costo por ingreso."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Condicional: No */}
                  {bData.estadoMedicion === 'no' && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-xs text-slate-600 mb-2 block" style={{ fontWeight: 500 }}>¿Por qué no se mide? <span className="text-slate-400">(selecciona la razón principal)</span></label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { v: 'no_prioridad', label: 'No fue prioridad hasta ahora' },
                            { v: 'no_herramienta', label: 'No hay sistema para medirlo' },
                            { v: 'no_responsable', label: 'No hay un responsable definido' },
                            { v: 'otro', label: 'Otro motivo' },
                          ] as const).map(opt => (
                            <button
                              key={opt.v}
                              onClick={() => setBData(p => ({ ...p, porQueNo: opt.v }))}
                              className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${bData.porQueNo === opt.v ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                              style={{ fontWeight: bData.porQueNo === opt.v ? 600 : 400 }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>¿Qué dato mínimo podrías conseguir en 1 semana?</label>
                        <input
                          value={bData.datoMinimo}
                          onChange={e => setBData(p => ({ ...p, datoMinimo: e.target.value }))}
                          placeholder="Ej. Tiempo de espera promedio — preguntarle a TI esta semana."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  3. CONSTRUCTOR DE MÉTRICAS
              ════════════════════════════════════════ */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Métricas para entender el estado actual <span className="text-red-500">*</span></p>
                    <p className="text-xs text-slate-400 mt-0.5">Agrega 1–5 métricas. Empieza por la más importante. Si no tienes el dato, márcalo como "No disponible" y lo planificamos.</p>
                  </div>
                  <button
                    onClick={addMetrica}
                    disabled={bData.metricas.length >= 5}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus size={12} /> Agregar métrica
                  </button>
                </div>

                {bData.metricas.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                    <BarChart2 size={20} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 mb-3" style={{ fontWeight: 500 }}>Aún no agregaste métricas.</p>
                    <button onClick={addMetrica} className="flex items-center gap-1.5 text-xs text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors mx-auto" style={{ fontWeight: 500 }}>
                      <Plus size={12} /> Agregar primera métrica
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {bData.metricas.map((met, idx) => (
                    <div key={met.id} className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                      {/* Card header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{idx + 1}</span>
                        <p className="text-xs text-slate-600 flex-1" style={{ fontWeight: 600 }}>
                          {met.nombre || <span className="text-slate-400 italic" style={{ fontWeight: 400 }}>Nueva métrica — completa el nombre</span>}
                        </p>
                        {met.tipo && (
                          <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">{TIPO_METRICA_LABELS[met.tipo]}</span>
                        )}
                        {met.baselineNoDisponible && (
                          <span className="text-xs text-amber-600 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full">Sin dato</span>
                        )}
                        <button
                          onClick={() => removeMetrica(met.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors shrink-0 ml-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Card body */}
                      <div className="p-4 space-y-3">
                        {/* Fila 1: Nombre + Tipo */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 sm:col-span-1">
                            <label className="text-xs text-slate-500 mb-1 block" style={{ fontWeight: 500 }}>Nombre de la métrica <span className="text-red-400">*</span></label>
                            <input
                              value={met.nombre}
                              onChange={e => updateMetrica(met.id, { nombre: e.target.value })}
                              placeholder="Ej. Tiempo de espera de accesos TI"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <label className="text-xs text-slate-500 mb-1 block" style={{ fontWeight: 500 }}>Tipo / qué indica <span className="text-red-400">*</span></label>
                            <div className="flex flex-wrap gap-1.5">
                              {(['tiempo', 'cantidad', 'costo', 'calidad', 'riesgo', 'otro'] as const).map(t => (
                                <button
                                  key={t}
                                  onClick={() => updateMetrica(met.id, { tipo: t })}
                                  className={`px-2.5 py-1 rounded-lg border text-xs transition-all ${met.tipo === t ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                                  style={{ fontWeight: met.tipo === t ? 600 : 400 }}
                                >
                                  {TIPO_METRICA_LABELS[t]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Fila 2: Línea base */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Línea base actual <span className="text-red-400">*</span></label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={met.baselineNoDisponible}
                                onChange={e => updateMetrica(met.id, { baselineNoDisponible: e.target.checked, baseline: e.target.checked ? 'No disponible' : '' })}
                                className="w-3 h-3 rounded accent-indigo-600"
                              />
                              <span className="text-xs text-slate-500">No disponible aún</span>
                            </label>
                          </div>
                          {met.baselineNoDisponible ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                              <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                              <span className="text-xs text-amber-700">Dato no disponible — se incluirá en el Plan mínimo.</span>
                            </div>
                          ) : (
                            <input
                              value={met.baseline}
                              onChange={e => updateMetrica(met.id, { baseline: e.target.value })}
                              placeholder="Ej. 7–10 días promedio, $3,200 USD/empleado, NPS 42"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                          )}
                        </div>

                        {/* Fila 3: Fuente + Frecuencia */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block" style={{ fontWeight: 500 }}>Fuente</label>
                            <input
                              value={met.fuente}
                              onChange={e => updateMetrica(met.id, { fuente: e.target.value })}
                              placeholder="Ej. Registros RRHH 2024"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block" style={{ fontWeight: 500 }}>Frecuencia</label>
                            <input
                              value={met.frecuencia}
                              onChange={e => updateMetrica(met.id, { frecuencia: e.target.value })}
                              placeholder="Ej. Por ingreso, mensual"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                          </div>
                        </div>

                        {/* Fila 4: Señal de mejora + Proxy checkbox */}
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-slate-500 mb-1 block" style={{ fontWeight: 500 }}>
                              <TrendingUp size={11} className="inline mr-1 text-emerald-500" />
                              Señal de mejora <span className="text-slate-400">(umbral o dirección)</span>
                            </label>
                            <input
                              value={met.senalMejora}
                              onChange={e => updateMetrica(met.id, { senalMejora: e.target.value })}
                              placeholder="Ej. Reducción a menos de 2 días, o NPS > 70"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                          </div>
                          {/* Proxy checkbox */}
                          <div className="shrink-0 pt-5 relative">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={met.esProxy}
                                onChange={e => updateMetrica(met.id, { esProxy: e.target.checked })}
                                className="w-3.5 h-3.5 rounded accent-slate-600"
                              />
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                Es proxy
                                <button
                                  onMouseEnter={() => setProxyTooltipId(met.id)}
                                  onMouseLeave={() => setProxyTooltipId(null)}
                                  className="text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                  <HelpCircle size={11} />
                                </button>
                              </span>
                            </label>
                            {proxyTooltipId === met.id && (
                              <div className="absolute bottom-full right-0 mb-2 w-52 p-2.5 bg-slate-900 text-white rounded-xl text-xs shadow-lg z-20">
                                <p style={{ fontWeight: 600 }} className="mb-1">¿Qué es una métrica proxy?</p>
                                <p className="text-slate-300">Una métrica indirecta que aproxima lo que quieres medir. Ej. NPS como proxy de satisfacción con el onboarding.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {bData.metricas.length > 0 && bData.metricas.length < 5 && (
                  <button onClick={addMetrica} className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 py-2 border border-dashed border-slate-200 hover:border-indigo-300 rounded-xl transition-all" style={{ fontWeight: 500 }}>
                    <Plus size={12} /> Agregar otra métrica <span className="text-slate-400">({bData.metricas.length}/5)</span>
                  </button>
                )}
              </div>

              {/* ════════════════════════════════════════
                  4. PLAN MÍNIMO (condicional)
              ════════════════════════════════════════ */}
              {necesitaPlanMinimo() && (
                <div className="border-2 border-amber-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
                      <TrendingUp size={14} className="text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-800" style={{ fontWeight: 700 }}>Plan mínimo para obtener la línea base</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {bData.estadoMedicion === 'no'
                          ? 'No se mide actualmente. Define cómo obtener el primer dato.'
                          : 'Hay métricas sin dato disponible. Define cómo conseguirlo.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Qué métrica medir primero */}
                    <div>
                      <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>¿Qué métrica medir primero? <span className="text-red-400">*</span></label>
                      {bData.metricas.filter(m => m.baselineNoDisponible || bData.estadoMedicion === 'no').length > 0 ? (
                        <div className="space-y-1.5">
                          {bData.metricas.filter(m => m.baselineNoDisponible || bData.estadoMedicion === 'no').map(m => (
                            <button
                              key={m.id}
                              onClick={() => setBData(p => ({ ...p, planMetrica: m.nombre }))}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${bData.planMetrica === m.nombre ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                              style={{ fontWeight: bData.planMetrica === m.nombre ? 600 : 400 }}
                            >
                              <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${bData.planMetrica === m.nombre ? 'border-amber-500 bg-amber-500' : 'border-slate-300'}`} />
                              {m.nombre || <span className="italic text-slate-400">Métrica sin nombre</span>}
                              {m.baselineNoDisponible && <span className="ml-auto text-xs text-amber-500 px-1.5 py-0.5 bg-amber-100 rounded-full">Sin dato</span>}
                            </button>
                          ))}
                          {/* Opción manual si no hay métricas sin dato */}
                          {bData.estadoMedicion === 'no' && bData.metricas.length === 0 && (
                            <input
                              value={bData.planMetrica}
                              onChange={e => setBData(p => ({ ...p, planMetrica: e.target.value }))}
                              placeholder="Escribe el nombre de la métrica a medir primero"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          value={bData.planMetrica}
                          onChange={e => setBData(p => ({ ...p, planMetrica: e.target.value }))}
                          placeholder="Nombre de la métrica a medir primero"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
                        />
                      )}
                    </div>

                    {/* Cómo + Quién + Plazo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>¿Cómo la obtendrás? <span className="text-red-400">*</span></label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['entrevista', 'sistema', 'observacion', 'documento', 'otro'] as const).map(opt => (
                            <button
                              key={opt}
                              onClick={() => setBData(p => ({ ...p, planComoObtener: opt }))}
                              className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${bData.planComoObtener === opt ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                              style={{ fontWeight: bData.planComoObtener === opt ? 600 : 400 }}
                            >
                              {PLAN_COMO_LABELS[opt]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>¿Quién te lo puede dar? <span className="text-slate-400">(rol)</span></label>
                        <input
                          value={bData.planQuienDa}
                          onChange={e => setBData(p => ({ ...p, planQuienDa: e.target.value }))}
                          placeholder="Ej. Gerente de TI, Finanzas"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Plazo <span className="text-red-400">*</span></label>
                        <div className="space-y-1.5">
                          {([
                            { v: '24_72h',   label: '24–72 horas' },
                            { v: '1_semana', label: '1 semana' },
                            { v: '2_semanas',label: '2 semanas' },
                          ] as const).map(p => (
                            <button
                              key={p.v}
                              onClick={() => setBData(prev => ({ ...prev, planPlazo: p.v }))}
                              className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all ${bData.planPlazo === p.v ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                              style={{ fontWeight: bData.planPlazo === p.v ? 600 : 400 }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  RESUMEN GENERADO — MÓDULO B
              ════════════════════════════════════════ */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs text-indigo-700 mb-2.5" style={{ fontWeight: 600 }}>📋 Resumen generado — Módulo B</p>
                <div className="space-y-1.5 text-xs text-indigo-600">
                  <p>
                    <span style={{ fontWeight: 600 }}>Cadena de impacto:</span>{' '}
                    {bData.cadenaImpacto ? bData.cadenaImpacto.slice(0, 80) + (bData.cadenaImpacto.length > 80 ? '…' : '') : <span className="text-indigo-300 italic">Pendiente</span>}
                  </p>
                  <p>
                    <span style={{ fontWeight: 600 }}>Estado de medición:</span>{' '}
                    {bData.estadoMedicion === 'si' ? '✅ Se mide actualmente' : bData.estadoMedicion === 'parcial' ? '🟡 Medición parcial' : bData.estadoMedicion === 'no' ? '❌ No se mide' : <span className="text-indigo-300 italic">No seleccionado</span>}
                  </p>
                  <p>
                    <span style={{ fontWeight: 600 }}>Métricas definidas:</span>{' '}
                    {bData.metricas.length > 0 ? `${bData.metricas.length} métrica(s) · ${bData.metricas.map(m => m.nombre || 'Sin nombre').join(', ')}` : <span className="text-indigo-300 italic">Ninguna</span>}
                  </p>
                  <p>
                    <span style={{ fontWeight: 600 }}>Línea base:</span>{' '}
                    {bData.metricas.length === 0
                      ? <span className="text-indigo-300 italic">Sin métricas</span>
                      : bData.metricas.every(m => m.baseline && !m.baselineNoDisponible)
                        ? '✅ Completa en todas las métricas'
                        : bData.metricas.some(m => m.baseline && !m.baselineNoDisponible)
                          ? '🟡 Parcial — algunas métricas sin dato'
                          : '⏳ Pendiente — se requiere Plan mínimo'}
                  </p>
                  {necesitaPlanMinimo() && (
                    <p>
                      <span style={{ fontWeight: 600 }}>Plan mínimo:</span>{' '}
                      {bData.planMetrica && bData.planComoObtener && bData.planPlazo
                        ? `Medir "${bData.planMetrica}" vía ${PLAN_COMO_LABELS[bData.planComoObtener]} · Plazo: ${bData.planPlazo === '24_72h' ? '24–72h' : bData.planPlazo === '1_semana' ? '1 semana' : '2 semanas'}`
                        : <span className="text-amber-600">Incompleto — falta completar el plan</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Gating + botón */}
              {(() => {
                const missing = getModuloBMissing();
                const listo = missing.length === 0;
                return (
                  <div className="space-y-3">
                    {!listo && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-500" />
                          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Para avanzar a Restricciones, completa:</p>
                        </div>
                        <ul className="space-y-1">
                          {missing.map((m, i) => (
                            <li key={i} className="text-xs text-amber-700 flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => listo && setActiveModule('C')}
                      disabled={!listo}
                      className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${listo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {listo
                        ? <>Módulo B listo → Ir a Restricciones <ChevronRight size={15} /></>
                        : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODULE C: RESTRICCIONES — MVP ágil
          ══════════════════════════════════════════════════════════════ */}
          {activeModule === 'C' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo C: Restricciones</h1>
                    <StatusChip status={semaforo === 'verde' ? 'Completado' : semaforo === 'rojo' ? 'Bloqueado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-lg">
                    Define solo lo indispensable para evitar bloqueos. Esto nos ayuda a diseñar un piloto realista.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={openIAPanel} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Mejorar con IA
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SEMÁFORO — siempre visible arriba
              ════════════════════════════════════════ */}
              <div className={`border rounded-2xl p-4 ${semaforoConfig.bg}`}>
                <div className="flex items-start gap-3">
                  <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${semaforoConfig.dot}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${semaforoConfig.color}`} style={{ fontWeight: 700 }}>{semaforoConfig.label}</p>
                    <p className={`text-xs mt-1 ${semaforoConfig.color}`} style={{ opacity: 0.85 }}>{semaforoConfig.desc}</p>

                    {/* Checklist de faltantes */}
                    {semaforo !== 'verde' && (() => {
                      const faltantes: { texto: string; accion?: () => void }[] = [];
                      if (cData.limitesChips.length === 0 && !cData.limitesTexto.trim())
                        faltantes.push({ texto: 'Define al menos 1 límite no negociable (campo 1)' });
                      if (!cData.dependencia.trim())
                        faltantes.push({ texto: 'Registra la dependencia crítica (campo 2)' });
                      if (cData.dependencia.trim() && !cData.dependenciaDueno.trim())
                        faltantes.push({ texto: 'Indica el dueño de la dependencia (campo 2)' });
                      if (cData.dependencia.trim() && !cData.alternativaPiloto.trim())
                        faltantes.push({ texto: 'Define cómo pilotar sin esa dependencia (campo 3) ← bloqueante' });
                      return faltantes.length > 0 ? (
                        <div className="mt-3 pt-3 border-t border-current/10">
                          <p className={`text-xs mb-1.5 ${semaforoConfig.color}`} style={{ fontWeight: 600 }}>Qué falta:</p>
                          <ul className="space-y-1">
                            {faltantes.map((f, i) => (
                              <li key={i} className={`text-xs flex items-start gap-1.5 ${semaforoConfig.color}`}>
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                {f.texto}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  MUST 1 — Límites no negociables
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>1</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                      Límites no negociables <span className="text-slate-400" style={{ fontWeight: 400 }}>(¿qué NO podemos hacer?)</span> <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Escribe 2–4 puntos. Si una idea cruza esto, se descarta automáticamente.</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Chips sugeridos */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>Selecciona los que apliquen:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Datos sensibles',
                        'Legal / regulatorio',
                        'No interrumpir operación',
                        'Seguridad de la información',
                        'Presupuesto cero',
                        'Sin cambios en sistemas',
                      ].map(chip => {
                        const selected = cData.limitesChips.includes(chip);
                        return (
                          <button
                            key={chip}
                            onClick={() => setCData(p => ({
                              ...p,
                              limitesChips: selected
                                ? p.limitesChips.filter(c => c !== chip)
                                : [...p.limitesChips, chip],
                            }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${
                              selected
                                ? 'border-red-400 bg-red-50 text-red-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                            style={{ fontWeight: selected ? 600 : 400 }}
                          >
                            {selected && <X size={10} className="text-red-400" />}
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Límites adicionales libres */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>¿Hay otros límites específicos de tu contexto?</label>
                    <textarea
                      value={cData.limitesTexto}
                      onChange={e => setCData(p => ({ ...p, limitesTexto: e.target.value }))}
                      rows={2}
                      placeholder="Ej. No involucrar contratistas externos en la fase de descubrimiento. No modificar flujos que afecten a clientes."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  {/* Confirmación */}
                  {(cData.limitesChips.length > 0 || cData.limitesTexto.trim()) && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <CheckCircle2 size={13} className="text-red-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-red-700">
                        <span style={{ fontWeight: 600 }}>Límites registrados:</span>{' '}
                        {[...cData.limitesChips, cData.limitesTexto.trim()].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  MUST 2 — Dependencia crítica
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>2</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                      Posible bloqueo <span className="text-slate-400" style={{ fontWeight: 400 }}>(dependencia crítica)</span> <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">¿De qué área o sistema dependes para que esto funcione?</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Dependencia + Dueño */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>¿De qué depende el piloto? <span className="text-red-400">*</span></label>
                      <input
                        value={cData.dependencia}
                        onChange={e => setCData(p => ({ ...p, dependencia: e.target.value }))}
                        placeholder="Ej. Área de TI para gestionar accesos al sistema. API de nómina. Aprobación de legal."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>Dueño (área / rol)</label>
                      <input
                        value={cData.dependenciaDueno}
                        onChange={e => setCData(p => ({ ...p, dependenciaDueno: e.target.value }))}
                        placeholder="Ej. Gerente de TI, Legal, Finanzas"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>Probabilidad de demora</label>
                      <div className="flex gap-2">
                        {([
                          { v: 'baja',  label: 'Baja',  color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                          { v: 'media', label: 'Media', color: 'border-amber-300 bg-amber-50 text-amber-700' },
                          { v: 'alta',  label: 'Alta',  color: 'border-red-300 bg-red-50 text-red-700' },
                        ] as const).map(opt => (
                          <button
                            key={opt.v}
                            onClick={() => setCData(p => ({ ...p, dependenciaProbabilidad: opt.v }))}
                            className={`flex-1 py-2 rounded-xl border text-xs transition-all ${
                              cData.dependenciaProbabilidad === opt.v
                                ? opt.color
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                            style={{ fontWeight: cData.dependenciaProbabilidad === opt.v ? 600 : 400 }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Aviso si probabilidad alta */}
                  {cData.dependenciaProbabilidad === 'alta' && cData.dependencia.trim() && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Dependencia de riesgo alto.</span>{' '}
                        El semáforo se mantendrá en Amarillo hasta que definas una alternativa para pilotar (campo 3).
                        {!cData.dependenciaDueno.trim() && ' Además, falta el dueño.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  MUST 3 — Alternativa para pilotear
              ════════════════════════════════════════ */}
              <div className={`border rounded-2xl overflow-hidden bg-white ${cData.dependencia.trim() && !cData.alternativaPiloto.trim() ? 'border-red-300' : 'border-slate-200'}`}>
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>3</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                      Alternativa para pilotear sin esa dependencia <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">¿Cómo lo probamos en pequeño si la dependencia no está lista?</p>
                  </div>
                  {cData.dependencia.trim() && !cData.alternativaPiloto.trim() && (
                    <span className="text-xs text-red-500 px-2 py-1 bg-red-50 rounded-lg border border-red-200 shrink-0" style={{ fontWeight: 500 }}>Bloqueante</span>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <textarea
                    value={cData.alternativaPiloto}
                    onChange={e => setCData(p => ({ ...p, alternativaPiloto: e.target.value }))}
                    rows={3}
                    placeholder="Ej. Manual + registro en Excel compartido → formulario web simple → piloto con 10 casos antes de integrar el sistema."
                    className={`w-full border rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none ${cData.dependencia.trim() && !cData.alternativaPiloto.trim() ? 'border-red-200' : 'border-slate-200'}`}
                  />
                  {/* Ejemplos rápidos */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-slate-400" style={{ fontWeight: 500 }}>Ejemplos:</span>
                    {[
                      'Manual + registro en hoja compartida',
                      'Formulario + Excel de seguimiento',
                      'Piloto con 10 casos primero',
                      'WhatsApp + checklist impreso',
                    ].map(ej => (
                      <button
                        key={ej}
                        onClick={() => setCData(p => ({ ...p, alternativaPiloto: p.alternativaPiloto ? `${p.alternativaPiloto}\n${ej}` : ej }))}
                        className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors"
                      >
                        + {ej}
                      </button>
                    ))}
                  </div>
                  {cData.alternativaPiloto.trim() && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>Alternativa registrada — el semáforo puede avanzar.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  OPCIONALES — colapsados por defecto
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowOpcionalesC(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600" style={{ fontWeight: 600 }}>Opcional <span className="text-slate-400" style={{ fontWeight: 400 }}>(si ya lo tienes claro)</span></span>
                    {(cData.vistoBueno.trim() || cData.capacidadReal.trim()) && (
                      <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded-full">
                        {[cData.vistoBueno.trim() && 'visto bueno', cData.capacidadReal.trim() && 'capacidad'].filter(Boolean).join(' · ')} completado
                      </span>
                    )}
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${showOpcionalesC ? 'rotate-180' : ''}`} />
                </button>
                {showOpcionalesC && (
                  <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-100">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>¿Quién daría el visto bueno para continuar? <span className="text-slate-400">(rol o nombre)</span></label>
                      <input
                        value={cData.vistoBueno}
                        onChange={e => setCData(p => ({ ...p, vistoBueno: e.target.value }))}
                        placeholder="Ej. Directora de RRHH, Comité de innovación, Gerente General"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                      <p className="text-xs text-slate-400 mt-1">No es requerido para avanzar, pero ayuda a anticipar el proceso de validación.</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>Capacidad disponible del equipo</label>
                      <input
                        value={cData.capacidadReal}
                        onChange={e => setCData(p => ({ ...p, capacidadReal: e.target.value }))}
                        placeholder="Ej. 2 personas de RRHH + 1 de TI, disponibles 20% de su tiempo."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                      <p className="text-xs text-slate-400 mt-1">Útil para dimensionar el alcance del piloto.</p>
                    </div>
                  </div>
                )}
              </div>

              <BannerPorDefinir
                title="Hard gate vs. Soft gate al enviar a revisión IA"
                question="¿El sistema debe bloquear completamente el envío si faltan campos, o solo mostrar advertencias y permitir enviar de todas formas? Definir criterio de 'mínimo aceptable' para revisión IA."
                context="conflict"
              />

              {/* ════════════════════════════════════════
                  BOTÓN DE AVANCE
              ════════════════════════════════════════ */}
              <button
                onClick={() => semaforo !== 'rojo' && setActiveModule('D')}
                disabled={semaforo === 'rojo'}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${
                  semaforo === 'rojo'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : semaforo === 'amarillo'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                style={{ fontWeight: 500 }}
              >
                {semaforo === 'rojo'
                  ? <><Lock size={14} /> Define cómo pilotear sin la dependencia para continuar</>
                  : semaforo === 'amarillo'
                    ? <>Continuar de todas formas (Amarillo) — revisar antes de enviar <ChevronRight size={15} /></>
                    : <>Módulo C listo → Ir a Actores <ChevronRight size={15} /></>}
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODULE D: ACTORES Y VALIDACIÓN EN CAMPO
          ══════════════════════════════════════════════════════════════ */}
          {activeModule === 'D' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo D · Actores y validación en campo</h1>
                    <StatusChip status={moduloDListo() ? 'Completado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-lg">
                    Busca evidencia real con personas y/o datos. Al final decidimos si el reto se mantiene o se ajusta.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={openIAPanel} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Mejorar con IA
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Mini-card: Reto actual (Solo lectura) ── */}
              {cardReto.retoFrase ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target size={13} className="text-indigo-400" />
                      <p className="text-xs text-indigo-600" style={{ fontWeight: 700 }}>Reto actual (del Módulo A)</p>
                      <span className="text-xs text-indigo-300 px-1.5 py-0.5 bg-white/60 rounded ml-1" style={{ fontWeight: 400 }}>Solo lectura</span>
                    </div>
                    <button onClick={() => setActiveModule('A')} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
                      <ExternalLink size={10} /> Ver Módulo A
                    </button>
                  </div>
                  <p className="text-xs text-indigo-800 mb-3" style={{ fontWeight: 500 }}>"{cardReto.retoFrase}"</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex] && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>DÓNDE OCURRE</p>
                        <p className="text-xs text-indigo-700">Paso {asisData.quiebreIndex + 1} — {asisData.pasos[asisData.quiebreIndex]}</p>
                      </div>
                    )}
                    {asisData.consecuencia && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>CONSECUENCIA</p>
                        <p className="text-xs text-indigo-700">{asisData.consecuencia.slice(0, 80)}{asisData.consecuencia.length > 80 ? '…' : ''}</p>
                      </div>
                    )}
                    {asisData.causaInmediata && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>CAUSA INMEDIATA</p>
                        <p className="text-xs text-indigo-700">{asisData.causaInmediata.slice(0, 80)}{asisData.causaInmediata.length > 80 ? '…' : ''}</p>
                      </div>
                    )}
                    {asisData.evidenciaNota && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>EVIDENCIA</p>
                        <p className="text-xs text-indigo-700">{asisData.evidenciaNota.slice(0, 70)}{asisData.evidenciaNota.length > 70 ? '…' : ''}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                  <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 mb-2" style={{ fontWeight: 500 }}>
                      No hay reto definido en el Módulo A. Sin reto claro, no podemos validar en campo.
                    </p>
                    <button onClick={() => setActiveModule('A')} className="flex items-center gap-1 text-xs text-amber-700 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-200 transition-colors" style={{ fontWeight: 500 }}>
                      Ir al Módulo A <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  SECCIÓN 1: OBJETIVOS
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>1) ¿Qué necesitas confirmar o entender mejor? <span className="text-red-500">*</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Objetivos concretos para validar si el reto es real, importante y acotado. Define entre 1 y 3.</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Chips sugeridos */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>Sugerencias rápidas <span className="text-slate-400" style={{ fontWeight: 400 }}>(toca para agregar):</span></p>
                    <div className="flex flex-wrap gap-2">
                      {['Confirmar impacto', 'Entender causa', 'Identificar decisor', 'Conocer parches actuales', 'Acotar alcance'].map(chip => {
                        const ya = dData.objetivos.some(o => o.toLowerCase().includes(chip.toLowerCase()));
                        const lleno = dData.objetivos.filter(o => o.trim()).length >= 3;
                        return (
                          <button
                            key={chip}
                            disabled={ya || lleno}
                            onClick={() => {
                              if (ya) return;
                              const vacioIdx = dData.objetivos.findIndex(o => !o.trim());
                              if (vacioIdx !== -1) {
                                const ng = [...dData.objetivos]; ng[vacioIdx] = chip;
                                setDData(p => ({ ...p, objetivos: ng }));
                              } else if (dData.objetivos.length < 3) {
                                setDData(p => ({ ...p, objetivos: [...p.objetivos, chip] }));
                              }
                            }}
                            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${ya ? 'border-indigo-300 bg-indigo-50 text-indigo-600 cursor-default' : lleno ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer'}`}
                            style={{ fontWeight: ya ? 600 : 400 }}
                          >
                            {ya && <CheckCircle2 size={10} className="text-indigo-500" />}
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lista editable */}
                  <div className="space-y-2">
                    {dData.objetivos.map((obj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{i + 1}</span>
                        <input
                          value={obj}
                          onChange={e => { const ng = [...dData.objetivos]; ng[i] = e.target.value; setDData(p => ({ ...p, objetivos: ng })); }}
                          placeholder="Ej. Confirmar si el equipo de RRHH usa parches para compensar el retraso…"
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                        {dData.objetivos.length > 1 && (
                          <button onClick={() => setDData(p => ({ ...p, objetivos: p.objetivos.filter((_, j) => j !== i) }))}>
                            <X size={13} className="text-slate-300 hover:text-red-400 transition-colors" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {dData.objetivos.length < 3 && (
                    <button
                      onClick={() => setDData(p => ({ ...p, objetivos: [...p.objetivos, ''] }))}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Plus size={12} /> Agregar objetivo
                    </button>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 2: FUENTES
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>2) ¿A quién o qué fuente necesitas consultar? <span className="text-red-500">*</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Puedes usar entrevistas, tickets, reportes o bases de datos. Lo importante es traer evidencia.</p>
                </div>
                <div className="p-5 space-y-3">
                  {dData.fuentes.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <Users size={20} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 mb-1" style={{ fontWeight: 500 }}>Sin fuentes todavía.</p>
                      <p className="text-xs text-slate-400">Agrega la primera fuente: persona, datos o documento.</p>
                    </div>
                  )}

                  {dData.fuentes.map((fuente, fi) => (
                    <div key={fuente.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{fi + 1}</span>
                          <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Fuente {fi + 1}</p>
                        </div>
                        <button onClick={() => setDData(p => ({ ...p, fuentes: p.fuentes.filter(f => f.id !== fuente.id) }))}>
                          <Trash2 size={13} className="text-slate-300 hover:text-red-400 transition-colors" />
                        </button>
                      </div>

                      {/* Tipo de fuente */}
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 500 }}>Tipo de fuente</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['persona', 'datos', 'documento'] as const).map(tipo => (
                            <button
                              key={tipo}
                              onClick={() => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, tipo } : f) }))}
                              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs transition-colors ${fuente.tipo === tipo ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-white'}`}
                              style={{ fontWeight: fuente.tipo === tipo ? 600 : 400 }}
                            >
                              {tipo === 'persona' && <Users size={12} />}
                              {tipo === 'datos' && <BarChart2 size={12} />}
                              {tipo === 'documento' && <FileText size={12} />}
                              {tipo === 'persona' ? 'Persona' : tipo === 'datos' ? 'Datos' : 'Documento'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Rol / Nombre */}
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>
                          {fuente.tipo === 'persona' ? 'Rol / nombre' : fuente.tipo === 'datos' ? 'Sistema o fuente de datos' : 'Nombre del documento'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={fuente.rolNombre}
                          onChange={e => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, rolNombre: e.target.value } : f) }))}
                          placeholder={fuente.tipo === 'persona' ? 'Ej. Coordinadora de RRHH, Jefe de TI…' : fuente.tipo === 'datos' ? 'Ej. Dashboard RRHH, sistema SAP, Excel de gerencia…' : 'Ej. Reporte mensual de onboarding Q1 2025…'}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Por qué esta fuente</label>
                          <input
                            value={fuente.porQue}
                            onChange={e => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, porQue: e.target.value } : f) }))}
                            placeholder="Ej. Tiene el dato más cercano al quiebre…"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Qué quiero confirmar</label>
                          <input
                            value={fuente.queConfirmar}
                            onChange={e => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, queConfirmar: e.target.value } : f) }))}
                            placeholder="Ej. Si el tiempo real de espera es 7–10 días…"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setDData(p => ({ ...p, fuentes: [...p.fuentes, { id: Date.now().toString(), tipo: '', rolNombre: '', porQue: '', queConfirmar: '' }] }))}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus size={12} /> Agregar fuente
                  </button>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 3: GUÍA DE PREGUNTAS
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>3) Guía de preguntas (según la fuente)</p>
                    <p className="text-xs text-slate-400 mt-0.5">La IA sugiere preguntas diferenciadas por tipo de fuente. Edítalas libremente antes de usar.</p>
                  </div>
                  <button
                    onClick={() => {
                      setGenerandoGuia(true);
                      setTimeout(() => {
                        const nuevasGuias: Record<string, string[]> = {};
                        dData.fuentes.forEach(f => {
                          if (f.tipo === 'persona') {
                            const esLider = ['jefe', 'gerente', 'director', 'líder', 'lider', 'coordinador'].some(kw => f.rolNombre.toLowerCase().includes(kw));
                            nuevasGuias[f.id] = esLider ? [
                              '¿Cómo describirías el impacto de este problema en tu área?',
                              '¿Qué tan urgente es resolverlo para el negocio en el próximo trimestre?',
                              '¿Cuántos casos aproximados ocurren por mes? ¿Tienes un registro?',
                              '¿Qué indicadores usas para saber si el proceso funciona bien?',
                              '¿Quién tiene la autoridad para aprobar cambios en este proceso?',
                              '¿Qué intentaron antes para solucionar esto y por qué no funcionó?',
                            ] : [
                              '¿Puedes contarme la última vez que te pasó esto? ¿Qué hiciste?',
                              '¿Cómo lo resuelves cuando ocurre? ¿Tienes algún workaround?',
                              '¿Con qué frecuencia pasa? ¿Cuánto tiempo te consume cuando ocurre?',
                              '¿Qué es lo que más te frustra del proceso actual?',
                              '¿A quién más afecta directamente cuando sucede?',
                              '¿Qué cambiaría para ti si esto estuviera resuelto?',
                              '¿Tienes algún registro o dato que muestre el problema?',
                            ];
                          } else if (f.tipo === 'datos') {
                            nuevasGuias[f.id] = [
                              '¿Cuántos casos del proceso se registran por mes o trimestre?',
                              '¿Existe un campo que capture el tiempo de espera o el punto de quiebre?',
                              '¿Cómo podríamos calcular el costo por caso no resuelto o retrasado?',
                              '¿Qué proxy podríamos usar si no existe el dato exacto?',
                              '¿Quién es el dueño del sistema y puede darnos acceso al dato?',
                            ];
                          } else {
                            nuevasGuias[f.id] = [
                              '¿Este documento tiene el dato exacto que necesitamos o es parcial?',
                              '¿Cuándo fue la última actualización de este reporte?',
                              '¿Qué tan representativa es la muestra del período analizado?',
                              '¿Hay otra fuente que complemente o valide este documento?',
                            ];
                          }
                        });
                        setGuiasPreguntas(nuevasGuias);
                        setGenerandoGuia(false);
                      }, 1800);
                    }}
                    disabled={dData.fuentes.length === 0 || generandoGuia}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    {generandoGuia ? <><span className="animate-spin inline-block">⟳</span> Generando…</> : <><Sparkles size={11} /> Generar guía con IA</>}
                  </button>
                </div>
                <div className="p-5 space-y-5">
                  {dData.fuentes.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 italic">Agrega fuentes en la sección anterior para generar preguntas.</p>
                  ) : (
                    dData.fuentes.map(fuente => (
                      <div key={fuente.id}>
                        <div className="flex items-center gap-2 mb-2">
                          {fuente.tipo === 'persona' && <Users size={12} className="text-indigo-400" />}
                          {fuente.tipo === 'datos' && <BarChart2 size={12} className="text-violet-400" />}
                          {fuente.tipo === 'documento' && <FileText size={12} className="text-slate-400" />}
                          {!fuente.tipo && <span className="w-3 h-3 rounded-full bg-slate-200 inline-block shrink-0" />}
                          <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>
                            {fuente.rolNombre || `Fuente ${dData.fuentes.indexOf(fuente) + 1} (sin nombre)`}
                            {fuente.tipo && <span className="ml-1.5 text-slate-400" style={{ fontWeight: 400 }}>· {fuente.tipo === 'persona' ? 'Persona' : fuente.tipo === 'datos' ? 'Datos' : 'Documento'}</span>}
                          </p>
                        </div>
                        {guiasPreguntas[fuente.id] ? (
                          <div className="space-y-1.5 pl-4 border-l-2 border-indigo-100">
                            {guiasPreguntas[fuente.id].map((preg, pi) => (
                              <div key={pi} className="flex items-start gap-2">
                                <span className="text-slate-400 text-xs shrink-0 mt-1.5">{pi + 1}.</span>
                                <input
                                  value={preg}
                                  onChange={e => {
                                    const copia = { ...guiasPreguntas };
                                    copia[fuente.id] = [...copia[fuente.id]];
                                    copia[fuente.id][pi] = e.target.value;
                                    setGuiasPreguntas(copia);
                                  }}
                                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="pl-4 py-2 border-l-2 border-slate-100">
                            <p className="text-xs text-slate-400 italic">Sin preguntas generadas aún. Toca "Generar guía con IA" para obtenerlas.</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {dData.fuentes.length > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Guardarrail IA:</span> La IA sugiere preguntas, no inventa entrevistas ni datos. Los hallazgos los registras tú en la sección de evidencia.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 4: EVIDENCIA MÍNIMA
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    4) Sube evidencia de lo que encontraste <span className="text-slate-400 text-xs" style={{ fontWeight: 400 }}>(mínimo 2 si es posible)</span> <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ideal: 1 evidencia de voz (nota/testimonio) + 1 evidencia dura (dato/ticket/reporte). Si no hay dato exacto, permite proxy.
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  {dData.evidencias.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <Upload size={20} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 mb-1" style={{ fontWeight: 500 }}>Todavía no agregaste evidencia.</p>
                      <p className="text-xs text-slate-400">Agrega notas, testimonios, datos, capturas o reportes de lo que encontraste.</p>
                    </div>
                  )}

                  {dData.evidencias.map((ev, ei) => (
                    <div key={ev.id} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Evidencia {ei + 1}</p>
                        <button onClick={() => setDData(p => ({ ...p, evidencias: p.evidencias.filter(e => e.id !== ev.id) }))}>
                          <Trash2 size={13} className="text-slate-300 hover:text-red-400 transition-colors" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>¿Qué es? <span className="text-red-500">*</span></label>
                        <div className="flex flex-wrap gap-2">
                          {(['nota', 'audio', 'captura', 'link', 'reporte'] as const).map(tipo => (
                            <button
                              key={tipo}
                              onClick={() => setDData(p => ({ ...p, evidencias: p.evidencias.map(e => e.id === ev.id ? { ...e, tipo } : e) }))}
                              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${ev.tipo === tipo ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                              style={{ fontWeight: ev.tipo === tipo ? 600 : 400 }}
                            >{tipo}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Nombre o descripción breve</label>
                        <input
                          value={ev.nombre}
                          onChange={e => setDData(p => ({ ...p, evidencias: p.evidencias.map(ev2 => ev2.id === ev.id ? { ...ev2, nombre: e.target.value } : ev2) }))}
                          placeholder="Ej. Testimonio de Coordinadora RRHH · Reunión 18 feb"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué demuestra? <span className="text-red-500">*</span></label>
                        <input
                          value={ev.queDemuestra}
                          onChange={e => setDData(p => ({ ...p, evidencias: p.evidencias.map(ev2 => ev2.id === ev.id ? { ...ev2, queDemuestra: e.target.value } : ev2) }))}
                          placeholder="Ej. Confirma que el tiempo promedio es 8–10 días según registro de RRHH."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  ))}

                  {dData.evidencias.length === 1 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Recomendación:</span> Tienes 1 evidencia. Lo ideal es tener 2 (1 de voz + 1 dura). Puedes avanzar con 1, pero el reto quedará menos fundamentado.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setDData(p => ({ ...p, evidencias: [...p.evidencias, { id: Date.now().toString(), tipo: '', nombre: '', queDemuestra: '' }] }))}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus size={12} /> Agregar evidencia
                  </button>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 5: DECISIÓN SOBRE EL RETO
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>5) Con lo aprendido, ¿qué pasa con el reto? <span className="text-red-500">*</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Basándote en la evidencia recopilada, decide si el reto sigue igual o necesita ajustarse.</p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="space-y-2">
                    {([
                      { v: 'mantiene', label: 'Se mantiene', desc: 'La evidencia confirma el reto tal como lo definimos. Seguimos adelante.', colorBorder: 'border-emerald-400', colorBg: 'bg-emerald-50', colorText: 'text-emerald-700', colorDot: 'border-emerald-500 bg-emerald-500' },
                      { v: 'ajusta', label: 'Se ajusta', desc: 'El reto sigue siendo válido, pero hay detalles que aclarar: alcance, causa o consecuencia.', colorBorder: 'border-amber-400', colorBg: 'bg-amber-50', colorText: 'text-amber-700', colorDot: 'border-amber-500 bg-amber-500' },
                      { v: 'cambia', label: 'Cambia', desc: 'La evidencia muestra que el reto original no era el correcto. Lo redefinimos.', colorBorder: 'border-red-400', colorBg: 'bg-red-50', colorText: 'text-red-700', colorDot: 'border-red-500 bg-red-500' },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setDData(p => ({ ...p, decisionReto: opt.v }))}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          dData.decisionReto === opt.v
                            ? `${opt.colorBorder} ${opt.colorBg}`
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${dData.decisionReto === opt.v ? opt.colorDot : 'border-slate-300'}`} />
                        <div>
                          <p className={`text-sm ${dData.decisionReto === opt.v ? opt.colorText : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{opt.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {(dData.decisionReto === 'ajusta' || dData.decisionReto === 'cambia') && (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Nueva versión del reto en 1 frase <span className="text-red-500">*</span></label>
                        <textarea
                          value={dData.nuevaVersionReto}
                          onChange={e => setDData(p => ({ ...p, nuevaVersionReto: e.target.value }))}
                          rows={2}
                          placeholder='Hoy [proceso] se rompe en [nuevo paso o causa], causando [nueva consecuencia].'
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>¿Qué cambió? <span className="text-slate-400" style={{ fontWeight: 400 }}>(selecciona lo que aplique)</span></label>
                        <div className="flex flex-wrap gap-2">
                          {(['Alcance', 'Causa', 'Consecuencia', 'Paso del proceso'] as const).map(item => {
                            const sel = dData.queAjusto.includes(item);
                            return (
                              <button
                                key={item}
                                onClick={() => setDData(p => ({
                                  ...p,
                                  queAjusto: sel ? p.queAjusto.filter(q => q !== item) : [...p.queAjusto, item]
                                }))}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sel ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                                style={{ fontWeight: sel ? 600 : 400 }}
                              >{item}</button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 6: RESUMEN GENERADO
              ════════════════════════════════════════ */}
              {dData.decisionReto && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Resumen generado — Módulo D</p>
                    <p className="text-xs text-slate-400 mt-0.5">Se actualiza automáticamente con lo que registraste.</p>
                  </div>
                  <div className="p-5 space-y-3">

                    {/* Métricas rápidas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>FUENTES CONSULTADAS</p>
                        <p className="text-lg text-indigo-800" style={{ fontWeight: 700 }}>{dData.fuentes.filter(f => f.rolNombre.trim()).length}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">
                          {dData.fuentes.filter(f => f.tipo === 'persona').length} persona(s) · {dData.fuentes.filter(f => f.tipo !== 'persona' && f.tipo).length} dato(s)/doc
                        </p>
                      </div>
                      <div className={`border rounded-xl p-3 ${dData.decisionReto === 'mantiene' ? 'bg-emerald-50 border-emerald-100' : dData.decisionReto === 'ajusta' ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                        <p className={`text-xs mb-0.5 ${dData.decisionReto === 'mantiene' ? 'text-emerald-400' : dData.decisionReto === 'ajusta' ? 'text-amber-400' : 'text-red-400'}`} style={{ fontWeight: 600, letterSpacing: '0.04em' }}>DECISIÓN</p>
                        <p className={`text-sm ${dData.decisionReto === 'mantiene' ? 'text-emerald-800' : dData.decisionReto === 'ajusta' ? 'text-amber-800' : 'text-red-800'}`} style={{ fontWeight: 700 }}>
                          {dData.decisionReto === 'mantiene' ? '✓ Reto se mantiene' : dData.decisionReto === 'ajusta' ? '↻ Reto se ajusta' : '⟳ Reto cambia'}
                        </p>
                        {dData.queAjusto.length > 0 && (
                          <p className="text-xs text-amber-600 mt-0.5">{dData.queAjusto.join(', ')}</p>
                        )}
                      </div>
                    </div>

                    {/* Hallazgos */}
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>Hallazgos principales</p>
                      <ul className="space-y-1.5">
                        {dData.evidencias.filter(e => e.queDemuestra.trim()).slice(0, 3).map((ev, i) => (
                          <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                            <span className="text-indigo-400 shrink-0 mt-0.5">·</span>
                            <span>{ev.queDemuestra}</span>
                          </li>
                        ))}
                        {dData.evidencias.filter(e => e.queDemuestra.trim()).length === 0 && (
                          <li className="text-xs text-slate-400 italic">Agrega evidencia con "¿qué demuestra?" para ver los hallazgos aquí.</li>
                        )}
                      </ul>
                    </div>

                    {/* Señal de impacto */}
                    {dData.objetivos.filter(o => o.trim()).length > 0 && (
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <p className="text-xs text-indigo-500 mb-1.5" style={{ fontWeight: 600 }}>Señal de impacto</p>
                        <p className="text-xs text-indigo-700">
                          · {dData.objetivos.filter(o => o.trim())[0]} {dData.evidencias.length > 0 ? `— validado con ${dData.evidencias.length} evidencia(s)` : '(pendiente de validar con evidencia)'}
                        </p>
                      </div>
                    )}

                    {/* Reto final */}
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>Reto final en 1 frase</p>
                      <p className="text-xs text-slate-700" style={{ fontWeight: 500 }}>
                        {(dData.decisionReto === 'ajusta' || dData.decisionReto === 'cambia') && dData.nuevaVersionReto.trim()
                          ? `"${dData.nuevaVersionReto}"`
                          : cardReto.retoFrase
                            ? `"${cardReto.retoFrase}"`
                            : <span className="italic text-slate-400">Sin definir todavía.</span>
                        }
                      </p>
                    </div>

                    {/* Botones IA + Mentor */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={openIAPanel}
                        className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <Sparkles size={11} /> Mejorar con IA
                      </button>
                      <button
                        onClick={() => setShowMentorModal(true)}
                        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-700 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <MessageSquare size={11} /> Mentor
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Gating + CTA ── */}
              {(() => {
                const missing = getModuloDMissing();
                const listo = missing.length === 0;
                return (
                  <div className="space-y-3">
                    {!listo && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-500" />
                          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Completa estos campos para ir a Síntesis:</p>
                        </div>
                        <ul className="space-y-1">
                          {missing.map((m, i) => <li key={i} className="text-xs text-amber-700">· {m}</li>)}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => listo && setActiveModule('S')}
                      disabled={!listo}
                      className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${listo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {listo ? <>Módulo D listo → Ir a Síntesis <ChevronRight size={15} /></> : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Module S: Síntesis + Pivot Check */}
          {activeModule === 'S' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Síntesis y Pivot Check</h1>
                <p className="text-sm text-slate-500">Integra los aprendizajes de todos los módulos y decide si continúas, ajustas o replanteas el desafío.</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700 space-y-1">
                <p style={{ fontWeight: 600 }}>Ancla del desafío (de tus módulos anteriores):</p>
                <p><span style={{ fontWeight: 500 }}>Quiebre:</span> {asisData.quiebre || '—'}</p>
                <p><span style={{ fontWeight: 500 }}>Métrica principal:</span> {bData.metricas[0]?.nombre || '—'} · {bData.metricas[0]?.baseline || '—'}</p>
                <p><span style={{ fontWeight: 500 }}>Visto bueno:</span> {cData.vistoBueno || '—'} · Semáforo: {semaforo}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                  Resumen integrado <span className="text-xs text-slate-400">(v{sintesisData.version})</span>
                </label>
                <textarea value={sintesisData.resumen} onChange={e => setSintesisData(p => ({ ...p, resumen: e.target.value }))} rows={5} placeholder="Integra en 3-5 oraciones: el proceso actual, el quiebre, el impacto medible, las restricciones y los actores clave. Debe ser coherente y sin contradicciones." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 500 }}>Pivot Check obligatorio <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'mantener', label: 'Mantener', desc: 'El desafío es correcto, sigo adelante.' },
                    { v: 'acotar', label: 'Acotar', desc: 'Reduzco el alcance para hacerlo viable.' },
                    { v: 'reformular', label: 'Reformular', desc: 'Redefiní el problema con nueva información.' },
                    { v: 'cambiar', label: 'Cambiar', desc: 'El desafío original no es el correcto.' },
                  ] as const).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setSintesisData(p => ({ ...p, pivotCheck: opt.v }))}
                      className={`text-left px-3 py-3 rounded-xl border transition-colors ${sintesisData.pivotCheck === opt.v ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <p className={`text-sm ${sintesisData.pivotCheck === opt.v ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {sintesisData.pivotCheck && sintesisData.pivotCheck !== 'mantener' && (
                  <div className="mt-3">
                    <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Razón del cambio (breve)</label>
                    <input value={sintesisData.razonPivot} onChange={e => setSintesisData(p => ({ ...p, razonPivot: e.target.value }))} placeholder="¿Qué descubriste que te hizo tomar esta decisión?" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                )}
              </div>

              {/* Send to review */}
              <div className="border-t border-slate-200 pt-5">
                <button
                  onClick={() => setShowSendModal(true)}
                  disabled={!sintesisData.pivotCheck || !sintesisData.resumen.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <Send size={15} /> Enviar a revisión IA
                </button>
                {(!sintesisData.pivotCheck || !sintesisData.resumen.trim()) && (
                  <div className="flex items-center gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    <AlertCircle size={12} />
                    <div>
                      <p style={{ fontWeight: 500 }}>Ver faltantes antes de enviar:</p>
                      {!sintesisData.resumen.trim() && <p>· Escribe el resumen integrado</p>}
                      {!sintesisData.pivotCheck && <p>· Selecciona tu Pivot Check</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* IA Feedback */}
              {hasFeedback && (
                <FeedbackIAPanel feedback={MOCK_FEEDBACK_IA} onIterate={() => setActiveModule('A')} />
              )}

              {/* Mentor session */}
              {hasFeedback && MOCK_FEEDBACK_IA.status === 'Aprobado' && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <p className="text-sm text-amber-800 mb-1" style={{ fontWeight: 600 }}>Sesión con experto obligatoria</p>
                  <p className="text-xs text-amber-600 mb-3">La IA aprobó el Step 1. Ahora debes agendar la sesión con tu mentor para obtener la aprobación final y desbloquear el Step 2.</p>
                  <button onClick={() => setShowSessionModal(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                    <Calendar size={14} /> Agendar sesión con mentor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Send to IA Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>¿Listo para enviar a revisión IA?</h3>
            <p className="text-sm text-slate-500 mb-4">La IA revisará todos los módulos del Paso 1 y te dará un análisis estructurado. Asegúrate de que todo esté completo.</p>
            <div className="space-y-2 mb-5">
              {modules.slice(0, 4).map(m => (
                <div key={m.id} className={`flex items-center gap-2 text-sm ${m.completed ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {m.completed ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {m.label}
                  {!m.completed && <span className="text-xs text-amber-500">incompleto</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button
                onClick={() => { setShowSendModal(false); sendToIA(); }}
                disabled={sendingIA}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                {sendingIA ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mentor modal */}
      {showMentorModal && (
        <MentorSupportModal
          onClose={() => setShowMentorModal(false)}
        />
      )}

      {/* Session modal (placeholder) */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Agendar sesión con mentor</h3>
            <p className="text-sm text-slate-500 mb-4">El equipo de Startería confirmará la disponibilidad de tu mentor y te enviará el enlace de la reunión.</p>
            <BannerPorDefinir title="Integración de agendamiento" question="¿Se usa Calendly, Google Calendar u otro sistema? Definir el flujo exacto de agendamiento." />
            <button onClick={() => setShowSessionModal(false)} className="mt-4 w-full border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* IA Panel (sticky) */}
      {showIAPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowIAPanel(false)} />
          <div className="w-full max-w-md bg-white border-l border-slate-200 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Análisis IA</h3>
              </div>
              <button onClick={() => setShowIAPanel(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {iaLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin" />
                <p className="text-sm text-slate-500">Analizando tu Módulo A…</p>
              </div>
            ) : (
              <FeedbackIAPanel feedback={MOCK_FEEDBACK_IA} onIterate={() => { setShowIAPanel(false); setActiveModule('A'); }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
