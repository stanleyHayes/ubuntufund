# Admin console (109 cases)

Staff access and roles, dashboards, reviews, payouts, refunds, users, audit logs, exports, content and settings.

[Back to the QA plan](../README.md)

## ADMIN-001 · P0 · Admin sign-in happy path lands on Dashboard

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Staging admin console (admin.ujimora.com equivalent) pointed at the staging API. Admin A (role=admin, MFA off) exists.

**Steps:**

1. Open /login.
2. Enter Admin A's email and password and click 'Sign in to workspace'.
3. In DevTools > Network, inspect the body of the POST /auth/login request.
4. Watch the redirect, the top bar and the area above the page content.
5. Open the user menu, then Profile (/profile).
6. As another admin, open /audit and search 'admin_login'.

**Expect:** The login request carries audience 'admin'. You are redirected to / (Dashboard) and the KPI tiles load without error banners. Because Admin A has no authenticator MFA, a warning banner shows above the content: 'Protect this administrator account: turn on authenticator app sign-in. A stolen password alone would give full access to donor data and payouts.' with a 'Turn on' button (see ADMIN-N002). The top bar shows Admin A's first name. The Profile header chip reads 'Administrator'. localStorage holds uf_admin_tokens, uf_admin_user (role 'admin') and uf_admin_token, plus the uf_admin_tokens:received timestamp key. The audit log has an info entry 'auth.admin_login.succeeded' with the text 'Administrator signed in to the staff console'.

**Needs:** None

**Source:** `apps/admin/src/pages/LoginPage.tsx`, `apps/admin/src/context/AuthContext.tsx`, `apps/admin/src/components/layout/AdminMfaPrompt.tsx`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `packages/ui/src/browserSession.ts`

## ADMIN-002 · P0 · Invalid credentials give a generic error, and login is rate limited

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A exists. Use one client IP.

**Steps:**

1. On /login, submit Admin A's email with a wrong password.
2. Submit an email that is not registered.
3. Submit empty fields.
4. Script 31 failed POST /api/v1/auth/login calls within 15 minutes from the same IP, then try the correct password.

**Expect:** Both wrong-password and unknown-email attempts show the same message: 'Invalid email or password'. There is no account enumeration and the timing looks similar. Empty fields show 'Enter your email address and password.' After 30 attempts in 15 minutes the API returns 429 and the UI shows the rate-limit message, even for the correct password, until the window resets.

**Needs:** None

**Source:** `apps/admin/src/pages/LoginPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## ADMIN-003 · P0 · Enrol authenticator MFA and receive recovery codes

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** MFA_ENCRYPTION_KEY is set on the API. Admin A has MFA off. Admin A is signed in on two browsers (X and Y). Have an authenticator app (Google Authenticator or 1Password).

**Steps:**

1. In browser X go to Settings > Security (or Profile > Security tab).
2. Start setup and enter a wrong current password. Then enter the correct one.
3. Scan the QR code, or use the manual secret. The issuer should be 'Ujimora'.
4. Enter a wrong 6-digit code, then the correct code, to enable.
5. Download the recovery codes file.
6. In browser Y, click any page that calls the API.

**Expect:** A wrong password gives 'Current password is incorrect.' and no enrollment is created. A wrong code is rejected. The correct code enables MFA. Ten 32-character recovery codes are shown once, and the file 'ujimora-recovery-codes.txt' downloads. Status reads 'Enabled · 10 recovery codes remaining'. Browser X stays signed in because its tokens are replaced. Browser Y is signed out (401, redirect to /login) because authVersion rotated. The audit log has an 'mfa.enabled' entry.

**Needs:** MFA_ENCRYPTION_KEY, authenticator app

**Source:** `packages/ui MfaSettings`, `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`

## ADMIN-004 · P0 · MFA challenge at login: wrong, replayed and brute-forced codes

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A has MFA enabled (ADMIN-003).

**Steps:**

1. Sign out. On /login enter the correct email and password.
2. Confirm the OTP input appears with the message about the authenticator code.
3. Enter a wrong 6-digit code.
4. Enter the current valid code and sign in.
5. Sign out and immediately reuse the same code within the same 30-second window.
6. Submit 10 wrong codes in a row, then a correct one.

**Expect:** The password alone never issues tokens. A wrong code shows 'Enter a valid authenticator code or an unused recovery code.' A valid code signs you in. A replayed code from the same time step is rejected (lastCounter check). After 10 attempts in 10 minutes the API returns 429 'Too many code attempts. Try again in 10 minutes.', even for a correct code.

**Needs:** Authenticator app

**Source:** `apps/admin/src/pages/LoginPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`

## ADMIN-005 · P0 · Recovery codes are single-use; regenerate and disable MFA

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A has MFA enabled and holds 10 saved recovery codes.

**Steps:**

1. At login, click 'Use a recovery code' and enter one code.
2. Sign out and try the same recovery code again.
3. Go to Settings > Security. It should show 9 remaining.
4. Regenerate recovery codes (password plus current TOTP) and try an old unused code at the next login.
5. Disable MFA with password plus a code. Then sign in with the password only.

**Expect:** The first use succeeds. Reusing it is rejected. The remaining count drops to 9. After regeneration, old codes fail and new ones work. Each change rotates sessions: other sessions are signed out and the audit log records mfa.recovery-regenerated and mfa.disabled. After disabling, a password-only login works.

**Needs:** Authenticator app

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`

## ADMIN-007 · P0 · Forgot password end-to-end for a staff account

*Surfaces:* admin, api, email, web  ·  *Type:* security/permission

**Before:** Email provider (Resend) configured. Admin A signed in on another browser.

**Steps:**

1. Open /forgot-password and submit an unregistered email.
2. Submit Admin A's email.
3. Open the email and follow the link. It should go to app.ujimora.com/reset-password#token=...
4. Set a new password and submit. Reuse the same link a second time.
5. Return to the other browser session and click anything.
6. Sign in to the admin console with the old password, then with the new one.
7. Temporarily unset the email provider and submit the form.

**Expect:** Both emails show the same 'Check your inbox.' screen, with about 500 ms minimum response padding. Only the registered address receives mail. The token works once; reuse gives 'Invalid or expired reset token'. The other session is signed out because authVersion rotated. The old password fails and the new one works. With email unconfigured the page shows 'Password recovery is temporarily unavailable…' (503).

**Needs:** Email provider (Resend)

**Source:** `apps/admin/src/pages/ForgotPasswordPage.tsx`, `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/api/src/domain/entities/User.ts`

## ADMIN-009 · P0 · Session refresh, idle timeout, logout and cross-tab sync

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A signed in. Two tabs of the console open.

**Steps:**

1. Leave tab 1 active on the Dashboard for more than 16 minutes (past the access-token expiry), moving the mouse occasionally.
2. Leave both tabs completely idle for more than 60 minutes, then click.
3. Sign in again. In tab 1 use the user menu > Sign out.
4. Check tab 2 and use the browser Back button in tab 1.
5. Tamper with uf_admin_token in localStorage (invalid JWT) and reload.

**Expect:** The token refreshes silently (POST /auth/refresh) with no logout at 15 minutes. After 60 minutes idle, the session expires and you are sent to /login. Sign out clears storage in both tabs; tab 2 reacts through the storage event. Back does not show admin data. A tampered token gives a 401 and a redirect to /login with 'Your session has expired. Please sign in again.'

**Needs:** None

**Source:** `packages/ui/src/browserSession.ts`, `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/session.ts`, `apps/admin/src/components/layout/TopBar.tsx`

## ADMIN-011 · P0 · No default or seeded admin credentials in production

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Production console (read-only check). An engineer with a local checkout for the seed-script check. Atlas read access.

**Steps:**

1. On production /login try admin@ujimora.com / Admin2026! (the old seed-dev.mjs credentials).
2. Ask engineering to run apps/api/scripts/seed-dev.mjs with NODE_ENV=production, then with a mongodb+srv:// MONGODB_URI, then against a local database without SEED_ADMIN_PASSWORD set.
3. In Users, filter Role = admin and review every admin account. In Atlas, search for admin@ujimora.com, amara2@ujimora.com and any *@ujimora.dev accounts.
4. Sign in as each real admin and note whether the MFA warning banner appears.

**Expect:** The seed credentials fail. The seed script exits with an error before connecting when NODE_ENV=production or the URI is mongodb+srv or any host other than localhost/127.0.0.1/::1 (unless SEED_ALLOW_REMOTE=I_UNDERSTAND_THIS_WIPES_DATA is set). Against a local database it creates no admin unless SEED_ADMIN_PASSWORD is set; the literal password is no longer in the script. The admin list contains only named, authorised staff and no seed or test accounts. Each admin without authenticator MFA sees the 'Protect this administrator account…' banner on every page; record MFA status for every admin. Known open issue I028: admin MFA is still optional in code (the banner is only a reminder), so enforcement remains procedural.

**Needs:** Production access, engineering support

**Source:** `apps/api/scripts/seed-dev.mjs`, `apps/api/scripts/seedGuard.mjs`, `apps/admin/src/components/layout/AdminMfaPrompt.tsx`, `apps/admin/src/pages/UsersPage.tsx`, `docs/compliance/STAFF_ACCESS.md`

## ADMIN-012 · P0 · Non-admin accounts are refused at staff-console sign-in

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Regular user U1 (role=user) and organisation user O1 (role=organization) with known passwords. A non-admin U2 with authenticator MFA enabled. U1 also signed in on the member web app. Postman or curl.

**Steps:**

1. On the admin /login, sign in as U1 with the correct password.
2. Check the URL and the uf_admin_* keys in localStorage.
3. Repeat as O1, and as U2 (password, then authenticator code).
4. API: POST /api/v1/auth/login with U1's credentials and audience 'admin'; then without audience; then with audience 'staff'.
5. With U1's member access token, call GET /api/v1/analytics/overview and GET /api/v1/rbac/me.
6. Plant a non-admin session: copy U1's web tokens into uf_admin_token and uf_admin_tokens, set uf_admin_user to U1's user JSON (role 'user'), and reload /campaigns.
7. As Admin A, open /audit and search 'admin_console'.

**Expect:** The login page shows 'This account does not have staff access.' and stays on /login. Nothing is written to uf_admin_*, and no Dashboard, sidebar or platform data renders. For U2 the refusal comes only after the code is checked. API: with audience 'admin' the response is 403 'This account does not have staff access.' with no tokens in the body; without audience the member login still returns 200; audience 'staff' returns 400 'Validation failed'. /analytics/overview returns 403 'Insufficient permissions'. /rbac/me returns 200 with permissions [] and roleName ''. The planted session counts as signed out and redirects to /login. The audit log has warning entries 'auth.admin_console.refused' ('Staff console sign-in refused: account is not an administrator') for U1, O1 and U2. Any page that shows platform data to a non-admin is a P0 defect.

**Needs:** None

**Source:** `apps/admin/src/context/AuthContext.tsx`, `apps/admin/src/components/AuthGuard.tsx`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/analyticsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`

## ADMIN-013 · P0 · API authorisation sweep: every admin endpoint rejects logged-out and non-admin callers

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Postman/curl collection. U1 access token. No token.

**Steps:**

1. With no Authorization header, call GET /users, /audit, /kyc/pending, /payouts, /payouts/review-queue, /admin/action-center, /admin/refund-operations, /admin/payments, /admin/data-rights, /admin/privacy-requests, /admin/store-billing, /admin/safety-reports, /admin/publication-reviews, /admin/commercial-config, /admin/automatic-payouts, /subscriptions, /coupons, /affiliates, /disputes, /reports, /analytics/reports, /newsletter/subscribers, /contact, /testimonials/admin, /ai-writing/usage, /blog/admin/posts, /admin/wallets, /admin/donations.
2. Repeat each call with U1's token.
3. With U1's token, try mutations: PUT /campaigns/:id/review, PUT /kyc/:id/approve, POST /payouts/:id/approve, POST /admin/payments/:id/refund, PUT /plans/pro, POST /coupons, PUT /content/faq, PUT /admin/commercial-config/earlyFeePercent, PATCH /payment-providers/:id/toggle, POST /admin/crypto/reconcile, PUT /users/:id/compliance-limit.

**Expect:** Every call returns 401 without a token and 403 'Insufficient permissions' with U1's token. No state changes, confirmed by DB and audit log (4xx mutations are logged as severity 'warning'). Queue responses carry Cache-Control private, no-store.

**Needs:** None

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`

## ADMIN-015 · P0 · Demoting or deleting an admin takes effect immediately

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin B signed in, with a pending payout and a pending KYC available. DB access.

**Steps:**

1. In the DB, set Admin B role='user' while B stays on /payouts.
2. As B, click Approve on a payout (with a review note) and on a KYC.
3. As B, start an Export.
4. Restore the role. Then soft-delete B (deletedAt) and have B click anything.

**Expect:** After demotion, B's mutations fail with 403 ('Insufficient permissions' or 'Current administrator access is required'). Export aborts before download. After deletion, the next call returns 401 'Account is no longer available' and B is sent to /login. No approval is recorded for B.

**Needs:** DB access

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/ExportMenu.tsx`

## ADMIN-017 · P0 · Dashboard KPI accuracy against a controlled data set

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Staging DB with a known fixture: N users (one soft-deleted), campaigns in each status, settled GHS donations of known amounts (one with a platform tip, one partly refunded through the refund tools, one guest donation), K pending KYC, one KYC approved today and one rejected today (UTC), P pending campaign reports and D open disputes.

**Steps:**

1. Open the Dashboard (/).
2. Compare 'Net raised (GH₵, after refunds)', 'Active Campaigns', 'Total Users', 'Pending campaign reports', 'Pending KYC', 'KYC Approved Today' and 'KYC Rejected Today' with hand-calculated values.
3. Check the Donations and Disputes navigation tiles.
4. Open Overview and check average donation, conversion % and monthly growth %.
5. Export the Overview as CSV.

**Expect:** Total Users excludes deleted users. Active Campaigns equals the count with status=active. 'Net raised (GH₵, after refunds)' equals the sum of GHS (and legacy no-currency) Donation.amount minus the provider refunds recorded on the payments, with tips excluded, shown as 'GH₵ x'. Average donation equals net GHS raised divided by the number of GHS donations, rounded to 2 dp. Conversion equals distinct donor accounts (guest donations excluded) divided by users × 100. 'Pending campaign reports' equals P (pending campaign reports), not the Disputes collection. The Disputes navigation tile shows no count (description 'open disputes'); the Donations tile says 'net raised (GH₵, after refunds)'. The Overview export headers read 'Net raised (GHS, after refunds)' and 'Pending campaign reports'. All values match the fixture exactly.

**Needs:** DB fixtures

**Source:** `apps/admin/src/pages/DashboardPage.tsx`, `apps/admin/src/pages/OverviewPage.tsx`, `apps/admin/src/lib/exports/tables.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`

## ADMIN-026 · P0 · Approve a pending campaign with attestations and evidence

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Campaign C in pending_review, created by verified user U1 (verificationLevel ≥ 1, current legal acceptance, GHS goal, future end date). Admin A is not the creator.

**Steps:**

1. Campaigns > 'Pending' tab > open C.
2. Open each 'Open attachment n' link.
3. Type notes shorter than 20 characters and check that Approve is disabled.
4. Type notes of 20 or more characters and tick both checkboxes ('I reviewed the complete public content…' and 'I reviewed organizer verification…').
5. Click 'Approve campaign'.
6. Check Review history, the audit log and the public campaign page on web and mobile.

**Expect:** Approve stays disabled until notes are at least 20 characters and both boxes are ticked. After approval, status is active (or funded if already at goal). The history shows 'approve · pending_review → active', the version hash, your admin ID, and the snapshot (title, story, beneficiaries, goal, slug, media). The audit log shows a 'campaign.approve' entry with the reason. The campaign is visible and donatable on web and mobile.

**Needs:** None

**Source:** `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.ts`

## ADMIN-027 · P0 · Reject, block and return-to-review transitions

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Pending campaign P, active campaign A with an active LIVE session, blocked campaign B.

**Steps:**

1. Reject P with notes of 20 or more characters.
2. Block A with notes.
3. On B click 'Return to review'.
4. Through the API, try reject on A (active) and approve on B while it is still blocked.

**Expect:** P becomes blocked and is not publicly visible. A becomes blocked; its live sessions end (status ended, providerStopPending=true, overlay token cleared) and the public page disappears; funds are unchanged. B becomes pending_review and stays private. Rejecting a non-pending campaign returns 409 'Only pending campaigns can be rejected'. Blocking an already blocked campaign returns 409. Each decision appears in the history and the audit log with severity warning.

**Needs:** LiveKit (for the live-stop check)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`

## ADMIN-028 · P0 · Campaign approval guardrails (compliance)

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Pending campaigns prepared: (a) created by Admin A; (b) organiser verificationLevel 0; (c) goal above the organiser's compliance limit; (d) goal currency not GHS; (e) end date passed; (f) organiser has a content restriction; (g) organiser has not accepted the current agreement; (h) organiser already over their KYC campaign allowance.

**Steps:**

1. As Admin A, try to approve each campaign with valid notes and attestations.
2. For (a), check the panel message.
3. Call PUT /campaigns/:id/review without contentReviewed or fundraisingReviewed.

**Expect:** (a) The panel shows 'Another administrator must review your campaign.' and the API returns 403. (b) and (c): 409 'Current organizer verification or compliance limits do not permit approval'. (d): 409 'A valid positive GHS goal is required'. (e): 409 'An expired campaign cannot be approved'. (f): 409 'organizer is unavailable or publishing is restricted'. (g): 409 'must accept the current account agreement'. (h): 409 'Renew verification before approval'. Missing attestations: 400. No status change.

**Needs:** DB fixtures

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## ADMIN-029 · P0 · Campaign review concurrency and double-submit

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Pending campaign C open in Admin A's and Admin B's browsers.

**Steps:**

1. U1 edits C's story on web after A has loaded the page.
2. A approves: expect a conflict. A clicks 'Reload'.
3. A and B both fill in notes and click Approve at the same moment.
4. A double-clicks Approve on another pending campaign.

**Expect:** A's stale approval returns 409 'The campaign changed. Reload and review the current version.' The second concurrent decision gets 409 'A different final decision already exists for this campaign version', or succeeds silently only if it is the same actor, action and notes. A double-click produces exactly one CampaignReview record and one audit entry.

**Needs:** Two admin accounts

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`

## ADMIN-032 · P0 · Campaign tier thresholds and auto-approve settings save all-or-nothing

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Admin A. Settings > Campaigns tab.

**Steps:**

1. Enter thresholds out of order (for example 50000, 10000, ...) and check that Save is disabled.
2. Enter an invalid alert email and check that Save is disabled.
3. Set the auto-approve tier to 2 and thresholds to 10000, 50000, 250000, 1000000, then Save. Watch the Network tab.
4. Create a GHS 40,000 campaign (tier 2) and a GHS 60,000 campaign (tier 3) as a verified user.
5. Change the values again, set DevTools offline (or block PUT /admin/commercial-config) and click Save. Go back online and reload Settings.
6. API: PUT /api/v1/admin/commercial-config with non-ascending thresholds, with the same key twice, and with an empty changes list.
7. Check GET /admin/commercial-config/:key/history for the tier and each threshold.

**Expect:** Save is disabled for invalid input. Save sends exactly one PUT /admin/commercial-config with a changes list of the six keys (tier, four thresholds, alert email) and the reason 'Campaign review settings updated from platform settings'. The success message reads 'Saved. New campaigns use these rules, and held ones are announced to <email>. Anything already waiting still needs approving.' (or the 'alerts are off' variant for a blank email). The tier-2 campaign goes live immediately and the tier-3 campaign goes to pending_review; existing campaigns are unaffected. The interrupted save shows an error and, after reload, every setting still has its previous value: nothing is partly updated. The API refuses bad batches with 400 and writes nothing: 'Tier thresholds must be positive and strictly ascending.', 'Each setting may appear only once.', 'changes must list between 1 and 25 settings.' History shows one row per key with the same effective time, the actor, the reason and the value.

**Needs:** None

**Source:** `apps/admin/src/components/CampaignReviewSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## ADMIN-033 · P0 · Approve identity KYC with private document review

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** U2 submitted identity KYC on web or mobile: adult DOB, full name, ID card and selfie uploaded via the private uploader (kyc:// references). Cloudinary authenticated delivery configured.

**Steps:**

1. Open /kyc-review, filter Status=pending, and open U2's application.
2. Check that the document previews load. Click 'Open original', wait more than 60 s, then click 'Refresh expiring link'.
3. Try Approve with notes shorter than 20 characters or with the evidence box unticked.
4. Enter 'Internal review findings' of 20 or more characters, tick 'I reviewed the application…', and click Approve.
5. Check U2's account on web and mobile, and the audit log.

**Expect:** Previews load through 60-second signed links. An expired link fails until refreshed. Approve is disabled until the notes and the tick are present (the API returns 422 otherwise). After approval the status is approved, expiry is 365 days from now, and U2's verificationLevel is NATIONAL_ID (2), which unlocks campaign creation. The audit log shows 'kyc.approved' with 'staff attested evidence review'. The documents are locked.

**Needs:** Cloudinary

**Source:** `apps/admin/src/pages/KYCReviewPage.tsx`, `apps/admin/src/components/kyc/KYCDetailDialog.tsx`, `apps/admin/src/components/kyc/KYCDocumentPreview.tsx`, `apps/api/src/application/use-cases/ApproveKYCUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`

## ADMIN-034 · P0 · KYC approval validation rules by verification type

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Pending KYC records: identity with only a selfie; identity with DOB under 18; identity without a full name; address without a GhanaPost GPS address or utility bill; business submitted by a role=user account; business missing controlPersons or declaration or authorization_letter.

**Steps:**

1. Try to approve each record with valid notes and attestation.

**Expect:** Each is refused with a 422 and a specific message: 'requires an identity document. A selfie…'; 'valid adult date of birth'; 'applicant full name'; 'Address approval requires a country, city and valid GhanaPost GPS…'; 'Organization approval requires an active organization account'; 'complete declared controlling persons…' or 'authority and accuracy declarations'. Status and verificationLevel do not change.

**Needs:** DB fixtures

**Source:** `apps/api/src/application/use-cases/ApproveKYCUseCase.ts`

## ADMIN-035 · P0 · Reject KYC with an applicant-visible reason

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Pending KYC for U3.

**Steps:**

1. From /kyc-review (or the /verifications Reject button), click Reject.
2. Type a reason shorter than 20 characters and check that 'Save rejection' is disabled. Check the counter shows '/1000'.
3. Enter a proper reason and save.
4. As U3 on web and mobile, view the KYC status and resubmit.

**Expect:** The dialog says the reason is visible to the applicant. After saving, the status is rejected and U3 sees the exact reason. Resubmission creates a new pending record. The audit log shows 'kyc.rejected'.

**Needs:** None

**Source:** `apps/admin/src/components/kyc/KYCRejectDialog.tsx`, `apps/admin/src/pages/VerificationsPage.tsx`, `apps/api/src/application/use-cases/RejectKYCUseCase.ts`

## ADMIN-037 · P0 · KYC self-review, stale version and concurrent decisions

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Admin A has their own pending KYC. Pending KYC K open in Admin A's and Admin B's browsers.

**Steps:**

1. Admin A tries to approve or reject their own KYC.
2. The applicant updates K (responds or uploads) after A loaded it; A then approves.
3. A and B click Approve on K at the same time.
4. Call PUT /kyc/:id/approve without reviewVersion.

**Expect:** Self-review returns 403 'Another administrator must review your verification.' A stale decision returns 409 'This application has changed. Refresh the queue…'. Of the concurrent pair, one wins and the other gets 409 'This verification already has a decision.' A missing version returns 428. Only one audit record per decision.

**Needs:** Two admin accounts

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`

## ADMIN-038 · P0 · KYC document privacy and export exclusion

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A private KYC document kyc://<id> belonging to U2. U1's token.

**Steps:**

1. As U1, call GET /uploads/kyc/<id>/access.
2. As admin, copy a signed document URL and open it in an incognito window after 60 seconds.
3. Export the KYC review queue as CSV, XLSX and PDF.
4. Open a legacy record with a public https document URL.

**Expect:** U1 gets 403 or 404. The copied signed URL no longer works after expiry. Exports contain ID, account, name, type, status, risk and dates only, with no document URLs or ID numbers. Legacy URLs show the 'Legacy document link…' warning.

**Needs:** Cloudinary

**Source:** `apps/admin/src/components/kyc/KYCDocumentPreview.tsx`, `apps/admin/src/pages/KYCReviewPage.tsx`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`

## ADMIN-041 · P0 · Set, raise and clear a user's compliance campaign limit

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Verified organiser U1 whose plan cap is GHS 50,000.

**Steps:**

1. On U1's detail page, under Compliance limit, enter -5 and Save.
2. Enter 20000 with a reason and Save. As U1 on web, create a GHS 30,000 campaign.
3. Enter 'unlimited' and Save. Create a GHS 80,000 campaign.
4. Clear the field and Save.
5. Check the audit log.

**Expect:** -5 shows a client error. At 20000 the display is 'GHS 20,000' and the GHS 30k campaign is refused at creation (or approval returns 409); the effective cap is min(plan cap, limit). 'unlimited' saves -1 ('Unlimited (approved)') and allows above the plan cap. Blank shows 'None (plan cap only)'. Each change creates an audit entry 'compliance-limit.set' with before and after values and the reason.

**Needs:** None

**Source:** `apps/admin/src/pages/UserDetailPage.tsx`, `apps/api/src/application/use-cases/SetComplianceLimitUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## ADMIN-044 · P0 · Approve a standard campaign payout end to end (Paystack)

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** Paystack test secret key, test transfer balance funded, webhook pointed at staging. Campaign owner U1 has a verified email, a current approved identity KYC (not expired, no renewal pending), and a bank or MoMo recipient that U1 registered under the same Paystack mode (test) as the API. The campaign is active or funded, not blocked, has no open dispute, and has GHS 1,000 cleared available balance. U1 requests a standard payout of GHS 500. Admin A is neither the campaign owner nor the requester. PAYOUT_DUAL_APPROVAL_AMOUNT=0.

**Steps:**

1. On /payouts (queue view), find the card: 'GHS 500.00 · Standard · Bank / MoMo'.
2. Click 'Review payout destination'. Compare the supplied name with the provider-resolved name.
3. Enter a destination review note of 20 or more characters and click Approve.
4. Wait for the transfer.success webhook and refresh.
5. Check the campaign balance, ledger or journal, U1's web cashout history, and the audit log.

**Expect:** Approve is disabled until the recipient is loaded and the note is at least 20 characters. After approval the notice reads 'Payout approved; the transfer is initiating.' and the status is PROCESSING, with a Paystack reference in Technical details. After the webhook the chip shows 'Completed' (PAID). The campaign available balance drops by the gross amount. Fee and Net on the card match the fee rule (0 for standard). The net sent equals the Paystack transfer amount in pesewas. U1 sees the completed payout. The audit log shows 'Approve' on payouts with the payout, campaign and amount. If any precondition is not met (owner KYC, campaign state, approver identity, recipient mode) the approval is refused instead; see ADMIN-N009 and ADMIN-N010.

**Needs:** Paystack test keys and webhook

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`, `apps/api/src/application/use-cases/HandlePayoutWebhookUseCase.ts`

## ADMIN-045 · P0 · Payout fee and net accuracy across payout types

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Fee env at render.yaml defaults: priority 0.5% (min GHS 10), early 1.0% (min 20), urgent 1.5% (min 30), assisted 1.5% + 50. Settings > Payments early cashout surcharge noted.

**Steps:**

1. As U1, request payouts of GHS 1,000, 1,234.57 and 100 for each type. Include one early cashout on an active campaign.
2. On /payouts, read Fee and Net on each card and in the export.
3. Change 'Additional early cashout (%)' in Settings and request a new early payout.
4. Try approving a standard payout on a campaign that requires early cashout.

**Expect:** Fee = max(pct × gross, min fee), rounded to 2 dp, with net = gross − fee. For example, priority on 100 gives fee 10.00 and net 90.00; urgent on 1,234.57 gives 30.00 (1.5% = 18.52, so the minimum applies). The export keeps Gross, Fee and Net separate. A new surcharge applies only to new requests. Standard-on-early returns 422 'Early cashout requires an early or urgent request…'.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/payoutFee.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/admin/src/components/EarlyCashoutSettings.tsx`, `render.yaml`

## ADMIN-046 · P0 · Maker-checker dual approval for high-value payouts

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** PAYOUT_DUAL_APPROVAL_AMOUNT=1000 on staging. Payout of GHS 1,500 pending on a campaign owned by neither admin. Admins A and B.

**Steps:**

1. Admin A reviews the destination, adds a note and clicks Approve.
2. Admin A clicks 'Give 2nd approval' on the same payout.
3. Admin B reviews the destination, adds a note and clicks 'Give 2nd approval'.
4. Read the production API startup logs and record the production value of PAYOUT_DUAL_APPROVAL_AMOUNT.

**Expect:** After A: 'First approval recorded — a second admin must approve.' The status stays PENDING with a '1st approval: <A>' detail and the maker-checker info alert. A's second attempt returns 409 'A second, different admin must approve this high-value payout'. B's approval initiates the transfer (PROCESSING). While production runs with 0, the API logs at startup: 'PAYOUT_DUAL_APPROVAL_AMOUNT is 0: every campaign and beneficiary payout needs only one admin approval (maker-checker is off). …' The owner must sign off on the production threshold before launch. Known open issue I029: render.yaml still ships 0 as an accepted risk (recorded in docs/compliance/STAFF_ACCESS.md), so maker-checker stays off in production until a threshold is set.

**Needs:** Two admin accounts, Paystack test keys

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/infrastructure/config/payoutControls.ts`, `apps/api/src/infrastructure/config/index.ts`, `render.yaml`, `docs/compliance/STAFF_ACCESS.md`

## ADMIN-047 · P0 · Payout approval guardrails and batching

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Paystack test mode. PAYOUT_MAX_TRANSFER_AMOUNT=50000. Payouts prepared: (a) above the Paystack test balance; (b) PROCESSING; (c) wallet payout whose recipient is not the owner; (d) MoMo payout of GHS 60,000; (e) urgent bank payout of GHS 60,000; (f) standard bank payout of GHS 120,000.

**Steps:**

1. Approve each payout with a valid note.
2. Temporarily unset PAYSTACK_SECRET_KEY and approve a bank payout.

**Expect:** (a) 422 'Insufficient platform balance to fund this payout'. (b) 409 'cannot be approved in state PROCESSING'. (c) 409 'Wallet destination must belong to the campaign owner'. (d) 422 'MoMo transfers are not automatically split…'. (e) 422 'Expedited payouts above the GHS 50000 single-transfer ceiling…'. (f) Accepted; the card shows 'Legs 3 (0 settled)' and each leg settles separately. No key: 501 'Payouts are not configured'. Money is never left in transit after a failure.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/services/payoutBatch.ts`

## ADMIN-048 · P0 · Payout approval idempotency: double-click and concurrent admins

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Pending GHS 300 payout (below the dual threshold). Admins A and B viewing it.

**Steps:**

1. Admin A double-clicks Approve quickly.
2. Reset with a new payout. A and B approve at the same second.
3. Inspect the Paystack dashboard transfers and the campaign balance.

**Expect:** Exactly one Paystack transfer (one pout-<id>-xxxx reference). The second request gets 409 'Payout is no longer pending approval'. The campaign balance is reserved once. The UI shows the error without leaving a stuck 'Approving…' state.

**Needs:** Paystack test keys, two admin accounts

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

## ADMIN-049 · P0 · Transfer failure, reversal, webhook replay and partial batches

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** PROCESSING payouts in Paystack test mode. Ability to send signed test webhooks and replay them.

**Steps:**

1. Send transfer.failed for payout P1.
2. Replay the same transfer.failed event.
3. Send transfer.success then transfer.reversed for P2.
4. Send transfer.success twice for P3.
5. For a batched payout, fail one leg after another succeeds.
6. Send a webhook with an invalid signature.

**Expect:** P1 becomes FAILED and the reserved gross returns to the campaign available balance exactly once, even after the replay. P2 becomes REVERSED with funds returned once. P3 settles once with no duplicate ledger lines. The partial batch becomes NEEDS_REVIEW with 'Partially settled — some transfer legs failed…' and appears in the action center. An invalid signature is rejected with no state change.

**Needs:** Paystack test keys and webhook tooling

**Source:** `apps/api/src/application/use-cases/HandlePayoutWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

## ADMIN-051 · P0 · Ujimora Wallet payout credits the owner exactly once

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** U1 requests a campaign payout to their Ujimora Wallet (provider ujimora_wallet) for GHS 250.

**Steps:**

1. Review the destination. It should read 'Ujimora Wallet belonging to campaign owner <id>…'.
2. Add a note and Approve. Double-click to test repeat submission.
3. Check U1's wallet balance and transactions on web and mobile.

**Expect:** No Paystack transfer is created. The wallet is credited with the net amount once. The payout is PAID. The campaign balance drops by the gross amount. The wallet transaction reference links to the payout. A repeat approval gets 409 with no second credit.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`

## ADMIN-052 · P0 · Automatic payout policy and eligibility reasons

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Settings > Payments > Automatic payouts. Paystack test keys. Payout fixtures: a small reviewed bank payout; a large one; one for an unverified owner; one for a campaign with an open dispute; a MoMo payout above the MoMo limit; a destination review older than the maximum age.

**Steps:**

1. Try saving invalid limits (MoMo max above per-request max; owner/day above platform/day; per-request above 50,000).
2. Save a valid policy with 'Enable automatic payouts' on.
3. Have users request each fixture payout.
4. Turn the policy off and request a small payout.

**Expect:** Invalid limits are rejected ('Limits must increase from MoMo to per-request to owner/day to platform/day.'). A saved policy increments its revision and adds a history row. The eligible payout auto-approves (system:auto-payout) and moves to PROCESSING. Others stay PENDING with an automationReason shown on the card: 'Amount exceeds automatic approval limits.', 'Owner verification is required.', 'Campaign has an unresolved dispute.', 'Amount exceeds automatic MoMo limit.', or a review-age reason. Payouts at or above the dual-approval threshold never auto-approve. With the policy off: 'Automatic payouts are disabled.'

**Needs:** Paystack test keys

**Source:** `apps/admin/src/components/AutomaticPayoutSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`

## ADMIN-053 · P0 · Beneficiary (split) payout approval with destination review note

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true. Campaign with an active split. A beneficiary has a registered recipient and requested a GHS 400 payout. Paystack test keys. Admins A and B, neither the campaign owner nor the beneficiary.

**Steps:**

1. Open /payouts?view=beneficiary and find the PENDING card. Check the Approve button.
2. Click 'Review payout destination' and read the destination alert.
3. Via API, POST /beneficiary-payouts/:id/approve with a valid reviewNote before KYC is verified.
4. Click 'Verify KYC'.
5. Type a destination review note under 20 characters, then one of 20 or more, and click Approve.
6. Via API, POST /beneficiary-payouts/:id/approve with {} on another pending payout.
7. With the dual threshold at or below 400, repeat with Admin A then Admin B, each reviewing the destination and writing a note.
8. Replace the beneficiary's destination after a request, then click 'Review payout destination' again.
9. Set SPLIT_PROCEEDS_ENABLED=false and open the view.

**Expect:** Approve stays disabled until the destination is loaded, KYC is verified and the note has at least 20 characters. The alert reads '<Mobile money|Bank> account <number> · <bank code> · name on request: <name> · GHS. KYC is not verified for this destination. The name on the request is not proof of ownership.' The API refuses approval before verification with 422 'Beneficiary KYC must be verified before payout'. 'Verify KYC' shows only while unverified; afterwards the notice 'Beneficiary KYC verified.' appears and the alert says 'KYC verified <time>. A changed destination resets verification.' Approval shows 'Beneficiary payout approved; the transfer is initiating.', reserves the beneficiary and campaign balances, and stores the note on the payout; the destination route never returns the recipient code. An approval without a note returns 400 'Validation failed'. Maker-checker: A gets 'First approval recorded — a second admin must approve.', B completes it and both notes are stored. A replaced destination returns 409 'Payout destination was replaced; create a new payout request.' With the flag off, the queue shows an error or empty state, not a crash. Known open issue I029: the production threshold is 0, so one approver is enough.

**Needs:** SPLIT_PROCEEDS_ENABLED, Paystack test keys

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/BeneficiaryPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutAuthorization.ts`

## ADMIN-056 · P0 · Admin-initiated refund from the Payments page: full, partial, idempotency and rounding

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Settled Paystack test contribution I of GHS 100.00 with a recorded platform fee, funds still pending (not paid out). A second settled contribution on a campaign whose funds were already paid out. A third fresh settled contribution for the API idempotency check. Paystack test keys.

**Steps:**

1. Open Finance > Payments (/payments), search I's Paystack reference, click 'View timeline', then 'Refund payment'.
2. In the dialog enter 150 and read the helper. Enter 33.33, try to submit without the checkbox, then tick 'I have checked this refund is approved and the amount is correct.' and double-click the Refund button.
3. Reopen the dialog, enter 70 and submit.
4. Reopen the dialog and refund the remaining 66.67.
5. Via API, POST /api/v1/admin/payments/<third>/refund {amount: 10, idempotencyKey: 'k1'} twice.
6. Refund the paid-out contribution from the Payments page.
7. Check the Paystack refund, contribution status, campaign pending balance, compensating journal and the donor's web history.

**Expect:** The dialog warns that the refund cannot be undone, that only the campaign amount (not a separate platform tip) is refunded, and that funds already paid out cannot be refunded here. The submit button stays disabled until the amount is above 0 and at most 100 and the box is ticked; 150 shows 'Enter an amount above 0 and up to 100'; 33.33 shows 'Partial refund'. The double-click sends one request and shows 'Refund of GH₵33.33 confirmed by the provider (reference …).' Status becomes PARTIALLY_REFUNDED; beneficiary net, platform fee and processor fee are split in proportion and sum exactly to 33.33, with rounding on the processor-fee leg. The 70 refund returns 409 'This refund was already processed or would exceed the refundable amount'. The remainder makes the status REFUNDED and the 'Refund payment' button disappears. The repeated k1 call returns 409 and Paystack shows only one refund. The paid-out contribution returns 409 'These funds appear already disbursed; a manual clawback is required'. If Paystack is still processing, the dialog says 'The provider is still processing this refund. Follow it in Refund recovery; do not submit it again.' Original settlement journals are unchanged. Known open issue I036: refunds have no maker-checker, and there are still no console buttons for re-verify or reconciliation sweeps, or admin views for creator tips and withdrawals.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/PaymentsPage.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `docs/compliance/REFUNDS_AND_FEES.md`

## ADMIN-057 · P0 · Refund recovery queue after an uncertain provider outcome

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Refund operations in states submitting or provider_unknown (simulate a Paystack timeout during the refund call), provider_pending, and reversal_pending. Paystack test keys.

**Steps:**

1. Open /refund-recovery and check each card's labels and the funds-hold text.
2. For an operation with no provider reference, type a non-numeric ID and check that the button is disabled. Enter the numeric refund ID from the Paystack dashboard and click 'Verify provider status'.
3. On a reversal_pending card click 'Finish accounting'. Click it twice in two tabs.
4. While a hold exists, try a campaign payout that would use the held funds.

**Expect:** Labels read 'Outcome not yet confirmed', 'Provider processing', 'Accounting needs completion'. There is no resend or release button. If still pending: 'The provider is still processing this refund. No replacement refund was requested.' If processed: 'Local accounting completed…' and the row leaves the queue. The concurrent finish completes once. Held funds are excluded from payout eligibility. A mismatched refund ID is rejected.

**Needs:** Paystack test keys, network fault injection

**Source:** `apps/admin/src/pages/RefundOperationsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `docs/compliance/REFUND_RECOVERY.md`

## ADMIN-058 · P0 · Donor refund requests reach the staff Refund requests queue

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Donor D1 with two settled Paystack donations (funds not paid out) and refund activity alerts turned on. Admin A.

**Steps:**

1. As D1 on web, open the refund request page for the first donation and submit a request (reason and description). Confirm D1 sees it under My Refunds.
2. As Admin A, check the bell ('Donor refund requests') and open Finance > Refund requests (/refund-requests).
3. Read the card: amount, status chip, payment chip, donor, campaign, reason and the payment reference. Click 'View payment timeline' and return.
4. Type a staff note under 20 characters and check the buttons. Then type 20 or more characters and click 'Approve and mark processing'.
5. Switch the Status filter to Processing. Click 'Refund payment', complete the refund dialog, then add a note and click 'Mark refunded'.
6. As D1, check My Refunds and the in-app notifications.
7. Have D1 request a refund for the second donation; as Admin A decline it with a note.
8. Open /audit and search 'refund_request'.

**Expect:** The request appears in the pending view as 'Awaiting review' with the net amount in its currency, 'Payment succeeded', the donor's name and email, the campaign, the reason and description, and 'Payment <id> via paystack · reference …'. The bell count includes it. Buttons are disabled until the note has 20 characters. 'Approve and mark processing' shows 'Request marked processing. The donor is notified of the new status.' 'Mark refunded' is enabled only after the linked payment shows the refund, and then shows 'Request marked refunded. …'. Decline shows 'Request marked declined or failed. …'. D1 sees the status move to processing, then completed (and failed for the declined one) and gets 'Your refund is …' activity notices; the staff note stays internal. The bell count drops once requests are refunded or declined. The audit log has refund_request.processing (info), refund_request.completed and refund_request.failed (warning) entries.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/RefundRequestPage.tsx`, `apps/web/src/pages/MyRefundsPage.tsx`, `apps/admin/src/pages/RefundRequestsPage.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminRefundRequestRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoRefundRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## ADMIN-059 · P0 · User 'Report campaign' submissions reach the Campaign reports queue

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Active campaign C. Signed-in user U5 on web and U6 in the iOS or Android app. Admins A and B.

**Steps:**

1. As U5 on web, report C with reason 'Fraud or scam' and details. As U6 in the app, report C with another reason, for example 'Intellectual property / copyright' on web or any native reason.
2. As Admin A, check the bell ('Campaign reports from supporters'), the Dashboard 'Pending campaign reports' tile and Trust & Safety > Campaign reports (/campaign-reports) with Status 'pending'.
3. On U5's report, type a note under 20 characters and check the buttons. Open the campaign, block it, return and click 'Mark reviewed' with a note of 20 or more characters describing the block.
4. Have Admin B open U6's report in another tab. Admin A dismisses it with a note; then Admin B tries to mark it reviewed.
5. Switch Status to 'reviewed' and 'dismissed', and export CSV.
6. Check U5's in-app notifications and /audit (search 'campaign_report').

**Expect:** Both reports appear, including the one filed in the app. Each card shows a reason chip (fraud and illegal activity in red), a 'Campaign <status>' chip, the linked campaign title and reporter ID, and the description or 'No details were given.' An info alert says marking a report does not change the campaign. Buttons stay disabled below 20 characters (the API returns 400 'Validation failed'). 'Mark reviewed' shows 'Report marked reviewed.' and Dismiss shows 'Report dismissed.'; decided reports move to their view with 'Reviewed|Dismissed <time> by <admin id>' and the notes. Admin B's late decision gets 409 'Report has already been reviewed'. The bell and Dashboard counts drop. The export has ID, Campaign, Campaign ID, Reason, Status, Reporter, Created (UTC) and Review notes. U5 receives the in-app notice 'We reviewed your report'. The audit log has campaign_report.reviewed and campaign_report.dismissed entries. Watch: the admin reason map has no label for the new 'intellectual_property' and 'privacy' reasons, so the chip may show the raw value; log a cosmetic defect if so. No email alert is sent for new reports (skipped by design).

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminReportController.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAdminReportRepository.ts`

## ADMIN-061 · P0 · Publication, donor-message and tip-message reviews

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Pending items: a comment or update proposal by U1; a donor public name and message on a settled donation; a tip supporter message (web only, because creator tips are not in native apps); a proposal authored by Admin A.

**Steps:**

1. Open /publication-reviews and switch 'Content queue' between Publication proposals, Supporter names and messages, and Campaign donor names and messages.
2. Approve U1's proposal with notes of 20 or more characters. Decline another.
3. Approve the donor message and check the campaign page on web and mobile. Check that an anonymous donor's name stays hidden.
4. Try to review Admin A's own proposal as Admin A.
5. Have two admins decide the same item at once.

**Expect:** Decision buttons are disabled until notes are at least 20 characters. Approval applies to that exact author and version for 7 days (the author must resubmit) and moves no funds. Approved donor and tip text appears publicly; declined text never does. Self-review returns 403 'Another administrator must review your content'. The concurrent decision returns 409 'Another reviewer already decided this submission'.

**Needs:** OpenAI (optional automated screening)

**Source:** `apps/admin/src/pages/PublicationReviewsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationContentReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/tipContentReviewRoutes.ts`

## ADMIN-062 · P0 · Community safety report actions per target type

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Reports filed from web and mobile against: a comment, a campaign update, a donor message, a tip message, a user, a live session and an AI output. Include one child_safety report and one guest-authored message.

**Steps:**

1. Open /safety-reports with Status=pending and confirm urgent reports are listed first.
2. For each type, use the matching action ('Hide comment', 'Hide campaign update', 'Hide message', 'End broadcast at provider', 'Restrict publishing', 'Resolve after other action', 'Dismiss') with notes of 20 or more characters.
3. Check the result on web and mobile. As the restricted user, try to comment or donate with a message, then check that Wallet and Settings still work.
4. In the resolved view, click 'Restore publishing after appeal'.

**Expect:** Only type-appropriate buttons are shown. Guest content has 'Restrict publishing' disabled. Hidden content disappears publicly while financial totals stay the same. A restricted user gets the 403 publishing message with support@ujimora.com but keeps access to funds and settings. Restore shows 'Publishing restriction removed. Previously hidden comments and messages remain hidden.' Every action creates a safety.* audit entry.

**Needs:** LiveKit (live stop)

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## ADMIN-064 · P0 · Data-rights requests: access, correction and complaint

*Surfaces:* admin, android, api, email, ios, web  ·  *Type:* compliance

**Before:** U6 submits an access request and a complaint from web or mobile Settings. U7 submits a request and then closes their account. Email provider configured.

**Steps:**

1. Open /privacy-requests, section 'Data access, corrections and complaints', filter 'Open and in review'.
2. On U6's request, enter evidence shorter than 20 characters and check that the buttons are disabled.
3. 'Save review progress' with valid evidence. Then 'Publish response to requester' with a response of 20 or more characters.
4. As U6, view the response in Settings and check U6's email inbox.
5. For U7 choose 'Publish in account Settings'. Then switch to 'Record verified external delivery…' with a reference of 20 or more characters. Check U7's inbox.
6. Submit the same request from two tabs.
7. Click 'Load review history' and switch the filter to Responded.

**Expect:** The 30-day target date is shown. in_review is saved. The response appears in U6's Settings and can be downloaded. U6 receives an email 'Your Ujimora privacy request has a response' with the request reference and a link to Settings; the response text is not in the email. For the closed account, 'account' delivery returns 409 ('This account is closed…'), while external delivery with a reference succeeds and sends no email. The second tab gets 409 'Request changed or was already answered'. History shows actor, action and evidence. The response is not editable after it is sent.

**Needs:** Email provider (Resend)

**Source:** `apps/admin/src/components/DataRightsQueue.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `docs/compliance/DATA_RIGHTS.md`

## ADMIN-065 · P0 · Account deletion: balance check, step-up and retention review queue

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** U8 has an active campaign, donations and a GHS 20 wallet balance, and uses the iOS app. U9 has no balances or open payouts, uses web and has authenticator MFA on. Both know their passwords.

**Steps:**

1. As U8 in the iOS app, open Settings and start account deletion.
2. Via API as U8, DELETE /api/v1/profile with the correct password.
3. Have U8 move the wallet balance out (and settle any campaign balance or open payout), then delete in the app with the password.
4. As U9 on web, submit deletion without a password, then with the password and an authenticator code; double-click the confirm button.
5. Open /privacy-requests, section 'Account deletion and retention'. Check status chips and the 'Operational profile data removed…' text.
6. Click 'Retry pending cleanup'.
7. Save review notes shorter than 20 characters, then with a past 'Next review date', then valid notes with a future date.
8. Edit the same request in two tabs.
9. As U8, try to sign in on mobile and web. As Admin, open U8's former campaign in /campaigns.

**Expect:** While U8 holds money, the app shows the closure check ('Your account can’t be closed yet. First withdraw or resolve: GHS 20.00 in your Ujimora wallet… If you can’t, contact support@ujimora.com…') and offers no delete action; the API returns 409 with the same text and nothing is erased. Deletion without a password returns 400 'Enter your current password to delete your account. If you are not asked for it, update the Ujimora app or delete your account from Settings at app.ujimora.com.' The double-click sends one DELETE. Once balances are clear, both requests appear with the contact email and account ID. Retry runs the erasure sweep. Invalid notes or dates are refused (400 'Set a future review date'). A valid save increments the revision and writes a 'privacy.retention_review' audit entry. A stale tab gets 409. U8 cannot sign in. U8's active campaign is now 'expired' (a pending_review one returns to 'draft'). Financial records and donation totals are preserved while identity is removed. Known open issue I084: the KYC retention job and Paystack transfer-recipient deletion are still not automated.

**Needs:** None

**Source:** `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/privacyRequestRoutes.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `docs/compliance/ACCOUNT_CLOSURE_AUDIT.md`

## ADMIN-066 · P0 · Store billing recovery queue and audited retry

*Surfaces:* admin, android, api, ios  ·  *Type:* recovery/idempotency

**Before:** STORE_BILLING_ENABLED with APPLE_IAP_* and GOOGLE_PLAY_* sandbox config and STORE_BILLING_PRODUCTS. Induce issues: a Play purchase not yet acknowledged, and an App Store notification that failed verification (for example a temporarily wrong key).

**Steps:**

1. Open /store-billing. Check the purchase and notification cards (store name, 'Acknowledgement pending' or 'Review required', last error, next attempt).
2. Enter a reason shorter than 10 characters and check that the button is disabled. Enter a valid reason and click 'Queue verification retry'.
3. Fix the configuration and wait for the 60-second worker. Refresh.
4. Restart the API with store billing disabled and open the page.

**Expect:** No receipts or tokens are displayed. The retry returns 202 'Retry queued…' and writes a STORE_BILLING_RETRY audit entry with the reason, but does not grant access. After the fix, the item clears and the user's entitlement matches the verified store state. With billing disabled, the page shows the 'Store billing is disabled' warning and retry is disabled (503).

**Needs:** App Store sandbox, Google Play test track

**Source:** `apps/admin/src/pages/StoreBillingPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingAdminRoutes.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `docs/compliance/STORE_BILLING.md`

## ADMIN-068 · P0 · Edit plan pricing, limits and visibility and check every surface

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* cross-platform

**Before:** Plans page (/plans). Paystack test keys. Store sandbox products mapped for Pro. An existing Starter subscriber.

**Steps:**

1. Read the info alert on /plans. Edit Pro: monthly price 79 → 89 (read the field helper), platform fee 5 → 4.5, maxCampaignGoal -1 (unlimited). Try fee 101 and accent colour 'blue'.
2. Save and check ujimora.com/pricing (/plans/public) and the web upgrade page. Complete a web Paystack checkout.
3. Open the iOS and Android subscription screens.
4. In Edit for Starter, turn off Public (read the note), save, and check marketing and web. Open web /subscription?tier=starter and POST a Starter checkout via the API. Then do the same with Active off.
5. Set Pro's yearly price to 0 and check web.
6. Toggle Popular, change Sort order and Accent colour; check marketing.
7. Read the feature and limit labels in the edit dialog.

**Expect:** The alert says prices apply to web (Paystack) checkout only and store products must be updated in App Store Connect and Google Play Console; price fields say 'Web checkout price. Update store products separately.' Invalid values are rejected ('Must be a hex colour', fee maximum 100). After saving, marketing and web show GHS 89 and Paystack charges 89.00 (8900 pesewas); the new fee applies to new donations. Native shows the store's localised displayPrice (no GHS web price, no Paystack link) and does not change until the store product does. The edit dialog now has Sort order, Accent colour and Active, Public and Popular switches, with the note that turning off Active or Public hides the plan from new purchases without cancelling existing subscribers. The hidden plan disappears from pricing and signup; a direct purchase gets 403 'This plan is arranged through our sales team. Contact sales@ujimora.com.'; the existing Starter subscriber keeps the plan. A yearly price of 0 makes web show that cycle as not offered, and the API refuses it with 400 'That billing cycle is not available for this plan'. Popular, order and accent show on marketing. Unbuilt features are labelled '(not built — hidden from members)', 'escrowSupport' is labelled 'Split proceeds', and team members read 'Organization team seats (incl. owner)'. Any plan export keeps -1 as 'unlimited'.

**Needs:** Paystack test keys, store sandbox

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/marketing/src/pages/PricingPage.tsx`, `docs/compliance/STORE_BILLING.md`

## ADMIN-071 · P0 · Coupon discount accuracy and redemption counting at checkout

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Coupons: PCT20CAP (20%, maximum GHS 15), FIXED10 (GHS 10), MIN100 (minimum subtotal 100), ONEUSE (1 per user), NEWONLY (new users only), EMAILONLY (allow-list), EXPIRED, INACTIVE, a donation-fee waiver coupon and a withdrawal-fee coupon. Paystack test keys.

**Steps:**

1. On the web subscription checkout, preview and pay with each coupon on monthly and yearly plans.
2. Start a checkout with ONEUSE and abandon it at Paystack. Immediately start another checkout. Then make the abandoned checkout older than one hour (wait, or age it in the DB) and start again.
3. Replay the charge.success webhook for a coupon payment.
4. Apply the donation coupon to a GHS 100 donation and check the fee breakdown.
5. Try to use a coupon in the iOS or Android subscription flow.

**Expect:** PCT20CAP on GHS 89 gives a GHS 15 discount (cap), not 17.80. FIXED10 subtracts 10 and never goes below 0. MIN100 is refused under 100. ONEUSE is refused on a second paid use. Retrying within an hour of the abandoned ONEUSE checkout returns 409 'You already have a plan payment in progress. Finish it in the payment window, or check its status on your subscription page, before starting another.' Once the abandoned checkout is over an hour old, a new checkout expires it and releases its coupon seat (the 24-hour reconciliation sweep does the same), so ONEUSE can be used. NEWONLY and EMAILONLY are enforced. EXPIRED and INACTIVE are refused. The redemption count in /coupons increments exactly once per settled payment, even after a webhook replay. The donation coupon waives the platform fee so the campaign receives more. Native IAP has no coupon entry.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/PreviewCouponUseCase.ts`, `apps/api/src/application/use-cases/CreateSubscriptionCheckoutUseCase.ts`, `apps/api/src/application/services/SubscriptionCheckoutResolver.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/couponRoutes.ts`, `apps/admin/src/pages/CouponsPage.tsx`

## ADMIN-073 · P0 · Commercial config: early cashout surcharge and referral discount

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Settings > Payments and Settings > Referrals. The render.yaml fallbacks are known.

**Steps:**

1. Enter an early cashout percentage of 101, then -1, then 1.25. Save.
2. Set the referral discount to 15. Sign up a referee with an affiliate code and preview the first subscription price.
3. Call GET /admin/commercial-config and /admin/commercial-config/earlyFeePercent/history.
4. Export 'Persisted settings'.

**Expect:** Out-of-range values are rejected ('Percentage cannot exceed 100.' or 'non-negative'). New early cashout requests use 1.25% and existing requests keep their fee. The referee sees 15% off the first paid subscription only. History shows value, actor, time and reason. The export lists the resolved values, which match the UI.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/components/EarlyCashoutSettings.tsx`, `apps/admin/src/components/ReferralDiscountSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.ts`, `apps/api/src/application/services/CommercialConfigService.ts`

## ADMIN-082 · P0 · Export security: formula injection, anonymity and revoked access

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Campaign titled '=HYPERLINK("http://evil","x")', user named '+cmd|calc', contact message starting with '@SUM(1)'. Anonymous donations exist.

**Steps:**

1. Export Campaigns, Users and Contact submissions to CSV and XLSX, and open them in Excel.
2. Export Donations and check the anonymous rows.
3. Start an export. Sign out in another tab (or demote the admin) before the download completes.

**Expect:** CSV cells are prefixed with ' so they are shown as text. XLSX stores them as strings; no formula runs. Anonymous donors are shown as 'Anonymous' with no donor ID. KYC exports have no document URLs and affiliate exports have no bank details. A revoked session aborts with 'Your session changed. Start the export again.' and no file is saved.

**Needs:** None

**Source:** `apps/admin/src/lib/exports/report.ts`, `apps/admin/src/lib/exports/xlsx.ts`, `apps/admin/src/components/ExportMenu.tsx`

## ADMIN-083 · P0 · Audit log completeness and content hygiene

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Perform each action once: campaign approve, KYC approve and reject, KYC request-info, payout approve, compliance limit change, commercial config change, automatic payout policy save, coupon create and delete, plan edit, content block save, blog publish, safety action, publication decision, privacy review, store billing retry, MFA enable, a 403-denied mutation.

**Steps:**

1. Open /audit and find each entry. Search by actor name, by action (for example 'kyc') and by resource ID.
2. Page through the results and export them.
3. Inspect the raw AuditLog documents in the DB.

**Expect:** Every action has an entry with actor name, human-readable action label, resource, severity (info; warning for DELETE and 4xx; campaign block and reject are warning), timestamp and summary. Domain entries carry the reason or before/after changes. 403 attempts appear as warnings. 5xx errors are not recorded. There are no request bodies, passwords, OTPs, tokens or document URLs. Search and paging are stable.

**Needs:** None

**Source:** `apps/admin/src/pages/AuditLogPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuditLogController.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`

## ADMIN-085 · P0 · Production deployment and config smoke test for the admin console

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Production admin (admin.ujimora.com on Vercel) and API (api.ujimora.com on Render). Access to Render logs and settings.

**Steps:**

1. Load admin.ujimora.com over HTTPS, and try http:// to confirm the redirect.
2. In DevTools > Network, confirm console API calls go directly to https://api.ujimora.com/api/v1/... with a successful CORS preflight and no CORS errors.
3. Reload deep links such as /payouts?view=all, /content/blog/new, /campaign-reports and /refund-requests.
4. Check the response headers on the console HTML, and try to load the console inside an iframe on another origin.
5. Check response headers on /admin/* queue endpoints.
6. Call https://api.ujimora.com/health and /health/ready, and check Render's health check path.
7. Read the API startup logs in Render.
8. Confirm the 'View donor site' link goes to https://app.ujimora.com.

**Expect:** Everything loads over HTTPS with no CORS or mixed-content errors. API requests go to the API origin (VITE_API_URL=https://api.ujimora.com/api/v1), with Access-Control-Allow-Origin https://admin.ujimora.com. Deep links load. The console HTML carries X-Frame-Options DENY, Content-Security-Policy frame-ancestors 'none', X-Content-Type-Options nosniff and Referrer-Policy strict-origin-when-cross-origin, and the iframe is refused. Admin data responses are Cache-Control private, no-store. /health returns 200 {status: 'ok'}; /health/ready returns 200 {status: 'ok'} with Cache-Control no-store (503 'unavailable' if MongoDB is unreachable), and Render's healthCheckPath is /health/ready. The startup logs show no disabled-capability error for account email or MFA, and the API only boots with CORS_ORIGINS set (it refuses to start in production with 'CORS_ORIGINS is required in production'). The PAYOUT_DUAL_APPROVAL_AMOUNT warning appears while the value is 0. Record the production PAYOUT_DUAL_APPROVAL_AMOUNT, REVIEW_ALERT_EMAIL, ADMIN_WEB_URL and MFA_ENCRYPTION_KEY status. Known open issues I003 and I035: the Render free plan sleeps when idle (cold starts) and there is no error tracking or alerting beyond logs; put an uptime monitor on /health/ready.

**Needs:** Production access

**Source:** `apps/admin/vercel.json`, `apps/admin/.env.production`, `render.yaml`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/infrastructure/config/payoutControls.ts`

## ADMIN-N003 · P0 · Signing out revokes the session on the server

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A signed in on browsers X and Y. Postman or curl.

**Steps:**

1. In X, copy refreshToken from uf_admin_tokens in localStorage.
2. In X, open the user menu and click Sign out. Watch the Network tab.
3. POST /api/v1/auth/refresh with the copied refresh token.
4. In Y, keep working for more than 16 minutes so its access token refreshes.
5. POST /api/v1/auth/logout with a random string as refreshToken, and with an empty body.
6. Sign in again in X, go offline in DevTools and sign out.

**Expect:** Sign out sends POST /auth/logout with the refresh token, then clears local storage. The copied refresh token now gets 401 'Invalid or expired refresh token'. Y keeps refreshing and working normally. /auth/logout answers 200 'Signed out' for a garbage token (it reveals nothing), and 400 'Validation failed' for an empty body. The offline sign-out still completes locally. Note: an access token copied before sign-out keeps working until it expires (up to 15 minutes). Known open issue I031: refresh tokens are not rotated with reuse detection, and tokens are still kept in localStorage.

**Needs:** None

**Source:** `apps/admin/src/context/AuthContext.tsx`, `packages/ui/src/browserSession.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`

## ADMIN-N005 · P0 · Authorisation sweep for admin endpoints added in the launch fixes

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Postman or curl collection. No token; U1 (member) and O1 (organisation) access tokens; valid IDs for fixtures in each queue.

**Steps:**

1. Without Authorization, call: GET /reports; PUT /reports/:id/review; GET /admin/refund-requests; PATCH /admin/refund-requests/:id; GET /admin/activity-deliveries; PATCH /admin/activity-deliveries/:id; POST /payouts/:id/reject; POST /payouts/stuck/campaign/:id/resolve; POST /affiliates/payouts/:id/reject; GET /beneficiary-payouts/:id/recipient; POST /admin/users/:id/close; GET /admin/payments/provider-events; POST /admin/payments/provider-events/:id/acknowledge; POST /admin/reconciliation/topups; GET /admin/safety-reports/restrictions; POST /admin/safety-reports/restrictions/:userId; POST /admin/safety-reports/restrictions/:userId/restore; PUT /admin/commercial-config (batch body); GET /analytics/overview.
2. Repeat each call with U1's and O1's tokens, using valid bodies.
3. With U1's token, call GET /rbac/me and GET /users/<Admin A id>/public.
4. Check the DB and /audit after the run.

**Expect:** Every call returns 401 without a token and 403 'Insufficient permissions' with U1's or O1's token. /rbac/me returns 200 with permissions [] and roleName ''. The public profile has no role field. Nothing changes: reports and refund requests stay pending, payouts stay PENDING, no restriction or account closure happens and config is unchanged. Refused mutations are logged as warnings. Queue responses carry Cache-Control private, no-store.

**Needs:** None

**Source:** `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminRefundRequestRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActivityDeliveryRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`

## ADMIN-N007 · P0 · Refund request status guardrails

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Pending refund requests: R1 linked to a settled Paystack payment; R2 whose donation has no linked payment (for example a wallet or legacy donation); R3. The ID of a refund operation that belongs to a different payment. Admins A and B.

**Steps:**

1. On R1 type a 20+ character note and check 'Mark refunded'. Via API, PATCH /admin/refund-requests/R1 {status: 'completed', staffNote}.
2. PATCH R1 with a refundOperationId from the other payment.
3. Refund R1's payment with 'Refund payment', then click 'Mark refunded'. Via API, PATCH R1 back to 'processing'.
4. Open R2.
5. Open R3 in two tabs as Admin A and Admin B. A declines it; then B clicks 'Approve and mark processing'.
6. Via API, PATCH R3 with a 10-character staffNote, and with status 'pending'.
7. As the donor, request a refund for R1's donation again.

**Expect:** 'Mark refunded' stays disabled until the payment shows REFUNDED or PARTIALLY_REFUNDED; the API returns 409 'Refund the contribution first. A request can be completed only after its payment shows a refund.' The foreign operation returns 400 'That refund operation does not belong to this donation'. After the refund, completion succeeds, and moving back returns 409 'A completed refund request cannot be marked processing'. R2 says 'No linked payment was found for this donation. It cannot be refunded or marked refunded here; escalate it to the payments team or decline it with a note.' and has no Refund button. B's late action gets 409 ('A failed refund request cannot be marked processing', or 'This refund request changed. Refresh and try again.' if both writes race). The short note and the 'pending' status return 400 'Validation failed'. The repeat donor request returns 409 'Refund already requested for this donation'. Each accepted change writes exactly one refund_request.<status> audit entry.

**Needs:** Paystack test keys, two admin accounts

**Source:** `apps/admin/src/pages/RefundRequestsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminRefundRequestRoutes.ts`, `apps/api/src/domain/ports/outbound/RefundRepositoryPort.ts`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`

## ADMIN-N008 · P0 · Reject a pending campaign payout request; owner cancellation

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Campaign owner U1 with two PENDING payout requests (P1, P2) and cleared funds. Admins A and B. U1 on web with withdrawal activity alerts on.

**Steps:**

1. On /payouts, on P1 click 'Reject request'. Type a reason under 20 characters, then click 'Keep request'. Reopen and enter a reason of 20 or more characters, then click 'Reject payout'.
2. Check P1's card, Paystack transfers and the campaign balances (available and pending).
3. Via API, POST /payouts/P1/approve with a valid note.
4. Have Admin A and Admin B reject P2 at the same moment.
5. As U1 on web, open the payout history and check P1's status and reason, and the notifications.
6. As U1, create a new request P3 and cancel it from the web payout history (confirm the dialog). Check P3's card in the admin console.
7. Check /audit for payout.rejected and payout.cancelled.

**Expect:** 'Reject payout' is disabled below 20 characters; the helper says the reason is shown to the organizer and that the cleared funds return to the campaign's pending balance with nothing transferred. After rejection the notice reads 'Payout request rejected. The organizer can see the reason; no transfer was sent.', the chip reads 'Rejected' with a 'Rejection reason' detail, no Paystack transfer exists, and the cleared amount (capped at what is available) moves back to pending. Approving afterwards returns 409 'Payout cannot be approved in state FAILED'. Of the concurrent rejects one succeeds and the other gets 409 'Payout is no longer pending; refresh before trying again.', with funds returned once. U1 sees the reason and a 'Your withdrawal is rejected' notice. P3 shows 'Cancelled by organizer' with a 'Cancellation note', and U1 can request again. Both actions are audited.

**Needs:** Two admin accounts

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutClosureTransaction.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`

## ADMIN-N009 · P0 · Admins cannot approve payouts to themselves or from their own campaigns

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A also owns campaign CA (current KYC, verified email, cleared funds) and has requested payout PA. Admin A is an affiliate with a pending affiliate payout FA. With SPLIT_PROCEEDS_ENABLED=true: beneficiary payout BA names Admin A as beneficiary, and beneficiary payout BC comes from Admin A's campaign. Admin B. DB access.

**Steps:**

1. As A, open PA, review the destination, add a note and click Approve. Repeat via the API.
2. As B, approve PA.
3. As A, approve FA on /affiliates.
4. As A, approve BA and BC in the beneficiary view (after reviewing the destination and writing a note).
5. Delete the campaign of another pending beneficiary payout in the DB and approve it as B.
6. Check that no review, first approval or transfer was recorded for the refused attempts.

**Expect:** A's approval of PA returns 403 'Another administrator must approve payouts from your own campaign or request.' and records nothing. B's approval proceeds normally. FA returns 403 'Another administrator must approve your own affiliate payout.' BA returns 403 'Another administrator must approve a payout to you.' BC returns 403 'Another administrator must approve payouts from your own campaign or request.' The payout whose campaign is gone returns 409 'This payout's campaign could not be found; review it again before approving.' No transfer is created for any refused attempt. Automatic (system) approvals are not affected.

**Needs:** Two admin accounts, SPLIT_PROCEEDS_ENABLED, DB access

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`, `apps/api/src/application/use-cases/ApproveAffiliatePayoutUseCase.ts`, `apps/api/src/application/use-cases/BeneficiaryPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutAuthorization.ts`

## ADMIN-N010 · P0 · Payout approval gates: blocked campaign, open dispute, lapsed owner KYC, wrong-mode recipient

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** PENDING campaign payouts prepared, each on a different campaign: (a) campaign blocked after the request; (b) campaign with an open dispute (Paystack charge.dispute.create); (c) owner's identity KYC expired (expiryDate in the past) or a renewal pending; (d) owner's email not verified; (e) recipient tagged recipientMode 'live' while the API uses a test key; (f) Ujimora Wallet payout whose owner KYC has lapsed. Paystack test keys.

**Steps:**

1. Approve each payout with a valid destination review note.
2. As each owner, try to request another payout on web.
3. Check campaign balances and Paystack transfers after each attempt.
4. Restore each condition (unblock, resolve the dispute, renew KYC, verify email, re-add the account) and approve again.

**Expect:** (a) 409 'This campaign is under review; payouts are paused'. (b) 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.' (c), (d) and (f) 409 'The account holder’s identity verification is missing, expired or under renewal. It must be current before funds can be paid out.' (e) 409 'This payout destination was registered in Paystack test mode. The owner must add the account again before it can be paid.' (or the equivalent for the other mode). Nothing is reserved, no transfer is created, and each payout stays PENDING (staff can still reject it, see ADMIN-N008). The owners' new payout requests are refused in the same states. Once the condition is fixed, approval succeeds.

**Needs:** Paystack test keys and webhook tooling, DB access

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/domain/services/currentKycEvidence.ts`, `apps/api/src/domain/value-objects/PaystackMode.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`

## ADMIN-006 · P1 · MFA behaviour when MFA_ENCRYPTION_KEY is missing or rotated

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging only. Admin B has MFA enabled. Admin C has MFA off.

**Steps:**

1. Restart the API with MFA_ENCRYPTION_KEY unset.
2. Admin C: open Settings > Security and try to start setup.
3. Admin B: sign in with password plus a TOTP code.
4. Admin B: sign in with password plus a recovery code.
5. Restore the key.

**Expect:** Setup shows 'Authenticator setup is temporarily unavailable.' (503) and the status shows unavailable. Admin B's TOTP login fails with 503 and not a false 'invalid code'. A recovery code still signs Admin B in. Record this in the launch runbook: keep the key stable and backed up, because losing it locks out TOTP users.

**Needs:** Ability to change API env

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/api/src/app.ts`

## ADMIN-008 · P1 · Change password from Profile > Security keeps this console signed in

*Surfaces:* admin, api, email  ·  *Type:* negative/edge

**Before:** Admin A signed in on browsers X and Y.

**Steps:**

1. In X open /profile, then the Security tab.
2. Enter a new password shorter than 8 characters. Then enter mismatching confirm values. Then leave the current password empty.
3. Enter a wrong current password with a valid new pair.
4. Enter the correct current password and a valid new password, then click 'Update Password'. Note uf_admin_tokens in localStorage before and after.
5. In X, go to another page (for example Campaigns), then reload the browser tab.
6. In Y, click anything.
7. Sign out in X and sign in with the old password, then with the new one.

**Expect:** Client validation shows 'Password must be at least 8 characters', 'Passwords do not match' and 'Current password is required'. A wrong current password shows the API error in a snackbar and nothing changes. On success the snackbar reads 'Password changed successfully' and the fields clear. X stays signed in: the page stores the fresh token pair that PUT /auth/change-password returns (uf_admin_tokens changes), so Campaigns loads and the reload stays in the console with no bounce to /login. Y is signed out on its next call (401, then /login) because authVersion rotated. The old password fails and the new one works. The strength meter reflects length, case, digits and symbols.

**Needs:** None

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/admin/src/context/AuthContext.tsx`, `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`

## ADMIN-010 · P1 · Contact Inbox and Testimonials use the shared session and show load errors

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin A signed in. Contact Inbox has at least one submission and Testimonials has at least one row.

**Steps:**

1. Close all console tabs for more than 16 minutes but under 60 minutes, so the stored access token has expired.
2. Open a new tab directly at /contact-submissions and watch the Network tab.
3. Repeat with /testimonials.
4. Stop the API (or block the API origin in DevTools) and reload /contact-submissions, then /testimonials.
5. Restore the API and click Retry on each page.
6. Block PATCH /contact/:id/status and DELETE /testimonials/:id in DevTools, then try to update a submission's status and delete a testimonial.

**Expect:** Both pages go through the shared admin API client: the token is refreshed first (POST /auth/refresh), then the list and stats load from the configured VITE_API_URL. With the API down, each page shows a red error alert with the error message and a Retry button, and the stat tiles show '—'. Neither page shows the empty 'no submissions' or 'no testimonials' state on a failure. Retry loads the data once the API is back. A failed status update or delete shows the error in the snackbar. A 401 that cannot be renewed sends you to /login. The testimonial edit and remove icon buttons have accessible names.

**Needs:** None

**Source:** `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/admin/src/pages/TestimonialsPage.tsx`, `apps/admin/src/lib/api.ts`

## ADMIN-014 · P1 · 'Access denied', 404 and deep-link redirect behaviour

*Surfaces:* admin  ·  *Type:* negative/edge

**Before:** Admin A. DevTools request blocking available.

**Steps:**

1. Logged out, open /campaigns/<id> directly.
2. Sign in as Admin A.
3. In DevTools, block requests to /api/v1/rbac/me. Open a new tab at /roles, then /settings, /audit and /.
4. Remove the block and reload.
5. As Admin A, open /does-not-exist and /campaigns/000000000000000000000000.
6. Reload a deep link such as /kyc-review in production (SPA rewrite).

**Expect:** Logged-out visitors are redirected to /login. While permissions cannot be loaded, every guarded page, including the Dashboard index route (which now requires Analytics read), shows 'Access denied' / 'You don’t have permission to view this page.' with a 'Back to dashboard' button, and no data renders. After the block is removed the pages load normally. Member and organisation accounts never reach these pages because they are refused at sign-in (ADMIN-012). An unknown route shows the NotFound page. A missing campaign shows the 'Campaign couldn't load' or not-found state. A deep-link reload serves the SPA (vercel.json rewrite), not a 404.

**Needs:** None

**Source:** `apps/admin/src/router.tsx`, `apps/admin/src/context/AdminPermissionContext.tsx`, `apps/admin/src/components/PermissionDenied.tsx`, `apps/admin/src/pages/NotFoundPage.tsx`, `apps/admin/vercel.json`

## ADMIN-018 · P1 · Refunds and failed payments in analytics totals

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A settled GHS 200 donation on campaign C, funds not yet paid out. Paystack test keys.

**Steps:**

1. Note Dashboard 'Net raised (GH₵, after refunds)', campaign C's raised amount and balance, the Reports figures and the Donations page header.
2. Fully refund the donation from /payments (see ADMIN-056).
3. Reload the Dashboard, Overview, Reports, Campaigns and Donations pages.
4. Abandon a Paystack checkout (never paid) and reload again.

**Expect:** Abandoned or failed payments never appear in any total. After the refund, Dashboard and Overview 'Net raised' drop by GHS 200, and the Reports monthly trend (in the month the payment was created), category and geography totals drop by 200. The Donations page header still includes the 200 and says so ('… gross (refunds not deducted)'). The campaign balance drops by the refunded net. If the campaign's raised amount still includes the refund, record it against the documented gross/net policy.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`, `apps/admin/src/pages/DonationsPage.tsx`, `apps/admin/src/pages/ReportsPage.tsx`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`

## ADMIN-019 · P1 · Reports and Overview charts and month boundaries

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** GHS donations dated across the last 9 months, including one at 23:59 UTC on the last day of a month, one refunded GHS donation and one non-GHS (for example USD) donation. Campaigns in 3 categories. Users with and without a country.

**Steps:**

1. Open /reports and /overview. Read the Reports page introduction.
2. Check the Monthly Donation Trends (9 months), Donations by Category, Geographic Distribution (top 10, 'Unspecified' for a missing country) and Fraud signals (Pending Reports, Flagged Campaigns, Report Rate, Avg Review Time).
3. Export Reports as XLSX and compare the worksheets.

**Expect:** The introduction says 'Amounts are GHS donations net of refunds; other currencies are left out.' Months are grouped by UTC (Ghana is UTC+0) and the edge donation falls in the correct month. Months with no data show 0. Only GHS donations (and legacy rows with no currency) are counted, net of refunds; a refund reduces the month in which its payment was created. The USD donation does not appear in any chart. Category names are de-underscored. Guest donors count as 'Unspecified'. The export has one sheet per section and the numbers match the screen.

**Needs:** DB fixtures

**Source:** `apps/admin/src/pages/ReportsPage.tsx`, `apps/admin/src/pages/OverviewPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`, `apps/admin/src/lib/exports/tables.ts`

## ADMIN-020 · P1 · Totals never mix currencies

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** At least one non-GHS settled donation (for example a USD diaspora donation through Flutterwave, or a seeded row) plus GHS donations.

**Steps:**

1. Open /donations and read the header.
2. Check Dashboard 'Net raised (GH₵, after refunds)' and call GET /api/v1/analytics/overview (totalRaised, totalRaisedByCurrency).
3. Check the Reports category and geography sums and the Reports introduction.
4. Export Donations to CSV and confirm there is a Currency column on each row.

**Expect:** The Donations header totals each currency separately, each formatted in its own currency and joined with ' · ', followed by 'gross (refunds not deducted)'. USD is never added into a GH₵ figure. Dashboard Net raised shows the GHS figure only; the overview API returns totalRaised (net GHS) and totalRaisedByCurrency with a separate USD entry. Reports use GHS only and say other currencies are left out. The CSV keeps the currency on every row.

**Needs:** Flutterwave keys (pending) or seeded USD donation

**Source:** `apps/admin/src/pages/DonationsPage.tsx`, `apps/admin/src/lib/money.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`

## ADMIN-021 · P1 · Subscriptions revenue estimates use live plan prices, with no dead action buttons

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Active paid subscriptions: web Paystack monthly and yearly, one App Store or Play subscription, one web plan whose paid period has ended, and one App Review/TestFlight sandbox store purchase. Plan prices edited in /plans so they differ from the code seed, and one plan renamed.

**Steps:**

1. Open /subscriptions and read the header stats, the info alert and the revenue-by-tier panel.
2. Recalculate by hand: live DB list prices for web-billed paid subscriptions that are active and inside their paid period (yearly price ÷ 12).
3. Check the tier chips and the Tier filter for the renamed plan.
4. On a row, look for action buttons and click 'View'.

**Expect:** The header shows 'Total Subscribers', 'Estimated MRR (list price)', 'Free or lapsed' and 'Paying now'. MRR and revenue by tier use live DB list prices for web-billed, active, in-period, non-sandbox subscriptions and match your calculation. Store-billed subscribers count toward 'Paying now' but are not priced; the info alert says '<n> paying subscriber(s) … billed by the App Store or Google Play and not priced here.' and 'Change or cancel a subscription through its billing provider; this console has no subscription controls.' The lapsed web plan shows status 'expired' and counts as 'Free or lapsed'. The sandbox purchase never counts as paying. The renamed plan shows its live name. Each row has only 'View', which opens /users/:id; there are no 'Tier' or 'Cancel' buttons. Discounts are not reflected (list price estimate, not money collected).

**Needs:** Paystack test keys, store sandbox

**Source:** `apps/admin/src/pages/SubscriptionsPage.tsx`, `apps/admin/src/lib/subscriptionMetrics.ts`, `apps/admin/src/lib/subscriptionRevenue.ts`, `apps/api/src/domain/services/subscriptionStatus.ts`

## ADMIN-023 · P1 · Action center counts and deep links for every work queue

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin A. Test users able to create one item in each queue. Paystack webhook tooling. DB access for one fixture.

**Steps:**

1. Create: a pending-review campaign, a KYC submission, a campaign payout request, a beneficiary payout request (split on), a contact form message, a safety report, a publication review, a donor-message review, a tip-message review, a data-rights request, an account deletion, a stuck refund operation, a store billing issue, a campaign report, a donor refund request, a Paystack charge.dispute.create on a campaign donation, and a parked activity email (DB row in activity alert deliveries with status 'review' and channel 'email').
2. Watch the bell badge and sidebar counts (they poll every 30 s and on window focus).
3. Click each item in the bell's 'Needs attention' inbox.
4. Resolve each item.

**Expect:** GET /admin/action-center lists 18 queues and each count increases. Links go to /campaigns, /kyc-review, /payouts, /payouts?view=beneficiary, /disputes ('Open disputes'), /contact-submissions, /safety-reports, /publication-reviews, /publication-reviews?queue=donation-content-reviews, /publication-reviews?queue=tip-content-reviews, /privacy-requests, /refund-recovery, /store-billing, /campaign-reports ('Campaign reports from supporters'), /refund-requests ('Donor refund requests') and /activity-email-review ('Activity emails needing a delivery check'). Counts drop after resolution: a refund request stays counted while pending or processing and drops when refunded or declined; a rejected payout request drops out of 'Campaign payouts'. With nothing pending the bell shows 'Reviews are up to date'.

**Needs:** Multiple test accounts, Paystack webhook tooling, DB access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/admin/src/context/AdminActionContext.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`

## ADMIN-025 · P1 · Campaign review alert email and link

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** Settings > Campaigns: 'Send review alerts to' set to a monitored inbox. Auto-approve tier 3 with thresholds 10000, 50000, 250000, 1000000. Email provider configured. ADMIN_WEB_URL set.

**Steps:**

1. As a verified user, create a campaign with goal GHS 300,000 (tier 4).
2. Check the inbox.
3. Click the link while signed out of the admin console, and again while signed in.
4. Clear the alert email in Settings and create another tier-4 campaign.

**Expect:** An email arrives with subject 'Campaign awaiting review — <title> (<goal>)' and a link to <ADMIN_WEB_URL>/campaigns/<id>. Signed out, the link goes to /login; signed in, it opens the campaign with the review panel. With the address blank, no email is sent and the campaign waits (the save message says alerts are off).

**Needs:** Email provider (Resend)

**Source:** `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`, `apps/admin/src/components/CampaignReviewSettings.tsx`, `render.yaml`

## ADMIN-030 · P1 · Campaign list, filters and detail views

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Campaigns in draft, pending_review, active, funded, expired and blocked states across categories.

**Steps:**

1. On /campaigns, switch between the All and Pending tabs, filter by status and category, search by title, and toggle card and table view. Page through results.
2. Open a campaign and check the header stats (Status/Priority, Raised/Goal), funding %, days remaining, collaborators, donations list and 'View organizer profile'.
3. Open a pending or blocked campaign's public URL in a logged-out web browser.

**Expect:** Filters combine correctly and counts match. The detail figures match the DB. Progress is capped at 100% and days remaining is never negative. Pending and blocked campaigns are visible to admins but return 404 or are hidden on public web and mobile.

**Needs:** None

**Source:** `apps/admin/src/pages/CampaignsPage.tsx`, `apps/admin/src/pages/CampaignDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`

## ADMIN-031 · P1 · Split-proceeds section on campaign detail

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true. Campaign S has an active split (2 beneficiaries, consent recorded), donations and a pending refund hold. Another campaign has no split.

**Steps:**

1. Open S's detail page and review the split section: beneficiaries, shares, consent, version history, balances (pending, available, 'Held for refund review').
2. Export the split tables.
3. Open the campaign without a split.
4. Set the flag to false and reload S.

**Expect:** Shares add up to 100%. Beneficiary balances reconcile to campaign totals, with refund holds shown separately. The campaign without a split shows no section and no errors. With the flag off, the section degrades gracefully (no crash).

**Needs:** SPLIT_PROCEEDS_ENABLED

**Source:** `apps/admin/src/components/SplitProceedsSection.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`

## ADMIN-036 · P1 · Request more information from a KYC applicant

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Pending KYC for U4.

**Steps:**

1. Click 'Request More' and enter a prompt of 20 or more characters.
2. Try Approve. Then try a second request.
3. As U4 on web, answer with text and upload an extra private document.
4. Back in admin, refresh and approve.

**Expect:** Status becomes in_review and the request shows in history. Approve is disabled (API 409 'Wait for the applicant to respond'). A second request returns 409 'already awaiting a response'. After U4 responds, status returns to pending with the response, timestamp and new document visible. Approval then succeeds.

**Needs:** Cloudinary

**Source:** `apps/admin/src/pages/KYCReviewPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycInformationRoutes.ts`

## ADMIN-040 · P1 · Users list and member detail

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Users with roles user, organization and admin. U1 has campaigns, named and anonymous donations, and wallet activity.

**Steps:**

1. On /users, search by partial name and by email, filter by role, and toggle views. Use 'Clear filters' on an empty result.
2. Open U1's detail page and review the campaigns, donations and wallet activity panels.
3. Export Users as CSV with filters applied.

**Expect:** Search is case-insensitive. Filters work. The detail page lists only U1's campaigns and donations (donorId filter), and U1's anonymous donations do not leak into other views. The CSV contains only the filtered rows and the documented columns (no password hashes or tokens).

**Needs:** None

**Source:** `apps/admin/src/pages/UsersPage.tsx`, `apps/admin/src/pages/UserDetailPage.tsx`, `apps/admin/src/lib/exports/tables.ts`

## ADMIN-042 · P1 · Wallets oversight balances and transactions

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** U1 wallet: top-up of GHS 100 (Paystack test), donation of GHS 30 from the wallet, a refund credit and a campaign payout to the wallet.

**Steps:**

1. Open /wallets and check U1's balance and currency.
2. Switch to transactions and page through; filter by the user from their detail page.
3. Compare with U1's web wallet screen and the DB.
4. Export both views.

**Expect:** The balance equals the sum of completed transactions; pending or failed transactions do not count. Types and statuses are labelled. References match provider references. The admin and web views agree to the pesewa.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/components/WalletActivity.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminWalletRoutes.ts`

## ADMIN-043 · P1 · Donations ledger and donor anonymity

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Named, anonymous and guest donations.

**Steps:**

1. Open /donations, then filter by donor type and search.
2. Open the rows for the anonymous donations.
3. Export to CSV and XLSX.

**Expect:** Anonymous donations show 'Anonymous' with a blank donorId in the API and exports. Guest or former accounts show 'Former or guest supporter'. The count and total match the filters. The export row count equals the on-screen count.

**Needs:** None

**Source:** `apps/admin/src/pages/DonationsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminDonationRoutes.ts`, `apps/admin/src/lib/exports/tables.ts`

## ADMIN-050 · P1 · Paystack OTP transfer authorisation controls

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Paystack account with 'Confirm transfers with OTP' enabled (test or live sandbox), so an approved payout sits at providerStatus=otp.

**Steps:**

1. On the card showing 'Awaiting Paystack authorization', open Technical details.
2. Enter a 5-digit OTP and submit. Then enter the correct 6-digit OTP.
3. On another OTP payout click 'Resend OTP', then 'Refresh status'.
4. Refresh a payout after the OTP has expired.

**Expect:** Invalid format gives 422 'Enter the six-digit Paystack OTP.' A valid OTP finalises the transfer, the status is re-read from the provider, and the success webhook settles it. Resend shows 'A new OTP was requested from Paystack.' Refresh reconciles. If the provider amount or currency does not match the payout, it returns 409 'Provider transfer details do not match this payout.' and nothing settles. Batched or non-Paystack payouts show no controls.

**Needs:** Paystack account with OTP

**Source:** `apps/admin/src/components/PayoutTransferControls.tsx`, `apps/api/src/application/use-cases/PayoutTransferControlUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`

## ADMIN-054 · P1 · Payouts console views, auto-refresh and export privacy

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Payouts in every status.

**Steps:**

1. Switch between the queue, all and beneficiary views and check the URL (?view=all).
2. Leave the page open for more than 30 s while a status changes in the background, then focus the window.
3. Export each view to CSV, XLSX and PDF.

**Expect:** Stats ('Awaiting approval', 'Needs review') match the list. The list refreshes every 30 s and on focus. Exports contain ID, Campaign, Gross, Fee, Net, Currency, Status and Created (UTC), with no account numbers or recipient codes.

**Needs:** None

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`

## ADMIN-055 · P1 · Affiliate management and payout approval

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Affiliate F with matured commissions and a pending payout with a recipient. Paystack test keys.

**Steps:**

1. On /affiliates, edit F's commission rate to 101, then 12.5. Change status to suspended, then back.
2. Approve F's pending payout, and double-click on another.
3. Approve a payout for an affiliate without a recipient, and one when the Paystack balance is too low.
4. Open /affiliates/:id and review referrals, commissions and payout history. Export it.

**Expect:** A rate of 101 is rejected ('between 0 and 100'). The status change takes effect (suspended affiliates accrue no new commission). Approval gives 'Payout approved and transfer initiated'. Double-click: one transfer and a 409. No recipient: 422. Low balance: 422 'Insufficient platform balance'. The webhook settles the payout. The export excludes bank details.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/AffiliatesPage.tsx`, `apps/admin/src/pages/AffiliateDetailPage.tsx`, `apps/api/src/application/use-cases/ApproveAffiliatePayoutUseCase.ts`, `apps/api/src/application/use-cases/SetAffiliateCommissionRateUseCase.ts`

## ADMIN-060 · P1 · Paystack disputes open cases in the Disputes queue; resolution

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Paystack test mode with signed-webhook tooling. A settled campaign donation D on campaign C (reference ref-D). C has a pending campaign payout P (owner KYC current) and would otherwise qualify for automatic payout. Another settled donation D2 on campaign C2. DB access to seed one legacy open dispute.

**Steps:**

1. Send a signed charge.dispute.create for ref-D (with a dispute id and due date). Replay it and send charge.dispute.remind.
2. Open /disputes, filter by status and search. Open the case.
3. As Admin A, try to approve P. As C's owner, request a new payout. Check automatic payout eligibility for C.
4. Send charge.dispute.resolve for the same case and reload.
5. On the case, submit with empty notes. Then pick 'resolved' with notes and submit. Try to resolve again via the API.
6. Approve P again.
7. Send refund.processed for D2 that no Ujimora refund requested; open /disputes.
8. On the seeded dispute pick 'dismissed'.

**Expect:** Exactly one dispute exists for the Paystack case despite the replay and reminder; its reporter shows 'Paystack (payment provider)', reason 'Payment dispute (chargeback) raised with Paystack', and a description with the Paystack dispute id, transaction reference, amount, response deadline and the note that automatic payouts stay paused. The bell shows 'Open disputes'. While the case is open or under_review, approving P returns 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.', the owner's new payout request is refused, and automatic payout reports 'Campaign has an unresolved dispute.' The provider resolve moves the case to under_review (not closed). Empty notes show 'Resolution notes are required.' Resolving shows 'Resolution recorded.', the form disappears and resolvedBy and resolvedAt are set; a second resolve returns 409 'Dispute has already been resolved'. P can then be approved. The unrequested refund opens a 'Refund issued outside Ujimora' case for C2. Dismissed status displays correctly. Known open issue I009: chargebacks do not place automatic holds, clawbacks or ledger reversals; staff must reverse with the refund tools.

**Needs:** Paystack webhook tooling, DB seed

**Source:** `apps/admin/src/pages/DisputesPage.tsx`, `apps/admin/src/pages/DisputeDetailPage.tsx`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/application/use-cases/ResolveDisputeUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`

## ADMIN-063 · P1 · Safety review concurrency, interrupted actions and live cleanup retry

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A pending live report during an active LiveKit broadcast. Admins A and B.

**Steps:**

1. A clicks 'End broadcast at provider' while B clicks 'Dismiss' on the same report.
2. Break the LiveKit credentials and run 'End broadcast' on another live report.
3. Check the 'Review started…' banner and the 'Live cleanup pending' count, then click 'Retry cleanup'.
4. Restore the credentials and retry.

**Expect:** The second reviewer gets 409 'A different review has already started. Refresh the queue.' A provider failure leaves the report pending with the 'Review started: stop live…' info and locked notes, and the live-cleanup banner stays until a successful provider stop. Retrying with broken credentials must not mark the work as complete. After the fix, the retry clears the pending flags and the action center count.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## ADMIN-067 · P1 · Subscriptions list across web and store providers

*Surfaces:* admin, android, api, ios, web  ·  *Type:* cross-platform

**Before:** Subscriptions: web Paystack, iOS IAP, Android IAP, a cancelled one, a web plan whose paid period has ended, a sandbox store purchase and a free-tier user. More than 25 rows. One plan renamed in /plans.

**Steps:**

1. Open /subscriptions and filter by tier (including the renamed tier) and by status (including 'expired'), and search.
2. For each row, check the tier name, status and dates, and whether the billing source is visible.
3. Page through and export; read the Provider column.
4. Look for any upgrade, tier-change or cancel control.

**Expect:** All rows load (loadAll pagination). Filters work, and tier names and filter options come from the live plans. A paid web plan past its period shows status 'expired' and counts in 'Free or lapsed'; the sandbox purchase is never counted as paying. Rows have only 'View'; the info alert says to change or cancel through the billing provider, and there is no admin cancel or upgrade path anywhere. The export's Provider column shows web, apple or google for each row. Counts (total, paying, free or lapsed) are correct. Watch: the on-screen rows do not show the billing provider (only the export does); record whether support needs it on screen.

**Needs:** Store sandbox

**Source:** `apps/admin/src/pages/SubscriptionsPage.tsx`, `apps/admin/src/lib/subscriptionMetrics.ts`, `apps/api/src/domain/services/subscriptionStatus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`

## ADMIN-069 · P1 · Create a new plan tier

*Surfaces:* admin, android, api, ios, web  ·  *Type:* cross-platform

**Before:** Admin A on /plans.

**Steps:**

1. Click create and enter tier id 'Gold Plus' (invalid). Then enter 'gold'.
2. Create a plan with an existing tier id.
3. Save a valid new tier and check web pricing and checkout.
4. Open the native subscription screen.

**Expect:** Invalid id: 'Tier id must be lowercase letters/digits/-/_ (min 2 chars).' A duplicate is refused. The new tier appears on web in sortOrder and can be bought via Paystack at the correct price. On native, a tier without a STORE_BILLING_PRODUCTS mapping shows 'Store price unavailable' with purchase disabled. It must never fall back to web checkout in the app.

**Needs:** Store sandbox

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`

## ADMIN-070 · P1 · Coupon creation wizard validation

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin A. Existing coupon SAVE10.

**Steps:**

1. Go to /coupons/new. Step 1: empty code, 51-character code, percent 0, percent 150, negative max discount.
2. Step 3: negative or fractional redemption limits, negative minimum subtotal, end date before start date, 'bad-email' in allowed emails, 501 emails.
3. Create code 'save10' (a duplicate after uppercasing).
4. Create 'LAUNCH25': 25%, capped at GHS 50, surfaces Subscriptions and Donations, new users only, 100 maximum redemptions, 1 per user, valid for the next 7 days.

**Expect:** Each invalid input blocks progress with the specific message from couponForm.ts. The duplicate returns 409 'A coupon with this code already exists'. LAUNCH25 is saved in uppercase and appears in /coupons as active with the correct surfaces and limits.

**Needs:** None

**Source:** `apps/admin/src/pages/CreateCouponPage.tsx`, `apps/admin/src/components/coupons/couponForm.ts`, `apps/api/src/application/use-cases/CreateCouponUseCase.ts`

## ADMIN-072 · P1 · Edit and deactivate coupons; used coupons cannot be deleted

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Coupon USED5 with 5 redemptions and affiliate attribution. Coupon UNUSED with no redemptions or open checkout.

**Steps:**

1. Edit USED5: change the amount and dates, and confirm the code field is immutable.
2. Click delete on USED5 and read the dialog.
3. Click 'Deactivate' in that dialog. Try the code at checkout.
4. Via API, DELETE /coupons/<USED5>.
5. Delete UNUSED through the dialog.
6. Check the subscription and affiliate records and Reports figures that reference USED5.

**Expect:** Edits persist. The dialog title reads 'Delete or deactivate USED5?' and explains that used coupons can only be deactivated; it says 'This coupon has been redeemed 5 times, so it cannot be deleted.' and the Delete button is disabled. 'Deactivate' shows 'Coupon deactivated' and the code is refused at checkout immediately. The API delete returns 409 'This coupon has been used — deactivate it instead.' UNUSED deletes with 'Coupon deleted'. Historical redemptions, affiliate commission bases (snapshotted on the checkout) and reports for USED5 stay intact.

**Needs:** None

**Source:** `apps/admin/src/pages/CouponsPage.tsx`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/api/src/application/use-cases/UpdateCouponUseCase.ts`

## ADMIN-074 · P1 · Payment providers toggle and crypto operations

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Payment provider rows for wallet, gateway (Paystack) and method types (mtn-momo, card). CRYPTO_PAYMENTS_ENABLED=false first; then true with Bitnob sandbox.

**Steps:**

1. On /payment-providers read the page note. Toggle the Ujimora Wallet off and on and check web checkout.
2. Toggle the Paystack gateway off. Start a new web donation checkout. Then start a wallet top-up and a subscription checkout.
3. Switch Paystack back on from the console and retry the donation.
4. Look at a disabled method row (mobile money, card) and try to enable it in the UI and via the API.
5. With crypto off, check the crypto panel chip.
6. With crypto on, click 'Refresh availability', choose 'older than 30 minutes' and click 'Reconcile deposits' twice. Include one confirmed sandbox deposit.

**Expect:** The page note says the Paystack and Flutterwave switches stop new donation checkouts on that gateway, do not yet affect wallet top-ups, subscriptions, creator tips or payouts, and that the Ujimora Wallet switch hides the wallet option on the website only. Wallet and gateway toggles work both ways with '<name> enabled' or 'disabled'. A disabled gateway shows the chip 'Disabled' and 'New donation checkouts on this gateway are stopped. Switch it on to accept them again.'; the new donation checkout is refused while the top-up and subscription still proceed. Turning it back on restores checkout and the text reads 'Turning this off stops every new donation checkout on this gateway.' Method rows show 'Not available yet' and 'Offered through the gateway checkout; it has no integration of its own to switch on.', their switch is disabled, and the API returns 409 '…has no integration of its own to enable'. With crypto off, the chip reads 'Not offered at checkout'. With crypto on, assets and networks are listed; Reconcile shows scanned, settled and pending counts; the confirmed deposit is credited once and the second run does not double-credit. Known open issue I047: the switches are not enforced for top-ups, subscriptions, tips, payouts or API/Android wallet donations, and the fail-open policy is undecided.

**Needs:** Bitnob sandbox (for crypto)

**Source:** `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/admin/src/components/payments/CryptoOperations.tsx`, `apps/api/src/application/use-cases/TogglePaymentProviderUseCase.ts`, `apps/api/src/application/use-cases/ReconcileCryptoUseCase.ts`

## ADMIN-076 · P1 · CMS content blocks update the marketing site, with conflict and shape checks

*Surfaces:* admin, api, marketing  ·  *Type:* functional

**Before:** Admin A and Admin B. ujimora.com staging.

**Steps:**

1. Content > Homepage Stats: change a value. Content > FAQ: add a question. Content > About: edit text. Content > Contact Details: change the phone number and a social link.
2. Leave one page with unsaved edits and check the dirty indicator. Reload to discard.
3. Save each block and check ujimora.com (Stats section, /help FAQ, /about, /contact and the footer).
4. Open the FAQ block as Admin A and Admin B. B saves an edit first; then A saves a different edit. A reloads.
5. Put '<script>alert(1)</script>' in an FAQ answer and save.
6. Via API, PUT /api/v1/content/faq with data {items: null}, and PUT /content/marketing.stats with data {}.

**Expect:** Saved blocks appear on marketing (after any cache TTL). Unseeded keys show fallbacks and the first save creates them. A's stale save is refused with 409 'This content was changed by someone else since you opened it. Reload the page to see the latest version, then reapply your edits.' and B's content is kept; after reload A sees B's version. The FAQ script renders as text only. The malformed API saves return 400 'The faq content does not have the expected shape.' (or the marketing.stats equivalent) with per-field errors, and the stored block is unchanged, so marketing never blanks.

**Needs:** None

**Source:** `apps/admin/src/hooks/useContentBlock.ts`, `apps/admin/src/components/content/ContentEditorLayout.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/contentRoutes.ts`, `apps/api/src/application/use-cases/UpsertSiteContentUseCase.ts`, `apps/marketing/src/hooks/useContent.ts`

## ADMIN-077 · P1 · Blog studio: draft, publish, conflict, unpublish

*Surfaces:* admin, api, marketing  ·  *Type:* functional

**Before:** Cloudinary configured for image upload.

**Steps:**

1. Content > Blog > new article. Save a draft with missing fields.
2. Try to publish with the cover image alt text missing.
3. Fill every field, upload a cover image and publish. Check ujimora.com/blog, the article page and the sitemap.
4. Publish a second article with the same slug.
5. Edit the article in two tabs and save both.
6. Unpublish via the confirm dialog.
7. Put raw HTML or a script in the body.

**Expect:** A draft saves with 'Draft saved. Your public article has not changed.' Publishing an incomplete article fails with 'Complete the article details, body and accessible cover image before publishing.' Publishing shows 'Article published to the Ujimora blog.' and the article is live with a sitemap entry. A duplicate slug returns 409 'That article URL is already published.' The second tab gets 409 'This draft changed in another session.' Unpublish removes the public page and sitemap entry. Markdown is rendered safely with no script execution.

**Needs:** Cloudinary

**Source:** `apps/admin/src/pages/content/BlogEditorPage.tsx`, `apps/admin/src/pages/content/BlogPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/blogRoutes.ts`, `apps/marketing/src/pages/BlogDetailPage.tsx`

## ADMIN-078 · P1 · Testimonials lifecycle and marketing display

*Surfaces:* admin, api, marketing  ·  *Type:* compliance

**Before:** Admin A. The testimonial subjects have given written consent.

**Steps:**

1. On /testimonials, create one with an empty quote, rating 6, and an invalid avatar URL.
2. Create a valid one as draft, then publish it. Archive another.
3. Delete with confirmation.
4. Check the marketing TestimonialsSection and footer.

**Expect:** Validation rejects invalid fields: name up to 120, quote up to 1200, rating 1 to 5, hex colour. Only published testimonials appear on marketing, in displayOrder. Delete removes the testimonial. Keep a consent record for each real person quoted (advertising standards). No fabricated testimonials at launch.

**Needs:** None

**Source:** `apps/admin/src/pages/TestimonialsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/testimonialRoutes.ts`, `apps/marketing/src/components/sections/TestimonialsSection.tsx`

## ADMIN-079 · P1 · Contact inbox workflow, staff alert email and newsletter subscriber list

*Surfaces:* admin, api, email, marketing  ·  *Type:* functional

**Before:** Marketing contact form and newsletter signup (double opt-in) available. Settings 'Send review alerts to' set to a monitored staff inbox. Email provider configured. ADMIN_WEB_URL set.

**Steps:**

1. Submit the ujimora.com contact form with a subject. Check the staff inbox. Check Contact Inbox for a 'new' item and the stats.
2. Open the item, set status to in_progress with admin notes, then resolved, then archived. Filter by status and type.
3. Kill the API and reload the inbox; restore it and click Retry.
4. Subscribe to the newsletter but do not confirm; then subscribe and confirm; then unsubscribe. Check /newsletter each time. Export.

**Expect:** The staff inbox receives one email 'New contact message — <subject>' with reply-to set to the submitter and a link to <ADMIN_WEB_URL>/contact-submissions; the submitter receives no acknowledgement email (owner decision). The submission appears with its full text. Status changes persist and stats update; the action-center 'New contact messages' count drops. With the API down the page shows a red error alert with Retry and the stats show '—', never an empty inbox. The newsletter list shows only confirmed, opted-in subscribers: unconfirmed and unsubscribed addresses are excluded from the screen and the export.

**Needs:** Email provider (Resend)

**Source:** `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/admin/src/pages/NewsletterPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/contactRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.ts`

## ADMIN-081 · P1 · Export formats and fidelity across pages

*Surfaces:* admin  ·  *Type:* functional

**Before:** Data on Campaigns, Users, Donations, Payouts, Audit Log, Privacy, Store billing, Coupons, Subscriptions, Campaign reports and Payments. Some lists have more than 100 records. At least one record with Ghanaian letters and the cedi sign in names or titles (for example 'Ɛfua Ɔsei', 'Ŋmɛ', '₵').

**Steps:**

1. On each page apply a filter, then Export in 'Branded PDF', 'Excel (.xlsx)' and 'CSV (.csv)'.
2. Open the files in Excel, Google Sheets, Numbers and a PDF viewer. Find the record with Ghanaian letters in each.
3. Start a large export and click Cancel.
4. Export a page with zero rows.

**Expect:** Filenames look like ujimora-<title>-YYYY-MM-DD.<ext>. Row counts match the filtered on-screen totals, including server pages beyond 100. PDF: the brand header and section headings use Outfit, while table data uses Noto Sans, so ɛ, ɔ, ŋ and ₵ print correctly with no missing-glyph boxes; logo, watermark, page numbers, headers repeated on each page, wide tables in landscape or field/value layout. XLSX: frozen header, autofilter, typed numbers and dates in UTC, an export-details sheet. CSV: UTF-8 with BOM (Ghanaian characters intact). Cancel produces no file. Empty exports keep headings and a no-records note. Emoji and right-to-left text are not supported in PDFs.

**Needs:** None

**Source:** `apps/admin/src/components/ExportMenu.tsx`, `apps/admin/src/lib/exports/pdf.ts`, `apps/admin/src/lib/exports/xlsx.ts`, `apps/admin/src/lib/exports/report.ts`, `apps/admin/public/fonts/export/NotoSans-Regular.ttf`, `docs/compliance/ADMIN_EXPORTS.md`

## ADMIN-087 · P1 · An admin changing their own public identity (single-admin deadlock)

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin A is the only admin. Then add Admin B.

**Steps:**

1. On /profile > Personal details, change Full Name and click 'Save Profile'. Leave 'Use OpenAI to check this public identity' unticked, then try again with it ticked.
2. Follow 'Open review queue in a new tab' and try to approve your own submission.
3. With Admin B present, have B approve it, then save the same values again as A.

**Expect:** The first save is held for review ('After approval, save the same version here.'). A cannot approve their own submission (403 'Another administrator must review your content'). After B approves, A's identical save succeeds and the top-bar name updates. Phone and bio save without review. Known open issue I073: a single-admin deployment still cannot change the admin's name unless OpenAI screening passes, because self-approval is not allowed and no single-admin path exists.

**Needs:** OpenAI (optional), second admin

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `docs/compliance/ACCOUNT_PUBLICATION.md`

## ADMIN-N001 · P1 · Staff sign-in attempts are written to the audit log

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Admin A with authenticator MFA enabled. Non-admin U1. Admin B to read /audit. Tester knows their public IP.

**Steps:**

1. On the admin /login, sign in as Admin A with a wrong password.
2. Sign in with the correct password and a wrong authenticator code.
3. Sign in with the correct password only (first step of the two-step login), then complete it with a valid code.
4. Sign in to the admin console as U1.
5. Sign in to the member web app as U1, and as Admin A.
6. As Admin B, open /audit and search 'auth.'; then inspect the raw AuditLog documents.

**Expect:** Entries (resource 'account-security'): 'auth.admin_login.failed' (warning) 'Administrator sign-in failed: wrong password'; 'auth.admin_login.failed' 'Administrator sign-in failed: authenticator code rejected'; no failure entry for the password-only first step; 'auth.admin_login.succeeded' (info) 'Administrator signed in to the staff console'; 'auth.admin_console.refused' (warning) for U1 at the console. U1's member web sign-in writes nothing, and Admin A's web sign-in writes 'Administrator signed in' without 'to the staff console'. Rows carry the actor ID, a user agent of at most 300 characters and an ip, and never a password or code. Watch: AuthController passes req.ip rather than the resolved client IP, so in production the ip may be Render's proxy address; log a defect if it does not match the tester's public IP. Known open issue I028: there is still no per-account lockout.

**Needs:** Authenticator app

**Source:** `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/admin/src/pages/AuditLogPage.tsx`

## ADMIN-N002 · P1 · Administrator MFA reminder banner

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A with MFA off, Admin B with MFA on. A staging API whose MFA_ENCRYPTION_KEY can be unset, and Admin C with MFA off.

**Steps:**

1. Sign in as Admin A and visit Dashboard, Payouts and Settings.
2. Click 'Turn on' on the banner.
3. Enable MFA (as in ADMIN-003) and move to another page without reloading.
4. Sign in as Admin B and browse.
5. Restart the API without MFA_ENCRYPTION_KEY and sign in as Admin C.

**Expect:** Admin A sees a warning on every console page: 'Protect this administrator account: turn on authenticator app sign-in. A stolen password alone would give full access to donor data and payouts.' with a 'Turn on' button. The button opens /profile with the Security tab selected, and on /profile the button is hidden. After enabling MFA the banner disappears without a reload. Admin B never sees it. With the key missing, Admin C sees 'Administrator accounts should use authenticator sign-in, but it is not configured on this server yet. Ask engineering to set it up.' The banner never blocks work. Known open issue I028: admin MFA is still optional; nothing forces enrolment.

**Needs:** MFA_ENCRYPTION_KEY, authenticator app

**Source:** `apps/admin/src/components/layout/AdminMfaPrompt.tsx`, `apps/admin/src/components/layout/AdminLayout.tsx`, `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`

## ADMIN-N004 · P1 · Login and API rate limits apply per client IP, not platform-wide

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Staging deployed like production (API behind Render/Cloudflare, admin built with VITE_API_URL pointing at the API origin). Two testers on different networks (A: office Wi-Fi, B: mobile hotspot). curl.

**Steps:**

1. From network A, send 31 failed POST /api/v1/auth/login requests within 15 minutes, then try the correct password in the admin console.
2. Immediately sign in from network B with correct credentials.
3. From network A, repeat a login with X-Forwarded-For, X-Real-IP and True-Client-IP set to new values.
4. On network A, check in DevTools that console API calls go to the API origin, not the /api/v1 Vercel rewrite.
5. After the window resets, make an audited admin change from network A (for example save a setting) and check the IP on its /audit entry.

**Expect:** The 31st request from A gets 429 'Too many requests, please try again later' with Retry-After and X-RateLimit headers, and the admin login page shows that message. B signs in normally. Spoofed forwarding headers do not open a new bucket (still 429). Console calls go directly to the API origin. The audit entry records network A's public IP. Known open issues I099 and I028: limiter state is in memory per API instance and resets on restart, and there is no per-account lockout.

**Needs:** Two networks

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/admin/.env.production`

## ADMIN-N006 · P1 · Payments page: find any contribution and read its timeline

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Contributions in several states: SUCCEEDED (Paystack), PENDING, FAILED, EXPIRED and PARTIALLY_REFUNDED. A donor email with more than one gift. A pending refund request linked to a settled payment.

**Steps:**

1. Open Finance > Payments (/payments). Search by an exact Paystack reference.
2. Search by exact donor email; then by campaign ID with Status 'failed'; then by Provider 'wallet'.
3. Search for a reference that does not exist.
4. Click 'View timeline' on a result and copy the URL.
5. Open /payments?ref=<reference> and /payments?id=<contribution id> in new tabs.
6. Open the timeline of a FAILED payment and of a SUCCEEDED one.
7. From /refund-requests, click 'View payment timeline'.
8. Block GET /admin/payments in DevTools and search; then block GET /admin/payments/:id and open a timeline.

**Expect:** Results show the amount in the payment's own currency, a status chip, date, provider, reference and donor email, capped at the 50 most recent ('<n> most recent matches'). No match shows 'No payments match.' with 'Check the reference or email is exact. Only the 50 most recent matches are shown.' The timeline shows the amount (plus the platform tip when present), status, provider and method chips, 'Contribution <id> · Reference <ref or not issued>', a campaign link, the donor email or 'Donor email not recorded', and a list: 'Contribution created', each provider attempt with its status and reference (no raw provider payloads), then 'Last updated: <status>'. ?ref= runs the search at once and ?id= opens the timeline. 'Refund payment' shows only for settled or partly refunded payments; others say 'Only a settled or partly refunded payment can be refunded.' A search failure shows a red alert; a timeline failure shows an alert with Retry.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/PaymentsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## ADMIN-N011 · P1 · Resolve a stuck payout by re-checking Paystack

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Single-transfer Paystack campaign payouts in PROCESSING for more than 24 hours whose reference Paystack cannot confirm (age them in the DB), escalated to NEEDS_REVIEW by the reconciliation sweep or POST /admin/reconciliation/payouts. Prepare one whose Paystack transfer succeeded, one that failed or is unknown to Paystack, and one still pending. A batched payout in NEEDS_REVIEW.

**Steps:**

1. Run POST /api/v1/admin/reconciliation/payouts and open /payouts.
2. On a NEEDS_REVIEW single-transfer card, read the warning; type under 20 characters in 'What you checked', then 20 or more, and click 'Re-check Paystack and resolve'.
3. Resolve the succeeded, failed or unknown, and still-pending cases.
4. Resolve the same payout again via POST /payouts/stuck/campaign/:id/resolve.
5. Look at the batched NEEDS_REVIEW card.
6. Check campaign balances, the owner's payout history and /audit.

**Expect:** Only single Paystack transfers escalate, and only after 24 hours; their funds stay reserved. The card says Paystack has not confirmed the transfer for over a day and explains the three outcomes. The button is disabled below 20 characters. A succeeded transfer shows 'Paystack reported success; the payout is now paid.' and settles once. A failed or unknown transfer returns the reserved funds to the campaign exactly once ('Paystack reported failed; the payout is now failed.'). A still-pending transfer shows 409 'Paystack still reports this transfer as "pending". Resolve it once Paystack reaches a final state.' and nothing changes. If Paystack is unreachable: 502 'Paystack could not be reached to confirm this transfer. Try again shortly.' A repeat resolve returns 409 'Only a payout awaiting review can be resolved (this one is PAID).' (or FAILED). The batched card shows the 'Partially settled…' alert and no resolve control. Each resolution writes a 'payout.stuck_resolved' warning audit entry with the note.

**Needs:** Paystack test keys, DB access

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/ResolveStuckPayoutUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`

## ADMIN-N012 · P1 · Reject an affiliate payout

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Affiliate F with a PENDING affiliate payout (commissions linked) and another PENDING payout F2. Admins A and B.

**Steps:**

1. On /affiliates, click 'Reject' on F's pending payout. Enter a reason under 20 characters, then 20 or more, and click 'Reject payout'.
2. Check F's affiliate dashboard on web (available balance, commissions).
3. Approve the rejected payout via the API.
4. Have Admin A and Admin B reject F2 at the same moment.
5. Check /audit.

**Expect:** The dialog 'Reject affiliate payout?' says '<amount> returns to the affiliate's available balance. No transfer is sent.' and the button stays disabled below 20 characters. Success shows 'Payout rejected; the funds are back in the affiliate’s available balance', and the row shows the rejected status. F's withdrawable balance rises by the amount and the linked commissions are released; no transfer exists. Approving afterwards returns 409. The concurrent rejects return funds once: one succeeds and the other gets 409. An 'affiliate_payout.rejected' audit entry records the reason.

**Needs:** Two admin accounts

**Source:** `apps/admin/src/pages/AffiliatesPage.tsx`, `apps/api/src/application/use-cases/RejectAffiliatePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/affiliateRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutClosureTransaction.ts`

## ADMIN-N014 · P1 · Staff-assisted account closure from the member detail page

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Member M1 with no balances or open payouts, signed in elsewhere. Member M2 with a GHS 10 wallet balance. Admin A (USERS delete permission) and Admin B.

**Steps:**

1. Open /users/<M1>, find the 'Account closure' panel and click 'Close account'.
2. Type a note under 20 characters and a different email; then a 20+ character note saying how the request was verified, and M1's email in upper case.
3. Click 'Close account'.
4. As M1, click anything in the open session, then try to sign in.
5. Open /privacy-requests (Account deletion and retention) and /audit.
6. Repeat for M2.
7. Open Admin B's detail page. Via API, POST /admin/users/<Admin A>/close as Admin A, and /admin/users/<Admin B>/close; then any closure as U1.

**Expect:** The panel explains it is for holders who cannot sign in, and never to ask for a password or code. The dialog warns 'This signs the member out everywhere and starts erasure of their profile data. It cannot be undone from the console.' and the confirm button stays disabled until the note has 20 characters and the email matches (case-insensitive). Success returns you to /users; M1's session ends (401, then sign-in) and M1 cannot sign in; an erasure request appears in the deletion queue; an 'account.staff_closure' warning audit entry records the note; money records and verification evidence are kept. M2 is refused with 409 and the closure-blocker message, and nothing is erased. Admin detail pages have no closure panel; the API returns 409 'Administrator accounts cannot be closed from the console.' for B, 409 'Close your own account from your profile, not the staff console.' for A's own ID, 400 'The confirmation email does not match this account.' for a wrong email, and 403 for non-admins. Integration defect to confirm (not in triage): on integrate/launch-fixes this route calls DeleteAccountUseCase.execute(id) without a password, while app.ts wires the password step-up (I108) into that use case, so every staff closure will probably fail with 400 'Enter your current password to delete your account…' after the 'account.staff_closure' audit row is already written (M2's refusal also leaves that row). Log it as a P1 defect if you see it. Known open issue I083: there is no staff email-change flow or account-support runbook.

**Needs:** Two admin accounts

**Source:** `apps/admin/src/components/AccountClosureControl.tsx`, `apps/admin/src/pages/UserDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/app.ts`

## ADMIN-N015 · P1 · Restricted users view: direct restriction, lifting and superseded decisions

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Member U1 with an active live session and a comment draft. A pending safety report R1 about U1. Admins A and B.

**Steps:**

1. On /safety-reports, click 'Restricted users'. Enter an invalid account ID, then U1's ID with notes under 20 characters, then 20 or more, and click 'Restrict publishing'.
2. As U1, try to comment, post an update and donate with a message; open Wallet and Settings. Check U1's live broadcast.
3. Try to restrict Admin A's own account from Admin A's session.
4. Lift U1's restriction with notes of 20 or more characters; lift again via the API.
5. Resolve R1 with 'Restrict publishing'. Then, in the Restricted users view, lift and directly restrict U1 again (a newer decision). Go back to R1 in the resolved view and click 'Restore publishing after appeal'.
6. Click 'Lift the current restriction anyway'.
7. Check /audit.

**Expect:** 'Restrict publishing' stays disabled until the ID is a valid 24-character ID and the notes have 20 characters; success shows 'Publishing restricted.' and the list shows U1's name or email, the time, 'direct restriction' and the reason. U1 gets the 403 publishing message but keeps Wallet, Settings and funds, and the live broadcast is stopped. Restricting yourself returns 403 'Another administrator must restrict your account.' Lifting shows 'Publishing restriction lifted. Previously hidden content stays hidden.'; a second lift returns 404 'This account has no active publishing restriction.' Restoring from the older report R1 returns 409 'The current restriction came from a different decision. Review it and confirm before lifting it.' and shows 'Lift the current restriction anyway', which then succeeds with 'Publishing restriction removed. Previously hidden comments and messages remain hidden.' Restriction history is kept, and each restrict and lift is audited.

**Needs:** LiveKit (live stop)

**Source:** `apps/admin/src/components/RestrictedUsersPanel.tsx`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## ADMIN-N016 · P1 · Safety reviewers cannot decide reports they have a stake in

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Admin A also uses a member web session. Reports: R1 filed by Admin A about U1's comment; R2 about a comment Admin A authored; R3 about an update or comment on Admin A's own campaign. Admin B. A soft-deleted comment and a comment on a pending_review campaign.

**Steps:**

1. As Admin A, open /safety-reports and try any decision on R1, R2 and R3.
2. As Admin B, decide R1, R2 and R3.
3. As member U2, report the deleted comment and the comment on the non-public campaign.
4. Hide a comment (through a report) that already had a deletedAt, and check deletedAt in the DB.

**Expect:** Every decision by Admin A returns 403 'Another administrator must review this report.' and changes nothing. Admin B's decisions succeed. Both member reports return 404 'Comment not found'. Hiding keeps the comment's original deletedAt.

**Needs:** Two admin accounts

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## ADMIN-N017 · P1 · Staff decisions send in-app notices to affected users

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Organiser U1 with two pending campaigns. U2, U3 and U4 with pending identity KYC. U5 filed a campaign report. U6 filed a safety report about U7's comment, and U8 filed another safety report. Admin A.

**Steps:**

1. Approve U1's first campaign, then block it, then return it to review. Reject the second campaign. Use internal notes that say 'INTERNAL-ONLY'.
2. Approve U2's KYC, reject U3's with an applicant reason, and request more information from U4.
3. Mark U5's campaign report reviewed. Hide U7's comment from U6's report. Dismiss U8's report.
4. Repeat one decision (double-click or API retry).
5. Check each user's in-app inbox on web and mobile, and their email.

**Expect:** U1 receives 'Your campaign is live' ('“<title>” passed review and is now public.'), 'Your campaign has been blocked', 'Your campaign is back in review' and 'Your campaign was not approved', with block and reject notices pointing to support for details or appeal. 'INTERNAL-ONLY' appears in no notice. U2: 'Your identity verification is approved'. U3: 'Your identity verification was not approved' with 'Reason: <applicant reason>'. U4: 'More information needed for your verification'. KYC notices link to /kyc. U5 and U6 receive 'We reviewed your report'. U7 receives 'Your comment was removed' with the support contact. U8 gets the acknowledgement; nobody else is notified for the dismissal. A repeated decision creates no second notice. No decision emails are sent.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`

## ADMIN-N018 · P1 · Admin campaign list reaches older pending campaigns and shows ended ones as expired

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** More than 100 campaigns. A pending_review campaign P created before the newest 100. An active campaign E whose end date has just passed. A pending campaign PE whose end date has passed.

**Steps:**

1. Open /campaigns, switch to the Pending tab and search for P.
2. Wait at least 5 minutes after E's end date, reload /campaigns and open E.
3. Try to approve PE with valid notes and attestations.
4. Open E on public web Explore.

**Expect:** P appears in the Pending tab (the console loads every page of /campaigns). E shows status expired within about 5 minutes (background sweep); its money figures are unchanged, and it no longer appears as open on Explore or in the sitemap. Approving PE returns 409 'An expired campaign cannot be approved' and PE stays pending (the sweep never changes pending or blocked campaigns).

**Needs:** Load fixtures

**Source:** `apps/admin/src/hooks/useApiData.ts`, `apps/admin/src/pages/CampaignsPage.tsx`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## ADMIN-N019 · P1 · Provider dispute and refund events, and on-demand top-up reconciliation (API only)

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Paystack test webhook tooling. A settled creator tip (tip- reference), a settled campaign donation D2 and an intent already REFUNDED. Admin token and U1 token.

**Steps:**

1. Send a signed charge.dispute.create for the tip reference; replay it.
2. GET /api/v1/admin/payments/provider-events?status=open.
3. POST /api/v1/admin/payments/provider-events/<id>/acknowledge twice.
4. Send refund.processed for D2's reference, which no Ujimora refund requested; open /disputes.
5. Send a redelivered charge.success for the REFUNDED intent.
6. POST /api/v1/admin/reconciliation/topups as admin, then as U1.

**Expect:** Each unique provider event is stored once (replays add nothing) with kind dispute, subject tip, reference, amount, currency and provider status, and no customer details; the open list shows it. The first acknowledge returns {reviewStatus: 'acknowledged'} and the second returns 404 'Provider event not found or already acknowledged'. The unrequested refund opens a 'Refund issued outside Ujimora' case in /disputes that pauses payouts for D2's campaign. The redelivered charge.success returns 200 with no second journal. The top-up sweep returns 200 with its summary; U1 gets 403. Known open issue I009: non-campaign provider events have no console page, and there are no automatic holds, clawbacks or chargeback ledger reversals.

**Needs:** Paystack webhook tooling

**Source:** `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`

## ADMIN-016 · P2 · Roles page is an accurate read-only reference

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Admin A. U1 access token.

**Steps:**

1. Open /roles.
2. Expand 'Explore permissions' for each role.
3. Compare with DEFAULT_ROLES in packages/types/src/rbac.ts.
4. Export as CSV.
5. Call GET /api/v1/rbac/me as Admin A and as U1.

**Expect:** Five built-in roles are shown (Super Admin, Admin, Moderator, Organization, User) with a 'View only' notice and no edit controls. The matrix matches the source. /rbac/me returns the full Admin permission set for Admin A, and an empty permission list with roleName '' for U1, because only administrator accounts hold staff permissions. Known open issue I028: Moderator and Super Admin still cannot be assigned (UserRole is only user, organization or admin) and every admin API only checks requireAdmin, so restricted staff accounts are not possible and must not be promised in staffing docs.

**Needs:** None

**Source:** `apps/admin/src/pages/RolesPage.tsx`, `packages/types/src/rbac.ts`, `packages/types/src/user.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`, `docs/compliance/STAFF_ACCESS.md`

## ADMIN-022 · P2 · Overview and list performance at launch-scale data

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Staging seeded with at least 5,000 users, 1,000 campaigns and 20,000 donations.

**Steps:**

1. Open /overview, /users, /donations and /campaigns and time until interactive.
2. While /overview is loading, create a new donation.
3. Export Donations as XLSX.

**Expect:** Pages load in a reasonable time (set a target, for example under 5 s) without freezing the browser. Overview pulls every page of users, campaigns and donations client-side (loadAll, 100 per page), so watch memory. A mid-load change produces 'Records changed while loading. Please retry the export.', not partial data. The export completes and shows progress text.

**Needs:** Load fixtures

**Source:** `apps/admin/src/hooks/useApiData.ts`, `apps/admin/src/lib/exports/loadAll.ts`, `apps/admin/src/pages/OverviewPage.tsx`

## ADMIN-024 · P2 · Notification bell list and read state

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Admin A has at least 3 unread in-app notifications.

**Steps:**

1. Open the bell.
2. Mark one notification read, then use mark-all-read.
3. Reload the page, and check a second tab.

**Expect:** The unread count decrements correctly and persists after reload (PUT /notifications/:id/read and /notifications/read-all). No console errors while polling.

**Needs:** None

**Source:** `packages/ui/src/components/NotificationBell.tsx`, `apps/admin/src/components/layout/TopBar.tsx`

## ADMIN-039 · P2 · KYC counters come from the server and agree across Dashboard and KYC Review

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Several pending KYCs and at least one KYC decided earlier today (UTC) by another admin.

**Steps:**

1. Note the Dashboard's Pending KYC, KYC Approved Today and KYC Rejected Today.
2. Open /kyc-review and read the header stats. Open the Status filter.
3. Approve one, reject one and request more information on a third; watch the header stats after each.
4. Reload both pages.
5. If possible, repeat just before and after 00:00 UTC.

**Expect:** The KYC Review header shows 'Pending', 'Approved today (UTC)' and 'Rejected today (UTC)' from GET /kyc/stats, so decisions made earlier by other admins are counted; the numbers match the Dashboard. The header refreshes after each approve, reject and information request. The Status filter offers only All Statuses, Pending and In Review. After reload the Dashboard and KYC Review agree. 'Today' is the UTC calendar day and resets at 00:00 UTC.

**Needs:** None

**Source:** `apps/admin/src/pages/KYCReviewPage.tsx`, `apps/admin/src/pages/DashboardPage.tsx`, `apps/admin/src/hooks/useApiData.ts`

## ADMIN-075 · P2 · Settings tabs, personal alerts and appearance

*Surfaces:* admin, api, email  ·  *Type:* functional

**Before:** Admin A with an unverified email and then a verified one.

**Steps:**

1. Open /settings?tab=notifications. Toggle an alert while the email is unverified, and use the verification request.
2. Verify the email and toggle 'Email' for 'Withdrawals and payouts'.
3. Open the appearance tab and toggle Dark mode and the surface style. Reload.
4. Open /settings?tab=bogus.

**Expect:** Unverified email: the email channel is gated and a verification email is sent. After verification, choices save immediately. Dark mode and skin persist in this browser. An unknown tab falls back to Payments. With 'canEdit' false, policy Save buttons are disabled.

**Needs:** Email provider

**Source:** `apps/admin/src/pages/SettingsPage.tsx`, `apps/admin/src/components/ActivityAlertSettings.tsx`, `apps/admin/src/context/ColorModeContext.tsx`

## ADMIN-080 · P2 · AI usage page

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** AI_WRITING_ENABLED=true and OPENAI_API_KEY set. Users made AI writing requests with consent.

**Steps:**

1. Open /ai-usage and check the stats and paginated usage (20 per page).
2. Export the usage.
3. Disable AI and reload.

**Expect:** Counts match usage records. Rows show user, date, consent version and provider, with no prompts, outputs or keys, in the UI or the export. Disabled or no data shows zeros without errors.

**Needs:** OpenAI

**Source:** `apps/admin/src/pages/AiUsagePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/aiWritingRoutes.ts`

## ADMIN-084 · P2 · Responsive layout, navigation and accessibility

*Surfaces:* admin  ·  *Type:* cross-platform

**Before:** Admin A. Chrome, Safari and Firefox. Viewport 390 px and desktop.

**Steps:**

1. At 390 px, open 'Open navigation menu', navigate to Payouts, and check the drawer closes.
2. Scroll the KYC, Payouts, Safety and Privacy queues and the export menu for horizontal overflow.
3. Use the keyboard only (Tab, Enter, Space) to approve a publication review and open the export menu.
4. Sign in for the first time on desktop (the product tour auto-starts), finish it, then use 'Replay tour' from the user menu.
5. Enable prefers-reduced-motion.

**Expect:** No horizontal page scroll. Focus is visible on decision buttons and dialogs. Every control is reachable by keyboard. The tour shows once per user on desktop only and can be replayed. Animations stop under reduced motion.

**Needs:** None

**Source:** `apps/admin/src/components/layout/AdminLayout.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/admin/src/components/layout/TopBar.tsx`, `apps/admin/src/components/Tour.tsx`

## ADMIN-086 · P2 · Top bar has no dead search box

*Surfaces:* admin  ·  *Type:* functional

**Before:** Admin A.

**Steps:**

1. Look at the top bar at desktop width and at 390 px.
2. Open the user menu and click 'Replay tour'; step through every tour step.

**Expect:** There is no 'Search…' input in the top bar at any width. The product tour has no 'Search everything' step; it goes from 'Your sections' to the notification bell step. Global search is not offered; staff use each page's own search and filters.

**Needs:** None

**Source:** `apps/admin/src/components/layout/TopBar.tsx`, `apps/admin/src/components/layout/AdminLayout.tsx`

## ADMIN-N013 · P2 · Activity email checks queue

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** At least two activity-alert email rows parked in delivery review (worker status 'review' after an unconfirmed send, or DB fixtures with status 'review' and channel 'email'). Access to the Resend log.

**Steps:**

1. Open Platform > Activity email checks (/activity-email-review) and from the bell ('Activity emails needing a delivery check').
2. Read a card; look up its idempotency key in the Resend log.
3. Type a note under 20 characters, then 20 or more. Click 'Mark delivered' on one and 'Give up on this email' on the other.
4. Open the same row in two tabs and decide it in both.
5. Look for a re-send option. Check /audit.

**Expect:** Cards show the email title, 'Idempotency key: <key>', the category, first attempt time, attempt count and a link to the recipient account, and never the email address or body. The info alert says to check the provider log and that the page cannot re-send. Buttons are disabled below 20 characters. 'Mark delivered' shows 'Marked delivered.' and 'Give up on this email' shows 'Email given up. It will not be sent.'; the row leaves the list and the bell count drops. The second tab gets 409 'This email is no longer waiting for a delivery check. Refresh the list.' No re-send exists. Audit entries activity_email.delivered and activity_email.suppress record the note.

**Needs:** Email provider (Resend), DB access

**Source:** `apps/admin/src/pages/ActivityEmailReviewPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActivityDeliveryRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## ADMIN-N020 · P2 · Payout transfer controls have their own per-admin rate limit

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** A payout in PROCESSING (or awaiting Paystack OTP). Admins A and B on the same network. A script that can create donation checkouts from that network.

**Steps:**

1. As Admin A, click 'Check Paystack status' (or call POST /payouts/:id/transfer-control {action: 'refresh'}) 31 times within 15 minutes.
2. As Admin B, click 'Check Paystack status' once.
3. Run 60 donation checkout requests from the same network, then have Admin B authorize an OTP.

**Expect:** Admin A's 31st control call returns 429 'Too many requests, please try again later'. Admin B is unaffected because the bucket is per admin. Donor checkout traffic does not use up the payout-control bucket, so B can still enter a time-limited Paystack OTP.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/admin/src/components/PayoutTransferControls.tsx`

## ADMIN-N021 · P2 · Profile Preferences tab explains staff alerts instead of dead switches

*Surfaces:* admin  ·  *Type:* functional

**Before:** Admin A.

**Steps:**

1. Open /profile and read the page introduction.
2. Open the Preferences tab.

**Expect:** The introduction reads 'Manage your personal details and password.' The Preferences tab shows no email or push switches and no language picker. It says 'Staff alerts appear in the notification bell at the top of the console.' and 'Email and browser push alerts for staff are not available yet, and the console is in English only. Account security emails, such as password-change notices, are not affected.' There is no Save Preferences button.

**Needs:** None

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`

## ADMIN-N022 · P2 · Console session survives device clock skew

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin A on a test laptop whose clock can be changed.

**Steps:**

1. Sign in. Set the device clock 20 minutes behind and keep using the console for 20 minutes (past the 15-minute token life).
2. Set the clock 20 minutes ahead and keep using the console.
3. With the clock correct, go offline just as a token renewal is due, then click a page.

**Expect:** With the clock behind, the first 401 triggers one forced token refresh and the request is retried, so pages keep loading and you are not signed out. With the clock ahead, the console does not refresh on every request and does not sign you out, because expiry is measured from when this browser received the token. During the offline renewal the page shows 'Unable to renew your session. Check your connection and try again.' and you stay signed in; the session continues once you are back online. The 60-minute idle logout still applies.

**Needs:** None

**Source:** `packages/ui/src/browserSession.ts`, `apps/admin/src/lib/api.ts`
