# Campaign donor attribution admission

Status: engineering in progress. Creator-tip review is separate; campaign public attribution is now withheld without matching approval, with a staff review queue now implemented; full projection/lifecycle verification is unfinished.

## Initial path audit

| Path | Current behavior | Required change |
| --- | --- | --- |
| CreateDonationIntentUseCase | Stores submitted donor name, message, anonymity and message agreement on the payment intent | Require acknowledgement for name-only public content and expose review expectations on fiat/crypto forms |
| SettleDonationUseCase | Shared by wallet, hosted payment and crypto settlement | Preserve the exact submitted attribution and agreement independently of later profile edits; implemented below |
| ListRecentDonationsUseCase | Resolves current account name; guest label is generic | Use reviewed attribution with current identity visibility rules |
| ListCampaignDonationsUseCase | Resolves current account name and publishes stored message | Require reviewed snapshot for name/message, preserve amounts and donor privacy |
| OutboxDispatcher / RealtimeDonationProjector | Rebuilds message from persisted donation before projection | Project only admitted public attribution; retain live-session financial statistics |
| RealtimeController | Rebuilds each donation frame from current persisted record | Enforce approval before emitting current name/message on live or replayed frames |
| GetLiveSessionOverlayUseCase | Applies visibility and host privacy choices to donation snapshots | Add admission check without weakening host privacy |
| GetDonationUseCase / ListMyDonationsUseCase | Authenticated donor-only history/detail | Preserve private donor access; public review denial must not erase financial history |
| Staff review / guest feedback | Campaign-specific attribution review not implemented | Add exact-version review, staff authorization, audit, status feedback, exports and lifecycle tests |

## Settlement snapshot checkpoint

Donation records now retain the submitted donor name and timestamped message agreement alongside the existing message and anonymity fields. The shared settlement use case copies these from the settled intent. Repository mapping round-trips the snapshot; it does not look up or substitute a later profile name. No donor email is added to the donation record. This change does not yet make the snapshot public or constitute content approval.

Three real Mongo-backed settlement tests cover wallet, Paystack and Bitnob inputs with mocked financial collaborators and no provider calls. They verify the exact submitted attribution/agreement, preserved amount, guest identity, no added donor email and one journal/projection invocation. The 18-test settlement verification regression, API type-check and API lint also pass.

Remaining: campaign public read admission, staff review and feedback, name-only terms, fiat/crypto browser/native flows, historical snapshot treatment, erasure and provider/release evidence. Public content review must not mutate payment status, ledger entries or campaign totals.


## Public admission gate checkpoint

Donation records now carry pending/approved/rejected state and an approval fingerprint bound to campaign, donor, submitted name, message, anonymity and suppression timestamp. Public entity accessors expose only matching approved content. Recent donations and campaign history use the reviewed name snapshot instead of the current profile name, withhold unreviewed donor IDs, and omit profile avatars that were not part of this review. The donor-only detail/history paths retain their private message access.

Overlay snapshots, outbox dispatch and SSE delivery now use the same approval requirements for names/messages while retaining amounts, totals, privacy toggles and current restricted/closed/blocked identity checks. The public message-report route refuses unpublished messages. All new/legacy records without matching evidence are withheld; this is not an approval migration.

Verification: four real Mongo/HTTP tests pass across settlement snapshots and the new public/private boundary fixture. The latter verifies pending-name suppression, donor-private message access, reviewed snapshot display, no inheritance of a later profile name, withdrawal after a message edit and unchanged donation/campaign financial values. API type-check and lint pass. Staff approval is seeded explicitly in this fixture; the staff endpoint was added and verified in the following checkpoint. Existing public-feed/SSE fixtures require reconciliation to the new reviewed-snapshot contract before the full regression can be claimed.

Next: implement the staff queue and exact-version decision flow, wire feedback and terms controls, and verify campaign history/SSE/overlay/privacy regressions with explicit approved fixtures. Leaderboard/account identity admission remains a separate broader requirement.


## Staff campaign donor review checkpoint

`/admin/donation-content-reviews` now lists public name/message proposals from settled donation records, excludes revoked attribution, and exposes neither donor email nor payment credentials. Staff decisions bind the full attribution fingerprint and recheck current administrator role/credential version transactionally. Donors and campaign owners cannot review their own attribution; linked closed/restricted donors cannot be approved. Decision and audit commit together without changing financial values. Account erasure revokes donation attribution and removes duplicate review notes/fingerprint while retaining the financial record.

Admin Publication reviews has a Campaign donor names and messages queue with its existing export controls; the action-center count uses the same queue filter and links directly to it. The reviewed snapshot, not a later profile name, becomes eligible for public reads.

Verification: eight API integration tests pass across the campaign review boundary, tip review and account erasure; eight admin component tests pass including direct queue links. API/admin type-check and API lint pass. Campaign review is now exercised through HTTP rather than seeded database approval. Remaining: full campaign review authorization/race tests, public/guest feedback and terms, stale/safety queue lifecycle, reviewed projection fixtures/SSE/overlay regressions, browser/export checks and final release evidence.


## Review lifecycle verification

Campaign donor and owner self-review, restricted donor approval, erased donor approval and demoted staff requests are denied. Audit persistence failure rolls back approval. Concurrent opposing staff decisions produce one committed decision and audit, retaining the campaign total. Safety removal now clears campaign attribution approval/duplicate decision metadata and queues the remaining public name; a fresh name-only approval preserves the removed-message timestamp and never restores the text.

Five lifecycle/report tests passed initially; the final three-test campaign lifecycle suite also passes with explicit report/removal/requeue/reapproval coverage. API type-check and lint pass. Existing public donation fixtures now have an explicit reviewed-content helper for upcoming projection regressions. Remaining: SSE/overlay/outbox/REST regression reconciliation, donor terms/status feedback, browser/build/export and broader compliance work.


## Live projection regression checkpoint

Public projection fixtures now distinguish newly settled, unreviewed donations from explicitly reviewed attribution. Registered aliases use the reviewed snapshot without a profile-name/avatar lookup. The real wallet/live-session flow verifies updated financial totals with anonymous/no-message events and overlay output until review. Reviewed SSE snapshots still honor current blocks/restrictions, host privacy controls, campaign identity and field allowlisting. A new replay test changes the reviewed message after an event was buffered and verifies the replay contains neither name nor message while retaining its actual amount.

All 27 tests across guest feed projections, live-session integration and the real HTTP SSE gateway pass. The initial run found an outdated event-bus name assertion; it was updated to require withheld unreviewed identity, with message suppression asserted too. No source implementation was changed to satisfy that assertion. These are local fixture/provider-mock tests, not production or physical-device verification.

Next: campaign donor name-only terms, review-status feedback on fiat/crypto confirmation, further privacy/legacy fixtures and browser/release verification.


## Public name acknowledgement checkpoint

Fiat and crypto campaign donation creation now require current explicit content/adult acknowledgement when a public donor name is supplied without a message. Anonymous name-only submissions remain exempt; anonymous public messages still require acknowledgement. The shared check runs before payment lookup/reservation or provider calls and records accepted terms with the intent. Web and mobile donation forms expose the acknowledgement for public names, and both crypto components guard address creation independently of fiat form submission.

Verification: nine API tests pass, covering missing/stale acknowledgement, anonymous-name exemption, anonymous messages, fiat pre-reservation rejection and retained acceptance, and crypto pre-provider rejection. Three browser tests pass: phone and desktop crypto flows reject name-only address requests before acceptance, send the current acceptance after checking, and retain the server-disabled rail gate. API/web/mobile type-checks and affected-source lint pass. Logs: `/tmp/ujimora-donation-name-{tests,browser,api-types,web-types,mobile-types,lint}.log`.

Remaining: fiat browser and native runtime consent coverage, accepted crypto settlement snapshot regression, review-status feedback on fiat/crypto confirmation, legacy terms policy in staff approval, campaign queue browser/export verification and final broader compliance/release evidence. These checks do not constitute provider, store or legal approval.


## Donation confirmation review-status checkpoint

Public polling and hosted verification now resolve the settled donation through the ledger's intent-to-donation link, check matching campaign/donor, and return only a review-status enum alongside the existing payment projection. Approval uses the current content fingerprint, changed text reports pending, revoked/empty attribution reports not requested, and a missing/mismatched linked record reports unavailable. Submitted name, message, email, review notes and payment credentials are not included. Web fiat and crypto confirmations and the mobile payment status component display review feedback separately from payment success; mobile also refreshes an already-settled wallet handoff once.

Verification: 19 API unit/verification-chain tests, eight web confirmation component tests and three phone/desktop crypto browser tests pass. API/web/mobile type-checks and affected lint pass. The first component run found three ambiguous text selectors (both payment and review copy correctly say confirmed); selectors now target the payment heading. No production implementation was changed for those failures. Logs: `/tmp/ujimora-donation-feedback-{tests,web-tests,browser,api-types,web-types,mobile-types,lint}.log`.

Remaining: fully wired Mongo/HTTP review-status linkage and provider settlement coverage, native runtime feedback/consent tests, fiat browser consent, legacy terms approval policy, status refresh after later staff decisions, campaign queue browser/export checks and the broader requirement ledger. Local status fixtures are not external provider/store verification.


## HTTP linkage and fiat consent verification

The real Express/Mongo campaign review fixture now links a settled intent to its donation through a journal entry and reads the public status endpoint before and after an actual staff HTTP decision. Pending becomes approved in both GET polling and matching-reference verification. A wrong checkout reference is denied; an edited message returns pending; revoked attribution returns not requested; removing the linkage yields unavailable while preserving succeeded payment and amount. Public status output contains no submitted alias/message/email, private key or review notes. Polling now sends `Cache-Control: private, no-store`, matching verification.

Four API integration tests pass (the HTTP review lifecycle plus wallet/paystack/crypto snapshot preservation). Two phone browser fiat flows pass: public name-only checkout stays disabled until explicit acknowledgement; anonymous name-only checkout is allowed without public-content acknowledgement, and the submitted payload reflects that distinction. API type-check and affected controller lint pass. Logs: `/tmp/ujimora-donation-feedback-http.log`, `/tmp/ujimora-donation-feedback-http-types.log`, `/tmp/ujimora-donation-feedback-http-lint.log`, `/tmp/ujimora-donation-fiat-consent-browser.log`.

The HTTP fixture seeds the settlement link; a real provider is not contacted. Remaining: real settlement-to-feedback linkage across provider test flows, native runtime coverage, legacy approval terms, later-decision status refresh, campaign queue export/browser checks and the full compliance release audit.


## Settlement-to-feedback and staff browser evidence

Actual local wallet settlement and Paystack/Flutterwave/crypto test-provider webhook flows now assert that the ledger link produced during settlement resolves to pending public-content review. The public response excludes submitted name/message/email. Hosted checkout fixtures were updated to explicitly accept current public-name terms, preserving their existing disabled-provider, signature, mismatch, accounting and duplicate-settlement assertions.

Across the four integration files, 28 tests passed initially and one disabled-Paystack fixture failed because it lacked the newly required name acknowledgement (428 instead of the intended provider-disabled 501). After correcting that fixture, all seven donation-intent tests passed; the other three files had already passed their 22 tests. This provides 29 passing checks across those final file states, not a full API sweep. Logs: `/tmp/ujimora-donation-settlement-feedback.log`, `/tmp/ujimora-donation-wallet-feedback-final.log`.

The phone admin browser flow now runs for both supporter-tip and campaign-donor queues: a stale decision receives 409, refresh loads changed content, the next decision submits its new version, and the queue empties without horizontal overflow or browser errors. Both tests pass; the campaign-donor screenshot was inspected at `/tmp/ujimora-donation-content-reviews-phone.png`. Log: `/tmp/ujimora-donation-admin-review-browser.log`.

Remaining: native runtime coverage, legacy terms approval policy, later-decision status refresh, campaign queue download validation and the full release/compliance audit. Provider behavior here is mocked; no live payment or store approval is implied.


## Campaign donor queue export verification

A browser test downloads CSV, Excel and PDF from the selected campaign donor queue using 26 records behind the endpoint's 25-row pagination. Each format fetches the second page while retaining `status=pending`; CSV contains the last donor/message and Excel contains all 26 data rows with the last reference/text in the expected columns. The PDF contains the last donor/message, selected queue/status and five numbered pages.

The final browser test passes. Initial test setup lacked the review page's report permissions; after fixing that, a CSV assertion incorrectly expected report metadata rather than its deliberately tabular format. Both were fixture/assertion corrections, not production permission or CSV changes. Browser log: `/tmp/ujimora-donor-exports-browser.log`.

Poppler inspection confirms embedded Outfit Regular/Bold and A4 landscape. All five rendered pages were viewed: forest/gold Ujimora branding, chain logo, subtle watermark, repeated table headers and confidential numbered footers are present. Some long table rows continue onto the following page; content remains present. QA PDF: `/tmp/ujimora-donor-review-export.pdf` (synthetic donor data only). This is a queue-specific export check, not a new full-dashboard regression.

Remaining: native runtime coverage, legacy consent approval handling, later-decision status refresh and the broader compliance/release ledger.


## Later review decisions and retry

Web fiat/crypto success screens now offer Refresh content review through a shared component keyed to the payment intent. The refresh reads public status without starting a checkout or re-verifying hosted payment. Pending, approved and declined updates leave payment confirmation intact. A failed read withdraws the stale review label, reports unavailable and offers retry; it does not turn a successful payment into a pending/failed one. The mobile success component has the same refresh control and clears stale review feedback on a failed request.

Nine web confirmation tests pass, including pending-to-approved, request failure with payment success retained, retry-to-declined and no extra hosted verification. Three crypto phone/desktop browser tests pass, including later approval with exactly one deposit creation. Web/mobile type-checks and affected lint pass. Logs: `/tmp/ujimora-donation-review-refresh-{tests,browser,web-types,mobile-types,lint}.log`. Mobile runtime verification remains open; these checks establish source/type coverage there only.

Next: native donation consent/feedback runtime coverage, legacy approval consent policy and the remaining full compliance/readiness requirements.


## Mobile payment lifecycle isolation

`PaymentStatus` now owns its payment identity key (payment ID, reference and top-up mode), so callers that omit a React key cannot retain a previous payment's state, completion marker or in-flight response. An older response is discarded on unmount. Two component lifecycle tests execute the actual status component with mocked native rendering and API: settled wallet status loads on mount, pending review can refresh, failure removes the old review label without losing financial success, retry shows approval, completion fires once, and switching targets rejects a late previous approval.

All 69 mobile tests across 17 files pass, mobile type-check and affected lint pass, and Expo exports for iOS/Android/web complete at `/tmp/ujimora-donation-review-mobile-export`. Logs: `/tmp/ujimora-mobile-payment-status-{tests,full,types,lint}.log`, `/tmp/ujimora-donation-review-mobile-export.log`. This is React lifecycle evidence with mocked native controls and compiled platform bundles; physical-device/OS checkout and biometric validation remain external release evidence.

Next: legacy public-content consent policy and the remaining broad compliance ledger. Native donation-form/device interaction coverage remains outstanding.


## Post-donation message edits

Audit found the authenticated `POST /donations/:id/message` path accepted new public content without acknowledgement and retained prior review metadata. It now requires explicit current content/adult acknowledgement after ownership validation, timestamps that agreement, atomically resets review status to pending, and clears the prior fingerprint/reviewer/date/notes. Blank messages are rejected. The update predicate retains the safety-hidden restriction and adds attribution-revocation protection; neither an edit nor its acknowledgement can restore removed/revoked text. The response reports pending review, and financial amount is unchanged. No active web/mobile consumer of this API editor was found in the current source search; checkout forms remain separate.

Ten API integration tests pass across donation intents and message reports, including absent-consent rejection before mutation, accepted edit state/metadata/amount, non-owner denial and inability to restore safety-hidden content. API type-check and affected lint pass. Logs: `/tmp/ujimora-donation-message-edits-{tests,types,lint}.log`.

Policy cross-check on 2026-09-13: Google Play's [User-generated content policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB) requires acceptance of terms/user policy before users create or upload user-generated content, alongside prohibited-content standards and moderation. This check supports acknowledgement before a new post-donation message; it does not establish that historic records must accept every later terms version retroactively. Legacy treatment still needs explicit evidence/policy reconciliation.
