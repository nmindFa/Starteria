import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, ChevronRight, Plus, X, Sparkles, Lock, Send, Calendar,
  CheckCircle2, AlertCircle, Lightbulb, Target, ChevronDown, MessageSquare, HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { EvidenceUploader } from '../components/EvidenceUploader';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';
import { ActionFieldCard } from '../components/ActionFieldCard';
import { PreviewCard } from '../components/PreviewCard';
import { CollapsibleSection } from '../components/CollapsibleSection';

type ModuleId = 'A' | 'B' | 'C' | 'D';

interface Idea { id: string; text: string; cluster?: string }

interface Finalista {
  id: string;
  ideaId: string;
  text: string;
  cluster: string;
  deseable: number;
  viable: number;
  factible: number;
  impacto: number;
  esfuerzo: number;
  razon: string;
  checks: { hmw: boolean; pronto: boolean; diferente: boolean };
}

type ModuleDCardType = 'solution' | 'test';

interface ModuleDIAContext {
  card: ModuleDCardType;
  field: string;
  label: string;
  suggestions: string[];
}

const MOCK_FEEDBACK_S2 = {
  status: 'Aprobado' as const,
  summary: 'Excelente trabajo de divergencia y convergencia. El HMW está bien alineado con el reto identificado en Step 1 y la Matriz DVF es sólida.',
  goodPoints: ['HMW claro y accionable', '12 ideas generadas con buena diversidad', 'Matriz DVF con scoring justificado', 'Solution Card y Test Card completas'],
  missing: [],
  actions: [],
  questions: ['¿Cómo validarán la hipótesis de valor antes del experimento piloto?'],
  timestamp: '2025-02-19T11:00:00Z',
};

export function Step2Page() {
  const { projectId } = useParams();
  const { projects, setCurrentProject } = useApp();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === projectId);
  const step = project?.steps.find(s => s.number === 2);

  const [activeModule, setActiveModule] = useState<ModuleId>('A');
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const solutionRef = useRef<HTMLDivElement | null>(null);
  const testRef = useRef<HTMLDivElement | null>(null);

  // HMW helpers
  const [showHelpA, setShowHelpA] = useState(false);
  const [hmwManualChecks, setHmwManualChecks] = useState({ roles: false, variedad: false });
  const [hmwIAFeedback, setHmwIAFeedback] = useState<null | { ok: boolean; msg: string; tips: string[] }>(null);
  const [hmwIALoading, setHmwIALoading] = useState(false);
  const [showMentorHMW, setShowMentorHMW] = useState(false);

  // Module B helpers
  const [showReglas, setShowReglas] = useState(false);
  const [activeRonda, setActiveRonda] = useState(1);
  const [iaBLoading, setIaBLoading] = useState(false);
  const [iaBDisparadores, setIaBDisparadores] = useState<string[] | null>(null);
  const [showInspiración, setShowInspiración] = useState(false);
  const [inspiracion, setInspiracion] = useState({ sector: '', link: '', queHacen: '', queCopias: '' });
  const [newIdeaCluster, setNewIdeaCluster] = useState('');
  const [showGroupView, setShowGroupView] = useState(false);
  const [editingIdeaCluster, setEditingIdeaCluster] = useState<string | null>(null);
  const [showIdeasCreativas, setShowIdeasCreativas] = useState(false);

  // Module C helpers
  const [cPaso, setCPaso] = useState<1 | 2>(2);
  const [cIaFinalistasLoading, setCIaFinalistasLoading] = useState(false);
  const [cIaComparacionLoading, setCIaComparacionLoading] = useState(false);
  const [cRazonGana, setCRazonGana] = useState('Es la opción con mejor balance entre impacto y esfuerzo, y puede probarse con recursos actuales en 2 semanas.');
  const [cQueProbamos, setCQueProbamos] = useState('Formulario unificado de solicitud de accesos en Google Forms con notificación automática a TI.');
  const [finalistas, setFinalistas] = useState<Finalista[]>([
    { id: 'f1', ideaId: '2', text: 'Automatizar la solicitud de accesos con un formulario unificado', cluster: 'Automatización', deseable: 5, viable: 4, factible: 4, impacto: 4, esfuerzo: 4, razon: 'Suposición: TI puede implementar en 2 semanas. Pregunta: ¿quién es el dueño del proceso?', checks: { hmw: true, pronto: true, diferente: true } },
    { id: 'f2', ideaId: '6', text: 'Integrar el proceso de contratación con la solicitud de TI desde RRHH', cluster: 'Integración', deseable: 5, viable: 3, factible: 2, impacto: 5, esfuerzo: 2, razon: 'Suposición: SAP tiene API disponible. Pregunta: ¿cuánto tardaría la integración con SAP?', checks: { hmw: true, pronto: false, diferente: true } },
    { id: 'f3', ideaId: '3', text: 'Implementar accesos temporales pre-aprobados por perfil de cargo', cluster: 'Automatización', deseable: 4, viable: 5, factible: 4, impacto: 4, esfuerzo: 4, razon: 'Suposición: TI tiene perfiles predefinidos. Pregunta: ¿los perfiles estándar cubren el 80% de los casos?', checks: { hmw: true, pronto: true, diferente: false } },
  ]);

  const [hmw, setHmw] = useState('¿Cómo podríamos reducir el tiempo de alta en sistemas de TI para nuevos empleados, sin comprometer la seguridad de accesos?');
  const [ideas, setIdeas] = useState<Idea[]>([
    { id: '1', text: 'Crear un portal de autogestión de onboarding para TI', cluster: 'Digital' },
    { id: '2', text: 'Automatizar la solicitud de accesos con un formulario unificado', cluster: 'Automatización' },
    { id: '3', text: 'Implementar accesos temporales pre-aprobados por perfil de cargo', cluster: 'Automatización' },
    { id: '4', text: 'Generar kits de onboarding digital pre-configurados por área', cluster: 'Digital' },
    { id: '5', text: 'Crear un chatbot de acompañamiento para el empleado nuevo', cluster: 'Digital' },
    { id: '6', text: 'Integrar el proceso de contratación con la solicitud de TI desde RRHH', cluster: 'Integración' },
  ]);
  const [newIdea, setNewIdea] = useState('');

  const [shortlist, setShortlist] = useState([
    { id: '2', text: 'Formulario unificado de accesos', d: 5, v: 4, f: 4, total: 13, justificacion: 'Alta deseabilidad, viable con recursos actuales y factible en 2 sprints.' },
    { id: '6', text: 'Integración RRHH-TI', d: 5, v: 3, f: 2, total: 10, justificacion: 'Alta deseabilidad pero baja factibilidad por dependencia con SAP.' },
    { id: '3', text: 'Accesos temporales por perfil', d: 4, v: 5, f: 4, total: 13, justificacion: 'Fácil de implementar y de alto impacto operativo.' },
  ]);
  const [selectedIdea, setSelectedIdea] = useState('2');

  const [solutionCard, setSolutionCard] = useState({
    problema: 'Los nuevos empleados esperan 7-10 días para tener accesos a sistemas porque las solicitudes de TI son informales y no priorizadas.',
    usuario: 'Nuevo empleado en primeros 15 días + Coordinadora de RRHH',
    propuesta: 'Formulario digital unificado que automatiza la solicitud de accesos desde la firma del contrato, con SLA de 24 horas para TI.',
    diferenciador: 'Integración directa con el proceso de contratación de RRHH, sin dependencia de tickets manuales.',
    hipotesis: 'Si implementamos el formulario unificado, reduciremos el tiempo de alta en TI de 7 días a 1 día para el 80% de los casos.',
    supuestos: 'TI tiene capacidad técnica para implementar el formulario. RRHH adoptará el nuevo proceso. Los accesos tipo "perfil" cubren el 80% de los casos.',
  });

  const [testCard, setTestCard] = useState({
    hipotesis: 'Si automatizamos la solicitud de accesos con un formulario unificado, reduciremos el tiempo de alta en TI de 7 días a 1 día.',
    hipotesisRiesgosa: '',
    queTestan: 'Velocidad de procesamiento de solicitudes de acceso con formulario digital vs. correo informal',
    conQuien: '3 nuevos empleados que ingresan en marzo 2025',
    dondeCuando: 'Área de Tecnología · Marzo 2025',
    metodo: 'Prueba piloto con formulario Google Forms conectado a tabla de seguimiento en Sheets',
    metrica: 'Tiempo desde envío formulario hasta accesos activos · Umbral: ≤24 horas en 80% de casos',
    pasos: ['Crear formulario con campos de accesos por perfil', 'Capacitar a RRHH en 30 min', 'Enviar formulario al siguiente grupo de ingresos', 'Registrar timestamps de solicitud y activación', 'Comparar con datos históricos'],
    riesgos: 'TI puede rechazar el proceso si no hay aval directivo. Formulario no cubre casos de accesos especiales.',
    evidencia: 'Timestamps de solicitud y activación, encuesta de 3 preguntas al empleado nuevo al día 3.',
  });

  const saveState = useAutosave([hmw, ideas, shortlist, solutionCard, testCard]);

  const [showModuleDIAModal, setShowModuleDIAModal] = useState(false);
  const [moduleDIAContext, setModuleDIAContext] = useState<ModuleDIAContext | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>('');
  const moduleDIAEnabled = false;

  const hasMeaningfulValue = (value?: string) => !!value?.trim() && !/POR DEFINIR/i.test(value);
  const getIaLabel = (value?: string) => (hasMeaningfulValue(value) ? '✨ Revisar con IA' : '✨ Completar con IA');

  const getModuleDIASuggestions = (card: ModuleDCardType, field: string): string[] => {
    if (card === 'solution') {
      const map: Record<string, string[]> = {
        problema: [
          'La activación de accesos tarda más de 7 días y bloquea la productividad del nuevo ingreso.',
          'RRHH y TI operan con solicitudes informales, causando retrasos y retrabajo.',
          'No existe visibilidad del SLA de accesos durante el onboarding.'
        ],
        usuario: [
          'Nuevos empleados durante sus primeros 15 días y coordinación de RRHH.',
          'Coordinador/a de RRHH responsable del alta y equipo de TI que ejecuta accesos.',
          'Líderes de área que necesitan productividad desde el día 1.'
        ],
        propuesta: [
          'Formulario unificado de accesos disparado al firmar contrato con seguimiento en tiempo real.',
          'Flujo único RRHH->TI con checklist por perfil y alertas automáticas por SLA.',
          'Solicitud digital con plantillas de permisos predefinidos por cargo.'
        ],
        diferenciador: [
          'Se integra al flujo real de contratación y evita tickets manuales dispersos.',
          'Define ownership claro entre RRHH y TI con evidencia trazable por caso.',
          'Incluye plantillas por perfil para reducir variabilidad operativa.'
        ],
        hipotesis: [
          'Si unificamos la solicitud de accesos, reduciremos el alta de 7 días a 24 horas en 80% de casos.',
          'Si RRHH inicia la solicitud al firmar contrato, disminuyen retrasos de primer día en más de 50%.',
          'Si usamos perfiles de permisos estándar, TI podrá completar accesos sin retrabajo en 4 de 5 casos.'
        ],
        supuestos: [
          'TI cuenta con capacidad operativa para cumplir SLA de 24h en el piloto.',
          'RRHH adoptará el nuevo flujo sin volver a correo informal.',
          'Los perfiles estándar cubren al menos 80% de los casos del piloto.'
        ],
      };
      return map[field] || ['Define el campo con una frase clara y verificable.', 'Especifica contexto, actor y resultado esperado.', 'Evita texto ambiguo y términos genéricos.'];
    }

    const map: Record<string, string[]> = {
      hipotesisRiesgosa: [
        'Si TI no asume ownership del flujo, el formulario no se usará de forma consistente.',
        'Si los perfiles no cubren casos reales, no lograremos reducción de tiempos.',
        'Si RRHH no inicia el flujo al firmar contrato, no mejorará el tiempo de alta.'
      ],
      hipotesis: [
        'Si estandarizamos la solicitud, el tiempo total de activación caerá a 24h en la mayoría de casos.',
        'Si centralizamos el pedido en un único formulario, reduciremos retrabajo de TI.',
        'Si el flujo inicia antes del día 1, el colaborador tendrá accesos a tiempo.'
      ],
      queTestan: [
        'Tiempo total de solicitud a activación con formulario vs proceso actual.',
        'Cumplimiento del SLA por parte de TI en ingresos nuevos.',
        'Adopción del formulario por RRHH en los casos piloto.'
      ],
      conQuien: [
        '5 ingresos nuevos y 2 coordinadores de RRHH durante el piloto.',
        'Equipo TI de soporte + RRHH en una unidad de negocio.',
        'Casos de onboarding de una célula específica durante 2 semanas.'
      ],
      dondeCuando: [
        'Piloto en área Comercial, semana del 15 al 26 de marzo.',
        'Prueba controlada en sede central durante dos ciclos de ingreso.',
        'Ejecución en onboarding remoto del próximo corte mensual.'
      ],
      metodo: [
        'Piloto controlado con formulario y tablero compartido de seguimiento.',
        'Comparación antes/después con mismo tipo de casos y equipo operativo.',
        'Implementación de flujo mínimo en Google Forms + registro de timestamps.'
      ],
      metrica: [
        'Tiempo solicitud->acceso activo. Umbral: <=24 horas en al menos 80% de casos.',
        'Porcentaje de ingresos con acceso día 1. Umbral: >=85% durante el piloto.',
        'Retrabajos por solicitud incompleta. Umbral: <=1 retrabajo por cada 10 casos.'
      ],
      riesgos: [
        'Dependencia de disponibilidad TI en semana de cierre operativo.',
        'Casos excepcionales pueden romper el SLA acordado.',
        'Adopción incompleta de RRHH podría sesgar el resultado.'
      ],
      evidencia: [
        'Timestamps de envío, revisión y activación por cada caso piloto.',
        'Conteo de casos en SLA vs fuera de SLA con fuente verificable.',
        'Capturas del tablero y registro semanal de incidencias.'
      ],
    };
    return map[field] || ['Describe el campo en una línea clara.', 'Incluye datos verificables cuando aplique.', 'Mantén foco en la hipótesis más riesgosa.'];
  };

  const openModuleDIA = (card: ModuleDCardType, field: string, label: string) => {
    const suggestions = getModuleDIASuggestions(card, field);
    setModuleDIAContext({ card, field, label, suggestions });
    setSelectedSuggestion(suggestions[0] || '');
    setShowModuleDIAModal(true);
  };

  const applyModuleDIASuggestion = () => {
    if (!moduleDIAContext || !selectedSuggestion.trim()) return;
    if (moduleDIAContext.card === 'solution') {
      setSolutionCard(prev => ({ ...prev, [moduleDIAContext.field]: selectedSuggestion }));
    } else {
      setTestCard(prev => ({ ...prev, [moduleDIAContext.field]: selectedSuggestion }));
    }
    setShowModuleDIAModal(false);
  };

  const getStep2Missing = () => {
    const missing: string[] = [];
    const metrica = testCard.metrica?.trim() || '';
    const hasThresholdSignal = /(umbral|<=|>=|<|>|%|por ciento|al menos|máximo|mínimo|menos de|más de|hasta|entre|\d)/i.test(metrica);

    if (!testCard.hipotesisRiesgosa?.trim())
      missing.push('Te falta la hipótesis más riesgosa. Sin eso, puedes terminar probando ‘algo’ pero no lo importante.');
    if (!metrica || !hasThresholdSignal)
      missing.push('Define la métrica y el umbral antes de ejecutar. Si no, no podrás decidir.');
    if (!testCard.evidencia?.trim())
      missing.push('Indica qué evidencia vas a guardar (mínimo timestamps o conteos).');
    const pasos = Array.isArray(testCard.pasos) ? testCard.pasos.filter(Boolean) : [];
    const last = pasos.length ? pasos[pasos.length - 1].toLowerCase() : '';
    const lastHasDecision = /(seguir|ajustar|cambiar|decisión)/i.test(last);
    if (pasos.length < 5 || pasos.length > 8 || !lastHasDecision)
      missing.push('Agrega 5–8 pasos y termina con una decisión (seguir / ajustar / cambiar).');
    return missing;
  };

  const step2Missing = getStep2Missing();
  const step2Blocked = step2Missing.length > 0;
  const summaryValues = [
    solutionCard.propuesta,
    testCard.hipotesisRiesgosa,
    testCard.metodo,
    testCard.conQuien,
    testCard.dondeCuando,
    testCard.metrica,
  ];
  const summaryHasUndefined = summaryValues.some(v => !hasMeaningfulValue(v));
  const summaryReady = !step2Blocked && !summaryHasUndefined;

  if (!project || !step) return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;

  const step1Approved = project.steps.find(s => s.number === 1)?.status === 'Aprobado';
  if (!step1Approved) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Step 2 bloqueado</h2>
        <p className="text-sm text-slate-500 mb-4">Para diseñar la solución, primero necesitas la aprobación del mentor en el Step 1.</p>
        <button onClick={() => navigate(`/projects/${projectId}/step/1`)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
          → Ir al Step 1
        </button>
      </div>
    );
  }

  // ── HMW live checks ──────────────────────────────────────────────────────────
  const hmwChecks = {
    starts: /^¿?(c|C)(ó|o)mo podr(í|i)amos/i.test(hmw.trim()),
    noSolucion: !/(app\b|chatbot|automatizar|sistema\b|crear\b|plataforma\b|herramienta\b|portal\b|\bbot\b)/i.test(hmw),
    tieneRestriccion: /\bsin\b/i.test(hmw),
    tieneRol: hmwManualChecks.roles,
    tieneVariedad: hmwManualChecks.variedad,
  };
  const hmwChecksPassed = Object.values(hmwChecks).filter(Boolean).length;
  const hmwListo = hmwChecksPassed >= 4;

  const hmwAlerts: string[] = [];
  if (hmw.trim().length > 10) {
    if (!hmwChecks.starts)
      hmwAlerts.push('Tu pregunta no empieza con "¿Cómo podríamos…?". Eso la diferencia de una tarea o solución y abre el espacio de ideas.');
    if (!hmwChecks.noSolucion)
      hmwAlerts.push('Parece que ya hay una solución en la pregunta (app, sistema, automatizar…). Describe el resultado que buscas, no cómo lograrlo.');
    if (hmwChecks.starts && !hmwChecks.tieneRestriccion && hmw.trim().split(' ').length > 8)
      hmwAlerts.push('La pregunta no menciona qué no se puede romper. Considera agregar "sin [línea roja]" para acotar el espacio de ideas.');
  }

  const handleHmwIA = () => {
    setHmwIALoading(true);
    setTimeout(() => {
      const issues: string[] = [];
      if (!hmwChecks.starts) issues.push('Empieza con "¿Cómo podríamos…?" para que sea una pregunta de ideas, no una tarea.');
      if (!hmwChecks.noSolucion) issues.push('Quita la solución de la pregunta (ej. "crear app", "automatizar"). Describe el resultado que buscas.');
      if (!hmwChecks.tieneRestriccion) issues.push('Considera agregar una restricción con "sin [línea roja]" para acotar el espacio.');
      setHmwIAFeedback(
        issues.length === 0
          ? { ok: true, msg: 'Tu pregunta tiene buena estructura. Asegúrate de que mencione a quién le pasa el problema y que abra espacio para ideas variadas.', tips: ['Revisa que el rol o persona afectada esté nombrado.', 'Verifica que la pregunta no tenga una sola respuesta obvia.'] }
          : { ok: false, msg: 'Hay puntos a revisar antes de usar esta pregunta para generar ideas:', tips: issues }
      );
      setHmwIALoading(false);
    }, 1600);
  };

  // ── Module C handlers ────────────────────────────────────────────────────────
  const addFinalista = (idea: Idea) => {
    if (finalistas.some(f => f.ideaId === idea.id) || finalistas.length >= 5) return;
    setFinalistas(p => [...p, {
      id: Date.now().toString(),
      ideaId: idea.id,
      text: idea.text,
      cluster: idea.cluster || 'Sin grupo',
      deseable: 3, viable: 3, factible: 3, impacto: 3, esfuerzo: 3,
      razon: '',
      checks: { hmw: false, pronto: false, diferente: false },
    }]);
  };

  const removeFinalista = (id: string) => {
    const removed = finalistas.find(f => f.id === id);
    setFinalistas(p => p.filter(f => f.id !== id));
    if (removed && selectedIdea === removed.ideaId) setSelectedIdea('');
  };

  const updateFinalistaScore = (id: string, key: 'deseable' | 'viable' | 'factible' | 'impacto' | 'esfuerzo', value: number) => {
    setFinalistas(p => p.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const updateFinalistaCheck = (id: string, key: 'hmw' | 'pronto' | 'diferente', value: boolean) => {
    setFinalistas(p => p.map(f => f.id === id ? { ...f, checks: { ...f.checks, [key]: value } } : f));
  };

  const handleIaCFinalistas = () => {
    setCIaFinalistasLoading(true);
    setTimeout(() => {
      const byCluster: Record<string, Idea[]> = {};
      ideas.forEach(idea => {
        if (idea.cluster) {
          if (!byCluster[idea.cluster]) byCluster[idea.cluster] = [];
          byCluster[idea.cluster].push(idea);
        }
      });
      const picked: Idea[] = [];
      Object.values(byCluster).forEach(clusterIdeas => {
        clusterIdeas.slice(0, 2).forEach(idea => { if (picked.length < 5) picked.push(idea); });
      });
      setFinalistas(picked.map((idea, i) => ({
        id: `ia-f-${Date.now()}-${i}`,
        ideaId: idea.id,
        text: idea.text,
        cluster: idea.cluster || 'Sin grupo',
        deseable: 3, viable: 3, factible: 3, impacto: 3, esfuerzo: 3,
        razon: '',
        checks: { hmw: false, pronto: false, diferente: false },
      })));
      setCIaFinalistasLoading(false);
    }, 1800);
  };

  const handleIaCComparacion = () => {
    setCIaComparacionLoading(true);
    const reasons = [
      'Suposición: TI puede implementar en 2 semanas. Pregunta: ¿quién es el dueño del proceso?',
      'Suposición: los accesos estándar cubren el 80% de casos. Pregunta: ¿TI tiene perfiles predefinidos?',
      'Suposición: el equipo adoptará el cambio. Pregunta: ¿cuánto tardaría la capacitación inicial?',
    ];
    setTimeout(() => {
      setFinalistas(prev => prev.map((f, i) => ({
        ...f,
        deseable: [5, 5, 4][i] ?? 3,
        viable:   [4, 3, 5][i] ?? 3,
        factible: [4, 2, 4][i] ?? 3,
        impacto:  [4, 5, 4][i] ?? 3,
        esfuerzo: [4, 2, 4][i] ?? 3,
        razon: reasons[i % reasons.length],
      })));
      setCIaComparacionLoading(false);
    }, 1800);
  };

  // ── Module B computed ─────────────────────────────────────────────────────────
  const uniqueClusters = [...new Set(ideas.filter(i => i.cluster).map(i => i.cluster as string))];
  const moduloBListo = ideas.length >= 10 && uniqueClusters.length >= 3;
  const ideasProgressMsg =
    ideas.length === 0 ? 'Escribe tu primera idea para arrancar.' :
    ideas.length < 5   ? `Vas bien — te faltan ${10 - ideas.length} ideas para el mínimo.` :
    ideas.length < 10  ? `¡Buen ritmo! Te faltan ${10 - ideas.length} para el mínimo de 10.` :
    ideas.length < 15  ? '¡Mínimo cumplido! ¿Puedes llegar a 15?' :
                         '¡Excelente variedad! Listo para agrupar.';

  const handleIaB = () => {
    setIaBLoading(true);
    setTimeout(() => {
      setIaBDisparadores([
        '¿Qué harías si tienes que resolver esto mañana con lo que ya tienes?',
        '¿Qué podrías quitar del proceso actual sin que cambie nada importante?',
        '¿Qué podrías unir que hoy está separado en dos pasos o dos personas?',
        '¿Qué pasaría si inviertes el orden? (el empleado pide, no TI aprueba)',
        '¿Cómo lo resolvería un servicio de delivery que promete en 30 minutos?',
        '¿Qué puede gestionar el propio empleado, sin depender de TI?',
        '¿Y si el acceso llegara antes de que el empleado llegue?',
        '¿Cómo lo haría alguien que procesa miles de solicitudes por día?',
        '¿Qué harías si no puedes gastar ni un peso más?',
        '¿Cómo simplificarías este proceso a 3 pasos máximo?',
      ]);
      setIaBLoading(false);
    }, 1800);
  };

  const modules = [
    { id: 'A' as ModuleId, label: 'A · HMW', completed: hmwListo },
    { id: 'B' as ModuleId, label: 'B · Ideas', completed: moduloBListo },
    { id: 'C' as ModuleId, label: 'C · Elegir idea', completed: !!selectedIdea && !!cRazonGana.trim() && !!cQueProbamos.trim() },
    { id: 'D' as ModuleId, label: 'D · Cards', completed: !!solutionCard.hipotesis && !!testCard.hipotesis },
  ];

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="hidden md:flex w-52 flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <h2 className="text-sm text-slate-900 mt-2" style={{ fontWeight: 600 }}>Step 2</h2>
          <p className="text-xs text-slate-500">Diseñar solución</p>
        </div>
        {modules.map(mod => (
          <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${activeModule === mod.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`} style={{ fontWeight: activeModule === mod.id ? 600 : 400 }}>
            {mod.completed ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <span className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />}
            {mod.label}
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <AutosaveIndicator state={saveState} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Ancla del reto (permanent) */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-5 text-xs text-indigo-700">
            <p style={{ fontWeight: 600 }}>🎯 Ancla del reto (Step 1)</p>
            <p className="mt-1">Quiebre en alta de sistemas TI → empleado sin accesos 7-10 días → costo operativo + experiencia negativa</p>
            <p className="mt-0.5 text-indigo-500">Líneas rojas: No comprometer datos · Decisor: Director de TI</p>
          </div>

          {/* Module A: HMW */}
          {activeModule === 'A' && (
            <div className="space-y-5">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo A · HMW — ¿Cómo podríamos?</h1>
                    <StatusChip status={hmwListo ? 'Completado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-lg">
                    Una pregunta guía para generar ideas variadas sobre el reto. Antes de inventar soluciones, necesitamos saber qué queremos mejorar y para quién.
                  </p>
                </div>
              </div>

              {/* ── Acordeón: ¿Qué tengo que hacer aquí? ── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowHelpA(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    <HelpCircle size={14} className="text-slate-400" />
                    ¿Qué tengo que hacer aquí?
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showHelpA ? 'rotate-180' : ''}`} />
                </button>
                {showHelpA && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100 space-y-4">
                    <ul className="space-y-2">
                      {[
                        'Mira el reto que trajiste del Paso 1 (está arriba, en el recuadro azul).',
                        'Escribe una pregunta que empiece con "¿Cómo podríamos…?".',
                        'Menciona a quién le pasa el problema: el rol, el área o la persona afectada.',
                        'Describe qué quieres mejorar como resultado, no la solución en sí.',
                        'Respeta al menos una línea roja que ya definiste (ej. "sin comprometer X").',
                        'No pongas la solución dentro de la pregunta. Eso viene en el módulo siguiente.',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                          <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{i + 1}</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <p className="text-xs text-indigo-700">
                        <span style={{ fontWeight: 600 }}>¿Para qué sirve esta pregunta?</span>{' '}
                        Para enfocar las ideas que vas a generar. Una buena pregunta permite sacar muchas ideas distintas, no una sola respuesta obvia.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Campo HMW ── */}
              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                  Tu pregunta guía <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={hmw}
                  onChange={e => { setHmw(e.target.value); setHmwIAFeedback(null); }}
                  rows={3}
                  placeholder="Ej. ¿Cómo podríamos reducir el tiempo que espera un empleado nuevo para tener sus accesos, sin comprometer la seguridad del sistema?"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none focus:bg-white transition-all"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Arma tu pregunta con: <span className="text-slate-600">quién tiene el problema</span> + <span className="text-slate-600">qué quieres mejorar</span> + <span className="text-slate-600">qué no se puede romper.</span>
                  <br />
                  <span className="text-slate-400">Plantilla: "¿Cómo podríamos [mejorar algo] para [quién], sin [línea roja]?"</span>
                </p>
              </div>

              {/* ── Checklist live ── */}
              {hmw.trim().length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Tu pregunta está lista si…</p>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {/* Auto-checks */}
                    {([
                      { key: 'starts', label: 'Empieza con "¿Cómo podríamos…?"', passed: hmwChecks.starts },
                      { key: 'noSol', label: 'No menciona una solución específica (app, bot, sistema…)', passed: hmwChecks.noSolucion },
                      { key: 'restriccion', label: 'Incluye una restricción o línea roja, ej. "sin [algo]"', passed: hmwChecks.tieneRestriccion },
                    ] as const).map(check => (
                      <div key={check.key} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${check.passed ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          {check.passed
                            ? <CheckCircle2 size={10} className="text-emerald-600" />
                            : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                        </div>
                        <p className={`text-xs transition-colors ${check.passed ? 'text-slate-700' : 'text-slate-400'}`}>{check.label}</p>
                        {check.passed && <span className="text-xs text-emerald-500 ml-auto">✓</span>}
                      </div>
                    ))}
                    {/* Manual checks */}
                    {([
                      { key: 'roles' as const, label: 'Nombra a quién le pasa el problema (rol o persona afectada)' },
                      { key: 'variedad' as const, label: 'Permite sacar ideas muy distintas, no una sola respuesta obvia' },
                    ]).map(check => (
                      <div key={check.key} className="flex items-center gap-2.5">
                        <button
                          onClick={() => setHmwManualChecks(p => ({ ...p, [check.key]: !p[check.key] }))}
                          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${hmwManualChecks[check.key] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white hover:border-indigo-300'}`}
                        >
                          {hmwManualChecks[check.key] && <span className="text-white text-xs">✓</span>}
                        </button>
                        <p
                          className={`text-xs cursor-pointer transition-colors ${hmwManualChecks[check.key] ? 'text-slate-700' : 'text-slate-400'}`}
                          onClick={() => setHmwManualChecks(p => ({ ...p, [check.key]: !p[check.key] }))}
                        >
                          {check.label} <span className="text-slate-300" style={{ fontWeight: 400 }}>(tú decides)</span>
                        </p>
                        {hmwManualChecks[check.key] && <span className="text-xs text-emerald-500 ml-auto">✓</span>}
                      </div>
                    ))}
                    {/* Progress bar */}
                    <div className="pt-2 mt-1 border-t border-slate-100 flex items-center gap-2.5">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`w-5 h-1.5 rounded-full transition-colors ${i < hmwChecksPassed ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        {hmwChecksPassed}/5{' '}
                        {hmwListo
                          ? <span className="text-emerald-600" style={{ fontWeight: 600 }}>¡Lista para avanzar!</span>
                          : <span className="text-slate-400">criterios cumplidos</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Alertas suaves ── */}
              {hmw.trim().length > 15 && hmwAlerts.length > 0 && (
                <div className="space-y-2">
                  {hmwAlerts.map((alert, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Ojo: </span>{alert}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── IA Feedback ── */}
              {hmwIAFeedback && (
                <div className={`border rounded-xl p-4 ${hmwIAFeedback.ok ? 'border-emerald-200 bg-emerald-50' : 'border-violet-200 bg-violet-50'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <Sparkles size={13} className={`shrink-0 mt-0.5 ${hmwIAFeedback.ok ? 'text-emerald-500' : 'text-violet-500'}`} />
                    <p className={`text-xs ${hmwIAFeedback.ok ? 'text-emerald-800' : 'text-violet-800'}`} style={{ fontWeight: 600 }}>
                      {hmwIAFeedback.ok ? '¡Tu pregunta tiene buena forma!' : 'La IA tiene sugerencias para mejorarla:'}
                    </p>
                  </div>
                  <p className={`text-xs mb-2 ml-5 ${hmwIAFeedback.ok ? 'text-emerald-700' : 'text-violet-700'}`}>{hmwIAFeedback.msg}</p>
                  {hmwIAFeedback.tips.length > 0 && (
                    <ul className="ml-5 space-y-1">
                      {hmwIAFeedback.tips.map((tip, i) => (
                        <li key={i} className={`text-xs flex items-start gap-1.5 ${hmwIAFeedback.ok ? 'text-emerald-700' : 'text-violet-700'}`}>
                          <span className="shrink-0 mt-0.5">·</span> {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ── Acciones: IA + Experto ── */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleHmwIA}
                  disabled={!hmw.trim() || hmwIALoading}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {hmwIALoading
                    ? <><span className="animate-spin inline-block">⟳</span> Revisando…</>
                    : <><Sparkles size={11} /> Pedir ayuda a la IA</>}
                </button>
                <button
                  onClick={() => setShowMentorHMW(true)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-700 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <MessageSquare size={11} /> Pedir feedback a un experto
                </button>
              </div>
              <div className="flex gap-4">
                <p className="text-xs text-slate-400">✨ La IA revisa tu pregunta y te dice qué está bien o qué ajustar.</p>
                <p className="text-xs text-slate-400">🧑‍🏫 Comparte con el mentor antes de generar ideas.</p>
              </div>

              {/* ── CTA ── */}
              {!hmwListo && hmw.trim().length > 0 && (
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <AlertCircle size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500">
                    Necesitas cumplir al menos 4 de 5 criterios para avanzar. Toca los checkboxes manuales si ya los verificaste.
                  </p>
                </div>
              )}
              <button
                onClick={() => setActiveModule('B')}
                disabled={!hmwListo}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${hmwListo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={{ fontWeight: 500 }}
              >
                {hmwListo
                  ? <>Módulo A listo → Generar ideas <ChevronRight size={15} /></>
                  : <><Lock size={14} /> Completa los criterios para avanzar</>}
              </button>
            </div>
          )}

          {/* Module B: Generación de ideas */}
          {activeModule === 'B' && (
            <div className="space-y-5">

              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo B · Generación de ideas</h1>
                  <StatusChip status={moduloBListo ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">
                  Escribe todas las ideas que se te ocurran. No filtres todavía — la meta es cantidad.
                </p>
              </div>

              {/* HMW card — prominente */}
              <div className="border-2 border-indigo-300 bg-indigo-50 rounded-2xl p-4">
                <p className="text-xs text-indigo-400 mb-2" style={{ fontWeight: 600 }}>RESPONDE ESTA PREGUNTA CON IDEAS:</p>
                <p className="text-base text-indigo-900" style={{ fontWeight: 600, lineHeight: '1.5' }}>
                  {hmw || '(Tu pregunta guía aparece aquí una vez que la completes en el Módulo A)'}
                </p>
              </div>

              {/* Input — acción principal */}
              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Agrega una idea</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={newIdea}
                    onChange={e => setNewIdea(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newIdea.trim()) {
                        setIdeas(p => [...p, { id: Date.now().toString(), text: newIdea.trim(), cluster: newIdeaCluster || undefined }]);
                        setNewIdea('');
                      }
                    }}
                    placeholder="Ej. Pedir accesos con un formulario desde el primer día"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      if (newIdea.trim()) {
                        setIdeas(p => [...p, { id: Date.now().toString(), text: newIdea.trim(), cluster: newIdeaCluster || undefined }]);
                        setNewIdea('');
                      }
                    }}
                    className="bg-indigo-600 text-white rounded-xl px-3 py-2.5 hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-slate-400">1 idea = 1 línea corta. Presiona Enter para agregar.</p>
                  <span className="text-slate-200 hidden sm:inline">·</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Grupo (opcional):</span>
                    <input
                      list="clusters-datalist"
                      value={newIdeaCluster}
                      onChange={e => setNewIdeaCluster(e.target.value)}
                      placeholder="Digital, Proceso…"
                      className="w-32 border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <datalist id="clusters-datalist">
                      {uniqueClusters.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Acuerdos del ejercicio (colapsable) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowReglas(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors">
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    <span>📋</span> Acuerdos del ejercicio
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showReglas ? 'rotate-180' : ''}`} />
                </button>
                {showReglas && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100">
                    <ul className="space-y-2">
                      {[
                        'Escribe una idea por línea, en menos de 15 palabras.',
                        'Cantidad primero: no descartes nada todavía.',
                        'Si tienes 3 ideas parecidas, busca un camino diferente.',
                        'Si una idea sale muy loca, escríbela igual y luego agrega una versión posible.',
                      ].map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="text-indigo-400 shrink-0 mt-0.5">·</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Bloque opcional: Ideas más creativas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowIdeasCreativas(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    <span>💡</span> Ideas más creativas
                    <span className="text-xs text-slate-400" style={{ fontWeight: 400 }}>(para destrabar)</span>
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showIdeasCreativas ? 'rotate-180' : ''}`} />
                </button>
                {showIdeasCreativas && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-500">Si ya tienes ideas similares y quieres explorar otros caminos, prueba alguno de estos enfoques:</p>
                    {[
                      { prueba: '¿Qué harías mañana con lo que ya tienes?', ej: '"Usar el formulario de Google que ya tenemos para pedir accesos desde el día 1"', ironman: false },
                      { prueba: '¿Qué podrías quitar, unir o invertir del proceso actual?', ej: '"Quitar el correo informal y reemplazarlo con una pantalla única de solicitud"', ironman: false },
                      { prueba: '¿Cómo lo resolvería alguien que no sabe nada del proceso?', ej: '"Una persona nueva hace la solicitud sola, sin pedirle ayuda a nadie"', ironman: false },
                      { prueba: '¿Cómo lo haría Iron Man? (y luego aterrízalo)', ej: '"Iron Man lo automatizaría todo → yo puedo automatizar solo la notificación a TI"', ironman: true },
                    ].map((enfoque, i) => (
                      <div key={i} className={`p-3 rounded-xl border ${enfoque.ironman ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                        <p className={`text-xs mb-1.5 ${enfoque.ironman ? 'text-amber-800' : 'text-slate-700'}`}>
                          <span style={{ fontWeight: 600 }}>Prueba así:</span> {enfoque.prueba}
                        </p>
                        <p className={`text-xs italic ${enfoque.ironman ? 'text-amber-600' : 'text-slate-400'}`}>
                          Ej. {enfoque.ej}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* IA: destrabarme */}
              <div>
                <button
                  onClick={handleIaB}
                  disabled={iaBLoading}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {iaBLoading
                    ? <><span className="animate-spin inline-block">⟳</span> Buscando enfoques…</>
                    : <><Sparkles size={11} /> IA: destrabarme (dame enfoques)</>}
                </button>
                <p className="text-xs text-slate-400 mt-1">Te doy enfoques y ejemplos. Tú escribes tus ideas.</p>
              </div>

              {/* Panel IA */}
              {iaBDisparadores && (
                <div className="border border-violet-200 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-violet-500" />
                      <p className="text-xs text-violet-800" style={{ fontWeight: 600 }}>Enfoques para destrabar</p>
                    </div>
                    <button onClick={() => setIaBDisparadores(null)}>
                      <X size={13} className="text-violet-400 hover:text-violet-600" />
                    </button>
                  </div>
                  <p className="text-xs text-violet-600 mb-3">Elige 1 o 2 que te resuenen y escribe al menos 1 idea para cada uno:</p>
                  <div className="space-y-1.5">
                    {iaBDisparadores.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-white border border-violet-100 rounded-xl">
                        <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-500 text-xs flex items-center justify-center shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{i + 1}</span>
                        <p className="text-xs text-slate-700">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progreso */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                ideas.length >= 10 ? 'bg-emerald-50 border-emerald-100' :
                ideas.length >= 5  ? 'bg-amber-50 border-amber-100' :
                                     'bg-slate-50 border-slate-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  ideas.length >= 10 ? 'bg-emerald-100 text-emerald-700' :
                  ideas.length >= 5  ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'
                }`} style={{ fontWeight: 700 }}>
                  {ideas.length}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${ideas.length >= 10 ? 'text-emerald-700' : ideas.length >= 5 ? 'text-amber-700' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
                    {ideasProgressMsg}
                  </p>
                  <div className="flex gap-0.5 mt-1.5">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors ${
                        i < ideas.length
                          ? ideas.length >= 10 ? 'bg-emerald-400' : 'bg-amber-400'
                          : 'bg-slate-200'
                      }`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Lista de ideas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Ideas registradas <span className="text-slate-400">({ideas.length})</span></p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowGroupView(false)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${!showGroupView ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                      style={{ fontWeight: !showGroupView ? 600 : 400 }}
                    >Lista</button>
                    <button
                      onClick={() => setShowGroupView(true)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${showGroupView ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                      style={{ fontWeight: showGroupView ? 600 : 400 }}
                    >Por grupos</button>
                  </div>
                </div>

                {!showGroupView && (
                  <div className="space-y-2">
                    {ideas.map((idea, i) => (
                      <div key={idea.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl group">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center shrink-0" style={{ fontWeight: 600 }}>{i + 1}</span>
                        <p className="flex-1 text-sm text-slate-700">{idea.text}</p>
                        {editingIdeaCluster === idea.id ? (
                          <input
                            autoFocus
                            list="clusters-datalist-edit"
                            defaultValue={idea.cluster || ''}
                            onBlur={e => {
                              setIdeas(p => p.map(id => id.id === idea.id ? { ...id, cluster: e.target.value || undefined } : id));
                              setEditingIdeaCluster(null);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            className="text-xs border border-indigo-300 rounded-lg px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingIdeaCluster(idea.id)}
                            className={`text-xs px-2 py-0.5 rounded-full transition-colors shrink-0 ${idea.cluster ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                          >
                            {idea.cluster || '+ grupo'}
                          </button>
                        )}
                        <datalist id="clusters-datalist-edit">
                          {uniqueClusters.map(c => <option key={c} value={c} />)}
                        </datalist>
                        <button onClick={() => setIdeas(p => p.filter(id => id.id !== idea.id))} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={13} className="text-slate-300 hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                    {ideas.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        Tus ideas aparecerán aquí. Empieza escribiendo arriba.
                      </div>
                    )}
                  </div>
                )}

                {showGroupView && (
                  <div className="space-y-4">
                    {uniqueClusters.length === 0 && ideas.length > 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        Asigna un grupo a tus ideas haciendo clic en "+ grupo" en cada tarjeta.
                      </div>
                    )}
                    {uniqueClusters.map(cluster => (
                      <div key={cluster}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full" style={{ fontWeight: 600 }}>{cluster}</span>
                          <span className="text-xs text-slate-400">{ideas.filter(i => i.cluster === cluster).length} idea{ideas.filter(i => i.cluster === cluster).length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-indigo-100">
                          {ideas.filter(i => i.cluster === cluster).map(idea => (
                            <p key={idea.id} className="text-sm text-slate-700 py-1">{idea.text}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                    {ideas.filter(i => !i.cluster).length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full" style={{ fontWeight: 600 }}>Sin grupo</span>
                          <span className="text-xs text-slate-400">{ideas.filter(i => !i.cluster).length}</span>
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-slate-100">
                          {ideas.filter(i => !i.cluster).map(idea => (
                            <p key={idea.id} className="text-sm text-slate-700 py-1">{idea.text}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {ideas.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        Agrega ideas primero, luego asígnales un grupo.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Agrupación en grupos */}
              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Grupos de ideas</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${uniqueClusters.length >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                    {uniqueClusters.length}/3 mínimo
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Agrupa las ideas que se parezcan y ponle un nombre a cada grupo. Haz clic en "+ grupo" en cada idea para asignarla.</p>
                {uniqueClusters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {uniqueClusters.map(c => (
                      <div key={c} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                        <span className="text-xs text-indigo-700" style={{ fontWeight: 500 }}>{c}</span>
                        <span className="text-xs text-indigo-400">· {ideas.filter(i => i.cluster === c).length}</span>
                      </div>
                    ))}
                  </div>
                )}
                {uniqueClusters.length < 3 && ideas.length >= 5 && (
                  <p className="text-xs text-amber-600 mt-2">Asigna grupos a tus ideas hasta tener mínimo 3 grupos distintos.</p>
                )}
              </div>

              {/* Opcional: Inspiración de otros sectores */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowInspiración(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    🌍 Inspiración de otros sectores
                    <span className="text-xs text-slate-400" style={{ fontWeight: 400 }}>(opcional — no bloquea)</span>
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showInspiración ? 'rotate-180' : ''}`} />
                </button>
                {showInspiración && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-500">Elige un sector, encuentra un ejemplo y escribe qué te llevas. No es obligatorio, pero puede destrabar ideas nuevas.</p>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>1. Elige un sector</label>
                      <select value={inspiracion.sector} onChange={e => setInspiracion(p => ({ ...p, sector: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Elige un sector...</option>
                        {['Delivery / Logística', 'Salud / Hospitales', 'Banca / Finanzas', 'Aeropuertos / Transporte', 'Retail / Supermercados', 'Educación', 'Otro'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>2. Link de ejemplo (opcional)</label>
                      <input value={inspiracion.link} onChange={e => setInspiracion(p => ({ ...p, link: e.target.value }))} placeholder="https://..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>3. ¿Qué hacen ellos?</label>
                      <textarea value={inspiracion.queHacen} onChange={e => setInspiracion(p => ({ ...p, queHacen: e.target.value }))} rows={2} placeholder="Describe en 1–2 líneas cómo resuelven el problema..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>4. ¿Qué te copiás o adaptás?</label>
                      <textarea value={inspiracion.queCopias} onChange={e => setInspiracion(p => ({ ...p, queCopias: e.target.value }))} rows={2} placeholder="La idea que me llevo para mi reto es..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* Evidencias (recomendado) */}
              <div>
                <p className="text-sm text-slate-700 mb-1" style={{ fontWeight: 500 }}>
                  Evidencias del proceso{' '}
                  <span className="text-slate-400 text-xs" style={{ fontWeight: 400 }}>(recomendado)</span>
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  Sube o pega algo que muestre cómo trabajaste: foto de tu lista, captura de los grupos, o link a un doc/Figma/Miro. No es obligatorio, pero ayuda al mentor a entender tu proceso.
                </p>
                <EvidenceUploader />
              </div>

              {/* Checklist de avance */}
              {!moduloBListo && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Para avanzar necesitas:</p>
                  {[
                    { ok: ideas.length >= 10, label: ideas.length >= 10 ? '10+ ideas registradas ✓' : `${ideas.length}/10 ideas — te faltan ${10 - ideas.length}` },
                    { ok: uniqueClusters.length >= 3, label: uniqueClusters.length >= 3 ? '3+ grupos creados ✓' : `${uniqueClusters.length}/3 grupos — asigna grupos a tus ideas` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        {item.ok ? <CheckCircle2 size={10} className="text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                      </div>
                      <p className={`text-xs ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={() => setActiveModule('C')}
                disabled={!moduloBListo}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${moduloBListo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={{ fontWeight: 500 }}
              >
                {moduloBListo
                  ? <>Módulo B listo → Elegir la mejor idea <ChevronRight size={15} /></>
                  : <><Lock size={14} /> Completa ideas y grupos para avanzar</>}
              </button>
            </div>
          )}

          {/* Module C: Elegir la idea a experimentar */}
          {activeModule === 'C' && (
            <div className="space-y-5">

              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo C · Elegir la idea a experimentar</h1>
                  <StatusChip status={selectedIdea && cRazonGana.trim() && cQueProbamos.trim() ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">De las ideas que generaste, elige 3–5 finalistas y quédate con 1 para experimentar.</p>
              </div>

              {/* HMW reference */}
              <div className="border border-indigo-100 bg-indigo-50 rounded-xl p-3">
                <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600 }}>PREGUNTA GUÍA:</p>
                <p className="text-xs text-indigo-800 italic">"{hmw}"</p>
              </div>

              {/* Paso tabs */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {[
                  { n: 1 as const, label: 'Paso 1 · Armar finalistas' },
                  { n: 2 as const, label: 'Paso 2 · Comparar y elegir' },
                ].map(paso => {
                  const blocked = paso.n === 2 && finalistas.length < 3;
                  return (
                    <button
                      key={paso.n}
                      onClick={() => { if (!blocked) setCPaso(paso.n); }}
                      className={`flex-1 py-2.5 text-xs transition-colors ${cPaso === paso.n ? 'bg-indigo-600 text-white' : blocked ? 'bg-white text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      style={{ fontWeight: cPaso === paso.n ? 600 : 400 }}
                    >
                      {paso.label}
                      {paso.n === 2 && finalistas.length < 3 && <span className="ml-1 opacity-60">🔒</span>}
                    </button>
                  );
                })}
              </div>

              {/* ═══ PASO 1: Armar finalistas ═══ */}
              {cPaso === 1 && (
                <div className="space-y-4">

                  {/* Counter + IA */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${finalistas.length >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                      {finalistas.length}/5 finalistas (mínimo 3)
                    </span>
                    <button
                      onClick={handleIaCFinalistas}
                      disabled={cIaFinalistasLoading || ideas.length === 0}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                      style={{ fontWeight: 500 }}
                    >
                      {cIaFinalistasLoading
                        ? <><span className="animate-spin">⟳</span> Analizando…</>
                        : <><Sparkles size={11} /> IA: ayúdame a armar finalistas</>}
                    </button>
                  </div>
                  {cIaFinalistasLoading && (
                    <p className="text-xs text-violet-500">La IA priorizará variedad de grupos y respeto de líneas rojas. No inventa ideas nuevas.</p>
                  )}

                  {/* Ideas por cluster */}
                  {uniqueClusters.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">Elige ideas de los grupos que generaste. Intenta incluir al menos 1 de cada grupo:</p>
                      {uniqueClusters.map(cluster => (
                        <div key={cluster} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full" style={{ fontWeight: 600 }}>{cluster}</span>
                            <span className="text-xs text-slate-400">{ideas.filter(i => i.cluster === cluster).length} ideas</span>
                          </div>
                          <div className="divide-y divide-slate-50">
                            {ideas.filter(i => i.cluster === cluster).map(idea => {
                              const isAdded = finalistas.some(f => f.ideaId === idea.id);
                              const isFull = !isAdded && finalistas.length >= 5;
                              return (
                                <div key={idea.id} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isAdded ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
                                  <p className="flex-1 text-xs text-slate-700">{idea.text}</p>
                                  <button
                                    onClick={() => addFinalista(idea)}
                                    disabled={isAdded || isFull}
                                    className={`shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors ${isAdded ? 'text-indigo-600 bg-indigo-100' : isFull ? 'text-slate-300 bg-slate-100 cursor-not-allowed' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'}`}
                                    style={{ fontWeight: 500 }}
                                  >
                                    {isAdded ? '✓ Agregada' : '+ Finalista'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      Primero completa el Módulo B con ideas agrupadas en mínimo 3 grupos.
                    </div>
                  )}

                  {/* Finalistas actuales */}
                  {finalistas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Tus finalistas ({finalistas.length})</p>
                      {finalistas.map((f, i) => (
                        <div key={f.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                          <div className="flex items-start gap-2 mb-2.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{f.text}</p>
                              <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded mt-0.5 inline-block">Viene del grupo: {f.cluster}</span>
                            </div>
                            <button onClick={() => removeFinalista(f.id)}>
                              <X size={13} className="text-slate-300 hover:text-red-400" />
                            </button>
                          </div>
                          <div className="space-y-1.5 pl-7">
                            {([
                              { key: 'hmw' as const, label: 'Responde el HMW y no rompe líneas rojas' },
                              { key: 'pronto' as const, label: 'Se puede probar pronto (pocas dependencias)' },
                              { key: 'diferente' as const, label: 'Es diferente a las otras finalistas' },
                            ]).map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={f.checks[key]}
                                  onChange={e => updateFinalistaCheck(f.id, key, e.target.checked)}
                                  className="w-3.5 h-3.5 accent-indigo-600"
                                />
                                <span className={`text-xs ${f.checks[key] ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Paso 1 */}
                  <button
                    onClick={() => setCPaso(2)}
                    disabled={finalistas.length < 3}
                    className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${finalistas.length >= 3 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    style={{ fontWeight: 500 }}
                  >
                    {finalistas.length >= 3
                      ? <>Tengo mis finalistas → Comparar y elegir <ChevronRight size={15} /></>
                      : <><Lock size={14} /> Necesitas {3 - finalistas.length} finalista{3 - finalistas.length !== 1 ? 's' : ''} más para continuar</>}
                  </button>
                </div>
              )}

              {/* ═══ PASO 2: Comparar y elegir ═══ */}
              {cPaso === 2 && (
                <div className="space-y-5">

                  {/* Criteria legend */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Evalúa cada finalista del 1 al 5 en estos criterios:</p>
                    <div className="space-y-1">
                      {[
                        { key: 'D', label: 'Deseable', desc: '¿A alguien le importa de verdad?' },
                        { key: 'V', label: 'Viable', desc: '¿Tiene sentido para el negocio/reglas y tiene dueño?' },
                        { key: 'F', label: 'Factible', desc: '¿Lo podemos probar pronto con lo que ya tenemos?' },
                        { key: 'I', label: 'Impacto', desc: 'Si funciona, ¿cuánto mejora el reto?' },
                        { key: 'E', label: 'Esfuerzo', desc: '¿Qué tan pesado es probarlo? (5 = fácil, 1 = muy pesado)' },
                      ].map(c => (
                        <div key={c.key} className="flex items-baseline gap-2">
                          <span className="text-xs w-16 text-indigo-600 shrink-0" style={{ fontWeight: 600 }}>{c.label}</span>
                          <span className="text-xs text-slate-500">{c.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* IA comparar */}
                  <div>
                    <button
                      onClick={handleIaCComparacion}
                      disabled={cIaComparacionLoading}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                      style={{ fontWeight: 500 }}
                    >
                      {cIaComparacionLoading
                        ? <><span className="animate-spin">⟳</span> Analizando…</>
                        : <><Sparkles size={11} /> IA: comparar ideas con criterio</>}
                    </button>
                    <p className="text-xs text-slate-400 mt-1">La IA propone puntajes con sus razones. Tú los editas y confirmas antes de elegir.</p>
                  </div>

                  {/* Scoring cards */}
                  <div className="space-y-4">
                    {finalistas.map((f, i) => {
                      const total = f.deseable + f.viable + f.factible + f.impacto + f.esfuerzo;
                      const isSelected = selectedIdea === f.ideaId;
                      return (
                        <div key={f.id} className={`border-2 rounded-xl overflow-hidden transition-colors ${isSelected ? 'border-indigo-400' : 'border-slate-200'}`}>
                          {/* Header */}
                          <div className={`px-4 py-3 flex items-start gap-3 ${isSelected ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`} style={{ fontWeight: 700 }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{f.text}</p>
                              <p className="text-xs text-slate-400 mt-0.5">Viene del grupo: <span style={{ fontWeight: 500 }} className="text-slate-600">{f.cluster}</span></p>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-lg shrink-0 ${total >= 20 ? 'bg-emerald-100 text-emerald-700' : total >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`} style={{ fontWeight: 700 }}>
                              {total}/25
                            </div>
                          </div>

                          {/* Scoring grid */}
                          <div className="px-4 py-3 bg-white space-y-2.5">
                            {(['deseable', 'viable', 'factible', 'impacto', 'esfuerzo'] as const).map(key => {
                              const labels = { deseable: 'Deseable', viable: 'Viable', factible: 'Factible', impacto: 'Impacto', esfuerzo: 'Esfuerzo' };
                              return (
                                <div key={key} className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 w-14 shrink-0">{labels[key]}</span>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(n => (
                                      <button
                                        key={n}
                                        onClick={() => updateFinalistaScore(f.id, key, n)}
                                        className={`w-7 h-7 rounded-lg text-xs transition-colors ${f[key] === n ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'}`}
                                        style={{ fontWeight: f[key] === n ? 700 : 400 }}
                                      >
                                        {n}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Razón / suposición IA */}
                            {f.razon && (
                              <div className="flex items-start gap-2 p-2.5 bg-violet-50 border border-violet-100 rounded-xl">
                                <Sparkles size={10} className="text-violet-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-violet-700">{f.razon}</p>
                              </div>
                            )}

                            {/* Elegir */}
                            <button
                              onClick={() => setSelectedIdea(f.ideaId)}
                              className={`w-full py-2 rounded-xl text-xs transition-colors mt-1 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent'}`}
                              style={{ fontWeight: isSelected ? 600 : 500 }}
                            >
                              {isSelected ? '✓ Elegida como la idea a experimentar' : 'Elegir esta idea'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resultado final */}
                  {selectedIdea && (
                    <div className="border-2 border-emerald-300 bg-emerald-50 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-emerald-600 mb-0.5" style={{ fontWeight: 600 }}>IDEA SELECCIONADA:</p>
                          <p className="text-sm text-emerald-900" style={{ fontWeight: 600 }}>
                            {finalistas.find(f => f.ideaId === selectedIdea)?.text}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Por qué gana <span className="text-slate-400" style={{ fontWeight: 400 }}>(1–2 líneas)</span></label>
                        <textarea
                          value={cRazonGana}
                          onChange={e => setCRazonGana(e.target.value)}
                          rows={2}
                          placeholder="Ej. Es la opción con mejor balance entre impacto y esfuerzo, y no depende de sistemas externos."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Qué vamos a probar primero <span className="text-slate-400" style={{ fontWeight: 400 }}>(1 línea)</span></label>
                        <input
                          value={cQueProbamos}
                          onChange={e => setCQueProbamos(e.target.value)}
                          placeholder="Ej. Formulario en Google Forms con notificación automática a TI"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Checklist de avance */}
                  {!(selectedIdea && cRazonGana.trim() && cQueProbamos.trim()) && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Para avanzar necesitas:</p>
                      {[
                        { ok: !!selectedIdea, label: selectedIdea ? 'Idea elegida ✓' : 'Selecciona una idea como ganadora' },
                        { ok: !!cRazonGana.trim(), label: cRazonGana.trim() ? '"Por qué gana" completo ✓' : 'Escribe por qué gana esta idea' },
                        { ok: !!cQueProbamos.trim(), label: cQueProbamos.trim() ? '"Qué vamos a probar" completo ✓' : 'Escribe qué van a probar primero' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            {item.ok ? <CheckCircle2 size={10} className="text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                          </div>
                          <p className={`text-xs ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={() => setActiveModule('D')}
                    disabled={!selectedIdea || !cRazonGana.trim() || !cQueProbamos.trim()}
                    className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${selectedIdea && cRazonGana.trim() && cQueProbamos.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    style={{ fontWeight: 500 }}
                  >
                    {selectedIdea && cRazonGana.trim() && cQueProbamos.trim()
                      ? <>Módulo C listo → Documentar la solución <ChevronRight size={15} /></>
                      : <><Lock size={14} /> {!selectedIdea ? 'Elige una idea para avanzar' : 'Completa los campos de la idea seleccionada'}</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Module D: Cards */}
          {activeModule === 'D' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Módulo D: Solution & Test Cards</h1>
                <p className="text-sm text-slate-500">Primero cierra la narrativa del experimento, luego ajusta detalles.</p>
              </div>

              {/* 1) Resumen fijo del experimento */}
              <div className="sticky top-3 z-20 border border-violet-200 rounded-2xl p-4 bg-gradient-to-r from-violet-50 to-white shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-violet-900" style={{ fontWeight: 700 }}>Resumen del experimento</p>
                    <p className="text-[11px] text-violet-600">Se arma automáticamente</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${summaryReady ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`} style={{ fontWeight: 600 }}>
                    {summaryReady ? 'Listo para prototipar' : 'Faltan definiciones'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-700"><span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Apuesta:</span> {solutionCard.propuesta?.trim() || 'POR DEFINIR'}</p>
                  <p className="text-slate-700"><span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Riesgo #1:</span> {testCard.hipotesisRiesgosa?.trim() || 'POR DEFINIR'}</p>
                  <p className="text-slate-700"><span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Prueba mínima:</span> {`${testCard.metodo?.trim() || 'POR DEFINIR'} · ${testCard.conQuien?.trim() || 'POR DEFINIR'} · ${testCard.dondeCuando?.trim() || 'POR DEFINIR'}`}</p>
                  <p className="text-slate-700"><span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Éxito si:</span> {testCard.metrica?.trim() || 'POR DEFINIR'}</p>
                  <p className="text-slate-700"><span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Si no funciona:</span> ajustamos / cambiamos</p>
                </div>
              </div>

              {/* 2) Preview cards (final) */}
              <div>
                <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>Cards finales (preview de lectura rápida)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PreviewCard
                  title="Solution Card (final)"
                  icon={<Lightbulb size={14} className="text-violet-600" />}
                  badge="Card final"
                  bullets={[
                    `Problema: ${solutionCard.problema?.trim() || 'POR DEFINIR'}`,
                    `Usuario: ${solutionCard.usuario?.trim() || 'POR DEFINIR'}`,
                    `Propuesta: ${solutionCard.propuesta?.trim() || 'POR DEFINIR'}`,
                    `Diferenciador: ${solutionCard.diferenciador?.trim() || 'POR DEFINIR'}`,
                    `Hipótesis de valor: ${solutionCard.hipotesis?.trim() || 'POR DEFINIR'}`,
                  ]}
                  onEdit={() => { setSolutionOpen(true); setTimeout(() => solutionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }}
                />
                <PreviewCard
                  title="Test Card (final)"
                  icon={<Target size={14} className="text-violet-600" />}
                  badge="Card final"
                  bullets={[
                    `Hipótesis más riesgosa: ${testCard.hipotesisRiesgosa?.trim() || 'POR DEFINIR'}`,
                    `Qué testeo: ${testCard.queTestan?.trim() || 'POR DEFINIR'}`,
                    `Método: ${testCard.metodo?.trim() || 'POR DEFINIR'}`,
                    `Métrica + umbral: ${testCard.metrica?.trim() || 'POR DEFINIR'}`,
                    `Evidencia: ${testCard.evidencia?.trim() || 'POR DEFINIR'}`,
                  ]}
                  onEdit={() => { setTestOpen(true); setTimeout(() => testRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }}
                />
                </div>
              </div>

              {/* 3) Editable sections (collapsible) */}
              <div className="space-y-4">
                <div ref={solutionRef}>
                  <CollapsibleSection title="Editar Solution Card" open={solutionOpen} onToggle={() => setSolutionOpen(v => !v)}>
                    <div className="space-y-3">
                      {(['problema', 'usuario', 'propuesta', 'diferenciador', 'hipotesis', 'supuestos'] as const).map((field) => (
                        <ActionFieldCard
                          key={field}
                          label={{
                            problema: 'Problema que resuelve',
                            usuario: 'Usuario objetivo',
                            propuesta: 'Propuesta de solución',
                            diferenciador: 'Diferenciador clave',
                            hipotesis: 'Hipótesis de valor',
                            supuestos: 'Supuestos clave',
                          }[field]}
                          completed={!!(solutionCard as any)[field]}
                          onExample={() => setSolutionCard(p => ({ ...p, [field]: (solutionCard as any)[field] || 'POR DEFINIR' })) }
                          iaLabel={getIaLabel((solutionCard as any)[field])}
                          onIA={() => openModuleDIA('solution', field, {
                            problema: 'Problema que resuelve',
                            usuario: 'Usuario objetivo',
                            propuesta: 'Propuesta de solución',
                            diferenciador: 'Diferenciador clave',
                            hipotesis: 'Hipótesis de valor',
                            supuestos: 'Supuestos clave',
                          }[field])}
                          bullets={field === 'hipotesis' ? ['Qué resultado esperamos', 'Para quién'] : ['Describe en 1–2 líneas']}
                        >
                          {field === 'propuesta' || field === 'hipotesis' || field === 'supuestos' ? (
                            <textarea value={(solutionCard as any)[field]} onChange={e => setSolutionCard(p => ({ ...p, [field]: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                          ) : (
                            <input value={(solutionCard as any)[field]} onChange={e => setSolutionCard(p => ({ ...p, [field]: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          )}
                        </ActionFieldCard>
                      ))}
                    </div>
                  </CollapsibleSection>
                </div>

                <div ref={testRef}>
                  <CollapsibleSection title="Editar Test Card" open={testOpen} onToggle={() => setTestOpen(v => !v)}>
                    <div className="space-y-3">
                      <ActionFieldCard
                        label="Hipótesis más riesgosa (si esto es falso, la idea se cae)"
                        completed={!!testCard.hipotesisRiesgosa?.trim()}
                        exampleLabel="Ver ejemplo"
                        onExample={() => setTestCard(p => ({ ...p, hipotesisRiesgosa: 'Si TI no asume ownership del proceso, el formulario será ignorado.' }))}
                        iaLabel={getIaLabel(testCard.hipotesisRiesgosa)}
                        onIA={() => openModuleDIA('test', 'hipotesisRiesgosa', 'Hipótesis más riesgosa')}
                        bullets={['Debe ser UNA hipótesis clave', 'Explicita por qué si es falsa la idea muere']}
                      >
                        <input value={testCard.hipotesisRiesgosa} onChange={e => setTestCard(p => ({ ...p, hipotesisRiesgosa: e.target.value }))} placeholder="Si esto no se cumple, la idea no vale la pena porque…" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </ActionFieldCard>

                      {([ ['hipotesis', 'Hipótesis a testear'], ['queTestan', 'Qué vas a testear'], ['conQuien', 'Con quién'], ['dondeCuando', 'Dónde y cuándo'], ['metodo', 'Método'], ['metrica', 'Métrica y umbral de éxito'], ['riesgos', 'Riesgos y límites'], ['evidencia', 'Evidencia a capturar'] ] as const).map(([field, label]) => (
                        <ActionFieldCard
                          key={field}
                          label={label}
                          completed={!!(testCard as any)[field]}
                          onExample={() => { (setTestCard as any)(p => ({ ...p, [field]: (p as any)[field] || 'POR DEFINIR' })); }}
                          iaLabel={getIaLabel((testCard as any)[field])}
                          onIA={() => openModuleDIA('test', field, label)}
                          bullets={
                            field === 'metrica' ? ['Métrica clara', 'Umbral numérico'] :
                            field === 'evidencia' ? ['Timestamps o conteos mínimos', 'Links o capturas si aplica'] :
                            ['1 línea clara']
                          }
                        >
                          {(field === 'metrica' || field === 'evidencia' || field === 'conQuien' || field === 'dondeCuando') ? (
                            <input value={(testCard as any)[field]} onChange={e => setTestCard(p => ({ ...p, [field]: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          ) : (
                            <textarea value={(testCard as any)[field]} onChange={e => setTestCard(p => ({ ...p, [field]: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                          )}
                        </ActionFieldCard>
                      ))}

                      {/* Pasos del experimento (5–8) UI */}
                      <div className="border rounded-xl p-3 bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Pasos del experimento (5–8)</h4>
                            <p className="text-xs text-slate-400">Empieza por validar la hipótesis más riesgosa. Termina con una decisión.</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {testCard.pasos.map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs flex items-center justify-center shrink-0" style={{ fontWeight: 700 }}>{i + 1}</span>
                              <input value={p} onChange={e => { const np = [...testCard.pasos]; np[i] = e.target.value; setTestCard(prev => ({ ...prev, pasos: np })); }} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              {i === 0 && !p.toLowerCase().includes('hipotes') && (
                                <button onClick={() => setTestCard(prev => ({ ...prev, pasos: [`Validar: ${testCard.hipotesisRiesgosa || 'hipótesis más riesgosa'}`, ...prev.pasos.slice(1)] }))} className="text-xs text-indigo-600 px-2 py-1">Copiar hip. riesgosa</button>
                              )}
                              {i === testCard.pasos.length - 1 && !/decisión|seguir|ajustar|cambiar/i.test(p) && (
                                <button onClick={() => { const np = [...testCard.pasos]; np[np.length - 1] = np[np.length - 1] + ' · Decisión: seguir / ajustar / cambiar'; setTestCard(prev => ({ ...prev, pasos: np })); }} className="text-xs text-amber-600 px-2 py-1">Agregar decisión</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </CollapsibleSection>
                </div>
              </div>

              {/* Send button + validation messages */}
              <div className="border-t border-slate-200 pt-4">
                <button
                  onClick={() => setShowSendModal(true)}
                  disabled={step2Blocked}
                  className={`w-full ${step2Blocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-700'} rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors`}
                  style={{ fontWeight: 500 }}
                >
                  <Send size={15} /> Enviar a revisión IA
                </button>

                {step2Blocked && (
                  <div className="mt-3 space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    {step2Missing.map((m, i) => <div key={i}>· {m}</div>)}
                  </div>
                )}
              </div>

              {hasFeedback && <FeedbackIAPanel feedback={MOCK_FEEDBACK_S2} />}

              {hasFeedback && MOCK_FEEDBACK_S2.status === 'Aprobado' && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <p className="text-sm text-amber-800 mb-1" style={{ fontWeight: 600 }}>Sesión con experto obligatoria</p>
                  <p className="text-xs text-amber-600 mb-3">Agenda la sesión con tu mentor para aprobar el Step 2 y desbloquear el Step 3.</p>
                  <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                    <Calendar size={14} /> Agendar sesión con mentor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModuleDIAModal && moduleDIAContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-900" style={{ fontWeight: 700 }}>Asistente IA: {moduleDIAContext.label}</h3>
              <button onClick={() => setShowModuleDIAModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Elige una sugerencia para completar o revisar este campo.</p>

            {!moduleDIAEnabled && (
              <div className="mb-4 p-3 border border-amber-200 bg-amber-50 rounded-xl">
                <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Conecta API key para usar IA</p>
                <p className="text-xs text-amber-700 mt-1">Mientras tanto, puedes usar estas sugerencias de ejemplo.</p>
              </div>
            )}

            <div className="space-y-2 mb-5">
              {moduleDIAContext.suggestions.slice(0, 3).map((suggestion, idx) => {
                const active = selectedSuggestion === suggestion;
                return (
                  <button
                    key={`${moduleDIAContext.field}-${idx}`}
                    onClick={() => setSelectedSuggestion(suggestion)}
                    className={`w-full text-left border rounded-xl px-3 py-2 text-sm transition-colors ${active ? 'border-violet-400 bg-violet-50 text-violet-900' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}
                  >
                    {suggestion}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModuleDIAModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button
                onClick={applyModuleDIASuggestion}
                disabled={!selectedSuggestion.trim()}
                aria-disabled={!selectedSuggestion.trim()}
                title={!selectedSuggestion.trim() ? 'Selecciona una sugerencia para aplicar.' : ''}
                className={`flex-1 rounded-xl py-2.5 text-sm ${selectedSuggestion.trim() ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={{ fontWeight: 500 }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Enviar Step 2 a revisión IA</h3>
            <p className="text-sm text-slate-500 mb-4">Se enviará: HMW + Ideas + Shortlist + Matriz DVF + Solution Card + Test Card.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>Cancelar</button>
              <button
                onClick={() => { setShowSendModal(false); setTimeout(() => setHasFeedback(true), 1500); }}
                disabled={step2Blocked}
                className={`flex-1 ${step2Blocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-700'} rounded-xl py-2.5 text-sm`}
                style={{ fontWeight: 500 }}
              >
                Enviar a revisión IA
              </button>
            </div>
            {step2Blocked && (
              <div className="mt-4 text-xs text-amber-700">
                {step2Missing.map((m, i) => <div key={i}>· {m}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mentor HMW modal */}
      {showMentorHMW && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Pedir feedback a un experto</h3>
              <button onClick={() => setShowMentorHMW(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-3">Comparte tu pregunta con el mentor para afinar el foco antes de generar ideas.</p>
            {hmw.trim() ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
                <p className="text-xs text-indigo-400 mb-1" style={{ fontWeight: 600 }}>TU PREGUNTA ACTUAL</p>
                <p className="text-sm text-indigo-800 italic">"{hmw}"</p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-slate-400 italic">Todavía no escribiste tu pregunta.</p>
              </div>
            )}
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
              <p className="text-xs text-amber-700">
                <span style={{ fontWeight: 600 }}>Próximo paso:</span> Copia tu pregunta y compártela con tu mentor en la sesión agendada o por el canal de comunicación del programa.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { navigator.clipboard.writeText(hmw); }} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
                Copiar pregunta
              </button>
              <button onClick={() => setShowMentorHMW(false)} className="flex-1 bg-slate-800 text-white rounded-xl py-2.5 text-sm hover:bg-slate-900 transition-colors" style={{ fontWeight: 500 }}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
