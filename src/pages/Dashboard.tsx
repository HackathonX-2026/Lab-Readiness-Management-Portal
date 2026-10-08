import { useMemo } from 'react';
import { Activity, ArrowUpRight, CalendarDays, CircleCheck, Clock3, FlaskConical, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLabs } from '../state/LabsContext';
import { daysToWorkshop, isAtRisk, readinessStatus } from '../lib/rules';
import { PageHeader, StatCard } from '../components/ui';
import { CHART_COLORS, READINESS_COLORS as COLORS } from '../lib/chartTheme';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';

export default function Dashboard() {
  const { labs } = useLabs();
  const navigate = useNavigate();
  const now = new Date();

  const go = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    navigate(`/inventory${qs ? `?${qs}` : ''}`);
  };

  const stats = useMemo(() => {
    const totals = { total: labs.length, upcoming: 0, ready: 0, retest: 0, failed: 0, pending: 0, risk: 0 };
    for (const l of labs) {
      const status = readinessStatus(l);
      const dtw = daysToWorkshop(l, now);
      if (dtw !== null && dtw >= 0 && dtw <= 30) totals.upcoming++;
      if (status === 'Ready') totals.ready++;
      if (status === 'Retest Required') totals.retest++;
      if (status === 'Action Required') totals.failed++;
      if (status === 'Testing Pending') totals.pending++;
      if (isAtRisk(l, now)) totals.risk++;
    }
    return totals;
  }, [labs]);

  const readinessData = useMemo(() => {
    const map: Record<string, number> = { Ready: 0, 'Retest Required': 0, 'Testing Pending': 0, 'Action Required': 0 };
    for (const l of labs) map[readinessStatus(l)]++;
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [labs]);

  const trackData = useMemo(() => {
    const map: Record<string, { name: string; Ready: number; Retest: number; Pending: number; Action: number }> = {};
    for (const l of labs) {
      const key = l.trackName;
      map[key] ??= { name: key, Ready: 0, Retest: 0, Pending: 0, Action: 0 };
      const s = readinessStatus(l);
      if (s === 'Ready') map[key].Ready++;
      else if (s === 'Retest Required') map[key].Retest++;
      else if (s === 'Testing Pending') map[key].Pending++;
      else map[key].Action++;
    }
    return Object.values(map);
  }, [labs]);

  const workshopTrend = useMemo(() => {
    const buckets = [
      { label: 'Next 7d', min: 0, max: 7, count: 0 },
      { label: '8-15d', min: 8, max: 15, count: 0 },
      { label: '16-30d', min: 16, max: 30, count: 0 },
      { label: '31-60d', min: 31, max: 60, count: 0 },
      { label: '60d+', min: 61, max: 999, count: 0 }
    ];
    for (const l of labs) {
      const dtw = daysToWorkshop(l, now);
      if (dtw === null || dtw < 0) continue;
      const b = buckets.find(x => dtw >= x.min && dtw <= x.max);
      if (b) b.count++;
    }
    return buckets;
  }, [labs]);

  const readinessPct = stats.total ? Math.round((stats.ready / stats.total) * 100) : 0;

  const lastUpdated = useMemo(() => {
    let latest: number | null = null;
    for (const l of labs) {
      const t = l.lastUpdatedDate ? new Date(l.lastUpdatedDate).getTime() : NaN;
      if (!isNaN(t) && (latest === null || t > latest)) latest = t;
    }
    return latest ? new Date(latest) : null;
  }, [labs]);

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Real-time readiness across all production labs and upcoming workshops."
      >
        {lastUpdated && <LastUpdatedPill when={lastUpdated} />}
      </PageHeader>

      <HeroBanner totalLabs={stats.total} readinessPct={readinessPct} lastUpdated={lastUpdated} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Labs" value={stats.total} icon={<FlaskConical />} onClick={() => go({})} />
        <StatCard label="Workshops (30d)" value={stats.upcoming} icon={<CalendarDays />} tone="info" onClick={() => go({ workshop: '30' })} />
        <StatCard label="Ready" value={stats.ready} icon={<CircleCheck />} tone="good" onClick={() => go({ readiness: 'Ready' })} />
        <StatCard label="Retest Required" value={stats.retest} icon={<RefreshCw />} tone="warn" onClick={() => go({ readiness: 'Retest Required' })} />
        <StatCard label="Action Required" value={stats.failed} icon={<TriangleAlert />} tone="bad" onClick={() => go({ readiness: 'Action Required' })} />
        <StatCard label="Testing Pending" value={stats.pending} icon={<Clock3 />} tone="info" onClick={() => go({ readiness: 'Testing Pending' })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Readiness by Track</div>
              <div className="text-xs text-slate-500">Stacked view across the seven production tracks</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={trackData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                <Bar dataKey="Ready" stackId="a" fill={COLORS.Ready} />
                <Bar dataKey="Retest" stackId="a" fill={COLORS['Retest Required']} />
                <Bar dataKey="Pending" stackId="a" fill={COLORS['Testing Pending']} />
                <Bar dataKey="Action" stackId="a" fill={COLORS['Action Required']} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-sm font-semibold text-slate-800">Readiness Mix</div>
          <div className="text-xs text-slate-500 mb-2">Overall lab health</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={readinessData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke={CHART_COLORS.card}>
                  {readinessData.map(d => (
                    <Cell key={d.name} fill={COLORS[d.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={40} wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-3xl font-semibold tabular-nums text-accent">{readinessPct}%</div>
          <div className="text-center text-xs text-slate-500">Ready across portfolio</div>
        </div>
      </div>

      <div className="card p-5 mt-6">
        <div className="text-sm font-semibold text-slate-800">Upcoming Workshop Distribution</div>
        <div className="text-xs text-slate-500 mb-3">Workshops grouped by proximity</div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={workshopTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={80} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.risk > 0 && (
        <button
          type="button"
          onClick={() => go({ risk: '1' })}
          className="card mt-6 flex w-full items-center gap-3 border-danger/25 p-5 text-left transition-colors hover:border-danger/50"
        >
          <TriangleAlert size={20} className="shrink-0 text-danger" aria-hidden="true" />
          <div>
            <div className="text-sm font-medium text-danger">{stats.risk} labs are currently at risk</div>
            <div className="mt-1 text-xs text-muted">Click to open the Lab Inventory filtered by at-risk labs.</div>
          </div>
          <ArrowUpRight size={16} className="ml-auto shrink-0 text-muted" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function LastUpdatedPill({ when }: { when: Date }) {
  const label = when.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).replace(',', ',');
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/70 px-3 py-2 text-[11px] text-muted" title={when.toString()}>
      <Clock3 size={13} className="shrink-0 text-subtle" aria-hidden="true" />
      <span>Updated <time dateTime={when.toISOString()}>{label}</time></span>
    </div>
  );
}

function HeroBanner({
  totalLabs,
  readinessPct,
  lastUpdated
}: {
  totalLabs: number;
  readinessPct: number;
  lastUpdated: Date | null;
}) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  return (
    <section aria-label="Portfolio overview" className="card relative mb-6 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
      <div className="relative flex flex-col gap-6 p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary-soft text-accent sm:grid">
            <ShieldCheck size={21} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted">
              Microsoft Innovation
            </div>
            <h2 className="gradient-text text-2xl font-semibold leading-tight tracking-tight">Lab Readiness Portal</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Track production lab health, upcoming workshops, and testing status — all in one place.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><Activity size={12} aria-hidden="true" /> {today}</div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 xl:min-w-[280px]">
          <HeroStat label="Total Labs" value={totalLabs.toString()} />
          <HeroStat label="Ready" value={`${readinessPct}%`} accent />
          <HeroStat
            label="Last Sync"
            value={lastUpdated ? lastUpdated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
          />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${
      accent ? 'border-primary/25 bg-primary-soft' : 'border-border bg-background/40'
    }`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${accent ? 'text-accent' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
