# Cross-cutting journeys & edge cases (177 cases)

End-to-end journeys across areas, concurrency, multi-currency, dates and time zones, provider cutover, legacy data, recovery drills.

[Back to the QA plan](../README.md)

## GAP1-001 · P0 · E2E-1: Organization signs up on web and buys a paid plan through live Paystack

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** Production API on live keys (sk_live_/pk_live_) with the live webhook set (GAP2-015), or a staging stack the owner has approved for real money. A new mailbox the tester controls. A real card in the tester's name. Admin has created a single-use percentage coupon at admin /coupons/new (per-user limit 1, total limit 1) that cuts the Organization monthly price to a small live charge (for example GHS 2.00). Otherwise, budget for the full price. Record T0 (UTC) and keep a journey sheet of every reference produced.

**Steps:**

1. In a private window open https://app.ujimora.com/register?role=organization. Confirm the stepper reads Account, Organization, Contact, Plan and the organization account type is preselected.
2. Complete Account (email, strong password), Organization (name, type from the picker, e.g. NGO / Non-profit) and Contact.
3. On Plan choose the Organization tier and Monthly, enter the coupon, tick the terms and age boxes, and submit.
4. On the Paystack page check that the amount equals the discounted price in GHS to the pesewa and the email is the org email. Record the reference, which must start with sub-.
5. Pay by card. Let Paystack redirect to /subscription/callback?checkout=<id>&reference=sub-... and wait for the success state.
6. Open /subscription. Expect tier Organization, Monthly, renewal = payment date + 30 days.
7. Open the verification email, follow the /verify-email link, then sign out and back in. The account shows as verified.
8. Admin /subscriptions: find the org and confirm base amount, discount, final amount, coupon code and SUCCEEDED status.
9. Paystack live dashboard > Transactions: find the sub- reference and record amount, fee and customer email.

**Expect:** Paystack shows exactly one successful sub- charge for the discounted amount. The subscription is activated once and the coupon shows 1 redemption. A verification email from info@ujimora.com arrives with a working https://app.ujimora.com link. There is no second pending checkout for this user. The sub- reference, checkout id and Paystack fee are recorded for GAP3-017/018.

**Needs:** Paystack live keys + live webhook; Resend (RESEND_API_KEY, verified ujimora.com domain); real card

**Source:** `apps/web/src/router.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/admin/src/router.tsx`

## GAP1-002 · P0 · E2E-2: KYB submission and staff approval unlock campaign creation

*Surfaces:* admin, api, email, web  ·  *Type:* security/permission

**Before:** GAP1-001 done. A staff account with VERIFICATIONS permission and MFA. Business registration documents as JPG/PNG/PDF under 4 MB. A second, unrelated user account.

**Steps:**

1. As the org, open /campaigns/new and try to create a campaign before KYB. Expect a 403 containing 'User cannot create more campaigns. Limit: 0, current: 0'.
2. Open /kyc. Confirm the organization form (OrganizationKYCForm) is shown, not the personal ID form, and the KYC collection notice appears before upload.
3. Fill the business details, upload the documents and submit (POST /api/v1/kyc/business). Record the status shown.
4. In DevTools confirm each stored document value is kyc://<id>, not a res.cloudinary.com URL.
5. As staff open admin /kyc-review, open every document (each is a 60-second link) and approve.
6. Admin /audit: confirm one kyc.document.access entry per document opened.
7. As the org reload /kyc and /campaigns/new. The org is verified and campaign creation is allowed.
8. Signed in as the unrelated user, call GET /api/v1/uploads/kyc/<documentId>/access.

**Expect:** Creation is blocked before approval and allowed after it. Documents stay private (authenticated delivery), every staff view is audited, and the unrelated user gets 404.

**Needs:** Cloudinary (authenticated delivery), Resend

**Source:** `apps/web/src/pages/KYCPage.tsx`, `apps/web/src/components/OrganizationKYCForm.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycBusinessRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/domain/services/currentCampaignAllowance.ts`

## GAP1-003 · P0 · E2E-3: Campaign above GHS 250,000 is held for staff review, then approved

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** GAP1-002 done. REVIEW_ALERT_EMAIL=info@ujimora.com and ADMIN_WEB_URL are set. A staff account with CAMPAIGNS permission.

**Steps:**

1. As the org, open /campaigns/new with goal GHS 300,000, a category and a cover image (uploaded through /uploads/image?folder=campaigns). Set the end date to the QA window end + 1 day, so the fee-free standard cashout can be used in GAP1-008. Submit.
2. Confirm the UI says the campaign awaits review.
3. Logged out, open /c/<slug> and /c/<slug>/donate. No donation can start.
4. Check the info@ujimora.com inbox for the 'campaign waiting for review' alert. Its link must open https://admin.ujimora.com.
5. As staff open admin /campaigns/<id>. In the review panel tick content reviewed and fundraising reviewed, add notes and approve.
6. Logged out, reload /c/<slug>. The donate button is available and the organization badge shows.
7. In admin or the DB, check the campaign: tier = 4, status active, lockedPlatformFeePercent = the Organization plan fee at creation (e.g. 2.0).

**Expect:** The campaign is PENDING_REVIEW until approval and cannot take donations while held. The alert email arrives with a working admin link. After approval it is ACTIVE, and the locked fee equals the plan fee. The approval appears in the audit log.

**Needs:** Resend; Cloudinary

**Source:** `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/domain/services/campaignApproval.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `render.yaml`

## GAP1-005 · P0 · E2E-5: Web donations by guest card, guest MoMo and wallet, with fee and total checks

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** The campaign is live. A donor account with a GHS wallet. A real card and a real MTN MoMo wallet. Use a distinct odd amount for each donation so it can be traced.

**Steps:**

1. Logged out, open /c/<slug>/donate. Enter GHS 1.11, tip 0 and an email, then pay by card. /donate/callback shows success. Record the uf- reference.
2. Logged out, donate GHS 1.23 with a GHS 0.10 tip by mobile money and approve the prompt on the phone. Record the reference.
3. As the donor open /wallet. The 'Test payments only' banner must NOT show. Top up GHS 5.00 and pay. The wallet balance rises by exactly 5.00.
4. As the donor donate GHS 2.00 using the Ujimora wallet and tap Donate twice quickly.
5. For each donation check: the donor /donations list, the org owner's donation email and the campaign raised total.
6. Admin /donations: open each payment timeline and note the platform fee, processor fee and net.

**Expect:** Raised total = 1.11 + 1.23 + 2.00 = GHS 4.34 (tips excluded). For each Paystack donation: platform fee = amount × locked plan % rounded to 2 dp; processor fee = the webhook fee; net = amount − platform fee − processor fee; the tip goes to the platform only. The wallet is debited exactly once for 2.00 even after the double tap. The top-up credits the full 5.00 and its fee is booked to the platform processor-fee account. Owner emails arrive for each donation.

**Needs:** Paystack live, Resend, MoMo phone

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/web/src/pages/WalletPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/domain/entities/JournalEntry.ts`

## GAP1-006 · P0 · E2E-6: Android in-app checkout, iOS Safari handoff and a live-session donation

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Play internal-track and TestFlight builds pointing at the production API (eas production profile). LiveKit credentials set, or accept a text-only live session. A viewer device.

**Steps:**

1. Android: open the campaign, tap Donate, enter GHS 1.31 and pay by card in the Custom Tab. Return to the app; the pending state resolves to success. Reopen the screen and confirm there is no duplicate intent.
2. Android: start GHS 1.32, close the Custom Tab without paying and return. No success is shown and the raised total does not change.
3. iOS: open the campaign, tap Support, then 'Continue in browser'. Safari opens https://app.ujimora.com/c/<slug>/donate?amount=... with no token or personal data in the URL. Pay GHS 1.41 in Safari.
4. iOS: return to the app. The note 'Returning to the app does not confirm payment' is shown, and the campaign total updates after a refresh.
5. iOS: confirm there is no in-app payment form, wallet top-up opens /wallet in Safari, and no creator-tip entry exists.
6. Web: as the org start a session at /campaigns/<id>/live ('Go live'). A viewer opens /c/<slug>/live/<sessionId> and donates GHS 1.51. The overlay or feed shows it within seconds.
7. iOS: start a donation from inside the live session in the app. The Safari URL carries ?liveSessionId=<24-hex id>.
8. Admin: the timelines of the 1.51 and iOS live donations show the liveSessionId.

**Expect:** Each paid donation settles exactly once. Abandoned attempts never raise the total. The iOS handoff carries only the amount and liveSessionId. Live donations are attributed to the session and counted in its stats.

**Needs:** Paystack live; store builds; LiveKit (optional)

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/lib/payments.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`

## GAP1-007 · P0 · E2E-7: Refund one Paystack donation and check provider, ledger and balances

*Surfaces:* admin, api, email, web  ·  *Type:* recovery/idempotency

**Before:** A card donation from GAP1-005. Run this step BEFORE any cashout request (see GAP6-033). An admin bearer token (the admin console has no refund button).

**Steps:**

1. If the donor had an account, submit /donations/refund/<donationId> and confirm /refunds shows it as pending. Note that staff have no admin list of these requests.
2. Admin: find the intent id in the admin /donations payment timeline. Call POST https://api.ujimora.com/api/v1/admin/payments/<intentId>/refund with body {"idempotencyKey":"qa-refund-1"}.
3. Record the response status: REFUNDED, PROCESSING or PENDING_REVIEW.
4. Repeat the same call with the same key, then with a different key.
5. In Paystack confirm a single refund for the full amount, and that the card receives it.
6. If the result was not REFUNDED, open admin /refund-recovery and Verify with the provider refund ID until accounting completes.
7. Check: intent status REFUNDED; raised total down by the amount; campaign refundHolds empty; a reversing journal entry exists; the donor refund email arrives.

**Expect:** Exactly one provider refund is created and no second Paystack refund is made. The campaign balance buckets and the ledger reconcile. No balance goes negative.

**Needs:** Paystack live refunds; Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/admin/src/pages/RefundOperationsPage.tsx`

## GAP1-008 · P0 · E2E-8: Bank or MoMo cashout, admin approval and the transfer webhook

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** Either the campaign end date has passed (the standard cashout is free), or the eligible balance is at least about GHS 40 (early cashout: 1%, minimum GHS 20, capped at 80%). The Paystack transfer balance is funded. A MoMo or bank account in the org's name.

**Steps:**

1. At /payout-accounts add the MoMo (mobile_money) or bank (ghipss) account. Record the name-check result (name_matched or needs_review).
2. On the owner view of the campaign, in the cashout section, pick the saved account, enter the full eligible amount, choose standard and submit. Double-click the submit button.
3. If the campaign has not ended and is below goal, standard must be refused with the early-cashout message. If the early fee is greater than or equal to the amount, expect 422 'The payout fee equals or exceeds the requested amount'.
4. Admin /payouts: open the request and approve it with a review note of at least 20 characters. If Paystack asks for an OTP, authorize it in the transfer controls.
5. Wait for transfer.success on the pout- reference, or for the 5-minute sweep. The payout becomes PAID.
6. Check money: amount received on the phone or bank = netAmount; campaign paidOutBalance up by the net; payoutFees up by the fee; availableBalance 0; a payout ledger entry exists; owner email 'Your withdrawal is paid'.

**Expect:** One payout is created despite the double click. The fee matches the published policy. The received amount equals the net to the pesewa. Balances, ledger and email are consistent.

**Needs:** Paystack live transfers + funded balance; Resend

**Source:** `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

## GAP1-010 · P0 · E2E-10: The settlement audit shows zero findings at journey close

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** At least 30 minutes after the last journey donation. A read-only Atlas user (replica set) for the production database. Node + tsx on the operator machine.

**Steps:**

1. Run: cd apps/api && MONGODB_URI=<read-only uri> npx tsx scripts/audit-donation-settlement.ts <ISO cutoff = now minus 30 min> '' 200
2. If nextCursor is not null, re-run with it as the second argument until it is null.
3. Record the exit code (0 = clean, 2 = findings, 1 = error) and the scanned count for each page.
4. Cross-check that every SUCCEEDED journey intent from GAP1-005/006 appears in a scanned range.
5. Note the 'unverified' list in the report (provider funds, refunds, projections) and confirm GAP3-017 to 021 cover it.

**Expect:** findings = [] on every page and the exit code is 0. Refunded intents are not scanned by this script, so the GAP1-007 refund must be checked in GAP3-019.

**Needs:** Atlas replica set (snapshot reads)

**Source:** `apps/api/scripts/audit-donation-settlement.ts`, `apps/api/src/infrastructure/audits/donationSettlementIntegrity.ts`

## GAP2-011 · P0 · Cutover: inventory and quarantine test-mode records before switching to live keys

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A read-only production DB user. Access to the Paystack test and live dashboards. A named cutover window with merges to main frozen (Render autoDeploy).

**Steps:**

1. Export counts and ids of test-mode artefacts: payoutaccounts with recipientCode, transferrecipients, beneficiary_recipients, affiliates with recipientCode, non-terminal creator_payouts, payouts in PENDING/PROCESSING/NEEDS_REVIEW, donationintents in CREATED/PENDING with providerRef, wallettopups in pending, pending subscription checkouts, PENDING tips.
2. Spot-check recipient codes in the Paystack TEST dashboard (Transfers > Recipients); they exist only there.
3. Decide per collection whether to close, delete (saved payout accounts) or keep, and write the decision in the launch log.
4. Confirm no campaign, wallet, creator or affiliate balance funded by test charges remains payable after the switch (zero it or delete the test users and campaigns).
5. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY to live values together in Render and redeploy.
6. Call GET /api/v1/wallets/topups/config. Expect mode 'live'.

**Expect:** A signed inventory with zero unexplained test-mode rows. No test-funded balance can be paid out with live money. Both keys come from the live environment.

**Needs:** Paystack test + live dashboards; Render

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/infrastructure/database/models/TransferRecipientModel.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/app.ts`, `render.yaml`

## GAP2-012 · P0 · Cutover: sweeps after the switch never credit test references and are not starved

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Staging with NODE_ENV=production and PAYMENTS_RECONCILIATION_ENABLED=true. On keys A (test), create 3 abandoned Paystack donation intents, 2 unpaid wallet top-ups and 1 payout left PROCESSING (webhook blocked). Then switch staging to keys B (a different Paystack business or environment) to simulate the cutover. Access to Render logs.

**Steps:**

1. Wait for at least two 5-minute sweep cycles (the intents must be more than 30 minutes old).
2. Logs: expect 'reconcile: provider verification failed (transient)' for each intent and 'payout reconciliation: verify failed' for the payout.
3. DB: intents still PENDING (not SUCCEEDED or FAILED). Top-ups still pending, with updatedAt bumped each sweep. The payout still PROCESSING with its amount still out of availableBalance. No new journal entries.
4. Starvation: create 101 or more PENDING intents with unknown references, all older than 30 minutes.
5. Make one keys-B donation, suppress its webhook and do not open /donate/callback. Wait 40 minutes and check whether the sweep repaired it.
6. Quarantine the unknown intents (mark EXPIRED or FAILED with a note) and repeat the previous step.

**Expect:** No test record is ever credited or failed incorrectly. A live intent with a missed webhook is repaired within about 35 minutes. Per the source, findStalePending takes the 100 oldest by updatedAt and nothing updates an intent that stays unresolved, so the step with 101+ unknown intents is expected to FAIL. Treat that as a blocker: quarantine before launch, and note that abandoned live checkouts pile up the same way. A single payout stuck in PROCESSING is never escalated. Define a manual release for it.

**Needs:** Two Paystack key sets (test)

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## GAP2-013 · P0 · Cutover: campaign cashout to a saved payout account created under test keys

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging. Before the switch, the organizer added a MoMo account at /payout-accounts and registered it on a campaign that has an eligible balance.

**Steps:**

1. Switch staging to keys B.
2. The organizer requests a cashout and an admin approves it at /payouts.
3. Observe that the provider rejects the recipient. The payout becomes FAILED and the amount returns to availableBalance (not stuck in PROCESSING).
4. At /payout-accounts, add the exact same account details again. Observe that the existing account comes back with the old recipient code (fingerprint match; no new Paystack recipient is created).
5. Remove the account and add it again. Confirm a new recipient code exists in the keys-B dashboard. Register it on the campaign.
6. Request and approve again, and wait for transfer.success.

**Expect:** The first attempt fails cleanly with money back in availableBalance and a message the owner can see. Re-adding identical details does NOT fix it. The runbook must say to remove and re-add saved accounts after cutover. After remove and re-add the payout is PAID for the correct net amount.

**Needs:** Paystack transfers (two key sets)

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/CreatePayoutRecipientUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/web/src/pages/PayoutAccountsPage.tsx`

## GAP2-014 · P0 · Cutover: creator, affiliate and split-beneficiary recipients created under test keys

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging. Under keys A: a creator with a tip balance and a saved payout account, an affiliate with available commission and a recipient, and a split beneficiary with a registered recipient.

**Steps:**

1. Switch to keys B.
2. Creator: request a withdrawal at /creator (web). Admin processes it if review is needed.
3. Affiliate: request a payout at /affiliate. Admin approves at /affiliates/<id>.
4. Beneficiary: request a payout by API and approve at /payouts.
5. For each, record the final status and balance after the provider rejects it.
6. Re-register each recipient under keys B and retry.

**Expect:** Each first attempt ends FAILED with the balance returned. None stays PROCESSING with money reserved. The retry after re-registration succeeds. The cutover runbook lists all four recipient stores.

**Needs:** Paystack transfers

**Source:** `apps/api/src/infrastructure/database/models/CreatorPayoutModel.ts`, `apps/api/src/infrastructure/database/models/AffiliateModel.ts`, `apps/api/src/infrastructure/database/models/BeneficiaryRecipientModel.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`

## GAP2-015 · P0 · Cutover: Paystack live dashboard (webhook URL, Transfer Approval URL, signature, OTP, transfer balance)

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Live Paystack business activated with Transfers enabled. Render env PAYSTACK_APPROVAL_REQUIRE_SIGNATURE=true.

**Steps:**

1. Live dashboard > Settings > API Keys & Webhooks: webhook URL = https://api.ujimora.com/api/v1/webhooks/paystack (not /donate/callback).
2. TEST dashboard: the webhook URL must not point at production. Set it to staging or leave it blank.
3. Transfers > Transfer Approval: URL = https://api.ujimora.com/api/v1/payouts/paystack-approval.
4. curl -X POST the approval URL with unsigned JSON, then with a random x-paystack-signature header. Both must return 400.
5. Approve a real GHS 1 payout in admin. Render logs show 'paystack transfer approval: signature checked' with valid true, and the transfer proceeds.
6. With the approval URL on, create a transfer directly in the Paystack dashboard. It must be declined.
7. Decide on 'Confirm transfers before sending' (OTP). If it is on, prove the admin transfer-control 'authorize' flow with a real OTP.
8. Fund the transfer balance to cover launch-week payouts plus transfer fees.
9. Send a live charge and confirm the dashboard shows webhook delivery 200. Send a test-dashboard webhook to production: the API returns 401 'Invalid webhook signature'.

**Expect:** Everything as described. Live webhooks are accepted, test webhooks are rejected, unknown transfers are declined, and payouts are not blocked by missing balance or OTP.

**Needs:** Paystack live dashboard

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `docs/paystack-owner-notifications-and-cashout.md`, `docs/payments/automatic-payouts.md`, `render.yaml`

## GAP2-016 · P0 · Cutover: top-up mode banner and the first live charge on every rail

*Surfaces:* admin, android, api, web  ·  *Type:* functional

**Before:** Just after the switch (GAP2-011). Small live amounts. A creator profile with tips enabled.

**Steps:**

1. Before the switch (test keys), /wallet shows 'Test payments only. No real money moves in this mode.'
2. After the switch, the banner is gone and GET /api/v1/wallets/topups/config returns {enabled:true, mode:'live'}.
3. Live smoke for each rail at GHS 1 to 2: uf- donation (web and Android), wtop- top-up, sub- subscription (web), tip- tip at /creators/<handle> (web only; tips are not offered in native apps).
4. Live smoke of one pout- payout and one cpay- creator withdrawal.
5. Each item appears once in the matching admin page and in the Paystack dashboard.

**Expect:** The banner matches the key in use. Each rail settles exactly once from its webhook, with the correct amount and fee.

**Needs:** Paystack live

**Source:** `apps/web/src/pages/WalletPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/WalletController.ts`, `apps/api/src/app.ts`

## GAP3-017 · P0 · Reconciliation: every Paystack charge maps to exactly one Ujimora record (uf-, wtop-, sub-, tip-)

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** End of QA window W (UTC start and end). Paystack Transactions export for W (all statuses). A read-only DB user. A spreadsheet.

**Steps:**

1. Split the Paystack export by reference prefix: uf- (donations), wtop- (top-ups), sub- (subscriptions), tip- (tips), plus any other prefix listed separately.
2. uf-: match donationintents.providerRef. A Paystack success must map to SUCCEEDED, REFUNDED or PARTIALLY_REFUNDED. Failed or abandoned must map to FAILED or still PENDING (list them). Amount in pesewas = (amount + tip) × 100. Currency GHS.
3. wtop-: match wallettopups.reference. Success must map to completed, with equal amountMinor, exactly one DEPOSIT wallet transaction and one journal entry with externalRef = reference.
4. sub-: match the subscription checkout providerRef. Success must map to SUCCEEDED, with finalAmount × 100 = the Paystack amount.
5. tip-: match the tip reference. Success must map to SUCCEEDED with settlementApplied true and exactly one creator balance credit.
6. Reverse direction: every internal Paystack record in W that is SUCCEEDED or completed appears exactly once in the export.
7. Wallet-funded donations (provider wallet) must not appear in Paystack. Check that total wallet debits do not exceed top-ups plus opening balances.

**Expect:** A 1:1 mapping with zero orphans on either side, and every mismatch explained in the launch log. A Paystack success whose record is still PENDING is a missed webhook the sweep did not repair; escalate it to GAP2-012 or GAP4-022.

**Needs:** Paystack dashboard exports

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/scripts/audit-donation-settlement.ts`

## GAP3-018 · P0 · Reconciliation: processor and platform fees match Paystack to the pesewa

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** GAP3-017 mapping complete.

**Steps:**

1. For each uf- success: the Paystack fee must equal the processor-fee journal line for that intent and the campaign processorFees increment. The platform fee line = round(amount × lockedPlatformFeePercent / 100, 2). The beneficiary line = amount − platform fee − processor fee. The tip lines equal the tip.
2. For each wtop- success: the Paystack fee must equal wallettopups.feeMinor / 100 and the processor-fee debit line. The wallet is credited the full amount.
3. sub- and tip-: the source stores no processor fee. Total those fees from the export and hand the figure to finance as platform cost.
4. Transfers: Paystack transfer fees are not stored internally. Total them from the Paystack transfers export.
5. Daily totals: Paystack fees report = internal processor fees (uf- + wtop-) + sub-/tip- fees + transfer fees.
6. Spot-check the odd amounts from GAP1-005 (1.11, 1.23) for rounding drift.

**Expect:** Zero pesewa difference per transaction. Cost categories that are not recorded internally are quantified and signed off by finance.

**Needs:** Paystack exports

**Source:** `apps/api/src/domain/entities/JournalEntry.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## GAP3-019 · P0 · Reconciliation: refunds, dashboard-initiated refunds and chargebacks

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Paystack Refunds and Disputes exports for W. Staging with test keys for step 4.

**Steps:**

1. Map each Paystack refund to a refund operation (admin /refund-recovery for unresolved ones; completed operations in the DB) by provider reference or transaction reference. Amounts must be equal.
2. For each: the intent is REFUNDED or PARTIALLY_REFUNDED, a reversing journal entry exists, totalRaised went down, and the refund hold is released.
3. Staging: refund a GHS 1 uf- donation directly in the Paystack dashboard. Check whether the Ujimora raised total, campaign balance or intent status change.
4. Staging: refund a sub- charge in the dashboard. The affiliate commission is reversed exactly once, and the subscription state is recorded as it stands.
5. List Paystack disputes/chargebacks. Confirm there is no automated handling, and that each one is logged and the campaign's funds are held by hand.

**Expect:** Every provider refund matches exactly one completed refund operation. Dashboard refunds (step 3) are expected NOT to be reflected, because the webhook uses refund events only for sub- affiliate clawback. A written manual procedure for dashboard refunds and chargebacks must exist before launch.

**Needs:** Paystack refunds/disputes exports

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/admin/src/pages/RefundOperationsPage.tsx`

## GAP3-020 · P0 · Reconciliation: every Paystack transfer maps to one payout (pout-, cpay-, bpay-, aff-)

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Paystack Transfers export for W (success, failed, reversed, pending, otp).

**Steps:**

1. Split transfers by prefix: pout- (campaign payouts, including batched legs pout-<id>-L<n>-...), cpay- (creator), bpay- (beneficiary), aff- (affiliate).
2. For each: amount in pesewas = netAmount (or the leg amount), and the recipient code equals the record's recipient.
3. Status mapping: success = PAID; failed = FAILED with the amount back in availableBalance; reversed = REVERSED with the paid-out amount restored.
4. Internal PAID or PROCESSING records with no Paystack transfer: investigate as unknown transfer outcomes.
5. Paystack transfers with no Ujimora record: treat as an out-of-band payout incident.
6. For each campaign: paidOutBalance = sum of successful pout- net amounts, and payoutFees = sum of retained fees.

**Expect:** 1:1 with zero orphans. Campaign paid-out totals match the provider exactly.

**Needs:** Paystack transfers export

**Source:** `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.ts`

## GAP3-021 · P0 · Reconciliation: bank settlements, Paystack balance and liability coverage

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** GAP3-017 to 020 done. Paystack Settlements export and the balance at the start and end of W. The finance owner is present.

**Steps:**

1. Compute: successful charges − Paystack fees − refunds − transfers (including transfer fees) − settlements to bank = change in the Paystack balance over W.
2. Compute liabilities at the end of W: all campaign pending + available + refund holds + PROCESSING payouts + wallet balances + creator balances + affiliate held and available + beneficiary balances.
3. Confirm Paystack balance + settled bank funds − platform revenue taken ≥ liabilities.
4. Finance signs the worksheet.

**Expect:** The identity holds to the pesewa and liabilities are fully covered.

**Needs:** Paystack settlements export; bank statement

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.ts`, `packages/types/src/ledger.ts`

## GAP4-022 · P0 · Subscription: payment made but both the webhook and the callback are missed

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging (NODE_ENV=production, test keys) where the tester can break webhook delivery (clear the webhook URL in the test dashboard). A signed-in user on Free.

**Steps:**

1. Clear the webhook URL in the Paystack test dashboard.
2. At /subscription choose a paid tier, Monthly, and pay with a test card.
3. On the Paystack success screen close the tab before it redirects, and do not open /subscription/callback.
4. Wait 40 minutes (at least two sweeps after the 30-minute threshold).
5. Reload /subscription and call GET /api/v1/subscriptions/mine.
6. Search the Render logs for any sub- verification.

**Expect:** Required: the subscription activates automatically, or support is alerted. Per the source there is no sweep for subscription checkouts (reconcileStale scans only donation intents and tips), so today the user stays on Free after paying. Log this as a launch blocker until a sweep or alert exists.

**Needs:** Paystack test dashboard

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## GAP4-023 · P0 · Subscription: support recovery path and the double-charge risk

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** The state left by GAP4-022. An admin token. A second user.

**Steps:**

1. Admin: POST /api/v1/admin/payments/<checkoutId>/reconcile. Expect 404 'Contribution not found' (the tool only handles donations). Confirm admin /subscriptions has no verify action.
2. As the user, start another checkout on /subscription for the same plan. Check whether a second pending checkout is created that could be paid (do not pay in live).
3. Recovery: the signed-in user opens https://app.ujimora.com/subscription/callback?reference=<sub-ref>. This calls the owner-only verify endpoint and settles.
4. Confirm the subscription is active, the period starts at settlement, and coupon or affiliate effects are applied once.
5. The second user opens the same URL. Expect 404 and no settlement.
6. Write the support runbook: find the sub- reference in Paystack by customer email, send the user the callback link, or refund.

**Expect:** Owner-only recovery works and other users cannot trigger it. A second checkout while one is paid-but-pending should be blocked or warned. Log it if it is not, because it allows a double charge.

**Needs:** Paystack test

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`

## GAP5-025 · P0 · Split proceeds: create, donate and try to cash out on web (dead end)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true (as in render.yaml). The organizer's plan allows split proceeds. Two beneficiaries with email addresses.

**Steps:**

1. At /campaigns/new enable split and add two beneficiaries at 60% and 40%. Create the campaign.
2. In the split setup on the campaign page, tick each acceptance box, click Record acceptance, then Activate agreed split.
3. Donate GHS 10.00 by card. In admin /campaigns/<id> > Split proceeds, the beneficiary balances are 60/40 of the net and sum exactly to it.
4. As the organizer, request a cashout in the cashout section.
5. Search web and mobile for any screen to register a beneficiary payout destination or request a beneficiary payout.

**Expect:** The cashout is refused with 'This campaign shares proceeds; request per-beneficiary payouts instead' (409), and the message is shown clearly. For launch there must be a way for the organizer or beneficiary to request per-beneficiary payouts. None exists in the source (only admin verify-kyc and approve), so launch needs a decision: build the UI or set SPLIT_PROCEEDS_ENABLED=false (see GAP5-027).

**Needs:** Paystack

**Source:** `render.yaml`, `apps/web/src/components/campaigns/CampaignSplitSetup.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`

## GAP5-026 · P0 · Split proceeds: API-only beneficiary payout path end to end

*Surfaces:* admin, api, email  ·  *Type:* functional

**Before:** The GAP5-025 campaign with accrued balances. An organizer bearer token. An admin with payout rights. A second admin if dual approval is configured.

**Steps:**

1. POST /api/v1/campaigns/<id>/split/beneficiaries/<beneficiaryId>/recipient with bank or MoMo details, for each beneficiary.
2. POST /api/v1/campaigns/<id>/split/beneficiaries/<beneficiaryId>/payouts {amount} for each.
3. Admin /payouts, beneficiary section: approve before verifying KYC and expect 422. Then Verify KYC and Approve.
4. Wait for transfer.success on the bpay- references. Payouts become PAID and beneficiary balances go down.
5. GET /api/v1/campaigns/<id>/split/beneficiaries/<beneficiaryId>/statement shows accruals, payouts and a running balance that reconciles.
6. Negative: amount above the beneficiary's available balance returns 422; another organizer gets 403; a second approve returns 409.

**Expect:** Amounts paid equal amounts requested, statements reconcile, and the owner receives the 'beneficiary payout is paid' email.

**Needs:** Paystack transfers

**Source:** `apps/api/src/application/use-cases/BeneficiaryPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`

## GAP5-027 · P0 · Split proceeds: turning the flag off while split campaigns exist

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Staging with an active split campaign that has accrued beneficiary balances.

**Steps:**

1. Set SPLIT_PROCEEDS_ENABLED=false and redeploy.
2. Check whether the web campaign form and mobile campaign/create still offer split.
3. As the organizer, request an ordinary cashout on the split campaign.
4. Make a new donation and check whether it still accrues per beneficiary. Check that statements still load.

**Expect:** The behaviour is defined and agreed. Either ordinary cashout stays blocked for campaigns with an active split, or split agreements are formally closed first. Per the source the 409 guard runs only while the flag is on, so turning it off lets the organizer cash out 100% despite the beneficiaries' agreed shares. Resolve this before choosing 'flag off'.

**Needs:** None external

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `render.yaml`

## GAP6-030 · P0 · Concurrency: a refund racing an owner cashout request on the same balance

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging. Five fresh campaigns, each with one GHS 100 card donation still in pendingBalance. Two testers: one on the owner cashout form, one with a prepared curl for POST /admin/payments/<intentId>/refund.

**Steps:**

1. Count down and fire both at the same second: the cashout for the full eligible balance and the refund.
2. Repeat on the other campaigns, alternating which one is sent first.
3. After each run read campaignbalances (pendingBalance, availableBalance, refundHolds, paidOutBalance), payouts and refund operations.
4. Check Paystack for any refund created in runs where the refund lost.

**Expect:** No balance ever goes negative. available + pending + refund holds + reserved/paid-out never exceeds the ledger beneficiary net. Exactly one side claims the money. If the cashout wins, the refund returns 409 'Campaign funds are no longer available for this refund' and NO Paystack refund is created, because the hold is taken before the provider call. If the refund wins, the cashout is limited to what remains.

**Needs:** Paystack test

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.ts`

## GAP6-031 · P0 · Concurrency: a refund racing admin approval and an automatic payout

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging. A campaign with two donations. The owner has requested a cashout for about 50% of eligible funds. Automatic payouts are enabled for the second run (/admin/automatic-payouts policy enabled, amount below its maximum).

**Steps:**

1. At the same moment, admin 1 approves the payout at /payouts and admin 2 refunds the donation whose net is still pending.
2. Wait for transfer.success and read the balances.
3. Repeat with the payout approved automatically, and the refund fired while the automatic approval runs.

**Expect:** Both can succeed because they draw on different buckets. Neither balance goes below zero. The reserved amount equals the payout amount. Paid-out net + fees + refunds ≤ raised net on the ledger.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.ts`

## GAP6-032 · P0 · Concurrency: refund after a failed or reversed transfer

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging. A campaign whose payout is sent to an invalid recipient so Paystack returns transfer.failed (or is reversed in test).

**Steps:**

1. Approve the payout and wait for FAILED. Confirm the amount is back in availableBalance.
2. Issue a refund for a donation on that campaign through the admin API.

**Expect:** The outcome is defined. Per the source, refunds hold money only from pendingBalance, and failed or reversed transfers return money to availableBalance, so the refund is refused (409) even though the platform still holds the money. Decide whether refunds may draw from available, or document the manual path.

**Needs:** Paystack test

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`

## GAP6-033 · P0 · Concurrency: a pending cashout blocks refunds and cannot be cancelled

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Staging. A campaign with one card donation.

**Steps:**

1. The owner requests a cashout of the full eligible balance. Leave it PENDING.
2. Admin tries POST /admin/payments/<intentId>/refund.
3. Look for a reject or cancel action for the pending payout on admin /payouts and in the owner's cashout section. Also check the payout API routes.

**Expect:** Staff can reject or cancel a pending payout, which returns the money to pending, and the refund then succeeds. Per the source there is no reject or cancel route and the refund returns 409. This blocks refunds after an owner has requested cashout, which matters for fraud and refund handling.

**Needs:** Paystack test

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`

## GAP7-034 · P0 · Environment: a staging stack fully separate from production

*Surfaces:* admin, api, marketing, web  ·  *Type:* compliance

**Before:** Access to Render, Vercel, Atlas, Paystack, LiveKit, Resend and Cloudinary accounts.

**Steps:**

1. Create a separate Render service for staging with autoDeploy from a staging branch (production deploys on every push to main).
2. Staging env: NODE_ENV=production, PAYMENTS_RECONCILIATION_ENABLED=true, Paystack sk_test/pk_test, a separate Atlas cluster (replica set), a separate LiveKit project, a separate Resend key or domain, a separate Cloudinary cloud, and PUBLIC_WEB_URL/PUBLIC_API_URL/CORS_ORIGINS/ADMIN_WEB_URL set to staging domains.
3. Point the staging web and admin at the staging API. The current vercel.json files rewrite to api.ujimora.com, so staging needs its own rewrite (see GAP7-040).
4. Seed staging with apps/api/scripts/seed-e2e.mjs (MONGODB_URI = the staging URI).
5. Configure store sandbox testers (App Store sandbox, Play license testers) against staging.
6. On staging, start a donation and confirm the Paystack callback returns to the staging web domain, not app.ujimora.com.

**Expect:** No staging action touches production data, email senders, the media cloud or money. Callback and email links use staging domains.

**Needs:** Render, Vercel, Atlas, Paystack test, LiveKit, Resend, Cloudinary, store sandboxes

**Source:** `render.yaml`, `apps/api/src/app.ts`, `apps/api/src/main.ts`, `apps/api/scripts/seed-e2e.mjs`

## GAP7-035 · P0 · Environment: background timers actually run in staging

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** The GAP7-034 staging stack.

**Steps:**

1. Confirm NODE_ENV=production in the staging logs at boot.
2. Every 5 minutes the logs show 'payment reconciliation sweep complete' (reconciliation).
3. Break the outbox dispatch once (e.g. stop realtime) and confirm pending outbox rows drain within about 60 seconds of recovery.
4. Close a test account and confirm erasure completes within minutes (60-second sweep).
5. Confirm tip checkout credentials are cleared within 5 minutes after a tip reaches a final state.
6. Repeat one sweep-dependent case (e.g. a missed donation webhook) on a NODE_ENV=development instance and confirm it does NOT repair, which is why those cases must run on production-mode staging.

**Expect:** All four production-only timers run in staging. Sweep-dependent cases (DONATE-022, WALLET-012, PAYOUT-45, SUBS) are scheduled only there.

**Needs:** Render logs

**Source:** `apps/api/src/app.ts`

## GAP7-037 · P0 · Environment: seed scripts can never touch production

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A list of everyone holding the production MONGODB_URI.

**Steps:**

1. Read apps/api/scripts/seed-dev.mjs. It wipes campaigns and donations and upserts admin@ujimora.com with password 'Admin2026!', and it has no environment guard. Agree who may run it and where.
2. Query production users for emails ending @ujimora.dev and for admin@ujimora.com.
3. Try to sign in to https://admin.ujimora.com as admin@ujimora.com with 'Admin2026!'.
4. Confirm every staff account has MFA enrolled.
5. Run seed-e2e.mjs only against staging and confirm it creates seed-creator@ujimora.dev and 'Seeded Water Project' there only.

**Expect:** There are no seeded accounts in production and the seeded admin password does not work. Seed scripts are documented as staging-only (ideally with a guard). Every staff account has MFA.

**Needs:** Atlas

**Source:** `apps/api/scripts/seed-dev.mjs`, `apps/api/scripts/seed-e2e.mjs`

## GAP7-038 · P0 · Environment: which QA cases may run against production

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** The full QA case list.

**Steps:**

1. Tag each case as production-allowed, staging-only or sandbox-only.
2. Production-allowed: read-only smokes, the GAP1 journey with a named QA organization and small real money, GAP2-015/016, and GAP3 reconciliation.
3. Staging-only: webhook forgery and replay, kill-switch toggles, race tests, sweep starvation, seeds, split flag flips, erasure tests, load tests.
4. Freeze merges to main during the QA window (Render autoDeploy: true), and confirm Vercel production deploys are also paused or controlled.
5. Mark production QA records (a named org, a tag) so they can be excluded from leaderboards and metrics, and plan their cleanup after launch.

**Expect:** A signed matrix. No destructive or forged-webhook case is run against production.

**Needs:** None

**Source:** `render.yaml`, `apps/web/vercel.json`

## GAP7-039 · P0 · Environment: every variable the code reads is set on Render

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** Render dashboard access for production and staging.

**Steps:**

1. Confirm these are set on Render even though render.yaml does not declare them: MFA_ENCRYPTION_KEY, AUTH_EMAIL_ENCRYPTION_KEY_BASE64, STORE_BILLING_ENABLED, STORE_BILLING_PRODUCTS, STORE_RECEIPT_ENCRYPTION_KEY_BASE64, APPLE_IAP_* (including APPLE_IAP_ENVIRONMENT: Sandbox for staging, Production for prod) and GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.
2. Enroll MFA on an admin account (needs MFA_ENCRYPTION_KEY) and sign in with it.
3. Trigger a password reset and a verification email (account email encryption).
4. Staging: complete a sandbox in-app subscription on iOS and Android. After release, complete one production purchase and check admin /store-billing.

**Expect:** Each feature works in each environment, and render.yaml is updated to declare these keys.

**Needs:** App Store Connect, Google Play Console

**Source:** `render.yaml`, `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/app.ts`

## GAP7-040 · P0 · Environment: Vercel preview deployments call the production API

*Surfaces:* admin, marketing, web  ·  *Type:* security/permission

**Before:** Any Vercel preview URL for web, admin and marketing.

**Steps:**

1. Open the preview, then in DevTools > Network confirm the /api/v1 calls go through the preview host.
2. Compare the data with production (e.g. the same campaigns, and sign-in with a production account works).
3. Read apps/web, admin and marketing vercel.json: /api/v1 is rewritten to https://api.ujimora.com; .env.production sets VITE_API_URL=/api/v1.

**Expect:** Previews are either pointed at staging or treated as production (no testing on them). Per the source, today every preview reads and writes production data.

**Needs:** Vercel

**Source:** `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/marketing/vercel.json`, `apps/web/.env.production`

## GAP2-004 · P0 · Support-only refund of a guest donation, end to end, with idempotency and exact money

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** Two admin accounts. A guest Paystack test donation of 50 GHS plus a 5 GHS optional tip, with its Paystack reference. REFUNDS_AND_FEES policy for fees and tips agreed. Admin bearer token (the admin console has no payment search page).

**Steps:**

1. The guest emails support@ujimora.com with amount, date and Paystack reference. Support replies to the same address to verify ownership and opens a case.
2. GET /api/v1/admin/payments?donorEmail=<email>, then GET /api/v1/admin/payments/<intentId>. Confirm providerRef, amount, tip, fees and campaign.
3. Record campaign raisedAmount, the CampaignBalance (available, pending, paid out), and the journal entries for the intent.
4. POST /api/v1/admin/payments/<intentId>/refund with header Idempotency-Key: qa-refund-001 and no amount (a full refund).
5. Repeat the identical request. Then repeat it with Idempotency-Key: qa-refund-002.
6. Check the admin /refund-recovery page, the Paystack dashboard refunds, the public campaign total, CampaignBalance and the journal.
7. On a second guest gift, refund amount 10, then send a second partial refund that would exceed the principal.

**Expect:** Exactly one Paystack refund. The same-key replay returns the original result. A new-key full refund is rejected (409) and the intent ends REFUNDED. Partial refunds are capped so the total never exceeds the principal. raisedAmount and the campaign balance fall by exactly the campaign's share, to the pesewa. Compensating journal entries balance. Fee and tip treatment matches the written policy. Ujimora sends the guest no email, so support sends the confirmation from the case. Log ops risk: refunds are API-only (no admin UI).

**Needs:** Paystack test keys with refunds; admin API token

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/admin/src/pages/RefundOperationsPage.tsx`, `docs/payments/DIASPORA_PAYMENTS_PLAN.md`

## GAP2-006 · P0 · Signed-in refund requests reach a staff queue and the donor sees the outcome

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Registered donor D with a completed, linked 30 GHS donation less than 30 days old. Admin with DONATIONS permission.

**Steps:**

1. As D, on web /donations click the refund action and submit a reason and description on /donations/refund/<id>. Note the Refund ID.
2. Try to submit a second request for the same donation.
3. As admin, look for the request in the admin console: Donations, Refund recovery (/refund-recovery), Payouts, Disputes.
4. As admin, call GET /api/v1/admin/refund-operations and search every admin API for the Refund ID.
5. Wait 24 h in staging (or check the DB), then open D's /refunds on web and My Refunds in the mobile app.
6. Open /donations after the admin refunds the intent with the admin payments API.

**Expect:** TARGET: every request shows up in a staff queue with SLA tracking, and D sees status changes. CURRENT (source): nothing in the API or admin console reads or updates these requests (RefundModel). They stay 'pending' forever and appear only in D's own list. A second request returns 409 'Refund already requested for this donation'. Also: My Donations always shows 'completed', even after a refund (ListMyDonations hard-codes the status), so the 'Refunded' filter never matches. Treat both as launch blockers or cover them with a runbook.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/refundRoutes.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/admin/src/router.tsx`

## GAP2-014-2 · P0 · Automatic payout leaves before staff can react; blocking and the policy switch contain it

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging F from GAP2-013. Automatic payouts enabled with maxAmount of at least 500. Recipient reviewed within reviewMaxAgeDays. No open dispute. Amount below the dual-approval threshold.

**Steps:**

1. As F, use campaign cashout on web to request a standard 300 GHS payout to the reviewed bank recipient. Time the response.
2. Within 10 s, open admin /payouts and the Paystack transfers dashboard.
3. The admin blocks CF. F requests another standard 300 GHS payout.
4. The admin turns automatic payouts off in admin Settings, then reopens and re-approves CF. F requests again.
5. Check the automatic payout policy history (GET /api/v1/admin/automatic-payouts) and admin /audit.

**Expect:** The first payout is approved automatically inside the same request and the Paystack transfer starts before any human sees it. After the block, the new request stays PENDING ('Campaign requires review'). With the policy off, requests stay PENDING ('Automatic payouts are disabled'). The policy change is in its history and the audit log. The fraud runbook's first step is 'turn off automatic payouts'.

**Needs:** Paystack test keys (transfers)

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PayoutController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/admin/src/components/AutomaticPayoutSettings.tsx`

## GAP2-015-2 · P0 · Payouts on a blocked campaign can still be requested and approved

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** CF blocked with at least 500 GHS available. Paystack test keys. Two admins.

**Steps:**

1. As F, POST /api/v1/campaigns/<CF>/payouts with {amount:200,type:'standard'}.
2. As F, POST /api/v1/campaigns/<CF>/payouts with {destination:'ujimora_wallet', idempotencyKey:<uuid>, amount:100}.
3. In admin /payouts, check whether each request shows the campaign's blocked status. Approve the bank payout with a review note of at least 20 characters, then approve the wallet payout.
4. Look for any Reject or Cancel action for a pending payout, in the UI and the API.
5. Record the CampaignBalance and F's wallet after each step.

**Expect:** TARGET: requests and approvals are refused while the campaign is blocked. CURRENT (source): both requests are accepted, and approval succeeds, because RequestPayoutUseCase, ApprovePayoutUseCase and settleCampaign never check campaign status. Log as a launch blocker, or make 'check campaign status' a mandatory reviewer step. There is no reject or cancel endpoint, so a rogue request stays in the queue with its amount moved from pending to available. Balances stay internally consistent.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

## GAP2-018 · P0 · 'Report Campaign' submissions must reach a staff queue

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Reporter R signed in. Admin.

**Steps:**

1. R clicks 'Report Campaign' on /campaigns/<id>, chooses Fraudulent and adds a description.
2. The admin searches the console for the report: Reports, Safety reports, Publication reviews, Disputes, Campaign detail.
3. The admin calls GET /api/v1/reports and PUT /api/v1/reports/<id> (mark reviewed).
4. A signed-out visitor clicks 'Report Campaign'.

**Expect:** TARGET: every campaign report shows up in a staff queue with an SLA. CURRENT: the reports exist only through the API; the admin 'Reports' page shows analytics, not these reports. Reviewing only changes the status, with no action attached. The FAQ tells users to use this button for fraud, so this is a launch blocker unless an admin queue or a daily API-pull runbook exists. A signed-out visitor is sent to login.

**Needs:** none

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/admin/src/pages/ReportsPage.tsx`

## GAP2-019 · P0 · Public FAQ fraud promises match what staff can actually do

*Surfaces:* admin, marketing, web  ·  *Type:* compliance

**Before:** Results of GAP2-013 through GAP2-018.

**Steps:**

1. Open ujimora.com Help and read 'What happens if a campaign is fraudulent?'.
2. Open the CMS FAQ (admin /content/faq; seeded from siteContentDefaults) and where it is shown in the web app.
3. Compare each promise with the tabletop results: 'immediately suspended', 'funds are frozen', 'we process refunds for affected donors', 'permanently banned', 'Use the Report button'.

**Expect:** Every promise either has a working, rehearsed staff procedure or is rewritten, with legal sign-off. Today the tooling cannot freeze creator or wallet funds, cannot ban accounts, and has no admin queue for reports, so the copy must change or the tooling must be built before launch.

**Needs:** legal reviewer

**Source:** `apps/marketing/src/pages/HelpPage.tsx`, `apps/api/src/infrastructure/database/siteContentDefaults.json`

## GAP2-022 · P0 · Payment completing after a campaign is closed, blocked or past its end date

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Campaign CC active. Paystack test card and a MoMo test flow.

**Steps:**

1. A donor starts a web donation on CC, reaches the Paystack checkout and pauses.
2. The admin blocks CC.
3. The donor completes the payment. Also test a MoMo approval arriving more than 2 minutes later.
4. Watch the webhook, /donate/callback, the campaign raisedAmount, CampaignBalance and the journal.
5. A new donor opens /c/<slug>/donate and sends POST /api/v1/donation-intents for CC.
6. Repeat with a campaign whose endDate passes during checkout.

**Expect:** New intents are refused with 'Campaign is not accepting donations'. The in-flight payment still settles and is credited to CC's raised total and balance, because settlement has no status guard, and the donor sees success. The ledger balances. The runbook covers refunding or paying out late gifts.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## GAP2-029 · P0 · Network drops after Give is tapped: the retry must not double-charge

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** DevTools (or a proxy) able to drop the response to POST /api/v1/donation-intents.

**Steps:**

1. Tap Give and drop the connection after the request is sent but before the response arrives.
2. Restore the connection and tap Give again. Pay on the resulting checkout.
3. In the admin payments API, list the intents for this email and campaign.
4. After 30+ minutes (the reconciliation sweep), check the intent states, the campaign total and the Paystack charges.

**Expect:** Each createDonationIntent call sends a new Idempotency-Key, so the retry creates a second intent and a second checkout. Only the paid intent settles, and the unpaid one ends EXPIRED or FAILED. The campaign counts the gift once and the donor is charged once. Consider keeping one key per form session, as WalletPage does with sessionStorage.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/fundraising.ts`, `apps/web/src/pages/WalletPage.tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## GAP2-036 · P0 · Boot the API against a restored production snapshot before launch

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** The latest production backup restored to an isolated staging cluster. Paystack TEST keys only. PAYMENTS_RECONCILIATION_ENABLED=false. RESEND_API_KEY blank. No live LiveKit or Bitnob keys.

**Steps:**

1. Start the API and watch the logs for 'Database model initialization failed' (record the modelName and codes 86, 85 or 11000).
2. For each unique index (57 of the 83 model files declare one), run a duplicate check using the model's unique key.
3. If a legacy index conflicts, write a narrow migration in the style of migrate-refund-index.ts and rehearse it twice.
4. Once it boots, check /health and exercise the key reads: campaigns, donations, wallets, payouts.

**Expect:** The API logs 'Connected to MongoDB' and starts listening with no index errors. Any conflict has a rehearsed, repeatable migration run before the production deploy; never broad syncIndexes. Nothing is sent to live providers or users.

**Needs:** MongoDB Atlas restore access

**Source:** `apps/api/src/infrastructure/database/connection.ts`, `docs/compliance/RENDER_STARTUP_INCIDENT.md`, `apps/api/scripts/migrate-refund-index.ts`

## GAP2-037 · P0 · Legacy approved KYC with no expiryDate silently loses verification level

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** The staging snapshot from GAP2-036.

**Steps:**

1. Count KYC verifications with status 'approved' and no expiryDate.
2. For three affected users, check web /kyc and mobile Verification, the public profile badge (GET /api/v1/users/<id>/public), creating a new campaign (allowance), an admin approving their pending campaign, and automatic payout eligibility.

**Expect:** CURRENT: /kyc shows Verified (GetKYCStatusUseCase), but currentVerificationLevel treats the record as not current, so the badge is missing, the allowance drops, approval fails with 'Renew verification before approval', and automatic payouts go to manual review. Before launch, decide on and run a backfill (for example expiryDate = reviewedAt + 365 days) or send a re-verification notice, then re-test.

**Needs:** Staging snapshot

**Source:** `apps/api/src/domain/services/currentVerificationLevel.ts`, `apps/api/src/application/use-cases/GetKYCStatusUseCase.ts`, `apps/api/src/domain/services/currentCampaignAllowance.ts`, `apps/api/src/infrastructure/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`

## GAP2-038 · P0 · Legacy campaigns without lockedPlatformFeePercent charge the organizer's current plan rate

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Staging snapshot; plan history.

**Steps:**

1. List active and funded campaigns with no lockedPlatformFeePercent.
2. For each organizer, compare the current plan fee with the fee in force when the campaign was created.
3. Make a test gift to one affected campaign and read the settlement breakdown's platform fee.

**Expect:** The fee charged equals the organizer's current plan rate (the fallback). Where the plan changed since creation, the charged fee differs from what the organizer agreed to, so backfill the creation-time rate and re-test. Amount = net + platform + processor, to the pesewa.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/infrastructure/database/models/CampaignModel.ts`

## GAP2-048 · P0 · Two-account IDOR sweep: wallets, donations, refunds, subscriptions, payout accounts, creator, affiliate, notifications

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Users A and B, both verified. A owns a wallet, a pending top-up reference, a donation with a message, a refund, a subscription checkout, a saved payout account, creator payouts, an affiliate account and a notification. Tokens for A and B, plus no token.

**Steps:**

1. Using B's token and then no token, call: GET /api/v1/wallets/<A wallet>, GET /api/v1/wallets/topups/<A ref>, GET /api/v1/donations/<A donation>, POST /api/v1/donations/<A donation>/message.
2. POST /api/v1/refunds with {donationId: A's}; GET /api/v1/refunds/mine.
3. GET /api/v1/subscriptions/checkout/<A id>; POST /api/v1/subscriptions/checkout/<A id>/verify; POST /api/v1/subscriptions/checkout/reference/<A ref>/verify.
4. DELETE /api/v1/payout-accounts/<A id>; GET /api/v1/creators/me/payouts; GET /api/v1/affiliate, /affiliate/referrals and /affiliate/commissions; GET /api/v1/data-rights.
5. PUT /api/v1/notifications/<A notification>/read.
6. In the database, confirm none of A's records changed.

**Expect:** 401 with no token. For B: 404 (preferred) or 403, with none of A's data in the body. Lists contain only B's rows. No state change to A's records. Log any endpoint that returns A's data or changes it.

**Needs:** Paystack test keys (to seed data)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/walletRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/refundRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutAccountRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/notificationRoutes.ts`

## GAP2-049 · P0 · Two-account IDOR sweep: campaign payouts, recipients, QR codes and split proceeds

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A owns campaign CA with payouts; B owns CB. SPLIT_PROCEEDS_ENABLED=true in staging, with an active split on CA and beneficiary X (not B).

**Steps:**

1. With B's token: GET /api/v1/campaigns/<CA>/payout-options; GET /campaigns/<CA>/payouts; POST /campaigns/<CA>/payouts/<A payoutId>/refresh; POST /campaigns/<CB>/payouts/<A payoutId>/refresh (mismatched pair).
2. POST /campaigns/<CA>/payout-recipient with {savedAccountId: B's}; POST /campaigns/<CB>/payout-recipient with {savedAccountId: A's}; POST /campaigns/<CA>/payouts {amount:10}.
3. GET and POST /campaigns/<CA>/qr-codes.
4. Split: GET /campaigns/<CA>/split/versions; GET /campaigns/<CA>/split/beneficiaries/<X>/statement; POST /campaigns/<CA>/split/<v>/consent; POST /campaigns/<CA>/split/<v>/activate; POST /campaigns/<CA>/split/beneficiaries/<X>/recipient, /verify-kyc and /payouts; GET /campaigns/<CA>/split/payouts.

**Expect:** Every call returns 403 or 404. No recipient is attached, no provider refresh or settlement is triggered, and no statement or version data leaks. Record where a 403 ('Only the campaign owner...') confirms the resource exists, and decide whether that is acceptable.

**Needs:** SPLIT_PROCEEDS_ENABLED on staging; Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`, `apps/api/src/application/use-cases/GetCampaignPayoutOptionsUseCase.ts`

## GAP2-050 · P0 · Two-account IDOR sweep: live sessions, organization team and private KYC documents

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A has an active live session LA on CA and an organization ORG with members and a pending invitation for another email. A has a private KYC document and a KYC record with an open information request. LiveKit credentials. B is signed in.

**Steps:**

1. With B's token: POST /api/v1/live-sessions/<LA>/video/host-token; POST /live-sessions/<LA>/overlay-token/rotate; PATCH /live-sessions/<LA>; GET /campaigns/<CA>/live-sessions/active; POST /campaigns/<CA>/live-sessions; GET /live-sessions/<LA>/overlay?token=wrong.
2. GET /api/v1/organization-team/<ORG>; POST /organization-team/<ORG>/invitations; PUT and DELETE /organization-team/<ORG>/members/<m>; PUT /organization-team/<ORG>/profile; POST /organization-team/<ORG>/campaigns/<c>/updates; POST /organization-team/invitations/<invite for another email>/accept.
3. GET /api/v1/uploads/kyc/<A doc>/access; POST /api/v1/kyc/<A kyc id>/respond-info (B's token; also referencing A's kyc:// documents).

**Expect:** Every call returns 403 or 404. No LiveKit host token is issued to B. The overlay rejects a wrong token. No audit entry 'kyc.document.access' is written for B. respond-info returns 404. An organization member with a lower role cannot perform owner actions.

**Needs:** LiveKit credentials; Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycInformationRoutes.ts`

## GAP3-038 · P0 · Rate limits are per client behind the Render proxy (not one shared bucket)

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Staging deployed on Render exactly like production. Tester A (script) and tester B on different networks, one of them Ghanaian mobile data (MTN or Telecel). Read access to the API logs.

**Steps:**

1. From A's network, send 31 POST /api/v1/auth/login requests with a wrong password within 2 minutes (curl loop), and note X-RateLimit-Remaining.
2. Immediately, B signs in normally at app.ujimora.com/login and notes the X-RateLimit-Remaining header.
3. From A, send 61 POST donation-intent requests (donationIntentRateLimiter) while B starts a donation.
4. Check which IP the API logs record for each request.

**Expect:** B is unaffected: B's first request shows X-RateLimit-Remaining 29, with A and B in separate buckets. If B gets 429 'Too many requests, please try again later', this is a LAUNCH BLOCKER. apps/api never calls app.set('trust proxy', ...), so req.ip is Render's proxy and every user shares 30 logins per 15 min. Also confirm the thresholds hold up under carrier-grade NAT for a busy LIVE event (60 donation intents per 15 min per IP).

**Needs:** Render staging deploy

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `render.yaml`

## GAP3-049 · P0 · Late charge.success replay after a FULL admin refund must not re-credit or reopen the donation

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys. The ability to replay the captured webhook body with a valid x-paystack-signature (HMAC-SHA512 over the raw body using the test secret). Admin token. Campaign C. Optional live session and SPLIT_PROCEEDS_ENABLED to observe accruals.

**Steps:**

1. A donor pays GHS 100 to C (web). Record C's raised, available and pending amounts, the Donation count, the journal entries for the intent, live stats and split accruals.
2. Admin: POST /api/v1/admin/payments/<intentId>/refund with {idempotencyKey:'r1'}. Wait for REFUNDED, resolving any pending operation at admin /refund-recovery.
3. Replay the ORIGINAL charge.success webhook (same reference) once, then 5 times concurrently.
4. Re-check every value from step 1. Record the HTTP status returned to each replay.
5. Check the donor's /donations status, the realtime feed and overlay, and receipts and activity emails.

**Expect:** There is no re-credit. C's balances are unchanged since the refund. There is no new Donation row or journal entry, and the intent stays REFUNDED (not reopened). There is no new split accrual, live stat, overlay event or email. HTTP: current code returns 409 'Cannot settle donation intent in state REFUNDED', because HandlePaystackWebhookUseCase lacks an early return for REFUNDED. Paystack will retry for up to 72 h. That is money-safe, but the expected response is a 200 no-op; file P2 if it is 409.

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## GAP3-050 · P0 · Replays after a PARTIAL refund (with split proceeds) never re-accrue; later partial refunds stay exact

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with SPLIT_PROCEEDS_ENABLED=true and an active 70/30 split on campaign C. Paystack test keys. Admin token.

**Steps:**

1. A donor gives GHS 200. Record the beneficiary balances (GET /api/v1/campaigns/<C>/split/beneficiaries) and the campaign balances.
2. Admin partially refunds GHS 50 (POST /admin/payments/<intentId>/refund {amount:50, idempotencyKey:'p1'}) and confirms PARTIALLY_REFUNDED.
3. Replay charge.success 3 times.
4. Admin refunds another GHS 50 with key 'p2'. Repeat the 'p2' call (double submit).
5. Replay charge.success again. Then refund the remaining GHS 100.
6. Check the beneficiary statements, campaign balances, journal lines and final intent status.

**Expect:** Replays cause no re-accrual and no balance change. Each refund applies exactly once per idempotency key. The cumulative refund never exceeds the original. Beneficiary shares and the campaign net stay consistent in minor units (70/30 of the net, no rounding drift; the sum equals the net). The final status is REFUNDED when the cumulative amount equals the maximum. Replay responses follow the policy in GAP3-049.

**Needs:** Paystack test keys + signed webhook replay; SPLIT_PROCEEDS_ENABLED staging

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/SplitAccrualService.ts`

## GAP3-051 · P0 · Wallet top-up (wtop-) replay after the balance has been spent, and a late success after 'failed'

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A web member with a GHS wallet (on iOS native, top-ups open Safari, so test on web). Paystack test keys. The ability to replay a signed webhook.

**Steps:**

1. At app.ujimora.com/wallet, top up GHS 100 and confirm the balance rose by 100 (processor fees absorbed).
2. Donate GHS 80 from the wallet; the balance is 20.
3. Replay the wtop-... charge.success 3 times concurrently.
4. Check the wallet balance, the transactions list and the journal entries for that reference.
5. Start a second top-up and abandon it until reconciliation marks it failed (or the verify step returns abandoned). Then complete the payment with the same reference and deliver success.
6. Replay that success again.

**Expect:** After step 3 the balance is still 20, there is no duplicate DEPOSIT transaction or journal entry, and the response is 200 (completed top-ups return early). In step 5, a genuine late success credits exactly once (failed -> completed, by design) and appears in history with the requested amount; the step 6 replay changes nothing. Note: a completed top-up that Paystack later reverses has no clawback path; flag it for the policy owner.

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## GAP1-004 · P1 · E2E-4: Print a campaign QR code; scans redirect and are counted

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** GAP1-003 approved. A printer, an iPhone and an Android phone.

**Steps:**

1. As the org open /campaigns/<id>/live and use the QR manager ('Print or share a QR') to create a QR code with a label.
2. Download https://api.ujimora.com/qr/<code>.png and .svg, then print the PNG.
3. Scan the printout with the iPhone camera and with the Android camera.
4. Confirm each scan lands on https://app.ujimora.com/c/<slug> after a 302 from /r/<code>.
5. Reload the QR manager. The scan count went up by 2.
6. Open https://api.ujimora.com/r/UNKNOWNCODE.

**Expect:** Redirects stay on app.ujimora.com and the scan count is exact. An unknown code returns 404 and never redirects off-site. The printed QR stays readable at A6 size.

**Needs:** None external

**Source:** `apps/web/src/components/live/QrCodeManager.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`, `apps/web/src/lib/fundraising.ts`

## GAP1-009 · P1 · E2E-9: Activity emails across the journey and the data-rights request

*Surfaces:* admin, email, web  ·  *Type:* compliance

**Before:** GAP1-001 to 008 done. Access to the org, donor and info@ inboxes.

**Steps:**

1. List every email received since T0: verification, review alert, approval/publish, one per donation, refund, withdrawal status changes, subscription confirmation, KYB decision.
2. For each email check: sender info@ujimora.com, reply-to set, links go to app.ujimora.com (never localhost or onrender.com), GHS amounts match the records, anonymous donors are not named.
3. At /settings turn off one activity-alert category, make another GHS 1 donation, and confirm no email arrives for that category.
4. As the org, in Settings > data rights, submit an 'access' request with at least 10 characters of detail. Submit a second one immediately.
5. As staff open admin /privacy-requests and respond with the data export before the 30-day due date.
6. Check the export covers the org profile, campaigns, donations received, payouts, subscription and KYB status, and contains no other user's personal data.

**Expect:** Every expected email arrives once with correct amounts and links. The disabled category stays silent. The second data-rights request returns 409. Staff can fulfil and close the request within the due date.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `apps/web/src/components/account/DataRightsRequests.tsx`

## GAP4-024 · P1 · Subscription: a late webhook after manual recovery is idempotent

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** GAP4-023 recovery done. Use a checkout with an affiliate code or coupon.

**Steps:**

1. Restore the staging webhook URL and resend the charge.success event from the Paystack dashboard.
2. Open the callback URL two more times.
3. Check the subscription renewal date, affiliate commissions and coupon redemption count.

**Expect:** There is no second period extension and the renewal date is unchanged. There is one affiliate commission, the coupon redemption count is unchanged, and the checkout stays SUCCEEDED.

**Needs:** Paystack test

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## GAP5-028 · P1 · Split proceeds: refund on a split campaign keeps beneficiary holds exact

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A 60/40 split campaign with a GHS 1.01 card donation and a GHS 10 card donation.

**Steps:**

1. Refund the GHS 1.01 donation through the admin refund API.
2. Check the campaign refundHolds and each beneficiary's refundHolds. Their sum equals the refunded net.
3. Pay out beneficiary A in full, then refund the GHS 10 donation.

**Expect:** Holds are split by share with pesewa rounding and total exactly the net. No beneficiary pending balance goes negative. Once a beneficiary has been paid out, the refund returns 409 'Beneficiary funds are no longer available for this refund' and no provider refund is issued.

**Needs:** Paystack

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`

## GAP5-029 · P1 · Split proceeds: native split drafts on iOS and Android

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Store builds; an organizer whose plan allows split.

**Steps:**

1. In mobile campaign/create add three beneficiaries at 33.33 / 33.33 / 33.34 and save the split draft.
2. Try 50 / 49.99 (total not 100) and confirm it is rejected with a clear error.
3. In campaign management record each acceptance and activate.
4. Try to cash out from the app.

**Expect:** Shares are stored as 3333/3333/3334 basis points, invalid totals are refused, and activation works. The cashout hits the same dead end as web (GAP5-025).

**Needs:** Store builds

**Source:** `apps/mobile/src/components/CampaignManagement.tsx`, `apps/mobile/app/campaign/create.tsx`

## GAP7-036 · P1 · Environment: crypto webhook tests need a separate non-production environment

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** A second environment with NODE_ENV not set to production.

**Steps:**

1. On production-mode staging, confirm the mock crypto provider is absent (the mock is registered only when NODE_ENV is not production).
2. On the non-production environment set CRYPTO_PAYMENTS_ENABLED=true, CRYPTO_PRIMARY_PROVIDER=mock and CRYPTO_MOCK_WEBHOOK_SECRET, then run the crypto quote, deposit and webhook cases.
3. Run Bitnob sandbox cases only if Bitnob sandbox credentials exist.
4. Production: GET https://api.ujimora.com/api/v1/payments/crypto/assets reports crypto disabled, and crypto is not offered on /c/<slug>/donate.

**Expect:** Crypto cases run only where the mock or sandbox exists. Production has no mock rail and crypto stays off.

**Needs:** Bitnob sandbox (optional)

**Source:** `apps/api/src/app.ts`, `render.yaml`

## GAP8-041 · P1 · Version skew: old store build after a legal-acceptance version bump

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Build N installed (constant '2026-09-12'). A staging API with LEGAL_ACCEPTANCE_VERSION bumped in packages/types. An existing user whose acceptance is the old version.

**Steps:**

1. On build N (iOS and Android), register a new account.
2. Sign in as the existing user, open Review agreement (account-agreement) and accept.
3. Android: donate with a public name or message and tick the content terms.
4. Try publishing a campaign update or uploading an image (content acceptance returns 428).
5. Record every error message shown.

**Expect:** The user sees a clear 'please update the app' message with a store link, never a generic validation error. Per the source the API accepts only the exact new version, so register, re-acceptance and donate-with-message return 400 on old builds, and there is no minimum-version check. Before the first bump, either add a grace window that accepts the previous version or add a force-update gate.

**Needs:** TestFlight, Play internal track

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/legalAcceptanceSchema.ts`, `packages/types/src/legal-acceptance.ts`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/app/account-agreement.tsx`, `apps/mobile/app/donate/[id].tsx`

## GAP8-042 · P1 · Version skew: acceptance on web is not recognised by an older app

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** The state from GAP8-041.

**Steps:**

1. Accept the new agreement on web at /account-agreement.
2. Open the old app. The 'Review the account agreement' notice is still shown.
3. Publish content from the old app (the API now allows it).
4. Tap Review agreement and accept. It returns 400.

**Expect:** Web and app agree on the acceptance state. At minimum, the old app must not trap the user in a loop.

**Needs:** Store builds

**Source:** `apps/mobile/src/components/AccountAgreementNotice.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`

## GAP8-043 · P1 · Version skew: no over-the-air update or minimum-version path

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** The release owner is present.

**Steps:**

1. Confirm apps/mobile/app.json has no updates.url or runtimeVersion, and eas.json has no channel, even though expo-updates is installed.
2. Launch the production build in airplane mode and confirm startup is not blocked by update checks.
3. Write the incident plan for a broken store build: an API-side feature switch, an expedited review request, and user messaging.

**Expect:** The team accepts, in writing, that every JavaScript fix needs a store release, or configures EAS Update with a channel before launch.

**Needs:** EAS

**Source:** `apps/mobile/app.json`, `apps/mobile/eas.json`, `apps/mobile/src/lib/api.ts`

## GAP8-044 · P1 · Version skew: deploy order between the Render API and Vercel web/admin

*Surfaces:* admin, api, web  ·  *Type:* cross-platform

**Before:** Staging with separate API and web deploys.

**Steps:**

1. Open the web app in a tab and leave it open (old bundle).
2. Deploy an API change that changes a request contract (e.g. the version bump).
3. Without reloading, register, donate with a message, and request a cashout from the old tab.
4. Deploy the web app and reload. Then repeat with the web deployed first and the API second.

**Expect:** The old tab gets a handled error asking the user to reload, and no payment or payout is half-created. The release checklist states the deploy order (API first, backward compatible) and that Render and Vercel deploy independently on push.

**Needs:** Render, Vercel

**Source:** `render.yaml`, `apps/web/vercel.json`, `apps/web/src/components/auth/RegisterForm.tsx`

## GAP9-045 · P1 · Content: the help-center FAQ matches what the product does

*Surfaces:* admin, marketing  ·  *Type:* compliance

**Before:** Access to production marketing and admin /content/faq.

**Steps:**

1. Open https://ujimora.com/help and check each claim: Google/Facebook sign-up (none exists); campaigns up to 90 days with one 30-day extension (the API accepts any future end date and has no extension); editing a live campaign (intentionally unavailable); 0-100 trust scores unlocking limits (limits come from plan and verification); fraud means 'funds frozen, refunds processed, permanently banned' (no freeze tool; refunds are admin-API only); community vouching (not a verification method); 24-48 h review (only goals above GHS 250k are reviewed; others go live at once).
2. Correct each answer in admin /content/faq and publish.
3. In DevTools block api.ujimora.com and reload /help. The hard-coded fallback in HelpPage.tsx renders; check it too.

**Expect:** No false claims in the live CMS or in the fallback.

**Needs:** None

**Source:** `apps/api/src/infrastructure/database/siteContentDefaults.json`, `apps/marketing/src/pages/HelpPage.tsx`, `apps/marketing/src/hooks/useContent.ts`, `docs/compliance/CAMPAIGN_STAFF_REVIEW.md`

## GAP9-046 · P1 · Content: seeded blog posts do not say payments are unavailable

*Surfaces:* admin, marketing  ·  *Type:* compliance

**Before:** Access to admin /content/blog.

**Steps:**

1. On marketing /blog open every seeded article and search for 'wallet-backed contributions' and 'remain unavailable'.
2. Edit and republish each affected post in admin /content/blog.
3. Check sitemap and cached social previews for the old excerpts.

**Expect:** No published article says Paystack card/MoMo payments or payouts are unavailable.

**Needs:** None

**Source:** `apps/api/src/infrastructure/database/blogPostDefaults.json`, `apps/api/src/infrastructure/database/seedBlog.ts`

## GAP9-048 · P1 · Content: a fresh database publishes corrected seed content on first boot

*Surfaces:* api, marketing  ·  *Type:* recovery/idempotency

**Before:** Staging with empty sitecontents and blogposts collections.

**Steps:**

1. Boot the API. main.ts runs seedBlogIfEmpty and seedSiteContentIfEmpty.
2. Open marketing /help, /blog and the home page against staging.

**Expect:** The seeded content is already correct, meaning the JSON defaults were fixed and not only the live CMS. A database restore or a new region cannot bring back false claims.

**Needs:** None

**Source:** `apps/api/src/main.ts`, `apps/api/src/infrastructure/database/seedSiteContent.ts`, `apps/api/src/infrastructure/database/seedBlog.ts`

## GAP10-049 · P1 · Checkout channels: list every channel shown for each rail

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Access to the Paystack live dashboard.

**Steps:**

1. Paystack > Settings > Preferences > Payment channels: record which are enabled (card, mobile money, bank, bank transfer, USSD, QR, Apple Pay).
2. Open a live checkout for a donation, a top-up, a subscription and a tip. Screenshot the channel list each time (initialize sends no 'channels' field, so every enabled channel shows).
3. Either disable the unapproved channels in the dashboard, or schedule GAP10-050/051 for each one that stays.

**Expect:** Only approved channels appear, or every channel shown has passed its test.

**Needs:** Paystack live

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## GAP10-050 · P1 · Checkout channels: bank transfer and other delayed channels

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** 'Pay with transfer' is enabled. Staging, or live with GHS 1.

**Steps:**

1. Donate GHS 1.00 and choose bank transfer. Pay the temporary account from a bank app.
2. Watch /donate/callback. It may time out while pending; record the message shown.
3. Wait for the webhook. The donation settles, the raised total goes up and the fee comes from the webhook.
4. Pay a different amount than requested, if the channel allows it.

**Expect:** A late settlement is credited once, and the donor gets a receipt. The callback page explains 'still processing' without suggesting a retry. An amount mismatch is flagged and not credited.

**Needs:** Paystack; a bank account

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## GAP10-051 · P1 · Checkout channels: USSD, QR and Apple Pay; Android Custom Tab return

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** The channels are enabled. Android and iOS store builds.

**Steps:**

1. Android: start a donation, choose USSD in the Custom Tab and dial the code (this leaves the tab). Return to the app and confirm the pending state recovers and resolves after the webhook.
2. Android: pay by QR with a banking app, then return.
3. iOS: in the Safari handoff, use Apple Pay if it is offered. Confirm no payment sheet ever appears inside the app.

**Expect:** Each channel settles once. The app recovers the pending payment after the round-trip, and iOS stays compliant.

**Needs:** Paystack; phones with a SIM and banking apps

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`

## GAP10-052 · P1 · Checkout channels: delayed channels on subscription, top-up and tip checkouts

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Bank transfer or USSD enabled.

**Steps:**

1. Buy a subscription by bank transfer. /subscription/callback polls, then reaches the 'timeout' phase. Later the webhook activates the plan.
2. Top up a wallet with USSD. /wallet shows pending, then completed after the webhook or the 5-minute sweep.
3. Pay a tip at /creators/<handle> by bank transfer, and let the 5-minute tip checkout cleanup run before the payment arrives.

**Expect:** Each settles once when paid late. The tip is credited even after the checkout cleanup. No duplicate charge is prompted.

**Needs:** Paystack

**Source:** `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/app.ts`

## GAP11-053 · P1 · Kill switch: define and test what switching Paystack off stops

*Surfaces:* admin, android, api, web  ·  *Type:* functional

**Before:** Staging (test keys). An admin with PAYMENT_PROVIDERS permission. A pending payout, a creator balance and an affiliate balance ready.

**Steps:**

1. Admin /payment-providers: switch Paystack off.
2. Try each rail: web card/MoMo donation; Android donation; iOS Safari donation (web); wallet top-up at /wallet; subscription at /subscription; tip at /creators/<handle>; a wallet donation; approving a payout at /payouts; an automatic payout; a creator withdrawal; an affiliate payout; a beneficiary payout.
3. Record which rails were blocked and which message was shown.

**Expect:** A written decision on the switch's scope, and every rail behaves as decided. Per the source only new donation intents are blocked ('paystack payments are currently switched off'). Top-ups (env flag only), subscriptions, tips and all transfers ignore the switch, so it does not stop money moving in an incident.

**Needs:** Paystack test

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## GAP11-054 · P1 · Kill switch: turning Paystack back on from the admin console

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Paystack switched off (GAP11-053).

**Steps:**

1. At admin /payment-providers try to switch Paystack back on.
2. If the switch is disabled ('Not available yet'), call PATCH /api/v1/payment-providers/<id>/toggle with an admin token.
3. Confirm donations work again.

**Expect:** Staff can turn the gateway back on from the console. Per the source the page disables the switch for any disabled provider that is not the wallet, although the API allows re-enabling gateways, so the kill switch is one-way in the UI. Fix this or document the API workaround before relying on it.

**Needs:** None

**Source:** `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/api/src/application/use-cases/TogglePaymentProviderUseCase.ts`

## GAP11-055 · P1 · Kill switch: payments already in flight still settle

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging.

**Steps:**

1. Start two Paystack donations and stop on the Paystack page.
2. Switch Paystack off in admin.
3. Complete both payments. One returns to /donate/callback; for the other, block the webhook and wait for the sweep.

**Expect:** Both donations settle once. The switch never strands money that was already paid. Note that the switch fails open (a database error counts as on).

**Needs:** Paystack test

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

## GAP11-056 · P1 · Kill switch: stopping outbound transfers in an incident

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Staging with automatic payouts enabled.

**Steps:**

1. Disable the automatic payout policy in admin payout settings (PUT /admin/automatic-payouts).
2. Request a payout that would qualify for automatic approval. It must wait for a person.
3. Document the provider-side stop: turn off Paystack Transfers or require OTP, and check that the approval URL declines unknown transfers.

**Expect:** There is a documented, tested way to halt all outbound money within minutes.

**Needs:** Paystack dashboard

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`

## GAP12-058 · P1 · Uploads: signed direct upload bypasses size, type and review checks

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging with its own Cloudinary cloud. A signed-in user with current legal acceptance.

**Steps:**

1. POST /api/v1/uploads/sign {"folder":"campaigns"} and record the timestamp, signature, apiKey, cloudName and folder.
2. curl -F file=@50mb.mp4 -F api_key=<k> -F timestamp=<t> -F signature=<s> -F folder=ujimora/campaigns https://api.cloudinary.com/v1_1/<cloud>/auto/upload
3. Repeat with an .html file, an .exe file and a 9 MB PNG, using the profiles, misc and ubuntu-fund folders.
4. Reuse the same signature 10 times within the hour.
5. Open the returned secure_url values.

**Expect:** Every attempt is rejected, either because the route is removed or because signing is limited to allowed formats and sizes. Per the source only folder and timestamp are signed and no app calls /uploads/sign, so removing the route is the simplest fix. Until then this is an abuse path for hosting arbitrary files under the Ujimora cloud.

**Needs:** Cloudinary (staging cloud)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/application/use-cases/SignCloudinaryUploadUseCase.ts`

## GAP12-059 · P1 · Uploads: unsigned upload preset shipped in the web bundle

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Access to the Cloudinary console (production cloud dvoqbonr2).

**Steps:**

1. In the Cloudinary console > Settings > Upload, check whether a preset named 'ujimora' exists and whether it is unsigned.
2. Only if it exists and the owner approves: logged out, POST a 1 KB PNG with upload_preset=ujimora to https://api.cloudinary.com/v1_1/dvoqbonr2/auto/upload, then delete the test asset.
3. Remove VITE_CLOUDINARY_UPLOAD_PRESET from apps/web/.env.production, rebuild, and confirm campaign cover, profile photo and KYC uploads still work (they use the /uploads/image proxy).

**Expect:** Anonymous upload is impossible and the preset name no longer ships in the bundle.

**Needs:** Cloudinary

**Source:** `apps/web/.env.production`, `packages/ui/src/components/ImageUpload.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`

## GAP12-060 · P1 · Uploads: auth and agreement gates on /uploads/sign and /uploads/image

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Staging accounts: logged out, a user without current acceptance, a content-restricted user and a normal user.

**Steps:**

1. Logged out: POST /uploads/sign and POST /uploads/image. Expect 401.
2. Without current acceptance: expect 428.
3. Content-restricted user: expect 403.
4. POST /uploads/sign {"folder":"kyc"}: expect 400 'Use the private document upload flow'.
5. POST /uploads/image with 6 MB: expect 413. With content-type text/html: expect 415.

**Expect:** Every gate holds.

**Needs:** Cloudinary (staging)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`

## GAP12-061 · P1 · Uploads: Cloudinary cloud shared between development and production

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Access to the Cloudinary console.

**Steps:**

1. Confirm render.yaml CLOUDINARY_CLOUD_NAME=dvoqbonr2 is the same cloud used in development.
2. Browse the media library for development or test assets and for unexpected video or raw files (from /uploads/sign).
3. Create a separate staging cloud, then confirm staging KYC and campaign uploads never land in the production cloud.
4. Turn on Cloudinary restrictions (allowed formats, strict transformations, restricted media types) for production.

**Expect:** Production media is isolated, development and test assets are cleaned up, and file-type restrictions are enforced at the cloud as well.

**Needs:** Cloudinary

**Source:** `render.yaml`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`

## GAP2-001 · P1 · iOS Safari handoff creates a guest gift that is missing from the signed-in donor's history

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** TestFlight build signed in as donor A (a.qa@ test email); Safari has never signed in to app.ujimora.com (clear website data); staging with Paystack test keys; active approved GHS campaign C with a slug. Android internal build signed in as donor B. Admin bearer token.

**Steps:**

1. On iOS open campaign C and tap Donate. Confirm the 'Support this campaign' screen shows 'Continue in your browser...' and 'Returning to the app does not confirm payment'.
2. Tap 'Continue in browser' and confirm Safari opens https://app.ujimora.com/c/<slug>/donate with no session: the header shows Sign in and there is no coupon field.
3. Enter 20 GHS and A's email, pay with a Paystack test card, and wait for /donate/callback to show success.
4. Switch back to the app. Open My Donations (app/my-donations) and pull to refresh.
5. On desktop, sign in to the web as A and open /donations and /profile.
6. As admin, call GET /api/v1/admin/payments?donorEmail=<A email> and GET /api/v1/admin/donations. Note donorId.
7. On Android as B, donate 20 GHS from the in-app Donate flow (app/donate/[id]) and check B's My Donations.
8. Back on iOS, first sign in to app.ujimora.com in Safari as A, then repeat steps 1-4.

**Expect:** The first iOS gift settles (campaign raised +20.00 GHS) but is stored with donorId 'guest'. It is missing from A's app and web My Donations and profile totals. The admin payment search finds it by donorEmail. B's Android gift is linked to B and appears in B's history. After signing in to Safari first, A's gift is linked and appears. Support has a written script for 'my donation is missing from my history'.

**Needs:** Paystack test keys; TestFlight and Play internal builds; admin API token

**Source:** `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/donate/[id].tsx`, `apps/web/src/lib/fundraising.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`, `apps/api/src/domain/entities/Donation.ts`

## GAP2-002 · P1 · Guest who later registers with the same email: history, profile, leaderboard and alerts are not linked

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** Email g.qa@ has no account. Campaign C is active and in GHS. Resend configured on staging with a verified FROM_EMAIL. Paystack test keys.

**Steps:**

1. Signed out, open /c/<slug>/donate. Donate 50 GHS with email g.qa@, name 'QA Guest', 'anonymous' unchecked. Complete the Paystack test payment and see success on /donate/callback.
2. Register at /register with g.qa@, then repeat on a second run using G.QA@ in capitals. Accept the terms and verify the email.
3. Open /donations, /profile and /dashboard.
4. Open /leaderboard (All, Lifetime). Note total amount, donation count and donor count, and check whether 'QA Guest' is ranked.
5. In /settings, open Notifications and enable 'Donations you make' for in-app and email.
6. Wait 2 minutes (the activity sweep runs every 30 s), then check the dashboard notifications panel, the mobile bell and the inbox.
7. Make a 10 GHS web donation while signed in and wait 2 minutes.

**Expect:** Nothing links automatically. /donations and the profile totals show only the 10 GHS gift. The leaderboard never ranks the 50 GHS guest gift under the new account; it counts in the 'All' amount and donation totals but not the donor count. No alert is produced for the earlier guest gift. The 10 GHS gift produces 'Your donation is confirmed' in-app and by email. The product owner either signs off that guest gifts are never merged or logs a linking feature, and the FAQ explains it.

**Needs:** Paystack test keys; Resend API key and verified domain

**Source:** `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## GAP2-003 · P1 · Former guest cannot self-serve a refund for the guest gift; the not-found screen's back button goes to a dead route

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** The account from GAP2-002 and the id of its guest donation (from the admin Donations page).

**Steps:**

1. Signed in as g.qa@, open https://app.ujimora.com/donations/refund/<guestDonationId>.
2. Click the back action on the not-found card.
3. Send POST /api/v1/refunds with {donationId:'<guestDonationId>', reason:'Changed my mind'} using the user's token.
4. Open /refunds and the Refund Policy (web /refund-policy and the app's refund-policy screen). Find the guidance for guest payments.
5. Sign out and open /donations/refund/<guestDonationId>.

**Expect:** The page shows 'This donation was not found or is not eligible for a refund.' The API returns 404 'Donation not found', the same as for any unowned id. BUG to log: the back button goes to /my-donations, which is not a route (Not Found); it should go to /donations. The Refund Policy says 'Contact support for guest payments, optional platform tips or payments not listed in your account' on web and app. A signed-out visitor is sent to login.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/RefundRequestPage.tsx`, `apps/web/src/router.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `packages/types/src/legal.ts`

## GAP2-005 · P1 · Receipts a guest donor actually gets, checked against the receipt promises in the UI

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** Record whether customer receipts are on in the Paystack dashboard. Resend configured. Guest email inbox.

**Steps:**

1. As a guest, donate 25 GHS plus a 2 GHS optional platform tip on /c/<slug>/donate.
2. Check the inbox for mail from FROM_EMAIL (info@ujimora.com) and from Paystack. Record the merchant name, the amount (including tip) and the reference.
3. On the /donate/callback success screen, record what is shown (amount, tip, reference, campaign) and whether there is any receipt, print or download option.
4. Delete the localStorage key uf_pending_donations and open /donate/callback with no query string. Read the message.
5. Compare with the text of a registered donor's 'Your donation is confirmed' alert.

**Expect:** Ujimora sends no donation receipt email; there is no code for one. Only Paystack's receipt arrives, and only if enabled. The missing-reference screen says 'your receipt is emailed once payment is confirmed'. Either enable Paystack receipts and check the amount includes the tip and matches the callback, or change the text. No receipt implies tax deductibility. The reference is visible on the callback page so the guest can quote it to support.

**Needs:** Paystack dashboard access; email inbox

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## GAP2-007 · P1 · KYC approve, reject and request-info: what the applicant is told and where

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** Three users with verified email and every activity-alert category enabled (in-app and email). Admin with VERIFICATIONS permission. Resend configured. Web plus the iOS and Android builds.

**Steps:**

1. Users 1 and 2 submit identity KYC on web /kyc; user 3 submits from the mobile Verification screen.
2. In admin /kyc-review, approve user 1, reject user 2 with reason 'Photo unreadable', and request information from user 3 with a prompt of at least 20 characters.
3. Within 5 minutes, check each user's inbox, the web dashboard notifications panel and the mobile notification bell.
4. Open web /kyc and the mobile Verification screen for each user.
5. User 3 answers the request with a new document from the private uploader. The admin sees it back in pending.

**Expect:** No email, in-app notice or push for any KYC decision. The decision is visible only when the user opens /kyc or Verification: 'Verified' for approved; the rejection reason for rejected; the prompt and a response form for request-info (KYCInformationRequests / KYCInformationHistory). Record the stall risk: an unseen information request keeps automatic payouts in manual review. The product owner decides whether a decision email is required at launch.

**Needs:** Resend; Cloudinary (private KYC uploads)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycInformationRoutes.ts`, `apps/web/src/components/KYCInformationRequests.tsx`, `apps/mobile/app/verification.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## GAP2-008 · P1 · Campaign approve, reject, block and reopen: what the organizer sees

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** Organizer O with current KYC and alerts enabled. Two admins (you cannot review your own campaign). REVIEW_ALERT_EMAIL set.

**Steps:**

1. O submits campaigns X and Y on web /campaigns/new and Z from the mobile Create tab.
2. Check the REVIEW_ALERT_EMAIL inbox for 'Campaign awaiting review — <title>' for each.
3. In the admin campaign detail (CampaignReviewPanel), approve X. Reject Y with a reason. Approve Z, then 'Block campaign' with a reason, then 'Return to review'.
4. After each decision, check O's inbox, the web dashboard notifications and the mobile bell.
5. Check the status chips on web /my-campaigns and the badges on mobile my-campaigns. Look for the staff reason anywhere. Call GET /api/v1/campaigns/<Y>/reviews as O.
6. Open public /c/<slug> for Y and for Z while blocked.

**Expect:** Only staff get an email, at submission. O gets no email or in-app notice for any decision. Status appears only as a chip (Pending / Active / Blocked); mobile shows the raw status text. Rejected Y shows as 'Blocked', because reject sets BLOCKED. Reasons are never shown to O (the reviews endpoint returns 403 to non-admins). While blocked, the public page returns not found. Reopen returns Z to Pending silently. If organizers must be told the reason or offered an appeal, log it as a gap.

**Needs:** Resend; REVIEW_ALERT_EMAIL

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/mobile/app/my-campaigns.tsx`, `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`

## GAP2-011-2 · P1 · How invitees discover collaboration and organization-team invitations

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** Campaign owner O. Invitee I1 with an account. Organization account ORG. Invitee I2 with no account.

**Steps:**

1. O invites I1 as a collaborator on a campaign.
2. Check I1's inbox, the dashboard notifications and the mobile bell. Then open web /invitations and the mobile Invitations screen.
3. ORG invites I2 by email at /organization-team.
4. Check I2's inbox. I2 registers with the invited email but does NOT verify it, opens /organization-team and presses Accept.
5. I2 verifies the email and accepts. Then in staging, let a second invitation pass its expiresAt and try to accept it.

**Expect:** No invitation email or in-app notice is sent. I1 finds it only by visiting /invitations or the mobile Invitations screen. I2 cannot learn of the invite unless told outside Ujimora. Accepting before verifying the email returns 'Verify your email before accepting an organization invitation'. The expired invitation disappears and accepting it returns 'Invitation unavailable or expired'. The product owner decides whether invite emails are required at launch.

**Needs:** Resend (to confirm that nothing is sent)

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/CollaborationInvitationsPage.tsx`, `apps/web/src/pages/OrganizationTeamPage.tsx`, `apps/mobile/app/invitations.tsx`

## GAP2-012-2 · P1 · Outcomes for reporters and requesters: campaign reports, safety reports, disputes, data-rights requests

*Surfaces:* admin, android, email, ios, web  ·  *Type:* compliance

**Before:** Reporter R. Admin with REPORTS, DISPUTES and USERS permissions.

**Steps:**

1. R clicks 'Report Campaign' on /campaigns/<id> (reason Fraudulent). Try to report again.
2. R reports a comment through the safety report flow. The admin resolves it with 'hide comment' in /safety-reports.
3. Open admin /disputes. Look for any way to create a dispute (UI, or POST /api/v1/disputes).
4. R submits a data-rights 'access' request from web Settings (DataRightsRequests) and from mobile Settings. The admin reviews it in /privacy-requests (DataRightsQueue).
5. For each case, check R's email, in-app and mobile notifications, and the relevant screen.

**Expect:** The second campaign report returns 409 'You have already reported this campaign'. R never learns the outcome of a campaign or safety report. Disputes cannot be created at all (the API only lists and resolves them), so the Disputes page stays empty; confirm that is intended, given that the automatic payout policy checks for open disputes. Data-rights status appears only in Settings on web and mobile, with no email. Check this against the privacy policy's response commitments.

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/disputeRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDisputeRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/admin/src/components/DataRightsQueue.tsx`

## GAP2-013-2 · P1 · Timed tabletop exercise: contain a fraudulent organizer's money in every pot

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Staging organizer F with: current approved identity KYC; verified email; campaign CF active with at least 1,000 GHS available; a reviewed Paystack recipient; a paid plan with a creator balance of at least 200 GHS; a Ujimora wallet of at least 100 GHS; an affiliate with available commission (AFFILIATE_HOLD_DAYS=0). Automatic payouts ON in admin Settings. Two admins, a stopwatch and a scribe.

**Steps:**

1. At T0 a donor uses 'Report Campaign' on CF (Fraudulent) and emails support.
2. Record how staff learn of the report. The admin console has no campaign-report queue; its 'Reports' page is analytics.
3. For each pot, try every available lever and record the time and resulting audit entry: campaign (Block campaign); pending campaign payouts (any reject?); automatic payouts (Settings, turn off); creator balance; Ujimora wallet (admin Wallets page); affiliate (Affiliates, suspend); account (Users, suspend or ban?); sessions (force sign-out?).
4. Meanwhile F tries a creator withdrawal, a campaign payout and a wallet donation to another campaign (see GAP2-014 to GAP2-017).
5. Open admin /audit and confirm each staff action is logged with actor, reason and time.
6. Compare the results with the FAQ answer 'What happens if a campaign is fraudulent?'.

**Expect:** A timed runbook is produced. Expected from source: blocking is instant and stops new gifts, the public page and live streams; automatic payouts can be switched off globally; suspending the affiliate stops new commission, and affiliate payouts need approval anyway. There is NO lever for: the creator balance, the wallet balance, account suspension or ban, session revocation, or rejecting a pending campaign payout. Each gap is signed off or fixed before launch, with an owner. Every lever used appears in the audit log.

**Needs:** Paystack test keys (transfers); two admin accounts

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminUserRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`

## GAP2-016-2 · P1 · A publishing-restricted user can still withdraw their creator balance

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** F has a creator balance of at least 200 GHS and a saved payout account whose name has been matched. A safety report targeting F (targetType user, reason fraud).

**Steps:**

1. In admin /safety-reports, choose 'Restrict user' with notes.
2. Confirm /creators/<F handle> returns not found and a new tip is refused. F can still sign in.
3. As F, POST /api/v1/creators/withdraw (bank rail, Idempotency key). Then send a second request to ujimora_wallet.
4. Check the creator payout status, the Paystack transfer, F's wallet balance and /creator.

**Expect:** Both withdrawals go through: the bank transfer starts immediately and the wallet transfer is PAID instantly. Restriction only blocks publishing; the API message says 'Your account settings and funds remain accessible'. Staff cannot hold the money. Decide before launch whether a payout hold is needed, and align the FAQ.

**Needs:** Paystack test keys (transfers)

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## GAP2-017 · P1 · Wallet balance can be moved to another campaign while under investigation

*Surfaces:* admin, android, api, web  ·  *Type:* security/permission

**Before:** F has a wallet of at least 100 GHS. Accomplice campaign CA and F's second campaign CF2, both active.

**Steps:**

1. As F, donate 60 GHS from the wallet to CA via the 'Ujimora wallet' option on web /campaigns/<CA> (or the Android app's wallet option).
2. As F, try a 40 GHS wallet donation to F's own CF2.
3. The accomplice requests a payout from CA.
4. The admin opens /wallets for F and looks for any freeze or hold control.

**Expect:** Record whether donating to your own campaign is blocked. There is no wallet freeze, so money can hop to other campaigns and out through payouts. All movements appear in the wallet history and ledger. The runbook includes blocking the receiving campaigns and turning off automatic payouts.

**Needs:** none beyond staging data

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/walletRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`

## GAP2-020 · P1 · Organizer has no self-serve way to end or withdraw a campaign

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Organizer with an active campaign.

**Steps:**

1. Look for End, Close, Withdraw or Delete on web /my-campaigns, the owner view of /campaigns/<id>, mobile my-campaigns and the mobile campaign detail.
2. Send DELETE /api/v1/campaigns/<id> and PATCH /api/v1/campaigns/<id> with {status:'expired'}.
3. Search Help, FAQ and the Organizer Agreement for how to close a campaign.

**Expect:** No control or endpoint exists (route not found; only PATCH /:id/slug exists). Help or the FAQ tells organizers to contact support, and the support runbook from GAP2-021 exists.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/mobile/app/my-campaigns.tsx`

## GAP2-021 · P1 · Support runbook for 'please close my campaign', done by blocking

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Campaign CC active with raised funds (some available, some pending); two QR codes (/r/<code>); a pending payout request; an active live session; donors on the leaderboard; the organizer at their plan's active-campaign limit.

**Steps:**

1. The organizer emails support from the account email. Support verifies identity.
2. The admin blocks CC with reason 'Closed at organizer request'.
3. Check /c/<slug>, /campaigns/<id>, explore, the organization profile, /leaderboard (all periods), the live watch page, /r/<code> and /qr/<code>.png, the organizer's /my-campaigns chip, and the mobile views.
4. The organizer creates a new campaign (is the slot freed?).
5. The organizer requests a payout of the remaining balance. The admin reviews it manually (automatic payouts refuse blocked campaigns).

**Expect:** The public page, explore and live stream stop at once, and the live session is ended. QR codes and short links still redirect but land on 'not found'. Donors' gifts drop out of leaderboard totals, because blocked campaigns are excluded; confirm that is acceptable. The organizer sees a red 'Blocked' with no explanation; judge the wording. The campaign slot is freed. The remaining balance can still be requested and approved by hand, and the runbook says how. The audit log records campaign.block with the reason. The product owner decides whether a neutral 'closed' status is needed at launch.

**Needs:** LiveKit credentials (live session); Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`

## GAP2-024 · P1 · In-app browser matrix: share, campaign page, donate, Paystack, callback

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** An Android phone and an iPhone with WhatsApp, Facebook, Messenger, Instagram and X installed. Campaign CW. Paystack test mode (card and MoMo).

**Steps:**

1. From web /c/<slug>, use the Share menu (WhatsApp, Facebook, X, 'Copy link / share on Instagram') to send the link to a second phone.
2. Open the link inside each app's built-in browser. Check the campaign page, images and the link preview card in the chat.
3. Tap Donate to reach /c/<slug>/donate. Enter amount and email and press Give. Complete card, then MoMo, on Paystack.
4. Land on /donate/callback. Press Share, then 'Back to campaign'.
5. Record pass or fail for each app and OS, with screenshots.

**Expect:** Every in-app browser completes the flow with exactly one charge and shows success within the polling window. Blocked features fall back gracefully ('Could not copy the link...', snackbar messages). Link previews show the campaign title and image. Nothing blocks the Paystack redirect.

**Needs:** Paystack test keys; physical devices

**Source:** `apps/web/src/components/campaigns/ShareCampaignButton.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/DonateCallbackPage.tsx`

## GAP2-025 · P1 · Callback opened in a different browser, or after 'Open in browser'

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** A payment started inside the Instagram or Facebook in-app browser.

**Steps:**

1. On the Paystack page choose 'Open in Safari/Chrome' and finish there.
2. Copy a finished /donate/callback?reference=<ref> URL into a desktop browser.
3. Open /donate/callback?trxref=<ref> (the alternate parameter).

**Expect:** Status resolves from the reference alone (format uf-<intentId>-<8 hex>) and shows success. 'Back to campaign' falls back to /campaigns/<id>, because the slug is unknown without the stored handoff. No donor personal data is shown. No second charge.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/web/src/lib/fundraising.ts`

## GAP2-027 · P1 · Old and low-end browsers: old Android Chrome and WebView, Android Go, KaiOS, Opera Mini, UC Browser

*Surfaces:* web  ·  *Type:* cross-platform

**Before:** Devices: Android 8 with Chrome or WebView older than 92 (no crypto.randomUUID); an Android Go phone; a KaiOS 2.5 or 3 feature phone; Opera Mini in extreme data-saving mode; UC Browser. Production build uses Vite 8's default modern target.

**Steps:**

1. Open /c/<slug>, /c/<slug>/donate, /creators/<handle>, /donate/callback?reference=<ref> and /tip/callback?reference=<ref>.
2. Try a donation and a tip on each device.
3. Check whether the page offers any fallback or noscript message when the bundle fails.

**Expect:** The minimum working versions are recorded and a supported-browser statement is published. Where the bundle cannot run, users see a readable message, not a blank page. Where crypto.randomUUID is missing, Give and Tip must fail with a clear message rather than silently. Decide on a polyfill or legacy build if Ghana traffic needs it.

**Needs:** physical legacy devices; Paystack test keys

**Source:** `apps/web/vite.config.ts`, `apps/web/src/lib/fundraising.ts`, `apps/web/src/lib/tipCheckout.ts`, `apps/web/src/router.tsx`

## GAP2-028 · P1 · Donation, callback polling and tip flow under 2G and 3G throttling

*Surfaces:* web  ·  *Type:* cross-platform

**Before:** Chrome DevTools custom profile (2G: about 250 kbps and 300 ms RTT; Slow 3G) plus a real MTN or Telecel 3G SIM. Empty cache.

**Steps:**

1. Load /c/<slug>, then /c/<slug>/donate (a lazy-loaded chunk). Measure time until the Give button responds.
2. Double-tap Give.
3. Pay on Paystack, then on /donate/callback let polling reach its limit (15 checks, 2 s apart). Press 'Keep checking'.
4. Run a tip on /creators/<handle> and /tip/callback (20 checks, 3 s apart).

**Expect:** Pages become usable within the agreed budget (proposed: under 15 s on 2G). Give is disabled while submitting, so a double tap sends one request. After about 30 s the callback shows 'Still confirming your payment... don't pay again', and 'Keep checking' resumes. Success is never shown before the server reports SUCCEEDED.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/web/src/pages/CreatorTipCallbackPage.tsx`

## GAP2-031 · P1 · Web realtime flag (VITE_SSE_ENABLED) in the Vercel production build

*Surfaces:* web  ·  *Type:* functional

**Before:** Access to the Vercel web project, production deployment.

**Steps:**

1. In the Vercel dashboard, open Settings, then Environment Variables (Production), and check VITE_SSE_ENABLED.
2. Open a campaign or live page in two browsers. Donate in one and watch the other for live totals.
3. In DevTools, look for an EventSource to /api/v1/campaigns/<id>/events through the Vercel rewrite. Leave the page open 10 minutes and watch for disconnects and reconnect backoff.

**Expect:** A decision is recorded. If realtime is ON: totals update within seconds and the stream survives or reconnects cleanly through Vercel's external rewrite, with no console error storm. If it is intentionally OFF (it is missing from apps/web/.env.production): the product copy must not promise live totals.

**Needs:** Vercel dashboard; Paystack test keys

**Source:** `apps/web/.env.production`, `apps/web/src/hooks/useSSE.ts`, `apps/web/src/hooks/useLiveTotals.ts`, `apps/web/vercel.json`

## GAP2-032 · P1 · /sitemap.xml on app.ujimora.com returns the API sitemap, not index.html

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Production or preview web deployment.

**Steps:**

1. curl -sI https://app.ujimora.com/sitemap.xml and record the status and content-type.
2. curl -s https://app.ujimora.com/sitemap.xml | head.
3. Compare with https://api.ujimora.com/sitemap.xml.
4. Submit it in Google Search Console, then fetch robots.txt.

**Expect:** The app host must return XML (application/xml) listing app.ujimora.com URLs. CURRENT: vercel.json has no /sitemap.xml rewrite, so the catch-all probably serves index.html (text/html). Fix by adding a /sitemap.xml rewrite to https://api.ujimora.com/sitemap.xml before the catch-all, then re-test. The sitemap response carries no noindex X-Robots-Tag header.

**Needs:** Vercel; Google Search Console

**Source:** `apps/web/vercel.json`, `apps/web/public/robots.txt`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`

## GAP2-033 · P1 · Every marketing link to the web app points at production

*Surfaces:* marketing  ·  *Type:* functional

**Before:** ujimora.com production deployment; access to the Vercel marketing project environment.

**Steps:**

1. On desktop and in the mobile menu, click every link to the app in the Navbar, Hero, CTA and Organizations sections and on the For Organizations and Features pages.
2. Search the production JS bundles for 'localhost:8200'.
3. Check that VITE_WEB_APP_URL in Vercel is not overriding .env.production with an empty value.

**Expect:** Every link goes to https://app.ujimora.com/... and the bundles contain no localhost URL.

**Needs:** Vercel dashboard

**Source:** `apps/marketing/src/components/Navbar.tsx`, `apps/marketing/src/components/sections/HeroSection.tsx`, `apps/marketing/src/components/sections/CTASection.tsx`, `apps/marketing/src/components/sections/OrganizationsSection.tsx`, `apps/marketing/src/pages/ForOrganizationsPage.tsx`, `apps/marketing/src/pages/FeaturesPage.tsx`, `apps/marketing/.env.production`

## GAP2-034 · P1 · Uploads near the size limit through the /api/v1 rewrite

*Surfaces:* admin, android, ios, web  ·  *Type:* negative/edge

**Before:** JPEG and PDF files of 3.9, 4.4, 4.9 and 5.5 MB. Cloudinary configured.

**Steps:**

1. On app.ujimora.com, upload each file for KYC (/kyc) and as a campaign image (/campaigns/new). Record the network status and response body.
2. Repeat on mobile, which uploads straight to api.ujimora.com.
3. The admin opens the uploaded KYC documents (60-second private links).

**Expect:** Files within the stated 4 MB limit succeed on web and mobile. Oversized files get a clear message (client-side, or the API's JSON 'File is too large (max 4MB)'), never a Vercel HTML 413 or a hang. The server hard cap (5 MB) disagrees with the 4 MB message; align both with Vercel's proxy body limit.

**Needs:** Cloudinary; Vercel

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/web/src/lib/uploadImage.ts`, `apps/web/vercel.json`

## GAP2-035 · P1 · Web redeploy while a donor has the site open

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** The ability to deploy a trivial web change to a preview or production alias.

**Steps:**

1. Open /c/<slug> without visiting the donate page yet. Deploy a new build. Click Donate.
2. Separately, open /c/<slug>/donate and fill the form. Deploy. Then press Give.
3. Keep /donate/callback polling while a deploy happens.

**Expect:** A failed chunk load shows 'This page needs a refresh' with a Refresh button (RouteError), not a blank page. Refreshing loads the new build; losing the typed form data is acceptable and documented. A DonatePage that was already loaded still submits once. Callback polling carries on. Consider an automatic reload on vite:preloadError.

**Needs:** Vercel; Paystack test keys

**Source:** `apps/web/src/router.tsx`, `apps/web/src/components/RouteError.tsx`

## GAP2-039 · P1 · Backfill donation intents that lack minor-unit fields: runbook and rehearsal

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging snapshot. A one-off runner that calls backfillContributionMinorUnits() (none exists in scripts/ or package.json).

**Steps:**

1. Count intents with no originalAmountMinor.
2. Check the admin payment timeline and try a refund on one legacy intent BEFORE the backfill.
3. Run the backfill, then run it again.
4. Spot-check 20 records: originalAmountMinor = round((amount + tip) x 100), fxRate 1, fxSource 'legacy-backfill'.
5. Run audit-donation-settlement.ts and repeat the timeline and refund checks.

**Expect:** The first run updates N records and the second updates 0. Values are exact. Refunds and admin views work on legacy intents. The runbook is added to the docs.

**Needs:** Staging snapshot

**Source:** `apps/api/src/infrastructure/database/backfillContributionMoney.ts`, `apps/api/scripts/audit-donation-settlement.ts`

## GAP2-040 · P1 · Repair legacy wallet donations that have no journal

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Staging snapshot. Read-only credentials for the audit.

**Steps:**

1. Run 'npx tsx scripts/audit-donation-settlement.ts <fixed cutoff>' and keep paging until nextCursor is null. Keep the JSON output.
2. For each proven legacy wallet gift with no journal, run 'node scripts/reconcile-legacy-wallet-donation.mjs <donationId>' (dry run) and review the output.
3. Run it with --apply on staging, then run it again.
4. Re-run the audit and compare campaign balances.

**Expect:** Exit codes (0, 2, 1) are understood. Each repair creates exactly one journal entry (externalRef legacy-wallet-repair:<id>). The second run reports 'already-reconciled'. Records without a matching debit are refused ('No matching wallet debit; cannot reconcile'). Production is repaired only after review.

**Needs:** Staging snapshot

**Source:** `apps/api/scripts/reconcile-legacy-wallet-donation.mjs`, `apps/api/scripts/audit-donation-settlement.ts`, `docs/compliance/HISTORICAL_DONATION_AUDIT.md`

## GAP2-041 · P1 · Historical aggregates and donations without intents reconcile

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Staging snapshot.

**Steps:**

1. For every campaign, compute the sum of donations by currency, raisedAmount, CampaignBalance (available + pending + paid out + fees) and the ledger's campaign net.
2. List donations with no DonationIntent.
3. Compare leaderboard and homepage totals with these sums.

**Expect:** Every difference is listed and explained. Corrections are made only with reviewed, idempotent scripts; succeeded intents are never replayed. Sign-off is recorded in HISTORICAL_DONATION_AUDIT.md.

**Needs:** Staging snapshot

**Source:** `docs/compliance/HISTORICAL_DONATION_AUDIT.md`, `apps/api/src/infrastructure/audits/donationSettlementIntegrity.ts`

## GAP2-043 · P1 · An abandoned tip blocks the supporter's next tip in the same browser

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** A creator with a paid plan and tips enabled. A guest browser.

**Steps:**

1. As a guest on /creators/<handle>, tip 10 GHS and abandon the Paystack page.
2. Return and tip 20 GHS.
3. Tip 10 GHS again.
4. Clear site data and tip 20 GHS.

**Expect:** CURRENT: the stored attempt key is reused, because it is only released on SUCCEEDED or FAILED. The 20 GHS tip fails with 409 'This checkout request key was already used for different details.' The same amount replays the old checkout. Nothing moves abandoned tips to FAILED. A recovery path is needed before launch (key timeout or server-side abandonment handling). Clearing site data works around it.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/tipCheckout.ts`, `apps/web/src/pages/CreatorTipPage.tsx`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`

## GAP2-044 · P1 · Affiliate commissions do not mature unless the affiliate visits (no batch job)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Staging with AFFILIATE_HOLD_DAYS=1 (or maturesAt moved back). Affiliate AF with a held commission past maturity. AF does not open /affiliate.

**Steps:**

1. Check held and available amounts in admin /affiliates, /affiliates/<id> and the affiliate payouts queue.
2. AF opens /affiliate. The admin refreshes the same pages.
3. AF requests a payout.
4. Seed 5,000 held commissions across affiliates and time the /affiliate dashboard load.

**Expect:** Admin views show stale 'held' amounts until AF visits; MatureAffiliateCommissionsUseCase is exposed on app.locals but never scheduled. After the visit, the balances move. A payout request matures commissions first. The dashboard loads every matured held commission platform-wide, so measure the latency. Decide on a cron before launch.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/MatureAffiliateCommissionsUseCase.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/api/src/app.ts`, `apps/api/src/main.ts`

## GAP2-045 · P1 · Background timers resume after a Render sleep, restart or deploy

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** An API on the same Render plan as render.yaml (plan: free). Log access.

**Steps:**

1. Leave the API idle for 20 minutes so it sleeps.
2. Trigger traffic (a Paystack test webhook or a page view) and measure the cold start.
3. Within 5 minutes, check that each job ran: outbox (60 s), activity alerts (30 s), reconciliation (5 min, needs PAYMENTS_RECONCILIATION_ENABLED), tip cleanup (5 min), live safety (30 s), account erasure (60 s), store billing (60 s).
4. Deploy or restart, and check the boot sweep log lines (outbox, tip cleanup, erasure, live safety, activity, store billing).
5. Leave an abandoned PENDING donation intent and confirm it is reconciled after the wake-up.

**Expect:** Every job resumes after wake-up and after a restart. Work that needs the API to stay up (stale-intent reconciliation, subscription-expiry alerts) has a fallback: a paid always-on instance, or an external cron hitting POST /api/v1/admin/reconciliation. The decision about the free plan is logged.

**Needs:** Render dashboard; Paystack test keys

**Source:** `apps/api/src/app.ts`, `apps/api/src/main.ts`, `render.yaml`

## GAP2-046 · P1 · /health reports ok while MongoDB is unreachable

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** A staging API with the ability to block its database connection (Atlas IP access list).

**Steps:**

1. Once the API is running, block MongoDB access.
2. curl /health and /api/v1/campaigns.
3. Watch what the Render health check and any uptime monitor do.

**Expect:** /health still returns 200 while data endpoints fail, so Render will not restart the instance. Add a database ping to /health or point the external monitor at a data-backed endpoint, then re-test.

**Needs:** MongoDB Atlas access; uptime monitor

**Source:** `apps/api/src/app.ts`, `render.yaml`

## GAP2-047 · P1 · Paystack webhook arrives while the API is asleep

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A sleeping API instance. Paystack test mode.

**Steps:**

1. Let the API sleep. Complete a card donation.
2. Watch the webhook delivery attempts in the Paystack dashboard, and the donor's /donate/callback (its verify call wakes the API).

**Expect:** The donation settles exactly once, through verify or a retried webhook. The callback shows success or 'Keep checking'. There is no duplicate settlement or double count in the ledger.

**Needs:** Paystack test keys; Render

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`

## GAP2-051 · P1 · Public donation-intent endpoints cannot be abused

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A's intents: one PENDING, one SUCCEEDED, and one freshly CREATED (sent right after create, before the Paystack initialization finishes).

**Steps:**

1. With no token: GET /api/v1/donation-intents/<id>/public. Inspect the body for email, name or phone.
2. POST /donation-intents/<id>/verify with {reference:'wrong'}.
3. POST /donation-intents/<id>/payment-attempts with {provider:'paystack', status:'initiated', providerRef:'attacker-ref'} against each state.
4. Send 50 fast requests to trigger the rate limiter.

**Expect:** The public view contains no donor personal data. A wrong reference returns 404. On PENDING or SUCCEEDED intents an attempt row is recorded but status and providerRef do not change. On a CREATED intent, providerRef CAN currently be overwritten (updateStatus sets it); check that the real payment still settles, otherwise log a security bug and require ownership or a signed attempt. The rate limiter returns 429.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`, `apps/api/src/application/use-cases/RecordPaymentAttemptUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`

## GAP2-052 · P1 · Register and refund live-mode smoke-test money after production QA

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** A written register filled in DURING live smoke tests (for example DONATE-078, WALLET-016, payout tests): accounts, campaigns, intent ids, Paystack references, payouts, top-ups, coupons, plans, affiliates, short links, Paystack recipients, KYC documents.

**Steps:**

1. After the smoke tests, refund every live donation through POST /api/v1/admin/payments/<intentId>/refund with an Idempotency-Key.
2. Confirm each refund in the Paystack live dashboard and check the compensating journal entries.
3. Record payouts to the team's own accounts as test expenses, with evidence.
4. Reconcile platform revenue and fees against the register.

**Expect:** Every live-money artifact is accounted for. The ledger balances (append-only; corrections are compensating entries, never deletions). Refunds complete. Finance signs off the adjustments.

**Needs:** Paystack LIVE keys; admin API token

**Source:** `apps/api/src/infrastructure/database/models/JournalEntryModel.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## GAP2-053 · P1 · Remove QA campaigns and accounts from public pages, leaderboards and analytics

*Surfaces:* admin, android, ios, marketing, web  ·  *Type:* functional

**Before:** Live QA campaigns and accounts from GAP2-052.

**Steps:**

1. Block each QA campaign with reason 'QA test data'.
2. Delete each QA account (web Settings, Delete account; app delete-account screen).
3. Check explore, organizations, /leaderboard (all periods and categories), homepage and marketing stats, admin Overview and Reports totals, and affiliate referral stats.

**Expect:** QA campaigns disappear from public pages. Deleted accounts' donations are anonymized and leave the leaderboard. Guest QA gifts to campaigns that stay public remain in 'All' totals. Admin analytics still include the QA money, because no model has a test flag; record manual adjustments or add an exclusion.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## GAP2-055 · P1 · Subscription checkout tax disclosure matches the Billing Terms

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** Paid plans configured. Paystack test keys. An accountant available.

**Steps:**

1. On web /subscription, pick a paid plan (monthly, then yearly) and open the checkout summary. Record the base price, coupon and final amount lines.
2. Continue to Paystack. Compare the charged amount, the Paystack receipt and the SubscriptionCallbackPage amount.
3. Read the Billing Terms line 'Checkout discloses the total price, any taxes or fees, the billing interval and renewal terms before confirmation.'

**Expect:** The accountant records whether VAT, NHIL, GETFund or the COVID-19 levy apply. If tax applies, checkout and receipts show it and agree to the pesewa. If not, the terms are corrected. Checkout, Paystack and the callback amounts are identical.

**Needs:** Paystack test keys; tax adviser

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `packages/types/src/legal.ts`, `docs/compliance/READINESS.md`

## GAP2-056 · P1 · Store subscription prices and receipts (App Store and Google Play)

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** iOS sandbox tester and Google Play license tester. Store products configured.

**Steps:**

1. Buy each tier in sandbox on iOS and Android.
2. Record the price shown in the app (the store's localized price), the tax line on the store receipt, and the in-app subscription status afterwards.
3. Check that the app never shows web prices or links to web checkout.

**Expect:** The app shows only store prices and the stores handle tax. Finance records whether store tax remittance covers Ujimora's Ghana obligations. The entitlement tier is correct. No anti-steering violations.

**Needs:** App Store and Play sandbox

**Source:** `apps/mobile/src/screens/SubscriptionScreen.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`

## GAP2-057 · P1 · Tax treatment and disclosure of platform, payout and withdrawal fees and optional tips

*Surfaces:* admin, web  ·  *Type:* compliance

**Before:** A 100 GHS gift with a 5 GHS optional tip. A campaign payout of each type. A creator withdrawal.

**Steps:**

1. Record the platform fee, processor fee and campaign net in the settlement breakdown and on the organizer's payout screen.
2. Record the priority, early and urgent payout service fees and the creator withdrawal fee shown before confirmation.
3. Check how admin revenue reports classify fees and tips.
4. The accountant reviews whether each is a VAT-able supply and whether receipts or invoices must show VAT and Ujimora's TIN.

**Expect:** Each fee is shown before confirmation (as legal.ts promises). The accountant signs off the tax treatment of every revenue line. No donor-facing claim of tax deductibility.

**Needs:** tax adviser

**Source:** `packages/types/src/legal.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `docs/compliance/READINESS.md`

## GAP2-058 · P1 · GRA registration and the external tax gate C21

*Surfaces:* api  ·  *Type:* compliance

**Before:** A named Ghana tax adviser.

**Steps:**

1. Go through the checklist: company TIN; VAT registration threshold and obligation; e-VAT invoicing; withholding tax on payouts to organizers, creators and affiliates; gift tax guidance (the GH-TAX row).
2. Record the evidence against READINESS C21.

**Expect:** C21 moves from EXTERNAL GATE to signed off, with the adviser named, or a documented launch decision.

**Needs:** tax adviser

**Source:** `docs/compliance/READINESS.md`

## GAP2-060 · P1 · Flutterwave webhook authentication

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging with FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_SECRET_HASH set to sandbox values.

**Steps:**

1. Send: no verif-hash; a wrong hash of the same length; a hash of a different length; the correct hash with malformed JSON; the correct hash with no tx_ref; the correct hash with an unknown tx_ref; the correct hash with event 'transfer.completed'.
2. Clear FLUTTERWAVE_WEBHOOK_SECRET_HASH (secret key still set) and send the correct hash.

**Expect:** 401, 401, 401, 400, 200 (no-op), 200 (no-op), 200 (no-op), with no database changes. With the hash unset, every request returns 401.

**Needs:** Flutterwave sandbox keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/FlutterwaveGateway.ts`, `apps/api/src/application/use-cases/HandleFlutterwaveWebhookUseCase.ts`

## GAP2-061 · P1 · Flutterwave settlement is re-verified by tx_ref and is safe to replay

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging: PAYMENTS_FLUTTERWAVE_ENABLED=true, sandbox keys. The web app has no provider selector, so use the API.

**Steps:**

1. POST /api/v1/donation-intents with providerPreference 'flutterwave' and donorEmail. Pay in the Flutterwave sandbox.
2. Replay the valid webhook 3 times.
3. Send a correctly hashed webhook for an intent whose Flutterwave transaction failed.
4. Send a correctly hashed webhook whose body claims a larger amount than was actually paid.
5. Check the intent status, payment attempts, campaign total, journal and coupon seat.

**Expect:** One settlement however many replays. A failed verification marks the intent FAILED and releases any coupon seat. The body's amount is never trusted; the server re-verifies. A currency or amount mismatch is not credited, is recorded as a failed attempt and is logged as a warning.

**Needs:** Flutterwave sandbox keys

**Source:** `apps/api/src/application/use-cases/HandleFlutterwaveWebhookUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## GAP2-062 · P1 · Flutterwave switched off while its keys are still set

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Keys set, PAYMENTS_FLUTTERWAVE_ENABLED=false. A Flutterwave intent created earlier while the flag was on and paid in the sandbox.

**Steps:**

1. POST /api/v1/donation-intents with providerPreference 'flutterwave'.
2. Check the public payment-provider list and the admin Payment providers toggle.
3. Send a valid webhook for the earlier intent.

**Expect:** New Flutterwave intents are refused. The earlier intent still settles, because the webhook is not gated by the flag; document this as intended, since it avoids stranding money already paid. The admin database toggle does not stop charges, so the runbook uses the env flag.

**Needs:** Flutterwave sandbox keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/services/PaymentRouter.ts`, `docs/payments/DIASPORA_PAYMENTS_PLAN.md`

## GAP2-063 · P1 · Multi-currency and international card rehearsal with all flags on

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Staging: PAYMENTS_MULTI_CURRENCY_ENABLED=true, PAYMENTS_INTERNATIONAL_CARDS_ENABLED=true, PAYMENTS_SUPPORTED_CURRENCIES=GHS,USD,GBP,EUR,CAD, PAYMENTS_FX_SOURCE=provider. Paystack international-card eligibility, or the Flutterwave sandbox.

**Steps:**

1. Using the API (the web app has no currency selector), create and pay intents for USD 10.00, GBP 7.35, EUR 9.99 and CAD 13.50, with country set.
2. Inspect each intent: originalAmountMinor, originalCurrency, settlementAmountMinor, settlementCurrency, fxRate, fxSource. Check the admin payment timeline.
3. Check that amount = net + platform + processor in minor units, then check the campaign raisedAmount and balance (GHS), the journal, the leaderboard (GHS only) and an organizer payout (GHS only).
4. Try JPY (unsupported), then turn the flags off and retry USD.

**Expect:** Fee splits balance exactly. The campaign total rises by the GHS equivalent; if the settlement currency differs from the campaign currency, the raised total must not be silently skipped (incrementRaised matches on currency). The FX rate and source are recorded. Foreign-currency gifts are left out of the leaderboard; confirm that is accepted. Payouts are GHS only. Unsupported currencies are rejected, and everything is rejected once the flags are off.

**Needs:** Paystack international eligibility or Flutterwave sandbox

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/services/PaymentRouter.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `render.yaml`

## GAP2-064 · P1 · Refunding a foreign-currency gift

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A settled USD gift via Paystack and a settled gift via Flutterwave (from GAP2-063).

**Steps:**

1. POST /api/v1/admin/payments/<paystack USD intent>/refund, full and partial, each with an Idempotency-Key.
2. POST /api/v1/admin/payments/<flutterwave intent>/refund.
3. Check the journal, the campaign GHS balance and the provider dashboards.

**Expect:** The Paystack refund is in the original currency. The ledger compensation reverses the GHS amount originally credited; no re-conversion at a new rate. The Flutterwave refund returns 501 'Flutterwave refunds are not enabled' with nothing reversed locally. The runbook is: refund in the Flutterwave dashboard, then record the compensation. Decide whether Flutterwave can launch without refunds.

**Needs:** Paystack and Flutterwave sandbox keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/FlutterwaveGateway.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `docs/payments/DIASPORA_PAYMENTS_PLAN.md`

## GAP3-001 · P1 · Coupon hard-deleted while a Paystack subscription checkout is pending: affiliate commission must still use the elected LIST_PRICE base

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with Paystack test keys and a reachable webhook. Affiliate A with a referral code. User U registered via app.ujimora.com/register?ref=<A's code>, so a one-time commission is due. Admin with COUPONS delete permission. Coupon SAVE50 created at admin /coupons: Discount Type Percent, Amount 50, 'Where it can be used' = Subscription, 'Affiliate commission on a discounted sale' = 'Full list price'. An identical control coupon CTRL50. DB read access to CouponRedemption and affiliate commission rows.

**Steps:**

1. As U, open app.ujimora.com/subscription, choose a paid plan (note list price P), enter SAVE50 in 'Coupon code (optional)' and confirm the preview shows 50% off. Continue to the Paystack test checkout and stop on the payment page.
2. As admin, open admin /coupons, click the Delete icon on SAVE50, confirm 'Delete Coupon?' > Delete, and confirm the snackbar 'Coupon deleted'.
3. Back in U's tab, pay with a Paystack success test card.
4. Wait for the charge.success webhook (or refresh /subscription/callback), then reload /subscription.
5. Inspect U's CouponRedemption row (providerRef = sub-...), the affiliate commission row for sourceRef sub-..., A's earnings on app.ujimora.com/affiliate, and the API logs for the settlement.
6. Repeat steps 1-5 with user U2 (also referred by A) using CTRL50, which is not deleted.

**Expect:** U is charged exactly P x 0.5 (the locked price) and the plan activates (ACTIVE, 30-day period). The redemption row becomes CONSUMED. U's commission must equal U2's control commission, i.e. computed on the full list price P as elected. Current code falls back to finalAmount (P x 0.5) when the coupon no longer exists (SettleSubscriptionUseCase L139-144) and logs 'coupon was already at its global limit'. If U's commission is half of U2's, file a money defect (owed affiliate funds lost silently, misleading log). The webhook is acknowledged with 200 and there are no 5xx errors.

**Needs:** Paystack test keys + webhook tunnel; affiliate program enabled

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.ts`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/admin/src/pages/CouponsPage.tsx`, `apps/admin/src/components/coupons/CouponFormFields.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`

## GAP3-002 · P1 · Coupon edited (amount, commission base, cap, active flag) while checkouts using it are in flight

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Coupon EDIT30 (Percent 30, Subscription surface, 'Full list price', Max Redemptions 1). Users U1 and U2, both referred by affiliate A. Paystack test keys.

**Steps:**

1. U1 applies EDIT30 at app.ujimora.com/subscription and stops on the Paystack page.
2. Admin opens EDIT30 at admin /coupons, changes Amount 30 -> 10 and the commission base to 'Amount actually charged', and clicks Update.
3. U2 applies EDIT30 on /subscription. Confirm the preview now shows 10% and stop on the Paystack page.
4. Admin switches EDIT30 to inactive (Active off) and clicks Update.
5. U1 and U2 both complete payment. A third user U3 tries to apply EDIT30.
6. Check the charged amounts in the Paystack dashboard, both subscriptions, the Redemptions column for EDIT30 at /coupons, the redemption rows, the commission rows, and the API logs.

**Expect:** U1 pays the 30%-off price quoted at checkout creation. U2 pays the 10%-off price. Both plans activate even though the coupon is now inactive or at its cap; the activation stands and a warning is logged for the one over the cap. The Redemptions counter never exceeds Max Redemptions (1). Commission for both uses the commission base that was current at SETTLEMENT (post-edit: amount actually charged). Confirm this matches the written policy; if the policy is 'base elected at checkout time', file a defect. U3's preview is rejected with a clear 'invalid/inactive coupon' message. Nobody is charged a price different from the one they saw.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/couponRoutes.ts`

## GAP3-003 · P1 · Donation fee-waiver coupon deleted between intent creation and the Paystack webhook: donation settles at the waived fee and the ledger balances

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Coupon FEEFREE with 'Where it can be used' = Donation (full fee waiver), Per-User Limit 1. Active campaign C whose creator's plan fee % is known. Donor D signed in on web (on iOS native, donations open Safari, so test on web). Paystack test keys. DB read access to journal lines.

**Steps:**

1. D opens app.ujimora.com/c/<C slug>/donate, enters GHS 100, types FEEFREE in 'Fee waiver code (optional)', confirms the breakdown shows the platform fee waived, continues to Paystack and stops on the payment page.
2. Admin deletes FEEFREE at admin /coupons.
3. D pays with a success test card.
4. After the webhook, check: D's app.ujimora.com/donations entry, C's raised and available amounts, the admin /donations row, the journal lines for the intent (platform fee line), the CouponRedemption row whose providerRef = intent id, and the API logs.

**Expect:** The intent is SUCCEEDED and exactly one Donation row exists. The campaign net is credited with the fee waived as locked at intent creation (platform fee 0). The journal balances (debits = credits in minor units). The redemption row is CONSUMED. The coupon counter cannot be bumped, and a warning is logged; its wording 'already at its global limit' is misleading for a deleted coupon, so file a P2 observability note. There is no 409/5xx, and realtime, receipt and activity behave as for any donation.

**Needs:** Paystack test keys + webhook

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/donationCouponSeats.ts`, `apps/web/src/pages/DonatePage.tsx`

## GAP3-016 · P1 · Automatic payout claimed just before 00:00 UTC and verified after it: goes to manual review, money is never double-counted

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** 'Enable automatic payouts' on in admin Settings: 'Daily limit per owner (GHS)' 1000, 'Daily platform limit (GHS)' 5000. Organizer O is KYC-verified, with a destination that has a previous manually approved PAID payout and a recent review. Campaign available balance >= GHS 400. Paystack test transfers. DB read access to AutomaticPayoutBudget and Payout.

**Steps:**

1. At about 23:59:55 UTC, O requests a GHS 200 standard cashout from the campaign cashout panel.
2. Watch the payout status and automationReason at admin /payouts and on O's dashboard.
3. Inspect the AutomaticPayoutBudget docs `<D>:owner:<O>`, `<D>:platform` and the `<D+1>` keys, and the payout's autoClaimDay.
4. If it fell to manual review, have the admin approve it from the review queue.
5. At 00:05 UTC, O requests another GHS 200.

**Expect:** If claim and verification land on different UTC days, the payout goes to manual review with a clear reason ('Automatic budget claim is unavailable or expired; manual review required.' or 'Automatic initiation needs attention...'). It is never stuck without a reason and never paid twice. The day-D budget shows usedMinor 20000 even though it was not auto-paid; confirm this is documented. Day D+1 starts fresh and the 00:05 request auto-processes. The campaign available, pending and paid-out balances and the ledger reconcile exactly with the payouts made.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/admin/src/components/AutomaticPayoutSettings.tsx`

## GAP3-019-2 · P1 · Web: device clock BEHIND real time by more than the access-token TTL

*Surfaces:* admin, web  ·  *Type:* negative/edge

**Before:** Desktop test machine with automatic time off. A member account and an admin account. Access token TTL is 15 min (AuthTokenService default).

**Steps:**

1. Set the OS clock 30 minutes behind real time.
2. Sign in at app.ujimora.com/login.
3. Use the app continuously for 20 minutes (dashboard, donations, settings), keeping a Settings form half-edited.
4. At minutes 16-20, save Settings.
5. In devtools, watch for /auth/refresh calls and any 401 responses.
6. Repeat on admin.ujimora.com (the same browserSession library).
7. Repeat with the clock only 2 minutes behind.

**Expect:** The session must survive, either by refreshing before the server-side expiry or by recovering from a 401 with a single refresh and retry. Current code decides refresh timing from the device clock, and web api.ts expires the session on any 401. The user will likely see 'Your session has expired' at about 15 min and lose the unsaved input. If so, file a P1 auth defect. A 2-minute skew causes no issue.

**Needs:** none

**Source:** `packages/ui/src/browserSession.ts`, `apps/web/src/lib/api.ts`, `apps/api/src/application/services/AuthTokenService.ts`

## GAP3-020-2 · P1 · Web: device clock AHEAD, and a manual forward clock jump

*Surfaces:* web  ·  *Type:* negative/edge

**Before:** Desktop with automatic time off. A member account.

**Steps:**

1. Set the clock 30 minutes ahead and sign in.
2. Browse for 5 minutes with two tabs open, and count /auth/refresh calls in each tab.
3. Leave the app idle for 10 minutes, then click around.
4. While signed in, move the clock forward by 2 hours and click a link.

**Expect:** There is no refresh storm: at most one refresh per burst per tab, and concurrent refreshes across tabs do not cause refresh-token reuse errors or logouts. The 2-hour jump triggers the 60-minute idle logout. That is acceptable if documented, with RequireAuth showing 'Your session has expired' and the user returning to the same page after signing in. A timezone-only change never logs the user out.

**Needs:** none

**Source:** `packages/ui/src/browserSession.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/components/auth/RequireAuth.tsx`

## GAP3-021-2 · P1 · Native: clock skew, manual clock jumps and timezone travel

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Physical devices with automatic date/time off. A member account.

**Steps:**

1. Set the clock 30 minutes behind, sign in and use the app for 20 minutes, performing saves at minutes 16-20.
2. Set the clock 30 minutes ahead and repeat.
3. Turn automatic time back on and change only the timezone (Accra -> Los Angeles) while signed in.
4. Background the app for 59 minutes and resume, then repeat for 61 minutes.

**Expect:** The session survives the skew, or recovers transparently through a forced refresh on 401. A timezone-only change never logs the user out. The idle logout fires only after 60 or more minutes of inactivity (IDLE_MS), and the 59-minute resume stays signed in. There are no crashes or refresh loops.

**Needs:** none

**Source:** `apps/mobile/src/lib/session.ts`

## GAP3-024 · P1 · Payout account name matching with Ghanaian name order, diacritics and middle names

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Creator on a paid plan with a tip balance >= GHS 50. Paystack account resolution available: test mode returns canned names, so use real bank or MoMo test numbers on a staging key permitted to resolve. Bank-registered names known for each account.

**Steps:**

1. At app.ujimora.com/payout-accounts (and mobile Payout accounts), add accounts where the typed name differs from the registered name: a) 'kwame mensah' vs 'KWAME MENSAH'; b) 'Mensah Kwame' vs 'KWAME MENSAH'; c) 'Kwabená Ɔpoku' vs 'KWABENA OPOKU'; d) 'Ama Owusu' vs 'AMA SERWAA OWUSU'; e) 'Owusu-Ansah' vs 'OWUSU ANSAH'.
2. Note each card's status label.
3. On /creator, request a GHS 50 creator withdrawal to each account.
4. For a needs_review account, try adding the same number again with the corrected name.
5. Remove it, then re-add it with the corrected name.

**Expect:** a) and e) show 'Registered name matched'. b), c) and d) show the needs-review label 'Ownership review at cashout'. A creator withdrawal to a needs-review account is refused with 'This payout account needs verification...', which contradicts the card's promise of review at cashout. File P1 (surname-first order is common in Ghana) unless a staff review path exists and is documented. Re-adding the same number returns the existing unmatched record, so the user must Remove first; the UI should explain this. After removing and re-adding with the exact registered name, the account matches. A Paystack resolution failure always results in needs_review, never a false match.

**Needs:** Paystack account resolution

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/web/src/components/account/PayoutAccountCard.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`

## GAP3-029 · P1 · Staff email-change runbook: identity check, change, re-verification and token invalidation

*Surfaces:* admin, api, email, web  ·  *Type:* security/permission

**Before:** The GAP3-028 correction request is open. A written staff runbook; if none exists in docs/, record a launch gap and use the steps below. Staging DB access. Before the change, U requests a password reset (the email goes to the OLD address, and the link is not yet used). A second account already uses c@example.com.

**Steps:**

1. Staff at admin /privacy-requests set the request to 'in_review' with evidence (at least 20 characters) of identity verification from both addresses.
2. Staff change users.email to the new lowercase address, set emailVerified=false and bump authVersion to revoke existing sessions, all as the runbook specifies.
3. Staff mark the request 'responded' with a response of at least 20 characters.
4. U tries to sign in with the old email, then with the new one.
5. U clicks the pending password-reset link sent to the old address.
6. U requests email verification from Settings, receives it at the new address and confirms it.
7. Staff attempt the same procedure for c@example.com.

**Expect:** The old email can no longer sign in, and the new one can. Old sessions are signed out. The old reset link is rejected: the job is suppressed on the emailHash mismatch, or the token is invalid after the authVersion bump. Activity emails need re-verification plus opt-in. U can read the response in Settings. The DataRightsEvent audit shows who did what and when. The duplicate address is refused by the unique index, and staff are told. The runbook must forbid a change without identity verification (account-takeover risk).

**Needs:** Resend email provider; staging DB access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `docs/compliance/ACCOUNT_EMAILS.md`

## GAP3-031 · P1 · Delete a saved payout account while a creator withdrawal to it is PROCESSING

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Creator on a paid plan with GHS 100 available in tips and a name-matched saved account. Paystack test transfers, with the ability to deliver transfer.success, transfer.failed and transfer.reversed webhooks manually (signed).

**Steps:**

1. At app.ujimora.com/creator, request a GHS 50 withdrawal to the saved account and confirm the payout is PROCESSING.
2. At /payout-accounts, click 'Remove saved account' on that account.
3. Deliver transfer.success for the cpay- reference.
4. Second run: repeat steps 1-2, then deliver transfer.failed. Third run: deliver transfer.success then transfer.reversed.
5. Replay each webhook twice.
6. After each run, check the creator balance buckets (available, pending, paid out), the payout status at admin /payouts and the creator's history.

**Expect:** Removal succeeds and shows 'Removed from saved accounts. Existing payout requests keep their original destination.' A success settles to PAID using the payout's own recipientCode snapshot. A failure or reversal returns exactly GHS 50 to available, once, even under replays. There are no 5xx errors. The creator can re-add an account and withdraw again. The balances reconcile to the cent.

**Needs:** Paystack test transfers + signed webhook replay

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutAccountRoutes.ts`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutAccountRepository.ts`, `apps/api/src/application/use-cases/HandleCreatorPayoutWebhookUseCase.ts`, `apps/web/src/components/account/SavedPayoutAccounts.tsx`

## GAP3-036 · P1 · KYC document uploads leave no temporary copies (success, cancel, too-large, network failure)

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Debuggable builds on a physical iPhone and Android phone so the app cache can be inspected (Xcode > Devices > Download Container; `adb shell run-as <package> ls -R cache`). Test ID images, a PDF over 4 MB, and a note of the current photo count in Photos/Gallery.

**Steps:**

1. On the KYC screen (/kyc), for ID front use 'Choose file' and upload successfully.
2. For ID back use 'Camera', take a photo and upload.
3. Open the picker from the library and cancel.
4. Pick a file over 4 MB and expect 'Choose a file smaller than 4 MB.'
5. Turn on airplane mode, pick a file and let the upload fail.
6. After each step, inspect the app cache (DocumentPicker/ImagePicker subfolders) and Photos/Gallery, and confirm the original file still exists in Files, Downloads or iCloud Drive.
7. Tap 'View private document' on an uploaded item.

**Expect:** No picker copies remain in the cache after success, failure or size rejection, and cancel creates none. Camera captures are NOT saved to Photos/Gallery. Originals outside the cache are untouched. The error 'The temporary upload copy could not be removed from this device.' never appears in normal runs. Uploaded fields show 'Uploaded', and 'View private document' opens a short-lived link.

**Needs:** Cloudinary / KYC private storage

**Source:** `apps/mobile/src/lib/uploadCache.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/kyc.tsx`

## GAP3-039 · P1 · Running two API instances: decide, then enforce or test

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Either the production scaling setting (Render instance count), or a test with 2 instances behind one URL (Render paid scaling, or two local processes behind nginx round-robin). LiveKit optional. Paystack test keys.

**Steps:**

1. Check render.yaml and the Render dashboard for the instance count and autoscaling. If scaling is not pinned to 1, continue.
2. Open a live session with the OBS overlay and two WatchLivePage viewers, and note which instance each SSE connection hit (logs).
3. Make 10 donations through the live link; the webhooks land on either instance.
4. Compare the overlay feed, the live totals, the web and mobile donor feeds, and the DB donations.
5. Send 31 bad logins alternating across the instances.
6. Check which instance runs each timer (outbox, reconciliation, erasure, store billing, live safety).

**Expect:** Either (a) 'single instance only' is documented in the runbook and render.yaml, and scaling is pinned to 1 (then this case passes by configuration), or (b) with 2 instances, every donation appears on every overlay. (b) currently FAILS because the EventBus is in-process, so events reach only clients on the instance that processed the webhook. Rate limits effectively double. Money is still exactly-once (DB gates) and the ledger is correct.

**Needs:** Second instance; Paystack test keys; LiveKit (optional)

**Source:** `apps/api/src/infrastructure/realtime/EventBus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/app.ts`, `render.yaml`

## GAP3-040 · P1 · Deploy overlap: old and new instances run boot sweeps and timers at the same time

*Surfaces:* api, email, web  ·  *Type:* recovery/idempotency

**Before:** Render staging (NODE_ENV=production, reconciliation enabled). Queued work: a donation outbox row still pending (insert one, or kill the process right after settlement), a pending account erasure, a queued store billing notification, a live session with providerStopPending, queued activity alert emails, and a PENDING donation intent older than 30 min. A script that makes one live-attributed donation per second.

**Steps:**

1. Start the donation script against a live session.
2. Trigger a manual deploy on Render while the script runs, so both instances overlap.
3. After the deploy, compare the live session stats (successfulDonations, amountRaised) with the COUNT/SUM of donations carrying that liveSessionId.
4. Count the emails received per activity event. Check the erasure completed once, the reconciliation outcome, and that the LiveKit room was closed once.
5. Check the campaign raised amount and the ledger totals.

**Expect:** The live session stats equal the actual attributed donations. incrementStats is a bare $inc and the outbox sweep has no lease, so a row dispatched twice (in-process dispatch plus a sweep from the other instance, or the 60 s timer) will double-count. That is a P2 defect: display-only and public, but the ledger is unaffected. Each email is delivered exactly once. Campaign totals and the ledger are unaffected. There are no unhandled errors.

**Needs:** Render staging; Paystack test keys; Resend; store sandbox

**Source:** `apps/api/src/main.ts`, `apps/api/src/app.ts`, `apps/api/src/application/services/OutboxDispatcher.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`

## GAP3-041 · P1 · Render free plan sleep, cold-start webhooks and SSE resume after restart

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging deployed with render.yaml as committed (plan: free). Paystack test keys. OBS overlay and a WatchLivePage open.

**Steps:**

1. Leave staging idle for 20 minutes with no requests.
2. Check the logs for whether the 5-minute reconciliation and the 60 s erasure, store billing and outbox timers ran while idle.
3. Make a Paystack test payment so the first webhook hits a sleeping service. Measure the response time and check whether Paystack logged a retry.
4. With the overlay open, restart the service (manual deploy). Watch it reconnect, then donate twice.

**Expect:** PRODUCTION must not run on the free plan: sleeping pauses every sweep, and cold starts of 30-60 s put webhook acknowledgements at risk. Confirm the production service is on a paid, always-on plan. After the restart, the overlay reconnects within about 3 s ('retry: 3000') and shows new donations even though the EventBus ids restart at 1. Totals refresh from the API, so nothing is permanently missing.

**Needs:** Render; Paystack test keys

**Source:** `render.yaml`, `apps/api/src/main.ts`, `apps/api/src/infrastructure/realtime/EventBus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`

## GAP3-042 · P1 · app.ujimora.com route-by-route smoke test at 360 px and desktop widths

*Surfaces:* web  ·  *Type:* cross-platform

**Before:** Seeded staging: an active campaign with a slug, a live session, an organization, a creator handle, and donations. Accounts: logged out, member, creator/owner. Chrome device mode at 360x740, a real Android phone (Chrome), an iPhone (Safari), and 1440x900 desktop.

**Steps:**

1. Standalone routes: /login, /register, /forgot-password, /reset-password (with no token and with a bad token), /verify-email (no token and bad token), /newsletter/confirm, /newsletter/unsubscribe.
2. Public routes: /, /explore, /organizations, /organizations/<slug>, /leaderboard, /campaigns/<id>, /c/<slug>, /c/<slug>/donate, /live/<sessionId>, /c/<slug>/live/<sessionId>, /creators/<handle>, /account-agreement, /legal, /terms, /privacy, /organizer-agreement, /contributor-terms, /refund-policy, /acceptable-use, /cookies, /billing-terms, /delete-account.
3. Callback routes with no or garbage params: /donate/callback, /subscription/callback, /tip/callback.
4. Protected routes, logged out and then logged in: /dashboard, /profile, /donations, /donations/refund/<id>, /refunds, /settings, /payout-accounts, /creator, /my-campaigns, /subscription, /affiliate, /wallet, /invitations, /kyc, /organization-team, /campaigns/new, /campaigns/<id>/live (as owner and as non-owner).
5. On each route: check the console for errors, horizontal scroll, header and footer, page title (seo.ts), back and forward navigation, and a hard refresh on the route.

**Expect:** Every route renders with no console errors and no horizontal scroll at 360 px. Logged-out protected routes show the SignInPrompt, and signing in returns to the same page. A non-owner on /campaigns/<id>/live is refused clearly. Callbacks with bad params show a safe message and never claim a payment succeeded. Tokenless reset and verify pages show a friendly error. The document title changes per page. A hard refresh on deep links works (SPA fallback on the host).

**Needs:** Seeded staging data

**Source:** `apps/web/src/router.tsx`, `apps/web/src/components/auth/RequireAuth.tsx`, `apps/web/src/components/layout/Layout.tsx`, `packages/ui/src/seo.ts`, `packages/types/src/legal.ts`

## GAP3-047 · P1 · Browser with site storage blocked: the app must not go blank, especially donation pages

*Surfaces:* web  ·  *Type:* negative/edge

**Before:** Chrome: Settings > Privacy and security > Site settings > On-device site data > 'Don't allow sites to save data' for app.ujimora.com. Firefox with dom.storage.enabled=false. Safari iOS in Private Browsing with 'Block All Cookies'.

**Steps:**

1. Load app.ujimora.com, /c/<slug> and /c/<slug>/donate in each browser.
2. Try a guest donation through to Paystack.
3. Try to sign in.

**Expect:** Public pages and the guest donation flow render and work, or a clear message asks the user to allow site data. There must never be a blank white page. ColorModeProvider calls localStorage.getItem in its useState initialisers without try/catch, above the router's RouteError boundary, and browserSession's accessToken/isIdle also read storage unguarded. If the page is blank, file a P1 defect: donors on locked-down browsers cannot donate.

**Needs:** Paystack test keys

**Source:** `apps/web/src/context/ColorModeContext.tsx`, `apps/web/src/App.tsx`, `packages/ui/src/browserSession.ts`

## GAP3-052 · P1 · Subscription (sub-) charge replayed after a refund, and refund events replayed

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** User U referred by affiliate A buys a paid plan through Paystack, and a commission accrues. Paystack test dashboard access to refund the charge. Signed webhook replay.

**Steps:**

1. Refund U's subscription charge from the Paystack test dashboard and let refund.processed arrive. Check the commission status and A's balance at /affiliate and admin /affiliates/<A>.
2. Replay refund.processed 3 times (concurrently).
3. Replay the original sub- charge.success.
4. Check U's subscription status, period end and any new commission rows.

**Expect:** The commission is reversed exactly once and A's balance is decremented once (atomic transitionStatus claim). The charge.success replay is a no-op (the checkout is already SUCCEEDED) with no new commission and 200 returned. U's subscription is unchanged, because the refund handler only claws back the commission. Confirm the policy on whether a refunded subscription should end or downgrade (P2 decision).

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`

## GAP9-047 · P2 · Content: marketing stats and other fallbacks

*Surfaces:* admin, marketing  ·  *Type:* compliance

**Before:** Access to admin /content/stats, /content/about and /content/contact.

**Steps:**

1. The home stats show 'Soft-delete / Record policy'. Compare this with account erasure (a real erasure sweep exists) and with the privacy policy.
2. Fix it in admin /content/stats and in the StatsSection fallback.
3. With the API blocked, check the About, Contact and footer social fallbacks for placeholder or empty values.

**Expect:** Stats and fallbacks are accurate and match the legal pages.

**Needs:** None

**Source:** `apps/api/src/infrastructure/database/siteContentDefaults.json`, `apps/marketing/src/components/sections/StatsSection.tsx`, `apps/marketing/src/components/Footer.tsx`

## GAP11-057 · P2 · Legacy POST /campaigns/:id/donate is not idempotent on retry

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Staging. A signed-in user with a wallet balance of at least GHS 2.

**Steps:**

1. Call POST /api/v1/campaigns/<id>/donate {"amount":1,"currency":"GHS"} twice, as a client retry would.
2. Check the wallet balance and the donations.

**Expect:** A retry does not double-debit, or the unused route is removed. Per the source each call creates a fresh random idempotency key, so two debits happen. No first-party client calls this route.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`

## GAP2-009 · P2 · Publication review decisions (profile, organization profile, creator page, live start, updates, comments) are visible only in review panels

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Users who trigger publications held for review, for example an organization profile or creator page edit with new media, a live start, or a campaign update. Admin with REPORTS permission.

**Steps:**

1. Trigger one held publication of each available type.
2. In admin /publication-reviews, approve one and reject one with notes.
3. Check the users' email, in-app and mobile notifications.
4. Open the PublicationReviews panel on web (Settings, Profile, Organization team, Creator dashboard, Campaign live) and mobile (settings, creator, profile/edit, campaign/create, campaign/live).

**Expect:** No notification of any kind. Status and reason appear only in the PublicationReviews panel of the matching screen, on both web and mobile. Rejected content stays unpublished and approved content goes live. Record whether users can find these panels unprompted.

**Needs:** Cloudinary for media

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/web/src/components/account/PublicationReviews.tsx`, `apps/mobile/src/components/PublicationReviews.tsx`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## GAP2-010 · P2 · Decisions on donor messages and tip messages: when and where the supporter learns of them

*Surfaces:* admin, android, web  ·  *Type:* functional

**Before:** A guest and a registered donor. A creator with a paid plan and tips enabled. Admin.

**Steps:**

1. Donate with a public name and message. On /donate/callback note the review badge, then close the tab.
2. Some hours later, reject the message in admin /publication-reviews (donation content reviews).
3. The donor opens /donations (if registered) and reopens the callback URL from history.
4. Repeat with a creator tip on web /creators/<handle> and /tip/callback. On Android, check the result on the creator screen (tips are unavailable in native iOS).
5. A viewer reports the donor message. The admin resolves it with 'hide message' in /safety-reports.

**Expect:** The decision is visible only on the callback page, while open or reopened with the same reference. My Donations shows no content status. No email. The tip callback shows 'not approved... contact support@ujimora.com with your payment reference'. Hiding a message silently resets it to pending. Confirm the product owner accepts that donors are never told.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationContentReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/tipContentReviewRoutes.ts`, `apps/api/src/application/use-cases/GetDonationIntentPublicUseCase.ts`, `apps/web/src/components/donate/DonationReviewStatus.tsx`, `apps/web/src/pages/CreatorTipCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## GAP2-023 · P2 · End date passes: the campaign closes without any status change

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** A campaign with the shortest allowed endDate (or adjust endDate in the staging DB) and some funds raised below its goal.

**Steps:**

1. After endDate, open the public page, /c/<slug>/donate and the mobile campaign screen.
2. Send POST /api/v1/donation-intents.
3. Check the explore filters and the admin campaigns 'Expired' filter.
4. As the organizer, request a standard payout (no early-cashout fee should apply).
5. Check whether the campaign is still on the leaderboard.

**Expect:** Nothing sets status 'expired'; the database still says active or funded. Donations are refused. The UI should clearly show the campaign has ended. A standard payout is allowed with no early fee. The admin 'Expired' filter probably shows nothing, so confirm reports and the organizer's active-campaign count treat ended campaigns correctly.

**Needs:** none

**Source:** `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/application/services/payoutFee.ts`, `apps/web/src/pages/DonatePage.tsx`

## GAP2-026 · P2 · Shared device: a callback with no reference shows the previous donor's pending gift

*Surfaces:* web  ·  *Type:* security/permission

**Before:** A shared browser (for example an internet café PC).

**Steps:**

1. Donor 1 starts a 70 GHS gift on campaign X, reaches Paystack, and abandons it.
2. Donor 2 opens /donate/callback with no query string.
3. Donor 2 presses 'Back to campaign' and Share.

**Expect:** CURRENT: the page uses the stored '__last' handoff and shows donor 1's amount and campaign status. Decide whether that is acceptable (it shows no name or email). Better: show the missing-reference message, or clear the handoff once the payment finishes.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/DonateCallbackPage.tsx`

## GAP2-030 · P2 · Browsers and in-app views with storage blocked, and private mode

*Surfaces:* web  ·  *Type:* negative/edge

**Before:** Safari private window; iOS 'Block All Cookies'; Firefox strict mode; an Android in-app browser with DOM storage disabled.

**Steps:**

1. Run a full donation in each environment.
2. Run a creator tip in each environment.
3. Try signing in and making a wallet donation.

**Expect:** Donation still works: the stored handoff is best-effort and the callback reads the reference. The tip checkout reads localStorage without a try/catch; if storage throws, the user must see an understandable error, not a dead button. Sign-in not persisting is explained.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/tipCheckout.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/CreatorTipPage.tsx`

## GAP2-042 · P2 · Tip checkout credential cleanup job, and abandoned tips keeping their credentials

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging with NODE_ENV=production. Tips: one SUCCEEDED, one FAILED, one abandoned PENDING, plus 502 synthetic terminal tips that still have checkout objects.

**Steps:**

1. Restart the API and check that the boot cleanup clears checkout on terminal tips.
2. Wait 5 minutes and check the next batch (500 per run).
3. Count PENDING tips older than 24 h that still hold checkoutUrl and accessCode.
4. Check on Paystack's side whether old access codes still open a checkout.

**Expect:** Terminal credentials are cleared at boot and every 5 minutes (at most 500 per run), and financial fields are unchanged. Abandoned PENDING tips keep their credentials indefinitely (listed as open in TIP_CHECKOUT_SAFETY.md). Decide a retention or expiry rule before launch.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoTipRepository.ts`, `apps/api/src/app.ts`, `apps/api/src/main.ts`, `docs/compliance/TIP_CHECKOUT_SAFETY.md`

## GAP2-054 · P2 · Leftover QA artifacts outside the public views

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** GAP2-053 completed.

**Steps:**

1. Check Cloudinary ujimora/kyc (authenticated) and campaign images for QA users; account erasure keeps KYC evidence.
2. Check Paystack transfer recipients and customers created during QA.
3. Check that /r/<code> and /qr/<code>.png still resolve.
4. Deactivate QA coupons (PUT /api/v1/coupons/<id>) and plans (PUT /api/v1/plans/<id>); suspend QA affiliates; delete testimonials; remove newsletter entries.
5. Check AccountDeletionRequest review dates (nextReviewAt, 7 days).

**Expect:** Each leftover is listed with an owner and a disposal method consistent with the retention policy. Nothing labelled as test data is public.

**Needs:** Cloudinary console; Paystack dashboard

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/couponRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`

## GAP2-059 · P2 · Flutterwave webhook when Flutterwave is not configured

*Surfaces:* api  ·  *Type:* security/permission

**Before:** FLUTTERWAVE_SECRET_KEY blank (production default).

**Steps:**

1. POST https://api.ujimora.com/api/v1/webhooks/flutterwave with any JSON body, with and without a verif-hash header.

**Expect:** 501 'Payments are not configured'. No database writes. The error is logged.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/flutterwaveWebhookRoutes.ts`, `apps/api/src/application/use-cases/HandleFlutterwaveWebhookUseCase.ts`, `apps/api/src/app.ts`

## GAP3-004 · P2 · Donation seat is released after failure even when the coupon is gone; donor can retry without the dead code

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Coupon FEEWAIVE2 (Donation surface, Per-User Limit 1). Donor D. payments.reconciliationEnabled=true with NODE_ENV=production on staging, OR the ability to send a signed charge.failed webhook.

**Steps:**

1. D starts a GHS 50 donation with FEEWAIVE2 at /c/<slug>/donate, then either closes the Paystack tab or uses Paystack's declined test card.
2. Admin deletes FEEWAIVE2.
3. Drive the failure: deliver the charge.failed webhook, or wait more than 30 min for the reconciliation sweep (reconcileStale).
4. Query the CouponRedemption row for this intent.
5. D opens the donate page again and enters FEEWAIVE2; after the error, D clears the field and donates GHS 50.
6. Query for any CouponRedemption rows still PENDING and older than 30 min.

**Expect:** The seat becomes RELEASED even though the coupon no longer exists (releaseDonationSeat needs only the redemption row). Re-entering the deleted code shows a clear 'invalid code' error. After clearing the field, D can donate at the normal fee. No orphan PENDING seats remain.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/donationCouponSeats.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

## GAP3-005 · P2 · Deleting and re-creating a coupon code resets its per-user and global limits (abuse check)

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Coupon ONCE (Subscription or Donation surface, Per-User Limit 1, Max Redemptions 5). User U has already redeemed it successfully once.

**Steps:**

1. As U, try to apply ONCE again and confirm it is refused (per-user limit).
2. As admin, delete ONCE at /coupons, then create a new coupon with the same code ONCE and the same settings.
3. As U, apply ONCE again and complete the payment.
4. At admin /coupons, check the Redemptions column for the new ONCE and export Coupons via the Export menu (CSV).
5. Open any admin report that lists redemptions or affiliate conversions for the old coupon, and confirm it does not error on the missing coupon id.

**Expect:** Current behaviour: U can redeem again and the counter restarts at 0, because counts are keyed by couponId. Product must decide. Either (a) the delete dialog and runbook tell admins to deactivate (Active off) instead of deleting, and this is documented, or (b) limits are enforced per code. File P2 if neither is in place. Historical redemptions stay queryable, and reports do not 500.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.ts`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/admin/src/pages/CouponsPage.tsx`

## GAP3-006 · P2 · PAYOUT_FEE coupon deleted between the cashout preview and the payout request

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Coupon PAYFEE with 'Where it can be used' = payout fee. Organizer O with available campaign balance >= GHS 200 and a reviewed destination. Paystack test transfers.

**Steps:**

1. O opens the campaign cashout panel (CampaignCashout), enters GHS 200 and applies PAYFEE; note the fee and net shown.
2. Admin deletes PAYFEE.
3. O submits the cashout request. Double-tap the submit button.
4. Check the payout row (fee, netAmount), the campaign balance buckets and the CouponRedemption rows.

**Expect:** Either the request is refused with a clear invalid-coupon message and no payout is created (balances unchanged), or it is created at the FULL fee only after O is shown the new net before confirming. The organizer is never charged a fee different from the one displayed without being told. The double tap creates at most one payout (idempotent requestKey). No PENDING seat is left behind.

**Needs:** Paystack test keys (transfers)

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.ts`

## GAP3-007 · P2 · Creator's plan lapses mid-broadcast: host reconnect and host-token issuance (web)

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** LIVEKIT_* configured (GET /api/v1/live-sessions/video/config returns enabled:true). Creator C on a paid tier with 'Live streaming'. Active campaign. Viewer V. Staging DB access. Paystack test keys.

**Steps:**

1. C opens app.ujimora.com/campaigns/<id>/live, clicks 'Go LIVE', then 'Start camera & microphone'. V opens the viewer link /c/<slug>/live/<sessionId> and clicks 'Watch broadcast'.
2. Force a lapse: set C's subscription currentPeriodEnd to 1 minute ago (or status 'expired') in the staging DB. Confirm GET /api/v1/subscriptions/me (or /subscription) now shows the Free plan.
3. Watch for 5 minutes. Is C still streaming? Is V still watching? V donates GHS 5 through the live link.
4. C clicks 'Disconnect camera', then 'Start camera & microphone' again. This calls POST /api/v1/live-sessions/:id/video/host-token.
5. Call POST /api/v1/live-sessions/:id/video/host-token directly with C's bearer token and record the HTTP status.
6. C clicks 'End session'.

**Expect:** The behaviour must match a written policy in docs/live-broadcasting.md. Recommended: after the lapse, new host tokens are refused with 403 ('...plan does not include LIVE streaming'), C sees a clear upgrade message, 'End session' still works, and the GHS 5 donation settles and is attributed exactly once. Current code (LiveVideoService.join) does no plan check, so steps 4-5 will return 200 with a fresh 1-minute token. File a P2 entitlement defect unless the policy is 'a session started while entitled may run to completion'. 'End session' closes the LiveKit room and V sees the broadcast end.

**Needs:** LiveKit credentials; Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/LiveSessionController.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`

## GAP3-008 · P2 · Lapsed owner presses 'Go LIVE' while a previous session is still active

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Creator C (paid, Live streaming) with campaign C1 that has an active session left running, and a second active campaign C2 with no session. Staging DB access.

**Steps:**

1. Force C's plan lapse as in GAP3-007.
2. Open app.ujimora.com/campaigns/<C1>/live and click 'Go LIVE' (POST /api/v1/campaigns/<C1>/live-sessions).
3. Open /campaigns/<C2>/live and click 'Go LIVE'.
4. Check the OBS overlay link for C1's session and the number of active sessions for C1 in the DB.

**Expect:** Step 3 returns 403 with the upgrade message. For step 2, current code returns the EXISTING active session (201) because StartLiveSessionUseCase L50-51 runs before the plan check. That is acceptable only if the policy allows continuing; otherwise file a P2 defect. No second active session is ever created for C1, and the overlay keeps working (or stops) consistently with the policy.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/web/src/pages/CampaignLivePage.tsx`

## GAP3-009 · P2 · Admin turns off 'Live streaming' for a tier while its creators are live

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Two creators on tier Pro, both broadcasting. A third Pro creator who is not live. Admin with PLANS permission.

**Steps:**

1. At admin /plans, edit Pro, untick 'Live streaming' and save.
2. Watch both live sessions for 3 minutes. One host disconnects and reconnects the camera.
3. The third creator clicks 'Go LIVE'.
4. Re-enable 'Live streaming' on Pro and have the third creator retry.

**Expect:** New sessions are blocked immediately with 403. Existing sessions and reconnects follow the same policy as GAP3-007. The plan edit is audited. Re-enabling restores 'Go LIVE' at once (no stale plan cache beyond the documented TTL). No errors appear in the host UIs.

**Needs:** LiveKit credentials

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/application/use-cases/UpdatePlanUseCase.ts`, `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## GAP3-010 · P2 · Store (IAP) subscription expires during a native broadcast on iOS and Android

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Sandbox tester on iOS (renewals are accelerated: monthly = about 5 min) and a license tester on Google Play. The creator buys a Live-streaming tier in-app. LiveKit configured. Store billing sweep running (60 s).

**Steps:**

1. On the device, subscribe through the in-app purchase on the Subscription screen and confirm the tier shows as active.
2. Open the campaign > Broadcast studio, tap 'Create live session', then 'Start camera and microphone'.
3. Cancel auto-renew (iOS: Settings > App Store > Sandbox Account > Manage; Play: Play Store > Subscriptions).
4. Wait until the sandbox period expires plus 2 minutes for the store billing sweep.
5. Background the app for 2 minutes and return, which forces a LiveKit reconnect and a new host token.
6. Try 'Create live session' on another campaign.
7. Tap 'End broadcast'.

**Expect:** The subscription shows as expired within about 2 minutes of the provider expiry. New sessions are refused with an upgrade message. On iOS the message must NOT link to web payment (store rule; only IAP upgrade). Reconnect behaves per the GAP3-007 policy. 'End broadcast' works. There are no crashes.

**Needs:** App Store sandbox; Google Play license testing; LiveKit

**Source:** `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/application/services/PlanLimitsService.ts`

## GAP3-011 · P2 · Collaborator invitations pending when the owner's plan lapses or is downgraded

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Owner O on a plan with Campaign collaboration, escrowSupport and max collaborators >= 3. Registered invitees I1, I2 and I3.

**Steps:**

1. In the campaign's collaborator section, O invites I1 and I2 with 0% revenue share and I3 with 20% revenue share.
2. I1 accepts at app.ujimora.com/invitations.
3. Force O's plan lapse to Free.
4. I2 clicks Accept at /invitations. I3 clicks Accept.
5. I2 clicks Decline instead.
6. O re-subscribes, then I3 accepts again.
7. Downgrade O to a tier with max collaborators = 1 while 2 have accepted, then have O invite another user.

**Expect:** Step 4 is refused with 403 and the invitations stay PENDING (not consumed). The message shown to the INVITEE must make clear that the campaign owner's plan no longer includes collaboration. The current copy, 'Your Free plan does not include campaign collaboration...', wrongly addresses the invitee; file P2. Decline still works. After re-subscribing, I3's accept succeeds. I1's accepted access is unchanged by the lapse, and the policy on existing collaborators is documented. In step 7, existing collaborators are kept and the new invite is refused with the 'allows 1 collaborator(s)' message.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/RespondToCollaborationUseCase.ts`, `apps/web/src/pages/CollaborationInvitationsPage.tsx`, `apps/web/src/components/campaigns/CollaboratorSection.tsx`

## GAP3-012 · P2 · Split draft and active split when the owner's plan lapses (SPLIT_PROCEEDS_ENABLED=true)

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging instance with SPLIT_PROCEEDS_ENABLED=true. Owner with Campaign collaboration + escrowSupport. Two beneficiary users. Paystack test keys.

**Steps:**

1. The owner creates split v1 (60/40) in CampaignSplitSetup, both beneficiaries accept, and the owner activates it.
2. The owner creates draft v2 (50/50). Beneficiary 1 accepts v2.
3. Force the owner's plan lapse.
4. Beneficiary 2 records consent on v2 (POST /api/v1/campaigns/:id/split/2/consent).
5. The owner tries to activate v2 (POST /split/2/activate) and to create v3.
6. A donor gives GHS 100 to the campaign.
7. Check GET /split/beneficiaries balances and the donor disclosure (GET /campaigns/:id/split) shown on the donate page.

**Expect:** Recording consent is allowed. Activating and creating new versions are refused with 403 and the plan message. v1 stays active. The new donation accrues 60/40 exactly in minor units (sum of shares = campaign net). SplitAccrualService has no plan check, so confirm the policy (keep accruing vs freeze) is documented; the donor disclosure must match what actually accrues.

**Needs:** Paystack test keys; SPLIT_PROCEEDS_ENABLED staging

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/application/services/SplitAccrualService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/web/src/components/campaigns/CampaignSplitSetup.tsx`

## GAP3-013 · P2 · Leaderboard 'Today' rolls over at 00:00 UTC; a donation straddling midnight lands on one day only

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** Two donors A and B with public profiles and 'Show on leaderboards' on. The test is scheduled across a real 00:00 UTC (00:00 in Accra). Paystack test keys.

**Steps:**

1. At 23:50 UTC, A donates GHS 50 (web).
2. Check app.ujimora.com/leaderboard on the 'Today', 'This Month', 'This Year' and 'Lifetime' tabs, the mobile Leaderboard tabs (Today/Monthly/Yearly/Lifetime) and the home page leaderboard widget.
3. At 23:59:30 UTC, B starts a GHS 40 donation and completes payment after 00:00:30 UTC.
4. At 00:01 UTC, reload every tab on web and mobile.
5. Compare with the admin /donations timestamps, B's /donations history date and the receipt/activity email date.

**Expect:** At 00:01, 'Today' no longer lists A and lists B (the donation timestamp is the settlement time). Monthly, yearly and lifetime include both. Web and mobile agree. The admin list, donor history and receipt show the same calendar date for B in Africa/Accra. No donation is counted twice or missing. Anonymous donations never appear.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/web/src/pages/LeaderboardPage.tsx`, `apps/mobile/app/leaderboard.tsx`

## GAP3-014 · P2 · Dec 31 -> Jan 1 rollover: monthly/yearly leaderboards, payout budgets and AI quota

*Surfaces:* admin, api, ios, web  ·  *Type:* negative/edge

**Before:** A staging API host whose clock can be set (VM or libfaketime), with its own DB. Render cannot do this. Donors and an organizer eligible for automatic payouts.

**Steps:**

1. Set the server clock to 2026-12-31T23:50Z. Make two donations and one automatic payout. Use the AI writing assistant once.
2. Advance the clock to 2027-01-01T00:05Z.
3. Check /leaderboard 'This Month' and 'This Year' (web and mobile), and the AutomaticPayoutBudget keys (2026-12-31:... vs 2027-01-01:...).
4. Check GET /api/v1/ai-writing/config remainingRequests.
5. Export the admin donations report filtered to 2026.

**Expect:** At 00:05Z, 'This Month' and 'This Year' contain none of the 2026 donations, and 'Lifetime' is unchanged. The 2027-01-01 budgets start at 0. The AI quota is reset. The 2026 export includes the 23:5x donations. There are no errors in the logs.

**Needs:** Clock-shiftable staging host; Paystack test keys; OpenAI key

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/application/services/AiWritingService.ts`

## GAP3-015 · P2 · Diaspora viewers in other timezones see a consistent 'Today', 'This Month' and 'This Year'

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** Donations exist at known UTC times, for example 13:00 UTC and 23:30 UTC. Test browsers and devices with the timezone set to America/New_York, Europe/London (BST) and Asia/Dubai.

**Steps:**

1. At 19:30 New York time (00:30 UTC next day), open /leaderboard 'Today' on web and mobile.
2. Repeat from London and Dubai.
3. Open a campaign's donor feed and 'My donations' and note the relative times ('5m ago') and absolute dates.

**Expect:** 'Today' consistently reflects the UTC/GMT day. The UI should say so (e.g. 'Resets daily at 00:00 GMT'); if there is no such label, file a P2 copy defect because diaspora users will see 'Today' reset in the evening. Relative times are correct in every timezone. Absolute dates use one documented timezone consistently.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/web/src/pages/LeaderboardPage.tsx`, `apps/mobile/app/leaderboard.tsx`

## GAP3-017-2 · P2 · Automatic payout daily owner and platform budgets: exhaustion and reset at UTC midnight

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** 'Daily limit per owner (GHS)' = 300 and 'Daily platform limit (GHS)' = 500. Two eligible organizers O1 and O2 with repeat destinations.

**Steps:**

1. O1 requests GHS 200: it is paid automatically.
2. O1 requests GHS 200 again on the same UTC day.
3. O2 requests GHS 250 on the same UTC day (platform total would be 450), then GHS 100 (platform total 550).
4. After 00:00 UTC, O1 requests GHS 200.
5. Read the admin Settings 'Automatic payouts' copy and field labels.

**Expect:** The second O1 request goes to manual review ('Automatic daily limit reached; awaiting manual review.' or equivalent). O2's second request exceeds the platform limit and goes to manual review. After midnight, O1's request is automatic again. Manual approvals do not consume the automatic budget. The admin copy should state that 'daily' means the UTC/GMT day (P2 copy note if missing).

**Needs:** Paystack test transfers

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/admin/src/components/AutomaticPayoutSettings.tsx`

## GAP3-018-2 · P2 · AI writing daily quota resets at 00:00 UTC

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** AI_WRITING_ENABLED=true, OPENAI_API_KEY set, AI_WRITING_DAILY_LIMIT=2. A signed-in creator.

**Steps:**

1. On web /campaigns/new, open the AI writing assistant, tick the OpenAI consent box and generate 2 previews.
2. Try a third. Note GET /api/v1/ai-writing/config remainingRequests.
3. After 00:00 UTC, reopen the assistant on web and on native campaign create.

**Expect:** After 2 uses, remainingRequests is 0 and generation is disabled with a clear limit message. After 00:00 UTC it is back to 2 on both platforms. Concurrent first requests (two tabs clicking Generate together) never report 'limit reached' falsely.

**Needs:** OpenAI API key

**Source:** `apps/api/src/application/services/AiWritingService.ts`, `apps/web/src/components/campaigns/AiWritingAssistant.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`

## GAP3-022 · P2 · Auto-generated vanity slugs from Ghanaian letters, accents, emoji and non-Latin titles

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** A creator eligible to create campaigns, and staff able to approve them.

**Steps:**

1. Create campaigns on web (/campaigns/new) and native (campaign create) with these titles: a) 'Ɔdɔ Nkɔmɔ: Help Ɛfua's Surgery'; b) 'Adwoa Agyeman-Bɛdiako Fund'; c) 'Café Résumé Nkɔsuo'; d) '🙏🏾🙏🏾🙏🏾'; e) 'مساعدة الأسرة'; f) 'Kofi's Surgery' created twice; g) 'Live'.
2. After approval, open each share link app.ujimora.com/c/<slug> on web and through the native deep link (campaign/shared).
3. Record each slug.

**Expect:** Every campaign gets a unique valid slug of 3-60 characters. d) and e) get 'campaign-xxxxxx'. The second f) gets a '-xxxx' suffix. g) gets a suffix (reserved word). Every link resolves on web and native. Note: slugify drops ɔ/ɛ/ŋ because they do not decompose, so a) becomes something like 'd-nk-m-help-fua-s-surgery'. Record the actual slugs. The product should transliterate (ɔ->o, ɛ->e, ŋ->ng); file P2 if the slugs are unreadable.

**Needs:** none

**Source:** `apps/api/src/application/utils/slug.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/mobile/app/campaign/shared.tsx`

## GAP3-023 · P2 · Custom vanity slug endpoint PATCH /api/v1/campaigns/:id/slug (API-only; no client UI)

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Owner token, a second user's token, admin token, and an existing slug belonging to another campaign.

**Steps:**

1. As the owner, PATCH with each body: {slug:'ɔdɔ-fund'}, {slug:'Odo-Fund'}, {slug:'odo--fund'}, {slug:'ab'}, {slug:'live'}, {slug:'<other campaign slug>'}, {slug:'odo-fund'}.
2. PATCH as the non-owner, and again logged out.
3. After the valid change, open both the old /c/<old-slug> and the new /c/odo-fund, plus any QR or short link generated earlier.

**Expect:** 400 for the non-ASCII, uppercase, double-hyphen and too-short slugs (zod regex). 409 for reserved ('That slug is reserved') and taken ('That slug is already taken'). 403 for the non-owner, 401 when logged out. The valid slug goes through publication admission and then changes. Define what happens to the old slug (404 vs redirect). If printed QR codes or shared links break, file P1. Confirm product intent, given that no web, admin or mobile UI calls this endpoint.

**Needs:** OpenAI (optional, publication screening)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/api/src/application/utils/slug.ts`

## GAP3-025 · P2 · Emoji, Ghanaian letters and right-to-left text in donor names and messages on the OBS overlay, live pages and SSE feeds

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Active live session with names, messages and amounts visible. OBS Studio with a Browser Source pointed at the private overlay link ('Copy private overlay link' -> /api/v1/live-sessions/:id/overlay/view?token=...). Paystack test keys.

**Steps:**

1. Donate through the live link with these name/message pairs: 'Ɛfua Ɔpɔku 🙏🏾' / 'Nyame nhyira wo ❤️‍🔥'; '👨🏾‍👩🏾‍👧🏾' only; Arabic 'بارك الله فيك'; mixed 'For Ama بارك 50 cedis'; combining-mark spam 'Z̶͑a̷l̴g̸o̴'.
2. Send a message of exactly 500 UTF-16 units made of emoji, then one of 501.
3. Watch the OBS overlay, the WatchLivePage feed, the CampaignLivePage 'Donor feed', the mobile live screen and the campaign donor list.
4. Toggle the donor privacy switches off and on.

**Expect:** All glyphs render without tofu boxes. Right-to-left text does not reorder the adjacent name or amount; overlayPage.ts has no dir/bidi isolation, so file P2 if it does. Long text is ellipsized inside the overlay row with no overflow, and Zalgo text stays inside its row. The 501-unit message is rejected with a clear message, and the web and mobile counters agree with the server's 500 limit. The privacy toggles still hide names and messages.

**Needs:** Paystack test keys; LiveKit (optional); OBS

**Source:** `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`

## GAP3-026 · P2 · Admin PDF, XLSX and CSV exports with non-ASCII, emoji, right-to-left text and formula-like values

*Surfaces:* admin  ·  *Type:* compliance

**Before:** Donations and users exist with the names and messages from GAP3-025, plus a donor named '=HYPERLINK("http://x","a")', a phone '+233241234567' and a message '-5+3'.

**Steps:**

1. At admin /donations (also /coupons and /payouts), use the Export menu to produce PDF, XLSX and CSV.
2. Open the CSV in Excel on Windows and in Google Sheets. Open the XLSX in Excel and Numbers. Open the PDF in Acrobat and macOS Preview.

**Expect:** The CSV opens as correct UTF-8 (BOM present). The XLSX is correct. Formula-like values are prefixed with an apostrophe and never execute, and +233 numbers stay text. In the PDF, the Outfit font may lack ɛ/ɔ, emoji and Arabic glyphs; any missing or blank characters are a P2 defect, because names must be legible in finance and compliance exports.

**Needs:** none

**Source:** `apps/admin/src/lib/exports/pdf.ts`, `apps/admin/src/lib/exports/report.ts`, `apps/admin/src/lib/exports/xlsx.ts`

## GAP3-027 · P2 · Account, activity and newsletter emails with Ghanaian letters and emoji

*Surfaces:* api, email, web  ·  *Type:* cross-platform

**Before:** Resend configured. A user named 'Ɛfua Ɔpɔku 🙏🏾' who has opted in to activity emails and to the newsletter.

**Steps:**

1. Register this user, request email verification and a password reset.
2. Donate with a message containing emoji. The campaign creator receives an activity alert.
3. Subscribe to the newsletter and receive the confirmation email.
4. View every email in Gmail web, Outlook desktop, iOS Mail and Android Gmail.

**Expect:** Subjects and bodies render correct UTF-8 with no mojibake. Names are displayed correctly and links are intact and single-use as designed. Reply-to is the support address.

**Needs:** Resend email provider

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/outbound/ResendActivityEmails.ts`

## GAP3-028 · P2 · No self-serve email change: guidance and the data-rights correction request

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** A signed-in member.

**Steps:**

1. On web /profile and /settings and in mobile settings, look for any way to change the email address or any guidance on it.
2. Send PUT /api/v1/profile with {"name":"Same","email":"new@example.com"}, then GET /api/v1/profile.
3. In web Settings > data rights, choose 'Request type' = 'Correct my data', enter 'Please change my login email from a@... to b@...' in 'What would you like us to review?' and submit.
4. Submit a second correction request.
5. Submit details shorter than 10 characters.
6. Repeat on mobile settings.
7. As admin, open /privacy-requests and find the request.

**Expect:** There is no email edit field. The UI should tell users how to change their email (P2 copy note if missing). The PUT returns 200 but the email is unchanged: it is silently ignored by the MongoAccountProfileWrite whitelist, because validate() does not strip unknown keys. The request shows 'Request received...'. The second request gets 409 'You already have an open request of this type...'. Short details are rejected. The request appears in admin /privacy-requests with a due date 30 days out.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/web/src/components/account/DataRightsRequests.tsx`, `apps/mobile/src/components/DataRightsRequests.tsx`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`

## GAP3-030 · P2 · Downstream effects after an email change: newsletter, activity alerts, Paystack, store billing, MFA and receipts

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** U from GAP3-029 had, before the change: a confirmed newsletter subscription; activity alerts on, with one delivery queued (trigger a donation just before the change); an active Paystack subscription; an iOS IAP subscription on another test account set up the same way; TOTP MFA enabled.

**Steps:**

1. After the change, deliver the queued activity alert (wait for the 30 s worker).
2. Send a newsletter test and click its unsubscribe link.
3. Start a new paid subscription checkout on web and check the email on the Paystack checkout page and in the Paystack dashboard.
4. On the IAP account (email changed the same way), use Restore purchases and confirm the tier is still linked.
5. Sign in and complete TOTP. Use a recovery code.
6. Check historic donation receipts and the donor email on past intents in admin, and search for U by the new email in admin /users.

**Expect:** The queued alert to the old address is suppressed ('email_address_changed'), and new alerts go to the new address only after verification and opt-in. The newsletter stays tied to the old address until re-subscribed, and unsubscribe works. The new Paystack checkout uses the new email (CreateSubscriptionCheckoutUseCase). Renewals under the old Paystack customer are documented. Store billing ownership is unchanged because it is keyed by user id. MFA and recovery codes still work. Historic records keep the old email as historical fact. Admin search finds U by the new email.

**Needs:** Resend; Paystack test keys; App Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/database/models/NewsletterSubscriptionModel.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`

## GAP3-032 · P2 · Remove the only name-matched payout account: no confirmation, ownership checks and double tap

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Creator A with exactly one name-matched account. User B's token. A logged-out client.

**Steps:**

1. On web and on mobile, tap Remove on A's only matched account and note whether a confirmation appears.
2. Open the creator withdrawal form.
3. Re-add the same number with the matching name.
4. As B, send DELETE /api/v1/payout-accounts/<A's account id>. Repeat with no token.
5. As A, double-tap Remove on an account (slow network).

**Expect:** Removal currently happens immediately with no confirmation on both web and mobile; recommend a confirm dialog (P2 UX). The withdrawal form explains that a verified account is needed and links to add one. Re-adding runs name resolution again, creates a new recipient and frees or reuses the plan's account slot. B gets 404 and A's list is unchanged. No token gives 401. On the double tap, the second call's 404 is handled gracefully and the list stays consistent.

**Needs:** Paystack account resolution

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/web/src/components/account/PayoutAccountCard.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## GAP3-033 · P2 · GET /api/v1/banks fails or is slow: every bank picker degrades safely

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Staging where the Paystack connection can be broken: (a) PAYSTACK_SECRET_KEY unset (501 'Payments are not configured'); (b) an invalid key (502 'Paystack bank listing failed'); (c) outbound traffic blocked or throttled, so the gateway times out at 10 s.

**Steps:**

1. For each condition, open web /payout-accounts (SavedPayoutAccounts with BankPicker), the /creator withdrawal form, the campaign cashout panel (CampaignCashout), mobile Payout accounts and mobile campaign cashout.
2. Switch between mobile money and bank.
3. Press Retry where offered.
4. Restore connectivity and retry without reloading.

**Expect:** Each screen shows an error and never an empty picker that allows submitting without a bank. Web SavedPayoutAccounts shows an error Alert with Retry. The creator withdrawal shows 'Could not load banks. Close and reopen the withdrawal form to retry.' Campaign cashout shows the error. Loading states end within about 15 s. Retry recovers without a page reload. Saved accounts still list, possibly showing codes instead of bank names.

**Needs:** Paystack keys (ability to break them on staging)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`, `apps/web/src/components/account/BankPicker.tsx`, `apps/web/src/components/account/SavedPayoutAccounts.tsx`, `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`, `apps/mobile/src/components/CampaignCashout.tsx`

## GAP3-034 · P2 · GET /api/v1/admin/commercial-config/:key/history: audit trail, ordering and access control

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin token, member token, no token.

**Steps:**

1. In admin Settings, change the early cashout fee twice, entering reasons.
2. PUT /api/v1/admin/commercial-config/earlyFeePercent with value 3 and effectiveFrom = tomorrow.
3. GET /api/v1/admin/commercial-config/earlyFeePercent/history and GET /api/v1/admin/commercial-config.
4. GET history for the review alert email key and for the key 'doesNotExist'.
5. Repeat the history GET with the member token and with no token.

**Expect:** History is newest first by effectiveFrom, and each entry has value (or textValue), createdBy, reason and createdAt. The future-dated version is listed, but the resolved value stays the current one until tomorrow. An unknown key returns 200 [], which is inconsistent with PUT's 400 (note it). Member gets 403, no token gets 401. No admin UI shows history, so document how auditors retrieve it.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.ts`, `apps/api/src/application/services/CommercialConfigService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCommercialConfigRepository.ts`, `apps/admin/src/components/EarlyCashoutSettings.tsx`

## GAP3-035 · P2 · AI writing disabled or OPENAI_API_KEY missing: assistant hidden on web and native, campaign creation still works

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Three staging configurations: A) AI_WRITING_ENABLED=false with the key set; B) enabled with the key missing; C) both set (control). A creator account.

**Steps:**

1. For each configuration, open web /campaigns/new at the story step and native campaign create, and view the AI writing panel.
2. Call GET /api/v1/ai-writing/config, and POST /api/v1/ai-writing directly with consentToExternalProcessing:true.
3. Submit the campaign with 'automated review' consent ticked.
4. Take the API offline and reopen native create.

**Expect:** In A and B, config returns enabled:false. Web shows 'AI writing is currently unavailable. You can continue writing your story below.' Mobile shows 'Writing assistance is not currently available.' There is no consent checkbox or Generate button, and POST returns 503 'AI writing is not configured'. Campaign creation works. In B, publication screening is 'unavailable', so the submission is held for staff review rather than failing. With the API offline, mobile shows 'Retry connection'. GET /ai-writing/config without a token gives 401. /ai-writing/stats is admin-only.

**Needs:** OpenAI API key (to toggle)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/aiWritingRoutes.ts`, `apps/api/src/application/services/AiWritingService.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiWritingProvider.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/campaigns/AiWritingAssistant.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`

## GAP3-037 · P2 · Upload privacy edge cases: app killed mid-upload, content:// sources, other upload screens

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** As GAP3-036, plus throttled network (iOS Network Link Conditioner, Android emulator or device 2G).

**Steps:**

1. Start a KYC ID upload on a throttled network and force-quit the app mid-upload.
2. Relaunch and inspect the cache. Check what the KYC field shows.
3. Android: pick a document from Google Drive or Downloads (content:// URI) and upload. Confirm the source still exists.
4. Repeat the success and kill tests on profile edit (avatar), campaign create (cover image) and the organization KYC form.

**Expect:** A copy left behind after the kill is a known gap: there is no startup sweep, unlike recoveryCodes.ts. The expected policy is that orphans are removed on the next launch. File a P2 privacy defect if a KYC image persists across relaunch. content:// sources are never deleted. After relaunch the field is empty (not falsely 'Uploaded'), and the other screens behave the same way.

**Needs:** Cloudinary

**Source:** `apps/mobile/src/lib/uploadCache.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/lib/recoveryCodes.ts`, `apps/mobile/src/components/OrganizationKYCForm.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/app/campaign/create.tsx`

## GAP3-043 · P2 · Light and dark themes and the four skins across key pages

*Surfaces:* web  ·  *Type:* cross-platform

**Before:** A member account. Browser devtools.

**Steps:**

1. Settings > turn 'Dark mode' on, reload, then sign in on another browser and check it syncs (server darkMode).
2. Set the OS to dark mode and reduced motion, and toggle the theme (the reveal animation should be skipped).
3. No UI exposes the skin choice (setSkin is never called), so set localStorage uf_skin to 'claymorphism', 'glassmorphism', 'minimal' and 'bogus' in turn and reload.
4. For each theme and skin, view home, campaign, donate, dashboard, wallet, settings, live watch and leaderboard at 360 px and desktop.

**Expect:** All text and icons meet WCAG AA contrast, with no invisible text or white-on-white. The dark-mode preference persists and syncs. The 'bogus' skin falls back to neumorphism. Product should decide whether to expose skins or remove the dead option (P2 note).

**Needs:** none

**Source:** `apps/web/src/context/ColorModeContext.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/components/layout/Header.tsx`

## GAP3-044 · P2 · RouteError (stale chunks after a deploy, render errors), NotFound and SplashScreen

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** Staging where you can deploy a new web build. Devtools network throttling.

**Steps:**

1. Open the app, deploy a new web build (chunk hashes change), and without reloading navigate to a not-yet-loaded lazy route such as /leaderboard.
2. Go offline in devtools and navigate to another unvisited route.
3. Visit /this-does-not-exist, /campaigns/000000000000000000000000 and /c/unknown-slug.
4. Hard-load app.ujimora.com on Slow 3G.
5. Force an error on a standalone route (e.g. /login with the API down).

**Expect:** Steps 1-2 show RouteError 'This page needs a refresh', and 'Refresh page' recovers without a reload loop. An unknown path shows NotFound 'A missing link.' with 'Explore campaigns' and 'Back to home'. An unknown campaign or slug shows a not-found state, not a crash. On Slow 3G the SplashScreen skeleton (role=status 'Loading Ujimora') shows at once, with no blank white screen. With the API down, /login shows an inline error rather than a white screen.

**Needs:** Web deploy pipeline

**Source:** `apps/web/src/components/RouteError.tsx`, `apps/web/src/components/SplashScreen.tsx`, `apps/web/src/pages/NotFoundPage.tsx`, `apps/web/src/App.tsx`, `apps/web/src/router.tsx`

## GAP3-045 · P2 · MobileBottomNav behaviour, active states and safe areas

*Surfaces:* web  ·  *Type:* cross-platform

**Before:** iPhone with a home indicator (Safari, and also added to the Home Screen), an Android phone, and desktop.

**Steps:**

1. At 360 px, logged out: tap Home, Explore, Start ('Start a campaign'), Dashboard and Profile.
2. Log in via the Start prompt and confirm you land on /campaigns/new.
3. Visit /campaigns/<id> and /c/<slug> and check Explore is highlighted.
4. Trigger a snackbar (e.g. save settings) and confirm it sits above the nav.
5. Scroll to the page footer and to the donate CTA on /c/<slug> and confirm nothing is hidden under the nav.
6. Rotate to landscape. Resize to 900 px or wider.

**Expect:** Correct routing and active state on every tab. Protected tabs show the sign-in prompt when logged out and return after login. The nav clears the iOS home indicator (safe-area inset). Snackbars are offset above the nav. No content or CTA is covered. The nav is hidden at md (900 px) and above. Labels are announced correctly.

**Needs:** none

**Source:** `apps/web/src/components/layout/MobileBottomNav.tsx`, `apps/web/src/components/layout/Layout.tsx`

## GAP3-046 · P2 · GlobalActivityFeed on the home page: privacy, empty and error states, formatting

*Surfaces:* web  ·  *Type:* compliance

**Before:** A fresh staging DB with no donations, then donations of each kind: named, anonymous, guest, from a user who blocked the viewer, from a restricted account, and one with an unapproved message.

**Steps:**

1. Open / with no donations.
2. Add the donations, then reload.
3. Make the /donations feed endpoint fail (block it in devtools).
4. Set the device clock 5 minutes behind and reload.

**Expect:** The empty state shows an EmptyState, not a blank area. Anonymous and unapproved content shows 'Anonymous'. Blocked and restricted accounts are hidden or anonymised, and no emails or PII appear. Amounts are formatted as GH₵. A feed failure does not break the home page. Clock skew never shows negative times; 'just now' is used.

**Needs:** Paystack test keys (to create donations)

**Source:** `apps/web/src/components/GlobalActivityFeed.tsx`, `apps/web/src/pages/HomePage.tsx`

## GAP3-048 · P2 · Keyboard and screen-reader pass on core web pages outside settings and payment

*Surfaces:* web  ·  *Type:* compliance

**Before:** VoiceOver (macOS Safari, iOS Safari), TalkBack (Android Chrome), NVDA (Windows Firefox). Keyboard-only desktop.

**Steps:**

1. With the keyboard only (Tab, Shift+Tab, Enter, Space, Esc), go through the Header ('Ujimora home', 'Search campaigns', 'Account menu', 'Open menu' drawer), Explore filters and cards, the campaign page (share, donate CTA, comments), the leaderboard tabs (Today, This Month, This Year, Lifetime), wallet, My donations, dashboard, and the live watch page ('Watch broadcast').
2. At 360 px, use the bottom nav with a screen reader.
3. Navigate between routes and note where focus lands and what is announced.
4. Leave the live donor feed open for 2 minutes with a screen reader running.

**Expect:** Every control is reachable with a visible focus ring in all skins and dark mode. Menus and drawers trap focus and return it on Esc. There are no keyboard traps. Route changes announce the new page (title) and move focus to main content. There is no skip link in Layout.tsx, so record it as a P2 finding. The live feed's aria-live does not flood the screen reader. Icon buttons have labels.

**Needs:** none

**Source:** `apps/web/src/components/layout/Header.tsx`, `apps/web/src/components/layout/Layout.tsx`, `apps/web/src/components/layout/MobileBottomNav.tsx`, `apps/web/src/pages/LeaderboardPage.tsx`, `apps/web/src/pages/WatchLivePage.tsx`
