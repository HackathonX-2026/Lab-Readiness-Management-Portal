import { useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useLabs } from '../state/LabsContext';
import { daysToWorkshop, readinessColor, readinessStatus } from '../lib/rules';
import { Badge, EmptyState, PageHeader } from '../components/ui';

export default function RetestingCenter() {
  const { labs } = useLabs();
  const now = new Date();

  const items = useMemo(() => {
    return labs
      .filter(l => readinessStatus(l) === 'Retest Required' || readinessStatus(l) === 'Action Required')
      .map(l => {
        const testDate = l.testDate ? parseISO(l.testDate) : null;
        const sinceLastTest = testDate ? differenceInCalendarDays(now, testDate) : null;
        const dtw = daysToWorkshop(l, now);
        const impact = dtw !== null && dtw >= 0 && dtw <= 7 ? 'Critical' : dtw !== null && dtw >= 0 && dtw <= 15 ? 'High' : dtw !== null && dtw >= 0 ? 'Medium' : 'Low';
        return { lab: l, sinceLastTest, dtw, impact };
      })
      .sort((a, b) => {
        const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return order[a.impact as keyof typeof order] - order[b.impact as keyof typeof order];
      });
  }, [labs]);

  return (
    <div>
      <PageHeader title="Retesting Center" subtitle={`${items.length} labs need attention`} />

      {items.length === 0 ? (
        <EmptyState title="All labs are on track!" hint="No retests or failed labs at the moment." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Impact</th>
                <th className="th">Lab</th>
                <th className="th">Language</th>
                <th className="th">Owner</th>
                <th className="th">Last Test</th>
                <th className="th">Days Since Test</th>
                <th className="th">Workshop</th>
                <th className="th">Readiness</th>
                <th className="th">Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ lab, sinceLastTest, dtw, impact }) => {
                const rs = readinessStatus(lab);
                const reason = lab.testStatus === 'Failed'
                  ? 'Last test failed'
                  : sinceLastTest && sinceLastTest > 15
                    ? `Tested ${sinceLastTest}d ago (>15d)`
                    : 'Retest window exceeded';
                return (
                  <tr key={lab.id} className="border-t border-slate-100">
                    <td className="td">
                      <span className={`badge ${
                        impact === 'Critical' ? 'bg-rose-100 text-rose-700' :
                        impact === 'High' ? 'bg-amber-100 text-amber-700' :
                        impact === 'Medium' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
                      }`}>{impact}</span>
                    </td>
                    <td className="td">
                      <div className="font-medium">{lab.labName}</div>
                      <div className="text-xs text-slate-500">{lab.trackName}</div>
                    </td>
                    <td className="td">{lab.language}</td>
                    <td className="td">{lab.assignedTo ?? <span className="text-rose-500">Unassigned</span>}</td>
                    <td className="td">{lab.testDate ?? '—'}</td>
                    <td className="td">{sinceLastTest ?? '—'}</td>
                    <td className="td">{lab.upcomingWorkshopDate ?? '—'} {dtw !== null && dtw >= 0 && <span className="text-slate-400">(T-{dtw}d)</span>}</td>
                    <td className="td"><Badge className={readinessColor(rs)}>{rs}</Badge></td>
                    <td className="td text-xs text-slate-600">{reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
