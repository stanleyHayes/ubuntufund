# Identity date-of-birth check — 12 September 2026

This implements the platform's existing 18+ account policy. It is not proof of identity, a statutory age determination or complete Ghana KYC compliance.

- Supplied dates of birth are validated before identity submission is saved. Invalid calendar dates and dates showing an age below 18 are rejected. An omitted date may still enter the existing pending-review path, but identity approval now requires a valid adult date of birth.
- Staff cannot approve an older identity record with a missing or underage date and thereby raise the user's verification level. Rejection occurs before either approval or account verification is written. Staff must obtain corrected, reviewed information through the existing rejection/resubmission process; no historical date is invented and no existing approval is silently rewritten.
- Web and native identity forms use the shared check before advancing/submitting and limit the date picker to the latest eligible birth date. The boundary uses calendar dates in Ghana/UTC, not elapsed milliseconds divided by 365. A leap-day birthday becomes eligible on March 1 in a non-leap anniversary year; a leap-day current date does not roll the cutoff into March.
- Omitting the optional documents array no longer produces a server error in the private-document ownership check.

Eight API/domain tests pass across identity approval/submission, private-document access and date boundaries. Web/API/native type and lint checks pass. The native suite passes 43 tests, including invalid/underage dates. The final release sweep and signed-device verification remain separate gates.

Remaining C13 requirements include review of original identity evidence, legacy approved records, other verification types and organization representatives, beneficial ownership, sanctions/PEP checks, AML/reporting obligations, staff procedures and provider/legal requirements. A submitted adult date or accepted terms alone does not establish that those requirements have been met.
