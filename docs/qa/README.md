# Ujimora launch QA plan

Generated 25 September 2026 from the current source by a 14-area inventory plus a coverage critic. 1546 cases (612 P0). The interactive tracker (shared pass/fail results) is published as a Claude artifact; this file is the versioned copy. Case IDs are stable between the two.

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

## Issues found while writing this plan

The inventory agents noted 320 risks, which were deduplicated into 184 issues (I001-I184) and each checked against the source. After the fixes, an adversarial review of the merged changes confirmed 70 further findings (R2-001 to R2-070), which were fixed in a second round. Status as of this commit:

| ID | Severity | Status | Issue |
| --- | --- | --- | --- |
| I001 | P0 | Fixed | Express 'trust proxy' unset: in-memory per-IP rate limiters become one global bucket behind Render/Vercel |
| I011 | P0 | Fixed | Manual payouts and creator withdrawals move money without a current-KYC check |
| I013 | P0 | Owner decision | SPLIT_PROCEEDS_ENABLED is 'true' in production without the §6 legal sign-off the code requires |
| I014 | P0 | Fixed | Web (Paystack) subscriptions never auto-renew, but UI and billing terms say they renew and can be cancelled |
| I015 | P0 | Fixed | Expired web subscriber cannot rebuy the same tier; status stays 'active' after expiry |
| I016 | P0 | Fixed | Apple IAP verification only accepts the configured environment: App Review/TestFlight sandbox receipts fail against production |
| I017 | P0 | Fixed | Plans advertise benefits that are not enforced or not implemented |
| I020 | P0 | Owner decision | Operator identity is inconsistent across legal copy (Neurodyne Corp Ltd vs DevTrack BN843072020) |
| I021 | P0 | External gate | Regulatory and corporate external gates still open (operator identity, DPC, BoG/provider authorization, crypto Act 1154, store console, tax) |
| I042 | P0 | Fixed | Webhook settles sub- and tip- charges without verifying amount/currency; lost tip webhooks are not reconciled |
| I002 | P1 | Fixed | render.yaml omits required secrets (MFA, account-email encryption, store billing), so MFA, password reset, email verification and native IAP fail in production |
| I003 | P1 | Mitigated | API runs on Render free plan: sleeps when idle, cold-starts webhooks, pauses all in-process jobs; DB tier has no backups |
| I004 | P1 | Fixed | Native 'Report Campaign' always fails: sends reason 'Flagged from mobile' which the API enum rejects (400) |
| I005 | P1 | Fixed | User campaign reports have no admin review queue; staff never see fraud reports |
| I006 | P1 | Fixed | Legacy wallet donate endpoint generates a random idempotency key per request: retries double-debit the wallet |
| I007 | P1 | Fixed | Payment reconciliation sweep can be starved by 100+ unresolvable PENDING intents, so missed paid webhooks are never repaired |
| I008 | P1 | Fixed | Late charge.success on an intent already FAILED/EXPIRED is ignored: money taken but never credited |
| I009 | P1 | Mitigated | Chargebacks and provider-side refunds are not processed for donations, tips, top-ups or subscriptions |
| I010 | P1 | Fixed | Donor refund requests have no staff list or update path; they stay 'pending' forever |
| I012 | P1 | Fixed | Manual payout path ignores campaign status and disputes, and PENDING payouts cannot be rejected or cancelled |
| I018 | P1 | Fixed | Subscriptions can be double-charged: no guard against buying while active or with a pending checkout, and no recovery |
| I019 | P1 | Fixed | Marketing, SEO metadata and seeded FAQ make false product and regulatory claims (escrow, trust scores, frozen funds, worldwide donations) |
| I023 | P1 | Fixed | Web login has no 'Forgot password?' link |
| I028 | P1 | Mitigated | Staff access controls are weak: single full-admin role, cosmetic RBAC, optional admin MFA, no lockout or login audit |
| I030 | P1 | Fixed | No self-approval block on payouts |
| I036 | P1 | Mitigated | Admin console lacks payment operations UI (payment search/timeline, refund initiation, reconciliation, creator tips/withdrawals) |
| I038 | P1 | Fixed | Abandoned Paystack donation checkouts never expire; Android donors can be trapped on a pending payment |
| I039 | P1 | Fixed | Wallet top-ups mark Paystack 'abandoned' as failed prematurely; failed-then-paid top-ups are not swept |
| I048 | P1 | Owner decision | Paystack processing fees and donor fee disclosure need a policy decision |
| I051 | P1 | Owner decision | No transactional notifications by default (receipts, purchase confirmations, owner alerts) |
| I055 | P1 | Fixed | Payout account-name matching fails Ghanaian name order and ɔ/ɛ characters, hard-failing creator withdrawals |
| I056 | P1 | Fixed | Single payouts stuck in PROCESSING with an unknown provider reference stay reserved forever |
| I057 | P1 | Fixed | Test-mode Paystack recipient codes are reused after the live cutover |
| I059 | P1 | Fixed | Affiliate payouts cannot be requested: no UI registers a payout recipient |
| I060 | P1 | Fixed | Affiliate commission ledger lifecycle is broken (never marked paid, silent clawback failure, stuck payouts, maturity not scheduled) |
| I065 | P1 | Fixed | Refunding a web subscription leaves the paid entitlement active |
| I071 | P1 | Fixed | No job expires ended campaigns: they stay 'active', consume plan slots and pollute Explore and the sitemap |
| I072 | P1 | Fixed | Explore shows only the 20 newest campaigns; admin list drops older pending campaigns |
| I073 | P1 | Mitigated | Publication review workflow has no drafts: exact-version admission, expiring approvals and upload loops |
| I074 | P1 | Fixed | Publication review over-triggers on media: every avatar and cover image forces staff review, and users cannot remove a photo immediately |
| I076 | P1 | Owner decision | Campaign allowance policy: rejected/blocked campaigns consume lifetime allowance and campaigns cannot be edited |
| I077 | P1 | Fixed | Split-proceeds disclosure not shown to donors and split data exposed for non-public campaigns |
| I081 | P1 | Fixed | Anonymous-by-default donation setting is saved but never applied |
| I082 | P1 | Fixed | Account erasure ignores active campaigns and money balances |
| I087 | P1 | Fixed | Legal notices promise features that do not exist (cookie controls and table, policy history, retention schedule, per-campaign organizer agreement, complaints process) |
| I088 | P1 | Owner decision | Stored-value wallet lacks terms, limits and BoG authorization |
| I089 | P1 | External gate | No sanctions/PEP or liveness screening in KYC |
| I090 | P1 | External gate | Physical-device and provider acceptance evidence still pending |
| I092 | P1 | Fixed | Biometric lock unmounts screens on transient OS interruptions, wiping in-progress work |
| I094 | P1 | Fixed | No forced-upgrade path: legal-version bumps break older store builds and OTA is unconfigured |
| I159 | P1 | Fixed | Beneficiary payout approval collects no review note |
| I022 | P2 | Fixed | Change-password clients discard the rotated tokens, signing out the device that changed the password |
| I024 | P2 | Fixed | validate() middleware does not apply parsed zod output, so .trim() has no effect and emails with whitespace fail |
| I025 | P2 | Mitigated | Referral attribution is lost: native deep links drop ?ref, marketing does not forward it, short codes block signup |
| I026 | P2 | Fixed | No verification email at signup, although payouts and org invitations require a verified email |
| I027 | P2 | Fixed | Admin console accepts any account and some admin data endpoints are open to all signed-in users |
| I029 | P2 | Mitigated | Payout maker-checker disabled in production (PAYOUT_DUAL_APPROVAL_AMOUNT = 0) |
| I031 | P2 | Mitigated | Session hardening: no server logout or refresh rotation, tokens in localStorage, and no CSP/X-Frame-Options on Vercel frontends |
| I032 | P2 | Fixed | seed-dev.mjs has no environment guard: wipes data and creates admin@ujimora.com with a known password |
| I033 | P2 | Mitigated | Production shares the dev Cloudinary cloud, ships an unused unsigned preset name, and legacy public KYC assets remain |
| I034 | P2 | Mitigated | No staging isolation: every push to main auto-deploys to production and Vercel previews hit the production API |
| I035 | P2 | Mitigated | /health does not check MongoDB and there is no error tracking or alerting |
| I037 | P2 | Fixed | Reconciliation sweeps only run when NODE_ENV=production, with no manual trigger for top-up/payout sweeps |
| I040 | P2 | Fixed | Settlement still credits blocked or ended campaigns |
| I041 | P2 | Fixed | Web createDonationIntent sends a new Idempotency-Key per call, so retries create a second intent and checkout |
| I043 | P2 | Fixed | Tip attempt key stuck in localStorage after an abandoned checkout: changed amount/message returns 409 with no reset |
| I044 | P2 | Fixed | 'My donations' hard-codes status 'completed', so refunded gifts still show Completed, count in totals and offer 'Request Refund' |
| I045 | P2 | Fixed | Wallet-funded donations cannot be refunded, yet 'Request Refund' is offered |
| I046 | P2 | Open | Wallet donations post no wallet debit journal line; ledger drifts from wallet balances |
| I047 | P2 | Mitigated | Admin payment-provider toggles are inconsistent and fail open |
| I049 | P2 | Fixed | iOS handoff copy promises fee review and wallet use on the website that the donate page does not offer |
| I050 | P2 | Fixed | Donation-callback copy promises an emailed receipt that is never sent |
| I052 | P2 | Fixed | Users get no notification of staff decisions (campaign review, KYC, reports) |
| I053 | P2 | Fixed | Disputes can never be created, so the Disputes queue and the automatic-payout dispute block are dead |
| I054 | P2 | Fixed | KYC current status is computed inconsistently (early renewal, historical level, legacy records without expiry) |
| I058 | P2 | Fixed | Creator-withdrawal transfer approval can race and decline valid withdrawals |
| I061 | P2 | Mitigated | Store (IAP) subscriptions never earn affiliate commission, and the enroll copy is wrong |
| I062 | P2 | Fixed | Coupon deletion is a hard delete that changes affiliate commission bases and resets limits |
| I063 | P2 | Fixed | Pending subscription checkouts never expire; abandoned ones hold coupon seats forever |
| I064 | P2 | Fixed | Subscription provider claim is permanent: an abandoned checkout locks the account to web or store billing |
| I066 | P2 | Fixed | Enterprise and non-public plans can be bought self-serve |
| I067 | P2 | Fixed | A zero price on either billing cycle activates that cycle free |
| I068 | P2 | Fixed | Duplicate store purchases are refused after the store has charged the user |
| I069 | P2 | Fixed | Admin Subscriptions page: dead buttons, revenue from seed prices, stale plan names |
| I070 | P2 | Fixed | Plan entitlements not re-checked for live broadcasting and split accrual after a plan lapses |
| I075 | P2 | Fixed | POST /campaigns has no idempotency key; retries create duplicate campaigns that burn lifetime allowance |
| I078 | P2 | Fixed | Creator QR codes point to /u/:creatorId, which no web or native route handles |
| I079 | P2 | Fixed | Social link previews show the generic card: per-campaign OG meta is set client-side |
| I080 | P2 | Fixed | Moderation restrictions are coarse: one record per user, no restricted-user list, campaigns stay live |
| I083 | P2 | Mitigated | No staff tooling to close accounts or change emails |
| I084 | P2 | Mitigated | Data-rights and retention jobs incomplete (READINESS C07/C08) |
| I085 | P2 | Fixed | Consent history is overwritten on re-acceptance |
| I086 | P2 | Mitigated | Guest donations without a message need no 18+ or terms acknowledgement |
| I091 | P2 | Fixed | APP_REVIEW_NOTES misdirect reviewers (Restore purchases location, iOS background live audio) |
| I093 | P2 | Fixed | Mobile Wallet tab is stale after an iOS Safari top-up and formats balances as GHS |
| I095 | P2 | Fixed | Admin contact and testimonials pages bypass the API client and show an empty inbox on failure |
| I096 | P2 | Fixed | Pre-live studio preview likely broken (overlay preview route 400s and is unframeable) |
| I097 | P2 | Fixed | Live session stats double-count on outbox redelivery |
| I098 | P2 | Fixed | Live privacy toggles are not applied to the campaign bar or the public campaign SSE |
| I099 | P2 | Mitigated | Per-instance in-memory state: rate limiters, EventBus and email worker do not scale across instances |
| I100 | P2 | Fixed | CORS falls back to reflecting any origin with credentials when CORS_ORIGINS is empty |
| I101 | P2 | Fixed | Duplicate-key races surface as HTTP 500 instead of 409 |
| I102 | P2 | Fixed | URL fields accept any scheme/host (org website, profile images, campaign imageUrls, uploads) |
| I103 | P2 | Fixed | Unbounded or unvalidated list endpoints |
| I104 | P2 | Fixed | Web signup depends on /plans/public; forgot-password maps 429 to 'temporarily unavailable' |
| I105 | P2 | Fixed | Legal-acceptance banner reads the cached login user and misses version bumps |
| I106 | P2 | Mitigated | Mobile privacy: app-switcher snapshots expose content and biometric unlock silently expires after 7 days |
| I107 | P2 | Fixed | Profile stats are wrong or hard-coded on web and mobile |
| I108 | P2 | Fixed | DELETE /profile needs no re-authentication and the web button allows double submission |
| I109 | P2 | Fixed | Web deletion dialog does not mention subscriptions |
| I110 | P2 | Fixed | Unused preference settings (language, legacy notification preferences, push) |
| I111 | P2 | Fixed | Mobile public member profile has no in-app entry point |
| I112 | P2 | Fixed | Screener silently falls back to manual review when OPENAI_API_KEY is missing |
| I113 | P2 | Fixed | Collaborator roles and revenue share are misleading; invites enumerate emails |
| I114 | P2 | Fixed | Short-link targets are frozen at creation; slug changes break printed QR codes |
| I115 | P2 | Fixed | apps/web/vercel.json has no /sitemap.xml rewrite; VITE_SSE_ENABLED missing from web production env |
| I116 | P2 | Fixed | Sitemap exposes hidden creator handles and has inaccurate lastmod |
| I117 | P2 | Fixed | Web My Campaigns placeholders and unsaved wizard summary |
| I118 | P2 | Fixed | Owners cannot manage campaign updates on mobile |
| I119 | P2 | Fixed | Web shares are not recorded; share endpoint does not validate the campaign |
| I120 | P2 | Fixed | Crypto donation gaps (behind server flag): gross amount shown as campaign receipt, no donor link, no idempotency |
| I121 | P2 | Fixed | Amount inputs: more than 2 decimals on web, comma decimals break on mobile |
| I122 | P2 | Open | Expired access token silently turns a signed-in donor into a guest |
| I123 | P2 | Fixed | All guest donations share donorId 'guest', collapsing distinct-supporter counts |
| I124 | P2 | Fixed | Wallet float drift on debits |
| I125 | P2 | Owner decision | Refund window is inconsistent across web, mobile, API and policy |
| I126 | P2 | Fixed | Flutterwave rail incomplete (refunds 501 strand funds, webhook ignores flag) |
| I127 | P2 | Fixed | Web wallet history gaps and Android top-up minimum |
| I128 | P2 | Fixed | Payment-attempt endpoint needs no login and can overwrite providerRef |
| I129 | P2 | Fixed | DonateCallbackPage '__last' fallback shows the previous donor's gift on shared devices |
| I130 | P2 | Fixed | Paystack checkout sends no channel restriction |
| I131 | P2 | Fixed | Upload size limit mismatch and Vercel rewrite body limit |
| I132 | P2 | Fixed | PENDING payout requests do not reserve funds |
| I133 | P2 | Fixed | Admin-created payout recipient blocks owner payouts with 409 |
| I134 | P2 | Fixed | KYC level FULL unreachable; web card suggests business verification to individuals |
| I135 | P2 | Fixed | Admin KYC Review counters and filters are computed from the pending list |
| I136 | P2 | Fixed | Admin transfer controls share the donation-intent rate limiter |
| I137 | P2 | Fixed | Payout OTP documentation contradicts the implemented UI |
| I138 | P2 | Fixed | Automatic payouts near 00:00 UTC go to manual review |
| I139 | P2 | Fixed | Removing a saved payout account has no confirmation |
| I140 | P2 | Fixed | Subscription callback polling can trip the verify rate limit |
| I141 | P2 | Fixed | Admin price edits do not change App Store/Play prices |
| I142 | P2 | Fixed | Admin 'Edit plan' dialog lacks Active/Public/Sort/Popular/Accent controls |
| I143 | P2 | Fixed | Live overlay data gaps (refunds, recent donors, checkout starts, goal) |
| I144 | P2 | Fixed | Hard-coded GH₵ and unfixed decimals across mobile and live |
| I145 | P2 | Fixed | liveSessionId attribution is not validated (format, ownership, active state) |
| I146 | P2 | Fixed | Live sessions never time out and survive campaign expiry |
| I147 | P2 | Fixed | Live session end/eviction relies on LiveKit Cloud token revocation |
| I148 | P2 | Fixed | Web 'End session' has no confirmation |
| I149 | P2 | Fixed | Overlay token compared with !== |
| I150 | P2 | Fixed | Web public pages lack parity (Watch live and Report/Block on /c/:slug, org profile follow/report/block, directory totals) |
| I151 | P2 | Fixed | iOS live viewers of legacy campaigns without a slug cannot reach the Safari handoff |
| I152 | P2 | Mitigated | No universal links/App Links; mobile share text hard-codes the production URL |
| I153 | P2 | Fixed | Approved publication versions are reusable for 7 days |
| I154 | P2 | Fixed | Safety report guards: no self-review, reports on deleted comments accepted |
| I155 | P2 | Fixed | No IP/content-rights report reason; trust and support inboxes need owners |
| I156 | P2 | Fixed | Admin totals mix currencies and include refunds |
| I157 | P2 | Fixed | Campaign review settings saved with sequential PUTs |
| I158 | P2 | Fixed | CMS content has no shape validation or revision control |
| I160 | P2 | Fixed | Admin global search does nothing |
| I161 | P2 | Fixed | Notification alert amounts differ from what was paid |
| I162 | P2 | Fixed | Sender, reply-to and support addresses are inconsistent |
| I163 | P2 | Fixed | Activity emails stuck in 'review' have no admin UI |
| I164 | P2 | Fixed | Contact form sends no acknowledgement or staff email |
| I165 | P2 | Fixed | Mobile request() parses JSON before checking status |
| I166 | P2 | Release check | Stale gitignored apps/mobile/ios prebuild would ship a wrong Info.plist if archived locally |
| I167 | P2 | Fixed | No 'Open Settings' after permanently denied permissions |
| I168 | P2 | Fixed | Layouts read Dimensions at module load and go stale on iPad resize |
| I169 | P2 | Fixed | Sign-in gate loses the deep-link destination |
| I170 | P2 | Fixed | Android keyboard can hide fields under edge-to-edge |
| I171 | P2 | Fixed | Mobile fetch has no timeout |
| I172 | P2 | Fixed | Campaign detail 'Accepted Payment Method' lists only Ujimora Wallet |
| I173 | P2 | Release check | Verify the web SubscriptionScreen with Paystack checkout never ships in native builds |
| I174 | P2 | Open | Legacy push registrations may still receive background pushes |
| I175 | P2 | Fixed | Device clock skew logs web users out repeatedly |
| I176 | P2 | Fixed | Unicode handling: slugify drops ɛ/ɔ/ŋ, overlay lacks bidi isolation, PDF font lacks glyphs |
| I177 | P2 | Fixed | KYC picker copies left in cache after app kill |
| I178 | P2 | Fixed | ColorModeProvider reads localStorage outside try/catch, blanking the web app when storage is blocked |
| I179 | P2 | Fixed | Web skin selector unreachable and no skip link |
| I180 | P2 | Fixed | Billing terms promise tax disclosure that checkout does not show |
| I181 | P2 | Mitigated | Organization team invitations send no email; native has no team management |
| I182 | P2 | Fixed | /c/:slug public page closed funded campaigns (status === 'active' check) |
| I183 | P2 | Fixed | EAS production build lacked EXPO_PUBLIC_API_URL |
| I184 | P2 | Fixed | Android 16 KB page-size RELRO findings |
| R2-001 | P1 | Fixed | Provider dispute and external-refund cases tell staff to use the refund tool, which sends a second real refund |
| R2-002 | P2 | Fixed | A tip marked FAILED in a race with its success webhook keeps the money, and nothing credits the creator |
| R2-003 | P2 | Fixed | A late success on a closed donation settles with the fee waiver but does not use up the donor's coupon seat |
| R2-004 | P2 | Fixed | A Paystack refund treated as ours only because a matching refund operation exists, whatever its outcome |
| R2-005 | P2 | Fixed | Late charge.success on a FAILED subscription checkout is acknowledged silently: member charged, plan not active |
| R2-006 | P2 | Fixed | Chargebacks and refunds on tips, subscriptions and wallet top-ups are stored but no admin screen shows them |
| R2-007 | P2 | Fixed | Wallet top-ups Paystack never registered stay 'pending' forever and are re-checked every sweep |
| R2-008 | P2 | Fixed | Repeating the same donation in one browser tab shows the earlier donation's success screen |
| R2-009 | P1 | Fixed | Beneficiary payout destination can be swapped after the request, and one admin can enter, verify and approve it alone |
| R2-010 | P1 | Fixed | Beneficiary payouts skip the blocked, deleted and disputed campaign gate that campaign payouts now enforce |
| R2-011 | P1 | Fixed | New email-verification requirement on every payout is reported as an identity-KYC problem the user cannot fix |
| R2-012 | P2 | Fixed | Affiliate approval rollback leaves commissions linked to a FAILED payout for good |
| R2-013 | P2 | Fixed | Stuck payouts escalated on the beneficiary, affiliate and creator rails have no staff surface |
| R2-014 | P2 | Fixed | PENDING beneficiary payouts cannot be rejected or cancelled, and those an admin requests can never be approved |
| R2-015 | P2 | Fixed | Mobile payout history shows rejected or cancelled requests as 'failed' and hides the rejection reason |
| R2-016 | P2 | Fixed | Rejecting or cancelling a PENDING payout permanently uses up its payout-fee coupon |
| R2-017 | P2 | Fixed | Closing a PENDING payout requested before this deploy returns nothing to pending |
| R2-018 | P2 | Fixed | Concurrent payout requests can both pass the new pending-requests ceiling |
| R2-019 | P2 | Fixed | Affiliate payouts leave the platform with no KYC gate |
| R2-020 | P2 | Mitigated | 'name_matched' does not tie the account to the verified person, so unreviewed creator withdrawals can go to any account |
| R2-021 | P1 | Fixed | Staff-assisted account closure always fails: shared DeleteAccountUseCase demands the member's password, but only after the closure audit row is committed |
| R2-022 | P2 | Fixed | Consent log and admin sign-in audit record Render's proxy IP, not the client IP |
| R2-023 | P2 | Fixed | Cross-origin API switch without Access-Control-Max-Age adds a CORS preflight to almost every request |
| R2-024 | P2 | Fixed | Upload helpers sign the user out when token renewal fails on the network |
| R2-025 | P2 | Mitigated | Closure check ignores pending money-in; settlements can credit a closed account |
| R2-026 | P1 | Fixed | Backing out of the Paystack page blocks every new plan checkout for an hour |
| R2-027 | P2 | Fixed | Checkouts Paystack keeps 'in flight' never expire: they block the member's purchases and clog the sweep |
| R2-028 | P2 | Fixed | An open checkout that cannot be verified locks the member out for 7 days (e.g. sub_free_ reference) |
| R2-029 | P2 | Fixed | Store reconcile sweep takes the billing rail back for a dead store purchase once a web plan lapses |
| R2-030 | P2 | Fixed | A late success on an EXPIRED checkout leaves its coupon redemption RELEASED (per-user limit can be bypassed) |
| R2-031 | P2 | Fixed | Late charge.success on a FAILED subscription checkout is still dropped, and the sweep and create path now mark FAILED automatically |
| R2-032 | P2 | Fixed | Merge broke the subscription refund test: revoke is passed in the providerPaymentEvents slot |
| R2-033 | P2 | Mitigated | Refunds of charges made before this deploy never revoke the plan (no paymentReferences backfill) |
| R2-034 | P2 | Mitigated | Apple sandbox receipts grant real production entitlements by default |
| R2-035 | P2 | Fixed | Admin says deactivating a plan does not affect existing subscribers, but it removes their creator donations |
| R2-036 | P2 | Fixed | Mobile (web build) says 'Buy again before X' but offers no renew action, and yearly-only plans show as Free |
| R2-037 | P2 | Fixed | Team seat limit is checked outside a transaction and only when inviting |
| R2-038 | P2 | Fixed | Expiry sweep sends every ended campaign's automatic payout to manual review |
| R2-039 | P2 | Fixed | Live-stat 'exactly once' is really 'at most once': projector swallows errors, so the outbox never retries |
| R2-040 | P2 | Fixed | Split disclosure shown to donors even when split accrual is switched off |
| R2-041 | P2 | Fixed | Campaign-report review lacks the four-eyes check added to safety reports |
| R2-042 | P1 | Fixed | Staff-assisted account closure always fails after the merge, and writes a 'closure' audit row first |
| R2-043 | P2 | Fixed | New 401 retry replays MFA setup/enable after a wrong password or code, counts the attempt twice, then signs the admin out |
| R2-044 | P2 | Fixed | Refund dialog ignores money already refunded: a partially refunded payment defaults to the full original amount |
| R2-045 | P2 | Fixed | Refund idempotency key lives only as long as the dialog; closing and reopening after a lost response can issue a second partial refund |
| R2-046 | P2 | Fixed | Payout reject/approve/verify-KYC failures replace the whole list with 'Payouts couldn't be loaded' and discard typed notes; KYC verify loses the loaded destination |
| R2-047 | P2 | Fixed | Upload signs the admin out when the token refresh fails only because of the network |
| R2-048 | P2 | Fixed | Campaign reports queue lacks labels for two reasons clients can now send |
| R2-049 | P2 | Fixed | 'Lift the current restriction anyway' appears after any restore error, not only the 409 supersede refusal |
| R2-050 | P2 | Fixed | Donation/subscription/affiliate calls still read the token with an unguarded helper that prefers the legacy key: fails when storage is blocked, and sends a revoked token after a password change |
| R2-051 | P2 | Fixed | "Anonymous by default" is overridden: the donation forms always send an explicit isAnonymous=false before the profile setting has loaded, or when it fails to load |
| R2-052 | P2 | Fixed | Repeat donation with the same details shows the previous gift's thank-you page; refunded, disputed or processing replays leave the donor stuck |
| R2-053 | P2 | Fixed (duplicate of the legal-copy fix) | Cookie Notice claims to list all browser storage but omits keys added in other branches and misdescribes the donation handoff |
| R2-054 | P2 | Fixed | Image and KYC upload signs the user out when the forced token renewal hits a network error or 5xx |
| R2-055 | P2 | Fixed | Campaign creation idempotency key is lost on reload although the draft is restored for resubmission, so a lost response can create a duplicate campaign |
| R2-056 | P2 | Fixed | Hard-coded absolute API URL in .env.production breaks Vercel Preview deployments |
| R2-057 | P2 | Fixed | Privacy cover and suspended biometric lock leave react-native-paper Portal dialogs visible (e.g. the creator withdrawal dialog) |
| R2-058 | P2 | Fixed | Global 30s request timeout is shorter than the server's AI-writing path, so users lose results and daily quota |
| R2-059 | P2 | Fixed | Wallet tab can show the previous account's balance and transactions after a different user signs in |
| R2-060 | P2 | Fixed | Explore resets to page 1 on every focus, and a failed refetch wipes the list and shows 'No campaigns found' |
| R2-061 | P2 | Mitigated | Referral deep-link handling cannot run for real referral links: the app has no https app links or associated domains |
| R2-062 | P2 | Fixed | Minimum-version gate compares the marketing version, but EAS only auto-increments build numbers |
| R2-063 | P1 | Fixed | Organizer Agreement §10 claims acceptance is captured through the account agreement, but no flow ever shows or accepts the Organizer Agreement |
| R2-064 | P1 | Fixed | New FAQ answer 'Our team reviews every campaign before it goes live' is false: campaigns up to GHS 250k go live without a person reviewing them |
| R2-065 | P1 | Fixed | FAQ false-claim fixes live only in the CMS seed, which is applied only to an empty collection, so production keeps serving the old claims |
| R2-066 | P2 | Fixed | Help FAQ, which the branch cleaned up, still promises missing features: 24-48h review SLA, 90-day limit with a one-time 30-day extension, and editing a live campaign |
| R2-067 | P2 | Fixed | Cookie Notice claims to list everything kept in the browser but misses storage added by other merged branches and misstates retention |
| R2-068 | P2 | Fixed | Five legal documents were substantively rewritten but still show the old effective date (8 September 2026) |
| R2-069 | P2 | Fixed | Web app metadata still says 'verified campaigns' while marketing was changed to 'reviewed campaigns, verified organizers' |
| R2-070 | P2 | Fixed | Privacy Notice contradicts itself on analytics |

## Test cases by area

| Area | Cases | P0 | File |
| --- | --- | --- | --- |
| Accounts & sign-in | 91 | 29 | [cases/AUTH.md](cases/AUTH.md) |
| Profile, settings & privacy | 95 | 29 | [cases/PROFILE.md](cases/PROFILE.md) |
| Campaigns | 90 | 32 | [cases/CAMPAIGN.md](cases/CAMPAIGN.md) |
| Donations & checkout | 92 | 44 | [cases/DONATE.md](cases/DONATE.md) |
| Wallet, ledger & refunds | 86 | 47 | [cases/WALLET.md](cases/WALLET.md) |
| KYC, KYB & payouts | 86 | 41 | [cases/PAYOUT.md](cases/PAYOUT.md) |
| Plans & subscriptions | 112 | 49 | [cases/SUBS.md](cases/SUBS.md) |
| Live fundraising | 90 | 29 | [cases/LIVE.md](cases/LIVE.md) |
| Creators, organizations & affiliates | 106 | 49 | [cases/CREATOR.md](cases/CREATOR.md) |
| Trust & safety | 89 | 31 | [cases/SAFETY.md](cases/SAFETY.md) |
| Admin console | 109 | 53 | [cases/ADMIN.md](cases/ADMIN.md) |
| Notifications, email & marketing site | 102 | 30 | [cases/COMMS.md](cases/COMMS.md) |
| Mobile platform (iOS & Android) | 106 | 34 | [cases/MOBILE.md](cases/MOBILE.md) |
| Ghana & store compliance, operations | 102 | 60 | [cases/COMPLIANCE.md](cases/COMPLIANCE.md) |
| Cross-cutting journeys & edge cases | 190 | 55 | [cases/GAP.md](cases/GAP.md) |
