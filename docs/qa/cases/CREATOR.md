# Creators, organizations & affiliates (106 cases)

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

## CREATOR-021 · P0 · Tip amount validation, GHS 10,000 cap and money precision

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA eligible.

**Steps:**

1. Web: Custom amount 0, then click Support.
2. API: POST /api/v1/creators/ama-sings/tips with amount -5, then 0.001, then 12.345.
3. Web: tip 12.34 and check the Paystack amount.
4. Tip 0.10 and 0.20 separately and check the balance delta.
5. API: POST amount 10000, then 10000.01, then 1000000000.
6. API as creatorA: POST /creators/profile with presetAmounts [50, 10000.01].

**Expect:** UI: 'Choose an amount.' The API returns 400 'Validation failed' for negative amounts and amounts that are not multiples of 0.01. The 12.34 tip charges exactly 1234 pesewas and credits exactly 12.34. The 0.10 and 0.20 tips together add exactly 0.30 (no float drift). 10000 opens a checkout (201). 10000.01 and 1000000000 return 400 'Validation failed' before any Tip row is written or Paystack is called, so no PENDING row is left behind. A preset above 10,000 is rejected with 400. Behind the schema, the use case also refuses with 422 'A single tip can be at most GHS 10,000.' The owner should confirm the GHS 10,000 cap.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/web/src/pages/CreatorTipPage.tsx`

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

## CREATOR-025 · P0 · Declined card leaves no credit and allows a fresh attempt; a cancelled checkout stays pending

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Paystack test mode.

**Steps:**

1. Tip GH₵20 and pay with a Paystack declining test card.
2. Observe /tip/callback.
3. Check the Tip and the balance.
4. Start a new tip with different details.
5. In a fresh private window, start a GH₵20 tip, click Cancel on the Paystack page (or close it), then open /tip/callback?reference=<ref> and wait about 60 seconds.

**Expect:** Step 2: 'Payment was not completed' with 'This attempt was not successful. If you see a debit, contact support with your payment reference before trying again.' Step 3: the Tip is FAILED, its checkout credentials are unset, and the creator balance is unchanged. Step 4: the attempt key was cleared, so the new tip goes through without a 409. Step 5: Paystack reports an opened-but-unpaid checkout as 'abandoned', and that no longer fails the tip. The callback shows 'Confirming your support…', then 'Still confirming your support' with 'Keep checking'. The Tip stays PENDING with no credit, and the reconciliation sweep marks it FAILED once it is more than 24 hours old (CREATOR-034).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`, `apps/web/src/pages/CreatorTipCallbackPage.tsx`, `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`

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

**Before:** creatorA on Plus (3%) with a verified email, current identity KYC and a name_matched saved account. Paystack test transfer balance funded.

**Steps:**

1. Tip GH₵100 by card.
2. Compare the Paystack transaction fee and settled amount with the creator credit.
3. Withdraw GH₵100 and check the Paystack transfer amount, the transfer fee and the completion alert.

**Expect:** The creator is credited 100.00 with platformFees 0 at receipt. Paystack settles about 98.05; the platform absorbs the fee. The withdrawal records fee 3.00 and transfers 97.00, and the platform also pays the Paystack transfer fee, which Ujimora does not record. The 'Your withdrawal is completed' alert says 'GHS 97.00 was sent after GHS 3.00 in fees.' Finance confirms the net margin and that the legal/pricing copy ('The same platform fee is not also deducted when a new tip is received') matches. Known open issue I048: the policy on Paystack processing fees for tips (and donor fee disclosure) is still an open product decision.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/creator-donations.md`

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

## CREATOR-043 · P0 · Creator withdrawal to a verified saved account: happy path, fee math and alerts

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** creatorA on Plus (3%) with available GH₵100.00, a verified email and current identity KYC (approved and unexpired, verificationLevel ≥ 2). A name_matched saved account at /payout-accounts. Paystack test Transfers enabled, with a test transfer balance of at least GH₵97.

**Steps:**

1. On /creator click 'Withdraw'. The amount is prefilled with the full available balance.
2. 'Receive funds in': 'Bank or mobile money'. 'Saved payout account': pick the verified account. Amount 100.
3. Read the info alert.
4. Click 'Withdraw'.
5. Wait for transfer.success and reload /creator. Check the notifications and email.

**Expect:** The alert reads 'Plus transfer fee: 3%. Fee: GH₵3.00 · You receive: GH₵97.00. The full requested amount is deducted from your creator balance.' Snackbar 'Withdrawal started'. The payout is PROCESSING with reference cpay-<id>-xxxxxxxx; the saved recipient code is already on the row before the transfer is sent. It then becomes PAID. The Paystack transfer is GHS 97.00 to the saved recipient code. Balances: availableBalance -100, paidOutBalance +97, payoutFees +3. History row: 'Fee GH₵3 · Net transfer GH₵97' with a PAID chip. Alerts: 'Your withdrawal is processing', then 'Your withdrawal is completed' with 'The GHS 100.00 request is completed. GHS 97.00 was sent after GHS 3.00 in fees. Open your payout history for fees, net amount and the latest status.' (in-app, and email if enabled).

**Needs:** Paystack test keys (Transfers), Resend

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/HandleCreatorPayoutWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## CREATOR-044 · P0 · Withdrawal fee rounding, GHS 5 minimum and UI/API parity

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Plans with 2.5% and 3.5% fees. Enough balance. Current identity KYC and a name_matched saved account. Paystack test balance funded.

**Steps:**

1. Withdraw 33.33 at 2.5%.
2. Withdraw 5.00 at 2.5%.
3. Withdraw 4.99 in the web dialog, and 0.05 and 0.29 via the API.
4. Choose 'Ujimora Wallet' and withdraw 4.00.
5. API: amount 10.999.

**Expect:** 33.33 at 2.5%: fee 0.83, net 32.50, and the UI preview equals the API response. 5.00 at 2.5%: fee 0.13, net 4.87. Step 3: 422 'The minimum withdrawal is GHS 5.' with nothing reserved; the web dialog lets you type the amount and shows the API error. Step 4: the same 422, because the minimum also applies to wallet transfers. 10.999 returns 400 'Enter a withdrawal amount.' A fee-charging plan can no longer round its fee to 0.00. The guard messages ('This amount is too small to withdraw with your plan’s fee. Enter a larger amount.' and 'The withdrawal amount must exceed the fee.') cannot be reached at GHS 5 or more with the seeded plan fees. The owner should confirm the GHS 5 minimum.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## CREATOR-045 · P0 · Stale withdrawal fee consent is rejected before reserving money

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** creatorA with a balance, a verified email, current identity KYC and a name_matched saved account (needed for the final successful withdrawal). An admin can edit plans (admin Plans page).

**Steps:**

1. Open the Withdraw dialog (preview 3%).
2. In the admin, change the Plus platformFeePercent from 3 to 4.
3. Click 'Withdraw'.
4. API: POST /creators/withdraw without expectedFeePercent.
5. Reload /creator and withdraw again.

**Expect:** Steps 3 and 4 return 409 'Your withdrawal fee has changed. Refresh your creator dashboard and review the new fee.' This check runs before the KYC and balance checks, so nothing is reserved and the balance is unchanged. After the reload the preview shows 4% and the withdrawal succeeds with a 4% fee.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-046 · P0 · Withdrawal destination must be a name-matched account

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** creatorA with a balance, a verified email and current identity KYC. One saved account with needs_review status. You know the name Paystack resolves for a test number (e.g. 'KWAME MENSAH').

**Steps:**

1. Pick the needs_review saved account and click Withdraw.
2. 'Enter a new account': MoMo number plus a different person's name ('Kofi Boateng').
3. 'Enter a new account' with another number and the resolved name in surname-first order ('Mensah Kwame').
4. Fill payout accounts up to the plan limit, then add another.

**Expect:** Steps 1 and 2 return 422 'The name the bank or telco holds for this account did not match the account name you entered. Choose an account whose name matched before withdrawing creator funds.' The step-2 account is saved as needs_review, and its card reads 'Name not matched: creator withdrawals need a matched account'. Step 3 is accepted, because name order no longer matters: the account is saved as name_matched and the withdrawal goes through. Step 4 returns 403 'Your <plan> plan allows N payout account(s). Remove an unused account or upgrade.'

**Needs:** Paystack test keys (resolve account)

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/domain/services/payoutNameMatch.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/web/src/components/account/PayoutAccountCard.tsx`

## CREATOR-047 · P0 · Insufficient balance and concurrent withdrawals never overdraw

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA available GH₵50, with a verified email, current identity KYC and a name_matched saved account. The Paystack test transfer balance covers the net amount, otherwise every attempt returns 503.

**Steps:**

1. Withdraw 60.
2. Amount 0 (the button is disabled). API: amount -5.
3. Send two API withdrawals of 50 at the same moment, each with a different idempotencyKey.

**Expect:** Step 1 returns 400 'Insufficient available balance for this withdrawal.' Negative returns 400 'Enter a withdrawal amount.' Of the concurrent pair, exactly one succeeds and the other returns 400. The balance never goes negative and there is only one transfer.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCreatorBalanceRepository.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-048 · P0 · Withdrawal idempotency key: double tap, replay, missing, foreign

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** creatorA with a balance, a verified email, current identity KYC and a name_matched saved account. Another creator B. Paystack test balance funded.

**Steps:**

1. Double-click 'Withdraw' in the dialog.
2. Replay the exact POST (same idempotencyKey) after success.
3. POST without idempotencyKey.
4. As creator B, POST using creatorA's idempotencyKey.

**Expect:** One payout and one transfer. The replay returns the same payout. A missing key returns 422 'A transfer request key is required' before any other check. The foreign key returns 409 'This withdrawal request key is unavailable. Start a new withdrawal request.'

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

## CREATOR-051 · P0 · Paystack Transfer Approval URL approves creator withdrawals (recipient committed before the transfer)

*Surfaces:* api  ·  *Type:* functional

**Before:** Paystack Transfer Approval enabled in test mode with the URL /api/v1/payouts/paystack-approval. PAYSTACK_APPROVAL_REQUIRE_SIGNATURE as in prod (true). creatorA with current identity KYC and a name_matched saved account. DB access.

**Steps:**

1. Make a creator withdrawal of GH₵50 to a saved account.
2. While the transfer is in flight, inspect the creatorpayouts row.
3. Watch the API logs for the approval request and the response code.
4. Check the Paystack transfer status.
5. Make three more withdrawals in quick succession.
6. Send an unsigned approval request to the URL.

**Expect:** The row is PROCESSING with both providerRef (cpay-...) and recipientCode set before POST /transfer; transferCode appears afterwards. The approval handler returns 200 (currency GHS, amount = net in pesewas, recipient code matches) and every transfer completes. No approval is declined, including callbacks that arrive while POST /transfer is still in flight. The unsigned request is refused and logged with signaturePresent:false. Note: Transfer Approval is not currently enabled on the Paystack dashboard; if it is turned on, run this case before launch.

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

## CREATOR-053 · P0 · Withdrawal/dashboard authorization, history isolation and check order

*Surfaces:* api  ·  *Type:* security/permission

**Before:** creatorA and creatorB, each with payouts. userN has no creator balance and no KYC. userK has no creator balance but has current identity KYC and a name_matched saved account. Paystack test balance funded.

**Steps:**

1. Logged out: POST /creators/withdraw, GET /creators/me, GET /creators/me/payouts.
2. As creatorB: GET /creators/me/payouts.
3. As userN: POST /creators/withdraw {"amount":10,"expectedFeePercent":<policy fee>,"idempotencyKey":"<uuid>","savedAccountId":"<any>"}.
4. As userK: the same request with their own saved account.

**Expect:** 401 for the logged-out calls. creatorB sees only their own payouts. Step 3 returns 409 'Verify your identity, or renew an expired verification, before withdrawing creator funds to a bank or mobile-money account.' (KYC is checked before the balance). Step 4 returns 400 'Insufficient available balance for this withdrawal.' No payout rows are created.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`

## CREATOR-056 · P0 · iOS/Android: no in-app creator tipping; creator links behave

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Store-candidate builds. creatorA live with tips enabled.

**Steps:**

1. In the app, open a creator (via Explore, or open ujimora://creators/ama-sings).
2. Look at the 'Support <name>' card.
3. Open ujimora://tip/callback?reference=tip-abc12345.
4. As a signed-in user, check the Report and 'Block user' controls on the creator screen.
5. Tap https://app.ujimora.com/creators/ama-sings from Notes or WhatsApp.

**Expect:** The native creator screen opens with profile and stats. The card reads 'Creator tips are not available in this app yet.' There are no amount, email or Support controls, no Paystack or browser launch, and no 'tip on the website' link. The callback link opens a graceful Not Found screen with no crash. Report and Block are present. Step 5: the https link must never open an in-app tip flow; today it opens the web page in the browser. Known open issue I152: universal links / App Links are not configured (no associatedDomains or assetlinks). The planned apple-app-site-association excludes /creators/* so tipping stays on the web.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/app/creators/[handle].tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app.json`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`

## CREATOR-057 · P0 · No external purchase steering in native creator, affiliate, org and invitation screens

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Store-candidate builds. An org owner account and a member account.

**Steps:**

1. Visit Creator page, creator public screen, Affiliate, Organization profile, Organizations and Invitations (as the org owner).
2. Tap every button and link. Note any URL that leaves the app.
3. Read the affiliate enroll copy and the creator 'Unlock creator donations' copy.

**Expect:** Subscriptions are only reachable through the in-app Subscription tab (IAP). There are no links to web pricing, subscription checkout or tipping. Only these leave the app: the org website, share sheets, and, for org owners and admins, the Invitations button 'Manage your organization team on the website', which opens <EXPO_PUBLIC_WEB_URL>/organization-team (team management, no purchase). The affiliate 'Add or manage accounts' button stays in the app (/payout-accounts). No copy invites users to buy on the web. The affiliate enroll text now says the commission applies to a referral's 'first paid plan on the Ujimora website'. It is informational, with no link or button, but review it against App Store guideline 3.1.1 before submission.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/app/creator.tsx`, `apps/mobile/app/affiliate.tsx`, `apps/mobile/app/organization/[id].tsx`, `apps/mobile/src/components/OrganizationInvitations.tsx`, `apps/mobile/src/components/AffiliatePayoutDestination.tsx`

## CREATOR-063 · P0 · Public member profile endpoint privacy

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** Member M (public). Mp (publicProfile off). Mb, who blocked V. Mc (closed). An admin account A.

**Steps:**

1. As a guest, GET /api/v1/users/<M>/public, then GET /api/v1/users/<A>/public.
2. GET for Mp, Mc and 'notanid'.
3. As V (token), GET Mb. As Mb, GET V.
4. Check the response headers.
5. Native: open /profile/<Mp id> and /profile/<Mb id> as V.

**Expect:** M returns only {id, name, avatarUrl, country, trustScore, verificationLevel, createdAt}: no email, phone or role, so staff accounts cannot be identified (A's response also has no role). Mp, Mc and malformed ids return 404 'User not found'. A block in either direction returns 404. Cache-Control is 'private, no-store'. Native shows 'This profile is not available.' and still offers Report and 'Block user' for a valid 24-character id.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetPublicUserProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userRoutes.ts`, `apps/mobile/app/profile/[id].tsx`

## CREATOR-065 · P0 · Owner invites a teammate (in-app notice, no email); invitee accepts

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** orgOwner (role organization) on a plan with a free team seat (Pro = 3 seats including the owner, Organization = 10). editor1 is an existing account with a verified email.

**Steps:**

1. orgOwner: /profile, then 'Organization workspace & team' (/organization-team).
2. 'Invite a teammate': Email 'Editor1@Test.com', Role 'Editor', click 'Create invitation'.
3. Click 'Copy workspace link'.
4. Check editor1's email inbox and the in-app notification bell.
5. Invite an email address that has no account.
6. editor1 signs in, opens /organization-team, and accepts the 'Invitation to <org>' card.
7. orgOwner reloads 'Team members & invitations'.

**Expect:** Notice: 'Invitation created. If the recipient already has an account, it appears in their notifications; no email has been sent, so also share this workspace link with them.' editor1 gets an in-app notification 'Organization invitation': '<Org> invited you to its team as editor. Accept it in Organization workspace & team within seven days.' It links to /organization-team. No email arrives. Step 5 gets the identical response with no notification, so it does not reveal whether an account exists. The member row shows 'invited'. editor1 accepts and lands in a workspace with an Editor chip and description. The owner sees 'active'. The invite expires after 7 days. Known open issue I181: invitation emails are not sent (owner decision).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/OrganizationTeamPage.tsx`

## CREATOR-067 · P0 · Organization team role permission matrix

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** orgOwner on the Organization plan (10 seats including the owner), with active viewer1, editor1, admin1 and admin2 members. The org has at least one campaign.

**Steps:**

1. As each role, GET /organization-team/<org> and open /organization-team.
2. As each role, POST invitations with role viewer, editor and admin.
3. As each role, PUT members/<id> {role}.
4. As admin1, DELETE members/<editor1> and DELETE members/<admin2>.
5. As each role, PUT /profile and POST campaigns/<c>/updates.

**Expect:** Viewer: sees the workspace and campaigns, members [] hidden, no forms, and every write returns 403. Editor: the same, plus 'Publish a campaign update'. Admin: invites viewer/editor; inviting admin returns 403 'Only the owner can invite administrators'; role change returns 403; removing an editor works; removing an admin returns 404 'Member not found or cannot be removed'; identity edit is allowed. Owner: everything, including the role dropdown and removing admins. Invitations from any role count against the plan's seats (see CREATOR-N008).

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

**Expect:** The referral is 'Pending' and the stats show totalReferrals +1 / pendingReferrals +1. Only the refereeId is exposed: no referee name or email. For 'zz' the field shows 'Use at least 3 characters.' The requirement is that an optional referral code never blocks signup (the invalid code is skipped). The unknown or suspended code lets signup succeed with no referral. The second account IS attributed, because only a same-user self-referral is blocked; note the multi-account abuse risk. Known open issue I025: the web RegisterForm still submits the invalid code, so the API returns 400 'Validation failed' and signup is blocked until the field is cleared. Native is fixed.

**Needs:** None

**Source:** `apps/web/src/App.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`

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

## CREATOR-082 · P0 · IAP subscriptions by referred users earn no commission, and all copy says so

*Surfaces:* android, api, ios, marketing, web  ·  *Type:* compliance

**Before:** refereeD was referred by affiliateA (pending) and subscribes via the App Store sandbox. refereeE does the same via a Play test purchase.

**Steps:**

1. Complete the IAP purchases.
2. affiliateA checks /affiliate and native Affiliate.
3. Read the enroll copy (web and native, logged in but not enrolled), the empty commissions state and the ujimora.com/affiliates FAQ.

**Expect:** No commission is created and both referrals stay 'Pending'; a later web purchase by the same person could still convert. Copy matches this: web and native enroll say 'Earn a one-time commission when someone you refer buys their first paid plan on the Ujimora website.' The empty state says 'You'll earn a one-time commission when a referred member buys their first paid plan on the Ujimora website.' The marketing FAQ says 'Plans bought through the App Store or Google Play are not eligible.' No copy says 'every time'. Known open issue I061: whether store purchases should earn commission is an open owner decision (no store commission hook exists).

**Needs:** App Store sandbox, Google Play test track

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/mobile/app/affiliate.tsx`, `apps/web/src/pages/AffiliateDashboardPage.tsx`, `apps/marketing/src/pages/AffiliateProgramPage.tsx`

## CREATOR-083 · P0 · Refund clawback of commission: held, available and paid-out

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Three referees with commissions: one held; one available (use AFFILIATE_HOLD_DAYS=0); one whose affiliate payout is already PAID (commission shows 'Paid out'). API log access.

**Steps:**

1. Before refunding, check the paid-out referee's commission on /affiliate.
2. Refund each referee's sub- charge in the Paystack test dashboard (refund.processed).
3. Replay each refund webhook.
4. Check the commission statuses, the affiliate stats and GET /affiliate.
5. Try to request a payout for the affected affiliate.

**Expect:** Step 1: the paid commission shows 'Paid out', not 'Available'. Held: 'Reversed'; pendingBalance and totalEarned drop by the amount. Available: 'Reversed'; availableBalance and totalEarned drop. Paid-out: 'Reversed'; totalEarned drops, and the amount is recorded as clawbackOutstanding. The API logs 'affiliate commission reversed after its funds left the unwindable bucket; recorded as outstanding clawback'. The dashboard 'Available' figure is reduced by the outstanding clawback (never below 0), and payout requests withhold it. Replays do not double-decrement. A refund that races maturity or a payout still ends 'Reversed' and unwound. The subscription refund also ends the referee's paid plan time (see CREATOR-N014).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.ts`, `apps/api/src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`

## CREATOR-085 · P0 · Affiliate payout destination: choose a name-matched saved account (web and native)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** affiliateA enrolled with available balance > 0 and no destination set. At /payout-accounts: one name_matched account and one needs_review account. affiliateB enrolled with no matched accounts.

**Steps:**

1. Web /affiliate: look at the 'Available to withdraw' card.
2. Try 'Request payout'.
3. Open 'Saved payout account' and try to pick the unmatched account. Pick the matched one and click 'Use this account'.
4. Reload the page.
5. affiliateB opens /affiliate.
6. API: POST /api/v1/affiliate/payout-recipient {"savedAccountId":"<needs_review id>"}, then raw details {"type":"mobile_money","accountNumber":"<test number>","bankCode":"MTN","accountName":"<name that does not match>"}, then {"savedAccountId":"not-a-uuid"}.
7. Native Affiliate screen: repeat steps 1 to 4.
8. Click 'Request payout'.

**Expect:** Before a destination is set, a 'Payout destination' section is shown, 'Request payout' is disabled, and the hint reads 'Choose a payout destination before requesting a payout.' The unmatched account is listed with '(name not matched)' and cannot be chosen. After 'Use this account', the card reads 'Payouts go to <name> · <institution> · ••<last4>' with 'Change payout destination', and 'Request payout' is enabled. affiliateB sees 'Add a bank or mobile-money account whose name matches the account holder, then choose it here.' and an 'Add or manage payout accounts' link to /payout-accounts. API: the unmatched saved or typed account returns 422 'The name the bank or telco holds for this account did not match the account name you entered. Choose an account whose name matched to receive affiliate payouts.' (the typed account is saved as needs_review). A malformed id returns 400. A matched account returns 201 'Payout recipient saved'. Native shows radio options; unmatched accounts are listed as '<name> · <last4> — name not matched, cannot receive payouts', and 'Add or manage accounts' opens the in-app payout accounts screen. The payout request succeeds (PENDING). More than 20 destination changes in 15 minutes return 429.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SetAffiliatePayoutRecipientUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`, `apps/web/src/components/affiliate/AffiliatePayoutDestination.tsx`, `apps/web/src/pages/AffiliateDashboardPage.tsx`, `apps/mobile/src/components/AffiliatePayoutDestination.tsx`, `apps/mobile/app/affiliate.tsx`

## CREATOR-086 · P0 · Request affiliate payout: full-balance reservation, double click, limits, suspension

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** affiliateA active with a destination set (CREATOR-085) and available GH₵20.00. Paystack configured.

**Steps:**

1. Double-click 'Request payout' (it requests the full available amount).
2. API: POST /api/v1/affiliate/payouts {"amount":10} while 20 is available (fresh balance).
3. API: request 25 when 20 is available. Request 0.001.
4. With Paystack unconfigured on staging, request again.
5. Admin suspends affiliateA. affiliateA requests via the API.

**Expect:** Step 1: the button shows 'Requesting…' and is disabled. One PENDING payout for 20.00 is created, available becomes 0 (reserved), the available commissions are linked to the payout, and the snackbar reads 'Payout requested — you'll be notified once it's processed.' Any second request returns 422 ('Cannot request a payout of GHS 20; only GHS 0 is available for payout.' or 'Insufficient available balance to fund this payout'). Step 2: 422 'Affiliate payouts withdraw your full available balance of GHS 20. Refresh and try again.' Step 3: 422 'Cannot request a payout of GHS 25; only GHS 20 is available for payout.'; 0.001 returns 422 'Payout amount must be greater than zero'. Step 4: 501 'Payouts are not configured'. Step 5: 403 'Your affiliate account is suspended, so payouts are unavailable.' and nothing is reserved.

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

## CREATOR-088 · P0 · Affiliate payout failure/reversal, suspended affiliate and reject path

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** PROCESSING and PAID aff- payouts. affiliateS has a PENDING payout. adminB.

**Steps:**

1. Deliver transfer.failed and transfer.reversed webhooks, and replay each.
2. Admin suspends affiliateS (Edit, Status suspended), then clicks Approve on its PENDING payout.
3. Click 'Reject' on that PENDING payout, enter a reason of 20 or more characters and confirm.
4. affiliateS (suspended) requests another payout via the API.

**Expect:** Failed and reversed payouts return funds to available exactly once, and their linked commissions go back to 'Available'. Approving the suspended affiliate's payout returns 409 'Affiliate eligibility or destination changed; review the payout again.' Reject closes it: the payout is FAILED, the reservation returns to available exactly once, the snackbar reads 'Payout rejected; the funds are back in the affiliate’s available balance', and the audit log records affiliate_payout.rejected with the reason. The suspended affiliate's new request returns 403 'Your affiliate account is suspended, so payouts are unavailable.' No funds are stranded in transit.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.ts`, `apps/api/src/application/use-cases/RejectAffiliatePayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestAffiliatePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutApproval.ts`, `apps/admin/src/pages/AffiliatesPage.tsx`

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

## CREATOR-N001 · P0 · Tip settlement never credits a charge whose amount or currency differs from the tip; tip references are unpredictable

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Paystack test keys, and the webhook secret available so test payloads can be signed. creatorA eligible. Access to API logs and the DB.

**Steps:**

1. As a guest, start a GH₵50 tip with an Idempotency-Key K (via the API) and note the returned tip- reference. Do not pay.
2. POST /api/v1/webhooks/paystack with a correctly signed charge.success for that reference, data.amount 100 (GH₵1.00) and currency GHS.
3. Repeat with data.amount 5000 and currency 'NGN'.
4. Open /tip/callback?reference=<ref>.
5. Complete the real GH₵50 payment on Paystack.
6. Compute sha256(JSON.stringify([creatorUserId,'guest',K])) and compare it with the reference. Then repeat the POST with the same K and the same details.

**Expect:** Steps 2 and 3 return 200 but credit nothing. The tip stays PENDING and the API logs 'tip settlement mismatch — not crediting; left for manual review' with the expected and provider amounts. Step 4 shows 'Confirming your support…'. If verify ever finds a paid charge that does not match, the callback shows 409 'Payment details could not be matched. Please contact support with your reference.' Step 5: the genuine charge credits exactly GH₵50, once. Step 6: the reference is not the plain sha256, because it is keyed with a server secret and cannot be computed in advance, but the same K still returns the same reference and checkout. Owner note: rotating JWT_SECRET orphans in-flight tip request keys.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`

## CREATOR-N005 · P0 · Admin rejects a PENDING affiliate payout and the reserved funds return

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** affiliateA with a destination set and a PENDING payout of GH₵20 (available 0). adminB with AFFILIATES update permission, with a second admin tab open on the Payout Queue. A non-admin token and a PROCESSING aff- payout.

**Steps:**

1. Admin: Affiliates, 'Payout Queue (n)'. On the PENDING row click 'Reject'.
2. Type a reason under 20 characters, then 20 or more, and click 'Reject payout'.
3. In the second tab (opened before step 2), click Reject, then Approve, on the same payout.
4. affiliateA reloads /affiliate.
5. API: POST /api/v1/affiliates/payouts/<id>/reject with a 10-character reason; as a non-admin; and on the PROCESSING payout.
6. affiliateA requests a new payout.

**Expect:** The dialog 'Reject affiliate payout?' reads '<GH₵20.00> returns to the affiliate's available balance. No transfer is sent.', with the helper 'At least 20 characters; recorded in the audit log.' 'Reject payout' stays disabled under 20 characters. After rejecting: the snackbar reads 'Payout rejected; the funds are back in the affiliate’s available balance', the payout is FAILED, no Paystack transfer is made, and the audit log records affiliate_payout.rejected with the reason. Step 3: Reject returns 409 'Payout is no longer pending; refresh before trying again.' and Approve returns 409 ('Payout cannot be approved in state FAILED' or 'Payout is no longer pending approval'). Step 4: Available shows GH₵20.00 again, returned exactly once, and the linked commissions are 'Available'. Step 5: the short reason returns 400 'Validation failed', the non-admin gets 403, and the PROCESSING payout returns 409. Step 6 succeeds.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RejectAffiliatePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutClosureTransaction.ts`, `apps/admin/src/pages/AffiliatesPage.tsx`

## CREATOR-N007 · P0 · The affiliate commission ledger follows the payout: 'Paid out' on success, back to 'Available' on failure or reversal

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** affiliateA with two available commissions (e.g. 4.90 and 9.80) and a destination set. affiliateB and affiliateC in the same state. adminB. Paystack test transfers, with the ability to trigger or replay transfer.failed and transfer.reversed.

**Steps:**

1. affiliateA requests a payout (full 14.70) and checks the Commissions list.
2. adminB approves; transfer.success arrives. affiliateA reloads /affiliate.
3. Replay transfer.success.
4. affiliateB: request, approve, then deliver transfer.failed. Reload.
5. affiliateC: request, approve, transfer.success, then transfer.reversed. Reload.

**Expect:** Step 1: the payout is PENDING, Available is 0, and the two commissions are linked to the payout and still show 'Available'. Step 2: both commissions show 'Paid out' and the Paid Out stat rises by 14.70. Step 3 changes nothing. Step 4: the payout is FAILED, 14.70 returns to Available once, the commissions show 'Available' and can be requested again. Step 5: the payout is REVERSED, the funds return to Available once, and the commissions go from 'Paid out' back to 'Available'. The admin affiliate detail matches.

**Needs:** Paystack test keys (Transfers)

**Source:** `apps/api/src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAffiliateCommissionRepository.ts`, `apps/api/src/application/use-cases/RequestAffiliatePayoutUseCase.ts`, `apps/web/src/pages/AffiliateDashboardPage.tsx`

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

## CREATOR-005 · P1 · No self-review; declined and stale versions; an expired approval is re-queued instead of blocking

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** adminA also has a paid plan and submits their own creator page. adminB is available. Staging DB access for steps 7 and 10.

**Steps:**

1. adminA submits a creator page. It is held.
2. adminA opens admin Publication reviews and clicks 'Approve this version' on their own item.
3. adminB clicks 'Decline this version' with notes.
4. adminA resubmits the identical version.
5. adminA edits the tagline and resubmits.
6. adminB tries to decide the already-declined item again with different notes.
7. On staging, take an approved creator.profile item whose owner left 'Use OpenAI to check this public text for safety (optional)' unchecked, set its approvalExpiresAt to the past, then resubmit that exact version from /creator.
8. Open admin Publication reviews (pending) and find the same item.
9. adminB approves it again with 20+ characters of notes; the creator resubmits the same version.
10. Repeat step 7 on another account with clean text and the OpenAI consent box ticked.

**Expect:** Step 2: 403 'Another administrator must review your content'. Step 4: 422 'This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.' Step 5: a new pending review. Step 6: 409 'A final decision already exists for this version'. Step 7: the expired approval no longer returns 'This safety approval expired'. The same review record is re-queued and the save returns 409 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.' Nothing is published. Step 8: the item is back in the pending queue and its earlier decision (reviewer, notes, expiry) is cleared. Step 9: the resubmission publishes the page. Step 10: the re-queued version is screened by OpenAI again and, if clean, publishes in the same request (reviewedBy 'automated:openai'). An expired approval never publishes without a fresh decision.

**Needs:** OpenAI (step 10)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## CREATOR-006 · P1 · Optional OpenAI screening: clean, flagged and provider-unavailable (unavailable is logged)

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** OPENAI_API_KEY valid. creatorB and creatorC are paid. The pages have no images. Access to the API logs on staging.

**Steps:**

1. creatorB: enter clean text, tick 'Use OpenAI to check this public text for safety (optional)', click 'Create my page'.
2. creatorC: enter an abusive or violent bio, tick consent, submit.
3. On staging, make the OpenAI key invalid, then submit clean text with consent on a third account.
4. Check the API logs and the admin Publication reviews card for the step-3 item.
5. Restart the staging API with NODE_ENV=production and OPENAI_API_KEY unset, and read the startup log.
6. Reload /creator and check the consent checkbox state.

**Expect:** Step 1 saves in one request (review auto-approved, reviewedBy 'automated:openai') and the page is public. Step 2 is held with reason 'flagged' and appears in the admin queue. Step 3 is held with reason 'unavailable': the user gets 409 'Saved privately for safety review...' and there is no 500. Step 4: the API logs a warning 'Publication screener unavailable; routed to staff review' with the fingerprint and action creator.profile, and the staff card shows reason 'unavailable'. Step 5: the API still starts, and logs the error 'OPENAI_API_KEY missing: publication screening disabled; opted-in submissions go to staff review'. Step 6: the consent checkbox is unchecked on every load. Ops: confirm OPENAI_API_KEY is set on Render (render.yaml notes that it also powers safety screening).

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/app.ts`, `apps/web/src/components/safety/PublicationConsent.tsx`, `render.yaml`

## CREATOR-007 · P1 · Creator avatar/cover: new images need staff media review, only Ujimora-hosted images are accepted, and clearing is immediate

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** creatorA's page is live and has no creator images. The account avatar and cover were uploaded at /profile through Ujimora (Cloudinary, the configured cloud) and approved. adminB is available.

**Steps:**

1. /creator: click 'Use account photo and cover'. Expect the snackbar 'Account images selected. Save your creator page to submit them for review.'
2. Tick OpenAI consent and click 'Save changes'.
3. adminB approves the creator.profile item. The media URLs should be visible.
4. creatorA resubmits unchanged.
5. Later, change the account avatar at /profile and reload /creators/ama-sings.
6. Via the API, POST /creators/profile with avatarUrl 'javascript:alert(1)', 'ftp://x/y.png', 'https://example.com/a.png', 'http://res.cloudinary.com/<cloud>/image/upload/a.png', and a res.cloudinary.com URL under a different cloud name.
7. Click 'Clear images', then 'Save changes'.
8. Repeat steps 1 to 4 and step 7 on the native creator screen.

**Expect:** Step 2 is held even with consent (reason media). The public page keeps its old images until approval, then shows the new avatar and cover after the resubmission. Step 5 does not change the creator page. Step 6: every URL returns 400 'Validation failed' with the field message 'Upload the image through Ujimora'. Only https://res.cloudinary.com/<configured cloud>/image/upload/... is accepted, and '' clears the image. An account image hosted anywhere else is also refused. Step 7 saves at once: the snackbar reads 'Your creator page is saved', no publication review is created, and the public page shows the default images immediately. Native behaves the same as the web.

**Needs:** Cloudinary

**Source:** `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/mobile/app/creator.tsx`

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

## CREATOR-024 · P1 · Changing tip details after an abandoned checkout offers recovery instead of a dead-end 409

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA eligible. DevTools open so the localStorage keys 'ujimora:tip-attempt:*' can be seen. Use a fresh private window (or clear those keys) before each of steps 1, 4 and 5.

**Steps:**

1. Start a GH₵25 tip and reach Paystack. Close the tab without paying and without visiting the callback.
2. Return to /creators/ama-sings, choose GH₵50 and click Support.
3. Click 'Check the earlier payment', go back, then click 'Start a new payment'.
4. Fresh window: start a GH₵30 tip, pay with a declining Paystack test card, and close the tab before the callback. Return, choose GH₵40 and click Support.
5. Fresh window: start a GH₵20 tip, pay successfully, and close the tab before the callback. Return, choose GH₵35 and click Support.
6. After step 1 in another fresh attempt, retry with identical GH₵25 details.

**Expect:** Step 2: no raw 409 error. The page checks the earlier payment and shows the warning 'You have an unfinished payment for this creator. Check it before starting a new one, so you are not charged twice.' with a 'Check the earlier payment' link to /tip/callback?reference=<old ref> and a 'Start a new payment' button. Step 3: the link shows 'Confirming your support…', because an abandoned Paystack checkout is no longer treated as failed. 'Start a new payment' forgets the old key and opens a new GH₵50 Paystack checkout with a different reference. Step 4: the earlier tip is FAILED, so the page discards the old key on its own and goes straight to Paystack for GH₵40. Step 5: success alert 'Your previous tip to this creator went through. Send another one only if you mean to tip again.' with a 'Send another tip' button, which starts a new checkout. Step 6: identical details reuse the original checkout URL (same reference). The abandoned GH₵25 tip stays PENDING until the reconciliation sweep closes it as FAILED after 24 hours.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/CreatorTipPage.tsx`, `apps/web/src/lib/tipCheckout.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`

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

## CREATOR-029 · P1 · Tip verify endpoint: input, privacy and per-client rate limiting

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A known SUCCEEDED tip reference. Staging behind the production proxy chain (browser calls https://<staging-api>/api/v1 directly; Render/Cloudflare set CF-Connecting-IP). Two client networks, e.g. office Wi-Fi and a phone hotspot.

**Steps:**

1. POST /api/v1/creators/tips/verify {"reference":"abc"}.
2. POST {"reference":"tip-00000000"} (unknown).
3. POST the valid reference from a different, unauthenticated browser.
4. From client 1, send 61 verify requests within 15 minutes and watch the response headers.
5. While client 1 is throttled, send a verify request (and open a tip checkout) from client 2.
6. From client 1, retry with a forged X-Forwarded-For (and X-Real-IP) header.

**Expect:** 'abc' returns 400 'Validation failed'. Unknown returns 404 'Payment reference not found'. The valid reference returns only {status, amount, currency, handle, displayName, thankYouMessage, contentReviewStatus}: no email, supporter name or message. Step 4: responses carry X-RateLimit-Limit 60 and a falling X-RateLimit-Remaining. The 61st returns 429 'Too many requests, please try again later' with Retry-After. This bucket is shared with tip checkout and donation checkout from the same client. Step 5: client 2 is not throttled, because buckets are per client address, not one platform-wide bucket. Step 6: still 429, because forwarded-for headers are ignored.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`

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

## CREATOR-034 · P1 · Reconciliation repairs uncredited tips, settles lost-webhook tips and closes dead checkouts

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with DB access. Admin token. Paystack test keys. For the automatic sweep: PAYMENTS_RECONCILIATION_ENABLED not false, and RECONCILIATION_SCHEDULER_ENABLED=true (the default in production only).

**Steps:**

1. Pick a SUCCEEDED tip. Set settlementApplied=false, remove its settledRef, subtract its amount from availableBalance, and backdate updatedAt by more than 30 minutes.
2. With the webhook disabled (or pointed elsewhere), complete a tip payment on Paystack, never open its callback, and backdate its updatedAt by more than 30 minutes.
3. Open a tip checkout and abandon it on Paystack. Backdate its createdAt and updatedAt by more than 24 hours.
4. Insert (or leave) a PENDING tip whose tip- reference Paystack never registered, backdated by more than 24 hours.
5. Leave one abandoned tip that is only 2 hours old.
6. POST /api/v1/admin/reconciliation {"olderThanMinutes":30}, or wait for the 5-minute sweep.
7. Run it again.

**Expect:** The summary shows tipsRepaired ≥ 1 (step 1), tipsSettled ≥ 1 (step 2) and tipsFailed ≥ 2 (steps 3 and 4). Step 1 is credited once. Step 2: the lost-webhook tip becomes SUCCEEDED and the creator balance rises by exactly its amount. The Paystack amount and currency must match the tip; a mismatch is logged ('reconcile: tip provider/row mismatch — flagged, not credited') and left PENDING. Steps 3 and 4 become FAILED with no credit. The 2-hour-old abandoned tip stays PENDING. The second run changes nothing: no double credit and no status flips.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ReconcilePaymentsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoTipRepository.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`

## CREATOR-035 · P1 · Tip refund or chargeback is recorded for staff but does not debit the creator balance

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** A SUCCEEDED tip credited to creatorA. Admin token.

**Steps:**

1. Refund the tip from the Paystack test dashboard so refund.processed is delivered (and, if possible, raise a test dispute so charge.dispute.create is delivered).
2. Check the webhook response, the Tip status and creator_balances.
3. Admin: GET /api/v1/admin/payments/provider-events?status=open.
4. POST /api/v1/admin/payments/provider-events/<id>/acknowledge, then repeat the same call.
5. Replay the refund webhook.

**Expect:** The webhook is acknowledged with 200 (no 500 and no retry loop). The Tip status and the creator balance are unchanged. Exactly one provider event is recorded (kind refund or dispute, subject 'tip', the tip- reference, amount and currency, no customer details), and the API logs the alert 'external_refund' ('paystack processed a refund Ujimora did not request — balances were not reduced; needs staff accounting'). The event appears in the open provider-events list. Acknowledge sets reviewStatus 'acknowledged'; the second call returns 404 'Provider event not found or already acknowledged'. The replay creates no duplicate. There is no admin UI page for these events (API only). Known open issue I009: there is no automatic clawback, hold or ledger reversal for tip refunds or chargebacks. Finance and support must debit manually; agree the policy before launch.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`

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

## CREATOR-042 · P1 · Account closure: supporter closes, creator with a balance is blocked, org owner's campaigns are ended

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** supporterS has an approved named tip and no balances. creatorA has availableBalance > 0. creatorP has a 0 balance but a PROCESSING withdrawal. orgOwner has active members and open campaigns with nothing left to pay out. Passwords are known, and one account has MFA on.

**Steps:**

1. S: Settings, Delete account. Enter the current password (and the authenticator code if MFA is on) and confirm. Also try once with a wrong password.
2. creatorA: Settings, Delete account.
3. creatorA via the API: GET /api/v1/profile/closure-check, then DELETE /api/v1/profile with {"password":"<current>"}.
4. creatorP: Delete account.
5. creatorA withdraws the whole balance to bank/MoMo, waits for PAID, then deletes the account again.
6. orgOwner: Delete account. Read the warning, then confirm with the password.
7. Check the public pages, /organizations and the DB.

**Expect:** Step 1: a wrong password returns 400 and the session stays usable. The correct password closes the account; S's tips become Anonymous and their checkout credentials are revoked; creator totals are unchanged. Step 2: the dialog shows 'Checking your balances and campaigns…', then the error 'Your account can’t be closed yet. First withdraw or resolve: GHS X.XX in creator tips not yet withdrawn. If you can’t, contact support@ujimora.com and we’ll help you close your account.' There is no password field and 'Delete my account' is disabled. Step 3: closure-check returns canClose false with the same message. DELETE returns 409 with that message and errors.accountClosure ['creator_balance'], and nothing is erased. Step 4: blocked with '1 payout still being processed'. Step 5: once the balance is 0 and nothing is in flight, closure succeeds; /creators/<handle> returns 404 and the creator_balances row is kept. Moving the money to the Ujimora Wallet instead leaves a wallet balance that also blocks closure, and affiliate earnings block it the same way. Step 6: the dialog warns 'Closing your account ends your N open campaigns. They stop accepting donations, and anything awaiting review is withdrawn.' After closure, active and funded campaigns become expired (new donation intents return 400) and pending-review campaigns become drafts. The org disappears from /organizations, members are revoked and organization.profile drafts are deleted.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`

## CREATOR-050 · P1 · Transfer initiation failures: low Paystack balance, definitive rejection, ambiguous timeout and reconciliation

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging where Paystack /transfer can be made to return a 4xx, to time out after being sent (proxy), and where the test transfer balance can be drained. creatorA with current identity KYC, a balance of at least GH₵150 and a name_matched saved account. Admin token.

**Steps:**

1. Drain the Paystack test transfer balance below the net amount, then withdraw GH₵50 to the saved account.
2. Restore the balance. Make POST /transfer fail with a definitive 4xx (e.g. an invalid recipient), then withdraw GH₵50.
3. Make POST /transfer time out after it is sent. Withdraw GH₵50, then click Withdraw again in the same dialog (same idempotencyKey).
4. POST /api/v1/admin/reconciliation/payouts, or wait for the sweep.
5. In the dialog choose 'Enter a new account' while Paystack /transferrecipient is failing.

**Expect:** Step 1: 503 'Withdrawals are temporarily unavailable. Please try again later.' No payout row is created and the balance is unchanged. Step 2: 502 'Could not start the withdrawal. Your balance has been restored; please try again.' The payout is FAILED and the GH₵50 is returned to available exactly once (settleRef cpay:<id>:returned). If Paystack instead accepts the call but reports the transfer failed or rejected, the response is 502 'The transfer was rejected by the provider. Your balance has been restored.' Step 3: 'Withdrawal started'. The payout stays PROCESSING with funds reserved; the retry returns the same payout and there is no second transfer. Step 4: reconciliation settles it to PAID or FAILED from Paystack's verify, with the balance effect applied once. If Paystack cannot confirm the reference for 24 hours, it is escalated to NEEDS_REVIEW with funds still reserved (CREATOR-N003). Step 5: an error is shown and nothing is reserved, because the recipient is created when the account is saved, before any reservation.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/application/services/PayoutAccountService.ts`

## CREATOR-054 · P1 · Native creator withdrawals (iOS/Android), including decimal-comma amounts

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Native creator with a balance, a verified email, current identity KYC and a saved verified account. A second native creator without KYC.

**Steps:**

1. app/creator.tsx, 'Withdrawals', Withdraw. Enter an amount and check the fee preview.
2. Type '100,50' (decimal comma), then '1,000.50', then '1.005'.
3. Pick the saved account, submit, and confirm the payout in web /creator history.
4. New account: type 'MTN' in 'Network (e.g. MTN)'. Then try 'Vodafone'.
5. Kill the app mid-request, reopen and retry.
6. As the creator without KYC, withdraw to bank/MoMo.

**Expect:** Fee and net match the web and the API. '100,50' is read as 100.50 and the preview uses it. '1,000.50' and '1.005' are rejected and Withdraw stays disabled. The payout appears on the web. 'MTN', 'VOD' and 'ATL' work; 'Vodafone' fails with a clear provider error. The retry reuses the idempotency key with no duplicate. Step 6 shows 'Verify your identity, or renew an expired verification, before withdrawing creator funds to a bank or mobile-money account.' Money-out is allowed in store builds.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/creator.tsx`, `apps/mobile/src/lib/moneyInput.ts`, `apps/mobile/src/lib/creators.ts`

## CREATOR-055 · P1 · Creator bank/MoMo withdrawals require current identity KYC; Ujimora Wallet transfers do not

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Paid creators, each with a balance of at least GH₵50, a name_matched saved account and a verified email unless noted: (a) no KYC record; (b) KYC pending; (c) KYC rejected; (d) KYC approved but expiryDate in the past; (e) approved KYC with a newer renewal pending; (f) email not verified but KYC approved; (g) current approved identity KYC (verificationLevel ≥ 2). An organization creator needs institutional level and business KYC. Paystack test balance funded.

**Steps:**

1. For each creator: /creator, Withdraw, 'Bank or mobile money', saved account, 50, Withdraw.
2. For creators (a) and (d): Withdraw, 'Ujimora Wallet', 50.
3. For creator (g): open the Withdraw dialog, expire the KYC on staging, then click Withdraw.

**Expect:** (a) to (f) show 409 'Verify your identity, or renew an expired verification, before withdrawing creator funds to a bank or mobile-money account.' in the dialog. No payout row is created, Paystack is not called (no recipient and no transfer), and the balance is unchanged. (g) proceeds to PROCESSING. Step 2: wallet transfers succeed without KYC, because the funds stay on the platform. Step 3: KYC is checked again inside the reservation transaction, so nothing is reserved once it lapses. Compliance: READINESS C13 creator consumers are now gated. Still owner decisions: a clearing hold or daily cap, a staff override, and matching the payout-account name to the KYC legal name.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCreatorWithdrawalTransaction.ts`, `docs/compliance/READINESS.md`

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

## CREATOR-059 · P1 · Organization profile page: data, links and server-computed totals

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** orgVerified with campaigns in active, funded, draft, pending and rejected states, including one non-GHS campaign if possible. A second, newer org with an identical name. More than 100 campaigns platform-wide on staging if possible.

**Steps:**

1. Open /organizations/<id> and /organizations/<slug>.
2. Check that the Campaigns grid includes only public statuses.
3. Click Website (it should open a new tab) and Share.
4. Open the slug shared by the two same-named orgs.
5. Compare totalRaised and campaignCount on the profile, on the directory card and in GET /api/v1/organizations.
6. Open /organizations/unknown.
7. Open the same org on native.

**Expect:** The profile shows name, logo/cover, stats (Campaigns, Raised), impact statement and public campaigns only. Share shows 'Link copied to clipboard!'. The shared slug resolves to the OLDEST of the same-named orgs, so a newer namesake cannot take over the URL. GET /organizations now returns campaignCount, totalRaised and currency per org, computed on the server over all public campaigns (not only the first 100). totalRaised adds GHS campaigns only (other currencies are counted in campaignCount but not summed). The directory card, the profile and the API agree. Unknown shows ItemNotFound with 'Back'. Native org stats match, with Raised formatted as money.

**Needs:** None

**Source:** `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/web/src/pages/OrganizationsPage.tsx`, `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoOrganizationRepository.ts`, `apps/mobile/app/organization/[id].tsx`

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

## CREATOR-062 · P1 · Report and Block on org and member profiles, native and web

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Signed-in user V. orgVerified. Member M with a public profile.

**Steps:**

1. Native: open /organization/<id>, tap Report (user target) and send. Tap 'Block user'.
2. Native: open /profile/<M id>, tap Report and 'Block user'.
3. Native Settings, Blocked users: both are listed. Unblock one.
4. Web: sign in as a different viewer and open /organizations/<id>. Click Report, choose a reason, enter 10 or more characters and send.
5. Web: click 'Block user' on the org profile.
6. Web: open Settings, Blocked users, and unblock the org; reload the profile.
7. Web: view the org profile as a guest and as the owner.

**Expect:** Native reports return 201. Blocking shows 'User blocked.' and hides the profile, and the list and unblock work. Web: Report opens 'Report a safety concern' and shows 'Report received for moderation review.' 'Block user' replaces the page with the not-found panel and the message 'You blocked this organization, so its profile is hidden from you.', with a Back button to /organizations. The org appears in Settings, Blocked users; unblocking restores the profile. Guests and the owner see no Report or Block. This matches STORE_SUBMISSION's 'Report/Block on member and organization profiles' on both platforms.

**Needs:** None

**Source:** `apps/mobile/app/organization/[id].tsx`, `apps/mobile/app/profile/[id].tsx`, `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/mobile/STORE_SUBMISSION.md`

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

**Before:** The org is on the Organization plan (10 seats), so seat limits don't interfere. Invites for: an unverified-email user, an expired invite (expiresAt set in the past), and a revoked member.

**Steps:**

1. The unverified user accepts.
2. Another account POSTs /organization-team/invitations/<id>/accept for someone else's invite.
3. The expired invite is accepted. The owner's list shows its status.
4. Accept a valid invite twice.
5. The owner re-invites the expired and revoked emails, and re-sends a still-open invitation.
6. The owner invites their own org email, then an already-active member.

**Expect:** Unverified returns 403 'Verify your email before accepting an organization invitation'. The wrong account gets 404 'Invitation unavailable or expired', and the invite does not appear in their /mine. Expired returns 404 and the list shows 'expired'. The second accept returns 404. Re-invites create a fresh 7-day invite; re-sending to the same address never needs an extra seat. Own email returns 409 'The owner already has full access'. An active member returns 409 'This member already has access...'.

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

## CREATOR-077 · P1 · Referral attribution on native via app links and manual entry

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** App installed. affiliateA code 'kofi-art' active.

**Steps:**

1. Open ujimora://register?ref=kofi-art (from Notes, or via xcrun simctl openurl / adb shell am start).
2. Open ujimora://?ref=kofi-art (site root).
3. Tap https://app.ujimora.com/?ref=kofi-art from WhatsApp.
4. On Register, type 'zz' in Referral code and complete signup.
5. On Register, type 'kofi-art' manually and complete signup.

**Expect:** Steps 1 and 2 open the Register screen with Referral code prefilled 'kofi-art' (editable), and signing up attributes the referral (affiliateA sees it as Pending). Step 3 opens the web app in the browser, which stores ?ref as uf_ref; attribution happens only if the person registers on the web. Step 4: the hint reads 'Use at least 3 characters. Until it is fixed, you will sign up without a referral code.' Signup succeeds with no referral and no 400. Step 5 attributes the referral correctly. Known open issue I152: https links do not open the app (no universal links / App Links), so shared affiliate links never reach native registration.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/lib/referral.ts`

## CREATOR-081 · P1 · Commission base with admin coupons (LIST_PRICE vs post-coupon)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Two admin coupons of 20%: one with commissionBase LIST_PRICE, one default. Two referred users.

**Steps:**

1. Each referred user subscribes with one coupon.
2. Compare the commission amounts.

**Expect:** LIST_PRICE coupon: commission = 10% of the list price. Default coupon: commission = 10% of the discounted charged amount. Both rounded to 2dp.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## CREATOR-084 · P1 · Commission maturity: concurrent loads are safe and unvisited affiliates mature on schedule

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** AFFILIATE_HOLD_DAYS=0 (or held commissions backdated). affiliateA has 2 or more held commissions of equal amount plus one not yet due. affiliateB has a matured held commission and does not sign in. Scheduler on: RECONCILIATION_SCHEDULER_ENABLED=true on staging (default on in production), PAYMENTS_RECONCILIATION_ENABLED not false.

**Steps:**

1. Open /affiliate in two tabs at the same moment (or fire two GET /affiliate calls together).
2. Check each commission's status against pendingBalance and availableBalance.
3. Without affiliateB visiting the dashboard, wait for the next 5-minute reconciliation sweep and check the admin affiliate detail for affiliateB.

**Expect:** availableBalance = the sum of matured commissions, credited exactly once. pendingBalance still holds the commission that is not yet due, and it stays 'Held'. Every matured commission is 'Available' and none is stuck 'Held'. Maturity is scoped per affiliate, so loading affiliateA's dashboard never moves another affiliate's money. After the sweep, affiliateB's matured commission is 'available' in the admin detail without any login.

**Needs:** None

**Source:** `apps/api/src/application/services/AffiliateCommissionMaturity.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/api/src/application/use-cases/MatureAffiliateCommissionsUseCase.ts`, `apps/api/src/app.ts`

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

1. Read ujimora.com/affiliates: rate, one-time rule, web-only rule, hold, payout destination, refund reversal.
2. Read the web and native enroll copy and the empty commissions state.
3. On web /affiliate, follow the payout-destination flow the marketing page describes.
4. Read the features page creator copy (paid plan required, fee on withdrawal).

**Expect:** The FAQ says the commission is a one-time 10% on the first paid plan bought on the Ujimora website, that App Store and Google Play purchases are not eligible, that there is a 14-day hold, and that a refund within the hold reverses the commission. The web and native enroll copy says 'Earn a one-time commission when someone you refer buys their first paid plan on the Ujimora website.' 'Register a payout destination in your dashboard' is now true (the Payout destination picker, CREATOR-085). Check the remaining lines that omit the web-only rule (hero: 'When someone you refer upgrades to a paid plan, you earn a commission...', and the how-it-works step) and align them if product wants the rule stated everywhere. The creator fee copy matches docs/creator-donations.md. Known open issue I061: store purchases deliberately earn no commission until the owner decides otherwise.

**Needs:** None

**Source:** `apps/marketing/src/pages/AffiliateProgramPage.tsx`, `apps/web/src/pages/AffiliateDashboardPage.tsx`, `apps/mobile/app/affiliate.tsx`, `apps/marketing/src/data/features.ts`, `render.yaml`

## CREATOR-092 · P1 · Support can investigate creator tips, balances and withdrawals

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A support admin. A supporter who reports 'debited but tip still pending' with a tip- reference. A creator reporting a stuck withdrawal that is in NEEDS_REVIEW.

**Steps:**

1. Admin Payments (/payments): search the tip- reference and the supporter's email.
2. Look for the creator balance and creator withdrawal history in admin (Payouts, Wallets, Users).
3. GET /api/v1/admin/payments/provider-events for tip refunds and disputes.
4. Open /tip/callback?reference=<tip ref> (supporter link), or run POST /api/v1/admin/reconciliation.
5. POST /api/v1/payouts/stuck/creator/<payoutId>/resolve with a 20+ character note.
6. Try POST /admin/payments/<id>/reconcile using the tip reference.

**Expect:** The new admin Payments page searches donation payments only; tip- and cpay- references are not found, and there are no creator tip, balance or withdrawal views. Provider events list tip refunds and disputes (subject 'tip') and can be acknowledged. A stuck PENDING tip is settled by the supporter's callback verify or by the reconciliation sweep, which now settles lost-webhook tips. A NEEDS_REVIEW creator withdrawal can be resolved only through the API (CREATOR-N003). Payment reconcile by id covers donation intents only. Write the support runbook around these paths. Known open issue I036: admin views for creator tips, balances and withdrawals are not built.

**Needs:** None

**Source:** `apps/admin/src/router.tsx`, `apps/admin/src/pages/PaymentsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`

## CREATOR-N002 · P1 · A tip first recorded as failed is credited when Paystack later confirms it

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging DB access. Paystack test keys. Webhook delivery can be paused.

**Steps:**

1. With webhooks paused, complete a GH₵15 tip on Paystack, then set the Tip status to FAILED in the DB (simulating an early failed report).
2. Open /tip/callback?reference=<ref>.
3. Re-enable webhooks and replay the signed charge.success.
4. Check the Tip, creator_balances and the API logs.

**Expect:** Verify re-checks FAILED tips with Paystack. The server-side verification (same reference, amount and currency) moves the tip FAILED → SUCCEEDED and credits GH₵15 exactly once. The callback shows 'Thank you for your support!', and the API logs 'late provider success on a FAILED tip — crediting after verification'. The replayed webhook is a no-op, with no second credit. A late success on a FAILED tip is only credited after the server's own verifyTransaction confirms it, never on the webhook body alone.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandleTipWebhookUseCase.ts`, `apps/api/src/application/use-cases/VerifyCreatorTipUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoTipRepository.ts`

## CREATOR-N003 · P1 · A stuck creator withdrawal escalates to NEEDS_REVIEW, and staff resolve it from Paystack's outcome

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** creatorA with current identity KYC and a name_matched saved account. Staging where POST /transfer can time out after sending. DB access. adminB token. A non-admin token.

**Steps:**

1. Make a GH₵50 withdrawal whose /transfer call times out, so it stays PROCESSING with funds reserved and Paystack never registers the reference.
2. Backdate the creatorpayouts row's updatedAt by more than 24 hours.
3. POST /api/v1/admin/reconciliation/payouts.
4. As creatorA, reload /creator and check notifications.
5. As adminB, POST /api/v1/payouts/stuck/creator/<payoutId>/resolve {"note":"short"}, then with a note of 20 or more characters.
6. Replay the resolve call.
7. For a second escalated payout that Paystack still reports as pending, call resolve.
8. As a non-admin, call resolve.

**Expect:** Step 3: the payout moves to NEEDS_REVIEW (summary escalated ≥ 1) with funds still reserved; it is never auto-failed. The log reads 'payout reconciliation: transfer unconfirmed past dwell window; escalated for review with funds still reserved'. Step 4: the history chip shows NEEDS_REVIEW and an alert reads 'Your withdrawal is awaiting review'. Step 5: a short note returns 400 'Validation failed'. With a valid note, Paystack reports the transfer not found, the payout becomes FAILED, and GH₵50 returns to available exactly once. The response has providerOutcome 'failed', and the audit log records payout.stuck_resolved with the note. A transfer Paystack reports as success becomes PAID; a reversed one becomes REVERSED. Step 6: 409 'Only a payout awaiting review can be resolved (this one is FAILED).' Step 7: 409 'Paystack still reports this transfer as "pending". Resolve it once Paystack reaches a final state.' Step 8: 403. The admin UI covers campaign payouts only; creator and affiliate payouts are resolved through the API.

**Needs:** Paystack test keys (Transfers)

**Source:** `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/application/use-cases/ResolveStuckPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## CREATOR-N004 · P1 · Payout account name matching accepts Ghanaian name order and ɔ/ɛ, and re-adding re-checks the name

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Test numbers whose Paystack-resolved names you know (e.g. 'KWAME MENSAH', 'OSEI BENYIWA', 'KWAME OWUSU MENSAH'). Paystack test mode returns fixed names, so a staging stub or seeded resolved names may be needed. creatorA with current identity KYC and a balance.

**Steps:**

1. /payout-accounts: add the 'KWAME MENSAH' number with the name 'Mensah Kwame'.
2. Add the 'OSEI BENYIWA' number with 'Ɔsei Bɛnyiwa'.
3. Add the 'KWAME OWUSU MENSAH' number with 'Kwame Mensah'.
4. Add another 'KWAME MENSAH' number with 'Kwame' only, and another with 'Kofi Mensah'.
5. Re-add the 'Kofi Mensah' number with the correct name 'Kwame Mensah', without removing it first.
6. Withdraw creator funds to each account (web and native).

**Expect:** Steps 1 to 3 show 'Registered name matched' (name_matched), and creator withdrawals to those accounts proceed. Step 4 accounts show 'Name not matched: creator withdrawals need a matched account' (native shows the same wording), and withdrawing to them returns 422 'The name the bank or telco holds for this account did not match the account name you entered. Choose an account whose name matched before withdrawing creator funds.' Step 5 re-resolves the same saved account and updates it to name_matched, with no duplicate row. Re-adding never downgrades a matched account. The owner should confirm that tolerating a middle name (subset matching) is acceptable.

**Needs:** Paystack test keys (resolve account)

**Source:** `apps/api/src/domain/services/payoutNameMatch.ts`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/web/src/components/account/PayoutAccountCard.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`

## CREATOR-N006 · P1 · An admin cannot approve their own affiliate payout

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** adminA is also an enrolled affiliate with a destination and a PENDING payout. adminB is available. Paystack test transfer balance funded.

**Steps:**

1. adminA: Affiliates, Payout Queue, click Approve on their own payout.
2. adminA via the API: POST /api/v1/affiliates/payouts/<id>/approve.
3. adminB approves the same payout.

**Expect:** Steps 1 and 2 return 403 'Another administrator must approve your own affiliate payout.' (shown in the snackbar). The payout stays PENDING and no transfer is started. Step 3 shows 'Payout approved and transfer initiated' and the payout becomes PROCESSING with an aff- reference. Owner note: with only one production admin, such payouts wait until a second admin exists.

**Needs:** Paystack test keys (Transfers)

**Source:** `apps/api/src/application/use-cases/ApproveAffiliatePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutApproval.ts`, `apps/admin/src/pages/AffiliatesPage.tsx`

## CREATOR-N008 · P1 · Organization team invitations respect the plan's seat limit (owner included)

*Surfaces:* api, marketing, web  ·  *Type:* functional

**Before:** orgPlus on Plus (1 seat). orgPro on Pro (3 seats) with no members. An org whose paid plan can be expired on staging. Invitee accounts A, B, C and D.

**Steps:**

1. orgPlus owner invites A.
2. orgPro owner invites A (viewer) and B (editor), then C.
3. orgPro owner re-sends the invitation to A.
4. Set B's invitation expiresAt to the past, then invite C again.
5. Expire orgPro's plan and invite D. Check that existing members still have access.
6. Read the plan comparison on /subscription and ujimora.com/pricing.

**Expect:** Step 1: 403 'Your Plus plan includes 1 team seat, including the owner. Upgrade the organization's plan or remove a member before inviting someone new.' Step 2: A and B succeed, and C gets 403 'Your Pro plan includes 3 team seats, including the owner. Upgrade the organization's plan or remove a member before inviting someone new.' Step 3 succeeds, because re-sending to the same address needs no new seat. Step 4: the expired invitation frees its seat and C is invited. Step 5: the lapsed plan falls back to Community, so D gets 403 'Your Community plan includes 1 team seat...'; existing active members are not removed. Step 6: the limit is labelled 'Organization team seats (incl. owner)' (Organization plan 10, Enterprise unlimited).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/app.ts`, `packages/types/src/subscription.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/PricingPage.tsx`

## CREATOR-N010 · P1 · Creator QR codes point to the creator page and follow the current handle

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** creatorA owns an active campaign and has a live creator page 'ama-sings'. creatorZ owns an active campaign but has no creator page. DB access to edit a short link's stored target.

**Steps:**

1. creatorZ: web /campaigns/<id>/live QR panel, choose 'Creator' (or native Campaign management, 'Link destination: Creator profile') and create the code.
2. creatorA: create a Creator QR code, then open its /r/<code> short link (or scan it).
3. Change creatorA's handle through review (CREATOR-009) and scan again.
4. On staging, set an existing creator-kind short link's stored target to https://app.ujimora.com/u/<creatorA userId> and scan it.
5. Native: open ujimora://u/<creatorA userId>.

**Expect:** Step 1: 422 'Set up your creator page before creating a creator QR code.' Step 2: the code's target is <PUBLIC_WEB_URL>/creators/ama-sings and the scan redirects (302) there, never to /u/<id>. Step 3: the redirect follows the current handle. Step 4: the legacy /u/ target also redirects to /creators/<handle>, because destinations are rebuilt at scan time, so there is no Not Found. If the creator page no longer exists, it falls back to the campaign page. Step 5 opens the native member profile /profile/<id> instead of Not Found.

**Needs:** None

**Source:** `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/web/src/components/live/QrCodeManager.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `apps/mobile/src/navigation/resolvePath.ts`

## CREATOR-N012 · P1 · Removing creator photos takes effect immediately; text-only edits are not held as media

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** creatorA live with an approved avatar and cover. Variants of the same creator: (a) plan expired, (b) publishing restricted, (c) account agreement out of date. OPENAI_API_KEY valid.

**Steps:**

1. For each variant: on /creator click 'Clear images', then 'Save changes' (also on native).
2. API: POST /creators/profile {"avatarUrl":""} alone, then {"avatarUrl":"","tagline":"new text"}.
3. With an active plan and images present: change only the tagline, tick the OpenAI consent box and save.
4. Select a new avatar and save with consent.

**Expect:** Step 1: in every variant the change saves at once ('Your creator page is saved') with no plan, restriction, agreement or review check. No publication review is created and the images disappear from the public page immediately. Step 2: removing only the avatar is immediate; removing it together with a text change counts as a public change, so review, plan and agreement checks apply (for example 403 when the plan has expired). Step 3: the existing approved images are not re-sent as media, so the text is screened and publishes in the same request. Step 4 is held for staff review (reason media) even with consent.

**Needs:** OpenAI

**Source:** `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/mobile/app/creator.tsx`, `docs/compliance/PUBLICATION_REVIEWS.md`

## CREATOR-N014 · P1 · A fully refunded web subscription ends creator tip eligibility

*Surfaces:* api, web  ·  *Type:* functional

**Before:** creatorA on Plus bought on the web (Paystack sub- reference) for the current period, page live with tips on, balance GH₵50, current identity KYC and a name_matched account. A second creator for the partial-refund check. Paystack test dashboard.

**Steps:**

1. Fully refund creatorA's sub- charge in Paystack (refund.processed).
2. As a guest, open /creators/ama-sings and try a tip; also POST /api/v1/creators/ama-sings/tips.
3. creatorA opens /creator and withdraws GH₵50.
4. Replay the refund webhook.
5. Partially refund the second creator's subscription charge.

**Expect:** Step 1: the plan time paid by that charge is removed, so the subscription ends now and creatorA is no longer creator-eligible. Step 2: the page shows 'This creator isn’t accepting tips right now.' and the API returns 403 'Creator donations require an active paid subscription...'. Step 3: the dashboard shows 'Upgrade to receive new tips. You can still withdraw your existing balance.' and the withdrawal is allowed at the Community fee (3.5%). Step 4 is a no-op. Step 5: a partial refund keeps access (it is logged; pro-rata is an owner decision). App Store and Google Play plans are not affected by Paystack refunds.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RevokeRefundedSubscriptionUseCase.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## CREATOR-009 · P2 · Handle locked in UI; API-only handle change (creator QR codes follow it), preset amounts and thank-you message

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** creatorA's page is live. creatorA owns an active campaign that has a 'Creator' QR code (see CREATOR-N010).

**Steps:**

1. Web /creator: try to edit the Handle field. Native: the same.
2. Via the API, POST /creators/profile {"handle":"ama-new"}. Take it through review and approval, then resubmit.
3. Open /creators/ama-sings and /creators/ama-new.
4. Scan the creator QR code, or open its /r/<code> short link.
5. Via the API, POST presetAmounts [5,15] and thankYouMessage 'Medaase!' through review and resubmission.
6. Tip and view /tip/callback.

**Expect:** The UI does not allow editing the handle. After the approved API change, /creators/ama-sings shows 'Page not found' (404) and /creators/ama-new works. The creator QR code is resolved at scan time and now redirects to /creators/ama-new. Balance and tips stay intact. The public page shows GH₵5/GH₵15 presets and the callback shows 'Medaase!'. No web or native UI edits presets or the thank-you message. Decide before launch whether to block handle changes server-side or redirect old /creators/<handle> URLs: directly shared links (anything other than Ujimora QR short links) still break.

**Needs:** None

**Source:** `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`

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

## CREATOR-031 · P2 · A signed-in creator cannot tip their own page

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** creatorA signed in. Page live with tips on.

**Steps:**

1. Open your own /creators/ama-sings. UserSafetyControls should be hidden.
2. Choose GH₵10, enter your own email and click Support.
3. API as creatorA: POST /api/v1/creators/ama-sings/tips {"amount":10,"supporterEmail":"<own email>"}.
4. Sign out and tip your own page as a guest.

**Expect:** Step 1 shows no Report or Block controls. Steps 2 and 3 return 422 'You cannot tip your own creator page.', and the web form shows it. No Tip row is created and Paystack is not initialized. Step 4: a guest tip cannot be linked to the creator and is accepted. The remaining controls on cashing out are the GHS 10,000 tip cap and the current-KYC requirement for bank/MoMo withdrawals (CREATOR-055). Still an owner decision: a clearing hold or daily cap on creator withdrawals.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/web/src/pages/CreatorTipPage.tsx`

## CREATOR-060 · P2 · Web org profile shows no fake Follow control or follower count

*Surfaces:* web  ·  *Type:* functional

**Before:** Any org profile. A signed-in non-owner viewer and a guest.

**Steps:**

1. Open /organizations/<id> as a guest and look at the stats and action buttons.
2. Repeat as the signed-in non-owner.
3. Repeat as the org owner.

**Expect:** There is no 'Follow'/'Following' button and no 'Followers' stat anywhere; the stats are Campaigns and Raised. Guests see Share and Website (if set). A signed-in non-owner also sees Report and 'Block user'. The owner sees 'Change cover' and 'Change logo' but not Report/Block. Persisted following is a separate future feature.

**Needs:** None

**Source:** `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`

## CREATOR-073 · P2 · Native organization identity editor and invitation acceptance (team management stays on the web)

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Native builds. orgOwner. An invited member with an existing account and verified email. A second invitee with an unverified email. An expired invitation.

**Steps:**

1. orgOwner: Profile, then Edit (profile/edit), then the organization identity editor. Edit the name and test the held draft, consent and review history.
2. The invited member opens the Invitations screen.
3. Tap 'Accept invitation'.
4. The unverified invitee taps 'Accept invitation'.
5. orgOwner (or an active admin) opens the Invitations screen and taps 'Manage your organization team on the website'.
6. Check that the expired invitation is not listed.

**Expect:** The identity editor follows the same review flow as the web. The Invitations screen shows an 'Organization teams' section with a card '<Org name>', 'Invited as editor. Invitations expire after seven days.' and 'Accept invitation'. Accepting shows the alert 'Accepted' / 'You joined the organization team.' and the card disappears; web /organization-team shows the member as active. The unverified invitee gets 'Could not accept' with 'Verify your email before accepting an organization invitation'. The owner/admin button opens <EXPO_PUBLIC_WEB_URL>/organization-team in the browser. Inviting, roles and removal are not available natively. Expired invitations are not listed. Nothing steers users to a purchase.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/src/components/OrganizationIdentityEditor.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/app/invitations.tsx`, `apps/mobile/src/components/OrganizationInvitations.tsx`, `apps/mobile/src/lib/organizationInvitations.ts`

## CREATOR-N009 · P2 · Native comment authors link to their public member profile, with Report/Block even when it is hidden

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** A public campaign with comments from member M (public profile) and member Mp (profile hidden). Signed-in viewer V on a native build with a screen reader available.

**Steps:**

1. Open the campaign on native and scroll to comments. Tap M's name, then M's avatar.
2. Go back and tap Mp's name.
3. On Mp's screen, tap Report (send a report), then 'Block user'.
4. With VoiceOver or TalkBack on, focus M's avatar and name.

**Expect:** Step 1 opens /profile/<M id> showing name, avatar, country and verification, with Report and 'Block user'. Step 2 shows 'This profile is not available.' and still offers Report and 'Block user'. Step 3: the report is accepted (201) and the block succeeds, and Mp appears in Settings, Blocked users. Step 4: the avatar is announced as a link "View <name>'s profile" and the name as a link.

**Needs:** TestFlight / Play internal track

**Source:** `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/app/profile/[id].tsx`

## CREATOR-N011 · P2 · The sitemap lists only creator pages that are actually public

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Creators: creatorV (visible, paid), creatorR (publishing restricted), creatorC (account closed), creatorF (free plan, page exists, tips off). An admin who can restrict and restore.

**Steps:**

1. GET https://app.ujimora.com/sitemap.xml.
2. Restrict creatorV from admin Safety reports (Restricted users) and fetch the sitemap again.
3. Restore creatorV and fetch again.

**Expect:** The sitemap is XML served by the API through the Vercel rewrite, not the SPA shell. It lists /creators/<handle> for creatorV and creatorF (creatorF's page renders with tips off) but not creatorR or creatorC, whose pages return 404. After the restriction creatorV's handle disappears, and after the restore it reappears.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `apps/web/vercel.json`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## CREATOR-N013 · P2 · Affiliate commission basis is fixed at checkout, and used coupons cannot be deleted

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** affiliateA active. Referee R referred by affiliateA (pending). Admin coupon C20 (20% off) with commission base LIST_PRICE. AFFILIATE_COMMISSION_PERCENT=10. Plus monthly 49.00. Paystack test keys.

**Steps:**

1. R opens /subscription, applies C20 and starts checkout. Stop on the Paystack page.
2. Admin edits C20 and changes the commission base to post-coupon (or deactivates C20 with 'Deactivate').
3. Admin tries to delete C20 (UI and DELETE /api/v1/coupons/<id>).
4. R completes the payment.
5. affiliateA opens /affiliate, Commissions.

**Expect:** Step 3: the API returns 409 'This coupon has been used — deactivate it instead.' The admin dialog 'Delete or deactivate C20?' offers Deactivate and disables Delete once the coupon has been redeemed. Steps 4 and 5: the commission is 10% of the list price, 4.90, using the basis stored on the checkout, not 3.92 on the discounted price, despite the later coupon edit. Limits and redemption history are preserved.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/admin/src/pages/CouponsPage.tsx`
