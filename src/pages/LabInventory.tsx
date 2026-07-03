import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLabs } from '../state/LabsContext';
import { useRole } from '../state/RoleContext';
import { useToast } from '../state/ToastContext';
import { daysGap, daysToWorkshop, isAtRisk, readinessColor, readinessStatus, testStatusColor } from '../lib/rules';
import type { Lab, Priority, ReadinessStatus, TestStatus } from '../types';
import { Badge, PageHeader } from '../components/ui';
import LabEditor from '../components/LabEditor';

type SortKey =
  | 'trackName' | 'labName' | 'language' | 'assignedTo' | 'priority'
  | 'testDate' | 'upcomingWorkshopDate' | 'daysGap' | 'readiness' | 'testStatus';

const READINESS_FILTERS: (ReadinessStatus | 'All')[] = ['All', 'Ready', 'Retest Required', 'Testing Pending', 'Action Required'];
const TEST_FILTERS: (TestStatus | 'All')[] = ['All', 'Passed', 'Failed', 'In Progress', 'Not Started'];
const PRIORITY_FILTERS: (Priority | 'All')[] = ['All', 'P0', 'P1', 'P2', 'P3', 'P4'];

function priorityColor(p: Priority | undefined | null): string {
  switch (p) {
    case 'P0': return 'bg-rose-100 text-rose-700';
    case 'P1': return 'bg-amber-100 text-amber-700';
    case 'P2': return 'bg-sky-100 text-sky-700';
    case 'P3': return 'bg-slate-100 text-slate-600';
    case 'P4': return 'bg-slate-100 text-slate-500';
    default: return 'bg-slate-100 text-slate-400';
  }
}

interface SavedView {
  id: string;
  name: string;
  q: string;
  readiness: string;
  test: string;
  track: string;
  language: string;
  priority: string;
  workshopWindow: number | null;
  riskOnly: boolean;
}

export default function LabInventory() {
  const { labs, updateLab, deleteLab, bulkUpdate, addLab } = useLabs();
  const { user, role } = useRole();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [readinessF, setReadinessF] = useState<(typeof READINESS_FILTERS)[number]>('All');
  const [testF, setTestF] = useState<(typeof TEST_FILTERS)[number]>('All');
  const [trackF, setTrackF] = useState<string>('All');
  const [languageF, setLanguageF] = useState<string>('All');
  const [priorityF, setPriorityF] = useState<(typeof PRIORITY_FILTERS)[number]>('All');
  const [workshopWindow, setWorkshopWindow] = useState<number | null>(null);
  const [riskOnly, setRiskOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('upcomingWorkshopDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Lab | 'new' | null>(null);
  const [bulkStatus, setBulkStatus] = useState<TestStatus | ''>('');
  const [bulkAssignee, setBulkAssignee] = useState('');

  // Apply URL query params on first render
  useEffect(() => {
    const r = params.get('readiness');
    if (r && (READINESS_FILTERS as string[]).includes(r)) setReadinessF(r as any);
    const t = params.get('test');
    if (t && (TEST_FILTERS as string[]).includes(t)) setTestF(t as any);
    const p = params.get('priority');
    if (p && (PRIORITY_FILTERS as (string | null)[]).includes(p)) setPriorityF(p as any);
    const w = params.get('workshop');
    if (w) {
      const n = parseInt(w, 10);
      if (!isNaN(n) && n > 0) setWorkshopWindow(n);
    }
    if (params.get('risk') === '1') setRiskOnly(true);
    const search = params.get('q');
    if (search) setQ(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearUrl = () => {
    if ([...params.keys()].length) setParams({}, { replace: true });
  };

  // Saved views
  const SV_KEY = 'lab-readiness:saved-views';
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try { return JSON.parse(localStorage.getItem(SV_KEY) ?? '[]') as SavedView[]; }
    catch { return []; }
  });
  useEffect(() => { localStorage.setItem(SV_KEY, JSON.stringify(savedViews)); }, [savedViews]);

  const saveCurrentView = () => {
    const name = prompt('Name this view (e.g. "My P0 labs this week"):');
    if (!name?.trim()) return;
    const view: SavedView = {
      id: `sv-${Date.now()}`,
      name: name.trim(),
      q, readiness: readinessF, test: testF, track: trackF, language: languageF,
      priority: priorityF ?? 'All', workshopWindow, riskOnly
    };
    setSavedViews(prev => [...prev, view]);
    toast.success('View saved', name.trim());
  };
  const applyView = (v: SavedView) => {
    setQ(v.q);
    setReadinessF(v.readiness as any);
    setTestF(v.test as any);
    setTrackF(v.track);
    setLanguageF(v.language);
    setPriorityF(v.priority as any);
    setWorkshopWindow(v.workshopWindow);
    setRiskOnly(v.riskOnly);
    clearUrl();
    toast.info('View applied', v.name);
  };
  const deleteView = (id: string) => setSavedViews(prev => prev.filter(v => v.id !== id));

  const tracks = useMemo(() => ['All', ...Array.from(new Set(labs.map(l => l.trackName))).sort()], [labs]);
  const languages = useMemo(() => ['All', ...Array.from(new Set(labs.map(l => l.language))).sort()], [labs]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = labs.filter(l => {
      if (ql && !`${l.trackName} ${l.labName} ${l.language} ${l.assignedTo ?? ''} ${l.comments}`.toLowerCase().includes(ql)) return false;
      if (readinessF !== 'All' && readinessStatus(l) !== readinessF) return false;
      if (testF !== 'All' && l.testStatus !== testF) return false;
      if (trackF !== 'All' && l.trackName !== trackF) return false;
      if (languageF !== 'All' && l.language !== languageF) return false;
      if (priorityF !== 'All' && (l.priority ?? '') !== priorityF) return false;
      if (workshopWindow !== null) {
        const dtw = daysToWorkshop(l);
        if (dtw === null || dtw < 0 || dtw > workshopWindow) return false;
      }
      if (riskOnly && !isAtRisk(l)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const get = (l: Lab): string | number => {
        switch (sortKey) {
          case 'daysGap': return daysGap(l) ?? Number.POSITIVE_INFINITY;
          case 'readiness': return readinessStatus(l);
          case 'testDate': return l.testDate ?? '9999';
          case 'upcomingWorkshopDate': return l.upcomingWorkshopDate ?? '9999';
          case 'assignedTo': return l.assignedTo ?? 'zzz';
          case 'priority': return l.priority ?? 'ZZ';
          default: return (l[sortKey] ?? '') as string;
        }
      };
      const av = get(a), bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [labs, q, readinessF, testF, trackF, languageF, priorityF, workshopWindow, riskOnly, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const allSelectedOnPage = filtered.length > 0 && filtered.every(l => selected.has(l.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelectedOnPage) filtered.forEach(l => next.delete(l.id));
    else filtered.forEach(l => next.add(l.id));
    setSelected(next);
  };

  const applyBulk = () => {
    if (selected.size === 0) return;
    const patch: Partial<Lab> = {};
    if (bulkStatus) patch.testStatus = bulkStatus;
    if (bulkAssignee) patch.assignedTo = bulkAssignee;
    if (Object.keys(patch).length === 0) { toast.warning('Nothing to update', 'Choose at least one field.'); return; }
    const count = selected.size;
    bulkUpdate([...selected], patch, user);
    setSelected(new Set());
    setBulkStatus('');
    setBulkAssignee('');
    toast.success('Bulk update applied', `${count} labs updated`);
  };

  const canEdit = role !== 'Manager';

  const activeChips: { label: string; onClear: () => void }[] = [];
  if (readinessF !== 'All') activeChips.push({ label: `Readiness: ${readinessF}`, onClear: () => setReadinessF('All') });
  if (testF !== 'All') activeChips.push({ label: `Test: ${testF}`, onClear: () => setTestF('All') });
  if (trackF !== 'All') activeChips.push({ label: `Track: ${trackF}`, onClear: () => setTrackF('All') });
  if (languageF !== 'All') activeChips.push({ label: `Language: ${languageF}`, onClear: () => setLanguageF('All') });
  if (priorityF !== 'All') activeChips.push({ label: `Priority: ${priorityF}`, onClear: () => setPriorityF('All') });
  if (workshopWindow !== null) activeChips.push({ label: `Workshop ≤ ${workshopWindow}d`, onClear: () => setWorkshopWindow(null) });
  if (riskOnly) activeChips.push({ label: 'At risk only', onClear: () => setRiskOnly(false) });

  const clearAllFilters = () => {
    setReadinessF('All'); setTestF('All'); setTrackF('All'); setLanguageF('All');
    setPriorityF('All'); setWorkshopWindow(null); setRiskOnly(false); setQ('');
    clearUrl();
  };

  return (
    <div>
      <PageHeader title="Lab Inventory" subtitle={`${filtered.length} of ${labs.length} labs`}>
        <button className="btn-secondary" onClick={saveCurrentView} title="Save current filters as a view">
          ⭐ Save view
        </button>
        {canEdit && (
          <button className="btn-primary" onClick={() => setEditing('new')}>➕ Add Lab</button>
        )}
      </PageHeader>

      {savedViews.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">Saved views:</span>
          {savedViews.map(v => (
            <div key={v.id} className="inline-flex items-center rounded-full text-xs font-medium border overflow-hidden
                                        border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <button
                type="button"
                onClick={() => applyView(v)}
                className="px-3 py-1 hover:bg-brand-50 dark:hover:bg-brand-700/25 text-slate-700 dark:text-slate-200"
              >
                ⭐ {v.name}
              </button>
              <button
                type="button"
                onClick={() => deleteView(v.id)}
                title="Delete view"
                className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 border-l border-slate-200 dark:border-slate-700"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 bg-brand-50 border-brand-200">
          <span className="text-xs font-semibold text-brand-900 mr-1">Filters:</span>
          {activeChips.map(c => (
            <button
              key={c.label}
              onClick={() => { c.onClear(); clearUrl(); }}
              className="badge bg-white border border-brand-300 text-brand-900 hover:bg-rose-50 hover:border-rose-300"
              title="Clear this filter"
            >
              {c.label} ✕
            </button>
          ))}
          <button className="text-xs text-rose-600 hover:underline ml-auto" onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      )}

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            className="input md:col-span-2"
            placeholder="Search track, lab, tester, comments..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select className="input" value={readinessF} onChange={e => setReadinessF(e.target.value as any)}>
            {READINESS_FILTERS.map(r => <option key={r}>{r === 'All' ? 'All Readiness' : r}</option>)}
          </select>
          <select className="input" value={testF} onChange={e => setTestF(e.target.value as any)}>
            {TEST_FILTERS.map(r => <option key={r}>{r === 'All' ? 'All Test Statuses' : r}</option>)}
          </select>
          <select className="input" value={trackF} onChange={e => setTrackF(e.target.value)}>
            {tracks.map(t => <option key={t}>{t}</option>)}
          </select>
          <select className="input" value={languageF} onChange={e => setLanguageF(e.target.value)}>
            {languages.map(l => <option key={l}>{l}</option>)}
          </select>
          <select className="input" value={priorityF ?? 'All'} onChange={e => setPriorityF(e.target.value as any)}>
            {PRIORITY_FILTERS.map(p => <option key={p ?? 'all'} value={p ?? 'All'}>{p === 'All' ? 'All Priorities' : p}</option>)}
          </select>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={riskOnly} onChange={e => setRiskOnly(e.target.checked)} />
          Show at-risk labs only
        </label>
      </div>

      {canEdit && selected.size > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-3 bg-brand-50 border-brand-200">
          <div className="text-sm font-semibold text-brand-900">Bulk update ({selected.size} selected):</div>
          <select className="input w-40" value={bulkStatus} onChange={e => setBulkStatus(e.target.value as TestStatus)}>
            <option value="">Set test status...</option>
            <option>Passed</option><option>Failed</option><option>In Progress</option><option>Not Started</option>
          </select>
          <input className="input w-52" placeholder="Reassign to..." value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)} />
          <button className="btn-primary" onClick={applyBulk}>Apply</button>
          <button className="btn-secondary" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {canEdit && (
                  <th className="th w-8">
                    <input type="checkbox" checked={allSelectedOnPage} onChange={toggleAll} />
                  </th>
                )}
                {([
                  ['priority', 'P'],
                  ['trackName', 'Track'],
                  ['labName', 'Lab'],
                  ['language', 'Language'],
                  ['assignedTo', 'Assigned To'],
                  ['testDate', 'Test Date'],
                  ['upcomingWorkshopDate', 'Workshop'],
                  ['daysGap', 'Days Gap'],
                  ['readiness', 'Readiness'],
                  ['testStatus', 'Test Status']
                ] as [SortKey, string][]).map(([k, label]) => (
                  <th key={k} className="th cursor-pointer hover:text-slate-900" onClick={() => toggleSort(k)}>
                    {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th className="th">Links</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lab => {
                const gap = daysGap(lab);
                const rs = readinessStatus(lab);
                const risk = isAtRisk(lab);
                return (
                  <tr key={lab.id} className={`border-t border-slate-100 hover:bg-slate-50 ${risk ? 'bg-rose-50/30' : ''}`}>
                    {canEdit && (
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={selected.has(lab.id)}
                          onChange={e => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(lab.id); else next.delete(lab.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                    )}
                    <td className="td"><Badge className={priorityColor(lab.priority)}>{lab.priority ?? '—'}</Badge></td>
                    <td className="td font-medium text-slate-800">{lab.trackName}</td>
                    <td className="td">
                      {lab.labName}
                      {risk && <span className="ml-2 badge bg-rose-100 text-rose-700">⚠️ Risk</span>}
                    </td>
                    <td className="td">{lab.language}</td>
                    <td className="td">{lab.assignedTo ?? <span className="text-rose-500">Unassigned</span>}</td>
                    <td className="td">
                      {canEdit ? (
                        <input
                          type="date"
                          value={lab.testDate ?? ''}
                          onChange={e => {
                            updateLab(lab.id, { testDate: e.target.value || null }, user);
                            toast.success('Test date updated', lab.labName);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-brand-500 rounded px-1 py-0.5 text-sm w-32"
                        />
                      ) : (lab.testDate ?? '—')}
                    </td>
                    <td className="td">{lab.upcomingWorkshopDate ?? '—'}</td>
                    <td className="td">{gap ?? '—'}</td>
                    <td className="td"><Badge className={readinessColor(rs)}>{rs}</Badge></td>
                    <td className="td">
                      {canEdit ? (
                        <InlineTestStatus
                          value={lab.testStatus}
                          onChange={next => {
                            updateLab(lab.id, { testStatus: next }, user);
                            toast.success('Status updated', `${lab.labName} → ${next}`);
                          }}
                        />
                      ) : (
                        <Badge className={testStatusColor(lab.testStatus)}>{lab.testStatus}</Badge>
                      )}
                    </td>
                    <td className="td whitespace-nowrap">
                      <LinkIcons lab={lab} />
                    </td>
                    <td className="td whitespace-nowrap">
                      <button className="text-brand-600 hover:underline text-sm mr-3" onClick={() => setEditing(lab)}>
                        {canEdit ? 'Edit' : 'View'}
                      </button>
                      {role === 'Admin' && (
                        <button
                          className="text-rose-600 hover:underline text-sm"
                          onClick={() => {
                            if (confirm(`Delete ${lab.labName}?`)) {
                              deleteLab(lab.id);
                              toast.info('Lab deleted', lab.labName);
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="td text-center text-slate-500 py-10">No labs match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <LabEditor
          lab={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={patch => {
            if (editing === 'new') {
              addLab(patch as Omit<Lab, 'id' | 'lastUpdatedBy' | 'lastUpdatedDate'>, user);
            } else {
              updateLab((editing as Lab).id, patch, user);
            }
            setEditing(null);
          }}
          readOnly={!canEdit}
        />
      )}
    </div>
  );
}

function LinkIcons({ lab }: { lab: Lab }) {
  const items: { key: string; label: string; icon: string; value: string | null | undefined }[] = [
    { key: 'cost', label: 'Cost estimation', icon: '💰', value: lab.costEstimationLink },
    { key: 'release', label: 'Release notes', icon: '📝', value: lab.releaseNoteLink },
    { key: 'ppt', label: 'PPT', icon: '📊', value: lab.pptLink }
  ];
  const shown = items
    .map(i => ({ ...i, url: (i.value ?? '').trim() }))
    .filter(i => /^https?:\/\//i.test(i.url));

  if (shown.length === 0) return <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>;

  return (
    <div className="flex gap-1 flex-wrap">
      {shown.map(i => (
        <a
          key={i.key}
          href={i.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title={`${i.label} — open link`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-base leading-none border transition
                     bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100
                     dark:bg-brand-700/20 dark:text-brand-100 dark:border-brand-700/40 dark:hover:bg-brand-700/40"
        >
          {i.icon}
        </a>
      ))}
    </div>
  );
}

function InlineTestStatus({ value, onChange }: { value: TestStatus; onChange: (next: TestStatus) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <select
        autoFocus
        value={value}
        onChange={e => { onChange(e.target.value as TestStatus); setEditing(false); }}
        onBlur={() => setEditing(false)}
        onClick={e => e.stopPropagation()}
        className="input py-0.5 h-7 text-xs w-32"
      >
        <option>Passed</option>
        <option>Failed</option>
        <option>In Progress</option>
        <option>Not Started</option>
      </select>
    );
  }
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="Click to change status"
      className={`badge ${testStatusColor(value)} hover:ring-2 hover:ring-brand-400 cursor-pointer`}
    >
      {value}
    </button>
  );
}
