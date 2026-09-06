# Diaspora & Multi-Rail Payments — Phase 0: Audit, ADR & Plan

Engineering response to `Ujimora_Diaspora_Payments_AI_Implementation_Spec.docx`
(6 Sep 2026). This is the spec-mandated Phase 0 deliverable (spec §4, §24.2):
a repository audit, architecture decisions, migration strategy, and a phased
plan referencing exact files — produced **before** touching money code.

**Governing principle (spec §1, §26):** extend the working system, do not
rewrite it; preserve Ghana MoMo; never trust the client; every cedi traceable
provider → attempt → contribution → ledger → balance. Payment convenience must
not weaken financial correctness.

---

## 1. Repository audit (spec §4)

The API is Express + Mongoose, hexagonal (domain / application / infrastructure,
ports & adapters). The payment subsystem is already substantial:

| Spec concept | Exists today? | Where |
|---|---|---|
| Payment provider abstraction | ✅ Partial | `domain/ports/outbound/PaymentGatewayPort.ts` (Paystack-shaped; single gateway) |
| Provider registry + enable flags | ✅ | `PaymentProviderRepositoryPort` + `PaymentProviderEntity` |
| Contribution + PaymentAttempt | ✅ (merged) | `DonationIntent` entity (amount, currency, provider, providerRef, idempotencyKey, status) + `PaymentAttemptRepositoryPort` |
| Payment state machine | ✅ Partial | `DonationIntent.ALLOWED_TRANSITIONS`: CREATED→PENDING→SUCCEEDED/FAILED/EXPIRED |
| Verified webhook + idempotency | ✅ | `HandlePaystackWebhookUseCase` (HMAC-SHA512, raw body), unique providerRef/idempotencyKey, exactly-once gates |
| Immutable ledger + projection | ✅ | `LedgerRepositoryPort`, `PostDonationJournalUseCase`, `CampaignLedgerProjector`, outbox (`OutboxRepositoryPort`/dispatcher) |
| Fee policy | ✅ | `application/services/FeePolicy.ts` |
| Payouts (transfers) | ✅ | gateway transfers + `HandlePayoutWebhookUseCase` + affiliate payouts |
| Config/secrets | ✅ Partial | `infrastructure/config/index.ts` (Paystack keys only) |
| Payment tests | ✅ | vitest unit + integration (donations, payouts, subscriptions, webhooks) |

### Gaps vs. target architecture

1. **Money model** — `domain/value-objects/Money.ts` stores `amount: number`
   rounded to 2dp (a **float in major units**), single implicit currency (GHS).
   Spec §8 mandates **integer minor units** (or a decimal type) and multi-currency
   `original_*` + `settlement_*` + `fx_*`. This is the largest foundational gap
   and touches the whole donation/ledger/payout path.
2. **Currency assumptions** — `'GHS'` hard-coded in ~22 files (display + logic).
3. **Single provider** — only `PaystackGateway`; no Flutterwave; no `capabilities()`
   on the port; no capability/currency/country routing engine.
4. **State machine** — missing REQUIRES_ACTION, PROCESSING, REFUND_PENDING,
   REFUNDED, PARTIALLY_REFUNDED, DISPUTED, CHARGEBACK, CANCELLED (spec §9).
5. **Refunds / disputes / chargebacks** — no refund/dispute records or
   compensating-entry flow (spec §14). (`refundPayment` not on the port.)
6. **Reconciliation** — none (spec §13).
7. **Feature flags / config** — no `PAYMENTS_*`, `FLUTTERWAVE_*`, or FX config
   (spec §16).
8. **International cards / multi-currency checkout** — not implemented (spec §11).

---

## 2. Architecture decisions (ADRs)

**ADR-1 — Extend `PaymentGatewayPort` into the spec's `PaymentProvider`, keep one
adapter per provider.** Add `capabilities()`, `refundPayment()`,
`getTransaction()`, and a normalized `parseAndVerifyWebhook()` returning a domain
event. Do NOT break the existing methods (Paystack MoMo path depends on them).
Introduce a `PaymentProviderRegistry`/router that selects an adapter from the
`PaymentProviderEntity` registry + `capabilities()` + routing rules (spec §7).

**ADR-2 — Money migration: additive, minor-units alongside, then cut over.**
Rather than a risky in-place float→int rewrite, add **new minor-unit +
multi-currency fields** to the contribution model (`originalAmountMinor`,
`originalCurrency`, `settlementAmountMinor`, `settlementCurrency`, `fxRate`,
`fxSource`, `providerFeeMinor`, `platformFeeMinor`, `netCampaignAmountMinor`)
and a `Money` minor-unit constructor, **without deleting** the existing `amount`
field. Backfill `*_minor` from existing GHS floats (× 100) where historically
valid (spec §21). New code reads minor units; legacy reads keep working; remove
floats only after everything reads minor units. **This is the highest-risk slice
and needs its own PR + full test pass + sign-off before it touches the live path.**

**ADR-3 — `DonationIntent` is the Contribution; add a distinct `PaymentAttempt`
row per provider session.** Today one intent ≈ one attempt. To support
fallback-as-new-session (spec §7) without double-charging, persist each provider
session as a `PaymentAttempt` linked to the contribution, and derive contribution
status from attempts + verified events. Keep the `DonationIntent` name
(migration-safe); add an alias/type `Contribution` at the domain boundary.

**ADR-4 — Everything behind flags (spec §16), default off.** MoMo stays on the
existing path; new rails/currencies are dark until explicitly enabled, so any
phase is independently reversible (spec §23 DoD).

---

## 3. Migration strategy (spec §21)

- Backward-compatible, reversible Mongoose migrations; never drop existing
  transaction references.
- Backfill `provider='paystack'`, `originalCurrency='GHS'`, `*_minor = round(float×100)`
  only where historically valid.
- Deploy schema + read-compatibility first; enable orchestration for a small
  controlled path; enable int'l cards only after merchant/provider approval;
  enable Flutterwave behind its flag after independent sandbox testing.

---

## 4. Phased plan (exact files)

### Phase 1 — Foundation (code-only, additive, testable) ← proposed to start now
- `infrastructure/config/index.ts` + `apps/api/.env.example`: add `PAYMENTS_*`,
  `FLUTTERWAVE_*`, FX config (all default off/empty).
- `domain/ports/outbound/PaymentGatewayPort.ts`: add `capabilities()` returning
  supported countries/currencies/methods; implement in `PaystackGateway`.
- `domain/value-objects/Money.ts`: add minor-unit constructor + `toMinor()`/`fromMinor()`
  helpers (additive; no behavior change to existing callers).
- New `application/services/PaymentRouter.ts`: pick provider from registry +
  capabilities + routing rules (spec §7); Paystack-only until Flutterwave lands.
- Tests: routing rules, capability matching, money precision (spec §20).

### Phase 2 — Paystack diaspora (needs merchant eligibility — spec §17)
- Multi-currency + minor-unit fields on the contribution model (ADR-2 migration).
- `POST /contributions` currency/country-aware; int'l card checkout; estimated-FX
  presentation (spec §11); verified-success only (no redirect trust).
- Extend state machine (REQUIRES_ACTION/PROCESSING).

### Phase 3 — Flutterwave (needs FLW account + sandbox creds)
- `infrastructure/adapters/outbound/payments/FlutterwaveGateway.ts` implementing
  the extended port + its webhook (`POST /webhooks/flutterwave`), verified per
  FLW's current docs; wire into the router + provider registry.

### Phase 4 — Operations
- Reconciliation job (spec §13), refund/dispute/chargeback states + compensating
  ledger entries (spec §14), admin views (spec §15), metrics/alerts (spec §19).

### Phase 5 — Expansion
- More currencies/methods/providers, smart routing, recurring, matching (spec §25).

---

## 5. External dependencies / risk gates (cannot be completed by the agent alone)

- **Merchant eligibility** for international cards — product owner must confirm
  with Paystack (spec §17). Int'l cards stay flag-off until then.
- **Flutterwave account + sandbox/live API keys + webhook hash** — required to
  build & test the adapter (spec §16). No credentials are in the repo.
- **Accounting/legal review** of ledger treatment and KYC/KYB/AML (spec §10, §17).
- **The money-model migration (ADR-2)** touches the live, in-production payment
  path and needs explicit sign-off + a full test pass before rollout.

---

_Status: Phase 0 complete. Phase 1 is code-only and safe to start immediately;
Phases 2–3 are gated on the external items above._
