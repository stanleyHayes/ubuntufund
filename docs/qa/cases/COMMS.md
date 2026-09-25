# Notifications, email & marketing site (102 cases)

In-app notifications, activity alerts, transactional email, newsletter, marketing pages, SEO/OG, blog, short links.

[Back to the QA plan](../README.md)

## COMMS-001 · P0 · Production email configuration preflight (Resend + encryption key + public URL + startup capability log)

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Render dashboard access for the ujimora-api service; one ordinary test account; production or staging deploy.

**Steps:**

1. In Render, open ujimora-api → Environment. Confirm RESEND_API_KEY, FROM_EMAIL=no-reply@ujimora.com, REPLY_TO_EMAIL=support@ujimora.com, PUBLIC_WEB_URL=https://app.ujimora.com and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 all have values. render.yaml now declares AUTH_EMAIL_ENCRYPTION_KEY_BASE64 and MFA_ENCRYPTION_KEY as sync:false. An existing Blueprint service does not create sync:false variables automatically, so each value still has to be pasted in by hand.
2. Decode AUTH_EMAIL_ENCRYPTION_KEY_BASE64 locally (base64 -d | wc -c) and confirm it is exactly 32 bytes and differs from MFA_ENCRYPTION_KEY, the JWT secrets and STORE_RECEIPT_ENCRYPTION_KEY_BASE64.
3. Redeploy. In the deploy's startup logs, search for 'Production capabilities disabled by missing configuration'.
4. Sign in at https://app.ujimora.com with DevTools Network open.
5. Open /settings → Notifications and inspect the responses of GET /api/v1/email-verification and GET /api/v1/profile/activity-alerts.
6. Sign out, open /forgot-password, submit the test account's email and watch the HTTP status.

**Expect:** The startup log has no 'Production capabilities disabled by missing configuration' error. When a key is missing, that line names 'account email (password reset, email verification, newsletter confirmation, password-changed notices): needs RESEND_API_KEY, FROM_EMAIL, AUTH_EMAIL_ENCRYPTION_KEY_BASE64 (32 bytes, base64) and an https PUBLIC_WEB_URL'. It gives variable names only, never values. The responses show deliveryConfigured=true and emailConfigured=true, and there is no 'Email delivery is temporarily unavailable' banner. Forgot-password returns 200 (not 503) and an email from no-reply@ujimora.com arrives. If the key is missing or not 32 bytes, recovery, verification and newsletter all return 503. Treat that as a launch blocker.

**Needs:** Resend account with API key; Render dashboard

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/app.ts`, `render.yaml`, `DEPLOYMENT.md`, `docs/compliance/ACCOUNT_EMAILS.md`

## COMMS-002 · P0 · Sender domain authentication and inbox placement

*Surfaces:* email  ·  *Type:* compliance

**Before:** COMMS-001 passed. Test inboxes at Gmail, Outlook.com, Yahoo and iCloud.

**Steps:**

1. In the Resend dashboard, confirm the ujimora.com domain is Verified (SPF and DKIM) and that a DMARC TXT record exists for _dmarc.ujimora.com.
2. Trigger a password reset to each of the four inboxes.
3. In Gmail, use 'Show original' and read the SPF, DKIM and DMARC results and the DKIM signing domain.
4. Record which folder each message lands in (Inbox, Promotions or Spam).
5. Check the From header (must be no-reply@ujimora.com, the FROM_EMAIL value in render.yaml) and the Reply-To header (must be support@ujimora.com, the REPLY_TO_EMAIL value).

**Expect:** SPF, DKIM and DMARC all pass, with d=ujimora.com aligned to the From domain. Messages reach the Inbox at most providers. The subject is 'Reset your Ujimora password'. From is no-reply@ujimora.com and Reply-To is support@ujimora.com. If the headers still show info@, the Render dashboard values were not synced from the updated render.yaml.

**Needs:** Resend; DNS access; external mailboxes

**Source:** `apps/api/src/infrastructure/adapters/outbound/ResendActivityEmails.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `render.yaml`, `packages/types/src/legal.ts`

## COMMS-003 · P0 · Transactional email content, readability and link-fragment preservation

*Surfaces:* android, email, ios, web  ·  *Type:* cross-platform

**Before:** Email configured. Messages available for every purpose: reset, verification, password changed, newsletter confirmation, privacy-request response and one activity alert.

**Steps:**

1. Open each message in Gmail web, the Gmail iOS/Android app, Outlook and Apple Mail.
2. Check that the plain-text body wraps and that links are tappable on a 390px phone screen.
3. Tap each link and confirm the browser address still contains '#token=' before the page loads. Resend click tracking or a mail scanner must not strip the fragment.
4. Confirm no password, OTP or amount-only secret appears in any body, and that security and verification emails say they are not marketing.
5. Confirm the support contact shown matches the published support mailbox.

**Expect:** Every link opens the correct app.ujimora.com page with the full token fragment, and the copy is accurate. The verification email says it does not subscribe you to activity or marketing emails. The password-changed email gives the forgot-password URL. Every email's support line reads 'Support: support@ujimora.com' (REPLY_TO_EMAIL), which matches the support mailbox in legal.ts. Reply-To is support@ujimora.com and From is no-reply@ujimora.com.

**Needs:** Resend (check whether click tracking is enabled); multiple mail clients

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `packages/types/src/legal.ts`, `render.yaml`

## COMMS-004 · P0 · No reset, verification or newsletter tokens in logs, responses or plaintext storage

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Render log access; read-only MongoDB access (Compass).

**Steps:**

1. Trigger a password reset, an email verification and a newsletter signup.
2. Search Render logs for 'reset-password#', 'verify-email#', 'newsletter/confirm#', 'token=' and the recipient address.
3. Inspect the JSON responses of POST /auth/forgot-password, POST /email-verification and POST /newsletter/subscribe.
4. In Mongo, open the accountemailjobs collection while a job is pending, and again after it is sent. Open passwordresettokens, emailverificationtokens and newsletterconsenttokens.

**Expect:** No raw link or token appears in logs or responses. encryptedPayload is iv.tag.ciphertext and is removed once the job is sent or suppressed. Token collections store only SHA-256 hashes.

**Needs:** Render logs; MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/application/services/NewsletterConsentService.ts`, `docs/compliance/LOGGING_PRIVACY.md`

## COMMS-005 · P0 · Password reset happy path on web, with session revocation and security notice

*Surfaces:* email, ios, web  ·  *Type:* functional

**Before:** User A with a known password, signed in on a second browser and in the mobile app.

**Steps:**

1. Signed out, open https://app.ujimora.com/forgot-password, enter A's email and click 'Send reset link'.
2. Confirm the 'Check your email' state appears.
3. Within about 60 seconds, open the email 'Reset your Ujimora password' and click the link.
4. On /reset-password, confirm the address bar no longer shows '#token'.
5. Enter a new password and matching confirmation, then submit.
6. Click Sign in. Log in with the new password, then try the old password.
7. In the second browser and the mobile app, perform any authenticated action.

**Expect:** The email arrives within about a minute (the worker runs every 30s). The success page reads 'Your password has changed and previous sessions have ended'. The new password works and the old one fails. Other sessions are forced to sign in again. A second email, 'Your Ujimora password changed', arrives with no password in it.

**Needs:** Resend; real inbox

**Source:** `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/web/src/pages/ResetPasswordPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## COMMS-006 · P0 · Forgot-password does not reveal whether an account exists (web, admin, mobile)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** One registered email and one unregistered email.

**Steps:**

1. On app.ujimora.com/forgot-password, submit the registered email and note the HTTP status, body and duration in the Network tab.
2. Submit the unregistered email and record the same.
3. Repeat each five times, 61 seconds apart.
4. Repeat on admin.ujimora.com/forgot-password and on the mobile Forgot password screen.

**Expect:** Status, body and UI are identical for both addresses. Both take at least about 500ms with no consistent timing gap. No email is sent for the unknown address. The admin page states that the response is the same whether or not the email is registered.

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/admin/src/pages/ForgotPasswordPage.tsx`, `apps/mobile/app/forgot-password.tsx`

## COMMS-007 · P0 · Reset links: single use, 30-minute expiry, 60-second cooldown, older links superseded

*Surfaces:* api, email, web  ·  *Type:* recovery/idempotency

**Before:** User A; email configured.

**Steps:**

1. Request a reset, then request again within 60 seconds.
2. Wait 61 seconds and request a third time. Count the emails received.
3. Reset the password using the newest link.
4. Open the older link and submit a new password.
5. Reopen the link you already used and submit again.
6. Request a fresh link, wait 31 minutes, then submit.

**Expect:** Exactly 2 emails arrive; the request inside the cooldown still shows success. After one reset, the other link fails with 'The password could not be reset… expired or been used', because the credential version changed. Replaying a used link fails. A link older than 30 minutes fails.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`

## COMMS-008 · P0 · Reset page token hygiene: fragment only, never sent in URLs or Referer

*Surfaces:* web  ·  *Type:* security/permission

**Before:** A valid reset email.

**Steps:**

1. Open DevTools Network with 'Preserve log' on, then open the reset link.
2. Confirm the fragment is removed from the address bar after load.
3. Inspect every request and confirm the token appears only in the POST /api/v1/auth/reset-password body. Check that Referer headers do not carry it.
4. Refresh the page.
5. In a fresh link, enter mismatched passwords, then a 7-character password.

**Expect:** The token never appears in any URL, query string or Referer. After a refresh the page shows 'Open the complete link from your reset email'. Client-side errors 'Your passwords do not match.' and 'Use between 8 and 128 characters.' appear without an API call.

**Needs:** Resend

**Source:** `apps/web/src/pages/ResetPasswordPage.tsx`, `docs/compliance/ACCOUNT_EMAILS.md`

## COMMS-009 · P0 · Mobile password recovery round trip (iOS and Android)

*Surfaces:* android, email, ios, web  ·  *Type:* cross-platform

**Before:** Signed release or TestFlight / internal-track build; user A signed in on the device.

**Steps:**

1. Sign out. On Login, tap 'Forgot password?'.
2. Submit the email and confirm 'Request received'.
3. Open the mail app on the same phone and tap the link.
4. Confirm it opens in Safari or Chrome at app.ujimora.com/reset-password. The app claims no https universal links.
5. Reset the password, return to the app and sign in with the new password.
6. Turn on airplane mode and submit the request again.

**Expect:** The web reset succeeds and the app sign-in works with the new password. Offline, the app shows 'Can't reach Ujimora. Check your connection and try again.' It never shows a false success. A server-side outage (5xx) still shows 'Password recovery is temporarily unavailable. Please try again later.'

**Needs:** Physical devices; Resend

**Source:** `apps/mobile/app/forgot-password.tsx`, `apps/mobile/src/lib/authMessages.ts`, `apps/mobile/src/lib/api.ts`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app.json`

## COMMS-011 · P0 · Password-change security notice from Settings (web and mobile); changing device stays signed in

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** User A signed in on web (browser 1), a second browser (browser 2) and the mobile app; email configured.

**Steps:**

1. In browser 1, change the password from Profile (current password plus new password).
2. Keep using browser 1: reload and open /dashboard and /settings.
3. Check A's inbox.
4. In browser 2 and the mobile app, perform any authenticated action.
5. Sign in again on mobile, then change the password from Edit profile → 'Update password'. Keep using the app, including a biometric unlock if it is enabled.

**Expect:** 'Your Ujimora password changed' arrives. It contains no password, gives a link to app.ujimora.com/forgot-password and a support contact (support@ujimora.com), and says it is not a marketing subscription. The device that made the change stays signed in, because it stores the rotated tokens returned by /auth/change-password. Every other session (browser 2, the other device) is revoked and must sign in again. On mobile the notice reads 'Password updated'. If the device cannot store the new sign-in, it shows 'Password updated, but this device could not save the new sign-in. Sign in again before using biometric unlock.' A refused change (wrong current password) leaves the session untouched.

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/src/lib/accountSecurity.ts`, `apps/mobile/app/profile/edit.tsx`

## COMMS-014 · P0 · Email verification happy path (web), including the link sent at signup

*Surfaces:* email, web  ·  *Type:* functional

**Before:** Email delivery configured. A fresh, unregistered email address.

**Steps:**

1. Register a new account at app.ujimora.com/register.
2. Within about 60 seconds, confirm 'Verify your Ujimora email address' arrived without being requested.
3. Go to /settings → Notifications. Confirm the account shows as unverified and click 'Send verification link' within 60 seconds of signup; confirm no second email arrives (per-account cooldown).
4. Open the email and click the link.
5. On /verify-email, click 'Verify email address'.
6. Back in Settings, click 'Check verification status'.
7. Confirm the activity switches (all off), newsletter status, KYC level and role are unchanged.
8. If you verified in a different browser, confirm that browser was not signed in by the page.

**Expect:** Signup queues a verification link, and a failure to queue it never fails registration. Only one email arrives inside the cooldown. The success page reads 'Your email is verified. Your activity and marketing choices have not changed…'. The email switches become enabled but stay off. The verify page creates no session. The Dashboard verification notice disappears after verification.

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/web/src/components/account/ActivityAlertSettings.tsx`

## COMMS-017 · P0 · Mobile email verification round trip

*Surfaces:* android, email, ios, web  ·  *Type:* cross-platform

**Before:** Unverified user on physical devices.

**Steps:**

1. In the app, open Settings → Notifications and tap 'Send verification link'.
2. Open the email on the phone and tap the link. It opens in the browser at /verify-email.
3. Tap 'Verify email address'.
4. Switch back to the app and tap 'Check verification status'.
5. Turn on the email switch for one category.

**Expect:** The app shows the account as verified after the status check. The email switches become enabled, and the chosen switch saves and persists after reopening Settings.

**Needs:** Physical devices; Resend

**Source:** `apps/mobile/src/components/ActivityAlertSettings.tsx`, `apps/mobile/app/settings.tsx`

## COMMS-018 · P0 · Activity alerts default off everywhere; no alerts without opt-in

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Brand-new account with a campaign; Paystack test keys.

**Steps:**

1. Open web /settings → Notifications and mobile Settings → Notifications.
2. Inspect GET /api/v1/profile/activity-alerts.
3. Receive a test donation to the user's campaign, then wait 2 minutes.
4. Check the bell, Dashboard notifications and the inbox.
5. Toggle the legacy profile flags (e.g. donationReceipts via PUT /profile notificationPreferences) and repeat.

**Expect:** All 7 categories × 2 channels are off. No inbox item or email is created. Legacy profile flags never produce alerts. Copy states that the choices do not subscribe you to marketing.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`, `packages/types/src/activity-alerts.ts`, `docs/compliance/ACTIVITY_ALERTS.md`

## COMMS-022 · P0 · Donation alert content and amount accuracy (owner and donor, with platform tip)

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Creator A (verified; donationsReceived in-app and email on) with an active campaign. Donor B signed in with donationsSent on. Paystack test card.

**Steps:**

1. As B, donate GHS 100 plus an optional platform tip of GHS 5 on /c/<slug>/donate.
2. Wait up to 90 seconds.
3. Compare A's bell item and email, and B's item and email, with My Donations, the campaign total and admin Donations.
4. Make a second donation of GHS 50 with no tip and compare B's alert.
5. Click 'View details' in the email and in the app.

**Expect:** A gets 'Your campaign received a donation': 'A supporter donated GHS 100.00 to “<title>”.' It has no donor name and never mentions the tip. B gets 'Your donation is confirmed': 'Your donation of GHS 100.00 to “<title>” is confirmed. Total charged: GHS 105.00, including a GHS 5.00 optional platform tip. This payment confirmation is not a charitable tax certificate.' The GHS 50 no-tip donation has no 'Total charged' sentence. Amounts use 2 decimals and the correct currency. The donation amount equals the stored donation, and the total equals what Paystack charged. Links open /campaigns/:id and /donations. Each alert arrives exactly once, and only the campaign creator is alerted (not collaborators or split beneficiaries). Donations settled before this release have no stored tip, so they show no total line.

**Needs:** Paystack test keys; Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/infrastructure/database/models/DonationModel.ts`

## COMMS-023 · P0 · Anonymous and guest donors: privacy and receipt expectations

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** As in COMMS-022, plus a logged-out guest with email G.

**Steps:**

1. As B, donate with the Anonymous option on.
2. As a guest, donate using email G.
3. Check A's alerts, B's alerts and G's inbox.
4. As a guest, open /donate/callback with no reference (or clear the stored reference) and read the message.

**Expect:** A's alerts never include a name or email. B still gets its own confirmation, with the 'Total charged' line if a tip was added. Guest G receives no Ujimora email; the only receipt is Paystack's. The callback page no longer promises an emailed receipt. It reads 'We couldn't find a payment reference to confirm. If money left your account, don't pay again. Keep any receipt from Paystack or your bank or mobile money provider, and email support@ujimora.com with the reference so we can check it.' Known open issue I051: there are no transactional receipts or notifications by default (a guest gets no Ujimora receipt). Product and legal must confirm this is acceptable for launch.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/web/src/pages/DonateCallbackPage.tsx`, `docs/compliance/ACTIVITY_ALERTS.md`

## COMMS-025 · P0 · Payout and withdrawal lifecycle alerts (requested, processing, completed with net, failed, reversed)

*Surfaces:* admin, email, web  ·  *Type:* functional

**Before:** A has 'Withdrawals and payouts' in-app and email on, plus an eligible balance. Paystack test transfers.

**Steps:**

1. A requests a GHS 200 Priority cashout from the campaign's 'Cashout & payout history' panel.
2. An admin approves it on admin /payouts.
3. Let the Paystack test transfer.success webhook arrive.
4. Compare the completed alert with the fee and net amount in the payout history.
5. Repeat with a forced transfer.failed, then a transfer.reversed.
6. Replay each webhook from the Paystack dashboard.

**Expect:** There is one alert per state: 'Your withdrawal is requested', 'is processing', 'is completed' (only after settlement is applied), 'is failed' and 'is reversed'. Each body starts 'The GHS 200.00 request is <state>.' and ends 'Open your payout history for fees, net amount and the latest status.'. When a completed (PAID) payout had a fee, the body also says 'GHS <net> was sent after GHS <fee> in fees.', and those figures match the payout history. The other states show only the gross amount. Replays create no duplicates. The link opens the campaign (or /creator for creator withdrawals).

**Needs:** Paystack test keys; Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/paystack-owner-notifications-and-cashout.md`

## COMMS-030 · P0 · No duplicate alerts or emails on webhook replay or API restart

*Surfaces:* api, email, web  ·  *Type:* recovery/idempotency

**Before:** Owner and donor opted in to in-app and email.

**Steps:**

1. Complete a donation.
2. Resend the charge.success webhook three times from the Paystack dashboard.
3. While a delivery is pending, restart the API with a manual deploy in Render.
4. Count bell items, emails and Resend log entries, and inspect activityalertdeliveries.

**Expect:** Exactly one inbox item and one email per recipient. Resend shows a single message per idempotency key (activity/<id>), and delivery IDs are deterministic.

**Needs:** Paystack test keys; Resend; Render

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/main.ts`

## COMMS-034 · P0 · Notification access control

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Users A and B; an ID of one of A's notifications.

**Steps:**

1. As B, send PUT /api/v1/notifications/<A's id>/read.
2. As B, send PUT /api/v1/notifications/abc/read.
3. Send GET /api/v1/notifications without a token.
4. Sign out and check the web header and the mobile header.
5. As B, send PUT /notifications/read-all, then check A's unread count.

**Expect:** B marking A's item returns 404, so its existence is not revealed. A malformed ID returns 400. No token returns 401. The bell is hidden when signed out. B's read-all changes only B's items.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/MarkNotificationAsReadUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/notificationRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`

## COMMS-037 · P0 · iOS never requests notification permission

*Surfaces:* ios  ·  *Type:* compliance

**Before:** Fresh TestFlight install of the release candidate.

**Steps:**

1. Complete first launch, signup, login, KYC start, the donate hand-off and Settings → Notifications.
2. Open iOS Settings → Ujimora.

**Expect:** No notification permission prompt appears at any point, and iOS Settings shows no Notifications entry for the app. In-app copy says SMS and device push are not available yet, matching APP_REVIEW_NOTES.

**Needs:** TestFlight

**Source:** `docs/compliance/PUSH_NOTIFICATIONS.md`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/app/settings.tsx`

## COMMS-038 · P0 · Android does not declare or request POST_NOTIFICATIONS

*Surfaces:* android  ·  *Type:* compliance

**Before:** Release build from the internal testing track on Android 13 or 14.

**Steps:**

1. Install the app and use all main flows.
2. Open App info → Permissions.
3. Run adb shell dumpsys package com.ujimora.app and search for POST_NOTIFICATIONS.

**Expect:** No notification prompt appears, and the permission is not requested or granted. The screen-share foreground-service permission is still present.

**Needs:** Play internal testing; adb

**Source:** `apps/mobile/app.json`, `docs/compliance/PUSH_NOTIFICATIONS.md`

## COMMS-040 · P0 · Newsletter double opt-in from marketing footer and blog

*Surfaces:* admin, email, marketing, web  ·  *Type:* compliance

**Before:** Fresh email N1; admin account.

**Steps:**

1. On ujimora.com, check the footer: the consent checkbox is unchecked and Subscribe is disabled.
2. Enter N1, tick 'Email me Ujimora stories and promotional updates.' and click Subscribe.
3. Read the success message.
4. Confirm N1 is absent from admin /newsletter.
5. Open 'Confirm your Ujimora newsletter subscription', go to app.ujimora.com/newsletter/confirm and click 'Confirm subscription'.
6. Refresh admin /newsletter.
7. Repeat the signup from the ujimora.com/blog signup box with a second email.

**Expect:** No subscription exists until confirmed. The email includes a cancel/unsubscribe link and a support contact. After confirming, N1 appears in admin with its confirmed date. Nothing is sent until confirmation.

**Needs:** Resend

**Source:** `apps/marketing/src/components/NewsletterSignup.tsx`, `apps/api/src/application/services/NewsletterConsentService.ts`, `apps/web/src/pages/NewsletterConsentPage.tsx`, `docs/compliance/NEWSLETTER.md`

## COMMS-041 · P0 · Unsubscribe without sign-in is idempotent, and old links keep working

*Surfaces:* admin, email, web  ·  *Type:* compliance

**Before:** N1 is confirmed.

**Steps:**

1. In a logged-out browser, open the unsubscribe link and click 'Unsubscribe'.
2. Click again, or reopen the link and submit again.
3. Check admin /newsletter.
4. Re-subscribe N1 and confirm.
5. Use the OLD unsubscribe link from the first email.

**Expect:** 'You are unsubscribed…' appears both times. N1 is removed from the admin list. The old link withdraws the renewed subscription as well.

**Needs:** Resend

**Source:** `apps/api/src/application/services/NewsletterConsentService.ts`, `apps/web/src/pages/NewsletterConsentPage.tsx`

## COMMS-060 · P0 · Pricing page matches the actual plans, one-time web billing and checkout amounts

*Surfaces:* admin, marketing, web  ·  *Type:* compliance

**Before:** Admin plan configuration known.

**Steps:**

1. For each plan, compare ujimora.com/pricing (Monthly and Yearly) with admin /plans and the amount shown at web /subscription checkout.
2. Monthly: check the price suffix '/ 30 days' and the line 'One-time payment on the website · does not auto-renew'.
3. Yearly: check the per-month figure (priceYearly/12, up to 2 decimals) and 'GH₵ X for 1 year · One-time payment on the website · does not auto-renew'.
4. Check the platform fee %, the goal caps ('No goal limit' for unlimited plans), 'Split proceeds', 'Live streaming', 'Organization team seats (incl. owner)' and the collaboration rows.
5. Read the pricing FAQ entries 'Do plans renew automatically?', 'How does the yearly option work?' and 'What happens if I stop paying?'.
6. Confirm Enterprise links to /contact.
7. Block /api/v1/plans/public and reload.

**Expect:** Every figure matches exactly, and nothing is hardcoded or stale. The page no longer lists Featured listing, Priority support, Advanced analytics or Custom branding. The escrowSupport flag is labelled 'Split proceeds' (never 'Escrow'). Copy states that website plans are one-time payments that do not auto-renew, while App Store and Google Play subscriptions renew until cancelled in the store. Web checkout says the plan does not renew automatically. A failed load shows 'Current pricing could not be loaded. Please try again.' with Retry. Fee disclosure is accurate for Electronic Transactions Act compliance.

**Needs:** None

**Source:** `apps/marketing/src/pages/PricingPage.tsx`, `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `packages/types/src/legal.ts`

## COMMS-061 · P0 · Legal hub, policy content and entity facts on marketing, web and native

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Legal owner available for sign-off.

**Steps:**

1. Open ujimora.com/legal and confirm all 9 policies are listed.
2. On each page, check the effective date, 'DevTrack', BN843072020, the registered address and the contact mailboxes.
3. Open app.ujimora.com/terms (and the other slugs) and view source: the canonical must be https://ujimora.com/<slug>.
4. In the mobile app, open each legal screen (terms, privacy, cookies, refund-policy, acceptable-use, organizer-agreement, contributor-terms, billing-terms, delete-account) and compare the text.
5. Have the legal owner review the edited clauses listed in COMMS-N016. LEGAL_ACCEPTANCE_VERSION and effectiveDate did not change, so no re-acceptance is prompted.

**Expect:** The text is identical across surfaces, the canonicals point to marketing, and the legal owner signs off the revised Terms, Privacy, Organizer Agreement, Cookie Notice and Billing Terms wording. Known open issue I020: operator identity is still inconsistent (Neurodyne Corp Ltd vs DevTrack BN843072020), and I021: the READINESS C01 external gate is still open. The entity cannot be signed off until both are resolved.

**Needs:** Legal sign-off

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/web/src/pages/LegalPage.tsx`, `apps/mobile/src/components/LegalScreen.tsx`, `docs/compliance/READINESS.md`

## COMMS-062 · P0 · Published mailboxes receive mail; replies to transactional email land in support@

*Surfaces:* email, marketing  ·  *Type:* compliance

**Before:** Access to each mailbox; the Render dashboard FROM_EMAIL/REPLY_TO_EMAIL values synced from render.yaml.

**Steps:**

1. From an external account, send to info@, support@, trust@, legal@, sales@ and no-reply@ujimora.com.
2. Reply to a password-reset email and to an activity alert.
3. Open ujimora.com/contact and check which address the 'Email us' channel shows.
4. Record which inbox receives each message.

**Expect:** Every published address delivers to a monitored inbox. Decide and document what happens to mail sent to no-reply@. Replies to transactional email reach support@ujimora.com (REPLY_TO_EMAIL), which matches legal.ts. The contact page labels the CMS email channel 'Email us' (not 'Email support'). info@ also receives staff alerts for campaign reviews and contact messages by default (REVIEW_ALERT_EMAIL), so its owner must be named.

**Needs:** Mail hosting

**Source:** `packages/types/src/legal.ts`, `render.yaml`, `apps/marketing/src/pages/ContactPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`

## COMMS-063 · P0 · Public account-deletion page for the stores

*Surfaces:* marketing, web  ·  *Type:* compliance

**Before:** Logged-out browsers on desktop and phone.

**Steps:**

1. Open https://ujimora.com/delete-account and https://app.ujimora.com/delete-account.
2. Tap 'Request account and data deletion by email' and check the prefilled subject and body.
3. Tap 'Open account settings on the website'.
4. Enter the URL in Play Console (Data deletion) and App Store Connect, and confirm it appears in the marketing sitemap.

**Expect:** Both pages are reachable without login, the mailto is prefilled to legal@ujimora.com, the settings link works and the URL is accepted by both consoles.

**Needs:** Store consoles

**Source:** `packages/types/src/legal.ts`, `apps/marketing/public/sitemap.xml`, `docs/compliance/READINESS.md`

## COMMS-073 · P0 · Preset-amount QR: the scanned amount carries through checkout

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Amount codes for 50 and 12.5; Paystack test keys.

**Steps:**

1. Scan with Android Chrome, iPhone Camera (opens Safari) and a desktop browser.
2. Confirm /c/<slug>/donate shows the exact preset amount and that the donor can change it.
3. Complete a test payment and compare the fee/tip breakdown with the recorded donation.

**Expect:** The prefill is exact (50.00 and 12.50). The iOS flow completes on the web with no in-app payment. The recorded donation amount equals the chosen amount, and fees and tip match the breakdown. A native deep link /c/<slug>/donate?amount maps to the donate screen with the amount.

**Needs:** Paystack test keys; physical devices

**Source:** `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/campaign/shared.tsx`

## COMMS-079 · P0 · Account deletion removes messaging data and stops all email

*Surfaces:* android, api, email, ios, web  ·  *Type:* compliance

**Before:** A user with inbox items (including a staff-decision notice), an active newsletter subscription, activity preferences, a QR code with a label and a pending verification email. The user has no non-zero wallet, campaign, tip or affiliate balance and no pending, processing or needs-review payouts, or deletion is refused. MongoDB read access.

**Steps:**

1. Delete the account on web: Settings → Delete account, enter the current password (plus an authenticator or recovery code if MFA is on) and click 'Delete my account'. Repeat once on mobile using the inline Delete account section.
2. Use the old newsletter unsubscribe link and the old verification link.
3. Check the notifications, newslettersubscriptions, newsletterconsenttokens, activityalertpreferences, accountemailjobs, activityalertdeliveries and shortlinks collections for the user.
4. Trigger activity that would have produced alerts or staff-decision notices.

**Expect:** Deletion needs the password, and a double click sends one request. Messaging records are removed, the short-link label is unset, old links fail gracefully and no further email or inbox notice is sent (staff-decision notices skip deleted accounts). Financial records remain intact as designed. A user with a balance or open payout instead sees the closure reason (amounts, payouts and support@ujimora.com) and no delete action.

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `docs/compliance/DATA_RIGHTS.md`, `docs/compliance/NEWSLETTER.md`

## COMMS-N016 · P0 · Legal copy no longer promises features that do not exist

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Legal owner available.

**Steps:**

1. Open /terms and read sections 14 and 15.
2. Open /privacy and read 'Optional activity alerts and emails', 'Optional account protection', section 7 (retention) and section 10 (cookies).
3. Open /organizer-agreement section 10 and /billing-terms clauses 2–3.
4. Compare with app.ujimora.com and the native legal screens.
5. Sign in as an existing user on web and mobile.

**Expect:** Terms s.14 lets users escalate to legal@ujimora.com and says privacy complaints can also be submitted in account Settings; it no longer claims a documented escalation process. Terms s.15 says earlier versions are available on request from legal@ujimora.com. Privacy says team decisions on your campaigns, verification applications and reports appear in your inbox as service notices, and that security audit records are kept only as long as needed. Retention questions go to the privacy contact, not a claimed retention schedule. s.10 says no cookies, analytics or advertising technologies are currently used. The Organizer Agreement describes account-level acceptance (user ID, agreement version, timestamp) with no campaign ID. Billing Terms say website plans are one-time and do not renew. Text is identical on every surface. LEGAL_ACCEPTANCE_VERSION did not change, so no re-acceptance banner appears. The legal owner confirms that no version bump is needed.

**Needs:** Legal sign-off

**Source:** `packages/types/src/legal.ts`, `apps/marketing/__tests__/legalClaims.test.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`

## COMMS-N017 · P0 · Public marketing and product copy makes no false claims (escrow, trust scores, worldwide donations)

*Surfaces:* admin, android, ios, marketing, web  ·  *Type:* compliance

**Before:** Production deploys; admin access to Content → FAQ; App Store and Play listing access.

**Steps:**

1. View source on ujimora.com: meta description, keywords, og:description, twitter:description and the JSON-LD description. Open /site.webmanifest.
2. On ujimora.com/help, search the FAQ for 'escrow', 'trust score', 'Google', 'Facebook', 'worldwide', 'frozen', 'banned' and 'tax'.
3. Check the escrowSupport feature label on marketing /pricing, web /subscription, the mobile Subscription tab and admin /plans.
4. Open the mobile Verification screen banner.
5. In admin /content/faq, compare the live production FAQ with apps/api/src/infrastructure/database/siteContentDefaults.json.
6. Search the App Store and Play listings for 'escrow' or 'trust score'.

**Expect:** The description reads 'Ghana's crowdfunding platform built on trust: reviewed campaigns, verified organizers and transparent donation records.', and 'escrow' is not a keyword. The FAQ has no social sign-in, 'anyone worldwide can donate', trust-score, frozen-funds, permanent-ban or tax-deductibility claims. It says donations are in GHS through Paystack and that some foreign cards may not work. The feature is labelled 'Split proceeds' everywhere. The mobile banner reads 'Higher verification levels unlock higher campaign limits.' The FAQ seed only runs on an empty collection, so any old wording still in the production CMS FAQ must be replaced by hand from siteContentDefaults.json. The store listings match.

**Needs:** Admin CMS; store consoles

**Source:** `apps/marketing/index.html`, `apps/marketing/public/site.webmanifest`, `apps/marketing/src/pages/HelpPage.tsx`, `apps/api/src/infrastructure/database/siteContentDefaults.json`, `apps/marketing/src/pages/PricingPage.tsx`, `apps/mobile/app/verification.tsx`, `apps/marketing/__tests__/publicClaims.test.ts`

## COMMS-010 · P1 · Recovery, verification and newsletter behave honestly when email is unconfigured

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* negative/edge

**Before:** Staging with AUTH_EMAIL_ENCRYPTION_KEY_BASE64 unset, or RESEND_API_KEY blank.

**Steps:**

1. Submit forgot-password on web, admin and mobile.
2. In Settings, click 'Send verification link'.
3. Submit the marketing footer newsletter form.
4. Open Settings → Notifications.

**Expect:** The API returns 503. Every UI shows 'temporarily unavailable' or 'Could not request a subscription', and none claims an email was sent. Settings shows the email-unavailable notice. No stack traces are exposed.

**Needs:** Staging environment

**Source:** `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/api/src/application/services/NewsletterConsentService.ts`, `apps/marketing/src/components/NewsletterSignup.tsx`

## COMMS-012 · P1 · Admin console password recovery

*Surfaces:* admin, email, web  ·  *Type:* functional

**Before:** Admin account.

**Steps:**

1. Open admin.ujimora.com/forgot-password and submit the admin email.
2. Open the email link (it goes to app.ujimora.com/reset-password) and reset the password.
3. Sign in at admin.ujimora.com with the new password, completing MFA if it is enabled.
4. Check that the admin's other open console sessions are ended.

**Expect:** The reset works end to end, admin login succeeds with the new password, and old admin sessions are revoked.

**Needs:** Resend

**Source:** `apps/admin/src/pages/ForgotPasswordPage.tsx`, `apps/web/src/pages/ResetPasswordPage.tsx`

## COMMS-013 · P1 · Pending account emails are suppressed after account deletion

*Surfaces:* api, email, web  ·  *Type:* recovery/idempotency

**Before:** Disposable user C with no wallet, campaign, tip or affiliate balance and no open payouts, so deletion is allowed. Staging where Resend can be made to fail temporarily (invalid key) so the job stays pending.

**Steps:**

1. As C, request a password reset while Resend is failing.
2. In Settings, click Delete account. Enter C's current password (and an authenticator or recovery code if MFA is on), then click 'Delete my account'.
3. Restore the Resend key and wait 2 minutes.
4. Check C's inbox and the accountemailjobs collection.
5. Request a reset for C's email again.

**Expect:** The delete dialog first shows 'Checking your balances and campaigns…'. It then deletes the account only after the password is accepted, and a double click sends one DELETE. The pending job is removed or suppressed and no email is delivered. The later reset request returns the same public success response and sends nothing.

**Needs:** Staging; Resend; MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`

## COMMS-015 · P1 · Verification link: scanner-safe, single use, and invalidated by expiry or password change

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Unverified user.

**Steps:**

1. Request a link. Run a plain GET on the full link URL with curl and open it in a private window without clicking.
2. Confirm GET /api/v1/email-verification still shows emailVerified=false.
3. Click 'Verify email address' in a normal browser, then click again (replay).
4. Request a new link, change the password, then use the link.
5. Request a new link, wait 31 minutes, then use it.
6. Open /verify-email#token=abc (malformed).

**Expect:** Loading the page alone never verifies. The first click succeeds. Replay, post-password-change and expired links show 'This link could not be confirmed…'. A malformed token shows the 'Open the complete link' warning with no API call.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/web/src/pages/VerifyEmailPage.tsx`

## COMMS-016 · P1 · Verification request: cooldown, already-verified and strict request body

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** One unverified and one verified user; an API client such as curl or Postman.

**Steps:**

1. Click 'Send verification link' twice within 60 seconds.
2. Send POST /api/v1/email-verification with body {"email":"attacker@example.com"} and a valid bearer token.
3. Send the same request with no Authorization header.
4. As the verified user, click 'Send verification link'.

**Expect:** Only one email arrives for the double click. An extra field returns 400; no auth returns 401. The verified user sees 'Your email is already verified.' and no email is sent. A recipient can never be chosen by the caller.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## COMMS-019 · P1 · Email channel requires a verified email; API rejects spoofed fields

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Unverified user.

**Steps:**

1. Confirm the Email switches are disabled and the 'Verify your email address to enable activity emails' notice shows.
2. Send PUT /api/v1/profile/activity-alerts with {category:'donationsReceived',channel:'email',enabled:true}.
3. Send PUT with the in-app channel.
4. Send PUT with an extra field userId:'<other id>'.
5. Send PUT without a token.

**Expect:** Email opt-in returns 409 'Verify your email address before enabling activity emails.'. In-app opt-in returns 200. The extra field returns 400 (strict schema). No token returns 401.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`

## COMMS-020 · P1 · Alert preferences persist independently and failures are visible

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Verified user.

**Steps:**

1. Turn on 'Donations received' in-app and reload.
2. Turn on 'Withdrawals and payouts' email and reload on both web and mobile.
3. Set DevTools to Offline (or airplane mode on the phone) and toggle another switch.
4. Toggle several switches rapidly.

**Expect:** Each choice is saved independently and appears the same on web and mobile. When offline, an error appears and the switch returns to its saved state. No unsaved choice is shown as saved.

**Needs:** None

**Source:** `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/mobile/src/components/ActivityAlertSettings.tsx`

## COMMS-021 · P1 · Alert timing: only activity after opt-in is sent, and opt-out suppresses queued alerts

*Surfaces:* api, email, web  ·  *Type:* compliance

**Before:** Creator A, verified; Paystack test keys.

**Steps:**

1. With alerts off, receive donation D1.
2. Turn on in-app and email for 'Donations received'.
3. Receive donation D2.
4. Turn email off, then receive D3 within 30 seconds.
5. Turn email on again and wait 2 minutes.
6. Inspect activityalertdeliveries.

**Expect:** Only D2 produces an inbox item and an email. D1 never alerts. D3's email delivery is 'suppressed' and is not sent after re-enabling.

**Needs:** Paystack test keys; Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## COMMS-024 · P1 · Foreign-currency (diaspora) donation alert accuracy

*Surfaces:* email, web  ·  *Type:* functional

**Before:** Flutterwave keys configured (pending); a USD test card; creator opted in.

**Steps:**

1. Donate USD 20 to A's campaign.
2. Compare the alert currency and amount with the stored donation record, the ledger entry and the campaign owner's view.

**Expect:** The alert shows the same currency and amount as the stored donation, with at most 0.01 difference and no double conversion.

**Needs:** Flutterwave keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/payments/`

## COMMS-026 · P1 · Creator tip alerts (web only; tips unavailable in native apps)

*Surfaces:* android, email, ios, web  ·  *Type:* cross-platform

**Before:** Creator with a paid subscription and creator page (creatorTips on). Signed-in supporter (donationsSent on).

**Steps:**

1. On web, tip GHS 20 at /creators/<handle>.
2. Wait up to 90 seconds and check both alerts.
3. Open the native app as the creator: confirm the alert is in the inbox.
4. Open the creator page in the native app as the supporter.

**Expect:** The creator gets 'You received creator support' with GHS 20.00 and a withdrawal-fee note. The supporter gets a confirmation. The alert arrives only after settlement. The native app offers no tip checkout.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/creator-donations.md`

## COMMS-027 · P1 · Refund status alerts driven by the admin Refund requests queue

*Surfaces:* admin, email, web  ·  *Type:* functional

**Before:** Donor B with 'Refund updates' in-app and email on, and an eligible card or MoMo donation. Admin with DONATIONS permission.

**Steps:**

1. B requests a refund at /donations/refund/:id.
2. As admin, open /refund-requests (also reachable from the bell item 'Donor refund requests'). Try an action with a staff note under 20 characters.
3. Enter a note of at least 20 characters and click 'Approve and mark processing'.
4. Try 'Mark refunded' before the linked payment is refunded at Paystack, then refund the payment through the refund operation and click 'Mark refunded'.
5. For a second request, enter a note and click 'Decline'.
6. Check B's bell and email at each status.

**Expect:** Actions stay disabled until the note has at least 20 characters. 'Mark refunded' stays disabled until the linked payment is REFUNDED or PARTIALLY_REFUNDED. Status only moves forward: Awaiting review → Processing → Refunded, or Declined or failed. B gets exactly one alert per change: 'Your refund is processing', 'Your refund is completed' and 'Your refund is failed' (after Decline). The body reads 'Your refund request for GHS X is <status>. Check the refund details for the approved amount and payment progress.' The amount matches the refund record and the link opens /refunds. The staff note is internal and never appears in the alert.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/admin/src/pages/RefundRequestsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.ts`

## COMMS-028 · P1 · Wallet top-up alert, including the iOS Safari hand-off

*Surfaces:* android, email, ios, web  ·  *Type:* cross-platform

**Before:** User with 'Wallet deposits and transfers' on; Paystack test keys.

**Steps:**

1. Top up GHS 50 on web /wallet.
2. In the iOS app, go to Wallet → add funds (opens Safari), complete payment and return to the app.
3. Repeat in the Android app.
4. Check the bell and the balance in each app.

**Expect:** A wallet deposit alert with GHS 50.00 appears in the app inbox after returning from Safari. The balance matches, and each top-up alerts once.

**Needs:** Paystack test keys; physical devices

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/mobile/src/components/WalletFunding.tsx`

## COMMS-029 · P1 · Subscription alerts for one-time web (Paystack) plans and store-billed native plans

*Surfaces:* android, email, ios, web  ·  *Type:* compliance

**Before:** 'Subscription updates' on. iOS sandbox tester and Android license tester. Staging MongoDB write access.

**Steps:**

1. On web, buy a paid plan through Paystack (a one-time payment for 30 days). Confirm /subscription shows 'Ends in' with no Cancel button.
2. In staging, set that subscription's currentPeriodEnd and activityNextCheckAt to a time in the past, leave activityPending true, and wait about a minute for the worker.
3. Reload /subscription and try to buy the same tier again.
4. On iOS and Android, buy the plan through in-app purchase in the sandbox.
5. Turn off auto-renew in the store's subscription management and wait for the store notification.
6. Read the alert text in the native inbox.

**Expect:** The web purchase alerts 'Subscription active': 'Your <tier> subscription is active. The current access period ends YYYY-MM-DD. Manage billing with the provider shown in your subscription settings.' After the end date it alerts 'Subscription expired', the page shows an Expired chip, and the same tier can be bought again. Web plans have nothing to cancel and never produce 'scheduled to end'. A store subscription with auto-renew off alerts 'Subscription scheduled to end', with its period-end date. No native inbox item links to web checkout or quotes web prices (App Store 3.1.1).

**Needs:** Paystack test keys; App Store and Play sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.ts`, `apps/web/src/pages/SubscriptionPage.tsx`, `docs/compliance/STORE_BILLING.md`

## COMMS-031 · P1 · Email provider outage, retry, 23-hour review state and staff resolution

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** Staging; MongoDB write access for simulation; admin account.

**Steps:**

1. Set an invalid RESEND_API_KEY and trigger an email alert.
2. Watch the delivery: status 'pending', lastError 'activity_delivery_retry_pending', with attempts rising about every 60 seconds.
3. Restore the key and confirm a single delivery.
4. Repeat, then set firstAttemptAt to 23 hours ago while the provider is still failing.
5. Check the Render logs for 'activity email needs a delivery check'.
6. In admin, open Platform → 'Activity email checks' (/activity-email-review) and resolve the row following COMMS-N009.

**Expect:** Retries reuse the same payload and key and deliver exactly once after the fix. An ambiguous attempt older than 23 hours moves to 'review' with lastError 'email_delivery_requires_review' and is never re-sent automatically. The worker logs a warning with the row id, category, attempts and first attempt, but no address or body. The row appears on the admin Activity email checks page and in the bell item 'Activity emails needing a delivery check'. Staff record 'delivered' or 'suppressed' after checking Resend by the idempotency key 'activity/<id>'.

**Needs:** Staging; Resend; MongoDB

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActivityDeliveryRoutes.ts`, `apps/admin/src/pages/ActivityEmailReviewPage.tsx`, `docs/compliance/ACTIVITY_ALERTS.md`

## COMMS-032 · P1 · Web notification bell and Dashboard inbox behaviour

*Surfaces:* web  ·  *Type:* functional

**Before:** User A with at least 3 unread alerts.

**Steps:**

1. Compare the badge number with GET /api/v1/notifications/unread-count.
2. Open the bell and check items are newest first.
3. Click 'Mark as read' on one item, then 'Mark all read'.
4. With /dashboard open in a second tab, switch focus to it and check the Notifications panel.
5. Click 'View details'.
6. Using the keyboard only: Tab to the bell, press Enter, then Esc. Check the screen-reader label 'Notifications (N unread)'.

**Expect:** The count matches the server. Read state syncs across the bell, the panel and tabs on focus. The panel shows at most 10 items. View details navigates in-app. Accessibility labels and focus behave correctly.

**Needs:** None

**Source:** `packages/ui/src/components/NotificationBell.tsx`, `apps/web/src/components/account/OwnerNotifications.tsx`, `apps/web/src/components/layout/Header.tsx`

## COMMS-033 · P1 · Mobile bell, inbox and View details deep paths

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Alerts with each path type: /campaigns/:id, /donations, /refunds, /wallet, /creator, /subscription, /dashboard, plus staff-decision notices with /my-campaigns and /kyc.

**Steps:**

1. Check the header bell badge. In staging, seed more than 99 unread items and compare the badge with GET /api/v1/notifications/unread-count.
2. Open the modal and tap 'Mark as read'.
3. Tap 'View details' for each path type.
4. Background the app, create a new alert, then bring the app back to the foreground.

**Expect:** Each path opens the right native screen: campaign detail, My donations, My refunds, the Wallet tab, Creator, the Subscription tab, Dashboard, My campaigns and Verification (kyc). None shows 'not found'. The badge should equal the server unread count and cap at '99+'. The list refreshes on foreground. Known open issue I103 (client follow-up not done): GET /notifications now returns only the newest 50, and the mobile badge counts unread items in that list, so with more than 50 unread it shows at most 50 and never '99+'. Mobile still has no 'Mark all read'.

**Needs:** Physical devices

**Source:** `apps/mobile/src/components/NotificationBell.tsx`, `apps/mobile/src/components/OwnerNotifications.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/src/context/NotificationContext.tsx`, `apps/api/src/application/use-cases/GetMyNotificationsUseCase.ts`

## COMMS-035 · P1 · Shared device: switching accounts shows no previous user's notifications

*Surfaces:* android, ios, web  ·  *Type:* security/permission

**Before:** A has alerts; B has none.

**Steps:**

1. Sign in as A and open the bell.
2. Sign out and sign in as B on the same browser or phone.
3. Open the bell immediately, and throttle the network to Slow 3G.

**Expect:** None of A's items flash or remain. B sees an empty state or B's own items only.

**Needs:** None

**Source:** `apps/web/src/components/layout/Header.tsx`, `apps/mobile/src/context/NotificationContext.tsx`

## COMMS-039 · P1 · Push token endpoints: refuse registration, allow owner-scoped withdrawal

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Two users; MongoDB read access.

**Steps:**

1. Send POST /api/v1/notifications/push/register with a valid token and platform.
2. Check the pushtokens collection.
3. Send DELETE /push/unregister with your own token, twice.
4. Send DELETE with another user's token.
5. Send any of these without authentication.

**Expect:** Register returns 503 'Device push notifications are not available yet…' and stores nothing. Unregister returns 200 both times. The other user's token is untouched. Unauthenticated calls return 401.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/NotificationController.ts`

## COMMS-042 · P1 · Newsletter confirm link: replay, expiry and supersession

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** A pending subscription.

**Steps:**

1. Confirm, then open the same link again and submit.
2. Create a new pending request and wait 31 minutes before confirming.
3. Request twice more than 60 seconds apart, then use the older confirm link.
4. Refresh the confirm page.

**Expect:** Replayed, expired and superseded links show 'This link could not be used…'. After a refresh the page asks you to reopen the email link.

**Needs:** Resend

**Source:** `apps/api/src/application/services/NewsletterConsentService.ts`

## COMMS-043 · P1 · Settings newsletter toggle on web and mobile, sharing one record with public signup

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** Signed-in user with account email E.

**Steps:**

1. In Settings → Notifications, turn on 'Marketing emails and newsletter'. It shows 'Requested — awaiting email confirmation'.
2. Tap 'Resend newsletter confirmation' within 60 seconds, then again after 60 seconds.
3. Confirm from the email, then tap 'Refresh newsletter status'.
4. Toggle it off and check admin /newsletter.
5. Sign up with E through the public footer and check Settings.
6. Repeat the steps on mobile.

**Expect:** Status moves from Off to Requested to Subscribed to Off consistently on every surface. Only one email arrives within the cooldown. Turning it off withdraws both pending and active consent immediately. There is one shared record per email.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.ts`, `apps/web/src/components/account/NewsletterSettings.tsx`, `apps/mobile/src/components/NewsletterSettings.tsx`

## COMMS-044 · P1 · Newsletter API negatives, enumeration and normalization

*Surfaces:* api, marketing  ·  *Type:* security/permission

**Before:** N1 active.

**Steps:**

1. POST /api/v1/newsletter/subscribe with consent:false, then with consent missing.
2. POST with an invalid email.
3. POST with N1, which is already active.
4. POST with '  N1@Example.COM '.
5. POST with an extra field.

**Expect:** consent false or missing returns 400. An invalid email returns 400. The active address gets the same success message and no new email. Case and whitespace map to the same record. An extra field returns 400.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.ts`, `apps/api/src/application/use-cases/SubscribeNewsletterUseCase.ts`

## COMMS-045 · P1 · Admin newsletter list access control and export

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin, user-role and organization-role accounts.

**Steps:**

1. As admin, open /newsletter, search, and export CSV, Excel and PDF.
2. As a user and as an organization, send GET /api/v1/newsletter/subscribers.
3. Send the same request without authentication.

**Expect:** Exports contain only confirmed active subscribers and match the list. User and organization get 403; no token gets 401. Treat export files as personal data.

**Needs:** None

**Source:** `apps/admin/src/pages/NewsletterPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoNewsletterSubscriptionRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`

## COMMS-046 · P1 · Process gate: no newsletter campaign is sent without verified unsubscribe handling

*Surfaces:* admin, email  ·  *Type:* compliance

**Before:** Marketing and ops owners available.

**Steps:**

1. Confirm no bulk-sending tool is wired to the platform. The codebase has no newsletter sender.
2. If an external ESP will be used, export the list immediately before each send and send a test campaign to a seed list.
3. Verify each message has a working unsubscribe link, and that unsubscribes in the app and in the ESP are reconciled before the next send.

**Expect:** A documented procedure exists and no promotional send happens until it is verified (NEWSLETTER.md release gate).

**Needs:** External ESP, if used

**Source:** `docs/compliance/NEWSLETTER.md`

## COMMS-047 · P1 · Marketing contact form through to staff email and admin handling

*Surfaces:* admin, email, marketing  ·  *Type:* functional

**Before:** Admin account. The staff alert address (admin Settings 'Send review alerts to', or REVIEW_ALERT_EMAIL, which defaults to info@ujimora.com) is a monitored inbox. Resend configured.

**Steps:**

1. On ujimora.com/contact, choose 'Campaign support', fill in name, email, subject and a message of at least 10 characters, then click 'Send message'.
2. Read the success state.
3. Check the staff alert inbox for the new-message email, and reply to it.
4. In admin, open the bell and find 'New contact messages'.
5. Open /contact-submissions, open the row, set In progress with notes, then Resolved.
6. Filter by status and type, then export.

**Expect:** The success state reads 'Message sent' and 'Thank you for reaching out. Our team will review your message and reply by email.' It no longer makes a 24-hour promise. One staff email arrives: 'New contact message — <subject>', with From, Type and Subject lines, the message, 'Reply to this email to answer the sender directly.' and 'Triage it: https://admin.ujimora.com/contact-submissions'. Replying goes to the submitter's address. The submission holds the exact fields. The bell count rises, then falls once the item is no longer 'new', and resolvedAt is set. The submitter gets no acknowledgement email; that is an owner decision.

**Needs:** Resend

**Source:** `apps/marketing/src/pages/ContactPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ContactController.ts`, `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`, `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## COMMS-048 · P1 · Contact form validation, spam limit and stored-XSS safety

*Surfaces:* admin, api, marketing  ·  *Type:* security/permission

**Before:** None.

**Steps:**

1. Submit a 5-character message, a 1-character name and an invalid email.
2. Submit 11 valid messages within 15 minutes from one IP.
3. Submit the message '<img src=x onerror=alert(1)>', the subject '<script>alert(1)</script>' and a name starting with '=HYPERLINK(...)'.
4. Open the item in the admin dialog and in the CSV export.

**Expect:** Server validation errors display and the typed input stays in the form. The 11th submission returns 429 and the UI shows an error. The admin dialog renders the payloads as literal text with no script execution. The export neutralises formula injection.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/contactRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/admin/src/pages/ContactSubmissionsPage.tsx`

## COMMS-049 · P1 · Contact admin endpoints: permissions and failure handling

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin and user-role accounts.

**Steps:**

1. As a user, send GET /api/v1/contact, GET /contact/stats and PATCH /contact/<id>/status.
2. As admin, send PATCH /contact/notanid/status.
3. As admin, go offline and update a status with notes.

**Expect:** User requests return 403. The malformed ID returns 400. The failed update shows an error and keeps the typed notes.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/contactRoutes.ts`, `docs/BLOG_STUDIO.md`

## COMMS-050 · P1 · CMS edits (FAQ, About, Contact, Stats) appear on the marketing site without a redeploy

*Surfaces:* admin, marketing  ·  *Type:* functional

**Before:** Admin account; Cloudinary configured.

**Steps:**

1. In admin /content/faq, add a question and click Save.
2. In /content/about, edit text, upload a team photo and click Save.
3. In /content/contact, change the email, phone and social links and click Save.
4. Edit /content/stats and click Save.
5. Hard-reload ujimora.com/help, /about, /contact, the footer and the home page.

**Expect:** All changes appear on the next load. The photo loads over https from Cloudinary. Root-relative images resolve against the marketing origin.

**Needs:** Cloudinary

**Source:** `apps/admin/src/pages/content/ContentFaqPage.tsx`, `apps/admin/src/pages/content/ContentAboutPage.tsx`, `apps/admin/src/pages/content/ContentContactPage.tsx`, `apps/admin/src/pages/content/ContentStatsPage.tsx`, `apps/marketing/src/hooks/useContent.ts`

## COMMS-051 · P1 · CMS contact and social link safety

*Surfaces:* admin, marketing  ·  *Type:* security/permission

**Before:** Admin account.

**Steps:**

1. Set a social link to 'javascript:alert(1)' and another to 'http://example.com'.
2. Set the phone to '+233 20 000 0000 ext 5' and the email to '<b>x</b>@ujimora.com'.
3. View the footer and the /contact page.

**Expect:** Only http(s) social links render. The tel: href contains digits and '+' only. Text is escaped and never rendered as HTML.

**Needs:** None

**Source:** `apps/marketing/src/components/Footer.tsx`, `apps/marketing/src/pages/ContactPage.tsx`

## COMMS-052 · P1 · CMS API: permissions, shape validation and stale-save conflicts

*Surfaces:* admin, api, marketing  ·  *Type:* negative/edge

**Before:** Staging; admin and user tokens.

**Steps:**

1. As a user, send PUT /api/v1/content/faq; repeat without a token.
2. As admin, send PUT /api/v1/content/marketing.stats with {"type":"json","data":{}}, then with data {"items":null}, then with an item whose value is a number. Load ujimora.com.
3. Have two admins open /content/faq. Admin 1 saves, then admin 2 saves.
4. Send PUT for a key that does not exist yet, with an old expectedUpdatedAt.
5. Send PUT for an unknown free-form key (e.g. 'misc.test') with arbitrary JSON.
6. Restore the defaults.

**Expect:** The user request returns 403 and the unauthenticated one returns 401. Each bad marketing.stats payload returns 400 'The marketing.stats content does not have the expected shape.' with per-field errors (e.g. 'data.items'), and the stored block is unchanged, so the home page stats render normally. Admin 2's save returns 409 'This content was changed by someone else since you opened it. Reload the page to see the latest version, then reapply your edits.', admin 1's save is kept and the admin editor shows that error. A stale precondition on a missing key returns 409 and creates nothing. Unknown keys stay free-form and are accepted.

**Needs:** Staging

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/contentRoutes.ts`, `apps/api/src/application/use-cases/UpsertSiteContentUseCase.ts`, `apps/admin/src/hooks/useContentBlock.ts`, `apps/marketing/src/components/sections/StatsSection.tsx`

## COMMS-054 · P1 · Blog studio: author, review and publish an article

*Surfaces:* admin, api, marketing  ·  *Type:* functional

**Before:** Admin account; Cloudinary.

**Steps:**

1. In admin /content/blog, click 'Create article'.
2. Under Details, enter title, slug, summary, category, author and Featured.
3. Under Write, add a heading, list, table, link and inline image.
4. Under Media, upload a cover and add its description.
5. Under Review, try to publish with the review confirmation unticked, then with one field empty.
6. Complete everything and click 'Publish article'.
7. Open ujimora.com/blog and /blog/<slug>, and GET ujimora.com/api/v1/blog/sitemap.xml.

**Expect:** Publishing is blocked until everything is complete (API 422 'Complete the article details, body and accessible cover image before publishing.'). The published article renders its cover alt text, read time and author, and appears first if featured. The blog sitemap includes it and the page title and meta update.

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/blogRoutes.ts`, `apps/admin/src/pages/content/BlogEditorPage.tsx`, `apps/marketing/src/pages/BlogDetailPage.tsx`, `docs/BLOG_STUDIO.md`

## COMMS-055 · P1 · Blog: revision conflicts, draft isolation and unsaved-change guard

*Surfaces:* admin, marketing  ·  *Type:* recovery/idempotency

**Before:** A published article.

**Steps:**

1. Open the article in two tabs. Save in tab A, then save in tab B.
2. Edit the published article and save the draft only, then check the public page.
3. Click 'Publish changes'.
4. Make an edit and try to navigate away; also start an upload and try to leave.

**Expect:** Tab B gets 'This draft changed in another session. Reload before saving.' The public page is unchanged until 'Publish changes'. Navigation warns about unsaved edits and in-progress uploads.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/blogRoutes.ts`, `apps/admin/src/pages/content/BlogEditorPage.tsx`

## COMMS-057 · P1 · Blog content security (Markdown and HTML)

*Surfaces:* admin, marketing  ·  *Type:* security/permission

**Before:** Staging.

**Steps:**

1. Put these in an article body: '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[click](javascript:alert(1))', and '<iframe src=https://example.com>'.
2. Preview in admin, then publish and view on marketing.
3. Set the cover URL to http://… and save.

**Expect:** Nothing executes. Unsafe links are neutralised and raw HTML is not rendered as live markup. An http cover is rejected with 'Cover images must use HTTPS'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/blogRoutes.ts`, `packages/ui/src`, `apps/marketing/src/pages/BlogDetailPage.tsx`

## COMMS-058 · P1 · Blog API permissions and draft privacy

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A draft-only article with slug D.

**Steps:**

1. As a user, send GET /api/v1/blog/admin/posts.
2. Without auth, send POST /api/v1/blog/admin/posts/<id>/publish.
3. Send GET /api/v1/blog/D.
4. As admin, send GET /api/v1/blog/admin/posts/notanid.

**Expect:** The user request returns 403 and unauthenticated returns 401. The draft returns 404 publicly. A malformed admin ID returns 404.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/blogRoutes.ts`

## COMMS-059 · P1 · Marketing site smoke test across every route, both themes and both widths

*Surfaces:* marketing  ·  *Type:* functional

**Before:** Production marketing deploy.

**Steps:**

1. Visit /, /about, /features, /pricing, /for-organizations, /crypto, /blog, /help, /contact, /affiliates, /legal, /terms, /privacy, /organizer-agreement, /contributor-terms, /refund-policy, /acceptable-use, /cookies, /billing-terms, /delete-account and /nonexistent.
2. Do this at 390px and 1440px, in light and dark mode.
3. Click every navbar, footer and CTA link ('Create a free account', 'Get started', 'Choose <Plan>', 'Contact sales').

**Expect:** Every page renders with no horizontal scroll and no console errors. The unknown path shows the 404 page. CTAs go to https://app.ujimora.com/…, never to localhost (Navbar, Hero, CTA and Features fall back to http://localhost:8200 if VITE_WEB_APP_URL is missing at build).

**Needs:** Vercel production env

**Source:** `apps/marketing/src/App.tsx`, `apps/marketing/src/components/Navbar.tsx`, `apps/marketing/src/components/sections/HeroSection.tsx`, `apps/marketing/.env.production`

## COMMS-064 · P1 · Cookie Notice lists exactly the browser storage the sites use

*Surfaces:* marketing, web  ·  *Type:* compliance

**Before:** Fresh browser profile.

**Steps:**

1. Visit ujimora.com and app.ujimora.com, register, and follow a '?ref=' affiliate link.
2. Start and abandon a Paystack donation, a creator tip and a wallet top-up, then change colour mode and skin.
3. In DevTools → Application, review Cookies, Local Storage and Session Storage. In the Network panel, review third-party requests.
4. Compare the findings with /cookies section 2 'What we use' and sections 3–5, and with Privacy section 10.

**Expect:** Ujimora sets no cookies. Every storage key found is listed in /cookies s.2 'What we use': sign-in (uf_tokens, uf_user, accessToken, uf_last_activity, removed on sign-out or after an hour of inactivity), display preferences (uf_color_mode, uf_skin), payment recovery (uf_pending_donations, uf_pending_subscriptions, ujimora:tip-attempt:* and session-only top-up references) and referral attribution (uf_ref, kept until you create an account or clear site data). There are no analytics, advertising or third-party tracking requests; only CDN image and font requests. The notice explains clearing site data and promises consent before any future analytics. Privacy s.10 says web properties do not currently use cookies, analytics or advertising technologies. No consent banner is needed while that is true. Any storage key missing from the notice is a defect.

**Needs:** None

**Source:** `packages/types/src/legal.ts`, `apps/marketing/__tests__/legalClaims.test.ts`, `apps/web/src`, `apps/marketing/index.html`

## COMMS-065 · P1 · robots.txt, sitemaps and noindex headers on all hosts

*Surfaces:* api, marketing, web  ·  *Type:* functional

**Before:** Production domains live; the web Vercel project deployed with the updated apps/web/vercel.json.

**Steps:**

1. Run curl -i on ujimora.com/robots.txt, ujimora.com/sitemap.xml, ujimora.com/api/v1/blog/sitemap.xml, app.ujimora.com/robots.txt, app.ujimora.com/sitemap.xml, api.ujimora.com/robots.txt and api.ujimora.com/sitemap.xml.
2. Run curl -I https://api.ujimora.com/api/v1/campaigns.
3. Submit the sitemaps in Google Search Console.

**Expect:** Every sitemap returns application/xml. app.ujimora.com/sitemap.xml returns the API's XML, because apps/web/vercel.json now rewrites /sitemap.xml to https://api.ujimora.com/sitemap.xml ahead of the SPA catch-all. It never returns SPA HTML. app.ujimora.com/robots.txt ends with 'Sitemap: https://app.ujimora.com/sitemap.xml' and still allows /creators/:handle. API JSON carries X-Robots-Tag noindex, while robots.txt and sitemap.xml do not. The static marketing sitemap lists only existing routes. Search Console reports no errors.

**Needs:** Vercel; Google Search Console

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `apps/web/vercel.json`, `vercel.json`, `apps/web/public/robots.txt`, `apps/marketing/public/robots.txt`, `apps/api/src/app.ts`

## COMMS-066 · P1 · App sitemap lists only open public campaigns and visible creators

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Staging data: campaigns in draft, pending_review, active, funded, active but past their end date (before the 5-minute expiry sweep), expired, blocked and deleted states. Creator profiles for a deleted (tombstoned) account, a publishing-restricted user, a user without a paid plan and a normal visible creator.

**Steps:**

1. Fetch https://<staging-api>/sitemap.xml.
2. Open every listed URL while logged out.
3. Wait for the expiry sweep, then fetch again.

**Expect:** Only active and funded campaigns whose end date is still in the future are listed. An ended campaign drops out at once, even before the sweep relabels it 'expired'. Draft, pending_review, expired, blocked and deleted campaigns are absent. Creators whose public page returns 404 (deleted/tombstoned or content-restricted accounts) are absent. A creator without a paid plan is still listed, because the page renders with tips off. Every listed URL shows content when logged out: no soft 404s and no restricted handles.

**Needs:** Staging

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `docs/compliance/CAMPAIGN_VISIBILITY.md`

## COMMS-068 · P1 · Social link previews for campaign, blog and pricing URLs

*Surfaces:* marketing, web  ·  *Type:* cross-platform

**Before:** Facebook Sharing Debugger, LinkedIn Post Inspector, WhatsApp, X. One public campaign with an https cover image, one without a cover, and one pending_review campaign.

**Steps:**

1. Share app.ujimora.com/c/<slug>, app.ujimora.com/c/<slug>/donate and app.ujimora.com/campaigns/<id> on each platform (use 'Scrape again' in the debugger).
2. Share the pending_review campaign's /c/<slug>.
3. Share ujimora.com/blog/<slug> and ujimora.com/pricing.
4. Record the title, description and image shown.

**Expect:** Public campaign links show that campaign's card. The title is '<campaign title> | Ujimora'. The description is the story or social summary (clipped with … at 155 characters, or followed by 'Donate by mobile money or card on Ujimora.' when shorter than 100 characters). The image is the https cover image, and the static Ujimora image is kept when there is no https cover. The pending_review campaign shows only the generic Ujimora card and never leaks its title. Marketing blog and pricing links still show the static index.html card, because marketing blog previews were outside the I079 fix (owner decision). Every image loads and no card is broken.

**Needs:** Social debug tools; Vercel Routing Middleware deployed

**Source:** `apps/web/middleware.ts`, `apps/web/src/lib/shareMeta.ts`, `packages/ui/src/seo.ts`, `apps/marketing/index.html`, `apps/web/index.html`

## COMMS-069 · P1 · Marketing site survives an API outage

*Surfaces:* marketing  ·  *Type:* recovery/idempotency

**Before:** DevTools request blocking.

**Steps:**

1. Block /api/v1/*.
2. Load home, about, help, contact, the footer, pricing, blog and a blog detail page.
3. Submit the newsletter form and the contact form.

**Expect:** CMS sections fall back to default content. Pricing and blog show errors with Retry. The newsletter shows 'Could not request a subscription'. The contact form shows an error snackbar. There is never a blank screen.

**Needs:** None

**Source:** `apps/marketing/src/hooks/useContent.ts`, `apps/marketing/src/hooks/useBlog.ts`, `apps/marketing/src/pages/PricingPage.tsx`

## COMMS-070 · P1 · Create dynamic QR codes on web and mobile

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Campaign owner with an active campaign, a creator page set up at /creator (needed for the Creator kind), and an active live session on this campaign (LiveKit configured for the Live kind).

**Steps:**

1. On web, open /campaigns/:id/live → 'Dynamic QR codes' and create Campaign, Live, Preset amount (50) and Creator codes.
2. Copy a short link and download a PNG.
3. On mobile, open Manage campaign → QR codes and create each kind.
4. Refresh the lists.
5. With an owner who has no creator page, try to create a Creator code.

**Expect:** Codes are 7 characters from the unambiguous alphabet. The short URL is https://api.ujimora.com/r/<code>. PNGs download and preview. Lists show scan counts and persist. The Live code is tied to this campaign's current broadcast. Without a creator page, the Creator option is refused with 'Set up your creator page before creating a creator QR code.' (422), and the error is shown in the UI.

**Needs:** LiveKit (for live kind)

**Source:** `apps/web/src/components/live/QrCodeManager.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/utils/shortCode.ts`

## COMMS-071 · P1 · Short-link redirect, UTM forwarding, human-only scan counting and QR images

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Codes from COMMS-070.

**Steps:**

1. Run curl -i 'https://api.ujimora.com/r/<code>?utm_source=flyer&utm_campaign=x&foo=bar'.
2. Run curl -I (HEAD) on the same URL, then curl -i -A 'WhatsApp/2.23.20' and curl -i -A 'facebookexternalhit/1.1' on it.
3. Scan the printed code with a phone camera.
4. Check the scan count in the list, and the live session's scans stat for the live code.
5. Fetch /qr/<code>.svg and /qr/<code>.png with curl -i.

**Expect:** Every request, including HEAD and bot user agents, gets a 302 to the correct target with utm_source and utm_campaign appended and foo dropped. The headers include Cache-Control: no-store and X-Short-Url. Only the curl GET and the phone scan add to scanCount (and to the live session's scans). HEAD requests and link-preview or crawler user agents are not counted. The QR images return Cache-Control: public, max-age=86400, immutable plus X-Short-Url, and they encode the short URL.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoShortLinkRepository.ts`

## COMMS-072 · P1 · Creator QR code lands on the creator's public page

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** An organiser with a creator page (handle H) and a Creator-kind code. Staging MongoDB write access for the legacy check.

**Steps:**

1. Scan the code, or run curl -i https://api.ujimora.com/r/<code>, and note the Location and final page.
2. Change the creator handle to H2 and scan the same code again.
3. In staging, set a creator short link's stored target to the legacy form <PUBLIC_WEB_URL>/u/<creatorUserId> and scan it.
4. In the native app, open the deep link https://app.ujimora.com/u/<creatorUserId>.
5. As an organiser without a creator page, try to create a Creator code.

**Expect:** The code redirects to https://app.ujimora.com/creators/H and shows the creator's public page. After the handle change it goes to /creators/H2, because the destination is rebuilt at scan time. The legacy /u/ code also lands on the creator page, so already-printed codes are repaired without a migration. In the app, /u/<id> opens the member profile (/profile/<id>) rather than Not Found. Creating a Creator code without a creator page returns 422 'Set up your creator page before creating a creator QR code.'

**Needs:** None

**Source:** `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/mobile/src/navigation/resolvePath.ts`

## COMMS-074 · P1 · QR code permissions and input validation

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Owner A, non-owner B, admin.

**Steps:**

1. As B, send POST and GET /api/v1/campaigns/<A's id>/qr-codes.
2. Send them without auth.
3. As admin, send POST.
4. As A, send presetAmount 0, -5 and 'abc'; a 200-character label; and kind 'x'.
5. Request /r/unknown, /r/<CODE in uppercase> and /qr/unknown.png.

**Expect:** B gets 403 and no auth gets 401. Admin gets 201. Invalid inputs return 400. Unknown or uppercased codes return a 404 JSON response.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ListCampaignQrCodesUseCase.ts`

## COMMS-075 · P1 · Short links cannot redirect off-site or attribute scans to another campaign's session

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Campaign A with an active live session S1; a live session S2 on another campaign; one ended session on campaign A.

**Steps:**

1. Create an event code with label 'https://evil.example' and follow it.
2. Create a live code with liveSessionId '../../x', then one with S2's ID, then one with campaign A's ended session.
3. Create a live code with S1's ID and scan it; check S1's and S2's scans stats.
4. Create a campaign-kind code and pass a liveSessionId; inspect the stored link.

**Expect:** Redirects always stay on app.ujimora.com/c/<own slug>…, with the label only as an encoded ?ref value. Malformed, other-campaign and ended session IDs are refused with 400 'A live QR code can only point to this campaign’s current broadcast'. Only the S1 code is created, and scanning it increments S1 only, never S2. Non-live kinds drop the liveSessionId and store no session.

**Needs:** LiveKit

**Source:** `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`

## COMMS-076 · P1 · Printed QR codes keep working after the campaign changes

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Printed campaign and preset-amount codes for a campaign with custom slug S1; a second campaign owned by another user.

**Steps:**

1. The owner changes the campaign's custom slug from S1 to S2. Scan both old codes.
2. Open https://app.ujimora.com/c/S1?utm_source=x in a browser and watch the address bar.
3. As the other campaign's owner, try to set that campaign's slug to S1.
4. As the first owner, change the slug back to S1.
5. Let the campaign pass its end date, wait up to 5 minutes for the expiry sweep, and scan. Repeat with a funded campaign.
6. An admin blocks, then deletes, the campaign; scan each time.

**Expect:** After the slug change, both codes redirect to /c/S2… and the amount code keeps its preset, because the destination is rebuilt from the current slug on every scan. /c/S1 still resolves, and the address bar is replaced with /c/S2?utm_source=x. S1 stays reserved: the other owner gets 409 'That slug is already taken', while the original owner can revert to it. An ended campaign is relabelled 'expired' by the sweep; its code still shows the campaign page with 'Donations closed', and funded campaigns show their page. Blocked or deleted campaigns show 'Campaign not found' with 'This fundraiser link may have expired, been removed, or been mistyped.' and an 'Explore campaigns' button, never an error page.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`

## COMMS-077 · P1 · Staff alert email when a campaign awaits review

*Surfaces:* admin, email, web  ·  *Type:* functional

**Before:** Admin; organizer with KYC able to create a campaign above the auto-approve tier.

**Steps:**

1. In admin /settings → campaign review settings, set 'Send review alerts to' to reviewer@…; try 'bad@' (Save must be disabled).
2. Create a campaign with a goal above the tier threshold.
3. Check the reviewer's inbox and open the link.
4. Clear the address, save, and create another held campaign.

**Expect:** Exactly one email per campaign: 'Campaign awaiting review — <title> (GHS <goal>)', linking to https://admin.ujimora.com/campaigns/<id>. A blank address disables alerts and shows a warning. Campaign creation succeeds even if the email fails.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`, `apps/admin/src/components/CampaignReviewSettings.tsx`, `apps/api/src/application/services/CommercialConfigService.ts`

## COMMS-078 · P1 · Admin action centre in the bell

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Create one each of: contact message, pending KYC, pending campaign, payout request, safety report, supporter campaign report, donor refund request and (in staging) an activity email parked in 'review'.

**Steps:**

1. Open the admin bell and read each count.
2. Click each item.
3. As a non-admin, send GET /api/v1/admin/action-center.

**Expect:** Counts are accurate. Items route to /contact-submissions ('New contact messages'), /kyc-review ('Identity checks'), /campaigns ('Campaigns awaiting review'), /payouts ('Campaign payouts'), /safety-reports ('Community safety reports'), /campaign-reports ('Campaign reports from supporters'), /refund-requests ('Donor refund requests') and /activity-email-review ('Activity emails needing a delivery check'). The badge equals unread notifications plus pending actions. Viewing an item does not resolve the work; each count falls only when the item is reviewed on its page. The non-admin request returns 403.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/admin/src/components/layout/TopBar.tsx`, `apps/admin/src/router.tsx`

## COMMS-080 · P1 · Organization website-contact request is opt-in and can be withdrawn

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** Organization signup.

**Steps:**

1. On web /register as an organization, confirm the website-request checkbox is unchecked by default.
2. Register with it checked and confirm the 'Your website request is saved' notice (Neurodyne Corp Ltd).
3. Click withdraw and reload.
4. Repeat the signup on mobile.

**Expect:** The request is an explicit opt-in. Withdrawal shows success and stays withdrawn after reload. A stale profile save cannot restore it (READINESS C05).

**Needs:** None

**Source:** `apps/web/src/components/auth/WebsiteRequestNotice.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `docs/compliance/READINESS.md`

## COMMS-N001 · P1 · Staff decision notices: campaign review outcomes reach the organizer's inbox

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Organizer O with every activity alert switched off, and three campaigns in pending_review. Admin account. O signed in on web and mobile.

**Steps:**

1. As admin, open C1 in admin /campaigns, tick both review checkboxes, enter 'Decision notes (at least 20 characters)' containing a unique marker such as INTERNAL-NOTE-123, and click 'Approve campaign'.
2. As O on web, open the bell and the Dashboard notifications and click View details.
3. As admin, click 'Reject campaign' on C2, then 'Block campaign' on the approved C1, then 'Return to review' on the blocked C1, each with notes.
4. As O on mobile, open the bell modal and tap View details on each notice.
5. Replay the approve request (double-click, or resend the same PUT /campaigns/:id/review) and count the notices.
6. Check O's email inbox.

**Expect:** One inbox notice per decision, even with every activity alert off. 'Your campaign is live' says '“<title>” passed review and is now public.' and links to /campaigns/<id>. 'Your campaign was not approved' says '“<title>” did not pass review and is not public. For details or to ask for another review, contact support@ujimora.com.' and links to /my-campaigns. 'Your campaign has been blocked' says '“<title>” was removed from public view after a review. For details or to appeal, contact support@ujimora.com.' 'Your campaign is back in review' says '“<title>” has returned to the review queue. We will let you know the outcome.' The staff decision notes (INTERNAL-NOTE-123) never appear. A replayed decision adds no second notice and does not reset read state. A decision that fails and rolls back writes no notice. No email is sent. On native, View details opens campaign detail or My campaigns, never Not Found.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `packages/types/src/legal.ts`

## COMMS-N002 · P1 · Staff decision notices: KYC/KYB approve, reject and request-more-information

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Three users with pending identity verification and one organization with pending business verification. Admin with verifications permission.

**Steps:**

1. In admin /kyc-review, approve user U1 and the organization.
2. Reject U2 with the applicant-facing reason 'Document photo is blurred, please re-upload'.
3. Use 'Request more information' for U3.
4. Each user opens the web bell and the mobile bell, then View details.
5. Repeat one decision request and count the notices.

**Expect:** U1 sees 'Your identity verification is approved' / 'Our review team approved your identity verification.' The organization sees 'Your organization verification is approved'. U2 sees 'Your identity verification was not approved', with the body 'Reason: Document photo is blurred, please re-upload' and then 'You can review the details and submit again from your verification page.' U3 sees 'More information needed for your verification' / 'Our review team needs more information to finish reviewing your identity verification. Open your verification page to read the request and reply.' Every notice links to /kyc (the web KYC page and the native kyc screen). There is exactly one notice per decision, none if the transaction rolls back, and no email.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`, `apps/admin/src/pages/KYCReviewPage.tsx`

## COMMS-N003 · P1 · Report outcome notices: neutral acknowledgement to reporters, action notice to authors

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Reporter R and author A. R has reported A's comment, A's campaign update, a donation message from A and a second comment by A (safety reports), and has used 'Report campaign' on A's campaign (campaign report). Admin account.

**Steps:**

1. In admin /safety-reports, Dismiss one report, 'hide_comment' the comment report, 'hide_message' the donation-message report and 'restrict_user' on the other comment report, each with notes.
2. In admin /campaign-reports, enter a review note of at least 20 characters and click Mark reviewed.
3. R and A check their bells on web and mobile.
4. As R, report R's own comment and have it actioned.

**Expect:** For every reviewed safety report, dismissals included, R gets 'We reviewed your report' / 'Thank you for your report. Our team has reviewed it and taken the action it considers appropriate.', with no outcome detail and no staff notes. For the campaign report, R gets 'We reviewed your report' / 'Thank you for reporting this campaign. Our team has reviewed it and taken the action it considers appropriate.' with a link to /campaigns/<id>. A is notified only when content was actioned: 'Your comment was removed', 'Your message was hidden' (which says the payment itself is not affected), 'Your campaign update was removed', 'Your live broadcast was stopped' or 'Publishing is restricted on your account'. Each ends 'For details or to appeal, contact support@ujimora.com.' A gets nothing for a dismissed report and never learns who reported. A self-report produces no separate author notice.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/admin/src/pages/CampaignReportsPage.tsx`

## COMMS-N004 · P1 · Email-verification prompts on web Dashboard, Payout accounts and native Dashboard

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Email delivery configured. A freshly registered, unverified user; a verified user. A staging environment with email delivery unconfigured.

**Steps:**

1. As the unverified user, open web /dashboard and /payout-accounts.
2. Click 'Send link' on the Dashboard notice, then click it again within 60 seconds.
3. Verify the email via the link, then reload both pages.
4. In the mobile app, open Dashboard as an unverified user and tap 'Send verification link'.
5. As the verified user, open the same screens.
6. In the unconfigured staging environment, register a new account and open the Dashboard.

**Expect:** Web Dashboard shows the info notice 'Verify your email address. Automatic payouts and organization invitations need a verified email address.' with a 'Send link' button. Payout accounts shows 'Verify your email address. Automatic payouts need a verified email; until then each payout waits for manual review.' Sending shows 'Check your email for a verification link. Allow a minute before requesting another.', and the second click inside the cooldown sends no second email. The native Dashboard shows 'Verify your email address. Automatic payouts and organization invitations need a verified email.' with 'Send verification link'. Notices disappear once verified and never show to verified users. When email is unconfigured, signup still succeeds and no notice is shown. An automatic payout for an unverified owner gives the reason 'Verify your email address to enable automatic payouts.'

**Needs:** Resend

**Source:** `apps/web/src/components/account/EmailVerificationNotice.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/PayoutAccountsPage.tsx`, `apps/mobile/src/components/EmailVerificationNotice.tsx`, `apps/mobile/src/lib/emailVerification.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`

## COMMS-N005 · P1 · Web login 'Forgot password?' link carries the typed email

*Surfaces:* web  ·  *Type:* functional

**Before:** Logged-out browser.

**Steps:**

1. Open app.ujimora.com/login and type '  someone@example.com ' in the email field.
2. Click 'Forgot password?' under the password field.
3. Check the address bar and the email field on /forgot-password.
4. Go back, clear the email field and click the link again.
5. Using the keyboard only, Tab to the link and press Enter.

**Expect:** The link opens /forgot-password with the email field prefilled as 'someone@example.com' (trimmed). The address is only passed in router state, so the URL contains no email or query string. With an empty email field the page opens blank. The link is reachable and activatable by keyboard. The request still returns the same public response for registered and unregistered emails.

**Needs:** None

**Source:** `apps/web/src/components/auth/LoginForm.tsx`, `apps/web/src/pages/ForgotPasswordPage.tsx`

## COMMS-N006 · P1 · Forgot-password error messages are actionable (web and mobile)

*Surfaces:* android, ios, web  ·  *Type:* negative/edge

**Before:** One client IP near the auth limit; a staging environment with email delivery unconfigured.

**Steps:**

1. Exhaust the 30-request auth bucket (login and forgot-password attempts) from one client, then submit forgot-password on web and mobile.
2. Submit a malformed address that passes the browser check but fails the API (e.g. send 'a@b' through DevTools or edit the request).
3. Go offline (DevTools Offline, airplane mode) and submit.
4. In staging with email unconfigured (503), submit.

**Expect:** 429 shows 'Too many attempts. Please wait about 15 minutes and try again.' 400 shows 'Enter a valid email address.' No connection (web TypeError, mobile status 0) shows "Can't reach Ujimora. Check your connection and try again." A 503 or any other failure shows 'Password recovery is temporarily unavailable. Please try again later.' No error ever shows the 'Check your email' or 'Request received' success state, and responses still do not reveal whether an account exists.

**Needs:** Staging

**Source:** `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/mobile/src/lib/authMessages.ts`, `apps/mobile/app/forgot-password.tsx`, `apps/mobile/src/lib/api.ts`

## COMMS-N007 · P1 · Production startup log names disabled email and MFA capabilities

*Surfaces:* api  ·  *Type:* compliance

**Before:** Staging API with NODE_ENV=production and access to logs.

**Steps:**

1. Remove AUTH_EMAIL_ENCRYPTION_KEY_BASE64 (or set a 16-byte key) and MFA_ENCRYPTION_KEY, leave STORE_BILLING_ENABLED unset, and deploy.
2. Read the startup logs.
3. Check that the API still boots and a test donation still works.
4. Call POST /api/v1/auth/forgot-password.
5. Restore both keys, redeploy and read the logs again.

**Expect:** One error line, 'Production capabilities disabled by missing configuration', lists 'account email (password reset, email verification, newsletter confirmation, password-changed notices): needs RESEND_API_KEY, FROM_EMAIL, AUTH_EMAIL_ENCRYPTION_KEY_BASE64 (32 bytes, base64) and an https PUBLIC_WEB_URL' and 'authenticator MFA enrollment: needs MFA_ENCRYPTION_KEY (32 bytes, standard base64)'. It never includes any value. A warning, 'Optional production capabilities are off', mentions native store billing. The API keeps serving and donations work, but forgot-password returns 503. After restoring the keys, the error line is gone.

**Needs:** Staging; Render

**Source:** `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/app.ts`, `render.yaml`, `DEPLOYMENT.md`

## COMMS-N008 · P1 · Staff email for each new contact-form message

*Surfaces:* admin, api, email, marketing  ·  *Type:* functional

**Before:** Resend configured. The admin Settings 'Send review alerts to' address (or REVIEW_ALERT_EMAIL) points at a monitored test inbox.

**Steps:**

1. Submit the ujimora.com/contact form with subject 'Line1\nBcc: x@evil.test' (use curl or DevTools to include a newline) and a name containing a newline.
2. Open the staff email and inspect the headers, subject and body.
3. Reply to the email.
4. Replay the same stored submission id (retry) and count the emails.
5. Clear the 'Send review alerts to' address, save, and submit another message.
6. In staging, set an invalid RESEND_API_KEY and submit another message.

**Expect:** One email per submission. Its subject is 'New contact message — <subject>', flattened to one line and capped at 150 characters, and no injected header takes effect. The body lists From: name <email>, Type and Subject, then the message, 'Reply to this email to answer the sender directly.' and 'Triage it: https://admin.ujimora.com/contact-submissions'. Reply-To is the submitter's email. The Resend idempotency key is contact-staff/<id>, so a retry sends no duplicate. With a blank recipient, no email is sent (this also turns off campaign-review alerts) but the submission is stored and the form returns 201. A Resend failure is only logged, and the submitter still sees 'Message sent'.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ContactController.ts`, `apps/admin/src/components/CampaignReviewSettings.tsx`

## COMMS-N009 · P1 · Admin 'Activity email checks' page resolves parked activity emails

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Staging with at least two activity email deliveries in 'review' (see COMMS-031). An admin account and a non-admin account.

**Steps:**

1. In admin, open Platform → 'Activity email checks' (/activity-email-review).
2. Inspect one item and the GET /api/v1/admin/activity-deliveries response.
3. Type a note under 20 characters and try the buttons.
4. Enter a note of at least 20 characters and click 'Mark delivered'.
5. On the second item, enter a note and click 'Give up on this email'.
6. Replay the PATCH for the already-resolved item.
7. As a non-admin, and then without a token, call GET /api/v1/admin/activity-deliveries.
8. Check the bell count and the audit log.

**Expect:** The header reads 'Activity email checks' with a 'Waiting for a check' count. An info alert explains how to check the provider log by idempotency key and that the page cannot re-send. Each item shows its title, category, idempotency key 'activity/<id>', attempts and first attempt, and never the recipient address or email body (the API response also omits them and is private, no-store). The buttons stay disabled until the note ('What the provider log shows (at least 20 characters)') has at least 20 characters. The results are 'Marked delivered.' (status delivered) and 'Email given up. It will not be sent.' (status suppressed). A replay returns 409 'This email is no longer waiting for a delivery check. Refresh the list.' Non-admin gets 403 and no token gets 401. The bell item 'Activity emails needing a delivery check' decreases. Audit rows activity_email.delivered and activity_email.suppress store the note. When nothing is parked, the page shows 'No activity emails need a check.'

**Needs:** Staging; MongoDB

**Source:** `apps/admin/src/pages/ActivityEmailReviewPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActivityDeliveryRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## COMMS-N010 · P1 · Marketing site ignores malformed CMS content and contains page crashes

*Surfaces:* marketing  ·  *Type:* recovery/idempotency

**Before:** Chrome DevTools with Local Overrides (response override) enabled.

**Steps:**

1. Override the GET /api/v1/content/marketing.stats response so the block's data is {} and load ujimora.com.
2. Override /content/faq so items is a string, and load /help.
3. Override /content/contact so socials is an array, and view /contact and the footer.
4. Force a render error on one page (e.g. override /content/about with team entries whose fields are objects) and load /about.
5. Click a navbar link to another page.

**Expect:** The shape guards reject each bad payload, and the Stats section, FAQ, contact details and footer socials fall back to their built-in defaults with no blank screen. If a page still throws while rendering, only the page area shows 'This page could not be displayed' / 'Something went wrong while loading it. Please try again.' with a 'Reload page' button. The navbar and footer stay usable, and navigating to another route clears the error.

**Needs:** None

**Source:** `apps/marketing/src/lib/contentShapes.ts`, `apps/marketing/src/hooks/useContent.ts`, `apps/marketing/src/components/PageErrorBoundary.tsx`, `apps/marketing/src/App.tsx`

## COMMS-N011 · P1 · Per-campaign share tags for link-preview bots only (Vercel middleware)

*Surfaces:* web  ·  *Type:* functional

**Before:** Production or preview deploy of apps/web with middleware.ts. One public campaign whose title contains quotes, '<', '&' and an emoji, with an https cover. One public campaign without a cover. One pending_review campaign.

**Steps:**

1. Run curl -s -A 'facebookexternalhit/1.1' https://app.ujimora.com/c/<slug> | grep -E '<title|og:|twitter:|canonical'.
2. Repeat with -A 'WhatsApp/2.23.20' for /c/<slug>/donate and /campaigns/<id>.
3. Repeat with a normal Chrome user agent and with a Googlebot user agent.
4. Repeat the bot request for the no-cover campaign, the pending_review campaign, /campaigns/new and /c/<slug>/live.
5. Inspect the bot response headers with curl -I -A 'facebookexternalhit/1.1'.

**Expect:** Bot requests get index.html with exactly one of each tag. og:title and twitter:title are '<title> | Ujimora', correctly HTML-escaped with the emoji intact. og:description is the story, clipped at 155 characters. og:image is the https cover, and og:url and canonical are https://app.ujimora.com/c/<slug>. The headers include Cache-Control 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' and Vary: user-agent. Browser and Googlebot requests get the unmodified SPA. The no-cover campaign keeps the static image. The pending_review campaign, /campaigns/new and /c/<slug>/live return the static generic card. If the API does not answer within 1.5 s, bots get the static card and the page is never blocked.

**Needs:** Vercel deploy

**Source:** `apps/web/middleware.ts`, `apps/web/src/lib/shareMeta.ts`, `apps/web/__tests__/shareMeta.test.ts`

## COMMS-N013 · P1 · Rejected and cancelled payout requests alert as 'rejected'/'cancelled', not 'failed'

*Surfaces:* admin, email, web  ·  *Type:* functional

**Before:** Campaign owner with 'Withdrawals and payouts' in-app and email on and two PENDING payout requests (P1, P2). Admin account.

**Steps:**

1. In admin /payouts, open 'Reject request' on P1 and try a reason under 20 characters, then enter a longer reason and confirm.
2. As the owner, open the web payout history, click 'Cancel request' on P2 and confirm 'Cancel this request? The amount returns to your balance.'
3. Check the owner's bell and email for each.
4. Check the payout history labels and the campaign's pending balance.
5. Try to cancel a payout that is already PROCESSING.

**Expect:** Reject stays disabled until the reason has at least 20 characters. The owner gets 'Your withdrawal is rejected' / 'The GHS X request is rejected. Open your payout history for fees, net amount and the latest status.', and 'Your withdrawal is cancelled' for P2, never 'failed'. There is one alert each. No transfer is sent, and the cleared amount returns to the campaign's pending balance. The payout history shows Rejected (with the staff reason) and Cancelled. The reason appears only in the history, not in the alert. A PROCESSING payout cannot be cancelled.

**Needs:** Paystack test keys; Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`

## COMMS-N014 · P1 · Organization team invitation creates an in-app notice for existing accounts

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Organization owner. Existing user E (activity alerts off, email unverified). An email address with no account.

**Steps:**

1. As the org owner on web /organization-team, invite E as member, then invite the unregistered address.
2. Compare the two API responses and the UI messages.
3. As E on web, open the bell and click View details.
4. As E in the mobile app, open the bell and tap View details, then open Profile → Invitations.
5. Try Accept while E's email is unverified, then verify and Accept.

**Expect:** Both invites return the identical message 'Invitation ready. Ask the recipient to sign in with this email and open Organization workspace & team. Invitations expire after seven days.' This does not reveal which address has an account. E gets one notice, 'Organization invitation' / '<Org> invited you to its team as member. Accept it in Organization workspace & team within seven days.', which opens /organization-team on web. The unregistered address receives nothing. The native Invitations screen lists the open organization invitation with Accept; the API refuses Accept until the email is verified. Owners and admins see a link to manage the team on the website. The native View details must not land on Not Found. resolveNativePath has no /organization-team mapping and the app has no such route, so log a defect if it does. Known open issue I181: no invitation email is sent.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/mobile/app/invitations.tsx`, `apps/mobile/src/navigation/resolvePath.ts`

## COMMS-N015 · P1 · Privacy-request response email says a response is ready without including it

*Surfaces:* admin, email, web  ·  *Type:* compliance

**Before:** User U with two open data-rights requests (Settings → 'Your data and privacy requests'). Admin account. Email configured.

**Steps:**

1. In admin /privacy-requests, respond to request 1 with delivery method 'account'.
2. Check U's inbox and open the link.
3. Respond to request 2 with delivery method 'verified_external' and a delivery reference.
4. For a closed (deleted) account's request, try responding with account delivery.

**Expect:** One email arrives: 'Your Ujimora privacy request has a response'. It reads 'We have responded to your privacy request (reference <id>).', says the response is not included for security, and tells U to sign in and open Settings, then 'Your data and privacy requests'. It links to https://app.ujimora.com/settings and ends 'If you did not make this request, contact support@ujimora.com.' The email contains none of the response content. External delivery sends no email. A closed account returns 409 'This account is closed. Record review progress and arrange verified communication through the privacy team.' The job expires after 24 hours if it cannot be delivered.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `docs/compliance/DATA_RIGHTS.md`

## COMMS-036 · P2 · Bell error recovery and large inbox performance (bounded list)

*Surfaces:* android, ios, web  ·  *Type:* negative/edge

**Before:** Staging user seeded with 300 notifications.

**Steps:**

1. In DevTools, block https://api.ujimora.com/api/v1/notifications* (the web app now calls api.ujimora.com directly) and observe the badge and popover.
2. Unblock and click Retry.
3. As the 300-item user, open the bell and the Dashboard on web and on a low-end Android phone. Time GET /api/v1/notifications.
4. Leave the tab hidden and confirm polling pauses.

**Expect:** While blocked, the badge shows '!' with 'Notifications could not be loaded. Please retry.', and it recovers after Retry. GET /notifications returns only the newest 50 items (newest first), so it and the UI respond within about 2 seconds however large the inbox is, with no jank. There is no 'load older' control in the web or mobile UI. Notifications older than the newest 50 can only be reached through the API's ?before= cursor, so record that for launch acceptance.

**Needs:** Staging seed data

**Source:** `packages/ui/src/components/NotificationBell.tsx`, `apps/api/src/application/use-cases/GetMyNotificationsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/pagination.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoNotificationRepository.ts`

## COMMS-053 · P2 · Testimonials management and public display

*Surfaces:* admin, api, marketing  ·  *Type:* functional

**Before:** Admin account.

**Steps:**

1. In admin /testimonials, create a draft, publish it, reorder it with displayOrder, then archive it.
2. Try rating 6 and avatarColor 'red'.
3. As a user, send POST /api/v1/testimonials.
4. View the landing page Testimonials section.

**Expect:** Only published items show, in displayOrder. Invalid values return 400. The user request returns 403.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/testimonialRoutes.ts`, `apps/marketing/src/components/sections/TestimonialsSection.tsx`, `apps/admin/src/pages/TestimonialsPage.tsx`

## COMMS-056 · P2 · Blog: unpublish, slug collisions and slug changes

*Surfaces:* admin, api, marketing  ·  *Type:* negative/edge

**Before:** Two articles.

**Steps:**

1. Unpublish article 1. Visit its URL and check the blog sitemap.
2. Publish article 2 using article 1's old slug, then try another article with a slug that is currently published.
3. Change a published article's slug and republish it; visit the old URL.

**Expect:** An unpublished article shows 'not found' with noindex, leaves the sitemap and keeps its draft. A duplicate published slug returns 409 'That article URL is already published. Choose another slug.' The old URL returns not-found with no redirect; decide whether that is acceptable.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/blogRoutes.ts`, `apps/marketing/src/pages/BlogDetailPage.tsx`

## COMMS-067 · P2 · Per-route SEO heads, noindex on private pages, favicons and manifest

*Surfaces:* marketing, web  ·  *Type:* functional

**Before:** None.

**Steps:**

1. Navigate between marketing pages and inspect <title>, meta description, canonical, og:url and JSON-LD.
2. Check /verify-email, /reset-password, /newsletter/confirm, an unknown blog slug and the 404 page for robots noindex.
3. Load /favicon.ico, /site.webmanifest and /og-image.png (1200×630) on both sites.

**Expect:** Each route has its own head and no duplicate canonicals. Private and 404 pages are noindex. All assets return 200.

**Needs:** None

**Source:** `packages/ui/src/seo.ts`, `apps/marketing/src/lib/seo.ts`, `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/marketing/src/pages/NotFoundPage.tsx`

## COMMS-081 · P2 · Rate limits on public messaging endpoints are per client

*Surfaces:* android, api, ios, marketing, web  ·  *Type:* negative/edge

**Before:** Two clients on different networks (e.g. laptop on office Wi-Fi and a phone on mobile data).

**Steps:**

1. From client 1, send 31 forgot-password requests within 15 minutes (login, register, reset and email-verification share this 'auth' bucket).
2. From client 1, send 21 newsletter subscribe requests and 11 contact submissions.
3. Read the UI messages and the response headers.
4. While client 1 is limited, repeat one forgot-password request from client 2.
5. From client 1, add forged X-Forwarded-For, X-Real-IP, X-Vercel-Forwarded-For or True-Client-IP headers (curl) and retry.

**Expect:** Once each limit is passed the API returns 429 with Retry-After (auth 30, newsletter 20, contact 10 per 15 minutes). Web and mobile forgot-password show 'Too many attempts. Please wait about 15 minutes and try again.', and the newsletter and contact UIs show their generic errors. Client 2 is not affected, because buckets are keyed on the real client IP (CF-Connecting-IP, with IPv6 folded to /64). Forged forwarding headers do not reset or move the bucket. Known open issue I099: limits are in memory per API instance, so keep a single Render instance (render.yaml, DEPLOYMENT.md).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/mobile/src/lib/authMessages.ts`, `render.yaml`

## COMMS-N012 · P2 · Notification list API is bounded and pages with a cursor

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Staging user with 120 notifications.

**Steps:**

1. Send GET /api/v1/notifications.
2. Send ?limit=100, then ?limit=101 and ?limit=0.
3. Send ?before=<createdAt of the last item from the first call>.
4. Send ?before=not-a-date.
5. Confirm the web bell, the Dashboard panel and the mobile inbox still load.

**Expect:** The default response is an array of the newest 50, newest first. limit=100 returns 100. limit=101 or 0 returns 400 'Limit must be a whole number between 1 and 100.' The before cursor returns the next older items with no overlap. An invalid before returns 400 'before must be an ISO date.' The response shape is unchanged, so every client still renders. The unread count (GET /notifications/unread-count) still counts all unread items.

**Needs:** Staging seed data

**Source:** `apps/api/src/application/use-cases/GetMyNotificationsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/NotificationController.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/pagination.ts`

## COMMS-N018 · P2 · Admin PDF exports print Ghanaian and West African names correctly

*Surfaces:* admin  ·  *Type:* functional

**Before:** Newsletter subscribers and contact submissions with names such as 'Ɔpɔku Adɔmi', 'Dɛnkyɛm', 'Ŋkɔsoɔ', 'Eʋe ɣleti ɖevi' and 'Ọmọ Ṣadé'.

**Steps:**

1. In admin /contact-submissions, export PDF.
2. In admin /newsletter, export PDF.
3. Open both PDFs and zoom into the names.
4. Load /fonts/export/NotoSans-OFL.txt on the admin host.

**Expect:** Every character renders in Noto Sans, the body and table font, with no empty boxes or dropped glyphs. Headings keep the Outfit brand font. The font licence file is served. Emoji and right-to-left text are not supported in PDFs; that is a known limitation to note, not a failure.

**Needs:** None

**Source:** `apps/admin/src/lib/exports/pdf.ts`, `apps/admin/public/fonts/export/NotoSans-Regular.ttf`, `apps/admin/public/fonts/export/NotoSans-OFL.txt`

## COMMS-N019 · P2 · Web app 'Skip to main content' link

*Surfaces:* web  ·  *Type:* functional

**Before:** Keyboard only; optionally VoiceOver or NVDA.

**Steps:**

1. Load app.ujimora.com/, /c/<slug> and /settings.
2. Press Tab once on each page.
3. Press Enter on the link that appears.
4. Press Tab again.

**Expect:** The first Tab reveals a 'Skip to main content' link as the first focusable element. Enter moves focus to the main landmark (#main-content) without changing the URL (no '#' added and no route change). The next Tab goes to the first control inside the page content, past the header navigation. A screen reader announces the main region.

**Needs:** None

**Source:** `apps/web/src/components/layout/Layout.tsx`

## COMMS-N020 · P2 · Blog sitemap lastmod changes only when published content changes

*Surfaces:* admin, api, marketing  ·  *Type:* functional

**Before:** A published blog article.

**Steps:**

1. Fetch ujimora.com/api/v1/blog/sitemap.xml and note the article's lastmod.
2. In admin /content/blog, edit the article and save the draft only. Fetch the sitemap again.
3. Click 'Publish changes'. Fetch the sitemap again.

**Expect:** A draft-only save leaves lastmod unchanged. Publishing moves lastmod to the publish time (publishedContentAt). Unpublished articles stay out of the sitemap.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/blogRoutes.ts`, `apps/api/src/infrastructure/database/models/BlogPostModel.ts`

## COMMS-N021 · P2 · Admin Contact submissions and Testimonials show load and save failures

*Surfaces:* admin  ·  *Type:* recovery/idempotency

**Before:** Admin account; DevTools request blocking.

**Steps:**

1. Block /api/v1/contact* and open admin /contact-submissions.
2. Unblock and click Retry.
3. Block /api/v1/testimonials* and open /testimonials; unblock and Retry.
4. Block the DELETE request and try to remove a testimonial.
5. Check the edit and remove icon buttons with a screen reader or the accessibility tree.
6. Let the access token expire and reload either page.

**Expect:** A failed load shows an error alert with Retry, and the stats show '—' instead of an empty inbox or zero counts. Retry reloads the data. A failed save or delete appears in the snackbar. The icon buttons have accessible names. An expired session refreshes through the shared admin API client, or redirects to login on 401.

**Needs:** None

**Source:** `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/admin/src/pages/TestimonialsPage.tsx`, `apps/admin/__tests__/pages/ContentInboxes.test.tsx`
