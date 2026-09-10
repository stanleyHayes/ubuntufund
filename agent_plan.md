# Ujimora Monorepo — Production Completion Ledger

### 2026-09-10 — Owner donation notifications and campaign cashout audit

- Wired settled gifts to a deduplicated owner inbox and optional Resend email, honoring email/campaign-update preferences and anonymous donor privacy. Added independent minute-based outbox retry and the web Dashboard inbox.
- Added owner-only payout options and a web campaign cashout panel with bank/MoMo recipient setup, configured fee preview, request submission and payout history. Request remains distinct from admin approval/transfer.
- Fixed ambiguous Paystack transfer errors releasing potentially sent funds on campaign/beneficiary/affiliate rails; single and batched reservations now remain held for reference-based reconciliation. Creator rail already preserved ambiguous attempts.
- Verified Resend's ujimora.com domain status and Paystack test balance through read-only provider calls. No money moved or historical emails sent. API runtime email variables and actual mailbox delivery still require deployment validation.
- 39 focused API tests and 3 owner-screen tests pass; API/web type-check, focused lint, and desktop/mobile mocked browser checks pass. See docs/paystack-owner-notifications-and-cashout.md for operational steps and the open standard/early-withdrawal policy decision. Prior card redesign remains a separate local preview.


### 2026-09-10 — Leaderboard guest aggregation and refresh repair

- Reproduced production leaderboard returning 400 Invalid ID format while stats reported two confirmed guest gifts totaling GHS 4,200. Filter invalid/sentinel IDs before Mongo user lookups in rankings and category stats; featured rankings use the same repaired repository.
- Guest amounts/counts remain in Everyone totals, but the shared guest sentinel no longer counts as one registered person. Existing individual/organization ranking eligibility remains unchanged. Historical guest gifts are not reassigned to accounts.
- Web now shows totals even when rankings are empty, explains guest eligibility, surfaces loading failures with Retry, and refreshes every 30 seconds and on focus/visibility return. Fixed a loading-timer race exposed by the hook tests.
- Validation: four repository regressions and three hook tests pass; API/web type checks and targeted lint pass. Browser checks verified GHS 4,200 with empty rankings and the failure/retry state. Existing unrelated CampaignLivePage CI failure remains outside this change.


### 2026-09-10 — Donation return celebration

- Confirmed donations now celebrate with gold/sage confetti and small heart particles following gravity, drag, spin and flutter, plus a damped-spring success medallion and warmer thank-you copy. A Celebrate again action replays decoration without calling payment verification or creating a charge.
- Motion mounts only after SUCCEEDED. Desktop uses 68 particles, mobile 44; bursts finish within about four seconds. Animations cancel and particles clear on unmount, hidden tabs, or switching to reduced motion. Reduced-motion users receive a static confirmation with no replay control.
- Four callback tests pass, including success-only particle mounting and replay not re-verifying payment. Web type-check, focused lint and production build pass. Browser checks confirmed desktop/mobile particle counts, zero particles with reduced motion (including on load), and automatic cleanup after completion. No new animation dependency.

### 2026-09-10 — Guest donation feed repair

- Reproduced the deployed campaign Donations tab returning `400 Invalid ID format` after a guest contribution settled. Its sentinel donor ID (`guest`) was passed to the MongoDB user lookup.
- Shared the existing guest ID constant with campaign/recent donation feeds, live overlay reads, and realtime projection. Guest entries skip account lookup and display Guest donor; anonymous entries retain their privacy behavior. Registered donor names/avatars still resolve normally. No donation amounts or settlement records are changed.
- Regression coverage exercises guest/anonymous campaign lists, registered donors, recent activity, overlay privacy, and realtime publication. All 27 focused tests (9 new feed tests plus 18 payment-verification regressions), API type-check, targeted ESLint and diff checks pass. Existing full CI has an unrelated CampaignLivePage test expecting a Go LIVE button; this change does not claim that full suite is green.

### 2026-09-10 — Hosted donation callback verification

- Fixed a confirmed test-payment incident: Paystack reported a successful GHS 250 charge (GHS 200 donation + GHS 50 tip), while the public intent remained PENDING. The callback only polled stored status, so a missed webhook could not recover during the return flow.
- Added rate-limited public `POST /donation-intents/:id/verify`, bound to the stored payment reference. It verifies with server-side provider credentials and reuses existing reconciliation and exactly-once settlement. Amount, currency, reference, fee validity, and terminal-state guards remain enforced; donor PII is excluded.
- Web callback requests verification on return and periodically during polling. An unmatched reference no longer falls back to a different last checkout. Timeout copy now describes the actual unconfirmed state and invites secure rechecking.
- Validation: 18 API tests (including real reconciliation/settlement use cases and guest HTTP routing), 4 callback component tests, API/web type checks, targeted ESLint, web production build, and diff checks passed.
- Published `4a96767`; Vercel web and Render API deployments succeeded. Production verification of the reported reference returned SUCCEEDED at 09:19 UTC, recovering the existing GHS 200 donation plus GHS 50 tip without creating another charge.
- CI's default npm version rejected the existing npm-11 workspace lockfile before reaching checks. Pinned CI to the repository's declared npm 11.12.1; a clean-install dry run with that exact version passes. No dependency versions or lockfile were changed.

> Active completion pass started: 2026-08-09
> Goal: production-complete web, mobile, API, marketing, admin, and organization experiences with App Store readiness, CMS-backed public content, soft deletion, and verified frontend/backend parity.

## Native chip and button material styling — 2026-09-09

- Shared chips now apply the active subtle surface recipe and material-specific corners while retaining semantic urgency colors. Shared buttons apply raised/inset recipes, selected material corners, readable foregrounds and pressed states; loading dots and accessibility state are preserved. Remaining direct Paper Button imports were migrated to the shared control.
- Verified campaign chips and Donate/Share surfaces in the running simulator. Mobile TypeScript, lint and 21 logic tests passed. Included in the mobile polish release.

## Native campaign actions and chip rendering — 2026-09-09

- Removed the Donate button’s extra bottom margin that stretched Share; both actions now have matching content height and rounded clipping, with normal spacing before the remaining-goal text.
- Audited mobile chips and custom badges. Replaced Paper informational chips across campaign details/cards/updates, beneficiaries, organization categories, public profiles and creator payout status with a shared text-sized component. Removed fixed 24/28px heights, normalized label spacing and allowed long labels to wrap. Custom padding-based badges did not have the fixed-height problem.
- Beneficiary chip visually checked in the signed-in simulator; mobile TypeScript and lint passed. Included in the mobile polish release.

## Native input appearance correction — 2026-09-09

- Removed Paper’s default purple surfaceVariant from light/dark themes. Shared inputs now use the selected material’s inset recipe, rounded shape, brand text/icons and full focus/error border rather than the stock underline. Subscription coupon input also uses this component.
- Mobile TypeScript and lint passed; the simulator profile editor visibly renders warm inset fields instead of purple fills. Included in the mobile polish release.

## Native profile editor refinement — 2026-09-09

- Replaced separate image-upload cards with one appearance-aware cover/avatar/name preview matching the profile composition. Cover fills its frame; the profile photo is circular and overlaps the cover.
- Compact, labeled change/camera/remove controls retain existing upload, crop, error and save guards. Identity fields remain below in About you. Verified real images and controls in the signed-in iOS simulator; mobile TypeScript and lint passed. Included in the mobile polish release.

## Native profile header refinement — 2026-09-09

- Joined the cover and avatar with a 52px overlap and theme-colored photo border; removed the duplicate safe-area gap, added a rounded cover and separate settings/header row, and linked Edit images directly to profile editing.
- Identity and statistics now use readable appearance colors. The cover edit control stays above the avatar on narrow screens. Verified the actual cover/profile photos in the signed-in iOS simulator; mobile TypeScript and lint passed. Included in the mobile polish release.

## Admin settings mobile table — 2026-09-09

- Fixed horizontal scrolling for the subscription-tier fee table, constrained it to the phone viewport, added a mobile swipe hint and keyboard-focusable named region. Read-only viewers can scroll the informational table.
- Verification: admin TypeScript, lint, 15 tests and production build passed. Chromium checks at 390px confirmed no page overflow, keyboard scrolling and the Price column fully reachable for editable and read-only roles (mocked API permissions).
- Published together with the accumulated native parity and shared legal-page work; physical-device/provider acceptance limitations remain recorded below.

## Active goal: native mobile feature and design parity — 2026-09-09

Owner: Codex. Status: engineering parity pass complete locally; physical-device/provider acceptance remains external. Scope: current web user-facing capabilities and native design equivalents, with provider/device acceptance tracked separately.

| Work | Status | Acceptance |
|---|---|---|
| KYC, uploads, address/GPS | ENGINEERING IMPLEMENTED | Actual entered data/uploads reach API; validation, retry and branded selection |
| Session refresh/inactivity | ENGINEERING IMPLEMENTED | Single-flight refresh, transient-error preservation, idle expiry, late-refresh guards |
| Payment checkout/crypto and wallet funding | ENGINEERING IMPLEMENTED | Real API contracts, idempotency, provider-confirmed status |
| Campaign creation, media, AI and management | ENGINEERING IMPLEMENTED | Live limits, upload/crop, preview/apply AI, validation |
| Profiles, organizations and creator flows | ENGINEERING IMPLEMENTED | Native image/cover editing, owner authorization, paid policy |
| Live host/viewer | ENGINEERING IMPLEMENTED | Native transport, permissions, recovery, donation attribution |
| Navigation, loading, skins and accessibility | ENGINEERING IMPLEMENTED | Matching destinations, skeletons/dots, branded surfaces/watermarks |
| Legal pages and policy collection | ENGINEERING IMPLEMENTED | Shared eight-policy source, native offline pages, web redesign/recovery; web browser and native simulator policy checks pass |
| Remaining routes and final verification | ENGINEERING VERIFIED; EXTERNAL ACCEPTANCE OPEN | Route/contract inventory, tests and native bundle/runtime review |

Current evidence: mobile TypeScript and lint pass; 21 native logic tests pass. iOS, Android and Expo web Metro exports pass. The ReplayKit broadcast extension compiles for the simulator. Web legal checks: 40 unit tests and three browser scenarios pass (all eight policies, phone layout/anchors, four skins in both modes). Full iOS simulator build and installation passed with ad-hoc signing. Public home loads real API data. Legal hub, all eight direct policy links, section jumps and light/dark reading layouts passed native walkthrough. Signed-in checks passed for profile, wallet funding entry, subscription selection/keyboard layout, KYC validation and nationality selection, paid creator restrictions, and owner live studio. Campaign creation correctly enforces the account’s full active-campaign allowance. All four appearances were checked; original preferences were restored. No provider transaction or live broadcast was initiated. Expo Doctor passes 19/20 checks, with remaining SDK patch/navigation-version advisories documented in the report; the actual dependency graph is valid. Implementation details: `docs/reviews/mobile-parity-implementation-2026-09-09.md`. Connected iPhone is paired; Xcode Personal Team is signed in but has no valid signing identity and Xcode explicitly cannot provision the app because Personal Teams do not support its Push Notifications capability. This is not physical-device acceptance.

Maintain evidence here as each slice completes. Physical device/provider acceptance is distinct from engineering completion.

## Native mobile parity audit — 2026-09-09

- Published the completed pricing/paid-creator slice to main (`4e3ddad`), verified remote SHA.
- Audited native routes, payment/API clients, KYC state flow, profile/media, theme/nav, loading and session handling. Native is not at feature/design parity with web. Critical finding: native KYC posts placeholder information instead of step input.
- Fixed native creator compatibility with the new fee consent contract, paid-plan upgrade/disabled states, fee/net history and default public URL. Corrected the earlier mistaken “no native creator UI” documentation.
- Validation: mobile TypeScript and lint passed; the five existing native logic tests passed (these do not exercise creator UI).
- Remaining gaps and prioritized completion work: `docs/reviews/mobile-web-parity-2026-09-09.md`. This is a source audit, not physical-device visual or provider acceptance.

## Pricing and creator donation review — 2026-09-09

- ✅ Public pricing now reads active/public live plans from `/plans/public`; creation and marketing share plan data. Account-specific compliance caps are explained and preserved. Integration tests cover Free GHS 10,000 and a separate GHS 5,000 cap.
- Reviewed creator tip checkout, settlement and withdrawal: 10 targeted integration tests passed. Not launch-complete: missing `/tip/callback`, input/amount/currency validation gaps, and payout verification remain. Ambiguous-transfer handling is fixed by the paid-creator follow-up. Details: `docs/reviews/pricing-and-creator-donations-2026-09-09.md`.
- Production database access was unavailable; no production plan or compliance value was changed. Published to main in `4e3ddad`.

## Paid creator donations and plan withdrawal fees — 2026-09-09

- ✅ API and web restrict creator setup/new tips to active, unexpired paid plans. Free/trial/expired profiles cannot receive new tips; existing funds remain withdrawable.
- ✅ Creator withdrawals quote the current plan platform-fee percentage, require confirmation of that rate, persist gross/fee/net and send the net amount. Settlement and reversal use the immutable payout fee snapshot; ambiguous transfer errors keep funds reserved for reconciliation.
- ✅ Pricing, features, marketing/member/mobile terms, deployment guide, feature parity and fundraising docs reflect the policy. Canonical contract: `docs/creator-donations.md`.
- Verification: 15 targeted API integration tests, two browser regressions and 39 web tests passed. API/web/marketing/mobile type checks, API/web/marketing lint and web/marketing builds passed (existing bundle-size advisories). Paystack is mocked and MongoDB local. Separate creator launch gaps remain recorded in the pricing review; no live-money acceptance claimed. Published to main in `4e3ddad`.

## Browser session persistence — 2026-09-09

- ✅ Member web and admin automatically renew the 15-minute access token while the browser session is active. A separate one-hour inactivity timeout tracks pointer, keyboard, touch and scroll activity across tabs; background API polling and renewal do not extend it. The persisted timestamp also expires sessions after sleep/reopening.
- ✅ Requests renew near-expiry tokens before sending, concurrent renewals share a request, temporary provider/network failures preserve local login, and revoked refresh tokens still sign out. Late renewals cannot resurrect a signed-out session or overwrite a newer login. Backend token lifetimes remain unchanged; no Render variables are needed.
- Verification: web 39 tests, admin 15 tests, existing session-expiry node tests 4; web/admin/UI type checks and lints; web/admin builds; unused-code audit. Browser inactivity is a client session policy, not server-side refresh-token revocation.

## Verified unfinished-feature audit — 2026-09-09

- ✅ Built real AI campaign writing and admin usage tracking, request quotas, preview/apply protection, and Render configuration. Live OpenAI activation awaits the server-side key and deployment smoke check.
- ✅ Removed mock RBAC editing/invitation forms; retained canonical read-only roles and working authorization. Published affiliate marketing route/navigation/sitemap in source.
- ✅ Removed verified dead modules/dependencies and cleaned unused exports/types; `npm run lint:unused` is clean with explicit tooling/runtime exceptions.
- ✅ Verified workspace type checks/lints and four app builds; web 32, admin 15, mobile 5 tests passed. API 376/379 initially passed, then all 14 affected live/wallet/AI integration tests passed on an isolated replica set after fixing live-session index readiness. AI provider/quota tests: 9 passed.
- Evidence and corrected audit claims: `docs/reviews/unfinished-features-audit-2026-09-09.md`. Activation: `docs/ai-writing.md`. Changes are local; no production provider generation or deployment claimed.

## African Feature Roadmap — GOAL: build all of the below

> Added 2026-09-05 from the crowdfunding-landscape research verdict (survey of Kickstarter/Indiegogo/GoFundMe/Patreon/Kiva/M-Changa/LaunchGood + African payments, diaspora, trust, and community-finance context).
>
> **The frame:** global leaders (GoFundMe, Kickstarter, Patreon) *structurally cannot pay Africans* — the real competitors are M-Changa, LaunchGood, and diaspora rails (LemFi/NALA). Ujimora already holds the hard primitives: Paystack mobile-money + card, a double-entry ledger, Paystack Transfers payouts, LIVE rooms, plans/tiers, and (in progress) coupons + affiliate. The white space no competitor occupies is **trusted + diaspora + mobile-money-native + African community/faith finance, fused**.
>
> **GOAL: complete every feature in this roadmap.** Status legend: ◻ planned · 🔄 in progress · ✅ done. Each row keeps a dated note as it moves.

### Foundation — monetization rail (in progress)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F1 | Paid-subscription Paystack checkout rail (`SubscriptionCheckout` intent, webhook-settled) | 🔄 | Prereq for coupons + affiliate; paid tiers previously hard-threw 409. Types done; backend building (`wf coupons-affiliate-backend`). |
| F2 | Coupons — discount codes at paid-subscription checkout (percent/fixed, limits, validity, plan scope, admin CRUD) | 🔄 | Types done; backend building. $0-coupon activates without charge. |
| F3 | Affiliate / referral program — one-time commission (10% default), hold window + refund clawback, payouts via Paystack Transfers, user dashboard + admin management | 🔄 | Types done (held→available→paid/reversed); backend building. |

### P0 — flagship differentiators (highest leverage)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P0.1 | **Milestone-gated escrow + proof-of-impact + public per-campaign ledger** — hold funds, release tranches only against verified proof (invoice/receipt/geotagged photo), auto-deliver donor impact statements | ◻ | Turns the #1 barrier (distrust) into the product. Direct extension of the existing double-entry ledger + Transfers. THE headline differentiator. |
| P0.2 | **USSD / feature-phone donate-to-shortcode** (`*XXX*campaignID#`) + SMS/WhatsApp receipts + agent cash-in | ◻ | USSD carries ~63.5% of MoMo volume on 2G; zero global crowdfunders offer it. Uncopyable access moat. |
| P0.3 | **Diaspora lane** — multi-currency in → local-currency out, transparent beneficiary-net FX shown pre-confirm, and pay a school/hospital/named vendor **directly** (not cash to an organizer) | ◻ | Owns the corridor GoFundMe abandons; converts the $100B+/yr remittance habit into purpose-locked giving. |
| P0.4 | **Ujimora trust score / alternative credit identity** derived from on-platform ledger behavior (susu contributions, repayments, payout history) | ◻ | Most defensible long-term moat (Esusu's insight for African informal finance). Pure derivative of the ledger + KYC; feeds the microloan/RBF layer. |

### P1 — high value

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P1.1 | **Digital susu/esusu/ajo/chama/stokvel circles** — audited per-member ledger, multi-signatory payouts, automated reminders, cross-border diaspora slots | ◻ | Up to ~95% of adults use informal circles; no interoperable player exists. Treat pooling as a regulated product (Bank of Ghana). |
| P1.2 | **Community vouching + multi-treasurer withdrawal approval** — named vouchers (pastor/chief/elder) co-sign; up to 3 treasurers approve each withdrawal via SMS/USSD | ◻ | Digitizes offline accountability; M-Changa-proven anti-diversion control. Extends the review workflow + gates the payout step. |
| P1.3 | **Life-event campaign templates** — funerals, weddings, school fees, medical, naming/outdooring, harvest/tithe, diaspora family fund | ◻ | Matches the occasions that actually drive African volume. Config over the existing campaign engine. |
| P1.4 | **Recurring mobile-money memberships** (Patreon-style creator→fan) + **faith module** (MoMo tithe/offering/harvest, Zakat-verified badge) with church/mosque admin dashboard | ◻ | The "Patreon Africa can't have." Reuses the existing plans/tiers/feature-gate infrastructure + Paystack recurring MoMo + LIVE gating. |
| P1.5 | **Failure-resilient payments** — smart retry + channel fallback (card fails → USSD/bank/MoMo) + explicit recovery flow | ◻ | Recovers 30–60% of checkout leakage. Enhancement to the existing Paystack integration. Quick revenue protection. |

### P2 — medium / regulated (later phases)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P2.1 | Per-campaign funding model choice (all-or-nothing vs keep-it-all) + **digital-first reward tiers** (shoutouts, LIVE access, airtime/data, local pickup) | ◻ | Ledger supports authorize-at-pledge/capture-on-success. Default rewards digital to sidestep the international-shipping trap. |
| P2.2 | **Ujimora Giving Guarantee reserve** — first African donor money-back guarantee, funded from a fee slice | ◻ | Sequence AFTER escrow + proof-of-impact (verification makes claims cheap to honor). |
| P2.3 | **Community microloan + revenue-based-financing (RBF) layer** for cash-flow SMEs; joint-liability group loans; nominee/SPV for many small diaspora backers | ◻ | Lead with RBF over equity. Underwrite from ledger history (the trust score). Regulated: sequence country-by-country (BoG/SEC, Kenya CMA, Nigeria SEC, SA FSCA). |

> **Top-3 to start with** (per the research verdict): **P0.1 the trust/escrow stack**, **P0.3 the diaspora corridor**, **P0.2 USSD access** — after the F1–F3 monetization rail lands. Keep fees transparent and well below the 8–12% Western norm, with no micro-pledge surcharges.

## UX, Theming & Admin Polish — GOAL: fix all + ship multi-theme

- ✅ 2026-09-08 — Crypto UI redesign (web/admin/marketing): web Choose/Review/Transfer flow with explicit network/tag, fees, stale-quote prevention and confirmation; admin provider-backed availability and reconciliation in Payment Providers; new `/crypto` marketing guide and discoverability. Updated public crypto legal disclosures and audited Word draft pack in `docs/reviews/crypto-ui-and-legal-review-2026-09-08.md`. Three app type-check/lint/build checks passed; mocked Playwright mobile/desktop contribution and disabled-gate tests passed (3/3); mocked admin reconciliation and marketing FAQ/mobile overflow checks passed. Screenshots reviewed. No real-money transfer, production provider approval or legal sign-off claimed.

- ✅ 2026-09-08 — Client web mobile bottom navigation: floating glass pill with translucent forest tint, backdrop blur, glossy highlights, rounded ends, a soft shadow, 12px edge spacing, and five persistent tabs (Home, Explore, Start, Dashboard, Profile), centered gold campaign action, active pills, safe-area support, and content/notification clearance. Bottom clearance lives inside the footer so its background continues behind the floating pill; browser assertions cover footer extent and text clearance. Desktop navigation retained. Verified web type-check, lint, and Playwright navigation at 390px/320px and desktop hiding at 1280px. Local API was unavailable during the browser check; authenticated campaign submission was not exercised.

> Added 2026-09-05. Consolidates a run of QA + design requests. ◻ planned · 🔄 in progress · ✅ done.

### Multi-theme design system (web + admin)
- ◻ Selectable "skins": **Neumorphism** (current default) · **Claymorphism** · **Glassmorphism** · plus **Dark** mode. Approach: swap the shared surface/`--neu-*` CSS-var token sets per skin so existing components adopt each look without rewrites.
- ◻ Theme context + persistence (localStorage, later user preference via API) + a Settings picker in BOTH web and admin.

### Loading standards (site-wide: web + admin + marketing)
- ◻ Page/section loads use **skeletons**; buttons use **animated dots** only. Sweep + standardize everywhere.

### Admin dashboard polish
- ✅ Settings route 404 — added `/settings` route (page existed, wasn't routed).
- ◻ User-menu dropdown: descriptions under Profile & Settings.
- ◻ Unify the 404 (`NotFoundPage`) and Access-Denied (`PermissionDenied`) into one branded light design.
- ◻ Recommended empty states — use the shared `EmptyState` component across admin pages (KYC, etc.).
- ◻ Permission: platform owner (admin@ujimora.com) is locked out of `/roles` (the Admin role excludes `roles` by design) — give the owner super-admin (full) access.
- ◻ AI Usage page error — its stats/log endpoints 404 on the backend; implement them or degrade gracefully.

### Registration & campaigns
- ✅ Organization signup wired into the web register form (reads `?role=organization`, org fields + validation).
- ◻ Make the (now longer) organization registration form **stepwise**.
- ✅ Campaign create 400 fixed (endDate → ISO datetime); cover image now persists (`imageUrls` wired through use-case + schema).

### Foundation (earlier) — pending lock-in
- 🔄 F1–F3 (coupons, affiliate, paid subscriptions) built + verified end-to-end; **pending tests + commit**.

## Active workstream

| Workstream | Status | Acceptance evidence |
|---|---|---|
| Current-state reconciliation | COMPLETE | Repository TODO/mock/API/route/mobile-config audit plus fresh workspace checks |
| Soft-delete policy | COMPLETE | User, campaign, update, comment, and organization deletion paths preserve records and ordinary reads exclude deleted entities |
| Backend contracts and frontend wiring | COMPLETE | Routed admin, client, organization, marketing, and mobile workflows use real API contracts with explicit loading/empty/error behavior; unsupported financial rails remain deliberately disabled |
| Dashboard completion | COMPLETE | Admin, individual client, and organization routes use real role-correct contracts; unsupported operator controls were removed rather than simulated |
| Web/mobile parity | IN PROGRESS | `FEATURE_PARITY.md` maps shared capabilities and launch boundaries; physical-device parity smoke testing remains |
| iOS/App Store readiness | BLOCKED — OWNER GATES | Repository metadata, privacy behavior, secure tokens, account deletion, icons, build config, and release checklist are complete; signed EAS/TestFlight builds, final identity/domain, store declarations, screenshots, and physical-device review require owner credentials and decisions |
| CMS expansion | COMPLETE | Public content blocks plus published testimonials are API/CMS-backed with safe runtime fallbacks and protected administration |
| UI/mobile polish | IN PROGRESS | Responsive layouts and shared mobile/web capability paths are implemented; physical phone/tablet accessibility and visual smoke testing remains owner/device-controlled |
| Full review and release gate | IN PROGRESS | Automated lint, type-check, tests, builds, dependency review, and Expo checks pass; signed-build and deployed end-to-end smoke tests remain owner-controlled |
| Naming/domain options | COMPLETE | `PRODUCT_NAMING.md` records collision evidence, positioning, pronunciation, domain strategies, and finalists |

### 2026-09-05 Trust and Safety surface consistency

- Disputes, Verifications, and KYC Review now use the shared admin background, raised queue/filter/loading cards, inset status/risk badges and icon wells, and matching pagination. Removed the page-specific blue-black backgrounds and card border grids.
- KYC detail dialog now uses raised information sections, inset document/notes surfaces, theme text colors, and wrapping responsive actions. KYC cards support keyboard opening. Request failures and loading stats/counts have distinct visible states; empty KYC queues have a message.
- Kept review permissions and decision handlers unchanged. Verification/KYC pagination uses the existing shared hook and neumorphic pagination component.
- Verification: admin TypeScript, targeted ESLint, production build, five existing pagination tests, and diff whitespace checks pass. Existing build chunk-size advisory remains. Browser visual verification remains outstanding.

### 2026-09-05 Community page surface consistency

- Campaigns, Users, Donations, and Subscriptions now use the shared admin background, raised cards/filter bars/loading surfaces, inset badges/detail wells/progress tracks, and consistent spacing. Shared styles live in `apps/admin/src/lib/surfaces.ts`.
- Enabled matching pagination styling for these four pages; retained page-size choices including the current 9/10-item defaults and added keyboard/accessible names to navigation controls. Campaign/user cards support Enter navigation; campaign tabs support keyboard activation.
- Subscription metrics show loading skeletons; subscription dates accept serialized API dates. List counts distinguish loading and unavailable data, and campaign/user/donation request errors are visible.
- Verification: admin TypeScript, targeted ESLint, production build, five existing pagination tests, and diff whitespace checks pass. The build retains the existing bundle-size advisory. Rendered browser verification was not completed for these four routes.

### 2026-09-05 Reports and Audit Log surface consistency

- Reports: replaced the blue-black canvas and border grid with the admin background, shared raised panels, inset geographic table/status tracks, and brand-colored charts. Header metrics and loading placeholders retain the same surface treatment; empty/error states distinguish unavailable reports from zero activity.
- Audit Log: applied raised entry/filter/pagination surfaces, inset search/action badges, visible severity labels, wrapped detail text, and compact accessible pagination. Preserved API search, page size, and request cancellation.
- Verification: admin TypeScript, targeted ESLint, production build, and diff whitespace checks pass; existing bundle-size advisory remains. Browser review could not be completed because the active admin tab kept changing routes during inspection; tab control was released.

### 2026-09-05 Dashboard surface consistency

- COMPLETE: Dashboard now inherits the admin background and uses shared raised/inset shadow tokens and diamond-cut shapes for every section tile and all seven summary cards. Removed the hard-coded blue-black canvas, border grid, generated sparklines, and arbitrary stat-fill graphics.
- Preserved permission-filtered section destinations and API totals; section tiles are keyboard-accessible links. Added stat skeletons, separate platform/KYC failure feedback, and unavailable markers instead of zero totals on failed requests.
- Verification: admin TypeScript, targeted Dashboard ESLint, production build, and diff whitespace checks pass. Build retains the existing large-chunk advisory. Live Dashboard DOM confirmed platform totals and KYC failure handling; full screenshot/responsive verification remains incomplete because browser captures showed a different route and subsequent navigation timed out.

### 2026-09-05 admin sidebar hierarchy

- Added an icon beside all six navigation group titles and visible tree connectors from each group icon to its child items; the final branch ends at the last item and the active branch uses gold.
- Preserved group toggles and route selection, with compact child labels to accommodate the indentation.
- Admin TypeScript, sidebar ESLint, and diff whitespace checks pass. Rendered browser review was not performed.

### 2026-08-09 evidence log

- Confirmed permanent deletes in user, campaign, and campaign-update repositories.
- Converted those repository deletes to `deletedAt` soft deletion and excluded deleted records from normal lookup, list, count, update, and donation increment paths.
- API TypeScript check passed after the soft-delete change.
- API test infrastructure currently requires MongoDB at `127.0.0.1:28017`; the suite stopped in global setup with `ECONNREFUSED`, before collecting tests. This is an environment gate, not a passing test result.
- Confirmed remaining mock/fallback behavior in admin data hooks, audit log and dispute detail; confirmed visible unfinished client copy for comments and dark mode.
- Added admin-only `GET /users/:id`; the user list/detail read model now excludes soft-deleted accounts.
- Added persistent audit records for successful authenticated mutations and admin-only `GET /audit` pagination/search. Audit writes deliberately omit request bodies and credentials.
- Replaced the Audit Log page's fabricated timeline with the real audit endpoint plus honest loading, empty, search, pagination, and error states.
- Removed silent mock fallback data from shared admin API hooks. API failures now retain safe empty states and expose errors instead of presenting demonstration records as production truth.
- Removed the permission context's unauthenticated/error fallback to full Super Admin access. Added authenticated admin `GET /rbac/me` using the canonical admin permission baseline.
- Cleared the admin lint backlog encountered in this slice; fresh admin/API TypeScript and ESLint checks pass. The only emitted lint message is Node's repository-level module-type performance warning.
- Fixed organization registration end to end: validation now accepts only public user/organization roles, requires organization identity fields, persists organization metadata, and issues organization-role tokens. Deleted organizations are excluded from public organization reads.
- Added authenticated `GET /campaigns/mine` and moved web/mobile dashboards and campaign management to server-scoped owner data instead of downloading the public catalog and filtering client-side.
- Removed web/mobile demo credential and fake-token bypasses. Production authentication now fails honestly when the API is unavailable.
- Connected the web forgot-password screen to the real API and removed its visible mock-success disclaimer.
- Added authenticated `DELETE /profile`: account records are soft-deleted and all outstanding tokens are revoked. Web and mobile account deletion now call the real endpoint with legally accurate retention language.
- Added Expo iOS privacy-manifest configuration, encryption declaration, notification plugin configuration, EAS build/submit profiles, production HTTPS API enforcement, and `apps/mobile/STORE_SUBMISSION.md`.
- Removed unverified universal/app-link domain entitlements until a final controlled domain and association files exist.
- Restored Expo's workspace-aware Metro defaults, aligned SDK 55 packages, expanded lint coverage to `app/`, converted React Native animation values away from render-time ref access, and achieved `expo-doctor` 19/19.
- Cleared the remaining mobile lint backlog across application routes and components; mobile ESLint and TypeScript now pass without source warnings or errors, and the mobile Vitest suite passes (1 file, 5 tests).
- Removed the mobile organization directory's fabricated campaign-derived fallback; organization discovery now presents only real API data with explicit failure and empty states.
- Made mobile settings persistence honest and recoverable: failed writes roll back optimistic state and display an inline error instead of silently diverging from the backend.
- Added a role-aware mobile dashboard workspace header and corrected donation labels so `/donations/mine` is accurately presented as the signed-in user's giving history, not donations received by their campaigns.
- Wired the existing authenticated wallet transaction endpoint into mobile, replacing the visible “coming soon” placeholder with real recent activity. Removed misleading no-op deposit/withdraw/transfer controls until a production payment rail is configured.
- Fresh TypeScript checks pass across admin, API, marketing, mobile, web, types, and UI workspaces.
- Replaced mock-generated admin trend, category, geography, and fraud/report panels with admin-only `GET /analytics/reports`, backed by Mongo aggregates. Overview totals and report aggregates exclude soft-deleted users/campaigns.
- API/admin ESLint and TypeScript checks pass after analytics wiring; the admin production build passes. The build reports a non-blocking 1.4 MB entry-chunk optimization warning.
- Re-ran the API suite; global setup still stops before test collection because the required Mongo test service at `127.0.0.1:28017` is unavailable (`ECONNREFUSED`).
- Fixed campaign-update pinning to toggle pin/unpin and refresh locally; update deletion also refreshes without a full browser reload.
- Repaired the shared client RBAC contract: authenticated users and organizations can now retrieve their canonical role permissions from `GET /rbac/me`; the web client no longer grants hard-coded demo permissions when permission loading fails.
- Cleared the web lint backlog found during the review (25 warnings), including unsafe `any` response coercions, stale imports/state, hook dependencies, and permission fallback code. Fresh API/web TypeScript and ESLint checks pass without source warnings or errors.
- Completed campaign comments end to end: shared contract, Mongo persistence, public listing, authenticated posting, author/campaign-owner/admin moderation, and soft deletion. Replaced the web “coming soon” panel and added the equivalent mobile conversation UI.
- Fresh shared-types/API/web/mobile TypeScript and ESLint gates pass after comment integration; web tests pass 17/17 and mobile tests pass 5/5.
- Replaced the admin subscriptions page's generated customer/revenue records with protected `GET /subscriptions`, a real repository read model enriched with member identity, and truthful loading/error/empty states. Subscription counts, plan mix, and projected monthly revenue now derive from persisted records.
- API/admin TypeScript and ESLint checks pass after subscription wiring; the admin production build passes with only the previously recorded bundle-size optimization warning.
- Persisted `paymentMethod` on donations and exposed it across recent, personal, detail, and campaign donation read models. The admin payment-method panel now uses real records; legacy donations safely resolve to wallet. Unsupported provider labels are rejected before any wallet debit.
- Completed the web dark-theme TODO with a persisted color-mode provider, shared light/dark theme factory, immediate settings synchronization, and replacement of hard-coded light page surfaces with semantic theme tokens.
- Added `PRODUCT_NAMING.md` with a live collision/domain screen. `Ujimora` is already used by an active fundraising organization and Android product; the recommended legal/audience-test finalists are TumiRaise and SikaSpring.
- Web lint, TypeScript, tests (17/17), and production build pass after dark-mode and payment-contract changes.
- Closed the remaining source TODO/mock marker sweep. Admins can no longer enable non-wallet providers without a configured live adapter, preventing mobile/web from advertising unusable rails; unsupported transactions are rejected before balance mutation.
- Prevented unpaid subscription escalation: API subscribe/upgrade use cases now reject every non-Free tier until a verified billing checkout exists; web/mobile paid actions are disabled and unsupported plan entitlements are no longer advertised as live.
- Completed a public-claims integrity pass across CMS defaults and marketing surfaces. Removed invented impact totals, testimonials, organization adoption figures, payment rails, payout promises, escrow/live-event claims, recurring giving, API/tax-receipt claims, and fabricated editorial statistics. Replaced them with current platform capabilities and explicit launch-readiness boundaries.
- Corrected refund messaging after tracing the full implementation: web/mobile/API can submit and list refund requests, but approval and settlement are not automatic. Removed false 5–7-day guarantees while retaining the real request workflow and its recorded fee disclosure.
- Removed the admin campaign detail's inert “Force Refund” financial control; no admin UI now implies a settlement action that the backend cannot perform.
- Fresh marketing, admin, web, mobile, and API ESLint and TypeScript gates pass after the subscription, CMS, refund, and claims-integrity changes. Only the repository-level Node module-type performance warning is emitted.
- Replaced the fabricated admin dispute detail with protected `GET /disputes/:id` data and real `PUT /disputes/:id/resolve` writes. Campaign collaborators in admin now come from `/campaigns/:id/collaborators`; fake operator timelines, campaign stats, people, and no-op removal actions were removed.
- Made the admin roles page an honest read-only view of the code-enforced `DEFAULT_ROLES`; removed custom-role and invite-user routes that previously reported local success without backend persistence.
- Added `FEATURE_PARITY.md`. Fixed the organization parity gap: mobile organization cards now match the actual summary DTO and navigate to a new detail screen backed by organization detail and campaign endpoints.
- Marketing, admin, and web production builds pass; web tests pass 17/17 and mobile tests pass 5/5. Marketing/admin bundles retain non-blocking large-chunk optimization warnings.
- Confirmed iOS icon and adaptive icon assets are 1024x1024. Repository metadata includes the privacy manifest, encryption declaration, production HTTPS enforcement, account deletion, bundle/build identifiers, and EAS profiles; signed builds, App Store metadata, legal identity, final domain, screenshots, and physical-device accessibility/smoke tests remain owner-controlled gates.
- Wired admin profile, password changes, and the supported notification/language preferences to real profile/auth endpoints. Removed unsupported local-only preference controls.
- Replaced local-only plan creation/edit/delete/toggle behavior with a read-only view of the actual code-defined subscription policy and removed the fake platform-settings route. No admin control now reports persistence when no backend contract exists.
- Removed fabricated public contact channels, office locations, social destinations, response SLAs, leadership identities, and the unsupported 2030 fundraising counter from marketing fallbacks and CMS seeds. Owner-verified values can still be supplied through the CMS.
- Started an isolated disposable MongoDB test service, updated stale tests to the wallet-only and truthful CMS contracts, and completed the full API suite: 13 files and 100/100 tests pass. The named test container was removed afterward.
- Replaced the admin payment-provider editor's local-only edit/delete controls with an honest read model and the one persisted capability the backend supports: guarded enable/disable toggling.
- Wired admin password recovery to the real forgot-password endpoint. Web campaign and global activity feeds now hydrate from persisted donation reads even when optional SSE transport is disabled.
- Completed testimonial CMS end to end: protected create/update/list/stats operations, published-only public reads, marketing consumption with a truthful fallback, and soft deletion via `deletedAt`. Integration tests prove authorization, publication filtering, and record retention.
- Completed the contact workflow end to end: rate-limited public submission persistence, protected admin inbox/filter/stats, and persisted status/notes triage. Removed the remaining invented email response-time claim.
- Fixed mobile campaign-share analytics to use the environment-aware shared API client instead of a hardcoded localhost URL, restoring real-device parity.
- Fresh API/admin/marketing TypeScript and ESLint gates pass for these slices. Contact and testimonial integration tests pass 3/3 against an isolated disposable MongoDB service, which was removed afterward.
- Completed the post-review monorepo gate: every workspace type-checks and builds; all suites pass (API 15 files/103 tests, web 17, mobile 5, admin 5, marketing 2); Expo Doctor passes 19/19; `git diff --check` is clean.
- Removed the Home page test's asynchronous activity-feed leakage, so web tests pass without React `act()` warnings. Removed the final source lint warning in the shared currency formatter.
- Applied npm's non-breaking dependency remediation. Patched React Router, Axios, `shell-quote`, and other resolvable production dependencies; the production audit has no critical findings. Remaining findings are Expo/Metro/image parser transitives whose npm-proposed fix is an incompatible Expo downgrade, so they are recorded rather than force-applied. Expo remains 55.0.28 and Doctor remains 19/19.
- Completed rendered responsive QA in the browser at 390x844 and 1440x900. Marketing, client login, and admin login have no horizontal overflow; primary form controls and actions retain 46-56px mobile targets. The marketing hero remains legible and structurally balanced at both breakpoints.
- Rendered QA exposed and removed the last hero claim for unsupported mobile-money payouts. Mobile campaign detail now advertises Ujimora Wallet only; web Terms and marketing Privacy copy no longer claim unconfigured fees, payouts, payment processors, or identity-verification partners.
- Closed a critical wallet-integrity gap: removed public authenticated deposit/withdraw routes that allowed direct balance mutation without provider settlement, removed matching web controls, and changed integration/E2E setup to avoid production balance-minting APIs. A regression test proves both former endpoints return 404 while wallet-backed donation accounting remains correct (4/4 tests).
- Fixed mobile campaign reporting to use the real `/campaigns/:id/report` contract. Re-ran the exact frontend/backend endpoint sweep; no remaining references to the removed wallet mutation routes or the invalid mobile `/reports` write remain.
- Migrated Vite/Vitest aliases away from `__dirname` to native ESM URL resolution and renamed the mobile Vitest config to `.mts`, removing the Vite 8 native-config warnings. Web 17/17, admin 5/5, marketing 2/2, and mobile 5/5 tests pass after the migration.
- Hardened iOS authentication storage: access/refresh tokens now use Expo SecureStore (iOS Keychain / Android Keystore) with a one-time migration that removes legacy AsyncStorage token data.
- Moved notification permission behind the explicit Push Notifications settings toggle; sign-in and registration no longer prompt automatically. New profiles default push consent to off.
- Added authenticated push-token registration and soft unregistration persistence. Corrected mobile settings field mapping to the real nested profile contract and removed notification sub-controls that had no backend fields. Push integration tests pass 2/2; mobile type-check, lint, and tests pass.
- Removed the shared simulated AI-writing control and its remaining legacy role-page usage. No frontend now presents deterministic local text transforms as an AI-backed product feature. Admin lint, 5/5 tests, and production build pass; web lint, 17/17 tests, and production build pass. The admin bundle retains its documented non-blocking chunk-size warning.

---

# Previous audit snapshot

> Generated: 2026-05-27  
> Scope: Full monorepo (`apps/*`, `packages/*`, CI/CD, security, architecture)

---

## 1. Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| **Blocking CI/CD** | 3 | Critical |
| **Security vulnerabilities** | 9 | High |
| **Unimplemented stubs** | 4 | High |
| **Missing tests** | 4 | Medium |
| **Architectural gaps** | 8 | Medium |
| **Feature opportunities** | 12 | Low–Medium |

**Immediate action required:** 3 issues currently break the CI pipeline (`mobile lint`, `marketing type-check`, `web test warnings`). A further 9 security issues expose credentials, weaken auth, or leave endpoints unprotected.

---

## Progress Update

### Phase 1 — Stop the Bleeding ✅ COMPLETE
1. ✅ Fixed mobile lint errors (CampaignCard.tsx impure render, SplashScreen.tsx ref access)
2. ✅ Fixed marketing TS5101 (`ignoreDeprecations: "6.0"`)
3. ✅ Fixed web test `act()` warnings (mocked `useFeaturedDonors`)
4. ✅ Rotated secrets in `.env` and `credentials.txt` (replaced with placeholders)
5. ✅ Added `.env` and `credentials.txt` to `.gitignore`
6. ✅ Added production config validation (JWT secret length, distinct secrets)
7. ✅ Fixed web TS5101
8. ✅ Fixed marketing lint error (setState in effect)
9. ✅ Fixed admin type-check errors (8 errors)
10. ✅ Fixed web impure render errors
11. ✅ Fixed web setState in effect errors
12. ✅ Fixed web type-check errors

### Phase 2 — Security Hardening ✅ COMPLETE
1. ✅ Mounted `authRateLimiter` on auth routes (`/register`, `/login`, `/forgot-password`)
2. ✅ Implemented `requireRole` / `requirePermission` RBAC middleware
3. ✅ Applied RBAC to admin endpoints (`rbacRoutes`, `subscriptionRoutes`)
4. ✅ Restricted CORS to known origin whitelist
5. ✅ Added request body size limit (`express.json({ limit: '10kb' })`)
6. ✅ Added server timeouts (`timeout`, `keepAliveTimeout`, `headersTimeout`)
7. ✅ Implemented token revocation / blacklist (jti claims, user token tracking)
8. ✅ Change-password now revokes all existing tokens and issues new ones
9. ✅ Fixed regex injection in `OrganizationController.getBySlug`
10. ✅ Eliminated direct Mongoose model access in controllers (Profile, Organization, Donation, User)

### Phase 3 — Core Architecture ✅ COMPLETE
1. ✅ Wired `CampaignLimitModel` and `CampaignMediaModel` into repositories and use cases
2. ✅ Added `CampaignLimitEntity` with `canCreateCampaign()` / cooldown logic
3. ✅ `CreateCampaignUseCase` now enforces campaign limits
4. ✅ Added MongoDB transactions to `DonateToCampaignUseCase` (wallet → campaign → donation)
5. ✅ Added pagination helper (`parsePagination`, `buildPaginatedResponse`)
6. ✅ Added pagination to list endpoints (Donations, Comments, Notifications, Organizations, Refunds, Verifications, Disputes, Leaderboard)
7. ✅ Added `SearchCampaignsUseCase` with text search, category/status/priority filters, sorting
8. ✅ Added `/campaigns/search` endpoint
9. ✅ Added graceful shutdown (SIGTERM/SIGINT handlers)

### Phase 4 — Infrastructure & Features 🔄 IN PROGRESS
1. ✅ Implemented `RedisCacheService` with `ioredis` (falls back to in-memory)
2. ✅ Implemented `CloudinaryService` with real SDK integration
3. ✅ Expanded email notifications (donation receipt, campaign funded, milestone reached, dispute opened/resolved, verification approved/rejected)
4. 🔄 Payment provider abstraction — NOT YET STARTED
5. 🔄 M-Pesa / Stripe adapters — NOT YET STARTED

### Phase 5 — Quality & Scale 🔄 IN PROGRESS
1. 🔄 API integration tests — pending
2. 🔄 Mobile + admin + marketing unit tests — pending
3. 🔄 E2E tests — pending
4. 🔄 Structured logging — pending

---

## 2. Critical / Blocking Issues (Fix First)

### 2.1 Mobile Lint — Impure Render (`CampaignCard.tsx:22`)
- **File:** `apps/mobile/src/components/CampaignCard.tsx`
- **Error:** `Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / ...)` called during render — violates `react-hooks/purity`.
- **Fix:** Move `Date.now()` into `useMemo` or `useState` + `useEffect` so `daysLeft` is stable across renders.

### 2.2 Mobile Lint — Ref Access During Render (`SplashScreen.tsx:7`)
- **File:** `apps/mobile/src/components/SplashScreen.tsx`
- **Error:** `useRef(new Animated.Value(0.3)).current` — `new Animated.Value()` executes during render.
- **Fix:** Use lazy initializer: `useRef(() => new Animated.Value(0.3))` or initialize in `useEffect`.

### 2.3 Marketing Type-Check — TS5101 (`baseUrl` Deprecated)
- **File:** `apps/marketing/tsconfig.json`
- **Error:** `"baseUrl": "."` is deprecated in TypeScript 6.0; will stop functioning in TS 7.0.
- **Fix:** Add `"ignoreDeprecations": "6.0"` to `compilerOptions` (short-term) or migrate all path resolution to relative `paths` (long-term).

### 2.4 Web Test Warnings — `act(...)`
- **File:** `apps/web/src/pages/HomePage.tsx` → `FeaturedDonorsSection`
- **Error:** `useFeaturedDonors('all', 5)` triggers state updates not wrapped in `act()` during test render.
- **Fix:** Mock the hook in tests or wrap the component render in `waitFor` / `act`.

---

## 3. Security Vulnerabilities (High Priority)

### 3.1 Secrets Committed to Repository
- **Files:**
  - `credentials.txt` — contains the MongoDB URI, demo passwords, and API endpoints. (Actual values redacted here; the file is gitignored and must never be committed.)
  - `apps/api/.env` — contains `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `RESEND_API_KEY`.
- **Risk:** Credentials are permanently in Git history; anyone with repo access can connect to production DB, forge JWTs, or send emails.
- **Fix:**
  1. Rotate **all** secrets immediately (MongoDB password, JWT secrets, Resend API key).
  2. Add `.env` and `credentials.txt` to `.gitignore`.
  3. Purge from Git history (`git filter-repo` or BFG).
  4. Use environment-specific secrets via CI/CD variables.

### 3.2 Weak / Identical JWT Secrets
- **File:** `apps/api/.env`
- **Issue:** `JWT_SECRET` and `JWT_REFRESH_SECRET` are identical (`***REDACTED***`) and short/weak.
- **Risk:** Token forgery, privilege escalation.
- **Fix:** Generate strong, distinct secrets (≥256-bit, e.g., `openssl rand -hex 32`).

### 3.3 No Rate Limiting on Auth Endpoints
- **File:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`
- **Issue:** `authRateLimiter` (10 req/15min) exists but is **never mounted** on `/auth/*` routes. Only `apiRateLimiter` (100/15min) is applied globally.
- **Risk:** Brute-force attacks on login, registration, password reset.
- **Fix:** Mount `authRateLimiter` on `/auth/register`, `/auth/login`, `/auth/forgot-password` in `authRoutes.ts`.

### 3.4 No RBAC Enforcement on Admin Endpoints
- **Files:** `rbacRoutes.ts`, `subscriptionRoutes.ts`
- **Issue:** Admin endpoints (role CRUD, plan management) only require `authMiddleware` — no role/permission check.
- **Risk:** Any authenticated user can create roles, modify plans, assign permissions.
- **Fix:** Implement `requireRole('admin')` / `requirePermission(Resource.ROLES, Action.CREATE)` middleware and apply to sensitive routes.

### 3.5 Open CORS Configuration
- **File:** `apps/api/src/main.ts`
- **Issue:** `app.use(cors())` with no origin restriction allows any domain to call the API.
- **Risk:** CSRF-like attacks from malicious sites if cookies are ever introduced.
- **Fix:** Configure CORS with explicit `origin` whitelist.

### 3.6 No Helmet CSP Configuration
- **File:** `apps/api/src/main.ts`
- **Issue:** `helmet()` is used with default settings; no Content-Security-Policy for API responses or static assets.
- **Fix:** Configure `helmet.contentSecurityPolicy()` for the API (less critical for JSON-only API, but important if serving uploads).

### 3.7 No Request Timeouts
- **File:** `apps/api/src/main.ts`
- **Issue:** `express.json()` and MongoDB connection lack explicit timeouts.
- **Risk:** Slowloris attacks, hanging connections, unbounded request duration.
- **Fix:** Add `express.json({ limit: '10kb' })` and server-level timeout (`server.timeout = 30000`).

### 3.8 Direct Model Access in Controllers (Bypasses Repository Layer)
- **Files:** `ProfileController.ts`, `OrganizationController.ts`, `DonationController.ts`, `UserController.ts`
- **Issue:** Controllers use Mongoose models directly (`UserModel.findById`, `CampaignModel.find`) instead of repository ports.
- **Risk:** Breaks hexagonal architecture, makes testing harder, bypasses audit logging and business rules.
- **Fix:** Inject repository ports into controllers and route all DB access through them.

### 3.9 No Token Revocation / Blacklist
- **File:** `apps/api/src/application/services/AuthTokenService.ts`
- **Issue:** `refreshTokens()` accepts any valid refresh token with no revocation check. Change-password does not invalidate existing sessions.
- **Risk:** Stolen refresh tokens remain usable indefinitely; password change does not kick out attackers.
- **Fix:** Store issued refresh tokens in Redis/DB with TTL; check revocation on refresh. Invalidate all user tokens on password change.

---

## 4. Unimplemented Infrastructure Stubs

### 4.1 Redis Cache Service
- **File:** `apps/api/src/infrastructure/cache/index.ts`
- **Status:** `RedisCacheService` is a complete stub — all methods return `null` or no-op.
- **Impact:** No distributed caching; in-memory cache is process-local only and loses data on restart.
- **Fix:** Integrate `ioredis`, wire into `main.ts`, add cache-aside pattern to hot read paths (campaigns, leaderboard).

### 4.2 Cloudinary Media Service
- **File:** `apps/api/src/infrastructure/cloudinary/index.ts`
- **Status:** All methods return mock URLs. No actual SDK initialization.
- **Impact:** Campaign images cannot be uploaded; `CampaignMediaModel` exists but is unused.
- **Fix:** Initialize Cloudinary SDK, implement `uploadImage`/`uploadVideo`, wire `CampaignMediaModel` into a repository.

### 4.3 No Real Payment Gateway
- **File:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`
- **Status:** Donations only transfer internal wallet balance. No M-Pesa, Stripe, PayPal, or crypto integration.
- **Impact:** Platform cannot accept real money.
- **Fix:** Design payment abstraction (`PaymentProviderPort`) with adapters for M-Pesa (Africa-focused) and Stripe. Keep wallet as post-payment balance.

### 4.4 Email Service — Limited Coverage
- **File:** `apps/api/src/application/services/EmailService.ts`
- **Status:** Only invitation and password-reset emails implemented. No donation receipts, milestone notifications, dispute alerts.
- **Fix:** Add templates for donation receipt, campaign funded, milestone reached, dispute opened. Wire into `NotificationDispatcher`.

---

## 5. Architectural Gaps

### 5.1 Missing Model Wiring
- **Files:** `CampaignLimitModel.ts`, `CampaignMediaModel.ts`
- **Issue:** Models exist in `database/models` but have **no corresponding repositories or use cases** wired in `main.ts`.
- **Fix:** Create `CampaignLimitRepository` + `CampaignMediaRepository`, wire into use cases, enforce limits at creation time.

### 5.2 No Database Transactions
- **File:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`
- **Issue:** Donation involves 3 writes (wallet withdraw, campaign update, donation save) with no atomicity. Failure mid-way leaves data inconsistent.
- **Fix:** Use MongoDB multi-document transactions (`session.withTransaction`) for financial operations.

### 5.3 No Event Bus / Pub-Sub
- **Issue:** Cross-domain side effects (e.g., donation → notification, campaign funded → email) are inline or skipped.
- **Fix:** Introduce a lightweight domain event bus. Publish `DonationCreated`, `CampaignFunded` events; subscribers send emails, push notifications, update leaderboard.

### 5.4 Missing Use Cases
- **Campaign:** No `UpdateCampaignUseCase`, `DeleteCampaignUseCase`, `ApproveCampaignUseCase`.
- **Wallet:** No `DepositUseCase`, `WithdrawUseCase`, `TransferUseCase`.
- **User:** No `UpdateUserUseCase`, `DeactivateUserUseCase`.
- **Fix:** Implement missing use cases and expose via controllers/routes.

### 5.5 Pagination Missing on List Endpoints
- **Issue:** `OrganizationController.list`, `DonationController.listMyDonations`, `CommentController` lists return all documents.
- **Risk:** Unbounded result sets cause performance degradation and OOM.
- **Fix:** Add `limit`/`offset` (or cursor) pagination to all list endpoints.

### 5.6 No Search / Filter on Campaigns
- **Issue:** `GetCampaignUseCase` appears to fetch by ID only; no list/search endpoint found.
- **Fix:** Add `SearchCampaignsUseCase` with filters (category, country, status, priority, query text) and sorting.

### 5.7 Inconsistent Error Handling
- **Issue:** Some use cases throw plain `Error`, some throw `AppError`. Controllers catch and wrap inconsistently.
- **Fix:** Standardize on `AppError` (or domain-specific errors) with HTTP status codes. Use a single error mapper in `errorHandler.ts`.

### 5.8 No Graceful Shutdown
- **File:** `apps/api/src/main.ts`
- **Issue:** No signal handlers for `SIGTERM` / `SIGINT`. In-flight requests may be dropped.
- **Fix:** Add `process.on('SIGTERM', ...)` to close server, drain connections, disconnect MongoDB.

---

## 6. Testing Gaps

| App | Tests | Coverage | Notes |
|-----|-------|----------|-------|
| `api` | 8 files | Domain + 1 use case | Missing integration tests for controllers, repositories |
| `web` | 2 files | Component + page | Has `act()` warnings; mocks hooks only |
| `mobile` | **0** | — | No test suite at all |
| `admin` | **0** | — | No test scripts in scope |
| `marketing` | **0** | — | No test scripts in scope |

**Recommendations:**
- Add Vitest + React Native Testing Library to `mobile`.
- Add basic render tests to `admin` and `marketing`.
- Add API integration tests (supertest) for at least auth and campaign flows.

---

## 7. Feature Opportunities (Prioritized)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | **Payment integration** (M-Pesa + Stripe) | Core business function; currently impossible to donate real money |
| P0 | **RBAC enforcement middleware** | Any user can admin; security-critical |
| P1 | **Redis caching** | Performance; stubs already exist |
| P1 | **Cloudinary uploads** | Campaigns need images; stubs already exist |
| P1 | **Campaign search & filter** | Discovery is essential for donors |
| P1 | **Email notifications** (donation receipt, milestone, dispute) | User engagement and trust |
| P2 | **Push notifications** | Mobile engagement |
| P2 | **Real-time updates** (WebSockets / SSE) | Live donation feeds, campaign progress |
| P2 | **Wallet deposit/withdraw/payout** | Complete financial loop |
| P2 | **KYC verification pipeline** | Trust & compliance |
| P3 | **Campaign updates / blog posts** | Creator engagement |
| P3 | **Social sharing (deep links)** | Viral growth |

---

## 8. Recommended Implementation Order

### Phase 1 — Stop the Bleeding (Day 1)
1. Fix mobile lint errors (CampaignCard, SplashScreen).
2. Fix marketing TS5101 (`ignoreDeprecations` or remove `baseUrl`).
3. Fix web test `act()` warnings.
4. Rotate all secrets and purge from Git history.
5. Add `.env` + `credentials.txt` to `.gitignore`.

### Phase 2 — Security Hardening (Week 1)
6. Mount `authRateLimiter` on auth routes.
7. Implement `requireRole` / `requirePermission` middleware.
8. Restrict CORS to known origins.
9. Add request timeouts and body size limits.
10. Implement token revocation / blacklist.

### Phase 3 — Core Architecture (Week 2–3)
11. Wire `CampaignLimitModel` and `CampaignMediaModel` into repositories.
12. Add MongoDB transactions to financial use cases.
13. Implement missing use cases (UpdateCampaign, ApproveCampaign, Deposit, Withdraw).
14. Add pagination to all list endpoints.
15. Introduce a lightweight domain event bus.

### Phase 4 — Infrastructure & Features (Month 2)
16. Implement real `RedisCacheService`.
17. Implement real `CloudinaryService`.
18. Build payment provider abstraction + M-Pesa adapter.
19. Expand email templates and notification coverage.
20. Add campaign search & filtering.

### Phase 5 — Quality & Scale (Ongoing)
21. Add integration tests for API controllers.
22. Add mobile + admin + marketing unit tests.
23. Add E2E tests (Playwright for web, Maestro for mobile).
24. Add structured logging (Pino/Winston) and monitoring.

---

## 9. Quick Reference: File Checklist

| File | Issue | Action |
|------|-------|--------|
| `apps/mobile/src/components/CampaignCard.tsx:22` | Impure render | ✅ Wrap `daysLeft` in `useMemo` |
| `apps/mobile/src/components/SplashScreen.tsx:7` | Ref access during render | ✅ Use lazy `useRef` initializer |
| `apps/marketing/tsconfig.json` | TS5101 `baseUrl` | ✅ Add `ignoreDeprecations` or migrate paths |
| `apps/web/__tests__/pages/HomePage.test.tsx` | `act()` warnings | ✅ Mock `useFeaturedDonors` or wrap in `waitFor` |
| `credentials.txt` | Secrets committed | ✅ Rotate secrets, purge history, add to `.gitignore` |
| `apps/api/.env` | Secrets committed | ✅ Rotate secrets, purge history, add to `.gitignore` |
| `apps/api/src/main.ts` | Open CORS, no timeouts | ✅ Restrict CORS, add `express.json({ limit })`, server timeout |
| `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts` | `authRateLimiter` unused | ✅ Mount on auth routes |
| `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts` | No role checks | ✅ Add `requireRole('admin')` middleware |
| `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts` | No admin checks | ✅ Add `requireRole('admin')` middleware |
| `apps/api/src/application/services/AuthTokenService.ts` | No revocation | ✅ Store refresh tokens, check blacklist |
| `apps/api/src/application/services/EmailService.ts` | Missing templates | ✅ Add donation receipt, milestone, dispute emails |
| `apps/api/src/infrastructure/cache/index.ts` | Redis stub | ✅ Implement with `ioredis` |
| `apps/api/src/infrastructure/cloudinary/index.ts` | Cloudinary stub | ✅ Implement with `cloudinary` SDK |
| `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts` | No real payments | 🔄 Add `PaymentProviderPort` + M-Pesa adapter |
| `apps/api/src/infrastructure/database/models/CampaignLimitModel.ts` | Unused | ✅ Create repository, wire into `CreateCampaignUseCase` |
| `apps/api/src/infrastructure/database/models/CampaignMediaModel.ts` | Unused | ✅ Create repository, wire into campaign flow |
| `apps/api/src/infrastructure/adapters/inbound/http/controllers/ProfileController.ts` | Direct model access | ✅ Inject repository port |
| `apps/api/src/infrastructure/adapters/inbound/http/controllers/OrganizationController.ts` | Regex injection risk | ✅ Escape `slug` before regex; use repository |

---

*End of audit. Estimated effort to reach Phase 3: 2–3 developer-weeks. Phase 4: 1–2 developer-months.*

---

## 10. Application-wide Neumorphism Completion — 2026-08-25

**Status:** ✅ COMPLETE

**Material rules applied**

- Smoke (`#F2EFEA`) is the primary light surface; white is reserved for intentional contrast sections.
- Cards inherit the material of their containing section: smoke on smoke, green on green, and dark green in admin/dark contexts.
- Cards and card-like lists no longer use decorative outline borders; depth comes from paired light/dark shadows.
- Buttons, icon buttons, chips, and decorative icon tiles are raised at rest and hover; inset treatment is reserved for active/selected states, inputs, and recessed wells.
- Dark headers, CTA bands, organization sections, and footers use local dark neumorphic tokens so light/white glow cannot leak into them.

**Coverage**

- Shared UI theme primitives and exports.
- Marketing navigation, footer, homepage sections, CTA, organization, pricing/blog/contact/support surfaces.
- Web header/footer, homepage CTA, campaign/list/activity surfaces, dashboard, leaderboard, profile, wallet, settings, subscriptions, refunds, donations, KYC, and organization pages.
- Admin theme, authentication, settings/profile, content panels, plan forms, dispute and testimonial surfaces.
- Desktop and mobile visual checks for marketing, web homepage/CTA/header/footer, leaderboard, and admin authentication.

**Acceptance evidence**

- `npm run type-check` passes for `@ubuntu-fund/ui`, `web`, `marketing`, and `admin`.
- ESLint passes for all four workspaces (only the repository's existing module-type warning remains).
- Vitest passes: web 17 tests, marketing 5 tests, admin 2 tests.
- Production builds pass for web, marketing, and admin (existing large-chunk warnings remain for marketing/admin).

---

## 11. Mobile, Editorial Pages, and Admin Detail Completion — 2026-08-25

**Status:** ✅ COMPLETE

**Delivered**

- Applied the contextual smoke/green neumorphic system across the Expo mobile routes and shared campaign, comment, and update components. Raised states are used for touch controls; inset states are reserved for inputs and selections.
- Rebuilt the Company/resource page banners as dark-green editorial heroes with contextual green shadows and no light-surface glow leakage.
- Expanded Contact from one incomplete card to four truthful pathways: email support, support availability, Ghana operations, and organization help. Cards are smoke-on-smoke and raised without outline borders.
- Rebuilt Terms, Privacy, and Refund Policy around one responsive legal-document layout: editorial hero, sticky section navigator, raised reading surface, and inset clarification panel. The mobile date chip and “On this page” label are verified on separate rows.
- Redesigned admin login/forgot-password surfaces and sidebar groups with dark contextual neumorphism.
- Fixed admin permissions after login by refetching `/rbac/me` when authentication tokens change and validating malformed permission payloads defensively.
- Converted the admin Overview detailed dashboard and shared page header from outlined panels to raised chart surfaces, inset summary cells, and raised icon tiles.

**Acceptance evidence**

- Mobile: TypeScript and ESLint pass; Vitest passes 5/5; Expo web export completes; 390px login render has no runtime errors or horizontal overflow.
- Marketing: TypeScript, ESLint, and production build pass; Contact, Terms, Privacy, and Refund routes render without page errors at desktop and 390px widths.
- Admin: TypeScript and ESLint pass; Vitest passes 5/5; production build passes; authenticated `/overview` render reports zero permission-denied states and zero page errors.
- Existing non-blocking notices: root ESLint module-type warning, marketing/admin bundle-size advisory, and Watchman falling back to Metro's node crawler during Expo export.

---

## 12. Contact, Donor, and Achievement Composition Redesign — 2026-08-25

**Status:** ✅ COMPLETE

**Delivered**

- Replaced the Contact page's isolated channel-card treatment with a responsive 2×2 support directory: raised smoke surfaces, left-aligned information, raised icon tiles, and quiet ordinal watermarks.
- Replaced the homepage's repeated oversized donor podiums with two compact impact ledgers. Each ledger has one first-place anchor and a readable ranked contribution list without floating medals, white cards, or oversized empty areas.
- Rebuilt the Leaderboard top-three presentation as one restrained ranked set: first place uses contextual dark green, secondary ranks stay smoke-on-smoke, and amounts use tabular figures.
- Rebuilt the eight-column achievement strip as a four-column descriptive collection. Names, unlock criteria, and rarity are now readable without truncated chips; mobile collapses to full-width achievement rows.
- Reduced the achievement palette to the established green, gold, clay, and muted teal family while preserving badge identity.

**Acceptance evidence**

- Desktop renders verified for homepage donor ledgers, leaderboard rank panels and achievement grid, and Contact support directory.
- 390px Leaderboard render verified with no horizontal overflow; achievement cards remain readable and full width.
- Playwright reported zero page errors and zero horizontal overflow across Home, Leaderboard desktop/mobile, and Contact.
- Web TypeScript passes. Full web ESLint remains blocked by pre-existing React compiler findings in `useLiveTotals.ts`, `CampaignPublicPage.tsx`, and `DonateCallbackPage.tsx`, outside this visual slice.

### 2026-09-05 Marketing homepage artwork

- Added two generated Ghanaian community illustrations, compressed JPEG assets in `apps/marketing/public/images/home`, high-priority hero loading and lazy-loaded organization artwork. Source/provenance notes accompany the assets.
- Added three original SVG watermarks (chain, leaf, ripple) and two CSS 3D sculptures (unity links and growing seed), with pointer tilt, click/tap rotation, keyboard controls and reduced-motion support.
- Browser review: verified desktop and 390px mobile layout, image sizing, keyboard rotation and seed click rotation. Fixed an SVG syntax issue and MUI image-width override found during verification. Marketing TypeScript, ESLint, production build and diff whitespace checks pass; existing bundle-size advisory remains.

### 2026-09-05 Live app screenshots across the marketing homepage

- Added four genuine captures of the running app: campaign discovery, campaign creation, public campaign progress, and the initial campaign workspace. All preview frames disclose demo data; crops exclude account identity. Capture provenance is recorded in `apps/marketing/public/images/product/README.md`.
- Integrated 11 screenshot placements across all eight homepage sections, including every How It Works step, a two-column Features showcase, campaign categories, organizations, and the final call to action. Existing generated artwork, watermarks, and interactive sculptures remain in place.
- Added a shared responsive screenshot frame with lazy loading, descriptive alt text, keyboard focus styles, reduced-motion hover handling, and an accessible enlargement dialog.
- Browser verification: desktop at 1440px and mobile at 390px have no horizontal overflow; all 11 product image placements load; enlargement, Close, Escape, and focus restoration work. Marketing TypeScript, ESLint, production build, and diff whitespace checks pass. Existing ESLint module-type and build chunk-size advisories remain.

### 2026-09-05 Admin plans, providers, and roles

- Matched Plans, Payment Providers, and Roles to the shared full-width admin background, raised cards, inset details, and header statistics.
- Plans show readable availability badges, grouped campaign limits and fees, and included features. Roles expose resource/action permissions through keyboard-accessible disclosures.
- Providers show availability counts, inset fee/type details, loading skeletons, distinct failure/empty states, and persistent error notifications. Availability requests are serialized through disabled toggles while a request runs.
- Production build and diff whitespace checks pass. After initial navigation delays, the admin preview redirects to sign-in; authenticated layout review remains unverified. Admin TypeScript and ESLint pass. Removed one redundant borderRadius property in AI Usage that blocked the first TypeScript run; the shared inset style already supplies the effective radius. Existing bundle-size and ESLint module-type advisories remain.

### 2026-09-05 Admin authentication redesign and homepage illustration revision

- Rebuilt sign-in and password recovery around a shared, responsive auth layout with sculpted SVG chain artwork, sage/gold styling, inset inputs, a focused form panel, and consistent recovery/success states. Kept existing login/recovery API contracts; removed the nonfunctional Remember Me checkbox and unsupported status/security claims.
- Replaced the previous homepage screenshot treatment at the user's request: removed captured product images and enlargement dialogs, added four original SVG illustrations for stories, growth, collaboration, and community. Existing generated community artwork and interactive sculptures remain. This supersedes the live-app screenshot deliverable above.
- Admin desktop sign-in and 390px recovery reviewed; password visibility and native empty-email validation verified. Admin and marketing TypeScript, ESLint, production builds, and whitespace checks pass. Desktop illustration composition reviewed; both sites report no horizontal overflow at 390px. Existing bundle-size and ESLint module-type advisories remain.

### 2026-09-05 Homepage foundations strip

- Replaced four oversized statistic tiles and the standalone illustration above them with a compact shared neumorphic surface, inset icon tiles, subtle dividers, and descriptive copy. The four foundations explain cedi giving, web/mobile access, campaign review, and retained records.
- Preserved the marketing.stats CMS integration and custom values. Layout uses four columns on large screens, two on tablets, and stacked rows on phones.
- Production build, TypeScript, targeted ESLint, and diff whitespace checks pass. Both development and production browser previews rendered blank during this check, so visual acceptance remains unverified. Temporary production preview server stopped after inspection.

### 2026-09-05 Branded empty states and date/time controls

- Updated shared web/admin empty states with inset brand surfaces, more compact SVG illustrations, stable React IDs, and reduced-motion handling; upgraded the mobile empty-state presentation. Replaced plain campaign update/comment, QR-code, collaborator, donation-feed, and wallet empty messages with contextual guidance.
- Added shared MUI date/date-time/time pickers styled for light and dark themes, DD/MM/YYYY display, 24-hour time, clear/cancel/accept controls, and local ISO values. Migrated all six native date/date-time controls in campaign creation/editing, KYC, and coupon validity. Corrected existing campaign deadline initialization to preserve local-time display.
- Added a React Native Paper date picker for mobile KYC using the existing mobile theme.
- Live browser: campaign date selection updates the duration, past dates are disabled, clearing works, ArrowRight/Enter selection works, and the picker fits 390px without horizontal overflow. Web/admin production builds, UI type-check, targeted ESLint, and whitespace checks pass. Web, admin, and mobile type checks pass after correcting Date-to-string initialization. Campaign Updates empty state was visually verified in the live app. Added interaction tests, but both fork and thread test workers timed out before executing tests on this machine.

### 2026-09-05 Account menu descriptions

- Added short descriptions beneath Dashboard, My Campaigns, My Donations, Wallet, Affiliate, Settings, and Sign out in the account dropdown. Widened the menu within the viewport limit to accommodate the copy. Navigation and sign-out handlers are unchanged.

### 2026-09-05 Web dark-theme contrast repair

- Added mode-aware brand/text/status CSS tokens and corrected the dark semantic palette, neutral-surface chips, contained button contrast, and browser color scheme in the shared theme. Preserved the sage/gold palette and neumorphic surfaces.
- Replaced light-only text colors across Explore filters/pagination, campaign cards/forms, dashboards, histories, subscriptions, profiles, activity feeds, account menus, recovery screens, and related web components. Preserved intentionally paired cream badges and dark banners. Replaced hex-alpha concatenation with color-mix where status colors now use CSS variables.
- Browser verified: dark Explore titles/amounts use cream, metadata/filters use readable sage, funding status uses brighter semantic colors; Medical filtering returns two matching campaigns; action menu opens. Light-mode backgrounds and text remain correct. Mobile at 390px has no horizontal overflow. Authenticated routes received source-level fixes but could not be visually checked because the browser session is signed out.
- Web TypeScript and production build pass. Full-web ESLint reports 22 pre-existing React-hook errors in useLiveTotals, CampaignPublicPage, and DonateCallbackPage; theme changes do not alter those files. No claim of a complete authenticated route-by-route visual audit.

### 2026-09-05 Homepage campaigns and community activity redesign

- Replaced the uneven featured-card/sidebar layout with six equal campaign cards in a responsive three/two/one-column grid. Added a left-aligned introduction and an always-available Explore link; loading placeholders match the grid.
- Separated raised amounts and funding goals in shared campaign cards, aligned metadata, and added a subtle footer divider.
- Moved recent community activity below campaigns into six readable contribution cards. Donor, timestamp, amount, and campaign link have distinct lines; removed the clipped scrolling panel and decorative live indicator. Existing donation fetching and SSE updates remain active.
- Desktop browser confirms two even campaign rows and a three-column activity section. Mobile at 390px has no horizontal overflow. Targeted ESLint and production build pass.

### 2026-09-05 Campaign detail redesign

- Rebuilt /campaigns/:id with a wide title/header, campaign cover beside a raised funding panel, prominent gold donation action, sharing action, donor count, and deadline. Added a branded fallback for missing covers.
- Simplified the funding presentation to one raised total, goal, progress bar, and percentage. Remaining funding is clamped at zero.
- Added inset navigation tabs with associated tab panels, a comfortable story surface, and expandable QR/embed tools. Preserved donation, editing, deletion, reporting, update, comment, and sharing handlers.
- Browser verified the dark desktop page, light mobile page, donation dialog open/cancel, Updates tab, and mobile sharing disclosure with no horizontal overflow at 390px. Targeted ESLint and production build pass.

### 2026-09-05 404 and splash brand alignment

- Replaced the old splash symbols, hardcoded white background, and layered animations with the current chain-link logo, raised brand tile, themed text/surfaces, and one restrained indeterminate loading bar. Includes a polite loading status and a static reduced-motion state; no artificial loading delay.
- Rebuilt the 404 with a missing-link SVG, inset surface, current typography, and clear Explore campaigns / Back to home links. Removed legacy decorative symbols, delayed text reveals, and unrelated accent colors.
- Browser inspected the real loading fallback and completed dark 404, verified the home action and 390px overflow check. Targeted ESLint and production build pass.

### 2026-09-05 Campaign detail content and contract validation

- Audited the detail surface against mounted API routes, use cases, and live read responses; full evidence and limits in `docs/reviews/campaign-detail-content-audit.md`.
- Corrected wallet-only payment availability, guest sign-in return, deadline/amount/message checks, donation refresh, paginated history, beneficiary display, organizer failure handling, update validation/errors, and share/report behavior. Removed unsupported campaign edit/delete and broken embed controls from the detail page.
- Policy tests: 3 passed. Read-only API checks: 6 endpoints returned 200. Browser confirms actual wallet display, beneficiary, donation history and guest login routing.
- Found independently seeded raised totals and donation records; recorded the discrepancy without rewriting financial data. Owner mutations and live settlement remain unexecuted.
- Final verification: web production build, targeted ESLint, and 3 policy tests pass. Full TypeScript check ended with signal 143 before reporting a result; not marked as passed.

### 2026-09-05 Donor ranking hierarchy and overflow repair

- Replaced the crowded rank/avatar/name/amount arrangement with a first-place highlight: compact identity row, separate full-width contribution total, and contribution count. Remaining donors use ordered, compact rows with smaller avatars and explicit rank numbers.
- All-time and monthly rankings now sit side by side at desktop widths and stack on mobile. All grid tracks allow shrinking; long names and large amounts can wrap instead of being clipped. Loading placeholders match the responsive layout.
- Browser reviewed desktop hierarchy and verified zero overflowing donor rows and no page overflow at 320px. Web production build and targeted ESLint pass.

### 2026-09-05 Campaign organizer and payment card redesign

- Replaced the oversized full-width sections with two balanced inset cards, stacked on mobile. Organizer identity and verification are grouped together; start and closing dates have separate labeled columns.
- Replaced the isolated UF payment tile with a wallet icon, configured provider name, concise balance explanation, and the existing guarded donation/sign-in action. Loading, unavailable-provider, error, and closed-campaign states remain supported.
- Verification badge now inherits the page palette within this section. Public profile data and wallet-only filtering remain unchanged.
- Browser reviewed the rendered cards and confirmed no card/page overflow at 390px. Production build, targeted ESLint and whitespace checks pass.

### 2026-09-05 Registration theme contrast repair

- Replaced fixed dark registration text, step connectors, option borders, and inactive icons with theme-aware palette colors. Selected step and billing controls now use matching foreground/background pairs; account icons and sign-in links retain readable brand accents.
- Added selected-state semantics to account, plan, and billing buttons, active-step semantics, and visible keyboard focus for billing controls.
- Browser reviewed account selection in dark mode and plan selection in both dark and light modes. Details were filled with temporary preview values only; no account was submitted. Production build, targeted ESLint and whitespace checks pass.

### 2026-09-05 Admin provider theme, role access, and affiliate identity

- Fixed shared admin status-chip foregrounds and alert surfaces for dark neumorphic backgrounds. Payment-provider switches now respect update permission and cannot enable non-wallet integrations that the API rejects; unavailable methods explain why. Provider availability was not changed during verification.
- Reproduced Roles access denial for the signed-in Platform Admin. The API process was serving an older role policy despite current source granting admin access. Restarted the local API, reloaded the existing session, and verified System roles renders; no user-role/database privilege changes or client-side permission bypass.
- Admin affiliate listing now enriches names with one batched, name-only user lookup, excluding deleted users. Names appear in the user column, edit dialog, and payout labels, are searchable, and remain after edits. Missing accounts use an explicit unavailable label.
- Browser verified the current account can view Roles, referral code 37bvcth displays Platform Admin, and provider labels/switch states are readable and accurate. Admin production build and targeted ESLint pass; three isolated access-policy tests pass (admin allowed, ordinary user denied, unknown role empty). No payment toggle or account mutation submitted.

### 2026-09-05 Form icons across applications

- Added a shared branded TextField for web, admin and marketing forms. Email, identity, organization, location, phone, link, amount, search and text fields receive decorative leading icons. Existing adornments, currency units, dropdowns, and custom trailing actions take precedence. Password fields without a custom trailing action get an accessible visibility toggle.
- Adopted matching Paper/native input components on mobile auth, campaign creation, KYC, donation, refund and comment forms. Existing mobile search icons and date controls remain intact. Added icons to standalone newsletter inputs and coupon multi-select fields; compact pagination controls remain unchanged.
- All three browser application builds pass. Four component contract tests pass for email semantics, currency preservation, password controls, and multiline/disabled inputs. Browser preview timed out repeatedly; rendered visual review and device review are not claimed. Shared UI and mobile type checks pass. Lint passes for the shared components, adopted form files, and standalone newsletter/coupon fields. Whitespace checks pass.

### 2026-09-05 KYC statistics endpoint and input placeholders

- Traced the dashboard error to its missing GET /kyc/stats endpoint. Added authenticated admin routing, controller/use-case wiring and persisted pending/approved/rejected counts. Today's decisions use reviewedAt within Ghana's UTC day, with an exclusive next-day boundary. Restarted the local API to load the new route.
- Shared browser and mobile inputs now provide label/type-based placeholders while retaining explicit examples. Empty controlled dropdowns show selection prompts, and coupon selectors expose their existing all-tiers/all-cycles defaults. Existing native search/newsletter fields and date controls already provide hints.
- Three KYC contract tests pass (day boundaries, repository queries, admin-only routing); six shared-field tests pass, including placeholder preservation and empty selections. Web, admin and marketing builds pass. Shared UI type checking and targeted lint pass. Live unauthenticated GET /api/v1/kyc/stats now returns the expected 401 JSON instead of 404, confirming the restarted API has the route. Mobile and API type checks also pass. The API check completed successfully just before the attempted cancellation; its process had already exited with code 0. The focused KYC contract tests provide route, access, query and day-boundary coverage.

### 2026-09-06 Appearance menu grid redesign

- Replaced the marketing theme list with a responsive two-column card grid, stacking below 360px. Each skin has a distinct icon, title, short description and decorative inline SVG watermark; the active skin has a gold border and checkmark.
- Added a titled appearance dialog, accessible close control, visible keyboard focus and a separate labeled dark-mode switch. Style changes stay visible in the open panel and use the existing immediate-persistence handlers; dark/light mode remains independent.
- Marketing production build and whitespace checks pass. Browser preview could not complete because the browser connection timed out; no rendered visual verification is claimed. Targeted lint passes.

### 2026-09-06 Marketing dark-mode surface and navigation fixes

- Corrected desktop dropdown and mobile navigation text, icon tiles, active/hover states and dividers to use paired theme colors. The company menu no longer paints dark titles on dark surfaces.
- Removed forced light background/shadow-variable overrides from campaign categories, how-it-works, testimonials, CTA, affiliate benefits and organization feature sections. These now inherit the selected mode and material skin, keeping card surfaces and text in sync.
- Made category icons and step labels theme-aware; fixed the pricing comparison's forced white header and low-contrast availability icons. Fixed forest hero/footer palettes remain explicitly paired with light text.
- Source audit, marketing production build, targeted lint and whitespace checks pass. Browser-rendered verification is not claimed.

### 2026-09-06 Account menu grid redesign

- Replaced the web account dropdown list with a profile banner and responsive six-card navigation grid. Each destination retains its icon, title and description and adds a decorative SVG watermark, route highlight and visible keyboard focus.
- Added a close control and separate sign-out action; preserved existing routes and logout behavior. Theme-aware surfaces and text support light and dark mode, with wrapping for long profile details and a single-column layout on narrow screens.
- Web production build, targeted ESLint and whitespace checks pass. Browser-rendered visual verification is not claimed.

### 2026-09-06 Surface style consistency and settings picker

- Audited skin consumers across web, admin and marketing. Fixed frozen chip hover, input focus and selected-list shadows; theme palettes and baseline tokens now rebuild with the selected skin. Paper surfaces, hairline borders and shared geometry follow the selected finish. Dark-section shadows use skin-specific forest tokens, retaining paired brand colors.
- Replaced fixed neumorphic overrides in navigation, footers, campaign banners, marketing hero/organization sections and admin auth CSS. Decorative artwork and semantic focus rings remain purpose-specific. Minimal now restores correctly in web/admin; skin effects apply before paint.
- Redesigned web/admin settings selectors as a shared responsive two-by-two grid with icons, titles, descriptions, SVG watermarks, isolated finish previews, selected-state confirmation and keyboard focus. Each preview intentionally shows its own finish.
- Three cross-skin regression tests, shared UI type checking, all three browser app production builds, targeted ESLint and whitespace checks pass. Marketing rendered during browser inspection, but opening the appearance menu timed out; full interactive/visual verification remains outstanding.

### 2026-09-06 Member workspace polish and session expiry

- Both web API clients now invalidate rejected active sessions through the auth provider. Expiry checks also run while the app is open and on focus; stale responses cannot clear a newer login. Canonical tokens take precedence over legacy storage, and logout clears both. Protected routes show a session-expired sign-in prompt with the return location. Startup restoration and permission fetching are gated to avoid requesting with a stale token during refresh.
- Dashboard, campaigns, donations, affiliate and settings use shared structured skeletons; wallet retains its card/table skeletons. Affiliate lists also use skeleton rows. Failed data loads are no longer presented as empty donations, zero stats or editable default settings.
- Added consistent icon headings and decorative watermarks, improved dark-mode contrast and amount wrapping, corrected the campaigns dollar label/fabricated donor count and dashboard donations-made label, and added icons/focus states to all web footer links.
- Four session regression tests pass, covering both API clients, late responses, permission errors, unauthenticated login failures, token precedence and expiry parsing. Browser interaction timed out; rendered visual review is not claimed.
- Final web production build, web TypeScript check, targeted lint and whitespace checks pass. The initial TypeScript run caught an incorrectly placed settings loading return; it was moved outside the effect and the full check rerun successfully.

### 2026-09-08 — Organization type selector

- ✅ Replaced the registration dropdown with six responsive choice cards, each with a distinct icon, title, description, and selected checkmark. Uses existing theme colors and native radios for keyboard navigation; preserves API enum values and clears type validation on selection.
- Files: `apps/web/src/components/auth/OrganizationTypePicker.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`.
- Verification: web TypeScript check and production build passed; targeted ESLint and `git diff --check` passed. Browser visual review not performed.

### 2026-09-08 — Profile header redesign

- ✅ Rebuilt the profile header with a compact gold avatar, left-aligned identity, readable bio, separate verification panel, and flat edit/share actions. Responsive stacked mobile layout; removed decorative glow/wave and hard-coded trust score, verification level, and join date. Zero-month streak is hidden.
- Edit profile now scrolls to the settings and focuses the name field. Existing verification navigation and share action retained.
- File: `apps/web/src/pages/ProfilePage.tsx`.
- Verification: web TypeScript, production build, targeted ESLint and diff checks passed. Inspected desktop (1440px) and mobile (390px) browser previews with mocked API data; edit focus and mobile overflow checks passed. These previews do not verify live account data.

### 2026-09-08 — Profile header skin parity

- ✅ Replaced fixed header colors, radii, and shadow suppression with palette and shared skin tokens. Avatar, edit/share controls, verification panel, and icon inset follow the selected skin. Glass adds a subtle backdrop for its translucent panel; light/dark mode remains independent.
- Verification: TypeScript, production build, targeted ESLint, and diff checks passed. Browser screenshots captured all four skins in both modes at desktop and mobile widths using mocked profile API data. Visually inspected the eight-way desktop comparison and dark-glass mobile view; all eight mobile overflow and edit-focus checks passed.
- Visual comparison: `/tmp/profile-skins/comparison.html` and `/tmp/profile-skins/comparison.png`.

### 2026-09-08 — Campaign search and sort redesign

- ✅ Replaced the square search/sort fields with a labeled search surface, clear-search action, and custom sort menu with icons, descriptions, and selected checkmark. Uses shared skin surfaces, shadows, borders, blur, and geometry; mobile controls stack. Search trims surrounding whitespace before matching campaign titles.
- Files: `apps/web/src/components/campaigns/CampaignSearchBar.tsx`, `apps/web/src/pages/ExplorePage.tsx`.
- Verification: web TypeScript, build, targeted ESLint, and diff checks passed. Captured and inspected an eight-way desktop skin/mode comparison and dark-glass mobile menu. Browser checks with mocked empty campaign responses passed for search clearing, sort selection, menu dismissal, and mobile overflow in all eight variants. No live campaign-data verification claimed.
- Preview: `/tmp/campaign-search/comparison.png`; mobile menu: `/tmp/campaign-search/mobile-menu.png`.

### 2026-09-08 — Organization profile and cover images

- ✅ Missing or failed covers render a theme-aware patterned default; missing or failed profile images render organization initials. Owners have Change cover / Change photo editors with device upload, hosted HTTPS link, preview, save, and reset-to-default. Validation/save errors stay in the editor; successful saves show confirmation. Visitors have no editing controls.
- Added cover persistence through the user model/entity/repository and organization projection; authenticated profile updates accept avatar/cover URLs and public organization reads return saved values. Removed the unconditional verified-organization claim from the empty impact copy.
- Verification: API and web type-checks, web production build, targeted ESLint, and diff checks passed. Database-backed integration test covers persistence to personal/public reads, reset, authentication, URL validation, and cross-account protection. Mocked browser checks cover broken/empty images, both saves, reload/reset, mobile layout, and visitor controls; inspected desktop fallback and mobile editor. Device upload uses the existing Cloudinary helper; live provider upload not exercised.
- Visual artifacts: `/tmp/organization-image-fallback.png`, `/tmp/organization-image-editor.png`, `/tmp/organization-image-skins.png`.

### 2026-09-08 — Pricing layout and plan guidance

- ✅ Split plan selection into a three-column personal/growth group and a wider organization/enterprise row. Added a prominent Pro recommendation, audience-fit labels, and an inline current-plan status. Kept public custom tiers and the existing checkout/contact actions. Shared skin tokens control surfaces, geometry, borders, and shadows.
- Prices stay together; yearly monthly-equivalent amounts retain cents. Removed the blanket 17% savings claim because live plan prices can differ.
- Verification: web type-check, production build, targeted ESLint and diff checks passed. Browser previews with seeded fallback plans exercised four skins, annual toggle, Pro checkout dialog, and mobile card overflow; inspected light/dark desktop layouts. No purchase submitted.
- Previews: `/tmp/pricing-redesign-light.png`, `/tmp/pricing-redesign-dark.png`.

### 2026-09-08 — Admin report empty states

- ✅ Replaced one-line report notices with tailored empty states for monthly donations, categories, geography, and campaign status. Each has a distinct icon, clear heading, explanatory copy, and a short report-purpose caption. Shared skin surfaces, borders, shadows, and palette keep all themes consistent.
- Request failures have a separate cloud-off illustration, failure message, and Retry reports action. Empty campaign status uses the same treatment instead of zero-value bars. Loading skeletons and populated reports are preserved.
- File: `apps/admin/src/pages/ReportsPage.tsx`. Admin type-check, production build, targeted ESLint, and diff checks passed.
- Browser verification: captured all eight skin/mode combinations with mocked empty reports; error-to-retry recovery and mobile panel overflow checks passed. Preview sessions suppress the first-visit tour to inspect the actual panels. Visual artifacts: `/tmp/report-empty-skins.png`, `/tmp/report-empty-category.png`, `/tmp/report-empty-mobile.png`.

### 2026-09-08 — Overview empty-state coverage

- ✅ Extracted the Reports treatment into shared `EmptyReport` and applied it to all ten Overview sections, including the five screenshot targets: top campaigns, campaign categories, geography, status, and recent activity. Also covers donation trends, verification, payment methods, trust scores, and safety metrics.
- Each section handles loading skeletons, request errors with retry, empty data, and populated content separately. Removed the fixed eight-region claim; category charts with no positive totals render the empty state.
- Verification: mocked browser checks passed for the original nine empty sections, all five requested mobile states, region count, and report-error retry recovery. Inspected `/tmp/overview-empty-states.png` and captured `/tmp/overview-empty-mobile.png`. The additional safety section follows the same shared component.
- Final admin TypeScript, production build, targeted ESLint, and diff checks passed after adding safety-metrics coverage.

### 2026-09-08 — Admin pagination coverage

- ✅ Added shared pagination (12 records initially) to campaign/beneficiary payouts, AI activity, plan management, and the geographic report table. Existing core admin lists retain their pagination. Payout view changes reset their pages; AI activity no longer silently slices at 20.
- Fixed Contact Submissions and Testimonials to request the selected page size, refetch when it changes, reset on status/type filtering, and retain controls for smaller result sets. These pages now use the admin session token rather than public-app storage keys.
- Verification: admin TypeScript and production build passed; targeted lint and diff checks passed. Mocked browser verification exercised payout row limits, next/last navigation, page-size reset, mobile controls, and server pagination request parameters. Preview: `/tmp/admin-pagination-mobile.png`.

### 2026-09-08 — Payout request failure

- ✅ Reproduced live HTML 404 for `/api/v1/payouts/review-queue` through admin port 8400 and API port 8100. Existing API watcher/child had been running since September 6 and had not picked up current routes. Restarted that local API from current source; observed an authenticated live review-queue request returning 200. All payout routes now respond with authentication protection instead of missing-route HTML.
- Admin API errors now preserve server messages/errors and provide meaningful non-JSON HTTP fallbacks. Payout request failures render a failure state instead of “Nothing needs attention.”
- Verification: new database-backed integration test confirms three admin list endpoints return arrays, require authentication, and deny non-admins. Browser HTML-404/refresh recovery check passed. Admin TypeScript, lint, production build, and diff checks passed. No payout was approved or transferred.

### 2026-09-08 — Marketing feature content refresh

- ✅ Added `/features` with six linked categories covering creator pages, tips and withdrawals, collaboration, campaign updates and LIVE, organisation profiles, checkout methods, payout review and split proceeds, plans/coupons/referrals, verification/reporting, and appearance skins/image defaults. Availability language reflects plan, configuration, and eligibility constraints.
- Added Features navigation and footer entry, replaced the homepage feature previews, and refreshed organisation, pricing FAQ, help FAQ, and signup CTA copy. Removed stale paid-billing-paused and wallet-only claims; organisation plan CTA now links to the API-driven pricing page.
- Verification: marketing TypeScript, ESLint, and production build passed (existing module-type and bundle-size warnings only). Browser checks passed for six sections, six homepage links, organisation pricing link, absence of stale paused copy, zero page errors, and no horizontal overflow at 390px. Visually inspected `/tmp/marketing-features-desktop.png` and `/tmp/marketing-features-mobile.png`. No deployment performed.

### 2026-09-08 — About page operating model spacing

- ✅ Replaced the stretched two-by-two operating-model cards with four compact numbered rows beside the existing editorial image. Added concise supporting details, improved body contrast, and balanced desktop column widths. Semantic ordered steps stack naturally on mobile; forest shadows, borders, blur, and corners respect the selected skin.
- Corrected the About hero trust link to the actual section and updated contribution wording to include current payment methods.
- Verification: TypeScript, marketing lint, production build, and diff checks passed (existing build-size/module-type warnings). Browser verified four steps across all four skins at 1440, 768, and 390px with no horizontal overflow or page errors. Inspected desktop, mobile, and minimal-skin screenshots at `/tmp/about-journey-{desktop,mobile,minimal}.png`.

### 2026-09-08 — About commitments redesign

- ✅ Replaced three separate recessed cards with a unified editorial panel: distinct principle icons, category labels, numbered markers, fine dividers, concise descriptions, and practical takeaways. Revised the section heading and aligned the adjacent philosophy panel without stretching either column.
- Uses shared surface, shadow, border, blur, and shape tokens for all design skins.
- Verification: marketing TypeScript, lint, build, and diff checks passed. Browser checked three commitments in light/dark modes across all four skins at desktop/mobile widths with no overflow or page errors. Inspected `/tmp/commitments-dark-1440.png` and `/tmp/commitments-light-390.png`. Existing module-type and bundle-size warnings remain.

### 2026-09-08 — Confirmed leadership profile

- ✅ Replaced the launch-team placeholder with Stanley Asoku Hayford, his supplied root portrait (copied into marketing public assets), short engineering bio, and Founder & Principal Engineer · NeuroDyne Corp title verified on neurodyne.dev. Added portfolio/company links and LinkedIn, GitHub, X, and Instagram links read from the live portfolio.
- Updated CMS seed defaults and provided a narrow fallback for existing `Ujimora Team` CMS placeholders, while preserving real edited leadership records. Portrait uses initials fallback if loading fails.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser confirmed the live legacy CMS record renders Stanley, portrait loads, six external links render, placeholder copy is absent, and mobile has no overflow. Inspected `/tmp/stanley-profile-mobile.png`.

### 2026-09-08 — Squarer form controls

- ✅ Added independent `SHAPE.input` / `--shape-input` token fixed at 6px across skins. Shared web/marketing and admin outlined/filled controls enforce this radius over older page overrides; adjusted custom admin search, campaign search, newsletter fields, and admin auth styles.
- Card, button, chip, and other surface shape tokens remain unchanged.
- Verification: admin, web, and marketing TypeScript and production builds passed; targeted ESLint and diff checks passed. Browser computed all outlined field radii as 6px on admin login, web login, and marketing contact after cycling skin preferences. Inspected `/tmp/admin-input-radius.png`.

### 2026-09-08 — Features page illustrations

- ✅ Added three existing original SVG scenes for creators, collaboration, and growth with short captions and light/dark colours. Added quiet category-icon watermarks behind feature content, hidden from assistive technology. Balanced creator cards vertically and let odd final cards span the row.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser verified three accessible SVG illustrations in light/dark desktop/mobile layouts with no overflow or page errors; inspected `/tmp/features-art-final.png` and `/tmp/features-art-mobile-dark.png`.

### 2026-09-08 — Full-row leadership profile

- ✅ Moved leadership out of the philosophy card into its own full-width section below the commitments. Enlarged the portrait beside the biography; mobile stacks the photo above the content.
- Replaced loose text buttons with two descriptive destination tiles and a compact social-icon row with accessible link names, hover/focus states, and 44px targets.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser confirmed the independent section, six preserved links, and no desktop/mobile overflow; inspected `/tmp/leadership-wide-1440.png` and `/tmp/leadership-wide-390.png`.

### 2026-09-08 — Marketing pricing parity and contrast

- ✅ Matched subscription-page audience grouping: up to three personal/growth cards, then two organisation/enterprise cards. Added fit labels, a gold Pro recommendation outline/action, and theme-aware fees/checkmarks instead of unreadable configured accent colours.
- Updated cycle controls with selected-state semantics and readable colours, preserved yearly decimal precision, linked paid choices to the web subscription page, removed stale preview-only copy, and made detailed comparison horizontally scrollable on narrow screens.
- Browser verification: light/dark desktop and mobile, yearly toggle, two groups, no overflow/page errors; inspected `/tmp/pricing-group-dark.png`. Marketing type-check, lint, build, and diff checks run for this change.

### 2026-09-08 — Marketing page transitions

- ✅ Added coordinated 150ms outgoing fade and 380ms incoming reveal across marketing routes, including the homepage. Routes retain the outgoing content during exit; pending route changes cancel cleanly. Removed the duplicate inner-page entry animation.
- Same-origin native links now use SPA navigation while preserving router links, external links, modified/new-tab clicks, downloads, and same-page anchors. Scroll reset follows the displayed page. Keyboard navigation and reduced-motion preferences bypass animation; reduced-motion hash scrolling is immediate.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser verified document-preserving navigation, Back, section hashes, reduced-motion CSS, rapid successive routes, and no page errors.

### 2026-09-08 — Campaign creation plan enforcement and workflow audit

- ✅ Added authenticated `/campaigns/creation-options` resolving the same DB-backed effective plan/compliance cap as server creation. Form fails closed when limits cannot load, shows the current cap/usage, and blocks excessive goals or unavailable capacity. Server now rejects non-finite goals, invalid/end dates, non-GHS campaign goals, and excess media; entitlement reads do not silently substitute seed caps after DB read failures. Paid entitlements expire by billing/trial end as well as status.
- ✅ Found and fixed a browser submit-default bug: the goal-step Continue button could become a submit button during its click and publish before the review step. Cancelled that click default and blocked submission outside review. Preserved regression in `apps/web/e2e/campaign-plan-enforcement.spec.ts`.
- ✅ Added creation-time editor invitations and optional split allocations, gated by server-provided capabilities. Split draft creation/activation requires the owner's current collaboration + escrow features and the platform split flag. Invitations retain server feature/count guards; accepting old invitations rechecks current owner entitlement/count. Positive collaboration revenue shares require escrow entitlement.
- ✅ Optional setup failures retain the created campaign and offer retry of only unfinished requests. Split setup remains a draft until explicit beneficiary acceptance recording and activation; owners can return to this workflow on the campaign detail page. Success copy follows actual campaign status. Sharing on live success now offers WhatsApp, Facebook, X, LinkedIn, copy/Instagram, and native device sharing; sharing is not artificially paywalled.
- ✅ Restarted the stale local API watcher (old process did not recognise the new endpoint) from current source with polling enabled; live creation-options now returns the expected unauthenticated 401 instead of treating it as an invalid campaign ID.
- Verification: 26 targeted unit tests, 11 integration tests across creation enforcement/split configuration/accrual/beneficiary payouts passed across runs. Updated eligible split fixtures to Pro and its 2.5% fee rather than retaining Free-plan assumptions. Playwright regression passed with mocked UI API responses: cap enforcement, no creation before review, one creation, failed invite retry, one split, social menu. API/web TypeScript, targeted lint, web production build, and diff checks passed. No production campaigns, invitations, subscriptions, or payouts were modified by verification.

### 2026-09-08 — Blog newsletter shadow correction

- ✅ Scoped the dark blog newsletter panel to the shared forest surface variables so its gold Subscribe button uses the selected skin's dark shadows instead of a bright light-mode halo. Input, card, and button shapes retain their existing skin settings.
- Verification: marketing TypeScript and targeted ESLint passed. Browser checked `/blog` in light and dark modes; Subscribe uses dark/sage shadows in both. Inspected `/tmp/blog-newsletter-light.png`.

### 2026-09-08 — Explain campaign creation eligibility accurately

- ✅ Replaced the combined campaign/verification limit warning with explicit API reasons: verification required, verification campaign allowance exhausted, or active plan capacity exhausted. Unverified first-time creators see a verification explanation and `/kyc` action instead of an upgrade prompt.
- Verification: integration regression passed for zero-campaign unverified, verified eligible, and active-plan-full accounts. Mocked browser verified verification copy and `/kyc` link. Web TypeScript and targeted lint passed. API TypeScript is blocked by the existing payout repository missing `attachTransferDetails`; no payout files changed in this slice.

### 2026-09-08 — Blog newsletter skin surfaces

- ✅ Newsletter panel now consumes skin shadow, border, and blur tokens; email field uses the skin's inset surface. Glass receives a translucent forest background. Preserved gold CTA, forest colors, and 6px input corners; improved placeholder and keyboard-focus visibility.
- Verification: browser checked all four skins and inspected neumorphic/clay screenshots. Marketing TypeScript, targeted lint, and diff checks passed.

### 2026-09-08 — Admin users and member detail redesign

- ✅ Removed the detail page's hard-coded black/purple background and pale text; profile, compliance, activity, loading, and error states now follow semantic theme colors and selected skin surfaces. Added avatar fallbacks, readable account metadata, verification guidance, and a back link.
- ✅ Replaced inert Verify/Suspend/Ban controls with a working verification-workspace link; preserved compliance-limit saving. Added pagination for loaded member activity and explicit activity errors/loading rather than false empty results. Activity remains sourced from the existing recent platform feeds.
- ✅ Simplified user directory cards, widened desktop columns, preserved pagination, reset pages on filter changes, and added clear-filters recovery.
- Verification: admin TypeScript, targeted ESLint, production build, and diff checks passed. Browser used mocked API data on both routes across four skins, light/dark and 390/1440 widths: no overflow or page errors. Inspected desktop screenshots after dismissing the onboarding tour. No live user records were changed.

### 2026-09-08 — Category icons and admin collection views

- ✅ Replaced creation-category diamonds with distinct category icons and a generic fallback; raised/inset surfaces and blur follow the selected skin with an explicit selected border and accessible pressed state.
- Category management audit: creation uses the shared CampaignCategory enum, with matching API enum validation. No admin category CRUD exists. Used the owner's offered UI-only scope; adding arbitrary categories still requires a shared schema/code change.
- ✅ Added reusable Cards/Table control and horizontally scrollable semantic table for admin users/campaigns. Each collection remembers its layout locally; both layouts share filters and pagination. Filter changes reset to the first page. Removed campaign cards' fabricated update counts and inert moderation buttons; records link to campaign detail.
- Verification: admin/web TypeScript, targeted lint, admin build, diff checks passed. Mocked browser checked table rows, card switching, reload persistence, light/dark desktop layouts and narrow layouts. Category selection and seven icons checked in all four skins; inspected category and table screenshots.

### 2026-09-08 — Help support card redesign

- ✅ Replaced pale cards and white halos in the forest contact band with dark skin-aware surfaces, gold inset icon holders, readable descriptions, and clear contact links. Skin geometry, shadows and glass blur remain responsive to appearance settings; mobile cards stack.
- Replaced conflicting response-time promises with practical contact guidance.
- Verification: marketing TypeScript and targeted lint passed; browser checked all four skins at desktop/mobile widths without horizontal overflow. Inspected `/tmp/help-support-neumorphism.png`.

### 2026-09-08 — Searchable KYC nationality

- ✅ Replaced free-text nationality with a searchable country autocomplete, retaining a string in the existing API payload. Only listed selections are accepted; clearing/unmatched typing cannot advance the nationality step or submit. Popup surfaces follow the selected skin and existing input geometry.
- Verification: web TypeScript and targeted lint passed. Browser checked Ghana search/selection, clearing, unmatched input blocking, and keyboard Canada selection. No KYC submission sent.

### 2026-09-08 — Subtle help accordion borders

- ✅ Replaced bright fixed FAQ outlines with low-opacity forest/sage borders for light/dark modes. Hover and expanded outlines stay subtle; selected skin surfaces remain intact.
- Verification: marketing TypeScript and diff checks passed; browser checked FAQ border styling and expansion.

### 2026-09-08 — Consistent 4 MB image limit

- ✅ Reduced shared upload label and browser size validation from 10 MB to 4 MB. Profile/cover editors reuse the same exported limit for validation and messaging. Upload transport remains direct to Cloudinary.
- Verification: web TypeScript, targeted lint, and diff checks passed.

### 2026-09-08 — Responsive KYC steps and uploads

- ✅ Replaced the overflowing mobile stepper with current-step text and a compact four-part indicator. Desktop retains labelled steps. Front/back uploads and paired address fields now stack below 600px, with shrinkable columns above that width and reduced mobile padding.
- Verification: browser traversed all four steps at 320/390/768px with no horizontal overflow; upload positions confirmed vertical stacking on phones and side-by-side at tablet width. Inspected mobile screenshot. Web TypeScript, targeted lint, and diff checks passed. No documents uploaded or KYC submitted.

### 2026-09-08 — Support card SVG watermarks

- ✅ Added oversized, low-opacity gold email/chat/group SVG watermarks in support card corners, clipped within skin surfaces and excluded from interaction/accessibility. Inspected browser screenshot `/tmp/help-watermarks.png`; lint and diff checks passed.

### 2026-09-08 — Personal and organisation image editing

- ✅ Added personal profile cover display/default and visible Change cover / Change profile image controls using the shared editor. Images load independently of analytics, save through the authenticated profile endpoint, and render immediately. Broken covers fall back safely; avatars retain initials. Organisation owner controls already existed; clarified Change logo label.
- Verification: web TypeScript and targeted lint passed. Mocked browser checked personal avatar/cover saves, reload display, restore default, and 390px overflow; checked organisation owner controls save avatar/cover fields and visitors cannot see editors. Shared editor retains 4 MB validation and upload/URL preview. No live account records changed.

### 2026-09-08 — Default profile artwork

- ✅ Added local SVG fallback artwork: personal portrait, organisation building, and linked-shape landscape cover. Applied to personal and organisation profiles and organisation directory logos. Uploaded images take priority; missing/failed avatar images render artwork via Avatar fallback, while failed covers expose the background art. Artwork inherits semantic skin colors and needs no external image request.
- Verification: web TypeScript, targeted lint, diff checks passed; inspected mobile profile fallback screenshot with no horizontal overflow.

### 2026-09-09 — KYC address selection, dashboard actions, and admin sign-in

- ✅ Added `country-state-city` searchable country/region/city controls using the brand's themed dropdown surfaces. Country/region changes reset dependent selections; unlisted towns allow manual entry and postal code is optional.
- ✅ Ghana residents can choose GhanaPost GPS or document proof. GPS format is validated, persisted in the KYC record and shown to admin reviewers; document submissions require street address and proof upload. GPS remains subject to manual review, with no automatic location/ownership verification. Older clients retain their existing API contract.
- ✅ Dashboard New Campaign, Invite Friends and My Donations navigate to creation, the affiliate invitation workspace and donation history.
- ✅ Admin login excludes stale bearer tokens and displays credential errors instead of incorrectly calling every login 401 an expired session. Protected-request expiry clears all three authentication storage entries; incomplete stored sessions no longer restore authenticated state.
- Verification: API address-validation/model regression passed; three mocked Playwright tests passed for mobile GPS submission, dependent location resets and quick-action navigation. Four admin HTTP authentication regression tests passed. Web/admin/API type checks, targeted lint, web/admin builds and diff checks passed. Inspected mobile address screenshot. Live admin credentials and provider verification were not exercised.
- Build note: country-state-city's worldwide dataset adds a large KYC route chunk (about 2.4 MB gzip); it is isolated from the initial application bundle by route loading. Builds retain chunk-size warnings.

### 2026-09-09 — Admin KYC document visibility

- ✅ Fixed detail dialog rendering only document metadata despite receiving file URLs. Each document now shows an image preview or PDF viewer plus a labelled Open original link, using the existing themed surfaces.
- ✅ Added loading skeletons, image-preview failure recovery, invalid/missing URL messaging, safe HTTP(S) links, distinct document numbering, missing-date fallback and zero-document guidance for GPS submissions.
- Verification: four component regressions passed for image loading, failed previews, PDF query-string URLs and unsafe URLs. Admin TypeScript, targeted lint, production build and diff checks passed. Production member documents were not accessed; PDF availability remains dependent on the upload host/browser.

### 2026-09-09 — Profile upload consistency and campaign display accuracy

- ✅ Profile/cover editor now reuses campaign creation's shared ImageUpload control with preview, progress, replace/remove, the 4 MB cap and the same API upload transport (`profiles` folder). Square avatar and landscape cover previews retain explicit save/default controls. Save/close are disabled during upload.
- ✅ Fixed light-mode semantic chip text colors against the shared pale surface, including Critical and Urgent; existing dark-mode colors remain intact.
- ✅ Confirmed the dashboard campaign card hardcoded 147 supporters and four initials. Replaced them with API donorCount, correct singular/plural text and a neutral people icon. Verified `/campaigns/mine` already populates distinct donor counts via the donation repository.
- Verification: three mocked browser regressions passed for zero/one supporter counts, Critical badge computed color, and profile/cover upload plus save payloads. Inspected campaign urgency and image-editor screenshots. Web/UI TypeScript, targeted lint, production web build and diff checks passed; existing large-chunk warnings remain. No live member images changed.

### 2026-09-09 — Legacy wallet provider branding

- ✅ Canonical platform wallet providers now display Ujimora Wallet in the shared enabled-provider hook, even when persisted API records contain the old UbuntuFund name. Provider identifiers, availability and payment behavior are unchanged.
- Verification: mocked campaign-detail browser regression passed using the legacy API name and asserting Ujimora Wallet in How to donate. Web TypeScript, targeted lint and diff checks passed.

### 2026-09-09 — Campaign checkout access and wallet funding investigation

- ✅ Campaign detail's primary Donate now CTA and How to donate section link to the existing card/MoMo checkout without depending on the wallet-provider list. Existing-balance wallet donations remain secondary. Closed campaigns disable checkout links.
- ✅ Public campaign resolution falls back to a valid Mongo ID when a vanity slug is missing, so legacy detail pages can use checkout. Added regression for ID resolution and missing-slug handling.
- ✅ Wallet and campaign copy explain that external top-ups are not implemented and hosted donations fund the campaign directly, not the user's wallet.
- Production read-only findings: enabled-provider endpoint returns only the legacy-named wallet; crypto-assets endpoint returns enabled:false and no assets. Render blueprint enables Paystack but requires dashboard-provided keys. Local production env has a Paystack test key; this does not establish deployed key mode or payment readiness. No access to deployed secret configuration was established and no payment transaction was initiated.
- Crypto blocker: app.ts registers only MockCryptoProvider; enabling the feature is not a live-provider integration. Production crypto remains disabled pending real provider implementation/configuration.
- Wallet finding: registration creates a zero-GHS wallet; wallet routes are read-only. No self-service top-up initialization/webhook flow exists. depositAtomic calls in donation use cases compensate failed wallet debits rather than load external funds.
- Verification: nine mocked browser tests passed, covering guest checkout navigation for slug/legacy ID campaigns with no wallet providers, crypto off/on flows at mobile/desktop, and the earlier profile/branding fixes. Legacy public API regression, web/API type checks, targeted lint, production web build and diff checks passed. Large bundle advisories remain. Hosted payment configuration and real settlement are not externally verified.

### 2026-09-09 — Wallet funding and real crypto providers (engineering implemented; external acceptance pending)

- Scope: Paystack-verified wallet top-ups with atomic ledger/balance settlement; current-contract crypto provider implementation and provider-pinned routing. Existing unrelated profile/campaign changes remain pending in this worktree.
- Provider research: supplied crypto DOCX names Yellow Card, Paychant and Bitnob. Current Bitnob documentation supports address issuance, authenticated rates, signed deposit webhooks and transaction reconciliation. Yellow Card custody docs expose vault/address creation but the documented transaction-list example currently describes sends; receipt correlation/reconciliation requires provider confirmation before it can act as a reliable fallback. Paychant primarily documents a hosted on/off-ramp widget.
- Live keys: Paystack approval pending per owner; build/test against test-mode contracts. Crypto sandbox credentials requested; no live enablement or claim of external verification.

- ✅ Added authenticated Paystack wallet top-up checkout, availability/test-mode display, owner-only status verification, signed webhook dispatch and pending-payment reconciliation. Wallet balance, history and balanced journal settle atomically with duplicate-credit protection. The full top-up credits the wallet; Ujimora absorbs processor fees.
- ✅ Implemented Bitnob against its current HMAC API: allowlisted USDT/USDC networks, decimal quotes, idempotent receiving addresses, signed webhooks and authenticated receipt reconciliation. Exact amount/asset/network verification precedes campaign settlement. Production excludes mock providers.
- ✅ Added ordered quote/discovery fallback routing and provider-pinned deposits. Only Bitnob is a real registered adapter; Yellow Card requires authoritative receive contracts and sandbox verification before it can be registered. No second live adapter is claimed.
- Verification: 22 payment integration tests passed across wallet, Bitnob, existing Paystack and crypto suites; latest targeted rerun passed 11 tests. Provider-routing contract passed. API, web and admin TypeScript checks passed. Provider calls are mocked; no credentialed sandbox or live payment was run.
- Setup, limits and provider sources: `docs/payments/wallet-funding-and-crypto-providers.md`. Crypto remains disabled pending credentials and sandbox acceptance. Paystack live keys remain pending owner approval. This entry supersedes the earlier no-top-up/read-only-wallet findings for the local implementation, not the deployed application.
- Browser verification: two wallet top-up regressions passed, covering authenticated/idempotent hosted checkout, pending-to-confirmed feedback and initialization failure. Targeted lint and diff checks passed.
- Owner confirmed Bitnob account creation and authorized commit/push. Bitnob is the initial provider; secondary-provider onboarding remains deferred. Crypto stays disabled until credentials and sandbox verification are complete.

### 2026-09-09 — In-app live broadcasting, appearance and mobile menu

- ✅ Reworked Go live into a preview/workspace plus session setup. Panels now use the selected Settings appearance tokens; no separate overlay-design picker remains. Mobile menu has SVG icon/chain watermarks, grouped navigation, active/focus states and selected-skin surfaces.
- ✅ Audited the original live flow: fundraising API/SSE worked, but video transport was absent, session recovery depended on browser storage, repeat starts were not protected, and public live QR destinations had no viewer route.
- ✅ Added owner-only server recovery, one-active-session uniqueness/idempotent start, public active-session discovery, authenticated publishing/guest watch-only LiveKit tokens, host media controls, public viewer routes, viewer donation attribution and provider-room shutdown on End. New broadcasts are disabled until video credentials are configured.
- ✅ Added static pre-live overlay preview, controlled cross-origin framing, authoritative overlay refresh, and current token/session/privacy revalidation for live SSE delivery and replay.
- Verification: 17 API tests, seven frontend regressions and one static overlay contract passed. Browser inspected mobile menu SVG watermarks, desktop studio and selected claymorphism on mobile with no horizontal overflow. Production web build passed with existing KYC and new lazy video chunk size advisories.
- External acceptance pending: LiveKit Cloud project credentials, real camera/audio/screen-share + guest playback/reconnection/shutdown checks, production index preflight and Paystack live acceptance. Setup and operational limits: `docs/live-broadcasting.md`. No live broadcast or real payment was initiated; publishing is authorized below.
- Final validation: 15 short-link/QR regressions also passed; API/web/admin type checks and targeted lint passed. Video remains a credential-gated integration, not a claim of externally verified media transport.
- Owner confirmed streaming credentials are ready and authorized publishing to main. Added LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to render.yaml as dashboard-managed values, with existing-service manual-entry guidance. Credentialed broadcast acceptance remains pending after the owner configures Render.
