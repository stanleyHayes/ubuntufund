# AI writing safety — 12 September 2026

Status: partial engineering implementation; broader UGC controls and release evidence remain open.

## Implemented behavior

The real OpenAI writing adapter screens supplied text, notes and target language before generation, then screens the extracted draft before returning it. It uses the OpenAI moderation endpoint with `omni-moderation-latest`. A flagged result returns a generic 422 review/revision message. Transport errors, non-success responses, malformed payloads and missing results fail closed; no unreviewed draft is returned. Generation retains `store: false` and bounded input/output handling. Neither raw moderation text nor provider errors are added to the usage log or error response.

Request-specific external-processing consent remains mandatory before quota/provider work. Web/native copy and the shared Privacy Notice disclose writing and safety processing by OpenAI. Usage records retain consent metadata and success/error status without storing raw writing input/output. Screening can make mistakes and does not establish factual accuracy, lawful fundraising, verification or regulatory approval. Users can edit their own writing and contact support about withheld requests. Quota reservations still apply to attempted requests, including failed/flagged attempts.

## In-app reporting

Web and native writing previews include Report. The service returns a request ID and stores a SHA-256 fingerprint of the original draft, excluded from ordinary usage reads. Report intake requires the same signed-in requester, a successful generation record and an exact fingerprint match. Other users and modified drafts cannot attach invented evidence to a request. Only an explicitly submitted report stores the original generated text in the private safety queue; ordinary generation still does not store raw text in usage records. Duplicate pending reports are idempotent. Admins can record review/resolution and follow-up filtering work without restricting the reporter; model outputs have no target author account. The shared report disclosure and Privacy Notice explain evidence storage.

## Verification

Twenty-one focused AI API/service/adapter tests cover consent, configuration, quotas, ordered input/output screening, flag rejection, malformed responses, transport failures, unavailable output screening and existing generation behavior. A subsequent fourteen-test reporting/AI/message run verifies requester isolation, altered-evidence rejection, private snapshots, idempotency and admin resolution. Nine web component tests and a phone-width campaign-wizard reporting flow pass; its screenshot was inspected. API/web/native/admin type and lint checks and the all-platform native export pass. External calls use test doubles, not live user content; final release validation remains outstanding.

## Remaining work and rollout gates

- Verify staffed review, feedback into filtering and a reviewer response path. Intake, private evidence and recorded admin resolution are implemented; they do not prove that staff completed real review or changed the moderation model.
- The new adapter currently covers AI writing only. Campaigns, updates, comments, messages, public names, uploads and live content require their own preventive controls, staff escalation and appeals. Existing reactive report/block/hide controls remain separate.
- Automatically flagged writing requests are withheld, not automatically placed in the staff safety queue. Explicit reports of returned suggestions do enter that queue. Finalize approved safety-evidence retention/holds and case response procedures; include AI usage fingerprints and report evidence in data-rights/erasure reviews under C08. Legacy suggestions without a stored fingerprint must be handled through support; no historical fingerprint is fabricated.
- Confirm actual OpenAI project/model access, provider terms, retention and international-transfer arrangements; update processor inventory and store privacy declarations. `store: false` on generation does not mean every provider abuse-monitoring record is absent.
- Exercise representative Ghanaian languages, legitimate medical/disaster fundraising, false positives, adversarial content and failure behavior with approved synthetic fixtures before release. Staff capacity and live provider evidence cannot be established by these tests.

Primary technical reference: [OpenAI moderation API](https://platform.openai.com/docs/api-reference/moderations) and [omni-moderation model](https://developers.openai.com/api/docs/models/omni-moderation-latest). Store scope: [Google Play AI-generated content policy](https://support.google.com/googleplay/android-developer/answer/13985936) and [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Recheck current policy and applicability before submission.
