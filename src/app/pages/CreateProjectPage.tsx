import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, X, AlertCircle, CheckCircle2, Users, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Invite { id: string; email: string; role: 'Editor' | 'Viewer'; status: 'Pendiente' | 'Enviado' }

export function CreateProjectPage() {
  const { createProject, setCurrentProject } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Editor' | 'Viewer'>('Editor');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const addInvite = () => {
    if (!inviteEmail.trim()) return;
    if (!validateEmail(inviteEmail)) { setEmailError('El correo no es válido. Verifica que tenga @empresa.com'); return; }
    if (invites.some(i => i.email === inviteEmail)) { setEmailError('Este correo ya fue invitado.'); return; }
    setInvites(prev => [...prev, { id: Date.now().toString(), email: inviteEmail, role: inviteRole, status: 'Pendiente' }]);
    setInviteEmail('');
    setEmailError(null);
  };

  const removeInvite = (id: string) => setInvites(prev => prev.filter(i => i.id !== id));

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    const project = createProject(name.trim(), description.trim() || undefined);
    setCurrentProject(project);
    navigate(`/projects/${project.id}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Crear nuevo proyecto</h1>
          <p className="text-sm text-slate-500">Paso {step} de 2</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {[{ n: 1, label: 'Información básica' }, { n: 2, label: 'Invitar equipo' }].map(({ n, label }) => (
          <div key={n} className="contents">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${step >= n ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`} style={{ fontWeight: 600 }}>
                {step > n ? '✓' : n}
              </div>
              <span className={`text-sm ${step >= n ? 'text-slate-800' : 'text-slate-400'}`} style={{ fontWeight: step >= n ? 500 : 400 }}>{label}</span>
            </div>
            {n < 2 && <div className={`flex-1 h-px ${step > n ? 'bg-indigo-300' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {step === 1 ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-800 mb-1.5" style={{ fontWeight: 500 }}>
                Nombre del proyecto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Reducir tiempo de onboarding de empleados"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">Usa el nombre del desafío que vas a resolver.</p>
            </div>

            <div>
              <label className="block text-sm text-slate-800 mb-1.5" style={{ fontWeight: 500 }}>
                Descripción breve <span className="text-slate-400">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe en 1–2 oraciones el problema que vas a abordar."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
              />
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs text-indigo-700" style={{ fontWeight: 600 }}>¿Cómo elige un buen nombre?</p>
              <p className="text-xs text-indigo-600 mt-1">Incluye el proceso o área afectada + el resultado esperado. Ejemplo: "Onboarding digital para reducir 3 semanas a 5 días".</p>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm transition-colors"
              style={{ fontWeight: 500 }}
            >
              Continuar → Invitar equipo
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-emerald-800" style={{ fontWeight: 500 }}>"{name}" listo para crear</p>
                {description && <p className="text-xs text-emerald-600 mt-0.5">{description}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-800 mb-1.5" style={{ fontWeight: 500 }}>
                Invitar miembros <span className="text-slate-400">(opcional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setEmailError(null); }}
                  onKeyDown={e => e.key === 'Enter' && addInvite()}
                  placeholder="correo@empresa.com"
                  className={`flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${emailError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
                />
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'Editor' | 'Viewer')}
                    className="appearance-none border border-slate-200 rounded-xl px-3 py-2.5 pr-7 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Editor">Editor</option>
                    <option value="Viewer">Lector</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={addInvite}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2.5 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              {emailError && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1.5">
                  <AlertCircle size={11} /> {emailError}
                </p>
              )}
              <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                <p><span style={{ fontWeight: 500 }}>Editor:</span> puede editar módulos y subir evidencias.</p>
                <p><span style={{ fontWeight: 500 }}>Lector:</span> solo puede ver el avance.</p>
              </div>
            </div>

            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>INVITACIONES PENDIENTES</p>
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-600" style={{ fontWeight: 700 }}>
                      {inv.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{inv.email}</p>
                      <p className="text-xs text-amber-600">{inv.role} · Invitación pendiente</p>
                    </div>
                    <button onClick={() => removeInvite(inv.id)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                      <X size={13} className="text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {invites.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <Users size={16} className="text-slate-400" />
                <p className="text-sm text-slate-400">Puedes invitar personas después desde la configuración del proyecto.</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-3 text-sm transition-colors" style={{ fontWeight: 500 }}>
                ← Atrás
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm transition-colors"
                style={{ fontWeight: 500 }}
              >
                {saving ? 'Creando proyecto…' : 'Crear proyecto'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}