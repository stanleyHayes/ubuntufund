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
- [~] **G5 — Idempotent payout settlement (durability). DEFERRED to a supervised
  change (not done autonomously — too risky).** Investigation showed the full,
  correct fix needs THREE coupled changes to money-critical cores: (1) a
  `settledRefs` guard on all three balance models (campaign/beneficiary/affiliate)
  + markPaidOut/returnToAvailable/reverseFromPaidOut signature changes + every
  caller; (2) **payout-journal idempotency in the immutable ledger** — `postEntry`
  currently dedupes ONLY on `donationIntentId`, so payout disbursement/reversal
  journals would double-post if re-run; this needs a new payout-ref dedup key +
  unique index + extended postEntry logic; (3) restructuring all four payout
  webhook handlers to gate the money effect on `settledRefs` instead of the state
  transition (so reconciliation can repair a PAID-but-unsettled payout). The
  window it closes is a crash in the sub-millisecond gap between the atomic state
  transition and the balance $inc — extremely rare, and a read-model discrepancy
  (paidOut bucket short) rather than real money loss (the transfer genuinely
  settles at the provider). Verdict: an unsupervised change to settlement + the
  immutable ledger carries double-credit/double-journal risk that outweighs the
  benefit. The proper fix is MongoDB transactions (a production replica set) OR
  the ledger-dedup + settledRefs work above, done under review. **Left for the
  user / a supervised session.**
- [~] **G6 — Versioned commercial-config store (ADR-5 mechanism). GATED — left
  for the user.** The two behaviourally-valuable pieces of ADR-5 are already
  shipped: the config **value-diff audit** (Phase 5) and **fee grandfathering**
  (a campaign locks its plan fee % at creation). A full effective-dated config
  store *replacing* the env/DB config is only useful once the sensitive VALUES
  (fees/limits/reserves/tier thresholds) are signed off (§6); building a large
  parallel config subsystem speculatively, with no approved values to serve, is
  over-engineering. Per the loop rule, left for the user.

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
- **G5** (2026-09-07) — DEFERRED (too risky unsupervised — see above).
- **G6** (2026-09-07) — GATED on §6 value sign-off — left for the user.

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
