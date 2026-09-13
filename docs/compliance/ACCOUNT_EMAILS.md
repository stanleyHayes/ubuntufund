# Account recovery and verification

Engineering work in progress, 2026-09-12. Provider delivery and account verification are not release-approved.

## Password recovery

The old forgot-password implementation logged the raw reset link and had no delivery provider or reset page. Recovery now queues a Resend message transactionally with a hashed, single-use reset token. The encrypted queue expires after 30 minutes; a dedicated AES-256-GCM key protects the message and the token hash is authenticated as associated data. Worker retries keep the same payload and provider idempotency key within that short lifetime. Successful or suppressed delivery removes the encrypted payload. Expired jobs are not sent and MongoDB TTL removes their records.

The worker checks account closure, current email ownership, credential version and unused-token state before delivery. Account deletion removes both reset tokens and email jobs. Password changes and resets rotate the persisted credential version; existing access and refresh tokens are rejected on all API instances. Password-reset token consumption and credential replacement commit together. No password appears in an email.

Known and unknown addresses receive the same public result. Provider calls run outside the request path. Short database paths are padded to 500 ms; this is a mitigation, not a claim that every overloaded database response has identical timing. A per-account one-minute cooldown commits with the queue and complements the existing request rate limiter. Unconfigured recovery returns the same 503 for every address. Web and mobile display failures instead of claiming an email was sent.

The email opens the web reset page, including on a phone. Its random token is in a URL fragment, removed from browser history after loading and submitted only in the reset POST body. The page uses a no-referrer policy, validates password confirmation, offers a replacement link and directs the user to ordinary sign-in after completion. Refreshing the form requires reopening the email link. No automatic sign-in occurs.

Security reference: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Delivery retries follow [Resend's idempotency rules](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Email verification and security notices

Web/native Settings provide Send verification link and Check verification status. The authenticated request only targets the current account; arbitrary recipient fields are rejected. Verification uses a separate hashed-token collection and the shared encrypted account-email outbox. The token is bound to the address and credential version at issue, expires after 30 minutes and is consumed transactionally with verification. Account closure removes verification tokens. Wrong-purpose tokens cannot reset passwords.

The web confirmation page opens from email on desktop or phone and requires an explicit button click. Page loading/scanning alone does not consume the token. Verification does not create a session, raise a KYC level, change an administrator role, or enable any activity/marketing preference. Returning to Settings refreshes email eligibility; a subsequent explicit choice enables activity emails. Stale profile saves cannot undo email verification or restore an old administrator role.

When account email is configured, password changes and resets queue a security notice in the same credential transaction. A queue-write failure rolls back the change. Notices contain no password and provide recovery/support instructions. They use the same short-lived encrypted delivery, retry and suppression controls. These account-security messages are described separately from optional activity and marketing messages in Settings and the shared privacy notice. With sender/key configuration absent, credential changes remain available but security mail cannot be delivered; release configuration verification remains required.

## Deployment and remaining work

- Configure `RESEND_API_KEY`, a verified `FROM_EMAIL`, `REPLY_TO_EMAIL`, the HTTPS public web URL and `AUTH_EMAIL_ENCRYPTION_KEY_BASE64`. The last value must decode to a random 32-byte key, shared by every API instance and stored only in the deployment secret manager. Do not reuse JWT or store-receipt keys. Missing/invalid configuration keeps recovery unavailable rather than exposing links in logs.
- Keep the encryption key stable while jobs are pending. A key change makes previous queued messages unreadable; they expire naturally and users can request a new link. Monitor pending retries and deployment configuration without logging payloads or tokens.
- Confirm actual sender-domain verification, inbox delivery, fragment-link preservation by the configured email service and public reset-route hosting before launch. No real emails were sent during engineering verification.
- Review access to historical logs that may contain old reset links. Tokens expire, but the log-handling incident/retention decision requires operator evidence.
- Confirm the verification link end to end with the real sender and on a physical phone, including returning to the native Settings screen. The public verification and reset routes must be served by the configured HTTPS web origin.

## Verification evidence

Six recovery integration tests cover outage parity, encrypted persistence, a usable reset link, identical retries, changed credentials/closed accounts, expiry, transaction rollback and simultaneous per-account cooldown. Three web component tests and a mocked 390px browser flow pass; screenshot inspected. The browser test asserts the token never appears in request URLs. After repairing test-run isolation, the affected alert/auth/payout/recovery suites pass 39 tests. API/web/mobile type checks and lint pass.

Verification/security follow-up: 19 API tests pass across verification, recovery/security notices and persisted account sessions. Ten web component tests pass across verification, recovery and activity Settings. The mocked 390px verification-to-opt-in flow passes; its screenshot was inspected. API/web/mobile type checks and lint, 42 mobile tests and the refreshed all-platform JavaScript export pass. Real provider delivery and physical-phone acceptance remain external verification.
