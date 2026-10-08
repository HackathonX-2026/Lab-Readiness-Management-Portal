# Lab Readiness Management Portal

A modern, single-page web portal for tracking production labs, upcoming customer workshops, testing status, and readiness — inspired by the operational needs described in your brief.

Built with **React 18 + TypeScript + Vite**, styled with **Tailwind CSS**, charts by **Recharts**, and Excel I/O via **SheetJS (xlsx)**.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. Use a built-in demo account on the sign-in screen for
local UI access. Workshop data comes from the sync backend, with a browser cache
for outages; **Import Excel** can load a local tracker without changing CloudLabs.

CloudLabs setup and the two independent credential families are documented in
[server/README.md](server/README.md). The **CloudLabs Catalog** and **CloudLabs
Audits** screens use server-side APIs and cached SQLite snapshots, not demo data.
No tokens are stored in the frontend. The server requires Node.js 24+; its offline
tests run with `npm test` from the server package.

## Modules

### Visual theme

The portal uses the reference CloudLabs theme: charcoal surfaces, indigo (`#6256ce`) accents, translucent 18px cards, subtle borders, system typography, and Lucide outline icons. New sessions default to dark mode; the existing light-mode toggle and saved preferences are preserved.

- Theme tokens and shared styles: [src/index.css](src/index.css) and [tailwind.config.js](tailwind.config.js).
- Charts share the same semantic colors through [src/lib/chartTheme.ts](src/lib/chartTheme.ts).
- Navigation adapts to mobile screens, wide tables scroll within their panels, and dialogs support Escape, focus containment, and focus restoration.
- Existing local lab readiness rules are preserved. Visual checks can use isolated browser fixtures without contacting CloudLabs.

### Application modules

1. **Executive Dashboard** — Totals, readiness mix, per-track stacked chart, workshop proximity distribution, overall readiness %.
2. **Lab Inventory** — Search, sort, filter (readiness / test / track / language / at-risk), bulk update, add/edit/delete.
3. **Upcoming Workshops** — Date-sorted table with 7 / 15 / 30-day filters, assignment, and editing.
4. **Timeline Risk** — Workshop-proximity risk buckets and lab details.
5. **CloudLabs Catalog** — Templates, sanitized document links, upcoming approvals, connection and sync status.
6. **CloudLabs Audits** — Separate completion, validation, owner-review and freshness evidence with cached event history.
7. **Reporting & Analytics** — Readiness %, tester performance leaderboard, language distribution, risk analysis, workshop coverage.
8. **Users / Audit Log** — Local demo account administration and app activity history.

## Business rules implemented

| Rule | Location |
|---|---|
| Ready when \|Workshop − Test\| ≤ 15 days | [src/lib/rules.ts](src/lib/rules.ts) |
| Retest Required when gap > 15 days | [src/lib/rules.ts](src/lib/rules.ts) |
| Testing Pending when no Test Date | [src/lib/rules.ts](src/lib/rules.ts) |
| Action Required when Test Status = Failed | [src/lib/rules.ts](src/lib/rules.ts) |
| Risk flag: workshop ≤ 7d & not Passed | [src/lib/rules.ts](src/lib/rules.ts) |
| Risk flag: missing owner / workshop date | [src/lib/rules.ts](src/lib/rules.ts) |

## Notifications & automation

The [`useNotificationEngine`](src/lib/notificationEngine.ts) hook simulates Power Automate flows in-browser and pushes items to the top-bar bell for:
- Workshop within 15 days without a Passed test
- Workshop within 7 days (urgent)
- Retest required
- Test status = Failed

Each notification records intended channels (**Email** ✉️ / **Teams** 💬).

## Role-based access

Sign in using an assigned account; the existing role behavior is preserved.
Admins manage local users and app audit history; managers can add/edit and bulk
update inventory. The role checks and demo login live in the browser and do not
authenticate the backend. Put the entire deployed app/API behind real server-side
authentication before connecting sensitive data or allowing public access.

## Data & persistence

- The backend stores workshop data, partner-scoped catalog snapshots, and normalized audit history in SQLite.
- Local demo users, preferences and a workshop cache use `localStorage` (`lab-readiness:*` keys). Local edits are overlays, not upstream CloudLabs writes.
- **Import Excel** accepts `.xlsx/.xls/.csv` and maps common column headers automatically.
- **Export** produces an Excel file including computed *Days Gap* and *Readiness Status*.
- **Sync CloudLabs** runs the existing workshop sync and reloads the cache while preserving local edits.

## Production stack mapping

The prototype mirrors the recommended stack so it maps cleanly to production:

| Prototype | Production equivalent |
|---|---|
| React SPA | Power Apps model-driven app or React on Azure Static Web Apps |
| localStorage | Dataverse / SharePoint List / Azure SQL |
| In-browser notification engine | Power Automate flows → Email / Teams webhooks |
| Recharts dashboards | Power BI embedded reports |
| Role switcher | Microsoft Entra ID app roles / groups |
