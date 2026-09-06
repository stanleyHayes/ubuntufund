# Ujimora Web and Mobile Feature Parity

Last verified: 2026-09-06

This matrix covers user- and organization-facing capabilities that are appropriate on both clients. Admin operations remain in the dedicated web admin console.

| Capability | Web | Mobile | Backend contract | Status |
|---|---|---|---|---|
| Register and sign in | `/register`, `/login` | auth routes | `/auth/*` | Equal |
| Forgot password | `/forgot-password` | `/forgot-password` | `/auth/forgot-password` | Equal |
| Browse and search campaigns | `/explore` | Explore tab | `/campaigns` and `/campaigns/search` | Equal |
| Campaign detail | `/campaigns/:id` | `/campaign/:id` | `/campaigns/:id` | Equal |
| Wallet-backed donation | campaign donation flow | campaign donation flow | `POST /donations`; wallet only | Equal |
| Campaign updates | campaign detail | campaign detail | `/campaigns/:id/updates` | Equal |
| Campaign comments | campaign detail | campaign detail | `/campaigns/:id/comments` | Equal |
| Report campaign | campaign detail | campaign detail | `/reports` | Equal |
| Create campaign | `/campaigns/new` | Create tab and `/campaign/create` | `POST /campaigns` | Equal |
| Own campaigns | `/my-campaigns` | `/my-campaigns` | `/campaigns/mine` | Equal |
| Dashboard | `/dashboard` | `/dashboard` | scoped campaign, donation, wallet APIs | Equal |
| Donation history | `/donations` | `/my-donations` | `/donations/mine` | Equal |
| Refund request and history | `/donations/refund/:id`, `/refunds` | `/refund-request`, `/my-refunds` | `/refunds` and `/refunds/mine` | Equal; settlement remains manual |
| Wallet balance and activity | `/wallet` | Wallet tab | `/wallets` and `/wallets/:id/transactions` | Equal |
| Organization directory | `/organizations` | `/organizations` | `/organizations` | Equal |
| Organization profile and campaigns | `/organizations/:slug` | `/organization/:id` | `/organizations/:slugOrId`, `/:id/campaigns` | Equal |
| Collaboration invitations | `/invitations` | `/invitations` | `/collaborations/invitations` | Equal |
| KYC submission/status | `/kyc` | `/kyc`, `/verification` | `/kyc/*` and `/verifications/*` | Equal |
| Leaderboard | `/leaderboard` | `/leaderboard` | `/leaderboard` | Equal |
| Profile | `/profile` | Profile tab and public profile route | `/profile`, `/users/:id/public` | Equal |
| Settings and account deletion | `/settings` | `/settings` | profile/settings APIs and `DELETE /profile` | Equal |
| Appearance (dark mode + design skins) | Settings → Appearance + Design finish | Settings → Appearance + Design finish | client-side preference (persisted) | Equal; all 4 skins on both platforms (see Theming) |
| Subscription plans + paid checkout | `/subscription` | Subscription tab (Paystack checkout sheet) | `/subscriptions/*`, `/subscriptions/checkout` | Equal; live once `PAYSTACK_SECRET_KEY` is set |
| Coupon codes at checkout | subscribe checkout dialog | subscription checkout sheet | `/coupons/preview` + checkout body | Equal |
| Affiliate program | `/affiliate` | `/affiliate` (Profile menu) | `/affiliate/*` | Equal |
| Privacy and terms | `/privacy`, `/terms` | `/privacy`, `/terms` | bundled public copy | Equal |

## Theming (appearance)

- Both clients persist a Light / Dark / System appearance preference, chosen in
  Settings → Appearance. Web reads it from a color-mode context; mobile from a
  color-mode context backed by AsyncStorage, defaulting to the OS setting.
- All four **material skins** (neumorphism, claymorphism, glassmorphism,
  minimal) now exist on **both** web and mobile, chosen in Settings → Design
  finish. Web uses CSS variables / backdrop-filter; mobile uses mode-aware
  recipe tables (`getNeu(scheme, skin)`), so every surface reading `useNeu()`
  picks up the finish for free. Mobile glass renders as frosted-translucent
  panels app-wide plus real `expo-blur` backdrop blur on primary cards via the
  `GlassSurface` component (real blur is most visible over imagery; flat-
  background surfaces use the frosted recipe).
- Mobile dark mode + skins were rolled out across every screen via the shared
  palette (`src/theme.ts`) and the `usePalette()` / `useNeu()` hooks. It compiles
  and lints clean, but **on-device visual QA across modes and finishes is still
  required** before it is launch-verified (contrast on photo overlays, gold CTAs,
  sage decorative tints on dark backgrounds, and the glass frost over each screen
  are the areas to check).

## Intentional launch boundaries

- Ujimora Wallet is the only active donation method. Card, mobile-money, and bank adapters are disabled.
- Paid subscriptions activate through the Paystack checkout (`POST /subscriptions/checkout`) on both web and mobile; the rail is live once `PAYSTACK_SECRET_KEY` is configured (the same gate as donations and payouts). The direct `POST /subscriptions` and `PUT /subscriptions/upgrade` endpoints still reject paid tiers by design — paid plans must go through checkout.
- Refund requests are persisted and visible, but approval and settlement are not automatic.
- External payout and self-service withdrawal controls are not exposed.
- Universal links remain deferred until the final controlled domain and association files exist.

## Manual parity checks still required

- Exercise every row against one shared production-like API account on a physical iPhone/iPad and a responsive web browser.
- Confirm error, loading, empty, permission-denied, and deleted-record states with seeded test data.
- Verify notification delivery, deep links, VoiceOver, Dynamic Type, reduced motion, safe areas, and keyboard avoidance on device.
