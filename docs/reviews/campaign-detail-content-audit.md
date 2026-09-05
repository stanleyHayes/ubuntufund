# Campaign detail content audit — 2026-09-05

Scope: web `/campaigns/:id`, its four tabs, donation dialog, owner actions, organizer information, sharing, and reporting. Checked against the checked-out API routes/use cases and read-only responses from the running local app. This is not a production settlement or payment-provider certification.

| Surface | Source of truth and result |
| --- | --- |
| Title, description, category, priority, status | `GetCampaignUseCase.toDTO`; rendered without invented labels or campaign-review claims. |
| Cover | First stored campaign image; branded placeholder when absent. |
| Beneficiaries | Stored `beneficiaries`; now displayed in “Who this supports”. |
| Raised amount, goal, currency | Campaign DTO; percentage computed from these values, progress bar capped at 100%, remaining amount clamped at zero. |
| Donor count | API distinct-donor count, not transaction count. |
| Dates and eligibility | Stored start/end timestamps, displayed in browser locale; ACTIVE and unexpired required by `CampaignEntity.canReceiveDonation`. UI and submission now reject expired/invalid deadlines. |
| Payment badges | Enabled-provider endpoint currently returns only Ujimora Wallet. Page and dialog now use the same enabled, implemented wallet rail, rather than the generic catalog. |
| Provider loading/failure | Explicit loading/error/unavailable states. Removed invented wallet fallback when provider lookup fails or is empty. Hook now uses the configured API client and checks response shape/status. |
| Other payment rails | The separate slug checkout uses Paystack intents. The ID-detail POST `/campaigns/:id/donate` accepts only wallet. No card/mobile-money/bank promises remain on this wallet flow. |
| Guest donation | Sends the user to sign in; successful login honors the internal campaign return path. No unauthenticated wallet submission. |
| Amount/message | Positive, finite amounts in whole pesewas; message max 500 characters; provider and eligibility rechecked before POST. Payment method sent as API enum `wallet`, not arbitrary provider slug. |
| Donation completion | Successful POST closes the modal, refreshes authoritative campaign totals/counts, and shows completed-wallet confirmation. Modal cancellation disabled while submitting. No real donation was submitted during this audit. |
| Donations tab | Campaign DTO has no donation array. Replaced unreachable “All donations” section and duplicate feed with the actual paginated donation endpoint, correct transaction count, pagination, loading, retry and empty states. Anonymous names/avatars respected. No unconditional “Live” claim. |
| Updates | Endpoint returns `{items}` as the existing hook expects. Creator-only posting agrees with API ownership; tightened title/content limits to 3–200 and 1–5000 characters. Failed creation now reaches the dialog error state. |
| Comments | Public read and authenticated create/delete routes match. Existing owner/author controls, 1000-character limit, errors and empty states retained. |
| Collaborators | Public/owner-aware list, invitation and removal routes match. Accepted and pending statuses remain distinct. Fetch failures now show a warning instead of silently implying no collaborators. |
| Organizer | Public-profile endpoint respects profile privacy. Removed fabricated name/trust score/verification on failure; unavailable organizer has no verification badge. |
| Verification | Badge derives exclusively from returned `verificationLevel`; country and name come from the same public-profile response. |
| Go LIVE | Existing authenticated route and owner control retained; API owns plan entitlement checks. |
| Edit/delete campaign | No implementation or mounted PUT/DELETE campaign routes exist. Removed these broken detail-page controls/dialogs. Did not build new backend capabilities as part of a content audit. |
| Share | Existing campaign URL resolves to the ID detail route. Cancelling native share no longer copies unexpectedly; failed legacy clipboard copy no longer reports success. |
| QR | Encodes the same valid campaign-detail URL; remains available in the disclosure. |
| Embed | Generated `/campaigns/:id/embed` has no matching route. Removed the broken embed control from this page. |
| Reports | Authenticated report endpoint, supported reason enums, 2000-character optional description. Guest action routes to login with return path. No report was submitted. |
| Route changes/not found | Detail state keyed by campaign ID; API 404 displays the existing campaign-not-found state. Removed incorrect `CampaignDetail.donations` assumption from the hook contract. |

## Runtime evidence

Read-only local API checks returned 200 for enabled providers, campaign, donations, updates, comments and collaborators. The inspected campaign reports GHS 84,500 / 120,000; active; one distinct donor; end date 2027-02-02; beneficiary “Tamale Basic Schools”. Donation endpoint reports one transaction. Updates/comments/collaborators are empty. Browser confirms the wallet-only overview, beneficiary, one-donor label, paginated GH₵250 record, and guest donation navigation to `/login`.

Three executable policy tests cover closed/expired/invalid campaigns, invalid monetary inputs, and filtering out unsupported payment rails. Run with `node --import tsx --test apps/web/__tests__/contracts/campaignDetailPolicy.node-test.ts`.

## Remaining data issue and validation limits

`apps/api/scripts/seed-dev.mjs` assigns raised campaign totals independently of its sample donation records. The inspected campaign has GH₵84,500 raised but only GH₵250 in its one recorded donation. These are inconsistent seed records, not a rendering calculation. No financial balances or donation records were rewritten.

Owner mutations and real money settlement were reviewed against implementation, not executed against user records. Login return-path behavior is implemented but completing login was not exercised because the browser was signed out. Authenticated owner controls are not claimed as end-to-end verified.

## Verification result

Web production build, targeted ESLint, whitespace checks, and all three policy tests pass. The full TypeScript process ended with signal 143 without diagnostics; a completed type-check result is not claimed.
