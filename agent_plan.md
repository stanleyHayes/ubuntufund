# UbuntuFund Monorepo — Production Completion Ledger

> Active completion pass started: 2026-08-09
> Goal: production-complete web, mobile, API, marketing, admin, and organization experiences with App Store readiness, CMS-backed public content, soft deletion, and verified frontend/backend parity.

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
- Added `PRODUCT_NAMING.md` with a live collision/domain screen. `Ubuntu Fund` is already used by an active fundraising organization and Android product; the recommended legal/audience-test finalists are TumiRaise and SikaSpring.
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
- Rendered QA exposed and removed the last hero claim for unsupported mobile-money payouts. Mobile campaign detail now advertises UbuntuFund Wallet only; web Terms and marketing Privacy copy no longer claim unconfigured fees, payouts, payment processors, or identity-verification partners.
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
  - `credentials.txt` — contains MongoDB URI (`mongodb+srv://ubuntufund_db_user:b49X2AFJ9uVuzBch@...`), demo passwords (`ubuntu2026`, `admin`), API endpoints.
  - `apps/api/.env` — contains `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `RESEND_API_KEY`.
- **Risk:** Credentials are permanently in Git history; anyone with repo access can connect to production DB, forge JWTs, or send emails.
- **Fix:**
  1. Rotate **all** secrets immediately (MongoDB password, JWT secrets, Resend API key).
  2. Add `.env` and `credentials.txt` to `.gitignore`.
  3. Purge from Git history (`git filter-repo` or BFG).
  4. Use environment-specific secrets via CI/CD variables.

### 3.2 Weak / Identical JWT Secrets
- **File:** `apps/api/.env`
- **Issue:** `JWT_SECRET` and `JWT_REFRESH_SECRET` are identical (`b49X2AFJ9uVuzBch`) and short/weak.
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
