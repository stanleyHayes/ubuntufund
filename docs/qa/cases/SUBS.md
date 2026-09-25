# Plans & subscriptions (94 cases)

Plan catalog, web checkout, App Store and Google Play purchases, restore, server verification and notifications, entitlements, coupons, affiliates.

[Back to the QA plan](../README.md)

## SUBS-002 · P0 · Plan endpoints enforce auth and admin role

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Tokens for a normal user, an organization-role user and an admin. No token for the anonymous calls.

**Steps:**

1. Anonymous: GET /api/v1/plans/public. Expect 200.
2. Anonymous: GET /api/v1/plans. Expect 401.
3. User token: POST /api/v1/plans with a valid body; PUT /api/v1/plans/pro {priceMonthly: 1}.
4. Organization token: repeat step 3.
5. Admin token: repeat step 3 with a harmless change, then revert.
6. In the admin console, log in as a staff account whose RBAC role lacks PLANS and navigate to /plans.

**Expect:** Anonymous calls to /plans return 401. User and organization tokens get 403 'Insufficient permissions' on POST/PUT, and the plan is unchanged when re-read with GET. Admin succeeds. A staff account without the PLANS permission gets the access-denied screen and no 'New plan' or 'Edit plan' controls.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/admin/src/router.tsx`

## SUBS-003 · P0 · Admin price edit changes the next web charge and is audited

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin account. User U1 on Free. Paystack test keys and webhook configured.

**Steps:**

1. Admin > Plans > Pro > 'Edit plan'. Change Monthly price from 149 to 155 and click 'Save changes'.
2. Open Admin > Audit log and filter for action subscription-plan.update.
3. As U1 open /subscription and click 'Choose Pro'. Read 'Total due today' in the dialog.
4. Click 'Continue to payment' and read the amount on the Paystack page.
5. Pay with a Paystack test success card and let the callback show 'You're all set!'.
6. In Paystack test dashboard confirm the transaction amount; in DB read subscriptioncheckouts for U1 (baseAmount/finalAmount/currency).
7. Revert Pro to 149.

**Expect:** The audit entry has severity warning, resource plan:pro, a before/after diff of priceMonthly (149 to 155) and the actor admin id. The dialog and Paystack both show GH₵155.00, and Paystack records amount 15500 pesewas in GHS. The checkout row has baseAmount 155, finalAmount 155, currency GHS. Existing Pro subscribers' currentPeriodEnd is unchanged.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/application/use-cases/UpdatePlanUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## SUBS-009 · P0 · Platform-fee change is grandfathered per campaign and fees are computed correctly

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** User U2 on Pro (2.5%). One active campaign C1 created while on Pro. Paystack test keys. Admin.

**Steps:**

1. Record C1.lockedPlatformFeePercent (API campaign detail or DB).
2. As admin change Pro platformFeePercent to 3.0.
3. Donate GH₵100 to C1 with a Paystack test card; read the donation/ledger platform fee.
4. As U2 create new campaign C2; donate GH₵100 to C2.
5. Let U2's Pro period expire (staging: set currentPeriodEnd to past) and donate GH₵100 to C1 again.
6. Revert fee to 2.5.

**Expect:** C1 keeps charging 2.5% (GH₵2.50) before and after both the fee change and the plan expiry. C2 locks and charges 3.0% (GH₵3.00). Ledger amounts equal the gross minus the fee to the pesewa. The plan update audit entry shows the fee diff.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/application/use-cases/UpdatePlanUseCase.ts`

## SUBS-012 · P0 · Signup with a paid plan completes payment and activates the plan

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** New email address. Paystack test keys and webhook to staging API.

**Steps:**

1. Open /register, complete the Account and Details steps and accept the terms.
2. On the Plan step pick Pro with Yearly, then submit.
3. Confirm redirect to Paystack showing GH₵1,490.00; pay with the test success card.
4. Observe /subscription/callback, then /subscription.
5. Repeat with a new email but make Paystack init fail (e.g. temporarily unset PAYSTACK_SECRET_KEY on staging).

**Expect:** The account is created. The callback shows 'You're all set! Your Pro plan is now active' and 'Your GH₵1,490.00 payment is confirmed'. /subscription shows Pro, Yearly, with period end about 365 days out. In the failure case the account still exists and the user lands on /subscription?tier=pro&billingCycle=yearly&checkoutError=1 with the 'Your account is ready, but we couldn’t open payment...' alert and the checkout dialog pre-opened. No charge is made.

**Needs:** Paystack test keys, email provider for verification email

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`

## SUBS-016 · P0 · Web Pro monthly purchase by card: amounts, activation and records

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** User U1 on Free with a verified email. Paystack test keys. Webhook URL set to https://<staging-api>/api/v1/webhooks/paystack. PUBLIC_WEB_URL set to the staging web origin.

**Steps:**

1. Open /subscription. Confirm the current plan card shows Community.
2. Click 'Choose Pro'. Dialog 'Upgrade to Pro' shows 'Billed monthly' and 'Total due today GH₵149.00'.
3. Click 'Continue to payment'. Paystack shows GH₵149.00 and the reference begins 'sub-'.
4. Pay with the Paystack test success card.
5. Observe the redirect to /subscription/callback?checkout=<id>&reference=sub-... and the polling state.
6. Open /subscription; open Admin > Subscriptions and find U1.
7. Call GET /api/v1/subscriptions/mine and GET /api/v1/subscriptions/checkout/<id>.

**Expect:** The callback shows 'Confirming your subscription…', then 'You're all set!', 'Your Pro plan is now active' and 'Your GH₵149.00 payment is confirmed'. The subscription has tier pro, status active, billingCycle monthly and currentPeriodEnd = activation + 30 days. The checkout is SUCCEEDED with baseAmount 149, discountAmount 0, finalAmount 149, GHS and providerRef = the Paystack reference. The Paystack transaction is 14900 pesewas in GHS. The admin list shows U1 as Pro/active, and the export has Provider web.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-017 · P0 · Web yearly purchase for each paid tier

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Three Free users. Paystack test keys.

**Steps:**

1. User A: toggle Yearly, 'Choose Plus', and pay.
2. User B: Yearly Pro.
3. User C: Yearly Organization.
4. For each, read the plan card price (price/12) vs dialog total vs Paystack amount vs checkout finalAmount.

**Expect:** Cards show the monthly equivalents 40.83, 124.17 and 332.50. Dialogs and Paystack charge the full 490.00, 1,490.00 and 3,990.00. Each subscription is yearly with currentPeriodEnd = activation + 365 days. No rounding drift between the displayed total and the charged amount.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-018 · P0 · Mobile money payment, including delayed approval

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User on Free. Paystack test mode with the Mobile Money channel enabled for GHS.

**Steps:**

1. 'Choose Plus' then 'Continue to payment'. On Paystack pick Mobile Money and use the Paystack test MoMo number.
2. Delay approving the prompt for more than 30 seconds.
3. Watch the callback reach the 'Still confirming your subscription' timeout state, then approve the MoMo prompt.
4. Click 'Keep checking'.

**Expect:** The timeout copy says there is no need to pay again. After approval, 'Keep checking' (or the webhook) moves the checkout to SUCCEEDED and the page shows the success state. Plus is active exactly once, with one Paystack charge.

**Needs:** Paystack test keys (MoMo test channel)

**Source:** `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`

## SUBS-019 · P0 · Declined payment fails the checkout and lets the user retry cleanly

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** User on Free. Paystack test decline card. A coupon PROMO10 (10%, perUserLimit 1).

**Steps:**

1. 'Choose Pro', enter PROMO10 and 'Continue to payment'. Pay with the test decline card.
2. Observe the callback.
3. Click 'Try again'.
4. Check the coupon redemption row for this checkout in DB.
5. Re-apply PROMO10 in the dialog.

**Expect:** The callback shows 'Payment didn’t go through' with guidance to check the payment account. The checkout is FAILED, set by the charge.failed webhook or by verify with Paystack status failed. The coupon redemption is RELEASED and the seat freed, so PROMO10 previews as valid again. 'Try again' opens /subscription?tier=pro&billingCycle=monthly with the dialog open. The subscription is still Free.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.ts`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`

## SUBS-021 · P0 · Plan activates from the webhook alone when the browser never returns

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** User on Free. Paystack webhook configured to staging.

**Steps:**

1. Start Pro checkout and pay on Paystack.
2. Close the browser before the Paystack redirect completes. Do not open the callback page.
3. Wait 1 minute, then open /subscription in a new session.
4. Check API logs for the webhook POST /api/v1/webhooks/paystack with a 200 status.

**Expect:** The signed charge.success webhook settles the checkout: tier Pro, active, 30-day period. The checkout is SUCCEEDED. No manual step is needed.

**Needs:** Paystack test keys + public webhook URL

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-022 · P0 · Plan activates from client verify when the webhook is missing

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with the Paystack webhook URL temporarily pointed elsewhere, or blocked at the firewall.

**Steps:**

1. Start Pro checkout, pay, and let Paystack redirect to /subscription/callback.
2. Observe the callback polling POST /subscriptions/checkout/reference/<ref>/verify.
3. Restore the webhook URL, then use Paystack's 'resend webhook' for that transaction.

**Expect:** Verify calls Paystack's verify API, matches the reference, currency and amount, and settles. The UI shows success. The later webhook resend is a no-op: same period end, single coupon increment, single commission.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`

## SUBS-023 · P0 · Replayed and concurrent settlements do not double-apply

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** User U3 referred by AFF (pending referral). Coupon C10 (10%, maxRedemptions 100). Paystack test keys.

**Steps:**

1. U3 buys Pro monthly with C10 (GH₵134.10).
2. Open the callback in 2 browser tabs at the same time so both poll verify while the webhook also arrives.
3. From the Paystack dashboard resend the charge.success webhook 3 times.
4. Read the subscription currentPeriodEnd, coupon.redemptions, the coupon redemption rows, affiliatecommissions and the affiliate balance.

**Expect:** Exactly one settlement: currentPeriodEnd does not move after the first settle. coupon.redemptions increments by 1, and there is one CONSUMED redemption linked to the subscription id. There is one commission row for the sub- reference, and the pending balance is credited once. All webhook calls return 200.

**Needs:** Paystack test keys, MongoDB replica set (transactions)

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.ts`

## SUBS-024 · P0 · Paystack webhook authenticity and unknown references

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging API URL. PAYSTACK_SECRET_KEY known to the tester for signing test payloads.

**Steps:**

1. POST /api/v1/webhooks/paystack with a valid charge.success body for a real pending sub- checkout but a wrong x-paystack-signature.
2. POST with no signature.
3. POST a correctly signed charge.success for reference 'sub-deadbeef' (nonexistent).
4. POST a correctly signed malformed JSON body.

**Expect:** A bad or missing signature returns 401 and the checkout stays pending. An unknown sub- reference returns 200 with no state change. Malformed JSON returns 400. No entitlement is granted without a valid signature.

**Needs:** Paystack secret (staging)

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/paystackWebhookRoutes.ts`

## SUBS-026 · P0 · Two checkouts in parallel can double-charge

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** User on Free. Two browser tabs on /subscription.

**Steps:**

1. Tab 1: 'Choose Pro', then 'Continue to payment'. Keep the Paystack page open.
2. Tab 2: 'Choose Pro', then 'Continue to payment'.
3. Pay both with the test card.
4. Check Paystack transactions, checkout rows and the subscription period.

**Expect:** Current code allows both checkouts, so two GH₵149 charges succeed. The second settlement overwrites the period (now + 30 days), so the user is not given 60 days. Record this. Decide whether to block a new checkout while one is pending or a paid plan is active, or to refund duplicates, and document the support refund procedure. The 'Continue to payment' button is disabled while starting, so a double-click within one tab must produce only one checkout.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-027 · P0 · Mid-period web upgrade: price, period and proration disclosure

*Surfaces:* api, marketing, web  ·  *Type:* compliance

**Before:** User U2 on Plus monthly, activated 10 days ago (staging: adjust currentPeriodStart and End).

**Steps:**

1. Open /subscription and click 'Choose Pro'. Read the dialog text and total.
2. Pay GH₵149.
3. Read the subscription currentPeriodStart and End.
4. Read ujimora.com/billing-terms sections 4 (Upgrades) and 3 (Renewal).

**Expect:** Current behavior: the full Pro price is charged with no credit for about 20 unused Plus days, and the period restarts at 30 days from now. The dialog discloses no proration rule. Billing terms say upgrades follow 'the displayed billing and proration rules', so either display the rule ('No credit for remaining time; new 30-day period starts today') or implement proration. Launch blocker for consumer-protection accuracy.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `packages/types/src/legal.ts`

## SUBS-030 · P0 · Web subscription expiry, same-plan renewal and entitlement fallback

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** User U2 on Pro monthly (web). Staging DB access to set currentPeriodEnd to 1 minute ago.

**Steps:**

1. Set U2's currentPeriodEnd to the past.
2. Open /subscription. Read the plan card chip, the 'Renews in' value and the Pro card button.
3. Try to buy Pro again from the UI.
4. Try to start a LIVE session and create a 2nd campaign.
5. Open Admin > Subscriptions and read U2's status.
6. POST /api/v1/subscriptions/checkout {tier:'pro'} via API.

**Expect:** Entitlements revert to Community: LIVE returns 403 'Your Community plan does not include LIVE streaming', and the campaign cap is 1. Record UI defects. The chip still says 'Active' with 'Renews in 0 days'. The Pro card shows disabled 'Current Plan' because isCurrent compares tier only, so the user cannot renew Pro from the UI (the API allows it). The admin still shows status active and counts U2 in revenue. Renewal of the same tier must work before launch.

**Needs:** Staging DB

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/admin/src/pages/SubscriptionsPage.tsx`

## SUBS-031 · P0 · Web subscriptions do not auto-renew: disclosure and reminders

*Surfaces:* api, email, marketing, web  ·  *Type:* compliance

**Before:** User U2 on Plus monthly (web). Activity alerts: enable 'Subscription updates' for in-app and email in profile settings.

**Steps:**

1. Read the checkout dialog ('Billed monthly. You can cancel anytime.'), the /subscription 'Renews in N days' label, and ujimora.com/billing-terms section 3.
2. Let the period end (staging: set currentPeriodEnd to past) and wait 2 minutes for the activity sweep.
3. Check the Paystack dashboard for any automatic charge.
4. Check in-app notifications and email.

**Expect:** No automatic charge happens. The code has no Paystack authorization reuse or renewal job. An opted-in user gets 'Subscription expired' in-app or by email. Launch blocker (legal/consumer): copy says 'Renews' and the billing terms say subscriptions renew. Either build renewal (with consent to charge a stored authorization) or change all copy to 'Access until <date>; buy again to continue', plus a pre-expiry reminder.

**Needs:** Email provider (activity email), Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `packages/types/src/legal.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/application/use-cases/CancelSubscriptionUseCase.ts`

## SUBS-034 · P0 · Users cannot read other users' checkouts or subscriptions

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Users A and B. A has a checkout id and sub- reference.

**Steps:**

1. As B: GET /api/v1/subscriptions/checkout/<A id>; POST /checkout/<A id>/verify; POST /checkout/reference/<A ref>/verify.
2. As B open /subscription/callback?checkout=<A id>.
3. Logged out: GET /subscriptions/mine, POST /subscriptions/checkout, POST /subscriptions/cancel.
4. As a normal user and an organization user: GET /api/v1/subscriptions (admin list).

**Expect:** B's API calls get 404 'Subscription checkout not found' with no data leak. B's callback page ends in 'Still confirming' and never shows A's plan or amount. Logged-out calls return 401. The admin list returns 403 for non-admins.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`

## SUBS-039 · P0 · Percent coupon: preview matches the charge and redemption is recorded

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin creates coupon SAVE33: percent 33, subscriptions surface, all tiers and cycles, maxRedemptions 10, perUserLimit 1, commission basis 'Amount actually charged'. User U1 on Free.

**Steps:**

1. U1: 'Choose Plus' (monthly), type 'save33' in 'Coupon code (optional)'.
2. Read the preview and 'Total due today'.
3. Toggle to Yearly (close and reopen with Yearly) and re-check.
4. Go back to Monthly and 'Continue to payment'. Confirm the Paystack amount, then pay.
5. Admin > Coupons: check the redemptions count. In DB check couponredemptions.

**Expect:** The code is upper-cased. The preview shows 'Coupon applied — you save GH₵16.17', 49.00 struck through, and a total of GH₵32.83. Yearly shows 490, with 161.70 off and a 328.30 total. Paystack charges 3283 pesewas. After settlement coupon.redemptions = 1, and the redemption is CONSUMED with surface subscription, tier starter, the amounts, and subscriptionId linked. The checkout row has couponId and couponCode SAVE33.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/CouponService.ts`, `apps/api/src/application/use-cases/PreviewCouponUseCase.ts`, `apps/api/src/domain/entities/Coupon.ts`, `apps/web/src/hooks/useCouponPreview.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-040 · P0 · Fixed, capped and minimum-subtotal coupons compute correct amounts

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Coupons: FLAT20 (fixed 20). HALFCAP (percent 50, maxDiscountAmount 100). MIN200 (percent 10, minSubtotal 200). BIGFLAT (fixed 1000).

**Steps:**

1. Preview each via the dialog: FLAT20 on Pro monthly; HALFCAP on Pro yearly and on Plus monthly; MIN200 on Plus monthly and on Pro yearly; BIGFLAT on Pro monthly.
2. Complete one paid checkout with HALFCAP on Pro yearly and one with BIGFLAT.

**Expect:** FLAT20: 149 to 129.00. HALFCAP Pro yearly: discount capped at 100.00, final 1,390.00. HALFCAP Plus monthly: 24.50 off, 24.50 final. MIN200 on Plus monthly: invalid, 'requires a minimum subtotal of 200 GHS'. MIN200 on Pro yearly: 149.00 off, 1,341.00. BIGFLAT: discount clamps to 149, final 0.00, button 'Activate plan', activates without a Paystack charge. Paystack amounts equal final × 100 exactly.

**Needs:** Paystack test keys

**Source:** `apps/api/src/domain/entities/Coupon.ts`, `apps/api/src/application/services/CouponService.ts`

## SUBS-041 · P0 · 100%-off coupon activates without payment exactly once

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Coupon FREEPRO: percent 100, tiers [pro], perUserLimit 1, maxRedemptions 5. User on Free.

**Steps:**

1. 'Choose Pro', enter FREEPRO. Button changes to 'Activate plan'. Click it.
2. Observe the redirect to /subscription/callback?checkout=<id>.
3. Double-click 'Activate plan' quickly in a second attempt with another user.
4. Check Paystack for transactions and the DB for the checkout providerRef.

**Expect:** There is no Paystack redirect and no transaction. The checkout is SUCCEEDED with providerRef 'sub_free_<uuid>' and finalAmount 0. The callback says the coupon covered the full price. Pro is active for 30 days, redemptions +1. A double click creates only one checkout, because the button is disabled while loading. A retry by the same user returns 422 'already used'.

**Needs:** Paystack configured (required even for the free path)

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-043 · P0 · Per-user coupon seat race is closed

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Coupon ONE (10%, perUserLimit 1). User on Free with two tabs.

**Steps:**

1. In both tabs open the Plus dialog with ONE and click 'Continue to payment' at the same moment (or fire two parallel API calls).
2. Complete payment in the winning tab.

**Expect:** One checkout gets a seat and a Paystack URL. The other gets 422 'You have already used this coupon the maximum number of times', and its checkout row is FAILED. No discounted charge is opened without a seat. The discount is applied exactly once.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.ts`

## SUBS-047 · P0 · Affiliate referral code in the coupon box: discount and commission

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** AFF enrolled with code 'kwame-gh', status active, no per-affiliate rate. Referral discount 10% (Admin > Settings 'Referral discount (%)'). Commission 10%. User U4 on Free, not referred.

**Steps:**

1. U4: 'Choose Pro', type 'KWAME-GH' in the coupon box.
2. Read the preview, then pay.
3. Check the checkout row (couponCode set, couponId empty), affiliatereferrals, affiliatecommissions and the balance.
4. AFF: open /affiliate dashboard.

**Expect:** The preview is valid: 14.90 off, total GH₵134.10, and Paystack charges 13410 pesewas. The referral is created (refereeId U4, pending) and becomes converted at settlement. Commission is 14.90, computed on the list price of 149 because the platform funds the referral discount, and it is held for 14 days. The checkout stores couponCode 'kwame-gh' and discountAmount 14.90 with no couponId.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/AffiliateCodePricing.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/PreviewCouponUseCase.ts`, `apps/admin/src/components/ReferralDiscountSettings.tsx`

## SUBS-049 · P0 · Affiliate commission is one-time only

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Referred user R1 who already converted (see SUBS-048).

**Steps:**

1. R1 buys Pro monthly (upgrade).
2. R1 enters AFF's code in the coupon box on a later checkout.
3. Replay the first charge.success webhook.

**Expect:** No new commission rows. The affiliate code no longer discounts: it previews as 'Coupon not found' because the referral is not pending. The replay does not duplicate anything. AFF's balance is unchanged.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/application/services/AffiliateCodePricing.ts`

## SUBS-051 · P0 · Subscription refund reverses the commission; entitlement policy

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** R1 converted with a held commission of 14.90. R6 converted with a commission already matured to available. Paystack test mode supports refunds.

**Steps:**

1. In the Paystack dashboard refund R1's sub- transaction in full.
2. Wait for the refund.processed webhook and check the commission status and AFF's pending balance.
3. Refund R6's transaction and check the available balance.
4. Check R1's and R6's subscription tier and status after the refund.

**Expect:** R1's commission becomes reversed and the pending balance drops by 14.90. R6's becomes reversed and the available balance drops. A replayed refund webhook is a no-op. If a commission was already paid out, it is marked reversed with a warning log for manual clawback. Record: the refunded user KEEPS the paid plan, because no code revokes entitlement on refund. Decide the policy and write down the operator procedure.

**Needs:** Paystack test keys (refunds)

**Operator note:** a refund only takes back plan time for a charge listed in the subscription's `paymentReferences`. Web plans settled before that field existed need `MONGODB_URI=… tsx apps/api/scripts/backfill-subscription-payment-references.ts` run once per environment (dry run first, then `--apply`); rows it lists as `unmatched` need a manual decision.

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.ts`

## SUBS-055 · P0 · Active campaign cap per plan

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Identity verification approved (so the verification allowance does not bind). Free user F with 1 active campaign. Plus user P with 3. Pro user with 9.

**Steps:**

1. F: web /campaigns/new (campaign form) and native Create campaign.
2. F: POST /api/v1/campaigns directly.
3. P: repeat. The Pro user creates a 10th campaign, then an 11th.
4. F upgrades to Plus via web and retries immediately.

**Expect:** The form shows 'Your plan’s active campaign limit has been reached' with a 'Manage plan' link to /subscription. Native shows 'Your plan’s active campaign allowance is full' with 'Review eligibility', which opens the native Subscription screen. The API returns 403 'Your Community plan allows 1 active campaign. Upgrade to create more.' Pro's 10th succeeds and the 11th is blocked. After F upgrades, creation succeeds with no re-login.

**Needs:** None

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`

## SUBS-056 · P0 · Campaign goal cap is the minimum of the plan cap and the compliance cap

*Surfaces:* api, ios, web  ·  *Type:* functional

**Before:** Free user (plan cap 10,000). Plus user whose account has complianceApprovedCampaignLimit 20,000 (set by admin compliance action). Enterprise user (-1).

**Steps:**

1. Free: create with goal 10,001 on web and native.
2. Plus: create with goal 30,000.
3. Enterprise: create with goal 6,000,000.

**Expect:** Free is rejected with 422 'Your Community plan caps campaign goals at GHS 10,000. Upgrade for a higher goal.' Plus is rejected with 422 'A compliance review has capped your campaign goals at GHS 20,000.', and the form shows 'A higher plan does not override an account-specific compliance cap'. Enterprise has no plan ceiling, but staff-approval rules above GHS 250,000 still apply. The creation screen shows 'Current goal limit' correctly.

**Needs:** None

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`

## SUBS-058 · P0 · LIVE streaming follows the owner's plan

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** LIVEKIT_* configured on staging. Campaign owners on Free, Plus and Pro, each with an active campaign. Admin.

**Steps:**

1. The Free owner tries 'Go live' (web live page, native campaign/live).
2. The Plus owner tries.
3. The Pro owner starts a session, stops it, and then their Pro expires (staging DB).
4. The expired owner tries again. The admin tries to start LIVE on the expired owner's campaign.
5. Admin toggles liveStreaming off for Pro in Admin > Plans. An active Pro owner tries.

**Expect:** Free and Plus get 403 'Your Community/Plus plan does not include LIVE streaming. Upgrade to unlock it.' Pro succeeds. After expiry: 403. Admin on the owner's behalf: 403, because the owner's plan applies. After the admin toggle, Pro users are blocked immediately. An already-active session is not force-stopped; record whether that is intended.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/mobile/app/campaign/live.tsx`

## SUBS-062 · P0 · Advertised plan benefits are actually delivered

*Surfaces:* api, ios, marketing, web  ·  *Type:* compliance

**Before:** Organization-plan user (maxTeamMembers 10). Plus user (maxTeamMembers 1). Pro user (featuredListing, prioritySupport, advancedAnalytics toggles as seeded).

**Steps:**

1. On /subscription's Feature comparison and marketing /pricing, list every benefit shown: Team members, Featured listing, Priority support, Advanced analytics, Custom branding, Escrow & milestones.
2. Plus user: invite 2 organization team members.
3. Pro user: look for featured placement, advanced analytics and custom branding in the product.
4. Search the API for server enforcement of each.

**Expect:** Every advertised benefit must be delivered or enforced. Current code has no maxTeamMembers enforcement on the organization team invite, and no implementation behind featuredListing, prioritySupport, advancedAnalytics or customBranding. Launch blocker for truthful advertising (and for App Review 2.3 / 3.1.2 if shown in native): remove the rows, mark them 'coming soon', or implement them.

**Needs:** None

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/PricingPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `packages/types/src/subscription.ts`

## SUBS-063 · P0 · iOS sandbox purchase with server verification

*Surfaces:* admin, api, ios  ·  *Type:* functional

**Before:** TestFlight or dev build with bundle com.ujimora.app. App Store Connect products for each catalog entry, in ONE subscription group. Sandbox tester Apple ID. Staging API with STORE_BILLING_ENABLED=true, APPLE_IAP_ENVIRONMENT=sandbox, a valid catalog and a receipt key. Ujimora user U5 on Free with no prior web checkout.

**Steps:**

1. Sign in as U5. Profile > Subscription.
2. Check CURRENT PLAN 'Community', the Monthly/Yearly toggles, store-localized prices ('<price> / month'), and the Subscribe buttons.
3. Tap Subscribe on Pro Monthly and complete the Apple sheet with the sandbox account.
4. Observe the messages ('Follow the store confirmation...', then 'Your subscription is active.').
5. Check GET /subscriptions/mine, the storepurchases row and storebillingaccounts (provider apple).
6. On web, log in as U5 and open /subscription.

**Expect:** Verify succeeds: tier pro, status active, billingProvider apple, and currentPeriodEnd equals Apple's expiresDate (sandbox monthly = about 5 minutes). The transaction is finished after verify. The native card shows 'Access through <date>' and 'Manage App Store subscription'. Web shows 'Your subscription is billed through App Store...' with a 'Manage subscription' link to apps.apple.com/account/subscriptions. Choose buttons are disabled and Cancel is hidden.

**Needs:** App Store sandbox, Apple IAP API keys

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/mobile/src/lib/storeBilling.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-064 · P0 · Android license-tester purchase and acknowledgement

*Surfaces:* admin, android, api  ·  *Type:* functional

**Before:** Internal-testing build (com.ujimora.app). Play subscriptions with base plans matching STORE_BILLING_PRODUCTS (productId plus basePlanId). License tester account. GOOGLE_PLAY_ALLOW_TEST_PURCHASES=true on staging. User U6 on Free.

**Steps:**

1. Profile > Subscription > Pro Monthly > Subscribe. Pay with 'Test card, always approves'.
2. Check the app message, the API subscription and the storepurchases row (acknowledgementPending).
3. In Play Console > Order management, check the order is acknowledged.
4. Wait more than 5 minutes (test renewal cadence) and re-check periodEnd.

**Expect:** Active Pro with billingProvider google. The server acknowledges (acknowledgementPending false) and the app does not acknowledge again. The order shows as acknowledged, not auto-refunded after 3 days. The renewal extends periodEnd via RTDN or the 15-minute re-check.

**Needs:** Google Play Console, license testers, Play Developer API service account

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/mobile/src/lib/storeBilling.ts`

## SUBS-065 · P0 · Restore purchases after reinstall and on a second device

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** U5 with an active Apple sub (SUBS-063). U6 with an active Google sub.

**Steps:**

1. Delete and reinstall the app. Sign in as U5. Open Subscription (auto-restore runs on connect).
2. Tap 'Restore purchases'.
3. On a second iPhone with the same Apple ID, sign in as U5 and tap Restore.
4. Repeat on Android for U6.
5. As a Free user with no purchases, tap 'Restore purchases'.

**Expect:** Access is shown as Pro. Restore shows 'Your purchases have been restored.' with no duplicate rows and no new charge. The user with no purchases sees 'No active subscription was restored for this account.' The button is always visible (Apple requirement).

**Needs:** Store sandbox

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`

## SUBS-066 · P0 · A purchase cannot be moved to another Ujimora account

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** Apple ID with U5's active Pro. Second Ujimora user U7 (Free) on the same device.

**Steps:**

1. Sign out U5, sign in as U7 on the same device. Open Subscription (auto-restore) and tap 'Restore purchases'.
2. U7 taps Subscribe on Pro (Apple reports already subscribed in this group).
3. Repeat on Android with U6's Google account and another user.

**Expect:** Restore reports 'Some purchases could not be restored...', or 'This purchase belongs to a different Ujimora account. Sign in to the account used for the purchase.' (403). U7 stays Community. U5's entitlement is untouched. No storepurchases row is re-owned.

**Needs:** Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/mobile/src/lib/storeBilling.ts`

## SUBS-070 · P0 · Interrupted purchase is recovered

*Surfaces:* android, api, ios  ·  *Type:* recovery/idempotency

**Before:** Store sandbox. Ability to toggle airplane mode.

**Steps:**

1. Tap Subscribe and complete the store payment, then immediately enable airplane mode before 'Your subscription is active.' appears.
2. Force-quit the app. Wait 2 minutes, disable airplane mode and relaunch. Open Subscription.
3. Separately: complete a purchase and never reopen the app. Check the server within 5 minutes.

**Expect:** On relaunch or resume, auto-restore verifies and grants access, and the Apple transaction is then finished. In the never-reopen case the store notification (Apple SUBSCRIBED / Google SUBSCRIPTION_PURCHASED) is processed by the 60s sweep, which grants access and, on Google, acknowledges. No double charge.

**Needs:** Store sandbox + notification URLs

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/api/src/app.ts`

## SUBS-071 · P0 · Store upgrade, downgrade and crossgrade

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** U5 on Apple Plus monthly. U6 on Google Plus monthly. All products in one Apple group.

**Steps:**

1. iOS: tap 'Change plan' on Pro Monthly and confirm.
2. iOS: from Pro, choose Plus Monthly (downgrade).
3. iOS: Pro Monthly to Pro Yearly (crossgrade).
4. Android: repeat the upgrade (with-time-proration replacement) and downgrade.
5. After each step, read the subscription tier and cycle, and the storepurchases replacedBy and active fields.

**Expect:** iOS upgrade is immediate: tier pro, and the old transaction is marked upgraded. The iOS downgrade takes effect at renewal, so tier stays pro until then. Crossgrade follows Apple rules. On Android the new token links the old one: the old row gets active false and replacedBy set, and the tier updates immediately with store proration. The store shows its own proration message before confirmation. Never two active entitlements.

**Needs:** Store sandbox

**Source:** `apps/mobile/src/lib/storeBilling.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`

## SUBS-072 · P0 · Store renewal and turning auto-renew off

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Active sandbox subscriptions on both stores.

**Steps:**

1. Let 2 renewal cycles pass (Apple sandbox monthly = 5 min; Google test = 5 min). Check periodEnd each time.
2. Turn off auto-renew in iOS Settings > Apple ID > Subscriptions and in Play Store > Subscriptions ('Manage App Store subscription' / 'Manage Google Play subscription' buttons).
3. Reopen the app Subscription screen and web /subscription.
4. Wait past the final period end.

**Expect:** periodEnd advances on each renewal, driven by notifications or the 15-minute re-check. After auto-renew is turned off, cancelAtPeriodEnd is true and native shows 'Automatic renewal is off.' Access continues to the end. Then status becomes expired, the entitlement is Community, and web and native show Community.

**Needs:** Store sandbox + notification URLs

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-074 · P0 · Store refund or revocation removes access

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Active Google test subscription. Apple StoreKit/Xcode refund testing or a sandbox refund request.

**Steps:**

1. Play Console > Order management > Refund, with 'Revoke access' selected.
2. Wait for the voidedPurchaseNotification / RTDN and the sweep.
3. iOS: issue a refund (StoreKit Transaction Manager or beginRefundRequest in sandbox) so a REFUND notification is sent.

**Expect:** The server re-fetches store state and the subscription becomes expired. Access falls to Community within the sweep interval. No Paystack refund or entitlement code is involved. The admin queue stays empty unless verification fails.

**Needs:** Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`

## SUBS-075 · P0 · Duplicate store subscription for the same Ujimora account

*Surfaces:* admin, android, api, ios  ·  *Type:* negative/edge

**Before:** U5 has an active Apple Pro bought with Apple ID A. A second device is signed into Apple ID B.

**Steps:**

1. On device 2 sign into Ujimora as U5 (with Apple ID B). Subscribe to Plus.
2. Observe the result. Check whether Apple ID B was charged.
3. Check the admin Store billing recovery queue.

**Expect:** The server refuses: 409 'Another subscription is already active. Contact support to review the duplicate purchase.' U5 keeps Pro. Apple ID B has still been charged and the transaction stays unfinished. Write a support procedure (direct the user to Apple refund). Confirm whether this appears in the admin queue: the write is rolled back, so it likely does not. Consider warning before purchase when a paid plan is already active.

**Needs:** Store sandbox (2 sandbox Apple IDs)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-076 · P0 · Native behavior when store billing is disabled

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Staging with STORE_BILLING_ENABLED unset (this is the render.yaml default, which has no store keys). A user with an existing store purchase.

**Steps:**

1. Open Profile > Subscription.
2. Tap 'Restore purchases' and 'Refresh'.
3. POST /api/v1/store-billing/prepare and /verify.
4. POST /api/v1/webhooks/store/apple and /google.

**Expect:** The native screen shows 'New store purchases are temporarily unavailable. Your existing plan and free features remain available.' No Subscribe buttons, and no Paystack or web fallback. Prepare and verify return 503. Webhooks return 503, so the stores retry. Before launch, confirm production has STORE_BILLING_ENABLED=true and the full catalog, otherwise native apps cannot sell plans.

**Needs:** None

**Source:** `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `render.yaml`

## SUBS-078 · P0 · Web and store billing exclude each other

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** UW with an active web Pro. UA with an active Apple Pro. UG with an active Google Pro.

**Steps:**

1. UW on iOS: open Subscription; try Subscribe.
2. UA on web: /subscription; try 'Choose Organization'; POST /subscriptions/checkout; POST /subscriptions/cancel; POST /subscriptions {tier:'free'}.
3. UA on Android: open Subscription.
4. UG on iOS: open Subscription.

**Expect:** UW native: 'This account manages its subscription through another billing service...' and no plan list. Prepare returns 409 'An existing web subscription or pending payment must be resolved...' or 'manages subscriptions through web billing'. UA web: banner plus 'Manage subscription', choose buttons disabled, Cancel hidden. The API returns 409 on checkout ('...through the App Store...'), cancel and free ('Manage this subscription through the App Store or Google Play...'). UA on Android and UG on iOS see the foreign-provider message. No second subscription can be started on any rail.

**Needs:** Store sandbox, Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-079 · P0 · Native apps contain no external purchase paths for plans

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Release-candidate builds on both platforms. Free user.

**Steps:**

1. Visit every entry point: Profile > Subscription, campaign create 'Review eligibility' (at the plan cap), Creator 'View plans', the affiliate screen text, campaign live screen copy.
2. Open deep and universal links https://app.ujimora.com/subscription and /subscription/callback from Notes or Mail.
3. Search screens for 'Contact sales', Paystack, 'ujimora.com/pricing' or web subscription links.
4. Try to create a web checkout from the native client (the lib throws off-web).

**Expect:** Every path lands on the native IAP screen (resolvePath maps /subscription to /(tabs)/subscription). No Paystack, web pricing or 'buy on website' link exists for plans. Creator tips are not offered natively. Donations and wallet top-ups open Safari (iOS) as designed, but never subscriptions. This satisfies App Review 3.1.1 and the Play Payments policy.

**Needs:** Signed builds

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/src/lib/subscriptions.ts`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/creator.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`

## SUBS-080 · P0 · Native paywall disclosures (App Review 3.1.2, Play policy)

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Release-candidate builds.

**Steps:**

1. On the Subscription screen verify for each plan: title, length (month/year), store price, and 'Renews automatically at the store price unless cancelled...'.
2. Read the footer disclosure (Apple-specific or Google-specific text, including 'Deleting your Ujimora account does not cancel a store subscription').
3. Tap 'Subscription terms', 'Terms of Use' and 'Privacy Policy'.
4. Tap 'Manage App Store subscription' (iOS) or 'Manage Google Play subscription' (Android, package com.ujimora.app).

**Expect:** All required disclosures are visible before purchase. Links open in-app legal screens (/billing-terms, /terms, /privacy) with the correct content. Manage opens the OS subscription management for this app, or shows 'Could not open ... subscription settings' if unavailable. The App Store Connect description includes the EULA link.

**Needs:** Signed builds

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/mobile/app/billing-terms.tsx`, `apps/mobile/STORE_SUBMISSION.md`

## SUBS-081 · P0 · App Review and TestFlight purchases work against the production API

*Surfaces:* api, ios  ·  *Type:* compliance

**Before:** Production-like API with APPLE_IAP_ENVIRONMENT=production. App Review / TestFlight build (which uses the sandbox environment).

**Steps:**

1. Using a TestFlight build pointed at the production API, buy Pro with a sandbox tester.
2. Observe the verify response and the app message.
3. Send a sandbox App Store Server Notification (App Store Connect 'Request a Test Notification' for the sandbox URL) to /api/v1/webhooks/store/apple.

**Expect:** The expected outcome for store approval is that the purchase activates. Current verifier behavior requires transaction and renewal environment == APPLE_IAP_ENVIRONMENT, so a sandbox receipt against a production server returns 422 'The store could not verify this subscription.' and Apple's reviewer sees a failed purchase (Guideline 2.1 rejection). Sandbox notifications are rejected with 401. Launch blocker: add production-then-sandbox fallback (Apple's recommendation), or run review against a sandbox-configured API, and document which.

**Needs:** App Store Connect, TestFlight, Apple IAP keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `docs/compliance/STORE_BILLING.md`, `apps/mobile/APP_REVIEW_NOTES.md`

## SUBS-084 · P0 · Apple App Store Server Notifications V2 endpoint

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** App Store Connect > App Information: Production and Sandbox Server URLs set to https://<api>/api/v1/webhooks/store/apple, Version 2. Store billing enabled.

**Steps:**

1. Use the App Store Server API 'Request a Test Notification'.
2. Trigger real sandbox events: SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS, EXPIRED.
3. POST a tampered or unsigned signedPayload; POST with an empty body.
4. Stop the API for 5 minutes during a renewal, then restart.

**Expect:** The TEST notification returns 200 with no queue row. Real events return 200 and create an encrypted storebillingnotifications row, which the 60s sweep processes and deletes, updating the entitlement. Tampered payloads return 401 'Invalid App Store notification.' and an empty body returns 400. After an outage, Apple's retries and the boot sweep reconcile with no lost state.

**Needs:** App Store Connect, Apple IAP keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/api/src/main.ts`

## SUBS-085 · P0 · Google Play RTDN (Pub/Sub push) endpoint authentication

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Pub/Sub topic linked in Play Console > Monetization setup. Push subscription to https://<api>/api/v1/webhooks/store/google with OIDC service account = GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT and audience = GOOGLE_PLAY_RTDN_AUDIENCE.

**Steps:**

1. Play Console: 'Send test notification'.
2. Make a license-tester purchase and cancel it.
3. curl POST without an Authorization header; with a token from a different service account; with the right token but a different audience; with a valid token but packageName 'com.other.app'.
4. Send a voidedPurchaseNotification via a refund (see SUBS-074).

**Expect:** The test notification returns 200 with no work. Real notifications return 200, are queued and processed. Every authentication or package mismatch returns 401 'Invalid Google Play notification.', and Pub/Sub retries only legitimate ones. When store billing is disabled the endpoint returns 503.

**Needs:** Google Cloud Pub/Sub, Play Console

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`

## SUBS-086 · P0 · Replayed, out-of-order and orphan store notifications

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Active sandbox subscription. Ability to capture and re-POST a signed Apple payload (from logs or a proxy) and re-publish a Pub/Sub message.

**Steps:**

1. Re-POST an old DID_RENEW signedPayload after a newer EXPIRED.
2. Re-publish the same Google message 3 times quickly.
3. Send a valid notification for a purchase whose appAccountToken or obfuscatedAccountId is not in storebillingaccounts (e.g. bought against another environment's DB).
4. Open Admin > Store billing recovery.

**Expect:** State always reflects the store's current status: an old notification cannot resurrect an expired plan (the server re-fetches authoritative status, with revision fencing). Duplicates collapse into one queue row (same key, revision increments). The orphan becomes review required with 'notification review required' and a next attempt about 24 hours later, visible in the admin queue.

**Needs:** Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingAdminRoutes.ts`

## SUBS-089 · P0 · Only admins can use the billing admin endpoints and pages

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** User, organization and admin tokens. A staff RBAC role without SUBSCRIPTIONS.

**Steps:**

1. As user/org: GET /api/v1/admin/store-billing; POST /admin/store-billing/purchase/<id>/retry; GET /api/v1/subscriptions.
2. As staff without SUBSCRIPTIONS open /store-billing and /subscriptions in the admin console.
3. As admin, check the Action center shows the 'Store billing recovery' count.

**Expect:** Non-admins get 403 on every call. Console pages show access denied and the Sidebar hides the links. Admin sees the counts. Responses carry Cache-Control 'private, no-store'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingAdminRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/admin/src/router.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`

## SUBS-093 · P0 · Billing terms and in-product copy match real behavior

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Published legal pack.

**Steps:**

1. Read ujimora.com/billing-terms and native /billing-terms end to end.
2. Compare against the observed behavior in SUBS-027 (no proration), SUBS-028 (downgrade forfeits time), SUBS-031 (web does not renew), SUBS-032 (cancel), SUBS-051 (refund keeps access), SUBS-062 (unimplemented benefits), SUBS-013 (Enterprise) and store renewal rules.
3. Check that 'Checkout discloses...any taxes or fees...renewal terms' holds in the web dialog and the native paywall.

**Expect:** Every statement is true for web and for each store, or the terms and copy are corrected before launch. The web dialog must disclose renewal, or its absence, plus proration and refund terms. This must be signed off by the owner or legal.

**Needs:** None

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/mobile/app/billing-terms.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-001 · P1 · Plan catalog is consistent across marketing, signup, web /subscription, native paywall and admin

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* functional

**Before:** Staging with DB-seeded plans (API has booted once). Admin account. One logged-in normal user. Store billing enabled with at least one product per tier on each store.

**Steps:**

1. As admin open Admin > Plans (/plans). Record name, monthly and yearly price, fee % and limits for every tier.
2. Anonymously open https://<marketing>/pricing. Toggle Monthly then Yearly and compare each card with the admin values.
3. Open app.ujimora.com/register, reach the Plan step, and compare the plan names and prices shown.
4. Log in as the user, open /subscription, toggle Monthly/Yearly, and compare the cards and the Feature comparison table.
5. On iOS and Android open Profile > Subscription. Compare plan names and descriptions (prices come from the store).
6. Call GET /api/v1/plans/public anonymously and GET /api/v1/plans with the user's token.

**Expect:** Names, prices, fee % and limits match admin values on every surface. Yearly cards show price/12 as the monthly equivalent (e.g. Plus 490/12 = GH₵40.83) and the full annual total wherever the page shows it. Unlimited (-1) renders as 'Unlimited'. /plans/public returns only active && isPublic plans. Native shows store-localized prices, never the GHS web price. Plan order follows sortOrder on every surface.

**Needs:** App Store Connect / Play Console products for the native price comparison

**Source:** `packages/types/src/subscription.ts`, `apps/api/src/application/services/PlanService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PlanController.ts`, `apps/marketing/src/pages/PricingPage.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-004 · P1 · Plan edit/create validation rejects bad values and keeps tier immutable

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin token.

**Steps:**

1. PUT /api/v1/plans/pro with {} (empty).
2. PUT with {priceMonthly:-1}, {platformFeePercent:101}, {maxActiveCampaigns:-2}, {accentColor:'red'}.
3. PUT /api/v1/plans/pro with {tier:'hacked', name:'Pro'}.
4. POST /api/v1/plans with tier 'Pro Plus' (space/uppercase), then tier 'x', then tier 'pro' (duplicate).
5. In Admin > Plans > 'New plan', enter tier id 'Bad Id' and try to create.

**Expect:** Each invalid PUT returns 400 or 422 with a field message and the plan is unchanged. The tier field in the PUT is ignored: /plans/pro still exists and there is no 'hacked' tier. POST with an invalid id returns 400 'Tier id must be lowercase...'. A duplicate returns 409 'A plan with this tier id already exists'. The admin UI blocks the invalid id before calling the API.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`, `apps/api/src/application/use-cases/UpdatePlanUseCase.ts`, `apps/api/src/application/use-cases/CreatePlanUseCase.ts`, `apps/admin/src/pages/ManagePlansPage.tsx`

## SUBS-005 · P1 · Admin-created custom tier is displayed, purchasable and enforced

*Surfaces:* admin, api, marketing, web  ·  *Type:* functional

**Before:** Admin. User U1 on Free. Paystack test keys.

**Steps:**

1. Admin > Plans > 'New plan': tier id 'community_plus', name 'Community Plus', monthly 20, yearly 200, fee 3.2, maxActiveCampaigns 2, sort order between Free and Plus, Active and Public on. Click create.
2. Reload marketing /pricing and web /subscription.
3. As U1 choose Community Plus monthly, pay with the Paystack test card and wait for the callback.
4. As U1 create 2 campaigns, then try a 3rd.
5. Check the callback success heading and the admin Subscriptions list tier chip for U1.

**Expect:** The new tier appears in sortOrder position on pricing and /subscription. The GH₵20.00 charge settles and U1's tier becomes community_plus for 30 days. The 3rd active campaign is rejected with 403 'Your Community Plus plan allows 2 active campaigns'. Known gaps to record if seen: the callback page and admin list name plans from seed data, so they may show the raw id 'community_plus' instead of 'Community Plus'.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreatePlanUseCase.ts`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/admin/src/pages/SubscriptionsPage.tsx`, `apps/api/src/application/services/PlanLimitsService.ts`

## SUBS-006 · P1 · Deactivating or hiding a plan removes it from sale without breaking existing subscribers

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* functional

**Before:** Admin. User U2 with an active paid Plus web subscription. User U3 on Free. Store catalog includes a Plus product.

**Steps:**

1. In Admin > Plans > Plus > 'Edit plan', look for Active/Public toggles (the edit dialog only has Benefits toggles).
2. Via API as admin: PUT /api/v1/plans/starter {active:false}.
3. Reload marketing /pricing, /register Plan step, web /subscription (as U3) and native Subscription (as U3).
4. As U3 call POST /api/v1/subscriptions/checkout {tier:'starter', billingCycle:'monthly'}; open /subscription?tier=starter.
5. As U3 on native call prepare for the Plus product (tap Subscribe if visible).
6. As U2 create campaigns up to the Plus cap, open creator page settings, check GET /api/v1/creators policy.
7. Re-enable: PUT {active:true}.

**Expect:** The edit dialog cannot change active/isPublic after creation. File this as a UI gap, since today it needs the API. After deactivation Plus disappears from every sales surface and the native catalog. Checkout returns 400 'That subscription plan is not available', and prepare returns 422. /subscription?tier=starter does not charge. U2 keeps Plus campaign limits until period end. Confirm the intended rule for creator donations: creatorPolicy requires plan.active, so U2's creator donations become ineligible while the plan is inactive.

**Needs:** Store billing staging config

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/api/src/application/services/PlanLimitsService.ts`

## SUBS-007 · P1 · Non-public (negotiated) plans cannot be self-purchased on web

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Admin creates tier 'partner_ngo' with Active=on, Public=off, monthly 10. User U1 on Free. Paystack test keys.

**Steps:**

1. As U1 GET /api/v1/plans and check whether partner_ngo is returned.
2. As U1 open /subscription?tier=partner_ngo&billingCycle=monthly.
3. As U1 POST /api/v1/subscriptions/checkout {tier:'partner_ngo', billingCycle:'monthly'}.
4. If an authorizationUrl is returned, pay with a test card.

**Expect:** The intended behavior is that non-public plans are not purchasable by arbitrary users. Current code checks only plan.active at checkout (the store catalog also requires isPublic), so a hidden plan is likely purchasable through the API and the ?tier= deep link. It is also listed by the authenticated GET /plans. Record the result. If U1 activates partner_ngo, that is a launch-blocking entitlement bypass whenever hidden plans are priced below their benefits.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PlanController.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-008 · P1 · Zero-priced cycle on a paid plan activates without payment

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Admin. User U1 on Free. Staging only.

**Steps:**

1. As admin PUT /api/v1/plans/starter {priceYearly:0} (monthly stays 49).
2. As U1 open /subscription, toggle Yearly and click 'Choose Plus'.
3. Read the dialog button label, then click it.
4. Revert priceYearly to 490.

**Expect:** The dialog shows GH₵0.00 and the button label is 'Activate plan'. Plus activates for 365 days with no Paystack charge (activatedWithoutCharge). This is how the code works, so treat it as a money-control check: confirm admins know a 0 price means free activation. Consider requiring a confirm step or rejecting 0 for paid tiers. Nobody should be able to reach this state in production accidentally.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`

## SUBS-013 · P1 · Enterprise is not accidentally sold as self-serve at signup

*Surfaces:* api, marketing, web  ·  *Type:* compliance

**Before:** New email. Paystack test keys. Seed Enterprise is active and public (1500/15000).

**Steps:**

1. On /register Plan step, check whether Enterprise is selectable and what price it shows.
2. Select Enterprise Monthly and submit.
3. Compare with /subscription (Enterprise card shows 'Contact sales') and marketing /pricing ('Contact sales' → /contact).
4. As a logged-in user POST /api/v1/subscriptions/checkout {tier:'enterprise', billingCycle:'monthly'}.

**Expect:** The product decision is needed: Enterprise should be 'Contact sales' everywhere. Current code lists Enterprise in the signup PAID_TIERS and opens a GH₵1,500 Paystack checkout, and the API accepts an enterprise checkout. Record whether a card can buy Enterprise. If Enterprise must be negotiated, this is a launch blocker: set isPublic=false (see SUBS-007) and remove it from signup. Also note Organization is missing from the signup plan list.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/PricingPage.tsx`, `packages/types/src/subscription.ts`

## SUBS-014 · P1 · Enterprise contact channels reach staff

*Surfaces:* admin, api, email, marketing, web  ·  *Type:* functional

**Before:** sales@ujimora.com mailbox provisioned. Admin with CONTACT_SUBMISSIONS permission.

**Steps:**

1. On web /subscription click Enterprise 'Contact sales' and confirm the mail client opens to sales@ujimora.com with subject 'Enterprise plan enquiry'. Send a test email.
2. On marketing /contact submit the form with inquiry type 'Partnership', a valid email, a subject and a message of at least 10 characters.
3. Submit 11 times within 15 minutes.
4. In Admin > Contact submissions find the message, set status In progress with admin notes, then Resolved.
5. Submit invalid data: message of 5 characters, invalid email.

**Expect:** The email arrives in the sales mailbox. The form shows 'Message sent successfully!' and the submission appears in admin with the correct type. Status changes persist, and non-admins get 403 on GET /api/v1/contact. The 11th submission is rate-limited (429 with a friendly error). Invalid input shows a validation error. Note there is no 'Enterprise/Sales' inquiry type; confirm staff triage 'Partnership' for enterprise leads.

**Needs:** Email provider / sales mailbox

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/ContactPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/contactRoutes.ts`, `apps/admin/src/pages/ContactSubmissionsPage.tsx`

## SUBS-015 · P1 · Referral link at signup, then a paid plan, earns the affiliate commission

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Affiliate AFF enrolled (GET /affiliate shows referralCode, status active). Default commission 10%, hold 14 days. New email. Paystack test keys.

**Steps:**

1. Open app.ujimora.com/?ref=<AFF code>, then /register. Confirm 'Referral code (optional)' is prefilled.
2. Register with Pro Monthly and pay GH₵149 with the test card.
3. As AFF open /affiliate and view the Referrals and Commissions tabs.
4. In DB check affiliatereferrals for the referee (status) and affiliatecommissions (sourceRef = the sub- reference).

**Expect:** The referral is created at registration and becomes 'converted' after settlement. One commission: amount 14.90, baseAmount 149, rate 10, status held, maturesAt = now + 14 days. The affiliate's pending balance increases by 14.90. The referee paid full price: the signup checkout sends no code, so no referral discount applies. Confirm that is the intended business rule.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-020 · P1 · Abandoned Paystack checkout leaves a PENDING row that affects later purchases

*Surfaces:* android, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** User U1 on Free, never subscribed. Coupon ONCE (perUserLimit 1). Store billing enabled.

**Steps:**

1. 'Choose Plus' with coupon ONCE, 'Continue to payment', then close the Paystack tab without paying.
2. Return to /subscription and note the 'Returning from payment? Check your latest checkout' banner. Click 'Check payment'.
3. Try PROMO ONCE again in a new checkout.
4. Wait more than 1 hour and re-check the checkout status.
5. On iOS, sign in as U1, open Subscription and tap Subscribe on any plan.

**Expect:** Current behavior to record: the checkout stays 'pending' indefinitely. There is no expiry job, and Paystack's 'abandoned' status is not handled by verify, so the callback times out. The ONCE seat stays held, so the coupon now reports 'You have already used this coupon the maximum number of times'. The account's provider claim is 'web', so native prepare returns 409 'This account manages subscriptions through web billing'. The banner never clears. Decide before launch whether abandoned checkouts must expire and release seats and the provider claim. This affects conversion and support load.

**Needs:** Paystack test keys, store sandbox

**Source:** `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.ts`, `apps/web/src/lib/subscriptions.ts`

## SUBS-025 · P1 · Payment amount or currency mismatch is refused

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging DB write access. User with a pending Pro checkout paid in Paystack test mode.

**Steps:**

1. Before verifying, change the pending checkout's finalAmount in DB to 1.00, then call POST /subscriptions/checkout/<id>/verify.
2. Repeat with the checkout currency changed to USD.
3. Separately, for a new pending checkout, send a correctly signed charge.success webhook whose data.amount differs from finalAmount.

**Expect:** Verify returns 409 'Payment does not match this subscription checkout' and does not activate. Record the webhook path result: charge.success for a sub- reference settles without comparing amount or currency. Assess whether that is acceptable, given amounts are fixed at initialize. A server-side amount check on the webhook is recommended.

**Needs:** Paystack test keys, staging DB

**Source:** `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`

## SUBS-028 · P1 · Web downgrade by buying a cheaper tier

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User U2 on Pro monthly, 5 days into the period, with 5 active campaigns and 2 collaborators on one campaign.

**Steps:**

1. On /subscription click 'Choose Plus' and pay GH₵49.
2. Check the subscription, campaign list and creation options.
3. Try to create a new campaign and invite a collaborator.

**Expect:** Plus activates immediately with a new 30-day period. The Pro remainder is forfeited; confirm this matches the billing terms and is disclosed. Existing 5 campaigns stay live, per billing terms section 5. Creating a campaign is blocked (403, Plus allows 3). Inviting a collaborator is blocked (Plus has no collaboration). Existing collaborators are not removed.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `packages/types/src/legal.ts`

## SUBS-032 · P1 · Cancel a web subscription

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User U2 on Pro (web, active). User U1 on Free.

**Steps:**

1. U2: /subscription > 'Cancel subscription' > read the dialog > 'Confirm Cancel'.
2. Reload. Check the cancel button, the plan card and GET /subscriptions/mine.
3. U2: POST /api/v1/subscriptions/cancel again.
4. U1: POST /api/v1/subscriptions/cancel.
5. U2: verify Pro features (LIVE) still work until period end.

**Expect:** The dialog states access continues until <period end date>, then Free. The API sets cancelAtPeriodEnd=true and leaves tier and status unchanged. A second cancel returns 409 'already scheduled for cancellation'. Free-user cancel returns 400. Pro features keep working until period end. Record: the page still shows 'Renews in' after cancelling, and there is no 'resume' option. Cancel is cosmetic, because web plans do not renew (see SUBS-031).

**Needs:** None

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/use-cases/CancelSubscriptionUseCase.ts`

## SUBS-033 · P1 · Legacy subscribe and upgrade endpoints cannot grant paid tiers

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** User U1 on Free. User U2 on Pro (web).

**Steps:**

1. U1: POST /api/v1/subscriptions {tier:'pro', billingCycle:'monthly'}.
2. U1: PUT /api/v1/subscriptions/upgrade {tier:'pro'}.
3. U1: POST /api/v1/subscriptions {tier:'free', billingCycle:'yearly'}.
4. U2: POST /api/v1/subscriptions {tier:'free', billingCycle:'monthly'}.
5. U2: PUT /api/v1/subscriptions/upgrade {tier:'free'}.

**Expect:** Paid tiers via POST /subscriptions return 409 'Paid subscriptions require the Paystack billing checkout'. Upgrade to a paid tier returns 409. U1 free returns 201 and stays free. U2 POST free will immediately replace Pro with Free, forfeiting paid time with no refund. Confirm this API-only path is acceptable or block it for active paid plans. Upgrade to free for U2 returns 400 'Cannot downgrade via the upgrade endpoint'.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SubscribeUseCase.ts`, `apps/api/src/application/use-cases/UpgradeSubscriptionUseCase.ts`

## SUBS-035 · P1 · Checkout input validation

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** User token.

**Steps:**

1. POST /subscriptions/checkout {tier:'free', billingCycle:'monthly'}.
2. {tier:'does_not_exist', billingCycle:'monthly'}.
3. {tier:'pro'} (no cycle); {tier:'pro', billingCycle:'weekly'}.
4. {tier:'pro', billingCycle:'monthly', couponCode: 51 characters}.
5. Open /subscription?tier=does_not_exist.

**Expect:** Free returns 400 'The free tier has no paid checkout'. An unknown tier returns 400 'That subscription plan is not available'. A missing or invalid cycle or an over-long coupon returns 400 validation. The unknown-tier URL shows 'This plan is unavailable' in the dialog. No Paystack transaction or checkout row is created for any of these.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-038 · P1 · Payment receipts and confirmations reach the payer

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** Paystack test account with customer receipts enabled. The user's activity alert email is on for 'Subscription updates' and their email is verified.

**Steps:**

1. Buy Plus monthly.
2. Check the inbox for the Paystack receipt and any Ujimora email.
3. Check in-app notifications.

**Expect:** The Paystack receipt arrives with GH₵49.00. An opted-in user receives the subscription activity alert. Record whether a Ujimora purchase confirmation or invoice is required for launch. None is sent by default, because alerts are opt-in and default off.

**Needs:** Paystack test account, email provider

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/compliance/ACTIVITY_ALERTS.md`

## SUBS-042 · P1 · Coupon rejection reasons in preview and checkout

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Coupons: EXPIRED (validUntil yesterday), FUTURE (validFrom tomorrow), OFF (active false), PROONLY (tiers [pro]), YEARONLY (cycles [yearly]), DONATEONLY (surfaces [donation]), VIP (allowedEmails [vip@x.com]), NEWBIE (newUsersOnly), FULL (maxRedemptions 1, already redeemed). User UR who previously completed a paid web checkout.

**Steps:**

1. For each code, preview in the Plus monthly dialog, then submit 'Continue to payment'.
2. Use NEWBIE as UR.
3. Enter a garbage code 'NOPE123'.

**Expect:** The preview shows the specific reason and checkout returns 422 with the same message: 'This coupon has expired', 'not valid yet', 'no longer active', 'does not apply to the selected plan', 'does not apply to the selected billing cycle', 'cannot be used here', 'not available on your account', 'for first-time subscribers only', 'has reached its redemption limit', 'Coupon not found' (unless it matches an affiliate code). No checkout row or Paystack transaction is created on any rejection.

**Needs:** None

**Source:** `apps/api/src/application/services/CouponService.ts`, `apps/api/src/application/use-cases/PreviewCouponUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCouponEligibility.ts`

## SUBS-044 · P1 · Global coupon cap under concurrent settlement

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Coupon LAST (10%, maxRedemptions 1, redemptions 0). Two users A and B.

**Steps:**

1. A and B both open Plus checkouts with LAST (the preflight passes for both).
2. Both pay; settle both.
3. Read coupon.redemptions and API logs.

**Expect:** Both subscriptions activate (the paid charge stands). coupon.redemptions stays at 1, not 2, and a warning is logged: 'subscription settled but coupon was already at its global limit'. Finance should know the cap can be exceeded in effective discounts by the number of in-flight checkouts.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/services/CouponService.ts`

## SUBS-045 · P1 · Admin coupon CRUD and permissions

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Admin with COUPONS permission. Normal user token.

**Steps:**

1. Admin > Coupons > New coupon: walk through the Offer, Eligibility and Review steps and 'Create coupon'. Verify the Review summary matches the inputs.
2. Edit the coupon (change amount, deactivate). Confirm the code field is not editable.
3. Filter Active/Inactive, search, and export.
4. Delete a coupon that has CONSUMED redemptions and one PENDING checkout. Then settle that pending checkout.
5. As a normal user: GET /coupons, POST /coupons, PUT /coupons/:id, DELETE /coupons/:id.

**Expect:** CRUD works and the code stays immutable. A normal user gets 403 on every admin endpoint, but can POST /coupons/preview. Record: delete is a hard delete even with redemptions. The pending checkout still settles at the discounted price with a warning. The commission basis falls back to post-coupon and the coupon is gone from reporting. Decide whether to soft-delete or deactivate instead.

**Needs:** None

**Source:** `apps/admin/src/pages/CouponsPage.tsx`, `apps/admin/src/pages/CreateCouponPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/couponRoutes.ts`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`

## SUBS-048 · P1 · Commission basis: post-coupon vs list price

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Referred users R1 and R2 (pending referrals to AFF). Coupons POST33 (33%, commission basis 'Amount actually charged') and LIST33 (33%, 'Full list price'). Coupon FREE100 (100%, POST_COUPON). Referred user R3.

**Steps:**

1. R1 buys Plus monthly with POST33 (pays 32.83).
2. R2 buys Plus monthly with LIST33.
3. R3 activates Plus with FREE100.
4. Read each commission row and the referral status.

**Expect:** R1's commission is 3.28 (10% of 32.83). R2's is 4.90 (10% of 49.00). R3's is 0.00. R3's referral is marked converted, so AFF has permanently spent R3's one-time conversion for nothing. Confirm this is the intended business rule for 100% promos.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`

## SUBS-050 · P1 · Affiliate code abuse is blocked

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** AFF (code 'kwame-gh'). AFF2 (code 'ama-gh'). User R5 referred by AFF2 (pending). Admin.

**Steps:**

1. AFF enters own code 'kwame-gh' on their own Pro checkout.
2. R5 enters 'kwame-gh'.
3. Admin suspends AFF (Admin > Affiliates > detail > status). A fresh user enters 'kwame-gh'.
4. Admin sets the referral discount to 0% in Settings. A fresh user enters 'ama-gh'.

**Expect:** In every case the preview is invalid ('Coupon not found') and checkout returns 422: self-referral, a code from an affiliate who is not the user's referrer, a suspended affiliate, and a 0% discount (feature disabled). No referral is re-attributed and no commission accrues to a suspended affiliate.

**Needs:** None

**Source:** `apps/api/src/application/services/AffiliateCodePricing.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`

## SUBS-052 · P1 · Commission maturity and dashboard balances

*Surfaces:* api, web  ·  *Type:* functional

**Before:** AFF with a held commission. Staging DB: set maturesAt to the past, or use AFFILIATE_HOLD_DAYS=0 on staging.

**Steps:**

1. Open /affiliate as AFF and note the pending and available balances.
2. Set maturesAt in the past and reload /affiliate.
3. Request an affiliate payout.

**Expect:** On reload the commission moves from held to available: the pending balance falls and the available balance rises by the same amount, to the pesewa. The maturity sweep is not scheduled, so maturity happens only on dashboard or payout reads. Confirm the admin views also show accurate balances when the affiliate has not logged in.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/api/src/application/use-cases/RequestAffiliatePayoutUseCase.ts`, `apps/api/src/app.ts`

## SUBS-053 · P1 · Admin referral discount setting takes effect live and is audited

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin with SETTINGS permission. AFF code. A fresh user.

**Steps:**

1. Admin > Settings > 'Referral discount (%)': set 15 and save.
2. Fresh user previews AFF's code on Pro monthly.
3. Call GET /api/v1/admin/commercial-config/<key>/history.
4. Set it back to 10.

**Expect:** The preview shows 22.35 off, total 126.65, without a redeploy. History records the value, the actor and the reason 'Affiliate referral discount updated from platform settings'.

**Needs:** None

**Source:** `apps/admin/src/components/ReferralDiscountSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.ts`, `apps/api/src/application/services/AffiliateCodePricing.ts`

## SUBS-054 · P1 · Store purchases by referred users and affiliate commission

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** User R7 registered with AFF's ?ref= (pending referral). Store sandbox configured.

**Steps:**

1. R7 subscribes to Pro via App Store sandbox on iOS.
2. Check affiliatecommissions and the referral status.

**Expect:** No commission is created. Store billing does not call AffiliateCommissionService, and the referral stays pending. Confirm the business rule (commission only on web purchases?) and make the affiliate program terms say so. Otherwise AFF may later earn on a web purchase.

**Needs:** App Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/marketing/src/pages/AffiliateProgramPage.tsx`

## SUBS-057 · P1 · Media-per-campaign cap

*Surfaces:* api, ios, web  ·  *Type:* functional

**Before:** Free user (3). Plus user (10).

**Steps:**

1. Free: create a campaign with 4 images (web uploads, or an API imageUrls length of 4).
2. Plus: create with 10, then with 11.

**Expect:** Over the cap returns 422 'Your <plan> plan allows N media uploads per campaign.' At the cap succeeds. When the plan cap is 0 the cover upload is hidden or refused ('Your plan does not include campaign images').

**Needs:** Cloudinary (uploads)

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`

## SUBS-059 · P1 · Collaboration and split-proceeds gates

*Surfaces:* api, ios, web  ·  *Type:* functional

**Before:** Owners on Plus (no collaboration), Pro (3 collaborators) and Organization (10). Invitee accounts exist. SPLIT_PROCEEDS_ENABLED on and off.

**Steps:**

1. Plus owner invites a collaborator (web campaign manage and native create 'Invite collaborators').
2. Pro owner invites 3 collaborators and they accept. Pro owner invites a 4th.
3. Pro owner invites with revenueSharePercent > 0.
4. Pro owner's plan expires. A pending invitee then accepts.
5. Pro owner opens split setup with SPLIT_PROCEEDS_ENABLED=false, then with true.

**Expect:** Plus gets 403 '...does not include campaign collaboration'. The 4th invite gets 403 'allows 3 collaborator(s) per campaign'. Revenue share requires escrowSupport and is allowed on Pro. Acceptance after expiry is refused: 'The campaign owner has reached their collaborator limit', or a plan-feature 403. Split setup is hidden or refused when the flag is off (canSplit false) and gated on collaboration plus escrow when on.

**Needs:** Email provider (invites)

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/RespondToCollaborationUseCase.ts`, `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`

## SUBS-060 · P1 · Saved payout account cap per plan

*Surfaces:* api, ios, web  ·  *Type:* functional

**Before:** Free user (1). Plus (2). Pro (3).

**Steps:**

1. Each user adds payout accounts in account settings until refused.
2. Downgrade a Pro user with 3 accounts to Free (expiry) and try to add another.

**Expect:** Adding beyond maxPayoutAccounts is refused with a plan message. Existing accounts are kept after a downgrade, but new ones are blocked.

**Needs:** Paystack (account resolution)

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/web/src/components/account/SavedPayoutAccounts.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`

## SUBS-061 · P1 · Creator donations eligibility and withdrawal fee follow the paid plan

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Creator C on Free. Paystack test keys.

**Steps:**

1. C tries to enable a creator page (web /creator).
2. C buys Plus. /subscription lists 'Creator profile donations'. Enable the creator page. A supporter tips on web.
3. C requests a withdrawal and reads the fee shown.
4. C's plan expires. A supporter attempts a new tip. C withdraws the remaining balance.

**Expect:** Free is refused with 403 'Creator donations require an active paid subscription'. On Plus the page enables, and the withdrawal fee equals the plan fee % (3%) of the requested amount, shown before confirmation. After expiry new tips are refused, but the balance is still withdrawable at the effective plan (Free) fee. Native apps do not offer tips; they link to 'View plans' only.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/mobile/app/creator.tsx`

## SUBS-067 · P1 · Switching accounts mid-purchase

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Two Ujimora accounts on one device.

**Steps:**

1. As U8 tap Subscribe. While the store sheet is up, background the app. Sign out and sign in as U9 via another flow if possible (or simulate a session switch), then complete payment.
2. Re-open Subscription as U9, then switch back to U8.

**Expect:** The purchase is not granted to U9 ('Sign in to the account used for this purchase, then restore it.'). The Apple transaction stays unfinished until U8 signs in, then auto-restore grants it to U8.

**Needs:** Store sandbox

**Source:** `apps/mobile/src/lib/storeBilling.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-068 · P1 · Cancelled store sheet and its effect on the provider claim

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Fresh user U10 on Free, with no web checkout history.

**Steps:**

1. On iOS tap Subscribe on Plus, then Cancel on the Apple sheet.
2. Check the message.
3. On web as U10, 'Choose Plus' > 'Continue to payment'.

**Expect:** The app shows 'Purchase cancelled.' with no entitlement change. Record: prepare already claimed provider 'apple', so web checkout now returns 409 'This account manages subscriptions through the App Store...'. The web page has no store banner because billingProvider is unset, so the error appears only in the dialog. There is no self-service release; the documented behavior is that claims are never manually released. Decide whether abandoned prepares should keep the claim.

**Needs:** Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.ts`, `docs/compliance/STORE_BILLING.md`

## SUBS-069 · P1 · Pending and deferred store purchases

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** iOS sandbox tester with Ask to Buy enabled (a family child account) or StoreKit deferred testing. Android license tester with the 'Slow test card, approves after a few minutes' and 'Slow test card, declines after a few minutes' cards.

**Steps:**

1. iOS: Subscribe and trigger Ask to Buy.
2. Android: Subscribe with the slow approve card.
3. Wait for approval. Background and foreground the app.
4. Android: repeat with the slow decline card.

**Expect:** The app shows 'Your purchase is pending approval or payment...' or 'Your purchase is pending...You do not need to buy again.' with no entitlement while pending. After approval, access is granted via RTDN or auto-restore without user action. A declined pending purchase grants nothing and leaves no stuck active state.

**Needs:** Store sandbox

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`

## SUBS-073 · P1 · Billing problems: grace period, retry and on-hold

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Billing Grace Period enabled in App Store Connect and Play Console. Sandbox ability to fail renewals (Apple: sandbox account setting / StoreKit test billing issue; Google: switch to 'Test card, always declines').

**Steps:**

1. Trigger a renewal failure on each store.
2. Open the app and check for the billing-issue message.
3. Check the entitlement during grace, then after grace ends (billing retry or account hold).

**Expect:** The app shows 'Your subscription needs attention. Open <store> subscription settings to review payment.' During grace, access continues with periodEnd = the grace expiry. In billing retry (Apple) or on hold (Google) the entitlement drops to Community. Fixing the payment method restores access automatically.

**Needs:** Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-077 · P1 · Store prices and unsupported offers

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** Catalog products. One Play product whose base plan has a multi-phase intro offer or installments. One App Store product whose period does not match its catalog billingCycle.

**Steps:**

1. Open Subscription and toggle Monthly/Yearly.
2. Compare the displayed prices with store settings in the tester's country.
3. Look at the misconfigured products.

**Expect:** Prices use the store's localized displayPrice or formattedPrice. Misconfigured or unsupported offers show 'Store price unavailable' with Subscribe disabled. No web GHS price is displayed natively. Recurring terms text is shown for each plan.

**Needs:** App Store Connect / Play Console

**Source:** `apps/mobile/src/lib/storeBilling.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-082 · P1 · Store API rejects client-supplied entitlement data and bad input

*Surfaces:* api  ·  *Type:* security/permission

**Before:** User token. Staging store billing enabled.

**Steps:**

1. POST /store-billing/verify {store:'apple', reference:'abc'} (non-numeric).
2. POST verify {store:'apple', reference:'123', tier:'enterprise'} (extra field).
3. POST verify with a valid but foreign transaction id (another app or bundle).
4. POST prepare {store:'google', productId:'unknown'}; prepare with the correct productId but a wrong basePlanId.
5. GET /store-billing/catalog/amazon.
6. Call verify 41 times in 15 minutes.
7. Call any store-billing endpoint logged out.

**Expect:** A bad reference returns 422. The extra field returns 400 (strict schema); the tier is never accepted from the client. A foreign transaction returns 422 or 403. An unknown product returns 422 'This store product is not available.' An unsupported store returns 400. The 41st call is rate-limited (429). Logged out returns 401. Responses carry Cache-Control 'private, no-store' and never echo receipts or keys.

**Needs:** Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`

## SUBS-083 · P1 · Account deletion with an active store subscription

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** UA with an active Apple Pro (sandbox).

**Steps:**

1. Native Settings > Delete account: read the warning text and confirm deletion.
2. Let the next sandbox renewal occur.
3. Check the admin Store billing recovery queue.
4. Web: delete account for a web-Pro user and check the subscription row.

**Expect:** The warning says the App Store or Google Play subscription is not cancelled and must be cancelled in the store. After deletion, renewal verification returns 410 'The account is no longer active.' and the purchase appears as review required. Access is never re-granted. The web-Pro user's subscription gets cancelAtPeriodEnd true. Support has a documented response for charged-after-deletion users (store refund).

**Needs:** Store sandbox

**Source:** `apps/mobile/app/settings.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`

## SUBS-087 · P1 · Store billing config validation at startup

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Staging deploy where env vars can be edited.

**Steps:**

1. STORE_BILLING_ENABLED=true with STORE_BILLING_PRODUCTS='not json'. Deploy and check the logs.
2. A catalog with a duplicate productId, a Google entry without basePlanId, an Apple entry with basePlanId, and tier 'free'.
3. A missing STORE_RECEIPT_ENCRYPTION_KEY_BASE64, or a key that is not 32 bytes.
4. APPLE_IAP_ENVIRONMENT=production without APPLE_IAP_APP_ID.
5. A correct config: confirm /health is OK and GET /store-billing/catalog/apple lists the products.

**Expect:** Each invalid config fails startup with 'Store billing configuration is invalid or incomplete...' and the logs contain no key or credential text. A correct config boots and the catalog lists only active public plans. Rotating the receipt key breaks decryption of existing purchases, so back up and never rotate without a migration.

**Needs:** Render/staging env access

**Source:** `apps/api/src/infrastructure/config/storeBilling.ts`, `docs/compliance/STORE_BILLING.md`

## SUBS-088 · P1 · Admin Store billing recovery queue

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Admin. At least one purchase with acknowledgementPending or lastError, and one notification row (create by failing Google acknowledgement: temporarily revoke the service account's permission).

**Steps:**

1. Admin > Store billing recovery: check the header stats and cards (App Store/Google Play, Purchase/Notification, chip, Work ID, next attempt).
2. Enter a reason shorter than 10 characters: 'Queue verification retry' stays disabled.
3. Enter a valid reason and click 'Queue verification retry'.
4. Check Admin > Audit log for STORE_BILLING_RETRY.
5. POST /api/v1/admin/store-billing/purchase/not-a-hash/retry; POST /admin/store-billing/purchase/<64-hex nonexistent>/retry.
6. Export the queue.
7. Disable store billing and reload the page.

**Expect:** Receipts and tokens are never shown. The retry returns 202 with 'Retry queued...this does not grant access'. nextCheckAt is set to now and the review flag is kept. The audit row has the actor, reason and path. An invalid id returns 400 'Invalid billing work item.' and an unknown id returns 404 'No pending billing work found.' The export includes both tables. With billing disabled, a banner says 'Store billing is disabled...' and retry returns 503 with the button disabled.

**Needs:** Store sandbox

**Source:** `apps/admin/src/pages/StoreBillingPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingAdminRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## SUBS-090 · P1 · Admin Subscriptions list: accuracy and actions

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Mix of subscriptions: free, web monthly and yearly, Apple, Google, one expired web Pro (status still active), one on the custom tier. Admin edited Pro price to 155.

**Steps:**

1. Admin > Subscriptions: read Total Subscribers, Monthly Revenue, Free Users, Paid Users, and Revenue by Tier.
2. Filter by tier and status; search by email; paginate; export and open the file.
3. Click the View, Tier and Cancel row buttons.

**Expect:** Filters, search, pagination and export work, and the export includes the Provider column. Record these defects for launch: Monthly Revenue uses seed prices (149, not 155), counts expired rows whose status is still 'active', and ignores custom tiers. Store revenue is not what the store actually pays out. The 'Tier' and 'Cancel' buttons have no handler and do nothing, so remove them or wire them. View opens /users/<id>.

**Needs:** None

**Source:** `apps/admin/src/pages/SubscriptionsPage.tsx`, `apps/api/src/application/use-cases/ListSubscriptionsUseCase.ts`

## SUBS-091 · P1 · First subscription read creates Free without overwriting a paid plan

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Brand-new user with no subscription row.

**Steps:**

1. GET /api/v1/subscriptions/mine twice concurrently.
2. Create a new user. Start a 100%-coupon Pro activation and, in parallel, fire 5 concurrent GET /subscriptions/mine calls.
3. Read the subscription row.

**Expect:** Exactly one row per user (unique userId). Concurrent Free provisioning never overwrites the Pro activation: the final tier is pro. The web page falls back to a Free display if the endpoint errors.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetMySubscriptionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.ts`, `apps/web/src/hooks/useSubscription.ts`

## SUBS-010 · P2 · Pricing fetch failures show an error and never show stale prices

*Surfaces:* api, marketing, web  ·  *Type:* recovery/idempotency

**Before:** Staging where the API can be made unavailable or /plans/public can be blocked (e.g. browser devtools request blocking).

**Steps:**

1. Block /api/v1/plans/public and open marketing /pricing.
2. Click 'Retry' after unblocking.
3. Block /plans/public and open /register to the Plan step.
4. Block GET /api/v1/plans and open web /subscription.

**Expect:** Marketing shows 'Current pricing could not be loaded' with Retry, and Retry recovers. Signup shows 'We couldn’t load current prices' with Retry and does not let the user pick a plan. /subscription falls back to seed prices for display (usePlanMap). Confirm this is acceptable: the charge is always priced server-side, but the displayed price may differ from the charged price if the admin changed prices.

**Needs:** None

**Source:** `apps/marketing/src/pages/PricingPage.tsx`, `apps/web/src/hooks/useSubscription.ts`, `apps/web/src/components/auth/RegisterForm.tsx`

## SUBS-011 · P2 · Marketing pricing CTAs route to the correct destinations

*Surfaces:* marketing, web  ·  *Type:* functional

**Before:** Logged-out browser.

**Steps:**

1. On /pricing click 'Get Started Free' / 'Create a free account'.
2. Click 'Choose Plus' and 'Choose Pro' (Monthly and Yearly).
3. Click 'Contact sales' on Enterprise.
4. Log in from the /subscription sign-in panel after following 'Choose Pro'.

**Expect:** The free CTAs open app.ujimora.com/register. Paid CTAs open app.ujimora.com/subscription and show the sign-in panel. After login the user reaches /subscription. Record whether the chosen tier and cycle are preserved; currently they are not passed. Enterprise goes to marketing /contact. There are no broken links and no 404s.

**Needs:** None

**Source:** `apps/marketing/src/pages/PricingPage.tsx`, `apps/web/src/components/auth/RequireAuth.tsx`

## SUBS-029 · P2 · Switching billing cycle on the same tier is possible on web

*Surfaces:* web  ·  *Type:* functional

**Before:** User on Pro monthly, active.

**Steps:**

1. Open /subscription, toggle Yearly, and look at the Pro card button.
2. Read the page meta description ('switch between monthly and yearly billing').

**Expect:** The Pro card shows a disabled 'Current Plan' regardless of cycle, so monthly-to-yearly for the same tier is not possible on web. Either enable a cycle switch or remove the claim from the copy.

**Needs:** None

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-036 · P2 · Web checkout when Paystack is not configured

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging API with PAYSTACK_SECRET_KEY blank.

**Steps:**

1. As a user 'Choose Pro' > 'Continue to payment'.
2. Apply a 100% coupon and try 'Activate plan'.

**Expect:** The API returns 501. The dialog shows 'Online payments aren't configured yet... you haven't been charged'. Even the 100% coupon path is refused (501). No subscription change.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/web/src/lib/subscriptions.ts`

## SUBS-037 · P2 · Callback page edge states

*Surfaces:* web  ·  *Type:* negative/edge

**Before:** Completed and pending checkouts available.

**Steps:**

1. Open /subscription/callback with no query params.
2. Open with only ?reference=<valid sub- ref> in a private window after logging in (no localStorage handoff).
3. Open ?checkout=<succeeded 100%-coupon checkout>.
4. Rename the Pro plan in admin to 'Pro Max' and open the callback for a Pro checkout.
5. Poll verify more than 60 times within 15 minutes (repeated 'Keep checking' or tabs).

**Expect:** No params shows 'We couldn't find a checkout to confirm' with 'Go to subscription'. Reference-only resolves the correct checkout. The coupon checkout shows 'Your coupon covered the full price — no payment was needed'. Record: the heading uses the seed name 'Pro', not 'Pro Max'. After the rate limit (429) the page stays in a pending or timeout state and does not show failure.

**Needs:** None

**Source:** `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## SUBS-046 · P2 · Coupon leaves a tiny residual amount

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Coupon ALMOST: fixed 48.99 on Plus monthly (final 0.01).

**Steps:**

1. Preview ALMOST on Plus monthly and 'Continue to payment'.

**Expect:** Either Paystack accepts GH₵0.01, or the API returns a clear error such as 'Paystack initialization failed' (502) with no pending seat or checkout left behind. Record the behavior. Consider enforcing a minimum charge or rounding tiny residuals to free.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## SUBS-092 · P2 · Subscription activity alerts (in-app and email)

*Surfaces:* api, email, ios, web  ·  *Type:* functional

**Before:** User with the 'Subscription updates' category enabled for in-app and email after a known time. Email verified. Email provider configured.

**Steps:**

1. Buy Plus (web).
2. Cancel it.
3. Force expiry (staging DB).
4. Disable the category and trigger another change.
5. Repeat with the email unverified.

**Expect:** In-app notifications and emails such as 'Subscription active', 'Subscription scheduled to end' and 'Subscription expired' link to /subscription, with the period end date and 'Manage billing with the provider shown...'. No alerts go out once disabled. There is no email when the address is unverified (suppressed). There are no duplicates on retries.

**Needs:** Email provider

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `packages/types/src/activity-alerts.ts`

## SUBS-094 · P2 · Expo web build of the subscription screen stays off native

*Surfaces:* api, web  ·  *Type:* cross-platform

**Before:** Only if an Expo web export of apps/mobile is deployed anywhere.

**Steps:**

1. Open the Expo web Subscription screen. Choose a plan, apply a coupon and pay via Paystack.
2. Confirm the native builds never render this variant (the .native.tsx file takes precedence).

**Expect:** If deployed, the web variant behaves like the web app: Paystack checkout, coupon preview, polling, and the Enterprise mailto. createSubscriptionCheckout throws 'Use App Store or Google Play billing for native subscriptions.' on native platforms. If it is not deployed, mark this N/A.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/screens/SubscriptionScreen.tsx`, `apps/mobile/src/lib/subscriptions.ts`
