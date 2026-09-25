# Creators, organizations & affiliates (92 cases)

Creator pages and tips, withdrawals, organization profiles and teams, invitations, affiliate program.

[Back to the QA plan](../README.md)

## CREATOR-001 · P0 · Free-plan user cannot claim a creator page

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** free1 signed in, no subscription (Community/Free).

**Steps:**

1. Open app.ujimora.com, account menu, 'Creator page' (/creator).
2. Look at the alert and the form fields.
3. With free1's bearer token, POST /api/v1/creators/profile {"handle":"free-one","displayName":"Free One"}.
4. GET /api/v1/creators/me.

**Expect:** Info alert 'Creator donations require an active paid plan...' with a 'View plans' button to /subscription. Handle, Display name, Tagline, About you and 'Accept tips' are disabled, and 'Create my page' is disabled. The API returns 403 'Creator donations require an active paid subscription. Upgrade your plan to enable your creator page.' /creators/me returns profile null and policy {eligible:false, planName:'Community'/Free, feePercent 3.5 or the live value}. No creator_profiles or creator_balances row is created.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `docs/creator-donations.md`

## CREATOR-003 · P0 · Paid creator's first page is held for staff review when screening consent is unchecked

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** creatorA on an active Plus plan with current legal acceptance. Handle 'ama-sings' unused.

**Steps:**

1. Open /creator. The heading reads 'Claim your page'.
2. Enter Handle 'Ama-Sings' (the field lowercases it), Display name 'Ama Mensah', Tagline and About you. Leave 'Use OpenAI to check this public text for safety (optional)' unchecked and 'Accept tips' on.
3. Click 'Create my page'.
4. Check the Publication reviews list shown under the error (or Settings, Publication reviews).
5. In a private window, open /creators/ama-sings.
6. GET /api/v1/creators/me as creatorA.

**Expect:** Error: 'Saved privately for safety review. Your content has not been published...' (HTTP 409). The typed draft stays in the form. A pending creator.profile review is listed. The public URL shows 'Page not found / We couldn't find a creator at @ama-sings'. /creators/me still returns profile null. No creator_balances row exists yet.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `docs/compliance/CREATOR_PUBLICATION.md`

## CREATOR-004 · P0 · Staff approval plus exact resubmission publishes the creator page

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** CREATOR-003 completed. adminB (not creatorA) signed in to the admin console with REPORTS permission.

**Steps:**

1. Admin: Publication reviews. Content queue 'Publication proposals', Review status 'pending'.
2. Open creatorA's creator.profile item. Check that the evidence shows handle, displayName, tagline, bio, tipsEnabled, presetAmounts [10,25,50,100], currency GHS and thankYouMessage.
3. Type fewer than 20 characters of notes: 'Approve this version' stays disabled. Type 20 or more characters and click 'Approve this version'.
4. As creatorA, return to /creator without changing any field and click 'Create my page' again.
5. Open /creators/ama-sings as a guest.
6. As a counter-test, change the tagline before resubmitting on another account.

**Expect:** Approval succeeds and the audit log records publication.approved. Resubmission shows the 'Your creator page is saved' snackbar. The dashboard shows 'Available to withdraw GH₵0', link {origin}/creators/ama-sings with Copy and 'Preview public page'. The public page renders Display name as h1, tagline, 'About Ama', preset buttons GH₵10/25/50/100 plus Custom, and Supporters 0 / Received GH₵0. A creator_balances row now exists in GHS. The changed-tagline counter-test creates a new pending review instead of publishing.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCreatorProfileRepository.ts`

## CREATOR-011 · P0 · 'Pause tips now' works without review, plan or unrestricted status

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** creatorA is live with tipsEnabled. Run once while active, once after the subscription has expired, and once while publishing is restricted.

**Steps:**

1. On /creator, change the tagline field but do not save.
2. Click 'Pause tips now'.
3. Check the form: the tagline draft should still be there.
4. As a guest, open /creators/ama-sings.
5. As a guest, POST /api/v1/creators/ama-sings/tips with a valid body.
6. Via the API, POST /creators/profile {"tipsEnabled":false,"tagline":"x"}.

**Expect:** Snackbar 'Tips paused. Your other draft changes are retained.' The tagline draft is kept and the Pause button disappears. The public form is replaced by 'This creator isn’t accepting tips right now.' The API tip call returns 409 'This creator is not accepting tips right now.' (or 403 if the plan is ineligible). Pause succeeds even when expired or restricted. The combined pause-plus-edit call is treated as a public change and needs a plan and review.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/mobile/app/creator.tsx`

## CREATOR-015 · P0 · Plan downgrade/expiry: page stays readable, tips close, withdrawals still allowed

*Surfaces:* api, web  ·  *Type:* functional

**Before:** creatorA is live with availableBalance GH₵100. Then cancel or expire the subscription (on staging, set currentPeriodEnd to the past).

**Steps:**

1. As a guest, open /creators/ama-sings.
2. As a guest, POST /creators/ama-sings/tips.
3. creatorA opens /creator.
4. creatorA opens Withdraw and checks the fee preview.

**Expect:** The page renders and the form shows 'This creator isn’t accepting tips right now.' The API returns 403 'Creator donations require an active paid subscription...'. The dashboard shows the 'Upgrade to receive new tips. You can still withdraw your existing balance.' alert with fields disabled. Withdraw is enabled and previews the Free plan fee (for example 3.5%: GH₵3.50 fee, GH₵96.50 net).

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetCreatorByHandleUseCase.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `docs/creator-donations.md`

## CREATOR-019 · P0 · Guest tip happy path by card: exact amount, single credit, alerts

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Paystack TEST keys with the webhook configured. creatorA eligible. Record creatorA's creator_balances (availableBalance, totalReceived, platformFees) beforehand.

**Steps:**

1. As a guest, open /creators/ama-sings. Click the preset GH₵25. Email guest1@test.com. Leave name and message empty.
2. Click 'Support GH₵25'.
3. On Paystack checkout, pay with test card 4084 0840 8408 4081 (CVV 408, PIN 0000, OTP 123456).
4. Land on /tip/callback?reference=tip-...
5. Wait for the charge.success webhook.
6. Check /creator as creatorA, reload the public page, and check creatorA's inbox.

**Expect:** Paystack shows GHS 25.00. The callback shows 'Thank you for your support!' and 'GHS 25.00 confirmed for Ama Mensah. <thank-you text or default>', the reference, and a 'Back to Ama Mensah' button. The Tip is SUCCEEDED with settlementApplied=true. Balance changes: availableBalance +25.00, totalReceived +25.00, platformFees +0. Public page: Supporters +1, Received +GH₵25, and recent supporters shows a generic label and amount. creatorA receives the 'You received creator support' in-app alert and email (if enabled). Paystack customer email is guest1@test.com.

**Needs:** Paystack test keys, email provider (Resend)

**Source:** `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`, `apps/web/src/pages/CreatorTipCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## CREATOR-020 · P0 · Guest tip by mobile money with delayed authorization

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Paystack test mode with the Ghana mobile-money channel enabled on the merchant.

**Steps:**

1. Tip GH₵10 and choose Mobile Money on Paystack with the Paystack test MoMo number.
2. Stay on /tip/callback while authorization is pending.
3. Complete authorization.

**Expect:** The callback shows 'Confirming your support…' and 'Please do not pay again while confirmation is pending', then flips to success once the webhook or verify confirms. Balance +10.00, credited once.

**Needs:** Paystack test keys (MoMo channel)

**Source:** `apps/web/src/pages/CreatorTipCallbackPage.tsx`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`

## CREATOR-021 · P0 · Tip amount validation and money precision

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA eligible.

**Steps:**

1. Web: Custom amount 0, then click Support.
2. API: POST amount -5, 0.001 and 12.345.
3. Web: tip 12.34 and check the Paystack amount.
4. Tip 0.10 and 0.20 separately and check the balance delta.
5. API: POST amount 1000000000.

**Expect:** UI: 'Choose an amount.' The API returns 400 for negative or non-0.01-multiple amounts. The 12.34 tip charges exactly 1234 pesewas and credits exactly 12.34. The 0.10 and 0.20 tips together add exactly 0.30 (no float drift). The huge amount is rejected cleanly by Paystack or validation with no 500. Note that a PENDING Tip row is created before Paystack init; decide a server-side maximum tip.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`

## CREATOR-022 · P0 · Public name/message requires current content-terms and 18+ acknowledgement

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** creatorA eligible.

**Steps:**

1. Enter a message only. The MessageAgreement checkbox appears. Click Support without ticking it.
2. Clear the message, enter name 'Kofi', leave 'Show my support anonymously' unchecked, click Support.
3. Name 'Kofi', anonymous ticked, no message: click Support.
4. API: POST with a message but no legalAcceptance.
5. API: POST with legalAcceptance.version set to an old version.
6. Tick the acknowledgement and complete payment.

**Expect:** Steps 1 and 2 show 'Accept the content terms before posting your public name or message.' and no request is sent. Step 3 proceeds with no acknowledgement required. Steps 4 and 5 return 428 'Accept the current content terms and confirm you are at least 18...' with no Paystack init. Step 6 stores messageAgreement {version, acceptedAt} on the Tip.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/messageAgreement.ts`, `apps/web/src/pages/CreatorTipPage.tsx`, `docs/compliance/TIP_CONTENT_REVIEW.md`

## CREATOR-023 · P0 · Idempotent tip checkout: double click, lost response, two tabs

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** creatorA eligible. DevTools open.

**Steps:**

1. Fill the form and double-click 'Support GH₵25'.
2. Fill the same details. After the POST is sent, go offline and reload. Go back online, re-enter identical details and click Support.
3. Open two tabs and submit identical details at the same moment.
4. Inspect localStorage keys 'ujimora:tip-attempt:*'.

**Expect:** One Tip document (reference tip-<sha256>) and one Paystack initialize per attempt, checked in the Paystack dashboard. The Idempotency-Key header is identical across retries. The retry returns the same checkoutUrl. localStorage holds only {key, reference}: no email, name or message.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/tipCheckout.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `docs/compliance/TIP_CHECKOUT_SAFETY.md`

## CREATOR-025 · P0 · Declined card leaves no credit and allows a fresh attempt

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Paystack test mode.

**Steps:**

1. Tip GH₵20 and pay with a Paystack declining test card (or cancel on the Paystack page).
2. Observe /tip/callback.
3. Check the Tip and balance.
4. Start a new tip with different details.

**Expect:** The callback shows 'Payment was not completed' with 'If you see a debit, contact support with your payment reference...'. The Tip is FAILED and the checkout credentials are unset. The creator balance is unchanged. The attempt key is cleared, so the new tip goes through without a 409.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`, `apps/web/src/pages/CreatorTipCallbackPage.tsx`

## CREATOR-027 · P0 · Webhook replay and verify/webhook race credit exactly once

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A SUCCEEDED tip. Access to the Paystack dashboard 'Resend webhook' or to the captured signed payload.

**Steps:**

1. Resend charge.success for the tip reference 3 times.
2. Reload /tip/callback for that reference 5 times.
3. For a new tip, keep the callback open so verify runs while the webhook arrives.
4. Query the creator_balances settledRefs.

**Expect:** Each tip is credited once. settledRefs contains 'tip:<id>:credited' exactly once. availableBalance and totalReceived rise by exactly the tip amount. Paystack receives 200 on each replay.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCreatorBalanceRepository.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`

## CREATOR-028 · P0 · Tip webhook with invalid or missing signature is rejected

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A PENDING tip reference.

**Steps:**

1. POST /api/v1/webhooks/paystack with a charge.success body for that reference and a wrong x-paystack-signature.
2. Repeat with no signature header.

**Expect:** 401 'Invalid webhook signature'. The tip stays PENDING and the balance is unchanged.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## CREATOR-036 · P0 · Processing-fee economics of tips and withdrawals (finance sign-off)

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** creatorA on Plus (3%).

**Steps:**

1. Tip GH₵100 by card.
2. Compare the Paystack transaction fee and settled amount with the creator credit.
3. Withdraw GH₵100 and check the Paystack transfer amount and transfer fee.

**Expect:** The creator is credited 100.00 with platformFees 0 at receipt. Paystack settles about 98.05 (fee absorbed by the platform). The withdrawal records fee 3.00 and transfers 97.00, and the platform also pays the Paystack transfer fee. Finance confirms the net margin and that the legal/pricing copy ('The same platform fee is not also deducted when a new tip is received') matches.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `docs/creator-donations.md`

## CREATOR-037 · P0 · Supporter name/message withheld until staff review

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** creatorA eligible.

**Steps:**

1. Tip with name 'Kofi' and message 'Keep going!' (acknowledged).
2. After success, read the callback alerts.
3. Check the public recent supporters list on web and native.
4. Tip anonymously with a message, then anonymously with no message.

**Expect:** The callback shows 'Your payment is confirmed. Your public name and message are waiting for staff review.' Recent supporters shows 'Supporter · GH₵X' with no message. The anonymous tip shows 'Anonymous' and the message stays hidden until approval. An anonymous tip with no message gets contentReviewStatus 'not_requested' and does not appear in the review queue.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/GetCreatorByHandleUseCase.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`, `docs/compliance/TIP_CONTENT_REVIEW.md`

## CREATOR-038 · P0 · Admin supporter content queue: approve, decline, stale, self-review

*Surfaces:* admin, web  ·  *Type:* compliance

**Before:** adminB. Pending named/message tips. On staging, adminA is creatorA.

**Steps:**

1. Admin Publication reviews, Content queue 'Supporter names and messages' (or open ?queue=tip-content-reviews from the action center).
2. Approve one item with notes of 20 or more characters. Decline another.
3. Try a decision with notes under 20 characters.
4. adminA reviews a tip on their own creator page.
5. Change a tip's message in the DB, then approve using the old version.

**Expect:** Approved: the name and message appear publicly, and the supporter's callback shows 'passed review'. Declined: stays hidden, and the callback shows 'were not approved for display. Contact support@ujimora.com...'. Short notes return 400 'Choose a version and decision, with at least 20 characters of notes.' Self-review returns 403 'Another administrator must review this content.' Stale version returns 409 'The content changed. Refresh before reviewing.' The queue never shows supporter emails. The audit log records tip.content.approved/rejected. Money is unchanged.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/tipContentReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## CREATOR-040 · P0 · Staff hides a reported tip message; the name is requeued

*Surfaces:* admin, web  ·  *Type:* compliance

**Before:** A pending tip_message report from CREATOR-039.

**Steps:**

1. Admin: Safety reports, status pending. Enter notes of 20 or more characters and click 'Hide message'.
2. View the public creator page.
3. Open Publication reviews, 'Supporter names and messages', and approve the remaining name.
4. Compare the creator balance and supporter count before and after.

**Expect:** The report is resolved and the audit log records safety.hide_message. The message is permanently removed and approving the name does not bring it back. The non-anonymous name is requeued as pending. Amounts, supporterCount, totalReceived and balance are unchanged.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## CREATOR-043 · P0 · Creator withdrawal to a verified saved account: happy path and fee math

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** creatorA on Plus (3%) with available GH₵100.00. A name_matched saved account at /payout-accounts. Paystack test Transfers enabled and funded.

**Steps:**

1. On /creator click 'Withdraw'. The amount is prefilled with the full available balance.
2. 'Receive funds in': 'Bank or mobile money'. 'Saved payout account': pick the verified account. Amount 100.
3. Read the info alert.
4. Click 'Withdraw'.
5. Wait for transfer.success and reload /creator.

**Expect:** The alert reads 'Plus transfer fee: 3%. Fee: GH₵3.00 · You receive: GH₵97.00. The full requested amount is deducted from your creator balance.' Snackbar 'Withdrawal started'. The payout is PROCESSING with reference cpay-<id>-xxxxxxxx, then PAID. The Paystack transfer is GHS 97.00 to the saved recipient code. Balances: availableBalance -100, paidOutBalance +97, payoutFees +3. History row: 'Fee GH₵3 · Net transfer GH₵97' with a PAID chip. The withdrawals alert is sent.

**Needs:** Paystack test keys (Transfers), Resend

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/HandleCreatorPayoutWebhookUseCase.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## CREATOR-044 · P0 · Withdrawal fee rounding and UI/API parity

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Plans with 2.5% and 3.5% fees. Enough balance.

**Steps:**

1. Withdraw 33.33 at 2.5%.
2. Withdraw 0.05 at 2.5% and 0.29 at 3.5%.
3. API: amount 10.999.
4. Pick an amount where net would be 0 or less.

**Expect:** 33.33 at 2.5%: fee 0.83, net 32.50, and the UI preview equals the API response. Tiny amounts round the fee to 0.00 (0.05 transfers 0.05); decide on a minimum withdrawal. 10.999 returns 400 'Enter a withdrawal amount.' Net ≤ 0 returns 422 'The withdrawal amount must exceed the fee.'

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## CREATOR-045 · P0 · Stale withdrawal fee consent is rejected before reserving money

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** creatorA with a balance. Admin can edit plans (admin Plans page).

**Steps:**

1. Open the Withdraw dialog (preview 3%).
2. In the admin, change the Plus platformFeePercent from 3 to 4.
3. Click 'Withdraw'.
4. API: POST /creators/withdraw without expectedFeePercent.
5. Reload /creator and withdraw again.

**Expect:** Steps 3 and 4 return 409 'Your withdrawal fee has changed. Refresh your creator dashboard and review the new fee.' Nothing is reserved and the balance is unchanged. After reload the preview shows 4% and the withdrawal succeeds with fee 4%.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-046 · P0 · Withdrawal destination must be a name-matched account

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** One saved account with needs_review status. Paystack resolve returns a real test account name.

**Steps:**

1. Pick the needs_review saved account and click Withdraw.
2. 'Enter a new account': MoMo number plus a name that does not match the resolved name (or leave Account name blank so the display name is used).
3. New account with the exact resolved name.
4. Fill payout accounts up to the plan limit, then add another.

**Expect:** Steps 1 and 2 return 422 'This payout account needs verification. Choose an account with a matched registered name...'. The step-2 account is saved as needs_review. Step 3 goes through and saves the account as name_matched. Step 4 returns 403 'Your <plan> plan allows N payout account(s)...'.

**Needs:** Paystack test keys (resolve account)

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-047 · P0 · Insufficient balance and concurrent withdrawals never overdraw

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA available GH₵50.

**Steps:**

1. Withdraw 60.
2. Amount 0 (the button is disabled). API: amount -5.
3. Send two API withdrawals of 50 at the same moment, each with a different idempotencyKey.

**Expect:** Step 1 returns 400 'Insufficient available balance for this withdrawal.' Negative returns 400. Of the concurrent pair, exactly one succeeds and the other returns 400. The balance is never negative and there is only one transfer.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCreatorBalanceRepository.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-048 · P0 · Withdrawal idempotency key: double tap, replay, missing, foreign

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** creatorA with a balance. Another creator B.

**Steps:**

1. Double-click 'Withdraw' in the dialog.
2. Replay the exact POST (same idempotencyKey) after success.
3. POST without idempotencyKey.
4. As creator B, POST using creatorA's idempotencyKey.

**Expect:** One payout and one transfer. The replay returns the same payout. Missing key returns 422 'A transfer request key is required'. The foreign key returns 409 'This withdrawal request key is unavailable. Start a new withdrawal request.'

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-049 · P0 · Withdrawal transfer failed/reversed webhooks restore funds exactly once

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A PROCESSING cpay- withdrawal of 100 (fee 3), and a PAID one.

**Steps:**

1. Deliver transfer.failed for the PROCESSING payout (Paystack test failure), then replay it.
2. Deliver transfer.reversed for the PAID payout, then replay it.
3. Check the history chips and balances.

**Expect:** Failed: status FAILED and availableBalance +100 (gross, including the fee) once. Reversed: status REVERSED, available +100, paidOutBalance -97, payoutFees -3, once. Replays are no-ops and the alerts fire.

**Needs:** Paystack test keys (Transfers)

**Source:** `apps/api/src/application/use-cases/HandleCreatorPayoutWebhookUseCase.ts`

## CREATOR-051 · P0 · Paystack Transfer Approval URL approves creator withdrawals

*Surfaces:* api  ·  *Type:* functional

**Before:** Paystack Transfer Approval enabled with the URL /api/v1/payouts/paystack-approval. PAYSTACK_APPROVAL_REQUIRE_SIGNATURE as in prod.

**Steps:**

1. Make a creator withdrawal of GH₵50 to a saved account.
2. Watch the API logs for the approval request and the response code.
3. Check the Paystack transfer status.

**Expect:** The approval handler returns 200 (currency GHS, amount = net in pesewas, recipient code matches) and the transfer completes. Watch for a race: CreatorPayout.recipientCode is stored only after initiateTransfer returns, so an early approval call may answer 400 and decline the transfer. If you see declines, fix this before launch.

**Needs:** Paystack test keys (Transfer approval)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-052 · P0 · Withdrawal to Ujimora Wallet

*Surfaces:* api, web  ·  *Type:* functional

**Before:** creatorA on Plus (3%) with available GH₵50.

**Steps:**

1. Withdraw dialog: 'Receive funds in': 'Ujimora Wallet'. Amount 50. Read the info alert.
2. Click 'Withdraw', then double-click on a second attempt using the same form.
3. Open /wallet.
4. Withdraw 60 to the wallet.

**Expect:** Snackbar 'Funds added to your Ujimora Wallet'. The payout is PAID with provider ujimora_wallet, fee 1.50, net 48.50. The wallet GHS balance rises by 48.50 with a ledger entry. Creator available -50. The replay does not double-credit. The over-balance attempt returns 422 'Insufficient available creator balance'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## CREATOR-053 · P0 · Withdrawal/dashboard authorization and history isolation

*Surfaces:* api  ·  *Type:* security/permission

**Before:** creatorA and creatorB, each with payouts.

**Steps:**

1. Logged out: POST /creators/withdraw, GET /creators/me, GET /creators/me/payouts.
2. As creatorB: GET /creators/me/payouts.
3. A user with no creator balance withdraws 10.

**Expect:** 401 for the logged-out calls. creatorB sees only their own payouts. No-balance withdraw returns 400 insufficient.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`

## CREATOR-056 · P0 · iOS/Android: no in-app creator tipping; deep links behave

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Store-candidate builds. creatorA live with tips enabled.

**Steps:**

1. Explore, open a creator (or open https://app.ujimora.com/creators/ama-sings from Notes/WhatsApp).
2. Look at the 'Support <name>' card.
3. Open https://app.ujimora.com/tip/callback?reference=tip-abc12345.
4. As a signed-in user, check the Report and 'Block user' controls on the creator screen.

**Expect:** The universal link opens the native creator screen with profile and stats. The card reads 'Creator tips are not available in this app yet.' There are no amount, email or Support controls, no Paystack or browser launch, and no 'tip on the website' link. The callback link opens a graceful Not Found screen with no crash. Report and Block are present.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/app/creators/[handle].tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`

## CREATOR-057 · P0 · No external purchase steering in native creator/affiliate/org screens

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Store-candidate builds.

**Steps:**

1. Visit Creator page, creator public screen, Affiliate, Organization profile and Organizations.
2. Tap every button and link. Note any URL that leaves the app.
3. Read the affiliate enroll copy and the creator 'Unlock creator donations' copy.

**Expect:** Subscriptions are only reachable through the in-app Subscription tab (IAP). No links to web pricing, subscription checkout or tipping. External links are limited to the org website and share sheets. The copy does not mention buying on the web.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/app/creator.tsx`, `apps/mobile/app/affiliate.tsx`, `apps/mobile/app/organization/[id].tsx`

## CREATOR-063 · P0 · Public member profile endpoint privacy

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** Member M (public). Mp (publicProfile off). Mb, who blocked V. Mc (closed).

**Steps:**

1. As a guest, GET /api/v1/users/<M>/public.
2. GET for Mp, Mc and 'notanid'.
3. As V (token), GET Mb. As Mb, GET V.
4. Check the response headers.

**Expect:** M returns only {id, name, avatarUrl, country, trustScore, verificationLevel, role, createdAt}: no email or phone. Mp, Mc and malformed all return 404 'User not found'. A block in either direction returns 404. Cache-Control is private, no-store. Native /profile/[id] shows 'User not found' for these.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetPublicUserProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userRoutes.ts`

## CREATOR-065 · P0 · Owner invites a teammate; invitee accepts

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** orgOwner (role organization). editor1 account with a verified email.

**Steps:**

1. orgOwner: /profile, then 'Organization workspace & team' (/organization-team).
2. 'Invite a teammate': Email 'Editor1@Test.com', Role 'Editor', click 'Create invitation'.
3. Click 'Copy workspace link'.
4. Check editor1's inbox.
5. editor1 signs in, opens /organization-team, and accepts the 'Invitation to <org>' card.
6. orgOwner reloads 'Team members & invitations'.

**Expect:** Notice: 'Invitation created. Share this workspace link with the recipient; no email has been sent.' No email arrives, so confirm that is the intended launch behaviour. The member row shows 'invited'. editor1 sees the card, accepts, and lands in a workspace with an Editor chip and description. The owner sees 'active'. The invite expires after 7 days.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/OrganizationTeamPage.tsx`

## CREATOR-067 · P0 · Organization team role permission matrix

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** orgOwner with active viewer1, editor1, admin1 and admin2 members. The org has at least one campaign.

**Steps:**

1. As each role, GET /organization-team/<org> and open /organization-team.
2. As each role, POST invitations with role viewer, editor and admin.
3. As each role, PUT members/<id> {role}.
4. As admin1, DELETE members/<editor1> and DELETE members/<admin2>.
5. As each role, PUT /profile and POST campaigns/<c>/updates.

**Expect:** Viewer: sees the workspace and campaigns, members [] hidden, no forms, and every write returns 403. Editor: same, plus 'Publish a campaign update'. Admin: invites viewer/editor; inviting admin returns 403 'Only the owner can invite administrators'; role change returns 403; removing an editor works; removing an admin returns 404 'Member not found or cannot be removed'; identity edit is allowed. Owner: everything, including the role dropdown and removing admins.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/OrganizationTeamPage.tsx`

## CREATOR-068 · P0 · Cross-organization IDOR on team routes

*Surfaces:* api  ·  *Type:* security/permission

**Before:** admin1 is a member of org A only. orgB exists. There is a regular (non-org) user id U.

**Steps:**

1. As admin1, GET, POST, PUT and DELETE on /organization-team/<orgB>/... (detail, invitations, members, profile, updates).
2. As admin1, DELETE /organization-team/<orgA>/members/<memberId from orgB>.
3. GET /organization-team/<U>.
4. GET /organization-team/not-an-id.

**Expect:** Org B calls return 403 'You do not have permission for this organization action'. The cross-member delete returns 404. U returns 404 'Organization not found'. The malformed id returns 404. Nothing changes.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`

## CREATOR-069 · P0 · Revoked member loses access immediately

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** editor1 and admin1 each have the workspace open.

**Steps:**

1. The owner clicks 'Remove access' for editor1. Notice 'Access removed.'
2. editor1 clicks 'Publish update' and refreshes.
3. The owner removes admin1 while admin1 has the identity form open. admin1 clicks 'Save organization details'.
4. GET /organization-team/mine for both.

**Expect:** editor1 gets 403. admin1 gets 403 'You do not have permission for this organization action' or 'You no longer have permission to edit this organization'. Neither lists the org in /mine.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`

## CREATOR-070 · P0 · Team members cannot access org money or campaign ownership actions

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** admin1 and editor1 are active members. The org has a campaign with a balance, a wallet and payout recipients.

**Steps:**

1. As admin1, GET /wallets, request a campaign payout for the org campaign, set its payout recipient, edit the campaign and try a withdraw.
2. As editor1, repeat.

**Expect:** Every call returns 403 or 404, because team roles only grant workspace, identity and updates. This matches the UI copy 'Payouts, wallet funds and ownership remain under the owner’s control.'

**Needs:** None

**Source:** `apps/web/src/pages/OrganizationTeamPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`

## CREATOR-076 · P0 · Referral attribution at web signup

*Surfaces:* api, web  ·  *Type:* functional

**Before:** affiliateA code 'kofi-art' (active). A suspended affiliate code 'susp-code'.

**Steps:**

1. Incognito: open https://app.ujimora.com/?ref=KOFI-ART. Browse, then Register. The Referral code field should be prefilled and editable. Complete signup.
2. affiliateA reloads /affiliate and checks the referrals list and stats.
3. Check that localStorage 'uf_ref' is removed.
4. Sign up with code 'zz' (invalid), with an unknown valid-format code, and with 'susp-code'.
5. Enter affiliateA's own code while registering a second account (a different user).

**Expect:** The referral is 'Pending' and the stats show totalReferrals +1 / pendingReferrals +1. Only the refereeId is exposed: no referee name or email. 'zz' shows a client validation message. The unknown or suspended code lets signup succeed with no referral. The second account IS attributed, because only a same-user self-referral is blocked; note the multi-account abuse risk.

**Needs:** None

**Source:** `apps/web/src/App.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`

## CREATOR-078 · P0 · Commission accrual on the referee's first paid web subscription

*Surfaces:* api, web  ·  *Type:* functional

**Before:** refereeB was referred by affiliateA (pending). AFFILIATE_COMMISSION_PERCENT=10, AFFILIATE_HOLD_DAYS=14. Paystack test keys.

**Steps:**

1. refereeB goes to /subscription and buys Plus monthly with a Paystack test card, with no coupon.
2. The sub- charge.success webhook settles.
3. affiliateA opens /affiliate and checks the commissions ledger and stats.

**Expect:** The referral becomes 'Converted'. There is one commission with status 'Held', amount = 10% of the charged price rounded to 2dp (for example 49.00 gives 4.90), baseAmount = 49.00 and maturesAt = now + 14 days. Balances: pendingBalance +4.90, totalEarned +4.90, Available unchanged. The UI says 'Commission becomes available after its hold window.'

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## CREATOR-079 · P0 · Commission is one-time and replay-safe

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** CREATOR-078 done.

**Steps:**

1. Resend the sub- charge.success webhook 3 times.
2. refereeB renews, and separately upgrades to Pro.
3. For a fresh referee, settle two checkouts at the same moment.

**Expect:** No extra commissions. Each referee has exactly one commission row, and balances change only once.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/AffiliateCommissionService.ts`

## CREATOR-080 · P0 · Affiliate code as a subscription discount at web checkout

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Effective referral discount 10% (env AFFILIATE_REFERRAL_DISCOUNT_PERCENT or the admin Settings override). refereeC is new and not referred. affiliateA is active.

**Steps:**

1. refereeC enters 'kofi-art' in the coupon box on /subscription and previews.
2. Pays. Check the Paystack amount and affiliateA's commission.
3. Negatives: affiliateA uses their own code; refereeB (already converted) uses it; a user referred by affiliate X enters affiliateA's code; a suspended affiliate's code.
4. The admin sets the discount to 0 and refereeC-2 retries.

**Expect:** The preview is valid with discount 4.90 and final 44.10 on a 49.00 plan, and Paystack charges exactly 44.10. The referral is attached to affiliateA. The commission is computed on the undiscounted 49.00, giving 4.90. Every negative gets no discount (unknown code, full price), and X keeps the attribution. At 0% the code behaves as unknown.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/AffiliateCodePricing.ts`, `apps/api/src/application/use-cases/PreviewCouponUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## CREATOR-082 · P0 · IAP subscriptions by referred users do not earn commission

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** refereeD was referred by affiliateA (pending) and subscribes via the App Store sandbox. refereeE does the same via Play test.

**Steps:**

1. Complete the IAP purchases.
2. affiliateA checks /affiliate.

**Expect:** Current code: no commission and the referral stays 'Pending', because the store billing path has no affiliate hook. Launch decision: implement it, or change the web/native copy ('Earn a commission every time someone you refer starts a paid subscription') and the marketing page to state web-only, one-time.

**Needs:** App Store sandbox, Google Play test track

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/mobile/app/affiliate.tsx`, `apps/web/src/pages/AffiliateDashboardPage.tsx`

## CREATOR-083 · P0 · Refund clawback of commission: held, available and paid-out

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Three referees with commissions: one held; one available (use AFFILIATE_HOLD_DAYS=0); one whose affiliate payout is already PAID.

**Steps:**

1. Refund each referee's sub- charge in the Paystack test dashboard (refund.processed).
2. Replay each refund webhook.
3. Check the commission statuses and affiliate balances.

**Expect:** Held: 'Reversed', and pendingBalance and totalEarned drop by the amount. Available: 'Reversed', and availableBalance and totalEarned drop. Paid-out case, current behaviour: the commission still showed 'Available' after the payout and the reversal changes nothing on the balance, with no warning logged. Flag this as a money leak and a misleading ledger. Replays do not double-decrement.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.ts`, `apps/api/src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.ts`

## CREATOR-085 · P0 · Affiliate payout destination registration

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** affiliateA with available balance > 0 and no recipient set.

**Steps:**

1. Look for an 'add payout destination' control on web /affiliate and native Affiliate.
2. Click 'Request payout'.
3. Via the API, POST /api/v1/affiliate/payout-recipient {"type":"mobile_money","accountNumber":"0551234987","bankCode":"MTN","accountName":"Test Name"}.
4. Request the payout again.

**Expect:** Current: no UI exists (neither client library calls /affiliate/payout-recipient), so 'Request payout' fails with 'Add a payout recipient before requesting a payout'. This is a launch blocker for the affiliate program, and the marketing page promises 'Register a payout destination in your dashboard'. The API call returns 201 and payouts then work. Also note there is no name-match verification here, unlike creator withdrawals.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SetAffiliatePayoutRecipientUseCase.ts`, `apps/web/src/lib/affiliate.ts`, `apps/mobile/src/lib/affiliate.ts`, `apps/marketing/src/pages/AffiliateProgramPage.tsx`

## CREATOR-086 · P0 · Request affiliate payout: reservation, double click, limits

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Recipient set via the API. Available GH₵20.00.

**Steps:**

1. Click 'Request payout' (it requests the full available amount).
2. Double-click it quickly on a second run.
3. API: request 25 when 20 is available. Request 0.001.
4. With Paystack unconfigured on staging, request again.

**Expect:** A PENDING payout for 20.00, available becomes 0 (reserved), and the success snackbar shows. The double click creates only one payout, and the second gets 422 'Insufficient available balance to fund this payout'. Over-request returns 422 'Cannot request a payout of GHS 25; only GHS 20 is available for payout.' 0.001 returns 422. Unconfigured returns 501 'Payouts are not configured'.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestAffiliatePayoutUseCase.ts`, `apps/web/src/pages/AffiliateDashboardPage.tsx`

## CREATOR-087 · P0 · Admin approves an affiliate payout; transfer and webhook

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A PENDING affiliate payout. adminA and adminB. Paystack test transfer balance funded.

**Steps:**

1. Admin: Affiliates, 'Payout Queue (n)', Approve.
2. The transfer.success webhook arrives.
3. Two admin tabs approve the same payout at the same moment.
4. Drain the Paystack test balance and approve another payout.
5. A non-admin POSTs /api/v1/affiliates/payouts/<id>/approve.

**Expect:** Snackbar 'Payout approved and transfer initiated'. The payout is PROCESSING with reference aff-<id>-xxxx, then PAID, and paidOutBalance rises by the amount. The second approver gets 409 ('Payout cannot be approved in state PROCESSING' or 'Payout is no longer pending approval'). Low balance returns 422 'Insufficient platform balance to fund this payout' and the payout stays PENDING. Non-admin returns 403. The Transfer Approval URL answers 200 for aff- transfers.

**Needs:** Paystack test keys (Transfers)

**Source:** `apps/api/src/application/use-cases/ApproveAffiliatePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutApproval.ts`, `apps/admin/src/pages/AffiliatesPage.tsx`

## CREATOR-088 · P0 · Affiliate payout failure/reversal and suspended-affiliate stuck funds

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** PROCESSING and PAID aff- payouts. affiliateS has a PENDING payout.

**Steps:**

1. Deliver transfer.failed and transfer.reversed webhooks, and replay each.
2. Admin suspends affiliateS (Edit, Status suspended), then clicks Approve on its PENDING payout.
3. Look for a Reject or Cancel action on PENDING payouts.
4. affiliateS (suspended) requests another payout via the API.

**Expect:** Failed and reversed payouts return funds to available exactly once. Approving the suspended affiliate's payout returns 409 'Affiliate eligibility or destination changed; review the payout again.' There is no reject path, so the reserved funds stay stuck in transit (flag). Suspended affiliates can still create payout requests, because there is no status check (flag).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.ts`, `apps/api/src/application/use-cases/RequestAffiliatePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`

## CREATOR-090 · P0 · Affiliate API authorization

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** affiliateA, a non-enrolled user N, and a non-admin user.

**Steps:**

1. Logged out: GET /api/v1/affiliate, /affiliate/referrals, /affiliate/commissions.
2. As N: GET /affiliate, then open /affiliate in the web app.
3. As the non-admin: GET /affiliates, GET /affiliates/payouts, GET /affiliates/<id>, PUT /affiliates/<id>/status and /commission-rate.

**Expect:** Logged out returns 401. N gets 404 'Not enrolled in the affiliate program' and the web shows the enroll CTA. Non-admin gets 403 on every /affiliates route. The owner routes take no id, so there is no cross-affiliate exposure.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`, `apps/web/src/lib/affiliate.ts`

## CREATOR-002 · P1 · Trialing, expired and past-due subscriptions are not creator-eligible

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** trial1 (status trialing on a paid tier), expired1 (paid tier, currentPeriodEnd in the past), pastdue1 (status past_due).

**Steps:**

1. For each user, GET /api/v1/creators/me.
2. For each user, open /creator and try 'Create my page'.
3. POST /api/v1/creators/profile with a valid handle and display name.

**Expect:** policy.eligible=false for all three. The UI disables the form. The API returns 403 with the paid-subscription message. None of them can create a page or accept tips.

**Needs:** None (seeded subscription states)

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `docs/creator-donations.md`

## CREATOR-005 · P1 · No self-review; declined, stale and expired approvals

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** adminA also has a paid plan and submits their own creator page. adminB is available.

**Steps:**

1. adminA submits a creator page. It is held.
2. adminA opens admin Publication reviews and clicks 'Approve this version' on their own item.
3. adminB clicks 'Decline this version' with notes.
4. adminA resubmits the identical version.
5. adminA edits the tagline and resubmits.
6. adminB tries to decide the already-declined item again with different notes.
7. On staging, set approvalExpiresAt to the past on an approved item, then resubmit that exact version.

**Expect:** Step 2: 403 'Another administrator must review your content'. Step 4: 422 'This version was declined in safety review...'. Step 5: a new pending review. Step 6: 409 'A final decision already exists for this version'. Step 7: 409 'This safety approval expired...'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## CREATOR-006 · P1 · Optional OpenAI screening: clean, flagged and provider-unavailable

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** OPENAI_API_KEY valid. creatorB and creatorC paid. No images on the pages.

**Steps:**

1. creatorB: enter clean text, tick 'Use OpenAI to check this public text for safety (optional)', click 'Create my page'.
2. creatorC: enter an abusive or violent bio, tick consent, submit.
3. On staging, make the OpenAI key invalid, then submit clean text with consent on a third account.
4. Reload /creator and check the consent checkbox state.

**Expect:** Step 1 saves in one request (review auto-approved, reviewedBy 'automated:openai') and the page is public. Step 2 is held with reason 'flagged' and appears in the admin queue. Step 3 is held with reason 'unavailable', with no 500. The consent checkbox is unchecked on every load.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/safety/PublicationConsent.tsx`

## CREATOR-007 · P1 · Creator avatar/cover always go to staff media review

*Surfaces:* admin, android, ios, web  ·  *Type:* compliance

**Before:** creatorA's page is live. Account avatar and cover uploaded at /profile (Cloudinary).

**Steps:**

1. /creator: click 'Use account photo and cover'. Expect the snackbar 'Account images selected. Save your creator page to submit them for review.'
2. Tick OpenAI consent and click 'Save changes'.
3. adminB approves the creator.profile item. Media URLs should be visible.
4. creatorA resubmits unchanged.
5. Later, change the account avatar at /profile and reload /creators/ama-sings.
6. Via the API, POST /creators/profile with avatarUrl 'javascript:alert(1)' and with 'ftp://x/y.png'.
7. Repeat steps 1 to 4 on the native creator screen, using 'Clear images' once.

**Expect:** The save is held even with consent (reason media). The public page keeps its old images until approval, then shows the new avatar and cover. The later account avatar change does NOT change the creator page. Bad URLs return 400. Native mirrors the web behaviour.

**Needs:** Cloudinary

**Source:** `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/mobile/app/creator.tsx`

## CREATOR-008 · P1 · Handle validation, normalization and uniqueness race

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA owns 'ama-sings'. creatorB and creatorC are paid and pre-approved for the versions under test.

**Steps:**

1. As creatorC, submit handles 'ab', '-bad', 'has space', a 31-character handle, and display name 'A'.
2. Submit 'UPPER_Case'.
3. Submit '@ama-sings'.
4. In two browsers, creatorB and creatorC submit the same new handle 'duo-test' at the same moment (both with approved versions).

**Expect:** Invalid inputs return 400 'A valid handle and display name are required.' 'UPPER_Case' is stored as 'upper_case'. '@ama-sings' returns 409 'That handle is already taken.' In the race, exactly one save succeeds and the other returns 409 ('That handle is already taken.' or 'That handle was claimed or your page changed. Reload and review the current page.').

**Needs:** None

**Source:** `apps/api/src/domain/entities/CreatorProfile.ts`, `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`

## CREATOR-010 · P1 · Strict payload validation on POST /creators/profile

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** creatorA token.

**Steps:**

1. POST with an unknown field {"role":"admin"}.
2. POST currency 'USD'.
3. POST presetAmounts [0], [1.005], [-1], and 7 amounts.
4. POST bio of 5,001 characters, tagline of 201, thankYouMessage of 1,001.
5. POST displayName of 101 characters.

**Expect:** Every request returns 400 (strict zod). There are no 500s and no database changes.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`

## CREATOR-012 · P1 · Re-enabling tips requires review and an active paid plan

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** creatorA paused (CREATOR-011).

**Steps:**

1. Turn 'Accept tips' on and click 'Save changes' without consent.
2. adminB approves. Resubmit.
3. Expire creatorA's plan and try to re-enable again.

**Expect:** The first save is held for review. After approval and resubmission, the public tip form returns. With an expired plan the switch is disabled in the UI and the API returns 403.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`

## CREATOR-014 · P1 · Legal agreement gate on creator publication

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Paid creator whose legalAcceptance version is older than the current one.

**Steps:**

1. Submit a public creator change (approved version).
2. Accept the current agreement at /account-agreement.
3. Resubmit.

**Expect:** The first attempt returns 428 'Accept the current account agreement before publishing'. After acceptance the save succeeds.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCreatorProfileRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## CREATOR-016 · P1 · Native creator dashboard with IAP-based eligibility

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** TestFlight / Play internal builds. iosCreator subscribed to Plus through the App Store sandbox, androidCreator through a Play test purchase, and a separate free user.

**Steps:**

1. Profile tab, then Creator page (app/creator.tsx).
2. Free user: 'Unlock creator donations', then 'View plans'.
3. Paid (IAP) user: fill the fields and tap 'Create my page'. Expect a review hold. adminB approves. Resubmit.
4. Tap the Share button next to the link.
5. Tap the preview button, which opens the in-app creator screen.

**Expect:** 'View plans' opens the in-app Subscription tab with store products only, with no web pricing link. The IAP subscription makes policy.eligible true. The hold, approval and resubmit flow matches the web. The handle cannot be edited after creation. The share sheet contains https://app.ujimora.com/creators/<handle>.

**Needs:** App Store sandbox, Google Play test track

**Source:** `apps/mobile/app/creator.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## CREATOR-017 · P1 · Public creator page content, caching and privacy (guest)

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** creatorA is live with a few tips (some approved content, some pending).

**Steps:**

1. While logged out, open /creators/ama-sings with DevTools open.
2. Inspect the GET /api/v1/creators/ama-sings response body and headers.
3. View the page title and meta description.
4. Check for Report and Block buttons.

**Expect:** The response contains only the public fields: userId, handle, displayName, tagline, bio, avatarUrl, coverUrl, tipsEnabled, presetAmounts, currency, thankYouMessage, supporterCount, totalReceived and recentTips (id, supporterName, amount, and message only when approved). There are no supporter emails and no balances. Header Cache-Control is 'private, no-store'. The title is 'Support Ama Mensah | Ujimora'. Guests see no Report or Block controls. The copy says 'Your email is private'.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetCreatorByHandleUseCase.ts`, `apps/web/src/pages/CreatorTipPage.tsx`

## CREATOR-018 · P1 · Not-found, restricted, closed and error states of creator page

*Surfaces:* android, ios, web  ·  *Type:* negative/edge

**Before:** A restricted creator (ContentRestriction), a closed-account creator, and the ability to force an API 500 or drop the network.

**Steps:**

1. Open /creators/doesnotexist.
2. Open the restricted creator's handle.
3. Open the closed creator's handle.
4. Open a valid handle with the API blocked (offline).

**Expect:** Nonexistent, restricted and closed all show 'Page not found / We couldn’t find a creator at @x' (404). The network error shows 'Something went wrong' with a 'Try again' button that recovers once the network is back. Native shows equivalent 'Page not found' / 'Something went wrong'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/web/src/pages/CreatorTipPage.tsx`, `apps/mobile/app/creators/[handle].tsx`

## CREATOR-024 · P1 · Changing tip details after an abandoned checkout (stale attempt key)

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA eligible.

**Steps:**

1. Start a GH₵25 tip and reach Paystack. Close the tab without paying and without visiting the callback.
2. Return to /creators/ama-sings, choose GH₵50 and click Support.
3. Retry with identical GH₵25 details.
4. Visit /tip/callback?reference=<old ref> and wait for Paystack to report abandoned or failed, then try GH₵50 again.

**Expect:** Step 2 currently returns 409 'This checkout request key was already used for different details.' and the UI offers no way to reset. File a bug or confirm the support path. Step 3 reuses the original checkout URL. Step 4 marks the old tip FAILED, clears the key, and the new GH₵50 tip then works.

**Needs:** Paystack test keys

**Source:** `apps/web/src/lib/tipCheckout.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`

## CREATOR-026 · P1 · Callback polling states: pending, stopped, missing reference

*Surfaces:* web  ·  *Type:* functional

**Before:** A PENDING tip reference.

**Steps:**

1. Open /tip/callback?reference=<pending ref> and wait about 60 seconds (20 polls, 3 seconds apart).
2. Click 'Keep checking'.
3. Open /tip/callback with no query.

**Expect:** 'Confirming your support…' changes to 'Still confirming your support' with a 'Keep checking' button that restarts polling. The page is noindex. With no reference: 'Payment reference missing'.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/CreatorTipCallbackPage.tsx`

## CREATOR-029 · P1 · Tip verify endpoint input, privacy and rate limiting

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A known SUCCEEDED tip reference.

**Steps:**

1. POST /api/v1/creators/tips/verify {"reference":"abc"}.
2. POST {"reference":"tip-00000000"} (unknown).
3. POST the valid reference from a different, unauthenticated browser.
4. Send 50 or more verify requests quickly.

**Expect:** 'abc' returns 400. Unknown returns 404 'Payment reference not found'. The valid reference returns only {status, amount, currency, handle, displayName, thankYouMessage, contentReviewStatus}: no email, supporter name or message. The burst hits the rate limit (429).

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`

## CREATOR-030 · P1 · Signed-in supporter tip: attribution and activity alerts

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** supporterS signed in with a verified email. Activity alerts enabled for donationsSent (S) and creatorTips (creatorA).

**Steps:**

1. S tips GH₵10 with name, message and acknowledgement.
2. Check S's notifications and email, and creatorA's.
3. creatorA turns off the creatorTips email in Settings, then S tips again.

**Expect:** Tip.supporterUserId = S. S gets 'Your creator support is confirmed'. creatorA gets 'You received creator support' linking to /creator. After opting out, creatorA gets no email (in-app only, per preference).

**Needs:** Paystack test keys, Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`

## CREATOR-032 · P1 · Blocking between supporter and creator

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** supporterS signed in. creatorA has an approved message from supporterX.

**Steps:**

1. S clicks 'Block user' on /creators/ama-sings.
2. S reloads the page.
3. S POSTs /creators/ama-sings/tips while signed in.
4. S signs out and views the page as a guest.
5. A viewer who blocked supporterX views the creator page.
6. S opens Settings, Blocked users, and unblocks creatorA. Then test a mutual block where only one side unblocks.

**Expect:** Step 1 shows 'User blocked. Manage blocked users in Settings.' with 'Open settings'. Steps 2 and 3 return 404 'Creator not found'. As a guest the page is visible (by design). supporterX's name and message are hidden for that viewer while totals stay unchanged. After unblocking the page is visible again. A mutual block stays hidden until both sides unblock.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicProfileVisibility.ts`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/web/src/components/safety/BlockedUsers.tsx`

## CREATOR-033 · P1 · Checkout issued before creator loses eligibility still settles

*Surfaces:* api, web  ·  *Type:* functional

**Before:** creatorA eligible.

**Steps:**

1. As a guest, start a GH₵15 tip and stop on the Paystack page.
2. Expire creatorA's subscription on staging.
3. Complete the payment.
4. As another guest, start a new tip.

**Expect:** The in-flight tip is credited (+15.00) after the webhook. The new checkout is refused with 403. The public page shows tips disabled.

**Needs:** Paystack test keys

**Source:** `docs/creator-donations.md`, `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`

## CREATOR-034 · P1 · Reconciliation repairs a SUCCEEDED but uncredited tip; lost-webhook PENDING tips

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with DB access. Admin token.

**Steps:**

1. Pick a SUCCEEDED tip. Set settlementApplied=false, remove its settledRef, subtract its amount from availableBalance, and backdate updatedAt by more than 30 minutes.
2. POST /api/v1/admin/reconciliation (or wait for the 5-minute production sweep).
3. Run it again.
4. Create a tip that Paystack marks paid while webhooks are disabled, and never open its callback. Run reconciliation.

**Expect:** The summary shows tipsRepaired ≥ 1, the balance is credited once, and the second run changes nothing. The lost-webhook PENDING tip is NOT repaired by the sweep; only a supporter visiting /tip/callback triggers verification. Write a support runbook or add pending-tip reconciliation.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/app.ts`

## CREATOR-035 · P1 · Tip refund or chargeback does not debit creator balance

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** A SUCCEEDED tip credited to creatorA.

**Steps:**

1. Refund the tip from the Paystack test dashboard so refund.processed is delivered.
2. Check the Tip status, creator_balances and the webhook response.

**Expect:** Webhook acknowledged with no 500. Currently the tip status and the creator balance are unchanged, because only sub- refunds are handled. Decide a policy before launch (manual debit, hold withdrawal, or implement a clawback) and document it for support and finance.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## CREATOR-039 · P1 · Reporting a supporter message

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** An approved message on creatorA's page. Signed-in viewer V. The supporter's own account S.

**Steps:**

1. As V, click 'Report' under the message. The dialog 'Report a safety concern' opens. Choose a reason. Type a description under 10 characters ('Send report' disabled), then 10 or more and send.
2. Report the same message again.
3. As S, report their own message via the API.
4. Report a pending (unapproved) tip via the API with targetType tip_message.
5. As a guest, look for the Report button.

**Expect:** The first report gets 201 and the caption 'Report received for moderation review.' The duplicate returns the same pending report id (upsert). Own content returns 400 'You cannot report your own account or comment'. An unapproved or hidden message returns 404 'Message not found'. Guests see no Report button.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/web/src/components/safety/ReportContent.tsx`

## CREATOR-041 · P1 · Report creator profile and restrict publishing; restore

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Viewer V signed in. creatorA live with a balance.

**Steps:**

1. V clicks 'Report' in the creator header (target 'user'). Reason fraud. Send.
2. Admin: Safety reports. Check that the evidence includes the user name, displayName, tagline and bio.
3. Click 'Restrict publishing' with notes.
4. Open /creators/ama-sings as a guest. Try a guest tip.
5. creatorA tries to save a profile edit, then 'Pause tips now', then a withdrawal.
6. Admin restores: POST /admin/safety-reports/restrictions/<userId>/restore with notes.

**Expect:** The report is created and the reporter's identity is not shown to creatorA. After the restriction the public page and tip return 404. The profile save returns 403 'Publishing is restricted. Contact support@ujimora.com to appeal.' Pause succeeds and the withdrawal is still allowed. After restore the page is visible again. Audit entries are recorded.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`

## CREATOR-042 · P1 · Account closure effects: supporter, creator with balance, org owner

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** supporterS with an approved named tip. creatorA with availableBalance > 0. orgOwner with active members.

**Steps:**

1. S: Settings, Delete account.
2. creatorA: Delete account while a balance remains.
3. orgOwner: Delete account.
4. Check the public pages, the directory and the DB.

**Expect:** S's tips become Anonymous and their checkout credentials are revoked; creator totals are unchanged. creatorA's page returns 404 and the creator_balances row is kept, but check for a warning or guard. Currently there is none, so define a support process for unpaid creator or affiliate balances. The org disappears from /organizations, members are revoked and organization.profile drafts are deleted.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`

## CREATOR-050 · P1 · Ambiguous transfer initiation and stuck PROCESSING reconciliation

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging where Paystack /transferrecipient or /transfer can be made to fail or time out (bad key, proxy, or an empty transfer balance).

**Steps:**

1. Force recipient creation to fail, then withdraw.
2. Force /transfer to time out after being sent, then withdraw and retry with the same key.
3. Run POST /api/v1/admin/reconciliation/payouts (or wait for the sweep).

**Expect:** Recipient failure: rollback to FAILED, funds returned, 502 'Could not start the withdrawal. Please try again.' Transfer ambiguity: the payout stays PROCESSING with funds reserved, the retry returns the same payout, and there is no second transfer. Reconciliation settles it to PAID or FAILED with the correct balance effect, applied once.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`

## CREATOR-054 · P1 · Native creator withdrawals (iOS/Android)

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Native creator with a balance and a saved verified account.

**Steps:**

1. app/creator.tsx, 'Withdrawals', Withdraw. Enter an amount and check the fee preview.
2. Pick the saved account, submit, and confirm in web /creator history.
3. New account: type 'MTN' in 'Network (e.g. MTN)'. Then try 'Vodafone'.
4. Kill the app mid-request, reopen and retry.

**Expect:** Fee and net match the web and the API. The payout appears on the web. 'MTN', 'VOD' and 'ATL' work. 'Vodafone' fails with a clear provider error. The retry reuses the idempotency key with no duplicate. Money-out is allowed in store builds.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/creator.tsx`, `apps/mobile/src/lib/creators.ts`

## CREATOR-055 · P1 · Creator withdrawal KYC policy check

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Paid creator with no approved KYC and a name-matched payout account.

**Steps:**

1. Receive a tip, then withdraw to a bank or MoMo account.

**Expect:** Currently allowed: only payout-name matching is enforced and there is no KYC gate. Get compliance sign-off (READINESS C13 lists creator consumers as open) or add a KYC requirement before launch.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `docs/compliance/READINESS.md`, `docs/reviews/pricing-and-creator-donations-2026-09-09.md`

## CREATOR-058 · P1 · Organization directory visibility and verified badge

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Orgs: orgVerified (institutional level plus approved, unexpired business KYC), orgUnverified, orgExpiredKYB, orgPrivate (publicProfile off), orgRestricted, orgClosed. Viewer V has blocked orgUnverified.

**Steps:**

1. As a guest, open /organizations and the native Organizations screen.
2. As V, open /organizations.
3. GET /api/v1/organizations.

**Expect:** Only active, public, unrestricted orgs with an organizationName appear. The verified badge shows only on orgVerified, not on orgExpiredKYB. orgUnverified is hidden for V. Web and native match. The response has no emails.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoOrganizationRepository.ts`, `apps/web/src/pages/OrganizationsPage.tsx`, `apps/mobile/app/organizations.tsx`

## CREATOR-059 · P1 · Organization profile page: data, links and totals accuracy

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** orgVerified with campaigns in active, funded, draft, pending and rejected states. A second org with an identical name. More than 100 campaigns platform-wide on staging if possible.

**Steps:**

1. Open /organizations/<id> and /organizations/<slug>.
2. Check that the Campaigns grid includes only public statuses.
3. Click Website (it should open a new tab) and Share (snackbar 'Link copied to clipboard!').
4. Open the slug shared by the two same-named orgs.
5. Compare totalRaised and campaignCount on the profile with the directory card.
6. Open /organizations/unknown.

**Expect:** The profile shows name, logo/cover, stats, impact statement and public campaigns only. The slug of duplicate names resolves to one org (the newest), so document or fix. Directory totals are computed client-side from the first 100 campaigns and can differ from profile totals; totals across currencies are summed without conversion, so check. Unknown shows ItemNotFound with 'Back'. Native org screen stats match.

**Needs:** None

**Source:** `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/web/src/pages/OrganizationsPage.tsx`, `apps/api/src/domain/entities/Organization.ts`, `apps/mobile/app/organization/[id].tsx`

## CREATOR-061 · P1 · Org owner changes logo/cover; review and visibility

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** orgOwner signed in. admin1 member. Cloudinary configured.

**Steps:**

1. On /organizations/<ownId> click 'Change cover', upload and save. Repeat with 'Change logo'.
2. View as a guest.
3. adminB approves the account.profile media review. Retry the save.
4. Sign in as admin1 or editor1 and open the org profile.
5. Native: 'Edit organization profile and images'.

**Expect:** The images go to staff media review before appearing publicly. After approval, 'Image updated.' and the new images show. Team members and other users do not see the 'Change cover'/'Change logo' buttons. Native routes the owner to profile/edit.

**Needs:** Cloudinary

**Source:** `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `docs/compliance/ACCOUNT_PUBLICATION.md`

## CREATOR-062 · P1 · Report and Block on org and member profiles (native) plus web parity

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Signed-in user V. orgVerified. Member M with a public profile.

**Steps:**

1. Native: open /organization/<id>, tap Report (user target) and send. Tap 'Block user'.
2. Native: open /profile/<M id>, tap Report and 'Block user'.
3. Native Settings, Blocked users: both are listed. Unblock one.
4. Web: open /organizations/<id> and look for Report/Block.

**Expect:** Native reports return 201. Blocking shows 'User blocked.' and hides the profile. The list and unblock work. Web org profile currently has no Report or Block. STORE_SUBMISSION says profiles have Report/Block, so confirm that native-only is acceptable or add them to the web.

**Needs:** None

**Source:** `apps/mobile/app/organization/[id].tsx`, `apps/mobile/app/profile/[id].tsx`, `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/mobile/STORE_SUBMISSION.md`

## CREATOR-064 · P1 · Block management edge cases

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** User V.

**Steps:**

1. PUT /api/v1/safety/blocks/<V own id>.
2. PUT with a nonexistent 24-hex id.
3. PUT with 'abc'.
4. Block, then DELETE /safety/blocks/<id> twice.
5. Mutual block: A blocks B and B blocks A. A unblocks. A views B's profile.

**Expect:** Self returns 400 'Choose another user to block'. Nonexistent returns 404. Malformed returns 400. The double unblock is idempotent. In the mutual case A still gets 404 until B also unblocks.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoUserBlockRepository.ts`

## CREATOR-066 · P1 · Invitation acceptance and creation guards

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Invites for: an unverified-email user, an expired invite (expiresAt set in the past), and a revoked member.

**Steps:**

1. The unverified user accepts.
2. Another account POSTs /organization-team/invitations/<id>/accept for someone else's invite.
3. The expired invite is accepted. The owner's list shows its status.
4. Accept a valid invite twice.
5. The owner re-invites the expired and revoked emails.
6. The owner invites their own org email, then an already-active member.

**Expect:** Unverified returns 403 'Verify your email before accepting an organization invitation'. Wrong account returns 404 'Invitation unavailable or expired' and the invite is not shown in its /mine. Expired returns 404 and the list shows 'expired'. The second accept returns 404. Re-invites create a fresh 7-day invite. Own email returns 409 'The owner already has full access'. Active member returns 409 'This member already has access...'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`

## CREATOR-071 · P1 · Editor publishes a campaign update through the workspace

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** editor1 active. adminB available.

**Steps:**

1. 'Publish a campaign update': choose Campaign, Update title 'Week 2 progress', 'Message to supporters'. Leave consent unchecked. Click 'Publish update'.
2. adminB approves the update.create review.
3. editor1 resubmits the identical content.
4. Open the campaign page.
5. API: POST with a campaignId that does not belong to the org, and with title 'ab'.

**Expect:** The first attempt is held with the 'Saved privately for safety review...' message. After approval: 'Campaign update published under your name.' The update appears on the campaign with author editor1. A foreign campaign returns 404 'Campaign not found'. A short title returns 400 'Please check the entered details'.

**Needs:** OpenAI (optional consent path)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`

## CREATOR-072 · P1 · Organization identity (name/website) edit with review and fencing

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** orgOwner and admin1. adminB. The org has current legal acceptance.

**Steps:**

1. The owner edits 'Organization name' and 'Website' to https://ngo.example with consent unchecked. Click 'Save organization details'.
2. adminB approves the organization.profile item. The owner resubmits.
3. Check /organizations/<id>, the directory and the audit log.
4. Website 'ftp://x' or 'javascript:alert(1)'. Name 'A'.
5. Restrict the org (ContentRestriction), then save.
6. Set the org's legalAcceptance to outdated, then save.
7. admin1 and the owner save different approved edits at the same time.

**Expect:** Held, then approved, then saved. The public name and website update and the audit log records organization.profile.updated. Invalid input returns 400 'Please check the entered details'. Restricted returns 403 'Publishing for this organization is restricted'. Outdated agreement returns 428. In the race one wins and the other gets 409 'The organization changed during review. Reload its current details before retrying.'

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `docs/compliance/ORGANIZATION_IDENTITY.md`

## CREATOR-074 · P1 · Enroll in the affiliate program (web and native)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** affiliateA signed in and not enrolled. PUBLIC_WEB_URL set to the production or staging web origin.

**Steps:**

1. Web /affiliate (account menu 'Affiliate', or Dashboard 'Invite Friends'). Double-click 'Join the affiliate program'.
2. Reload the page.
3. Native: Profile, Affiliate, then 'Join the affiliate program'. Use Share.
4. Logged out, open /affiliate.

**Expect:** Exactly one affiliate record, with a lowercase auto code. The referral link is `<PUBLIC_WEB_URL>?ref=<code>` and must not be localhost. Stat cards Total Earned / Available / Pending / Paid Out show GHS 0.00. Native shows the same code, and the share sheet contains the link. Logged out redirects to login.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/EnrollAffiliateUseCase.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/web/src/pages/AffiliateDashboardPage.tsx`, `apps/mobile/app/affiliate.tsx`

## CREATOR-075 · P1 · Custom referral code rules and retirement of the old code

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** affiliateA enrolled with a referral. affiliateB has code 'taken-one'.

**Steps:**

1. Click the pencil 'Edit referral code'. Try 'ab', a 25-character code, 'My Code', '-abc', 'a--b', 'ujimora', 'admin' and 'taken-one'.
2. Enter the current code and save.
3. Enter 'kofi-art' and save. Check the link preview.
4. Register a new user with the OLD code.
5. Check the existing referrals and commissions.

**Expect:** Client and API show 'Use at least 3 characters.', 'Use at most 24 characters.', invalid characters, and reserved words (422). Taken returns 409 'That code is already taken. Try another.' The same code is a no-op. The new link uses ?ref=kofi-art. The old code no longer attributes signups. Existing referrals and commissions are kept.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/UpdateAffiliateReferralCodeUseCase.ts`, `packages/types/src/referralCode.ts`, `apps/web/src/pages/AffiliateDashboardPage.tsx`

## CREATOR-077 · P1 · Referral attribution on native via deep links

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** App installed, with universal links / app links configured.

**Steps:**

1. Tap https://app.ujimora.com/?ref=kofi-art from WhatsApp, then open Register.
2. Tap https://app.ujimora.com/register?ref=kofi-art.
3. On Register, type 'kofi-art' manually and complete signup.

**Expect:** Expected: the Referral code field is prefilled. Likely actual: it is empty, because resolveNativePath maps /register to /(auth)/register without the query and the root ?ref= is not forwarded. File a bug if so. Manual entry attributes the referral correctly.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/(auth)/register.tsx`

## CREATOR-081 · P1 · Commission base with admin coupons (LIST_PRICE vs post-coupon)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Two admin coupons of 20%: one with commissionBase LIST_PRICE, one default. Two referred users.

**Steps:**

1. Each referred user subscribes with one coupon.
2. Compare the commission amounts.

**Expect:** LIST_PRICE coupon: commission = 10% of the list price. Default coupon: commission = 10% of the discounted charged amount. Both rounded to 2dp.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## CREATOR-084 · P1 · Commission maturity and concurrent dashboard loads

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** AFFILIATE_HOLD_DAYS=0 (or held commissions backdated). affiliateA has 2 or more held commissions of equal amount.

**Steps:**

1. Open /affiliate in two tabs at the same moment (or fire two GET /affiliate calls together).
2. Check each commission's status against pendingBalance and availableBalance.
3. Leave another affiliate's matured commission alone without visiting the dashboard, and check the admin affiliate detail.

**Expect:** availableBalance = sum of matured commissions, pendingBalance = 0, and every matured commission is 'Available' with none stuck 'Held'. Note that the batch maturity job is never scheduled (it is only on app.locals), so unvisited affiliates show stale 'Held' in the admin until they log in.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/api/src/application/use-cases/MatureAffiliateCommissionsUseCase.ts`, `apps/api/src/main.ts`

## CREATOR-089 · P1 · Admin commission-rate override and suspend/activate

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** affiliateA active with a pending referral.

**Steps:**

1. Admin: Affiliates, pencil 'Edit <code>'. Set Commission Rate 15 and save. The referee subscribes.
2. Set the rate to 0 and have another referee subscribe.
3. Try -1 and 101.
4. Set Status suspended. A new referee converts, uses the code at checkout, and signs up with the code.
5. Reactivate.

**Expect:** Commission is 15% at rate 15, and the platform default of 10% at rate 0. Out-of-range values return 422. While suspended: no commission, the code gives no discount, and signups are not attributed; existing balances are untouched. After reactivation accrual resumes.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SetAffiliateCommissionRateUseCase.ts`, `apps/api/src/application/use-cases/UpdateAffiliateStatusUseCase.ts`, `apps/admin/src/pages/AffiliatesPage.tsx`

## CREATOR-091 · P1 · Affiliate and creator marketing and in-app copy matches behaviour

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Production config values known (AFFILIATE_* envs and admin commercial config).

**Steps:**

1. Read ujimora.com/affiliates: 10%, one-time on the first paid subscription, 14-day hold, 'Register a payout destination in your dashboard', 'refund within hold reverses'.
2. Read the web and native enroll copy.
3. Read the features page creator copy (paid plan required, fee on withdrawal).

**Expect:** Every claim matches config and flows. Known mismatches to fix before launch: 'every time' vs one-time, IAP subscriptions earning nothing (CREATOR-082), and no payout-destination UI (CREATOR-085). The creator fee copy matches docs/creator-donations.md.

**Needs:** None

**Source:** `apps/marketing/src/pages/AffiliateProgramPage.tsx`, `apps/marketing/src/data/features.ts`, `render.yaml`

## CREATOR-092 · P1 · Support can investigate creator tips, balances and withdrawals

*Surfaces:* admin  ·  *Type:* functional

**Before:** A support admin. A supporter who reports 'debited but tip still pending' with a tip- reference. A creator reporting a stuck withdrawal.

**Steps:**

1. Search the tip reference in admin Payments, Donations and Users, then open the user detail.
2. Look for the creator balance and creator withdrawal history in admin (Payouts, Wallets, Users).
3. Try POST /admin/payments/<id>/reconcile using the tip reference.

**Expect:** Current: the admin console has no view of creator tips, creator balances or cpay- withdrawals (only the supporter-content queue), and payment reconcile covers donation intents only. Confirm a support runbook (Paystack dashboard, DB access, or supporter callback link) or add admin views before launch.

**Needs:** None

**Source:** `apps/admin/src/router.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## CREATOR-009 · P2 · Handle locked in UI; API-only handle change, preset amounts and thank-you message

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** creatorA's page is live.

**Steps:**

1. Web /creator: try to edit the Handle field. Native: the same.
2. Via the API, POST /creators/profile {"handle":"ama-new"}. Take it through review and approval, then resubmit.
3. Open /creators/ama-sings and /creators/ama-new.
4. Via the API, POST presetAmounts [5,15] and thankYouMessage 'Medaase!' through review and resubmission.
5. Tip and view /tip/callback.

**Expect:** The UI does not allow editing the handle. After an approved API change, the old URL returns 404 and the new one works. Decide before launch whether to block handle changes server-side or add a redirect, since QR codes and shared links will break. Balance and tips stay intact. The public page shows GH₵5/GH₵15 presets and the callback shows 'Medaase!'. Note that no web or native UI edits presets or the thank-you message.

**Needs:** None

**Source:** `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`

## CREATOR-013 · P2 · Concurrent edits and session fencing on creator save

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** creatorA's page is live. Two browser tabs open on /creator.

**Steps:**

1. Tab 1: save an approved change.
2. Tab 2, still on the old revision: save a different approved change.
3. In another browser, change creatorA's password (this rotates authVersion), then click Save in the original tab.

**Expect:** Tab 2 never silently overwrites tab 1. It gets either a fresh review hold (the base version changed) or 409 'Your creator page changed during review. Reload and retry.' The password-change case returns 401 'Your session ended. Sign in again before saving.'

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCreatorProfileRepository.ts`

## CREATOR-031 · P2 · Creator tipping their own page

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA signed in.

**Steps:**

1. Open own /creators/ama-sings. UserSafetyControls should be hidden.
2. Complete a GH₵10 tip to self.
3. Withdraw it.

**Expect:** There is currently no self-tip guard, so the tip succeeds with 0 fee at receipt and the plan fee applies at withdrawal. Get a product/compliance decision: allow it (and accept the Paystack fee cost), or block it with a 4xx.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`

## CREATOR-060 · P2 · Web org profile 'Follow' button is cosmetic

*Surfaces:* web  ·  *Type:* functional

**Before:** Any org profile.

**Steps:**

1. Click 'Follow'. It changes to 'Following'.
2. Reload the page.
3. Check the Followers stat.

**Expect:** The state resets on reload and Followers is always 0 (followerCount is hard-coded). Before launch, remove the button or implement following, to avoid misleading UI.

**Needs:** None

**Source:** `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`

## CREATOR-073 · P2 · Native organization identity editor and team parity

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** orgOwner and an invited member on native builds.

**Steps:**

1. orgOwner: Profile, then Edit (profile/edit), then the organization identity editor. Edit the name. Test the held draft, consent and review history.
2. The invited member looks for the invitation on native (the Invitations screen and Profile).

**Expect:** The identity editor follows the same review flow. Team management and org invitation acceptance are not available natively (web only). Confirm this is acceptable and that there is no link steering users out.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/src/components/OrganizationIdentityEditor.tsx`, `apps/mobile/app/profile/edit.tsx`, `docs/compliance/ORGANIZATION_IDENTITY.md`
