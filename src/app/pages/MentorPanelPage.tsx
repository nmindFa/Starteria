import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronRight, Sparkles, MessageSquare, Users, Calendar, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';

interface ReviewItem {
  id: string;
  projectName: string;
  team: string;
  stepNumber: number;
  stepName: string;
  submittedAt: string;
  priority: 'Alta' | 'Media' | 'Baja';
  iaStatus?: 'Aprobado' | 'Iterar' | 'Bloqueado';
  sessionStatus: 'Pendiente agendar' | 'Agendada' | 'Realizada';
  sessionDate?: string;
}

const PENDING_REVIEWS: ReviewItem[] = [
  { id: 'r1', projectName: 'Portal de Reportes Automáticos', team: 'Pedro Alvarado + Claudia Ruiz', stepNumber: 2, stepName: 'Diseñar solución', submittedAt: 'Hace 2 horas', priority: 'Alta', iaStatus: 'Aprobado', sessionStatus: 'Pendiente agendar' },
  { id: 'r2', projectName: 'Onboarding Digital', team: 'Ana Rodríguez + Miguel Torres', stepNumber: 1, stepName: 'Claridad en el desafío', submittedAt: 'Ayer', priority: 'Media', iaStatus: 'Iterar', sessionStatus: 'Agendada', sessionDate: '21 feb 2025, 10:00 AM' },
];

const RUBRICA = [
  { id: 'evidencia', label: 'Evidencia', desc: '¿Está documentado con evidencia real y verificable?', maxScore: 5 },
  { id: 'consistencia', label: 'Consistencia', desc: '¿Los módulos son coherentes entre sí y con el desafío?', maxScore: 5 },
  { id: 'claridad', label: 'Claridad', desc: '¿El análisis es claro y comprensible para alguien externo?', maxScore: 5 },
  { id: 'accionabilidad', label: 'Accionabilidad', desc: '¿Las conclusiones llevan a acciones concretas?', maxScore: 5 },
  { id: 'riesgos', label: 'Riesgos', desc: '¿Los riesgos y restricciones están identificados y abordados?', maxScore: 5 },
];

const MOCK_IA_FEEDBACK_FOR_MENTOR = {
  status: 'Aprobado' as const,
  summary: 'La solución propuesta está bien alineada con el desafío del Step 1. HMW claro, Matriz DVF sólida y Test Card completa.',
  goodPoints: ['HMW bien alineado al reto de automatización', '12 ideas generadas con buena diversidad de enfoques', 'Matriz DVF con scoring justificado y comparación clara'],
  missing: [],
  actions: [],
  questions: ['¿Cómo validarán la hipótesis de valor antes del experimento piloto?'],
  timestamp: '2025-02-19T08:00:00Z',
};

export function MentorPanelPage() {
  const { user } = useApp();
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({ evidencia: 0, consistencia: 0, claridad: 0, accionabilidad: 0, riesgos: 0 });
  const [comments, setComments] = useState('');
  const [decision, setDecision] = useState<'Aprobado' | 'Iterar' | 'Bloqueado' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxScore = RUBRICA.length * 5;

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    setSubmitting(false);
    setSubmitted(true);
  };

  if (selectedReview && !submitted) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => setSelectedReview(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          ← Volver a revisiones pendientes
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Revisión: {selectedReview.projectName}</h1>
            <p className="text-sm text-slate-500">Step {selectedReview.stepNumber}: {selectedReview.stepName} · {selectedReview.team}</p>
          </div>
          {selectedReview.iaStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-xl">
              <Sparkles size={13} className="text-violet-500" />
              <span className="text-xs text-violet-700" style={{ fontWeight: 500 }}>IA: {selectedReview.iaStatus}</span>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* IA Feedback for context */}
          <div>
            <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>REVISIÓN IA (contexto)</p>
            <FeedbackIAPanel feedback={MOCK_IA_FEEDBACK_FOR_MENTOR} />
          </div>

          {/* Rubric */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Rúbrica de evaluación</p>
              <span className="text-sm text-slate-500">Puntaje: <span style={{ fontWeight: 700 }} className={totalScore >= 20 ? 'text-emerald-600' : totalScore >= 12 ? 'text-amber-600' : 'text-red-600'}>{totalScore}/{maxScore}</span></span>
            </div>
            <div className="space-y-3">
              {RUBRICA.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <span className="text-sm text-slate-600" style={{ fontWeight: 600 }}>{scores[item.id]}/{item.maxScore}</span>
                  </div>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        onClick={() => setScores(p => ({ ...p, [item.id]: n }))}
                        className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${scores[item.id] >= n ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        style={{ fontWeight: 600 }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm text-slate-800 mb-1.5" style={{ fontWeight: 500 }}>Comentarios al equipo</label>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={4} placeholder="Escribe tu feedback para el equipo. Sé específico: qué mejorar, qué mantener y cuál es el próximo paso." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          {/* Decision */}
          <div>
            <p className="text-sm text-slate-800 mb-2" style={{ fontWeight: 600 }}>Decisión final <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { v: 'Aprobado' as const, label: 'Aprobar', desc: 'El Step es sólido. Desbloquear siguiente.', icon: <CheckCircle2 size={16} />, color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
                { v: 'Iterar' as const, label: 'Pedir iteración', desc: 'Hay mejoras antes de aprobar.', icon: <AlertTriangle size={16} />, color: 'border-amber-400 bg-amber-50 text-amber-700' },
                { v: 'Bloqueado' as const, label: 'Bloquear', desc: 'No cumple los mínimos. No avanza.', icon: <XCircle size={16} />, color: 'border-red-400 bg-red-50 text-red-700' },
              ]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setDecision(opt.v)}
                  className={`p-3 border-2 rounded-xl text-left transition-colors ${decision === opt.v ? opt.color : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className={`mb-1 ${decision === opt.v ? '' : 'text-slate-400'}`}>{opt.icon}</div>
                  <p className={`text-sm ${decision === opt.v ? '' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {decision === 'Aprobado' && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                <span style={{ fontWeight: 600 }}>Al aprobar:</span> El Step {selectedReview.stepNumber} quedará como "Aprobado" y el Step {selectedReview.stepNumber + 1} se desbloqueará automáticamente para el equipo.
              </div>
            )}
            {decision === 'Bloqueado' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <span style={{ fontWeight: 600 }}>Al bloquear:</span> El equipo recibirá tus comentarios y deberá corregir antes de volver a enviar. No podrán avanzar al siguiente Step.
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!decision || submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors"
            style={{ fontWeight: 500 }}
          >
            {submitting ? 'Guardando revisión…' : `Guardar revisión — ${decision || 'Selecciona decisión'}`}
          </button>
        </div>
      </div>
    );
  }

  if (submitted && selectedReview) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-600" />
        </div>
        <h2 className="text-xl text-slate-900 mb-2" style={{ fontWeight: 700 }}>Revisión enviada</h2>
        <p className="text-sm text-slate-500 mb-1">El equipo "{selectedReview.team}" recibirá tu feedback y la decisión "{decision}".</p>
        {decision === 'Aprobado' && (
          <p className="text-sm text-emerald-600 mb-4" style={{ fontWeight: 500 }}>
            ✓ Step {selectedReview.stepNumber} aprobado · Step {selectedReview.stepNumber + 1} desbloqueado
          </p>
        )}
        <button onClick={() => { setSelectedReview(null); setSubmitted(false); setDecision(null); setScores({ evidencia: 0, consistencia: 0, claridad: 0, accionabilidad: 0, riesgos: 0 }); setComments(''); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
          Ver más revisiones
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Panel de Mentor</h1>
        <p className="text-sm text-slate-500">Hola {user?.name}. Tienes {PENDING_REVIEWS.length} revisión{PENDING_REVIEWS.length !== 1 ? 'es' : ''} pendiente{PENDING_REVIEWS.length !== 1 ? 's' : ''}.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Pendientes', value: PENDING_REVIEWS.filter(r => r.sessionStatus === 'Pendiente agendar').length, color: 'text-amber-600' },
          { label: 'Agendadas', value: PENDING_REVIEWS.filter(r => r.sessionStatus === 'Agendada').length, color: 'text-blue-600' },
          { label: 'Este mes', value: 8, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-2xl ${s.color}`} style={{ fontWeight: 700 }}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending sessions */}
      <div className="mb-6">
        <h2 className="text-base text-slate-900 mb-3" style={{ fontWeight: 600 }}>Sesiones pendientes de agendar</h2>
        <div className="space-y-3">
          {PENDING_REVIEWS.filter(r => r.sessionStatus === 'Pendiente agendar').map(review => (
            <div key={review.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${review.priority === 'Alta' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                      {review.priority}
                    </span>
                    <span className="text-xs text-slate-500">Step {review.stepNumber}: {review.stepName}</span>
                  </div>
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{review.projectName}</p>
                  <p className="text-xs text-slate-500">{review.team}</p>
                </div>
                <button onClick={() => setSelectedReview(review)} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-3 py-2 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  <Calendar size={13} /> Agendar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All pending reviews */}
      <div>
        <h2 className="text-base text-slate-900 mb-3" style={{ fontWeight: 600 }}>Revisiones listas para sesión</h2>
        <div className="space-y-3">
          {PENDING_REVIEWS.map(review => (
            <div key={review.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-sm text-indigo-700 shrink-0" style={{ fontWeight: 700 }}>S{review.stepNumber}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{review.projectName}</p>
                    {review.iaStatus && (
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${review.iaStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700' : review.iaStatus === 'Iterar' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        <Sparkles size={10} /> IA: {review.iaStatus}
                      </span>
                    )}
                    <StatusChip status={review.sessionStatus} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500">Step {review.stepNumber}: {review.stepName} · {review.team}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Clock size={10} /> {review.submittedAt}</span>
                    {review.sessionDate && <span className="flex items-center gap-1"><Calendar size={10} /> {review.sessionDate}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReview(review)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 text-sm transition-colors shrink-0"
                  style={{ fontWeight: 500 }}
                >
                  Revisar <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
