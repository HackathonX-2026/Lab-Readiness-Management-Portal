import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuditEntry } from '../types';

interface AuditCtx {
  entries: AuditEntry[];
  log: (entry: Omit<AuditEntry, 'id' | 'at'>) => void;
  clear: () => void;
}

const Ctx = createContext<AuditCtx | null>(null);
const KEY = 'lab-readiness:audit';
const MAX_ENTRIES = 500;

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }, [entries]);

  const log: AuditCtx['log'] = e =>
    setEntries(prev => [
      { ...e, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString() },
      ...prev
    ].slice(0, MAX_ENTRIES));

  const clear = () => setEntries([]);

  return <Ctx.Provider value={{ entries, log, clear }}>{children}</Ctx.Provider>;
}

export function useAudit() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAudit must be used inside AuditProvider');
  return ctx;
}
