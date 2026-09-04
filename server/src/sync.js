import { cloudlabs, AuthError } from './cloudlabs.js';
import { db, upsertLab, markMissingAsDeleted, purgeOutOfWindow, insertSyncRun, finishSyncRun } from './db.js';
import { mapWorkshopRequest } from './mapper.js';
import { logger } from './logger.js';
import { config } from './config.js';

let syncInFlight = false;

/**
 * Run one full incremental sync of workshop-requests.
 *  - Paginates through the source.
 *  - Filters out records with delivery_date older than SYNC_LOOKBACK_DAYS.
 *  - Upserts each in-scope record (INSERT on new, UPDATE on change, no-op if unchanged).
 *  - Marks any local row not seen in this run as soft-deleted.
 *  - Hard-purges rows that fall outside the lookback window.
 *  - Records a row in sync_runs for audit + monitoring.
 */
export async function runSync() {
  if (syncInFlight) {
    logger.warn('sync.skip.already_running');
    return { skipped: true, reason: 'already_running' };
  }
  syncInFlight = true;

  const runId = insertSyncRun('workshop-requests');
  const startedAt = new Date().toISOString();
  const now = startedAt;

  // Compute the delivery-date cutoff. If SYNC_LOOKBACK_DAYS <= 0, no window.
  const lookbackDays = config.syncLookbackDays;
  const cutoffIso = lookbackDays > 0
    ? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const stats = { pages: 0, fetched: 0, kept: 0, skipped: 0, created: 0, updated: 0, deleted: 0, purged: 0 };

  try {
    logger.info('sync.start', { runId, source: 'workshop-requests', cutoffIso, lookbackDays });

    let pageNumber = 1;
    const pageSize = 100;
    let totalItems = null;

    while (pageNumber <= config.syncMaxPages) {
      const resp = await cloudlabs.listWorkshopRequests({ pageNumber, pageSize });
      if (!resp?.isSuccess) {
        throw new Error(`CloudLabs returned isSuccess=false: ${resp?.message || 'unknown'}`);
      }
      const items = resp.data?.value ?? [];
      totalItems = resp.data?.totalItems ?? totalItems;
      stats.pages++;
      stats.fetched += items.length;

      const applyPage = db.transaction((batch) => {
        for (const raw of batch) {
          const row = mapWorkshopRequest(raw, now);
          // Filter by delivery_date window (keep future + past N days).
          if (cutoffIso && (!row.delivery_date || row.delivery_date < cutoffIso)) {
            stats.skipped++;
            continue;
          }
          stats.kept++;
          const res = upsertLab(row);
          if (res?.change === 'created') stats.created++;
          else if (res?.change === 'updated') stats.updated++;
        }
      });
      applyPage(items);

      logger.debug('sync.page', { runId, pageNumber, items: items.length, totalItems });

      if (items.length < pageSize) break;
      pageNumber++;
    }

    // In-window rows we didn't touch this run are considered removed at the source.
    stats.deleted = markMissingAsDeleted('workshop-request', startedAt, now);

    // Hard-purge rows that were valid previously but now fall outside the window
    // (delivery_date drifted into the past, or the window changed via .env).
    if (cutoffIso) {
      stats.purged = purgeOutOfWindow('workshop-request', cutoffIso);
    }

    finishSyncRun(runId, {
      status: 'success',
      pages_fetched: stats.pages,
      items_fetched: stats.fetched,
      items_created: stats.created,
      items_updated: stats.updated,
      items_deleted: stats.deleted + stats.purged,
      error_message: null
    });

    logger.info('sync.done', { runId, ...stats, totalItems });
    return { runId, ...stats, totalItems };
  } catch (err) {
    logger.error('sync.error', { runId, error: err.message, isAuth: !!err.isAuth });
    finishSyncRun(runId, {
      status: 'failed',
      pages_fetched: stats.pages,
      items_fetched: stats.fetched,
      items_created: stats.created,
      items_updated: stats.updated,
      items_deleted: stats.deleted,
      error_message: err.message
    });
    throw err;
  } finally {
    syncInFlight = false;
  }
}

export function isSyncInFlight() { return syncInFlight; }
