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
import { useLabs } from '../state/LabsContext';
import { useRole } from '../state/RoleContext';
import { daysToWorkshop } from '../lib/rules';
import type { Lab } from '../types';
import { Badge, PageHeader } from '../components/ui';
import LabEditor from '../components/LabEditor';

type FilterDays = 7 | 15 | 30 | 365; // 365 = all
type FilterStatus = 'all' | 'action' | 'testing' | 'retesting';

interface LabRow extends Lab {
  daysUntil: number;
}

export default function UpcomingWorkshopsLabWise() {
  const { labs, updateLab } = useLabs();
  const { user, role } = useRole();
  
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
    if (daysUntil < 0) return { label: 'OVERDUE', bg: 'bg-slate-200 text-slate-700', color: 'text-slate-700' };
    if (daysUntil === 0) return { label: 'TODAY', bg: 'bg-rose-200 text-rose-900', color: 'text-rose-900' };
    if (daysUntil <= 3) return { label: '🔴 CRITICAL', bg: 'bg-rose-100 text-rose-900', color: 'text-rose-900' };
    if (daysUntil <= 7) return { label: '🟡 THIS WEEK', bg: 'bg-amber-100 text-amber-900', color: 'text-amber-900' };
    if (daysUntil <= 15) return { label: '🟠 2 WEEKS', bg: 'bg-orange-100 text-orange-900', color: 'text-orange-900' };
    if (daysUntil <= 30) return { label: '🟡 30 DAYS', bg: 'bg-yellow-100 text-yellow-900', color: 'text-yellow-900' };
    return { label: '🟢 SAFE', bg: 'bg-emerald-100 text-emerald-900', color: 'text-emerald-900' };
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                const assignee = prompt('Assign tester to selected labs:');
                if (assignee) handleBulkAssign('tester', assignee);
              }}
              className="btn-primary text-sm"
            >
              ➕ Assign Testers
            </button>
            <button
              onClick={() => {
                const assignee = prompt('Assign reviewer to selected labs:');
                if (assignee) handleBulkAssign('reviewer', assignee);
              }}
              className="btn-primary text-sm"
            >
              ✓ Assign Reviewers
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-slate-600">Total Labs</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-600">Ready (✓)</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.ready}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-600">Testing (⏳)</p>
          <p className="text-2xl font-bold text-sky-600">{stats.testing}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-600">Retest (✗)</p>
          <p className="text-2xl font-bold text-rose-600">{stats.failed}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-600">Critical (≤3d)</p>
          <p className="text-2xl font-bold text-rose-600">{stats.critical}</p>
        </div>
      </div>

      {/* Time-based Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="text-sm font-semibold text-slate-700 self-center">Filter by days:</div>
        {[7, 15, 30, 365].map(days => (
          <button
            key={days}
            onClick={() => setFilterDays(days as FilterDays)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filterDays === days
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {days === 365 ? 'All' : `${days}d`}
          </button>
        ))}
      </div>

      {/* Status-based Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'action', 'testing', 'retesting'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status as FilterStatus)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filterStatus === status
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {status === 'all' && 'All Labs'}
            {status === 'action' && '🔴 Action Needed'}
            {status === 'testing' && '🧪 Testing'}
            {status === 'retesting' && '🔁 Retesting'}
          </button>
        ))}
      </div>

      {/* Search Box */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Search lab by name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full input"
        />
      </div>

      {/* Lab Table View */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedLabs.size === sortedLabRows.length && sortedLabRows.length > 0}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedLabs(new Set(sortedLabRows.map(l => l.id)));
                    } else {
                      setSelectedLabs(new Set());
                    }
                  }}
                  className="w-5 h-5"
                />
              </th>
              <th className="p-3 text-left font-bold text-slate-900">Lab Name</th>
              <th className="p-3 text-left font-bold text-slate-900">Track</th>
              <th className="p-3 text-left font-bold text-slate-900">Status</th>
              <th className="p-3 text-left font-bold text-slate-900">Assigned Tester</th>
              <th className="p-3 text-left font-bold text-slate-900">Reviewer</th>
              <th className="p-3 text-center font-bold text-slate-900">Workshop Date</th>
              <th className="p-3 text-center font-bold text-slate-900">Days</th>
              <th className="p-3 text-left font-bold text-slate-900">Urgency</th>
              <th className="p-3 text-center font-bold text-slate-900">Actions</th>
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
                    className={`border-b border-slate-200 hover:bg-slate-50 transition ${
                      selectedLabs.has(lab.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedLabs.has(lab.id)}
                        onChange={e => {
                          const newSelected = new Set(selectedLabs);
                          if (e.target.checked) newSelected.add(lab.id);
                          else newSelected.delete(lab.id);
                          setSelectedLabs(newSelected);
                        }}
                        className="w-5 h-5"
                      />
                    </td>

                    {/* Lab Name */}
                    <td className="p-3">
                      <span className="font-semibold text-slate-900">{lab.labName}</span>
                    </td>

                    {/* Track */}
                    <td className="p-3 text-sm text-slate-600">{lab.trackName}</td>

                    {/* Status */}
                    <td className="p-3">
                      <Badge className={`text-xs ${
                        lab.testStatus === 'Passed' ? 'bg-emerald-200 text-emerald-900' :
                        lab.testStatus === 'Failed' ? 'bg-rose-200 text-rose-900' :
                        lab.testStatus === 'In Progress' ? 'bg-sky-200 text-sky-900' :
                        'bg-slate-200 text-slate-900'
                      }`}>
                        {lab.testStatus}
                      </Badge>
                    </td>

                    {/* Assigned Tester */}
                    <td className="p-3">
                      {lab.assignedTo ? (
                        <span className="text-sm bg-blue-100 px-2 py-1 rounded text-blue-700">
                          👤 {lab.assignedTo}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>

                    {/* Reviewer */}
                    <td className="p-3">
                      {lab.reviewer ? (
                        <span className="text-sm bg-purple-100 px-2 py-1 rounded text-purple-700">
                          ✓ {lab.reviewer}
                        </span>
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
                    <td className={`p-3 text-center font-bold text-lg ${
                      lab.daysUntil < 0 ? 'text-slate-700' :
                      lab.daysUntil <= 3 ? 'text-rose-600' :
                      lab.daysUntil <= 7 ? 'text-amber-600' :
                      lab.daysUntil <= 15 ? 'text-orange-600' :
                      lab.daysUntil <= 30 ? 'text-yellow-600' :
                      'text-emerald-600'
                    }`}>
                      {lab.daysUntil < 0 ? `${Math.abs(lab.daysUntil)}d ago` : `${lab.daysUntil}d`}
                    </td>

                    {/* Urgency Badge */}
                    <td className="p-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${urgency.bg}`}>
                        {urgency.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setEditing(lab)}
                        className="px-3 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 transition"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">{editing.labName}</h2>
              <button
                onClick={() => setEditing(null)}
                className="text-2xl text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <LabEditor lab={editing} onSave={() => setEditing(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
