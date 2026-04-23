import React from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';

function extractErrorDetails(error: unknown): { title: string; detail: string; stack?: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText || 'Error'}`,
      detail: typeof error.data === 'string' ? error.data : 'La ruta no pudo cargarse.',
    };
  }
  if (error instanceof Error) {
    return { title: 'Ocurrió un error inesperado', detail: error.message, stack: error.stack };
  }
  return { title: 'Ocurrió un error inesperado', detail: 'No pudimos renderizar esta vista.' };
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { title, detail, stack } = extractErrorDetails(error);
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg text-slate-900" style={{ fontWeight: 700 }}>{title}</h1>
            <p className="mt-1 text-sm text-slate-600 break-words">{detail}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => { window.location.reload(); }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <RefreshCcw size={14} /> Reintentar
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Home size={14} /> Ir al dashboard
          </button>
        </div>

        {isDev && stack ? (
          <pre className="mt-5 max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100 whitespace-pre-wrap">
            {stack}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
