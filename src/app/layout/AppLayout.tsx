import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import {
  LayoutDashboard, FolderOpen, Users, BarChart3, User, HelpCircle,
  LogOut, Menu, X, ChevronRight, Bell, Settings, Zap, CreditCard
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Participante',
  mentor: 'Mentor',
  admin: 'Administrador',
  leader: 'Líder invitado',
};

export function AppLayout() {
  const { user, logout, setUserRole, currentProject, isAuthenticated, demoUnlockSteps, setDemoUnlockSteps } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const ownerLinks = [
    { icon: LayoutDashboard, label: 'Mis proyectos', path: '/dashboard' },
    { icon: FolderOpen, label: 'Evidencias', path: currentProject ? `/projects/${currentProject.id}/evidencias` : '/dashboard', disabled: !currentProject },
    { icon: User, label: 'Mi perfil', path: '/perfil' },
  ];

  const mentorLinks = [
    { icon: Users, label: 'Revisiones pendientes', path: '/mentor' },
    { icon: LayoutDashboard, label: 'Todos los proyectos', path: '/dashboard' },
    { icon: User, label: 'Mi perfil', path: '/perfil' },
  ];

  const adminLinks = [
    { icon: BarChart3, label: 'Panel cohorte', path: '/admin' },
    { icon: LayoutDashboard, label: 'Todos los proyectos', path: '/dashboard' },
    { icon: Users, label: 'Mentores', path: '/admin#mentores' },
    { icon: User, label: 'Mi perfil', path: '/perfil' },
  ];

  const leaderLinks = [
    { icon: FolderOpen, label: 'Proyectos asignados', path: '/dashboard' },
    { icon: User, label: 'Mi perfil', path: '/perfil' },
  ];

  const links = user?.role === 'mentor' ? mentorLinks : user?.role === 'admin' ? adminLinks : user?.role === 'leader' ? leaderLinks : ownerLinks;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-base text-slate-900" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Startería</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(link => (
          <button
            key={link.path + link.label}
            onClick={() => { if (!('disabled' in link && link.disabled)) { navigate(link.path); setSidebarOpen(false); }}}
            disabled={'disabled' in link && !!link.disabled}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
              ${isActive(link.path) && !('disabled' in link && link.disabled)
                ? 'bg-indigo-50 text-indigo-700'
                : ('disabled' in link && link.disabled)
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            style={{ fontWeight: isActive(link.path) ? 600 : 400 }}
          >
            <link.icon size={16} />
            {link.label}
          </button>
        ))}
      </nav>

      {/* Project context (if in project) */}
      {currentProject && (
        <div className="mx-3 mb-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs text-indigo-500 mb-0.5" style={{ fontWeight: 600 }}>PROYECTO ACTIVO</p>
          <p className="text-sm text-indigo-800 truncate" style={{ fontWeight: 500 }}>{currentProject.name}</p>

          {/* Step progress dots */}
          <div className="flex gap-1 mt-2">
            {/* Paso 0 dot */}
            <button
              onClick={() => navigate(`/projects/${currentProject.id}/step/0`)}
              title="Paso 0: Punto de partida"
              className={`w-4 h-1.5 rounded-full transition-colors ${
                currentProject.step0Status === 'Completado' ? 'bg-emerald-500' :
                currentProject.step0Status === 'En progreso' ? 'bg-indigo-400' :
                'bg-slate-200'
              }`}
            />
            {currentProject.steps.map(s => (
              <button
                key={s.number}
                onClick={() => navigate(`/projects/${currentProject.id}/step/${s.number}`)}
                title={`Paso ${s.number}: ${s.name}`}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s.status === 'Aprobado' ? 'bg-emerald-500' :
                  s.status === 'En progreso' || s.status === 'Enviado' || s.status === 'Feedback IA' || s.status === 'Ajustado' || s.status === 'Sesión experto pendiente' ? 'bg-indigo-500' :
                  'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Mentor credits */}
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-indigo-100">
            <div className="flex items-center gap-1 text-xs text-indigo-400">
              <CreditCard size={11} />
              <span>Créditos mentor</span>
            </div>
            <div className="group relative">
              <span
                className="text-xs text-indigo-700 cursor-default"
                style={{ fontWeight: 600 }}
              >
                {currentProject.mentorCredits ?? '?'} disponibles
              </span>
              {/* Tooltip */}
              <div className="absolute right-0 bottom-5 w-48 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50" style={{ lineHeight: 1.4 }}>
                Se usan para sesiones de validación con un mentor experto.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role switcher (demo) */}
      <div className="px-3 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 px-1 mb-1.5" style={{ fontWeight: 600 }}>VER COMO (demo)</p>
        <div className="grid grid-cols-2 gap-1">
          {(['owner', 'mentor', 'admin', 'leader'] as const).map(r => (
            <button
              key={r}
              onClick={() => setUserRole(r)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${user?.role === r ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              style={{ fontWeight: user?.role === r ? 600 : 400 }}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        {user?.role === 'admin' && (
          <div className="mt-2 px-1 py-2 rounded-lg bg-slate-50 border border-slate-100">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs text-slate-600" style={{ fontWeight: 500 }}>Demo: desbloquear pasos</span>
              <button
                type="button"
                role="switch"
                aria-checked={demoUnlockSteps}
                onClick={() => setDemoUnlockSteps(!demoUnlockSteps)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${demoUnlockSteps ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${demoUnlockSteps ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </label>
          </div>
        )}
      </div>

      {/* User */}
      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={() => navigate('/perfil')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700" style={{ fontWeight: 700 }}>
            {user?.initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm text-slate-800 truncate" style={{ fontWeight: 500 }}>{user?.name}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[user?.role ?? 'owner']}</p>
          </div>
        </button>
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-slate-200 bg-white shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl z-10">
            <div className="flex justify-end p-3 border-b border-slate-100">
              <button onClick={() => setSidebarOpen(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={20} className="text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-indigo-600" />
            <span className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Startería</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700" style={{ fontWeight: 700 }}>
            {user?.initials}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
