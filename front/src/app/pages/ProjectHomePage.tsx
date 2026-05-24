import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Lock, CheckCircle2, ChevronRight, Users, AlertTriangle,
  FileText, Clock, History, X, ChevronDown, UserPlus,
  Sparkles, Calendar, MessageSquare, ClipboardList,
} from 'lucide-react';
import { createTeamMember, useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { MentorSupportModal } from '../components/MentorSupportModal';
import { MentorVirtualPanel } from '../components/MentorVirtualPanel';
import { PdfInitiativeUploader } from '../components/PdfInitiativeUploader';
import { usePdfAutofill } from '../hooks/usePdfAutofill';
import { isPdfAutofillEnabled } from '../services/featureFlags';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

const TOUCHPOINT_LABELS = {
  step0: 'Step 0 · Alineamiento inicial',
  step2: 'Cierre Step 2 · Revisión estratégica',
  step4: 'Step 4 · Presentación final',
} as const;

const INTRO_STEP_SUMMARY = [
  { number: '0', title: 'Punto de partida', description: 'Ordena el contexto inicial.' },
  { number: '1', title: 'Claridad en el desafío', description: 'Entiende mejor el problema.' },
  { number: '2', title: 'Diseñar solución', description: 'Explora opciones y define una prueba.' },
  { number: '3', title: 'Probar en pequeño', description: 'Valida con evidencia antes de escalar.' },
  { number: '4', title: 'Presentar propuesta', description: 'Organiza aprendizajes y sustenta mejor.' },
] as const;

export function ProjectHomePage() {
  const { projectId } = useParams();
  const { projects, setCurrentProject, user, updateProject, getProjectMember, canAccessProject, markSponsorInvitationSent, acceptSponsorInvitation, updateSponsorTouchpoint, addSponsorComment } = useApp();
  const navigate = useNavigate();
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorModalContext, setMentorModalContext] = useState('');
  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaPanelContext, setIaPanelContext] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [alignmentCopied, setAlignmentCopied] = useState(false);

  const project = projects.find(p => p.id === projectId);
  if (!project) return (
    <div className="p-6 text-center">
      <p className="text-slate-500">Proyecto no encontrado.</p>
      <button onClick={() => navigate('/dashboard')} className="text-indigo-600 text-sm mt-2">← Volver al inicio</button>
    </div>
  );

  const projectMember = getProjectMember(project.id, user?.email);
  const isSponsorViewer = user?.role === 'sponsor';
  const sponsorInvitationSent = projectMember?.role === 'Sponsor' && projectMember.status === 'Enviado';
  const sponsorInvitationActive = projectMember?.role === 'Sponsor' && projectMember.status === 'Activo';

  if (!canAccessProject(project.id, 'overview')) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Acceso no habilitado</p>
          <p className="text-sm text-amber-700 mt-1">
            Esta iniciativa aún no está habilitada para tu perfil sponsor. Pide que envíen la invitación o vuelve cuando tu acceso sea aceptado.
          </p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 transition-colors">
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  // PDF auto-fill (PRD-002 / TASK-009). Hook is safe to call unconditionally — if the
  // feature flag is off, the card below doesn't render but the hook state stays inert.
  const autofillEnabled = isPdfAutofillEnabled();
  const autofill = usePdfAutofill(project.id);
  // Explicit "Procesar con IA" button instead of auto-triggering on upload.
  const [uploadedPdfIds, setUploadedPdfIds] = useState<string[]>([]);

  const sponsorTouchpoints = project.sponsorTouchpoints ?? [];
  const sponsorComments = project.sponsorComments ?? [];
  const sponsorProgress = Math.round(
    (project.steps.reduce((acc, step) => acc + step.progress, 0) + (project.step0Status === 'Completado' ? 100 : project.step0Status === 'En progreso' ? 50 : 0)) /
      (project.steps.length + 1)
  );

  if (isSponsorViewer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Volver a iniciativas con sponsor
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusChip status={project.status} size="sm" />
                {projectMember?.role === 'Sponsor' && <StatusChip status={projectMember.status} size="sm" />}
              </div>
              <h1 className="text-2xl text-slate-900" style={{ fontWeight: 700 }}>{project.name}</h1>
              {project.description && <p className="text-sm text-slate-500 mt-1">{project.description}</p>}
            </div>
            <div className="min-w-[180px] rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="text-xs text-indigo-700" style={{ fontWeight: 600 }}>Progreso visible</p>
              <p className="text-2xl text-indigo-900 mt-1" style={{ fontWeight: 700 }}>{sponsorProgress}%</p>
              <p className="text-xs text-indigo-700 mt-1">Seguimiento ejecutivo de la iniciativa</p>
            </div>
          </div>

          {sponsorInvitationSent && (
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>Invitación lista para aceptar</p>
              <p className="text-xs text-indigo-700 mt-1">
                El equipo ya te convocó formalmente dentro de Startería. Acepta el acceso para dejar trazabilidad del seguimiento.
              </p>
              <button
                onClick={() => acceptSponsorInvitation(project.id)}
                className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
                style={{ fontWeight: 600 }}
              >
                Aceptar acceso sponsor
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className="text-indigo-600" />
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Alertas del sponsor</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Aquí ves qué iniciativa requiere atención, en qué hito ocurre y qué acción te toca tomar.
            </p>

            <div className="space-y-3">
              {sponsorTouchpoints.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{item.stageLabel} · {item.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.date ? `Fecha registrada: ${item.date}` : 'Sin fecha confirmada'} · Acción: {item.actionLabel}
                      </p>
                    </div>
                    <StatusChip status={item.status} size="sm" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setCommentDrafts(prev => ({ ...prev, [item.id]: prev[item.id] ?? '' }))}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-white transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Dejar comentario
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={16} className="text-indigo-600" />
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Comentarios del sponsor</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Tus comentarios quedan asociados al hito correspondiente para que el equipo entienda el contexto y la siguiente acción.
            </p>

            <div className="space-y-4">
              {sponsorTouchpoints.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{item.stageLabel} · {item.title}</p>
                  <div className="space-y-2 mt-3">
                    {sponsorComments.filter(comment => comment.touchpointId === item.id).map(comment => (
                      <div key={comment.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{comment.authorName} · {comment.createdAt}</p>
                        <p className="text-xs text-slate-600 mt-1">{comment.message}</p>
                      </div>
                    ))}
                    {sponsorComments.filter(comment => comment.touchpointId === item.id).length === 0 && (
                      <p className="text-xs text-slate-400">Todavía no dejaste comentarios en este hito.</p>
                    )}
                  </div>
                  <textarea
                    value={commentDrafts[item.id] ?? ''}
                    onChange={event => setCommentDrafts(prev => ({ ...prev, [item.id]: event.target.value }))}
                    placeholder={`Escribe tu comentario para ${TOUCHPOINT_LABELS[item.id]}.`}
                    rows={3}
                    className="mt-3 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        addSponsorComment(project.id, item.id, commentDrafts[item.id] ?? '');
                        setCommentDrafts(prev => ({ ...prev, [item.id]: '' }));
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Enviar comentario
                    </button>
                    <button
                      onClick={() => setCommentDrafts(prev => ({ ...prev, [item.id]: '' }))}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-white transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Access logic ──────────────────────────────────────────────────────────

  const canAccessStep = (stepNum: number) => {
    if (isSponsorViewer) return false;
    if (stepNum === 1) return project.step0Status === 'Completado';
    const prevStep = project.steps.find(s => s.number === stepNum - 1);
    return prevStep?.status === 'Aprobado';
  };

  const handleStepClick = (step: Step) => {
    if (isSponsorViewer) return;
    if (!canAccessStep(step.number)) return;
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
  const sponsorMembers = project.team.filter(member => member.role === 'Sponsor');
  const sponsorSlotsLeft = Math.max(0, 2 - sponsorMembers.length);
  const canManageSponsors = user?.role === 'owner' || user?.role === 'admin';
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const step0Complete = project.step0Status === 'Completado';
  const step0Data = project.step0Data;
  const step0ContactHint = project.step0Data?.quienEscuchar?.trim() ?? '';
  const step0Touchpoint = (project.sponsorTouchpoints ?? []).find(item => item.id === 'step0');
  const primarySponsorMember = sponsorMembers[0];
  const step0ActionLabel =
    step0Complete
      ? 'Ver Paso 0'
      : project.step0Status === 'En progreso'
        ? 'Continuar Paso 0'
        : 'Empezar Paso 0';
  const alignmentState =
    !step0Complete
      ? 'Pendiente de base inicial'
      : step0Touchpoint?.status === 'Cerrado'
        ? 'Reunión realizada'
        : sponsorMembers.some(member => member.status === 'Enviado')
          ? 'Invitación enviada'
          : sponsorMembers.some(member => member.status === 'Pendiente')
            ? 'Invitación pendiente'
            : sponsorMembers.some(member => member.status === 'Activo') || !!step0ContactHint
              ? 'Destinatario definido'
              : 'Sin destinatario definido';
  const nextActionLabel = !step0Complete
    ? 'Empezar Paso 0'
    : alignmentState === 'Sin destinatario definido'
      ? 'Definir contacto de alineación'
      : 'Continuar con alineación';
  const sponsorSummaryLabel =
    sponsorMembers.length === 0
      ? 'Sin sponsor definido'
      : sponsorMembers.length === 1
        ? '1 sponsor asignado'
        : `${sponsorMembers.length} sponsors asignados`;
  const step0SummaryChips = [
    step0Data?.origen ? 'Origen definido' : null,
    (step0Data?.impacta?.length ?? 0) > 0 ? `Impacta a ${step0Data?.impacta?.slice(0, 2).join(', ')}` : null,
    step0Data?.impacto3meses ? 'Impacto principal identificado' : null,
    (step0Data?.siMinimo?.length ?? 0) > 0 ? 'Apoyo mínimo definido' : null,
  ].filter(Boolean) as string[];
  const alignmentMessage = [
    `Proyecto: ${project.name}`,
    step0Data?.quePasaQueQuieres ? `Qué está pasando: ${step0Data.quePasaQueQuieres}` : null,
    (step0Data?.impacta?.length ?? 0) > 0 ? `A quién impacta: ${step0Data?.impacta?.join(', ')}` : null,
    step0Data?.impacto3meses ? `Impacto principal: ${step0Data.impacto3meses}` : null,
    (step0Data?.siMinimo?.length ?? 0) > 0 ? `Apoyo mínimo: ${step0Data?.siMinimo?.join(', ')}` : null,
    step0ContactHint ? `Contacto clave sugerido: ${step0ContactHint}` : null,
  ].filter(Boolean).join('\n');
  const addSponsor = () => {
    const email = sponsorEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSponsorError('Ingresa un correo vÃ¡lido para el sponsor.');
      return;
    }
    if (sponsorMembers.length >= 2) {
      setSponsorError('Esta iniciativa ya tiene el mÃ¡ximo de 2 sponsors.');
      return;
    }
    if (project.team.some(member => member.email.toLowerCase() === email)) {
      setSponsorError('Ese correo ya forma parte de la iniciativa.');
      return;
    }

    updateProject(project.id, { team: [...project.team, createTeamMember(email, 'Sponsor', 'Pendiente')] });
    setSponsorEmail('');
    setSponsorError(null);
  };

  const openStep0 = () => {
    setCurrentProject(project);
    navigate(`/projects/${project.id}/step/0`);
  };

  const openAlignmentSection = () => {
    document.getElementById('alignment-next')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePrimaryAction = () => {
    if (!step0Complete) {
      openStep0();
      return;
    }
    openAlignmentSection();
  };

  const copyAlignmentSummary = async () => {
    await navigator.clipboard.writeText(alignmentMessage);
    setAlignmentCopied(true);
    window.setTimeout(() => setAlignmentCopied(false), 2000);
  };

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
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
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
          {!isSponsorViewer && (
            <button
              onClick={() => navigate(`/projects/${project.id}/evidencias`)}
              className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <FileText size={14} /> Evidencias
            </button>
          )}
          <button
            onClick={() => setShowTeamModal(true)}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm transition-colors"
          >
            <Users size={14} /> Equipo
          </button>
        </div>
      </div>

      {isSponsorViewer && (
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>Vista de seguimiento sponsor</p>
          <p className="text-xs text-indigo-700 mt-1">
            Aquí puedes seguir hitos, estado general y convocatorias. El contenido operativo de steps y evidencias queda protegido para este rol.
          </p>
          {sponsorInvitationSent && (
            <button
              onClick={() => acceptSponsorInvitation(project.id)}
              className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
              style={{ fontWeight: 600 }}
            >
              Aceptar acceso sponsor
            </button>
          )}
          {sponsorInvitationActive && (
            <p className="mt-3 text-xs text-indigo-700">Tu acceso sponsor ya está activo para esta iniciativa.</p>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="rounded-full bg-white px-3 py-1 text-xs text-indigo-700 border border-indigo-100" style={{ fontWeight: 600 }}>
            {step0Complete
              ? firstName ? `${firstName}, Paso 0 listo` : 'Paso 0 listo'
              : firstName ? `${firstName}, bienvenida a tu iniciativa` : 'Bienvenida a tu iniciativa'}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 border border-slate-200" style={{ fontWeight: 600 }}>
            {step0Complete ? 'Siguiente hito: alineación' : overallProgress > 0 ? `${overallProgress}% de avance` : 'Primer ingreso'}
          </span>
        </div>
        <h2 className="text-2xl text-slate-900 max-w-3xl" style={{ fontWeight: 700 }}>
          {step0Complete
            ? 'Ya tienes una base inicial. Ahora toca alinearla con la persona clave y continuar con el Paso 1.'
            : 'Convierte este proyecto en una iniciativa clara, probada y lista para presentar.'}
        </h2>
        <p className="text-sm text-slate-600 mt-3 max-w-3xl">
          {step0Complete
            ? 'Ordenaste el contexto inicial, identificaste impacto y definiste el apoyo mínimo para mover la iniciativa. El siguiente hito es compartir esta base para destrabar el tramo que sigue.'
            : 'Aquí vas a ordenar el contexto, diseñar una solución, probarla en pequeño y preparar una propuesta con mayor claridad. No necesitas tener todo resuelto desde el inicio.'}
        </p>
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={handlePrimaryAction}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm text-white hover:bg-indigo-700 transition-colors"
            style={{ fontWeight: 600 }}
          >
            <ClipboardList size={16} /> {nextActionLabel}
          </button>
          <button
            onClick={() => document.getElementById('project-journey')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            style={{ fontWeight: 600 }}
          >
            <ChevronDown size={16} /> {step0Complete ? 'Ver recorrido' : 'Ver cómo funciona'}
          </button>
        </div>
      </div>

      {/* ─── PDF auto-fill (PRD-002 / SPEC-002) — gated by feature flag ─── */}
      {autofillEnabled && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                ¿Tienes un documento de tu iniciativa?
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                Sube un PDF (plan, propuesta, deck, investigación) y un agente IA
                intentará rellenar los campos de los Pasos 0–4 con tu evidencia.
                Tú revisas y confirmas cada campo antes de avanzar.
              </p>
            </div>
          </div>

          <PdfInitiativeUploader
            initiativeId={project.id}
            onUploadComplete={(pdfId) => {
              setUploadedPdfIds((prev) => (prev.includes(pdfId) ? prev : [...prev, pdfId]));
            }}
          />

          {uploadedPdfIds.length > 0 && autofill.status === 'idle' && (
            <button
              type="button"
              onClick={() => {
                const lastPdfId = uploadedPdfIds[uploadedPdfIds.length - 1];
                void autofill.startExtraction(lastPdfId, 'all');
              }}
              className="mt-3 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm transition-colors"
              style={{ fontWeight: 600 }}
              data-testid="autofill-process-button"
            >
              <Sparkles size={16} />
              Procesar con IA y rellenar Pasos
            </button>
          )}

          {autofill.status === 'running' && (
            <p className="mt-3 text-xs text-amber-700 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Extrayendo evidencia del PDF… (~30s)
            </p>
          )}
          {autofill.status === 'done' && (
            <p className="mt-3 text-xs text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              Listo: {autofill.proposals.length} campo(s) propuesto(s). Entra al Paso 0 para revisarlos.
            </p>
          )}
          {autofill.status === 'failed' && autofill.error && (
            <p className="mt-3 text-xs text-rose-700 flex items-center gap-1.5">
              <AlertCircle size={12} />
              {autofill.error.message}
            </p>
          )}
        </div>
      )}

      <div id="project-journey" className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Recorrido del proyecto</h2>
            <p className="text-xs text-slate-500 mt-1">
              {step0Complete
                ? 'Ya completaste el Paso 0. Ahora toca alinear esta base con la persona clave y continuar con el Paso 1.'
                : 'Empieza aquí. Completa el Paso 0 para desbloquear el Paso 1 y seguir avanzando por el recorrido completo.'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${step0Complete ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`} style={{ fontWeight: 600 }}>
            {step0Complete ? 'Paso 0 completado' : 'Empieza aquí'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {INTRO_STEP_SUMMARY.map(step => (
            <div
              key={step.number}
              className={`rounded-2xl border p-4 ${
                step0Complete && step.number === '0'
                  ? 'border-emerald-200 bg-emerald-50'
                  : step0Complete && step.number === '1'
                  ? 'border-indigo-200 bg-indigo-50'
                  : step.number === '0'
                    ? 'border-indigo-200 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                    step0Complete && step.number === '0'
                      ? 'bg-emerald-600 text-white'
                      : step0Complete && step.number === '1'
                        ? 'bg-indigo-600 text-white'
                      : step.number === '0'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                  style={{ fontWeight: 700 }}
                >
                  {step.number}
                </span>
                {step0Complete && step.number === '0' && (
                  <span className="text-[11px] text-emerald-700" style={{ fontWeight: 700 }}>Completado</span>
                )}
                {step0Complete && step.number === '1' && (
                  <span className="text-[11px] text-indigo-700" style={{ fontWeight: 700 }}>Siguiente</span>
                )}
                {!step0Complete && step.number === '0' && (
                  <span className="text-[11px] text-indigo-700" style={{ fontWeight: 700 }}>Empieza aquí</span>
                )}
              </div>
              <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{step.title}</p>
              <p className="text-xs text-slate-500 mt-1">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 mb-6">
        <div className={`bg-white rounded-2xl border p-5 ${step0Complete ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-indigo-200 ring-1 ring-indigo-100'}`}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`px-2.5 py-1 text-xs rounded-full ${step0Complete ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`} style={{ fontWeight: 700 }}>
              {step0Complete ? 'Paso 0 completado' : 'Comienza aquí'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500" style={{ fontWeight: 600 }}>
              {project.step0Status}
            </span>
          </div>
          <h2 className="text-lg text-slate-900" style={{ fontWeight: 700 }}>
            {step0Complete ? 'Ya tienes una base inicial de tu iniciativa' : 'Paso 0: Punto de partida'}
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {step0Complete
              ? 'Ordenaste el contexto inicial, identificaste impacto y definiste el apoyo mínimo para moverla.'
              : 'En 5–7 minutos vas a ordenar el contexto inicial de tu iniciativa. Esto te ayudará a avanzar con claridad y desbloquear el Paso 1.'}
          </p>

          {step0Complete ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {step0SummaryChips.map(chip => (
                <span key={chip} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>
                  {chip}
                </span>
              ))}
              {step0ContactHint && (
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 border border-slate-200" style={{ fontWeight: 600 }}>
                  Contacto clave: {step0ContactHint}
                </span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {[
                'qué quieres abordar',
                'por qué importa',
                'a quién impacta',
                'qué evidencia ya tienes',
              ].map(item => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{item}</p>
                </div>
              ))}
            </div>
          )}

          {!step0Complete && (
            <button
              onClick={openStep0}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm text-white hover:bg-indigo-700 transition-colors"
              style={{ fontWeight: 600 }}
            >
              <ClipboardList size={16} /> Empezar Paso 0
            </button>
          )}
        </div>

        <div id="alignment-next" className={`bg-white rounded-2xl border p-5 ${step0Complete ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                {step0Complete ? 'Siguiente hito: alineación' : 'Sponsor'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {step0Complete
                  ? 'El Paso 0 ya te da una base suficiente para compartir la iniciativa y destrabar el siguiente tramo.'
                  : 'Es la persona que acompaña momentos clave del proyecto y ayuda a darle respaldo.'}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${step0Complete ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`} style={{ fontWeight: 600 }}>
              {step0Complete ? alignmentState : sponsorSummaryLabel}
            </span>
          </div>

          {step0Complete ? (
            <>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>
                  {alignmentState === 'Sin destinatario definido' && 'Todavía falta definir a quién compartirle esta base.'}
                  {alignmentState === 'Destinatario definido' && 'Ya tienes una persona clave identificada para abrir esta conversación.'}
                  {alignmentState === 'Invitación pendiente' && 'Tienes un destinatario listo, pero aún falta registrar el envío de la invitación de alineación.'}
                  {alignmentState === 'Invitación enviada' && 'La invitación ya fue enviada. El siguiente paso es registrar cuando ocurra la alineación.'}
                  {alignmentState === 'Reunión realizada' && 'La alineación inicial ya quedó registrada. Ahora puedes continuar con el Paso 1 con mejor contexto compartido.'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {step0ContactHint
                    ? `Contacto clave definido en Paso 0: ${step0ContactHint}`
                    : sponsorMembers.length > 0
                      ? 'Puedes usar el sponsor ya asignado como base para esta conversación.'
                      : 'Si no tienes sponsor aún, deja explícito quién debería escuchar esto primero y registra la alineación cuando ocurra.'}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={copyAlignmentSummary}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  <ClipboardList size={15} /> {alignmentCopied ? 'Resumen copiado' : 'Compartir iniciativa con sponsor'}
                </button>
                {canManageSponsors && primarySponsorMember?.status === 'Pendiente' && (
                  <button
                    onClick={() => markSponsorInvitationSent(project.id, primarySponsorMember.email)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    Registrar invitación enviada
                  </button>
                )}
                {canManageSponsors && step0Touchpoint && step0Touchpoint.status !== 'Cerrado' && alignmentState !== 'Sin destinatario definido' && (
                  <button
                    onClick={() => updateSponsorTouchpoint(project.id, 'step0', { status: 'Cerrado' })}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    Registrar reunión realizada
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-3">
                No hay envío automático real desde esta vista. Este botón te ayuda a copiar una base clara para compartirla por tu canal habitual.
              </p>

              <details className="mt-4 group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 600 }}>
                  Ver detalle de alineación
                  <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-3">
                  {canManageSponsors && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>ASIGNAR SPONSOR</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={sponsorEmail}
                          onChange={event => { setSponsorEmail(event.target.value); setSponsorError(null); }}
                          onKeyDown={event => event.key === 'Enter' && addSponsor()}
                          placeholder="sponsor@empresa.com"
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={addSponsor}
                          disabled={sponsorSlotsLeft === 0}
                          className="bg-indigo-600 text-white rounded-xl px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <UserPlus size={15} />
                        </button>
                      </div>
                      {sponsorError && <p className="text-xs text-red-600 mt-2">{sponsorError}</p>}
                      {!sponsorError && sponsorSlotsLeft > 0 && (
                        <p className="text-xs text-slate-400 mt-2">
                          Si la persona ya tiene cuenta, verá esta iniciativa en su dashboard. Si no, quedará como invitación pendiente.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>
                No necesitas definirlo ahora.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Podrás hacerlo más adelante, cuando tengas mejor aterrizado el contexto.
              </p>
            </div>
          )}
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
          } ${isSponsorViewer ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:border-indigo-200 hover:shadow-sm'}`}
          onClick={() => {
            if (isSponsorViewer) return;
            openStep0();
          }}
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
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>
                      Empieza aquí
                    </span>
                  )}
                  {project.step0Status === 'Completado' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight: 600 }}>
                      Base lista
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {project.step0Status === 'Completado'
                    ? 'Ya dejaste una base inicial lista para compartir y usar como referencia antes de entrar al Paso 1.'
                    : 'Ordena el punto de partida en 5 a 7 minutos. Este paso te ayuda a entender qué estás moviendo, por qué importa y qué necesitas aclarar antes de seguir.'}
                </p>

                {project.step0Status !== 'Completado' && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 mb-3">
                    <p className="text-xs text-indigo-900" style={{ fontWeight: 600 }}>
                      Comienza por aquí y luego se desbloquea el Paso 1.
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      No necesitas tener todas las respuestas hoy. Solo deja una primera base clara para avanzar con menos fricción.
                    </p>
                    <button
                      onClick={event => {
                        event.stopPropagation();
                        openStep0();
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      <ClipboardList size={14} /> {step0ActionLabel}
                    </button>
                  </div>
                )}

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
          const isActive = step.status !== 'Aprobado' && step.status !== 'No iniciado' && step.status !== 'Bloqueado';
          const hasPendingSession = step.mentorSession?.status === 'Pendiente agendar';

          return (
            <div
              key={step.number}
              className={`bg-white rounded-2xl border transition-all ${
                accessible
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
                        <span>{BLOCK_REASONS[step.number.toString()]}</span>
                      </div>
                    )}

                    {/* Module pills */}
                    {accessible && (
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
                    {accessible && step.progress > 0 && (
                      <ProgressBar value={step.progress} size="sm" />
                    )}

                    {/* Mentor actions (accessible steps) */}
                    {accessible && (
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

                  {accessible && (
                    <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
                  )}
                </div>
              </div>

              {/* Blocked CTA */}
              {!accessible && (
                <div className="px-5 pb-4">
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
