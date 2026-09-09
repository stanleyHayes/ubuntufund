# Native mobile versus web parity audit

9 September 2026. Source and contract audit of the Expo native app (`apps/mobile`) against the React web app (`apps/web`). Responsive web is not the native app. This is not a physical-device visual or live-payment acceptance report.

## Verdict

Mobile shares brand colors, Outfit typography and four selectable appearance finishes, but it does not have feature or redesign parity with the current web application. Historical “Equal” entries in `FEATURE_PARITY.md` were too broad. Several recent web improvements have not been ported.

## Findings

| Area | Verified native implementation | Difference from web / next work |
|---|---|---|
| Creator donations | Native owner `/creator` and public `/creators/[handle]` screens already exist; hosted Paystack tip checkout opens in a browser | This audit fixes paid eligibility display, disabled Free setup, withdrawal fee preview/consent, fee/net history and the default shared web URL. Earlier claims that there was no native creator UI were incorrect. |
| KYC — critical | `app/kyc.tsx` keeps input state inside individual steps but `handleSubmit` posts empty personal information and `https://example.com/doc.pdf`; errors are swallowed | Not a functioning equivalent. Lift and validate form state, wire real upload/camera capture, submit actual documents/address and expose failures. Web has address selection/GhanaPost GPS/document proof options. |
| Campaign donations | Both `app/donate/[id].tsx` and `app/campaign/[id].tsx` reject selected non-wallet providers | Web has hosted card/MoMo checkout and a crypto contribution flow. Provider labels alone do not implement mobile checkout. |
| Wallet funding | `app/(tabs)/wallet.tsx` reads wallets/transactions | No native top-up checkout/status flow matching web wallet funding. |
| Campaign creation | `app/campaign/create.tsx` submits title, description, amount, category and GHS | Missing web creation-options feedback, AI writing assistance and campaign image/editor workflow. Server caps still apply; the native form does not explain them in advance. |
| Live video | No native broadcast/watch routes or LiveKit dependency | Web has studio/viewer routes and provider-gated transport. Native host/viewer transport, permissions and lifecycle handling remain to implement. |
| Personal images | `app/(tabs)/profile.tsx` shows an initials avatar | Does not reproduce web profile/cover image upload and crop editing. |
| Loading | 45 source matches for `ActivityIndicator` or `loading=` in native app screens at audit time | Web skeleton/page loading and animated button dots have not been rolled out across native. This count is a search count, not 45 distinct broken screens. |
| Navigation | Native floating tab bar is Home, Explore, Plans, Wallet, Profile; Create is hidden from tabs | Web mobile nav is Home, Explore, Start, Dashboard, Profile. Native has a solid capsule, not the same glass treatment. |
| Appearance | `ColorModeContext` persists Light/Dark/System and neumorphism/claymorphism/glassmorphism/minimal; `theme.ts` has native recipes | Shared brand/finish foundations exist. Screens that only read the palette do not automatically gain every material surface treatment. Layouts, watermarks and states need device-by-device visual review. |
| Sessions | Native auth refreshes during initial hydration; API helper sends stored access tokens without request-time refresh | Missing the web active-session refresh/one-hour inactivity handling. Hydration refresh failures also clear storage. |
| Subscriptions and core account screens | Native has paid subscription checkout/coupon flows, affiliate screens, organizations, comments, updates and account routes | These exist in source; full payment, navigation, accessibility and screen-state parity is not established by route presence. |

## Fix delivered in this audit

The new creator API requires `expectedFeePercent` on a withdrawal. Native previously omitted it, causing 409 responses after the API change. `src/lib/creators.ts` now includes the policy and fee contracts; `app/creator.tsx` loads the policy, displays fee/net before confirmation and submits the reviewed rate. Free/expired accounts see an upgrade action, cannot enable tips, and retain access to accrued balances. The server remains the enforcement authority. History shows gross, fee and net, with historical zero-fee compatibility. Public shared links default to `https://app.ujimora.com`.

Existing creator launch gaps (checkout callback, tip validation and creator payout verification) remain in [the creator review](pricing-and-creator-donations-2026-09-09.md); this audit does not mark the whole feature launch-ready.

## Suggested completion order

1. Repair native KYC submission and error handling; port real document/address capture.
2. Port session recovery, campaign checkout and wallet funding, with provider-confirmed status handling.
3. Bring campaign creation, image editing and AI assistance up to web behavior.
4. Implement native live broadcasting/viewing and device permission/lifecycle tests.
5. Align navigation, skeletons/button dots and appearance treatments; inspect key screens across all finishes on iOS and Android.

## Verification limits

Mobile type-check and lint, plus the existing runnable native logic tests, are used for this compatibility patch. Native component `.tsx` tests are excluded by the repository’s Vitest configuration and need a working React Native component-test setup. No physical-device walkthrough, real-money transfer or native camera/video acceptance was performed. Do not use this report as App Store readiness approval.
