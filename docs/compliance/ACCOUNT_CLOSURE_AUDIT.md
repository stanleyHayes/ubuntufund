# Historical account closure inventory

Status: read-only engineering tool verified locally; production inventory and reviewed repair remain open.

From `apps/api`, with `MONGODB_URI` already configured and preferably read-only database credentials:

```sh
umask 077
npx tsx scripts/audit-account-closure.ts 2026-09-13T00:00:00Z > closure-audit-page-1.json
```

Arguments: a fixed ISO cutoff at least30minutes old, optional last-page `nextCursor`, optional page size1–200 (default100). Continue with the same cutoff until `nextCursor` is null. Each page uses a read-only snapshot transaction; pages are not one globally fixed snapshot, so preserve reports and rerun if concurrent review/cleanup changes matter. The tool imports no application models, disables automatic collection/index creation, bounds query time and has no repair mode.

Exit0 means no findings on this page,2 means review findings exist,1 means execution failed. Preserve output on exit2. Reports contain internal request identifiers and issue codes, not email addresses, staff notes, media URLs or credentials. Keep reports restricted and outside Git/public artifacts.

Findings distinguish missing/invalid account references, absent user tombstones, missing/invalid closure timestamps, pending cleanup, unknown request states and completed-review states without a core-cleanup timestamp. A timestamp is structural evidence only: it does not prove each data category or processor was erased. Requests outside the cutoff or without a qualifying date, accounts without deletion requests, retention legality and actual processor erasure are not verified.

For findings, inspect the original deletion request and account history under authorized staff access before deciding repairs. Do not hard-delete user or financial records, reset a completed request indiscriminately, or infer that missing records are harmless. No automated historical repair or production mutation is supplied.

Two MongoDB integration tests pass, covering valid/null/missing/invalid closure dates, missing accounts, pending/incomplete cleanup, exact before/after record preservation, output privacy, pagination and invalid argument rejection. API types and affected lint pass. Evidence: `/tmp/ujimora-closure-audit-tests.log`, `/tmp/ujimora-closure-audit-types.log`, `/tmp/ujimora-closure-audit-lint.log`. No production inventory was run by this verification.
