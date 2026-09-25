# Notifications, email & marketing site (81 cases)

In-app notifications, activity alerts, transactional email, newsletter, marketing pages, SEO/OG, blog, short links.

[Back to the QA plan](../README.md)

## COMMS-001 · P0 · Production email configuration preflight (Resend + encryption key + public URL)

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Render dashboard access for the API service; one ordinary test account; production or staging deploy.

**Steps:**

1. In Render, open the API service's Environment and confirm RESEND_API_KEY, FROM_EMAIL, REPLY_TO_EMAIL, PUBLIC_WEB_URL=https://app.ujimora.com and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 are set. The last one is NOT declared in render.yaml and must be added by hand.
2. Decode AUTH_EMAIL_ENCRYPTION_KEY_BASE64 locally (base64 -d | wc -c) and confirm exactly 32 bytes. Confirm it differs from the JWT/MFA/store-receipt keys.
3. Redeploy, then sign in at https://app.ujimora.com with DevTools Network open.
4. Open /settings and go to the Notifications section. Inspect the responses of GET /api/v1/email-verification and GET /api/v1/profile/activity-alerts.
5. Sign out, open /forgot-password, submit the test account's email and watch the HTTP status.

**Expect:** deliveryConfigured=true and emailConfigured=true. No 'Email delivery is temporarily unavailable' banner. Forgot-password returns 200 (not 503) and an email arrives. If the key is missing or not 32 bytes, recovery, verification and newsletter all return 503. Treat that as a launch blocker.

**Needs:** Resend account with API key; Render dashboard

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/app.ts`, `render.yaml`, `docs/compliance/ACCOUNT_EMAILS.md`

## COMMS-002 · P0 · Sender domain authentication and inbox placement

*Surfaces:* email  ·  *Type:* compliance

**Before:** COMMS-001 passed. Test inboxes at Gmail, Outlook.com, Yahoo and iCloud.

**Steps:**

1. In the Resend dashboard, confirm the ujimora.com domain is Verified (SPF and DKIM) and that a DMARC TXT record exists for _dmarc.ujimora.com.
2. Trigger a password reset to each of the four inboxes.
3. In Gmail use 'Show original' and read the SPF, DKIM and DMARC results and the DKIM signing domain.
4. Record which folder each message lands in (Inbox, Promotions or Spam).
5. Check the From header (must equal FROM_EMAIL) and the Reply-To header (must equal REPLY_TO_EMAIL).

**Expect:** SPF, DKIM and DMARC all pass, with d=ujimora.com aligned to the From domain. Messages reach the Inbox at most providers. The subject is 'Reset your Ujimora password'. From and Reply-To match the configured values.

**Needs:** Resend; DNS access; external mailboxes

**Source:** `apps/api/src/infrastructure/adapters/outbound/ResendActivityEmails.ts`, `render.yaml`

## COMMS-003 · P0 · Transactional email content, readability and link-fragment preservation

*Surfaces:* android, email, ios, web  ·  *Type:* cross-platform

**Before:** Email configured. Messages available for all purposes: reset, verification, password changed, newsletter confirmation and one activity alert.

**Steps:**

1. Open each message in Gmail web, the Gmail iOS/Android app, Outlook and Apple Mail.
2. Check the plain-text body wraps and links are tappable on a 390px phone screen.
3. Tap each link and confirm the browser address still contains '#token=' before the page loads. Resend click tracking or a mail scanner must not strip the fragment.
4. Confirm no password, OTP or amount-only secret appears in any body, and that security/verification emails state they are not marketing.
5. Confirm the support contact shown matches the published support mailbox.

**Expect:** All links open the correct app.ujimora.com page with the full token fragment. Copy is accurate. Verification mail says it does not subscribe to activity/marketing. Password-changed mail gives the forgot-password URL. Note: the support line prints REPLY_TO_EMAIL (info@ per render.yaml) while legal.ts names support@. Align these before launch.

**Needs:** Resend (check whether click tracking is enabled); multiple mail clients

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `packages/types/src/legal.ts`

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
6. Repeat the request with airplane mode on.

**Expect:** The web reset succeeds and the app sign-in works with the new password. Offline, the app shows 'Password recovery is temporarily unavailable…' and never a false success.

**Needs:** Physical devices; Resend

**Source:** `apps/mobile/app/forgot-password.tsx`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app.json`

## COMMS-011 · P0 · Password-change security notice from Settings (web and mobile)

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** User A signed in on web and mobile; email configured.

**Steps:**

1. On web, change the password from the account/security settings (current password plus new password).
2. Check A's inbox.
3. In the mobile app, pull to refresh or navigate to an authenticated screen.
4. Repeat the change from the mobile app.

**Expect:** 'Your Ujimora password changed' arrives. It contains no password, a link to app.ujimora.com/forgot-password and a support contact, and it states that it is not a marketing subscription. Other sessions are revoked.

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## COMMS-014 · P0 · Email verification happy path (web)

*Surfaces:* email, web  ·  *Type:* functional

**Before:** Newly registered user. Registration does not send a verification email automatically.

**Steps:**

1. Confirm no verification email arrived after registration.
2. Go to /settings → Notifications and click 'Send verification link'.
3. Open 'Verify your Ujimora email address' and click the link.
4. On /verify-email, click 'Verify email address'.
5. Back in Settings, click 'Check verification status'.
6. Confirm activity switches (all off), newsletter status, KYC level and role are unchanged.
7. If you verified in a different browser, confirm that browser was not signed in by the page.

**Expect:** Success reads 'Your email is verified. Your activity and marketing choices have not changed…'. The email switches become enabled but stay off. No session is created by the verify page.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/web/src/components/account/ActivityAlertSettings.tsx`

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

## COMMS-022 · P0 · Donation alert content and amount accuracy (owner and donor)

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Creator A (verified; donationsReceived in-app and email on) with an active campaign. Donor B signed in (donationsSent on). Paystack test card.

**Steps:**

1. As B, donate GHS 100 plus an optional platform tip of GHS 5 on /c/<slug>/donate.
2. Wait up to 90 seconds.
3. Compare A's bell item and email, and B's item and email, against My Donations, the campaign total and admin Donations.
4. Click 'View details' in the email and in the app.

**Expect:** A gets 'Your campaign received a donation': 'A supporter donated GHS 100.00 to “<title>”.' with no donor name. B gets 'Your donation is confirmed', including 'not a charitable tax certificate'. Amounts use 2 decimals and the correct currency, and equal the stored donation amount. Confirm that excluding the tip is intended and matches what the donor saw. Links open /campaigns/:id and /donations. Each alert arrives exactly once. Only the campaign creator is alerted (collaborators and split beneficiaries are not).

**Needs:** Paystack test keys; Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`

## COMMS-023 · P0 · Anonymous and guest donors: privacy and receipt expectations

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** As in COMMS-022, plus a logged-out guest with email G.

**Steps:**

1. As B, donate with the Anonymous option on.
2. As a guest, donate using email G.
3. Check A's alerts, B's alerts and G's inbox.

**Expect:** A's alerts never include a name or email. B still gets its own confirmation. Guest G receives no Ujimora email; the only possible receipt is Paystack's own. Product and legal must confirm that no guest receipt is acceptable for launch.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/compliance/ACTIVITY_ALERTS.md`

## COMMS-025 · P0 · Payout and withdrawal lifecycle alerts (requested, processing, completed, failed, reversed)

*Surfaces:* admin, email, web  ·  *Type:* functional

**Before:** A has 'Withdrawals and payouts' in-app and email on, plus an eligible balance. Paystack test transfers.

**Steps:**

1. A requests a GHS 200 Priority cashout from the campaign's 'Cashout & payout history' panel.
2. An admin approves it on admin /payouts.
3. Let the Paystack test transfer.success webhook arrive.
4. Repeat with a forced transfer.failed, then a transfer.reversed.
5. Replay each webhook from the Paystack dashboard.

**Expect:** One alert per state: requested, processing, completed (only after settlement is applied), failed and reversed. The body shows GHS 200.00 (gross) and directs to payout history for fee and net amounts. Replays create no duplicates. The link opens the campaign.

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

## COMMS-060 · P0 · Pricing page matches the actual plans and checkout amounts

*Surfaces:* admin, marketing, web  ·  *Type:* compliance

**Before:** Admin plan configuration known.

**Steps:**

1. For each plan, compare ujimora.com/pricing (Monthly and Yearly) with admin /plans and the amount shown at web /subscription checkout.
2. Check the yearly per-month figure (priceYearly/12, up to 2 decimals) and 'GH₵ X/year · billed annually'.
3. Check the platform fee %, the goal caps and 'No goal limit' for unlimited plans.
4. Confirm Enterprise links to /contact.
5. Block /api/v1/plans/public and reload.

**Expect:** Every figure matches exactly and nothing is hardcoded or stale. A failure shows 'Current pricing could not be loaded' with Retry. Fee disclosure is accurate for Electronic Transactions Act compliance.

**Needs:** None

**Source:** `apps/marketing/src/pages/PricingPage.tsx`, `apps/admin/src/pages/ManagePlansPage.tsx`

## COMMS-061 · P0 · Legal hub, policy content and entity facts on marketing, web and native

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Legal owner available for sign-off.

**Steps:**

1. Open ujimora.com/legal and confirm all 9 policies are listed.
2. On each page, check the effective date, 'DevTrack', BN843072020, the registered address and the contact mailboxes.
3. Open app.ujimora.com/terms (and the other slugs) and view source: the canonical must be https://ujimora.com/<slug>.
4. In the mobile app, open each legal screen (terms, privacy, cookies, refund-policy, acceptable-use, organizer-agreement, contributor-terms, billing-terms, delete-account) and compare the text.

**Expect:** The text is identical across surfaces. The entity is correct and signed off; READINESS C01 notes the DevTrack vs Neurodyne relationship is still an external gate. Canonicals point to marketing.

**Needs:** Legal sign-off

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/web/src/pages/LegalPage.tsx`, `apps/mobile/src/components/LegalScreen.tsx`, `docs/compliance/READINESS.md`

## COMMS-062 · P0 · Published mailboxes receive mail; replies to transactional email are read

*Surfaces:* email  ·  *Type:* compliance

**Before:** Access to each mailbox.

**Steps:**

1. From an external account, send to info@, support@, trust@, legal@ and sales@ujimora.com.
2. Reply to a password-reset email and to an activity alert.
3. Record which inbox receives each message.

**Expect:** Every address delivers to a monitored inbox. Replies reach the REPLY_TO_EMAIL mailbox. Confirm the owner of that mailbox (render.yaml uses info@, while legal.ts designates support@ for support).

**Needs:** Mail hosting

**Source:** `packages/types/src/legal.ts`, `render.yaml`

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

**Before:** A user with inbox items, an active newsletter subscription, activity preferences and a pending verification email; MongoDB read access.

**Steps:**

1. Delete the account via Settings → Delete account (test once on web and once on mobile).
2. Use the old newsletter unsubscribe link and the old verification link.
3. Check the notifications, newslettersubscriptions, newsletterconsenttokens, activityalertpreferences, accountemailjobs and activityalertdeliveries collections for the user.
4. Trigger activity that would have produced alerts.

**Expect:** Records are removed, old links fail gracefully and no further email is sent. Financial records remain intact as designed.

**Needs:** MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `docs/compliance/DATA_RIGHTS.md`, `docs/compliance/NEWSLETTER.md`

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

**Before:** Disposable user C; staging where Resend can be made to fail temporarily (invalid key) so the job stays pending.

**Steps:**

1. As C, request a password reset while Resend is failing.
2. In Settings, click Delete account and confirm.
3. Restore the Resend key and wait 2 minutes.
4. Check C's inbox and the accountemailjobs collection.
5. Request a reset for C's email again.

**Expect:** The pending job is removed or suppressed and no email is delivered. The later request returns the same public success response and sends nothing.

**Needs:** Staging; Resend; MongoDB read access

**Source:** `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`

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

## COMMS-027 · P1 · Refund status alert

*Surfaces:* admin, email, web  ·  *Type:* functional

**Before:** Donor B with 'Refund updates' on and an eligible donation.

**Steps:**

1. B requests a refund at /donations/refund/:id.
2. An admin processes it (approve or reject).
3. Check B's bell and email at each status.

**Expect:** 'Your refund is <status>' arrives once per status change. The amount matches the refund record. The link opens /refunds.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

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

## COMMS-029 · P1 · Subscription alerts for Paystack (web) and store-billed (native) plans

*Surfaces:* android, email, ios, web  ·  *Type:* compliance

**Before:** 'Subscription updates' on. iOS sandbox tester and Android license tester.

**Steps:**

1. On web, subscribe via Paystack, then cancel at period end.
2. In staging, set currentPeriodEnd to the past and wait for the worker.
3. On iOS and Android, buy the plan through in-app purchase in the sandbox.
4. Read the alert text in the native inbox.

**Expect:** Alerts read 'Subscription active', 'scheduled to end' and 'expired', each with the period-end date. The text says to manage billing with the provider. No native inbox item links to web checkout or quotes web prices (App Store 3.1.1).

**Needs:** Paystack test keys; App Store and Play sandbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/compliance/STORE_BILLING.md`

## COMMS-031 · P1 · Email provider outage, retry and 23-hour review state

*Surfaces:* api, email  ·  *Type:* recovery/idempotency

**Before:** Staging; MongoDB write access for simulation.

**Steps:**

1. Set an invalid RESEND_API_KEY and trigger an email alert.
2. Watch the delivery: status 'pending', lastError 'activity_delivery_retry_pending', attempts rising about every 60 seconds.
3. Restore the key and confirm a single delivery.
4. Repeat, then set firstAttemptAt to 23 hours ago with the provider still failing.
5. Check whether any admin screen shows 'review' items.

**Expect:** Retries reuse the same payload and key and deliver exactly once after the fix. An old ambiguous attempt moves to 'review'. There is no admin UI for these, so an operator runbook to check Resend history before re-sending must exist.

**Needs:** Staging; Resend; MongoDB

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `docs/compliance/ACTIVITY_ALERTS.md`

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

**Before:** Alerts with each path type: /campaigns/:id, /donations, /refunds, /wallet, /creator, /subscription, /dashboard.

**Steps:**

1. Check the header bell badge; seed more than 99 unread items in staging.
2. Open the modal and tap 'Mark as read'.
3. Tap 'View details' for each path type.
4. Background the app, create a new alert, then foreground it.

**Expect:** Each path opens the right native screen (campaign detail, My donations, My refunds, Wallet tab, Creator, Subscription tab, Dashboard) and never 'not found'. The badge caps at '99+'. The list refreshes on foreground. There is no 'Mark all read' on mobile; decide if that is acceptable.

**Needs:** Physical devices

**Source:** `apps/mobile/src/components/NotificationBell.tsx`, `apps/mobile/src/components/OwnerNotifications.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/src/context/NotificationContext.tsx`

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

## COMMS-047 · P1 · Marketing contact form through to staff handling

*Surfaces:* admin, marketing  ·  *Type:* functional

**Before:** Admin account.

**Steps:**

1. On ujimora.com/contact, choose 'Campaign support', fill name, email, subject and a message of at least 10 characters, then click 'Send message'.
2. In admin, open the bell and look for 'New contact messages'.
3. Open /contact-submissions, open the row, set In progress with notes, then Resolved.
4. Filter by status and type, then export.

**Expect:** The success state shows. The submission holds the exact fields. The bell count rises, then falls once the item is no longer 'new'. resolvedAt is set. No acknowledgement email goes to the submitter; confirm the page copy sets that expectation.

**Needs:** None

**Source:** `apps/marketing/src/pages/ContactPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ContactController.ts`, `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

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

## COMMS-052 · P1 · CMS API: permissions, malformed payloads and concurrent edits

*Surfaces:* admin, api, marketing  ·  *Type:* negative/edge

**Before:** Staging; admin and user tokens.

**Steps:**

1. As a user, send PUT /api/v1/content/faq; repeat without a token.
2. As admin in staging, send PUT /api/v1/content/marketing.stats with {data: []}, then load ujimora.com.
3. Have two admins edit /content/faq at the same time and both save.
4. Restore the defaults.

**Expect:** The user request returns 403 and no token returns 401. The home page should not white-screen; if it does, the stats block needs shape validation before launch (the API accepts any JSON). The second save silently overwrites the first, because there is no revision check. Accept that risk or fix it.

**Needs:** Staging

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/contentRoutes.ts`, `apps/api/src/application/use-cases/UpsertSiteContentUseCase.ts`, `apps/marketing/src/components/sections/StatsSection.tsx`

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

## COMMS-064 · P1 · Cookie Notice matches what the sites actually store

*Surfaces:* marketing, web  ·  *Type:* compliance

**Before:** Fresh browser profile.

**Steps:**

1. Visit ujimora.com and app.ujimora.com, register, and follow a '?ref=' affiliate link.
2. In DevTools → Application, review Cookies and Local Storage; in the Network panel, review third-party requests.
3. Compare the findings with /cookies sections 2–5.

**Expect:** Ujimora sets no cookies. Local storage holds only uf_tokens and accessToken (necessary), uf_color_mode and uf_skin (preferences) and uf_ref (referral attribution; decide its category and whether consent is needed). There are no analytics or ad trackers. The notice's promised 'production cookie table' and third-party list are completed. No consent banner exists, so none may be needed as long as no non-essential tech is added.

**Needs:** None

**Source:** `packages/types/src/legal.ts`, `apps/web/src`, `apps/marketing/index.html`

## COMMS-065 · P1 · robots.txt, sitemaps and noindex headers on all hosts

*Surfaces:* api, marketing, web  ·  *Type:* functional

**Before:** Production domains live.

**Steps:**

1. Run curl -i on ujimora.com/robots.txt, ujimora.com/sitemap.xml, ujimora.com/api/v1/blog/sitemap.xml, app.ujimora.com/robots.txt, app.ujimora.com/sitemap.xml, api.ujimora.com/robots.txt and api.ujimora.com/sitemap.xml.
2. Run curl -I https://api.ujimora.com/api/v1/campaigns.
3. Submit the sitemaps in Google Search Console.

**Expect:** All sitemaps return application/xml. app.ujimora.com/sitemap.xml must not return the SPA HTML: apps/web/vercel.json lacks the /sitemap.xml rewrite that the root vercel.json has. API JSON carries X-Robots-Tag noindex, while robots.txt and sitemap.xml do not. The static marketing sitemap lists only existing routes. Search Console reports no errors.

**Needs:** Vercel; Google Search Console

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `apps/web/vercel.json`, `vercel.json`, `apps/web/public/robots.txt`, `apps/marketing/public/robots.txt`, `apps/api/src/app.ts`

## COMMS-066 · P1 · App sitemap lists only publicly viewable campaigns and creators

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Staging data: campaigns in draft, pending_review, active-but-held-for-publication-review, blocked, deleted, active and funded states; creator profiles for a closed account, a blocked user and a user without a paid plan.

**Steps:**

1. Fetch https://<staging-api>/sitemap.xml.
2. Open every listed URL while logged out.

**Expect:** Only public campaigns and creators are listed, and every URL shows content (no soft 404s, no private handles). Risk: the current code lists all creator handles and filters campaigns by status only.

**Needs:** Staging

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `docs/compliance/CAMPAIGN_VISIBILITY.md`

## COMMS-068 · P1 · Social link previews for blog, pricing and campaign URLs

*Surfaces:* marketing, web  ·  *Type:* cross-platform

**Before:** Facebook Sharing Debugger, LinkedIn Post Inspector, WhatsApp, X.

**Steps:**

1. Share ujimora.com/blog/<slug>, ujimora.com/pricing and app.ujimora.com/c/<slug> on each platform.
2. Record the title, description and image shown.

**Expect:** Today every link shows the static index.html card, because meta tags are set by JavaScript (a limitation acknowledged in seo.ts). Product must accept this or add prerendering before launch. The image must load and the card must not be broken.

**Needs:** Social debug tools

**Source:** `packages/ui/src/seo.ts`, `apps/marketing/index.html`, `apps/web/index.html`

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

**Before:** Campaign owner with an active campaign and an active live session (LiveKit configured for the live kind).

**Steps:**

1. On web, open /campaigns/:id/live → 'Dynamic QR codes' and create Campaign, Live, Preset amount (50) and Creator codes.
2. Copy a short link and download a PNG.
3. On mobile, open Manage campaign → QR codes and create each kind.
4. Refresh the lists.

**Expect:** Codes are 7 characters from the unambiguous alphabet. The short URL is https://api.ujimora.com/r/<code>. PNGs download and preview. Lists show scan counts and persist.

**Needs:** LiveKit (for live kind)

**Source:** `apps/web/src/components/live/QrCodeManager.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/utils/shortCode.ts`

## COMMS-071 · P1 · Short-link redirect, UTM forwarding, scan counting and QR images

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Codes from COMMS-070.

**Steps:**

1. Run curl -i 'https://api.ujimora.com/r/<code>?utm_source=flyer&utm_campaign=x&foo=bar'.
2. Scan the printed code with a phone camera.
3. Check the scan count in the list, and the live session's scans stat for the live code.
4. Fetch /qr/<code>.svg and /qr/<code>.png.

**Expect:** 302 to the correct target with utm_source and utm_campaign appended and foo dropped. Headers include Cache-Control: no-store and X-Short-Url. scanCount goes up by 1 per GET; link-preview bots also count. The images encode the short URL.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoShortLinkRepository.ts`

## COMMS-072 · P1 · Creator QR code lands on the creator's public page (known defect)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** A Creator-kind code.

**Steps:**

1. Scan the code or open /r/<code>.
2. Note the final URL and page, on web and via the native app if opened there.

**Expect:** It should land on the creator's public page (/creators/<handle>). Currently the target is <PUBLIC_WEB_URL>/u/<creatorId>, a route that exists in neither the web router nor the native resolver, so it shows Not Found. Fix it or hide the Creator option before launch.

**Needs:** None

**Source:** `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/web/src/router.tsx`, `apps/mobile/src/navigation/resolvePath.ts`

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

**Before:** A live session S2 on another campaign.

**Steps:**

1. Create an event code with label 'https://evil.example'.
2. Create a live code with liveSessionId '../../x', then one with S2's ID.
3. Follow each redirect and check S2's scans stat.

**Expect:** Redirects always stay on app.ujimora.com/c/<own slug>…, with the label only as an encoded ?ref value. Risk: S2's ID is accepted and scanning increments S2's scan stat. The server should validate that the session belongs to the campaign.

**Needs:** LiveKit

**Source:** `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`

## COMMS-076 · P1 · Printed QR codes after the campaign changes

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Printed campaign and amount codes.

**Steps:**

1. The owner changes the campaign's custom slug; scan the old code.
2. Let the campaign end or become funded; scan.
3. An admin blocks, then deletes, the campaign; scan.

**Expect:** After a slug change, the code currently leads to a not-found page, because there is no slug history and targets are frozen at creation. Decide: keep old-slug redirects or warn owners before they change a slug. Ended or funded campaigns show the page. Blocked or deleted campaigns show a clear 'unavailable' state, never an error.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`

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

**Before:** Create one each of: contact message, pending KYC, pending campaign, payout request, safety report.

**Steps:**

1. Open the admin bell and read each count.
2. Click each item.
3. As a non-admin, send GET /api/v1/admin/action-center.

**Expect:** Counts are accurate. Items route to /contact-submissions, /kyc-review, /campaigns, /payouts and /safety-reports. The badge equals unread notifications plus pending actions. Viewing an item does not resolve the work. The non-admin request returns 403.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/admin/src/components/layout/TopBar.tsx`

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

## COMMS-036 · P2 · Bell error recovery and large inbox performance

*Surfaces:* android, ios, web  ·  *Type:* negative/edge

**Before:** Staging user seeded with 300 notifications.

**Steps:**

1. Block /api/v1/notifications in DevTools and observe the badge and popover.
2. Click Retry after unblocking.
3. With the 300-item user, open the bell and the Dashboard on web and on a low-end Android phone.
4. Leave the tab hidden and confirm polling pauses.

**Expect:** The badge shows '!' with 'Notifications could not be loaded. Please retry.' and then recovers. The large inbox opens within about 2 seconds with no jank. The list endpoint is not paginated, so record timings for launch acceptance.

**Needs:** Staging seed data

**Source:** `packages/ui/src/components/NotificationBell.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoNotificationRepository.ts`

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

## COMMS-081 · P2 · Rate limits on public messaging endpoints

*Surfaces:* api, marketing, web  ·  *Type:* negative/edge

**Before:** Single client IP.

**Steps:**

1. Send 31 forgot-password requests within 15 minutes.
2. Send 21 newsletter subscribe requests.
3. Send 11 contact submissions.
4. Read the UI messages and response headers.

**Expect:** 429 with Retry-After once each limit is passed (auth 30, newsletter 20, contact 10 per 15 minutes). The UIs show generic errors. Limits are in memory per API instance, so they multiply if Render scales out.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`
