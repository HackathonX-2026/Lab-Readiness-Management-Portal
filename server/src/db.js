import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

// Resolve dbPath relative to the server package root (not process cwd) so the
// DB always lands next to the source regardless of where the server is started.
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = isAbsolute(config.dbPath) ? config.dbPath : resolve(SERVER_ROOT, config.dbPath);
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// The `labs` table is the normalized model consumed by the React frontend.
// `raw_json` keeps the full source payload so we can add more columns later
// without another full sync.
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS labs (
  id                TEXT PRIMARY KEY,          -- source-stable id ("cloudlabs:workshop:<id>")
  source            TEXT NOT NULL,             -- 'workshop-request' | 'lab-request' | 'on-demand-lab'
  source_id         TEXT NOT NULL,             -- id from CloudLabs
  lab_name          TEXT,
  track_title       TEXT,
  request_date      TEXT,                      -- ISO date
  delivery_date     TEXT,                      -- ISO date
  request_status    TEXT,                      -- normalized: Requested/Approved/InProgress/Completed/Cancelled
  request_status_raw TEXT,
  readiness_status  TEXT,                      -- computed: Ready/Testing Pending/Retest Required/Action Required
  environment_status TEXT,
  owner_email       TEXT,
  primary_contact   TEXT,
  customer          TEXT,
  country           TEXT,
  region            TEXT,
  event_type        TEXT,
  registration_count INTEGER,
  duration_minutes  INTEGER,
  time_zone         TEXT,
  is_active         INTEGER,                   -- 0/1
  bit_link          TEXT,
  purchase_order    TEXT,
  external_id       TEXT,
  raw_json          TEXT NOT NULL,
  first_seen_at     TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT                       -- soft delete when source omits it
);

CREATE INDEX IF NOT EXISTS idx_labs_delivery_date ON labs(delivery_date);
CREATE INDEX IF NOT EXISTS idx_labs_status ON labs(request_status);
CREATE INDEX IF NOT EXISTS idx_labs_deleted ON labs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_labs_source ON labs(source);

CREATE TABLE IF NOT EXISTS sync_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at     TEXT NOT NULL,
  finished_at    TEXT,
  status         TEXT NOT NULL,                -- running | success | failed
  source         TEXT,                         -- which endpoint
  pages_fetched  INTEGER DEFAULT 0,
  items_fetched  INTEGER DEFAULT 0,
  items_created  INTEGER DEFAULT 0,
  items_updated  INTEGER DEFAULT 0,
  items_deleted  INTEGER DEFAULT 0,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs(started_at DESC);
`);

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
const upsertStmt = db.prepare(`
INSERT INTO labs (
  id, source, source_id, lab_name, track_title, request_date, delivery_date,
  request_status, request_status_raw, readiness_status, environment_status,
  owner_email, primary_contact, customer, country, region, event_type,
  registration_count, duration_minutes, time_zone, is_active, bit_link,
  purchase_order, external_id, raw_json,
  first_seen_at, last_seen_at, updated_at, deleted_at
) VALUES (
  @id, @source, @source_id, @lab_name, @track_title, @request_date, @delivery_date,
  @request_status, @request_status_raw, @readiness_status, @environment_status,
  @owner_email, @primary_contact, @customer, @country, @region, @event_type,
  @registration_count, @duration_minutes, @time_zone, @is_active, @bit_link,
  @purchase_order, @external_id, @raw_json,
  @now, @now, @now, NULL
)
ON CONFLICT(id) DO UPDATE SET
  lab_name           = excluded.lab_name,
  track_title        = excluded.track_title,
  request_date       = excluded.request_date,
  delivery_date      = excluded.delivery_date,
  request_status     = excluded.request_status,
  request_status_raw = excluded.request_status_raw,
  readiness_status   = excluded.readiness_status,
  environment_status = excluded.environment_status,
  owner_email        = excluded.owner_email,
  primary_contact    = excluded.primary_contact,
  customer           = excluded.customer,
  country            = excluded.country,
  region             = excluded.region,
  event_type         = excluded.event_type,
  registration_count = excluded.registration_count,
  duration_minutes   = excluded.duration_minutes,
  time_zone          = excluded.time_zone,
  is_active          = excluded.is_active,
  bit_link           = excluded.bit_link,
  purchase_order     = excluded.purchase_order,
  external_id        = excluded.external_id,
  raw_json           = excluded.raw_json,
  last_seen_at       = excluded.last_seen_at,
  deleted_at         = NULL,
  updated_at         = CASE
      WHEN labs.raw_json <> excluded.raw_json THEN excluded.updated_at
      ELSE labs.updated_at
    END
`);

// SQLite disallows referencing `excluded.*` inside a RETURNING clause, so we
// classify create/update/unchanged by looking up the existing row first.
const existingStmt = db.prepare(`SELECT raw_json FROM labs WHERE id = ?`);

export function upsertLab(row) {
  const existing = existingStmt.get(row.id);
  upsertStmt.run(row);
  if (!existing) return { change: 'created' };
  if (existing.raw_json !== row.raw_json) return { change: 'updated' };
  return { change: 'unchanged' };
}

const markMissingStmt = db.prepare(`
UPDATE labs
SET deleted_at = @now, updated_at = @now
WHERE source = @source
  AND last_seen_at < @seenSince
  AND deleted_at IS NULL
`);

export function markMissingAsDeleted(source, seenSince, now) {
  const info = markMissingStmt.run({ source, seenSince, now });
  return info.changes;
}

const purgeOutOfWindowStmt = db.prepare(`
DELETE FROM labs
WHERE source = @source
  AND (delivery_date IS NULL OR delivery_date < @cutoff)
`);

// Hard-remove labs whose delivery_date is older than the sync window. Used
// when SYNC_LOOKBACK_DAYS is enabled so the DB doesn't retain out-of-scope
// rows from a previous full sync.
export function purgeOutOfWindow(source, cutoffIso) {
  const info = purgeOutOfWindowStmt.run({ source, cutoff: cutoffIso });
  return info.changes;
}

export function insertSyncRun(source) {
  const info = db.prepare(
    `INSERT INTO sync_runs (started_at, status, source) VALUES (?, 'running', ?)`
  ).run(new Date().toISOString(), source);
  return info.lastInsertRowid;
}

export function finishSyncRun(id, patch) {
  const cols = Object.keys(patch);
  const set = cols.map(c => `${c} = @${c}`).join(', ');
  db.prepare(`UPDATE sync_runs SET ${set}, finished_at = @finished_at WHERE id = @id`).run({
    ...patch,
    finished_at: new Date().toISOString(),
    id
  });
}

export function listLabs({ status, includeDeleted = false, limit = 500, offset = 0, q } = {}) {
  const where = [];
  const params = {};
  if (!includeDeleted) where.push('deleted_at IS NULL');
  if (status) { where.push('request_status = @status'); params.status = status; }
  if (q) {
    where.push('(lab_name LIKE @q OR track_title LIKE @q OR customer LIKE @q OR primary_contact LIKE @q)');
    params.q = `%${q}%`;
  }
  const sql = `SELECT * FROM labs ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY delivery_date ASC LIMIT @limit OFFSET @offset`;
  return db.prepare(sql).all({ ...params, limit, offset });
}

export function countLabs({ includeDeleted = false } = {}) {
  const sql = `SELECT COUNT(*) as c FROM labs ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'}`;
  return db.prepare(sql).get().c;
}

export function latestSyncRun() {
  return db.prepare(`SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1`).get();
}

export function recentSyncRuns(n = 20) {
  return db.prepare(`SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?`).all(n);
}
