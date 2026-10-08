import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { listLabs, getLab, countLabs, latestSyncRun, recentSyncRuns } from './db.js';
import { runSync, isSyncInFlight } from './sync.js';
import { cloudlabsService } from './cloudlabs-service.js';
import { createCloudLabsRouter, guardCloudLabsRefresh, canRefreshCloudLabs } from './cloudlabs-routes.js';

export function createServer({ catalogService = cloudlabsService } = {}) {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  app.use('/api/cloudlabs', createCloudLabsRouter(catalogService, config));

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      partnerId: config.partnerId,
      tokenConfigured: !!config.accessToken,
      workshopConfigured: !!(config.partnerId && config.accessToken),
      canSync: canRefreshCloudLabs(req, config),
      catalogConnection: catalogService.connection(),
      labsInDb: countLabs(),
      lastSync: latestSyncRun()
    });
  });

  app.get('/api/labs', (req, res) => {
    const { status, q, includeDeleted, limit = '5000', offset = '0' } = req.query;
    const filters = {
      status: typeof status === 'string' ? status : undefined,
      q: typeof q === 'string' ? q.slice(0, 500) : undefined,
      includeDeleted: includeDeleted === 'true',
      limit: Math.max(1, Math.min(10000, parseInt(limit, 10) || 5000)),
      offset: Math.max(0, parseInt(offset, 10) || 0)
    };
    const rows = listLabs(filters);
    res.json({
      total: countLabs(filters),
      count: rows.length,
      items: rows.map(shapeLab)
    });
  });

  app.get('/api/labs/:id', (req, res) => {
    const row = getLab(req.params.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json(shapeLab(row));
  });

  app.get('/api/sync/status', (_req, res) => {
    res.json({
      inFlight: isSyncInFlight(),
      latest: latestSyncRun(),
      recent: recentSyncRuns(10)
    });
  });

  app.post('/api/sync/run', guardCloudLabsRefresh(config), async (_req, res) => {
    if (!config.partnerId || !config.accessToken) {
      return res.status(503).json({ error: 'Configure CLOUDLABS_PARTNER_ID and CLOUDLABS_ACCESS_TOKEN for workshop sync. Catalog credentials are configured separately.' });
    }
    if (isSyncInFlight()) {
      return res.status(409).json({ error: 'sync_in_flight' });
    }
    try {
      const result = await runSync();
      res.json(result);
    } catch (e) {
      const status = e.isAuth ? 401 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    logger.error('http.unhandled', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

function shapeLab(row) {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.source_id,
    labName: row.lab_name,
    trackTitle: row.track_title,
    requestDate: row.request_date,
    deliveryDate: row.delivery_date,
    requestStatus: row.request_status,
    requestStatusRaw: row.request_status_raw,
    readinessStatus: row.readiness_status,
    environmentStatus: row.environment_status,
    ownerEmail: row.owner_email,
    primaryContact: row.primary_contact,
    customer: row.customer,
    country: row.country,
    region: row.region,
    eventType: row.event_type,
    registrationCount: row.registration_count,
    durationMinutes: row.duration_minutes,
    timeZone: row.time_zone,
    isActive: !!row.is_active,
    bitLink: row.bit_link,
    purchaseOrder: row.purchase_order,
    externalId: row.external_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}
