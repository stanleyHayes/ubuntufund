# API: donor thank-yous and on-behalf campaigns

All paths are under `/api/v1`. Responses use the usual envelope `{ data, message?, status }`; errors are `{ message, status, errors? }`. Types live in `packages/types/src/on-behalf.ts` and `packages/types/src/donor-thank-you.ts`. Every mutation is authorized on the server; anyone without access to a campaign gets `404`, so the API does not reveal which campaigns exist.

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

Errors: `403` when the plan does not include the feature or the limit is reached; `422` when `beneficiaryEmail` is the organizer's own address; `503` when invitations cannot be sent. The new campaign is `pending_review`, and the beneficiary is emailed an invitation.

### Campaign shape additions
Every campaign read (`GET /campaigns/:id`, by slug, lists, creation) now includes:

- `creationMode`: `self` | `on_behalf`
- `onBehalf?`: `{ beneficiaryName, beneficiaryType, beneficiaryConfirmed }`, which is public. Show "Organized by X on behalf of Y" and whether Y has confirmed.
- `viewerAccess?`: `{ manage, beneficiary, payoutAuthority, thankDonors }`. Present on signed-in reads of `GET /campaigns/:id`. It is informational only. Use `payoutAuthority` (not "is the creator") to decide whether to show payout and cashout controls, and `thankDonors` to show the thank-you entry point.

### Beneficiary details (manager, linked beneficiary, staff)
`GET /campaigns/:id/beneficiary` returns `CampaignBeneficiaryDetails`. It includes `consentStatus` (`pending` | `accepted` | `declined` | `expired` | `revoked`), `invitationEmailHint` (masked, manager/staff only), `invitationStatus`, `invitationSentAt`, `invitationExpiresAt`, `payoutAuthority` (`beneficiary` | `organization` | `none`), the gate flags `publicationRequiresConsent` and `donationsRequireConsent`, the action flags `canResendInvitation`, `canChangeBeneficiary` and `canRevokeConsent`, and `viewer` (manager / beneficiary / admin). It returns `404` when the campaign is self-created.

The actions (auth; 20 per 15 min per user):

| Call | Who | Notes |
|---|---|---|
| `POST /campaigns/:id/beneficiary/invitation` | organizer or org admin | Resend while `pending`/`expired`. Returns `429` within 60 s of the last invitation. Returns `{ expiresAt }`. |
| `PUT /campaigns/:id/beneficiary` | organizer or org admin | Same body as `onBehalf` above. Only before acceptance and while nothing has been raised (`409` otherwise). A public campaign goes back to review. |
| `POST /campaigns/:id/beneficiary/consent/revoke` | linked beneficiary | Only while nothing has been raised (`409`: contact support). |
| `GET /beneficiary/campaigns` | signed-in user | `BeneficiaryCampaignListItem[]`: the campaigns run for them. |

### Invitation links (public; 30 per 15 min per client)
The email links to `https://app.ujimora.com/beneficiary-invitation#token=<64 hex>`. The token is in the fragment, so it never reaches the server in a URL. Send it in the request body:

| Call | Auth | Result |
|---|---|---|
| `POST /beneficiary-invitations/preview` `{ token }` | none | `BeneficiaryInvitationPreview` (`status` may be `expired` or `superseded`). `404` for an invalid link. |
| `POST /beneficiary-invitations/accept` `{ token }` | required | `{ campaignId, status }`. `403` when the signed-in address is not the invited address, the email is unverified, or the account type is wrong (an organization beneficiary needs an organization account). `409` when it was already decided or replaced; `410` when expired. |
| `POST /beneficiary-invitations/decline` `{ token, reason? }` | optional | Declining needs no account. |

Show the preview before sign-in. If the visitor is not signed in, keep the token (for example in `sessionStorage`), send them to login/register, and bring them back.

### Staff
| Call | Body |
|---|---|
| `GET /admin/campaigns/:id/beneficiary/events` | Consent history: `[{ event, actorRole, actorId, payoutArrangement, reason, consentVersion, createdAt }]` |
| `POST /admin/campaigns/:id/beneficiary/reassign` | The `onBehalf` fields plus `staffReason` (20–2000 chars). Resets consent and payout authority and invites the new beneficiary. |
| `PUT /admin/campaigns/:id/payout-authority` | `{ target: 'beneficiary' \| 'organization' \| 'none', staffReason }` |

Staff cannot act on campaigns they created or benefit from (`403`).

### Plans and settings
Plans have three new fields: `onBehalfCampaigns` (boolean), `maxOnBehalfCampaigns` (-1 = unlimited) and `onBehalfFeePercent` (0–100, added to the platform fee locked at creation). They are editable through `PUT /plans/:tier` and `POST /plans`.

Admin settings (`/admin/commercial-config`) gain these keys. Switches take 0 or 1.

| Key | Default | Meaning |
|---|---|---|
| `onBehalf.publicationRequiresConsent` | 1 | Staff cannot publish until the beneficiary accepts |
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
| `POST /campaigns/:id/thank-you/preview` | Same body → `{ subject, text }`: exactly what donors receive, via the same template. |
| `POST /campaigns/:id/thank-you/send` | Header `Idempotency-Key` (16–100 chars, new per user action; keep it for retries of the same click); body `{ automatedReviewConsent?: boolean }`. Returns `202` with `DonorThankYouView` (status `queued`), or `200` for a replay. The message may be held for safety review: `409` with `errors.publication = ['held']`. Show the existing "Waiting for safety review" notice, then send the same draft again after approval. Other `409`s: not eligible or already sent. |
| `GET /campaigns/:id/thank-you/:thankYouId` | Progress: `status` (`queued` → `sending` → `sent` \| `partially_sent` \| `failed`), `recipientCount`, `sentCount`, `failedCount`, `skippedCount`, `retryableCount`. Poll every few seconds while `queued`/`sending`. |
| `POST /campaigns/:id/thank-you/:thankYouId/retry` | Re-queues retryable failures only → `{ requeued }`. |

Authors only ever see counts, never recipients.

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
