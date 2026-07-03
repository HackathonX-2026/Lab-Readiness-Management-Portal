import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLabs } from '../state/LabsContext';
import { daysToWorkshop, isAtRisk, readinessStatus } from '../lib/rules';
import { PageHeader, StatCard } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';

const COLORS = {
  Ready: '#10b981',
  'Retest Required': '#f59e0b',
  'Testing Pending': '#0ea5e9',
  'Action Required': '#e11d48'
};

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
      <HeroBanner totalLabs={stats.total} readinessPct={readinessPct} lastUpdated={lastUpdated} />

      <PageHeader
        title="Executive Dashboard"
        subtitle="Real-time readiness across all production labs and upcoming workshops."
      >
        {lastUpdated && <LastUpdatedPill when={lastUpdated} />}
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Labs" value={stats.total} icon="🧪" onClick={() => go({})} />
        <StatCard label="Upcoming Workshops (30d)" value={stats.upcoming} icon="📅" tone="info" onClick={() => go({ workshop: '30' })} />
        <StatCard label="Ready" value={stats.ready} icon="✅" tone="good" onClick={() => go({ readiness: 'Ready' })} />
        <StatCard label="Retest Required" value={stats.retest} icon="🔁" tone="warn" onClick={() => go({ readiness: 'Retest Required' })} />
        <StatCard label="Action Required" value={stats.failed} icon="🚨" tone="bad" onClick={() => go({ readiness: 'Action Required' })} />
        <StatCard label="Testing Pending" value={stats.pending} icon="⏳" tone="info" onClick={() => go({ readiness: 'Testing Pending' })} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
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
                <Pie data={readinessData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {readinessData.map(d => (
                    <Cell key={d.name} fill={COLORS[d.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-3xl font-bold text-brand-700">{readinessPct}%</div>
          <div className="text-center text-xs text-slate-500">Ready across portfolio</div>
        </div>
      </div>

      <div className="card p-5 mt-6">
        <div className="text-sm font-semibold text-slate-800">Upcoming Workshop Distribution</div>
        <div className="text-xs text-slate-500 mb-3">Workshops grouped by proximity</div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={workshopTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#4f6bed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.risk > 0 && (
        <button
          type="button"
          onClick={() => go({ risk: '1' })}
          className="card w-full text-left p-5 mt-6 border-l-4 border-rose-500 hover:shadow-md transition"
        >
          <div className="text-sm font-semibold text-rose-700">⚠️ {stats.risk} labs are currently at risk</div>
          <div className="text-xs text-slate-500 mt-1">
            Click to open the Lab Inventory filtered by at-risk labs.
          </div>
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
  const [date, time] = label.split(/\s(?=\d{1,2}:\d{2})/); // split off time part
  return (
    <div className="flex flex-col items-end gap-1.5" title={when.toString()}>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                       bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
        Last Updated
      </span>
      <div className="px-3 py-1 rounded-lg text-xs font-mono
                      bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200
                      border border-slate-200 dark:border-slate-700">
        {date} • {time}
      </div>
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
    <div className="relative overflow-hidden rounded-2xl mb-6 shadow-lg">
      {/* Gradient backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(120deg, #1c2966 0%, #4f6bed 45%, #7c3aed 100%)'
        }}
      />
      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full opacity-30"
           style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
      <div className="absolute -bottom-24 -left-10 w-80 h-80 rounded-full opacity-20"
           style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 p-8 text-white">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur grid place-items-center text-3xl shrink-0 border border-white/20">
            🚀
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">
              Microsoft Innovation
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
              MS Innovation
              <span className="mx-2 text-white/50 font-light">—</span>
              <span className="text-transparent bg-clip-text"
                    style={{ backgroundImage: 'linear-gradient(90deg, #fef3c7, #f0abfc)' }}>
                Lab Readiness Portal
              </span>
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/80 max-w-2xl">
              Track production lab health, upcoming workshops, and testing status — all in one place.
            </p>
            <div className="mt-3 text-xs text-white/60">{today}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 lg:justify-end">
          <HeroStat label="Total Labs" value={totalLabs.toString()} />
          <HeroStat label="Ready" value={`${readinessPct}%`} accent />
          <HeroStat
            label="Last Sync"
            value={lastUpdated ? lastUpdated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
          />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-xl backdrop-blur border ${
      accent ? 'bg-white/20 border-white/30' : 'bg-white/10 border-white/15'
    }`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-white/70">{label}</div>
      <div className="text-2xl font-bold text-white mt-0.5">{value}</div>
    </div>
  );
}
