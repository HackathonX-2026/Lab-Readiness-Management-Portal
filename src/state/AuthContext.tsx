import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppUser, Role } from '../types';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { useAudit } from './AuditContext';

interface AuthCtx {
  currentUser: AppUser | null;
  users: AppUser[];
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
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (raw) return JSON.parse(raw) as AppUser[];
    } catch { /* ignore */ }
    return [];
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const raw = localStorage.getItem(USERS_KEY);
      const list = raw ? (JSON.parse(raw) as AppUser[]) : [];
      return list.find(u => u.id === id) ?? null;
    } catch { return null; }
  });

  const { log } = useAudit();

  // Seed on first run
  useEffect(() => {
    if (users.length === 0) {
      seedUsers().then(seed => setUsers(seed));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
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
    login: async (email, password) => {
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
      if (currentUser) log({ actor: currentUser.email, action: 'logout' });
      setCurrentUser(null);
    },
    addUser: async ({ displayName, email, role, password }) => {
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
  }), [currentUser, users, log]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
