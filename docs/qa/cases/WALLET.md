# Wallet, ledger & refunds (86 cases)

Balances, top-ups, history, ledger integrity, refunds and recovery, disputes and reconciliation.

[Back to the QA plan](../README.md)

## WALLET-002 · P0 · Wallet endpoints and screens require authentication

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Signed-out browser and app. An expired JWT is available.

**Steps:**

1. Signed out, open https://app.ujimora.com/wallet.
2. Send curl GET /api/v1/wallets, /api/v1/wallets/transactions, /api/v1/wallets/topups/config and POST /api/v1/wallets/topups with no Authorization header.
3. Repeat step 2 with an expired or tampered bearer token.
4. On iOS and Android, signed out, open Profile -> Wallet.
5. On web, let the session expire while /wallet is open, then reload.

**Expect:** Web shows the sign-in prompt and no wallet data. Every API call returns 401. The apps show the SignInRequired panel for 'wallet'. After expiry the web shows 'Your session has expired' and returns to /wallet after sign-in.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/walletRoutes.ts`, `apps/web/src/components/auth/RequireAuth.tsx`, `apps/mobile/app/(tabs)/wallet.tsx`

## WALLET-003 · P0 · Top-up config reports the correct test/live mode and banner

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** Staging uses sk_test_ Paystack keys. Production uses sk_live_ keys.

**Steps:**

1. On staging, call GET /api/v1/wallets/topups/config as a signed-in user.
2. On staging, open /wallet and look above the 'Top-up amount (GHS)' field.
3. On staging, open Android Profile -> Wallet -> 'Fund your wallet'.
4. Repeat steps 1-3 against production.
5. Check that no response contains key material.

**Expect:** Staging returns {enabled:true, mode:'test'}. The web shows 'Test payments only. No real money moves in this mode.' Android shows 'Test mode: this checkout does not collect live money.' Production returns mode 'live' and shows no test banner on either surface. No response contains secrets.

**Needs:** Paystack test and live keys

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/web/src/pages/WalletPage.tsx`, `apps/mobile/src/components/WalletFunding.tsx`

## WALLET-004 · P0 · Web top-up happy path: exact credit, fee absorbed, balanced journal

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Donor A with a GHS wallet. Record the starting balance B0. Paystack test keys are set and the Paystack webhook URL points to staging /api/v1/webhooks/paystack. Mongo read access is available.

**Steps:**

1. Open /wallet, enter 50.00 in 'Top-up amount (GHS)' and click 'Fund wallet'.
2. Check that the button shows 'Opening checkout…' and the browser goes to checkout.paystack.com showing GHS 50.00.
3. Pay with a Paystack success test card or test MoMo number.
4. Paystack redirects to /wallet?trxref=wtop-...&reference=wtop-...; watch the alerts.
5. Check the balance card and the new history row.
6. In Mongo, inspect wallettopups {reference}, wallettransactions {reference}, journalentries {externalRef: reference} and the journallines for that entry.
7. Compare feeMinor with the fee shown on the Paystack dashboard transaction.

**Expect:** The alert moves from 'Payment is awaiting confirmation…' to 'Your wallet has been funded.' Balance equals B0 + 50.00 exactly. The history shows Deposit, GHS 50.00, Completed, wtop-.... WalletTopUp has status completed, amountMinor 5000, feeMinor equal to the Paystack fee in pesewas, and settledAt set. There is exactly one DEPOSIT transaction (amount 50, metadata.provider paystack). There is one journal entry 'Verified Paystack wallet top-up' with lines payment_clearing debit (50 - fee), processor_fee debit (fee) and wallet credit 50.00 (owner walletId); debits equal credits. The donor pays GHS 50.00 in total.

**Needs:** Paystack test keys and webhook; MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/web/src/pages/WalletPage.tsx`, `docs/payments/wallet-funding-and-crypto-providers.md`

## WALLET-006 · P0 · Top-up initialization is idempotent and key-bound

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Donors A and B. API client (Postman or curl) with both JWTs.

**Steps:**

1. On web, enter 20 and double-click 'Fund wallet' quickly. Count new wallettopups rows for A.
2. As A, POST /api/v1/wallets/topups with header 'Idempotency-Key: qa-topup-key-000001' and body {walletId:A, amount:20}. Send it twice.
3. Send the same key with amount 25.
4. Send without the header, with key 'short', and with key 'bad key!!!!!!!!!!!!'.
5. As B, send key qa-topup-key-000001 with B's walletId.
6. Check the Paystack dashboard transaction count for these references.

**Expect:** Step 1 creates one top-up and one Paystack transaction. Step 2 returns the same reference and authorizationUrl both times, status pending. Step 3 returns 409 'This request key belongs to a different top-up'. Step 4 returns 400 'A valid Idempotency-Key is required'. Step 5 creates a separate top-up for B, because keys are scoped per user. Each key maps to one Paystack transaction and nobody is charged twice.

**Needs:** Paystack test keys; MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/WalletController.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/infrastructure/database/models/WalletTopUpModel.ts`

## WALLET-007 · P0 · Top-up credited by webhook when the donor never returns

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Webhook configured. Donor A balance recorded.

**Steps:**

1. Start a 30.00 top-up on web and complete payment on the Paystack page.
2. Close the tab before the redirect to /wallet finishes.
3. Within 1 minute, confirm in the API logs that POST /api/v1/webhooks/paystack returned 200.
4. Open /wallet in a new tab.
5. Visit /wallet?reference=<that reference> manually.

**Expect:** The balance rises by 30.00 once and a history row exists. WalletTopUp is completed. The manual status check reports 'Your wallet has been funded.' and changes nothing else (still one credit, one transaction, one journal).

**Needs:** Paystack test keys and webhook

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## WALLET-008 · P0 · Webhook replays and parallel status polls credit exactly once

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** A completed 15.00 top-up and its reference. A script that computes x-paystack-signature = HMAC-SHA512(raw body, PAYSTACK_SECRET_KEY).

**Steps:**

1. Build or copy the charge.success payload for the reference (Paystack dashboard -> transaction -> webhook logs).
2. POST the identical signed body to /api/v1/webhooks/paystack 3 times in parallel.
3. At the same time, call GET /api/v1/wallets/topups/<reference> 3 times as the owner.
4. Query the wallet balance, wallettransactions {reference} and journalentries {externalRef: reference}.

**Expect:** All calls return 200. The balance still reflects a single +15.00. There is exactly one WalletTransaction and one JournalEntry for the reference.

**Needs:** Paystack test secret; MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.ts`

## WALLET-009 · P0 · Forged or unverified webhooks cannot credit a wallet

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Start a 40.00 top-up but do not pay. Note its wtop- reference.

**Steps:**

1. POST {event:'charge.success', data:{reference, amount:4000, currency:'GHS'}} to /api/v1/webhooks/paystack with no x-paystack-signature header.
2. Repeat with a wrong signature.
3. Repeat with a correct signature for the same unpaid reference.
4. Check the wallet balance and the top-up status.

**Expect:** Steps 1-2 return 401 'Invalid webhook signature'. Step 3 returns 200, but the server re-verifies with Paystack, sees the charge is unpaid and credits nothing. The amount in the webhook body is never trusted.

**Needs:** Paystack test secret

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## WALLET-011 · P0 · Status polling while checkout is open does not report failure early (Android)

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android internal-track build, signed in. Paystack test keys.

**Steps:**

1. Open Profile -> Wallet -> 'Fund your wallet', enter 25 and tap 'Fund wallet'.
2. Leave the Paystack Custom Tab open without paying for about 20 s. Switch back to the app briefly so PaymentStatus polls GET /api/v1/wallets/topups/<ref>.
3. Note the card title, the 'Status:' line and the wallettopups status in the DB.
4. Call GET /api/v1/wallets/topups/<ref> directly as the owner and note the status.
5. Return to the tab and complete payment.
6. Watch the app and the wallet balance.

**Expect:** Before payment the card shows 'Awaiting payment confirmation', 'Status: pending', 'Open secure checkout' and 'Check status', and never 'Payment was not completed' or 'Try again'. The top-up stays 'pending' in the DB and the API, although Paystack reports the open checkout as 'abandoned': WalletTopUpService.settle only fails an abandoned top-up once it is older than 24 hours. After payment the card shows 'Wallet funded' with 'Status: completed'. The wallet is credited 25.00 exactly once, with one DEPOSIT row and one journal.

**Needs:** Paystack test keys and webhook; Android device

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts`

## WALLET-012 · P0 · Reconciliation sweep repairs missed top-up webhooks, including a failed-then-paid top-up

*Surfaces:* admin, android, api  ·  *Type:* recovery/idempotency

**Before:** Staging with PAYMENTS_RECONCILIATION_ENABLED=true and either NODE_ENV=production or RECONCILIATION_SCHEDULER_ENABLED=true. Outside production the timer is off unless opted in. Access to the Paystack test dashboard to change the webhook URL. Mongo write access on staging to backdate test rows. Admin JWT.

**Steps:**

1. Point the Paystack test webhook URL at a dead endpoint.
2. Start a 12.00 top-up (API or Android) and pay. Force-quit the app immediately (or close the web tab before the redirect) so no status call happens.
3. Start a 7.00 top-up and never pay.
4. Start a 9.00 top-up and pay with the declining test card. Call GET /api/v1/wallets/topups/<ref> once so it is recorded as failed. Then, in the same Paystack checkout, retry with a success card and make no further status call.
5. Wait 11 minutes. Check the API logs and the wallettopups and wallets collections.
6. Set the 9.00 top-up's updatedAt more than 60 minutes back in Mongo (or wait an hour). Then, as admin, call POST /api/v1/admin/reconciliation/topups (or wait for the next 5-minute tick).
7. Set the 7.00 top-up's createdAt and updatedAt 25 hours back, then call POST /api/v1/admin/reconciliation/topups again.
8. Restore the webhook URL.

**Expect:** Step 5: the sweep completes the paid 12.00 top-up and credits it once. The unpaid 7.00 top-up is still 'pending', because an abandoned checkout is not failed until it is 24 hours old. No 'wallet top-up reconciliation failed' errors appear. Step 6: failed top-ups are re-checked hourly for 72 hours, so the failed 9.00 top-up is re-verified, becomes completed and is credited exactly once (one DEPOSIT row, one journal). The admin call returns {scanned, completed, failed} with completed of at least 1. Step 7: the 7.00 top-up becomes failed with no credit, and the summary shows failed of at least 1. Only paid top-ups change a balance.

**Needs:** Paystack test keys; ability to change the webhook URL; Mongo write access (staging)

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## WALLET-013 · P0 · Wallets, top-ups and history are isolated between accounts

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Donors A and B with wallet activity. Note A's walletId and a top-up reference.

**Steps:**

1. As B, GET /api/v1/wallets/<A walletId>.
2. As B, GET /api/v1/wallets/topups/<A reference>.
3. As B, POST /api/v1/wallets/topups {walletId:A walletId, amount:5} with a valid key.
4. As B, open https://app.ujimora.com/wallet?reference=<A reference>.
5. As B, GET /api/v1/wallets and GET /api/v1/wallets/transactions?limit=1000.
6. GET /api/v1/wallets/not-an-id.

**Expect:** Step 1: 404 'Wallet not found'. Step 2: 404 'Top-up not found'. Step 3: 404 'GHS wallet not found'. Step 4: an error alert with no status leak. Step 5: only B's wallets and rows, with at most 200 rows returned. Step 6: 400 'Invalid ID format'. A's data is unchanged.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/WalletController.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## WALLET-016 · P0 · Production live-mode controlled top-up (launch gate)

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Production has approved sk_live keys. QA account on production. A real MoMo wallet.

**Steps:**

1. GET /api/v1/wallets/topups/config and confirm mode 'live'; confirm /wallet shows no test banner.
2. In the Paystack live dashboard, confirm the webhook URL is https://api.ujimora.com/api/v1/webhooks/paystack.
3. Top up GHS 1.00 with real MoMo.
4. Confirm the redirect returns to https://app.ujimora.com/wallet and shows 'Your wallet has been funded.'
5. Compare the WalletTopUp feeMinor and the journal lines with the Paystack live dashboard amount and fee.

**Expect:** The wallet rises by exactly 1.00. The Paystack fee is recorded in processor_fee and matches the dashboard. The journal balances. One transaction.

**Needs:** Paystack live keys approved; production MongoDB read access

**Source:** `docs/payments/wallet-funding-and-crypto-providers.md`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `render.yaml`

## WALLET-017 · P0 · Android in-app top-up happy path

*Surfaces:* android, api  ·  *Type:* cross-platform

**Before:** Android internal-track build. Donor signed in. Paystack test keys.

**Steps:**

1. Open Profile -> Wallet and read the 'Fund your wallet' card.
2. Keep the default amount 100 and tap 'Fund wallet'.
3. In the Chrome Custom Tab, pay with a test MoMo number.
4. After the redirect to app.ujimora.com/wallet (the web sign-in prompt may appear, which is fine), close the tab.
5. Watch the PaymentStatus card: title, 'Reference: wtop-...' and 'Status:'.
6. Tap 'Make another payment' and review 'Recent Activity'.

**Expect:** The card moves from 'Awaiting payment confirmation' to 'Wallet funded' with status completed. The balance card and the My Wallets entry rise by 100.00. Recent Activity shows 'deposit +GH₵100.00 · completed'. No payment UI appears inside the app other than the Paystack hosted page.

**Needs:** Paystack test keys and webhook; Android device

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/app/(tabs)/wallet.tsx`

## WALLET-018 · P0 · Android recovery: double tap and app kill during checkout

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android device. Donor signed in.

**Steps:**

1. Enter 35 and double-tap 'Fund wallet'.
2. Pay in the Custom Tab, then swipe-kill the app before returning.
3. Relaunch and open Profile -> Wallet.
4. Tap 'Check status'.
5. In a separate run, start a top-up, do not pay, kill the app, relaunch, and tap 'Open secure checkout'.

**Expect:** Only one wallettopups record and one Paystack transaction for step 1. After relaunch, PaymentStatus is restored with the same reference and completes with a single credit. 'Open secure checkout' reopens the same Paystack page and creates no new top-up.

**Needs:** Paystack test keys; Android device

**Source:** `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/src/components/PaymentStatus.tsx`

## WALLET-020 · P0 · iOS wallet funding opens Safari with no in-app payment, and the balance refreshes on return

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iPhone with the TestFlight build. Donor signed in to the app. Paystack test keys on staging web.

**Steps:**

1. Open Profile -> Wallet.
2. Check the 'Fund your wallet' card. It should have the copy 'Wallet top-ups are made on the Ujimora website...' and a 'Continue in browser' button, with no amount field and no Paystack.
3. Tap 'Continue in browser'.
4. Confirm it opens Safari itself (not an in-app browser sheet) at https://app.ujimora.com/wallet.
5. Sign in on the web, top up 10.00, then switch back to the app with the Wallet tab still showing.
6. Without leaving the screen, check the balance and Recent Activity. Then pull down to refresh. Then switch to another tab and back.
7. With Safari restricted or the URL failing to open, tap the button again.

**Expect:** No payment is collected inside the iOS app (App Review 3.2.1(vi)/3.2.2). The web top-up credits 10.00. When the app returns to the foreground on the Wallet tab, it reloads without a force-quit or screen change. 'Balance' shows the new amount, and Recent Activity has a new deposit row +GH₵10.00 with status completed. If the webhook had not landed at that moment, a pull-to-refresh or a tab switch shows it. If opening fails, the app shows 'Could not open the Ujimora website. Please try again.'

**Needs:** iOS TestFlight build; Paystack test keys

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/src/hooks/useWallet.ts`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## WALLET-021 · P0 · iOS cannot spend the wallet, tip, or pay for plans with the wallet in-app

*Surfaces:* ios  ·  *Type:* compliance

**Before:** iPhone TestFlight build. Donor with a positive wallet balance.

**Steps:**

1. Open any campaign and tap Donate.
2. Check whether any in-app amount form or 'Ujimora wallet · existing balance' option appears.
3. Open a creator profile and look for a tip checkout.
4. Open Profile -> Subscription and check the payment options.

**Expect:** Donate hands off to the website in Safari (ExternalFundraisingScreen) with no wallet option. Creator tips are unavailable. Subscriptions are offered only through App Store in-app purchase; there is no wallet or Paystack option.

**Needs:** iOS build; App Store sandbox account for the subscription check

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/APP_REVIEW_NOTES.md`, `docs/compliance/READINESS.md`

## WALLET-023 · P0 · Web wallet donation: exact debit, platform fee, projections and journal

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Donor A wallet at least 150.00. Campaign C is active in GHS. Note its lockedPlatformFeePercent p (cashout breakdown 'Campaign plan rate: p%', or the campaign doc), raisedAmount R0, and campaignbalances pending P0.

**Steps:**

1. As Donor A, open campaign C -> 'How to donate' -> 'Donate with wallet'.
2. Enter amount 100.00 and 'Public donor name' 'QA Donor', add a message, tick the message agreement, and select the 'Ujimora Wallet' tile.
3. Click 'Confirm Donation'.
4. Check the snackbar and the refreshed progress bar.
5. Check /wallet and /donations.
6. In the DB, check donationintents, donations, wallettransactions, journalentries/journallines, campaigns, campaignbalances and outbox.

**Expect:** Snackbar 'Your wallet donation was completed.' Wallet falls by exactly 100.00. One WalletTransaction: type donation, 100.00, reference donation-intent:<intentId>, metadata.tip 0. Intent SUCCEEDED with provider wallet, providerFeeMinor 0, platformFeeMinor = round(100 × p%) in pesewas, netCampaignAmountMinor = 10000 − platformFeeMinor. Raised = R0 + 100.00 and pending = P0 + net. One balanced journal: campaign debit 100.00, beneficiary credit net, platform_fee credit fee. One outbox 'donation.succeeded'. My Donations shows Payment Method 'Wallet'. The public name appears only after content review.

**Needs:** MongoDB read access

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/FeePolicy.ts`, `apps/api/src/domain/entities/JournalEntry.ts`

## WALLET-024 · P0 · Insufficient balance, exact balance and zero balance

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Donor B has wallet balance exactly 10.00 (a fresh account topped up once).

**Steps:**

1. Donate 10.01 with the wallet on an active campaign.
2. Donate 10.00.
3. Donate 0.01.
4. After each step, check the balance, donationintents status, wallettransactions, donations and the campaign raised amount.

**Expect:** Step 1: dialog error 'Insufficient wallet balance'; intent FAILED; no debit, donation or journal; campaign unchanged. Step 2 succeeds and the balance is exactly 0.00. Step 3: 'Insufficient wallet balance'. The balance never goes negative.

**Needs:** Paystack test keys (to fund); MongoDB read access

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletRepository.ts`

## WALLET-026 · P0 · Retrying a web wallet donation must not double-debit

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Donor A balance 100.00. Chrome DevTools.

**Steps:**

1. Open 'Donate with wallet', enter 20.00 and click 'Confirm Donation'. In DevTools Network, check that POST /api/v1/campaigns/<id>/donate carries an Idempotency-Key header (a UUID).
2. Right-click that request -> 'Replay XHR' (or copy it as cURL and run it again unchanged).
3. In a second run, set throttling to Offline right after the request is sent. Restore the network, then click 'Confirm Donation' again with the same details. Compare the Idempotency-Key of both requests.
4. In a third run, enter more than the balance and submit to get a definite refusal. Then correct the amount and submit again. Compare the keys.
5. After each run, check the wallet balance, the donations count and wallettransactions.

**Expect:** Step 2: the replay returns 200 'Donation successful' but creates no second debit or donation. Step 3: the retry sends the same Idempotency-Key as the lost request. The wallet is debited 20.00 once, with one donation and one WalletTransaction (reference donation-intent:<id>). Step 4: the dialog shows 'Insufficient wallet balance'. The corrected submission uses a new key and succeeds once. Across all runs, each logical donation debits the wallet at most once.

**Needs:** None

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/lib/checkoutAttempt.ts`, `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`

## WALLET-027 · P0 · Android wallet donation with tip, and retry safety

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android device. Donor wallet at least 60.00. Active GHS campaign.

**Steps:**

1. Open the campaign -> Donate ('Support this campaign').
2. Enter Amount 50 and tip 5, choose Payment method 'Ujimora wallet · existing balance', accept the terms checkbox if a name or message is set, and double-tap the donate button.
3. Watch the PaymentStatus card ('Thank you for your support').
4. Kill the app and reopen the same campaign's donate screen.
5. Tap 'Make another payment'.
6. Check the DB.

**Expect:** Wallet falls by 55.00 once. One intent per idempotency key, and one WalletTransaction (amount 55.00, metadata.tip 5). Campaign raised rises by 50.00. The journal has campaign debit 50, beneficiary and platform credits, plus a tip debit 5.00 / platform_fee credit 5.00 pair. After relaunch the completed status is restored with no new debit. 'Make another payment' resets the form.

**Needs:** Android device; MongoDB read access

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/payments.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/domain/entities/JournalEntry.ts`

## WALLET-028 · P0 · Wallet intent API: key ownership, method binding and guests

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Donors A and B. Active campaign C.

**Steps:**

1. As A, POST /api/v1/donation-intents {campaignId:C, amount:5, provider:'wallet'} with Idempotency-Key K1.
2. As B, send the same body and key K1.
3. As A, send K1 with provider 'paystack' and a donorEmail.
4. With no token, send provider 'wallet' and a new key.
5. As A, repeat step 1 exactly.
6. Send amount 0, then amount -1, then tip -1.

**Expect:** Step 1: 201 SUCCEEDED. Step 2: 403 'Donation intent belongs to another account'. Step 3: 409 'Idempotency key belongs to a different payment method'. Step 4: 400 'Wallet donations require an authenticated account'. Step 5 returns the original intent with no new debit. Step 6 returns 400. A is debited exactly 5.00 in total and B is never debited.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/DonationIntentController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`

## WALLET-029 · P0 · Concurrent wallet donations cannot overdraw

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Donor balance 100.00. curl able to run requests in parallel.

**Steps:**

1. Send two POST /api/v1/donation-intents provider 'wallet' amount 70 requests with different keys at the same time (or click Confirm in two tabs at once).
2. Check both responses, the balance, donations, wallettransactions and the campaign raised amount.

**Expect:** One returns SUCCEEDED and the other returns 400 'Insufficient wallet balance' with its intent FAILED. The final balance is 30.00. There is one donation, one WalletTransaction, and the campaign rises by 70.00 only.

**Needs:** MongoDB read access

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletRepository.ts`

## WALLET-035 · P0 · Campaign cashout to Ujimora Wallet after admin approval: exact net credit

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Campaign owner C is KYC approved, and the campaign has cleared available balance of at least 200 GHS. Admin 1.

**Steps:**

1. As owner, open the campaign -> 'Cashout & payout history', choose destination 'Ujimora Wallet', enter 100 and request. Note the Fee and 'You receive' values.
2. Check the notice 'Request <id>: awaiting admin review. Fee: … You receive: …'.
3. As admin, open Payouts, find the payout labelled 'Ujimora Wallet', and approve it with a review note of at least 20 characters.
4. As owner, open /wallet.
5. In the DB, check payouts, campaignbalances, wallettransactions {reference: 'wallet-payout:<id>'} and the journal with externalRef wallet-payout:<id>.

**Expect:** The payout is PAID with settlementApplied. availableBalance falls by 100, paidOutBalance rises by net, payoutFees rises by fee. The owner's wallet rises by exactly net. The deposit metadata is {source:'campaign', grossAmount:100, fee}. The journal has beneficiary debit 100 = wallet credit net + platform_fee credit fee.

**Needs:** Admin account; MongoDB read access

**Source:** `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`

## WALLET-036 · P0 · Wallet payout approval: negative, concurrency and maker-checker

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Pending wallet payouts. Admins 1 and 2. PAYOUT_DUAL_APPROVAL_AMOUNT=500 on staging. A normal user JWT.

**Steps:**

1. Approve with the note 'ok' (under 20 characters).
2. Have Admins 1 and 2 click approve on the same payout at the same time.
3. As a normal user, POST /api/v1/payouts/<id>/approve.
4. Request a 600 wallet payout. Admin 1 approves, then Admin 1 approves again, then Admin 2 approves.
5. Before approving another payout, drain the campaign's available balance with a separate payout, then approve.
6. Change Admin 1's role or authVersion after login, then approve.

**Expect:** Step 1: 400/422 asking for at least 20 characters. Step 2: exactly one PAID and one wallet credit; the other gets 409. Step 3: 403. Step 4: the first approval is recorded and the payout stays PENDING; the same admin again gets 409 'A second, different admin must approve this high-value payout'; Admin 2 makes it PAID. Step 5: 422 'Insufficient available campaign balance' with no credit. Step 6: 403 'Current administrator access is required.'

**Needs:** Two admin accounts; staging env access

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`

## WALLET-038 · P0 · Donor refund request on web

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Donor A has a Paystack (card or MoMo) donation settled today and no open request for it.

**Steps:**

1. Open /donations and click 'Request Refund' on that row.
2. On /donations/refund/<donationId>, check 'Donation Details' (Campaign, Amount, Date, Payment Method) and the 'Refund Policy' notice.
3. Choose 'Reason for Refund' = 'Duplicate donation', add a Description, submit, and confirm in the dialog.
4. Read the success screen, then click 'View My Refunds'.
5. Return to /donations and look at the same row.
6. In the DB, check refunds and campaignbalances. As admin, open Admin -> Refund requests.

**Expect:** The notice says the request is free and does not approve or execute a refund. The success screen shows 'Refund Request Submitted', 'Refund ID: <id>', 'This request is pending review…' and 'Amount requested: GHS X. No fee is charged…', where X is the full donation amount. /refunds lists it as Pending. The /donations row now shows 'Refund requested' instead of the button. The DB has fee 0, netAmount X and status pending, and no money moves. The request appears in Admin -> Refund requests under 'Awaiting review', and the Action Center 'Donor refund requests' count rises by one.

**Needs:** Paystack test keys (to create the donation)

**Source:** `apps/web/src/pages/MyDonationsPage.tsx`, `apps/web/src/lib/donationRefunds.ts`, `apps/web/src/pages/RefundRequestPage.tsx`, `apps/web/src/pages/MyRefundsPage.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/admin/src/pages/RefundRequestsPage.tsx`

## WALLET-040 · P0 · Refund request authorization and not-found handling

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Donors A and B, an admin, and a guest (signed-out) Paystack donation.

**Steps:**

1. As B, POST /api/v1/refunds {donationId: A's donation}.
2. As B, open /donations/refund/<A's donationId>, watch the page while it loads, then click the back action.
3. As B, GET /api/v1/refunds/mine.
4. Signed out, POST /api/v1/refunds and open /refunds.
5. As admin, POST /api/v1/refunds for A's donation.
6. Check how a guest donor can ask for a refund.

**Expect:** Step 1: 404 'Donation not found'. Step 2: loading dots show while the donation is fetched, with no flash of the not-found state. Then 'This donation was not found or is not eligible for a refund.' appears, and the back action goes to /donations. Step 3: only B's rows. Step 4: 401 or the sign-in prompt. Step 5: 404. Under the policy, a guest is directed to support@ujimora.com.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/application/use-cases/GetDonationUseCase.ts`, `apps/web/src/pages/RefundRequestPage.tsx`, `packages/types/src/legal.ts`

## WALLET-043 · P0 · Refund of a wallet-funded donation is routed to support

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Donor A made a 20.00 wallet donation. Admin with DONATIONS update permission, and an admin JWT.

**Steps:**

1. As A, open /donations and look at the wallet donation row.
2. Open /donations/refund/<walletDonationId> directly and submit a request. Also POST /api/v1/refunds {donationId: walletDonationId} with a valid reason.
3. On Android and iOS, open My Donations and check the wallet donation row.
4. As admin, open Admin -> Payments, search with provider 'wallet', and open the payment's timeline. Click 'Refund payment', tick the confirmation and submit. Also POST /api/v1/admin/payments/<intentId>/refund with an Idempotency-Key.
5. Check A's wallet, wallettransactions, refunds and refundoperations.
6. Check the written support procedure for wallet donations.

**Expect:** Step 1: there is no 'Request Refund' button. The row reads 'Wallet gift: contact support@ujimora.com for a refund'. Step 2: 422 'Wallet donations can't be refunded automatically. Contact support@ujimora.com with the donation ID.', and no refunds document is created. Step 3: neither app offers 'Request Refund'. Step 4: the dialog and the API both return 400 'Contribution has no provider reference to refund'. No refundoperations row, hold or wallet credit is created. Step 5: nothing changes. Step 6: an approved, written manual procedure tells support how to handle wallet-gift refunds: who approves, and how funds are returned and recorded. By design there is no automated wallet-credit refund.

**Needs:** Admin account

**Source:** `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/web/src/lib/donationRefunds.ts`, `apps/mobile/src/lib/donationRefunds.ts`, `apps/admin/src/pages/PaymentsPage.tsx`

## WALLET-044 · P0 · Donor-visible state after a refund is executed and the request is closed

*Surfaces:* admin, android, api, email, ios, web  ·  *Type:* compliance

**Before:** Donor A submitted a request for a Paystack donation (WALLET-038). A has opted in to refund alerts (in-app and email). Admin with DONATIONS update permission.

**Steps:**

1. As admin, open Admin -> Refund requests and find A's request. Enter a staff note of at least 20 characters and click 'Approve and mark processing'.
2. As A, open /refunds and the mobile My Refunds screen. Check the inbox and the mailbox.
3. As admin, check that 'Mark refunded' is disabled. Click 'Refund payment' on the request, confirm the full amount and submit (or execute it through WALLET-045). Wait for the chip 'Payment refunded'.
4. Enter a new note and click 'Mark refunded'.
5. As A, open /refunds, mobile My Refunds, /donations (status filter 'Refunded') and mobile My Donations.
6. Open the campaign page and check the raised total. Check the inbox and the mailbox.

**Expect:** Step 1: the request moves to 'Processing', and A gets 'Your refund is processing' once. Step 3: 'Mark refunded' stays disabled until the payment shows REFUNDED. Step 5: the request shows Completed on web and mobile. The donation shows the chip 'Refunded', appears under the 'Refunded' filter and has no 'Request Refund' button. It is excluded from 'Total Donated' and 'Average Donation'. Mobile My Donations shows 'Refunded'. Step 6: the campaign's raised total fell by the refunded amount. A received 'Your refund is completed' once in the inbox and once by email, linking to /refunds. The staff note is never shown to the donor.

**Needs:** Paystack test keys; Resend for email

**Source:** `apps/admin/src/pages/RefundRequestsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminRefundRequestRoutes.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationPaymentStateRead.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/mobile/app/my-donations.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## WALLET-045 · P0 · Admin full refund of a Paystack donation (API): money accuracy

*Surfaces:* api  ·  *Type:* functional

**Before:** A Paystack donation of 200.00 plus a 20.00 tip, SUCCEEDED, on a campaign whose pending (not yet cleared) balance is at least the net. Admin JWT. Paystack test keys.

**Steps:**

1. Record campaign raisedAmount, the campaignbalances pending/platformFees/processorFees values, and the intent's platformFeeMinor, providerFeeMinor and netCampaignAmountMinor.
2. POST /api/v1/admin/payments/<intentId>/refund with header 'Idempotency-Key: qa-refund-001' and body {}.
3. Check the response and the refund in the Paystack test dashboard.
4. In the DB, check refundoperations, donationintents, campaigns, campaignbalances (refundHolds) and journalentries {externalRef:'refund:<opId>'}.

**Expect:** 200 {status:'REFUNDED', operationId, refundReference}. If Paystack answers pending you get 202 PROCESSING; continue with WALLET-050. The Paystack refund is GHS 200.00 (20000 pesewas; the tip is not refunded) with merchant note 'Ujimora refund <operationId>'. The operation is completed and inactive. The intent is REFUNDED with refundedAmountMinor 20000. Raised falls by 200.00, pending by net, and fees by their legs. refundHolds is empty. A new balanced journal has campaign credit 200, beneficiary debit net, platform_fee debit and processor_fee debit. The original settlement journal is unchanged.

**Needs:** Paystack test keys; admin account; MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `apps/api/src/domain/entities/JournalEntry.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## WALLET-046 · P0 · Partial refunds: cumulative cap, rounding legs and amount validation

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** A Paystack donation of 100.00 with platform fee 3.50 and processor fee F (read from the intent). Admin JWT.

**Steps:**

1. POST refund {amount:33.33} with key k1.
2. Check the operation legs: beneficiaryNet = round((100−3.50−F)×0.3333, 2), platformFee = round(3.50×0.3333, 2) = 1.17, processorFee = 33.33 − net − 1.17.
3. POST {amount:66.67} with key k2.
4. POST {amount:0.01} with key k3.
5. On another donation, POST {amount:150}; then {amount:'10'}; {amount:null}; {amount:{}}; {amount:-1}.
6. On another donation, POST a 10.00 partial, then POST with no amount.

**Expect:** Step 1: PARTIALLY_REFUNDED, and the legs sum exactly to 33.33. Step 3: REFUNDED, with raised reduced by 100 in total. Step 4: 409 (already processed or over the refundable amount) or 400 'Only a settled contribution can be refunded'. Step 5: 400 for each. Step 6: the second call returns 409, because the full amount would exceed the remainder. Every compensating journal balances and nothing is over-refunded.

**Needs:** Paystack test keys; admin account

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## WALLET-047 · P0 · Refund idempotency and concurrent submissions

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Settled Paystack donations. Admin JWT.

**Steps:**

1. Repeat a completed refund POST with the same Idempotency-Key.
2. On a new donation, send two refund POSTs with different keys at the same time.
3. While an operation is unresolved (provider pending), send a new refund with a new key.
4. Send an Idempotency-Key of 201 characters, then one of only spaces.
5. Check the Paystack dashboard refund count for each donation.

**Expect:** Step 1: 409 'This refund was already processed or would exceed the refundable amount'. Step 2: one proceeds; the other gets 409 'This refund was already submitted or an earlier refund needs reconciliation'. Step 3: 409 'An earlier refund needs reconciliation before another refund can be submitted'. Step 4: 400 'Refund idempotency key must contain 1–200 characters'. Never more than one provider refund per request.

**Needs:** Paystack test keys; admin account

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/database/models/RefundOperationModel.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`

## WALLET-048 · P0 · Refund blocked when funds are already disbursed

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** A settled donation whose campaign funds are cleared and paid out, so pendingBalance is below the net. Admin JWT.

**Steps:**

1. POST /api/v1/admin/payments/<intentId>/refund.
2. Race: on another campaign, start a payout clearing and a refund at the same moment.
3. Check refundoperations, donationintents.refundedAmountMinor, campaignbalances and the Paystack dashboard.

**Expect:** Step 1: 409 'These funds appear already disbursed; a manual clawback is required', with no provider call, operation or hold. Step 2: either the refund reserves before clearing, or it fails with 409 'Campaign funds are no longer available for this refund' and a full rollback (no reservation, no provider refund).

**Needs:** Paystack test keys; admin account

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `docs/compliance/REFUND_RECOVERY.md`

## WALLET-049 · P0 · Refund eligibility and permission checks

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Intents in PENDING and FAILED states, a crypto (bitnob) intent if crypto is enabled, admin and normal-user JWTs.

**Steps:**

1. POST refund for a PENDING intent, then a FAILED intent.
2. POST refund for an unknown id.
3. POST refund for a bitnob intent.
4. POST refund for an intent whose settlementCurrency differs from its currency (seed one).
5. As a normal user, POST refund and GET /api/v1/admin/refund-operations.
6. With no token, POST refund.

**Expect:** Step 1: 400 'Only a settled contribution can be refunded'. Step 2: 404 'Contribution not found'. Step 3: 501 'Refunds are not available for bitnob'. Step 4: 409 'Refunds involving currency conversion require manual reconciliation'. Step 5: 403 'Insufficient permissions'. Step 6: 401. None of these creates an operation.

**Needs:** Admin account

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`

## WALLET-050 · P0 · Provider-pending refund resolved through Admin -> Refund recovery

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A refund that returns pending from Paystack (MoMo refunds often stay pending in test). Admin with donation update permission.

**Steps:**

1. Execute the refund and confirm 202 {status:'PROCESSING'}.
2. Open Admin -> 'Refund recovery' (/refund-recovery). Check the amount, the chip 'Provider processing', Operation, Contribution, Payment reference, 'Provider refund reference' and the funds-hold text.
3. Click 'Verify provider status' while Paystack is still pending.
4. After Paystack marks the refund processed, click 'Verify provider status' again.
5. Check the Action Center 'Refund recovery' count and the DB (as in WALLET-045).

**Expect:** Step 2 shows 'Refund funds are held and unavailable for campaign or beneficiary payouts.' Step 3 warns 'The provider is still processing this refund. No replacement refund was requested.' Step 4 shows success 'Local accounting completed. No additional provider refund was requested.', the row leaves the queue and the counts drop. Accounting matches WALLET-045.

**Needs:** Paystack test keys; admin account

**Source:** `apps/admin/src/pages/RefundOperationsPage.tsx`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## WALLET-051 · P0 · Provider timeout: verify with the Paystack refund ID and never resubmit

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with fault injection (for example an egress proxy) able to time out calls to api.paystack.co/refund. Admin account.

**Steps:**

1. Enable the timeout, execute a refund and confirm 202 {status:'PENDING_REVIEW'}.
2. Disable the timeout. In Refund recovery, check the chip 'Provider outcome unknown' (or 'Outcome not yet confirmed') and 'Provider refund reference: Not yet confirmed'.
3. In the Paystack dashboard, find the refund by merchant note 'Ujimora refund <operationId>'.
4. Enter letters in 'Provider refund ID' and check the button state.
5. Enter a wrong numeric ID and click 'Verify provider status'.
6. Enter the correct ID and verify.

**Expect:** Step 4: the button is disabled. Step 5: error 'Provider evidence does not match this refund operation'. Step 6: accounting completes. At no point is a second provider refund created, and holds stay in place until verification.

**Needs:** Paystack test keys; network fault-injection tooling

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`, `apps/admin/src/pages/RefundOperationsPage.tsx`

## WALLET-053 · P0 · Refund hold shown in the owner cashout and excluded from payouts

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** An unresolved refund operation (from WALLET-050, step 1) on the owner's campaign C.

**Steps:**

1. As owner, open campaign C -> 'Cashout & payout history' on web and in the apps.
2. Check the breakdown rows.
3. Try to cash out the previous full eligible amount.
4. After the refund completes, reload the breakdown.

**Expect:** A row 'Held for refund review −X' appears, and 'Remaining eligible balance' is reduced by X. The oversized cashout is refused or capped. After completion the hold row is gone, raised is reduced, and there is no 'Difference awaiting reconciliation' row.

**Needs:** Paystack test keys

**Source:** `packages/types/src/payout.ts`, `apps/api/src/application/use-cases/GetCampaignPayoutOptionsUseCase.ts`, `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/mobile/src/components/CampaignCashout.tsx`

## WALLET-055 · P0 · Refund made directly in the Paystack dashboard

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** A settled test donation on campaign C, and no Ujimora refund operation for it. Access to the Paystack test dashboard (or the test secret to sign a refund.processed webhook).

**Steps:**

1. Refund the donation from the Paystack dashboard, not through Ujimora.
2. Confirm that Paystack sends refund.processed (transaction_reference = the donation reference) and that the API answers 200. Replay the signed webhook once.
3. Check providerpaymentevents, Admin -> Disputes, the intent status, campaign raised and campaignbalances.
4. Trigger the automatic payout for C, then, as owner, request a manual cashout.

**Expect:** The webhook returns 200. One providerpaymentevents row is stored (kind refund, subject donation). Admin -> Disputes gains one open case with reporter 'Paystack (payment provider)', reason 'Refund issued outside Ujimora', and a description stating 'The campaign balance has NOT been reduced'. The replay creates no second case. Step 4: the automatic payout is skipped with 'Campaign has an unresolved dispute.' and the manual request returns 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' A refund made through Ujimora (WALLET-045) opens no case. Target: the external refund is reversed or held in Ujimora. Known open issue I009: the intent stays SUCCEEDED, and raised and campaignbalances are unchanged. Nothing is reversed automatically, so staff must account for the refund manually, and the ops rule 'never refund from the Paystack dashboard' still needs to be written down.

**Needs:** Paystack test dashboard

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDisputeRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`

## WALLET-059 · P0 · Chargeback (dispute) on a donation

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** A settled donation reference on campaign C (automatic payouts configured, owner KYC current), and the Paystack test secret for signing.

**Steps:**

1. POST a signed {event:'charge.dispute.create', data:{id:<case id>, status:'awaiting-merchant-feedback', refund_amount:<minor>, currency:'GHS', dueAt:<ISO>, transaction:{reference:<donation ref>, amount:<minor>, currency:'GHS'}}} to /api/v1/webhooks/paystack. You can instead raise a test dispute in Paystack if available.
2. Replay the same signed body, then send charge.dispute.remind for the same case.
3. Check Admin -> Disputes, the Action Center 'Open disputes' count, providerpaymentevents, the intent status and campaignbalances.
4. Trigger the automatic payout for C, then, as owner, request a manual cashout.
5. Send charge.dispute.resolve for the case and check the dispute status.

**Expect:** Every call returns 200. Exactly one dispute exists, with status open, reporter 'Paystack (payment provider)' and reason 'Payment dispute (chargeback) raised with Paystack'. Its description includes the Paystack dispute id, the transaction reference, the amount and 'respond in the Paystack dashboard before <due date>'. The replay and the remind update it without creating a duplicate, and 'Open disputes' rises by one. Step 4: the automatic payout is skipped with 'Campaign has an unresolved dispute.' and the manual request returns 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' Step 5: the case moves to under_review (it is never auto-closed), and payouts stay paused until staff resolve it. No donor email or card details are stored. Target: the contribution is marked DISPUTED and the disputed funds are held. Known open issue I009: the intent stays SUCCEEDED, and there is no automatic hold, clawback or chargeback ledger reversal. Staff must follow the written chargeback process: respond in Paystack, and reverse with the refund tools if the dispute is lost.

**Needs:** Paystack test secret

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDisputeRepository.ts`, `apps/api/src/application/use-cases/GetDisputeUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`

## WALLET-060 · P0 · Chargeback or reversal of a wallet top-up after the funds are spent

*Surfaces:* api  ·  *Type:* compliance

**Before:** A donor topped up 100 and donated the full 100 with the wallet. Admin JWT.

**Steps:**

1. Send a signed charge.dispute.create with data.transaction.reference = the wtop- reference (or record a Paystack reversal).
2. Replay it once.
3. As admin, GET /api/v1/admin/payments/provider-events?status=open.
4. Check the wallet balance, the wallettopups status, Admin -> Disputes and the API logs.

**Expect:** The webhook returns 200. One providerpaymentevents row is stored (kind dispute, subject wallet_topup, reviewStatus open), and the replay adds none. An error-level 'provider_dispute' alert is logged, and the event is listed by the provider-events endpoint. No Disputes case is opened, because this is not a campaign donation. The wallet balance and the completed top-up are unchanged. Target: a defined recovery, such as a negative balance, an account hold, or a staff alert backed by a written policy. Known open issue I009: top-up chargebacks are only recorded. Nothing debits or holds the wallet, and there is no admin console page for these events. The loss policy and monitoring must be written down before launch.

**Needs:** Paystack test secret

**Source:** `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`

## WALLET-063 · P0 · Missed donation webhook repaired by manual reconcile and by the sweep; abandoned checkouts expire

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with reconciliation enabled (NODE_ENV=production or RECONCILIATION_SCHEDULER_ENABLED=true). Webhook temporarily pointed at a dead URL. Admin JWT. Mongo write access on staging to backdate one intent.

**Steps:**

1. Make a guest Paystack donation of 25 and pay. Close the tab before /donate/callback loads.
2. GET /api/v1/admin/payments?providerRef=<ref> (expect PENDING), then GET /api/v1/admin/payments/<id> for the timeline and attempts.
3. POST /api/v1/admin/payments/<id>/reconcile, then send the same call again.
4. Leave a second paid donation for the scheduled sweep (older than 30 min, checked every 5 min).
5. Leave an unpaid intent, and a declined-card intent that holds a coupon seat.
6. Backdate the unpaid intent's createdAt by 25 hours, then POST /api/v1/admin/reconciliation {olderThanMinutes:0}.

**Expect:** Step 3: {outcome:'repaired', status:'SUCCEEDED'}, then {outcome:'skipped'}. Step 4: the sweep settles it, with one journal and one raised increment. Step 5: the unpaid intent stays PENDING while its checkout is under 24 hours old, because Paystack's 'abandoned' is not final yet. The declined one becomes FAILED and its coupon seat is released. Step 6: the unpaid intent becomes EXPIRED, the summary shows expired of at least 1, and any coupon seat it held is released.

**Needs:** Paystack test keys; ability to change the webhook URL

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/app.ts`

## WALLET-064 · P0 · Amount or currency mismatch never credits a campaign

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A pending Paystack intent of 50.00 GHS and the test secret for signing.

**Steps:**

1. POST a signed charge.success for the intent reference with amount 4000 (GHS 40).
2. Repeat with currency 'NGN' and the correct amount.
3. Check the intent status, payment attempts and the campaign raised amount.
4. POST /api/v1/admin/payments/<id>/reconcile after the real payment.

**Expect:** Steps 1-2 credit nothing: the intent stays PENDING, a 'failed' attempt is recorded, and a warning is logged. Step 4 settles using Paystack's verified data only if it matches, otherwise it returns 'mismatched'.

**Needs:** Paystack test secret

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## WALLET-066 · P0 · Settlement integrity audit script shows no findings after the QA run

*Surfaces:* api  ·  *Type:* compliance

**Before:** Operator shell with MONGODB_URI for staging (read-only credentials preferred). The QA suite has finished at least 30 minutes earlier.

**Steps:**

1. In apps/api, run: umask 077; npx tsx scripts/audit-donation-settlement.ts <cutoff ISO at least 30 min ago> > audit-page-1.json
2. Page through with the returned nextCursor until it is null.
3. Read the exit codes and the findings.

**Expect:** Exit 0 on every page, with no missing-journal, duplicate-journal, unbalanced-journal, settlement-journal-mismatch, campaign-journal-mismatch, missing-outbox, missing-wallet-history or wallet-history-mismatch findings. Any exit 2 is triaged per intent. Reports are kept in restricted storage.

**Needs:** MongoDB read access

**Source:** `apps/api/scripts/audit-donation-settlement.ts`, `apps/api/src/infrastructure/audits/donationSettlementIntegrity.ts`, `docs/compliance/HISTORICAL_DONATION_AUDIT.md`

## WALLET-067 · P0 · Wallet balance matches transaction history and the wallet ledger account

*Surfaces:* api  ·  *Type:* compliance

**Before:** Every QA wallet that had top-ups, wallet donations and wallet payouts. Mongo aggregation access.

**Steps:**

1. For each wallet, read wallets.balance.
2. Compute Σ of completed wallettransactions: deposits minus donations (and minus withdrawals, if any).
3. Compute Σ of journallines where accountKind is 'wallet' and accountOwnerId = walletId, as credits minus debits.
4. Compare the three values.

**Expect:** All three values are equal to the pesewa, so wallet safeguarding can be reconciled from the ledger (BoG, READINESS C03). Known open issue I046: wallet donations still post no 'wallet' debit journal line. After any wallet donation, value 3 is higher than value 1 by the total of wallet donations. The fix needs a finance decision on the counter-account, plus a backfill.

**Needs:** MongoDB read access

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/domain/entities/JournalEntry.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`

## WALLET-072 · P0 · Legal disclosures for the Ujimora Wallet

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Access to the legal pages on ujimora.com and in the apps (All policies).

**Steps:**

1. Read the Terms, the Contributor & Donor Terms, and the Payout, Refund & Failed Campaign Policy.
2. Read the /wallet page copy and the mobile 'Fund your wallet' copy.
3. Check each disclosure: GHS only; GHS 1–10,000 per top-up; processor fee absorbed; no external withdrawal; how unused balances are refunded; treatment on account closure or dormancy; the operator identity; and complaints.

**Expect:** Each item is disclosed consistently and signed off by legal, and the BoG e-money/safeguarding position (READINESS C03) is confirmed. Known open issue I088: legal.ts still has no Ujimora Wallet section covering stored balance, no external withdrawal, top-up refunds, dormancy and closure. This remains a product/legal decision and an external BoG gate.

**Needs:** Legal review

**Source:** `packages/types/src/legal.ts`, `apps/web/src/pages/WalletPage.tsx`, `apps/mobile/src/components/WalletFunding.tsx`, `docs/compliance/READINESS.md`

## WALLET-N001 · P0 · Admin Refund requests queue: review, notes, forward-only transitions and audit

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Three donor refund requests on Paystack-paid donations (WALLET-038), plus one on a donation with no linked settlement journal (seed on staging). Admin 1 and Admin 2 with DONATIONS update permission, a read-only staff role, and a normal user.

**Steps:**

1. Open Admin -> Refund requests. Reach it from the sidebar entry 'Refund requests' and from the Action Center item 'Donor refund requests'. Check the default 'Awaiting review' filter and the header count. On each card, check the amount, the status chip, the 'Payment <status>' chip, the requester link and email, the campaign link, the reason and description, and 'View payment timeline'.
2. Type a 19-character staff note and check the action buttons. Then type a note of 20 or more characters.
3. On request 1, click 'Approve and mark processing'. Switch the filter to 'Processing'.
4. On request 1, try 'Mark refunded' before the payment is refunded. Also PATCH /api/v1/admin/refund-requests/<id> {status:'completed', staffNote:<20+ chars>}.
5. On request 2, click 'Decline' with a note. Then PATCH it to 'processing'.
6. Open the request that has no linked payment.
7. Have Admins 1 and 2 click 'Approve and mark processing' on request 3 at the same moment.
8. As the read-only role, open the page. As a normal user, GET /api/v1/admin/refund-requests. Also call GET /api/v1/admin/refund-requests?status=bogus.
9. Check the audit log and the donors' inboxes.

**Expect:** Step 1: requests are listed oldest first, and responses carry Cache-Control 'private, no-store'. Step 2: every action stays disabled under 20 characters. The helper reads 'Internal. Kept in the audit log; the donor sees only the status.' Step 3: the notice reads 'Request marked processing. The donor is notified of the new status.' and the request moves to 'Processing'. Step 4: 'Mark refunded' is disabled in the UI. The API returns 409 'Refund the contribution first. A request can be completed only after its payment shows a refund.' Step 5: the card shows 'Declined or failed'. The later PATCH returns 409 'A failed refund request cannot be marked processing'. Step 6: the card says 'No linked payment was found for this donation...' and has no 'Refund payment' button. Step 7: one call wins, and the other gets 409 'This refund request changed. Refresh and try again.' Step 8: read-only staff see the queue with the note and action controls disabled. The normal user gets 403. The bad status returns 400 'Status must be pending, processing, completed or failed'. Step 9: each transition has one audit row: action refund_request.<status>, before and after status, and the note as the reason. The donor gets one 'Your refund is <status>' alert per change. The Action Center count equals the pending plus processing requests.

**Needs:** Admin accounts; Paystack test keys

**Source:** `apps/admin/src/pages/RefundRequestsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminRefundRequestRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.ts`, `apps/api/src/domain/ports/outbound/RefundRepositoryPort.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/admin/src/components/layout/Sidebar.tsx`

## WALLET-N005 · P0 · Legacy wallet donate endpoint: Idempotency-Key contract

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Donor A with GHS 100.00 and Donor B with GHS 50.00. Active GHS campaigns C and D. Bearer JWTs for both donors.

**Steps:**

1. As A, POST /api/v1/campaigns/C/donate {amount:10, currency:'GHS', paymentMethod:'wallet'} with 'Idempotency-Key: qa-legacy-key-0001'. Send it 3 times in parallel.
2. Send the same key with amount 12, then with campaign D.
3. Send the key 'short!', then the key 'abc'.
4. Send a new key with amount 500 (more than the balance), then replay that exact request.
5. Send amount 1.005 with a new key.
6. Send two requests with no Idempotency-Key header.
7. As B, send A's key qa-legacy-key-0001 for campaign C with amount 10.
8. Check wallets, donationintents, donations and wallettransactions.

**Expect:** Step 1: every call returns 200 'Donation successful', and A is debited 10.00 once: one intent with key legacy-wallet:<A>:qa-legacy-key-0001, one donation and one WalletTransaction. Step 2: 409 'This request key was already used for a different donation', with no debit. Step 3: 400 'Invalid Idempotency-Key'; keys must be 8-100 letters, digits, '-' or '_'. Step 4: the first call returns 400 'Insufficient wallet balance'. The replay returns 409 'This donation attempt did not go through. Please start a new donation.' and never 'Donation successful'. Step 5: 400, because the amount has more than two decimals. Step 6: without a key, each call is a separate donation, as older clients expect. Step 7: B gets B's own donation, because keys are scoped per donor, and A's records are untouched.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

## WALLET-N007 · P0 · Campaign cashout to Ujimora Wallet is refused for expired KYC, a blocked campaign, an open dispute or self-approval

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Campaign C, owned by O, with an available balance and PENDING 'Ujimora Wallet' cashout requests. Admin 1 (not the owner). Admin 2, who owns campaign E, which has its own PENDING wallet cashout. Staging DB write access to expire O's identity approval.

**Steps:**

1. Set the expiry of O's newest identity approval in the past. As Admin 1, approve a PENDING wallet cashout for C with a note of at least 20 characters.
2. Restore the approval. Block campaign C in admin, then approve another PENDING wallet cashout that was requested before the block. As O, request a new wallet cashout.
3. Unblock C. Open a dispute on C with a signed charge.dispute.create, then approve again.
4. As Admin 2, approve the wallet cashout on Admin 2's own campaign E.
5. After each step, check O's wallet, wallettransactions, payouts and campaignbalances.

**Expect:** Step 1: 409 'The account holder’s identity verification is missing, expired or under renewal. It must be current before funds can be paid out.' Step 2: both the approval and the new request return 409 'This campaign is under review; payouts are paused'. Step 3: 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' Step 4: 403 'Another administrator must approve payouts from your own campaign or request.' In every step the payout stays PENDING, no wallet credit or wallet-payout:<id> row is written, and the balances are unchanged.

**Needs:** MongoDB write access (staging); Paystack test secret

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`

## WALLET-N009 · P0 · A late payment on an EXPIRED or FAILED donation intent is credited exactly once

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with reconciliation enabled, Paystack test keys and the test secret for signing, an admin JWT, and DB write access to backdate intents.

**Steps:**

1. Start a guest Paystack donation of 30 and keep its authorization URL, but do not pay. Backdate the intent's createdAt by 25 hours, then POST /api/v1/admin/reconciliation {olderThanMinutes:0}.
2. Open the saved authorization URL and pay. If Paystack no longer serves the checkout, skip to step 4.
3. Replay the resulting signed charge.success twice.
4. Start another donation and pay with the declining card, so the donor status check records FAILED. Then complete it on the same checkout with a success card, with the webhook pointed at a dead URL. POST /api/v1/admin/payments/<id>/reconcile.
5. Send a signed charge.success for an EXPIRED intent whose Paystack transaction was never paid.
6. Check intents, journals, campaign raised, coupon redemptions and the logs.

**Expect:** Step 1: the summary shows expired of at least 1. The intent is EXPIRED, and any fee-waiver seat is released. Step 2: the webhook is re-verified with Paystack, and the intent is reopened and settled: SUCCEEDED, with exactly one journal, one raised increment and a 'late_success_credited' alert in the log. Step 3: the replays change nothing. Step 4: the reconcile returns outcome 'repaired' with status SUCCEEDED, credited once. Step 5: nothing is credited, and the intent stays EXPIRED. Paid money is never dropped and never counted twice.

**Needs:** Paystack test keys and secret; MongoDB write access (staging)

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`

## WALLET-001 · P1 · Web wallet page shows correct balances and history

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Donor A is signed in on app.ujimora.com with a GHS wallet that has at least one completed top-up and one wallet donation.

**Steps:**

1. Open https://app.ujimora.com/wallet (or account menu -> 'Wallet').
2. Watch the loading skeletons, then the wallet card grid.
3. Open DevTools Network and compare the card values with the GET /api/v1/wallets response.
4. Scroll to 'Transaction History' and compare the rows with GET /api/v1/wallets/transactions.
5. Check that the page source has a robots meta tag with noindex, nofollow.

**Expect:** Card 'Local Currency Wallet' shows the balance formatted in GHS, equal to the API balance, plus 'Currency: GHS', an 'Updated <date>' line and the text 'External withdrawals are not available from this wallet.' History rows (Type, Amount, Status chip, Reference, Date) are newest first and match the API. An API error shows a red Alert, not a blank page.

**Needs:** Staging API and web

**Source:** `apps/web/src/pages/WalletPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/WalletController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/walletRoutes.ts`

## WALLET-005 · P1 · Top-up amount validation (web and API)

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Donor A signed in. Top-ups are enabled.

**Steps:**

1. On /wallet, type each of 0, 0.99, 10000.01, -5 and blank into 'Top-up amount (GHS)'. Check the 'Fund wallet' button state each time.
2. Enter 1.234 and click 'Fund wallet'.
3. Enter 1.00, click 'Fund wallet', check the Paystack amount, then cancel.
4. Enter 10000, click 'Fund wallet', check the Paystack amount, then cancel.
5. Via API, POST /api/v1/wallets/topups with a valid key and amount '50' (string), then 10000.5, then walletId 'abc'.
6. Count wallettopups rows created during this test.

**Expect:** Step 1: the button is disabled for each value. Step 2: error Alert 'Enter an amount from GHS 1 to GHS 10,000 with at most two decimals'. Steps 3-4: the redirect shows GHS 1.00 and GHS 10,000.00. Step 5: each call returns 400. Rejected inputs create no top-up records.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/walletRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/web/src/pages/WalletPage.tsx`

## WALLET-010 · P1 · Declined top-up leaves the balance unchanged and allows a clean retry

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Paystack test card that is declined.

**Steps:**

1. Start a 20.00 top-up and pay with the declining test card.
2. Return to /wallet (via the Paystack cancel/return link, or by visiting /wallet?reference=...).
3. Read the alert.
4. Start a new 20.00 top-up.

**Expect:** Alert 'Payment was not completed. You can start a new top-up.' WalletTopUp is failed, with no WalletTransaction and no journal. The retry gets a new wtop- reference, because the session key was cleared.

**Needs:** Paystack test cards

**Source:** `apps/web/src/pages/WalletPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## WALLET-014 · P1 · Behavior when top-ups are disabled or the Paystack gateway is switched off

*Surfaces:* admin, android, api, web  ·  *Type:* negative/edge

**Before:** Staging where env can be changed. Admin account with Payment Providers update permission.

**Steps:**

1. Set PAYMENTS_PAYSTACK_ENABLED=false (or blank PAYSTACK_SECRET_KEY) and redeploy.
2. Open /wallet on web and Profile -> Wallet on Android.
3. POST /api/v1/wallets/topups.
4. Restore the env. Open Admin -> Payment Providers and read the info note. Switch the Paystack gateway row off, then check its chip and helper text.
5. Try a web top-up.
6. Switch the Paystack gateway row back on from the console.

**Expect:** Web shows 'Wallet funding is not configured yet.' with no amount field. Android shows 'Wallet funding is not currently available.' The API returns 503 'Wallet top-ups are not configured'. Step 4: the note says the Paystack and Flutterwave switches stop new donation checkouts and 'do not yet affect wallet top-ups, subscriptions, creator tips or payouts'. The switched-off row shows the chip 'Disabled' and 'New donation checkouts on this gateway are stopped. Switch it on to accept them again.' Step 5: the top-up still opens Paystack checkout, as the note says. Step 6: the row switches back on and shows 'Enabled'. Known open issue I047: the gateway switch does not stop wallet top-ups on the server, because WalletTopUpService.configuration ignores it. Before launch, product must either accept this documented behaviour or add enforcement.

**Needs:** Staging env access

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/web/src/pages/WalletPage.tsx`, `apps/mobile/src/components/WalletFunding.tsx`

## WALLET-025 · P1 · No floating-point residue after wallet debits

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** A fresh donor topped up to exactly 10.00. On staging, a second test wallet whose stored balance is seeded to 8.3799999.

**Steps:**

1. Donate 9.99 with the wallet.
2. In Mongo, read the exact stored wallets.balance and compare it with the UI.
3. Donate 0.01 with the wallet.
4. Repeat with a second account: top up 10.00, make three donations of 3.33, then donate 0.01.
5. With the seeded 8.3799999 wallet, donate 8.38.

**Expect:** After step 1 the stored balance is exactly 0.01 (not 0.009999999999999787) and the UI shows GH₵0.01. The 0.01 donation succeeds and leaves exactly 0 (never -0). The second sequence stores exactly 0.01 after the three 3.33 donations and 0 after the final 0.01. No false 'Insufficient wallet balance' appears. The seeded legacy balance can spend 8.38 and ends at 0.

**Needs:** MongoDB read access; MongoDB write access (staging) for the legacy seed

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletRepository.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## WALLET-030 · P1 · No wallet debit for campaigns that are not accepting donations

*Surfaces:* android, api, web  ·  *Type:* negative/edge

**Before:** Campaigns that are ended (past endDate), paused/suspended, pending_review and deleted. Admin account.

**Steps:**

1. On web, open each campaign and check the 'Donate with wallet' button and the helper text.
2. Via API, POST /api/v1/campaigns/<id>/donate and /api/v1/donation-intents with provider 'wallet' for each.
3. Race test: the admin suspends campaign C while the donor clicks 'Confirm Donation' at the same moment (repeat a few times).

**Expect:** The button is disabled and the text reads 'This campaign is not accepting donations.' The API returns 400 'Campaign is not accepting donations' (or 409 'Campaign is not accepting this wallet donation'). No debit, donation or journal is created. In the race, each attempt either fully succeeds or fully rolls back; there are no partial writes.

**Needs:** Admin account

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`

## WALLET-031 · P1 · Admin 'Ujimora Wallet' switch stops wallet donations on every surface

*Surfaces:* admin, android, api, web  ·  *Type:* negative/edge

**Before:** Admin account. Donor with a balance.

**Steps:**

1. In Admin -> Payment Providers, read the info note, then switch 'Ujimora Wallet' to Disabled.
2. On the web campaign detail page, check the wallet section.
3. On the Android donate screen, check the Payment method options.
4. Donate directly via POST /api/v1/donation-intents with provider 'wallet', and via POST /api/v1/campaigns/:id/donate.
5. Switch 'Ujimora Wallet' back on.

**Expect:** Target: when the switch is off, the web shows 'Wallet donations are not currently available.', Android hides the wallet option, and the API refuses wallet donations. What happens now: the admin note says so accurately ('The Ujimora Wallet switch hides the wallet option on the website only.') and the web hides the option. However, both API routes and the Android 'Ujimora wallet · existing balance' option still accept wallet donations and debit the wallet. Known open issue I047: there is no server-side or Android enforcement of the wallet switch, because assertRailEnabled still skips 'wallet'. Record the result and get a product decision.

**Needs:** Admin account

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/mobile/app/donate/[id].tsx`

## WALLET-032 · P1 · Fee-waiver coupon with a wallet donation: seat consumed or released

*Surfaces:* android, api  ·  *Type:* functional

**Before:** Active DONATION coupon QAWAIVE (GHS, per-user limit 1) created in Admin -> Coupons. Donor balances: 150 and 50.

**Steps:**

1. With the 150 balance on Android, donate 100 with the wallet and enter coupon QAWAIVE. Wait for 'Applied — X GHS more reaches this campaign'.
2. Submit. Check the intent's platformFeePercentOverride and platformFeeMinor, the wallet debit and couponredemptions.
3. With the second account (balance 50), donate 100 with the wallet and QAWAIVE.

**Expect:** Step 2: the donor is debited exactly 100.00, the platform fee is lower than the plan rate (the campaign gets more), and the redemption is consumed once. Step 3: 'Insufficient wallet balance', the intent is FAILED, and the coupon seat is released, so the code can be reused later.

**Needs:** Admin-created coupon

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/mobile/app/donate/[id].tsx`

## WALLET-033 · P1 · Wallet donation with a mismatched live session or currency

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** A live session belonging to campaign X. Campaign C in GHS. PAYMENTS_MULTI_CURRENCY_ENABLED=false.

**Steps:**

1. POST /api/v1/donation-intents provider 'wallet' for campaign C with liveSessionId from campaign X.
2. POST /api/v1/campaigns/<C>/donate {amount:10, currency:'USD', paymentMethod:'wallet'}.
3. Check the balance.

**Expect:** Step 1: 400 'Live session does not belong to this campaign'. Step 2: 400 'Contributions in USD are not enabled'. No debit or intent side effects.

**Needs:** LiveKit not required (session record only)

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

## WALLET-037 · P1 · Creator withdrawal to Ujimora Wallet

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** A creator with at least 60 GHS available creator balance (tips made on the web; tips are unavailable in the native apps). On staging, the ability to set the creator's identity approval expiry in the past.

**Steps:**

1. On web /creator, open Withdraw, choose destination 'Ujimora Wallet', enter 50, review the fee and confirm.
2. Replay the same POST in DevTools (same idempotency key).
3. Change the creator plan fee in admin, then submit a new withdrawal from the stale dashboard.
4. Request more than the available balance, then request 4.99.
5. Expire the creator's identity approval. Withdraw 5.00 to 'Ujimora Wallet', then try the same amount to a saved bank or MoMo account.
6. Restore the approval. Repeat a GHS 5.00 withdrawal to the wallet from the mobile Creator page on Android and iOS.

**Expect:** Step 1 shows 'Funds added to your Ujimora Wallet'. The wallet rises by net = 50 − fee, and the creator's available balance falls by 50. The deposit reference is wallet-creator:<userId>:<key>. The journal has a beneficiary (creator:<id>) debit of 50, a wallet credit of net and a platform_fee credit of fee. Step 2 returns the same payout with no second credit. Step 3: 409 'Your withdrawal fee has changed...'. Step 4: 422 'Insufficient available creator balance', then 422 'The minimum withdrawal is GHS 5.' Step 5: the wallet withdrawal succeeds because the funds stay on the platform, so there is no KYC gate. The bank or MoMo withdrawal is refused before any provider call with 'Verify your identity, or renew an expired verification, before withdrawing creator funds to a bank or mobile-money account.' Step 6: native follows the same rules.

**Needs:** Paystack test keys (to fund tips on web); MongoDB write access (staging)

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/mobile/app/creator.tsx`

## WALLET-039 · P1 · Refund request validation, duplicates and concurrency

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** A donor with two eligible card or MoMo donations. The refunds unique index has been migrated (WALLET-070).

**Steps:**

1. Try to submit with no reason (the web select is empty; mobile shows 'Select a Reason').
2. POST /api/v1/refunds with reason '', then a 201-character reason, then a 2001-character description, then no donationId.
3. Submit a valid request. Then submit again for the same donation, by opening /donations/refund/<id> directly (the /donations row now shows 'Refund requested') or via the API.
4. For the second donation, fire two identical POST /api/v1/refunds at the same time.

**Expect:** Step 1 is blocked in the client. Step 2 returns 400 each time. Step 3: 409 'Refund already requested for this donation'. Step 4: exactly one refunds document exists. One call returns 201 and the other 409 'Refund already requested for this donation', never 500.

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/refundRoutes.ts`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`

## WALLET-041 · P1 · Refund window is consistent across web, apps, API and policy

*Surfaces:* android, api, ios, marketing, web  ·  *Type:* compliance

**Before:** Donor A has two completed card or MoMo (Paystack) donations. One is backdated to 31 days old and one to 29 days old (set createdAt in the DB).

**Steps:**

1. Open web /donations and look for 'Request Refund' on both rows.
2. Open My Donations on Android and iOS for the same donations.
3. POST /api/v1/refunds for the 31-day-old donation.
4. Read the Payout, Refund & Failed Campaign Policy, section 5, on ujimora.com and in the in-app refund-policy screen.

**Expect:** One rule applies everywhere and matches the published policy. Web, Android and iOS now apply the same client rule: 'Request Refund' shows on the 29-day-old gift and is hidden on the 31-day-old one (and on wallet gifts). Target: the API also refuses the 31-day-old request, and the policy states the 30-day window. Known open issue I125: the API still accepts that request (201) and the policy states no fixed window. The window needs a product/legal decision before launch.

**Needs:** MongoDB write access (staging)

**Source:** `apps/web/src/lib/donationRefunds.ts`, `apps/mobile/src/lib/donationRefunds.ts`, `apps/mobile/app/my-donations.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `packages/types/src/legal.ts`

## WALLET-042 · P1 · Mobile refund request and My Refunds (iOS and Android)

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** A donor signed in on both devices, with three donations: a completed card or MoMo donation from the last 30 days, a wallet donation, and a card donation older than 30 days.

**Steps:**

1. Open Profile -> My Donations and check which rows offer 'Request Refund'. Tap it on the eligible row.
2. On the refund-request screen, check the donation details (amount format) and the policy text 'Submitting a request is free…'.
3. Pick a reason radio button, enter a description and submit.
4. Read the success view ('Your refund ID is:'), then open 'My Refunds'.
5. Reopen My Donations and check the refunded row's action.
6. In airplane mode, submit a request for another eligible donation, then retry online.

**Expect:** 'Request Refund' appears only on the recent completed card or MoMo gift. It does not appear on the wallet gift or the older gift. Amounts use the recorded currency with two decimals (for example 'GH₵50.00'). The request is created with status pending and the refund ID is shown. My Refunds shows the campaign, 'Requested: GH₵50.00', the date and the reason. My Donations no longer offers 'Request Refund' for that gift. Offline shows an 'Error' alert, and the retry creates exactly one request.

**Needs:** None

**Source:** `apps/mobile/app/refund-request.tsx`, `apps/mobile/app/my-refunds.tsx`, `apps/mobile/app/my-donations.tsx`, `apps/mobile/src/lib/donationRefunds.ts`, `apps/mobile/src/lib/money.ts`

## WALLET-052 · P1 · Local accounting retry for reversal_pending runs once only

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging DB write access to force a local reversal failure after provider success (for example temporarily set the campaign currency or raisedAmount so reverseRaised fails).

**Steps:**

1. Execute a refund that Paystack processes while the local reversal is forced to fail.
2. In Refund recovery, check the chip 'Accounting needs completion' and issue local_reversal_failed.
3. Restore the data and click 'Finish accounting' twice quickly.
4. Check journalentries refund:<opId>, campaignbalances refundHolds and the intent status.

**Expect:** Exactly one compensating journal. Holds are released once, raised is reduced once, and the intent is REFUNDED. The second click is a harmless no-op or 409. No provider call is made.

**Needs:** MongoDB write access (staging); Paystack test keys

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/admin/src/pages/RefundOperationsPage.tsx`

## WALLET-054 · P1 · Refund recovery page: permissions, export and caching

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** At least 13 unresolved operations (to test pagination). Admin and normal-user accounts.

**Steps:**

1. Open /refund-recovery and page through with the page-size control.
2. Use the ExportMenu to export the report.
3. In DevTools, check the GET /api/v1/admin/refund-operations headers and body.
4. Call GET /api/v1/admin/refund-operations?page=0.
5. As a normal user, open the admin console route and call the API.

**Expect:** Pagination works. The export lists ID, Campaign, Provider, Provider reference, Amount, Currency, State and Created. Responses carry Cache-Control 'private, no-store' and no requestKey. page=0 returns 400 'Invalid page'. The normal user is denied (PermissionDenied page, API 403).

**Needs:** Admin account

**Source:** `apps/admin/src/pages/RefundOperationsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/admin/src/router.tsx`

## WALLET-056 · P1 · Flutterwave refund attempt is refused before funds are held (only if Flutterwave is enabled)

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** PAYMENTS_FLUTTERWAVE_ENABLED=true with FLW test keys, and a settled Flutterwave donation.

**Steps:**

1. POST /api/v1/admin/payments/<intentId>/refund with an Idempotency-Key.
2. Check refundoperations, the intent's refundedAmountMinor, campaignbalances refundHolds and the Flutterwave dashboard.
3. Open Admin -> Refund recovery and the owner's cashout breakdown.

**Expect:** Step 1: 501 'Refunds for flutterwave must be issued in the provider dashboard', returned before anything is written. Step 2: no refundoperations row, refundedAmountMinor unchanged, no refundHolds, and no Flutterwave refund. Step 3: Refund recovery has no row for it, and the breakdown has no 'Held for refund review' row. Keep Flutterwave off at launch, or document dashboard refunds plus manual accounting.

**Needs:** Flutterwave test keys (pending)

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/FlutterwaveGateway.ts`

## WALLET-057 · P1 · Split-proceeds refund holds and reversals (SPLIT_PROCEEDS_ENABLED=true)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** A campaign with an active 60/40 split and accepted consents, SPLIT_PROCEEDS_ENABLED=true, and a Paystack donation of 100.

**Steps:**

1. Refund 50.
2. Check the campaignbeneficiarybalances refundHolds: the beneficiary net share split 60/40 in minor units.
3. Complete the refund and check the accrual reversal and the admin Split section ('Held for refund review').
4. On another donation, let one beneficiary withdraw their pending share, then refund.

**Expect:** The holds are proportional, sum exactly to the net, and are released once on completion. The shortfall case returns 409 'Beneficiary funds are no longer available for this refund' with every hold and reservation rolled back and no provider call.

**Needs:** Paystack test keys; feature flag

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/admin/src/components/SplitProceedsSection.tsx`

## WALLET-061 · P1 · Admin Disputes queue: list, detail and resolve

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Two provider cases for campaign C, created through signed webhooks: a charge.dispute.create (WALLET-059) and a refund.processed for a dashboard refund (WALLET-055). A staff-reported dispute can still only be inserted into the DB, since no API or console action creates one. Admin and normal-user accounts.

**Steps:**

1. Open Admin -> Disputes (/disputes). Search, filter by status and export.
2. Open /disputes/<id> for the chargeback case. Enter 'Resolution notes', set Decision to 'resolved' and submit.
3. Submit a resolution again on the same dispute.
4. Via API, PUT /api/v1/disputes/<id>/resolve with an empty resolution.
5. As a normal user, GET /api/v1/disputes.
6. Check the Action Center 'Open disputes' count.
7. Send a signed charge.dispute.remind for the resolved case.

**Expect:** The list and detail show the campaign title and reporter 'Paystack (payment provider)'. The reason and description explain each case. Resolving sets status, resolution, resolvedBy and resolvedAt. A second resolve returns 409 'Dispute has already been resolved'. An empty resolution returns 400. The normal user gets 403. The 'Open disputes' count (open plus under_review) falls after resolution. The later provider event updates the case's provider fields but does not reopen it.

**Needs:** Paystack test secret

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/disputeRoutes.ts`, `apps/api/src/application/use-cases/ResolveDisputeUseCase.ts`, `apps/api/src/application/use-cases/GetDisputeUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDisputeRepository.ts`, `apps/admin/src/pages/DisputesPage.tsx`, `apps/admin/src/pages/DisputeDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## WALLET-062 · P1 · An open dispute blocks automatic and manual payouts until resolved

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Campaign C is set up for automatic payouts, with a cleared balance, owner KYC current and one PENDING manual cashout. An open dispute was created with a signed charge.dispute.create webhook for a donation on C (WALLET-059).

**Steps:**

1. Trigger or await the automatic payout for C, and check the payout decision and reason.
2. As owner, request a new cashout (bank or 'Ujimora Wallet'). As admin, try to approve the existing PENDING payout.
3. Send charge.dispute.resolve for the case, then trigger the automatic payout again.
4. Resolve the dispute in Admin -> Disputes, then trigger the automatic payout again.

**Expect:** Step 1: while the dispute is open, the automatic payout is skipped with 'Campaign has an unresolved dispute.' Step 2: both the request and the approval return 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' No reservation, transfer or wallet credit happens. Step 3: the case moves to under_review, and payouts stay paused. Step 4: after staff resolve it, the payout proceeds normally.

**Needs:** Paystack test transfers; Paystack test secret

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`

## WALLET-065 · P1 · Reconciliation sweep configuration, manual triggers and overlap safety

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with PAYMENTS_RECONCILIATION_ENABLED=true and NODE_ENV=production (or RECONCILIATION_SCHEDULER_ENABLED=true). Admin and normal-user JWTs.

**Steps:**

1. Watch the API logs over 15 minutes for the 5-minute sweep: wallet top-ups, payments, subscription checkouts, payouts, affiliate maturity and crypto.
2. As admin, POST /api/v1/admin/reconciliation {olderThanMinutes:0, limit:10} and read the summary. Then send limit 5000.
3. As admin, POST /api/v1/admin/reconciliation/payouts.
4. As admin, POST /api/v1/admin/reconciliation/topups.
5. As a normal user, repeat steps 2-4. With no token, repeat step 4.
6. Set RECONCILIATION_SCHEDULER_ENABLED=false (then, separately, PAYMENTS_RECONCILIATION_ENABLED=false), redeploy, and watch the logs. On a non-production NODE_ENV with RECONCILIATION_SCHEDULER_ENABLED unset, confirm that no sweep runs.

**Expect:** The sweep runs every 5 minutes without overlap. 'reconciliation sweep still running; skipping this tick' appears only when there is a backlog. Step 2 returns {scanned, repaired, failed, expired, mismatched, pending, skipped, tipsRepaired, tipsSettled, tipsFailed}, and a limit above 500 is capped at 500. Step 3 returns a payout summary. Step 4 returns {scanned, completed, failed} for wallet top-ups. Step 5: 403 for the normal user and 401 without a token. Step 6: no sweeps run when either flag is off, or outside production unless the scheduler is opted in. Known open issue I036: the admin console still has no buttons for these sweeps, so staff must run them through the API.

**Needs:** Staging env access

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `render.yaml`

## WALLET-068 · P1 · Campaign raised total and balance buckets match the ledger

*Surfaces:* api, web  ·  *Type:* functional

**Before:** QA campaigns after donations, partial and full refunds, and payouts.

**Steps:**

1. For each campaign, compute Σ journallines accountKind 'campaign', accountOwnerId = campaignId (debits minus credits).
2. Compare it with campaigns.raisedAmount.
3. Open the owner cashout breakdown and look for a 'Difference awaiting reconciliation' row.
4. Check that the net proceeds equal pending + available + paid out + payout fees + held for refund + reserved.

**Expect:** The ledger total equals raisedAmount. There is no 'Difference awaiting reconciliation' row. The bucket identity holds to the pesewa.

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLedgerRepository.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/api/src/application/use-cases/GetCampaignPayoutOptionsUseCase.ts`, `packages/types/src/payout.ts`

## WALLET-069 · P1 · Admin wallet oversight: balances and transactions

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin and normal-user accounts. Several members with wallet activity.

**Steps:**

1. Open Admin -> Wallets. Check 'Wallet balances' (member name link, type, GHS balance) and 'Wallet transactions' (type, status chip, reference, amount, date, 'View member').
2. Change the page size, paginate, click Refresh, and export both sections.
3. Open /users/<id> and check that WalletActivity shows only that member.
4. Call GET /api/v1/admin/wallets?userId=bad, then ?pageSize=101.
5. As a normal user, call GET /api/v1/admin/wallets/transactions.
6. Compare the admin balances with each member's /wallet.

**Expect:** Values match the members' own views. A deleted user shows as 'Former member'. Transaction items have no metadata or provider fields. Responses carry Cache-Control 'private, no-store'. The bad inputs return 400 'Invalid pagination or member filter'. The normal user gets 403.

**Needs:** Admin account

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminWalletRoutes.ts`, `apps/admin/src/components/WalletActivity.tsx`, `apps/admin/src/pages/WalletsPage.tsx`, `apps/admin/src/pages/UserDetailPage.tsx`

## WALLET-070 · P1 · Refund uniqueness index migration runs before release

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** A restored copy of the production DB, and an operator shell with MONGODB_URI.

**Steps:**

1. In apps/api, run: npx tsx scripts/migrate-refund-index.ts
2. Run db.refunds.getIndexes() and check donationId_1.
3. Run the migration again.
4. In a scratch copy, seed two refunds with the same donationId and run it.

**Expect:** donationId_1 is unique. The re-run is a no-op. With duplicates, the migration fails with an error, deletes nothing, and leaves prepareUnique in place. Add this step to the deploy runbook, because render.yaml does not run it.

**Needs:** MongoDB admin access to a DB copy

**Source:** `apps/api/scripts/migrate-refund-index.ts`, `apps/api/src/infrastructure/database/migrations/refundDonationUnique.ts`, `render.yaml`

## WALLET-071 · P1 · Account deletion is blocked while the wallet holds a balance

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** A donor with a GHS 25.00 wallet balance and no other money balances or open payouts.

**Steps:**

1. On web, open Settings -> Delete account and read the dialog. In DevTools, note the GET /api/v1/profile/closure-check response.
2. Open Settings -> Delete account in the iOS and Android apps and read the messages.
3. Send DELETE /api/v1/profile with the correct password via the API.
4. Spend the balance to 0.00 with a wallet donation. Reopen the dialog and delete the account with the password.
5. As admin, open Wallets and look for that member.

**Expect:** Steps 1-2: after 'Checking your balances and campaigns…', web and both apps show 'Your account can’t be closed yet. First withdraw or resolve: GHS 25.00 in your Ujimora wallet. If you can’t, contact support@ujimora.com and we’ll help you close your account.' There is no password field and the delete button is disabled. closure-check returns canClose:false with the same message. Step 3: 409 with the same message and errors.accountClosure ['wallet_balance']. Nothing is erased. Step 4: deletion succeeds once the balance is 0.00. Step 5: the wallet row remains and is traceable as 'Former member', with balance 0.00.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`

## WALLET-075 · P1 · Web session expires during the Paystack top-up

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A web session that can be expired (sign out in another tab, or wait for token expiry).

**Steps:**

1. Start a 15.00 top-up and reach the Paystack page.
2. Sign out in another tab.
3. Complete the payment; Paystack returns to /wallet?reference=wtop-....
4. Read the prompt, then sign in again.

**Expect:** 'Your session has expired' (or the sign-in prompt) appears. After sign-in the user lands back on /wallet with the reference and sees 'Your wallet has been funded.' The credit is not lost and happens only once (the webhook may already have credited it).

**Needs:** Paystack test keys and webhook

**Source:** `apps/web/src/components/auth/RequireAuth.tsx`, `apps/web/src/pages/WalletPage.tsx`

## WALLET-N002 · P1 · Admin Payments page: payment lookup, timeline and confirmed refund dialog

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Three settled Paystack donations (with known references and donor emails), one pending and one failed intent. An admin with DONATIONS update permission and a read-only staff role. Paystack test keys.

**Steps:**

1. Open Admin -> Payments (/payments). Search by provider reference, then by exact donor email, then by campaign ID with status 'failed', then by provider 'wallet'.
2. Click 'View timeline' on a settled donation. Check the amount (plus any 'platform tip'), the status, provider and method chips, the contribution id and reference, the campaign link, the donor email, and the attempt timeline. Open the copied ?id= URL in a new tab, and open /payments?ref=<reference>.
3. Open the timeline of the pending or failed intent.
4. On the settled donation, click 'Refund payment' and read the warning. Clear the amount, then enter more than the contribution, then the full amount, and leave the confirmation unticked.
5. Tick 'I have checked this refund is approved and the amount is correct.' and double-click the 'Refund GH₵…' button.
6. On a second settled donation, refund a partial amount. On a third, cut the network during submit, restore it, and click the refund button again in the same dialog.
7. As the read-only role, open a settled payment.

**Expect:** Step 1: results read '<n> most recent matches' (at most 50) and include pending and failed payments. A search with no match shows 'No payments match.' Step 2: both deep links open the same timeline, and ?ref= runs the search. Step 3: there is no 'Refund payment' button, and the page says 'Only a settled or partly refunded payment can be refunded.' Step 4: the submit button stays disabled. The helper reads 'Enter an amount above 0 and up to <amount>' and, for the full amount, 'Full campaign amount'. Step 5: exactly one POST /api/v1/admin/payments/<id>/refund is sent and one Paystack refund is created. The dialog shows 'Refund of GH₵… confirmed by the provider (reference …).' If Paystack is still processing, it shows 'The provider is still processing this refund. Follow it in Refund recovery; do not submit it again.' The timeline then shows the refunded status. Step 6: the partial refund shows 'Partial refund' and ends PARTIALLY_REFUNDED. After the network error the dialog says 'Retrying reuses this request, so the donor cannot be refunded twice.', and the retry sends the same idempotency key, so Paystack shows one refund. Step 7: 'Refund payment' is disabled.

**Needs:** Paystack test keys; admin accounts

**Source:** `apps/admin/src/pages/PaymentsPage.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/admin/src/router.tsx`

## WALLET-N003 · P1 · Provider payment events API: list and acknowledge chargebacks and external refunds

*Surfaces:* api  ·  *Type:* functional

**Before:** Provider events recorded from WALLET-055, WALLET-059 and WALLET-060, plus a signed refund.processed for a tip- or sub- reference. Admin and normal-user JWTs.

**Steps:**

1. As admin, GET /api/v1/admin/payments/provider-events, then ?status=open, then ?limit=500.
2. Inspect each item's fields.
3. POST /api/v1/admin/payments/provider-events/<id>/acknowledge. Repeat it, then call it with the id 'abc'.
4. GET /api/v1/admin/payments/provider-events?status=acknowledged.
5. As a normal user, call both endpoints. With no token, call the list.
6. Replay one of the signed webhooks and list again.

**Expect:** Step 1: events are listed newest first, with at most 200 per call (larger limits are capped). Each item has provider, event, kind (dispute or refund), reference, subject (donation, tip, subscription, wallet_topup or unknown), campaignId where known, amountMinor, currency, providerStatus and reviewStatus 'open'. Step 2: no donor email, card or bank details are present. Step 3: the first call returns {id, reviewStatus:'acknowledged'}. The repeat returns 404 'Provider event not found or already acknowledged', and 'abc' returns 404 'Provider event not found'. Step 4 lists the event with acknowledgedBy and acknowledgedAt. Step 5: 403 for the normal user and 401 without a token. Step 6: no duplicate row is added. Known open issue I009: there is no admin console page or Action Center count for these events yet, so staff must poll the API.

**Needs:** Paystack test secret

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoProviderPaymentEventRepository.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`

## WALLET-N004 · P1 · Android top-up recovery: 'Start a new payment' after 15 minutes and failed top-up re-check on return

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android internal-track build, signed in. Paystack test keys, a declining test card and a success card.

**Steps:**

1. Start a 20.00 top-up, open checkout, and close the Custom Tab without paying. Keep the PaymentStatus card open and check it at 5 and at 16 minutes.
2. Tap 'Start a new payment' and start another 20.00 top-up.
3. In a separate run, start a 15.00 top-up and pay with the declining card. Without closing the Custom Tab, switch to the app until the card shows 'Payment was not completed'.
4. Switch back to the Custom Tab, retry with the success card, then return to the app within 30 minutes.
5. Check wallettopups, the wallet balance and the Paystack dashboard.

**Expect:** Step 1: at 5 minutes the card shows only 'Open secure checkout' and 'Check status'. After 15 minutes it adds 'Still not confirmed? If you already paid, don't pay again: that payment will still be confirmed once the provider reports it.' and a 'Start a new payment' button. Step 2: the new top-up gets a new wtop- reference. The first top-up stays pending, is never credited unless paid, and fails once it is 24 hours old. Step 4: on returning to the app, the failed top-up is re-checked, and the card changes to 'Wallet funded' with 'Status: completed'. Step 5: each paid top-up is credited exactly once.

**Needs:** Android device; Paystack test keys

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/components/WalletFunding.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## WALLET-N006 · P1 · Donation history shows refund and dispute states, and refund intake refuses settled cases

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Donor A has four Paystack donations. One was fully refunded by staff with no donor request (WALLET-045). One was partially refunded (WALLET-046). One has an intent seeded to REFUND_PENDING or DISPUTED on staging. One has a donor request that staff declined.

**Steps:**

1. Open web /donations. Read each row's status chip and action column. Use the status filters 'Partially refunded' and 'Refunded'.
2. Check 'Total Donated' and 'Average Donation' against the rows.
3. Open mobile My Donations on iOS and Android and compare the chips.
4. POST /api/v1/refunds for each of the four donations.

**Expect:** Step 1: the web chips read 'Refunded', 'Partially refunded', 'Refund in progress' or 'Disputed', matching each intent. None of these rows offers 'Request Refund'. The row with the declined request shows 'Refund requested'. Each filter returns only matching rows. Step 2: fully refunded gifts are excluded from both figures. Step 3: mobile shows the same labels. Step 4: 409 'This donation has already been refunded' for the fully refunded gift. 409 'This donation already has a refund or dispute in progress' for the partially refunded and the REFUND_PENDING or DISPUTED gifts. 409 'Refund already requested for this donation' for the gift with the declined request.

**Needs:** Paystack test keys; MongoDB write access (staging)

**Source:** `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationPaymentStateRead.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/mobile/app/my-donations.tsx`

## WALLET-N008 · P1 · Reject or cancel a PENDING Ujimora Wallet cashout

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Campaign C owner O has two PENDING 'Ujimora Wallet' cashout requests (WALLET-035 step 1). At least one of them cleared funds from pending to available. Admin account and a second, non-owner user.

**Steps:**

1. Note campaignbalances (pending, available) and O's wallet balance.
2. As admin, open Payouts and find the first 'Ujimora Wallet' request. Open 'Reject request' and type a 19-character reason. Then type a reason of 20 or more characters and click 'Reject payout'.
3. Approve the rejected payout via POST /api/v1/payouts/<id>/approve with a review note, then reject it again.
4. As O, open the campaign's 'Cashout & payout history' and read the rejected entry.
5. On the second request, click 'Cancel request', then 'Keep request'. Then click 'Cancel request' again and confirm with 'Cancel request'.
6. As the other user, POST /api/v1/campaigns/C/payouts/<id>/cancel. As O, cancel a payout id that belongs to another campaign.
7. Check campaignbalances, O's wallet, wallettransactions and the audit log.

**Expect:** Step 2: 'Reject payout' stays disabled under 20 characters. After rejecting, the notice reads 'Payout request rejected. The organizer can see the reason; no transfer was sent.' The row shows 'Rejected' and the 'Rejection reason'. Step 3: the approval returns 409 'Payout cannot be approved in state FAILED'. The second reject returns 409 'Payout is no longer pending; refresh before trying again.' Step 4: O sees 'Rejected' and 'The admin team rejected this request: <reason> Nothing was sent, and the amount is back in your campaign balance.' Step 5: after confirming, the entry shows 'Cancelled' and 'You cancelled this request. Nothing was sent, and the amount is back in your campaign balance.' Step 6: 403 'Only the campaign owner can cancel this payout request', then 404 'Payout not found'. Step 7: both payouts are FAILED with a closure record. The amount each request cleared moves from available back to pending exactly once. O's wallet has no credit, and no wallet-payout:<id> row exists. Each closure has one audit entry.

**Needs:** Admin account

**Source:** `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`

## WALLET-N010 · P1 · A backlog of unresolvable pending intents cannot starve repair of a newer paid one

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Staging with reconciliation enabled, a script that creates many unpaid guest Paystack checkouts, the webhook pointed at a dead URL, and an admin JWT.

**Steps:**

1. Create 150 unpaid guest Paystack intents and wait until they are older than 30 minutes.
2. Make one more donation, pay it, and let its webhook be lost.
3. Once it is older than 30 minutes, POST /api/v1/admin/reconciliation {limit:100} twice (or wait for two scheduled sweeps).
4. Check the paid intent, the reconciledAt stamps on the backlog, and both summaries.

**Expect:** The paid intent is SUCCEEDED and credited once within two sweeps, even though 150 older unpaid intents are ahead of it. Each visited row gets a reconciledAt stamp, so the next sweep starts with rows it has not checked yet. The unpaid backlog stays PENDING while under 24 hours old. No sweep scans more than 500 rows.

**Needs:** Paystack test keys; ability to change the webhook URL

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/infrastructure/database/models/DonationIntentModel.ts`

## WALLET-015 · P2 · A member without a wallet record is handled safely

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** A test user whose wallets document was deleted in staging (simulates legacy or seeded accounts).

**Steps:**

1. Sign in as that user and open /wallet.
2. Open an active campaign -> 'Donate with wallet', enter 5 and click 'Confirm Donation'.
3. Check donationintents, wallettransactions and the campaign raised amount.

**Expect:** The wallet page shows the EmptyState 'Your wallet is getting ready'. The donation fails with 'No wallet found for this currency'. The intent is FAILED, no donation or journal is created, and the campaign total is unchanged.

**Needs:** MongoDB write access (staging only)

**Source:** `apps/web/src/pages/WalletPage.tsx`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## WALLET-019 · P2 · Android top-up amount validation

*Surfaces:* android  ·  *Type:* negative/edge

**Before:** Android device. Top-ups enabled.

**Steps:**

1. Open Profile -> Wallet -> 'Fund your wallet' and read the helper line under 'Top-up amount (GHS)'.
2. Enter each of 0, 0.50, 0.99, 10000.01, 12.345, 1,000 and 'abc'. Check the 'Fund wallet' button state each time.
3. Enter 1, then 10000, then 12,50 (decimal comma). Check the button state each time.
4. With 12,50 entered, tap 'Fund wallet'. Check the amount on the Paystack page, then cancel.

**Expect:** The helper reads 'GHS 1–10,000, at most two decimals.' Step 2: 'Fund wallet' is disabled for every value: below GHS 1, above 10,000, more than two decimals, the grouped '1,000', or non-numeric. No request is sent and no top-up record is created. Step 3: the button is enabled for 1, 10000 and 12,50. Step 4: Paystack shows GHS 12.50, and the wallettopups row has amountMinor 1250.

**Needs:** None

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/src/lib/moneyInput.ts`

## WALLET-022 · P2 · Mobile wallet amounts, signs and currency display

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** Donor with GHS balance 1234.50 and deposit plus donation history. In staging, also add a FOREIGN USD wallet with balance 10 via the DB.

**Steps:**

1. Open Profile -> Wallet.
2. Check the balance card label, its main figure and the secondary '+' lines.
3. Check the 'My Wallets' cards.
4. Check the 'Recent Activity' signs, amounts and row count.

**Expect:** The balance card is labelled 'Balance' (not 'Total Balance') and shows GH₵1,234.50 for the GHS wallet. The USD wallet appears as a separate '+' line in its own currency (for example 'US$10.00'). It is never shown in GH₵ and never added to the GHS figure. 'My Wallets' cards show the currency code and a two-decimal amount (1,234.50 and 10.00). In Recent Activity, deposits show a green '+' and donations show '−', each in the transaction's own currency with two decimals. There are at most 30 rows.

**Needs:** MongoDB write access (staging)

**Source:** `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/src/lib/money.ts`, `apps/mobile/src/hooks/useWallet.ts`

## WALLET-034 · P2 · Transaction history ordering, paging, signs and limits

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** A user with more than 55 wallet transactions (seed with small top-ups and donations), including some rows with the same createdAt.

**Steps:**

1. Open /wallet and count the history rows. Check the sign and colour of the amounts.
2. Click 'Load older transactions' until the button disappears. Note the row count after each click, and compare against the DB for duplicates or gaps.
3. Open Android Wallet -> Recent Activity and count the rows.
4. Call GET /api/v1/wallets/transactions?limit=500, then ?limit=2, then ?limit=2&before=<ISO createdAt of the last row>_<its id>, then ?before=garbage.
5. Check each row's type, status and reference against the DB.

**Expect:** Rows are newest first, ordered by createdAt, then id. The web shows the first 50. 'Load older transactions' appends the next page, with no duplicate or missing rows, including rows that share a timestamp. The button disappears once a page returns fewer than 50 rows. Amounts are signed: deposits show '+' in the brand colour and donations '−' in the error colour. Android shows 30 rows, with no paging. The API returns at most 200 rows. The before cursor returns the next older page with no overlap. An invalid cursor returns 400 'Invalid transactions cursor'. References match their sources (wtop-..., donation-intent:..., wallet-payout:..., wallet-creator:...).

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/WalletController.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletTransactionRepository.ts`, `apps/web/src/pages/WalletPage.tsx`, `apps/web/src/lib/walletHistory.ts`

## WALLET-058 · P2 · Subscription charge refund claws back the affiliate commission once

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** A web Paystack subscription (sub- reference) bought through an affiliate referral code, with the commission recorded.

**Steps:**

1. Refund the subscription charge in the Paystack dashboard.
2. Confirm the refund.processed webhook (transaction_reference sub-...) was received.
3. Replay the signed webhook.
4. Check the affiliate commission status and the affiliate dashboard.

**Expect:** The commission is reversed exactly once. The replay has no effect.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`

## WALLET-073 · P2 · Wallet and refund activity alerts (opt-in inbox and email)

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** Resend configured with a verified sender. A donor with a verified email.

**Steps:**

1. In Settings, opt in to Wallet activity (in-app and email) and Refunds (in-app and email).
2. Top up 5.00.
3. Submit a refund request.
4. Opt out of wallet email, then top up again.
5. Check the notification inbox and the mailbox.

**Expect:** 'Wallet deposit: completed' ('Your wallet deposit of GHS 5.00 is completed…', links to /wallet) and 'Your refund is pending' arrive once each in the inbox and by email. After opting out, no email is sent for the next top-up. There are no duplicates across worker retries.

**Needs:** Resend email provider

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/compliance/ACTIVITY_ALERTS.md`

## WALLET-074 · P2 · Top-up abuse and per-client rate limiting

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A test user and a scripted client calling the staging API directly. Access to a second network (different public IP).

**Steps:**

1. Send 30 POST /api/v1/wallets/topups requests with distinct keys and amount 10,000 within 1 minute.
2. Check the response codes, the X-RateLimit-Remaining header, the wallettopups count and the number of Paystack transactions.
3. From the same client, keep sending /api/v1 requests until more than 300 have been sent within 15 minutes. Then add a forged 'X-Forwarded-For: 203.0.113.9' header and retry.
4. From the second network, send one request as the same user.
5. Check monitoring and alerting.

**Expect:** Step 1: all 30 are accepted. The general API limit is 300 requests per 15 minutes per client IP, taken from CF-Connecting-IP (IPv6 grouped by /64). Each request creates one pending top-up, and nothing is credited without a verified payment. Step 3: request 301 returns 429 'Too many requests, please try again later' with a Retry-After header. The forged X-Forwarded-For does not give a fresh bucket. Step 4: the other client is not limited. Known open issue I088: there is no per-user top-up velocity limit or KYC threshold (GHS 10,000 per top-up, unlimited count). This needs a product decision.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/walletRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## WALLET-N011 · P2 · Mobile Wallet screen refresh and error states

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** A signed-in donor with a GHS wallet. The ability to toggle airplane mode.

**Steps:**

1. Cold-launch the app in airplane mode and open Profile -> Wallet.
2. Turn the network back on and tap 'Try again'.
3. With the screen loaded, turn airplane mode on and pull down to refresh.
4. Turn the network back on and pull down again.
5. Top up (Android in-app, or iOS via the website), switch to another tab, then return to Wallet.

**Expect:** Step 1: 'Couldn't load wallet' with the error and a 'Try again' button. Step 2: the balance and activity load. Step 3: the loaded balance stays on screen, with an inline message 'Couldn't refresh your wallet: <error> Pull down to try again.' Step 4: the message clears and the data updates. Step 5: returning to the Wallet tab reloads the balance and activity without restarting the app.

**Needs:** None

**Source:** `apps/mobile/src/hooks/useWallet.ts`, `apps/mobile/app/(tabs)/wallet.tsx`
