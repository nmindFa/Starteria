import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Zap, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const { login, isAuthenticated } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated]);

  const validateEmail = (v: string) => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    setEmailError(valid || !v ? null : 'El correo no tiene un formato válido. Revísalo.');
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateEmail(email)) return;

    if (mode === 'register') {
      setError('El registro estará disponible pronto. Por ahora usa una cuenta de demo.');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error ?? 'Algo salió mal. Vuelve a intentar.');
    }
  };

  const DEMO_ACCOUNTS = [
    { label: 'Participante', email: 'participante@starteria.io' },
    { label: 'Mentor', email: 'mentor@starteria.io' },
    { label: 'Admin', email: 'admin@starteria.io' },
    { label: 'Líder', email: 'lider@starteria.io' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-2xl text-slate-900" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>Startería</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 600 }}>
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {mode === 'login' ? 'Ingresa para continuar con tu proyecto.' : 'Regístrate para empezar tu primer proyecto.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Nombre completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ana Rodríguez"
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(null); setError(null); }}
                onBlur={e => validateEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                className={`w-full border rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${emailError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
              />
              {emailError && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertCircle size={11} /> {emailError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!emailError}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
              style={{ fontWeight: 500 }}
            >
              {loading ? 'Ingresando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} className="text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 500 }}>
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>

        {/* Demo accounts */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-3" style={{ fontWeight: 600 }}>CUENTAS DEMO · contraseña: demo123</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                onClick={() => { setEmail(a.email); setPassword('demo123'); setMode('login'); setError(null); }}
                className="text-left p-2.5 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
              >
                <p className="text-xs text-slate-700" style={{ fontWeight: 500 }}>{a.label}</p>
                <p className="text-xs text-slate-400 truncate">{a.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}