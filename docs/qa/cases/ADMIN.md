# Admin console (87 cases)

Staff access and roles, dashboards, reviews, payouts, refunds, users, audit logs, exports, content and settings.

[Back to the QA plan](../README.md)

## ADMIN-001 · P0 · Admin sign-in happy path lands on Dashboard

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Staging admin console (admin.ujimora.com equivalent) pointed at the staging API. Admin A (role=admin, MFA off) exists.

**Steps:**

1. Open /login.
2. Enter Admin A's email and password and click 'Sign in to workspace'.
3. Watch the redirect and the top bar.
4. Open the user menu, then Profile (/profile).

**Expect:** You are redirected to / (Dashboard). The KPI tiles load without error banners. The top bar shows Admin A's first name. The Profile header chip reads 'Administrator'. localStorage holds uf_admin_tokens, uf_admin_user and uf_admin_token.

**Needs:** None

**Source:** `apps/admin/src/pages/LoginPage.tsx`, `apps/admin/src/context/AuthContext.tsx`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`

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

**Before:** Production console (read-only check).

**Steps:**

1. On production /login try admin@ujimora.com / Admin2026! (the seed-dev.mjs credentials).
2. In Users, filter Role = admin and review every admin account.
3. Confirm each real admin has a strong unique password and MFA enabled (policy, not enforced by code).

**Expect:** The seed credentials fail. The admin list contains only named, authorised staff; no test or seed accounts. MFA status is recorded for every admin. Sign-off note: MFA is optional in code (MongoMfa.verifyLogin only applies when enabled), so enforcement is procedural.

**Needs:** Production access

**Source:** `apps/api/scripts/seed-dev.mjs`, `apps/admin/src/pages/UsersPage.tsx`, `docs/compliance/STAFF_ACCESS.md`

## ADMIN-012 · P0 · Non-admin account signing in to the admin console

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Regular user U1 (role=user) and organisation user O1 (role=organization) with known passwords.

**Steps:**

1. On the admin /login, sign in as U1.
2. Look at the Dashboard KPI tiles, the sidebar and the notification bell.
3. Visit /campaigns, /payouts, /donations, /users, /settings, /roles and /audit.
4. On any page that renders, try every action button (Approve, Export and so on).
5. Repeat as O1.

**Expect:** Target behaviour: non-staff are refused at login or immediately after sign-in, and see no platform data. Known risk: login accepts any role. The Dashboard calls /analytics/overview, which is not admin-gated, and may show platform totals. The sidebar shows every section. Every admin API call must return 403 and pages must show errors or 'Access denied'. No PII, payout destinations or KYC data may render, and no mutation may succeed. Export must fail at the /users/:id authorisation check. Record any page that shows data as a P0 defect.

**Needs:** None

**Source:** `apps/admin/src/pages/LoginPage.tsx`, `apps/admin/src/components/AuthGuard.tsx`, `apps/admin/src/router.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/analyticsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`

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

**Before:** Staging DB with a known fixture: N users (one soft-deleted), campaigns in each status, settled donations of known GHS amounts (including one with a platform tip), K pending KYC, one KYC approved today and one rejected today, P pending campaign reports.

**Steps:**

1. Open the Dashboard (/).
2. Compare Total Raised, Active Campaigns, Total Users, Pending Disputes, Pending KYC, KYC Approved Today and KYC Rejected Today with hand-calculated values.
3. Open Overview and check average donation, conversion % and monthly growth %.

**Expect:** Total Users excludes deleted users. Active Campaigns equals the count with status=active. Total Raised equals the sum of Donation.amount; confirm tips are excluded and amounts are formatted as 'GH₵ x'. Average donation is rounded to 2 decimal places. Conversion = distinct donors / users × 100. Pending Disputes currently counts pending campaign reports (ReportModel), not the Disputes collection; decide whether the label is correct. All values match the fixture exactly.

**Needs:** DB fixtures

**Source:** `apps/admin/src/pages/DashboardPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`

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

## ADMIN-032 · P0 · Campaign tier thresholds and auto-approve settings

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Admin A. Settings > Campaigns tab.

**Steps:**

1. Enter thresholds out of order (for example 50000, 10000, ...) and check that Save is disabled.
2. Enter an invalid alert email and check that Save is disabled.
3. Set the auto-approve tier to 2 and thresholds to 10000, 50000, 250000, 1000000, then Save.
4. Create a GHS 40,000 campaign (tier 2) and a GHS 60,000 campaign (tier 3) as a verified user.
5. Simulate a network drop after the first PUT during Save (DevTools offline mid-save), then reload Settings.
6. Check GET /admin/commercial-config/:key/history.

**Expect:** Save is disabled for invalid input. After saving, the tier-2 campaign goes live immediately and the tier-3 campaign goes to pending_review. Existing campaigns are unaffected. Known risk: Save sends 6 sequential PUTs, so an interrupted save can leave the tier and thresholds partly updated. The page must show an error, and the reloaded values must reveal the partial state. History records who, when, the reason and the value for each key.

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

**Before:** Paystack test secret key, test transfer balance funded, webhook pointed at staging. Campaign owner U1 has a verified bank or MoMo recipient and GHS 1,000 cleared available balance. U1 requests a standard payout of GHS 500. PAYOUT_DUAL_APPROVAL_AMOUNT=0.

**Steps:**

1. On /payouts (queue view), find the card: 'GHS 500.00 · Standard · Bank / MoMo'.
2. Click 'Review payout destination'. Compare the supplied name with the provider-resolved name.
3. Enter a destination review note of 20 or more characters and click Approve.
4. Wait for the transfer.success webhook and refresh.
5. Check the campaign balance, ledger or journal, U1's web cashout history, and the audit log.

**Expect:** Approve is disabled until the recipient is loaded and the note is at least 20 characters. After approval the notice reads 'Payout approved; the transfer is initiating.' and the status is PROCESSING, with a Paystack reference in Technical details. After the webhook the chip shows 'Completed' (PAID). The campaign available balance drops by the gross amount. Fee and Net on the card match the fee rule (0 for standard). The net sent equals the Paystack transfer amount in pesewas. U1 sees the completed payout. The audit log shows 'Approve' on payouts with the payout, campaign and amount.

**Needs:** Paystack test keys and webhook

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/use-cases/HandlePayoutWebhookUseCase.ts`

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

**Before:** PAYOUT_DUAL_APPROVAL_AMOUNT=1000 on staging. Payout of GHS 1,500 pending. Admins A and B.

**Steps:**

1. Admin A reviews the destination, adds a note and clicks Approve.
2. Admin A clicks 'Give 2nd approval' on the same payout.
3. Admin B reviews the destination, adds a note and clicks 'Give 2nd approval'.
4. Record the production value of PAYOUT_DUAL_APPROVAL_AMOUNT (render.yaml ships 0, which disables this).

**Expect:** After A: 'First approval recorded — a second admin must approve.' The status stays PENDING with a '1st approval: <A>' detail and the info alert. A's second attempt returns 409 'A second, different admin must approve this high-value payout'. B's approval initiates the transfer (PROCESSING). The owner must sign off on the production threshold before launch.

**Needs:** Two admin accounts, Paystack test keys

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/infrastructure/config/index.ts`, `render.yaml`

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

## ADMIN-053 · P0 · Beneficiary (split) payout approval

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true. Campaign with an active split. A beneficiary has a registered recipient and requested a GHS 400 payout. Paystack test keys.

**Steps:**

1. Open /payouts?view=beneficiary.
2. Click Approve before KYC is verified.
3. Click 'Verify KYC', then Approve.
4. With the dual threshold at or below 400, repeat with admins A then B.
5. Set SPLIT_PROCEEDS_ENABLED=false and open the view.

**Expect:** Approving before KYC returns 422 'Beneficiary KYC must be verified before payout'. After 'Beneficiary KYC verified.', approval reserves the beneficiary and campaign balances and initiates the transfer. Maker-checker behaves as in ADMIN-046. Destination replaced after the request: 409. With the flag off, the queue shows an error or empty state, not a crash. Note: unlike campaign payouts, this flow collects no destination review note; decide whether that is acceptable.

**Needs:** SPLIT_PROCEEDS_ENABLED, Paystack test keys

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/BeneficiaryPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`

## ADMIN-056 · P0 · Admin-initiated refund: full, partial, idempotency and rounding (API only)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Settled Paystack test donation intent I of GHS 100.00 with a recorded platform fee, funds still pending (not paid out). Admin token. There is no admin UI; use POST /api/v1/admin/payments/:intentId/refund.

**Steps:**

1. POST a partial refund {amount: 33.33} with Idempotency-Key k1.
2. Repeat the same request with k1.
3. POST {amount: 70} with key k2 (more than the remaining 66.67).
4. POST a full refund of the remainder with k3.
5. On a donation whose funds were already paid out, POST a refund.
6. Check the Paystack refund, intent status, campaign pending balance, compensating journal and web donor history.

**Expect:** Partial: status PARTIALLY_REFUNDED. Beneficiary net, platform fee and processor fee are split in proportion, sum exactly to 33.33, and rounding goes to the processor-fee leg. The repeated k1 returns 409 and no second provider refund. Over-refund: 409 'would exceed the refundable amount'. Remainder: REFUNDED. Already disbursed: 409 '…manual clawback is required'. Original settlement journals are unchanged. Known gap: there is no admin UI to start refunds or search payments; staff need a documented procedure.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminPaymentsController.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `docs/compliance/REFUNDS_AND_FEES.md`

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

## ADMIN-058 · P0 · Donor refund requests reach staff

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Donor D1 with a settled donation.

**Steps:**

1. As D1 on web, open the refund request page and submit a request (reason and description).
2. Confirm D1 sees it under My Refunds.
3. As Admin A, look for the request anywhere in the console (Refund recovery, Donations, Disputes, bell).

**Expect:** Target: staff can find, triage and answer every donor refund request. Known gap: refund intake (RefundModel via POST /refunds) has no admin list or action-center count, so requests are invisible to staff. Block launch until there is a queue or a documented manual procedure with an SLA, and the refund policy on marketing matches it.

**Needs:** None

**Source:** `apps/web/src/pages/RefundRequestPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/refundRoutes.ts`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `apps/admin/src/router.tsx`

## ADMIN-059 · P0 · User 'Report campaign' submissions reach a staff queue

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Active campaign C. Signed-in user U5.

**Steps:**

1. As U5, open C on web and submit a report via 'Report campaign'.
2. As Admin A, note the Dashboard 'Pending Disputes' count and check /disputes, /safety-reports and the bell.
3. Try GET /api/v1/reports (admin API).

**Expect:** Target: campaign reports are listed and actionable in the console with timely handling (Apple guideline 1.2 and Google Play UGC policy). Known gap: reports go to ReportModel, which only increments the Dashboard 'Pending Disputes' tile and the Reports fraud metrics. There is no admin page for them. /disputes reads a separate collection that no user flow writes to. Record as a launch blocker unless handled another way.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`

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

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** U6 submits an access request and a complaint from web or mobile Settings. U7 submits a request and then closes their account.

**Steps:**

1. Open /privacy-requests, section 'Data access, corrections and complaints', filter 'Open and in review'.
2. On U6's request, enter evidence shorter than 20 characters and check that the buttons are disabled.
3. 'Save review progress' with valid evidence. Then 'Publish response to requester' with a response of 20 or more characters.
4. As U6, view the response in Settings.
5. For U7 choose 'Publish in account Settings'. Then switch to 'Record verified external delivery…' with a reference of 20 or more characters.
6. Submit the same request from two tabs.
7. Click 'Load review history' and switch the filter to Responded.

**Expect:** The 30-day target date is shown. in_review is saved. The response appears in U6's Settings and can be downloaded. For the closed account, 'account' delivery returns 409 ('This account is closed…'), while external delivery with a reference succeeds. The second tab gets 409 'Request changed or was already answered'. History shows actor, action and evidence. The response is not editable after it is sent.

**Needs:** None

**Source:** `apps/admin/src/components/DataRightsQueue.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `docs/compliance/DATA_RIGHTS.md`

## ADMIN-065 · P0 · Account deletion and retention review queue

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** U8 has a campaign, donations and a wallet balance. U8 deletes their account in the iOS app, and U9 deletes on web.

**Steps:**

1. Open /privacy-requests, section 'Account deletion and retention'. Check status chips and the 'Operational profile data removed…' text.
2. Click 'Retry pending cleanup'.
3. Save review notes shorter than 20 characters, then with a past 'Next review date', then valid notes with a future date.
4. Edit the same request in two tabs.
5. As U8, try to sign in on mobile and web.

**Expect:** The request appears with the contact email and account ID. Retry runs the erasure sweep. Invalid notes or dates are refused (400 'Set a future review date'). A valid save increments the revision and writes a 'privacy.retention_review' audit entry. A stale tab gets 409. U8 cannot sign in. Financial records and donation totals are preserved while identity is removed.

**Needs:** None

**Source:** `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/privacyRequestRoutes.ts`, `docs/compliance/ACCOUNT_CLOSURE_AUDIT.md`

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

## ADMIN-068 · P0 · Edit plan pricing and limits and check every surface

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* cross-platform

**Before:** Plans page (/plans). Paystack test keys. Store sandbox products mapped for Pro.

**Steps:**

1. Edit Pro: monthly price 79 → 89, platform fee 5 → 4.5, maxCampaignGoal -1 (unlimited). Try fee 101 and accent colour 'blue'.
2. Save and check ujimora.com/pricing (/plans/public) and the web upgrade page. Complete a web Paystack checkout.
3. Open the iOS and Android subscription screens.
4. Set 'active' or 'isPublic' to false on a plan and check marketing and web.

**Expect:** Invalid values are rejected ('Must be a hex colour', fee maximum 100). After saving, marketing and web show GHS 89 and Paystack charges 89.00 exactly (8900 pesewas). The new fee applies to new donations. Native shows the store's localised displayPrice (no GHS web price and no Paystack link). Inactive or non-public plans disappear from pricing. Any plan export keeps -1 as 'unlimited'.

**Needs:** Paystack test keys, store sandbox

**Source:** `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/planRoutes.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/marketing/src/pages/PricingPage.tsx`

## ADMIN-071 · P0 · Coupon discount accuracy and redemption counting at checkout

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Coupons: PCT20CAP (20%, maximum GHS 15), FIXED10 (GHS 10), MIN100 (minimum subtotal 100), ONEUSE (1 per user), NEWONLY (new users only), EMAILONLY (allow-list), EXPIRED, INACTIVE, a donation-fee waiver coupon and a withdrawal-fee coupon. Paystack test keys.

**Steps:**

1. On the web subscription checkout, preview and pay with each coupon on monthly and yearly plans.
2. Abandon one checkout that used ONEUSE, then retry.
3. Replay the charge.success webhook for a coupon payment.
4. Apply the donation coupon to a GHS 100 donation and check the fee breakdown.
5. Try to use a coupon in the iOS or Android subscription flow.

**Expect:** PCT20CAP on GHS 89 gives a GHS 15 discount (cap), not 17.80. FIXED10 subtracts 10 and never goes below 0. MIN100 is refused under 100. ONEUSE is refused on second use, but an abandoned checkout does not consume it. NEWONLY and EMAILONLY are enforced. EXPIRED and INACTIVE are refused. The redemption count in /coupons increments exactly once per settled payment, even after a webhook replay. The donation coupon waives the platform fee so the campaign receives more. Native IAP has no coupon entry.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/PreviewCouponUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/couponRoutes.ts`, `apps/admin/src/pages/CouponsPage.tsx`

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

**Before:** Production admin (admin.ujimora.com on Vercel) and API (api.ujimora.com on Render).

**Steps:**

1. Load admin.ujimora.com over HTTPS, and try http:// to confirm the redirect.
2. In DevTools, confirm /api/v1/* calls go through the Vercel rewrite to api.ujimora.com with no CORS errors. Check CORS_ORIGINS includes https://admin.ujimora.com.
3. Reload deep links such as /payouts?view=all and /content/blog/new.
4. Check response headers on /admin/* queue endpoints (Cache-Control private, no-store).
5. Confirm the 'View donor site' link goes to https://app.ujimora.com.

**Expect:** Everything loads over HTTPS. There are no CORS or mixed-content errors. Deep links load. Admin data responses are not cacheable. The production env has the intended PAYOUT_DUAL_APPROVAL_AMOUNT, REVIEW_ALERT_EMAIL, ADMIN_WEB_URL and MFA_ENCRYPTION_KEY values.

**Needs:** Production access

**Source:** `apps/admin/vercel.json`, `apps/admin/.env.production`, `render.yaml`, `apps/api/src/infrastructure/config/index.ts`

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

## ADMIN-008 · P1 · Change password from Profile > Security

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin A signed in on browsers X and Y.

**Steps:**

1. In X open /profile, then the Security tab.
2. Enter a new password shorter than 8 characters. Then enter mismatching confirm values.
3. Enter a wrong current password with a valid new pair.
4. Enter the correct current password and a valid new password, then click 'Update Password'.
5. In X, go to another page (for example Campaigns). In Y, click anything.

**Expect:** Client validation shows 'Password must be at least 8 characters' and 'Passwords do not match'. A wrong current password shows the API error in a snackbar. On success the snackbar reads 'Password changed successfully'. Y is signed out. Check X: the page does not store the tokens the API returns, so X is likely bounced to /login on its next call. Decide whether that is acceptable or file a bug. The strength meter reflects length, case, digits and symbols.

**Needs:** None

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`

## ADMIN-010 · P1 · Pages that use raw fetch survive an expired access token

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin A signed in. Contact Inbox has at least one submission and Testimonials has at least one row.

**Steps:**

1. Close all console tabs for more than 16 minutes but under 60 minutes, so the stored access token has expired.
2. Open a new tab directly at /contact-submissions.
3. Repeat with /testimonials.
4. Throttle or kill the API and reload /contact-submissions.

**Expect:** Submissions and stats load (the token should be refreshed first). Watch for this known risk: these pages call fetch('/api/v1/...') directly with the stored token, so they may silently show an empty inbox or zero stats on 401. When the API is down, the page should show an error, not an empty 'no submissions' state. File a defect if it shows empty.

**Needs:** None

**Source:** `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/admin/src/pages/TestimonialsPage.tsx`, `apps/admin/src/lib/api.ts`

## ADMIN-014 · P1 · 'Access denied', 404 and deep-link redirect behaviour

*Surfaces:* admin  ·  *Type:* negative/edge

**Before:** Admin A. U1 (non-admin).

**Steps:**

1. Logged out, open /campaigns/<id> directly.
2. Sign in as Admin A and check where you land.
3. As U1, open /roles, /settings and /audit directly.
4. As Admin A, open /does-not-exist and /campaigns/000000000000000000000000.
5. Reload a deep link such as /kyc-review in production (SPA rewrite).

**Expect:** Logged-out visitors are redirected to /login. Pages outside the user's permissions show 'Access denied' / 'You don't have permission to view this page.' with a 'Back to dashboard' button. An unknown route shows the NotFound page. A missing campaign shows the 'Campaign couldn't load' or not-found state. A deep-link reload serves the SPA (vercel.json rewrite), not a 404.

**Needs:** None

**Source:** `apps/admin/src/router.tsx`, `apps/admin/src/components/PermissionDenied.tsx`, `apps/admin/src/pages/NotFoundPage.tsx`, `apps/admin/vercel.json`

## ADMIN-018 · P1 · Refunds and failed payments in analytics totals

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A settled GHS 200 donation on campaign C. Paystack test keys.

**Steps:**

1. Note Total Raised, the campaign's raised amount and the Donations page total.
2. Fully refund the donation (see ADMIN-056).
3. Reload the Dashboard, Overview, Reports, Campaigns and Donations pages.
4. Abandon a Paystack checkout (never paid) and reload again.

**Expect:** Abandoned or failed payments never appear in any total. After a refund, check each surface against the agreed finance policy. Donation documents have no status field, so Dashboard, Reports and the Donations page may still include refunded amounts while the campaign balance drops. Record any mismatch between the campaign raised amount and the platform Total Raised as a defect, or document it as intentional gross figures.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/database/models/DonationModel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`, `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`

## ADMIN-019 · P1 · Reports and Overview charts and month boundaries

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Donations dated across the last 9 months, including one at 23:59 UTC on the last day of a month. Campaigns in 3 categories. Users with and without a country.

**Steps:**

1. Open /reports and /overview.
2. Check the Monthly Donation Trends (9 months), Donations by Category, Geographic Distribution (top 10, 'Unspecified' for a missing country) and Fraud signals (Pending Reports, Flagged Campaigns, Report Rate, Avg Review Time).
3. Export Reports as XLSX and compare the worksheets.

**Expect:** Months are grouped by UTC (Ghana is UTC+0) and the edge donation falls in the correct month. Months with no data show 0. Category names are de-underscored. Guest donors count as 'Unspecified'. The export has one sheet per section and the numbers match the screen.

**Needs:** DB fixtures

**Source:** `apps/admin/src/pages/ReportsPage.tsx`, `apps/admin/src/pages/OverviewPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`, `apps/admin/src/lib/exports/tables.ts`

## ADMIN-020 · P1 · Totals never mix currencies

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** At least one non-GHS settled donation (for example a USD diaspora donation via Flutterwave, or a seeded row) plus GHS donations.

**Steps:**

1. Open /donations and read the header 'N donations · GH₵ X total'.
2. Check Dashboard Total Raised and the Reports category and geography sums.
3. Export Donations to CSV and confirm there is a Currency column on each row.

**Expect:** No surface adds USD amounts to GHS amounts under a GH₵ label. Known risk: the Donations header and the analytics aggregations sum raw amounts regardless of currency. Record a defect if mixed; expected behaviour is a per-currency breakdown or conversion with a disclosed rate. The CSV keeps the currency per row.

**Needs:** Flutterwave keys (pending) or seeded USD donation

**Source:** `apps/admin/src/pages/DonationsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.ts`

## ADMIN-021 · P1 · Subscriptions revenue stats and inert action buttons

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Active paid subscriptions: web Paystack monthly and yearly, and one App Store or Play subscription. Plan prices edited in /plans so they differ from the code seed values.

**Steps:**

1. Open /subscriptions and note the monthly revenue and revenue-by-tier figures.
2. Recalculate using the current DB plan prices (and the store net where relevant).
3. Click 'View' on a row, then 'Tier', then 'Cancel'.

**Expect:** Revenue should reflect actual prices. Known risk: the page uses the code seed prices (SUBSCRIPTION_PLANS), not DB-edited prices or amounts actually charged; file a defect if they differ. 'View' opens /users/:id. 'Tier' and 'Cancel' have no handlers: they should be hidden or work. Admins must not be offered a cancel for store subscriptions (Apple and Google require cancellation through the store).

**Needs:** Paystack test keys, store sandbox

**Source:** `apps/admin/src/pages/SubscriptionsPage.tsx`

## ADMIN-023 · P1 · Action center counts and deep links for every work queue

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin A. Test users able to create one item in each queue.

**Steps:**

1. Create: a pending-review campaign, a KYC submission, a campaign payout request, a contact form message, a safety report, a publication review, a donor-message review, a tip-message review, a data-rights request, an account deletion, a stuck refund operation and a store billing issue.
2. Watch the bell badge and sidebar counts (they poll every 30 s and on window focus).
3. Click each item in the bell's 'Needs attention' inbox.
4. Resolve each item.

**Expect:** Counts increase for each queue. Links go to /campaigns, /kyc-review, /payouts, /payouts?view=beneficiary, /contact-submissions, /safety-reports, /publication-reviews?queue=donation-content-reviews, /publication-reviews?queue=tip-content-reviews, /privacy-requests, /refund-recovery and /store-billing. Counts decrease after resolution. With nothing pending the bell shows 'Reviews are up to date'.

**Needs:** Multiple test accounts

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

## ADMIN-060 · P1 · Disputes list, detail and resolution

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Seed disputes in open, under_review and resolved states in the DB (no user flow creates them).

**Steps:**

1. On /disputes, filter by status and search.
2. Open an open dispute. Submit with empty notes.
3. Pick 'resolved' with notes and submit. Try to resolve again via the API.
4. Pick 'dismissed' on another dispute.
5. Check whether an open dispute blocks automatic payout for its campaign (ADMIN-052).

**Expect:** Empty notes show 'Resolution notes are required.' After resolving, the snackbar reads 'Resolution recorded.', the form disappears and resolvedBy and resolvedAt are set. A second resolve returns 409 'Dispute has already been resolved'. Dismissed status displays correctly. An open dispute prevents automatic payout.

**Needs:** DB seed

**Source:** `apps/admin/src/pages/DisputesPage.tsx`, `apps/admin/src/pages/DisputeDetailPage.tsx`, `apps/api/src/application/use-cases/ResolveDisputeUseCase.ts`

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

**Before:** Subscriptions: web Paystack, iOS IAP, Android IAP, a cancelled one and a free-tier user. More than 25 rows.

**Steps:**

1. Open /subscriptions and filter by tier and status, and search.
2. Check that each row identifies the billing source and dates.
3. Page through and export.

**Expect:** All rows load (loadAll pagination). Filters work. Store subscriptions are clearly identified and have no admin cancel or upgrade path; store subscriptions are managed only in the App Store or Google Play. Counts (total, paid, free) are correct.

**Needs:** Store sandbox

**Source:** `apps/admin/src/pages/SubscriptionsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`

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

## ADMIN-072 · P1 · Edit, deactivate and delete coupons

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Coupon USED5 with 5 redemptions and affiliate attribution. Coupon UNUSED.

**Steps:**

1. Edit USED5: change the amount and dates, confirm the code field is immutable, and deactivate it.
2. Delete UNUSED through the confirmation dialog.
3. Delete USED5. Then check the subscription and affiliate records that reference it and the Reports figures.

**Expect:** Edits persist and a deactivated coupon is refused at checkout immediately. Delete requires confirmation and shows 'Coupon deleted'. Known risk: delete is a hard delete even when redemptions exist; confirm that historical redemptions, affiliate commissions and reports stay intact. If not, prefer deactivation and file a defect.

**Needs:** None

**Source:** `apps/admin/src/pages/CouponsPage.tsx`, `apps/api/src/application/use-cases/DeleteCouponUseCase.ts`, `apps/api/src/application/use-cases/UpdateCouponUseCase.ts`

## ADMIN-074 · P1 · Payment providers toggle and crypto operations

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Payment provider rows for wallet, gateway and method types (mtn-momo, card). CRYPTO_PAYMENTS_ENABLED=false first; then true with Bitnob sandbox.

**Steps:**

1. On /payment-providers, toggle the wallet off and on. Check that web checkout hides and shows the wallet option.
2. Try to enable a disabled method row through the API.
3. With crypto off, check the crypto panel chip.
4. With crypto on, click 'Refresh availability', choose 'older than 30 minutes' and click 'Reconcile deposits' twice. Include one confirmed sandbox deposit.

**Expect:** Wallet and gateway toggles work, with messages like '<name> enabled' or 'disabled'. A method row returns 409 '…has no integration of its own to enable'. With crypto off, the chip reads 'Not offered at checkout'. With crypto on, assets and networks are listed. Reconcile shows scanned, settled and pending counts. The confirmed deposit is credited once, and the second run does not double-credit. Issues list 'Missing provider reference' or 'Provider unavailable'.

**Needs:** Bitnob sandbox (for crypto)

**Source:** `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/admin/src/components/payments/CryptoOperations.tsx`, `apps/api/src/application/use-cases/TogglePaymentProviderUseCase.ts`, `apps/api/src/application/use-cases/ReconcileCryptoUseCase.ts`

## ADMIN-076 · P1 · CMS content blocks update the marketing site

*Surfaces:* admin, api, marketing  ·  *Type:* functional

**Before:** Admin A. ujimora.com staging.

**Steps:**

1. Content > Homepage Stats: change a value. Content > FAQ: add a question. Content > About: edit text. Content > Contact Details: change the phone number and a social link.
2. Leave one page with unsaved edits and check the dirty indicator. Reload to discard.
3. Save each block and check ujimora.com (Stats section, /help FAQ, /about, /contact and the footer).
4. Open the same block as Admin A and Admin B, and save different edits.
5. Put '<script>alert(1)</script>' in an FAQ answer.

**Expect:** Saved blocks appear on marketing (after any cache TTL). Unseeded keys show fallbacks and the first save creates them. The FAQ script renders as text only. Known risk: there is no revision check, so the last write wins and Admin A's edit is silently overwritten. Document this or add a conflict warning.

**Needs:** None

**Source:** `apps/admin/src/hooks/useContentBlock.ts`, `apps/admin/src/pages/content/ContentStatsPage.tsx`, `apps/admin/src/pages/content/ContentFaqPage.tsx`, `apps/admin/src/pages/content/ContentAboutPage.tsx`, `apps/admin/src/pages/content/ContentContactPage.tsx`, `apps/marketing/src/hooks/useContent.ts`

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

## ADMIN-079 · P1 · Contact inbox workflow and newsletter subscriber list

*Surfaces:* admin, api, email, marketing  ·  *Type:* functional

**Before:** Marketing contact form and newsletter signup (double opt-in) available.

**Steps:**

1. Submit the ujimora.com contact form. Check Contact Inbox for a 'new' item and the stats.
2. Open the item, set status to in_progress with admin notes, then resolved, then archived. Filter by status and type.
3. Kill the API and reload the inbox.
4. Subscribe to the newsletter but do not confirm; then subscribe and confirm; then unsubscribe. Check /newsletter each time. Export.

**Expect:** The submission appears with its full text. Status changes persist and stats update. The action-center 'New contact messages' count drops. When the API is down the page should show an error; today it silently shows empty (file a defect). The newsletter list shows only confirmed, opted-in subscribers: unconfirmed and unsubscribed addresses are excluded from the screen and the export.

**Needs:** Email provider (newsletter confirmation)

**Source:** `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/admin/src/pages/NewsletterPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/contactRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.ts`

## ADMIN-081 · P1 · Export formats and fidelity across pages

*Surfaces:* admin  ·  *Type:* functional

**Before:** Data on Campaigns, Users, Donations, Payouts, Audit Log, Privacy, Store billing, Coupons and Subscriptions. Some lists have more than 100 records.

**Steps:**

1. On each page apply a filter, then Export in 'Branded PDF', 'Excel (.xlsx)' and 'CSV (.csv)'.
2. Open the files in Excel, Google Sheets, Numbers and a PDF viewer.
3. Start a large export and click Cancel.
4. Export a page with zero rows.

**Expect:** Filenames look like ujimora-<title>-YYYY-MM-DD.<ext>. Row counts match the filtered on-screen totals, including server pages beyond 100. PDF: Outfit font, logo, watermark, page numbers, headers repeated on each page, wide tables in landscape or field/value layout. XLSX: frozen header, autofilter, typed numbers and dates in UTC, an export-details sheet. CSV: UTF-8 with BOM (Ghanaian characters intact). Cancel produces no file. Empty exports keep headings and a no-records note.

**Needs:** None

**Source:** `apps/admin/src/components/ExportMenu.tsx`, `apps/admin/src/lib/exports/pdf.ts`, `apps/admin/src/lib/exports/xlsx.ts`, `apps/admin/src/lib/exports/report.ts`, `docs/compliance/ADMIN_EXPORTS.md`

## ADMIN-087 · P1 · An admin changing their own public identity (single-admin deadlock)

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Admin A is the only admin. Then add Admin B.

**Steps:**

1. On /profile > Personal details, change Full Name and click 'Save Profile'. Leave 'Use OpenAI to check this public identity' unticked, then try again with it ticked.
2. Follow 'Open review queue in a new tab' and try to approve your own submission.
3. With Admin B present, have B approve it, then save the same values again as A.

**Expect:** The first save is held for review ('After approval, save the same version here.'). A cannot approve their own submission (403 'Another administrator must review your content'), so a single-admin deployment cannot change the admin's name unless OpenAI screening passes. After B approves, A's identical save succeeds and the top-bar name updates. Phone and bio save without review.

**Needs:** OpenAI (optional), second admin

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `docs/compliance/ACCOUNT_PUBLICATION.md`

## ADMIN-016 · P2 · Roles page is an accurate read-only reference

*Surfaces:* admin  ·  *Type:* compliance

**Before:** Admin A.

**Steps:**

1. Open /roles.
2. Expand 'Explore permissions' for each role.
3. Compare with DEFAULT_ROLES in packages/types/src/rbac.ts.
4. Export as CSV.

**Expect:** Five built-in roles are shown (Super Admin, Admin, Moderator, Organization, User) with a 'View only' notice and no edit controls. The matrix matches the source. Sign-off note: only user, organization and admin are assignable (UserRole), and the API enforces admin-only. Restricted Moderator staff are not supported and must not be promised in staffing docs.

**Needs:** None

**Source:** `apps/admin/src/pages/RolesPage.tsx`, `packages/types/src/rbac.ts`, `packages/types/src/user.ts`, `docs/compliance/STAFF_ACCESS.md`

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

## ADMIN-039 · P2 · KYC counters agree across Dashboard and KYC Review

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Several pending KYCs.

**Steps:**

1. Note the Dashboard's Pending KYC, Approved Today and Rejected Today.
2. Approve one and reject one in /kyc-review, and check the header stats.
3. Reload both pages.

**Expect:** The KYC Review header updates immediately from local status. After reload, the Dashboard (/kyc/stats) and KYC Review agree. 'Today' uses local calendar day; confirm the boundary at midnight GMT.

**Needs:** None

**Source:** `apps/admin/src/pages/KYCReviewPage.tsx`, `apps/admin/src/pages/DashboardPage.tsx`

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

## ADMIN-086 · P2 · Top-bar global search

*Surfaces:* admin  ·  *Type:* functional

**Before:** Admin A.

**Steps:**

1. Type a known campaign title, user email and donation ID into the top-bar 'Search…' box and press Enter.

**Expect:** Target: search returns matching campaigns, users and donations, as the product tour says ('Jump straight to any campaign, user, or donation'). Known risk: the input has no handler and does nothing. Wire it up, or remove it and the tour step before launch.

**Needs:** None

**Source:** `apps/admin/src/components/layout/TopBar.tsx`, `apps/admin/src/components/layout/AdminLayout.tsx`
