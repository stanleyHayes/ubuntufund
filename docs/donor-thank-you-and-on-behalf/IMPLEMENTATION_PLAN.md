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
| Rate limiting | In-memory `createRateLimiter` + DB cooldowns | Per-user limiter plus a 60 s DB cooldown on invitations and sends. |

## 2. Decisions (owner-approved 29 Sep 2026)

1. **Donor email basis: opt-out.** Every eligible donor gets at most one completion thank-you per campaign. Checkout discloses it, every email has a one-click unsubscribe (works for guests), registered donors can switch it off in Settings, and the privacy notice says so. Suppressions are keyed by email hash.
2. **Payout recipient: beneficiary by default, organization only with consent.** The organization proposes the arrangement; the beneficiary accepts or declines it. The organization never gains payout rights implicitly. Payout authority always requires accepted consent (not configurable: the safer invariant).
3. **Launch plans:** Organization and Enterprise get the entitlement, set through plan data (seed defaults and an audited plan update), never through code that names plans.
4. **Shipping:** feature branch, merged to `main` only after the full suite and a review pass.

Further defaults (all admin-configurable): consent required before publication and before donations; every on-behalf campaign goes to staff review; invitations expire after 168 h; one completion thank-you per campaign; thank-yous unlock when the campaign ends or after a paid payout. The per-campaign fee is an extra platform-fee percentage locked onto on-behalf campaigns at creation (default 0), so no new payment flow is needed.

Out of scope for v1 (documented, not silently dropped): media in thank-you emails (the email stack is plain text), auto-posting the thank-you as a public update, billing-period quotas, and on-behalf creation from the mobile app (mobile gets the thank-you composer and read-only on-behalf status; creation stays on the web).

## 3. Data model (all additive)

- `campaigns`: `creationMode` (`self`/`on_behalf`), `creatorType`, `createdByActorId`, and `onBehalf { beneficiaryType, beneficiaryName, relationship, reason, beneficiaryUserId, consentStatus, consentVersion, consentAt, consentBy, payoutArrangement, payoutAuthorityUserId, publicationRequiresConsent, donationsRequireConsent, staffReviewRequired, autoPublishOnConsent, entitlementPlanTier, feePercentApplied }`.
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
