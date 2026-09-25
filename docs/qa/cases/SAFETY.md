# Trust & safety (89 cases)

Reports, blocking, the staff safety queue, publication reviews, restrictions and appeals, AI writing safety.

[Back to the QA plan](../README.md)

## SAFETY-01 · P0 · Report a campaign comment (web) lands in admin safety queue with evidence snapshot

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Users Ama (campaign owner of ACTIVE campaign C1) and Kofi (commenter) and Yaw (reporter), all with current account agreement. Kofi has a published comment on C1. ADMIN-1 account.

**Steps:**

1. As Yaw, open app.ujimora.com/campaigns/<C1 id>, open the Comments tab.
2. On Kofi's comment click 'Report'. Confirm dialog title 'Report a safety concern' and disclosure text about identity not shown.
3. Leave 'Report about' = 'This comment', Reason = harassment, type 9 characters in 'What happened?'; confirm 'Send report' is disabled.
4. Type a 10+ character description and click 'Send report'.
5. As ADMIN-1 open admin /safety-reports (Status: pending).

**Expect:** Web shows caption 'Report received for moderation review.' API returns 201 {status:'pending'}. Admin card shows 'comment: harassment', 'User <Kofi id>', description, and 'Reported content snapshot' containing JSON with authorName, authorAvatarUrl and comment text. safetyreports document has reporterId=Yaw, targetUserId=Kofi, campaignId=C1, priority normal.

**Needs:** None external

**Source:** `apps/web/src/components/safety/ReportContent.tsx`, `apps/web/src/components/campaigns/CampaignComments.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## SAFETY-02 · P0 · Report the comment author as a user (This user selector) and report a campaign update

*Surfaces:* admin, android, api, ios, web  ·  *Type:* cross-platform

**Before:** As SAFETY-01. Ama has posted a published campaign update on C1.

**Steps:**

1. As Yaw on web comments, click 'Report' on Kofi's comment, switch 'Report about' to 'This user', reason spam, submit.
2. On the Updates section of C1, click 'Report' under Ama's update, reason fraud, submit.
3. Repeat both on iOS and Android campaign screen (campaign/[id]) via CampaignComments and CampaignUpdatesList Report buttons.
4. As ADMIN-1 view /safety-reports.

**Expect:** User report card shows targetType 'user' with evidence = Kofi's name plus any creator displayName/tagline/bio. Update report card shows 'campaign_update' with snapshot JSON of title/content/mediaUrls and a targetDigest stored. Report buttons are not shown on your own comment/update. Native sends identical payloads and shows 'Report received for moderation review.'

**Needs:** Signed iOS/Android builds on physical devices

**Source:** `apps/web/src/components/campaigns/CampaignUpdates.tsx`, `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/src/components/CampaignUpdatesList.tsx`, `apps/mobile/src/components/ReportContent.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## SAFETY-04 · P0 · Report a live broadcast from the watch page (web + native)

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Ama has an active live session S1 on C1 (LIVEKIT_* configured). Yaw signed in.

**Steps:**

1. As Yaw open app.ujimora.com/live/<S1> (and native live/[sessionId]).
2. Click 'Report' in the safety controls, reason violence, description, 'Send report'.
3. As ADMIN-1 open /safety-reports.

**Expect:** Report created with targetType 'live', targetUserId=Ama, campaignId=C1, evidence 'Live session: <title> / Status / Started'. Admin card shows 'End broadcast at provider' button. Guests (logged out) see no Report/Block controls.

**Needs:** LiveKit credentials (LIVEKIT_URL/API_KEY/API_SECRET)

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## SAFETY-10 · P0 · Urgent reports sort first and are flagged

*Surfaces:* admin, web  ·  *Type:* compliance

**Before:** ADMIN-1; several existing normal pending reports created earlier.

**Steps:**

1. As Yaw, report a comment with reason child_safety; another with credible_threat.
2. Open admin /safety-reports (pending).

**Expect:** The two new reports appear at the top of page 1 with a red 'urgent' chip despite being newest; normal reports follow oldest-first.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `docs/compliance/MODERATION_OPERATIONS.md`

## SAFETY-11 · P0 · Reporter identity never exposed to reported user

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** Yaw reported Kofi (SAFETY-01/02).

**Steps:**

1. As Kofi browse C1, Settings, Publication reviews, notifications; inspect network responses.
2. As Kofi call GET /api/v1/admin/safety-reports and GET /api/v1/safety/blocks.

**Expect:** No UI or API response available to Kofi contains Yaw's id or the report. Admin endpoints return 403 'Insufficient permissions'. Only admin queue payload contains reporterId.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`

## SAFETY-14 · P0 · Native 'Report Campaign' dialog submits a valid reason and prompts sign-in when signed out

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** Signed native build. Yaw is signed in. C1 is active and owned by Ama. Also test while signed out.

**Steps:**

1. As Yaw on campaign/[C1], scroll to the bottom and tap 'Report Campaign'.
2. Check the 'Report campaign' dialog: disclosure text, a Reason picker and 'Additional details (optional)'. Confirm 'Send report' stays disabled until a reason is picked.
3. Pick 'Misleading information', enter details, tap 'Send report'. Capture the request and response.
4. Leave and reopen campaign/[C1], then report again with any reason.
5. As Ama, open campaign/[C1] (her own campaign).
6. Sign out, open campaign/[C1], tap the report control, and sign in as Yaw.
7. As ADMIN-1, open admin /campaign-reports.

**Expect:** Reason options: Fraudulent activity, Misleading information, Inappropriate content, Spam, Illegal activity, Intellectual property or copyright, Privacy violation, Other. Disclosure: 'Reports are reviewed by Ujimora moderators. The campaign creator is not told who reported it. If someone is in immediate danger, contact local emergency services.' The app sends POST /api/v1/campaigns/<C1>/report with {reason:'misleading', description} and gets 201 'Report submitted'. The button is then replaced by 'Thank you. Our team will review this campaign.' The second report shows the server message 'You have already reported this campaign' inside the dialog. The creator sees no report control. When signed out, the control reads 'Sign in to report this campaign', and after sign-in the app returns to campaign/[C1]. The report appears in admin Campaign reports as 'Misleading information'.

**Needs:** Signed iOS/Android builds

**Source:** `apps/mobile/src/components/ReportCampaign.tsx`, `apps/mobile/src/lib/campaignReport.ts`, `apps/mobile/app/campaign/[id].tsx`, `packages/types/src/campaign.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`

## SAFETY-15 · P0 · Staff triage campaign reports in the admin 'Campaign reports' queue

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** At least two pending campaign reports on C1, from SAFETY-13 (web) and SAFETY-14 (native). ADMIN-1. Yaw is one of the reporters.

**Steps:**

1. As ADMIN-1, check the 'Campaign reports' badge under the sidebar group 'Trust & Safety', the TopBar action total, and the Dashboard 'Needs attention' item 'Campaign reports from supporters'.
2. Open /campaign-reports with Status: pending and inspect a card.
3. Type 19 characters of review notes and confirm 'Mark reviewed' and 'Dismiss' are disabled. Type 20+ characters and click 'Mark reviewed'.
4. Dismiss the second report with 20+ characters of notes.
5. Switch Status to 'reviewed', then 'dismissed'. Use Export. Click 'Open campaign'.
6. As Yaw, open the in-app notification inbox (web bell or native).
7. As ADMIN-1, open Audit Log. Confirm the analytics page in the sidebar is now labelled 'Analytics reports'.

**Expect:** Each card shows: a reason chip (for example 'Misleading information'; 'Fraud or scam' and 'Illegal activity' are red); a 'Campaign active' chip; the campaign title linked to /campaigns/<C1>; 'Received <time> · Reporter <id>' with a link to the user; and the description or 'No details were given.' An info banner reads 'Marking a report reviewed or dismissed does not change the campaign. To stop a fraudulent campaign, open it and block it first, then record what you did here.' Decisions show 'Report marked reviewed.' or 'Report dismissed.', the card leaves the pending list, and the badge and TopBar count drop straight away. The reviewed and dismissed views show 'Reviewed <time> by <admin id>' and the notes. The export has ID, Campaign, Campaign ID, Reason, Status, Reporter, Created (UTC) and Review notes. The Audit Log has 'campaign_report.reviewed' and 'campaign_report.dismissed' rows with the notes as reason. Yaw gets one in-app notice, 'We reviewed your report' / 'Thank you for reporting this campaign. Our team has reviewed it and taken the action it considers appropriate.', linking to the campaign, with no email or push. Neither decision changes the campaign status.

**Needs:** None

**Source:** `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAdminReportRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## SAFETY-16 · P0 · Block a commenter: comments hidden in both directions and Blocked users list

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Kofi and Yaw both have published comments on C1 (owned by Ama).

**Steps:**

1. As Yaw, on C1 comments click 'Block user' on Kofi's comment.
2. Observe the list and the 'Blocked users' panel; open Settings > Privacy.
3. Sign in as Kofi on another device and open C1 comments.
4. Refresh both after 30s (auto refresh) and on window focus.

**Expect:** Yaw sees notice 'User blocked. You can unblock them below.'; Kofi's comments vanish; 'Blocked users' shows Kofi with 'Unblock Kofi'. Kofi no longer sees Yaw's comments. Comment counts/financials unchanged. Native shows alert 'User blocked'. Blocking does not create a safety report.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/CampaignComments.tsx`, `apps/web/src/components/safety/BlockedUsers.tsx`, `apps/mobile/src/components/CampaignComments.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicProfileVisibility.ts`, `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`

## SAFETY-18 · P0 · Block effects on donations, leaderboard and updates preserve money totals

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Kofi (named, approved) donated GHS 100.00 to C1 and appears on the leaderboard; Ama has an update on C1. Record C1 raisedAmount and donor count first.

**Steps:**

1. As Ama block Kofi.
2. As Ama view C1 donation history, recent donations, /leaderboard.
3. As Kofi view C1 updates list.
4. Compare C1 raised total, donor count, and leaderboard totals before/after.

**Expect:** Ama sees Kofi's donation as 'Anonymous' with no message but amount GHS 100.00 unchanged; Kofi excluded from Ama's leaderboard view; Kofi sees no updates authored by Ama. Campaign raisedAmount, donation count and ledger unchanged. Third users (Yaw) still see Kofi's approved attribution.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ListCampaignDonationsUseCase.ts`, `apps/api/src/application/use-cases/ListRecentDonationsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/api/src/application/use-cases/GetCampaignUpdatesUseCase.ts`

## SAFETY-20 · P0 · Block the host from a live watch page evicts the viewer

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** LiveKit configured; Ama broadcasting S1; Kofi watching signed in on web and native.

**Steps:**

1. As Kofi click 'Block user' on the watch page.
2. Observe video; try reloading /live/<S1>; call POST /api/v1/live-sessions/<S1>/video/viewer-token and GET /public, /events.
3. Check userblocks.providerCleanupPending for the pair.

**Expect:** Page shows 'User blocked. Manage blocked users in Settings.' and stops rendering the session. LiveKit participant 'viewer-<Kofi id>' removed within seconds; reload and token/public/events return 404 'Broadcast unavailable'. providerCleanupPending=false after enforcement. Guests still watch.

**Needs:** LiveKit Cloud credentials

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`

## SAFETY-25 · P0 · Admin safety and campaign-report endpoints and staff console access control

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Regular user Kofi with a valid web session token; ADMIN-1; a logged-out browser.

**Steps:**

1. As Kofi call: GET /api/v1/admin/safety-reports; PUT /api/v1/admin/safety-reports/<id>/review; GET /api/v1/admin/safety-reports/restrictions; POST /api/v1/admin/safety-reports/restrictions/<id>; POST /restrictions/<id>/restore; POST /live-cleanup/retry; GET /api/v1/reports; PUT /api/v1/reports/<id>/review; GET /api/v1/admin/action-center.
2. Call the same endpoints while logged out.
3. As Kofi, sign in to the admin console with the correct password.
4. Put Kofi's stored web session into the admin console's local storage and reload.
5. Navigate to /safety-reports, /campaign-reports and /publication-reviews.
6. As ADMIN-1, open the Audit Log.

**Expect:** A non-admin gets 403 'Insufficient permissions' from every endpoint, and a logged-out caller gets 401. Kofi's console sign-in fails with 'This account does not have staff access.': /auth/login with audience 'admin' returns 403 after the password and MFA checks and issues no tokens, and the console stores nothing. A stored non-admin session is treated as signed out and the guard sends the user back to login. The pages are guarded by Resource.REPORTS. The Audit Log has an 'auth.admin_console.refused' entry for Kofi's attempt.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/admin/src/context/AuthContext.tsx`, `apps/admin/src/router.tsx`

## SAFETY-27 · P0 · Hide a reported comment

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** Pending comment report on Kofi's comment K1.

**Steps:**

1. As ADMIN-1 enter notes of 19 chars; confirm action buttons disabled; enter 20+ chars.
2. Click 'Hide comment'.
3. Reload C1 comments as Yaw, Kofi, Ama, guest (web + native).
4. Check audit log.

**Expect:** Notice 'Review saved.'; report moves to resolved with resolution hide_comment. K1 disappears for everyone (deletedAt set). Audit entry action 'safety.hide_comment' with notes. Kofi's account is not restricted and can still comment (subject to review).

**Needs:** None

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignCommentRepository.ts`

## SAFETY-28 · P0 · Hide a reported campaign update; author cannot edit or restore it

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Pending campaign_update report on Ama's update U1 (unchanged since report).

**Steps:**

1. As ADMIN-1 click 'Hide campaign update' with notes.
2. As guest and Yaw reload C1 updates.
3. As Ama PUT /api/v1/campaigns/<C1>/updates/<U1> with new content; also try pin and delete.

**Expect:** Update hidden for all viewers; campaignupdates doc has deletedAt, deletedBy=ADMIN-1, moderationReportId=report id. Ama's edit/pin/delete return 404 'Campaign update not found'. Audit 'safety.hide_update'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/application/use-cases/UpdateCampaignUpdateUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignUpdateRepository.ts`

## SAFETY-30 · P0 · Hide a donor/supporter message removes it from every projection; money unchanged

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** Approved donation D1 message on C1 (and a live session S1 showing donor messages); approved tip T1 message. Record C1 totals and creator balance.

**Steps:**

1. As ADMIN-1 on D1 report click 'Hide message'; on T1 report click 'Hide message'.
2. Check C1 donation history, recent donations widget, live overlay (/live-sessions/<S1>/overlay/view) and SSE replay, creator page tips list (web/native).
3. As Kofi POST /api/v1/donations/<D1>/message with a new message.
4. Compare totals, donation amount, creator balance and ledger.

**Expect:** Message text removed everywhere (message unset, messageHiddenAt set, publicContentStatus pending); names follow review rules. Kofi's re-add returns 404 'Donation not found'. Amounts, raised total, creator balance and ledger entries unchanged. Audit 'safety.hide_message'.

**Needs:** Paystack test keys; LiveKit optional for overlay

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`

## SAFETY-31 · P0 · Restrict publishing: every public write is refused with the appeal message

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** Pending user report on Kofi. Kofi owns campaign C2, has a creator page, current agreement.

**Steps:**

1. As ADMIN-1 click 'Restrict publishing' with notes.
2. As Kofi attempt: post a comment; create a campaign update on C2; create a new campaign; change campaign slug; start a live session and request host token; save creator profile edits; change display name/avatar in Profile; make profile public in Settings; upload a campaign image; update organization-team profile; add a donation message (POST /donations/:id/message).
3. Try each on web and native.

**Expect:** Each write returns 403 'Publishing is restricted following a moderation review. Contact support@ujimora.com to appeal. Your account settings and funds remain accessible.' (or 'Publishing is restricted...' from the use case). UI shows the error. contentrestrictions doc exists with reason, restrictedBy, reportId. Audit 'safety.restrict_user'.

**Needs:** Cloudinary (upload attempt)

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionCreation.ts`

## SAFETY-32 · P0 · Restricted user is hidden from public identity surfaces

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Kofi restricted (SAFETY-31) with previously published comments, updates, approved donation attribution, creator page, org or member public profile, active live session.

**Steps:**

1. As guest and as Yaw view C1 comments/updates, donation history, leaderboard, /creators/<Kofi handle>, native profile/[Kofi id], live watch page for Kofi's session, C2 campaign page.

**Expect:** Kofi's comments/updates hidden, donations shown as Anonymous (amounts intact), excluded from leaderboard, creator page 404 'Creator not found', profile hidden, live 'Broadcast unavailable'. Note: C2 campaign page itself remains visible and fundable (restriction is not a campaign block) — confirm with policy owner; use Admin > Campaigns > Block campaign to take it down.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicProfileVisibility.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`

## SAFETY-33 · P0 · Restricted user keeps settings, KYC, funds, data rights and message-free checkout

*Surfaces:* api, ios, web  ·  *Type:* functional

**Before:** Kofi restricted; Kofi has wallet balance and creator balance; Paystack test keys.

**Steps:**

1. Update phone and bio in Profile; toggle notification/anonymous settings.
2. Upload a KYC document (folder=kyc) on /kyc.
3. Request a creator withdrawal / view wallet.
4. Submit a data-rights request and view Settings > Delete account.
5. Donate to another campaign without a message; then with a message.
6. Tip a creator with and without a message (web).
7. Set creator tips off via exact {tipsEnabled:false}.

**Expect:** Phone/bio/settings, KYC upload, wallet/withdrawal, data rights and deletion all work. Message-free donation/tip succeed with correct amounts. With a message: 403 'Publishing is restricted following a moderation review. Remove the public message to continue donating...' and no payment intent/Paystack init created. tipsEnabled:false pause succeeds.

**Needs:** Paystack test keys; Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `docs/compliance/MODERATION_OPERATIONS.md`, `docs/compliance/CONTENT_MESSAGES.md`

## SAFETY-35 · P0 · Restore publishing after appeal

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Kofi was restricted through a resolved report whose comment was hidden. Kofi also has earlier published comments that were not hidden. ADMIN-1 is not Kofi.

**Steps:**

1. In /safety-reports with Status=resolved, find the restrict_user report. Confirm 'Restore publishing after appeal' stays disabled until the new notes reach 20 characters.
2. Enter notes and click the button.
3. As Kofi, post a comment (with consent) and edit the profile. Repost the exact text of the hidden comment. View C1 as Yaw.
4. Click 'Restore publishing after appeal' again. Open Community safety > Restricted users and the Audit Log.

**Expect:** The page shows 'Publishing restriction removed. Previously hidden comments and messages remain hidden.' The contentrestrictions document is deleted, and contentrestrictionevents gains a 'restore' entry with liftedReason and liftedReportId. One audit row 'safety.restore_public_content' is written, with the notes as reason and the change 'publishingRestriction: <reason> (report <id>) -> lifted'. Kofi can publish again, subject to publication review. His earlier comments that were not hidden reappear. The comment a moderator hid stays hidden, and reposting its exact text returns 422 because its approval was declined. Kofi no longer appears under Restricted users. The second restore returns 'This account has no active publishing restriction.' (404) and writes no second audit row. No inbox notice is sent on restore, so support confirms the appeal outcome by email.

**Needs:** None

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/database/models/ContentRestrictionEventModel.ts`

## SAFETY-37 · P0 · End broadcast at provider from a live report

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** LiveKit configured; Ama broadcasting S1 with viewers on web and native; pending live report.

**Steps:**

1. As ADMIN-1 click 'End broadcast at provider' with notes.
2. Observe host and viewers; reload watch page; OBS overlay URL; host requests new host token.
3. Check livesessions doc.

**Expect:** Session status ended, moderationStoppedAt set, overlayToken cleared, privacyMode true, providerStopPending false after success; host identity removed and room closed at LiveKit; viewers disconnected; watch/overlay/events return 404 'Broadcast unavailable'. Report resolved 'stop_live'; audit 'safety.stop_live'.

**Needs:** LiveKit Cloud credentials

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## SAFETY-44 · P0 · Comment without screening consent is held privately for staff review

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Esi-free user Kofi with no avatar, current agreement. OpenAI key configured.

**Steps:**

1. On C1 comments leave 'Use OpenAI to check this public text for safety (optional)' unchecked; type a comment; 'Post comment'.
2. Check public comments as Yaw.
3. As Kofi open Settings > Privacy > Publication reviews.
4. As ADMIN-1 open /publication-reviews (Publication proposals, pending).

**Expect:** API 409 'Saved privately for safety review. Your content has not been published...' shown in UI; draft text retained in the box. No comment visible publicly. Kofi sees 'comment create - pending' with reference id. Admin sees item reason 'staff requested' with authorName and comment. No OpenAI call made.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/campaigns/CampaignComments.tsx`, `apps/web/src/components/account/PublicationReviews.tsx`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## SAFETY-45 · P0 · Comment with consent and clean text auto-approves and publishes

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Kofi with no avatar; OPENAI_API_KEY valid.

**Steps:**

1. Check the OpenAI consent box, post a benign comment.
2. Check publicationreviews doc and C1 comments as Yaw.
3. Confirm the consent box resets to unchecked after posting.

**Expect:** Comment appears immediately. publicationreviews has status approved, reviewedBy 'automated:openai', automatedConsentAt set, approvalExpiresAt ~7 days. Consent checkbox unchecked again.

**Needs:** OpenAI API key (moderation endpoint)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiPublicationScreener.ts`

## SAFETY-46 · P0 · Flagged or unavailable screening never publishes, and screener outages are logged

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Kofi has no avatar. An approved synthetic test string that OpenAI moderation flags (for example an explicit violent threat fixture). A staging environment where OPENAI_API_KEY can be blanked, with access to the API logs.

**Steps:**

1. With consent, post the flagged fixture as a comment.
2. Blank OPENAI_API_KEY (or set an invalid key) with NODE_ENV=production and redeploy. Check the boot logs.
3. Post a benign comment with consent.
4. Check the admin queue reasons and the API logs.

**Expect:** Both comments return the 409 held message and nothing is published. The admin queue shows reason 'flagged' for the first and 'unavailable' for the second. A provider failure never auto-approves. On boot without a key, the log shows the error 'OPENAI_API_KEY missing: publication screening disabled; opted-in submissions go to staff review'; the deploy still starts. Every failed screening logs the warning 'Publication screener unavailable; routed to staff review' with the fingerprint and action. With an invalid key (no boot error), only the per-request warnings appear.

**Needs:** OpenAI API key; staging env control; log access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiPublicationScreener.ts`, `apps/api/src/app.ts`, `render.yaml`

## SAFETY-48 · P0 · Exact-version approval: resubmit same text within 7 days publishes; changes need new review

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** Held comment from SAFETY-44 (pending).

**Steps:**

1. As ADMIN-2 in /publication-reviews enter 20+ char notes, 'Approve this version'.
2. As Kofi refresh Publication reviews: see status approved, 'Review response', 'Approval expires <date>'.
3. Post the exact same comment text again.
4. Post the same text with one character changed.
5. Change Kofi's display name, then post the originally approved text.

**Expect:** Exact resubmission publishes (201). Changed text and changed name each create a new pending review (409 held). Comment content is trimmed, so leading/trailing whitespace alone does not break the match.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/web/src/components/account/PublicationReviews.tsx`

## SAFETY-49 · P0 · Declined version stays declined; author sees notes and appeal path

*Surfaces:* admin, api, ios, web  ·  *Type:* compliance

**Before:** A pending publication review for Kofi.

**Steps:**

1. As ADMIN-2 'Decline this version' with notes.
2. As Kofi resubmit the identical content.
3. Check Publication reviews copy.

**Expect:** Resubmission returns 422 'This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.' Author sees status rejected and review notes plus reference id. Confirm support@ujimora.com is monitored for appeals.

**Needs:** Support mailbox

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/account/PublicationReviews.tsx`

## SAFETY-53 · P0 · Campaign creation held for content review, then separate financial review

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Verified organizer Ama; cover image available; plan allows new campaign. One draft with goal GHS 5,000 and one with goal GHS 300,000.

**Steps:**

1. Web /campaigns/new: complete steps, leave consent unchecked, submit (GHS 5,000, with cover image).
2. Confirm the PublicationReviews panel appears on step 3 and no campaign exists in My Campaigns.
3. As ADMIN-2 approve the proposal (reason 'media').
4. Resubmit the unchanged draft.
5. Repeat with GHS 300,000 goal on native campaign/create.

**Expect:** First submit 409 held; no campaign/split/invite created. After approval exact resubmission creates the campaign; GHS 5,000 follows tier rules; GHS 300,000 lands in pending_review for staff financial approval (unless verified returning organizer) and appears in action center 'Campaigns awaiting review'. Content approval does not grant financial approval.

**Needs:** Cloudinary; OpenAI optional

**Source:** `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`, `docs/compliance/PUBLICATION_REVIEWS.md`

## SAFETY-57 · P0 · Approval does not bypass later restriction or missing agreement

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Kofi has an approved, unexpired comment version.

**Steps:**

1. Restrict Kofi (via report), then resubmit the approved comment.
2. Restore Kofi; set Kofi's legalAcceptance to an older version (staging), resubmit.

**Expect:** Restricted: 403 'Publishing is restricted...'. Outdated agreement: 428 'Review the current account agreement and confirm you are at least 18...' and web/native show the Account agreement notice linking to /account-agreement. After accepting, resubmit publishes.

**Needs:** Staging MongoDB access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/authMiddleware.ts`, `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/mobile/src/components/AccountAgreementNotice.tsx`

## SAFETY-60 · P0 · Donor name/message pending until staff approval; decision never moves money

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** Paystack test keys. Kofi donates GHS 25.00 to C1 with name shown and message 'Stay strong'. Guest donates with name and message.

**Steps:**

1. After settlement, view C1 donation history and live overlay as Yaw.
2. As ADMIN-1 open /publication-reviews?queue=donation-content-reviews (pending); inspect text.
3. Approve Kofi's item with notes; reject the guest's item.
4. Recheck public views and C1 totals.

**Expect:** Before approval donations show as Anonymous with no message; amounts included in totals. Queue shows exact name/message JSON, no email. After approval Kofi's name/message appear everywhere; rejected guest stays Anonymous. Raised total, donation amounts and ledger identical before/after decisions. Audit donation.content.approved/rejected.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationContentReviewRoutes.ts`, `apps/api/src/domain/entities/donationPublicContent.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`, `docs/compliance/DONATION_CONTENT_REVIEW.md`

## SAFETY-62 · P0 · AI writing requires fresh consent per request

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** AI_WRITING_ENABLED=true, OPENAI_API_KEY set; Ama on /campaigns/new story step (web) and native campaign/create step 1.

**Steps:**

1. Confirm 'Get suggestion' / 'Generate preview' disabled until 'I agree to send this text and instructions to OpenAI for this suggestion.' is checked.
2. Generate once; confirm checkbox unchecks after the request.
3. POST /api/v1/ai-writing without consentToExternalProcessing or with false.

**Expect:** Button disabled without consent; checkbox resets after each request. API returns 400 'Validation failed' before quota or provider use (quota unchanged). aiusages record includes consentProvider 'OpenAI' and consentVersion, no raw text.

**Needs:** OpenAI API key

**Source:** `apps/web/src/components/campaigns/AiWritingAssistant.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/aiWritingRoutes.ts`, `apps/api/src/application/services/AiWritingService.ts`

## SAFETY-64 · P0 · AI input/output screening withholds flagged drafts and fails closed

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Approved synthetic flagged fixture text; staging where OpenAI can be made unreachable.

**Steps:**

1. Submit the flagged fixture as story text.
2. Make moderation endpoint fail (invalid key) and submit benign text.
3. Set AI_WRITING_ENABLED=false and reload the assistant.
4. Check remaining quota after each failure.

**Expect:** Flagged: 422 'This writing request or suggestion needs safety review and cannot be returned...'; no text returned. Provider failure: 502/503 generic message, no draft. Disabled: 'AI writing is currently unavailable. You can continue writing your story below.' (native: 'Writing assistance is not currently available.') and POST 503. Failed/flagged attempts still consume quota (per design); aiusages status 'error'.

**Needs:** OpenAI API key; staging env control

**Source:** `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiContentModerator.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiWritingProvider.ts`, `apps/api/src/application/services/AiWritingService.ts`, `docs/compliance/AI_SAFETY.md`

## SAFETY-70 · P0 · Store UGC walkthrough on physical devices (Apple 1.2 / Play UGC)

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Signed release-candidate builds on an iPhone and an Android device. A non-admin reviewer account. A seeded campaign with comments, updates, approved donor messages, a creator page and a live session.

**Steps:**

1. Sign up and confirm the terms and 18+ acknowledgement start unchecked and must be accepted before any posting.
2. Post a comment (held or approved). Report a comment, a user, an update, a donor message and a live stream. Report the campaign with the 'Report Campaign' dialog (pick a reason).
3. Tap a comment author's name to open their member profile and use Report/Block there.
4. Block a commenter and a creator/host and confirm their content disappears. Unblock in Settings.
5. Open Settings > Publication reviews and Blocked users.
6. Check VoiceOver/TalkBack labels on Report/Block controls, the report dialogs and the comment-author profile links.
7. Confirm contact information (support and trust email) is reachable in-app. Sign out and check that the campaign report control reads 'Sign in to report this campaign'.

**Expect:** Every content report succeeds with 'Report received for moderation review.' The campaign report succeeds with 'Thank you. Our team will review this campaign.'. Member profiles open from comment authors and offer Report/Block, even on 'This profile is not available.'. Blocks take effect immediately and unblocking works. The agreement comes before posting. All controls are accessible. Evidence (screenshots or video) is captured for the App Review notes.

**Needs:** Signed EAS builds; LiveKit; Paystack test keys

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `docs/compliance/MODERATION_OPERATIONS.md`, `apps/mobile/src/components/ReportContent.tsx`, `apps/mobile/src/components/ReportCampaign.tsx`, `apps/mobile/src/components/CampaignComments.tsx`

## SAFETY-72 · P0 · Moderation operations readiness drill

*Surfaces:* admin, email  ·  *Type:* compliance

**Before:** Named moderators and backup; escalation contacts for child-safety/credible threats; access to support/trust inboxes.

**Steps:**

1. Seed an urgent child_safety report at an off-hours time.
2. Measure time until a moderator acts; follow the escalation runbook in MODERATION_OPERATIONS.md.
3. Process an appeal email end-to-end (restore via admin with audit).

**Expect:** Urgent report acted on within the agreed internal target; escalation contacts reachable; appeal handled with audit trail; no response-time promise advertised in-app. Record evidence for the readiness ledger (C09).

**Needs:** Staffed moderation; support mailbox

**Source:** `docs/compliance/MODERATION_OPERATIONS.md`, `docs/compliance/READINESS.md`

## SAFETY-03 · P1 · Report an approved donor message and an approved supporter tip message

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Donation D1 on C1 by signed-in donor Kofi with message, settled via Paystack test and approved in admin donation-content queue. Tip T1 to creator handle qa-creator by Kofi with message, SUCCEEDED and approved in tip-content queue. Donation D2 with message still pending review.

**Steps:**

1. As Yaw open C1 donation history tab (web) and campaign/[id] donor list (native); click 'Report' on D1's message, reason harassment, submit.
2. Confirm D2 (pending) shows no message text and no Report button.
3. Open app.ujimora.com/creators/qa-creator; click 'Report' on T1 message; submit.
4. Via API, POST /api/v1/safety/reports with targetType donation_message and targetId=D2 id.

**Expect:** D1 and T1 reports succeed (201) and appear in the admin queue with the message as evidence and targetUserId=Kofi. D2 API call returns 404 'Message not found' (unapproved content cannot be reported). Creator page tip list shows 'Supporter' label for unapproved tips.

**Needs:** Paystack test keys (to settle donation/tip)

**Source:** `apps/web/src/components/campaigns/CampaignDonationHistory.tsx`, `apps/web/src/pages/CreatorTipPage.tsx`, `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/app/creators/[handle].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/domain/entities/donationPublicContent.ts`

## SAFETY-05 · P1 · Report and block from member/organization profiles (native and web) and the web creator page

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Public member profile for Kofi; organization account ORG with a public org page and at least one public campaign; creator page qa-creator for Ama. Yaw signed in on web and native; a guest browser; the ORG account can sign in.

**Steps:**

1. On iOS/Android open profile/[Kofi id]; tap 'Report' (user), submit; then tap 'Block user'.
2. Open organization/[ORG id] on native; tap 'Report'; submit.
3. On web open /creators/qa-creator; click 'Report' then 'Block user'.
4. On web open /organizations/<ORG slug> as Yaw. Confirm 'Report' and 'Block user' appear in the action row next to Share/Website, and that there is no 'Follow' button and no 'Followers' count. Click 'Report', pick a reason, enter 10+ characters, click 'Send report'.
5. Click 'Block user' on the web organization page. Then reload the page and open /organizations.
6. Open the same organization page as a guest and as the ORG account itself.

**Expect:** Native profile and organization reports create targetType 'user' reports (201) and show 'Report received for moderation review.'; blocking shows the blocked state. On the web creator page, blocking shows 'User blocked. Manage blocked users in Settings.' with 'Open settings'. On the web organization page, the report creates a safety report with targetType 'user' and targetUserId = ORG id. After 'Block user' the page switches to 'Organization not found' with 'You blocked this organization, so its profile is hidden from you.' and a back button to /organizations. Because organization reads are block-filtered, a reload returns 404 for Yaw and ORG is missing from Yaw's /organizations directory. Guests and the ORG account see no Report or Block controls. Settings > Blocked users lists ORG.

**Needs:** Signed native builds

**Source:** `apps/mobile/app/profile/[id].tsx`, `apps/mobile/app/organization/[id].tsx`, `apps/web/src/pages/CreatorTipPage.tsx`, `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`

## SAFETY-06 · P1 · Report input validation and logged-out access

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Yaw signed in; a guest browser; API client (curl/Postman) with Yaw's bearer token.

**Steps:**

1. POST /api/v1/safety/reports with reason 'abuse' (not in enum).
2. POST with description of 9 characters; then 2001 characters.
3. POST with targetId 'abc' (not 24-hex).
4. POST with targetType 'campaign' (not allowed).
5. Logged out: open C1 comments and look for Report; POST without Authorization header.

**Expect:** Invalid enum/short/long/bad id/unknown type each return 400 'Validation failed'. Guests see 'Sign in to join the conversation.' and no Report buttons; API returns 401 'Authentication required'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`

## SAFETY-08 · P1 · Duplicate/double-tap reports are idempotent; re-report allowed after review

*Surfaces:* admin, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Kofi comment K1; Yaw signed in.

**Steps:**

1. As Yaw, quickly double-click 'Send report' (or send two concurrent POSTs with same targetType/targetId).
2. Check admin queue and DB count for reporterId=Yaw,targetId=K1,status=pending.
3. As ADMIN-1 Dismiss the report with 20+ char notes.
4. As Yaw report K1 again.

**Expect:** Both requests return 201 with the same report id; exactly one pending report exists. After dismissal a new report is accepted and creates a new pending document (partial unique index only covers pending).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/database/models/SafetyReportModel.ts`

## SAFETY-12 · P1 · Guest donor message report cannot restrict an account

*Surfaces:* admin, web  ·  *Type:* negative/edge

**Before:** Guest (logged-out) donation D3 on C1 with message, settled and approved in donor-content queue.

**Steps:**

1. As Yaw report D3's message.
2. As ADMIN-1 open the report card.

**Expect:** Card caption reads 'Guest message; no verified account'. 'Restrict publishing' button is disabled; PUT action restrict_user via API returns 400 'This report has no verified author account to restrict...'. 'Hide message' works.

**Needs:** Paystack test keys

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## SAFETY-13 · P1 · Web 'Report Campaign' on /campaigns/:id and /c/:slug: happy path, new reasons, duplicates, own campaign, logged out

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** C1 is owned by Ama and has a slug. Yaw and Esi are signed in on separate browsers. A guest browser. ADMIN-1.

**Steps:**

1. As a guest, open /campaigns/<C1> and click 'Report Campaign'. Then open /c/<slug> and click 'Report campaign'.
2. As Yaw on /campaigns/<C1>, click 'Report Campaign' and open the reason list. Confirm it includes 'Intellectual property / copyright' and 'Privacy or likeness'. Select 'Misleading Information', add details, click 'Submit Report'.
3. As Yaw, submit a second report on C1 from /c/<slug>.
4. As Esi on /c/<slug>, report with reason 'Privacy or likeness'.
5. As Ama, POST /api/v1/campaigns/<C1>/report. Then open /c/<slug> as Ama and try 'Report campaign'.
6. As ADMIN-1, open /campaign-reports.

**Expect:** The guest is sent to /login from both pages, with the page as the return location. Yaw sees 'Thank you for reporting this campaign. Our team will review it shortly.', the dialog closes, and the API returns 201 'Report submitted'. The second report shows 'You have already reported this campaign' (409), even after staff review. Esi's report is stored with reason 'privacy'. The owner's API call returns 403 'You cannot report your own campaign', and the /c/:slug dialog shows the same message; /c/:slug shows no organiser Report/Block controls to the owner. Both reports appear in admin Campaign reports.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `packages/types/src/campaign.ts`

## SAFETY-17 · P1 · Blocked users cannot comment on each other's campaigns

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Ama (owner of C1) blocks Kofi via PUT /api/v1/safety/blocks/<Kofi id>. Separately Kofi blocks Ama on a fresh pair.

**Steps:**

1. As Kofi post a comment on C1.
2. Reverse direction: Kofi blocks Ama, then Kofi tries to comment on C1.

**Expect:** Both directions return 403 'You cannot comment on this campaign'; no publication review or comment is created.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoUserBlockRepository.ts`

## SAFETY-19 · P1 · Block a creator: creator page hidden and tip checkout refused for blocked signed-in user

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Ama has creator page qa-creator with tips enabled (paid plan). Kofi signed in. Paystack test mode.

**Steps:**

1. As Kofi open /creators/qa-creator, click 'Block user'.
2. Reload /creators/qa-creator.
3. POST /api/v1/creators/qa-creator/tips as Kofi (amount 10, email).
4. Log out and open the page / start a tip as guest.
5. As Ama (reverse) block Kofi and have Kofi load the page.

**Expect:** After block, page shows 'User blocked...'; reload returns 'Creator not found' (404). Tip POST returns 404 'Creator not found'; no tip or Paystack init created. Guest can still view and tip (blocking governs signed-in identity only). Reverse block also yields 404 for Kofi.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`, `apps/api/src/application/use-cases/GetCreatorByHandleUseCase.ts`, `apps/web/src/pages/CreatorTipPage.tsx`

## SAFETY-21 · P1 · Block while LiveKit is unavailable queues durable cleanup and reconciles

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Active session S1 with host token issued; temporarily set LIVEKIT_URL invalid (staging only) so video.enabled is false.

**Steps:**

1. As Kofi (watching) block Ama.
2. Check response message and userblocks.providerCleanupPending.
3. As ADMIN-1 open /safety-reports and the action center.
4. Restore LiveKit env, redeploy/restart, wait 30s (or click 'Retry cleanup').

**Expect:** API returns 200 with data.providerCleanupPending=true and message 'User blocked. Live connection cleanup will retry.' Block still effective for API reads. Admin shows warning 'N live safety operations still need provider cleanup' and 'Live safety provider cleanup' count > 0. After recovery the reconcile loop (30s and on boot) clears the flag and count returns to 0.

**Needs:** LiveKit credentials; staging env access

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/app.ts`, `apps/api/src/main.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## SAFETY-22 · P1 · Unblock from Settings restores visibility (web and native)

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Yaw has blocked Kofi (SAFETY-16).

**Steps:**

1. As Yaw open Settings > Privacy > Blocked users; click 'Unblock Kofi'.
2. Return to C1 comments; also check native Settings.
3. Unblock again via DELETE /api/v1/safety/blocks/<Kofi id>.
4. Switch web session to another account and back.

**Expect:** Kofi removed from list; his comments reappear on refresh; Kofi sees Yaw's comments again. Repeat DELETE returns 200 'User unblocked' (idempotent). Blocked list section is hidden when empty. Blocked list is per-account and resets on account switch.

**Needs:** None

**Source:** `apps/web/src/components/safety/BlockedUsers.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`

## SAFETY-29 · P1 · Update edited after the report: hiding is refused, restricting the author still works

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Yaw reports Ama's update U1. Ama then edits U1 (an approved edit), so its digest changes. ADMIN-1 and ADMIN-2 are neither Ama nor Yaw.

**Steps:**

1. As ADMIN-1, enter 20+ characters of notes on the report and click 'Hide campaign update'.
2. Refresh the queue and confirm there is no 'Review started' banner. Click 'Restrict publishing' on the same report.
3. As a guest, reload C1 updates. Inspect the campaignupdates document for U1.
4. As ADMIN-2, lift Ama's restriction (Community safety > Restricted users > 'Lift restriction' with notes) and reload C1 updates.
5. Yaw reports the current version of U1. ADMIN-2 clicks 'Hide campaign update' on the new report.

**Expect:** Step 1 returns 409 'This update changed or was removed after the report. Resolve or dismiss this report after reviewing the current content; do not hide an unreviewed version.' The report stays pending with no reviewAction. Step 2 shows 'Review saved.', the report is resolved with resolution restrict_user, and Ama is restricted. U1 is not deleted: it has no deletedAt and no moderationReportId. It is missing from public lists only while Ama is restricted, because restricted authors' content is hidden, and it reappears with its edited text once the restriction is lifted. In step 5 the new report hides the current version (deletedAt set, audit 'safety.hide_update'). MODERATION_OPERATIONS.md documents this procedure for moderators.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicProfileVisibility.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## SAFETY-34 · P1 · Restrict via comment/message/live reports applies the linked content action

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Separate pending reports: comment by Kofi, approved donation message by Esi, live report on Ama's active session.

**Steps:**

1. Restrict publishing on the comment report.
2. Restrict publishing on the donation message report.
3. Restrict publishing on the live report (or user report of a broadcasting creator).

**Expect:** Comment hidden plus restriction; message hidden plus restriction; all active (or providerStopPending) live sessions of the restricted creator's campaigns stopped (status ended, moderationStoppedAt set, LiveKit room closed). All reports resolved with resolution restrict_user.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`

## SAFETY-38 · P1 · Stop-live with provider outage leaves a retryable in-progress review

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Active S1 with host token issued; LiveKit made unavailable (staging) after token issued.

**Steps:**

1. Click 'End broadcast at provider'.
2. Reload the queue; observe the card; try a different action (Dismiss).
3. Restore LiveKit; click 'End broadcast at provider' again (notes locked).

**Expect:** First attempt errors (503 'Restore video provider access to finish stopping this broadcast'); session already ended for new access; report stays pending with banner 'Review started: stop live. Retry that action to finish it.' and notes field disabled. Dismiss returns 409 'A different review has already started'. Retry after recovery resolves the report and clears providerStopPending.

**Needs:** LiveKit credentials; staging env control

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## SAFETY-40 · P1 · Two moderators acting on the same report concurrently

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** ADMIN-1 and ADMIN-2 both viewing the same pending comment report.

**Steps:**

1. ADMIN-1 clicks 'Hide comment' while ADMIN-2 clicks 'Dismiss' at the same time.
2. ADMIN-1 double-clicks 'Hide comment' (or resends the PUT).

**Expect:** Exactly one action wins; the other gets 409 'A different review has already started. Refresh the queue.' or 'already been reviewed'. Same-action retry is harmless (no duplicate side effects beyond audit). Final report status matches the winning action.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## SAFETY-41 · P1 · Dismiss and Resolve outcomes: in-app acknowledgement to the reporter, no email or push

*Surfaces:* admin, email, ios, web  ·  *Type:* compliance

**Before:** Three pending reports filed by Yaw: R1 and R2 about Kofi's comments, and R3 about another comment by Kofi. ADMIN-1.

**Steps:**

1. Dismiss R1 with notes. Click 'Resolve after other action' on R2.
2. Click 'Hide comment' on R3.
3. Resend the same PUT for R3 through the API.
4. Check Yaw's and Kofi's in-app notifications (web bell and native inbox), email inboxes and push.

**Expect:** R1 is dismissed and R2 resolved, with audit rows 'safety.dismiss' and 'safety.resolve'. Yaw gets one in-app notice per report (3 in total): 'We reviewed your report' / 'Thank you for your report. Our team has reviewed it and taken the action it considers appropriate.' The same text is used for dismiss, resolve and hide. Kofi gets nothing for R1 or R2. For R3 Kofi gets 'Your comment was removed' / 'A comment you posted was removed after a safety review. For details or to appeal, contact support@ujimora.com.' No notice contains staff notes, the reporter's identity, the evidence or the outcome detail. The resent PUT returns 409 'This report has already been reviewed' and creates no duplicate notice. No email or push is sent. Confirm that support has a manual process for outcome and appeal replies.

**Needs:** Email provider (to confirm nothing is sent)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## SAFETY-42 · P1 · Four eyes: a moderator cannot review reports they filed, reports about themselves, or reports on their own campaign

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** ADMIN-1 and ADMIN-2. ADMIN-1 has a public comment K8 on C1, and Yaw reports it (R1). ADMIN-1 files a report on Kofi's comment (R2). ADMIN-1 owns the active campaign C8, and Yaw reports Kofi's comment on C8 (R3).

**Steps:**

1. As ADMIN-1, enter 20+ characters of notes on R1 and click 'Dismiss'.
2. As ADMIN-1, click 'Restrict publishing' on R2.
3. As ADMIN-1, click 'Hide comment' on R3.
4. Refresh the queue and check R1 to R3.
5. As ADMIN-2, act on R1, R2 and R3.
6. As ADMIN-1, in Restricted users, try to restrict ADMIN-1's own id. Then call POST /api/v1/admin/safety-reports/restrictions/<ADMIN-1 id>/restore after ADMIN-2 has restricted ADMIN-1.

**Expect:** Steps 1 to 3 each fail with 403 'Another administrator must review this report.', shown in the error alert. The reports stay pending with no reviewAction (no 'Review started' banner) and no side effects. ADMIN-2's actions succeed. Self-restricting returns 403 'Another administrator must restrict your account.', and self-restore returns 403 'Another administrator must lift your restriction.' Operational note: a deployment with only one administrator cannot act on these reports and needs a second administrator.

**Needs:** Two administrator accounts

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## SAFETY-43 · P1 · Live cleanup retry button and background reconciliation

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** At least one livesessions doc with providerStopPending=true and/or userblocks with providerCleanupPending=true (from SAFETY-21/38).

**Steps:**

1. Open /safety-reports; note 'Live cleanup pending' stat and warning.
2. Click 'Retry cleanup' with provider still down.
3. Restore provider, click 'Retry cleanup' again; also restart API to exercise boot reconcile.

**Expect:** While down: API returns 200 'Live cleanup retry completed; check remaining queue counts' but count stays > 0 (retry is not success). After recovery count drops to 0 and action center 'live-cleanup' item goes to 0.

**Needs:** LiveKit credentials

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/main.ts`

## SAFETY-47 · P1 · Comments from avatar users: a staff-reviewed avatar is text-screened, a legacy avatar stays held as media

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** OpenAI is configured. Esi's avatar was set before this release, so it has no reviewedAvatarUrl. Abena uploads a new avatar in Profile (held as 'media'); ADMIN-2 approves it; Abena saves the same image, so users.reviewedAvatarUrl equals her avatarUrl.

**Steps:**

1. As Esi, with consent checked, post a benign comment on C1.
2. As Abena, with consent checked, post a benign comment on C1.
3. As Abena, post a comment without consent.
4. Abena removes her avatar ('Use default image', then 'Save image') and posts a comment with consent.
5. Check the admin queue and the publicationreviews documents.

**Expect:** Esi's comment is held (409) with reason 'media', because a legacy avatar must be inspected. Abena's comment with consent publishes immediately (201): the review is approved by 'automated:openai', mediaUrls is empty, and the screened text includes authorAvatarUrl. Without consent it is held (409) with reason 'staff_requested', not 'media'. After the removal, reviewedAvatarUrl is unset and the comment is screened as text only. Deploy note: comment reviews still pending from before the deploy by authors with a reviewed avatar need resubmission, because the fingerprint shape changed.

**Needs:** Cloudinary (avatar); OpenAI key

**Source:** `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/domain/entities/User.ts`, `docs/compliance/ACCOUNT_PUBLICATION.md`

## SAFETY-50 · P1 · An expired approval is re-queued for a fresh decision, not refused

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Kofi (no avatar) has two approved but unused comment reviews, A and B. Staging DB access. OpenAI is configured.

**Steps:**

1. Set approvalExpiresAt on review A to a past date.
2. As Kofi, resubmit A's exact content without consent.
3. Check Kofi's Publication reviews and admin /publication-reviews.
4. As ADMIN-2, approve A again. Kofi resubmits the exact content.
5. Set B's approvalExpiresAt to a past date. Kofi resubmits B's exact (benign) content with OpenAI consent checked.
6. Resubmit with a small change.

**Expect:** Step 2 returns 409 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.' The same review record goes back to status pending with reason 'staff_requested': reviewedBy, reviewNotes and approvalExpiresAt are cleared, and purgeAt moves to about 30 days out. It shows as pending for Kofi and appears in the admin queue and action-center count. Step 4 publishes (201). In step 5 the record is re-screened automatically: it is approved again by 'automated:openai' with a new approvalExpiresAt about 7 days out, and the comment publishes immediately (201). The changed content in step 6 creates a new pending review. The old message 'This safety approval expired...' no longer appears.

**Needs:** Staging MongoDB access; OpenAI key

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `docs/compliance/PUBLICATION_REVIEWS.md`

## SAFETY-51 · P1 · Staff publication decision rules: self-review, notes, idempotent retry, conflicts

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** ADMIN-1 authored a held comment; another pending item from Kofi.

**Steps:**

1. As ADMIN-1 try to approve own item.
2. As ADMIN-2 approve with 19-char notes.
3. As ADMIN-2 approve Kofi's item, then resend the identical PUT.
4. As ADMIN-1 PUT 'rejected' on the same item.
5. As a regular user PUT /api/v1/admin/publication-reviews/<id>/review.

**Expect:** Self-review 403 'Another administrator must review your content'. Short notes 400 'Choose a decision and enter at least 20 characters of review notes'. Identical retry 200 with no change. Conflicting decision 409 'A final decision already exists for this version'. Non-admin 403. Audit 'publication.approved' written once.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## SAFETY-54 · P1 · Campaign update create/edit held; published version stays live while edit pending

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Ama owns C1 with published update U2.

**Steps:**

1. Create Update dialog: new update without consent -> held.
2. Edit U2 content without consent.
3. View C1 as Yaw.
4. Approve the edit and resubmit exact edit; meanwhile have a teammate edit U2 first (concurrent).

**Expect:** New update not visible until approved and resubmitted. While edit is held, the original U2 text remains public. After approval exact resubmit applies; if U2 changed meanwhile, fingerprint/base version mismatch forces a new review or 409.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/UpdateCampaignUpdateUseCase.ts`, `apps/web/src/components/campaigns/CreateUpdateDialog.tsx`

## SAFETY-55 · P1 · Live session start with title held; approved resubmit starts session

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** Ama owns active C1; LiveKit configured.

**Steps:**

1. On /campaigns/<C1>/live (web) and campaign/live (native) enter title, leave consent unchecked, start.
2. Approve in admin; start again with identical title/target.
3. Start again with a different title.

**Expect:** First start returns held; no live session or overlay token created; PublicationReviews shown inline. Exact resubmit starts the session. Different title requires new review.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`

## SAFETY-56 · P1 · Profile, creator page, organization identity and vanity URL changes go through review; unchanged photos stay out of the media queue; removals apply at once

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Kofi is a member with an existing public avatar. Ama is a creator on a paid plan with an avatar. ORG has a team member. C1 has a slug. OpenAI is optional.

**Steps:**

1. On the Profile page, Kofi changes his display name without consent, then again with consent.
2. In Settings, turn on 'Allow profile to be public' (starting from private).
3. Kofi uploads a new avatar in the image editor and clicks 'Save image'. Close the dialog and reopen it.
4. Kofi clicks 'Use default image', then 'Save image'.
5. On the Creator dashboard (/creator), Ama edits tagline and bio (her avatar is unchanged), then uploads a new creator image.
6. On the Organization team page, change the organization name and website.
7. Change C1's vanity slug.
8. Pause tips only from the creator dashboard.
9. On native profile/edit, change the name and pick a new avatar, save, leave the screen and return.

**Expect:** Every identity or public change is held (409) and listed in Publication reviews, and public values stay the same until an approved exact resubmission. The name change without consent is held as 'staff_requested'; with consent it goes to text screening, not 'media', even though Kofi has an avatar. A new avatar or creator image is held with reason 'media'. Reopening the image editor shows the held image and the note 'This is the image you last submitted. If it is waiting for review, save it again after it is approved.' After approval, 'Save image' applies it without a new upload. Removing the avatar applies immediately (200) with no review record. Ama's text-only creator edit is screened as text (unchanged photos are not sent as media). Settings shows the error plus 'Check Publication reviews above...'. Pausing tips and hiding the profile apply immediately without review. Native shows 'We restored the changes you last submitted for review. Save them again once they are approved.'

**Needs:** Cloudinary; OpenAI optional

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/mobile/app/profile/edit.tsx`, `docs/compliance/ACCOUNT_PUBLICATION.md`

## SAFETY-58 · P1 · Author publication review list is private per account

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** Kofi and Yaw each have publication reviews.

**Steps:**

1. As Kofi GET /api/v1/publication-reviews (also with ?status=approved).
2. As Yaw do the same.
3. On web sign out of Kofi and into Yaw without reload; open Settings.
4. Check response headers.

**Expect:** Each user sees only their own items; actorId/reviewedBy not included in author responses; status param ignored for authors. Viewer state remounts on account switch (no leakage). Cache-Control 'private, no-store'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/web/src/components/account/PublicationReviews.tsx`, `apps/mobile/src/components/PublicationReviews.tsx`

## SAFETY-59 · P1 · Publication review retention and account erasure cleanup, including held media

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Staging DB. User Esi has: a pending publication review with a new avatar URL (reason 'media'); a declined campaign.create with a cover image URL; a creator page with avatar and cover; userblocks in both directions; a published comment that was reported; an active campaign and an active live session.

**Steps:**

1. Confirm publicationreviews has a TTL index on purgeAt (30 days).
2. Delete Esi's account via Settings > Delete account and complete erasure.
3. Inspect accountdeletionrequests.mediaUrls for Esi.
4. Inspect publicationreviews, userblocks, safetyreports, campaigncomments, campaigns, livesessions and the users document for Esi.

**Expect:** The TTL index exists. The deletion request's mediaUrls include the account avatar and cover, the creator avatar and cover, and every media URL from Esi's held, declined or approved review versions (the held avatar and the declined cover), so staff can remove those Cloudinary assets. After erasure, Esi's publication reviews and all userblocks rows (both directions) are removed. Reported UGC is hidden pending safety or legal-hold review, not destroyed, and safety report evidence stays for staff. The users document has reviewedAvatarUrl unset. The active live session is ended with providerStopPending set. Active or funded campaigns become 'expired', and pending_review campaigns return to draft.

**Needs:** Staging MongoDB access

**Source:** `apps/api/src/infrastructure/database/models/PublicationReviewModel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `docs/compliance/PUBLICATION_REVIEWS.md`

## SAFETY-61 · P1 · Donor/tip content version binding and staff conflicts

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Approved Kofi donation message; pending tip content T2; ADMIN-1 is the campaign owner of C3 with a pending donor item; Kofi restricted in one run.

**Steps:**

1. Kofi edits his donation message via POST /donations/<id>/message.
2. ADMIN-1 submits a review using a stale version hash.
3. ADMIN-1 reviews a donor item on own campaign C3.
4. Approve content from a restricted donor.
5. Approve T2 in 'Supporter names and messages' queue; recheck creator page.

**Expect:** Edited message returns to pending and disappears publicly until re-approved. Stale version 409 'The content changed. Refresh before reviewing.' Own campaign 403 'Another administrator must review this content.' Restricted donor 409 'This donor cannot publish content.' T2 approval shows supporter name/message on creator page; tip amount and creator balance unchanged.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/donationContentReviewRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/tipContentReviewRoutes.ts`, `apps/api/src/application/use-cases/AddDonationMessageUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.ts`

## SAFETY-63 · P1 · AI suggestion happy path and apply/discard

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** As SAFETY-62.

**Steps:**

1. Type a story, choose 'Improve clarity', consent, 'Get suggestion'.
2. Edit the story while suggestion is open.
3. Revert, click 'Apply to story'; then generate again and 'Discard'.
4. Try 'Draft from notes' with notes, and 'Translate' into Twi.

**Expect:** Suggestion appears under 'Suggested story' with Report button; remaining counter decreases. Editing shows warning and disables 'Apply to story'. Apply replaces story and shows 'Suggestion applied. Review the facts before publishing.' Translate requires target language (button disabled with <2 chars; API 400 without it).

**Needs:** OpenAI API key

**Source:** `apps/web/src/components/campaigns/AiWritingAssistant.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiWritingProvider.ts`

## SAFETY-66 · P1 · Report an AI suggestion; tampered or foreign reports rejected

*Surfaces:* admin, api, ios, web  ·  *Type:* security/permission

**Before:** Ama received suggestion with requestId R.

**Steps:**

1. Click 'Report' under the suggestion; submit.
2. As Kofi POST /api/v1/safety/reports targetType ai_output targetId R with the same generatedText.
3. As Ama POST with generatedText altered by one character.
4. Submit Ama's valid report twice.
5. As ADMIN-1 review the ai_output report.

**Expect:** Valid report 201; admin card says 'AI-generated suggestion; review the model output' with original text as evidence; 'Restrict publishing' disabled; Resolve/Dismiss work. Kofi and altered text get 404 'Generated suggestion not found...'. Duplicate returns same id.

**Needs:** OpenAI API key

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/web/src/components/campaigns/AiWritingAssistant.tsx`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## SAFETY-68 · P1 · Action center counts and sidebar badges match queue contents, including campaign reports

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Known counts: N pending safety reports, M live cleanup items, P pending publication proposals, D pending donor-content items, T pending tip-content items and C pending campaign reports.

**Steps:**

1. As an admin, GET /api/v1/admin/action-center.
2. Check the sidebar badges for 'Community safety', 'Publication reviews' and 'Campaign reports', and the TopBar total.
3. Resolve one safety report, approve one publication item and mark one campaign report reviewed. Navigate away or wait 30 s.
4. Click each action link, for example /publication-reviews?queue=donation-content-reviews and /campaign-reports.
5. As a non-admin, GET the action center.

**Expect:** The API returns items safety=N, live-cleanup=M, publication-reviews=P, donation-content-reviews=D, tip-content-reviews=T and campaign-reports=C (title 'Campaign reports from supporters', href /campaign-reports). Badges: 'Community safety' = N+M; 'Publication reviews' = P+D+T; 'Campaign reports' = C. The TopBar total is the sum of all visible items, including the new refund-requests and activity-email-review items. The campaign-report badge drops straight away after a decision (the page fires 'ujimora:admin-actions-changed'); the other counts drop on navigation, focus or the 30 s refresh. Deep links open the correct queue. The non-admin call returns 403. M also counts ordinary ended broadcasts whose provider cleanup is pending (see SAFETY-N013).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/admin/src/context/AdminActionContext.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## SAFETY-69 · P1 · Admin campaign Block ends live sessions, hides the campaign, pauses payouts and notifies the owner; Return to review

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** ACTIVE campaign C4 owned by Esi, with an active live session and withdrawable funds. ADMIN-1 is not the owner.

**Steps:**

1. In admin /campaigns/<C4> under Staff decision, enter notes and click 'Block campaign'.
2. As a guest, open C4, its live watch URL and its donate URL.
3. Retry the same decision request with the same expectedVersion. Then try a different action with the stale version.
4. As Esi, open the notification inbox and request a payout for C4.
5. Click 'Return to review' and check Esi's inbox again.

**Expect:** C4's status is blocked and it is not publicly visible. The live session is ended with moderationStoppedAt, providerStopPending is cleared after reconcile, and the room is closed. The same retry succeeds without duplication (and without a second notice); a different action on the stale version returns 409. Esi gets one in-app notice: 'Your campaign has been blocked' / '“<title>” was removed from public view after a review. For details or to appeal, contact support@ujimora.com.', linking to /my-campaigns and without the staff notes. Her payout request returns 409 'This campaign is under review; payouts are paused'. 'Return to review' moves C4 to pending_review (still private) and sends 'Your campaign is back in review'. The review history lists both decisions. An admin who owns the campaign sees 'Another administrator must review your campaign.'

**Needs:** LiveKit credentials

**Source:** `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`

## SAFETY-71 · P1 · Acceptable Use, Terms content licence, report reasons and contact inboxes are published and consistent

*Surfaces:* ios, marketing, web  ·  *Type:* compliance

**Before:** Production marketing site and app.

**Steps:**

1. Open ujimora.com/acceptable-use, /terms (sections 10 Prohibited use, 11 Content and licence, 12 Suspension, 14 complaints) and the in-app /legal pages.
2. Check that trust@ujimora.com (reporting), support@ujimora.com (appeals) and legal@ujimora.com (escalation) are shown, and that each mailbox receives a test email.
3. Compare the in-app report reasons with the prohibited categories. Safety reports: harassment, hate, sexual content, violence, child safety, credible threat, fraud, spam, intellectual property, privacy, other. Campaign reports: fraudulent, misleading, inappropriate content, spam, illegal activity, intellectual property, privacy, other.

**Expect:** Policies render on marketing and in-app with the current effective date. Both report forms now include intellectual property and privacy reasons that match the Acceptable Use item 'Infringement of intellectual property or privacy rights'. Terms s.14 directs escalation to legal@ujimora.com. Open owner item (I155): named owners and response targets for trust@, support@ and legal@, and a rights-holder takedown procedure, are still to be set. Record the owners before launch.

**Needs:** Email provider / mailbox access

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/web/src/components/safety/ReportContent.tsx`, `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `packages/types/src/campaign.ts`

## SAFETY-75 · P1 · Host token denied to restricted host and after moderator stop

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** Ama's session S2 active; LiveKit configured.

**Steps:**

1. Restrict Ama; call POST /api/v1/live-sessions/<S2>/video/host-token.
2. Restore Ama; moderator stops S2; request host token for S2 again; try PATCH to un-end.

**Expect:** Restricted: 403 publishing restricted. Moderator-stopped session: token/visibility return 404 'Broadcast unavailable'; session cannot be revived; a new session requires a fresh start (and publication admission).

**Needs:** LiveKit credentials

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## SAFETY-N001 · P1 · Restrict an account directly from 'Restricted users' (no report needed)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** ADMIN-1. Kofi has published content and an active live session on his campaign. A deleted account id and a random valid ObjectId. Separately, Esi is already restricted through report R5.

**Steps:**

1. Open admin Community safety and click the 'Restricted users' toggle.
2. Under 'Restrict an account', type 'abc' as Account ID. Then enter Kofi's 24-hex id with 19 characters of notes. Check the 'Restrict publishing' button each time.
3. Enter 20+ characters of notes and click 'Restrict publishing'.
4. Check the list, Kofi's live session, the contentrestrictions and contentrestrictionevents documents and the Audit Log. As Kofi, try to post a comment.
5. Try to restrict ADMIN-1's own id, the deleted account id and the random ObjectId. Via the API, POST with id 'xyz' and with 19-character notes.
6. Directly restrict Esi with new notes. Then on R5's resolved card click 'Restore publishing after appeal'.

**Expect:** 'Restrict publishing' stays disabled until the id is 24 hex characters and the notes are at least 20 characters. Success shows 'Publishing restricted.' (API 201 {data:{userId}}). Kofi appears in the list with name, email, 'restricted <time> · direct restriction' and the notes. contentrestrictions has no reportId. A 'restrict' event is recorded without a reportId. The Audit Log has 'safety.restrict_user' with resource user:<id>. Kofi's active live session is stopped: moderationStoppedAt is set and viewers get 'Broadcast unavailable'. Kofi's writes return 403 'Publishing is restricted following a moderation review. Contact support@ujimora.com to appeal. Your account settings and funds remain accessible.' Own id returns 403 'Another administrator must restrict your account.'. The deleted or unknown ids return 404 'User not found'. 'xyz' returns 400 'Invalid user', and short notes return 400 'Validation failed'. Esi's direct restriction replaces the R5 restriction, so restoring from R5 needs the supersede confirmation (409 then 'Lift the current restriction anyway'). No inbox notice is sent for a direct restriction; only report-driven restrictions notify. Confirm that support tells the user.

**Needs:** LiveKit credentials (live stop part)

**Source:** `apps/admin/src/components/RestrictedUsersPanel.tsx`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/database/models/ContentRestrictionEventModel.ts`

## SAFETY-N002 · P1 · Restricted users list: pagination, closed accounts and lifting a restriction

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** More than 12 restricted accounts, including Kofi (restricted through a report) and one restricted account that has since been closed. ADMIN-1.

**Steps:**

1. Open Community safety > 'Restricted users'. Page through the list and change the page size.
2. On Kofi's entry, type 19 characters in 'Notes for lifting (at least 20 characters)', then 20+ characters, and click 'Lift restriction'.
3. Call POST /api/v1/admin/safety-reports/restrictions/<Kofi id>/restore again with notes.
4. As Kofi, post a comment with consent.
5. Lift the remaining restrictions until the list is empty. Call GET /api/v1/admin/safety-reports/restrictions?pageSize=500.

**Expect:** Entries are newest first and show the name or 'Unknown account', the email or user id, the restriction time, 'report <id>' or 'direct restriction', and the reason. A closed account shows '(closed)'. 'Lift restriction' is disabled below 20 characters. Lifting shows 'Publishing restriction lifted. Previously hidden content stays hidden.' and the entry disappears; a 'restore' event and one audit 'safety.restore_public_content' row are written. The repeat call returns 404 'This account has no active publishing restriction.' Kofi can publish again, subject to review. An empty list shows 'No restricted accounts.' A pageSize above 100 returns 400 'Page size must be a whole number between 1 and 100.' Responses are Cache-Control no-store.

**Needs:** None

**Source:** `apps/admin/src/components/RestrictedUsersPanel.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/queuePageSize.ts`

## SAFETY-N003 · P1 · Staff-decision inbox notices for update hide, message hide, broadcast stop and restriction

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Pending reports filed by Yaw: R6 on Ama's campaign update, R7 on Kofi's approved donation message, R8 on a guest donation message, R9 on Ama's live session, R10 on a comment by Kofi. Report R11 was filed by Esi, whose account is then deleted before review. ADMIN-1.

**Steps:**

1. ADMIN-1 clicks 'Hide campaign update' on R6, 'Hide message' on R7 and R8, 'End broadcast at provider' on R9, and 'Restrict publishing' on R10. ADMIN-1 then dismisses R11.
2. Resend the PUT for R6 through the API.
3. Open the notification inbox (web bell and native) for Yaw, Ama and Kofi. Check email and push.
4. Inspect the notifications collection for Esi's id.

**Expect:** For each report, Yaw gets exactly one 'We reviewed your report' notice. Ama gets 'Your campaign update was removed' / 'A campaign update you posted was removed after a safety review. For details or to appeal, contact support@ujimora.com.' and 'Your live broadcast was stopped' / 'Your live broadcast was stopped after a safety review. For details or to appeal, contact support@ujimora.com.' Kofi gets 'Your message was hidden' / 'A message you left with a payment was hidden after a safety review. The payment itself is not affected. For details or to appeal, contact support@ujimora.com.' and 'Publishing is restricted on your account' / 'After a safety review, publishing from your account is restricted. Your account settings and funds remain accessible. For details or to appeal, contact support@ujimora.com.' The guest message author (R8) gets no notice, and no notice is created for the deleted reporter (R11). The resend returns 409 and adds no duplicate notice (notice ids are deterministic). The notices are type staff_decision, in the inbox only: no email, no push, no staff notes, no reporter identity and no evidence.

**Needs:** Paystack test keys (donation message); LiveKit (live stop)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `packages/types/src/legal.ts`

## SAFETY-N004 · P1 · Hiding an update, or restricting through a comment report, revokes the publication approval

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Ama's update U3 was published through an approved review (with consent). Kofi's comment K3 was published through an approved review. Both were posted after this release, so they carry publicationFingerprint. ADMIN-2 is not Ama or Kofi.

**Steps:**

1. Yaw reports U3. ADMIN-2 clicks 'Hide campaign update'.
2. Ama posts an update with identical type, title and content.
3. Yaw reports K3. ADMIN-2 clicks 'Restrict publishing' on that comment report. Then lift Kofi's restriction in Restricted users.
4. Kofi reposts K3's identical text. Then Kofi posts different text.
5. Ama and Kofi open Settings > Publication reviews. Inspect the publicationreviews documents.
6. Repeat step 1 on an update posted before this release (no publicationFingerprint).

**Expect:** The identical repost of U3 and the identical repost of K3 each return 422 'This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.' The matching review records now have status rejected with reviewNotes 'Removed after safety report <report id>', and approvalExpiresAt is unset. K3 is hidden as part of the restriction. Kofi's different text follows normal admission. For the pre-release update, the hide works but no approval is revoked, because there is no fingerprint.

**Needs:** OpenAI optional

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/domain/services/publicationFingerprint.ts`, `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`

## SAFETY-N005 · P1 · Removing a profile or creator photo applies immediately, even when restricted or without consent

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Kofi is restricted and has an avatar and a cover. Esi has an avatar, and her legalAcceptance is set to an older version (staging). Ama is a creator with a creator photo, and is restricted in one run. No consent is given in any step.

**Steps:**

1. As Kofi on web Profile, open the avatar editor, click 'Use default image', then 'Save image'. Repeat for the cover.
2. As Kofi on native profile/edit, clear the avatar and tap 'Save profile'.
3. As Esi, remove her avatar.
4. As Kofi, remove the avatar and change the display name in the same save.
5. As Ama (restricted), POST /api/v1/creators/profile with {avatarUrl:''} only. Then clear the photo on the web Creator dashboard and save.
6. Check the public profile, comments, publicationreviews and users.reviewedAvatarUrl.

**Expect:** Steps 1 to 3 apply immediately (200). The photo disappears from public surfaces, no publicationreviews document is created, and there is no 403 (restriction) or 428 (agreement); reviewedAvatarUrl is unset. Step 4 is reviewed as a public change and the restricted user gets 403 'Publishing is restricted...'. The minimal creator body in step 5 applies immediately. Check the dashboard save for a restricted creator: it posts the full page (handle, displayName, ...), and the contentAcceptance.ts exemption only matches a body with just avatarUrl/coverUrl='' (plus automatedReviewConsent). If the dashboard returns 403 'Publishing is restricted...', file it as a bug against I074. For an unrestricted creator, removing the photo from the dashboard applies immediately without review.

**Needs:** Cloudinary; staging DB access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## SAFETY-N006 · P1 · Web keeps held publication drafts per account (campaign form and profile image)

*Surfaces:* admin, web  ·  *Type:* functional

**Before:** Ama and Kofi can sign in on the same browser. A cover image is ready. ADMIN-2. A private window with site data blocked.

**Steps:**

1. As Ama on /campaigns/new, fill in title, story, goal and cover. Leave consent unchecked and submit (held).
2. Close the tab and reopen /campaigns/new.
3. Click 'Start over'. Fill the form again, submit it (held), and have ADMIN-2 approve it.
4. Reopen /campaigns/new and submit the restored draft without changes.
5. In Profile, upload a new avatar and click 'Save image' (held). Close the dialog and reopen it.
6. Sign out, sign in as Kofi on the same browser, and open /campaigns/new and the avatar editor.
7. Repeat step 1 in the private window with storage blocked.

**Expect:** The reopened form shows 'We restored your unsent draft from this browser. If it is waiting for safety review, submit this same version again once it is approved.' with a 'Start over' action that clears the form and the stored draft. After approval, submitting the restored draft creates the campaign with no re-upload (same cover URL). The reopened image editor shows the held image and 'This is the image you last submitted. If it is waiting for review, save it again after it is approved.' Drafts are per account and explicit sign-out removes all of them, so Kofi sees none of Ama's. Drafts older than 30 days are discarded. With storage blocked, the forms work normally with no restore and no errors.

**Needs:** Cloudinary

**Source:** `apps/web/src/lib/publicationDrafts.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/components/profile/ProfileImageEditor.tsx`, `apps/web/src/context/AuthContext.tsx`

## SAFETY-N008 · P1 · Public /c/:slug page: report and block the organiser, and the live link

*Surfaces:* api, web  ·  *Type:* functional

**Before:** C1, with a slug, is owned by Ama. Yaw is signed in. A guest browser. Ama can start a live session.

**Steps:**

1. As a guest, open /c/<slug>. Note the safety controls near the donate button.
2. As Yaw, open /c/<slug> and click 'Report' (organiser). Pick a reason, enter 10+ characters and click 'Send report'.
3. Ama goes live. Within 15 s, look for 'Watch live broadcast' on /c/<slug>.
4. As Yaw, click 'Block user'.
5. Reload /c/<slug>. Open C1 comments and Settings > Blocked users.
6. As Ama, open /c/<slug>.

**Expect:** The guest sees 'Report campaign' but no organiser Report/Block controls. Yaw's report creates a safety report with targetType user and targetUserId=Ama, and the page shows 'Report received for moderation review.' The 'Watch live broadcast' button appears and links to /live/<session id>. After the block, the page shows 'Campaign not found' with 'You blocked this organiser, so their campaign is hidden from you.' and 'Explore campaigns'. After a reload the campaign shows again, because campaign reads are not block-filtered; the block still holds (Ama's comments and updates are hidden from Yaw and Settings lists Ama). Record whether product wants the hide to persist. Ama sees no organiser Report/Block controls on her own page.

**Needs:** LiveKit credentials (live link step)

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/web/src/components/safety/ReportContent.tsx`

## SAFETY-N010 · P1 · Native owner update composer goes through publication review; owner Pin and Delete

*Surfaces:* admin, android, api, ios  ·  *Type:* functional

**Before:** Signed native build. Ama owns the active campaign C1. Yaw is a non-owner. ADMIN-2. Ama is restricted in one run.

**Steps:**

1. As Ama, open campaign/[C1] and find 'Post an update' in the Updates section.
2. Tap it. Check that 'Post update' is disabled while the title is under 3 characters or the content is empty. Fill type, title and content, leave consent unchecked, and post.
3. ADMIN-2 approves in /publication-reviews. Ama taps 'Post update' again without editing.
4. Post another update with consent and benign text.
5. Pin, then Unpin, an update. Delete one and confirm the 'Delete update?' dialog.
6. As Yaw, open campaign/[C1].
7. As restricted Ama, try to post an update.

**Expect:** The first post keeps the dialog open with 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.' and keeps the fields. After approval the identical post shows 'Update posted.' and the update appears. The consented benign update posts immediately. Pin/Unpin toggle. Delete asks 'Delete update?' / 'This removes the update for everyone.' and removes it. Yaw sees no composer, Pin or Delete, but does see 'Report' on Ama's updates. Restricted Ama sees 'Publishing is restricted following a moderation review. Contact support@ujimora.com to appeal. Your account settings and funds remain accessible.'

**Needs:** Signed native builds; OpenAI optional

**Source:** `apps/mobile/src/components/CampaignUpdateComposer.tsx`, `apps/mobile/src/components/CampaignUpdatesList.tsx`, `apps/mobile/src/lib/campaignUpdates.ts`, `apps/mobile/app/campaign/[id].tsx`

## SAFETY-07 · P2 · Cannot report own comment, own account or own update

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Kofi has comment K1; Ama has update U1.

**Steps:**

1. As Kofi POST /api/v1/safety/reports targetType comment targetId K1.
2. As Kofi POST targetType user targetId=<Kofi id>.
3. As Ama POST targetType campaign_update targetId U1.
4. In web UI confirm Report button hidden on own content.

**Expect:** Each API call returns 400 'You cannot report your own account or comment'. No safetyreports documents created.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## SAFETY-09 · P2 · Safety report rate limit: 20 per 15 minutes per client IP

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Yaw and Esi tokens. A production-like deploy where api.ujimora.com sits behind Render's Cloudflare edge, so CF-Connecting-IP is set. Device A on office Wi-Fi and device B on mobile data. Invalid payloads also count, because the limiter runs before validation.

**Steps:**

1. From device A, as Yaw, send 20 POST /api/v1/safety/reports within 15 minutes. Note the X-RateLimit-Limit and X-RateLimit-Remaining headers.
2. Send a 21st request from device A.
3. Repeat the 21st request from device A with forged X-Forwarded-For, X-Real-IP and True-Client-IP headers set to a random address.
4. On device A, sign in as Esi and send one report.
5. On device B (a different network), send one report as Yaw.
6. On web on device A, open a Report dialog and submit.
7. After the Retry-After time has passed, report again from device A.

**Expect:** Responses carry X-RateLimit-Limit: 20 and an X-RateLimit-Remaining value that goes down with each request. The 21st request returns 429 {message: 'Too many requests, please try again later'} with a Retry-After header in seconds. Forged forwarding headers do not reset the bucket (still 429). The bucket is per client IP, not per account, and IPv6 clients share their /64: Esi on device A is also refused, while Yaw on device B gets 201. The web dialog shows 'Too many requests, please try again later' as its error. After the window resets, reporting works again. Users on other networks are never affected, because there is no platform-wide bucket. Known open issue I099: counters are held in memory per API instance, and render.yaml and DEPLOYMENT.md require a single instance. Confirm that Render runs exactly one instance.

**Needs:** Production-like Render deployment; two client networks

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `render.yaml`

## SAFETY-23 · P2 · Block API negative paths

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Yaw token; deleted user id; random valid ObjectId.

**Steps:**

1. PUT /api/v1/safety/blocks/<Yaw id> (self).
2. PUT /api/v1/safety/blocks/xyz.
3. PUT /api/v1/safety/blocks/<non-existent ObjectId>.
4. PUT same valid user twice.
5. Any /safety/blocks call without token.
6. GET /api/v1/safety/blocks after blocking a user who later deleted their account.

**Expect:** Self and invalid id: 400 'Choose another user to block'. Nonexistent: 404 'User not found'. Double block: 200 both times, single userblocks row. No token: 401. Deleted user shows as 'Former member' (or is removed by erasure cleanup).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`

## SAFETY-24 · P2 · Blocking does not block money: blocked user can still donate to blocker's campaign

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Ama blocked Kofi. Paystack test keys.

**Steps:**

1. As Kofi donate GHS 50.00 (no message) to C1 via /c/<slug>/donate and complete Paystack test payment.
2. Check C1 raised total, ledger, and Ama's donation history view.

**Expect:** Donation succeeds; C1 raisedAmount increases by exactly the net/gross amounts per fee rules; Ama sees the donation as 'Anonymous'. Confirm this is the intended policy (blocking is social-only) and document it for support.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ListCampaignDonationsUseCase.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## SAFETY-26 · P2 · Safety queue listing, filters, pagination and export

*Surfaces:* admin  ·  *Type:* functional

**Before:** More than 12 pending reports, plus some resolved and dismissed.

**Steps:**

1. Open /safety-reports; switch Status pending/resolved/dismissed.
2. Change page size and page via pagination; click 'Refresh queue'.
3. Use Export (CSV/XLSX/PDF) for the current status.

**Expect:** Stats show 'Reports in this view' matching total; lists change per status; pagination consistent; export contains ID, Type, Target, Reason, Status, Resolution, Priority, Created (UTC) for all rows in that status. Empty state 'No reports in this queue.' when none.

**Needs:** None

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`

## SAFETY-36 · P2 · Multiple restrictions: history is kept, lifting a newer restriction from an older report needs confirmation, a second restore is refused

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Two separate pending reports against Kofi (R1 and R2). ADMIN-1 is not Kofi.

**Steps:**

1. Restrict publishing on R1 with notes A, then on R2 with notes B.
2. Inspect contentrestrictions and contentrestrictionevents for Kofi. Open Community safety > 'Restricted users'.
3. In Status=resolved, enter 20+ characters of notes on R1's card and click 'Restore publishing after appeal'.
4. Click the 'Lift the current restriction anyway' button that appears on R1's card.
5. Restore again, from R2's card or through POST /restrictions/<Kofi id>/restore.
6. Check the Audit Log.

**Expect:** There is one active contentrestrictions document, with reason B and reportId R2, plus two 'restrict' history events (one per report). Restricted users shows one entry for Kofi with '... · report <R2>' and reason B. Step 3 fails with 'The current restriction came from a different decision. Review it and confirm before lifting it.' (409); the restriction stays, and a warning button 'Lift the current restriction anyway' appears on R1's card only. Step 4 shows 'Publishing restriction removed. Previously hidden comments and messages remain hidden.', deletes the restriction, and records a 'restore' event with liftedReason B and liftedReportId R2. Step 5 returns 404 'This account has no active publishing restriction.' The Audit Log has exactly one 'safety.restore_public_content' row, whose change reads 'B (report R2) -> lifted'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/database/models/ContentRestrictionModel.ts`, `apps/api/src/infrastructure/database/models/ContentRestrictionEventModel.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/admin/src/components/RestrictedUsersPanel.tsx`

## SAFETY-39 · P2 · Action/target mismatch and review validation via API

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Pending reports of each type; admin token.

**Steps:**

1. PUT review with action hide_comment on a user report; hide_update on a comment report; hide_message on a live report; stop_live on a comment report.
2. PUT with notes of 19 chars.
3. PUT with id 'bad'.
4. PUT on an already resolved report.

**Expect:** Mismatches return 400 with 'Choose a comment report' / 'Choose a campaign update report' / 'Choose a donor or supporter message report' / 'Choose a live-session report'. Short notes 400. Invalid id 400 'Invalid report'. Already reviewed 409 'This report has already been reviewed'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## SAFETY-52 · P2 · Approved versions stay reusable within 7 days until a moderator removes one

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Kofi has an approved comment version for C1. Ama has an approved campaign.create version within her plan allowance. ADMIN-2.

**Steps:**

1. Post the identical approved comment 3 times in a row.
2. Yaw reports one of the copies. ADMIN-2 clicks 'Hide comment' with notes.
3. Kofi posts the identical text again, then opens Settings > Publication reviews.
4. In the web campaign form, submit the approved campaign twice from the same tab. Then call POST /api/v1/campaigns twice with the same payload and two different Idempotency-Key values.

**Expect:** Each post in step 1 publishes (201); approvals are not single-use. After the hide, the identical repost returns 422 'This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.', and Publication reviews shows that version as rejected with notes 'Removed after safety report <report id>'. Copies that were not hidden stay visible. The web form reuses one Idempotency-Key per payload, so the second submit returns the existing campaign and creates no duplicate. The API calls with different keys create a second campaign, because the approval is not consumed. Known open issue I153 (owner decision): fully single-use approvals are not implemented.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/domain/services/publicationFingerprint.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`

## SAFETY-65 · P2 · AI daily quotas (per user and global) and double-click

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with AI_WRITING_DAILY_LIMIT=3 and AI_WRITING_GLOBAL_DAILY_LIMIT=5 for the test.

**Steps:**

1. As Ama rapid double-click 'Get suggestion'.
2. Make requests until the per-user limit is hit.
3. Use a second user until the global limit is hit.
4. Check /ai-writing/config around 00:00 UTC.

**Expect:** Double-click sends one request (inFlight guard). Counter shows 'N of 3 requests left today · resets at midnight UTC'. Over limit: 429 'The daily AI writing limit has been reached. Please try again tomorrow (UTC).' Global cap refuses other users and does not burn their personal quota. Counts reset at UTC midnight.

**Needs:** OpenAI API key; staging env control

**Source:** `apps/api/src/application/services/AiWritingService.ts`, `apps/web/src/components/campaigns/AiWritingAssistant.tsx`

## SAFETY-67 · P2 · Admin AI usage page shows metadata only

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Several AI requests (success and error).

**Steps:**

1. Open admin /ai-usage; check stats and table; export.
2. As a regular user GET /api/v1/ai-writing/stats and /usage.

**Expect:** Totals (today/month, tokens, errors) and per-request rows with user name, action, lengths, status; no raw input/output or digest. Non-admin 403.

**Needs:** OpenAI API key

**Source:** `apps/admin/src/pages/AiUsagePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/aiWritingRoutes.ts`, `apps/api/src/application/services/AiWritingService.ts`

## SAFETY-73 · P2 · Reports on removed comments, non-public content and already-deleted comments

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Kofi's comment K2 was already deleted via DELETE /api/v1/campaigns/<C1>/comments/<K2>. Campaign C5 is in pending_review, owned by Esi, with update U5 written by Esi. Campaign C6 (owner Esi) was blocked by staff after Kofi posted comment K6 on it. Kofi's live comment K7 is on C1. ADMIN-1 is not Esi.

**Steps:**

1. As Yaw, POST a report with targetType comment and targetId K2.
2. POST a report on campaign_update U5 as Yaw, then as ADMIN-1, then as Esi.
3. POST a report on comment K6 as Yaw, then as Esi (owner of C6).
4. As Yaw, report K7. Kofi then deletes K7; note its deletedAt. ADMIN-1 clicks 'Hide comment' on the report.

**Expect:** Step 1: 404 'Comment not found'; removed comments are not reportable. Step 2: Yaw gets 404 'Campaign update not found', ADMIN-1 gets 201, and Esi gets 400 'You cannot report your own account or comment'. Step 3: Yaw gets 404 'Comment not found' because the campaign is not public; Esi gets 201 because the owner can see it. Step 4: the report returns 201, the hide shows 'Review saved.', the report is resolved as hide_comment, and K7 keeps Kofi's original deletedAt.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignCommentRoutes.ts`

## SAFETY-74 · P2 · Organization team update and identity respect restriction and review

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** ORG account with teammate Esi; ORG restricted in one run, Esi restricted in another.

**Steps:**

1. As Esi post a team update via /organization-team (POST /organization-team/<org>/campaigns/<id>/updates) without consent.
2. Restrict ORG; Esi edits org profile name.
3. Restrict Esi; Esi posts a team update.

**Expect:** Unrestricted: held for review (409) with PublicationReviews inline. ORG restricted: 403 'Publishing for this organization is restricted'. Esi restricted: 403. Membership revoked during review denies publication.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/OrganizationTeamPage.tsx`

## SAFETY-N007 · P2 · Native keeps held publication drafts per account (campaign create and profile edit)

*Surfaces:* admin, android, ios  ·  *Type:* cross-platform

**Before:** Signed native build. Ama can create a campaign. ADMIN-2.

**Steps:**

1. On campaign/create, fill all fields including the cover. Leave consent unchecked and submit (held).
2. Force-quit the app, reopen it and open campaign/create.
3. Tap 'Start over'. Fill the form again, submit it (held), have it approved, and resubmit the restored draft unchanged.
4. On profile/edit, change the name and pick a new avatar, then tap 'Save profile' (held). Leave the screen and return.
5. After ADMIN-2 approves, tap 'Save profile'. Then sign out and sign back in.

**Expect:** campaign/create shows 'We restored your unsent draft from this device. If it is waiting for safety review, submit this same version again once it is approved.' with 'Start over', which clears the form and the saved draft. Resubmitting the restored draft after approval creates the campaign with the same cover URL. profile/edit shows 'We restored the changes you last submitted for review. Save them again once they are approved.' with the held values filled in. After a successful save the notice disappears. Signing out clears all drafts on the device.

**Needs:** Signed native builds; Cloudinary

**Source:** `apps/mobile/src/lib/publicationDrafts.ts`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/context/AuthContext.tsx`

## SAFETY-N009 · P2 · Native: comment authors open member profiles; an unavailable profile still offers Report and Block

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Signed native build. Kofi has a comment on C1. Yaw is signed in. Kofi can switch his profile to private.

**Steps:**

1. On campaign/[C1] comments, tap Kofi's name, then his avatar.
2. On profile/[Kofi id], tap 'Report' and submit.
3. Kofi turns off 'Allow profile to be public'. Yaw reopens profile/[Kofi id].
4. On that screen tap 'Report', then 'Block user'.
5. Check with VoiceOver/TalkBack that the author name is announced as a link, 'View Kofi's profile'.

**Expect:** Tapping the name or avatar opens profile/[Kofi id]. The report returns 201 with 'Report received for moderation review.' A private, blocked or restricted profile shows 'This profile is not available.' and still shows Report and Block for a valid id (not for yourself). Reporting from there creates a targetType user report, and blocking works. Authors without a valid 24-hex id are not tappable.

**Needs:** Signed native builds

**Source:** `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/app/profile/[id].tsx`, `apps/mobile/src/components/UserSafetyControls.tsx`

## SAFETY-N011 · P2 · Intellectual property and privacy report reasons end to end (safety and campaign reports)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Yaw and Esi are signed in on web and native. Kofi has a comment on C1. C2 is owned by Ama. ADMIN-1.

**Steps:**

1. In the web comment 'Report' dialog, open Reason, choose 'intellectual property' and submit. Repeat with 'privacy' on another comment.
2. Do the same in the native ReportContent dialog.
3. On web /campaigns/<C2>, click 'Report Campaign' and choose 'Intellectual property / copyright'. As Esi on /c/<C2 slug>, choose 'Privacy or likeness'.
4. On native campaign/[C2], open 'Report Campaign' and check the reason list.
5. API: POST /api/v1/safety/reports with reason 'copyright'; POST /api/v1/campaigns/<C2>/report with reason 'ip'.
6. In admin, open /safety-reports and /campaign-reports and export both.

**Expect:** All IP and privacy submissions succeed (201) and store the reason as intellectual_property or privacy. Invalid values return 400 'Validation failed'. Native campaign reports list 'Intellectual property or copyright' and 'Privacy violation'. Safety queue headings read 'comment: intellectual property' and 'comment: privacy'. In the Campaign reports queue, record the chip label: CampaignReportsPage.tsx's REASONS map has no entry for these two values, so the chip and the export show the raw values intellectual_property and privacy. This is cosmetic; file it if staff need labels. Web and native word the same campaign-report reasons differently ('Privacy or likeness' vs 'Privacy violation'); confirm this is acceptable.

**Needs:** Signed native builds

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `packages/types/src/campaign.ts`, `apps/web/src/components/safety/ReportContent.tsx`, `apps/mobile/src/components/ReportContent.tsx`, `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/admin/src/pages/CampaignReportsPage.tsx`

## SAFETY-N012 · P2 · Campaign report review API: validation, permissions and concurrent reviewers

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Pending campaign report CR1 filed by Yaw. ADMIN-1 and ADMIN-2 tokens. Kofi (non-admin) token.

**Steps:**

1. GET /api/v1/reports?status=open; GET /api/v1/reports?pageSize=500; GET /api/v1/reports?status=pending.
2. PUT /api/v1/reports/<CR1>/review with {status:'reviewed'} and no notes, then with 19-character notes, then with {status:'pending', notes:<20+ chars>}.
3. GET /api/v1/reports/bad and PUT /api/v1/reports/bad/review.
4. ADMIN-1 and ADMIN-2 send PUT review for CR1 at the same moment with different statuses and 20+ character notes.
5. Kofi calls GET and PUT; then call without a token.
6. Check CR1, the Audit Log and Yaw's inbox.

**Expect:** An unknown status returns 400 'Status must be pending, reviewed or dismissed'. pageSize 500 returns 400 'Page size must be a whole number between 1 and 100.' The list response has Cache-Control 'private, no-store' and each item includes campaignStatus and review fields. Missing, short or 'pending' decisions return 400 'Validation failed'. A malformed id returns 404 'Report not found'. Of the two concurrent reviews, exactly one wins (200) and the other gets 409 'Report has already been reviewed'. CR1 holds the winner's reviewedBy, reviewedAt and reviewNotes, with exactly one audit row and exactly one 'We reviewed your report' notice. Kofi gets 403 'Insufficient permissions', and no token gives 401.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminReportController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAdminReportRepository.ts`

## SAFETY-N013 · P2 · An ordinary live end during a provider outage shows under 'Live cleanup pending' and clears automatically

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with LiveKit configured. Ama is broadcasting S3 on C1 with a host token issued. ADMIN-1. LiveKit can be made unreachable (invalid LIVEKIT_URL or credentials) and restored. A second session S4 runs on campaign C9, whose endDate can be moved into the past in the DB.

**Steps:**

1. Make LiveKit unavailable. As Ama, click 'End session' on /campaigns/<C1>/live and confirm 'End broadcast' in the 'End broadcast?' dialog.
2. Check the response, the watch page /live/<S3> and the livesessions document.
3. As ADMIN-1, open /safety-reports. Check 'Live cleanup pending', the warning and the action-center item 'Live safety provider cleanup'.
4. Click 'Retry cleanup' while LiveKit is still down.
5. Restore LiveKit. Wait up to 30 s, or click 'Retry cleanup'.
6. Set C9's endDate in the past and wait for the 30 s reconcile.

**Expect:** The end returns 200 straight away (no 502). The session has status 'ended' and providerStopPending=true, with no moderationStoppedAt and the overlay token kept. The watch page shows 'This broadcast has ended. You can still support the campaign.' and no new host or viewer tokens are issued. Community safety counts the session under 'Live cleanup pending' and shows '<n> live safety operations still need provider cleanup. These are not complete.' Retrying while LiveKit is down leaves the count unchanged. After recovery the host is removed, the room is deleted, providerStopPending becomes false and the count returns to 0. The stale sweep ends S4 the same way: an ordinary end, not a moderation stop, with the overlay token kept and no safety report created.

**Needs:** LiveKit credentials; staging env and DB control

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/application/use-cases/EndLiveSessionUseCase.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/web/src/pages/CampaignLivePage.tsx`

## SAFETY-N014 · P2 · Content on a campaign relabelled EXPIRED by the expiry sweep stays reportable and actionable

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Staging running with NODE_ENV=production, so the 5-minute expiry sweep runs. ACTIVE campaign C7 has a comment by Kofi and an update by its owner. DB access to change C7's endDate. ADMIN-1.

**Steps:**

1. Set C7's endDate to yesterday and wait up to 5 minutes. Confirm C7's status becomes 'expired'.
2. As Yaw, report Kofi's comment and C7's update, and report C7 through 'Report Campaign'.
3. As ADMIN-1, hide the comment and the update.

**Expect:** C7 is relabelled EXPIRED, not blocked, and its public page still loads. The comment and update reports return 201, because EXPIRED counts as public for reporting, and the campaign report returns 201. Both hides succeed and the content disappears for all viewers. Any active live session on C7 is ended by the stale-session sweep.

**Needs:** Staging env and DB control

**Source:** `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`
