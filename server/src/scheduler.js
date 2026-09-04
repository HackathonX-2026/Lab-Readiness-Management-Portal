import cron from 'node-cron';
import { runSync } from './sync.js';
import { checkAndSendOverdueAlerts } from './alert-scheduler.js';
import { config } from './config.js';
import { logger } from './logger.js';

export function startScheduler() {
  if (!cron.validate(config.syncCron)) {
    logger.error('scheduler.invalid_cron', { expression: config.syncCron });
    return;
  }
  
  // Data sync scheduler
  cron.schedule(config.syncCron, async () => {
    try {
      await runSync();
    } catch (e) {
      logger.error('scheduler.tick_failed', { error: e.message });
    }
  });
  logger.info('scheduler.started', { cron: config.syncCron });

  // Email alert scheduler (runs every 30 minutes by default or on custom cron)
  if (cron.validate(config.emailAlertCron)) {
    cron.schedule(config.emailAlertCron, async () => {
      try {
        await checkAndSendOverdueAlerts();
      } catch (e) {
        logger.error('scheduler.alert_tick_failed', { error: e.message });
      }
    });
    logger.info('scheduler.alerts_started', { cron: config.emailAlertCron });
  }

  if (config.syncOnStart) {
    // Kick off a first run without blocking startup.
    setImmediate(async () => {
      try {
        await runSync();
      } catch (e) {
        logger.error('scheduler.initial_sync_failed', { error: e.message });
      }
    });
  }
}
