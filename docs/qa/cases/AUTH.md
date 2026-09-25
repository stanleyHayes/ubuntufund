# Accounts & sign-in (80 cases)

Registration (individual and organization), email verification, login, password reset/change, sessions, MFA and recovery codes, native biometric lock, rate limits.

[Back to the QA plan](../README.md)

## AUTH-01 · P0 · Production auth secrets and encryption keys are configured (JWT, MFA, account-email)

*Surfaces:* api, email, web  ·  *Type:* compliance

**Before:** Access to Render dashboard for ujimora-api and to Resend. A signed-in production test account.

**Steps:**

1. In Render > ujimora-api > Environment, confirm that JWT_SECRET and JWT_REFRESH_SECRET exist, are each at least 32 characters, and differ from each other.
2. Confirm MFA_ENCRYPTION_KEY is set: 44 base64 characters ending in '=' that decode to 32 bytes. It is NOT declared in render.yaml, so it must have been added by hand. Confirm a backup copy is stored in the company secret manager.
3. Confirm AUTH_EMAIL_ENCRYPTION_KEY_BASE64 is set to 32 random bytes in base64. It is also missing from render.yaml. It must not be reused from the JWT or store keys.
4. Confirm RESEND_API_KEY is set, FROM_EMAIL (info@ujimora.com) is on a domain verified in Resend (SPF/DKIM green), REPLY_TO_EMAIL is set, and PUBLIC_WEB_URL=https://app.ujimora.com (https, no query or hash).
5. Signed in on https://app.ujimora.com, open DevTools and call GET /api/v1/auth/mfa. Then call GET /api/v1/email-verification.
6. Call POST /api/v1/auth/forgot-password with {"email":"nobody@example.com"}.

**Expect:** All keys are present and valid. /auth/mfa returns available:true. /email-verification returns deliveryConfigured:true. forgot-password returns 200 with 'If that email is registered, you will receive a reset link shortly', not 503. Any 503 or available:false blocks launch: MFA and all password recovery and email verification would be unavailable.

**Needs:** Render dashboard, Resend account with verified domain

**Source:** `render.yaml`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/application/services/Totp.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `docs/compliance/MFA_AND_BIOMETRICS.md`, `docs/compliance/ACCOUNT_EMAILS.md`

## AUTH-02 · P0 · Rate limits are per client IP behind Vercel/Render, not one global bucket

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Production or a production-like staging deployment behind Render. Two clients on different public networks (A: office Wi-Fi laptop; B: phone on mobile data). A test account.

**Steps:**

1. From network B, open https://app.ujimora.com/login, submit a wrong password once, and note the X-RateLimit-Remaining response header on /api/v1/auth/login.
2. From network A, send 31 POST requests to https://app.ujimora.com/api/v1/auth/login with a wrong password (curl loop). Confirm the 31st returns 429 with a Retry-After header.
3. Immediately from network B, sign in with the correct password.
4. Repeat step 2 against https://api.ujimora.com/api/v1/auth/login directly and re-check network B.

**Expect:** Network B is unaffected: its first X-RateLimit-Remaining is about 29 and its sign-in succeeds while A is throttled. If B also gets 429, or its remaining count starts low, the limiter is keying on the Render/Vercel proxy address. app.ts never sets 'trust proxy', so launch traffic would lock every user out of login and signup after 30 requests per 15 min, and the API-wide limit would trip after 300. Treat that as a launch blocker. Note that counters are in memory and reset on every restart or spin-down.

**Needs:** None external; two networks

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/web/vercel.json`, `render.yaml`

## AUTH-03 · P0 · Web individual registration (Free plan): happy path and entry points

*Surfaces:* api, marketing, web  ·  *Type:* functional

**Before:** A fresh inbox address. Signed out. /api/v1/plans/public reachable.

**Steps:**

1. On https://ujimora.com, click the Navbar 'Get started' CTA. Confirm it opens https://app.ujimora.com/register (not http://localhost:8200, the fallback when VITE_WEB_APP_URL is unset).
2. Also confirm that the app Header 'Get Started' and the mobile-drawer 'Get Started' open /register.
3. Step 'Account': choose 'Individual' and click Continue.
4. Step 'Details': enter Full name, Email, a password of 10+ characters (watch the strength meter), and the same value in Confirm password. Tick 'I agree to the Terms of Use and Acceptable Use Policy and have read the Privacy Notice.' and 'I confirm that I am at least 18 years old.' Click Continue.
5. Step 'Plan': leave Free selected and click 'Create account'.
6. Open /wallet and /settings. Check the inbox.

**Expect:** POST /auth/register returns 201. The user lands on /dashboard signed in, and the header shows the account menu with their name. /wallet shows a GHS 0.00 local wallet. Settings > Notifications shows 'Verify your email address to enable activity emails'. No account-agreement banner appears. The DB user has legalAcceptance.version '2026-09-12', both flags true, and a server acceptedAt. No verification email is sent automatically (signup does not enqueue one), so confirm with the product owner that this is intended.

**Needs:** None (Free plan)

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/marketing/src/components/Navbar.tsx`, `apps/web/src/components/layout/Header.tsx`

## AUTH-04 · P0 · Terms and 18+ checkboxes are unchecked by default and block signup (web and native)

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** Signed out.

**Steps:**

1. Web /register: pick Individual, fill every Details field but leave both checkboxes unticked, and click Continue.
2. Tick only the terms checkbox and click Continue. Then tick only the 18+ checkbox and click Continue.
3. Click the Terms of Use, Acceptable Use and Privacy Notice links under the checkbox.
4. Native: open the Register screen, fill every field, leave the checkboxes unticked, and observe the 'Create Account' button.
5. Native: tap 'Read Acceptable Use Policy', 'Terms of Service' and 'Privacy Policy', then go back.

**Expect:** Web: Continue shows 'Accept the terms and confirm you are at least 18 to continue' until both boxes are ticked, and 'Create account' is disabled without both. Policy links open in a new tab and the form keeps its data. Native: 'Create Account' stays disabled until both boxes are checked. Policy screens open in-app, and Back returns to the form with its values intact. Both boxes start unchecked on every surface.

**Needs:** None

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/mobile/app/(auth)/register.tsx`, `packages/types/src/legal-acceptance.ts`

## AUTH-05 · P0 · Register API rejects missing or old legal acceptance, privilege escalation, injected fields and bad passwords

*Surfaces:* api  ·  *Type:* security/permission

**Before:** curl or Postman pointed at the staging API.

**Steps:**

1. POST /api/v1/auth/register with a valid email, name and password but no legalAcceptance.
2. Repeat with legalAcceptance.version '2026-01-01', then with ageConfirmed:false, then with acceptedTerms:false.
3. Repeat with a valid legalAcceptance and role:'admin'.
4. Send a valid body that also includes emailVerified:true, authVersion:'x', verificationLevel:3 and kycStatus:'approved'. Then GET /email-verification and /rbac/me with the returned token.
5. Send a 7-character password, then a 129-character password.

**Expect:** Missing, old or false acceptance returns 400 'Validation failed' with a legalAcceptance error. role 'admin' returns 400. The injected-fields request returns 201, but emailVerified is false, the role is user, /rbac/me shows roleName 'User', and the verification level is unchanged. The 7-character and 129-character passwords each return 400. No account is created by any rejected request.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/legalAcceptanceSchema.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`

## AUTH-07 · P0 · Web organization wizard: happy path from the marketing 'register as organization' link

*Surfaces:* admin, marketing, web  ·  *Type:* functional

**Before:** Signed out. A fresh email. Admin account for verification.

**Steps:**

1. From ujimora.com, follow the organization CTA to https://app.ujimora.com/register?role=organization.
2. Step 'Account': confirm 'Organization' is preselected and click Continue.
3. Step 'Organization': enter an Organization name, pick a type in the picker (NGO, Hospital, School, Religious, Government or Other), enter a Registration number, and a Website of https://example.org. Click Continue.
4. Step 'Contact': enter the contact name, email, password and confirmation, tick both checkboxes, and click Continue.
5. Step 'Plan': choose Free and click Create account.
6. Open /organization-team and /profile. In admin, open Users and then the new user.

**Expect:** The stepper shows 4 steps: Account, Organization, Contact, Plan. The account is created with role 'organization', and organizationName, organizationType, registrationNumber and website are saved. /organization-team loads. The admin user detail shows the organization role and 'Website request: Not requested'. No website banner appears because a website was supplied.

**Needs:** None

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/components/auth/OrganizationTypePicker.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/admin/src/pages/UserDetailPage.tsx`

## AUTH-10 · P0 · Native registration (individual and organization) on iOS and Android; no payment step

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Signed release or preview builds pointed at staging over HTTPS. Fresh emails.

**Steps:**

1. Fresh install. Go to Profile tab > Sign in > 'Create one'.
2. Register an individual: name, email, password of 8+ characters with a matching confirm (check the 'Strong password' hint), both checkboxes, then Create Account.
3. Sign out. Register an organization: toggle Organization, enter the org name, open the type picker (defaults to NGO) and change it, add a registration number and an https website, then Create Account.
4. With the keyboard open, check that the Create Account button can be reached on small screens (iPhone SE, small Android).

**Expect:** Each signup routes to the (tabs) home signed in. The account has country 'Ghana' and the right role. No plan or price selection and no Paystack checkout appears during native signup, because native subscriptions must go through App Store or Google Play in-app purchase. The form stays usable with the keyboard open.

**Needs:** Staging API over HTTPS (EXPO_PUBLIC_API_URL)

**Source:** `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/api.ts`

## AUTH-17 · P0 · Web email verification: happy path

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Email configured (AUTH-01). A newly registered, unverified user signed in.

**Steps:**

1. Go to /settings > Notifications. Under 'Verify your email address…', click 'Send verification link'.
2. Open the email 'Verify your Ujimora email address', which should arrive within about 1-2 minutes because the worker runs every 30 s. Check the From and Reply-To addresses and the link format https://app.ujimora.com/verify-email#token=<64 hex>.
3. Open the link. Check that the address bar no longer shows the #token fragment. Click 'Verify email address'.
4. Click 'Go to Settings', then 'Check verification status'.
5. Turn on one activity 'Email' switch.

**Expect:** The confirmation message says to check the inbox. The email arrives with the 30-minute single-use wording and no marketing opt-in. The page shows 'Your email is verified…'. Verification does not sign the viewer in. Settings no longer shows the verify prompt and the email switches become enabled. No activity or marketing preference was turned on automatically.

**Needs:** Resend (real inbox), AUTH_EMAIL_ENCRYPTION_KEY_BASE64

**Source:** `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## AUTH-22 · P0 · Web login happy path with return to the requested page

*Surfaces:* api, web  ·  *Type:* functional

**Before:** A registered user without MFA. Signed out.

**Steps:**

1. Open https://app.ujimora.com/wallet directly.
2. Check the panel, then click 'Sign In'.
3. Enter the email and password and click 'Sign In'.
4. Sign out, open /login directly, and sign in.

**Expect:** /wallet shows 'Sign in to continue' with a lock icon, not a blank page or an error. After signing in from that prompt, the user returns to /wallet. A direct /login visit goes to /dashboard. The header shows the account menu. The button shows 'Signing in...' and is disabled while the request is in flight.

**Needs:** None

**Source:** `apps/web/src/components/auth/LoginForm.tsx`, `apps/web/src/components/auth/RequireAuth.tsx`, `apps/web/src/components/auth/SignInPrompt.tsx`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`

## AUTH-26 · P0 · Admin console login for a staff admin

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** An account with the admin role. Signed out.

**Steps:**

1. Open https://admin.ujimora.com/users while signed out.
2. On /login, submit with empty fields.
3. Enter the admin credentials, toggle the eye icon, and click 'Sign in to workspace'.
4. Click 'Forgot password?' to confirm it routes to /forgot-password.

**Expect:** /users redirects to /login. Empty fields show 'Enter your email address and password.'. Sign-in lands on the dashboard with the role label 'Administrator' in the sidebar, and /rbac/me returns the full permission set. The forgot link works.

**Needs:** None

**Source:** `apps/admin/src/pages/LoginPage.tsx`, `apps/admin/src/components/AuthGuard.tsx`, `apps/admin/src/context/AuthContext.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`

## AUTH-27 · P0 · Member and organization accounts cannot see or change anything in the admin console

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A normal member account and an organization account, with DevTools open.

**Steps:**

1. Sign in at https://admin.ujimora.com/login as the member.
2. Look at the dashboard (the index route has no RequirePermission), then open /campaigns, /donations, /payouts, /wallets, /subscriptions, /store-billing, /refund-recovery, /users, /audit and /kyc-review.
3. In the Network tab, record the status of every /api/v1 call.
4. With the member's token, call an admin mutation directly (e.g. approve a payout or a KYC review).
5. Repeat steps 1-3 as the organization account, which also has ANALYTICS READ, so add /overview and /reports.

**Expect:** No real platform data is displayed anywhere. Pages show the access-denied or PermissionDenied view, or empty states. Every admin API call returns 403 'Insufficient permissions', and the direct mutation returns 403. Log a bug if any page renders fixture or mock tables that look like live data, or if non-staff can reach admin pages that their RBAC role grants READ on (campaigns, donations, wallets, subscriptions; analytics for organizations). Ideally admin login would refuse non-admin roles outright; record the current behavior.

**Needs:** None

**Source:** `apps/admin/src/router.tsx`, `apps/admin/src/components/AuthGuard.tsx`, `apps/admin/src/context/AdminPermissionContext.tsx`, `packages/types/src/rbac.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `docs/compliance/STAFF_ACCESS.md`

## AUTH-29 · P0 · Web sign out clears the session in every open tab

*Surfaces:* web  ·  *Type:* functional

**Before:** Signed in with two tabs open (tab A on /dashboard, tab B on /wallet).

**Steps:**

1. In tab A, open the account menu and choose 'Sign out'.
2. In DevTools > Application > Local Storage, check uf_tokens, uf_user and uf_last_activity.
3. Switch to tab B and click anything.
4. In tab A, use browser Back to return to /wallet.
5. At phone width, sign in again and sign out from the drawer 'Sign out'.

**Expect:** Tab A goes to '/', and the header shows Login and Get Started. All three keys are removed. Tab B shows the signed-out state or the sign-in prompt on its next interaction, through the storage event. Back to /wallet shows 'Sign in to continue' with no cached data. The drawer sign-out behaves the same.

**Needs:** None

**Source:** `apps/web/src/components/layout/Header.tsx`, `apps/web/src/components/layout/AccountMenu.tsx`, `apps/web/src/context/AuthContext.tsx`, `packages/ui/src/browserSession.ts`

## AUTH-30 · P0 · Native sign out removes credentials and the biometric vault

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** Signed in on a device, once with biometric unlock off and once with it on.

**Steps:**

1. Profile tab: tap 'Sign Out'.
2. Force-quit and relaunch the app.
3. Open Settings, My donations and Wallet.
4. With biometric on: sign out, relaunch, then background and foreground the app.

**Expect:** The app returns to the login screen. After relaunch it is still signed out, and protected screens show 'Sign in to view your …'. With biometric previously on, no lock screen appears after sign-out, because the vault and preference are cleared. No stale user name is shown anywhere.

**Needs:** Physical devices

**Source:** `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/components/SignInRequired.tsx`

## AUTH-33 · P0 · Web password reset end to end, ending every other session

*Surfaces:* api, email, ios, web  ·  *Type:* functional

**Before:** Email configured. User U is signed in on browser A and on the phone. Browser B is signed out.

**Steps:**

1. Browser B: open /forgot-password, enter U's email and submit.
2. Check the confirmation screen, then open the 'Reset your Ujimora password' email.
3. Open the link (https://app.ujimora.com/reset-password#token=…). Check that the #token fragment disappears from the address bar.
4. Enter a new password twice and click 'Change password'.
5. Click 'Sign in' and sign in with the new password. Also try the old password.
6. Use browser A and the phone app.

**Expect:** The confirmation reads 'If an account exists, a password reset link will be sent to …', and the email arrives within about 2 minutes. Success reads 'Your password has changed and previous sessions have ended.' There is no automatic sign-in. The new password works and the old one fails. Browser A and the phone are signed out on their next request ('Your session has expired'). A 'Your Ujimora password changed' security email arrives.

**Needs:** Resend, AUTH_EMAIL_ENCRYPTION_KEY_BASE64

**Source:** `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/web/src/pages/ResetPasswordPage.tsx`, `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## AUTH-39 · P0 · A password reset does not remove or bypass MFA

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** An account with MFA enabled.

**Steps:**

1. Reset the password through the email flow.
2. Sign in with the new password only.
3. Enter the authenticator code. Separately, repeat sign-in using a recovery code.

**Expect:** After the password is accepted, the UI shows 'Enter a valid authenticator code or an unused recovery code.' and the 6-box input. No tokens are issued until a valid code is entered. Both the TOTP and the recovery-code routes succeed.

**Needs:** Resend, authenticator app

**Source:** `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`

## AUTH-44 · P0 · Web access token refreshes silently while the user is active

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Signed in on web and on admin. The Network tab is kept (Preserve log).

**Steps:**

1. Keep interacting (click or scroll every few minutes) for 20 minutes. The access token lasts 15 minutes.
2. Watch for POST /api/v1/auth/refresh around the 14-minute mark.
3. Open a second tab of the same app and keep both active.
4. Set the network to Offline for 2 minutes over a refresh boundary, then go back online.

**Expect:** The refresh happens about 60 s before expiry and returns a new pair. There are no 401 errors, no sign-in prompts and no lost form input. Both tabs keep working. While offline the session is NOT cleared, and requests recover once back online.

**Needs:** None

**Source:** `packages/ui/src/browserSession.ts`, `apps/web/src/lib/api.ts`, `apps/admin/src/lib/api.ts`

## AUTH-48 · P0 · Credential versioning revokes old tokens on every instance and survives an API restart

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** Staging on Render. The access and refresh tokens from web session A and the mobile session B are captured.

**Steps:**

1. From session C, change the password (or enable MFA).
2. Restart the API in Render (Manual Deploy > Restart).
3. With A's old access token, call GET /api/v1/wallets. Call /auth/refresh with A's old refresh token.
4. As an optional-auth check, make a public donation-intent or comment-read request with A's old token and inspect how it is attributed.
5. Use the mobile app (B).

**Expect:** The old access token gets 401 'Your session has ended. Please sign in again.' and the old refresh token gets 401, even after the restart. This shows the check uses the persisted authVersion rather than in-memory revocation. Optional-auth endpoints treat the stale token as a guest and never as the user. The mobile app is signed out.

**Needs:** Render restart access

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/domain/entities/User.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`

## AUTH-49 · P0 · Role changes take effect immediately, and users cannot raise their own role

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin X signed in to the console. DB access (role assignment has no UI).

**Steps:**

1. In the DB, set X's role to 'user'.
2. Without signing out, click a console page that calls admin APIs, then reload.
3. Set the role back to 'admin' and reload.
4. As a normal member, call PUT /api/v1/profile with {"role":"admin","name":"Test Name"}, then GET /rbac/me.

**Expect:** Admin APIs return 403 right away after the demotion, and after reload the pages show PermissionDenied. Access comes back after promotion without re-login. The member's PUT updates only the name, and the role stays 'user'.

**Needs:** DB access

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`

## AUTH-52 · P0 · Web MFA enrollment: QR code, recovery codes, and signing out other sessions

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** MFA_ENCRYPTION_KEY set. The user is signed in on Chrome and on the phone. Google Authenticator, Microsoft Authenticator, Authy and 1Password are available.

**Steps:**

1. Web /settings > Security > 'Authenticator protection', which shows 'Off — enable it when you are ready.'
2. Enter the current password and click 'Set up authenticator'.
3. Check the QR code, logo, setup key and 'Setup expires in 10 minutes'. Scan with each authenticator and check the issuer 'Ujimora' and the label 'Ujimora:<email>'.
4. Enter the 6-digit code (also try pasting it) and click 'Confirm and enable MFA'.
5. Click 'Copy recovery codes' and paste the result. Click 'Download recovery codes' and open ujimora-recovery-codes.txt. Click 'I have saved my codes'.
6. Use the phone session. In admin, open the Audit log.

**Expect:** 10 codes are shown, each 8 groups of 4 hex characters. Copy and download contain exactly those codes. Status shows 'Enabled · 10 recovery codes remaining' and the message says other sessions have been signed out. Chrome stays signed in (replaceTokens). The phone is signed out. The audit log has an 'mfa.enabled' entry with no secret, code or QR data.

**Needs:** MFA_ENCRYPTION_KEY, authenticator apps

**Source:** `packages/ui/src/components/MfaSettings.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`

## AUTH-54 · P0 · MFA sign-in with a TOTP code, including replay protection and clock tolerance

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** An account with MFA enabled.

**Steps:**

1. Web /login: enter the email and password and click Sign In.
2. Enter the current code and click Sign In.
3. Sign out and immediately sign in again with the SAME code, in the same 30-second window.
4. Wait for the next code and sign in.
5. Sign in with the code from the previous 30-second window, then with one from 2 or more windows ago.
6. Repeat the flow on admin and on native (check iOS one-time-code autofill).

**Expect:** Step 1 shows the 6-box input with 'Enter a valid authenticator code or an unused recovery code.' and issues no tokens. The valid code signs in. Reusing the same code is rejected (lastCounter). The next code works. The previous window is accepted and 2 or more windows back is rejected. Admin and native behave the same.

**Needs:** Authenticator app

**Source:** `apps/api/src/application/services/Totp.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/web/src/components/auth/LoginForm.tsx`, `apps/admin/src/pages/LoginPage.tsx`, `apps/mobile/app/(auth)/login.tsx`, `packages/ui/src/components/OtpInput.tsx`

## AUTH-55 · P0 · MFA sign-in with a recovery code: single use, format tolerance, account binding

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** An MFA account with saved recovery codes. A second MFA account.

**Steps:**

1. At login, click 'Use a recovery code' and enter code 1 exactly as shown.
2. Sign out and use code 1 again.
3. Enter code 2 in uppercase, without dashes, and with spaces.
4. Enter one of the second account's recovery codes.
5. Check Settings status.

**Expect:** Code 1 works once and then fails. Code 2 works in the uppercase, no-dash and spaced forms, because matching ignores case, spaces and dashes. The other account's code fails. Status shows 8 recovery codes remaining.

**Needs:** None

**Source:** `apps/api/src/application/services/Totp.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/web/src/components/auth/LoginForm.tsx`

## AUTH-59 · P0 · Admin MFA works, and every production admin is enrolled before launch

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** All production admin accounts.

**Steps:**

1. Admin console Settings: enroll MFA through 'Authenticator protection'. Also check the Profile > Security tab 'Account Protection' card.
2. Sign out and sign in with a TOTP, then with a recovery code.
3. List every admin-role user and confirm each has MFA enabled, with recovery codes stored in the company vault.
4. Confirm each admin password is unique and not shared.

**Expect:** Enrollment works from both admin screens and sign-in requires the code. The code makes MFA optional for admins too, with no enforcement, so launch sign-off requires 100% admin enrollment as an operational control. Any admin without MFA blocks launch.

**Needs:** Authenticator apps

**Source:** `apps/admin/src/pages/SettingsPage.tsx`, `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/admin/src/pages/LoginPage.tsx`, `docs/compliance/STAFF_ACCESS.md`

## AUTH-63 · P0 · Enable biometric unlock on iOS (Face ID or Touch ID) and Android (fingerprint or face)

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Signed release builds. Devices with biometrics enrolled, plus one device with none enrolled.

**Steps:**

1. Native Settings: find the biometric section, labelled 'Face ID', 'Fingerprint unlock' or 'Face or fingerprint unlock'.
2. Turn on the switch. On iOS, accept the system Face ID permission and the 'Enable biometric unlock for Ujimora' prompt. On Android, complete BiometricPrompt.
3. On iOS, check the permission alert text.
4. On the device with no biometrics, open the same section.
5. Repeat the toggle and deny or cancel the prompt.

**Expect:** The switch turns on with 'Biometric unlock enabled on this device.', 'Enabled on this device' and a 'Lock now' button. The iOS permission alert shows 'Use Face ID to unlock your Ujimora account when you enable biometric protection.'; a missing purpose string would cause App Store rejection. The device with no biometrics shows 'Supported enrolled biometrics are unavailable…' and no switch. A cancelled prompt leaves the switch off and shows an error.

**Needs:** Physical iOS and Android devices (simulators cannot prove hardware access control)

**Source:** `apps/mobile/src/components/BiometricSettings.tsx`, `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/lib/session.ts`, `apps/mobile/app.json`

## AUTH-64 · P0 · Privacy cover in the app switcher, and lock and unlock on resume

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Biometric unlock on. The user is on the Wallet or Settings screen with a half-filled form.

**Steps:**

1. Swipe up to the app switcher (iOS) or open Recents (Android) and look at the Ujimora snapshot.
2. Go to the home screen and return to Ujimora.
3. Tap 'Unlock with biometrics' and authenticate.
4. Turn on VoiceOver or TalkBack while the app is locked and swipe through the elements.
5. Repeat step 1 with biometric unlock OFF.

**Expect:** The snapshot shows the 'Ujimora is locked' cover and no balances or personal data. On return the lock screen appears. After unlocking, the same screen and form state come back. The screen reader cannot reach any hidden content. With biometric off, the snapshot shows the real screen, which is by design; note it.

**Needs:** Physical devices

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/lib/session.ts`

## AUTH-65 · P0 · Unlock failures fall back safely: cancel, offline, revoked on the server

*Surfaces:* android, api, ios  ·  *Type:* recovery/idempotency

**Before:** Biometric unlock on and the app locked.

**Steps:**

1. Tap Unlock and cancel the system prompt.
2. Turn on airplane mode, tap Unlock, and authenticate.
3. Turn airplane mode off and tap Unlock again.
4. Lock the app, change the password on the web, then tap Unlock on the phone.
5. Tap 'Sign in with password instead'.

**Expect:** Cancelling shows 'Could not unlock. Try again, or sign in with your password and authenticator if enabled.' and the app stays locked. Offline, an error appears within 15 seconds ('Unlock could not reach Ujimora…') and the app stays locked. Online, unlock succeeds. After the web password change, unlock fails because the refresh returns 401, and the app stays locked. Password fallback goes to the login screen and clears the biometric setting.

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/lib/biometricVault.ts`

## AUTH-73 · P0 · Web account-agreement re-acceptance banner and page

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** An account whose legalAcceptance.version is not 2026-09-12 (set in the DB, or an account from before 12 Sept).

**Steps:**

1. Sign in and look at the top of pages.
2. Click 'Review' in the banner, which opens /account-agreement.
3. Click each policy card (Terms of Use, Acceptable Use, Privacy Notice, Account deletion).
4. Check that 'Save agreement' is disabled until both boxes are ticked, then save.
5. Reload and browse. Call POST /api/v1/profile/legal-acceptance again with the same body and compare acceptedAt in the DB.
6. Sign out and open /account-agreement.

**Expect:** The banner reads 'Please review the account agreement before publishing or uploading content.'. Cards open in a new tab. After saving, the page shows 'You’re up to date' and 'Your agreement has been saved.', and the banner is gone even after reload. The repeat POST returns 200 and leaves acceptedAt unchanged. Signed out, the page shows 'Sign in to continue'.

**Needs:** DB write access to set the old version

**Source:** `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/web/src/components/layout/Layout.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `packages/types/src/legal-acceptance.ts`

## AUTH-74 · P0 · Publishing is blocked (428) without the current agreement; money and privacy actions are not

*Surfaces:* api, ios, web  ·  *Type:* compliance

**Before:** An account with an outdated acceptance, plus an admin account.

**Steps:**

1. Try to create or submit a campaign, upload an avatar, post a comment, change the profile name, and start a live session.
2. Try: view the wallet, request a withdrawal or payout, submit a data-rights request, upload a KYC document (folder=kyc), switch tipsEnabled off, and delete the account (on a spare account).
3. As the admin, perform a content action with an outdated acceptance.
4. Accept the agreement and retry the blocked actions.

**Expect:** Each publish or upload returns 428 'Review the current account agreement and confirm you are at least 18 before publishing or uploading content', and the UI shows it. Every item in step 2 succeeds, because funds, privacy and deletion are never gated. The admin is exempt. After acceptance all actions succeed.

**Needs:** Cloudinary (uploads), LiveKit (live start)

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`

## AUTH-78 · P0 · Store reviewer demo account is ready on production

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Final signed iOS and Android builds pointed at the production API.

**Steps:**

1. Create the reviewer account on production as an ordinary member: email verified, MFA off, biometric off, current agreement version, with sample data.
2. Sign in on both signed builds from a non-Ghana network (VPN to the US).
3. Walk through the review path: browse, Settings, Delete account visibility, and the subscription (IAP) screen.
4. Fill in the '<reviewer email>' and '<password>' placeholders in APP_REVIEW_NOTES.md and the store consoles.

**Expect:** Sign-in works first time with no MFA prompt and no agreement banner. The account has no staff role. Rate limits and geography do not block the reviewer. The notes are complete. A failed reviewer login means App Review rejection.

**Needs:** App Store Connect, Google Play Console, production API

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`

## AUTH-06 · P1 · Duplicate email, double submit and concurrent registration create exactly one account

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A test email not yet registered.

**Steps:**

1. Register Test.Dup@example.com on the web.
2. Signed out, try to register test.dup@EXAMPLE.com again.
3. On a new email, double-click 'Create account' quickly on the Plan step.
4. From a terminal, fire two identical POST /auth/register requests for another new email at the same moment (e.g. 'curl ... & curl ... &').
5. Check the users and wallets collections.

**Expect:** Step 2 returns 409, and the web shows 'Email already registered' on the Contact step with the fields kept. Step 3 sends one request, because the button shows 'Creating…' and is disabled. Step 4 should give one 201 and one 409. If the second returns 500 'Internal server error' (the unique-index race is not mapped to 409), file a bug. There is exactly one user and one GHS wallet per email.

**Needs:** DB read access

**Source:** `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/database/models/UserModel.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`, `apps/web/src/components/auth/RegisterForm.tsx`

## AUTH-08 · P1 · Organization wizard validation, including a dangerous website value

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Signed out.

**Steps:**

1. Web Organization step: click Continue with an empty name, then with a name but no type.
2. Enter the website 'example.org' and click Continue. Then type https://example.org and check whether 'Does your organization need a website?' is visible. Clear the website field and check again.
3. API: POST /auth/register with role 'organization' and no organizationName or organizationType.
4. API: a valid organization body with website 'javascript:alert(document.cookie)'.
5. Native Register: choose Organization and enter the website 'example.org' (no scheme). Tap Create Account.
6. API: an individual body (no role) with needsWebsite:true.

**Expect:** The web shows 'Organization name is required', 'Select an organization type' and 'Enter a full URL (https://…)'. The needs-website checkbox shows only while the website is blank, and typing a website unchecks it. The API returns 400 with organizationName and organizationType errors. The javascript: website should be rejected with 400. The register schema uses only z.url(), while the organization-team edit route requires http(s), so file a bug if it is accepted. Native: currently expect the generic 'Validation failed' (no client URL check), so log a UX bug. The individual account is stored with needsWebsite false.

**Needs:** None

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/mobile/app/(auth)/register.tsx`

## AUTH-09 · P1 · Website-contact consent (Neurodyne) is recorded, shown and withdrawable

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** A new organization registration with the website left blank. Admin account.

**Steps:**

1. Register an organization, leave Website blank, tick 'Does your organization need a website?' and finish signup.
2. Check the banner at the top of pages. In admin, open the user's detail page.
3. Click 'Withdraw website request'.
4. Reload the page, and re-check admin.
5. Call POST /api/v1/profile/website-request/withdraw again and compare websiteRequestWithdrawnAt.
6. Sign in as the same organization on the native app. Also sign in as an individual on web.

**Expect:** After signup the banner says 'Your website request is saved' and mentions Neurodyne Corp Ltd, neurodyne.dev and info@neurodyne.dev. Admin shows 'Website requested — Neurodyne Corp Ltd follow-up'. Withdrawing shows a success alert, the banner stays gone after reload, and admin shows 'Not requested'. Repeating the withdraw returns 200 and keeps the original timestamp. Native shows the same banner and withdraw path. Individuals never see the banner.

**Needs:** None

**Source:** `apps/web/src/components/auth/WebsiteRequestNotice.tsx`, `apps/mobile/src/components/WebsiteRequestNotice.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/admin/src/pages/UserDetailPage.tsx`

## AUTH-11 · P1 · Web signup with a paid plan hands off to Paystack, and a checkout failure does not lose the account

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Paystack TEST keys on staging. Plans seeded. Fresh emails.

**Steps:**

1. On /register, complete the details. On Plan, toggle Monthly or 'Yearly · save', note the GHS price shown for Starter, select Starter, and click 'Create account & continue'.
2. Confirm the Paystack checkout amount and currency match the price shown. Pay with a Paystack test card.
3. Confirm the return to /subscription/callback and the plan status.
4. Repeat with a new email, but close the Paystack page without paying, and sign in.
5. Repeat on a staging copy with the Paystack keys unset (or block POST to the subscription checkout).

**Expect:** The account is created before checkout. The Paystack amount equals the plan price exactly in GHS with no rounding drift. After payment the subscription is active. An abandoned checkout leaves a signed-in account on Free that can upgrade later from /subscription. A checkout error goes to /subscription?tier=…&billingCycle=…&checkoutError=1, still signed in, with no second account created on retry.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/lib/subscriptions.ts`

## AUTH-12 · P1 · Referral code capture from a ?ref= link and attribution to the affiliate

*Surfaces:* api, marketing, web  ·  *Type:* functional

**Before:** Affiliate A is active with code 'kofi-media' (check /affiliate). Incognito window.

**Steps:**

1. Open the referral link from A's Affiliate dashboard (format https://app.ujimora.com?ref=kofi-media), then go to /register.
2. Confirm the 'Referral code (optional)' field is prefilled. Complete signup.
3. In DevTools > Application, check that localStorage 'uf_ref' was removed.
4. As A, open /affiliate > Referrals.
5. On another device that never saw the link, register with the code typed by hand as 'KOFI-MEDIA'.
6. In a new incognito window, open https://ujimora.com/?ref=kofi-media (marketing), click 'Get started' and complete signup.

**Expect:** The field is prefilled and the code is sent in lowercase. A sees both new users as pending referrals, and each referee is referred only once. uf_ref is cleared after signup. Hand-typed uppercase codes are normalized and attributed. For the marketing-site entry, the code is expected to be LOST because marketing does not forward ?ref to the app. Record the result and raise it with the affiliate owner.

**Needs:** Affiliate program enabled

**Source:** `apps/web/src/App.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `packages/types/src/referralCode.ts`

## AUTH-18 · P1 · Email verification link negatives: reuse, expiry, tampering, scanner-safety, credential change

*Surfaces:* api, email, web  ·  *Type:* negative/edge

**Before:** An unverified user with an email inbox.

**Steps:**

1. Request a link. Open it but do NOT click the button. Close the tab and wait 5 minutes (simulating an email scanner that loads pages).
2. Reopen the link, click Verify, then reopen the same link and click again.
3. Request a link, wait more than 30 minutes, then use it.
4. Edit the URL so the token is 63 characters or contains 'zz', then load it. Also refresh a valid link page after it loads.
5. Request a link, then change the password (Profile) or enable MFA, then use the old link.
6. Open a valid link while signed in as a different account.

**Expect:** Loading the page alone does not use up the token, so the first click still works. A second click shows 'This link could not be confirmed. It may have expired or been used…'. An expired link shows the same error. A malformed token or a refreshed page shows 'Open the complete link from your verification email…' without calling the API. The link issued before the credential change fails. A link opened in another account's browser verifies only the account that requested it and does not change who is signed in.

**Needs:** Resend

**Source:** `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## AUTH-19 · P1 · Verification send: cooldown, already verified, unconfigured email, auth and schema guards

*Surfaces:* api, email, web  ·  *Type:* negative/edge

**Before:** An unverified user, a verified user, and a staging copy with email unconfigured.

**Steps:**

1. Unverified user: click 'Send verification link' twice within 60 s, then once more after 70 s. Count the emails received.
2. Verified user: call POST /api/v1/email-verification with {}.
3. On the unconfigured staging copy, click 'Send verification link'.
4. Signed out: call POST /api/v1/email-verification.
5. Signed in: call POST /api/v1/email-verification with {"email":"other@example.com"}.

**Expect:** Both quick clicks show success, but only one email arrives. The request after 70 s sends a second email. The verified user gets 'Your email is already verified.'. The unconfigured copy returns 503 'Verification email is temporarily unavailable…' and the UI shows it. Signed-out returns 401. The extra-field body returns 400 because the schema is strict, and no email goes to the other address.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/web/src/components/account/ActivityAlertSettings.tsx`

## AUTH-20 · P1 · Native email verification: round trip from the app to the browser and back

*Surfaces:* android, email, ios  ·  *Type:* cross-platform

**Before:** Unverified account signed in on the phone. The mail app is on the same phone.

**Steps:**

1. Native Settings > Activity alerts: tap 'Send verification link'.
2. Open the email on the phone and tap the link.
3. Tap 'Verify email address' in the browser.
4. Switch back to the app and tap 'Check verification status'.

**Expect:** The link opens in Safari or Chrome at app.ujimora.com/verify-email, not inside the app, and verification succeeds. Back in the app, the status refreshes to verified without signing in again, and the email toggles become enabled.

**Needs:** Resend, physical device

**Source:** `apps/mobile/src/components/ActivityAlertSettings.tsx`, `apps/web/src/pages/VerifyEmailPage.tsx`, `docs/compliance/ACCOUNT_EMAILS.md`

## AUTH-21 · P1 · Features gated on email verification

*Surfaces:* api, web  ·  *Type:* functional

**Before:** An unverified user. A pending organization-team invitation for that email. Payouts area tester available.

**Steps:**

1. Unverified: try to switch on an activity 'Email' switch. Also call PUT /api/v1/profile/activity-alerts with channel 'email', enabled true.
2. Unverified: accept the organization invitation from /invitations or the organization-team flow.
3. Coordinate with the payouts testers: an unverified campaign owner with KYC level 2 or higher reaches an automatic payout.
4. Verify the email and repeat each step.

**Expect:** Before verification: the email switch is disabled and the API returns 409 'Verify your email address before enabling activity emails.'. Accepting the invitation returns 403 'Verify your email before accepting an organization invitation'. The automatic payout is diverted to manual review. After verification all three work. Because verification is only offered from Settings, confirm the prompt is visible enough to organizers before launch.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`

## AUTH-23 · P1 · Login failures give one generic message and reveal nothing about MFA

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** Accounts: normal; MFA-enabled; deleted.

**Steps:**

1. Sign in with a wrong password on a normal account.
2. Sign in with an email that has no account.
3. Sign in with a deleted account's email and its old password.
4. On the MFA-enabled account, sign in with a WRONG password.
5. Compare the response times of the first two cases in DevTools.

**Expect:** Every case shows 'Invalid email or password' (401) and no session is created. On the MFA account with a wrong password, no authenticator field appears, so MFA status is not revealed before the password is correct. Unknown-email responses may be faster than wrong-password ones (bcrypt only runs for known emails). Note this as low-risk enumeration, since register's 409 already reveals which emails exist.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/web/src/components/auth/LoginForm.tsx`, `apps/admin/src/pages/LoginPage.tsx`, `apps/mobile/app/(auth)/login.tsx`

## AUTH-25 · P1 · Native login on iOS and Android, with password-manager autofill

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Release or preview build against staging. A saved credential in iCloud Keychain, Google Password Manager or 1Password.

**Steps:**

1. Profile tab > Sign in. Use the eye icon to show and hide the password.
2. Fill the fields from the keyboard's password-manager suggestion and tap 'Sign In'.
3. Force-quit and relaunch the app within 60 minutes.

**Expect:** Sign In stays disabled until both fields are filled. Autofill works because the fields declare email and current-password autocomplete. The app routes to the (tabs) home. After relaunch the user is still signed in.

**Needs:** Physical devices

**Source:** `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/session.ts`

## AUTH-28 · P1 · Web login page offers a 'Forgot password?' link

*Surfaces:* web  ·  *Type:* functional

**Before:** Signed out.

**Steps:**

1. Open https://app.ujimora.com/login and look for a way to reset the password.
2. Compare with the admin console /login and the native Sign in screen.

**Expect:** A visible 'Forgot password?' link to /forgot-password should appear. The source shows web LoginForm and AuthLayout have NO such link (only 'Don't have an account? Register'), while admin and native both have one. Users locked out on web would have to guess the URL. P1 bug to fix before launch.

**Needs:** None

**Source:** `apps/web/src/components/auth/LoginForm.tsx`, `apps/web/src/components/auth/AuthLayout.tsx`, `apps/admin/src/pages/LoginPage.tsx`, `apps/mobile/app/(auth)/login.tsx`

## AUTH-31 · P1 · Admin sign out

*Surfaces:* admin  ·  *Type:* functional

**Before:** Admin signed in.

**Steps:**

1. Click the Sidebar sign-out icon (tooltip 'Sign out').
2. Sign in again. Open the TopBar account menu and choose 'Sign out — End this admin session on this device.'
3. Open https://admin.ujimora.com/users.

**Expect:** Both controls return to /login. The keys uf_admin_tokens, uf_admin_user, uf_admin_token and uf_admin_last_activity are cleared. /users redirects to /login.

**Needs:** None

**Source:** `apps/admin/src/components/layout/Sidebar.tsx`, `apps/admin/src/components/layout/TopBar.tsx`, `apps/admin/src/context/AuthContext.tsx`

## AUTH-32 · P1 · A refresh token copied before logout keeps working (no server-side logout)

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Signed in on web. curl available.

**Steps:**

1. In DevTools, copy uf_tokens.refreshToken from Local Storage.
2. Sign out from the account menu.
3. Call POST /api/v1/auth/refresh with {"refreshToken":"<copied>"}.
4. Sign in again, change the password, then call refresh again with the copied token.

**Expect:** Current design: step 3 returns 200 with a new token pair. JWTs are stateless, there is no logout endpoint, refresh tokens are not rotated, and they last 7 days. Step 4 returns 401 because authVersion changed. Record this as a known risk for the owner to accept, or add server-side logout / 'sign out everywhere' before launch. Tokens live in localStorage and there is no CSP, so an XSS bug would expose them.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/application/services/AuthTokenService.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/vercel.json`

## AUTH-34 · P1 · Forgot-password: no account enumeration, and the 60-second cooldown

*Surfaces:* api, email, web  ·  *Type:* security/permission

**Before:** One registered email and one unregistered email.

**Steps:**

1. Submit /forgot-password for the unregistered email and note the response time.
2. Submit for the registered email and note the time.
3. Submit twice more for the registered email within 60 seconds.
4. Wait 70 seconds and submit again.
5. Open the two emails received.

**Expect:** Both addresses show the identical 'Check your email' screen with 200 responses, each taking at least about 500 ms. Only one email arrives for the burst within 60 s. A second email arrives after the cooldown. Both links work until one is used (see AUTH-35).

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## AUTH-35 · P1 · Reset link negatives: reuse, expiry, superseded link, credential change, refresh, validation

*Surfaces:* api, email, web  ·  *Type:* negative/edge

**Before:** Registered user with email access.

**Steps:**

1. Use a reset link successfully, then open it again and submit.
2. Request a link and use it after more than 30 minutes.
3. Request link L1, wait 70 s, request link L2. Use L2, then try L1.
4. Request a link, then enable MFA or change the password from Settings, then use the link.
5. Open a valid link and refresh the page.
6. On a valid link, enter a 7-character password, then mismatched passwords.

**Expect:** Reuse, expiry, superseded L1 and the post-change link all show 'The password could not be reset. The link may have expired or been used. Try again or request a new link.' with a 'Request a new link' button. Refreshing shows 'Open the complete link from your reset email…'. Validation shows 'Use between 8 and 128 characters.' and 'Your passwords do not match.'. The password never changes in a failed case.

**Needs:** Resend

**Source:** `apps/web/src/pages/ResetPasswordPage.tsx`, `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`

## AUTH-36 · P1 · Password recovery reports clearly when email is unavailable or rate-limited

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** A staging copy with AUTH_EMAIL_ENCRYPTION_KEY_BASE64 unset (or PUBLIC_WEB_URL on http).

**Steps:**

1. Web /forgot-password: submit any email.
2. Native Forgot password screen: submit.
3. Admin /forgot-password: submit.
4. On a configured environment, trip the auth rate limit (AUTH-77), then submit the web forgot form.

**Expect:** The API returns 503 for every address. Web and native show 'Password recovery is temporarily unavailable. Please try again later.'. Admin shows the API message '…Please try again later or contact support.'. No screen claims an email was sent. With a 429, web and native also show 'temporarily unavailable', which is misleading; note it as a low-priority UX issue.

**Needs:** Staging environment

**Source:** `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/mobile/app/forgot-password.tsx`, `apps/admin/src/pages/ForgotPasswordPage.tsx`

## AUTH-37 · P1 · Native forgot password: the reset link opens the browser and the user returns to the app

*Surfaces:* android, email, ios  ·  *Type:* cross-platform

**Before:** Email configured. Mail app on the phone.

**Steps:**

1. Native login: tap 'Forgot password?', enter the email and submit.
2. Open the email on the phone and tap the link.
3. Reset the password in the browser.
4. Return to the app and sign in with the new password.

**Expect:** The app shows 'Request received' and 'Check your email for a reset link'. The link opens https://app.ujimora.com/reset-password in Safari or Chrome, not the app and not a 'Page not found' screen. Reset succeeds and native sign-in with the new password works.

**Needs:** Resend, physical device

**Source:** `apps/mobile/app/forgot-password.tsx`, `apps/mobile/app.json`, `apps/mobile/src/navigation/resolvePath.ts`

## AUTH-38 · P1 · Admin forgot password completes on the member web app

*Surfaces:* admin, email, web  ·  *Type:* cross-platform

**Before:** An admin account with email access.

**Steps:**

1. On admin.ujimora.com/login, click 'Forgot password?' and submit the admin email.
2. Open the email link.
3. Reset the password, then sign in at admin.ujimora.com with the new password.

**Expect:** The link goes to https://app.ujimora.com/reset-password; the admin console has no reset route. Reset succeeds. Admin sign-in works with the new password, and the MFA code is still required if MFA is enabled. The admin 'Use a different email' button resets the form.

**Needs:** Resend

**Source:** `apps/admin/src/pages/ForgotPasswordPage.tsx`, `apps/admin/src/router.tsx`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

## AUTH-40 · P1 · Web change password: the initiating session should stay signed in and all others should end

*Surfaces:* api, email, ios, web  ·  *Type:* functional

**Before:** User signed in on Chrome (initiating), Firefox and the phone.

**Steps:**

1. Chrome: open /profile > change password, enter the current password, the new one and the confirmation, and save.
2. Wait for the success snackbar, then navigate to /settings and /wallet and let background polling run for 30 s.
3. Use Firefox and the phone.
4. Check the inbox.

**Expect:** Per the API contract, PUT /auth/change-password returns fresh tokens in data.tokens, so Chrome should stay signed in. Firefox and the phone get 401 and are signed out, and a 'Your Ujimora password changed' email arrives. Source note: web ProfilePage, admin AdminProfilePage and mobile profile/edit all ignore the returned tokens. Chrome will probably show success and then 'Your session has expired' on its next request. Log this as a P1 bug, or confirm with product that forced re-login is intended.

**Needs:** Resend

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`, `apps/api/__tests__/integration/auth.integration.test.ts`

## AUTH-42 · P1 · Native change password, including with biometric unlock on

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Signed in on the phone, once with biometric unlock off and once with it on.

**Steps:**

1. Profile > Edit profile > Change password: enter the current password and a new password twice. Check the button is disabled until the new password has 8+ characters, then tap 'Update password'.
2. Navigate to Wallet and Settings.
3. With biometric on: after the change, background the app, return, and tap 'Unlock with biometrics'.

**Expect:** The app shows 'Password updated'. Expected: the device stays signed in. Likely actual: the next request 401s, the forced refresh fails, and the user is signed out, because the returned tokens are discarded (see AUTH-40). With biometric on, unlock fails cleanly with 'Could not unlock…', and 'Sign in with password instead' works with the new password. The app must not loop or crash.

**Needs:** Physical device

**Source:** `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/session.ts`

## AUTH-45 · P1 · 60-minute idle timeout on web and admin

*Surfaces:* admin, web  ·  *Type:* security/permission

**Before:** Signed in. To speed up the test, set localStorage uf_last_activity (web) or uf_admin_last_activity (admin) to Date.now() minus 3,700,000.

**Steps:**

1. Leave the tab completely idle for 61 minutes (or use the shortcut), then focus the tab or click.
2. On web, check the protected page. On admin, check the URL.
3. Repeat, but interact at the 50-minute mark.

**Expect:** After more than 60 minutes idle, web shows 'Your session has expired — Sign in again to securely continue…' and the tokens are removed. Admin redirects to /login. With activity at 50 minutes the session continues.

**Needs:** None

**Source:** `packages/ui/src/browserSession.ts`, `apps/web/src/components/auth/RequireAuth.tsx`, `apps/admin/src/lib/session.ts`

## AUTH-46 · P1 · Native idle expiry and offline cold start

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Signed in with biometric unlock off.

**Steps:**

1. Use the app, then background it for 30 minutes and return.
2. Background it for more than 61 minutes and return (or force-quit and relaunch after 61 minutes).
3. With a fresh session, force-quit, turn on airplane mode and relaunch.
4. Turn airplane mode off and pull to refresh.

**Expect:** After 30 minutes the user is still signed in. After more than 60 minutes idle the user is signed out; with biometric on, the app locks instead. Offline cold start keeps the session and shows network errors, not a logout. Reconnecting recovers without signing in again.

**Needs:** Physical device

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/context/AuthContext.tsx`

## AUTH-47 · P1 · Refresh endpoint negatives and a corrupted client refresh token

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** curl. A signed-in web session.

**Steps:**

1. POST /api/v1/auth/refresh with body {}.
2. POST with an ACCESS token as refreshToken.
3. POST with a refresh token whose signature has one character changed.
4. POST with a refresh token belonging to a deleted account.
5. On web, edit uf_tokens.refreshToken to garbage, set uf_tokens.accessToken to an expired token, and click around.

**Expect:** Empty body returns 400. Access token as refresh, bad signature and deleted account all return 401 ('Invalid or expired refresh token' or 'Account is no longer available'). The web shows the session-expired prompt once, with no infinite refresh loop and no console flood.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/application/services/AuthTokenService.ts`, `packages/ui/src/browserSession.ts`

## AUTH-50 · P1 · Account deletion ends every session and frees the email

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** User D signed in on web and on a phone with biometric unlock on. D has MFA enabled. D's tokens are captured.

**Steps:**

1. Web /settings > Danger zone > 'Delete account' > 'Delete my account'.
2. Use D's old access and refresh tokens against the API.
3. On the phone, make a request, or background the app and try to unlock.
4. Try to sign in as D.
5. After the erasure sweep, register again with D's email.

**Expect:** The web signs out and goes to '/'. The old tokens get 401 'Account is no longer available'. The phone is signed out and unlock fails, leaving password sign-in only. Sign-in shows 'Invalid email or password'. Re-registration creates a brand-new empty account with no old wallet, campaigns or MFA; D's MFA record is gone. If cleanup is still pending, re-registration may return 500, so log it.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/web/src/pages/SettingsPage.tsx`

## AUTH-51 · P1 · Token and HTTP hardening: tampered JWTs, cache headers, CORS, framing

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** curl and a JWT tool.

**Steps:**

1. Decode a member access token, change role to 'admin', re-sign it with a random key, and call GET /api/v1/users.
2. Send a token with alg 'none'. Send an expired access token.
3. Check the Cache-Control header on /auth/login, /auth/mfa and /email-verification responses.
4. Send a request with 'Origin: https://evil.example' and check the Access-Control-Allow-Origin header.
5. Check whether app.ujimora.com/login and admin.ujimora.com/login send X-Frame-Options or a CSP frame-ancestors directive.

**Expect:** Tampered, alg-none and expired tokens all get 401. The auth routes send 'Cache-Control: private, no-store'. The evil origin gets no Access-Control-Allow-Origin. Neither vercel.json sets any framing or CSP header, so the login pages can be framed (clickjacking); log this as a hardening item.

**Needs:** None

**Source:** `apps/api/src/application/services/AuthTokenService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/app.ts`, `apps/web/vercel.json`, `apps/admin/vercel.json`

## AUTH-53 · P1 · MFA enrollment negatives

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** A user without MFA.

**Steps:**

1. Click 'Set up authenticator' with a wrong password.
2. Start setup and enter a wrong 6-digit code.
3. Start setup, wait 11 minutes, then confirm with a valid code.
4. Start setup and click 'Cancel setup'. Then sign out and sign in.
5. Start setup in tab A, start it again in tab B, then confirm in tab A using tab A's QR code.
6. After enabling MFA, call POST /api/v1/auth/mfa/setup again.

**Expect:** A wrong password shows 'Current password is incorrect.' and the user stays signed in (the route turns 401 into 400). A wrong code shows 'Enter a valid authenticator code or an unused recovery code.' and setup stays open. An expired setup shows 'Setup expired or changed. Start authenticator setup again.'. Cancelling leaves MFA off and login asks for no code. Confirming the superseded setup returns 409. Setup when already enabled returns 409 'Authenticator protection is already enabled.'. The confirm button stays disabled until 6 digits are entered.

**Needs:** MFA_ENCRYPTION_KEY

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`, `packages/ui/src/components/MfaSettings.tsx`

## AUTH-56 · P1 · MFA attempt limit: 10 attempts per 10 minutes per account

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** An MFA account. Tests run from 2 IPs so the IP limit (30 per 15 minutes) does not trip first.

**Steps:**

1. Enter the correct password and a wrong code 10 times.
2. On the 11th attempt, use a CORRECT code.
3. From another IP, try disabling MFA in Settings with a correct code within the same window.
4. Wait 10 minutes and sign in with a correct code.

**Expect:** The 11th attempt returns 429 'Too many code attempts. Try again in 10 minutes.' even with the correct code. The limit is per account, so it also blocks Settings actions from the other IP. After 10 minutes sign-in works. Note that anyone who knows the password can lock the real user out for 10 minutes; confirm this is acceptable.

**Needs:** Two networks

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`

## AUTH-57 · P1 · Replace recovery codes

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** MFA enabled with 10 codes saved. A second session open on another device.

**Steps:**

1. In Settings, enter the current password and a current TOTP, then click 'Replace recovery codes'.
2. Sign out and try an OLD recovery code.
3. Try a NEW code.
4. Try replacing with a wrong TOTP.
5. Check the second device and the admin Audit log.

**Expect:** 10 new codes are shown and old codes are rejected. New codes work. A wrong TOTP shows an error and the codes are unchanged. The other device is signed out while the current tab stays signed in. The audit log has an 'mfa.recovery-regenerated' entry.

**Needs:** Authenticator app

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `packages/ui/src/components/MfaSettings.tsx`

## AUTH-58 · P1 · Disable MFA with a TOTP or recovery code

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** MFA enabled.

**Steps:**

1. Try 'Disable authenticator' with a wrong password.
2. Disable with the password and a current TOTP.
3. Sign out and sign in again.
4. Re-enable MFA, then disable it using a recovery code.
5. Check the Audit log.

**Expect:** A wrong password shows an error and MFA stays enabled. A successful disable shows 'Authenticator protection disabled. Other sessions have been signed out.' and status 'Off'. Sign-in then asks only for email and password. Disabling with a recovery code also works. The audit log has 'mfa.disabled' entries.

**Needs:** Authenticator app

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `packages/ui/src/components/MfaSettings.tsx`

## AUTH-60 · P1 · Native MFA enrollment on the same phone, and saving recovery codes

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** MFA off. An authenticator app installed on the same phone.

**Steps:**

1. Native Settings > Authenticator protection: enter the current password and tap 'Set up authenticator'.
2. Tap 'Copy setup key', paste it into the authenticator app (manual time-based entry), and return to the app.
3. Enter the code and tap 'Confirm and enable MFA'.
4. Tap 'Copy recovery codes' and paste the result into Notes. Tap 'Download recovery codes' and save through the share sheet to Files or Drive, then open the file.
5. Start 'Download recovery codes' again, force-quit while the share sheet is open, then relaunch.
6. Sign out and sign in with the TOTP (try iOS one-time-code autofill) and with a recovery code.

**Expect:** The setup key works where scanning is impossible. The codes are shown with 'Save these private codes now…'. The copied text and the saved file match exactly. The temporary file is deleted after the share sheet closes, and any leftover file from the interrupted run is cleaned up at the next launch. Native sign-in works through both routes.

**Needs:** Physical device, authenticator app

**Source:** `apps/mobile/src/components/MfaSettings.tsx`, `apps/mobile/src/lib/recoveryCodes.ts`, `apps/mobile/app/_layout.tsx`

## AUTH-61 · P1 · A misconfigured MFA key never downgrades an account to password-only

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging. A user with MFA enabled and a saved recovery code.

**Steps:**

1. Unset MFA_ENCRYPTION_KEY and restart the API.
2. Open Settings > Security.
3. Sign in with the password and a TOTP.
4. Sign in with the password and a recovery code.
5. Restore the key, restart, and sign in with a TOTP.
6. Optionally set a DIFFERENT valid key and sign in with a TOTP.

**Expect:** Settings shows 'Authenticator setup is temporarily unavailable.'. TOTP sign-in returns 503 and issues no session; the account is never downgraded to password-only. The recovery code still signs in. After restoring the key, TOTP works. A changed key breaks every existing enrollment (error on decrypt), which is why the key must be stable and backed up (see AUTH-01).

**Needs:** Staging env control

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/api/src/application/services/Totp.ts`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## AUTH-62 · P1 · Support runbook for a user who lost the authenticator and every recovery code

*Surfaces:* api, email  ·  *Type:* compliance

**Before:** Support staff and the owner.

**Steps:**

1. Simulate the user: sign in with the password and no factor, then try a password reset.
2. Email support@ujimora.com asking for help.
3. Walk through the documented manual recovery: identity verification, then removal of the Mfa row by an authorized operator, with an audit record.

**Expect:** No self-service bypass exists: a password reset still requires the factor. A written runbook exists covering identity-proofing steps, who is allowed to act, the audit trail and user notification. Staff can carry it out without touching unrelated data. Missing runbook blocks launch readiness for support.

**Needs:** Support mailbox

**Source:** `docs/compliance/MFA_AND_BIOMETRICS.md`, `apps/api/src/infrastructure/database/models/MfaModel.ts`

## AUTH-66 · P1 · Changes to the device's biometric enrollment invalidate the vault

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Biometric unlock on.

**Steps:**

1. iOS: in Settings > Face ID, add an Alternate Appearance or reset Face ID. Android: add a new fingerprint.
2. Return to Ujimora and tap Unlock.
3. Sign in with the password, then check the biometric setting.
4. Separately, remove every biometric (or the device passcode) and reopen the app.

**Expect:** Unlock fails with a message such as 'Biometric access changed or expired. Sign in with your password instead.' or 'Biometrics are unavailable or changed…'. A newly enrolled finger or face can never unlock the old vault. Password sign-in works and biometric unlock is off until re-enabled.

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/biometricVault.ts`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## AUTH-67 · P1 · Cold start while locked, and deep links while locked

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Biometric unlock on.

**Steps:**

1. Force-quit and relaunch. Watch the first frames (screen-record if possible).
2. While locked, open ujimora://campaigns/<id> from Notes.
3. Unlock.

**Expect:** The lock screen shows first, with no flash of private screens or data. The deep link does not open private content while locked. After unlocking, navigation is sane and no stale launch link is replayed in a way that leaks another screen.

**Needs:** Physical devices

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/session.ts`, `apps/mobile/app/_layout.tsx`

## AUTH-68 · P1 · Lock now, turning biometrics off, and switching accounts

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** User A with biometric unlock on. User B also exists.

**Steps:**

1. Tap 'Lock now', then unlock.
2. Turn off the biometric switch and authenticate the prompt.
3. Background and return.
4. Turn biometrics back on, sign out, and sign in as user B.
5. As B, open Settings and background the app. Sign back in as A and check the setting.

**Expect:** Lock now locks immediately. Turning it off shows 'Biometric unlock disabled on this device.' and backgrounding no longer locks. B sees 'Off' and no lock screen. A also sees 'Off' after signing out and back in; the setting is never inherited across accounts or sign-outs.

**Needs:** Physical devices

**Source:** `apps/mobile/src/components/BiometricSettings.tsx`, `apps/mobile/src/lib/session.ts`

## AUTH-69 · P1 · Credential changes made while biometric unlock is on

*Surfaces:* android, ios, web  ·  *Type:* recovery/idempotency

**Before:** Biometric unlock on. MFA off.

**Steps:**

1. On the phone, enable MFA in Settings. Accept any biometric prompt.
2. Background the app, return, and unlock.
3. Disable MFA on the phone, but CANCEL the biometric prompt this time. Read the message.
4. Background, return, and unlock.
5. Enable MFA from the WEB while the phone is locked, then unlock on the phone.

**Expect:** Accepting the prompt updates the vault, and unlock works afterwards. Cancelling shows 'Your account protection was updated, but device sign-in could not be saved…', and the next unlock fails; password (plus MFA) sign-in works. A change made on the web makes the phone unlock fail, leaving password plus code as the route. Credentials are never silently written to ordinary storage.

**Needs:** Physical devices, authenticator app

**Source:** `apps/mobile/src/components/MfaSettings.tsx`, `apps/mobile/src/lib/session.ts`, `apps/mobile/src/context/AuthContext.tsx`

## AUTH-71 · P1 · Tokens are stored in SecureStore, and the legacy AsyncStorage copy migrates

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** Best case: a device running an older internal or TestFlight build that stored tokens in AsyncStorage, signed in within the last 60 minutes. Otherwise, a debug build that can inspect storage.

**Steps:**

1. Upgrade the old build in place to the release candidate and launch it.
2. Force-quit and relaunch.
3. With a debug build, inspect AsyncStorage 'uf_tokens' and SecureStore 'uf_tokens'.
4. Repeat the upgrade with a session idle for more than 60 minutes.

**Expect:** The user stays signed in across the upgrade and the next launch. AsyncStorage no longer contains uf_tokens, and SecureStore holds them (WHEN_UNLOCKED_THIS_DEVICE_ONLY). A stale session signs out cleanly without a crash. If no older build ever shipped, record N/A for the migration and still verify that a fresh install writes no tokens to AsyncStorage.

**Needs:** Previous build (if any), debug tooling

**Source:** `apps/mobile/src/lib/session.ts`

## AUTH-75 · P1 · Native account-agreement banner and screen

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** An outdated account signed in on the phone.

**Steps:**

1. Look below the header for the banner.
2. Tap 'Review agreement' and open the Terms of Use, Acceptable Use, Privacy Notice and Delete account links.
3. Tick both boxes and tap 'Save agreement'.
4. Go back, then force-quit and relaunch.

**Expect:** The banner reads 'Review the account agreement before publishing or uploading content.'. The policy screens open in-app. Save shows 'Your agreement has been saved.'. The banner disappears immediately and stays gone after relaunch.

**Needs:** None

**Source:** `apps/mobile/src/components/AccountAgreementNotice.tsx`, `apps/mobile/app/account-agreement.tsx`

## AUTH-76 · P1 · Bumping the agreement version for users who are already signed in

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Staging. Users signed in on web and phone with the current acceptance.

**Steps:**

1. Deploy a staging build with LEGAL_ACCEPTANCE_VERSION bumped (e.g. '2026-10-01').
2. Without re-login, browse on web and on the phone.
3. Try to publish something.
4. Sign out and back in.

**Expect:** The API returns 428 on publishing right away. The banner may NOT show until re-login, because both clients use the user object cached at login. Record this. The 428 message must be enough for users to find /account-agreement. After re-login the banner shows. Log an enhancement to refresh the user or legal state on focus.

**Needs:** Staging deploy

**Source:** `packages/types/src/legal-acceptance.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/mobile/src/lib/session.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`

## AUTH-77 · P1 · Auth rate-limit behavior and lockouts

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** One IP, a script, and a test account.

**Steps:**

1. From one IP, send 30 mixed requests across POST /auth/login, /auth/forgot-password, /auth/mfa/setup and /email-verification.
2. Send a 31st request to any of those, then to /auth/register. Record the status, Retry-After and X-RateLimit-* headers.
3. Sign in on web and on native from that IP and read the message shown.
4. Call /auth/refresh 40 times from that IP.
5. Wait 15 minutes and sign in again.
6. From rotating IPs, send 100 wrong passwords to one account, then sign in with the correct password.

**Expect:** The 31st and later requests get 429 'Too many requests, please try again later' with Retry-After, and the limit is shared across all those auth endpoints. Web shows the server message or 'Too many attempts…'. /auth/refresh is not under the auth limiter (only the API limit of 300 per 15 minutes). Access returns after 15 minutes. There is no per-account password lockout, so the correct password still works after the distributed attempts. Record this and get the owner's decision; an API restart also resets the counters.

**Needs:** Multiple IPs (VPN or cloud shell)

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`

## AUTH-79 · P1 · Native guest access, sign-in gates, and no token handoff to Safari

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Fresh install, signed out.

**Steps:**

1. Browse Explore, a campaign detail page and Legal & trust without signing in.
2. Open the Profile tab, Settings, My donations and Wallet.
3. Tap 'Sign in' on a gate and complete login.
4. Signed in on iOS, tap Donate on a campaign and look at the Safari URL.
5. Confirm the app offers no third-party login buttons.

**Expect:** Public content works without an account (Apple 5.1.1). Gates show 'Sign in to view your …' with a working Sign in button. On iOS, Donate opens Safari at /c/<slug>/donate with only amount or liveSessionId query parameters and no tokens, so the user is a guest on the web unless they sign in there. No social login exists, so Sign in with Apple is not required.

**Needs:** None

**Source:** `apps/mobile/src/components/SignInRequired.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/(tabs)/profile.tsx`

## AUTH-80 · P1 · No credentials in logs, and security events in the audit log

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Test flows AUTH-03, AUTH-22, AUTH-33, AUTH-52 and AUTH-40 have been run on staging with known unique values.

**Steps:**

1. Search the Render logs for the test password, 'reset-password#token', 'verify-email#token', 'refreshToken', 'accessToken', a used 6-digit OTP and a recovery code.
2. In admin, open the Audit log and filter by the test user.
3. Look for any audit rows for successful or failed logins, including admin sign-ins.

**Expect:** None of the secrets appear in the logs. The audit log shows mfa.enabled, mfa.disabled or mfa.recovery-regenerated and auth.update (password change) with the actor and IP, and no request bodies. There are currently NO audit rows for logins (success, failure or admin); have the owner decide whether admin sign-in auditing is required before launch.

**Needs:** Render log access

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/api/src/infrastructure/logging/privacy.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `docs/compliance/LOGGING_PRIVACY.md`

## AUTH-13 · P2 · Bad referral codes never block or corrupt signup

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Affiliate B is SUSPENDED with a known code.

**Steps:**

1. Register with the code 'nosuchcode'.
2. Register with B's code.
3. Type 'admin' in the referral field and watch the helper text, then try to finish signup.
4. Type 'ab' (2 characters) and try to finish signup on web and on native.
5. Try to type 30 characters.

**Expect:** An unknown code or a suspended affiliate's code still gives a successful signup with no referral row. The reserved 'admin' shows an inline reserved-code message. Signup should either be blocked with that message or proceed without the code. A 1-2 character code currently reaches the API and gets 400 'Validation failed', which blocks account creation even though the field is optional. Neither client blocks it, so log a bug. The input stops at 24 characters.

**Needs:** Affiliate program

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/mobile/app/(auth)/register.tsx`, `packages/types/src/referralCode.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`

## AUTH-14 · P2 · Native referral deep link prefills the referral field

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** App installed and signed out. A valid affiliate code.

**Steps:**

1. From Notes or Messages on the phone, tap ujimora://register?ref=kofi-media.
2. Check the Register screen's referral field.
3. Tap https://app.ujimora.com?ref=kofi-media on the phone.

**Expect:** The app opens Register with 'kofi-media' prefilled. Source note: resolveNativePath maps /register to '/(auth)/register' and drops the query string, so this probably fails; log a bug if so. The https link opens the browser, not the app, because no universal links are configured, and the web capture flow applies.

**Needs:** None

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/app/+native-intent.tsx`, `apps/mobile/app.json`

## AUTH-15 · P2 · Signup when the plans API is down

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** Chrome DevTools request blocking.

**Steps:**

1. In DevTools, block the URL pattern '*/plans/public'.
2. Go through /register to the Plan step.
3. Click the Retry action after removing the block.

**Expect:** The Plan step shows the skeleton and then 'We couldn’t load current prices. Please retry before choosing a plan.' with Retry. 'Create account' stays disabled, so no account is created. After unblocking, Retry loads the plans and signup completes. Flag for the product owner that even Free signup depends on this endpoint.

**Needs:** None

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/hooks/useSubscription.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`

## AUTH-16 · P2 · Password rules at registration: client and server

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Signed out.

**Steps:**

1. Web: enter a 7-character password and click Continue. Then enter mismatched confirmation values.
2. Web: use a 128-character password, and a password containing spaces, emoji and non-Latin characters. Complete signup and then log in with it.
3. Native: enter 7 characters, then 8. Enter a mismatched confirmation.
4. Log in with only the first 72 bytes of a 100-byte password.

**Expect:** The web shows 'Password must be at least 8 characters' and 'Passwords do not match', and the strength meter updates. 128-character and unicode passwords work for both signup and login. Native shows the length hint and mismatch error, and Create stays disabled. Record whether the 72-byte prefix also logs in (bcrypt truncation) and document it as known behavior.

**Needs:** None

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/components/auth/PasswordStrength.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`

## AUTH-24 · P2 · Login input edge cases: email case, stray whitespace, offline, double tap

*Surfaces:* admin, android, ios, web  ·  *Type:* negative/edge

**Before:** Account user@example.com.

**Steps:**

1. Web and native: sign in as 'USER@Example.COM'.
2. Web and native: sign in as ' user@example.com ' with a trailing space (common with iOS autofill and keyboard suggestions).
3. Admin: repeat step 2.
4. Web: set DevTools to Offline and click Sign In. Native: turn on airplane mode and tap Sign In.
5. Double-click or double-tap Sign In.

**Expect:** Mixed-case email logs in. Web and native currently do NOT trim the email, and the API validator does not apply zod trim to the body, so the whitespace case probably fails with 'Validation failed'; log a UX bug. The admin console trims and succeeds. Offline, the web shows 'Unable to connect to Ujimora. Check your connection and try again.' and native shows an error without crashing. A double tap sends one request.

**Needs:** None

**Source:** `apps/web/src/components/auth/LoginForm.tsx`, `apps/mobile/app/(auth)/login.tsx`, `apps/admin/src/pages/LoginPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`, `apps/web/src/lib/api.ts`

## AUTH-41 · P2 · Change password negatives

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** Signed in.

**Steps:**

1. Enter a wrong current password.
2. Enter a 7-character new password.
3. Enter a mismatched confirmation, or leave the current password empty.
4. Enter a new password identical to the current one.

**Expect:** A wrong current password shows 'Current password is incorrect' (400) and the user STAYS signed in (400 does not trigger session expiry). Client validation catches the short password and the mismatch. Reusing the current password is accepted because there is no reuse check; note it for the owner.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`, `apps/web/src/pages/ProfilePage.tsx`, `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/mobile/app/profile/edit.tsx`

## AUTH-43 · P2 · Admin change password

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Admin signed in.

**Steps:**

1. Admin Profile: change password with valid values.
2. Click any sidebar page.

**Expect:** The snackbar shows 'Password changed successfully'. The next API call is likely to get 401, which redirects to /login with 'Your session has expired…' because the returned tokens are discarded. Sign-in with the new password (plus MFA) works. Confirm whether this is acceptable.

**Needs:** None

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/admin/src/lib/api.ts`

## AUTH-70 · P2 · Biometric unlock stops working 7 days after the last password sign-in

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** A test device with biometric unlock on, used daily. JWT TTLs are hardcoded (15m and 7d), so this is a real-time soak test.

**Steps:**

1. Sign in with the password and enable biometric unlock (day 0).
2. Open and unlock the app every day for 8 days without a password sign-in.
3. On day 8, unlock.

**Expect:** Unlock works through day 7. On day 8 it fails, because the vault keeps the refresh token from day 0 and in-session renewals are held in memory only. Password sign-in then works. Decide whether a weekly forced password login is acceptable for users; if not, file an enhancement.

**Needs:** Physical device, 8-day soak

**Source:** `apps/mobile/src/lib/session.ts`, `apps/api/src/application/services/AuthTokenService.ts`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## AUTH-72 · P2 · Device backup and restore never carries the session over

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Signed in. A spare device for restores.

**Steps:**

1. iOS: make an encrypted Finder or iCloud backup, restore it to another iPhone, and open Ujimora.
2. Android: restore from Google backup (or adb backup) to another device and open Ujimora.

**Expect:** The user must sign in again on the restored device. Tokens are this-device-only, Android allowBackup is false, and the custom backup rules exclude secure data. The user name or cached profile must not appear signed in.

**Needs:** Spare devices

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/app.json`, `apps/mobile/plugins`
