// capture.mjs
// Interactive Playwright recorder for CloudLabs Admin portal (or any auth-gated site).
//
// - Launches a real Chromium window with a persistent profile so cookies survive re-runs.
// - You log in MANUALLY with your company SSO. The script never sees your password.
// - Every network request/response (XHR + fetch + document) is captured to disk.
// - Static assets (images, fonts, CSS, JS chunks) are skipped by default to keep noise low.
// - Press Ctrl+C in the terminal (or close the browser) to stop and flush the session.

import { chromium } from 'playwright';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- Configuration ----------
const TARGET_URL =
  process.env.RECON_URL ||
  'https://admin-vnext.cloudlabs.ai/36854d56-fcd7-4e25-98f9-fadf5afe2a09/dashboard';

const PROFILE_DIR = join(__dirname, '.browser-profile'); // persists your login
const OUT_DIR = join(__dirname, 'captures', new Date().toISOString().replace(/[:.]/g, '-'));
const REQ_LOG_FILE = join(OUT_DIR, 'requests.ndjson'); // one JSON object per line
const SESSION_META = join(OUT_DIR, 'session.json');

// Skip these resource types — they aren't APIs.
const SKIP_RESOURCE_TYPES = new Set([
  'image', 'font', 'stylesheet', 'media', 'manifest', 'websocket', 'other'
]);

// Skip requests to these hosts (analytics / telemetry noise). Extend as needed.
const SKIP_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'clarity.ms',
  'segment.io',
  'sentry.io',
  'hotjar.com',
  'facebook.net',
  'linkedin.com/li/track'
];

// Skip URLs ending with these — usually static bundles.
const SKIP_URL_SUFFIXES = ['.js', '.css', '.map', '.woff', '.woff2', '.ttf', '.svg', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

// Max response body size to persist (bytes). Larger responses are truncated.
const MAX_BODY_BYTES = 512 * 1024;

// ---------- Setup ----------
await mkdir(OUT_DIR, { recursive: true });
await mkdir(PROFILE_DIR, { recursive: true });

console.log('\n========================================');
console.log(' CloudLabs API Recon — Playwright Capture');
console.log('========================================');
console.log(` Target      : ${TARGET_URL}`);
console.log(` Output dir  : ${OUT_DIR}`);
console.log(` Profile dir : ${PROFILE_DIR} (persists your login)`);
console.log('----------------------------------------');
console.log(' 1. A Chromium window will open.');
console.log(' 2. Log in with your company SSO manually.');
console.log(' 3. Navigate through every dashboard section you care about.');
console.log(' 4. When done, close the browser OR press Ctrl+C here.');
console.log(' 5. Then run:  node analyze.mjs   to generate the API map.');
console.log('========================================\n');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: ['--disable-blink-features=AutomationControlled']
});

// ---------- Capture state ----------
let counter = 0;
const pending = new Map(); // request -> { id, startedAt }
const seenPages = new Set();

function shouldSkip(req) {
  if (SKIP_RESOURCE_TYPES.has(req.resourceType())) return true;
  const url = req.url();
  if (SKIP_HOSTS.some(h => url.includes(h))) return true;
  const lower = url.toLowerCase().split('?')[0];
  if (SKIP_URL_SUFFIXES.some(s => lower.endsWith(s))) return true;
  return false;
}

function redactHeaders(headers) {
  // Keep header names + full values in the raw log (needed for reverse-engineering auth),
  // but flag sensitive ones so the analyzer can extract them safely.
  const sensitive = ['authorization', 'cookie', 'x-csrf-token', 'x-xsrf-token', 'x-api-key'];
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = v;
    if (sensitive.includes(k.toLowerCase())) {
      out[`__sensitive_${k}`] = true;
    }
  }
  return out;
}

function truncate(str) {
  if (!str) return str;
  const buf = Buffer.from(str);
  if (buf.length <= MAX_BODY_BYTES) return str;
  return buf.slice(0, MAX_BODY_BYTES).toString('utf8') + `\n... [truncated, original ${buf.length} bytes]`;
}

async function writeEntry(entry) {
  await appendFile(REQ_LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

// ---------- Hook every page (including popups) ----------
function attachToContext(ctx) {
  ctx.on('page', page => {
    seenPages.add(page.url());

    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        seenPages.add(frame.url());
      }
    });

    page.on('request', req => {
      if (shouldSkip(req)) return;
      const id = `req_${String(++counter).padStart(5, '0')}`;
      pending.set(req, { id, startedAt: Date.now(), pageUrl: page.url() });
    });

    page.on('requestfailed', async req => {
      const meta = pending.get(req);
      if (!meta) return;
      pending.delete(req);
      await writeEntry({
        id: meta.id,
        timestamp: new Date(meta.startedAt).toISOString(),
        pageUrl: meta.pageUrl,
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType(),
        requestHeaders: redactHeaders(await req.allHeaders()),
        requestBody: req.postData(),
        status: null,
        error: req.failure()?.errorText || 'request failed',
        durationMs: Date.now() - meta.startedAt
      });
    });

    page.on('response', async res => {
      const req = res.request();
      const meta = pending.get(req);
      if (!meta) return;
      pending.delete(req);

      let responseBody = null;
      const contentType = (res.headers()['content-type'] || '').toLowerCase();
      const isTextish = /json|text|xml|javascript|html/.test(contentType);
      try {
        if (isTextish) {
          const text = await res.text();
          responseBody = truncate(text);
        } else if (contentType) {
          responseBody = `[binary ${contentType}]`;
        }
      } catch {
        responseBody = '[unavailable]';
      }

      const entry = {
        id: meta.id,
        timestamp: new Date(meta.startedAt).toISOString(),
        pageUrl: meta.pageUrl,
        method: req.method(),
        url: res.url(),
        resourceType: req.resourceType(),
        requestHeaders: redactHeaders(await req.allHeaders()),
        requestBody: req.postData(),
        status: res.status(),
        responseHeaders: res.headers(),
        responseContentType: contentType,
        responseBody,
        durationMs: Date.now() - meta.startedAt
      };
      await writeEntry(entry);
      process.stdout.write(`  [${entry.status}] ${entry.method.padEnd(6)} ${entry.url}\n`);
    });
  });
}

attachToContext(context);

// Open the initial page ourselves so the user lands on the target.
const page = await context.newPage();
await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' }).catch(() => {
  console.log('Initial navigation reported an issue — the login redirect probably kicked in. Continue.');
});

// ---------- Graceful shutdown ----------
let stopping = false;
async function stop(reason) {
  if (stopping) return;
  stopping = true;
  console.log(`\nStopping (${reason}). Flushing capture...`);
  try {
    const cookies = await context.cookies();
    await writeFile(SESSION_META, JSON.stringify({
      target: TARGET_URL,
      capturedAt: new Date().toISOString(),
      totalRequests: counter,
      pagesVisited: [...seenPages],
      cookies
    }, null, 2));
    await context.close();
  } catch (e) {
    console.error('Error while stopping:', e);
  }
  console.log(`\nDone. Raw log: ${REQ_LOG_FILE}`);
  console.log(`Session meta: ${SESSION_META}`);
  console.log('Next: node analyze.mjs\n');
  process.exit(0);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
context.on('close', () => stop('browser closed'));
