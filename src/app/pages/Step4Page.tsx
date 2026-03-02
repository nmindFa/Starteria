import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Lock, CheckCircle2, ChevronRight, Sparkles, X,
  FileText, Presentation, Send, Calendar, Clock, Download,
  Share2, Package, Users, Paperclip, Plus, Edit2, Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';

// ── Types ────────────────────────────────────────────────────────────────────
type ModuleId = 'overview' | 'A' | 'B' | 'C';

// ── Mock / seed data ─────────────────────────────────────────────────────────
const MOCK_S4_FEEDBACK = {
  status: 'Aprobado' as const,
  summary: 'La historia es coherente con los Steps anteriores. El relato integra bien el reto, la solución, la evidencia y la decisión. La narrativa es ejecutiva y accionable.',
  goodPoints: ['Narrativa consistente con Steps 1–3', 'Métricas reales integradas', 'Decisión y aprendizajes bien documentados', 'Story outline completo y accionable'],
  missing: [],
  actions: [],
  questions: ['¿El story outline es comprensible para alguien que no conoce el contexto interno?'],
  timestamp: '2025-03-01T15:00:00Z',
};

const MOCK_EVIDENCIAS_S3 = [
  { id: 'e1', tipo: 'Archivo', descripcion: 'Capturas de pantalla del formulario completo', fecha: '2025-02-24', incluir: true, queDemuesta: '(Placeholder) Que el formulario es funcional y completo.' },
  { id: 'e2', tipo: 'Link', descripcion: 'Hoja de seguimiento en Google Sheets', fecha: '2025-02-25', incluir: true, queDemuesta: '(Placeholder) El registro de tiempo de respuesta por caso.' },
  { id: 'e3', tipo: 'Nota', descripcion: 'Observaciones del facilitador durante el piloto', fecha: '2025-02-26', incluir: false, queDemuesta: '' },
];

const SLIDES_EJECUTIVO = [
  { n: 1, titulo: 'El problema', bullets: ['(Placeholder) Nuevos empleados tardaban 7–21 días en tener accesos activos.', '(Placeholder) Costo: ~X horas de RRHH + TI por caso.'] },
  { n: 2, titulo: 'Nuestra hipótesis', bullets: ['(Placeholder) Si simplificamos la solicitud, reducimos a ≤24h en el 80% de casos.', '(Placeholder) Suposición clave: TI puede comprometerse a responder en ese plazo.'] },
  { n: 3, titulo: 'El experimento', bullets: ['(Placeholder) Formulario unificado + notificación automática a TI.', '(Placeholder) 5 empleados nuevos · semana del 24 de febrero.'] },
  { n: 4, titulo: 'Resultados', bullets: ['(Placeholder) 4/5 casos en ≤24h (80% — umbral alcanzado).', '(Placeholder) NPS: 82. 1 caso especial: 36h.'] },
  { n: 5, titulo: 'Decisión y próximo paso', bullets: ['(Placeholder) Go — escalamos al 100% de ingresos desde abril.', '(Placeholder) Automatizar accesos especiales con SLA diferenciado.'] },
  { n: 6, titulo: 'Impacto esperado', bullets: ['(Placeholder) Reducir onboarding de 7 días a ≤24h para el 100% de ingresos.', '(Placeholder) Ahorro estimado: X horas/mes de RRHH + TI.'] },
];

const SLIDES_COMPLETO = [
  ...SLIDES_EJECUTIVO.slice(0, 4),
  { n: 5, titulo: 'Aprendizajes clave', bullets: ['(Placeholder) El formulario resuelve el 80% de los casos estándar sin intervención manual.', '(Placeholder) Accesos especiales = cuello de botella — necesitan proceso separado.', '(Placeholder) TI está dispuesto si hay automatización.'] },
  { n: 6, titulo: 'Decisión: Go', bullets: ['(Placeholder) Evidencia suficiente para escalar.', '(Placeholder) Condición: SLA formal con TI.'] },
  { n: 7, titulo: 'Riesgos y mitigaciones', bullets: ['(Placeholder) Casos especiales pueden romper SLA → flujo de escalado definido.', '(Placeholder) Volumen alto puede saturar a TI → automatización con SAP.'] },
  { n: 8, titulo: 'Próximo paso / pedido al comité', bullets: ['(Placeholder) Aprobar presupuesto para integración SAP (estimado $X).', '(Placeholder) Escalar a todos los ingresos a partir de abril 2025.', '(Placeholder) Definir SLA formal de ≤24h con TI.'] },
];

const IA_NARRATIVA_VERSIONES = [
  {
    tipo: 'Ejecutiva (corta)',
    descripcion: 'Directa, orientada a decisiones. Ideal para líderes con poco tiempo.',
    ejemplo: '(Placeholder) Reducimos el tiempo de alta en TI de 7 días a menos de 24 horas en el 80% de los casos. El experimento con 5 empleados lo confirmó. Recomendamos escalar.',
  },
  {
    tipo: 'Storytelling (narrativa)',
    descripcion: 'Cuenta la historia desde el problema vivido. Más emocional y memorable.',
    ejemplo: '(Placeholder) Cuando Carlos llegó su primer día, tuvo que esperar 5 días para acceder al sistema. Lo mismo le pasaba al 90% de los nuevos empleados. Decidimos cambiarlo…',
  },
  {
    tipo: 'Técnica (con datos)',
    descripcion: 'Con métricas, metodología y evidencia detallada. Para audiencias técnicas.',
    ejemplo: '(Placeholder) H1: Formulario unificado ≤24h en ≥80% de casos. n=5. Resultado: 80% (4/5). Umbral alcanzado. NPS=82. Decisión: Go con condición (SLA formal TI).',
  },
];

const IA_EVIDENCIAS_REC = [
  { ev: 'Hoja de seguimiento en Google Sheets', razon: '(Placeholder) Es la evidencia más cuantitativa: muestra tiempos de respuesta caso a caso. Directamente vinculada al umbral de ≤24h.' },
  { ev: 'Capturas de pantalla del formulario completo', razon: '(Placeholder) Demuestra que el artefacto existe y es funcional. Clave para audiencias que no conocen el contexto.' },
  { ev: 'Observaciones del facilitador', razon: '(Placeholder) Añade contexto cualitativo y credibilidad al proceso. Complementa las métricas con "lo que no mide el sheet".' },
];

const CHECKLIST_S4 = [
  'Story outline completo (las 7 secciones)',
  'Evidencias seleccionadas y con descripción',
  'Mensajes clave definidos (qué demuestra cada evidencia)',
  'Deck generado (borrador con estructura)',
  'Talk track listo (guion de 60–90 seg)',
];

// ── Helper ───────────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, accent = 'slate' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  const hdr = accent === 'indigo'
    ? 'bg-indigo-50 border-b border-indigo-100'
    : 'bg-slate-50 border-b border-slate-100';
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className={`px-4 py-3 flex items-center gap-2 ${hdr}`}>
        <Icon size={14} className={accent === 'indigo' ? 'text-indigo-500' : 'text-slate-500'} />
        <p className={`text-sm ${accent === 'indigo' ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{title}</p>
      </div>
      <div className="px-4 py-4">{children}</div>
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

  // ── Gate ─────────────────────────────────────────────────────────────────
  const isUnlocked = step3Status === 'Aprobado' || step4Status === 'En progreso' || step4Status === 'Aprobado';

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');

  // ── S4_Checklist (Overview) ───────────────────────────────────────────────
  const [checklistDone, setChecklistDone] = useState<boolean[]>(CHECKLIST_S4.map(() => false));

  // ── S4A_Narrativa ─────────────────────────────────────────────────────────
  const [narrativa, setNarrativa] = useState({
    problema: '(Contenido de ejemplo para prototipo) El proceso de incorporación de empleados nuevos tardaba entre 7 y 21 días debido al alta manual de accesos en TI, coordinada por correo sin SLA formal.',
    hipotesis: '(Contenido de ejemplo para prototipo) Si unificamos la solicitud de accesos en un formulario digital con notificación automática, reduciremos el tiempo de alta a ≤24h en el 80% de los casos.',
    experimento: '(Contenido de ejemplo para prototipo) Piloto con 5 empleados nuevos usando Google Forms conectado al equipo de TI. Métricas: tiempo de respuesta + NPS día 3.',
    resultados: '(Contenido de ejemplo para prototipo) 4/5 casos resueltos en ≤24h (80%). NPS promedio de 82. Un caso especial tardó 36h tras escalado.',
    decision: '(Contenido de ejemplo para prototipo) Decisión: Go — escalamos el proceso al 100% de los ingresos desde abril 2025, con SLA formal de TI.',
    aprendizajes: '(Contenido de ejemplo para prototipo) El formulario resuelve el 80% de los casos estándar. Los accesos especiales necesitan un proceso paralelo. TI está dispuesto si hay automatización.',
    proximoPaso: '(Contenido de ejemplo para prototipo) Integrar con RRHH desde el día 1 de contratación. Explorar API SAP para accesos pre-aprobados por perfil. SLA formal ≤24h con TI.',
  });
  const [showIANarrativaOverlay, setShowIANarrativaOverlay] = useState(false);
  const [iaNarrativaLoading, setIaNarrativaLoading] = useState(false);
  const [iaNarrativaListo, setIaNarrativaListo] = useState(false);
  const [iaNarrativaSelected, setIaNarrativaSelected] = useState<number | null>(null);

  // ── S4B_Evidencias ────────────────────────────────────────────────────────
  const [evidencias, setEvidencias] = useState(MOCK_EVIDENCIAS_S3);
  const [showIAEvidenciasOverlay, setShowIAEvidenciasOverlay] = useState(false);
  const [iaEvidenciasLoading, setIaEvidenciasLoading] = useState(false);
  const [iaEvidenciasListo, setIaEvidenciasListo] = useState(false);

  // ── S4C_Deck ──────────────────────────────────────────────────────────────
  const [showIADeckOverlay, setShowIADeckOverlay] = useState(false);
  const [iaDeckLoading, setIaDeckLoading] = useState(false);
  const [iaDeckListo, setIaDeckListo] = useState(false);
  const [deckVariante, setDeckVariante] = useState<'ejecutivo' | 'completo' | null>(null);
  const [deckAplicado, setDeckAplicado] = useState(false);
  const [talkTrack, setTalkTrack] = useState('(Contenido de ejemplo para prototipo) "Hola, soy Ana de RRHH. Identificamos que nuevos empleados tardaban hasta 3 semanas en tener sus accesos activos. Diseñamos un formulario digital que automatiza el pedido. Lo probamos con 5 personas y el 80% tuvo accesos en menos de 24 horas. El NPS fue de 82. Recomendamos escalarlo a todos los ingresos desde abril. Lo único que necesitamos: un SLA formal con TI. ¿Lo aprobamos?"');
  const [ensayoChecks, setEnsayoChecks] = useState([false, false, false, false]);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorDate, setMentorDate] = useState('');
  const [mentorTime, setMentorTime] = useState('');
  const [sessionBooked, setSessionBooked] = useState(false);

  const saveState = useAutosave({ narrativa, evidencias, talkTrack, ensayoChecks });

  // ── Gate screen ───────────────────────────────────────────────────────────
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

  // ── Module list ───────────────────────────────────────────────────────────
  const modules = [
    { id: 'overview' as const, label: 'Overview', icon: FileText, completed: checklistDone.some(Boolean) },
    { id: 'A' as const, label: 'A · Narrativa', icon: Edit2, completed: narrativa.proximoPaso.trim().length > 30 },
    { id: 'B' as const, label: 'B · Evidencias', icon: Paperclip, completed: evidencias.some(e => e.incluir && e.queDemuesta.trim().length > 5) },
    { id: 'C' as const, label: 'C · Deck y ensayo', icon: Presentation, completed: deckAplicado && talkTrack.trim().length > 30 },
  ];

  const ENSAYO_ITEMS = [
    'Dentro del tiempo (60–90 segundos)',
    'Claridad: ¿se entiende sin conocer el contexto?',
    'Evidencia citada de forma natural',
    'Pedido final claro ("¿lo aprobamos?")',
  ];

  const currentDeckSlides = deckVariante === 'ejecutivo' ? SLIDES_EJECUTIVO : deckVariante === 'completo' ? SLIDES_COMPLETO : SLIDES_EJECUTIVO;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
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

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6">
        <div className="max-w-2xl mx-auto">

          {/* Mobile back */}
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al proyecto
          </button>
          {/* Mobile tabs */}
          <div className="flex gap-1 mb-5 md:hidden overflow-x-auto pb-1">
            {modules.map(m => (
              <button key={m.id} onClick={() => setActiveModule(m.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${activeModule === m.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                style={{ fontWeight: activeModule === m.id ? 600 : 400 }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* ── Banner: viene de Step 3 aprobado ── */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-5 text-xs text-emerald-700">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span><span style={{ fontWeight: 600 }}>Step 3 aprobado.</span> Ya puedes construir el relato de tu proyecto y preparar la presentación final.</span>
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              S4_OVERVIEW
          ════════════════════════════════════════════════════════════════════ */}
          {activeModule === 'overview' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Step 4 — Contar la historia</h1>
                  <StatusChip status="En progreso" size="sm" />
                </div>
                <p className="text-sm text-slate-500">Construye el relato de tu experimento: narrativa, evidencias y deck para presentar al comité.</p>
              </div>

              {/* Resumen para contar — jala placeholders del Step 3 */}
              <SectionCard title="Resumen para contar (del Step 3)" icon={FileText}>
                <p className="text-xs text-slate-400 mb-3">Pre-cargado con los datos del Step 3. Edita en el módulo A — Narrativa.</p>
                <div className="space-y-2">
                  {[
                    { label: 'Problema', value: 'Alta en TI tardaba 7–21 días.' },
                    { label: 'Hipótesis', value: 'Formulario unificado → ≤24h en ≥80% de casos.' },
                    { label: 'Experimento', value: 'Piloto con 5 empleados · Google Forms + TI.' },
                    { label: 'Resultado', value: '80% de casos en ≤24h. NPS: 82.' },
                    { label: 'Decisión', value: 'Go — escalar al 100% de ingresos desde abril.' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{label}</span>
                      <p className="text-xs text-slate-700">{value}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Checklist para cerrar Step 4 */}
              <SectionCard title="Checklist para cerrar el Step 4" icon={CheckCircle2}>
                <div className="space-y-0 -mx-4">
                  {CHECKLIST_S4.map((item, i) => (
                    <label key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <input type="checkbox" checked={checklistDone[i]}
                        onChange={e => { const n = [...checklistDone]; n[i] = e.target.checked; setChecklistDone(n); }}
                        className="w-4 h-4 shrink-0 accent-indigo-600" />
                      <span className={`text-sm transition-colors ${checklistDone[i] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item}</span>
                    </label>
                  ))}
                </div>
                <p className={`text-xs mt-3 ${checklistDone.every(Boolean) ? 'text-emerald-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                  {checklistDone.filter(Boolean).length}/{CHECKLIST_S4.length} completados{checklistDone.every(Boolean) && ' · ¡Listo para presentar!'}
                </p>
              </SectionCard>

              {/* Nav rápido a submódulos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'A' as const, label: 'A · Narrativa', desc: 'Construye el story outline en 7 secciones', icon: Edit2, color: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100' },
                  { id: 'B' as const, label: 'B · Evidencias', desc: 'Selecciona y describe los activos para el deck', icon: Paperclip, color: 'border-violet-200 bg-violet-50 hover:bg-violet-100' },
                  { id: 'C' as const, label: 'C · Deck y ensayo', desc: 'Genera el deck y practica el talk track', icon: Presentation, color: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100' },
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
          )}

          {/* ════════════════════════════════════════════════════════════════════
              S4A_NARRATIVA
          ════════════════════════════════════════════════════════════════════ */}
          {activeModule === 'A' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>A · Narrativa (story outline)</h1>
                  <StatusChip status="En progreso" size="sm" />
                </div>
                <p className="text-sm text-slate-500">Construye la historia de tu proyecto sección por sección. Breve y accionable.</p>
              </div>

              {/* Mejorar con IA */}
              <div className="flex items-center justify-between gap-3 flex-wrap p-3 bg-violet-50 border border-violet-100 rounded-xl">
                <div>
                  <p className="text-sm text-violet-800" style={{ fontWeight: 500 }}>¿Quieres mejorar el relato?</p>
                  <p className="text-xs text-violet-500 mt-0.5">La IA propone 3 versiones: ejecutiva, storytelling y técnica.</p>
                </div>
                <button
                  onClick={() => {
                    setShowIANarrativaOverlay(true);
                    if (!iaNarrativaListo) { setIaNarrativaLoading(true); setTimeout(() => { setIaNarrativaLoading(false); setIaNarrativaListo(true); }, 1600); }
                  }}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 px-3 py-2 bg-white border border-violet-200 rounded-lg transition-colors shrink-0"
                  style={{ fontWeight: 500 }}>
                  <Sparkles size={12} /> Mejorar con IA
                </button>
              </div>

              {/* Secciones */}
              {([
                { key: 'problema' as const, n: 1, label: 'Problema', hint: 'Describe el problema real y su impacto (del Step 1). Quién lo sufre, cuánto cuesta.' },
                { key: 'hipotesis' as const, n: 2, label: 'Hipótesis', hint: 'La apuesta del equipo: qué solución propusieron y por qué creían que funcionaría.' },
                { key: 'experimento' as const, n: 3, label: 'Experimento', hint: 'Cómo lo probaron: método, muestra, duración. Qué midieron.' },
                { key: 'resultados' as const, n: 4, label: 'Resultados', hint: 'Qué pasó realmente: métricas vs umbral. Incluye lo que no funcionó.' },
                { key: 'decision' as const, n: 5, label: 'Decisión', hint: 'Go / Iterar / No-Go / Pivote. Por qué. Qué viene ahora.' },
                { key: 'aprendizajes' as const, n: 6, label: 'Aprendizajes', hint: 'Los 2–3 insights más importantes que cambiarán cómo trabajan.' },
                { key: 'proximoPaso' as const, n: 7, label: 'Próximo paso', hint: 'Qué necesitan para avanzar. El pedido concreto al comité.' },
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

              <div className="flex gap-3 pt-2">
                <button onClick={() => toast.success('Borrador guardado')} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Guardar borrador</button>
                <button onClick={() => { toast.success('Narrativa guardada'); setActiveModule('B'); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2" style={{ fontWeight: 500 }}>
                  Siguiente: Evidencias <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              S4B_EVIDENCIAS
          ════════════════════════════════════════════════════════════════════ */}
          {activeModule === 'B' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>B · Evidencias y soporte</h1>
                  <StatusChip status="En progreso" size="sm" />
                </div>
                <p className="text-sm text-slate-500">Selecciona las evidencias del Step 3 que van en la historia. Describe qué demuestra cada una.</p>
              </div>

              {/* Recomendar con IA */}
              <div className="flex items-center justify-between gap-3 p-3 bg-violet-50 border border-violet-100 rounded-xl flex-wrap">
                <p className="text-sm text-violet-700" style={{ fontWeight: 500 }}>¿No sabes cuáles incluir?</p>
                <button
                  onClick={() => {
                    setShowIAEvidenciasOverlay(true);
                    if (!iaEvidenciasListo) { setIaEvidenciasLoading(true); setTimeout(() => { setIaEvidenciasLoading(false); setIaEvidenciasListo(true); }, 1400); }
                  }}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 px-3 py-2 bg-white border border-violet-200 rounded-lg transition-colors shrink-0"
                  style={{ fontWeight: 500 }}>
                  <Sparkles size={12} /> Recomendar evidencias con IA
                </button>
              </div>

              {/* Lista de evidencias */}
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
                          <p className="text-sm text-slate-800 truncate" style={{ fontWeight: ev.incluir ? 500 : 400 }}>{ev.descripcion}</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5"><Clock size={9} className="inline mr-0.5" />{ev.fecha}</p>
                      </div>
                    </div>
                    {ev.incluir && (
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué demuestra esta evidencia? (1 línea)</label>
                        <input value={ev.queDemuesta}
                          onChange={e => setEvidencias(p => p.map((x, j) => j === i ? { ...x, queDemuesta: e.target.value } : x))}
                          placeholder="Ej. Que el tiempo de respuesta fue ≤24h en 4 de 5 casos."
                          className="w-full border border-indigo-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => toast.success('Evidencias guardadas')} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Guardar</button>
                <button onClick={() => { toast.success('Evidencias confirmadas'); setActiveModule('C'); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2" style={{ fontWeight: 500 }}>
                  Siguiente: Deck y ensayo <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              S4C_DECK
          ════════════════════════════════════════════════════════════════════ */}
          {activeModule === 'C' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>C · Presentación y ensayo</h1>
                  <StatusChip status={deckAplicado ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">Genera la estructura del deck y practica el talk track de 60–90 segundos.</p>
              </div>

              {/* Generar con IA */}
              <div className="flex items-center justify-between gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex-wrap">
                <div>
                  <p className="text-sm text-indigo-800" style={{ fontWeight: 500 }}>Genera el borrador del deck con IA</p>
                  <p className="text-xs text-indigo-500 mt-0.5">2 variantes: ejecutiva (6 láminas) o completa (8 láminas). Todo en placeholder.</p>
                </div>
                <button onClick={() => {
                  setShowIADeckOverlay(true);
                  if (!iaDeckListo) { setIaDeckLoading(true); setTimeout(() => { setIaDeckLoading(false); setIaDeckListo(true); }, 1800); }
                }}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 px-3 py-2 bg-white border border-indigo-200 rounded-lg transition-colors shrink-0"
                  style={{ fontWeight: 500 }}>
                  <Sparkles size={12} /> Generar borrador con IA
                </button>
              </div>

              {/* Estructura del deck */}
              <SectionCard title={`Estructura del deck${deckAplicado ? ` — Variante ${deckVariante === 'ejecutivo' ? 'ejecutiva (6 láminas)' : 'completa (8 láminas)'}` : ' (placeholder)'}`} icon={Presentation}>
                {!deckAplicado && (
                  <p className="text-xs text-slate-400 mb-4 italic">Usa "Generar borrador con IA" para ver la estructura completa, o revisa la versión base:</p>
                )}
                <div className="space-y-2">
                  {currentDeckSlides.map(slide => (
                    <div key={slide.n} className="border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-slate-400" style={{ fontWeight: 700 }}>Lámina {slide.n}</span>
                        <span className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{slide.titulo}</span>
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

              {/* Talk track */}
              <SectionCard title="Talk track (ensayo · 60–90 seg)" icon={Users}>
                <p className="text-xs text-slate-400 mb-2">Escribe el guion que usarás al presentar. Debe ser conversacional, no leerlo literalmente.</p>
                <textarea value={talkTrack} onChange={e => setTalkTrack(e.target.value)} rows={6}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3" />
                <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>Checklist de ensayo</p>
                <div className="space-y-0 -mx-4">
                  {ENSAYO_ITEMS.map((item, i) => (
                    <label key={i} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <input type="checkbox" checked={ensayoChecks[i]}
                        onChange={e => { const n = [...ensayoChecks]; n[i] = e.target.checked; setEnsayoChecks(n); }}
                        className="w-4 h-4 shrink-0 accent-emerald-500" />
                      <span className={`text-xs transition-colors ${ensayoChecks[i] ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{item}</span>
                    </label>
                  ))}
                </div>
                <p className={`text-xs mt-3 ${ensayoChecks.every(Boolean) ? 'text-emerald-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                  {ensayoChecks.filter(Boolean).length}/{ENSAYO_ITEMS.length}{ensayoChecks.every(Boolean) && ' · ¡Listo para presentar!'}
                </p>
              </SectionCard>

              {/* Enviar a revisión IA */}
              {!hasFeedback && (
                <button onClick={() => setShowSendModal(true)}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                  style={{ fontWeight: 500 }}>
                  <Send size={14} /> Enviar a revisión IA
                </button>
              )}
              {hasFeedback && <FeedbackIAPanel feedback={MOCK_S4_FEEDBACK} />}

              {/* Sesión final con mentor */}
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
                    <p className="text-xs text-amber-600 mb-3">Agenda la sesión final con tu mentor para presentar el proyecto y cerrar el programa.</p>
                    <button onClick={() => setShowMentorModal(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                      <Calendar size={14} /> Agendar sesión de cierre
                    </button>
                  </div>
                )
              )}

              {/* Exportar */}
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
                      <button key={label} onClick={() => toast.success(`${label} — (modo demo, sin descarga real)`)}
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
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          OVERLAYS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Overlay_S4_AI_Narrativa */}
      {showIANarrativaOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Mejorar narrativa con IA</h3>
              </div>
              <button onClick={() => setShowIANarrativaOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
              {iaNarrativaLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Analizando el story outline…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">Elige la versión que mejor se adapta a tu audiencia:</p>
                  {IA_NARRATIVA_VERSIONES.map((v, i) => (
                    <div key={i}
                      onClick={() => setIaNarrativaSelected(i)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${iaNarrativaSelected === i ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700" style={{ fontWeight: 600 }}>{v.tipo}</span>
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
                <button onClick={() => setShowIANarrativaOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
                <button disabled={iaNarrativaSelected === null}
                  onClick={() => { setShowIANarrativaOverlay(false); toast.success(`Versión "${IA_NARRATIVA_VERSIONES[iaNarrativaSelected!].tipo}" aplicada como referencia`); }}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Usar esta versión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay_S4_AI_Evidencias */}
      {showIAEvidenciasOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Evidencias recomendadas por IA</h3>
              </div>
              <button onClick={() => setShowIAEvidenciasOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {iaEvidenciasLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Analizando evidencias del Step 3…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">Top 3 evidencias que mejor soportan tu historia:</p>
                  {IA_EVIDENCIAS_REC.map((rec, i) => (
                    <div key={i} className="border border-emerald-200 bg-emerald-50 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center text-xs shrink-0 mt-0.5" style={{ fontWeight: 700 }}>#{i + 1}</span>
                        <p className="text-sm text-emerald-800" style={{ fontWeight: 500 }}>{rec.ev}</p>
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

      {/* Overlay_S4_AI_Deck */}
      {showIADeckOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Generar borrador del deck con IA</h3>
              </div>
              <button onClick={() => setShowIADeckOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {iaDeckLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Generando estructura del deck…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">Elige la variante que mejor se adapta a tu presentación:</p>
                  {([
                    { key: 'ejecutivo' as const, label: 'Variante ejecutiva', laminasN: 6, desc: 'Directa y concisa. Ideal para comités de 10–15 minutos. Foco en decisión e impacto.', slides: SLIDES_EJECUTIVO },
                    { key: 'completo' as const, label: 'Variante completa', laminasN: 8, desc: 'Incluye aprendizajes, riesgos y pedido al comité. Para sesiones de 20–30 minutos.', slides: SLIDES_COMPLETO },
                  ]).map(({ key, label, laminasN, desc, slides }) => (
                    <div key={key} onClick={() => setDeckVariante(key)}
                      className={`border-2 rounded-xl overflow-hidden cursor-pointer transition-colors ${deckVariante === key ? 'border-indigo-400' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className={`px-4 py-2.5 flex items-center justify-between ${deckVariante === key ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          {deckVariante === key && <Check size={14} className="text-indigo-600" />}
                          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{label}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full" style={{ fontWeight: 600 }}>{laminasN} láminas</span>
                      </div>
                      <div className="px-4 pb-3">
                        <p className="text-xs text-slate-500 mt-2 mb-2">{desc}</p>
                        <div className="space-y-1">
                          {slides.slice(0, 3).map(s => (
                            <p key={s.n} className="text-xs text-slate-400"><span style={{ fontWeight: 600 }}>{s.n}.</span> {s.titulo}</p>
                          ))}
                          {slides.length > 3 && <p className="text-xs text-slate-300">+ {slides.length - 3} más…</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!iaDeckLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowIADeckOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
                <button disabled={!deckVariante}
                  onClick={() => { setDeckAplicado(true); setShowIADeckOverlay(false); toast.success(`Deck ${deckVariante === 'ejecutivo' ? 'ejecutivo (6 láminas)' : 'completo (8 láminas)'} aplicado`); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar variante
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
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Enviar Step 4 a revisión IA</h3>
            <p className="text-sm text-slate-500 mb-4">Se enviará: Narrativa · Evidencias seleccionadas · Estructura del deck · Talk track.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
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
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agendar sesión de cierre</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sesión final para presentar el proyecto y cerrar el programa.</p>
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
                    {['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00', '17:00'].map(h => <option key={h} value={h}>{h} hrs</option>)}
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
              <button onClick={() => setShowMentorModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
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
