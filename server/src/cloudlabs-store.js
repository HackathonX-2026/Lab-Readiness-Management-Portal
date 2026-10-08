// Store only normalized, allowlisted records. Credentials and raw CloudLabs
// responses never enter these tables. Keys isolate partner/API/role contexts.
export function createCloudLabsStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloudlabs_catalog (
      scope TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cloudlabs_audits (
      scope TEXT NOT NULL,
      template_id TEXT NOT NULL,
      record_json TEXT NOT NULL,
      PRIMARY KEY (scope, template_id)
    );
  `);
  const readCatalog = db.prepare('SELECT snapshot_json FROM cloudlabs_catalog WHERE scope = ?');
  const writeCatalog = db.prepare(`INSERT INTO cloudlabs_catalog (scope, snapshot_json) VALUES (?, ?)
    ON CONFLICT(scope) DO UPDATE SET snapshot_json = excluded.snapshot_json`);
  const readAudit = db.prepare('SELECT record_json FROM cloudlabs_audits WHERE scope = ? AND template_id = ?');
  const writeAudit = db.prepare(`INSERT INTO cloudlabs_audits (scope, template_id, record_json) VALUES (?, ?, ?)
    ON CONFLICT(scope, template_id) DO UPDATE SET record_json = excluded.record_json`);
  const parse = raw => {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  return {
    getCatalog: scope => parse(readCatalog.get(scope)?.snapshot_json),
    saveCatalog: (scope, snapshot) => writeCatalog.run(scope, JSON.stringify(snapshot)),
    getAudit: (scope, templateId) => parse(readAudit.get(scope, templateId)?.record_json),
    saveAudit: (scope, templateId, record) => writeAudit.run(scope, templateId, JSON.stringify(record))
  };
}