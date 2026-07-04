import { config } from './config.js';
import { logger } from './logger.js';

class AuthError extends Error {
  constructor(msg) { super(msg); this.name = 'AuthError'; this.isAuth = true; }
}

function getToken() {
  if (!config.accessToken) {
    throw new AuthError(
      'CLOUDLABS_ACCESS_TOKEN is not set. Paste a bearer token into server/.env (see README).'
    );
  }
  return config.accessToken;
}

function isTokenLikelyExpired(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) return true;
  } catch {}
  return false;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Low-level HTTP call with retry + backoff. Returns parsed JSON body.
 * Throws AuthError on 401/403 so the caller can surface a clear message.
 */
async function callApi(method, path, body, attempt = 1) {
  const token = getToken();
  if (isTokenLikelyExpired(token)) {
    throw new AuthError('CLOUDLABS_ACCESS_TOKEN appears expired. Please refresh it in .env.');
  }
  const url = `${config.apiBase}${path}`;
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'authorization': `Bearer ${token}`,
        'accept': 'application/json',
        'content-type': 'application/json',
        'origin': 'https://admin-vnext.cloudlabs.ai',
        'referer': 'https://admin-vnext.cloudlabs.ai/'
      },
      body: body != null ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    if (attempt >= 4) throw e;
    const backoff = 500 * 2 ** attempt;
    logger.warn('cloudlabs.network_error', { path, attempt, backoff, error: e.message });
    await sleep(backoff);
    return callApi(method, path, body, attempt + 1);
  }

  const durationMs = Date.now() - started;
  if (res.status === 401 || res.status === 403) {
    throw new AuthError(`CloudLabs returned ${res.status} on ${path}. Token likely invalid or missing scope.`);
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) {
      throw new Error(`CloudLabs ${res.status} on ${path} after ${attempt} attempts`);
    }
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10) * 1000;
    const backoff = retryAfter || (500 * 2 ** attempt);
    logger.warn('cloudlabs.retryable_error', { path, status: res.status, attempt, backoff });
    await sleep(backoff);
    return callApi(method, path, body, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CloudLabs ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  logger.debug('cloudlabs.call', { path, status: res.status, durationMs });
  return json;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers. Only what we actually need for the sync + dashboard.
// Extend as the app needs more pages.
// ---------------------------------------------------------------------------
const P = () => `/api/partners/${config.partnerId}`;

export const cloudlabs = {
  // The primary lab dataset — workshop requests (deliveries scheduled by customers).
  async listWorkshopRequests({ pageNumber = 1, pageSize = 100 } = {}) {
    return callApi('POST', `${P()}/workshop-requests/list`, { pageNumber, pageSize });
  },

  // On-demand labs (reusable lab templates in "labs" list).
  async listLabs({ pageNumber = 1, pageSize = 100, state = 'All' } = {}) {
    return callApi('POST', `${P()}/labs/list`, { pageNumber, pageSize, state });
  },

  // Dashboard aggregates
  dashboard: {
    labRequests(filter = 'CURRENT_DAY') {
      return callApi('POST', `${P()}/dashboard/lab-requests`, {
        filter, searchFilter: '', pageNumber: 1, pageSize: 100
      });
    },
    subscriptionSummary() { return callApi('GET', `${P()}/dashboard/subscription-summary`); },
    userStats() { return callApi('POST', `${P()}/dashboard/user-stats`, {}); },
    popularLabs() { return callApi('GET', `${P()}/dashboard/popular-labs`); },
    labInstanceStats() { return callApi('GET', `${P()}/dashboard/lab-instance-stats`); }
  },

  masterData: {
    labRequestStatus() { return callApi('GET', '/api/master-data/lab-request-status'); },
    labMasterdata() { return callApi('GET', '/api/master-data/lab-masterdata'); }
  },

  partnerInfo() { return callApi('GET', P()); },
  permissions() { return callApi('GET', `/api/iam/partners/${config.partnerId}/permissions`); }
};

export { AuthError };
