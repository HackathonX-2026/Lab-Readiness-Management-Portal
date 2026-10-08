import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { cloudlabsApi, type CloudLabsHealth, type SyncRun } from '../api/cloudlabs';
import { useLabs } from '../state/LabsContext';
import { Badge } from './ui';

export default function CloudLabsSyncStatus() {
  const { refresh } = useLabs();
  const [health, setHealth] = useState<CloudLabsHealth | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = async () => {
    try {
      const [health, status] = await Promise.all([cloudlabsApi.health(), cloudlabsApi.syncStatus()]);
      setHealth(health); setRuns(status.recent); setInFlight(status.inFlight); setError(null);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to read sync status.'); }
  };
  useEffect(() => { void reload(); }, []);
  const sync = async () => {
    setBusy(true);
    try { await cloudlabsApi.triggerSync(); await refresh(); await reload(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Workshop sync failed.'); }
    finally { setBusy(false); }
  };
  return <section className="card mt-6 p-5" aria-label="Workshop sync status">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold"><Activity size={16} className="text-accent" aria-hidden="true" />Workshop request sync</h2><p className="mt-1 text-xs text-muted">Existing vNext integration · Independent from the admin catalog and audit APIs.</p></div>
      <div className="flex gap-2"><button className="btn-secondary" onClick={() => void reload()} disabled={busy}>Reload status</button><button className="btn-primary" onClick={() => void sync()} disabled={busy || inFlight || !health?.workshopConfigured || !health.canSync}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} aria-hidden="true" />{busy || inFlight ? 'Syncing…' : 'Sync workshops'}</button></div>
    </div>
    {error && <p role="alert" className="mb-3 text-xs text-danger">{error}</p>}
    {health && !health.workshopConfigured && <p className="mb-3 text-xs text-muted">Workshop sync requires CLOUDLABS_PARTNER_ID and CLOUDLABS_ACCESS_TOKEN. It is not enabled by the admin catalog token.</p>}
    {health?.workshopConfigured && <p className="mb-3 text-xs text-muted">{health.labsInDb} workshops stored · {health.canSync ? 'Manual sync available.' : 'Manual sync requires server authorization.'}</p>}
    {runs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead><tr><th className="th">Started</th><th className="th">Status</th><th className="th">Fetched</th><th className="th">Created</th><th className="th">Updated</th><th className="th">Removed</th></tr></thead><tbody>{runs.map(run => <tr key={run.id} className="border-t border-border"><td className="td">{new Date(run.started_at).toLocaleString()}</td><td className="td"><Badge className={run.status === 'success' ? 'status-good' : run.status === 'failed' ? 'status-bad' : 'status-info'}>{run.status}</Badge></td><td className="td">{run.items_fetched}</td><td className="td">{run.items_created}</td><td className="td">{run.items_updated}</td><td className="td">{run.items_deleted}</td></tr>)}</tbody></table></div> : <p className="text-xs text-muted">No workshop sync runs recorded yet.</p>}
  </section>;
}