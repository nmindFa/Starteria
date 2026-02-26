import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Lock, Download, Share2, Send, Calendar, CheckCircle2,
  FileText, Presentation, Package, Users, AlertTriangle, Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';

const MOCK_S4_FEEDBACK = {
  status: 'Aprobado' as const,
  summary: 'La historia es coherente con los Steps anteriores. El One-Pager integra bien el reto, la solución y la evidencia.',
  goodPoints: ['Narrativa consistente con Steps 1-3', 'Métricas reales integradas', 'Decisión y aprendizajes bien documentados'],
  missing: [],
  actions: [],
  questions: ['¿El One-Pager es comprensible para alguien que no conoce el contexto interno?'],
  timestamp: '2025-02-19T15:00:00Z',
};

export function Step4Page() {
  const { projectId } = useParams();
  const { projects } = useApp();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === projectId);
  const step = project?.steps.find(s => s.number === 4);

  const [activeSection, setActiveSection] = useState<'storyline' | 'onepager' | 'pitch' | 'export'>('storyline');
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showLeaderModal, setShowLeaderModal] = useState(false);

  const [storyline, setStoryline] = useState({
    reto: 'El onboarding de nuevos empleados en TechCorp tarda 3 semanas. El cuello de botella está en el alta de sistemas TI, que hoy funciona por correo informal sin SLA.',
    solucion: 'Creamos un formulario digital unificado que automatiza la solicitud de accesos desde la firma del contrato, con SLA de 24 horas para TI.',
    prueba: 'Corrimos 1 experimento piloto con 2 empleados. Resultado: 100% de los casos con accesos activos en menos de 24 horas (vs. 7-10 días en el proceso anterior).',
    evidencia: 'Timestamps de solicitud y activación, encuestas de experiencia (NPS: 82) y entrevistas con los empleados participantes.',
    decision: 'Decisión: Iterar y ampliar el piloto a 15 empleados en marzo para validar con mayor muestra antes de escalar.',
    impacto: 'Potencial reducción del tiempo de onboarding de 18 días a 5 días para el 80% de los ingresos, con ahorro estimado de $2,500 USD por empleado.',
  });

  const [onePager, setOnePager] = useState({
    titulo: 'Onboarding Digital: De 18 días a 5 días',
    resumen: 'Automatizamos la solicitud de accesos en TI para que nuevos empleados estén productivos en 1 día, no en 1 semana.',
    metricaPrincipal: '-89% en tiempo de alta en TI (7 días → 18 horas)',
    evidenciaClave: 'Piloto con 100% de éxito en 2 casos, NPS 82 en día 3',
    siguientePaso: 'Ampliar piloto a 15 ingresos en marzo 2025',
  });

  const saveState = useAutosave([storyline, onePager]);

  if (!project || !step) return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;

  const step3Approved = project.steps.find(s => s.number === 3)?.status === 'Aprobado';
  if (!step3Approved) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Step 4 bloqueado</h2>
        <p className="text-sm text-slate-500 mb-4">Para contar tu historia, primero necesitas la aprobación del mentor en el Step 3.</p>
        <button onClick={() => navigate(`/projects/${projectId}/step/3`)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>→ Ir al Step 3</button>
      </div>
    );
  }

  const sections = [
    { id: 'storyline' as const, label: 'Storyline', icon: FileText },
    { id: 'onepager' as const, label: 'One-Pager', icon: FileText },
    { id: 'pitch' as const, label: 'Pitch Deck', icon: Presentation },
    { id: 'export' as const, label: 'Exportar', icon: Package },
  ];

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="hidden md:flex w-52 flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <h2 className="text-sm text-slate-900 mt-2" style={{ fontWeight: 600 }}>Step 4</h2>
          <p className="text-xs text-slate-500">Contar una historia</p>
        </div>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${activeSection === s.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`} style={{ fontWeight: activeSection === s.id ? 600 : 400 }}>
            <s.icon size={14} className="shrink-0" /> {s.label}
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <AutosaveIndicator state={saveState} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">

          {/* Storyline Builder */}
          {activeSection === 'storyline' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Storyline Builder</h1>
                <p className="text-sm text-slate-500">Construye la narrativa de tu proyecto. Debe ser coherente con los Steps 1, 2 y 3. La IA verificará consistencia.</p>
              </div>

              {/* Consistency check from previous steps */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                <p className="text-xs text-indigo-700" style={{ fontWeight: 600 }}>🔗 Consistencia con Steps anteriores</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[{ step: 'Step 1', item: 'Quiebre: Alta TI 7-10 días', ok: true }, { step: 'Step 2', item: 'Solución: Formulario unificado', ok: true }, { step: 'Step 3', item: 'Resultado: 18h (100% éxito)', ok: true }].map(c => (
                    <div key={c.step} className="flex items-start gap-1.5 p-2 bg-white rounded-lg border border-indigo-100">
                      <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p style={{ fontWeight: 600 }} className="text-indigo-700">{c.step}</p>
                        <p className="text-indigo-600">{c.item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {([
                { key: 'reto', label: '1. El reto', placeholder: 'Describe el problema real y su impacto (de Step 1)' },
                { key: 'solucion', label: '2. La solución propuesta', placeholder: 'Qué diseñaron y por qué (de Step 2)' },
                { key: 'prueba', label: '3. Cómo lo probaron', placeholder: 'Descripción del experimento y resultados (de Step 3)' },
                { key: 'evidencia', label: '4. Evidencia clave', placeholder: 'Qué datos y artefactos respaldan los resultados' },
                { key: 'decision', label: '5. La decisión tomada', placeholder: '¿Continúan, pivotan o escalan? ¿Por qué?' },
                { key: 'impacto', label: '6. Impacto proyectado', placeholder: 'Si escalan, ¿qué impacto esperan lograr?' },
              ] as const).map(field => (
                <div key={field.key}>
                  <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>{field.label}</label>
                  <textarea value={storyline[field.key]} onChange={e => setStoryline(p => ({ ...p, [field.key]: e.target.value }))} rows={3} placeholder={field.placeholder} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              ))}

              <BannerPorDefinir
                title="REQ-S4-001 (referencia rota en PRD)"
                question="¿Qué requiere específicamente el REQ-S4-001 en el Step 4? La referencia existe en el documento pero no hay definición asociada. ¿Es un requerimiento de formato, de contenido o de aprobación?"
                context="missing"
              />

              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button className="flex items-center gap-2 border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl px-4 py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  <Sparkles size={14} /> Verificar coherencia con IA
                </button>
                <button onClick={() => setActiveSection('onepager')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Siguiente: One-Pager →
                </button>
              </div>
            </div>
          )}

          {/* One-Pager */}
          {activeSection === 'onepager' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>One-Pager exportable</h1>
                <p className="text-sm text-slate-500">Resume tu proyecto en una página lista para compartir. Edita cada campo y previsualiza el resultado.</p>
              </div>

              {/* Preview */}
              <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden">
                <div className="bg-indigo-600 px-6 py-4">
                  <p className="text-xs text-indigo-200" style={{ fontWeight: 600 }}>STARTERÍA · COHORTE 2025-A</p>
                  <h2 className="text-white text-xl mt-1" style={{ fontWeight: 700 }}>{onePager.titulo}</h2>
                </div>
                <div className="p-6 space-y-4 bg-white">
                  <div>
                    <p className="text-xs text-slate-400 mb-1" style={{ fontWeight: 600 }}>RESUMEN</p>
                    <p className="text-sm text-slate-700">{onePager.resumen}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-xs text-emerald-600 mb-1" style={{ fontWeight: 600 }}>MÉTRICA PRINCIPAL</p>
                      <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>{onePager.metricaPrincipal}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-blue-600 mb-1" style={{ fontWeight: 600 }}>EVIDENCIA CLAVE</p>
                      <p className="text-sm text-blue-800" style={{ fontWeight: 600 }}>{onePager.evidenciaClave}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1" style={{ fontWeight: 600 }}>SIGUIENTE PASO</p>
                    <p className="text-sm text-slate-700">{onePager.siguientePaso}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {project.team.slice(0, 3).map(m => (
                      <div key={m.id} className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700" style={{ fontWeight: 700 }}>{m.initials}</div>
                    ))}
                    <p className="text-xs text-slate-400">Equipo: {project.team.map(m => m.name).join(', ')}</p>
                  </div>
                </div>
              </div>

              {/* Edit fields */}
              <div className="space-y-3">
                {([
                  ['titulo', 'Título del One-Pager'],
                  ['resumen', 'Resumen (1 oración)'],
                  ['metricaPrincipal', 'Métrica principal'],
                  ['evidenciaClave', 'Evidencia clave'],
                  ['siguientePaso', 'Siguiente paso'],
                ] as const).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                    <input value={onePager[field]} onChange={e => setOnePager(p => ({ ...p, [field]: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setActiveSection('pitch')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Siguiente: Pitch Deck →</button>
              </div>
            </div>
          )}

          {/* Pitch Deck */}
          {activeSection === 'pitch' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Pitch Deck</h1>
                <p className="text-sm text-slate-500">El contenido del Storyline y One-Pager ya pre-llenó las secciones principales. Revisa y ajusta antes de exportar.</p>
              </div>

              <div className="space-y-3">
                {[
                  { n: 1, title: 'El problema', content: storyline.reto, color: 'border-red-200 bg-red-50' },
                  { n: 2, title: 'Nuestra solución', content: storyline.solucion, color: 'border-blue-200 bg-blue-50' },
                  { n: 3, title: 'La prueba', content: storyline.prueba, color: 'border-violet-200 bg-violet-50' },
                  { n: 4, title: 'Evidencia y métricas', content: `${onePager.metricaPrincipal} | ${onePager.evidenciaClave}`, color: 'border-emerald-200 bg-emerald-50' },
                  { n: 5, title: 'Decisión y siguiente paso', content: `${storyline.decision} | ${onePager.siguientePaso}`, color: 'border-amber-200 bg-amber-50' },
                  { n: 6, title: 'Impacto proyectado', content: storyline.impacto, color: 'border-indigo-200 bg-indigo-50' },
                ].map(slide => (
                  <div key={slide.n} className={`border rounded-xl p-4 ${slide.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-slate-400" style={{ fontWeight: 700 }}>Diapositiva {slide.n}</span>
                      <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{slide.title}</span>
                    </div>
                    <p className="text-sm text-slate-600">{slide.content}</p>
                  </div>
                ))}
              </div>

              {/* Leader review */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs shrink-0 mt-0.5" style={{ fontWeight: 600 }}>POR DEFINIR</span>
                  <div>
                    <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Revisión de Líder invitado</p>
                    <p className="text-xs text-slate-500 mt-0.5">¿El líder invitado puede aprobar o rechazar este Step? ¿Sus comentarios bloquean el avance o son opcionales?</p>
                    <button onClick={() => setShowLeaderModal(true)} className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 500 }}>
                      <Users size={11} /> Solicitar revisión de líder (opcional por ahora)
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setTimeout(() => setHasFeedback(true), 1000)} className="flex-1 border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  <Sparkles size={14} className="inline mr-1.5" /> Revisar coherencia con IA
                </button>
                <button onClick={() => setActiveSection('export')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Siguiente: Exportar →
                </button>
              </div>

              {hasFeedback && (
                <div className="mt-4">
                  <FeedbackIAPanel feedback={MOCK_S4_FEEDBACK} />
                  {MOCK_S4_FEEDBACK.status === 'Aprobado' && (
                    <div className="mt-4 border border-amber-200 bg-amber-50 rounded-xl p-4">
                      <p className="text-sm text-amber-800 mb-1" style={{ fontWeight: 600 }}>Sesión con experto obligatoria para finalizar</p>
                      <p className="text-xs text-amber-600 mb-3">La IA aprobó el Step 4. Agenda la sesión final con tu mentor para completar el programa.</p>
                      <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                        <Calendar size={14} /> Agendar sesión de cierre
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Export */}
          {activeSection === 'export' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Exportar y compartir</h1>
                <p className="text-sm text-slate-500">Tu proyecto está documentado. Exporta los materiales o comparte un link de acceso.</p>
              </div>

              <BannerPorDefinir
                title="Trigger exacto de 'Finalizado'"
                question="¿Qué evento marca el proyecto como 'Finalizado'? ¿La aprobación del mentor en Step 4, la exportación del One-Pager, o una acción manual del Admin de cohorte?"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: FileText, label: 'Exportar One-Pager', desc: 'PDF listo para compartir', action: 'Descargar PDF', color: 'bg-blue-50 border-blue-200' },
                  { icon: Package, label: 'Demo Day Package', desc: 'ZIP con todos los materiales', action: 'Descargar ZIP', color: 'bg-indigo-50 border-indigo-200' },
                  { icon: Share2, label: 'Link de acceso', desc: 'Enlace público de solo lectura', action: 'Copiar link', color: 'bg-violet-50 border-violet-200' },
                  { icon: FileText, label: 'Exportar para CV/LinkedIn', desc: 'Resumen en texto editable', action: 'Generar texto', color: 'bg-emerald-50 border-emerald-200' },
                ].map((item, i) => (
                  <div key={i} className={`border rounded-xl p-4 ${item.color}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <item.icon size={16} className="text-slate-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <button className="w-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                      <Download size={13} className="inline mr-1.5" /> {item.action}
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs text-amber-700" style={{ fontWeight: 600 }}>⚠ Privacidad y acceso</p>
                <p className="text-xs text-amber-600 mt-1">Los links de acceso a evidencias expiran en 30 días. Solo los miembros activos del proyecto pueden ver los materiales completos.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leader Modal */}
      {showLeaderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Solicitar revisión de líder</h3>
              <button onClick={() => setShowLeaderModal(false)}><span className="text-slate-400">✕</span></button>
            </div>
            <BannerPorDefinir
              title="Permisos exactos del Líder invitado"
              question="¿El líder invitado solo puede ver y comentar, o también puede aprobar o bloquear el Step 4? ¿Su acceso es permanente o por tiempo limitado?"
            />
            <p className="text-sm text-slate-500 mt-3 mb-4">Por ahora, puedes enviar el link del One-Pager al líder para que lo revise externamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaderModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>Cerrar</button>
              <button className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>Copiar link del One-Pager</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
