import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppUser, Role } from '../types';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { useAudit } from './AuditContext';

interface AuthCtx {
  currentUser: AppUser | null;
  users: AppUser[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  addUser: (input: { displayName: string; email: string; role: Role; password: string }) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (id: string, patch: Partial<Pick<AppUser, 'displayName' | 'email' | 'role' | 'disabled'>>) => void;
  resetPassword: (id: string, newPassword: string) => Promise<void>;
  deleteUser: (id: string) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const USERS_KEY = 'lab-readiness:users';
const SESSION_KEY = 'lab-readiness:session';
export const PUBLIC_ACCESS_ENABLED = import.meta.env.VITE_PUBLIC_ACCESS === 'true';
export const ENTRA_AUTH_ENABLED = import.meta.env.PROD && !PUBLIC_ACCESS_ENABLED;
const PUBLIC_VIEWER: AppUser = {
  id: 'public-viewer',
  displayName: 'Public Viewer',
  email: 'public@lab-readiness.local',
  role: 'Manager',
  passwordHash: '',
  createdAt: '2026-10-07T00:00:00.000Z',
  createdBy: 'public access'
};

async function seedUsers(): Promise<AppUser[]> {
  const now = new Date().toISOString();
  return [
    {
      id: 'u-admin',
      displayName: 'Aisha Khan',
      email: 'admin@labs.local',
      role: 'Admin',
      passwordHash: await hashPassword('admin123'),
      createdAt: now,
      createdBy: 'system'
    },
    {
      id: 'u-tester',
      displayName: 'Rishabh Sharma',
      email: 'tester@labs.local',
      role: 'Tester',
      passwordHash: await hashPassword('tester123'),
      createdAt: now,
      createdBy: 'system'
    },
    {
      id: 'u-manager',
      displayName: 'Sanket Verma',
      email: 'manager@labs.local',
      role: 'Manager',
      passwordHash: await hashPassword('manager123'),
      createdAt: now,
      createdBy: 'system'
    }
  ];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(() => {
    if (PUBLIC_ACCESS_ENABLED) return [PUBLIC_VIEWER];
    if (ENTRA_AUTH_ENABLED) return [];
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (raw) return JSON.parse(raw) as AppUser[];
    } catch { /* ignore */ }
    return [];
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    if (PUBLIC_ACCESS_ENABLED) return PUBLIC_VIEWER;
    if (ENTRA_AUTH_ENABLED) return null;
    try {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const raw = localStorage.getItem(USERS_KEY);
      const list = raw ? (JSON.parse(raw) as AppUser[]) : [];
      return list.find(u => u.id === id) ?? null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(ENTRA_AUTH_ENABLED);

  const { log } = useAudit();

  useEffect(() => {
    if (!ENTRA_AUTH_ENABLED) return;
    let active = true;
    fetch('/.auth/me', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : [])
      .then((principals: Array<{ userId?: string; userDetails?: string; userRoles?: string[]; claims?: Array<{ typ: string; val: string }> }>) => {
        if (!active) return;
        const principal = principals[0];
        if (!principal) return;
        const claims = principal.claims ?? [];
        const claim = (...names: string[]) => claims.find(item => names.includes(item.typ) || names.some(name => item.typ.endsWith(name)))?.val;
        const email = principal.userDetails?.includes('@')
          ? principal.userDetails
          : claim('email', 'preferred_username', '/emailaddress') ?? '';
        const displayName = claim('name', '/name') ?? principal.userDetails ?? email;
        const roles = (principal.userRoles ?? []).map(role => role.toLowerCase());
        const role: Role = roles.includes('admin') ? 'Admin' : roles.includes('tester') ? 'Tester' : 'Manager';
        const user: AppUser = {
          id: principal.userId ?? email,
          displayName,
          email,
          role,
          passwordHash: '',
          createdAt: new Date().toISOString(),
          createdBy: 'Microsoft Entra ID'
        };
        setUsers([user]);
        setCurrentUser(user);
      })
      .catch(() => {
        if (active) setCurrentUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Seed on first run
  useEffect(() => {
    if (ENTRA_AUTH_ENABLED || PUBLIC_ACCESS_ENABLED) return;
    if (users.length === 0) {
      seedUsers().then(seed => setUsers(seed));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ENTRA_AUTH_ENABLED || PUBLIC_ACCESS_ENABLED) return;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (ENTRA_AUTH_ENABLED || PUBLIC_ACCESS_ENABLED) return;
    if (currentUser) localStorage.setItem(SESSION_KEY, currentUser.id);
    else localStorage.removeItem(SESSION_KEY);
  }, [currentUser]);

  // Keep currentUser in sync if their record changes
  useEffect(() => {
    if (!currentUser) return;
    const fresh = users.find(u => u.id === currentUser.id);
    if (!fresh) { setCurrentUser(null); return; }
    if (JSON.stringify(fresh) !== JSON.stringify(currentUser)) setCurrentUser(fresh);
  }, [users, currentUser]);

  const value = useMemo<AuthCtx>(() => ({
    currentUser,
    users,
    loading,
    login: async (email, password) => {
      if (PUBLIC_ACCESS_ENABLED) return { ok: true };
      if (ENTRA_AUTH_ENABLED) {
        window.location.assign('/.auth/login/aad');
        return { ok: true };
      }
      const u = users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!u) return { ok: false, error: 'No account with that email.' };
      if (u.disabled) return { ok: false, error: 'This account is disabled.' };
      const ok = await verifyPassword(password, u.passwordHash);
      if (!ok) return { ok: false, error: 'Incorrect password.' };
      setCurrentUser(u);
      log({ actor: u.email, action: 'login' });
      return { ok: true };
    },
    logout: () => {
      if (PUBLIC_ACCESS_ENABLED) return;
      if (ENTRA_AUTH_ENABLED) {
        window.location.assign('/.auth/logout');
        return;
      }
      if (currentUser) log({ actor: currentUser.email, action: 'logout' });
      setCurrentUser(null);
    },
    addUser: async ({ displayName, email, role, password }) => {
      if (ENTRA_AUTH_ENABLED || PUBLIC_ACCESS_ENABLED) return { ok: false, error: 'User management is disabled in this deployment.' };
      const normEmail = email.trim().toLowerCase();
      if (!normEmail || !password || !displayName) return { ok: false, error: 'All fields are required.' };
      if (users.some(u => u.email.toLowerCase() === normEmail)) return { ok: false, error: 'Email already exists.' };
      if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
      const newUser: AppUser = {
        id: `u-${Date.now()}`,
        displayName: displayName.trim(),
        email: normEmail,
        role,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.email ?? 'system'
      };
      setUsers(prev => [...prev, newUser]);
      log({ actor: currentUser?.email ?? 'system', action: 'user.create', target: normEmail, details: `role=${role}` });
      return { ok: true };
    },
    updateUser: (id, patch) => {
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...patch, email: patch.email ? patch.email.trim().toLowerCase() : u.email } : u)));
      log({ actor: currentUser?.email ?? 'system', action: 'user.update', target: id, details: JSON.stringify(patch) });
    },
    resetPassword: async (id, newPassword) => {
      const hash = await hashPassword(newPassword);
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, passwordHash: hash } : u)));
      log({ actor: currentUser?.email ?? 'system', action: 'user.resetPassword', target: id });
    },
    deleteUser: id => {
      const target = users.find(u => u.id === id);
      if (currentUser?.id === id) { alert("You can't delete your own account while signed in."); return; }
      setUsers(prev => prev.filter(u => u.id !== id));
      log({ actor: currentUser?.email ?? 'system', action: 'user.delete', target: target?.email ?? id });
    }
  }), [currentUser, users, loading, log]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
