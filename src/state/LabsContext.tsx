import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Lab, TestStatus } from '../types';
import { cloudlabsApi, type RemoteLab } from '../api/cloudlabs';
import { useAudit } from './AuditContext';

interface LabsCtx {
  labs: Lab[];
  loading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  addLab: (lab: Omit<Lab, 'id' | 'lastUpdatedBy' | 'lastUpdatedDate'>, user: string) => void;
  updateLab: (id: string, patch: Partial<Lab>, user: string) => void;
  deleteLab: (id: string) => void;
  bulkUpdate: (ids: string[], patch: Partial<Lab>, user: string) => void;
  replaceAll: (labs: Lab[]) => void;
  resetToSeed: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<LabsCtx | null>(null);
const CACHE_KEY = 'lab-readiness:labs-cache';
const POLL_MS = 60_000;
const FETCH_LIMIT = 5000;

// CloudLabs readiness → local testStatus. Preserves the semantics the rest of
// the app expects (Ready → Passed, etc.) without changing any downstream code.
const READINESS_TO_TEST: Record<string, TestStatus> = {
  Ready: 'Passed',
  'Testing Pending': 'Not Started',
  'Retest Required': 'In Progress',
  'Action Required': 'Failed',
  Cancelled: 'Failed',
  Completed: 'Passed'
};

function remoteToLab(r: RemoteLab): Lab {
  const remarks = [r.customer, r.country, r.timeZone].filter(Boolean).join(' · ');
  return {
    id: r.id,
    trackName: r.trackTitle || 'CloudLabs',
    labName: r.labName || 'Untitled workshop',
    language: 'English',
    upcomingWorkshopDate: r.deliveryDate,
    assignedTo: r.primaryContact ?? r.ownerEmail ?? null,
    testDate: null,
    testStatus: READINESS_TO_TEST[r.readinessStatus ?? ''] ?? 'Not Started',
    priority: null,
    reviewer: r.ownerEmail ?? null,
    requestor: r.primaryContact ?? null,
    remarks,
    comments: r.requestStatusRaw ? `CloudLabs status: ${r.requestStatusRaw}` : '',
    lastUpdatedBy: 'cloudlabs-sync',
    lastUpdatedDate: r.updatedAt
  };
}

function loadCached(): Lab[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function LabsProvider({ children }: { children: ReactNode }) {
  const [labs, setLabs] = useState<Lab[]>(() => loadCached());
  const [loading, setLoading] = useState(labs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const { log } = useAudit();

  // In-memory overlay of local edits (adds/updates/deletes) so unsaved user
  // tweaks aren't blown away when the poller pulls a fresh CloudLabs snapshot.
  const localEditsRef = useRef<Map<string, Partial<Lab>>>(new Map());
  const localDeletesRef = useRef<Set<string>>(new Set());
  const localAddsRef = useRef<Lab[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await cloudlabsApi.listLabs({ limit: FETCH_LIMIT });
      const remote = resp.items
        .filter(r => !localDeletesRef.current.has(r.id))
        .map(remoteToLab)
        .map(l => {
          const patch = localEditsRef.current.get(l.id);
          return patch ? { ...l, ...patch } : l;
        });
      const merged = [...remote, ...localAddsRef.current];
      setLabs(merged);
      setLastSyncedAt(new Date().toISOString());
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(merged)); } catch { /* quota */ }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load labs';
      setError(msg);
      // Keep whatever we already had in state on failure so the UI doesn't blank.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const value = useMemo<LabsCtx>(
    () => ({
      labs,
      loading,
      error,
      lastSyncedAt,
      addLab: (lab, user) => {
        const newLab: Lab = {
          ...lab,
          id: `local:${Date.now()}`,
          lastUpdatedBy: user,
          lastUpdatedDate: new Date().toISOString()
        };
        localAddsRef.current = [...localAddsRef.current, newLab];
        setLabs(prev => [...prev, newLab]);
        log({ actor: user, action: 'lab.create.local', target: lab.labName });
      },
      updateLab: (id, patch, user) => {
        const merged: Partial<Lab> = {
          ...patch,
          lastUpdatedBy: user,
          lastUpdatedDate: new Date().toISOString()
        };
        localEditsRef.current.set(id, { ...(localEditsRef.current.get(id) || {}), ...merged });
        setLabs(prev => prev.map(l => (l.id === id ? { ...l, ...merged } : l)));
        log({ actor: user, action: 'lab.update.local', target: id, details: Object.keys(patch).join(',') });
      },
      deleteLab: id => {
        const target = labs.find(l => l.id === id);
        if (id.startsWith('local:')) {
          localAddsRef.current = localAddsRef.current.filter(l => l.id !== id);
        } else {
          localDeletesRef.current.add(id);
          localEditsRef.current.delete(id);
        }
        setLabs(prev => prev.filter(l => l.id !== id));
        log({ actor: 'system', action: 'lab.delete.local', target: target?.labName ?? id });
      },
      bulkUpdate: (ids, patch, user) => {
        const merged: Partial<Lab> = {
          ...patch,
          lastUpdatedBy: user,
          lastUpdatedDate: new Date().toISOString()
        };
        ids.forEach(id => {
          localEditsRef.current.set(id, { ...(localEditsRef.current.get(id) || {}), ...merged });
        });
        setLabs(prev => prev.map(l => (ids.includes(l.id) ? { ...l, ...merged } : l)));
        log({ actor: user, action: 'lab.bulkUpdate.local', details: `${ids.length} labs · ${Object.keys(patch).join(',')}` });
      },
      replaceAll: next => {
        setLabs(next);
        log({ actor: 'system', action: 'lab.import.local', details: `${next.length} labs` });
      },
      // "Reset" now means: drop local overrides and re-pull fresh from CloudLabs.
      resetToSeed: () => {
        localEditsRef.current.clear();
        localDeletesRef.current.clear();
        localAddsRef.current = [];
        void refresh();
        log({ actor: 'system', action: 'lab.refresh.cloudlabs' });
      },
      refresh
    }),
    [labs, loading, error, lastSyncedAt, log, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLabs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLabs must be used inside LabsProvider');
  return ctx;
}
