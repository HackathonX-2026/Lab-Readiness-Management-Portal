import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck, Clock3, History, RefreshCw, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { cloudlabsApi, type AuditOverview, type AuditSummary, type CloudLabsAuditRecord } from '../api/cloudlabs';
import { AUDIT_LABELS, AUDIT_POLICY, summarizeCloudLabsAudit } from '../../shared/cloudlabs';
import { useCloudLabsCatalog } from '../lib/useCloudLabsCatalog';
import { useDialogFocus } from '../lib/useDialogFocus';
import CloudLabsConnection from '../components/CloudLabsConnection';
import { Badge, EmptyState, PageHeader, StatCard } from '../components/ui';

export default function CloudLabsAudits() {
  const catalog = useCloudLabsCatalog();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('templateId') ?? '');
  const [overview, setOverview] = useState<AuditOverview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ name: string; templateId: string; record: CloudLabsAuditRecord | null; summary: AuditSummary } | null>(null);
  const load = useCallback(async () => {
    try { setOverview((await cloudlabsApi.auditOverview()).items); setError(null); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to read cached audit status.'); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);
  const summaries = useMemo(() => new Map(overview.map(item => [item.templateId, item.summary])), [overview]);
  const labs = catalog.data?.snapshot?.labs ?? [];
  const filtered = labs.filter(lab => `${lab.name} ${lab.templateId} ${lab.cloudPlatform ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const canRefresh = Boolean(catalog.data?.configured && catalog.data.canRefresh);
  const refresh = async (ids: string[]) => {
    if (!ids.length || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await cloudlabsApi.refreshAudits(ids);
      setOverview(previous => [...previous.filter(item => !ids.includes(item.templateId)), ...result.items]);
      if (!result.ok) setError('Some checks failed. Last-known history is retained, but it is not a current test result.');
      setSelected(new Set());
    } catch (error) { setError(error instanceof Error ? error.message : 'Audit refresh failed.'); }
    finally { setBusy(false); }
  };
  const history = async (templateId: string, name: string) => {
    try { setDetail({ name, ...await cloudlabsApi.audit(templateId) }); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to load audit history.'); }
  };
  return (
    <div>
      <PageHeader title="CloudLabs Audits" subtitle="Test completion, validation, owner sign-off, and freshness are verified separately.">
        <button className="btn-secondary" onClick={() => { void load(); void catalog.reload(); }} disabled={busy}><RefreshCw size={14} aria-hidden="true" />Reload cache</button>
        <button className="btn-primary" disabled={!canRefresh || !selected.size || busy} onClick={() => void refresh([...selected])}><ShieldCheck size={15} aria-hidden="true" />{busy ? 'Checking…' : `Refresh selected (${selected.size})`}</button>
      </PageHeader>
      {catalog.data && <CloudLabsConnection connection={catalog.data.connection} canRefresh={catalog.data.canRefresh} />}
      {(error || catalog.error) && <div role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error || catalog.error}</div>}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Templates" value={labs.length} icon={<ShieldCheck />} />
        <StatCard label="Checks met" value={overview.filter(item => item.summary.checksMet).length} icon={<CircleCheck />} tone="good" />
        <StatCard label="Validation failed" value={overview.filter(item => item.summary.validation === 'failed').length} icon={<TriangleAlert />} tone="bad" />
        <StatCard label="Unknown / stale" value={labs.filter(lab => summaries.get(lab.templateId)?.availability !== 'current').length} icon={<Clock3 />} tone="warn" />
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted">Read-only CloudLabs history. This never creates an audit, marks testing complete, changes local test results, or approves a workshop. Checks expire after 24 hours; refresh up to {AUDIT_POLICY.batchSize} templates per batch, with a 60-second per-template cooldown.</p>
      {!catalog.loading && !catalog.data?.snapshot ? <>
        <EmptyState title="Refresh the catalog first" hint="Audits are only queried for exact template IDs belonging to the configured partner." />
        <Link to="/catalog" className="btn-secondary mt-4">Open CloudLabs Catalog</Link>
      </> : <>
        <div className="relative mb-4"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-subtle" aria-hidden="true" /><input className="input pl-9" aria-label="Search audit templates" placeholder="Search templates or exact IDs…" value={q} onChange={event => setQ(event.target.value)} /></div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-surface"><tr><th className="th">Select</th><th className="th">Template</th><th className="th">Completion</th><th className="th">Validation</th><th className="th">Owner review</th><th className="th">Freshness</th><th className="th">Last test</th><th className="th">Actions</th></tr></thead>
            <tbody>{filtered.map(lab => {
              const summary = summaries.get(lab.templateId) ?? summarizeCloudLabsAudit(null);
              return <tr key={lab.templateId} className="border-t border-border hover:bg-surface/50">
                <td className="td"><input type="checkbox" aria-label={`Select ${lab.name}`} checked={selected.has(lab.templateId)} disabled={busy || (!selected.has(lab.templateId) && selected.size >= AUDIT_POLICY.batchSize)} onChange={event => {
                  const checked = event.target.checked;
                  setSelected(previous => { const next = new Set(previous); if (checked) next.add(lab.templateId); else next.delete(lab.templateId); return next; });
                }} /></td>
                <td className="td"><div className="font-medium text-foreground">{lab.name}</div><div className="mt-1 text-[11px] text-muted">{summary.availability === 'current' ? `${summary.testCount} test audit(s)` : summary.availability.replace(/_/g, ' ')}</div></td>
                <td className="td"><AuditBadge kind="completion" value={summary.completion} /></td>
                <td className="td"><AuditBadge kind="validation" value={summary.validation} /></td>
                <td className="td"><AuditBadge kind="review" value={summary.review} /></td>
                <td className="td"><AuditBadge kind="freshness" value={summary.freshness} /></td>
                <td className="td whitespace-nowrap">{summary.lastTestAt ? new Date(summary.lastTestAt).toLocaleDateString() : 'Unknown'}</td>
                <td className="td"><div className="flex gap-1"><button className="btn-ghost px-2" title="View history" aria-label={`History for ${lab.name}`} onClick={() => void history(lab.templateId, lab.name)}><History size={15} aria-hidden="true" /></button><button className="btn-secondary px-2" title="Refresh audit" aria-label={`Refresh audit for ${lab.name}`} disabled={!canRefresh || busy} onClick={() => void refresh([lab.templateId])}><RefreshCw size={14} aria-hidden="true" /></button></div></td>
              </tr>;
            })}{!filtered.length && <tr><td className="td py-10 text-center" colSpan={8}>{catalog.loading ? 'Loading templates…' : 'No templates match your search.'}</td></tr>}</tbody>
          </table>
        </div>
      </>}
      {detail && <AuditHistory detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function AuditBadge({ kind, value }: { kind: keyof typeof AUDIT_LABELS; value: string }) {
  const labels: Record<string, string> = AUDIT_LABELS[kind];
  const tone = ['completed', 'passed', 'signed_off', 'recent'].includes(value) ? 'status-good'
    : ['failed', 'stale'].includes(value) ? 'status-bad' : ['in_progress', 'pending', 'retest_suggested', 'aging'].includes(value) ? 'status-warn' : 'status-neutral';
  return <Badge className={tone}>{labels[value] ?? 'Unknown'}</Badge>;
}

function AuditHistory({ detail, onClose }: { detail: { name: string; record: CloudLabsAuditRecord | null; summary: AuditSummary }; onClose: () => void }) {
  const ref = useDialogFocus<HTMLDivElement>(true, onClose);
  return <div className="modal-backdrop" onClick={onClose}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="audit-history-title" tabIndex={-1} className="popover max-h-[85dvh] w-full max-w-3xl overflow-auto rounded-2xl p-5" onClick={event => event.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="audit-history-title" className="text-lg font-semibold">Audit history</h2><p className="mt-1 text-sm text-muted">{detail.name}</p></div><button className="btn-icon" aria-label="Close audit history" onClick={onClose}><X size={17} aria-hidden="true" /></button></div>
      <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-muted">{detail.summary.message}</p>
      {detail.record?.fetchedAt && <p className="mb-3 text-xs text-muted">Last successful check: {new Date(detail.record.fetchedAt).toLocaleString()}</p>}
      {detail.record?.events.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr><th className="th">Event / date</th><th className="th">Completion</th><th className="th">Validation</th><th className="th">Owner</th></tr></thead><tbody>
        {detail.record.events.map((event, index) => <tr key={`${event.id ?? index}-${index}`} className="border-t border-border"><td className="td"><div className="font-medium text-foreground">{event.type}</div><div className="mt-1 text-xs">{event.at ? new Date(event.at).toLocaleString() : 'Unknown date'}</div>{event.actor && <div className="mt-1 text-xs">{event.actor}</div>}</td><td className="td"><AuditBadge kind="completion" value={event.statusId === 2 ? 'completed' : event.statusId === 1 ? 'in_progress' : 'unknown'} /></td><td className="td"><AuditBadge kind="validation" value={event.validation} /></td><td className="td"><AuditBadge kind="review" value={event.ownerReviewed === true ? 'signed_off' : event.ownerReviewed === false ? 'pending' : 'unknown'} /></td></tr>)}
      </tbody></table></div> : <p className="py-6 text-center text-sm text-muted">No cached events available.</p>}
    </div>
  </div>;
}