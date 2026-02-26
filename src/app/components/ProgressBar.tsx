import React from 'react';

interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  color?: 'indigo' | 'emerald' | 'amber' | 'red' | 'auto';
  label?: string;
}

export function ProgressBar({ value, showLabel = true, size = 'md', color = 'auto', label }: ProgressBarProps) {
  const getColor = () => {
    if (color !== 'auto') {
      const map = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };
      return map[color];
    }
    if (value === 100) return 'bg-emerald-500';
    if (value >= 50) return 'bg-indigo-500';
    if (value > 0) return 'bg-blue-500';
    return 'bg-slate-200';
  };

  const height = size === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-slate-500">{label}</span>}
          {showLabel && <span className="text-xs text-slate-500 ml-auto">{value}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
        <div
          className={`${height} rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
