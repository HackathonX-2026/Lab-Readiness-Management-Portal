import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLabs } from '../state/LabsContext';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../state/ThemeContext';
import { useToast } from '../state/ToastContext';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const commands: Command[] = useMemo(() => {
    const nav: Command[] = [
      { id: 'nav-dash', label: 'Executive Dashboard', icon: '📊', section: 'Navigate', run: () => navigate('/') },
      { id: 'nav-inv', label: 'Lab Inventory', icon: '🧪', section: 'Navigate', run: () => navigate('/inventory') },
      { id: 'nav-ws', label: 'Upcoming Workshops', icon: '📅', section: 'Navigate', run: () => navigate('/workshops') },
      { id: 'nav-test', label: 'Tester Workspace', icon: '🧑‍🔬', section: 'Navigate', run: () => navigate('/tester') },
      { id: 'nav-retest', label: 'Retesting Center', icon: '🔁', section: 'Navigate', run: () => navigate('/retest') },
      { id: 'nav-rep', label: 'Reporting & Analytics', icon: '📈', section: 'Navigate', run: () => navigate('/reports') }
    ];
    if (currentUser?.role === 'Admin') {
      nav.push(
        { id: 'nav-users', label: 'Users', icon: '👥', section: 'Navigate', run: () => navigate('/users') },
        { id: 'nav-audit', label: 'Audit Log', icon: '📜', section: 'Navigate', run: () => navigate('/audit') }
      );
    }
    const actions: Command[] = [
      { id: 'act-theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`, icon: theme === 'dark' ? '☀️' : '🌙', section: 'Actions', run: toggleTheme },
      { id: 'act-out', label: 'Sign out', icon: '🔒', section: 'Actions', run: () => logout(), keywords: 'logout' },
      { id: 'act-p0', label: 'Show P0 labs', icon: '🚨', section: 'Actions', run: () => navigate('/inventory?priority=P0') },
      { id: 'act-risk', label: 'Show at-risk labs', icon: '⚠️', section: 'Actions', run: () => navigate('/inventory?risk=1') },
      { id: 'act-retest', label: 'Show retest-required labs', icon: '🔁', section: 'Actions', run: () => navigate('/inventory?readiness=Retest+Required') }
    ];
    const labCmds: Command[] = labs.slice(0, 200).map(l => ({
      id: `lab-${l.id}`,
      label: l.labName,
      hint: `${l.trackName} · ${l.language}${l.assignedTo ? ` · ${l.assignedTo}` : ''}`,
      icon: '🧪',
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

  const run = (c: Command) => {
    onClose();
    try {
      c.run();
    } catch (e) {
      toast.error('Command failed', String(e));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[idx]; if (c) run(c); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  if (!open) return null;

  // Group filtered items by section but preserve overall order
  const groups: Record<string, Command[]> = {};
  filtered.forEach(c => { (groups[c.section] ??= []).push(c); });

  let running = 0;
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl card overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <span className="text-slate-400">🔍</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            placeholder="Jump to a page, run an action, or search labs..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-auto py-1">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No matches for "{q}"</div>
          )}
          {Object.entries(groups).map(([section, items]) => (
            <div key={section}>
              <div className="px-4 pt-2 pb-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">{section}</div>
              {items.map(c => {
                const currentIdx = running++;
                const active = currentIdx === idx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${
                      active
                        ? 'bg-brand-50 dark:bg-brand-700/25 text-slate-900 dark:text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    onMouseEnter={() => setIdx(currentIdx)}
                    onClick={() => run(c)}
                  >
                    <span className="text-base w-5 text-center">{c.icon}</span>
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && <span className="text-xs text-slate-400 truncate">{c.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 border rounded border-slate-300 dark:border-slate-700">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 border rounded border-slate-300 dark:border-slate-700">↵</kbd> run</span>
          </div>
          <div>{filtered.length} results</div>
        </div>
      </div>
    </div>
  );
}
