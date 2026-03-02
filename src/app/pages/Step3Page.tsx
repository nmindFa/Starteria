import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Lock, Send, CheckCircle2, X, Plus,
  Calendar, Paperclip, Link, Upload, AlertCircle, Clock, Target,
  FileText, Sparkles, Edit2, BookOpen, Layers, FlaskConical,
  TrendingUp, Users, MapPin, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';

type ModuleId = 'A' | 'B' | 'C';
type GoNoGoDecision = 'Go' | 'Iterar' | 'No-Go' | 'Pivote' | null;

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Componente {
  id: string; nombre: string; proposito: string; canal: string;
  owner: string; link: string; dod: string; estado: 'Pendiente' | 'Listo';
}
interface InstrumentacionRow {
  id: string; dato: string; fuente: string; responsable: string; evidencia: string;
}
interface EventoBitacora {
  id: string; fecha: string; hora: string; accion: string; responsable: string; nota: string;
}
interface MallaItem {
  id: string; tipo: 'idea' | 'critica' | 'pregunta' | 'hipotesis';
  descripcion: string; evidencia: string; severidad: 'bajo' | 'medio' | 'alto' | '';
}
interface DeckSlide { titulo: string; bullets: string[] }

// ── Mock / seed data ──────────────────────────────────────────────────────────
const MOCK_FEEDBACK_S3 = {
  status: 'Aprobado' as const,
  summary: 'Los resultados superan el umbral establecido y los aprendizajes están bien documentados. El equipo tiene evidencia suficiente para tomar una decisión informada.',
  goodPoints: ['Evidencia cuantitativa registrada', 'Umbral claramente comparado', 'Aprendizajes concretos y accionables', 'Decisión justificada con datos'],
  missing: [],
  actions: [],
  questions: ['¿El perfil de los participantes es representativo del total de casos?'],
  timestamp: '2025-03-01T11:00:00Z',
};
const MOCK_EVIDENCIAS = [
  { id: 'e1', tipo: 'Archivo', descripcion: 'Capturas de pantalla del formulario completo', fecha: '2025-02-24' },
  { id: 'e2', tipo: 'Link', descripcion: 'Hoja de seguimiento en Google Sheets', fecha: '2025-02-25' },
  { id: 'e3', tipo: 'Nota', descripcion: 'Observaciones del facilitador durante el piloto', fecha: '2025-02-26' },
];
const MOCK_TESTCARD = {
  hipotesis: 'Si usamos un formulario unificado de solicitud de accesos, reduciremos el tiempo de alta en TI de 7 días a menos de 24 horas en el 80% de los casos.',
  experimento: 'Piloto con 5 empleados nuevos usando el formulario de Google Forms conectado al equipo de TI.',
  metrica: 'Tiempo formulario → accesos activos · Umbral go: ≤24h en ≥80% de casos',
  evidencia: 'Timestamp del formulario + screenshot de accesos activos + encuesta empleado día 3',
};
const PREP_ITEMS = [
  'Tener el formulario de Google Forms configurado y compartido con TI',
  'Definir los 5 participantes del piloto (empleados que ingresan la próxima semana)',
  'Acordar con TI el proceso de respuesta en menos de 24 horas',
  'Preparar encuesta de 3 preguntas para el empleado el día 3',
];
const FORMATOS_EXP = ['Formulario', 'Landing', 'WhatsApp', 'Prototipo', 'Concierge', 'Piloto operativo'];
const MOCK_COMPONENTES: Componente[] = [
  { id: 'c1', nombre: 'Formulario de solicitud de accesos', proposito: 'Centralizar el pedido de accesos en una sola interfaz', canal: 'Google Forms', owner: 'Ana R.', link: 'https://forms.google.com/...', dod: 'Campos validados + notificación automática a TI', estado: 'Listo' },
  { id: 'c2', nombre: 'Sheet de seguimiento TI', proposito: 'Registrar tiempos y resultados de cada caso', canal: 'Google Sheets', owner: 'TI', link: 'https://sheets.google.com/...', dod: 'Todas las columnas completas al cierre del piloto', estado: 'Listo' },
];
const MOCK_INSTRUMENTACION: InstrumentacionRow[] = [
  { id: 'i1', dato: 'Timestamp envío → accesos activos', fuente: 'Google Sheets', responsable: 'TI', evidencia: '(Placeholder) link al sheet' },
  { id: 'i2', dato: 'NPS empleado día 3', fuente: 'Encuesta Google Forms', responsable: 'RRHH', evidencia: '(Placeholder) link al formulario' },
  { id: 'i3', dato: 'Casos resueltos en tiempo / total', fuente: 'Sheet de seguimiento', responsable: 'Ana R.', evidencia: '(Placeholder) screenshots' },
];
const MOCK_BITACORA: EventoBitacora[] = [
  { id: 'b1', fecha: '2025-02-24', hora: '09:15', accion: 'Se envió formulario al empleado #1 (Carlos M.)', responsable: 'Ana R.', nota: 'Primera prueba en vivo, todo OK' },
  { id: 'b2', fecha: '2025-02-24', hora: '14:30', accion: 'TI confirmó accesos activos para empleado #1', responsable: 'TI', nota: 'Tiempo total: 5h 15min' },
  { id: 'b3', fecha: '2025-02-25', hora: '10:00', accion: 'Empleado #2 (Sara G.) completó formulario', responsable: 'Ana R.', nota: 'Perfil estándar · sin incidencias' },
];
const MOCK_MALLA: MallaItem[] = [
  { id: 'm1', tipo: 'idea', descripcion: '(Placeholder) Agregar selector de tipo de acceso para que TI priorice automáticamente.', evidencia: '', severidad: 'alto' },
  { id: 'm2', tipo: 'critica', descripcion: '(Placeholder) El formulario no muestra confirmación visual al empleado después de enviarlo.', evidencia: '', severidad: 'medio' },
  { id: 'm3', tipo: 'pregunta', descripcion: '(Placeholder) ¿Cómo manejamos los casos de accesos especiales fuera del catálogo estándar?', evidencia: '', severidad: '' },
];
const IA_SUGERENCIAS_NEXT = [
  { titulo: 'Iterar rápido', objetivo: 'Resolver el cuello de botella de accesos especiales sin rediseñar el formulario.', cambio: 'Agregar un campo "tipo de acceso especial" + flujo de escalado a TI Senior.', evidencia: 'Medir tiempo de resolución de casos especiales en 3 nuevos empleados.', duracion: '1 semana' },
  { titulo: 'Complementar con 2da validación', objetivo: 'Confirmar que el NPS >70 se mantiene con una muestra mayor.', cambio: 'Ampliar piloto a 10 empleados con diversidad de perfiles y áreas.', evidencia: 'Encuesta NPS + entrevista breve (5 min) con 3 participantes.', duracion: '2 semanas' },
  { titulo: 'Pivote parcial de canal', objetivo: 'Probar si WhatsApp reduce el tiempo de respuesta vs el formulario.', cambio: 'Reemplazar formulario por bot de WhatsApp (Respond.io) para el 50% de los casos.', evidencia: 'Comparar tiempos formulario vs WhatsApp en el siguiente ciclo.', duracion: '2 semanas' },
];
const MOCK_DECK_SLIDES: DeckSlide[] = [
  { titulo: 'El problema', bullets: ['(Placeholder) Nuevos empleados tardaban 7–21 días en tener accesos activos.', '(Placeholder) Costo: ~X horas de RRHH + TI por caso.', '(Placeholder) Impacto: primeras semanas sin productividad plena.'] },
  { titulo: 'Nuestra hipótesis', bullets: ['(Placeholder) Si simplificamos la solicitud de accesos, reducimos el tiempo a ≤24h en el 80% de casos.', '(Placeholder) Suposición clave: TI puede comprometerse a responder en ese plazo.'] },
  { titulo: 'El experimento', bullets: ['(Placeholder) Formulario Google Forms unificado + notificación automática a TI.', '(Placeholder) Piloto con 5 empleados que ingresaron la semana del 24 de febrero.', '(Placeholder) Métricas: tiempo de resolución + NPS día 3.'] },
  { titulo: 'Resultados', bullets: ['(Placeholder) 4/5 casos resueltos en ≤24h (80% — umbral alcanzado).', '(Placeholder) NPS promedio: 82 (meta: >70).', '(Placeholder) 1 caso especial: resuelto en 36h tras escalado.'] },
  { titulo: 'Decisión y aprendizajes', bullets: ['(Placeholder) Decisión: Go — escalamos el formulario al 100% de los ingresos.', '(Placeholder) Los accesos especiales necesitan un proceso paralelo.', '(Placeholder) TI está dispuesto a adoptar el proceso si hay automatización.'] },
  { titulo: 'Próximo paso', bullets: ['(Placeholder) Integrar con RRHH desde el día 1 de contratación.', '(Placeholder) Explorar API de SAP para accesos pre-aprobados por perfil.', '(Placeholder) Definir SLA formal de ≤24h con TI para todos los ingresos.'] },
];

// ── Helper components ─────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, className = '' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <Icon size={14} className="text-slate-500" />
        <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{title}</p>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export function Step3Page() {
  const { projectId } = useParams();
  const { projects, updateProject } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const project = projects.find(p => p.id === projectId);

  const step2Status = project?.steps.find(s => s.number === 2)?.status;
  const step3Status = project?.steps.find(s => s.number === 3)?.status;
  const isUnlocked =
    step2Status === 'Aprobado' ||
    step3Status === 'En progreso' ||
    step3Status === 'Enviado' ||
    step3Status === 'Aprobado' ||
    location.state?.demoUnlocked === true;

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState<ModuleId>('A');

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE A STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [prepChecks, setPrepChecks] = useState<boolean[]>(PREP_ITEMS.map(() => false));
  const [moduloACompleto, setModuloACompleto] = useState(false);

  // S3A_Formato
  const [formatoExp, setFormatoExp] = useState('');

  // S3A_Componentes
  const [componentes, setComponentes] = useState<Componente[]>(MOCK_COMPONENTES);
  const [showComponenteModal, setShowComponenteModal] = useState(false);
  const [nuevoComp, setNuevoComp] = useState<Omit<Componente, 'id'>>({
    nombre: '', proposito: '', canal: '', owner: '', link: '', dod: '', estado: 'Pendiente',
  });

  // S3A_Logistica
  const [logistica, setLogistica] = useState({
    donde: '(Contenido de ejemplo para prototipo) Oficina central — en persona los primeros 2 casos; remoto para los demás.',
    cuando: '(Contenido de ejemplo para prototipo) Semana del 24 de febrero, con empleados que ingresan ese lunes.',
    duracion: '(Contenido de ejemplo para prototipo) 5 días hábiles.',
    quienDispara: '(Contenido de ejemplo para prototipo) Ana R. (RRHH) — coordina con TI para respuesta en 24h.',
    contingencia: '(Contenido de ejemplo para prototipo) Si TI no responde en 24h, escalar al líder de TI directo.',
  });

  // S3A_Instrumentacion
  const [instrumentacion, setInstrumentacion] = useState<InstrumentacionRow[]>(MOCK_INSTRUMENTACION);
  const [showInstrOverlay, setShowInstrOverlay] = useState(false);
  const [instrTipo, setInstrTipo] = useState<'link' | 'archivo' | null>(null);
  const [instrDesc, setInstrDesc] = useState('');
  const [instrRowId, setInstrRowId] = useState('');

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE B STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [evidencias, setEvidencias] = useState(MOCK_EVIDENCIAS);
  const [showAdjuntarOverlay, setShowAdjuntarOverlay] = useState(false);
  const [adjuntarTipo, setAdjuntarTipo] = useState<'archivo' | 'link' | null>(null);
  const [adjuntarDesc, setAdjuntarDesc] = useState('');
  const [valorMedido, setValorMedido] = useState('(Placeholder) 4/5 casos resueltos en menos de 24 horas (80%)');
  const [observaciones, setObservaciones] = useState('(Placeholder) El formulario funcionó bien para perfiles estándar. Los accesos especiales tardaron más de lo esperado.');
  const [incidencias, setIncidencias] = useState('(Placeholder) 1 caso con accesos especiales — resuelto en 36 horas tras escalar con el líder de TI.');

  // S3B_Bitacora
  const [bitacora, setBitacora] = useState<EventoBitacora[]>(MOCK_BITACORA);
  const [showBitacoraModal, setShowBitacoraModal] = useState(false);
  const [nuevoBit, setNuevoBit] = useState({ fecha: '', hora: '', accion: '', responsable: '', nota: '' });

  // S3B_MallaReceptora
  const [malla, setMalla] = useState<MallaItem[]>(MOCK_MALLA);
  const [showMallaModal, setShowMallaModal] = useState(false);
  const [nuevoMalla, setNuevoMalla] = useState<Omit<MallaItem, 'id'>>({ tipo: 'idea', descripcion: '', evidencia: '', severidad: '' });
  const [mallaSeccionAbierta, setMallaSeccionAbierta] = useState<string | null>('idea');

  // S3B_SiguienteIteracion
  const [sigIter, setSigIter] = useState({ quePunto: '', queCambia: '', comoPrueba: '', cuando: '' });
  const [showIANextOverlay, setShowIANextOverlay] = useState(false);
  const [iaNextLoading, setIaNextLoading] = useState(false);
  const [iaNextListo, setIaNextListo] = useState(false);
  const [iaNextSelected, setIaNextSelected] = useState<number | null>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE C STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [umbral] = useState('≤24h en ≥80% de casos');
  const [resultado] = useState('24h promedio · 80% (4/5 casos)');
  const [goNoGo, setGoNoGo] = useState<GoNoGoDecision>(null);
  const [aprendizajes, setAprendizajes] = useState([
    '(Placeholder) El formulario resuelve el 80% de los casos estándar sin intervención manual.',
    '(Placeholder) Los accesos especiales siguen siendo el cuello de botella — necesitan un proceso separado.',
    '(Placeholder) El equipo de TI está dispuesto a adoptar el proceso si se automatiza la notificación.',
  ]);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showS3MentorModal, setShowS3MentorModal] = useState(false);
  const [s3SessionBooked, setS3SessionBooked] = useState(false);
  const [s3MentorDate, setS3MentorDate] = useState('');
  const [s3MentorTime, setS3MentorTime] = useState('');

  // S3C_DiagnosticoIA
  const [editandoDiag, setEditandoDiag] = useState(false);
  const [diagnostico, setDiagnostico] = useState({
    senales: [
      '(Placeholder) El 80% de los casos estándar se resuelven en el tiempo esperado.',
      '(Placeholder) NPS de 82 indica alta aceptación del proceso por parte de los empleados nuevos.',
    ],
    riesgos: [
      '(Placeholder) Los casos con accesos especiales duplican el tiempo — 20% del volumen total.',
      '(Placeholder) La dependencia de respuesta manual de TI es un punto de falla.',
    ],
    queFalta: [
      '(Placeholder) Validar con una muestra mayor (≥10 casos) para confirmar la consistencia.',
      '(Placeholder) Definir un proceso específico para accesos especiales fuera del catálogo.',
    ],
  });

  // S3C_RecomendacionIA
  const [showRefinarOverlay, setShowRefinarOverlay] = useState(false);
  const [refinarLoading, setRefinarLoading] = useState(false);
  const [refinarListo, setRefinarListo] = useState(false);

  // S3C_Pack_Step4
  const [showDeckOverlay, setShowDeckOverlay] = useState(false);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckAplicado, setDeckAplicado] = useState(false);
  const [deckSlides, setDeckSlides] = useState<DeckSlide[]>([]);

  // Overlay_S3_MentorComplete_Demo — gatillo visible siempre en S3C para aprobar Step 3 en demo
  const [showFinalizarDemo, setShowFinalizarDemo] = useState(false);

  // Autosave
  const saveState = useAutosave({ prepChecks, formatoExp, componentes, logistica, instrumentacion, bitacora, malla, sigIter, evidencias, valorMedido, observaciones, goNoGo, aprendizajes, diagnostico });

  // ── Gate ─────────────────────────────────────────────────────────────────────
  if (!project) return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;
  if (!isUnlocked) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Step 3 bloqueado</h2>
        <p className="text-sm text-slate-500 mb-4">Para probar en pequeño, primero necesitas agendar y completar la sesión con mentor del Step 2.</p>
        <button onClick={() => navigate(`/projects/${projectId}/step/2`)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>→ Ir al Step 2</button>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const modules: { id: ModuleId; label: string; completed: boolean }[] = [
    { id: 'A', label: 'A · Plan del experimento', completed: moduloACompleto },
    { id: 'B', label: 'B · Ejecutar y capturar', completed: evidencias.length >= 1 && valorMedido.trim().length > 10 },
    { id: 'C', label: 'C · Resultados y decisión', completed: !!goNoGo && hasFeedback },
  ];

  const addEvidencia = () => {
    if (!adjuntarDesc.trim() || !adjuntarTipo) return;
    setEvidencias(p => [...p, { id: Date.now().toString(), tipo: adjuntarTipo === 'archivo' ? 'Archivo' : 'Link', descripcion: adjuntarDesc.trim(), fecha: new Date().toISOString().split('T')[0] }]);
    setAdjuntarDesc(''); setAdjuntarTipo(null); setShowAdjuntarOverlay(false);
    toast.success('Evidencia adjuntada');
  };

  const addComponente = () => {
    if (!nuevoComp.nombre.trim()) return;
    setComponentes(p => [...p, { ...nuevoComp, id: Date.now().toString() }]);
    setNuevoComp({ nombre: '', proposito: '', canal: '', owner: '', link: '', dod: '', estado: 'Pendiente' });
    setShowComponenteModal(false);
    toast.success('Componente agregado');
  };

  const addEventoBitacora = () => {
    if (!nuevoBit.accion.trim()) return;
    setBitacora(p => [...p, { ...nuevoBit, id: Date.now().toString() }]);
    setNuevoBit({ fecha: '', hora: '', accion: '', responsable: '', nota: '' });
    setShowBitacoraModal(false);
    toast.success('Evento registrado');
  };

  const addMallaItem = () => {
    if (!nuevoMalla.descripcion.trim()) return;
    setMalla(p => [...p, { ...nuevoMalla, id: Date.now().toString() }]);
    setNuevoMalla({ tipo: 'idea', descripcion: '', evidencia: '', severidad: '' });
    setShowMallaModal(false);
    toast.success('Aprendizaje registrado');
  };

  // ── Aprobar Step 3 en contexto (muta AppContext para desbloquear Step 4) ────
  const aprobarStep3EnContexto = () => {
    if (!project || !projectId) return;
    const updatedSteps = project.steps.map(s => {
      if (s.number === 3) return { ...s, status: 'Aprobado' as const, progress: 100 };
      if (s.number === 4) return { ...s, status: 'En progreso' as const };
      return s;
    });
    updateProject(projectId, { steps: updatedSteps, status: 'En progreso' as const });
  };

  const applyIASugerencia = (idx: number) => {
    const s = IA_SUGERENCIAS_NEXT[idx];
    setSigIter({ quePunto: s.objetivo, queCambia: s.cambio, comoPrueba: s.evidencia, cuando: `(Placeholder) ${s.duracion}` });
    setIaNextSelected(idx);
    setShowIANextOverlay(false);
    toast.success('Sugerencia aplicada a los campos');
  };

  const mallaByTipo = (tipo: string) => malla.filter(m => m.tipo === tipo);

  const MALLA_SECCIONES = [
    { key: 'idea', label: 'Ideas interesantes observadas', color: 'emerald', icon: Sparkles },
    { key: 'critica', label: 'Críticas constructivas / fricciones', color: 'amber', icon: AlertCircle },
    { key: 'pregunta', label: 'Preguntas nuevas que surgieron', color: 'blue', icon: FileText },
    { key: 'hipotesis', label: 'Nuevas hipótesis / mejoras sugeridas', color: 'violet', icon: FlaskConical },
  ] as const;

  const colorMap = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    violet: 'bg-violet-50 border-violet-100 text-violet-700',
  };

  const severidadMap = { alto: 'bg-red-100 text-red-700', medio: 'bg-amber-100 text-amber-700', bajo: 'bg-slate-100 text-slate-500', '': '' };

  const recomendaciones: Record<string, { titulo: string; items: string[] }[]> = {
    Go: [
      { titulo: '🚀 Qué escalar', items: ['(Placeholder) Implementar el formulario para el 100% de los ingresos nuevos desde el próximo mes.', '(Placeholder) Automatizar la notificación a TI para eliminar el paso manual.'] },
      { titulo: '⚠️ Condiciones para escalar', items: ['(Placeholder) TI debe comprometerse formalmente con SLA de ≤24h.', '(Placeholder) El sheet de seguimiento debe ser mantenido por TI, no por RRHH.'] },
      { titulo: '🔴 Riesgos a monitorear', items: ['(Placeholder) Casos especiales pueden romper el SLA — definir flujo de escalado.', '(Placeholder) Si el volumen crece, el proceso manual de TI puede colapsar.'] },
    ],
    Iterar: [
      { titulo: '🔧 Qué ajustar', items: ['(Placeholder) Agregar campo "tipo de acceso especial" al formulario para que TI priorice.', '(Placeholder) Agregar confirmación visual al empleado al enviar el formulario.'] },
      { titulo: '🔄 Próximo re-test', items: ['(Placeholder) Nuevo piloto con 5 empleados más, incluyendo 2 con accesos especiales.', '(Placeholder) Medir si el campo adicional reduce el tiempo de resolución de casos especiales.'] },
      { titulo: '📊 Evidencia a capturar', items: ['(Placeholder) Tiempo de resolución separado por tipo de acceso (estándar vs especial).', '(Placeholder) NPS diferenciado entre perfiles.'] },
    ],
    'No-Go': [
      { titulo: '❌ Por qué no', items: ['(Placeholder) El proceso no cumplió consistentemente el umbral de ≤24h con la muestra actual.', '(Placeholder) La dependencia de TI sin SLA formal hace el proceso frágil.'] },
      { titulo: '📚 Qué aprendimos', items: ['(Placeholder) El formulario en sí funciona; el cuello de botella está en la capacidad de respuesta de TI.', '(Placeholder) Los empleados valoran la simplicidad del formulario — el canal no es el problema.'] },
      { titulo: '🚫 Qué no repetir', items: ['(Placeholder) No lanzar sin SLA formal de TI.', '(Placeholder) No pilotear en semanas de alto volumen de ingresos.'] },
    ],
    Pivote: [
      { titulo: '💡 Qué aprendizaje nos hace pivotar', items: ['(Placeholder) El formulario solo resuelve el canal de entrada; el problema real es la capacidad de respuesta de TI.', '(Placeholder) Los accesos especiales representan el 20% de los casos y generan el 80% de los retrasos.'] },
      { titulo: '🔀 Qué variable cambia', items: ['(Placeholder) Variable que cambia: propuesta → pasar de formulario a accesos pre-aprobados por perfil de cargo.', '(Placeholder) Mantener el canal (Google Forms) pero cambiar el modelo de respuesta (pre-aprobación vs respuesta manual).'] },
      { titulo: '✅ Qué mantener del experimento actual', items: ['(Placeholder) El formulario como interfaz de solicitud.', '(Placeholder) El sheet de seguimiento como herramienta de medición.', '(Placeholder) La colaboración con TI ya establecida.'] },
      { titulo: '🎯 Qué validar primero en siguiente ciclo', items: ['(Placeholder) Si TI puede definir y aprobar perfiles pre-aprobados en ≤1 semana.', '(Placeholder) Si los casos especiales se reducen con perfiles pre-aprobados (hipótesis: de 20% a ≤5%).'] },
    ],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full">
      {/* ── Left sidebar ───────────────────────────────────────────────────────── */}
      <div className="hidden md:flex w-56 flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <div className="flex items-center gap-2 mt-2">
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Step 3</h2>
            <StatusChip status="En progreso" size="sm" />
          </div>
          <p className="text-xs text-slate-500">Probar en pequeño</p>
        </div>
        <div className="px-2 mb-1"><p className="text-xs text-slate-400" style={{ fontWeight: 600 }}>SUBMÓDULOS</p></div>
        {modules.map(m => (
          <button key={m.id} onClick={() => setActiveModule(m.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors text-left ${activeModule === m.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            style={{ fontWeight: activeModule === m.id ? 600 : 400 }}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${m.completed ? 'bg-emerald-500' : activeModule === m.id ? 'bg-indigo-400' : 'bg-slate-300'}`} />
            <span className="truncate">{m.label}</span>
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-slate-100"><AutosaveIndicator state={saveState} /></div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al proyecto
          </button>
          <div className="flex gap-1 mb-5 md:hidden overflow-x-auto pb-1">
            {modules.map(m => (
              <button key={m.id} onClick={() => setActiveModule(m.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${activeModule === m.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                style={{ fontWeight: activeModule === m.id ? 600 : 400 }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Test Card reference — siempre visible */}
          <div className="border border-violet-100 bg-violet-50 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={13} className="text-violet-500" />
              <p className="text-xs text-violet-700" style={{ fontWeight: 600 }}>Resumen del experimento · del Step 2</p>
              <span className="text-xs text-violet-400 ml-auto">(Contenido de ejemplo para prototipo)</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Hipótesis', value: MOCK_TESTCARD.hipotesis },
                { label: 'Experimento', value: MOCK_TESTCARD.experimento },
                { label: 'Métrica + umbral go/no-go', value: MOCK_TESTCARD.metrica },
                { label: 'Evidencia a capturar', value: MOCK_TESTCARD.evidencia },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-violet-500" style={{ fontWeight: 600 }}>{label}</p>
                  <p className="text-xs text-violet-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              MÓDULO A — Plan del experimento
          ════════════════════════════════════════════════════════════════════ */}
          {activeModule === 'A' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>A · Plan del experimento</h1>
                  <StatusChip status={moduloACompleto ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">Conceptualiza el experimento: formato, artefactos, logística e instrumentación.</p>
              </div>

              {/* S3A_Formato ──────────────────────────────────────────────────── */}
              <SectionCard title="Formato del experimento" icon={Layers}>
                <p className="text-xs text-slate-400 mb-3">¿Qué tipo de artefacto usarás para probar tu hipótesis?</p>
                <div className="flex flex-wrap gap-2">
                  {FORMATOS_EXP.map(f => (
                    <button key={f} onClick={() => setFormatoExp(f)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${formatoExp === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                      style={{ fontWeight: formatoExp === f ? 600 : 400 }}>
                      {f}
                    </button>
                  ))}
                </div>
                {formatoExp && (
                  <div className="mt-3 flex items-center gap-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <CheckCircle2 size={13} className="text-indigo-500 shrink-0" />
                    <p className="text-xs text-indigo-700">Formato seleccionado: <span style={{ fontWeight: 600 }}>{formatoExp}</span></p>
                  </div>
                )}
              </SectionCard>

              {/* S3A_Componentes ──────────────────────────────────────────────── */}
              <SectionCard title="Componentes del experimento (artefactos)" icon={FlaskConical}>
                <p className="text-xs text-slate-400 mb-3">Piezas que componen el experimento: cada una con propósito, canal, dueño y definición de listo.</p>
                <div className="space-y-2 mb-3">
                  {componentes.map(c => (
                    <div key={c.id} className="border border-slate-200 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{c.nombre}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${c.estado === 'Listo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>{c.estado}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{c.proposito}</p>
                        </div>
                        <button onClick={() => setComponentes(p => p.filter(x => x.id !== c.id))} className="p-1 hover:bg-slate-100 rounded transition-colors">
                          <X size={12} className="text-slate-300 hover:text-red-400" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        <div><span className="text-slate-400">Canal:</span> <span className="text-slate-600">{c.canal}</span></div>
                        <div><span className="text-slate-400">Owner:</span> <span className="text-slate-600">{c.owner}</span></div>
                        <div><span className="text-slate-400">DoD:</span> <span className="text-slate-600">{c.dod}</span></div>
                      </div>
                      {c.link && (
                        <p className="text-xs text-indigo-500 mt-1 truncate"><Link size={10} className="inline mr-1" />{c.link}</p>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowComponenteModal(true)} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors" style={{ fontWeight: 500 }}>
                  <Plus size={13} /> Agregar componente
                </button>
              </SectionCard>

              {/* S3A_Checklist ────────────────────────────────────────────────── */}
              <SectionCard title="Lista de preparación" icon={CheckCircle2}>
                <p className="text-xs text-slate-400 mb-3">Confirma que cada punto está resuelto antes de comenzar.</p>
                <div className="space-y-0 -mx-4">
                  {PREP_ITEMS.map((item, i) => (
                    <label key={i} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <input type="checkbox" checked={prepChecks[i]}
                        onChange={e => { const n = [...prepChecks]; n[i] = e.target.checked; setPrepChecks(n); }}
                        className="w-4 h-4 mt-0.5 shrink-0 accent-indigo-600" />
                      <span className={`text-sm transition-colors ${prepChecks[i] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item}</span>
                    </label>
                  ))}
                </div>
                <p className={`text-xs mt-3 ${prepChecks.every(Boolean) ? 'text-emerald-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                  {prepChecks.filter(Boolean).length}/{PREP_ITEMS.length} confirmados{prepChecks.every(Boolean) && ' · ¡Listo para ejecutar!'}
                </p>
              </SectionCard>

              {/* S3A_Logistica ────────────────────────────────────────────────── */}
              <SectionCard title="Logística (dónde y cuándo)" icon={MapPin}>
                <div className="space-y-3">
                  {([
                    { key: 'donde', label: 'Dónde (contexto / canal)', placeholder: 'Ej. Oficina central — en persona + videollamada para casos remotos' },
                    { key: 'cuando', label: 'Cuándo (fecha / ventana)', placeholder: 'Ej. Semana del 3 de marzo, lunes a viernes' },
                    { key: 'duracion', label: 'Duración', placeholder: 'Ej. 5 días hábiles' },
                    { key: 'quienDispara', label: 'Quién dispara el piloto', placeholder: 'Ej. RRHH notifica a TI con el formulario completo' },
                    { key: 'contingencia', label: 'Contingencia (1 línea)', placeholder: 'Ej. Si TI no responde en 24h, escalar al líder de área' },
                  ] as const).map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                      <input value={logistica[key]} onChange={e => setLogistica(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* S3A_Instrumentacion ──────────────────────────────────────────── */}
              <SectionCard title="Captura de evidencia (instrumentación)" icon={Paperclip}>
                <p className="text-xs text-slate-400 mb-3">¿Qué datos vas a capturar, de dónde y quién es responsable?</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-400" style={{ fontWeight: 600 }}>
                    <span className="col-span-3">Dato</span>
                    <span className="col-span-3">Fuente</span>
                    <span className="col-span-2">Resp.</span>
                    <span className="col-span-4">Evidencia</span>
                  </div>
                  {instrumentacion.map(row => (
                    <div key={row.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group text-xs">
                      <span className="col-span-3 text-slate-700">{row.dato}</span>
                      <span className="col-span-3 text-slate-500">{row.fuente}</span>
                      <span className="col-span-2 text-slate-500">{row.responsable}</span>
                      <div className="col-span-4 flex items-center gap-1">
                        {row.evidencia ? (
                          <span className="text-indigo-500 truncate">{row.evidencia}</span>
                        ) : (
                          <button onClick={() => { setInstrRowId(row.id); setShowInstrOverlay(true); }}
                            className="text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1">
                            <Paperclip size={10} /> Adjuntar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setInstrRowId('new'); setShowInstrOverlay(true); }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 px-3 py-2 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors"
                  style={{ fontWeight: 500 }}>
                  <Paperclip size={12} /> Adjuntar evidencia
                </button>
              </SectionCard>

              {/* CTAs */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => toast.success('Borrador guardado')}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Guardar borrador
                </button>
                <button
                  onClick={() => { setModuloACompleto(true); toast.success('Módulo A marcado como completo'); setActiveModule('B'); }}
                  disabled={!formatoExp || !prepChecks.some(Boolean)}
                  className={`flex-1 rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2 ${formatoExp && prepChecks.some(Boolean) ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                  style={{ fontWeight: 500 }}>
                  {moduloACompleto ? <><CheckCircle2 size={14} /> Completo</> : <>Marcar como completo <ChevronRight size={14} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              MÓDULO B — Ejecutar y capturar evidencia
          ════════════════════════════════════════════════════════════════════ */}
          {activeModule === 'B' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>B · Ejecutar y capturar evidencia</h1>
                  <StatusChip status={evidencias.length >= 1 && valorMedido.trim().length > 10 ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">Bitácora operativa, evidencias, malla de aprendizajes y siguiente iteración.</p>
              </div>

              {/* S3B_Bitacora ─────────────────────────────────────────────────── */}
              <SectionCard title="Bitácora de ejecución (qué se hizo)" icon={BookOpen}>
                <p className="text-xs text-slate-400 mb-3">Registra lo ejecutado en tiempo real. El objetivo es tener una traza del proceso, no solo el resultado final.</p>
                <div className="space-y-0 relative">
                  <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />
                  {bitacora.map((ev, i) => (
                    <div key={ev.id} className="relative flex gap-3 pb-4 last:pb-0 group">
                      <div className="w-10 shrink-0 flex flex-col items-center pt-0.5">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center z-10">
                          <span className="text-indigo-600" style={{ fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{ev.accion}</p>
                          <button onClick={() => setBitacora(p => p.filter(e => e.id !== ev.id))}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <X size={12} className="text-slate-300 hover:text-red-400" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400"><Clock size={9} className="inline mr-0.5" />{ev.fecha}{ev.hora && ` · ${ev.hora}`}</span>
                          {ev.responsable && <span className="text-xs text-slate-400"><Users size={9} className="inline mr-0.5" />{ev.responsable}</span>}
                        </div>
                        {ev.nota && <p className="text-xs text-slate-500 mt-0.5 italic">"{ev.nota}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowBitacoraModal(true)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors mt-4"
                  style={{ fontWeight: 500 }}>
                  <Plus size={13} /> Registrar evento
                </button>
              </SectionCard>

              {/* S3B_Evidencias (existente) ─────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Evidencias adjuntas ({evidencias.length})</p>
                  <button onClick={() => setShowAdjuntarOverlay(true)}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    style={{ fontWeight: 500 }}>
                    <Paperclip size={12} /> Adjuntar evidencia
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-400" style={{ fontWeight: 600 }}>
                    <span className="col-span-2">Tipo</span><span className="col-span-7">Descripción</span><span className="col-span-3">Fecha</span>
                  </div>
                  {evidencias.map(ev => (
                    <div key={ev.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group">
                      <div className="col-span-2 flex items-start">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ev.tipo === 'Archivo' ? 'bg-slate-100 text-slate-600' : ev.tipo === 'Link' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-700'}`} style={{ fontWeight: 500 }}>{ev.tipo}</span>
                      </div>
                      <p className="col-span-7 text-xs text-slate-700 self-center">{ev.descripcion}</p>
                      <div className="col-span-3 flex items-center justify-between">
                        <p className="text-xs text-slate-400">{ev.fecha}</p>
                        <button onClick={() => setEvidencias(p => p.filter(e => e.id !== ev.id))} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} className="text-slate-300 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {evidencias.length === 0 && <div className="px-4 py-8 text-center text-xs text-slate-400">Sin evidencias aún. Adjunta archivos, links o notas.</div>}
                </div>
              </div>

              {/* S3B_MallaReceptora ──────────────────────────────────────────── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-500" />
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Malla receptora (lo que aprendimos en campo)</p>
                  </div>
                  <button onClick={() => setShowMallaModal(true)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2 py-1 bg-violet-50 rounded-lg border border-violet-200 transition-colors"
                    style={{ fontWeight: 500 }}>
                    <Plus size={11} /> Agregar
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {MALLA_SECCIONES.map(({ key, label, color, icon: Icon }) => {
                    const items = mallaByTipo(key);
                    const open = mallaSeccionAbierta === key;
                    return (
                      <div key={key}>
                        <button onClick={() => setMallaSeccionAbierta(open ? null : key)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${colorMap[color].split(' ')[0]}`}>
                              <Icon size={12} className={colorMap[color].split(' ')[2]} />
                            </div>
                            <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>{label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${colorMap[color]}`} style={{ fontWeight: 600 }}>{items.length}</span>
                          </div>
                          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </button>
                        {open && (
                          <div className="px-4 pb-3 space-y-2">
                            {items.length === 0 && <p className="text-xs text-slate-400 italic">Sin registros aún. Agrega lo que observaste en campo.</p>}
                            {items.map(item => (
                              <div key={item.id} className={`flex items-start gap-2 p-2.5 rounded-xl border ${colorMap[color]} group`}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-700">{item.descripcion}</p>
                                  {item.severidad && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${severidadMap[item.severidad]}`} style={{ fontWeight: 500 }}>
                                      Impacto {item.severidad}
                                    </span>
                                  )}
                                </div>
                                <button onClick={() => setMalla(p => p.filter(m => m.id !== item.id))} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <X size={11} className="text-slate-300 hover:text-red-400" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Registro de resultados (existente) ─────────────────────────────── */}
              <SectionCard title="Registro de resultados" icon={TrendingUp}>
                <div className="space-y-3">
                  {([
                    { key: 'valorMedido', label: 'Valor medido', value: valorMedido, set: setValorMedido, placeholder: 'Ej. 4/5 casos resueltos en menos de 24 horas (80%)', rows: 1 },
                    { key: 'observaciones', label: 'Observaciones', value: observaciones, set: setObservaciones, placeholder: '¿Qué pasó durante el experimento?', rows: 3 },
                    { key: 'incidencias', label: 'Incidencias', value: incidencias, set: setIncidencias, placeholder: '¿Hubo problemas, desvíos o excepciones?', rows: 2 },
                  ] as const).map(({ key, label, value, set, placeholder, rows }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>{label}</label>
                      <textarea value={value} onChange={e => (set as (v: string) => void)(e.target.value)} rows={rows}
                        placeholder={placeholder}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* S3B_SiguienteIteracion ──────────────────────────────────────── */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Siguiente iteración (re-test)</p>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-sm">No busques lo perfecto. Apunta al MVP: lo mínimo que resuelve y se puede probar.</p>
                  </div>
                  <button onClick={() => {
                    setShowIANextOverlay(true);
                    if (!iaNextListo) { setIaNextLoading(true); setTimeout(() => { setIaNextLoading(false); setIaNextListo(true); }, 1800); }
                  }}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors shrink-0"
                    style={{ fontWeight: 500 }}>
                    <Sparkles size={12} /> Definir qué sigue con IA
                  </button>
                </div>
                {iaNextSelected !== null && (
                  <div className="flex items-center gap-2 p-2 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-700">
                    <CheckCircle2 size={12} className="shrink-0 text-violet-500" />
                    Sugerencia IA aplicada: <span style={{ fontWeight: 600 }}>{IA_SUGERENCIAS_NEXT[iaNextSelected].titulo}</span>
                  </div>
                )}
                <div className="space-y-3">
                  {([
                    { key: 'quePunto', label: 'Qué punto pendiente validaremos ahora', placeholder: '(Placeholder) Ej. Reducir tiempo de resolución de accesos especiales de 36h a ≤24h' },
                    { key: 'queCambia', label: 'Qué cambiaremos del experimento (1–3 cambios)', placeholder: '(Placeholder) Ej. Agregar campo "tipo de acceso especial" + flujo de escalado directo a TI Senior' },
                    { key: 'comoPrueba', label: 'Cómo lo volveremos a probar (método / canal)', placeholder: '(Placeholder) Ej. Mismo formulario con nuevo campo + seguimiento en Sheets' },
                    { key: 'cuando', label: 'Cuándo lo probaremos (fecha / ventana)', placeholder: '(Placeholder) Ej. Semana del 10 de marzo — próximos 3 ingresos' },
                  ] as const).map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                      <textarea value={sigIter[key]} onChange={e => setSigIter(p => ({ ...p, [key]: e.target.value }))}
                        rows={2} placeholder={placeholder}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { toast.success('Evidencias guardadas'); setActiveModule('C'); }}
                disabled={evidencias.length < 1 || valorMedido.trim().length < 10}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${evidencias.length >= 1 && valorMedido.trim().length > 10 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={{ fontWeight: 500 }}>
                {evidencias.length >= 1 && valorMedido.trim().length > 10
                  ? <>Módulo B listo → Analizar resultados <ChevronRight size={15} /></>
                  : <><AlertCircle size={14} /> Registra al menos 1 evidencia y el valor medido</>}
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              MÓDULO C — Resultados y decisión
          ════════════════════════════════════════════════════════════════════ */}
          {activeModule === 'C' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>C · Resultados y decisión</h1>
                  <StatusChip status={goNoGo && hasFeedback ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">Compara plan vs realidad, revisa el diagnóstico IA, toma una decisión y prepara el relato para Step 4.</p>
              </div>

              {/* S3C_Comparativo ─────────────────────────────────────────────── */}
              <SectionCard title="Comparativo: Plan (Step 2) vs Real (campo)" icon={TrendingUp}>
                <p className="text-xs text-slate-400 mb-3">Los datos de "Lo que esperábamos" vienen pre-cargados del Test Card del Step 2 (solo visual).</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>LO QUE ESPERÁBAMOS</p>
                    <div className="space-y-2">
                      {[
                        { label: 'Hipótesis', value: 'Reducir tiempo de alta TI de 7 días a ≤24h en 80% de casos.' },
                        { label: 'Umbral de éxito', value: '≤24h en ≥80% de casos procesados.' },
                        { label: 'Muestra', value: '5 empleados nuevos — perfiles estándar.' },
                        { label: 'Método', value: 'Google Forms + notificación a TI.' },
                      ].map(({ label, value }) => (
                        <div key={label} className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                          <p className="text-xs text-blue-400 mb-0.5" style={{ fontWeight: 600 }}>{label}</p>
                          <p className="text-xs text-blue-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>LO QUE PASÓ</p>
                    <div className="space-y-2">
                      {[
                        { label: 'Resultado real', value: '4/5 casos en ≤24h (80% — umbral alcanzado). 1 caso especial: 36h.' },
                        { label: 'Umbral real', value: '80% alcanzado (justo en el límite).' },
                        { label: 'Muestra real', value: '5 empleados — 4 estándar, 1 con accesos especiales.' },
                        { label: 'Observación clave', value: 'Casos especiales duplican el tiempo — 20% del volumen.' },
                      ].map(({ label, value }) => (
                        <div key={label} className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                          <p className="text-xs text-emerald-500 mb-0.5" style={{ fontWeight: 600 }}>{label}</p>
                          <p className="text-xs text-emerald-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Comparación vs umbral (existente) ─────────────────────────────── */}
              <SectionCard title="Comparación vs umbral" icon={Target}>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Umbral go/no-go', value: umbral },
                    { label: 'Resultado obtenido', value: resultado },
                    { label: 'Estado', value: 'Go', chip: true, chipColor: 'bg-emerald-100 text-emerald-700' },
                  ].map(({ label, value, chip, chipColor }) => (
                    <div key={label} className="text-center">
                      <p className="text-xs text-slate-400 mb-1" style={{ fontWeight: 500 }}>{label}</p>
                      {chip ? (
                        <span className={`text-sm px-3 py-1 rounded-full ${chipColor}`} style={{ fontWeight: 700 }}>{value}</span>
                      ) : (
                        <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{value}</p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* S3C_DiagnosticoIA ───────────────────────────────────────────── */}
              <div className="border border-violet-200 bg-violet-50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-violet-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-500" />
                    <p className="text-sm text-violet-800" style={{ fontWeight: 600 }}>Diagnóstico preliminar IA</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-200 text-violet-700" style={{ fontWeight: 600 }}>Editable</span>
                  </div>
                  <button onClick={() => setEditandoDiag(p => !p)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 px-2 py-1 bg-white border border-violet-200 rounded-lg transition-colors"
                    style={{ fontWeight: 500 }}>
                    <Edit2 size={11} /> {editandoDiag ? 'Guardar' : 'Editar diagnóstico'}
                  </button>
                </div>
                <div className="px-4 py-4 space-y-3">
                  {([
                    { key: 'senales' as const, label: '✅ Señales positivas', color: 'text-emerald-700' },
                    { key: 'riesgos' as const, label: '⚠️ Riesgos / fricciones', color: 'text-amber-700' },
                    { key: 'queFalta' as const, label: '🔍 Qué falta validar', color: 'text-blue-700' },
                  ]).map(({ key, label, color }) => (
                    <div key={key}>
                      <p className={`text-xs mb-1.5 ${color}`} style={{ fontWeight: 600 }}>{label}</p>
                      <div className="space-y-1.5">
                        {diagnostico[key].map((item, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-slate-300 mt-0.5 shrink-0">·</span>
                            {editandoDiag ? (
                              <input value={item}
                                onChange={e => {
                                  const next = [...diagnostico[key]];
                                  next[i] = e.target.value;
                                  setDiagnostico(p => ({ ...p, [key]: next }));
                                }}
                                className="flex-1 border border-violet-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400" />
                            ) : (
                              <p className="text-xs text-slate-700">{item}</p>
                            )}
                          </div>
                        ))}
                        {editandoDiag && (
                          <button onClick={() => setDiagnostico(p => ({ ...p, [key]: [...p[key], ''] }))}
                            className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 ml-4 transition-colors">
                            <Plus size={10} /> Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aprendizajes clave (existente) ──────────────────────────────── */}
              <div>
                <p className="text-sm text-slate-700 mb-2" style={{ fontWeight: 500 }}>Aprendizajes clave</p>
                <div className="space-y-2">
                  {aprendizajes.map((a, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{i + 1}</span>
                      <textarea value={a} onChange={e => { const n = [...aprendizajes]; n[i] = e.target.value; setAprendizajes(n); }}
                        rows={2} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  ))}
                  <button onClick={() => setAprendizajes(p => [...p, ''])}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors ml-8">
                    <Plus size={12} /> Agregar aprendizaje
                  </button>
                </div>
              </div>

              {/* Decisión (existente + Pivote) ───────────────────────────────── */}
              <div>
                <p className="text-sm text-slate-700 mb-2" style={{ fontWeight: 500 }}>Decisión</p>
                <p className="text-xs text-slate-400 mb-3">Con base en los resultados y aprendizajes, ¿qué hacemos?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    { key: 'Go' as const, label: '🚀 Go', desc: 'Escalamos', active: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                    { key: 'Iterar' as const, label: '🔄 Iterar', desc: 'Re-testeamos', active: 'border-amber-500 bg-amber-50 text-amber-800' },
                    { key: 'No-Go' as const, label: '🛑 No-Go', desc: 'Descartamos', active: 'border-red-500 bg-red-50 text-red-800' },
                    { key: 'Pivote' as const, label: '🔀 Pivote', desc: 'Cambiamos variable', active: 'border-indigo-500 bg-indigo-50 text-indigo-800' },
                  ]).map(({ key, label, desc, active }) => (
                    <button key={key} onClick={() => setGoNoGo(key)}
                      className={`rounded-xl p-3 text-center border-2 transition-colors ${goNoGo === key ? active : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <p className="text-sm" style={{ fontWeight: 600 }}>{label}</p>
                      <p className={`text-xs mt-0.5 ${goNoGo === key ? 'opacity-70' : 'text-slate-400'}`}>{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* S3C_RecomendacionIA ─────────────────────────────────────────── */}
              {goNoGo && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-indigo-500" />
                      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Recomendación IA: qué hacer ahora</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${goNoGo === 'Go' ? 'bg-emerald-100 text-emerald-700' : goNoGo === 'Iterar' ? 'bg-amber-100 text-amber-700' : goNoGo === 'No-Go' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`} style={{ fontWeight: 600 }}>{goNoGo}</span>
                    </div>
                    <button onClick={() => { setShowRefinarOverlay(true); if (!refinarListo) { setRefinarLoading(true); setTimeout(() => { setRefinarLoading(false); setRefinarListo(true); }, 1500); } }}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
                      style={{ fontWeight: 500 }}>
                      <Sparkles size={11} /> Refinar recomendación con IA
                    </button>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    {(recomendaciones[goNoGo] || []).map(({ titulo, items }) => (
                      <div key={titulo}>
                        <p className="text-xs text-slate-600 mb-1.5" style={{ fontWeight: 600 }}>{titulo}</p>
                        <ul className="space-y-1">
                          {items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-slate-300 mt-0.5 shrink-0">·</span>{item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Overlay_S3_MentorComplete_Demo trigger ── */}
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>¿Listo para cerrar el Step 3?</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Marca la sesión con mentor como completada para desbloquear el Step 4.</p>
                </div>
                <button
                  onClick={() => setShowFinalizarDemo(true)}
                  className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm transition-colors"
                  style={{ fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Finalizar Step 3 (demo)
                </button>
              </div>

              {/* Enviar a revisión IA ──────────────────────────────────────────── */}
              {!hasFeedback && (
                <div className="border-t border-slate-200 pt-4">
                  <button onClick={() => setShowSendModal(true)} disabled={!goNoGo}
                    className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${goNoGo ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    style={{ fontWeight: 500 }}>
                    {goNoGo ? <><Send size={14} /> Enviar a revisión IA</> : <><Lock size={14} /> Elige una decisión para enviar</>}
                  </button>
                </div>
              )}
              {hasFeedback && <FeedbackIAPanel feedback={MOCK_FEEDBACK_S3} />}

              {/* S3C_Pack_Step4 ──────────────────────────────────────────────── */}
              {hasFeedback && (
                <div className="border-2 border-indigo-200 bg-indigo-50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-indigo-100 border-b border-indigo-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-indigo-600" />
                      <p className="text-sm text-indigo-800" style={{ fontWeight: 600 }}>Preparar Step 4 — Contar la historia</p>
                    </div>
                    <button onClick={() => { setShowDeckOverlay(true); if (!deckSlides.length) { setDeckLoading(true); setTimeout(() => { setDeckLoading(false); setDeckSlides(MOCK_DECK_SLIDES); }, 1800); } }}
                      className="flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-900 px-3 py-1.5 bg-white border border-indigo-300 rounded-lg transition-colors"
                      style={{ fontWeight: 500 }}>
                      <Sparkles size={11} /> Generar borrador de presentación con IA
                    </button>
                  </div>
                  <div className="px-4 py-4 space-y-4">
                    <div>
                      <p className="text-xs text-indigo-600 mb-2" style={{ fontWeight: 600 }}>Story outline</p>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {['Problema', 'Hipótesis', 'Experimento', 'Resultados', 'Decisión', 'Aprendizajes', 'Próximo paso'].map((s, i) => (
                          <div key={s} className="flex items-center gap-1.5 bg-white border border-indigo-100 rounded-lg px-2 py-1.5">
                            <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center shrink-0" style={{ fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
                            <span className="text-xs text-indigo-700" style={{ fontWeight: 500 }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 mb-2" style={{ fontWeight: 600 }}>Bullets para slides (placeholder)</p>
                      <ul className="space-y-1">
                        {['(Placeholder) El proceso tardaba 7–21 días · ahora ≤24h en 80% de casos.',
                          '(Placeholder) NPS de 82 — alta aceptación del proceso simplificado.',
                          '(Placeholder) Accesos especiales: cuello de botella identificado y aislado.',
                          '(Placeholder) TI adoptó el proceso — SLA informal establecido.',
                          '(Placeholder) Próximo ciclo: automatización de accesos especiales.'].map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                            <span className="text-indigo-300 mt-0.5 shrink-0">·</span>{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 mb-2" style={{ fontWeight: 600 }}>Evidencias a mostrar</p>
                      <div className="space-y-1">
                        {evidencias.slice(0, 3).map(ev => (
                          <div key={ev.id} className="flex items-center gap-2 text-xs">
                            <Paperclip size={10} className="text-indigo-400 shrink-0" />
                            <span className="text-indigo-700">{ev.descripcion}</span>
                            <span className="text-indigo-300">· {ev.fecha}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Ir al Step 4 */}
                    <div className="pt-2 border-t border-indigo-200">
                      <button
                        onClick={() => {
                          const step3approved = project?.steps.find(s => s.number === 3)?.status === 'Aprobado';
                          if (!step3approved) {
                            toast.error('Finaliza el Step 3 primero usando el botón "Finalizar Step 3 (demo)".');
                            return;
                          }
                          navigate(`/projects/${projectId}/step/4`);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm transition-colors"
                        style={{ fontWeight: 600 }}>
                        Ir al Step 4 — Contar la historia <ChevronRight size={15} />
                      </button>
                    </div>

                    {deckAplicado && deckSlides.length > 0 && (
                      <div>
                        <p className="text-xs text-indigo-600 mb-2" style={{ fontWeight: 600 }}>Estructura de presentación generada por IA</p>
                        <div className="space-y-2">
                          {deckSlides.map((slide, i) => (
                            <div key={i} className="bg-white border border-indigo-100 rounded-xl p-3">
                              <p className="text-xs text-indigo-700 mb-1" style={{ fontWeight: 600 }}>Lámina {i + 1}: {slide.titulo}</p>
                              <ul className="space-y-0.5">
                                {slide.bullets.map((b, j) => (
                                  <li key={j} className="flex items-start gap-1.5 text-xs text-slate-600">
                                    <span className="text-slate-300 shrink-0">·</span>{b}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sesión con experto Step 3 ─────────────────────────────────────── */}
              {hasFeedback && MOCK_FEEDBACK_S3.status === 'Aprobado' && (
                s3SessionBooked ? (
                  <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><CheckCircle2 size={15} className="text-emerald-600" /></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>Sesión agendada</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800" style={{ fontWeight: 600 }}>✓ Step 3 aprobado</span>
                        </div>
                        {s3MentorDate && <p className="text-xs text-emerald-600 mt-0.5"><Clock size={10} className="inline mr-1" />{s3MentorDate}{s3MentorTime ? ` · ${s3MentorTime}` : ''}</p>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                    <p className="text-sm text-amber-800 mb-1" style={{ fontWeight: 600 }}>Sesión con experto obligatoria</p>
                    <p className="text-xs text-amber-600 mb-3">Agenda la sesión con tu mentor para cerrar el Step 3 y decidir el camino a seguir.</p>
                    <button onClick={() => setShowS3MentorModal(true)}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors"
                      style={{ fontWeight: 500 }}>
                      <Calendar size={14} /> Agendar sesión con mentor
                    </button>
                    <p className="text-xs text-amber-500 mt-2 italic">Modo demo: al agendar se cierra el Step 3.</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALES Y OVERLAYS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Modal: Agregar componente (S3A) */}
      {showComponenteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agregar componente</h3>
              <button onClick={() => setShowComponenteModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {([
                { key: 'nombre', label: 'Nombre del componente', placeholder: 'Ej. Formulario de solicitud' },
                { key: 'proposito', label: 'Propósito', placeholder: 'Ej. Centralizar la solicitud de accesos' },
                { key: 'canal', label: 'Canal / Herramienta', placeholder: 'Ej. Google Forms' },
                { key: 'owner', label: 'Owner', placeholder: 'Ej. Ana R.' },
                { key: 'link', label: 'Link / Asset (opcional)', placeholder: 'https://...' },
                { key: 'dod', label: 'DoD — Definición de listo (1 línea)', placeholder: 'Ej. Todos los campos validados + notificación automática' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                  <input value={nuevoComp[key]} onChange={e => setNuevoComp(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Estado</label>
                <div className="flex gap-2">
                  {(['Pendiente', 'Listo'] as const).map(s => (
                    <button key={s} onClick={() => setNuevoComp(p => ({ ...p, estado: s }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${nuevoComp.estado === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                      style={{ fontWeight: nuevoComp.estado === s ? 600 : 400 }}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowComponenteModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addComponente} disabled={!nuevoComp.nombre.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Guardar componente</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Adjuntar evidencia instrumentación (S3A) */}
      {showInstrOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Adjuntar evidencia</h3>
              <button onClick={() => { setShowInstrOverlay(false); setInstrTipo(null); setInstrDesc(''); }}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {([{ key: 'archivo' as const, icon: Upload, label: 'Subir archivo' }, { key: 'link' as const, icon: Link, label: 'Pegar link' }]).map(({ key, icon: Icon, label }) => (
                  <button key={key} onClick={() => setInstrTipo(key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${instrTipo === key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Icon size={18} className={instrTipo === key ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className={`text-xs ${instrTipo === key ? 'text-indigo-700' : 'text-slate-500'}`} style={{ fontWeight: instrTipo === key ? 600 : 400 }}>{label}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>{instrTipo === 'link' ? 'URL o link' : 'Descripción'}</label>
                <input value={instrDesc} onChange={e => setInstrDesc(e.target.value)}
                  placeholder={instrTipo === 'link' ? 'https://...' : 'Describe brevemente qué es...'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setShowInstrOverlay(false); setInstrTipo(null); setInstrDesc(''); }} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => {
                if (!instrTipo || !instrDesc.trim()) return;
                if (instrRowId === 'new') {
                  setInstrumentacion(p => [...p, { id: Date.now().toString(), dato: instrDesc.trim(), fuente: '(Placeholder)', responsable: '—', evidencia: '' }]);
                } else {
                  setInstrumentacion(p => p.map(r => r.id === instrRowId ? { ...r, evidencia: instrDesc.trim() } : r));
                }
                setShowInstrOverlay(false); setInstrTipo(null); setInstrDesc('');
                toast.success('Evidencia adjuntada');
              }} disabled={!instrTipo || !instrDesc.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Adjuntar</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Adjuntar evidencia (S3B) */}
      {showAdjuntarOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Adjuntar evidencia</h3>
              <button onClick={() => { setShowAdjuntarOverlay(false); setAdjuntarTipo(null); setAdjuntarDesc(''); }}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {([{ key: 'archivo' as const, icon: Upload, label: 'Subir archivo' }, { key: 'link' as const, icon: Link, label: 'Pegar link' }]).map(({ key, icon: Icon, label }) => (
                  <button key={key} onClick={() => setAdjuntarTipo(key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${adjuntarTipo === key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Icon size={18} className={adjuntarTipo === key ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className={`text-xs ${adjuntarTipo === key ? 'text-indigo-700' : 'text-slate-500'}`} style={{ fontWeight: adjuntarTipo === key ? 600 : 400 }}>{label}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>{adjuntarTipo === 'link' ? 'URL o link' : 'Descripción'}</label>
                <input value={adjuntarDesc} onChange={e => setAdjuntarDesc(e.target.value)}
                  placeholder={adjuntarTipo === 'link' ? 'https://...' : 'Describe brevemente qué es...'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setShowAdjuntarOverlay(false); setAdjuntarTipo(null); setAdjuntarDesc(''); }} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addEvidencia} disabled={!adjuntarTipo || !adjuntarDesc.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Adjuntar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar evento en bitácora (S3B) */}
      {showBitacoraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Registrar evento</h3>
              <button onClick={() => setShowBitacoraModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Fecha</label>
                  <input type="date" value={nuevoBit.fecha} onChange={e => setNuevoBit(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Hora (opcional)</label>
                  <input type="time" value={nuevoBit.hora} onChange={e => setNuevoBit(p => ({ ...p, hora: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Acción ejecutada</label>
                <input value={nuevoBit.accion} onChange={e => setNuevoBit(p => ({ ...p, accion: e.target.value }))}
                  placeholder="Ej. Se envió formulario al empleado #3 (Luis M.)"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Responsable</label>
                <input value={nuevoBit.responsable} onChange={e => setNuevoBit(p => ({ ...p, responsable: e.target.value }))}
                  placeholder="Ej. Ana R."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Nota breve (opcional)</label>
                <input value={nuevoBit.nota} onChange={e => setNuevoBit(p => ({ ...p, nota: e.target.value }))}
                  placeholder="Ej. Sin incidencias, perfil estándar"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowBitacoraModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addEventoBitacora} disabled={!nuevoBit.accion.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Registrar evento</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar ítem malla receptora (S3B) */}
      {showMallaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Registrar aprendizaje de campo</h3>
              <button onClick={() => setShowMallaModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'idea' as const, label: '💡 Idea interesante' },
                    { key: 'critica' as const, label: '⚠️ Crítica / fricción' },
                    { key: 'pregunta' as const, label: '❓ Pregunta nueva' },
                    { key: 'hipotesis' as const, label: '🔬 Hipótesis / mejora' },
                  ]).map(({ key, label }) => (
                    <button key={key} onClick={() => setNuevoMalla(p => ({ ...p, tipo: key }))}
                      className={`px-3 py-2 rounded-xl text-xs border-2 transition-colors ${nuevoMalla.tipo === key ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      style={{ fontWeight: nuevoMalla.tipo === key ? 600 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Descripción</label>
                <textarea value={nuevoMalla.descripcion} onChange={e => setNuevoMalla(p => ({ ...p, descripcion: e.target.value }))}
                  rows={3} placeholder="Describe lo que observaste o aprendiste..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Evidencia asociada (opcional link)</label>
                <input value={nuevoMalla.evidencia} onChange={e => setNuevoMalla(p => ({ ...p, evidencia: e.target.value }))}
                  placeholder="https://... o descripción de la evidencia"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Severidad / impacto (opcional)</label>
                <div className="flex gap-2">
                  {(['alto', 'medio', 'bajo', ''] as const).map(s => (
                    <button key={s} onClick={() => setNuevoMalla(p => ({ ...p, severidad: s }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${nuevoMalla.severidad === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}
                      style={{ fontWeight: nuevoMalla.severidad === s ? 600 : 400 }}>
                      {s === '' ? 'Sin definir' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowMallaModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addMallaItem} disabled={!nuevoMalla.descripcion.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: IA — Siguiente iteración (S3B) */}
      {showIANextOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Sugerencias IA — siguiente paso de experimentación</h3>
              </div>
              <button onClick={() => setShowIANextOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {iaNextLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Analizando evidencias y malla receptora…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-1">La IA analizó tus resultados y aprendizajes de campo. Elige la opción que mejor se ajusta a tu contexto:</p>
                  {IA_SUGERENCIAS_NEXT.map((s, i) => (
                    <div key={i} className={`border-2 rounded-xl p-4 transition-colors cursor-pointer ${iaNextSelected === i ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                      onClick={() => setIaNextSelected(i)}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`} style={{ fontWeight: 600 }}>
                            {i === 0 ? 'Iterar' : i === 1 ? 'Complementar' : 'Pivote parcial'}
                          </span>
                          <span className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{s.titulo}</span>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0 bg-slate-100 px-2 py-0.5 rounded-full">{s.duracion}</span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p><span style={{ fontWeight: 600 }}>Objetivo:</span> {s.objetivo}</p>
                        <p><span style={{ fontWeight: 600 }}>Cambio:</span> {s.cambio}</p>
                        <p><span style={{ fontWeight: 600 }}>Evidencia:</span> {s.evidencia}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!iaNextLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowIANextOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
                <button onClick={() => iaNextSelected !== null && applyIASugerencia(iaNextSelected)}
                  disabled={iaNextSelected === null}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar sugerencia
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay: Refinar recomendación IA (S3C) */}
      {showRefinarOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Versiones de recomendación IA</h3>
              </div>
              <button onClick={() => setShowRefinarOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {refinarLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Generando variantes de recomendación…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">3 variantes de recomendación según tu decisión <span style={{ fontWeight: 600 }}>"{goNoGo}"</span> y contexto:</p>
                  {[
                    { label: 'Conservadora', desc: '(Placeholder) Implementa el cambio con la muestra mínima necesaria para validar sin riesgo operativo. Prioriza estabilidad sobre velocidad.' },
                    { label: 'Balanceada', desc: '(Placeholder) Escala gradualmente: primero implementa el ajuste, mide 2 semanas y decide expansión. Equilibrio riesgo-velocidad.' },
                    { label: 'Acelerada', desc: '(Placeholder) Implementa el cambio completo en la próxima semana con todos los empleados nuevos. Maximiza aprendizaje rápido.' },
                  ].map((v, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer group">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{v.label}</p>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-indigo-600 hover:text-indigo-800 px-2 py-0.5 bg-indigo-100 rounded"
                          onClick={() => { setShowRefinarOverlay(false); toast.success(`Recomendación "${v.label}" aplicada`); }}
                          style={{ fontWeight: 500 }}>
                          Usar esta
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">{v.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!refinarLoading && (
              <div className="px-6 pb-5">
                <button onClick={() => setShowRefinarOverlay(false)} className="w-full border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay: Borrador de presentación IA (S3C) */}
      {showDeckOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Borrador de presentación — Step 4</h3>
              </div>
              <button onClick={() => setShowDeckOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {deckLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Generando estructura de láminas con IA…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 mb-3">
                    <span>ℹ️</span>
                    <span>Estructura de <span style={{ fontWeight: 600 }}>{MOCK_DECK_SLIDES.length} láminas</span> generada en base a tu experimento. Todos los contenidos son placeholder — edita antes de presentar.</span>
                  </div>
                  {MOCK_DECK_SLIDES.map((slide, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>Lámina {i + 1}</p>
                      <p className="text-sm text-slate-800 mb-2" style={{ fontWeight: 600 }}>{slide.titulo}</p>
                      <ul className="space-y-1">
                        {slide.bullets.map((b, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="text-slate-300 shrink-0">·</span>{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!deckLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowDeckOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
                <button onClick={() => { setDeckAplicado(true); setDeckSlides(MOCK_DECK_SLIDES); setShowDeckOverlay(false); toast.success('Estructura aplicada a la card de Step 4'); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar estructura
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Enviar a revisión IA */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Enviar Step 3 a revisión IA</h3>
            <p className="text-sm text-slate-500 mb-4">Se enviará: Resultados · Evidencias · Malla de aprendizajes · Aprendizajes · Decisión: <span style={{ fontWeight: 600 }}>{goNoGo}</span></p>
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => { setShowSendModal(false); toast.success('Enviado a revisión IA'); setTimeout(() => setHasFeedback(true), 1200); }}
                className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm hover:bg-violet-700 transition-colors" style={{ fontWeight: 500 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay_S3_MentorComplete_Demo ────────────────────────────────── */}
      {showFinalizarDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Sesión con mentor (demo)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Simula la aprobación del Step 3 para desbloquear el Step 4.</p>
              </div>
              <button onClick={() => setShowFinalizarDemo(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Resumen del step */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>RESUMEN DEL STEP 3 PARA LA SESIÓN</p>
                {[
                  { label: 'Decisión tomada', value: goNoGo ?? '(Placeholder) Sin seleccionar aún' },
                  { label: 'Evidencias adjuntas', value: `${evidencias.length} evidencias registradas` },
                  { label: 'Aprendizajes', value: `${aprendizajes.length} aprendizajes documentados` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div><span className="text-xs text-slate-500">{label}: </span><span className="text-xs text-slate-700" style={{ fontWeight: 500 }}>{value}</span></div>
                  </div>
                ))}
              </div>
              {/* Mentor info placeholder */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-indigo-700 text-sm" style={{ fontWeight: 700 }}>AG</span>
                </div>
                <div>
                  <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>Ana García</p>
                  <p className="text-xs text-slate-400">Mentor · Innovación & Procesos</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full" style={{ fontWeight: 600 }}>Pendiente</span>
              </div>
              <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <span className="text-sm shrink-0">ℹ️</span>
                <p className="text-xs text-indigo-600">
                  <span style={{ fontWeight: 600 }}>Modo demo:</span> al hacer click en "Marcar sesión como completada" el Step 3 se aprueba automáticamente y el Step 4 se desbloquea.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowFinalizarDemo(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button
                onClick={() => {
                  aprobarStep3EnContexto();
                  setS3SessionBooked(true);
                  setShowFinalizarDemo(false);
                  toast.success('Step 3 aprobado. Step 4 desbloqueado.', { description: 'Redirigiendo al Step 4…' });
                  setTimeout(() => navigate(`/projects/${projectId}/step/4`), 1600);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}>
                <CheckCircle2 size={14} /> Marcar sesión como completada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agendar sesión mentora Step 3 */}
      {showS3MentorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agendar sesión con mentor</h3>
                <p className="text-xs text-slate-500 mt-0.5">Para cerrar el Step 3 y decidir el siguiente paso.</p>
              </div>
              <button onClick={() => setShowS3MentorModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}><Calendar size={11} className="inline mr-1 text-slate-400" />Fecha</label>
                  <input type="date" value={s3MentorDate} onChange={e => setS3MentorDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}><Clock size={11} className="inline mr-1 text-slate-400" />Hora</label>
                  <select value={s3MentorTime} onChange={e => setS3MentorTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Seleccionar…</option>
                    {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '17:00'].map(h => <option key={h} value={h}>{h} hrs</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Mentor</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Ana García · Innovación & Procesos</option>
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <span className="text-sm shrink-0">ℹ️</span>
                <p className="text-xs text-indigo-600"><span style={{ fontWeight: 600 }}>Modo demo:</span> al confirmar se simula el cierre del Step 3.</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowS3MentorModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => {
                aprobarStep3EnContexto();
                setShowS3MentorModal(false);
                setS3SessionBooked(true);
                toast.success('Step 3 aprobado. Step 4 desbloqueado.', { description: 'Redirigiendo al Step 4…' });
                setTimeout(() => navigate(`/projects/${projectId}/step/4`), 1600);
              }}
                disabled={!s3MentorDate || !s3MentorTime}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                Confirmar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
