# Historical donation integrity audit

Status: read-only tool verified locally; production inventory and reviewed corrections remain open.

The normal payment reconciler processes CREATED/PENDING intents and skips SUCCEEDED. Replaying a successful intent through settlement is also a no-op. Neither proves that historical records predating atomic settlement have a donation, journal, projection and delivery record. The existing legacy-wallet repair script is for a separately proven legacy donation without an intent journal; it must not be used as a general intent repair.

## Run a structural inventory

Use an operator environment with `MONGODB_URI` already configured, preferably with read-only database credentials. From `apps/api`:

```sh
umask 077
npx tsx scripts/audit-donation-settlement.ts 2026-09-12T00:00:00Z > donation-audit-page-1.json
```

The first argument is a fixed cutoff at least 30 minutes old. Optional second/third arguments are the last page's `nextCursor` and a limit of 1–200 (default 100). Continue with the same cutoff until `nextCursor` is null. A page with no findings does not establish a complete scan. Select the cutoff appropriate to the historical period; recent records and records without a valid qualifying updatedAt are outside that scan.

Exit codes: 0 = page has no structural findings, 2 = findings require review, 1 = audit failed. Do not discard JSON on exit 2. Reports contain internal intent/campaign identifiers and issue codes, not donor names, emails, payment references, messages or wallet metadata. Keep them in restricted operator storage, outside public artifacts and Git.

Each page uses a read-only snapshot transaction on the primary. The command imports no application models, disables collection/index auto-initialization, has bounded pages/query timeouts and provides no apply mode. It cannot charge, credit, send receipts or contact a provider.

## What findings mean

Checks include absent/duplicate journals, linked donation presence and campaign/currency consistency, valid and balanced journal lines, recorded settlement totals, campaign-directed journal amount, outbox presence/linkage and wallet-history count/owner/currency/amount/status. A history record alone is not proof that a wallet debit actually happened.

The report explicitly leaves actual provider/wallet movement, historical aggregate campaign/beneficiary projections, refunds/compensations, orphan records and legacy donations without intents unverified. Aggregate balances cannot safely be rebuilt from a single successful intent. Refunded donations retain their original settlement artifacts; this audit does not treat a refund as missing settlement.

## Correction process

1. Preserve the read-only report and the exact relevant accounting records. Obtain authoritative payment/debit evidence, historical fees, split version/consent and any refund/compensation records.
2. Determine which writes landed and which are absent; do not reset SUCCEEDED or replay a debit to force normal settlement.
3. Prepare an explicit, idempotent correction with before/after journal and balance evidence, independent staff review and rollback/recovery handling. No general historical correction is implemented by this tool.
4. Repeat the read-only inventory and compare aggregate projections/provider balances after approved repairs. Financial and legal/store release gates remain separate.

## Verification — 13 September 2026

Four real MongoDB tests pass: valid structure plus exact database snapshot preservation; missing historical accounting with no replay; journal/donation/outbox/wallet inconsistencies; and deterministic pagination excluding recent/pending intents with invalid-option rejection. API type-check and affected lint pass. CLI smoke test uses an empty local test database only. Logs: `/tmp/ujimora-donation-audit-tests.log`, `/tmp/ujimora-donation-audit-types.log`, `/tmp/ujimora-donation-audit-lint.log`, `/tmp/ujimora-donation-audit-cli.log`.

A production inventory attempt at cutoff 2026-09-13T12:00:00Z returned exit 1 without a report (`/tmp/ujimora-production-donation-audit-error.log`). DNS resolution succeeded; the separate database connection diagnostic returned Error/ETIMEOUT. The remote connectivity cause remains unproven, and snapshot access was not reached. No production inventory completion, absence of historical issues or repair is claimed. The tool imports no write paths and no production data mutation was requested.
