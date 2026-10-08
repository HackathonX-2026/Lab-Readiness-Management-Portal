/**
 * UPCOMING WORKSHOPS
 * 
 * Shows all labs in a table format
 * Sorted by workshop date (closest/soonest first)
 * Includes time-based filters: 7 days, 15 days, 30 days
 * 
 * DESIGN:
 * 1. Date-aware: See what's due soonest at the top
 * 2. Lab-centric: Quick glance at lab status and assignments
 * 3. Timeline filters: Focus on urgent labs (7d, 15d, 30d windows)
 * 4. Batch operations: Assign multiple testers/reviewers instantly
 * 5. Searchable: Find any lab by name in seconds
 */

import { useState, useMemo } from 'react';
import { CalendarDays, CircleCheck, Clock3, RefreshCw, Search, TriangleAlert, UserCheck, UserPlus } from 'lucide-react';
import { useLabs } from '../state/LabsContext';
import { useRole } from '../state/RoleContext';
import { daysToWorkshop, testStatusColor } from '../lib/rules';
import type { Lab } from '../types';
import { Badge, PageHeader, StatCard } from '../components/ui';
import LabEditor from '../components/LabEditor';

type FilterDays = 7 | 15 | 30 | 365; // 365 = all
type FilterStatus = 'all' | 'action' | 'testing' | 'retesting';

interface LabRow extends Lab {
  daysUntil: number;
}

export default function UpcomingWorkshopsLabWise() {
  const { labs, updateLab } = useLabs();
  const { user } = useRole();
  
  const [filterDays, setFilterDays] = useState<FilterDays>(365); // Show all by default
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [editing, setEditing] = useState<Lab | null>(null);
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const now = new Date();

  // Sort labs by workshop date (closest/soonest first), then by lab name
  const sortedLabRows = useMemo<LabRow[]>(() => {
    return labs
      .filter(lab => {
        if (!lab.upcomingWorkshopDate) return false;
        const days = daysToWorkshop(lab, now) ?? 999;
        
        // Apply time filter (7, 15, 30 days or all)
        if (filterDays !== 365 && days > filterDays) return false;
        
        // Apply status filter
        if (filterStatus === 'action' && (days > 7 || lab.testStatus === 'Passed')) return false;
        if (filterStatus === 'testing' && lab.testStatus !== 'In Progress') return false;
        if (filterStatus === 'retesting' && lab.testStatus !== 'Failed') return false;
        
        // Apply search filter
        if (searchTerm && !lab.labName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        return true;
      })
      .map(lab => ({
        ...lab,
        daysUntil: daysToWorkshop(lab, now) ?? 999,
      }))
      .sort((a, b) => {
        // Upcoming (positive days) first, then past (negative days)
        const aIsUpcoming = a.daysUntil > 0;
        const bIsUpcoming = b.daysUntil > 0;
        
        // If one is upcoming and one is past, upcoming comes first
        if (aIsUpcoming !== bIsUpcoming) {
          return bIsUpcoming ? 1 : -1;
        }
        
        // Within upcoming: sort by days ascending (soonest first: 1d, 2d, 3d...)
        // Within past: sort by days descending (most recent first: 1d ago, 2d ago...)
        if (aIsUpcoming) {
          if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
        } else {
          if (a.daysUntil !== b.daysUntil) return b.daysUntil - a.daysUntil;
        }
        
        // Secondary: by lab name (alphabetically)
        return (a.labName || '').localeCompare(b.labName || '');
      });
  }, [labs, filterDays, filterStatus, searchTerm]);

  const handleBulkAssign = (type: 'tester' | 'reviewer', assignee: string) => {
    Array.from(selectedLabs).forEach(labId => {
      const lab = labs.find(l => l.id === labId);
      if (lab) {
        updateLab(
          lab.id,
          type === 'tester' ? { assignedTo: assignee } : { reviewer: assignee },
          user
        );
      }
    });
    setSelectedLabs(new Set());
    // Show success toast
  };

  const getUrgencyBadge = (daysUntil: number) => {
    if (daysUntil < 0) return { label: 'Overdue', bg: 'status-neutral', color: 'text-muted' };
    if (daysUntil === 0) return { label: 'Today', bg: 'status-bad', color: 'text-danger' };
    if (daysUntil <= 3) return { label: 'Critical', bg: 'status-bad', color: 'text-danger' };
    if (daysUntil <= 7) return { label: 'This week', bg: 'status-warn', color: 'text-warning' };
    if (daysUntil <= 15) return { label: '2 weeks', bg: 'status-warn', color: 'text-warning' };
    if (daysUntil <= 30) return { label: '30 days', bg: 'status-warn', color: 'text-warning' };
    return { label: 'Safe', bg: 'status-good', color: 'text-success' };
  };

  const stats = {
    total: sortedLabRows.length,
    ready: sortedLabRows.filter(l => l.testStatus === 'Passed').length,
    testing: sortedLabRows.filter(l => l.testStatus === 'In Progress').length,
    failed: sortedLabRows.filter(l => l.testStatus === 'Failed').length,
    critical: sortedLabRows.filter(l => l.daysUntil <= 3).length,
  };

  return (
    <div>
      <PageHeader
        title="Upcoming Workshops"
        subtitle={`${stats.total} labs · ${selectedLabs.size} selected`}
      >
        {selectedLabs.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const assignee = prompt('Assign tester to selected labs:');
                if (assignee) handleBulkAssign('tester', assignee);
              }}
              className="btn-primary text-sm"
            >
              <UserPlus size={15} aria-hidden="true" /> Assign Testers
            </button>
            <button
              onClick={() => {
                const assignee = prompt('Assign reviewer to selected labs:');
                if (assignee) handleBulkAssign('reviewer', assignee);
              }}
              className="btn-primary text-sm"
            >
              <UserCheck size={15} aria-hidden="true" /> Assign Reviewers
            </button>
            <button
              onClick={() => setSelectedLabs(new Set())}
              className="btn-secondary text-sm"
            >
              Clear ({selectedLabs.size})
            </button>
          </div>
        )}
      </PageHeader>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Labs" value={stats.total} icon={<CalendarDays />} />
        <StatCard label="Ready" value={stats.ready} icon={<CircleCheck />} tone="good" />
        <StatCard label="Testing" value={stats.testing} icon={<Clock3 />} tone="info" />
        <StatCard label="Retest" value={stats.failed} icon={<RefreshCw />} tone="warn" />
        <StatCard label="Critical (≤3d)" value={stats.critical} icon={<TriangleAlert />} tone="bad" />
      </div>

      <div className="card mb-5 p-4">
      {/* Time-based Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-2 text-xs font-medium text-muted">Filter by days:</div>
        {[7, 15, 30, 365].map(days => (
          <button
            key={days}
            onClick={() => setFilterDays(days as FilterDays)}
            className="filter-button"
            aria-pressed={filterDays === days}
          >
            {days === 365 ? 'All' : `${days}d`}
          </button>
        ))}
      </div>

      {/* Status-based Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'action', 'testing', 'retesting'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status as FilterStatus)}
            className="filter-button"
            aria-pressed={filterStatus === status}
          >
            {status === 'all' && 'All Labs'}
            {status === 'action' && <><TriangleAlert size={14} aria-hidden="true" /> Action Needed</>}
            {status === 'testing' && <><Clock3 size={14} aria-hidden="true" /> Testing</>}
            {status === 'retesting' && <><RefreshCw size={14} aria-hidden="true" /> Retesting</>}
          </button>
        ))}
      </div>

      {/* Search Box */}
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-3 text-subtle" aria-hidden="true" />
        <input
          type="text"
          aria-label="Search labs by name"
          placeholder="Search lab by name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input pl-9"
        />
      </div>
      </div>

      {/* Lab Table View */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="th">
                <input
                  type="checkbox"
                  aria-label="Select all workshops"
                  checked={selectedLabs.size === sortedLabRows.length && sortedLabRows.length > 0}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedLabs(new Set(sortedLabRows.map(l => l.id)));
                    } else {
                      setSelectedLabs(new Set());
                    }
                  }}
                  className="h-4 w-4"
                />
              </th>
              <th className="th">Lab Name</th>
              <th className="th">Track</th>
              <th className="th">Status</th>
              <th className="th">Assigned Tester</th>
              <th className="th">Reviewer</th>
              <th className="th text-center">Workshop Date</th>
              <th className="th text-center">Days</th>
              <th className="th">Urgency</th>
              <th className="th text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedLabRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-600">
                  No labs found matching your filters.
                </td>
              </tr>
            ) : (
              sortedLabRows.map(lab => {
                const urgency = getUrgencyBadge(lab.daysUntil);
                return (
                  <tr
                    key={lab.id}
                    className={`border-b border-border transition-colors hover:bg-surface ${
                      selectedLabs.has(lab.id) ? 'bg-primary-soft' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${lab.labName}`}
                        checked={selectedLabs.has(lab.id)}
                        onChange={e => {
                          const newSelected = new Set(selectedLabs);
                          if (e.target.checked) newSelected.add(lab.id);
                          else newSelected.delete(lab.id);
                          setSelectedLabs(newSelected);
                        }}
                        className="h-4 w-4"
                      />
                    </td>

                    {/* Lab Name */}
                    <td className="p-3">
                      <span className="text-sm font-medium text-foreground">{lab.labName}</span>
                    </td>

                    {/* Track */}
                    <td className="p-3 text-sm text-slate-600">{lab.trackName}</td>

                    {/* Status */}
                    <td className="p-3">
                      <Badge className={testStatusColor(lab.testStatus)}>
                        {lab.testStatus}
                      </Badge>
                    </td>

                    {/* Assigned Tester */}
                    <td className="p-3">
                      {lab.assignedTo ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted"><UserPlus size={13} className="shrink-0 text-subtle" aria-hidden="true" /> {lab.assignedTo}</span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>

                    {/* Reviewer */}
                    <td className="p-3">
                      {lab.reviewer ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted"><UserCheck size={13} className="shrink-0 text-accent" aria-hidden="true" /> {lab.reviewer}</span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>

                    {/* Workshop Date */}
                    <td className="p-3 text-center text-sm text-slate-700 font-medium">
                      {new Date(lab.upcomingWorkshopDate!).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Days Until */}
                    <td className={`whitespace-nowrap p-3 text-center text-sm font-medium tabular-nums ${urgency.color}`}>
                      {lab.daysUntil < 0 ? `${Math.abs(lab.daysUntil)}d ago` : `${lab.daysUntil}d`}
                    </td>

                    {/* Urgency Badge */}
                    <td className="p-3">
                      <Badge className={urgency.bg}>{urgency.label}</Badge>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setEditing(lab)}
                        className="btn-secondary px-3 py-1 text-xs"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lab Editor Modal */}
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
