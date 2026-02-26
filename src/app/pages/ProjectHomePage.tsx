import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Lock, CheckCircle2, ChevronRight, Users, AlertTriangle,
  FileText, Clock, History, Plus, X, ChevronDown, UserPlus,
  Sparkles, Calendar, MessageSquare, ClipboardList,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { MentorSupportModal } from '../components/MentorSupportModal';
import { MentorVirtualPanel } from '../components/MentorVirtualPanel';
import { Step3Detail } from '../components/Step3Detail';
import { Step4Detail } from '../components/Step4Detail';
import type { Step } from '../context/AppContext';

const STEP_DESCRIPTIONS = [
  'Entiende el problema con claridad: documenta el proceso actual, mide el impacto y conoce a los actores involucrados.',
  'Diseña la solución: explora ideas, elige la mejor opción y crea las tarjetas de solución y prueba.',
  'Prueba en pequeño: ejecuta experimentos reales, registra métricas y aprende de cada iteración.',
  'Cuenta la historia: construye el relato de tu proyecto e impacto, listo para compartir y presentar.',
];

const BLOCK_REASONS: Record<string, string> = {
  '1': 'Completa tu Punto de partida para empezar con claridad.',
  '2': 'Para acceder al Paso 2, el Paso 1 debe estar aprobado por tu mentor.',
  '3': 'Para acceder al Paso 3, el Paso 2 debe estar aprobado por tu mentor.',
  '4': 'Para acceder al Paso 4, el Paso 3 debe estar aprobado por tu mentor.',
};

export function ProjectHomePage() {
  const { projectId } = useParams();
  const { projects, setCurrentProject, user, demoUnlockSteps } = useApp();
  const navigate = useNavigate();
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorModalContext, setMentorModalContext] = useState('');
  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaPanelContext, setIaPanelContext] = useState('');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [previewSteps, setPreviewSteps] = useState<Record<number, boolean>>({});

  const project = projects.find(p => p.id === projectId);
  if (!project) return (
    <div className="p-6 text-center">
      <p className="text-slate-500">Proyecto no encontrado.</p>
      <button onClick={() => navigate('/dashboard')} className="text-indigo-600 text-sm mt-2">← Volver al inicio</button>
    </div>
  );

  // ── Access logic ──────────────────────────────────────────────────────────

  const canAccessStep = (stepNum: number) => {
    if (stepNum === 1) return project.step0Status === 'Completado';
    const prevStep = project.steps.find(s => s.number === stepNum - 1);
    return prevStep?.status === 'Aprobado';
  };

  const isDemoUnlockedForStep = (stepNum: number) => user?.role === 'admin' && demoUnlockSteps && stepNum >= 3;

  const handleStepClick = (step: Step) => {
    const accessible = canAccessStep(step.number);
    const demoAccessible = isDemoUnlockedForStep(step.number);
    if ((step.number === 3 || step.number === 4) && (accessible || demoAccessible)) {
      setExpandedStep(prev => (prev === step.number ? null : step.number));
      return;
    }
    if (!accessible) return;
    setCurrentProject(project);
    navigate(`/projects/${project.id}/step/${step.number}`);
  };

  const openMentorModal = (ctx: string) => {
    setMentorModalContext(ctx);
    setShowMentorModal(true);
  };

  const openIA = (ctx: string) => {
    setIaPanelContext(ctx);
    setShowIAPanel(true);
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const completedModules = project.steps.reduce(
    (acc, s) => acc + s.modules.filter(m => m.status === 'Completado' || m.status === 'Aprobado').length, 0
  );
  const totalModules = project.steps.reduce((acc, s) => acc + s.modules.length, 0);
  const overallProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> Mis proyectos
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusChip status={project.status} />
            {project.riskLevel === 'Alto' && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                <AlertTriangle size={10} /> Riesgo alto
              </span>
            )}
          </div>
          <h1 className="text-2xl text-slate-900" style={{ fontWeight: 700 }}>{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500 mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => navigate(`/projects/${project.id}/evidencias`)}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm transition-colors"
          >
            <FileText size={14} /> Evidencias
          </button>
          <button
            onClick={() => setShowTeamModal(true)}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm transition-colors"
          >
            <Users size={14} /> Equipo
          </button>
        </div>
      </div>

      {/* Progress card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Progreso general</p>
            <p className="text-xs text-slate-400">{completedModules} de {totalModules} módulos completados</p>
          </div>
          <span className="text-2xl text-indigo-600" style={{ fontWeight: 700 }}>{overallProgress}%</span>
        </div>
        <ProgressBar value={overallProgress} showLabel={false} />

        {/* Step dots: 0 + 1–4 */}
        <div className="flex gap-3 mt-4 overflow-x-auto">
          {/* Paso 0 */}
          <div className="flex-none text-center">
            <div
              className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-xs border-2 transition-all ${
                project.step0Status === 'Completado'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : project.step0Status === 'En progreso'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
              style={{ fontWeight: 700 }}
            >
              {project.step0Status === 'Completado' ? '✓' : '0'}
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">0</p>
          </div>

          {project.steps.map(s => (
            <div key={s.number} className="flex-1 text-center">
              <div
                className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-xs border-2 transition-all ${
                  s.status === 'Aprobado'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : ['En progreso', 'Enviado', 'Feedback IA', 'Ajustado', 'Sesión experto pendiente'].includes(s.status)
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
                style={{ fontWeight: 700 }}
              >
                {s.status === 'Aprobado' ? '✓' : s.number}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">{s.number}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Steps list ── */}
      <div className="space-y-3 mb-6">

        {/* ── PASO 0 ── */}
        <div
          className={`bg-white rounded-2xl border transition-all ${
            project.step0Status !== 'Completado'
              ? 'border-indigo-200 ring-1 ring-indigo-100'
              : 'border-slate-200'
          } cursor-pointer hover:border-indigo-200 hover:shadow-sm`}
          onClick={() => { setCurrentProject(project); navigate(`/projects/${project.id}/step/0`); }}
        >
          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                  project.step0Status === 'Completado'
                    ? 'bg-emerald-100 text-emerald-700'
                    : project.step0Status === 'En progreso'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-indigo-50 text-indigo-500'
                }`}
                style={{ fontWeight: 700 }}
              >
                {project.step0Status === 'Completado' ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <ClipboardList size={16} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                    Paso 0: Punto de partida
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      project.step0Status === 'Completado'
                        ? 'bg-emerald-100 text-emerald-700'
                        : project.step0Status === 'En progreso'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {project.step0Status}
                  </span>
                  {project.step0Status !== 'Completado' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" style={{ fontWeight: 500 }}>
                      Requerido para empezar
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Aterriza tu iniciativa en 5–7 minutos. Captura el contexto que habilita el inicio estratégico.
                </p>

                {project.step0Status === 'Completado' && project.step0Data && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.step0Data.origen && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        ✓ Origen
                      </span>
                    )}
                    {(project.step0Data.impacta?.length ?? 0) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        ✓ Impacta a {project.step0Data.impacta!.join(', ')}
                      </span>
                    )}
                    {project.step0Data.siMinimo && project.step0Data.siMinimo.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        ✓ Sí mínimo definido
                      </span>
                    )}
                  </div>
                )}
              </div>

              <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
            </div>
          </div>
        </div>

        {/* ── PASOS 1–4 ── */}
        {project.steps.map(step => {
          const accessible = canAccessStep(step.number);
          const demoAccessible = isDemoUnlockedForStep(step.number);
          const canOpenEmbedded = accessible || demoAccessible;
          const isActive = step.status !== 'Aprobado' && step.status !== 'No iniciado' && step.status !== 'Bloqueado';
          const hasPendingSession = step.mentorSession?.status === 'Pendiente agendar';
          const isEmbeddedStep = step.number === 3 || step.number === 4;
          const showPreview = !!previewSteps[step.number];
          const showEmbeddedDetail = isEmbeddedStep && ((expandedStep === step.number && canOpenEmbedded) || showPreview);
          const embeddedReadOnly = !accessible && !demoAccessible;

          return (
            <div
              key={step.number}
              className={`bg-white rounded-2xl border transition-all ${
                canOpenEmbedded || accessible
                  ? 'border-slate-200 hover:border-indigo-200 hover:shadow-sm cursor-pointer'
                  : 'border-slate-100 opacity-60 cursor-default'
              } ${isActive ? 'ring-1 ring-indigo-200' : ''}`}
              onClick={() => handleStepClick(step)}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Step icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                      step.status === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' :
                      isActive ? 'bg-indigo-100 text-indigo-700' :
                      !accessible ? 'bg-slate-100 text-slate-400' :
                      'bg-slate-100 text-slate-500'
                    }`}
                    style={{ fontWeight: 700 }}
                  >
                    {step.status === 'Aprobado' ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : !accessible ? (
                      <Lock size={16} />
                    ) : (
                      step.number
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                        Paso {step.number}: {step.name}
                      </h3>
                      <StatusChip status={step.status} size="sm" />
                      {hasPendingSession && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full" style={{ fontWeight: 500 }}>
                          <Clock size={10} /> Sesión pendiente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{STEP_DESCRIPTIONS[step.number - 1]}</p>

                    {/* Blocked message */}
                    {!accessible && (
                      <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5 mb-3">
                        <Lock size={11} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>Bloqueado: para acceder, el Paso anterior debe estar aprobado por tu mentor.</span>
                      </div>
                    )}

                    {/* Module pills */}
                    {(accessible || demoAccessible) && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {step.modules.map(mod => (
                          <span
                            key={mod.id}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                              mod.status === 'Completado' || mod.status === 'Aprobado'
                                ? 'bg-emerald-50 text-emerald-700'
                                : mod.status === 'En progreso'
                                ? 'bg-blue-50 text-blue-700'
                                : mod.status === 'Bloqueado'
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-slate-50 text-slate-500'
                            }`}
                          >
                            {(mod.status === 'Completado' || mod.status === 'Aprobado') && <span>✓</span>}
                            {mod.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Progress */}
                    {(accessible || demoAccessible) && step.progress > 0 && (
                      <ProgressBar value={step.progress} size="sm" />
                    )}

                    {/* Mentor actions (accessible steps) */}
                    {(accessible || demoAccessible) && (
                      <div className="flex gap-2 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openIA(`Paso ${step.number} · ${step.name}`)}
                          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <Sparkles size={11} /> Mejorar con IA
                        </button>
                        <button
                          onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <MessageSquare size={11} /> Pedir ayuda
                        </button>
                        {(hasPendingSession || step.status === 'Sesión experto pendiente') && (
                          <button
                            onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Calendar size={11} /> Agendar ahora
                          </button>
                        )}
                        {!hasPendingSession && step.status !== 'Sesión experto pendiente' && (
                          <button
                            onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Calendar size={11} /> Agendar sesión
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {(accessible || demoAccessible) && (
                    <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
                  )}
                </div>
              </div>

              {/* Blocked CTA */}
              {!accessible && (
                <div className="px-5 pb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {(step.number === 3 || step.number === 4) && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPreviewSteps(prev => ({ ...prev, [step.number]: !prev[step.number] }));
                          setExpandedStep(null);
                        }}
                        className="text-xs text-slate-700 hover:text-slate-900 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        Ver vista previa (solo lectura)
                      </button>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setCurrentProject(project);
                        if (step.number === 1) {
                          navigate(`/projects/${project.id}/step/0`);
                        } else {
                          const prevStep = project.steps.find(s => s.number === step.number - 1);
                          if (prevStep) navigate(`/projects/${project.id}/step/${prevStep.number}`);
                        }
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      {step.number === 1
                        ? '→ Ir al Paso 0 para desbloquear'
                        : `→ Ir al Paso ${step.number - 1} para desbloquear`}
                    </button>
                  </div>
                </div>
              )}

              {/* Pending session warning */}
              {accessible && hasPendingSession && (
                <div className="mx-5 mb-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl" onClick={e => e.stopPropagation()}>
                  <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-800" style={{ fontWeight: 500 }}>
                      Sesión de validación pendiente
                    </p>
                    <p className="text-xs text-amber-600">
                      Sin sesión, el paso no se aprueba y no se desbloquea el siguiente.
                    </p>
                  </div>
                  <button
                    onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                    className="ml-auto shrink-0 text-xs text-amber-700 hover:text-amber-900 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Agendar
                  </button>
                </div>
              )}

              {showEmbeddedDetail && (
                <div className="px-5 pb-5" onClick={e => e.stopPropagation()}>
                  <div className="border-t border-slate-100 pt-4">
                    {demoAccessible && (
                      <div className="mb-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>
                          Vista demo
                        </span>
                      </div>
                    )}
                    {step.number === 3 && (
                      <Step3Detail projectId={project.id} readOnly={embeddedReadOnly} isDemo={demoAccessible} />
                    )}
                    {step.number === 4 && (
                      <Step4Detail projectId={project.id} readOnly={embeddedReadOnly} isDemo={demoAccessible} />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-200">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-400" />
            <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Historial de cambios</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
        {showHistory && (
          <div className="px-5 pb-5 space-y-3 border-t border-slate-100">
            {[
              { action: 'Módulo B completado', user: 'Ana Rodríguez', time: 'Hoy, 10:30 AM', paso: 'Paso 1' },
              { action: 'Evidencia "Dashboard_metricas.png" subida', user: 'Ana Rodríguez', time: 'Ayer, 4:15 PM', paso: 'Paso 1 · Módulo B' },
              { action: 'Módulo A completado', user: 'Miguel Torres', time: 'Hace 3 días', paso: 'Paso 1' },
              { action: 'Punto de partida completado', user: 'Ana Rodríguez', time: '19 feb 2025', paso: 'Paso 0' },
              { action: 'Proyecto creado', user: 'Ana Rodríguez', time: '19 feb 2025', paso: '' },
            ].map((entry, i) => (
              <div key={i} className="flex items-start gap-3 pt-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">{entry.action}</p>
                  <p className="text-xs text-slate-400">
                    {entry.user} · {entry.time}{entry.paso && ` · ${entry.paso}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Team Modal ── */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Equipo del proyecto</h3>
              <button onClick={() => setShowTeamModal(false)}>
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {project.team.map(member => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700" style={{ fontWeight: 700 }}>
                    {member.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{member.name}</p>
                    <p className="text-xs text-slate-400">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{member.role}</span>
                    <StatusChip status={member.status} size="sm" />
                  </div>
                </div>
              ))}
              {user?.role === 'owner' && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Invitar por correo…"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button className="bg-indigo-600 text-white rounded-xl px-3 py-2 hover:bg-indigo-700 transition-colors">
                      <UserPlus size={15} />
                    </button>
                  </div>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                <span style={{ fontWeight: 600 }}>Acceso a evidencias: </span>
                Solo los miembros activos pueden ver las evidencias del proyecto.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mentor Support Modal ── */}
      {showMentorModal && (
        <MentorSupportModal
          onClose={() => setShowMentorModal(false)}
          context={mentorModalContext}
          mentorCredits={project.mentorCredits ?? 3}
          onOpenIA={() => { setShowMentorModal(false); openIA(mentorModalContext); }}
        />
      )}

      {/* ── IA Panel ── */}
      <MentorVirtualPanel
        open={showIAPanel}
        onClose={() => setShowIAPanel(false)}
        context={iaPanelContext}
      />
    </div>
  );
}
