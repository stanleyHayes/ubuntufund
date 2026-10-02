# API: donor thank-yous and on-behalf campaigns

All paths are under `/api/v1`. Responses use the usual envelope `{ data, message?, status }`; errors are `{ message, status, errors? }`. Types live in `packages/types/src/on-behalf.ts` and `packages/types/src/donor-thank-you.ts`. Every mutation is authorized on the server; anyone without access to a campaign gets `404`, so the API does not reveal which campaigns exist.

## Creating any campaign: content review (since 30 September 2026)

`POST /campaigns` takes an optional `automatedReviewConsent: boolean` (default off): permission to send the campaign's public text to OpenAI moderation. Media is never sent.

- **`201` with the campaign** whenever creation succeeds, including when a person must check it first. Then it is `pending_review` with `contentReviewReason`:
  - `new_media`: it has new photos or video;
  - `no_screening_consent`: sent without `automatedReviewConsent`;
  - `screening_flagged`: screening flagged the text;
  - `screening_unavailable`: screening could not run.

  It stays private and closed to donations until staff approve it in the campaign review (`PUT /campaigns/:id/review`); nothing is resubmitted. Show it as saved and waiting for review, not as an error. Until then nothing about it is sent to anyone: an on-behalf campaign's beneficiary invitation is held (see below), and collaborator invitations (`POST /campaigns/:id/collaborators/invite`) are recorded but not announced to, listed for or answerable by the invitee (`404`) until approval sends their notice.
- **Consented text-only content that screening approves** follows the usual rules: `active`, or `pending_review` without `contentReviewReason` when the GHS 250,000 financial rule, the tier policy or the on-behalf settings hold it.
- **No `409` hold.** Campaign creation no longer returns `409` with `errors.publication = ['held']`. Comments, updates, profiles, creator pages, vanity URLs, live titles and thank-you messages still can.
- **Goal precision.** `goalAmount` must be a multiple of 0.01 (whole pesewas), as for donations; more decimals answer `400` (`errors.goalAmount`).
- **Refusals, before anything is written:** `400` content over the review limits; `401` account unavailable; `403` publishing restricted, or the existing plan/verification refusals; `428` current account agreement not accepted; `422` a version declined earlier, in Publication reviews or by a rejection/block in the campaign review while its content waited (with or without `automatedReviewConsent`). A `409` "The content approval changed or expired…" only happens when an earlier approved proposal for the same version changes during the request; submit again.
- **Lifetime allowance.** A campaign rejected or blocked while its content waited, or left unreviewed past its end date, never went live and does not count toward `creation-options.totalCount` or the verification allowance.
- **Retries.** The same `Idempotency-Key` returns `200` with the campaign already created, `pending_review` included.
- **Who sees `contentReviewReason`, `contentReviewTrigger` and `contentReviewClearedAt`** (`CampaignContentReviewReason` in `packages/types/src/campaign.ts`; `contentReviewClearedAt` is set when staff approve it, and `isContentCheckOutstanding()` tells the two apart; `contentReviewTrigger: "beneficiary_change"` when a beneficiary change, not creation, opened the current check): the creation response, `GET /campaigns/:id` for the organizer and staff (and for the campaign's other managers once it is public: until then only the organizer's account, the linked beneficiary and staff can open a non-public campaign, and no beneficiary can be linked before the check), `GET /campaigns/mine`, staff lists (`GET /campaigns`) and the staff review response. Public, beneficiary and donor reads never include them. The reason stays on the campaign after the decision.

## Campaigns run on someone else's behalf

### Creating one
`GET /campaigns/creation-options` (auth) now also returns:

```json
{ "canCreateOnBehalf": true, "onBehalfBlockReason": null, "onBehalf": { "limit": -1, "active": 0, "feePercent": 0 } }
```

`onBehalfBlockReason` is `plan_required` | `plan_limit` | `verification_required` | `unavailable` | `null`. For `plan_required` and `plan_limit`, show the upgrade path (`/subscription`).

`POST /campaigns` accepts an optional `onBehalf` block (the rest of the body is unchanged):

```json
{ "onBehalf": {
  "beneficiaryType": "individual" | "organization",
  "beneficiaryName": "2–120 chars, shown publicly",
  "beneficiaryEmail": "invitation address, never shown publicly or returned in full",
  "relationship": "family" | "community_member" | "patient" | "student" | "client" | "partner_organization" | "other",
  "reason": "10–1000 chars",
  "payoutArrangement": "beneficiary" | "organization"
} }
```

Errors: `403` when the plan does not include the feature or the limit is reached; `422` when `beneficiaryEmail` is the organizer's own address; `503` when invitations cannot be sent. The new campaign is `pending_review`, and the beneficiary is emailed an invitation, unless its content waits for staff (`contentReviewReason`): then the invitation is stored with `invitationStatus: "held"` and nothing is emailed. Staff approving the content (before the beneficiary's consent) sends it; the campaign stays `pending_review` until they accept.

### Campaign shape additions
Every campaign read (`GET /campaigns/:id`, by slug, lists, creation) now includes:

- `creationMode`: `self` | `on_behalf`
- `onBehalf?`: `{ beneficiaryName, beneficiaryType, beneficiaryConfirmed }`, which is public. Show "Organized by X on behalf of Y" and whether Y has confirmed.
- `viewerAccess?`: `{ manage, beneficiary, payoutAuthority, thankDonors }`. Present on signed-in reads of `GET /campaigns/:id`. It is informational only. Use `payoutAuthority` (not "is the creator") to decide whether to show payout and cashout controls, and `thankDonors` to show the thank-you entry point.

### Beneficiary details (manager, linked beneficiary, staff)
`GET /campaigns/:id/beneficiary` returns `CampaignBeneficiaryDetails`. It includes `consentStatus` (`pending` | `accepted` | `declined` | `expired` | `revoked`), `invitationEmailHint` (masked, manager/staff only), `invitationStatus` (`held` while the campaign's content waits for staff: written, not sent, so `invitationSentAt`/`invitationExpiresAt` are absent and `canResendInvitation` is false; `superseded` as the latest status means it was withdrawn, with its address, because the campaign was declined, ended or its organizer closed their account: change the beneficiary to invite again; one withdrawn while it was held was never sent, so it has no `invitationSentAt`/`invitationExpiresAt` either), `invitationSentAt`, `invitationExpiresAt`, `payoutAuthority` (`beneficiary` | `organization` | `none`), the gate flags `publicationRequiresConsent` and `donationsRequireConsent`, the action flags `canResendInvitation` (only while an address is on file), `canChangeBeneficiary` (not while blocked, nor after the end date) and `canRevokeConsent`, `nextStep` for managers and staff while it is pending review (`content_check`: our team checks the content first; `name_beneficiary`: the content still waits for that check, but its invitation was withdrawn when the campaign was declined, so the organizer names the beneficiary again before our team can finish it; `consent`: the beneficiary's acceptance publishes it; `staff_after_consent`: our team checks it after the acceptance; `staff`: it waits for our team; show this instead of assuming acceptance publishes), and `viewer` (manager / beneficiary / admin). It returns `404` when the campaign is self-created.

The actions (auth; 20 per 15 min per user):

| Call | Who | Notes |
|---|---|---|
| `POST /campaigns/:id/beneficiary/invitation` | organizer or org admin | Resend while `pending`/`expired`. Returns `429` within 60 s of the last invitation, and `409` while the invitation is held for the content check. Returns `{ expiresAt }`. |
| `PUT /campaigns/:id/beneficiary` | organizer or org admin | Same body as `onBehalf` above, plus optional `automatedReviewConsent` (default off). Only before acceptance, while nothing has been raised, while not blocked and before the end date (`409` otherwise). The new name and reason are admitted like a new campaign's content: refused with `422` when that version was declined, `403` when the account (or the acting org admin) may not publish; screened with consent, and otherwise (or when flagged or unscreened) the content check reopens (`contentReviewReason`, `contentReviewTrigger: "beneficiary_change"`), the new invitation is held and staff are alerted. While a check is already outstanding the change is held without screening (staff are alerted when it names a beneficiary for a check whose invitation was withdrawn). A public campaign goes back to review. Returns `{ invitationHeld, nextStep }`. `409` "…Save the change again" when staff cleared the check, or the campaign changed, while the change was being screened. |
| `POST /campaigns/:id/beneficiary/consent/revoke` | linked beneficiary | Only while nothing has been raised (`409`: contact support). |
| `GET /beneficiary/campaigns` | signed-in user | `BeneficiaryCampaignListItem[]`: the campaigns run for them. |

### Invitation links (public; 30 per 15 min per client)
The email links to `https://app.ujimora.com/beneficiary-invitation#token=<64 hex>`. The token is in the fragment, so it never reaches the server in a URL. Send it in the request body:

| Call | Auth | Result |
|---|---|---|
| `POST /beneficiary-invitations/preview` `{ token }` | none | `BeneficiaryInvitationPreview` (`status` may be `expired` or `superseded`). `404` for an invalid link, and for any link while the campaign's content waits for staff. |
| `POST /beneficiary-invitations/accept` `{ token }` | required | `{ campaignId, status }`. `403` when the signed-in address is not the invited address, the email is unverified, or the account type is wrong (an organization beneficiary needs an organization account). `409` when it was already decided or replaced; `410` when expired. |
| `POST /beneficiary-invitations/decline` `{ token, reason? }` | optional | Declining needs no account. |

Show the preview before sign-in. If the visitor is not signed in, keep the token (for example in `sessionStorage`), send them to login/register, and bring them back.

### Staff
| Call | Body |
|---|---|
| `GET /admin/campaigns/:id/beneficiary/events` | Consent history: `[{ event, actorRole, actorId, payoutArrangement, reason, consentVersion, admission?, createdAt }]` (`admission` on `beneficiary_changed`: `screening`, `prior_approval` or `staff_review`; absent on changes recorded before changes were checked) |
| `POST /admin/campaigns/:id/beneficiary/reassign` | The `onBehalf` fields plus `staffReason` (20–2000 chars). Resets consent and payout authority and invites the new beneficiary (held, and `{ invitationHeld: true }`, while the content waits for the campaign review; the consent history records the reassignment straight away; staff are alerted when it names a beneficiary for a check whose invitation was withdrawn). `403` when the administrator is invited to benefit from the campaign or names their own address. |
| `PUT /admin/campaigns/:id/payout-authority` | `{ target: 'beneficiary' \| 'organization' \| 'none', staffReason }` |

Staff cannot act on campaigns they created or benefit from (`403`), including a campaign whose unanswered beneficiary invitation is addressed to them. The consent history (`events`) records a change or reassignment made while the invitation is held when it happens, then `invited` (by whoever named that beneficiary, reason "Sent after the content check was cleared") when staff clear the content; `beneficiary_changed` events carry how the new details were admitted.

### Plans and settings
Plans have three new fields: `onBehalfCampaigns` (boolean), `maxOnBehalfCampaigns` (-1 = unlimited) and `onBehalfFeePercent` (0–100, added to the platform fee locked at creation). They are editable through `PUT /plans/:tier` and `POST /plans`.

Admin settings (`/admin/commercial-config`) gain these keys. Switches take 0 or 1.

| Key | Default | Meaning |
|---|---|---|
| `onBehalf.publicationRequiresConsent` | 1 | Staff cannot publish until the beneficiary accepts (content waiting for staff is approved first, which sends the invitation; it is published after the acceptance) |
| `onBehalf.donationsRequireConsent` | 1 | No donations until the beneficiary accepts |
| `onBehalf.staffReviewRequired` | 1 | Every on-behalf campaign waits for staff review |
| `onBehalf.invitationTtlHours` | 168 | Invitation lifetime (1–720) |
| `onBehalf.minManagerVerificationLevel` | 0 | Minimum verification level of the creating account (0–4) |
| `thankYou.enabled` | 1 | Thank-you messages on/off |
| `thankYou.afterCampaignEnd` | 1 | Unlock once the campaign has ended |
| `thankYou.afterPayoutPaid` | 1 | Unlock once any payout was paid |
| `thankYou.maxSendsPerCampaign` | 1 | Completion thank-yous per campaign (1–10) |

The three `onBehalf` switches are copied onto each campaign when it is created.

## Donor thank-you messages

Authors are the campaign's organizer, its organization's admins/editors, or its consenting beneficiary (`viewerAccess.thankDonors`). The limit is 60 requests per 15 min per user.

| Call | Notes |
|---|---|
| `GET /campaigns/:id/thank-you` | `DonorThankYouState`: `eligible`, `reason` (`disabled` \| `not_ended` \| `campaign_unavailable` \| `no_donors` \| `limit_reached` \| `email_unavailable`), `trigger`, `estimatedRecipients`, `sendsUsed`/`sendsAllowed`, `draft?` and `history[]`. |
| `PUT /campaigns/:id/thank-you/draft` | `{ subject (3–120), body (10–5000), signature (≤120) }`. Plain text only; the subject is folded to one line. |
| `DELETE /campaigns/:id/thank-you/draft` | Discard. |
| `POST /campaigns/:id/thank-you/preview` | Same body → `{ subject, text, html }`: exactly what donors receive, via the same branded template. `html` escapes all author text; render it only in a sandboxed frame. |
| `POST /campaigns/:id/thank-you/send` | Header `Idempotency-Key` (16–100 chars, new per user action; keep it for retries of the same click); body `{ automatedReviewConsent?: boolean }`. Returns `202` with `DonorThankYouView` (status `queued`), or `200` for a replay. The message may be held for safety review (`409`, see "Held messages" below): `errors.publication = ['held', 'publishes_on_approval']` means the approval sends it, so show the waiting notice and nothing needs sending again; `['held']` alone means send the same draft again after approval. Before anything is held, the sender is checked: `401` 'Account authorization changed. Sign in again.', `428` 'Accept the current account agreement before publishing.', `403` 'Publishing is restricted. Contact support@ujimora.com to appeal.' or `403` "Publishing is restricted for this campaign's organizer, so messages to its donors are paused." Other `409`s: not eligible, already sent, 'Save your message before sending it.', 'Your draft changed while it was being checked. Review it and send again.' or 'This version is already published.'. |
| `GET /campaigns/:id/thank-you/:thankYouId` | Progress: `status` (`queued` → `sending` → `sent` \| `partially_sent` \| `failed`), `recipientCount`, `sentCount`, `failedCount`, `skippedCount`, `retryableCount`. Poll every few seconds while `queued`/`sending`. |
| `POST /campaigns/:id/thank-you/:thankYouId/retry` | Re-queues retryable failures only → `{ requeued }`. |

Authors only ever see counts, never recipients.

**Held messages (2 October 2026).** With `PUBLISH_ON_APPROVAL_ENABLED` on, a staff approval sends a held message without the author pressing Send again (see `docs/compliance/PUBLICATION_REVIEWS.md`, "Publishing on approval").

- **The checks.** The approval queues the message exactly as the author's Send would at that moment, through the same transaction and checks:
  - the sender's account, sign-in, agreement and restriction;
  - their role now: owner, active admin or editor of the running organization, or the beneficiary with accepted consent;
  - a restriction on the organizer;
  - eligibility;
  - the draft still holding exactly the reviewed message;
  - the send limit.
- **Queued once.** It is queued once, under the key `publication-review-<reviewId>`. The existing worker then emails each eligible donor once, skipping donors refunded or unsubscribed by then.
- **Editing a waiting message.** Saving or discarding the draft does not close the review: its approval compares the draft at that moment and sends the reviewed message only if the draft still holds it exactly. While the draft differs (or is gone), the reviewed version is not sent, and the author is told it changed after they submitted it; changed back before the approval, it is sent. The composers on web and in the app say so, also after the author leaves and comes back (they find the waiting version among the author's own `GET /publication-reviews`, by `resourceId`). A newer Send for the same campaign replaces an earlier held one.
- **What the author sees.** The history shows the queued message. The inbox gets "Your thank-you message was approved" ("Approved; we're emailing your donors and will send you a delivery summary."), and the delivery notice follows as before.
- **When it is not sent.** If a check fails, the author gets "Your thank-you message wasn't published" with the reason, for example "This campaign has already sent the most thank-you messages allowed."
- **Messages held earlier.** Messages held before the switch, or while it is off, keep "send the same draft again after approval".

Donors:

| Call | Notes |
|---|---|
| `POST /donor-messages/unsubscribe` `{ token }` (or `?token=` for RFC 8058 one-click) | The email's link is `https://app.ujimora.com/unsubscribe/thank-you#token=…`. Idempotent. `400` for a bad link. |
| `GET` / `PUT /profile/donor-messages` `{ thankYouEmails: boolean }` | Settings switch for signed-in donors. |

Staff:

| Call | Notes |
|---|---|
| `GET /admin/donor-thank-yous?status=&page=&pageSize=` | Items are `DonorThankYouView` plus `campaignTitle`. No recipient data. |
| `POST /admin/donor-thank-yous/:id/retry` | Same safety rules as the author's retry. |
