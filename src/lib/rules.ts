import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import type { Lab, ReadinessStatus } from '../types';

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/** Days between test date and workshop date (workshop - test). */
export function daysGap(lab: Lab): number | null {
  const t = toDate(lab.testDate);
  const w = toDate(lab.upcomingWorkshopDate);
  if (!t || !w) return null;
  return differenceInCalendarDays(w, t);
}

/** Days remaining until workshop from today. */
export function daysToWorkshop(lab: Lab, now: Date = new Date()): number | null {
  const w = toDate(lab.upcomingWorkshopDate);
  if (!w) return null;
  return differenceInCalendarDays(w, now);
}

export function readinessStatus(lab: Lab): ReadinessStatus {
  if (lab.testStatus === 'Failed') return 'Action Required';
  if (!lab.testDate) return 'Testing Pending';
  const gap = daysGap(lab);
  if (gap === null) return 'Testing Pending';
  // gap <= 15 means test happened close enough to workshop
  if (Math.abs(gap) <= 15) return 'Ready';
  return 'Retest Required';
}

export function readinessColor(status: ReadinessStatus): string {
  switch (status) {
    case 'Ready':
      return 'bg-emerald-100 text-emerald-700';
    case 'Retest Required':
      return 'bg-amber-100 text-amber-700';
    case 'Testing Pending':
      return 'bg-sky-100 text-sky-700';
    case 'Action Required':
      return 'bg-rose-100 text-rose-700';
  }
}

export function testStatusColor(status: Lab['testStatus']): string {
  switch (status) {
    case 'Passed':
      return 'bg-emerald-100 text-emerald-700';
    case 'Failed':
      return 'bg-rose-100 text-rose-700';
    case 'In Progress':
      return 'bg-sky-100 text-sky-700';
    case 'Not Started':
      return 'bg-slate-100 text-slate-600';
  }
}

/** Identify at-risk labs per business rules. */
export function riskReasons(lab: Lab, now: Date = new Date()): string[] {
  const reasons: string[] = [];
  const dtw = daysToWorkshop(lab, now);
  if (dtw !== null && dtw >= 0 && dtw <= 7 && lab.testStatus !== 'Passed') {
    reasons.push('Workshop within 7 days without successful testing');
  }
  if (readinessStatus(lab) === 'Retest Required') {
    reasons.push('Retest required');
  }
  if (lab.testStatus === 'Failed') {
    reasons.push('Test failed');
  }
  if (!lab.assignedTo) {
    reasons.push('Missing ownership');
  }
  if (!lab.upcomingWorkshopDate) {
    reasons.push('Missing workshop date');
  }
  return reasons;
}

export function isAtRisk(lab: Lab, now: Date = new Date()): boolean {
  return riskReasons(lab, now).length > 0;
}
