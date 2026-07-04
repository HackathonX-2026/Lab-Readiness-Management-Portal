import cron from 'node-cron';
import { runSync } from './sync.js';
import { config } from './config.js';
import { logger } from './logger.js';

export function startScheduler() {
  if (!cron.validate(config.syncCron)) {
    logger.error('scheduler.invalid_cron', { expression: config.syncCron });
    return;
  }
  cron.schedule(config.syncCron, async () => {
    try {
      await runSync();
    } catch (e) {
      logger.error('scheduler.tick_failed', { error: e.message });
    }
  });
  logger.info('scheduler.started', { cron: config.syncCron });

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
