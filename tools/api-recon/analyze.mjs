// analyze.mjs
// Reads the most recent capture from ./captures and produces:
//   - endpoints.json      — machine-readable list of unique endpoint patterns
//   - api-map.md          — human-readable API map (grouped by host + path pattern)
//   - auth-analysis.md    — how the portal authenticates its API calls
//   - page-dependencies.md — which endpoints each dashboard page depends on
//   - samples/*.json      — one file per unique endpoint with sample req/resp
//
// Run:  node analyze.mjs [captureFolder]
// If no folder given, uses the newest folder under ./captures.

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAPTURES_ROOT = join(__dirname, 'captures');

// ---------- Pick the capture folder ----------
let captureDir = process.argv[2];
if (!captureDir) {
  if (!existsSync(CAPTURES_ROOT)) {
    console.error('No captures/ folder found. Run:  node capture.mjs  first.');
    process.exit(1);
  }
  const dirs = (await readdir(CAPTURES_ROOT))
    .map(d => join(CAPTURES_ROOT, d));
  const withStat = await Promise.all(dirs.map(async d => ({ d, s: await stat(d) })));
  const newest = withStat.filter(x => x.s.isDirectory()).sort((a, b) => b.s.mtimeMs - a.s.mtimeMs)[0];
  if (!newest) {
    console.error('No capture folders found under ./captures.');
    process.exit(1);
  }
  captureDir = newest.d;
}
console.log(`Analyzing: ${captureDir}`);

const REQ_LOG = join(captureDir, 'requests.ndjson');
const SESSION = join(captureDir, 'session.json');
const OUT_ENDPOINTS = join(captureDir, 'endpoints.json');
const OUT_MAP = join(captureDir, 'api-map.md');
const OUT_AUTH = join(captureDir, 'auth-analysis.md');
const OUT_PAGES = join(captureDir, 'page-dependencies.md');
const SAMPLES_DIR = join(captureDir, 'samples');
await mkdir(SAMPLES_DIR, { recursive: true });

// ---------- Load ----------
const raw = await readFile(REQ_LOG, 'utf8');
const entries = raw.split('\n').filter(Boolean).map(l => JSON.parse(l));
console.log(`Loaded ${entries.length} requests.`);

const session = existsSync(SESSION) ? JSON.parse(await readFile(SESSION, 'utf8')) : {};

// ---------- Normalize URLs into endpoint patterns ----------
// Replace UUIDs, ints, and long hex ids with placeholders so we group calls.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_HEX = /\b[0-9a-f]{16,}\b/gi;
const PURE_INT = /^\d+$/;

function normalizePath(pathname) {
  return pathname
    .split('/')
    .map(seg => {
      if (!seg) return seg;
      if (UUID.test(seg)) { UUID.lastIndex = 0; return '{uuid}'; }
      if (LONG_HEX.test(seg)) { LONG_HEX.lastIndex = 0; return '{hex}'; }
      if (PURE_INT.test(seg)) return '{id}';
      return seg;
    })
    .join('/');
}

function keyFor(entry) {
  const u = new URL(entry.url);
  return `${entry.method} ${u.host}${normalizePath(u.pathname)}`;
}

// ---------- Group ----------
const groups = new Map(); // key -> { method, host, pathPattern, samples: [], statuses: Set, pages: Set }
for (const e of entries) {
  if (!e.url) continue;
  let u;
  try { u = new URL(e.url); } catch { continue; }
  const k = keyFor(e);
  if (!groups.has(k)) {
    groups.set(k, {
      key: k,
      method: e.method,
      host: u.host,
      pathPattern: normalizePath(u.pathname),
      count: 0,
      statuses: new Set(),
      pages: new Set(),
      contentTypes: new Set(),
      samples: []
    });
  }
  const g = groups.get(k);
  g.count++;
  if (e.status) g.statuses.add(e.status);
  if (e.pageUrl) g.pages.add(e.pageUrl);
  if (e.responseContentType) g.contentTypes.add(e.responseContentType.split(';')[0].trim());
  if (g.samples.length < 3) g.samples.push(e);
}

// ---------- Auth analysis ----------
const authFindings = {
  bearerTokens: new Set(),   // just the token prefix (first 12 chars) to avoid dumping full JWTs into markdown
  cookieNames: new Set(),
  csrfHeaders: new Set(),
  apiHosts: new Set(),
  hasJwt: false,
  tokenIssuers: new Set()
};

for (const e of entries) {
  const h = e.requestHeaders || {};
  try { authFindings.apiHosts.add(new URL(e.url).host); } catch {}
  for (const [k, v] of Object.entries(h)) {
    if (k.startsWith('__sensitive_')) continue;
    const kl = k.toLowerCase();
    if (kl === 'authorization' && typeof v === 'string') {
      if (/^bearer /i.test(v)) {
        const token = v.slice(7).trim();
        authFindings.bearerTokens.add(token.slice(0, 12) + '…');
        if (token.split('.').length === 3) {
          authFindings.hasJwt = true;
          try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
            if (payload.iss) authFindings.tokenIssuers.add(payload.iss);
          } catch {}
        }
      }
    }
    if (kl === 'cookie' && typeof v === 'string') {
      v.split(';').forEach(c => {
        const name = c.split('=')[0].trim();
        if (name) authFindings.cookieNames.add(name);
      });
    }
    if (kl.includes('csrf') || kl.includes('xsrf')) authFindings.csrfHeaders.add(k);
  }
}

// ---------- Categorize endpoints by likely purpose ----------
const CATEGORIES = [
  { name: 'Dashboard / Overview', patterns: [/dashboard/i, /overview/i, /summary/i, /metrics/i, /stats/i] },
  { name: 'Labs',                 patterns: [/\blabs?\b/i, /environment/i] },
  { name: 'Lab details',          patterns: [/labs?\/\{/i, /environment\/\{/i, /instances?/i] },
  { name: 'Users',                patterns: [/users?/i, /accounts?/i, /profile/i, /me\b/i] },
  { name: 'Roles / Permissions',  patterns: [/roles?/i, /permissions?/i, /rbac/i] },
  { name: 'Workshops / Events',   patterns: [/workshops?/i, /events?/i, /sessions?/i] },
  { name: 'Reports / Analytics',  patterns: [/reports?/i, /analytics/i, /export/i] },
  { name: 'Readiness / Status',   patterns: [/readiness/i, /status/i, /health/i] },
  { name: 'Auth / Identity',      patterns: [/oauth/i, /login/i, /token/i, /auth/i, /openid/i, /\.well-known/i] },
  { name: 'Config / Reference',   patterns: [/config/i, /settings?/i, /lookup/i, /options/i, /catalog/i] }
];

function categorize(g) {
  const hay = `${g.method} ${g.pathPattern}`;
  const hits = [];
  for (const c of CATEGORIES) {
    if (c.patterns.some(r => r.test(hay))) hits.push(c.name);
  }
  return hits.length ? hits : ['Uncategorized'];
}

// ---------- Write endpoints.json + samples/*.json ----------
const endpointsList = [];
let sampleIdx = 0;
for (const g of groups.values()) {
  const cats = categorize(g);
  const first = g.samples[0];
  const sampleFile = `sample_${String(++sampleIdx).padStart(4, '0')}_${g.method}_${g.pathPattern.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.json`;
  await writeFile(join(SAMPLES_DIR, sampleFile), JSON.stringify({
    endpoint: g.key,
    categories: cats,
    samples: g.samples.map(s => ({
      url: s.url,
      status: s.status,
      requestHeaders: s.requestHeaders,
      requestBody: safeParse(s.requestBody),
      responseContentType: s.responseContentType,
      responseBody: safeParse(s.responseBody)
    }))
  }, null, 2));
  endpointsList.push({
    method: g.method,
    host: g.host,
    pathPattern: g.pathPattern,
    fullPattern: `${g.method} https://${g.host}${g.pathPattern}`,
    count: g.count,
    statuses: [...g.statuses],
    contentTypes: [...g.contentTypes],
    categories: cats,
    pages: [...g.pages],
    sampleFile: `samples/${sampleFile}`
  });
}
await writeFile(OUT_ENDPOINTS, JSON.stringify(endpointsList, null, 2));

function safeParse(v) {
  if (v == null) return v;
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { return v; }
  }
  return v;
}

// ---------- api-map.md ----------
function mdEscape(s) { return String(s).replace(/\|/g, '\\|'); }

const byHost = new Map();
for (const ep of endpointsList) {
  if (!byHost.has(ep.host)) byHost.set(ep.host, []);
  byHost.get(ep.host).push(ep);
}

let md = `# CloudLabs Admin — Reverse-Engineered API Map\n\n`;
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `Source capture: \`${captureDir}\`\n\n`;
md += `Total unique endpoints: **${endpointsList.length}** across **${byHost.size}** hosts.\n\n`;
md += `---\n\n## Endpoints by category\n\n`;

const byCategory = new Map();
for (const ep of endpointsList) {
  for (const c of ep.categories) {
    if (!byCategory.has(c)) byCategory.set(c, []);
    byCategory.get(c).push(ep);
  }
}
const orderedCats = [...CATEGORIES.map(c => c.name), 'Uncategorized'];
for (const cat of orderedCats) {
  const list = byCategory.get(cat);
  if (!list?.length) continue;
  md += `### ${cat}\n\n`;
  md += `| Method | Host | Path pattern | Statuses | Calls | Sample |\n`;
  md += `|---|---|---|---|---|---|\n`;
  for (const ep of list) {
    md += `| ${ep.method} | ${ep.host} | \`${mdEscape(ep.pathPattern)}\` | ${ep.statuses.join(', ')} | ${ep.count} | [json](${ep.sampleFile}) |\n`;
  }
  md += `\n`;
}

md += `---\n\n## Endpoints by host\n\n`;
for (const [host, list] of byHost) {
  md += `### \`${host}\` — ${list.length} endpoint(s)\n\n`;
  md += `| Method | Path pattern | Statuses | Calls |\n`;
  md += `|---|---|---|---|\n`;
  for (const ep of list) {
    md += `| ${ep.method} | \`${mdEscape(ep.pathPattern)}\` | ${ep.statuses.join(', ')} | ${ep.count} |\n`;
  }
  md += `\n`;
}

await writeFile(OUT_MAP, md);

// ---------- auth-analysis.md ----------
let auth = `# Authentication Analysis\n\n`;
auth += `## API hosts observed\n\n`;
for (const h of authFindings.apiHosts) auth += `- \`${h}\`\n`;
auth += `\n## Authorization header\n\n`;
if (authFindings.bearerTokens.size) {
  auth += `Portal sends **Bearer tokens** on API calls. ${authFindings.hasJwt ? '**Tokens are JWTs.**' : 'Tokens are opaque (not JWT).'}\n\n`;
  auth += `Token prefixes observed (redacted):\n`;
  for (const t of authFindings.bearerTokens) auth += `- \`${t}\`\n`;
  if (authFindings.tokenIssuers.size) {
    auth += `\n**JWT issuers (\`iss\`):**\n`;
    for (const i of authFindings.tokenIssuers) auth += `- \`${i}\`\n`;
  }
} else {
  auth += `No \`Authorization\` header observed on API calls.\n`;
}
auth += `\n## Cookies used\n\n`;
if (authFindings.cookieNames.size) {
  for (const c of authFindings.cookieNames) auth += `- \`${c}\`\n`;
} else {
  auth += `No cookies observed.\n`;
}
auth += `\n## CSRF / anti-forgery headers\n\n`;
if (authFindings.csrfHeaders.size) {
  for (const h of authFindings.csrfHeaders) auth += `- \`${h}\`\n`;
} else {
  auth += `None observed.\n`;
}

auth += `\n## How to reuse this session from your own code\n\n`;
if (authFindings.hasJwt) {
  auth += `The portal uses JWT bearer tokens issued by an identity provider (likely Microsoft Entra ID given the CloudLabs infra).\n\n`;
  auth += `**Recommended production integration:**\n`;
  auth += `1. Register your app with the same identity provider (issuer above).\n`;
  auth += `2. Request the same audience/scopes shown in the JWT payload.\n`;
  auth += `3. Call the API hosts directly with your own \`Authorization: Bearer <token>\` header.\n`;
  auth += `4. Do **not** copy tokens from this capture — they expire and belong to your interactive session.\n`;
} else {
  auth += `Auth appears to be cookie-based. To reuse it programmatically you would need to replay the SSO flow (Entra ID / OIDC) headlessly, which is fragile. Prefer asking CloudLabs for an official service-to-service credential.\n`;
}

await writeFile(OUT_AUTH, auth);

// ---------- page-dependencies.md ----------
const byPage = new Map();
for (const ep of endpointsList) {
  for (const p of ep.pages) {
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(ep);
  }
}
let pages = `# Page → API dependencies\n\n`;
pages += `For each URL you visited, the APIs that fired while it was active.\n\n`;
for (const [pageUrl, list] of byPage) {
  pages += `## \`${pageUrl}\`\n\n`;
  pages += `${list.length} endpoint call(s):\n\n`;
  const uniq = new Map();
  for (const ep of list) uniq.set(`${ep.method} ${ep.pathPattern}`, ep);
  for (const ep of uniq.values()) {
    pages += `- \`${ep.method} ${ep.host}${ep.pathPattern}\` — ${ep.categories.join(', ')}\n`;
  }
  pages += `\n`;
}
await writeFile(OUT_PAGES, pages);

// ---------- Done ----------
console.log(`\nWrote:`);
console.log(`  ${OUT_ENDPOINTS}`);
console.log(`  ${OUT_MAP}`);
console.log(`  ${OUT_AUTH}`);
console.log(`  ${OUT_PAGES}`);
console.log(`  ${SAMPLES_DIR}/  (${endpointsList.length} sample file(s))`);
console.log(`\nOpen api-map.md first — it's the master index.\n`);
