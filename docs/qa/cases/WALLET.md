# Wallet, ledger & refunds (75 cases)

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

## WALLET-011 · P0 · Status polling while checkout is open must not report failure early

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Android internal-track build, signed in. Paystack test keys.

**Steps:**

1. Open Profile -> Wallet -> 'Fund your wallet', enter 25 and tap 'Fund wallet'.
2. Leave the Paystack Custom Tab open without paying for about 20 s. Switch back to the app briefly so PaymentStatus polls /wallets/topups/:ref.
3. Note the app state and the WalletTopUp status in the DB.
4. Return to the tab and complete payment.
5. Watch the app and the wallet balance.

**Expect:** Before payment the app shows 'Awaiting payment confirmation', not 'Payment was not completed' or 'Try again'. After payment it shows 'Wallet funded' and the wallet is credited 25.00 once. Code review suggests WalletTopUpService.settle marks Paystack's 'abandoned' status (unpaid checkout) as failed, so the app may stop polling and invite a second payment. The webhook still credits because failed->completed is allowed. If the premature failure appears, treat it as a launch blocker.

**Needs:** Paystack test keys and webhook; Android device

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## WALLET-012 · P0 · Reconciliation sweep repairs a missed top-up webhook

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Staging with NODE_ENV=production and PAYMENTS_RECONCILIATION_ENABLED=true. Access to the Paystack test dashboard to change the webhook URL.

**Steps:**

1. Point the Paystack test webhook URL at a dead endpoint.
2. Start a 12.00 top-up (API or Android), pay, then force-quit the app immediately (or close the web tab before redirect) so no status call happens.
3. Separately, start a 7.00 top-up and never pay.
4. Wait 11 minutes, then check the API logs and the wallettopups and wallets collections.
5. Restore the webhook URL.

**Expect:** Within about 10 minutes, the paid 12.00 top-up is completed and the wallet is credited once by the sweep. The unpaid 7.00 top-up is marked failed and not credited. No 'wallet top-up reconciliation failed' errors appear. A failed-then-paid top-up is NOT retried by the sweep, which only picks 'pending'; record this as a known gap.

**Needs:** Paystack test keys; ability to change the webhook URL

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

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

## WALLET-020 · P0 · iOS wallet funding opens Safari with no in-app payment

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iPhone with the TestFlight build. Donor signed in to the app. Paystack test keys on staging web.

**Steps:**

1. Open Profile -> Wallet.
2. Check the 'Fund your wallet' card: copy 'Wallet top-ups are made on the Ujimora website...' and a 'Continue in browser' button, with no amount field and no Paystack.
3. Tap 'Continue in browser'.
4. Confirm it opens Safari itself (not an in-app browser sheet) at https://app.ujimora.com/wallet.
5. Sign in on the web, top up 10.00 and return to the app.
6. Check the balance. If it is stale, leave the Wallet screen and come back; if still stale, force-quit and reopen.
7. With Safari restricted or the URL failing to open, tap the button again.

**Expect:** No payment is collected inside the iOS app (App Review 3.2.1(vi)/3.2.2). The web top-up credits 10.00. The app shows the new balance after a refresh. The wallet screen has no refresh on focus or pull; how the donor sees the new balance must be recorded, and a stale balance is a P1 UX defect. If opening fails, the app shows 'Could not open the Ujimora website. Please try again.'

**Needs:** iOS TestFlight build; Paystack test keys

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`

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

1. Open 'Donate with wallet', enter 20.00 and click 'Confirm Donation'.
2. In DevTools Network, right-click POST /api/v1/campaigns/<id>/donate -> 'Replay XHR' (or copy as cURL and run it again).
3. In a second run, set throttling to Offline right after the request is sent, restore the network, and click 'Confirm Donation' again after the error.
4. Check the wallet balance, donations count and wallettransactions.

**Expect:** A retried submission of the same donation is de-duplicated: one debit, one donation. Code review indicates the legacy endpoint generates a new idempotency key per request (legacy-wallet:<donor>:<uuid>) and the web client sends no Idempotency-Key, so a replay or retry creates a second donation and a second 20.00 debit. Treat this as a launch blocker unless the web moves to /donation-intents with a stable key.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`

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

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Donor A has a Paystack donation settled today.

**Steps:**

1. Open /donations and click 'Request Refund' on that row.
2. On /donations/refund/<donationId>, check 'Donation Details' (Campaign, Amount, Date, Payment Method) and the 'Refund Policy' notice.
3. Choose 'Reason for Refund' = 'Duplicate donation', add a Description, submit, and confirm in the dialog.
4. Read the success screen, then click 'View My Refunds'.
5. In the DB, check refunds and campaignbalances.

**Expect:** The notice says the request is free and does not approve or execute a refund. The success screen shows 'Refund Request Submitted', 'Refund ID: <id>', 'This request is pending review…' and 'Amount requested: GHS X. No fee is charged…' with X the full donation amount. /refunds lists it as Pending. The DB has fee 0, netAmount X, status pending. No money moves.

**Needs:** Paystack test keys (to create the donation)

**Source:** `apps/web/src/pages/MyDonationsPage.tsx`, `apps/web/src/pages/RefundRequestPage.tsx`, `apps/web/src/pages/MyRefundsPage.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `docs/compliance/REFUNDS_AND_FEES.md`

## WALLET-040 · P0 · Refund request authorization and not-found handling

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Donors A and B, an admin, and a guest (signed-out) Paystack donation.

**Steps:**

1. As B, POST /api/v1/refunds {donationId: A's donation}.
2. As B, open /donations/refund/<A's donationId> and click the back action.
3. As B, GET /api/v1/refunds/mine.
4. Signed out, POST /api/v1/refunds and open /refunds.
5. As admin, POST /api/v1/refunds for A's donation.
6. Check how a guest donor can ask for a refund.

**Expect:** Step 1: 404 'Donation not found'. Step 2: 'This donation was not found or is not eligible for a refund.' The back button goes to '/my-donations', which is not a web route; log this P2 defect. The page also briefly shows the not-found state before the fetch finishes. Step 3: only B's rows. Step 4: 401 or the sign-in prompt. Step 5: 404. A guest is directed to support@ujimora.com under the policy.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/application/use-cases/GetDonationUseCase.ts`, `apps/web/src/pages/RefundRequestPage.tsx`, `packages/types/src/legal.ts`

## WALLET-043 · P0 · Refund of a wallet-funded donation has a defined path

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Donor A made a 20.00 wallet donation. Admin JWT.

**Steps:**

1. As A, request a refund for the wallet donation on web.
2. As admin, POST /api/v1/admin/payments/<intentId>/refund with an Idempotency-Key.
3. Check A's wallet and wallettransactions for any refund credit.
4. Check the written support procedure for wallet donations.

**Expect:** A documented, tested path returns funds, for example a wallet credit of type refund with a compensating journal, or an approved manual procedure. Code review indicates wallet intents have no providerRef and 'wallet' is not in the refund gateway registry, so the admin call returns 400 'Contribution has no provider reference to refund' (or 501), and nothing writes wallet refund credits. The donor's request would then stay pending forever. This needs a launch decision.

**Needs:** Admin account

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/app.ts`, `packages/types/src/wallet.ts`, `apps/web/src/pages/MyDonationsPage.tsx`

## WALLET-044 · P0 · Donor-visible state after a refund is executed

*Surfaces:* android, api, email, ios, web  ·  *Type:* compliance

**Before:** Donor A submitted a request (WALLET-038). The admin then executed the provider refund (WALLET-045). A has opted in to refund alerts.

**Steps:**

1. As A, open /refunds and the mobile My Refunds screen.
2. Open /donations with the status filter 'Refunded'.
3. Open the campaign's public Donations tab.
4. Check the in-app inbox and email for a refund status change.

**Expect:** The request shows Completed, the donation shows Refunded and is excluded from 'total donated', the campaign raised total is reduced, and the donor is notified. Code review indicates intake (refunds) and execution (refundoperations) are not linked and ListMyDonations always returns 'completed', so the request stays Pending and the donation stays Completed. This is P0 for donor communication (C14).

**Needs:** Paystack test keys; Resend for email

**Source:** `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`, `apps/api/src/application/use-cases/ListMyRefundsUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `docs/compliance/REFUNDS_AND_FEES.md`

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

*Surfaces:* api  ·  *Type:* compliance

**Before:** A settled test donation. Access to the Paystack test dashboard.

**Steps:**

1. Refund the donation from the Paystack dashboard, not through Ujimora.
2. Confirm that Paystack sends refund.processed (transaction_reference = donation reference) and the API answers 200.
3. Check the intent status, campaign raised, campaignbalances and the owner cashout eligibility.

**Expect:** Target: Ujimora detects the external refund and reverses or holds the campaign funds, or staff have a written rule never to refund from the dashboard plus a reconciliation check. Code review indicates handleRefund only acts on sub- references, so the campaign still shows the funds and can pay them out. Document the operational control before launch.

**Needs:** Paystack test dashboard

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## WALLET-059 · P0 · Chargeback (dispute) on a donation

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** A settled donation reference and the Paystack test secret for signing.

**Steps:**

1. POST a signed {event:'charge.dispute.create', data:{reference:<donation ref>, ...}} to /api/v1/webhooks/paystack (or raise a test dispute in Paystack if available).
2. Check the intent status, campaignbalances, the Admin Disputes queue and payout eligibility.

**Expect:** Target: the dispute is recorded (intent DISPUTED), the campaign funds are held from payout, and staff are alerted. Code review indicates the event is ignored (200 acknowledgement with no change) and the DISPUTED/CHARGEBACK statuses are unused. Before launch you need a written chargeback process: watch the Paystack dashboard, place a manual payout hold, and claw back.

**Needs:** Paystack test secret

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/domain/entities/DonationIntent.ts`, `packages/types/src/donation-intent.ts`

## WALLET-060 · P0 · Chargeback or reversal of a wallet top-up after the funds are spent

*Surfaces:* api  ·  *Type:* compliance

**Before:** A donor topped up 100 and donated the full 100 with the wallet.

**Steps:**

1. Send a signed charge.dispute.create for the wtop- reference (or record a Paystack reversal).
2. Check the wallet balance, wallettopups status and any alert.

**Expect:** Target: a defined recovery (a negative balance, an account hold, or a staff alert). Code review indicates settle() returns early for completed top-ups and no path debits the wallet, so the platform absorbs the loss. Write the risk policy and monitoring down before launch.

**Needs:** Paystack test secret

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## WALLET-063 · P0 · Missed donation webhook repaired by manual reconcile and by the sweep

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with NODE_ENV=production and reconciliation enabled. Webhook temporarily pointed at a dead URL. Admin JWT.

**Steps:**

1. Make a guest Paystack donation of 25, pay, and close the tab before /donate/callback loads.
2. GET /api/v1/admin/payments?providerRef=<ref> (expect PENDING), then GET /api/v1/admin/payments/<id> for the timeline and attempts.
3. POST /api/v1/admin/payments/<id>/reconcile, then send the same call again.
4. Leave a second paid donation for the scheduled sweep (older than 30 min, checked every 5 min).
5. Leave an unpaid intent, and a declined-card intent that holds a coupon seat.

**Expect:** Step 3: {outcome:'repaired', status:'SUCCEEDED'}, then {outcome:'skipped'}. Step 4: the sweep settles it with one journal and one raised increment. Step 5: the unpaid intent stays PENDING (abandoned is non-terminal); the declined one becomes FAILED and its coupon seat is released.

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
2. Compute Σ completed wallettransactions: deposits minus donations (and minus withdrawals, if any).
3. Compute Σ journallines where accountKind 'wallet' and accountOwnerId = walletId, credits minus debits.
4. Compare the three values.

**Expect:** All three values are equal to the pesewa. Code review indicates wallet donations post no 'wallet' debit line (the journal only has campaign/beneficiary/fee legs), so value 3 will be higher than value 1 after any wallet donation. The wallet ledger design must be decided and fixed before launch, including BoG safeguarding reconciliation (C03).

**Needs:** MongoDB read access

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/domain/entities/JournalEntry.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`

## WALLET-072 · P0 · Legal disclosures for the Ujimora Wallet

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Access to the legal pages on ujimora.com and in the apps (All policies).

**Steps:**

1. Read the Terms, Contributor & Donor Terms, and the Payout, Refund & Failed Campaign Policy.
2. Read the /wallet page copy and the mobile 'Fund your wallet' copy.
3. Check each disclosure: GHS only, GHS 1–10,000 per top-up, processor fee absorbed, no external withdrawal, how unused balances are refunded, treatment on account closure or dormancy, the operator identity, and complaints.

**Expect:** Each item is disclosed consistently and signed off by legal, with the BoG e-money/safeguarding position (READINESS C03) confirmed. Code review indicates legal.ts has no Ujimora Wallet section, so this is expected to fail until the text is added.

**Needs:** Legal review

**Source:** `packages/types/src/legal.ts`, `apps/web/src/pages/WalletPage.tsx`, `apps/mobile/src/components/WalletFunding.tsx`, `docs/compliance/READINESS.md`

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

**Before:** Staging where env can be changed. Admin account.

**Steps:**

1. Set PAYMENTS_PAYSTACK_ENABLED=false (or blank PAYSTACK_SECRET_KEY) and redeploy.
2. Open /wallet on web and Profile -> Wallet on Android.
3. POST /api/v1/wallets/topups.
4. Restore the env. In Admin -> Payment Providers, switch the Paystack gateway row off.
5. Try a web top-up, then switch the gateway back on.

**Expect:** Web shows 'Wallet funding is not configured yet.' with no amount field. Android shows 'Wallet funding is not currently available.' The API returns 503 'Wallet top-ups are not configured'. For step 5 the product must decide whether the dashboard switch stops top-ups. Code review indicates it does not (WalletTopUpService ignores the provider toggle); record the result as a defect or document it.

**Needs:** Staging env access

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/application/use-cases/TogglePaymentProviderUseCase.ts`, `apps/admin/src/pages/PaymentProvidersPage.tsx`

## WALLET-025 · P1 · No floating-point residue after wallet debits

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** A fresh donor topped up to exactly 10.00.

**Steps:**

1. Donate 9.99 with the wallet.
2. In Mongo, read the exact stored wallets.balance and compare it with the UI.
3. Donate 0.01 with the wallet.
4. Repeat with a second account: 10.00, then three donations of 3.33, then 0.01.

**Expect:** The stored balance is exactly 0.01, not 0.009999999999999787, and the 0.01 donation succeeds, leaving 0.00. Same for the second sequence. Code review indicates withdrawIfSufficient uses an unrounded $inc, so a residue and a false 'Insufficient wallet balance' are possible; if seen, log a money-accuracy defect.

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

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

1. In Admin -> Payment Providers, toggle 'Ujimora Wallet' to Disabled.
2. On the web campaign detail page, check the wallet section.
3. On the Android donate screen, check the Payment method options.
4. Donate directly via /api/v1/donation-intents provider 'wallet' and via /api/v1/campaigns/:id/donate.
5. Toggle the switch back on.

**Expect:** Target: when disabled, the web shows 'Wallet donations are not currently available.', Android hides the wallet option, and the API refuses. Code review indicates assertRailEnabled skips the wallet and the Android screen ignores the providers list, so the API and Android still accept. Log a defect, or relabel the switch as display-only.

**Needs:** Admin account

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/TogglePaymentProviderUseCase.ts`, `apps/web/src/lib/campaignDetailPolicy.ts`, `apps/mobile/app/donate/[id].tsx`

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

**Before:** A creator with at least 50 GHS available creator balance (tips made on the web; tips are unavailable in the native apps).

**Steps:**

1. On web /creator, open Withdraw, choose destination 'Ujimora Wallet', enter 50, review the fee and confirm.
2. Replay the same POST in DevTools (same idempotency key).
3. Change the creator plan fee in admin, then submit a new withdrawal from the stale dashboard.
4. Request more than the available balance.
5. Repeat a small withdrawal to the wallet from the mobile Creator page on Android and iOS.

**Expect:** Step 1 shows 'Funds added to your Ujimora Wallet'. The wallet rises by net = 50 − fee. Creator available balance falls by 50. The deposit reference is wallet-creator:<userId>:<key>. The journal has beneficiary (creator:<id>) debit 50, wallet credit net and platform_fee credit fee. Step 2 returns the same payout with no second credit. Step 3: 409 'Your withdrawal fee has changed...'. Step 4: 422 'Insufficient available creator balance'. Native works with the same rules.

**Needs:** Paystack test keys (to fund tips on web)

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/mobile/app/creator.tsx`

## WALLET-039 · P1 · Refund request validation, duplicates and concurrency

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** A donor with two eligible donations. The refunds unique index has been migrated (WALLET-070).

**Steps:**

1. Try to submit with no reason (web select empty; mobile shows 'Select a Reason').
2. POST /api/v1/refunds with reason '' , then a 201-character reason, then a 2001-character description, then no donationId.
3. Submit a valid request, then submit again for the same donation.
4. For the second donation, fire two identical POST /api/v1/refunds at the same time.

**Expect:** Step 1 is blocked in the client. Step 2 returns 400 each time. Step 3: 409 'Refund already requested for this donation'. Step 4: exactly one refunds document; the loser should get 409. Code review suggests an unmapped duplicate-key error gives 500, so log it if seen.

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/refundRoutes.ts`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`

## WALLET-041 · P1 · Refund window is consistent across web, apps, API and policy

*Surfaces:* android, api, ios, marketing, web  ·  *Type:* compliance

**Before:** Donor A has a donation backdated to 31 days old (set createdAt in the DB).

**Steps:**

1. Open web /donations and look for 'Request Refund' on that row.
2. Open My Donations on Android and iOS for the same donation.
3. POST /api/v1/refunds for it.
4. Read the Payout, Refund & Failed Campaign Policy, section 5, on ujimora.com and in the in-app refund-policy screen.

**Expect:** One rule applies everywhere and matches the published policy. Today the web hides the button after 30 days (client-side only), mobile always shows it, the API accepts (201), and the policy states no fixed window. Resolve this before launch.

**Needs:** MongoDB write access (staging)

**Source:** `apps/web/src/pages/MyDonationsPage.tsx`, `apps/mobile/app/my-donations.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `packages/types/src/legal.ts`

## WALLET-042 · P1 · Mobile refund request and My Refunds (iOS and Android)

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** A donor with an eligible donation, signed in on both devices.

**Steps:**

1. Open Profile -> My Donations and tap 'Request Refund'.
2. On the refund-request screen, check the donation details and the policy text 'Submitting a request is free…'.
3. Pick a reason radio button, enter a description and submit.
4. Read the success view ('Your refund ID is:'), then open 'My Refunds'.
5. In airplane mode, submit a request for another donation, then retry online.

**Expect:** The request is created with status pending and the refund ID is shown. My Refunds shows the campaign, the amount in the recorded currency (not hard-coded GHS), the date and the reason. Offline shows an 'Error' alert, and the retry creates exactly one request.

**Needs:** None

**Source:** `apps/mobile/app/refund-request.tsx`, `apps/mobile/app/my-refunds.tsx`, `apps/mobile/app/my-donations.tsx`

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

## WALLET-056 · P1 · Flutterwave refund attempt must not strand funds (only if Flutterwave is enabled)

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** PAYMENTS_FLUTTERWAVE_ENABLED=true with FLW test keys, and a settled Flutterwave donation.

**Steps:**

1. POST /api/v1/admin/payments/<intentId>/refund.
2. Check the response, Refund recovery and campaignbalances refundHolds.
3. Click 'Verify provider status'.

**Expect:** Target: a clean refusal before any reservation or hold. Code review indicates FlutterwaveGateway.refundPayment throws 501 after the reservation and hold commit, giving 202 PENDING_REVIEW with funds held, and verification returns 503 because fetchRefund is missing. Keep Flutterwave off at launch or fix this.

**Needs:** Flutterwave test keys (pending)

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/FlutterwaveGateway.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`

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

**Before:** Dispute documents inserted directly into the DB (no API creates disputes): one open and one under_review for campaign C. Admin and normal-user accounts.

**Steps:**

1. Open Admin -> Disputes (/disputes). Search, filter by status and export.
2. Open /disputes/<id>, enter 'Resolution notes', set Decision to 'resolved' and submit.
3. Submit a resolution again on the same dispute.
4. Via API, PUT /api/v1/disputes/<id>/resolve with an empty resolution.
5. As a normal user, GET /api/v1/disputes.
6. Check the Action Center 'Open disputes' count.

**Expect:** The list and detail show the campaign title and reporter name. Resolving sets status, resolution, resolvedBy and resolvedAt. A second resolve returns 409 'Dispute has already been resolved'. An empty resolution returns 400. The normal user gets 403. The count falls after resolution. Also record that production has no way to create disputes.

**Needs:** MongoDB write access (staging)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/disputeRoutes.ts`, `apps/api/src/application/use-cases/ResolveDisputeUseCase.ts`, `apps/admin/src/pages/DisputesPage.tsx`, `apps/admin/src/pages/DisputeDetailPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDisputeRepository.ts`

## WALLET-062 · P1 · An open dispute blocks automatic payout until resolved

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Campaign C set up for automatic payouts with a cleared balance, and an open dispute inserted for C.

**Steps:**

1. Trigger or await the automatic payout for C.
2. Check the payout decision and reason.
3. Resolve the dispute and trigger the automatic payout again.

**Expect:** While the dispute is open, the payout is skipped with 'Campaign has an unresolved dispute.' After resolution the payout proceeds normally.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`

## WALLET-065 · P1 · Reconciliation sweep configuration, manual triggers and overlap safety

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with NODE_ENV=production. Admin and normal-user JWTs.

**Steps:**

1. Watch the API logs over 15 minutes for 'payment reconciliation sweep complete' with its summary.
2. As admin, POST /api/v1/admin/reconciliation {olderThanMinutes:0, limit:10} and read the summary.
3. As admin, POST /api/v1/admin/reconciliation/payouts.
4. As a normal user, repeat steps 2-3.
5. Set PAYMENTS_RECONCILIATION_ENABLED=false, redeploy, and watch the logs.

**Expect:** The sweep runs every 5 minutes without overlap; a 'still running; skipping this tick' warning appears only under a backlog. Step 2 returns {scanned, repaired, failed, mismatched, pending, skipped, tipsRepaired}. Step 3 returns a payout summary. Step 4 gives 403. With the flag off, no sweeps run. There is no manual trigger for the wallet top-up sweep; note this.

**Needs:** Staging env access

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `render.yaml`

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

## WALLET-071 · P1 · Account deletion with a positive wallet balance

*Surfaces:* admin, android, ios, web  ·  *Type:* compliance

**Before:** A donor with a GHS 25.00 wallet balance.

**Steps:**

1. On web, open Settings -> Delete account (and the in-app Settings -> Delete account) and read every warning before confirming.
2. Confirm the deletion.
3. As admin, open Wallets and look for that member.

**Expect:** Before deletion the donor is told they have GHS 25.00 of non-withdrawable wallet funds and how to contact support. After deletion the balance is kept and traceable (shown as 'Former member'). Code review indicates the deletion flow gives no balance warning; log a compliance gap against the legal text 'Tell support about outstanding balances'.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `packages/types/src/legal.ts`

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

1. Enter each of 0, 10000.01, 12.345 and 'abc'. Check the 'Fund wallet' button state.
2. Enter 0.50 and tap 'Fund wallet'.

**Expect:** Step 1: the button is disabled for each value. Step 2: the UI allows it (the client only checks > 0), and the API error 'Enter an amount from GHS 1 to GHS 10,000 with at most two decimals' shows as an alert with a 'Retry connection' button. No top-up record is created. Suggested fix: align the client minimum to 1.

**Needs:** None

**Source:** `apps/mobile/src/components/WalletFunding.tsx`

## WALLET-022 · P2 · Mobile wallet amounts, signs and currency display

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** Donor with GHS balance 1234.50 and deposit plus donation history. In staging, also add a FOREIGN USD wallet with balance 10 via the DB.

**Steps:**

1. Open Profile -> Wallet.
2. Check 'Total Balance', the secondary '+' lines and the 'My Wallets' cards.
3. Check the 'Recent Activity' signs and amounts.

**Expect:** 'Total Balance' shows GH₵1,234.50. Deposits show a green '+' and donations show '−' with the exact amounts. The list shows at most 30 rows. The USD wallet must not be shown in GH₵ or presented as part of a GHS total. Code review indicates formatAmount always uses GHS, so log a defect if it appears.

**Needs:** MongoDB write access (staging)

**Source:** `apps/mobile/app/(tabs)/wallet.tsx`

## WALLET-034 · P2 · Transaction history ordering, completeness and limits

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** A user with more than 55 wallet transactions (seed with small top-ups and donations).

**Steps:**

1. Open /wallet and count the history rows. Look for pagination.
2. Open Android Wallet -> Recent Activity and count the rows.
3. Call GET /api/v1/wallets/transactions?limit=500.
4. Check each row's type, status and reference against the DB.

**Expect:** Rows are newest first. The web shows 50 rows and has no way to reach older history (log a P2 gap). Android shows 30. The API returns at most 200. References match their sources (wtop-..., donation-intent:..., wallet-payout:..., wallet-creator:...). The web shows amounts without a +/− direction (UX note).

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/WalletController.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletTransactionRepository.ts`, `apps/web/src/pages/WalletPage.tsx`

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

## WALLET-074 · P2 · Top-up abuse and rate limiting

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A test user and a scripted client.

**Steps:**

1. Send 30 POST /api/v1/wallets/topups requests with distinct keys and amount 10,000 within 1 minute.
2. Check the response codes, the wallettopups count and the number of Paystack transactions.
3. Check monitoring and alerting.

**Expect:** Record whether a 429 or other abuse control applies. No credit occurs without verified payment. Recommend a velocity limit and KYC threshold for top-ups: there is no cap on how many top-ups one user can make.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/walletRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`
