import { TableClient } from '@azure/data-tables';

const LABS_TABLE = 'LabReadinessLabs';
const RUNS_TABLE = 'LabReadinessSyncRuns';
const LABS_PARTITION = 'workshop-request';
const RUNS_PARTITION = 'sync-run';
const clients = new Map();

function getClient(tableName) {
  if (!clients.has(tableName)) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
    if (!connectionString) throw new Error('Azure Storage connection string is not configured.');
    const table = TableClient.fromConnectionString(connectionString, tableName);
    const ready = table.createTable().catch(error => {
      if (error.statusCode !== 409 && error.code !== 'TableAlreadyExists') throw error;
    });
    clients.set(tableName, { table, ready });
  }
  return clients.get(tableName);
}

async function tableFor(name) {
  const entry = getClient(name);
  await entry.ready;
  return entry.table;
}

async function allEntities(table, partition) {
  const result = [];
  const entities = table.listEntities({ queryOptions: { filter: `PartitionKey eq '${partition}'` } });
  for await (const entity of entities) result.push(entity);
  return result;
}

function toLab(entity) {
  return {
    id: entity.id ?? entity.rowKey,
    source: entity.source ?? null,
    source_id: entity.source_id ?? null,
    lab_name: entity.lab_name ?? null,
    track_title: entity.track_title ?? null,
    request_date: entity.request_date ?? null,
    delivery_date: entity.delivery_date ?? null,
    request_status: entity.request_status ?? null,
    request_status_raw: entity.request_status_raw ?? null,
    readiness_status: entity.readiness_status ?? null,
    environment_status: entity.environment_status ?? null,
    owner_email: entity.owner_email ?? null,
    primary_contact: entity.primary_contact ?? null,
    customer: entity.customer ?? null,
    country: entity.country ?? null,
    region: entity.region ?? null,
    event_type: entity.event_type ?? null,
    registration_count: entity.registration_count ?? null,
    duration_minutes: entity.duration_minutes ?? null,
    time_zone: entity.time_zone ?? null,
    is_active: entity.is_active ?? 0,
    bit_link: entity.bit_link ?? null,
    purchase_order: entity.purchase_order ?? null,
    external_id: entity.external_id ?? null,
    raw_json: entity.raw_json ?? '{}',
    first_seen_at: entity.first_seen_at ?? null,
    last_seen_at: entity.last_seen_at ?? null,
    updated_at: entity.updated_at ?? null,
    deleted_at: entity.deleted_at ?? null
  };
}

function toSyncRun(entity) {
  return {
    id: entity.id,
    started_at: entity.started_at,
    finished_at: entity.finished_at ?? null,
    status: entity.status,
    source: entity.source ?? null,
    pages_fetched: entity.pages_fetched ?? 0,
    items_fetched: entity.items_fetched ?? 0,
    items_created: entity.items_created ?? 0,
    items_updated: entity.items_updated ?? 0,
    items_deleted: entity.items_deleted ?? 0,
    error_message: entity.error_message ?? null
  };
}

function cleanEntity(entity) {
  return Object.fromEntries(Object.entries(entity).filter(([, value]) => value !== null && value !== undefined));
}

export async function upsertLab(row) {
  const table = await tableFor(LABS_TABLE);
  const rowKey = encodeURIComponent(row.id);
  let existing;
  try {
    existing = await table.getEntity(LABS_PARTITION, rowKey);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }

  const changed = !!existing && existing.raw_json !== row.raw_json;
  const entity = cleanEntity({
    ...row,
    partitionKey: LABS_PARTITION,
    rowKey,
    id: row.id,
    first_seen_at: existing?.first_seen_at ?? row.now,
    last_seen_at: row.now,
    updated_at: !existing || changed ? row.now : existing.updated_at
  });
  delete entity.now;
  delete entity.deleted_at;
  await table.upsertEntity(entity, 'Replace');

  if (!existing) return { change: 'created' };
  if (changed) return { change: 'updated' };
  return { change: 'unchanged' };
}

export async function markMissingAsDeleted(source, seenSince, now) {
  const table = await tableFor(LABS_TABLE);
  const entities = await allEntities(table, LABS_PARTITION);
  let changes = 0;
  for (const entity of entities) {
    if (entity.source !== source || entity.deleted_at || entity.last_seen_at >= seenSince) continue;
    await table.updateEntity({
      partitionKey: LABS_PARTITION,
      rowKey: entity.rowKey,
      deleted_at: now,
      updated_at: now
    }, 'Merge');
    changes++;
  }
  return changes;
}

export async function purgeOutOfWindow(source, cutoffIso) {
  const table = await tableFor(LABS_TABLE);
  const entities = await allEntities(table, LABS_PARTITION);
  let changes = 0;
  for (const entity of entities) {
    if (entity.source !== source || (entity.delivery_date && entity.delivery_date >= cutoffIso)) continue;
    await table.deleteEntity(LABS_PARTITION, entity.rowKey);
    changes++;
  }
  return changes;
}

export async function insertSyncRun(source) {
  const table = await tableFor(RUNS_TABLE);
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  await table.createEntity({
    partitionKey: RUNS_PARTITION,
    rowKey: String(id).padStart(20, '0'),
    id,
    started_at: new Date().toISOString(),
    status: 'running',
    source,
    pages_fetched: 0,
    items_fetched: 0,
    items_created: 0,
    items_updated: 0,
    items_deleted: 0
  });
  return id;
}

export async function finishSyncRun(id, patch) {
  const table = await tableFor(RUNS_TABLE);
  await table.updateEntity(cleanEntity({
    partitionKey: RUNS_PARTITION,
    rowKey: String(id).padStart(20, '0'),
    ...patch,
    finished_at: new Date().toISOString()
  }), 'Merge');
}

export async function listLabs({ status, includeDeleted = false, limit = 500, offset = 0, q } = {}) {
  const table = await tableFor(LABS_TABLE);
  let rows = (await allEntities(table, LABS_PARTITION))
    .map(toLab)
    .filter(row => includeDeleted || !row.deleted_at);
  if (status) rows = rows.filter(row => row.request_status === status);
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(row => [row.lab_name, row.track_title, row.customer, row.primary_contact]
      .some(value => value?.toLowerCase().includes(needle)));
  }
  rows.sort((a, b) => (a.delivery_date ?? '').localeCompare(b.delivery_date ?? ''));
  return rows.slice(offset, offset + limit);
}

export async function countLabs({ includeDeleted = false } = {}) {
  const table = await tableFor(LABS_TABLE);
  const entities = await allEntities(table, LABS_PARTITION);
  return includeDeleted ? entities.length : entities.filter(entity => !entity.deleted_at).length;
}

export async function latestSyncRun() {
  const table = await tableFor(RUNS_TABLE);
  const entities = await allEntities(table, RUNS_PARTITION);
  entities.sort((a, b) => b.started_at.localeCompare(a.started_at));
  return entities.length ? toSyncRun(entities[0]) : null;
}

export async function recentSyncRuns(count = 20) {
  const table = await tableFor(RUNS_TABLE);
  const entities = await allEntities(table, RUNS_PARTITION);
  entities.sort((a, b) => b.started_at.localeCompare(a.started_at));
  return entities.slice(0, count).map(toSyncRun);
}