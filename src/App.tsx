import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Activity, CalendarDays, ChartNoAxesCombined, ChevronRight, CloudCog, FlaskConical, Home,
  LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, TriangleAlert,
  Users, X, type LucideIcon
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LabInventory from './pages/LabInventory';
import TimelineRisk from './pages/TimelineRisk';
import UpcomingWorkshops from './pages/UpcomingWorkshops';
import Reporting from './pages/Reporting';
import UserManagement from './pages/UserManagement';
import AuditLog from './pages/AuditLog';
import CloudLabsCatalog from './pages/CloudLabsCatalog';
import CloudLabsAudits from './pages/CloudLabsAudits';
import LoginPage from './pages/LoginPage';
import Topbar from './components/Topbar';
import { CloudLabsLogo } from './components/Logo';
import CommandPalette from './components/CommandPalette';
import { useRole } from './state/RoleContext';
import { useAuth } from './state/AuthContext';
import { useLayout } from './state/LayoutContext';
import { useNotificationEngine } from './lib/notificationEngine';
import type { Role } from './types';

interface NavItem { to: string; label: string; icon: LucideIcon; roles: Role[]; section: 'App' | 'System'; }

const NAV: NavItem[] = [
  { to: '/', label: 'Executive Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/risk', label: 'Timeline Risk', icon: TriangleAlert, roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/inventory', label: 'Lab Inventory', icon: FlaskConical, roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/catalog', label: 'CloudLabs Catalog', icon: CloudCog, roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/cloudlabs-audits', label: 'CloudLabs Audits', icon: ShieldCheck, roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/workshops', label: 'Upcoming Workshops', icon: CalendarDays, roles: ['Admin', 'Manager', 'Tester'], section: 'App' },
  { to: '/reports', label: 'Reporting & Analytics', icon: ChartNoAxesCombined, roles: ['Admin', 'Manager'], section: 'App' },
  { to: '/users', label: 'Users', icon: Users, roles: ['Admin'], section: 'System' },
  { to: '/audit', label: 'Audit Log', icon: Activity, roles: ['Admin'], section: 'System' }
];

export default function App() {
  const { role } = useRole();
  const { currentUser } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useLayout();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const compact = sidebarCollapsed && !mobileSidebarOpen;
  useNotificationEngine();

  useEffect(() => { setMobileSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
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
    <div className="flex h-full overflow-hidden">
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-border bg-surface/95
          backdrop-blur-sm transition-[width,transform] duration-200 md:static md:translate-x-0 md:bg-surface/40
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full invisible md:visible'}
          ${compact ? 'w-64 md:w-16' : 'w-64'}`}
      >
        <div className={`flex h-24 shrink-0 items-center gap-2.5 ${compact ? 'justify-center px-3' : 'px-5'}`}>
          <NavLink to="/" aria-label="Lab Readiness home" className="flex min-w-0 items-center gap-2.5">
            <CloudLabsLogo size={32} />
            {!compact && (
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-tight text-foreground">Lab Readiness</div>
                <div className="mt-0.5 text-[10px] tracking-wide text-muted">CloudLabs · Spektra Systems</div>
              </div>
            )}
          </NavLink>
          <button className="btn-icon ml-auto md:hidden" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main navigation" className={`flex-1 overflow-y-auto pb-4 ${compact ? 'px-2' : 'px-3'}`}>
          {!compact && <SectionLabel>Workspace</SectionLabel>}
          {appItems.map(item => <NavItemLink key={item.to} item={item} collapsed={compact} />)}

          {systemItems.length > 0 && (
            <>
              {!compact && <SectionLabel className="mt-6">System</SectionLabel>}
              {compact && <div className="mx-2 my-3 border-t border-border" />}
              {systemItems.map(item => <NavItemLink key={item.to} item={item} collapsed={compact} />)}
            </>
          )}
        </nav>

        <div className={`mx-3 flex items-center gap-2.5 border-t border-border py-4 text-muted ${compact ? 'justify-center' : 'px-2'}`}>
          <ShieldCheck size={16} className="shrink-0 text-accent" aria-hidden="true" />
          {!compact && <span className="text-[11px]">Lab Readiness Portal <span className="text-subtle">· v1.0</span></span>}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenPalette={() => setPaletteOpen(true)}>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={mobileSidebarOpen}
            className="btn-icon md:hidden"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
            aria-controls="app-sidebar"
            aria-expanded={!sidebarCollapsed}
            className="btn-icon hidden md:inline-flex"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          </button>
          <Breadcrumb />
        </Topbar>
        <div id="page-content" className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/risk" element={<TimelineRisk />} />
            <Route path="/inventory" element={<LabInventory />} />
            <Route path="/catalog" element={<CloudLabsCatalog />} />
            <Route path="/cloudlabs-audits" element={<CloudLabsAudits />} />
            <Route path="/workshops" element={<UpcomingWorkshops />} />
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
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
      <NavLink to="/" title="Home" aria-label="Home" className="hidden shrink-0 text-muted transition-colors hover:text-foreground sm:block">
        <Home size={15} aria-hidden="true" />
      </NavLink>
      <ChevronRight size={14} className="hidden shrink-0 text-subtle sm:block" aria-hidden="true" />
      <span className="truncate text-xs font-medium text-foreground sm:text-sm" aria-current="page">{label}</span>
    </nav>
  );
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-subtle ${className}`}>
      {children}
    </div>
  );
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => {
        const base = collapsed
          ? 'flex items-center justify-center my-0.5 px-2 py-2.5 rounded-lg transition-colors'
          : 'flex items-center gap-3 my-0.5 px-3 py-2.5 rounded-lg text-sm transition-colors';
        const state = isActive
          ? 'sidebar-nav-active'
          : 'sidebar-nav-idle';
        return `${base} ${state}`;
      }}
    >
      <Icon size={16} className="nav-icon shrink-0" aria-hidden="true" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}
