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

- [ ] **G1 — Beneficiary-payout admin operability.** Global admin endpoints
  (`GET /beneficiary-payouts`, `/beneficiary-payouts/review-queue`) + wire a
  "Beneficiary payouts" section into the admin Payouts page (list, KYC-verify,
  approve). No money-logic change — list + reuse existing approve/verify.
- [ ] **G2 — Reconciliation completeness.** Extend `ReconcilePayoutsUseCase` to
  the affiliate rail; add batched-payout per-leg reconciliation (verify each
  leg's transfer, drive per-leg settlement).
- [ ] **G3 — Compliance-limit admin control.** UI to set/clear a user's
  `complianceApprovedCampaignLimit` (with reason → audit) from the console
  (UserDetailPage or a compliance view).
- [ ] **G4 — Split-proceeds admin views.** Per-campaign: the active split +
  versions, per-beneficiary balances/statements (read-only), wired to the API.
- [ ] **G5 — Idempotent payout settlement (durability).** Make the balance
  effect idempotent per-payout/-leg (guard set on the balance doc) so the
  settlement effect can be safely re-applied by reconciliation and a crash
  between the state transition and the balance write is fully repairable. Closes
  the review's crash-window finding without requiring transactions. **Money-
  critical — adversarial review before commit.**
- [ ] **G6 — Versioned commercial-config store (ADR-5 mechanism).** Only if it
  can be built usefully without the §6 value sign-off; else leave for the user.

## Terminal step (ONCE, after all gaps are done or only gated items remain)

Per the user's instruction: when the loop is finished — final commit + push to
main, STOP the scheduled loop, then **clean up after myself**: kill any lingering
background processes/tasks this effort started, and stop + remove the test-mongod
docker container (`docker rm -f uf-test-mongo`). Do NOT stop the container between
sessions — the test gate needs it; only at the very end.

## Done

- (none yet — this loop just started 2026-09-07)

## Hard gates (NOT to be done autonomously — need the user / an external party)

- Flip `SPLIT_PROCEEDS_ENABLED` on — Ghana legal review of the split economic
  model (§6).
- Config VALUE sign-offs (fees/limits/reserves) — §6.
- BoG/PSP custody; Paystack registered-business + higher transfer limit.
- MongoDB replica-set / transactions infra decision (deep durability beyond G5).
