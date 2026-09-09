# Native mobile parity implementation

This follows the source audit in `mobile-web-parity-2026-09-09.md`. Changes are local and are not claimed deployed or accepted on a physical device.

## Implemented behavior

- KYC collects and validates actual personal details, selectable country/state/city, device location and GhanaPost or document address proof. Camera/library/document uploads send real bytes. Failed requests remain visible and retryable.
- Sessions refresh before expiry and retry one unauthorized request. Concurrent refreshes share one operation. Temporary network failures preserve the session; one hour of inactivity expires it. Late refresh responses cannot restore a signed-out session.
- Campaign donations support hosted card/MoMo, wallet and available crypto. Wallet funding opens Paystack checkout and confirms against the server. Pending requests and idempotency keys survive app restarts and are scoped to the current account. Crypto includes asset/network selection, quote expiry, deposit address/memo, QR and confirmation state. Returning from a browser is never proof of payment.
- Campaign creation reads live plan/compliance limits, uploads a cover, applies AI suggestions only after review, validates campaign data, and optionally creates collaborator invitations and split drafts. A successful campaign is retained if an extra setup request fails; campaign management can recover that work. Both current web and native creation submit one cover image.
- Management supports collaborators, split drafts/consents/activation, QR generation and sharing. Host studio supports session recovery, privacy controls, public viewer links, donation attribution and OBS overlay link rotation. Native video uses LiveKit and includes camera/microphone/screen controls and lifecycle guards.
- Profile/cover editing uses native media capture and upload. Organization pages include cover/logo, description, website/share links and refresh after profile editing. Paid creator eligibility, withdrawal fee consent and historical fee/net amounts use the existing server policy.
- Primary navigation matches Home, Explore, Start, Dashboard and Profile; wallet/plans remain available from account navigation. Loading uses skeletons and animated button dots. Shared surfaces use the chosen material finish and light/dark mode.
- All eight legal policies and the collection are public native screens, bundled for offline reading. The web redesign, shared content and stale-asset recovery are described in `legal-parity-2026-09-09.md`.

## Native build setup

Use an Expo development build, not Expo Go, because LiveKit requires native WebRTC modules. Install dependencies from the repository root, then run `npm run ios -w @ubuntu-fund/mobile` or `npm run android -w @ubuntu-fund/mobile`. The `simulator` EAS profile inherits development settings and builds for the iOS simulator. Configure the public API URL for the target environment; production requires an HTTPS `EXPO_PUBLIC_API_URL`. Never put server provider secrets into an Expo public variable.

The config plugin generates a ReplayKit extension named `UjimoraBroadcast` with bundle identifier `com.ujimora.app.broadcast` and App Group `group.com.ujimora.app.broadcast`. Main app and extension need the same group in their provisioning profiles. EAS extension metadata is declared by the plugin. Re-run prebuild when native plugins change. Generated `ios/` and `android/` directories are ignored; plugin source is authoritative.

Screen sharing sends the screen plus the enabled LiveKit microphone; other apps' audio is not included. Permission denial, device capture, background/foreground, interruption/reconnection and a second-device viewer remain physical-device acceptance checks. Simulator compilation does not establish camera/microphone broadcasting acceptance.

Xcode was inspected with the connected iPhone available. It is signed into a Personal Team, but explicitly reports that Personal Teams do not support this app's Push Notifications capability and cannot create its provisioning profile. A developer team supporting the configured capabilities, with development signing/provisioning, is needed for the full device build. Features were not removed to bypass signing.

## Runtime fixes discovered during walkthrough

The first launch exposed an incompatible navigation dependency graph: bottom-tabs 7.18.18 required native 7.3.18 while the lockfile had native 7.2.2. Declaring the matching native dependency aligned core 7.21.13 and fixed the startup crash. `npm ls` now reports a valid navigation graph. Development-client launch URLs now resolve to home. Native headers use readable theme colors and a plain Back label. Home shows retry feedback on load errors rather than zero totals, and its raised amount uses the real currency formatter.

The WebRTC config plugin is pinned to the Expo 55-compatible 14.x line (15.x requires Expo 56). The unused direct `expo-modules-core` dependency was removed; Expo provides it transitively. The dependency graph is valid. Expo Doctor passes 19/20 checks: its remaining version check recommends newer Expo 55 patch releases and older navigation ranges. The newer navigation pair is intentional and runtime-tested to resolve the startup crash. Patch upgrades remain a maintenance advisory; Doctor is not claimed fully passing.

## Verification evidence and limits

Final mobile TypeScript, lint and all 21 native logic tests passed; final iOS and Android exports passed after the dependency correction. A clean iOS prebuild with plugin 14 and its generated ReplayKit extension build both passed. Native logic tests cover session concurrency/expiry, KYC payload validation, payment recovery and URL routing. iOS, Android and Expo web bundles exported successfully. The ReplayKit target compiled for the simulator. Full simulator builds passed, including an ad-hoc signed build for Keychain support. Public home loaded real campaign data; the legal hub, every policy route, section navigation and light/dark reading layouts passed native walkthrough. After the user signed in, authenticated profile, wallet funding entry, subscription selection, KYC validation/searchable nationality, paid creator restrictions and the owner live studio loaded successfully. Profile cover selection opened the system photo picker and was cancelled without an upload. Campaign creation correctly stopped at the account’s active-campaign allowance and linked to subscription eligibility; the full creation flow was not submitted. Subscription checkout was verified with the software keyboard visible after fixing obscured coupon/payment/cancel controls. Neumorphic, Clay, Glass and Minimal appearances applied immediately and persisted through navigation; the original System/Neumorphic preference was restored. The simulator remains signed in on the legal collection. No payment, KYC submission, campaign creation, broadcast or profile mutation was performed.

Native dependency downloads were unusually slow. Local simulator preparation used verified React Native binary archives and the exact SDWebImage 5.21.7 upstream source tag via a sparse checkout. The temporary path override exists only in the ignored generated Podfile; published configuration uses normal upstream dependencies.

Web legal validation passed 40 tests and three browser scenarios, covering every policy, narrow layouts/section navigation, and four appearances in light/dark mode. Marketing and web production builds passed with bundle-size advisories.

Remaining shared creator launch gaps recorded in the earlier pricing review are not waived by native UI parity. Live-provider transactions, APNs delivery, device broadcasting, signed release builds and deployed missing-asset headers require separate acceptance. iOS uses the system image crop interface, whose crop capabilities differ from the browser editor; exact cover-crop UX remains a device review item.
