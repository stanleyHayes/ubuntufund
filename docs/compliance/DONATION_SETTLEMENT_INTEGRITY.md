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

## Wallet accounting transaction — 2026-09-13

Wallet debit and required donor transaction history now run after the exactly-once intent gate inside the same settlement transaction. The caller no longer compensates errors by depositing money: a rolled-back transaction leaves the original balance, while an uncertain commit can be resolved by replaying the same intent. Attempt telemetry and outbox delivery follow committed accounting.

Known insufficient-balance/missing-wallet refusals persist FAILED and release an associated coupon seat in the transaction, then return an error after commit. Unexpected write failures roll back and retain a resumable intent. Wallet settlement checks the stored donor, currency, donation amount and gross charge before debit. Interrupted CREATED/PENDING wallet intents resume using stored charge values and require their owner.

All 44 tests across six focused files pass, including real-database failures after wallet debit, transaction-history write and campaign projection, simultaneous settlement, delivery outage, insufficient funds, mismatched amount and interrupted-owner resume using stored amount/tip. Four additional tests cover another account or payment method winning an idempotency-key race; all 18 tests in the affected retry/API files pass on the final implementation. Types and affected lint pass. Logs: `/tmp/ujimora-wallet-atomic-final-tests.log`, `/tmp/ujimora-wallet-retry-binding-tests.log`, `/tmp/ujimora-wallet-atomic-types.log`, `/tmp/ujimora-wallet-atomic-lint.log`. The older attribution fixture now funds a real authenticated wallet rather than treating the wallet rail as a guest payment.

The full earlier de49df2 API baseline passed 1,187 tests/162 files; it excludes the later split-consent and wallet deltas above. No production balances or historical records have been modified.

## Required campaign projection and wallet eligibility — 2026-09-13

CampaignLedgerProjector no longer logs and continues when the campaign raised-total write cannot match the campaign/currency. It throws inside settlement so the intent, journal, balance, outbox and any wallet debit roll back together. Wallet donations additionally read current campaign status/end date/currency within that transaction; the campaign write serializes a concurrent moderation change against the snapshot. A blocked campaign retry fails without moving funds.

Externally verified money received after an otherwise existing campaign ends remains accountable: that path does not apply the new wallet-only open-campaign gate. Missing/deleted campaigns or currency mismatch retain pending settlement for reconciliation rather than claiming complete accounting. This does not by itself refund an external provider charge.

All 27 focused tests in atomic settlement and donation-intent integration pass, including deleted/currency-mismatch rollback, a moderation write after the wallet transaction snapshot, and a late external payment after campaign expiry. API types and affected lint pass. Logs: `/tmp/ujimora-campaign-credit-tests.log`, `/tmp/ujimora-campaign-credit-types.log`, `/tmp/ujimora-campaign-credit-lint.log`. Root full regression97713 still uses the preceding 428402b source and excludes this delta.

## Full current API regression — 2026-09-13

Session41412 completed exit0: all1,210 tests across163 files pass in1,252.56seconds on unchanged de8b9e2 API/shared. This supersedes the earlier baseline exclusions above and includes every implementation change described here plus the historical read-only audit. Log `/tmp/ujimora-current-accounting-full-regression.log`. Root source freeze is lifted. No live provider or historical production repair is established by this result.

## Remaining requirements

- Verify deployed wallet operation and reconcile historical wallet debits/compensations; the transaction change is prospective. Provider-independent lost-commit replay is covered locally, not by a production outage exercise.
- Reconcile historical successful intents with missing or partial donation/journal/projection/outbox records. The read-only structural inventory in `HISTORICAL_DONATION_AUDIT.md` is implemented and tested; historical correction and aggregate/provider proof remain open. No historical repair or production fund mutation was performed here.
- Audit creator/account restrictions, original quote and funding provenance at remaining financial writes, including refunds and payouts. The wallet campaign gate above verifies current campaign status/end date/currency; it does not close every eligibility policy.
- Verify every live provider/reconciliation path. The full API suite passes as recorded above; local tests do not establish live-provider operation or overall regulatory/store compliance.
