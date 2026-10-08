import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { CloudLabsRequestError } from './cloudlabs-admin-client.js';
import { CloudLabsServiceError } from './cloudlabs-catalog.js';
import { validTemplateId } from '../../shared/cloudlabs.ts';

export function canRefreshCloudLabs(req, config) {
  if (!config.refreshApiKey) return true;
  const supplied = req.get('x-api-key') ?? '';
  return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(config.refreshApiKey).digest());
}

export function guardCloudLabsRefresh(config) {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && !config.corsOrigins.includes(origin)) return res.status(403).json({ error: 'Origin is not allowed.' });
    if (!canRefreshCloudLabs(req, config)) return res.status(401).json({ error: 'A server-authorized x-api-key header is required for refresh operations.' });
    next();
  };
}

export function createCloudLabsRouter(service, config) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const guarded = guardCloudLabsRefresh(config);
  const reply = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof CloudLabsServiceError) return res.status(error.status).json({ error: error.message });
      if (error instanceof CloudLabsRequestError) {
        const status = { not_configured: 503, unauthorized: 401, forbidden: 403, rate_limited: 429 }[error.code] ?? 502;
        return res.status(status).json({ error: error.message, code: error.code });
      }
      // Disk errors and unexpected provider messages may contain sensitive data.
      res.status(503).json({ error: 'Unable to complete the CloudLabs check. Stored results must not be treated as newly verified.' });
    }
  };
  router.get('/', reply((req, res) => {
    const connection = service.connection();
    res.json({ snapshot: service.stored(), connection, configured: connection.configured, canRefresh: canRefreshCloudLabs(req, config), ...service.status() });
  }));
  router.get('/connection', (_req, res) => res.json(service.connection()));
  router.post('/', guarded, reply(async (_req, res) => {
    const snapshot = await service.refresh();
    res.json({ snapshot, connection: service.connection(), configured: true, labs: snapshot.labs.length, deliveries: snapshot.deliveries.length });
  }));
  router.get('/templates/:templateId', guarded, reply(async (req, res) => res.json(await service.template(req.params.templateId))));
  router.get('/audits/overview', reply((_req, res) => res.json({ items: service.overview() })));
  router.get('/audits', reply((req, res) => {
    if (!validTemplateId(req.query.templateId)) throw new CloudLabsServiceError(400, 'A valid templateId is required.');
    res.json(service.audit(req.query.templateId));
  }));
  router.post('/audits', guarded, reply(async (req, res) => {
    const items = await service.refreshAudits(req.body);
    res.json({ items, ok: items.every(item => item.summary.availability === 'current') });
  }));
  return router;
}