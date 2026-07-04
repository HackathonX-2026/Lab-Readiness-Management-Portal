// Reads the newest capture folder, finds the freshest Authorization: Bearer
// token used against api-vnext.cloudlabs.ai, and updates CLOUDLABS_ACCESS_TOKEN
// in server/.env with it. Usage:  node server/scripts/refresh-token-from-capture.mjs
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAPTURES = resolve(__dirname, '..', '..', 'tools', 'api-recon', 'captures');
const ENV_PATH = resolve(__dirname, '..', '.env');

if (!existsSync(CAPTURES)) {
  console.error(`No captures folder found at ${CAPTURES}. Run the Playwright recon first.`);
  process.exit(1);
}

const entries = await readdir(CAPTURES);
const withStat = await Promise.all(entries.map(async n => {
  const p = join(CAPTURES, n);
  return { p, s: await stat(p) };
}));
const dirs = withStat.filter(x => x.s.isDirectory()).sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
if (!dirs.length) {
  console.error('No capture directories found.');
  process.exit(1);
}

let token = null;
let tokenSource = null;
for (const { p } of dirs) {
  const log = join(p, 'requests.ndjson');
  if (!existsSync(log)) continue;
  const lines = (await readFile(log, 'utf8')).split('\n').filter(Boolean);
  // Newest first
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    if (!entry.url?.includes('api-vnext.cloudlabs.ai')) continue;
    const auth = entry.requestHeaders?.authorization || entry.requestHeaders?.Authorization;
    if (auth && /^bearer /i.test(auth)) {
      token = auth.slice(7).trim();
      tokenSource = { file: log, url: entry.url, at: entry.timestamp };
      break;
    }
  }
  if (token) break;
}

if (!token) {
  console.error('No Bearer token for api-vnext.cloudlabs.ai found in any capture.');
  process.exit(1);
}

// Print token metadata (decoded JWT payload) without leaking the token itself
try {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const expIso = payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown';
  const remaining = payload.exp ? Math.round((payload.exp * 1000 - Date.now()) / 1000 / 60) : null;
  console.log(`Token found: sub=${payload.sub} name=${payload.name || 'n/a'}`);
  console.log(`Expires at:  ${expIso}${remaining !== null ? ` (~${remaining} min from now)` : ''}`);
  console.log(`Captured at: ${tokenSource.at}`);
} catch {}

// Rewrite .env: replace or append CLOUDLABS_ACCESS_TOKEN
let env = existsSync(ENV_PATH) ? await readFile(ENV_PATH, 'utf8') : '';
const line = `CLOUDLABS_ACCESS_TOKEN=${token}`;
if (/^CLOUDLABS_ACCESS_TOKEN=.*/m.test(env)) {
  env = env.replace(/^CLOUDLABS_ACCESS_TOKEN=.*/m, line);
} else {
  env = env.trimEnd() + '\n' + line + '\n';
}
await writeFile(ENV_PATH, env, 'utf8');
console.log(`\nWrote CLOUDLABS_ACCESS_TOKEN to ${ENV_PATH}`);
console.log('Restart the sync-server (or POST /api/sync/run) to use it.');
