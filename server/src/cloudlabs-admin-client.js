import { createHash } from 'node:crypto';
import { CLOUDLABS_ERRORS, validTemplateId } from '../../shared/cloudlabs.ts';

export class CloudLabsRequestError extends Error {
  constructor(code) {
    super(CLOUDLABS_ERRORS[code] ?? CLOUDLABS_ERRORS.unavailable);
    this.name = 'CloudLabsRequestError';
    this.code = code;
  }
}

// Expiry is metadata, not token verification. CloudLabs remains the authority.
export function connectionInfo(config, now = new Date()) {
  let expiry = Date.parse(config.expiresAt || '');
  try {
    const payload = JSON.parse(Buffer.from(config.token.split('.')[1], 'base64url').toString('utf8'));
    const jwtExpiry = typeof payload.exp === 'number' ? payload.exp * 1000 : NaN;
    if (Number.isFinite(jwtExpiry)) expiry = Number.isFinite(expiry) ? Math.min(expiry, jwtExpiry) : jwtExpiry;
  } catch { /* Opaque service credentials may have no inspectable expiry. */ }
  const known = Number.isFinite(expiry) && Math.abs(expiry) <= 8.64e15;
  const expired = known && expiry <= now.getTime();
  const temporary = config.authSource === 'browser-session';
  const tokenSaved = Boolean(config.token);
  const contextConfigured = Boolean(config.roleId && config.tenantId);
  return {
    configured: tokenSaved && contextConfigured && !expired && (!temporary || known),
    tokenSaved, contextConfigured, temporary,
    partner: config.partnerLabel?.slice(0, 80) || null,
    expiresAt: known ? new Date(expiry).toISOString() : null,
    expired, expiresSoon: tokenSaved && known && !expired && expiry - now.getTime() <= 3_600_000,
    checkedAt: now.toISOString(), storage: 'server_environment', automaticRenewal: 'not_enabled'
  };
}

export function connectionKey(config) {
  return createHash('sha256').update(JSON.stringify([config.base.replace(/\/$/, ''), config.tenantId, config.roleId])).digest('hex');
}

export function createCloudLabsAdminClient(config, { fetcher = fetch, now = () => new Date() } = {}) {
  async function request(pathname, { method = 'GET', body } = {}) {
    if (!connectionInfo(config, now()).configured) throw new CloudLabsRequestError('not_configured');
    let url;
    try {
      const base = new URL(config.base);
      url = new URL(pathname, base);
      if (base.protocol !== 'https:' || base.username || base.password || url.origin !== base.origin || !url.pathname.startsWith('/api/')) throw new Error();
    } catch { throw new CloudLabsRequestError('unavailable'); }
    let response;
    try {
      response = await fetcher(url, {
        method, headers: {
          authorization: `Bearer ${config.token}`, roleid: config.roleId, tenantid: config.tenantId,
          'content-type': 'application/json;charset=UTF-8', accept: 'application/json', origin: 'https://admin.cloudlabs.ai'
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs ?? 20000)
      });
    } catch { throw new CloudLabsRequestError('unavailable'); }
    if (!response.ok) throw new CloudLabsRequestError(
      response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden'
        : response.status === 429 ? 'rate_limited' : 'unavailable'
    );
    try { return await response.json(); }
    catch { throw new CloudLabsRequestError('invalid_response'); }
  }

  // StartIndex is the PAGE SIZE, not an offset; PageCount is 1-based.
  async function paged(pathname, extra = {}) {
    const size = config.pageSize ?? 5000;
    const rows = [];
    const seen = new Set();
    for (let page = 1; page <= (config.maxPages ?? 10); page++) {
      const batch = await request(pathname, { method: 'POST', body: { State: '5', ...extra, StartIndex: size, PageCount: page } });
      if (!Array.isArray(batch) || batch.length > size) throw new CloudLabsRequestError('invalid_response');
      for (const item of batch) {
        if (!item || typeof item !== 'object' || !validTemplateId(String(item.Id ?? '')) || seen.has(String(item.Id))) {
          throw new CloudLabsRequestError('invalid_response');
        }
        seen.add(String(item.Id));
        rows.push(item);
      }
      if (batch.length < size) return rows;
    }
    // Never publish a snapshot that was silently cut off at the safety cap.
    throw new CloudLabsRequestError('invalid_response');
  }

  return {
    templates: () => paged('/api/WorkshopTemplates/GetTemplatesByFilter'),
    approvals: () => paged('/api/Requests/GetAllApprovals', { StatusFilterId: null }),
    template: templateId => {
      if (!validTemplateId(templateId)) throw new CloudLabsRequestError('invalid_response');
      return request(`/api/WorkshopTemplates/GetTemplateDataByTemplateID/${encodeURIComponent(templateId)}`);
    },
    audits: templateId => {
      if (!validTemplateId(templateId)) throw new CloudLabsRequestError('invalid_response');
      return request(`/api/TemplateAudit/GetTemplateAudit?${new URLSearchParams({ templateId })}`);
    }
  };
}