import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lab } from '../types';
import { seedLabs } from '../lib/seed';
import { useAudit } from './AuditContext';

interface LabsCtx {
  labs: Lab[];
  addLab: (lab: Omit<Lab, 'id' | 'lastUpdatedBy' | 'lastUpdatedDate'>, user: string) => void;
  updateLab: (id: string, patch: Partial<Lab>, user: string) => void;
  deleteLab: (id: string) => void;
  bulkUpdate: (ids: string[], patch: Partial<Lab>, user: string) => void;
  replaceAll: (labs: Lab[]) => void;
  resetToSeed: () => void;
}

const Ctx = createContext<LabsCtx | null>(null);
const KEY = 'lab-readiness:labs';
const SCHEMA_KEY = 'lab-readiness:schema';
const SCHEMA_VERSION = 'v4-sheet-full-columns';

function load(): Lab[] {
  try {
    const currentSchema = localStorage.getItem(SCHEMA_KEY);
    const seed = seedLabs();
    if (currentSchema !== SCHEMA_VERSION) {
      localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
      localStorage.removeItem(KEY);
      return seed;
    }
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Lab[];
    if (!Array.isArray(parsed) || !parsed.length) return seed;
    // If the seed grew/changed dramatically, prefer the new seed
    const looksLikeOldSample = parsed.some(l => (l.id ?? '').startsWith('lab-')) && parsed.length < 100;
    if (looksLikeOldSample) {
      localStorage.removeItem(KEY);
      return seed;
    }
    return parsed;
  } catch {
    return seedLabs();
  }
}

export function LabsProvider({ children }: { children: ReactNode }) {
  const [labs, setLabs] = useState<Lab[]>(() => load());
  const { log } = useAudit();

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(labs));
  }, [labs]);

  const value = useMemo<LabsCtx>(
    () => ({
      labs,
      addLab: (lab, user) => {
        setLabs(prev => [
          ...prev,
          {
            ...lab,
            id: `lab-${Date.now()}`,
            lastUpdatedBy: user,
            lastUpdatedDate: new Date().toISOString()
          }
        ]);
        log({ actor: user, action: 'lab.create', target: lab.labName });
      },
      updateLab: (id, patch, user) => {
        setLabs(prev =>
          prev.map(l =>
            l.id === id
              ? { ...l, ...patch, lastUpdatedBy: user, lastUpdatedDate: new Date().toISOString() }
              : l
          )
        );
        log({ actor: user, action: 'lab.update', target: id, details: Object.keys(patch).join(',') });
      },
      deleteLab: id => {
        const target = labs.find(l => l.id === id);
        setLabs(prev => prev.filter(l => l.id !== id));
        log({ actor: 'system', action: 'lab.delete', target: target?.labName ?? id });
      },
      bulkUpdate: (ids, patch, user) => {
        setLabs(prev =>
          prev.map(l =>
            ids.includes(l.id)
              ? { ...l, ...patch, lastUpdatedBy: user, lastUpdatedDate: new Date().toISOString() }
              : l
          )
        );
        log({ actor: user, action: 'lab.bulkUpdate', details: `${ids.length} labs · ${Object.keys(patch).join(',')}` });
      },
      replaceAll: next => {
        setLabs(next);
        log({ actor: 'system', action: 'lab.import', details: `${next.length} labs` });
      },
      resetToSeed: () => {
        const seed = seedLabs();
        setLabs(seed);
        log({ actor: 'system', action: 'lab.resetToSeed', details: `${seed.length} labs` });
      }
    }),
    [labs, log]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLabs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLabs must be used inside LabsProvider');
  return ctx;
}
