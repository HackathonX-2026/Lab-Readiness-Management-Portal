import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CloudCog, ExternalLink, FileSearch, FlaskConical, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { cloudlabsApi, type CatalogLab } from '../api/cloudlabs';
import { useCloudLabsCatalog } from '../lib/useCloudLabsCatalog';
import { useToast } from '../state/ToastContext';
import CloudLabsConnection from '../components/CloudLabsConnection';
import CloudLabsSyncStatus from '../components/CloudLabsSyncStatus';
import { Badge, EmptyState, PageHeader, StatCard } from '../components/ui';

export default function CloudLabsCatalog() {
  const { data, loading, refreshing, error, reload, refresh } = useCloudLabsCatalog();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'templates' | 'deliveries'>('templates');
  const [activeOnly, setActiveOnly] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const toast = useToast();
  const snapshot = data?.snapshot;
  const canRefresh = Boolean(data?.configured && data.canRefresh);
  const templates = useMemo(() => (snapshot?.labs ?? []).filter(lab => (!activeOnly || lab.active)
    && `${lab.name} ${lab.cloudPlatform ?? ''} ${lab.templateId}`.toLowerCase().includes(q.toLowerCase())), [snapshot, q, activeOnly]);
  const deliveries = useMemo(() => (snapshot?.deliveries ?? []).filter(delivery => delivery.daysUntil >= 0
    && `${delivery.trackTitle ?? ''} ${delivery.customer ?? ''} ${delivery.status}`.toLowerCase().includes(q.toLowerCase())), [snapshot, q]);
  const resolve = async (lab: CatalogLab) => {
    setResolving(lab.templateId);
    try {
      const result = await cloudlabsApi.templateDetails(lab.templateId);
      if (result.masterDocUrl) setResolved(previous => ({ ...previous, [lab.templateId]: result.masterDocUrl! }));
      else toast.info('No document available', 'CloudLabs did not return a safe master-document URL for this template.');
    } catch (error) { toast.error('Template lookup failed', error instanceof Error ? error.message : 'Please retry.'); }
    finally { setResolving(null); }
  };
  return (
    <div>
      <PageHeader title="CloudLabs Catalog" subtitle="Reusable lab templates and upcoming approved deliveries from CloudLabs.">
        <button className="btn-secondary" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> Reload cache</button>
        <button className="btn-primary" onClick={() => void refresh()} disabled={!canRefresh || refreshing || data?.catalogInFlight}>
          <CloudCog size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh from CloudLabs'}
        </button>
      </PageHeader>
      {data && <CloudLabsConnection connection={data.connection} canRefresh={data.canRefresh} />}
      {error && <div role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>}
      {loading && !data && <div role="status" className="card p-8 text-center text-muted">Loading CloudLabs catalog…</div>}
      {data && !snapshot && <EmptyState title="No catalog snapshot yet" hint="Configure the server connection, then refresh from CloudLabs. No demo data is used here." />}
      {snapshot && <>
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Lab templates" value={snapshot.labs.length} icon={<FlaskConical />} />
          <StatCard label="Active templates" value={snapshot.labs.filter(lab => lab.active).length} icon={<ShieldCheck />} tone="good" />
          <StatCard label="Upcoming deliveries" value={snapshot.deliveries.filter(delivery => delivery.daysUntil >= 0).length} icon={<CalendarDays />} tone="info" />
          <StatCard label="Scheduled seats" value={snapshot.deliveries.filter(delivery => delivery.daysUntil >= 0).reduce((total, delivery) => total + delivery.seats, 0)} icon={<Users />} />
        </div>
        <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
          <div className="flex gap-2">
            <button className="filter-button" aria-pressed={tab === 'templates'} onClick={() => setTab('templates')}>Templates</button>
            <button className="filter-button" aria-pressed={tab === 'deliveries'} onClick={() => setTab('deliveries')}>Deliveries</button>
          </div>
          <div className="relative min-w-0 flex-1 basis-52">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-subtle" aria-hidden="true" />
            <input className="input pl-9" value={q} onChange={event => setQ(event.target.value)} placeholder="Search catalog…" aria-label="Search catalog" />
          </div>
          {tab === 'templates' && <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={activeOnly} onChange={event => setActiveOnly(event.target.checked)} />Active only</label>}
        </div>
        <p className="mb-3 text-xs text-muted">Snapshot: {new Date(snapshot.capturedAt).toLocaleString()} · Read-only source data. Personal information is hidden unless enabled on the secured server.</p>
        <div className="card overflow-x-auto">
          {tab === 'templates' ? <table className="w-full min-w-[740px]">
            <thead className="bg-surface"><tr><th className="th">Template</th><th className="th">Platform</th><th className="th">Owner</th><th className="th">Status</th><th className="th">Resources</th></tr></thead>
            <tbody>{templates.map(lab => {
              const doc = resolved[lab.templateId] ?? lab.masterDocUrl;
              return <tr key={lab.templateId} className="border-t border-border hover:bg-surface/50">
                <td className="td"><div className="font-medium text-foreground">{lab.name}</div><div className="mt-1 max-w-80 truncate font-mono text-[10px] text-subtle" title={lab.templateId}>{lab.templateId}</div></td>
                <td className="td">{lab.cloudPlatform ?? '—'}</td><td className="td">{lab.owner ?? 'Not shared'}</td>
                <td className="td"><Badge className={lab.active ? 'status-good' : 'status-neutral'}>{lab.active ? 'Active' : 'Inactive'}</Badge></td>
                <td className="td"><div className="flex items-center gap-2">
                  {doc ? <a href={doc} target="_blank" rel="noreferrer" className="btn-secondary py-1.5 text-xs"><ExternalLink size={13} aria-hidden="true" />Document</a>
                    : <button className="btn-secondary py-1.5 text-xs" disabled={!canRefresh || resolving !== null} onClick={() => void resolve(lab)}><FileSearch size={13} aria-hidden="true" />{resolving === lab.templateId ? 'Resolving…' : 'Find document'}</button>}
                  <Link className="btn-ghost py-1.5 text-xs text-accent" to={`/cloudlabs-audits?templateId=${encodeURIComponent(lab.templateId)}`}><ShieldCheck size={13} aria-hidden="true" />Audit</Link>
                </div></td>
              </tr>;
            })}{templates.length === 0 && <tr><td colSpan={5} className="td py-10 text-center">No templates match these filters.</td></tr>}</tbody>
          </table> : <table className="w-full min-w-[720px]">
            <thead className="bg-surface"><tr><th className="th">Workshop</th><th className="th">Date</th><th className="th">Days</th><th className="th">Seats</th><th className="th">Customer</th><th className="th">Approval</th></tr></thead>
            <tbody>{deliveries.map((delivery, index) => <tr key={delivery.eventId ?? index} className="border-t border-border hover:bg-surface/50">
              <td className="td font-medium text-foreground">{delivery.trackTitle ?? 'Workshop'}</td><td className="td whitespace-nowrap">{delivery.date}</td>
              <td className="td"><Badge className={delivery.daysUntil <= 7 ? 'status-warn' : 'status-neutral'}>{delivery.daysUntil === 0 ? 'Today' : `${delivery.daysUntil}d`}</Badge></td>
              <td className="td tabular-nums">{delivery.seats}</td><td className="td">{delivery.customer ?? 'Not shared'}</td><td className="td"><Badge>{delivery.status}</Badge></td>
            </tr>)}{deliveries.length === 0 && <tr><td colSpan={6} className="td py-10 text-center">No upcoming deliveries match these filters.</td></tr>}</tbody>
          </table>}
        </div>
      </>}
      <CloudLabsSyncStatus />
    </div>
  );
}