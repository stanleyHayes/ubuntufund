# Cross-cutting journeys & edge cases (190 cases)

End-to-end journeys across areas, concurrency, multi-currency, dates and time zones, provider cutover, legacy data, recovery drills.

[Back to the QA plan](../README.md)

## GAP1-001 · P0 · E2E-1: Organization signs up on web and buys a paid plan through live Paystack

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** Production API on live keys (sk_live_/pk_live_) with the live webhook set (GAP2-015), or a staging stack the owner has approved for real money. RESEND_API_KEY and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 set. After a render.yaml Blueprint sync, FROM_EMAIL=no-reply@ujimora.com and REPLY_TO_EMAIL=support@ujimora.com. A new mailbox the tester controls. A real card in the tester's name. Admin has created a single-use percentage coupon at admin /coupons/new (per-user limit 1, total limit 1) that cuts the Organization monthly price to a small live charge (for example GHS 2.00). Otherwise, budget for the full price. Record T0 (UTC) and keep a journey sheet of every reference produced.

**Steps:**

1. In a private window open https://app.ujimora.com/register?role=organization. Confirm the stepper reads Account, Organization, Contact, Plan and the organization account type is preselected.
2. Complete Account (email, strong password), Organization (name, type from the picker, e.g. NGO / Non-profit) and Contact.
3. On Plan choose the Organization tier and Monthly, enter the coupon, tick the terms and age boxes, and submit. Do not request a verification email by hand.
4. On the Paystack page check that the amount equals the discounted price in GHS to the pesewa and the email is the org email. Record the reference, which must start with sub-.
5. Pay by card. Let Paystack redirect to /subscription/callback?checkout=<id>&reference=sub-... and wait for the success state.
6. Open /subscription. Expect tier Organization with 'Plan length' 30 days and 'Ends in' about 30 days (not 'Renews in'), and the note 'Your plan does not renew automatically. Buy again before it ends to keep your benefits.' The Organization tier's button reads 'Renew Organization' (do not start it).
7. Open the inbox. 'Verify your Ujimora email address' was sent automatically at signup. Follow its /verify-email link, then sign out and back in. The account shows as verified and the dashboard email-verification notice is gone.
8. Admin /subscriptions: find the org and confirm base amount, discount, final amount, coupon code and SUCCEEDED status.
9. Paystack live dashboard > Transactions: find the sub- reference and record amount, fee and customer email.

**Expect:** Paystack shows exactly one successful sub- charge for the discounted amount. The subscription is activated once, as a one-time 30-day plan, and the coupon shows 1 redemption. /subscription never claims the plan renews. The verification email arrives at signup without being requested, from no-reply@ujimora.com with Reply-To support@ujimora.com, and its https://app.ujimora.com link works. There is no second pending checkout for this user. The sub- reference, checkout id and Paystack fee are recorded for GAP3-017/018.

**Needs:** Paystack live keys + live webhook; Resend (RESEND_API_KEY, verified ujimora.com domain); real card

**Source:** `apps/web/src/router.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `render.yaml`

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

**Before:** Play internal-track and TestFlight builds from this branch pointing at the production API (eas production profile). LiveKit credentials set, or accept a text-only live session. A viewer device.

**Steps:**

1. Android: open the campaign, tap Donate, enter GHS 1.31 and pay by card in the Custom Tab. Return to the app; the pending state resolves to success. Reopen the screen and confirm there is no duplicate intent.
2. Android: start GHS 1.32, close the Custom Tab without paying and return. The card reads 'Awaiting payment confirmation' with 'Check status'. No success is shown and the raised total does not change.
3. iOS: open the campaign and tap Support. The 'Support this campaign' screen says 'Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.' Tap 'Continue in browser'. Safari opens https://app.ujimora.com/c/<slug>/donate?amount=... (or /c/<campaignId>/donate for a campaign without a slug) with no token or personal data in the URL. Pay GHS 1.41 in Safari.
4. iOS: return to the app. The note 'Returning to the app does not confirm payment. Check the payment status on the website before trying again.' is shown, and the campaign total updates after a refresh.
5. iOS: confirm there is no in-app payment form, wallet top-up opens /wallet in Safari, and no creator-tip entry exists.
6. Web: as the org start a session at /campaigns/<id>/live ('Go live'). A viewer opens /c/<slug>/live/<sessionId> and donates GHS 1.51. The overlay or feed shows it within seconds.
7. iOS: start a donation from inside the live session in the app. The Safari URL carries ?liveSessionId=<24-hex id>.
8. Admin: the timelines of the 1.51 and iOS live donations show the liveSessionId.

**Expect:** Each paid donation settles exactly once. Abandoned attempts never raise the total. The iOS screen copy matches the text above and no longer mentions fee review or the wallet. The iOS handoff carries only the amount and liveSessionId. Live donations are attributed to the session and counted in its stats.

**Needs:** Paystack live; store builds; LiveKit (optional)

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/lib/payments.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`

## GAP1-007 · P0 · E2E-7: Refund one Paystack donation from the admin console and check provider, ledger and balances

*Surfaces:* admin, api, email, web  ·  *Type:* recovery/idempotency

**Before:** A card donation from GAP1-005 by a signed-in donor with the 'refunds' activity alert turned on. Run this step BEFORE any cashout request (see GAP6-033). A staff account with DONATIONS update permission.

**Steps:**

1. As the donor, on /donations click 'Request Refund' on the gift and submit a reason on /donations/refund/<donationId>. /refunds shows it as pending.
2. Admin /refund-requests: find the request (chip 'Awaiting review') and its 'Payment' chip. Enter a staff note of at least 20 characters and click 'Approve and mark processing'. Confirm 'Mark refunded' is still disabled.
3. Click 'Refund payment' on the request (or search admin /payments by the uf- reference, click 'View timeline', then 'Refund payment'). In 'Refund contribution' keep the full amount, tick 'I have checked this refund is approved and the amount is correct.' and double-click the submit button.
4. Record the dialog outcome: 'Refund of GHS X confirmed by the provider (reference …).', or a warning to follow it in Refund recovery.
5. If it was not confirmed, open admin /refund-recovery and Verify with the provider refund ID until accounting completes.
6. By API, repeat POST https://api.ujimora.com/api/v1/admin/payments/<intentId>/refund with {"idempotencyKey":"qa-refund-1"}, then with a different key.
7. In Paystack confirm a single refund for the full amount, and that the card receives it.
8. Back on /refund-requests enter a note and click 'Mark refunded'.
9. Check: intent REFUNDED; raised total down by the amount; campaign refundHolds empty; a reversing journal entry exists; the donor's /donations row shows 'Refunded' and no 'Request Refund'; the donor gets 'Your refund is completed' (in-app, and email if enabled).

**Expect:** Exactly one provider refund is created, even after the double click (the dialog uses one idempotency key). Repeats by API are refused and create no second Paystack refund: 400 'Only a settled contribution can be refunded' once the payment is REFUNDED, or 409 'An earlier refund needs reconciliation before another refund can be submitted' while one is unresolved. 'Mark refunded' stays disabled, and the API refuses 'completed', until the linked payment shows REFUNDED. The campaign balance buckets and the ledger reconcile, no balance goes negative, and each status change is in admin /audit.

**Needs:** Paystack live refunds; Resend

**Source:** `apps/admin/src/pages/RefundRequestsPage.tsx`, `apps/admin/src/pages/PaymentsPage.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/admin/src/pages/RefundOperationsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/web/src/pages/MyDonationsPage.tsx`

## GAP1-008 · P0 · E2E-8: Bank or MoMo cashout, admin approval and the transfer webhook

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** Either the campaign end date has passed (the standard cashout is free), or the eligible balance is at least about GHS 40 (early cashout: 1%, minimum GHS 20, capped at 80%). The org's KYB approval is current (not expired or under renewal) and its email is verified. The Paystack transfer balance is funded. A MoMo or bank account in the org's name. The approving admin is not the org owner. The org has 'withdrawals' activity alerts on.

**Steps:**

1. At /payout-accounts add the MoMo (mobile_money) or bank (ghipss) account. Record the card status ('Registered name matched' or 'Name not matched: creator withdrawals need a matched account').
2. On the owner view of the campaign, in the cashout section, pick the saved account, enter the full eligible amount, choose standard and submit. Double-click the submit button.
3. If the campaign has not ended and is below goal, standard must be refused with 'This campaign is still active and below its goal. Select early or urgent cashout; the additional service fee applies on top of the plan fee already deducted at settlement.' If the early fee is greater than or equal to the amount, expect 422 'The payout fee equals or exceeds the requested amount'.
4. Admin /payouts: open the request. Try to approve with a note shorter than 20 characters, then approve with a review note of at least 20 characters. If Paystack asks for an OTP, authorize it in the transfer controls.
5. Wait for transfer.success on the pout- reference, or for the 5-minute sweep. The payout becomes PAID.
6. Check money: amount received on the phone or bank = netAmount; campaign paidOutBalance up by the net; payoutFees up by the fee; availableBalance 0; a payout ledger entry exists; the owner alert 'Your withdrawal is completed'.

**Expect:** One payout is created despite the double click. A short note is refused ('Record beneficiary ownership and receiving-capacity review before approving (at least 20 characters).'). The fee matches the published policy. The received amount equals the net to the pesewa. Balances, ledger and alert are consistent. The alert body reads 'The GHS X request is completed.' and, when a fee applied, adds 'GHS <net> was sent after GHS <fee> in fees.' If the org's KYB is not current the request is refused with 409 'The account holder’s identity verification is missing, expired or under renewal. It must be current before funds can be paid out.'

**Needs:** Paystack live transfers + funded balance; Resend

**Source:** `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

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

**Before:** A read-only production DB user. Access to the Paystack test and live dashboards. A named cutover window with merges to main frozen (Render deploys main after checks pass).

**Steps:**

1. Export counts and ids of test-mode artefacts: payout accounts with recipientCode (and whether recipientMode is set), transferrecipients, beneficiary_recipients, affiliates with recipientCode, non-terminal creator_payouts, payouts in PENDING/PROCESSING/NEEDS_REVIEW, donationintents in CREATED/PENDING with providerRef, wallettopups in pending, pending subscription checkouts, PENDING tips.
2. Spot-check recipient codes in the Paystack TEST dashboard (Transfers > Recipients); they exist only there.
3. Decide per collection whether to close or keep, and write the decision in the launch log. Saved payout accounts and campaign transferrecipients do not need deleting: after the switch run scripts/tag-recipient-mode.ts (GAP-N001) so test-mode codes are tagged and refreshed on next use. Affiliate and beneficiary recipients are recreated when re-registered.
4. Confirm no campaign, wallet, creator or affiliate balance funded by test charges remains payable after the switch (zero it or delete the test users and campaigns).
5. Set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY to live values together in Render and redeploy.
6. Call GET /api/v1/wallets/topups/config. Expect mode 'live'.

**Expect:** A signed inventory with zero unexplained test-mode rows. No test-funded balance can be paid out with live money. Both keys come from the live environment. The tag script run is recorded in the launch log.

**Needs:** Paystack test + live dashboards; Render

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/infrastructure/database/models/TransferRecipientModel.ts`, `apps/api/scripts/tag-recipient-mode.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/app.ts`, `render.yaml`

## GAP2-012 · P0 · Cutover: sweeps after the switch never credit test references, expire dead ones and are not starved

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with NODE_ENV=production and PAYMENTS_RECONCILIATION_ENABLED=true. On keys A (test), create 3 abandoned Paystack donation intents, 2 unpaid wallet top-ups and 1 payout left PROCESSING (webhook blocked). In the staging DB set createdAt of one of the 3 intents to 25 hours ago. Then switch staging to keys B (a different Paystack business) to simulate the cutover. Access to Render logs and admin /payouts.

**Steps:**

1. Wait for at least two 5-minute sweep cycles (the intents must be more than 30 minutes old).
2. Logs: expect 'reconcile: provider verification failed (transient)' for each intent younger than 24 hours, and 'payout reconciliation: verify failed' for the payout.
3. DB: the two young intents are still PENDING with reconciledAt stamped on each visit. The backdated intent is EXPIRED and any fee-waiver seat it held is RELEASED. Top-ups are still pending. The payout is still PROCESSING with its amount out of availableBalance. No new journal entries.
4. Set the payout's updatedAt to 25 hours ago and wait one sweep. It becomes NEEDS_REVIEW, the log says 'payout reconciliation: transfer unconfirmed past dwell window; escalated for review with funds still reserved', and the owner's payout history shows 'Needs attention'.
5. In admin /payouts open it, enter what you checked (at least 20 characters) and click 'Re-check Paystack and resolve'. Record the message ('Paystack reported …; the payout is now …') and the balances.
6. Starvation: create 101 or more PENDING intents with unknown references, all older than 30 minutes.
7. Make one keys-B donation, suppress its webhook and do not open /donate/callback. Wait 40 minutes and check whether the sweep repaired it.

**Expect:** No test record is ever credited. Unknown references stay PENDING until 24 hours after creation, then become EXPIRED. The live intent with a missed webhook is repaired within about 35 minutes despite the 101+ unknown intents, because never-checked rows sort first and visited rows rotate behind them. A payout stuck in PROCESSING is escalated to NEEDS_REVIEW after 24 hours with funds still reserved; it is never failed automatically, and resolving it returns the funds only after Paystack confirms the transfer failed or does not exist.

**Needs:** Two Paystack key sets (test)

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/application/use-cases/ResolveStuckPayoutUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## GAP2-013 · P0 · Cutover: campaign cashout to a saved payout account created under test keys

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging. Before the switch, the organizer added a MoMo account at /payout-accounts and registered it on a campaign that has an eligible balance. Pick one mode: (a) a real test-to-live switch, owner-approved, with GHS 1-2 amounts; or (b) two test key sets, where both are mode 'test', so in the DB set recipientMode:'live' on that saved payout account and on the campaign's transferrecipients row to stand in for a code from the other mode.

**Steps:**

1. Switch the keys (a) or retag the records (b).
2. The organizer requests a cashout and an admin approves it at /payouts with a review note.
3. Record the approval response and the balances.
4. Admin clicks 'Reject payout' with a reason of at least 20 characters (or the organizer clicks 'Cancel request' in the payout history).
5. In the cashout section the organizer selects the same saved account again (POST /api/v1/campaigns/<id>/payout-recipient {savedAccountId}). In the DB the saved account keeps its id and name-check result but now has a new recipientCode and recipientMode equal to the current mode; the new recipient is in the current Paystack dashboard.
6. Request and approve again, and wait for transfer.success.
7. Untagged case: repeat with a saved account whose recipientMode is absent and without running the tag script.

**Expect:** Approval of the tagged test-mode destination is refused before anything is reserved: 409 'This payout destination was registered in Paystack test mode. The owner must add the account again before it can be paid.' The payout stays PENDING until rejected or cancelled, and the amount returns to the campaign balance. Re-using the saved account refreshes its recipient in place, so it does not need to be removed and re-added. After re-registration the payout is PAID for the correct net. An untagged code is not detected: Paystack rejects the transfer, the payout ends FAILED and the amount returns to availableBalance. This is why the tag script must run at cutover.

**Needs:** Paystack transfers (two key sets, or test and live)

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/CreatePayoutRecipientUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/domain/value-objects/PaystackMode.ts`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/web/src/pages/PayoutAccountsPage.tsx`, `apps/admin/src/pages/PayoutsPage.tsx`

## GAP2-014 · P0 · Cutover: creator, affiliate and split-beneficiary recipients created under test keys

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging, prepared as in GAP2-013 (a real switch, or retagged records). Under keys A: a creator with current identity verification, a tip balance and a name-matched saved payout account; an affiliate with available commission; a split beneficiary with a registered recipient.

**Steps:**

1. Switch the keys (or retag the saved accounts).
2. Creator: request a withdrawal at /creator to the saved account. Record the result and the creator balance.
3. Affiliate: on /affiliate choose a name-matched saved account as the payout destination, request a payout, and have an admin approve it at /affiliates/<id>.
4. Beneficiary: register the recipient again by API (POST /api/v1/campaigns/<id>/split/beneficiaries/<beneficiaryId>/recipient), request a payout, and have an admin approve it at /payouts (beneficiary view) after 'Review payout destination', 'Verify KYC' and a review note.
5. For any attempt the provider rejects, record the final status and balance.
6. For any payout still PROCESSING with an unknown reference, wait until it is NEEDS_REVIEW (24 hours) and resolve it by API (GAP-N004).

**Expect:** No rail leaves money reserved without a path to release it. A tagged saved account gets a fresh recipient before the creator transfer, so the withdrawal proceeds. If Paystack refuses a creator transfer definitively, the creator sees an error (for example 'Could not start the withdrawal. Please try again.') and the balance is unchanged. Affiliate and beneficiary destinations work after re-registration, and a provider failure ends FAILED with the reservation returned. The cutover runbook lists all four recipient stores and the tag script.

**Needs:** Paystack transfers

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/SetAffiliatePayoutRecipientUseCase.ts`, `apps/api/src/application/use-cases/BeneficiaryPayoutUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

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
2. uf-: match donationintents.providerRef. A Paystack success must map to SUCCEEDED, REFUNDED or PARTIALLY_REFUNDED, including a payment that arrived after the intent was EXPIRED or FAILED (the late success is credited). Failed or abandoned must map to FAILED, to EXPIRED (more than 24 hours old) or to PENDING (under 24 hours). Amount in pesewas = (amount + tip) × 100. Currency GHS.
3. wtop-: match wallettopups.reference. Success must map to completed, with equal amountMinor, exactly one DEPOSIT wallet transaction and one journal entry with externalRef = reference. Abandoned stays pending for up to 24 hours before it is marked failed.
4. sub-: match the subscription checkout providerRef. Success must map to SUCCEEDED, with finalAmount × 100 = the Paystack amount. Unpaid checkouts are FAILED or, after 24 hours, EXPIRED.
5. tip-: match the tip reference. Success must map to SUCCEEDED with settlementApplied true and exactly one creator balance credit. Failed, or abandoned for more than 24 hours, maps to FAILED.
6. Reverse direction: every internal Paystack record in W that is SUCCEEDED or completed appears exactly once in the export.
7. Wallet-funded donations (provider wallet) must not appear in Paystack. Check that total wallet debits do not exceed top-ups plus opening balances.
8. Search the API logs for 'late_success_credited' and 'provider/intent mismatch' and explain each hit.

**Expect:** A 1:1 mapping with zero orphans on either side, and every mismatch explained in the launch log. A Paystack success whose record is still PENDING more than 35 minutes later is a missed webhook the sweep did not repair; escalate it (GAP2-012, GAP4-022).

**Needs:** Paystack dashboard exports

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/scripts/audit-donation-settlement.ts`

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

**Before:** Paystack Refunds and Disputes exports for W. Staging with test keys and a reachable webhook for steps 3-5. An admin token.

**Steps:**

1. Map each Paystack refund to a refund operation (admin /refund-recovery for unresolved ones; completed operations in the DB) by provider reference or transaction reference. Amounts must be equal.
2. For each: the intent is REFUNDED or PARTIALLY_REFUNDED, a reversing journal entry exists, totalRaised went down, and the refund hold is released.
3. Staging: refund a GHS 1 uf- donation directly in the Paystack dashboard. Check admin /disputes, GET /api/v1/admin/payments/provider-events, the logs, the raised total and the campaign balance. Then try to request and approve a payout on that campaign.
4. Staging: refund a sub- charge in the dashboard. Check the subscription end date and status, the affiliate commission and provider-events.
5. Staging: send a charge.dispute.create for a uf- donation, then charge.dispute.resolve. Check admin /disputes. Repeat for a tip- charge.
6. List Paystack disputes/chargebacks in W and confirm each one has a matching case or provider event.

**Expect:** Every Ujimora-initiated refund matches exactly one completed refund operation. A dashboard refund on a donation is recorded once and opens a case in admin /disputes with reason 'Refund issued outside Ujimora', reporter 'Paystack (payment provider)' and a note that the campaign balance has NOT been reduced; the log carries alert 'external_refund'. The raised total and balances do not change, and payouts for that campaign are refused with 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' A refunded sub- charge removes the refunded 30 days from the plan (a new plan shows Expired) and reverses the affiliate commission once. A donation chargeback opens one dispute with the transaction reference, amount and due date; the resolve event moves it to Under Review, never closed. Tip and top-up events appear only in provider-events. Known open issue I009: no automatic hold, clawback or chargeback ledger reversal and no fee recording; staff account for these with the refund tools, and there is no admin page for the provider-events list.

**Needs:** Paystack refunds/disputes exports

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/application/use-cases/RevokeRefundedSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/admin/src/pages/RefundOperationsPage.tsx`, `apps/admin/src/pages/DisputesPage.tsx`

## GAP3-020 · P0 · Reconciliation: every Paystack transfer maps to one payout (pout-, cpay-, bpay-, aff-)

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Paystack Transfers export for W (success, failed, reversed, pending, otp).

**Steps:**

1. Split transfers by prefix: pout- (campaign payouts, including batched legs pout-<id>-L<n>-...), cpay- (creator), bpay- (beneficiary), aff- (affiliate).
2. For each: amount in pesewas = netAmount (or the leg amount), and the recipient code equals the record's recipient.
3. Status mapping: success = PAID; failed = FAILED with the amount back in availableBalance; reversed = REVERSED with the paid-out amount restored.
4. Exclude payouts that are FAILED with a closure of kind rejected or cancelled: they were closed before any transfer and must have no Paystack row.
5. Internal PROCESSING records with no Paystack transfer: after 24 hours they become NEEDS_REVIEW. List them and resolve each with admin 'Re-check Paystack and resolve' (campaign rail) or POST /api/v1/payouts/stuck/<rail>/<id>/resolve.
6. Paystack transfers with no Ujimora record: treat as an out-of-band payout incident.
7. For each campaign: paidOutBalance = sum of successful pout- net amounts, and payoutFees = sum of retained fees.

**Expect:** 1:1 with zero orphans. Rejected or cancelled requests have no transfer. Every NEEDS_REVIEW payout is resolved against Paystack's outcome with a staff note. Campaign paid-out totals match the provider exactly.

**Needs:** Paystack transfers export

**Source:** `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/application/use-cases/ResolveStuckPayoutUseCase.ts`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.ts`

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

**Before:** Staging (NODE_ENV=production, PAYMENTS_RECONCILIATION_ENABLED=true, test keys) where the tester can break webhook delivery (clear the webhook URL in the test dashboard). A signed-in user on Free with 'subscriptions' alerts on.

**Steps:**

1. Clear the webhook URL in the Paystack test dashboard.
2. At /subscription choose a paid tier, Monthly, and pay with a test card.
3. On the Paystack success screen close the tab before it redirects, and do not open /subscription/callback.
4. Wait 40 minutes (at least one 5-minute sweep after the 30-minute threshold).
5. Reload /subscription and call GET /api/v1/subscriptions/mine.
6. Search the Render logs for 'subscription checkout reconciliation sweep complete'.
7. Check the checkout row and the user's notifications.

**Expect:** The subscription activates automatically within about 35 minutes of payment: the sweep verifies the sub- reference with Paystack and settles it. The log line reports settled: 1. The checkout is SUCCEEDED, /subscription shows the paid tier with 'Ends in' about 30 days, and the user gets a subscription alert. The user is charged once.

**Needs:** Paystack test dashboard

**Source:** `apps/api/src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## GAP4-023 · P0 · Subscription: support recovery path and the double-charge guard

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with RECONCILIATION_SCHEDULER_ENABLED=false so the sweep does not settle first. A user who paid for a plan with both the webhook and the callback missed (as in GAP4-022). An admin token. A second user.

**Steps:**

1. Admin: POST /api/v1/admin/payments/<checkoutId>/reconcile. Expect 404 'Contribution not found' (the tool only handles donations). Confirm admin /subscriptions has no verify action.
2. As the user, within an hour, start another checkout on /subscription for the same plan.
3. As another test user with an unpaid checkout opened less than an hour ago, start a second checkout.
4. Recovery: the signed-in user opens https://app.ujimora.com/subscription/callback?reference=<sub-ref>. This calls the owner-only verify endpoint and settles.
5. Confirm the subscription is active, the period starts at settlement, and coupon or affiliate effects are applied once.
6. The second user opens the same URL. Expect 404 and no settlement.
7. With a paid plan in force, choose a different paid plan on /subscription.
8. Write the support runbook: find the sub- reference in Paystack by customer email, send the user the callback link, or rely on the 5-minute sweep; refund if needed.

**Expect:** Starting a second checkout resolves the earlier one with Paystack first. A paid earlier checkout is settled and the new one refused with 409 'Your earlier plan payment went through and that plan is now active. Review your subscription before buying again.' An unpaid checkout under an hour old refuses with 409 'You already have a plan payment in progress. Finish it in the payment window, or check its status on your subscription page, before starting another.' No second charge can open. Owner-only recovery works and other users get 404. Buying a different plan while one is in force needs confirmation: 409 'Your <plan> plan is active until <date>. Buying <other> now replaces it straight away, and unused time is not refunded or credited. Confirm the switch to continue.', and the web button reads 'Switch to <plan>' with that warning. There is still no admin verify action for subscription checkouts; the sweep and the callback link are the recovery paths.

**Needs:** Paystack test

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`

## GAP5-025 · P0 · Split proceeds: create, disclose to donors, donate and try to cash out on web

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true (as in render.yaml). The organizer's plan allows split proceeds. Two beneficiaries with email addresses.

**Steps:**

1. At /campaigns/new enable split and add two beneficiaries at 60% and 40%. Create the campaign.
2. In the split setup on the campaign page, tick each acceptance box, click Record acceptance, then Activate agreed split.
3. Logged out, open /c/<slug>, /c/<slug>/donate and /campaigns/<id>. Read the split disclosure.
4. Donate GHS 10.00 by card. In admin /campaigns/<id> > Split proceeds, the beneficiary balances are 60/40 of the net and sum exactly to it.
5. As the organizer, request a cashout in the cashout section.
6. Search web and mobile for any screen to register a beneficiary payout destination or request a beneficiary payout.

**Expect:** Donors see 'This campaign's proceeds are shared: <name> 60%, <name> 40%.' on every donate entry point. The cashout is refused with 409 'This campaign shares proceeds; request per-beneficiary payouts instead', and the message is shown clearly. The organizer or beneficiary must have a way to request per-beneficiary payouts before launch. Known open issue I013: SPLIT_PROCEEDS_ENABLED is on in render.yaml without the §6 sign-off, and beneficiary destinations and payouts are still API-only (no web or mobile screen). Build the UI or set the flag to false (see GAP5-027).

**Needs:** Paystack

**Source:** `render.yaml`, `apps/web/src/components/campaigns/CampaignSplitSetup.tsx`, `apps/web/src/components/campaigns/SplitDisclosure.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`

## GAP5-026 · P0 · Split proceeds: API-only beneficiary payout path end to end

*Surfaces:* admin, api, email  ·  *Type:* functional

**Before:** The GAP5-025 campaign with accrued balances. An organizer bearer token. Two admins with payout rights, neither of them the organizer.

**Steps:**

1. POST /api/v1/campaigns/<id>/split/beneficiaries/<beneficiaryId>/recipient with bank or MoMo details, for each beneficiary.
2. POST /api/v1/campaigns/<id>/split/beneficiaries/<beneficiaryId>/payouts {amount} for each.
3. Admin /payouts, beneficiary view: confirm Approve is disabled. Click 'Review payout destination'. The destination panel shows the account, bank code, name on request and 'KYC is not verified for this destination.'
4. Click 'Verify KYC'. Enter a 'Beneficiary destination review' note shorter than 20 characters, then one of at least 20 characters, and click Approve.
5. By API, approve with {"reviewNote":"short"} and without a body.
6. Wait for transfer.success on the bpay- references. Payouts become PAID and beneficiary balances go down.
7. GET /api/v1/campaigns/<id>/split/beneficiaries/<beneficiaryId>/statement shows accruals, payouts and a running balance that reconciles.
8. Negative: an amount above the beneficiary's available balance returns 422; another organizer gets 403; a second approve returns 409; an admin who requested the payout or owns the campaign gets 403 'Another administrator must approve payouts from your own campaign or request.'

**Expect:** Approve stays disabled until KYC is verified for the shown destination and the note has at least 20 characters; the API refuses a missing or short note (400) and an unverified destination (422 'Beneficiary KYC must be verified before payout'). The note is stored on the payout's reviews. Amounts paid equal amounts requested, statements reconcile, and the owner is notified that the beneficiary payout is completed.

**Needs:** Paystack transfers

**Source:** `apps/api/src/application/use-cases/BeneficiaryPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## GAP5-027 · P0 · Split proceeds: turning the flag off while split campaigns exist

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Staging with an active split campaign that has accrued beneficiary balances.

**Steps:**

1. Set SPLIT_PROCEEDS_ENABLED=false and redeploy.
2. Check whether the web campaign form and mobile campaign/create still offer split.
3. Check whether the donate pages still show the split disclosure (GET /api/v1/campaigns/<id>/split is not gated on the flag).
4. As the organizer, request an ordinary cashout on the split campaign.
5. Make a new donation and check whether it still accrues per beneficiary. Check that statements still load.

**Expect:** The behaviour is defined and agreed. Either ordinary cashout stays blocked for campaigns with an active split, or split agreements are formally closed first, and the donor disclosure matches what actually happens to new gifts. Known open issue I013: the 409 cashout guard still runs only while the flag is on, so turning it off lets the organizer cash out 100% despite the beneficiaries' agreed shares. Resolve this before choosing 'flag off'.

**Needs:** None external

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `render.yaml`

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
2. Issue a refund for a donation on that campaign from admin /payments ('Refund payment') or the admin API.
3. Check Paystack for a refund and the campaign balances.

**Expect:** The outcome is defined and documented. Required: the platform can refund money it still holds, or a written manual path exists. Known open issue I012 (refund holds, owner decision): refunds reserve only from pendingBalance, and a failed or reversed transfer returns money to availableBalance, so the refund is refused with 409 ('These funds appear already disbursed; a manual clawback is required' or 'Campaign funds are no longer available for this refund') and no Paystack refund is created. Rejecting or cancelling a PENDING payout does return funds to pending (GAP6-033), but that does not apply after a transfer failed.

**Needs:** Paystack test

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`

## GAP6-033 · P0 · Concurrency: a pending cashout can be rejected or cancelled so a refund can proceed

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Staging. A campaign with one card donation. The owner and an admin who does not own the campaign.

**Steps:**

1. The owner requests a cashout of the full eligible balance. Leave it PENDING.
2. Admin tries to refund that donation in admin /payments ('Refund payment').
3. Admin opens the request in admin /payouts, enters a 'Reason for rejection' of at least 20 characters and clicks 'Reject payout'.
4. As the owner, open the campaign's payout history and read the Rejected card.
5. Admin refunds the donation again.
6. Second run: the owner requests a cashout again, clicks 'Cancel request', sees 'Cancel this request? The amount returns to your balance.', and confirms with 'Cancel request'.
7. Try to reject or cancel the same payout twice, and try POST /api/v1/campaigns/<otherCampaign>/payouts/<payoutId>/cancel.

**Expect:** While the request is PENDING the refund is refused with 409 and no Paystack refund is made. Rejection shows 'Payout request rejected. The organizer can see the reason; no transfer was sent.' The owner's card is labelled 'Rejected' with 'The admin team rejected this request: <reason> Nothing was sent, and the amount is back in your campaign balance.' The cleared amount moves back to pendingBalance and the refund then succeeds. Owner cancellation shows 'Request cancelled. Nothing was sent, and the amount is back in your balance.' and a 'Cancelled' card. A second close returns 409 'Payout is no longer pending; refresh before trying again.'; a payout on another campaign returns 404. Each closure writes an audit entry and the owner gets 'Your withdrawal is rejected' or 'is cancelled'.

**Needs:** Paystack test

**Source:** `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`

## GAP7-034 · P0 · Environment: a staging stack fully separate from production

*Surfaces:* admin, api, marketing, web  ·  *Type:* compliance

**Before:** Access to Render, Vercel, Atlas, Paystack, LiveKit, Resend and Cloudinary accounts.

**Steps:**

1. Create a separate Render service for staging that deploys from a staging branch (production deploys each push to main once its checks pass: autoDeployTrigger: checksPass).
2. Staging env: NODE_ENV=production, PAYMENTS_RECONCILIATION_ENABLED=true, CORS_ORIGINS listing the staging web and admin origins, Paystack sk_test/pk_test, a separate Atlas cluster (replica set), a separate LiveKit project, a separate Resend key or domain, a separate Cloudinary cloud, and PUBLIC_WEB_URL/PUBLIC_API_URL/ADMIN_WEB_URL set to staging domains.
3. Point the staging web and admin at the staging API: set VITE_API_URL to https://<staging-api>/api/v1 in the Vercel project env (the committed .env.production calls https://api.ujimora.com/api/v1 directly).
4. Seed staging with apps/api/scripts/seed-e2e.mjs. The seed guard refuses mongodb+srv URIs and remote hosts, so use the cluster's standard mongodb://host1,host2,... connection string with SEED_ALLOW_REMOTE=I_UNDERSTAND_THIS_WIPES_DATA.
5. Configure store sandbox testers (App Store sandbox, Play license testers) against staging.
6. On staging, start a donation and confirm the Paystack callback returns to the staging web domain, not app.ujimora.com. In DevTools confirm every API call goes to the staging API host.

**Expect:** No staging action touches production data, email senders, the media cloud or money. Callback and email links use staging domains. Seeding production-style SRV URIs is refused with 'seed-e2e: refusing to seed — MONGODB_URI uses mongodb+srv:// (a hosted cluster).'

**Needs:** Render, Vercel, Atlas, Paystack test, LiveKit, Resend, Cloudinary, store sandboxes

**Source:** `render.yaml`, `apps/web/.env.production`, `apps/admin/.env.production`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/scripts/seed-e2e.mjs`, `apps/api/scripts/seedGuard.mjs`

## GAP7-035 · P0 · Environment: background timers actually run in staging

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** The GAP7-034 staging stack.

**Steps:**

1. Confirm NODE_ENV=production in the staging logs at boot.
2. Every 5 minutes the logs show the reconciliation tick: 'payment reconciliation sweep complete', and 'subscription checkout reconciliation sweep complete' when checkouts were scanned. The same tick matures affiliate commissions and reconciles payouts, top-ups and crypto.
3. Break the outbox dispatch once (e.g. stop realtime) and confirm pending outbox rows drain within about 60 seconds of recovery.
4. Close a test account and confirm erasure completes within minutes (60-second sweep).
5. Confirm tip checkout credentials are cleared within 5 minutes after a tip reaches a final state.
6. Let a campaign pass its end date and confirm it is relabelled EXPIRED within 5 minutes.
7. On a NODE_ENV=development instance, confirm a missed donation webhook is NOT repaired by default, then set PAYMENTS_RECONCILIATION_ENABLED=true and RECONCILIATION_SCHEDULER_ENABLED=true, restart, and confirm it is repaired.

**Expect:** All production timers run in staging. The reconciliation tick runs only when both PAYMENTS_RECONCILIATION_ENABLED and RECONCILIATION_SCHEDULER_ENABLED are true (the second defaults to true only when NODE_ENV=production) and never under NODE_ENV=test. The campaign-expiry sweep runs in every non-test environment. Sweep-dependent cases (DONATE-022, WALLET-012, PAYOUT-45, SUBS, GAP4-022) are scheduled only where the scheduler is on.

**Needs:** Render logs

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.ts`

## GAP7-037 · P0 · Environment: seed scripts can never touch production

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A list of everyone holding the production MONGODB_URI. A local MongoDB on 127.0.0.1.

**Steps:**

1. Run MONGODB_URI=<production mongodb+srv URI> node apps/api/scripts/seed-dev.mjs. Then NODE_ENV=production with a local URI. Then a non-local mongodb:// host without SEED_ALLOW_REMOTE.
2. Run seed-dev.mjs against 127.0.0.1 without SEED_ADMIN_PASSWORD, then with SEED_ADMIN_PASSWORD set.
3. Query production users for emails ending @ujimora.dev and for admin@ujimora.com and amara2@ujimora.com.
4. Try to sign in to https://admin.ujimora.com as admin@ujimora.com with 'Admin2026!'.
5. Confirm every staff account has MFA enrolled.
6. Run seed-e2e.mjs only against staging and confirm it creates seed-creator@ujimora.dev and 'Seeded Water Project' there only.

**Expect:** Each unsafe target exits with code 1 before connecting and prints 'seed-dev: refusing to seed — <reason>.' (for example 'MONGODB_URI uses mongodb+srv:// (a hosted cluster)', 'NODE_ENV is production' or 'MONGODB_URI points at a non-local host (<host>)'), never echoing the URI. Without SEED_ADMIN_PASSWORD the script logs 'seed-dev: SEED_ADMIN_PASSWORD not set — skipping the admin account' and creates no admin; the literal 'Admin2026!' no longer exists in the script. Production has no seeded accounts, the old seeded admin password does not work, and every staff account has MFA.

**Needs:** Atlas

**Source:** `apps/api/scripts/seedGuard.mjs`, `apps/api/scripts/seed-dev.mjs`, `apps/api/scripts/seed-e2e.mjs`

## GAP7-038 · P0 · Environment: which QA cases may run against production

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** The full QA case list.

**Steps:**

1. Tag each case as production-allowed, staging-only or sandbox-only.
2. Production-allowed: read-only smokes, the GAP1 journey with a named QA organization and small real money, GAP2-015/016, GAP3 reconciliation and the GAP-N001 tag script.
3. Staging-only: webhook forgery and replay, kill-switch toggles, race tests, sweep starvation, seeds, split flag flips, erasure tests, load tests, retagging recipient modes.
4. Freeze merges to main during the QA window: render.yaml uses autoDeployTrigger: checksPass, so any push to main still deploys once CI is green. Confirm Vercel production deploys are also paused or controlled.
5. Mark production QA records (a named org, a tag) so they can be excluded from leaderboards and metrics, and plan their cleanup after launch.

**Expect:** A signed matrix. No destructive or forged-webhook case is run against production, and no green merge to main lands during the window.

**Needs:** None

**Source:** `render.yaml`, `apps/web/vercel.json`, `DEPLOYMENT.md`

## GAP7-039 · P0 · Environment: every variable the code reads is set on Render

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** Render dashboard access for production and staging. render.yaml synced: it now declares MFA_ENCRYPTION_KEY, AUTH_EMAIL_ENCRYPTION_KEY_BASE64, STORE_BILLING_*, STORE_RECEIPT_ENCRYPTION_KEY_BASE64, APPLE_IAP_* and GOOGLE_PLAY_* as sync:false, so they appear without values until pasted.

**Steps:**

1. Confirm each of those keys has a value on Render (APPLE_IAP_ENVIRONMENT: Sandbox for staging, Production for prod).
2. Read the boot logs for 'Production capabilities disabled by missing configuration' and 'Optional production capabilities are off'.
3. Enroll MFA on an admin account (needs MFA_ENCRYPTION_KEY) and sign in with it.
4. Trigger a password reset and a verification email (account email encryption).
5. Staging: complete a sandbox in-app subscription on iOS and Android. After release, complete one production purchase and check admin /store-billing.

**Expect:** Each feature works in each environment. The boot log has no 'Production capabilities disabled by missing configuration' error; if present it names the disabled capability and the variable names (never values) and blocks launch. 'Optional production capabilities are off' naming store billing is acceptable only if store billing is meant to be off.

**Needs:** App Store Connect, Google Play Console

**Source:** `render.yaml`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/app.ts`, `DEPLOYMENT.md`

## GAP7-040 · P0 · Environment: Vercel preview deployments and the production API

*Surfaces:* admin, marketing, web  ·  *Type:* security/permission

**Before:** Any Vercel preview URL for web, admin and marketing. Access to the Vercel project env for Preview.

**Steps:**

1. Open a web preview with no Preview-scoped VITE_API_URL. In DevTools > Network watch the /api/v1 calls and the console.
2. Set VITE_API_URL=/api/v1 for Preview in the Vercel project and redeploy the preview. Repeat.
3. Compare the data with production (e.g. the same campaigns, and sign-in with a production account works).
4. Read apps/web and apps/admin .env.production (VITE_API_URL=https://api.ujimora.com/api/v1) and the vercel.json /api/v1 rewrite to https://api.ujimora.com.
5. Confirm Vercel Deployment Protection is on for previews.

**Expect:** Previews are either pointed at a staging API or treated as production (no testing on them). Without a Preview override the bundle calls https://api.ujimora.com directly and the *.vercel.app origin is rejected by CORS, so the preview fails to load data. With VITE_API_URL=/api/v1 it goes through the rewrite and reads and writes production data. Known open issue I034: there is no staging stack or host-conditional rewrite yet.

**Needs:** Vercel

**Source:** `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/marketing/vercel.json`, `apps/web/.env.production`, `apps/admin/.env.production`, `DEPLOYMENT.md`

## GAP2-004 · P0 · Support-only refund of a guest donation from the admin console, with idempotency and exact money

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** Two admin accounts with DONATIONS update access. A guest Paystack test donation of 50 GHS plus a 5 GHS optional tip, with its Paystack reference. REFUNDS_AND_FEES policy for fees and tips agreed.

**Steps:**

1. The guest emails support@ujimora.com with amount, date and Paystack reference. Support replies to the same address to verify ownership and opens a case.
2. Admin /payments: search by 'Provider reference' or 'Donor email (exact)', click 'View timeline', and confirm providerRef, amount, tip, fees and campaign.
3. Record campaign raisedAmount, the CampaignBalance (available, pending, paid out) and the journal entries for the intent.
4. Click 'Refund payment'. In 'Refund contribution' keep the full amount, tick the confirmation box and submit; double-click the button.
5. By API, repeat POST /api/v1/admin/payments/<intentId>/refund with header Idempotency-Key: qa-refund-001, then qa-refund-002.
6. Check admin /refund-recovery, the Paystack refunds, the public campaign total, CampaignBalance and the journal.
7. On a second guest gift, refund 10 in the dialog (partial), then try a second partial that would exceed the principal.

**Expect:** Exactly one Paystack refund. The dialog reports 'Refund of GHS 50.00 confirmed by the provider…' and the 'Refund payment' button disappears once the payment is Refunded. API repeats after a full refund are refused with 400 'Only a settled contribution can be refunded' and create no provider refund. Partial refunds are capped: the dialog allows only up to the contribution amount and the API refuses an over-cap refund (409 'This refund was already processed or would exceed the refundable amount'). raisedAmount and the campaign balance fall by exactly the campaign's share, to the pesewa. Compensating journal entries balance. Fee and tip treatment matches the written policy. Ujimora sends the guest no email, so support sends the confirmation from the case.

**Needs:** Paystack test keys with refunds

**Source:** `apps/admin/src/pages/PaymentsPage.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/admin/src/pages/RefundOperationsPage.tsx`

## GAP2-006 · P0 · Signed-in refund requests reach the staff queue and the donor sees the outcome

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Registered donor D with a completed card donation of 30 GHS less than 30 days old, a wallet-funded donation, and 'refunds' alerts on. Admin with DONATIONS update permission.

**Steps:**

1. As D, on web /donations click 'Request Refund' on the card gift and submit a reason and description on /donations/refund/<id>. Note the Refund ID.
2. Try to submit a second request for the same donation. Check the row now reads 'Refund requested'.
3. Find the wallet gift in /donations: it shows 'Wallet gift: contact support@ujimora.com for a refund'. By API, POST /api/v1/refunds for it.
4. As admin open /refund-requests (status filter 'Awaiting review'). Check donor, campaign and the linked payment chip.
5. Enter a staff note shorter than 20 characters, then a valid one, and click 'Approve and mark processing'. Try 'Mark refunded' before refunding.
6. Click 'Refund payment' and complete the refund, then 'Mark refunded'. On another request, click 'Decline'.
7. As D, check /refunds on web and My Refunds on mobile, and the notifications.
8. Open /donations and filter 'Refunded'.

**Expect:** Every request appears in admin /refund-requests; the action centre counts pending and processing ones. A second request returns 409 'Refund already requested for this donation'. The wallet gift has no refund button and the API returns 422 'Wallet donations can't be refunded automatically. Contact support@ujimora.com with the donation ID.' Notes under 20 characters are refused, and 'Mark refunded' stays disabled until the payment is REFUNDED. D sees the status change on web and mobile and gets 'Your refund is processing', 'completed' or 'failed' alerts; staff notes stay internal. My Donations then shows 'Refunded' (or 'Refund in progress' / 'Partially refunded'), the 'Refunded' filter matches, and refunded gifts no longer count in totals.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/RefundRequestsPage.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/web/src/pages/MyDonationsPage.tsx`, `apps/web/src/lib/donationRefunds.ts`

## GAP2-014-2 · P0 · Automatic payout leaves before staff can react; blocking and the policy switch contain it

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging F from GAP2-013-2. Automatic payouts enabled with maxAmount of at least 500. Recipient reviewed within reviewMaxAgeDays. No open dispute. Amount below the dual-approval threshold.

**Steps:**

1. As F, use campaign cashout on web to request a standard 300 GHS payout to the reviewed bank recipient. Time the response.
2. Within 10 s, open admin /payouts and the Paystack transfers dashboard.
3. The admin blocks CF. F requests another standard 300 GHS payout.
4. The admin turns automatic payouts off in admin Settings, then returns CF to review and approves it. F requests again.
5. Check the automatic payout policy history (GET /api/v1/admin/automatic-payouts) and admin /audit.

**Expect:** The first payout is approved automatically inside the same request and the Paystack transfer starts before any human sees it. While CF is blocked the request is refused with 409 'This campaign is under review; payouts are paused' and no payout row is created. With the policy off, the request stays PENDING with reason 'Automatic payouts are disabled.' and waits in the manual queue. The policy change is in its history and the audit log. The fraud runbook's first steps are 'block the campaign' and 'turn off automatic payouts'.

**Needs:** Paystack test keys (transfers)

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PayoutController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/admin/src/components/AutomaticPayoutSettings.tsx`

## GAP2-015-2 · P0 · Payouts on a blocked campaign are refused, and pending requests can be rejected

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** CF with at least 500 GHS available and one PENDING bank payout requested before the block. Paystack test keys. Two admins, neither of them F.

**Steps:**

1. Block CF.
2. As F, POST /api/v1/campaigns/<CF>/payouts with {amount:200,type:'standard'}.
3. As F, POST /api/v1/campaigns/<CF>/payouts with {destination:'ujimora_wallet', idempotencyKey:<uuid>, amount:100}.
4. In admin /payouts, try to approve the pre-block request with a review note of at least 20 characters.
5. Reject it with a 'Reason for rejection' of at least 20 characters.
6. Open a dispute on another campaign (Paystack dispute event) and try a payout request there.
7. Record the CampaignBalance and F's wallet after each step.

**Expect:** Both new requests are refused with 409 'This campaign is under review; payouts are paused', and no payout row or wallet credit is created. Approving the pre-block request is refused with the same 409. Rejection closes it as 'Rejected' with the reason visible to F, returns the cleared amount to pending, and writes an audit entry. A campaign with an open dispute refuses payouts with 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' Balances stay internally consistent.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

## GAP2-018 · P0 · 'Report Campaign' submissions reach the admin Campaign reports queue

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Reporter R signed in. Admin with REPORTS permission.

**Steps:**

1. R clicks 'Report Campaign' on /campaigns/<id>, chooses Fraudulent and adds a description. Also check the reason list includes 'Intellectual property / copyright' and 'Privacy or likeness'.
2. Admin opens the action centre and admin /campaign-reports (sidebar 'Campaign reports' under Trust & safety; the analytics page is now 'Analytics reports').
3. Open the report: check reason chip, campaign status chip, description and 'Open campaign'.
4. Try 'Mark reviewed' with a note under 20 characters, then with a valid note. Try to review it again from a second tab. Dismiss a different report.
5. Export the queue.
6. A signed-out visitor clicks 'Report Campaign'.

**Expect:** Every campaign report appears in the queue and the action centre count. The page reminds staff 'Marking a report reviewed or dismissed does not change the campaign. To stop a fraudulent campaign, open it and block it first, then record what you did here.' Short notes are refused ('Enter at least 20 characters of review notes'); a second decision gets 409 'Report has already been reviewed'. The decision stores reviewer, time and notes, writes an audit row and sends R 'We reviewed your report'. A signed-out visitor is sent to login.

**Needs:** none

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`

## GAP2-019 · P0 · Public FAQ fraud promises match what staff can actually do

*Surfaces:* admin, marketing, web  ·  *Type:* compliance

**Before:** Results of GAP2-013-2 through GAP2-018.

**Steps:**

1. Open ujimora.com Help and read 'What happens if a campaign is fraudulent?'. If the production CMS still shows the old text, update it in admin /content/faq.
2. Open the CMS FAQ (admin /content/faq; seeded from siteContentDefaults) and where it is shown in the web app.
3. Compare each promise with the tabletop results: 'We remove the campaign from public view', 'hold payouts that have not yet been approved while we investigate', 'work with donors on refunds where funds can be recovered', 'Use the "Report" button on any campaign'.

**Expect:** Every promise has a working, rehearsed staff procedure, with legal sign-off: Block campaign removes it from view; blocking refuses payout approvals and staff can reject pending requests; refunds go through admin /payments while funds are still pending; reports reach admin /campaign-reports. The old 'funds are frozen' and 'permanently banned' claims are gone from the seed and the HelpPage fallback, and must not remain in the live CMS.

**Needs:** legal reviewer

**Source:** `apps/marketing/src/pages/HelpPage.tsx`, `apps/api/src/infrastructure/database/siteContentDefaults.json`, `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/admin/src/pages/PaymentsPage.tsx`

## GAP2-022 · P0 · Payment completing after a campaign is blocked or past its end date

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Campaign CC active. Paystack test card and a MoMo test flow.

**Steps:**

1. A donor starts a web donation on CC, reaches the Paystack checkout and pauses.
2. The admin blocks CC.
3. The donor completes the payment. Also test a MoMo approval arriving more than 2 minutes later.
4. Watch the webhook, /donate/callback, the campaign raisedAmount, CampaignBalance and the journal.
5. A new donor opens /c/<slug>/donate and sends POST /api/v1/donation-intents for CC.
6. The organizer requests a payout of the late gift.
7. Repeat with a campaign whose endDate passes during checkout.

**Expect:** New intents are refused with 'Campaign is not accepting donations'. The in-flight payment still settles and is credited to CC's raised total and balance, and the donor sees success. The ledger balances. The late gift cannot be paid out while CC is blocked (409 'This campaign is under review; payouts are paused'); on the ended campaign it can be paid out after the campaign expires. The runbook covers refunding late gifts on blocked campaigns from admin /payments.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`

## GAP2-029 · P0 · Network drops after Give is tapped: the retry must not double-charge

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** DevTools (or a proxy) able to drop the response to POST /api/v1/donation-intents.

**Steps:**

1. Tap Give and drop the connection after the request is sent but before the response arrives.
2. Restore the connection and tap Give again with the same details. Pay on the resulting checkout.
3. Change the amount and tap Give again.
4. Pay a donation, return to the same donate tab and tap Give again with the same details.
5. In admin /payments, list the intents for this email and campaign.

**Expect:** The retry sends the same Idempotency-Key, so it returns the same intent and the same Paystack checkout: one intent, one charge. Changing the details starts a new attempt with a new key. Pressing Give again after the same donation succeeded shows its confirmation (or 'This donation has already been completed. Thank you!') instead of charging again. The campaign counts the gift once. By API, reusing a key with different details returns 409 'This checkout request key was already used for different details.'

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/checkoutAttempt.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/lib/fundraising.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

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

## GAP2-037 · P0 · Legacy approved KYC with no expiryDate is shown as expired everywhere

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** The staging snapshot from GAP2-036.

**Steps:**

1. Count KYC verifications with status 'approved' and no expiryDate.
2. For three affected users, check web /kyc and mobile Verification, the public profile badge (GET /api/v1/users/<id>/public), creating a new campaign (allowance), an admin approving their pending campaign, a manual payout request, a creator withdrawal and automatic payout eligibility.
3. Submit a renewal for one user; for a user whose approval is current and more than 30 days from expiry, try to resubmit.

**Expect:** Status, level and allowance now agree: /kyc and Verification show the record as expired and offer renewal; the badge is missing; the allowance drops; campaign approval asks for renewal; payouts and bank withdrawals are refused until verification is current ('The account holder’s identity verification is missing, expired or under renewal…'). Renewal works for expired records, while an early resubmission is refused with 409 naming the date renewal opens. Before launch, decide on a backfill (for example expiryDate = reviewedAt + 365 days) or send a re-verification notice, then re-test.

**Needs:** Staging snapshot

**Source:** `apps/api/src/domain/services/currentKycEvidence.ts`, `apps/api/src/domain/services/currentVerificationLevel.ts`, `apps/api/src/application/use-cases/GetKYCStatusUseCase.ts`, `apps/api/src/domain/services/currentCampaignAllowance.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycBusinessRoutes.ts`

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

**Before:** A owns campaign CA with a PENDING payout; B owns CB. SPLIT_PROCEEDS_ENABLED=true in staging, with an active split on CA and beneficiary X (not B). An admin who does not own CA.

**Steps:**

1. With B's token: GET /api/v1/campaigns/<CA>/payout-options; GET /campaigns/<CA>/payouts; POST /campaigns/<CA>/payouts/<A payoutId>/refresh; POST /campaigns/<CB>/payouts/<A payoutId>/refresh (mismatched pair).
2. POST /campaigns/<CA>/payouts/<A payoutId>/cancel; POST /campaigns/<CB>/payouts/<A payoutId>/cancel.
3. POST /campaigns/<CA>/payout-recipient with {savedAccountId: B's}; POST /campaigns/<CB>/payout-recipient with {savedAccountId: A's}; POST /campaigns/<CA>/payouts {amount:10}.
4. With the admin's token: POST /campaigns/<CA>/payout-recipient and POST /payouts/<A payoutId>/reject as a non-admin (B).
5. GET and POST /campaigns/<CA>/qr-codes.
6. Split: GET /campaigns/<CA>/split/versions; GET /campaigns/<CA>/split/beneficiaries/<X>/statement; POST /campaigns/<CA>/split/<v>/consent; POST /campaigns/<CA>/split/<v>/activate; POST /campaigns/<CA>/split/beneficiaries/<X>/recipient, /verify-kyc and /payouts; GET /campaigns/<CA>/split/payouts.

**Expect:** Every call returns 403 or 404. B's cancel on CA returns 403 'Only the campaign owner can cancel this payout request'; the mismatched campaign returns 404 'Payout not found'. The admin who does not own CA gets 403 on payout-recipient, before any provider call. A non-admin reject returns 403. No recipient is attached, no provider refresh or settlement is triggered, and no statement or version data leaks. Record where a 403 confirms the resource exists, and decide whether that is acceptable.

**Needs:** SPLIT_PROCEEDS_ENABLED on staging; Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/application/use-cases/CreatePayoutRecipientUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`

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

## GAP3-038 · P0 · Rate limits are per client behind the Render and Cloudflare edge (not one shared bucket)

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Staging deployed on Render exactly like production, with a web build that calls the API origin directly (VITE_API_URL absolute). Tester A (script) and tester B on different networks, one of them Ghanaian mobile data (MTN or Telecel). Read access to the API logs and admin /audit.

**Steps:**

1. From A's network, send 31 POST /api/v1/auth/login requests with a wrong password within 2 minutes (curl loop), and note X-RateLimit-Remaining.
2. Immediately, B signs in normally at the staging web login and notes the X-RateLimit-Remaining header on /auth/login.
3. From A, repeat with forged headers: X-Forwarded-For: 203.0.113.9 and CF-Connecting-IP: 203.0.113.9.
4. From A, send 61 POST donation-intent requests while B starts a donation.
5. Check which IP the audit log records for B's actions.

**Expect:** B is unaffected: B's first login shows X-RateLimit-Remaining 29, with A and B in separate buckets. A's 31st request gets 429 'Too many requests, please try again later' with Retry-After. Forged X-Forwarded-For has no effect and a forged CF-Connecting-IP is overwritten by the edge, so A cannot escape its bucket. The audit log records B's real address. Browsers on an old bundle that still use the Vercel /api/v1 rewrite share Vercel's egress address; confirm production bundles call the API directly.

**Needs:** Render staging deploy

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/web/.env.production`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`

## GAP3-049 · P0 · Late charge.success replay after a FULL admin refund is acknowledged and never re-credits

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys. The ability to replay the captured webhook body with a valid x-paystack-signature (HMAC-SHA512 over the raw body using the test secret). Admin with DONATIONS update access. Campaign C. Optional live session and SPLIT_PROCEEDS_ENABLED to observe accruals.

**Steps:**

1. A donor pays GHS 100 to C (web). Record C's raised, available and pending amounts, the Donation count, the journal entries for the intent, live stats and split accruals.
2. Admin refunds it in full from admin /payments ('Refund payment'). Wait for REFUNDED, resolving any pending operation at admin /refund-recovery.
3. Replay the ORIGINAL charge.success webhook (same reference) once, then 5 times concurrently.
4. Re-check every value from step 1. Record the HTTP status returned to each replay and the log line.
5. Check the donor's /donations status, the realtime feed and overlay, and receipts and activity emails.

**Expect:** Every replay gets 200 and the log reads 'paystack charge.success redelivered for an already-settled intent — acknowledged', so Paystack stops retrying. There is no re-credit: C's balances are unchanged since the refund, there is no new Donation row or journal entry, and the intent stays REFUNDED. There is no new split accrual, live stat, overlay event or email. The donor's row shows 'Refunded'. The refund itself reduced the live session's raised amount and gift count.

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.ts`, `apps/admin/src/pages/PaymentsPage.tsx`

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

**Before:** A web member with a GHS wallet (on iOS native, top-ups open Safari, so test on web). Paystack test keys and the reconciliation scheduler on. The ability to replay a signed webhook.

**Steps:**

1. At app.ujimora.com/wallet, top up GHS 100 and confirm the balance rose by 100 (processor fees absorbed).
2. Donate GHS 80 from the wallet; the balance is 20.
3. Replay the wtop-... charge.success 3 times concurrently.
4. Check the wallet balance, the transactions list and the journal entries for that reference.
5. Start a second top-up and abandon the checkout. After a sweep, check its status. Then either decline the card so Paystack reports failed, or backdate createdAt by 25 hours and wait one sweep, until it is failed.
6. Complete a payment with that same reference within 72 hours and deliver success (or wait for the hourly re-check). Replay the success again.

**Expect:** After step 3 the balance is still 20, there is no duplicate DEPOSIT transaction or journal entry, and the response is 200 (completed top-ups return early). An abandoned top-up stays pending while it is under 24 hours old. A genuine late success on a failed top-up is credited exactly once (failed -> completed), either by the webhook or by the sweep, which re-checks failed top-ups hourly for 72 hours; it appears in history with the requested amount, and the replay changes nothing. Note: a completed top-up that Paystack later reverses has no clawback path; flag it for the policy owner.

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/app.ts`

## GAP-N001 · P0 · Cutover: tag untagged Paystack recipient codes with scripts/tag-recipient-mode.ts

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Production just switched to sk_live_ (GAP2-011). An operator machine with Node and tsx, the production MONGODB_URI and the live PAYSTACK_SECRET_KEY. The launch log open. At least one saved payout account and one campaign transferrecipients row created under test keys before tagging existed.

**Steps:**

1. Report mode: cd apps/api && MONGODB_URI=<prod> PAYSTACK_SECRET_KEY=sk_live_... npx tsx scripts/tag-recipient-mode.ts. Record the printed summary.
2. Check that nothing was written (recipientMode still absent on the sampled rows).
3. Apply mode: run it again with --apply. Record the summary.
4. Run --apply a second time.
5. For a saved account now tagged 'test', have its owner open the creator withdrawal form (or register it on a campaign) and check the account in the DB.
6. For a campaign transferrecipients row now tagged 'test', have an admin approve a pending payout that uses it.
7. Run the script with no MONGODB_URI, then with no PAYSTACK_SECRET_KEY.

**Expect:** The report prints {apply:false, mode:'live', scanned, current, otherMode, unresolved, written:0} and writes nothing. --apply tags each untagged code: codes the live key knows become 'live', codes it does not know become 'test', and codes that could not be checked stay untagged (unresolved) for a re-run. The second --apply writes 0. A saved account tagged 'test' gets a fresh live recipient in place when next used (same id and name check). Approving a payout to a campaign recipient tagged 'test' is refused with 409 'This payout destination was registered in Paystack test mode. The owner must add the account again before it can be paid.' before anything is reserved. Missing variables exit with code 1 and 'MONGODB_URI required' or 'PAYSTACK_SECRET_KEY required'. The summaries are pasted into the launch log.

**Needs:** Paystack live key; production DB access

**Source:** `apps/api/scripts/tag-recipient-mode.ts`, `apps/api/src/infrastructure/database/tagRecipientModes.ts`, `apps/api/src/domain/value-objects/PaystackMode.ts`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`

## GAP-N003 · P0 · A Paystack chargeback on a campaign donation opens a dispute and pauses that campaign's payouts until staff close it

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging with a signed webhook tool. Campaign C with a settled card donation, an eligible balance, a PENDING manual payout request and automatic payouts enabled for its owner. An admin with DISPUTES permission.

**Steps:**

1. Send charge.dispute.create for the donation's transaction reference (with a dispute id, amount, currency and due date).
2. Open admin /disputes and the new case. Check reporter, reason, transaction reference, amount and due date.
3. As the owner, request a new payout on C. As admin, try to approve the existing PENDING request.
4. As the owner, request a payout that would qualify for automatic approval.
5. Send charge.dispute.remind, then charge.dispute.resolve for the same case. Check the case status.
6. Redeliver charge.dispute.create.
7. In admin /disputes/<id> record resolution notes and choose Decision 'Resolved'. Retry the payout request.

**Expect:** One dispute is opened per Paystack case, with reporter 'Paystack (payment provider)', the transaction reference, amount, currency and due date; a redelivery updates it rather than duplicating it. While it is open or under review, payout requests and approvals on C are refused with 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' and automatic payouts go to manual review ('Campaign has an unresolved dispute; manual review required.' when verified). Paystack's resolve moves the case to Under Review and never closes it. Once staff resolve or dismiss it, payouts work again. Each staff decision is in admin /audit.

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/application/use-cases/GetDisputeUseCase.ts`, `apps/api/src/infrastructure/database/models/DisputeModel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/admin/src/pages/DisputeDetailPage.tsx`

## GAP-N005 · P0 · A Paystack success on an intent already EXPIRED or FAILED is credited exactly once

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with the reconciliation scheduler on and a signed webhook tool. A web donation checkout left unpaid, then backdated (createdAt 25 hours ago) until the sweep marks it EXPIRED. A second intent that the donor's callback marked FAILED. A fee-waiver coupon on one of them.

**Steps:**

1. Confirm the first intent is EXPIRED and its fee-waiver seat RELEASED.
2. Complete a payment with the same reference (or deliver a signed charge.success whose amount and currency match).
3. Check the intent status, the campaign raised total, the Donation rows, the journal and the logs.
4. Replay the charge.success twice.
5. Deliver a charge.success for the FAILED intent with a different amount.
6. As the donor, open /donate/callback?reference=<ref> for the first intent.
7. As admin, run POST /api/v1/admin/payments/<id>/reconcile on an EXPIRED intent that Paystack reports as success.

**Expect:** The matching late success is verified with Paystack, the intent is reopened and settled once: SUCCEEDED, one Donation, one balanced journal entry, the raised total up once, and the log carries alert 'late_success_credited'. The fee waiver is honoured at the rate quoted. Replays change nothing. The mismatched amount is not credited and the intent stays FAILED. The donor's callback shows success. The admin reconcile repairs an EXPIRED intent the same way. No other state (REFUNDED, DISPUTED) is ever reopened.

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

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

## GAP1-009 · P1 · E2E-9: Emails and in-app notices across the journey, and the data-rights request

*Surfaces:* admin, email, web  ·  *Type:* compliance

**Before:** GAP1-001 to 008 done. Access to the org, donor and info@ inboxes. Render FROM_EMAIL and REPLY_TO_EMAIL synced from render.yaml. The org and donor have every activity-alert category on (in-app and email).

**Steps:**

1. List every email received since T0. Expect: 'Verify your Ujimora email address' (sent at signup), the staff 'Campaign awaiting review' alert to REVIEW_ALERT_EMAIL, activity emails for each opted-in event (donation received, 'Your donation is confirmed', withdrawal status, subscription, refund status) and 'Your Ujimora privacy request has a response'.
2. Open the org's dashboard notifications and the mobile bell. Campaign approval ('Your campaign is live') and the KYB decision ('Your organization verification is approved') appear there as in-app notices only; confirm no email was sent for them.
3. For each email check: From no-reply@ujimora.com, Reply-To support@ujimora.com, links go to app.ujimora.com (never localhost or onrender.com), GHS amounts match the records, anonymous donors are not named. For the donor's gift with a tip, the body includes 'Total charged: GHS X, including a GHS Y optional platform tip.'
4. At /settings turn off one activity-alert category, make another GHS 1 donation, and confirm no email arrives for that category.
5. As the org, in Settings > data rights, submit an 'access' request with at least 10 characters of detail. Submit a second one immediately.
6. As staff open admin /privacy-requests and respond with the data export (account delivery) before the 30-day due date.
7. Open the 'Your Ujimora privacy request has a response' email: it gives the reference and a link to /settings and does not contain the response. Download the export from Settings.
8. Check the export covers the org profile, campaigns, donations received, payouts, subscription and KYB status, and contains no other user's personal data.

**Expect:** Every expected email arrives once with correct amounts, sender and links. Staff decisions reach the org as in-app notices, not email. The disabled category stays silent. The second data-rights request returns 409 ('You already have an open request of this type...'). The response email carries no personal data and staff can fulfil and close the request within the due date.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `apps/web/src/components/account/DataRightsRequests.tsx`, `render.yaml`

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
4. Open the campaign and the donate screen and read the split disclosure.
5. Try to cash out from the app.

**Expect:** Shares are stored as 3333/3333/3334 basis points, invalid totals are refused, and activation works. The campaign and donate screens show 'This campaign's proceeds are shared: …' with each name and share. The cashout is refused with 'This campaign shares proceeds; request per-beneficiary payouts instead'. Known open issue I013: there is no in-app way to request beneficiary payouts.

**Needs:** Store builds

**Source:** `apps/mobile/src/components/CampaignManagement.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/lib/splitDisclosure.ts`

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

**Before:** Build N (from this branch) installed with the constant '2026-09-12'. A staging API with LEGAL_ACCEPTANCE_VERSION bumped in packages/types. An existing user whose acceptance is the old version. Build N+1 with the new text uploaded to TestFlight and Play internal.

**Steps:**

1. With MIN_APP_VERSION_IOS/ANDROID unset, on build N (iOS and Android) register a new account and record the error.
2. Sign in as the existing user and open Review agreement (account-agreement).
3. Android: donate with a public name or message and tick the content terms. Try publishing a campaign update or uploading an image.
4. Set MIN_APP_VERSION_IOS and MIN_APP_VERSION_ANDROID to build N+1's version on staging and restart. Relaunch build N, and also resume it from the background after 5 minutes.
5. Tap 'Update Ujimora'.

**Expect:** On the agreement screen build N shows 'An updated account agreement is available. Update Ujimora from the App Store or Google Play to review and accept it, or review it on the Ujimora website.' with 'Review on the website', and never accepts text it did not show. With the minimum raised, build N shows a blocking 'Update required' screen: 'This version of Ujimora (<N>) is no longer supported. Update to version <N+1> or later from <store> to keep using your account, donations and campaigns.' and the button opens the store listing. Known open issue I094: without the minimum raised, register and donate-with-message from build N still fail with a generic 400 validation error (no 426 or LEGAL_VERSION_OUTDATED response), so the release checklist must raise MIN_APP_VERSION_* when the version is bumped.

**Needs:** TestFlight, Play internal track

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/legalAcceptanceSchema.ts`, `packages/types/src/legal-acceptance.ts`, `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/mobile/src/components/UpdateRequiredGate.tsx`, `apps/mobile/app/account-agreement.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/app/donate/[id].tsx`

## GAP8-042 · P1 · Version skew: acceptance on web is picked up by the app

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** The state from GAP8-041 with the minimum version not raised.

**Steps:**

1. Accept the new agreement on web at /account-agreement.
2. Bring the app to the foreground (or relaunch it). Watch the 'Review the account agreement' notice.
3. Publish content from the app.
4. Sign in as another user who has not accepted, and tap Review agreement in the app.

**Expect:** Web and app agree on the acceptance state: the app re-reads GET /api/v1/profile/legal-acceptance on foreground and after any 428, and the notice disappears once the server has the new acceptance. Publishing works. For a user who has not accepted, the app shows the update-or-website path instead of submitting its old version, so there is no 400 loop.

**Needs:** Store builds

**Source:** `apps/mobile/src/components/AccountAgreementNotice.tsx`, `apps/mobile/src/lib/agreementStatus.ts`, `apps/mobile/app/account-agreement.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`

## GAP8-043 · P1 · Version skew: no over-the-air updates; the minimum-version gate is the kill path

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** The release owner is present. Staging API access to set MIN_APP_VERSION_*.

**Steps:**

1. Confirm apps/mobile/app.json sets updates.enabled: false and eas.json has no channel.
2. Launch the production build in airplane mode and confirm startup is not blocked by update or config checks.
3. Call GET /api/v1/app/config and confirm it returns minSupportedVersion (null by default) and the store URLs, with Cache-Control public, max-age=300.
4. On staging set MIN_APP_VERSION_ANDROID to a value above the installed build; relaunch and confirm the 'Update required' screen. Set an invalid value such as 'v1.2' and restart the API.
5. Write the incident plan for a broken store build: an API-side feature switch, raising MIN_APP_VERSION_* once the fixed build is live, an expedited review request, and user messaging.

**Expect:** OTA updates are explicitly off, so every JavaScript fix needs a store release, and the team accepts this in writing. The gate fails open offline and on bad data. An invalid MIN_APP_VERSION value stops the API at boot with 'MIN_APP_VERSION_ANDROID must be a numeric app version such as 1.2.0'. The incident plan uses the minimum-version gate.

**Needs:** EAS

**Source:** `apps/mobile/app.json`, `apps/mobile/eas.json`, `apps/mobile/src/components/UpdateRequiredGate.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/appConfigRoutes.ts`, `apps/api/src/infrastructure/config/mobileApp.ts`

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

**Before:** Access to production marketing and admin /content/faq. The production CMS was seeded before this release, so its FAQ still holds the old text until edited.

**Steps:**

1. Open https://ujimora.com/help. Confirm the corrected answers: no Google/Facebook sign-up; 'Ujimora is built for Ghana… Donations are made in Ghanaian cedis (GHS) through Paystack… some cards issued outside Ghana may not be accepted'; verification described as team review plus a verified-organization badge (no trust scores or vouching); fraud answer 'We remove the campaign from public view, hold payouts that have not yet been approved while we investigate, and work with donors on refunds where funds can be recovered.'
2. Check the remaining answers against the product: 'Our team typically reviews campaigns within 24-48 hours' (only goals above the auto-approve tier are staff-reviewed); 'Campaigns run up to 90 days… You can extend once for 30 additional days' (no length cap or extension exists); 'Can I edit my campaign after it's live? Yes…' (editing a live campaign is unavailable).
3. Correct each wrong answer in admin /content/faq and publish.
4. In DevTools block api.ujimora.com and reload /help. The hard-coded fallback in HelpPage.tsx renders; check it too.

**Expect:** No false claims in the live CMS or in the fallback. The I019 fix corrected the seed and fallback for sign-up, worldwide donations, trust scores and fraud. The review time, campaign length and extension, and live-editing answers are still wrong in siteContentDefaults.json and HelpPage.tsx and must be corrected in both.

**Needs:** None

**Source:** `apps/api/src/infrastructure/database/siteContentDefaults.json`, `apps/marketing/src/pages/HelpPage.tsx`, `apps/marketing/src/hooks/useContent.ts`, `apps/marketing/src/lib/contentShapes.ts`, `docs/compliance/CAMPAIGN_STAFF_REVIEW.md`

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
3. Save a malformed FAQ from the API (PUT /api/v1/content/faq with items missing 'question') and reload /help.

**Expect:** The seeded FAQ carries the I019 corrections (no worldwide donations, trust scores, frozen funds or social sign-up). Any answer GAP9-045 still flags, and the seeded blog posts ('wallet-backed contributions … remain unavailable', see GAP9-046), must be fixed in the JSON defaults too, so that a restore or new region cannot bring back false claims. The malformed save is refused with 400 and per-field errors; if a bad payload ever reaches marketing, the fallback content renders instead of a broken page.

**Needs:** None

**Source:** `apps/api/src/main.ts`, `apps/api/src/infrastructure/database/seedSiteContent.ts`, `apps/api/src/infrastructure/database/seedBlog.ts`, `apps/api/src/infrastructure/database/siteContentDefaults.json`, `apps/api/src/infrastructure/database/blogPostDefaults.json`, `apps/marketing/src/lib/contentShapes.ts`

## GAP10-049 · P1 · Checkout channels: only the configured channels appear on every rail

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Access to the Paystack live dashboard and the Render env. PAYSTACK_CHANNELS unset (default card,mobile_money).

**Steps:**

1. Paystack > Settings > Preferences > Payment channels: record which are enabled (card, mobile money, bank, bank transfer, USSD, QR, Apple Pay).
2. Open a live checkout for a donation (web and Android), a top-up, a subscription and a tip. Screenshot the channel list each time.
3. Record the 'channels' field in the initialize request (API logs or Paystack transaction details).
4. Decide which extra channels, if any, are approved. To add one, set PAYSTACK_CHANNELS (comma-separated, e.g. card,mobile_money,bank_transfer), redeploy and repeat step 2.

**Expect:** Every rail sends channels from PAYSTACK_CHANNELS, so by default each checkout offers only card and mobile money whatever the dashboard enables. A donation whose intent records the donor's method is narrowed to that single channel. Any channel added to PAYSTACK_CHANNELS has passed GAP10-050/051 first.

**Needs:** Paystack live

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`, `apps/api/src/infrastructure/config/index.ts`

## GAP10-050 · P1 · Checkout channels: bank transfer and other delayed channels

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** 'Pay with transfer' is enabled in the dashboard and PAYSTACK_CHANNELS includes bank_transfer. Staging, or live with GHS 1.

**Steps:**

1. Donate GHS 1.00 and choose bank transfer. Pay the temporary account from a bank app.
2. Watch /donate/callback. Let it reach its polling limit and record the message shown.
3. Wait for the webhook, or up to 35 minutes for the sweep. The donation settles, the raised total goes up and the fee comes from Paystack.
4. Pay a different amount than requested, if the channel allows it, and search the logs.

**Expect:** A late settlement is credited once, even if the intent was already EXPIRED after 24 hours (logged 'late_success_credited'). The callback shows 'Still confirming your payment' with 'We haven’t confirmed this payment yet. If you received a Paystack receipt, don’t pay again. Choose Keep checking to verify its status securely.' and never suggests paying again. An amount mismatch is logged 'reconcile: provider/intent mismatch — flagged, not credited' and is not credited. A registered donor with alerts on gets 'Your donation is confirmed'; a guest gets only Paystack's receipt.

**Needs:** Paystack; a bank account

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/config/index.ts`

## GAP10-051 · P1 · Checkout channels: USSD, QR and Apple Pay; Android Custom Tab return

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** The channels are enabled in the dashboard and listed in PAYSTACK_CHANNELS (e.g. card,mobile_money,ussd,qr,apple_pay). Android and iOS store builds.

**Steps:**

1. Android: start a donation, choose USSD in the Custom Tab and dial the code (this leaves the tab). Return to the app and confirm the pending card recovers ('Awaiting payment confirmation', 'Check status') and resolves after the webhook.
2. Android: pay by QR with a banking app, then return.
3. Android: leave one payment unconfirmed for 15 minutes and read the card.
4. iOS: in the Safari handoff, use Apple Pay if it is offered. Confirm no payment sheet ever appears inside the app.

**Expect:** Each channel settles once. The app recovers the pending payment after the round-trip. After 15 minutes unconfirmed, the card adds 'Still not confirmed? If you already paid, don't pay again: that payment will still be confirmed once the provider reports it.' with 'Start a new payment'. iOS stays compliant.

**Needs:** Paystack; phones with a SIM and banking apps

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## GAP10-052 · P1 · Checkout channels: delayed channels on subscription, top-up and tip checkouts

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Bank transfer or USSD enabled in the dashboard and in PAYSTACK_CHANNELS. Reconciliation scheduler on.

**Steps:**

1. Buy a subscription by bank transfer. /subscription/callback polls with backoff (up to 15 checks), then shows its timeout state. Pay later.
2. Top up a wallet with USSD and leave it unpaid for a while. Check /wallet and the top-up status.
3. Pay a tip at /creators/<handle> by bank transfer, and let the 5-minute tip checkout cleanup run before the payment arrives.
4. After each late payment, wait for the webhook or the 5-minute sweep.

**Expect:** Each settles once when paid late: the subscription sweep activates the plan (or the webhook does), the top-up stays pending while Paystack reports 'abandoned' (it is failed only after 24 hours) and completes when paid, and the tip sweep settles a verified late tip after re-checking amount and currency. No duplicate charge is prompted.

**Needs:** Paystack

**Source:** `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/app.ts`

## GAP11-053 · P1 · Kill switch: define and test what switching Paystack off stops

*Surfaces:* admin, android, api, web  ·  *Type:* functional

**Before:** Staging (test keys). An admin with PAYMENT_PROVIDERS permission. A pending payout, a creator balance and an affiliate balance ready.

**Steps:**

1. Admin /payment-providers: read the page note and the Paystack row, then switch Paystack off. The row chip reads 'Disabled' with 'New donation checkouts on this gateway are stopped. Switch it on to accept them again.'
2. Try each rail: web card/MoMo donation; Android donation; iOS Safari donation (web); wallet top-up at /wallet; subscription at /subscription; tip at /creators/<handle>; a wallet donation; approving a payout at /payouts; an automatic payout; a creator withdrawal; an affiliate payout; a beneficiary payout.
3. Record which rails were blocked and which message was shown.

**Expect:** A written decision on the switch's scope, and every rail behaves as decided. The page note states the current scope: 'The Paystack and Flutterwave switches stop new donation checkouts on that gateway… They do not yet affect wallet top-ups, subscriptions, creator tips or payouts.' New donation intents are refused ('paystack payments are currently switched off'). Known open issue I047: top-ups, subscriptions, tips and all transfers ignore the switch and it fails open on a database error, so it does not stop money moving in an incident (use GAP11-056).

**Needs:** Paystack test

**Source:** `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`

## GAP11-054 · P1 · Kill switch: turning Paystack back on from the admin console

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Paystack switched off (GAP11-053).

**Steps:**

1. At admin /payment-providers switch Paystack back on.
2. Confirm the chip reads 'Enabled' and the row says 'Turning this off stops every new donation checkout on this gateway.'
3. Start a donation on web and Android.
4. Check a method row (mobile money, card, bank): it cannot be switched and says 'Offered through the gateway checkout; it has no integration of its own to switch on.'
5. Sign in as a staff user with view-only PAYMENT_PROVIDERS access.

**Expect:** Staff can turn the gateway back on from the console without the API, and donations work again at once. Method rows stay informational. A view-only role sees 'Your role has view-only access.' and cannot toggle.

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

## GAP12-058 · P1 · Uploads: the signed direct-upload route is gone

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging with its own Cloudinary cloud. A signed-in user with current legal acceptance.

**Steps:**

1. POST /api/v1/uploads/sign {"folder":"campaigns"} signed in, and logged out.
2. Search the web, admin and mobile bundles for 'uploads/sign'.
3. Upload a campaign image through POST /api/v1/uploads/image?folder=campaigns and open the returned URL.

**Expect:** /uploads/sign returns 404 for everyone and no client references it; no signature is ever issued, so files cannot bypass the API's type and size checks. /uploads/image is the only upload path and works.

**Needs:** Cloudinary (staging cloud)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/app.ts`

## GAP12-059 · P1 · Uploads: no unsigned upload preset in the web bundle or the cloud

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Access to the Cloudinary console (production cloud dvoqbonr2) and the deployed web bundle.

**Steps:**

1. Search the production web JS bundles for 'upload_preset', 'ujimora' preset names and VITE_CLOUDINARY.
2. In the Cloudinary console > Settings > Upload, check whether a preset named 'ujimora' exists and whether it is unsigned.
3. Only if it exists and the owner approves: logged out, POST a 1 KB PNG with upload_preset=ujimora to https://api.cloudinary.com/v1_1/dvoqbonr2/auto/upload, then delete the test asset and the preset.
4. Confirm campaign cover, profile photo and KYC uploads still work (they use the /uploads/image proxy).

**Expect:** apps/web/.env.production no longer sets VITE_CLOUDINARY_*, so no preset name ships in the bundle. Anonymous upload is impossible once the preset is removed. Known open issue I033: checking and deleting the unsigned preset in the Cloudinary console is an owner step.

**Needs:** Cloudinary

**Source:** `apps/web/.env.production`, `packages/ui/src/components/ImageUpload.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`

## GAP12-060 · P1 · Uploads: auth, agreement, type, folder and size gates on /uploads/image

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Staging accounts: logged out, a user without current acceptance, a content-restricted user and a normal user. Files of 3.9 MB and 4.5 MB (image), 6 MB, a PDF and an HTML file.

**Steps:**

1. Logged out: POST /uploads/image. Expect 401.
2. Without current acceptance: POST /uploads/image?folder=campaigns (expect 428), then ?folder=kyc.
3. Content-restricted user: POST ?folder=campaigns. Expect 403.
4. Normal user: POST a 3.9 MB JPEG to ?folder=campaigns (200), a 4.5 MB JPEG (413), a 6 MB file (413), text/html (415), a PDF to ?folder=campaigns (415) and to ?folder=kyc (200 with a kyc:// URL), and ?folder=unknown (400).
5. POST malformed JSON to any JSON route.

**Expect:** Every gate holds. The KYC folder skips the agreement gate so verification can still be completed. Messages: 4.5 MB 'File is too large (max 4MB).'; 6 MB 'File or request is too large.'; HTML 'Only image or PDF files are allowed.'; PDF outside KYC 'PDF files are only accepted for verification documents.'; unknown folder 'Unknown upload folder.'. Malformed JSON gets 400, never 500.

**Needs:** Cloudinary (staging)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`

## GAP12-061 · P1 · Uploads: Cloudinary cloud shared between development and production

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Access to the Cloudinary console.

**Steps:**

1. Confirm render.yaml CLOUDINARY_CLOUD_NAME=dvoqbonr2 and whether development uses the same cloud.
2. Browse the media library for development or test assets and for unexpected video, raw or HTML files uploaded earlier through the removed /uploads/sign route.
3. Create a separate staging cloud, then confirm staging KYC and campaign uploads never land in the production cloud.
4. Turn on Cloudinary restrictions (allowed formats, strict transformations, restricted media types) for production.
5. Check new profile, creator and campaign images: the API now accepts only https://res.cloudinary.com/<configured cloud>/image/upload/... URLs for these fields.

**Expect:** Production media is isolated, development and test assets are cleaned up, and file-type restrictions are enforced at the cloud as well. Known open issue I033: a separate dev cloud, rotating the production secret and inventorying legacy public KYC assets are owner steps not done in code.

**Needs:** Cloudinary

**Source:** `render.yaml`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`

## GAP2-001 · P1 · iOS Safari handoff: a gift is linked to the donor only if they signed in on the website first

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** TestFlight build signed in as donor A (a.qa@ test email); Safari has never signed in to app.ujimora.com (clear website data); staging with Paystack test keys; active approved GHS campaign C with a slug. Android internal build signed in as donor B. Admin with DONATIONS access.

**Steps:**

1. On iOS open campaign C and tap Donate. Confirm the 'Support this campaign' screen says 'Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.' and 'Returning to the app does not confirm payment. Check the payment status on the website before trying again.'
2. Tap 'Continue in browser' and confirm Safari opens https://app.ujimora.com/c/<slug>/donate with no session: the header shows Sign in and there is no coupon field.
3. Enter 20 GHS and A's email, pay with a Paystack test card, and wait for /donate/callback to show success.
4. Switch back to the app. Open My Donations (app/my-donations) and pull to refresh.
5. On desktop, sign in to the web as A and open /donations and /profile.
6. As admin, search admin /payments by 'Donor email (exact)' = A's email and open 'View timeline'.
7. On Android as B, donate 20 GHS from the in-app Donate flow (app/donate/[id]) and check B's My Donations.
8. Back on iOS, first sign in to app.ujimora.com in Safari as A, then repeat steps 1-4.

**Expect:** The first iOS gift settles (campaign raised +20.00 GHS) but is stored as a guest gift. It is missing from A's app and web My Donations and profile totals, as the handoff screen now warns. The admin payment search finds it by donor email. B's Android gift is linked to B and appears in B's history. After signing in to Safari first, A's gift is linked and appears. Support has a written script for 'my donation is missing from my history'.

**Needs:** Paystack test keys; TestFlight and Play internal builds

**Source:** `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/donate/[id].tsx`, `apps/web/src/lib/fundraising.ts`, `apps/admin/src/pages/PaymentsPage.tsx`, `apps/api/src/application/use-cases/ListMyDonationsUseCase.ts`

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

## GAP2-003 · P1 · Former guest cannot self-serve a refund for the guest gift; the not-found screen returns to /donations

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** The account from GAP2-002 and the id of its guest donation (from admin /donations or /payments).

**Steps:**

1. Signed in as g.qa@, open https://app.ujimora.com/donations/refund/<guestDonationId>. Watch the page while it loads.
2. Click the back action on the not-found card.
3. Send POST /api/v1/refunds with {donationId:'<guestDonationId>', reason:'Changed my mind'} using the user's token.
4. Open /refunds and the Refund Policy (web /refund-policy and the app's refund-policy screen). Find the guidance for guest payments.
5. Sign out and open /donations/refund/<guestDonationId>.

**Expect:** A loading state shows while the donation is fetched, then 'This donation was not found or is not eligible for a refund.' The back action goes to /donations. The API returns 404 'Donation not found', the same as for any unowned id. The Refund Policy tells guests to contact support for guest payments, optional platform tips or payments not listed in the account, on web and app. A signed-out visitor is sent to login.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/RefundRequestPage.tsx`, `apps/web/src/router.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `packages/types/src/legal.ts`

## GAP2-005 · P1 · Receipts a guest donor actually gets, checked against the UI copy

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** Record whether customer receipts are on in the Paystack dashboard. Resend configured. Guest email inbox and a registered donor with 'Donations you make' alerts on.

**Steps:**

1. As a guest, donate 25 GHS plus a 2 GHS optional platform tip on /c/<slug>/donate.
2. Check the inbox for mail from no-reply@ujimora.com and from Paystack. Record the merchant name, the amount (including tip) and the reference.
3. On the /donate/callback success screen, record what is shown (amount, tip, reference, campaign) and whether there is any receipt, print or download option.
4. Open /donate/callback with no query string in a new tab. Read the message.
5. As the registered donor, make the same donation and read the 'Your donation is confirmed' alert.

**Expect:** Ujimora sends guests no donation email; only Paystack's receipt arrives, and only if enabled. The missing-reference screen reads 'We couldn't find a payment reference to confirm. If money left your account, don't pay again. Keep any receipt from Paystack or your bank or mobile money provider, and email support@ujimora.com with the reference so we can check it.', with no promise of an emailed receipt. The registered donor's alert says 'Your donation of GHS 25.00 to “<title>” is confirmed. Total charged: GHS 27.00, including a GHS 2.00 optional platform tip. This payment confirmation is not a charitable tax certificate.' Either enable Paystack receipts and check the amount includes the tip, or accept that guests get none. The reference is visible on the callback page so the guest can quote it to support. Known open issue I051: no receipts by default (product decision).

**Needs:** Paystack dashboard access; email inbox

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## GAP2-007 · P1 · KYC approve, reject and request-info: what the applicant is told and where

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** Three users with verified email and every activity-alert category enabled (in-app and email). Admin with VERIFICATIONS permission. Resend configured. Web plus the iOS and Android builds.

**Steps:**

1. Users 1 and 2 submit identity KYC on web /kyc; user 3 submits from the mobile Verification screen.
2. In admin /kyc-review, approve user 1, reject user 2 with reason 'Photo unreadable', and request information from user 3 with a prompt of at least 20 characters.
3. Within 5 minutes, check each user's inbox, the web dashboard notifications panel and the mobile notification bell. Tap each notice.
4. Open web /kyc and the mobile Verification screen for each user.
5. User 3 answers the request with a new document from the private uploader. The admin sees it back in pending.
6. Repeat one decision (refresh and resubmit) and count the notices.

**Expect:** Each decision creates one in-app notice, and no email or push is sent. User 1: 'Your identity verification is approved' / 'Our review team approved your identity verification.' User 2: 'Your identity verification was not approved' with 'Reason: Photo unreadable' and 'You can review the details and submit again from your verification page.' User 3: 'More information needed for your verification'. Each opens /kyc. A retried decision does not add a second notice. /kyc and Verification show the same state as before (Verified, rejection reason, prompt with response form). The product owner decides whether a decision email is also required.

**Needs:** Resend; Cloudinary (private KYC uploads)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycInformationRoutes.ts`, `apps/web/src/components/KYCInformationRequests.tsx`, `apps/mobile/app/verification.tsx`

## GAP2-008 · P1 · Campaign approve, reject, block and reopen: what the organizer sees

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** Organizer O with current KYC and alerts enabled. Two admins (you cannot review your own campaign). REVIEW_ALERT_EMAIL set. Goals above the auto-approve tier so each campaign is held.

**Steps:**

1. O submits campaigns X and Y on web /campaigns/new and Z from the mobile Create tab.
2. Check the REVIEW_ALERT_EMAIL inbox for 'Campaign awaiting review — <title>' for each.
3. In the admin campaign detail (CampaignReviewPanel), approve X. Reject Y with a reason. Approve Z, then 'Block campaign' with a reason, then 'Return to review'.
4. After each decision, check O's inbox, the web dashboard notifications and the mobile bell.
5. Check the status chips and tabs on web /my-campaigns ('Pending review', 'Active', 'Blocked') and the badges on mobile my-campaigns. Look for the staff reason anywhere. Call GET /api/v1/campaigns/<Y>/reviews as O.
6. Open public /c/<slug> for Y and for Z while blocked.

**Expect:** Staff get an email at submission. O gets one in-app notice per decision and no email: X 'Your campaign is live' ('“X” passed review and is now public.'); Y 'Your campaign was not approved' ('… did not pass review and is not public. For details or to ask for another review, contact support@ujimora.com.'); Z 'Your campaign has been blocked' ('… removed from public view after a review. For details or to appeal, contact support@ujimora.com.') and 'Your campaign is back in review'. Staff reasons are never shown to O (the reviews endpoint returns 403 to non-admins). Rejected Y shows as 'Blocked', because reject sets BLOCKED. While blocked, the public page returns not found.

**Needs:** Resend; REVIEW_ALERT_EMAIL

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/mobile/app/my-campaigns.tsx`, `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`

## GAP2-011-2 · P1 · How invitees discover collaboration and organization-team invitations

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** Campaign owner O on a plan with collaboration. Invitee I1 with an account. Organization account ORG. Invitee I2 with no account. Invitee I3 with an account but an unverified email.

**Steps:**

1. O invites I1 as a collaborator on a campaign. Then O invites an email that has no account.
2. Check I1's inbox, the dashboard notifications and the mobile bell; tap the notice. Open web /invitations and the mobile Invitations screen.
3. ORG invites I3 and I2 by email at /organization-team.
4. Check I3's notifications and inbox. On mobile Invitations, I3 sees the organization invitation and presses Accept before verifying the email.
5. I2 registers with the invited email, verifies it and opens /organization-team.
6. In staging, let an invitation pass its expiresAt and try to accept it.

**Expect:** I1 gets an in-app notice 'Campaign invitation': 'You were invited to be listed as a collaborator on "<title>". Review it in Invitations.' linking to /invitations; no email. Inviting an unknown email returns the same success to O and creates no invitation. I3 gets 'Organization invitation': '<Org> invited you to its team as <role>. Accept it in Organization workspace & team within seven days.' The native Invitations screen lists it with Accept; accepting before verifying returns 'Verify your email before accepting an organization invitation'. I2, who had no account when invited, gets no notice and cannot learn of the invite unless told outside Ujimora. The expired invitation disappears and accepting it returns 'Invitation unavailable or expired'. Known open issue I181: no invitation emails.

**Needs:** Resend (to confirm that nothing is sent)

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/CollaborationInvitationsPage.tsx`, `apps/web/src/pages/OrganizationTeamPage.tsx`, `apps/mobile/app/invitations.tsx`

## GAP2-012-2 · P1 · Outcomes for reporters and requesters: campaign reports, safety reports, disputes, data-rights requests

*Surfaces:* admin, android, email, ios, web  ·  *Type:* compliance

**Before:** Reporter R. Admin with REPORTS, DISPUTES and USERS permissions. Staging with a signed Paystack dispute webhook available.

**Steps:**

1. R clicks 'Report Campaign' on /campaigns/<id> (reason Fraudulent). Try to report again.
2. Admin reviews it in admin /campaign-reports with a note of at least 20 characters ('Mark reviewed').
3. R reports a comment through the safety report flow. The admin resolves it with 'hide comment' in /safety-reports.
4. Open admin /disputes. Look for a user way to create a dispute. Then send a Paystack charge.dispute.create for a donation on a campaign.
5. R submits a data-rights 'access' request from web Settings (DataRightsRequests) and from mobile Settings. The admin responds in /privacy-requests with account delivery.
6. For each case, check R's email, in-app and mobile notifications, and the relevant screen.

**Expect:** The second campaign report returns 409 'You have already reported this campaign'. After review R gets an in-app notice 'We reviewed your report' ('Thank you for reporting this campaign. Our team has reviewed it and taken the action it considers appropriate.'); the safety report gives a similar acknowledgement, and the comment author is told 'Your comment was removed'. Users still cannot create disputes, but the Paystack event opens a case in /disputes with reporter 'Paystack (payment provider)'. The data-rights response sends the 'Your Ujimora privacy request has a response' email with no content, and the status is in Settings on web and mobile. Check this against the privacy policy's response commitments.

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/admin/src/components/DataRightsQueue.tsx`

## GAP2-013-2 · P1 · Timed tabletop exercise: contain a fraudulent organizer's money in every pot

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Staging organizer F with: current approved identity KYC; verified email; campaign CF active with at least 1,000 GHS available and a PENDING cashout request; a reviewed Paystack recipient; a paid plan with a creator balance of at least 200 GHS; a Ujimora wallet of at least 100 GHS; an affiliate with available commission and a PENDING affiliate payout (AFFILIATE_HOLD_DAYS=0). Automatic payouts ON in admin Settings. Two admins, a stopwatch and a scribe.

**Steps:**

1. At T0 a donor uses 'Report Campaign' on CF (Fraudulent) and emails support.
2. Record how staff learn of the report: admin /campaign-reports and the action-centre count of pending campaign reports.
3. For each pot, use the available lever and record the time and resulting audit entry: campaign ('Block campaign'); pending campaign payout ('Reject payout' with a reason); automatic payouts (Settings, turn off); affiliate (Affiliates, suspend, then reject the pending affiliate payout with a reason of at least 20 characters); account publishing ('Restrict user' from /safety-reports > Restricted users, notes of at least 20 characters); account closure (member detail > 'Account closure' > 'Close account'); creator balance; Ujimora wallet; sessions.
4. Meanwhile F tries a creator withdrawal, a campaign payout, an affiliate payout request and a wallet donation to another campaign (see GAP2-014-2 to GAP2-017).
5. Open admin /audit and confirm each staff action is logged with actor, reason and time.
6. Compare the results with the FAQ answer 'What happens if a campaign is fraudulent?'.

**Expect:** A timed runbook is produced. From source: reports reach a staff queue; blocking is instant and stops new gifts, the public page and live streams, and also refuses new campaign payout requests and approvals (409 'This campaign is under review; payouts are paused'); the pending request can be rejected so its money returns to pending; automatic payouts can be switched off globally; a suspended affiliate's payout request gets 403 'Your affiliate account is suspended, so payouts are unavailable.'; restriction stops publishing. Account closure is refused while F has balances or payouts in progress. Remaining gaps with no lever: freezing the creator balance or wallet, and revoking sessions without closing the account. Each gap is signed off or fixed before launch, with an owner.

**Needs:** Paystack test keys (transfers); two admin accounts

**Source:** `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`

## GAP2-016-2 · P1 · A publishing-restricted user can still withdraw their creator balance

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** F has current identity verification, a creator balance of at least 200 GHS and a name-matched saved payout account. A safety report targeting F (targetType user, reason fraud).

**Steps:**

1. In admin /safety-reports, choose 'Restrict user' with notes.
2. Confirm /creators/<F handle> returns not found and a new tip is refused. F can still sign in. Read F's notifications.
3. As F, POST /api/v1/creators/withdraw (bank rail, Idempotency key). Then send a second request to ujimora_wallet.
4. Check the creator payout status, the Paystack transfer, F's wallet balance and /creator.
5. Repeat the bank withdrawal for a restricted creator whose identity verification has expired.

**Expect:** F gets 'Publishing is restricted on your account' ('… Your account settings and funds remain accessible. For details or to appeal, contact support@ujimora.com.'). Both withdrawals go through: the bank transfer starts immediately and the wallet transfer is PAID instantly, because restriction only blocks publishing. With expired verification the bank withdrawal is refused with 409 'Verify your identity, or renew an expired verification, before withdrawing creator funds to a bank or mobile-money account.' (the wallet transfer is not gated). The FAQ no longer promises frozen funds. Decide before launch whether a payout hold on restriction is needed.

**Needs:** Paystack test keys (transfers)

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/database/siteContentDefaults.json`

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
2. Before blocking, staff decide what happens to the remaining balance and the pending request (approve it, or reject it with a reason).
3. The admin blocks CC with reason 'Closed at organizer request'.
4. Check /c/<slug>, /campaigns/<id>, explore, the organization profile, /leaderboard (all periods), the live watch page, /r/<code> and /qr/<code>.png, the organizer's /my-campaigns chip and notifications, and the mobile views.
5. The organizer creates a new campaign (is the slot freed?).
6. The organizer requests a payout of the remaining balance, and an admin tries to approve the earlier pending request.

**Expect:** The public page, explore and live stream stop at once, and the live session is ended. QR codes and short links still redirect but land on 'not found'. Donors' gifts drop out of leaderboard totals, because blocked campaigns are excluded; confirm that is acceptable. The organizer sees a red 'Blocked' chip and the notice 'Your campaign has been blocked' ('… removed from public view after a review. For details or to appeal, contact support@ujimora.com.'), which reads wrongly for a voluntary closure. The slot is freed. While blocked, payout requests and approvals are refused with 409 'This campaign is under review; payouts are paused', so the runbook must pay out or reject before blocking, or wait until the end date (an expired campaign can pay out). The audit log records campaign.block with the reason. The product owner decides whether a neutral 'closed' status is needed at launch.

**Needs:** LiveKit credentials (live session); Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`

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
3. In DevTools, look for an EventSource to https://api.ujimora.com/api/v1/campaigns/<id>/events (the build now calls the API origin directly). Leave the page open 10 minutes and watch for disconnects and reconnect backoff.

**Expect:** A decision is recorded. If realtime is ON: totals update within seconds and the stream survives or reconnects cleanly, with no console error storm; the public campaign 'total' event carries no live-session amount. If it is intentionally OFF (it is missing from apps/web/.env.production): the pages fall back to polling and the product copy must not promise instant live totals.

**Needs:** Vercel dashboard; Paystack test keys

**Source:** `apps/web/.env.production`, `apps/web/src/hooks/useSSE.ts`, `apps/web/src/hooks/useLiveTotals.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`

## GAP2-032 · P1 · /sitemap.xml on app.ujimora.com returns the API sitemap

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Production or preview web deployment.

**Steps:**

1. curl -sI https://app.ujimora.com/sitemap.xml and record the status and content-type.
2. curl -s https://app.ujimora.com/sitemap.xml | head.
3. Compare with https://api.ujimora.com/sitemap.xml.
4. Check that ended campaigns and hidden or restricted creator handles are absent.
5. Submit it in Google Search Console, then fetch robots.txt.

**Expect:** The app host returns 200 XML (application/xml) through the new rewrite placed before the SPA catch-all, listing app.ujimora.com URLs and matching the API response. Only open campaigns and visible creators are listed, and blog lastmod reflects the published content date. The response carries no noindex X-Robots-Tag header.

**Needs:** Vercel; Google Search Console

**Source:** `apps/web/vercel.json`, `apps/web/public/robots.txt`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`

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

## GAP2-034 · P1 · Uploads near the 4 MB limit on web and mobile

*Surfaces:* admin, android, ios, web  ·  *Type:* negative/edge

**Before:** JPEG and PDF files of 3.9, 4.4, 4.9 and 5.5 MB. Cloudinary configured.

**Steps:**

1. On app.ujimora.com, upload each file for KYC (/kyc) and as a campaign image (/campaigns/new). Record the network target, status and message.
2. Repeat on mobile.
3. By API, POST the 4.4 MB and 5.5 MB files to /api/v1/uploads/image?folder=campaigns.
4. The admin opens the uploaded KYC documents (60-second private links).

**Expect:** Web uploads go straight to https://api.ujimora.com (not through the Vercel rewrite). Files up to 4 MB succeed on web and mobile. Larger files get a clear message, never an HTML 413 or a hang: the clients refuse them before sending, and the API answers 413 'File is too large (max 4MB).' up to 5 MB and 413 'File or request is too large.' above it. Server and client limits now agree at 4 MB.

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`, `apps/web/src/lib/uploadImage.ts`, `packages/ui/src/components/ImageUpload.tsx`, `apps/web/.env.production`

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

**Before:** Staging snapshot. The runner is the npm script backfill:contribution-money in apps/api.

**Steps:**

1. Count intents with no originalAmountMinor.
2. Check the admin /payments timeline and try a refund on one legacy intent BEFORE the backfill.
3. Run: cd apps/api && MONGODB_URI=<staging uri> npm run backfill:contribution-money. Run it again.
4. Spot-check 20 records: originalAmountMinor = round((amount + tip) x 100), fxRate 1, fxSource 'legacy-backfill'.
5. Run audit-donation-settlement.ts and repeat the timeline and refund checks.

**Expect:** The first run logs 'Backfilled minor-unit money on N legacy donation intents' and the second logs 0. Values are exact. Refunds and admin views work on legacy intents. The runbook is added to the docs.

**Needs:** Staging snapshot

**Source:** `apps/api/src/infrastructure/database/backfillContributionMoney.ts`, `apps/api/package.json`, `apps/api/scripts/audit-donation-settlement.ts`

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

## GAP2-043 · P1 · An abandoned tip no longer blocks the supporter's next tip in the same browser

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** A creator with a paid plan and tips enabled. A guest browser.

**Steps:**

1. As a guest on /creators/<handle>, tip 10 GHS and abandon the Paystack page.
2. Return and tip 20 GHS.
3. Click 'Check the earlier payment', go back, then click 'Start a new payment'.
4. Pay a tip, return, and try another tip with a different amount.
5. Decline a card on one checkout (so Paystack reports failed), return and tip a different amount.

**Expect:** After the abandoned checkout, a changed amount no longer dead-ends. The page checks the earlier payment and shows 'You have an unfinished payment for this creator. Check it before starting a new one, so you are not charged twice.' with 'Check the earlier payment' and 'Start a new payment', which opens a fresh checkout. After a successful tip it shows 'Your previous tip to this creator went through. Send another one only if you mean to tip again.' with 'Send another tip'. After a failed checkout the new tip starts automatically with a fresh key. No duplicate charge is possible without the supporter choosing it.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/tipCheckout.ts`, `apps/web/src/pages/CreatorTipPage.tsx`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`

## GAP2-044 · P1 · Affiliate commissions mature on schedule without the affiliate visiting

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Staging with the reconciliation scheduler on and AFFILIATE_HOLD_DAYS=1 (or maturesAt moved back). Affiliate AF with a held commission past maturity. AF does not open /affiliate.

**Steps:**

1. Check held and available amounts in admin /affiliates, /affiliates/<id> and the affiliate payouts queue.
2. Wait one 5-minute reconciliation tick and refresh the admin pages.
3. AF opens /affiliate, sets a payout destination and requests a payout.
4. Seed 5,000 held commissions across affiliates and time the /affiliate dashboard load and the tick.

**Expect:** The batch maturity runs in the reconciliation tick, so admin views move held to available within about 5 minutes without AF visiting. A payout request matures AF's own commissions first, must withdraw the full withdrawable balance, and links the commissions it pays. The dashboard only matures AF's own commissions, so its latency does not grow with other affiliates' volume.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/MatureAffiliateCommissionsUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionMaturity.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/api/src/app.ts`

## GAP2-045 · P1 · Background timers resume after a Render sleep, restart or deploy

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** An API on the same Render plan as render.yaml (plan: free). Log access.

**Steps:**

1. Leave the API idle for 20 minutes so it sleeps.
2. Trigger traffic (a Paystack test webhook or a page view) and measure the cold start.
3. Within 5 minutes, check that each job ran: outbox (60 s), activity alerts (30 s), reconciliation tick (5 min: top-ups, donations and tips, subscription checkouts, payouts, affiliate maturity, crypto), tip cleanup (5 min), campaign expiry (5 min), live safety including stale-session end (30 s), account erasure (60 s), store billing (60 s).
4. Deploy or restart, and check the boot sweep log lines (outbox, tip cleanup, erasure, live safety, activity, store billing).
5. Leave an abandoned PENDING donation intent and confirm it is reconciled after the wake-up.

**Expect:** Every job resumes after wake-up and after a restart. Render's health check uses /health/ready. Work that needs the API to stay up has a fallback: a paid always-on instance, or an external cron hitting POST /api/v1/admin/reconciliation and POST /api/v1/admin/reconciliation/topups. Known open issue I003: render.yaml is still on plan: free (documented in DEPLOYMENT.md); the plan decision is logged.

**Needs:** Render dashboard; Paystack test keys

**Source:** `apps/api/src/app.ts`, `apps/api/src/main.ts`, `render.yaml`, `DEPLOYMENT.md`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## GAP2-046 · P1 · /health/ready reports unavailable while MongoDB is unreachable

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** A staging API with the ability to block its database connection (Atlas IP access list).

**Steps:**

1. While healthy, curl /health and /health/ready.
2. Block MongoDB access.
3. curl /health, /health/ready (several at once) and /api/v1/campaigns.
4. Watch what the Render health check (healthCheckPath /health/ready) and the uptime monitor do. Restore access.

**Expect:** Healthy: both return 200 {status:'ok'}. Blocked: /health still returns 200 (liveness, used by CI), while /health/ready returns 503 {status:'unavailable'} within about 2 seconds, with Cache-Control no-store and no internals; concurrent checks share one ping and are not rate-limited. Render stops routing to or restarts the instance, and the uptime monitor on /health/ready alerts. After restore, /health/ready returns 200.

**Needs:** MongoDB Atlas access; uptime monitor

**Source:** `apps/api/src/app.ts`, `render.yaml`, `DEPLOYMENT.md`

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

**Before:** A's intents: one PENDING, one SUCCEEDED, and one freshly CREATED.

**Steps:**

1. With no token: GET /api/v1/donation-intents/<id>/public. Inspect the body for email, name or phone.
2. POST /donation-intents/<id>/verify with {reference:'wrong'}.
3. POST /donation-intents/<id>/payment-attempts with {provider:'paystack', status:'initiated', providerRef:'attacker-ref'} against each state.
4. Send 61 fast POST requests to one of these routes from one client to trigger the rate limiter.
5. Check each intent's status and providerRef in the DB.

**Expect:** The public view contains no donor personal data. A wrong reference returns 404. The payment-attempts route no longer exists (404), so nobody can overwrite providerRef on any intent; attempts are recorded only server-side. The limiter returns 429 'Too many requests, please try again later' with Retry-After, keyed to this client only.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`, `apps/api/src/application/use-cases/VerifyDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## GAP2-052 · P1 · Register and refund live-mode smoke-test money after production QA

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** A written register filled in DURING live smoke tests (for example DONATE-078, WALLET-016, payout tests): accounts, campaigns, intent ids, Paystack references, payouts, top-ups, coupons, plans, affiliates, short links, Paystack recipients, KYC documents. An admin with DONATIONS update access.

**Steps:**

1. After the smoke tests, refund every live donation from admin /payments ('View timeline', then 'Refund payment'), or by API with an Idempotency-Key.
2. Confirm each refund in the Paystack live dashboard and check the compensating journal entries. Finish any warning in /refund-recovery.
3. Record payouts to the team's own accounts as test expenses, with evidence.
4. Reconcile platform revenue and fees against the register.

**Expect:** Every live-money artifact is accounted for. The ledger balances (append-only; corrections are compensating entries, never deletions). Refunds complete. Finance signs off the adjustments.

**Needs:** Paystack LIVE keys

**Source:** `apps/admin/src/pages/PaymentsPage.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/api/src/infrastructure/database/models/JournalEntryModel.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## GAP2-053 · P1 · Remove QA campaigns and accounts from public pages, leaderboards and analytics

*Surfaces:* admin, android, ios, marketing, web  ·  *Type:* functional

**Before:** Live QA campaigns and accounts from GAP2-052, with all balances paid out or refunded.

**Steps:**

1. Block each QA campaign with reason 'QA test data'.
2. Delete each QA account (web Settings > Delete account; app delete-account screen). Enter the current password (and the authenticator or recovery code if MFA is on).
3. Try to delete a QA account that still has a wallet, campaign, creator or affiliate balance, or a payout in progress.
4. Check explore, organizations, /leaderboard (all periods and categories), homepage and marketing stats, admin Overview and Reports totals, and affiliate referral stats.

**Expect:** QA campaigns disappear from public pages. Deletion needs the password (and code); a wrong one is refused without signing the user out. An account with money left is refused with 409 'Your account can’t be closed yet. First withdraw or resolve: … If you can’t, contact support@ujimora.com and we’ll help you close your account.', and the web and app deletion screens show the reason with no delete action. Deleted accounts' donations are anonymized and leave the leaderboard, and their open campaigns are ended. Guest QA gifts to campaigns that stay public remain in 'All' totals. Admin analytics still include the QA money, because no model has a test flag; record manual adjustments.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## GAP2-055 · P1 · Subscription checkout disclosure matches the Billing Terms

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** Paid plans configured. Paystack test keys. An accountant available.

**Steps:**

1. On web /subscription, pick a paid plan (monthly, then yearly) and open the checkout summary. Record the base price, coupon and final amount lines and the plan-length line.
2. Continue to Paystack. Compare the charged amount, the Paystack receipt and the SubscriptionCallbackPage amount.
3. Read Billing Terms clauses 2-4 on /billing-terms.

**Expect:** Checkout says 'One-time payment for 30 days (1 year). Your plan does not renew automatically.', and the Billing Terms now describe the charged period, say web plans do not renew (nothing to cancel) and no longer claim checkout discloses taxes. Checkout, Paystack and the callback amounts are identical. The accountant records whether VAT, NHIL, GETFund or the COVID-19 levy apply; if tax applies, checkout and receipts must show it. Known open issue I021: the tax gate (READINESS C21) is still external, and the terms change needs legal sign-off.

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

1. Refund the Paystack USD intent from admin /payments or POST /api/v1/admin/payments/<intent>/refund, full and partial, each with an Idempotency-Key.
2. POST /api/v1/admin/payments/<flutterwave intent>/refund.
3. Check the journal, the campaign GHS balance, admin /refund-recovery and the provider dashboards.

**Expect:** The Paystack refund is in the original currency, or it is refused with 409 'Refunds involving currency conversion require manual reconciliation' when the settlement currency differs; either outcome is recorded. The ledger compensation reverses the amount originally credited, with no re-conversion at a new rate. The Flutterwave refund returns 501 'Refunds for flutterwave must be issued in the provider dashboard' before anything is claimed or held: no refund operation, no funds hold and nothing reversed locally. The runbook is: refund in the Flutterwave dashboard, then record the compensation. Decide whether Flutterwave can launch without refunds.

**Needs:** Paystack and Flutterwave sandbox keys

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/FlutterwaveGateway.ts`, `docs/payments/DIASPORA_PAYMENTS_PLAN.md`

## GAP3-001 · P1 · Coupon with a pending subscription checkout cannot be deleted; commission uses the base elected at checkout

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with Paystack test keys and a reachable webhook. Affiliate A with a referral code. User U registered via app.ujimora.com/register?ref=<A's code>. Admin with COUPONS delete permission. Coupon SAVE50 created at admin /coupons: Percent 50, 'Where it can be used' = Subscription, 'Affiliate commission on a discounted sale' = 'Full list price', never redeemed. DB read access to CouponRedemption and commission rows.

**Steps:**

1. As U, open app.ujimora.com/subscription, choose a paid plan (list price P), enter SAVE50 and confirm the preview shows 50% off. Continue to the Paystack test checkout and stop on the payment page.
2. As admin, open admin /coupons, click the Delete icon on SAVE50. Read the dialog 'Delete or deactivate SAVE50?' and click Delete.
3. Click Deactivate instead. Confirm the snackbar 'Coupon deactivated'.
4. Back in U's tab, pay with a Paystack success test card.
5. After the webhook, reload /subscription. Inspect U's CouponRedemption row, the checkout's commissionBase, the commission row for sourceRef sub-..., A's /affiliate earnings, and the logs.
6. As another user, try to apply SAVE50.

**Expect:** Delete is refused with 409 'This coupon has been used — deactivate it instead.' (shown in the snackbar), because a redemption slot is held by U's checkout. Deactivating keeps the coupon and its limits. U is charged exactly P x 0.5 and the plan activates. The redemption becomes CONSUMED. The commission is computed on the full list price P, using the base snapshotted on the checkout. New checkouts can no longer apply SAVE50. The webhook is acknowledged with 200.

**Needs:** Paystack test keys + webhook tunnel; affiliate program enabled

**Source:** `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.ts`, `apps/admin/src/pages/CouponsPage.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`

## GAP3-002 · P1 · Coupon edited (amount, commission base, cap, active flag) while checkouts using it are in flight

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Coupon EDIT30 (Percent 30, Subscription surface, 'Full list price', Max Redemptions 1). Users U1 and U2, both referred by affiliate A. Paystack test keys.

**Steps:**

1. U1 applies EDIT30 at app.ujimora.com/subscription and stops on the Paystack page.
2. Admin opens EDIT30 at admin /coupons, changes Amount 30 -> 10 and the commission base to 'Amount actually charged', and clicks Update.
3. U2 applies EDIT30 on /subscription. Confirm the preview result and stop on the Paystack page if a checkout opens.
4. Admin switches EDIT30 to inactive (Active off) and clicks Update.
5. U1 (and U2 if a checkout opened) complete payment. A third user U3 tries to apply EDIT30.
6. Check the charged amounts in Paystack, the subscriptions, the Redemptions column, the redemption and commission rows, the checkouts' commissionBase, and the API logs.

**Expect:** U1 pays the 30%-off price quoted at checkout creation. With Max Redemptions 1 and U1 holding the only seat, U2 is refused ('You have already used this coupon the maximum number of times' or an invalid-coupon message) and no checkout opens. The Redemptions counter never exceeds 1. U1's commission uses the base snapshotted when U1's checkout was created (full list price), not the later edit. U3's preview is rejected with a clear 'invalid/inactive coupon' message. Nobody is charged a price different from the one they saw.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/couponRoutes.ts`

## GAP3-003 · P1 · Donation fee-waiver coupon cannot be deleted while an intent holds its seat; deactivation mid-checkout still settles at the waived fee

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Coupon FEEFREE with 'Where it can be used' = Donation (full fee waiver), Per-User Limit 1, never redeemed. Active campaign C whose creator's plan fee % is known. Donor D signed in on web. Paystack test keys. DB read access to journal lines.

**Steps:**

1. D opens app.ujimora.com/c/<C slug>/donate, enters GHS 100, types FEEFREE in 'Fee waiver code (optional)', confirms the breakdown shows the platform fee waived, continues to Paystack and stops on the payment page.
2. Admin tries to delete FEEFREE at admin /coupons, then deactivates it.
3. D pays with a success test card.
4. After the webhook, check: D's /donations entry, C's raised and available amounts, the admin /donations row, the journal lines for the intent (platform fee line), the CouponRedemption row whose providerRef = intent id, and the API logs.

**Expect:** Delete is refused with 409 'This coupon has been used — deactivate it instead.' The intent is SUCCEEDED and exactly one Donation row exists. The campaign net is credited with the fee waived as locked at intent creation (platform fee 0). The journal balances (debits = credits in minor units). The redemption row is CONSUMED. There is no 409/5xx on the webhook, and realtime, receipt and activity behave as for any donation.

**Needs:** Paystack test keys + webhook

**Source:** `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/donationCouponSeats.ts`, `apps/web/src/pages/DonatePage.tsx`

## GAP3-016 · P1 · Automatic payout claimed just before 00:00 UTC and verified after it is still paid automatically, never double-counted

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** 'Enable automatic payouts' on in admin Settings: 'Daily limit per owner (GHS)' 1000, 'Daily platform limit (GHS)' 5000. Organizer O is KYC-verified, with a destination that has a previous manually approved PAID payout and a recent review. Campaign available balance >= GHS 600. Paystack test transfers. DB read access to AutomaticPayoutBudget and Payout.

**Steps:**

1. At about 23:59:55 UTC, O requests a GHS 200 standard cashout from the campaign cashout panel.
2. Watch the payout status and automationReason at admin /payouts and on O's dashboard.
3. Inspect the payout's autoClaimDay and autoClaimedAt and the AutomaticPayoutBudget docs `<D>:owner:<O>`, `<D>:platform` and the `<D+1>` keys.
4. In staging, force a claim to be verified more than 15 minutes after it was taken (pause the process or edit autoClaimedAt) and observe the result.
5. At 00:05 UTC, O requests another GHS 200.

**Expect:** The 23:59:55 claim is verified within its 15-minute window using its own autoClaimDay, so it is paid automatically even though verification ran on day D+1, and the usage is recorded once under the day-D keys. A claim verified more than 15 minutes later goes to manual review with 'Automatic budget claim is unavailable or expired; manual review required.' and its budget is not released. Day D+1 starts fresh and the 00:05 request auto-processes. The campaign available, pending and paid-out balances and the ledger reconcile exactly with the payouts made.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/api/src/infrastructure/database/models/PayoutModel.ts`, `apps/admin/src/components/AutomaticPayoutSettings.tsx`

## GAP3-019-2 · P1 · Web: device clock BEHIND real time by more than the access-token TTL

*Surfaces:* admin, web  ·  *Type:* negative/edge

**Before:** Desktop test machine with automatic time off. A member account and an admin account. Access token TTL is 15 min (AuthTokenService default).

**Steps:**

1. Set the OS clock 30 minutes behind real time.
2. Sign in at app.ujimora.com/login.
3. Use the app continuously for 20 minutes (dashboard, donations, settings), keeping a Settings form half-edited.
4. At minutes 16-20, save Settings.
5. In devtools, watch for /auth/refresh calls and any 401 responses.
6. Repeat on admin.ujimora.com (the same browserSession library), including an upload.
7. Repeat with the clock only 2 minutes behind, and once with the network cut during a refresh.

**Expect:** The session survives. Token expiry is measured from when the device received the token, so refresh happens before the server-side expiry whatever the clock says; if a request still gets 401, the client refreshes once (single-flight) and retries. There is no 'Your session has expired' at about 15 minutes and the half-edited form is kept. A refresh that fails on the network surfaces as a connection error, not a sign-out. A 2-minute skew causes no issue.

**Needs:** none

**Source:** `packages/ui/src/browserSession.ts`, `apps/web/src/lib/api.ts`, `apps/admin/src/lib/api.ts`, `apps/api/src/application/services/AuthTokenService.ts`

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

**Before:** Creator on a paid plan with current identity verification and a tip balance >= GHS 50. Paystack account resolution available: test mode returns canned names, so use real bank or MoMo test numbers on a staging key permitted to resolve. Bank-registered names known for each account.

**Steps:**

1. At app.ujimora.com/payout-accounts (and mobile Payout accounts), add accounts where the typed name differs from the registered name: a) 'kwame mensah' vs 'KWAME MENSAH'; b) 'Mensah Kwame' vs 'KWAME MENSAH'; c) 'Kwabená Ɔpoku' vs 'KWABENA OPOKU'; d) 'Ama Owusu' vs 'AMA SERWAA OWUSU'; e) 'Owusu-Ansah' vs 'OWUSU ANSAH'; f) 'Kofi Mensah' vs 'KWAME MENSAH'; g) 'Kwame' vs 'KWAME MENSAH'.
2. Note each card's status label.
3. On /creator, request a GHS 50 creator withdrawal to a matched account and to f).
4. For f), add the same number again with the corrected name 'Kwame Mensah'.

**Expect:** a) to e) show 'Registered name matched' (order, diacritics, Ɔ/ɛ letters, hyphens and a middle name are tolerated when the shorter name has at least two full names). f) and g) show 'Name not matched: creator withdrawals need a matched account'. A withdrawal to f) is refused with 422 'The name the bank or telco holds for this account did not match the account name you entered. Choose an account whose name matched before withdrawing creator funds.' Re-adding the same number with the corrected name resolves the name again and the existing card becomes matched, without removing it first. A Paystack resolution failure never results in a false match.

**Needs:** Paystack account resolution

**Source:** `apps/api/src/domain/services/payoutNameMatch.ts`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/web/src/components/account/PayoutAccountCard.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`

## GAP3-029 · P1 · Staff email-change runbook: identity check, change, re-verification and token invalidation

*Surfaces:* admin, api, email, web  ·  *Type:* security/permission

**Before:** The GAP3-028 correction request is open. A written staff runbook; if none exists in docs/, record a launch gap and use the steps below. Staging DB access. Before the change, U requests a password reset (the email goes to the OLD address, and the link is not yet used). A second account already uses c@example.com.

**Steps:**

1. Staff at admin /privacy-requests set the request to 'in_review' with evidence (at least 20 characters) of identity verification from both addresses.
2. Staff change users.email to the new lowercase address, set emailVerified=false and bump authVersion to revoke existing sessions, all as the runbook specifies.
3. Staff mark the request 'responded' with a response of at least 20 characters and account delivery.
4. U tries to sign in with the old email, then with the new one.
5. U clicks the pending password-reset link sent to the old address.
6. U requests email verification from Settings, receives it at the new address and confirms it.
7. Staff attempt the same procedure for c@example.com.

**Expect:** The old email can no longer sign in, and the new one can. Old sessions are signed out. The old reset link is rejected. Activity emails need re-verification plus opt-in. U gets 'Your Ujimora privacy request has a response' at the new address and reads the response in Settings. The DataRightsEvent audit shows who did what and when. The duplicate address is refused by the unique index, and staff are told. The runbook forbids a change without identity verification (account-takeover risk). Known open issue I083: there is no staff email-change tool, so this runbook relies on a direct database edit.

**Needs:** Resend email provider; staging DB access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `docs/compliance/ACCOUNT_EMAILS.md`

## GAP3-031 · P1 · Delete a saved payout account while a creator withdrawal to it is PROCESSING

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Creator on a paid plan with current identity verification, GHS 100 available in tips and a name-matched saved account. Paystack test transfers, with the ability to deliver transfer.success, transfer.failed and transfer.reversed webhooks manually (signed).

**Steps:**

1. At app.ujimora.com/creator, request a GHS 50 withdrawal to the saved account and confirm the payout is PROCESSING with a recipient code recorded before the transfer.
2. At /payout-accounts, click 'Remove saved account'. In 'Remove saved account?' click Cancel, then repeat and click 'Remove account'.
3. Deliver transfer.success for the cpay- reference.
4. Second run: repeat steps 1-2, then deliver transfer.failed. Third run: deliver transfer.success then transfer.reversed.
5. Replay each webhook twice.
6. After each run, check the creator balance buckets (available, pending, paid out), the payout status at admin /payouts and the creator's history.

**Expect:** Cancel keeps the account. Removal succeeds and shows 'Removed from saved accounts. Existing payout requests keep their original destination.' A success settles to PAID using the payout's own recipientCode snapshot. A failure or reversal returns exactly GHS 50 to available, once, even under replays. There are no 5xx errors. The creator can re-add an account and withdraw again. The balances reconcile to the cent.

**Needs:** Paystack test transfers + signed webhook replay

**Source:** `apps/web/src/components/account/SavedPayoutAccounts.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutAccountRoutes.ts`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/HandleCreatorPayoutWebhookUseCase.ts`

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

1. Check render.yaml, DEPLOYMENT.md and the Render dashboard for the instance count and autoscaling.
2. If a second instance is tested: open a live session with the OBS overlay and two WatchLivePage viewers, and note which instance each SSE connection hit (logs).
3. Make 10 donations through the live link; the webhooks land on either instance.
4. Compare the overlay feed, the live totals, the web and mobile donor feeds, and the DB donations.
5. Send 31 bad logins alternating across the instances.
6. Check which instance runs each timer (outbox, reconciliation, erasure, store billing, live safety).

**Expect:** The requirement: 'single instance only' is enforced in the Render dashboard (scaling pinned to 1), or every donation reaches every overlay. render.yaml and DEPLOYMENT.md now state that the API must run as a single instance. Money and live-session stats stay exactly-once with two instances (DB gates and outbox leases), and the ledger is correct. Known open issue I099: the EventBus and rate limiters are still in-process, so with two instances events reach only clients on the instance that processed the webhook and rate limits effectively double.

**Needs:** Second instance; Paystack test keys; LiveKit (optional)

**Source:** `apps/api/src/infrastructure/realtime/EventBus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `render.yaml`, `DEPLOYMENT.md`

## GAP3-040 · P1 · Deploy overlap: old and new instances run boot sweeps and timers at the same time

*Surfaces:* api, email, web  ·  *Type:* recovery/idempotency

**Before:** Render staging (NODE_ENV=production, reconciliation enabled). Queued work: a donation outbox row still pending (insert one, or kill the process right after settlement), a pending account erasure, a queued store billing notification, a live session with providerStopPending, queued activity alert emails, and a PENDING donation intent older than 30 min. A script that makes one live-attributed donation per second.

**Steps:**

1. Start the donation script against a live session.
2. Trigger a manual deploy on Render while the script runs, so both instances overlap.
3. After the deploy, compare the live session stats (successfulDonations, amountRaised) with the COUNT/SUM of donations carrying that liveSessionId, and check each donation's liveStatsAppliedAt.
4. Watch the overlay for repeated donation alerts.
5. Count the emails received per activity event. Check the erasure completed once, the reconciliation outcome, and that the LiveKit room was closed once.
6. Check the campaign raised amount and the ledger totals.

**Expect:** The live session stats equal the actual attributed donations: each donation's stats are applied once (liveStatsAppliedAt claim in the same transaction as the increment), and outbox rows are claimed with a lease, so an in-process dispatch and a sweep on the other instance cannot both deliver the same row. A replayed row only refreshes totals and shows no second alert; the overlay also ignores a donationId it has already shown. Each email is delivered exactly once. Campaign totals and the ledger are unaffected. There are no unhandled errors.

**Needs:** Render staging; Paystack test keys; Resend; store sandbox

**Source:** `apps/api/src/main.ts`, `apps/api/src/app.ts`, `apps/api/src/application/services/OutboxDispatcher.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/api/src/infrastructure/database/models/OutboxModel.ts`

## GAP3-041 · P1 · Render free plan sleep, cold-start webhooks and SSE resume after restart

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging deployed with render.yaml as committed (plan: free). Paystack test keys. OBS overlay and a WatchLivePage open.

**Steps:**

1. Leave staging idle for 20 minutes with no requests.
2. Check the logs for whether the 5-minute reconciliation and the 60 s erasure, store billing and outbox timers ran while idle.
3. Make a Paystack test payment so the first webhook hits a sleeping service. Measure the response time and check whether Paystack logged a retry.
4. With the overlay open, restart the service (manual deploy). Note the SSE event ids before and after. Watch it reconnect, then donate twice.

**Expect:** PRODUCTION must not run on the free plan: sleeping pauses every sweep, and cold starts of 30-60 s put webhook acknowledgements at risk. After the restart, the overlay reconnects within about 3 s ('retry: 3000') and shows the new donations. Event ids now start from the boot time, so they keep increasing across restarts and a client resuming with its old Last-Event-ID receives the new events instead of skipping them. Totals refresh from the API, so nothing is permanently missing. Known open issue I003: render.yaml still says plan: free; moving production to a paid, always-on plan is the owner's decision.

**Needs:** Render; Paystack test keys

**Source:** `render.yaml`, `apps/api/src/main.ts`, `apps/api/src/infrastructure/realtime/EventBus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `DEPLOYMENT.md`

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

## GAP3-047 · P1 · Browser with site storage blocked: the app never goes blank, especially donation pages

*Surfaces:* web  ·  *Type:* negative/edge

**Before:** Chrome: Settings > Privacy and security > Site settings > On-device site data > 'Don't allow sites to save data' for app.ujimora.com. Firefox with dom.storage.enabled=false. Safari iOS in Private Browsing with 'Block All Cookies'.

**Steps:**

1. Load app.ujimora.com, /c/<slug> and /c/<slug>/donate in each browser.
2. Try a guest donation through to Paystack, and check the callback page.
3. Try to sign in and reload.
4. Try a creator tip.

**Expect:** Public pages and the guest donation flow render and work, with no blank white page: the colour-mode provider and the session library read storage through guarded helpers, and the donation handoff falls back to the reference in the URL. Without storage the session reads as signed out, so a sign-in does not persist across reloads; this is acceptable if explained. The tip flow still reads localStorage directly; record whether it shows an understandable error rather than a dead button.

**Needs:** Paystack test keys

**Source:** `apps/web/src/context/ColorModeContext.tsx`, `packages/ui/src/browserSession.ts`, `apps/web/src/lib/donationHandoff.ts`, `apps/web/src/lib/tipCheckout.ts`, `apps/web/src/App.tsx`

## GAP3-052 · P1 · Subscription (sub-) charge refunded from the dashboard: entitlement revoked, commission reversed, replays are no-ops

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** User U referred by affiliate A buys a paid plan through Paystack (fresh 30-day period), and a commission accrues. Paystack test dashboard access to refund the charge. Signed webhook replay.

**Steps:**

1. Refund U's subscription charge in full from the Paystack test dashboard and let refund.processed arrive.
2. Check U's /subscription and GET /api/v1/subscriptions/mine, the commission status and A's balance at /affiliate and admin /affiliates/<A>, and GET /api/v1/admin/payments/provider-events.
3. Replay refund.processed 3 times (concurrently).
4. Replay the original sub- charge.success.
5. Repeat with a user who renewed early (two paid periods) and refund only the renewal charge; then with a partial refund.

**Expect:** A full refund removes that charge's 30 days: U's fresh plan now ends immediately and shows Expired, and U can buy again. The commission is reversed exactly once and A's balance is decremented once. The event is recorded once in provider-events. Replays of refund.processed and charge.success are no-ops with 200: no second revocation, no new commission, the checkout stays SUCCEEDED. For the early renewal, only the added period is removed and the original period stays. A partial refund keeps access and is logged; confirm the policy for partial refunds (owner decision).

**Needs:** Paystack test keys + signed webhook replay

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RevokeRefundedSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`

## GAP-N002 · P1 · Provider-reported refunds and chargebacks on tips, subscriptions and top-ups are listed for staff and can be acknowledged

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Staging with Paystack test keys and a reachable webhook. A settled tip- charge, a settled wtop- top-up and a settled sub- charge. An admin token and a member token.

**Steps:**

1. In the Paystack test dashboard, refund the tip- charge and the wtop- charge. Send a charge.dispute.create for the sub- charge.
2. Check the API logs for each event.
3. GET /api/v1/admin/payments/provider-events, then with ?status=open and ?status=acknowledged.
4. Redeliver one of the webhooks from the Paystack dashboard and list again.
5. POST /api/v1/admin/payments/provider-events/<id>/acknowledge for one event, then again for the same id, then for 'not-an-id'.
6. Call the list with the member token and with no token.
7. Check the creator balance, the wallet balance and the subscription.

**Expect:** Each event is stored once (a redelivery adds no row), with subject tip, wallet_topup or subscription, the reference, amount and currency, and no customer details, and is logged as an alert. The list returns the open events newest first. Acknowledge returns {reviewStatus:'acknowledged'}; a second call returns 404 'Provider event not found or already acknowledged', and a malformed id returns 404 'Provider event not found'. Member gets 403, no token 401. Nothing moves money: the tip is still credited to the creator and the wallet top-up still counts; staff account for them manually. Known open issue I009: there is no admin console page for this list (API only) and no automatic reversal.

**Needs:** Paystack test keys + webhook

**Source:** `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/database/models/ProviderPaymentEventModel.ts`

## GAP-N004 · P1 · Stuck creator, affiliate and beneficiary transfers escalate to NEEDS_REVIEW and are resolved by API

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with the reconciliation scheduler on and test transfers. One creator withdrawal, one affiliate payout and one beneficiary payout each left PROCESSING with a transfer reference Paystack does not know (block the webhook and use a fabricated reference, or switch keys). DB access to backdate updatedAt. An admin token.

**Steps:**

1. Backdate each payout's updatedAt by 25 hours and wait one 5-minute sweep.
2. Check each status, the reserved amounts and the log line.
3. Check the creator's /creator history and the affiliate dashboard.
4. POST /api/v1/payouts/stuck/creator/<id>/resolve with {note:'short'}, then with a note of at least 20 characters.
5. Resolve the affiliate and beneficiary payouts the same way (rails 'affiliate' and 'beneficiary').
6. POST /api/v1/payouts/stuck/unknownrail/<id>/resolve.
7. For a payout whose transfer is genuinely still pending at Paystack, try to resolve it.
8. Call resolve with a member token.

**Expect:** After 24 hours in PROCESSING each payout becomes NEEDS_REVIEW with its money still reserved; nothing is failed automatically, and the log reads 'payout reconciliation: transfer unconfirmed past dwell window; escalated for review with funds still reserved'. A short note is refused with 400. Resolving re-verifies with Paystack and hands the outcome to that rail's own idempotent handler: a transfer Paystack does not know, or a failed one, returns the funds to the creator, affiliate or beneficiary balance once; a successful one settles to PAID; a still-pending transfer is left alone with 409. An unknown rail returns 404 'Unknown payout rail'. Each resolution is audited. Members get 403. Only campaign payouts have a console button, so staff use the API for these rails.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/application/use-cases/ResolveStuckPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## GAP-N006 · P1 · Abandoned subscription checkouts expire after 24 hours, free their coupon seat, and a late charge still activates

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with the reconciliation scheduler on. A user U with an unpaid subscription checkout that used a single-use coupon, backdated 25 hours. A second checkout whose Paystack reference is unknown (initialize failed), also backdated. A third user V whose card is declined.

**Steps:**

1. Wait one 5-minute tick. Check the three checkouts and the coupon redemption rows.
2. As U, return to /subscription and read any 'Returning from payment?' banner; start a new checkout with the same coupon.
3. Complete a payment with the expired checkout's original reference (or deliver its signed charge.success).
4. Check U's plan, the coupon counter and the logs.
5. Open /subscription/callback for V.

**Expect:** The unpaid checkout becomes EXPIRED and its coupon seat is released, so U can use the coupon again; the unknown-reference checkout also expires; V's declined checkout becomes FAILED with its seat released. The web banner shows only while a checkout is still pending, and the stored handoff is cleared once it is final. A genuine late charge on the EXPIRED checkout still activates the plan once (EXPIRED to SUCCEEDED). A checkout whose verification keeps erroring is retried each tick and expired after 7 days with 'subscription checkout unverifiable for 7 days; expiring it'.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`

## GAP-N007 · P1 · Staging boot guards and scheduler switches

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** A staging API you can restart with different env values. Log access. An admin token.

**Steps:**

1. Start with NODE_ENV=production and CORS_ORIGINS empty (then blank, then ',').
2. Start with MIN_APP_VERSION_IOS=v1 and with APP_STORE_URL_IOS=http://example.com.
3. Start with MFA_ENCRYPTION_KEY and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 unset, then with STORE_BILLING_ENABLED unset. Read the boot logs.
4. Start without OPENAI_API_KEY and read the logs; submit content that needs screening.
5. Start with NODE_ENV=production, PAYMENTS_RECONCILIATION_ENABLED=true and RECONCILIATION_SCHEDULER_ENABLED=false. Wait 10 minutes and search for sweep log lines.
6. POST /api/v1/admin/reconciliation/topups and POST /api/v1/admin/reconciliation with the admin token, then with a member token.
7. Start with PAYSTACK_CHANNELS=card and open a top-up checkout.

**Expect:** Empty CORS_ORIGINS in production stops the API with 'CORS_ORIGINS is required in production'. Invalid MIN_APP_VERSION or store URL values stop it with 'MIN_APP_VERSION_IOS must be a numeric app version such as 1.2.0' or 'APP_STORE_URL_IOS must be an https:// store URL'. Missing encryption keys log one error 'Production capabilities disabled by missing configuration' naming the capabilities and variable names, never values; missing store billing logs the warning 'Optional production capabilities are off'. A missing OpenAI key logs an error at boot and screening routes content to staff review ('Publication screener unavailable; routed to staff review'). With the scheduler off, no reconciliation tick runs, and the admin endpoints run the sweeps on demand and return their summaries (top-ups: {scanned, completed, failed}); members get 403. The checkout offers only card.

**Needs:** Render staging

**Source:** `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## GAP-N008 · P1 · Staff-assisted account closure in the fraud and cleanup runbooks

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging. Admin with USERS delete permission and MFA. Member M1 with no balances and no payouts in progress. Member M2 with a GHS 20 wallet balance and a PENDING campaign payout. Another admin account.

**Steps:**

1. Admin opens member detail for M1 > 'Account closure' > 'Close account'. In 'Close this account' enter a verification note under 20 characters, then a valid one, and a wrong confirmation email, then the right one. Submit.
2. Check M1's sessions (web and app), sign-in, public profile, campaigns and admin /audit.
3. Repeat for M2.
4. Try to close the other admin's account and your own.
5. Read the source path: adminAccountClosureRoutes.ts calls DeleteAccountUseCase.execute(id) with no credentials, while app.ts wires that use case with MFA step-up.

**Expect:** Required: M1's account is closed through the normal erasure path, its sessions are revoked, its open campaigns end, and admin /audit shows 'account.staff_closure' with the verification note. M2 is refused with 409 'Your account can’t be closed yet. First withdraw or resolve: GHS 20.00 in your Ujimora wallet; 1 payout still being processed. If you can’t, contact support@ujimora.com…'. Short notes and a wrong email are refused ('The confirmation email does not match this account.'). Closing an admin returns 409 'Administrator accounts cannot be closed from the console.'; your own returns 409 'Close your own account from your profile, not the staff console.'. Source check: because the route passes no password, closure may fail with 400 'Enter your current password to delete your account…' after the audit row is written. If it does, log a P1 defect (the I083 closure and I108 step-up changes conflict) and keep closures on the manual runbook until it is fixed.

**Needs:** none

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/admin/src/components/AccountClosureControl.tsx`, `apps/admin/src/pages/UserDetailPage.tsx`

## GAP-N009 · P1 · Restored snapshot: new indexes build cleanly and the consent-history backfill is idempotent

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** The staging snapshot from GAP2-036, booted with this branch. Read and write access to that staging database only.

**Steps:**

1. Boot the API and search the logs for 'Database model initialization failed'.
2. List the new indexes: campaigns 'campaign_creation_idempotency' (partial unique) and {status, endDate}; disputes providerDisputeId (partial unique); donationintents {status, paymentRail, reconciledAt, updatedAt}; donations {campaignId, createdAt}; providerpaymentevents eventKey (unique); revoked_sessions sessionId (unique) with a TTL on expiresAt; legal_acceptance_events {userId, acceptedAt}; subscription checkout {status, createdAt}.
3. Run: MONGODB_URI=<staging> npx tsx scripts/backfill-legal-acceptance-events.ts (dry run). Record the output.
4. Run it with --apply, then again with --apply.
5. Spot-check 10 users: one 'backfill' event each, matching users.legalAcceptance.
6. Run it with an extra argument, and with no MONGODB_URI.

**Expect:** The API boots with no index errors, and every listed index exists (the partial unique indexes cannot clash with legacy rows because their fields are new). The dry run prints {"mode":"dry-run","candidates":N,"inserted":0} and writes nothing. The first --apply inserts N 'backfill' events, including closed accounts; the second inserts 0. Bad arguments exit with code 1 and 'Legal acceptance backfill failed: Set MONGODB_URI; arguments: [--apply].' Run it against production only after review.

**Needs:** MongoDB Atlas restore access

**Source:** `apps/api/scripts/backfill-legal-acceptance-events.ts`, `apps/api/src/infrastructure/database/models/LegalAcceptanceEventModel.ts`, `apps/api/src/infrastructure/database/models/CampaignModel.ts`, `apps/api/src/infrastructure/database/models/DisputeModel.ts`, `apps/api/src/infrastructure/database/models/ProviderPaymentEventModel.ts`, `apps/api/src/infrastructure/database/connection.ts`

## GAP-N010 · P1 · Venue live event: many viewers behind one address stay under the live-read limit, and donations still work

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging with a live session. 40 browser tabs (or a load script) on ONE public IP, as at a venue Wi-Fi or carrier NAT. A host studio tab on the same network.

**Steps:**

1. Open /c/<slug>/live/<sessionId> in 40 tabs and leave them polling and streaming for 15 minutes.
2. Watch X-RateLimit-Remaining on GET /api/v1/live-sessions/<id>/public and on a non-live GET (e.g. /api/v1/campaigns).
3. From the same network, start two donations and post a comment during the 15 minutes.
4. Push past the live-read limit with a script (more than 1800 live reads in 15 minutes from one address).
5. Repeat from a second network at the same time.

**Expect:** Live reads (session public, overlay, overlay view, events, video config, campaign events, active-live and live-sessions/active; GET and HEAD only) use a separate 1800-per-15-minutes bucket, so 40 viewers polling every 10 seconds do not drain the general 300 bucket. Donations and comments from the same address still succeed. Past 1800 live reads that address gets 429 on live reads only. The second network has its own buckets.

**Needs:** LiveKit (optional)

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`

## GAP-N011 · P1 · Campaign creation retried after a lost response creates one campaign

*Surfaces:* android, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** An organizer with exactly one campaign slot left. DevTools or a proxy able to drop a response. The native app on a throttled network.

**Steps:**

1. On web /campaigns/new, submit and drop the POST /api/v1/campaigns response. Restore the network and submit again without changing anything.
2. Change the title and submit again.
3. On native campaign create, repeat the dropped-response retry.
4. By API, POST /campaigns twice with the same Idempotency-Key and body, then with the same key and a different body, then with a 10-character key, then with no key.
5. Check My Campaigns and the organizer's remaining allowance.

**Expect:** The retry with the same details sends the same key and returns the campaign already created (200 'Campaign already created') instead of a second one, so the last slot is not burned. Changed details start a new key. By API: the same key with a different body returns 409 'This Idempotency-Key was already used for a different campaign. Submit again with a new key.'; a short key returns 400 'Idempotency-Key must be 16-100 letters, digits, hyphens or underscores'; no key keeps the old behaviour (each call is new).

**Needs:** none

**Source:** `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/api/src/infrastructure/database/models/CampaignModel.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`

## GAP-N012 · P1 · Native app during an API cold start, an HTML 502 or a slow response

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Store builds against staging on the Render free plan (or a proxy that can return an HTML 502 page, a non-JSON 200 and a 40-second delay).

**Steps:**

1. Let staging sleep for 20 minutes, then open the app and pull to refresh on Home and Wallet.
2. With the proxy, return an HTML 502 to a campaign load.
3. Return a non-JSON 200 body to one request.
4. Delay a donation-intent response by 40 seconds.
5. Delay an image upload by 100 seconds, then by 130 seconds.
6. Turn on airplane mode and retry a screen.

**Expect:** No raw HTML or JSON parse errors reach the user. An HTML 5xx shows 'Ujimora is temporarily unavailable. Please try again in a minute.'; a non-JSON 200 shows 'Unexpected response from Ujimora. Please try again.'; a request past 30 seconds (120 seconds for uploads) shows 'Ujimora took too long to respond. Check your connection and try again.'; offline shows 'Could not reach Ujimora. Check your connection and try again.'. The timed-out donation is not retried automatically, and pressing Give again reuses the same checkout rather than charging twice. The upload's busy state is released after a failure. The session is not signed out by any of these errors.

**Needs:** Render staging or an HTTP proxy

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/donate/[id].tsx`, `render.yaml`

## GAP-N013 · P1 · Release drill: raise the minimum app version after a legal-version bump

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Staging. Build N installed on iOS and Android. Build N+1 (with the new LEGAL_ACCEPTANCE_VERSION text) live in TestFlight and Play internal. The release checklist open.

**Steps:**

1. Deploy the API with the new LEGAL_ACCEPTANCE_VERSION. Keep MIN_APP_VERSION_IOS/ANDROID unset for 10 minutes and use build N.
2. Set MIN_APP_VERSION_IOS and MIN_APP_VERSION_ANDROID to N+1's version on Render and redeploy. Check GET /api/v1/app/config.
3. On build N, relaunch the app, then separately leave it in the background for more than 5 minutes and resume it.
4. On the 'Update required' screen tap 'Update Ujimora'. Also test with the store URL unreachable.
5. Install N+1 and sign in; accept the new agreement.
6. Put the checklist order in writing: ship N+1 to both stores, wait for approval, bump the legal version, raise MIN_APP_VERSION_* the same hour.

**Expect:** Before the minimum is raised, build N cannot register or re-accept (400) and the agreement screen points to updating or the website. After raising it, /app/config returns the new minimum (cached up to 5 minutes), and build N shows the blocking 'Update required' screen at launch and on resume within about 5 minutes, above the biometric lock. The button opens the store page; if that fails it shows 'Could not open <store>. Search for Ujimora there to update.'. N+1 works normally. The drill timings are recorded in the release checklist.

**Needs:** TestFlight, Play internal track; Render

**Source:** `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/appConfigRoutes.ts`, `apps/mobile/src/components/UpdateRequiredGate.tsx`, `apps/mobile/app/account-agreement.tsx`, `packages/types/src/legal-acceptance.ts`

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

## GAP11-057 · P2 · Legacy POST /campaigns/:id/donate is idempotent with an Idempotency-Key

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging. A signed-in user with a wallet balance of at least GHS 3. An active campaign and a second campaign.

**Steps:**

1. Call POST /api/v1/campaigns/<id>/donate {"amount":1,"currency":"GHS","paymentMethod":"wallet"} twice with the same Idempotency-Key header (8-100 letters, digits, hyphens or underscores), as a client retry would.
2. Reuse that key for the second campaign, then for amount 2.
3. Send a key of 5 characters.
4. Drain the wallet below GHS 1, send a new key (refused for balance), then replay that same key after topping up.
5. Call the route twice with no Idempotency-Key.
6. On web /campaigns/<id>, open the wallet donation dialog, drop the network after pressing donate, restore it and press again.

**Expect:** Same key: one debit and one donation; the replay returns 200 'Donation successful'. Same key with a different campaign or amount: 409 'This request key was already used for a different donation'. A bad key: 400 'Invalid Idempotency-Key'. Replaying a key whose first attempt did not complete: 409 'This donation attempt did not go through. Please start a new donation.' No key: each call is a separate donation (two debits), as documented. The web wallet dialog keeps one key per logical donation, so the retried press debits once.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/lib/checkoutAttempt.ts`

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

**Before:** A guest and a registered donor. A creator with a paid plan and tips enabled. Admin. A third user to report.

**Steps:**

1. Donate with a public name and message. On /donate/callback note the review badge, then close the tab.
2. Some hours later, reject the message in admin /publication-reviews (donation content reviews).
3. The donor opens /donations (if registered), the notifications panel, and reopens the callback URL from history.
4. Repeat with a creator tip on web /creators/<handle> and /tip/callback. On Android, check the result on the creator screen (tips are unavailable in native iOS).
5. Approve another registered donor's message, then have a viewer report it; the admin resolves the report with 'hide message' in /safety-reports.
6. Check the donor's and the reporter's notifications.

**Expect:** A publication-review rejection is visible only on the callback page, while open or reopened with the same reference; My Donations shows no content status and nothing is sent. The tip callback shows 'not approved... contact support@ujimora.com with your payment reference'. A safety-report 'hide message' sends the registered donor 'Your message was hidden' ('A message you left with a payment was hidden after a safety review. The payment itself is not affected. For details or to appeal, contact support@ujimora.com.') and the reporter 'We reviewed your report'. Guests get nothing. Confirm the product owner accepts that publication-review decisions are not notified.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationContentReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/tipContentReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/web/src/components/donate/DonationReviewStatus.tsx`, `apps/web/src/pages/CreatorTipCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## GAP2-023 · P2 · End date passes: the campaign is relabelled EXPIRED and closes everywhere

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** A campaign with the shortest allowed endDate (or adjust endDate in the staging DB) and some funds raised below its goal. An active live session on it. The organizer at their plan's active-campaign limit.

**Steps:**

1. Wait until 5 minutes after endDate. Check the campaign's status in the DB or admin.
2. Open the public page, /c/<slug>/donate, /campaigns/<id> and the mobile campaign screen.
3. Send POST /api/v1/donation-intents.
4. Check web Explore and native Explore (Expired filter), the admin campaigns 'Expired' filter, /sitemap.xml and the organizer's /my-campaigns 'Expired' tab.
5. Check the live session within a minute.
6. As the organizer, request a standard payout, then create a new campaign.
7. Check whether the campaign is still on the leaderboard.

**Expect:** Within 5 minutes the sweep sets status EXPIRED (pending, blocked and deleted campaigns are never touched). Donations are refused ('Campaign is not accepting donations') and web shows 'Donations closed' / 'This campaign is not accepting donations.' Explore and the sitemap list only open campaigns; the admin 'Expired' filter and the 'Expired' tab show it. The live session is ended by the live-safety sweep. A standard payout is allowed with no early fee, and the ended campaign no longer counts toward the active-campaign limit, even before the relabel. Record the leaderboard behaviour for expired campaigns.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/app.ts`, `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/application/services/payoutFee.ts`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`

## GAP2-026 · P2 · Shared device: a callback with no reference never shows another donor's gift

*Surfaces:* web  ·  *Type:* security/permission

**Before:** A shared browser (for example an internet café PC).

**Steps:**

1. Donor 1 starts a 70 GHS gift on campaign X, reaches Paystack, and abandons it.
2. Donor 2, in a new tab, opens /donate/callback with no query string.
3. Donor 2 opens /donate/callback?reference=__last.
4. Check Local Storage and Session Storage for uf_pending_donations.

**Expect:** Donor 2 sees the missing-reference message ('We couldn't find a payment reference to confirm…') with 'Go home'. Nothing about donor 1's amount or campaign is shown. The handoff lives only in the original tab's sessionStorage, keyed by reference, and is removed once the payment is final. Any old localStorage copy is deleted on load.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/donationHandoff.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/DonateCallbackPage.tsx`

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

## GAP2-042 · P2 · Tip checkout credential cleanup job, including abandoned tips

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging with NODE_ENV=production and the reconciliation scheduler on. Tips: one SUCCEEDED, one FAILED, one abandoned PENDING older than 24 hours, one abandoned PENDING under 24 hours, plus 502 synthetic terminal tips that still have checkout objects.

**Steps:**

1. Restart the API and check that the boot cleanup clears checkout on terminal tips.
2. Wait 5 minutes and check the next batch (500 per run).
3. Check the abandoned tips after the next reconciliation tick.
4. Check on Paystack's side whether old access codes still open a checkout.

**Expect:** Terminal credentials are cleared at boot and every 5 minutes (at most 500 per run), and financial fields are unchanged. The sweep closes the tip abandoned for more than 24 hours (FAILED), after which its credentials are cleared; the younger one stays PENDING. A tip the provider never registered is closed after 24 hours too. Update TIP_CHECKOUT_SAFETY.md to record the 24-hour rule.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoTipRepository.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/app.ts`, `docs/compliance/TIP_CHECKOUT_SAFETY.md`

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

## GAP3-004 · P2 · Donation seat is released after failure even when the coupon is deactivated; donor can retry without the code

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Coupon FEEWAIVE2 (Donation surface, Per-User Limit 1). Donor D. Reconciliation scheduler on in staging, OR the ability to send a signed charge.failed webhook.

**Steps:**

1. D starts a GHS 50 donation with FEEWAIVE2 at /c/<slug>/donate, then uses Paystack's declined test card (or abandons the checkout).
2. Admin deactivates FEEWAIVE2 (Delete is refused while the seat exists).
3. Drive the failure: deliver the charge.failed webhook, or, for an abandoned checkout, wait until it is more than 24 hours old and one sweep has run (backdate createdAt in staging).
4. Query the CouponRedemption row for this intent.
5. D opens the donate page again and enters FEEWAIVE2; after the error, D clears the field and donates GHS 50.
6. Query for any CouponRedemption rows still PENDING for intents that are FAILED or EXPIRED.

**Expect:** On a declined payment the intent is FAILED; an abandoned checkout becomes EXPIRED only after 24 hours. Either way the seat becomes RELEASED. Re-entering the deactivated code shows a clear invalid-code error and blocks Give. After clearing the field, D can donate at the normal fee. No orphan PENDING seats remain.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/donationCouponSeats.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`

## GAP3-005 · P2 · A used coupon cannot be deleted and re-created to reset its limits

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Coupon ONCE (Subscription or Donation surface, Per-User Limit 1, Max Redemptions 5). User U has already redeemed it successfully once.

**Steps:**

1. As U, try to apply ONCE again and confirm it is refused (per-user limit).
2. As admin, open the delete dialog for ONCE at /coupons. Read it and try Delete; try DELETE /api/v1/coupons/<id> by API.
3. Deactivate ONCE, then try to create a new coupon with the same code ONCE.
4. Export Coupons via the Export menu (CSV) and open any admin report that lists redemptions or affiliate conversions.

**Expect:** The dialog reads 'Delete an unused coupon permanently. Used coupons can only be deactivated…' and 'This coupon has been redeemed 1 time, so it cannot be deleted.', with Delete disabled. The API refuses with 409 'This coupon has been used — deactivate it instead.' Re-creating the code is refused with 409 'A coupon with this code already exists'. Limits and redemption history are kept, so U cannot redeem again. Reports and exports work.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/api/src/application/use-cases/CreateCouponUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.ts`, `apps/admin/src/pages/CouponsPage.tsx`

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
2. Force a lapse: set C's subscription currentPeriodEnd to 1 minute ago in the staging DB. Confirm GET /api/v1/subscriptions/mine shows it expired.
3. Watch for 5 minutes. Is C still streaming? Is V still watching? V donates GHS 5 through the live link.
4. C clicks 'Disconnect camera', then 'Start camera & microphone' again. This calls POST /api/v1/live-sessions/:id/video/host-token.
5. Call POST /api/v1/live-sessions/:id/video/host-token directly with C's bearer token and record the HTTP status.
6. C clicks 'End session' and confirms 'End broadcast' in the 'End broadcast?' dialog.

**Expect:** Behaviour matches docs/live-broadcasting.md. An already-connected host is not disconnected by the lapse (no sweep), and V keeps watching. A new host token is refused with 403 'Your Community plan does not include LIVE streaming. Upgrade to unlock it.' (the owner's plan name), and C sees that message. Viewer tokens are unaffected. The GHS 5 donation settles and is attributed exactly once. 'End session' still works, closes the LiveKit room, and V sees the broadcast end.

**Needs:** LiveKit credentials; Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/app.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`

## GAP3-008 · P2 · Lapsed owner presses 'Go LIVE' while a previous session is still active

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Creator C (paid, Live streaming) with campaign C1 that has an active session left running, and a second active campaign C2 with no session. Staging DB access.

**Steps:**

1. Force C's plan lapse as in GAP3-007.
2. Open app.ujimora.com/campaigns/<C1>/live and click 'Go LIVE' (POST /api/v1/campaigns/<C1>/live-sessions).
3. Open /campaigns/<C2>/live and click 'Go LIVE'.
4. Check the OBS overlay link for C1's session and the number of active sessions for C1 in the DB.

**Expect:** Both calls return 403 'Your Community plan does not include LIVE streaming. Upgrade to unlock it.'; the plan check now runs before an existing active session is returned, so a lapsed plan cannot re-enter the old broadcast. No second active session is created for C1. The existing session keeps running until ended or until the 12-hour live-safety limit, and its overlay keeps working.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/web/src/pages/CampaignLivePage.tsx`

## GAP3-009 · P2 · Admin turns off 'Live streaming' for a tier while its creators are live

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Two creators on tier Pro, both broadcasting. A third Pro creator who is not live. Admin with PLANS permission.

**Steps:**

1. At admin /plans, edit Pro, untick 'Live streaming' and save.
2. Watch both live sessions for 3 minutes. One host disconnects and reconnects the camera.
3. The third creator clicks 'Go LIVE'.
4. Re-enable 'Live streaming' on Pro and have the third creator and the reconnecting host retry.

**Expect:** Connected hosts keep streaming, but the host who reconnects is refused a new token with 403 '… plan does not include LIVE streaming. Upgrade to unlock it.' The third creator's 'Go LIVE' is refused with the same 403. The plan edit is audited. Re-enabling restores 'Go LIVE' and reconnects at once (no stale plan cache beyond the documented TTL). No errors appear in the host UIs beyond the upgrade message.

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

**Expect:** The subscription shows as expired within about 2 minutes of the provider expiry. The reconnect's host token and the new session are both refused with 403 '… plan does not include LIVE streaming. Upgrade to unlock it.', and the app shows that message. On iOS the message must NOT link to web payment (store rule; only IAP upgrade). 'End broadcast' works. There are no crashes.

**Needs:** App Store sandbox; Google Play license testing; LiveKit

**Source:** `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## GAP3-011 · P2 · Collaborator invitations pending when the owner's plan lapses or is downgraded

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Owner O on a plan with Campaign collaboration and max collaborators >= 3. Registered invitees I1, I2 and I3.

**Steps:**

1. In the campaign's collaborator section, O invites I1, I2 and I3. Confirm the form no longer asks for a revenue share and roles are described as listing labels.
2. I1 accepts at app.ujimora.com/invitations.
3. Force O's plan lapse to Free (Community).
4. I2 clicks Accept at /invitations. I3 clicks Accept.
5. I2 clicks Decline instead.
6. O re-subscribes, then I3 accepts again.
7. Downgrade O to a tier with max collaborators = 1 while 2 have accepted, then have O invite another user.

**Expect:** Step 4 is refused with 403 and the invitations stay PENDING (not consumed). The message comes from the owner's plan: 'Your Community plan does not include campaign collaboration. Upgrade to unlock it.' This still wrongly addresses the invitee; file P2 copy defect. Decline still works. After re-subscribing, I3's accept succeeds. I1's accepted access is unchanged by the lapse, and the policy on existing collaborators is documented. In step 7, existing collaborators are kept and the new invite is refused with the 'allows 1 collaborator(s)' message.

**Needs:** none

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/RespondToCollaborationUseCase.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/pages/CollaborationInvitationsPage.tsx`, `apps/web/src/components/campaigns/CollaboratorSection.tsx`

## GAP3-012 · P2 · Split draft and active split when the owner's plan lapses (SPLIT_PROCEEDS_ENABLED=true)

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging instance with SPLIT_PROCEEDS_ENABLED=true. Owner with Campaign collaboration + escrowSupport ('Split proceeds'). Two beneficiary users. Paystack test keys.

**Steps:**

1. The owner creates split v1 (60/40) in CampaignSplitSetup, both beneficiaries accept, and the owner activates it.
2. The owner creates draft v2 (50/50). Beneficiary 1 accepts v2.
3. Force the owner's plan lapse.
4. Beneficiary 2 records consent on v2 (POST /api/v1/campaigns/:id/split/2/consent).
5. The owner tries to activate v2 (POST /split/2/activate) and to create v3.
6. A donor gives GHS 100 to the campaign.
7. Check GET /split/beneficiaries balances and the donor disclosure on the donate page and /c/<slug>.

**Expect:** Recording consent is allowed. Activating and creating new versions are refused with 403 and the plan message. v1 stays active. The new donation accrues 60/40 exactly in minor units (sum of shares = campaign net), and the donor disclosure reads 'This campaign's proceeds are shared: <name> 60%, <name> 40%.', matching what accrues. Known open issue I070: split accrual continues after the plan lapses (owner decision); document the policy.

**Needs:** Paystack test keys; SPLIT_PROCEEDS_ENABLED staging

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/application/services/SplitAccrualService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/web/src/components/campaigns/CampaignSplitSetup.tsx`, `apps/web/src/components/campaigns/SplitDisclosure.tsx`

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

**Expect:** Every campaign gets a unique valid slug of 3-60 characters, and Ghanaian letters are transliterated: a) 'odo-nkomo-help-efua-s-surgery', b) 'adwoa-agyeman-bediako-fund', c) 'cafe-resume-nkosuo'. d) and e) get 'campaign-xxxxxx'. The second f) gets a '-xxxx' suffix. g) gets a suffix (reserved word). Every link resolves on web and native. Existing slugs are not migrated.

**Needs:** none

**Source:** `apps/api/src/application/utils/slug.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/mobile/app/campaign/shared.tsx`

## GAP3-023 · P2 · Custom vanity slug endpoint PATCH /api/v1/campaigns/:id/slug (API-only; no client UI)

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Owner token, a second user's token, admin token, and an existing slug belonging to another campaign. A printed QR code and a shared /c/<old-slug> link for the campaign.

**Steps:**

1. As the owner, PATCH with each body: {slug:'ɔdɔ-fund'}, {slug:'Odo-Fund'}, {slug:'odo--fund'}, {slug:'ab'}, {slug:'live'}, {slug:'<other campaign slug>'}, {slug:'odo-fund'}.
2. PATCH as the non-owner, and again logged out.
3. After the valid change, open /c/<old-slug>?ref=x, /c/odo-fund, and scan the QR code (/r/<code>).
4. Try to give another campaign the old slug.
5. Fetch /qr/<code>.png and check the response headers.

**Expect:** 400 for the non-ASCII, uppercase, double-hyphen and too-short slugs (zod regex). 409 for reserved ('That slug is reserved') and taken ('That slug is already taken'). 403 for the non-owner, 401 when logged out. The valid slug goes through publication admission and then changes. The old slug keeps working: /c/<old-slug> resolves and the browser URL is replaced with /c/odo-fund?ref=x. QR codes and short links are rebuilt from the current slug at each scan, so printed codes do not break. The old slug stays reserved ('That slug is already taken'). The QR image is served with Cache-Control public, max-age=86400, immutable.

**Needs:** OpenAI (optional, publication screening)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/api/src/application/utils/slug.ts`

## GAP3-025 · P2 · Emoji, Ghanaian letters and right-to-left text in donor names and messages on the OBS overlay, live pages and SSE feeds

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Active live session with names, messages and amounts visible. OBS Studio with a Browser Source pointed at the private overlay link ('Copy private overlay link' -> /api/v1/live-sessions/:id/overlay/view?token=...). Paystack test keys.

**Steps:**

1. Donate through the live link with these name/message pairs: 'Ɛfua Ɔpɔku 🙏🏾' / 'Nyame nhyira wo ❤️‍🔥'; '👨🏾‍👩🏾‍👧🏾' only; Arabic 'بارك الله فيك'; mixed 'For Ama بارك 50 cedis'; combining-mark spam 'Z̶͑a̷l̴g̸o̴'.
2. Send a message of exactly 500 UTF-16 units made of emoji, then one of 501.
3. Watch the OBS overlay, the WatchLivePage feed, the CampaignLivePage 'Donor feed', the mobile live screen and the campaign donor list.
4. Toggle the donor privacy switches off and on.

**Expect:** All glyphs render without tofu boxes. Right-to-left names and messages do not reorder the adjacent name or amount: the overlay wraps names in bdi elements and sets dir=auto with bidi isolation on messages and the title. Long text is ellipsized inside the overlay row with no overflow, and Zalgo text stays inside its row. The 501-unit message is rejected with a clear message, and the web and mobile counters agree with the server's 500 limit. The privacy toggles still hide names and messages.

**Needs:** Paystack test keys; LiveKit (optional); OBS

**Source:** `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`

## GAP3-026 · P2 · Admin PDF, XLSX and CSV exports with non-ASCII, emoji, right-to-left text and formula-like values

*Surfaces:* admin  ·  *Type:* compliance

**Before:** Donations and users exist with the names and messages from GAP3-025, plus a donor named '=HYPERLINK("http://x","a")', a phone '+233241234567' and a message '-5+3'.

**Steps:**

1. At admin /donations (also /coupons and /payouts), use the Export menu to produce PDF, XLSX and CSV.
2. Open the CSV in Excel on Windows and in Google Sheets. Open the XLSX in Excel and Numbers. Open the PDF in Acrobat and macOS Preview.

**Expect:** The CSV opens as correct UTF-8 (BOM present). The XLSX is correct. Formula-like values are prefixed with an apostrophe and never execute, and +233 numbers stay text. The PDF uses the bundled Noto Sans for body and table text, so ɛ, ɔ, ŋ and accented Latin names render correctly (a NotoSans-OFL.txt notice ships with the font). Emoji and Arabic are still not rendered in the PDF (pdfmake limitation noted in the I176 fix); names that need them must be read from the CSV or XLSX.

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

## GAP3-032 · P2 · Remove the only name-matched payout account: confirmation, ownership checks and double tap

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Creator A with exactly one name-matched account. User B's token. A logged-out client.

**Steps:**

1. On web, click 'Remove saved account' on A's only matched account. Read the dialog and click Cancel.
2. On iOS and Android, tap Remove and dismiss the alert.
3. Remove it on web with 'Remove account'. Open the creator withdrawal form.
4. Re-add the same number with the matching name.
5. As B, send DELETE /api/v1/payout-accounts/<A's account id>. Repeat with no token.
6. As A, double-tap 'Remove account' on a slow network.

**Expect:** Web shows 'Remove saved account?' with '<name> ending <last4> will be removed from your saved payout accounts. Payouts you have already requested keep their original destination. To use this account again you will need to add it and verify it again.' and Cancel / 'Remove account'; mobile shows the same text in a native alert with a destructive 'Remove account', and dismissing counts as cancel. Nothing is deleted until confirmed. The withdrawal form explains that a verified account is needed and links to add one. Re-adding runs name resolution again and creates a new recipient. B gets 404 and A's list is unchanged. No token gives 401. The double tap sends one DELETE and the list stays consistent.

**Needs:** Paystack account resolution

**Source:** `apps/web/src/components/account/SavedPayoutAccounts.tsx`, `apps/mobile/src/lib/confirmDestructive.ts`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

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
2. Inspect the cache (ImagePicker and DocumentPicker folders) before relaunch, then relaunch and inspect it again. Check what the KYC field shows.
3. Android: pick a document from Google Drive or Downloads (content:// URI) and upload. Confirm the source still exists.
4. Repeat the success and kill tests on profile edit (avatar), campaign create (cover image) and the organization KYC form.

**Expect:** The copy left by the kill is removed on the next launch: a startup sweep deletes picker files older than the launch in the ImagePicker and DocumentPicker cache folders (including nested ones) alongside the recovery-code sweep. content:// sources are never deleted. After relaunch the field is empty (not falsely 'Uploaded'), and the other screens behave the same way.

**Needs:** Cloudinary

**Source:** `apps/mobile/src/lib/uploadCache.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/lib/recoveryCodes.ts`, `apps/mobile/src/components/OrganizationKYCForm.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/app/campaign/create.tsx`

## GAP3-043 · P2 · Light and dark themes and the four skins across key pages

*Surfaces:* web  ·  *Type:* cross-platform

**Before:** A member account. Browser devtools.

**Steps:**

1. Settings > turn 'Dark mode' on, reload, then sign in on another browser and check it syncs (server darkMode).
2. Set the OS to dark mode and reduced motion, and toggle the theme (the reveal animation should be skipped).
3. In Settings, under 'Dark mode', use the 'Surface style' picker to choose Neumorphism, Claymorphism, Glassmorphism and Minimal in turn; reload after each. Then set localStorage uf_skin to 'bogus' and reload.
4. For each theme and skin, view home, campaign, donate, dashboard, wallet, settings, live watch and leaderboard at 360 px and desktop.

**Expect:** All text and icons meet WCAG AA contrast, with no invisible text or white-on-white. The dark-mode preference persists and syncs. The picker announces '<skin> selected' and the choice persists across reloads. The 'bogus' skin falls back to neumorphism.

**Needs:** none

**Source:** `apps/web/src/context/ColorModeContext.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `packages/ui/src/components/ThemeStylePicker.tsx`, `packages/ui/src/theme.ts`

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

1. Load any page and press Tab once. Activate 'Skip to main content'.
2. With the keyboard only (Tab, Shift+Tab, Enter, Space, Esc), go through the Header ('Ujimora home', 'Search campaigns', 'Account menu', 'Open menu' drawer), Explore filters and cards, the campaign page (share, donate CTA, comments), the leaderboard tabs (Today, This Month, This Year, Lifetime), wallet, My donations, dashboard, and the live watch page ('Watch broadcast').
3. At 360 px, use the bottom nav with a screen reader.
4. Navigate between routes and note where focus lands and what is announced.
5. Leave the live donor feed open for 2 minutes with a screen reader running.

**Expect:** The first Tab shows 'Skip to main content', which moves focus to the main content without changing the URL. Every control is reachable with a visible focus ring in all skins and dark mode. Menus and drawers trap focus and return it on Esc. There are no keyboard traps. Route changes announce the new page (title) and move focus to main content. The live feed's aria-live does not flood the screen reader. Icon buttons have labels.

**Needs:** none

**Source:** `apps/web/src/components/layout/Layout.tsx`, `apps/web/src/components/layout/Header.tsx`, `apps/web/src/components/layout/MobileBottomNav.tsx`, `apps/web/src/pages/LeaderboardPage.tsx`, `apps/web/src/pages/WatchLivePage.tsx`
