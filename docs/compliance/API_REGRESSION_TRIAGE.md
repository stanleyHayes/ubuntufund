# API regression triage — 13 September 2026

The full run finished with exit 1: 900 passed and 46 failed tests across 147 files (139 passing, eight failing). Log: `/tmp/ujimora-compliance-api-regression.log`. Session 81527 is terminal. No full pass is claimed.

## Observed failure groups

| File | Observed failing tests | Evidence and intended correction |
| --- | ---: | --- |
| payouts.integration.test.ts | 15 | `fundCampaign` submits donorName without legalAcceptance; checkout returns 428 before the financial scenario. Add explicit current acceptance to valid fixture submissions; preserve payout/accounting expectations. |
| refunds.integration.test.ts | 18 | Guest checkout helper includes donorName without acceptance. Confirm final traces; retain refund idempotency and ledger assertions. |
| campaignBeneficiaryPayout.integration.test.ts | 3 | Funding helper includes donorName without acceptance. Preserve beneficiary ownership and payout limits while correcting valid setup. |
| reconciliation.integration.test.ts | 4 | Funding helper submits a public name without acceptance. Preserve mismatch/reconciliation safeguards. |
| creatorTips.integration.test.ts | 1 | Lost-credit recovery test creates a name-only tip without acceptance. Update setup; keep the real recovery balance checks. |
| payoutIdempotency.integration.test.ts | 1 | Funding fixture includes donorName without acceptance. Confirm final error; preserve request/retry accounting assertions. |
| donation-feed-identity.integration.test.ts | 2 | Fixture creates an unreviewed donation with no stored name, then expects the current profile name in guest/restored feeds. Use explicitly reviewed snapshot fixtures for the block/restriction/closure tests, maintaining suppression and unchanged-money assertions. Keep separate unreviewed-donation tests. |

The campaignSplitAccrual integration file has now reported two failures. Its funding helper contains the same missing acknowledgement pattern; confirm final assertions before correction.

Do not disable consent gates, automatically approve real content, or change public projections to current profile identity in order to satisfy these fixtures. A financial test needs a valid accepted checkout; a post-approval privacy test needs an explicitly reviewed snapshot. New behavior beyond fixture setup requires independent implementation analysis and regression evidence.


## Repair run in progress

Valid financial checkout fixtures in payouts, refunds, beneficiary payout, reconciliation, payout idempotency and split accrual now explicitly accept current public-name terms. The lost-tip-credit fixture does the same. Donation-feed block/restriction/closure fixtures now use reviewed snapshot attribution, retaining their financial/privacy assertions. No production API behavior was weakened.

The eight affected files are running together in exec session `27562`, log `/tmp/ujimora-compliance-api-repair.log`. Poll this session to terminal before further API/shared edits. One beneficiary test also reported a campaign-creation 400 on a retry; inspect whether it persists now that its funding setup can complete. The refund recovery queue's empty-queue failure was downstream of failed checkout setup, but its acceptance assertion is retained.


## Repair result

The eight-file repair run finished successfully: all 60 tests pass (76.20 seconds). API type-check passes and `git diff --check` is clean. The beneficiary campaign-creation retry error and refund empty-queue assertion did not persist after valid checkout setup. No production API implementation changed during this repair.

This closes every failure from the prior 946-test run through a focused rerun of all eight failing files; it is not a new uninterrupted full-suite pass. Sessions 81527 and 27562 are both terminal. Next backend work can proceed, beginning with the documented KYC review integrity gap, followed by a final full regression after those implementation changes.

## 13 September — index-readiness regression completed

Session 69000 completed against the API source at b18bb0c: 152 files/1063 tests passed, one file/test failed. The previously failing creator withdrawal unique-index case passes. The new failure starts with a 120-second timeout in donation-content-gate, while awaiting its first authorized review-queue read. Two retries then observe accumulated fixture records and fail exact pending-count assertions (2/3 instead of 1). These follow-on assertions are not evidence that the first queue request returned an incorrect count. Log `/tmp/ujimora-api-index-ready-regression.log`.

The unchanged single-file test passes in 7.26 seconds against current API source (`/tmp/ujimora-donation-review-repro.log`, session 47995). This does not establish why the full-run request timed out or close full regression. No retry count assertion was weakened and no production query behavior was changed based on an unproven cause. Root checkout was fast-forwarded to d5d4aac after the run ended, bringing in the separately tested missing-policy and update-publication transactions. A fresh complete run is required on that source.

## Current publication and withdrawal regression completed — 13 September 2026

Session 3544 finished with exit 0: **1,078 tests across 154 files pass**, 966.64 seconds (`/tmp/ujimora-api-current-publication-regression.log`). API/shared source remained unchanged throughout. This run includes index readiness, missing withdrawal-policy serialization and campaign-update final authorization/publication transactions through d5d4aac. The earlier donation-content-gate timeout did not recur; its original cause remains unproven, and no assertions were weakened. The API source freeze is lifted.

This establishes a complete passing API regression for that source, not signed-native/provider/legal/store approval or completion of the remaining requirement ledger.
