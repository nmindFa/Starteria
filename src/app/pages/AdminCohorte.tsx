import React, { useState } from 'react';
import { Download, BarChart3, AlertTriangle, CheckCircle2, TrendingDown, Users, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const FUNNEL_DATA = [
  { step: 'Step 1', total: 18, completed: 14, label: 'Claridad' },
  { step: 'Step 2', total: 14, completed: 10, label: 'Diseño' },
  { step: 'Step 3', total: 10, completed: 6, label: 'Prueba' },
  { step: 'Step 4', total: 6, completed: 3, label: 'Historia' },
];

const MOCK_PROJECTS_ADMIN = [
  { id: 'p1', name: 'Onboarding Digital', team: 'Ana R. + Miguel T.', step: 1, status: 'En progreso', risk: 'Medio', lastActivity: 'Hoy', blocked: true },
  { id: 'p2', name: 'Portal de Reportes', team: 'Pedro A. + Claudia R.', step: 2, status: 'Sesión experto pendiente', risk: 'Bajo', lastActivity: 'Ayer', blocked: false },
  { id: 'p3', name: 'Cierre Contable', team: 'Ana R.', step: 1, status: 'Draft', risk: 'Alto', lastActivity: 'Hoy', blocked: false },
  { id: 'p4', name: 'Gestión de Proveedores', team: 'Carlos V. + Marta S.', step: 3, status: 'Sesión experto pendiente', risk: 'Bajo', lastActivity: 'Hace 2 días', blocked: false },
  { id: 'p5', name: 'Automatización Facturación', team: 'Ricardo L.', step: 2, status: 'En revisión IA', risk: 'Medio', lastActivity: 'Hace 3 días', blocked: false },
  { id: 'p6', name: 'Onboarding Clientes', team: 'Daniela P. + Roberto G.', step: 4, status: 'Step aprobado', risk: 'Bajo', lastActivity: 'Hace 1 semana', blocked: false },
];

export function AdminCohorte() {
  const { user } = useApp();
  const [filter, setFilter] = useState<'all' | 'riesgo' | 'bloqueados'>('all');
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    setExportLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setExportLoading(false);
    alert('CSV exportado correctamente. (Demo: no hay descarga real en este prototipo)');
  };

  const filtered = MOCK_PROJECTS_ADMIN.filter(p => {
    if (filter === 'riesgo') return p.risk === 'Alto' || p.risk === 'Medio';
    if (filter === 'bloqueados') return p.blocked;
    return true;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Panel de cohorte</h1>
          <p className="text-sm text-slate-500">Cohorte 2025-A · {MOCK_PROJECTS_ADMIN.length} proyectos activos</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exportLoading}
          className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm transition-colors"
          style={{ fontWeight: 500 }}
        >
          <Download size={15} /> {exportLoading ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Proyectos activos', value: 18, icon: <BarChart3 size={16} className="text-indigo-500" />, color: 'text-indigo-600' },
          { label: 'Con riesgo alto', value: 3, icon: <AlertTriangle size={16} className="text-red-500" />, color: 'text-red-600' },
          { label: 'Steps aprobados', value: 24, icon: <CheckCircle2 size={16} className="text-emerald-500" />, color: 'text-emerald-600' },
          { label: 'Sesiones pendientes', value: 5, icon: <Users size={16} className="text-amber-500" />, color: 'text-amber-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">{kpi.icon}<p className="text-xs text-slate-500">{kpi.label}</p></div>
            <p className={`text-2xl ${kpi.color}`} style={{ fontWeight: 700 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base text-slate-900" style={{ fontWeight: 600 }}>Funnel por Step</h2>
          <BannerPorDefinir title="Detalle de reportes de cohorte" question="¿Qué métricas adicionales debe incluir el panel de admin? ¿Tiempo promedio por Step, tasa de aprobación por mentor, comparación entre cohortes?" />
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={FUNNEL_DATA} barCategoryGap="35%">
            <XAxis dataKey="step" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value, name) => [value, name === 'total' ? 'Total' : 'Completados']} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Bar dataKey="total" fill="#E0E7FF" radius={[6,6,0,0]} />
            <Bar dataKey="completed" fill="#4F46E5" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-indigo-100" />Total en step</span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-indigo-600" />Step aprobado</span>
        </div>
      </div>

      {/* Project list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base text-slate-900" style={{ fontWeight: 600 }}>Todos los proyectos</h2>
          <div className="flex gap-2">
            {(['all', 'riesgo', 'bloqueados'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: filter === f ? 600 : 400 }}>
                {f === 'all' ? 'Todos' : f === 'riesgo' ? 'Con riesgo' : 'Bloqueados'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['Proyecto', 'Equipo', 'Step', 'Estado', 'Riesgo', 'Últ. actividad', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400" style={{ fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.blocked && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                      <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{p.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.team}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center" style={{ fontWeight: 700 }}>{p.step}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusChip status={p.status} size="sm" /></td>
                  <td className="px-4 py-3"><StatusChip status={p.risk} size="sm" /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{p.lastActivity}</td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
