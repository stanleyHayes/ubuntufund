# Large-Campaign Payments, Compliance & Payout — Phase 0: Audit, ADRs & Plan

Engineering response to `Ujimora_Large_Campaign_Paystack_Plan_v6.docx` (7 Sep 2026).
This is the Phase 0 deliverable: a repository audit, architecture decisions, and a
phased plan referencing exact files — produced **before** touching money code, so
the GHS 5M+ campaign story is built additively on the working Ghana MoMo/Paystack
system rather than by rewriting it.

**Governing principles (from the plan doc):**

1. **Paystack is the rail; Ujimora is authoritative.** A campaign target is an
   application value accumulated from many independently verified contributions —
   never one provider payment. Ujimora owns the campaign, contribution, ledger,
   compliance and payout state.
2. **The ledger is the source of truth, not a mutable balance column.** A cached
   aggregate may exist for performance but must be reproducible from
   contribution/ledger records. (Already true — see the audit.)
3. **Commercial & risk limits are admin-configurable, versioned data — not
   hard-coded constants.** Prices, fee %s, campaign ceilings, tier thresholds,
   reserves and payout rules must be changeable without a deploy, with audit +
   effective dates + grandfathering.
4. **Entitlement and compliance are separate controls.**
   `effective_campaign_limit = MIN(subscription_plan_limit, compliance_approved_limit)`.
   Paying for a higher plan never bypasses KYC/KYB, campaign review or payout
   approval.
5. **Custody is a regulated activity.** The 3-business-day payout window is not an
   unrestricted right to hold funds; the real custody/settlement/reserve flow must
   match the Bank of Ghana / partner-bank / PSP structure Ujimora operates under.
   This is an **external gate**, not an engineering task.

---

## Phase 1 — Commercial foundation (delivered 2026-09-07)

The subscription/commercial layer is now the **v6 model**, and — per the product
owner's direction — plans are **fully admin-managed**, not hard-coded:

- **v6 plan set** seeded: Community / Plus / Pro / Organization / Enterprise in
  **GHS** (0 / 49 / 149 / 399 / 1,500+), fees 3.5 / 3.0 / 2.5 / 2.0 / 1.25%, goal
  caps 10k / 50k / 250k / 1M / unlimited, active-campaign counts 1 / 3 / 10 / 25 /
  unlimited. The existing tier enum values are unchanged (`free`→Community,
  `starter`→Plus), so **no subscriber migration** is needed.
- **Tiers are admin-managed + API-driven.** `tier` is now a free-form string (the
  DB models no longer enum-constrain it), so admins can **add new tiers** from the
  dashboard. New plan attributes: `sortOrder`, `active`, `isPublic`, `accentColor`,
  `popular`. New `POST /plans` (create) alongside `PUT /plans/:tier`; `PlanService`
  returns all DB plans (admin-added included) ordered by `sortOrder`. The
  `SUBSCRIPTION_PLANS` constant is now only the **seed + offline fallback**.
- **Every surface renders plans dynamically** from the API/seed sorted by
  `sortOrder`, coloured by `accentColor` — marketing pricing, web subscription,
  admin (create dialog + editor), and mobile — with no hardcoded per-tier maps.
- This **supersedes ADR-1's** "keep the enum as authority" stance: the enum is now
  just the seed identity; the DB is authoritative and extensible.

## Phase 2 — Compliance & review workflow (delivered 2026-09-07)

Extends the EXISTING review workflow (campaigns already default to
`pending_review`; `ReviewCampaignUseCase` approves/blocks; mutations are
auto-audited) with risk tiering and the compliance limit gate:

- **Campaign tier 1–5** derived from the goal against admin-configurable
  thresholds (`CAMPAIGN_TIER_THRESHOLDS`, default GHS 10k/50k/250k/1M) and stored
  on the campaign (stable, indexed, surfaced in read DTOs). `deriveCampaignTier`
  is a pure domain function.
- **Tier-based auto-approval:** tiers ≤ `CAMPAIGN_AUTO_APPROVE_MAX_TIER` (default
  2) go live immediately (ACTIVE); higher tiers are held in PENDING_REVIEW for
  manual compliance review. Without the config, every campaign is reviewed
  (legacy-safe).
- **Compliance publish gate:** `User.complianceApprovedCampaignLimit` +
  `PlanLimitsService` now enforce the effective goal cap =
  `MIN(plan cap, compliance cap)` (spec §18); compliance can only tighten, never
  lift, the plan cap. New admin endpoint `PUT /users/:id/compliance-limit`
  (auto-audited).

Tests: tier derivation + review thresholds; the MIN(plan, compliance) gate;
tier-based create status (auto-approve vs review). Full API suite green.

Still open (later phases): maker-checker two-person approval for very high-value
actions; per-tier KYC document requirements; the admin review-queue/compliance UI
(Phase 5).

## 1. Repository audit — what already exists

The API is Express + Mongoose, hexagonal (domain / application / infrastructure,
ports & adapters). The diaspora-payments work (see `docs/payments/`) already
delivered a substantial, hardened payment core that this plan builds on.

| Plan concept | Exists today? | Where |
|---|---|---|
| Provider abstraction + Paystack rail | ✅ | `PaymentGatewayPort` + `PaystackGateway` (+ Flutterwave) |
| Verified webhook + idempotency | ✅ | `HandlePaystackWebhookUseCase` (HMAC-SHA512, raw body, exactly-once gates) |
| Immutable double-entry ledger + projection | ✅ | `LedgerRepositoryPort`, `PostDonationJournalUseCase`, `CampaignLedgerProjector`, balanced `JournalEntryEntity` |
| Contribution model (minor units, multi-currency) | ✅ | `DonationIntent` (+ minor-unit/settlement/fx fields), `Money` value object |
| Reconciliation (scheduled + admin) | ✅ | `ReconcilePaymentsUseCase` + `/admin/reconciliation` |
| Refunds + compensating ledger | ✅ | `ProcessRefundUseCase` (atomic claim, cumulative cap) + `forDonationRefund` |
| Fee policy (plan-based platform fee) | ✅ | `FeePolicy`, `PlanLimitsService.platformFeePercentForCampaign` |
| Campaign balance buckets | ✅ | `CampaignBalance` (pending / available / paid-out + fee accumulators) |
| Subscriptions (DB-backed, admin-editable plans) | ✅ Partial | `SubscriptionPlanModel`, `PlanService`, `PlanLimitsService`, `UpdatePlanUseCase`, `ListPlansUseCase` |
| Active-campaign + goal-cap entitlement guard | ✅ Partial | `PlanLimitsService.assertCanCreateCampaign` (count + goal caps) |
| Payout request → admin approval → transfer | ✅ Partial | `RequestPayoutUseCase`, `ApprovePayoutUseCase`, `HandlePayoutWebhookUseCase`, transfer recipients |
| KYC / organization records | ✅ Partial | `KYCVerificationModel`, `OrganizationModel`, `kycRoutes` |
| Admin payment search / trace | ✅ | `/admin/payments*` |

## 2. Gap analysis — what the v6 plan adds

| # | Gap | Current state | Target (v6) |
|---|---|---|---|
| G1 | **Subscription plan set & pricing** | 4 tiers `FREE/STARTER/PRO/ENTERPRISE`, priced in **USD** ($9.99–$99.99), fees 3.5/2/1%, goals 25k/100k/∞ | 5 tiers **Community/Plus/Pro/Organization/Enterprise**, **GHS** 0/49/149/399/1,500+, fees 3.5/3.0/2.5/2.0/1.0–1.5%, goals 10k/50k/250k/1M/5M+, active 1/3/10/25/∞ |
| G2 | **Campaign tiers (1–5)** | none | Tier by target range → per-tier KYC/KYB, approval posture, payout posture (all admin-configurable) |
| G3 | **Entitlement + compliance publish gate** | goal-cap + active-count only | `publish_allowed = sub_active AND active<limit AND target<=plan_limit AND target<=compliance_approved_limit AND review=APPROVED`; `effective_limit = MIN(plan, compliance)` |
| G4 | **Compliance review workflow** | none | Campaign review status, compliance-approved limit per account, review queue, maker-checker, per-tier document requirements |
| G5 | **Payout orchestration for large campaigns** | single transfer, admin approve | Freeze payable → immutable batch → split into ≤ GHS 50k transfers → per-transfer state machine (queued/submitted/success/failed/reversed/needs-review) → reconcile all before "complete" → maker-checker → milestone/staged |
| G6 | **Early / priority / assisted payout** | standard only | Priority 0.5% (min 10), early 1.0% (min 20), urgent 1.5% (min 30), assisted 1.5%+GHS 50; 80% early ceiling / 20% reserve; all configurable |
| G7 | **Split-proceeds multi-beneficiary** | `beneficiaries: string[]` (names only) | Percentage allocations totalling 100%, immutable `CampaignSplitVersion` + per-beneficiary ledger buckets, consent, lock-on-first-contribution, deterministic rounding, per-beneficiary statements & payouts |
| G8 | **Admin-configurable versioned commercial/risk config** | plans are DB-editable | Versioning + effective dates + maker-checker on sensitive changes + grandfathering + immutable config audit log; fee/payout/reserve/tier config |
| G9 | **Funding model (all-or-nothing vs keep-what-you-raise)** | keep-what-you-raise implied | Per-campaign disclosed funding model + automatic refunds when an all-or-nothing target is missed |
| G10 | **Risk controls** | basic | Velocity/anomaly rules, duplicate identity/device detection, cooling periods, review triggers |

## 3. Architecture decisions (ADRs)

**ADR-1 — Align the plan set to v6 additively; keep the DB as the source of
truth.** Extend `SubscriptionTier` to the five v6 tiers (rename semantics:
`FREE→community`, `STARTER→plus`, add `organization`; keep `pro`, `enterprise`),
reprice the code-defined `SUBSCRIPTION_PLANS` defaults in **GHS**, and treat the
existing `SubscriptionPlanModel` (DB) as authoritative so admins can re-tune
without a deploy. **Grandfathering:** existing subscribers keep their current
entitlement until renewal; a migration maps old tiers → new tiers. This is the
highest-risk slice for existing customers and needs product sign-off on the exact
mapping + a data migration + tests before it ships.

**ADR-2 — Campaign tier is a derived-then-stored attribute.** Compute the tier
from the target against admin-configured thresholds at publish time, store it on
the campaign (so historical tiering is stable), and drive KYC/approval/payout
posture from the tier's config. Never hard-code the thresholds.

**ADR-3 — Split-proceeds as immutable versions + per-beneficiary ledger buckets.**
A `CampaignSplitVersion` (immutable) holds `CampaignBeneficiaryAllocation` rows
(percentage in fixed precision, never float). Beneficiary accruals are ledger
entries against per-`(campaign,beneficiary)` buckets (available/reserved/paid/
blocked). Lock the split on the first successful contribution; amendments create a
new version applied only prospectively. Deterministic largest-remainder rounding
in minor units so allocations always reconcile to the distributable total. This
reuses the existing minor-unit `Money` + double-entry ledger.

**ADR-4 — Payout orchestration: freeze, batch, split, reconcile.** On approval,
freeze the payable amount into an immutable payout batch; split into
provider-compliant transfer instructions (≤ GHS 50k each) with unique idempotency
keys; track each transfer through a state machine; never mark the batch complete
until every transfer reconciles. Early/priority/assisted payouts are fee-bearing
**request types** against a beneficiary's cleared, eligible share, honoring the
configurable reserve. Maker-checker (two-person) approval above configured
thresholds. Extends the existing `RequestPayoutUseCase`/`ApprovePayoutUseCase`.

**ADR-5 — Commercial/risk config is versioned data with effective dates.** A
config-version record captures every sensitive value (plan pricing, fees, tier
thresholds, payout fees, reserves, limits) with `effectiveFrom`, an immutable
audit row (admin, old→new, timestamp, reason), maker-checker for sensitive keys,
and grandfathering rules. A published campaign **locks** the fee schedule that
applied at publish time so mid-campaign changes never surprise organizers.

**ADR-6 — Everything additive, behind flags, preserving the working path.** The
current small-campaign GHS flow must keep passing its regression tests at every
step; new tiers/gates/payout types are dark until explicitly enabled.

## 4. Phased plan (exact files)

Ordering front-loads the highest-value, most self-contained slices and defers the
external-gated ones (payout limits, custody structure).

### Phase 1 — Commercial foundation (subscriptions, tiers, entitlement gate)
- `packages/types/src/subscription.ts`: 5 v6 tiers, **GHS** prices/fees/goals/active-counts.
- Migration: map existing subscribers old→new tier; grandfather until renewal.
- `application/services/PlanLimitsService.ts`: add the compliance-approved limit +
  review-status to the publish gate (`effective_limit = MIN(plan, compliance)`).
- Campaign `tier` (derived + stored) + `CampaignTierConfig` (admin-configurable
  thresholds); `CreateCampaignUseCase`/publish path consumes it.
- Tests: plan resolution, tier derivation, the full publish gate.

### Phase 2 — Compliance & review workflow (spec §8, §16)
- Campaign `reviewStatus` (DRAFT/PENDING_REVIEW/APPROVED/REJECTED) + review queue;
  compliance-approved limit per account/org; per-tier document requirements;
  maker-checker on high-value approvals; immutable compliance audit trail.

### Phase 3 — Payout engine (spec §7, §17)
- Payout `batch` + transfer state machine; split into ≤ GHS 50k transfers;
  early/priority/assisted request types + fees + reserve %; maker-checker
  thresholds; reconcile every transfer; milestone/staged release.

### Phase 4 — Split-proceeds multi-beneficiary (spec §17 split)
- `CampaignSplitVersion` + `CampaignBeneficiaryAllocation`; consent capture;
  lock-on-first-contribution; per-beneficiary ledger buckets + statements;
  deterministic rounding; per-beneficiary payouts; donor-facing disclosure.

### Phase 5 — High-value & admin config (spec §12, §16, §18)
- Tier 4/5 workflows; versioned admin config (effective dates, maker-checker,
  grandfathering, audit) for pricing/fees/tiers/payout/reserves; admin dashboards
  (risk/tier, contribution explorer, payout approval queue with split preview,
  reconciliation exceptions, metrics).

## 5. Decisions needed from product/legal (surfaced for sign-off)

These are business/compliance calls the plan doc leaves to Ujimora; the build
should not silently pick them:

- **D1 — v6 pricing is the launch tariff?** Confirm the exact GHS prices, fee %s,
  goal caps and active-campaign counts per tier before the migration.
- **D2 — Grandfathering.** Existing `STARTER/PRO/ENTERPRISE` subscribers → which
  new tier, and do they keep old pricing until renewal?
- **D3 — Default funding model** (keep-what-you-raise vs all-or-nothing) and
  whether all-or-nothing is offered at launch.
- **D4 — Reserve % and early-withdrawal ceiling** (defaults 20% / 80%).
- **D5 — KYC/KYB depth per tier** and who is the manual-review approver.

## 6. External gates (cannot be completed by the agent)

- **Bank of Ghana crowdfunding structure / PSP or partner-bank custody
  arrangement** — the actual hold/settlement/reserve/payout flow must match a
  regulated arrangement (plan §8, §17 custody note).
- **Paystack Registered Business** activation + a reviewed higher transfer-limit
  arrangement for very large disbursements (plan §13).
- **Ghana-qualified legal/compliance review** of custody, refunds, disbursement,
  AML/KYC and the split-proceeds economic-expectation model.
- **Real fee/limit sign-off** for every configurable commercial value.

---

_Status: Phase 0 complete. Phase 1 (commercial foundation) is code-only and safe
to start once D1–D2 are confirmed; Phases 3–5 are gated on the external items._
