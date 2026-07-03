import { useRef, useState } from 'react';
import { useLabs } from '../state/LabsContext';
import { useNotifications } from '../state/NotificationContext';
import { useTheme } from '../state/ThemeContext';
import { useAuth } from '../state/AuthContext';
import { useToast } from '../state/ToastContext';
import { exportLabs, importLabs } from '../lib/excel';

export default function Topbar() {
  const { labs, replaceAll, resetToSeed } = useLabs();
  const { notifications, markRead, clear } = useNotifications();
  const { theme, toggle: toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
    <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
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
          ⬆️ Import Excel
        </button>
        <button className="btn-secondary" onClick={() => exportLabs(labs)} title="Export all labs to Excel">
          ⬇️ Export
        </button>
        <button className="btn-primary" onClick={() => confirm('Reload the 165 labs from the Upcoming-track-list sheet? Local changes will be lost.') && resetToSeed()} title="Reload real data from the shipped sheet">
          ♻️ Load Sheet Data
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="btn-secondary"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        <div className="relative">
          <button className="btn-secondary relative" onClick={() => setNotifOpen(o => !o)}>
            🔔 Notifications
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full text-[10px] px-1.5 py-0.5">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 w-96 max-h-96 overflow-auto card z-20 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="text-sm font-semibold dark:text-slate-100">Automated Notifications</div>
                <button className="text-xs text-brand-600 hover:underline" onClick={clear}>Clear all</button>
              </div>
              {notifications.length === 0 && (
                <div className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">No notifications yet.</div>
              )}
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-2 rounded-lg text-sm cursor-pointer ${n.read ? 'opacity-60' : 'bg-slate-50 dark:bg-slate-800'} dark:text-slate-200`}
                  onClick={() => markRead(n.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">{n.type}</span>
                    <span className="text-xs text-slate-400 ml-auto">
                      {n.channel.map(c => (c === 'Email' ? '✉️' : '💬')).join(' ')}
                    </span>
                  </div>
                  <div className="mt-1">{n.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            onClick={() => setUserMenuOpen(o => !o)}
            title="Account menu"
          >
            <div className="w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center font-semibold">
              {(currentUser?.displayName ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                {currentUser?.displayName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                {currentUser?.role} · {currentUser?.email}
              </div>
            </div>
            <span className="text-slate-400 text-xs">▾</span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-12 w-56 card z-20 p-2">
              <div className="px-2 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{currentUser?.displayName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{currentUser?.email}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide font-semibold text-brand-600">{currentUser?.role}</div>
              </div>
              <button
                className="w-full text-left px-3 py-2 rounded-md text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 font-medium"
                onClick={() => {
                  setUserMenuOpen(false);
                  if (confirm('Sign out of the portal?')) logout();
                }}
              >
                🔒 Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
