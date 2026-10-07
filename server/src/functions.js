import { app } from '@azure/functions';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { config } from './config.js';
import { countLabs, latestSyncRun, listLabs, recentSyncRuns } from './db-azure.js';
import { isSyncInFlight, runSync } from './sync.js';
import { logger } from './logger.js';

const siteRoot = resolve(process.cwd(), 'wwwroot');
const json = (jsonBody, status = 200) => ({ status, jsonBody });

app.timer('cloudLabsSyncTimer', {
  schedule: process.env.SYNC_TIMER_SCHEDULE || '0 */10 * * * *',
  runOnStartup: config.syncOnStart,
  handler: async (_timer, context) => {
    try {
      await runSync();
    } catch (error) {
      context.error('Scheduled CloudLabs sync failed.', error);
      logger.error('scheduler.tick_failed', { error: error.message });
    }
  }
});

app.http('frontend', {
  route: '{*path}',
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async request => {
    const requestedPath = request.params.path || '';
    let relativePath;
    try {
      relativePath = decodeURIComponent(requestedPath);
    } catch {
      return { status: 400, body: 'Invalid path.' };
    }

    if (relativePath === 'api/health' && request.method === 'GET') {
      return json({
        ok: true,
        partnerId: config.partnerId,
        tokenConfigured: !!config.accessToken,
        labsInDb: await countLabs(),
        lastSync: await latestSyncRun()
      });
    }
    if (relativePath === 'api/labs' && request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      const includeDeleted = params.get('includeDeleted') === 'true';
      const limit = Math.min(10000, parseInt(params.get('limit') || '5000', 10) || 5000);
      const offset = parseInt(params.get('offset') || '0', 10) || 0;
      const rows = await listLabs({
        status: params.get('status') || undefined,
        q: params.get('q') || undefined,
        includeDeleted,
        limit,
        offset
      });
      return json({
        total: await countLabs({ includeDeleted }),
        count: rows.length,
        items: rows.map(shapeLab)
      });
    }
    if (relativePath.startsWith('api/labs/') && request.method === 'GET') {
      const id = relativePath.slice('api/labs/'.length);
      const rows = await listLabs({ limit: 10000 });
      const row = rows.find(lab => lab.id === id);
      return row ? json(shapeLab(row)) : json({ error: 'not_found' }, 404);
    }
    if (relativePath === 'api/sync/status' && request.method === 'GET') {
      return json({
        inFlight: isSyncInFlight(),
        latest: await latestSyncRun(),
        recent: await recentSyncRuns(10)
      });
    }
    if (relativePath === 'api/sync/run' && request.method === 'POST') {
      if (process.env.PUBLIC_ACCESS === 'true') {
        return json({ error: 'manual_sync_disabled' }, 403);
      }
      if (isSyncInFlight()) return json({ error: 'sync_in_flight' }, 409);
      try {
        return json(await runSync());
      } catch (error) {
        return json({ error: error.message }, error.isAuth ? 401 : 500);
      }
    }
    if (relativePath === 'api' || relativePath.startsWith('api/')) {
      return { status: 404, body: 'Not found.' };
    }
    if (request.method !== 'GET') return { status: 405, body: 'Method not allowed.' };

    let filePath = resolve(siteRoot, relativePath || 'index.html');
    if (filePath !== siteRoot && !filePath.startsWith(`${siteRoot}${sep}`)) {
      return { status: 400, body: 'Invalid path.' };
    }
    try {
      const body = await readFile(filePath);
      return { body, headers: { 'content-type': contentType(filePath) } };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (extname(relativePath)) return { status: 404, body: 'Not found.' };
      return {
        body: await readFile(resolve(siteRoot, 'index.html')),
        headers: { 'content-type': 'text/html; charset=utf-8' }
      };
    }
  }
});

function contentType(path) {
  const extension = extname(path).toLowerCase();
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  })[extension] || 'application/octet-stream';
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