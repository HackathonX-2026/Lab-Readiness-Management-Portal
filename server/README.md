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

Server boots on `http://localhost:3001` and immediately kicks off a sync.

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
