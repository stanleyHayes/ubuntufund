# KYC review integrity — open engineering gap

Audit: 13 September 2026. Status: NOT COMPLETE. This source audit is separate from document authenticity, legal due diligence and provider approval.

## Confirmed current behavior

- `ApproveKYCUseCase` reads a pending/in-review record, reads its user, validates adult date of birth for identity, then calls `kycRepo.update` and `userRepo.update` separately. `app.ts` constructs it directly without a unit-of-work wrapper. A failure between these writes can leave an approved record without the corresponding verification level.
- `RejectKYCUseCase` also reads status then saves separately. `MongoKYCRepository.update` matches only the record ID, so it does not reject a competing decision committed after that initial read.
- Approval takes an administrator ID but has no own-applicant check in the use case. HTTP authentication/requireAdmin exists; final-write current-role/account fencing is not implemented in this path.
- `SubmitKYCIdentityUseCase` checks for an existing active submission before inserting. The model's user/type/status index is not unique, so concurrent requests are not serialized by this check.
- The repository's pending queue selects only `pending`, while decision use cases also accept `in_review`. Before introducing a persistent Request More workflow, its queue and applicant response semantics must be implemented together.
- The admin save-feedback correction is implemented and tested separately. It does not repair these backend consistency gaps.

## Required implementation and evidence

1. Commit review decision, verification-level change and immutable decision audit in one transaction; a failed user or audit write must roll back all changes.
2. Bind decisions to a reviewed version/current state. Two conflicting decisions must yield one committed decision and a conflict, not two successful responses.
3. Recheck current administrator credential/account state and applicant state at the transaction write boundary. Prevent reviewers approving their own application and avoid replaying stale user fields into the account.
4. Serialize active submission creation without losing historical records. Prove concurrent submissions create one active application, with the other returning a useful conflict.
5. Add durable information requests with explicit question/reason, applicant-visible response path, controlled resubmission, review history and queue inclusion. Never mark a request as sent without actual delivery evidence; in-app availability and external delivery are distinct.
6. Verify HTTP authorization, concurrent approve/reject, account closure/demotion races, audit failure rollback, missing/invalid document and age evidence, and requester privacy. Preserve financial references and existing valid verification history.

The full API regression was live during this read-only audit (exec session 81527, log `/tmp/ujimora-compliance-api-regression.log`). No API/shared implementation was changed while it ran. Resume by polling that same session to terminal, reconciling its final failures, then implementing this gap with focused transactional tests. No KYC release-readiness claim follows from the current UI checks.


## Transactional review checkpoint

The HTTP approve/reject entry points now invoke `MongoKYCReviewTransaction`, enlisting the existing review and user repositories through MongoUnitOfWork. Staff role/current credential/account and applicant account are fenced with actual writes inside the transaction, self-review is denied, and current pending/in-review state is checked. Decision, verification-level update and a decision audit commit together. Mongo transaction conflicts retry against current state, so a competing finalized decision returns 409. The audit excludes document content and ID numbers.

Six tests across existing KYC HTTP flows and the new integrity suite pass. The new tests inject audit failure and verify both approval and verification level roll back, then retry successfully with one audit. Concurrent approve/reject yields one success, one conflict and one audit. Self-review and closed-applicant approval are denied. API type-check and affected lint pass. Logs: `/tmp/ujimora-kyc-transaction-tests.log`, `/tmp/ujimora-kyc-transaction-final-types.log`, `/tmp/ujimora-kyc-transaction-lint.log`.

The initial source observations above describe the pre-wrapper gap and remain as audit history. Remaining: explicit mid-flight demotion/closure race evidence, narrowed verification-level persistence, reviewed-version handling for future editable requests, active-submission serialization, durable information requests, document-evidence acceptance and full release regression. Direct use-case calls outside the HTTP wrapper are not claimed to have this transaction; current production composition routes decisions through the wrapper.


## Active-submission serialization checkpoint

The shared persistence helper is now named `MongoKYCWorkflowTransaction` and also wraps the identity submission endpoint. It writes the current applicant row with credential/account checks before the existing active-submission lookup and insertion, within one Mongo transaction. Concurrent submissions for an account conflict on that row, retry against current data, and the losing request sees the active application. Review transitions and account closure coordinate through the same applicant write boundary. This does not add a destructive migration or delete historical applications.

Seven KYC integration tests pass. The new HTTP race test submits twice simultaneously, obtains one 201 and one 409, and verifies exactly one record. After an actual staff rejection, a new submission succeeds and both the rejected history and single new pending record remain. The initial test used a date-only string where this endpoint requires an ISO datetime; the fixture was corrected before verifying the race. API type-check and affected lint pass. Logs: `/tmp/ujimora-kyc-submission-{tests,types,lint}.log`.

This protects current production HTTP submission paths. Direct database writes are not made safe by a unique active-record index, and historical duplicate reconciliation is still an operational check. Durable request-more/applicant-response behavior, document evidence rules, additional mid-flight closure/demotion tests and final full regression remain open.


## Narrow account promotion

Approval now calls `UserRepositoryPort.raiseVerificationLevel` instead of reconstructing and saving a whole UserEntity. Mongo uses a current non-deleted account predicate and `$max` for verificationLevel, so a lower approval level cannot demote the account and unrelated credentials, terms acknowledgement, trust score, website consent and approved campaign limit are not rewritten. A missing/closed account makes approval fail inside the existing transaction.

Eight KYC integration tests pass, including the prior rollback/concurrency/submission checks and a new persistence check proving no demotion, preservation of unrelated fields and denial after closure. The initial assertion compared hydrated Mongoose subdocuments and their parent metadata; lean snapshots now compare actual stored values. API type-check and affected lint pass. Logs: `/tmp/ujimora-kyc-narrow-write-{tests,types,lint}.log`.

Remaining: durable request-more/applicant-response workflow, explicit document acceptance evidence, mid-flight role/account race tests and final full regression.


## Durable information-request API checkpoint — 2026-09-13

Staff can PUT `/kyc/:id/request-info` with a 20–2000 character prompt. The existing current-staff/current-applicant transaction commits the request, in-review status and audit together. Only one unanswered request is allowed; approval is refused while one remains unanswered. Requests have opaque IDs, timestamps and a preserved response history. The API describes availability in the applicant account, not an email delivery.

Applicants can POST `/kyc/:id/respond-info` with the request ID, response and up to ten private document references. Ownership, current account/session and unanswered-request status are rechecked in the transaction. Documents must belong to that applicant and remain available. An accepted response returns the application to pending and commits an audit without including prompt, response or private document content. Applicant status and staff queue responses use private/no-store caching; the queue includes in-review applications.

Ten integration tests across both KYC suites pass, including request persistence, applicant-only visibility, queue inclusion, duplicate request rejection, approval blocked until response, wrong-account/stale response rejection, missing/foreign/deleted document rejection, accepted owned attachment persistence, one winner for concurrent responses and audit-failure rollback for both request and response. API type-check and affected lint pass. Logs: `/tmp/ujimora-kyc-information-{tests,types,lint}.log`. Expanded document checks passed on the final run; all sessions are terminal.

This is an API checkpoint, not end-to-end completion. Next connect the staff prompt/history UI and applicant response/upload UI in web `KYCPage.tsx` and native `app/verification.tsx`, including refresh, save failure and stale response handling. The admin Request action still intentionally reports unavailable until that connection is implemented. Additional reviewed-version fencing for a staff screen left open across an applicant response, explicit document-evidence acceptance, mid-flight role/account races and final regression remain. Information exchanges are currently retained with KYC evidence under the existing review-required account-erasure process; their retention/legal-hold schedule still needs the wider retention audit and owner approval.


## Staff and applicant screens checkpoint — 2026-09-13

Admin Request/Request More now opens a required 20–2000 character prompt dialog and calls the persistent endpoint. Failed saves retain the draft; confirmed saves update status/history. The detail dialog displays request and response history, disables repeat requests and approval while awaiting a response, and retains rejection. Refresh queue reloads current server data, including replies from applicants. The previous unavailable action is replaced.

Web `/kyc` now loads verification requests with an explicit load-error/retry state, shows history and accepts a response plus up to ten typed private uploads. Native verification cards expose the same history/response and private camera/library/document uploader with upload/save busy controls. Both keep failed responses editable, send the request ID and private references, and refresh after confirmed saves. Closed/answered requests offer no response form. The native list now labels the information-requested state and offers a refresh control.

Evidence: two focused component tests each for admin, web and mobile (six total) pass, covering confirmed saves, preserved error drafts, private-reference payloads, empty attachment blocking, history/closed requests and load retries. Admin/web/mobile type-check and affected lint pass. Phone browser tests pass for applicant response/history, staff request/history after refresh and the existing failed-decision/retry regression. Web screenshot inspected; staff history uses the dialog's scrollable content. Logs `/tmp/ujimora-kyc-request-{admin,web,mobile}-tests.log`, corresponding `*-types.log`, `/tmp/ujimora-kyc-request-{ui,mobile}-lint.log`, and `*-browser.log`. Browser APIs are deterministic local fixtures; native component tests mock native controls, and no physical-device/provider delivery claim follows.

Next: bind staff decisions to the exact reviewed application version so a browser left open before an applicant reply cannot approve unseen updated evidence. Then continue explicit evidence acceptance, mid-flight role/account races, retention/legal-hold mapping, final full regression/build/export and external release requirements. New initial-submission UI remains visible on web alongside history; backend still prevents duplicate active submissions. The wider compliance goal and commit/push remain pending.


## Reviewed application version checkpoint — 2026-09-13

The private staff queue now includes a SHA-256 reviewVersion derived from the complete persisted KYC application projection, including documents, personal/business evidence, status and information exchanges. Approve, reject and request-info require that version. Missing versions return 428; a mismatch inside the existing current-staff/current-applicant transaction returns 409 with an instruction to refresh and review the latest evidence. The audit records the accepted version. This is not a timestamp-only check or a client-generated declaration of approval.

The KYC admin page submits the version from the selected review/queue record. The alternate Verifications page also submits the version; its prior swallow-error optimistic update was removed, so failed decisions remain pending with a visible error and refresh control. Old clients that omit the version fail closed and must refresh/update. A request saved from a local queue makes that prior version stale, so further decisions require a current queue read.

Eleven KYC integration tests pass. The new HTTP queue test proves missing-version denial, stale approval/rejection/request denial after an applicant response, no decision audit on rejection, rejection after an evidence edit that preserves timestamps, and success plus matching audit after fetching the current version. Existing concurrency, rollback, private attachments and account constraints remain passing. Three admin component tests pass, including alternate-page failure preservation. Two phone browser tests pass for stale-review conflict/refresh/current-version retry and information-request/history behavior. API/admin type-check and affected lint pass; all focused sessions are terminal. Logs: `/tmp/ujimora-kyc-version-{api,admin}-tests.log`, corresponding types logs, `/tmp/ujimora-kyc-version-browser.log`, `/tmp/ujimora-kyc-version-lint.log`.

This binds the application record at the transaction boundary. It does not prove document authenticity, human inspection, external provider verification or immutable storage at an upstream media provider. Next audit explicit document-evidence acceptance and current private-document availability, then remaining mid-flight role/account races, retention/legal-hold mapping and the full release regression. The broad Ghana/store compliance goal remains active; no legal certification or external approval is claimed.


## Current private-document write boundary — 2026-09-13

Approval now rechecks every attached reference inside the KYC transaction. Each unique, sorted private document ID must still be registered to the applicant and not withdrawn; an actual registry write coordinates with concurrent withdrawal/deletion. Legacy public URLs, missing entries, foreign ownership and withdrawn entries fail approval with 422 and leave the application/account unchanged. Initial identity submission and information-response attachments also acquire this document write boundary inside their transactions. Rejection and requests for replacement evidence remain possible when old evidence is unavailable.

Thirteen KYC integration tests pass. Added cases prove denial for legacy/missing/foreign/withdrawn references, rollback of earlier document locks when another reference fails, successful available owned references, and a deterministic withdrawal after reading the application snapshot but before acquiring the document write. The latter conflicts/retries and denies approval with no decision audit. API type-check and affected lint pass. Logs `/tmp/ujimora-kyc-document-fence-{tests,types,lint}.log`; all sessions terminal.

This proves local registry ownership/availability at decision commit, not provider existence, authenticity, human inspection or liveness. A later authorized retention deletion does not retroactively undo a prior valid decision. Minimum identity-document evidence and selfie type separation are still open, as are provider and retention requirements. See `RFI_KYC_APPLICABILITY.md` for newly rechecked Bank of Ghana primary sources, conditional applicability and the distinction between opt-in device authentication and regulated identity checks.

## Minimum identity evidence and selfie classification — 2026-09-13

`selfie` is now a separate shared document type accepted by the persistence schema and both KYC submission/response validators. Web/native initial submissions and additional-information upload selectors use it. Existing stored passport records are not automatically rewritten: a label alone cannot establish whether an older asset is a passport or a selfie, and historical content needs authorized inspection.

Identity approval now requires a nonblank applicant full name and at least one ID-card/passport/driving-licence reference, in addition to the existing valid adult birth date, current private ownership/availability, reviewed-version and account constraints. An empty document list, address-only evidence or selfie-only evidence fails approval with 422, without raising the account level. This is a structural product prerequisite, not a claim that every listed document is valid for every regulated Ghana transaction. Submission can remain pending with incomplete evidence so staff can request additional private documents. Missing/incorrect immutable personal details currently require rejection and a corrected new submission; response text does not silently rewrite those fields.

The web wizard now checks full name/ID number, front/back uploads and selfie before advancing/submitting, matching the existing native wizard. The success copy points to profile status instead of promising notification delivery. The API remains authoritative at approval.

Evidence: 14 integration tests pass, including HTTP selfie persistence, rejection of absent/selfie/address-only evidence, no verification-level change on denial, typed additional attachments through an information response, a blank-name denial and approval after a complete record. Existing review fixtures now contain owned private ID references. Three web tests include the real wizard steps with mocked date/uploader/location controls, missing-upload blocking and exact typed submission payload. Six mobile tests include payload classification and response/history regressions. API/web/mobile type-check and affected lint pass. Logs `/tmp/ujimora-kyc-evidence-tests.log`, `/tmp/ujimora-kyc-evidence-{web,mobile}-tests.log`, corresponding `*-types.log`, `/tmp/ujimora-kyc-evidence-lint.log`. Physical identity authenticity/liveness and provider acceptance remain unverified.

Next: applicant rejection reasons and correction guidance, explicit staff evidence-review decisions, accurate initial ID-type selection, legacy passport/selfie inspection, other verification-type evidence requirements, mid-flight account/role races and final release checks. Preserve the full compliance scope and external gates described by `RFI_KYC_APPLICABILITY.md`.


## Applicant rejection reasons and correction path — 2026-09-13

Rejection now requires a trimmed applicant-facing reason of 20–1000 characters. Both admin verification pages use the same reason dialog, clearly distinguish it from internal notes, preserve drafts on save errors and update status only after confirmation. Current reviewed-version and account/transaction gates still apply. The previous generic reason fallback is removed for new decisions.

The private applicant status DTO exposes rejectionReason only for rejected records and continues to omit reviewNotes/reviewedBy. Web displays the reason even when there is no information-request history, with corrected-submission guidance; if another application is already pending, it explains that instead. Native status mapping now carries the reason into the existing rejection display and provides a corrected-application button only when no pending/in-review application exists. Historical missing reasons display neutral contact-support guidance rather than inventing a reason.

Fifteen KYC API integration tests pass, including missing-reason denial with unchanged status, applicant-only reason visibility and exclusion of internal notes/reviewer identity. Five admin tests cover both pages' reason entry, failure drafts and confirmed retry. Four web tests include rejection/correction guidance; two native screen tests prove DTO-to-screen mapping, corrected-application navigation and suppression of duplicate-submission guidance. Native controls are mocked: initial DOM style-array failures were fixed in the test wrappers, not by weakening product behavior. API/admin/web/mobile type-check and affected lint pass. Phone browser reason-entry/save flow passes and the screenshot was inspected. Logs `/tmp/ujimora-kyc-rejection-{api,admin,web,mobile}-tests.log`, corresponding types logs, `-lint.log`, `-browser.log`; all sessions terminal.

Remaining KYC work includes explicit staff evidence-review decisions, initial ID-type selection, historical identity/selfie classification, other verification-type evidence requirements, further current-role/account race evidence and release regression. The regulated/provider/retention gates and full compliance objective remain open; this is not legal certification.


## Initial identity-document type selection — 2026-09-13

Web and native initial KYC forms now offer the same shared national-ID/passport/driving-licence options and persist the selected document type. Passport entry asks for the photo page and does not require or submit a back image. Card/licence entry keeps the front/back requirement. Changing the type clears the previous ID images and selfie; selecting the same type preserves the draft. Native type selection and web type/back/next/submit controls are disabled during uploads so pending uploads cannot be retagged through navigation. The web upload counter is released on both success and failure.

Three web wizard tests pass for ID card, passport and driving licence: each checks required evidence, type changes, removed passport-back controls and the exact final typed payload including a separate selfie. Five native draft tests pass, including passport-only payloads, stale-back exclusion and clearing old ID/selfie evidence on type changes. Web/mobile type-check and affected lint pass. Logs `/tmp/ujimora-kyc-id-type-{web,mobile}-tests.log`, corresponding types logs and `/tmp/ujimora-kyc-id-type-lint.log`; all sessions terminal. The web tests mock date/upload/location controls, and native tests exercise the draft contract rather than a physical device.

This corrects evidence classification and collection UI. It does not authorize every displayed ID type for every regulated financial transaction; the conditional provider/regulatory policy remains in `RFI_KYC_APPLICABILITY.md`. Remaining: explicit staff evidence-review decisions, historical image classification, non-identity verification evidence requirements, further role/account race evidence, final native/browser/build/regression and the wider compliance/release ledger.


## Explicit staff evidence-review declaration — 2026-09-13

Approval requires evidenceReviewed=true and internal review findings of at least 20 characters (HTTP maximum 2000). The application stores the findings with the existing reviewer/date; the approval audit records that the staff member attested to reviewing evidence, alongside the exact reviewed version. Missing/false confirmation or inadequate findings fails with 422 and leaves status, account level and decision audit unchanged. Applicant status does not expose these internal findings.

The main queue's summary action opens the full review details rather than sending approval. The detail view requires a checkbox and findings before enabling approval; pending applicant responses continue to block it. Inputs reset when the record/version changes, and reopening after a queue refresh requires a fresh declaration. The alternate Verifications page links to the specific application in the full review queue; it no longer has a direct approval mutation. Rejection still uses the shared applicant-reason dialog. Queue search/export filtering now both include application IDs so this direct link does not silently empty the export.

Sixteen KYC API integration tests pass, including missing/false/short declaration denial, unchanged level/status, persisted findings, approval-audit declaration and exclusion from applicant status. Five admin component tests pass for full-review gating/failure retry, request/rejection behavior and the alternate-page review link. Four phone browser flows pass: save failure/retry, stale-version refresh/reconfirmation, information-request history and rejection reasons. The stale-review flow also passes through the application-ID link. API/admin type-check and affected lint pass; final copy/export-filter lint passes. The error-state phone screenshot was inspected. Logs `/tmp/ujimora-kyc-attestation-{api,admin}-tests.log`, corresponding types logs, `-lint.log`, `-final-lint.log`, `-browser.log`, `-link-browser.log`. All sessions terminal.

This records a named staff declaration; it does not prove the human inspected an image, establish authenticity or substitute for regulated identity/liveness checks. Remaining KYC scope: non-identity evidence policy, legacy image classification, further current-role/account race evidence, private-media production/provider evidence and retention. Continue the full compliance/release ledger and final regression rather than treating this review gate as legal certification.


## Authentication-to-transaction revocation races — 2026-09-13

Fourteen deterministic HTTP interleavings were added without changing production authorization behavior. After successful HTTP authentication/role checks but before the KYC transaction begins, the tests revoke the staff role, close the staff account, rotate staff credentials or close the applicant account. Each of approve/reject/request-info is refused: staff revocations return 401, applicant closure returns 409. Status, verification level, information requests and decision audit remain unchanged. Applicant response tests similarly close the account or rotate credentials after authentication and verify 401 with no saved response or response audit.

The gate pauses the real workflow entry point; it does not replace the database/authentication logic. Each case resumes and restores the spy even on failure. These tests cover revocation before the transaction write boundary, not every possible ordering after a write lock has already been acquired. The earlier private-document test covers a separate mid-snapshot withdrawal/retry ordering.

All 30 integration tests across both KYC suites pass and API type-check passes. Logs `/tmp/ujimora-kyc-authorization-race-{tests,types}.log`; sessions 67364 and 36092 are terminal. No production change was needed for these tested interleavings.

## Next confirmed evidence-policy gap

Current `ApproveKYCUseCase` applies full-name/adult-DOB/ID-reference requirements only to identity. Its other branches still promote address to National ID level, business to Institutional level and political/media to Community level after the generic declaration and private-reference checks, even when their document array is empty. The current public KYC router exposes identity submission, not dedicated complete evidence workflows for these other types. This matters for legacy/imported records and organization campaign eligibility, which relies on approved business verification.

Continue by implementing justified type-specific evidence prerequisites and reviewing the privilege mapping, using actual product requirements and the conditional regulated/provider policy. Do not treat a generic checkbox or an arbitrary uploaded image as proof of organization authority, beneficial ownership, address validity or community endorsement. Historical image/provider/retention evidence and final broad release regression remain open alongside the wider compliance goal.


## Organization/address evidence minimum — 2026-09-13

The repository's `Ujimora_Legal_and_Policy_Draft_Pack_v2/08_Ujimora_KYC_AML_and_Verification_Policy.docx` was read for product requirements. It is explicitly a draft for legal review, not an approved statement of law. Its organization section calls for legal name, registration evidence, registered address and representative/ownership checks. The current record model supports only part of that evidence.

Business approval now requires nonblank businessName and registrationNumber plus a business_registration attachment, under the existing private ownership/availability, version, staff review and audit transaction. A passport alone cannot satisfy organization registration evidence. This is a minimum structural gate; registered address, authority/signatories, directors/trustees/beneficial owners as applicable, payout ownership and provider due diligence remain actionable/conditional requirements rather than being declared complete.

Address approval requires country/city plus either a correctly formatted GhanaPost GPS code for Ghana or an explicit document method with street address and a utility-bill/bank-statement reference. It no longer promotes the account to National ID level: confirming an address does not establish identity. GPS format checks do not establish that an address exists or belongs to the applicant. Evidence recency/authenticity still requires the review/provider policy.

All 32 KYC integration tests pass. New cases reject missing organization metadata and wrong evidence types without changing status/privileges, then permit a structurally complete registration record. Address cases reject missing proof, unsupported GPS-country combinations and absent document evidence; both GPS and owned-document success cases preserve the original account verification level. API type-check and affected lint pass. Logs `/tmp/ujimora-kyc-organization-address-{tests,types,lint}.log`; sessions terminal.

The complete organization submission/representative/ownership workflow remains unfinished. Political/media Community-level evidence and privilege mapping also remain open; no policy was invented for those branches. Continue those gaps, historical evidence handling and full release regression under the original compliance objective.


## Organization intake API and staff projection — 2026-09-13

`POST /kyc/business` now accepts organization registration/address, adult representative identity and authority, declared directors/trustees/beneficial owners/other controllers, a control explanation and explicit authority/accuracy declarations. It requires registration, authorization and representative identity attachment types, with owned available private file references. The transaction rechecks the active organization account, serializes duplicate active submissions, locks document availability and commits the pending application and audit together. A failed audit leaves neither an application nor document lock increments behind. No automatic organization approval or provider verification is implied.

The staff detail screen now displays the new address, capacity, declared control persons, explanation and timestamped declarations, explicitly distinguishing applicant declarations from reviewed evidence. Authorization-letter and ownership-register attachment types are supported by the persisted model and additional-information upload selectors.

Three real Mongo/HTTP integration tests pass: concurrent submissions yield one 201 and one 409; staff queue receives the persisted details while unrelated users cannot read them; missing declarations/control persons, underage representative, incorrect account role and wrong evidence types fail; foreign/withdrawn files fail; injected audit failure rolls back and permits a successful retry. The five existing admin review tests, API/admin type-checks, affected ESLint and git diff whitespace check pass. Logs: `/tmp/ujimora-kyb-intake-tests.log`, `/tmp/ujimora-kyb-admin-tests.log`, `/tmp/ujimora-kyb-intake-types.log`, `/tmp/ujimora-kyb-admin-types.log`, `/tmp/ujimora-kyb-intake-lint.log`. All associated processes are terminal.

Still required: applicant web/native business forms and correction flow; enforce the complete authority/control prerequisites on business approval including incomplete historical records; dedicated rendered evidence for the new staff section; political/media evidence policy; provider identity/ownership/payout checks and final broad regression. Current engineering evidence does not prove legal compliance, document authenticity, beneficial ownership verification or external provider/store approval. Commit and push remain pending under the full goal.


## Complete structural organization approval gate — 2026-09-13

Business approval now requires the current applicant role to be organization; legal name/type/registration and private registration evidence; registered street/city/country; adult representative name/nationality/ID number and capacity with private identity and authorization evidence; declared controlling persons with supported roles/countries and valid optional ownership percentages; an ownership/control explanation; and true authority/accuracy declarations with a valid nonfuture acceptance timestamp. These checks run within the existing current-account/document/version/audit transaction. Incomplete historical records remain pending and cannot gain Institutional privileges. Applicants must correct missing immutable information through rejection and resubmission; the new business API supports the latter, while web/native forms remain outstanding.

All 35 integration tests across KYC integrity, business intake and baseline KYC pass. Extended organization review cases reject absent address, authority, control persons, declaration, adult identity and authorization attachment; assert unchanged pending status, account level and absence of approval audit; deny a changed nonorganization role; and approve after complete evidence and role restoration. API type-check, affected lint and whitespace checks pass. Logs `/tmp/ujimora-kyb-approval-{tests,types,lint}.log`; all sessions terminal.

This is structural evidence enforcement plus staff attestation, not automated authenticity, beneficial ownership or regulatory approval. Web/native business intake, dedicated staff rendering verification, political/media policy, provider and retention work, and full release evidence remain open under the original goal.


## Web organization intake — 2026-09-13

Organization accounts now reach a dedicated form at `/kyc` with legal registration/address, adult representative identity/capacity, multiple controlling persons (up to the API limit of 50), optional ownership percentages, control explanation, private registration/authority/identity documents and optional control register. Country selectors use the existing country catalogue. Both declarations start unchecked. Upload and save activity disable form changes; changing representative ID type clears its uploaded evidence. Successful submission clears sensitive form entries and refreshes information-request history; failures preserve the draft for retry. No browser storage persistence was introduced. The verification history also displays pending, approved and expired records.

Eight focused web tests pass across OrganizationKYCForm, existing identity KYCPage and KYCInformationRequests. New tests cover explicit declaration gating, exact private payload, save failure/retry preserving entries, clearing the form after confirmed submission and underage denial without a request. Existing individual identity flows remain passing. Web type-check and affected lint pass; all sessions terminal. Logs `/tmp/ujimora-kyb-web-{tests,types,lint}.log`.

Still unverified: phone/desktop rendered organization workflow, account-route behavior under a real browser session and physical mobile behavior. Native business intake is not implemented yet. Pending duplicates remain protected by the transactional API with a visible error rather than a separate client preflight. Continue these items and provider/policy/release obligations under the original full goal.


## Organization phone browser evidence — 2026-09-13

`apps/web/e2e/organization-kyc.spec.ts` passes in Chromium at 390×844. It enters `/kyc` with an organization session, fills the real date control and organization fields, adds/removes a controlling person, performs three XHR private-document uploads, confirms declarations are initially required, observes a 503 save failure without losing entries, then retries and verifies the identical payload with distinct private registration/authorization/identity references. It checks no horizontal overflow, page errors or unexpected console errors. The API and upload responses are synthetic; this is browser integration evidence, not live-provider verification.

The run exposed a fixture-only notification count warning, resolved by returning the actual count shape. The final run is clean. Custom date picker and upload components now receive explicit disabled state during uploads/saves, supplementing the form fieldset. Full-form and viewport failure/retry screenshots were inspected: `/tmp/ujimora-organization-kyc-phone.png` and `/tmp/ujimora-organization-kyc-retry-phone.png`. The viewport screenshot shows readable declarations, visible failure feedback and reachable retry action above the navigation.

Web type-check and affected lint pass; logs `/tmp/ujimora-kyb-web-browser.log`, `/tmp/ujimora-kyb-browser-types.log`, `/tmp/ujimora-kyb-browser-lint.log`; sessions terminal. Native organization intake, desktop-specific rendered verification, dedicated staff new-field rendering and broader policy/provider/release requirements remain open.


## Native organization intake implementation — 2026-09-13

Mobile `/kyc` now selects the organization form for organization accounts. It collects registration/address, representative identity and authority, controlling persons and optional percentages, explanation, private required documents and optional control register. Existing native country selectors, date picker, camera/library/PDF uploader, branded inputs and buttons are used. Both declarations start unchecked. Upload/save activity blocks form interaction; ID type changes clear the previous ID file. The form sends `/kyc/business`, preserves entries on failure, shows inline/snackbar errors, clears the draft after confirmed success and links to `/verification` for staff requests/status. No persistent device draft storage was added.

Three new payload tests plus five existing identity contract tests pass. They cover exact document types, private URI requirements, adult DOB, declarations, absent control people and percentage boundaries. Mobile type-check and affected lint pass; sessions terminal. Initial test discovery used the wrong directory and was corrected to the repository's `src/**/__tests__/**/*.test.ts` convention before the successful run. Logs `/tmp/ujimora-kyb-mobile-{tests,types,lint}.log`.

Native screen interaction tests, signed/physical-device runs and final Expo artifact checks remain unverified. The payload tests do not prove those behaviors. Also outstanding: current status type/level mapping, dedicated staff organization details rendering, desktop web verification, political/media evidence policy and all broader provider/retention/release gates.


## Native application status labels — 2026-09-13

The native status screen previously recognized legacy level-like type names, then fell back to the account-wide `kycLevel` for current identity/address/business records. It could label unrelated records Institutional or National ID, including pending/rejected applications. Cards now name the actual evidence type (Organization verification, Address verification, Identity verification, etc.) while retaining the separate status badge. Legacy type labels remain readable without implying new privileges. No financial/account level changes were made.

Three native screen tests pass: rejection correction navigation, suppression of another submission during active review and a mixed pending business/approved address/rejected identity response with account-wide level 3. Each mixed record renders its own evidence label instead of a shared privilege level. Mobile type-check and affected lint pass; logs `/tmp/ujimora-kyb-status-{tests,types,lint}.log`; processes terminal. Native form interactions/physical-device evidence, staff new-field rendering and final release work remain open.

Additional audit candidate discovered during source inspection: approval writes an expiryDate, but the KYC status use case computes verified state from stored status only. Trace expiry processing and all entitlement consumers before claiming expired evidence is handled end to end; this observation alone does not prove every consumer is vulnerable.


## Native form interaction verification — 2026-09-13

Two organization form interaction tests pass using the real component and payload builder with mocked native controls, API and navigation. They establish unchecked-declaration submission gating, draft preservation after rejected save, identical retry payload, disabled inputs/save while pending, draft clearing only after confirmed success and navigation to `/verification`. Changing ID type removes the prior document, blocks a request until replacement and submits the new passport type accurately.

Shared native upload and date controls now accept an optional disabled prop, passed by the organization form during upload/save activity. Upload picking refuses disabled/busy requests; date confirmation cannot change the value while disabled. This supplements touch pointer blocking with actual disabled controls.

Mobile type-check, affected lint and whitespace checks pass; all sessions terminal. Logs `/tmp/ujimora-kyb-native-interactions.log`, `/tmp/ujimora-kyb-native-interactions-types.log`, `/tmp/ujimora-kyb-native-interactions-lint.log`. These tests do not verify physical camera/file-picker behavior or rendered native layouts. Device and final Expo checks, dedicated staff detail rendering, expiry consumer audit and broader policy/provider/release obligations remain open.


## Explicit verification expiry status — 2026-09-13

GetKYCStatus now derives expired state for stored approved records whose explicit expiryDate has elapsed, excludes them from current KYC status/level and exposes expiresAt. It does not overwrite the historical decision. Pending renewal then produces pending aggregate status. Native status maps expiry dates, renders an explicit Expired badge and offers renewal when no review is active; web request history displays the expiry date and renewal guidance.

Thirty-three KYC integration tests pass, including expired status/zero KYC level, preserved stored approval and a new pending renewal without deleting history. Four native status screen tests and three existing web history tests pass. The native expiry test first exposed missing badge mapping (expired was displayed as Pending); this was corrected before the successful rerun. API/web/mobile types and affected lint passed; final badge addition was exercised by the screen rerun. Logs `/tmp/ujimora-kyc-expiry-tests.log`, `/tmp/ujimora-kyc-expiry-{api,mobile,web}-types.log`, `/tmp/ujimora-kyc-expiry-{mobile,web}-tests.log`, `/tmp/ujimora-kyc-expiry-lint.log`; sessions terminal.

The high-value campaign exception already checks finite future expiry and denies missing/expired verification (`domain/services/campaignApproval.ts`). This change is not proof that every stored verificationLevel consumer honors expiry. Continue campaign limits, payout and identity/profile consumer tracing, latest-record supersession and undated legacy policy before claiming end-to-end privilege expiration. No automatic account demotion or historical data deletion was introduced.


## Automatic payout eligibility expiry — 2026-09-13

AutomaticPayoutService previously checked email and stored verificationLevel only. Its transactional selection now loads the latest identity record for individuals or business record for organizations, requires approved state and a future expiry date, and leaves missing/expired/pending/rejected evidence in manual review. It writes the applicant serialization field in the claim transaction, conflicting with account closure and KYC review/submission writes. It does not mutate historical KYC decisions or initiate transfers for denied selection.

Eight automatic payout integration tests pass. New cases establish that expired/missing evidence and newer pending/rejected evidence despite an older unexpired approval leave payouts PENDING, do not call automatic approval and do not create budget claims. Organization accounts with only personal identity stay manual; current approved business evidence permits selection. Existing concurrent claim and budget cases still pass. These tests mock the transfer approval use case and use an isolated Mongo test database, not a live provider. API types, affected lint and whitespace checks pass; logs `/tmp/ujimora-auto-payout-expiry-{tests,types,lint}.log`; sessions terminal.

Remaining: revalidate evidence at transfer approval/initiation boundaries after the selection transaction; campaign count eligibility still uses stored verificationLevel; public profile/organization badges use stored levels; manual/creator/wallet/beneficiary payout evidence policies need tracing. This selection fix does not establish end-to-end transfer authorization or global privilege expiration. Provider applicability, historical undated records, final regression and full release gates stay open.


## Automatic approval pre-reservation recheck — 2026-09-13

ApprovePayoutUseCase now invokes a required-for-automatic verification adapter after provider balance lookup and before campaign money reservation. Production wiring supplies MongoAutomaticPayoutVerification, which rechecks active owner/email/role-appropriate level and latest role-appropriate approval with future expiry. A missing adapter denies automatic approval rather than bypassing the check. Manual approval behavior is unchanged.

Thirteen tests pass across automatic payout integration, a new use-case ordering test and transfer uncertainty regression. The ordering test simulates revocation during provider balance lookup and proves no reservation, PROCESSING transition or transfer call follows. Mongo adapter tests cover initially current evidence followed by expiry and account closure. Existing automatic selection/budget tests and unknown-transfer behavior remain passing. API types, affected lint and whitespace checks pass; logs `/tmp/ujimora-transfer-verification-{tests,types,lint}.log`; sessions terminal. Provider calls are mocked.

Limit: the new read recheck is not atomic with subsequent campaign reservation/PROCESSING writes. A change after this check still needs an explicit transactional authorization boundary and regression coverage. It does not establish a global transfer-time revocation guarantee. Automatic daily budget remains consumed on a post-claim denial under the existing conservative accounting policy; no provider transfer occurs in the tested denial. Campaign limits, other payouts/public badges and remaining legal/provider/release work stay open.


## Automatic payout local authorization transaction — 2026-09-13

Automatic approval replaces the standalone verification read with a MongoUnitOfWork callback that checks current evidence, writes the owner's publicationWriteVersion to serialize account/KYC changes, reserves the campaign balance and transitions the payout to PROCESSING with its reference. All local writes commit or roll back together. Provider initiation runs only after that transaction returns; provider calls cannot repeat inside transaction retries. Automatic batching is refused explicitly (normal automatic selection already caps the amount below the transfer ceiling). Manual payout and batching paths retain their existing behavior.

Fourteen tests pass across automatic payout integration, approval ordering and transfer uncertainty. The new real-Mongo test injects failure after reservation/PROCESSING writes and proves balance and PENDING state are restored, then verifies a clean retry commits both. Existing selection/budget tests and provider uncertainty regression remain passing. API type-check, affected lint and whitespace checks pass; logs `/tmp/ujimora-auto-payout-atomic-{tests,types,lint}.log`; sessions terminal.

Still required: explicit concurrent owner/KYC revocation interleavings at the authorization transaction and combined real-use-case provider-call ordering evidence. External changes after the local authorization commit cannot atomically cancel an already authorized remote payment; preserve provider reconciliation instead of refunding uncertain transfers. Other payout paths, campaign limits/public badges, legacy evidence policies and final compliance/release work remain open.


## Automatic payout revocation and provider ordering evidence — 2026-09-13

Five real Mongo interleavings pause after the authorization read and before the owner serialization write. Concurrent closure, email revocation, organization role change, newer pending identity and rejected KYC each cause the stale transaction to retry and deny authorization. Reservation callbacks never execute; campaign balance remains 1000 and payout PENDING. The KYC cases perform the same account serialization write as production KYC workflows, within a transaction; they do not invoke the full HTTP KYC endpoint.

A further integration test invokes the real ApprovePayoutUseCase with real payout/balance repositories and verification transaction. Its mocked provider reads raw collections with no session and verifies the 300 reservation, PROCESSING state and matching provider reference are committed before initiation. The provider is called once; no real payment occurs.

Twenty focused tests pass across automatic payout integration, approval ordering and transfer uncertainty; API type-check and whitespace checks pass. Logs `/tmp/ujimora-auto-payout-revocation-{tests,types}.log`; processes terminal. This covers changes before the authorization lock and provider-after-commit ordering, not every arbitrary administrative database repair or postcommit cancellation. Continue other campaign/payout privilege consumers and all remaining provider/policy/release evidence under the original goal.


## Staff evidence rendering and mobile export checkpoint — 2026-09-13

Two dedicated KYCOrganizationEvidence component tests pass: the actual admin dialog renders registered address/GPS, representative capacity, controller roles/countries/percentages and applicant declarations; it labels them as applicant statements and still requires separate staff findings/attestation before invoking approval. Incomplete historical records display missing fields and unconfirmed declarations rather than invented values. Admin type-check passes after correcting test-only Testing Library option typing. Logs `/tmp/ujimora-kyb-admin-evidence-{tests,types}.log`; sessions terminal.

Fresh Expo exports completed for iOS, Android and web with current KYC code. Output `/tmp/ujimora-compliance-kyb-mobile-export`; log `/tmp/ujimora-compliance-kyb-mobile-export.log`; export process terminal. This confirms JavaScript/Hermes bundle generation, not signing, native permissions, physical controls, provider media delivery or store approval.

Full API regression remains active in session 70687 at this checkpoint. Poll it to terminal and inspect the result before API/shared source changes. Other consumer/legacy/provider/release obligations remain under the original compliance goal.


## Remaining verification consumers: source trace — 2026-09-13

While the full API regression runs against unchanged source, read-only tracing confirms these remaining paths:

| Consumer | Current behavior | Required follow-up |
| --- | --- | --- |
| CreateCampaignUseCase / UserEntity.canCreateCampaign | Count allowance comes directly from stored verificationLevel, including the recheck after content admission. Only the separate high-value auto-approval exception consults current KYC. | Compute current evidence-backed allowance consistently with the campaign eligibility endpoint; preserve historical campaigns and distinguish baseline email level from KYC privileges. |
| MongoCampaignReview | Owner verification gate checks stored level against zero and compliance ceiling. | Align current-evidence rules with creator eligibility and transaction serialization; test expired/rejected/new pending evidence. |
| GetOrganizationUseCase.isVerified | Public organization verified flag comes from stored organization verificationLevel. | Trace organization-to-user ownership mapping and use current organization evidence for public badges without exposing private records. |
| creatorRoutes POST /withdraw → RequestCreatorWithdrawalUseCase | Route requires authentication; source traced so far checks payout-account name match, plan and money constraints without a current KYC port. | Review applicable identity/payout policy and full wallet/provider paths before adding the appropriate current-evidence gate; do not equate saved-account name match with identity verification. |

This table records concrete source findings, not completion or a finding about every financial path. No API/shared source changed during session 70687.


## Desktop and phone web intake — 2026-09-13

The organization browser test now runs at both 390×844 and 1440×1000. Both pass the real routed form, country/date controls, controlling-person add/remove, private upload references, unchecked declaration gate, failed-save retention and identical successful retry. Each checks no horizontal overflow and no unexpected browser console/page errors. The desktop retry screenshot `/tmp/ujimora-organization-kyc-retry-desktop.png` was inspected: declarations, inline failure and submit action are readable and reachable. Existing phone screenshots remain available. Responses/media are synthetic, not live-provider evidence.

Logs `/tmp/ujimora-kyb-responsive-browser.log` and `/tmp/ujimora-kyb-responsive-lint.log`; both processes terminal. Full API regression session 70687 remains active and API/shared source remains unchanged. Further verification-consumer and external release obligations remain open.


## Full regression result — 2026-09-13

The API full regression completed: 989/989 tests, 150/150 files, exit 0 in session 70687. Log `/tmp/ujimora-compliance-api-final-regression.log`; 684.07 seconds. API/shared code was stable during the run. All earlier notes that this session is running are superseded by this terminal result. Continue the remaining verification consumer table, latest/legacy evidence rules, policy/provider and external release requirements; this suite is broad regression evidence, not proof those known gaps are complete.


## Current-evidence campaign allowance — 2026-09-13

Campaign creation options and CreateCampaignUseCase now share currentCampaignAllowance. It uses the newest record of each type (stable ID tie-break), requires approved state and finite future expiry for higher allowances, and caps the result at the historical account level. Organization business evidence is role-specific. The existing baseline EMAIL_PHONE allowance is preserved for accounts already holding that entitlement; no baseline privilege is created for level zero. Identity/address and stored KYC level are not conflated. Creation rechecks the allowance after content admission as well as before it. Missing KYC dependencies yield no higher evidence-backed allowance.

Nineteen focused tests pass across current allowance, high-value approval, campaign creation and HTTP plan enforcement. Coverage includes expired/undated/invalid evidence, newer pending/rejected/expired records over older approval, role-specific business evidence and no elevation above the stored level. HTTP coverage proves options and POST agree after expiry while existing campaigns remain accessible and the stored level is unchanged. Plan fixtures now explicitly provide current evidence for their higher allowance assumptions. Logs `/tmp/ujimora-campaign-current-evidence-{tests,types,lint}.log`.

Remaining: transaction-level creation/review races, staff campaign review enforcement, public badges, other payout consumers and legacy/Community verification policy. The existing political/media-to-Community mapping is preserved only for current evidence; this does not close its separate evidence-policy gap. The prior 989-test full regression predates this change and is not a full pass for the changed checkout.

Campaign allowance checkpoint: final API type-check and affected lint pass; all focused processes terminal.


## Staff campaign allowance enforcement — 2026-09-13

MongoCampaignReview now writes the organizer serialization field in its approval transaction, reads current KYC evidence, computes the same allowance as campaign creation and refuses approval when total existing campaigns exceed that allowance. The campaign being reviewed is already in that count, so equality is permitted. Existing legal acceptance, restriction, goal, expiry, version and audit gates remain.

Fourteen integration tests pass across staff campaign review, high-value approval policy and plan enforcement. New coverage proves expired evidence denies publication above baseline without modifying raised amount/status or recording an approval, then renewed current evidence permits review. High-value fixtures now distinguish expired campaign-count denial from the separate high-value manual-review rule; the exact goal boundary and first unverified high-value campaign remain covered. API type-check, affected lint and whitespace checks pass. Logs `/tmp/ujimora-campaign-review-evidence-{tests,types,lint}.log`; sessions terminal.

Remaining: campaign creation currently checks counts without a shared final owner-write transaction, so concurrent creation and review/count races still need fencing and tests. Public badges, other payout consumers, legacy/current-evidence policies and full release checks remain open. Earlier full-suite evidence predates these campaign changes.


## Serialized campaign creation — 2026-09-13

Production CreateCampaignUseCase now uses MongoCampaignCreation for the final current-account/allowance/plan checks, tier/returning-organizer decision and campaign insert. The transaction writes the same owner publicationWriteVersion used by KYC and staff review, checks the originally observed credential version, current legal agreement and publishing restriction, then re-reads current account/evidence/counts. Concurrent creation cannot both spend the last allowance. Screening/provider admission remains outside transaction retries; staff-review alerts occur only after the campaign commit. Missing creation transaction wiring fails closed.

Twenty-four tests pass across campaign creation, HTTP plan/count enforcement, staff review and high-value approval policy. A new concurrent HTTP test with baseline allowance one and a permissive subscription yields exactly one 201 and one 403; subsequent options report one campaign and verification-limit denial. Unit fixtures explicitly supply their in-memory transaction double. API type-check, affected lint and whitespace checks pass; log `/tmp/ujimora-campaign-creation-atomic-{tests,types,lint}.log`; sessions terminal. Callback indentation was normalized after the passing checks without changing behavior.

Still required: explicit credential/closure/KYC/restriction interleavings at the creation transaction; review-admission revocation/expiry between screening and final commit; dynamic plan mutation serialization where applicable; public verification badges and remaining payout/policy/provider gates. The 989-test full checkpoint predates these campaign changes and must not be presented as final regression evidence for them.


## Campaign creation revocation boundary tests — 2026-09-13

Six authenticated HTTP interleavings pause MongoCampaignCreation.run after screening and before its transaction starts. The tests then close the account, rotate credentials, remove current agreement, add a publishing restriction, expire identity evidence or add a newer pending identity application. The final transaction returns 401/428/403 as appropriate and preserves exactly the prior campaign, with no new campaign inserted. These cover real endpoint/use-case wiring, not only a mocked eligibility helper.

All ten campaign plan/allowance/concurrency/revocation integration tests pass; API type-check and whitespace checks pass. Logs `/tmp/ujimora-campaign-revocation-{tests,types}.log`; sessions terminal. Production code was unchanged in this checkpoint.

Scope limit: these mutations occur before the final transaction starts. Evidence admission itself can still expire/be revoked between screening and save, and dynamic-plan/restriction writers need transaction-serialization tracing. No claim is made about every post-lock/postcommit interleaving. Continue these and public badge/payout/policy/provider/release requirements under the full goal.


## Final campaign content approval validation — 2026-09-13

The publication admission port now exposes an optional transaction-safe current-approval check; campaign creation requires it and fails closed when missing. MongoPublicationAdmission uses the same complete submission fingerprint for initial admission and final validation. The final validation conditionally increments consumptionWriteVersion only on an approved record with future expiry, inside the campaign creation transaction immediately before saving. Concurrent review changes/deletion conflict with that write; external screening is never called from transaction retries. Existing admission fixtures now explicitly provide their test-only no-op current check.

Twenty-six tests pass across campaign publication admission, creation/plan/revocation integration and creation use-case checks. Three new authenticated interleavings expire, reject or remove the admitted review after screening and before the final transaction; all return 409 without creating a campaign, and screening is called once. API types, affected lint and whitespace checks pass. Logs `/tmp/ujimora-campaign-content-final-{tests,types,lint}.log`; sessions terminal.

The final check is currently enforced for campaign creation. Other publication actions must be traced separately before claiming this protection globally. Dynamic plan/restriction mutation serialization, public verification badges, other payout flows, legacy policies and provider/store/legal gates remain open under the full goal.


## Current public organization badges — 2026-09-13

Organization records map directly to organization-role user IDs. GetOrganizationUseCase now uses those IDs to read KYC evidence and requires the latest business review (createdAt then ID descending) to be approved with finite future expiry, alongside stored institutional-or-higher level. List and slug/ID details share the check. Missing, undated, expired, pending or rejected latest evidence produces verified=false; historical account levels and reviews remain intact. No documents, business information or internal notes are added to public DTOs.

Five real HTTP public-access integration tests pass, including all those states and renewed approval, plus existing privacy/block/restriction cases. API type-check, lint and whitespace checks pass. Logs `/tmp/ujimora-organization-badge-{tests,types,lint}.log`; sessions 18929/10291/54874 terminal exit 0. Full-suite evidence predates this change. Public user/campaign badge consumers, other payout flows and remaining release/legal/provider gates are still open.


## Public member verification projection — 2026-09-13

GetPublicUserProfileUseCase now returns currentVerificationLevel from current KYC records rather than the historical stored level. The helper was extracted from currentCampaignAllowance without changing allowance behavior: latest record per type, approved with finite future expiry, business authority only for organization role, no increase above stored level. Existing baseline level and political/media mapping remain unchanged pending their separate policy review. Public mobile profile and campaign organizer components consume this DTO. Private KYC fields remain excluded and stored history remains intact.

Fourteen tests across public member/organization HTTP access and campaign allowance pass. New HTTP coverage exercises missing evidence, current identity, expiry, superseding pending and renewed approval, and business role mismatch then organization role. API types, lint and whitespace checks pass. Logs `/tmp/ujimora-public-verification-{tests,types,lint}.log`; sessions 38254/46098/13139 terminal exit 0. This is focused evidence, not a fresh complete regression or full client visual audit. Other current-status consumers, political/media policy, financial flows and external/release requirements remain open.


## Account KYC aggregate supersession — 2026-09-13

GetKYCStatusUseCase now calculates aggregate status and level from the latest submission per verification type, ordered by createdAt then ID descending. Historical approvals remain in the response history and storage, but cannot override a newer pending, rejected or expired review of that same type. Independent current approvals still contribute; a pending address submission does not erase current identity verification. Explicit-expiry derivation remains unchanged. Undated historical approvals still need their separate migration/policy decision and are not declared resolved here.

Thirty-six tests across KYC review integrity and KYC HTTP integration pass. Three new parameterized HTTP cases prove supersession, retained history, renewal approval and separate-type behavior. API type-check, lint and whitespace checks pass. Logs `/tmp/ujimora-kyc-status-current-{tests,types,lint}.log`; sessions 5111/86585/77230 terminal exit 0. Full regression, other payout/verification consumers and external compliance/release gates remain open.


## Creator withdrawal replay ownership — 2026-09-13

Tracing creator withdrawals identified an independent privacy flaw: the global requestKey lookup returned an existing payout before checking its creator. RequestCreatorWithdrawalUseCase now checks creatorUserId against the authenticated caller for both the first replay lookup and the duplicate-key winner lookup after returning a losing reservation. Mismatch returns a generic 409 without payout details. The unique index and owner replay behavior remain intact.

Eleven creator withdrawal integration tests pass. New HTTP coverage submits another account's key to both destination branches, checks no data or fund movement, then simulates an initial lookup miss against a real existing unique key to exercise duplicate insertion and restoration of the losing reservation. The winning payout remains unchanged; owner retry does not reserve again. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-creator-replay-{tests,types,lint}.log`; final test/types sessions 74564/40388 and lint 6639 terminal exit 0.

This fixes replay ownership only. Creator withdrawals still need current identity/business evidence and final owner-serialized authorization traced through both bank and wallet rails; no claim is made that those outstanding protections or the full compliance goal are complete.


## Creator wallet final account authorization — 2026-09-13

The authenticated creator withdrawal route now forwards the token credential version through the use case into WalletPayoutPort. MongoWalletPayoutRepository checks the same version and nonclosed account inside its existing explicit-session transaction, writing publicationWriteVersion before replay/debit/credit. Account closure and credential changes therefore share a conflicting account write with money movement; no independent nested transaction is introduced. The credential version is not added to the response.

Twenty-four creator withdrawal, wallet persistence and wallet use-case tests pass. New real HTTP interleavings close the account or rotate credentials after authentication but before the wallet transaction, resulting in 401, unchanged creator and wallet balances, and no payout. Existing concurrency, owner replay and ledger rollback cases pass. Initial failures were test assertions (registration already creates an empty wallet, and an overbroad fixture replacement); corrected and rerun terminal. API types/lint and whitespace checks pass; `/tmp/ujimora-wallet-auth-{tests,types,lint}.log`, final test session 24403, types 91446, lint 13305 exit 0.

Remaining: bank-rail final account authorization, creator payout identity-policy applicability/current evidence, destination and dynamic fee/plan changes, and full regression/release evidence. This change does not impose a new KYC or mandatory MFA policy while the partner/regulatory applicability gate is unresolved.


## Creator bank withdrawal transaction — 2026-09-13

CreatorWithdrawalTransactionPort and MongoCreatorWithdrawalTransaction now wrap the bank/mobile-money reservation, payout insert and PROCESSING provider reference. The adapter checks the authenticated credential version and nonclosed account with an actual publicationWriteVersion write inside MongoUnitOfWork. The use case rechecks request-key ownership after acquiring that serialization point; concurrent identical requests replay the committed winner. Failures roll back all local writes; duplicate-key recovery occurs only after rollback and checks ownership. Provider recipient/transfer calls remain outside transaction retries and after commit. Missing transaction wiring fails closed.

Twenty-eight creator withdrawal, wallet persistence and wallet use-case tests pass. New HTTP tests cover closure/credential changes before final transaction, failed processing transition with unchanged funds/no payout/no transfer then successful retry, and concurrent identical requests with exactly one transfer. The mocked provider reads raw collections with session:null at invocation and observes the committed PROCESSING reference and debited balance. Existing uncertainty, webhook settlement and reconciliation cases pass. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-bank-auth-{tests,types,lint}.log`; final tests 87141, types 19905 and lint 43764 terminal exit 0. No live provider calls occurred.

Remaining: dynamic fee/plan and saved-destination changes between initial reads and commitment, final identity requirements based on provider/regulatory applicability, other payment consumers and full release regression. No global compliance or deployment claim.


## Creator destination final validation — 2026-09-13

PayoutAccountRepositoryPort now supports a conditional current-account claim. MongoPayoutAccountRepository matches the owner's saved account ID, fingerprint, type, number, bank, name, recipient code and name_matched status, incrementing consumptionWriteVersion. Creator bank withdrawal calls this through PayoutAccountService inside the final reservation transaction. Removal or mutation writes the same document and therefore conflicts with the transaction. Missing verification wiring fails closed; production requires a saved verified destination. Account resolution/provider recipient creation stays outside the transaction.

Twenty-eight creator withdrawal and payout-account verification tests pass. Three new HTTP interleavings remove the account, change it to needs_review or change its number after initial selection and before final transaction. Each returns 409 with unchanged creator balance, no payout and no provider transfer. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-payout-destination-{tests,types,lint}.log`; sessions 81377/10086/22058 terminal exit 0. Earlier full regression does not include this change.

Scope: this claim is currently consumed by creator bank/mobile-money withdrawal only. Other payout users of saved accounts, dynamic fee/plan consent, identity-policy applicability and remaining release/compliance gates stay open. Name matching remains a provider account-name comparison, not proof of identity or regulatory onboarding.


## Creator bank fee consent revalidation — 2026-09-13

RequestCreatorWithdrawalUseCase now resolves creatorPolicy again inside the final bank reservation transaction, after owner serialization and replay lookup but before destination claim or reservation. A changed effective fee returns 409 and asks the creator to refresh and review. Existing payout fee snapshots remain authoritative after commit; this does not reprice in-flight transfers.

Twenty-two creator withdrawal integration tests pass, including two new interleavings changing the starter plan fee or expiring the subscription after initial policy lookup and before transaction entry. Both deny without payout/reservation/provider transfer. Existing live-fee snapshot, uncertainty and settlement cases remain passing. API types/lint and whitespace checks pass; logs `/tmp/ujimora-creator-final-fee-{tests,types,lint}.log`, sessions 14466/14082/51329 terminal exit 0.

Limit: this checks policy as observed in the transaction snapshot. Plan/subscription documents are not yet conditionally written to conflict with concurrent policy mutation, and the creator-wallet transaction still needs equivalent fee validation. These remain actionable work under the full goal, alongside applicability and release gates.


## Creator wallet fee parity — 2026-09-13

MongoWalletPayoutRepository accepts the production PlanLimitsService for creator fee validation and fails closed when absent. Creator transfer now uses mongoose.connection.transaction with transactionAsyncLocalStorage enabled, snapshot reads and majority writes, so plan/subscription repository reads enlist alongside existing explicit-session balance, payout, wallet and ledger writes. The current fee must match input.feePercent before any new transfer debit. Existing committed payout replay retains its recorded values. Campaign wallet settlement behavior is unchanged.

Thirty-five creator withdrawal, wallet persistence and wallet use-case tests pass. Two new HTTP interleavings edit the plan fee or expire the subscription after initial policy resolution but before wallet transaction entry; both return 409 with unchanged creator/wallet balances and no payout. Existing concurrent transfers, account revocation, destination checks, bank-provider boundaries and rollback cases pass. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-wallet-final-fee-{tests,types,lint}.log`; sessions 73267/97049/14432 terminal exit 0.

Remaining: both rails currently validate policy through snapshot reads; they do not yet conflict with every concurrent subscription/plan mutation. That serialization, broader financial/verification consumers and full release/compliance evidence remain required work.


## Withdrawal policy document serialization — 2026-09-13

Subscription and plan repositories now expose lockForConsumption, implemented as a consumptionWriteVersion increment with timestamps disabled. Final creatorPolicy calls on both bank and wallet rails request these writes inside their money transaction before resolving the effective fee. Existing subscription/plan edits and deletes therefore conflict and trigger a fresh transaction snapshot. Display and ordinary policy reads remain read-only. Plan and subscription reads during the locked policy path are sequential, avoiding parallel operations on a transaction session.

Thirty-seven creator/wallet tests pass. Four new interleavings mutate either the subscription expiry or plan fee with session:null after the owner write establishes a snapshot and before policy locking, on both bank and wallet rails. Each demonstrates a retried policy lock, 409 stale fee denial, unchanged balances and no payout/provider transfer. API types/lint and whitespace checks pass. Initial type-check caught an unrelated overbroad replacement in platformFeePercentForCampaign; corrected before final passing verification. Logs `/tmp/ujimora-withdrawal-policy-lock-{tests,types,lint}.log`; final sessions 34292/5269/15483 terminal exit 0. Additional PlanLimitsService regression passes in `/tmp/ujimora-withdrawal-policy-plan-regression.log`.

Limit: these conditional writes serialize existing policy documents. A missing subscription or plan has no document to write, so concurrent insertion while using a code-default fallback remains to address. No claim is made about that case or all other fee consumers. Full goal and commit/push remain pending.

## Missing withdrawal policy serialization — 13 September 2026

The locked subscription read now atomically provisions the same implicit Free record used by first subscription access when none exists. Built-in plan locks atomically seed their documented defaults when missing. Their unique keys and transaction writes now conflict with concurrent first insertions as well as edits to existing rows. Existing policies are not overwritten. Missing custom tiers are not invented: locked withdrawal resolution returns 409 and asks for subscription refresh. Ordinary display fallback behavior remains unchanged.

Thirty creator-withdrawal tests and 21 PlanLimitsService tests pass, with API types/lint and whitespace checks. New cases exercise successful missing-row withdrawals on both rails and first-time subscription/plan insertions after the transaction snapshot: stale fee returns 409, no balance movement, no payout and no provider transfer. Logs `/tmp/ujimora-missing-policy-{final-tests,plan-tests,types,lint}.log`. Tests ran in the isolated repair checkout; full root regression session 69000 still targets the preceding API source, so it cannot certify this delta. Root main is intentionally not advanced until that process ends; the repair is published independently from its worktree. Regulatory identity applicability, other fee consumers and full release evidence remain open.

## Manual bank payout transaction

Manual single and batched campaign bank payouts previously reserved available funds separately from the processing transition. A thrown storage error could strand that reservation, and the current staff role/credential version was not rechecked after provider balance lookup.

MongoManualPayoutApproval now serializes a nonclosed current administrator with the authenticated credential version in MongoUnitOfWork. Reservation and PROCESSING reference/legs commit together; failed writes roll back. Provider transfers remain outside transaction retries and after commitment. The controller forwards credential version; missing transaction wiring fails closed. The batch path preserves maker-checker and existing leg reconciliation.

Remaining scope: first-approval/review-evidence writes, final campaign/destination snapshots and eligibility, wallet/manual/beneficiary/affiliate consumers, provider identity applicability and broader release gates. The change does not impose automatic-payout KYC requirements on manually reviewed cases without approved policy. The earlier 1,078-test full regression predates this delta.

Final focused verification: 34 tests across payout integration, transfer uncertainty, automatic verification and wallet use cases pass (session 4084 exit 0, 28.99s). Five new HTTP cases cover failed processing writes on single/batched rails with successful retry, and staff role/closure/credential changes immediately before the final transaction. Provider mocks query with session:null and observe committed PROCESSING references/legs and reserved balances before sending. API types/lint pass. Logs `/tmp/ujimora-manual-payout-final-tests.log`, `/tmp/ujimora-manual-payout-{types,lint}.log`. No real provider calls occurred.

## First-approver and review evidence authorization

Manual recipient/wallet review recording now runs through the current staff authorization transaction and re-reads pending payout state. For a high-value payout, review evidence and firstApprovedBy commit together. A failed first-approval write rolls both back; the same maker is rejected before another review is appended. Final bank reservation retains its separate fresh staff authorization after provider balance lookup.

All 44 focused tests across five files pass (session 59587 exit 0, 28.06s), plus API types/lint. New HTTP tests verify recipient-review rollback on maker-storage failure and revoked-maker rejection with no review/approval evidence. Existing final bank revocation tests now deliberately revoke at the second transaction, retaining coverage beyond the earlier evidence-write check. Logs `/tmp/ujimora-maker-review-{tests,types,lint}.log`.

Remaining: low-value/second-review status serialization with concurrent processing, exact recipient/campaign approval snapshots, final wallet settlement authorization and the wider payout/provider policy gates. Recorded review evidence does not imply a transfer succeeded; provider operations remain separate. Full 1,078-test baseline predates these manual-approval changes.

## Campaign wallet final staff authorization

WalletPayoutPort now forwards the authenticated credential version from approval into settleCampaign. The existing explicit-session transaction conditionally writes the current nonclosed administrator before payout lookup, campaign debit, wallet credit, ledger/history and PAID status. Role/credential/closure writes therefore conflict with settlement, rather than relying on the earlier review transaction. Existing paid replay still requires current staff access.

New persistence cases reject role, closure and credential changes with no balance movement, wallet/history or journal creation. HTTP coverage rotates staff credentials after review and before settlement. The initial HTTP fixture omitted the existing required wallet idempotency key and failed before reaching the changed path; the fixture now supplies a UUID, preserving production validation. A second fixture assertion incorrectly assumed the entire donation was cleared; it now compares the actual pre-approval campaign balance, preserving the unchanged-money invariant. Final campaign ownership/eligibility/fee and recipient authorization remain separate open boundaries; no KYC/regulatory policy is invented by this staff check.

Final wallet staff verification: all 40 tests across payout integration, wallet persistence and wallet use cases pass (session 64002 exit 0, 48.50s); `/tmp/ujimora-wallet-staff-verified-tests.log`. API types and lint pass (`/tmp/ujimora-wallet-staff-{types,lint}.log`). Existing concurrent wallet credits, overdraw prevention, ledger rollback and creator replay checks remain passing. No real money or provider calls occurred.

## Review versus payout status serialization

PayoutRepositoryPort.lockPendingForReview now conditionally increments an internal reviewWriteVersion on PENDING payouts inside the staff-authorized review transaction. Low-value and second-review evidence can no longer commit from a stale read after another operation changes the payout status. The transaction conflicts/retries, reads the current state and rejects before writing review evidence. The counter is omitted from public DTOs and does not change updatedAt by itself.

Two HTTP interleavings commit a FAILED status with session:null after the transaction snapshot but before the conditional review write, for ordinary and high-value second approvals. They assert a retry, 409, unchanged recipient review counts/campaign funds and no provider transfer. Exact campaign/recipient/fee snapshots and other financial consumers remain separate open boundaries.

Verification completed: 46 tests across four payout/review/wallet/uncertainty files pass (session 62100 exit 0, 64.63s); API types/lint pass. Logs `/tmp/ujimora-review-status-{tests,types,lint}.log`. Both injected status races retry and deny without appended reviews or fund movement. Full regression of the recent manual approval series remains required; earlier 1,078-test pass is a prior baseline.

## Campaign wallet settlement checks current destination and cashout eligibility

The final campaign-wallet money transaction now conditionally writes the campaign's internal payoutWriteVersion and validates the current owner against the wallet destination, then rechecks early-cashout eligibility against the current end date, goal and raised amount. Concurrent campaign writes conflict and retry before funds move; timestamps and public DTOs do not expose the internal counter. Already committed PAID replay preserves its original settlement. This prevents stale owner destinations and fee-free standard settlement after eligibility changes, without repricing a committed payout.

All 46 tests across wallet persistence, wallet use cases and payout HTTP integration pass. Four new external-session interleavings change owner, end date, goal or raised amount after the staff write establishes a transaction snapshot; each asserts retry, 409, unchanged available funds, PENDING payout and no wallet/history/journal credit. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-wallet-campaign-{final-tests,types,lint}.log`. The 1,091-test full API baseline predates this delta. Bank-rail campaign/destination snapshots, broader fee-policy and financial consumers, identity applicability and release gates remain open.

## Manual bank reservations serialize campaign cashout eligibility

Single and batched manual-bank execution now pass campaign/type context into MongoManualPayoutApproval for the final reservation transaction. After current staff authorization, it increments campaign payoutWriteVersion and checks current end date/raised amount/goal before reserving money or committing PROCESSING references. Concurrent eligibility changes force a transaction retry; an early campaign cannot proceed under a standard payout. Review-only/maker transactions remain distinct and do not reserve funds.

All 33 payout HTTP and transfer-uncertainty tests pass; two new snapshot interleavings cover single and batched transfers, asserting retry, 409, PENDING status, unchanged funds and no provider transfer. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-bank-campaign-{tests,types,lint}.log`. The full 1,091-test baseline predates this and the wallet-campaign delta. Automatic bank execution, final recipient/campaign authorization snapshots, dynamic fee consent and other financial consumers remain open; this does not establish global payout or regulatory readiness.

## Automatic reservation consumes current campaign eligibility

Automatic approval now passes campaign/type context to its final verification transaction. After owner verification and serialization, a campaign payoutWriteVersion write rechecks current ownership, allowed automatic campaign status, nondeleted state and standard-cashout eligibility before reservation/PROCESSING. This repeats selection requirements at the money boundary and conflicts with concurrent campaign changes.

All 24 automatic integration, automatic verification and transfer-uncertainty tests pass, plus API types/lint. Four new real-transaction interleavings mutate campaign owner, status, deletion or early-cashout conditions after snapshot establishment and before campaign locking; each retries, returns 409 and preserves PENDING/available funds without calling the provider. Existing committed-before-provider and verification-revocation cases pass. Logs `/tmp/ujimora-auto-campaign-{tests,types,lint}.log`. Exact recipient authorization/review snapshots, automatic policy/budget concurrency, broader financial consumers and final release regression remain separate open checks; no global compliance claim.

## Automatic destination and review policy revalidation

The automatic money transaction now locks the current enabled policy through a separate consumptionWriteVersion, then locks the recipient through payoutWriteVersion. It validates current maximum amount, recipient campaign/owner/currency and exact provider recipient code, MoMo amount limit, and review author/note/resolved name/freshness under current policy before reserving money. The separate counter preserves the existing claims count. Concurrent policy or recipient mutation conflicts and retries; immutable provider addressing cannot silently change after the earlier lookup.

All 29 automatic integration/verification/transfer-uncertainty tests pass, plus final API types/lint and whitespace checks. Five new external-session mutations after snapshot establishment cover recipient owner/code/currency/expired review and disabled policy, asserting retry/409/PENDING/unchanged funds/no provider call. Logs `/tmp/ujimora-auto-recipient-{final-tests,types,lint}.log`. Remaining: automatic daily-budget/claim and dispute/first-paid-history final consumption, manual destination review snapshots, broader financial consumers and full regression/release verification. No store/provider/regulatory approval claimed.

## Automatic reservation and dispute changes share campaign serialization

Automatic payout's final money transaction now checks for open/under_review disputes after locking the campaign. MongoDisputeRepository creation and status updates now run transactionally and increment the same campaign payoutWriteVersion before committing dispute changes; missing campaigns fail closed. This also covers a dispute newly inserted after an earlier snapshot, which a dispute-only read/write cannot fence. Manual review remains a distinct path; this is not a blanket prohibition on staff-resolved payouts.

All 28 automatic integration/verification tests, API types/lint and whitespace checks pass in isolated checkout `/tmp/ujimora-dispute-fix`. Two concurrent tests pause after verification establishes the snapshot, then create or reopen a dispute through the real repository; automatic approval retries, returns 409, and leaves funds/PENDING unchanged with no provider call. Logs `/tmp/ujimora-dispute-payout-{tests,types,lint}.log`. Root full regression 24306 remains on API baseline 0bb30ee and does not cover this change. Root must fast-forward after its terminal result; subsequent regression remains required. Final budget/history/manual-recipient/other-consumer and release/legal gates stay open.

## Automatic reservation consumes a current daily budget claim

Automatic claims now persist their UTC day on the payout. Final reservation
requires that same pending payout's claim, owner, campaign, destination, amount,
currency and type to match. It locks both owner and platform budget records in
the money transaction and checks their integer minor-unit totals against current
policy limits. Missing/expired claims, missing budgets and limits reduced below
already claimed totals require manual review. Consumption increments a separate
serialization counter; it does not charge the daily budget a second time.

On current main source, 32 automatic integration tests and four verification /
transfer-uncertainty tests pass, plus API types/lint. Five concurrent mutations
cover missing/expired claims, missing budgets, lowered limits and changed budget
totals. The success case runs the real claim service and approval transaction,
checks each budget is charged once, and observes committed money/reference state
before the provider call. Logs: /tmp/ujimora-budget-current-{tests,unit,types,lint}.log.

Remaining: prior manually paid destination history at final consumption, manual
destination review snapshots, other financial consumers, full current regression,
and the separate provider, native, store and legal/regulatory release gates.

## Settled manual destination history at final reservation

The final automatic money transaction now conditionally writes the qualifying
prior payout using a separate historyWriteVersion counter. It must still be PAID,
settlementApplied, approved by a nonempty manual actor, and match campaign, owner,
recipient and currency. The current payout cannot qualify itself. The early claim
check uses the same eligibility filters. Concurrent corrections, reversals or
deletion of the consumed history row conflict and retry before any provider call.

All 39 focused integration/verification tests, API types/lint and whitespace checks
pass in isolated checkout /tmp/ujimora-history-fix. Six concurrent cases cover failed
status, cleared settlement, automatic/empty approver, currency correction and
history deletion: each retries then returns 409 with PENDING payout, unchanged
available balance and no transfer. Logs /tmp/ujimora-history-{tests,types,lint}.log.
Full API regression88675 remains live on unchanged root baseline c8adacf and does
not cover this later slice. Do not change root API source until it finishes.
Manual destination-review snapshots, historical recipient addressing, remaining
financial consumers and provider/native/store/legal gates remain open.

## Manual destination review snapshots

Recipient review recording now atomically appends the destination fields alongside
reviewer/note/time: provider recipient code, account number, bank code, currency,
type, campaign and owner. User-supplied strings remain literals in the update
pipeline. Final single and batched bank reservations lock the recipient and require
its current ownership/currency/provider code and destination details to match the
payout-specific review. High-value payouts require matching snapshots for both the
maker and checker. Missing legacy maker snapshots fail closed; reject/recreate the
pending request for fresh reviews rather than bypassing maker-checker controls.

All 36 payout and destination-review integration tests pass, including normal single
and batched flows, atomic snapshot/literal-note preservation, four concurrent changes
(provider code/account/bank/review removal), and missing maker evidence. Concurrent
cases retry and prevent reservation. API types/lint pass; a nested Mongoose `type`
schema issue found by tests was corrected before the successful run. Logs:
/tmp/ujimora-manual-destination-final.log and -final-{types,lint}.log.

This closes current destination snapshot consumption for these bank payout paths,
not all historical provenance or all financial consumers. Automatic prior-history
address binding, beneficiary/affiliate flows, wider release gates and the current
full regression remain separate. Root regression88675 is still on c8adacf; do not
fast-forward that source until it reaches a terminal result.

## Automatic history is bound to reviewed account details

The final automatic reservation now selects settled manual history only from
payout-specific reviews whose destination snapshots match the current provider
code, account number, bank code, currency, type, campaign and owner. Only the latest
review per payout/reviewer is eligible; an older matching entry cannot override a
later correction. The selected paid payout is still locked and revalidated, and
its maker snapshot must also match when present. Legacy records without snapshots
fall back to manual review, where a fresh settled manual payout can establish
eligible history. No legacy evidence is fabricated or silently backfilled.

All 44 focused automatic integration/verification tests, API types/lint and
whitespace checks pass. Five added cases cover missing snapshots, changed account
number/bank code, missing maker evidence and superseded review evidence, each with
409, unchanged funds/PENDING state and no provider call. The existing real-service
success and concurrent history-change tests also pass. Logs:
/tmp/ujimora-history-address-final-{tests,types,lint}.log.

Root full regression88675 remains live on c8adacf; later history/manual snapshots
are verified by focused suites, not that baseline run. Beneficiary/affiliate and
other financial consumers, full current regression, native/provider/store and
legal/regulatory gates remain open.

## Affiliate transfer final authorization

Affiliate approval now forwards the authenticated credential version into a final
MongoDB transaction. Before committing PROCESSING/providerRef, it conditionally
writes the current non-deleted administrator, the active affiliate with its exact
provider destination and original payout requester, and that available owner
account. The provider call follows the committed transaction. A changed role,
credential version, affiliate status/owner/destination or closed account fails
before transfer; existing reservations stay attached to the pending request.

Eight integration cases pass using the real approval use case and MongoDB payout
repository: seven mutations during provider balance lookup fail with 403/409 and
PENDING/no provider transfer; the success case observes committed PROCESSING and
reference outside the transaction before sending. API types/lint pass. An initial
fixture failure from two missing unique emails was corrected without weakening
production checks. Logs /tmp/ujimora-affiliate-approval-final-{tests,types,lint}.log.

Scope remains partial: affiliate destination review/KYC evidence, applicable
amount/maker-checker controls, beneficiary flows and terminal balance transaction
review remain open, alongside external release gates. Full root regression88675
retains its c8adacf baseline and does not cover this later implementation.

## Beneficiary reservation and processing are atomic

Beneficiary approval now commits its share reservation, campaign aggregate
reservation and PROCESSING/provider reference in one MongoUnitOfWork transaction.
A short aggregate balance, losing processing transition or failed database write
aborts both balance moves without compensating writes. The provider transfer runs
only after commit. Post-provider outcome handling is unchanged by this slice.

Eight beneficiary integration tests pass, including successful full settlement,
short campaign mirror and injected failure after the actual processing write.
Failure cases preserve available/pending or paid balances, PENDING and absent
provider reference, with no transfer. The success test reads committed PROCESSING,
reference and reserved share outside any session from inside the provider mock.
API types/lint and whitespace checks pass. Logs:
/tmp/ujimora-beneficiary-atomic-final-tests.log and -atomic-{types,lint}.log.

Final staff credentials/current beneficiary KYC/destination validation, first
approval evidence and post-provider terminal balance consistency remain open.
Root regression88675 remains live on c8adacf and excludes these later slices.

## Beneficiary final staff and KYC/destination authorization

Final beneficiary reservation now revalidates the authenticated administrator's
role, closure state and credential version, then locks the same beneficiary
recipient with unchanged KYC reviewer/time, account, bank, type, currency and
provider code. This runs inside the balance/PROCESSING transaction. Missing KYC
reviewer/time fails closed; a destination with a different payout currency is
rejected before provider lookup. HTTP forwards the current credential version.

All 13 beneficiary integration tests pass, plus API types/lint. Five added cases
cover credential revocation, withdrawn KYC, replaced provider/account details
during provider lookup, and a pre-existing currency mismatch: 403/409, unchanged
balance mirrors, PENDING and no transfer. Existing atomic failure and full paid
settlement cases pass. Logs /tmp/ujimora-beneficiary-auth-final-{tests,types,lint}.log.
Render was verified live on the preceding 9d2374a before this commit.

Remaining beneficiary work includes first-approval authorization/review evidence,
verification evidence completeness and eligibility/consent consumption, and final
settlement consistency. Other financial/provider/store/native/legal gates remain
open. Root full regression88675 continues against c8adacf, excluding later slices.

## Replacement recipient clears obsolete KYC evidence

A regression test reproduced stale reviewer/time fields after recipient replacement:
Mongoose omitted the existing `$set: undefined` values, leaving previous evidence
stored even though kycVerified became false. Replacement now explicitly unsets both
fields in the same destination update. The test inspects raw stored fields and
verifies a fresh review records its new reviewer/time. All 14 reset/beneficiary
integration tests, API types/lint and whitespace checks pass. Logs:
/tmp/ujimora-beneficiary-kyc-reset-{before,tests,types,lint}.log.

Full API regression88675 FINISHED exit 0: 1,117 tests across 155 files passed in
1190.11s on unchanged c8adacf. Root has now fast-forwarded to 78118b9; that baseline
run does not cover subsequent history, manual destination, affiliate, beneficiary
or this reset delta. Their focused evidence remains separate; current full
regression and remaining release/engineering gates are still required.

## Beneficiary first-review persistence and exact review consumption — 2026-09-13

The first high-value approval previously ran before current staff/KYC validation;
its reviewer and timestamp were declared in TypeScript but absent from the Mongoose
schema, so they were not persisted. The schema now retains firstApprovedBy/At and
an internal SHA-256 fingerprint of the reviewed payout amount/currency, identities,
exact destination details and KYC reviewer/time. No duplicate destination details
are exposed in public DTOs.

First review runs inside the same unit of work as current staff credential and
unchanged recipient/KYC locking. Both first-review and final PROCESSING writes
compare the exact request and prior review, so a concurrent request/review change
cannot count as approval or reserve money. Changed destinations or legacy reviews
without a fingerprint require a fresh first review and then a different second
administrator. Replaced recipient records require a new payout request. Account
name joins the existing exact destination authorization predicate.

Focused integration coverage includes stored reviewer/time, self-check rejection,
successful second approval, staff revocation, changed account/KYC/amount, rollback
after the actual review write, renewed and legacy reviews, replaced recipient IDs,
changed review during provider lookup, and simultaneous first reviewers. Existing
beneficiary reservation and paid-settlement regression coverage remains included.
Logs: /tmp/ujimora-beneficiary-review-final-{tests,types}.log and
/tmp/ujimora-beneficiary-review-lint.log. Final outcomes are recorded in agent_plan.md.

Remaining: verification evidence completeness, beneficiary eligibility and split
consent at consumption, terminal settlement consistency, other financial consumers,
and provider/legal/native/store release gates. This does not establish a universal
KYC policy or regulatory approval. Current full regression must supersede the older
c8adacf baseline before making a current whole-suite claim.
