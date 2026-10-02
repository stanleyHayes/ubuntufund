# Donor thank-you messages and on-behalf campaigns: implementation plan

Source spec: `Ujimora_AI_Implementation_Spec_Donor_Thank_You_and_On_Behalf_Campaigns.docx` (v1.0, 27 Sep 2026).
Branch: `feat/thank-you-and-on-behalf`. This file records the repository discovery the spec requires (§2), the decisions taken, and the build order.

## 1. What already exists (discovery)

| Area | Where | What it means for this work |
|---|---|---|
| Campaign ownership | `CampaignModel.creatorId` only; `beneficiaries: string[]` is free-text display names | Add creation mode, beneficiary party, consent and payout authority as **additive optional fields**. Existing documents read as self-created. |
| Campaign states | `active → funded` (still open) → `expired` via a 5-min sweep; no `completed` | "Completion" for thank-yous = campaign ended (end date passed / `expired`) or a `PAID` payout. |
| Organizations | An organization is a `users` row with `role: 'organization'`; members in `organizationmembers` (admin/editor/viewer); `MongoCampaignContentWrite` authorizes org admins/editors to act for the org | "Manager" = the creator account plus its active org admins/editors. Org members cannot create campaigns today; that stays unchanged. |
| Entitlements | `SubscriptionPlan` fields + `PlanLimitsService` (`resolvePlan`, `assertFeature(lock)`, `assertCanCreateCampaign`); admin edits via `UpdatePlanUseCase` (allowlist + value-diff audit) and `ManagePlansPage` | New plan fields `onBehalfCampaigns`, `maxOnBehalfCampaigns`, `onBehalfFeePercent`. No second entitlement system. |
| Admin config | `CommercialConfigService` (`commercial_config`, versioned rows = audit trail) | New numeric keys `onBehalf.*` and `thankYou.*` (0/1 for switches). |
| Creation concurrency | `MongoCampaignCreation` transaction increments the user document, then recounts | The on-behalf limit is re-checked inside the same transaction with the plan/subscription locked. |
| Payout authority | Every payout path compares against `campaign.creatorId` (request, recipient registration, options, cancel, manual/automatic/wallet approval, self-approval checks, KYC owner check, completion alert) | One helper `payoutAuthorityOf(campaign)` replaces those comparisons. For self campaigns it returns `creatorId`, so behaviour is unchanged. |
| Donation gate | `CampaignEntity.canReceiveDonation()` is called by every donation rail and by settlement | The consent gate lives there, driven by a policy snapshot stored on the campaign at creation. |
| Review gate | `MongoCampaignReview.decide` (transaction, version hash) | Approval of an on-behalf campaign requires accepted consent when configured; the beneficiary block joins the review snapshot only for on-behalf campaigns (self versions unchanged). |
| Invitations | Email-verification tokens: random 32 bytes, SHA-256 hash stored, TTL, single use, encrypted outbox (`AccountEmails`) | Beneficiary invitations reuse the hashed-token + encrypted-outbox pattern (new purpose `beneficiary_invitation`). |
| Consent records | `LegalAcceptanceEventModel` (append-only, version, ip, user agent) | New append-only `campaign_beneficiary_consent_events`. The split-proceeds consent (owner can record it) is **not** reused: it is too weak. |
| Bulk email | `MongoActivityAlerts`: deterministic delivery ids, leases, saved request, Resend `Idempotency-Key`, 23 h ambiguity cutoff, 30 s worker loop | Thank-you delivery copies this pattern; the Resend adapter now also returns the provider message id and a typed error. |
| Donors | `DonationIntent` holds status, `donorUserId` (null for guests) and `donorEmail`; eligible = `SUCCEEDED` or `PARTIALLY_REFUNDED` | Canonical recipient key: `user:<id>` or `email:<sha256(lowercase email)>`. |
| Safety screening | `MongoPublicationAdmission` (`action` is a closed list) | New action `thank_you.send`; a held message shows the existing "waiting for safety review" notice. |
| Rate limiting | In-memory `createRateLimiter` + DB cooldowns | Per-user and per-IP limiters (invitation links, management, thank-you calls, unsubscribe), plus a 60 s DB cooldown on invitation resends. The send-slot index and idempotency keys bound thank-you sends. |

## 2. Decisions (owner-approved 29 Sep 2026)

1. **Donor email basis: opt-out.** Every eligible donor gets at most one completion thank-you per campaign. Checkout discloses it, every email has a one-click unsubscribe (works for guests), registered donors can switch it off in Settings, and the privacy notice says so. Suppressions are keyed by email hash.
2. **Payout recipient: beneficiary by default, organization only with consent.** The organization proposes the arrangement; the beneficiary accepts or declines it. The organization never gains payout rights implicitly. Payout authority always requires accepted consent (not configurable: the safer invariant).
3. **Launch plans:** Organization and Enterprise get the entitlement, set through plan data (seed defaults and an audited plan update), never through code that names plans.
4. **Shipping:** feature branch, merged to `main` only after the full suite and a review pass.

Further defaults (all admin-configurable): consent required before publication and before donations; every on-behalf campaign goes to staff review; invitations expire after 168 h; one completion thank-you per campaign; thank-yous unlock when the campaign ends or after a paid payout. The per-campaign fee is an extra platform-fee percentage locked onto on-behalf campaigns at creation (default 0), so no new payment flow is needed.

Out of scope for v1 (documented, not silently dropped): media in thank-you emails (authors write plain text; the branded email shows it escaped), auto-posting the thank-you as a public update, billing-period quotas, and on-behalf creation from the mobile app (mobile gets the thank-you composer and read-only on-behalf status; creation stays on the web).

## 3. Data model (all additive)

- `campaigns`: `creationMode` (`self`/`on_behalf`), `creatorType`, `createdByActorId`, and `onBehalf { beneficiaryType, beneficiaryName, relationship, reason, beneficiaryUserId, consentStatus, consentVersion, consentAt, consentBy, payoutArrangement, payoutAuthorityUserId, publicationRequiresConsent, donationsRequireConsent, staffReviewRequired, autoPublishOnConsent, autoPublishAfterContentCheck, entitlementPlanTier, feePercentApplied }`. `autoPublishOnConsent` (consent alone may publish) is set at creation only when tiering alone would have published the campaign; it is off while its content waits for the campaign staff review (`autoPublishAfterContentCheck` keeps the value staff clearing the content restores). A beneficiary change is admitted like new content: screened with the organizer's permission it keeps the flag; otherwise the content check reopens (`contentReviewTrigger: beneficiary_change`) and the flag waits for staff like creation's. A rejection or block, and a return to review, switch it off, after which staff approve again. Since 1 October 2026 the campaign also stores `contentReviewClearedAt`/`contentReviewClearedBy` and a private `contentAdmission` record (see `docs/compliance/PUBLICATION_REVIEWS.md`), an invitation can be `held` (written, never sent) until that check is cleared and records who named the beneficiary (`invitedByRole`), `beneficiary_changed` consent events record how the new details were admitted (`admission`), and a collaborator invitation recorded during the check carries `heldForContentCheck` until it is announced.
- `campaign_beneficiary_invitations`: hashed token (unique), email hash, email (`select: false`, used only to resend), status, expiry, decision metadata. One pending invitation per campaign.
- `campaign_beneficiary_consent_events`: append-only log (invited, resent, accepted, declined, expired, revoked, reassigned, payout authority changed).
- `donor_thank_yous`: draft/queued/sending/sent/partially_sent/failed, counts, `sendSlot` (unique per campaign, enforces the send limit), submit idempotency key, lease. One draft per campaign.
- `donor_thank_you_deliveries`: deterministic id `sha256(thankYouId:recipientKey:channel)` (a retry can never create a second row), status, attempts, backoff, sanitized error, provider message id, saved request (removed once sent).
- `donor_message_suppressions`: `_id` = email hash.
- Plan fields: `onBehalfCampaigns`, `maxOnBehalfCampaigns`, `onBehalfFeePercent`.

## 4. Build order

1. Types, models, indexes, config keys, plan fields, payout-authority helper, entity changes.
2. On-behalf backend: creation, invitation and consent lifecycle, gates, payout-authority switch across every payout path, admin overrides.
3. Thank-you backend: eligibility, drafts, preview, submit (screened, idempotent), recipient resolution and delivery worker, retry, unsubscribe, completion notice.
4. Admin: plan fields, settings, campaign filters/detail, thank-you monitor.
5. Web: creation flow, beneficiary panel, invitation page, beneficiary view, payout display, thank-you composer, unsubscribe page, settings toggle, checkout disclosure, pricing rows. Mobile: thank-you composer and on-behalf status.
6. Tests (unit, integration, worker idempotency, concurrency, invitations, security, regression), docs, privacy notice, final review, merge.

## 5. As built

The API contract is in [API.md](API.md). This section covers what operators and reviewers need beyond it.

### Where the code lives
| Concern | Code |
|---|---|
| Payout authority (single rule for every payout path) | `apps/api/src/domain/services/campaignPayoutAuthority.ts` |
| Donation gate | `CampaignEntity.canReceiveDonation()` (consent check) |
| Invitations, consent, staff overrides, expiry sweep | `persistence/MongoOnBehalfCampaigns.ts`, routes in `routes/onBehalfRoutes.ts` |
| Entitlement and limit | `PlanLimitsService.onBehalfPolicy` / `assertCanCreateOnBehalf` (re-checked inside the creation transaction) |
| Thank-you drafts, submit, worker, retry, unsubscribe | `persistence/MongoDonorThankYous.ts`, routes in `routes/donorThankYouRoutes.ts` |
| Admin settings | `CommercialConfigService` keys `onBehalf.*`, `thankYou.*` |
| Account closure | `MongoAccountClosureCheck` counts balances the user controls as payout authority; `MongoAccountErasure` withdraws a closing beneficiary's consent and removes stored addresses |
| Web | creation step, beneficiary panel, invitation page, "campaigns run for you", thank-you composer, unsubscribe page, settings toggle, checkout disclosure, plan rows |
| Admin | plan fields, settings section, campaign filters and on-behalf panel (consent timeline, reassign, payout authority), Donor thank-yous monitor, publication-review label |
| Mobile | on-behalf line and status card, payout gating by `viewerAccess`, thank-you composer, "campaigns run for you", settings toggle, Android checkout disclosure, plan row. Creating on-behalf campaigns and answering invitations stay on the web. |
| Marketing | pricing row and FAQ entry |

### Background work
The existing 30-second reconcile loop in `app.ts` runs two new steps:
- `onBehalfCampaigns.expireDue()` expires unanswered invitations.
- `donorThankYous.process()` resolves recipients, delivers, and finalizes.

There are no new processes or queues. Several API instances can run the loop at once, because every step takes a lease.

### Indexes (created by `initializeDatabaseModels()` at startup, before writes)
- `campaigns`: `onBehalf.beneficiaryUserId` (sparse).
- `campaign_beneficiary_invitations`: `tokenHash` (unique), `one_pending_invitation_per_campaign` (unique, partial on `status: 'pending'`), plus `campaignId`, `status` and `expiresAt`.
- `campaign_beneficiary_consent_events`: `campaignId`.
- `donor_thank_yous`:
  - `one_draft_per_campaign` (unique, partial)
  - `one_message_per_send_slot` (unique, partial; enforces `thankYou.maxSendsPerCampaign` under concurrency)
  - `thank_you_submit_idempotency` (unique, partial)
- `donor_thank_you_deliveries`: `one_delivery_per_recipient` (unique on `thankYouId + recipientKey + channel`), plus `{ status, nextAttemptAt }`.
- `donor_message_suppressions`: `_id` is the email hash.

There is no backfill. Existing campaigns have no `creationMode` and read as `self`. Existing plans have no on-behalf fields and read as "not included".

### Configuration and deployment
1. No new environment variables. Invitations and thank-you emails use the account-email settings: `RESEND_API_KEY`, `FROM_EMAIL`, `AUTH_EMAIL_ENCRYPTION_KEY_BASE64` and an https `PUBLIC_WEB_URL`. `PUBLIC_API_URL` builds the one-click `List-Unsubscribe` address. A key derived from `AUTH_EMAIL_ENCRYPTION_KEY_BASE64` signs unsubscribe links, so rotating it invalidates links already sent.
2. After deploying, give the plans that should have the feature `onBehalfCampaigns: true` (with `maxOnBehalfCampaigns` and `onBehalfFeePercent`) in Admin → Plans. The change is audited like any plan edit. The owner chose Organization and Enterprise.
3. Review the defaults in Admin → Settings → Campaigns. The on-behalf switches start at their strictest: consent before publication and before donations, plus staff review. Thank-you messages are on, one per campaign, and unlock when the campaign ends or a payout is paid.

### Observability
There is no metrics stack, so structured log events (pino, with request ids) are the metrics source. None of them include donor or beneficiary contact details.
- On-behalf: `on_behalf.invitation_issued`, `consent_accepted`, `consent_declined`, `consent_revoked`, `invitation_expired`, `beneficiary_changed`, `reassigned`, `payout_authority_changed`.
- Thank-you: `donor_thank_you.draft_saved`, `send_requested`, `recipients_resolved`, `delivery_failed`, `completed`, `unsubscribed`.

Staff decisions also go to the audit log. Consent decisions go to the append-only consent log, which records IP, user agent, terms version and a fingerprint of what was shown.

### Where the build differs from the spec, and why
| Spec | Built | Reason |
|---|---|---|
| Payout recipient "if configured" may be the organization | The organization receives funds only if the beneficiary accepted that arrangement. Payout authority always requires accepted consent and cannot be switched off. Staff can override it with a written reason, an audit entry and notices. | Safer invariant (spec §14): management never implies money. |
| Optional media in thank-you messages | Authors write plain text, which every email shows escaped inside the shared branded template (`emailTemplate.ts`: HTML plus a matching text part). No author images or markup. | Accepting author images or HTML would need its own sanitizer and review. |
| "Delivered" counts | "Sent" means the provider accepted the email | No Resend delivery webhook is integrated yet. |
| Domain/analytics events | Structured log events | The platform has no analytics pipeline, and the privacy notice says it uses no third-party analytics. |
| Beneficiary may edit content ("configured") | Beneficiaries can view, thank donors and control payouts. Content editing stays with the organizer and its org admins/editors. | Keeps one editor chain for publication review. It can be added later behind a setting. |
| Billing-period quota | Limit on active on-behalf campaigns only | No billing-period counters exist to extend. |
| Admin filter by exact consent status | Filters: created for self or others, and beneficiary confirmed or waiting | The list API's public summary only carries `beneficiaryConfirmed`. The detail panel shows the full status and history. |
| Member leaving the organization | Campaigns are created by the organization account itself, so the creator is the organization. Members manage through their org role and never own the campaign. | Matches the existing organization model. |

### Retention
- **Invitation addresses** are deleted once the invitation is accepted, declined or replaced, and when the invited person closes their account. Only the hash remains.
- **Thank-you delivery rows** keep counts and a hash. The prepared email is removed once it is sent, skipped or can no longer be retried, and when the recipient closes their account.
- **Suppressions** keep only the email hash, which is needed to honour an unsubscribe.
- **Consent events** are kept, like audit records, as evidence.
