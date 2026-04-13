import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';

export function PortfolioLeadBreadcrumbs({
  items,
}: {
  items: Array<{ label: string; path?: string }>;
}) {
  const navigate = useNavigate();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <ChevronRight size={12} className="text-slate-400" /> : null}
          {item.path ? (
            <button
              onClick={() => navigate(item.path!)}
              className="transition-colors hover:text-slate-900"
              style={{ fontWeight: 600 }}
            >
              {item.label}
            </button>
          ) : (
            <span className="text-slate-700" style={{ fontWeight: 700 }}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function PortfolioLeadContextStrip({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map(item => (
        <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{item.label}</p>
          <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function PortfolioLeadEmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-[#faf8f2] px-6 py-10">
      <p className="text-lg text-slate-900" style={{ fontWeight: 700 }}>{title}</p>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={primaryAction.onClick}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
          style={{ fontWeight: 600 }}
        >
          {primaryAction.label}
        </button>
        {secondaryAction ? (
          <button
            onClick={secondaryAction.onClick}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            style={{ fontWeight: 600 }}
          >
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
