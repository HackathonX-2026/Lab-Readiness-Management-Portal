import { useMemo } from 'react';
import { CalendarClock, CircleCheck, TriangleAlert, User, UserCheck, type LucideIcon } from 'lucide-react';
import { useLabs } from '../state/LabsContext';
import { useRole } from '../state/RoleContext';
import { daysToWorkshop, testStatusColor } from '../lib/rules';
import type { Lab } from '../types';
import { Badge, PageHeader, StatCard } from '../components/ui';
import LabEditor from '../components/LabEditor';
import { useState } from 'react';

interface RiskBucket {
  label: string;
  icon: LucideIcon;
  color: string;
  daysMin: number;
  daysMax: number;
  labs: Lab[];
}

export default function TimelineRisk() {
  const { labs, updateLab } = useLabs();
  const { user } = useRole();
  const [editing, setEditing] = useState<Lab | null>(null);

  const buckets: RiskBucket[] = useMemo(() => {
    const now = new Date();
    
    const critical = labs.filter(lab => {
      const dtw = daysToWorkshop(lab, now);
      return dtw !== null && dtw >= 0 && dtw < 7 && lab.testStatus !== 'Passed';
    });

    const medium = labs.filter(lab => {
      const dtw = daysToWorkshop(lab, now);
      return dtw !== null && dtw >= 7 && dtw <= 14 && lab.testStatus !== 'Passed';
    });

    const safe = labs.filter(lab => {
      const dtw = daysToWorkshop(lab, now);
      return dtw !== null && dtw > 14;
    });

    return [
      { label: 'Critical alert', icon: TriangleAlert, color: 'text-danger', daysMin: 0, daysMax: 7, labs: critical },
      { label: 'Medium risk', icon: CalendarClock, color: 'text-warning', daysMin: 7, daysMax: 14, labs: medium },
      { label: 'Safe', icon: CircleCheck, color: 'text-success', daysMin: 14, daysMax: Infinity, labs: safe }
    ];
  }, [labs]);

  const totalAtRisk = buckets[0].labs.length + buckets[1].labs.length;

  return (
    <div>
      <PageHeader
        title="Timeline Risk Dashboard"
        subtitle={`${totalAtRisk} labs at risk of missing workshop dates`}
      />

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Workshop this week" value={buckets[0].labs.length} icon={<TriangleAlert />} tone="bad" />
        <StatCard label="Within 2 weeks" value={buckets[1].labs.length} icon={<CalendarClock />} tone="warn" />
        <StatCard label="Safe / 14+ days" value={buckets[2].labs.length} icon={<CircleCheck />} tone="good" />
      </div>

      {/* Risk Buckets */}
      <div className="space-y-4">
        {buckets.map((bucket, idx) => (
          <div key={idx} className="card">
            <div className="p-5">
              <h3 className={`mb-4 flex items-center gap-2 text-sm font-medium ${bucket.color}`}>
                <bucket.icon size={16} aria-hidden="true" /> {bucket.label}
                <span className="badge ml-auto">{bucket.labs.length}</span>
              </h3>

              {bucket.labs.length === 0 ? (
                <p className="text-slate-500 text-sm">No labs in this category</p>
              ) : (
                <div className="space-y-3">
                  {bucket.labs.map(lab => {
                    const dtw = daysToWorkshop(lab, new Date());
                    const daysText = dtw === 0 ? 'TODAY' : dtw === 1 ? 'Tomorrow' : `${dtw} days`;
                    
                    return (
                      <div
                        key={lab.id}
                        className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-surface/50 p-4 transition-colors hover:border-ring sm:flex-row"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-foreground">{lab.labName}</h4>
                          <p className="text-sm text-slate-600 mt-1">
                            <span className="font-medium">{lab.trackName}</span>
                            {' • '}
                            Workshop:{' '}
                            <span className="font-mono">
                              {new Date(lab.upcomingWorkshopDate!).toLocaleDateString()}
                            </span>
                            {' • '}
                            <span className={`font-semibold ${
                              dtw === 0 ? 'text-danger' : dtw && dtw <= 3 ? 'text-warning' : 'text-muted'
                            }`}>
                              {daysText}
                            </span>
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge className={testStatusColor(lab.testStatus)}>{lab.testStatus}</Badge>
                            {lab.priority && <Badge className="text-xs">{lab.priority}</Badge>}
                            {lab.assignedTo && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                                <User size={12} aria-hidden="true" /> {lab.assignedTo}
                              </span>
                            )}
                            {lab.reviewer && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-accent">
                                <UserCheck size={12} aria-hidden="true" /> {lab.reviewer}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditing(lab)}
                          className="btn-secondary"
                        >
                          View / Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <LabEditor
          lab={editing}
          onClose={() => setEditing(null)}
          onSave={patch => {
            updateLab(editing.id, patch, user);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
