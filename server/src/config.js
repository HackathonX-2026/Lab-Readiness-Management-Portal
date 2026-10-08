import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Resolve .env relative to the server package root so `cwd` doesn't matter.
const __dirname = dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV !== 'test') loadDotenv({ path: resolve(__dirname, '..', '.env') });

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export const config = {
  // Either API family can be configured independently. Cached reads and health
  // must remain available when neither credential has been supplied yet.
  partnerId: optional('CLOUDLABS_PARTNER_ID', ''),
  apiBase: optional('CLOUDLABS_API_BASE', 'https://api-vnext.cloudlabs.ai').replace(/\/$/, ''),
  accessToken: optional('CLOUDLABS_ACCESS_TOKEN', ''),
  admin: {
    base: optional('CLOUDLABS_BASE', 'https://api.cloudlabs.ai').replace(/\/$/, ''),
    token: optional('CLOUDLABS_TOKEN', ''),
    roleId: optional('CLOUDLABS_ROLEID', ''),
    tenantId: optional('CLOUDLABS_TENANTID', ''),
    partnerLabel: optional('CLOUDLABS_PARTNER_LABEL', ''),
    authSource: optional('CLOUDLABS_AUTH_SOURCE', ''),
    expiresAt: optional('CLOUDLABS_TOKEN_EXPIRES_AT', ''),
    includePii: optional('CLOUDLABS_INCLUDE_PII', '0') === '1',
    pageSize: 5000,
    maxPages: 10,
    timeoutMs: 20000
  },
  refreshApiKey: optional('CLOUDLABS_REFRESH_API_KEY', optional('SCAN_API_KEY', '')),
  catalogSyncEnabled: optional('CLOUDLABS_CATALOG_SYNC_ENABLED', 'false') === 'true',
  syncCron: optional('SYNC_CRON', '*/10 * * * *'),
  syncOnStart: optional('SYNC_ON_START', 'true') === 'true',
  syncMaxPages: parseInt(optional('SYNC_MAX_PAGES', '200'), 10),
  syncLookbackDays: parseInt(optional('SYNC_LOOKBACK_DAYS', '20'), 10),
  dbPath: optional('DB_PATH', './data/sync.db'),
  port: parseInt(optional('PORT', '3001'), 10),
  host: optional('HOST', '127.0.0.1'),
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim()).filter(Boolean),
  logLevel: optional('LOG_LEVEL', 'info'),
  // Email alert settings
  emailAlertCron: optional('EMAIL_ALERT_CRON', '*/30 * * * *'), // Every 30 minutes by default
  emailAlertsEnabled: optional('EMAIL_ALERTS_ENABLED', 'false') === 'true',
  smtpHost: optional('SMTP_HOST', ''),
  smtpPort: parseInt(optional('SMTP_PORT', '587'), 10),
  smtpSecure: optional('SMTP_SECURE', 'false') === 'true',
  smtpUser: optional('SMTP_USER', ''),
  smtpPass: optional('SMTP_PASS', ''),
  smtpFrom: optional('SMTP_FROM', 'lab-readiness@cloudlabs.local')
};
