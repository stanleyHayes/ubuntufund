# Data access, correction and privacy complaints

Engineering implementation, 2026-09-12. Request handling is implemented; complete operator fulfilment and a legally approved retention schedule remain release gates.

## Requester workflow

Web and native Settings accept a private access, correction or privacy-complaint request. The API derives ownership from the current authenticated account; clients cannot choose another account. One unresolved request of each kind is allowed per account, including concurrent submissions. Requests and an immutable submission event commit together. The response target is 30 calendar days from submission and is not extended by review activity. This is an operational target, not a statement that every legal request has that statutory deadline.

The requester can refresh the paginated history and read a response in Settings. Web can download the request and response as JSON; native can share that same information through the system share sheet. This artifact contains the request and the reviewer-provided response. It is **not** an automatic export of every collection. Users without account access can contact `legal@ujimora.com`; the shared privacy notice also identifies the Ghana Data Protection Commission. There is no automatic email notification for this workflow. The UI tells the requester to check the response here.

## Operator workflow

The admin Privacy requests page includes an outstanding data-rights queue, sorted by the original target date, and a responded view. The action center counts unresolved requests. Staff record internal review evidence separately from the response visible to the requester. Progress updates and published responses use revision checks and transactional audit events; a stale review or failed event write cannot overwrite or publish a response. Staff can page through the immutable review history.

The default action publishes the response in the active account's Settings. It rejects publication to a closed account because that requester cannot read it. Staff can instead record an external response **after** identity verification and secure delivery have actually occurred, with a required evidence/receipt reference. This is an operator attestation stored in the audit history, not an automated identity check or delivery confirmation. The tool does not send external messages. Do not mark an acknowledgement alone as fulfilment of an access request.

Before responding to access requests, the privacy owner must review:

| Category | Sources to review | Disclosure controls |
| --- | --- | --- |
| Account and preferences | User, Profile, Organization, OrganizationMember, website request timestamps, ActivityAlertPreference, newsletter subscription/consent | Exclude password hashes, credential versions, other members' private details and token capabilities. Explain processing purposes and recipients alongside the personal-data copy. |
| Financial activity | Donation/Intent, PaymentAttempt, wallet/top-ups/transactions, Tip, payouts/recipients, refunds/disputes, ledger/journals, affiliate records, campaign splits/beneficiary accruals | Preserve accounting records; isolate the requester's information. Review third-party identifiers, fraud/AML restrictions and legal exemptions before disclosure. |
| Content and interactions | Campaign/Update/Comment, CreatorProfile, LiveSession, Collaboration, Share, notifications, testimonials, contact submissions | Include relevant authored content and processing records; protect other people's information and confidential moderation evidence. |
| Verification and safety | KYCVerification, PrivateKycDocument, SafetyReport, Report, ContentRestriction, UserBlock, CampaignReview, audit records | Use verified secure delivery for sensitive files. Never expose unrestricted provider asset links, report identities or security secrets by dumping whole documents. Document any lawful restriction. |
| Subscription/provider data | Subscription/Checkout, StoreBillingAccount, StorePurchase, provider notifications, provider/customer/payment references | Exclude encrypted receipts, webhook credentials and account-binding capabilities. Coordinate with the actual processor for records outside MongoDB. |
| Privacy and service records | DataRightsRequest/Event, AccountDeletionRequest, support correspondence, AI usage/consent, relevant logs and backups | Internal evidence may itself contain personal data requiring review. Ordinary requester API responses omit internal evidence; that is not a blanket legal exemption from an access review. |

Correct the authoritative source using its authorized workflow and describe the actual correction. For complaints, investigate the stated processing, preserve necessary evidence and provide the outcome/escalation path. The request tool does not automatically correct data, retrieve processor copies or decide legal exemptions.

## Retention and closed accounts

Data-rights requests and review evidence remain restricted administrative records when an account closes so an unresolved request is not silently lost. The account-erasure review explicitly includes these records. Their justified duration, legal holds and eventual erasure/anonymization must be approved and implemented as part of the category schedule below. Indefinite retention is not an approved policy.

| Category | Current engineering behavior | Remaining approval/implementation |
| --- | --- | --- |
| Recovery/verification tokens and account confirmation mail | 30-minute validity; hashed tokens/encrypted email; TTL cleanup; suppressed/sent payloads scrubbed; closure cleanup | Production TTL/index and backup/log lifecycle verification. |
| Newsletter | Expiring confirmation tokens; non-expiring hashed unsubscribe capabilities preserve old withdrawal links; closure cleanup | Set justified pending/withdrawn/consent-history retention, including people without accounts, and implement a withdrawal-preserving purge process. |
| Profile and operational account data | Closure tombstone plus retryable removal/anonymization; financial references retained | Verify processor copies, legacy public media, backups and category-specific residual cleanup. |
| Financial, KYC, AML and dispute records | Preserved for integrity and review; not broadly TTL-deleted | Obtain applicable statutory/provider retention periods, documented holds and expiry authority before implementing destructive jobs. |
| Privacy requests, safety records, audit logs and support | Restricted access, timestamps and review workflow; no general purge policy yet | Approve purpose-specific periods and holds; implement scheduled expiry and processor evidence without destroying active requests/disputes. |
| Provider receipts, live/media records and analytics | Individual feature controls; no complete cross-provider schedule | Inventory processors, contractual deletion/backups and transfer/access paths; verify actual erasure acknowledgements. |

The absence of a configured purge is an open requirement, not proof of lawful indefinite storage. The reviewer must identify retention purpose, expiry/review date and applicable hold for each retained category. Automated financial-record destruction is not introduced based on guessed legal periods.

## Sources and verification

[Ghana DPC individual rights guidance](https://dpc.gov.gh/for-individuals/) and [DPC FAQs](https://dpc.gov.gh/help-faqs/) support access, correction and participation requirements. The [Data Protection Act, 2012](https://cybersecurity.gov.gh/documents/Data_Protection_Act_2012.pdf) governs retention and subject access; legal reviewers must resolve applicable provisions and exceptions for the actual operator and financial model.

Six API tests across the data-rights and action-center suites pass, including the final external-delivery evidence path. They cover account isolation, strict inputs, concurrent submissions, private evidence, conflicting reviews, fixed targets, audit-failure rollback, current roles and closed-account delivery. Two requester and two admin component tests pass. A mocked 390px browser flow verifies request submission, response visibility and actual JSON download; screenshot inspected. The 42-test mobile suite and all-platform JavaScript export pass. Web/native/admin type checks and API/web/native/admin lint pass. API type checks also pass after the final default-value handling fix. No live personal-data response or external message was sent.

Campaign staff-review records bind a private public-content snapshot to an immutable decision/version. Account closure removes duplicate snapshot fields while retaining decision/audit provenance and financial references. Staff notes may still contain personal information and require purpose-specific retention/redaction review; include these records in access requests without exposing other reporters or private staff information. See `CAMPAIGN_STAFF_REVIEW.md`.

### Publication queue closure follow-up — 13 September 2026

Private organization identity drafts submitted by teammates are now erased by organization resource ID when the organization closes. New review insertion fences the author and, for organization identity, the organization with transactional account writes. Requests authorized earlier cannot create fresh queue records for closed accounts. External screening runs after the insertion transaction. The final five-file publication/erasure regression passes 31 tests; see `ORGANIZATION_IDENTITY.md`. Financial records and minimal audit provenance remain subject to the existing retention ledger.
