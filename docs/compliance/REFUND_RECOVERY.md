# Refund recovery — 12 September 2026

Status: implemented and locally verified for new refund operations; C14 remains in progress. No real provider refund was submitted.

## Durable execution and verification

Before contacting Paystack, the API commits a cumulative donation refund reservation and a durable operation in one MongoDB transaction. A unique active-operation index prevents another request, including one using a different key, from resubmitting an unresolved refund. A database failure before commit makes no provider call. A timeout after submission retains the reservation and enters review; it is never interpreted as proof that no money moved.

New operations also move the refundable beneficiary net out of campaign pending funds into an operation-specific hold in the same transaction. Recorded split shares receive matching beneficiary holds. These amounts are excluded from payout clearing and wallet/provider payout eligibility while raised totals and donation status remain unchanged. A short campaign or beneficiary bucket rolls back every hold and donation reservation before contacting the provider. Pending, failed and unknown provider outcomes retain holds.

The operation ID travels in the provider merchant note. Pending, processing, failed and unknown outcomes do not mark the donation refunded or reverse its accounting. Even an immediate processed response requires a separate read of the refund and original payment. Confirmation must match the operation ID, original transaction ID/reference, amount and currency. Contradictory non-success HTTP responses and mismatched evidence fail verification.

After verified processing, one transaction updates the campaign and beneficiary projections, posts an append-only compensating journal keyed to the operation, updates the donation status and completes the operation. A late failure rolls back all those writes. Concurrent accounting retries can finish this transaction once without issuing another provider refund. Original settlement journals remain intact.

Within that completion transaction, held amounts return to pending only for the immediate compensating reversal; other payout requests cannot observe or spend that intermediate state. A rollback retains the holds. Missing/mismatched holds fail for reconciliation. Split reversals must account for the entire intended net, including legacy operations; a short share cannot silently complete the refund accounting. Web/native cashout breakdowns separately show funds held for refund review, and staff views distinguish recorded holds from legacy operations without holds.

## Staff recovery

Admin → Refund recovery lists unresolved operations with private, non-cacheable responses and action-center counts. Staff can verify the stored refund reference or supply the original numeric provider refund ID after an uncertain response. Supplied IDs are independently checked against provider evidence. Staff can finish local accounting for an already verified operation. The screen offers no resend or release action, and pending verification remains visibly pending.

The API currently requires the administrator role and records mutations through the existing audit middleware. The screen also respects donation read/update permissions. Current production accounts have a single full-access admin role; read-only admin fixtures do not represent configurable accounts. See [staff access audit](STAFF_ACCESS.md). Restricted staff delegation requires future server-enforced scopes; immutable case decision/evidence records remain open. UI permission tests are not server authorization evidence.

## Verification

- Thirty integration tests pass across refund execution, refund intake, Paystack settlement and the admin action center. Coverage includes timeout/restart, different-key and concurrent submission, pre-provider transaction failure, pending/failed responses, mismatched provider evidence, non-success HTTP responses, supplied-reference recovery, concurrent verification and rollback after a late accounting failure.
- Five admin component tests pass; admin type/lint/build and API type/lint pass.
- Mocked desktop and 390px browser flows pass for provider-ID verification, pending disclosure and local accounting completion. Screenshots inspected: no horizontal overflow; confirmation remains visible after the completed row leaves the queue. Browser fixtures and provider doubles do not establish production delivery or provider approval.
- Follow-up: beneficiary payout requests now commit pending-to-available clearing on both beneficiary/campaign balances and the payout record in one transaction. A short campaign mirror fails with 409 and rolls back; a later request-save failure also rolls back. Twenty-four refund, beneficiary payout and split-accrual integration tests pass, including these failures, retry through a fresh API instance and concurrent requests; API type/lint pass. This does not yet implement refund funds holds or make every payout lifecycle transition transactional.
- Funds-hold follow-up supersedes the hold limitation in the preceding checkpoint: 31 integration/use-case tests pass across refund execution, beneficiary payouts, split accrual and cashout breakdowns. Tests verify held amounts, denied clearing, provider completion consuming holds once, short beneficiary rollback, payout clearing winning after the initial refund balance read, late accounting rollback preserving holds, and cashout rows deducting holds once. Five admin recovery and eight web owner-money-flow tests pass; API/admin/web/native type checks and API/admin lint pass. Provider behavior remains doubled, and this is not verification of every payout lifecycle or legacy record.
- Updated admin and web production builds pass. Existing bundle-size warnings remain; native type checks passed, but this follow-up did not produce a signed native binary or claim physical-device acceptance.

## Remaining release requirements

- New refund funds holds and beneficiary request clearing are implemented. Review the remaining approval/transfer lifecycle, legacy exposure and operational hold reconciliation before release. Legacy operations without `fundsHoldVersion: 1` receive no fabricated credit; provider verification and guarded transactional reversal remain required. Foreign-currency split accruals require reviewed reconciliation because the existing split rail uses GHS precision.
- Keep unknown and failed operations under review. A failed provider status alone does not authorize releasing the local reservation or creating a replacement; operator retry behavior and final evidence must be resolved first.
- Link donor refund intake to a reviewed case, verified provider outcome, donor response and current opt-in notification preferences. Intake and execution are still separate paths.
- Reconcile legacy reservations without durable operations using verified provider records. Do not invent operation evidence, automatically resend, or silently release them.
- Resolve fee/tip/currency policy, funds already disbursed, immutable decision evidence, authorization for any future restricted staff roles, staff procedures and provider/legal approval. See [refund and fee accuracy](REFUNDS_AND_FEES.md).

Primary provider contract: [Paystack Refund API](https://paystack.com/docs/api/refund/) documents separate creation/fetch states and refund amount behavior. Actual account/provider evidence remains external.
