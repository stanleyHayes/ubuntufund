# Newsletter consent

Engineering evidence, 2026-09-12. Real email delivery and campaign operations remain release gates.

Footer and blog signup require an unchecked newsletter choice. Web and native Settings use the same subscription record as the public form. A request is pending until the recipient explicitly confirms a random, short-lived email link. Double confirmation is an engineering ownership/evidence control; this document does not claim that Ghana law specifically prescribes that mechanism.

Requests, confirmation tokens, timestamped consent events and encrypted confirmation-email jobs commit atomically. A one-minute per-address cooldown and request rate limits restrict repeat requests. Confirmation tokens expire after 30 minutes, are purpose-separated and stored as hashes. Delivery checks the current pending request and token expiry. Withdrawal cancels pending delivery. Email uses the configured account-email sender and encryption key described in `ACCOUNT_EMAILS.md`.

The public confirmation and unsubscribe pages require a button press; link scanning alone makes no change. Tokens arrive in the fragment, are removed from the address bar and are submitted in a POST body. Unsubscribe requires no sign-in, is idempotent and remains usable from older emails after a later renewed choice. Settings can also withdraw pending or active consent. A failed save preserves the displayed saved choice and shows an error.

The admin list includes only active records with a confirmation date and consent version. Legacy addresses and legacy profile marketing flags are not treated as consent. Newsletter confirmation does not verify an app account or enable activity alerts. Account erasure removes the associated newsletter record, consent tokens/events and queued email while retaining the unrelated financial records required by the account-closure design.

## Release and operational gates

- Verify the sender, public HTTPS confirmation/unsubscribe routes and actual inbox delivery. Engineering tests use a stub provider; no real emails were sent.
- No bulk newsletter sender exists in this implementation. Any campaign tool or exported list must recheck current consent before delivery, include a usable unsubscribe link and process withdrawal promptly. A historical export is not continuing consent. Do not start campaigns until this integration is verified.
- Determine and document justified retention for pending requests, withdrawn addresses and consent evidence, including people who never created an account. Token expiry and account erasure do not constitute a complete retention schedule.
- Confirm processor terms, cross-border handling and operator contact details through the broader compliance review.

## Sources

[Ghana Electronic Transactions Act, 2008, section 50](https://www.csa.gov.gh/resources/Electronic%20Transactions%20Act.pdf) addresses consent and cancellation for unsolicited commercial communications. The [Data Protection Commission's individual rights guidance](https://dpc.gov.gh/for-individuals/) covers withdrawal of direct-marketing consent. These sources inform the controls; legal applicability and the rest of the compliance ledger remain under review.

## Verification

Eight API integration tests pass: explicit consent/outage handling, concurrent requests, confirmation/replay, legacy exclusion, withdrawal/renewal, queued-message suppression, expiry, transactional rollback, admin authorization and account-erasure cleanup. Five web component tests and two marketing component tests pass for pending/confirmed/withdrawn choices, confirmation/unsubscribe and visible failures. All five application type checks pass. All five application lint checks and a mocked 390px browser flow pass, including confirmation, subscribed Settings and signed-out withdrawal; screenshot inspected. The 42-test mobile suite and all-platform JavaScript export also pass. Provider delivery and physical-device acceptance remain external.
