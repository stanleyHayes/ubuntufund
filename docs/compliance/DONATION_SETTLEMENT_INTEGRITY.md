# Donation settlement integrity

## Transaction boundary — 2026-09-13

Source review found `SettleDonationUseCase` persisted SUCCEEDED before the donation, journal, campaign projection, beneficiary accrual and outbox. A later failure could leave a successful intent whose replay skipped incomplete accounting. The wallet caller could also compensate a thrown settlement error after campaign credit had already landed.

The production composition now requires `MongoUnitOfWork` for the shared settlement use case. Its success gate, donation record, journal, campaign/split projections and outbox enqueue commit together. Failed writes roll the gate back. Concurrent callbacks serialize at the intent write and replay a committed success without crediting again. Ledger account resolution now runs sequentially because operations sharing a transaction session must not run in parallel.

Outbox dispatch occurs after the transaction commits. An unexpected dispatcher failure is logged and the durable pending event is left for the existing sweeper; it does not throw back to the wallet compensation path. No payment-provider calls or message delivery run in the accounting transaction.

## Evidence

`donationSettlementAtomic.integration.test.ts` uses real MongoDB repositories and transactions. Five cases verify rollback after actual journal, projection and outbox writes, complete idempotent retries, concurrent callbacks, committed-state visibility to delivery, and retained pending outbox after delivery failure. Assertions include intent state, campaign raised amount, campaign balance buckets, donation count, journal count and outbox count.

The five new cases pass. Another 38 focused tests across wallet donation intents, split accrual, fee waivers, verification and attribution pass on the same implementation. API types, affected lint and whitespace checks pass. Logs: `/tmp/ujimora-donation-atomic-tests.log` (38 existing cases pass; initial new fixture omitted required startDate), `/tmp/ujimora-donation-atomic-regression.log` (all five corrected real-database fixtures pass), `/tmp/ujimora-donation-atomic-types.log`, `/tmp/ujimora-donation-atomic-lint.log`.

## Exact split version and consent — 2026-09-13

Accrual now consumes the version returned by the lock write, without a second active-version read. Every allocation must have accepted consent. The lock returns already-locked versions, preserves the first lock timestamp and increments a write counter to serialize with concurrent consent/amendment changes inside the donation settlement transaction. A consent failure rolls back the donation settlement and lock together.

Four new real-database cases verify declined consent with a successful retry after restoration, repeated contributions without a second version read, consent changed after the settlement snapshot, and activation of a new amendment during settlement. The latter two exercise transaction conflict/retry against independent writes. All 28 tests across atomic settlement, split activation, split accrual integration and SplitAccrualService pass; API types and affected lint pass. Logs: `/tmp/ujimora-split-consent-tests.log`, `/tmp/ujimora-split-consent-types.log`, `/tmp/ujimora-split-consent-lint.log`.

This verifies stored consent at accrual time; it does not establish the authenticity of beneficiary attestations or repair historic allocations. The ongoing full API regression uses the earlier de49df2 source and does not cover this delta.

## Remaining requirements

- Couple wallet debit, transaction history, intent and settlement across crashes and uncertain commit outcomes. Debit/compensation outside settlement is not made atomic by this change.
- Reconcile historical successful intents with missing or partial donation/journal/projection/outbox records; no historical repair or production fund mutation was performed here.
- Revalidate exact campaign eligibility/currency and funding provenance at the relevant financial writes, including refunds and payouts.
- Verify every provider/reconciliation path and the full API suite after this change. Focused tests do not establish live-provider operation or overall regulatory/store compliance.
