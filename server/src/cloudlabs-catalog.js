import {
  AUDIT_POLICY, auditTimestamp, isAuditRecord, normalizeCloudLabsAudits,
  parseAuditTemplateIds, summarizeCloudLabsAudit, validTemplateId
} from '../../shared/cloudlabs.ts';
import { CloudLabsRequestError, connectionInfo, connectionKey, createCloudLabsAdminClient } from './cloudlabs-admin-client.js';

export class CloudLabsServiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const text = (value, max = 500) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  return result && result.length <= max && !/[\u0000-\u001f\u007f]/.test(result) ? result : null;
};

export function safeMasterDocUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // Private-repo CloudLabs URLs can contain GitHub tokens. Remove ALL query
    // credentials, including repeated/case-varied keys and signed fragments.
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|password|signature|credential|^(?:sig|key|api[-_]?key|authorization|auth|code)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function normalizeCatalog(templates, approvals, config, now = new Date()) {
  if (!Array.isArray(templates) || !Array.isArray(approvals)) throw new CloudLabsRequestError('invalid_response');
  const includePii = config.includePii === true;
  const today = now.toISOString().slice(0, 10);
  const labs = templates.map(row => {
    const templateId = text(row?.Id, 256);
    if (!templateId || !validTemplateId(templateId)) throw new CloudLabsRequestError('invalid_response');
    return {
      templateId, name: text(row.Name) || 'Untitled lab',
      owner: includePii ? text(row.OwnerEmail || row.OwnerName || row.OwnerEmailId || row.CreatedBy) : null,
      cloudPlatform: text(row.CloudPlatformName || row.SubscriptionType || row.CloudPlatform),
      masterDocUrl: safeMasterDocUrl(row.GitHubDocumentMasterFilePath || row.PreviewURL),
      active: row.IsActive !== false
    };
  });
  const deliveries = approvals.flatMap(row => {
    const timestamp = auditTimestamp(row?.Date);
    // Deliveries are calendar dates; do not shift a supplied workshop day when
    // an offset appears in its timestamp (audit events retain precise instants).
    const date = timestamp ? row.Date.slice(0, 10) : null;
    const status = text(row?.RequestStatus) || 'Pending';
    if (!date || date < today || /cancel|reject/i.test(status)) return [];
    return [{
      eventId: text(row.Id, 256), odlId: text(row.OnDemandLabId, 256), date,
      seats: typeof row.RegistrationCount === 'number' && Number.isSafeInteger(row.RegistrationCount) && row.RegistrationCount >= 0 ? row.RegistrationCount : 0,
      customer: includePii ? text(row.Customer || row.PrimaryContact) : null,
      trackTitle: text(row.TrackTitle), status,
      daysUntil: Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
    }];
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { capturedAt: now.toISOString(), partner: text(config.partnerLabel, 80), labs, deliveries };
}

// Validate persisted snapshots and reapply redaction after configuration changes.
function safeStoredSnapshot(value, config, now) {
  if (!value || !auditTimestamp(value.capturedAt) || Date.parse(value.capturedAt) > now.getTime()
    || !Array.isArray(value.labs) || !Array.isArray(value.deliveries)
    || value.labs.length > 50000 || value.deliveries.length > 50000
    || value.labs.some(lab => !validTemplateId(lab?.templateId) || typeof lab?.name !== 'string')
    || value.deliveries.some(delivery => !auditTimestamp(delivery?.date))) return null;
  const today = now.toISOString().slice(0, 10);
  return {
    capturedAt: value.capturedAt, partner: text(config.partnerLabel, 80),
    labs: value.labs.map(lab => ({
      templateId: lab.templateId, name: text(lab.name) || 'Untitled lab',
      owner: config.includePii ? text(lab.owner) : null, cloudPlatform: text(lab.cloudPlatform),
      masterDocUrl: safeMasterDocUrl(lab.masterDocUrl), active: lab.active === true
    })),
    deliveries: value.deliveries.map(delivery => ({
      eventId: text(delivery.eventId, 256), odlId: text(delivery.odlId, 256), date: delivery.date.slice(0, 10),
      seats: Number.isSafeInteger(delivery.seats) && delivery.seats >= 0 ? delivery.seats : 0,
      customer: config.includePii ? text(delivery.customer) : null, trackTitle: text(delivery.trackTitle),
      status: text(delivery.status) || 'Pending',
      daysUntil: Math.round((Date.parse(delivery.date.slice(0, 10)) - Date.parse(today)) / 86_400_000)
    }))
  };
}

export function createCloudLabsCatalogService({ config, store, client = createCloudLabsAdminClient(config), now = () => new Date() }) {
  const scope = connectionKey(config);
  let catalogRefresh = null;
  let auditBusy = false;
  const stored = () => safeStoredSnapshot(store.getCatalog(scope), config, now());
  const connection = () => connectionInfo(config, now());
  const requireConfigured = () => { if (!connection().configured) throw new CloudLabsRequestError('not_configured'); };
  const requireKnown = ids => {
    const catalog = stored();
    if (!catalog) throw new CloudLabsServiceError(409, 'Refresh the catalog for the configured CloudLabs partner first.');
    const known = new Set(catalog.labs.map(lab => lab.templateId));
    if (ids.some(id => !validTemplateId(id) || !known.has(id))) throw new CloudLabsServiceError(404, 'Template not found in this partner’s catalog.');
    return catalog;
  };
  const readAudit = templateId => {
    const value = store.getAudit(scope, templateId);
    if (!isAuditRecord(value, templateId)) return null;
    return { ...value, events: value.events.map(event => ({ ...event, actor: config.includePii ? event.actor : null })) };
  };
  const overview = templateId => ({ templateId, summary: summarizeCloudLabsAudit(readAudit(templateId), now()) });

  return {
    connection, stored,
    status: () => ({ catalogInFlight: Boolean(catalogRefresh), auditInFlight: auditBusy }),
    async refresh() {
      requireConfigured();
      if (catalogRefresh) return catalogRefresh;
      catalogRefresh = (async () => {
        // Keep the single-flight lock until both requests settle, including
        // when one fails early while the other is still reading upstream.
        const responses = await Promise.allSettled([client.templates(), client.approvals()]);
        const failed = responses.find(response => response.status === 'rejected');
        if (failed) throw failed.reason;
        const [templates, approvals] = responses.map(response => response.value);
        const snapshot = normalizeCatalog(templates, approvals, config, now());
        // One SQLite upsert is atomic. No cache change until BOTH calls and
        // normalization succeed; a timeout must never erase the previous fleet.
        store.saveCatalog(scope, snapshot);
        return snapshot;
      })();
      try { return await catalogRefresh; } finally { catalogRefresh = null; }
    },
    async template(templateId) {
      requireKnown([templateId]);
      requireConfigured();
      const raw = await client.template(templateId);
      const row = Array.isArray(raw) ? (raw.length === 1 ? raw[0] : null) : raw;
      if (!row || typeof row !== 'object' || (row.Id != null && String(row.Id) !== templateId)) throw new CloudLabsRequestError('invalid_response');
      // Do not proxy the raw template: it can contain private repository tokens.
      return { templateId, masterDocUrl: safeMasterDocUrl(row.GitHubDocumentMasterFilePath || row.PreviewURL) };
    },
    overview() { return (stored()?.labs ?? []).map(lab => overview(lab.templateId)); },
    audit(templateId) {
      requireKnown([templateId]);
      const record = readAudit(templateId);
      return { templateId, record, summary: summarizeCloudLabsAudit(record, now()) };
    },
    async refreshAudits(body) {
      const ids = parseAuditTemplateIds(body);
      if (!ids) throw new CloudLabsServiceError(400, 'Provide 1–5 valid template IDs in templateIds.');
      requireKnown(ids);
      requireConfigured();
      if (auditBusy) throw new CloudLabsServiceError(409, 'Another audit refresh is running. Try again shortly.');
      auditBusy = true;
      try {
        const results = new Array(ids.length);
        let index = 0;
        const workers = await Promise.allSettled(Array.from({ length: Math.min(3, ids.length) }, async () => {
          while (index < ids.length) {
            const i = index++;
            const templateId = ids[i];
            const previous = readAudit(templateId);
            const timestamp = now();
            const elapsed = previous ? timestamp.getTime() - Date.parse(previous.attemptedAt) : Infinity;
            let record = previous;
            if (!record || elapsed < 0 || elapsed >= AUDIT_POLICY.refreshCooldownSeconds * 1000) {
              const attemptedAt = timestamp.toISOString();
              try {
                const payload = await client.audits(templateId);
                let events;
                try { events = normalizeCloudLabsAudits(payload, config.includePii); }
                catch { throw new CloudLabsRequestError('invalid_response'); }
                record = { version: 1, templateId, attemptedAt, fetchedAt: attemptedAt, errorCode: null, events };
              } catch (error) {
                record = {
                  version: 1, templateId, attemptedAt, fetchedAt: previous?.fetchedAt ?? null,
                  errorCode: error instanceof CloudLabsRequestError ? error.code : 'unavailable', events: previous?.events ?? []
                };
              }
              store.saveAudit(scope, templateId, record);
            }
            results[i] = { templateId, summary: summarizeCloudLabsAudit(record, timestamp) };
          }
        }));
        const failed = workers.find(worker => worker.status === 'rejected');
        if (failed) throw failed.reason;
        return results;
      } finally { auditBusy = false; }
    }
  };
}