# Deployment

The backend deploys to **Render** (free tier, via Blueprint) and the frontends
deploy to **Vercel**.

## 1. Database — MongoDB Atlas (free M0)

Render's free tier has no MongoDB, so the API uses Atlas:

1. Create a free M0 cluster at https://cloud.mongodb.com.
2. Create a database user and allow access from `0.0.0.0/0` (or Render's IPs).
3. Copy the connection string (`mongodb+srv://...`) — you'll paste it into
   Render as `MONGODB_URI`.

## 2. Backend — Render Blueprint

[render.yaml](render.yaml) at the repo root defines the `ubuntu-fund-api`
web service (free plan, health check on `/health`, runs `tsx src/main.ts`).

1. In the Render dashboard: **New → Blueprint**, connect this GitHub repo.
2. Render reads `render.yaml`; when prompted, paste the Atlas URI into
   `MONGODB_URI`. `JWT_SECRET` / `JWT_REFRESH_SECRET` are auto-generated.
3. Set `CORS_ORIGINS` to your deployed frontend origins, comma-separated,
   e.g. `https://ujimora.vercel.app,https://admin-ujimora.vercel.app`.
4. The service URL will be `https://ubuntu-fund-api.onrender.com`. If Render
   assigns a different name, update the rewrite destinations in the three
   `vercel.json` files.

Note: free Render services sleep after inactivity; the first request after
idle takes ~30–60s.

### Creating the first admin

There is no self-service admin signup. Register a user through the app, then
promote it directly in Atlas:

```js
db.users.updateOne({ email: 'you@example.com' }, { $set: { role: 'admin' } })
```

## 3. Frontends — Vercel

Each app is its own Vercel project pointing at this monorepo:

| Project | Root Directory | Config |
|---|---|---|
| Donor app | *(repo root)* | [vercel.json](vercel.json) builds `apps/web` |
| Marketing | `apps/marketing` | [apps/marketing/vercel.json](apps/marketing/vercel.json) |
| Admin | `apps/admin` | [apps/admin/vercel.json](apps/admin/vercel.json) |

The donor app and the admin console call the API origin directly
(`VITE_API_URL=https://api.ujimora.com/api/v1` in their tracked
`.env.production`), so the frontends work with **no required environment
variables** — import the repo in Vercel three times with the root directories
above and the rest is picked up from the config files.

Why direct: the API rate-limits and audits by client IP, taken from the
`CF-Connecting-IP` header that Render's Cloudflare edge sets (see
`apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`). A
request proxied through Vercel arrives from Vercel's egress IP, so every
browser using the rewrite shares one rate-limit bucket. Direct calls need the
browser origin in the API's `CORS_ORIGINS` (render.yaml already lists
`ujimora.com`, `www`, `app` and `admin`); auth is bearer-token only, so there
is no cookie or same-origin dependency. All three configs still rewrite
`/api/v1/*` to the API, for bundles built before the switch and for the
marketing site, which stays on the rewrite.

Preview deployments are served from `*.vercel.app`, which `CORS_ORIGINS` does
not (and should not) list, so a preview built with the production value cannot
reach the API from the browser. To keep previews on the rewrite, set
`VITE_API_URL=/api/v1` for the **Preview** environment in each Vercel project;
a Vercel env var overrides `.env.production`. Make sure no **Production**-scoped
`VITE_API_URL` is set there either, or it will override the direct URL.

### Environment variables

Each frontend ships an `.env.example` (template), a tracked `.env.production`
(public build config — client bundles contain no secrets), and a local `.env`
(gitignored). Every client-exposed var is `VITE_`-prefixed.

| Var | Apps | Purpose |
|---|---|---|
| `VITE_API_URL` | web, admin, marketing | API base. Web and admin production builds use `https://api.ujimora.com/api/v1` (direct, so the API sees each browser's IP); marketing and local dev use `/api/v1` (Vercel rewrite / Vite proxy). |
| `VITE_WEB_APP_URL` | marketing | Donor web-app URL that marketing CTAs link to. Set to the deployed web project's domain in Vercel. |
| `API_PROXY_TARGET` | web, admin, marketing | **Dev only** — the Vite dev server proxies `/api/v1` here. Not read in production builds. |

To override in production, set the var in each Vercel project's settings; the
tracked `.env.production` is the committed default. Never put secrets in a
frontend env file — everything `VITE_`-prefixed is shipped to the browser.

## 4. CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint, type-check,
unit tests (against a MongoDB service container), Playwright e2e (with the
real API booted), and builds — on every push/PR to `main`.

## Creator profile donations

Creator donations require an active paid subscription; Free and trial accounts cannot enable them or receive new tips. Withdrawals deduct the current effective plan’s platform-fee percentage, with the fee and net amount reviewed before confirmation. Existing balances remain withdrawable after downgrade. See [creator donation policy and API contract](docs/creator-donations.md). Deploy API and web together; no new credentials are required and `TIP_PLATFORM_FEE_PERCENT` is no longer used.
