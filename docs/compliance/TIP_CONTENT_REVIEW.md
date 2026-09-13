# Supporter attribution review

Engineering in progress. Payment settlement and content publication are separate.

Public creator-tip reads now show a generic Supporter label and omit the message unless staff approved the tip content. Anonymous names remain Anonymous. New tips default to pending review; legacy tips without approval are also withheld. Amounts, supporter counts, balances and payment lifecycle are unchanged. Hidden messages remain suppressed. Unpublished messages cannot be submitted to the public message-report endpoint.

The admin Publication reviews page has a Supporter names and messages queue, with existing CSV/XLSX/branded PDF export controls. The API queue includes settled pending/legacy content and excludes revoked checkout records. It exposes the proposed public text, not email or checkout credentials. The staff decision binds a SHA-256 content version, requires notes and prevents creator/supporter self-review. A transaction rechecks current staff credentials and role, serializes with linked account closure, checks linked author restrictions, and records an audit entry alongside the decision. Decisions do not move money. Guest checkout can continue while attribution waits for staff review; no guest account or automatic text-screening consent is inferred.

Verification: seven real API integration tests across content review, creator visibility, public message reports and user blocking pass. The new route test proves hidden guest attribution before approval, stale-text rejection, reviewed publication afterward, contact privacy, audit creation and unchanged financial totals/status. Six admin component tests pass, including the new queue and version submission. API/admin type-check pass; API/admin lint pass with one admin hook warning.

Remaining before calling this complete: additional staff/auth/closure race coverage, additional legacy/author lifecycle coverage, further author/guest review lifecycle feedback, audit-evidence retention review, remaining full-release checks and operational evidence. Campaign fiat/crypto donor names/messages and live content still need their own admission flows. No external moderation provider, payment or production migration was invoked.


Approved-version binding: approval now persists a fingerprint covering creator, supporter identity (or guest), name, message, anonymity and suppression/revocation state. Repository projections and public message reporting require a matching current fingerprint. A later content change cannot inherit an earlier approval. Legacy approved flags without a fingerprint are private and included in the pending queue. Stale approved rows are shown as pending when inspected in the approved queue and may be reviewed again against their current version; automatic repair into the pending queue remains to be addressed for out-of-band edits.

The real HTTP/Mongo tests cover post-approval name edits becoming private, missing-fingerprint legacy handling, rejection without payment mutation and transaction rollback if the audit cannot be saved. The final four-file regression passes all eight tests after adding creator/supporter identity to the fingerprint. API type-check and lint pass.


Review feedback and staff discovery: reference-bound payment verification now returns only the public-content review status (not the submitted text, email or review notes). Web and Expo-web confirmation distinguish paid status from pending, approved and declined content; declined feedback provides the support address and payment-reference instruction. The action center counts the same pending/legacy settled-tip filter as the review queue and links directly to its selector. The admin page honors that link.

Verification: ten API tests, five web confirmation tests and seven admin review tests pass. These include pending/approved feedback, no donor email in confirmation, correct action-center count/link, and the admin queue opened through its query parameter. API/admin/web/mobile type-check pass; affected lint passes with two hook warnings. Browser verification and final production builds remain pending.


Lifecycle and admin browser checkpoint: linked supporter erasure now removes the duplicate review notes and approval fingerprint from the tip as well as checkout credentials, preserving financial amounts/references. Audit evidence remains subject to the broader retained-record privacy review; this is not a claim of full historical audit erasure. Self-review, restricted supporter approval, closed supporter approval and demoted staff requests are rejected. Two concurrent opposing staff decisions commit exactly one decision and one audit entry.

Verification: seven API integration tests across review lifecycle and account erasure pass. The phone-width admin flow passes initial disabled approval, stale-content conflict, explicit refresh, new-version approval, no horizontal overflow and no page errors. Screenshot `/tmp/ujimora-tip-review-phone.png` inspected. Admin production build passes with the existing large-chunk warning. No external provider, live payment or production content was involved.


Public confirmation and bundle checkpoint: two phone browser flows pass, covering pending/approved/declined content with a separately confirmed payment, visible payment reference, no horizontal overflow or page errors, and the checkout lost-response/retry/terminal-key lifecycle. Pending and declined screenshots were inspected at `/tmp/ujimora-tip-review-pending-phone.png` and `/tmp/ujimora-tip-review-declined-phone.png`. All 67 mobile tests pass. The web production build and iOS/Android/web Expo exports pass (`/tmp/ujimora-tip-review-mobile-export`); web retains the existing chunk-size warning. This is mocked browser and compiled-bundle evidence, not physical-device or live-provider approval.

Next implementation gaps: keep stale/safety-modified approved tips discoverable in the pending review queue; continue campaign fiat/crypto public attribution and initial-registration/live publication coverage. The overall compliance readiness goal remains active.


Safety-removal queue handling: the application message-removal path now clears the prior content decision/fingerprint and duplicate decision notes, retains the suppression timestamp, and requeues any remaining non-anonymous public name. Anonymous tips with no remaining public text are omitted from the queue. The original safety report/audit remains the moderation evidence. Reapproving the remaining name cannot restore the removed message.

Verification: seven HTTP/Mongo safety-report and tip-review tests pass, covering anonymous/no-content exclusion, named-tip requeue, rejection of the previous fingerprint, fresh name-only approval, persistent message suppression and retained amount. API type-check/lint pass. Direct database edits outside application paths remain outside this automatic requeue path; fingerprint checks still prevent their publication.

Next: public-name-only terms acknowledgement, then campaign fiat/crypto attribution review. The full compliance readiness goal remains in progress.


Name-only acknowledgement: the API now requires current adult/content-terms acknowledgement when a tip includes a non-anonymous public name even without a message, before reserving the payment or contacting its provider. An anonymous name without a message is not treated as public content. Web and Expo-web expose the unchecked acknowledgement for either public field and send the accepted version. Other message-only forms keep their existing copy.

Verification: 11 API checkout tests, the phone browser name-only/no-request-before-acknowledgement flow, API/web/mobile type-check and affected lint pass. The browser verifies the submitted legal version and confirms no message was added. Remaining work includes campaign fiat/crypto attribution admission and broader release/compliance requirements.
