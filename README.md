# Lab Readiness Management Portal

A modern, single-page web portal for tracking production labs, upcoming customer workshops, testing status, and readiness — inspired by the operational needs described in your brief.

Built with **React 18 + TypeScript + Vite**, styled with **Tailwind CSS**, and charts by **Recharts**. Lab data is sourced from the CloudLabs portal through the local sync server.

## Getting started

Start the backend first by following [server/README.md](server/README.md), including its `server/.env` setup. Then run the frontend:

```bash
npm install
npm run dev
```

Open http://localhost:5173. The backend syncs CloudLabs workshop requests into SQLite; the frontend reads them through `/api` and caches the latest response in `localStorage`. Use **Sync CloudLabs** in the top bar to request an immediate sync.

The current Azure demo is configured for anonymous read-only access. Its production build uses `VITE_PUBLIC_ACCESS=true`; anyone with the URL can read the lab data and API responses. Do not use this mode with sensitive data. Manual sync is disabled for anonymous visitors.

## Modules

1. **Executive Dashboard** — Totals, readiness mix, per-track stacked chart, workshop proximity distribution, overall readiness %.
2. **Lab Inventory** — Search, sort, filter (readiness / test / track / language / at-risk), bulk update, add/edit/delete.
3. **Upcoming Workshops** — Next 7 / 15 / 30-day windows with list *and* calendar views.
4. **Tester Workspace** — Personalized queue for the signed-in tester with inline status/date/comment updates.
5. **Retesting Center** — Auto-listed labs needing retest with impact scoring, days since last test, and workshop impact.

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

Switch roles from the top bar:
- **Admin** — full CRUD, assignments, bulk update, delete.
- **Tester** — updates own assigned labs (status/date/comments).
- **Manager** — read-only dashboard, lab inventory, workshops, and retesting center.

## Data & persistence

- CloudLabs workshop requests are the source of lab data; the Node.js sync server stores a normalized copy in SQLite.
- The frontend reads from the sync server API and keeps a browser cache so previously loaded labs remain visible during a temporary API outage.
- Local tester edits are browser-side overlays and are not written back to the CloudLabs portal.

## Production stack mapping

The prototype mirrors the recommended stack so it maps cleanly to production:

| Prototype | Production equivalent |
|---|---|
| React SPA | Power Apps model-driven app or React on Azure Static Web Apps |
| localStorage | Dataverse / SharePoint List / Azure SQL |
| In-browser notification engine | Power Automate flows → Email / Teams webhooks |
| Recharts dashboards | Power BI embedded reports |
| Role switcher | Microsoft Entra ID app roles / groups |
