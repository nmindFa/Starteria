import React from 'react';
import { Check, Loader2, Cloud } from 'lucide-react';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveIndicatorProps {
  state?: SaveState;
}

export function AutosaveIndicator({ state = 'saved' }: AutosaveIndicatorProps) {
  const config: Record<SaveState, { icon: React.ReactNode; text: string; color: string }> = {
    idle:   { icon: <Cloud size={13} />,        text: '',           color: 'text-slate-400' },
    saving: { icon: <Loader2 size={13} className="animate-spin" />, text: 'Guardando…', color: 'text-slate-400' },
    saved:  { icon: <Check size={13} />,         text: 'Guardado',   color: 'text-emerald-600' },
    error:  { icon: <Cloud size={13} />,          text: 'Error al guardar', color: 'text-red-500' },
  };

  if (state === 'idle') return null;
  const cfg = config[state] ?? config.saved;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.color}`}>
      {cfg.icon}
      {cfg.text}
    </span>
  );
}

// Re-export del hook real para compatibilidad con imports legacy
export { useAutosave } from '../hooks/useAutosave';
