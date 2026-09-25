# Profile, settings & privacy (95 cases)

Profile edits and publication review, privacy switches, alerts and newsletter consent, blocked users, data-rights requests, account deletion, legal pages.

[Back to the QA plan](../README.md)

## PROFILE-002 · P0 · Signed-out users cannot read or change profile, settings or privacy data, and signing in returns to the requested screen

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Logged out. U1's user id is known.

**Steps:**

1. Web: open /profile and /settings; a sign-in panel appears. Sign in as U1; you return to the page you requested.
2. Mobile signed out: the Profile tab shows the sign-in-required view plus 'Legal & trust · All policies'. Open ujimora://settings: the sign-in-required view appears. Tap its sign-in button and sign in as U1.
3. API with no Authorization header: GET, PUT and DELETE /api/v1/profile; GET /api/v1/profile/closure-check; GET /api/v1/profile/legal-acceptance; GET /api/v1/data-rights; GET /api/v1/safety/blocks; GET /api/v1/profile/activity-alerts; GET /api/v1/newsletter/preference; GET /api/v1/publication-reviews.
4. Repeat step 3 with a garbage bearer token and with an expired token.

**Expect:** Every API call returns 401 ('Authentication required' / 'Invalid or expired token') and nothing changes. After sign-in from the mobile gate, the app goes back to Settings, not the Home tab. The gate passes an in-app returnTo and ignores external or auth-screen targets. The UI never shows cached data from a previous user.

**Needs:** None

**Source:** `apps/web/src/components/auth/RequireAuth.tsx`, `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/SignInRequired.tsx`, `apps/mobile/src/navigation/returnTo.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`

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

## PROFILE-017 · P0 · Publishing restrictions and a missing legal acceptance block identity publishing, not private settings or photo removal

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A1 has applied a publishing restriction to U2 (admin Safety reports; U2 appears under 'Restricted users'). U2 and U4 each have an avatar and a cover. U4 has no current legal acceptance.

**Steps:**

1. U2: change the name on Profile, then try to upload a new avatar.
2. U2: change phone/bio, turn off 'Allow profile to be public', open Data rights, open the Delete account dialog (cancel), and view the wallet.
3. U2: 'Change profile image' > 'Use default image' > 'Save image'.
4. U4: change the name; upload a new avatar.
5. U4: change phone/bio; hide the profile; remove the cover image (mobile trash icon, then 'Save profile').

**Expect:** U2's name change and upload return 403 'Publishing is restricted following a moderation review. Contact support@ujimora.com to appeal. Your account settings and funds remain accessible.' U4's name change and upload return 428 'Review the current account agreement and confirm you are at least 18 before publishing or uploading content'. Removing an avatar or cover succeeds immediately for both users, because a withdrawal publishes nothing. Private settings, funds, data rights and deletion all stay available.

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

## PROFILE-021 · P0 · Publication review lists are per-user; admin review endpoints and the console need the admin role

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** U1 and U2 each have reviews.

**Steps:**

1. As U2: GET /api/v1/publication-reviews and ?status=approved.
2. As U1: GET /api/v1/admin/publication-reviews; PUT /api/v1/admin/publication-reviews/<id>/review.
3. As U1: sign in to admin.ujimora.com with correct credentials, then open /publication-reviews.
4. A1: check the audit log for the refused console sign-in.

**Expect:** U2 sees only U2's items, without actorId or reviewedBy. U1 gets 403 'Insufficient permissions' on the admin endpoints. Console sign-in as U1 is refused after the password check with 'This account does not have staff access.' No session is stored, /publication-reviews shows the console sign-in screen, and an 'auth.admin_console.refused' audit entry is written.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/admin/src/router.tsx`

## PROFILE-027 · P0 · Public member profile exposes only public fields and never reveals staff role

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** U1 is public. A1 is an admin.

**Steps:**

1. As a guest: GET /api/v1/users/<U1 id>/public. Check the body and headers.
2. GET /users/abc/public and /users/<random 24-hex>/public.
3. Mobile: open ujimora://profile/<U1 id> signed out, then signed in as U2. Check the Details card.
4. GET /users/<A1 id>/public.
5. Mobile: open ujimora://profile/<random 24-hex> and ujimora://profile/abc while signed in as U2.

**Expect:** The 200 response contains only id, name, avatarUrl, country, trustScore, verificationLevel and createdAt, with no role, email, phone or bio. Cache-Control is private, no-store. Invalid or unknown ids return 404 'User not found'. The mobile screen shows name, country, TrustBadge and Verification. Report and 'Block user' appear only when the viewer is signed in and not on their own profile. A1's public profile does not reveal 'admin'. On mobile, an unknown 24-hex id shows 'This profile is not available.' with Report/Block for a signed-in viewer, and 'abc' shows the same text without controls. Residual gap (I027 client side): the mobile Details card still shows a 'Role' label with an empty chip, because the API no longer sends role. Log it as a follow-up.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetPublicUserProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userRoutes.ts`, `apps/mobile/app/profile/[id].tsx`, `apps/mobile/src/navigation/resolvePath.ts`

## PROFILE-028 · P0 · Hiding the profile is immediate and hides the member and organization identity

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U1 is public, with a published campaign and comments. ORG1 is public.

**Steps:**

1. U1 web Settings > Privacy: turn off 'Allow profile to be public'; 'Settings saved' appears.
2. As a guest and as U2: GET /users/<U1>/public, and open mobile ujimora://profile/<U1>.
3. Open /campaigns/<U1 campaign id> as a guest and check the organizer card.
4. Check U1's existing comments and named donations.
5. ORG1 does the same, then open /organizations/<slug> and the /organizations directory.

**Expect:** No review is needed. GET /users/<U1>/public returns 404 'User not found'. The mobile screen shows 'This profile is not available.' and still offers Report and 'Block user' to signed-in U2. The campaign page loads without crashing, and the organizer card handles the missing creator. Comments and donations follow the documented policy (a private profile does not withdraw separately published content); product must confirm. The org page returns 404 and the org leaves the directory.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicProfileVisibility.ts`, `apps/mobile/app/profile/[id].tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `docs/compliance/ACCOUNT_PUBLICATION.md`

## PROFILE-033 · P0 · 'Make my donations anonymous by default' pre-selects anonymity and is applied server-side

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** U1 signed in. An active campaign exists. Paystack test keys.

**Steps:**

1. Web Settings: turn on 'Make my donations anonymous by default' (on Android: 'Anonymous Donations').
2. As U1, open /c/<slug>/donate on web and the donate screen on Android. Check the anonymity box and the Name field.
3. Complete a Paystack test donation without touching the anonymity control.
4. Make a second donation after unticking 'Give anonymously' (web) or 'Donate anonymously' (Android).
5. API as U1: POST /api/v1/donation-intents without isAnonymous, then with isAnonymous:false.
6. Turn the setting off and donate again without touching the box.
7. As a guest, open the campaign donor list and recent donations.

**Expect:** With the setting on, web pre-ticks 'Give anonymously (hide my name publicly)'. Android pre-ticks 'Donate anonymously' and clears the account name it had pre-filled. Donation 1 shows as anonymous publicly, and donation 2 (explicit untick) shows the name. When isAnonymous is omitted, the intent and the donation are anonymous; an explicit false is named. In step 6 the box is not pre-ticked and the gift is named. The web wallet-donation dialog follows the same default.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/hooks/useAnonymousDonationDefault.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/donationDefaults.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

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

## PROFILE-057 · P0 · Admin publishes a data-rights response; the requester is emailed a pointer and downloads or shares it

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** U1 has an open Access request. Resend, FROM_EMAIL and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 are configured.

**Steps:**

1. A1 /privacy-requests: click 'Load review history' (it shows the submitted event).
2. Enter internal review evidence (>= 20 chars) and click 'Save review progress'.
3. U1 clicks 'Refresh privacy requests'.
4. A1: write a response (>= 20 chars), set delivery to 'Publish in account Settings', and click 'Publish response to requester'.
5. Check U1's inbox within 2 minutes and open the link.
6. U1 web: click 'Download request and response'. U1 mobile: tap 'Share request and response'.
7. U1 submits a new Access request.

**Expect:** The status goes open, then 'in review', then 'responded', and the item moves to the 'Responded' filter. Exactly one email arrives, 'Your Ujimora privacy request has a response', from no-reply@ujimora.com. It says 'We have responded to your privacy request (reference <id>).', explains that the response is not included, and links to https://app.ujimora.com/settings. No response text or evidence is in the email. The download is ujimora-privacy-request-<id>.json with the request and response only (no evidence). The mobile share sheet opens. A new request is allowed after the response. Without account-email configuration, the response still publishes and no email is sent.

**Needs:** Resend for the notice email

**Source:** `apps/admin/src/components/DataRightsQueue.tsx`, `apps/web/src/components/account/DataRightsRequests.tsx`, `apps/mobile/src/components/DataRightsRequests.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`

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

## PROFILE-061 · P0 · Web account deletion: step-up, sign-out, public removal and correct data outcome

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Disposable account D with all balances at zero and no payouts in flight (otherwise see PROFILE-065 and PROFILE-N001). D has an avatar, bio, phone, confirmed newsletter, activity preferences, MFA enabled (authenticator at hand), comments, a named settled donation of GHS 40.00 to campaign X, a pending publication review with a held image, a block, a creator page with no tip balance, and notifications. An engineer has read-only DB access.

**Steps:**

1. Web /settings > Danger zone > 'Delete account'. Read the dialog and click Cancel.
2. Open it again. Wait for 'Checking your balances and campaigns…' to finish. Enter the current password and an authenticator code, then click 'Delete my account'.
3. Try signing in with D's credentials.
4. As a guest: open /users/<D>/public, campaign X's donor list and comments, and /creators/<handle>.
5. A1: admin /users list, /newsletter and /privacy-requests.
6. Engineer: check the profile, MFA, notification, alert-preference, block, publication-review and push-token records, the legal_acceptance_events rows and the user document.

**Expect:** The dialog says the account closes immediately and signs you out. It also says an App Store or Google Play subscription is not cancelled automatically. It shows 'Current password' and 'Authenticator or recovery code' fields, and 'Delete my account' stays disabled until both are filled (code >= 6 chars). Cancel does nothing. Delete returns 200 'Account closed. Associated data deletion and retained-record review requested', signs D out and lands on the home page. Sign-in fails and the public profile returns 404. Comments are hidden. The donation shows as anonymous, and neither it nor the campaign total changes. The creator page is gone. Admin Users excludes D and the newsletter entry is gone. Privacy requests shows D's contact email, the 'Retention / processor review required' chip, and the media URLs (avatar, cover, creator avatar/cover and the image held in publication review). The user document has name 'Deleted user' and email deleted-<id>@invalid.ujimora. Operational records are removed. Donations, KYC and consent-history events are kept.

**Needs:** Authenticator app

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`

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

**Before:** TestFlight and Play internal builds of this release. A disposable account with zero balances, biometric unlock on and an active App Store/Play sandbox subscription. Do not use the reviewer demo account.

**Steps:**

1. Profile tab > settings cog > Settings > scroll to 'Danger Zone' > 'Delete Account'.
2. Read the expanded section, then tap Cancel.
3. Open it again, enter the current password (and the authenticator code if MFA is on), tap 'Delete my account', and tap Cancel in the confirmation.
4. Repeat, and tap Delete in the confirmation.
5. Force-quit and relaunch the app.
6. Check the subscription in App Store / Play subscription settings.

**Expect:** Deletion is reachable in-app from Profile > Settings with no website detour. The section shows 'Checking your balances and campaigns…'. It says the account closes immediately and that an App Store or Google Play subscription is not cancelled automatically. It shows a 'Current password' field ('Authenticator or recovery code' when MFA is on) and a 'Delete my account' button that stays disabled until the password is entered. Tapping it opens the Alert 'Delete your account?' / 'This cannot be undone.' Cancel does nothing. Delete lands on the login screen. On relaunch there is no biometric prompt and no auto sign-in. The store subscription stays active until the user cancels it, as the text says. APP_REVIEW_NOTES describes the password step and asks for a balance-free reviewer account.

**Needs:** App Store sandbox / Play test track

**Source:** `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/src/lib/accountClosure.ts`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## PROFILE-065 · P0 · Deleting an account that holds money is refused until balances and payouts are resolved, and a later closure ends its campaign

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Disposable creator D has a wallet balance of GHS 120.00, an active campaign that raised GHS 500.00 with an unpaid campaign balance, a PENDING payout of GHS 200.00, an opened but unpaid Paystack checkout on the campaign, and a paid web subscription. Paystack test keys. Staging admin/DB access to settle balances.

**Steps:**

1. D: web Settings > Danger zone > 'Delete account'; read the dialog. Repeat on mobile Settings > Danger Zone > 'Delete Account'.
2. DELETE /api/v1/profile as D with the correct password.
3. A1: open admin /wallets and the campaign; confirm nothing changed.
4. Resolve each blocker (complete or reject the payout, pay out the campaign balance, clear the wallet through the support path) and reopen the dialog after each.
5. When the dialog allows it, delete with the password.
6. As the donor, pay the pre-closure Paystack checkout; let the webhook fire, then replay it.
7. As a guest, open /c/<slug> and try a new donation. A1 records the retention decision in /privacy-requests.

**Expect:** Closure is refused before anything is erased. Both clients show 'Your account can’t be closed yet. First withdraw or resolve: GHS 120.00 in your Ujimora wallet; GHS <balance> raised by your campaigns that has not been paid out; 1 payout still being processed. If you can’t, contact support@ujimora.com and we’ll help you close your account.' There is no password field and 'Delete my account' is disabled. The API returns 409 with that message and errors.accountClosure ['wallet_balance','campaign_balance','pending_payout']. D stays signed in and all records are intact. Each resolved blocker drops off the list. After closure the campaign is 'expired', with an end date no later than the closure time, and new donation intents get 400 'Campaign is not accepting donations'. The late pre-closure checkout settles exactly once (the replay adds nothing), so the closed campaign's balance becomes non-zero again. Known open issue I040 (owner decision): settlement still credits ended or closed campaigns and there is no refund-or-release rule, so ops must disburse or refund that late money by hand. Confirm the runbook.

**Needs:** Paystack test keys and webhooks

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`

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

## PROFILE-075 · P0 · Legal facts and storage disclosures match across web, marketing, native builds and store listings

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Latest web and marketing deploys, and the native builds that will be submitted.

**Steps:**

1. Compare effective dates, operator (DevTrack, BN843072020, UNN House address), contact emails and minimum age 18 across all surfaces.
2. Compare the Privacy Policy URL and deletion URL in APP_REVIEW_NOTES and the store consoles.
3. Read Cookie Notice sections 2-5, Privacy §7 and §10, Terms §14-15, Organizer Agreement §10 and Billing Terms §2-4 on web, marketing and each native build.
4. In web DevTools > Application > Local Storage, list the keys after signing in, changing the theme, and saving a held profile image.
5. Find every mention of 'Neurodyne Corp Ltd' as 'parent company' (registration, website notice, privacy notice) and compare it with the operator facts.

**Expect:** The text is identical everywhere, with no placeholder language. Native builds must be rebuilt after this release's legal.ts edits: the text changed without a change to LEGAL_ACCEPTANCE_VERSION or the effective date, so an older build shows the old wording. The Cookie Notice says no cookies, analytics or advertising technologies are used. It lists the browser-storage keys (uf_tokens, uf_user, accessToken, uf_last_activity, uf_color_mode, uf_skin, uf_pending_donations, uf_pending_subscriptions, ujimora:tip-attempt:*, uf_ref) with lifetimes, and no longer mentions a 'production cookie table' or preference controls. The marketing /cookies description matches. Billing Terms say website plans do not auto-renew. Disclosure gap to log: the held-draft keys 'ujimora:publication-draft:*' (kept up to 30 days) are not listed in the Cookie Notice. Known open issue I020 (product decision): the operator identity ('Neurodyne Corp Ltd' as parent company vs DevTrack BN843072020) still needs counsel sign-off (READINESS C01).

**Needs:** Legal/counsel review

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/marketing/__tests__/legalClaims.test.ts`, `apps/web/src/lib/publicationDrafts.ts`, `apps/web/src/components/auth/WebsiteRequestNotice.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`, `docs/compliance/READINESS.md`

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

## PROFILE-N001 · P0 · The closure check covers every balance kind and currency on web, mobile and the API

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Disposable accounts: C (creator-tip balance GHS 15.00 only), F (affiliate earnings not yet paid), B (a campaign with an undisbursed beneficiary balance), M (wallet GHS 10.00 and USD 5.00), and Z (no money). Staging DB read access.

**Steps:**

1. For each account, GET /api/v1/profile/closure-check and check the headers.
2. Open the web Delete dialog and the mobile Delete Account section as C and as M.
3. As C, DELETE /api/v1/profile with the correct password.
4. For an account whose only payout ended FAILED or REVERSED (funds returned), open the check again.
5. As Z, open the dialog. Separately, block /profile/closure-check in DevTools and open the dialog.

**Expect:** Each response has Cache-Control 'private, no-store' and contains {canClose, blockers, openCampaigns, message}. The reasons read: C 'GHS 15.00 in creator tips not yet withdrawn'; F '… in affiliate earnings not yet paid out'; B '… held for your campaign beneficiaries'. M lists 'GHS 10.00 in your Ujimora wallet' and 'USD 5.00 in your Ujimora wallet' separately, never summed. The blocked dialogs show the message, with no password field and a disabled 'Delete my account'. C's DELETE returns 409 with errors.accountClosure ['creator_balance'], and nothing is erased. A returned balance still blocks. Z gets canClose:true with no message, and the dialog shows the password field. If the check fails to load, the dialog still offers deletion and the API enforces the rules on DELETE.

**Needs:** Staging data setup for each balance kind

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ProfileController.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/src/lib/accountClosure.ts`

## PROFILE-N002 · P0 · Deleting an account needs the current password, plus an authenticator or recovery code when MFA is on

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Disposable accounts E1 (no MFA) and E2 (MFA on, recovery codes saved), both with zero balances. If available, a native build from before this release.

**Steps:**

1. As E1, open the web Delete dialog. Check the fields, enter a wrong password, and click 'Delete my account'.
2. After the error, keep using Settings (toggle a setting).
3. API: DELETE /api/v1/profile with no body, then with {password:''}.
4. As E2, open the dialog. Enter the password and a wrong 6-digit code, then the password and a valid recovery code.
5. As another MFA account, send 11 DELETEs with wrong codes within 10 minutes. From one client, send more than 30 DELETE or login attempts in 15 minutes.
6. On the older native build, try to delete from Settings.

**Expect:** E1 sees only 'Current password', and the button is disabled until a password is typed. A wrong password gives 400 'Current password is incorrect.' in the dialog, and the session stays usable. Step 3: no body gives 400 'Enter your current password to delete your account. If you are not asked for it, update the Ujimora app or delete your account from Settings at app.ujimora.com.'; an empty password gives 400 'Validation failed'. E2 also sees 'Authenticator or recovery code' (>= 6 chars). A wrong code gives 400 'Enter a valid authenticator code or an unused recovery code.' A valid recovery code closes the account (200 'Account closed…') and consumes that code. After 10 code attempts the API returns 429 'Too many code attempts. Try again in 10 minutes.' DELETE shares the per-client auth limit with login, so more than 30 attempts in 15 minutes gives 429 'Too many requests, please try again later'. The older build shows the 'update the Ujimora app…' message; make sure the store submission uses the new build.

**Needs:** Authenticator app; older native build optional

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoMfa.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`

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

**Before:** U1 signed in. API client with U1's token. CLOUDINARY_CLOUD_NAME is set on the API.

**Steps:**

1. PUT /api/v1/profile with each of these bodies: {bio: 1001 chars}, {phone: 31 chars}, {name:'A'}, {name: 101 chars}, {country:'G'}, {avatarUrl:'http://example.com/a.png'}, {coverUrl:'https://example.com/c.png'}, {preferredCurrency:'TOOLONG'}.
2. PUT {bio:'new bio text', phone: 31 chars}, then GET /api/v1/profile.
3. Web Profile > Edit Profile: clear Full Name and click 'Save Changes'.
4. Mobile Edit profile: clear the name field.

**Expect:** Each invalid body returns 400 'Validation failed' with field errors. For avatarUrl and coverUrl the error is 'Upload the image through Ujimora'. The only accepted image URLs are https://res.cloudinary.com/<configured cloud>/image/upload/… addresses returned by POST /uploads/image, and '' clears an image. In step 2 the bio is unchanged, so the whole request was rejected. Web shows an error alert and does not crash. On mobile, 'Save profile' is disabled while the name is blank.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`, `apps/mobile/app/profile/edit.tsx`

## PROFILE-006 · P1 · Profile impact figures are per currency, net of completed refunds, and consistent across web and native

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 has settled donations of GHS 50.00 and GHS 20.50 to two campaigns, plus a GHS 10.00 donation to one of them whose refund is completed. If multi-currency is enabled, U1 also has one USD 10.00 donation. U1 created one campaign that raised GHS 300.00.

**Steps:**

1. Web /profile: record the four tiles (Total Donated, Donations, Campaigns Supported, Campaigns Created) and the Recent Donations list.
2. In DevTools > Network, open GET https://api.ujimora.com/api/v1/profile and check donatedByCurrency, raisedByCurrency, totalDonated and campaignsCreated.
3. Compare with /donations (My Donations).
4. iOS/Android Profile tab: record Campaigns, Donated and Raised.

**Expect:** Web Total Donated shows 'GHS 70.50' through Intl formatting ('GH₵70.50' in an en-GH browser locale) and never '$'. The completed GHS 10.00 refund is excluded from the amount, but Donations still counts all 3 gifts. Campaigns Supported = 2 and Campaigns Created = 1. There is no Leaderboard tile. With the USD gift, currencies appear side by side (e.g. 'GHS 70.50 · $10.00') and are never summed. The API returns donatedByCurrency [{currency:'GHS', gross:80.5, refunded:10, net:70.5}, …], raisedByCurrency [{currency:'GHS', raised:300}] and a legacy totalDonated of 70.5 (GHS net only). A refund that is still pending or processing is not deducted until it completes. Mobile shows Campaigns 1, Donated 'GH₵ 70.50' (plus ' · US$ 10' with the USD gift) and Raised 'GH₵ 300'. Residual defect not covered by the I107 fix: Recent Donations still prints the raw ISO timestamp and an unpadded chip such as 'GHS 20.5'. Log it if seen.

**Needs:** Paystack test keys to create donations and a completed refund

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/src/lib/profileStats.ts`

## PROFILE-008 · P1 · Changing password keeps the current device signed in and ends other sessions (web, native and admin)

*Surfaces:* admin, android, api, email, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 is signed in on browser A and on mobile. A1 is signed in to the admin console in two browsers. Resend is configured.

**Steps:**

1. Web Profile > 'Change Password' tab: enter the current password, a new password (>= 8 chars) and the confirmation, then click 'Update Password'.
2. Right away, in browser A open /settings, toggle a setting and reload the page.
3. On mobile (signed in before step 1), open Settings or pull to refresh.
4. Negative cases: wrong current password, mismatched confirmation, new password under 8 chars.
5. Repeat steps 1-3 from mobile Edit profile > 'Update password', with web now as the other device.
6. Admin: A1 changes the password on /profile > Security in browser 1, then uses the console in browser 1 and in browser 2.

**Expect:** Success messages are 'Password changed!' (web), 'Password updated' (mobile) and 'Password changed successfully' (admin). The device that changed the password stores the new tokens from PUT /auth/change-password and stays signed in, so step 2 saves and still works after reload. The other devices get 401 'Your session has ended. Please sign in again.' and return to sign-in. A password-changed email arrives. Negative cases: 'Current password is incorrect' (API 400); 'Passwords do not match.' (web) or 'The new passwords do not match.' (mobile); 'Password must be at least 8 characters.' (web; the mobile button stays disabled under 8 chars). A refused change leaves the session untouched.

**Needs:** Resend for the password-changed email

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/lib/accountSecurity.ts`, `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`

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

## PROFILE-014 · P1 · A changed identity or an expired approval never publishes; an expired approval goes back into review

*Surfaces:* admin, android, api, ios, web  ·  *Type:* negative/edge

**Before:** U1 has an approved but unapplied name version. Staging DB access for steps 3-4. OPENAI_API_KEY is configured for step 4.

**Steps:**

1. Before resubmitting, change another identity input: turn 'Allow profile to be public' off and on again (web), or change Country on mobile.
2. Resubmit the approved name.
3. Staging: set approvalExpiresAt in the past on another approved review that was submitted without OpenAI consent. Resubmit that exact version and refresh Settings > Publication reviews and the admin queue.
4. Repeat step 3 for a clean-text review, resubmitting with the OpenAI consent box checked.

**Expect:** Step 2 does not publish. It either creates a new pending review (409 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.') or returns 409 'Your account identity changed during review. Reload and retry.' Step 3 returns the same 409 'Saved privately for safety review…', not 'This safety approval expired…'. The same Reference id goes back to 'pending' (reason staff requested) with the old decision, notes and expiry cleared, and the name stays unchanged until staff approve again. The exact resubmission then publishes. In step 4 the version is re-screened automatically: clean text is approved by automated:openai with a new 7-day expiry and the save succeeds ('Profile updated!'). Nothing publishes on an expired approval without a fresh decision.

**Needs:** Staging DB write access for expiry; OpenAI for step 4

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## PROFILE-015 · P1 · Optional OpenAI screening: clean text auto-approves; flagged or unavailable goes to staff and is logged

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** OPENAI_API_KEY is configured, and U1 may already have an approved avatar. A second staging environment runs without OPENAI_API_KEY and with NODE_ENV=production. API log access for both.

**Steps:**

1. Check 'Use OpenAI to check this public text for safety (optional)', change the name to a benign value, and save.
2. With the box checked again, try a name containing an abusive or hateful term.
3. On the staging environment without OPENAI_API_KEY, repeat step 1. Check the API startup log and the request log.
4. Admin Publication reviews: check the approved and pending lists, the reviewer and the reason. Read each item's text.

**Expect:** Step 1 saves immediately, approved by automated:openai with a 7-day expiry. This works even with an existing avatar, because unchanged images are no longer sent as media. Step 2 is held pending with reason 'flagged'. Step 3 is held pending with reason 'unavailable'. The API logs the warning 'Publication screener unavailable; routed to staff review' with the fingerprint and action, and the production start logged the error 'OPENAI_API_KEY missing: publication screening disabled; opted-in submissions go to staff review'. Phone and bio never appear in the review text. The consent box is unchecked by default on each visit.

**Needs:** OpenAI; log access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/web/src/components/safety/PublicationConsent.tsx`, `apps/api/src/app.ts`

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

## PROFILE-022 · P1 · A held web avatar upload can be saved after approval, even after closing the dialog

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Cloudinary is configured. U1 has accepted the agreement. A2 is an admin.

**Steps:**

1. Profile > 'Change profile image'. Upload a 1 MB square JPG and watch the progress bar.
2. Click 'Save image'.
3. Keep the dialog open. A2 opens the media URL in admin Publication reviews and approves it.
4. Click 'Save image' again.
5. Repeat with a different image, but close the dialog after the held save and reload the page. After A2 approves, reopen 'Change profile image' and click 'Save image' without uploading again.

**Expect:** The upload goes to POST https://api.ujimora.com/api/v1/uploads/image?folder=profiles and returns an https://res.cloudinary.com/<cloud>/image/upload/… URL. The first save is held: the error 'Saved privately for safety review…' appears with the Publication reviews list (reason media). After approval, the save succeeds ('Profile updated!') and the avatar appears in the header and on the mobile Profile tab. In step 5 the reopened dialog pre-selects the held image with the note 'This is the image you last submitted. If it is waiting for review, save it again after it is approved.' Saving publishes it without a new review and clears the stored draft. Known open issue I073 (mitigated): the held image is kept only in this browser for 30 days and is cleared on sign-out. From another browser or device the user must re-upload, which creates a new URL and a new review.

**Needs:** Cloudinary

**Source:** `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/web/src/lib/publicationDrafts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## PROFILE-023 · P1 · Image upload validation, outages and off-platform URLs

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** U1 signed in. API client with U1's token. A staging environment without Cloudinary vars.

**Steps:**

1. In the web image editor, select a 5 MB image.
2. Select a GIF, then a HEIC.
3. API: POST /api/v1/uploads/image?folder=profiles with (a) a 4 MiB + 1 byte JPEG, (b) exactly 4 MiB, (c) a 6 MB body, (d) Content-Type application/pdf, (e) text/plain. Then POST ?folder=avatars with a JPEG, and POST ?folder=kyc with a PDF.
4. On the staging environment without Cloudinary, upload an image, then PUT /profile with any non-empty avatarUrl.
5. Go offline mid-upload.
6. PUT /api/v1/profile with {avatarUrl:'https://example.com/pixel.png'}, {coverUrl:'javascript:alert(1)'}, {avatarUrl:'https://res.cloudinary.com/othercloud/image/upload/x.png'}, and {avatarUrl:''}.

**Expect:** Step 1: the client rejects the file before upload with 'File is too large (max 4MB).' Step 2: 'Choose a JPG, PNG or WebP image.' Step 3 results: (a) 413 'File is too large (max 4MB).'; (b) 200; (c) 413 'File or request is too large.' (never 500); (d) 415 'PDF files are only accepted for verification documents.'; (e) 415 'Only image or PDF files are allowed.'. The unknown folder returns 400 'Unknown upload folder.', and the kyc PDF returns 200 with a kyc://<id> reference. Step 4: 503 'Image uploads are not configured on the server.', and every non-empty image URL is refused with 400 because no cloud is configured. Step 5: an error shows, 'Save image' stays disabled while uploading, and no half-saved avatar remains. Step 6: the first three bodies return 400 'Validation failed' with 'Upload the image through Ujimora', and no review is created. '' clears the image (200). Off-platform images already stored are not migrated (owner decision, I102).

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `packages/ui/src/components/ImageUpload.tsx`

## PROFILE-024 · P1 · Removing a profile photo or cover takes effect immediately, without review

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U1 has an approved avatar and cover.

**Steps:**

1. Web: 'Change profile image' > 'Use default image' > 'Save image'.
2. Mobile Edit profile: tap the trash icon 'Remove cover image', then 'Save profile'.
3. As a guest, GET /users/<U1>/public. Check the web header and the mobile Profile tab.
4. Settings > Publication reviews > 'Refresh publication reviews'.
5. In a single save, remove the avatar and change the name (OpenAI consent unchecked).

**Expect:** Steps 1-2 apply at once: web shows 'Profile updated!' and mobile shows 'Your profile has been updated'. The default artwork shows on every surface, and the public avatarUrl is empty. No publication review is created. The editor says 'Removing your image with “Use default image” takes effect right away.' and mobile says 'removing an image takes effect right away'. Step 5 is held (409 'Saved privately for safety review…') because it also changes the name, and nothing changes until approval.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`

## PROFILE-026 · P1 · Native pick, camera, crop and upload of cover and photo on iOS and Android, including held-draft restore

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** TestFlight and Android internal builds. Cloudinary is configured. Camera permission has not been granted yet. A2 is an admin.

**Steps:**

1. Profile tab > 'Edit images'.
2. Cover image: tap the camera icon ('Take cover image') and deny the prompt. Tap it again (on Android, deny with 'Don't allow' twice).
3. Tap 'Open Settings', allow Camera, return and retry. Alternatively tap 'Add'/'Change' to pick from the library and crop 16:9.
4. Profile photo: pick and crop square. Then pick a file larger than 4 MB.
5. While uploads run, try 'Save profile'.
6. After the uploads finish, save. Force-quit, relaunch and open Edit profile. After staff approval, tap 'Save profile' again.
7. Remove the cover with the trash icon and save. Separately, throttle the network so an upload stalls.

**Expect:** The camera prompt appears only on tap. A first, re-askable denial shows 'Camera permission is needed to take a photo. You can choose a file instead.' A permanent denial (iOS after the first denial; Android after 'Don't allow') shows 'Camera access is off for Ujimora. Open Settings to allow it, or choose a file instead.' plus an 'Open Settings' button that opens the app's OS settings page. Library picks use the system picker. Files over 4 MB show 'Choose a file smaller than 4 MB.' 'Save profile' is disabled while uploads run. The first save is held ('Saved privately for safety review…') and the Publication reviews list is shown. After relaunch, the held images are restored with 'We restored the changes you last submitted for review. Save them again once they are approved.' After approval, the same save publishes ('Your profile has been updated'). Removing the cover applies immediately. A stalled upload fails after about 2 minutes with 'Ujimora took too long to respond. Check your connection and try again.' and the busy state clears.

**Needs:** Cloudinary; physical devices

**Source:** `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/components/OpenSettingsButton.tsx`, `apps/mobile/src/lib/publicationDrafts.ts`, `apps/mobile/src/lib/api.ts`, `docs/compliance/NATIVE_PERMISSIONS.md`

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

## PROFILE-046 · P1 · Marketing and blog newsletter signup shares the account's consent record; limits are per client

*Surfaces:* api, email, marketing, web  ·  *Type:* cross-platform

**Before:** U1 is unsubscribed. Two devices on different networks (e.g. office Wi-Fi and mobile data).

**Steps:**

1. ujimora.com footer: enter U1's email in mixed case with spaces. Confirm Subscribe is disabled until 'Email me Ujimora stories and promotional updates.' is checked, then submit.
2. Open U1's web Settings newsletter section.
3. ujimora.com/blog: sign up an email with no account, then confirm it.
4. From network 1, switch the web Settings newsletter toggle (PUT https://api.ujimora.com/api/v1/newsletter/preference) 21 times within 15 minutes. Then toggle it once from network 2.
5. From network 1, submit the ujimora.com footer signup 21 times within 15 minutes. Then submit once from network 2.

**Expect:** Step 1 shows 'Check your email to confirm. No newsletters will be sent until you confirm; existing confirmed subscriptions stay unchanged.' U1's Settings shows 'Requested — awaiting email confirmation', so the address was normalised to the same record. The non-account email appears in admin only after confirmation. In step 4 the 21st request gets 429 'Too many requests, please try again later' with Retry-After, while network 2 is unaffected, because limits are keyed on the client address from CF-Connecting-IP. In step 5 the 21st footer signup shows 'Could not request a subscription. Please try again later.' (API 429). Known open issue I001 (residual): the marketing site still posts '/api/v1/newsletter/subscribe' through the Vercel rewrite, so all ujimora.com visitors share Vercel's egress address, and network 2 may also be refused. Log it if seen. Also I099: counters are per API instance and reset on restart.

**Needs:** Resend; two networks

**Source:** `apps/marketing/src/components/NewsletterSignup.tsx`, `apps/marketing/src/components/Footer.tsx`, `apps/marketing/.env.production`, `apps/api/src/application/use-cases/SubscribeNewsletterUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`

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

**Before:** Disposable accounts with zero balances and known passwords.

**Steps:**

1. Web: open the Delete dialog, enter the password, and double-click 'Delete my account' quickly while watching DevTools > Network.
2. Web (another account): click Delete, then switch DevTools offline before the response arrives.
3. Mobile: turn on airplane mode, enter the password, tap 'Delete my account', then 'Delete'.
4. Restore the network and retry each.

**Expect:** Step 1 sends exactly one DELETE /profile. While it runs, the fields and both buttons are disabled and the button reads 'Deleting…'. The account is closed once, and the user is signed out to the home page with no error. Step 2 shows an error alert inside the dialog (the browser's network error text); the dialog stays open and the session is intact. Step 3 shows 'Could not reach Ujimora. Check your connection and try again.' under the form. A retry either succeeds, or, if the first request already closed the account, gets 401 'Account is no longer available' and ends signed out (web sign-in prompt, mobile login). An account never still signs in after a closure was recorded.

**Needs:** None

**Source:** `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/src/lib/api.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`

## PROFILE-066 · P1 · Deletion side effects on campaigns, live sessions, teams, collaborations and subscriptions

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** A disposable C1-like account with zero balances and no payouts in flight, and an active campaign with an active live session that has viewers. It also has organization team membership, a collaborator role on another campaign, and a paid web subscription. LiveKit is configured.

**Steps:**

1. Open the Delete dialog, note the campaign warning, and delete with the password.
2. Viewers: watch the live page.
3. Open the campaign page and try to donate on web and Android.
4. Open the organization team page and the other campaign's collaborators.
5. Admin: check the subscriptions list and the campaign's status.

**Expect:** The dialog warns 'Closing your account ends your open campaign. It stops accepting donations, and anything awaiting review is withdrawn.' The live session ends for viewers (ended state, privacy mode). The campaign becomes 'expired' with an end date no later than the closure time, and donation attempts get 400 'Campaign is not accepting donations'. Team membership is revoked, and the collaborator shows 'Deleted user'. The web subscription is marked cancel-at-period-end (web plans are one-time purchases that never auto-renew) and access is not extended. An App Store or Google Play subscription renews until the user cancels it in the store, as both deletion dialogs say.

**Needs:** LiveKit; Paystack

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`

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

## PROFILE-071 · P1 · Email-based deletion requests are fulfilled by operations through the admin console

*Surfaces:* admin, api, email  ·  *Type:* compliance

**Before:** Access to legal@ujimora.com. A disposable account with zero balances that 'cannot sign in'. A1 has the Users delete permission.

**Steps:**

1. Send the prefilled deletion email from the account's registered address.
2. Ops confirms the request came from the registered address and never asks for a password or code.
3. A1: admin /users/<id> > 'Account closure' > 'Close account'. Enter how the request was verified (>= 20 chars), type the account email, and confirm.
4. Try signing in as the account; check /privacy-requests and the audit log.
5. Reply to the user and record retention decisions in /privacy-requests.

**Expect:** The mailbox is monitored and the request is verified. The console closes the account through the normal erasure path and returns to /users. The account's sessions end (its tokens get 401), a deletion request appears in /privacy-requests, and an 'account.staff_closure' audit entry records the note. The user is answered within the stated timing. Known open issue I083 (mitigated): there is no staff email-change tool and no identity-verification runbook yet. Check first for a likely integration regression: the route calls DeleteAccountUseCase.execute(id) without credentials, while app.ts wires the password step-up into that use case. On integrate/launch-fixes a valid closure is therefore expected to fail with 400 'Enter your current password to delete your account…' after the audit row is written (see PROFILE-N004). File it as a launch blocker if seen.

**Needs:** Staffed legal@ mailbox

**Source:** `packages/types/src/legal.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/admin/src/components/AccountClosureControl.tsx`, `apps/admin/src/pages/UserDetailPage.tsx`, `docs/compliance/READINESS.md`

## PROFILE-077 · P1 · A legal version bump asks existing users to accept again, and older native builds are sent to update

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Staging API and web built with a bumped LEGAL_ACCEPTANCE_VERSION. One native build from before the bump and one rebuilt with it. Users are already signed in (no re-login).

**Steps:**

1. Web: leave an open tab signed in. Switch away and back after at least 60 seconds, or try a publishing action.
2. Try a name change and a comment on web and mobile.
3. Donate without a message, change settings, submit a data-rights request, and open the Delete account dialog.
4. Web: open /account-agreement, check both boxes and save.
5. Old native build: foreground the app and open the agreement notice's 'Review agreement'.
6. Tap 'I have accepted it, check again' after accepting on the website.
7. Rebuilt native build: review and accept in the app.

**Expect:** The web banner 'Please review the account agreement before publishing or uploading content.' appears without re-login, driven by GET /profile/legal-acceptance on focus or visibility and immediately after any 428. Publishing returns 428 'Review the current account agreement and confirm you are at least 18 before publishing or uploading content' until the user accepts again. Actions that do not publish are unaffected. Web posts the version the server requires, and the banner clears. The old native build never offers checkboxes for unseen terms. It shows 'An updated account agreement is available. Update Ujimora from the App Store or Google Play to review and accept it, or review it on the Ujimora website.' with 'Review on the website' (opening https://app.ujimora.com/account-agreement), and after 'check again' it shows 'Your agreement has been saved.' The rebuilt app accepts in-app. Each re-acceptance adds one 'reaccept' consent event (PROFILE-N006). If ops also sets a minimum supported version, older builds get the blocking 'Update required' screen instead.

**Needs:** Staging build with bumped version; an older native build

**Source:** `packages/types/src/legal-acceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/mobile/app/account-agreement.tsx`, `apps/mobile/src/lib/agreementStatus.ts`, `apps/mobile/src/components/UpdateRequiredGate.tsx`

## PROFILE-078 · P1 · Private account endpoints are never cached, on the direct API origin or through the rewrite

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** U1 is signed in on app.ujimora.com. The production web build calls https://api.ujimora.com/api/v1 directly (VITE_API_URL). The Vercel /api/v1 rewrite remains only for old bundles and the marketing site.

**Steps:**

1. Inspect the response headers for /profile, /profile/closure-check, /profile/legal-acceptance, /profile/activity-alerts, /data-rights, /safety/blocks, /newsletter/preference, /publication-reviews and /users/:id/public.
2. Request the same URLs through https://app.ujimora.com/api/v1/… with U1's token.
3. Sign out and press Back to /settings.
4. Sign in as U2 and reload the same URLs on both paths.

**Expect:** Every response has Cache-Control 'private, no-store', except /profile/legal-acceptance, which sends 'no-store'. Neither path lets an edge or browser cache serve U1's JSON to U2. Pressing Back after sign-out shows the sign-in prompt, not U1's data.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ProfileController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/web/.env.production`, `apps/web/vercel.json`

## PROFILE-N003 · P1 · Closing an account ends its open campaigns and withdraws campaigns awaiting review

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Disposable creator D with zero balances. D has active campaign A (no unpaid funds), campaign P in pending_review, and draft campaign R.

**Steps:**

1. Open the web Delete dialog and the mobile Delete Account section; read the warning. Check GET /api/v1/profile/closure-check.
2. Delete with the password.
3. As a guest: open /c/<A slug>, try to donate on web and Android, and POST /api/v1/donation-intents for A.
4. Admin: check the campaign review queue and the A, P and R details.
5. Engineer: re-run the erasure sweep (admin 'Retry pending cleanup') and re-check the statuses.

**Expect:** Before deletion, both clients warn 'Closing your account ends your 2 open campaigns. They stop accepting donations, and anything awaiting review is withdrawn.' (the singular form appears for one campaign), and openCampaigns is 2. After deletion A is 'expired' with an end date no later than the closure time (never extended). Its page shows the ended state, and new donation intents return 400 'Campaign is not accepting donations'. P is back to 'draft' and has left the staff review queue. R is unchanged. Money records are untouched. Re-running the sweep changes nothing more.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/lib/accountClosure.ts`

## PROFILE-N004 · P1 · Staff-assisted account closure: console guards and API contract

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A1 has the Users delete permission. A3 is an admin without it. A2 is another admin. M1 is a member with zero balances; M2 is a member with a wallet balance. U1 is a non-admin token holder.

**Steps:**

1. A1: open admin /users/<M1> > 'Account closure'. Type a 19-char note and a wrong email, then a >= 20-char note and M1's email in upper case, and click 'Close account'.
2. Check M1's sessions, /privacy-requests and the audit log.
3. A3: open /users/<M1>.
4. API as A1: POST /api/v1/admin/users/<A1 id>/close, /admin/users/<A2 id>/close, /admin/users/not-an-id/close, and /admin/users/<M2>/close (valid note and email).
5. API as U1: POST /api/v1/admin/users/<M1>/close.
6. Rotate A1's password in another browser, then retry step 1 from the stale page.

**Expect:** 'Close account' stays disabled until the note is >= 20 chars and the email matches (case-insensitive). The dialog warns 'This signs the member out everywhere and starts erasure of their profile data. It cannot be undone from the console.' On success the console returns to /users. M1's tokens get 401, a deletion request appears, and an 'account.staff_closure' audit entry (severity warning) records the note. A3 sees the panel with the button disabled. The API returns: own account 409 'Close your own account from your profile, not the staff console.'; admin target 409 'Administrator accounts cannot be closed from the console.'; bad id 404 'Account not found'; wrong email 400 'The confirmation email does not match this account.'; M2 409 with the closure-blocker message; U1 403; stale admin session 403 'Current administrator access is required.' Known open issue I083 (mitigated), plus a likely integration regression: the route calls DeleteAccountUseCase.execute(id) with no credentials, while app.ts wires the password step-up into that use case. A valid closure is therefore expected to return 400 'Enter your current password to delete your account…' after the audit row is written, which also contradicts admin-account-closure.integration.test.ts. File it as a blocker if seen.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/admin/src/components/AccountClosureControl.tsx`, `apps/admin/src/pages/UserDetailPage.tsx`, `apps/api/src/app.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/__tests__/integration/admin-account-closure.integration.test.ts`

## PROFILE-N006 · P1 · Account-agreement consent history is recorded once per acceptance and never overwritten

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Staging DB read access. A fresh email address. A staging build with a bumped LEGAL_ACCEPTANCE_VERSION (can share the PROFILE-077 setup).

**Steps:**

1. Register a new account on web.
2. Inspect legal_acceptance_events for the new user.
3. After the version bump, accept the new agreement on web. Then POST /profile/legal-acceptance again with the same version, and send 3 identical POSTs at once for a second user who needs re-acceptance.
4. Delete the first account and inspect its events again.
5. Run scripts/backfill-legal-acceptance-events.ts without flags, then with --apply twice.

**Expect:** Registration writes one 'register' event (version, acceptedTerms and ageConfirmed true, acceptedAt equal to users.legalAcceptance.acceptedAt, ip, user agent) in the same transaction as the user. Re-acceptance appends exactly one 'reaccept' event. The repeat and the concurrent trio add no duplicates, earlier events are never changed, and users.legalAcceptance holds only the current version. Events survive account erasure. The backfill dry run writes nothing, and --apply is idempotent. Follow-up to log: the ip field is taken from req.ip (Render's proxy address in production), not the client IP used for rate limits and audit (I001/I085).

**Needs:** Staging DB access; bumped-version build

**Source:** `apps/api/src/infrastructure/database/models/LegalAcceptanceEventModel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLegalAcceptanceLog.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/scripts/backfill-legal-acceptance-events.ts`

## PROFILE-N008 · P1 · Data-rights responses trigger a content-free email notice only for account delivery

*Surfaces:* admin, api, email, web  ·  *Type:* compliance

**Before:** Resend, FROM_EMAIL and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 are configured. U1 has two open requests (Access and Complaint). A1 and A2 are admins.

**Steps:**

1. A1 publishes a response to U1's Access request with delivery 'Publish in account Settings'.
2. Check U1's inbox within 2 minutes.
3. A2 replays the publish from a stale form.
4. A1 answers U1's Complaint with 'Record verified external delivery already completed' and a reference of >= 20 chars.
5. U1 changes the password right after another account-delivery publish, before the email worker runs.

**Expect:** Step 2: exactly one email, 'Your Ujimora privacy request has a response', from no-reply@ujimora.com with reply-to support@ujimora.com. It gives the reference id, says the response is not included for security, and links to https://app.ujimora.com/settings. It contains no response text or evidence. Step 3 returns 409 'Request changed or was already answered. Refresh before reviewing.' and sends no second email. Step 4 sends no email. In step 5 the queued notice is suppressed because the account's auth version changed. If queueing fails, the review transaction rolls back and staff can retry.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/admin/src/components/DataRightsQueue.tsx`, `docs/compliance/DATA_RIGHTS.md`

## PROFILE-N012 · P1 · Privacy-request and account-security limits apply per client, not platform-wide

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Production-like staging where the API is reached through Render's Cloudflare edge and the web build calls https://api.ujimora.com/api/v1 directly. Device A and device B are on different networks. U1, U2 and A1 exist.

**Steps:**

1. Device A as U1: send 21 POST /api/v1/data-rights requests within 15 minutes (the web form or a script from A's network).
2. Immediately, on device B as U2: submit a privacy request in Settings.
3. Device A: send 31 failed sign-ins or wrong-password account deletions within 15 minutes, then try to sign in correctly.
4. Device B: sign in as U2.
5. Check the X-RateLimit-Remaining headers on both devices.
6. A1 performs an admin action from device B; check the audit entry's IP.

**Expect:** On device A, the 21st privacy request gets 429 'Too many requests, please try again later' with Retry-After, while device B's request succeeds ('Request received. Check this section for its response.'). Device A is limited on the auth bucket (429), and device B signs in normally. Each device's headers count separately. The audit entry records device B's public IP, not a Render or Vercel address. Known open issue I099 (mitigated): counters are in memory per API instance and reset on restart, so run a single instance.

**Needs:** Two networks; production-like edge

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/web/.env.production`

## PROFILE-N013 · P1 · Changing password on mobile keeps biometric unlock working

*Surfaces:* android, email, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 is signed in on iOS or Android with biometric unlock enabled, and also signed in on web. Resend is configured.

**Steps:**

1. Mobile Edit profile > Change password: enter the current password, a new password (>= 8 chars) and the confirmation, then tap 'Update password'.
2. Open Settings and toggle a privacy setting.
3. Background the app past the lock timeout, or force-quit and relaunch, then unlock with biometrics and pull to refresh.
4. Web: toggle a setting.
5. Negative cases: mismatched confirmation, then a wrong current password.

**Expect:** 'Password updated' appears, and the app stays signed in; step 2 saves. Biometric unlock opens the app with the newly sealed tokens, and requests work without a sign-in prompt. Web gets 401 'Your session has ended. Please sign in again.' and shows the sign-in prompt. A password-changed email arrives. The negative cases show 'The new passwords do not match.' and 'Current password is incorrect', and the session is untouched. If the device cannot store the new sign-in, it shows 'Password updated, but this device could not save the new sign-in. Sign in again before using biometric unlock.'

**Needs:** Physical devices with biometrics; Resend

**Source:** `apps/mobile/src/lib/accountSecurity.ts`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/context/AuthContext.tsx`, `apps/api/src/application/use-cases/ChangePasswordUseCase.ts`

## PROFILE-007 · P2 · Profile page has no placeholder widgets, and only organizations get a public profile link

*Surfaces:* api, web  ·  *Type:* functional

**Before:** U1 (individual) and ORG1 (organization with a public profile) can sign in.

**Steps:**

1. As U1, open /profile. Look for Followers/Following/Bookmarks counts, Achievement Badges, Interested Categories chips, a giving-streak line and a share icon.
2. In DevTools, inspect the GET /api/v1/profile response body.
3. Sign in as ORG1, open /profile and click the share icon 'Copy public profile link'.
4. Paste the copied URL into an incognito window.

**Expect:** No social counts, badges, interests picker or streak appear, and the /profile response has no streak, rank, followers, following, bookmarks, badges or interestedCategories fields. U1 sees no share button, because an individual's /profile is sign-in only. ORG1 sees 'Copy public profile link'. Clicking it shows 'Profile link copied!' and copies https://app.ujimora.com/organizations/<ORG1 id>, which opens the public organization page signed out. If the clipboard is blocked, no confirmation appears.

**Needs:** None

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/web/src/pages/OrganizationProfilePage.tsx`

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

## PROFILE-016 · P2 · With an existing avatar, name changes are text-screened and only a new image needs media review

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** U1 has an approved avatar. OPENAI_API_KEY is configured. A2 is an admin.

**Steps:**

1. Check the OpenAI consent box, change only the name (benign), and save.
2. Uncheck the consent box, change the name again, and save.
3. Upload a new avatar and click 'Save image'.
4. Admin Publication reviews: check each item's reason and media list.
5. After A2 approves the new avatar and U1 re-saves it, U1 posts a comment with consent.

**Expect:** Step 1 is auto-approved by automated:openai and saves at once with 'Profile updated!', with no media hold. Step 2 is held with reason 'staff requested' and an empty media list: the unchanged avatar is not sent as media, and the full identity, including the avatar URL, stays in the review text. Step 3 is held with reason 'media' and lists only the new avatar URL. Once published, the new avatar is recorded as reviewed, so U1's later comments are screened as text and not held for the avatar. Avatars set before this release are still media-held on comments.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `docs/compliance/ACCOUNT_PUBLICATION.md`

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

## PROFILE-030 · P2 · Native users can hide or show their profile from Settings, with publication review

*Surfaces:* admin, android, ios, web  ·  *Type:* cross-platform

**Before:** U1 is on the mobile builds with a public profile. A2 is an admin. OPENAI_API_KEY is configured for step 5.

**Steps:**

1. Open Settings > Privacy and find the 'Public profile' switch and the 'Use OpenAI to check this public text for safety (optional)' box.
2. Turn 'Public profile' off. As a guest, GET /users/<U1>/public. As U2, open ujimora://profile/<U1>.
3. Turn it on with the consent box unchecked.
4. A2 approves the pending account-profile review; U1 turns the switch on again.
5. Turn it off, check the consent box, and turn it on (clean identity text).
6. Reload web Settings.

**Expect:** Turning it off saves immediately: the public profile returns 404 and mobile shows 'This profile is not available.' In step 3 the switch reverts to off and the red banner shows 'Saved privately for safety review. Your content has not been published…'. Settings > Publication reviews lists the pending item. Step 4 saves. Step 5 is auto-approved and saves. Web 'Allow profile to be public' matches the native state.

**Needs:** OpenAI for step 5

**Source:** `apps/mobile/app/settings.tsx`, `apps/mobile/src/lib/privacySettings.ts`, `apps/mobile/src/components/PublicationConsent.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`

## PROFILE-035 · P2 · Appearance and currency preferences, with no unused language setting

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** U1 on web and mobile; A1 on the admin console.

**Steps:**

1. Web Settings > Preferences: check the section contents.
2. Web: turn Dark mode on, then sign in with another browser.
3. Mobile Settings: look for a Language picker. Switch Appearance Light/Dark/System and Design finish, then restart the app.
4. Check the Currency display on both.
5. Admin /profile > Preferences tab.

**Expect:** Web Preferences reads 'Currency and appearance.' It shows Currency GHS ('All donations and campaigns use the Ghanaian cedi.') and the Dark mode toggle, with no Language select. Mobile has no Language picker. Web dark mode follows the account across browsers. Mobile appearance and finish persist locally after restart. Currency is fixed at GHS. Admin Preferences shows information only (see PROFILE-079).

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`, `apps/admin/src/pages/AdminProfilePage.tsx`

## PROFILE-040 · P2 · Email-provider outage: choices save, queued alerts recover, and ambiguous deliveries reach staff

*Surfaces:* admin, android, email, ios, web  ·  *Type:* recovery/idempotency

**Before:** Staging with RESEND_API_KEY unset. Staging DB access. A1 is an admin.

**Steps:**

1. Open Settings > Notifications.
2. Toggle several email choices and trigger a qualifying event.
3. Configure RESEND_API_KEY, restart the API, and wait up to 2 minutes.
4. Staging DB: make a pending email delivery ambiguous for 23 hours or more (firstAttemptAt older than 23 h), then let the worker run.
5. A1: open the admin action centre, then Platform > 'Activity email checks'.

**Expect:** A banner reads 'Email delivery is temporarily unavailable. You can still save your choices.' and the choices save. After configuration, the pending email is sent once. In step 4 the delivery moves to 'review' and the API logs the warning 'activity email needs a delivery check' with no address or body. The action centre shows 'Activity emails needing a delivery check', and the item is listed on /activity-email-review (see PROFILE-N009).

**Needs:** Resend; staging DB access

**Source:** `apps/web/src/components/account/ActivityAlertSettings.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActivityDeliveryRoutes.ts`, `apps/admin/src/pages/ActivityEmailReviewPage.tsx`

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

**Before:** A1 is signed in to the admin console in two browsers, without authenticator MFA. A2 is another admin.

**Steps:**

1. Open /profile. Change the name and country, with and without 'Use OpenAI to check this public identity (optional)'.
2. Open the Preferences tab.
3. Security tab: change the password. Then keep using the console in browser 1 and reload browser 2.
4. On any other console page, click 'Turn on' in the warning 'Protect this administrator account: turn on authenticator app sign-in…'.

**Expect:** Identity changes are held, with a link that opens the review queue in a new tab, and only another admin can approve them. Preferences shows only 'Staff alerts appear in the notification bell at the top of the console.' and 'Email and browser push alerts for staff are not available yet, and the console is in English only. Account security emails, such as password-change notices, are not affected.' There are no switches, language select or Save button. The password change shows 'Password changed successfully'. Browser 1 stays signed in with the new tokens, and browser 2's session ends. Step 4 opens /profile?tab=security on the Security tab.

**Needs:** OpenAI optional

**Source:** `apps/admin/src/pages/AdminProfilePage.tsx`, `apps/admin/src/components/layout/AdminMfaPrompt.tsx`

## PROFILE-080 · P2 · Platform analytics are admin-only, and the profile page no longer requests them

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** U1 (member) and A1 (admin) can sign in.

**Steps:**

1. As U1, open /profile and watch the Network tab.
2. As U1, call GET /api/v1/analytics/overview directly; repeat with no token.
3. As A1, call GET /api/v1/analytics/overview.
4. As U1, call GET /api/v1/rbac/me.

**Expect:** /profile makes no /analytics/overview request. U1 gets 403 'Insufficient permissions', a request without a token gets 401, and A1 gets 200 with the platform totals. /rbac/me returns an empty permission list and role name for U1.

**Needs:** None

**Source:** `apps/web/src/pages/ProfilePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/analyticsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`

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

## PROFILE-N005 · P2 · Held identity drafts are kept per account on the device and cleared on sign-out

*Surfaces:* android, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 and U2 share one browser and one phone. Cloudinary is configured. A2 is an admin.

**Steps:**

1. Web as U1: upload a new avatar and click 'Save image' (held). Close the dialog, reload, and reopen 'Change profile image'.
2. Sign out explicitly, sign in as U2, and open 'Change profile image'.
3. Sign back in as U1 and repeat step 1. A2 approves; reopen the dialog and click 'Save image'.
4. Mobile as U1: change the name and the photo (consent unchecked) and tap 'Save profile' (held). Kill and relaunch the app, then open Edit profile.
5. Mobile: sign out, sign in as U2, and open Edit profile.
6. In a private window with site data blocked, repeat step 1.

**Expect:** Step 1 reopens with the held image and the note 'This is the image you last submitted. If it is waiting for review, save it again after it is approved.' In step 2 U2 sees only their own image, because U1's draft was deleted on sign-out. Step 3 publishes without a new review and clears the draft. Step 4 restores the held name and photo with 'We restored the changes you last submitted for review. Save them again once they are approved.' Step 5 shows no U1 values. In step 6 the editor still works but nothing is remembered. Drafts older than 30 days are discarded. Known open issue I073 (mitigated): drafts exist only on that device or browser, and there is no server-side 'apply approved version'.

**Needs:** Cloudinary

**Source:** `apps/web/src/lib/publicationDrafts.ts`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/mobile/src/lib/publicationDrafts.ts`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/context/AuthContext.tsx`

## PROFILE-N007 · P2 · The agreement notice follows the server's acceptance status without re-login

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 is signed in on web and mobile with a current acceptance. Staging DB write access.

**Steps:**

1. GET /api/v1/profile/legal-acceptance as U1.
2. Engineer: unset U1's legalAcceptance on staging while U1 stays signed in.
3. Web: switch to another tab and back after at least 60 seconds, or immediately try to save a name change.
4. Mobile: background and then foreground the app.
5. Accept on /account-agreement (web) or through 'Review agreement' (mobile), then GET the status again.

**Expect:** Step 1 returns {current:true, requiredVersion:'<current version>', record:{version, acceptedTerms, ageConfirmed, acceptedAt}} with Cache-Control no-store. After step 2, web shows 'Please review the account agreement before publishing or uploading content.' on the next focus or visibility refresh; a publishing attempt returns 428 and shows the banner at once. Mobile shows 'Review the account agreement before publishing or uploading content.' after foregrounding. After accepting, both notices disappear and the status returns current:true. A status fetched for one account never applies to another after switching users.

**Needs:** Staging DB write access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/web/src/lib/api.ts`, `apps/mobile/src/lib/agreementStatus.ts`, `apps/mobile/src/components/AccountAgreementNotice.tsx`

## PROFILE-N009 · P2 · Staff resolve activity emails awaiting a delivery check

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Staging DB access to create at least 2 ActivityAlertDelivery rows with status 'review' and channel 'email' (see PROFILE-040). A1 and A2 are admins; U1 is a member.

**Steps:**

1. A1: action centre > 'Activity emails needing a delivery check', which opens /activity-email-review ('Activity email checks' under Platform).
2. Inspect an item.
3. Type a 19-char note, then a note of >= 20 chars, and click 'Mark delivered'.
4. On a second item, click 'Give up on this email'.
5. A2, on a stale page, tries to resolve the first item again.
6. As U1: GET /api/v1/admin/activity-deliveries and PATCH /api/v1/admin/activity-deliveries/<id>.
7. Check the audit log and the action-centre count.

**Expect:** The page shows a 'Waiting for a check' count and the info alert explaining that the page cannot re-send. Each item shows the title, the idempotency key 'activity/<id>', first attempt, attempt count and last error, and never the recipient address or body. The buttons are disabled below 20 characters. 'Mark delivered' shows 'Marked delivered.' and 'Give up on this email' shows 'Email given up. It will not be sent.'; both remove the item. The stale resolve returns 409 'This email is no longer waiting for a delivery check. Refresh the list.' U1 gets 403. Audit rows 'activity_email.delivered' and 'activity_email.suppress' carry the note, and the action-centre count drops.

**Needs:** Staging DB access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActivityDeliveryRoutes.ts`, `apps/admin/src/pages/ActivityEmailReviewPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## PROFILE-N010 · P2 · Activity alerts state the tip-inclusive charge, the net sent after fees, and rejected or cancelled payouts

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** U2 has turned on 'Donations you make' (in-app and email). C1 owns a campaign and has turned on 'Withdrawals and payouts' and 'Donations received'. Paystack test keys and test transfers.

**Steps:**

1. U2 donates GHS 50.00 plus a GHS 5.00 optional platform tip to C1's campaign.
2. Check U2's and C1's inbox items and emails.
3. C1 completes a creator or campaign withdrawal that has a fee.
4. C1 requests a payout, and A1 clicks 'Reject payout' in admin Payouts. C1 requests another and clicks 'Cancel request'.
5. Replay the related webhooks.

**Expect:** U2 receives 'Your donation is confirmed' with 'Your donation of GHS 50.00 to “<title>” is confirmed. Total charged: GHS 55.00, including a GHS 5.00 optional platform tip. This payment confirmation is not a charitable tax certificate.' C1's owner alert says 'A supporter donated GHS 50.00 to “<title>”.' and never mentions the tip. The completed withdrawal adds '<currency> <net> was sent after <currency> <fee> in fees.' The rejected and cancelled requests arrive as 'Your withdrawal is rejected' and 'Your withdrawal is cancelled', not 'failed'. Each state produces exactly one item or email, including after replays.

**Needs:** Paystack test keys and transfers; Resend for emails

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `packages/types/src/activity-alerts.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`

## PROFILE-N011 · P2 · Native users open a member's public profile from a campaign comment

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Campaign X has comments from U2 (public), U3 (profile hidden) and a deleted account ('Former member'). U1 is signed in on the mobile builds.

**Steps:**

1. Open campaign X > comments. Tap U2's name, then U2's avatar.
2. Go back and tap U3's name.
3. Check the deleted account's comment.
4. With VoiceOver or TalkBack on, focus U2's avatar.
5. On U3's screen, tap 'Block user', then open Settings > Blocked users.

**Expect:** Both U2's name and avatar open /profile/<U2 id>, showing name, country, TrustBadge, Report and 'Block user'. U3's screen shows 'This profile is not available.' and still offers Report and 'Block user'. The deleted account's name and avatar are not links. The screen reader announces 'View <name>'s profile' as a link. Blocking from the unavailable screen works, and U3 appears in Blocked users.

**Needs:** None

**Source:** `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/app/profile/[id].tsx`, `apps/mobile/src/components/UserSafetyControls.tsx`
