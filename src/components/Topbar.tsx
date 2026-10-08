import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, ChevronDown, Database, Download, LogOut, Mail, MessageSquare, Moon, RefreshCw, Search, Sun, Upload } from 'lucide-react';
import { useLabs } from '../state/LabsContext';
import { useNotifications } from '../state/NotificationContext';
import { useTheme } from '../state/ThemeContext';
import { useAuth } from '../state/AuthContext';
import { useToast } from '../state/ToastContext';
import { exportLabs, importLabs } from '../lib/excel';
import { cloudlabsApi, type CloudLabsHealth } from '../api/cloudlabs';

export default function Topbar({ children, onOpenPalette }: { children: ReactNode; onOpenPalette: () => void }) {
  const { labs, replaceAll, refresh, loading, error, lastSyncedAt } = useLabs();
  const { notifications, markRead, clear } = useNotifications();
  const { theme, toggle: toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menusRef = useRef<HTMLDivElement>(null);
  const [health, setHealth] = useState<CloudLabsHealth | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    const loadHealth = () => cloudlabsApi.health().then(result => { if (active) setHealth(result); }).catch(() => { if (active) setHealth(null); });
    void loadHealth();
    const timer = window.setInterval(() => void loadHealth(), 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      await cloudlabsApi.triggerSync();
      await refresh();
      setHealth(await cloudlabsApi.health());
      toast.success('CloudLabs sync complete', 'Workshop data refreshed. Local edits are preserved.');
    } catch (error) { toast.error('CloudLabs sync failed', error instanceof Error ? error.message : 'Please retry.'); }
    finally { setSyncing(false); }
  };

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!menusRef.current?.contains(e.target as Node)) {
        setNotifOpen(false);
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNotifOpen(false); setUserMenuOpen(false); }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const handleImport = async (f: File) => {
    try {
      const imported = await importLabs(f);
      if (imported.length && confirm(`Import ${imported.length} labs? This will replace current data.`)) {
        replaceAll(imported);
        toast.success('Import complete', `${imported.length} labs loaded from ${f.name}`);
      }
    } catch (e) {
      toast.error('Import failed', (e as Error).message);
    }
  };

  return (
    <header className="relative z-20 shrink-0 bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">{children}</div>
        <div ref={menusRef} className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button className="btn-ghost gap-2 px-2" onClick={onOpenPalette} aria-label="Open command palette" title="Search or run a command (Ctrl+K)">
            <Search size={16} aria-hidden="true" />
            <span className="hidden text-xs xl:inline">Search anything…</span>
            <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-subtle lg:inline">Ctrl K</kbd>
          </button>
          <span className="mx-1 hidden h-5 border-l border-border sm:block" />
          <button
            className="btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          <div className="relative">
            <button
              className="btn-icon relative"
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
              aria-expanded={notifOpen}
              aria-controls="notifications-panel"
              onClick={() => { setNotifOpen(o => !o); setUserMenuOpen(false); }}
            >
              <Bell size={17} aria-hidden="true" />
              {unread > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" />}
            </button>
            {notifOpen && (
              <section id="notifications-panel" aria-label="Automated notifications" className="popover fixed left-4 right-4 top-14 max-h-96 overflow-auto p-2 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-96">
                <div className="mb-1 flex items-center justify-between border-b border-border px-2 py-2">
                  <div className="text-sm font-semibold">Automated Notifications</div>
                  <button className="text-xs text-accent hover:underline" onClick={clear}>Clear all</button>
                </div>
                {notifications.length === 0 && <div className="p-6 text-center text-sm text-muted">No notifications yet.</div>}
                {notifications.map(n => (
                  <button
                    key={n.id}
                    className={`my-1 w-full rounded-lg p-3 text-left text-sm transition-colors hover:bg-surface ${n.read ? 'text-muted' : 'bg-surface text-foreground'}`}
                    onClick={() => markRead(n.id)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="badge">{n.type}</span>
                      <span className="ml-auto flex gap-1 text-subtle" aria-label={n.channel.join(', ')}>
                        {n.channel.map(c => c === 'Email' ? <Mail key={c} size={13} aria-hidden="true" /> : <MessageSquare key={c} size={13} aria-hidden="true" />)}
                      </span>
                    </span>
                    <span className="mt-2 block">{n.message}</span>
                  </button>
                ))}
              </section>
            )}
          </div>

          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
              onClick={() => { setUserMenuOpen(o => !o); setNotifOpen(false); }}
              title="Account menu"
              aria-label="Account menu"
              aria-expanded={userMenuOpen}
              aria-controls="account-panel"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-[10px] font-semibold text-accent">
                {(currentUser?.displayName ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate text-xs lg:block">{currentUser?.displayName}</span>
              <ChevronDown size={13} className="hidden text-subtle sm:block" aria-hidden="true" />
            </button>
            {userMenuOpen && (
              <div id="account-panel" className="popover absolute right-0 top-11 w-64 p-2">
                <div className="mb-1 border-b border-border px-2 py-3">
                  <div className="text-sm font-semibold text-foreground">{currentUser?.displayName}</div>
                  <div className="mt-0.5 break-words text-xs text-muted">{currentUser?.email}</div>
                  <div className="mt-2"><span className="badge status-primary">{currentUser?.role}</span></div>
                </div>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                  onClick={() => {
                    setUserMenuOpen(false);
                    if (confirm('Sign out of the portal?')) logout();
                  }}
                >
                  <LogOut size={15} aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-6 lg:px-10">
        <div className="hidden items-center gap-2 text-xs text-muted lg:flex">
          <Database size={14} className="text-subtle" aria-hidden="true" />
          <span className="font-medium text-foreground">{labs.length}</span> labs in workspace
          {loading ? <span className="text-subtle">· Loading…</span> : lastSyncedAt && <span className="text-subtle">· Cache updated {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
        <button className="btn-secondary" onClick={() => fileRef.current?.click()} title="Import an Excel/CSV tracker">
          <Upload size={14} aria-hidden="true" /> Import Excel
        </button>
        <button className="btn-secondary" onClick={() => exportLabs(labs)} title="Export all labs to Excel">
          <Download size={14} aria-hidden="true" /> Export
        </button>
        <button className="btn-primary" onClick={() => void sync()} disabled={syncing || !health?.workshopConfigured || !health.canSync}
          title={health?.workshopConfigured ? 'Sync workshop requests from CloudLabs and reload the local cache' : 'Configure the vNext workshop connection on the server; catalog credentials are separate'}>
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} aria-hidden="true" /> {syncing ? 'Syncing…' : 'Sync CloudLabs'}
        </button>
        </div>
      </div>
      {error && <div role="status" className="flex flex-wrap items-center gap-2 border-b border-warning/20 bg-warning/5 px-4 py-2 text-xs text-warning sm:px-6 lg:px-10">
        <span className="min-w-0 flex-1">{labs.length ? 'Showing cached labs. ' : ''}{error}</span>
        <button className="shrink-0 font-medium underline" disabled={loading} onClick={() => void refresh()}>Retry</button>
      </div>}
    </header>
  );
}
