# Preventive publication review — 12 September 2026

Engineering implemented for account identity edits/private-to-public changes (see `ACCOUNT_PUBLICATION.md`), organization name/website edits (see `ORGANIZATION_IDENTITY.md`), creator-page creation/effective edits (see `CREATOR_PUBLICATION.md`), campaign creation, vanity URL changes, comments, campaign-update creation and effective edits, including the organization-team update route. This does not yet cover all UGC or establish store approval.

## Admission and privacy

- The application services require a publication admission dependency; missing wiring fails closed. Production wires `MongoPublicationAdmission`. Existing unrelated integration fixtures inject a permissive test double; the dedicated publication integration suite uses the real service, real isolated MongoDB and a controlled screener. There is no production environment bypass.
- Comments and updates provide a complete proposed text version. Edit decisions also bind the original update timestamp. The SHA-256 fingerprint includes actor, action, resource, base version, text and ordered media URLs. An approval for another author, resource or version cannot authorize a changed submission.
- Web/native comment composers and the web update/team composers start with unchecked optional permission to send this public text to OpenAI's moderation endpoint. Without permission, staff review the private proposal. Media always requires staff inspection; it is not sent to the text screener. No private KYC document or billing identity is included in this integration.
- Opted-in text is screened before public persistence. Flagged text, unavailable/malformed provider results and interrupted screening remain private pending work. A provider failure never becomes approval. Concurrent requests share one durable review record, and an in-flight automatic result cannot overwrite a final staff decision.
- On approved admission, the stored account, current terms and publishing restriction are checked again after screening. Update saves compare the loaded version and refuse concurrent overwrite or restoration after deletion. Pinning also compares the loaded version.
- Existing published update text stays visible when a replacement is held; the proposed replacement remains private. New held comments/updates have no public record. Financial totals, payment submission and the GHS 250,000 campaign rule are unaffected.

## Author and staff workflow

Settings → Publication reviews lists only the current author's proposed versions, statuses and author-visible review notes. Account changes remount viewer state. Responses are private/no-store. Authors keep the draft, check the decision, then resubmit the same version within seven days of approval. Changed or expired versions cannot reuse approval. Declined versions remain declined; the interface provides the support address and reference for appeal. There is no automatic publishing or payment replay from a staff decision.

Admin → Publication reviews shows pending text/media evidence, pagination and final decisions. The action center counts pending work. An administrator must inspect the complete version and all media, provide at least 20 characters of author-visible notes, and cannot review their own submission. Decision and audit record commit atomically. Matching retries preserve the original decision; conflicting retries receive 409. Actual media inspection, staff response times and escalation/appeal procedures require operational verification.

Proposed-version records have a 30-day `purgeAt` TTL index; MongoDB deletion is scheduled, not instantaneous. Operational proposal records are also removed by account-erasure cleanup, preserving the user tombstone and separate audit record. The Privacy Notice describes this lifecycle. Deployment must verify the TTL index, backup handling, processor retention, staff/audit retention and any lawful hold procedure; an application TTL does not establish deletion from every processor or backup.

## Verification

- Dedicated real-admission/lifecycle/provider/action-center suite: 10 tests pass. Covers no-consent/no-cloud behavior, concurrent deduplication, private evidence, exact-version restart/resubmission, different author/text, allowed/flagged/failed screening, media hold, merged edits, concurrent edit fencing, transactional audit rollback, immutable retries, restrictions during screening, organization-team wiring, staff self-review denial, rejected/expired versions, TTL metadata and account-erasure cleanup. The real provider adapter tests malformed and failed responses without live calls.
- Earlier combined publication/update/team run: 11 tests pass. The stable full API baseline completed successfully: 123 files / 836 tests. No API or imported shared source edits occurred during that invocation. Later campaign-visibility changes have separate focused acceptance evidence in `CAMPAIGN_VISIBILITY.md`.
- Five focused web composer/review/block/logout tests and one admin decision test pass; subsequent full web/admin/marketing suites pass 125/39/8 tests. Four-app type and affected lint checks pass at the current checkpoints. Web/admin builds, native 43-test suite and iOS/Android/web export pass.
- Mocked 390px comment hold/resubmit browser flow passes. Screenshot inspected: draft, unchecked permission, explanatory text and held response fit the viewport. Real API tests separately establish durable behavior. No real provider text, report, email or money was sent.

## Remaining C09 scope

Legacy-public-campaign rollout and any future general campaign edit; public member/organization profile fields and profile publication; donation/supporter public attribution; media uploads and immutable media inspection; live metadata/live audio/video; every public projection; legacy content; staffed escalation and provider/language validation remain open. The next extension must reuse a full proposed-version admission boundary and preserve the independent high-goal financial approval rule. Text moderation alone does not establish media, factual, scam, intellectual-property or fundraising authorization checks.

Policy sources rechecked: [Apple UGC requirements](https://developer.apple.com/app-store/review/guidelines/#user-generated-content), [Google UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en), [OpenAI moderation API](https://developers.openai.com/api/docs/guides/moderation).

## Campaign creation and URL extension

New campaigns require admission before saving any public or financially pending
campaign record. The private proposal contains the exact title, description,
category, priority, beneficiary labels, goal/currency, end date and ordered media
references. No payout recipient, collaborator email or private KYC evidence is
sent to screening. The owner can check and refresh review decisions inside the
web/native wizard while retaining the draft, then resubmit the same version.
The opt-in starts unchecked. A safety hold creates no campaign, split or invite.

Financial eligibility is separate: current account/plan limits are checked again
after admission, then the existing current-verification/prior-publication rule
determines whether goals above GHS 250,000 need financial review. A content
approval is not financial approval. Legacy campaign financial-review endpoints now record immutable content/version
evidence with explicit staff attestations; see `CAMPAIGN_STAFF_REVIEW.md`.

The existing vanity URL endpoint now screens the proposed slug and binds the
approval to actor, campaign and previous slug. It compares and updates only the
slug field; concurrent donation totals or a moderation block cannot be replaced
by a stale campaign entity. A different concurrent URL produces a conflict.
No general title/story/goal editing endpoint exists in the inspected current
router; campaign-news edits retain their separate full-version review.

Real-service campaign/comment/update/financial-policy regression run: 34 tests
in five files pass. The final campaign-plus-unit run passes 13 tests, including
the added missing-dependency check and staff role revocation during screening.
The mocked 390px campaign hold, decision refresh and exact resubmission flow
passes; the final screenshot was inspected. Drafts/opt-ins remount per account,
and unmounted creation flows stop subsequent split/invitation work.

The full web suite initially passed 131 tests with one outdated review-copy
assertion; the corrected and expanded review file passes all four tests. Two
admin review tests and all 59 native tests pass. API/web/admin/native type checks,
affected lint and the web build pass. Final iOS/Android/web native exports pass
after the shared privacy-notice change; the new notice is present in each final
bundle. No live screening provider, email, production campaign or money was used.
Large-bundle advisories and physical-device/provider evidence remain separate
release work. This is focused plus full-run-and-correction evidence, not a claim
that a new complete monorepo release sweep has passed.
