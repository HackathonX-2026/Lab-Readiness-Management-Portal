// Maps CloudLabs source records to the normalized `Lab` model stored in SQLite
// and consumed by the React frontend.

const REQUEST_STATUS_NORMALIZATION = {
  'Pending': 'Requested',
  'Requested': 'Requested',
  'Approved': 'Approved',
  'InProgress': 'InProgress',
  'In Progress': 'InProgress',
  'Completed': 'Completed',
  'Cancelled': 'Cancelled',
  'Rejected': 'Cancelled',
  'Withdrawn': 'Cancelled'
};

function isoDate(d) {
  if (!d) return null;
  // CloudLabs returns naive datetimes like "2026-07-07T00:00:00" (no timezone).
  // `new Date(naive)` interprets those as *local* time, which on any UTC+N host
  // (e.g. IST +05:30) shifts them backwards and pushes 00:00 onto the previous
  // calendar day. Treat them as UTC to preserve the intended workshop date.
  const s = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(d)
    ? d + 'Z'
    : d;
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/**
 * Compute a readiness signal from source fields. This preserves the semantics
 * the current React app uses (Ready / Testing Pending / Retest Required / Action Required)
 * while working from the real CloudLabs data shape.
 */
function computeReadiness(source, deliveryDate) {
  const status = (source.requestStatus || '').toLowerCase();
  if (status.includes('cancel') || status.includes('reject')) return 'Cancelled';
  if (!deliveryDate) return 'Testing Pending';

  const daysUntil = (new Date(deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const approved = status.includes('approved') || status.includes('progress') || status.includes('complete');

  if (!approved) return 'Action Required';
  if (daysUntil < 0) return 'Completed';
  if (daysUntil <= 7) return 'Ready';
  if (daysUntil <= 15) return 'Ready';
  return 'Testing Pending';
}

/**
 * Map one workshop-request record. This is the "Lab" the React app cares about
 * — a scheduled delivery with a customer, date, and owner.
 */
export function mapWorkshopRequest(raw, now) {
  const deliveryDate = isoDate(raw.date);
  const requestStatus = REQUEST_STATUS_NORMALIZATION[raw.requestStatus] || raw.requestStatus || 'Unknown';

  return {
    id: `cloudlabs:workshop:${raw.id}`,
    source: 'workshop-request',
    source_id: String(raw.id),
    lab_name: raw.trackTitle || raw.workshopDisplayName || `Workshop ${raw.id}`,
    track_title: raw.trackTitle || null,
    request_date: null, // not exposed by this endpoint directly
    delivery_date: deliveryDate,
    request_status: requestStatus,
    request_status_raw: raw.requestStatus || null,
    readiness_status: computeReadiness(raw, deliveryDate),
    environment_status: raw.isActive ? 'Active' : 'Inactive',
    owner_email: raw.requesterEmail || null,
    primary_contact: raw.primaryContact || null,
    customer: raw.customer || raw.partnerName || null,
    country: raw.country || null,
    region: raw.timeZone || raw.country || null,
    event_type: raw.eventType || raw.deliveryType || null,
    registration_count: typeof raw.registrationCount === 'number' ? raw.registrationCount : null,
    duration_minutes: typeof raw.duration === 'number' ? raw.duration : null,
    time_zone: raw.timeZone || null,
    is_active: raw.isActive ? 1 : 0,
    bit_link: raw.bitLink || null,
    purchase_order: raw.purchaseOrder || null,
    external_id: raw.uniqueId || raw.externalSystemIntegrationId || null,
    raw_json: JSON.stringify(raw),
    now
  };
}

/**
 * Map one on-demand-lab record (secondary source — used for the "template" concept).
 * Optional; kept for completeness.
 */
export function mapOnDemandLab(raw, now) {
  const deliveryDate = isoDate(raw.endDate);
  return {
    id: `cloudlabs:odl:${raw.id}`,
    source: 'on-demand-lab',
    source_id: String(raw.id),
    lab_name: raw.title || raw.templateName || `ODL ${raw.id}`,
    track_title: raw.templateName || null,
    request_date: null,
    delivery_date: deliveryDate,
    request_status: raw.labStatus || 'Unknown',
    request_status_raw: raw.labStatus || null,
    readiness_status: raw.labStatus === 'ODL_REGISTRATION_OPEN' ? 'Ready' : 'Testing Pending',
    environment_status: raw.isDecommission ? 'Decommissioned' : 'Active',
    owner_email: null,
    primary_contact: null,
    customer: null,
    country: null,
    region: null,
    event_type: 'On-Demand',
    registration_count: null,
    duration_minutes: raw.duration ? (raw.duration.hours || 0) * 60 + (raw.duration.minutes || 0) : null,
    time_zone: null,
    is_active: raw.isDecommission ? 0 : 1,
    bit_link: raw.bitLink || null,
    purchase_order: null,
    external_id: raw.uniqueName || null,
    raw_json: JSON.stringify(raw),
    now
  };
}
