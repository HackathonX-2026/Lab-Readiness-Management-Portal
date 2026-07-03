import { useState } from 'react';
import { useAudit } from '../state/AuditContext';
import { useAuth } from '../state/AuthContext';
import { EmptyState, PageHeader } from '../components/ui';

const ACTIONS = ['All', 'login', 'logout', 'user.create', 'user.update', 'user.delete', 'user.resetPassword', 'lab.create', 'lab.update', 'lab.delete', 'lab.bulkUpdate', 'lab.import', 'lab.resetToSeed'];

export default function AuditLog() {
  const { entries, clear } = useAudit();
  const { currentUser } = useAuth();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('All');

  if (currentUser?.role !== 'Admin') {
    return <EmptyState title="Access denied" hint="Only Admins can view the audit log." />;
  }

  const filtered = entries.filter(e => {
    if (action !== 'All' && e.action !== action) return false;
    if (q && !`${e.actor} ${e.action} ${e.target ?? ''} ${e.details ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Audit Log" subtitle={`${filtered.length} of ${entries.length} events`}>
        <button className="btn-secondary" onClick={() => confirm('Clear the entire audit log?') && clear()}>🗑️ Clear log</button>
      </PageHeader>

      <div className="card p-3 mb-4 flex flex-wrap gap-3 items-center">
        <input
          className="input w-64"
          placeholder="Search actor / target / details..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select className="input w-56" value={action} onChange={e => setAction(e.target.value)}>
          {ACTIONS.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No events yet" hint="Actions across the portal will appear here." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">When</th>
                <th className="th">Actor</th>
                <th className="th">Action</th>
                <th className="th">Target</th>
                <th className="th">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="td whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
                  <td className="td">{e.actor}</td>
                  <td className="td font-mono text-xs">{e.action}</td>
                  <td className="td">{e.target ?? '—'}</td>
                  <td className="td text-xs text-slate-500 dark:text-slate-400">{e.details ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
