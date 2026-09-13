# Community safety operations — release gate

The implementation supplies report intake, blocking and administrator actions. Effective moderation additionally requires assigned staff, access controls, a response process, escalation contacts and evidence that the queue is monitored. These operational responsibilities have not been externally verified.

## Implemented controls

- Signed-in users can report a comment or user and block users from discussions or creator pages. Settings exposes unblock controls. Blocked users' comments are filtered in both directions. Creator reads filter blocked supporters' messages without changing financial aggregates. Signed-in users cannot start new interactions with blocked creators.
- Reporting and blocking are separate actions. A report contains a reason and description; the API captures the relevant comment or public-profile text as evidence. Duplicate pending reports by the same reporter for the same target are idempotent. Reporter details are restricted to the admin queue.
- `/safety-reports` in admin lists pending reports, urgent child-safety/credible-threat concerns first. The action center shows the pending count. Reviews require notes. Staff can dismiss, record another resolution, hide a comment, or restrict publishing. A comment implicated in a publishing restriction is also hidden.
- Publishing restrictions preserve account settings, privacy requests and existing financial access. Public creator pages are hidden while restricted. Affected users receive the support appeal contact when attempting to publish. An administrator can restore publishing after an appeal, with an audit record; previously hidden comments stay hidden.

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
