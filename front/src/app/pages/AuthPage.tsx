import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Zap, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AuthError } from '../services/api';

type FieldErrors = {
  email?: string;
  password?: string;
  name?: string;
};

const KNOWN_FIELDS: Array<keyof FieldErrors> = ['email', 'password', 'name'];

function isKnownField(value: unknown): value is keyof FieldErrors {
  return typeof value === 'string' && (KNOWN_FIELDS as string[]).includes(value);
}

function formatRetryAfter(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `${m} minuto${m > 1 ? 's' : ''}`;
  }
  return `${seconds} segundos`;
}

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [topError, setTopError] = useState<AuthError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [emailFormatError, setEmailFormatError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  // Counter incremented on every submit failure — drives focus-management effect.
  const [submitErrorKey, setSubmitErrorKey] = useState(0);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const { login, register, isAuthenticated, user } = useApp();
  const navigate = useNavigate();

  // Tick para refrescar la cuenta regresiva del bloqueo.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  useEffect(() => {
    if (lockedUntil && now >= lockedUntil) {
      setLockedUntil(null);
    }
  }, [now, lockedUntil]);

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(user?.role === 'portfolio_lead' ? '/portfolio/inicio' : '/dashboard', { replace: true });
  }, [isAuthenticated, navigate, user?.role]);

  // Focus management on submit failure: prioriza el primer campo inválido,
  // si no hay errores de campo enfoca el banner (que tiene tabIndex -1).
  useEffect(() => {
    if (submitErrorKey === 0) return;
    if (fieldErrors.name && nameInputRef.current) {
      nameInputRef.current.focus();
      return;
    }
    if (fieldErrors.email && emailInputRef.current) {
      emailInputRef.current.focus();
      return;
    }
    if (fieldErrors.password && passwordInputRef.current) {
      passwordInputRef.current.focus();
      return;
    }
    if (bannerRef.current) bannerRef.current.focus();
    // Solo dependemos del contador para no re-enfocar mientras el usuario tipea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitErrorKey]);

  const isLocked = lockedUntil !== null && now < lockedUntil;
  const remainingSeconds = isLocked && lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;

  const validateEmail = (v: string) => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    setEmailFormatError(valid || !v ? null : 'El correo no tiene un formato válido. Revísalo.');
    return valid;
  };

  const resetErrors = () => {
    setTopError(null);
    setFieldErrors({});
  };

  const applyServerError = (error: AuthError) => {
    // Caso 1: detalles multi-campo (validation error con array `details`).
    if (Array.isArray(error.details) && error.details.length > 0) {
      const nextFieldErrors: FieldErrors = {};
      for (const detail of error.details) {
        if (isKnownField(detail.field)) {
          nextFieldErrors[detail.field] = detail.message;
        }
      }
      setFieldErrors(nextFieldErrors);
      setTopError({
        code: 'VALIDATION_ERROR',
        message: 'Revisa los datos ingresados.',
        ...(error.hint ? { hint: error.hint } : {}),
        ...(error.requestId ? { requestId: error.requestId } : {}),
      });
      return;
    }

    // Caso 2: error apuntando a un campo específico.
    if (error.field && isKnownField(error.field)) {
      setFieldErrors({ [error.field]: error.message });
      // Mantenemos el banner para que el usuario lo note en pantallas pequeñas.
      setTopError(error);
      return;
    }

    // Caso 3: error general — solo banner.
    setFieldErrors({});
    setTopError(error);

    // Lockout / rate-limit: deshabilita submit hasta que pase el tiempo.
    if (
      (error.code === 'AUTH_ACCOUNT_LOCKED' || error.code === 'AUTH_RATE_LIMITED') &&
      typeof error.retryAfterSeconds === 'number' &&
      error.retryAfterSeconds > 0
    ) {
      setLockedUntil(Date.now() + error.retryAfterSeconds * 1000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    resetErrors();
    if (!validateEmail(email)) return;

    setLoading(true);
    const result =
      mode === 'register'
        ? await register(name, email, password)
        : await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate(email.toLowerCase() === 'portfolio@starteria.io' ? '/portfolio/inicio' : '/dashboard');
      return;
    }

    if (result.error) {
      applyServerError(result.error);
    } else {
      setTopError({
        code: 'UNKNOWN',
        message: 'Algo salió mal. Vuelve a intentar.',
      });
    }
    setSubmitErrorKey((k) => k + 1);
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    resetErrors();
    setLockedUntil(null);
  };

  const handleSwitchToLoginKeepEmail = () => {
    setMode('login');
    resetErrors();
  };

  const handleForgotPassword = () => {
    // Placeholder — recuperación de contraseña aún no está implementada.
    // eslint-disable-next-line no-console
    console.log('[AuthPage] Forgot password clicked — flow not yet implemented.');
  };

  // Mensaje de bloqueo dinámico: reescribe el `message` con el tiempo restante.
  const lockoutBannerMessage = useMemo(() => {
    if (!topError) return null;
    if (topError.code !== 'AUTH_ACCOUNT_LOCKED' && topError.code !== 'AUTH_RATE_LIMITED') return null;
    if (!isLocked || remainingSeconds <= 0) return topError.message;

    const formatted = formatRetryAfter(remainingSeconds);
    if (topError.code === 'AUTH_ACCOUNT_LOCKED') {
      return `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${formatted}.`;
    }
    return `Demasiados intentos en poco tiempo. Espera ${formatted} antes de reintentar.`;
  }, [topError, isLocked, remainingSeconds]);

  const showTopBanner = topError !== null;
  const submitDisabled = loading || !!emailFormatError || isLocked;

  const submitLabel = (() => {
    if (loading) return 'Ingresando…';
    if (isLocked) return `Espera ${formatRetryAfter(remainingSeconds)}`;
    return mode === 'login' ? 'Entrar' : 'Crear cuenta';
  })();

  const DEMO_ACCOUNTS = [
    { label: 'Participante', email: 'participante@starteria.io' },
    { label: 'Mentor', email: 'mentor@starteria.io' },
    { label: 'Admin', email: 'admin@starteria.io' },
    { label: 'Portfolio Lead', email: 'portfolio@starteria.io' },
    { label: 'Sponsor', email: 'sponsor@starteria.io' },
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
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: undefined }));
                    if (topError) setTopError(null);
                  }}
                  placeholder="Ana Rodríguez"
                  required
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                />
                {fieldErrors.name && (
                  <p id="auth-name-error" className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle size={11} /> {fieldErrors.name}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Correo electrónico</label>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setEmailFormatError(null);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                  if (topError) setTopError(null);
                }}
                onBlur={e => validateEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                aria-invalid={!!(emailFormatError || fieldErrors.email)}
                aria-describedby={(emailFormatError || fieldErrors.email) ? 'auth-email-error' : undefined}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${(emailFormatError || fieldErrors.email) ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
              />
              {(emailFormatError || fieldErrors.email) && (
                <p id="auth-email-error" className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertCircle size={11} /> {emailFormatError ?? fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Contraseña</label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                    if (topError) setTopError(null);
                  }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                  className={`w-full border rounded-xl px-4 py-2.5 pr-10 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${fieldErrors.password ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="auth-password-error" className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertCircle size={11} /> {fieldErrors.password}
                </p>
              )}
            </div>

            {showTopBanner && topError && (
              <div
                ref={bannerRef}
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                tabIndex={-1}
                className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <p style={{ fontWeight: 500 }}>
                    {lockoutBannerMessage ?? topError.message}
                  </p>
                  {topError.hint && topError.code !== 'AUTH_ACCOUNT_LOCKED' && topError.code !== 'AUTH_RATE_LIMITED' && (
                    <p className="text-red-600/80">{topError.hint}</p>
                  )}

                  {topError.code === 'AUTH_EMAIL_TAKEN' && (
                    <button
                      type="button"
                      onClick={handleSwitchToLoginKeepEmail}
                      className="inline-flex items-center gap-1 text-red-700 hover:text-red-800 underline underline-offset-2"
                      style={{ fontWeight: 500 }}
                    >
                      Inicia sesión <ArrowRight size={11} />
                    </button>
                  )}

                  {topError.code === 'AUTH_INVALID_CREDENTIALS' && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="inline-flex items-center gap-1 text-red-700 hover:text-red-800 underline underline-offset-2"
                      style={{ fontWeight: 500 }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}

                  {topError.code === 'NETWORK_ERROR' && (
                    <button
                      type="button"
                      onClick={() => setTopError(null)}
                      className="inline-flex items-center gap-1 text-red-700 hover:text-red-800 underline underline-offset-2"
                      style={{ fontWeight: 500 }}
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
              style={{ fontWeight: 500 }}
            >
              {submitLabel}
              {!loading && !isLocked && <ArrowRight size={15} />}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-indigo-600 hover:text-indigo-700"
              style={{ fontWeight: 500 }}
            >
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
                onClick={() => {
                  setEmail(a.email);
                  setPassword('demo123');
                  setMode('login');
                  resetErrors();
                  setLockedUntil(null);
                }}
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
