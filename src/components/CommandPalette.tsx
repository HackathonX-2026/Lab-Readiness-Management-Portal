import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChartNoAxesCombined, CloudCog, FlaskConical, LayoutDashboard, LogOut, Moon, RefreshCw, Search, ShieldCheck, Sun, TriangleAlert, Users, UserCheck, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLabs } from '../state/LabsContext';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../state/ThemeContext';
import { useToast } from '../state/ToastContext';
import { useDialogFocus } from '../lib/useDialogFocus';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  section: 'Navigate' | 'Actions' | 'Labs';
  run: () => void;
  keywords?: string;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { labs } = useLabs();
  const { currentUser, logout } = useAuth();
  const { toggle: toggleTheme, theme } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
    }
  }, [open]);

  const commands: Command[] = useMemo(() => {
    const nav: Command[] = [
      { id: 'nav-dash', label: 'Executive Dashboard', icon: LayoutDashboard, section: 'Navigate', run: () => navigate('/') },
      { id: 'nav-inv', label: 'Lab Inventory', icon: FlaskConical, section: 'Navigate', run: () => navigate('/inventory') },
      { id: 'nav-catalog', label: 'CloudLabs Catalog', icon: CloudCog, section: 'Navigate', run: () => navigate('/catalog') },
      { id: 'nav-cloudlabs-audits', label: 'CloudLabs Audits', icon: ShieldCheck, section: 'Navigate', run: () => navigate('/cloudlabs-audits') },
      { id: 'nav-ws', label: 'Upcoming Workshops', icon: CalendarDays, section: 'Navigate', run: () => navigate('/workshops') },
      { id: 'nav-test', label: 'Tester Workspace', icon: UserCheck, section: 'Navigate', run: () => navigate('/tester') },
      { id: 'nav-retest', label: 'Retesting Center', icon: RefreshCw, section: 'Navigate', run: () => navigate('/retest') },
      { id: 'nav-rep', label: 'Reporting & Analytics', icon: ChartNoAxesCombined, section: 'Navigate', run: () => navigate('/reports') }
    ];
    if (currentUser?.role === 'Admin') {
      nav.push(
        { id: 'nav-users', label: 'Users', icon: Users, section: 'Navigate', run: () => navigate('/users') },
        { id: 'nav-audit', label: 'Audit Log', icon: Activity, section: 'Navigate', run: () => navigate('/audit') }
      );
    }
    const actions: Command[] = [
      { id: 'act-theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`, icon: theme === 'dark' ? Sun : Moon, section: 'Actions', run: toggleTheme },
      { id: 'act-out', label: 'Sign out', icon: LogOut, section: 'Actions', run: () => logout(), keywords: 'logout' },
      { id: 'act-p0', label: 'Show P0 labs', icon: TriangleAlert, section: 'Actions', run: () => navigate('/inventory?priority=P0') },
      { id: 'act-risk', label: 'Show at-risk labs', icon: TriangleAlert, section: 'Actions', run: () => navigate('/inventory?risk=1') },
      { id: 'act-retest', label: 'Show retest-required labs', icon: RefreshCw, section: 'Actions', run: () => navigate('/inventory?readiness=Retest+Required') }
    ];
    const labCmds: Command[] = labs.slice(0, 200).map(l => ({
      id: `lab-${l.id}`,
      label: l.labName,
      hint: `${l.trackName} · ${l.language}${l.assignedTo ? ` · ${l.assignedTo}` : ''}`,
      icon: FlaskConical,
      section: 'Labs' as const,
      run: () => navigate(`/inventory?q=${encodeURIComponent(l.labName)}`),
      keywords: `${l.trackName} ${l.language} ${l.assignedTo ?? ''}`
    }));
    return [...nav, ...actions, ...labCmds];
  }, [labs, navigate, theme, toggleTheme, logout, currentUser]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return commands.filter(c => c.section !== 'Labs').slice(0, 40);
    const scored = commands
      .map(c => {
        const hay = `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase();
        if (!hay.includes(ql)) return null;
        const startsWith = c.label.toLowerCase().startsWith(ql);
        return { c, score: startsWith ? 0 : 1 };
      })
      .filter((x): x is { c: Command; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map(x => x.c);
    return scored;
  }, [commands, q]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    if (open) dialogRef.current?.querySelector('[data-command-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx, open, dialogRef]);

  const run = (c: Command) => {
    onClose();
    try {
      c.run();
    } catch (e) {
      toast.error('Command failed', String(e));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, Math.max(0, filtered.length - 1))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[idx]; if (c) run(c); }
  };

  if (!open) return null;

  // Group filtered items by section but preserve overall order
  const groups: Record<string, Command[]> = {};
  filtered.forEach(c => { (groups[c.section] ??= []).push(c); });

  let running = 0;
  return (
    <div className="modal-backdrop items-start pt-[10dvh]" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        className="popover w-full max-w-xl overflow-hidden rounded-2xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <Search size={17} className="shrink-0 text-subtle" aria-hidden="true" />
          <input
            data-initial-focus
            aria-label="Search commands and labs"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            placeholder="Jump to a page, run an action, or search labs..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-subtle">Esc</kbd>
        </div>
        <div className="max-h-[60dvh] overflow-auto p-2 sm:max-h-96">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No matches for "{q}"</div>
          )}
          {Object.entries(groups).map(([section, items]) => (
            <div key={section}>
              <div className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-subtle">{section}</div>
              {items.map(c => {
                const currentIdx = running++;
                const active = currentIdx === idx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-command-active={active}
                    className={`my-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                      active
                        ? 'bg-primary-soft text-foreground ring-1 ring-primary/30'
                        : 'text-muted hover:bg-surface hover:text-foreground'
                    }`}
                    onMouseEnter={() => setIdx(currentIdx)}
                    onClick={() => run(c)}
                  >
                    <c.icon size={16} className={`shrink-0 ${active ? 'text-accent' : 'text-subtle'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    {c.hint && <span className="hidden max-w-[45%] truncate text-xs text-subtle sm:block">{c.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-surface/50 px-4 py-3 text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded border border-border px-1">↑↓</kbd> navigate</span>
            <span><kbd className="rounded border border-border px-1">↵</kbd> run</span>
          </div>
          <div>{filtered.length} results</div>
        </div>
      </div>
    </div>
  );
}
