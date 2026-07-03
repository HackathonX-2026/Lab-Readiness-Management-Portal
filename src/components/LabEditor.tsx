import { useState, type FormEvent } from 'react';
import type { Lab, Priority, TestStatus } from '../types';

export default function LabEditor({
  lab, onSave, onClose, readOnly = false
}: {
  lab: Lab | null;
  onSave: (patch: Partial<Lab>) => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [form, setForm] = useState<Partial<Lab>>({
    trackName: lab?.trackName ?? '',
    labName: lab?.labName ?? '',
    language: lab?.language ?? 'English',
    upcomingWorkshopDate: lab?.upcomingWorkshopDate ?? '',
    workshopsScheduledDates: lab?.workshopsScheduledDates ?? '',
    assignedDate: lab?.assignedDate ?? '',
    assignedTo: lab?.assignedTo ?? '',
    testDate: lab?.testDate ?? '',
    testStatus: lab?.testStatus ?? 'Not Started',
    priority: lab?.priority ?? null,
    reviewer: lab?.reviewer ?? '',
    requestor: lab?.requestor ?? '',
    updatedInTrackSheet: lab?.updatedInTrackSheet ?? '',
    pendingItemReviewStatus: lab?.pendingItemReviewStatus ?? '',
    costEstimationLink: lab?.costEstimationLink ?? '',
    remarks: lab?.remarks ?? '',
    releaseNoteStatus: lab?.releaseNoteStatus ?? '',
    releaseNoteLink: lab?.releaseNoteLink ?? '',
    pptLink: lab?.pptLink ?? '',
    pptStatus: lab?.pptStatus ?? '',
    comments: lab?.comments ?? ''
  });

  const set = <K extends keyof Lab>(k: K, v: Lab[K] | string) =>
    setForm(f => ({ ...f, [k]: v === '' ? (k === 'comments' ? '' : null) : v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.trackName || !form.labName) { alert('Track and Lab Name are required.'); return; }
    onSave({
      trackName: (form.trackName as string).trim(),
      labName: (form.labName as string).trim(),
      language: (form.language as string) || 'English',
      upcomingWorkshopDate: (form.upcomingWorkshopDate as string) || null,
      workshopsScheduledDates: (form.workshopsScheduledDates as string)?.trim() || null,
      assignedDate: (form.assignedDate as string) || null,
      assignedTo: (form.assignedTo as string)?.trim() || null,
      testDate: (form.testDate as string) || null,
      testStatus: (form.testStatus as TestStatus) || 'Not Started',
      priority: (form.priority as Priority) ?? null,
      reviewer: (form.reviewer as string)?.trim() || null,
      requestor: (form.requestor as string)?.trim() || null,
      updatedInTrackSheet: (form.updatedInTrackSheet as string)?.trim() || null,
      pendingItemReviewStatus: (form.pendingItemReviewStatus as string)?.trim() || null,
      costEstimationLink: (form.costEstimationLink as string)?.trim() || null,
      remarks: (form.remarks as string)?.trim() || null,
      releaseNoteStatus: (form.releaseNoteStatus as string)?.trim() || null,
      releaseNoteLink: (form.releaseNoteLink as string)?.trim() || null,
      pptLink: (form.pptLink as string)?.trim() || null,
      pptStatus: (form.pptStatus as string)?.trim() || null,
      comments: (form.comments as string) ?? ''
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="card w-full max-w-3xl p-6 max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{lab ? (readOnly ? 'View Lab' : 'Edit Lab') : 'Add Lab'}</h2>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Track Name *">
            <input className="input" required disabled={readOnly}
              value={form.trackName as string} onChange={e => set('trackName', e.target.value)} />
          </Field>
          <Field label="Lab Name *">
            <input className="input" required disabled={readOnly}
              value={form.labName as string} onChange={e => set('labName', e.target.value)} />
          </Field>
          <Field label="Language">
            <input className="input" disabled={readOnly}
              value={form.language as string} onChange={e => set('language', e.target.value)} />
          </Field>
          <Field label="Assigned To">
            <input className="input" disabled={readOnly} placeholder="Tester name"
              value={(form.assignedTo as string) ?? ''} onChange={e => set('assignedTo', e.target.value)} />
          </Field>
          <Field label="Test Date">
            <input type="date" className="input" disabled={readOnly}
              value={(form.testDate as string) ?? ''} onChange={e => set('testDate', e.target.value)} />
          </Field>
          <Field label="Upcoming Workshop Date">
            <input type="date" className="input" disabled={readOnly}
              value={(form.upcomingWorkshopDate as string) ?? ''} onChange={e => set('upcomingWorkshopDate', e.target.value)} />
          </Field>
          <Field label="Test Status">
            <select className="input" disabled={readOnly}
              value={form.testStatus as string} onChange={e => set('testStatus', e.target.value as TestStatus)}>
              <option>Passed</option><option>Failed</option><option>In Progress</option><option>Not Started</option>
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" disabled={readOnly}
              value={(form.priority as string) ?? ''} onChange={e => setForm(f => ({ ...f, priority: (e.target.value || null) as Priority }))}>
              <option value="">—</option>
              <option>P0</option><option>P1</option><option>P2</option><option>P3</option><option>P4</option>
            </select>
          </Field>
          <Field label="Reviewer">
            <input className="input" disabled={readOnly}
              value={(form.reviewer as string) ?? ''} onChange={e => set('reviewer', e.target.value)} />
          </Field>
          <Field label="Requestor / Project / Tenant">
            <input className="input" disabled={readOnly}
              value={(form.requestor as string) ?? ''} onChange={e => set('requestor', e.target.value)} />
          </Field>
          <Field label="Assigned Date">
            <input type="date" className="input" disabled={readOnly}
              value={(form.assignedDate as string) ?? ''} onChange={e => set('assignedDate', e.target.value)} />
          </Field>
          <Field label="Workshops - scheduled dates">
            <input className="input" disabled={readOnly} placeholder="e.g. 27,28-May"
              value={(form.workshopsScheduledDates as string) ?? ''} onChange={e => set('workshopsScheduledDates', e.target.value)} />
          </Field>
          <Field label="Updated in Microsoft Track Sheet">
            <input className="input" disabled={readOnly}
              value={(form.updatedInTrackSheet as string) ?? ''} onChange={e => set('updatedInTrackSheet', e.target.value)} />
          </Field>
          <Field label="Pending item / Review Status">
            <input className="input" disabled={readOnly}
              value={(form.pendingItemReviewStatus as string) ?? ''} onChange={e => set('pendingItemReviewStatus', e.target.value)} />
          </Field>
          <Field label="Cost Estimation Link" full>
            <LinkField value={form.costEstimationLink as string} readOnly={readOnly}
              onChange={v => set('costEstimationLink', v)} placeholder="URL or file name" />
          </Field>
          <Field label="Release Note Status">
            <input className="input" disabled={readOnly}
              value={(form.releaseNoteStatus as string) ?? ''} onChange={e => set('releaseNoteStatus', e.target.value)} />
          </Field>
          <Field label="PPT Status">
            <input className="input" disabled={readOnly}
              value={(form.pptStatus as string) ?? ''} onChange={e => set('pptStatus', e.target.value)} />
          </Field>
          <Field label="Release Note Link" full>
            <LinkField value={form.releaseNoteLink as string} readOnly={readOnly}
              onChange={v => set('releaseNoteLink', v)} placeholder="URL or PR reference" />
          </Field>
          <Field label="PPT Link" full>
            <LinkField value={form.pptLink as string} readOnly={readOnly}
              onChange={v => set('pptLink', v)} placeholder="URL or file name" />
          </Field>
          <Field label="Remarks / Reviewer Feedbacks" full>
            <textarea className="input min-h-[60px]" disabled={readOnly}
              value={(form.remarks as string) ?? ''} onChange={e => set('remarks', e.target.value)} />
          </Field>
          <Field label="Comments" full>
            <textarea className="input min-h-[60px]" disabled={readOnly}
              value={form.comments as string} onChange={e => set('comments', e.target.value)} />
          </Field>
        </div>

        {lab && (
          <div className="mt-3 text-xs text-slate-500">
            Last updated by <b>{lab.lastUpdatedBy}</b> on {new Date(lab.lastUpdatedDate).toLocaleString()}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          {!readOnly && <button type="submit" className="btn-primary">Save</button>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`text-sm ${full ? 'col-span-2' : ''}`}>
      <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function LinkField({ value, onChange, readOnly, placeholder }: {
  value: string | undefined;
  onChange: (v: string) => void;
  readOnly: boolean;
  placeholder?: string;
}) {
  const v = value ?? '';
  const isUrl = /^https?:\/\//i.test(v);
  return (
    <div className="flex gap-2">
      <input
        className="input flex-1"
        disabled={readOnly}
        value={v}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {isUrl && (
        <a
          href={v}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary shrink-0"
          title="Open link"
        >
          ↗ Open
        </a>
      )}
    </div>
  );
}
