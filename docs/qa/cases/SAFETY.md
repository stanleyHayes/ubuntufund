# Trust & safety (75 cases)

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

## SAFETY-14 · P0 · Native 'Report Campaign' submits successfully (expected to FAIL today)

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Signed native build; Yaw signed in; C1 active. Also test logged out.

**Steps:**

1. On campaign/[id] scroll to bottom, tap 'Report Campaign', confirm 'Report'.
2. Capture the API response.
3. Repeat while logged out.

**Expect:** Launch requirement: 'Reported - Thank you. Our team will review this campaign.' and a Report document created. Source shows the app sends reason 'Flagged from mobile', which is not in the API enum (fraudulent|misleading|inappropriate_content|spam|illegal_activity|other), so the API returns 400 and the app shows 'Could not submit report'. Logged-out users also get a generic error instead of a sign-in prompt. Treat as launch blocker for store UGC review until fixed.

**Needs:** Signed iOS/Android builds

**Source:** `apps/mobile/app/campaign/[id].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`

## SAFETY-15 · P0 · Staff can see and triage campaign reports (expected to FAIL today)

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** At least one campaign report created via web (SAFETY-13). ADMIN-1.

**Steps:**

1. In admin, look for campaign reports in /safety-reports, /campaigns/<C1>, Dashboard, sidebar badges and TopBar action total.
2. Call GET /api/v1/reports?status=pending as admin, then PUT /api/v1/reports/<id>/review {status:'reviewed'}.

**Expect:** Launch requirement: campaign reports are visible in a staffed queue and counted in the action center. Source shows no admin page consumes /reports (admin 'Reports' page is analytics) and action-center has no count for them, so only the raw API shows them. API review works (200; second review 409). Decide: add UI/count, or route campaign reports into the safety queue, before launch.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/admin/src/pages/ReportsPage.tsx`

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

## SAFETY-25 · P0 · Admin safety queue access control

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Regular user Kofi; admin ADMIN-1; logged-out browser.

**Steps:**

1. As Kofi call GET /api/v1/admin/safety-reports, PUT /api/v1/admin/safety-reports/<id>/review, POST /restrictions/<id>/restore, POST /live-cleanup/retry.
2. Logged out, call the same.
3. As Kofi try to sign in to the admin console and navigate to /safety-reports and /publication-reviews.

**Expect:** Non-admin: 403 'Insufficient permissions' on every endpoint; logged out: 401. Admin console refuses non-admin sign-in / shows access denied; pages guarded by Resource.REPORTS.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/admin/src/router.tsx`

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

**Before:** Kofi restricted via a resolved report whose comment was hidden; Kofi also has earlier published (not hidden) comments.

**Steps:**

1. In /safety-reports Status=resolved find the restrict_user report; confirm 'Restore publishing after appeal' is disabled until new notes >= 20 chars.
2. Enter notes and click it.
3. As Kofi post a comment (with consent) and edit profile; view C1 as Yaw.

**Expect:** Notice 'Publishing restriction removed. Previously hidden comments and messages remain hidden.' contentrestrictions doc deleted; audit 'safety.restore_public_content'. Kofi can publish again (subject to publication review). Previously published non-hidden comments reappear; the moderator-hidden comment stays hidden.

**Needs:** None

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

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

## SAFETY-46 · P0 · Flagged or unavailable screening never publishes

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Kofi no avatar. Approved synthetic test string that OpenAI moderation flags (e.g., explicit violent threat fixture). Staging where OPENAI_API_KEY can be blanked.

**Steps:**

1. With consent, post the flagged fixture comment.
2. Blank OPENAI_API_KEY (or use invalid key), redeploy, post a benign comment with consent.
3. Check admin queue reasons.

**Expect:** Both return 409 held message; nothing public. Admin shows reason 'flagged' and 'unavailable' respectively. No automatic approval on provider failure.

**Needs:** OpenAI API key; staging env control

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiPublicationScreener.ts`, `apps/api/src/infrastructure/config/index.ts`

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

**Before:** Signed release-candidate builds on iPhone and Android device; non-admin reviewer account; seeded campaign with comments, updates, approved donor messages, a creator page and a live session.

**Steps:**

1. Sign up: confirm unchecked terms/18+ acknowledgement before any posting.
2. Post a comment (held/approved), report a comment, report a user, report an update, report a donor message, report a live stream, report a campaign.
3. Block a commenter and a creator/host; confirm content disappears; unblock in Settings.
4. Open Settings > Publication reviews and Blocked users.
5. Verify VoiceOver/TalkBack labels on Report/Block controls and dialogs.
6. Confirm contact info (support/trust email) reachable in-app.

**Expect:** Every report path succeeds with 'Report received for moderation review.' (campaign report must also succeed — see SAFETY-14), blocks take effect immediately, unblock works, agreement precedes posting, and all controls are accessible. Evidence (screenshots/video) captured for App Review notes.

**Needs:** Signed EAS builds; LiveKit; Paystack test keys

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `docs/compliance/MODERATION_OPERATIONS.md`, `apps/mobile/src/components/ReportContent.tsx`

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

## SAFETY-05 · P1 · Report and block from member/organization profile screens (native) and creator page (web)

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** Public member profile for Kofi; organization account ORG with public org page; creator page qa-creator for Ama.

**Steps:**

1. On iOS/Android open profile/[Kofi id]; tap 'Report' (user), submit; then tap 'Block user'.
2. Open organization/[ORG id]; tap 'Report'; submit.
3. On web open /creators/qa-creator; click 'Report' then 'Block user'.
4. On web open /organizations/<ORG slug> and look for Report/Block controls.

**Expect:** Native profile/org reports create targetType 'user' reports; blocking shows blocked state. Web creator page after block shows 'User blocked. Manage blocked users in Settings.' with 'Open settings'. Record whether web organization profile page offers Report/Block (source shows it does not; mobile does) and file a gap if web parity is required.

**Needs:** Signed native builds

**Source:** `apps/mobile/app/profile/[id].tsx`, `apps/mobile/app/organization/[id].tsx`, `apps/web/src/pages/CreatorTipPage.tsx`, `apps/web/src/pages/OrganizationProfilePage.tsx`

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

## SAFETY-13 · P1 · Web 'Report Campaign' dialog: happy path, duplicates, own campaign, logged out

*Surfaces:* api, web  ·  *Type:* functional

**Before:** C1 owned by Ama; Yaw signed in; guest browser.

**Steps:**

1. As guest on /campaigns/<C1> click 'Report Campaign'.
2. As Yaw click 'Report Campaign', select 'Misleading Information', add details, submit.
3. Submit a second report on C1 as Yaw.
4. As Ama POST /api/v1/campaigns/<C1>/report.
5. Open /c/<slug> (shared public page) and look for a report control.

**Expect:** Guest is redirected to /login with return path. Yaw sees 'Thank you for reporting this campaign...' and dialog closes. Second report shows 'You have already reported this campaign' (409, even after staff review). Owner gets 403 'You cannot report your own campaign'. /c/:slug page has no report control (record as P2 gap).

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`

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

## SAFETY-29 · P1 · Update edited after report cannot be hidden or restricted through that report

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Yaw reports U1; Ama then edits U1 (approved edit) so the digest changes.

**Steps:**

1. As ADMIN-1 click 'Hide campaign update'.
2. Click 'Restrict publishing' on the same report.
3. Click 'Resolve after other action' (or Dismiss).
4. Yaw re-reports the current version; admin hides it.

**Expect:** Hide and restrict both return 409 'This update changed or was removed after the report...'; the report stays pending without reviewAction. Resolve/dismiss succeeds. The new report on the current version can be hidden. Document the operating procedure for moderators.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

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

## SAFETY-41 · P1 · Dismiss and Resolve outcomes; no automatic outcome notification

*Surfaces:* admin, email, web  ·  *Type:* compliance

**Before:** Two pending reports by Yaw.

**Steps:**

1. Dismiss one with notes; 'Resolve after other action' the other.
2. Check Yaw's and the reported user's notifications, email inbox and push.

**Expect:** Statuses dismissed/resolved; audit 'safety.dismiss'/'safety.resolve'. No email/push/in-app notification is sent to reporter or reported user (documented gap; push disabled). Confirm support has a manual outcome/appeal process.

**Needs:** Email provider (to confirm nothing sent)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## SAFETY-42 · P1 · Moderator reviewing a report about themselves (conflict of interest)

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** ADMIN-1 has a regular public comment; Yaw reports it. ADMIN-1 also files a report on Kofi.

**Steps:**

1. As ADMIN-1 Dismiss the report about ADMIN-1's own comment.
2. As ADMIN-1 restrict Kofi via the report ADMIN-1 filed.

**Expect:** Launch expectation: another administrator must review (as publication, donor-content and campaign reviews enforce). Current source has no self-review/reporter guard in safety reviews, so both succeed — record as a finding and decide on fix or operational four-eyes rule.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`

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

## SAFETY-47 · P1 · Users with a profile avatar always need staff review for comments

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** Esi has an avatar set; OpenAI configured.

**Steps:**

1. As Esi, with consent checked, post a benign comment on C1.
2. Check admin queue.

**Expect:** Current behavior: held (409) with reason 'media' because the author avatar URL is part of the submission; admin must inspect the avatar. Confirm staff capacity for this volume or accept as known UX friction before launch.

**Needs:** Cloudinary (avatar); OpenAI key

**Source:** `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## SAFETY-50 · P1 · Approval expires after 7 days

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Approved but unused publication review for Kofi. DB access in staging.

**Steps:**

1. Set approvalExpiresAt to a past date on that publicationreviews doc.
2. As Kofi resubmit the exact content.
3. Resubmit with a small change.

**Expect:** Exact resubmission returns 409 'This safety approval expired. Revise your draft or contact support@ujimora.com for another review.' Changed content creates a new pending review.

**Needs:** Staging MongoDB access

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

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

## SAFETY-56 · P1 · Profile, creator page, organization identity and vanity URL changes go through review

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Kofi (member), Ama (creator with paid plan), ORG with team member, C1 slug.

**Steps:**

1. Profile page: change display name without consent; Settings: turn on 'Allow profile to be public'.
2. Creator dashboard (/creator, native creator): edit tagline/bio and avatar.
3. Organization team page: change organization name/website.
4. Change C1 vanity slug.
5. Pause tips only via creator dashboard (tipsEnabled false).

**Expect:** Each identity/public change is held (409) with the item listed in Publication reviews; existing public values unchanged until approved exact resubmission. Media changes (avatar/cover) always reason 'media'. Settings shows error plus 'Check Publication reviews above...'. Tips pause applies immediately without review. Hiding profile takes effect without review.

**Needs:** Cloudinary; OpenAI optional

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/api/src/application/use-cases/SaveCreatorProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/web/src/pages/SettingsPage.tsx`

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

## SAFETY-59 · P1 · Publication review retention and account erasure cleanup

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Staging DB; user Esi with publication reviews, blocks and a published comment that was reported.

**Steps:**

1. Confirm publicationreviews has a TTL index on purgeAt (30 days).
2. Delete Esi's account via Settings > Delete account and complete erasure.
3. Inspect publicationreviews, userblocks, safetyreports, campaigncomments for Esi.

**Expect:** TTL index exists. After erasure, Esi's publication reviews and all userblocks rows (both directions) are removed; reported UGC is hidden pending safety/legal-hold review rather than destroyed; safety report evidence remains for staff. Active live sessions queued for cleanup.

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

## SAFETY-68 · P1 · Action center counts and sidebar badges match queue contents

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** Known counts: N pending safety reports, M live cleanup items, P pending publication proposals, D pending donor-content items, T pending tip-content items.

**Steps:**

1. GET /api/v1/admin/action-center as admin.
2. Check sidebar badges for 'Community safety' and 'Publication reviews' and TopBar total.
3. Resolve one safety report and approve one publication item; navigate or wait 30s.
4. Click each action link (e.g., /publication-reviews?queue=donation-content-reviews).

**Expect:** API returns items safety=N, live-cleanup=M, publication-reviews=P, donation-content-reviews=D, tip-content-reviews=T. 'Community safety' badge = N+M; 'Publication reviews' badge = P+D+T. Counts drop after decisions on navigation/focus/30s refresh. Deep links open the correct queue. Non-admin GET returns 403.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `apps/admin/src/context/AdminActionContext.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## SAFETY-69 · P1 · Admin campaign Block ends live sessions and hides the campaign; Return to review

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** ACTIVE campaign C4 owned by Esi with an active live session; ADMIN-1 (not the owner).

**Steps:**

1. In admin /campaigns/<C4> Staff decision, enter notes, 'Block campaign'.
2. As guest open C4, its live watch URL, and donate URL.
3. Retry the same decision request with the same expectedVersion; then a different action with the stale version.
4. 'Return to review'.

**Expect:** C4 status blocked; not publicly visible; live session ended with moderationStoppedAt and providerStopPending cleared after reconcile; room closed. Same retry returns success without duplication; different action on stale version 409. Return to review moves C4 to pending_review (still private). Review history lists decisions. Owner-admin sees 'Another administrator must review your campaign.'

**Needs:** LiveKit credentials

**Source:** `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.ts`

## SAFETY-71 · P1 · Acceptable Use, Terms content licence and reporting contacts are published and consistent

*Surfaces:* ios, marketing, web  ·  *Type:* compliance

**Before:** Production marketing site and app.

**Steps:**

1. Open ujimora.com/acceptable-use, /terms (sections 10 Prohibited use, 11 Content and licence, 12 Suspension), and in-app /legal pages.
2. Check that the reporting address trust@ujimora.com and appeal address support@ujimora.com are shown and both mailboxes receive a test email.
3. Compare in-app report reasons (harassment, hate, sexual content, violence, child safety, credible threat, fraud, spam, other) against prohibited categories, including IP/privacy infringement.

**Expect:** Policies render on marketing and in-app with the current effective date; both inboxes monitored with an owner. Note: no in-app 'intellectual property' reason exists and IP complaints rely on 'other' or email — confirm this is acceptable or add a takedown path before launch.

**Needs:** Email provider / mailbox access

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/web/src/components/safety/ReportContent.tsx`

## SAFETY-75 · P1 · Host token denied to restricted host and after moderator stop

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** Ama's session S2 active; LiveKit configured.

**Steps:**

1. Restrict Ama; call POST /api/v1/live-sessions/<S2>/video/host-token.
2. Restore Ama; moderator stops S2; request host token for S2 again; try PATCH to un-end.

**Expect:** Restricted: 403 publishing restricted. Moderator-stopped session: token/visibility return 404 'Broadcast unavailable'; session cannot be revived; a new session requires a fresh start (and publication admission).

**Needs:** LiveKit credentials

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

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

## SAFETY-09 · P2 · Safety report rate limit (20 per 15 minutes)

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Yaw token; 21+ distinct reportable targets (or reuse invalid payloads, which also count).

**Steps:**

1. Send 20 POST /api/v1/safety/reports within 15 minutes.
2. Send the 21st.

**Expect:** 21st returns 429. After the window resets, reporting works again. Note: limiter is in-memory per API instance; if Render runs >1 instance, confirm the effective limit.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

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

## SAFETY-36 · P2 · Multiple restrictions collapse into one; restore from any report lifts all

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Two separate reports against Kofi (R1, R2).

**Steps:**

1. Restrict on R1, then restrict on R2.
2. Inspect contentrestrictions for Kofi.
3. Restore from R1's card.
4. Call restore again for the same user.

**Expect:** Current behavior: single restriction doc whose reason/reportId are overwritten by R2; restoring from R1 removes the restriction entirely even though R2 also restricted; repeat restore returns 200 and writes a duplicate audit entry. Decide whether this is acceptable operationally (record as risk).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/database/models/ContentRestrictionModel.ts`

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

## SAFETY-52 · P2 · Approved version can be republished repeatedly within 7 days (spam check)

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Kofi has an approved comment version for C1.

**Steps:**

1. Post the identical approved comment 3 times in a row.
2. Repeat for campaign.create: submit the identical approved campaign twice (within plan allowance).

**Expect:** Current behavior: each resubmission publishes (approval is not consumed), producing duplicates. Decide whether duplicate UGC/campaigns are acceptable or add single-use consumption before launch.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCommentCreation.ts`

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

## SAFETY-73 · P2 · Reported deleted comment and non-public update edge cases

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** Comment K2 already hidden/deleted; campaign C5 in pending_review with an update by its owner.

**Steps:**

1. As Yaw POST report targetType comment targetId K2.
2. As Yaw POST report targetType campaign_update for C5's update.
3. As C5 owner and as admin report the same update.

**Expect:** C5 update report by Yaw returns 404 'Campaign update not found'; owner/admin can report it. Deleted comment K2 is currently accepted (201) because the comment lookup ignores deletedAt — note as minor gap (queue noise).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

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
