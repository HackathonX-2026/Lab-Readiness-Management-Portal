// Thin client for the local sync-server backend.
// The Vite dev server proxies `/api` to http://localhost:3001 (see vite.config.ts).
// In production, place the sync-server behind the same reverse proxy as the SPA
// so `/api` resolves without hardcoding a hostname.
import type { AuditOverview, AuditSummary, CatalogSnapshot, CloudLabsAuditRecord, CloudLabsConnection } from '../../shared/cloudlabs';
export type { AuditOverview, AuditSummary, CatalogLab, CatalogDelivery, CatalogSnapshot, CloudLabsAuditRecord, CloudLabsConnection } from '../../shared/cloudlabs';

export interface CatalogResponse {
  snapshot: CatalogSnapshot | null;
  connection: CloudLabsConnection;
  configured: boolean;
  canRefresh: boolean;
  catalogInFlight: boolean;
  auditInFlight: boolean;
}
export interface CloudLabsHealth {
  ok: boolean;
  partnerId: string;
  tokenConfigured: boolean;
  workshopConfigured: boolean;
  canSync: boolean;
  catalogConnection: CloudLabsConnection;
  labsInDb: number;
  lastSync: SyncRun | null;
}

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
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers || {}) },
      cache: 'no-store', signal: init?.signal ?? AbortSignal.timeout(120000)
    });
  } catch {
    throw new Error('Unable to reach the sync server. Check that the backend is running, then retry.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(typeof data?.error === 'string' ? data.error.slice(0, 400) : `Sync server returned HTTP ${res.status}.`);
  }
  return res.json() as Promise<T>;
}

export const cloudlabsApi = {
  health() {
    return req<CloudLabsHealth>('/api/health');
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
  },
  catalog() { return req<CatalogResponse>('/api/cloudlabs'); },
  catalogConnection() { return req<CloudLabsConnection>('/api/cloudlabs/connection'); },
  refreshCatalog() {
    return req<{ snapshot: CatalogSnapshot; connection: CloudLabsConnection; configured: boolean; labs: number; deliveries: number }>(
      '/api/cloudlabs', { method: 'POST' }
    );
  },
  templateDetails(templateId: string) {
    return req<{ templateId: string; masterDocUrl: string | null }>(`/api/cloudlabs/templates/${encodeURIComponent(templateId)}`);
  },
  auditOverview() { return req<{ items: AuditOverview[] }>('/api/cloudlabs/audits/overview'); },
  audit(templateId: string) {
    return req<{ templateId: string; record: CloudLabsAuditRecord | null; summary: AuditSummary }>(
      `/api/cloudlabs/audits?${new URLSearchParams({ templateId })}`
    );
  },
  refreshAudits(templateIds: string[]) {
    return req<{ items: AuditOverview[]; ok: boolean }>('/api/cloudlabs/audits', {
      method: 'POST', body: JSON.stringify({ templateIds })
    });
  }
};
