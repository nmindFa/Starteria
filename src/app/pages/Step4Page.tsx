import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Lock, CheckCircle2, ChevronRight, Sparkles, X,
  FileText, Presentation, Send, Calendar, Clock, Download,
  Share2, Package, Users, Paperclip, Plus, Edit2, Check,
  Play, Video, Image, ClipboardList, Building2, AlertTriangle,
  Target, Zap, TrendingUp, BarChart2, ChevronDown, ChevronUp,
  BookOpen, Settings,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';

// ── Types ─────────────────────────────────────────────────────────────────────
type ModuleId = 'overview' | 'A' | 'B' | 'C';
type Audiencia = 'Gerencia' | 'Sponsor' | 'Comité' | 'Equipo operativo' | 'TI' | 'RRHH';
type ObjetivoStory = 'Alinear' | 'Pedir aprobación' | 'Pedir recursos' | 'Decidir' | 'Informar avance';
type DecisionTipo = 'Go' | 'Iterar' | 'No-Go' | 'Pivote' | null;
type DemoFormato = 'Link demo' | 'Video' | 'Capturas' | 'Registro de uso';
type TabC = 'deck' | 'plan' | 'talk';

interface DemoItem {
  id: string; formato: DemoFormato; url: string;
  queDemuesta: string; audiencia: string;
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const MOCK_S4_FEEDBACK = {
  status: 'Aprobado' as const,
  summary: 'La historia es coherente con los Steps anteriores. El relato integra bien el reto, la solución, la evidencia y la decisión.',
  goodPoints: ['Narrativa consistente con Steps 1–3', 'Métricas integradas', 'Decisión y aprendizajes documentados', 'Story outline completo'],
  missing: [], actions: [],
  questions: ['¿El story outline es comprensible para alguien sin contexto interno?'],
  timestamp: '2025-03-01T15:00:00Z',
};

const MOCK_EVIDENCIAS_S3 = [
  { id: 'e1', tipo: 'Archivo', descripcion: 'Capturas de pantalla del formulario completo', fecha: '2025-02-24', incluir: true, queDemuesta: '(Placeholder) Que el formulario es funcional y completo.', queDecisionSoporta: 'Go', slidesSugerida: 'Resultado' },
  { id: 'e2', tipo: 'Link', descripcion: 'Hoja de seguimiento en Google Sheets', fecha: '2025-02-25', incluir: true, queDemuesta: '(Placeholder) El registro de tiempo de respuesta por caso.', queDecisionSoporta: 'Go', slidesSugerida: 'Resultado' },
  { id: 'e3', tipo: 'Nota', descripcion: 'Observaciones del facilitador durante el piloto', fecha: '2025-02-26', incluir: false, queDemuesta: '', queDecisionSoporta: '', slidesSugerida: 'Aprendizaje' },
];

const SLIDES_EJECUTIVO = [
  { n: 1, titulo: 'El problema', bullets: ['(Placeholder) Nuevos empleados tardaban 7–21 días en tener accesos activos.', '(Placeholder) Costo: ~X horas de RRHH + TI por caso.'] },
  { n: 2, titulo: 'Nuestra hipótesis', bullets: ['(Placeholder) Formulario unificado → ≤24h en ≥80% de casos.', '(Placeholder) Suposición clave: TI puede comprometerse a ese plazo.'] },
  { n: 3, titulo: 'El experimento', bullets: ['(Placeholder) Piloto con 5 empleados · Google Forms + TI.', '(Placeholder) Semana del 24 de febrero.'] },
  { n: 4, titulo: 'Demo / evidencia de uso', bullets: ['(Placeholder) Registro en video del flujo del formulario.', '(Placeholder) Qué pasó: accesos activos en < 5 horas en el caso 1.', '(Placeholder) Decisión que soporta: Go — el sistema funciona tal como se diseñó.'] },
  { n: 5, titulo: 'Resultados', bullets: ['(Placeholder) 4/5 casos en ≤24h (80% — umbral alcanzado).', '(Placeholder) NPS: 82. 1 caso especial: 36h.'] },
  { n: 6, titulo: 'Decisión y próximo paso', bullets: ['(Placeholder) Go — escalamos al 100% de ingresos desde abril.', '(Placeholder) SLA formal con TI + automatización casos especiales.'] },
];

const SLIDES_COMPLETO = [
  ...SLIDES_EJECUTIVO.slice(0, 5),
  { n: 6, titulo: 'Aprendizajes clave', bullets: ['(Placeholder) Formulario resuelve 80% estándar. Accesos especiales = cuello de botella.', '(Placeholder) TI dispuesto si hay automatización.'] },
  { n: 7, titulo: 'Riesgos y mitigaciones', bullets: ['(Placeholder) Casos especiales → flujo de escalado.', '(Placeholder) Volumen → automatización SAP.'] },
  { n: 8, titulo: 'Pedido al comité', bullets: ['(Placeholder) Aprobar presupuesto SAP (estimado $X).', '(Placeholder) Escalar a todos los ingresos desde abril 2025.', '(Placeholder) SLA formal ≤24h con TI.'] },
];

const IA_NARRATIVA_VERSIONES = [
  { tipo: 'Ejecutiva (60–90 seg)', tags: ['Impacto', 'Decisión'], descripcion: 'Directa, orientada a decisiones. Foco en resultados y pedido final. Ideal para gerencia y sponsors.', ejemplo: '(Placeholder) Reducimos el alta en TI de 7 días a ≤24h en el 80% de los casos. Lo probamos con 5 empleados. El NPS fue 82. Recomendamos escalar.' },
  { tipo: 'Operativa (implementación)', tags: ['Operación', 'Riesgo'], descripcion: 'Foco en cómo implementar, quién hace qué y qué riesgos manejar. Para equipos operativos.', ejemplo: '(Placeholder) El formulario automatiza la solicitud de accesos. El proceso requiere que TI confirme respuesta en 24h. El riesgo principal: accesos especiales que necesitan proceso separado.' },
  { tipo: 'Técnica (evidencia + método)', tags: ['Costo/beneficio', 'Tiempo'], descripcion: 'Detalla metodología, métricas y evidencia. Para audiencias técnicas o comités de evaluación.', ejemplo: '(Placeholder) H1: Formulario unificado ≤24h en ≥80% de casos. n=5. Resultado: 80% (4/5). NPS=82. Umbral alcanzado. Decisión: Go condicionado a SLA formal TI.' },
];

const IA_EVIDENCIAS_REC = [
  { ev: 'Hoja de seguimiento en Google Sheets', razon: '(Placeholder) La evidencia más cuantitativa: tiempos caso a caso. Directamente vinculada al umbral de ≤24h.' },
  { ev: 'Capturas de pantalla del formulario', razon: '(Placeholder) Demuestra que el artefacto existe y es funcional. Clave para quien no conoce el contexto.' },
  { ev: 'Observaciones del facilitador', razon: '(Placeholder) Añade contexto cualitativo y credibilidad. Complementa métricas con "lo que no mide el sheet".' },
];

const IA_DEMO_RECOMENDACIONES = [
  { titulo: 'Graba el flujo completo del formulario', descripcion: '(Placeholder) Un video de 60–90 segundos mostrando el formulario desde el punto de vista del empleado nuevo. Demuestra usabilidad real.', impacto: 'alto' },
  { titulo: 'Captura el sheet de seguimiento en tiempo real', descripcion: '(Placeholder) Muestra el sheet con los timestamps de 4 casos resueltos. Evidencia directa del umbral cumplido.', impacto: 'alto' },
  { titulo: 'Registra el momento de activación de accesos', descripcion: '(Placeholder) Captura de pantalla del empleado con accesos activos + timestamp. El momento de "aha" de la historia.', impacto: 'medio' },
];

const CHECKLIST_S4_IA = [
  { item: 'Audiencia definida y mensaje adaptado', sugerencia: 'Define la audiencia en "Configuración de historia" antes de redactar el relato.' },
  { item: 'Story outline completo (las 7 secciones)', sugerencia: 'Las secciones Aprendizajes y Próximo paso aún están sin completar.' },
  { item: 'Demo / evidencia de uso agregada', sugerencia: 'Agrega un demo (video/capturas) para fortalecer la credibilidad ante comités.' },
  { item: 'Evidencias seleccionadas y con mensaje', sugerencia: 'Define qué demuestra cada evidencia y qué decisión soporta.' },
  { item: 'Plan listo según decisión (Go/Iterar/Pivote)', sugerencia: 'Genera el plan en la pestaña "Plan" del módulo C.' },
  { item: 'Deck generado (estructura + láminas)', sugerencia: 'Usa "Generar deck según audiencia" en el módulo C.' },
  { item: 'Talk track listo (60–90 seg)', sugerencia: 'Practica y completa el checklist de ensayo.' },
];

const DELIVERABLES_BY_STEP = [
  {
    step: 1, nombre: 'Entender el problema',
    estado: 'Listo', color: 'emerald',
    bullets: ['(Placeholder) Proceso de alta TI identificado: 7–21 días, 3 áreas involucradas.', '(Placeholder) Usuario afectado: 100% de empleados nuevos (~25/mes).', '(Placeholder) Evidencia: 12 entrevistas + hoja de tiempos de TI.'],
    artefactos: ['Desafío', 'Perfil usuario', 'Problema raíz', 'Evidencias Step 1'],
    resumen: { titulo: 'Resumen Step 1 — Entender el problema', items: [{ label: 'Desafío', value: '(Placeholder) Nuevos empleados esperan 7–21 días para tener accesos TI activos.' }, { label: 'Usuario', value: '(Placeholder) Empleados nuevos + RRHH + TI — 3 actores directos.' }, { label: 'Problema raíz', value: '(Placeholder) No existe un proceso formal de solicitud de accesos con SLA.' }, { label: 'Evidencia', value: '(Placeholder) 12 entrevistas, hoja de tiempos TI, análisis de emails de solicitud.' }] },
  },
  {
    step: 2, nombre: 'Diseñar la solución',
    estado: 'Listo', color: 'emerald',
    bullets: ['(Placeholder) HMW: ¿Cómo podríamos reducir el tiempo de alta TI a 1 día?', '(Placeholder) Solución: Formulario unificado + notificación automática a TI.', '(Placeholder) Test Card: Umbral ≤24h en ≥80% de casos con piloto de 5 empleados.'],
    artefactos: ['HMW', 'Ideas generadas', 'Matriz DVF', 'Solution Card', 'Test Card'],
    resumen: { titulo: 'Resumen Step 2 — Diseñar la solución', items: [{ label: 'HMW', value: '(Placeholder) ¿Cómo podríamos reducir el alta en TI de semanas a horas?' }, { label: 'Solución elegida', value: '(Placeholder) Formulario Google Forms unificado con notificación a TI por Slack.' }, { label: 'Métrica', value: '(Placeholder) Tiempo formulario → accesos activos ≤24h en ≥80% de casos.' }, { label: 'Test Card', value: '(Placeholder) Piloto con 5 empleados · semana del 24 de febrero.' }] },
  },
  {
    step: 3, nombre: 'Probar en pequeño',
    estado: 'Aprobado', color: 'emerald',
    bullets: ['(Placeholder) Resultado: 4/5 casos en ≤24h (80%). NPS: 82.', '(Placeholder) Aprendizaje: Accesos especiales = cuello de botella secundario.', '(Placeholder) Decisión: Go — escalar al 100% de ingresos desde abril.'],
    artefactos: ['Plan experimento', 'Evidencias', 'Resultados', 'Decisión', 'Aprendizajes'],
    resumen: { titulo: 'Resumen Step 3 — Probar en pequeño', items: [{ label: 'Resultado', value: '(Placeholder) 4/5 casos resueltos en ≤24h. NPS 82.' }, { label: 'Umbral', value: '(Placeholder) 80% alcanzado (umbral mínimo: 80%).' }, { label: 'Aprendizaje clave', value: '(Placeholder) Accesos especiales tardan 36h → proceso paralelo necesario.' }, { label: 'Decisión', value: '(Placeholder) Go — escalar con condición: SLA formal con TI.' }] },
  },
  {
    step: 4, nombre: 'Contar la historia',
    estado: 'En progreso', color: 'indigo',
    bullets: ['(Placeholder) Story outline en construcción — 5/7 secciones completadas.', '(Placeholder) 2 evidencias seleccionadas con mensaje definido.', '(Placeholder) Deck: variante ejecutiva generada (placeholder).'],
    artefactos: ['Story outline', 'Evidencias seleccionadas', 'Demo', 'Deck', 'Talk track'],
    resumen: { titulo: 'Resumen Step 4 — Contar la historia', items: [{ label: 'Narrativa', value: '(Placeholder) 5/7 secciones del story outline completadas.' }, { label: 'Evidencias', value: '(Placeholder) 2 de 3 evidencias seleccionadas con mensaje.' }, { label: 'Deck', value: '(Placeholder) Variante ejecutiva (6 láminas) — borrador generado.' }, { label: 'Estado', value: '(Placeholder) En progreso — falta talk track y plan de implementación.' }] },
  },
];

// ── Helper components ─────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, accent = 'slate', badge }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string; badge?: React.ReactNode;
}) {
  const hdr = accent === 'indigo' ? 'bg-indigo-50 border-b border-indigo-100' : accent === 'violet' ? 'bg-violet-50 border-b border-violet-100' : 'bg-slate-50 border-b border-slate-100';
  const iconColor = accent === 'indigo' ? 'text-indigo-500' : accent === 'violet' ? 'text-violet-500' : 'text-slate-500';
  const titleColor = accent === 'indigo' ? 'text-indigo-700' : accent === 'violet' ? 'text-violet-700' : 'text-slate-700';
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className={`px-4 py-3 flex items-center gap-2 ${hdr}`}>
        <Icon size={14} className={iconColor} />
        <p className={`text-sm ${titleColor}`} style={{ fontWeight: 600 }}>{title}</p>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-8 gap-3">
      <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export function Step4Page() {
  const { projectId } = useParams();
  const { projects } = useApp();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === projectId);
  const step3Status = project?.steps.find(s => s.number === 3)?.status;
  const step4Status = project?.steps.find(s => s.number === 4)?.status;
  const isUnlocked = step3Status === 'Aprobado' || step4Status === 'En progreso' || step4Status === 'Aprobado';

  // ── Nav ───────────────────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');

  // ── Overview: Configuración de historia ───────────────────────────────────
  const [audiencia, setAudiencia] = useState<Audiencia | ''>('');
  const [objetivoStory, setObjetivoStory] = useState<ObjetivoStory | ''>('');
  const [decision, setDecision] = useState<DecisionTipo>(null);

  // ── Card_S4_DemoEvidence ───────────────────────────────────────────────────
  const [demos, setDemos] = useState<DemoItem[]>([]);
  const [showAddDemoOverlay, setShowAddDemoOverlay] = useState(false);
  const [nuevoDemo, setNuevoDemo] = useState<Omit<DemoItem, 'id'>>({ formato: 'Link demo', url: '', queDemuesta: '', audiencia: '' });

  // ── Overview: Entregables por Step ────────────────────────────────────────
  const [showResumenOverlay, setShowResumenOverlay] = useState(false);
  const [resumenStep, setResumenStep] = useState<typeof DELIVERABLES_BY_STEP[0] | null>(null);
  const [showDownloadOverlay, setShowDownloadOverlay] = useState(false);
  const [downloadStep, setDownloadStep] = useState<number | null>(null);

  // ── Overview: Checklist IA ────────────────────────────────────────────────
  const [checklistDone, setChecklistDone] = useState<boolean[]>(CHECKLIST_S4_IA.map(() => false));
  const [showChecklistIAOverlay, setShowChecklistIAOverlay] = useState(false);
  const [checklistIALoading, setChecklistIALoading] = useState(false);
  const [checklistIAListo, setChecklistIAListo] = useState(false);
  const [checklistIASelected, setChecklistIASelected] = useState<number | null>(null);
  const [checklistIAAplicado, setChecklistIAAplicado] = useState(false);

  // ── Overview: Contexto organizacional ────────────────────────────────────
  const [contextoOrg, setContextoOrg] = useState({ cultura: '', estructura: '', relaciones: '', riesgos: '', requerimientos: '' });
  const [showContextoIAOverlay, setShowContextoIAOverlay] = useState(false);
  const [contextoIALoading, setContextoIALoading] = useState(false);
  const [contextoIAListo, setContextoIAListo] = useState(false);

  // ── S4A_Narrativa ─────────────────────────────────────────────────────────
  const [narrativa, setNarrativa] = useState({
    problema: '(Contenido de ejemplo para prototipo) El proceso de incorporación tardaba 7–21 días por el alta manual de accesos en TI, sin SLA formal.',
    hipotesis: '(Contenido de ejemplo para prototipo) Si unificamos la solicitud con un formulario digital + notificación automática, reduciremos el tiempo a ≤24h en el 80% de casos.',
    experimento: '(Contenido de ejemplo para prototipo) Piloto con 5 empleados usando Google Forms conectado a TI. Métricas: tiempo de respuesta + NPS día 3.',
    resultados: '(Contenido de ejemplo para prototipo) 4/5 casos en ≤24h (80%). NPS: 82. Un caso especial tardó 36h.',
    decision: '(Contenido de ejemplo para prototipo) Decisión: Go — escalamos al 100% de ingresos desde abril 2025, con SLA formal de TI.',
    aprendizajes: '(Contenido de ejemplo para prototipo) El formulario resuelve el 80% de casos estándar. Accesos especiales necesitan proceso paralelo.',
    proximoPaso: '(Contenido de ejemplo para prototipo) Integrar con RRHH desde el día 1. Explorar API SAP para accesos pre-aprobados. SLA formal ≤24h.',
  });
  const [pedidoFinal, setPedidoFinal] = useState({ queDecision: '', queApoyo: '', proximoHito: '' });
  const [showIANarrativaOverlay, setShowIANarrativaOverlay] = useState(false);
  const [iaNarrativaLoading, setIaNarrativaLoading] = useState(false);
  const [iaNarrativaListo, setIaNarrativaListo] = useState(false);
  const [iaNarrativaSelected, setIaNarrativaSelected] = useState<number | null>(null);

  // ── S4B_Evidencias ────────────────────────────────────────────────────────
  const [evidencias, setEvidencias] = useState(MOCK_EVIDENCIAS_S3.map(e => ({ ...e, queDecisionSoporta: e.queDecisionSoporta || '', slidesSugerida: e.slidesSugerida || '' })));
  const [showIAEvidenciasOverlay, setShowIAEvidenciasOverlay] = useState(false);
  const [iaEvidenciasLoading, setIaEvidenciasLoading] = useState(false);
  const [iaEvidenciasListo, setIaEvidenciasListo] = useState(false);
  const [showIADemoRecOverlay, setShowIADemoRecOverlay] = useState(false);
  const [iaDemoRecLoading, setIaDemoRecLoading] = useState(false);
  const [iaDemoRecListo, setIaDemoRecListo] = useState(false);

  // ── S4C: Section_FinalDelivery ────────────────────────────────────────────
  type PdfState = 'none' | 'uploaded' | 'analyzed';
  const [pdfState, setPdfState] = useState<PdfState>('none');
  const [pdfFileName, setPdfFileName] = useState('Onboarding-Digital-Deck-v1.pdf');
  const [pdfVersion, setPdfVersion] = useState('v1');
  const [showUploadPDFOverlay, setShowUploadPDFOverlay] = useState(false);
  const [showPDFPreviewOverlay, setShowPDFPreviewOverlay] = useState(false);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploadFileInput, setUploadFileInput] = useState('Onboarding-Digital-Deck-v1.pdf');

  // Card_PrototypeDemo (C-specific add, shares demos[] state with Overview)
  const [showAddDemoCOverlay, setShowAddDemoCOverlay] = useState(false);
  const [nuevoDemoC, setNuevoDemoC] = useState<Omit<DemoItem, 'id'>>({ formato: 'Link demo', url: '', queDemuesta: '', audiencia: '' });
  const [demoCDecision, setDemoCDecision] = useState<Record<string, string>>({});
  const [demoCIncluir, setDemoCIncluir] = useState<Record<string, boolean>>({});

  // Card_AIReviewPDF
  type IAReviewState = 'pending' | 'analyzing' | 'done';
  const [iaReviewState, setIaReviewState] = useState<IAReviewState>('pending');
  const [iaReviewTab, setIaReviewTab] = useState<'gerencia' | 'sponsor' | 'comite'>('gerencia');
  const [iaReviewLoading, setIaReviewLoading] = useState(false);

  // Cierre automático: Listo para presentar
  const cierreDecks = pdfState === 'analyzed';
  const cierreDemo = demos.length > 0;
  const listoParaPresentar = cierreDecks && cierreDemo;

  // ── S4C Deck + Plan + TalkTrack ───────────────────────────────────────────
  const [tabC, setTabC] = useState<TabC>('deck');
  const [deckVariante, setDeckVariante] = useState<'ejecutivo' | 'completo' | null>(null);
  const [deckAplicado, setDeckAplicado] = useState(false);
  const [showIADeckOverlay, setShowIADeckOverlay] = useState(false);
  const [iaDeckLoading, setIaDeckLoading] = useState(false);
  const [iaDeckListo, setIaDeckListo] = useState(false);

  const [showIAPlanOverlay, setShowIAPlanOverlay] = useState(false);
  const [iaPlanLoading, setIaPlanLoading] = useState(false);
  const [iaPlanListo, setIaPlanListo] = useState(false);
  const [planAplicado, setPlanAplicado] = useState(false);

  const [talkTrack, setTalkTrack] = useState('(Contenido de ejemplo para prototipo) "Hola, soy Ana de RRHH. Identificamos que nuevos empleados tardaban hasta 3 semanas en tener accesos. Diseñamos un formulario digital. Lo probamos con 5 personas y el 80% tuvo accesos en ≤24h. NPS: 82. Recomendamos escalar. Necesitamos un SLA formal con TI. ¿Lo aprobamos?"');
  const [ensayoChecks, setEnsayoChecks] = useState([false, false, false, false]);
  const [showIATalkOverlay, setShowIATalkOverlay] = useState(false);
  const [iaTalkLoading, setIaTalkLoading] = useState(false);
  const [iaTalkListo, setIaTalkListo] = useState(false);

  const [hasFeedback, setHasFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorDate, setMentorDate] = useState('');
  const [mentorTime, setMentorTime] = useState('');
  const [sessionBooked, setSessionBooked] = useState(false);

  const saveState = useAutosave({ narrativa, pedidoFinal, evidencias, demos, talkTrack, decision, audiencia });

  // ── Gate ──────────────────────────────────────────────────────────────────
  if (!project) return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;
  if (!isUnlocked) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Step 4 bloqueado</h2>
        <p className="text-sm text-slate-500 mb-4">Para contar tu historia, primero necesitas la aprobación del mentor en el Step 3.</p>
        <button onClick={() => navigate(`/projects/${projectId}/step/3`)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>→ Ir al Step 3</button>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const modules = [
    { id: 'overview' as const, label: 'Overview', icon: BookOpen, completed: checklistDone.some(Boolean) },
    { id: 'A' as const, label: 'A · Narrativa', icon: Edit2, completed: narrativa.proximoPaso.trim().length > 30 },
    { id: 'B' as const, label: 'B · Evidencias', icon: Paperclip, completed: evidencias.some(e => e.incluir && e.queDemuesta.trim().length > 5) },
    { id: 'C' as const, label: 'C · Entregables', icon: Presentation, completed: deckAplicado && talkTrack.trim().length > 30 },
  ];

  const addDemo = () => {
    if (!nuevoDemo.queDemuesta.trim()) return;
    setDemos(p => [...p, { ...nuevoDemo, id: Date.now().toString() }]);
    setNuevoDemo({ formato: 'Link demo', url: '', queDemuesta: '', audiencia: '' });
    setShowAddDemoOverlay(false);
    toast.success('Demo agregado al Story Kit');
  };

  const DEMO_FORMATOS: { key: DemoFormato; icon: React.ElementType; color: string }[] = [
    { key: 'Link demo', icon: Play, color: 'text-indigo-500' },
    { key: 'Video', icon: Video, color: 'text-red-500' },
    { key: 'Capturas', icon: Image, color: 'text-emerald-500' },
    { key: 'Registro de uso', icon: ClipboardList, color: 'text-amber-500' },
  ];

  const SLIDE_OPTIONS = ['Resultado', 'Riesgo', 'Aprendizaje', 'Próximo paso', 'Demo'];
  const DECISION_SOPORTA = ['Go', 'Iterar', 'No-Go', 'Pivote', 'N/A'];

  const currentDeckSlides = deckVariante === 'completo' ? SLIDES_COMPLETO : SLIDES_EJECUTIVO;

  const CHECKLIST_VERSIONES_IA = [
    { audiencia: 'Gerencia', items: ['Impacto en negocio cuantificado', 'Riesgos y mitigaciones definidos', 'Pedido de aprobación claro', 'Plan 30-60-90 días'], foco: 'Impacto, riesgos, plan' },
    { audiencia: 'Equipo operativo', items: ['RACI definido (quién hace qué)', 'Cronograma de implementación', 'Dependencias identificadas', 'Indicadores de monitoreo'], foco: 'Implementación, RACI, tiempos' },
    { audiencia: 'Comité', items: ['Metodología del experimento documentada', 'Evidencias cuantitativas presentadas', 'Decisión basada en datos', 'Próximo ciclo de validación definido'], foco: 'Evidencia, método, decisiones' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full">

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex w-56 flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <div className="flex items-center gap-2 mt-2">
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Step 4</h2>
            <StatusChip status="En progreso" size="sm" />
          </div>
          <p className="text-xs text-slate-500">Contar la historia</p>
          {audiencia && <p className="text-xs text-indigo-500 mt-1">👥 {audiencia}</p>}
          {decision && <p className="text-xs text-emerald-500">🎯 {decision}</p>}
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

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6">
        <div className="max-w-2xl mx-auto">

          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver
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

          {/* Banner Step 3 aprobado */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-5 text-xs text-emerald-700">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span><span style={{ fontWeight: 600 }}>Step 3 aprobado.</span> Ya puedes construir el relato y preparar la presentación final.</span>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              S4_OVERVIEW — Control Tower
          ══════════════════════════════════════════════════════════════════ */}
          {activeModule === 'overview' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Step 4 — Contar la historia</h1>
                  <StatusChip status="En progreso" size="sm" />
                </div>
                <p className="text-sm text-slate-500">Este Overview reúne todo lo construido (Steps 1–3) para que armes una historia de impacto y un plan accionable.</p>
              </div>

              {/* ── Configuración de historia ───────────────────────────────── */}
              <div className="border-2 border-indigo-200 bg-indigo-50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-indigo-100 border-b border-indigo-200 flex items-center gap-2">
                  <Settings size={14} className="text-indigo-600" />
                  <p className="text-sm text-indigo-800" style={{ fontWeight: 600 }}>Configuración de historia</p>
                  <span className="ml-auto text-xs text-indigo-500 italic">Tu historia se ajusta automáticamente según audiencia y objetivo.</span>
                </div>
                <div className="px-4 py-4 space-y-4">
                  {/* Audiencia */}
                  <div>
                    <p className="text-xs text-indigo-700 mb-2" style={{ fontWeight: 600 }}>👥 AUDIENCIA</p>
                    <div className="flex flex-wrap gap-2">
                      {(['Gerencia', 'Sponsor', 'Comité', 'Equipo operativo', 'TI', 'RRHH'] as Audiencia[]).map(a => (
                        <button key={a} onClick={() => setAudiencia(audiencia === a ? '' : a)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${audiencia === a ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                          style={{ fontWeight: audiencia === a ? 600 : 400 }}>{a}</button>
                      ))}
                    </div>
                  </div>
                  {/* Objetivo */}
                  <div>
                    <p className="text-xs text-indigo-700 mb-2" style={{ fontWeight: 600 }}>🎯 OBJETIVO</p>
                    <div className="flex flex-wrap gap-2">
                      {(['Alinear', 'Pedir aprobación', 'Pedir recursos', 'Decidir', 'Informar avance'] as ObjetivoStory[]).map(o => (
                        <button key={o} onClick={() => setObjetivoStory(objetivoStory === o ? '' : o)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${objetivoStory === o ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'}`}
                          style={{ fontWeight: objetivoStory === o ? 600 : 400 }}>{o}</button>
                      ))}
                    </div>
                  </div>
                  {/* Decisión */}
                  <div>
                    <p className="text-xs text-indigo-700 mb-2" style={{ fontWeight: 600 }}>📌 DECISIÓN TOMADA</p>
                    <div className="flex flex-wrap gap-2">
                      {(['Go', 'Iterar', 'No-Go', 'Pivote'] as NonNullable<DecisionTipo>[]).map(d => (
                        <button key={d} onClick={() => setDecision(decision === d ? null : d)}
                          className={`px-3 py-1.5 rounded-full text-xs border-2 transition-colors ${decision === d ? d === 'Go' ? 'bg-emerald-500 text-white border-emerald-500' : d === 'Iterar' ? 'bg-amber-500 text-white border-amber-500' : d === 'No-Go' ? 'bg-red-500 text-white border-red-500' : 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                          style={{ fontWeight: decision === d ? 700 : 400 }}>{d}</button>
                      ))}
                    </div>
                  </div>
                  {(audiencia || decision) && (
                    <div className="flex items-center gap-2 p-2.5 bg-white border border-indigo-200 rounded-xl text-xs text-indigo-700">
                      <Sparkles size={12} className="text-indigo-400 shrink-0" />
                      <span>Historia configurada para: {[audiencia, objetivoStory, decision].filter(Boolean).join(' · ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Resumen para contar (Step 3) ──────────────────────────────── */}
              <SectionCard title="Resumen para contar (del Step 3)" icon={FileText}>
                <p className="text-xs text-slate-400 mb-3">Pre-cargado con los datos del Step 3. Edita en el módulo A — Narrativa.</p>
                <div className="space-y-2">
                  {[
                    { label: 'Problema', value: 'Alta en TI tardaba 7–21 días.' },
                    { label: 'Hipótesis', value: 'Formulario unificado → ≤24h en ≥80% de casos.' },
                    { label: 'Experimento', value: 'Piloto con 5 empleados · Google Forms + TI.' },
                    { label: 'Resultado', value: '80% de casos en ≤24h. NPS: 82.' },
                    { label: 'Decisión', value: decision ? `${decision} — (Placeholder) escalar al 100% de ingresos.` : '(Placeholder) Pendiente — elige la decisión arriba.' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{label}</span>
                      <p className="text-xs text-slate-700">{value}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* ── Card_S4_DemoEvidence ──────────────────────────────────────── */}
              <div className={`border-2 rounded-xl overflow-hidden ${demos.length > 0 ? 'border-emerald-200' : 'border-dashed border-slate-300'}`}>
                <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${demos.length > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <Play size={14} className={demos.length > 0 ? 'text-emerald-500' : 'text-slate-400'} />
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Demo del prototipo / evidencia de uso</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700" style={{ fontWeight: 600 }}>Recomendado</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${demos.length > 0 ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-500'}`} style={{ fontWeight: 600 }}>
                    {demos.length > 0 ? '✓ Agregado' : 'No agregado'}
                  </span>
                </div>
                <div className="px-4 py-4">
                  <p className="text-xs text-slate-400 mb-3">Agrega un demo (link, video, capturas o registro de uso) para fortalecer la credibilidad ante comités.</p>
                  {/* Chips de formato */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {DEMO_FORMATOS.map(({ key, icon: Icon, color }) => (
                      <span key={key} className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs">
                        <Icon size={10} className={color} />{key}
                      </span>
                    ))}
                  </div>
                  {/* Items agregados */}
                  {demos.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {demos.map(d => (
                        <div key={d.id} className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-1.5 py-0.5 bg-emerald-200 text-emerald-700 rounded" style={{ fontWeight: 600 }}>{d.formato}</span>
                              {d.url && <span className="text-xs text-indigo-500 truncate">{d.url}</span>}
                            </div>
                            <p className="text-xs text-slate-700 mt-1">{d.queDemuesta}</p>
                            {d.audiencia && <p className="text-xs text-slate-400 mt-0.5">Audiencia: {d.audiencia}</p>}
                          </div>
                          <button onClick={() => setDemos(p => p.filter(x => x.id !== d.id))} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <X size={12} className="text-slate-300 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setShowAddDemoOverlay(true)}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                    style={{ fontWeight: 500 }}>
                    <Plus size={12} /> Agregar demo
                  </button>
                </div>
              </div>

              {/* ── Section_DeliverablesByStep ────────────────────────────────── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <Package size={14} className="text-slate-500" />
                  <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Entregables por Step (resumen + descargables)</p>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DELIVERABLES_BY_STEP.map(step => (
                    <div key={step.step} className={`border rounded-xl p-3 ${step.color === 'emerald' ? 'border-emerald-100 bg-emerald-50' : 'border-indigo-100 bg-indigo-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-slate-400" style={{ fontWeight: 700 }}>Step {step.step}</span>
                        <p className="text-xs text-slate-700 flex-1" style={{ fontWeight: 600 }}>{step.nombre}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${step.estado === 'Aprobado' ? 'bg-emerald-200 text-emerald-700' : step.estado === 'Listo' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-700'}`} style={{ fontWeight: 600 }}>{step.estado}</span>
                      </div>
                      <ul className="space-y-0.5 mb-2">
                        {step.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="text-slate-300 shrink-0 mt-0.5">·</span>{b}
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {step.artefactos.map(a => (
                          <span key={a} className="text-xs px-1.5 py-0.5 bg-white border border-slate-200 text-slate-500 rounded">{a}</span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setResumenStep(step); setShowResumenOverlay(true); }}
                          className="flex-1 text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg py-1.5 transition-colors" style={{ fontWeight: 500 }}>
                          Ver resumen
                        </button>
                        <button onClick={() => { setDownloadStep(step.step); setShowDownloadOverlay(true); }}
                          className="flex-1 text-xs border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-600 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1" style={{ fontWeight: 500 }}>
                          <Download size={10} /> Descargar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Checklist recomendado por IA ──────────────────────────────── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-slate-500" />
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Checklist de impacto</p>
                    <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full" style={{ fontWeight: 600 }}>Recomendación IA</span>
                  </div>
                  <button onClick={() => {
                    setShowChecklistIAOverlay(true);
                    if (!checklistIAListo) { setChecklistIALoading(true); setTimeout(() => { setChecklistIALoading(false); setChecklistIAListo(true); }, 1400); }
                  }}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded-lg transition-colors"
                    style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Recomendar con IA
                  </button>
                </div>
                <div className="px-4 pt-2 pb-1">
                  <p className="text-xs text-slate-400 mb-2">La IA te sugiere el siguiente orden para maximizar impacto{audiencia ? ` con ${audiencia}` : ''}:</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {CHECKLIST_S4_IA.map((item, i) => (
                    <label key={i} className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={checklistDone[i]}
                        onChange={e => { const n = [...checklistDone]; n[i] = e.target.checked; setChecklistDone(n); }}
                        className="w-4 h-4 mt-0.5 shrink-0 accent-indigo-600" />
                      <div className="flex-1">
                        <span className={`text-sm transition-colors ${checklistDone[i] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.item}</span>
                        {!checklistDone[i] && <p className="text-xs text-amber-600 mt-0.5">{item.sugerencia}</p>}
                      </div>
                    </label>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-2">
                  <p className={`text-xs ${checklistDone.every(Boolean) ? 'text-emerald-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                    {checklistDone.filter(Boolean).length}/{CHECKLIST_S4_IA.length} completados{checklistDone.every(Boolean) && ' · ¡Listo para presentar!'}
                  </p>
                </div>
              </div>

              {/* ── Contexto organizacional ───────────────────────────────────── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-slate-500" />
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Contexto organizacional (para que sea realista)</p>
                  </div>
                  <button onClick={() => {
                    setShowContextoIAOverlay(true);
                    if (!contextoIAListo) { setContextoIALoading(true); setTimeout(() => { setContextoIALoading(false); setContextoIAListo(true); }, 1500); }
                  }}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                    style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Sugerir consideraciones con IA
                  </button>
                </div>
                <div className="px-4 py-4 space-y-3">
                  {([
                    { key: 'cultura' as const, label: 'Cultura (¿qué puede resistirse?)', placeholder: '(Placeholder) Ej. TI suele resistir cambios de proceso sin aprobación formal del CTO.' },
                    { key: 'estructura' as const, label: 'Estructura (áreas afectadas)', placeholder: '(Placeholder) Ej. RRHH, TI, Gerencia de Operaciones, Líderes de área.' },
                    { key: 'relaciones' as const, label: 'Relaciones / dependencias (quién debe alinearse)', placeholder: '(Placeholder) Ej. TI debe comprometerse con SLA. RRHH debe compartir el formulario con nuevos ingresos.' },
                    { key: 'riesgos' as const, label: 'Top 3 riesgos', placeholder: '(Placeholder) Ej. 1. TI no cumple SLA. 2. Casos especiales colapsan el proceso. 3. Baja adopción por parte de líderes.' },
                    { key: 'requerimientos' as const, label: 'Requerimientos (recursos, herramientas, tiempo)', placeholder: '(Placeholder) Ej. 1 dev para integración SAP · presupuesto $X · 4 semanas de transición.' },
                  ] as const).map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                      <textarea value={contextoOrg[key]} onChange={e => setContextoOrg(p => ({ ...p, [key]: e.target.value }))}
                        rows={2} placeholder={placeholder}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Nav a submódulos */}
              <div>
                <p className="text-xs text-slate-400 mb-3" style={{ fontWeight: 500 }}>CONTINÚA EN LOS SUBMÓDULOS</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'A' as const, label: 'A · Narrativa', desc: 'Story outline adaptado a tu audiencia', icon: Edit2, color: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100' },
                    { id: 'B' as const, label: 'B · Evidencias', desc: 'Evidencia → Mensaje → Slide', icon: Paperclip, color: 'border-violet-200 bg-violet-50 hover:bg-violet-100' },
                    { id: 'C' as const, label: 'C · Entregables', desc: 'Deck · Plan · Talk track', icon: Presentation, color: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100' },
                  ].map(({ id, label, desc, icon: Icon, color }) => (
                    <button key={id} onClick={() => setActiveModule(id)}
                      className={`text-left p-4 rounded-xl border-2 transition-colors ${color}`}>
                      <Icon size={16} className="text-slate-600 mb-2" />
                      <p className="text-sm text-slate-800 mb-0.5" style={{ fontWeight: 600 }}>{label}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              S4A_NARRATIVA
          ══════════════════════════════════════════════════════════════════ */}
          {activeModule === 'A' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>A · Narrativa (story outline)</h1>
                  <StatusChip status="En progreso" size="sm" />
                </div>
                <p className="text-sm text-slate-500">Story outline en 7 secciones. Breve y accionable.</p>
              </div>

              {/* Enfoque por audiencia */}
              {audiencia && (
                <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <Sparkles size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-indigo-700 mb-1" style={{ fontWeight: 600 }}>Enfoque por audiencia: {audiencia}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(audiencia === 'Gerencia' ? ['Impacto', 'Riesgo', 'Costo/beneficio'] : audiencia === 'Comité' ? ['Evidencia', 'Método', 'Decisiones'] : audiencia === 'Equipo operativo' ? ['Operación', 'Tiempo', 'Riesgo'] : ['Impacto', 'Operación', 'Tiempo']).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-200 text-indigo-700 rounded-full" style={{ fontWeight: 600 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Ajustar a audiencia con IA */}
              <div className="flex items-center justify-between gap-3 p-3 bg-violet-50 border border-violet-100 rounded-xl flex-wrap">
                <div>
                  <p className="text-sm text-violet-800" style={{ fontWeight: 500 }}>Ajustar narrativa a la audiencia con IA</p>
                  <p className="text-xs text-violet-500 mt-0.5">3 versiones: ejecutiva, operativa y técnica.</p>
                </div>
                <button onClick={() => {
                  setShowIANarrativaOverlay(true);
                  if (!iaNarrativaListo) { setIaNarrativaLoading(true); setTimeout(() => { setIaNarrativaLoading(false); setIaNarrativaListo(true); }, 1600); }
                }}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 px-3 py-2 bg-white border border-violet-200 rounded-lg transition-colors shrink-0"
                  style={{ fontWeight: 500 }}>
                  <Sparkles size={12} /> Ajustar con IA
                </button>
              </div>

              {/* Secciones 1–7 */}
              {([
                { key: 'problema' as const, n: 1, label: 'Problema', hint: 'Quién lo sufre, cuánto cuesta, de dónde viene el dato. (del Step 1)' },
                { key: 'hipotesis' as const, n: 2, label: 'Hipótesis', hint: 'La apuesta del equipo: qué solución propusieron y por qué. (del Step 2)' },
                { key: 'experimento' as const, n: 3, label: 'Experimento', hint: 'Método, muestra, duración, qué midieron. (del Step 3)' },
                { key: 'resultados' as const, n: 4, label: 'Resultados', hint: 'Métricas vs umbral. Incluye lo que no funcionó.' },
                { key: 'decision' as const, n: 5, label: 'Decisión', hint: `Go/Iterar/No-Go/Pivote. Por qué.${decision ? ` Decisión actual: ${decision}.` : ''}` },
                { key: 'aprendizajes' as const, n: 6, label: 'Aprendizajes', hint: 'Los 2–3 insights más importantes que cambiarán cómo trabajan.' },
                { key: 'proximoPaso' as const, n: 7, label: 'Próximo paso', hint: 'Qué necesitan para avanzar. El pedido concreto.' },
              ]).map(({ key, n, label, hint }) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{n}</span>
                    <label className="text-sm text-slate-700" style={{ fontWeight: 500 }}>{label}</label>
                  </div>
                  <p className="text-xs text-slate-400 mb-1.5 ml-7">{hint}</p>
                  <textarea value={narrativa[key]} onChange={e => setNarrativa(p => ({ ...p, [key]: e.target.value }))}
                    rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              ))}

              {/* Pedido final (call-to-action) */}
              <div className="border-2 border-indigo-200 rounded-xl p-4 space-y-3">
                <p className="text-sm text-indigo-800" style={{ fontWeight: 600 }}>Pedido final (call-to-action)</p>
                <p className="text-xs text-indigo-500">Define con claridad qué necesitas de esta audiencia al final de la presentación.</p>
                {([
                  { key: 'queDecision' as const, label: 'Qué decisión necesitamos', placeholder: '(Placeholder) Ej. Aprobar el escalado del proceso a todos los ingresos desde abril.' },
                  { key: 'queApoyo' as const, label: 'Qué apoyo necesitamos (recursos / sponsor / acceso)', placeholder: '(Placeholder) Ej. Presupuesto para integración SAP + SLA formal con TI.' },
                  { key: 'proximoHito' as const, label: 'Próximo hito y fecha', placeholder: '(Placeholder) Ej. Primer ingreso bajo el nuevo proceso: 7 de abril 2025.' },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                    <input value={pedidoFinal[key]} onChange={e => setPedidoFinal(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder} className="w-full border border-indigo-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => toast.success('Borrador guardado')} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Guardar</button>
                <button onClick={() => { toast.success('Narrativa lista'); setActiveModule('B'); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2" style={{ fontWeight: 500 }}>
                  Siguiente: Evidencias <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              S4B_EVIDENCIAS
          ══════════════════════════════════════════════════════════════════ */}
          {activeModule === 'B' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>B · Evidencias y soporte</h1>
                  <StatusChip status="En progreso" size="sm" />
                </div>
                <p className="text-sm text-slate-500">Evidencia → Mensaje → Slide. Conecta cada evidencia con la decisión que soporta.</p>
              </div>

              {/* Recomendar con IA */}
              <div className="flex items-center justify-between gap-3 p-3 bg-violet-50 border border-violet-100 rounded-xl flex-wrap">
                <p className="text-sm text-violet-700" style={{ fontWeight: 500 }}>¿No sabes cuáles incluir?</p>
                <button onClick={() => {
                  setShowIAEvidenciasOverlay(true);
                  if (!iaEvidenciasListo) { setIaEvidenciasLoading(true); setTimeout(() => { setIaEvidenciasLoading(false); setIaEvidenciasListo(true); }, 1400); }
                }}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 px-3 py-2 bg-white border border-violet-200 rounded-lg transition-colors"
                  style={{ fontWeight: 500 }}>
                  <Sparkles size={12} /> Recomendar evidencia + mensaje con IA
                </button>
              </div>

              {/* Lista evidencias */}
              <div className="space-y-3">
                {evidencias.map((ev, i) => (
                  <div key={ev.id} className={`border-2 rounded-xl p-4 transition-colors ${ev.incluir ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <input type="checkbox" checked={ev.incluir}
                        onChange={e => setEvidencias(p => p.map((x, j) => j === i ? { ...x, incluir: e.target.checked } : x))}
                        className="w-4 h-4 mt-0.5 shrink-0 accent-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ev.tipo === 'Archivo' ? 'bg-slate-100 text-slate-600' : ev.tipo === 'Link' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 500 }}>{ev.tipo}</span>
                          <p className="text-sm text-slate-800" style={{ fontWeight: ev.incluir ? 500 : 400 }}>{ev.descripcion}</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5"><Clock size={9} className="inline mr-0.5" />{ev.fecha}</p>
                      </div>
                    </div>
                    {ev.incluir && (
                      <div className="space-y-2 ml-7">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué demuestra?</label>
                          <input value={ev.queDemuesta} onChange={e => setEvidencias(p => p.map((x, j) => j === i ? { ...x, queDemuesta: e.target.value } : x))}
                            placeholder="Ej. Que el tiempo de respuesta fue ≤24h en 4 de 5 casos."
                            className="w-full border border-indigo-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué decisión soporta?</label>
                            <select value={ev.queDecisionSoporta} onChange={e => setEvidencias(p => p.map((x, j) => j === i ? { ...x, queDecisionSoporta: e.target.value } : x))}
                              className="w-full border border-indigo-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              <option value="">Seleccionar…</option>
                              {DECISION_SOPORTA.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Slide sugerida</label>
                            <select value={ev.slidesSugerida} onChange={e => setEvidencias(p => p.map((x, j) => j === i ? { ...x, slidesSugerida: e.target.value } : x))}
                              className="w-full border border-indigo-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              <option value="">Seleccionar…</option>
                              {SLIDE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Section_S4B_DemoEvidence */}
              <div className="border-2 border-dashed border-emerald-300 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Play size={14} className="text-emerald-500" />
                    <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>Evidencia de uso (Demo)</p>
                    {demos.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-emerald-200 text-emerald-700 rounded-full" style={{ fontWeight: 600 }}>{demos.length} agregado{demos.length > 1 ? 's' : ''}</span>}
                  </div>
                  <button onClick={() => {
                    setShowIADemoRecOverlay(true);
                    if (!iaDemoRecListo) { setIaDemoRecLoading(true); setTimeout(() => { setIaDemoRecLoading(false); setIaDemoRecListo(true); }, 1500); }
                  }}
                    className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg transition-colors"
                    style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Recomendar demo con IA
                  </button>
                </div>
                <div className="px-4 py-4">
                  {demos.length === 0 ? (
                    <div className="text-center py-4">
                      <Play size={20} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 mb-3">Sin demos agregados. Ve al Overview para agregar uno.</p>
                      <button onClick={() => setActiveModule('overview')} className="text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 500 }}>→ Ir al Overview</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {demos.map(d => (
                        <div key={d.id} className="border border-emerald-200 rounded-xl p-3 bg-white">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full" style={{ fontWeight: 600 }}>{d.formato}</span>
                            {d.url && <span className="text-xs text-indigo-500">{d.url}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-slate-400">Qué demuestra: </span><span className="text-slate-700">{d.queDemuesta}</span></div>
                            {d.audiencia && <div><span className="text-slate-400">Audiencia: </span><span className="text-slate-700">{d.audiencia}</span></div>}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Decisión que soporta</label>
                              <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
                                <option value="">Seleccionar…</option>
                                {DECISION_SOPORTA.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Slide sugerida</label>
                              <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
                                <option value="Demo">Demo</option>
                                {SLIDE_OPTIONS.filter(s => s !== 'Demo').map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => toast.success('Evidencias guardadas')} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Guardar</button>
                <button onClick={() => { toast.success('Evidencias confirmadas'); setActiveModule('C'); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2" style={{ fontWeight: 500 }}>
                  Siguiente: Entregables <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              S4C_ENTREGABLES — Deck / Plan / Talk Track
          ══════════════════════════════════════════════════════════════════ */}
          {activeModule === 'C' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>C · Entregables finales</h1>
                  <StatusChip status={deckAplicado ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">Deck, Plan y Talk Track — los tres entregables para presentar y actuar.</p>
              </div>

              {/* ── Section_FinalDelivery ────────────────────────────────────── */}
              <div className="border-2 border-indigo-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-indigo-500" />
                    <p className="text-sm text-indigo-800" style={{ fontWeight: 600 }}>Entrega final (para comité)</p>
                    {listoParaPresentar && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-500 text-white rounded-full" style={{ fontWeight: 700 }}>Listo para presentar ✅</span>
                    )}
                  </div>
                  <span className="text-xs text-indigo-400">Adjunta el deck PDF y la demo antes de la sesión.</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Card_FinalPDF */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText size={13} className="text-slate-500" />
                        <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Deck final (PDF)</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${pdfState === 'analyzed' ? 'bg-emerald-100 text-emerald-700' : pdfState === 'uploaded' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`} style={{ fontWeight: 600 }}>
                        {pdfState === 'analyzed' ? 'Analizado por IA' : pdfState === 'uploaded' ? 'Subido' : 'No subido'}
                      </span>
                    </div>
                    <div className="p-3">
                      {pdfState === 'none' ? (
                        <>
                          <div
                            onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                            onDragLeave={() => setUploadDragOver(false)}
                            onDrop={e => { e.preventDefault(); setUploadDragOver(false); setPdfState('uploaded'); toast.success('PDF cargado (modo demo)'); }}
                            className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer mb-2 ${uploadDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'}`}
                            onClick={() => setShowUploadPDFOverlay(true)}>
                            <Download size={18} className="text-slate-300 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-500">Arrastra el PDF aquí o</p>
                            <p className="text-xs text-indigo-600 mt-0.5" style={{ fontWeight: 500 }}>Haz clic para subir</p>
                          </div>
                          <p className="text-xs text-slate-400 italic">PDF, máx. 30 MB (demo). Evita datos personales sensibles.</p>
                        </>
                      ) : (
                        <>
                          {/* Mini preview placeholder */}
                          <div className="flex gap-2 mb-2">
                            {[1, 2].map(n => (
                              <div key={n} className="flex-1 aspect-[4/3] bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 rounded-lg flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 flex flex-col p-2 gap-1">
                                  <div className="h-1.5 bg-indigo-200 rounded w-3/4" />
                                  <div className="h-1 bg-slate-200 rounded w-full" />
                                  <div className="h-1 bg-slate-200 rounded w-5/6" />
                                  <div className="flex-1 bg-slate-100 rounded mt-1 flex items-center justify-center">
                                    <span className="text-xs text-slate-300" style={{ fontWeight: 700 }}>{n}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-700 mb-0.5" style={{ fontWeight: 500 }}>{pdfFileName}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                            <span>{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded" style={{ fontWeight: 600 }}>{pdfVersion}</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={() => setShowPDFPreviewOverlay(true)}
                              className="text-xs px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                              Ver PDF
                            </button>
                            <button onClick={() => { setPdfState('none'); setPdfVersion('v2'); }}
                              className="text-xs px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                              Reemplazar
                            </button>
                          </div>
                        </>
                      )}
                      <button
                        disabled={pdfState === 'none'}
                        onClick={() => {
                          if (pdfState !== 'uploaded') return;
                          setIaReviewLoading(true);
                          setIaReviewState('analyzing');
                          setTimeout(() => { setIaReviewLoading(false); setIaReviewState('done'); setPdfState('analyzed'); toast.success('PDF analizado por IA'); }, 2000);
                        }}
                        className={`mt-3 w-full flex items-center justify-center gap-1.5 text-xs rounded-xl py-2 transition-colors ${pdfState === 'none' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : pdfState === 'uploaded' ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-emerald-100 text-emerald-700 cursor-default'}`}
                        style={{ fontWeight: 500 }}>
                        <Sparkles size={11} />
                        {pdfState === 'analyzed' ? '✓ Analizado por IA' : 'Analizar con IA'}
                      </button>
                    </div>
                  </div>

                  {/* Card_PrototypeDemo */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Play size={13} className={demos.length > 0 ? 'text-emerald-500' : 'text-slate-400'} />
                        <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Demo del prototipo</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${demos.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`} style={{ fontWeight: 600 }}>
                        {demos.length > 0 ? `Agregada (${demos.length})` : 'No agregada'}
                      </span>
                    </div>
                    <div className="p-3">
                      {/* Chips de formato */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {([
                          { key: 'Link demo', label: 'Link (Figma/staging)', icon: Play },
                          { key: 'Video', label: 'Video (Loom/Drive)', icon: Video },
                          { key: 'Capturas', label: 'Capturas', icon: Image },
                          { key: 'Registro de uso', label: 'Registro de uso', icon: ClipboardList },
                        ] as const).map(({ key, label, icon: Icon }) => (
                          <span key={key} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                            <Icon size={9} />{label}
                          </span>
                        ))}
                      </div>
                      {/* Items agregados */}
                      {demos.length > 0 ? (
                        <div className="space-y-2 mb-3">
                          {demos.map(d => (
                            <div key={d.id} className="border border-emerald-100 bg-emerald-50 rounded-xl p-2.5 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs px-1.5 py-0.5 bg-emerald-200 text-emerald-700 rounded" style={{ fontWeight: 600 }}>{d.formato}</span>
                                {d.url && <span className="text-xs text-indigo-500 truncate max-w-[120px]">{d.url}</span>}
                              </div>
                              <p className="text-xs text-slate-600">{d.queDemuesta}</p>
                              {/* Decisión que soporta */}
                              <select
                                value={demoCDecision[d.id] || ''}
                                onChange={e => setDemoCDecision(p => ({ ...p, [d.id]: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
                                <option value="">Decisión que soporta…</option>
                                {['Go', 'Iterar', 'No-Go', 'Pivote', 'N/A'].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!demoCIncluir[d.id]}
                                  onChange={e => setDemoCIncluir(p => ({ ...p, [d.id]: e.target.checked }))}
                                  className="w-3.5 h-3.5 accent-indigo-600" />
                                <span className="text-xs text-slate-600">Incluir en deck</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-3 mb-2">
                          <Play size={16} className="text-slate-300 mx-auto mb-1" />
                          <p className="text-xs text-slate-400">Sin demos agregadas aún.</p>
                        </div>
                      )}
                      <button onClick={() => setShowAddDemoCOverlay(true)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs border border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 rounded-xl py-2 transition-colors"
                        style={{ fontWeight: 500 }}>
                        <Plus size={11} /> Agregar demo
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mini-checklist de cierre */}
                <div className="px-4 py-3 border-t border-indigo-100 flex items-center gap-4 flex-wrap bg-indigo-50">
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${cierreDecks ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
                      {cierreDecks ? '✓' : '·'}
                    </span>
                    <span className={`text-xs ${cierreDecks ? 'text-emerald-700' : 'text-slate-500'}`}>Deck final (PDF) subido y analizado por IA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${cierreDemo ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
                      {cierreDemo ? '✓' : '·'}
                    </span>
                    <span className={`text-xs ${cierreDemo ? 'text-emerald-700' : 'text-slate-500'}`}>Demo del prototipo adjunta (evidencia de uso)</span>
                  </div>
                  {listoParaPresentar && (
                    <span className="ml-auto text-xs px-2.5 py-1 bg-emerald-500 text-white rounded-full" style={{ fontWeight: 700 }}>Listo para presentar ✅</span>
                  )}
                </div>
              </div>

              {/* ── Card_AIReviewPDF ─────────────────────────────────────────── */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-500" />
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Revisión IA del deck (PDF)</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${iaReviewState === 'done' ? 'bg-emerald-100 text-emerald-700' : iaReviewState === 'analyzing' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`} style={{ fontWeight: 600 }}>
                      {iaReviewState === 'done' ? 'Analizado' : iaReviewState === 'analyzing' ? 'Analizando…' : 'Pendiente de análisis'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 italic w-full sm:w-auto">La IA evalúa claridad, evidencia, coherencia narrativa, pedido final y plan.</p>
                </div>
                <div className="px-4 py-4">
                  {iaReviewState === 'pending' && (
                    <div className="text-center py-6">
                      <Sparkles size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 mb-1">Sube el PDF y haz click en "Analizar con IA" para obtener el diagnóstico.</p>
                      <p className="text-xs text-slate-400">El análisis tarda ~30 segundos (modo demo: instantáneo).</p>
                      <button
                        disabled={pdfState === 'none'}
                        onClick={() => {
                          if (pdfState === 'none') return;
                          setIaReviewLoading(true);
                          setIaReviewState('analyzing');
                          setTimeout(() => { setIaReviewLoading(false); setIaReviewState('done'); setPdfState('analyzed'); toast.success('Análisis IA completado'); }, 2000);
                        }}
                        className={`mt-4 flex items-center gap-2 mx-auto text-sm px-5 py-2.5 rounded-xl transition-colors ${pdfState === 'none' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                        style={{ fontWeight: 500 }}>
                        <Sparkles size={14} /> Analizar PDF con IA
                      </button>
                    </div>
                  )}
                  {iaReviewState === 'analyzing' && (
                    <div className="flex flex-col items-center py-8 gap-3">
                      <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                      <p className="text-sm text-slate-500">Analizando deck: claridad, evidencia, narrativa…</p>
                    </div>
                  )}
                  {iaReviewState === 'done' && (
                    <div className="space-y-4">
                      {/* 1) Lo que está bien */}
                      <div>
                        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>✅ LO QUE ESTÁ BIEN</p>
                        <div className="space-y-1.5">
                          {[
                            'Narrativa consistente con los Steps 1–3.',
                            'La decisión "Go" está sustentada con datos (4/5 casos, NPS 82).',
                            'El pedido al comité es claro y específico (SLA formal + presupuesto SAP).',
                            'La lámina de "Demo / evidencia de uso" fortalece credibilidad.',
                            'Impacto proyectado cuantificado en tiempo y costo.',
                          ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                              <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />{item}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2) Riesgos / confusiones */}
                      <div>
                        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>⚠️ RIESGOS / POSIBLES CONFUSIONES</p>
                        <div className="space-y-1.5">
                          {[
                            '(Placeholder) La lámina de resultados no aclara el criterio de éxito (umbral ≥80%) desde el inicio — puede confundir si el comité desconoce la metodología.',
                            '(Placeholder) El caso especial (36h) no tiene explicación en la lámina — puede generar dudas en audiencias técnicas.',
                            '(Placeholder) El plan 30-60-90 no menciona responsable del SLA por nombre o área — recomendable hacerlo explícito.',
                          ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />{item}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 3) Recomendaciones por audiencia */}
                      <div>
                        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>🎯 RECOMENDACIONES POR AUDIENCIA</p>
                        <div className="flex gap-1 mb-3">
                          {(['gerencia', 'sponsor', 'comite'] as const).map(tab => (
                            <button key={tab} onClick={() => setIaReviewTab(tab)}
                              className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${iaReviewTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                              style={{ fontWeight: iaReviewTab === tab ? 600 : 400 }}>
                              {tab === 'gerencia' ? 'Gerencia' : tab === 'sponsor' ? 'Sponsor' : 'Comité'}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          {(iaReviewTab === 'gerencia' ? [
                            '(Placeholder) Abre con el impacto en negocio: "X horas/mes de RRHH + TI recuperadas". No con el proceso.',
                            '(Placeholder) Reduce las láminas de metodología a 1. Gerencia no necesita el detalle del experimento.',
                          ] : iaReviewTab === 'sponsor' ? [
                            '(Placeholder) Enfatiza el ROI: costo actual vs costo con proceso nuevo. Incluye cálculo simple.',
                            '(Placeholder) Muestra el riesgo de NO actuar: qué pasa si siguen con el proceso actual en 6 meses.',
                          ] : [
                            '(Placeholder) Agrega una lámina de "Metodología" con el detalle del experimento, muestra y criterio de éxito.',
                            '(Placeholder) Referencia los artefactos: el formulario, el sheet de seguimiento, las observaciones.',
                          ]).map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                              <span className="text-indigo-400 shrink-0">→</span>{item}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 4) Checklist "Listo para presentar" */}
                      <div>
                        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>📋 CHECKLIST "LISTO PARA PRESENTAR"</p>
                        <div className="space-y-1.5">
                          {[
                            { item: 'Narrativa coherente con Steps 1–3', ok: true },
                            { item: 'Evidencias con mensaje claro', ok: true },
                            { item: 'Decisión sustentada con datos', ok: true },
                            { item: 'Demo / evidencia de uso incluida', ok: demos.length > 0 },
                            { item: 'Pedido final al comité definido', ok: !!pedidoFinal.queDecision.trim() },
                            { item: 'Plan según decisión incluido', ok: planAplicado || !!decision },
                            { item: 'Talk track ensayado', ok: ensayoChecks.some(Boolean) },
                          ].map(({ item, ok }, i) => (
                            <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0 ${ok ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>{ok ? '✓' : '·'}</span>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 5) Cambios sugeridos v2 */}
                      <div>
                        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>✏️ CAMBIOS SUGERIDOS (para v2)</p>
                        <div className="space-y-1.5">
                          {[
                            { tipo: 'Claridad', sugerencia: '(Placeholder) Lámina 2 — Agrega el criterio de éxito (≥80% en ≤24h) en el título, no solo en el cuerpo.' },
                            { tipo: 'Evidencia', sugerencia: '(Placeholder) Lámina 4 (Demo) — Especifica el timestamp del video donde se ve la confirmación de accesos.' },
                            { tipo: 'Pedido final', sugerencia: '(Placeholder) Lámina 6 — Cambia "Recomendamos escalar" por "¿Aprobamos el escalado desde el 7 de abril?"' },
                            { tipo: 'Plan', sugerencia: '(Placeholder) Agrega nombre del responsable de TI en la tabla 30-60-90 para generar compromiso en sala.' },
                          ].map(({ tipo, sugerencia }, i) => (
                            <div key={i} className="flex items-start gap-2 border border-slate-200 rounded-xl p-3">
                              <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0" style={{ fontWeight: 600 }}>{tipo}</span>
                              <p className="text-xs text-slate-600">{sugerencia}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-2 pt-1 border-t border-slate-100">
                        <button onClick={() => toast.success('Lista de mejoras generada (modo demo)')}
                          className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl py-2 text-xs transition-colors" style={{ fontWeight: 500 }}>
                          Generar lista de mejoras (para v2)
                        </button>
                        <button onClick={() => { setPdfState('none'); setIaReviewState('pending'); setPdfVersion(pdfVersion === 'v1' ? 'v2' : 'v3'); toast.success('Subir v2 del PDF'); }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 text-xs transition-colors" style={{ fontWeight: 500 }}>
                          Subir v2 del deck
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs Deck / Plan / Talk */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {([
                  { key: 'deck' as const, label: '📊 Deck' },
                  { key: 'plan' as const, label: `📋 Plan${decision ? ` (${decision})` : ''}` },
                  { key: 'talk' as const, label: '🎙 Talk track' },
                ]).map(({ key, label }) => (
                  <button key={key} onClick={() => setTabC(key)}
                    className={`flex-1 py-2 rounded-lg text-xs transition-colors ${tabC === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    style={{ fontWeight: tabC === key ? 600 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* TAB: DECK ─────────────────────────────────────────────────── */}
              {tabC === 'deck' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex-wrap">
                    <div>
                      <p className="text-sm text-indigo-800" style={{ fontWeight: 500 }}>Generar deck según audiencia con IA</p>
                      <p className="text-xs text-indigo-500 mt-0.5">2 variantes: ejecutiva (6) o completa (8 láminas){audiencia ? ` · optimizado para ${audiencia}` : ''}.</p>
                    </div>
                    <button onClick={() => {
                      setShowIADeckOverlay(true);
                      if (!iaDeckListo) { setIaDeckLoading(true); setTimeout(() => { setIaDeckLoading(false); setIaDeckListo(true); }, 1800); }
                    }}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 px-3 py-2 bg-white border border-indigo-200 rounded-lg transition-colors shrink-0"
                      style={{ fontWeight: 500 }}>
                      <Sparkles size={12} /> Generar deck con IA
                    </button>
                  </div>

                  <SectionCard title={`Estructura del deck${deckAplicado ? ` — ${deckVariante === 'ejecutivo' ? 'Ejecutiva (6)' : 'Completa (8)'}` : ' (placeholder)'}`} icon={Presentation}>
                    {!deckAplicado && <p className="text-xs text-slate-400 mb-3 italic">Usa "Generar deck con IA" para personalizar la estructura.</p>}
                    <div className="space-y-2">
                      {currentDeckSlides.map(slide => (
                        <div key={slide.n} className="border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-400" style={{ fontWeight: 700 }}>#{slide.n}</span>
                            <span className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{slide.titulo}</span>
                            {slide.titulo === 'Demo / evidencia de uso' && demos.length > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full" style={{ fontWeight: 600 }}>✓ Demo agregado</span>
                            )}
                          </div>
                          <ul className="space-y-0.5">
                            {slide.bullets.map((b, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                                <span className="text-slate-300 shrink-0">·</span>{b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* TAB: PLAN ─────────────────────────────────────────────────── */}
              {tabC === 'plan' && (
                <div className="space-y-4">
                  {!decision && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">Elige una decisión en el Overview para ver el plan correspondiente (Go / Iterar / No-Go / Pivote).</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex-wrap">
                    <div>
                      <p className="text-sm text-indigo-800" style={{ fontWeight: 500 }}>Generar plan según decisión con IA</p>
                      <p className="text-xs text-indigo-500 mt-0.5">{decision ? `Plan de ${decision === 'Go' ? 'implementación' : decision === 'Iterar' ? 'iteración' : 'aprendizajes/qué no hacer'}` : 'Selecciona la decisión en el Overview primero'}.</p>
                    </div>
                    <button onClick={() => {
                      if (!decision) { toast.error('Elige una decisión en el Overview primero'); return; }
                      setShowIAPlanOverlay(true);
                      if (!iaPlanListo) { setIaPlanLoading(true); setTimeout(() => { setIaPlanLoading(false); setIaPlanListo(true); }, 1600); }
                    }}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 px-3 py-2 bg-white border border-indigo-200 rounded-lg transition-colors shrink-0"
                      style={{ fontWeight: 500 }}>
                      <Sparkles size={12} /> Generar plan con IA
                    </button>
                  </div>

                  {/* Plan Go */}
                  {(decision === 'Go' || (!decision && true)) && decision === 'Go' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>🚀 Plan de implementación</p>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 px-3 py-2" style={{ fontWeight: 600 }}>
                          <span>Hito</span><span>30 días</span><span>60 días</span><span>90 días</span>
                        </div>
                        {[
                          { hito: 'Formalizar SLA con TI', d30: '(Placeholder) Firmar acuerdo', d60: '(Placeholder) 1er mes de operación', d90: '(Placeholder) Revisión y ajuste' },
                          { hito: 'Escalar formulario', d30: '(Placeholder) 10 ingresos nuevos', d60: '(Placeholder) 100% de ingresos', d90: '(Placeholder) Automatizar notificaciones' },
                          { hito: 'Integración SAP', d30: '(Placeholder) Kick-off técnico', d60: '(Placeholder) Prueba piloto API', d90: '(Placeholder) Go-live integración' },
                        ].map((row, i) => (
                          <div key={i} className="grid grid-cols-4 border-b border-slate-50 last:border-0 px-3 py-2.5 text-xs hover:bg-slate-50">
                            <span className="text-slate-700" style={{ fontWeight: 500 }}>{row.hito}</span>
                            <span className="text-slate-500">{row.d30}</span>
                            <span className="text-slate-500">{row.d60}</span>
                            <span className="text-slate-500">{row.d90}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3">
                        <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>RACI simplificado</p>
                        <div className="space-y-1">
                          {[
                            { rol: 'Responsable', quienes: '(Placeholder) Ana R. (RRHH)' },
                            { rol: 'Aprobador', quienes: '(Placeholder) Gerencia de Operaciones' },
                            { rol: 'Soporte', quienes: '(Placeholder) TI · Líderes de área' },
                          ].map(r => (
                            <div key={r.rol} className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 w-24 shrink-0" style={{ fontWeight: 600 }}>{r.rol}</span>
                              <span className="text-slate-600">{r.quienes}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Plan Iterar */}
                  {decision === 'Iterar' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>🔄 Plan de iteración</p>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 mb-2">
                        💡 No busques la perfección. Apunta al mínimo que resuelve el punto pendiente y se puede probar rápido.
                      </div>
                      {[
                        { label: 'Qué ajustar (1–3 cambios)', value: '(Placeholder) Agregar campo "tipo acceso especial" + flujo escalado TI Senior.' },
                        { label: 'Próximo experimento / re-test', value: '(Placeholder) 3 empleados nuevos con accesos especiales · semana del 10 de marzo.' },
                        { label: 'Evidencia mínima a capturar', value: '(Placeholder) Tiempo resolución casos especiales + NPS diferenciado por perfil.' },
                        { label: 'Criterio go/no-go para cerrar ciclo', value: '(Placeholder) ≤24h en 100% de casos (incluidos especiales).' },
                      ].map(({ label, value }) => (
                        <div key={label} className="border border-slate-200 rounded-xl p-3">
                          <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>{label}</p>
                          <p className="text-xs text-slate-700">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Plan No-Go / Pivote */}
                  {(decision === 'No-Go' || decision === 'Pivote') && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{decision === 'No-Go' ? '🛑 Aprendizajes y qué no hacer' : '🔀 Aprendizajes del pivote'}</p>
                      {[
                        { label: 'Supuestos invalidados', value: '(Placeholder) El proceso informal de TI podría adaptarse en 24h — falso para casos especiales.' },
                        { label: 'Señales encontradas en campo', value: '(Placeholder) Accesos especiales = 20% del volumen, 80% de los retrasos.' },
                        { label: 'Qué mantener (lo rescatable)', value: '(Placeholder) El formulario como interfaz · el sheet de seguimiento · la colaboración con TI.' },
                        { label: 'Qué NO repetir', value: '(Placeholder) Pilotear sin SLA previo con TI. No incluir casos especiales sin proceso paralelo.' },
                        { label: 'Qué validar primero si se re-intenta', value: '(Placeholder) ¿TI puede pre-aprobar accesos por perfil de cargo?' },
                      ].map(({ label, value }) => (
                        <div key={label} className="border border-slate-200 rounded-xl p-3">
                          <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>{label}</p>
                          <p className="text-xs text-slate-700">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!decision && (
                    <div className="text-center py-8">
                      <Target size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">El plan aparecerá aquí según la decisión que elijas en el Overview.</p>
                      <button onClick={() => setActiveModule('overview')} className="text-xs text-indigo-600 hover:text-indigo-700 mt-2" style={{ fontWeight: 500 }}>→ Ir al Overview</button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: TALK TRACK ────────────────────────────────────────────── */}
              {tabC === 'talk' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 p-3 bg-violet-50 border border-violet-100 rounded-xl flex-wrap">
                    <div>
                      <p className="text-sm text-violet-800" style={{ fontWeight: 500 }}>Generar talk track con IA</p>
                      <p className="text-xs text-violet-500 mt-0.5">Guion de 60–90 seg{audiencia ? ` adaptado para ${audiencia}` : ''}.</p>
                    </div>
                    <button onClick={() => {
                      setShowIATalkOverlay(true);
                      if (!iaTalkListo) { setIaTalkLoading(true); setTimeout(() => { setIaTalkLoading(false); setIaTalkListo(true); }, 1400); }
                    }}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 px-3 py-2 bg-white border border-violet-200 rounded-lg transition-colors shrink-0"
                      style={{ fontWeight: 500 }}>
                      <Sparkles size={12} /> Generar talk track
                    </button>
                  </div>

                  <SectionCard title="Talk track (60–90 seg)" icon={Users}>
                    <p className="text-xs text-slate-400 mb-2">Escribe el guion conversacional. No leerlo literalmente — úsalo como referencia.</p>
                    <textarea value={talkTrack} onChange={e => setTalkTrack(e.target.value)} rows={7}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3" />
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>Checklist de ensayo</p>
                    <div className="space-y-0 -mx-4">
                      {['Dentro del tiempo (60–90 segundos)', '¿Se entiende sin conocer el contexto?', 'Evidencia citada de forma natural', 'Pedido final claro ("¿lo aprobamos?")'].map((item, i) => (
                        <label key={i} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                          <input type="checkbox" checked={ensayoChecks[i]}
                            onChange={e => { const n = [...ensayoChecks]; n[i] = e.target.checked; setEnsayoChecks(n); }}
                            className="w-4 h-4 shrink-0 accent-emerald-500" />
                          <span className={`text-xs ${ensayoChecks[i] ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{item}</span>
                        </label>
                      ))}
                    </div>
                    <p className={`text-xs mt-3 ${ensayoChecks.every(Boolean) ? 'text-emerald-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                      {ensayoChecks.filter(Boolean).length}/4{ensayoChecks.every(Boolean) && ' · ¡Listo para presentar!'}
                    </p>
                  </SectionCard>

                  {/* Enviar a IA / Sesión / Export */}
                  {!hasFeedback ? (
                    <button onClick={() => setShowSendModal(true)}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors" style={{ fontWeight: 500 }}>
                      <Send size={14} /> Enviar a revisión IA
                    </button>
                  ) : <FeedbackIAPanel feedback={MOCK_S4_FEEDBACK} />}

                  {hasFeedback && (
                    sessionBooked ? (
                      <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><CheckCircle2 size={15} className="text-emerald-600" /></div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>Sesión de cierre agendada</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800" style={{ fontWeight: 600 }}>✓ Step 4 listo</span>
                          </div>
                          {mentorDate && <p className="text-xs text-emerald-600 mt-0.5"><Clock size={10} className="inline mr-1" />{mentorDate}{mentorTime ? ` · ${mentorTime}` : ''}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                        <p className="text-sm text-amber-800 mb-1" style={{ fontWeight: 600 }}>Sesión de cierre obligatoria</p>
                        <p className="text-xs text-amber-600 mb-3">Agenda la sesión final con tu mentor para presentar el proyecto.</p>
                        <button onClick={() => setShowMentorModal(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                          <Calendar size={14} /> Agendar sesión de cierre
                        </button>
                      </div>
                    )
                  )}

                  {hasFeedback && sessionBooked && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <Download size={14} className="text-slate-500" />
                        <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Exportar materiales</p>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-2">
                        {[
                          { icon: FileText, label: 'One-Pager PDF', color: 'bg-blue-50 border-blue-200' },
                          { icon: Package, label: 'Demo Day ZIP', color: 'bg-indigo-50 border-indigo-200' },
                          { icon: Share2, label: 'Link público', color: 'bg-violet-50 border-violet-200' },
                          { icon: FileText, label: 'Texto CV/LinkedIn', color: 'bg-emerald-50 border-emerald-200' },
                        ].map(({ icon: Icon, label, color }) => (
                          <button key={label} onClick={() => toast.success(`${label} — (modo demo)`)}
                            className={`flex items-center gap-2 p-3 border rounded-xl text-left transition-colors hover:opacity-90 ${color}`}>
                            <Icon size={14} className="text-slate-500 shrink-0" />
                            <span className="text-xs text-slate-700" style={{ fontWeight: 500 }}>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          OVERLAYS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* Overlay_S4_AddDemo */}
      {showAddDemoOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Play size={15} className="text-emerald-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agregar demo</h3>
              </div>
              <button onClick={() => setShowAddDemoOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Tipo de demo</label>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_FORMATOS.map(({ key, icon: Icon, color }) => (
                    <button key={key} onClick={() => setNuevoDemo(p => ({ ...p, formato: key }))}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-colors ${nuevoDemo.formato === key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <Icon size={14} className={nuevoDemo.formato === key ? 'text-indigo-500' : color} />
                      <span className="text-xs text-slate-700" style={{ fontWeight: nuevoDemo.formato === key ? 600 : 400 }}>{key}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>URL / archivo (placeholder)</label>
                <input value={nuevoDemo.url} onChange={e => setNuevoDemo(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://... o nombre del archivo"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué demuestra? (1 línea)</label>
                <input value={nuevoDemo.queDemuesta} onChange={e => setNuevoDemo(p => ({ ...p, queDemuesta: e.target.value }))}
                  placeholder="Ej. Que el formulario es fácil de usar y el proceso tarda menos de 10 min."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Audiencia objetivo (opcional)</label>
                <input value={nuevoDemo.audiencia} onChange={e => setNuevoDemo(p => ({ ...p, audiencia: e.target.value }))}
                  placeholder="Ej. Comité / Gerencia / Equipo operativo"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowAddDemoOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addDemo} disabled={!nuevoDemo.queDemuesta.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Guardar demo</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_S4_ViewSummary */}
      {showResumenOverlay && resumenStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>{resumenStep.resumen.titulo}</h3>
              <button onClick={() => setShowResumenOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <span className={`text-xs px-2 py-0.5 rounded-full ${resumenStep.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' : resumenStep.estado === 'Listo' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-100 text-indigo-700'}`} style={{ fontWeight: 600 }}>{resumenStep.estado}</span>
                <span className="text-xs text-slate-400">Step {resumenStep.step} · {resumenStep.nombre}</span>
              </div>
              <div className="space-y-2">
                {resumenStep.resumen.items.map(({ label, value }) => (
                  <div key={label} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5" style={{ fontWeight: 600 }}>{label}</p>
                    <p className="text-sm text-slate-700">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <p className="text-xs text-slate-400 w-full mb-1" style={{ fontWeight: 600 }}>ARTEFACTOS</p>
                {resumenStep.artefactos.map(a => (
                  <span key={a} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{a}</span>
                ))}
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowResumenOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cerrar</button>
              <button onClick={() => { setShowResumenOverlay(false); setDownloadStep(resumenStep.step); setShowDownloadOverlay(true); }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2" style={{ fontWeight: 500 }}>
                <Download size={13} /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_S4_Download_Demo */}
      {showDownloadOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Download size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Descargar — Step {downloadStep}</h3>
              </div>
              <button onClick={() => setShowDownloadOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-2">
              <p className="text-xs text-slate-400 mb-3">Elige el formato. Solo visual — sin exportación real en este prototipo.</p>
              {[
                { icon: FileText, label: 'One-pager (PDF)', desc: 'Resumen de 1 página listo para compartir', color: 'bg-blue-50 border-blue-200' },
                { icon: BookOpen, label: 'Documento narrativo', desc: 'Story outline completo en formato doc', color: 'bg-indigo-50 border-indigo-200' },
                { icon: ClipboardList, label: 'Evidencias (CSV/Sheet)', desc: 'Listado de evidencias con fecha y descripción', color: 'bg-emerald-50 border-emerald-200' },
              ].map(({ icon: Icon, label, desc, color }) => (
                <button key={label} onClick={() => { setShowDownloadOverlay(false); toast.success(`${label} — (modo demo, sin descarga real)`); }}
                  className={`w-full flex items-start gap-3 p-3 border rounded-xl text-left transition-colors hover:opacity-90 ${color}`}>
                  <Icon size={16} className="text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => setShowDownloadOverlay(false)} className="w-full border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_Checklist */}
      {showChecklistIAOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Checklist recomendado por IA según audiencia</h3>
              </div>
              <button onClick={() => setShowChecklistIAOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {checklistIALoading ? <LoadingSpinner label="Analizando audiencia y objetivo…" /> : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">3 versiones según audiencia. Elige la que mejor se adapta a tu presentación:</p>
                  {CHECKLIST_VERSIONES_IA.map((v, i) => (
                    <div key={i} onClick={() => setChecklistIASelected(i)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${checklistIASelected === i ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {checklistIASelected === i && <Check size={13} className="text-violet-600" />}
                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{v.audiencia}</p>
                        <span className="text-xs text-slate-400 ml-auto">Foco: {v.foco}</span>
                      </div>
                      <ul className="space-y-1">
                        {v.items.map((item, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="text-slate-300 shrink-0">·</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!checklistIALoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowChecklistIAOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
                <button disabled={checklistIASelected === null}
                  onClick={() => { setChecklistIAAplicado(true); setShowChecklistIAOverlay(false); toast.success(`Checklist "${CHECKLIST_VERSIONES_IA[checklistIASelected!].audiencia}" aplicado`); }}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar checklist
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_ContextoOrg */}
      {showContextoIAOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Consideraciones organizacionales — IA</h3>
              </div>
              <button onClick={() => setShowContextoIAOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {contextoIALoading ? <LoadingSpinner label="Analizando contexto y audiencia…" /> : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">Sugerencias para adaptar la historia a la realidad de tu organización:</p>
                  {[
                    { tipo: '🏛️ Cultura', bullets: ['(Placeholder) TI suele resistir cambios de proceso — muestra el piloto como propuesta, no imposición.', '(Placeholder) Evita lenguaje de "automatización total" — usa "apoyo digital" con RRHH como protagonista.'] },
                    { tipo: '⚠️ Riesgos organizacionales', bullets: ['(Placeholder) Si TI no tiene capacidad para el SLA, la propuesta colapsa — valida antes de presentar.', '(Placeholder) Los casos especiales (20%) pueden convertirse en la objeción principal del comité.'] },
                    { tipo: '🤝 Alineaciones clave', bullets: ['(Placeholder) TI debe estar presente en la sesión de aprobación — o tener carta de intención previa.', '(Placeholder) Gerencia de Operaciones necesita ver el impacto en costo, no solo en tiempo.'] },
                    { tipo: '📋 Requerimientos mínimos', bullets: ['(Placeholder) SLA formal firmado por TI antes del escalado.', '(Placeholder) Integración SAP: 1 developer + 4 semanas + aprobación de presupuesto.'] },
                  ].map(({ tipo, bullets }) => (
                    <div key={tipo} className="border border-slate-200 rounded-xl p-3">
                      <p className="text-xs text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>{tipo}</p>
                      <ul className="space-y-0.5">
                        {bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                            <span className="text-slate-300 shrink-0">·</span>{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => { setShowContextoIAOverlay(false); toast.success('Consideraciones revisadas'); }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_AudienceNarrative */}
      {showIANarrativaOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Ajustar narrativa a la audiencia con IA</h3>
              </div>
              <button onClick={() => setShowIANarrativaOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
              {iaNarrativaLoading ? <LoadingSpinner label="Analizando audiencia y narrativa…" /> : (
                <div className="space-y-3">
                  {iaNarrativaListo && audiencia && (
                    <div className="flex items-center gap-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 mb-3">
                      <Sparkles size={11} className="text-indigo-400" />
                      Adaptado para: <span style={{ fontWeight: 600 }}>{audiencia}</span>
                    </div>
                  )}
                  {IA_NARRATIVA_VERSIONES.map((v, i) => (
                    <div key={i} onClick={() => setIaNarrativaSelected(i)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${iaNarrativaSelected === i ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full" style={{ fontWeight: 600 }}>{v.tipo}</span>
                        <div className="flex gap-1">
                          {v.tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{t}</span>)}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{v.descripcion}</p>
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-700 italic">"{v.ejemplo}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!iaNarrativaLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowIANarrativaOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
                <button disabled={iaNarrativaSelected === null}
                  onClick={() => { setShowIANarrativaOverlay(false); toast.success(`Versión "${IA_NARRATIVA_VERSIONES[iaNarrativaSelected!].tipo}" aplicada`); }}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar versión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_EvidenceMessaging */}
      {showIAEvidenciasOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Evidencias recomendadas + mensaje — IA</h3>
              </div>
              <button onClick={() => setShowIAEvidenciasOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {iaEvidenciasLoading ? <LoadingSpinner label="Analizando evidencias del Step 3…" /> : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">Top 3 evidencias + mensaje propuesto para tu historia:</p>
                  {IA_EVIDENCIAS_REC.map((rec, i) => (
                    <div key={i} className="border border-emerald-200 bg-emerald-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>#{i + 1}</span>
                        <p className="text-xs text-emerald-800" style={{ fontWeight: 500 }}>{rec.ev}</p>
                      </div>
                      <p className="text-xs text-emerald-600 ml-7">{rec.razon}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => { setShowIAEvidenciasOverlay(false); toast.success('Recomendaciones de IA revisadas'); }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_DemoRecommendations */}
      {showIADemoRecOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-emerald-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Qué grabar / capturar para mayor impacto — IA</h3>
              </div>
              <button onClick={() => setShowIADemoRecOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {iaDemoRecLoading ? <LoadingSpinner label="Analizando evidencias y audiencia…" /> : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">Recomendaciones IA para fortalecer la credibilidad de tu presentación:</p>
                  {IA_DEMO_RECOMENDACIONES.map((rec, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{rec.titulo}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${rec.impacto === 'alto' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                          Impacto {rec.impacto}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{rec.descripcion}</p>
                      <button onClick={() => { setShowIADemoRecOverlay(false); setShowAddDemoOverlay(true); toast.success('Abre el formulario para agregar este demo'); }}
                        className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        <Plus size={10} /> Agregar este demo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => setShowIADemoRecOverlay(false)}
                className="w-full border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_Deck */}
      {showIADeckOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Generar deck según audiencia — IA</h3>
              </div>
              <button onClick={() => setShowIADeckOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {iaDeckLoading ? <LoadingSpinner label="Generando estructura del deck…" /> : (
                <div className="space-y-3">
                  {audiencia && <div className="flex items-center gap-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 mb-2"><Sparkles size={11} />Optimizado para: <span style={{ fontWeight: 600 }}>{audiencia}</span></div>}
                  {([
                    { key: 'ejecutivo' as const, label: 'Variante ejecutiva', n: 6, desc: 'Directa. Foco en decisión e impacto. Para comités de 10–15 min.', slides: SLIDES_EJECUTIVO },
                    { key: 'completo' as const, label: 'Variante completa', n: 8, desc: 'Incluye aprendizajes, riesgos y pedido al comité. Para 20–30 min.', slides: SLIDES_COMPLETO },
                  ]).map(({ key, label, n, desc, slides }) => (
                    <div key={key} onClick={() => setDeckVariante(key)}
                      className={`border-2 rounded-xl overflow-hidden cursor-pointer transition-colors ${deckVariante === key ? 'border-indigo-400' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className={`px-4 py-2.5 flex items-center justify-between ${deckVariante === key ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          {deckVariante === key && <Check size={13} className="text-indigo-600" />}
                          <p className="text-sm" style={{ fontWeight: 600 }}>{label}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full" style={{ fontWeight: 600 }}>{n} láminas</span>
                      </div>
                      <div className="px-4 pb-3 pt-2">
                        <p className="text-xs text-slate-500 mb-2">{desc}</p>
                        {slides.slice(0, 4).map(s => (
                          <p key={s.n} className="text-xs text-slate-400"><span style={{ fontWeight: 600 }}>{s.n}.</span> {s.titulo}</p>
                        ))}
                        {slides.length > 4 && <p className="text-xs text-slate-300">+ {slides.length - 4} más…</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!iaDeckLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowIADeckOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
                <button disabled={!deckVariante}
                  onClick={() => { setDeckAplicado(true); setShowIADeckOverlay(false); toast.success(`Deck ${deckVariante === 'ejecutivo' ? 'ejecutivo (6)' : 'completo (8)'} aplicado`); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar variante
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_Plan */}
      {showIAPlanOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Generar plan según decisión — IA</h3>
              </div>
              <button onClick={() => setShowIAPlanOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {iaPlanLoading ? <LoadingSpinner label="Generando borrador del plan…" /> : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 mb-2">
                    Decisión: <span className={`px-2 py-0.5 rounded-full ml-1 ${decision === 'Go' ? 'bg-emerald-100 text-emerald-700' : decision === 'Iterar' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`} style={{ fontWeight: 600 }}>{decision}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">Borrador de plan generado. Revisa y ajusta en la pestaña "Plan":</p>
                  {decision === 'Go' && [
                    { hito: '30 días', desc: '(Placeholder) Formalizar SLA con TI + escalar a 10 ingresos nuevos.' },
                    { hito: '60 días', desc: '(Placeholder) 100% de ingresos bajo el proceso + kick-off integración SAP.' },
                    { hito: '90 días', desc: '(Placeholder) Go-live integración SAP + revisión de SLA con datos reales.' },
                  ].map(({ hito, desc }) => (
                    <div key={hito} className="border border-emerald-200 bg-emerald-50 rounded-xl p-3">
                      <p className="text-xs text-emerald-700 mb-0.5" style={{ fontWeight: 600 }}>{hito}</p>
                      <p className="text-xs text-slate-600">{desc}</p>
                    </div>
                  ))}
                  {decision === 'Iterar' && [
                    { label: 'Qué ajustar', value: '(Placeholder) Campo "tipo acceso especial" + escalado directo a TI Senior.' },
                    { label: 'Próximo re-test', value: '(Placeholder) 3 empleados con accesos especiales · semana del 10 de marzo.' },
                    { label: 'Criterio de cierre', value: '(Placeholder) ≤24h en 100% de casos incluyendo especiales.' },
                  ].map(({ label, value }) => (
                    <div key={label} className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                      <p className="text-xs text-amber-700 mb-0.5" style={{ fontWeight: 600 }}>{label}</p>
                      <p className="text-xs text-slate-600">{value}</p>
                    </div>
                  ))}
                  {(decision === 'No-Go' || decision === 'Pivote') && [
                    { label: 'Supuesto invalidado', value: '(Placeholder) TI no puede sostener ≤24h para casos especiales sin proceso diferenciado.' },
                    { label: 'Qué mantener', value: '(Placeholder) El formulario como interfaz · el sheet de seguimiento · la colaboración con TI.' },
                    { label: 'Siguiente pregunta crítica', value: '(Placeholder) ¿TI puede pre-aprobar accesos por perfil de cargo antes del primer día?' },
                  ].map(({ label, value }) => (
                    <div key={label} className="border border-red-100 bg-red-50 rounded-xl p-3">
                      <p className="text-xs text-red-600 mb-0.5" style={{ fontWeight: 600 }}>{label}</p>
                      <p className="text-xs text-slate-600">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!iaPlanLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowIAPlanOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
                <button onClick={() => { setPlanAplicado(true); setShowIAPlanOverlay(false); toast.success('Plan aplicado a la pestaña "Plan"'); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Aplicar plan</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_TalkTrack */}
      {showIATalkOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Generar talk track — IA</h3>
              </div>
              <button onClick={() => setShowIATalkOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {iaTalkLoading ? <LoadingSpinner label="Generando guion de 60–90 seg…" /> : (
                <div className="space-y-3">
                  {audiencia && <div className="flex items-center gap-2 p-2.5 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-700"><Sparkles size={11} />Adaptado para: <span style={{ fontWeight: 600 }}>{audiencia}</span></div>}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>BORRADOR · 75 seg aproximados</p>
                    <p className="text-sm text-slate-700 leading-relaxed italic">"(Placeholder) Hola, soy Ana de RRHH. Identificamos que nuevos empleados tardaban hasta 3 semanas en tener accesos TI. Diseñamos un formulario digital que automatiza la solicitud. Lo probamos con 5 personas: el 80% tuvo accesos en menos de 24 horas. El NPS fue de 82. Hay un punto pendiente: los accesos especiales necesitan un proceso diferenciado. Pero la dirección está probada. Recomendamos escalar a todos los ingresos desde abril. Para eso necesitamos su aprobación y un SLA formal con TI. ¿Seguimos adelante?"</p>
                  </div>
                </div>
              )}
            </div>
            {!iaTalkLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowIATalkOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
                <button onClick={() => {
                  setTalkTrack('(Placeholder) "Hola, soy Ana de RRHH. Identificamos que nuevos empleados tardaban hasta 3 semanas en tener accesos TI. Diseñamos un formulario digital que automatiza la solicitud. Lo probamos con 5 personas: el 80% tuvo accesos en menos de 24 horas. NPS: 82. Recomendamos escalar desde abril. Necesitamos: aprobación + SLA formal con TI. ¿Seguimos?"');
                  setShowIATalkOverlay(false); toast.success('Talk track aplicado');
                }}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Aplicar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay_UploadPDF */}
      {showUploadPDFOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Download size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Subir deck final (PDF)</h3>
              </div>
              <button onClick={() => setShowUploadPDFOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-slate-500">Sube el PDF exportado desde tu PPT o herramienta de presentación.</p>
              <div
                onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                onDragLeave={() => setUploadDragOver(false)}
                onDrop={e => { e.preventDefault(); setUploadDragOver(false); }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${uploadDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300'}`}>
                <Download size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-1">Arrastra el PDF aquí</p>
                <p className="text-xs text-slate-400">o elige un archivo</p>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Nombre del archivo</label>
                <input value={uploadFileInput} onChange={e => setUploadFileInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <p className="text-xs text-amber-600">⚠ PDF, máx. 30 MB (modo demo). Evita incluir datos personales sensibles en el documento.</p>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowUploadPDFOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => {
                setPdfFileName(uploadFileInput || 'Deck-final.pdf');
                setPdfState('uploaded');
                setShowUploadPDFOverlay(false);
                toast.success('PDF subido. Ahora analiza con IA.');
              }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                Subir PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_PDFPreview */}
      {showPDFPreviewOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-slate-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>{pdfFileName}</h3>
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full" style={{ fontWeight: 600 }}>{pdfVersion}</span>
              </div>
              <button onClick={() => setShowPDFPreviewOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            {/* Preview placeholder */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {SLIDES_EJECUTIVO.map(slide => (
                  <div key={slide.n} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-indigo-600 px-2 py-1.5">
                      <p className="text-xs text-indigo-200" style={{ fontWeight: 500 }}>Lámina {slide.n}</p>
                      <p className="text-xs text-white truncate" style={{ fontWeight: 600 }}>{slide.titulo}</p>
                    </div>
                    <div className="p-2 bg-white min-h-[60px]">
                      {slide.bullets.slice(0, 1).map((b, i) => (
                        <div key={i} className="text-xs text-slate-400 leading-tight">{b}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center mt-3 italic">(Placeholder) Vista previa del deck. En producción mostraría el PDF real.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowPDFPreviewOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cerrar</button>
              <button onClick={() => { setShowPDFPreviewOverlay(false); toast.success('Descargar PDF (modo demo)'); }}
                className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                <Download size={13} /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay_AddDemo (desde Step 4C) */}
      {showAddDemoCOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Play size={15} className="text-emerald-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agregar demo del prototipo</h3>
              </div>
              <button onClick={() => setShowAddDemoCOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Tipo de demo</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'Link demo', label: 'Link (Figma/staging)', icon: Play },
                    { key: 'Video', label: 'Video (Loom/Drive)', icon: Video },
                    { key: 'Capturas', label: 'Capturas', icon: Image },
                    { key: 'Registro de uso', label: 'Registro de uso', icon: ClipboardList },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setNuevoDemoC(p => ({ ...p, formato: key }))}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-colors text-left ${nuevoDemoC.formato === key ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <Icon size={13} className={nuevoDemoC.formato === key ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="text-xs text-slate-700" style={{ fontWeight: nuevoDemoC.formato === key ? 600 : 400 }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>URL / archivo (placeholder)</label>
                <input value={nuevoDemoC.url} onChange={e => setNuevoDemoC(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://... o nombre del archivo"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué demuestra? (1 línea)</label>
                <input value={nuevoDemoC.queDemuesta} onChange={e => setNuevoDemoC(p => ({ ...p, queDemuesta: e.target.value }))}
                  placeholder="Ej. Que el formulario es funcional y el proceso tarda menos de 10 min."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Decisión que soporta</label>
                <select value={nuevoDemoC.audiencia} onChange={e => setNuevoDemoC(p => ({ ...p, audiencia: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Seleccionar…</option>
                  {['Go', 'Iterar', 'No-Go', 'Pivote', 'N/A'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <p className="text-xs text-amber-600">⚠ Evita incluir datos personales sensibles en el demo.</p>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowAddDemoCOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button disabled={!nuevoDemoC.queDemuesta.trim()}
                onClick={() => {
                  setDemos(p => [...p, { ...nuevoDemoC, id: Date.now().toString() }]);
                  setNuevoDemoC({ formato: 'Link demo', url: '', queDemuesta: '', audiencia: '' });
                  setShowAddDemoCOverlay(false);
                  toast.success('Demo agregada al Step 4C');
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                Guardar demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar a revisión IA */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Enviar Step 4 a revisión IA</h3>
            <p className="text-sm text-slate-500 mb-4">Se enviará: Narrativa · Demo · Evidencias seleccionadas · Deck · Plan · Talk track.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => { setShowSendModal(false); toast.success('Enviado a revisión IA'); setTimeout(() => setHasFeedback(true), 1200); }}
                className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm hover:bg-violet-700 transition-colors" style={{ fontWeight: 500 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agendar sesión de cierre */}
      {showMentorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Sesión de cierre</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sesión final para presentar y cerrar el programa.</p>
              </div>
              <button onClick={() => setShowMentorModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}><Calendar size={11} className="inline mr-1 text-slate-400" />Fecha</label>
                  <input type="date" value={mentorDate} onChange={e => setMentorDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}><Clock size={11} className="inline mr-1 text-slate-400" />Hora</label>
                  <select value={mentorTime} onChange={e => setMentorTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Seleccionar…</option>
                    {['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '16:00', '17:00'].map(h => <option key={h} value={h}>{h} hrs</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Mentor</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Ana García · Innovación & Procesos</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowMentorModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => { setShowMentorModal(false); setSessionBooked(true); toast.success('Sesión de cierre agendada. ¡Proyecto completado!', { description: 'El equipo será notificado.' }); }}
                disabled={!mentorDate || !mentorTime}
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
