# Ujimora launch QA plan

Generated 25 September 2026 from the current source by a 14-area inventory plus a coverage critic. 1325 cases (578 P0). The interactive tracker (shared pass/fail results) is published as a Claude artifact; this file is the versioned copy. Case IDs are stable between the two.

## When you are ready to launch

Launch when every P0 case passes (or is marked Not applicable with a reason in its note), no P1 case is failing in accounts, money, payouts, subscriptions or the store flows, and every launch gate on the Launch gates tab has its evidence filed. The banner at the top of the Test cases tab applies the first two rules automatically; the gates are a manual sign-off.

- P0: a failure means real money moves wrongly, people are locked out, data leaks, a store would reject the app, or a legal statement would be untrue.
- P1: an important flow fails or misleads users, but there is a workaround or limited blast radius.
- P2: polish, rare edge cases and wording.

Blocked means the case could not be run (missing key, account, device or provider). Record what is missing in the note; a blocked P0 still blocks launch.

## Set up the test environment first

Run the plan against a staging stack, not production. Today the web, admin and marketing Vercel projects rewrite /api/v1 to the production API, so every preview deployment reads and writes production data; point staging builds at a staging API before testing money flows.

| Piece | Staging setup |
| --- | --- |
| API | A separate Render service (not the free plan) with NODE_ENV=production so the reconciliation, erasure, store-billing and email sweeps run, and its own MongoDB replica set with backups. |
| Web, admin, marketing | Vercel preview or staging projects whose /api/v1 rewrite points at the staging API. |
| Mobile | EAS preview builds with EXPO_PUBLIC_API_URL and EXPO_PUBLIC_WEB_URL set to staging; release (not dev-client) builds for the store-review and 16 KB cases. |
| Paystack | Test-mode keys, webhook URL and Transfer Approval URL pointed at staging. Keep a ledger of every reference you create. |
| App Store / Google Play | Sandbox testers (Apple) and licence testers (Google) with the subscription products created; App Store Server Notifications V2 and Play RTDN pointed at staging. |
| Email | Resend with a verified sending domain and the encryption keys set (AUTH_EMAIL_ENCRYPTION_KEY_BASE64, MFA_ENCRYPTION_KEY); use inboxes you control. |
| Other providers | LiveKit test project, Cloudinary folder separate from production, OpenAI key (optional screening), Bitnob sandbox only if crypto will launch. |

## Accounts to create

- Two donors aged 18+ (one with MFA on), plus a guest checkout email.
- An individual organizer with approved identity verification and a matched MoMo payout account.
- An organization account with approved business verification and a bank payout account.
- A creator page owner, and an affiliate with a referral code.
- Two admin accounts (one to request, one to approve payouts), both with MFA.
- A user you will report, block and restrict during the safety cases.
- The store reviewer demo account described in apps/mobile/APP_REVIEW_NOTES.md, set up exactly as the notes say.

## Devices and browsers

| Surface | Minimum set |
| --- | --- |
| iPhone | Current iOS on a recent iPhone, plus a small screen (iPhone SE size). Test VoiceOver, larger text and dark mode once each. |
| iPad | One iPad in portrait and landscape; the app supports tablets, so App Review may test there. |
| Android | An Android 15 or 16 phone, a 16 KB page-size device or emulator for the native-library cases, and a low-end Android 10 to 12 phone with 2 to 3 GB RAM. Test TalkBack once. |
| Web | Chrome, Safari and Firefox on desktop; Safari on iPhone and Chrome on Android; widths 320, 390, 768 and 1440 px; one pass on a throttled 3G profile. |

## Order of work

1. Smoke test: install or open every surface, sign in, open a campaign, open Settings. Stop and fix anything broken before going further.
2. Run all P0 cases area by area. Money areas (Donations, Wallet, KYC & payouts, Plans) go first because their defects take longest to fix.
3. At the end of each testing day, reconcile money: for every reference in your ledger, compare the Paystack dashboard, the campaign or wallet balance, the donor history and the admin views.
4. Run P1 cases, then P2.
5. After each fix, re-run the failed case and the other cases in the same area.
6. On the release candidate build, re-run every P0 case on the store-signed apps and the production-configured web build.

## Recording results and defects

- Mark each case Pass, Fail, Blocked or Not applicable, fill in the build or version, and add a note.
- For a failure, note the device, OS and browser, the account used, payment or request references, what you expected and what happened, and link the defect ticket.
- Never paste passwords, full card numbers, identity documents or live API keys into notes.
- Re-test fixed defects on a new build and update the same case rather than adding a new one.

## Automated checks to run on the release candidate

- npm run lint, npm run type-check, npm test (all workspaces; the API suite has over 1,200 tests) and npm run build.
- Web and admin Playwright suites (npx turbo e2e) against a seeded API, as CI does.
- Mobile: npx expo export for iOS, Android and web, plus Expo Doctor.
- Android release artifacts: scripts/compliance/inspect-android-native.py must report 48/48 libraries passing, zipalign -c -P 16 must pass, and bundletool validate must pass on the App Bundle.
- iOS: inspect the archived Info.plist (camera, microphone, photo and location strings; audio as the only background mode; no dev-launcher local-network string) and the generated privacy report.

## Launch gates (owner and external)

These cannot be closed by testing or code. Each needs an owner decision, an external approval or a console setting. File the evidence (a document, a screenshot or a registration number) before launch.

| Gate | Owner | Evidence to file | Blocks |
| --- | --- | --- | --- |
| Bank of Ghana crowdfunding position | Owner with a lawyer or the payment partner | Written authorization or partner confirmation covering collection, holding (wallet) and payout | Switching Paystack to live keys |
| Data Protection Commission registration | Owner | DPC registration number, added to the Privacy Policy | Launch |
| Legal operator identity | Owner | Final operator (DevTrack, and any parent company) reflected in packages/types/src/legal.ts, store listings and the Paystack merchant profile | Store submission |
| Apple Developer organization account | Owner | Organization enrollment for DevTrack with a D-U-N-S number (required for financial and fundraising apps) | App Store submission |
| App Store Connect setup | Owner | App Privacy answers, 18+ age rating, subscription group and products, Server Notifications V2 URL, reviewer notes and demo account, screenshots | App Store submission |
| Google Play Console setup | Owner | Data safety form, financial features declaration, media-projection foreground service declaration with video, 18+ target audience, subscriptions with RTDN, app access account | Play submission |
| Production secrets and configuration | Owner or operator | Render has MFA_ENCRYPTION_KEY, AUTH_EMAIL_ENCRYPTION_KEY_BASE64, RESEND_API_KEY, store-billing and Apple/Google credentials, live Paystack keys, LiveKit, OpenAI, CORS_ORIGINS; values checked, never copied into tickets | Launch |
| Always-on API hosting and backups | Owner | Paid Render instance (the free plan sleeps and stops background jobs), MongoDB with automated backups and a tested restore | Launch |
| Split proceeds sign-off | Owner with a lawyer | The Ghana legal section 6 sign-off, or SPLIT_PROCEEDS_ENABLED turned off before launch | Launch with split campaigns |
| Crypto donations | Owner | Keep CRYPTO_PAYMENTS_ENABLED off unless licensing under the Virtual Asset Service Providers Act is confirmed | Enabling crypto |
| Payout controls | Owner | A dual-approval threshold (PAYOUT_DUAL_APPROVAL_AMOUNT above 0) and MFA on every admin account | Live payouts |
| Tax treatment | Owner with an accountant | GRA advice on platform fees, tips and subscriptions; receipts never claim tax deductibility | Launch |
| People and mailboxes | Owner | Named owners for support@, trust@ and legal@, a moderation roster, and a payout-approval rota | Launch |
| Incident and rollback plan | Owner or operator | How to pause payments, roll back the API and web, and communicate an outage; uptime and error alerting in place | Launch |

## Test cases by area

| Area | Cases | P0 | File |
| --- | --- | --- | --- |
| Accounts & sign-in | 80 | 28 | [cases/AUTH.md](cases/AUTH.md) |
| Profile, settings & privacy | 82 | 27 | [cases/PROFILE.md](cases/PROFILE.md) |
| Campaigns | 81 | 30 | [cases/CAMPAIGN.md](cases/CAMPAIGN.md) |
| Donations & checkout | 78 | 41 | [cases/DONATE.md](cases/DONATE.md) |
| Wallet, ledger & refunds | 75 | 43 | [cases/WALLET.md](cases/WALLET.md) |
| KYC, KYB & payouts | 72 | 39 | [cases/PAYOUT.md](cases/PAYOUT.md) |
| Plans & subscriptions | 94 | 47 | [cases/SUBS.md](cases/SUBS.md) |
| Live fundraising | 78 | 29 | [cases/LIVE.md](cases/LIVE.md) |
| Creators, organizations & affiliates | 92 | 46 | [cases/CREATOR.md](cases/CREATOR.md) |
| Trust & safety | 75 | 31 | [cases/SAFETY.md](cases/SAFETY.md) |
| Admin console | 87 | 47 | [cases/ADMIN.md](cases/ADMIN.md) |
| Notifications, email & marketing site | 81 | 28 | [cases/COMMS.md](cases/COMMS.md) |
| Mobile platform (iOS & Android) | 85 | 32 | [cases/MOBILE.md](cases/MOBILE.md) |
| Ghana & store compliance, operations | 88 | 58 | [cases/COMPLIANCE.md](cases/COMPLIANCE.md) |
| Cross-cutting journeys & edge cases | 177 | 52 | [cases/GAP.md](cases/GAP.md) |
