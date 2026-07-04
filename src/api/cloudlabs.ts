// Thin client for the local sync-server backend.
// The Vite dev server proxies `/api` to http://localhost:3001 (see vite.config.ts).
// In production, place the sync-server behind the same reverse proxy as the SPA
// so `/api` resolves without hardcoding a hostname.

export interface RemoteLab {
  id: string;
  source: string;
  sourceId: string;
  labName: string | null;
  trackTitle: string | null;
  requestDate: string | null;
  deliveryDate: string | null;
  requestStatus: string | null;
  requestStatusRaw: string | null;
  readinessStatus: string | null;
  environmentStatus: string | null;
  ownerEmail: string | null;
  primaryContact: string | null;
  customer: string | null;
  country: string | null;
  region: string | null;
  eventType: string | null;
  registrationCount: number | null;
  durationMinutes: number | null;
  timeZone: string | null;
  isActive: boolean;
  bitLink: string | null;
  purchaseOrder: string | null;
  externalId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'failed';
  source: string | null;
  pages_fetched: number;
  items_fetched: number;
  items_created: number;
  items_updated: number;
  items_deleted: number;
  error_message: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'accept': 'application/json', ...(init?.headers || {}) },
    ...init
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sync API ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const cloudlabsApi = {
  health() {
    return req<{ ok: boolean; partnerId: string; tokenConfigured: boolean; labsInDb: number; lastSync: SyncRun | null }>(
      '/api/health'
    );
  },
  listLabs(params: { status?: string; q?: string; includeDeleted?: boolean; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    if (params.includeDeleted) qs.set('includeDeleted', 'true');
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const url = '/api/labs' + (qs.toString() ? `?${qs}` : '');
    return req<{ total: number; count: number; items: RemoteLab[] }>(url);
  },
  getLab(id: string) {
    return req<RemoteLab>(`/api/labs/${encodeURIComponent(id)}`);
  },
  syncStatus() {
    return req<{ inFlight: boolean; latest: SyncRun | null; recent: SyncRun[] }>('/api/sync/status');
  },
  triggerSync() {
    return req<{ runId: number; pages: number; fetched: number; created: number; updated: number; deleted: number }>(
      '/api/sync/run',
      { method: 'POST' }
    );
  }
};
