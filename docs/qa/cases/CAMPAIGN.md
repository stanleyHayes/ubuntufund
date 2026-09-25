# Campaigns (81 cases)

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

## CAMPAIGN-012 · P0 · Double submit and network drop on Publish must not create duplicate campaigns

*Surfaces:* android, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1-Plus with allowance 3 and 3 plan slots. Consent path configured so creation succeeds immediately. Devtools network throttling or a proxy.

**Steps:**

1. Web: double-click 'Publish campaign' rapidly.
2. Web: throttle the network, click Publish, and go offline right after the request leaves (the server commits but the client sees an error). Go back online and click Publish again.
3. Mobile: double-tap 'Create campaign'. Kill the app during the request, reopen, and retry.
4. Check /my-campaigns and GET /campaigns/mine and count the campaigns. Check creation-options totalCount and activeCount.

**Expect:** Exactly one campaign is created per intended submit. POST /campaigns has no idempotency key and the approved content fingerprint can be reused for 7 days, so a retry after an uncertain commit can create a duplicate that permanently uses allowance. Log a duplicate as a P0 defect.

**Needs:** OpenAI (screening)

**Source:** `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

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

**Before:** The pending item from CAMPAIGN-016. U1 keeps the wizard tab open. Admin A2.

**Steps:**

1. A2 enters notes of at least 20 characters and clicks 'Approve this version'.
2. U1 (same tab, unchanged form) clicks 'Publish campaign' again.
3. Confirm the campaign is created and see Settings → Publication reviews 'Approval expires …'.
4. Variant: after approval, change a single character in the story and publish.
5. Variant: after a successful creation, replay the same POST body via the API within 7 days.

**Expect:** An identical resubmission creates the campaign with a status set by tier. Any change creates a new pending review (409 again). Record whether replaying an approved version creates a second campaign. It should not; a duplicate means approvals are reusable.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## CAMPAIGN-018 · P0 · A campaign with a cover image always needs staff review, and drafts are lost

*Surfaces:* admin, android, ios, web  ·  *Type:* recovery/idempotency

**Before:** U1 is eligible. OpenAI configured. Admin A2.

**Steps:**

1. Complete the wizard with a cover image and consent ticked, then publish.
2. Confirm 409 held (reason 'media' in the admin queue).
3. Close the tab. Reopen /campaigns/new, re-enter identical text, and re-upload the same file.
4. A2 approves the original item. U1 publishes the re-entered form.
5. Repeat on mobile, backgrounding the app and killing it before approval.

**Expect:** Consent never bypasses staff review when media is attached. The form is not persisted, and a re-upload produces a new Cloudinary URL and therefore a new fingerprint. The re-entered form is held again and the approved version can never be used. Organizers must keep the form open until approval, which can permanently block campaigns with images. Treat as a launch-blocking UX gap unless drafts or URL reuse are added.

**Needs:** Cloudinary, OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/mobile/app/campaign/create.tsx`

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

**Before:** Active campaign with donations, a QR code, an active LiveKit session, a guest with /campaigns/:id open (SSE connected), and an Android viewer on the live screen.

**Steps:**

1. Admin clicks 'Block campaign' with notes.
2. Guest: focus or refresh the page.
3. Try donations via /c/:slug/donate (Paystack), wallet POST /campaigns/:id/donate, Android donate, and iOS 'Continue in browser'.
4. Check /sitemap.xml, the Explore list, GET /campaigns/:id/comments and /updates as guest, and GET /campaigns/:id/split.
5. Check raisedAmount and the ledger are unchanged.

**Expect:** Guest pages show not-found and the SSE stream closes. The live session ends, viewers are disconnected, and provider stop is queued or confirmed. Every donation rail is rejected. The campaign is removed from the sitemap, Explore and public comments/updates. Balances are untouched and the owner still sees it as blocked. Record the payout behaviour for the payouts area.

**Needs:** LiveKit credentials, Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`, `docs/compliance/CAMPAIGN_VISIBILITY.md`

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

**Expect:** Every surface accepts donations and raised shows 150 with the progress bar capped at 100%. /c/:slug currently disables the button with 'Donations closed' because it checks status === 'active'. That is a defect on the primary QR/social landing page.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/pages/DonatePage.tsx`, `packages/types/src/campaign.ts`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`

## CAMPAIGN-039 · P0 · Raised amount, funded flip, refunds and donor count stay accurate

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Active campaign, goal GHS 100.00. Donors D1 and D2. Paystack test keys. Refund permissions for the admin.

**Steps:**

1. D1 donates 50.00, then D2 donates 49.99 (anonymous), then D1 donates 0.01.
2. After each, record raisedAmount on detail, card %, admin detail and ledger totals, and donorCount.
3. After the 0.01 donation confirm the status is funded.
4. Admin refunds 20.00 of D2's gift.
5. Refund more than the remaining raised total (if allowed by the refund flow).

**Expect:** raisedAmount equals the sum of settled donations exactly, with no float drift (99.99 → 100.00). donorCount counts distinct donors (D1 once) and includes anonymous donors. The status flips to funded at exactly 100.00. A refund lowers raised to 80.00 but the status stays funded (by design). raisedAmount never goes below 0 and matches the ledger projection.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/application/use-cases/GetCampaignUseCase.ts`, `apps/web/src/components/campaigns/CampaignCard.tsx`

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
2. iOS: confirm no in-app amount, wallet or crypto form is shown.
3. iOS: repeat for the funded campaign, then for the no-slug legacy campaign.
4. Android: 'Donate Now' opens the in-app form and then Paystack hosted checkout, and returns to the app.
5. Both: 'Share', 'Watch live broadcast' (when live), and 'Manage campaign'/'Go live' only for the owner. Updates, comments and collaborators render.

**Expect:** iOS never takes payment in the app. Funded campaigns stay donate-able. The legacy no-slug campaign shows 'This campaign is not accepting donations right now.' on iOS (decide whether to accept this). Android completes Paystack checkout. Owner controls are hidden from other users.

**Needs:** Paystack test keys, physical devices

**Source:** `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## CAMPAIGN-059 · P0 · Reporting a campaign on web, and whether staff can see reports

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Active campaign by U1. Donor D. Admin A1.

**Steps:**

1. As a guest click 'Report Campaign'. Confirm redirect to /login.
2. As D: in the 'Report Campaign' dialog choose each 'Reason for Report' option (fraudulent/misleading/inappropriate_content/spam/illegal_activity/other), add a description, and click 'Submit Report'.
3. D reports the same campaign again.
4. U1 reports their own campaign.
5. POST a description longer than 2000 characters.
6. As A1 search the admin console for the report (Reports, Safety reports, Campaign detail).
7. Call GET /api/v1/reports and PUT /api/v1/reports/:id {status:'reviewed'}.

**Expect:** The first report returns 201. Repeats return 409 'You have already reported this campaign'. Self-reports return 403 and the long description returns 400. The report must be visible and actionable in the admin console, but no admin page reads /api/v1/reports ('Reports' is analytics). Fraud reports would go unseen, which contradicts the 'staffed moderation queue' claim in APP_REVIEW_NOTES. Launch blocker.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ReportCampaignDialog.tsx`, `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminReportRoutes.ts`, `apps/admin/src/router.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`

## CAMPAIGN-060 · P0 · Reporting a campaign from the native apps

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Signed-in donor D on iOS and Android release builds. An active campaign by another user.

**Steps:**

1. Open the campaign and scroll to 'Report Campaign'.
2. Tap it and confirm 'Report' in the alert.
3. Watch the result alert, and the API logs or network.
4. Repeat while logged out.

**Expect:** Expected: a 'Reported' confirmation and a stored report. Actual per source: the app sends reason 'Flagged from mobile', which is not in the server enum, so the server returns 400 and the user sees 'Could not submit report. Please try again.' every time. There is no reason picker and no sign-in handling for guests. Store UGC-reporting rejection risk (Apple 1.2 / Play UGC); must be fixed before submission.

**Needs:** Physical devices

**Source:** `apps/mobile/app/campaign/[id].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

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

**Before:** A campaign with an active split. Separately, a pending campaign with an active split.

**Steps:**

1. As a guest open /campaigns/:id, /c/:slug and /c/:slug/donate on web, plus native campaign detail and donate.
2. Look for any statement of which beneficiaries receive which share.
3. GET /api/v1/campaigns/:id/split as a guest for both campaigns.

**Expect:** Donors should see the split disclosure (names and percentages) before paying. Today only the admin SplitProceedsSection reads GET /split, so no web or native donor surface shows it: compliance gap if split is enabled at launch. The pending campaign's split is still returned publicly (beneficiary names leak). Record both.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`, `apps/api/src/application/use-cases/mappers/splitDto.ts`, `apps/admin/src/components/SplitProceedsSection.tsx`, `apps/web/src/pages/DonatePage.tsx`, `docs/large-campaigns/LARGE_CAMPAIGN_PLAN.md`

## CAMPAIGN-080 · P0 · Store-reviewer demo account can use campaign tools

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** The demo account named in APP_REVIEW_NOTES.md. Release builds. OPENAI_API_KEY set in production.

**Steps:**

1. In admin, confirm the demo account's identity KYC is approved with an expiry beyond the review window.
2. Confirm lifetime campaigns used is below the allowance (3) and no active campaign occupies the Free-plan slot (or give it a paid plan via store sandbox).
3. On iOS and Android create a text-only campaign with consent ticked.
4. Donate from that campaign on iOS (Safari handoff) and on Android.
5. Post a comment, report a comment, and report the campaign (see CAMPAIGN-060).
6. Record a cleanup procedure after each review round.

**Expect:** The reviewer can create a live campaign without staff delay, sees correct store-compliant donation behaviour, and every UGC report path works. Any 'verification_limit' or 'plan_limit' block, or a held-for-review response during review, is a store-rejection risk.

**Needs:** OpenAI, Paystack test/live keys, store sandbox, physical devices

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `apps/api/src/domain/services/currentCampaignAllowance.ts`, `apps/api/src/application/services/PlanLimitsService.ts`

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

**Expect:** Every entry point enforces authentication, returns to the wizard after login, and the create page is not indexable.

**Needs:** None

**Source:** `apps/marketing/src/components/sections/HeroSection.tsx`, `apps/marketing/src/components/sections/CTASection.tsx`, `apps/web/src/router.tsx`, `apps/web/src/pages/CreateCampaignPage.tsx`, `apps/mobile/app/(tabs)/create.tsx`, `apps/mobile/app/campaign/create.tsx`

## CAMPAIGN-003 · P1 · Lifetime allowance by verification level counts every campaign, including rejected and blocked ones

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** U1-Pro: identity KYC approved with a future expiry (NATIONAL_ID ⇒ allowance 3), Pro plan (10 active slots). ORG: business KYB approved (INSTITUTIONAL ⇒ 10). Admins A1 and A2.

**Steps:**

1. As U1-Pro create 3 campaigns. Use consent and text only so they go live.
2. A1 opens admin /campaigns/:id for one of them and clicks 'Block campaign' with notes of at least 20 characters.
3. As U1-Pro reload /campaigns/new and call GET /campaigns/creation-options.
4. Attempt a 4th campaign through the API.
5. Repeat the check for ORG (allowance 10) and, if available, a political/media-verified account (25).

**Expect:** After 3 campaigns U1-Pro gets creationBlockReason 'verification_limit' and the POST returns 403, even though one campaign is blocked. Allowances match [0,1,3,10,25]. The product owner signs off that blocked or rejected campaigns permanently use up the allowance (there is no delete).

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

**Before:** U1 is eligible to create. Use an HTTP client with U1's bearer token.

**Steps:**

1. Send currency 'USD'.
2. Send an endDate in the past, and one equal to now.
3. Send endDate '2026-12-01' (not a full ISO datetime).
4. Send titles of 2 and 201 characters, and descriptions of 9 and 5001 characters.
5. Send 21 beneficiaries, one 201-character beneficiary, and a body with no beneficiaries field.
6. Send category 'sports' and priority 'high'.
7. Send 11 imageUrls, then imageUrls ['not-a-url'].
8. Send imageUrls with a non-Cloudinary https URL, a 'javascript:alert(1)' URL and a data: URL. Then view the result in the admin review panel and the web detail page.

**Expect:** Currency: 422 'Campaign goals must be in GHS'. Past date: 422 'End date must be in the future'. Schema breaches: 400 'Validation failed' with a per-field error. An omitted beneficiaries field does not cause a 500 (record the stored value). Record whether non-Cloudinary or non-http(s) image URLs are accepted. They should be rejected, or at minimum never become executable links in admin or web (React 19 blocks javascript: hrefs; confirm).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/validate.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`

## CAMPAIGN-009 · P1 · Web wizard step navigation, client validation and the dropped summary field

*Surfaces:* web  ·  *Type:* functional

**Before:** U1 is eligible. Desktop and 390px mobile viewport.

**Steps:**

1. Basics: title 'Help' shows 'Use at least 5 characters'. Short summary under 10 or over 140 characters shows an error. With no category selected, 'Continue' is disabled.
2. Story: 'Your story' with fewer than 20 characters shows an error, and 'Who will this help?' needs at least one comma-separated name.
3. Goal & timeline: goal 0 shows 'Goal must be greater than zero', and today's date shows 'Pick a future date'. Choose a priority card (Normal, Urgent or Critical).
4. Review: check every ReviewItem (Title, Summary, Category, Description, Beneficiaries, Cover image, Goal, Ends, Priority). Click each section's 'Edit' and confirm you return to that step with data kept.
5. On step 3 click 'Continue' quickly and confirm nothing is submitted until 'Publish campaign'.
6. Use 'Back' repeatedly and confirm no data is lost.
7. After a successful creation, look for the summary text on /campaigns/:id, /c/:slug and in the admin review.

**Expect:** Validation blocks each step correctly. Edit and Back keep data. Only 'Publish campaign' submits. The summary is sent but never persisted or shown anywhere. File this as a defect, or remove the field.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/CampaignForm.tsx`, `apps/web/src/hooks/useCampaigns.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-010 · P1 · Native create wizard parity on iOS and Android

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** U1-Pro is eligible. Physical iPhone and Android device, in light and dark mode.

**Steps:**

1. Open Create and confirm 'Step 1 of 4 · Basics' with a progress bar.
2. Enter a title under 5 characters and tap Continue. Confirm the snackbar 'Enter a title of at least 5 characters…'.
3. Story and media: enter the story, beneficiaries and a 'Campaign cover' (crop 16:9). Try the AI writing assistant.
4. Goal and timeline: confirm the 250k copy and 'Current goal limit: GH₵…'. Enter a goal above the limit and confirm the error. Use the date field and Urgency picker. Enter invite emails and toggle split if the plan allows.
5. Review: confirm the summary text and PublicationConsent are shown, then tap 'Create campaign'.
6. Confirm the success card 'Campaign created' with 'Status: active' or 'pending_review' and a 'View campaign' button.
7. Rotate the device, open and close the keyboard, and background the app mid-form.

**Expect:** Validation and eligibility match web. The success card shows the true status. The cover image uploads. The keyboard never hides inputs. The cover picker is hidden when the plan's maxMediaPerCampaign is 0.

**Needs:** Cloudinary; OpenAI (assistant, optional)

**Source:** `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`

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

## CAMPAIGN-019 · P1 · Flagged text or unavailable screening falls back to staff review

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Staging where OPENAI_API_KEY can be swapped. U1.

**Steps:**

1. With consent, submit a story containing clearly violent or hateful text.
2. In the admin queue confirm the item's reason is 'flagged'.
3. Set OPENAI_API_KEY to an invalid value and restart.
4. Submit clean text with consent.
5. Confirm the reason is 'unavailable', with no 500 and no hang longer than about 15 seconds.

**Expect:** Flagged and unavailable submissions are held privately for staff with the 409 message. The request never crashes or hangs. Note for launch: a missing OPENAI_API_KEY in production silently routes every campaign, comment and update to manual review.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiPublicationScreener.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/app.ts`

## CAMPAIGN-020 · P1 · Staff decline, author-visible notes, and approval expiry

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Pending campaign.create item from U1. Admin A2. DB access.

**Steps:**

1. A2 enters notes and clicks 'Decline this version'.
2. U1 resubmits the same version.
3. U1 opens Settings → Publication reviews.
4. U1 edits the story and submits again.
5. For an approved item, set approvalExpiresAt to the past in the DB, then resubmit it.

**Expect:** Declined resubmission returns 422 'This version was declined in safety review. Check Publication reviews, revise your draft, or contact support@ujimora.com to appeal.' The author sees 'Review response: <notes>'. The edited version creates a new pending review. The expired approval returns 409 'This safety approval expired…'.

**Needs:** None

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

## CAMPAIGN-027 · P1 · Admin changes review-tier settings without a redeploy

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Admin with SETTINGS edit permission. A second admin role without edit permission.

**Steps:**

1. Admin Settings → Campaigns: set 'Tier rule up to GHS 250,000' to 'Review every campaign up to GHS 250,000' and save.
2. Create a 5,000 GHS campaign.
3. Edit the tier ceilings to a non-ascending set (for example Tier 2 below Tier 1) and try to save.
4. Restore the defaults ('Auto-approve tiers 1–3').
5. Log in as the read-only role and confirm the controls are disabled.

**Expect:** The new rule applies to the very next campaign (pending_review). Invalid thresholds are rejected. The read-only role cannot edit. Changes are audited in commercial-config history.

**Needs:** None

**Source:** `apps/admin/src/components/CampaignReviewSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-029 · P1 · Reject a pending campaign, and how the organizer is told

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** A pending_review campaign. Admin A2. Organizer's inbox.

**Steps:**

1. A2 clicks 'Reject campaign' with notes.
2. As the organizer open web /campaigns/:id, /my-campaigns (Blocked tab) and the native campaign detail.
3. Check the organizer's email and in-app notifications for any decision message.
4. Via API, send PUT /campaigns/:id/reject for an active campaign.

**Expect:** Status becomes blocked, with the 'BLOCKED' chip and 'Campaign Inactive' on web. Rejecting an active campaign returns 409 'Only pending campaigns can be rejected'. The organizer currently gets no notification and cannot see the reason (review notes are admin-only). Confirm a support communication process exists before launch, or log a defect.

**Needs:** Email provider (to verify absence or presence)

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/admin/src/components/CampaignReviewPanel.tsx`, `apps/web/src/pages/MyCampaignsPage.tsx`

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

## CAMPAIGN-035 · P1 · Admin campaigns list completeness with more than 50 campaigns

*Surfaces:* admin  ·  *Type:* functional

**Before:** Staging with at least 55 campaigns, where the oldest is pending_review.

**Steps:**

1. Admin → Campaigns → Pending tab.
2. Search for the oldest pending campaign's title.
3. Use the status and category filters, switch between table and card views, and Export.

**Expect:** All pending campaigns are reachable. The page loads only /campaigns?page=1&pageSize=50 and filters client-side, so the oldest pending campaign will be missing: log as a defect (review-queue blind spot). Filters and export reflect only the loaded set.

**Needs:** None

**Source:** `apps/admin/src/pages/CampaignsPage.tsx`, `apps/admin/src/hooks/useApiData.ts`

## CAMPAIGN-038 · P1 · Ended campaigns: donations close, but the status never becomes expired

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** U1 on the Free plan with 1 active campaign. DB access to set endDate in the past.

**Steps:**

1. Set the campaign's endDate to yesterday.
2. Try donations on wallet POST /campaigns/:id/donate, the donation-intent (Paystack) flow, and crypto if CRYPTO_PAYMENTS_ENABLED.
3. Web /campaigns/:id: check 'Donations closed'. /c/:slug: check the Donate button. The card shows 'Ended'.
4. GET /campaigns/:id and check the status.
5. Explore → status 'Expired' filter.
6. /my-campaigns: check the status and tabs.
7. /sitemap.xml.
8. U1 tries to create a new campaign.

**Expect:** Every rail rejects server-side. But the status stays 'active' because no job sets EXPIRED. Consequences: the Explore Expired filter is always empty; /c/:slug still shows 'Donate now' and then a closed donate page; the sitemap keeps listing it; and the Free plan slot stays occupied, so U1 gets plan_limit forever. Log as a launch defect needing an expiry sweep.

**Needs:** Paystack test keys; Bitnob only if crypto enabled

**Source:** `apps/api/src/domain/entities/Campaign.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/ExplorePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`

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

**Before:** Production-like deploy of app.ujimora.com (Vercel) and api.ujimora.com (Render). An active campaign and a pending campaign.

**Steps:**

1. Inspect the <head> on /c/<slug> and /campaigns/<id>: title '<title clipped to 46> | Ujimora', meta description, canonical https://app.ujimora.com/c/<slug>, og:type article, og:image = cover, breadcrumb JSON-LD.
2. As owner inspect the pending campaign page: robots 'noindex, follow'.
3. Fetch https://app.ujimora.com/robots.txt.
4. Fetch https://app.ujimora.com/sitemap.xml and https://api.ujimora.com/sitemap.xml.
5. Run the Google Rich Results Test on /c/<slug>.

**Expect:** Metadata is correct and both URLs canonicalize to /c/:slug. The sitemap at app.ujimora.com must return XML listing /c/<slug> for active and funded campaigns. apps/web/vercel.json has no rewrite for it and the catch-all serves index.html, so expect the SPA HTML: a defect, since robots.txt advertises that URL.

**Needs:** None

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/lib/seo.ts`, `apps/web/vercel.json`, `apps/web/public/robots.txt`, `apps/api/src/infrastructure/adapters/inbound/http/routes/sitemapRoutes.ts`

## CAMPAIGN-044 · P1 · Social link previews for shared campaigns

*Surfaces:* web  ·  *Type:* functional

**Before:** An active campaign with a cover image on the production domain.

**Steps:**

1. Paste https://app.ujimora.com/c/<slug> into a WhatsApp chat.
2. Run the same URL through the Facebook Sharing Debugger, X/Twitter card preview and LinkedIn Post Inspector.
3. Repeat with /campaigns/<id> and with a QR short URL https://api.ujimora.com/r/<code>.

**Expect:** The preview should show the campaign title, summary and cover. Campaign meta is set client-side on a Vite SPA and crawlers do not run JS, so expect the generic 'Ujimora — Trusted Crowdfunding in Ghana' preview. Log it and decide whether edge or pre-rendered OG is needed before launch.

**Needs:** None

**Source:** `apps/web/index.html`, `apps/web/src/lib/seo.ts`, `apps/web/vercel.json`

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

## CAMPAIGN-049 · P1 · 'Creator profile' QR codes lead to a 404

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Owner U1. Mobile Manage campaign → 'Share with a QR code'.

**Steps:**

1. Choose Link destination 'Creator profile' and tap 'Create QR code'.
2. Scan the code, or open the short URL.

**Expect:** It should land on the organizer's public profile or creator page. The target is https://app.ujimora.com/u/<creatorId>, and neither the web router nor the native resolver has a /u route, so expect the Not Found page. Log as a defect (fix the target or remove the option).

**Needs:** None

**Source:** `apps/api/src/application/utils/shortLinkTarget.ts`, `apps/web/src/router.tsx`, `apps/mobile/src/navigation/resolvePath.ts`

## CAMPAIGN-050 · P1 · QR and short-link permissions and negative cases

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Campaign owned by U1. User U2. A pending campaign that has a QR code.

**Steps:**

1. As U2 call POST and GET /api/v1/campaigns/:id/qr-codes. Repeat logged out.
2. As U1 POST kind 'amount' with presetAmount 0, then -5. POST a label of 121 characters.
3. GET /r/zzzzzzz, /qr/zzzzzzz.png and /qr/zzzzzzz.svg.
4. As a guest scan the pending campaign's QR code.
5. Hit /r/<code> 200 times from a script.

**Expect:** U2 gets 403 'Only the campaign owner…' and logged-out calls get 401. Invalid input returns 400 and unknown codes return 404. The pending campaign's QR lands on the not-found page with no data leaked. Record that /r is not rate-limited, so scan counts can be inflated (P2).

**Needs:** None

**Source:** `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ListCampaignQrCodesUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shortLinkRoutes.ts`

## CAMPAIGN-051 · P1 · QR preset amount carries through to the checkout amount accurately

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Amount QR codes for 25.50 and (via API) 10.555. Paystack test keys.

**Steps:**

1. Scan the 25.50 code on a phone browser. Check the donate page amount field shows 25.50, then complete checkout.
2. Open the same link through the native deep link on Android and on iOS (external browser).
3. Open the 10.555 code.
4. Change the prefilled amount before paying.

**Expect:** The amount is prefilled exactly, and the fee breakdown and charged amount match the final amount to the pesewa. The 3-decimal preset is rejected or normalized consistently (the native fundraisingUrl drops non-2dp amounts). The donor can always edit the amount.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`

## CAMPAIGN-052 · P1 · Automatic vanity slug generation

*Surfaces:* api, web  ·  *Type:* functional

**Before:** U1 is eligible (use API creation to save wizard time).

**Steps:**

1. Create titles: "Help Ama's Surgery"; the same title again; 'Café Kɔkɔɔ Fund'; '🙏🙏🙏' (emoji only); 'Admin'; a 200-character title.
2. Check each slug in the response and in the /c/<slug> URL.

**Expect:** help-ama-s-surgery. The duplicate gets a 4-character random suffix. Diacritics are stripped. Emoji-only gives campaign-<6 chars>. Reserved 'admin' gets a suffix. The long title is cut to 60 characters or fewer with no trailing hyphen. All slugs are unique.

**Needs:** None

**Source:** `apps/api/src/application/utils/slug.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`

## CAMPAIGN-053 · P1 · Vanity slug change (API only), permissions and link breakage

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Active campaign owned by U1 with an existing QR code. User U2. Admin A1.

**Steps:**

1. As U1: PATCH /api/v1/campaigns/:id/slug {slug:'ama-surgery-2026', automatedReviewConsent:true}.
2. Repeat with slugs 'live' (reserved), an existing slug, 'Bad_Slug', and the current slug.
3. As U2 PATCH. As A1 PATCH.
4. Without consent, confirm it is held for staff review.
5. Open the old /c/<old-slug> and scan the old QR code.

**Expect:** The owner succeeds after admission. Reserved and taken slugs return 409, bad format returns 400, and an unchanged slug is a no-op. U2 gets 403 and the admin can change it. The old URL and every printed QR code now land on not-found, because short-link targets are stored at creation and there is no redirect. Decide on redirects or lock slugs once QR codes exist. No web or native UI exists for this.

**Needs:** OpenAI (consent path)

**Source:** `apps/api/src/application/use-cases/SetCampaignSlugUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoShortLinkRepository.ts`

## CAMPAIGN-054 · P1 · Owner posts a campaign update on web

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Active campaign owned by U1. OpenAI configured. Admin A2.

**Steps:**

1. Detail → Updates tab → 'Post Update'.
2. In the 'Post an Update' dialog: title (at least 3 characters), content, type (milestone/general/thank_you/urgent), tick 'Pin this update to the top' and the consent box. Click 'Post Update'.
3. Confirm the page reloads and the update is shown pinned first.
4. Post another update without consent. Confirm the held message appears in the dialog, then A2 approves and you resubmit the identical update.
5. Via API post with mediaUrls. Confirm it is always held for staff.
6. As a guest read GET /campaigns/:id/updates.

**Expect:** A consented text update publishes immediately. A non-consented one is held privately until approved and then resubmitted. Media always goes to staff. Donors see published updates in order with the pinned one first.

**Needs:** OpenAI

**Source:** `apps/web/src/components/campaigns/CreateUpdateDialog.tsx`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignUpdateRoutes.ts`

## CAMPAIGN-056 · P1 · Update visibility, reporting and staff hide

*Surfaces:* admin, android, ios, web  ·  *Type:* security/permission

**Before:** A pending campaign with an update (owner-posted). An active campaign with an update. Donor D. Admin A1.

**Steps:**

1. As a guest GET the pending campaign's /updates.
2. As D, on the active campaign's update, use Report (reason plus a description of at least 10 characters).
3. A1 opens Safety reports, finds the campaign_update report, enters notes and clicks 'Hide campaign update'.
4. D blocks the update author and reloads the updates list.

**Expect:** The pending campaign's updates return 404 to the guest. The report is captured with an evidence snapshot. The hidden update disappears publicly while funds are untouched. Blocked authors are filtered from that viewer.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/GetCampaignUpdatesUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## CAMPAIGN-057 · P1 · Posting comments: consent, avatar-as-media hold, identity changes and limits

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** Active campaign. D1 without a profile avatar. D2 with a profile avatar. OpenAI configured. Admin A2.

**Steps:**

1. D1 writes a comment, ticks consent and posts. It appears immediately.
2. D1 posts without consent. It is held with the 409 message.
3. D2 posts with consent. Confirm it is still held, because the avatar counts as media.
4. A2 approves D2's item and D2 resubmits the identical text.
5. D2 changes display name while an item is pending, then resubmits.
6. Try 1001 characters (the counter caps at 1000) and a whitespace-only comment via the API.
7. As a guest, check the comment box state.

**Expect:** Consented clean text from users without an avatar publishes instantly. Users with an avatar always need staff approval plus an identical resubmission (a UX risk worth recording). An identity change returns 409 'Your public identity changed during review. Refresh and submit again.' Whitespace returns 400. Guests are prompted to sign in. Native behaves the same.

**Needs:** OpenAI

**Source:** `apps/api/src/application/use-cases/CampaignCommentUseCases.ts`, `apps/web/src/components/campaigns/CampaignComments.tsx`, `apps/mobile/src/components/CampaignComments.tsx`

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

**Before:** About 15 public campaigns across all 7 categories and a mix of active and funded, including one whose description (not title) contains 'surgery'.

**Steps:**

1. Web /explore: search 'surgery'. Only title matches appear.
2. Click each category chip (Medical, Education, Emergency, Business, Community, Religious, Creative).
3. Use the status filter (Active/Funded/Pending Review/Expired).
4. Sort by Most funded and Newest.
5. Page through at 6 per page. Click 'Clear filters'. Trigger the empty state.
6. Native Explore: the same checks plus the 'ending soon' sort. Home page grid.

**Expect:** Filters combine correctly, results show 'Showing N campaigns', pagination resets on filter change, and the empty state appears. Search does not match descriptions: confirm this is intended. Most-funded sort orders by raised/goal ratio. Native and web give the same results.

**Needs:** None

**Source:** `apps/web/src/pages/ExplorePage.tsx`, `apps/web/src/components/campaigns/CampaignSearchBar.tsx`, `apps/mobile/app/(tabs)/explore.tsx`, `apps/web/src/pages/HomePage.tsx`

## CAMPAIGN-062 · P1 · Explore and the list API at scale (more than 20 campaigns)

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Staging seeded with 30 or more public campaigns.

**Steps:**

1. Web /explore and native Explore: count the campaigns.
2. Search for the title of the 25th-newest campaign.
3. GET /api/v1/campaigns?pageSize=100000.
4. GET /api/v1/campaigns?page=-1 and ?page=0.
5. GET /api/v1/campaigns?sortBy=creatorId and ?sortBy=lockedPlatformFeePercent.

**Expect:** Every public campaign should be discoverable. Both clients call /campaigns with no pageSize (default 20) and filter client-side, so only the 20 newest ever appear and search misses the rest: launch defect. The API has no pageSize maximum (abuse and DoS risk), a negative page yields a negative skip (expect 4xx, not 500), and sortBy accepts any field. Log as security/performance issues.

**Needs:** None

**Source:** `apps/web/src/hooks/useCampaigns.ts`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.ts`

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

**Before:** Owners on each plan: U-Free, U-Plus, U-Pro (up to 3 collaborators, escrow on), U-Org (10). Existing users C1–C4. Split flag off.

**Steps:**

1. U-Free and U-Plus: the wizard shows 'Your plan does not include collaborator invitations.' POST /collaborators/invite returns 403.
2. U-Pro on detail: CollaboratorSection → 'Invite collaborator' with 'Email Address', 'Their role', 'Revenue Share %' and 'Invitation Message (optional)'. Invite C1 as editor at 0%.
3. Invite an unregistered email. Invite yourself. Invite C1 again.
4. Invite C2 and C3, then C4 (the 4th).
5. Invite with revenue share 10 on a plan without escrow.
6. In the wizard, enter 2 invite emails with one unregistered, and confirm the 'Retry unfinished setup' button.
7. A non-owner POSTs an invite.

**Expect:** Plan gates return 403 with upgrade copy. An unregistered email returns 404 'User not found' (account-enumeration risk: record it). Self-invite returns 400 and a duplicate returns 409. The 4th invite returns 403 'Your Pro plan allows 3 collaborator(s) per campaign'. The wizard shows partial failures without duplicating the campaign. Non-owners get 403.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignCollaboratorRoutes.ts`, `apps/web/src/components/campaigns/CollaboratorSection.tsx`, `apps/web/src/components/campaigns/CampaignCreationExtras.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `packages/types/src/subscription.ts`

## CAMPAIGN-068 · P1 · Responding to collaboration invitations and public display

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** Pending invites from U-Pro to C1 and C2. Collaborator inboxes.

**Steps:**

1. Check C1's email and in-app notifications for the invite.
2. C1 opens /invitations (web) or Invitations (native) and accepts. C2 declines.
3. C1 responds again. U3 calls PUT /collaborations/<C1 invite>/respond.
4. Guest opens the campaign Overview.
5. The owner's plan lapses to Free before C3's pending invite is accepted. C3 accepts.
6. The owner removes C1 (Remove Collaborator dialog). C1 removes themselves from another campaign. Re-invite C2 after the decline.

**Expect:** Accept and decline work, and repeating returns 409. U3 gets 403. Accepted collaborators show publicly with role and 'X% revenue share'; pending invites are visible only to the owner. A lapsed plan blocks acceptance with 403. Removal works for the owner and for self. Re-invite after decline works. No invite notification is sent today, so invitees must discover /invitations themselves: record it.

**Needs:** Email provider (verify absence or presence)

**Source:** `apps/api/src/application/use-cases/RespondToCollaborationUseCase.ts`, `apps/api/src/application/use-cases/RemoveCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/ListCampaignCollaboratorsUseCase.ts`, `apps/web/src/pages/CollaborationInvitationsPage.tsx`, `apps/mobile/app/invitations.tsx`

## CAMPAIGN-069 · P1 · Collaborator role copy and revenue-share display versus real permissions and money

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** U-Org campaign with accepted co_owner C1 and editor C2. Paystack test keys.

**Steps:**

1. C1 and C2 try to post an update (POST /campaigns/:id/updates), edit the campaign (no endpoint exists), open the owner's Cashout or payouts, and invite another collaborator.
2. The owner invites C3 and C4 at 80% revenue share each, and both accept.
3. Guest views the collaborators section.
4. Donate GHS 100 and check C1–C4's wallets and balances.

**Expect:** Every C1/C2 action returns 403 or is absent, which contradicts the role descriptions ('Full co-owner: can edit campaign…', 'Editor: can edit campaign content'). The public page shows '80% revenue share' twice (160% total) while no money goes to collaborators. Misleading donor-facing claims: fix the copy, validate the totals, or hide the percentages before launch.

**Needs:** Paystack test keys

**Source:** `packages/types/src/collaboration.ts`, `apps/api/src/application/use-cases/InviteCollaboratorUseCase.ts`, `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/web/src/components/campaigns/CollaboratorSection.tsx`, `apps/mobile/app/campaign/[id].tsx`

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

## CAMPAIGN-077 · P1 · Organization team roles for campaign updates, and team size limits

*Surfaces:* api, email, web  ·  *Type:* security/permission

**Before:** ORG on the Pro plan (maxTeamMembers 3). Invitees: M-admin, M-editor, M-viewer (verified emails), M-unverified. Unrelated user U2. A campaign by another creator.

**Steps:**

1. The ORG owner opens /organization-team and invites admin, editor and viewer roles. M-unverified tries to accept.
2. M-editor: under 'Publish a campaign update', post an update to an ORG campaign. Confirm the notice 'Campaign update published under your name.'
3. M-viewer tries via the API: POST /organization-team/<org>/campaigns/<id>/updates.
4. M-admin tries to invite another admin.
5. M-editor posts to a campaign not owned by ORG.
6. U2 calls the endpoint.
7. Invite a 4th and 5th member.
8. Let an invitation expire and try to accept it.

**Expect:** Editor and admin can publish (with admission). Viewer and U2 get 403. The non-ORG campaign returns 404. Admins cannot grant admin. Unverified email gets 403 'Verify your email…'. The expired invite returns 404. The team size limit should stop at 3 but maxTeamMembers is not enforced: log as a defect.

**Needs:** Email provider (invitations)

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/pages/OrganizationTeamPage.tsx`, `packages/types/src/subscription.ts`

## CAMPAIGN-079 · P1 · Campaign editing is unavailable and nothing promises it

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Active campaign owned by U1.

**Steps:**

1. Send PUT and PATCH /api/v1/campaigns/:id with a new title.
2. Search web, native and admin for any campaign edit or delete control.
3. Review the help/FAQ, terms and wizard copy ('You can still edit any step above.').
4. Ask support how an organizer fixes a typo in a live campaign.

**Expect:** There is no edit endpoint (expect 404) and no edit UI, by design per CAMPAIGN_STAFF_REVIEW.md. Copy must not promise edits after publishing. A documented support procedure exists. Note: block-and-recreate permanently uses one of only 3 lifetime campaigns for individuals.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/campaignRoutes.ts`, `docs/compliance/CAMPAIGN_STAFF_REVIEW.md`, `apps/web/src/pages/MyCampaignsPage.tsx`, `apps/web/src/components/campaigns/CampaignForm.tsx`

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

**Before:** An active campaign. Signed in and logged out.

**Steps:**

1. Web detail: open the Share button menu and try WhatsApp, Facebook, X and LinkedIn. Check each opens the right intent with an encoded URL and title.
2. Click 'Copy link / share on Instagram', then deny clipboard permission and confirm the fallback message.
3. On a phone browser use 'More sharing options' (navigator.share) and cancel it.
4. Expand 'Share this campaign · QR code' and scan the static QR.
5. Native: Share and check the message (title, 200-character blurb, https://app.ujimora.com/c/<slug>).
6. Check that POST /campaigns/:id/share is recorded on native but not on web.
7. POST /campaigns/<random-24-hex>/share.

**Expect:** All share targets work. The web share URL is /campaigns/<id> rather than canonical /c/<slug> (it still canonicalizes). The static QR resolves. Analytics are recorded only from native. The fake campaign id currently returns 201 because there is no existence check: log as P2.

**Needs:** None

**Source:** `apps/web/src/components/campaigns/ShareCampaignButton.tsx`, `apps/web/src/components/campaigns/CampaignQRCode.tsx`, `apps/mobile/src/components/ShareCampaign.tsx`, `apps/api/src/application/use-cases/ShareCampaignUseCase.ts`

## CAMPAIGN-055 · P2 · Update permissions and management: pin, delete, edit, and native gaps

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** U1-Pro's campaign with an accepted collaborator (role editor), donor D, and a second campaign's update id.

**Steps:**

1. As the collaborator and as D: POST /campaigns/:id/updates.
2. As U1 pin and unpin an update. Delete one through the confirmation dialog.
3. As D: DELETE and POST /pin on an update.
4. Call PUT /campaigns/:idA/updates/<update from campaign B>.
5. As U1 edit via PUT /campaigns/:id/updates/:updateId (there is no UI) with and without consent.
6. On native, open the owner's campaign detail and look for post, pin or delete controls.

**Expect:** Non-owners get 403 'Only the campaign creator can post updates' or 'You can only … your own updates'. A cross-campaign id returns 404. Edits go back through admission ('update.edit'). Native has no owner update controls (isCreator is hard-coded false): record as a parity gap.

**Needs:** OpenAI

**Source:** `apps/api/src/application/use-cases/CreateCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/UpdateCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/DeleteCampaignUpdateUseCase.ts`, `apps/api/src/application/use-cases/PinCampaignUpdateUseCase.ts`, `apps/web/src/components/campaigns/CampaignUpdates.tsx`, `apps/mobile/app/campaign/[id].tsx`

## CAMPAIGN-066 · P2 · Badges are presented truthfully

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Any account with donations.

**Steps:**

1. /leaderboard: review the 'BADGE HIERARCHY' pyramid and tooltips.
2. Open your own profile and look for earned badges.
3. Native leaderboard: check the medal colours for the top 3.

**Expect:** Badges are presented as a static hierarchy only: the profile API returns badges: [] and nothing awards them. Copy must not imply users hold badges they don't. Product decides whether to ship or hide the section.

**Needs:** None

**Source:** `apps/web/src/pages/LeaderboardPage.tsx`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/mobile/app/leaderboard.tsx`

## CAMPAIGN-078 · P2 · My Campaigns dashboards show accurate data

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** U1 with campaigns in active, funded, pending_review and blocked states. Donors on the active one.

**Steps:**

1. Web /my-campaigns: check the stat cards Total Raised, Active, Campaigns and Funded.
2. Check the tabs All, Active, Funded, Draft and Blocked, and count the cards in each.
3. Compare the per-card donor text with donorCount from GET /campaigns/mine.
4. Click the 'Edit' icon and the 'Share link' icon.
5. Native my-campaigns: check the status labels and the navigation.

**Expect:** Totals match the API. Recorded defects: each card shows a hard-coded '0 donors'; there is no Pending review or Expired tab, so pending campaigns appear only under All; the Draft tab is always empty; 'Edit' just opens the detail page. Native status text for pending_review should be human-readable.

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
5. Tap an https://app.ujimora.com/c/<slug> link in WhatsApp.

**Expect:** The custom-scheme links route correctly and unknown slugs show a recoverable error. https links open in the browser, because no associated domains or verified app links are configured for app.ujimora.com. Confirm this is acceptable.

**Needs:** Physical devices

**Source:** `apps/mobile/app/+native-intent.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/campaign/shared.tsx`, `apps/mobile/app.json`
