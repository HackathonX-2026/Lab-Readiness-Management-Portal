import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import LabInventory from './pages/LabInventory';
import UpcomingWorkshops from './pages/UpcomingWorkshops';
import TesterWorkspace from './pages/TesterWorkspace';
import RetestingCenter from './pages/RetestingCenter';
import Reporting from './pages/Reporting';
import UserManagement from './pages/UserManagement';
import AuditLog from './pages/AuditLog';
import LoginPage from './pages/LoginPage';
import Topbar from './components/Topbar';
import { CloudLabsLogo } from './components/Logo';
import CommandPalette from './components/CommandPalette';
import { useRole } from './state/RoleContext';
import { useAuth } from './state/AuthContext';
import { useLayout } from './state/LayoutContext';
import { useNotificationEngine } from './lib/notificationEngine';
import type { Role } from './types';

interface NavItem { to: string; label: string; icon: string; roles: Role[]; section: 'App' | 'System'; }

const NAV: NavItem[] = [
  { to: '/', label: 'Executive Dashboard', icon: '📊', roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/inventory', label: 'Lab Inventory', icon: '🧪', roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/workshops', label: 'Upcoming Workshops', icon: '📅', roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/tester', label: 'Tester Workspace', icon: '🧑‍🔬', roles: ['Admin', 'Tester'], section: 'App' },
  { to: '/retest', label: 'Retesting Center', icon: '🔁', roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/reports', label: 'Reporting & Analytics', icon: '📈', roles: ['Admin', 'Manager'], section: 'App' },
  { to: '/users', label: 'Users', icon: '👥', roles: ['Admin'], section: 'System' },
  { to: '/audit', label: 'Audit Log', icon: '📜', roles: ['Admin'], section: 'System' }
];

export default function App() {
  const { role } = useRole();
  const { currentUser } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useLayout();
  const [paletteOpen, setPaletteOpen] = useState(false);
  useNotificationEngine();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!currentUser) return <LoginPage />;

  const visible = NAV.filter(n => n.roles.includes(role));
  const appItems = visible.filter(n => n.section === 'App');
  const systemItems = visible.filter(n => n.section === 'System');

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950">
      <aside
        style={{ backgroundColor: '#0b1220', color: '#e5e7eb' }}
        className={`shrink-0 flex flex-col transition-all duration-200 border-r border-slate-800/80 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div
          className={`flex items-center gap-3 border-b border-white/10 ${sidebarCollapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5'}`}
        >
          <CloudLabsLogo size={sidebarCollapsed ? 40 : 56} />
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="text-2xl font-extrabold leading-none tracking-tight" style={{ color: '#ffffff' }}>
                Cloud<span>Labs</span>
              </div>
              <div className="text-[11px] leading-tight mt-1" style={{ color: '#94a3b8' }}>
                By Spektra Systems
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {!sidebarCollapsed && <SectionLabel>Workspace</SectionLabel>}
          {appItems.map(item => <NavItemLink key={item.to} item={item} collapsed={sidebarCollapsed} />)}

          {systemItems.length > 0 && (
            <>
              {!sidebarCollapsed && <SectionLabel className="mt-4">System</SectionLabel>}
              {sidebarCollapsed && <div className="mx-3 my-3 border-t border-white/10" />}
              {systemItems.map(item => <NavItemLink key={item.to} item={item} collapsed={sidebarCollapsed} />)}
            </>
          )}
        </nav>

        {!sidebarCollapsed && (
          <div className="px-5 py-3 text-[11px] border-t border-white/10" style={{ color: '#94a3b8' }}>
            v1.0 · Lab Readiness Portal
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-11 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
            className="w-8 h-8 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            {sidebarCollapsed ? '➡' : '⬅'}
          </button>
          <Breadcrumb />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex items-center gap-2 px-3 h-8 rounded-md border border-slate-200 dark:border-slate-700
                       bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700
                       text-xs text-slate-500 dark:text-slate-400 transition"
            title="Open command palette (Ctrl+K)"
          >
            <span>🔍</span>
            <span>Search or run a command…</span>
            <kbd className="ml-2 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono">Ctrl K</kbd>
          </button>
        </div>

        <Topbar />
        <div className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<LabInventory />} />
            <Route path="/workshops" element={<UpcomingWorkshops />} />
            <Route path="/tester" element={<TesterWorkspace />} />
            <Route path="/retest" element={<RetestingCenter />} />
            <Route path="/reports" element={<Reporting />} />
            <Route path="/users" element={role === 'Admin' ? <UserManagement /> : <Navigate to="/" replace />} />
            <Route path="/audit" element={role === 'Admin' ? <AuditLog /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const label = NAV.find(n => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))?.label ?? 'Dashboard';
  return (
    <div className="flex items-center gap-2 text-sm">
      <NavLink to="/" title="Home" className="text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400">
        🏠
      </NavLink>
      <span className="text-slate-300 dark:text-slate-600">›</span>
      <span className="font-semibold text-slate-800 dark:text-slate-100">{label}</span>
    </div>
  );
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`px-5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest ${className}`}
      style={{ color: '#94a3b8' }}
    >
      {children}
    </div>
  );
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => {
        const base = collapsed
          ? 'flex items-center justify-center gap-3 text-sm mx-2 my-0.5 px-2 py-3 rounded-md transition'
          : 'flex items-center gap-3 text-sm px-5 py-2.5 border-l-4 transition';
        const state = isActive
          ? 'sidebar-nav-active'
          : 'sidebar-nav-idle';
        return `${base} ${state}`;
      }}
    >
      <span className="text-base leading-none">{item.icon}</span>
      {!collapsed && <span className="font-medium">{item.label}</span>}
    </NavLink>
  );
}
