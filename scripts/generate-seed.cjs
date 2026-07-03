const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('Upcoming-Workshops-Tracker.xlsx', { cellDates: true });
const sheet = wb.Sheets['Upcoming-track-list'];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

const PRIORITY_KEY = Object.keys(rows[0] || {}).find(k => k.startsWith('Priority'));
const UPDATED_TRACK_KEY = Object.keys(rows[0] || {}).find(k => k.startsWith('Updated in Microsoft Track Sheet'));

function isBlank(v) {
  if (v == null) return true;
  const s = String(v).trim();
  return s === '' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a';
}
function s(v) { return isBlank(v) ? null : String(v).trim(); }
function toDate(v) {
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
function mapStatus(v) {
  const str = String(v ?? '').trim().toLowerCase();
  if (!str) return 'Not Started';
  if (str.includes('fail')) return 'Failed';
  if (str.includes('complet') || str.includes('good with the lab') || str.startsWith('tested')) return 'Passed';
  if (str.includes('progress') || str.includes('assign') || str.includes('review')) return 'In Progress';
  if (str.includes('pending')) return 'Not Started';
  return 'In Progress';
}
function mapPriority(v) {
  const str = String(v ?? '').trim().toUpperCase();
  const m = str.match(/P[0-4]/);
  return m ? m[0] : null;
}
function deriveTrack(labName) {
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

const nowIso = new Date().toISOString();
const labs = [];
let idx = 0;
for (const r of rows) {
  const rawName = r['Labs name'];
  if (isBlank(rawName)) continue;
  const labName = String(rawName).replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
  if (labName.toLowerCase() === 'labs name') continue;

  labs.push({
    id: `sheet-${++idx}`,
    trackName: deriveTrack(labName),
    labName,
    language: (s(r['Language']) ?? 'English').trim(),
    upcomingWorkshopDate: toDate(r['Upcoming Workshop Date']),
    workshopsScheduledDates: s(r['Workshops - scheduled dates']),
    assignedDate: toDate(r['Assigned date']),
    assignedTo: s(r['Assigned to']),
    testDate: toDate(r['Test date']),
    testStatus: mapStatus(r['Test Status']),
    priority: PRIORITY_KEY ? mapPriority(r[PRIORITY_KEY]) : null,
    reviewer: s(r['Reviewer']),
    requestor: s(r['Requestor/ Project/ Tenant']),
    updatedInTrackSheet: UPDATED_TRACK_KEY ? s(r[UPDATED_TRACK_KEY]) : null,
    pendingItemReviewStatus: s(r['Pending item / Review Status']),
    costEstimationLink: s(r['Cost estimation link']),
    remarks: s(r['Remarks/ Reviewer feedbacks']),
    releaseNoteStatus: s(r['Release note status']),
    releaseNoteLink: s(r['Release note link ']) ?? s(r['Release note link']),
    pptLink: s(r['PPT Link']),
    pptStatus: s(r['PPT Status']),
    comments: [s(r['Remarks/ Reviewer feedbacks']), s(r['Pending item / Review Status'])]
      .filter(Boolean).join(' | '),
    lastUpdatedBy: s(r['Updated by ']) ?? s(r['Updated by']) ?? 'import',
    lastUpdatedDate: nowIso
  });
}

const out = `// AUTO-GENERATED from Upcoming-Workshops-Tracker.xlsx (sheet: Upcoming-track-list)
// Run scripts/generate-seed.cjs to regenerate.
import type { Lab } from '../types';

export const SHEET_LABS: Lab[] = ${JSON.stringify(labs, null, 2)};
`;
fs.mkdirSync('src/lib', { recursive: true });
fs.writeFileSync('src/lib/seedData.ts', out);
console.log(`Wrote ${labs.length} labs to src/lib/seedData.ts`);
