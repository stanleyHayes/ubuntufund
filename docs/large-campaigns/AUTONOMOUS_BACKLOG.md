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
- [~] **G6 — Versioned commercial-config store (ADR-5 mechanism). GATED — left
  for the user.** The two behaviourally-valuable pieces of ADR-5 are already
  shipped: the config **value-diff audit** (Phase 5) and **fee grandfathering**
  (a campaign locks its plan fee % at creation). A full effective-dated config
  store *replacing* the env/DB config is only useful once the sensitive VALUES
  (fees/limits/reserves/tier thresholds) are signed off (§6); building a large
  parallel config subsystem speculatively, with no approved values to serve, is
  over-engineering. Per the loop rule, left for the user.
- [ ] **G7 — Reversal-crash settlement durability (the residual G5 edges).** The
  G5 repair intentionally covers PAID + FAILED but NOT REVERSED, because an
  unsettled REVERSED payout cannot be told apart from a **PAID-then-reversed
  crash** using the single `settlementApplied` flag: replaying the return vs. the
  reversal risks a double-credit. Closing this correctly needs per-effect tracking
  (e.g. record WHICH effect key a terminal payout owes, or store the pre-reversal
  status) rather than one boolean. Bundled here (all same root — reverse effect on
  a half-applied forward):
  - REVERSED-but-unsettled repair (single-transfer + beneficiary mirror + affiliate).
  - `reverseFromPaidOut` has no `paidOutBalance >= amount` floor guard, so an
    out-of-order reversal that outruns a crashed forward `markPaidOut` can drive
    `paidOutBalance`/`payoutFees` negative (campaign + beneficiary balances). A
    floor guard alone would mask the divergence, so it must land WITH the
    per-effect repair, not before it.
  - Beneficiary reverse-effect mirror atomicity (a crash between the beneficiary
    and campaign reverse writes) — reconverged once the REVERSED repair re-drives
    both buckets idempotently.
  - Pre-existing `onLegReversed` reversal-crash: a batched leg reversed after its
    forward `:paid` credit was stranded drives `paidOutBalance` negative (same
    root; repairBatched deliberately does NOT re-drive reversed legs to avoid
    adding a second instance — they go to NEEDS_REVIEW for a human).
  - **Transient deploy caveat (review-confirmed, benign):** `findTerminalUnsettled`
    matches exact `settlementApplied: false`, which excludes payouts that predate
    the field (absent). A payout created before G5 deploy, still PROCESSING at
    deploy, that then crashes in the sub-ms settlement window after deploy would
    have the field absent and be missed by the repair (an under-credited bucket,
    recoverable via admin reconciliation). This cohort is finite and drains as the
    pre-field payouts reach terminal states — a one-time backfill (`settlementApplied`
    true on existing-terminal, false on existing-non-terminal payouts, mirroring
    `backfillContributionMoney`) closes it if desired. The exact-`false` predicate
    is kept deliberately: it prevents the *catastrophic* legacy double-apply, and
    trades it only for this benign transient under-apply.
  Low probability (a crash in the ms between an atomic transition and the balance
  write, specifically on a reversal). Not money loss at the provider — a read-model
  divergence. Deferred as a focused, separately-reviewed pass.

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
- **G6** (2026-09-07) — GATED on §6 value sign-off — left for the user.
- **G7** (2026-09-08) — OPEN: reversal-crash durability edges deferred from G5.

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
