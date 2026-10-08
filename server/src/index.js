import { createServer } from './server.js';
import { startScheduler } from './scheduler.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createServer();
app.listen(config.port, config.host, () => {
  logger.info('http.listening', {
    port: config.port,
    host: config.host,
    partnerId: config.partnerId,
    apiBase: config.apiBase,
    tokenConfigured: !!config.accessToken,
    adminCatalogConfigured: !!(config.admin.token && config.admin.roleId && config.admin.tenantId)
  });
  startScheduler();
});
