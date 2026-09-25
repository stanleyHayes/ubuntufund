# Donations & checkout (78 cases)

Guest and signed-in Paystack donations, iOS website handoff, wallet donations, tips, coupons, anonymity and messages, callbacks, webhooks, receipts, crypto gating.

[Back to the QA plan](../README.md)

## DONATE-001 · P0 · Guest card donation on web, end to end

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Staging with Paystack TEST keys; Paystack test webhook URL = <staging-api>/api/v1/webhooks/paystack; ACTIVE GHS campaign owned by a Community-plan organizer; tester logged out in a fresh browser profile.

**Steps:**

1. Open https://<web>/c/<slug> and tap 'Donate now'.
2. On /c/<slug>/donate tap the GH₵50 chip, enter a valid email, leave name/message empty, leave tip empty.
3. Confirm the button reads 'Donate GH₵50.00' and press it.
4. On Paystack checkout pay with Paystack's documented successful test card.
5. Wait on /donate/callback without refreshing.
6. Reload /c/<slug> and the campaign donations tab; as admin call GET /api/v1/admin/payments?campaignId=<id>.

**Expect:** Redirect goes to Paystack (never shows success before payment). Callback moves from 'Confirming your payment…' to 'Thank you for showing up.' and 'Your GH₵50.00 donation is confirmed' within ~30s. Campaign raised total increases by exactly 50.00. The new donation shows as anonymous (no name was given). Admin payments row: status SUCCEEDED, provider paystack, amount 50, tip 0, providerRef uf-<intentId>-<8hex>, platformFeeMinor 175 (3.5%), providerFeeMinor = Paystack 'fees', netCampaignAmountMinor = 5000 - 175 - providerFeeMinor.

**Needs:** Paystack test keys + webhook delivery

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## DONATE-002 · P0 · Guest mobile-money donation on web (MTN / Telecel test flow)

*Surfaces:* api, web  ·  *Type:* functional

**Before:** As DONATE-001; Paystack test-mode Ghana mobile money enabled on the test merchant.

**Steps:**

1. Open /c/<slug>/donate, enter GH₵20, email, press 'Donate GH₵20.00'.
2. In Paystack checkout choose Mobile Money and complete it with Paystack's documented test MoMo number/OTP.
3. Wait on /donate/callback.
4. As admin GET /api/v1/admin/payments?providerRef=<ref>.

**Expect:** Donation confirmed on the callback page; admin view shows paymentMethod mapped from channel mobile_money; the donation record's paymentMethod is MOBILE_MONEY (visible in admin Donations page 'Method' and export). Campaign raised +20.00 exactly once.

**Needs:** Paystack test keys with MoMo channel

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts (providerToPaymentMethod)`, `apps/web/src/pages/DonatePage.tsx`

## DONATE-003 · P0 · Signed-in web donation is linked to the account (and expired-token fallback)

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Donor A signed in on web with a verified account; ACTIVE campaign.

**Steps:**

1. While signed in, go to /c/<slug>/donate, donate GH₵30 by test card (email must be typed; it is not prefilled).
2. Open /donations (My donations).
3. Sign in again, then in devtools replace the stored access token with an expired/invalid one and make another GH₵10 donation.
4. Check /donations again after refreshing the session.

**Expect:** The GH₵30 donation appears in My donations with the campaign name, amount GHS 30.00, method Card, status Completed. For the expired-token donation the API silently treats the donor as a guest: payment still succeeds but it does NOT appear in My donations — record this as a known limitation and decide whether the web client should refresh the token before creating the intent.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/fundraising.ts (createDonationIntent token)`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`

## DONATE-006 · P0 · Platform tip money accuracy (tip goes to platform, not campaign)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Community-plan campaign (3.5%); Paystack test keys; admin token.

**Steps:**

1. Donate GH₵100 with tip GH₵5 on /c/<slug>/donate; button must read 'Donate GH₵105.00'.
2. Pay in Paystack; note the charged amount on the Paystack test dashboard.
3. On callback, read the thank-you text.
4. GET /api/v1/admin/payments?providerRef=<ref> and GET /api/v1/admin/payments/<intentId>.
5. Check campaign raised total before/after.

**Expect:** Paystack charged exactly 105.00 GHS (10500 pesewas). Callback: 'Your GH₵100.00 donation is confirmed' and 'thank you for the extra GH₵5.00 tip'. Campaign raised +100.00 (not 105). Admin view: amount 100, tip 5, platformFeeMinor 350, providerFeeMinor = Paystack fee on the full 105, netCampaignAmountMinor = 10000 - 350 - providerFeeMinor. NOTE: the processor fee on the tip portion is charged to the campaign — confirm with finance that this is the intended policy and disclosed.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/FeePolicy.ts (computeSettlementFromProvider)`, `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## DONATE-007 · P0 · Platform fee follows the organizer's plan and the campaign's locked rate

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Five campaigns whose organizers are on Community (3.5%), Plus (3.0%), Pro (2.5%), Organization (2.0%), Enterprise (1.25%); one older campaign created while its organizer was on Community who has since upgraded to Pro.

**Steps:**

1. Donate exactly GH₵100 by test card to each campaign.
2. For each, read platformFeeMinor from GET /api/v1/admin/payments?campaignId=<id>.
3. Donate GH₵100 to the older (locked-rate) campaign.

**Expect:** platformFeeMinor = 350 / 300 / 250 / 200 / 125 respectively. The older campaign keeps its locked 3.5% (350) despite the organizer's upgrade. In every case netCampaignAmountMinor + platformFeeMinor + providerFeeMinor = 10000 exactly.

**Needs:** Paystack test keys; plan subscriptions set up (store sandbox or admin)

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `packages/types/src/subscription.ts`, `apps/api/src/application/services/FeePolicy.ts`

## DONATE-008 · P0 · Rounding: odd and >2-decimal amounts reconcile to the pesewa

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Community-plan campaign; Paystack test keys.

**Steps:**

1. Web: donate 33.33 (fee 3.5% = 1.16655).
2. Web: type 1.005 and 10.125 in Amount; compare button label to the amount Paystack shows, then pay 10.125.
3. Android: try entering 10.125 in Amount.
4. For each settled donation read admin payments minor-unit fields and the campaign raised delta.

**Expect:** 33.33: platformFeeMinor 117 and net+platform+provider = 3333 exactly. For 10.125 the button label, Paystack charge and credited amount must all agree (e.g. GH₵10.13 / 1013 pesewas) — any 1-pesewa disagreement between label and charge (classic 1.005 case) is a defect; web should restrict input to 2 decimals like Android. Android disables Donate for >2 decimals. Campaign raised equals credited amount, never a 3-decimal value.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx (parseAmount has no 2dp check)`, `apps/mobile/app/donate/[id].tsx (2dp validation)`, `apps/api/src/domain/value-objects/Money.ts`, `apps/api/src/application/services/FeePolicy.ts`

## DONATE-011 · P0 · Declined card shows failure and allows retry without charge

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Paystack test keys; Paystack documented 'declined' test card.

**Steps:**

1. Donate GH₵40 and pay with the declined test card.
2. If Paystack returns to the site, observe /donate/callback; otherwise close checkout and check the intent via admin payments.
3. Press 'Try again' and complete with a good card.

**Expect:** Failed intent ends FAILED (or stays PENDING if Paystack never reports it) and campaign raised unchanged. Callback failed state: 'Payment didn't go through' with 'Try again' -> /c/<slug>/donate. The retry creates a new intent and credits exactly once.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts (handleChargeFailed)`

## DONATE-013 · P0 · Double-click, back button and resubmission never double-charge

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; network throttling in devtools.

**Steps:**

1. Throttle to Slow 3G, fill the form and double/triple-click 'Donate'.
2. Count intents created (admin payments search by campaign, last minute).
3. Complete payment, then press browser Back from the callback to the Paystack page and try to pay again.
4. Refresh /donate/callback several times after success.

**Expect:** Button disables on first click ('Starting secure checkout…'); at most one intent per actual submission. Paying the same Paystack reference twice is impossible or, if Paystack allows it, the second webhook is a no-op (one donation, one journal). Refreshing the callback never creates new records.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/lib/fundraising.ts (fresh Idempotency-Key per call)`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## DONATE-014 · P0 · Forged callback / verify requests cannot confirm or probe payments

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Two intents from different donors; curl.

**Steps:**

1. Open /donate/callback?reference=uf-<otherIntentId>-deadbeef.
2. POST /api/v1/donation-intents/<intentId>/verify with a reference that does not match its providerRef.
3. POST verify for a wallet intent id with any reference.
4. Open /donate/callback?reference=uf-<unpaidIntentId>-<its real hex> (unpaid).

**Expect:** Mismatched reference -> 404 'Payment reference not found'; wallet intent -> 400 'This payment does not use hosted checkout'. Unpaid intent stays pending/timeout — never shows success. Only the public view (no email/name/message) is ever returned.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`, `apps/web/src/pages/DonateCallbackPage.tsx`

## DONATE-015 · P0 · Campaign status gating across all donate entry points

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Campaigns in states: ACTIVE, FUNDED (raised >= goal, end date in future), ACTIVE but endDate in the past, PENDING_REVIEW, BLOCKED, DRAFT.

**Steps:**

1. For each campaign open web /c/<slug>, /c/<slug>/donate and /campaigns/<id>.
2. Open the campaign in Android and iOS and tap the donate button.
3. Call POST /api/v1/donation-intents for each campaign.

**Expect:** FUNDED: donations accepted everywhere ('Goal reached · Still accepting donations' chip on /campaigns/:id). KNOWN BUG TO VERIFY: /c/<slug> (the shared link/QR page) disables the button and says 'Donations closed' for FUNDED because it checks status === ACTIVE only (the same bug was fixed for iOS in 7d2e4a95). Past-end-date ACTIVE, PENDING_REVIEW, BLOCKED, DRAFT: buttons disabled/'Donations closed', /c/<slug>/donate shows 'This campaign isn't accepting donations right now', API returns 400 'Campaign is not accepting donations'.

**Needs:** none

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx (isActive)`, `packages/types/src/campaign.ts (acceptsCampaignDonation)`, `apps/api/src/domain/entities/Campaign.ts (canReceiveDonation)`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`

## DONATE-016 · P0 · Campaign ends or is blocked while donor is on Paystack checkout

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Campaign ending in ~5 minutes (or admin able to block it); Paystack test keys.

**Steps:**

1. Start a GH₵60 donation and stay on the Paystack page.
2. Let the end date pass (or block the campaign in admin).
3. Complete payment.
4. Check intent, campaign raised, campaign balance and admin payments.

**Expect:** Externally verified money is not lost: settlement credits the ledger even though the campaign no longer accepts new donations (design in DONATION_SETTLEMENT_INTEGRITY.md). Confirm ops has a documented refund/hold procedure for donations to blocked campaigns; the donor sees a confirmed state.

**Needs:** Paystack test keys

**Source:** `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## DONATE-017 · P0 · Paystack webhook signature enforcement

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging secret key known to the tester; a PENDING intent's reference.

**Steps:**

1. POST /api/v1/webhooks/paystack with a valid charge.success body but no x-paystack-signature.
2. Repeat with a wrong signature, then with a signature computed over a different body (e.g. extra whitespace).
3. Repeat with the correct HMAC-SHA512 (openssl dgst -sha512 -hmac $PAYSTACK_SECRET_KEY) over the exact raw bytes.
4. Send malformed JSON with a valid signature.

**Expect:** Missing/wrong/altered -> 401 'Invalid webhook signature' and no state change. Correct signature -> 200 {status:'ok'} and settlement. Malformed JSON with valid signature -> 400. With PAYSTACK_SECRET_KEY unset -> 501.

**Needs:** Paystack test secret key

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts (verifyWebhookSignature)`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/paystackWebhookRoutes.ts`

## DONATE-018 · P0 · Webhook replay and concurrent delivery credit exactly once

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A successful test donation; captured raw webhook body + signature (or Paystack dashboard resend if available).

**Steps:**

1. Re-POST the identical signed charge.success 3 times sequentially.
2. Fire it 5 times concurrently (e.g. xargs -P5 curl).
3. Also trigger POST /api/v1/admin/payments/<id>/reconcile and POST /donation-intents/<id>/verify for the same intent.

**Expect:** All return 200. Exactly one donation record, one ledger journal entry, one outbox row; campaign raised and balance increase once; coupon (if any) redeemed once. Admin timeline may show extra 'succeeded' attempts but no extra money.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/use-cases/PostDonationJournalUseCase.ts`, `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`

## DONATE-019 · P0 · Webhook amount or currency mismatch is never credited

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A PENDING intent for GH₵100 (+0 tip); signing capability.

**Steps:**

1. Send a signed charge.success for that reference with amount 5000 (GH₵50).
2. Send one with currency 'USD' and amount 10000.
3. Run POST /api/v1/admin/payments/<id>/reconcile (Paystack verify will say the real amount).

**Expect:** Mismatched webhooks: 200 but intent stays PENDING, no donation/journal, a 'failed' payment attempt is recorded and a warning logged. Reconcile returns 'mismatched' if Paystack's verified amount differs, or 'repaired' if the real charge matches. Campaign never credited from forged/partial amounts.

**Needs:** Paystack test secret key

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts (handleChargeSuccess)`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## DONATE-021 · P0 · Late success after FAILED is not silently lost

*Surfaces:* admin, android, api  ·  *Type:* recovery/idempotency

**Before:** Signing capability; intent in PENDING.

**Steps:**

1. Send signed charge.failed for the intent's reference.
2. Then send signed charge.success (matching amount) for the same reference.
3. Check intent status, donation records, campaign raised and admin timeline.

**Expect:** Current code: FAILED intents ignore later charge.success (money taken, campaign not credited, not picked up by reconciliation since it only scans PENDING). This must be treated as a launch risk: confirm whether Paystack can report failed then success on one reference (e.g. MoMo retry in the same checkout, see DONATE-064) and ensure ops can detect and manually credit/refund (search payment attempts with status succeeded on FAILED intents).

**Needs:** Paystack test secret key

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts (lines ~264-269, 351-358)`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## DONATE-022 · P0 · Missed webhook is repaired by callback verify, scheduled sweep, or admin reconcile

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with NODE_ENV=production and PAYMENTS_RECONCILIATION_ENABLED=true; ability to block webhooks (point Paystack test webhook URL elsewhere).

**Steps:**

1. Block webhooks. Donation A: pay and stay on /donate/callback.
2. Donation B: pay then close the tab immediately.
3. Donation C: pay then close; do not wait for the sweep — call POST /api/v1/admin/payments/<C>/reconcile as admin.
4. Wait 35–40 minutes for B.
5. Call POST /api/v1/admin/reconciliation and read the summary.

**Expect:** A becomes SUCCEEDED via /verify within the callback's polling window. C returns {outcome:'repaired', status:'SUCCEEDED'}. B is repaired by the 5-minute sweep once older than 30 minutes. Each credited exactly once; summary counts match. Non-admin calling reconcile -> 403.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/app.ts (reconciliation timer ~L958)`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## DONATE-023 · P0 · Reconciliation sweep is not starved by abandoned checkouts

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging DB; ability to create >100 abandoned Paystack intents (script POST /donation-intents without paying) and backdate or wait 30 min.

**Steps:**

1. Create 110 abandoned hosted intents and let them age past 30 minutes.
2. Block webhooks and complete one real payment (intent Z); close the tab.
3. Wait for two or more sweep cycles (5 min each) after Z is 30 minutes old.
4. Check Z's status.

**Expect:** Z must be repaired. RISK: findStalePending sorts by updatedAt ascending with limit 100 and reconcileOne does not touch 'pending/abandoned' intents, so the same 100 oldest abandoned rows are re-scanned forever and Z is never reached. If Z stays PENDING this is a launch blocker (paid donations never credited without the webhook).

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts (findStalePending)`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts (reconcileOne)`

## DONATE-024 · P0 · API sleep/restart during settlement (Render free tier cold start)

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Deployed staging on the same Render plan as prod (render.yaml plan: free).

**Steps:**

1. Let the API idle until Render spins it down (15+ min).
2. Complete a Paystack payment so the webhook hits a cold instance.
3. Separately, restart the API right after a webhook is accepted.
4. Watch the campaign page SSE/progress and admin payments.

**Expect:** Donation settles (Paystack retry or callback verify) and is credited once; after restart the boot outbox sweep delivers the pending donation.succeeded realtime event. Note cold-start latency; if webhooks time out repeatedly, move off the free plan before launch (timers for reconciliation/outbox/activity alerts also stop while the instance sleeps).

**Needs:** Render deployment; Paystack test keys

**Source:** `render.yaml`, `apps/api/src/main.ts`, `apps/api/src/application/services/OutboxDispatcher.ts`

## DONATE-025 · P0 · Public payment-attempts endpoint cannot settle or hijack an intent

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A PENDING Paystack intent and a CREATED intent (if any) ids; curl without auth.

**Steps:**

1. POST /api/v1/donation-intents/<pendingId>/payment-attempts {provider:'paystack', status:'succeeded'}.
2. POST the same with status 'initiated' and providerRef 'uf-attacker-12345678'.
3. GET /donation-intents/<pendingId>/public and admin payments view.

**Expect:** 201 attempt recorded but intent status unchanged (never SUCCEEDED from this endpoint) and providerRef unchanged for a PENDING intent. Webhook for the real reference still settles correctly.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/RecordPaymentAttemptUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`

## DONATE-027 · P0 · Rate limiting keys on the real client IP behind Render's proxy

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Deployed staging behind Render; two testers on different networks (e.g. office Wi-Fi and a mobile hotspot).

**Steps:**

1. Tester 1 sends POST /api/v1/donation-intents and notes the X-RateLimit-Remaining header.
2. Tester 2 on a different network immediately sends one and notes X-RateLimit-Remaining.
3. Tester 1 sends 61 intent requests within 15 minutes.

**Expect:** Each tester has an independent counter (both start near 59). 61st request from tester 1 -> 429 'Too many requests…' with Retry-After; tester 2 is unaffected. RISK: the API never sets Express 'trust proxy', so req.ip may be the proxy address — if both testers share one counter, the whole platform shares 60 donation writes / 300 API calls per 15 min (launch blocker). Also consider mobile-carrier CGNAT and venue Wi-Fi at live events.

**Needs:** Render deployment

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/app.ts (no trust proxy)`

## DONATE-028 · P0 · Idempotency-Key semantics on POST /donation-intents

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Donor A and Donor B tokens; GHS wallets funded; Paystack test keys.

**Steps:**

1. Send the same Paystack request twice with header Idempotency-Key: K1.
2. Send with K2 (new key).
3. Wallet: Donor A sends provider=wallet GH₵5 with key W1 twice.
4. Donor B sends provider=wallet with key W1.
5. Donor A sends provider=paystack with key W1.

**Expect:** K1 twice -> same intent id and same reference; K2 -> new intent. W1 twice -> one debit of GH₵5, same SUCCEEDED intent. Donor B with W1 -> 403 'Donation intent belongs to another account'. Different method with W1 -> 409 'Idempotency key belongs to a different payment method'.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (assertWalletRetry)`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/DonationIntentController.ts`

## DONATE-029 · P0 · Web wallet donation happy path and money accuracy

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Donor A signed in with GHS wallet balance >= 100 (top up via /wallet); 'Ujimora Wallet' provider enabled in admin; Community-plan campaign.

**Steps:**

1. Open /campaigns/<id>, press 'Donate with wallet'.
2. Enter 50, select the Ujimora Wallet method, keep name, tick 'I am at least 18 and agree to the Terms of Use for this donation.', press 'Confirm Donation'.
3. Check snackbar, /wallet balance and transactions, campaign raised, admin payments.

**Expect:** Snackbar 'Your wallet donation was completed.' Wallet debited exactly 50.00 with a 'donation' transaction (reference donation-intent:<id>). Campaign raised +50.00. Admin view: provider wallet, providerFeeMinor 0, platformFeeMinor 175, netCampaignAmountMinor 4825. Donation appears in My donations with method Wallet.

**Needs:** Wallet top-up via Paystack test keys (setup)

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## DONATE-030 · P0 · Wallet insufficient balance or missing wallet

*Surfaces:* android, api, web  ·  *Type:* negative/edge

**Before:** Donor with GHS wallet balance 10.00; a second donor with no wallet.

**Steps:**

1. Web wallet dialog: donate 25.
2. Android: choose 'Ujimora wallet · existing balance', donate 25.
3. Second donor: API provider=wallet amount 5.

**Expect:** Error 'Insufficient wallet balance' (or 'No wallet found for this currency'); intent FAILED; balance unchanged (still 10.00); no donation or raised change; any coupon seat released.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts (wallet branch)`

## DONATE-031 · P0 · Web wallet 'Confirm Donation' double-submit / network retry

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Donor with GHS 100 balance; devtools.

**Steps:**

1. Open the wallet dialog, enter 20, rapidly double-click 'Confirm Donation'.
2. Throttle network, submit 20, set Offline right after the request leaves, then go online and press Confirm again.
3. Compare wallet transactions and donation count.

**Expect:** Exactly one debit per intended donation. RISK: the legacy POST /campaigns/:id/donate path generates a new random idempotency key per request and the web client sends no Idempotency-Key, so a retry after a lost response can debit twice — if observed, this is a launch blocker for wallet donations.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`

## DONATE-032 · P0 · Android wallet donation with tip; double tap and app kill

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android build signed in as Donor A with GHS 100 balance.

**Steps:**

1. Open a campaign, 'Donate Now', amount 30, tip 2, method 'Ujimora wallet · existing balance'.
2. Double-tap 'Donate 32.00 GHS'.
3. Repeat with a new amount but force-kill the app immediately after tapping; relaunch and reopen the same campaign's donate screen.

**Expect:** Wallet debited exactly 32.00 once; campaign raised +30 (tip to platform); screen shows 'Thank you for your support'. After the kill, the screen recovers the saved payment (same reference) rather than creating a second debit; 'Make another payment' clears it.

**Needs:** none

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/components/PaymentStatus.tsx`

## DONATE-033 · P0 · Wallet donations require authentication

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Logged-out browser; curl.

**Steps:**

1. Open /campaigns/<id> logged out and press 'Sign in to donate'.
2. POST /api/v1/donation-intents with provider 'wallet' and no token.
3. POST /api/v1/campaigns/<id>/donate with no token and with another user's expired token.

**Expect:** Button routes to /login and returns to the campaign after login. API: 400 'Wallet donations require an authenticated account'; legacy endpoint 401. No wallet is touched.

**Needs:** none

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx (handleOpenDonate)`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`

## DONATE-034 · P0 · Concurrent wallet donations cannot overdraw

*Surfaces:* android, api, web  ·  *Type:* recovery/idempotency

**Before:** Donor with exactly GHS 50 balance signed in on web and Android.

**Steps:**

1. At the same moment, donate 40 from web and 40 from Android (or two concurrent curl requests with different keys).

**Expect:** Exactly one succeeds; the other fails 'Insufficient wallet balance'; final balance 10.00, never negative; one donation.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts (withdrawIfSufficient)`

## DONATE-037 · P0 · Fee-waiver coupon reduces platform fee, not the gift

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin created a DONATION-surface coupon (e.g. 50% off, GHS, per-user limit 1) in admin Coupons; Community-plan campaign; Donor A signed in.

**Steps:**

1. On /c/<slug>/donate enter 200 and the code in 'Fee waiver code (optional)'.
2. Read the helper text, then donate by test card.
3. Inspect admin payments and the coupon's redemption count in admin Coupons.

**Expect:** Helper: 'Applied — GH₵3.50 more reaches this campaign.' Donor is charged exactly GH₵200.00. platformFeeMinor 350 (instead of 700); net = 20000 - 350 - providerFee. Redemption counted once and marked consumed after settlement (not at intent creation).

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (resolveFeeWaiver)`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts (redeemFeeWaiver)`, `apps/api/src/application/use-cases/PreviewCouponUseCase.ts`

## DONATE-042 · P0 · Anonymous donation stays anonymous everywhere

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** Signed-in Donor A; a second browser watching the campaign; admin.

**Steps:**

1. Donate with 'Give anonymously (hide my name publicly)' ticked (name field disables) on web, and 'Donate anonymously' on Android.
2. Check campaign donation history, home activity feed, live SSE feed, leaderboard, admin Donations page and its export.
3. Check Donor A's My donations.

**Expect:** Public surfaces show 'Anonymous', no donorId in /donations and /campaigns/:id/donations payloads. Admin Donations card shows 'Anonymous donor' with donorId blank in the API/export. Donor still sees the donation (isAnonymous true) in My donations.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ListRecentDonationsUseCase.ts`, `apps/api/src/application/use-cases/ListCampaignDonationsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminDonationRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`

## DONATE-043 · P0 · Public name/message consent (18+ and terms) enforced on client and server

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** ACTIVE campaign.

**Steps:**

1. Web: type a name (not anonymous) -> checkbox 'I am at least 18 and agree to the terms for posting my public name and message.' appears; try to submit without ticking.
2. Tick anonymous with a name and no message; observe checkbox.
3. API: POST with message and no legalAcceptance; with legalAcceptance version from an old date; with correct version.
4. Android: name + message without ticking -> Donate.

**Expect:** Submit disabled until ticked (web); Android shows 'Accept the content terms before posting your public name or message.' API: 428 'Accept the current content terms and confirm you are at least 18…' for missing/stale acceptance; accepted record stored on intent and donation with server timestamp and version. Anonymous + no message needs no checkbox.

**Needs:** none

**Source:** `apps/api/src/application/services/messageAgreement.ts`, `apps/web/src/components/donate/MessageAgreement.tsx`, `apps/mobile/app/donate/[id].tsx`

## DONATE-044 · P0 · Donor name/message content review: pending then approved

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Admin 1 (not donor, not campaign creator).

**Steps:**

1. Guest donates with name 'Ama K.' and message 'Get well soon' (consent ticked).
2. On the callback page read the review message.
3. Check campaign donation history / feed: name and message hidden.
4. Admin: Publication reviews > Content queue 'Campaign donor names and messages' > approve with notes >= 20 characters.
5. Back on callback press 'Refresh content review'; reload campaign page.

**Expect:** Callback: 'Your donation is confirmed. Your public name or message is awaiting review before it appears.' Before approval donation shows as Anonymous without message. After approval name and message appear on campaign history, home feed and live SSE; callback shows the approved message; audit log entry donation.content.approved.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationContentReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`, `apps/web/src/components/donate/DonationReviewStatus.tsx`, `packages/types/src/donation-intent.ts`

## DONATE-046 · P0 · Message/name injection and length limits

*Surfaces:* admin, android, api, web  ·  *Type:* security/permission

**Before:** Admin for approval.

**Steps:**

1. Donate with name '<img src=x onerror=alert(1)>' and message '<script>alert(1)</script> **bold** https://evil.example'.
2. Approve it in admin and view: campaign page, home feed, live overlay/feed, admin review queue, Android campaign screen.
3. Via API send message of 501 chars and name of 121 chars.

**Expect:** Rendered as inert text everywhere; no script execution, no clickable HTML. API rejects >500 message and >120 name with 400.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`, `apps/web/src/components/LiveDonationFeed.tsx`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## DONATE-056 · P0 · My donations (web) content and access control

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Donor A with card, MoMo and wallet donations across 2 campaigns; Donor B.

**Steps:**

1. Open /donations as Donor A; use status and method filters; check totals and 'Request Refund' visibility for a donation <30 days old.
2. Log out and open /donations.
3. As Donor B call GET /api/v1/donations/<DonorA donation id> and GET /api/v1/donations/mine.

**Expect:** All Donor A donations listed with correct amount, GHS currency, method and campaign link; totals correct. Logged out -> redirect to login. Donor B gets 404 for A's donation and only sees own list.

**Needs:** none

**Source:** `apps/web/src/pages/MyDonationsPage.tsx`, `apps/api/src/application/use-cases/GetDonationUseCase.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`

## DONATE-061 · P0 · Android guest card donation end to end

*Surfaces:* android, api  ·  *Type:* functional

**Before:** Android release-candidate build on a physical device; logged out; Paystack test keys.

**Steps:**

1. Open a campaign > 'Donate Now'; enter 50, email, method 'Card or mobile money · secure checkout'; tap 'Donate 50.00 GHS'.
2. Pay in the Custom Tab with the success test card; let Paystack redirect to app.ujimora.com/donate/callback inside the tab; close the tab.
3. Watch the app screen.

**Expect:** Tab shows the web confirmation; back in the app the status changes from 'Awaiting payment confirmation' to 'Thank you for your support' (celebration) within ~5s of foregrounding; 'Reference: <intentId>' shown; campaign raised +50.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts`

## DONATE-062 · P0 · Android abandoned checkout does not trap the donor

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android build; Paystack test keys.

**Steps:**

1. Start a GH₵30 donation, close the Custom Tab without paying.
2. Look for a way to change the amount or start over; leave the screen and come back; restart the app.
3. Wait 35+ minutes and tap 'Check status'.

**Expect:** Donor must be able to cancel/start a new donation. RISK: the screen shows 'Awaiting payment confirmation' with only 'Open secure checkout' and 'Check status'; 'Try again'/'Make another payment' only appear for terminal statuses, and abandoned Paystack intents never become terminal — the donor may be stuck on this campaign indefinitely (persisted in AsyncStorage). Launch blocker if reproduced.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## DONATE-063 · P0 · Android kill/restart mid-checkout and repeat donations

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android build; Paystack test keys.

**Steps:**

1. Start a GH₵40 card donation; while on Paystack, force-stop the app; complete payment in the browser.
2. Relaunch, open the same campaign's donate screen.
3. After success press 'Make another payment' and donate exactly GH₵40 again with the same details.

**Expect:** Relaunch recovers the saved payment and shows success after status check (no duplicate intent). 'Make another payment' clears saved keys so the identical second donation creates a NEW intent and new checkout (not the old reference) and credits separately.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/lib/payments.ts (paymentKey, clearPending)`, `apps/mobile/app/donate/[id].tsx`

## DONATE-064 · P0 · Android MoMo decline then retry in the same checkout

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android build; Paystack test MoMo that can be declined first then approved (or live-mode small amount in a controlled test).

**Steps:**

1. Start a MoMo donation; decline the first prompt so Paystack shows failure but keep the checkout open.
2. Return to the app briefly and tap 'Check status' (triggers server verify).
3. Go back to the checkout and retry, approve payment.
4. Check intent status and campaign raised.

**Expect:** Donation must be credited once. RISK: if the mid-checkout verify marks the intent FAILED (Paystack status 'failed'), the later charge.success is ignored and money is taken without credit (see DONATE-021).

**Needs:** Paystack test/live MoMo

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## DONATE-066 · P0 · iOS donation takes no payment in-app (App Store 3.2.1/3.2.2)

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iOS TestFlight build on a physical device; campaigns ACTIVE, FUNDED, expired.

**Steps:**

1. Open an ACTIVE campaign, tap 'Donate Now' -> 'Support this campaign' screen; tap 'Continue in browser'.
2. Confirm Safari opens https://app.ujimora.com/c/<slug>/donate (with ?amount if preset) and complete a test donation there.
3. Return to the app.
4. Repeat for FUNDED (must allow) and expired (must show 'This campaign is not accepting donations right now').
5. Search the whole iOS app for any amount entry, wallet donation, crypto, coupon, tip or creator-tip payment UI.

**Expect:** No payment entry or checkout inside the iOS app; only external Safari. Returning shows no success claim ('Returning to the app does not confirm payment…'). FUNDED allowed, expired blocked. No wallet/crypto/tip/coupon forms mounted on iOS.

**Needs:** Paystack test keys; TestFlight

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`

## DONATE-068 · P0 · Crypto is fully hidden and rejected when disabled (production default)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** CRYPTO_PAYMENTS_ENABLED=false (render.yaml default).

**Steps:**

1. Open /c/<slug>/donate on web; Android donate screen payment method list; iOS app.
2. GET /api/v1/payments/crypto/assets; POST /api/v1/campaigns/<id>/donations/crypto/quote {fiatAmount:50, asset:'USDT', network:'...'}; POST /campaigns/<id>/donations/crypto.
3. Admin > Payment providers crypto panel.

**Expect:** No 'Crypto' toggle on web, no crypto option on Android, nothing on iOS. assets -> {enabled:false, assets:[]}; quote/deposit -> 400 'Crypto donations are not enabled'. Admin panel shows 'No crypto currencies are currently available to contributors.' Matches APP_REVIEW_NOTES claim.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/CreateCryptoQuoteUseCase.ts`, `apps/api/src/application/use-cases/CreateCryptoDepositUseCase.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/admin/src/components/payments/CryptoOperations.tsx`

## DONATE-071 · P0 · Crypto webhook security, replay, finality and amount mismatch

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Crypto enabled on staging with mock provider; an open deposit (reference cryp-…).

**Steps:**

1. POST /webhooks/crypto/mock with a bad x-mock-signature.
2. Send deposit.confirmed with confirmations below requiredConfirmations.
3. Send deposit.confirmed with a cryptoAmount different from the quote (non-mock provider rule) and with the correct amount.
4. Replay the same event id twice; send an event for an unknown reference; send deposit.failed for another deposit.

**Expect:** Bad signature -> 401. Low confirmations -> PROCESSING, no credit. Amount mismatch -> 409 'Crypto deposit amount requires review', no credit. Correct -> SUCCEEDED once; replay returns 'duplicate' with no second credit. Unknown ref -> 503 (provider retries). deposit.failed -> FAILED.

**Needs:** Mock crypto provider or Bitnob sandbox

**Source:** `apps/api/src/application/use-cases/HandleCryptoWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/cryptoWebhookRoutes.ts`

## DONATE-078 · P0 · Live-mode smoke donation before public launch

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Production with LIVE Paystack keys and live webhook URL https://api.ujimora.com/api/v1/webhooks/paystack configured in the Paystack dashboard; a real internal test campaign.

**Steps:**

1. Make a GH₵1–5 real donation by card and one by MoMo on web, one on Android, one via iOS Safari handoff.
2. Confirm settlement timing, Paystack fee, platform fee and net in admin payments; confirm raised totals.
3. Refund them through the refund process and verify ledger reversal.

**Expect:** All four settle via webhook within seconds, amounts/fees match Paystack's dashboard to the pesewa, no duplicate records, refunds reverse correctly. Only then open to the public.

**Needs:** Paystack LIVE keys; store builds

**Source:** `render.yaml`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## DONATE-005 · P1 · Donate form and API input validation

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** ACTIVE campaign; curl/Postman.

**Steps:**

1. On /c/<slug>/donate try amounts '', '0', '1.2.3', letters (field strips them), then a bad email (blur), then a tip of '.'.
2. Confirm the submit button state for each.
3. Via API POST /api/v1/donation-intents with: amount -5; amount 0; tip -1; provider 'paystack' without donorEmail; donorEmail 'x'; message of 501 chars; donorName of 121 chars; unknown provider 'momo'; campaignId of a non-existent id.

**Expect:** Web: button disabled while amount/email/tip invalid; helper texts 'Enter an amount greater than zero', 'Enter a valid email address', 'Enter a valid tip amount'. API: 400 validation errors for schema violations; 'An email is required to pay with Paystack' (400) when email missing; 'Campaign not found' (404) for unknown campaign. No intent rows are created for any rejected request (check admin payments search).

**Needs:** none

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

## DONATE-009 · P1 · Very small and very large amounts fail gracefully

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** ACTIVE campaign; Paystack test keys.

**Steps:**

1. Donate GH₵0.01 and GH₵0.10 on web.
2. Donate GH₵1,000,000 on web.
3. If Paystack accepts a tiny amount, settle it and inspect fees.

**Expect:** If Paystack rejects initialization, the page shows an error (e.g. 'Paystack initialization failed: …') and stays on the form; no success is shown. If accepted, settlement never produces a negative net: processor fee honored first, platform fee capped, netCampaignAmountMinor >= 0. Decide and document a minimum donation amount.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`, `apps/api/src/application/services/FeePolicy.ts`

## DONATE-010 · P1 · Callback page states: success, pending timeout, other browser, missing reference

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; ability to delay webhooks (point Paystack test webhook to an unreachable URL temporarily).

**Steps:**

1. Complete a payment and copy the full /donate/callback?reference=... URL.
2. Open that URL in a different browser (no localStorage handoff).
3. With webhooks blocked, complete another payment and wait ~30s for 'Still confirming your payment', then press 'Keep checking'.
4. Open /donate/callback with no query string.

**Expect:** Other browser still resolves the intent from the uf-<id>-<hex> reference and shows the confirmed state ('Back to campaign' links to /campaigns/<id>). With webhooks blocked, the page's verify calls repair the payment (server-side Paystack verify) — it should turn SUCCEEDED without the webhook; if it times out, 'Keep checking' restarts polling. No-reference page shows 'We couldn't find a payment reference…'. Flag: that copy promises 'your receipt is emailed once payment is confirmed' but Ujimora sends no receipt by default (see DONATE-059).

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## DONATE-012 · P1 · Abandoned web checkout leaves no donation and does not block a new one

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; admin token.

**Steps:**

1. Start a GH₵25 donation, reach Paystack, close the tab without paying.
2. Return to /c/<slug>/donate and complete a GH₵25 donation normally.
3. After 35+ minutes (production-mode staging) or via POST /api/v1/admin/payments/<abandonedIntentId>/reconcile, inspect the abandoned intent.

**Expect:** No donation or raised change from the abandoned attempt; the new one succeeds. The abandoned intent stays PENDING (Paystack 'abandoned' maps to 'pending'; fiat intents never expire). Record the count of such PENDING rows — they feed the starvation risk in DONATE-023.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`

## DONATE-020 · P1 · Unknown and non-donation references are safe no-ops

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Signing capability.

**Steps:**

1. Send signed charge.success with reference 'uf-000000000000000000000000-abcdef12' (unknown).
2. Send signed charge.success with no reference.
3. Send signed events with prefixes sub-, tip-, wtop- that don't exist.
4. Send an unhandled event type (e.g. 'customeridentification.success').

**Expect:** All 200; no donation, intent or balance changes; donation path is never run for sub-/tip-/wtop- references.

**Needs:** Paystack test secret key

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## DONATE-026 · P1 · Public intent view leaks no donor PII

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A settled intent with donor email, name and message.

**Steps:**

1. GET /api/v1/donation-intents/<id>/public logged out.
2. Inspect response body and headers.
3. GET with a random 24-hex id.

**Expect:** Only id, campaignId, liveSessionId, amount, tip, currency, status, provider, isAnonymous, timestamps, contentReviewStatus. No donorEmail, donorName, message, idempotencyKey. Cache-Control private, no-store. Unknown id -> 404.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/GetDonationIntentPublicUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/DonationIntentController.ts`

## DONATE-035 · P1 · Admin wallet/Paystack provider toggles actually gate donations

*Surfaces:* admin, android, api, web  ·  *Type:* functional

**Before:** Admin account; Donor with wallet balance.

**Steps:**

1. Admin > Payment providers: disable 'Ujimora Wallet'. Try web wallet dialog, Android wallet method, and API provider=wallet.
2. Re-enable wallet. Disable 'Paystack'. Try web /c/<slug>/donate and Android card/MoMo.
3. With Paystack disabled, deliver a webhook for a checkout started before the toggle.
4. Re-enable Paystack.

**Expect:** Wallet off: web shows 'Wallet donations are not currently available.' RISK: Android still offers wallet and the API still accepts wallet donations (the wallet rail ignores the toggle) — decide if acceptable. Paystack off: new intents 400 'paystack payments are currently switched off' even though the admin page text says Paystack is configured separately (fix the copy or behaviour); already-started checkouts still settle via webhook.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (assertRailEnabled)`, `apps/web/src/lib/campaignDetailPolicy.ts`

## DONATE-038 · P1 · Fee-waiver coupon negative paths

*Surfaces:* android, api, web  ·  *Type:* negative/edge

**Before:** Codes: expired, subscription-only surface, non-GHS currency, per-user limit 1 already used by Donor A, unknown code; a plan configured with 0% fee (via admin Manage plans) for one campaign.

**Steps:**

1. Logged out: confirm the coupon field is hidden; POST /donation-intents with couponCode -> observe.
2. Signed in: enter each bad code and try to submit.
3. Use the valid code on the 0%-fee campaign.

**Expect:** Guest API -> 422 'Sign in to use a discount code'. Invalid codes show the reason and the Donate button is disabled; API returns 422 (e.g. 'You have already used this code the maximum number of times', 'This code is issued in X and cannot be applied to a GHS donation'). 0% fee -> 'There is no platform fee on this donation to waive'. No intent is created on refusal.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/donate/[id].tsx`

## DONATE-039 · P1 · Coupon seat lifecycle on failed, refused and abandoned payments

*Surfaces:* android, api, web  ·  *Type:* recovery/idempotency

**Before:** Per-user-limit-1 donation coupon; Donor A with low wallet balance.

**Steps:**

1. Android: wallet donation with the code larger than balance -> fails; retry with the code on a funded amount.
2. Web: start a Paystack donation with the code, abandon checkout, then try the code again on a new donation.
3. Deliver charge.failed for a coupon intent, then reuse the code.

**Expect:** Insufficient-balance and charge.failed release the seat so the code works again. Abandoned checkout: the seat stays PENDING because the intent never becomes terminal — donor is blocked with 'already used… maximum number of times'. Record as a risk and define ops handling.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/donationCouponSeats.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## DONATE-041 · P1 · Android coupon entry and live quote

*Surfaces:* android, api  ·  *Type:* cross-platform

**Before:** Signed-in Android donor; valid donation coupon.

**Steps:**

1. On the donate screen type the code (auto-uppercased) with amount 100.
2. Change amount to 300 and watch the note.
3. Donate with wallet.

**Expect:** Note shows 'Applied — X GHS more reaches this campaign.' and updates with amount (400ms debounce). Invalid code shows the reason in red and disables Donate. Settlement fee matches the quote.

**Needs:** none

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/coupons.ts`

## DONATE-045 · P1 · Content review rejection and reviewer permission checks

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Pending donor content; Admin 1; an admin who is the campaign creator; a non-admin staff user; a restricted donor account.

**Steps:**

1. Admin 1 rejects with 20+ char notes.
2. Try approve with notes 'ok'; with a stale version hash; a second decision on the same item.
3. Campaign-creator admin tries to review; non-admin calls PUT /admin/donation-content-reviews/<id>/review.
4. Restricted donor tries to donate with a message.

**Expect:** Reject: stays anonymous; donor sees 'was not approved. Contact support@ujimora.com…'. Short notes -> 400; stale version -> 409 'The content changed…'; second decision -> 409. Creator/donor reviewer -> 403 'Another administrator must review this content.'; non-admin -> 403. Restricted donor -> 403 'Publishing is restricted following a moderation review…'.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationContentReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`

## DONATE-048 · P1 · Profile privacy/receipt toggles vs actual donation behaviour

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** Signed-in donor.

**Steps:**

1. Android Settings: turn on 'Anonymous Donations' and turn off 'Donation Receipts'.
2. Open a donate screen on Android and web.
3. Donate and check public display and any emails.

**Expect:** Expected by users: donate forms default to anonymous and receipts respect the toggle. RISK: these profile fields are stored but not used — the anonymous checkbox still defaults off and no receipt is governed by that toggle. Either wire them or remove/relabel before launch (privacy expectation).

**Needs:** none

**Source:** `apps/mobile/app/settings.tsx`, `apps/api/src/infrastructure/database/models/ProfileModel.ts`, `apps/mobile/app/donate/[id].tsx`

## DONATE-049 · P1 · Live-session attributed donation updates overlay and session stats

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Organizer has an active live session for the campaign (LIVEKIT_* configured if video is needed; donations work without video); overlay link open in a second window; approved-content donor.

**Steps:**

1. Viewer opens /live/<sessionId> and presses 'Support this campaign' (URL /c/<campaignId>/donate?liveSessionId=<id>).
2. Donate GH₵20 with a name + message (consent ticked); approve content in admin.
3. Watch the overlay and the live page feed; toggle host privacy (hide names/amounts/messages) and donate again.

**Expect:** Donation settles with liveSessionId recorded; overlay/live feed shows the donation within seconds; session amount raised increments by 20. With privacy toggles: name 'Anonymous', amount null, message hidden. Campaign total also updates.

**Needs:** Paystack test keys; LiveKit only for video

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`

## DONATE-050 · P1 · Invalid live-session attribution is rejected

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Live session belonging to campaign X; campaign Y.

**Steps:**

1. Open /c/<Y-slug>/donate?liveSessionId=<X session id> and submit.
2. API POST with liveSessionId 'nonexistent'.
3. Open an ended session's /live page and check the donate link.

**Expect:** 400 'Live session does not belong to this campaign' shown on the form; no intent created. Ended session link has no liveSessionId (plain campaign donation).

**Needs:** none

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/web/src/pages/WatchLivePage.tsx`

## DONATE-051 · P1 · Live donate from Android and iOS carries attribution

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Active live session; Android and iOS physical devices.

**Steps:**

1. Android: open the live screen, 'Support this campaign', donate by card.
2. iOS: same button -> 'Continue in browser'; inspect the Safari URL; donate there.

**Expect:** Android intent has liveSessionId. iOS opens https://app.ujimora.com/c/<slug>/donate?liveSessionId=<24-hex> (plus amount if preset) and the resulting web donation is attributed to the session. No token or donor data in the URL.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`

## DONATE-052 · P1 · Campaign page realtime progress and history

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Web build with VITE_SSE_ENABLED=true; campaign with goal 1000 and raised 200.

**Steps:**

1. Open /campaigns/<id> in browser A (logged out).
2. From browser B donate GH₵60 (crosses 25%) and later enough to cross 50% and 100%.
3. Watch browser A without reloading; disconnect/reconnect A's network during a donation.

**Expect:** Progress bar and raised total update live; donation history refreshes (~300ms after event); milestone events at 25/50/75/100%. After reconnect, missed events replay or data refreshes on focus/30s poll. With VITE_SSE_ENABLED unset, history still updates via 30s poll/focus.

**Needs:** Paystack test keys

**Source:** `apps/web/src/hooks/useSSE.ts`, `apps/web/src/hooks/usePublicFeed.ts`, `apps/web/src/hooks/useLiveTotals.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`

## DONATE-053 · P1 · Home activity feed privacy and visibility

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Donations on a public campaign and on a PENDING_REVIEW/BLOCKED campaign; a donor who blocked the viewer; guest approved named donation.

**Steps:**

1. Open the home page activity feed logged out and as the blocked viewer.
2. GET /api/v1/donations?limit=500 and ?limit=abc.

**Expect:** Only public-campaign donations; blocked/restricted donors' identity hidden; unapproved names hidden; guest approved name shows the approved name or 'Guest donor'. limit capped at 100, invalid limit defaults to 20. Cache-Control private, no-store.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/ListRecentDonationsUseCase.ts`, `apps/web/src/components/GlobalActivityFeed.tsx`

## DONATE-057 · P1 · Refunded donation state in My donations

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** A donation fully refunded through the refund flow (admin refund with Paystack test keys).

**Steps:**

1. Open /donations on web and My donations on Android.
2. Use the 'Refunded' filter; read totals and the row's actions.

**Expect:** Refunded donation should show 'Refunded', be excluded from 'total donated', and not offer 'Request Refund'. RISK: the API hardcodes status 'completed' for every donation, so it will still show Completed with a refund button — fix or accept before launch.

**Needs:** Paystack test keys (refund)

**Source:** `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/mobile/app/my-donations.tsx`

## DONATE-058 · P1 · Mobile My donations and iOS Safari donation linkage

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** Signed-in donor in the iOS and Android apps; Safari not signed in to app.ujimora.com.

**Steps:**

1. Android: donate, then open Profile > My donations; pull to refresh; filter.
2. iOS: donate via 'Continue in browser' while Safari is signed out; then open My donations in the app.
3. Repeat on iOS after signing in on Safari first.

**Expect:** Android donation listed. iOS signed-out Safari donation is a guest donation and does NOT appear in the app — make sure support copy/FAQ explains this; after signing in on Safari it appears. Amounts show the recorded currency.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/my-donations.tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`

## DONATE-059 · P1 · Donation confirmation notifications and emails (activity alerts)

*Surfaces:* android, api, email, web  ·  *Type:* compliance

**Before:** RESEND_API_KEY and FROM_EMAIL set; donor with verified email and one with unverified email; Paystack test merchant receipts setting noted.

**Steps:**

1. As a new donor, donate and check inbox/in-app notifications (defaults).
2. Web Settings > activity alerts: enable 'Donations you make' In-app alert and Email; donate again; wait up to ~60s.
3. Unverified user tries to enable Email.
4. Guest donates with an email address.

**Expect:** Defaults: no Ujimora notification (all categories default OFF). After opt-in: in-app notification + email 'Your donation is confirmed' with the right amount/campaign and the text 'This payment confirmation is not a charitable tax certificate.' Exactly one email per donation. Unverified -> 409 'Verify your email address before enabling activity emails.' Guest gets only Paystack's receipt (if enabled). Decide whether launch needs an automatic donor receipt (compliance C14) and fix callback copy promising an emailed receipt.

**Needs:** Resend (email provider); Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`, `packages/types/src/activity-alerts.ts`, `apps/web/src/pages/DonateCallbackPage.tsx`

## DONATE-060 · P1 · Campaign owner is notified of new donations

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Organizer opted in to 'Donations received' in-app + email.

**Steps:**

1. Guest donates GH₵15 to the organizer's campaign.
2. Check organizer's notifications and inbox; open the link.

**Expect:** 'Your campaign received a donation' with 'A supporter donated GHS 15.00 to “<title>”.' linking to /campaigns/<id>; no donor identity leaked in the email for anonymous/guest donations.

**Needs:** Resend; Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## DONATE-067 · P1 · iOS handoff copy matches what the website offers

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iOS build.

**Steps:**

1. Read the iOS 'Support this campaign' screen text.
2. Follow the link and compare with /c/<slug>/donate.

**Expect:** iOS says 'Continue in your browser to choose an amount, review fees and make your donation. You may need to sign in on the website to use your wallet.' The linked page has no fee breakdown and no wallet option (wallet is only on /campaigns/:id). Align copy or link before store submission to avoid misleading reviewers/donors.

**Needs:** none

**Source:** `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`

## DONATE-069 · P1 · Crypto donation happy path and money accuracy (staging)

*Surfaces:* admin, android, api, web  ·  *Type:* functional

**Before:** Staging (NODE_ENV not production) with CRYPTO_PAYMENTS_ENABLED=true and CRYPTO_PRIMARY_PROVIDER=mock (or Bitnob sandbox); mock webhook secret known.

**Steps:**

1. Web: on /c/<slug>/donate choose 'Crypto', amount 100, email; pick USDT + network; 'Review quote'; check rate/provider fee/network fee; 'Get payment address'.
2. Verify address, QR and copy buttons; 'Send only USDT on <network>' warning; countdown.
3. Simulate deposit.detected then deposit.confirmed (mock: POST /api/v1/webhooks/crypto/mock with x-mock-signature = HMAC-SHA256(body) and matching cryptoAmount/confirmations).
4. Check the panel, campaign raised, admin payments.

**Expect:** Panel goes to 'Your contribution is confirmed'. Campaign raised +100.00 GHS (locked rate). Ledger net = 100 - platform fee (plan %) - provider/network fee. RISK: the quote says 'Campaign receives GH₵100.00' but the campaign nets less after fees — fix the label or disclose. Payment method CRYPTO in admin Donations.

**Needs:** Mock crypto provider or Bitnob sandbox

**Source:** `apps/web/src/components/donate/CryptoDonatePanel.tsx`, `apps/api/src/application/use-cases/HandleCryptoWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/crypto/MockCryptoProvider.ts`

## DONATE-070 · P1 · Crypto quote/deposit expiry, stale quote and limits

*Surfaces:* android, api, web  ·  *Type:* negative/edge

**Before:** Crypto enabled on staging; CRYPTO_QUOTE_TTL_SECONDS small (e.g. 60) for testing; CRYPTO_MIN_GHS 10, CRYPTO_MAX_GHS 100000.

**Steps:**

1. Get a quote, then change the amount -> observe.
2. Wait for quote expiry -> observe; try 'Get payment address' via API with the expired quoteId.
3. Request quotes for 9.99 and 100001 GHS, a non-allowlisted asset, and a network not offered.
4. Let the deposit window expire.

**Expect:** Amount change -> 'Your contribution amount changed. Get an updated quote.'; expiry -> 'This quote expired. Refresh it…'; expired quote API -> 400 'This quote has expired — request a new one'. Limits -> 400 'Crypto contributions must be between GHS 10 and GHS 100000'; bad asset/network -> 400. Expired deposit window shows 'The payment window has closed. Do not send to this address now…'.

**Needs:** Mock crypto provider or Bitnob sandbox

**Source:** `apps/api/src/application/use-cases/CreateCryptoQuoteUseCase.ts`, `apps/api/src/application/use-cases/CreateCryptoDepositUseCase.ts`, `apps/web/src/components/donate/CryptoDonatePanel.tsx`, `apps/mobile/src/components/CryptoContribution.tsx`

## DONATE-072 · P1 · Crypto late deposit and admin reconciliation

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Crypto enabled; a deposit whose window expired; provider reports it confirmed (mock getDeposit or sandbox); admin and non-admin staff accounts.

**Steps:**

1. Admin > Payment providers > crypto panel: 'Check deposits older than' 15 minutes -> 'Reconcile deposits'.
2. Review summary (Scanned/Settled/Detected/Failed/Pending/Errors/Blocked) and export.
3. Non-admin staff opens the panel; call POST /api/v1/admin/crypto/reconcile with olderThanMinutes -1.

**Expect:** Late confirmed deposit is settled once and counted as Settled; missing references appear as 'Deposits requiring investigation' without donor email. Non-admin sees 'An administrator must run reconciliation.' and API 403; negative age -> 400.

**Needs:** Mock crypto provider or Bitnob sandbox

**Source:** `apps/api/src/application/use-cases/ReconcileCryptoUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/cryptoAdminRoutes.ts`, `apps/admin/src/components/payments/CryptoOperations.tsx`

## DONATE-074 · P1 · Admin Donations ledger page

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin; staff user without admin role but with DONATIONS permission; mix of named, anonymous and guest donations.

**Steps:**

1. Open admin /donations; filter Named/Anonymous; search by donor/campaign; export.
2. Check totals text '<n> donations · GH₵ <total> total'.
3. Log in as non-admin staff and open /donations; call GET /api/v1/admin/donations?pageSize=101.

**Expect:** Lists real donations (not fixtures) with campaign title, supporter ('Anonymous donor' / name / 'Former or guest supporter'), amount, method, date; export columns match and anonymous rows have no donorId. Non-admin API -> 403 (page shows error state); pageSize 101 -> 400.

**Needs:** none

**Source:** `apps/admin/src/pages/DonationsPage.tsx`, `apps/admin/src/hooks/useApiData.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminDonationRoutes.ts`

## DONATE-075 · P1 · Admin payment trace and reconcile API (no console UI)

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin JWT; non-admin JWT; succeeded, pending and failed intents.

**Steps:**

1. GET /api/v1/admin/payments?status=PENDING&provider=paystack; ?providerRef=<ref>; ?campaignId=<id>.
2. GET /api/v1/admin/payments/<id> (timeline).
3. POST /api/v1/admin/payments/<id>/reconcile for each state.
4. Repeat with non-admin token.

**Expect:** Search returns normalized rows incl. fee split in minor units and donorEmail; timeline lists attempts without raw provider payloads. Reconcile: SUCCEEDED -> 'skipped'; PENDING paid -> 'repaired'; unknown id -> 404. Non-admin -> 403. Note: ops must use API tools because the admin console has no page for this — prepare a runbook.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## DONATE-076 · P1 · Currency and rail flags reject unsupported contributions

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** PAYMENTS_MULTI_CURRENCY_ENABLED=false, PAYMENTS_INTERNATIONAL_CARDS_ENABLED=false, PAYMENTS_FLUTTERWAVE_ENABLED=false (render.yaml).

**Steps:**

1. POST /donation-intents with currency 'USD'; with currency 'ghs' (lowercase); with provider 'flutterwave'; with paymentMethod 'card' and country 'US'.
2. From web, pay with a foreign (non-Ghana) Paystack test card in GHS.

**Expect:** USD -> 400 'Contributions in USD are not enabled'; 'ghs' accepted as GHS; flutterwave -> 400 'Flutterwave payments are not enabled'; card+US -> 400 'International card contributions are not enabled'. Foreign card on the web form (which sends no paymentMethod/country) is decided by the Paystack account — verify the Help page claim 'anyone worldwide can donate… family abroad included' is actually true in live mode.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/marketing/src/pages/HelpPage.tsx`, `render.yaml`

## DONATE-077 · P1 · Split-proceeds accrual on settled donations

*Surfaces:* api, web  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true (as in render.yaml — confirm this is intended for launch); campaign with an active split (e.g. 60/40) and all beneficiary consents accepted.

**Steps:**

1. Donate GH₵100 by test card and GH₵33.33 by wallet.
2. Inspect per-beneficiary balances/accruals and campaign balance.

**Expect:** Per-beneficiary accruals sum exactly to each donation's beneficiaryNet (no pesewa lost or created); campaign pending balance equals the sum. If a consent is missing, settlement rolls back and the donation stays PENDING for retry — no partial credit.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/SplitAccrualService.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`, `render.yaml`

## DONATE-004 · P2 · Amount preset via ?amount= and preset chips

*Surfaces:* web  ·  *Type:* functional

**Before:** ACTIVE campaign.

**Steps:**

1. Open /c/<slug>/donate?amount=75 and check the Amount field.
2. Open /c/<slug>/donate?amount=-5, ?amount=abc, ?amount=0.
3. Tap each preset chip (20/50/100/200) and check the pressed state and button label.

**Expect:** ?amount=75 prefills 75 and the button reads 'Donate GH₵75.00'. Invalid/negative/zero presets are ignored (field empty, button 'Continue to payment' disabled). Selected chip is aria-pressed and visually highlighted.

**Needs:** none

**Source:** `apps/web/src/pages/DonatePage.tsx`

## DONATE-036 · P2 · Legacy wallet endpoint rejects unsupported currency and methods

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Donor token.

**Steps:**

1. POST /api/v1/campaigns/<id>/donate {amount:5, currency:'USD', paymentMethod:'wallet'}.
2. POST with paymentMethod 'card'.
3. POST with amount 0.

**Expect:** USD -> 400 'Contributions in USD are not enabled' (multi-currency off); card -> 400 'This payment method is not available for live transactions yet'; amount 0 -> 400 validation. No debit.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (resolveCurrency)`

## DONATE-040 · P2 · Coupon global limit race

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Donation coupon with global limit 1; two donor accounts.

**Steps:**

1. Both donors create intents with the code at the same time and pay.
2. Check both donations and the coupon count.

**Expect:** Both donations settle at the waived fee (quoted terms honored); coupon count does not exceed the limit or a warning 'already at its global limit' is logged. Decide whether this over-redemption is acceptable.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts (redeemFeeWaiver)`

## DONATE-047 · P2 · Post-donation message edit API

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Donor A's settled donation id; Donor B token.

**Steps:**

1. Donor A POST /api/v1/donations/<id>/message {message:'Thanks!'} without legalAcceptance, then with it.
2. Donor B posts to the same id.
3. Post to a guest donation id and to an unknown id.

**Expect:** Without acceptance -> 428; with -> 200 contentReviewStatus 'pending' and prior approval cleared (hidden until re-reviewed). Donor B -> 403 'You can only edit your own donation message'; guest/unknown -> 403/404. (No UI exists for this endpoint — confirm it is intended.)

**Needs:** none

**Source:** `apps/api/src/application/use-cases/AddDonationMessageUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.ts`

## DONATE-054 · P2 · Campaign donations list pagination and access control

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Campaign with 25+ donations; a PENDING_REVIEW campaign with donations; owner and admin tokens.

**Steps:**

1. GET /api/v1/campaigns/<id>/donations?page=2&pageSize=10.
2. GET for the non-public campaign as guest, as owner, as admin.
3. GET with pageSize=100000 and time it.

**Expect:** Correct slice, total and totalPages. Non-public: 404 for guest/others, 200 for owner/admin. Large pageSize is served (no cap) and the endpoint loads all donations into memory — note the performance/DoS risk for large campaigns.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/ListCampaignDonationsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/DonationController.ts`

## DONATE-055 · P2 · Donor count with guest donations

*Surfaces:* api, web  ·  *Type:* functional

**Before:** New campaign.

**Steps:**

1. Make 3 guest donations with 3 different emails and 1 signed-in donation.
2. Check '… donors · Distinct supporters' on /campaigns/<id>.

**Expect:** Expected 4 distinct supporters. Current code groups all guests under donorId 'guest', so it will show 2 — decide whether to fix or relabel before launch.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.ts (countDistinctDonorsByCampaignIds)`, `apps/web/src/pages/CampaignDetailPage.tsx`

## DONATE-065 · P2 · Deep link to donate with preset amount (Android)

*Surfaces:* android  ·  *Type:* cross-platform

**Before:** Android build installed.

**Steps:**

1. adb shell am start -a android.intent.action.VIEW -d 'ujimora://c/<slug>/donate?amount=25'.
2. Repeat with an unknown slug.

**Expect:** Opens the donate screen for the campaign with Amount 25 prefilled; unknown slug shows a recoverable error, not a crash.

**Needs:** none

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/campaign/shared.tsx`

## DONATE-073 · P2 · Crypto deposit double-submit and account linkage

*Surfaces:* android, api, web  ·  *Type:* recovery/idempotency

**Before:** Crypto enabled; signed-in donor.

**Steps:**

1. Web: throttle network, press 'Get payment address', go offline/online and press again.
2. Android: accept quote twice quickly.
3. After a confirmed crypto donation, check the donor's My donations.

**Expect:** Ideally one deposit per quote. RISK: web sends no Idempotency-Key, so a retry can open a second deposit/address (Android uses a persisted key). RISK: crypto intents are always created with donorUserId null, so signed-in crypto donations never appear in My donations.

**Needs:** Mock crypto provider or Bitnob sandbox

**Source:** `apps/web/src/lib/crypto.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CryptoController.ts`, `apps/api/src/application/use-cases/CreateCryptoDepositUseCase.ts`
