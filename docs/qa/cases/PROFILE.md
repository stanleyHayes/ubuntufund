# Profile, settings & privacy (82 cases)

Profile edits and publication review, privacy switches, alerts and newsletter consent, blocked users, data-rights requests, account deletion, legal pages.

[Back to the QA plan](../README.md)

## PROFILE-002 · P0 · Signed-out users cannot read or change profile, settings or privacy data

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Logged out. U1's user id is known.

**Steps:**

1. Web: open /profile and /settings; a sign-in panel appears. Sign in as U1; you return to the page you requested.
2. Mobile signed out: the Profile tab shows the sign-in-required view plus 'Legal & trust · All policies'. Open ujimora://settings: sign-in-required view.
3. API with no Authorization header: GET, PUT and DELETE /api/v1/profile; GET /api/v1/data-rights; GET /api/v1/safety/blocks; GET /api/v1/profile/activity-alerts; GET /api/v1/newsletter/preference; GET /api/v1/publication-reviews.
4. Repeat step 3 with a garbage bearer token and with an expired token.

**Expect:** Every API call returns 401 ('Authentication required' / 'Invalid or expired token'). Nothing changes. The UI never shows cached data from a previous user.

**Needs:** None

**Source:** `apps/web/src/components/auth/RequireAuth.tsx`, `apps/mobile/app/settings.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`

## PROFILE-005 · P0 · Profile update ignores privileged fields and cannot target another account

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** U1 and U2 exist. A1 can open the admin console.

**Steps:**

1. As U1, PUT /api/v1/profile with {bio:'ok', role:'admin', email:'x@evil.test', emailVerified:true, verificationLevel:3, trustScore:100, legalAcceptance:{version:'x'}, userId:'<U2 id>', deletedAt:null, needsWebsite:true}.
2. GET /api/v1/profile as U1 and as U2.
3. A1: open admin /users/<U1 id> and /users/<U2 id>.

**Expect:** 200 and only the bio changes. Role, email, verification, trust score, legal acceptance and website flag are unchanged. U2 is untouched. No profile endpoint accepts a target user id.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/domain/ports/outbound/AccountProfileWritePort.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ProfileController.ts`

## PROFILE-011 · P0 · Name change without OpenAI consent is held privately for staff review

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** U1 has no avatar or cover and a current legal acceptance. A2 is an admin. OpenAI checkbox unchecked.

**Steps:**

1. Web Profile > Edit Profile: change Full Name to 'Ama Test Two' and click 'Save Changes'.
2. Watch the error alert and the embedded Publication reviews panel.
3. As a guest, GET /api/v1/users/<U1 id>/public and check U1's header name.
4. A2: admin.ujimora.com/publication-reviews, queue 'Publication proposals', status 'pending'.

**Expect:** The message reads 'Saved privately for safety review. Your content has not been published…'. The list shows 'account profile · pending' with a Reference id and 'name: Ama Test Two'. The public and header names are unchanged. Admin shows the item with reason 'staff requested' and the author id. The admin action-center pending count increases.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/account/PublicationReviews.tsx`, `apps/admin/src/pages/PublicationReviewsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## PROFILE-012 · P0 · An approved identity version publishes only when resubmitted exactly, within 7 days

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** PROFILE-011 pending item exists.

**Steps:**

1. A2: enter review notes of >= 20 chars and click 'Approve this version'.
2. U1 Settings > Publication reviews > Refresh: the status is approved, with 'Review response: …' and 'Approval expires <date>'.
3. U1 re-saves exactly 'Ama Test Two' on Profile.
4. Check the header, account menu, mobile Profile tab name and GET /users/<U1>/public.
5. Save a different name, 'Ama Test Three'.

**Expect:** The approval expiry is about now + 7 days. The exact resubmission saves ('Profile updated!') and the name updates on every surface. An audit log entry 'publication.approved' exists. A different name creates a new pending review.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/pages/ProfilePage.tsx`

## PROFILE-017 · P0 · Publishing restriction and missing legal acceptance block identity edits, not private settings

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A1 has applied a publishing restriction to U2 (admin Safety reports). U4 has no current legal acceptance.

**Steps:**

1. U2: change the name on Profile.
2. U2: change phone/bio, turn off 'Allow profile to be public', open Data rights, open the Delete account dialog (cancel), view the wallet.
3. U4: change the name; upload a new avatar.
4. U4: change phone/bio; hide the profile.

**Expect:** U2's name change returns 403 (publishing restricted, appeal via support@ujimora.com). U4's name change and upload return 428 'Review the current account agreement and confirm you are at least 18 before publishing or uploading content'. All private settings, funds, data rights and deletion stay available.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`

## PROFILE-019 · P0 · Administrators cannot approve their own identity changes

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A1 and A2 are admins.

**Steps:**

1. A1: admin console /profile, change the name (OpenAI unchecked) and save. Use 'Open review queue in a new tab'.
2. A1: add notes to the own item and click 'Approve this version'.
3. A2 approves the same item.
4. A1 re-saves the same name.

**Expect:** Step 1 shows the held message and the queue link. Step 2 returns 403 'Another administrator must review your content'. Step 4 succeeds. Admins skip the legal-acceptance gate but not review.

**Needs:** None

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`

## PROFILE-021 · P0 · Publication review lists are per-user; admin review endpoints need the admin role

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** U1 and U2 each have reviews.

**Steps:**

1. As U2: GET /api/v1/publication-reviews and ?status=approved.
2. As U1: GET /api/v1/admin/publication-reviews; PUT /api/v1/admin/publication-reviews/<id>/review.
3. As U1: sign in to admin.ujimora.com and open /publication-reviews.

**Expect:** U2 sees only U2's items, without actorId/reviewedBy. U1 gets 403 'Insufficient permissions' on admin endpoints. The admin UI denies access.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/admin/src/router.tsx`

## PROFILE-027 · P0 · Public member profile exposes only public fields

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** U1 is public. A1 is an admin.

**Steps:**

1. As a guest: GET /api/v1/users/<U1 id>/public. Check the body and headers.
2. GET /users/abc/public and /users/<random 24-hex>/public.
3. Mobile: open ujimora://profile/<U1 id> signed out, then signed in as U2.
4. GET /users/<A1 id>/public.

**Expect:** 200 with only id, name, avatarUrl, country, trustScore, verificationLevel, role and createdAt (no email, phone or bio). Cache-Control: private, no-store. Invalid or unknown ids return 404 'User not found'. The mobile screen shows name, country, TrustBadge, Role and Verification, plus Report and 'Block user' only when signed in and not on your own profile. The admin profile publicly shows role 'admin'; confirm this is acceptable.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetPublicUserProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userRoutes.ts`, `apps/mobile/app/profile/[id].tsx`, `apps/mobile/src/navigation/resolvePath.ts`

## PROFILE-028 · P0 · Hiding the profile is immediate and hides the member and organization identity

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U1 is public with a published campaign and comments. ORG1 is public.

**Steps:**

1. U1 web Settings > Privacy: turn off 'Allow profile to be public'; 'Settings saved' appears.
2. As a guest and as U2: GET /users/<U1>/public; mobile ujimora://profile/<U1>.
3. Open /campaigns/<U1 campaign id> as a guest and check the organizer card.
4. Check U1's existing comments and named donations.
5. ORG1 does the same, then open /organizations/<slug> and the /organizations directory.

**Expect:** No review is needed. The public profile returns 404 / 'User not found'. The campaign page loads without crashing, and the organizer card handles the missing creator. Comments and donations follow the documented policy (a private profile does not withdraw separately published content); product confirms. The org page returns 404 and the org leaves the directory.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicProfileVisibility.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`, `docs/compliance/ACCOUNT_PUBLICATION.md`

## PROFILE-033 · P0 · 'Make my donations anonymous by default' actually applies

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** U1 signed in. An active campaign exists. Paystack test keys.

**Steps:**

1. Web Settings: turn on 'Make my donations anonymous by default' (on Android: 'Anonymous Donations').
2. As U1, open /c/<slug>/donate on web and the donate flow on Android.
3. Complete a Paystack test donation without touching the anonymity control.
4. Open the campaign donor list and recent donations as a guest.

**Expect:** Anonymity is pre-selected and the donation shows as anonymous. Source suggests this fails: the anonymousDonations setting is stored but no donation flow reads it (only settings code references it). Fix or remove the toggle before launch; a donor who relies on it would be named publicly.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`, `apps/api/src/infrastructure/database/models/ProfileModel.ts`, `apps/web/src/pages/DonatePage.tsx`

## PROFILE-042 · P0 · Newsletter opt-in from Settings sends nothing until the email link is confirmed

*Surfaces:* admin, api, email, web  ·  *Type:* compliance

**Before:** RESEND_API_KEY, FROM_EMAIL and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 (32 bytes) are set; PUBLIC_WEB_URL=https://app.ujimora.com. U1 is not subscribed.

**Steps:**

1. Web Settings > Notifications > 'Marketing emails and newsletter': switch on.
2. Check U1's inbox.
3. Admin /newsletter: search for U1.
4. Open the confirm link (https://app.ujimora.com/newsletter/confirm#token=…). Before clicking anything, check the address bar.
5. Click 'Confirm subscription'.
6. Settings > 'Refresh newsletter status'; admin /newsletter.

**Expect:** Step 1 shows 'Check your email to confirm. No newsletters will be sent until you confirm.' with the label 'Requested — awaiting email confirmation'. The email 'Confirm your Ujimora newsletter subscription' contains confirm and cancel links and a 30-minute validity. U1 is not in the admin list before confirming. Opening the page changes nothing, and the token is removed from the URL. After confirming, a success message appears, Settings shows 'Subscribed', and admin lists U1 with a Confirmed date.

**Needs:** Resend email provider

**Source:** `apps/web/src/components/account/NewsletterSettings.tsx`, `apps/web/src/pages/NewsletterConsentPage.tsx`, `apps/api/src/application/services/NewsletterConsentService.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/admin/src/pages/NewsletterPage.tsx`

## PROFILE-044 · P0 · Unsubscribe from an email link works without signing in and is idempotent

*Surfaces:* admin, email, web  ·  *Type:* compliance

**Before:** U1 subscribed and confirmed, with both emails kept.

**Steps:**

1. In a private window, open the unsubscribe link (/newsletter/unsubscribe#token=…) and click 'Unsubscribe'.
2. Reopen the same link and click again.
3. Sign in: check Settings newsletter status and admin /newsletter.
4. Re-subscribe and confirm, then use the OLD unsubscribe link from the first email.

**Expect:** 'You are unsubscribed. Any pending confirmation request is cancelled. Your account and activity-alert choices are unchanged.' The repeat also succeeds. Settings shows 'Off' and admin no longer lists U1. The old link still unsubscribes after re-subscribing.

**Needs:** Resend

**Source:** `apps/web/src/pages/NewsletterConsentPage.tsx`, `apps/api/src/application/services/NewsletterConsentService.ts`, `docs/compliance/NEWSLETTER.md`

## PROFILE-049 · P0 · Blocking a user hides both users from each other on every entry point

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U2 has a comment on campaign X, a creator page /creators/<handle> and named leaderboard donations.

**Steps:**

1. Web as U1: on /c/<slug>, block U2 from U2's comment.
2. Separately (after unblocking): /creators/<handle> > 'Block user'.
3. Mobile as U1: ujimora://profile/<U2 id> > 'Block user'. Expect 'User blocked.' and 'Manage blocked users in Settings'.
4. As U1 and as U2: check comments, public profiles, the creator page and the leaderboard.
5. U1 Settings > Privacy > Blocked users.

**Expect:** Each is hidden from the other. U2's creator page is unavailable to U1 and each other's public profile returns 404. No moderation report is created. 'Blocked users' lists U2 with 'Unblock <name>'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoUserBlockRepository.ts`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/web/src/components/campaigns/CampaignComments.tsx`, `apps/mobile/app/profile/[id].tsx`, `apps/web/src/components/safety/BlockedUsers.tsx`

## PROFILE-054 · P0 · Submit and track data-rights requests on web and native

*Surfaces:* admin, android, ios, web  ·  *Type:* compliance

**Before:** U1 has no open requests.

**Steps:**

1. Web Settings > Privacy > 'Your data and privacy requests': set Request type to 'Access to my data', type fewer than 10 chars (button disabled), then valid details. Click 'Submit privacy request'.
2. Check the new list entry.
3. Mobile Settings: choose the 'Correct my data' radio and submit.
4. A1: admin action center and /privacy-requests > 'Data access, corrections and complaints'.

**Expect:** 'Request received. Check this section for its response.' The entry shows 'Access to my data · open', a Reference id, and a Response target of submission date + 30 days. Details are capped at 5000 chars. Both requests appear in admin sorted by due date and the action-center count increases. The account stays open.

**Needs:** None

**Source:** `apps/web/src/components/account/DataRightsRequests.tsx`, `apps/mobile/src/components/DataRightsRequests.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/admin/src/components/DataRightsQueue.tsx`

## PROFILE-056 · P0 · Data-rights requests and review evidence stay private

*Surfaces:* api  ·  *Type:* security/permission

**Before:** U1 has a request that A1 has reviewed with internal evidence.

**Steps:**

1. As U2: GET /api/v1/data-rights.
2. As U1: GET /api/v1/admin/data-rights; GET /admin/data-rights/<id>/events; PUT /admin/data-rights/<id>/review.
3. Inspect U1's GET /data-rights JSON.

**Expect:** U2 sees none of U1's requests. U1 gets 403 on admin endpoints. The requester JSON has no evidence, deliveryReference or actor ids.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`

## PROFILE-057 · P0 · Admin records progress and publishes a response; the requester downloads or shares it

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** U1 has an open Access request.

**Steps:**

1. A1 /privacy-requests: click 'Load review history' (shows the submitted event).
2. Enter internal review evidence (>= 20 chars) and click 'Save review progress'.
3. U1 clicks 'Refresh privacy requests'.
4. A1: write a response (>= 20 chars), set delivery to 'Publish in account Settings', and click 'Publish response to requester'.
5. U1 web: click 'Download request and response'. U1 mobile: tap 'Share request and response'.
6. U1 submits a new Access request.

**Expect:** Status goes open, then 'in review', then 'responded', and the item moves to the 'Responded' filter. The file is ujimora-privacy-request-<id>.json with the request and response only (no evidence). The mobile share sheet opens. A new request is allowed after the response.

**Needs:** None

**Source:** `apps/admin/src/components/DataRightsQueue.tsx`, `apps/web/src/components/account/DataRightsRequests.tsx`, `apps/mobile/src/components/DataRightsRequests.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`

## PROFILE-060 · P0 · Access, correction and complaint are fulfilled by the privacy runbook within the target

*Surfaces:* admin, email  ·  *Type:* compliance

**Before:** Privacy owner assigned. The DATA_RIGHTS.md category table is available. U1 has requests of each kind.

**Steps:**

1. Access: collect U1's account and preferences, financial activity, content, verification status and subscription records per the table.
2. Review the copy for third-party data and secrets (password hashes, tokens, other users).
3. Publish a substantive response within 30 days.
4. Correction: correct the data (e.g., country) through the authorised workflow and describe the change.
5. Complaint: record the outcome; confirm Settings shows legal@ujimora.com and the Ghana DPC link.

**Expect:** The response is a real data copy or explanation, not just an acknowledgement. It excludes secrets and others' data and is sent on time. The correction shows up in the product. The DPC link opens https://dpc.gov.gh/for-individuals/.

**Needs:** Staffed privacy owner

**Source:** `docs/compliance/DATA_RIGHTS.md`, `docs/compliance/READINESS.md`, `apps/web/src/components/account/DataRightsRequests.tsx`

## PROFILE-061 · P0 · Web account deletion: sign-out, public removal and correct data outcome

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Disposable account D with an avatar, bio, phone, confirmed newsletter, activity preferences, MFA enabled, comments, a named settled donation of GHS 40.00 to campaign X, a pending publication review, a block, a creator page and notifications. Engineer with read-only DB access.

**Steps:**

1. Web /settings > Danger zone > 'Delete account'; read the dialog; click Cancel.
2. Open it again and click 'Delete my account'.
3. Try signing in with D's credentials.
4. As a guest: /users/<D>/public, campaign X donor list and comments, /creators/<handle>.
5. A1: admin /users list, /newsletter, /privacy-requests.
6. Engineer: check the profile, MFA, notification, alert-preference, block, publication-review and push-token records, and the user document.

**Expect:** Cancel does nothing. Delete returns 200 'Account closed. Associated data deletion and retained-record review requested', signs D out and lands on the home page. Sign-in fails. The public profile returns 404. Comments are hidden. The donation shows as anonymous, and both it and the campaign total are unchanged. The creator page is gone. Admin Users excludes D and the newsletter entry is gone. Privacy requests shows D's contact email, the 'Retention / processor review required' chip and media URLs. The user document has name 'Deleted user' and email deleted-<id>@invalid.ujimora. Operational records are removed; donations and KYC are kept.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`

## PROFILE-062 · P0 · Account deletion revokes every session on every instance immediately

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Disposable account D signed in on browser A, browser B, iOS and Android. API running at least 2 instances on staging.

**Steps:**

1. Delete the account in browser A.
2. In browser B, open /settings and toggle a setting.
3. iOS/Android: pull to refresh or open Settings.
4. POST /api/v1/auth/refresh with browser B's refresh token.
5. PUT /api/v1/profile with browser B's access token.

**Expect:** All calls return 401 ('Account is no longer available' / session ended). UIs show the session-expired sign-in prompt. No write succeeds, and no profile row is recreated.

**Needs:** Multi-instance staging

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoUserRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`

## PROFILE-063 · P0 · In-app account deletion on iOS and Android meets store rules

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** TestFlight and Play internal builds. A disposable account with biometric unlock on and an active App Store/Play sandbox subscription. Do not use the reviewer demo account.

**Steps:**

1. Profile tab > settings cog > Settings > scroll to 'Danger Zone' > 'Delete Account'.
2. Read the Alert, then tap Cancel.
3. Repeat and tap Delete.
4. Force-quit and relaunch the app.
5. Check the subscription in App Store / Play subscription settings.

**Expect:** Deletion is reachable in 3 taps from Profile. The Alert says the App Store or Google Play subscription is not cancelled automatically. Cancel does nothing. Delete lands on the login screen. On relaunch there is no biometric prompt and no auto sign-in. The store subscription stays active until the user cancels it, as the Alert says.

**Needs:** App Store sandbox / Play test track

**Source:** `apps/mobile/app/settings.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## PROFILE-065 · P0 · Deleting an account that holds money: balances, payouts, in-flight donations and live campaigns

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Disposable creator D with a wallet balance of GHS 120.00, an active campaign that raised GHS 500.00, a PENDING payout of GHS 200.00, an opened but unpaid Paystack checkout on the campaign, and a paid web subscription. Paystack test keys.

**Steps:**

1. D deletes the account on web.
2. A1: admin /wallets. Check D's wallet.
3. Pay the pending Paystack checkout as the donor; let the webhook fire, then replay it.
4. As a guest, open /c/<slug> and try a new donation.
5. Drive the payout webhook to success and, in a clone scenario, to failure.
6. A1: record the retention decision in /privacy-requests.

**Expect:** The wallet still shows GHS 120.00 ('Former member'). Ledger and payout records are intact. The late donation settles exactly once, and the campaign total becomes 500 plus that amount. A failed payout restores the funds to the ledger. Nothing is forfeited, and ops has a documented path to return or disburse funds. Decide and verify the campaign state: new donations to a closed account's campaign should be blocked or paused. Source: erasure does not change campaign status, so the campaign may keep accepting funds.

**Needs:** Paystack test keys and webhooks

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminWalletRoutes.ts`, `packages/types/src/legal.ts`

## PROFILE-070 · P0 · Public account-deletion page works without signing in (Play deletion URL)

*Surfaces:* marketing, web  ·  *Type:* compliance

**Before:** Incognito browser; phone width 390px plus desktop.

**Steps:**

1. Open https://app.ujimora.com/delete-account and https://ujimora.com/delete-account.
2. Click 'Request account and data deletion by email'.
3. Click 'Open account settings on the website'.
4. Check https://ujimora.com/sitemap.xml.

**Expect:** Heading 'Delete your Ujimora account', sections 1-4 and 'Effective 12 September 2026' are shown. The mailto opens legal@ujimora.com with subject 'Ujimora account and personal-data deletion request' and a prefilled body. The settings link goes to sign-in, then /settings. No horizontal scroll. The URL is in the sitemap.

**Needs:** None

**Source:** `packages/types/src/legal.ts`, `apps/web/src/pages/LegalPage.tsx`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/marketing/public/sitemap.xml`, `apps/web/e2e/legal.spec.ts`

## PROFILE-072 · P0 · Legal hub and all nine policies render on the web app

*Surfaces:* web  ·  *Type:* compliance

**Before:** Logged out on app.ujimora.com.

**Steps:**

1. Open /legal and each of /terms, /privacy, /organizer-agreement, /contributor-terms, /refund-policy, /acceptable-use, /cookies, /billing-terms and /delete-account.
2. Use the 'On this page' links; inspect <link rel=canonical>.
3. Use the footer Legal links (Terms of Service, Privacy Notice, Payout & refund, Acceptable use, All policies).
4. Repeat at 390px width, in dark mode, and in each theme skin.

**Expect:** Each page shows its title, 'Effective <date>', 'All policies', every section and 'Need clarification?' with the contact line. The canonical URL is https://ujimora.com/<slug>. No 'Unexpected Application Error' and no horizontal scroll. Text is readable in all themes.

**Needs:** None

**Source:** `apps/web/src/pages/LegalPage.tsx`, `apps/web/src/router.tsx`, `apps/web/src/components/layout/Footer.tsx`, `packages/types/src/legal.ts`

## PROFILE-073 · P0 · Legal pages render on the marketing site

*Surfaces:* marketing  ·  *Type:* compliance

**Before:** Logged out on ujimora.com.

**Steps:**

1. Open /legal and the nine policy routes from the footer (Terms of Use, Privacy Notice, Payout & Refund, Acceptable Use, All policies) and by direct URL with a hard refresh.
2. Open an unknown path, e.g. /privacy-old.
3. Inspect the <title> and meta description on each.

**Expect:** Every policy renders and deep refresh works (Vercel rewrite). The unknown path shows the Not Found page. Titles follow '<Policy> | Ujimora' with their search descriptions.

**Needs:** None

**Source:** `apps/marketing/src/App.tsx`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/marketing/src/pages/LegalIndexPage.tsx`, `apps/marketing/src/components/Footer.tsx`, `apps/marketing/vercel.json`

## PROFILE-074 · P0 · Native legal screens work offline, through deep links and without signing in

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Release builds of the current commit.

**Steps:**

1. Signed out: Profile tab > 'Legal & trust · All policies'. Register screen: tap 'Terms of Service' and 'Privacy Policy'.
2. Signed in: Profile tab menu 'All policies', 'Terms of Use', 'Privacy Policy', and the Terms · Privacy links at the bottom.
3. Open each policy with 'Read policy →'; use the 'On this page' jumps; select text.
4. Turn on airplane mode and reopen the policies.
5. Open ujimora://delete-account. Tap the email action on a device with no mail app.

**Expect:** All nine policies render with the correct header titles ('Terms of Service', 'Privacy Policy', 'Delete account', etc.) and work offline. The deep link opens the deletion policy. With no mail app, an Alert 'Unable to open link' offers legal@ujimora.com.

**Needs:** Physical devices

**Source:** `apps/mobile/src/components/LegalScreen.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/navigation/resolvePath.ts`

## PROFILE-075 · P0 · Legal facts match across web, marketing, native builds and store listings

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Latest web and marketing deploys, and the native builds that will be submitted.

**Steps:**

1. Compare effective dates, operator (DevTrack, BN843072020, UNN House address), contact emails and minimum age 18 across all surfaces.
2. Compare the Privacy Policy URL and deletion URL in APP_REVIEW_NOTES and the store consoles.
3. Read Cookie Notice sections 3-5.
4. Find every mention of 'Neurodyne Corp Ltd' as 'parent company' (registration, website notice, privacy notice) and compare it with the operator facts.

**Expect:** Identical text everywhere; native builds were rebuilt after the last legal edit. There is no placeholder language. Source suggests failures: Cookie Notice cites a 'production cookie table' and preference controls that do not exist, and the operator/parent relationship must be confirmed by counsel (READINESS C01).

**Needs:** Legal/counsel review

**Source:** `packages/types/src/legal.ts`, `apps/web/src/components/auth/WebsiteRequestNotice.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`, `docs/compliance/READINESS.md`

## PROFILE-076 · P0 · Account agreement acceptance on web and native, and the acceptance API

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U4 lacks a current acceptance.

**Steps:**

1. Web: see the banner 'Please review the account agreement before publishing or uploading content' and click Review.
2. /account-agreement: policy cards open in new tabs; 'Save agreement' stays disabled until both boxes are checked; save.
3. Mobile: tap 'Review agreement', check both items and save.
4. API: POST /api/v1/profile/legal-acceptance with version '2020-01-01'; with acceptedTerms false; with the current version twice.
5. Logged out: open /account-agreement.

**Expect:** 'You’re up to date' / 'Your agreement has been saved.' The banners disappear and publishing is allowed. A wrong version or false flag returns 400. Repeating the same version keeps the original acceptedAt. Logged out shows 'Sign in to continue'. Policies and deletion stay reachable without accepting.

**Needs:** None

**Source:** `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/mobile/app/account-agreement.tsx`, `apps/mobile/src/components/AccountAgreementNotice.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `packages/types/src/legal-acceptance.ts`

## PROFILE-001 · P1 · Own profile loads the same saved data on web and native; private fields go only to the owner

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 signed in on web and on the iOS and Android builds.

**Steps:**

1. Web: open https://app.ujimora.com/profile and wait for the skeleton to finish.
2. Check that the header name, country, bio, avatar and cover match saved values. Open the 'Edit Profile' tab: Full Name, Phone Number and Bio are pre-filled; Country is read-only.
3. In DevTools > Network, inspect GET /api/v1/profile: check the response body and headers.
4. iOS/Android: open the Profile tab, then 'Edit profile and images'.
5. Simulate an API failure (DevTools block /api/v1/profile, or airplane mode on mobile) and reload.

**Expect:** All surfaces show the same values. /profile returns 200 with email and phone only to the owner, with Cache-Control: private, no-store. No console errors. On failure, web shows 'Your profile couldn’t load' with Retry and mobile shows 'Retry loading profile' / 'Try again'. Retry recovers.

**Needs:** None

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`

## PROFILE-003 · P1 · Phone and bio edits save immediately without publication review and never appear publicly

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 signed in.

**Steps:**

1. Web Profile > Edit Profile: change only Phone Number and Bio, then click 'Save Changes'.
2. Check the request payload in DevTools. Reload the page.
3. Settings > Privacy > Publication reviews > 'Refresh publication reviews'.
4. Mobile Edit profile: change phone and bio, then tap 'Save profile'.
5. As a guest, GET /api/v1/users/<U1 id>/public.

**Expect:** Web shows the 'Profile updated!' snackbar; mobile shows 'Your profile has been updated'. The PUT body has no name key when the name is unchanged. Values persist across reload and devices. No new publication review is created. The public profile never contains phone or bio.

**Needs:** None

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/application/use-cases/GetPublicUserProfileUseCase.ts`

## PROFILE-004 · P1 · Profile field validation rejects bad input and never partially writes

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** U1 signed in. API client with U1's token.

**Steps:**

1. PUT /api/v1/profile with each of these bodies: {bio: 1001 chars}, {phone: 31 chars}, {name:'A'}, {name: 101 chars}, {country:'G'}, {avatarUrl:'http://example.com/a.png'}, {preferredCurrency:'TOOLONG'}.
2. PUT {bio:'new bio text', phone: 31 chars}, then GET /api/v1/profile.
3. Web Profile > Edit Profile: clear Full Name and click 'Save Changes'.
4. Mobile Edit profile: clear the name field.

**Expect:** Each invalid body returns 400 'Validation failed' with field errors (avatar: 'Use an HTTPS image URL'). In step 2 the bio is unchanged, so the whole request was rejected. Web shows an error alert and does not crash. On mobile 'Save profile' is disabled while the name is blank.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`, `apps/mobile/app/profile/edit.tsx`

## PROFILE-006 · P1 · Profile impact figures are accurate, in cedi, and match My Donations

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 has settled donations of GHS 50.00 and GHS 20.50 to two campaigns and one refunded GHS 10.00 donation. If multi-currency is enabled, also one USD donation. U1 created one campaign that raised GHS 300.00.

**Steps:**

1. Web /profile: record Total Donated, Donations, Campaigns, the Leaderboard tile and the Recent Donations chips and dates.
2. Compare with /donations (My Donations) and the wallet/ledger views.
3. iOS/Android Profile tab: record Campaigns, Donated and Raised.

**Expect:** Amounts use GH₵/GHS, not '$'. Totals equal the settled donations, with refunds treated the same way as in My Donations. Different currencies are not summed under one symbol. Dates are human-readable. Mobile shows Campaigns = 1 and Raised = GH₵ 300. The leaderboard tile shows the real rank or is hidden, never '#0'. Source suggests this will fail today: web renders `$${totalDonated}`; GetProfileUseCase sums every Donation row regardless of currency or refund; mobile reads campaignsCount/totalRaised, which /profile does not return (always 0); rank is hard-coded 0; recent-donation dates are raw ISO strings.

**Needs:** Paystack test keys to create donations and a refund

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.ts`, `apps/mobile/app/(tabs)/profile.tsx`

## PROFILE-008 · P1 · Changing password from the profile keeps this session and ends other sessions

*Surfaces:* android, api, email, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 signed in on browser A and on mobile. Resend is configured.

**Steps:**

1. Web Profile > 'Change Password' tab: enter current password, a new password (>= 8 chars) and confirmation, then click 'Update Password'.
2. Right away, open /settings in browser A and toggle a setting.
3. On mobile, open Settings.
4. Negative: wrong current password; mismatched confirmation; new password under 8 chars.
5. Repeat steps 1-2 from mobile Edit profile > 'Update password'.

**Expect:** 'Password changed!' / 'Password updated' appears. The device that changed the password stays signed in. The other device gets 401 and returns to login. A password-changed email arrives. Negative cases show 'Current password is incorrect' / 'Passwords do not match' / the minimum-length message. Source suggests failure: PUT /auth/change-password rotates authVersion and returns new tokens, but ProfilePage.tsx and profile/edit.tsx discard them, so the current device is likely signed out on its next request.

**Needs:** Resend for the password-changed email

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`, `apps/api/src/domain/entities/User.ts`, `apps/web/src/lib/api.ts`

## PROFILE-009 · P1 · Switching accounts on one device never shows the previous user's settings

*Surfaces:* android, ios, web  ·  *Type:* security/permission

**Before:** U1 and U2 both have blocked users, data-rights requests and publication reviews.

**Steps:**

1. Web: sign in as U1 and open /settings and /profile. Note the toggles, blocked list, requests and reviews.
2. Sign out and sign in as U2 in the same tab, without a hard reload.
3. Mobile: repeat with Settings and Edit profile.

**Expect:** U2 sees only U2's data. Forms reset (components are keyed by user id). None of U1's names, requests or reviews appear, even briefly.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/pages/ProfilePage.tsx`, `apps/web/src/components/account/PublicationReviews.tsx`, `apps/mobile/app/profile/edit.tsx`

## PROFILE-013 · P1 · A declined identity version cannot be published

*Surfaces:* admin, web  ·  *Type:* negative/edge

**Before:** A pending account.profile review for U1.

**Steps:**

1. A2: add notes and click 'Decline this version'.
2. U1 re-saves the same name.
3. U1 checks Settings > Publication reviews.
4. U1 saves a different name.

**Expect:** Step 2 returns 422: 'This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.' The decline notes are visible to U1. A new name creates a new pending item.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## PROFILE-014 · P1 · Stale or expired approvals never authorize publication

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** U1 has an approved but unapplied name version. Staging DB access for step 3.

**Steps:**

1. Before resubmitting, change another identity input: turn 'Allow profile to be public' off and on again (web), or change Country on mobile.
2. Resubmit the approved name.
3. Staging: set approvalExpiresAt in the past on another approved review, then resubmit that version.

**Expect:** Step 2 creates a new pending review or returns 409 'Your account identity changed during review. Reload and retry.' Step 3 returns 409 'This safety approval expired…'. Nothing publishes silently.

**Needs:** Staging DB write access for expiry

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## PROFILE-015 · P1 · Optional OpenAI screening: clean text auto-approves; flagged or unavailable goes to staff

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** OPENAI_API_KEY configured. U1 has no avatar or cover. A second staging environment without OPENAI_API_KEY.

**Steps:**

1. Check 'Use OpenAI to check this public text for safety (optional)', change the name to a benign value, and save.
2. With the box checked again, try a name containing an abusive or hateful term.
3. On staging without OPENAI_API_KEY, repeat step 1.
4. Admin Publication reviews: check the approved and pending lists, the reviewer and the reason. Read each item's text.

**Expect:** Step 1 saves immediately (approved by automated:openai, 7-day expiry). Step 2 is held pending with reason 'flagged'. Step 3 is held pending with reason 'unavailable'. Phone and bio never appear in the review text. The consent box is unchecked by default on each visit.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/safety/PublicationConsent.tsx`, `apps/api/src/app.ts`

## PROFILE-018 · P1 · Concurrent identity edits from two devices never overwrite silently

*Surfaces:* android, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 has web Profile open (not reloaded) and mobile Edit profile open. OpenAI configured.

**Steps:**

1. Mobile: change the name (OpenAI consent) and save successfully.
2. Web, without reloading: save a different name.
3. Web: save a phone change only.
4. Mobile: change the password, then web: save the bio.

**Expect:** Step 2 creates a new review or returns 409 'Your account identity changed during review. Reload and retry.' and does not revert the mobile name. Step 3 changes only the phone. Step 4 returns 401 'Your session ended. Sign in again before saving.'

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`

## PROFILE-020 · P1 · Publication review decision races, replays and input rules

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A pending review. A1 and A2 each have the queue open in their own browser.

**Steps:**

1. A1 approves with >= 20-char notes.
2. A2 clicks 'Decline this version' without refreshing.
3. A1 replays the identical approve PUT (same notes).
4. Enter 19-char notes.
5. PUT /admin/publication-reviews/<id>/review with decision 'maybe'.

**Expect:** Step 2 returns 409 'A final decision already exists for this version'. Step 3 returns 200 with no duplicate audit entry. With 19 chars the buttons are disabled and the API returns 400 'Choose a decision and enter at least 20 characters of review notes'. Step 5 returns 400.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## PROFILE-022 · P1 · Web avatar upload is held for review and can be completed after approval

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Cloudinary configured. U1 has accepted the agreement.

**Steps:**

1. Profile > 'Change profile image'. Upload a 1 MB square JPG and watch the progress bar.
2. Click 'Save image'.
3. Keep the dialog open. A2 opens the media URL in admin Publication reviews and approves.
4. Click 'Save image' again.
5. Repeat, but close the dialog before approval and reopen it after approval.

**Expect:** The upload hits /api/v1/uploads/image?folder=profiles and returns a Cloudinary https URL. The first save is held (error plus review list). After approval, the save succeeds and the avatar appears in the header and on the mobile Profile tab. In step 5 the user should still be able to publish the approved image. Source suggests this fails: the dialog reopens with the old URL, and re-uploading creates a new URL and a new review.

**Needs:** Cloudinary

**Source:** `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## PROFILE-023 · P1 · Image upload validation, outages and external URLs

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** U1 signed in. A staging environment without Cloudinary vars.

**Steps:**

1. Select a 5 MB image in the editor.
2. Select a GIF, then a HEIC, on web.
3. API: POST /uploads/image?folder=profiles with Content-Type application/pdf; with a 6 MB body; with text/plain.
4. On staging without Cloudinary, upload.
5. Go offline mid-upload.
6. PUT /api/v1/profile {avatarUrl:'https://example.com/pixel.png'}.

**Expect:** Step 1 shows a client size error; the server returns 413 'File is too large (max 4MB).' above 5 MB. Step 2 shows 'Choose a JPG, PNG or WebP image.' Step 3: text/plain returns 415. The PDF is accepted into the profiles folder, which is a gap to fix. Step 4 returns 503 'Image uploads are not configured on the server.' Step 5 shows an error, 'Save image' stays disabled while uploading, and no half-saved avatar remains. Step 6: the non-Cloudinary URL goes to staff review, and staff must reject external hotlinks.

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`

## PROFILE-024 · P1 · Removing a profile photo takes effect without review

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** U1 has an approved avatar and cover.

**Steps:**

1. Web: 'Change profile image' > 'Use default image' > 'Save image'.
2. Mobile Edit profile: clear the cover and tap 'Save profile'.
3. As a guest, GET /users/<U1>/public.

**Expect:** Removal is immediate and the public avatar disappears. Source suggests this fails: clearing a URL counts as a public change, so it goes to staff review (the web editor never sends consent). Decide and fix before launch, since users expect personal images to come down instantly.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`

## PROFILE-026 · P1 · Native pick, crop and upload of cover and photo on iOS and Android

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** TestFlight and Android internal builds. Cloudinary. Photo-library permission not yet granted.

**Steps:**

1. Profile tab > 'Edit images'.
2. Cover image: deny the photo permission prompt, then allow it in OS Settings and retry. Pick a photo and crop 16:9.
3. Profile photo: pick and crop square.
4. While uploads run, try 'Save profile'.
5. Save after the uploads finish; after staff approval, save the same selection again.

**Expect:** The permission prompt appears only on tap, and denial shows a helpful message. 'Save profile' is disabled while uploads run. The first save is held with the Publication reviews list shown. After approval the images publish. Files over 4 MB are rejected.

**Needs:** Cloudinary; physical devices

**Source:** `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `docs/compliance/NATIVE_PERMISSIONS.md`

## PROFILE-029 · P1 · Making a private profile public goes through review

*Surfaces:* admin, web  ·  *Type:* compliance

**Before:** U1 profile private. No avatar or cover for step 5.

**Steps:**

1. Turn on 'Allow profile to be public' with the OpenAI box unchecked.
2. Watch the switch and the alert.
3. A2 approves the pending item.
4. Turn the switch on again.
5. Repeat from private with the OpenAI consent box checked.

**Expect:** Step 1 shows an error alert ending '…Check Publication reviews above, then enable the switch again after approval.' and the switch reverts to off. Step 4 saves. Step 5 auto-approves if the text is clean.

**Needs:** OpenAI for step 5

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`

## PROFILE-031 · P1 · Leaderboard opt-out removes the user from list, featured donors and totals

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U1 appears on /leaderboard through named GHS donations to an active campaign.

**Steps:**

1. Web Settings: turn off 'Show me on leaderboards'.
2. As a guest, U2 and U1: open /leaderboard for each period and category (all, individual), featured donors and stats. Wait up to 30 s for polling.
3. Mobile Settings: toggle 'Show on Leaderboard' and open the mobile Leaderboard screen.
4. Turn the setting back on.

**Expect:** U1 disappears from the list, featured donors and donor count. Totals exclude U1's amounts. Campaign balances do not change. Turning it back on restores U1. The setting stays in sync between web and mobile after reload.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`, `docs/compliance/LEADERBOARD_PRIVACY.md`

## PROFILE-032 · P1 · Leaderboard totals exclude anonymous and non-GHS gifts

*Surfaces:* api, web  ·  *Type:* functional

**Before:** U2 is a fresh donor. Campaign X is active.

**Steps:**

1. U2 donates GHS 70.00 named and GHS 30.00 anonymous via Paystack test.
2. If Flutterwave multi-currency is enabled, U2 donates USD 10 named.
3. Open /leaderboard and the stats; open campaign X.

**Expect:** U2 shows GH₵ 70.00 with 1 donation and 1 campaign. The anonymous and USD gifts are excluded. Campaign X shows all settled funds under its own currency rules. The board says it covers GHS only.

**Needs:** Paystack; Flutterwave optional

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`

## PROFILE-034 · P1 · Settings toggles save per field and roll back on failure

*Surfaces:* android, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 on the Settings page.

**Steps:**

1. Web: quickly toggle anonymous on, leaderboard off, dark mode on.
2. In DevTools, set the network offline for the next PUT /api/v1/profile and toggle leaderboard on.
3. Reload.
4. Mobile: turn on airplane mode and toggle 'Anonymous Donations'.

**Expect:** Each PUT carries only the changed field. The failed toggle reverts to its last confirmed value with an error snackbar or banner, while other changes persist after reload. The 'Saving…' pill clears. Mobile shows an error banner and reverts.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`, `docs/compliance/ACCOUNT_PROFILE_WRITES.md`

## PROFILE-036 · P1 · Activity alerts start off; an in-app donation alert arrives exactly once

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** C1 (verified email, fresh alert preferences) owns an active campaign. Paystack test keys.

**Steps:**

1. C1 Settings > Notifications: confirm all 14 switches (7 categories x In-app alert/Email) are off.
2. U2 donates GHS 10.00 to C1's campaign (before any opt-in).
3. C1: turn on 'Donations received' > In-app alert.
4. U2 donates GHS 25.00 anonymously via Paystack test.
5. Within 60 s, open C1's notification bell (web header and mobile). Replay the Paystack webhook from the dashboard and wait another 60 s.

**Expect:** There is exactly one inbox item: 'Your campaign received a donation' / 'A supporter donated GHS 25.00 to “<title>”.', linking to /campaigns/<id>. The donor is not named. The GHS 10 donation from before opt-in produced no alert. The webhook replay adds no duplicate.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `packages/types/src/activity-alerts.ts`

## PROFILE-037 · P1 · Activity emails need a verified email address; the verification link flow works

*Surfaces:* android, api, email, ios, web  ·  *Type:* negative/edge

**Before:** U3 has an unverified email. Resend and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 are configured.

**Steps:**

1. U3 Settings > Notifications: note the info alert and the Email switch states.
2. PUT /api/v1/profile/activity-alerts {category:'wallet',channel:'email',enabled:true}.
3. Click 'Send verification link', then click it again within 1 minute.
4. Open the emailed link, confirm on /verify-email, return and click 'Check verification status'.
5. Turn on the Wallet email. Separately: request a link, change the password, then open that older link.

**Expect:** The alert reads 'Verify your email address to enable activity emails. In-app alerts are available now.' and the Email switches are disabled. Step 2 returns 409 'Verify your email address before enabling activity emails.' The email arrives; the rapid repeat is throttled or rate-limited. After verification the switches are enabled. A link issued before the password change is rejected ('This verification link is invalid, expired or already used…').

**Needs:** Resend email provider

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.ts`, `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/mobile/src/components/ActivityAlertSettings.tsx`

## PROFILE-038 · P1 · Activity emails carry the correct amounts and states, sent once each

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** C1 is verified and opted in to emails for Donations received, Withdrawals and payouts, and Wallet. Resend. Paystack test transfers enabled.

**Steps:**

1. U2 donates GHS 100.00 to C1's campaign.
2. C1 requests a payout of GHS 50.00; an admin approves it; the Paystack test transfer completes.
3. C1 tops up the wallet with GHS 20.00 (web or Android).
4. Inspect every email, then replay each Paystack webhook once.

**Expect:** Subjects match the inbox titles. Bodies show 'GHS 100.00', 'GHS 50.00' and 'GHS 20.00' (2 decimal places, correct currency). Payout emails follow requested/processing/completed, and 'completed' arrives only after settlement. The footer has the settings link https://app.ujimora.com/settings and the support address. Each state sends exactly one email, including after webhook replays.

**Needs:** Resend; Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/database/plugins/trackActivity.ts`, `docs/compliance/ACTIVITY_ALERTS.md`

## PROFILE-039 · P1 · Turning an alert off stops queued deliveries

*Surfaces:* api, email, web  ·  *Type:* recovery/idempotency

**Before:** U1 has Refund updates on for In-app and Email. An admin can process refunds.

**Steps:**

1. Admin processes a refund status change for U1's donation.
2. Within about 20 s, U1 turns both Refund switches off.
3. Wait 2 minutes; check the inbox and email.
4. Trigger another refund state change.

**Expect:** No email or inbox item for either change (the queued delivery is suppressed). Earlier alerts remain in the inbox.

**Needs:** Resend; Paystack refund test

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`

## PROFILE-043 · P1 · Newsletter confirmation links cannot be misused

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** A pending newsletter request with its email.

**Steps:**

1. Open a confirm link older than 30 minutes and click Confirm.
2. Reuse a link that was already confirmed.
3. Reload the confirm page after it has loaded.
4. Open a link with a truncated token.
5. POST /api/v1/newsletter/confirm {token:'abc'}; and a valid-format token with an extra field.

**Expect:** Steps 1-2 show 'This link could not be used. Reopen the complete email link, use your newsletter controls in Settings, or contact support@ujimora.com.' Steps 3-4 show the warning 'Open the complete link from your email…'. Step 5 returns 400. No state changes.

**Needs:** Resend

**Source:** `apps/web/src/pages/NewsletterConsentPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.ts`, `apps/api/src/application/services/NewsletterConsentService.ts`

## PROFILE-045 · P1 · Newsletter withdrawal from Settings, resend cooldown and outage handling

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** U1 has a pending request. A staging environment without AUTH_EMAIL_ENCRYPTION_KEY_BASE64.

**Steps:**

1. Settings: switch the newsletter off, then open the earlier confirm link.
2. Switch on, then click 'Resend newsletter confirmation' twice within 60 s.
3. On staging without the encryption key, switch on.
4. Repeat steps 1-2 in iOS and Android Settings.

**Expect:** Step 1 shows 'Newsletter emails are off.' and the old confirm link fails. Step 2 produces only one extra email within the cooldown. Step 3 shows 'Newsletter confirmation is temporarily unavailable. Please try again later.' and the switch stays Off. Native behaves the same.

**Needs:** Resend

**Source:** `apps/web/src/components/account/NewsletterSettings.tsx`, `apps/mobile/src/components/NewsletterSettings.tsx`, `apps/api/src/application/services/NewsletterConsentService.ts`

## PROFILE-046 · P1 · Marketing and blog newsletter signup shares the account's consent record

*Surfaces:* api, email, marketing, web  ·  *Type:* cross-platform

**Before:** U1 unsubscribed.

**Steps:**

1. ujimora.com footer: enter U1's email in mixed case with spaces. Confirm Subscribe is disabled until 'Email me Ujimora stories and promotional updates.' is checked, then submit.
2. Open U1's web Settings newsletter section.
3. ujimora.com/blog: sign up an email with no account, then confirm it.
4. Submit the signup 21 times within 15 minutes.

**Expect:** Step 1 shows 'Check your email to confirm your request…'. U1's Settings shows 'Requested — awaiting email confirmation', so the address was normalised to the same record. The non-account email appears in admin only after confirmation. Step 4 returns 429 'Too many attempts…'.

**Needs:** Resend

**Source:** `apps/marketing/src/components/NewsletterSignup.tsx`, `apps/marketing/src/components/Footer.tsx`, `apps/api/src/application/use-cases/SubscribeNewsletterUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## PROFILE-047 · P1 · Admin newsletter list shows confirmed consent only and is admin-only

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Subscribers exist in each state: pending, active and withdrawn.

**Steps:**

1. A1: admin /newsletter; search; export.
2. As U1: GET /api/v1/newsletter/subscribers.

**Expect:** Only active, confirmed records appear. Pending, withdrawn and legacy records are excluded. The export matches the list. U1 gets 403.

**Needs:** None

**Source:** `apps/admin/src/pages/NewsletterPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoNewsletterSubscriptionRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.ts`

## PROFILE-048 · P1 · Organization website-contact request can be withdrawn on web and native

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** ORG1 registered with the website request checked. U1 is an individual account.

**Steps:**

1. ORG1 signs in on web. Check the 'Your website request is saved' banner (Neurodyne Corp Ltd, neurodyne.dev, info@neurodyne.dev links).
2. Click 'Withdraw website request'.
3. Reload; open the mobile app as ORG1.
4. A1: admin /users/<ORG1 id>.
5. POST /api/v1/profile/website-request/withdraw again; GET /profile/website-request.
6. As U1: GET /profile/website-request.

**Expect:** Step 2 shows 'Your website-contact request has been withdrawn…'. The banner is gone on web and mobile. Admin shows 'Website request: Not requested'. The repeat POST returns 200 with the original withdrawnAt. U1 gets 404 'Organization account not found'. The Privacy Notice section 'Optional organization website requests' matches this behaviour.

**Needs:** None

**Source:** `apps/web/src/components/auth/WebsiteRequestNotice.tsx`, `apps/mobile/src/components/WebsiteRequestNotice.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/admin/src/pages/UserDetailPage.tsx`, `packages/types/src/legal.ts`

## PROFILE-050 · P1 · Block API rejects invalid targets and is idempotent

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** U1 signed in.

**Steps:**

1. PUT /api/v1/safety/blocks/<U1 own id>.
2. PUT /safety/blocks/xyz.
3. PUT /safety/blocks/<unused 24-hex id>.
4. Double-tap 'Block user', or send the PUT twice.
5. Call PUT without a token.
6. View your own profile, and a creator page as a guest.

**Expect:** 400 'Choose another user to block'; 400; 404 'User not found'; a single block entry; 401. The Block control is hidden on your own profile and for guests.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/web/src/components/safety/UserSafetyControls.tsx`

## PROFILE-051 · P1 · Unblocking restores visibility; mutual blocks stay in force

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 has blocked U2.

**Steps:**

1. U1 Settings: click 'Unblock <U2>'. Refresh the comments and profile.
2. U1 and U2 each block the other; U1 unblocks.
3. Send DELETE /safety/blocks/<U2> twice.

**Expect:** The entry disappears and content is visible again. With a mutual block, U2's block still hides both until U2 unblocks. The repeated DELETE returns 200 'User unblocked'.

**Needs:** None

**Source:** `apps/web/src/components/safety/BlockedUsers.tsx`, `apps/mobile/src/components/BlockedUsers.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoUserBlockRepository.ts`

## PROFILE-052 · P1 · Blocking during a live session disconnects the blocked viewer

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** LIVEKIT_* configured. C1 is live on a campaign. U2 is watching web /live/<sessionId> or the mobile live screen.

**Steps:**

1. C1 blocks U2 using the live page's safety controls.
2. Watch U2's player and chat.
3. U2 tries to rejoin.

**Expect:** The response message is 'User blocked' (or 'User blocked. Live connection cleanup will retry.'). U2 is disconnected and cannot get a new viewer token. Chat and overlay hide each other.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/live/[sessionId].tsx`

## PROFILE-055 · P1 · One open request per type, strict validation and rate limits

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** U1 has an open Access request.

**Steps:**

1. Submit another 'Access to my data' request.
2. Submit 'Privacy complaint' from two tabs at the same moment.
3. POST /api/v1/data-rights with 9-char details; with an extra userId:'<U2 id>'; with kind 'erasure'.
4. Send 21 POSTs within 15 minutes.

**Expect:** Step 1 returns 409 'You already have an open request of this type. Follow its progress below or contact legal@ujimora.com.' Step 2 creates exactly one complaint. Step 3 returns 400. Step 4 returns 429.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/database/models/DataRightsRequestModel.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## PROFILE-058 · P1 · Admin data-rights review conflicts and current-admin enforcement

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A1 and A2 both have the same request open.

**Steps:**

1. A1 saves progress; A2 saves from the stale form.
2. Demote A2 (or rotate A2's password) while the page is open; A2 saves.
3. Try evidence of 19 chars; 'responded' with a response under 20 chars; 'verified_external' without a reference of >= 20 chars.
4. PUT /admin/data-rights/abc/review.

**Expect:** Step 1 returns 409 'Request changed or was already answered. Refresh before reviewing.' Step 2 returns 403 'Current administrator access is required to review this request.' (or 401). Step 3: buttons are disabled and the API returns 400 with field messages. Step 4 returns 400 'Invalid request ID'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/admin/src/components/DataRightsQueue.tsx`

## PROFILE-059 · P1 · A data-rights request survives account closure; admin records verified external delivery

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** A disposable account D has an open Access request.

**Steps:**

1. D deletes its account.
2. A1 clicks 'Publish response to requester'.
3. A1 selects 'Record verified external delivery already completed', enters a response and a reference of >= 20 chars, and saves.
4. Click 'Load review history'.
5. Separately: submit a data-rights request at the same moment as a deletion.

**Expect:** Step 2 returns 409 'This account is closed. Record review progress and arrange verified communication through the privacy team.' Step 3 succeeds and the history shows the delivery evidence. The request is not lost. The concurrent submission either succeeds before closure or returns 404 'Account not found'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `docs/compliance/DATA_RIGHTS.md`

## PROFILE-064 · P1 · Account deletion under double-submit and network failure

*Surfaces:* android, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Disposable accounts.

**Steps:**

1. Web: double-click 'Delete my account' quickly.
2. Web: click Delete, then switch DevTools offline before the response arrives.
3. Mobile: turn on airplane mode and tap Delete in the Alert.
4. Restore the network and retry.

**Expect:** One closure only, and no error toast after the redirect. Note: the web Delete button is not disabled while the request runs. Offline shows the error snackbar / 'Could not delete account' Alert. A retry either succeeds or finds the account already closed and ends signed out with a clear message. There is never an account that still signs in after a closure was recorded.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`

## PROFILE-066 · P1 · Deletion side effects on live sessions, teams, collaborations and subscriptions

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Disposable C1-like account with an active live session that has viewers, organization team membership, a collaborator role on another campaign, and a Paystack subscription. LiveKit configured.

**Steps:**

1. Delete the account.
2. Viewers: watch the live page.
3. Open the organization team page and the other campaign's collaborators.
4. Admin: check the subscriptions list.

**Expect:** The live session ends for viewers (overlay invalid, privacy mode). The team membership is revoked. The collaborator shows 'Deleted user'. The subscription is marked cancel-at-period-end and does not renew.

**Needs:** LiveKit; Paystack

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`

## PROFILE-067 · P1 · Admin deletion/retention queue: review, conflicts, retry and export

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** At least one closed account. A1 and A2.

**Steps:**

1. A1 /privacy-requests: check the item chip and the 'Operational profile data removed…' text.
2. Try notes under 20 chars (button disabled); a past review date; then valid notes and a future date. Click 'Save review and follow-up date'.
3. A2 saves from a stale form.
4. Click 'Retry pending cleanup' twice.
5. Export 'Account deletion and retention'.
6. As U1: PUT /api/v1/admin/privacy-requests/<id>/review.

**Expect:** A past date returns 400 'Set a future review date'. A valid save succeeds and writes audit 'privacy.retention_review'. A2's stale save returns 409 'Request changed or is unavailable. Refresh before reviewing.' Retry reports a processed count and is idempotent. The export has rows. U1 gets 403. The action center counts pending or overdue reviews.

**Needs:** None

**Source:** `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/privacyRequestRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## PROFILE-068 · P1 · Cleanup failure still closes the account and recovers on retry

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging. An engineer can induce a failure during cleanup (e.g., a temporary permission error on one collection).

**Steps:**

1. Delete the account while the fault is active.
2. Try to sign in.
3. Admin: check the chip reads 'Cleanup pending'.
4. Remove the fault and click 'Retry pending cleanup'; click it again.

**Expect:** The account closes immediately and sign-in fails despite the cleanup error. After retry the status becomes review_required. A second retry is a no-op.

**Needs:** Staging fault injection

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`

## PROFILE-071 · P1 · Email-based deletion requests can be fulfilled by operations

*Surfaces:* admin, email  ·  *Type:* compliance

**Before:** Access to legal@ujimora.com. A disposable account that cannot sign in.

**Steps:**

1. Send the prefilled deletion email from the account's registered address.
2. Follow the ops runbook: verify identity, close the account, confirm to the user and record retention decisions.

**Expect:** The mailbox is monitored, identity is verified, and the account is closed and confirmed within the stated timing. Source: there is no admin endpoint to close another user's account, so ops needs a documented, tested path before launch.

**Needs:** Staffed legal@ mailbox

**Source:** `packages/types/src/legal.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminUserRoutes.ts`, `docs/compliance/READINESS.md`

## PROFILE-077 · P1 · A legal version bump asks existing users to accept again

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Staging build with a bumped LEGAL_ACCEPTANCE_VERSION.

**Steps:**

1. Existing users sign in on web and mobile.
2. Try a name change and a comment.
3. Donate without a message; change settings; submit a data-rights request; open the Delete account dialog.

**Expect:** The banners return. Publishing returns 428 until the user accepts again. Actions that do not publish are unaffected.

**Needs:** Staging build

**Source:** `packages/types/src/legal-acceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`

## PROFILE-078 · P1 · Private account endpoints are never cached

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** U1 signed in on app.ujimora.com, where /api/v1 is proxied by a Vercel rewrite.

**Steps:**

1. Inspect response headers for /profile, /profile/activity-alerts, /data-rights, /safety/blocks, /newsletter/preference, /publication-reviews and /users/:id/public.
2. Sign out and press Back to /settings.
3. Sign in as U2 and reload the same URLs.

**Expect:** Every response has Cache-Control 'private, no-store'. No edge or browser cache serves U1's JSON to U2. Pressing Back after sign-out shows the sign-in prompt, not U1's data.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/web/vercel.json`

## PROFILE-007 · P2 · Placeholder profile widgets are honest and the shared link works

*Surfaces:* web  ·  *Type:* functional

**Before:** U1 signed in.

**Steps:**

1. On /profile, toggle several Interested Categories chips, then reload.
2. Look at the Followers/Following/Bookmarks counts and Achievement Badges.
3. Click 'Copy profile link' and paste the URL into an incognito window.

**Expect:** Category choices persist, or the UI makes clear they are not saved. The page shows no fake zero social stats. The copied link opens a public profile. Source suggests failure: interests are never sent to the API, the counts are hard-coded 0, and the link copies the private /profile URL (incognito shows a sign-in prompt). Needs a product decision before launch.

**Needs:** None

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`

## PROFILE-010 · P2 · Organization account profile labels and org identity editing

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** ORG1 signed in.

**Steps:**

1. Web /profile: check the header and the edit form.
2. Mobile Edit profile: find the Organization identity editor section.
3. Change the contact person's name and save.

**Expect:** The header shows the organization name and 'Managed by <contact>'. The name field is labelled 'Contact person'. Org identity edits go through organization publication review. The contact name follows the account identity review.

**Needs:** None

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/src/components/OrganizationIdentityEditor.tsx`, `apps/mobile/app/profile/edit.tsx`

## PROFILE-016 · P2 · With an existing avatar, any identity change needs staff review

*Surfaces:* admin, web  ·  *Type:* negative/edge

**Before:** U1 has an approved avatar. OPENAI_API_KEY configured.

**Steps:**

1. Check the OpenAI consent box, change only the name, and save.
2. Admin: check the item's reason and media list.

**Expect:** The change is held with reason 'media' and the current avatar URL listed, because avatar/cover URLs are always sent as media. Product must confirm this is acceptable, since users with a photo can never use automated screening.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## PROFILE-025 · P2 · Cover image renders and broken images fall back

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** U1 has an approved cover that currently resolves.

**Steps:**

1. Web: 'Change cover' with a 16:9 JPG; get it approved and save.
2. Staging: point coverUrl at an https URL that 404s (approved via review).
3. Open web /profile and the mobile Profile tab.

**Expect:** The landscape cover shows correctly. When the image fails, web shows the Ujimora artwork fallback and mobile shows the logo artwork. No broken-image icon and no layout shift.

**Needs:** Cloudinary

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/app/(tabs)/profile.tsx`

## PROFILE-030 · P2 · Native users can control profile visibility

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** U1 on the mobile builds.

**Steps:**

1. Open Settings > Privacy and look for a public-profile switch.
2. Search the Profile and Edit profile screens.

**Expect:** Native users can hide or show their profile, or are clearly pointed to the web. Source suggests this fails: mobile Settings has only 'Anonymous Donations' and 'Show on Leaderboard'.

**Needs:** None

**Source:** `apps/mobile/app/settings.tsx`

## PROFILE-035 · P2 · Language, appearance and currency preferences

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** U1 on web and mobile.

**Steps:**

1. Web Preferences: set Language to Twi, reload, then open mobile Settings.
2. Web: pick Dagbani, then check the mobile Language picker.
3. Web: turn Dark mode on, then sign in with another browser.
4. Mobile: switch Appearance Light/Dark/System and Design finish; restart the app.
5. Check the Currency display on both.

**Expect:** Language persists across devices, and Dagbani displays sensibly on mobile (mobile options lack Dagbani). Either the UI language changes, or the setting is clearly marked as a future preference; source has no i18n. Web dark mode follows the account across browsers. Mobile appearance persists locally. Currency is fixed at GH₵ / GHS.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`

## PROFILE-040 · P2 · Email-provider outage: choices save and queued alerts recover

*Surfaces:* android, email, ios, web  ·  *Type:* recovery/idempotency

**Before:** Staging with RESEND_API_KEY unset.

**Steps:**

1. Open Settings > Notifications.
2. Toggle several email choices and trigger a qualifying event.
3. Configure RESEND_API_KEY and restart the API; wait up to 2 minutes.

**Expect:** A banner reads 'Email delivery is temporarily unavailable. You can still save your choices.' and choices save. After configuration the pending email is sent once. Ops can see deliveries moved to 'review' after 23 h.

**Needs:** Resend

**Source:** `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## PROFILE-041 · P2 · Activity-alert API validation, isolation and cross-device sync

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** U1 and U2.

**Steps:**

1. U1 web: turn on the 'Subscription updates' in-app alert. Open mobile Settings.
2. PUT /profile/activity-alerts with category 'marketing'; channel 'push'; an extra field.
3. U2 GET /profile/activity-alerts.

**Expect:** Mobile reflects the web choice. Invalid bodies return 400 (strict schema). U2 sees only U2's own preferences.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/activityAlertRoutes.ts`

## PROFILE-053 · P2 · Blocked list after the blocked user closes their account

*Surfaces:* android, ios, web  ·  *Type:* negative/edge

**Before:** U1 has blocked a disposable user D.

**Steps:**

1. D deletes their account.
2. U1 opens Settings > Blocked users.

**Expect:** D is gone from the list (erasure deletes block rows in both directions), or shows 'Former member' while cleanup is pending. No errors.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`

## PROFILE-069 · P2 · Registering again with a deleted account's email

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** PROFILE-061 completed.

**Steps:**

1. Register a new account with D's old email on web, and again on mobile with another deleted email.
2. Check the new account's donations, settings, blocks and newsletter status.

**Expect:** A fresh, empty account is created with no link to the old data. If cleanup is still pending (email not yet scrubbed), registration is refused with a clear message; confirm this is the intended behaviour.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`

## PROFILE-079 · P2 · Admin console Profile page for staff

*Surfaces:* admin  ·  *Type:* functional

**Before:** A1 signed in to the admin console.

**Steps:**

1. Open /profile. Change the name and country, with and without 'Use OpenAI to check this public identity (optional)'.
2. Save the preferences (email, push, language).
3. Change the password.

**Expect:** Identity changes are held, with a link to the review queue in a new tab, and are approvable only by another admin. Preferences save, and the push option does not suggest push delivery exists (push is disabled). The password change works and the session is handled correctly.

**Needs:** OpenAI optional

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`

## PROFILE-080 · P2 · Platform analytics requested by the profile page are visible to ordinary users

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** U1 signed in.

**Steps:**

1. Open /profile and watch GET /api/v1/analytics/overview.
2. As U1, call GET /api/v1/analytics/overview directly.

**Expect:** Product confirms that any member may see platform-wide totalUsers, pendingDisputes and conversionRate; if not, restrict the endpoint and remove the call from ProfilePage.

**Needs:** None

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/analyticsRoutes.ts`, `apps/api/src/domain/ports/outbound/AnalyticsRepositoryPort.ts`

## PROFILE-081 · P2 · Closed accounts in the admin console

*Surfaces:* admin  ·  *Type:* functional

**Before:** A closed account from PROFILE-061.

**Steps:**

1. A1: search admin /users for the closed account.
2. Open /users/<closed id> directly.
3. Find it in /privacy-requests and /wallets.

**Expect:** Admin Users excludes the closed account, and the direct link is handled gracefully. Privacy requests and wallets still show the retained records ('Former member').

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAdminUserRepository.ts`, `apps/admin/src/pages/UsersPage.tsx`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`

## PROFILE-082 · P2 · Accessibility of settings, privacy and deletion controls

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** VoiceOver (iOS), TalkBack (Android), and a desktop browser used keyboard-only.

**Steps:**

1. Web: tab through Settings; check the switch names, the Delete dialog focus trap and the snackbars.
2. Mobile: use a screen reader on the Activity alert switches, newsletter switch, privacy toggles, Blocked users and Delete Account.
3. Check touch targets and contrast in dark mode.

**Expect:** Switches announce clear names (e.g., 'Marketing emails and newsletter', '<Category> emails'). Focus is visible and dialogs trap focus. Targets are at least 44 px. Text contrast meets AA in both themes.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/NewsletterSettings.tsx`
