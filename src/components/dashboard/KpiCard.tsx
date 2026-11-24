import React from 'react';

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'emerald' | 'amber' | 'rose' | 'blue';
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'default',
}: KpiCardProps) {
  const iconToneClass = {
    default: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-[#1D4ED8]',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {value}
          </p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconToneClass}`}>
          {icon}
        </div>
      </div>
      {subtitle && <p className="mt-2.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
