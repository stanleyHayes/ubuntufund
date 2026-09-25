# Campaigns (90 cases)

Creation, review and publication, visibility states, updates and comments, sharing, QR and short links, explore/search, collaboration, split proceeds, expiry.

[Back to the QA plan](../README.md)

## CAMPAIGN-002 · P0 · Unverified account is blocked from creating campaigns (verification_required)

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U0: new individual account, email verified, no KYC records (verificationLevel NONE).

**Steps:**

1. As U0 open /campaigns/new on web.
2. Observe the alert and its 'Review verification' button, which links to /kyc. Confirm 'Continue' is disabled.
3. Call GET /api/v1/campaigns/creation-options with U0's token.
4. POST /api/v1/campaigns with a fully valid body (GHS, future endDate).
5. On mobile open Create as U0.

**Expect:** creation-options returns canCreate=false, creationBlockReason='verification_required', verificationCampaignLimit=0. The POST returns 403 'User cannot create more campaigns. Limit: 0, current: 0' and no campaign or publication review is created. Mobile shows 'Complete verification before creating another campaign.' with a 'Review eligibility' button that opens /kyc.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/domain/services/currentCampaignAllowance.ts`, `apps/api/src/domain/services/currentVerificationLevel.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`

## CAMPAIGN-004 · P0 · Expired KYC revokes creation and staff-approval eligibility

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** U1 with approved identity KYC and one pending_review campaign (goal > 250,000 on a plan that allows it). DB access to edit the KYC record's expiryDate. Admin A1.

**Steps:**

1. Set U1's latest identity KYC expiryDate to yesterday.
2. As U1 reload /campaigns/new and call creation-options.
3. POST a new campaign.
4. As A1 open the pending campaign in admin, tick both attestations, enter notes, and click 'Approve campaign'.
5. U1 re-verifies at /kyc and A1 approves the KYC in admin KYC review.
6. Retry creation and approval.

**Expect:** With KYC expired the allowance falls to 0/1: creation is blocked (403) and approval fails 409 'Current verification evidence does not support this campaign allowance. Renew verification before approval.' After re-verification both succeed.

**Needs:** None (DB access for time travel)

**Source:** `apps/api/src/domain/services/currentVerificationLevel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-006 · P0 · Plan goal caps are enforced at the boundaries on the server

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Verified individuals on each plan: Community (10,000), Plus (50,000), Pro (250,000), Organization (1,000,000), Enterprise (unlimited, admin-assigned).

**Steps:**

1. Community: enter Goal amount 10000 in the wizard. Continue is enabled.
2. Enter 10000.01 and observe the inline error 'Your current limit is GH₵10,000.00…'.
3. Bypass the UI: POST /campaigns with goalAmount 10000.01.
4. Repeat at the Plus 50,000/50,000.01 and Pro 250,000/250,000.01 boundaries, and for Organization at 1,000,000.
5. For Enterprise, POST 5,000,000.
6. POST goalAmount 0, -5, 'abc' and 1e308.

**Expect:** Values at the cap are accepted; cap+0.01 is rejected with 422 'Your <Plan> plan caps campaign goals at GHS <cap>. Upgrade for a higher goal.' Enterprise has no cap, but anything above 250k goes to pending_review. 0, negative and non-numeric values give 400 Validation failed; non-finite values give 422.

**Needs:** None

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `packages/types/src/subscription.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`

## CAMPAIGN-007 · P0 · Admin compliance cap binds below the plan cap

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** A1 with USERS permission. U1-Pro (plan cap 250,000). U1-Pro also has one pending_review campaign with goal 40,000 (created while the tier setting reviews every campaign).

**Steps:**

1. In admin Users → U1-Pro → 'Campaign eligibility', set the compliance limit to 20,000 with a reason.
2. As U1-Pro call creation-options and confirm maxGoal=20000.
3. In the wizard enter 25,000 and confirm the inline error.
4. POST goal 25,000 through the API.
5. A1 tries to approve the pending 40,000 campaign.
6. Upgrade U1-Pro to Organization and retry 25,000.
7. Clear the compliance limit and retry.
8. Check the admin audit log.

**Expect:** While the limit is set: 422 'A compliance review has capped your campaign goals at GHS 20,000.'; approval of the 40,000 campaign is blocked with 409; the plan upgrade does not lift the cap. After clearing, the plan cap applies. The limit change is audited.

**Needs:** None

**Source:** `apps/admin/src/pages/UserDetailPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminUserRoutes.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## CAMPAIGN-012 · P0 · Double submit and network drop on Publish must not create duplicate campaigns (Idempotency-Key)

*Surfaces:* android, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1-Plus with allowance 3 and 3 plan slots. Consent path configured so creation succeeds immediately. Devtools network throttling or a proxy.

**Steps:**

1. Web: double-click 'Publish campaign' rapidly.
2. Web: throttle the network, click Publish, and go offline right after the request leaves (the server commits but the client sees an error). Go back online and, without changing any field, click Publish again. In devtools compare the Idempotency-Key header of both POST /campaigns requests and read the second response.
3. Web: after a failed attempt change one field (for example the title) and publish; confirm this request carries a different Idempotency-Key.
4. Mobile: double-tap 'Create campaign'. Turn on airplane mode right after tapping, restore the network, and tap 'Create campaign' again without editing.
5. Web and mobile: repeat the uncertain-commit case, but close the tab or kill the app before the response arrives. Reopen, let the draft restore, and publish again.
6. Check /my-campaigns and GET /campaigns/mine and count the campaigns. Check creation-options totalCount and activeCount.

**Expect:** While the form stays open, exactly one campaign is created per intended submit. The button shows 'Setting up campaign…' and is disabled during the request. Both requests carry the same Idempotency-Key, and the retry returns 200 'Campaign already created' with the same campaign id. The success screen appears, totalCount rises by one and the draft is cleared. Editing any field produces a new key. Log any duplicate in these paths as a P0 defect. Remaining gap: the key is held only in memory. After a tab close or app kill, the restored draft is sent with a new key, so a second campaign is created if the first request had committed, and it uses a lifetime allowance slot. Record the result, and tell organizers in support copy to check My Campaigns before they resubmit. Known open issue I153: an approved content version can be reused for 7 days (single-use approvals are an owner decision).

**Needs:** OpenAI (screening)

**Source:** `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/hooks/useCampaigns.ts`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/lib/campaignCreationKey.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## CAMPAIGN-015 · P0 · Consent plus clean text-only content creates the campaign immediately

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** OPENAI_API_KEY valid. U1 is eligible. Goal ≤ 250,000. No cover image.

**Steps:**

1. Complete the wizard without a cover image.
2. On Review tick 'Use OpenAI to check this public text for safety (optional)'.
3. Click 'Publish campaign'.
4. Check the success screen copy.
5. In admin open Publication reviews → status 'approved' and find the campaign.create item.
6. Open /explore as a guest.

**Expect:** Success screen says 'Your campaign is live. Share it with your community.' The status is active and the campaign is visible publicly. The admin approved item shows it was reviewed by 'automated:openai'. Repeat on mobile with the same result.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiPublicationScreener.ts`, `apps/web/src/components/safety/PublicationConsent.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`

## CAMPAIGN-016 · P0 · Without consent the content is held privately and no campaign is created

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** U1 is eligible. Admin A2.

**Steps:**

1. Complete the wizard (text only) without ticking consent. Click 'Publish campaign'.
2. Read the error shown under Review, and the Publication reviews list that appears.
3. Call GET /campaigns/mine and GET /campaigns/creation-options.
4. As A2 open admin /publication-reviews → queue 'Publication proposals' → status pending.

**Expect:** Error: 'Saved privately for safety review. Your content has not been published…'. No campaign exists, and allowance and slots are unchanged. The admin sees 'campaign create · staff requested' with title, description, category, priority, beneficiaries, goal, currency and endDate. The author sees the item as pending in Settings → Publication reviews.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`, `apps/web/src/components/account/PublicationReviews.tsx`

## CAMPAIGN-017 · P0 · Staff-approved version creates the campaign only when resubmitted byte-identical

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** The pending item from CAMPAIGN-016. U1 keeps the wizard tab open (or reopens it; the draft is restored). Admin A2. Devtools to copy the POST body and Idempotency-Key.

**Steps:**

1. A2 enters notes of at least 20 characters and clicks 'Approve this version'.
2. U1 (unchanged form) clicks 'Publish campaign' again.
3. Confirm the campaign is created and see Settings → Publication reviews 'Approval expires …'.
4. Variant: after approval, change a single character in the story and publish.
5. Variant: after a successful creation, replay the same POST body through the API within 7 days, first with the same Idempotency-Key the browser sent, then with a new key, then with no key.

**Expect:** An identical resubmission creates the campaign with a status set by tier. Any change creates a new pending review (409 again). A replay with the same Idempotency-Key returns 200 'Campaign already created' with the original id and creates nothing. A replay with a new key or no key within 7 days creates a second campaign, which uses another allowance slot. Requirement: an approved version publishes at most once. Known open issue I153: single-use approvals were not implemented (owner decision). Only hidden comments and updates lose their approval.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## CAMPAIGN-018 · P0 · A campaign with a cover image always needs staff review; the held draft survives closing the tab or app

*Surfaces:* admin, android, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 is eligible. OpenAI configured. Admin A2. Use the same browser and the same phone throughout.

**Steps:**

1. Complete the wizard with a cover image and consent ticked, then publish.
2. Confirm 409 'Saved privately for safety review…' and that the admin queue item has reason 'media'.
3. Close the tab. Reopen /campaigns/new as U1 in the same browser.
4. Confirm the info alert 'We restored your unsent draft from this browser. If it is waiting for safety review, submit this same version again once it is approved.' with 'Start over', and that every field, including the same cover image, is restored. Do not re-upload.
5. A2 approves the original item. U1 goes to Review and clicks 'Publish campaign' without changes.
6. Reload /campaigns/new and confirm the form is empty with no restore alert.
7. Variant: after the restore, re-upload the same file and publish.
8. Repeat on mobile: after the 409, background the app and kill it before approval. Reopen Create, confirm 'We restored your unsent draft from this device…', and after approval tap 'Create campaign'.
9. Variant: open /campaigns/new as U1 on a second browser or device.

**Expect:** Consent never bypasses staff review when media is attached. The exact held version, cover URL included, is restored after a tab close or app kill. Publishing it unchanged after approval creates the campaign and clears the draft. A re-upload produces a new Cloudinary URL, so it is held again as a new version. Known open issue I073 (mitigated): drafts are kept only in that browser or device, for 30 days, and are removed on explicit sign-out, so a second device starts empty. There is no server-side 'publish approved version' and no staff alert for new publication reviews, so organizers must check back themselves.

**Needs:** Cloudinary, OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/lib/publicationDrafts.ts`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/lib/publicationDrafts.ts`

## CAMPAIGN-022 · P0 · Current legal agreement and publishing restriction gates on creation and approval

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** U2 is an eligible organizer whose legal acceptance is on an outdated version (DB edit). U3 is eligible. Admin A1 with Safety reports access.

**Steps:**

1. U2 publishes a campaign with consent.
2. U2 accepts at /account-agreement and retries.
3. A1 applies a publishing restriction to U3 via the Safety reports queue.
4. U3 tries to publish a campaign.
5. A1 restores U3 ('restore' action) and U3 retries.
6. Leave a pending_review campaign by a restricted organizer and have A1 attempt approval.

**Expect:** U2 first gets 428 'Accept the current account agreement before publishing', and succeeds after accepting. Restricted U3 gets 403 'Publishing is restricted. Contact support@ujimora.com to appeal.' and succeeds after restore. Approval for a restricted organizer returns 409 'The organizer is unavailable or publishing is restricted'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## CAMPAIGN-024 · P0 · Risk-tier auto-approval at each default threshold

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Default settings: thresholds 10k/50k/250k/1M, autoApproveMaxTier 3. ORG on the Organization plan with current business KYB and no prior published campaign, enough allowance and slots. OpenAI consent path.

**Steps:**

1. Create campaigns with goals 10,000; 10,000.01; 50,000; 250,000; 250,000.01.
2. For each, check the returned status, the tier shown in admin detail, and public visibility.

**Expect:** Goals up to 10,000 are tier 1 and go active. 10,000.01 and 50,000 are tier 2, active. 250,000 is tier 3, active. 250,000.01 is tier 4 and goes to pending_review. Boundaries are inclusive in the lower tier.

**Needs:** OpenAI

**Source:** `apps/api/src/domain/services/campaignTier.ts`, `apps/api/src/domain/services/campaignApproval.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/config/index.ts`

## CAMPAIGN-025 · P0 · First campaign above 250k is held: reviewer alert email, not public

*Surfaces:* admin, api, email, web  ·  *Type:* compliance

**Before:** RESEND API key and from-address configured. Review alert address set in admin Settings → Campaigns 'Send review alerts to' (or REVIEW_ALERT_EMAIL). ORG as in CAMPAIGN-024.

**Steps:**

1. Create a campaign with goal 300,000.
2. Check the success copy.
3. As the owner open /campaigns/:id.
4. As a guest open /campaigns/:id and /c/:slug.
5. Check the reviewer inbox.
6. Trigger a retry of the same alert (for example re-run creation of an identical pending campaign) and count emails.
7. Clear the alert address and create another held campaign.

**Expect:** Success copy: 'Your campaign is awaiting review…'. The owner sees a 'Pending Review' chip and 'Donations closed'. Guests get not-found. One email arrives, subject 'Campaign awaiting review — <title> (GHS 300,000)', with a link to the admin campaign page. The Idempotency-Key prevents duplicates. An empty address sends nothing and causes no error.

**Needs:** Email provider (Resend)

**Source:** `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/admin/src/components/CampaignReviewSettings.tsx`

## CAMPAIGN-026 · P0 · Verified returning organizer exception for goals above 250k

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** ORG-A: current approved business KYB and one earlier active, funded or expired campaign. ORG-B: same, but its only earlier campaign is pending or blocked. ORG-C: latest business KYB record is pending re-verification or expired. IND: individual on the Enterprise plan with current identity KYC and an earlier active campaign.

**Steps:**

1. Each account creates a campaign with goal 500,000 (consent path).
2. Record the status of each.

**Expect:** ORG-A and IND go active immediately. ORG-B and ORG-C go to pending_review. An older approval superseded by a newer pending or rejected record, or an expired one, does not qualify.

**Needs:** OpenAI

**Source:** `apps/api/src/domain/services/campaignApproval.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `docs/compliance/CAMPAIGN_APPROVAL.md`

## CAMPAIGN-028 · P0 · Staff approve a pending campaign end to end

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** A pending_review campaign by ORG with a cover image. Admin A2 (not the creator).

**Steps:**

1. Admin → Campaigns → Pending tab → open the campaign.
2. Review the panel: story, beneficiaries, URL, tier, fee lock, dates. Click 'Open attachment 1'.
3. Confirm 'Approve campaign' is disabled until both attestation checkboxes are ticked and 'Decision notes (at least 20 characters)' is filled.
4. Click Approve.
5. Check Review history ('approve · pending_review → active', version, notes), use Export (PDF/XLSX/CSV), and check the Audit log for 'campaign.approve'.
6. As ORG open /my-campaigns and the public /c/:slug.

**Expect:** Status becomes active and the campaign is public with donations open. History and the audit entry are recorded once. Exports contain the decision and the content snapshot.

**Needs:** None

**Source:** `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/admin/src/pages/CampaignDetailPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.ts`

## CAMPAIGN-030 · P0 · Blocking an active fundraiser with a live broadcast and open viewers

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Active campaign with donations, a QR code, an active LiveKit session, a guest with /campaigns/:id open (SSE connected), and an Android viewer on the live screen. The owner has a saved payout account and a PENDING payout request.

**Steps:**

1. Admin clicks 'Block campaign' with notes.
2. Guest: focus or refresh the page.
3. Try donations via /c/:slug/donate (Paystack), wallet POST /campaigns/:id/donate, Android donate, and iOS 'Continue in browser'.
4. Check /sitemap.xml, the Explore list, GET /campaigns/:id/comments and /updates as guest, and GET /campaigns/:id/split.
5. Check raisedAmount and the ledger are unchanged.
6. As the owner request a new cashout; as an admin try to approve the payout requested before the block.
7. Check the owner's in-app notifications.

**Expect:** Guest pages show not-found and the SSE stream closes. The live session ends, viewers are disconnected, and a provider stop is queued or confirmed. Every donation rail is rejected. The campaign is removed from the sitemap, Explore and public comments and updates, and GET /split returns 404 to guests. Balances are untouched and the owner still sees it as blocked. By design, a Paystack charge already in flight that settles after the block still credits the campaign once. Both the new payout request and the approval of the earlier one return 409 'This campaign is under review; payouts are paused'. The owner gets one in-app notice, 'Your campaign has been blocked', which points to support@ujimora.com and does not include staff notes.

**Needs:** LiveKit credentials, Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `docs/compliance/CAMPAIGN_VISIBILITY.md`

## CAMPAIGN-033 · P0 · Approval guardrails on organizer eligibility

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Several pending campaigns, one per blocked condition: organizer legal acceptance outdated; organizer restricted; goal above organizer compliance cap; organizer KYC expired; verificationLevel 0.

**Steps:**

1. For each, tick the attestations, enter notes and click 'Approve campaign'.
2. Via API, send approve with contentReviewed=false.

**Expect:** Each condition returns 409 with a specific message (legal acceptance / restricted / 'Current organizer verification or compliance limits do not permit approval' / allowance). Missing attestations return 400 'Confirm review of the complete public content, media and fundraising evidence'. No status change and no history entry is written.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## CAMPAIGN-034 · P0 · Moderation endpoints reject non-admins, self-review and stale roles

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** U1 (member). A1, who created a campaign while an admin. A2. A staff RBAC role without CAMPAIGNS permission.

**Steps:**

1. As U1 call PUT /api/v1/campaigns/:id/review, /approve, /reject, GET /campaigns/:id/reviews and GET /api/v1/admin/publication-reviews.
2. Repeat logged out.
3. A1 tries to review their own campaign.
4. Demote A2 to the user role while A2's session is open, then A2 submits a decision.
5. The RBAC role without CAMPAIGNS permission opens admin /campaigns.

**Expect:** Member calls return 403 and logged-out calls return 401. Self-review returns 403 'Another administrator must review your campaign'. The demoted session returns 403 'Current administrator access is required'. The admin console hides or blocks the Campaigns page for that role.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignModerationRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/admin/src/router.tsx`

## CAMPAIGN-036 · P0 · Non-public campaigns are hidden on every read path

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** Campaigns in pending_review and blocked, plus a DB-crafted draft. A guest, an unrelated user U2, the owner, and admin A1.

**Steps:**

1. As guest and as U2: web /campaigns/:id, /c/:slug and /c/:id, and native campaign/[id].
2. Call GET /api/v1/campaigns, /campaigns/:id, /campaigns/slug/:slug/public, and /campaigns/:id/comments, /updates, /collaborators, /donations.
3. Check /organizations/:slug campaignCount and totals, the leaderboard, and the sitemap.
4. As the owner: /campaigns/:id (chip visible, robots 'noindex, follow'), then /campaigns/slug/:slug/public.
5. As A1: admin list and detail.

**Expect:** Guests and U2 get 404 or not-found and no aggregates include the campaign. The owner can read the detail page, but the public slug endpoint still returns 404. The admin can see everything. Responses are Cache-Control private, no-store.

**Needs:** None

**Source:** `apps/api/src/domain/services/campaignVisibility.ts`, `apps/api/src/application/use-cases/GetCampaignUseCase.ts`, `apps/api/src/application/use-cases/GetCampaignBySlugUseCase.ts`, `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`, `docs/compliance/CAMPAIGN_VISIBILITY.md`

## CAMPAIGN-037 · P0 · FUNDED campaigns keep accepting donations on every surface

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Active campaign, goal GHS 100. Paystack test keys. Donor D.

**Steps:**

1. D donates GHS 100 via /c/:slug/donate. Confirm status becomes funded.
2. Web /campaigns/:id: check the 'Donate now' button and 'Continue to checkout'.
3. Web /c/:slug: check the Donate CTA.
4. Scan an amount QR and complete a donation.
5. Android: Donate Now → Paystack.
6. iOS: Donate Now → 'Continue in browser' → complete in Safari.
7. Donate GHS 50 more (overfunding).

**Expect:** Every surface accepts donations, including the /c/:slug QR/social landing page. It shows an enabled 'Donate now' for a funded campaign because it uses the shared rule (active or funded, and before the end date). Raised shows 150 with the progress bar capped at 100%.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/pages/DonatePage.tsx`, `packages/types/src/campaign.ts`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`

## CAMPAIGN-039 · P0 · Raised amount, funded flip, refunds and donor count stay accurate

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Active campaign, goal GHS 100.00. Signed-in donors D1 and D2, and a guest browser. Paystack test keys. Refund permissions for the admin.

**Steps:**

1. D1 donates 50.00, then D2 donates 49.99 (anonymous), then D1 donates 0.01.
2. After each, record raisedAmount on detail, card %, admin detail and ledger totals, and donorCount.
3. After the 0.01 donation confirm the status is funded.
4. Two guests (not signed in) each donate 1.00 through /c/:slug/donate. Record donorCount.
5. Admin refunds 20.00 of D2's gift.
6. Refund more than the remaining raised total (if allowed by the refund flow).
7. Check the admin overview raised tile.

**Expect:** raisedAmount equals the sum of settled donations exactly, with no float drift (99.99 → 100.00). donorCount counts each signed-in donor once (D1 once, anonymous D2 included) and each guest donation as its own supporter, so it is 4 after the two guest gifts. The status flips to funded at exactly 100.00. The 20.00 refund lowers raised from 102.00 to 82.00, but the status stays funded (by design). raisedAmount never goes below 0 and matches the ledger projection. The admin overview tile is labelled 'Net raised (GH₵, after refunds)' and excludes the refund.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.ts`, `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/application/use-cases/GetCampaignUseCase.ts`, `apps/web/src/components/campaigns/CampaignCard.tsx`

## CAMPAIGN-040 · P0 · Platform fee % is locked at campaign creation

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** U1-Pro (2.5% fee). Admin with PLANS permission. Paystack test keys.

**Steps:**

1. U1-Pro creates campaign C1. In admin detail, check the fee lock is 2.5.
2. Admin → Plans changes Pro platformFeePercent to 3.0.
3. Donate GHS 200 to C1 and inspect the fee breakdown in the receipt, ledger and admin donation.
4. U1-Pro creates campaign C2 and donates GHS 200 to it.
5. Downgrade U1 to Free (3.5%) and donate to C1 again.

**Expect:** Every donation to C1 is charged at 2.5% (GHS 5.00 on 200) regardless of later plan changes or downgrade. C2 is charged 3.0% (GHS 6.00). Net-to-campaign amounts are exact to the pesewa.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/admin/src/pages/ManagePlansPage.tsx`

## CAMPAIGN-046 · P0 · Native campaign detail and donation routing follow store rules

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** iOS and Android release builds. An active campaign, a funded campaign and a legacy campaign with no slug. Paystack test keys.

**Steps:**

1. iOS: open the campaign, tap 'Donate Now', see the 'Support this campaign' screen, tap 'Continue in browser'. Confirm Safari opens https://app.ujimora.com/c/<slug>/donate with only amount or liveSessionId in the query.
2. iOS: confirm no in-app amount, wallet or crypto form is shown, and read the screen copy.
3. iOS: repeat for the funded campaign, then for the no-slug legacy campaign.
4. Android: 'Donate Now' opens the in-app form and then Paystack hosted checkout, and returns to the app.
5. Both: 'Share', 'Watch live broadcast' (when live), and 'Manage campaign'/'Go live' only for the owner. Updates, comments and collaborators render. Scroll the whole screen and check the amounts' format.

**Expect:** iOS never takes payment in the app. The screen reads 'Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.' Funded campaigns can still receive donations. The legacy no-slug campaign opens https://app.ujimora.com/c/<24-hex id>/donate and can be paid; only closed campaigns show 'This campaign is not accepting donations right now.' Android completes Paystack checkout. The detail screen no longer has an 'Accepted Payment Method: Ujimora Wallet' section. Amounts use two decimals (for example GH₵100.50), and collaborators show their role only. Owner controls ('Manage campaign', 'Go live', 'Post an update') are hidden from other users.

**Needs:** Paystack test keys, physical devices

**Source:** `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/lib/money.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## CAMPAIGN-059 · P0 · Reporting a campaign on web and reviewing it in the admin Campaign reports queue

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Active campaigns by U1. Donors D and D-extra (one report per reporter per campaign, so use a fresh reporter or campaign for each reason). Admin A1 with REPORTS permission.

**Steps:**

1. As a guest click 'Report Campaign'. Confirm redirect to /login.
2. As D: in the 'Report Campaign' dialog check the 'Reason for Report' options (Fraudulent Activity, Misleading Information, Inappropriate Content, Spam, Illegal Activity, Intellectual property / copyright, Privacy or likeness, Other), choose one, add a description, and click 'Submit Report'. Submit the other reasons with fresh reporters or campaigns.
3. D reports the same campaign again.
4. U1 reports their own campaign.
5. POST a description longer than 2000 characters.
6. As A1 open admin Trust & Safety → 'Campaign reports' (/campaign-reports), status 'pending', and find D's report.
7. Enter 19 characters of notes, then 20 or more, and click 'Mark reviewed'. Dismiss another report the same way.
8. Call GET /api/v1/reports?status=pending and PUT /api/v1/reports/:id/review {status:'reviewed', notes:'<20+ chars>'} on a pending report. Replay the PUT, and send one without notes.
9. Check D's in-app notifications and the admin action centre.

**Expect:** The first report returns 201 and the dialog shows 'Thank you for reporting this campaign. Our team will review it shortly.'. A repeat returns 409 'You have already reported this campaign', a self-report 403 'You cannot report your own campaign', and the long description 400. The report appears in admin 'Campaign reports' with its reason, the campaign's current status, links to the campaign and reporter, and the description. Decision buttons stay disabled until the notes reach 20 characters. A decision records the reviewer, time and notes, writes the audit entry campaign_report.reviewed or campaign_report.dismissed, and does not change the campaign. The API requires notes (400 without them), and a second decision returns 409 'Report has already been reviewed'. D gets an in-app notice 'We reviewed your report'. The action centre's 'Campaign reports from supporters' count matches the pending queue.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`, `packages/types/src/campaign.ts`

## CAMPAIGN-060 · P0 · Reporting a campaign from the native apps

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Signed-in donor D on iOS and Android release builds. An active campaign by another user. The campaign creator's account on a second device.

**Steps:**

1. Open the campaign and scroll to 'Report Campaign'.
2. Tap it. Confirm the 'Report campaign' dialog with a Reason picker and 'Additional details (optional)', and that 'Send report' stays disabled until a reason is chosen.
3. Choose 'Misleading information', add details and tap 'Send report'. Watch the result and the network or API logs.
4. Leave and reopen the campaign, then report it again.
5. As the campaign's creator, open the campaign.
6. Log out, tap 'Sign in to report this campaign', and sign in.
7. In admin, open /campaign-reports.

**Expect:** The report is stored (201) and the button is replaced by 'Thank you. Our team will review this campaign.' The reason list is the API's own list (Fraudulent activity, Misleading information, Inappropriate content, Spam, Illegal activity, Intellectual property or copyright, Privacy violation, Other), so the server can no longer reject the reason with 400. A second report shows the server message 'You have already reported this campaign' in the dialog. The creator sees no report button. Signed-out viewers are sent to sign in and returned to the campaign. The report appears in the admin Campaign reports queue. The store UGC-reporting requirement (Apple 1.2 / Play UGC) is met.

**Needs:** Physical devices

**Source:** `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/src/components/ReportCampaign.tsx`, `apps/mobile/src/lib/campaignReport.ts`, `packages/types/src/campaign.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## CAMPAIGN-070 · P0 · Split proceeds are fully off when the flag is unset

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** SPLIT_PROCEEDS_ENABLED unset or false (production default). U-Pro.

**Steps:**

1. In the wizard, confirm 'Set up split proceeds' is disabled with 'Split proceeds are not currently enabled.'
2. GET creation-options returns splitEnabled=false and canSplit=false.
3. POST /campaigns/:id/split with valid allocations.
4. Mobile: the split switch is hidden.
5. Donate and check that no beneficiary accruals appear.
6. GET /campaigns/:id/split/payouts.

**Expect:** The POST returns 403 'Split proceeds are not enabled'. Donations credit only the campaign. Beneficiary payout routes report the feature as disabled. No money path touches split tables.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/application/services/SplitAccrualService.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/web/src/components/campaigns/CampaignCreationExtras.tsx`

## CAMPAIGN-071 · P0 · Creating a split draft validates shares (flag on)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true in staging. U-Pro and U-Plus.

**Steps:**

1. U-Pro wizard: tick 'Set up split proceeds'. The default rows are 50/50.
2. Set 49.99/50: client error 'Check split eligibility… totalling 100% (up to two decimals).'
3. Set 33.333: client rejects it.
4. Via API: 1 allocation; shares totalling 9999 bps; duplicate beneficiaryId; 51 rows; shareBps 0.
5. Save a valid 3-way 33.33/33.33/33.34 draft. Confirm the alert 'Split saved as a draft. Beneficiary consent and activation are still required.'
6. U-Plus tries to POST a split.
7. Mobile Manage campaign → SplitManager: create the same draft.

**Expect:** The server gives 400 with specific messages ('A split needs at least two beneficiaries', 'Shares must total 100% (10000 bps); got 9999', 'Duplicate beneficiary…'). U-Plus gets 403. The detail page shows 'Split proceeds · draft' and every allocation 'Consent: pending'. Web and native behave the same.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/domain/entities/CampaignSplitVersion.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/components/campaigns/CampaignSplitSetup.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`

## CAMPAIGN-072 · P0 · Recording split consent and activating the split

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A draft split v1 with 3 beneficiaries: one whose beneficiaryId is a platform user B1, and two external. Unrelated user U2.

**Steps:**

1. Owner: for each beneficiary tick 'I have received <name>'s acceptance' and click 'Record acceptance'.
2. Before all have accepted, confirm 'Activate agreed split' is disabled.
3. Via API, set one consent to 'declined' and try to activate.
4. B1 records their own consent through the API.
5. U2 tries to record consent and to activate.
6. Accept all and click 'Activate agreed split'.
7. Create v2, get consent, activate it, and check that v1 is superseded.

**Expect:** Activation needs every consent (declined gives 422). U2 gets 403. After activation the status is active and exactly one version is active per campaign. Policy review: owners can attest consent for every beneficiary and external beneficiaries are never contacted even though an email is collected. Compliance sign-off required.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignSplitRepository.ts`, `apps/web/src/components/campaigns/CampaignSplitSetup.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`

## CAMPAIGN-073 · P0 · Split accrual money accuracy, locking, replay and refunds

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Active split 3333/3333/3334 bps. Paystack test keys with a webhook replay tool. Admin refund access.

**Steps:**

1. Donate GHS 100.00. From the settlement breakdown, compute beneficiaryNet after the locked platform fee and processing.
2. GET /campaigns/:id/split/beneficiaries: confirm pending balances sum exactly to beneficiaryNet in pesewas with deterministic remainder handling.
3. Donate 0.01, 1.00 and 99.99 and repeat the check.
4. Try to change consent on the now-locked version. Expect 409 'A locked split version cannot change consent'.
5. Replay the Paystack webhook for the same donation twice.
6. Activate amendment v2 and donate. Confirm the new donation uses v2 and earlier ones stay on v1.
7. Refund 50.00 of the first donation. Confirm the proportional reversal and the beneficiary statement lines.

**Expect:** There is no drift at any amount. Replays never double-accrue. The lock and amendment are prospective only. Refund reversals are proportional and capped. Campaign raisedAmount, ledger and beneficiary balances reconcile.

**Needs:** Paystack test keys (webhooks)

**Source:** `apps/api/src/application/services/SplitAccrualService.ts`, `apps/api/src/application/services/splitDistribution.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignSplitRepository.ts`, `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`

## CAMPAIGN-074 · P0 · Donors are told about split proceeds before paying

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A campaign with an active split (for example Ama 60%, Kofi 40%). A pending and a blocked campaign, each with an active split. A campaign with only a draft split. The owner's and an admin's tokens.

**Steps:**

1. As a guest open /campaigns/:id, /c/:slug and /c/:slug/donate on web, the native campaign detail, and the Android donate screen. On iOS check the campaign detail and the website donate page in Safari.
2. Read the notice shown before the Donate button.
3. Call GET /api/v1/campaigns/:id/split as a guest for each campaign. Repeat for the pending campaign with the owner's token and with an admin token.
4. Open the draft-only campaign's pages.

**Expect:** Every donor surface shows an info notice before payment: 'This campaign's proceeds are shared: Ama 60%, Kofi 40%.' (shares up to two decimals). Guests get 404 'Campaign not found' from GET /split for pending, blocked or missing campaigns, so beneficiary names no longer leak. The owner and admins still get the disclosure. A campaign without an active split shows no notice (GET returns null). Still open as an owner decision (see CAMPAIGN-072): owners record consent for every beneficiary, and external beneficiaries are never contacted.

**Needs:** SPLIT_PROCEEDS_ENABLED=true in staging to create the splits

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`, `apps/web/src/components/campaigns/SplitDisclosure.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/mobile/src/components/SplitDisclosure.tsx`, `apps/mobile/app/donate/[id].tsx`

## CAMPAIGN-080 · P0 · Store-reviewer demo account can use campaign tools

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** The demo account named in APP_REVIEW_NOTES.md. Release builds. OPENAI_API_KEY set in production.

**Steps:**

1. In admin, confirm the demo account's identity KYC is approved with an expiry beyond the review window.
2. Confirm the lifetime campaigns used are below the allowance (3; blocked and ended campaigns still count). Confirm no open campaign occupies the Free-plan slot; a campaign whose end date has passed no longer does. Alternatively, give the account a paid plan via store sandbox.
3. On iOS and Android create a text-only campaign with consent ticked.
4. Donate to that campaign on iOS (Safari handoff) and on Android.
5. Post a comment, report a comment, and report the campaign from the native 'Report Campaign' dialog with a reason (see CAMPAIGN-060).
6. Record a cleanup procedure after each review round (block or let reviewer campaigns end so they free the slot).

**Expect:** The reviewer can create a live campaign without staff delay, sees store-compliant donation behaviour, and every UGC report path works: the campaign report is accepted and shows 'Thank you. Our team will review this campaign.'. Any 'verification_limit' or 'plan_limit' block, or a held-for-review response during review, is a store-rejection risk.

**Needs:** OpenAI, Paystack test/live keys, store sandbox, physical devices

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `apps/api/src/domain/services/currentCampaignAllowance.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/mobile/src/components/ReportCampaign.tsx`

## CAMPAIGN-N001 · P0 · Admin Campaign reports queue: filters, decisions with notes, concurrency and permissions

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** At least 3 pending campaign reports (from CAMPAIGN-059/060), one about a campaign that is already blocked. Admins A1 and A2. A staff role without REPORTS permission, and one with REPORTS read but not update. A member account.

**Steps:**

1. A1: sidebar Trust & Safety → 'Campaign reports' (/campaign-reports). Confirm the analytics page is now labelled 'Analytics reports'.
2. Check each card: the reason chip (fraud and illegal activity in red), the 'Campaign <status>' chip (for example 'Campaign blocked'), the campaign title link, 'Received … · Reporter <id>' with a link to the reporter, the description or 'No details were given.', and the info alert saying decisions do not change the campaign.
3. Switch the Status filter between pending, reviewed and dismissed. Page through and use Export.
4. Type 19 characters of notes: 'Mark reviewed' and 'Dismiss' stay disabled. Type 20 or more and click 'Mark reviewed'.
5. A1 and A2 open the same pending report. A1 clicks 'Dismiss', then A2 clicks 'Mark reviewed'.
6. A1 files a campaign report from the web app, then reviews that report in the queue.
7. Compare the admin action centre 'Campaign reports from supporters' count before and after the decisions.
8. Log in with the role lacking REPORTS, then with the read-only REPORTS role.
9. Via the API: GET /api/v1/reports?status=bogus, ?pageSize=500, GET /api/v1/reports/not-an-id, and PUT /api/v1/reports/:id/review without notes. Then repeat these calls as the member.
10. Check the audit log and the reporters' notifications.

**Expect:** The queue lists supporter campaign reports by status. A decision needs at least 20 characters of notes. It stores the reviewer, time and notes (shown on reviewed and dismissed cards), writes one audit row 'campaign_report.reviewed' or 'campaign_report.dismissed', and sends the reporter one 'We reviewed your report' notice. The campaign is left untouched. The concurrent second decision gets 409 'Report has already been reviewed', and the first reviewer's notes stand. The action centre count drops accordingly. Without REPORTS permission the page is blocked; with read-only access the notes field and buttons are disabled. API: a bad status returns 400 'Status must be pending, reviewed or dismissed', pageSize over 100 returns 400 'Page size must be a whole number between 1 and 100.', a bad id returns 404 'Report not found', and missing notes return 400. Members get 403. Record the result of the self-review step: campaign reports have no self-review guard (unlike safety reports, where a reviewer who filed the report gets 403), so decide whether this is acceptable.

**Needs:** CAMPAIGN-059 or CAMPAIGN-060 (reports to review)

**Source:** `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/admin/src/router.tsx`, `apps/admin/src/components/layout/Sidebar.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AdminReportController.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`, `apps/api/src/application/use-cases/ListReportsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAdminReportRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminActionRoutes.ts`

## CAMPAIGN-N004 · P0 · POST /campaigns Idempotency-Key contract (API)

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** U1 eligible, with allowance for at least 2 more campaigns. U2 eligible. Consent path (text only), so creation is immediate. An HTTP client that can send parallel requests.

**Steps:**

1. POST /api/v1/campaigns with Idempotency-Key 'qa-create-000000000001' and a valid body.
2. Repeat the identical request.
3. Repeat with the same key but a different title, then with a different goalAmount.
4. Repeat with the same key and the same title, description, goal, category and endDate, but different beneficiaries or priority.
5. Send the keys 'short', one containing a space, and one of 101 characters.
6. As U2, send the step-1 key with U2's own body.
7. Send 3 identical requests in parallel with a fresh key.
8. Use up U1's lifetime allowance, then replay the step-1 request.
9. Send two identical requests with no Idempotency-Key.

**Expect:** Step 1: 201 'Campaign created successfully'. Step 2: 200 'Campaign already created' with the same id, and allowance and slots are unchanged. Step 3: 409 'This Idempotency-Key was already used for a different campaign. Submit again with a new key.' Step 4: 200 with the original campaign, because the replay check compares only title, description, goal, category and end date; record this. Bad keys: 400 'Idempotency-Key must be 16-100 letters, digits, hyphens or underscores'. Keys are scoped per creator, so U2 gets a new campaign. Parallel same-key requests create exactly one campaign and the others get 200 replays, with no 500. The step-8 replay still returns 200 with the original campaign, not 403. Without a key, each request creates a campaign, as older app builds expect.

**Needs:** OpenAI (screening)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/infrastructure/database/models/CampaignModel.ts`

## CAMPAIGN-001 · P1 · Start-a-campaign entry points require sign-in and return to the wizard

*Surfaces:* android, ios, marketing, web  ·  *Type:* functional

**Before:** Logged out in the browser and the apps. Test account U1 (identity KYC approved, Community/Free plan, no campaigns).

**Steps:**

1. On ujimora.com click the hero 'Start a campaign' CTA, then the bottom CTA section link. Both point to app.ujimora.com/campaigns/new.
2. Confirm you are redirected to /login.
3. Sign in as U1.
4. Confirm you land back on /campaigns/new with the 'Rally your community' banner and the 4-step wizard.
5. View the page source/head and confirm robots 'noindex, nofollow'.
6. On iOS and Android while logged out, tap the Create tab.
7. Confirm /campaign/create shows the sign-in-required state for 'campaign creation' and makes no API call to /campaigns/creation-options.
8. From that screen tap the sign-in button, sign in as U1, and confirm the app returns to the Create wizard ('Step 1 of 4 · Basics'), not the Home tab.

**Expect:** Every entry point enforces authentication and returns to the wizard after login: on web through the login redirect, on native because the sign-in gate passes returnTo=/campaign/create through login. The create page is not indexable.

**Needs:** None

**Source:** `apps/marketing/src/components/sections/HeroSection.tsx`, `apps/marketing/src/components/sections/CTASection.tsx`, `apps/web/src/router.tsx`, `apps/web/src/pages/CreateCampaignPage.tsx`, `apps/mobile/app/(tabs)/create.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/components/SignInRequired.tsx`, `apps/mobile/src/navigation/returnTo.ts`

## CAMPAIGN-003 · P1 · Lifetime allowance by verification level counts every campaign, including rejected and blocked ones

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** U1-Pro: identity KYC approved with a future expiry (NATIONAL_ID ⇒ allowance 3), Pro plan (10 active slots). ORG: business KYB approved (INSTITUTIONAL ⇒ 10). Admins A1 and A2.

**Steps:**

1. As U1-Pro create 3 campaigns. Use consent and text only so they go live.
2. A1 opens admin /campaigns/:id for one of them and clicks 'Block campaign' with notes of at least 20 characters.
3. As U1-Pro reload /campaigns/new and call GET /campaigns/creation-options.
4. Attempt a 4th campaign through the API.
5. Repeat the check for ORG (allowance 10) and, if available, a political/media-verified account (25).

**Expect:** After 3 campaigns U1-Pro gets creationBlockReason 'verification_limit' and the POST returns 403, even though one campaign is blocked. Allowances match [0,1,3,10,25]. The product owner signs off that blocked or rejected campaigns permanently use up the allowance (there is no delete). Known open issue I076: whether rejected/blocked campaigns should keep consuming the lifetime allowance (and whether any editing should exist) is still an open product decision; this case records current behaviour.

**Needs:** None

**Source:** `apps/api/src/domain/services/currentCampaignAllowance.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-005 · P1 · Plan active-campaign slot limits and the upgrade path

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 on the Community (Free) plan with 1 active campaign and allowance left. Paystack test keys for a web subscription, or a store sandbox for native.

**Steps:**

1. As U1 open /campaigns/new.
2. Confirm the alert with a 'Manage plan' button to /subscription, and that Continue is disabled.
3. POST /api/v1/campaigns directly.
4. Put one campaign in pending_review and one in funded state and confirm both still use a slot. Block one and confirm the slot is freed.
5. Upgrade to Plus (web Paystack test, or App Store/Play sandbox IAP on native).
6. Reload the wizard and create a second campaign.

**Expect:** While at the limit: creationBlockReason 'plan_limit'; the API returns 403 'Your Community plan allows 1 active campaign. Upgrade to create more.'; mobile shows 'Your plan's active campaign allowance is full.' pending_review and funded campaigns count toward the slot; blocked ones do not. After the upgrade, creation succeeds up to 3 active campaigns.

**Needs:** Paystack test keys (web subscription) or store sandbox (native IAP)

**Source:** `apps/api/src/application/services/PlanLimitsService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `packages/types/src/subscription.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`

## CAMPAIGN-008 · P1 · API field validation for POST /campaigns (negative cases)

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** U1 is eligible to create. Use an HTTP client with U1's bearer token. CLOUDINARY_CLOUD_NAME configured on the API.

**Steps:**

1. Send currency 'USD'.
2. Send an endDate in the past, and one equal to now.
3. Send endDate '2026-12-01' (not a full ISO datetime).
4. Send titles of 2 and 201 characters, and descriptions of 9 and 5001 characters.
5. Send 21 beneficiaries, one 201-character beneficiary, and a body with no beneficiaries field.
6. Send category 'sports' and priority 'high'.
7. Send 11 imageUrls, then imageUrls ['not-a-url'].
8. Send imageUrls with, in turn: a non-Cloudinary https URL, an https://res.cloudinary.com/<another-cloud>/image/upload/... URL, an http:// Cloudinary URL, 'javascript:alert(1)' and a data: URL.
9. Upload a cover with POST /api/v1/uploads/image?folder=campaigns and send the returned https://res.cloudinary.com/<configured cloud>/image/upload/... URL in imageUrls.

**Expect:** Currency: 422 'Campaign goals must be in GHS'. Past date or now: 422 'End date must be in the future'. Schema breaches: 400 'Validation failed' with a per-field error. An omitted beneficiaries field does not cause a 500 (record the stored value). Every image URL that is not an https image on this deployment's Cloudinary cloud (third-party host, other cloud, http, javascript:, data:, 'not-a-url') is rejected with 400 'Validation failed' and the field error imageUrls.0: 'Upload the image through Ujimora'; nothing is saved and no publication review is created. The URL returned by /uploads/image is accepted. Values stored before this release are not rewritten: if legacy off-platform images exist, confirm admin 'Open attachment' and web never render them as executable links.

**Needs:** Cloudinary (for the accepted-URL step)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`

## CAMPAIGN-009 · P1 · Web wizard step navigation and client validation (no separate summary field)

*Surfaces:* web  ·  *Type:* functional

**Before:** U1 is eligible. Desktop and 390px mobile viewport. Devtools network tab.

**Steps:**

1. Basics: title 'Help' shows 'Use at least 5 characters'. Confirm the step has only the title and category (no 'Short summary' field) and the page roadmap hint reads 'Title & category'. With no category selected, 'Continue' is disabled.
2. Story: 'Your story' with fewer than 20 characters shows an error, and 'Who will this help?' needs at least one comma-separated name.
3. Goal & timeline: goal 0 shows 'Goal must be greater than zero', and today's date shows 'Pick a future date'. Choose a priority card (Normal, Urgent or Critical).
4. Review: check every ReviewItem (Title, Category, Description, Beneficiaries, Cover image, Goal, Ends, Priority; there is no Summary row). Click each section's 'Edit' and confirm you return to that step with data kept.
5. On step 3 click 'Continue' quickly and confirm nothing is submitted until 'Publish campaign'.
6. Use 'Back' repeatedly and confirm no data is lost.
7. Publish, inspect the POST /campaigns body, then check the summary line on /c/:slug and in admin review.

**Expect:** Validation blocks each step correctly. Edit and Back keep data. Only 'Publish campaign' submits. No summary is collected or sent (the POST body has no 'summary' key), so nothing the organizer typed is silently dropped; /c/:slug and share cards show text taken from the story.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/pages/CreateCampaignPage.tsx`, `apps/web/src/hooks/useCampaigns.ts`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-010 · P1 · Native create wizard parity on iOS and Android

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** U1-Pro is eligible. Physical iPhone and Android device, in light and dark mode.

**Steps:**

1. Open Create and confirm 'Step 1 of 4 · Basics' with a progress bar.
2. Enter a title under 5 characters and tap Continue. Confirm the snackbar 'Enter a title of at least 5 characters.' and that step 1 has only 'Campaign title' and 'Category' (no 'One-line summary' field).
3. Story and media: enter the story, beneficiaries and a 'Campaign cover' (crop 16:9). Try the AI writing assistant.
4. Goal and timeline: confirm the 250k copy and 'Current goal limit: GH₵…'. Enter a goal above the limit and confirm the error. Use the date field and Urgency picker. Enter invite emails and toggle split if the plan allows.
5. Review: confirm the title, story, goal and end date, category and urgency, beneficiaries (no summary line) and PublicationConsent are shown, then tap 'Create campaign'.
6. Confirm the success card 'Campaign created' with 'Status: active' or 'pending_review' and a 'View campaign' button.
7. Rotate the device, open and close the keyboard (on Android confirm the focused field stays above the keyboard with edge-to-edge), and background the app mid-form.
8. Start a new form, kill the app mid-form, reopen it and open Create again.

**Expect:** Validation and eligibility match web. The success card shows the true status. The cover image uploads. The keyboard never hides inputs. The cover picker is hidden when the plan's maxMediaPerCampaign is 0. After a kill and reopen the unsent form is restored with 'We restored your unsent draft from this device. If it is waiting for safety review, submit this same version again once it is approved.' and a 'Start over' button.

**Needs:** Cloudinary; OpenAI (assistant, optional)

**Source:** `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`, `apps/mobile/src/components/KeyboardAvoider.tsx`, `apps/mobile/src/lib/publicationDrafts.ts`

## CAMPAIGN-011 · P1 · End-date semantics, timezone and deadline enforcement

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** U1 is eligible. Browser devtools network tab. DB access to adjust endDate.

**Steps:**

1. In the web wizard pick tomorrow as the End date and publish.
2. Inspect the POST body and confirm endDate = '<tomorrow>T00:00:00.000Z'.
3. Open detail and confirm 'Campaign end date' shows tomorrow's date.
4. In the DB set endDate to now + 2 minutes. After it passes, try a wallet donation (POST /campaigns/:id/donate), a Paystack checkout from /c/:slug/donate, Android donate and iOS 'Continue in browser'.
5. Check the card label changes to 'Ended'.
6. Create a campaign with endDate in 2099 through the API.
7. Repeat the date selection on mobile and compare the stored endDate.

**Expect:** The campaign closes at 00:00 GMT at the start of the chosen date. Confirm the copy tells organizers this (a 'Dec 31' deadline ends as Dec 31 begins). Every donation rail rejects once the end date passes. Record whether any maximum campaign duration exists (none today) and get a product decision.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/api/src/domain/entities/Campaign.ts`, `packages/types/src/campaign.ts`

## CAMPAIGN-013 · P1 · Cover image upload and rendering

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** U1-Pro. Cloudinary credentials configured. Sample files: JPG, PNG, HEIC (iOS), a 15MB image, and a PDF renamed to .jpg.

**Steps:**

1. In Story, use 'Cover image' to upload each file.
2. Watch the upload progress. Go offline mid-upload and confirm an error and that retry works.
3. Complete creation, including staff publication approval because media is attached.
4. Confirm the image shows on the Review step, the detail hero, the /c/:slug hero, the Explore card and in admin review ('Open attachment 1').
5. Put an account on a plan with maxMediaPerCampaign 0 (admin plan edit) and try to attach an image.

**Expect:** Supported images upload and render everywhere. Unsupported or oversize files show a clear error. With a 0-media plan, web shows 'Your plan does not include campaign images.' and mobile hides the field.

**Needs:** Cloudinary

**Source:** `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/lib/uploadImage.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`

## CAMPAIGN-019 · P1 · Flagged text or unavailable screening falls back to staff review, loudly

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Staging where OPENAI_API_KEY can be swapped and API logs can be read. U1.

**Steps:**

1. With consent, submit a story containing clearly violent or hateful text.
2. In the admin queue confirm the item's reason is 'flagged'.
3. Set OPENAI_API_KEY to an invalid value and restart.
4. Submit clean text with consent.
5. Confirm the reason is 'unavailable', with no 500 and no hang longer than about 15 seconds, and read the API log entry for that submission.
6. Restart the API with NODE_ENV=production and OPENAI_API_KEY unset, and read the startup log.

**Expect:** Flagged and unavailable submissions are held privately for staff with the 409 message. The request never crashes or hangs. Every screener failure is logged as a warning, 'Publication screener unavailable; routed to staff review', with the fingerprint and action (campaign.create). A production boot without the key logs the error 'OPENAI_API_KEY missing: publication screening disabled; opted-in submissions go to staff review' and the API still starts. Launch check: confirm the key is set in Render and that there are no unexpected reason 'unavailable' items in the queue.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiPublicationScreener.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/app.ts`

## CAMPAIGN-020 · P1 · Staff decline, author-visible notes, and approval expiry re-queue

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Pending campaign.create item from U1. Two approved text-only campaign.create items from U1 that were not yet used. Admin A2. DB access.

**Steps:**

1. A2 enters notes and clicks 'Decline this version'.
2. U1 resubmits the same version.
3. U1 opens Settings → Publication reviews.
4. U1 edits the story and submits again.
5. For the first approved item, set approvalExpiresAt to the past in the DB, then resubmit the identical version without consent.
6. Check admin /publication-reviews and U1's Publication reviews list for that item.
7. For the second approved item, set approvalExpiresAt to the past, then resubmit the identical version with consent ticked.

**Expect:** A declined resubmission returns 422 'This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.' The author sees 'Review response: <notes>'. The edited version creates a new pending review. An expired approval no longer returns 'This safety approval expired…'. Without consent, the same item goes back to pending with the earlier decision and notes cleared (reason staff_requested, or media when an image is attached), and the resubmission gets 409 'Saved privately for safety review…'. With consent, the item is screened again; if the text is clean it is approved by 'automated:openai' and the campaign is created in the same request.

**Needs:** OpenAI (consent variant)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/web/src/components/account/PublicationReviews.tsx`

## CAMPAIGN-021 · P1 · Publication reviewer controls: notes, self-review ban, concurrency and idempotency

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admins A1 and A2. A1 has submitted content of their own (for example a comment).

**Steps:**

1. Enter 19 characters of notes and confirm both decision buttons are disabled. Via API, send notes shorter than 20 characters.
2. A1 opens their own item and tries to approve it.
3. A1 and A2 open the same third-party item. A1 approves, then A2 declines.
4. A1 repeats the identical approve request.
5. Check the audit log for 'publication.approved'.

**Expect:** Short notes return 400 'Choose a decision and enter at least 20 characters of review notes'. Self-review returns 403 'Another administrator must review your content'. The second, different decision returns 409. An identical replay is a silent no-op. The decision is audited. Staffing requirement: at least 2 admins on duty.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/publicationReviewRoutes.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## CAMPAIGN-023 · P1 · Financial eligibility is rechecked when an approved version is committed

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** U1-Plus has a staff-approved campaign.create version (form still open). Admin access to the subscription or KYC records.

**Steps:**

1. Before resubmitting, move U1 to the Free plan with 1 active campaign (cancel or expire the subscription), or expire their KYC.
2. U1 clicks 'Publish campaign' with the approved version.

**Expect:** The creation is refused with 403 (plan message or 'Campaign creation eligibility changed. Review your verification and retry.'). No campaign is saved, and content approval does not waive financial eligibility.

**Needs:** Paystack test keys or store sandbox to change plan

**Source:** `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-027 · P1 · Admin changes review-tier settings without a redeploy (single all-or-nothing save)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin with SETTINGS edit permission. A second admin role without edit permission. Devtools network tab.

**Steps:**

1. Admin Settings → Campaigns: set 'Tier rule up to GHS 250,000' to 'Review every campaign up to GHS 250,000' and save.
2. In devtools confirm Save sent one PUT /api/v1/admin/commercial-config whose changes[] lists the auto-approve tier, the four thresholds and the alert address, not one request per setting.
3. Create a 5,000 GHS campaign.
4. Edit the tier ceilings to a non-ascending set (for example Tier 2 below Tier 1) and try to save.
5. Via the API, PUT /api/v1/admin/commercial-config with a valid tier change plus non-ascending thresholds, then with the same key listed twice, then with an empty changes list. Check commercial-config history after each.
6. Restore the defaults ('Auto-approve tiers 1–3').
7. Log in as the read-only role and confirm the controls are disabled.

**Expect:** The new rule applies to the very next campaign (pending_review). Invalid saves are rejected as a whole with 400: 'Tier thresholds must be positive and strictly ascending.', 'Each setting may appear only once.' or 'changes must list between 1 and 25 settings.'. None of the batch is written, not even the valid tier change. A valid save writes every setting together with one effectiveFrom. The read-only role cannot edit. Changes are audited in commercial-config history.

**Needs:** None

**Source:** `apps/admin/src/components/CampaignReviewSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-029 · P1 · Reject a pending campaign, and how the organizer is told

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** A pending_review campaign. Admin A2. Organizer signed in on web and native, with access to their email inbox.

**Steps:**

1. A2 clicks 'Reject campaign' with notes.
2. As the organizer open web /campaigns/:id, /my-campaigns (Blocked tab) and the native campaign detail.
3. Open the organizer's notifications (web bell and native inbox) and open the new notice. Check the email inbox too.
4. Via API, send PUT /campaigns/:id/reject for an active campaign.
5. Replay the identical reject decision and check the notifications again.

**Expect:** Status becomes blocked, with the 'BLOCKED' chip and 'Campaign Inactive' on web. Rejecting an active campaign returns 409 'Only pending campaigns can be rejected'. The organizer gets exactly one in-app notice, 'Your campaign was not approved': '“<title>” did not pass review and is not public. For details or to ask for another review, contact support@ujimora.com.' It opens /my-campaigns. The staff decision notes are never copied into it, and a replayed decision adds no second notice. Known open issue I051: no email is sent for campaign decisions; emailing them is still an owner decision.

**Needs:** Email provider (to confirm no email is sent)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/web/src/pages/MyCampaignsPage.tsx`

## CAMPAIGN-031 · P1 · Return to review and re-approval, keeping FUNDED

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A blocked campaign whose raisedAmount ≥ goal (block a funded campaign first). A second blocked campaign whose endDate has passed.

**Steps:**

1. Via API, send action 'approve' on the blocked campaign.
2. Click 'Return to review' with notes.
3. Confirm the attestations are cleared, then approve.
4. Try to approve the expired one after reopening it.

**Expect:** Approving a blocked campaign returns 409 'Only pending campaigns can be approved'. Reopen moves it to pending_review. Approval restores FUNDED, not ACTIVE. The expired campaign returns 409 'An expired campaign cannot be approved'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`

## CAMPAIGN-032 · P1 · Stale version, conflicting decisions and retry idempotency in campaign review

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** A pending campaign. Admins A1 and A2. Owner token for a PATCH slug request.

**Steps:**

1. A1 opens admin detail (this loads reviewVersion).
2. The owner changes the slug via PATCH /campaigns/:id/slug and it is admitted.
3. A1 clicks Approve.
4. A1 clicks 'Reload' and approves.
5. Replay the identical PUT /campaigns/:id/review from A1.
6. A2 sends a different action for the same version.
7. In a separate run, make a donation between load and approval on an active campaign being blocked.

**Expect:** The stale approval returns 409 'The campaign changed. Reload and review the current version.' After reload it succeeds. The identical replay returns 200 with no second history entry. A2's different decision returns 409 'A different final decision already exists for this campaign version'. A donation-total change alone does not invalidate the version.

**Needs:** Paystack test keys (donation during review)

**Source:** `apps/api/src/domain/services/campaignReviewVersion.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## CAMPAIGN-035 · P1 · Admin campaigns list completeness with more than 100 campaigns

*Surfaces:* admin  ·  *Type:* functional

**Before:** Staging with at least 105 campaigns, where the oldest is pending_review.

**Steps:**

1. Admin → Campaigns → Pending tab.
2. Search for the oldest pending campaign's title.
3. In devtools confirm the list is loaded page by page from /api/v1/campaigns (100 per request) until every page has been read.
4. Use the status and category filters, switch between table and card views, and Export.

**Expect:** Every pending campaign is reachable, including the oldest one beyond the first 100 rows, so the review queue has no blind spot. Search, filters and Export cover the full set of campaigns.

**Needs:** None

**Source:** `apps/admin/src/pages/CampaignsPage.tsx`, `apps/admin/src/hooks/useApiData.ts`, `apps/admin/src/lib/exports/loadAll.ts`

## CAMPAIGN-038 · P1 · Ended campaigns: donations close, status becomes expired, and the plan slot is freed

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 on the Free plan with 1 active campaign and lifetime allowance left (identity KYC ⇒ 3). DB access to set endDate in the past. The staging API runs with NODE_ENV other than 'test', so the expiry sweep runs every 5 minutes.

**Steps:**

1. Set the campaign's endDate to yesterday.
2. Straight away, before the sweep runs: try donations on wallet POST /campaigns/:id/donate, the donation-intent (Paystack) flow, Android donate, iOS 'Continue in browser', and crypto if CRYPTO_PAYMENTS_ENABLED.
3. Web /campaigns/:id: check 'Donations closed'. /c/:slug: check the Donate button and helper text. The card shows 'Ended'.
4. Explore: use the 'Expired' and 'Active' status filters; on native also sort by 'Ending soon'.
5. /my-campaigns: check the status chip and which tab it appears under.
6. /sitemap.xml.
7. U1 calls GET /campaigns/creation-options and creates a new campaign.
8. If a live session was running on the campaign, check GET /campaigns/:id/active-live and the watch page.
9. Wait up to 5 minutes, then GET /campaigns/:id and check the admin campaigns list.

**Expect:** Every rail rejects server-side with 400 'Campaign is not accepting donations', and iOS shows 'This campaign is not accepting donations right now.'. /c/:slug shows a disabled 'Donations closed' with 'This campaign isn't accepting donations right now.'. Explore lists the campaign under Expired straight away and never under Active, and 'Ending soon' shows only open campaigns. My Campaigns shows an 'Expired' chip under the Expired tab even before the sweep. The sitemap drops it immediately. The Free slot is freed at the end date: activeCount excludes the campaign and U1 can create a new one. active-live returns null, and the live sweep ends any running session within about 30 s. Within 5 minutes the sweep stores status 'expired', which the API and admin then show. raisedAmount and balances are unchanged.

**Needs:** Paystack test keys; Bitnob only if crypto enabled; LiveKit for the live step

**Source:** `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/app.ts`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/ExplorePage.tsx`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/mobile/src/lib/exploreSearch.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`

## CAMPAIGN-041 · P1 · Web campaign detail content and owner-only controls

*Surfaces:* web  ·  *Type:* functional

**Before:** Active campaign by U1 with a multi-line story, 3 beneficiaries, a long unbroken word, donations, updates and comments. Viewers: guest, donor D, owner U1.

**Steps:**

1. As guest open /campaigns/:id. Check the title, status chip, progress, the 'Campaign end date' card, and tabs Overview/Updates/Donations/Comments.
2. Overview: the story keeps line breaks and long words wrap; 'Who this supports' list; organizer card with TrustBadge; 'How to donate' section with 'Continue to checkout' linking to /c/:slug/donate.
3. Click 'Sign in to donate' and confirm login returns you to the page.
4. As D: 'Donate with wallet' opens the dialog. No owner controls are shown.
5. As U1: Cashout card, Split proceeds, 'Post Update' in the Updates tab, 'Go LIVE'.

**Expect:** Content renders correctly at desktop and 390px with no horizontal overflow. Owner-only controls are visible only to the creator. The Report button shows for signed-in non-owners.

**Needs:** None

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/components/campaigns/CampaignOrganizer.tsx`

## CAMPAIGN-042 · P1 · Public landing /c/:slug: legacy ID, unknown slug and refresh-on-focus

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** An active slugged campaign. A legacy campaign with no slug (DB). An admin able to block.

**Steps:**

1. Open /c/<slug>. Check the hero image, summary, raised/goal, donor count, 'Donate now' and 'Secure donations · card & mobile money'.
2. Open /c/<24-hex id> for the legacy campaign.
3. Open /c/does-not-exist.
4. With /c/<slug> open, the admin blocks the campaign. Switch away from the tab and back.
5. Open the native deep link ujimora://c/<slug>.

**Expect:** The slug and legacy-ID URLs render. Unknown slugs show 'This fundraiser link may have expired, been removed, or been mistyped.' with an 'Explore campaigns' button. On refocus after blocking, content and SEO clear to not-found. The native link resolves to campaign detail.

**Needs:** None

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/hooks/usePublicCampaign.ts`, `apps/api/src/application/use-cases/GetCampaignBySlugUseCase.ts`, `apps/mobile/app/campaign/shared.tsx`

## CAMPAIGN-043 · P1 · SEO metadata, robots.txt and sitemap.xml

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Production-like deploy of app.ujimora.com (Vercel) and api.ujimora.com (Render). An active campaign, a funded campaign, a pending campaign and an active campaign whose end date has passed.

**Steps:**

1. Inspect the <head> on /c/<slug> and /campaigns/<id>: title '<title clipped to 46> | Ujimora', meta description, canonical https://app.ujimora.com/c/<slug>, og:type article, og:image = cover, breadcrumb JSON-LD.
2. As owner inspect the pending campaign page: robots 'noindex, follow'.
3. Fetch https://app.ujimora.com/robots.txt.
4. Fetch https://app.ujimora.com/sitemap.xml and https://api.ujimora.com/sitemap.xml and compare them.
5. Look for the ended and pending campaigns in the sitemap.
6. Run the Google Rich Results Test on /c/<slug>.

**Expect:** Metadata is correct and both URLs canonicalize to /c/:slug. https://app.ujimora.com/sitemap.xml returns the API's XML (vercel.json rewrites it ahead of the SPA catch-all), matching the API URL and the address robots.txt advertises. It lists /c/<slug> only for active or funded campaigns whose end date is still in the future. Pending, blocked and ended campaigns are absent, and so are the creator pages of restricted or deleted accounts.

**Needs:** None

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/lib/seo.ts`, `apps/web/vercel.json`, `apps/web/public/robots.txt`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`

## CAMPAIGN-044 · P1 · Social link previews for shared campaigns

*Surfaces:* web  ·  *Type:* functional

**Before:** On the production (or a Vercel preview) domain: an active campaign with a cover image, an active campaign without one, and a pending campaign. curl available.

**Steps:**

1. Paste https://app.ujimora.com/c/<slug> into a WhatsApp chat.
2. Run the same URL through the Facebook Sharing Debugger, X/Twitter card preview and LinkedIn Post Inspector.
3. Repeat with /c/<slug>/donate, /campaigns/<id> and a QR short URL https://api.ujimora.com/r/<code>.
4. Repeat for the campaign without a cover, the pending campaign's URL and /campaigns/new.
5. curl /c/<slug> once with a normal browser user agent and once with 'facebookexternalhit/1.1', and compare the <head> and response headers.

**Expect:** Link-preview scrapers get a per-campaign card: og:title and twitter:title '<campaign title, up to 90 chars> | Ujimora'; a description taken from the story (up to 155 chars; short stories end with 'Donate by mobile money or card on Ujimora.'); og:image set to the https cover, or the static Ujimora image when there is none; og:type article; and a canonical https://app.ujimora.com/c/<slug>. The response is cached about 5 minutes (s-maxage=300). The /r/<code> link previews as its campaign after the 302 and the preview fetch is not counted as a scan. Pending or blocked campaigns and other paths fall back to the generic 'Ujimora — Trusted Crowdfunding in Ghana' card. Browsers and Googlebot get the normal SPA HTML unchanged. Confirm on the production deploy with the Facebook Sharing Debugger.

**Needs:** None

**Source:** `apps/web/middleware.ts`, `apps/web/src/lib/shareMeta.ts`, `apps/web/index.html`, `apps/web/vercel.json`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`

## CAMPAIGN-045 · P1 · Live progress updates on the campaign page (SSE)

*Surfaces:* web  ·  *Type:* functional

**Before:** Active campaign open in two browsers. Paystack test keys.

**Steps:**

1. In browser B donate GHS 10.
2. Watch raised, progress and donor count in browser A without reloading.
3. Drop browser A's network for 30 seconds, restore it, and donate again.
4. Block the campaign and confirm browser A's stream stops.

**Expect:** Totals update in near real time, the stream resumes after reconnect, and no private donor data is exposed. It stops delivering after the block.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/campaigns/LiveCampaignProgress.tsx`, `apps/web/src/hooks/useSSE.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`

## CAMPAIGN-048 · P1 · Dynamic QR codes and short links (owner)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Owner U1 with an active campaign. Web: go live at /campaigns/:id/live, which needs LiveKit, for the QR manager. Mobile: Manage campaign → 'Share with a QR code'. PUBLIC_API_URL=https://api.ujimora.com.

**Steps:**

1. Create kind 'campaign' and scan it with a phone camera. Confirm it lands on /c/<slug>.
2. Create kind 'amount' with Preset amount 50. Scan it and confirm /c/<slug>/donate?amount=50 with the amount prefilled.
3. Create kind 'event' with label 'Church Harvest'. Confirm /c/<slug>?ref=Church%20Harvest.
4. During a live session create kind 'live'. Confirm /c/<slug>/live/<sessionId>.
5. Open https://api.ujimora.com/r/<code>?utm_source=flyer and confirm the utm is forwarded.
6. Download /qr/<code>.png and .svg.
7. Check the list shows '<label> · N scans', that N increments per scan, and that 'Copy link' works.

**Expect:** Every short URL has the shape https://api.ujimora.com/r/<7-char code> and redirects 302 with Cache-Control no-store. Scan counts increment, UTM parameters are carried over, and PNG/SVG render and scan.

**Needs:** LiveKit (live kind)

**Source:** `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/web/src/components/live/QrCodeManager.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`

## CAMPAIGN-049 · P1 · 'Creator profile' QR codes land on the organiser's creator page

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Owner U1 with a creator page (handle) and owner U4 without one, each with an active campaign. A legacy creator short link whose stored target is https://app.ujimora.com/u/<creatorId> (DB). Mobile Manage campaign → 'Share with a QR code'.

**Steps:**

1. As U4 choose Link destination 'Creator profile' and tap 'Create QR code'.
2. As U1 do the same, then scan the new code or open its short URL.
3. Scan the legacy /u/ code for U1's campaign, and one for an organiser who has no creator page.
4. On a phone with the app installed open ujimora://u/<creatorId>.

**Expect:** U4 sees the error 'Set up your creator page before creating a creator QR code.' (422) and no code is created. U1's code redirects (302) to https://app.ujimora.com/creators/<handle>, which renders the creator page. Legacy /u/ codes are rebuilt at scan time: they go to the creator page, or to the campaign page when the organiser has no creator page, never to a 404. The native link opens /profile/<creatorId>.

**Needs:** None

**Source:** `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/web/src/router.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/src/components/CampaignManagement.tsx`

## CAMPAIGN-050 · P1 · QR and short-link permissions and negative cases

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Campaign owned by U1 with an active live session. User U2. A pending campaign that has a QR code. Another campaign's live session id.

**Steps:**

1. As U2 call POST and GET /api/v1/campaigns/:id/qr-codes. Repeat logged out.
2. As U1 POST kind 'amount' with presetAmount 0, then -5. POST a label of 121 characters.
3. As U1 POST kind 'live' with the other campaign's liveSessionId, then with an ended session of this campaign.
4. GET /r/zzzzzzz, /qr/zzzzzzz.png and /qr/zzzzzzz.svg.
5. As a guest scan the pending campaign's QR code.
6. Hit /r/<code> 200 times from a script with a normal browser user agent, then with HEAD requests.

**Expect:** U2 gets 403 'Only the campaign owner…' and logged-out calls get 401. Invalid input returns 400 and unknown codes return 404. A live QR that names another campaign's session or an ended session returns 400 'A live QR code can only point to this campaign’s current broadcast'. The pending campaign's QR lands on the not-found page with no data leaked. Requirement: scripted scanning is throttled per client (429) and cannot inflate scan counts. Known open issue I114: /r and /qr are still outside every rate limiter. 200 scripted GETs with a browser user agent all return 302 and add 200 scans; only HEAD requests and preview or crawler user agents are left uncounted.

**Needs:** LiveKit (live-kind step)

**Source:** `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ListCampaignQrCodesUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`

## CAMPAIGN-051 · P1 · QR preset amount carries through to the checkout amount accurately

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Amount QR codes for 25.50 and (via API) 10.555. Paystack test keys.

**Steps:**

1. Scan the 25.50 code on a phone browser. Check the donate page amount field, then complete checkout.
2. Open the same link through the native deep link on Android and on iOS (external browser).
3. Open the 10.555 code on a phone browser and through the native deep link.
4. Change the prefilled amount before paying.

**Expect:** The 25.50 amount is prefilled (the field shows 25.5), and the fee breakdown and charged amount match the final amount to the pesewa. The native link carries amount=25.5. The 3-decimal preset is never used: the web donate page leaves the amount empty because it accepts at most two decimals, and the native fundraisingUrl drops it, so the donor enters an amount. The donor can always edit the amount. Record as a P2 defect that POST /campaigns/:id/qr-codes still accepts presetAmount 10.555; it should validate to two decimals at creation.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/lib/moneyInput.ts`, `apps/mobile/src/lib/fundraising.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`

## CAMPAIGN-052 · P1 · Automatic vanity slug generation

*Surfaces:* api, web  ·  *Type:* functional

**Before:** U1 is eligible (use API creation to save wizard time).

**Steps:**

1. Create titles: "Help Ama's Surgery"; the same title again; 'Café Kɔkɔɔ Fund'; 'Dɛnkyɛm Medical Fund'; '🙏🙏🙏' (emoji only); 'Admin'; a 200-character title.
2. Check each slug in the response and in the /c/<slug> URL.

**Expect:** help-ama-s-surgery. The duplicate gets a 4-character random suffix. Diacritics are stripped and Ghanaian letters are transliterated: 'Café Kɔkɔɔ Fund' → cafe-kokoo-fund and 'Dɛnkyɛm Medical Fund' → denkyem-medical-fund, never hyphen fragments like 'k-k'. Emoji-only gives campaign-<6 chars>. Reserved 'admin' gets a suffix. The long title is cut to 60 characters or fewer with no trailing hyphen. All slugs are unique. Slugs created before this release are not migrated.

**Needs:** None

**Source:** `apps/api/src/application/utils/slug.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-053 · P1 · Vanity slug change (API only): permissions, old links and printed QR codes keep working

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Active campaign owned by U1 with an existing amount QR code. Another owner U3 with a campaign. User U2. Admin A1.

**Steps:**

1. As U1: PATCH /api/v1/campaigns/:id/slug {slug:'ama-surgery-2026', automatedReviewConsent:true}.
2. Repeat with slugs 'live' (reserved), an existing slug, 'Bad_Slug', and the current slug.
3. As U2 PATCH. As A1 PATCH.
4. Without consent, confirm it is held for staff review.
5. Open the old https://app.ujimora.com/c/<old-slug>?ref=flyer, call GET /campaigns/slug/<old-slug>/public, and scan the QR code printed before the change.
6. As U3, PATCH their campaign to <old-slug>. Create a new campaign whose title would generate <old-slug>.
7. As U1, PATCH back to <old-slug>.

**Expect:** The owner succeeds after admission. A reserved slug returns 409 'That slug is reserved', a taken slug 409 'That slug is already taken', a bad format 400, and an unchanged slug is a no-op. U2 gets 403 'Only the campaign owner can change its slug', and the admin can change it. The old URL still opens the campaign and the address bar changes to /c/<new-slug>?ref=flyer. The public endpoint resolves the old slug. The printed QR code redirects to the new slug because destinations are rebuilt on every scan. The old slug stays reserved for this campaign: U3 gets 409, a new campaign gets a suffixed slug, and U1 can switch back. There is no web or native UI for slug changes.

**Needs:** OpenAI (consent path)

**Source:** `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/web/src/pages/CampaignPublicPage.tsx`

## CAMPAIGN-054 · P1 · Owner posts a campaign update on web

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Active campaign owned by U1. OpenAI configured. Admin A2. A cover uploaded through POST /api/v1/uploads/image?folder=campaigns (its URL).

**Steps:**

1. Detail → Updates tab → 'Post Update'.
2. In the 'Post an Update' dialog: title (at least 3 characters), content, type (milestone/general/thank_you/urgent), tick 'Pin this update to the top' and the consent box. Click 'Post Update'.
3. Confirm the page reloads and the update is shown pinned first.
4. Post another update without consent. Confirm the held message appears in the dialog, then A2 approves and you resubmit the identical update.
5. Via API post with mediaUrls holding the uploaded Cloudinary URL. Then post with a third-party https image URL.
6. As a guest read GET /campaigns/:id/updates.

**Expect:** A consented text update publishes immediately. A non-consented one is held privately until it is approved and resubmitted. Platform-hosted media always goes to staff review. A third-party or non-https media URL is rejected with 400 'Validation failed' ('Upload the image through Ujimora'). Donors see published updates in order with the pinned one first.

**Needs:** OpenAI, Cloudinary

**Source:** `apps/web/src/components/campaigns/CreateUpdateDialog.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignUpdateRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`

## CAMPAIGN-056 · P1 · Update visibility, reporting and staff hide

*Surfaces:* admin, android, ios, web  ·  *Type:* security/permission

**Before:** A pending campaign with an update (owner-posted). An active campaign owned by U1 with an update. Donor D. Admins A1 and A2.

**Steps:**

1. As a guest GET the pending campaign's /updates.
2. As D, on the active campaign's update, use Report (reason plus a description of at least 10 characters).
3. A1 files a report on the same update, then tries to review that report in Safety reports.
4. A2 opens Safety reports, finds D's campaign_update report, enters notes and clicks 'Hide campaign update'.
5. Check U1's and D's in-app notifications.
6. U1 reposts the hidden update with the exact same title, content and type.
7. D blocks the update author and reloads the updates list.

**Expect:** The pending campaign's updates return 404 to the guest. The report is captured with an evidence snapshot. A1 gets 403 'Another administrator must review this report.' (the same applies to the author or the campaign owner). After the hide, the update disappears publicly and funds are untouched. U1 gets 'Your campaign update was removed', with support@ujimora.com for appeals, and D gets 'We reviewed your report'. The verbatim repost is refused with 422 'This version was declined in safety review…'. Blocked authors are filtered from that viewer.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetCampaignUpdatesUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## CAMPAIGN-057 · P1 · Posting comments: consent, avatar review, identity changes and limits

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Active campaign. D1 without a profile avatar. D2 whose avatar was uploaded in Settings after this release and approved in profile media review. D3 with a legacy avatar (set before this release, so it has no reviewed-avatar record). OpenAI configured. Admin A2.

**Steps:**

1. D1 writes a comment, ticks consent and posts. It appears immediately.
2. D1 posts without consent. It is held with the 409 message.
3. D2 posts with consent.
4. D3 posts with consent. Check the admin queue reason.
5. A2 approves D3's item and D3 resubmits the identical text.
6. D3 changes display name while an item is pending, then resubmits.
7. Try 1001 characters (the counter caps at 1000) and a whitespace-only comment via the API.
8. As a guest, check the comment box state.
9. On native, tap a comment author's name or avatar.

**Expect:** Consented clean text publishes instantly both for users without an avatar and for users whose current avatar passed profile media review; that avatar is bound into the screened text instead of being sent as media. A legacy or unreviewed avatar still sends the comment to staff (reason 'media'), so it needs approval plus an identical resubmission. An identity change returns 409 'Your public identity changed during review. Refresh and submit again.' Whitespace returns 400. Guests are prompted to sign in. Native behaves the same, and tapping an author's name or avatar opens their public profile (/profile/<id>).

**Needs:** OpenAI

**Source:** `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`, `apps/api/src/domain/entities/User.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.ts`, `apps/web/src/components/campaigns/CampaignComments.tsx`, `apps/mobile/src/components/CampaignComments.tsx`

## CAMPAIGN-058 · P1 · Comment moderation permissions and blocking

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Active campaign by U1 with comments by D1 and D2. Admin A1. A pending campaign by U3.

**Steps:**

1. D1 deletes their own comment.
2. U1 deletes D2's comment.
3. D2 tries to delete a comment by D1 on someone else's campaign via the API.
4. Try DELETE /campaigns/:idA/comments/<comment on campaign B>.
5. A1 deletes a comment.
6. U1 blocks D1. D1 tries to comment.
7. D2 comments on U3's pending campaign.
8. A guest POSTs a comment.

**Expect:** Author, owner and admin deletes succeed as soft deletes. D2 gets 403 'You cannot delete this comment'. The cross-campaign delete returns 404. Blocked D1 gets 403 'You cannot comment on this campaign'. Commenting on the pending campaign returns 404. The guest gets 401.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignCommentRoutes.ts`, `apps/web/src/components/campaigns/CampaignComments.tsx`

## CAMPAIGN-061 · P1 · Explore: search, categories, status filter, sort and pagination

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** About 15 public campaigns across all 7 categories, a mix of active, funded and ended ones, including one whose description (not title) contains 'surgery'.

**Steps:**

1. Web /explore: search 'surgery'. The search runs on the server after you stop typing; only title matches appear.
2. Click each category chip (Medical, Education, Emergency, Business, Community, Religious, Creative).
3. Use the status filter (Active, Funded, Expired). Confirm there is no Pending Review option.
4. Sort by Most funded and Newest.
5. Page through at 6 per page; with many pages the buttons show the first, last and neighbouring pages with '…'. Click 'Clear filters'. Trigger the empty state.
6. Native Explore: the same checks, plus the Expired filter, the 'Ending soon' sort and 'Load more'. Check the Home page grid.

**Expect:** Filters combine correctly on the server. Results show 'Showing N campaigns' with N equal to the server total, pagination resets when a filter changes, and the empty state appears. Search matches titles only, case-insensitively; confirm this is intended. Most funded orders by raised/goal ratio. Expired lists ended campaigns even before the sweep relabels them, and Active/Funded never include them. 'Ending soon' shows only open campaigns, soonest first. Native and web give the same results.

**Needs:** None

**Source:** `apps/web/src/pages/ExplorePage.tsx`, `apps/web/src/hooks/useCampaigns.ts`, `apps/web/src/components/campaigns/CampaignSearchBar.tsx`, `apps/mobile/app/(tabs)/explore.tsx`, `apps/mobile/src/lib/exploreSearch.ts`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/web/src/pages/HomePage.tsx`

## CAMPAIGN-062 · P1 · Explore and the list API at scale (more than 20 campaigns)

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Staging seeded with 30 or more public campaigns.

**Steps:**

1. Web /explore and native Explore: count the campaigns (use Load more on native).
2. Search for the title of the 25th-newest campaign.
3. GET /api/v1/campaigns?pageSize=100000 and ?pageSize=0.
4. GET /api/v1/campaigns?page=-1 and ?page=0.
5. GET /api/v1/campaigns?sortBy=creatorId, ?sortBy=lockedPlatformFeePercent, ?sortBy=goalAmount and ?sortOrder=sideways.
6. GET pages 1 and 2 with pageSize 5 and sortBy fundedPercent, and compare the ids.

**Expect:** Every public campaign is discoverable. Web shows the full total with windowed page buttons, native loads 20 at a time with 'Load more', and search finds the 25th-newest title. The API bounds every request without a 500: pageSize is clamped to 1–100 (100000 gives 100; 0 falls back to 20), and page values below 1 are served as page 1. sortBy accepts only createdAt, raisedAmount, endDate and fundedPercent; anything else (including goalAmount) returns 400 'Unsupported sort field', and a bad sortOrder returns 400 'Unsupported sort order'. Pages never overlap. Merge note: apps/api/__tests__/integration/list-bounds.integration.test.ts (from I103) still expects 400 for page=-1/0/1.5 and pageSize=0/101/100000, and 200 for sortBy=goalAmount. The merged controller (I072) clamps instead, so expect that suite to fail on this branch. Get the developers to confirm which contract is intended.

**Needs:** None

**Source:** `apps/web/src/hooks/useCampaigns.ts`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/api/src/domain/ports/outbound/CampaignRepositoryPort.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/__tests__/integration/list-bounds.integration.test.ts`

## CAMPAIGN-063 · P1 · Organizations directory and organization campaigns

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** ORG with 2 active campaigns, 1 pending and 1 blocked. A restricted or closed organization.

**Steps:**

1. /organizations: find ORG.
2. /organizations/<slug>: check the campaignCount, the sentence '<name> has raised GHS X across N campaigns', categories and campaign cards.
3. GET /api/v1/organizations/:id/campaigns as a guest.
4. Open the restricted organization's page.
5. Native: organizations list and organization/[id].

**Expect:** Only the 2 public campaigns are counted, summed and listed. The restricted organization returns not-found. Native matches web. Totals are in GHS.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationRoutes.ts`, `apps/web/src/pages/OrganizationProfilePage.tsx`, `apps/web/src/pages/OrganizationsPage.tsx`, `apps/mobile/app/organization/[id].tsx`

## CAMPAIGN-064 · P1 · Leaderboard filters and totals are accurate

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Fresh staging data. Donors: named user N (100 + 50 to two campaigns), anonymous gift A (500), guest G (30), organization O (200), and user X (1000 to a campaign that is later blocked). Paystack test keys.

**Steps:**

1. /leaderboard: toggle Today, This Month, This Year and All Time, and Everyone, People and Organizations.
2. Check the rank order, total, donation count and campaigns supported for N and O.
3. Check the stats totals.
4. Wait 30 seconds after a new donation and confirm the board auto-refreshes.
5. Call GET /leaderboard?period=weekly and ?category=bots, then ?limit=500.
6. Check the home page 'All-Time Leaders' and 'This Month's Stars' (/leaderboard/featured).

**Expect:** N shows 150 across 2 campaigns and O shows 200 under Organizations. The anonymous gift is excluded, the guest counts only in Everyone totals and not in named ranks, and X's gift to the blocked campaign is excluded. Invalid params return 400 and limit is capped at 100. Native matches web.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/GetLeaderboardUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/LeaderboardController.ts`, `apps/web/src/pages/LeaderboardPage.tsx`, `apps/mobile/app/leaderboard.tsx`

## CAMPAIGN-065 · P1 · Leaderboard privacy controls

*Surfaces:* android, ios, web  ·  *Type:* security/permission

**Before:** N is ranked on the leaderboard. Viewer V. Admin with restriction ability.

**Steps:**

1. N turns off the leaderboard visibility setting in Settings.
2. Reload the list, the featured panel and the stats on web and native.
3. N turns it back on. V blocks N and views the board.
4. The admin restricts N, or N closes the account.

**Expect:** N disappears from named ranks and the featured panels while the setting is off, and reappears when on. N is hidden for V only after the block. A restricted or closed N is hidden for everyone. Totals stay consistent with the documented policy.

**Needs:** None

**Source:** `apps/web/src/pages/SettingsPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.ts`, `docs/compliance/LEADERBOARD_PRIVACY.md`

## CAMPAIGN-067 · P1 · Invite collaborators (plan-gated) and negative cases

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Owners on each plan: U-Free, U-Plus, U-Pro (up to 3 collaborators) and U-Org (10). Existing users C1–C4. Split flag off.

**Steps:**

1. U-Free and U-Plus: the wizard shows 'Your plan does not include collaborator invitations.' POST /collaborators/invite returns 403.
2. U-Pro on detail: CollaboratorSection → 'Invite collaborator'. Confirm the fields are 'Email Address', 'Their role' (Editor, Co-owner, Featured partner) and 'Invitation Message (optional)', with no 'Revenue Share %' field. Invite C1 as Editor.
3. Invite an unregistered email. Invite yourself. Invite C1 again.
4. Invite C2 and C3, then C4 (the 4th).
5. Via the API, invite with revenueSharePercent 10.
6. In the wizard, enter 2 invite emails: your own (self-invite fails) and an unregistered one. Check the 'Retry unfinished setup' list.
7. A non-owner POSTs an invite.

**Expect:** Plan gates return 403 'Your <Plan> plan does not include campaign collaboration. Upgrade to invite collaborators.' An unregistered email reveals nothing. The API returns 201 with no invitation and the message 'If that email belongs to a Ujimora account, they will be invited.', the web dialog closes with 'If that email belongs to a Ujimora account, they have been invited.', and no row is created. A self-invite returns 400 'You cannot invite yourself as a collaborator' and a duplicate returns 409 'User is already a collaborator on this campaign'. The 4th invite returns 403 'Your Pro plan allows 3 collaborator(s) per campaign. Upgrade to add more.' The wizard lists only the real failure (self-invite) under 'Retry unfinished setup' and does not duplicate the campaign. Non-owners get 403 'Only the campaign owner can invite collaborators'. A revenue share sent through the API is stored but never shown to donors; the admin detail labels it 'Recorded share (not paid automatically)'.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CollaborationController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignCollaboratorRoutes.ts`, `apps/web/src/components/campaigns/CollaboratorSection.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `packages/types/src/subscription.ts`

## CAMPAIGN-068 · P1 · Responding to collaboration invitations and public display

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** Pending invites from U-Pro to C1 and C2, and a pending invite to C3. Collaborator inboxes.

**Steps:**

1. Check C1's in-app notifications (web bell and native inbox) and email for the invite.
2. C1 opens the notice (it links to /invitations) or native Invitations and accepts. C2 declines. Confirm the invitation shows no revenue share.
3. C1 responds again. U3 calls PUT /collaborations/<C1 invite>/respond.
4. A guest opens the campaign Overview and calls GET /campaigns/:id/collaborators. Repeat as the owner.
5. The owner's plan lapses to Free before C3's pending invite is accepted. C3 accepts.
6. The owner removes C1 (Remove Collaborator dialog). C1 removes themselves from another campaign. Re-invite C2 after the decline and check C2's notifications.

**Expect:** Accept and decline work, and repeating returns 409. U3 gets 403. Each invite and re-invite creates one in-app notice, 'Campaign invitation': 'You were invited to be listed as a collaborator on "<title>". Review it in Invitations.' It links to /invitations. No email is sent. Accepted collaborators show publicly with their name and role only, with no revenue-share figure. Pending invites, the invitation message and the inviter are visible only to the owner and admins. A lapsed plan blocks acceptance with 403. Removal works for the owner and for the collaborator themselves. Re-inviting after a decline works.

**Needs:** Email provider (to confirm no email is sent)

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/RespondToCollaborationUseCase.ts`, `apps/api/src/application/use-cases/RemoveCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/ListCampaignCollaboratorsUseCase.ts`, `apps/web/src/pages/CollaborationInvitationsPage.tsx`, `apps/mobile/app/invitations.tsx`

## CAMPAIGN-069 · P1 · Collaborator role copy and revenue share match real permissions and money

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** U-Org campaign with accepted co_owner C1 and editor C2. Paystack test keys. Admin access.

**Steps:**

1. C1 and C2 try to post an update (POST /campaigns/:id/updates), edit the campaign (no endpoint exists), open the owner's Cashout or payouts, and invite another collaborator.
2. Read the role descriptions in the web 'Invite collaborator' dialog.
3. Via the API the owner invites C3 and C4 with revenueSharePercent 80 each, and both accept.
4. As a guest view the collaborators section on web and native. As an admin open the campaign in the admin console.
5. Donate GHS 100 and check C1–C4's wallets and balances.

**Expect:** Every C1/C2 action returns 403 or is absent, and the copy now matches: roles are listing labels ('Listed on the campaign as a co-owner. Only the campaign owner can edit or invite.' / 'Listed on the campaign as an editor. Campaign changes are made by the owner.'). No web or native surface shows a revenue-share percentage to donors or invitees. The admin campaign detail shows 'Recorded share (not paid automatically): 80%'. No money goes to collaborators; shared proceeds use the split feature. Record that the API still accepts and stores unvalidated percentages (160% in total), for staff display only.

**Needs:** Paystack test keys

**Source:** `packages/types/src/collaboration.ts`, `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/web/src/components/campaigns/CollaboratorSection.tsx`, `apps/mobile/app/campaign/[id].tsx`, `apps/admin/src/pages/CampaignDetailPage.tsx`

## CAMPAIGN-075 · P1 · Split and beneficiary-statement permissions

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A split campaign owned by U-Pro. Beneficiary B1 (a platform user). Unrelated user U2. Admin A1.

**Steps:**

1. As U2 call GET /split/versions, GET /split/beneficiaries, POST /split, POST /split/1/activate and GET /split/beneficiaries/<B1>/statement.
2. As B1 GET their own statement, then another beneficiary's.
3. As A1 call each endpoint.
4. Repeat logged out.

**Expect:** U2 gets 403 'Only the campaign owner can manage its split'. B1 can read only their own statement. A1 can read everything. Logged-out calls get 401, except the public disclosure GET.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignSplitRoutes.ts`

## CAMPAIGN-076 · P1 · Organization account creates campaigns

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** ORG (organization role) with approved business KYB and the Organization plan. DB access to expire the KYB.

**Steps:**

1. GET creation-options: verificationCampaignLimit 10, plan maxActiveCampaigns 25, maxGoal 1,000,000.
2. Create a campaign and confirm it appears on /organizations/<slug>.
3. Expire the business KYB and reload creation-options.
4. Try a goal of 1,000,000.01.

**Expect:** The allowance and caps match. After the KYB expires the allowance drops, so creation is blocked or limited. Above the cap returns 422. The campaign shows under the organization's public profile once active.

**Needs:** None

**Source:** `apps/api/src/domain/services/currentVerificationLevel.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/web/src/pages/OrganizationProfilePage.tsx`

## CAMPAIGN-077 · P1 · Organization team roles for campaign updates, and team seat limits

*Surfaces:* android, api, email, ios, web  ·  *Type:* security/permission

**Before:** ORG on the Organization plan (10 team seats including the owner). ORG-PRO on the Pro plan (3 seats including the owner). Invitees: M-admin, M-editor, M-viewer (verified emails, existing accounts) and M-unverified. Unrelated user U2. A campaign by another creator.

**Steps:**

1. The ORG owner opens /organization-team and invites admin, editor and viewer roles. Read the confirmation notice. Check each invitee's in-app notifications and the native Invitations screen. M-unverified tries to accept.
2. M-editor: under 'Publish a campaign update', post an update to an ORG campaign. Confirm the notice 'Campaign update published under your name.'
3. M-viewer tries via the API: POST /organization-team/<org>/campaigns/<id>/updates.
4. M-admin tries to invite another admin.
5. M-editor posts to a campaign not owned by ORG.
6. U2 calls the endpoint.
7. The ORG-PRO owner invites two members, then a third. Re-send an invitation to one of the first two addresses.
8. Let an invitation expire and try to accept it.

**Expect:** Editor and admin can publish (with admission). Viewer and U2 get 403. The non-ORG campaign returns 404. Admins cannot grant admin. An unverified email gets 403 'Verify your email…'. The expired invite returns 404. The web notice reads 'Invitation created. If the recipient already has an account, it appears in their notifications; no email has been sent, so also share this workspace link with them.' Invitees with accounts get one 'Organization invitation' notice ('<org> invited you to its team as <role>. Accept it in Organization workspace & team within seven days.'), and native Invitations lists it with 'Accept invitation'. Seats are enforced: the third new ORG-PRO invite returns 403 'Your Pro plan includes 3 team seats, including the owner. Upgrade the organization's plan or remove a member before inviting someone new.' Re-sending to an existing invitee needs no new seat. A lapsed plan falls back to 1 seat.

**Needs:** None (no invitation email is sent)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/api/src/app.ts`, `apps/web/src/pages/OrganizationTeamPage.tsx`, `apps/mobile/src/components/OrganizationInvitations.tsx`, `packages/types/src/subscription.ts`

## CAMPAIGN-079 · P1 · Campaign editing is unavailable and nothing promises it

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Active campaign owned by U1.

**Steps:**

1. Send PUT and PATCH /api/v1/campaigns/:id with a new title.
2. Search web, native and admin for any campaign edit or delete control (web My Campaigns no longer has an Edit icon).
3. Review the help/FAQ, terms and wizard copy ('You can still edit any step above.').
4. Ask support how an organizer fixes a typo in a live campaign.

**Expect:** There is no edit endpoint (expect 404) and no edit UI, by design per CAMPAIGN_STAFF_REVIEW.md. Copy must not promise edits after publishing; the wizard line refers only to steps before submitting. A documented support procedure exists. Note: block-and-recreate permanently uses one of only 3 lifetime campaigns for individuals. Known open issue I076: the allowance and editing policy is still an open product decision.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `docs/compliance/CAMPAIGN_STAFF_REVIEW.md`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`

## CAMPAIGN-N002 · P1 · Organizer is notified in-app of every campaign review decision

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Organizer U1 with two pending_review campaigns and one active campaign, signed in on web and native. Admin A2 (not U1).

**Steps:**

1. A2 approves pending campaign 1 (attestations and 20+ character notes).
2. U1 opens the notification bell on web and the inbox on native, then opens the new notice.
3. A2 blocks the active campaign, then uses 'Return to review' on it, then approves it again. A2 rejects pending campaign 2.
4. Replay one identical PUT /campaigns/:id/review request and check U1's inbox again.
5. A2 attempts a decision that is refused (for example a stale version returning 409 'The campaign changed. Reload and review the current version.') and U1 checks the inbox.
6. Compare each notice's text with the decision notes A2 entered.
7. Check U1's email inbox.

**Expect:** Each decision creates exactly one inbox notice (type staff_decision). Approve: 'Your campaign is live', '“<title>” passed review and is now public.', which opens /campaigns/:id. Reject: 'Your campaign was not approved'. Block: 'Your campaign has been blocked'. Reopen: 'Your campaign is back in review', '“<title>” has returned to the review queue. We will let you know the outcome.' The reject and block notices point to support@ujimora.com and open /my-campaigns. Replays do not duplicate a notice or reset its read state. Refused or rolled-back decisions send nothing. Staff decision notes never appear, and no email is sent.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`

## CAMPAIGN-N003 · P1 · Expiry sweep relabels only ended active or funded campaigns, and plan slots free at the end date

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Staging API with NODE_ENV not 'test' and readable logs. DB access. Organizer U-Plus (3 active slots) with campaigns in active, funded, pending_review and blocked states, all with end dates in the future. Admin A2.

**Steps:**

1. As U-Plus call GET /campaigns/creation-options and note activeCount.
2. Set endDate to 1 minute ago on the active, funded, pending_review and blocked campaigns.
3. Call creation-options again straight away.
4. Wait up to 5 minutes (the sweep runs every 300 s) and read each campaign's status in admin or the DB.
5. Wait for another sweep and confirm nothing changes.
6. A2 tries to approve the ended pending_review campaign.
7. Compare raisedAmount and ledger balances of the funded campaign before and after its relabel.

**Expect:** activeCount drops by the three ended pending, active and funded campaigns immediately, before any relabel (blocked campaigns never counted). The sweep sets only the ended active and funded campaigns to 'expired'. pending_review and blocked keep their status, and a second run changes nothing. Approving the ended pending campaign returns 409 'An expired campaign cannot be approved'. Money is untouched: raisedAmount and ledger balances are the same as before. A failed sweep logs 'Campaign expiry sweep failed' and retries on the next interval. The organizer gets no notice on expiry; record whether product wants one.

**Needs:** DB access for time travel

**Source:** `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`

## CAMPAIGN-N005 · P1 · Unsent campaign drafts: restore, Start over, account scoping and sign-out (web and native)

*Surfaces:* android, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 and U2 eligible. One browser with devtools (localStorage access) and one phone.

**Steps:**

1. Web as U1: fill Basics and part of Story on /campaigns/new, then reload.
2. Click 'Start over', then reload again.
3. Fill the form again, sign out from the account menu, and sign back in as U1.
4. Fill the form as U1. In devtools remove only the session tokens (simulating an expired session), sign in as U2 on the same browser, and open /campaigns/new.
5. As U1, edit the stored draft 'ujimora:publication-draft:campaign:<U1 id>' so its savedAt is 31 days ago, then reload.
6. Open /campaigns/new in a private window or with site data blocked, and complete a campaign.
7. Publish a campaign successfully and reopen /campaigns/new.
8. Native: repeat steps 1–3 and 7 on the Create screen, killing and reopening the app instead of reloading.

**Expect:** After a reload the form comes back with 'We restored your unsent draft from this browser. If it is waiting for safety review, submit this same version again once it is approved.' (native: '…from this device…'). 'Start over' empties the form and removes the draft. Explicit sign-out removes every draft from that browser or device. Drafts are per account: U2 never sees U1's draft. Drafts older than 30 days are discarded. With storage blocked the wizard works normally, with no restore and no errors. A successful creation clears the draft.

**Needs:** None

**Source:** `apps/web/src/lib/publicationDrafts.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/mobile/src/lib/publicationDrafts.ts`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/context/AuthContext.tsx`

## CAMPAIGN-N006 · P1 · Campaign list API filters: status, category, search and sort for guests and staff

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Public campaigns across categories: active, funded, one active campaign whose end date passed less than 5 minutes ago, and one already expired. Also pending_review and blocked campaigns. A guest, a member and admin A1.

**Steps:**

1. As a guest: GET /api/v1/campaigns?status=active, ?status=funded, ?status=expired and ?status=open.
2. As a guest and as the member: ?status=pending_review, ?status=blocked, ?status=draft and ?includeNonPublic=true.
3. As A1: ?status=pending_review and ?status=blocked.
4. ?status=bogus and ?category=sports.
5. ?category=medical&q=SURG (mixed case), ?q=a.*, ?q=( and a q of 101 characters.
6. ?sortBy=fundedPercent&sortOrder=desc&pageSize=5 for pages 1–3. Then ?status=open&sortBy=endDate&sortOrder=asc.

**Expect:** active and funded exclude campaigns past their end date. expired includes them even before the sweep. open means active or funded and not yet ended. Guests and members who ask for non-public states get the public list (the filter is ignored) and never see pending, blocked or draft rows. A1 gets exactly the requested pending_review or blocked campaigns. An unknown status or category returns 400 'Unsupported status filter' or 'Unsupported category filter'. Search is a case-insensitive literal title match: regex characters are escaped and cause no 500, and more than 100 characters returns 400 'Search is limited to 100 characters'. fundedPercent orders by raised/goal with no repeats or gaps across pages. endDate ascending with status=open lists the soonest-ending open campaigns first.

**Needs:** DB access to set end dates

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/api/src/domain/ports/outbound/CampaignRepositoryPort.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/application/use-cases/GetCampaignUseCase.ts`

## CAMPAIGN-N008 · P1 · QR/social landing page /c/:slug: watch live, report the campaign, report or block the organiser

*Surfaces:* web  ·  *Type:* compliance

**Before:** Active campaign by U1 with a slug. Donor D (signed in) and a guest browser. U1 can go live (LiveKit).

**Steps:**

1. As a guest open /c/<slug>. Confirm 'Report campaign' is shown and the organiser 'Report' / 'Block user' controls are not.
2. Click 'Report campaign' as the guest and sign in as D.
3. Back on /c/<slug>, as D click 'Report campaign', choose a reason and submit. Try once more.
4. U1 starts a live session. Wait up to 15 seconds on D's open page.
5. Click 'Watch live broadcast'. U1 ends the session and D returns to /c/<slug>.
6. As D use the organiser 'Report' (a safety report of 10 or more characters), then 'Block user'.
7. As U1 open your own /c/<slug> and click 'Report campaign'.

**Expect:** The guest is sent to /login and returned to /c/<slug> after signing in. D's report shows 'Thank you for reporting this campaign. Our team will review it shortly.', and the repeat shows 'You have already reported this campaign'. 'Watch live broadcast' appears within about 15 s of going live, links to /live/<sessionId>, and disappears after the session ends. The organiser report shows 'Report received for moderation review.'. After 'Block user' the page shows 'You blocked this organiser, so their campaign is hidden from you.' The owner sees no organiser report or block controls. The owner's own 'Report campaign' attempt is refused with 403 'You cannot report your own campaign'; record as cosmetic that the button is still shown to the owner.

**Needs:** LiveKit credentials

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/web/src/components/safety/ReportContent.tsx`

## CAMPAIGN-N009 · P1 · Intellectual-property and privacy report reasons reach moderators

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Active campaign by U1 with a comment by D2. Reporters D1 (web), D3 (native) and fresh accounts for API calls. Admin A1.

**Steps:**

1. Web: D1 reports the campaign with 'Intellectual property / copyright'.
2. Native: D3 reports the campaign with 'Intellectual property or copyright', and a second campaign with 'Privacy violation'.
3. On web and native, report D2's comment with the safety reasons 'intellectual property' and 'privacy'.
4. Via the API, POST /campaigns/:id/report with reason 'intellectual_property' and with 'privacy' from fresh reporters. Then POST reason 'copyright'.
5. A1 opens /campaign-reports and /safety-reports and exports the campaign reports.

**Expect:** Both reasons are accepted (201) for campaign and safety reports on every client, and an unknown reason returns 400 'Validation failed'. The reports appear in the admin queues and the export. Record the labels: the Campaign reports chip and export show the raw values 'intellectual_property' and 'privacy' because the admin label map lacks them (P2 cosmetic). I155 ops follow-up: trust@, support@ and legal@ still need named owners and SLAs, and the terms still need a takedown procedure.

**Needs:** None

**Source:** `packages/types/src/campaign.ts`, `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/mobile/src/lib/campaignReport.ts`, `apps/web/src/components/safety/ReportContent.tsx`, `apps/mobile/src/components/ReportContent.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/admin/src/pages/CampaignReportsPage.tsx`

## CAMPAIGN-014 · P2 · AI writing assistant on the campaign story

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** AI_WRITING_ENABLED=true and OPENAI_API_KEY set. U1.

**Steps:**

1. In Story open the assistant. Confirm it asks for consent before sending text.
2. Improve the story, apply the suggestion, and check the text is replaced.
3. Exceed the daily limit (20 by default) and confirm the message.
4. Report a generated suggestion.
5. Set AI_WRITING_ENABLED=false and confirm the assistant is hidden or disabled.

**Expect:** No text is sent without explicit consent. Limits are enforced with clear copy. Disabling the flag degrades gracefully without blocking campaign creation.

**Needs:** OpenAI

**Source:** `apps/web/src/components/campaigns/AiWritingAssistant.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/aiWritingRoutes.ts`

## CAMPAIGN-047 · P2 · Share menu, native share and share analytics

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** An active campaign, plus a pending and a blocked campaign. Signed in and logged out.

**Steps:**

1. Web detail: open the Share button menu and try WhatsApp, Facebook, X and LinkedIn. Check each opens the right intent with an encoded URL and title.
2. Click 'Copy link / share on Instagram', then deny clipboard permission and confirm the fallback message.
3. On a phone browser use 'More sharing options' (navigator.share) and cancel it.
4. Expand 'Share this campaign · QR code' and scan the static QR.
5. Native: Share and check the message (title, 200-character blurb, https://app.ujimora.com/c/<slug>).
6. Signed in on web, use each share target, 'Copy link' and the My Campaigns 'Share link' icon. Check that POST /campaigns/:id/share is sent with platform web-whatsapp, web-facebook, web-x, web-linkedin, web-copy or web-native. Repeat logged out.
7. POST /campaigns/<random-24-hex>/share, /campaigns/not-an-id/share, and the share endpoint for the pending and blocked campaigns.

**Expect:** All share targets work. The web share URL is /campaigns/<id> rather than canonical /c/<slug>; it still canonicalizes and gets a campaign preview card. The static QR resolves. Shares are recorded from native and from signed-in web users. Web recording is fire-and-forget, so a failed record never blocks the share, and guests' web shares are not recorded. Unknown, malformed, pending and blocked campaign ids return 404 'Campaign not found' and nothing is saved.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ShareCampaignButton.tsx`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/web/src/components/campaigns/CampaignQRCode.tsx`, `apps/mobile/src/components/ShareCampaign.tsx`, `apps/api/src/application/use-cases/ShareCampaignUseCase.ts`

## CAMPAIGN-055 · P2 · Update permissions and management: pin, delete, edit, and native owner tools

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** U1-Pro's campaign with an accepted collaborator (role editor), donor D, and a second campaign's update id. OpenAI configured.

**Steps:**

1. As the collaborator and as D: POST /campaigns/:id/updates.
2. As U1 pin and unpin an update on web. Delete one through the confirmation dialog.
3. As D: DELETE and POST /pin on an update.
4. Call PUT /campaigns/:idA/updates/<update from campaign B>.
5. As U1 edit via PUT /campaigns/:id/updates/:updateId (there is no UI) with and without consent.
6. Native as U1: open the campaign detail. In Updates tap 'Post an update'. Check the fields (Update type, Title, Update, consent, 'Pin this update to the top') and that 'Post update' stays disabled until the title has 3 or more characters and content is entered. Post a consented text update, then one without consent.
7. Native as U1: use 'Pin'/'Unpin' and 'Delete' on an update.
8. Native as D: open the same campaign.

**Expect:** Non-owners get 403 'Only the campaign creator can post updates' or 'You can only … your own updates'. A cross-campaign id returns 404. Edits go back through admission ('update.edit'). On native the owner's consented post shows 'Update posted.' and the list refreshes. The non-consented post keeps the dialog open with the 409 held-for-review message. Pin and Unpin toggle the order, and Delete asks 'Delete update?' / 'This removes the update for everyone.' before removing it. Limits match web (title 3–200, content up to 5,000). D sees no owner tools.

**Needs:** OpenAI

**Source:** `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/UpdateCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/DeleteCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/PinCampaignUpdateUseCase.ts`, `apps/web/src/components/campaigns/CampaignUpdates.tsx`, `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/src/components/CampaignUpdatesList.tsx`, `apps/mobile/src/components/CampaignUpdateComposer.tsx`

## CAMPAIGN-066 · P2 · Badges are presented truthfully

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Any account with donations.

**Steps:**

1. /leaderboard: review the 'BADGE HIERARCHY' pyramid and tooltips.
2. Open your own profile on web and native and call GET /api/v1/profile; look for earned badges.
3. Native leaderboard: check the medal colours for the top 3.

**Expect:** Badges are shown only as a static hierarchy. Nothing awards them, and GET /profile no longer returns a badges field; the placeholder streak, rank and follower fields were removed too. No profile shows earned badges, and the copy does not imply users hold badges they don't. Product decides whether to ship or hide the leaderboard section.

**Needs:** None

**Source:** `apps/web/src/pages/LeaderboardPage.tsx`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/mobile/app/leaderboard.tsx`

## CAMPAIGN-078 · P2 · My Campaigns dashboards show accurate data

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** U1 with campaigns in active, funded, pending_review and blocked states, plus an active campaign whose end date passed less than 5 minutes ago (before the sweep). Donors on the active one.

**Steps:**

1. Web /my-campaigns: check the stat cards Total Raised, Active, Campaigns and Funded.
2. Check the tabs All, Pending review, Active, Funded, Expired and Blocked, and count the cards in each. Open a tab with no campaigns.
3. Compare the per-card donor text with donorCount from GET /campaigns/mine.
4. Check the per-card icons and use 'Share link'.
5. Native my-campaigns: check the status labels and the navigation.

**Expect:** Totals match the API. Tabs, counts and stat cards follow the effective status: the just-ended campaign shows an 'Expired' chip under Expired, not Active, even before the sweep. There is no Draft tab. Each card shows the real donor count ('1 donor' / 'N donors'). Only 'View' and 'Share link' icons appear (no 'Edit'). 'Share link' copies the campaign link and records a web-copy share. The empty state names the tab, for example 'You don't have any pending review campaigns.'. Native My Campaigns was not changed: record as a P2 defect if it still shows the raw status 'Pending_review'.

**Needs:** None

**Source:** `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/mobile/app/my-campaigns.tsx`, `apps/api/src/application/use-cases/GetCampaignUseCase.ts`

## CAMPAIGN-081 · P2 · Native deep links into campaigns

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Apps installed. An active campaign with a slug. Notes app or adb for opening links.

**Steps:**

1. Open ujimora://c/<slug>. It should open campaign detail via /campaign/shared.
2. Open ujimora://c/<slug>/donate?amount=20. On iOS the external donate screen; on Android the donate form prefilled with 20.
3. Open ujimora://campaigns/<id> and ujimora://campaigns/new.
4. Open ujimora://c/unknown-slug. Confirm the error text and 'Try again'.
5. Open ujimora://u/<userId> (the target of creator QR codes printed before the fix).
6. Tap an https://app.ujimora.com/c/<slug> link in WhatsApp.

**Expect:** The custom-scheme links route correctly and unknown slugs show a recoverable error. ujimora://u/<id> opens that member's profile (/profile/<id>). Requirement: https campaign links should open the installed app. Today they open in the browser. Known open issue I152: Universal Links and App Links (associated domains, assetlinks.json and the exclusions for the Safari donation handoff) are not configured; they need an owner decision and signing-key data.

**Needs:** Physical devices

**Source:** `apps/mobile/app/+native-intent.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/campaign/shared.tsx`, `apps/mobile/app.json`

## CAMPAIGN-N007 · P2 · QR scan counting ignores previews and HEAD requests; live QR codes must name the current broadcast

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Owner U1 with an active campaign, an existing 'campaign' QR code and an active LiveKit session. Another campaign's session id. An ended session id from U1's campaign. curl.

**Steps:**

1. Note the code's scan count in the QR manager (web live page, or native Manage campaign → 'Share with a QR code').
2. curl -I https://api.ujimora.com/r/<code> (a HEAD request).
3. curl -A 'facebookexternalhit/1.1' and -A 'WhatsApp/2.23' https://api.ujimora.com/r/<code>, and paste the short URL into a WhatsApp chat.
4. Scan the code once with a phone camera and re-check the count.
5. Fetch /qr/<code>.png and /qr/<code>.svg and read the response headers. Read the /r/<code> headers too.
6. POST /campaigns/:id/qr-codes {kind:'live', liveSessionId:<other campaign's session>}, then with the ended session, then with the current session. Then POST {kind:'campaign', liveSessionId:<current session>}.
7. During the broadcast scan the live QR and the campaign QR, and check the session's scans stat in the studio.

**Expect:** HEAD requests and preview or crawler fetches still get the 302 but add no scan. The real camera scan adds exactly one. QR images return Cache-Control 'public, max-age=86400, immutable' and an X-Short-Url header, while /r stays no-store. A live QR for another campaign's session or an ended session returns 400 'A live QR code can only point to this campaign’s current broadcast'. The current session works, and a non-live code ignores any liveSessionId. Only the live QR scan increments the session's scans.

**Needs:** LiveKit credentials

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`
