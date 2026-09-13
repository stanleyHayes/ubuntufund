# Opt-in activity alerts

Engineering verification in progress, 2026-09-12. This is not evidence of live email delivery or store approval.

Web and native Settings expose separate in-app and email choices for donations received, donations sent, creator support received, withdrawals/payouts, refunds, wallet activity and subscriptions. Every new choice defaults off. Existing profile email defaults do not constitute consent and are not migrated into these choices. Email opt-in requires a verified account email. Saving one choice preserves the others; failure is visible and does not display an unsaved choice as saved.

Consent records retain each choice's change time and current opt-in time. Delivery checks consent and active-account state again. Older activity is not sent after a later opt-in. Withdrawal suppresses queued delivery; it cannot recall email already accepted by the provider. An ambiguous retry is suppressed if the account address has changed. Account closure removes these preferences and queued messages.

Financial writes carry an atomic pending marker. A separate worker captures the latest state and uses durable, unique delivery records. Rapid intermediate transitions can coalesce into the latest state. Settled creator credits and completed/reversed payouts wait for settlement evidence. A rolled-back transaction cannot create an alert. Duplicate scans and delivery retries reuse the same inbox ID/provider idempotency key. Anonymous donors are not named in recipient alerts; guest identities are not inferred from email addresses.

In-app means the notification inbox, not operating-system push delivery. Verification and password-recovery messages remain separate. This feature does not enroll anyone in marketing or a newsletter.

## Delivery operations

The worker runs at startup and every 30 seconds. Source capture and delivery failures retain retryable state. Email requires the configured Resend sender, API key, support reply address and correct public web origin. Without email configuration, preferences persist and email delivery stays pending; Settings discloses the outage.

Delivery rows use `pending`, `delivered`, `suppressed` or `review`. Monitor pending age, `lastError`, source `activityError`, and `review` counts. A failed provider request retries with its original payload and key. After 23 hours from the first attempt it moves to review because [Resend retains idempotency keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). Confirm provider delivery history before resolving an ambiguous attempt; do not reset its first-attempt timestamp or send with a fresh key blindly. Frozen recipient payloads are removed on delivery or suppression; unresolved review records require restricted operator handling and retention review.

## Verification

- API integration covers default-off behavior, authentication/verification gates, consent timing, duplicate workers, anonymous notices, opt-out/account closure, provider retries, changed email addresses, ambiguous retry cutoff, settlement ordering and rollback.
- Account-erasure integration verifies stable user/donation references, preserved donation amount and wallet balance, removed operational data and alert choices, and retryable cleanup.
- All category, concurrent preference-save and source-recovery cases pass: 13 activity integration tests. Two sender adapter tests, three account-erasure integration tests and four web Settings component tests pass. A mocked 390px browser flow verifies save, reload, opt-out and absence of horizontal overflow; its screenshot was inspected. Mobile regression: 42 tests pass, and all-platform JavaScript export passes. API/web/mobile type checks pass at the activity checkpoint.
- Live Resend acceptance, operational monitoring integration, native device UI acceptance and retention policy sign-off remain open. The unsigned native compile is tracked separately under store readiness; a JavaScript export does not prove a signed store build.
