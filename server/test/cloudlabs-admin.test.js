import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import { once } from 'node:events';
import { AUDIT_POLICY, normalizeCloudLabsAudits, summarizeCloudLabsAudit, auditTimestamp, auditValidation, parseAuditTemplateIds } from '../../shared/cloudlabs.ts';
import { connectionInfo, connectionKey, createCloudLabsAdminClient, CloudLabsRequestError } from '../src/cloudlabs-admin-client.js';
import { createCloudLabsCatalogService, normalizeCatalog, safeMasterDocUrl } from '../src/cloudlabs-catalog.js';
import { createCloudLabsStore } from '../src/cloudlabs-store.js';
import { createCloudLabsRouter } from '../src/cloudlabs-routes.js';

const now = new Date('2026-10-08T12:00:00Z');
const config = {
  base: 'https://api.cloudlabs.ai', token: 'fixture-token-never-log', roleId: 'fixture-role', tenantId: 'fixture-tenant',
  partnerLabel: 'Fixture partner', includePii: false, pageSize: 2, maxPages: 3, timeoutMs: 20000
};
const template = { Id: 'template-one', Name: 'Azure fundamentals', OwnerEmail: 'private@example.test', IsActive: true, CloudPlatformName: 'Azure', GitHubDocumentMasterFilePath: 'https://raw.githubusercontent.com/example/labs/master.json?token=fixture-github-token&ref=main' };
const approval = { Id: 'delivery-one', Date: '2026-10-10T00:00:00', OnDemandLabId: 'odl-one', RegistrationCount: 25, RequestStatus: 'Approved', TrackTitle: 'Cloud fundamentals', Customer: 'Private customer' };
const event = (patch = {}) => ({
  Id: 'event-one', EventType: 'LabTest', EventDate: '2026-10-06T10:00:00', CreatedBy: 'private@example.test', StatusId: 2,
  TemplateAuditLabTest: { LabvalidationStatus: 'ValidationPassed', LabOwnerReview: true }, ...patch
});
const record = (events = [event()], patch = {}) => ({
  version: 1, templateId: 'template-one', attemptedAt: now.toISOString(), fetchedAt: now.toISOString(),
  errorCode: null, events: normalizeCloudLabsAudits(events), ...patch
});
const databases = [];
function fixture(overrides = {}) {
  const db = new Database(':memory:');
  databases.push(db);
  const store = createCloudLabsStore(db);
  const client = { templates: async () => [template], approvals: async () => [approval], template: async () => template, audits: async () => [event()], ...overrides.client };
  const service = createCloudLabsCatalogService({ config: { ...config, ...overrides.config }, store, client, now: overrides.now ?? (() => now) });
  return { db, store, client, service };
}
after(() => databases.forEach(db => db.close()));

test('admin template endpoint uses exact partner headers and paging conventions', async () => {
  const calls = [];
  const client = createCloudLabsAdminClient(config, { now: () => now, fetcher: async (url, options) => {
    calls.push({ url, options });
    return Response.json(calls.length === 1 ? [template, { ...template, Id: 'template-two' }] : [{ ...template, Id: 'template-three' }]);
  } });
  assert.equal((await client.templates()).length, 3);
  assert.equal(calls[0].url.href, 'https://api.cloudlabs.ai/api/WorkshopTemplates/GetTemplatesByFilter');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { State: '5', StartIndex: 2, PageCount: 1 });
  assert.equal(JSON.parse(calls[1].options.body).PageCount, 2);
  assert.equal(calls[0].options.headers.authorization, `Bearer ${config.token}`);
  assert.equal(calls[0].options.headers.roleid, config.roleId);
  assert.equal(calls[0].options.headers.tenantid, config.tenantId);
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('approval endpoint and template/audit identifiers match reference API', async () => {
  const calls = [];
  const client = createCloudLabsAdminClient(config, { fetcher: async (url, options) => { calls.push({ url, options }); return Response.json([]); } });
  await client.approvals(); await client.template('template/one?x'); await client.audits('template/one?x');
  assert.equal(calls[0].url.pathname, '/api/Requests/GetAllApprovals');
  assert.equal(JSON.parse(calls[0].options.body).StatusFilterId, null);
  assert.equal(calls[1].url.pathname, '/api/WorkshopTemplates/GetTemplateDataByTemplateID/template%2Fone%3Fx');
  assert.equal(calls[2].url.pathname, '/api/TemplateAudit/GetTemplateAudit');
  assert.equal(calls[2].url.searchParams.get('templateId'), 'template/one?x');
  assert.equal(calls[2].options.method, 'GET');
});

for (const [status, code] of [[401, 'unauthorized'], [403, 'forbidden'], [429, 'rate_limited'], [500, 'unavailable']]) {
  test(`HTTP ${status} is sanitized and classified without reflecting provider response`, async () => {
    const client = createCloudLabsAdminClient(config, { fetcher: async () => new Response('fixture-secret-body', { status }) });
    await assert.rejects(client.templates(), error => error.code === code && !error.message.includes('fixture-secret'));
  });
}
test('network and malformed JSON errors do not leak details', async () => {
  const network = createCloudLabsAdminClient(config, { fetcher: async () => { throw new Error('fixture-token-never-log'); } });
  await assert.rejects(network.templates(), error => error.code === 'unavailable' && !error.message.includes(config.token));
  const malformed = createCloudLabsAdminClient(config, { fetcher: async () => new Response('<html>login</html>', { status: 200 }) });
  await assert.rejects(malformed.templates(), { code: 'invalid_response' });
});
test('requires independent admin token AND role/tenant context without fetching', async () => {
  let calls = 0;
  for (const field of ['token', 'roleId', 'tenantId']) {
    const client = createCloudLabsAdminClient({ ...config, [field]: '' }, { fetcher: async () => { calls++; return Response.json([]); } });
    await assert.rejects(client.templates(), { code: 'not_configured' });
  }
  assert.equal(calls, 0);
});
test('rejects insecure API origins before credentials leave process', async () => {
  let calls = 0;
  for (const base of ['http://api.cloudlabs.ai', 'https://user:password@api.cloudlabs.ai', 'not-a-url']) {
    const client = createCloudLabsAdminClient({ ...config, base }, { fetcher: async () => { calls++; return Response.json([]); } });
    await assert.rejects(client.templates(), { code: 'unavailable' });
  }
  assert.equal(calls, 0);
});
test('pagination fails closed for repeated pages, oversized batches, malformed data or cap', async () => {
  for (const payload of [[template, { ...template, Id: 'two' }], [{ Name: 'No id' }], { data: [] }, [template, { ...template, Id: 'two' }, { ...template, Id: 'three' }]]) {
    const client = createCloudLabsAdminClient(config, { fetcher: async () => Response.json(payload) });
    await assert.rejects(client.templates(), { code: 'invalid_response' });
  }
  const client = createCloudLabsAdminClient({ ...config, maxPages: 1 }, { fetcher: async () => Response.json([template, { ...template, Id: 'two' }]) });
  await assert.rejects(client.templates(), { code: 'invalid_response' });
});
test('exact page-size multiples complete on a final empty page', async () => {
  let page = 0;
  const client = createCloudLabsAdminClient(config, { fetcher: async () => {
    page++;
    return Response.json(page <= 2 ? [0, 1].map(i => ({ ...template, Id: `page-${page}-${i}` })) : []);
  } });
  assert.equal((await client.templates()).length, 4); assert.equal(page, 3);
});
test('connection metadata does not disclose token or partner context identifiers', () => {
  const info = connectionInfo(config, now);
  assert.equal(info.configured, true);
  for (const secret of [config.token, config.roleId, config.tenantId]) assert.ok(!JSON.stringify(info).includes(secret));
  assert.equal(info.automaticRenewal, 'not_enabled');
});
test('expiry metadata rejects stale/unknown browser sessions and reads JWT expiry', () => {
  assert.equal(connectionInfo({ ...config, authSource: 'browser-session' }, now).configured, false);
  assert.equal(connectionInfo({ ...config, authSource: 'browser-session', expiresAt: '2026-10-08T11:00:00Z' }, now).expired, true);
  const token = `fixture.${Buffer.from(JSON.stringify({ exp: now.getTime() / 1000 + 1800 })).toString('base64url')}.unsigned`;
  const info = connectionInfo({ ...config, token, authSource: 'browser-session' }, now);
  assert.equal(info.configured, true); assert.equal(info.expiresSoon, true);
  assert.equal(connectionInfo({ ...config, token, expiresAt: '2026-10-01T00:00:00Z' }, now).configured, false);
});
test('connection scope changes with partner/role/origin but not token rotation', () => {
  assert.equal(connectionKey(config), connectionKey({ ...config, token: 'rotated' }));
  for (const field of ['tenantId', 'roleId', 'base']) assert.notEqual(connectionKey(config), connectionKey({ ...config, [field]: `${config[field]}-different` }));
});
test('master-document URLs remove repeated credentials and reject dangerous URLs', () => {
  const url = safeMasterDocUrl('https://example.test/master.json?TOKEN=private&token=second&access_token=third&sig=fourth&X-Amz-Credential=fifth&ref=main#secret');
  assert.equal(url, 'https://example.test/master.json?ref=main');
  for (const bad of ['javascript:alert(1)', 'http://example.test', 'https://user:pass@example.test/x', '/relative']) assert.equal(safeMasterDocUrl(bad), null);
});
test('normalization redacts personal data and does not join ODL IDs to template IDs', () => {
  const snapshot = normalizeCatalog([template], [approval], config, now);
  assert.equal(snapshot.labs[0].owner, null); assert.equal(snapshot.deliveries[0].customer, null);
  assert.equal(snapshot.labs[0].masterDocUrl, 'https://raw.githubusercontent.com/example/labs/master.json?ref=main');
  assert.equal(snapshot.deliveries[0].odlId, 'odl-one'); assert.equal(snapshot.deliveries[0].daysUntil, 2);
  assert.equal(snapshot.partner, 'Fixture partner');
  assert.ok(!JSON.stringify(snapshot).includes(config.tenantId));
  const enabled = normalizeCatalog([template], [approval], { ...config, includePii: true }, now);
  assert.equal(enabled.labs[0].owner, template.OwnerEmail);
});
test('upcoming approvals exclude past/cancelled/rejected and preserve calendar day', () => {
  const deliveries = normalizeCatalog([], [approval, { ...approval, Date: '2026-01-01' }, { ...approval, RequestStatus: 'Cancelled' }, { ...approval, RequestStatus: 'Rejected' }, { ...approval, Date: 'invalid' }], config, now).deliveries;
  assert.equal(deliveries.length, 1);
  const offset = normalizeCatalog([], [{ ...approval, Date: '2026-10-10T00:00:00+05:30' }], config, now);
  assert.equal(offset.deliveries[0].date, '2026-10-10');
});
test('catalog refresh publishes only complete normalized snapshots and preserves last good cache', async () => {
  const { service, client, db } = fixture();
  const first = await service.refresh();
  assert.deepEqual(service.stored(), first);
  const persisted = db.prepare('SELECT snapshot_json FROM cloudlabs_catalog').get().snapshot_json;
  assert.ok(!persisted.includes('fixture-github-token')); assert.ok(!persisted.includes('private@example.test'));
  client.approvals = async () => { throw new CloudLabsRequestError('unavailable'); };
  await assert.rejects(service.refresh(), { code: 'unavailable' });
  assert.deepEqual(service.stored(), first);
});
test('catalog refresh is single flight and does not overlap callers', async () => {
  let release;
  let calls = 0;
  const wait = new Promise(resolve => { release = resolve; });
  const { service } = fixture({ client: { templates: async () => { calls++; await wait; return [template]; } } });
  const first = service.refresh(); const second = service.refresh();
  assert.equal(service.status().catalogInFlight, true);
  release();
  assert.deepEqual(await first, await second); assert.equal(calls, 1);
  assert.equal(service.status().catalogInFlight, false);
});
test('failed catalog refresh holds the lock until the other upstream read settles', async () => {
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const { service } = fixture({ client: {
    templates: async () => { calls++; throw new CloudLabsRequestError('unavailable'); },
    approvals: async () => { await gate; return [approval]; }
  } });
  const first = assert.rejects(service.refresh(), { code: 'unavailable' });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(service.status().catalogInFlight, true);
  const second = assert.rejects(service.refresh(), { code: 'unavailable' });
  release(); await Promise.all([first, second]);
  assert.equal(calls, 1); assert.equal(service.status().catalogInFlight, false);
});
test('partner-scoped cache does not bleed across connections and redacts on reread', async () => {
  const { service, store } = fixture({ config: { includePii: true } });
  await service.refresh();
  const other = createCloudLabsCatalogService({ config: { ...config, tenantId: 'another-partner' }, store, now: () => now });
  assert.equal(other.stored(), null);
  const redacted = createCloudLabsCatalogService({ config, store, now: () => now });
  assert.equal(redacted.stored().labs[0].owner, null);
});
test('template details are allowlisted and require exact catalog membership', async () => {
  const { service } = fixture(); await service.refresh();
  assert.deepEqual(await service.template('template-one'), { templateId: 'template-one', masterDocUrl: 'https://raw.githubusercontent.com/example/labs/master.json?ref=main' });
  await assert.rejects(service.template('unknown'), { status: 404 });
});
test('audit query validation limits batches and rejects empty/control IDs', () => {
  assert.deepEqual(parseAuditTemplateIds({ templateIds: ['one', 'one', 'two'] }), ['one', 'two']);
  for (const ids of [[], [''], ['has space'], ['has\ncontrol'], new Array(6).fill('one'), [null], [1]]) assert.equal(parseAuditTemplateIds({ templateIds: ids }), null);
});
test('date parsing preserves full timestamps and rejects impossible days', () => {
  assert.equal(auditTimestamp('2026-10-06T10:00:00'), '2026-10-06T10:00:00.000Z');
  assert.equal(auditTimestamp('2026-10-06T10:00:00+05:30'), '2026-10-06T04:30:00.000Z');
  assert.equal(auditTimestamp('2026-02-30'), null);
});
test('validation requires explicit pass; completed does not imply passing', () => {
  for (const value of [null, true, 2, 'not failed', 'complete']) assert.equal(auditValidation(value), 'unknown');
  const summary = summarizeCloudLabsAudit(record([event({ TemplateAuditLabTest: { LabvalidationStatus: 'ValidationFailed', LabOwnerReview: true } })]), now);
  assert.equal(summary.completion, 'completed'); assert.equal(summary.validation, 'failed'); assert.equal(summary.checksMet, false);
});
test('summary requires completion, validation and owner signoff', () => {
  assert.equal(summarizeCloudLabsAudit(record(), now).checksMet, true);
  const pending = record([event({ TemplateAuditLabTest: { LabvalidationStatus: 'Passed', LabOwnerReview: false } })]);
  assert.equal(summarizeCloudLabsAudit(pending, now).review, 'pending');
  assert.equal(summarizeCloudLabsAudit(pending, now).checksMet, false);
});
test('failed or stale checks retain history but never present last-known as current', () => {
  const failed = summarizeCloudLabsAudit(record(undefined, { errorCode: 'unauthorized' }), now);
  assert.equal(failed.availability, 'sync_failed'); assert.equal(failed.completion, 'unknown'); assert.equal(failed.checksMet, false);
  const stale = summarizeCloudLabsAudit(record(undefined, { fetchedAt: '2026-10-06T00:00:00Z' }), now);
  assert.equal(stale.availability, 'stale'); assert.equal(stale.validation, 'unknown');
});
test('unknown event types, future dates, missing dates and conflicting latest tests fail closed', () => {
  for (const events of [[event({ EventType: 'Unrecognized' })], [event({ EventDate: '2026-12-01' })], [event({ EventDate: null })], [event(), event({ StatusId: 1 })]]) {
    const summary = summarizeCloudLabsAudit(record(events), now);
    assert.equal(summary.availability, 'invalid'); assert.equal(summary.checksMet, false);
  }
});
test('latest test order is timestamp based; reviews only apply to that test', () => {
  const events = [event(), event({ EventDate: '2026-10-07', StatusId: 1 }), event({ EventType: 'Review', EventDate: '2026-10-06T12:00:00Z' })];
  assert.equal(summarizeCloudLabsAudit(record(events.reverse()), now).completion, 'in_progress');
});
test('later review failure overrides prior test owner flag', () => {
  const events = [event(), event({ EventType: 'Review', EventDate: '2026-10-07', TemplateAuditLabTest: { LabvalidationStatus: 'Failed' } })];
  const summary = summarizeCloudLabsAudit(record(events), now);
  assert.equal(summary.review, 'pending'); assert.equal(summary.checksMet, false);
});
test('audit freshness follows 15/45/60/90-day reference policy', () => {
  for (const [days, expected] of [[15, 'recent'], [16, 'retest_suggested'], [45, 'retest_suggested'], [46, 'current'], [61, 'aging'], [91, 'stale']]) {
    const at = new Date(now.getTime() - days * 86400000).toISOString();
    assert.equal(summarizeCloudLabsAudit(record([event({ EventDate: at })]), now).freshness, expected);
  }
});
test('successful empty history is distinct from malformed payload', () => {
  assert.equal(summarizeCloudLabsAudit(record([]), now).completion, 'not_recorded');
  assert.throws(() => normalizeCloudLabsAudits({ data: [] }));
  assert.throws(() => normalizeCloudLabsAudits([{}]));
});
test('audit refresh enforces partner membership and per-template cooldown', async () => {
  let calls = 0;
  const { service } = fixture({ client: { audits: async () => { calls++; return [event()]; } } });
  await assert.rejects(service.refreshAudits({ templateIds: ['template-one'] }), { status: 409 });
  await service.refresh();
  await assert.rejects(service.refreshAudits({ templateIds: ['unknown'] }), { status: 404 });
  const first = await service.refreshAudits({ templateIds: ['template-one'] });
  const second = await service.refreshAudits({ templateIds: ['template-one'] });
  assert.equal(calls, 1); assert.equal(first[0].summary.checksMet, true); assert.deepEqual(first, second);
  assert.equal(service.audit('template-one').record.events[0].actor, null);
});
test('audit outage retains last successful history with an unknown current result', async () => {
  let clock = now;
  const { service, client } = fixture({ now: () => clock });
  await service.refresh(); await service.refreshAudits({ templateIds: ['template-one'] });
  clock = new Date(now.getTime() + (AUDIT_POLICY.refreshCooldownSeconds + 1) * 1000);
  client.audits = async () => { throw new CloudLabsRequestError('forbidden'); };
  await service.refreshAudits({ templateIds: ['template-one'] });
  const result = service.audit('template-one');
  assert.equal(result.record.events.length, 1); assert.equal(result.record.fetchedAt, now.toISOString());
  assert.equal(result.summary.availability, 'sync_failed'); assert.equal(result.summary.validation, 'unknown');
});
test('audit concurrency rejects overlapping batches and releases after completion', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { service } = fixture({ client: { audits: async () => { await gate; return [event()]; } } });
  await service.refresh();
  const first = service.refreshAudits({ templateIds: ['template-one'] });
  await assert.rejects(service.refreshAudits({ templateIds: ['template-one'] }), { status: 409 });
  release(); await first; assert.equal(service.status().auditInFlight, false);
});
test('corrupt audit cache is unknown rather than trusted as verified', async () => {
  const { service, store } = fixture(); await service.refresh();
  store.saveAudit(connectionKey(config), 'template-one', { ...record(), events: [{ type: 'Test', validation: 'not failed' }] });
  assert.equal(service.audit('template-one').record, null);
  assert.equal(service.audit('template-one').summary.availability, 'not_checked');
});

test('HTTP catalog/audit routes expose safe data, guard refresh and return useful failures', async () => {
  const { service } = fixture();
  const app = express(); app.use(express.json());
  const settings = { corsOrigins: ['http://localhost:5173'], refreshApiKey: 'fixture-refresh-key' };
  app.use('/api/cloudlabs', createCloudLabsRouter(service, settings));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/cloudlabs`;
  try {
    const first = await fetch(base); assert.equal(first.headers.get('cache-control'), 'private, no-store');
    const body = await first.json(); assert.equal(body.snapshot, null); assert.equal(body.canRefresh, false);
    assert.ok(!JSON.stringify(body).includes(config.token)); assert.ok(!JSON.stringify(body).includes(config.roleId));
    assert.equal((await fetch(base, { method: 'POST' })).status, 401);
    assert.equal((await fetch(base, { method: 'POST', headers: { 'x-api-key': settings.refreshApiKey, origin: 'https://untrusted.test' } })).status, 403);
    assert.equal((await fetch(base, { method: 'POST', headers: { 'x-api-key': settings.refreshApiKey, origin: 'http://localhost:5173' } })).status, 200);
    assert.equal((await fetch(`${base}/audits?templateId=unknown`)).status, 404);
    assert.equal((await fetch(`${base}/audits?templateId=`)).status, 400);
    const audit = await fetch(`${base}/audits`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': settings.refreshApiKey }, body: JSON.stringify({ templateIds: ['template-one'] }) });
    assert.equal(audit.status, 200); assert.equal((await audit.json()).ok, true);
    const detail = await (await fetch(`${base}/audits?templateId=template-one`)).json();
    assert.equal(detail.summary.checksMet, true); assert.equal(detail.record.events[0].actor, null);
    assert.equal((await (await fetch(`${base}/audits/overview`)).json()).items.length, 1);
    assert.equal((await fetch(`${base}/templates/template-one`)).status, 401);
    const document = await (await fetch(`${base}/templates/template-one`, { headers: { 'x-api-key': settings.refreshApiKey } })).json();
    assert.ok(!JSON.stringify(document).includes('fixture-github-token'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('future catalog timestamps fail closed without erasing stored data', async () => {
  const { service, store } = fixture(); await service.refresh();
  store.saveCatalog(connectionKey(config), { ...service.stored(), capturedAt: '2099-01-01T00:00:00Z' });
  assert.equal(service.stored(), null);
  assert.ok(store.getCatalog(connectionKey(config)));
});
test('audit persistence failures do not return partial success or release workers early', async () => {
  const { service: seedService, store } = fixture({ client: { templates: async () => [template, { ...template, Id: 'two' }] } });
  await seedService.refresh();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let writes = 0;
  const failingStore = { ...store, saveAudit: (...args) => { writes++; if (args[1] === 'template-one') throw new Error('fixture-disk-error'); return store.saveAudit(...args); } };
  const service = createCloudLabsCatalogService({ config, store: failingStore, now: () => now, client: { audits: async id => { if (id === 'two') await gate; return [event()]; } } });
  const first = service.refreshAudits({ templateIds: ['template-one', 'two'] });
  const rejection = assert.rejects(first, /fixture-disk-error/);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(service.status().auditInFlight, true);
  await assert.rejects(service.refreshAudits({ templateIds: ['two'] }), { status: 409 });
  release(); await rejection;
  assert.equal(writes, 2); assert.equal(service.status().auditInFlight, false);
});