# Community safety operations — release gate

The implementation supplies report intake, blocking and administrator actions. Effective moderation additionally requires assigned staff, access controls, a response process, escalation contacts and evidence that the queue is monitored. These operational responsibilities have not been externally verified.

## Implemented controls

- Signed-in users can report a comment or user and block users from discussions or creator pages. Settings exposes unblock controls. Blocked users' comments are filtered in both directions. Creator reads filter blocked supporters' messages without changing financial aggregates. Signed-in users cannot start new interactions with blocked creators.
- Reporting and blocking are separate actions. A report contains a reason and description; the API captures the relevant comment or public-profile text as evidence. Duplicate pending reports by the same reporter for the same target are idempotent. Reporter details are restricted to the admin queue.
- `/safety-reports` in admin lists pending reports, urgent child-safety/credible-threat concerns first. The action center shows the pending count. Reviews require notes. Staff can dismiss, record another resolution, hide a comment, or restrict publishing. A comment implicated in a publishing restriction is also hidden.
- Publishing restrictions preserve account settings, privacy requests and existing financial access. Public creator pages are hidden while restricted. Affected users receive the support appeal contact when attempting to publish. An administrator can restore publishing after an appeal, with an audit record; previously hidden comments stay hidden.

## Review controls added 25 September 2026

- Four eyes: an administrator cannot review a report they filed, a report about their own content or account, or a report about content on a campaign they own. Another administrator must act, as for publication, donation-content and tip-content reviews. A single-admin deployment therefore needs a second administrator for these reports.
- Reports on already-removed comments, or on comments/updates on a campaign the reporter cannot see, are refused. Hiding a comment keeps the original removal time if the author or owner had already deleted it.
- Hiding a comment or update also withdraws the publication approval of that exact version (it becomes declined), so the author cannot repost the identical text during the approval window.
- Publishing restrictions keep one active record per account (what enforcement reads) plus an append-only history of every restrict and restore (`ContentRestrictionEvent`). Admin → Safety → Restricted users lists active restrictions with the account name and email, restricts an account directly with notes (no report needed), and lifts a restriction with notes. Lifting requires an active restriction (otherwise 404) and writes one audit entry naming the restriction lifted. Restoring from a report whose restriction has since been replaced by a newer decision is refused until staff explicitly confirm.
- Edited campaign updates: when a reported update changes after the report, *Hide campaign update* is refused because the current text was not the one reported. *Restrict publishing* still works on that report (a restriction does not depend on the content version) and leaves the edited update visible. To act on the current text, review it and file or accept a new report on the current version, then hide that.
- Report reasons now include intellectual property / copyright and privacy or likeness, for safety reports and campaign reports. Takedown intake for rights-holders (address, required details, response targets) still needs an owner decision.
- Restrictions still do not block an account's campaigns or change donations; use the separate campaign *block* moderation action for that (owner decision whether restricting should offer it).

## Publication reviews: approving publishes (2 October 2026)

With `PUBLISH_ON_APPROVAL_ENABLED` on, approving a held version publishes it at once. This covers comments, campaign updates and update edits, account and organization profiles, creator pages, thank-you messages and campaign web addresses. Nobody resubmits it. The author's checks run again first: account, sign-in, restriction, agreement, permission, plan, and that the item has not changed. Details are in `PUBLICATION_REVIEWS.md`, "Publishing on approval".

- **Check before approving.** Check every field and every image of the exact version. An approval cannot be taken back once the version is published.
- **Thank-you messages.** Approving one emails the campaign's eligible donors and cannot be recalled. Unsubscribed and refunded donors are skipped.
- **Web addresses.** Approving one changes the campaign's web address; old links keep working.
- **What approval does not publish.** Live-session titles and campaign proposals are not published by approval: their authors still start or submit them again. Nor is a version submitted before the switch: the staff view shows `publishOnApproval: false` for it.
- **Changed items.** If the author changed the item after submitting, the approval does not publish it. The author is told to submit the latest version.
- **Where each approved version stands.** The decision response and the staff list show it: published, publishing, not published (with the reason), replaced by a newer version, or withdrawn by the author. A version the author withdrew or replaced before any decision cannot be decided (409). An approval that does not publish by itself reads 'Not published by its approval: the author publishes it by submitting it again.' Approvals made before this deploy recorded no publication by their author, so neither the card nor the export says they were never published: once run out, the export reads 'Approval expired; no publication recorded'.
- **Conflict of interest.** An administrator cannot approve or decline a version:
  - for a campaign they own, benefit from, or help run as an active admin or editor of its organization;
  - written by, or changing, an organization they belong to.

  The answer is 403 'Another administrator must review content for a campaign or organization you manage'. Self-review stays refused, with 403 'Another administrator must review your content'. Both apply with the switch on or off. With one administrator, such items wait for a second.
- **Current access.** Every decision re-checks the administrator's access in its own transaction. Demoted, closed, or with a password changed since sign-in: 403 'Current administrator access is required'.
- **Failures.** Publication retries automatically, with backoff over about ten hours (eight attempts). A version that still fails ends "Not published" (`unavailable`) and the API logs an error. Watch for these, and for versions stuck in `publishing`. The admin page has no filter for this yet: each approved card shows its status line, and the API takes a `publishState` query (`GET /admin/publication-reviews?status=approved&publishState=publishing`, or `queued`, `applying`, `published`, `not_published`, `superseded`, `withdrawn`).
- **Hidden content stays declined.** Hiding a reported comment or update still turns its approval into a decline, so the identical post is refused with 422.
- **Pausing it (kill switch).** Set `PUBLISH_ON_APPROVAL_ENABLED` to `"false"` in `render.yaml` and redeploy, after checking the Render dashboard has no override.
  - Approvals already waiting are returned to their authors as plain approvals, with a notice to submit them again.
  - They stay that way if the switch is turned back on.
  - The Privacy and Cookie notices need no change: they are worded to be true with the switch on or off (`LEGAL_REVISIONS.md`).

## Required operating process

1. Assign accountable moderators and coverage, including a backup. Confirm access to the support appeal inbox and restrict report/audit exports to people handling the case. Confirm all launch languages have an escalation path.
2. Monitor urgent reports and promptly assess immediate threats and child-safety concerns. Use the appropriate emergency, child-protection, provider and legal escalation contacts. Preserve necessary evidence securely. Do not promise an emergency response through the app or forward sensitive evidence through ordinary public channels.
3. Review the report and content context. Distinguish the reporter's allegation from verified findings. Record the policy basis, action, reviewer and relevant timestamps; use the least restrictive effective action and keep financial handling separate.
4. Monitor normal reports on an assigned schedule, communicate outcomes and handle appeals. The software does not currently auto-notify the reporter or reported user of review outcomes. Do not advertise a response-time guarantee until coverage and delivery are operationally proven.
5. Apply a purpose-specific retention/legal-hold decision to evidence and report records, including requests from deleted accounts. Do not retain all safety data indefinitely merely because the queue exists, or disclose a reporter's identity to the reported user.
6. Test with isolated accounts: reporting, duplicate handling, queue access, hiding, restrictions, appeal restoration and continued access to privacy/settings/funds. Confirm the changes are included in the deployed API and app releases.

## Remaining engineering before UGC release approval

Current metadata update: new live-session titles/targets now pass private exact-version admission before session creation, with web/native optional automated consent and held-draft resubmission. See PUBLICATION_SCREENING_AUDIT.md for verified cases and remaining final-save fencing. The historical bullets below describe broader responsibilities; title screening does not inspect a live stream.

- Verify the implemented live-session report context, blocking, token revocation and provider room termination against the actual configured provider and signed clients. Complete the rollout steps below.
- Individual guest/supporter-message reporting and moderation, acceptance before public messages, and defenses against anonymous evasion.
- Preventive content filtering/review before objectionable material is published across campaign, creator, comment, upload and live surfaces.
- Reliable moderation outcome delivery, escalation monitoring and operational audit/retention tests. Concurrent review now reserves one immutable action with retry tests; final operational recovery still requires provider-backed validation.
- Signed native builds and physical-device report/block/appeal accessibility checks. Browser tests and TypeScript checks alone do not verify native behavior.

References: [Apple UGC guideline 1.2](https://developer.apple.com/app-store/review/guidelines/), [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB).

## Live provider rollout requirements

The implemented removal call uses `revokeTokenTs` with an explicit cutoff instead of LiveKit's default clock buffer. Current LiveKit documentation identifies token revocation as Cloud-only. Self-hosted room removal does not, by itself, prove that a cached or automatically refreshed token cannot reconnect. A one-minute application-issued TTL does not establish the lifetime of a provider-refreshed token.

Before enabling the release:

1. Record the provider deployment/version and demonstrate that removed host/viewer tokens, including provider-refreshed tokens, cannot reconnect after the explicit cutoff. For a self-hosted service, implement and verify equivalent revocation or keep the affected live feature out of the release until it is enforceable.
2. Drain or revoke rooms and tokens created by earlier app versions before rollout. Earlier viewer identities were random even for signed-in accounts, so old connections cannot reliably be matched to the new stable account identities. Do not claim the new block job retroactively identifies those viewers.
3. Test block in both directions, active viewer eviction, denied token renewal, moderator stop, overlay/SSE revocation, provider downtime/recovery, missing credentials, deletion of a broadcasting account and reboot reconciliation. Verify every pending flag clears only after provider success or a verified absent room.
4. Public streams remain accessible to anonymous viewers. Account blocking governs signed-in identities and does not authenticate anonymous people or prevent someone using a separate account. Preventive moderation and guest-abuse defenses remain necessary.
5. Confirm moderator coverage and monitoring of the live-cleanup queue. A failed retry is still pending work; do not treat pressing Retry as a successful provider stop.

Sources: [LiveKit participant removal](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/), [LiveKit token lifecycle and revocation](https://docs.livekit.io/frontends/reference/tokens-grants/). No production provider operation was performed in this implementation.
