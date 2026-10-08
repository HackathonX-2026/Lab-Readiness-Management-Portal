# Lab Readiness Sync Server

Node.js + SQLite backend that periodically pulls lab data from the CloudLabs
Admin portal and exposes it as a normalized REST API for the React frontend.

**This replaces the Excel/`localStorage` demo data flow.**

```
[CloudLabs Admin]  ── HTTPS ──►  [sync.js (cron)]  ──►  [SQLite]
                                                          │
                                                          ▼
                                             [Express /api/labs] ◄── React app
```

## What it does

1. Every N minutes (default 10) it calls `POST /api/partners/{partnerId}/workshop-requests/list` on `api-vnext.cloudlabs.ai`, paginates through the results, and upserts each record into a local `labs` table.
2. Any record present locally but missing from the source is soft-deleted (`deleted_at` set) — so cancellations propagate.
3. Every run is recorded in the `sync_runs` table (audit / monitoring).
4. Exposes:
   - `GET  /api/health` — smoke test
   - `GET  /api/labs` — normalized lab list (filters: `?status=`, `?q=`, `?includeDeleted=true`, `?limit=&offset=`)
   - `GET  /api/labs/:id` — single lab
   - `GET  /api/sync/status` — last + last-10 runs
   - `POST /api/sync/run` — force a sync (returns 409 if one is already running)

## Setup

```powershell
cd server
npm install
Copy-Item .env.example .env
notepad .env    # fill in CLOUDLABS_ACCESS_TOKEN (see next section)
npm start
```

Use **Node.js 24 or newer**. The server binds to `127.0.0.1:3001` by default.
Workshop sync starts only when its partner ID and token are configured. Catalog
credentials are independent; cached API reads and health work without credentials.

## Reference CloudLabs catalog and audits

The reference portal's **admin API** implementation is available alongside the
existing **vNext workshop sync**. Do not interchange their credentials:

| API family | Upstream host | Server configuration |
|---|---|---|
| Workshop request sync (existing) | `api-vnext.cloudlabs.ai` | `CLOUDLABS_PARTNER_ID`, `CLOUDLABS_ACCESS_TOKEN` |
| Catalog, approvals, template details, test/review history (added) | `api.cloudlabs.ai` | `CLOUDLABS_TOKEN`, `CLOUDLABS_ROLEID`, `CLOUDLABS_TENANTID` |

Use the blank placeholders in [.env.example](.env.example). Enter credentials
directly in the local server environment or deployment secret store; do not paste
them into chat, copy browser storage, or add `VITE_` token variables.

### Upstream calls

- `POST /api/WorkshopTemplates/GetTemplatesByFilter`
- `POST /api/Requests/GetAllApprovals`
- `GET /api/WorkshopTemplates/GetTemplateDataByTemplateID/{templateId}`
- `GET /api/TemplateAudit/GetTemplateAudit?templateId={templateId}`

All four are **read-only at CloudLabs**, including the POST list endpoints.
Headers are `Authorization: Bearer …`, `roleid`, and `tenantid`. Pagination uses
`State: "5"`, `StartIndex: 5000` (**page size**, not offset), and 1-based
`PageCount`; approvals also send `StatusFilterId: null`. A short/empty final page
confirms completion. Repeated pages, invalid responses, or the 10-page safety cap
fail closed rather than publish a truncated catalog. HTTPS, a 20-second request
timeout, and redirect rejection prevent credential forwarding.

### Local routes and screens

| Local route | Behavior |
|---|---|
| `GET /api/cloudlabs` | Current partner's cached catalog, safe connection metadata, refresh permissions |
| `GET /api/cloudlabs/connection` | Token presence/expiry flags only; never token or role/tenant IDs |
| `POST /api/cloudlabs` | Refresh catalog and upcoming non-cancelled approvals atomically |
| `GET /api/cloudlabs/templates/:templateId` | Live lookup of a known template's sanitized document URL |
| `GET /api/cloudlabs/audits/overview` | Cached per-template audit summaries |
| `GET /api/cloudlabs/audits?templateId=…` | Cached normalized events and summary |
| `POST /api/cloudlabs/audits` | Refresh local history for `{"templateIds":["…"]}` (1–5 known IDs) |

The **CloudLabs Catalog** screen provides template search, platform/owner/status,
document lookup, upcoming deliveries, connection status, and workshop sync history.
**CloudLabs Audits** provides selection, batch refresh, and event-history dialogs.
The topbar's **Sync CloudLabs** button now triggers the actual workshop-sync API
before reloading the local cache; local edits are preserved.

### Persistence and audit rules

- New SQLite tables store only normalized catalog/audit records, scoped by an
  origin/partner/role fingerprint. Token rotation preserves a partner's cache;
  switching partner or role does not expose another connection's records.
- Catalog fetches are single-flight. Both upstream list calls and normalization
  must succeed before replacing the snapshot. Failures preserve the last snapshot.
- Audit batches allow at most 3 concurrent reads, with a 60-second per-template
  cooldown. A failed refresh retains prior events but reports current status as
  **unknown**, not successful.
- `StatusId=2` means completed; it does **not** imply validation passed. Explicit
  validation, owner sign-off, freshness, and completion are independent. Unknown
  types, future/invalid dates, or conflicting latest events fail closed.
- Checks become stale after 24 hours. Reference freshness bands are 0–15 days
  recent, 16–45 retest suggested, 46–60 current, 61–90 aging, over 90 needs retest.
- Template IDs and delivery on-demand IDs are not guessed to be interchangeable.
  Audit checks never overwrite workshop approval or local lab testing state.
- Personal fields are redacted by default (`CLOUDLABS_INCLUDE_PII=0`) and on every
  cached reread. Document URLs have credential query parameters removed. Raw
  templates, audit responses, tokens, role IDs, and tenant IDs are not served.

### Security and optional automation

Local demo accounts are **browser-only**, not server authentication. Before
exposing this backend, put the entire app/API behind a trusted authentication
gateway (e.g. Entra Easy Auth), restrict network ingress, and configure CORS.
`HOST=127.0.0.1` is the safe default; `HOST=0.0.0.0` requires that gateway.

`CLOUDLABS_REFRESH_API_KEY` (or `SCAN_API_KEY`) optionally protects all operations
that contact CloudLabs. An authenticated proxy or authorized API client must
send `x-api-key`; the browser never receives the key. UI refresh/lookup controls
are disabled when that header is unavailable. Cached reads still require the
deployment's authentication boundary. CORS is not authentication.

For temporary credentials set `CLOUDLABS_AUTH_SOURCE=browser-session` and
`CLOUDLABS_TOKEN_EXPIRES_AT`. Missing/expired expiry disables new reads; a JWT
expiry, when present, is also checked. **No automatic token renewal is claimed.**
The reference's optional OAuth/PKCE connector depends on an approved confidential
CloudLabs client, encrypted refresh-token storage, and trusted server-side Entra
admin authorization. That deployment-specific connector and the reference's AI
guide-ingestion/scanning pipeline are not enabled by this integration.

Set `CLOUDLABS_CATALOG_SYNC_ENABLED=true` to refresh the catalog on `SYNC_CRON`.
It is off by default. Audit history refresh is manual. No live credentials or
snapshots are copied from the reference project.

### Offline verification

`npm test` runs synthetic CloudLabs transport, persistence, route, and audit-rule
tests using in-memory SQLite and localhost only. It needs no CloudLabs credentials
and does not load the local environment file. Run the frontend production build
from the repository root separately.

## Token acquisition (⚠ read this)

The portal uses **Azure AD B2C** interactive login. It has no publicly
documented service-to-service credential. Three viable options, in order of
production suitability:

### Option 1 — Ask CloudLabs for a service credential (best)
Contact CloudLabs support and ask for either:
- A client-credentials-enabled app registration you can use with MSAL, **or**
- An API key / long-lived integration token.

If they grant you a client-credentials app, replace `getToken()` in
[src/cloudlabs.js](src/cloudlabs.js) with:

```js
import { ConfidentialClientApplication } from '@azure/msal-node';
const msal = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.CLOUDLABS_CLIENT_ID,
    clientSecret: process.env.CLOUDLABS_CLIENT_SECRET,
    authority: 'https://cloudlabsai.b2clogin.com/tfp/cloudlabsai.onmicrosoft.com/B2C_1A_custom_signup_signin'
  }
});
// then acquire a token with the audience 'e92e446f-5d92-4100-8c37-7e31fbd69c04'
```

### Option 2 — Manual token paste (fastest, expires ~6h)
1. Log in to https://admin-vnext.cloudlabs.ai/…/dashboard in your browser.
2. Open DevTools → Network tab.
3. Click any `/api/…` request.
4. In the Headers panel, copy the `Authorization` value **after** `Bearer `.
5. Paste it as `CLOUDLABS_ACCESS_TOKEN` in `.env` and restart the server.

When the token expires (401), repeat. Fine for a demo, not for production.

### Option 3 — Automated interactive login via Playwright (fragile)
Reuse the `tools/api-recon/` profile to run a headless MSAL login on a
schedule and extract a refresh-token-derived access token. This is brittle
because SSO flows change, and it can trip risk detection. **Only if Option 1
and 2 are off the table.**

## Data model

The `labs` table columns are the canonical model the React app should consume:

| Column | Source (workshop-request) |
|---|---|
| `id` | `cloudlabs:workshop:<id>` |
| `source` | `workshop-request` |
| `source_id` | `id` |
| `lab_name` | `trackTitle` |
| `track_title` | `trackTitle` |
| `delivery_date` | `date` |
| `request_status` | normalized `requestStatus` |
| `readiness_status` | computed from status + delivery date |
| `owner_email` | `requesterEmail` |
| `primary_contact` | `primaryContact` |
| `customer` | `customer` or `partnerName` |
| `country` / `region` | `country` / `timeZone` |
| `event_type` | `eventType` (Virtual/InPerson) |
| `registration_count` | `registrationCount` |
| `duration_minutes` | `duration` |
| `is_active` | `isActive` |
| `bit_link` | `bitLink` |
| `purchase_order` | `purchaseOrder` |
| `raw_json` | full source payload (future-proof) |

See [src/mapper.js](src/mapper.js) for the transform. Add fields you need
there; the schema already stores the full raw payload so no re-sync is needed.

## Incremental sync semantics

- **Created** — row inserted (id didn't exist locally).
- **Updated** — `raw_json` differs from last-seen version.
- **Unchanged** — same payload; `updated_at` preserved (no false-positive notifications).
- **Deleted (soft)** — row not returned in the latest full page walk. `deleted_at` set; `/api/labs` hides it unless `?includeDeleted=true`.

## Operations

```powershell
# View last 10 sync runs
Invoke-RestMethod http://localhost:3001/api/sync/status | ConvertTo-Json -Depth 5

# Trigger an immediate sync
Invoke-RestMethod -Method POST http://localhost:3001/api/sync/run

# Fetch labs happening this week
Invoke-RestMethod "http://localhost:3001/api/labs?limit=20"
```

Logs are structured JSON on stdout — pipe to a file or log collector.

## Alert Notifications

The backend automatically monitors labs for those approaching their workshop dates.

### Timeline Risk Dashboard (Frontend)

The React app includes a **"Timeline Risk"** page (⚠️ icon in sidebar) that shows:
- **🔴 Critical alerts**: Labs with workshop < 7 days away that are NOT yet marked Passed
- **🟡 Medium risk**: Labs with workshop 7-14 days out, still in progress
- **🟢 Safe**: Labs with 14+ days until workshop

Managers can visit this page daily to spot bottlenecks early and reassign work as needed.

### Email Alerts (Optional)

Configure SMTP in `.env` to enable automatic email notifications:

```env
EMAIL_ALERTS_ENABLED=true
SMTP_HOST=smtp.gmail.com          # or your mail server
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_MANAGER_EMAIL=manager@company.com
```

With email alerts enabled:
- Server checks every 30 minutes (configurable via `EMAIL_ALERT_CRON`) for labs with < 3 days until workshop
- If a lab is not yet marked **Passed**, an alert email is sent to the configured recipients
- Emails are rate-limited (max once per lab per 24 hours) to avoid spam

**To disable email:** Leave `SMTP_HOST` blank. Alerts will still be logged to the console for debugging.

## Scheduling in production

Two options:

1. **Keep the built-in cron** (`SYNC_CRON`). Simplest — one process runs both HTTP + scheduler.
2. **OS-level scheduler**: disable the built-in scheduler by unsetting `SYNC_ON_START` and setting `SYNC_CRON` to a rarely-firing value, then run `npm run sync:once` from Windows Task Scheduler or a Kubernetes CronJob.

## Wiring the React frontend

See [../src/api/cloudlabs.ts](../src/api/cloudlabs.ts) for the frontend client
that hits this backend. The Vite dev server proxies `/api/*` to
`http://localhost:3001`, so the same code works in dev and prod (as long as
prod also serves the frontend behind a reverse proxy that forwards `/api`).

## Removing the Excel demo path

Once the frontend is using this backend, delete or gate the following in the
React app so no code path ever falls back to the Excel demo:

- `src/lib/seedData.ts` and `src/lib/seed.ts`
- Any `Import Excel` button in `src/components/Topbar.tsx`
- The `localStorage` write path in `src/state/LabsContext.tsx`

The migration plan is in this repo's root workspace, section
"Excel → CloudLabs migration" of the main README.
