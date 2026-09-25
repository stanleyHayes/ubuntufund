# Donations & checkout (92 cases)

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

**Before:** Donor A signed in on web with a verified account; ACTIVE campaign; Paystack test keys.

**Steps:**

1. While signed in, go to /c/<slug>/donate and donate GH₵30 by test card. The email must be typed because it is not prefilled.
2. Open /donations (My donations).
3. Sign in again. In devtools replace the stored access token with an expired or invalid one and make another GH₵10 donation.
4. Check /donations again after refreshing the session.

**Expect:** The GH₵30 donation appears in My donations with the campaign name, amount GHS 30.00, method Card and status Completed. Requirement: a donation made while the donor believes they are signed in is linked to their account. The client should refresh the token first, or the donor should be told they are giving as a guest. Known open issue I122: the API still treats an expired or invalid token on POST /donation-intents as a guest, so the GH₵10 payment succeeds but does not appear in My donations. Both clients refresh before expiry, so this only happens with clock skew or a revoked session. Record what you observe.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/fundraising.ts (createDonationIntent token)`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`

## DONATE-006 · P0 · Platform tip money accuracy (tip goes to platform, not campaign)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Community-plan campaign (3.5%); Paystack test keys; admin token; donor signed in with the 'Donations you make' in-app alert enabled (optional).

**Steps:**

1. Donate GH₵100 with a GH₵5 tip on /c/<slug>/donate. The button must read 'Donate GH₵105.00'.
2. Pay in Paystack and note the charged amount on the Paystack test dashboard.
3. On the callback page, read the thank-you text.
4. GET /api/v1/admin/payments?providerRef=<ref> and GET /api/v1/admin/payments/<intentId>.
5. Compare the campaign raised total before and after. If alerts are on, read the donor notification.

**Expect:** Paystack charges exactly 105.00 GHS (10500 pesewas). The callback shows 'Your GH₵100.00 donation is confirmed' and '… And thank you for the extra GH₵5.00 tip to support Ujimora.' Campaign raised goes up by 100.00, not 105. Admin view: amount 100, tip 5, platformFeeMinor 350, providerFeeMinor = the Paystack fee on the full 105, and netCampaignAmountMinor = 10000 - 350 - providerFeeMinor. The opted-in donor alert adds 'Total charged: GHS 105.00, including a GHS 5.00 optional platform tip.' Known open issue I048: the Paystack fee on the tip portion is still charged to the campaign, and the donor sees no fee breakdown. The policy and disclosure decision is pending, so record the observed providerFeeMinor.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/FeePolicy.ts (computeSettlementFromProvider)`, `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts (donorCharge)`

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

## DONATE-008 · P0 · Rounding: odd amounts reconcile to the pesewa and >2-decimal amounts are refused everywhere

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Community-plan campaign; Paystack test keys; Android build.

**Steps:**

1. Web: donate 33.33 (3.5% fee = 1.16655).
2. Web: type 1.005, then 10.125, in Amount and read the helper text and button. Then type 10.13 and pay.
3. Android: enter 10.125 in Amount, then 10,13 (decimal comma).
4. API: POST /api/v1/donation-intents with amount 10.125, and with amount 10.25 and tip 0.1.
5. For each settled donation, read the admin payments minor-unit fields and the campaign raised change.

**Expect:** 33.33: platformFeeMinor 117, and net + platform + provider = 3333 exactly. Web 1.005 and 10.125: helper 'Enter an amount greater than zero, with at most 2 decimal places', and the button is disabled ('Continue to payment'), so the label and the charge can never disagree. 10.13: the button reads 'Donate GH₵10.13', Paystack charges 1013 pesewas and raised goes up by 10.13. Android: 10.125 keeps Donate disabled; '10,13' is accepted as 10.13 ('Donate 10.13 GHS'). API: 10.125 returns 400 'Validation failed'; 10.25 with tip 0.1 returns 201. Campaign raised never holds a 3-decimal value.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/lib/moneyInput.ts`, `apps/mobile/src/lib/moneyInput.ts`, `apps/mobile/app/donate/[id].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts (multipleOf 0.01)`, `apps/api/src/application/services/FeePolicy.ts`

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

**Before:** Paystack test keys; devtools network throttling; admin token.

**Steps:**

1. Throttle to Slow 3G, fill in the form and double- or triple-click 'Donate'.
2. Count the intents created (admin payments search by campaign, last minute) and check that every POST /donation-intents carried the same Idempotency-Key header.
3. On the Paystack page press browser Back. Re-enter exactly the same details and press Donate again (reload the form first if it is restored stuck on 'Starting secure checkout…').
4. Complete the payment. Press Back from the callback to the Paystack page and try to pay again.
5. Refresh /donate/callback several times after success.

**Expect:** The button disables on the first click ('Starting secure checkout…'). All presses with the same details reuse one Idempotency-Key, so there is one intent, one Paystack initialize and the same uf-<intentId>-<hex> reference and checkout URL each time. Paying the same reference twice is impossible, or if Paystack allows it the second webhook is a no-op: one donation and one journal. Refreshing the callback never creates records.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/lib/checkoutAttempt.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (replayHostedIntent, markPendingIfCreated)`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

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

**Before:** Campaigns in these states: ACTIVE; FUNDED (raised >= goal, end date in the future); ACTIVE with endDate in the past; PENDING_REVIEW; BLOCKED; DRAFT.

**Steps:**

1. For each campaign open web /c/<slug>, /c/<slug>/donate and /campaigns/<id>.
2. Open the campaign in Android and iOS and tap the donate button.
3. Call POST /api/v1/donation-intents for each campaign.
4. For the past-end-date campaign, wait 5 minutes or more and re-read its status.

**Expect:** FUNDED accepts donations everywhere: /c/<slug> shows an enabled 'Donate now', /campaigns/:id shows the chip 'Goal reached · Still accepting donations', Android and iOS allow donating, and the API returns 201. Past-end-date, PENDING_REVIEW, BLOCKED and DRAFT campaigns (where the page is visible at all) show a disabled 'Donations closed' button. /c/<slug> adds 'This campaign isn't accepting donations right now.', and /c/<slug>/donate shows 'This campaign isn't accepting donations right now.'. Android shows 'This campaign is not accepting donations.' and iOS shows 'This campaign is not accepting donations right now.'. The API returns 400 'Campaign is not accepting donations'. Within about 5 minutes the expiry sweep relabels the ended campaign EXPIRED, and it stays closed.

**Needs:** none

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx (acceptsCampaignDonation)`, `packages/types/src/campaign.ts (acceptsCampaignDonation)`, `apps/api/src/domain/entities/Campaign.ts (canReceiveDonation)`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/app/donate/[id].tsx`

## DONATE-016 · P0 · Campaign ends or is blocked while donor is on Paystack checkout

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** A campaign ending in about 5 minutes, or an admin able to block it; Paystack test keys; organizer account with a verified payout account.

**Steps:**

1. Start a GH₵60 donation and stay on the Paystack page.
2. Let the end date pass, or block the campaign in admin.
3. Complete the payment.
4. Check the intent, campaign raised, campaign balance and admin payments.
5. For the blocked campaign: as organizer, request a payout. As admin, try to approve a payout that was requested before the block.

**Expect:** Externally verified money is never lost. Settlement credits the ledger and raised total even though the campaign no longer accepts new donations, and the donor sees the confirmed state. For a BLOCKED campaign, requesting or approving a payout is refused with 409 'This campaign is under review; payouts are paused'. Known open issue I040 (policy part): the refund-or-release procedure for money that reaches a blocked campaign is still an owner decision. Confirm ops has a documented hold or refund runbook.

**Needs:** Paystack test keys

**Source:** `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`

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

## DONATE-021 · P0 · Late success after FAILED is re-verified and credited exactly once

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Signing capability (PAYSTACK_SECRET_KEY); Paystack test keys; a way to block webhooks; admin token.

**Steps:**

1. Block webhooks. Create a donation and pay it successfully with the test card, so Paystack holds a real success for reference R.
2. Send a signed charge.failed for R. The intent becomes FAILED, and a callback page open on R shows 'Payment didn't go through'.
3. Send a signed charge.success for R with the matching amount and currency, or unblock webhooks and resend from the Paystack dashboard.
4. Replay the same charge.success 3 times.
5. Negative: for an intent whose checkout was never paid, send a signed charge.failed, then a signed charge.success with the matching amount.
6. Admin variant: on another paid intent marked FAILED, call POST /api/v1/admin/payments/<id>/reconcile. Reload the donor's /donate/callback?reference=<ref>.

**Expect:** The paid intent is re-verified with Paystack (same reference, status success, amount and currency match) and reopened FAILED → PENDING → SUCCEEDED. Campaign raised goes up exactly once, with one donation and one journal, and the API logs alert 'late_success_credited'. Replays add nothing. For the unpaid intent, the verify does not confirm success: it stays FAILED, nothing is credited, and the log reads 'late paystack success could not be verified — not crediting'. Admin reconcile of a paid FAILED intent returns {outcome:'repaired', status:'SUCCEEDED'}. Reloading the donor's callback re-checks the payment and shows it confirmed.

**Needs:** Paystack test secret key

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts (reopenVerifiedLateSuccess)`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts (reconcileById allowLateSuccess)`, `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts (reopenForLateSuccess)`

## DONATE-022 · P0 · Missed webhook is repaired by callback verify, scheduled sweep, or admin reconcile

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with PAYMENTS_RECONCILIATION_ENABLED not 'false', and either NODE_ENV=production or RECONCILIATION_SCHEDULER_ENABLED=true; a way to block webhooks (point the Paystack test webhook URL elsewhere); admin and non-admin tokens.

**Steps:**

1. Block webhooks. Donation A: pay and stay on /donate/callback.
2. Donation B: pay, then close the tab immediately.
3. Donation C: pay and close. Without waiting for the sweep, call POST /api/v1/admin/payments/<C>/reconcile as admin.
4. Wait 35–40 minutes for B.
5. Call POST /api/v1/admin/reconciliation and read the summary. Repeat as a non-admin and with no token.
6. Set RECONCILIATION_SCHEDULER_ENABLED=false, restart, and watch the logs for 10 minutes.

**Expect:** A becomes SUCCEEDED through /verify within the callback's polling window. C returns {outcome:'repaired', status:'SUCCEEDED'}. B is repaired by the 5-minute sweep once it is older than 30 minutes. Each is credited exactly once. The summary has scanned, repaired, failed, expired, mismatched, pending, skipped, tipsRepaired, tipsSettled and tipsFailed, and the counts match. Non-admin gets 403 and no token gets 401. With the scheduler flag false, no 'payment reconciliation sweep complete' log appears; only admin-triggered runs happen.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/app.ts (reconciliation scheduler)`, `apps/api/src/infrastructure/config/index.ts (reconciliationSchedulerEnabled)`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## DONATE-023 · P0 · Reconciliation sweep is not starved by abandoned checkouts

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with the scheduler on (see DONATE-022); staging DB access; admin token. The donation-intent limit is 60 per 15 minutes per client IP, so create the backlog across windows or IPs, or insert rows directly.

**Steps:**

1. Create 150 abandoned hosted Paystack intents and age them past 30 minutes (wait, or backdate updatedAt).
2. Block webhooks, complete one real payment (intent Z) and close the tab.
3. Once Z is 30 minutes old, wait for two sweep cycles (5 minutes each), or call POST /api/v1/admin/reconciliation twice with the default limit.
4. Check Z's status and the reconciledAt field on the backlog rows.
5. Call POST /api/v1/admin/reconciliation with {limit: 5000}.

**Expect:** Z is repaired (SUCCEEDED, credited once) within two sweeps. Every visited row gets a reconciledAt stamp and moves behind rows not yet checked, so the same 100 rows are no longer re-scanned forever. Backlog rows younger than 24 hours stay PENDING (counted as 'pending'); rows older than 24 hours become EXPIRED ('expired'). A requested limit above 500 is capped at 500 scanned.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts (findStalePending, recordReconciliationAttempt)`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts (MAX_RECONCILE_LIMIT, reconcileStale)`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## DONATE-024 · P0 · API sleep/restart during settlement (Render free tier cold start)

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Deployed staging on the same Render plan as production (render.yaml still has plan: free).

**Steps:**

1. Let the API idle until Render spins it down (15 minutes or more).
2. Complete a Paystack payment so the webhook hits a cold instance.
3. Separately, restart the API right after a webhook is accepted.
4. Watch the campaign page SSE/progress and admin payments.
5. Call GET /health and GET /health/ready during and after the restart.

**Expect:** The donation settles, through Paystack's retry or the callback verify, and is credited once. After a restart, the boot outbox sweep delivers the pending donation.succeeded realtime event. /health/ready returns 503 until MongoDB answers a ping, while /health stays 200; render.yaml's healthCheckPath is /health/ready. Record cold-start latency. Known open issue I003: the plan is still free, so the instance sleeps and the in-process reconciliation, outbox and activity-alert timers stop while it sleeps. Moving to an always-on plan is an owner decision.

**Needs:** Render deployment; Paystack test keys

**Source:** `render.yaml`, `DEPLOYMENT.md`, `apps/api/src/app.ts (/health/ready)`, `apps/api/src/main.ts`, `apps/api/src/application/services/OutboxDispatcher.ts`

## DONATE-025 · P0 · Removed payment-attempts endpoint cannot settle or hijack an intent

*Surfaces:* api  ·  *Type:* security/permission

**Before:** The id of a PENDING Paystack intent; curl, without auth and with an admin token.

**Steps:**

1. POST /api/v1/donation-intents/<pendingId>/payment-attempts {provider:'paystack', status:'succeeded'} without auth.
2. POST the same with status 'initiated' and providerRef 'uf-attacker-12345678'. Repeat with an admin token.
3. GET /api/v1/donation-intents/<pendingId>/public and the admin payments timeline for the intent.
4. Let the real webhook for the intent's reference arrive.

**Expect:** Every call returns 404, because the route no longer exists (Express 'Cannot POST …'). Intent status and providerRef are unchanged, and the timeline shows only attempts the server recorded, such as 'initiated' at checkout. The real webhook still settles the intent correctly.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/DonationIntentController.ts`, `SOCIAL_LIVE_FUNDRAISING.md`

## DONATE-027 · P0 · Rate limiting keys on the real client IP behind Render's proxy

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Deployed staging behind Render (Cloudflare edge); two testers on different networks (for example office Wi-Fi and a mobile hotspot); production-like web build.

**Steps:**

1. In devtools, confirm web API calls go straight to https://<api-host>/api/v1/..., not through <web>/api/v1.
2. Tester 1 sends POST /api/v1/donation-intents and notes the X-RateLimit-Remaining header.
3. Tester 2 on the other network immediately sends one and notes X-RateLimit-Remaining.
4. Tester 1 sends 61 intent or verify requests within 15 minutes.
5. Tester 1 repeats with forged X-Forwarded-For, X-Real-IP, True-Client-IP, X-Vercel-Forwarded-For and CF-Connecting-IP headers.
6. Perform an admin mutation and read the audit-log IP.

**Expect:** Each tester has an independent counter, both starting near 59. Tester 1's 61st request returns 429 'Too many requests, please try again later' with Retry-After, and tester 2 is unaffected. Forged headers neither reset nor move tester 1's bucket: the edge overwrites CF-Connecting-IP and X-Forwarded-For is ignored. IPv6 clients on the same /64 share one bucket. POST /donation-intents and /:id/verify share the 60-per-15-minute donation limit. The audit log records the real client IP. Known open issue I099: counters are in memory per instance and reset on restart, so run a single instance. Note the behaviour for shared carrier CGNAT or venue Wi-Fi at live events.

**Needs:** Render deployment

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/web/.env.production (VITE_API_URL)`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`

## DONATE-028 · P0 · Idempotency-Key semantics on POST /donation-intents

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Donor A and Donor B tokens; GHS wallets funded; Paystack test keys.

**Steps:**

1. Send the same Paystack request twice with header Idempotency-Key: K1.
2. Send K1 again with amount changed (then with a different donorEmail).
3. Send K1 with the original details as Donor B, and as a guest if K1 was created signed in.
4. Send a request with K2 (a new key).
5. Wallet: Donor A sends provider=wallet GH₵5 with key W1, twice.
6. Donor B sends provider=wallet with key W1.
7. Donor A sends provider=paystack with key W1.

**Expect:** K1 twice returns the same intent id, reference and authorization_url/access_code. Paystack is initialized once, so no second checkout opens. K1 with changed amount, tip, email or coupon returns 409 'This checkout request key was already used for different details.'. K1 from another identity returns the same 409 and never returns the other donor's checkout. K2 creates a new intent. W1 twice produces one GH₵5 debit and the same SUCCEEDED intent. Donor B with W1 gets 403 'Donation intent belongs to another account'. A different method with W1 gets 409 'Idempotency key belongs to a different payment method'.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (replayHostedIntent, assertWalletRetry)`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/DonationIntentController.ts`

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

1. Open the wallet dialog on /campaigns/<id>, enter 20 and rapidly double-click 'Confirm Donation'.
2. In devtools confirm POST /campaigns/<id>/donate carries an Idempotency-Key header.
3. Throttle the network and submit 20. Set Offline right after the request leaves so the response is lost, go back online and press Confirm again with the same details.
4. Change the amount to 21 and confirm.
5. Compare wallet transactions and the donation count.

**Expect:** Exactly one debit per intended donation. The retry after the lost response reuses the same Idempotency-Key and resolves to the first donation: the snackbar reads 'Your wallet donation was completed.' and there is no second debit. A changed amount gets a new key and debits separately. After a success or a definite refusal (such as low balance), the next donation uses a new key.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/lib/checkoutAttempt.ts`

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

**Before:** Donor A with card, MoMo and wallet donations across 2 campaigns, some under 30 days old; Donor B.

**Steps:**

1. Open /donations as Donor A. Use the status and method filters, check the totals, and read the action column for each recent card, MoMo and wallet donation.
2. Log out and open /donations.
3. As Donor B, call GET /api/v1/donations/<Donor A donation id> and GET /api/v1/donations/mine.

**Expect:** All of Donor A's donations are listed with the correct amount, GHS currency, method and campaign link, and the totals are correct. 'Request Refund' appears only on completed card or MoMo donations under 30 days old with no open request. Wallet donations show 'Wallet gift: contact support@ujimora.com for a refund' instead. Logged out, /donations redirects to login. Donor B gets 404 for A's donation and sees only their own list.

**Needs:** none

**Source:** `apps/web/src/pages/MyDonationsPage.tsx`, `apps/web/src/lib/donationRefunds.ts`, `apps/api/src/application/use-cases/GetDonationUseCase.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`

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

**Before:** Android build; Paystack test keys; staging DB access (to backdate) and admin token.

**Steps:**

1. Start a GH₵30 donation and close the Custom Tab without paying.
2. Leave the screen and come back, then restart the app.
3. Stay on the screen in the foreground for 15 minutes or more (or move the device clock forward).
4. Tap 'Start a new payment', change the amount to 35 and donate.
5. Backdate the first intent's createdAt by more than 24 hours and call POST /api/v1/admin/payments/<firstId>/reconcile (or wait for the sweep).

**Expect:** For the first 15 minutes the screen shows 'Awaiting payment confirmation' with 'Open secure checkout' and 'Check status', and the saved attempt survives a restart. After 15 minutes it adds 'Still not confirmed? If you already paid, don't pay again: that payment will still be confirmed once the provider reports it.' and a 'Start a new payment' button. Tapping it returns to the form with the saved attempt and keys cleared, and the new donation gets a new intent and checkout. The first intent stays PENDING until it is over 24 hours old, then becomes EXPIRED ({outcome:'expired'}); if it is paid late it is still credited once. While waiting, no 'Too many requests, please try again later' should appear. If it does, log a defect: the screen re-verifies every 5 s and /verify shares the 60-per-15-minute donation limit.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts (canStartOver, STALE_PAYMENT_MS, clearPending)`, `apps/mobile/app/donate/[id].tsx`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

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

## DONATE-064 · P0 · Android MoMo decline then retry in the same checkout is credited once

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android build; a Paystack test MoMo that can be declined first and then approved, or a small live-mode amount in a controlled test.

**Steps:**

1. Start a MoMo donation. Decline the first prompt so Paystack shows failure, but keep the checkout open.
2. Return to the app briefly and tap 'Check status', which triggers a server verify.
3. Go back to the checkout, retry and approve the payment.
4. Leave the donate screen and reopen the same campaign's donate screen without tapping 'Try again'.
5. Check the intent status, campaign raised and the admin timeline and logs.

**Expect:** If the mid-checkout verify saw Paystack 'failed', the intent is FAILED and the app shows 'Payment was not completed' with 'Try again'. After approval, Paystack's charge.success is re-verified with Paystack and the intent is reopened and credited exactly once: SUCCEEDED, raised up by the amount once, API log alert 'late_success_credited'. Reopening the donate screen re-checks the saved payment and shows 'Thank you for your support'. Record whether the app's 'Payment was not completed' screen, which stops polling, could lead a donor to tap 'Try again' and pay a second time.

**Needs:** Paystack test or live MoMo

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts (reopenVerifiedLateSuccess)`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`

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

## DONATE-N001 · P0 · Resubmitting the same web donation reopens the same Paystack checkout

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; ACTIVE campaign; admin token; browser devtools.

**Steps:**

1. On /c/<slug>/donate enter GH₵40 and an email and press 'Donate GH₵40.00'. In devtools note the POST /donation-intents Idempotency-Key header and the response's intent.id, reference and authorization_url.
2. Without paying, press browser Back. Re-enter exactly the same amount, email, name, anonymity and message choices, and press Donate again. Reload the form first if it is restored stuck on 'Starting secure checkout…'.
3. Compare the second request's key and response with the first.
4. Go back again, change the amount to 41 and press Donate.
5. Via the API, resend the first request's Idempotency-Key with amount 45, then with a different donorEmail.
6. Admin: GET /api/v1/admin/payments?campaignId=<id>, or search the Campaign ID on the admin Payments page.

**Expect:** The second press reuses the same Idempotency-Key and returns the same intent id, uf-<intentId>-<hex> reference and authorization_url, so Paystack is initialized once and the donor lands on the same checkout. sessionStorage 'ujimora:checkout-attempt:*' holds only digests, not amounts or emails. The changed amount sends a new key and creates a second intent. The API replays with a different amount or email return 409 'This checkout request key was already used for different details.'. Admin shows exactly two intents (40 and 41), and paying either credits exactly once.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/lib/checkoutAttempt.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (replayHostedIntent, markPendingIfCreated)`, `apps/api/src/infrastructure/database/models/DonationIntentModel.ts (hostedCheckout)`

## DONATE-N008 · P0 · A late payment on an expired (abandoned for more than 24 hours) checkout is credited once

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; staging DB write access; admin token.

**Steps:**

1. Start a GH₵15 donation on web and leave the Paystack checkout tab open without paying.
2. In donationintents, set that intent's createdAt and updatedAt to 25 hours ago.
3. Call POST /api/v1/admin/payments/<id>/reconcile.
4. Complete the payment in the still-open checkout.
5. Watch /donate/callback and admin payments. Replay the webhook.

**Expect:** Step 3 returns {outcome:'expired', status:'EXPIRED'}, because Paystack reports abandoned and the checkout is over 24 hours old; any coupon seat is released. After payment, charge.success is re-verified with Paystack and the intent is reopened and settled: SUCCEEDED, raised up by 15.00 exactly once, one journal, and the log shows alert 'late_success_credited'. The callback shows 'Your GH₵15.00 donation is confirmed', not 'This checkout expired'. Replays add nothing. If a coupon seat was released, the gift still settles at the quoted waiver (owner decision).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts (reopenVerifiedLateSuccess)`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts (expire)`, `apps/web/src/pages/DonateCallbackPage.tsx`

## DONATE-N010 · P0 · Legacy wallet donate endpoint honours Idempotency-Key

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Donor A with GHS 100 wallet balance; Donor C with GHS 2; Donor B token.

**Steps:**

1. As A, POST /api/v1/campaigns/<id>/donate {amount:10, currency:'GHS', paymentMethod:'wallet', isAnonymous:true} with Idempotency-Key K1 (a UUID) twice, then 3 times concurrently.
2. As A, send K1 with amount 12.
3. As A, send Idempotency-Key 'bad key!'.
4. As C, send amount 5 with key K2, then repeat K2.
5. As A, send two requests with no Idempotency-Key.
6. As B, send K1.

**Expect:** Step 1: every call returns 200 'Donation successful'; A is debited 10 once and there is one donation. Step 2: 409 'This request key was already used for a different donation'. Step 3: 400 'Invalid Idempotency-Key'. Step 4: the first call returns 400 'Insufficient wallet balance' and the replay returns 409 'This donation attempt did not go through. Please start a new donation.'; the balance is unchanged. Step 5: two separate donations. Step 6: B's own new donation, because keys are scoped per donor and B cannot address A's donation.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts (WALLET_REQUEST_KEY)`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts (donate)`

## DONATE-005 · P1 · Donate form and API input validation

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** ACTIVE campaign; curl or Postman.

**Steps:**

1. On /c/<slug>/donate type each of these in Amount: '' , '0', '1.2.3', '10.125', '1,000', '100,50' and letters. Letters are stripped as you type.
2. Enter a bad email and blur the field. Then type tips of '.' and '0.125'.
3. Note the submit button state and helper text for each input.
4. Via the API, POST /api/v1/donation-intents with each of: amount -5; amount 0; amount 10.125; tip -1; tip 0.125; provider 'paystack' without donorEmail; donorEmail 'x'; a 501-character message; a 121-character donorName; unknown provider 'momo'; a campaignId that does not exist.

**Expect:** Web: only digits, '.' and ',' stay in the money fields. The button is disabled while the amount, email or tip is invalid. Helper texts read 'Enter an amount greater than zero, with at most 2 decimal places', 'Enter a valid email address' and 'Enter a valid tip amount, with at most 2 decimal places'. '1.2.3', '10.125', '1,000' and '0.125' are rejected. '100,50' is accepted as a decimal comma and the button reads 'Donate GH₵100.50'. API: schema violations return 400 'Validation failed', including the 3-decimal amount and tip (they must be multiples of 0.01). A missing email returns 400 'An email is required to pay with Paystack'. An unknown campaign returns 404 'Campaign not found'. No intent is created for any rejected request (check admin payments search).

**Needs:** none

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/lib/moneyInput.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

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

## DONATE-010 · P1 · Callback page states: success, pending timeout, other browser, missing reference, expired

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; a way to delay webhooks (temporarily point the Paystack test webhook to an unreachable URL); write access to the staging DB to backdate one intent.

**Steps:**

1. Complete a payment and copy the full /donate/callback?reference=... URL.
2. Open that URL in a different browser. There is no sessionStorage handoff there.
3. With webhooks blocked, complete another payment. Wait about 30 s for 'Still confirming your payment', then press 'Keep checking'.
4. Open /donate/callback with no query string.
5. Start a checkout without paying. Set that intent's createdAt and updatedAt in donationintents to 25 hours ago, then open its /donate/callback?reference=<ref> URL.

**Expect:** The other browser still resolves the intent from the uf-<id>-<hex> reference and shows 'Thank you for showing up.', with 'Back to campaign' linking to /campaigns/<id>. With webhooks blocked, the page's verify calls repair the payment through a server-side Paystack verify, and it turns SUCCEEDED without the webhook. On timeout the page shows 'Still confirming your payment' with 'We haven’t confirmed this payment yet. If you received a Paystack receipt, don’t pay again. Choose Keep checking to verify its status securely.', and 'Keep checking' restarts polling. The page with no reference shows: 'We couldn't find a payment reference to confirm. If money left your account, don't pay again. Keep any receipt from Paystack or your bank or mobile money provider, and email support@ujimora.com with the reference so we can check it.' It makes no emailed-receipt promise. The backdated abandoned checkout is expired by the verify call and shows 'This checkout expired' with 'Your checkout session timed out before payment completed. You haven't been charged — you can try again.'

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/web/src/lib/donationHandoff.ts`, `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## DONATE-012 · P1 · Abandoned web checkout leaves no donation, does not block a new one, and expires after 24 hours

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; admin token; write access to the staging DB (to backdate one intent), or 24 hours of patience.

**Steps:**

1. Start a GH₵25 donation, reach Paystack and close the tab without paying.
2. In a new tab, open /c/<slug>/donate and complete a GH₵25 donation normally.
3. After 35 minutes or more, call POST /api/v1/admin/payments/<abandonedIntentId>/reconcile.
4. Set the abandoned intent's createdAt to more than 24 hours ago (or wait 24 hours). Call reconcile again, or wait for the 5-minute sweep.
5. Check the intent in admin payments and whether any fee-waiver seat it held is free again.

**Expect:** The abandoned attempt creates no donation and does not change raised; the new donation succeeds. Before 24 hours, reconcile returns {outcome:'pending', status:'PENDING'}, because Paystack reports 'abandoned' and the checkout could still be paid. After 24 hours it returns {outcome:'expired', status:'EXPIRED'}, and any coupon seat is released. Each sweep stamps reconciledAt, so abandoned rows rotate instead of blocking the queue. If the donor pays an EXPIRED checkout later, it is still credited once (see DONATE-N008).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts (ABANDONED_CHECKOUT_TTL_MS, expire)`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts (findStalePending, markExpiredIfPending)`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

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

## DONATE-035 · P1 · Admin wallet/Paystack provider toggles gate donations as described

*Surfaces:* admin, android, api, web  ·  *Type:* functional

**Before:** Admin account with Payment providers update permission; donor with a wallet balance.

**Steps:**

1. Admin > Payment providers: read the page note, then disable 'Ujimora Wallet'. Try the web wallet dialog, the Android wallet method and API provider=wallet.
2. Re-enable the wallet. Disable 'Paystack', then try web /c/<slug>/donate and Android card/MoMo.
3. With Paystack disabled, deliver a webhook for a checkout started before the toggle.
4. Re-enable Paystack from the console.

**Expect:** The page note says the Paystack and Flutterwave switches stop new donation checkouts on that gateway, that they do not yet affect wallet top-ups, subscriptions, creator tips or payouts, and that the Ujimora Wallet switch hides the wallet option on the website only. With the wallet off, /campaigns/:id shows 'Wallet donations are not currently available.'. With Paystack off, the row shows a 'Disabled' chip and 'New donation checkouts on this gateway are stopped. Switch it on to accept them again.'. The web form and Android both show 'paystack payments are currently switched off' (API 400). Checkouts started before the toggle still settle by webhook, and Paystack can be switched back on from the console. Known open issue I047: the wallet switch does not stop Android wallet donations or API provider=wallet, and no switch governs top-ups, subscriptions, tips or payouts. That fail-open policy is pending an owner decision.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (assertRailEnabled)`, `apps/web/src/lib/campaignDetailPolicy.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`

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

**Before:** A donation coupon with a per-user limit of 1; Donor A with a low wallet balance; staging DB access to backdate one intent; admin token.

**Steps:**

1. Android: make a wallet donation with the code for more than the balance, so it fails. Retry with the code on a funded amount.
2. Web: start a Paystack donation with the code and abandon the checkout. Press Donate again with the same details, then try the code on a different amount.
3. Backdate the abandoned intent's createdAt by more than 24 hours and call POST /api/v1/admin/payments/<id>/reconcile (or wait for the sweep). Try the code again.
4. Deliver charge.failed for another coupon intent, then reuse the code.

**Expect:** Insufficient balance and charge.failed release the seat, so the code works again. Pressing Donate again with the same details reopens the same checkout and holds no second seat. While the abandoned checkout is under 24 hours old, the seat stays held and a new donation shows 'You have already used this code the maximum number of times' (expected, since it could still be paid). Once it is over 24 hours old and Paystack reports abandoned or unknown, reconcile returns {outcome:'expired'} and releases the seat, so the code works again. If that expired checkout is paid later, it is still credited at the quoted waiver and the seat is not re-consumed (owner decision noted in the fix).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/donationCouponSeats.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts (expire)`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (replayHostedIntent)`

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

## DONATE-048 · P1 · Anonymous-by-default setting is applied to donation forms; receipt toggle removed

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** A signed-in donor; the account name is prefilled on the Android donate form.

**Steps:**

1. Web Settings: turn on 'Make my donations anonymous by default'. Open /c/<slug>/donate and the wallet dialog on /campaigns/<id>.
2. Android Settings: turn on 'Anonymous Donations' and open a campaign's donate screen.
3. Donate once leaving the default, and once after unticking anonymity for that donation. Check the public donation list and leaderboard.
4. Turn the setting off and reopen the forms.
5. Look for a 'Donation Receipts' toggle in Android Settings.

**Expect:** With the setting on: web 'Give anonymously (hide my name publicly)' is pre-ticked, the wallet dialog starts anonymous, and Android 'Donate anonymously' is pre-checked with the prefilled account name cleared from 'Name (optional)'. The default donation shows 'Anonymous' publicly. Unticking applies to that donation only (the name goes public subject to consent and review) and does not change the setting. With the setting off, the forms start unticked. Android Settings no longer shows a 'Donation Receipts' toggle. Known open issue I051: there is still no automatic donor receipt, because activity alerts default off.

**Needs:** none

**Source:** `apps/web/src/hooks/useAnonymousDonationDefault.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/mobile/src/lib/donationDefaults.ts`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/app/settings.tsx`

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

## DONATE-050 · P1 · Invalid or stale live-session attribution is dropped and never blocks the gift

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Live session X1 belonging to campaign X; campaign Y; a session S on X that you can end; Paystack test keys.

**Steps:**

1. Open /c/<Y-slug>/donate?liveSessionId=<X1> and donate GH₵10.
2. Via the API, POST /donation-intents with liveSessionId 'nonexistent', and again with a malformed value.
3. End session S. Within 30 minutes donate via /c/<X-slug>/donate?liveSessionId=<S>; after more than 30 minutes, do it again.
4. Open an ended session's /live page and check the 'Support this campaign' link.
5. For each donation, read liveSessionId from GET /api/v1/donation-intents/<id>/public and check the sessions' stats and overlay.

**Expect:** No donation is refused because of attribution: every request returns 201 and goes to checkout. Another campaign's session, an unknown or malformed id, or a session that ended more than 30 minutes ago is dropped, so the intent has no liveSessionId and those sessions' amount raised and checkout starts do not change. A session that ended within 30 minutes is still credited. An ended session's 'Support this campaign' link goes to /c/<campaignId>/donate with no liveSessionId.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (resolveLiveAttribution, LIVE_ATTRIBUTION_GRACE_MS)`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/web/src/pages/WatchLivePage.tsx`

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

## DONATE-057 · P1 · Refunded, partially refunded, disputed and refund-requested states in My donations

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Card donations that are fully refunded, partially refunded, refund in progress (REFUND_PENDING) and disputed, created through admin refunds and a Paystack test dispute or staging data; one completed donation with an open refund request.

**Steps:**

1. Open /donations on web and My donations on Android.
2. Use the 'Refunded' and 'Partially refunded' filters. Read the totals and each row's actions.
3. Via the API, POST /api/v1/refunds {donationId, reason} for the refunded donation and for the refund-pending or disputed one.

**Expect:** Web chips read 'Refunded', 'Partially refunded', 'Refund in progress' and 'Disputed'. 'Total Donated' and 'Average Donation' exclude fully refunded gifts; a partially refunded gift still counts at its full amount, so confirm that is acceptable. No non-completed gift offers 'Request Refund', and the gift with an open request shows 'Refund requested'. Android shows the same statuses with no refund action. API: the refunded donation returns 409 'This donation has already been refunded', and the refund-pending, partially refunded or disputed ones return 409 'This donation already has a refund or dispute in progress'. Donations settled before the ledger read as Completed.

**Needs:** Paystack test keys (refund)

**Source:** `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts (myDonationStatus)`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationPaymentStateRead.ts`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/mobile/app/my-donations.tsx`, `apps/mobile/src/lib/donationRefunds.ts`

## DONATE-058 · P1 · Mobile My donations and iOS Safari donation linkage

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** A signed-in donor in the iOS and Android apps; Safari not signed in to app.ujimora.com.

**Steps:**

1. Android: donate, then open Profile > My donations. Pull to refresh and use the filters.
2. iOS: read the 'Support this campaign' screen, then donate through 'Continue in browser' while Safari is signed out. Open My donations in the app.
3. Repeat on iOS after signing in on Safari first.

**Expect:** The Android donation is listed, with its amount formatted in the recorded currency to 2 decimals (for example GH₵30.00). The iOS screen tells donors: 'To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.'. A donation made from signed-out Safari is a guest donation and does NOT appear in the app. After signing in on Safari first, it appears.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/my-donations.tsx`, `apps/mobile/src/lib/money.ts`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`

## DONATE-059 · P1 · Donation confirmation notifications and emails (activity alerts)

*Surfaces:* android, api, email, web  ·  *Type:* compliance

**Before:** RESEND_API_KEY and FROM_EMAIL set; one donor with a verified email and one without; Paystack merchant receipt setting noted.

**Steps:**

1. As a new donor, donate and check the inbox and in-app notifications (defaults).
2. Web Settings > activity alerts: enable 'Donations you make' in-app and email. Donate again with a GH₵2 tip and wait up to about 60 s.
3. As the unverified user, try to enable email.
4. As a guest, donate with an email address. Open /donate/callback with no reference.

**Expect:** Defaults: no Ujimora notification, because every category defaults off. After opt-in: an in-app notification and an email 'Your donation is confirmed' reading 'Your donation of GHS X.XX to “<title>” is confirmed. Total charged: GHS Y.YY, including a GHS 2.00 optional platform tip. This payment confirmation is not a charitable tax certificate.' Exactly one per donation. The unverified user gets 409 'Verify your email address before enabling activity emails.'. The guest gets only Paystack's receipt, if the merchant has it enabled. The callback page no longer promises an emailed receipt. Known open issue I051: there is no automatic donor receipt or confirmation by default and guests never get one; the compliance decision (C14) is pending.

**Needs:** Resend (email provider); Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts (donorCharge)`, `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`, `packages/types/src/activity-alerts.ts`, `apps/web/src/pages/DonateCallbackPage.tsx`

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
2. Follow 'Continue in browser' and compare with /c/<slug>/donate.

**Expect:** iOS says: 'Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.' and 'Returning to the app does not confirm payment. Check the payment status on the website before trying again.'. It makes no fee-review or wallet claims. The linked page offers an amount, an optional tip and card or mobile money through Paystack (plus crypto only when enabled), which matches the copy.

**Needs:** none

**Source:** `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/web/src/pages/DonatePage.tsx`

## DONATE-069 · P1 · Crypto donation happy path and money accuracy (staging)

*Surfaces:* admin, android, api, web  ·  *Type:* functional

**Before:** Staging (NODE_ENV not production) with CRYPTO_PAYMENTS_ENABLED=true and CRYPTO_PRIMARY_PROVIDER=mock (or the Bitnob sandbox); mock webhook secret known.

**Steps:**

1. Web: on /c/<slug>/donate choose 'Crypto', amount 100 and an email. Pick USDT and a network, press 'Review quote', and check the rate, provider fee, network fee and the 'Counts toward the campaign' line. Press 'Get payment address'.
2. Verify the address, QR and copy buttons, the 'Send only USDT on <network>' warning and the countdown.
3. Simulate deposit.detected, then deposit.confirmed (mock: POST /api/v1/webhooks/crypto/mock with x-mock-signature = HMAC-SHA256(body) and matching cryptoAmount and confirmations).
4. Check the panel, campaign raised and admin payments.

**Expect:** The quote card shows 'Counts toward the campaign' GH₵100.00 with the note 'Ujimora’s platform fee (and any provider or network fees shown) is deducted before the organizer is paid.' It does not claim the campaign receives the gross amount. Before an email is entered, the prompt reads 'Enter your email above so we can contact you about this payment.' The terms and 18+ notice sits under the panel. The panel moves to 'Your contribution is confirmed' with 'GH₵100.00 has been added to the campaign total. Thank you for making a difference.'. Campaign raised goes up by 100.00 GHS at the locked rate. Ledger net = 100 minus the platform fee (plan %) minus provider and network fees. Payment method CRYPTO appears in admin Donations.

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

**Before:** Admin; a staff user without the admin role but with DONATIONS permission; a mix of named, anonymous and guest donations (plus one non-GHS or refunded row if available).

**Steps:**

1. Open admin /donations. Filter Named and Anonymous, search by donor and campaign, and export.
2. Read the header totals text.
3. Log in as the non-admin staff user and open /donations. Call GET /api/v1/admin/donations?pageSize=101.

**Expect:** The page lists real donations (not fixtures) with campaign title, supporter ('Anonymous donor', the name, or 'Former or guest supporter'), amount formatted in the row's own currency, method and date. Export columns match, and anonymous rows have no donorId. The header reads '<n> donations · GH₵<total> gross (refunds not deducted)', with each currency totalled separately and joined by ' · ' when currencies are mixed. The non-admin API call returns 403 and the page shows an error state. pageSize 101 returns 400.

**Needs:** none

**Source:** `apps/admin/src/pages/DonationsPage.tsx`, `apps/admin/src/lib/money.ts`, `apps/admin/src/hooks/useApiData.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminDonationRoutes.ts`

## DONATE-075 · P1 · Admin payment trace and reconcile API

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin JWT; non-admin JWT; SUCCEEDED, PENDING (paid and abandoned), FAILED and EXPIRED intents.

**Steps:**

1. GET /api/v1/admin/payments?status=PENDING&provider=paystack; ?providerRef=<ref>; ?campaignId=<id>.
2. GET /api/v1/admin/payments/<id> (timeline).
3. POST /api/v1/admin/payments/<id>/reconcile for each state, including a random 24-hex id.
4. POST /api/v1/admin/reconciliation with {limit: 5000}.
5. Repeat with the non-admin token.

**Expect:** Search returns normalized rows with the fee split in minor units and donorEmail. The timeline lists attempts without raw provider payloads. Reconcile returns: SUCCEEDED → 'skipped'; PENDING and paid → 'repaired'; PENDING abandoned under 24 hours → 'pending'; PENDING abandoned over 24 hours → 'expired' (status EXPIRED); FAILED or EXPIRED but actually paid → 'repaired'; unknown id → 404 'Contribution not found'. The sweep scans at most 500. Non-admin gets 403. Known open issue I036: the console now has a Payments page (/payments) for search, timeline and refund (see DONATE-N013), but still no button to re-verify one payment or run the sweep. Ops needs these API calls and a runbook.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/admin/src/pages/PaymentsPage.tsx`

## DONATE-076 · P1 · Currency and rail flags reject unsupported contributions; Help copy matches

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** PAYMENTS_MULTI_CURRENCY_ENABLED=false, PAYMENTS_INTERNATIONAL_CARDS_ENABLED=false and PAYMENTS_FLUTTERWAVE_ENABLED=false (as in render.yaml).

**Steps:**

1. POST /donation-intents with currency 'USD'; with currency 'ghs' (lowercase); with provider 'flutterwave'; with paymentMethod 'card' and country 'US'.
2. From web, pay with a foreign (non-Ghana) Paystack test card in GHS.
3. Read the marketing Help answer to 'Is Ujimora available in my country?'.

**Expect:** USD returns 400 'Contributions in USD are not enabled'. 'ghs' is accepted as GHS. flutterwave returns 400 'Flutterwave payments are not enabled'. card + US returns 400 'International card contributions are not enabled'. The web form sends no paymentMethod or country, so whether a foreign card works depends on the Paystack account; record the result. The Help page reads 'Ujimora is built for Ghana. … Donations are made in Ghanaian cedis (GHS) through Paystack, by mobile money or card; some cards issued outside Ghana may not be accepted.' and no longer claims anyone worldwide can donate.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/marketing/src/pages/HelpPage.tsx`, `render.yaml`

## DONATE-077 · P1 · Split-proceeds accrual on settled donations

*Surfaces:* api, web  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true (as in render.yaml); a campaign with an active 60/40 split and all beneficiary consents accepted.

**Steps:**

1. Check that /c/<slug>/donate shows the split disclosure.
2. Donate GH₵100 by test card and GH₵33.33 by wallet.
3. Inspect per-beneficiary balances and accruals and the campaign balance.

**Expect:** Before paying, the donor sees 'This campaign's proceeds are shared: <A> 60%, <B> 40%.'. Per-beneficiary accruals sum exactly to each donation's beneficiaryNet, with no pesewa lost or created, and the campaign pending balance equals the sum. If a consent is missing, settlement rolls back and the donation stays PENDING for retry, with no partial credit. Known open issue I013: SPLIT_PROCEEDS_ENABLED is "true" in production without the §6 legal sign-off the code requires. Confirm the launch posture.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/SplitAccrualService.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/web/src/components/campaigns/SplitDisclosure.tsx`, `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`, `render.yaml`

## DONATE-N002 · P1 · Repeating an identical, already-paid donation in the same tab shows the earlier confirmation

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; ACTIVE campaign.

**Steps:**

1. Complete a GH₵25 test-card donation on /c/<slug>/donate with email E and wait for the confirmation.
2. In the same tab, open /c/<slug>/donate again, enter GH₵25 and E with the same other choices, and press Donate.
3. Change the amount to GH₵26 and press Donate.
4. In a new browser tab, donate GH₵25 with E.

**Expect:** Step 2 does not open Paystack. It navigates to /donate/callback?reference=<first reference> and shows 'Thank you for showing up.' and 'Your GH₵25.00 donation is confirmed' for the first gift, with no new intent or charge (admin shows one GH₵25 intent). Step 3 opens a fresh checkout. Step 4 opens a new GH₵25 checkout, because a new tab has its own sessionStorage. Ask product to confirm that a donor who wants to repeat an identical gift in the same tab must change a detail or use a new tab.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx (SUCCEEDED replay branch)`, `apps/web/src/lib/checkoutAttempt.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (replayHostedIntent)`

## DONATE-N003 · P1 · Shared device: the donation callback never shows a previous donor's gift

*Surfaces:* web  ·  *Type:* security/permission

**Before:** Paystack test keys; browser devtools.

**Steps:**

1. In devtools > Application > Local Storage for the web origin, create key 'uf_pending_donations' with a JSON value containing a '__last' entry (simulating an older build).
2. Open /donate/callback with no query string.
3. Start a donation and inspect sessionStorage 'uf_pending_donations' while on Paystack. Complete the payment and inspect it again after the confirmation.
4. In the same tab, open /donate/callback with no query again. Then open /donate/callback?reference=__last.

**Expect:** A callback without a real reference always shows 'We couldn't find a payment reference to confirm. If money left your account, don't pay again. Keep any receipt from Paystack or your bank or mobile money provider, and email support@ujimora.com with the reference so we can check it.' and never shows another gift's amount or campaign. The legacy localStorage 'uf_pending_donations' key is removed on load. The handoff lives only in sessionStorage, keyed by reference, and is removed once the payment reaches succeeded, failed or expired.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/donationHandoff.ts`, `apps/web/src/pages/DonateCallbackPage.tsx`

## DONATE-N004 · P1 · Decimal comma and 2-decimal rule on web and Android money fields

*Surfaces:* android, api, web  ·  *Type:* negative/edge

**Before:** ACTIVE Community-plan campaign; Android build with a comma-decimal keypad locale; Paystack test keys; donor with a wallet balance.

**Steps:**

1. Web /c/<slug>/donate: Amount '100,50' and tip '2,5'. Read the button, then pay.
2. Web: try Amount '1,000', '1,000.50' and '10.125'.
3. Android donate: Amount '100,50' and tip '0,5', then Amount '1.005'.
4. API: POST /donation-intents with tip 0.125, and POST /campaigns/<id>/donate {amount:5.555, currency:'GHS', paymentMethod:'wallet'}.

**Expect:** Web: '100,50' is read as 100.50 and '2,5' as 2.50. The button reads 'Donate GH₵103.00', Paystack charges 103.00 and campaign raised goes up by 100.50. '1,000', '1,000.50' and '10.125' show 'Enter an amount greater than zero, with at most 2 decimal places' and keep the button disabled, because ambiguous grouping is rejected rather than guessed. Android: the button reads 'Donate 101.00 GHS'; '1.005' keeps Donate disabled. API: tip 0.125 and the legacy amount 5.555 return 400 'Validation failed' and nothing is debited.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/moneyInput.ts`, `apps/mobile/src/lib/moneyInput.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts (donateSchema)`

## DONATE-N005 · P1 · Terms and 18+ notice next to every donate button

*Surfaces:* android, web  ·  *Type:* compliance

**Before:** ACTIVE campaign; staging with crypto enabled for the crypto panel check; Android build.

**Steps:**

1. As a guest, open /c/<slug>/donate and read the text above the Donate button. Open each link.
2. Switch to 'Crypto' (staging) and look under the panel.
3. Android donate screen: read the text above the Donate button and tap each link.
4. Make a guest donation that is anonymous and has no message.

**Expect:** Web shows 'Donations are made under our Terms of Use, Contributor Terms and Privacy Notice. You must be 18 or older to donate.', with links opening /terms, /contributor-terms and /privacy in a new tab. The crypto panel shows the same notice. Android shows the same text, and its links open the in-app Terms of Use, Contributor Terms and Privacy screens. The notice is informational only: the anonymous, message-free guest donation proceeds with no checkbox and no consent record. Known open issue I086: guests without a public name or message are still not asked to actively accept the terms or confirm 18+. Clickwrap vs checkbox and server enforcement are pending an owner/legal decision.

**Needs:** none

**Source:** `apps/web/src/components/donate/DonationTermsNotice.tsx`, `apps/web/src/components/donate/CryptoDonatePanel.tsx`, `apps/mobile/app/donate/[id].tsx`, `packages/types/src/legal.ts`

## DONATE-N006 · P1 · Paystack checkout offers only card and mobile money

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Paystack test keys with extra channels (for example bank transfer or USSD) enabled on the test merchant dashboard; the ability to change the PAYSTACK_CHANNELS env on staging.

**Steps:**

1. Web: start a GH₵20 donation and list the payment options on the Paystack checkout.
2. Android: do the same with 'Card or mobile money · secure checkout'.
3. API: POST /donation-intents with paymentMethod 'card' and open authorization_url. Repeat with paymentMethod 'mobile_money'.
4. Set PAYSTACK_CHANNELS=card,mobile_money,bank_transfer, restart the API and repeat step 1.

**Expect:** By default the checkout offers only Card and Mobile Money, matching the donate-page copy; bank transfer, USSD, QR and other channels are hidden. paymentMethod 'card' shows only Card, and 'mobile_money' shows only Mobile Money. After widening PAYSTACK_CHANNELS, the extra channel appears if it is enabled on the dashboard. Settlement is unchanged. Ops should confirm the production dashboard channels before launch.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts (channelsFor)`, `apps/api/src/infrastructure/config/index.ts (paystack.channels)`, `apps/api/.env.example`

## DONATE-N007 · P1 · API applies the donor's anonymous-by-default setting when no choice is sent

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Donor A with 'Make my donations anonymous by default' on; Donor B with it off; both with GHS wallet balances; current LEGAL_ACCEPTANCE_VERSION; crypto enabled on staging for the last step.

**Steps:**

1. As A, POST /api/v1/donation-intents {provider:'wallet', amount:5, donorName:'Ama A'} with no isAnonymous field.
2. As A, send the same with isAnonymous:false and legalAcceptance {version:<current>, acceptedTerms:true, ageConfirmed:true}.
3. As A, POST /api/v1/campaigns/<id>/donate {amount:5, currency:'GHS', paymentMethod:'wallet'} with no isAnonymous.
4. As B, POST /donation-intents with donorName and legalAcceptance and no isAnonymous.
5. As A (staging with crypto on), create a crypto deposit with no isAnonymous.
6. Check each intent's isAnonymous (GET /donation-intents/<id>/public) and the public campaign donation list.

**Expect:** Steps 1, 3 and 5 are recorded with isAnonymous true and show 'Anonymous' publicly; no content consent is needed. Step 2 is public, because an explicit choice always wins (the name is still subject to content review). Step 4 is public, because B's setting is off. Guests are unaffected.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts (withAnonymityDefault)`, `apps/api/src/application/use-cases/CreateCryptoDepositUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts (isAnonymous optional)`

## DONATE-N009 · P1 · A redelivered charge.success for a refunded donation is acknowledged without a second credit

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A card donation fully refunded through the admin refund flow (Paystack test keys); its original signed charge.success body and signature captured, or a way to sign with PAYSTACK_SECRET_KEY.

**Steps:**

1. Re-POST the original signed charge.success to /api/v1/webhooks/paystack 3 times.
2. Check the intent status, donation and journal counts, and campaign raised.
3. Send a signed charge.failed for the same reference.

**Expect:** Each charge.success returns 200 {status:'ok'}. The intent stays REFUNDED, with no new donation or journal and no change to raised, and the log reads 'paystack charge.success redelivered for an already-settled intent — acknowledged'. There is no 409 retry loop. The charge.failed must also leave the intent REFUNDED. If it flips to FAILED, log a defect: handleChargeFailed only guards SUCCEEDED, FAILED and EXPIRED.

**Needs:** Paystack test keys (refund)

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts (POST_SETTLEMENT_STATES, handleChargeFailed)`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts (updateStatus)`

## DONATE-N011 · P1 · Wallet-funded gifts offer no self-service refund

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Donor with a wallet donation and a card donation, both under 30 days old.

**Steps:**

1. Web /donations: read the action column for both rows.
2. Android My donations: open both rows.
3. API: POST /api/v1/refunds {donationId:<walletDonationId>, reason:'Changed my mind'}.
4. Request a refund for the card gift on web, then POST the same card donation again via the API.

**Expect:** The card gift shows 'Request Refund'. The wallet gift shows 'Wallet gift: contact support@ujimora.com for a refund' and no button, and Android offers no refund action for it. The API returns 422 "Wallet donations can't be refunded automatically. Contact support@ujimora.com with the donation ID." and creates no refund. After the card request, the row shows 'Refund requested' with no button, and the second POST returns 409 'Refund already requested for this donation'.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/web/src/lib/donationRefunds.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/mobile/src/lib/donationRefunds.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/refundRoutes.ts`

## DONATE-N013 · P1 · Admin Payments page: search, timeline and deep links

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Admin with DONATIONS permission; a staff user with read-only DONATIONS; PENDING, FAILED, EXPIRED and SUCCEEDED intents.

**Steps:**

1. Open admin sidebar > Payments (/payments). Search by Provider reference for each intent. Search by 'Donor email (exact)', and by Campaign ID + Status + Provider.
2. Press 'View timeline' on a result.
3. Open /payments?ref=<providerRef> and /payments?id=<intentId> directly.
4. Search for a reference that does not exist.
5. Sign in as the read-only staff user and open a SUCCEEDED payment.

**Expect:** Results include pending, failed and expired payments, with the amount in its own currency and a status chip. The timeline shows the provider and method chips, the campaign link, the donor email (or 'Donor email not recorded') and the attempts ('No provider attempts were recorded.' when there are none), without raw provider payloads. Deep links pre-fill the search or open the timeline. A search with no match shows 'No payments match.' and 'Check the reference or email is exact. Only the 50 most recent matches are shown.'. 'Refund payment' appears only for settled or partly refunded payments and is disabled without DONATIONS update permission; other payments say 'Only a settled or partly refunded payment can be refunded.'. Known open issue I036: there is no re-verify or reconciliation-sweep button; use the API (DONATE-075).

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/PaymentsPage.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`

## DONATE-N014 · P1 · Split-proceeds disclosure is shown before donating

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** A campaign with an active split (for example Ama 60% / Kofi 40%); a campaign without a split; a PENDING_REVIEW campaign with a split; owner and admin tokens.

**Steps:**

1. Open /c/<slug>, /c/<slug>/donate and /campaigns/<id> for the split campaign, then the Android donate screen.
2. Open the same pages for the campaign without a split.
3. GET /api/v1/campaigns/<pendingId>/split as guest, as a stranger, as the owner and as an admin.

**Expect:** Each page for the split campaign shows the info notice 'This campaign's proceeds are shared: Ama 60%, Kofi 40%.' above the donate controls, and Android shows the same text on its donate screen. Campaigns without a split show nothing. The split endpoint for the non-public campaign returns 404 for guests and strangers and 200 for the owner and admin. Known open issue I013: SPLIT_PROCEEDS_ENABLED is on in render.yaml without the documented §6 sign-off.

**Needs:** none

**Source:** `apps/web/src/components/campaigns/SplitDisclosure.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/mobile/src/lib/splitDisclosure.ts`, `apps/mobile/app/donate/[id].tsx`

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

**Before:** A campaign with 25+ donations; a PENDING_REVIEW campaign with donations; owner and admin tokens.

**Steps:**

1. GET /api/v1/campaigns/<id>/donations?page=2&pageSize=10, then page=3.
2. GET the non-public campaign's list as guest, as owner and as admin.
3. GET with pageSize=100000, pageSize=100, page=0, page=-1 and page=abc.
4. GET with no query.

**Expect:** You get the correct newest-first slice with total and totalPages, and pages do not overlap. Non-public campaigns return 404 for guests and others, and 200 for owner and admin. pageSize=100000 returns 400 'Page size must be a whole number between 1 and 100.' and pageSize=100 returns 200. page=0, -1 or abc returns 400 'Page must be a whole number of at least 1.'. With no query, the defaults are page 1 and pageSize 20. Paging happens in the database, so large campaigns respond quickly.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/pagination.ts`, `apps/api/src/application/use-cases/ListCampaignDonationsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/DonationController.ts`

## DONATE-055 · P2 · Donor count with guest donations

*Surfaces:* api, web  ·  *Type:* functional

**Before:** A new campaign; Paystack test keys.

**Steps:**

1. Make 3 guest donations with 3 different emails and 1 signed-in donation.
2. Check '… donors · Distinct supporters' on /campaigns/<id>.
3. Make a second donation from the same signed-in donor, then a second guest donation reusing the first guest's email.

**Expect:** After the first 4 donations the page shows 4 distinct supporters. Another donation from the same account still shows 4, because accounts are counted once. A repeat guest email shows 5: each guest donation counts as its own supporter, and de-duplicating repeat guests is an owner decision.

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

**Before:** Crypto enabled on staging; signed-in Donor A; second account Donor B.

**Steps:**

1. Web: throttle the network, press 'Get payment address', go offline and back online, and press again for the same quote. Compare Idempotency-Key headers.
2. Get a new quote and press 'Get payment address'.
3. Android: accept a quote twice quickly.
4. Confirm a crypto donation for Donor A and open Donor A's My donations.
5. As Donor B, POST /api/v1/campaigns/<id>/donations/crypto with Donor A's Idempotency-Key and quote. Also make a guest crypto deposit.

**Expect:** Retries for the same quote send the same Idempotency-Key and return the same deposit and address (one deposit). A new quote gets a new key and a new deposit. Android also opens one deposit. Donor A's confirmed crypto donation appears in My donations (method Crypto) and follows their anonymity default. Donor B replaying the key gets 409 'Idempotency key belongs to another contribution'. Guest deposits stay unlinked.

**Needs:** Mock crypto provider or Bitnob sandbox

**Source:** `apps/web/src/components/donate/CryptoDonatePanel.tsx`, `apps/web/src/lib/crypto.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CryptoController.ts`, `apps/api/src/application/use-cases/CreateCryptoDepositUseCase.ts`

## DONATE-N012 · P2 · iOS handoff works for legacy campaigns without a slug

*Surfaces:* ios, web  ·  *Type:* cross-platform

**Before:** iOS TestFlight build; an ACTIVE campaign whose slug field is unset (legacy), with an active live session; a closed legacy campaign.

**Steps:**

1. Open the legacy campaign in the iOS app and tap Donate, then 'Continue in browser'. Note the Safari URL and complete a test donation.
2. From the live screen for that campaign, tap 'Support this campaign', then 'Continue in browser'.
3. Open the closed legacy campaign's donate screen.

**Expect:** Safari opens https://app.ujimora.com/c/<24-hex campaign id>/donate, plus ?amount or ?liveSessionId when present. The web page loads the campaign by id, and the donation settles (attributed to the session in step 2). The closed campaign shows 'This campaign is not accepting donations right now.' and no button.

**Needs:** Paystack test keys; TestFlight

**Source:** `apps/mobile/src/lib/fundraising.ts (campaignDonationHandle)`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/api/src/application/use-cases/GetCampaignBySlugUseCase.ts`
