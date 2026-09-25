# Accounts & sign-in (91 cases)

Registration (individual and organization), email verification, login, password reset/change, sessions, MFA and recovery codes, native biometric lock, rate limits.

[Back to the QA plan](../README.md)

## AUTH-01 · P0 · Production auth secrets and encryption keys are configured (JWT, MFA, account-email)

*Surfaces:* api, email, web  ·  *Type:* compliance

**Before:** Access to the Render dashboard and logs for ujimora-api and to Resend. A signed-in production test account. The current render.yaml has been synced. It now declares MFA_ENCRYPTION_KEY and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 with sync:false, so the keys are listed but have no values until someone pastes them in.

**Steps:**

1. In Render > ujimora-api > Environment, confirm that JWT_SECRET and JWT_REFRESH_SECRET exist, are each at least 32 characters, and differ from each other.
2. Confirm that MFA_ENCRYPTION_KEY and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 both have values. Each should be 44 base64 characters ending in '=' that decode to 32 bytes (for example from 'openssl rand -base64 32'). They must differ from each other and from the JWT and store keys. Confirm a backup of MFA_ENCRYPTION_KEY is in the company secret manager. It must never be rotated.
3. Confirm RESEND_API_KEY is set. FROM_EMAIL must be no-reply@ujimora.com on the domain verified in Resend (SPF and DKIM green), REPLY_TO_EMAIL must be support@ujimora.com, and PUBLIC_WEB_URL must be https://app.ujimora.com (https, no query or hash). If the dashboard still shows the older info@ values, run a Blueprint sync or edit them by hand.
4. Open the Render logs for the most recent boot. Search for 'Production capabilities disabled by missing configuration' and for 'Optional production capabilities are off'.
5. Signed in on https://app.ujimora.com, open DevTools and call GET https://api.ujimora.com/api/v1/auth/mfa, then GET /api/v1/email-verification.
6. Call POST /api/v1/auth/forgot-password with {"email":"nobody@example.com"}. Then send yourself any account email (for example a verification link) and check its From and Reply-To headers.

**Expect:** All keys are present and valid. The boot log has NO 'Production capabilities disabled by missing configuration' error line. That line names the capability that is off (account email, or authenticator MFA enrollment) and the variable names it needs, never their values; if it appears, it blocks launch. A warning 'Optional production capabilities are off' that names native store billing is acceptable only if store billing is meant to be off. /auth/mfa returns available:true. /email-verification returns deliveryConfigured:true. forgot-password returns 200 with 'If that email is registered, you will receive a reset link shortly', not 503. Account emails come from no-reply@ujimora.com with Reply-To support@ujimora.com. Any 503 or available:false blocks launch.

**Needs:** Render dashboard and logs, Resend account with verified domain

**Source:** `render.yaml`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/application/services/Totp.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `DEPLOYMENT.md`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## AUTH-02 · P0 · Rate limits are per client IP (CF-Connecting-IP), and web and admin call the API origin directly

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Production, or staging behind Render's Cloudflare edge. Two clients on different public networks: A is an office Wi-Fi laptop with curl, and B is a phone or laptop on mobile data. A test account. Admin access to the Audit log.

**Steps:**

1. From network B, open https://app.ujimora.com/login with DevTools > Network open. Confirm the sign-in request goes to https://api.ujimora.com/api/v1/auth/login, not to app.ujimora.com/api/v1. Do the same on https://admin.ujimora.com/login. Submit a wrong password once on the web and note X-RateLimit-Limit and X-RateLimit-Remaining.
2. From network A, send 31 POST requests with a wrong password to https://api.ujimora.com/api/v1/auth/login (curl loop). Record the status of the 31st, its Retry-After header and its body.
3. From network A, send one more request with forged headers: 'CF-Connecting-IP: 203.0.113.9', 'X-Forwarded-For: 203.0.113.9', 'X-Real-IP: 203.0.113.9', 'X-Vercel-Forwarded-For: 203.0.113.9' and 'True-Client-IP: 203.0.113.9'.
4. Straight away from network B, sign in with the correct password.
5. From network B, make a change that is audited (for example save your profile name). In admin > Audit log, open that row and read the IP.
6. Optional, if network A has IPv6: change the interface identifier (a privacy address in the same /64) and retry. Staging only: send 31 wrong-password requests through the legacy rewrite https://<staging web>/api/v1/auth/login and note that every client using that path shares one bucket.

**Expect:** B is unaffected. Its first X-RateLimit-Limit is 30 and X-RateLimit-Remaining is 29, and its sign-in succeeds while A is throttled. A's 31st request returns 429 with a Retry-After header and {"message":"Too many requests, please try again later","status":429}. Forged client-IP headers do not free A: it still gets 429, because Cloudflare overwrites CF-Connecting-IP and the other headers are ignored. The audit row shows B's own public IP, not a Render or Vercel address. A new address in the same IPv6 /64 shares A's bucket. If the production web or admin bundle calls the relative /api/v1 path instead of api.ujimora.com, a Vercel project env var VITE_API_URL is overriding .env.production. Every browser would then share Vercel's egress bucket, which is a launch blocker. Known open issue I099: counters are in memory and per process. They reset on every restart or free-plan spin-down, so the API must stay on one instance.

**Needs:** Two public networks; admin account

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/web/.env.production`, `apps/admin/.env.production`, `apps/web/vercel.json`, `apps/api/__tests__/integration/client-ip-rate-limit.integration.test.ts`, `DEPLOYMENT.md`

## AUTH-03 · P0 · Web individual registration (Free plan): happy path, entry points and the signup verification email

*Surfaces:* api, email, marketing, web  ·  *Type:* functional

**Before:** A fresh inbox address. Signed out. /api/v1/plans/public reachable. Account email configured (AUTH-01). DB read access.

**Steps:**

1. On https://ujimora.com, click the Navbar 'Get started' CTA. Confirm it opens https://app.ujimora.com/register, not http://localhost:8200 (the fallback when VITE_WEB_APP_URL is unset).
2. Also confirm that the app Header 'Get Started' and the mobile-drawer 'Get Started' open /register.
3. Step 'Account': choose 'Individual' and click Continue.
4. Step 'Details': enter Full name, Email, a password of 10 or more characters (watch the strength meter), and the same value in Confirm password. Tick 'I agree to the Terms of Use and Acceptable Use Policy and have read the Privacy Notice.' and 'I confirm that I am at least 18 years old.' Click Continue.
5. Step 'Plan': check which plans are listed. Leave Free selected and click 'Create account'.
6. Look at /dashboard, then open /wallet and /settings. Check the inbox.
7. In the DB, look at the user and at legal_acceptance_events for that userId.

**Expect:** The Plan step lists Free, Starter and Pro only (no Enterprise). POST /auth/register returns 201. The user lands on /dashboard signed in, and the header shows the account menu with their name. The dashboard shows 'Verify your email address. Automatic payouts and organization invitations need a verified email address.' with a 'Send link' button. /wallet shows a GHS 0.00 local wallet. Settings > Notifications shows 'Verify your email address to enable activity emails'. A 'Verify your Ujimora email address' email arrives within about 1-2 minutes without any click, because signup now queues it. It comes from no-reply@ujimora.com and its link lasts 30 minutes. No account-agreement banner appears. The DB user has legalAcceptance.version '2026-09-12', both flags true and a server acceptedAt. legal_acceptance_events holds exactly one 'register' event with the same version and acceptedAt.

**Needs:** Resend (real inbox)

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/components/account/EmailVerificationNotice.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/database/models/LegalAcceptanceEventModel.ts`, `apps/marketing/src/components/Navbar.tsx`, `apps/web/src/components/layout/Header.tsx`

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
4. Send a valid body that also includes emailVerified:true, authVersion:'x', verificationLevel:3 and kycStatus:'approved'. With the returned token, call GET /email-verification and /rbac/me.
5. Send a 7-character password, then a 129-character password.

**Expect:** Missing, old or false acceptance returns 400 'Validation failed' with a legalAcceptance error. role 'admin' returns 400. The injected-fields request returns 201, but the extra fields are dropped: emailVerified is false, the role is user and the verification level is unchanged. /rbac/me returns roleName '' and permissions [], because only administrator accounts hold staff permissions. The 7-character and 129-character passwords each return 400. No rejected request creates an account.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/legalAcceptanceSchema.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`

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

## AUTH-17 · P0 · Web email verification: happy path from the signup email

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Email configured (AUTH-01). A user registered on the web in the last 30 minutes, still unverified and signed in.

**Steps:**

1. Open the inbox. Find 'Verify your Ujimora email address', which is sent automatically at signup. Check the From address (no-reply@ujimora.com), the Reply-To address (support@ujimora.com) and the link format https://app.ujimora.com/verify-email#token=<64 hex>.
2. To test resending, wait at least 60 seconds after signup. Go to /settings > Notifications and, under 'Verify your email address…', click 'Send verification link'. A second email should arrive.
3. Open a link. Check that the address bar no longer shows the #token fragment. Click 'Verify email address'.
4. Click 'Go to Settings', then 'Check verification status'.
5. Turn on one activity 'Email' switch.
6. Open /dashboard.

**Expect:** The signup email arrives within about 1-2 minutes (the worker runs every 30 s). It has the 30-minute single-use wording and no marketing opt-in. The resend shows a check-your-inbox confirmation and sends one more email. The page shows 'Your email is verified…'. Verifying does not sign the viewer in. Settings no longer shows the verify prompt, and the email switches become enabled. The dashboard verification notice is gone. No activity or marketing preference was turned on automatically.

**Needs:** Resend (real inbox), AUTH_EMAIL_ENCRYPTION_KEY_BASE64

**Source:** `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `render.yaml`

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

## AUTH-27 · P0 · Member and organization accounts are refused by the admin console and see no admin data

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A normal member account and an organization account (one with MFA enabled), with DevTools open. An admin account for the Audit log.

**Steps:**

1. At https://admin.ujimora.com/login, sign in as the member with the correct password (and MFA code if asked).
2. Read the message. Check DevTools > Application > Local Storage for any uf_admin_* keys and note the URL.
3. Open https://admin.ujimora.com/users and https://admin.ujimora.com/ directly.
4. Sign in as the member on https://app.ujimora.com and copy the access token. With it, call GET https://api.ujimora.com/api/v1/rbac/me, GET /api/v1/analytics/overview, GET /api/v1/users and an admin mutation (for example approve a payout or a KYC review).
5. Repeat steps 1-4 as the organization account.
6. Simulate a session saved by an older console build: set uf_admin_token and uf_admin_tokens to the member's tokens and uf_admin_user to the member's user JSON (role 'user'), then reload https://admin.ujimora.com/.
7. As the admin, open Audit log and look for the refused attempts.

**Expect:** After the correct password (and code), the console shows 'This account does not have staff access.' and stays on /login. No uf_admin_* keys are stored and no admin page ever renders. /users and / redirect to /login. With a member or organization token, /rbac/me returns 200 with roleName '' and permissions []. /analytics/overview returns 403. Admin list and mutation routes return 403 'Insufficient permissions'. The planted non-admin session counts as signed out and redirects to /login. The Audit log has an 'auth.admin_console.refused' row ('Staff console sign-in refused: account is not an administrator') for each attempt, with the account id, IP and user agent. A wrong password gives only 'Invalid email or password', with no hint about staff access.

**Needs:** None

**Source:** `apps/admin/src/context/AuthContext.tsx`, `apps/admin/src/components/AuthGuard.tsx`, `apps/admin/src/router.tsx`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/analyticsRoutes.ts`, `apps/api/__tests__/integration/admin-console-login.integration.test.ts`, `apps/api/__tests__/integration/admin-data-access.integration.test.ts`

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

**Before:** Admin X signed in to the console. DB access (there is no UI for assigning roles). A normal member account.

**Steps:**

1. In the DB, set X's role to 'user'.
2. Without signing out, click a console page that calls admin APIs, then reload.
3. Sign out and try to sign in to the console again as X.
4. Set the role back to 'admin'. Sign in again and reload.
5. As the member, call PUT /api/v1/profile with {"role":"admin","name":"Test Name"}, then GET /rbac/me.

**Expect:** Right after the demotion, admin APIs return 403. After reload, /rbac/me returns permissions [], so every page, including the dashboard, shows PermissionDenied. A fresh console sign-in is refused with 'This account does not have staff access.'. After promotion, sign-in works and access returns. The member's PUT updates only the name. /rbac/me still returns roleName '' and permissions [], and the stored role stays 'user'.

**Needs:** DB access

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/admin/src/router.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`

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

**Before:** All production admin accounts. An admin without MFA for step 1.

**Steps:**

1. As an admin without MFA, sign in to the console. Check the warning banner on the dashboard and on other pages. Click 'Turn on'.
2. Enroll MFA through Settings 'Authenticator protection' or the Profile > Security tab 'Account Protection' card.
3. Sign out, then sign in with a TOTP, then with a recovery code.
4. List every admin-role user. Confirm each has MFA enabled and its recovery codes stored in the company vault.
5. Confirm each admin password is unique and not shared.

**Expect:** Before enrollment every console page shows 'Protect this administrator account: turn on authenticator app sign-in. A stolen password alone would give full access to donor data and payouts.' 'Turn on' opens /profile?tab=security. Enrollment works from both admin screens, the banner disappears, and sign-in then asks for the code. Launch sign-off requires every admin to be enrolled; any admin without MFA blocks launch. Known open issue I028: the API still does not enforce MFA for admins (the banner is only a reminder), and there is no per-account password lockout.

**Needs:** Authenticator apps

**Source:** `apps/admin/src/components/layout/AdminMfaPrompt.tsx`, `apps/admin/src/pages/SettingsPage.tsx`, `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/admin/src/pages/LoginPage.tsx`, `docs/compliance/STAFF_ACCESS.md`

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

## AUTH-64 · P0 · Privacy cover in the app switcher, and lock on resume after the 60-second grace period

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Biometric unlock ON (later OFF). The user is on Wallet or on Edit profile with a half-filled form.

**Steps:**

1. Swipe up to the app switcher (iOS) or open Recents (Android) and look at the Ujimora snapshot.
2. Return to Ujimora straight away (under 60 s).
3. Go to the home screen, wait at least 70 s, then return to Ujimora.
4. Tap 'Unlock with biometrics' and authenticate.
5. Lock the app again. With VoiceOver or TalkBack on, swipe through the elements.
6. Turn biometric unlock OFF in Settings and repeat step 1 on iOS and on Android.

**Expect:** With biometric on, the snapshot shows the 'Ujimora is locked' cover (its buttons disabled while the app is in the background) and no balances or personal data. Returning within 60 s shows no lock screen: the same screen comes back with the half-filled form intact. After more than 60 s in the background the lock screen appears. After unlocking, the app returns to the same screen (navigation is kept), but unsaved input on it may be cleared, because a full lock unmounts screens. The screen reader cannot reach hidden content. With biometric off, the iOS snapshot shows a plain Ujimora logo cover with no account content, and the app does not lock on return. Known open issue I106: Android Recents thumbnails and screenshots are not blocked (no FLAG_SECURE), so with biometric off Android Recents may still show the real screen. Record what you see.

**Needs:** Physical devices

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/PrivacyCover.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/lib/session.ts`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## AUTH-65 · P0 · Unlock failures fall back safely and say why: cancel, offline, stalled network, revoked on the server

*Surfaces:* android, api, ios  ·  *Type:* recovery/idempotency

**Before:** Biometric unlock on and the app locked (Settings > 'Lock now'). Web access for the same account.

**Steps:**

1. Tap 'Unlock with biometrics' and cancel the system prompt.
2. Turn on airplane mode, tap Unlock, and authenticate.
3. On a stalled network (for example iOS Network Link Conditioner at 100% loss, or a captive-portal Wi-Fi), tap Unlock and authenticate.
4. Turn airplane mode off and tap Unlock again.
5. Tap 'Lock now', change the password on the web, then tap Unlock on the phone and authenticate.
6. Tap Unlock once more.
7. Tap 'Sign in with password instead'.

**Expect:** Cancelling shows 'Could not unlock. Try again, or sign in with your password and authenticator if enabled.' and the app stays locked. In airplane mode the same generic message appears quickly, the app stays locked and the saved biometric sign-in is kept. On a stalled network, 'Unlock could not reach Ujimora. Try again or use password sign-in.' appears within about 15 seconds. Back online, unlock succeeds. After the web password change, unlock shows 'Biometric unlock has expired. It lasts 7 days after you turn it on or last sign in with your password. Sign in with your password, then turn it on again in Settings.' and the saved biometric sign-in is removed. The next tap shows no biometric prompt and says 'Biometric access changed or expired. Sign in with your password instead.'. Password fallback goes to the login screen, and biometric unlock is Off afterwards.

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/lib/api.ts`

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

## AUTH-N011 · P0 · Production has no seeded or known-password accounts, and the seed scripts refuse non-local databases

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Read access to the production Atlas database. A repo checkout with Node, and a throwaway local MongoDB on 127.0.0.1.

**Steps:**

1. In the production users collection, search for admin@ujimora.com, amara2@ujimora.com and any address ending in @ujimora.dev.
2. List every user with role 'admin' and confirm each is a named, current staff member.
3. From apps/api, run 'MONGODB_URI=mongodb+srv://user:pass@example.invalid/x node scripts/seed-dev.mjs' (a dummy SRV address; nothing is contacted).
4. Run 'NODE_ENV=production MONGODB_URI=mongodb://127.0.0.1:27017/x node scripts/seed-dev.mjs', then run seed-e2e.mjs the same two ways.
5. Run seed-dev.mjs against the local throwaway database without SEED_ADMIN_PASSWORD.

**Expect:** None of the seed accounts exist in production; any that do must be removed or have their password rotated before launch. Only known staff hold the admin role. The SRV and production runs exit with code 1 before connecting, printing 'seed-dev: refusing to seed — …' (for example 'MONGODB_URI uses mongodb+srv:// (a hosted cluster)' or 'NODE_ENV is production') without echoing the URI. The seed-e2e runs are refused the same way. The local run seeds fixtures but prints 'seed-dev: SEED_ADMIN_PASSWORD not set — skipping the admin account', and no admin@ujimora.com user is created.

**Needs:** Production DB read access, local MongoDB

**Source:** `apps/api/scripts/seedGuard.mjs`, `apps/api/scripts/seed-dev.mjs`, `apps/api/scripts/seed-e2e.mjs`, `apps/api/__tests__/infrastructure/seedGuard.test.ts`

## AUTH-06 · P1 · Duplicate email (any case or padding), double submit and concurrent registration create exactly one account

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A test email that is not yet registered. DB read access.

**Steps:**

1. Register Test.Dup@example.com on the web.
2. Signed out, try to register ' test.dup@EXAMPLE.com ' again, with a leading and trailing space. Send the same padded value directly to POST /api/v1/auth/register.
3. On a new email, double-click 'Create account' quickly on the Plan step.
4. From a terminal, fire three identical POST /auth/register requests for another new email at the same moment (e.g. 'curl ... & curl ... & curl ... &').
5. Check the users and wallets collections.

**Expect:** Step 2 returns 409 'Email already registered', both on the web and directly on the API, because the server trims and lower-cases the email before checking. The web shows the message on the Contact step and keeps the fields. Step 3 sends one request: the button shows 'Creating…' and is disabled. Step 4 gives exactly one 201, and every other request gets 409 'Email already registered'. None returns 500. There is exactly one user and one GHS wallet per email, and the stored email is trimmed and lower-case.

**Needs:** DB read access

**Source:** `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/__tests__/integration/duplicate-key-races.integration.test.ts`, `apps/web/src/components/auth/RegisterForm.tsx`

## AUTH-08 · P1 · Organization wizard validation, including dangerous website values

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Signed out. curl for the API steps.

**Steps:**

1. Web Organization step: click Continue with an empty name, then with a name but no type.
2. Enter the website 'example.org' and click Continue. Then type https://example.org and check whether 'Does your organization need a website?' is visible. Clear the website field and check again.
3. API: POST /auth/register with role 'organization' and no organizationName or organizationType.
4. API: send valid organization bodies with the website 'javascript:alert(document.cookie)', then 'data:text/html,hi', then 'https://user:pass@example.org', then '  https://example.org  ' (padded).
5. Native Register: choose Organization and enter the website 'example.org' with no scheme. Tap Create Account.
6. API: an individual body (no role) with needsWebsite:true.

**Expect:** The web shows 'Organization name is required', 'Select an organization type' and 'Enter a full URL (https://…)'. The needs-website checkbox only shows while the website is blank, and typing a website unticks it. The API returns 400 with organizationName ('Organization name is required') and organizationType ('Organization type is required') errors. The javascript:, data: and credential-bearing websites each return 400 'Validation failed' with the website error 'Enter a full web address starting with https://', and no account is created. The padded https URL is accepted and stored trimmed. Native should tell the user the website needs https:// before or after submitting. The individual account is stored with needsWebsite false. Known open issue I102: native has no client-side website check and does not show field errors, so it currently shows only the generic 'Validation failed'.

**Needs:** None

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`, `apps/api/__tests__/integration/auth-email-normalisation.integration.test.ts`, `apps/mobile/app/(auth)/register.tsx`

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

1. On /register, complete the details. On Plan, confirm only Free, Starter and Pro are listed. Toggle Monthly and 'Yearly · save'. For Starter, note the GHS price and the line under it ('for 30 days · one-time payment' or 'for 1 year · one-time payment'). If a paid plan has no price for the chosen cycle, check that it shows 'Not offered' and cannot be selected. Select Starter and click 'Create account & continue'.
2. Confirm the Paystack checkout amount and currency match the price shown. Pay with a Paystack test card.
3. Confirm you return to /subscription/callback and check the plan status.
4. Repeat with a new email, but close the Paystack page without paying, then sign in.
5. Repeat on a staging copy with the Paystack keys unset, or block POST to the subscription checkout.
6. API: signed in, call POST /api/v1/subscriptions/checkout with tier 'enterprise'.

**Expect:** Enterprise is never offered at signup. The account is created before checkout. The Paystack amount equals the plan price exactly, in GHS, with no rounding drift. After payment the plan is active for 30 days (or 1 year) as a one-time purchase that does not renew automatically. An abandoned checkout leaves a signed-in Free account that can upgrade later from /subscription (pending-checkout handling is covered in SUBS). A checkout error goes to /subscription?tier=…&billingCycle=…&checkoutError=1, still signed in, and retrying creates no second account. The Enterprise checkout call returns 403 'This plan is arranged through our sales team. Contact sales@ujimora.com.' and creates no checkout.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/web/src/lib/subscriptions.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`

## AUTH-12 · P1 · Referral code capture from a ?ref= link and attribution to the affiliate

*Surfaces:* api, marketing, web  ·  *Type:* functional

**Before:** Affiliate A is active with the code 'kofi-media' (check /affiliate). Incognito window.

**Steps:**

1. Open the referral link from A's Affiliate dashboard (format https://app.ujimora.com?ref=kofi-media), then go to /register.
2. Confirm the 'Referral code (optional)' field is prefilled. Complete signup.
3. In DevTools > Application, check that localStorage 'uf_ref' was removed.
4. As A, open /affiliate > Referrals.
5. On another device that never saw the link, register with the code typed by hand as 'KOFI-MEDIA'.
6. In a new incognito window, open https://ujimora.com/?ref=kofi-media (marketing), click 'Get started' and complete signup.

**Expect:** The field is prefilled and the code is sent in lowercase. A sees each new user as a pending referral, and each referee is referred only once. uf_ref is cleared after signup. Hand-typed uppercase codes are normalized and attributed. The marketing entry should also carry the code into app registration and be attributed to A. Known open issue I025: the marketing site does not forward ?ref to the app, so step 6 is expected to lose the code until that is fixed. Record the result for the affiliate owner.

**Needs:** Affiliate program enabled

**Source:** `apps/web/src/App.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/application/use-cases/GetAffiliateDashboardUseCase.ts`, `packages/types/src/referralCode.ts`, `apps/marketing/src/components/Navbar.tsx`

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

## AUTH-21 · P1 · Features gated on email verification name the missing step

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** An unverified user who owns a campaign. A pending organization-team invitation for that email. A payouts tester is available.

**Steps:**

1. Unverified: try to turn on an activity 'Email' switch. Also call PUT /api/v1/profile/activity-alerts with channel 'email' and enabled true.
2. Unverified: accept the organization invitation from /invitations or the organization-team flow.
3. With the payouts testers: an unverified campaign owner with KYC level 2 or higher reaches an automatic payout. Look at the payout's review reason in admin.
4. Open web /dashboard, web /payout-accounts and the native Profile > Dashboard.
5. Verify the email and repeat each step.

**Expect:** Before verification: the email switch is disabled, and the API returns 409 'Verify your email address before enabling activity emails.'. Accepting the invitation returns 403 'Verify your email before accepting an organization invitation'. The automatic payout goes to manual review with the reason 'Verify your email address to enable automatic payouts.'. The web dashboard shows 'Verify your email address. Automatic payouts and organization invitations need a verified email address.' with 'Send link'. /payout-accounts shows 'Verify your email address. Automatic payouts need a verified email; until then each payout waits for manual review.'. The native dashboard shows the same prompt with 'Send verification link'. After verification all three actions work and the notices disappear.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/web/src/components/account/EmailVerificationNotice.tsx`, `apps/web/src/pages/PayoutAccountsPage.tsx`, `apps/mobile/src/components/EmailVerificationNotice.tsx`

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

## AUTH-28 · P1 · Web login page offers a 'Forgot password?' link that carries the typed email

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Signed out. A registered email.

**Steps:**

1. Open https://app.ujimora.com/login and look below the Password field.
2. Type the registered email in the Email field and click 'Forgot password?'.
3. Check the URL and the Email field on the reset page, then submit.
4. Go back to /login, clear the Email field, and click 'Forgot password?' again.
5. Compare with the admin console /login and the native Sign in screen.

**Expect:** A 'Forgot password?' link sits right-aligned under the Password field and opens /forgot-password. The typed email is prefilled on the reset page. The URL stays exactly /forgot-password: the email is passed in router state, never in the path or query string. Submitting shows the 'Check your email' confirmation (AUTH-33). With a blank login email the reset field is empty. Admin and native keep their own 'Forgot password?' links.

**Needs:** None

**Source:** `apps/web/src/components/auth/LoginForm.tsx`, `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/admin/src/pages/LoginPage.tsx`, `apps/mobile/app/(auth)/login.tsx`

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

## AUTH-32 · P1 · Signing out revokes that session's refresh token on the server

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Signed in on web in browser A and browser B as the same user. curl is available.

**Steps:**

1. In browser A DevTools, copy uf_tokens.refreshToken and uf_tokens.accessToken from Local Storage.
2. With the Network tab open, sign out from the account menu. Find the POST to https://api.ujimora.com/api/v1/auth/logout.
3. Call POST /api/v1/auth/refresh with {"refreshToken":"<copied>"}.
4. Call GET /api/v1/wallets with the copied access token at once, and again after 16 minutes.
5. Keep using browser B for more than 15 minutes so it refreshes.
6. Call POST /api/v1/auth/logout with a random string as refreshToken, then with an empty body.
7. Sign in again in A, copy the new refresh token, change the password in B, then call refresh with A's token.

**Expect:** Sign-out sends POST /auth/logout, which returns 200 {"message":"Signed out"}, and A returns to '/'. Refreshing with the copied token returns 401 'Invalid or expired refresh token'. The copied access token keeps working until its 15-minute expiry and then returns 401, because access tokens are not checked against revocation. Browser B stays signed in and refreshes normally: only the session that signed out is revoked. A random token also gets 200 'Signed out' (the endpoint reveals nothing), and an empty body gets 400. After a password change every older refresh token gets 401. Known open issue I031: refresh tokens are not rotated, so a refresh token copied from a session that never signs out stays usable for up to 7 days unless the password changes. Tokens are still kept in localStorage.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/application/services/AuthTokenService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoSessionRevocation.ts`, `packages/ui/src/browserSession.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/api/__tests__/integration/session-logout.integration.test.ts`

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

## AUTH-36 · P1 · Password recovery gives clear, actionable errors (unavailable, rate-limited, offline, invalid)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** A staging copy with AUTH_EMAIL_ENCRYPTION_KEY_BASE64 unset (or PUBLIC_WEB_URL on http). A configured environment for the other steps.

**Steps:**

1. Unconfigured staging, web /forgot-password: submit any email.
2. Unconfigured staging, native Forgot password screen: submit.
3. Unconfigured staging, admin /forgot-password: submit.
4. Configured environment: trip the auth rate limit from one IP (AUTH-77), then submit the web and native forgot forms from that IP. Also submit the admin form.
5. Web with DevTools Offline, and native in airplane mode: submit.
6. Native: submit 'not-an-email'.

**Expect:** The unconfigured API returns 503 for every address. Web and native show 'Password recovery is temporarily unavailable. Please try again later.', and admin shows the API message '…Please try again later or contact support.'. No screen claims an email was sent. With a 429, web and native show 'Too many attempts. Please wait about 15 minutes and try again.', and admin shows 'Too many requests, please try again later'. Offline, web and native show 'Can't reach Ujimora. Check your connection and try again.'. An invalid email shows 'Enter a valid email address.'.

**Needs:** Staging environment

**Source:** `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/mobile/app/forgot-password.tsx`, `apps/mobile/src/lib/authMessages.ts`, `apps/admin/src/pages/ForgotPasswordPage.tsx`

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

## AUTH-40 · P1 · Web change password keeps the initiating session signed in and ends all others

*Surfaces:* api, email, ios, web  ·  *Type:* functional

**Before:** User signed in on Chrome (where the change is made), on Firefox and on the phone.

**Steps:**

1. Chrome: note uf_tokens in Local Storage. Open /profile > change password, enter the current password, the new one and the confirmation, and save.
2. Wait for the success snackbar. Go to /settings and /wallet and let background polling run for 30 s. Check uf_tokens again.
3. Use Firefox and the phone.
4. Check the inbox.

**Expect:** Chrome shows 'Password changed!' and stays signed in. Pages keep loading, there is no 'Your session has expired' prompt, and uf_tokens now holds the new pair returned by PUT /auth/change-password. Firefox shows the session-expired prompt on its next request, and the phone returns to the signed-out state. A 'Your Ujimora password changed' email arrives.

**Needs:** Resend

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`, `apps/api/__tests__/integration/auth.integration.test.ts`

## AUTH-42 · P1 · Native change password keeps the device signed in, including with biometric unlock on

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Signed in on the phone, once with biometric unlock off and once with it on. The same user is also signed in on the web.

**Steps:**

1. Biometric off: Profile > Edit profile > Change password. Enter the current password and a new password twice. Check the button stays disabled until the new password has 8 or more characters, then tap 'Update password'.
2. Go to Wallet and Settings, then force-quit and relaunch the app.
3. Use the web session.
4. Biometric on: change the password again and accept any biometric prompt (it saves the new sign-in to the device). In Settings tap 'Lock now', then 'Unlock with biometrics'.
5. Biometric on: change the password once more but cancel the biometric prompt. Keep using the app, then tap 'Lock now' and 'Unlock with biometrics'. Then tap 'Sign in with password instead' and sign in with the newest password.

**Expect:** The app shows 'Password updated' and the device stays signed in, including after relaunch. The web session is signed out on its next request. With the prompt accepted, biometric unlock works. With the prompt cancelled, the app shows 'Password updated, but this device could not save the new sign-in. Sign in again before using biometric unlock.' and the current session keeps working. The next unlock fails with 'Biometric unlock has expired. It lasts 7 days after you turn it on or last sign in with your password. Sign in with your password, then turn it on again in Settings.'. Password sign-in with the new password works. The app never loops or crashes.

**Needs:** Physical device

**Source:** `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/lib/accountSecurity.ts`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/session.ts`

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

## AUTH-50 · P1 · Account deletion (with re-authentication) ends every session and frees the email

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** User D has no wallet balance, unpaid raised funds, tips, affiliate earnings or in-flight payouts (otherwise closure is refused; see PROFILE). D is signed in on the web and on a phone with biometric unlock on. D has MFA enabled. D's tokens are captured.

**Steps:**

1. Web /settings > Danger zone > 'Delete account'. Wait for 'Checking your balances and campaigns…' to finish, enter 'Current password' and 'Authenticator or recovery code', and click 'Delete my account'.
2. Use D's old access and refresh tokens against the API.
3. On the phone, make a request. Or tap 'Lock now' (or leave the app for more than 60 s) and try to unlock.
4. Try to sign in as D.
5. Before the erasure sweep has run, register again with D's email. After the sweep, register again.

**Expect:** The web signs out and goes to '/'. The old refresh token gets 401 'Account is no longer available', and the old access token gets 401. The phone returns to the signed-out state. A biometric unlock attempt fails with 'Biometric unlock has expired. It lasts 7 days after you turn it on or last sign in with your password. Sign in with your password, then turn it on again in Settings.', and only password sign-in remains. Sign-in shows 'Invalid email or password'. Re-registering before the sweep returns 409 'Email already registered', not 500. After the sweep it creates a brand-new empty account with no old wallet, campaigns or MFA, and D's MFA record is gone.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/mobile/src/lib/session.ts`

## AUTH-51 · P1 · Token and HTTP hardening: tampered JWTs, cache headers, CORS, framing and security headers

*Surfaces:* admin, api, marketing, web  ·  *Type:* security/permission

**Before:** curl and a JWT tool. A local HTML file for the framing test.

**Steps:**

1. Decode a member access token, change role to 'admin', re-sign it with a random key, and call GET /api/v1/users.
2. Send a token with alg 'none'. Send an expired access token.
3. Check the Cache-Control header on /auth/login, /auth/mfa and /email-verification responses.
4. Send a request with 'Origin: https://evil.example' and check Access-Control-Allow-Origin.
5. Run curl -I on https://app.ujimora.com/login, https://admin.ujimora.com/login and https://ujimora.com/.
6. Open a local HTML file that iframes https://app.ujimora.com/login, then one that iframes https://admin.ujimora.com/login.

**Expect:** Tampered, alg-none and expired tokens all get 401. The auth routes send 'Cache-Control: private, no-store'. The evil origin gets no Access-Control-Allow-Origin. app.ujimora.com and ujimora.com send 'X-Frame-Options: SAMEORIGIN' and "Content-Security-Policy: frame-ancestors 'self'". admin.ujimora.com sends 'X-Frame-Options: DENY' and "Content-Security-Policy: frame-ancestors 'none'". All three send 'X-Content-Type-Options: nosniff' and 'Referrer-Policy: strict-origin-when-cross-origin'. Both iframes are refused by the browser. Known open issue I031: there is no full Content-Security-Policy (script-src and so on), and tokens remain in localStorage, so an XSS bug would still expose them. HSTS relies on Vercel's default.

**Needs:** None

**Source:** `apps/api/src/application/services/AuthTokenService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/marketing/vercel.json`

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

1. In Ujimora Settings tap 'Lock now'. iOS: in Settings > Face ID, add an Alternate Appearance or reset Face ID. Android: add a new fingerprint.
2. Return to Ujimora and tap Unlock.
3. Sign in with the password, then check the biometric setting.
4. Separately, remove every biometric (or the device passcode) and reopen the app.

**Expect:** Unlock fails with a specific message such as 'Biometric access changed or expired. Sign in with your password instead.' or 'Biometrics are unavailable or changed. Sign in with your password instead.' (a raw keychain failure may show the generic 'Could not unlock…'). A newly enrolled finger or face can never unlock the old vault. Password sign-in works, and biometric unlock stays off until it is turned on again.

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/components/BiometricLock.tsx`, `docs/compliance/MFA_AND_BIOMETRICS.md`

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

**Before:** Biometric unlock on. MFA off. An authenticator app.

**Steps:**

1. On the phone, enable MFA in Settings and accept any biometric prompt.
2. Tap 'Lock now' (or leave the app for more than 60 s), return and unlock.
3. Disable MFA on the phone, but CANCEL the biometric prompt this time. Read the message.
4. Tap 'Lock now' and try to unlock.
5. Sign in with the password, turn biometric unlock back on and tap 'Lock now'. Enable MFA from the WEB while the phone is locked, then unlock on the phone.

**Expect:** Accepting the prompt updates the vault, and unlock works afterwards. Cancelling shows 'Your account protection was updated, but device sign-in could not be saved. Save your recovery codes, then sign in again before using biometric unlock.'. The next unlock fails with 'Biometric unlock has expired. It lasts 7 days after you turn it on or last sign in with your password. Sign in with your password, then turn it on again in Settings.', and password (plus MFA) sign-in works. A change made on the web makes the phone's unlock fail with the same message, leaving password plus code as the route. Credentials are never silently written to ordinary storage.

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

## AUTH-76 · P1 · Bumping the agreement version reaches users who are already signed in

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Staging. Users signed in on the web and on the phone with the current acceptance. Keep one web tab open from before the deploy. The phone runs a build that ships the OLD version (for example the current store or preview build).

**Steps:**

1. Deploy a staging API and web build with LEGAL_ACCEPTANCE_VERSION bumped (e.g. '2026-10-01').
2. Without signing in again, switch back to the old web tab and wait up to a minute. Also open a fresh tab.
3. On the phone, send the app to the background for more than a minute and return.
4. Try to publish something on the web and on the phone.
5. In the old web tab, open /account-agreement, tick both boxes and save.
6. On the phone, tap 'Review agreement'. Then tap 'Review on the website', accept there, return and tap 'I have accepted it, check again'.

**Expect:** The API returns 428 on publishing right away. The web banner 'Please review the account agreement before publishing or uploading content.' appears without signing in again: on the next tab focus or visibility change (checked at most once a minute) and immediately after any 428. Saving from the old tab sends the version the server requires, the banner disappears, and publishing works. On the old phone build the banner reads 'An updated account agreement is available. Update Ujimora to review it before publishing or uploading content.'. The agreement screen shows 'An updated account agreement is available. Update Ujimora from the App Store or Google Play to review and accept it, or review it on the Ujimora website.' with 'Review on the website' and 'I have accepted it, check again', and no checkboxes, so it never accepts terms the user has not seen. After accepting on the web and checking again, the phone banner disappears. A phone build that ships the new version shows the normal review screen. Known open issue I094: after a bump, older store builds still get 400 on registration because they send the old version, until the minimum-version gate is raised to force an update.

**Needs:** Staging deploy

**Source:** `packages/types/src/legal-acceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/mobile/src/lib/agreementStatus.ts`, `apps/mobile/src/components/AccountAgreementNotice.tsx`, `apps/mobile/app/account-agreement.tsx`

## AUTH-77 · P1 · Auth rate-limit behavior and lockouts

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** One public IP with a script, a second network, and a test account. Target https://api.ujimora.com directly.

**Steps:**

1. From one IP, send 30 mixed requests across POST /auth/login, /auth/forgot-password, /auth/mfa/setup and /email-verification.
2. Send a 31st request to any of those, then one to /auth/register and one to DELETE /profile. Record the status, Retry-After and X-RateLimit-* headers.
3. From that IP, sign in on the web and on native and read the message shown.
4. From the same IP, call /auth/refresh 40 times and /auth/logout a few times.
5. From the second network, sign in normally.
6. Wait 15 minutes and sign in again from the first IP.
7. From rotating IPs, send 100 wrong passwords to one account, then sign in with the correct password.

**Expect:** The 31st and later requests get 429 'Too many requests, please try again later' with Retry-After. The limit is one bucket shared by login, register, forgot-password, reset-password, email verification (send and confirm), MFA setup, enable, disable and recovery-code replacement, and DELETE /profile. Web and native sign-in show 'Too many requests, please try again later'. /auth/refresh and /auth/logout are not under the auth limit; only the general 300 per 15 minutes applies. The second network is unaffected, because buckets are per client IP. Access returns after 15 minutes. Known open issue I028: there is no per-account password lockout, so the correct password still works after the distributed attempts. Only the MFA code limit (10 per 10 minutes per account) is per account. Counters also reset on an API restart (I099).

**Needs:** Multiple IPs (VPN or cloud shell)

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`

## AUTH-79 · P1 · Native guest access, sign-in gates that return to the gated screen, and no token handoff to Safari

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Fresh install, signed out.

**Steps:**

1. Browse Explore, a campaign detail page and Legal & trust without signing in.
2. Open the Profile tab, the Wallet tab and Profile > Dashboard.
3. On the Wallet gate, tap 'Sign In' and complete login.
4. Sign out. Open Profile > Dashboard, tap 'Sign In', then 'Create one', and register a new account.
5. Signed in on iOS, tap Donate on a campaign and look at the Safari URL.
6. Confirm the app offers no third-party login buttons.

**Expect:** Public content works without an account (Apple 5.1.1). Gates show 'Sign in to continue' and 'Sign in to view your …' with a working 'Sign In' button. After signing in from the Wallet gate the app returns to Wallet, not Home. After registering from the Dashboard gate it returns to Dashboard. On iOS, Donate opens Safari at /c/<slug>/donate with only amount or liveSessionId query parameters and no tokens, so the user is a guest on the web unless they sign in there. There is no social login, so Sign in with Apple is not required.

**Needs:** None

**Source:** `apps/mobile/src/components/SignInRequired.tsx`, `apps/mobile/src/navigation/returnTo.ts`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/(tabs)/profile.tsx`

## AUTH-80 · P1 · No credentials in logs, and security and staff sign-in events in the audit log

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Flows AUTH-03, AUTH-22, AUTH-33, AUTH-52 and AUTH-40 have been run on staging with known unique values. An admin account and a member account.

**Steps:**

1. Search the Render logs for the test password, 'reset-password#token', 'verify-email#token', 'refreshToken', 'accessToken', a used 6-digit OTP and a recovery code.
2. In admin, open the Audit log and filter by the test user.
3. At admin.ujimora.com: sign in as the admin successfully, then with a wrong password, then with the right password and a wrong MFA code. Sign in to the console with the member account. Sign in to the web app as the member.
4. In the Audit log, open the rows from step 3 and compare each IP with your own public IP.

**Expect:** None of the secrets appear in the logs. The audit log shows mfa.enabled, mfa.disabled or mfa.recovery-regenerated and auth.update (password change) with the actor and the client's public IP, and no request bodies. Staff sign-ins are audited under resource 'account-security', with IP and user agent and never a password or code: 'auth.admin_login.succeeded' ('Administrator signed in to the staff console'), 'auth.admin_login.failed' ('Administrator sign-in failed: wrong password' and '…: authenticator code rejected'), and 'auth.admin_console.refused' for the member's console attempt. The member's web sign-in writes no row (by design). The login-row IP should be your public IP. If it shows an internal address (for example 10.x.x.x), file a bug: AuthController passes req.ip, which clientIp.ts documents as Render's internal proxy, instead of the resolved client IP. Known open issue I028: member sign-in successes and failures are not audited, and there is no per-account lockout.

**Needs:** Render log access

**Source:** `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/logging/privacy.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `docs/compliance/LOGGING_PRIVACY.md`

## AUTH-N001 · P1 · Signing out on admin and native revokes only that device's session on the server

*Surfaces:* admin, android, api, ios  ·  *Type:* security/permission

**Before:** An admin signed in to the console in two browsers (A and B). A member signed in on the phone and on the web. curl, and DB read access to the revoked_sessions collection.

**Steps:**

1. Admin browser A: copy uf_admin_tokens.refreshToken from Local Storage. With the Network tab open, sign out with the Sidebar sign-out icon. Find the POST to https://api.ujimora.com/api/v1/auth/logout.
2. Call POST /api/v1/auth/refresh with the copied admin refresh token.
3. Admin browser B: keep working for more than 15 minutes so its token refreshes.
4. Count the member's rows in revoked_sessions. On the phone, go to Profile and tap 'Sign Out'. Count again.
5. Keep using the member's web session for more than 15 minutes.
6. Sign the member in on the phone again, turn on airplane mode and tap 'Sign Out'.

**Expect:** Every sign-out sends POST /auth/logout, which answers 200 'Signed out', and the local sign-out finishes without waiting for it. The copied admin refresh token now gets 401 'Invalid or expired refresh token'. Browser B stays signed in and refreshes normally. The native sign-out adds exactly one revoked_sessions row for the member (userId, revokedAt, and expiresAt about 8 days later). The member's web session keeps working. Offline, the phone still signs out at once; the server call is best-effort, so that device's refresh token stays valid until it expires. Known open issue I031: refresh tokens are not rotated.

**Needs:** DB read access

**Source:** `apps/admin/src/context/AuthContext.tsx`, `packages/ui/src/browserSession.ts`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/api.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/infrastructure/database/models/RevokedSessionModel.ts`, `apps/api/__tests__/integration/session-logout.integration.test.ts`

## AUTH-N002 · P1 · Admin console reminds administrators without MFA on every page

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** An admin account without MFA. A staging copy where MFA_ENCRYPTION_KEY is unset.

**Steps:**

1. Sign in to the console as the admin without MFA. Visit the dashboard, Users and Audit log.
2. Click 'Turn on' in the banner.
3. On /profile, look at the banner again.
4. Enroll authenticator MFA from Profile > Security, then visit other pages.
5. On the staging copy without MFA_ENCRYPTION_KEY, sign in as an admin without MFA.

**Expect:** Every page shows the warning 'Protect this administrator account: turn on authenticator app sign-in. A stolen password alone would give full access to donor data and payouts.' with a 'Turn on' button that opens /profile?tab=security. On /profile the banner has no 'Turn on' button. Once MFA is enabled, the banner disappears on every page without signing in again. On the unconfigured staging copy the banner instead reads 'Administrator accounts should use authenticator sign-in, but it is not configured on this server yet. Ask engineering to set it up.'. Known open issue I028: this is a reminder only, and admin MFA is still not enforced at sign-in.

**Needs:** Authenticator app; staging environment control

**Source:** `apps/admin/src/components/layout/AdminMfaPrompt.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`, `docs/compliance/STAFF_ACCESS.md`

## AUTH-N003 · P1 · Email verification prompt on the web dashboard, payout accounts page and native dashboard

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** An unverified member who registered more than a minute ago. Email configured. A staging copy with account email unconfigured.

**Steps:**

1. Web /dashboard: read the notice and click 'Send link'.
2. Click 'Send link' again at once. Count the emails received over the next 2 minutes.
3. Open web /payout-accounts and read the notice.
4. Native: Profile > Dashboard. Read the notice and tap 'Send verification link'.
5. Verify the email from one of the links, then reload web /dashboard and /payout-accounts and reopen the native Dashboard.
6. On the unconfigured staging copy, register a new account and open /dashboard.

**Expect:** Web dashboard: 'Verify your email address. Automatic payouts and organization invitations need a verified email address.' with 'Send link'. The button shows 'Sending…', then 'Check your email for a verification link. Allow a minute before requesting another.'. Clicks within 60 seconds produce only one email. /payout-accounts reads 'Verify your email address. Automatic payouts need a verified email; until then each payout waits for manual review.'. The native notice reads 'Verify your email address. Automatic payouts and organization invitations need a verified email.' and gives the same confirmation. After verification every notice disappears. On the unconfigured copy, signup still succeeds (201): queueing the signup email is best-effort and never blocks signup. No verification notice is shown, because the notice hides itself when email delivery is unavailable.

**Needs:** Resend

**Source:** `apps/web/src/components/account/EmailVerificationNotice.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/PayoutAccountsPage.tsx`, `apps/mobile/src/components/EmailVerificationNotice.tsx`, `apps/mobile/src/lib/emailVerification.ts`, `apps/mobile/app/dashboard.tsx`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`

## AUTH-N004 · P1 · Web and admin sessions survive a device clock that is minutes off

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** A laptop where automatic time can be turned off. A member account and an admin account. The DevTools Network tab with Preserve log on.

**Steps:**

1. Set the laptop clock 20 minutes behind. Sign in on https://app.ujimora.com and keep interacting every few minutes for 25 minutes. Note when POST /auth/refresh fires.
2. Set the clock 20 minutes ahead. Sign in again and repeat for 25 minutes.
3. With a skewed clock, sign in to the admin console and use it for 25 minutes.
4. With a skewed clock, set DevTools to Offline just before a refresh is due (about 14 minutes after sign-in), click a page that loads data, then go back online and retry.
5. Restore automatic time.

**Expect:** Both skews behave like a correct clock. Nobody is signed out unexpectedly and no 'Your session has expired' prompt appears while the user is active. Refresh fires about 14 minutes after each token was received (60 s before its lifetime ends), whatever the device clock says, and only one refresh runs at a time. If the API still rejects a token with 401, the app renews once and silently retries the request. A network failure during renewal shows an error such as 'Unable to renew your session. Check your connection and try again.' and does not sign the user out; the next request after reconnecting works. Only a refused refresh (401 or 403) ends the session.

**Needs:** None

**Source:** `packages/ui/src/browserSession.ts`, `apps/web/src/lib/api.ts`, `apps/admin/src/lib/api.ts`

## AUTH-N006 · P1 · Consent history is recorded at signup and re-acceptance, is never duplicated, and survives erasure

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Staging. DB read and write access. A spare account with no balances for the erasure step. A shell in apps/api with the staging MONGODB_URI.

**Steps:**

1. Register a new account on the web. Query legal_acceptance_events for its userId.
2. In the DB, set that user's legalAcceptance.version to '2026-01-01'. Sign in, open /account-agreement, tick both boxes and save. Query again.
3. Send the same POST /api/v1/profile/legal-acceptance body three times at once (curl in parallel). Query again and compare users.legalAcceptance.acceptedAt.
4. Delete the spare account (AUTH-50). After the erasure sweep, query its events.
5. Run 'npx tsx scripts/backfill-legal-acceptance-events.ts' (dry run), then the same with --apply, then --apply again.

**Expect:** Signup writes exactly one 'register' event: version '2026-09-12', both flags true, and acceptedAt equal to users.legalAcceptance.acceptedAt, with ip and userAgent. Re-accepting adds exactly one 'reaccept' event. The repeated and parallel POSTs add none and leave acceptedAt unchanged. Events are kept after the account is erased. The backfill dry run prints {"mode":"dry-run","candidates":N,"inserted":0}. --apply inserts 'backfill' events only for accounts that have none. The second --apply inserts 0. Also check the ip on the events: it should be the tester's public IP. If it is an internal address (for example 10.x), file a bug: the register and re-accept handlers pass req.ip rather than the resolved client IP from clientIp.ts.

**Needs:** DB access, staging

**Source:** `apps/api/src/infrastructure/database/models/LegalAcceptanceEventModel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLegalAcceptanceLog.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/scripts/backfill-legal-acceptance-events.ts`, `apps/api/__tests__/integration/legal-acceptance.integration.test.ts`

## AUTH-N007 · P1 · The agreement notice follows the server's status during a session, not the cached login user

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A member signed in on the web and on the phone with the current acceptance. DB write access. A second account.

**Steps:**

1. Without signing out anywhere, set the member's legalAcceptance.version to '2026-01-01' in the DB.
2. Web: without reloading, try to post a comment or upload an avatar.
3. Call GET /api/v1/profile/legal-acceptance with the member's token.
4. Native: try to publish something, or send the app to the background for more than a minute and return.
5. Web: accept on /account-agreement. Native: accept on the agreement screen.
6. On the web, sign out and sign in as the second account in the same tab.

**Expect:** Publishing returns 428 'Review the current account agreement and confirm you are at least 18 before publishing or uploading content'. The web banner 'Please review the account agreement before publishing or uploading content.' appears straight after the 428, with no reload or re-login. GET /profile/legal-acceptance returns current:false, requiredVersion '2026-09-12' and the stored record, with Cache-Control no-store. The native banner 'Review the account agreement before publishing or uploading content.' appears after the 428 or on returning to the foreground. After accepting, the banners disappear and publishing works. The second account never inherits the first account's status.

**Needs:** DB write access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/agreementEvents.ts`, `apps/mobile/src/lib/agreementStatus.ts`

## AUTH-N008 · P1 · With biometric unlock on, short interruptions and hand-offs to other apps neither lock nor wipe work

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Biometric unlock on. Physical iOS and Android devices. MFA off for step 5.

**Steps:**

1. On Edit profile, change the name and bio without saving. Open Control Center (iOS) or pull down the notification shade (Android), then close it.
2. Go to the home screen and come back within about 30 seconds.
3. On Edit profile, tap to change the photo and pick from the library. Stay in the picker for about 2 minutes before choosing.
4. On the KYC screen, tap 'Use my location' and leave the permission dialog open for more than 60 s before allowing it.
5. In Settings, set up authenticator MFA. When the recovery codes show, tap 'Download recovery codes', stay in the share sheet for more than 60 s, then save or cancel.
6. Go to the home screen, wait 70 s and return.
7. Tap 'Unlock with biometrics' and press Home while the system prompt is showing.

**Expect:** During steps 1-2 a cover shows ('Ujimora is locked', with its buttons disabled), but coming back needs no unlock and the unsaved name and bio are still there. The picked photo appears in the form with no lock: camera and picker hand-offs get up to 10 minutes. The location permission and the share sheet return to the same screen with no lock, and the recovery codes are still shown. After 70 s in the background (step 6), the lock screen appears and needs biometrics. Leaving during an unlock prompt cancels that attempt, and the app is locked when you return.

**Needs:** Physical devices, authenticator app

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/src/components/MfaSettings.tsx`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## AUTH-N010 · P1 · Account deletion asks for the password (and MFA code), and wrong input keeps the session

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** A member with no balances or in-flight payouts, and a second such member with MFA enabled. Spare accounts for the final deletions. curl.

**Steps:**

1. Web /settings > Danger zone > 'Delete account'. Check that 'Delete my account' is disabled until 'Current password' is filled in.
2. Enter a wrong password and click 'Delete my account'. Close the dialog and open another page.
3. MFA member: open the dialog. Check the 'Authenticator or recovery code' field shows and the button stays disabled until the code has 6 or more characters. Submit the correct password with a wrong code.
4. Call DELETE /api/v1/profile with the member's token and no body, the way an older app build would.
5. On a spare account, fill in correct values and double-click 'Delete my account' with the Network tab open.
6. Native: Settings > Delete Account on another spare account. Enter the password (and code) and confirm.

**Expect:** A wrong password shows 'Current password is incorrect.' (400). The dialog stays usable and the user is still signed in. A missing or wrong MFA code shows 'Enter a valid authenticator code or an unused recovery code.'. Wrong codes count toward the per-account limit and eventually return 'Too many code attempts. Try again in 10 minutes.'. The body-less DELETE returns 400 'Enter your current password to delete your account. If you are not asked for it, update the Ujimora app or delete your account from Settings at app.ujimora.com.'. The double-click sends exactly one DELETE, and the account is closed and signed out. The native flow asks for the same fields and then a destructive confirmation ('Delete your account?' / 'This cannot be undone.') before deleting. DELETE /profile shares the 30-per-15-minute auth rate limit.

**Needs:** Spare accounts

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/api/__tests__/integration/account-erasure.integration.test.ts`

## AUTH-13 · P2 · Bad referral codes never block or corrupt signup

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Affiliate B is SUSPENDED and has a known code.

**Steps:**

1. Register with the code 'nosuchcode'.
2. Register with B's code.
3. Type 'admin' in the referral field, read the helper text, then try to finish signup on web and on native.
4. Type 'ab' (2 characters), read the helper text, then try to finish signup on web and on native.
5. Try to type 30 characters.

**Expect:** An unknown code or a suspended affiliate's code still gives a successful signup with no referral row. 'admin' shows an inline reserved-code message. Native: an invalid code ('admin' or 'ab') shows the problem followed by 'Until it is fixed, you will sign up without a referral code.' Signup then succeeds without a referral. Web: 'admin' signs up without a referral. 'ab' should also never block the optional field: signup should either proceed without the code or stop before submitting with the inline message. The input stops at 24 characters. Known open issue I025: the web RegisterForm still sends a 1-2 character code, and the API answers 400 'Validation failed', which blocks web account creation.

**Needs:** Affiliate program

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/lib/referral.ts`, `packages/types/src/referralCode.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`

## AUTH-14 · P2 · Native referral deep links prefill the referral field

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** App installed and signed out. A valid affiliate code (e.g. 'kofi-media').

**Steps:**

1. From Notes or Messages on the phone, tap ujimora://register?ref=kofi-media.
2. Check the Register screen's referral field, then complete signup.
3. Sign out. Tap ujimora://?ref=kofi-media (the site root with a ref).
4. Tap https://app.ujimora.com?ref=kofi-media on the phone.

**Expect:** ujimora://register?ref=kofi-media opens Register with 'kofi-media' prefilled, and the new account is attributed to the affiliate. The root link ujimora://?ref=kofi-media also opens Register with the code prefilled, not the Home tab. The https link opens the browser and the web capture flow (AUTH-12) applies. Known open issue I152: Universal Links and App Links are not configured, so https links never open the app.

**Needs:** None

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/app/+native-intent.tsx`, `apps/mobile/app.json`

## AUTH-15 · P2 · Signup when the plans API is down still allows a Free account

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** Chrome DevTools request blocking. Fresh emails.

**Steps:**

1. In DevTools, block the URL pattern '*/plans/public'.
2. Go through /register to the Plan step with both agreement boxes ticked.
3. Look at the alert and the plan list. Keep 'Free' selected and click 'Create account'.
4. With a new email, repeat to the Plan step. Remove the block and click the Retry action.

**Expect:** The Plan step shows the skeleton, then 'We couldn’t load current prices. You can still create a Free account, or retry to see paid plans.' with Retry. A 'Free' card ('No monthly charge', price 'Free') is shown selected, and no paid plans are listed. 'Create account' is enabled, and the Free account is created (201) and lands on /dashboard. After Retry with the block removed, Free, Starter and Pro load with their live prices.

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

## AUTH-24 · P2 · Login input edge cases: email case, stray whitespace, padded MFA code, offline, double tap

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** Account user@example.com, plus an MFA-enabled account.

**Steps:**

1. Web and native: sign in as 'USER@Example.COM'.
2. Web and native: sign in as ' user@example.com ' with leading and trailing spaces (common with iOS autofill and keyboard suggestions).
3. Admin: repeat step 2.
4. Sign in with the correct email but the password with an extra trailing space.
5. MFA account: at the code step, paste the 6-digit code with a leading space.
6. Web: set DevTools to Offline and click Sign In. Native: turn on airplane mode and tap Sign In.
7. Double-click or double-tap Sign In.

**Expect:** Mixed-case and padded emails both sign in on web, native and admin, because the API now trims and lower-cases the email on login (and on register, forgot-password and reset-password). Passwords are never trimmed, so the padded password returns 'Invalid email or password'. The padded MFA code is accepted. Offline, the web shows 'Unable to connect to Ujimora. Check your connection and try again.' and native shows 'Could not reach Ujimora. Check your connection and try again.' without crashing. A double tap sends one request.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`, `apps/web/src/components/auth/LoginForm.tsx`, `apps/web/src/lib/api.ts`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/src/lib/api.ts`, `apps/admin/src/pages/LoginPage.tsx`, `apps/api/__tests__/integration/auth-email-normalisation.integration.test.ts`

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

## AUTH-43 · P2 · Admin change password keeps the console signed in

*Surfaces:* admin, api, email  ·  *Type:* functional

**Before:** Admin signed in on two browsers (A and B).

**Steps:**

1. Browser A, Admin Profile: change the password with valid values.
2. Browser A: click several sidebar pages and wait 30 s.
3. Browser B: click any page.
4. Sign out in A and sign in with the new password (plus the MFA code if enabled).

**Expect:** A shows 'Password changed successfully' and stays signed in; its pages keep loading with no redirect to /login. B is sent to /login on its next API call. Sign-in with the new password (and code) works. A 'Your Ujimora password changed' email arrives.

**Needs:** Resend

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/admin/src/context/AuthContext.tsx`, `apps/admin/src/lib/api.ts`

## AUTH-70 · P2 · Biometric unlock expires 7 days after the last password sign-in, with a clear message

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** A test device with biometric unlock on, used daily. JWT lifetimes are hardcoded (15m and 7d), so this is a real-time soak test.

**Steps:**

1. Sign in with the password and turn on biometric unlock (day 0). Read the explanation text in the biometric Settings section.
2. Every day for 8 days, open the app, tap 'Lock now' (or leave it for more than 60 s) and unlock, without any password sign-in.
3. On day 8, unlock.
4. Sign in with the password and check the biometric switch.

**Expect:** Settings says: 'Your account locks when you leave the app for more than a minute… Biometric unlock lasts 7 days after you turn it on or last sign in with your password; after that, sign in with your password to renew it.' Unlock works through day 7. On day 8 it fails with 'Biometric unlock has expired. It lasts 7 days after you turn it on or last sign in with your password. Sign in with your password, then turn it on again in Settings.'. After password sign-in the switch is Off and must be turned on again. Whether a weekly password sign-in is acceptable remains an owner decision.

**Needs:** Physical device, 8-day soak

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/components/BiometricSettings.tsx`, `apps/api/src/application/services/AuthTokenService.ts`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## AUTH-72 · P2 · Device backup and restore never carries the session over

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Signed in. A spare device for restores.

**Steps:**

1. iOS: make an encrypted Finder or iCloud backup, restore it to another iPhone, and open Ujimora.
2. Android: restore from Google backup (or adb backup) to another device and open Ujimora.

**Expect:** The user must sign in again on the restored device. Tokens are this-device-only, Android allowBackup is false, and the custom backup rules exclude secure data. The user name or cached profile must not appear signed in.

**Needs:** Spare devices

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/app.json`, `apps/mobile/plugins`

## AUTH-N005 · P2 · Web and admin load signed-out, not blank, when browser storage is blocked

*Surfaces:* admin, web  ·  *Type:* negative/edge

**Before:** Chrome with a site-data block for [*.]ujimora.com (Settings > Privacy and security > Site settings > 'Not allowed to save data on your device'), or Firefox with dom.storage.enabled=false.

**Steps:**

1. Open https://app.ujimora.com with DevTools Console open.
2. Browse Explore and a campaign page, and switch between light and dark mode.
3. Open /login and try to sign in. Note what happens.
4. Open https://admin.ujimora.com.
5. Remove the block and reload.

**Expect:** The web app renders. There is no blank white page and no uncaught SecurityError in the console. The header shows the signed-out state (Login and Get Started), and public pages work. The colour mode falls back to its default. The admin console shows its /login page. A session cannot be kept without storage: record what sign-in does, but the page must not crash, loop or blank. After the block is removed, sign-in works normally.

**Needs:** None

**Source:** `packages/ui/src/browserSession.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/__tests__/context/storageUnavailable.test.tsx`, `apps/admin/__tests__/components/ColorModeStorage.test.tsx`

## AUTH-N009 · P2 · Native sign-in returns only to safe in-app destinations

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** App installed and signed out. A test account.

**Steps:**

1. Open Profile > Dashboard, tap 'Sign In' and sign in.
2. Sign out. From Notes, tap ujimora://login?returnTo=%2F%2Fevil.example and sign in.
3. Sign out. Tap ujimora://login?returnTo=https%3A%2F%2Fevil.example and sign in.
4. Sign out. Tap ujimora://login?returnTo=%2F(auth)%2Fregister and sign in.
5. Sign out. Tap ujimora://login?returnTo=%2Fmy-donations and sign in.

**Expect:** Step 1 returns to the Dashboard. The protocol-relative, external and auth-screen destinations are ignored, and sign-in goes to the Home tab without opening a browser or another app. The /my-donations destination opens My donations after sign-in. The sign-in screens are removed from the back stack in every case, so Back does not return to them.

**Needs:** None

**Source:** `apps/mobile/src/navigation/returnTo.ts`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/src/components/SignInRequired.tsx`, `apps/mobile/app/(auth)/login.tsx`
