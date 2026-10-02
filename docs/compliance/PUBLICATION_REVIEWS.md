# Preventive publication review — 12 September 2026

Engineering implemented for account identity edits/private-to-public changes (see `ACCOUNT_PUBLICATION.md`), organization name/website edits (see `ORGANIZATION_IDENTITY.md`), creator-page creation/effective edits (see `CREATOR_PUBLICATION.md`), vanity URL changes, comments, campaign-update creation and effective edits, including the organization-team update route. Campaign creation runs the same admission checks, but since 30 September 2026 a new campaign that needs a person is saved as Pending review for the campaign staff review instead of being held as a private proposal (see "Campaign creation" below). Built on 2 October 2026 behind `PUBLISH_ON_APPROVAL_ENABLED`, which stays off until it is switched on in production (`LEGAL_REVISIONS.md` records when), a staff approval publishes the held version of eight of these actions without the author submitting it again (see "Publishing on approval" below). This does not yet cover all UGC or establish store approval.

## Admission and privacy

- The application services require a publication admission dependency; missing wiring fails closed. Production wires `MongoPublicationAdmission`. Existing unrelated integration fixtures inject a permissive test double; the dedicated publication integration suite uses the real service, real isolated MongoDB and a controlled screener. There is no production environment bypass.
- Comments and updates provide a complete proposed text version. Edit decisions also bind the original update timestamp. The SHA-256 fingerprint includes actor, action, resource, base version, text and ordered media URLs. An approval for another author, resource or version cannot authorize a changed submission.
- Web/native comment composers and the web update/team composers start with unchecked optional permission to send this public text to OpenAI's moderation endpoint. Without permission, staff review the private proposal. New media always requires staff inspection; it is not sent to the text screener. Images that are unchanged and already public (an account or creator photo on a name change, or a comment author's staff-reviewed avatar) are bound into the screened text instead, and removing an image applies immediately (see `ACCOUNT_PUBLICATION.md`). No private KYC document or billing identity is included in this integration.
- Opted-in text is screened before public persistence. Flagged text, unavailable/malformed provider results and interrupted screening remain private pending work. A provider failure never becomes approval. Concurrent requests share one durable review record, and an in-flight automatic result cannot overwrite a final staff decision.
- On approved admission, the stored account, current terms and publishing restriction are checked again after screening. Update saves compare the loaded version and refuse concurrent overwrite or restoration after deletion. Pinning also compares the loaded version.
- Existing published update text stays visible when a replacement is held; the proposed replacement remains private. New held comments/updates have no public record. Financial totals, payment submission and the GHS 250,000 campaign rule are unaffected.

## Author and staff workflow

Settings → Publication reviews lists only the current author's proposed versions, statuses and author-visible review notes. Account changes remount viewer state. Responses are private/no-store. Authors keep the draft, check the decision, then resubmit the same version within seven days of approval, unless publishing on approval applies: with the switch on, an approval publishes a version of the eight publish-on-approval actions by itself, and authors can withdraw a waiting version. Live-session titles, campaign proposals and anything held while the switch was off keep the resubmission rule. Some of this work applies from the deploy, with the switch on or off (see "What the switch does not control"). Web and native keep the held profile image and held identity change on the author's browser/device (per account, up to 30 days, cleared on sign-out, and cleared when the author withdraws that version) so the exact version survives closing the tab or dialog. The unsent campaign draft is kept the same way so nothing typed is lost and a resubmit after a lost response reuses its creation key; a new campaign itself is never held for resubmission (see "Campaign creation"). Changed versions cannot reuse approval. An expired approval never authorizes publication again: resubmitting that exact version re-queues it for a fresh decision (screening when consented, otherwise staff) instead of being refused until the record is purged. Screener failures are logged (`Publication screener unavailable; routed to staff review`) and routed to staff. Declined versions remain declined; the interface provides the support address and reference for appeal. A staff decision never replays a payment. While the switch is off there is no automatic publishing from a staff decision either; with it on, that principle is replaced for eight actions (see "Publishing on approval").

Admin → Publication reviews shows pending text/media evidence, pagination and final decisions. The action center counts pending work. An administrator must inspect the complete version and all media, provide at least 20 characters of author-visible notes, and cannot review their own submission. From the publishing-on-approval deploy (2 October 2026), with the switch on or off, they also cannot decide content for a campaign or organization they manage, and the decision re-checks their current administrator access (see "Publishing on approval"). Decision and audit record commit atomically. Matching retries preserve the original decision; conflicting retries receive 409. Actual media inspection, staff response times and escalation/appeal procedures require operational verification.

Staff review context (1 October 2026): the staff list (`GET /admin/publication-reviews`) also returns, per item, `baseVersion`, `reviewedAt`, `purgeAt`, `author` (the submitting account: name, email, account type, organization name, verification level, email-verified and closed flags), `profileAccount` when a team member proposes an organization profile change, `campaign` (title, slug, status, owner and deleted flag) for comment, update, update-edit (resolved through the update), live, web-address and thank-you actions, and `reviewer` (name, or automated screening) once decided. A key is absent when it does not apply and `null` when the id is not a stored record (fixtures, deleted records). The response also carries `campaignReviewGoalGhs`, the GHS goal above which a created campaign waits for a separate staff campaign review. Lookups are batched: at most three queries per page whatever its size. An optional `action` query (for example `campaign.create`) narrows the staff list; an invalid value is ignored like an invalid status. The author mount (`/publication-reviews`) was unchanged by that work; on 2 October 2026 it gained the publishing fields and withdrawal (see "Publishing on approval"). The decision endpoint's 409 responses now also carry `errors.review: ['decided']`, so the admin card can title the refusal; the message and status are unchanged. The admin card lays out every submitted field (unrecognised or wrongly typed values appear under "Other submitted fields"), renders author text as plain text only, keeps the exact stored text, ids, versions and media list behind "Show submitted text", and shows an approval as valid until its expiry or the record's `purgeAt`, whichever comes first: the approval is deleted with the record even though `approvalExpiresAt` itself is still set seven days after the decision. Reviewer guidance (what approval does, the post-decision confirmation) lives in one admin module, `apps/admin/src/lib/reviewGuidance.ts`, so it can follow behaviour changes.

Proposed-version records have a 30-day `purgeAt` TTL index; MongoDB deletion is scheduled, not instantaneous. Operational proposal records are also removed by account-erasure cleanup, preserving the user tombstone and separate audit record. Before deletion, the media URLs of held, declined or approved review versions are added to the account-deletion request so the uploaded assets can still be found and removed. The Privacy Notice describes this lifecycle. Deployment must verify the TTL index, backup handling, processor retention, staff/audit retention and any lawful hold procedure; an application TTL does not establish deletion from every processor or backup.

## Publishing on approval (2 October 2026)

### Owner decisions

- **30 September 2026**, choosing "Publish automatically (Recommended)": "It goes live the moment staff approve it, with no resubmitting. The same checks run at that moment (account still allowed, terms accepted). If the author has edited that item since submitting, they're asked to submit the new version instead. Live-session titles are excluded, because you start a live yourself."
- **1 October 2026**, "take all the recommended actions for me", which settled the six open questions:
  1. approvals for these actions are single-use;
  2. versions submitted before the switch keep the old rule;
  3. versions sent by older app builds also publish on approval;
  4. staff may not decide content for a campaign or organization they manage;
  5. the author's own thank-you Send gets the restriction and agreement checks;
  6. author notices are in-app only.

### The principle changed

- **Before:** "There is no automatic publishing or payment replay from a staff decision." Authors resubmitted the same version within seven days of approval.
- **Now:** for eight actions, a staff approval publishes the exact approved version as if the author had resubmitted it at that moment. Every check of the author's own request runs again in the publishing transaction, plus an unchanged-credentials check. If any check fails, nothing is published and the author is told why. Live-session titles and campaign proposals are never published by approval, and an approval never moves money. Authors control an unpublished version by withdrawing it or by submitting a newer version, which supersedes the older one. Approvals for these actions are single-use.

The eight actions (`AUTO_PUBLISH_ACTIONS`, `packages/types/src/publication-publishing.ts`) are: account identity (`account.profile`), organization name and website (`organization.profile`), creator page (`creator.profile`), comment (`comment.create`), campaign update (`update.create`), update edit (`update.edit`), donor thank-you message (`thank_you.send`) and campaign web address (`campaign.slug`). A live session (`live.start`) keeps "approve, then the host starts it". A campaign proposal stored before 30 September 2026 (`campaign.create`) keeps "approve, then the creator submits it again".

### Switch, cut-over and backlog

- **The switch.** `PUBLISH_ON_APPROVAL_ENABLED` (config `publishOnApprovalEnabled`) is off by default, and `render.yaml` sets it to `"false"`. Turn it on only once the API, web, native and admin releases are all deployed. The Privacy and Cookie notices dated 2 October 2026 are true with the switch on or off, so they ship with those releases, not on the switch-on day. Record the deploy and switch-on times in `LEGAL_REVISIONS.md`.
- **Which versions publish on approval.** Only a version submitted with the switch on, and with the request's verified credential version. A version is also covered if its author submits it again with the switch on while it still waits for a decision. Such a version's record carries `publishOnApproval: true` and the credential digest.
- **The backlog.** Everything held while the switch was off keeps "approve, then submit again" for good. Approving it sends the author the "approved" notice with the deadline. Nothing is published in bulk when the switch goes on.
- **Screening approvals.** An approval by automated screening is published by the author's own request, as before, and never carries `publishOnApproval`.

### The decision

`PUT /admin/publication-reviews/:id/review` (`MongoPublicationReviewDecision`) runs in one transaction:

1. **Staff fence.** The reviewer must still be an open administrator account using the session's credential version. The check is a real write, so a concurrent demotion, closure or password change conflicts with the decision. Otherwise: 403 'Current administrator access is required'.
2. **Self-review.** 403 'Another administrator must review your content' (the reviewer wrote this version).
3. **Conflict of interest.** 403 'Another administrator must review content for a campaign or organization you manage', with `errors.review: ['conflict']`. It applies to approving and declining alike. The reviewer may not decide a version:
   - written by, or changing, an organization they belong to as an active member (in any role);
   - for a campaign they own, benefit from, or help run as an active admin or editor of its organization (an update edit reaches its campaign through the update).

   A single-admin deployment needs a second administrator for these items.
4. **Closed versions.** A version closed before any decision answers 409 'The author withdrew this version.' (`errors.review: ['withdrawn']`) or 409 'The author replaced this version with a newer one.' (`['superseded']`). A decided version answers 409 'A final decision already exists for this version'. A lost race answers 409 'Another reviewer already decided this submission' (both `['decided']`). An identical retry (same decision, reviewer and notes) answers with where the version stands, and runs a publication attempt only if one is due.
5. **The decision.** A compare-and-set on the waiting version. An approval lasts until the earlier of seven days and the record's purge time. An approval that publishes by itself is queued (`publishState: queued`). Any other decision removes `publishOnApproval` and the credential digest.
6. **Audit and notice.** The audit is `publication.approved` or `publication.rejected`, with "publishes on approval: yes" or "no". The author is notified of a decline, or of an approval that does not publish by itself.

After the commit the response waits up to 8 seconds for the first attempt. It answers `{ reviewed: true, publishOnApproval, publication?: { state, reason?, at? } }`. The state is `publishing`, `published`, `not_published`, `superseded` or `withdrawn`. A committed decision is never answered with an error.

### Publishing

`PublicationApplier`, `MongoPublicationApplyStore` and one handler per action (`publication-apply/`). An attempt claims the approved version under a 120-second lease, then:

1. **Window guard.** If the approval ends within 60 seconds, or the record within 5 minutes, the attempt ends as `not_published` / `approval_expired`.
2. **Read.** A stored version that cannot be read ends as `unreadable`.
3. **Author checks.**
   - account open (else `account_unavailable`);
   - credential digest unchanged (else `credentials_changed`);
   - no publishing restriction (else `restricted`);
   - the current agreement accepted, unless the author is staff (else `terms_not_accepted`).
4. **The action's own writer.** This is the transactional code of the author's own request. It repeats the author checks as fences and adds the action's own:
   - comments: campaign status, blocks and the reviewed name and photo;
   - team updates and organization details: the organization, the membership and the role;
   - edits: the update's or page's revision, the identity version, or the previous web address. If it moved, the version ends as `superseded` / `edited_since_submitted`;
   - creator pages: the plan and the handle;
   - thank-you messages: the author's role and the beneficiary's consent, a restriction on the organizer, eligibility, the draft and the send limit;
   - web addresses: the address is still free, and the author is still the owner or an administrator.
5. **Publication.** Inside that same transaction, a compare-and-set on the lease token records the version as published (`publishedVia: approval`, `publishedResourceId`). It is audited as `publication.published` by `system:publication-applier`, and the author is notified.

Exactly once: the content and the move to `published` commit together. Another attempt, the author's own request, a withdrawal or a newer version can each write the record first. Whichever does wins, and the others fail.

### Outcomes

The author's and staff's wording comes from `publicationOutcomeCopy` in `@ubuntu-fund/types`. Each reason also says whether the author can submit the same version again, should submit a new one, or can do nothing here.

| State | Reasons |
| --- | --- |
| `published` | via the approval or the author's own request |
| `not_published` | `account_unavailable`, `credentials_changed`, `restricted`, `organizer_restricted`, `terms_not_accepted`, `organization_terms_not_accepted`, `permission_changed`, `item_unavailable`, `identity_changed`, `blocked`, `plan_ineligible`, `handle_taken`, `address_taken`, `thank_you_disabled`, `thank_you_limit_reached`, `thank_you_no_donors`, `thank_you_not_eligible`, `campaign_unavailable`, `approval_expired`, `unreadable`, `unavailable` |
| `superseded` | `edited_since_submitted` (the item changed after submission), `newer_version_submitted` |
| `withdrawn` | `withdrawn_by_author` |

While the approval lasts, the author can also publish the version themselves by submitting the same version again (`publishedVia: author`), if it is still queued, still publishing, or could not be published. Once the approval has run out, submitting it again reopens it for a new review instead (see "Reopening"), and the author's wording says so.

### Retries and the sweeper

- **Retries.** A failure that is not an expected refusal (a write conflict, a duplicate key, a timeout, the network) is retried after 15 s, 1 min, 5 min, 15 min, 1 h, 3 h and 6 h, each ±20%. The eighth failed attempt ends as `not_published` / `unavailable` and is logged as an error. So does a retry that would fall outside the approval or record window.
- **The sweeper.** Every API instance sweeps due versions every 30 seconds and once at boot: up to 20 per sweep, the longest waiting first, one at a time. Claims are atomic, so several instances can sweep at once. An attempt whose lease expired (a crashed instance) is taken over, and the stalled attempt can then neither publish nor end it.

### The kill switch is sticky

Switching `PUBLISH_ON_APPROVAL_ENABLED` off:

- decisions stop queueing publications, and new submissions are held the old way (approve, then submit again). What the switch does not control carries on (below);
- no attempt runs;
- each sweep returns approved versions still waiting to publish to their authors as plain approvals. Each is audited `publication.returned_to_author`, and its author gets the "approved" notice with the deadline. A waiting version whose approval has already ended ends as `not_published` / `approval_expired`.

A returned version stays a plain approval even if the switch is turned on again. While the switch is off, the author's list shows a waiting approval as approved, with the "submit it again" hint, and no response claims `publishOnApproval`.

### What the switch does not control

These apply from the deploy, with the switch on or off:

- **Single-use approvals** and the in-app decision notices (below).
- **The staff fence, self-review and conflict of interest** on every decision.
- **Newer versions replace older ones**, at submission and when the live item is saved unchanged. So with the switch off, staff can still get 409 'The author replaced this version with a newer one.' on an older version.
- **Private settings** sent with a held identity change are saved at once (`errors.saved: ['private']`).
- **Withdrawal.** `POST /publication-reviews/:id/withdraw` works on the author's open versions either way. The lists offer it (`canWithdraw`) while the switch is on; while it is off, only on a version submitted while it was on, which its approval might still publish once the switch is back on. Everything held while it is off lists exactly as before.

### What authors control

- **Withdraw.** `POST /publication-reviews/:id/withdraw` works on the author's own version of the eight actions while it waits or is approved but unpublished. It answers `{ withdrawn: true }` and is idempotent. The refusals are:
  - 409 once published (`errors.publication: ['published']`), saying what to do instead: 'Already published. Delete or change it instead.' (comments and new updates), "Already approved: we're emailing your donors, so it can't be withdrawn." (thank-you messages) or 'Already published. Change it instead.' (everything else);
  - 409 "Declined versions can't be withdrawn.";
  - 409 'You already replaced this version.';
  - 409 "This version can't be withdrawn." (a version that never publishes by itself: a live-session title, a campaign proposal, or a plain approval its author publishes by submitting it again);
  - 409 'This version changed. Refresh Publication reviews and try again.';
  - 404 for anyone else's version.

  A withdrawal is audited `publication.withdrawn`. It has no restriction or agreement gate, because it publishes nothing. It wins over an attempt that has not committed.
- **Newer versions replace older ones.** This covers the six single-item actions: account identity, organization details, creator page, web address, update edit and thank-you message (one per campaign). A newer submission closes every earlier version of the same item, whoever submitted it, if that version is still waiting (`status: superseded`) or approved but unpublished (`publishState: superseded`, `newer_version_submitted`). When the earlier version is another author's, or already approved, the change is audited `publication.superseded`. Another author is also told in the app.
- **Saving the live version.** Saving a creator page, organization details, web address or update exactly as it is live closes those earlier versions too, without writing anything. That is how an author takes back a held change, and it makes an older app's repeat save after an approval a no-op. For account identity, an unchanged save keeps a held change current, but hiding the profile or removing a photo takes back a held "make it public" or a held photo.
- **Reopening.** Submitting a closed version again reopens it for a fresh decision: one superseded or withdrawn, or an approval that expired unpublished. So does a web address that returns after it was published (A→X→A→X). No other published version is ever reopened.
- **Private settings.** A held identity change no longer holds back the account's private settings sent with it. They are saved at once, and the 409 adds `errors.saved: ['private']`.

### Single-use approvals (I153 closed for these actions)

This applies from the deploy, with the switch on or off. The author's own request consumes an approval of these actions: the version is recorded as `publishedVia: author` and audited `publication.published`. The same version is never published twice while its record exists (30 days):

- **Comments and updates.** The identical post again returns the existing post (201). Once it was deleted, the API answers 409 'You already posted this exact comment; change it to post again.' or 'You already posted this exact update; change it to post again.'
- **Profiles, organization details, creator page, web address.** An identical save changes nothing.
- **Thank-you messages.** Once a message is queued there is no draft left to send, so sending again answers the send limit or 'Save your message before sending it.'
- **Anywhere the item cannot be returned.** The API answers 409 'This version is already published.' (`errors.publication: ['published']`).

Approvals of live-session titles and of campaign proposals from before 30 September 2026 stay reusable within their window, so I153 still applies to those.

### Held message

The held 409 now has two forms:

- **Publishes on approval.** It carries `errors.publication: ['held', 'publishes_on_approval']` and says: 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.'
- **Manual.** It carries `['held']` and keeps: 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.'

The shared first sentence keeps older apps showing their neutral "waiting for review" notice. Their versions also publish on approval (owner decision). Their screen still says to save again, which is harmless: the author is notified when it is live, and saving again repeats the same post or changes nothing.

### Notices

Authors are told in their notification inbox only, with no email or push:

- the notices are service notices (`type: staff_decision`), keyed per decision so none is sent twice, and skipped for closed accounts;
- they never carry the content, the reviewer's notes or the credential digest;
- the wording is `publicationOutcomeCopy`'s, and the deadline is shown in Ghana time, for example "9 Oct 2026, 14:05 GMT".

| Outcome | Title | Body |
| --- | --- | --- |
| Published | "Your {item} is live" ("…are live" for organization details); thank-you: "Your thank-you message was approved" | Per action, e.g. "Approved and posted on the campaign."; thank-you: "Approved; we're emailing your donors and will send you a delivery summary." |
| Not published | "Your {item} wasn't published" | The reason and the next step, e.g. "Your sign-in details changed since you submitted it (a password or two-step verification change). Save it again before {deadline} to publish it straight away." Once the approval has run out: "Save it again to request a new review." A comment or new update form clears once it is held, so those say "Post it again if you still want it published." |
| Changed since submitted | "Your earlier {item} wasn't published" | "It changed after you submitted it, so this version wasn't published. Submit your latest version if it still needs review." |
| Replaced by another author's version | "Your earlier {item} wasn't published" | "You (or your team) submitted a newer version." |
| Declined | "Your {item} wasn't approved" | "Read the reviewer's note in Publication reviews." |
| Approved, not published by the approval | "Your {item} was approved" | "Approved. Save it again unchanged before {deadline} to publish it." (the form's own verb: post, send or save); a live session: "Approved. Start the session again with the same title and goal before {deadline}." |

- **Where a notice links.**
  - "Live" notices open the item: `/campaigns/<id>` (comment, update, update edit, web address), `/campaigns/<id>/thank-you`, `/profile`, `/organization-team` or `/creator`. In the app, the thank-you link opens the thank-you composer, and `/organization-team` opens Edit profile for an organization account (where its name and website are edited) and Invitations for anyone else.
  - An approved live session opens `/campaigns/<id>/live`.
  - Every other notice opens `/settings#privacy` (Settings in the app).
- **When notices are sent.** Decision notices go out for every decision from this deploy, with the switch on or off. The thank-you worker's delivery notice still follows separately.

### Audit actions

None of these carries the content.

| Action | Recorded by |
| --- | --- |
| `publication.approved`, `publication.rejected` | The deciding administrator, with "publishes on approval: yes" or "no" and the notes as the reason |
| `publication.published` | `system:publication-applier` (role `system`, path `internal:publication.published`), naming the published resource and the approving reviewer; or the author, when their own request publishes the version |
| `publication.not_published`, `publication.superseded` | The applier, with the reason in `changes`. `publication.superseded` is also written by the submitting author when their newer version, or a save of the live item, replaces an approved version or another author's version |
| `publication.withdrawn` | The author |
| `publication.returned_to_author` | The applier, while the switch is off |

Each action's own audit is written in the same transaction and names the review:

- `organization.profile.updated` adds "via approved review {id}";
- `donor_thank_you.submitted` adds "on the approval of publication review {id}";
- `campaign.slug_changed` adds "on the approval of publication review {id}". The owner's own address change is now audited too.

### The stored credential digest

- **What it is.** `credentialDigest` is a SHA-256 of `['publication-credential', 1, userId, authVersion]` (`apps/api/src/domain/services/publicationCredential.ts`). The raw credential version is never stored on the review.
- **When it changes.** The credential version changes on a password change or reset, and when two-step verification is turned on or off or its recovery codes are regenerated. It never changes on sign-in or token refresh.
- **When it is kept.** It is stored with a version that publishes on approval, and refreshed when the author submits it again.
- **Who can see it.** No one. It is never selected by default (`select: false`), and never appears in author or staff responses, exports, audits, notices or logs.
- **When it is removed.** It is removed when a decision does not queue a publication, when screening approves the version, and when the switch returns an approval. It is deleted with the record (30-day TTL, or account erasure).

A mismatch ends the attempt as `credentials_changed`. While the approval lasts, the author's new session can publish the same version straight away. The Privacy Notice discloses the digest.

### Projections

- **Author (`GET /publication-reviews`).**
  - `publishOnApproval` is always false while the switch is off;
  - `publication { state, reason?, at? }`: `queued` and `applying` read as `publishing`, which is hidden while the switch is off; a version closed before a decision shows as `superseded` or `withdrawn`;
  - `canWithdraw`: while the switch is off, only for a version submitted while it was on (see "What the switch does not control").
- **Staff.**
  - `publishOnApproval`;
  - `publication { state, reason, at, via, attempts, nextAttemptAt, resourceId }`;
  - `applyOptions` (an update's pin) and `supersededBy`;
  - an optional `publishState` filter, where `publishing` means queued or applying.

Neither projection ever includes the digest or the lease.

### Verification (2 October 2026)

Run against a local test MongoDB with a controlled screener and a capturing email sender. No live provider, email, production content or money was used.

- **API.** The 17 publication-related files pass (309 tests). They are:
  - the publication-admission, lifecycle, apply-core, apply-campaign-content and apply-profiles suites;
  - the donor thank-you publication and donor thank-you suites;
  - the account, creator, organization and campaign admission suites;
  - the admin view, safety moderation and update-transaction suites;
  - the shared-wording, credential-digest and notice unit tests.

  They cover:
  - publishing exactly once, including two sweeping instances, a lease takeover, the author racing the approval, and screening racing staff;
  - every refusal reason, and the staff fence and conflict-of-interest rule;
  - withdrawal and supersession against a running attempt, and the window guard;
  - backoff and giving up, logged with codes only;
  - the sticky kill switch and the backlog rule;
  - older apps repeating a published version, and private settings saved on a hold;
  - thank-you messages queued once and emailed once, skipping unsubscribed and refunded donors;
  - the digest kept out of every response, notice and audit, and erased with the account.
- **Legal text.** `apps/marketing/__tests__/legalClaims.test.ts` passes (22 tests), including the new wording checks. The shared types package type-checks.

## Verification

- Dedicated real-admission/lifecycle/provider/action-center suite: 10 tests pass. Covers no-consent/no-cloud behavior, concurrent deduplication, private evidence, exact-version restart/resubmission, different author/text, allowed/flagged/failed screening, media hold, merged edits, concurrent edit fencing, transactional audit rollback, immutable retries, restrictions during screening, organization-team wiring, staff self-review denial, rejected/expired versions, TTL metadata and account-erasure cleanup. The real provider adapter tests malformed and failed responses without live calls.
- Earlier combined publication/update/team run: 11 tests pass. The stable full API baseline completed successfully: 123 files / 836 tests. No API or imported shared source edits occurred during that invocation. Later campaign-visibility changes have separate focused acceptance evidence in `CAMPAIGN_VISIBILITY.md`.
- Five focused web composer/review/block/logout tests and one admin decision test pass; subsequent full web/admin/marketing suites pass 125/39/8 tests. Four-app type and affected lint checks pass at the current checkpoints. Web/admin builds, native 43-test suite and iOS/Android/web export pass.
- Mocked 390px comment hold/resubmit browser flow passes. Screenshot inspected: draft, unchecked permission, explanatory text and held response fit the viewport. Real API tests separately establish durable behavior. No real provider text, report, email or money was sent.

## Remaining C09 scope

Legacy-public-campaign rollout and any future general campaign edit; public member/organization profile fields and profile publication; donation/supporter public attribution; media uploads and immutable media inspection; live metadata/live audio/video; every public projection; legacy content; staffed escalation and provider/language validation remain open. The next extension must reuse a full proposed-version admission boundary and preserve the independent high-goal financial approval rule. Text moderation alone does not establish media, factual, scam, intellectual-property or fundraising authorization checks.

Policy sources rechecked: [Apple UGC requirements](https://developer.apple.com/app-store/review/guidelines/#user-generated-content), [Google UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en), [OpenAI moderation API](https://developers.openai.com/api/docs/guides/moderation).

## Campaign creation

Owner decision, 30 September 2026: a new campaign that needs a human check is
saved straight away as Pending review and checked in the existing campaign staff
review. No private proposal is stored and nothing has to be resubmitted. This
replaced the proposal flow described under "Earlier campaign-creation evidence".

**Checked before anything is written.** `POST /campaigns` keeps every existing
eligibility, plan, verification and on-behalf check. The campaign admission
(`PublicationAdmissionPort.admitCampaign`) then applies the same content limits
(400), account availability (401), publishing restriction (403) and current
legal acceptance (428) checks as other publications, and refuses with 422 a
version that staff already declined, in Publication reviews or in the campaign
review (same fingerprint; see "Rejected or blocked while waiting"). The
admission writes nothing. Inside the creation transaction the account's
credential version, terms and restriction, the verification allowance and plan
limits are checked again, and so is a decline made in the meantime
(`commitCampaign`).

**Screened automatically.** Only a text-only campaign whose organizer ticked the
optional OpenAI permission (it starts unchecked). The screened text is the public
version: title, story, category, urgency, beneficiary labels, goal/currency, end
date and, on an on-behalf campaign, the beneficiary's public name, type,
relationship, reason and payout arrangement. The beneficiary's email address,
payout recipients, collaborator emails and KYC evidence are never sent. If
screening approves the text, the campaign is created under the usual rules:
live, unless the GHS 250,000 financial rule, the tier policy or the on-behalf
consent/staff-review settings hold it. An automated approval is not stored as a
separate review record; each submission is screened again. The evidence is kept
instead: every new campaign carries a private `contentAdmission` record (basis
`screening`, `prior_approval` or `staff_review`, the reason, the exact-version
fingerprint, when the organizer gave screening permission, which screener
answered and when, and any earlier proposal it relied on or replaced), and the
creation transaction writes a `campaign.content_admission` audit entry whose
resource is the campaign id. Neither is returned on any read. A later
beneficiary change is admitted the same way and replaces the record (with
`trigger: beneficiary_change`); each admission keeps its own audit entry.

The goal must be in whole pesewas (`goalAmount` has at most two decimals;
more is refused with 400, as for donations), and the version is
fingerprinted with the goal as it is stored, so the version a decline
rebuilds from the stored campaign is the version that was submitted.

**Sent to staff.** The campaign is created with status `pending_review` and a
recorded `contentReviewReason` when:

- it has new photos or video (`new_media`). Media is never sent to the text
  screener, with or without permission;
- the organizer did not give permission for automated screening
  (`no_screening_consent`);
- screening flagged the text (`screening_flagged`);
- screening was unavailable or failed (`screening_unavailable`). This is logged
  as `Publication screener unavailable; routed to staff review`; a provider
  failure is never treated as an approval.

The review-queue email (`campaignPendingReview`) goes to the review address for
these campaigns too, with a "Content check" line naming the reason, and the
Admin action center counts them with the other pending campaigns. Whenever an
existing campaign comes back to staff, the team is emailed again, each
occasion under its own idempotency key so the provider does not drop it as a
duplicate of the creation alert: a beneficiary change that reopened the
content check (with a "What changed" line), a beneficiary change that leaves a
campaign waiting for staff with no consent needed, a beneficiary named again
(by the organizer, or by a staff reassignment) for a check whose invitation
was withdrawn, a beneficiary's acceptance that leaves the campaign in review,
and a return to review when staff are the next to act. No alert goes out for
a campaign past its end date, which review refuses, nor for a return to
review that first needs the organizer to name the beneficiary again (see
"Rejected or blocked while waiting"). Web and native
tell the organizer the campaign is saved, why a person checks it, that it stays
private and closed to donations until approved, and point to My campaigns. No
review time is promised.

**Where staff review it.** Admin → Campaigns → the campaign → Staff decision
(see `CAMPAIGN_STAFF_REVIEW.md`). The panel names the content check under "Why it
is waiting" next to the full story and every media attachment, only while the
check is outstanding. Approval still needs at least 20 characters of notes and
both attestations (complete content and every media attachment; organizer,
beneficiary, goal and fundraising requirements). It clears the check
(`contentReviewClearedAt`/`By`) and makes the campaign live without any
resubmission; rejection keeps it private. A campaign that later returns to
review for another reason (a reopen, or the beneficiary's acceptance) no longer
shows the cleared check; a beneficiary change that screening did not clear
reopens it, and the panel then says the beneficiary's name and reason changed.

**On-behalf campaigns.** The beneficiary's invitation is not sent while the
content waits: it is stored as `held` (the address is kept privately, no token
is ever sent, no email is queued), the organizer cannot resend it (409), and a
beneficiary change or a staff reassignment replaces it with another held
invitation. So nobody outside the organizer and staff receives the title, story,
reason or media, and nobody can be linked as the beneficiary before the check.
Staff approve such a campaign before the beneficiary's consent: the approval
clears the content and sends the invitation in the same transaction, and the
campaign stays in review until they accept. Their acceptance then publishes it
only where it would have published screened content (consent was the only
hold: a low tier and no on-behalf staff review); otherwise staff approve it once
more after the acceptance, as for any on-behalf campaign, and are alerted when
the acceptance arrives. The beneficiary's acceptance can never publish content
that still waits for staff.

**Beneficiary changes are new content.** Before acceptance, before any money
and before the campaign's end date, the organizer (or an organization admin)
may name a different beneficiary. After the end date the change answers 409
and the panel no longer offers it: review refuses an ended campaign, so the
new invitation could never be sent. The new name and reason are public text nobody has checked, so
they are admitted like a new campaign's content (`PUT /campaigns/:id/beneficiary`
takes the same optional `automatedReviewConsent`, unticked by default in the
web dialog):

- the campaign's public version with the new details (never the email
  address) goes through the same admission as creation: the account,
  restriction and terms checks, a 422 for a version staff declined, and
  automated screening only with the organizer's permission. The photos and
  video are unchanged and were already checked, so they do not send it to
  staff. An organization admin making the change must not be restricted from
  publishing either;
- screening approves it: the invitation is sent straight away, the
  campaign's own consent rule still applies (the acceptance publishes it
  where it would have), and the consent history records the change with
  `admission: screening`;
- no permission, a flag or an unavailable screener: the campaign's content
  check reopens with that reason (`contentReviewReason`, `contentReviewTrigger:
  beneficiary_change`, `contentReviewClearedAt` removed), the new invitation is
  held, consent cannot publish it until staff clear it (then the campaign's own
  rule applies again), staff are alerted, and the organizer is told the
  invitation goes out once our team has checked the campaign;
- while a content check is already outstanding, that check covers the change:
  it is held without being screened. When that check had nobody to invite
  (its invitation was withdrawn when staff declined the content), naming the
  beneficiary is what lets staff finish it, so they are alerted then.

The decision is private evidence like creation's (`contentAdmission` with
`trigger`, and a `campaign.content_admission` audit entry for the change). A
change covered by an outstanding check, and a staff reassignment, are not
admitted on their own: they remove the fingerprint from the campaign's
admission record, which described the version they replace (the audit entry
keeps it), so a later staff decision binds only the version staff saw. A
campaign whose check a beneficiary change reopened keeps its lifetime
verification slot even if the change is then rejected: its content was admitted
at creation. This replaces the first review round's rule that every change
switched consent publication off: an admitted change no longer needs it, and
an unadmitted one waits for staff anyway.

**What the organizer is told.** The beneficiary details now carry `nextStep`
(`content_check`, `name_beneficiary`, `consent`, `staff_after_consent` or
`staff`), computed from the campaign's own rules, and web and native show it:
"The campaign goes live as soon as … accepts", "When … accepts, our team
checks the campaign before it goes live" or "Our team is checking the campaign
before it goes live". The web change dialog explains that the new details are
checked before anyone is invited, and its confirmation follows the server's
answer. The acceptance notice says "Our team now checks it before it goes
live" when it stays in review. An invitation withdrawn unsent (see
"Retention") is described as "No invitation is waiting for …" (with "Change
the beneficiary to send a new one" only while that is still possible), it has
no sent date or expiry, and it cannot be resent. `name_beneficiary` is a
declined campaign back in review with its invitation withdrawn: web says "Our
team can finish checking the campaign once you name the beneficiary again",
native says "No invitation is waiting for the beneficiary" and "Name the
beneficiary again so our team can finish checking the campaign", and the
change dialog offers no screening, since the outstanding check covers the
change.

**Rules for campaigns from before these were recorded.** After a rejection or
a block in the campaign review, only a new staff approval publishes an
on-behalf campaign, never consent alone: blocking switches consent
publication off, and so does returning a blocked campaign to review (which
covers campaigns blocked before blocking did that). The acceptance also reads
history instead of rewriting it: a campaign with any reject or block decision
in its review history, or whose latest beneficiary change was recorded before
changes were admitted (a `beneficiary_changed` consent event without
`admission`), stays in review after the acceptance and staff are alerted. No
stored campaign or event is migrated.

**Self-review.** Staff cannot decide on (approve, reject, block or reopen) a
campaign whose beneficiary invitation, held or sent and not yet answered, is
addressed to their own account email, as well as one they run or benefit from.
Nor can they reassign such a campaign, or name themselves as its beneficiary.

**Consent history.** A change or staff reassignment made while the invitation
is held is recorded in the consent history when it happens, with its actor and
role (an organization admin is `organizer`; staff are `admin`, with their
written reason). When staff clear the content, the release is recorded as
`invited` by whoever named that beneficiary, with the reason "Sent after the
content check was cleared"; the approval itself is in the audit log.

**Collaborator invitations.** Inviting a collaborator to a campaign whose
content waits is recorded but not announced (`heldForContentCheck` on the
invitation): the invitee gets no notice, does not see it under Invitations and
cannot answer it (404). Approval sends the "Campaign invitation" notice to each
such invitation once, keyed by the invitation, and clears the hold. An
invitation saved while an approval is committing is still announced: after
saving, the invitation writes the campaign while its check is outstanding, so
a concurrent approval either conflicts with it and retries (and sees the
invitation) or has already committed, in which case the invitation announces
itself with the same notice key. Invitations announced before a beneficiary
change reopened the check stay visible and are not announced again.

**Nothing leaves the organizer and staff before approval.** A `pending_review`
campaign is left out of public detail reads, Explore/search listings, vanity-URL
and share-preview reads, share tracking, the sitemap, organization pages,
leaderboards, comment and update reads, live sessions, and every donation path
(wallet, donation intents and crypto), as high-goal campaigns already were. The
organizer's account and staff can open it; members of the organizer's
organization team see its title and status on the team page but cannot open it
until it is public. The end-date sweep never moves it to a public status.
`contentReviewReason`, `contentReviewTrigger` and `contentReviewClearedAt` are
returned to the organizer and staff (and to the campaign's managers once the
campaign is public), never on public, beneficiary or donor reads. The reason stays on the campaign after the
decision as a record of why it was held.

**Rejected or blocked while waiting.** Rejecting or blocking a campaign whose
check is outstanding records a decline of that exact version (the campaign's
current public content, fingerprinted as a new campaign would submit it, and
also the fingerprint its admission recorded, which covers a submission whose
stored values were normalized, for example missing beneficiary labels stored
as an empty list; only while the stored version is still the one admitted, so
a version a held change or reassignment replaced, which staff never saw, is
not declined) in Publication reviews, with the campaign id and an
author-visible note; staff decision notes stay internal. Creating the same version again, with or without
automated screening, is refused with 422 until the record is purged (30 days,
as for every decline). The organizer is told the version cannot be submitted
again and, after a rejection, that a revised campaign can be created. Writing the
organizer's account in the same transaction serializes the decline with a
creation of the same version already in flight. If staff later reopen and
approve the campaign, the decline of the version they approved is removed; a
rejected version that a new beneficiary replaced before the approval stays
declined. Such a campaign never went live
and raised nothing, so it gives back its lifetime verification slot, and so does
a campaign whose check was never done before its end date (review refuses an
ended campaign). Reopening one makes it count again. The held beneficiary
invitation of a rejected or blocked campaign is withdrawn with its address (see
"Retention"), so approving it after a return to review needs the organizer to
name the beneficiary again: until then the approval answers 409. That return
to review therefore does not alert staff. The organizer's notice says the
invitation was withdrawn and asks them to name the beneficiary again (Change
beneficiary on the campaign page), `nextStep` is `name_beneficiary`, and the
Staff decision panel says no invitation is waiting instead of "Approving …
sends their invitation". Once the organizer names a beneficiary (held for the
same check), or staff reassign one, the team is alerted
(`beneficiary_changed` or `beneficiary_reassigned`).

**Proposals from the old flow.** Campaign proposals already stored stay in
Admin → Publication reviews until decided or purged. An approved, unexpired
proposal for the exact same version is honoured: the campaign is created under
the usual rules without another content review, and the approval is checked and
consumed in the creation transaction like every other approved publication. It
can still be used again within its seven days (issue I153, which still applies
to campaign proposals and live-session titles; it was closed for the eight
publish-on-approval actions, whose approvals are single-use). If
the exact version is still pending, creating the campaign removes the proposal
and the campaign takes it to the campaign review, so staff check it once; the
campaign's admission record keeps the proposal id and reason. A pending proposal
that screening flagged keeps its flag: the campaign is held as
`screening_flagged` and the text is not screened again, with or without
permission, so a later answer cannot clear it. A declined version stays declined
(422).

**Retention.** A held invitation that will never be sent keeps nothing: it is
marked superseded, its address removed and its address hash (an unsalted
SHA-256 of the address, which would still confirm a guessed address) replaced
with a marker, `withdrawn-unsent`, that identifies nobody. This happens when
staff reject or block the content it waited for, when a newer invitation
replaces it, when the campaign ends or is deleted unreviewed (a background
sweep, every 30 seconds with the other account-email work), and when the
organizer's account is erased. The person was never contacted, so they could
not ask for that themselves. Erasing the organizer's account also
withdraws invitations already sent for their campaigns and removes every
invited address kept for a resend.

Account erasure reduces each of the organizer's campaigns' `contentAdmission`
to its non-personal outline (basis, reason, trigger, admission time, and
`erasedAt`): the fingerprint, the screening-consent and screening times, the
screener and the earlier proposal it relied on are removed, as the review
snapshots are. The `campaign.content_admission` audit entries are kept.
Retention basis: they are the accountability record that the organizer gave
permission before their public text was sent to the external screening
processor, and of how public content was admitted (screening, an earlier
approval or staff review), needed to answer complaints, appeals and legal
claims about that processing and the moderation decision. They hold the
organizer's pseudonymous account id, an exact-version hash, timestamps and the
screener's label, not the text itself. They fall in the audit-log category of
`DATA_RIGHTS.md`, whose retention period still needs owner and legal approval;
indefinite retention is not an approved policy, and access requests must
include them.

Financial eligibility is separate: current account/plan limits are checked again
after admission, then the existing current-verification/prior-publication rule
determines whether goals above GHS 250,000 need financial review. A content
approval is not financial approval. Legacy campaign financial-review endpoints now record immutable content/version
evidence with explicit staff attestations; see `CAMPAIGN_STAFF_REVIEW.md`.

The vanity URL endpoint still holds a changed address in Publication reviews: it
screens the proposed slug and binds the approval to actor, campaign and previous
slug. It compares and updates only the slug field; concurrent donation totals or
a moderation block cannot be replaced by a stale campaign entity. A different
concurrent URL produces a conflict. Since 2 October 2026 the change is written by
`MongoCampaignSlugWrite` in one transaction with the account fence, the
author's current owner or administrator role, the single-use consumption of the
approval and a `campaign.slug_changed` audit; with the switch on, the approval
itself changes the address (see "Publishing on approval"). No general
title/story/goal editing endpoint exists in the inspected current router;
campaign-news edits retain their separate full-version review. Comments,
updates, profiles, creator pages, live titles and thank-you messages were
unchanged by the 30 September 2026 decision; see "Publishing on approval" for
the 2 October 2026 change.

### Verification of the 30 September 2026 change

Run on 1 October 2026 against a local test MongoDB, with a controlled screener
and a capturing email sender. No live provider, email, production campaign or
money was used.

- API: all 60 test files touching campaign creation, publication
  admission/reviews, the campaign staff review, campaign visibility, donations to
  campaigns and account erasure pass (596 tests). The campaign admission suite
  (18 tests) covers:
  - new media, no consent, flagged and unavailable screening each create a
    `pending_review` campaign with its reason and a staff alert, and store no
    proposal;
  - consented clean text is created live;
  - restricted (403), unagreed (428), closed (401) and oversized (400)
    submissions write nothing, and restriction and verification are rechecked
    after screening;
  - a declined version is refused (422), including when it is declined during
    the request;
  - a legacy approval is honoured and consumed, and refused if it lapses during
    the request (409); a legacy pending proposal moves to the campaign review;
  - an idempotent retry returns the same campaign without a second alert;
  - the high-goal rule stays independent, and beneficiary consent cannot
    publish on-behalf content waiting for staff;
  - a held campaign is absent from public reads, listings and search, slug and
    share reads, share tracking, the sitemap, wallet donations and checkout until
    a staff approval (attestation required) makes it live, and the creation and
    the decision are both audited.
- The three changed API test files also pass with retries disabled (38 tests).
- Web, admin and native suites pass in full (web 104 files / 479 tests, admin
  52 / 213, native 69 / 361). They include the new success copy, consent note,
  admin reason chip and native copy tests.
- A mocked 390px Playwright flow passes, and its screenshot was inspected: a
  campaign created without consent shows 'Saved · Pending review', the reason,
  payout setup and a My campaigns link, with no horizontal overflow and no page
  errors.
- Type checks (API, web, admin, native, shared types) and lint (API, web,
  admin, native) pass with no errors.

### Review fixes, 1 October 2026

An adversarial review of the change found that held content could still reach
people outside the organizer and staff (the on-behalf invitation email and its
preview, a beneficiary change, the linked beneficiary's read, collaborator
invitations); that a rejection in the campaign review was not bound to the
version, so the same text could go live through screening; that a rejected
campaign kept using a lifetime slot; that a still-pending flagged proposal lost
its flag; that a screened campaign kept no consent or screening evidence; and
that the content chip stayed after the check was cleared. All are fixed as
described above. Because staff clearing the content now restores consent-only
publication where it applied, a beneficiary change and a rejection or block also
switch consent-only publication off, so neither unreviewed beneficiary details
nor a blocked campaign can be published by an acceptance alone. Verified the
same day against a local test MongoDB, with a controlled screener and a
capturing email sender; no live provider, email, production campaign or money
was used:

- With retries disabled, the campaign admission suite (25 tests), the
  CreateCampaignUseCase unit tests (17) and a pinned-fingerprint test (2) pass
  (44 tests). New cases cover:
  - held on-behalf content: no invitation email, job or preview, no early
    resend, and a beneficiary change that stays held;
  - clearing the content sends exactly one invitation, to the current address,
    and consent then publishes only where screened content would;
  - the final staff approval after consent when on-behalf staff review is on,
    and a beneficiary change or a block after the check needing staff again;
  - collaborator invitations queued (no notice, not listed, 404 to answer) and
    released on approval;
  - a rejected version refused with 422 even with screening consent, the
    decline shown to the author without staff notes, and the slot returned;
  - block, reopen and approval clearing the decline, and the slot of a campaign
    left unreviewed past its end date;
  - a legacy flagged proposal kept as `screening_flagged` without screening
    again, with its id and reason in the admission record;
  - the private admission evidence and its audit entry, absent from every read.
- The fingerprint test pins hashes produced by evaluating the pre-change inline
  builder, so a change to the builder fails the test instead of silently
  orphaning earlier approvals and declines.
- API: the 67 test files touching campaign creation, publication
  admission/reviews, the campaign staff review, on-behalf campaigns,
  collaborators, visibility, donations and account erasure pass (677 tests). One
  older on-behalf test ('gives staff audited, reasoned overrides…') depends on
  test order when retries are disabled: it reads an earlier test's invitation
  from the shared outbox. It fails the same way without this change and passes
  on its own.
- Web 105 files / 485 tests, admin 52 / 216 and native 69 / 364 pass in full.
  They include the held-invitation wording (web panel and success screen, admin
  panels, the native Manage line), the queued collaborator wording, the cleared
  chip, and the restored neutral notice for an API that still answers 409
  `held` during a deploy.
- Type checks (API, web, admin, native, shared types) pass. Lint reports no
  errors; its 8 warnings are in files this change does not touch.

### Second review round, 1 October 2026

A second independent review found that the first round's rule for beneficiary
changes left gaps. A change made after the content was cleared still emailed
and previewed the new, unchecked name and reason straight away, and switching
consent publication off for every change left a campaign waiting for staff
after the acceptance with no alert and with web copy that promised otherwise.
Campaigns blocked or re-pointed by the earlier release were not covered by the
first round's rules. An administrator invited as the beneficiary could approve
the campaign before consent. A decline was not bound to the submitted version
when a stored value differed (a goal with more than two decimals, or omitted
beneficiary labels). The consent history named the wrong role for an invitation
released by an organization admin and missed changes made while it was held. A
collaborator invitation saved during an approval was never announced. Held
invitations kept the invited address after the campaign could no longer be
approved, and `contentAdmission` survived account erasure without a documented
basis.

All are fixed as described above ("Beneficiary changes are new content", "What
the organizer is told", "Rules for campaigns from before these were recorded",
"Self-review", "Consent history", "Collaborator invitations", "Retention"). The
first round's rule that every beneficiary change turned consent publication off
was replaced by the admission. Its rule for rejections and blocks was kept, and
now also applies when a campaign returns to review and to review history.

Verified on 1 October 2026 against a local test MongoDB, with a controlled screener and
a capturing email sender; no live provider, email, production campaign or money
was used:

- With retries disabled, 29 API files (254 tests) pass: the
  campaign admission suite (36 tests), on-behalf campaigns,
  campaign staff review, collaborators, account erasure and closure, data
  rights, the publication-admission suites (account, creator, organization,
  generic), campaign creation, idempotency, visibility, expiry, plan
  enforcement, approval policy, staff decision notices, donor thank-you,
  reports, safety moderation, split proceeds, update and live safety, plus the
  CreateCampaignUseCase, review-alert and fingerprint unit tests. The older
  on-behalf test that depended on test order now reads each invitation by its
  recipient and passes on its own and in sequence.
- New cases cover: a screened change sending its invitation and keeping
  consent publication, with the address never screened; an unscreened or
  flagged change reopening the check, holding the invitation, alerting staff,
  killing the old link and keeping the lifetime slot; the probe from the review
  (unchecked text straight after clearance) held and never emailed; a declined
  change refused with 422; the acceptance alert and notice; blocks, reopen and
  the earlier release's blocked or re-pointed campaigns; the review and
  reassignment ban for an invited administrator; the submitted and stored
  fingerprints both declined and the two-decimal goal; the consent history for
  a held change by an organization admin and a held staff reassignment;
  collaborator invitations saved during an approval (both orders) and not
  re-announced after a reopened check; held addresses removed on rejection, at
  the end date and on organizer erasure, with the approval answering 409 until
  the beneficiary is named again; and the reduced admission record with its
  audit entry kept.
- Each fix was reverted in turn and its test failed: the decline binding, the
  invitation self-review check, the review-history read, the return-to-review
  switch, the unadmitted-change read, the acceptance alert, the held change's
  consent event, the release's actor role, the held-address removal on decline,
  the end-date sweep, erasure of invitations and of the admission record, the
  reopened check for an unscreened change, and the first round's
  turn-off-on-change rule. For the collaborator race, a plain re-read of the
  campaign instead of the write fence fails the order where the approval's
  snapshot predates the invitation; without either, both orders fail.
- Web 105 files / 492 tests, admin 52 files / 218 tests and native 69 files / 365 tests pass in full. They include the
  next-step lines, the change dialog's screening choice and confirmations, the
  withdrawn-invitation wording, the two-decimal goal message, the admin
  reopened-check note and the consent history's admission line.
- Type checks (API, web, admin, native, shared types) pass. ESLint on the
  81 changed TypeScript files reports no errors or warnings.

### Third review round, 1 October 2026

A third review of the second round's fixes found four low-severity gaps. Each
was reproduced against the worktree before it was fixed: its new test failed
on the unfixed code for the reason the review gave.

- Declines, and their removal on approval, also used the admission record's
  fingerprint after a beneficiary change held by the outstanding check, or a
  staff reassignment, had replaced the version it described. Approving the
  new beneficiary then removed the decline of a version staff had rejected,
  so that version could be created again and go live through screening; and
  rejecting a changed version also declined the one it replaced, which staff
  never saw. Such a change or reassignment now removes the fingerprint from
  the admission record (see "Beneficiary changes are new content").
- After held on-behalf content was rejected or blocked and returned to
  review, staff were alerted but could not approve it (its invitation had
  been withdrawn), the organizer was only told it was back in the queue,
  native showed only "Waiting for the beneficiary to accept", the Staff
  decision panel still said approving sends the invitation, and naming the
  beneficiary again alerted nobody. The return to review
  now waits for the organizer and says so (see "Rejected or blocked while
  waiting"), and naming a beneficiary alerts staff.
- A beneficiary change was accepted after the end date: it reopened the check
  and alerted staff about a campaign review refuses, and the new invitation
  could never be sent. An acceptance or a return to review after the end date
  alerted staff too. Changes now answer 409 after the end date and are no
  longer offered, and ended campaigns are never announced.
- A held invitation withdrawn unsent kept an unsalted hash of the address,
  which would confirm a guessed address. It now keeps a marker instead, also
  when a newer invitation replaces it, and its read has no sent date or
  expiry (see "Retention"). No such invitation exists outside test data: held
  invitations were introduced by this change.

Verified on 1 October 2026 against a local test MongoDB, with a controlled
screener and a capturing email sender; no live provider, email, production
campaign or money was used:

- With retries disabled, the second round's 29 API files pass (258 tests),
  including the campaign admission suite (40 tests). New cases cover: a
  rejected version staying declined after the organizer, or staff, name a new
  beneficiary that staff approve; a rejection after a held change declining
  only the version staff saw, so the replaced version is checked like new
  content; the return to review waiting for the organizer (no alert, the
  notice and its link, `name_beneficiary`, no sent date or expiry, 409 on
  approval) and the alert once the organizer or staff name a beneficiary, not
  repeated for a further correction; the 409 for a change after the end date,
  with no alert after an acceptance or a return to review of an ended
  campaign; and no address hash kept by a held invitation that was rejected,
  replaced, swept at the end date or withdrawn on erasure. The review-alert
  unit test covers the staff reassignment's wording.
- Each of the 13 changes was reverted in turn and its test failed: the
  fingerprint removal on a held change and on a reassignment; the reopen
  alert's wait for a beneficiary, the alerts after a change and after a
  reassignment, the reopen notice, `name_beneficiary`, and the missing sent
  date; the 409 after the end date, `canChangeBeneficiary` and the end-date
  check before alerts; and the hash removal when a held invitation is dropped
  and when it is replaced. The sources were restored byte for byte.
- Web 105 files / 494 tests, admin 52 files / 222 tests and native 69 files /
  366 tests pass in full. They include the withdrawn-invitation wording on
  web, native and both admin panels, the change dialog without screening while
  the check waits, a reassignment confirmed from the API's answer, and no
  change advice once a campaign has ended.
- Type checks (API, web, admin, native, shared types) pass, and so do the
  changed test files', apart from three errors already on main in code this
  round did not touch (two mock types in the CreateCampaignUseCase unit test
  and an untyped `this` in the admission suite's creation pause). ESLint on
  the 62 changed TypeScript files reports no errors or warnings.

### Earlier campaign-creation evidence (proposal flow, replaced 30 September 2026)

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
