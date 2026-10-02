# Creator-page publication — 13 September 2026

Engineering implementation covers new creator pages and effective public edits. General account/member and organization profiles, supporter attribution, legacy content and media inspection remain separate open requirements.

## Behavior and boundaries

- `SaveCreatorProfileUseCase` merges optional edits with the stored page before reviewing the entire proposed version: handle, display name, tagline, biography, photo/cover slots, tip availability, preset amounts, currency and thank-you text. Omitted fields retain their saved values. Strict HTTP validation rejects unknown fields, invalid/oversized media URLs, unsupported currencies and invalid amounts.
- Admission binds the owner, `creator.profile` action, resource, stored revision, all proposed fields and ordered media. Unchecked automated-review consent selects private staff review. Flagged/unavailable screening also holds the version privately. Media requires staff review and is not submitted to the text screener. A hold creates no new public page or balance; existing public content remains unchanged.
- Staff decisions use the existing private publication queue. A version held before publishing on approval, or while it is switched off, keeps the exact-version resubmission flow; with it switched on, an approval publishes the page by itself (below). Changed content, photo/cover placement or base revision requires a new decision. Production requires the admission dependency; unrelated integration fixtures deliberately isolate their feature with a permissive test double.
- Final persistence compares the original creator revision and writes only creator-page fields. A real account write inside the transaction fences closure/credential changes; current agreement and publishing restrictions are checked again. The profile, account fence and balance initialization commit together. A balance failure rolls back profile creation. Balances and settlement references are never replaced by a profile edit.
- Exact `{ tipsEnabled: false }` remains available without a paid plan, current agreement or unrestricted publishing status. It cannot carry another public edit. Pausing preserves the current page and money and invalidates prior-version approvals.
- Public creator pages now use their explicitly saved, reviewed photo and cover. Account photo changes no longer appear through a dynamic fallback. Web/native offer “Use account photo and cover” to copy images into a draft for review, with previews and clearing. Existing pages that relied solely on the account fallback show the normal branded placeholder until their creator images are submitted and approved; no automatic legacy approval is created.
- Web/native forms start automated consent unchecked, preserve held drafts, show publication decisions and offer a separate “Pause tips now” action that retains other draft fields. Creator form state is keyed by signed-in account; stale saves cannot trigger a new-account reload. Reads return `Cache-Control: private, no-store`.

## Publishing on approval (2 October 2026)

With `PUBLISH_ON_APPROVAL_ENABLED` on, a staff approval publishes a held creator page by itself (see `PUBLICATION_REVIEWS.md`, "Publishing on approval"). The creator does not save it again.

- **Before publishing.** It first checks, as the creator's own save does:
  - the plan still includes a creator page (otherwise `plan_ineligible`, "Your plan no longer includes a creator page.");
  - nobody else holds the handle (otherwise `handle_taken`, "Someone else has that handle now.");
  - the page is still the revision the change was proposed against. A first page ends as `superseded` if a page exists by then.
- **The same write as the creator's own save.** It publishes through `MongoCreatorProfileRepository.save`, inside the transaction that records the publication. That write fences the credentials, closure, restriction and agreement, compares the revision, and creates the balance row with a first page.
- **Duplicate-key races.** A handle or first page claimed between the checks and the write is classified by the same checks.
- **Every save moves the revision on.** That includes "Pause tips now" and removing a photo, so a held edit proposed before a pause ends as `superseded` (`edited_since_submitted`) instead of switching tips back on.
- **Saving the live page.** Saving the page exactly as it is live writes nothing and bumps nothing. It still takes back every held or approved-but-unpublished version: an older app saving after an approval published the page, a creator reverting a held edit, or an empty photo taking back a held one.
- **Older apps.** If the exact page the request sends is already published, the page is returned as it is.
- **Single-use.** An approval is consumed by whichever publishes the page first: the approval itself, or the creator's own save.

## Verification

- Real-admission integration suite: 8 tests pass using isolated local MongoDB and mocked text screening. Covers private holds, duplicate reviews, exact approved resubmission, merged edits, image-slot binding, account-image isolation, pausing despite restrictions/expired plans, balance preservation, stale revisions/approvals, provider outages, credential rotation, closure, transaction rollback and malformed HTTP payloads.
- Existing creator tip and withdrawal integration suites also pass: 22 tests across all three files. API type check and lint pass. No API/shared source changed during the test invocation.
- Native logic suite: 59 tests pass; native type/lint and iOS/Android/web exports pass. Web/admin type/lint and production builds pass, with existing chunk-size advisories. Three admin review tests pass, including creator evidence.
- Web broad run: 133 passes and one live-page readiness timeout. The initial creator fixture lacked the auth context introduced for account isolation; it was corrected. Final focused live/subscription/publication run passes all 13 tests without changing the live test. This is bounded evidence, not a claim of a clean final full-repository release sweep.
- Mocked 390px phone workflow passes: unchecked consent, held draft, separate exact pause payload, retained biography, decision refresh and exact approved resubmission. Screenshot inspected; no horizontal overflow or page errors. No live provider screening, payment, public publication or external message was performed.

## Remaining operational evidence

Staff must inspect each actual media asset, with immutable asset identity and a documented response process; a URL fingerprint cannot guarantee that remote bytes remain unchanged. Real moderation-provider terms, language coverage and retention remain unverified. Stored legacy creator content is not retrospectively screened by this change. General member/organization profile admission and every name/supporter/live projection still need their own coverage. This slice does not certify legal compliance or store acceptance.
