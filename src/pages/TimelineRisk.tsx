import { useMemo } from 'react';
import { useLabs } from '../state/LabsContext';
import { useRole } from '../state/RoleContext';
import { daysToWorkshop } from '../lib/rules';
import type { Lab } from '../types';
import { Badge, PageHeader } from '../components/ui';
import LabEditor from '../components/LabEditor';
import { useState } from 'react';

interface RiskBucket {
  label: string;
  icon: string;
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
      { label: 'CRITICAL ALERT', icon: '🔴', color: 'bg-rose-50 border-rose-200', daysMin: 0, daysMax: 7, labs: critical },
      { label: 'MEDIUM RISK', icon: '🟡', color: 'bg-amber-50 border-amber-200', daysMin: 7, daysMax: 14, labs: medium },
      { label: 'SAFE', icon: '🟢', color: 'bg-emerald-50 border-emerald-200', daysMin: 14, daysMax: Infinity, labs: safe }
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-6 border-l-4 border-rose-500">
          <div className="text-4xl font-bold text-rose-600">{buckets[0].labs.length}</div>
          <div className="text-sm text-slate-600 mt-1">Workshop this week</div>
        </div>
        <div className="card p-6 border-l-4 border-amber-500">
          <div className="text-4xl font-bold text-amber-600">{buckets[1].labs.length}</div>
          <div className="text-sm text-slate-600 mt-1">Within 2 weeks</div>
        </div>
        <div className="card p-6 border-l-4 border-emerald-500">
          <div className="text-4xl font-bold text-emerald-600">{buckets[2].labs.length}</div>
          <div className="text-sm text-slate-600 mt-1">Safe / 14+ days</div>
        </div>
      </div>

      {/* Risk Buckets */}
      <div className="space-y-4">
        {buckets.map((bucket, idx) => (
          <div key={idx} className={`card border-2 ${bucket.color}`}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                {bucket.icon} {bucket.label} ({bucket.labs.length})
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
                        className="flex items-start justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 truncate">{lab.labName}</h4>
                          <p className="text-sm text-slate-600 mt-1">
                            <span className="font-medium">{lab.trackName}</span>
                            {' • '}
                            Workshop:{' '}
                            <span className="font-mono">
                              {new Date(lab.upcomingWorkshopDate!).toLocaleDateString()}
                            </span>
                            {' • '}
                            <span className={`font-semibold ${
                              dtw === 0 ? 'text-rose-600' : dtw && dtw <= 3 ? 'text-amber-600' : 'text-slate-600'
                            }`}>
                              {daysText}
                            </span>
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge>{lab.testStatus}</Badge>
                            {lab.priority && <Badge className="text-xs">{lab.priority}</Badge>}
                            {lab.assignedTo && (
                              <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                                👤 {lab.assignedTo}
                              </span>
                            )}
                            {lab.reviewer && (
                              <span className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-600">
                                ✓ {lab.reviewer}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditing(lab)}
                          className="shrink-0 ml-4 px-3 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition"
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
