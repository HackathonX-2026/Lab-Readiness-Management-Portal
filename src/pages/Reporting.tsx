import { useMemo } from 'react';
import { useLabs } from '../state/LabsContext';
import { daysToWorkshop, isAtRisk, readinessStatus, riskReasons } from '../lib/rules';
import { PageHeader, StatCard } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#4f6bed', '#10b981', '#f59e0b', '#e11d48', '#0ea5e9', '#8b5cf6', '#f97316'];

export default function Reporting() {
  const { labs } = useLabs();

  const readinessPct = useMemo(() => {
    if (!labs.length) return 0;
    return Math.round((labs.filter(l => readinessStatus(l) === 'Ready').length / labs.length) * 100);
  }, [labs]);

  const testerPerf = useMemo(() => {
    const map = new Map<string, { name: string; total: number; passed: number; failed: number; pending: number }>();
    for (const l of labs) {
      const name = l.assignedTo ?? 'Unassigned';
      const entry = map.get(name) ?? { name, total: 0, passed: 0, failed: 0, pending: 0 };
      entry.total++;
      if (l.testStatus === 'Passed') entry.passed++;
      else if (l.testStatus === 'Failed') entry.failed++;
      else entry.pending++;
      map.set(name, entry);
    }
    return [...map.values()]
      .map(x => ({ ...x, passRate: x.total ? Math.round((x.passed / x.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [labs]);

  const languageDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of labs) map.set(l.language, (map.get(l.language) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [labs]);

  const workshopCoverage = useMemo(() => {
    const upcoming = labs.filter(l => {
      const d = daysToWorkshop(l);
      return d !== null && d >= 0 && d <= 30;
    });
    const ready = upcoming.filter(l => readinessStatus(l) === 'Ready').length;
    return { total: upcoming.length, ready, coverage: upcoming.length ? Math.round((ready / upcoming.length) * 100) : 0 };
  }, [labs]);

  const risks = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const l of labs) {
      for (const r of riskReasons(l)) {
        buckets[r] = (buckets[r] ?? 0) + 1;
      }
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [labs]);

  const atRiskCount = labs.filter(l => isAtRisk(l)).length;

  return (
    <div>
      <PageHeader title="Reporting & Analytics" subtitle="Portfolio health, tester performance, and risk overview." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Overall Readiness" value={`${readinessPct}%`} icon="📈" tone="good" />
        <StatCard label="Workshop Coverage (30d)" value={`${workshopCoverage.coverage}%`} hint={`${workshopCoverage.ready}/${workshopCoverage.total} ready`} icon="📅" tone="info" />
        <StatCard label="Labs at Risk" value={atRiskCount} icon="⚠️" tone="bad" />
        <StatCard label="Testers Active" value={testerPerf.filter(t => t.name !== 'Unassigned').length} icon="🧑‍🔬" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-800 mb-1">Tester Performance</div>
          <div className="text-xs text-slate-500 mb-3">Passed vs Failed vs Pending per tester</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={testerPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={70} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passed" stackId="s" fill="#10b981" name="Passed" />
                <Bar dataKey="failed" stackId="s" fill="#e11d48" name="Failed" />
                <Bar dataKey="pending" stackId="s" fill="#0ea5e9" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-800 mb-1">Language-wise Distribution</div>
          <div className="text-xs text-slate-500 mb-3">Where labs are localized</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={languageDist} dataKey="value" nameKey="name" outerRadius={100}>
                  {languageDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="text-sm font-semibold text-slate-800 mb-1">Risk Analysis</div>
          <div className="text-xs text-slate-500 mb-3">Number of labs matching each risk criterion</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={risks} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={280} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#e11d48" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="text-sm font-semibold text-slate-800 mb-3">Tester Leaderboard</div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Tester</th>
                <th className="th">Assigned</th>
                <th className="th">Passed</th>
                <th className="th">Failed</th>
                <th className="th">Pending</th>
                <th className="th">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {testerPerf.map(t => (
                <tr key={t.name} className="border-t border-slate-100">
                  <td className="td font-medium">{t.name}</td>
                  <td className="td">{t.total}</td>
                  <td className="td text-emerald-700">{t.passed}</td>
                  <td className="td text-rose-700">{t.failed}</td>
                  <td className="td text-sky-700">{t.pending}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${t.passRate}%` }} />
                      </div>
                      <span className="text-xs">{t.passRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
