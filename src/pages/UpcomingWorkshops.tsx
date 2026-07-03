import { useMemo, useState } from 'react';
import { useLabs } from '../state/LabsContext';
import { daysToWorkshop, readinessColor, readinessStatus, testStatusColor } from '../lib/rules';
import type { Lab } from '../types';
import { Badge, PageHeader } from '../components/ui';

type View = 'list' | 'calendar';
const BUCKETS: { label: string; days: number }[] = [
  { label: 'Next 7 Days', days: 7 },
  { label: 'Next 15 Days', days: 15 },
  { label: 'Next 30 Days', days: 30 }
];

export default function UpcomingWorkshops() {
  const { labs } = useLabs();
  const [view, setView] = useState<View>('list');
  const [range, setRange] = useState(30);
  const now = new Date();

  const upcoming = useMemo(() => {
    return labs
      .map(l => ({ lab: l, dtw: daysToWorkshop(l, now) }))
      .filter(({ dtw }) => dtw !== null && dtw >= 0 && dtw <= range)
      .sort((a, b) => (a.dtw! - b.dtw!));
  }, [labs, range]);

  return (
    <div>
      <PageHeader
        title="Upcoming Workshops"
        subtitle={`${upcoming.length} workshops within the next ${range} days`}
      >
        <div className="flex gap-2">
          {BUCKETS.map(b => (
            <button
              key={b.days}
              className={`btn ${range === b.days ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRange(b.days)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="ml-2 flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button className={`btn ${view === 'list' ? 'btn-primary' : 'text-slate-600'}`} onClick={() => setView('list')}>List</button>
          <button className={`btn ${view === 'calendar' ? 'btn-primary' : 'text-slate-600'}`} onClick={() => setView('calendar')}>Calendar</button>
        </div>
      </PageHeader>

      {view === 'list' ? <ListView items={upcoming} /> : <CalendarView items={upcoming} range={range} />}
    </div>
  );
}

function ListView({ items }: { items: { lab: Lab; dtw: number | null }[] }) {
  if (!items.length) {
    return <div className="card p-8 text-center text-slate-500">No upcoming workshops in this window.</div>;
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="th">Days</th>
            <th className="th">Workshop Date</th>
            <th className="th">Track / Lab</th>
            <th className="th">Language</th>
            <th className="th">Assigned To</th>
            <th className="th">Test Status</th>
            <th className="th">Readiness</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ lab, dtw }) => {
            const rs = readinessStatus(lab);
            return (
              <tr key={lab.id} className="border-t border-slate-100">
                <td className="td">
                  <span className={`badge ${dtw! <= 7 ? 'bg-rose-100 text-rose-700' : dtw! <= 15 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                    T-{dtw}d
                  </span>
                </td>
                <td className="td">{lab.upcomingWorkshopDate}</td>
                <td className="td">
                  <div className="font-medium text-slate-800">{lab.labName}</div>
                  <div className="text-xs text-slate-500">{lab.trackName}</div>
                </td>
                <td className="td">{lab.language}</td>
                <td className="td">{lab.assignedTo ?? <span className="text-rose-500">Unassigned</span>}</td>
                <td className="td"><Badge className={testStatusColor(lab.testStatus)}>{lab.testStatus}</Badge></td>
                <td className="td"><Badge className={readinessColor(rs)}>{rs}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView({ items, range }: { items: { lab: Lab; dtw: number | null }[]; range: number }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: range + 1 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const key = it.lab.upcomingWorkshopDate!;
    const arr = byDate.get(key) ?? [];
    arr.push(it);
    byDate.set(key, arr);
  }

  // Pad start so we render aligned Sun–Sat rows
  const firstDay = days[0];
  const padStart = firstDay.getDay();
  const leading = Array.from({ length: padStart }, () => null as null);
  const grid = [...leading, ...days];

  return (
    <div className="card p-4">
      <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-slate-500 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (!d) return <div key={`p-${i}`} className="h-24" />;
          const key = d.toISOString().split('T')[0];
          const events = byDate.get(key) ?? [];
          const isToday = key === new Date().toISOString().split('T')[0];
          return (
            <div key={key} className={`h-24 border border-slate-200 rounded-md p-1 overflow-hidden ${isToday ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="text-[10px] font-semibold text-slate-500">{d.getDate()}</div>
              <div className="space-y-1 mt-0.5">
                {events.slice(0, 3).map(({ lab }) => (
                  <div key={lab.id} className="text-[10px] px-1 py-0.5 rounded bg-brand-100 text-brand-900 truncate" title={`${lab.labName} · ${lab.language}`}>
                    {lab.labName}
                  </div>
                ))}
                {events.length > 3 && <div className="text-[10px] text-slate-500">+{events.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
