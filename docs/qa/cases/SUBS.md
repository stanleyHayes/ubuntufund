# Plans & subscriptions (112 cases)

Plan catalog, web checkout, App Store and Google Play purchases, restore, server verification and notifications, entitlements, coupons, affiliates.

[Back to the QA plan](../README.md)

## SUBS-002 · P0 · Plan endpoints enforce auth and admin role; only administrators can open the staff console

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Tokens for a normal user, an organization-role user and an admin. No token for the anonymous calls. The normal user's email and password for a console sign-in attempt.

**Steps:**

1. Anonymous: GET /api/v1/plans/public. Expect 200.
2. Anonymous: GET /api/v1/plans. Expect 401.
3. User token: POST /api/v1/plans with a valid body; PUT /api/v1/plans/pro {priceMonthly: 1}.
4. Organization token: repeat step 3.
5. Admin token: repeat step 3 with a harmless change, then revert.
6. Open the admin console login and sign in with the normal (non-admin) user's correct email and password.
7. As admin open Admin > Audit log and look for the refused console sign-in; call GET /api/v1/rbac/me with the user token and with the admin token.

**Expect:** Anonymous GET /plans returns 401. User and organization tokens get 403 'Insufficient permissions' on POST/PUT, and the plan is unchanged when re-read. Admin succeeds and the change is audited as subscription-plan.update. The console sign-in by the non-admin account is refused with 'This account does not have staff access.' (403, sent with audience 'admin' after the password check). No session is stored, and /plans cannot be opened. The audit log has an 'auth.admin_console.refused' entry, 'Staff console sign-in refused: account is not an administrator'. /rbac/me returns an empty permission list and an empty role name for the user, and the full admin permission set for the admin, so every admin sees 'New plan' and 'Edit plan'. Known open issue I028: there are no assignable restricted staff roles, so a 'staff account without PLANS' cannot be set up or tested.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`, `apps/admin/src/context/AuthContext.tsx`, `apps/admin/src/router.tsx`

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

**Before:** New email address. Paystack test keys and webhook to the staging API. For the failure case, the ability to set PAYSTACK_SECRET_KEY to an invalid non-empty value on staging.

**Steps:**

1. Open /register, complete the Account and Details steps and accept the terms.
2. On the Plan step note the tiers listed, pick Pro with Yearly and read the price label, then submit.
3. Confirm the redirect to Paystack showing GH₵1,490.00 and pay with the test success card.
4. Observe /subscription/callback, then /subscription.
5. Repeat with a new email while PAYSTACK_SECRET_KEY is invalid (a blank key returns 501 before any checkout row is written).
6. Read the new user's subscriptioncheckouts row. Restore the key and click 'Continue to payment' in the pre-opened dialog.

**Expect:** The Plan step lists Free, Plus and Pro only. Pro Yearly shows GH₵1,490.00 with 'for 1 year · one-time payment'. The account is created. The callback shows 'You're all set!', 'Your Pro plan is now active' and 'Your GH₵1,490.00 payment is confirmed'. /subscription shows Pro with 'Plan length' '1 year', 'Ends in' about 365 days, and 'Your plan does not renew automatically. Buy again before it ends to keep your benefits.' In the failure case the account still exists and the user lands on /subscription?tier=pro&billingCycle=yearly&checkoutError=1. The alert reads 'Your account is ready, but we couldn’t open payment. Your paid plan is not active yet. Check your payment status before retrying.' and the checkout dialog is pre-opened. The failed checkout row is EXPIRED, not left PENDING, so the retry opens Paystack at once without a 409 'payment in progress'. No charge is made before the retry.

**Needs:** Paystack test keys, email provider for verification email

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`

## SUBS-016 · P0 · Web Pro monthly purchase by card: amounts, one-time copy, activation and records

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** User U1 on Free with a verified email. Paystack test keys. Webhook URL set to https://<staging-api>/api/v1/webhooks/paystack. PUBLIC_WEB_URL set to the staging web origin.

**Steps:**

1. Open /subscription. Confirm the current plan card shows Community ('Plan length' 'Free', 'Ends' 'No end date').
2. Read the Pro card: price, unit and the line under it.
3. Click 'Choose Pro'. Read the dialog title, the text under it and 'Total due today'.
4. Click 'Continue to payment'. Paystack shows GH₵149.00 and the reference begins 'sub-'.
5. Pay with the Paystack test success card.
6. Observe the redirect to /subscription/callback?checkout=<id>&reference=sub-... and the polling state.
7. Open /subscription; open Admin > Subscriptions and find U1.
8. Call GET /api/v1/subscriptions/mine and GET /api/v1/subscriptions/checkout/<id>. Read subscriptions.paymentReferences in the DB.

**Expect:** The Pro card shows GH₵149 '/ 30 days' and 'One-time payment · does not auto-renew'. The dialog is titled 'Upgrade to Pro' and reads 'One-time payment for 30 days. Your plan does not renew automatically.' with 'Total due today GH₵149.00'. The callback shows 'Confirming your subscription…', then 'You're all set!', 'Your Pro plan is now active' and 'Your GH₵149.00 payment is confirmed'. The subscription has tier pro, status active, billingCycle monthly, currentPeriodEnd = activation + 30 days, and paymentReferences = [the sub- reference]. The plan card shows 'Plan length' '30 days', 'Ends in 30 days' and the does-not-renew note, with no Cancel button. The checkout is SUCCEEDED with baseAmount 149, discountAmount 0, finalAmount 149, GHS, and providerRef = the Paystack reference. The Paystack transaction is 14900 pesewas in GHS. The admin list shows U1 as Pro/active and counts U1 under 'Paying now'. The export has Provider web.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-017 · P0 · Web yearly purchase for each paid tier

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Three Free users. Paystack test keys.

**Steps:**

1. User A: toggle Yearly, 'Choose Plus', and pay.
2. User B: Yearly Pro.
3. User C: Yearly Organization.
4. For each, compare the plan card price (price/12) and its sub-line with the dialog text and total, the Paystack amount and the checkout finalAmount.

**Expect:** Cards show the monthly equivalents 40.83, 124.17 and 332.50 per month, with the sub-lines 'GH₵ 490 for 1 year · One-time payment · does not auto-renew', 'GH₵ 1490 for 1 year · …' and 'GH₵ 3990 for 1 year · …'. Dialogs read 'One-time payment for 1 year (365 days). Your plan does not renew automatically.' Dialogs and Paystack charge the full 490.00, 1,490.00 and 3,990.00. Each subscription is yearly with currentPeriodEnd = activation + 365 days, and the plan card shows 'Plan length' '1 year'. There is no rounding drift between the displayed total and the charged amount.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-018 · P0 · Mobile money payment, including delayed approval

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User on Free. Paystack test mode with the Mobile Money channel enabled for GHS.

**Steps:**

1. 'Choose Plus' then 'Continue to payment'. On Paystack pick Mobile Money and use the Paystack test MoMo number.
2. Delay approving the prompt for more than about 2 minutes, watching the callback's network calls.
3. Watch the callback reach the 'Still confirming your subscription' timeout state, then approve the MoMo prompt.
4. Click 'Keep checking'.

**Expect:** While waiting, the callback backs off (2 s, 3 s, 5 s, 8 s, then every 10 s). It calls POST …/verify on the first and every 4th attempt and GET /subscriptions/checkout/<id> otherwise, and times out after 15 attempts (about 2 minutes). The timeout copy says there is no need to pay again. After approval, 'Keep checking' (or the webhook) moves the checkout to SUCCEEDED and the page shows the success state. Plus is active exactly once, with one Paystack charge.

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

1. Start a Pro checkout, pay, and let Paystack redirect to /subscription/callback.
2. With devtools open, observe the callback's requests: the first POST /subscriptions/checkout/reference/<ref>/verify, then GET /subscriptions/checkout/<id>, then verify again on every 4th attempt.
3. Restore the webhook URL, then use Paystack's 'resend webhook' for that transaction.

**Expect:** The first verify calls Paystack's verify API, matches the reference, currency and amount, and settles. The UI shows success without waiting for the webhook. The later webhook resend is a no-op: same period end, a single coupon increment and a single commission.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`

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

## SUBS-026 · P0 · Two checkouts in parallel cannot double-charge

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** User on Free. Two browser tabs on /subscription. Paystack test keys.

**Steps:**

1. Tab 1: 'Choose Pro', then 'Continue to payment'. Keep the Paystack page open without paying.
2. Tab 2: 'Choose Pro', then 'Continue to payment'.
3. Pay in Tab 1 with the test card. With the webhook briefly blocked, retry 'Continue to payment' in Tab 2 before the callback confirms.
4. Check Paystack transactions, checkout rows and the subscription period.
5. In one tab, double-click 'Continue to payment' on a fresh dialog.

**Expect:** Tab 2 gets 409 in the dialog: 'You already have a plan payment in progress. Finish it in the payment window, or check its status on your subscription page, before starting another.' No second Paystack page opens. The Tab 2 retry after Tab 1 paid gets 409 'Your earlier plan payment went through and that plan is now active. Review your subscription before buying again.', and that request activates Pro itself. There is exactly one GH₵149 charge and Pro runs for 30 days. If a member knowingly pays for the same plan again once it is active, the new period is added to the end of the current one (SUBS-N001), so no paid time is lost. A double-click creates one checkout, because the button is disabled while starting.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-027 · P0 · Mid-period web plan switch needs explicit replacement consent and discloses forfeited time

*Surfaces:* api, marketing, web  ·  *Type:* compliance

**Before:** User U2 on Plus monthly (web), activated 10 days ago (staging: adjust currentPeriodStart and End). Paystack test keys.

**Steps:**

1. Open /subscription and click 'Choose Pro'. Read the dialog title, text, warning and button.
2. Call POST /api/v1/subscriptions/checkout {tier:'pro', billingCycle:'monthly'} without replaceCurrentPlan.
3. In the dialog click 'Replace plan and pay' and pay GH₵149.
4. Read the subscription currentPeriodStart, currentPeriodEnd and paymentReferences.
5. Read ujimora.com/billing-terms sections 2, 3 and 4.

**Expect:** The dialog is titled 'Switch to Pro' and reads 'One-time payment for 30 days. Your plan does not renew automatically.' It carries the warning 'Your Plus plan is active until <date>. Pro replaces it as soon as payment is confirmed, and unused time on Plus is not refunded or credited.' and the button 'Replace plan and pay'. The API call without the flag returns 409 'Your Plus plan is active until <YYYY-MM-DD>. Buying Pro now replaces it straight away, and unused time is not refunded or credited. Confirm the switch to continue.' with errors.code ['replace_current_plan'], and no checkout row is created. After payment the tier is pro, currentPeriodStart is the payment time, currentPeriodEnd is +30 days, and paymentReferences holds only the new reference. The roughly 20 unused Plus days are forfeited as disclosed. Billing terms clause 4 says buying a different plan while one is active replaces it once you confirm, and unused time is not credited or refunded. There is no proration, by owner decision.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `packages/types/src/legal.ts`

## SUBS-030 · P0 · Web subscription expiry: expired status, same-plan rebuy and entitlement fallback

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** User U2 on Pro monthly (web). Staging DB access to set currentPeriodEnd to 1 minute ago. Paystack test keys.

**Steps:**

1. Set U2's currentPeriodEnd to the past (leave the stored status 'active').
2. Call GET /api/v1/subscriptions/mine.
3. Open /subscription. Read the plan card chip, alert and stats, and the Pro and Community card buttons.
4. Try to start a LIVE session and to create a 2nd campaign.
5. Open Admin > Subscriptions and read U2's status and the KPIs.
6. From the UI click 'Choose Pro' and pay. Read the new period.

**Expect:** The API returns status 'expired', derived at read time; the DB row is not rewritten. The page shows the chip 'Expired' and the alert 'Your Pro plan ended on <date>. Community features apply until you buy a plan again.' The stats show 'Ended' <date>. The Community card shows 'Current Plan', the Pro card offers an enabled 'Choose Pro', and the upgrade call-to-action is shown. LIVE returns 403 'Your Community plan does not include LIVE streaming. Upgrade to unlock it.', and the campaign cap is 1. The admin row shows 'expired', and U2 counts under 'Free or lapsed', not 'Paying now' or 'Estimated MRR (list price)'. The dialog is titled 'Upgrade to Pro' and needs no replace confirmation. After payment Pro is active with a fresh period of now + 30 days.

**Needs:** Staging DB, Paystack test keys

**Source:** `apps/api/src/domain/services/subscriptionStatus.ts`, `apps/api/src/application/use-cases/GetMySubscriptionUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/lib/subscriptionStatus.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/admin/src/pages/SubscriptionsPage.tsx`

## SUBS-031 · P0 · Web plans are one-time purchases: honest disclosure and expiry notice

*Surfaces:* api, email, marketing, web  ·  *Type:* compliance

**Before:** User U2 on Plus monthly (web). Activity alerts: 'Subscription updates' enabled for in-app and email in profile settings, with a verified email.

**Steps:**

1. Read the /subscription plan cards, the checkout dialog and the current plan card; the marketing /pricing cards and FAQ; and ujimora.com/billing-terms sections 2 and 3.
2. Let the period end (staging: set currentPeriodEnd to the past) and wait 2 minutes for the activity sweep.
3. Check the Paystack dashboard for any automatic charge.
4. Check in-app notifications and email.

**Expect:** No web copy says 'Renews', 'billed monthly' or 'cancel anytime'. Cards show '/ 30 days' with 'One-time payment · does not auto-renew' (marketing: 'One-time payment on the website · does not auto-renew'). The dialog reads 'One-time payment for 30 days. Your plan does not renew automatically.' The plan card shows 'Plan length' and 'Ends in N days' with 'Your plan does not renew automatically. Buy again before it ends to keep your benefits.' and has no Cancel button. The marketing FAQ 'Do plans renew automatically?' says website plans are one-time and app-store plans renew until cancelled in the store. Billing terms clause 3 says website plans do not renew and there is nothing to cancel. After the period ends there is no automatic charge. The opted-in user gets 'Subscription expired' in-app and by email, linking to /subscription. There is no pre-expiry reminder; record whether product wants one. The reworded terms await legal sign-off (LEGAL_ACCEPTANCE_VERSION was not bumped).

**Needs:** Email provider (activity email), Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/PricingPage.tsx`, `packages/types/src/legal.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

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

## SUBS-043 · P0 · Per-user coupon seat race is closed and never opens two charges

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Coupon ONE (10%, perUserLimit 1). User on Free with two tabs.

**Steps:**

1. In both tabs open the Plus dialog with ONE and click 'Continue to payment' at the same moment, or fire two parallel API calls.
2. Complete payment in the winning tab.
3. Read both checkout rows and the coupon redemption rows.

**Expect:** One checkout gets a seat and a Paystack URL. The other is refused in one of two ways. If the first checkout was already recorded, it gets 409 'You already have a plan payment in progress. Finish it in the payment window, or check its status on your subscription page, before starting another.' with no row. If both passed that check together, it gets 422 'You have already used this coupon the maximum number of times' and its checkout row is FAILED. No second Paystack page is opened. The discount is applied exactly once and there is one charge.

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

## SUBS-051 · P0 · Web subscription refund ends the paid plan and reverses the commission

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** R1 converted, with a held commission of 14.90 on a fresh 30-day Pro web plan. R6 converted, with a commission already matured to available. Paystack test mode supports refunds. Admin token.

**Steps:**

1. In the Paystack dashboard refund R1's sub- transaction in full.
2. After the refund.processed webhook, check R1's subscription (GET /subscriptions/mine and /subscription), the commission status and AFF's pending balance.
3. Refund R6's transaction in full and check R6's plan and AFF's available balance.
4. Replay one refund webhook.
5. As admin call GET /api/v1/admin/payments/provider-events.

**Expect:** R1's plan is taken back: status expired, currentPeriodEnd set to the refund time, and the sub- reference removed from paymentReferences. /subscription shows 'Expired' and Community limits apply. R1's commission becomes reversed and the pending balance drops by 14.90. R6's plan also ends, and its commission is reversed out of the available balance. A replayed refund changes nothing. If the commission had already been paid out, it is recorded as an outstanding clawback (SUBS-N016). The refund is listed by the provider-events endpoint with subject 'subscription'. Known open issue I009: there is no admin console page for non-campaign provider events.

**Needs:** Paystack test keys (refunds)

**Source:** `apps/api/src/application/use-cases/RevokeRefundedSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`

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

## SUBS-058 · P0 · LIVE streaming follows the owner's plan, including resume and host tokens

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** LIVEKIT_* configured on staging. Campaign owners on Free, Plus and Pro, each with an active campaign. Admin. A viewer account.

**Steps:**

1. The Free owner tries 'Go live' (web live page, native campaign/live).
2. The Plus owner tries.
3. The Pro owner starts a session and leaves it active without ending it, then closes the studio.
4. Expire the Pro owner's plan (staging DB: currentPeriodEnd in the past).
5. The expired owner reopens the studio and taps 'Go live' again, and tries to join video as host.
6. The viewer opens the watch page for that session.
7. The admin tries to start LIVE on the expired owner's campaign.
8. Restore Pro. The admin turns liveStreaming off for Pro in Admin > Plans, and an active Pro owner tries to start.

**Expect:** Free and Plus get 403 'Your Community plan does not include LIVE streaming. Upgrade to unlock it.' or 'Your Plus plan does not include LIVE streaming. Upgrade to unlock it.' Pro succeeds. After expiry, starting returns the same 403 even though a session is still active, so the old broadcast is not resumed, and minting a host video token also returns 403. Viewers can still open the watch page as viewers. The admin acting for the owner gets 403. After the admin toggle, Pro owners are blocked immediately. Known residual (I070): a host already connected when the plan lapses is not disconnected until they reconnect or the session ends.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/mobile/app/campaign/live.tsx`

## SUBS-062 · P0 · Only delivered plan benefits are advertised, and team seats are enforced

*Surfaces:* admin, api, ios, marketing, web  ·  *Type:* compliance

**Before:** Organization accounts: OrgPlus on Plus (1 seat) and OrgO on Organization (10 seats). Expo-web Subscription screen if deployed.

**Steps:**

1. On /subscription (cards, current-plan chips, Feature comparison), marketing /pricing (cards and comparison) and the Expo-web Subscription screen, list every benefit shown.
2. In Admin > Plans > 'Edit plan', read the Benefits toggle labels.
3. OrgPlus owner: invite one team member at /organization-team.
4. OrgO owner: invite members until refused.
5. Search the API for server enforcement of each remaining advertised benefit.

**Expect:** No member-facing page shows Featured listing, Priority support, Advanced analytics or Custom branding. 'Escrow & milestones' now reads 'Split proceeds', and 'Team members' reads 'Organization team seats (incl. owner)'. The admin toggles for the four unbuilt flags read '(not built — hidden from members)'. OrgPlus's invite is refused with 403 'Your Plus plan includes 1 team seat, including the owner. Upgrade the organization's plan or remove a member before inviting someone new.' OrgO can invite 9 people (the owner holds the 10th seat), and the 10th invite is refused with the same message for 10 seats. Every remaining advertised benefit has server enforcement.

**Needs:** None

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/PricingPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.tsx`, `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/app.ts`

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

## SUBS-075 · P0 · Duplicate store subscription for the same Ujimora account is recorded for review

*Surfaces:* admin, android, api, ios  ·  *Type:* negative/edge

**Before:** U5 has an active Apple Pro bought with Apple ID A. A second device is signed into Apple ID B. Same scenario on Android with two Google accounts for U6.

**Steps:**

1. On device 2 sign into Ujimora as U5 (with Apple ID B) and subscribe to Plus.
2. Observe the result and check whether Apple ID B was charged.
3. Read the storepurchases row for the duplicate and open Admin > Store billing recovery.
4. Repeat on Android. After 3 days, check Play Console Order management.
5. Let U5's original Pro lapse (turn off auto-renew and wait past period end). Then queue a verification retry for the duplicate from the admin queue, or wait for the daily re-check.

**Expect:** The server refuses with 409 'Another subscription is already active. Contact support to review the duplicate purchase.' U5 keeps Pro. Apple ID B has been charged and the transaction stays unfinished. The duplicate is recorded, not dropped: reviewRequired true, lastError 'duplicate_active_subscription', acknowledgementPending false and nextCheckAt about 24 hours later. It appears in Admin > Store billing recovery without receipts or tokens. The Google duplicate is never acknowledged, so Play refunds and revokes it after 3 days. Support follows STORE_BILLING.md: Google can refund in Play Console, and Apple purchasers must request a refund at reportaproblem.apple.com. Once the original plan has lapsed, the re-check applies the duplicate if it is still active.

**Needs:** Store sandbox (2 sandbox Apple IDs, 2 Google license testers)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingAdminRoutes.ts`, `docs/compliance/STORE_BILLING.md`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-076 · P0 · Native behavior when store billing is disabled, and the production warning

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Staging with STORE_BILLING_ENABLED unset. A user with an existing store purchase. Access to API startup logs for a NODE_ENV=production deploy.

**Steps:**

1. Open Profile > Subscription.
2. Tap 'Restore purchases' and 'Refresh'.
3. POST /api/v1/store-billing/prepare and /verify.
4. POST /api/v1/webhooks/store/apple and /google.
5. Read the API startup logs for a production-mode boot without STORE_BILLING_ENABLED, and open render.yaml.

**Expect:** The native screen shows 'New store purchases are temporarily unavailable. Your existing plan and free features remain available.' There are no Subscribe buttons and no Paystack or web fallback. Prepare and verify return 503, and the webhooks return 503 so the stores retry. At startup, production logs the warning 'Optional production capabilities are off', naming 'native store billing (App Store / Google Play): STORE_BILLING_ENABLED is not "true"', with no values. render.yaml declares STORE_BILLING_*, STORE_RECEIPT_ENCRYPTION_KEY_BASE64, APPLE_IAP_* and GOOGLE_PLAY_* as dashboard-set (sync:false) keys. Before launch, confirm that production has STORE_BILLING_ENABLED=true and the full catalog set in the Render dashboard; otherwise the native apps cannot sell plans.

**Needs:** None

**Source:** `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `render.yaml`

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

1. Visit every entry point: Profile > Subscription, campaign create 'Review eligibility' (at the plan cap), Creator 'View plans', the affiliate screen, and the campaign live screen copy.
2. Open deep and universal links https://app.ujimora.com/subscription and /subscription/callback from Notes or Mail.
3. Search screens for 'Contact sales', Paystack, 'ujimora.com/pricing', 'website' or web subscription links.
4. Try to create a web checkout from the native client (the lib throws off-web).

**Expect:** Every path lands on the native IAP screen (resolvePath maps /subscription to /(tabs)/subscription). No Paystack, web pricing or 'buy on website' link or button exists for plans. Creator tips are not offered natively. Donations and wallet top-ups open Safari (iOS) as designed, but subscriptions never do. The affiliate screen now describes the commission as paid 'when someone you refer buys their first paid plan on the Ujimora website' (I061 copy). It is plain text with no link or button; confirm with the owner that this wording is acceptable under App Review 3.1.1 and the Play Payments policy.

**Needs:** Signed builds

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/src/lib/subscriptions.ts`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/creator.tsx`, `apps/mobile/app/affiliate.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`

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

*Surfaces:* admin, api, ios  ·  *Type:* compliance

**Before:** Production-like API with APPLE_IAP_ENVIRONMENT=production, APPLE_IAP_APP_ID set and APPLE_IAP_ALLOW_SANDBOX_FALLBACK unset (default true). A TestFlight build pointed at it, which uses the sandbox environment. A sandbox tester.

**Steps:**

1. Using the TestFlight build, buy Pro with the sandbox tester.
2. Observe the verify response and the app message.
3. Read storepurchases.environment and the subscription's billingEnvironment, then open Admin > Subscriptions.
4. Send a sandbox App Store Server notification ('Request a Test Notification' for the sandbox URL), then a real sandbox renewal notification, to /api/v1/webhooks/store/apple.

**Expect:** Production answers 'transaction not found', the server retries the same checks in sandbox, and the purchase activates: 'Your subscription is active.', tier pro, billingProvider apple. The purchase row has environment 'sandbox' and the subscription billingEnvironment 'sandbox'. Admin Subscriptions excludes it from 'Paying now' and 'Estimated MRR (list price)'. The sandbox TEST notification returns 200 with no work. Real sandbox notifications fail the production environment check, are fully re-verified by the sandbox verifier, return 200, and are processed. See SUBS-N011 for the fallback-disabled and outage behaviour.

**Needs:** App Store Connect, TestFlight, Apple IAP keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/admin/src/lib/subscriptionRevenue.ts`, `docs/compliance/STORE_BILLING.md`, `apps/mobile/APP_REVIEW_NOTES.md`

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

**Before:** User, organization and admin tokens. A normal user's email and password for a console sign-in attempt.

**Steps:**

1. As user/org: GET /api/v1/admin/store-billing; POST /admin/store-billing/purchase/<id>/retry; GET /api/v1/subscriptions.
2. Sign in to the admin console with the normal user's credentials and try to open /store-billing and /subscriptions.
3. As admin, check the Action center shows the 'Store billing recovery' count.

**Expect:** Non-admins get 403 on every call. The console refuses the non-admin sign-in with 'This account does not have staff access.' No token is stored, so /store-billing and /subscriptions redirect to login. The refusal is audited as 'auth.admin_console.refused'. The admin sees the counts. Responses carry Cache-Control 'private, no-store'. Known open issue I028: there are no assignable restricted staff roles, so every admin sees these pages.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingAdminRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/admin/src/context/AuthContext.tsx`, `apps/admin/src/router.tsx`

## SUBS-093 · P0 · Billing terms and in-product copy match real behavior

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Published legal pack from this branch.

**Steps:**

1. Read ujimora.com/billing-terms and native /billing-terms end to end.
2. Compare with observed behaviour: SUBS-016 (one-time web plan), SUBS-N001 (same-plan renewal adds time), SUBS-027 and SUBS-028 (a switch replaces the plan with no credit), SUBS-032 (nothing to cancel on web), SUBS-051 (refund ends the plan), SUBS-062 (benefits), SUBS-013 (Enterprise is sales-led) and the store renewal rules (SUBS-072).
3. Check what the web checkout dialog and the native paywall show before payment.

**Expect:** Clause 2: plans are charged for the 30-day or one-year period selected, and checkout shows the plan, the period, any coupon discount and the total, plus any taxes or charges if they apply. The web dialog shows all of these. Clause 3: website plans do not renew and there is nothing to cancel, while store plans renew under store terms until cancelled in the store. Clause 4: buying the same plan adds its period to the end of the current one, and buying a different plan replaces it on confirmation with no credit. Every statement is true for web and for each store. The reworded terms still need owner or legal sign-off (LEGAL_ACCEPTANCE_VERSION was not bumped, so members are not asked to re-accept). Known open issue I021: tax treatment is an external gate; if tax applies, checkout must show it before launch.

**Needs:** Legal/owner sign-off

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/mobile/app/billing-terms.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-N002 · P0 · A new checkout is refused while an earlier payment is unresolved, and stale unpaid checkouts make way

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Free users U1 and U3. Paystack test keys. Staging DB write access. The ability to point the Paystack webhook elsewhere and to set PAYSTACK_SECRET_KEY to an invalid non-empty value.

**Steps:**

1. With the webhook blocked, U1 starts 'Choose Plus', pays on Paystack and closes the tab before the redirect, so the checkout stays PENDING.
2. U1 opens /subscription in a fresh tab and clicks 'Choose Pro' > 'Continue to payment'.
3. U1 reloads /subscription and reads the plan. Check Paystack for charges.
4. U3 starts a Plus checkout, abandons it on Paystack, sets its createdAt to 2 hours ago, then starts a new Plus checkout.
5. U3, with a fresh PENDING checkout that has a provider reference: set PAYSTACK_SECRET_KEY invalid and start another checkout. Restore the key.

**Expect:** Step 2 returns 409 in the dialog: 'Your earlier plan payment went through and that plan is now active. Review your subscription before buying again.' That request settles the earlier Plus checkout itself, and no Pro charge is opened. Step 3 shows Plus active with one charge. In step 4 the 2-hour-old abandoned checkout becomes EXPIRED (releasing any coupon seat) and the new checkout opens normally. Step 5 returns 409 'We could not confirm your earlier plan payment. Check its status on your subscription page before starting another payment.' No second charge is opened in any step.

**Needs:** Paystack test keys, staging DB

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`

## SUBS-N003 · P0 · Reconciliation sweep repairs missed webhooks and expires abandoned checkouts

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging API with RECONCILIATION_SCHEDULER_ENABLED=true (production default on) and PAYMENTS_RECONCILIATION_ENABLED not 'false'. Paystack test keys. Webhook blocked for step 1. DB write access. Coupon SWEEP1 (perUserLimit 1).

**Steps:**

1. User A starts a Plus checkout, pays on Paystack and closes the browser before the callback. Keep the webhook blocked. Make the checkout older than 30 minutes (wait, or move createdAt back 31 minutes) and wait for the next 5-minute tick.
2. User B starts a Plus checkout with SWEEP1 and abandons it on Paystack. Move createdAt back 25 hours and wait for the tick.
3. User C has a PENDING checkout with no providerRef (unset it in the DB) aged 25 hours. Wait for the tick.
4. Read the API logs and each checkout. As B, reopen /subscription and preview SWEEP1.

**Expect:** A's checkout becomes SUCCEEDED and Plus is active with no client action: the missed webhook is repaired. B's checkout becomes EXPIRED and its SWEEP1 redemption RELEASED, so SWEEP1 previews as valid again, and B's /subscription no longer shows the 'Returning from payment?' banner. C's checkout becomes EXPIRED. The log has 'subscription checkout reconciliation sweep complete' with scanned, settled, expired and pending counts. Checkouts younger than 30 minutes are not touched, and provider errors are retried on later ticks (given up after 7 days).

**Needs:** Paystack test keys, staging DB, scheduler flag

**Source:** `apps/api/src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/app.ts`

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

**Before:** Admin. User U1 on Free. Paystack test keys. Staging DB write access (fallback for step 4).

**Steps:**

1. Admin > Plans > 'New plan': tier id 'community_plus', name 'Community Plus', monthly 20, yearly 200, fee 3.2, maxActiveCampaigns 2, sort order between Free and Plus, Active and Public on. Click create.
2. Reload marketing /pricing and web /subscription.
3. As U1 click 'Choose Community Plus' (monthly), then 'Continue to payment', and pay with the Paystack test card. Record any error shown in the dialog.
4. If checkout was refused, set U1's subscription to tier community_plus, status active, currentPeriodEnd +30 days in the staging DB so the enforcement steps can run.
5. As U1 create 2 campaigns, then try a 3rd.
6. Open Admin > Subscriptions: check U1's tier chip, the tier filter options and the 'Estimated monthly revenue by tier (list price)' row. Open the callback page for U1's checkout if one exists.

**Expect:** The new tier appears in sortOrder position on pricing and /subscription. Requirement: the GH₵20.00 charge settles and U1 becomes community_plus for 30 days, and the callback shows 'Your Community Plus plan is now active'. The 3rd active campaign is rejected with 403 'Your Community Plus plan allows 2 active campaigns'. Admin Subscriptions uses live plans, so U1's chip reads 'Community Plus', the tier filter lists 'Community Plus', and the revenue-by-tier row names it and prices it at GH₵20 (web-billed rows only). Known open gap (noted in the I066 verification, not fixed): POST /subscriptions/checkout validates tier against the built-in SubscriptionTier enum, so 'community_plus' is refused with 400 'Validation failed' (errors.tier). Custom tiers cannot be bought on the web today. Known open issue I069 (residual): SubscriptionCallbackPage still takes plan names from the seed, so for a custom tier the 'Your … plan is now active' line is missing.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreatePlanUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/admin/src/pages/SubscriptionsPage.tsx`, `apps/admin/src/lib/subscriptionMetrics.ts`, `apps/api/src/application/services/PlanLimitsService.ts`

## SUBS-006 · P1 · Deactivating or hiding a plan from the Edit dialog removes it from sale without breaking existing subscribers

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* functional

**Before:** Admin. User U2 with an active paid Plus web subscription. User U3 on Free. Store catalog includes a Plus product.

**Steps:**

1. Admin > Plans > Plus > 'Edit plan'. Confirm the dialog has Sort order, Accent colour and Active, Public and Popular switches, and read the note under them. Switch Active off and save.
2. Reload marketing /pricing, the /register Plan step, web /subscription (as U3) and native Subscription (as U3).
3. As U3 POST /api/v1/subscriptions/checkout {tier:'starter', billingCycle:'monthly'}; open /subscription?tier=starter.
4. As U3 on native call prepare for the Plus product (tap Subscribe if visible).
5. As U2 create campaigns up to the Plus cap, open creator page settings and check the GET /api/v1/creators policy.
6. Edit Plus again: Active on, Public off, save. Repeat step 3 and read storebillingaccounts for U3.
7. Restore Public on. Check Admin > Audit log for the subscription-plan.update entries.

**Expect:** The dialog note reads 'Turning off Active or Public hides this plan from new purchases on the website and in the app store catalog. Existing subscribers are not cancelled.' Each save is a PUT /plans/starter, audited with a diff. With Active off, Plus disappears from every sales surface and from the native catalog. Checkout returns 400 'That subscription plan is not available', prepare returns 422 'This store product is not available.', and /subscription?tier=starter opens no checkout dialog. With Public off (Active on), checkout returns 403 'This plan is arranged through our sales team. Contact sales@ujimora.com.', and no checkout row or provider claim is created. U2 keeps Plus campaign limits until period end. Confirm the creator-donation rule with the owner: creatorPolicy requires plan.active, so U2's creator donations become ineligible while Plus is inactive.

**Needs:** Store billing staging config

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/api/src/application/services/PlanLimitsService.ts`

## SUBS-007 · P1 · Non-public (negotiated) plans cannot be self-purchased on web

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Admin sets Organization to Active on and Public off in Admin > Plans > Organization > 'Edit plan'. Optionally an admin-created tier 'partner_ngo' (Active on, Public off, monthly 10). User U1 on Free with no billing history. Paystack test keys.

**Steps:**

1. As U1 call GET /api/v1/plans/public and GET /api/v1/plans and check whether organization is returned.
2. As U1 open /subscription, then /subscription?tier=organization&billingCycle=monthly.
3. As U1 POST /api/v1/subscriptions/checkout {tier:'organization', billingCycle:'monthly'}.
4. As U1 POST /api/v1/subscriptions/checkout {tier:'partner_ngo', billingCycle:'monthly'}.
5. Read subscriptioncheckouts and storebillingaccounts for U1 and check the Paystack dashboard.
6. Restore Organization to Public on.

**Expect:** /plans/public omits Organization. The authenticated /plans still lists it, as a catalog read only. /subscription shows no Organization card, and the ?tier= link opens no checkout dialog. The Organization checkout returns 403 'This plan is arranged through our sales team. Contact sales@ujimora.com.' The partner_ngo call is refused with 400 'Validation failed' because the checkout accepts only built-in tier ids. For every call there is no checkout row, no Paystack transaction, and no billing-rail claim (storebillingaccounts.provider stays unset).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PlanController.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-008 · P1 · A zero-priced cycle on a paid plan is shown as not offered and cannot be activated free

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Admin. User U1 on Free. Staging only.

**Steps:**

1. As admin set Plus yearly price to 0 (Admin > Plans > Plus > 'Edit plan', or PUT /api/v1/plans/starter {priceYearly:0}). Monthly stays 49. Read the Plans page info alert.
2. As U1 open /subscription, toggle Yearly and read the Plus card button.
3. Open /register (new email) to the Plan step, choose Yearly and look at Plus.
4. As U1 POST /api/v1/subscriptions/checkout {tier:'starter', billingCycle:'yearly'}.
5. Revert priceYearly to 490.

**Expect:** The admin alert says 'A price of 0 on a paid plan means that billing cycle is not offered.' On /subscription the Plus card button reads 'Yearly not offered' and is disabled. At signup Plus shows 'Not offered', its option is disabled, and submit stays disabled if it was selected. The API returns 400 'That billing cycle is not available for this plan' before any checkout row, coupon seat or billing-rail claim. There is no free activation. A coupon that zeroes a positive price still activates without charge (SUBS-041).

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/admin/src/pages/ManagePlansPage.tsx`

## SUBS-013 · P1 · Enterprise is sales-led everywhere and cannot be bought self-serve

*Surfaces:* api, marketing, web  ·  *Type:* compliance

**Before:** New email. Paystack test keys. Seed Enterprise is active and public (1500/15000). A logged-in Free user U1.

**Steps:**

1. On the /register Plan step, list the selectable tiers.
2. On /subscription check the Enterprise card; on marketing /pricing check the Enterprise CTA.
3. As U1 open /subscription?tier=enterprise&billingCycle=monthly.
4. As U1 POST /api/v1/subscriptions/checkout {tier:'enterprise', billingCycle:'monthly'}.
5. Read subscriptioncheckouts and storebillingaccounts for U1 and check the Paystack dashboard.

**Expect:** Signup offers Free, Plus and Pro only; Enterprise is never offered. The /subscription Enterprise card is 'Contact sales' (mailto sales@ujimora.com, subject 'Enterprise plan enquiry'), and marketing 'Contact sales' goes to /contact. The ?tier=enterprise link opens no checkout dialog. The API returns 403 'This plan is arranged through our sales team. Contact sales@ujimora.com.' before any checkout row, coupon seat or billing-rail claim. No card can buy Enterprise. Note that Organization is also not offered at signup and can be bought from /subscription after registration; confirm this is intended.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/PricingPage.tsx`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`

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

## SUBS-020 · P1 · Abandoned Paystack checkout expires and frees the coupon seat and the billing rail

*Surfaces:* android, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** User U1 on Free, never subscribed. Coupon ONCE (perUserLimit 1). Store billing enabled. Staging DB write access for time travel (subscriptioncheckouts.createdAt, storebillingaccounts.providerClaimedAt). RECONCILIATION_SCHEDULER_ENABLED=true on staging for the sweep.

**Steps:**

1. 'Choose Plus' with coupon ONCE, 'Continue to payment', then close the Paystack tab without paying.
2. Return to /subscription and read the banner. Click 'Check payment' and let the callback finish polling (about 2 minutes).
3. Within the hour, open 'Choose Plus' again with ONCE and click 'Continue to payment'.
4. On iOS sign in as U1, open Profile > Subscription and tap Subscribe on any plan.
5. Set the first checkout's createdAt to 2 hours ago. Start 'Choose Plus' with ONCE again, then abandon that Paystack page too.
6. Set the second checkout's createdAt and storebillingaccounts.providerClaimedAt to 25 hours ago. Wait for the next 5-minute reconciliation tick, or click 'Check payment'.
7. Reload /subscription. On iOS reopen Subscription and tap Subscribe.

**Expect:** Step 2: the banner 'Returning from payment? Check your latest checkout before starting another payment.' is shown while the checkout is pending. The callback ends at 'Still confirming your subscription', because an unpaid ('abandoned') Paystack checkout is kept for 24 hours. Step 3: the dialog shows 409 'You already have a plan payment in progress. Finish it in the payment window, or check its status on your subscription page, before starting another.' and no second Paystack page opens. Step 4: native shows 'This account manages its subscription through another billing service. Continue using that service to avoid a second subscription.' and prepare returns 409 'This account manages subscriptions through web billing. Use that billing service to avoid a second subscription.' Step 5: the 2-hour-old checkout becomes EXPIRED, its ONCE redemption is RELEASED, and the new checkout opens with ONCE applied. Steps 6-7: the second checkout becomes EXPIRED with its seat RELEASED, and the callback shows 'This checkout expired'. The banner is gone because the browser handoff is cleared. The native catalog no longer reports a provider, so plans are offered, prepare succeeds, and storebillingaccounts.provider becomes 'apple'. Nothing is charged at any point.

**Needs:** Paystack test keys, store sandbox, staging DB

**Source:** `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.ts`, `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/lib/subscriptions.ts`

## SUBS-025 · P1 · Payment amount or currency mismatch is refused on verify and on the webhook

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging DB write access. PAYSTACK_SECRET_KEY known for signing test webhooks. A user with a pending Pro checkout paid in Paystack test mode, and another user with an unpaid pending checkout.

**Steps:**

1. Before verifying, change the paid pending checkout's finalAmount in the DB to 1.00, then POST /subscriptions/checkout/<id>/verify.
2. Repeat with the checkout currency changed to USD, then restore the row.
3. For the unpaid pending checkout, send a correctly signed charge.success webhook whose data.amount differs from finalAmount × 100. Send another with data.currency 'USD', and one with no amount.
4. Read the checkout, the subscription and the API logs. Then click 'Check payment' for that checkout.

**Expect:** Verify returns 409 'Payment does not match this subscription checkout' and does not activate. Each mismatched webhook is acknowledged (200) but does not activate: the checkout stays PENDING, the plan stays Free, and the log has the warning 'subscription settlement mismatch — not activating; left for manual review' with the expected and provider amount and currency. The amount must match to within half a pesewa. A later provider verify ('Check payment' or the reconciliation sweep) decides from Paystack's own record: a correctly paid charge activates, and an unpaid one stays pending and expires after 24 hours.

**Needs:** Paystack test keys, staging DB

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/services/providerCharge.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`

## SUBS-028 · P1 · Web downgrade by switching to a cheaper tier

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User U2 on Pro monthly (web), 5 days into the period, with 5 active campaigns and 2 collaborators on one campaign. Paystack test keys.

**Steps:**

1. On /subscription click 'Choose Plus'. Read the dialog, then click 'Replace plan and pay' and pay GH₵49.
2. Check the subscription, the campaign list and GET /api/v1/campaigns/creation-options.
3. Try to create a new campaign and to invite a collaborator.

**Expect:** The dialog is titled 'Switch to Plus' and warns 'Your Pro plan is active until <date>. Plus replaces it as soon as payment is confirmed, and unused time on Pro is not refunded or credited.' Plus activates immediately with a new 30-day period, and the Pro remainder is forfeited as disclosed and as billing terms clause 4 states. The existing 5 campaigns stay live, per billing terms section 5. Creating a campaign is blocked (403, Plus allows 3 active campaigns). Inviting a collaborator is blocked with 403 'Your Plus plan does not include campaign collaboration. Upgrade to unlock it.' Existing collaborators are not removed.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `packages/types/src/legal.ts`

## SUBS-032 · P1 · Web plans have no cancel control; the legacy cancel API is harmless

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User U2 on Pro (web, active). User U1 on Free.

**Steps:**

1. U2: open /subscription and look for a cancel button or dialog.
2. U2: POST /api/v1/subscriptions/cancel. Reload /subscription and call GET /subscriptions/mine.
3. U2: POST /api/v1/subscriptions/cancel again.
4. U1: POST /api/v1/subscriptions/cancel.
5. U2: verify Pro features (LIVE) still work until period end.

**Expect:** There is no 'Cancel subscription' button or dialog on web (or on the Expo-web screen). The plan card shows 'Ends in N days' and 'Your plan does not renew automatically. Buy again before it ends to keep your benefits.' The API endpoint, which no client uses, sets cancelAtPeriodEnd=true and leaves tier and status unchanged; the page still reads 'Ends in'. A second cancel returns 409 'Subscription is already scheduled for cancellation', and a Free-user cancel returns 400 'Cannot cancel a free plan subscription'. Pro features keep working until period end, and nothing is refunded.

**Needs:** None

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.tsx`, `apps/api/src/application/use-cases/CancelSubscriptionUseCase.ts`

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
5. {tier:'pro', billingCycle:'monthly', replaceCurrentPlan:'yes'}.
6. Open /subscription?tier=does_not_exist.

**Expect:** Free returns 400 'The free tier has no paid checkout; select it via POST /subscriptions'. An unknown tier, a missing or invalid cycle, an over-long coupon and a non-boolean replaceCurrentPlan each return 400 'Validation failed' with the field in errors. 'That subscription plan is not available' is reserved for built-in tiers that are inactive. The unknown-tier URL opens no checkout dialog, and the plan list renders normally. No Paystack transaction, checkout row or billing-rail claim is created for any of these.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/web/src/pages/SubscriptionPage.tsx`

## SUBS-038 · P1 · Payment receipts and confirmations reach the payer

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** Paystack test account with customer receipts enabled. User A with activity alert email on for 'Subscription updates' and a verified email. User B with default settings (alerts off).

**Steps:**

1. User A buys Plus monthly.
2. Check A's inbox for the Paystack receipt and any Ujimora email, and A's in-app notifications.
3. User B buys Plus monthly and checks the inbox and in-app notifications.

**Expect:** Requirement: every payer gets a purchase confirmation. The Paystack receipt arrives with GH₵49.00 for both users. A also gets the 'Subscription active' activity alert in-app and by email. Known open issue I051: Ujimora sends no purchase confirmation by default, because activity alerts are opt-in and off, so B's only confirmation is the Paystack receipt.

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

## SUBS-045 · P1 · Admin coupon CRUD, delete-or-deactivate and permissions

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Admin. Normal user token. Coupons: UNUSED (never applied), USED (1+ CONSUMED redemption), HELD (0 redemptions but one PENDING checkout holding a seat).

**Steps:**

1. Admin > Coupons > New coupon: walk through the Offer, Eligibility and Review steps and click 'Create coupon'. Verify the Review summary matches the inputs.
2. Edit the coupon (change the amount). Confirm the code field is not editable.
3. Filter Active/Inactive, search, and export.
4. Open the delete dialog for USED. Read it, try Delete, then click Deactivate.
5. Open the delete dialog for HELD and click Delete. Then settle HELD's pending checkout.
6. Delete UNUSED.
7. As a normal user: GET /coupons, POST /coupons, PUT /coupons/:id, DELETE /coupons/:id, POST /coupons/preview.

**Expect:** CRUD works and the code stays immutable. The dialog is titled 'Delete or deactivate <CODE>?' and explains 'Delete an unused coupon permanently. Used coupons can only be deactivated…'. For USED it adds 'This coupon has been redeemed N time(s), so it cannot be deleted.' and Delete is disabled. Deactivate shows 'Coupon deactivated', the coupon lists as Inactive, and a preview of it says it is no longer active. Deleting HELD returns 409 'This coupon has been used — deactivate it instead.', shown in the snackbar. Its pending checkout then settles at the discounted price, the coupon still exists, and the commission uses the basis captured on the checkout. UNUSED deletes with 'Coupon deleted'. A normal user gets 403 on every admin endpoint but can POST /coupons/preview.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/CouponsPage.tsx`, `apps/admin/src/pages/CreateCouponPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/couponRoutes.ts`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-048 · P1 · Commission basis: post-coupon vs list price

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Referred users R1 and R2 (pending referrals to AFF). Coupons POST33 (33%, commission basis 'Amount actually charged') and LIST33 (33%, 'Full list price'). Coupon FREE100 (100%, 'Amount actually charged'). Referred user R3.

**Steps:**

1. R1 buys Plus monthly with POST33 (pays 32.83).
2. R2 buys Plus monthly with LIST33.
3. R3 activates Plus with FREE100.
4. Read each checkout's commissionBase, each commission row and each referral status.

**Expect:** Each checkout stores the coupon's basis (post_coupon, list_price, post_coupon). R1's commission is 3.28 (10% of 32.83). R2's is 4.90 (10% of 49.00). R3's is 0.00, and R3's referral is marked converted. Requirement to confirm: a 100%-promo activation should not spend the affiliate's one-time conversion for nothing. Known open issue I062 (step 3, owner decision): a zero-commission conversion still consumes the referral.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`

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

## SUBS-052 · P1 · Commission maturity (scheduled and on read) and dashboard balances

*Surfaces:* api, web  ·  *Type:* functional

**Before:** AFF with a held commission and no payout destination yet. Staging DB write access, or AFFILIATE_HOLD_DAYS=0. RECONCILIATION_SCHEDULER_ENABLED=true on staging. A name-matched saved payout account for AFF.

**Steps:**

1. Open /affiliate as AFF and note the pending and available balances and the payout hint.
2. Set maturesAt in the past. Without opening the dashboard, wait for the next 5-minute reconciliation tick, then check affiliatecommissions and affiliatebalances.
3. Reload /affiliate.
4. Choose the saved account as the payout destination, then request a payout for less than the full available balance via the API, then for the full balance.

**Expect:** Before a destination is set, 'Request payout' is disabled with 'Choose a payout destination before requesting a payout.' The scheduled sweep matures the commission even though AFF has not logged in: the commission becomes available and the pending balance falls while the available balance rises by the same amount, to the pesewa. The dashboard shows the same figures. A partial request is refused with 422 'Affiliate payouts withdraw your full available balance of GHS <amount>. Refresh and try again.' The full-balance request is recorded as PENDING for admin approval.

**Needs:** Paystack (payout recipient)

**Source:** `apps/api/src/application/use-cases/MatureAffiliateCommissionsUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionMaturity.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/api/src/application/use-cases/RequestAffiliatePayoutUseCase.ts`, `apps/web/src/pages/AffiliateDashboardPage.tsx`, `apps/api/src/app.ts`

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

## SUBS-054 · P1 · Store purchases by referred users earn no commission, and the program copy says so

*Surfaces:* android, api, ios, marketing, web  ·  *Type:* compliance

**Before:** User R7 registered with AFF's ?ref= (pending referral). Store sandbox configured.

**Steps:**

1. R7 subscribes to Pro via the App Store sandbox on iOS.
2. Check affiliatecommissions and the referral status.
3. Read the marketing affiliate program FAQ, the web /affiliate dashboard and the mobile affiliate screen.

**Expect:** No commission is created and the referral stays pending. The copy matches this rule. Marketing FAQ: 'You earn a one-time 10% commission on the first paid plan each member who joins Ujimora through your referral link buys on the Ujimora website. Plans bought through the App Store or Google Play are not eligible.' Web and mobile describe a one-time commission when a referred member buys their first paid plan on the Ujimora website. Known open issue I061: store purchases are excluded by owner default, and because the referral stays pending, a later web purchase by R7 still pays AFF.

**Needs:** App Store sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/marketing/src/pages/AffiliateProgramPage.tsx`, `apps/web/src/pages/AffiliateDashboardPage.tsx`, `apps/mobile/app/affiliate.tsx`

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

## SUBS-068 · P1 · Cancelled store sheet holds the billing rail for 24 hours only

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Fresh user U10 on Free with no web checkout history. Staging DB write access (storebillingaccounts.providerClaimedAt). Paystack test keys.

**Steps:**

1. On iOS tap Subscribe on Plus, then Cancel on the Apple sheet.
2. Read the message.
3. On web as U10, 'Choose Plus' > 'Continue to payment'.
4. Set U10's storebillingaccounts.providerClaimedAt to 25 hours ago.
5. On web repeat 'Choose Plus' > 'Continue to payment', then read storebillingaccounts.provider.

**Expect:** The app shows 'Purchase cancelled.' and the entitlement does not change. Within 24 hours of the prepare, the web checkout returns 409 in the dialog: 'This account manages subscriptions through the App Store. Use that billing service to avoid a second subscription.' The web page has no store banner because billingProvider is unset. After the 24-hour hold, with no Apple purchase behind it, the claim is released: the web checkout opens Paystack and the provider becomes 'web'. There is still no self-service or admin release action.

**Needs:** Store sandbox, Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `docs/compliance/STORE_BILLING.md`

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

**Before:** UA with an active Apple Pro (sandbox) and no wallet, affiliate or campaign balances. A web-Pro user UW with no balances. Both know their passwords.

**Steps:**

1. Native Settings > Delete account: read the warning, enter the current password (and an authenticator or recovery code if MFA is on), then confirm 'Delete your account?'.
2. Let the next sandbox renewal occur.
3. Check the admin Store billing recovery queue.
4. Web as UW: open Delete account, read the dialog, enter the password and delete. Check UW's subscription row.
5. Try the web delete with a wrong password, and via API without a password.

**Expect:** The native warning says '…An App Store or Google Play subscription is not cancelled automatically; cancel it in your store subscription settings to stop renewal.' The web dialog says 'An App Store or Google Play subscription is not cancelled automatically; cancel it in your Apple or Google Play subscription settings to stop renewal.' Deletion needs the current password: a wrong or missing password returns 400 and the session stays usable. After UA's deletion, renewal verification returns 410 'The account is no longer active.' and the purchase appears as review required. Access is never re-granted. UW's subscription gets cancelAtPeriodEnd true. Support has a documented response for users charged after deletion (store refund).

**Needs:** Store sandbox

**Source:** `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`

## SUBS-087 · P1 · Store billing config validation at startup

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Staging deploy where env vars can be edited.

**Steps:**

1. STORE_BILLING_ENABLED=true with STORE_BILLING_PRODUCTS='not json'. Deploy and check the logs.
2. A catalog with a duplicate productId, a Google entry without basePlanId, an Apple entry with basePlanId, and tier 'free'.
3. A missing STORE_RECEIPT_ENCRYPTION_KEY_BASE64, or a key that is not 32 bytes.
4. APPLE_IAP_ENVIRONMENT=production without APPLE_IAP_APP_ID.
5. APPLE_IAP_ENVIRONMENT=production with APPLE_IAP_ALLOW_SANDBOX_FALLBACK=maybe.
6. A correct config: confirm GET /health/ready returns 200 and GET /store-billing/catalog/apple lists the products.

**Expect:** Each invalid config fails startup with 'Store billing configuration is invalid or incomplete. Check the server-only catalog, credentials, environment and receipt-encryption key.', and the logs contain no key or credential text. APPLE_IAP_ALLOW_SANDBOX_FALLBACK accepts only 'true', 'false' or empty, and is checked only when APPLE_IAP_ENVIRONMENT=production. A correct config boots, /health/ready returns {status:'ok'} (503 when MongoDB is unreachable), and the catalog lists only active public plans. Rotating the receipt key breaks decryption of existing purchases, so back it up and never rotate it without a migration.

**Needs:** Render/staging env access

**Source:** `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/app.ts`, `docs/compliance/STORE_BILLING.md`

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

## SUBS-090 · P1 · Admin Subscriptions list: accurate metrics and no dead actions

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A mix of subscriptions: free; web monthly and yearly (active); Apple and Google (active); one Apple TestFlight/sandbox purchase; one web Pro whose period has ended (stored status still active); one on a custom tier. The admin has edited the Pro monthly price to 155.

**Steps:**

1. Admin > Subscriptions: read the KPIs, the info alert and the revenue-by-tier strip.
2. Filter by tier (including the custom tier) and status; search by email; paginate; export and open the file.
3. Look at the row actions for an active row.
4. Compare GET /api/v1/subscriptions for the lapsed web Pro row with its DB status.

**Expect:** KPIs read 'Total Subscribers', 'Estimated MRR (list price)', 'Free or lapsed' and 'Paying now'. 'Paying now' counts only paid tiers that are active and inside their period, excluding sandbox store rows. The lapsed web Pro shows status 'expired' (derived by the API; the DB still says active) and counts under 'Free or lapsed'. MRR prices web-billed rows at live DB prices (Pro 155), and the alert notes 'N paying subscriber(s) … billed by the App Store or Google Play and not priced here.' The alert also says estimates use list prices, ignore discounts, are not money collected, and 'Change or cancel a subscription through its billing provider; this console has no subscription controls.' The strip header is 'Estimated monthly revenue by tier (list price)' and names the custom tier. The tier filter and row chips use live plan names. Rows offer only 'View' (opens /users/<id>), with no Tier or Cancel buttons. Filters, search, pagination and export work, and the export has a Provider column. Record: the export has no environment column, so sandbox rows look like paid Apple rows in the file.

**Needs:** Store sandbox for the store rows

**Source:** `apps/admin/src/pages/SubscriptionsPage.tsx`, `apps/admin/src/lib/subscriptionMetrics.ts`, `apps/admin/src/lib/subscriptionRevenue.ts`, `apps/api/src/application/use-cases/ListSubscriptionsUseCase.ts`, `apps/api/src/domain/services/subscriptionStatus.ts`

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

## SUBS-N001 · P1 · Early renewal of the same web plan adds time instead of restarting it

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User U2 with an active web Pro monthly, 10 days into the period; note currentPeriodStart and currentPeriodEnd. Paystack test keys.

**Steps:**

1. Open /subscription and read the Pro card button.
2. Click 'Renew Pro' (Monthly). Read the dialog title, text, total and button.
3. Click 'Continue to payment' and pay GH₵149 with the test card.
4. Call GET /api/v1/subscriptions/mine. Read subscriptions.paymentReferences and both subscriptioncheckouts rows.
5. Resend the renewal's charge.success webhook from the Paystack dashboard.

**Expect:** The Pro card shows an enabled 'Renew Pro' button. The dialog is titled 'Renew Pro' and reads 'One-time payment. Adds 30 days after your current plan ends on <end date>, so no paid time is lost. Your plan does not renew automatically.' It shows 'Total due today GH₵149.00' and the button 'Continue to payment'. No replace warning appears. After settlement the tier is pro and status active. currentPeriodStart is unchanged and currentPeriodEnd = old end + 30 days (about 50 days from now). paymentReferences lists both sub- references. The resent webhook changes nothing, and the plan card shows 'Ends in' about 50 days.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/domain/services/subscriptionStatus.ts`

## SUBS-N004 · P1 · A late genuine payment on an expired checkout still activates the plan

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** User U on Free. Paystack test keys and webhook. Staging DB write access.

**Steps:**

1. Start a Pro checkout and leave the Paystack page open without paying.
2. Move the checkout's createdAt back 25 hours and click 'Check payment' until the callback shows 'This checkout expired'.
3. Complete the payment on the still-open Paystack page with the test card.
4. Check the webhook log, the checkout and the subscription.
5. Repeat with the webhook blocked while paying, then use 'Check payment'. Finally resend the webhook from the Paystack dashboard.

**Expect:** The signed charge.success settles the EXPIRED checkout (EXPIRED to SUCCEEDED is allowed). Pro is active for 30 days and the money is never silently dropped. In the blocked-webhook variant, 'Check payment' keeps showing 'This checkout expired', because member verify and the sweep only re-check PENDING checkouts. The plan activates only when Paystack's webhook is resent. Record this as a support procedure: for an 'expired' checkout the member says was paid, resend the webhook from Paystack.

**Needs:** Paystack test keys, staging DB

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/GetSubscriptionCheckoutUseCase.ts`

## SUBS-N005 · P1 · A failed Paystack initialize closes the checkout so an immediate retry works

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** User U on Free. Coupon RETRY1 (perUserLimit 1). Staging where PAYSTACK_SECRET_KEY can be set to an invalid non-empty value.

**Steps:**

1. Set the invalid key. Click 'Choose Plus', apply RETRY1, then 'Continue to payment'.
2. Read the dialog error, the checkout row and the RETRY1 redemption row.
3. Restore the key and click 'Continue to payment' again with RETRY1.

**Expect:** The dialog shows 'Paystack initialization failed: <Paystack message>' (502), and nothing is charged. The checkout row is EXPIRED with no providerRef, and the RETRY1 redemption is RELEASED. The retry opens Paystack at once with RETRY1 applied: no 409 'payment in progress' and no coupon 'already used' error.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## SUBS-N007 · P1 · Refund edge cases: renewal refund shortens, superseded refund is ignored, partial refund keeps access

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Paystack test refunds. User R with web Pro monthly renewed early (charges C1 and C2; period end about 60 days out). User S who bought Plus (charge P1) and then switched to Pro. User T on Pro with a charge that can be partly refunded; T was referred, so a commission exists.

**Steps:**

1. Refund C2 in full in Paystack and wait for refund.processed.
2. Replay the refund webhook.
3. Refund S's superseded Plus charge P1 in full.
4. Partially refund T's Pro charge (e.g. GH₵50 of 149).
5. Read the subscriptions of R, S and T, the API logs and T's commission.

**Expect:** R's currentPeriodEnd moves back 30 days, R stays active on the first period, and paymentReferences lists only C1. The replay changes nothing. S's Pro is untouched, because the refund of a charge not in paymentReferences is ignored. T keeps access, and the log warns 'partial subscription refund; plan access left unchanged'. T's affiliate commission is reversed in full even for a partial refund (the current rule; confirm with finance). Store-billed plans are never changed by Paystack refunds.

**Needs:** Paystack test keys (refunds)

**Source:** `apps/api/src/application/use-cases/RevokeRefundedSubscriptionUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/services/AffiliateCommissionService.ts`

## SUBS-N008 · P1 · Billing rail claim moves between web and store only when nothing is live on it

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Store sandbox and Paystack test keys. UW: web Plus that has lapsed, with storebillingaccounts.providerClaimedAt moved back 25 hours. UA: Apple Plus with auto-renew turned off, now expired, claim older than 24 hours. UA2: Apple plan whose renewal failed, with auto-renew still on, expired under 60 days ago, claim older than 24 hours.

**Steps:**

1. UW on iOS: open Subscription, tap Subscribe on Plus and complete the sandbox purchase.
2. UA on web: open /subscription, read the chip and banner, then 'Choose Pro' and pay.
3. UA2 on web: 'Choose Plus' > 'Continue to payment'.
4. After each step, read storebillingaccounts.provider and the subscription row (billingProvider, storePurchaseKey, billingEnvironment).

**Expect:** UW: the catalog reports no provider, plans are offered, prepare succeeds, the claim moves to 'apple', and Plus is active with billingProvider apple. UA: the page shows 'Expired' with no store banner and the Choose buttons enabled. The checkout opens and the claim moves to 'web'. The lapsed store row becomes a web row (billingProvider web, storePurchaseKey and billingEnvironment removed), and settlement activates Pro for 30 days. UA2: 409 'This account manages subscriptions through the App Store. Use that billing service to avoid a second subscription.', because the store may still renew within its 60-day retry window. There is no admin release action.

**Needs:** Store sandbox, Paystack test keys, staging DB

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `docs/compliance/STORE_BILLING.md`

## SUBS-N009 · P1 · Organization team seats follow the organization's plan (owner included)

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Organization accounts: OrgC on Community (1 seat), OrgP on Pro (3 seats) and OrgO on Organization (10 seats). Several invitee emails, some with existing accounts.

**Steps:**

1. OrgC owner: at /organization-team invite one member as editor.
2. OrgP owner: invite 2 members, then a 3rd.
3. OrgP: re-send the invitation to one already-invited email.
4. OrgP: remove one member (or move an invitation's expiresAt into the past) and invite someone new.
5. Let OrgP's Pro lapse (staging DB) and invite another member.
6. OrgO: invite 9 members, then a 10th. Check an invitee with an account for an in-app notice.

**Expect:** OrgC's invite gets 403 'Your Community plan includes 1 team seat, including the owner. Upgrade the organization's plan or remove a member before inviting someone new.' OrgP's first two invites succeed with 'Invitation created. If the recipient already has an account, it appears in their notifications; no email has been sent, so also share this workspace link with them.' The 3rd gets the same 403 for 'Pro' and '3 team seats'. Re-sending to an invited email needs no new seat. A freed seat allows a new invite. After OrgP's plan lapses it falls back to Community, and the invite gets 403 for 1 seat. OrgO's 9 invites succeed and the 10th is refused. Existing members are never removed. Invitees with accounts get an 'Organization invitation' notice.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/app.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/pages/OrganizationTeamPage.tsx`

## SUBS-N011 · P1 · The Apple sandbox fallback can be disabled and never triggers on an outage

*Surfaces:* api, ios  ·  *Type:* negative/edge

**Before:** A production-configured API on a staging host (APPLE_IAP_ENVIRONMENT=production, APPLE_IAP_APP_ID set). A TestFlight build pointed at it. A sandbox tester. Optional: network control over outbound calls to Apple's production App Store Server API.

**Steps:**

1. Set APPLE_IAP_ALLOW_SANDBOX_FALLBACK=false, redeploy, and buy Pro in TestFlight.
2. Send a sandbox App Store Server notification to /api/v1/webhooks/store/apple.
3. Unset the variable (default true). If network control is available, make production App Store Server API calls fail (timeout or 5xx) and buy again.
4. Read the subscription and storepurchases after each step.

**Expect:** With the fallback off, verify returns 422 'The store could not verify this subscription.', the app shows a failed purchase and no plan is granted. The sandbox notification returns 401 'Invalid App Store notification.' During a production outage the server does not fall back to sandbox: verification fails with a retryable error, nothing is granted, and auto-restore later completes it once production answers. Sandbox is tried only when production definitively reports the transaction as not found.

**Needs:** App Store Connect, TestFlight, Apple IAP keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/StorePurchaseVerifier.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `docs/compliance/STORE_BILLING.md`

## SUBS-N015 · P1 · Ended campaigns stop counting against the plan's active-campaign cap

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Free user F (identity verified) with 1 active campaign. Staging DB write access.

**Steps:**

1. F: GET /api/v1/campaigns/creation-options and try to create a 2nd campaign.
2. Set F's campaign endDate to 1 minute ago.
3. Immediately call GET creation-options again and create a 2nd campaign.
4. Wait about 5 minutes and read the first campaign's status. Check Explore.

**Expect:** Before the end date, creation is refused with 403 'Your Community plan allows 1 active campaign. Upgrade to create more.' Once the end date passes, the slot is free at once, before any relabel: creation-options shows room and the 2nd campaign is accepted. Within about 5 minutes the ended campaign's status becomes 'expired' and it leaves Explore. Pending, blocked and deleted campaigns are never relabelled.

**Needs:** None

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`

## SUBS-N016 · P1 · Refunding an already-paid affiliate commission creates an outstanding clawback

*Surfaces:* api, web  ·  *Type:* functional

**Before:** AFF with a verified payout destination. Commission K1 (14.90) from R1's web charge, matured and paid out through an approved affiliate payout (status paid). A later commission K2 that is available. Paystack test refunds.

**Steps:**

1. Refund R1's sub- charge in full in Paystack.
2. Read K1's status, affiliatebalances.clawbackOutstanding and the API logs.
3. Open /affiliate as AFF and read Available.
4. Request a payout for the full displayed amount.

**Expect:** K1 becomes reversed and clawbackOutstanding is 14.90. The log has the error 'affiliate commission reversed after its funds left the unwindable bucket; recorded as outstanding clawback'. The dashboard's Available equals the available balance minus 14.90 (never below 0), and a payout must match that reduced amount. R1's plan also ends (SUBS-051).

**Needs:** Paystack test keys (refunds, transfers)

**Source:** `apps/api/src/application/services/AffiliateCommissionService.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `apps/api/src/application/use-cases/RequestAffiliatePayoutUseCase.ts`

## SUBS-N017 · P1 · Provider-reported disputes and outside refunds on subscription charges reach staff

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Admin and member tokens. Paystack test mode, and the ability to send correctly signed webhooks. A settled web subscription charge.

**Steps:**

1. Send a signed charge.dispute.create whose data.transaction.reference is the settled sub- reference.
2. Refund another sub- charge directly in the Paystack dashboard, not through Ujimora.
3. As admin call GET /api/v1/admin/payments/provider-events, then POST /api/v1/admin/payments/provider-events/<id>/acknowledge.
4. Redeliver both webhooks.
5. Check the disputed member's plan. Call the provider-events endpoint as a member.

**Expect:** Each event is recorded once in providerpaymentevents (unique event key, no customer details) with subject 'subscription', and appears in the provider-events list. Acknowledge marks it reviewed, and redelivery creates no duplicate. The refund also takes back the plan time (SUBS-051). The dispute moves no money and does not change the plan. A member gets 403. Known open issue I009: there is no admin console page for non-campaign provider events (API only), and a subscription chargeback does not suspend or revoke the plan.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## SUBS-010 · P2 · Pricing fetch failures show an error, never stale prices, and do not block Free signup

*Surfaces:* api, marketing, web  ·  *Type:* recovery/idempotency

**Before:** Staging where /plans/public can be blocked (e.g. browser devtools request blocking).

**Steps:**

1. Block /api/v1/plans/public and open marketing /pricing.
2. Click 'Retry' after unblocking.
3. Block /plans/public and open /register to the Plan step. Try to create a Free account, then look for paid plans.
4. Unblock and click Retry on the signup alert.
5. Block GET /api/v1/plans and open web /subscription.

**Expect:** Marketing shows 'Current pricing could not be loaded' with Retry, and Retry recovers. Signup shows the alert 'We couldn’t load current prices. You can still create a Free account, or retry to see paid plans.' with Retry. A static 'Free' option ('No monthly charge') is shown and a Free account can be created. No paid tier is listed or selectable until prices load, and Retry then shows Plus and Pro with live prices. /subscription falls back to seed prices for display (usePlanMap). Confirm this is acceptable: the charge is always priced server-side, but a displayed price may differ from the charged price after an admin price change.

**Needs:** None

**Source:** `apps/marketing/src/pages/PricingPage.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/hooks/useSubscription.ts`

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

## SUBS-029 · P2 · Switching billing cycle on the same tier renews the plan and keeps paid time

*Surfaces:* api, web  ·  *Type:* functional

**Before:** User on Pro monthly (web), active. Paystack test keys.

**Steps:**

1. Open /subscription, toggle Yearly, and read the Pro card button.
2. Click 'Renew Pro'. Read the dialog, then pay GH₵1,490.00.
3. Read the subscription tier, billingCycle, currentPeriodStart, currentPeriodEnd and paymentReferences.
4. Read the page meta description.

**Expect:** The Pro card shows an enabled 'Renew Pro' button, not a disabled 'Current Plan'. The dialog is titled 'Renew Pro' and reads 'One-time payment. Adds 1 year (365 days) after your current plan ends on <date>, so no paid time is lost. Your plan does not renew automatically.' After payment the tier is pro and billingCycle is yearly. currentPeriodStart is unchanged, currentPeriodEnd = previous end + 365 days, and paymentReferences lists both charges. The meta description reads 'See the Ujimora plan you are on and when it ends, buy a 30-day or one-year plan with a one-time payment, apply a coupon, and check the platform fee your plan carries.'

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`

## SUBS-036 · P2 · Web checkout when Paystack is not configured

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging API with PAYSTACK_SECRET_KEY blank.

**Steps:**

1. As a user 'Choose Pro' > 'Continue to payment'.
2. Apply a 100% coupon and try 'Activate plan'.

**Expect:** The API returns 501. The dialog shows 'Online payments aren't configured yet... you haven't been charged'. Even the 100% coupon path is refused (501). No subscription change.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/web/src/lib/subscriptions.ts`

## SUBS-037 · P2 · Callback page edge states, polling pattern and rate-limit handling

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Completed and pending checkouts available. A script that can call the verify endpoint repeatedly as one member.

**Steps:**

1. Open /subscription/callback with no query params.
2. Open with only ?reference=<valid sub- ref> in a private window after logging in (no localStorage handoff).
3. Open ?checkout=<succeeded 100%-coupon checkout>.
4. Rename the Pro plan in admin to 'Pro Max' and open the callback for a Pro checkout.
5. As one member send 120 POST /subscriptions/checkout/<id>/verify calls within 15 minutes, then open the callback for a pending checkout.
6. Wait 60 seconds and click 'Keep checking'.

**Expect:** No params shows 'We couldn't find a checkout to confirm' with 'Go to subscription'. Reference-only resolves the correct checkout. The coupon checkout shows 'Your coupon covered the full price — no payment was needed'. Requirement: the heading uses the live name 'Pro Max'. On a 429 the page stops polling at once and shows 'Still confirming your subscription' with the extra sentence 'We have checked many times in a short while, so please wait a minute before checking again.' 'Keep checking' is disabled for 60 seconds and then works. The page never shows failure because of the rate limit. Known open issue I069 (residual): SubscriptionCallbackPage still names plans from the seed, so it shows 'Pro', not 'Pro Max'.

**Needs:** None

**Source:** `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`

## SUBS-046 · P2 · Coupon leaves a tiny residual amount

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Coupon ALMOST: fixed 48.99 on Plus monthly (final 0.01), perUserLimit 1.

**Steps:**

1. Preview ALMOST on Plus monthly and click 'Continue to payment'.
2. If an error is shown, read the checkout and redemption rows, then click 'Continue to payment' again.

**Expect:** Either Paystack accepts GH₵0.01 and the checkout proceeds normally, or the dialog shows 502 'Paystack initialization failed: <Paystack message>'. In the error case the checkout row is EXPIRED and the ALMOST redemption RELEASED, so the retry gets the same Paystack error, not a 409 'payment in progress' or 'already used' error. Record which happens, and consider enforcing a minimum charge or rounding tiny residuals to free.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/PaystackGateway.ts`

## SUBS-092 · P2 · Subscription activity alerts (in-app and email)

*Surfaces:* api, email, ios, web  ·  *Type:* functional

**Before:** User with the 'Subscription updates' category enabled for in-app and email after a known time. Email verified. Email provider configured.

**Steps:**

1. Buy Plus (web).
2. Schedule the end: turn off auto-renew on a store plan, or for a web plan call POST /api/v1/subscriptions/cancel (the web page has no cancel button).
3. Force expiry (staging DB).
4. Disable the category and trigger another change.
5. Repeat with the email unverified.

**Expect:** In-app notifications and emails such as 'Subscription active', 'Subscription scheduled to end' and 'Subscription expired' link to /subscription, show the period end date and say 'Manage billing with the provider shown in your subscription settings.' No alerts go out once the category is disabled. No email is sent while the address is unverified (it is suppressed). Retries produce no duplicates.

**Needs:** Email provider

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `packages/types/src/activity-alerts.ts`, `apps/api/src/application/use-cases/CancelSubscriptionUseCase.ts`

## SUBS-094 · P2 · Expo web build of the subscription screen stays off native

*Surfaces:* api, web  ·  *Type:* cross-platform

**Before:** Only if an Expo web export of apps/mobile is deployed anywhere.

**Steps:**

1. Open the Expo web Subscription screen. Choose a plan, apply a coupon and pay via Paystack.
2. Confirm the native builds never render this variant (the .native.tsx file takes precedence).

**Expect:** If deployed, the web variant behaves like the web app: Paystack checkout, coupon preview, polling, and the Enterprise mailto. createSubscriptionCheckout throws 'Use App Store or Google Play billing for native subscriptions.' on native platforms. If it is not deployed, mark this N/A.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/screens/SubscriptionScreen.tsx`, `apps/mobile/src/lib/subscriptions.ts`

## SUBS-N006 · P2 · The 'Returning from payment?' banner appears only while the last checkout is pending

*Surfaces:* web  ·  *Type:* functional

**Before:** Free user. Paystack test keys (success and decline cards). DB write access for the expiry variant.

**Steps:**

1. Start a Pro checkout, reach Paystack, and go back to /subscription without paying. Read the banner and the localStorage key uf_pending_subscriptions.
2. Finish a payment successfully, let the callback confirm, then open /subscription.
3. Start another checkout, pay with the decline card, see 'Payment didn’t go through', then open /subscription.
4. Start another checkout, abandon it, move its createdAt back 25 hours, open the callback ('This checkout expired'), then open /subscription.
5. Reload each page. Repeat one variant with site storage blocked.

**Expect:** Only the pending case shows 'Returning from payment? Check your latest checkout before starting another payment.' with 'Check payment'. After a success, failure or expiry, the callback or subscription page removes that checkout's entry (and the __last pointer) from uf_pending_subscriptions. No banner shows and it stays hidden on reload. With storage blocked the page still renders, without the banner.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/pages/SubscriptionCallbackPage.tsx`, `apps/web/src/lib/subscriptions.ts`

## SUBS-N010 · P2 · The subscription verify rate limit is per member and separate from donations

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Members A and B on the same network (same public IP), each with a pending checkout. A script that can call the API.

**Steps:**

1. As A, send 120 POST /api/v1/subscriptions/checkout/<id>/verify calls within 15 minutes, then a 121st.
2. As B from the same IP, POST verify for B's own checkout.
3. From the same IP, start a guest donation checkout.
4. As A, call GET /api/v1/subscriptions/checkout/<id>.

**Expect:** A's 121st verify returns 429 'Too many requests, please try again later'. B's verify succeeds, because the bucket is keyed on the signed-in member, not the IP. The donation checkout is unaffected (it has its own donation-intent bucket). A's GET still works, subject only to the general API limit. A's callback page shows the rate-limited timeout state (SUBS-037).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`

## SUBS-N012 · P2 · Admin edits a plan's order, accent colour and Popular flag

*Surfaces:* admin, api, marketing, web  ·  *Type:* functional

**Before:** Admin. Seed plans.

**Steps:**

1. Admin > Plans > Plus > 'Edit plan': set Sort order below Pro's, Accent colour '#1E88E5' and Popular on. Save.
2. Reload marketing /pricing, web /subscription and the /register Plan step and compare order and highlighting.
3. Open Admin > Audit log for subscription-plan.update.
4. Edit Plus with Accent colour 'red' and save.
5. Revert all changes.

**Expect:** The save persists (PUT /plans/starter) and the audit entry shows a before/after diff of sortOrder, accentColor and popular. Every surface orders plans by the new sortOrder. On web, Plus gets the highlighted (popular) treatment: the contained button and 'Recommended for growth'. The invalid accent returns a 400 field error and the plan is unchanged.

**Needs:** None

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/application/use-cases/UpdatePlanUseCase.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/marketing/src/pages/PricingPage.tsx`

## SUBS-N013 · P2 · Admin plan prices are labelled as web-only and do not change store prices

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Admin. Store billing enabled with Pro products. A Free user on web and on each native app.

**Steps:**

1. Open Admin > Plans and read the info alert.
2. Open 'Edit plan' and 'New plan' and read the helper text under Monthly and Yearly price and the Benefits toggle labels.
3. Change the Pro monthly price to 155 and save.
4. Open web /subscription and the native Subscription screens.

**Expect:** The alert says 'Prices here apply to web checkout (Paystack) only' and that store subscribers pay the App Store or Google Play product price, and asks admins to update the matching store products after a price change. Every price field shows 'Web checkout price. Update store products separately.' The four unbuilt benefit toggles read '(not built — hidden from members)'. Web shows GH₵155, while native still shows the unchanged store displayPrice. docs/compliance/STORE_BILLING.md has a 'Changing plan prices' procedure. Revert to 149.

**Needs:** Store billing staging config

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `docs/compliance/STORE_BILLING.md`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## SUBS-N014 · P2 · A coupon's commission basis is fixed when the checkout is quoted

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Referred user R (pending referral to AFF). Coupon LIST33 (33%, commission basis 'Full list price'). Paystack test keys.

**Steps:**

1. R: 'Choose Plus' with LIST33 > 'Continue to payment', without paying yet.
2. Admin edits LIST33's commission basis to 'Amount actually charged'.
3. R pays on the open Paystack page.
4. Read the checkout's commissionBase and the affiliatecommissions row.
5. A second referred user checks out with LIST33 after the edit and pays.

**Expect:** The first checkout stores commissionBase 'list_price', and its commission is 4.90 (10% of 49.00), from the snapshot rather than the edited coupon. The second checkout stores 'post_coupon', and its commission is 3.28 (10% of 32.83).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/use-cases/SettleSubscriptionUseCase.ts`, `apps/admin/src/pages/CouponsPage.tsx`

## SUBS-N018 · P2 · Current plan card wording for Free, web and store plans

*Surfaces:* web  ·  *Type:* functional

**Before:** Users: Free; web Plus monthly; web Pro yearly; Apple-billed Pro with auto-renew on.

**Steps:**

1. Free user: open /subscription and read the current plan card.
2. Web Plus monthly and web Pro yearly: read the card stats, period row and chips.
3. Apple-billed Pro on web: read the banner and stats. Turn off auto-renew in iOS Settings, wait for the notification or re-check, and reload.

**Expect:** Free: 'Plan length' 'Free', 'Ends' 'No end date', and no period row. Web plans: 'Plan length' '30 days' or '1 year', 'Ends in N days', and a period row with 'Your plan does not renew automatically. Buy again before it ends to keep your benefits.' Store plan: the banner 'Your subscription is billed through App Store. Change plans or cancel there to avoid a second subscription.' with 'Manage subscription', 'Billing' 'Monthly' or 'Yearly', and 'Renews in N days'. After auto-renew is off, the label becomes 'Ends in N days'. Plan chips never mention Featured Listing, Priority Support, Analytics, Custom Branding or Escrow; 'Split proceeds' is used instead.

**Needs:** Store sandbox for the store row

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/lib/subscriptionStatus.ts`
