# Deployment

The backend deploys to **Render** (via Blueprint; currently the free instance
type — read the limitations below) and the frontends deploy to **Vercel**.

## 1. Database — MongoDB Atlas

Render has no MongoDB, so the API uses Atlas:

1. Create a cluster at https://cloud.mongodb.com. The free M0 tier works but
   has **no backups**. A service holding donation and payout records needs a
   tier with automated backups (M10+ for continuous backup and point-in-time
   restore) — an owner/cost decision.
2. Create a database user. Under Network Access, prefer the Render region's
   outbound IPs (Render dashboard → service → Connect → Outbound) over
   `0.0.0.0/0`.
3. Copy the connection string (`mongodb+srv://...`) — you'll paste it into
   Render as `MONGODB_URI`.
4. Once backups are on, run a restore drill into a scratch cluster and check
   the API boots against it, so the procedure is known before it is needed.

## 2. Backend — Render Blueprint

[render.yaml](render.yaml) at the repo root defines the `ujimora-api`
web service (free plan, health check on `/health/ready`, runs `tsx src/main.ts`).

1. In the Render dashboard: **New → Blueprint**, connect this GitHub repo.
2. Render reads `render.yaml`; when prompted, paste the Atlas URI into
   `MONGODB_URI`. `JWT_SECRET` / `JWT_REFRESH_SECRET` are auto-generated.
3. `CORS_ORIGINS` is committed in `render.yaml` (`ujimora.com`, `www`, `app`,
   `admin`). Add an origin there, not in the dashboard, if a frontend moves.
4. Paste the dashboard-only secrets listed below.
5. The service is `ujimora-api` (`https://ujimora-api.onrender.com`), served
   publicly as `https://api.ujimora.com`, which is what the frontends and the
   `vercel.json` rewrites call.

### Free-plan limitations (`plan: free` in render.yaml)

Render's free instance type is not meant for production, and this API runs
money-moving background work in-process:

- It **spins down after 15 minutes without inbound traffic**; the next request
  (a donor, or a Paystack webhook) waits about a minute while it starts.
  Webhooks are delayed, not lost: the request wakes the service, Paystack
  retries failed deliveries, and the reconciliation sweeps backfill.
- While asleep, **every in-process job stops**: payment/payout reconciliation,
  account and activity email delivery, outbox retries, store-billing and
  live-safety sweeps. They resume on the next wake-up.
- Render may restart a free service at any time. A restart drops open SSE
  streams, the live-event replay buffer and the in-memory rate-limit counters.
- Free services share **750 instance-hours per workspace per month**; past
  that, all free services are suspended until the month ends.

Moving to an always-on paid instance (`plan: starter`, the smallest) removes
all of the above; it is a billing decision, so the Blueprint still says
`free`. If you change the plan in the dashboard, change `render.yaml` too, or
the next Blueprint sync reverts it. Keep a single instance either way: the SSE
event bus and the rate limiters are per-process.

### Health checks and monitoring

- `GET /health` — liveness; always 200 while the process runs. CI polls it
  before seeding.
- `GET /health/ready` — readiness; 503 unless MongoDB answers a ping within
  2 s. Render's `healthCheckPath` uses it, so an instance that loses the
  database stops receiving traffic (Render stops routing after ~15 s of failed
  checks and restarts the instance after ~60 s). It is not rate-limited and
  returns no internals.
- Point an external uptime monitor with alerting at
  `https://api.ujimora.com/health/ready`. On the free plan a 5-minute check
  also keeps the service awake — which then uses ~744 of the 750 monthly free
  hours, so only if it is the workspace's only free service.
- Uncaught exceptions and unhandled promise rejections are logged as `fatal`
  through the structured logger, then the process exits for Render to restart.
- There is no error tracking (Sentry or similar) yet; it needs an account and
  DSN, which is an owner decision. Enable Render's deploy-failure
  notifications in the dashboard.

### API secrets set in the Render dashboard

Every variable the API reads is declared in `render.yaml` (a test,
`apps/api/__tests__/infrastructure/render-blueprint.test.ts`, fails if one is
missing). Secrets and keys that must stay stable are declared `sync: false`:
the Blueprint only creates the slot, and a committed value would overwrite the
dashboard on every sync. **Existing Blueprint services do not auto-create new
`sync: false` variables** — add each one by hand under *ujimora-api →
Environment*, then redeploy.

In production the API logs one startup error, `Production capabilities disabled
by missing configuration`, naming (never printing) whatever is missing.

**Account email and MFA** — these fail closed when unset:

| Variable | Format | Without it |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | No transactional email at all. |
| `AUTH_EMAIL_ENCRYPTION_KEY_BASE64` | 32 random bytes, base64: `openssl rand -base64 32` | Forgot-password, email verification and newsletter confirmation return 503; password-changed notices are silently skipped. Also needs `FROM_EMAIL` and an `https` `PUBLIC_WEB_URL` (both committed). Keep it stable and backed up. |
| `MFA_ENCRYPTION_KEY` | 32 random bytes, standard base64 (44 chars ending `=`): `openssl rand -base64 32` | Authenticator enrollment returns 503. **Never rotate it**: existing enrollments stay required and fail closed if the key changes. |

Check after deploy: `POST /api/v1/auth/forgot-password` with
`{"email":"nobody@example.com"}` must not return 503; signed in,
`GET /api/v1/auth/mfa` should report `data.available: true`.

**Native store billing** (App Store / Google Play subscriptions) — off unless
`STORE_BILLING_ENABLED` is exactly `true`. Once it is, every key the catalog's
stores need must be present and valid or **the API refuses to boot**, so set
the rest first. Details: [docs/compliance/STORE_BILLING.md](docs/compliance/STORE_BILLING.md).

| Variable | Format |
|---|---|
| `STORE_BILLING_ENABLED` | `true` to enable; anything else keeps it off |
| `STORE_BILLING_PRODUCTS` | JSON array of `{ "store": "apple"\|"google", "productId", "basePlanId" (Google only, required there), "tier" (not `free`), "billingCycle": "monthly"\|"yearly" }` |
| `STORE_RECEIPT_ENCRYPTION_KEY_BASE64` | 32 random bytes, base64; stable and backed up (losing it prevents receipt reconciliation) |
| `APPLE_IAP_ENVIRONMENT` | `production` or `sandbox` |
| `APPLE_IAP_PRIVATE_KEY_BASE64` | the App Store Connect API `.p8` key file, base64-encoded |
| `APPLE_IAP_KEY_ID` / `APPLE_IAP_ISSUER_ID` | key id / issuer UUID from App Store Connect |
| `APPLE_IAP_BUNDLE_ID` | iOS bundle identifier |
| `APPLE_IAP_APP_ID` | numeric Apple app id (required for `production`) |
| `APPLE_IAP_ROOT_CERTIFICATES_BASE64` | JSON array of base64-encoded Apple root certificates (DER) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | service-account JSON with `client_email` and `private_key` |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android package name |
| `GOOGLE_PLAY_ALLOW_TEST_PURCHASES` | `true` only for a controlled validation; otherwise unset/`false` |
| `GOOGLE_PLAY_RTDN_AUDIENCE` | `https://` audience of the authenticated Pub/Sub push subscription |
| `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT` | email of the Pub/Sub push service account |

### Creating the first admin

There is no self-service admin signup. Register a user through the app, then
promote it directly in Atlas:

```js
db.users.updateOne({ email: 'you@example.com' }, { $set: { role: 'admin' } })
```

### Site content (CMS) after a release

On its first boot the API fills an empty `sitecontents` collection from
`apps/api/src/infrastructure/database/siteContentDefaults.json`; after that
it never reseeds. On every boot it also replaces FAQ entries that still match,
word for word, an earlier default that has since been corrected (listed in
`apps/api/src/infrastructure/database/supersededFaqDefaults.ts`), and removes
the old trust-score entry. Entries an admin has edited are left alone.

After deploying a release that changes FAQ defaults:

1. Check the API log for `Replaced superseded default FAQ answers`. No
   message means nothing matched an earlier default.
2. Open `https://ujimora.com/help` and confirm it shows none of the claims in
   `FALSE_CLAIMS` in `apps/marketing/__tests__/publicClaims.test.ts` (for
   example a 24-48 hour review time, a one-time extension, editing a live
   campaign, or "reviews every campaign").
3. Any claim still shown is in an entry someone edited in the CMS. Correct it
   in the admin console under Content → FAQ (`/content/faq`), using the text in
   `siteContentDefaults.json`.

When you change a default FAQ answer, add its previous text to
`supersededFaqDefaults.ts` in the same change so existing deployments pick it
up.

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
not (and should not) list, so a preview built with the production value could
not reach the API from the browser. Vercel builds previews in production mode,
so they load `.env.production` too. The web app's `vite.config.ts` handles this
itself: when `VERCEL_ENV` is set to anything other than `production`, the build
uses the same-origin `/api/v1` rewrite instead, and `apps/web/turbo.json` puts
`VERCEL_ENV` in the build's cache key so a preview never reuses a production
build. No dashboard setting is needed. A `VITE_API_URL` set in a Vercel project
for an environment still overrides both, so make sure no **Production**-scoped
(or all-environments) `VITE_API_URL` is set there, or it will replace the direct
URL. The admin app does not have this switch yet: set `VITE_API_URL=/api/v1` for
its **Preview** environment in the Vercel project.

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

## 4. CI and deploy gating

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint, type-check,
unit tests (against a MongoDB service container), Playwright e2e (with the
real API booted), and builds — on every push/PR to `main`.

The API deploys with `autoDeployTrigger: checksPass`: Render deploys a push to
`main` only once that commit's GitHub checks pass. A failing (or flaky) run
holds the deploy — fix or re-run it, or use **Manual Deploy** for an urgent
fix. Vercel still deploys the frontends on every push.

Known gaps (owner decisions / dashboard settings):

- **No staging.** Vercel preview deployments use the same `vercel.json`
  rewrite to the production API. Confirm Vercel Deployment Protection
  (Standard) covers previews. Once a staging API and database exist, make the
  rewrites host-conditional so only the production hosts reach
  `api.ujimora.com`.
- **npm version on Vercel.** The `vercel.json` install commands run the
  build image's npm (10 on Node 22), not the `npm@12.0.2` pinned in
  `package.json`, CI and Render, so lockfile/override handling can drift
  (build reproducibility only — the Vite bundles ship no server packages).
  To align, set each project's install command to
  `cd ../.. && npx --yes npm@12.0.2 ci` (root project: `npx --yes npm@12.0.2 ci`)
  after confirming the project's Node version satisfies npm 12's engines
  (`^22.22.2 || ^24.15.0`), and check the build log shows npm 12 and the
  postinstall security patches running.

## Creator profile donations

Creator donations require an active paid subscription; Free and trial accounts cannot enable them or receive new tips. Withdrawals deduct the current effective plan’s platform-fee percentage, with the fee and net amount reviewed before confirmation. Existing balances remain withdrawable after downgrade. See [creator donation policy and API contract](docs/creator-donations.md). Deploy API and web together; no new credentials are required and `TIP_PLATFORM_FEE_PERCENT` is no longer used.
