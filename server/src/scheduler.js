import cron from 'node-cron';
import { runSync } from './sync.js';
import { checkAndSendOverdueAlerts } from './alert-scheduler.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { cloudlabsService } from './cloudlabs-service.js';

export function startScheduler() {
  if (!cron.validate(config.syncCron)) {
    logger.error('scheduler.invalid_cron', { expression: config.syncCron });
    return;
  }
  
  // API families are independent: a catalog-only installation must not try to
  // use an admin token against vNext or continuously fail workshop sync.
  const workshopsConfigured = Boolean(config.partnerId && config.accessToken);
  if (workshopsConfigured) {
    cron.schedule(config.syncCron, async () => {
      try { await runSync(); }
      catch (e) { logger.error('scheduler.tick_failed', { error: e.message }); }
    });
    logger.info('scheduler.started', { cron: config.syncCron });
  }
  if (config.catalogSyncEnabled) {
    cron.schedule(config.syncCron, async () => {
      try { await cloudlabsService.refresh(); }
      catch { logger.warn('scheduler.catalog_refresh_failed'); }
    });
  }

  // Email alert scheduler (runs every 30 minutes by default or on custom cron)
  if (config.emailAlertsEnabled && cron.validate(config.emailAlertCron)) {
    cron.schedule(config.emailAlertCron, async () => {
      try {
        await checkAndSendOverdueAlerts();
      } catch (e) {
        logger.error('scheduler.alert_tick_failed', { error: e.message });
      }
    });
    logger.info('scheduler.alerts_started', { cron: config.emailAlertCron });
  }

  if (config.syncOnStart && workshopsConfigured) {
    // Kick off a first run without blocking startup.
    setImmediate(async () => {
      try {
        await runSync();
      } catch (e) {
        logger.error('scheduler.initial_sync_failed', { error: e.message });
      }
    });
  }
  if (config.syncOnStart && config.catalogSyncEnabled && cloudlabsService.connection().configured) {
    setImmediate(() => cloudlabsService.refresh().catch(() => logger.warn('scheduler.initial_catalog_refresh_failed')));
  }
}
