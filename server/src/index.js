import { createServer } from './server.js';
import { startScheduler } from './scheduler.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createServer();
app.listen(config.port, () => {
  logger.info('http.listening', {
    port: config.port,
    partnerId: config.partnerId,
    apiBase: config.apiBase,
    tokenConfigured: !!config.accessToken
  });
  startScheduler();
});
