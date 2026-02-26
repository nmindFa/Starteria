import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Clock, Users, AlertTriangle, ChevronRight, Search, Folder } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-full mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="h-2 bg-slate-100 rounded w-full" />
    </div>
  );
}

export function DashboardPage() {
  const { projects, setCurrentProject, user, isDemoMode, isStepDemoApproved, demoApproveStep } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [loading] = useState(false);

  const isOwnerOrMember = user?.role === 'owner';
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const visibleProjects = isOwnerOrMember
    ? filtered.filter(p => p.team.some(m => m.email === user?.email))
    : filtered;

  const handleOpenProject = (id: string) => {
    const p = projects.find(pr => pr.id === id);
    if (p) {
      setCurrentProject(p);
      navigate(`/projects/${id}`);
    }
  };

  const handleOpenStep = (projectId: string, stepNumber: 3 | 4) => {
    const p = projects.find(pr => pr.id === projectId);
    if (p) {
      setCurrentProject(p);
      navigate(`/projects/${projectId}/step/${stepNumber}`);
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`;
    if (hrs > 0) return `Hace ${hrs} h`;
    return `Hace ${mins} min`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>
            {user?.role === 'owner' ? 'Mis proyectos' : user?.role === 'mentor' ? 'Proyectos a revisar' : user?.role === 'admin' ? 'Todos los proyectos' : 'Proyectos asignados'}
          </h1>
          <p className="text-sm text-slate-500">
            {user?.cohort ? `${user.cohort} · ` : ''}{visibleProjects.length} proyecto{visibleProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        {user?.role === 'owner' && (
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
            style={{ fontWeight: 500 }}
          >
            <Plus size={16} /> Crear proyecto
          </button>
        )}
      </div>

      <div className="relative mb-6">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proyectos..."
          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <Folder size={24} className="text-indigo-400" />
          </div>
          <h3 className="text-slate-800 mb-2" style={{ fontWeight: 600 }}>
            {search ? 'Sin resultados' : 'No tienes proyectos aún'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs">
            {search
              ? `No encontramos proyectos con "${search}". Prueba con otro término.`
              : 'Crea tu primer proyecto y empieza a trabajar en tu desafío.'}
          </p>
          {!search && user?.role === 'owner' && (
            <button
              onClick={() => navigate('/projects/new')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Plus size={16} /> Crear primer proyecto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map(project => {
            const step2 = project.steps.find(s => s.number === 2);
            const step3 = project.steps.find(s => s.number === 3);
            const step4 = project.steps.find(s => s.number === 4);

            const step2DemoApproved = isDemoMode && isStepDemoApproved(project.id, 2);
            const step3DemoApproved = isDemoMode && isStepDemoApproved(project.id, 3);
            const step3UnlockedByDemo = step2DemoApproved;
            const step4UnlockedByDemo = step3DemoApproved;

            const effectiveSteps = project.steps.map(s => {
              if (s.number === 2 && step2DemoApproved && s.status !== 'Aprobado') return { ...s, status: 'Aprobado' as const };
              if (s.number === 3 && step3DemoApproved && s.status !== 'Aprobado') return { ...s, status: 'Aprobado' as const };
              if (s.number === 3 && step3UnlockedByDemo && s.status === 'Bloqueado') return { ...s, status: 'En progreso' as const };
              if (s.number === 4 && step4UnlockedByDemo && s.status === 'Bloqueado') return { ...s, status: 'En progreso' as const };
              return s;
            });

            const currentStep = effectiveSteps.find(s => s.number === project.currentStep);
            const hasBlock = effectiveSteps.some(s => s.status === 'Bloqueado' && s.number === project.currentStep);
            const pendingSession = effectiveSteps.some(s => s.status === 'Sesión experto pendiente');

            const showStep2DemoApprove =
              isDemoMode &&
              !step2DemoApproved &&
              step2?.status === 'Sesión experto pendiente' &&
              step3?.status === 'Bloqueado';

            const showStep3DemoApprove =
              isDemoMode &&
              !step3DemoApproved &&
              step4?.status === 'Bloqueado' &&
              (
                step3UnlockedByDemo ||
                step3?.status === 'Sesión experto pendiente' ||
                step3?.status === 'En progreso' ||
                step3?.status === 'Enviado' ||
                step3?.status === 'Feedback IA' ||
                step3?.status === 'Ajustado'
              );

            return (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleOpenProject(project.id);
                }}
                role="button"
                tabIndex={0}
                className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <StatusChip status={project.status} size="sm" />
                  {pendingSession && <StatusChip status="Sesión experto pendiente" size="sm" />}
                </div>

                <div className="flex gap-1 mb-3">
                  {effectiveSteps.map(s => (
                    <div key={s.number} className="flex-1" title={`Step ${s.number}: ${s.name} — ${s.status}`}>
                      <div className={`h-1.5 rounded-full ${
                        s.status === 'Aprobado' ? 'bg-emerald-500' :
                        ['En progreso', 'Enviado', 'Feedback IA', 'Ajustado', 'Sesión experto pendiente'].includes(s.status) ? 'bg-indigo-500' :
                        s.status === 'No iniciado' ? 'bg-slate-200' :
                        'bg-slate-100'
                      }`} />
                      <p className="text-xs text-slate-400 mt-1 text-center">{s.number}</p>
                    </div>
                  ))}
                </div>

                {currentStep && (
                  <div className="mb-3">
                    <ProgressBar value={currentStep.progress} size="sm" label={`Step ${currentStep.number}: ${currentStep.name}`} />
                  </div>
                )}

                {(hasBlock || pendingSession) && (
                  <div className={`flex items-center gap-1.5 text-xs p-2 rounded-lg mb-2 ${
                    hasBlock ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'
                  }`}>
                    <AlertTriangle size={11} />
                    {hasBlock ? 'Hay módulos bloqueados que requieren tu atención' : 'Sesión con experto pendiente de agendar'}
                  </div>
                )}

                {(showStep2DemoApprove || showStep3DemoApprove || step4UnlockedByDemo) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {showStep2DemoApprove && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          demoApproveStep(project.id, 2);
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                      >
                        Simular aprobación de mentor (Step 2)
                      </button>
                    )}
                    {showStep3DemoApprove && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            demoApproveStep(project.id, 3);
                          }}
                          className="px-2.5 py-1 text-xs rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                        >
                          Simular aprobación de mentor (Step 3)
                        </button>
                        {step3UnlockedByDemo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStep(project.id, 3);
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Entrar a Step 3
                          </button>
                        )}
                      </>
                    )}
                    {step4UnlockedByDemo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStep(project.id, 4);
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Entrar a Step 4
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1">
                    <Users size={11} /> {project.team.length} miembro{project.team.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={11} /> {timeAgo(project.lastModified)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
