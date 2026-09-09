# Unfinished features and dead-code audit — 2026-09-09

## Resolutions

- **AI writing:** built the OpenAI provider, authenticated writing/config routes, MongoDB usage and atomic daily quotas, campaign Story assistant with explicit preview/apply, and real paginated admin usage. Deployment variables are in Render and `.env.example`; see `docs/ai-writing.md`. No live provider call claimed.
- **RBAC:** the supplied audit overstated backend support. `/rbac/me` returns canonical code-defined permissions; there are no custom-role save or invitation endpoints. Removed mock CreateRole/EditRole/InviteUser forms and unused PermissionGate. Retained the routed, deliberately read-only System roles page, active admin permission provider and route guards. No custom-role management was introduced. Removed the web permission context after confirming its only consumer was the orphan gate; server authorization remains enforced.
- **Affiliate marketing:** routed `/affiliates`, linked navigation/footer and sitemap, corrected production app fallback and payout-destination wording. The existing affiliate backend and dashboard remain the source of enrollment, commission and payout behavior.
- **Admin mock data:** generators were unused, but live pages imported real view types from the module. Moved those types to `apps/admin/src/types/api.ts` before deleting the generators.
- **Orphans:** removed the audited unused web/mobile/marketing/API modules and the mobile scratch file, after checking imports and Expo route entries. Kept the active mobile push service and navigation routes; removed only its unused helper functions. Removed a duplicate web test setup and unused RN stub.
- **Dependencies:** removed unused API Stripe/Cloudinary SDK/ioredis/resend/axios, web/UI GSAP, admin data grid, unused cookie-signature declarations and unused Jest-specific mobile extensions. Kept marketing GSAP/SplitText, the fetch-based Cloudinary uploader, mobile Paper icons, and `pino-pretty` used by the logger transport. Declared missing coverage providers, UI Vite types and Expo/navigation dependencies used by configuration or imports.
- **Exports/types:** reviewed the remaining Knip findings, removed unused declarations/re-exports and redundant aliases, and made internal helpers/types private. Kept the KYC statistics type exported with an explicit use-case return annotation because declaration generation requires it. Removed a config package export pointing to a nonexistent ESLint file.
- **Tooling:** `npm run lint:unused` now provides a clean, reproducible audit. Knip explicitly recognizes node-test entrypoints and API scripts, including `seed-dev.mjs`. Narrow dependency exceptions preserve root React singleton versions, mobile Paper's runtime icon dependency and Pino's string-named transport. No blanket source exclusions were added.
- **Paid subscriptions:** the 409 guard remains intentional; its message now tells callers to use Paystack billing checkout rather than implying that paid subscriptions are unavailable.

## Verification and additional findings

- All seven workspace type checks and lints passed. API, web, admin and marketing production builds passed; Vite reports existing large chunks.
- Web: 32 tests passed. Admin: 15 tests passed. Mobile's configured Vitest suite: 5 tests passed. The mobile runner selects `.test.ts`; native `.tsx` component tests remain outside that existing runner, so native UI execution is not claimed.
- API full suite initially passed 376/379 tests. Two wallet failures were caused by using standalone MongoDB for transaction tests. One live-session failure exposed first-request index readiness: the repository now awaits model initialization before saving, ensuring the unique active-session index is ready.
- A focused rerun on a dedicated MongoDB replica set passed all 14 tests across live sessions, wallet top-ups and the new real-application AI authorization test. AI provider/quota tests separately passed 9/9. The dedicated test database/container is disposable and uses no production data.
- Three stale homepage assertions were updated to current copy and real skeleton behavior; the loading test now changes the hook result rather than registering a late ineffective mock.
- `git diff --check` and the unused-code audit pass. Tooling tests and seed scripts were preserved. No production deployment, paid-provider call, or Git push is part of this audit verification.

The zero TODO/FIXME/HACK claim holds for tracked application/package source; a tracked generated Playwright report contains incidental matches and is not application source. Marker counts alone do not establish implementation completeness.
