# Render API startup incident — 2026-09-13

Render builds succeeded, but new API instances exited before binding a port.
Deploy dep-daj84up5efls739g8lg0 confirmed MongoDB code 86 on model Refund,
stage model_initialization. Older logs obscured the numeric code/model.

The production refunds collection had a legacy non-unique `donationId_1`
index; the current model requires it to be unique for refund idempotency.
Awaiting required model initialization correctly exposed this incompatibility.
The database connection itself succeeded. An older healthy instance did not
prove the new deploy was working. Other deploys were canceled by newer commits.

## Correction

`apps/api/scripts/migrate-refund-index.ts` runs a narrow, repeatable migration:
prepare the existing index to prevent new duplicates, dry-run the uniqueness
conversion, then finalize it in place. It never drops indexes or edits records.
If duplicates exist, it fails and retains prepareUnique for staff reconciliation.
Existing unique indexes are a no-op; fresh databases receive the unique index.
Do not run broad `syncIndexes()` or bypass startup index validation.

From apps/api, with MONGODB_URI securely supplied for the intended environment:

```sh
../../node_modules/.bin/tsx scripts/migrate-refund-index.ts
```

Method: https://www.mongodb.com/docs/manual/core/index-unique/convert-to-unique/

## Evidence

- Production MongoDB 8.0.32 read-only preflight: zero refund records, no duplicate
  groups; legacy non-unique donationId_1 present.
- Production migration succeeded 2026-09-13 11:05:51 UTC; no records/indexes deleted.
- Three integration tests: in-place preservation and repeatability, rejection of
  existing/new duplicates without deleting data, and fresh database initialization.
- API type-check and lint pass. Safe startup diagnostic tests passed separately.
- Replacement Render deployment verification pending.
