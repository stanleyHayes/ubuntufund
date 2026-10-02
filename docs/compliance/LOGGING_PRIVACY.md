# Diagnostic log privacy — 12 September 2026

Status: implemented and focused verification passed; historical log cleanup and
operational retention/access evidence remain open.

Application diagnostics previously logged full request URLs, including overlay
query tokens, and provider errors could include bank-resolution query values,
connection details or submitted data. These controls now apply centrally:

- Request completion logs contain route templates, method, status and duration.
  Unmatched requests use a fixed marker rather than recording arbitrary input.
- Structured `path` and `url` values omit query strings, fragments and URL userinfo.
- `err` and `error` serialize only known error classes, HTTP status and a small
  allowlist of transport/database codes. Raw messages, stacks, nested causes,
  response bodies and Mongo key values are excluded.
- The HTTP error handler uses a constant diagnostic message. Its existing client
  response contract is unchanged: generic failures return a generic message;
  intentional application validation responses remain available to the caller.
- Known credential, contact, document, request/response payload and raw-message
  fields are removed at the root and two nested object levels. Financial record
  references and numeric diagnostic metadata remain available for reconciliation.

These are controls for current structured logging paths, not a promise that any
arbitrary future logging call is safe. New calls must use constant message text,
minimal approved metadata, no submitted content, and no raw request/provider
objects. Deeper/custom fields, custom transports and infrastructure logs require
separate review. The error serializer intentionally trades free-form stack/error
payloads for reduced personal-data exposure; use controlled case/transaction
records for authorized investigations.

Verification: three regressions capture emitted JSON from the actual Pino options
and exercise Express middleware. They cover nested sensitive fields, provider URL
credentials/query/fragment, error causes/payloads, route parameters, unknown paths
and generic failures. Those tests plus authentication and Paystack integration
regressions pass: 18 tests. API type and lint checks also pass.

Before release, the operator must review access to existing application, reverse
proxy, hosting and provider logs, establish justified retention, and assess any
previously exposed tokens or personal data. This change does not erase historical
logs, revoke historical tokens, change financial audit records, or certify a
retention policy. Audit records intentionally retain actor/financial references
and require their own lawful retention and access controls.

## Publishing on approval (2 October 2026)

The publication applier (`PublicationApplier`, see `PUBLICATION_REVIEWS.md`) logs under `event: 'publication.apply'`, and only these fields:

- **Outcome (info).** `reviewId`, `action`, `state`, `reason` (an outcome code) and `attempt`, with the message 'Publication on approval ended'.
- **A retry (warning).** `reviewId`, `action`, `state: 'queued'`, `attempt`, `nextAttemptAt`, `errName` and `errCode`, with the message 'Publication attempt failed; it will be retried'.
- **Giving up as `unavailable` (error).** The outcome fields plus `errName` and `errCode`, with the message 'Publication on approval failed'.
- **Switched off.** `state: 'released'` and a `count`, when waiting approvals are returned to their authors.
- **A failed sweep, attempt or decision start (error).** `errName` and `errCode`, with the review id when there is one.

`errName` is the error's class name when it is a plain identifier, otherwise `Error`; `errCode` is kept only when it is a number or an identifier. Error messages are never logged: they can carry submitted text, and a duplicate-key message carries the key's value. No log carries the content, the credential digest, the lease token or an email address. A thank-you message queued on approval logs `donor_thank_you.send_requested` with the campaign, message and review ids, the estimated recipient count and the author's role, never recipients.
