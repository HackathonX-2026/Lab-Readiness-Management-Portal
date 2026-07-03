# Lab Readiness Management Portal

A modern, single-page web portal for tracking production labs, upcoming customer workshops, testing status, and readiness — inspired by the operational needs described in your brief.

Built with **React 18 + TypeScript + Vite**, styled with **Tailwind CSS**, charts by **Recharts**, and Excel I/O via **SheetJS (xlsx)**.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app seeds realistic sample data on first launch and persists everything to `localStorage`. Use the **Import Excel** button in the top bar to load your own `Upcoming-Workshops-Tracker.xlsx`.

## Modules

1. **Executive Dashboard** — Totals, readiness mix, per-track stacked chart, workshop proximity distribution, overall readiness %.
2. **Lab Inventory** — Search, sort, filter (readiness / test / track / language / at-risk), bulk update, add/edit/delete.
3. **Upcoming Workshops** — Next 7 / 15 / 30-day windows with list *and* calendar views.
4. **Tester Workspace** — Personalized queue for the signed-in tester with inline status/date/comment updates.
5. **Retesting Center** — Auto-listed labs needing retest with impact scoring, days since last test, and workshop impact.
6. **Reporting & Analytics** — Readiness %, tester performance leaderboard, language distribution, risk analysis, workshop coverage.

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
- **Manager** — read-only dashboards, reports, retesting center.

## Data & persistence

- All state lives in `localStorage` (`lab-readiness:*` keys).
- **Import Excel** accepts `.xlsx/.xls/.csv` and maps common column headers automatically.
- **Export** produces an Excel file including computed *Days Gap* and *Readiness Status*.
- **Reset** restores the seeded sample dataset.

## Production stack mapping

The prototype mirrors the recommended stack so it maps cleanly to production:

| Prototype | Production equivalent |
|---|---|
| React SPA | Power Apps model-driven app or React on Azure Static Web Apps |
| localStorage | Dataverse / SharePoint List / Azure SQL |
| In-browser notification engine | Power Automate flows → Email / Teams webhooks |
| Recharts dashboards | Power BI embedded reports |
| Role switcher | Microsoft Entra ID app roles / groups |
