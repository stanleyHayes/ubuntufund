# Donation and supporter messages

Work in progress, 2026-09-12. Content agreement, item reporting and message hiding are implemented; preventive moderation remains open.

Web donation and creator-tip forms show an unchecked terms/18+ acknowledgement when a public message is entered. Native campaign checkout has the same control. The shared donation form passes the choice to either fiat or crypto checkout. Message-free checkout does not require this additional content choice.

Fiat donation, crypto deposit and creator-tip use cases reject a nonempty message without the current acknowledgement before creating the payment record or invoking a provider. They stamp the current version, accepted flags and server time into `messageAgreement` on the donation intent or tip. Client-supplied timestamps are not used. Acknowledgement does not enable activity or marketing emails. Existing post-donation message editing still requires an authenticated owner and the current persisted account agreement.

The consent record is attached to the payment request that contains the message; it is not a claim that payment succeeded or that moderation approved the content. Existing messages are not assigned fabricated acknowledgement dates. Existing financial-record retention controls apply pending the approved category schedule in `DATA_RIGHTS.md`.

During phone verification, checkout copy promising every donor an emailed receipt was found and corrected. Web donation/tip forms now describe the email address as needed for checkout. Optional Ujimora activity emails continue to use their separate Settings choices.

## Remaining content-safety work

- Verify timely moderation operations and the broader anonymous-author blocking policy. Individual donor/supporter messages now have report controls and a hide action without revealing private donor identity or changing financial totals.
- Audit every public projection, live overlay, notification and creator-supporter list so hidden/restricted content is consistently suppressed.
- Verify restriction propagation through moderation and all public projections. Initial checkout now enforces the current restriction when a signed-in account submits a message. Guest payment identity is not inferred from an unverified email address.
- Implement and verify preventive content review/filtering, escalation, staff response capacity and appeals; acknowledgement alone is not a moderation system.
- Finish the wider public-name, campaign-update, media and AI-output acceptance/moderation audit. Other payment terms and fee disclosures remain C14.

Sources: [Apple App Review Guidelines 1.2](https://developer.apple.com/app-store/review/guidelines/) and [Google Play user-generated content policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB) require a broader safety workflow, including reporting and blocking; this acknowledgement change covers only part of that requirement.

## Verification

Initial service/API rejection checks and fiat/creator regressions pass 13 tests. The fiat/creator/crypto suites pass 17 tests with persisted fiat/creator acknowledgement assertions; the six-test crypto suite passes again with a real acknowledged-message fixture and persisted timestamp assertions. The mocked phone flow verifies unchecked consent, blocked submission, explicit selection and the submitted versioned payload. API/web/native type and lint checks, 42 native tests and the all-platform JavaScript export pass. No real payment was made.

Publishing-restriction follow-up: optional authentication now checks current restrictions on fiat/creator/crypto initial messages. Crypto deposit routes run that middleware too. Database failures propagate instead of silently downgrading the request to a guest. Message-free checkout and profile access are unaffected by the publishing restriction. Five message/session integration tests, API type check and lint pass.

Projection audit: settled donation messages are copied into both Donation records and durable outbox payloads; the realtime dispatcher currently publishes the payload message. Creator recent-tip responses currently omit the tip ID required for item-specific reporting. The next moderation change must cover those paths and prevent an edited/retried source from republishing hidden text, while preserving amounts, totals and anonymous identities.


## Individual message moderation

Signed-in viewers can report individual donor messages in web/native campaign history and supporter messages on creator pages. Creator responses now include a tip ID for reporting, without exposing anonymous supporter account IDs or email. Reports preserve a snapshot of the public message. Guest reports have no invented account identity; the admin cannot apply an account restriction to an unverified guest.

The moderator can hide the message after recording review notes. This removes public text and adds a hidden timestamp on the donation/tip while preserving amounts, settlement state and aggregate totals. The snapshot remains in the restricted report queue. A donation owner cannot use the message-edit endpoint to restore a hidden message. Restoring a user's publishing privilege does not automatically restore hidden messages.

Outbox dispatch reads the current donation message/anonymity instead of trusting the old payload. Both campaign and live-session SSE delivery, including buffered replay, read current message/anonymity state before sending; current overlay privacy settings still apply. Lookup failures close/retry rather than publishing stale text. Content already delivered to a device cannot be recalled by this change; a full live-client moderation-update mechanism remains part of the wider projection audit.

The legacy wallet donation endpoint now forwards explicit message acknowledgement and participates in publishing restrictions. This path was found by the replay regression, rather than treated as covered by the new checkout endpoint.

Verification: two message-moderation tests plus four existing safety/retry tests pass; four SSE tests pass after updating the acknowledged legacy-message fixture, including hidden-message buffered replay. Two message/restriction tests cover the additional legacy path. Three report component tests, one admin hide-action test and a mocked 390px anonymous-supporter report flow pass; screenshot inspected. API/web/native/admin type/lint checks, 42 native tests and all-platform export pass. No real report or payment was submitted.
