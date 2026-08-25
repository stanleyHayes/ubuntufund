# Seamless Social & LIVE Fundraising — Extension

Server-side implementation of the portable fundraising layer described in
`Ubuntu_Fund_Seamless_Social_Live_Fundraising_Extension.docx`: universal campaign
links, dynamic QR, LIVE stream sessions with an OBS overlay, real-time donation
events, an immutable money ledger, guest checkout, and **Paystack** payments
(card + mobile money in GHS).

> **Scope of this work:** the backend (`apps/api` + `packages/types`) **and** the
> web UIs (`apps/web`) are built, wired, tested, and verified in-browser. New files
> were used throughout, with only surgical additive edits to the clean `router.tsx`
> and `CampaignDetailPage.tsx`, to avoid colliding with the concurrent design
> refresh. See [Web UIs](#web-uis-built) below.

Commits: `93d603b` (backend), `af9cd60` (OBS overlay page), `bdc3a9e` (web UIs +
overlay-URL/CSP fixes).

---

## Key decisions

| Area | Decision | Why |
|------|----------|-----|
| Payments | **Paystack** hosted checkout + signed webhook | Card + MoMo (MTN/Telecel/AT) in GHS; the `charge.success` webhook (HMAC-SHA512) is the **only** proof of payment — the browser callback is never trusted. |
| Real-time | **SSE** (Server-Sent Events) | Overlays/live totals are one-way server→client; SSE needs no WebSocket infra and rides the existing Express server. |
| Money integrity | **Immutable double-entry ledger + transactional outbox** | Totals are projected from posted ledger lines; the outbox guarantees realtime/receipt side-effects survive a crash. |
| Identity of links | Stable **`/r/:code` short-links** + `qrcode` lib | QR destinations can change without reprinting; scans are counted/attributed. |
| URLs | **Domain-agnostic** via `PUBLIC_WEB_URL` / `PUBLIC_API_URL` | Works today on localhost, swaps to the real domain by changing one env var. |
| Checkout | **Guest-first** (`POST /donation-intents`, no auth) | Donors need only an email for a receipt; the authenticated wallet rail still works. |

---

## Environment

Added to `apps/api/.env.example` (secrets stay in the gitignored `.env`):

| Var | Purpose |
|-----|---------|
| `PUBLIC_WEB_URL` | Canonical web base for campaign/live links, QR targets, and the Paystack `callback_url`. e.g. `https://app.example.com`. |
| `PUBLIC_API_URL` | Base the QR image encodes (`${PUBLIC_API_URL}/r/:code`). Defaults to `http://localhost:<PORT>`. |
| `PAYSTACK_SECRET_KEY` | **Server-only.** When absent, the Paystack rail is disabled — `POST /donation-intents {provider:'paystack'}` returns `501 "Payments are not configured"` and the **wallet rail keeps working**. Paste a `sk_test_…` key to run in test mode. |
| `PAYSTACK_PUBLIC_KEY` | Client-usable publishable key (`pk_test_…`). |
| `PLATFORM_FEE_PERCENT` / `PAYSTACK_FEE_PERCENT` / `PAYSTACK_FLAT_FEE` | Fee policy for the ledger split. Default `0`. Paystack's real processor fee is taken from the webhook at settlement. |

### ⚠️ Operational note — `.env` drift (needs a durable fix)

`apps/api/.env` currently points at a **deleted Atlas cluster**
(`ubuntufund.jqnyj9q…mongodb.net` → `ENOTFOUND`) and sets `PORT=8100`, but the
working dev setup is **local mongod on `28017`** and the web frontend proxies to
**`:18100`** (`apps/web/.env` → `API_PROXY_TARGET`). The dev API is currently
running via a runtime override:

```bash
cd apps/api
PORT=18100 MONGODB_URI=mongodb://127.0.0.1:28017/ubuntu-fund npm run dev
```

To make this durable, update `apps/api/.env`: set `PORT=18100` and
`MONGODB_URI=mongodb://127.0.0.1:28017/ubuntu-fund` (the old Atlas value can be
kept as a comment). `dotenv` does not override pre-set process env vars, so the
command above is safe and does not modify `.env`.

---

## New API endpoints

### Entry — vanity slugs, short-links, dynamic QR
| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/v1/campaigns/slug/:slug/public` | public | Public campaign DTO + `socialPreview` (title, summary, image, canonical URL). |
| `PATCH /api/v1/campaigns/:id/slug` | owner/admin | Set a custom slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–60, denylist, unique). |
| `POST /api/v1/campaigns/:id/qr-codes` | owner/admin | Body `{ kind: 'campaign'\|'live'\|'amount'\|'creator'\|'event', presetAmount?, label?, liveSessionId? }` → `{ code, shortUrl, target, pngDataUrl, svg }`. |
| `GET /api/v1/campaigns/:id/qr-codes` | owner/admin | List the campaign's short-links. |
| `GET /r/:code` | public | 302 → resolved target; records a coarse scan + forwards UTM params. |
| `GET /qr/:code.svg` · `GET /qr/:code.png` | public | Renders the QR for the short-link. |

Slugs auto-generate from the title on campaign create. Existing (pre-feature)
campaigns have no slug — QR/short-links fall back to the campaign **id**, so they
still work; only the pretty `/c/:slug` URL needs a backfill (see follow-ups).

### LIVE sessions & real-time (SSE)
| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/v1/campaigns/:id/live-sessions` | owner | Start a session; mints a revocable `overlayToken`. |
| `PATCH /api/v1/live-sessions/:id` | owner | `{status:'ended'}` to end, else update privacy toggles. |
| `POST /api/v1/live-sessions/:id/overlay-token/rotate` | owner | Revoke + reissue the overlay token. |
| `GET /api/v1/live-sessions/:id/public` | public | Donor-facing session sheet. |
| `GET /api/v1/live-sessions/:id/overlay?token=…` | token | Overlay JSON (config, totals, recent donors, goal). |
| `GET /api/v1/live-sessions/:id/overlay/view?token=…` | token | **OBS browser-source page** (see below). |
| `GET /api/v1/campaigns/:id/events` | public | SSE feed for the whole campaign. |
| `GET /api/v1/live-sessions/:id/events?token=…` | token | SSE feed for the session (privacy-filtered). |

SSE frames: `donation`, `total`, `milestone` (25/50/75/100%), `alert`; monotonic
`id:` for `Last-Event-ID` resume; 20s heartbeat. Existing **wallet** donations
already publish these events, so overlays work today.

### Donations, ledger & Paystack
| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/v1/donation-intents` | public (guest) | Create an intent. `provider:'wallet'`+authed settles synchronously; `provider:'paystack'` returns `{ intent, authorization_url, access_code, reference }` (email required). Idempotent via `Idempotency-Key`. |
| `POST /api/v1/donation-intents/:id/payment-attempts` | public | Advance `CREATED→PENDING`. |
| `GET /api/v1/donation-intents/:id/public` | public | Status polling (no PII). |
| `POST /api/v1/donations/:id/message` | donor | Add/edit a public donation message (respects anonymity). |
| `POST /api/v1/webhooks/paystack` | signature | **Raw body**, `x-paystack-signature` = HMAC-SHA512. `charge.success` → settle (ledger + projections + realtime + receipt), idempotent on `reference`. |

Intent lifecycle: `CREATED → PENDING → SUCCEEDED | FAILED | EXPIRED` (terminal).

---

## OBS overlay page

`GET /api/v1/live-sessions/:id/overlay/view?token=…` serves a **self-contained
HTML page** the host pastes into OBS as a *Browser Source*. It reads its token
from the query string, pulls initial state from the overlay JSON, and streams
live events over SSE. Transparent background, animated goal bar, donation alerts,
milestone celebrations; honors `prefers-reduced-motion`. Fully static (no
server-side templating → no injection surface); donor text renders via
`textContent`.

---

## Payment flow (guest, Paystack)

```
Donor → POST /donation-intents {provider:'paystack', email, amount, tip?, campaignId, liveSessionId?}
      → API initializes Paystack, returns authorization_url  (intent: PENDING)
Donor → hosted Paystack checkout (card / MoMo) → redirect to PUBLIC_WEB_URL/donate/callback
Paystack → POST /webhooks/paystack (charge.success, HMAC-SHA512)   ← the only proof of payment
      → SettleDonationUseCase: intent SUCCEEDED (idempotent) → immutable ledger journal
        → campaign total + CampaignBalance projected → outbox → SSE (donation/total/milestone) + receipt
```

---

## Web UIs (built)

All in `apps/web` (commit `bdc3a9e`), verified in-browser. Client: `src/lib/fundraising.ts`.

1. **Public campaign landing** — `/c/:slug` (`CampaignPublicPage`) — QR/social entry
   point: hero, goal bar, "Donate now".
2. **Guest donate page** — `/c/:slug/donate` (`DonatePage`, honors `?amount=`) —
   amount presets + tip + email + message + anonymity, accepted-methods strip,
   `POST /donation-intents` (paystack) → redirect to `authorization_url`; a clean
   "payments not enabled yet" notice on a 501.
3. **Donate callback** — `/donate/callback` (`DonateCallbackPage`) — polls
   `GET /donation-intents/:id/public` for `SUCCEEDED` (webhook is the truth; the
   redirect is never treated as success).
4. **Creator LIVE control room** — `/campaigns/:id/live` (`CampaignLivePage`,
   owner-only) — start/end session, live totals over SSE (`useLiveTotals`), OBS
   overlay link + rotate token (`OverlayLinkCard`), dynamic QR manager
   (`QrCodeManager`), live donor-privacy toggles, donor feed. Reached via a
   **"Go LIVE"** button on the owner's campaign detail page.

Two fixes surfaced by previewing the running app (both in `bdc3a9e`): `overlayViewUrl`
now returns an **absolute** URL (a relative one is unusable in OBS), and the overlay
route sets a **route-scoped CSP** so its inline script/style + web font run (helmet's
global `script-src 'self'` had blocked the whole overlay).

---

## Follow-ups / not done

- **Payout/clearing** (`pending → available → paidOut`): settled beneficiary-net
  currently accrues in `CampaignBalance.pendingBalance`.
- **Attribution reporting** endpoint over the recorded scan log.
- **Multi-instance SSE**: the EventBus is single-process; a horizontal deploy
  needs a shared broker (e.g. Redis pub/sub) behind the same interface.
- Durable `.env` fix (see operational note).

---

## Testing

`cd apps/api && npx tsc --noEmit` is clean (src + tests). `npm test` is
**161/162**; the single failure is a **pre-existing, non-deterministic cross-file
flake** (it moves between files across runs and every affected file passes in
isolation — the vitest config documents the shared-process caveat). New coverage:
short-links (15), live-sessions (8), realtime-SSE (4), donation-intents (6),
Paystack (8), EventBus + domain units.
