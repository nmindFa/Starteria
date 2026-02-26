import React from 'react';
import { ChevronDown } from 'lucide-react';

export function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{title}</p>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default CollapsibleSection;
