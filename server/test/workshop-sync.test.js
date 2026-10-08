import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Isolated worker process: never load a user's .env, database, SMTP or token.
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: ':memory:', LOG_LEVEL: 'error',
  CLOUDLABS_PARTNER_ID: 'fixture-partner', CLOUDLABS_ACCESS_TOKEN: 'fixture-vnext-token',
  CLOUDLABS_API_BASE: 'https://api-vnext.cloudlabs.ai', CLOUDLABS_TOKEN: '',
  CLOUDLABS_ROLEID: '', CLOUDLABS_TENANTID: '', CLOUDLABS_REFRESH_API_KEY: '', SCAN_API_KEY: '',
  SYNC_ON_START: 'false', CLOUDLABS_CATALOG_SYNC_ENABLED: 'false', EMAIL_ALERTS_ENABLED: 'false',
  SYNC_LOOKBACK_DAYS: '0', SYNC_MAX_PAGES: '1'
});
const { config } = await import('../src/config.js');
const { db, upsertLab, countLabs, getLab, latestSyncRun } = await import('../src/db.js');
const { mapWorkshopRequest } = await import('../src/mapper.js');
const { runSync, isSyncInFlight } = await import('../src/sync.js');
const { createServer } = await import('../src/server.js');
const nativeFetch = globalThis.fetch;
after(() => { globalThis.fetch = nativeFetch; db.close(); });
const raw = (id, extra = {}) => ({ id, trackTitle: `Workshop ${id}`, date: '2026-10-12T00:00:00', requestStatus: 'Approved', isActive: true, ...extra });
const seed = () => {
  db.exec('DELETE FROM labs; DELETE FROM sync_runs;');
  upsertLab(mapWorkshopRequest(raw('old'), '2026-01-01T00:00:00.000Z'));
};
const mock = handler => { globalThis.fetch = async (url, init) => {
  assert.ok(String(url).startsWith('https://api-vnext.cloudlabs.ai/'), 'Tests cannot contact an unexpected origin');
  return handler(url, init);
}; };

test('workshop sync does not remove existing rows after hitting the page cap', async () => {
  seed();
  mock(async () => Response.json({ isSuccess: true, data: { value: Array.from({ length: 100 }, (_, i) => raw(`new-${i}`)), totalItems: 101 } }));
  await assert.rejects(runSync(), /pagination was incomplete/);
  assert.ok(getLab('cloudlabs:workshop:old'));
  assert.equal(latestSyncRun().status, 'failed');
  assert.equal(isSyncInFlight(), false);
});
test('malformed workshop list and duplicate IDs cannot clear cache', async () => {
  for (const data of [{}, { value: [raw('same'), raw('same')] }]) {
    seed(); mock(async () => Response.json({ isSuccess: true, data }));
    await assert.rejects(runSync()); assert.ok(getLab('cloudlabs:workshop:old'));
  }
});
test('workshop total mismatch prevents deletion', async () => {
  seed(); mock(async () => Response.json({ isSuccess: true, data: { value: [raw('one')], totalItems: 10 } }));
  await assert.rejects(runSync(), /pagination was incomplete/); assert.ok(getLab('cloudlabs:workshop:old'));
});
test('complete workshop sync preserves incremental changes and removes missing rows', async () => {
  seed();
  mock(async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/partners/fixture-partner/workshop-requests/list');
    assert.deepEqual(JSON.parse(init.body), { pageNumber: 1, pageSize: 100 });
    assert.equal(init.redirect, 'error');
    return Response.json({ isSuccess: true, data: { value: [raw('one'), raw('two', { trackTitle: 'Second' })], totalItems: 2 } });
  });
  const first = await runSync(); assert.equal(first.created, 2); assert.equal(first.deleted, 1);
  assert.equal(countLabs(), 2); assert.equal(countLabs({ includeDeleted: true }), 3);
  const second = await runSync(); assert.equal(second.created, 0); assert.equal(second.updated, 0);
  assert.equal(countLabs({ q: 'Second' }), 1);
});
test('existing REST single-lab lookup finds any matching ID, not just first row', async () => {
  seed();
  upsertLab(mapWorkshopRequest(raw('later', { date: '2026-10-20T00:00:00', trackTitle: 'Later track' }), new Date().toISOString()));
  const server = createServer().listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await nativeFetch(`${base}/api/labs/${encodeURIComponent('cloudlabs:workshop:later')}`);
    assert.equal(response.status, 200); assert.equal((await response.json()).labName, 'Later track');
    const filtered = await (await nativeFetch(`${base}/api/labs?q=Later&offset=-1&limit=-1`)).json();
    assert.equal(filtered.count, 1); assert.equal(filtered.total, 1);
    const catalog = await (await nativeFetch(`${base}/api/cloudlabs`)).json();
    assert.equal(catalog.configured, false); assert.equal(catalog.snapshot, null);
    const unavailable = await nativeFetch(`${base}/api/cloudlabs`, { method: 'POST' });
    assert.equal(unavailable.status, 503);
    assert.equal((await nativeFetch(`${base}/api/cloudlabs/audits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid' })).status, 400);
    const health = await (await nativeFetch(`${base}/api/health`)).json();
    assert.equal(health.workshopConfigured, true); assert.equal(health.catalogConnection.tokenSaved, false);
    assert.ok(!JSON.stringify(health).includes(config.accessToken));
  } finally { await new Promise(resolve => server.close(resolve)); }
});