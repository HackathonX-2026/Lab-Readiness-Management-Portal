# CloudLabs Admin — API Reverse-Engineering Toolkit

A Playwright-based recon kit that lets you **manually log in** to the CloudLabs
Admin portal and silently records every API call it makes. It then produces a
structured API map you can use to rebuild the dashboard inside your own React
app (or any other frontend).

> **Ethical scope:** you must own the account you log in with, and you must
> have the right to inspect the traffic. The tool never bypasses auth, never
> exfiltrates credentials, and only captures requests made in your own
> authenticated session.

---

## 1. One-time setup

From `tools/api-recon/`:

```powershell
npm install
npm run install:browsers    # downloads Chromium for Playwright
```

## 2. Capture a session

```powershell
npm run capture
```

What happens:

1. A real Chromium window opens at the CloudLabs Admin dashboard URL.
2. **You log in manually** with your company SSO. The script never sees your
   password.
3. Every API call (XHR / fetch / document) from your session is written to
   `captures/<timestamp>/requests.ndjson`.
4. Static assets (images, fonts, CSS, JS chunks) and known analytics hosts are
   skipped.
5. **Click through every dashboard section you want mapped** — Dashboard,
   Labs, Lab details, Users, Reports, Readiness, etc.
6. When you're finished, close the browser window (or press `Ctrl+C`).

Your login is persisted in `.browser-profile/` so re-running `npm run capture`
usually skips the SSO prompt.

## 3. Generate the API map

```powershell
npm run analyze
```

This reads the newest `captures/<timestamp>/` folder and writes:

| File | What it contains |
|---|---|
| `api-map.md` | **Start here.** Master index of every unique endpoint, grouped by category (Dashboard, Labs, Users, Reports, …) and by host. |
| `endpoints.json` | Machine-readable list of endpoints for codegen. |
| `auth-analysis.md` | How the portal authenticates: bearer / JWT / cookies / CSRF, plus the JWT issuer if applicable. |
| `page-dependencies.md` | For each dashboard page you visited, which endpoints fired. Use this to plan your integration one screen at a time. |
| `samples/*.json` | One file per unique endpoint with up to 3 real request + response samples. |

You can also run capture + analyze together:

```powershell
npm run recon
```

## 4. Recommended workflow for rebuilding the dashboard

1. **Skim `api-map.md`.** Confirm which hosts serve APIs (usually 1–3
   distinct hosts — a portal BFF, an identity host, maybe a telemetry host).
2. **Read `auth-analysis.md`.** Decide the integration strategy:
   - If auth is **JWT + Entra ID** (most likely for CloudLabs), register your
     own app in the same tenant, request the same audience/scopes, and call
     the APIs directly with your own token. This is the production-quality
     path — no browser automation needed.
   - If auth is **cookie-only with SSO**, ask CloudLabs for a service
     account / API key. Browser-driven scraping of a cookie session is
     brittle and should be a last resort.
3. **Work page-by-page from `page-dependencies.md`.** Pick one screen you
   want in your app (e.g. "Dashboard"), copy the endpoint list, and use the
   samples to shape TypeScript types.
4. **Generate TypeScript types.** For each endpoint, feed the sample
   response into a tool like `quicktype` or paste it into ChatGPT to get a
   `type` definition. Drop those into `src/api/` in the main React app.
5. **Wire a thin API client.** Create `src/api/cloudlabs.ts` that wraps
   `fetch` and injects the bearer token from your auth provider.
6. **Replace `localStorage` mocks** in the React app's contexts
   (`LabsContext`, etc.) with calls to the real endpoints.

## 5. Direct API integration vs. browser automation

| Situation | Recommendation |
|---|---|
| CloudLabs exposes an official API with tokens you can request | **Use the API directly.** Drop Playwright entirely. |
| Auth is JWT/OAuth and you can obtain a token via client-credentials or on-behalf-of | **Use the API directly** with `msal-node` / `@azure/identity`. |
| Auth is user-only SSO and there is no service credential path | Ask CloudLabs first. If unavoidable, run Playwright on a schedule with a persistent profile, cache responses, and expose them via a tiny internal API — do **not** proxy live requests through browser automation. |
| The endpoint is CSRF-protected | Capture the CSRF token from a bootstrap call and echo it back on mutations. `auth-analysis.md` lists any anti-forgery headers detected. |

## 6. Files & folders

```
tools/api-recon/
├── package.json
├── capture.mjs              # Playwright recorder (interactive)
├── analyze.mjs              # Turns raw log into api-map.md + samples
├── README.md                # (this file)
├── .browser-profile/        # persistent Chromium profile (gitignore this)
└── captures/
    └── 2026-07-04T.../
        ├── requests.ndjson  # raw log, one JSON per line
        ├── session.json     # cookies + pages visited
        ├── api-map.md       # human-readable API map
        ├── endpoints.json   # machine-readable
        ├── auth-analysis.md
        ├── page-dependencies.md
        └── samples/
```

## 7. Configuration

Environment variables recognised by `capture.mjs`:

| Var | Default | Purpose |
|---|---|---|
| `RECON_URL` | the CloudLabs dashboard URL | Override the starting page. |

Edit the constants at the top of `capture.mjs` to change:

- `SKIP_HOSTS` — telemetry/analytics hosts to ignore
- `SKIP_RESOURCE_TYPES` — resource types to skip (image/font/etc.)
- `MAX_BODY_BYTES` — response body truncation limit (default 512 KB)

## 8. Security notes

- The raw `requests.ndjson` contains **live auth tokens and cookies**. Treat
  it like a password. Do not commit it or share it.
- Add `tools/api-recon/captures/` and `tools/api-recon/.browser-profile/` to
  your `.gitignore`.
- Tokens captured here expire — do not build integrations that rely on the
  captured token. Obtain your own via a supported auth flow.
