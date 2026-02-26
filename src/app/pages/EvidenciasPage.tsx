import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText, Image, Film, Link2, CheckCircle2, XCircle, Clock, Filter, Download, History, AlertCircle, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { EvidenceUploader } from '../components/EvidenceUploader';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import type { Evidence } from '../context/AppContext';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PDF: <FileText size={16} className="text-red-500" />,
  Imagen: <Image size={16} className="text-blue-500" />,
  Video: <Film size={16} className="text-purple-500" />,
  Link: <Link2 size={16} className="text-indigo-500" />,
  Otro: <FileText size={16} className="text-slate-400" />,
};

export function EvidenciasPage() {
  const { projectId } = useParams();
  const { projects, updateProject } = useApp();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === projectId);

  const [filterStep, setFilterStep] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string | 'all'>('all');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [showAudit, setShowAudit] = useState<string | null>(null);

  if (!project) return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;

  const filtered = project.evidence.filter(e => {
    if (filterStep !== 'all' && e.stepRef !== filterStep) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  const handleUpload = (file: { name: string; type: string; size?: string; url?: string }) => {
    const newEvidence: Evidence = {
      id: `e${Date.now()}`,
      name: file.name,
      type: file.type as Evidence['type'],
      size: file.size,
      url: file.url,
      stepRef: 1,
      owner: 'Ana Rodríguez',
      date: new Date().toISOString().split('T')[0],
      status: 'Subida',
    };
    updateProject(project.id, { evidence: [...project.evidence, newEvidence] });
  };

  const AUDIT_LOG: Record<string, { action: string; user: string; time: string }[]> = {
    'e1': [
      { action: 'Verificada por mentor', user: 'Carlos Méndez', time: '17 feb 2025, 11:00' },
      { action: 'Subida', user: 'Ana Rodríguez', time: '15 feb 2025, 09:30' },
    ],
    'e2': [{ action: 'Subida', user: 'Miguel Torres', time: '17 feb 2025, 15:45' }],
    'e3': [
      { action: 'Verificada por mentor', user: 'Carlos Méndez', time: '19 feb 2025, 08:00' },
      { action: 'Subida', user: 'Ana Rodríguez', time: '18 feb 2025, 14:00' },
    ],
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/projects/${project.id}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-slate-500">{project.name}</p>
          <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Repositorio de evidencias</h1>
        </div>
        <button onClick={() => setShowUploader(!showUploader)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm transition-colors" style={{ fontWeight: 500 }}>
          <Plus size={15} /> Subir evidencia
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: project.evidence.length, color: 'text-slate-700' },
          { label: 'Verificadas', value: project.evidence.filter(e => e.status === 'Verificada').length, color: 'text-emerald-600' },
          { label: 'Pendientes', value: project.evidence.filter(e => e.status === 'Subida').length, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-2xl ${s.color}`} style={{ fontWeight: 700 }}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Uploader */}
      {showUploader && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Subir nueva evidencia</p>
          </div>
          <EvidenceUploader onUpload={handleUpload} />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Step relacionado</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>Step 1 · Claridad en el desafío</option>
                <option>Step 2 · Diseñar solución</option>
                <option>Step 3 · Probar en pequeño</option>
                <option>Step 4 · Contar una historia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Módulo (opcional)</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>Módulo A</option>
                <option>Módulo B</option>
                <option>Módulo C</option>
                <option>Módulo D</option>
                <option>Síntesis</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-slate-400" />
          <span className="text-xs text-slate-500">Filtrar por:</span>
        </div>
        {(['all', 1, 2, 3, 4] as const).map(s => (
          <button key={s} onClick={() => setFilterStep(s)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterStep === s ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: filterStep === s ? 600 : 400 }}>
            {s === 'all' ? 'Todos' : `Step ${s}`}
          </button>
        ))}
        <span className="text-slate-200">|</span>
        {(['all', 'Subida', 'Verificada', 'Rechazada'] as const).map(st => (
          <button key={st} onClick={() => setFilterStatus(st)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterStatus === st ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: filterStatus === st ? 600 : 400 }}>
            {st === 'all' ? 'Todos los estados' : st}
          </button>
        ))}
      </div>

      {/* Evidence list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-slate-500 mb-2">No hay evidencias con ese filtro.</p>
          <button onClick={() => setShowUploader(true)} className="text-indigo-600 text-sm" style={{ fontWeight: 500 }}>Subir primera evidencia</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ev => (
            <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  {TYPE_ICONS[ev.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-800 truncate" style={{ fontWeight: 500 }}>{ev.name}</p>
                    <StatusChip status={ev.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>Step {ev.stepRef}{ev.moduleRef ? ` · Módulo ${ev.moduleRef}` : ''}</span>
                    {ev.size && <span>{ev.size}</span>}
                    <span>{ev.owner}</span>
                    <span>{ev.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setShowAudit(showAudit === ev.id ? null : ev.id)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Ver historial">
                    <History size={14} className="text-slate-400" />
                  </button>
                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Descargar">
                    <Download size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Audit log */}
              {showAudit === ev.id && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>HISTORIAL DE CAMBIOS</p>
                  <div className="space-y-2">
                    {(AUDIT_LOG[ev.id] ?? [{ action: 'Subida', user: ev.owner, time: ev.date }]).map((log, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                        <span>{log.action}</span>
                        <span className="text-slate-400">· {log.user} · {log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <BannerPorDefinir
          title="Comportamiento de eliminación de evidencias"
          question="¿Qué pasa cuando se elimina una evidencia: se elimina permanentemente, se archiva o se marca como 'inactiva'? ¿Quién puede eliminar: solo el owner o también el mentor?"
          context="missing"
        />
      </div>

      <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
        <span style={{ fontWeight: 600 }}>Acceso restringido: </span>
        Solo los miembros activos del proyecto pueden ver y descargar estas evidencias. Si alguien sale del equipo, pierde acceso automáticamente.
      </div>
    </div>
  );
}
