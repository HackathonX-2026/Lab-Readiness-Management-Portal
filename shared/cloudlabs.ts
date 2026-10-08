// Shared, credential-free contracts and audit semantics. Native TypeScript is
// supported by the Node 24 backend; Vite uses the same logic in the browser.
export type CloudLabsErrorCode = 'not_configured' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'unavailable' | 'invalid_response';
export const CLOUDLABS_ERRORS: Record<CloudLabsErrorCode, string> = {
  not_configured: 'Configure the CloudLabs admin token and partner context on the server before refreshing.',
  unauthorized: 'CloudLabs rejected the token. Reconnect the server-side CloudLabs credentials.',
  forbidden: 'CloudLabs denied access. Check the token’s partner and audit permissions.',
  rate_limited: 'CloudLabs rate-limited this request. Try again later.',
  unavailable: 'CloudLabs could not be reached or timed out. Stored history is unchanged.',
  invalid_response: 'CloudLabs returned an unrecognized or incomplete response. No result was inferred.'
};

export interface CloudLabsConnection {
  configured: boolean;
  tokenSaved: boolean;
  contextConfigured: boolean;
  temporary: boolean;
  partner: string | null;
  expiresAt: string | null;
  expired: boolean;
  expiresSoon: boolean;
  checkedAt: string;
  storage: 'server_environment';
  automaticRenewal: 'not_enabled';
}

export interface CatalogLab {
  templateId: string;
  name: string;
  owner: string | null;
  cloudPlatform: string | null;
  masterDocUrl: string | null;
  active: boolean;
}
export interface CatalogDelivery {
  eventId: string | null;
  odlId: string | null;
  date: string;
  seats: number;
  customer: string | null;
  trackTitle: string | null;
  status: string;
  daysUntil: number;
}
export interface CatalogSnapshot {
  capturedAt: string;
  partner: string | null;
  labs: CatalogLab[];
  deliveries: CatalogDelivery[];
}
export type AuditCompletion = 'completed' | 'in_progress' | 'not_recorded' | 'unknown';
export type AuditValidation = 'passed' | 'failed' | 'unknown';
export type AuditReview = 'signed_off' | 'pending' | 'unknown';
export type AuditFreshness = 'recent' | 'retest_suggested' | 'current' | 'aging' | 'stale' | 'unknown';
export const AUDIT_POLICY = {
  recentDays: 15, nudgeDays: 45, agingDays: 60, staleDays: 90,
  cacheHours: 24, refreshCooldownSeconds: 60, batchSize: 5
} as const;
export interface CloudLabsAuditEvent {
  id: string | null;
  type: string;
  at: string | null;
  actor: string | null;
  statusId: number | null;
  validation: AuditValidation;
  ownerReviewed: boolean | null;
}
export interface CloudLabsAuditRecord {
  version: 1;
  templateId: string;
  attemptedAt: string;
  fetchedAt: string | null;
  errorCode: CloudLabsErrorCode | null;
  events: CloudLabsAuditEvent[];
}
export interface AuditSummary {
  availability: 'current' | 'not_checked' | 'sync_failed' | 'stale' | 'invalid';
  completion: AuditCompletion;
  validation: AuditValidation;
  review: AuditReview;
  freshness: AuditFreshness;
  daysSinceTest: number | null;
  lastTestAt: string | null;
  lastTestBy: string | null;
  fetchedAt: string | null;
  attemptedAt: string | null;
  testCount: number;
  checksMet: boolean;
  message: string;
}
export interface AuditOverview { templateId: string; summary: AuditSummary; }

export const AUDIT_LABELS = {
  completion: { completed: 'Completed', in_progress: 'In progress', not_recorded: 'No test audit', unknown: 'Unknown' },
  validation: { passed: 'Passed', failed: 'Failed', unknown: 'Not confirmed' },
  review: { signed_off: 'Signed off', pending: 'Pending', unknown: 'Not confirmed' },
  freshness: { recent: 'Recent', retest_suggested: 'Retest suggested', current: 'Current', aging: 'Aging', stale: 'Needs retest', unknown: 'Unknown' }
} as const;

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max = 160): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  return result && result.length <= max && !/[\u0000-\u001f\u007f]/.test(result) ? result : null;
}

export function validTemplateId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(value);
}
export function parseAuditTemplateIds(body: unknown): string[] | null {
  const ids = object(body)?.templateIds;
  return Array.isArray(ids) && ids.length > 0 && ids.length <= AUDIT_POLICY.batchSize && ids.every(validTemplateId)
    ? [...new Set(ids)] : null;
}

export function auditTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return null;
  const day = value.slice(0, 10);
  const dayDate = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== day) return null;
  const normalized = value.length === 10 ? `${value}T00:00:00Z`
    : /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function auditValidation(value: unknown): AuditValidation {
  const key = typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s_-]/g, '') : '';
  if (['validationfailed', 'failed', 'failure'].includes(key)) return 'failed';
  if (['validationpassed', 'validationsucceeded', 'validationsuccess', 'passed', 'succeeded', 'success'].includes(key)) return 'passed';
  return 'unknown';
}
function reviewFlag(value: unknown): boolean | null {
  if (value === true || (typeof value === 'string' && value.toLowerCase().trim() === 'true')) return true;
  if (value === false || (typeof value === 'string' && value.toLowerCase().trim() === 'false')) return false;
  return null;
}
export function auditEventKind(event: CloudLabsAuditEvent): 'test' | 'review' | 'other' {
  const type = event.type.toLowerCase().replace(/[\s_-]/g, '');
  if (['test', 'labtest', 'testing', 'labtesting'].includes(type)) return 'test';
  if (['review', 'labreview', 'reviewed'].includes(type)) return 'review';
  return 'other';
}
export function normalizeCloudLabsAudits(payload: unknown, includePii = false): CloudLabsAuditEvent[] {
  if (!Array.isArray(payload) || payload.length > 5000) throw new Error('Invalid audit response.');
  return payload.map((value): CloudLabsAuditEvent => {
    const row = object(value);
    const type = text(row?.EventType, 80);
    if (!row || !type) throw new Error('Invalid audit event.');
    const details = object(row.TemplateAuditLabTest);
    const status = row.StatusId;
    return {
      id: text(row.Id), type, at: auditTimestamp(row.EventDate),
      actor: includePii ? text(row.CreatedBy) ?? text(row.Email) : null,
      statusId: typeof status === 'number' && Number.isInteger(status) ? status
        : typeof status === 'string' && /^\d+$/.test(status.trim()) ? Number(status) : null,
      validation: auditValidation(details?.LabvalidationStatus),
      ownerReviewed: reviewFlag(details?.LabOwnerReview)
    };
  }).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

export function summarizeCloudLabsAudit(record: CloudLabsAuditRecord | null, now = new Date()): AuditSummary {
  const summary: AuditSummary = {
    availability: 'not_checked', completion: 'unknown', validation: 'unknown', review: 'unknown', freshness: 'unknown',
    daysSinceTest: null, lastTestAt: null, lastTestBy: null, fetchedAt: record?.fetchedAt ?? null,
    attemptedAt: record?.attemptedAt ?? null, testCount: 0, checksMet: false,
    message: 'Not checked. Refresh the CloudLabs audit history for this exact template.'
  };
  if (!record) return summary;
  if (record.errorCode) return { ...summary, availability: 'sync_failed', message: CLOUDLABS_ERRORS[record.errorCode] };
  const fetchedAt = auditTimestamp(record.fetchedAt);
  const elapsed = fetchedAt ? now.getTime() - Date.parse(fetchedAt) : NaN;
  if (!Number.isFinite(elapsed) || elapsed < 0) return { ...summary, availability: 'invalid', message: 'Invalid audit check timestamp. Refresh before relying on this result.' };
  if (elapsed > AUDIT_POLICY.cacheHours * 3_600_000) return { ...summary, availability: 'stale', message: 'The last successful check is over 24 hours old. History is last-known only; refresh to confirm.' };
  summary.availability = 'current';
  if (record.events.some(event => auditEventKind(event) === 'other' && ![
    'update', 'labupdate', 'updated', 'create', 'created', 'delete', 'deleted', 'labonboarding', 'changedvalue', 'contentupdate'
  ].includes(event.type.toLowerCase().replace(/[\s_-]/g, '')))) {
    return { ...summary, availability: 'invalid', message: 'History contains an unrecognized event type. Verify its meaning in CloudLabs.' };
  }
  const tests = record.events.filter(event => auditEventKind(event) === 'test');
  summary.testCount = tests.length;
  if (!tests.length) return { ...summary, completion: 'not_recorded', message: 'No test audit appears in the successfully retrieved history for this template.' };
  if (tests.some(event => !event.at || Date.parse(event.at) > now.getTime())) return {
    ...summary, availability: 'invalid', message: 'A test has a missing, invalid or future date. The latest test cannot be determined safely.'
  };
  const last = [...tests].sort((a, b) => b.at!.localeCompare(a.at!))[0];
  if (tests.some(event => event.at === last.at && (
    event.statusId !== last.statusId || event.validation !== last.validation || event.ownerReviewed !== last.ownerReviewed
  ))) return { ...summary, availability: 'invalid', message: 'Conflicting tests share the latest timestamp. Check CloudLabs before choosing a result.' };

  const days = Math.floor((now.getTime() - Date.parse(last.at!)) / 86_400_000);
  summary.lastTestAt = last.at;
  summary.lastTestBy = last.actor;
  summary.daysSinceTest = days;
  summary.completion = last.statusId === 2 ? 'completed' : last.statusId === 1 ? 'in_progress' : 'unknown';
  summary.validation = last.validation;
  summary.review = last.ownerReviewed === true ? 'signed_off' : last.ownerReviewed === false ? 'pending' : 'unknown';
  const reviews = record.events.filter(event => auditEventKind(event) === 'review');
  if (reviews.some(event => !event.at || Date.parse(event.at) > now.getTime())) summary.review = 'unknown';
  else {
    const applicable = reviews.filter(event => event.at! >= last.at!).sort((a, b) => b.at!.localeCompare(a.at!));
    const latest = applicable[0];
    if (latest) {
      const tied = applicable.some(event => event.at === latest.at && (event.statusId !== latest.statusId || event.validation !== latest.validation));
      summary.review = tied ? 'unknown' : latest.validation === 'failed' ? 'pending'
        : latest.statusId === 2 ? 'signed_off' : latest.statusId === 1 ? 'pending' : 'unknown';
    }
  }
  summary.freshness = days > AUDIT_POLICY.staleDays ? 'stale' : days > AUDIT_POLICY.agingDays ? 'aging'
    : days <= AUDIT_POLICY.recentDays ? 'recent' : days <= AUDIT_POLICY.nudgeDays ? 'retest_suggested' : 'current';
  summary.checksMet = summary.completion === 'completed' && summary.validation === 'passed' && summary.review === 'signed_off' && summary.freshness !== 'stale';
  summary.message = summary.validation === 'failed' ? 'Validation failed, even if the audit was finalized.'
    : summary.completion === 'in_progress' ? 'The latest test audit is still in draft / in progress.'
    : summary.completion === 'unknown' ? 'CloudLabs returned an unrecognized completion status.'
    : summary.freshness === 'stale' ? 'The latest test is over 90 days old and needs a retest.'
    : summary.validation === 'unknown' ? 'Completion does not confirm that validation passed.'
    : summary.review !== 'signed_off' ? 'A passing test is recorded, but owner sign-off is not confirmed.'
    : 'Completed test, explicit passing validation and owner sign-off recorded. This is separate from workshop approval and local readiness.';
  return summary;
}

export function isAuditRecord(value: unknown, templateId: string): value is CloudLabsAuditRecord {
  const row = object(value);
  return Boolean(row && row.version === 1 && row.templateId === templateId && auditTimestamp(row.attemptedAt)
    && (row.fetchedAt === null || auditTimestamp(row.fetchedAt))
    && (row.errorCode === null || (typeof row.errorCode === 'string' && Object.prototype.hasOwnProperty.call(CLOUDLABS_ERRORS, row.errorCode)))
    && Array.isArray(row.events) && row.events.length <= 5000 && row.events.every(item => {
      const event = object(item);
      return event && typeof event.type === 'string' && event.type.length > 0
        && (event.at === null || auditTimestamp(event.at)) && (event.id === null || typeof event.id === 'string')
        && (event.actor === null || typeof event.actor === 'string') && (event.statusId === null || Number.isInteger(event.statusId))
        && ['passed', 'failed', 'unknown'].includes(String(event.validation))
        && (event.ownerReviewed === null || typeof event.ownerReviewed === 'boolean');
    }));
}