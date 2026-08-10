# UbuntuFund Web and Mobile Feature Parity

Last verified: 2026-08-10

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
| Subscription status | `/subscription` | Subscription tab | `/subscriptions/*` | Equal; paid activation blocked |
| Privacy and terms | `/privacy`, `/terms` | `/privacy`, `/terms` | bundled public copy | Equal |

## Intentional launch boundaries

- UbuntuFund Wallet is the only active donation method. Card, mobile-money, and bank adapters are disabled.
- Paid subscription activation is rejected by the API and disabled in both clients until verified billing exists.
- Refund requests are persisted and visible, but approval and settlement are not automatic.
- External payout and self-service withdrawal controls are not exposed.
- Universal links remain deferred until the final controlled domain and association files exist.

## Manual parity checks still required

- Exercise every row against one shared production-like API account on a physical iPhone/iPad and a responsive web browser.
- Confirm error, loading, empty, permission-denied, and deleted-record states with seeded test data.
- Verify notification delivery, deep links, VoiceOver, Dynamic Type, reduced motion, safe areas, and keyboard avoidance on device.
