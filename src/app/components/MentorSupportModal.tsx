import React, { useState } from 'react';
import { X, Calendar, MessageSquare, Sparkles, CreditCard, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { BannerPorDefinir } from './BannerPorDefinir';

type View = 'main' | 'schedule' | 'help';

interface MentorSupportModalProps {
  onClose: () => void;
  context?: string;
  mentorCredits?: number;
  onOpenIA?: () => void;
}

export function MentorSupportModal({
  onClose,
  context,
  mentorCredits = 3,
  onOpenIA,
}: MentorSupportModalProps) {
  const [view, setView] = useState<View>('main');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    setSubmitted(true);
  };

  const titleMap: Record<View, string> = {
    main: 'Soporte de mentor experto',
    schedule: 'Agendar sesión de validación',
    help: 'Pedir ayuda a un mentor',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-slate-900" style={{ fontWeight: 600 }}>
              {titleMap[view]}
            </h3>
            {context && (
              <p className="text-xs text-slate-400 mt-0.5">{context}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">

          {/* ── VISTA PRINCIPAL ── */}
          {view === 'main' && (
            <div className="space-y-3">
              {/* Créditos */}
              <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <CreditCard size={16} className="text-indigo-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-indigo-800" style={{ fontWeight: 500 }}>
                    {mentorCredits} crédito{mentorCredits !== 1 ? 's' : ''} disponible{mentorCredits !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-indigo-400">Se usan para sesiones de validación en vivo.</p>
                </div>
              </div>

              {/* Opción: pedir ayuda */}
              <button
                onClick={() => setView('help')}
                className="w-full flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-indigo-200 hover:bg-slate-50 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Pedir ayuda a un mentor
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Envía tu pregunta. Tu mentor responde en menos de 24 horas.
                  </p>
                  <span className="inline-block text-xs text-emerald-600 mt-1.5 px-2 py-0.5 bg-emerald-50 rounded-full" style={{ fontWeight: 500 }}>
                    No usa crédito · Asincrónico
                  </span>
                </div>
              </button>

              {/* Opción: agendar sesión */}
              <button
                onClick={() => setView('schedule')}
                className="w-full flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-indigo-200 hover:bg-slate-50 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Calendar size={16} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    Agendar sesión de validación
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sesión en vivo de 45–60 min. Sin sesión, el paso no se aprueba ni desbloquea el siguiente.
                  </p>
                  <span className="inline-block text-xs text-indigo-600 mt-1.5 px-2 py-0.5 bg-indigo-50 rounded-full" style={{ fontWeight: 500 }}>
                    Usa 1 crédito
                  </span>
                </div>
              </button>

              {/* Opción: IA primero */}
              <button
                onClick={() => { onOpenIA?.(); onClose(); }}
                className="w-full flex items-center gap-3 p-3 border border-dashed border-violet-200 rounded-xl hover:bg-violet-50 transition-all text-left"
              >
                <Sparkles size={15} className="text-violet-500 shrink-0" />
                <div>
                  <p className="text-sm text-violet-700" style={{ fontWeight: 500 }}>
                    Probar con IA y ejemplos primero
                  </p>
                  <p className="text-xs text-violet-400">No usa crédito. Buena opción para desatascarte rápido.</p>
                </div>
              </button>

              <BannerPorDefinir
                title="Política de créditos de mentor"
                question="¿Cuántos créditos tiene cada participante? ¿Cuándo se recargan? ¿Qué acciones consumen crédito? ¿Se pueden transferir entre proyectos?"
                context="pending"
              />
            </div>
          )}

          {/* ── AGENDAR SESIÓN ── */}
          {view === 'schedule' && !submitted && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <CreditCard size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  Esta sesión usará <span style={{ fontWeight: 600 }}>1 crédito</span> de los {mentorCredits} que tienes disponibles.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <span style={{ fontWeight: 600 }}>Importante:</span> Sin sesión de validación, el paso no se aprueba y el siguiente permanece bloqueado.
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                  ¿Qué quieres validar en esta sesión?
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Describe brevemente en qué punto estás y qué necesitas validar con el mentor."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setView('main')}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors"
                >
                  ← Atrás
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Agendar sesión
                </button>
              </div>
            </div>
          )}

          {/* ── PEDIR AYUDA ── */}
          {view === 'help' && !submitted && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Tu mentor recibirá tu consulta y te responderá en menos de 24 horas.{' '}
                  <span style={{ fontWeight: 600 }}>No usa crédito.</span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                  ¿En qué necesitas ayuda?
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe tu duda o el punto donde te sientes trabado. Cuanto más contexto des, mejor te puede ayudar."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setView('main')}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors"
                >
                  ← Atrás
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Enviar consulta
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRMACIÓN ── */}
          {submitted && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={22} className="text-emerald-600" />
              </div>
              <p className="text-slate-900 mb-1" style={{ fontWeight: 600 }}>
                {view === 'schedule' ? '¡Sesión solicitada!' : '¡Consulta enviada!'}
              </p>
              <p className="text-sm text-slate-500 mb-5">
                {view === 'schedule'
                  ? 'Tu mentor te contactará para confirmar el horario. El estado del paso cambia a "Sesión pendiente".'
                  : 'Tu mentor recibirá tu consulta y te responderá pronto.'}
              </p>
              <button
                onClick={onClose}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2 text-sm transition-colors"
                style={{ fontWeight: 500 }}
              >
                Entendido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
