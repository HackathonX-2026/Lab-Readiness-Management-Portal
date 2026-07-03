import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  onClick
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'info';
  icon?: string;
  onClick?: () => void;
}) {
  const toneClass = {
    default: 'bg-white dark:bg-slate-900',
    good: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900',
    warn: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900',
    bad: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900',
    info: 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900'
  }[tone];
  const clickable = !!onClick;
  const Cmp: any = clickable ? 'button' : 'div';
  return (
    <Cmp
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`card p-4 text-left w-full ${toneClass} ${
        clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-brand-400 transition' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
        {icon && <div className="text-xl">{icon}</div>}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
      {clickable && <div className="mt-2 text-[11px] text-brand-600 font-semibold">View labs →</div>}
    </Cmp>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center text-slate-500 dark:text-slate-400">
      <div className="text-2xl mb-2">🗂️</div>
      <div className="font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}
