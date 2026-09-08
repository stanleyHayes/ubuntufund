# Autonomous completion backlog — Large-Campaign gaps

Self-driven loop (user asleep). Each session: read this file, do the top OPEN
gap, gate (lint + full suite green), commit + push, mark it done, schedule the
next. Money-logic changes get an adversarial review before commit. **Never** flip
`SPLIT_PROCEEDS_ENABLED`, invent make-work, or attempt legal/external gates. When
only gated items remain, STOP the loop and summarize.

Rules of engagement carried across sessions:
- Branch `agent/production-completion` (= main). Commit `--no-gpg-sign`, end
  messages with the Co-Authored-By trailer. Push `origin agent/production-completion:main`.
- `export PATH="/opt/homebrew/bin:$PATH"`; `npx tsc`/`npx vitest`. Test mongod on
  127.0.0.1:28017. Full suite gate before every commit.
- Secret gate before every commit.

## Gaps (ordered)

- [x] **G1 — Beneficiary-payout admin operability.** DONE. Global admin
  endpoints `GET /beneficiary-payouts` + `/beneficiary-payouts/review-queue`
  (findAll/findByStatuses + use-case listAll/reviewQueue, admin-gated) + a
  "Beneficiary" view on the admin Payouts page (list, Verify KYC, Approve).
- [x] **G2 — Reconciliation completeness.** DONE. `ReconcilePayoutsUseCase` now
  also reconciles the affiliate rail (`findStuckProcessing`) and batched campaign
  payouts per-leg (`findStuckBatchedProcessing` → each queued/submitted leg
  re-verified + driven through the leg-aware webhook handler).
- [x] **G3 — Compliance-limit admin control.** DONE. A Compliance-limit control
  on the admin UserDetailPage (set amount/"unlimited"/clear + reason) → PUT
  /users/:id/compliance-limit (audited). Surfaced the field on the admin user
  record + shared User type. Fixed a real bug: clearing never persisted because
  Mongoose ignores `undefined` on $set — now `$unset`.
- [x] **G4 — Split-proceeds admin views.** DONE. A read-only Split-proceeds
  section on the admin CampaignDetailPage (SplitProceedsSection component):
  active split beneficiaries + shares + consent, per-beneficiary balances, and
  version history — wired to GET /campaigns/:id/split, /split/versions,
  /split/beneficiaries. Graceful "no split configured" for ordinary campaigns.
- [x] **G5 — Idempotent payout settlement (durability). DONE (supervised, 2026-09-08).**
  Built under supervision + two adversarial reviews. Delivered: (1) a `settledRefs`
  guard on all three balance models (campaign/beneficiary/affiliate) — markPaidOut/
  returnToAvailable/reverseFromPaidOut apply at most once per settleRef via an
  atomic `{settledRefs:$ne}` filter + `$addToSet`; (2) payout-journal idempotency —
  `postEntry` now dedupes on `externalRef` (unique+sparse) in addition to
  `donationIntentId`, so a re-run disbursement/reversal journal never double-posts;
  (3) a `settlementApplied` flag + `findTerminalUnsettled` index + status-aware
  `repairSettlement` so reconciliation repairs a **PAID or FAILED**-but-unsettled
  payout (crash between the atomic transition and the balance/ledger write) on the
  campaign, beneficiary AND affiliate rails; (4) `repairBatched` — re-applies each
  terminal leg's idempotent effect and finalizes a batch stuck in PROCESSING. The
  webhook handlers KEEP their transition gate (unchanged behaviour) and additionally
  pass settleRefs; the repair path is separate and idempotent, so a real settlement
  is always a no-op. **Migration-safe by construction:** `findTerminalUnsettled`
  matches `settlementApplied: false` (not `$ne: true`), so legacy payouts predating
  the field (absent) are never re-applied — no backfill needed. Adversarial review
  #1 (double-apply/bucket/batched) found the double-apply guarantee sound and
  surfaced the under-apply crash windows; this pass closed the campaign/beneficiary/
  affiliate PAID+FAILED windows and the batched-leg window. See **G7** for the
  reversal-specific edges intentionally deferred. Tests: `payoutIdempotency.integration`
  (4) + `payoutRepairExtensions.integration` (4, incl. the legacy-safety assertion).
- [x] **G6 — Versioned commercial-config store (ADR-5). DONE (2026-09-08, §6
  cleared).** The value-diff audit + fee grandfathering were already shipped; this
  adds the effective-dated store itself. `CommercialConfig` rows are versioned per
  key with an `effectiveFrom`, so a change can be scheduled and history preserved
  (the store IS the audit trail). `CommercialConfigService.resolvePayoutsConfig()`
  layers the currently-effective overrides over the env defaults (cached, TTL 30s,
  invalidated on write) — so behaviour is IDENTICAL until an admin sets a value.
  Wired into RequestPayoutUseCase's fee/reserve reads via an OPTIONAL service param
  (env fallback when absent → no behaviour change, backward-compatible for tests).
  Admin CRUD: GET /admin/commercial-config (resolved + defaults + keys),
  GET /admin/commercial-config/:key/history, PUT /admin/commercial-config/:key
  (value + optional effectiveFrom + reason). Tests: commercialConfig.integration
  (defaults→override→history, future-dated not-yet-effective, unknown-key 400,
  non-admin 403). Follow-up: onboard more commercial keys (plan limits, tier
  thresholds) through the service as needed.
- [x] **G7 — Reversal-crash settlement durability. DONE (supervised, 2026-09-08).**
  Built + two adversarial reviews (the second caught, and this pass fixed, four
  real defects in the first cut). REVERSED payouts are now repairable:
  - **Per-effect disambiguation:** the reversal transitions record `reversedFrom`
    ('PAID' | 'PROCESSING') and RESET `settlementApplied=false`, so the reconciler
    knows which reverse effect a crashed REVERSED payout still owes (return vs.
    reverse-from-paidOut). `findTerminalUnsettled` now covers PAID/FAILED/REVERSED,
    but REVERSED **only when `reversedFrom` exists** — a pre-G7 REVERSED payout is
    excluded (no endless re-scan).
  - **Status-guarded settlement flag:** `markSettlementApplied(id, expectedStatus)`
    is a compare-and-set on status (`updateOne({_id,status})`). Fixes a lost-update
    where a stale forward repair could clobber the `false` a concurrent reversal
    set, silently dropping the reverse effect forever.
  - **No forward re-drive:** the first cut re-drove the forward disbursement before
    reversing (to prevent negative paidOut). Review showed that double-credits a
    **legacy** payout whose original forward never recorded a `:paid` settleRef, so
    it was removed. The reverse repair is now just the idempotent reverse effect
    (`reverseFromPaidOut` :reversed + journal / `returnToAvailable` :returned),
    legacy-safe on all three rails + the beneficiary campaign mirror.
  - Tests: `payoutRepairExtensions.integration` (12) incl. REVERSED PAID/PROCESSING
    per rail, the legacy-REVERSED finder exclusion, and idempotency.
  **Remaining documented edges (rare, read-model only, not money loss):**
  - Forward-crash-then-reverse race (forward `markPaidOut` crashed, then a reversal
    arrives before the forward repair): `reverseFromPaidOut` drives `paidOut`
    negative by net. Rare (crash + race); the re-drive that would fix it is unsafe
    for legacy, so it is left as a documented read-model anomaly (available stays
    correct; a floor guard would mask the divergence).
  - Pre-existing `onLegReversed` batched reversal-crash (same class; NEEDS_REVIEW
    for a human — repairBatched deliberately doesn't touch reversed legs).
  - Transient deploy caveat: exact-`false` `settlementApplied` excludes pre-field
    payouts (prevents the catastrophic legacy double-apply, trades only a benign
    transient under-apply — a one-time backfill closes it if desired).

## Terminal step (ONCE, after all gaps are done or only gated items remain)

Per the user's instruction: when the loop is finished — final commit + push to
main, STOP the scheduled loop, then **clean up after myself**: kill any lingering
background processes/tasks this effort started, and stop + remove the test-mongod
docker container (`docker rm -f uf-test-mongo`). Do NOT stop the container between
sessions — the test gate needs it; only at the very end.

## Done

- **G1** (2026-09-07) — beneficiary-payout admin operability.
- **G2** (2026-09-07) — reconciliation completeness (affiliate + batched legs).
- **G3** (2026-09-07) — compliance-limit admin control (+ clear-persistence fix).
- **G4** (2026-09-07) — split-proceeds admin views (read-only).
- **G5** (2026-09-08) — DONE (supervised): idempotent settlement + reconciliation
  repair across campaign/beneficiary/affiliate + batched legs; migration-safe.
- **G6** (2026-09-08) — DONE (§6 cleared): versioned effective-dated commercial-
  config store + service (env-fallback overlay) + admin CRUD, wired into payout fees.
- **G7** (2026-09-08) — DONE (supervised): REVERSED-crash repair via reversedFrom
  + status-guarded settlement flag; legacy-safe (no forward re-drive); two reviews.

## Loop concluded 2026-09-07

All autonomously-buildable gaps (G1–G4) are shipped, tested and pushed to main.
G5 (idempotent settlement) is deferred to a supervised change and G6 (versioned
config store) is gated on §6 — only those two remain, both requiring a user
decision / supervised work, so the loop stops here per its own rules. Terminal
cleanup (kill background tasks + `docker rm -f uf-test-mongo`) done at stop.

## Hard gates (NOT to be done autonomously — need the user / an external party)

- Flip `SPLIT_PROCEEDS_ENABLED` on — Ghana legal review of the split economic
  model (§6).
- Config VALUE sign-offs (fees/limits/reserves) — §6.
- BoG/PSP custody; Paystack registered-business + higher transfer limit.
- MongoDB replica-set / transactions infra decision (deep durability beyond G5).
