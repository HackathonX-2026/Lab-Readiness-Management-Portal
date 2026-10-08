import type { ReactNode } from 'react';
import { ArrowUpRight, FolderOpen } from 'lucide-react';

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
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const toneClass = {
    default: 'text-foreground',
    good: 'text-success',
    warn: 'text-warning',
    bad: 'text-danger',
    info: 'text-info'
  }[tone];
  const iconClass = {
    default: 'bg-primary-soft text-accent ring-primary/25',
    good: 'bg-success/10 text-success ring-success/25',
    warn: 'bg-warning/10 text-warning ring-warning/25',
    bad: 'bg-danger/10 text-danger ring-danger/25',
    info: 'bg-info/10 text-info ring-info/25'
  }[tone];
  const clickable = !!onClick;
  const Cmp = clickable ? 'button' : 'div';
  return (
    <Cmp
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`card group w-full p-5 text-left ${
        clickable ? 'cursor-pointer transition-colors hover:border-ring' : ''
      }`}
    >
      <div className="flex min-h-9 items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase leading-relaxed tracking-wider text-muted">{label}</div>
        {icon && <div aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 [&>svg]:h-3.5 [&>svg]:w-3.5 ${iconClass}`}>{icon}</div>}
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
      {clickable && <div className="mt-3 flex items-center gap-1 text-[11px] text-muted group-hover:text-accent">View labs <ArrowUpRight size={12} aria-hidden="true" /></div>}
    </Cmp>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center text-muted">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-subtle"><FolderOpen size={20} aria-hidden="true" /></div>
      <div className="font-medium text-foreground">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}
