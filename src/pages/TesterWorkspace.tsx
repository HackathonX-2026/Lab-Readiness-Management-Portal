import { useMemo, useState } from 'react';
import { useLabs } from '../state/LabsContext';
import { useRole } from '../state/RoleContext';
import { daysToWorkshop, readinessColor, readinessStatus, testStatusColor } from '../lib/rules';
import type { Lab, TestStatus } from '../types';
import { Badge, EmptyState, PageHeader, StatCard } from '../components/ui';

export default function TesterWorkspace() {
  const { labs, updateLab } = useLabs();
  const { user, role } = useRole();
  const testerName = user;
  const [tab, setTab] = useState<'all' | 'pending' | 'failed' | 'retest' | 'deadlines'>('all');

  const mine = useMemo(
    () => labs.filter(l => (l.assignedTo ?? '').toLowerCase() === testerName.toLowerCase()),
    [labs, testerName]
  );

  const groups = useMemo(() => {
    const pending = mine.filter(l => !l.testDate || l.testStatus === 'Not Started' || l.testStatus === 'In Progress');
    const failed = mine.filter(l => l.testStatus === 'Failed');
    const retest = mine.filter(l => readinessStatus(l) === 'Retest Required');
    const deadlines = mine
      .map(l => ({ lab: l, dtw: daysToWorkshop(l) }))
      .filter(x => x.dtw !== null && x.dtw >= 0 && x.dtw <= 15)
      .sort((a, b) => a.dtw! - b.dtw!)
      .map(x => x.lab);
    return { pending, failed, retest, deadlines };
  }, [mine]);

  const list = tab === 'all' ? mine : groups[tab];

  return (
    <div>
      <PageHeader
        title="Tester Workspace"
        subtitle={`Signed in as ${testerName} (${role}). Update statuses directly from this view.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatCard label="Assigned to me" value={mine.length} icon="📋" />
        <StatCard label="Pending tests" value={groups.pending.length} icon="⏳" tone="info" />
        <StatCard label="Failed" value={groups.failed.length} icon="🚨" tone="bad" />
        <StatCard label="Retest requests" value={groups.retest.length} icon="🔁" tone="warn" />
        <StatCard label="Upcoming (15d)" value={groups.deadlines.length} icon="📅" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'pending', 'failed', 'retest', 'deadlines'] as const).map(t => (
          <button
            key={t}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : t === 'pending' ? 'Pending' : t === 'failed' ? 'Failed' : t === 'retest' ? 'Retest' : 'Upcoming'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nothing here!" hint="Try switching tabs or check assignments." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map(lab => <LabCard key={lab.id} lab={lab} onStatusChange={(s) => updateLab(lab.id, { testStatus: s, testDate: lab.testDate ?? new Date().toISOString().split('T')[0] }, user)} onDateChange={d => updateLab(lab.id, { testDate: d }, user)} onComment={c => updateLab(lab.id, { comments: c }, user)} />)}
        </div>
      )}
    </div>
  );
}

function LabCard({ lab, onStatusChange, onDateChange, onComment }: {
  lab: Lab;
  onStatusChange: (s: TestStatus) => void;
  onDateChange: (d: string) => void;
  onComment: (c: string) => void;
}) {
  const rs = readinessStatus(lab);
  const dtw = daysToWorkshop(lab);
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">{lab.labName}</div>
          <div className="text-xs text-slate-500">{lab.trackName} · {lab.language}</div>
        </div>
        <Badge className={readinessColor(rs)}>{rs}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Workshop</div>
          <div className="font-medium">{lab.upcomingWorkshopDate ?? '—'} {dtw !== null && dtw >= 0 && <span className="text-slate-400">(T-{dtw}d)</span>}</div>
        </div>
        <div>
          <div className="text-slate-500">Current status</div>
          <div><Badge className={testStatusColor(lab.testStatus)}>{lab.testStatus}</Badge></div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs">
          <div className="text-slate-500 mb-1">Test date</div>
          <input type="date" className="input" value={lab.testDate ?? ''} onChange={e => onDateChange(e.target.value)} />
        </label>
        <label className="text-xs">
          <div className="text-slate-500 mb-1">Update status</div>
          <select className="input" value={lab.testStatus} onChange={e => onStatusChange(e.target.value as TestStatus)}>
            <option>Passed</option><option>Failed</option><option>In Progress</option><option>Not Started</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block text-xs">
        <div className="text-slate-500 mb-1">Comments</div>
        <textarea
          className="input min-h-[60px]"
          defaultValue={lab.comments}
          onBlur={e => onComment(e.target.value)}
          placeholder="Notes for next test run..."
        />
      </label>
    </div>
  );
}
