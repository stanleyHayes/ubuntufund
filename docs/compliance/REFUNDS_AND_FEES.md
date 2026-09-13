# Refund and fee accuracy — 12 September 2026

Status: engineering audit in progress; no legal or provider approval implied.

## Verified correction

- A new donation refund request records the full campaign-directed donation amount, zero request fee and `pending` status. Intake is free; it does not execute or promise a provider refund. Existing request fee/net snapshots remain unchanged for review.
- Web/native request forms disclose review, fee treatment and provider timing without the unsupported blanket 2% deduction or 5–7-business-day promise. Web confirmation returns to the top of the page. Native request/history amounts use the recorded currency rather than a hardcoded GHS label.
- The shared policy no longer presents recommended prices as binding current fees, promises a three-day payout, claims every control is administered through versioned configuration, or promises automatic all-or-nothing refunds. Standard campaign payout has zero additional service fee; donation platform/processor fees may already be deducted. Optional payout fees remain calculated by the existing commercial configuration and recorded on each payout.
- Request records and history display requested amounts, not evidence of settlement. Historical deductions need case review; no production financial history was rewritten.

## Evidence

- Eight isolated MongoDB/API tests pass across `refund-intake.integration.test.ts` and `refunds.integration.test.ts`: ownership checks, duplicate requests, GHS/XOF/KWD precision, zero new request fees, historical snapshot preservation and existing provider-refund regression. Provider calls use test doubles.
- Phone-width browser request/review/confirmation passes with mocked API responses; no real refund submitted. API/web/native/marketing type and lint checks pass for this slice. The final release sweep remains outstanding.

## Remaining requirements

- Request intake and the admin payment-refund executor are separate paths. Implement a reviewed case lifecycle tied to the actual provider outcome, evidence and donor-visible response. Do not mark a request paid merely because an operator initiated a refund or because an alert was queued.
- Durable operation reservation, payout-excluded campaign/beneficiary funds holds, verified asynchronous status and transactional accounting recovery are now implemented and locally tested; see [refund recovery](REFUND_RECOVERY.md). Legacy reconciliation, remaining payout lifecycle review and case linkage remain release requirements.
- The executor now always supplies the explicit campaign-directed amount to the provider, so a full campaign refund cannot silently include the separate platform tip. Different charge/settlement currencies are refused before a reservation or provider call; a verified conversion workflow and any separate tip refund remain manual case work. This does not waive an otherwise applicable right to a tip or fee refund.
- Establish reviewed treatment for processor/platform/payout fees, optional tips, wallet contributions, guest payments, disputes, cancelled campaigns and funds already disbursed. Mandatory refunds must not depend on a discretionary blanket fee or unsupported platform promise. Guest/support case fulfillment and operational response times need evidence.
- Audit payout quote/reconfirmation behavior when commercial settings change, currency-specific minimum/fixed fees, downloadable receipts, tax claims and all checkout disclosures. Existing payout fee minimums/fixed charges are documented as GHS but currently applied numerically across currencies; this remains an open pricing and enforcement issue.
- Operator identity, contact information, applicable service classification, statutory periods/exceptions and approved commercial terms require qualified Ghana review and provider agreements. Code cannot establish those facts.

## Primary legal reference

[Ghana Electronic Transactions Act, 2008 (Act 772), sections 47–54](https://www.csa.gov.gh/resources/Electronic%20Transactions%20Act.pdf) addresses supplier information, transaction review and consumer rights, with scope and exceptions. Removing unsupported promises and the automatic intake deduction is an engineering correction; it is not a claim that every donation is subject to an identical cooling-off period or that this implementation establishes statutory compliance.

## Provider amount and validation follow-up

- A GHS 200 campaign contribution plus GHS 20 tip now sends `amount: 20000` to Paystack for a full campaign refund, matching the local GHS 200 reversal. Partial refunds remain explicit. The original settlement journal is preserved. Paystack documents that omitting the amount defaults to the original whole transaction; this is why an explicit amount is necessary. [Paystack refund API](https://paystack.com/docs/api/refund/)
- Invalid amounts (including strings, null and objects) are rejected instead of silently becoming a full refund. Keys are bounded, and mismatched settlement/charge currencies stop before money movement.
- Ten refund/intake integration tests pass, including provider payload, unchanged original journal, malformed-input/no-side-effect checks and cross-currency refusal; API type and lint pass. All provider calls are doubles. No real refund was initiated.
- Follow-up recovery now handles pending/failed/unknown outcomes without resubmission and allows verified, transactional local completion. Initial verification passed 30 API tests, five admin tests and mocked desktop/phone flows. The funds-hold follow-up passes 31 API/use-case tests, including payout-clearing races and rollback, plus five admin/eight web tests and affected checks. Failed-operation disposition, legacy exposure and case linkage remain open; this is not release-ready provider refund certification.
