import { useMemo } from 'react';
import { CalendarDays, ChartNoAxesCombined, TriangleAlert, Users } from 'lucide-react';
import { useLabs } from '../state/LabsContext';
import { daysToWorkshop, isAtRisk, readinessStatus, riskReasons } from '../lib/rules';
import { PageHeader, StatCard } from '../components/ui';
import { CHART_COLORS, CHART_PALETTE as COLORS } from '../lib/chartTheme';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

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
        <StatCard label="Overall Readiness" value={`${readinessPct}%`} icon={<ChartNoAxesCombined />} tone="good" />
        <StatCard label="Workshop Coverage (30d)" value={`${workshopCoverage.coverage}%`} hint={`${workshopCoverage.ready}/${workshopCoverage.total} ready`} icon={<CalendarDays />} tone="info" />
        <StatCard label="Labs at Risk" value={atRiskCount} icon={<TriangleAlert />} tone="bad" />
        <StatCard label="Testers Active" value={testerPerf.filter(t => t.name !== 'Unassigned').length} icon={<Users />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-800 mb-1">Tester Performance</div>
          <div className="text-xs text-slate-500 mb-3">Passed vs Failed vs Pending per tester</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={testerPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={70} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                <Bar dataKey="passed" stackId="s" fill={CHART_COLORS.success} name="Passed" />
                <Bar dataKey="failed" stackId="s" fill={CHART_COLORS.danger} name="Failed" />
                <Bar dataKey="pending" stackId="s" fill={CHART_COLORS.info} name="Pending" />
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
                <Pie data={languageDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100} paddingAngle={3} stroke={CHART_COLORS.card}>
                  {languageDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS.danger} radius={[0, 6, 6, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="text-sm font-semibold text-slate-800 mb-3">Tester Leaderboard</div>
          <div className="overflow-x-auto">
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
                  <td className="td text-success">{t.passed}</td>
                  <td className="td text-danger">{t.failed}</td>
                  <td className="td text-info">{t.pending}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-success" style={{ width: `${t.passRate}%` }} />
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
    </div>
  );
}
