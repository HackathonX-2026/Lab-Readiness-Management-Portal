import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Lab, Priority, TestStatus } from '../types';
import { daysGap, readinessStatus } from './rules';

const HEADERS = [
  'Track Name',
  'Lab Name',
  'Language',
  'Upcoming Workshop Date',
  'Workshops - scheduled dates',
  'Assigned Date',
  'Assigned To',
  'Test Date',
  'Test Status',
  'Priority',
  'Reviewer',
  'Requestor',
  'Updated In Track Sheet',
  'Pending Item / Review Status',
  'Cost Estimation Link',
  'Remarks / Reviewer Feedbacks',
  'Release Note Status',
  'Release Note Link',
  'PPT Link',
  'PPT Status',
  'Comments',
  'Last Updated By',
  'Last Updated Date',
  'Days Gap',
  'Readiness Status'
];

function toRow(lab: Lab) {
  return {
    'Track Name': lab.trackName,
    'Lab Name': lab.labName,
    Language: lab.language,
    'Upcoming Workshop Date': lab.upcomingWorkshopDate ?? '',
    'Workshops - scheduled dates': lab.workshopsScheduledDates ?? '',
    'Assigned Date': lab.assignedDate ?? '',
    'Assigned To': lab.assignedTo ?? '',
    'Test Date': lab.testDate ?? '',
    'Test Status': lab.testStatus,
    Priority: lab.priority ?? '',
    Reviewer: lab.reviewer ?? '',
    Requestor: lab.requestor ?? '',
    'Updated In Track Sheet': lab.updatedInTrackSheet ?? '',
    'Pending Item / Review Status': lab.pendingItemReviewStatus ?? '',
    'Cost Estimation Link': lab.costEstimationLink ?? '',
    'Remarks / Reviewer Feedbacks': lab.remarks ?? '',
    'Release Note Status': lab.releaseNoteStatus ?? '',
    'Release Note Link': lab.releaseNoteLink ?? '',
    'PPT Link': lab.pptLink ?? '',
    'PPT Status': lab.pptStatus ?? '',
    Comments: lab.comments,
    'Last Updated By': lab.lastUpdatedBy,
    'Last Updated Date': lab.lastUpdatedDate,
    'Days Gap': daysGap(lab) ?? '',
    'Readiness Status': readinessStatus(lab)
  };
}

export function exportLabs(labs: Lab[], filename = 'lab-readiness.xlsx') {
  const ws = XLSX.utils.json_to_sheet(labs.map(toRow), { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Labs');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([out], { type: 'application/octet-stream' }), filename);
}

function isBlank(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === '' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a';
}
function str(v: unknown): string | null {
  return isBlank(v) ? null : String(v).trim();
}
function normalizeDate(v: unknown): string | null {
  if (isBlank(v)) return null;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return d.toISOString().split('T')[0];
  }
  const d = new Date(String(v).trim());
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}
function normalizeStatus(v: unknown): TestStatus {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return 'Not Started';
  if (s.includes('fail')) return 'Failed';
  if (s.includes('complet') || s.includes('good with the lab') || s.startsWith('tested')) return 'Passed';
  if (s.includes('progress') || s.includes('assign') || s.includes('review')) return 'In Progress';
  if (s.includes('pending')) return 'Not Started';
  return 'In Progress';
}
function normalizePriority(v: unknown): Priority {
  const s = String(v ?? '').trim().toUpperCase();
  const m = s.match(/P[0-4]/);
  return (m ? (m[0] as Priority) : null);
}
function deriveTrack(labName: string): string {
  const n = labName.toLowerCase();
  if (n.includes('fabric')) return 'Data & Analytics';
  if (n.includes('copilot')) return 'AI & Copilot';
  if (n.includes('ai agent') || n.includes('agents') || n.includes('openai') || n.includes('foundry') || n.includes('genai')) return 'AI & Copilot';
  if (n.includes('defender') || n.includes('sentinel') || n.includes('purview') || n.includes('security')) return 'Security & Compliance';
  if (n.includes('arc') || n.includes('hci') || n.includes('stack')) return 'Hybrid & Infrastructure';
  if (n.includes('sap')) return 'SAP on Azure';
  if (n.includes('.net') || n.includes('modernization') || n.includes('kubernetes') || n.includes('aks') || n.includes('devops')) return 'App Modernization & DevOps';
  if (n.includes('data') || n.includes('sql') || n.includes('synapse') || n.includes('warehouse')) return 'Data & Analytics';
  if (n.includes('power') || n.includes('automate') || n.includes('365')) return 'Power Platform & M365';
  if (n.includes('azure ai') || n.includes('cognitive') || n.includes('speech') || n.includes('vision')) return 'Azure AI Services';
  return 'Azure Fundamentals';
}

export async function importLabs(file: File): Promise<Lab[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const preferred = wb.SheetNames.find(n => n.toLowerCase().includes('upcoming-track-list'))
    ?? wb.SheetNames.find(n => n.toLowerCase().includes('track'))
    ?? wb.SheetNames[0];
  const ws = wb.Sheets[preferred];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const now = new Date().toISOString();

  const norm = (k: string) => k.trim().toLowerCase().replace(/\s+/g, ' ');

  return rows
    .map((r, i) => {
      const get = (aliases: string[]) => {
        for (const alias of aliases) {
          const target = norm(alias);
          const found = Object.keys(r).find(k => norm(k) === target || norm(k).startsWith(target));
          if (found && !isBlank(r[found])) return r[found];
        }
        return null;
      };
      const rawName = get(['Labs name', 'Lab Name', 'Lab']);
      const labName = isBlank(rawName) ? '' : String(rawName).replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
      if (!labName || labName.toLowerCase() === 'labs name') return null;
      return {
        id: `imp-${Date.now()}-${i}`,
        trackName: (str(get(['Track Name', 'Track'])) ?? deriveTrack(labName)),
        labName,
        language: (str(get(['Language'])) ?? 'English'),
        upcomingWorkshopDate: normalizeDate(get(['Upcoming Workshop Date', 'Workshop Date', 'Workshop'])),
        workshopsScheduledDates: str(get(['Workshops - scheduled dates', 'Scheduled dates'])),
        assignedDate: normalizeDate(get(['Assigned date', 'Assigned Date'])),
        assignedTo: str(get(['Assigned To', 'Assigned to', 'Owner'])),
        testDate: normalizeDate(get(['Test Date', 'Test date'])),
        testStatus: normalizeStatus(get(['Test Status', 'Status'])),
        priority: normalizePriority(get(['Priority'])),
        reviewer: str(get(['Reviewer'])),
        requestor: str(get(['Requestor/ Project/ Tenant', 'Requestor', 'Project', 'Tenant'])),
        updatedInTrackSheet: str(get(['Updated in Microsoft Track Sheet'])),
        pendingItemReviewStatus: str(get(['Pending item / Review Status', 'Pending item'])),
        costEstimationLink: str(get(['Cost estimation link', 'Cost Estimation Link'])),
        remarks: str(get(['Remarks/ Reviewer feedbacks', 'Remarks'])),
        releaseNoteStatus: str(get(['Release note status', 'Release Note Status'])),
        releaseNoteLink: str(get(['Release note link', 'Release Note Link'])),
        pptLink: str(get(['PPT Link'])),
        pptStatus: str(get(['PPT Status'])),
        comments: [str(get(['Remarks/ Reviewer feedbacks', 'Comments', 'Notes'])), str(get(['Pending item / Review Status']))]
          .filter(Boolean).join(' | '),
        lastUpdatedBy: (str(get(['Updated by', 'Last Updated By'])) ?? 'import'),
        lastUpdatedDate: normalizeDate(get(['Last Updated Date'])) ?? now
      } as Lab;
    })
    .filter((x): x is Lab => x !== null);
}
