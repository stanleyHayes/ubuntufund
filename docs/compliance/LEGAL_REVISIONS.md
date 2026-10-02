# Legal policy revisions

The legal pack is defined in `packages/types/src/legal.ts` and rendered on the marketing site, the web app and the mobile app. Each policy shows its own effective date. Terms of Use section 15 says earlier versions are available on request from legal@ujimora.com; this record says where each earlier text is kept.

## Current effective dates

| Policy | Effective | Earlier text |
| --- | --- | --- |
| Terms of Use | 25 September 2026 | 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Privacy Notice | 2 October 2026 | 29 September 2026 text: `git show d618c97b:packages/types/src/legal.ts`. 25 September 2026 text: `git show 208dfc56:packages/types/src/legal.ts`. 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Campaign Organizer Agreement | 29 September 2026 | 25 September 2026 text: `git show 208dfc56:packages/types/src/legal.ts`. 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Cookie Notice | 2 October 2026 | 29 September 2026 text: `git show d618c97b:packages/types/src/legal.ts`. 25 September 2026 text: `git show 208dfc56:packages/types/src/legal.ts`. 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Subscription & Billing Terms | 25 September 2026 | 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Contributor & Donor Terms | 29 September 2026 | 8 September 2026 text: `git show 208dfc56:packages/types/src/legal.ts` |
| Payout, Refund & Failed Campaign Policy | 8 September 2026 | None. Unchanged since first published. |
| Acceptable Use & Prohibited Campaigns | 8 September 2026 | None. Unchanged since first published. |
| Delete your Ujimora account | 12 September 2026 | None. Unchanged since first published. |

Commit `01ccfaa4` is `main` as it stood before the launch fixes were merged. Its policy text is the text dated 8 September 2026. `apps/marketing/__tests__/legalClaims.test.ts` stores a fingerprint of each policy's text. The test fails when a policy's text changes but its date stays the same, and when this table does not list a policy's current date.

## 2 October 2026 revision

This comes with publishing on approval (see `PUBLICATION_REVIEWS.md`, "Publishing on approval"). While `PUBLISH_ON_APPROVAL_ENABLED` is switched on, a staff approval publishes a held version without its author submitting it again. The switch is still off when this text is deployed, and the native app bundles the legal pack, so an installed build keeps this text whatever the switch does later (including a kill-switch pause). Both notices are therefore worded to be true with the switch on or off. Commit `d618c97b` holds the 29 September 2026 text these notices replace.

- **Privacy Notice**, *AI writing and safety screening*: the sentence "An approved version must be submitted again within seven days" is replaced. It now says:
  - when automatic publishing applies to a held version, staff approval publishes it, after the same checks as the author's own request, and the author is told the outcome in their notification inbox;
  - it is not published if a newer version was submitted or the item changed after submission, if the author withdrew it, or if their password or two-step verification settings changed since then;
  - for that check, a one-way fingerprint of the sign-in settings is stored with such a version and deleted with its review record;
  - otherwise, and always for live-session titles (published only when the host starts the session), an approved version must be submitted again within seven days of approval, and Publication reviews and the notification inbox show which applies.

  Live-session titles are also added to the list of texts that can be screened, as they already were in practice.
- **Cookie Notice:** held profile images are kept in the browser "so the same image can be saved again if approval does not publish it". Before: "so the exact version held for review can be submitted again once approved".

`LEGAL_ACCEPTANCE_VERSION` does not change. Bumping it would make every approved version end as "terms not accepted" until its author accepted again.

The effective date is the day this text is first deployed to production, not the switch-on day: the text is true before the switch is turned on, while it is on and after it is turned off. If the deploy day moves, change `REVISED_2_OCTOBER_2026` in `legal.ts`, this record and the fingerprints in `legalClaims.test.ts`. Turning the switch on or off needs no revision.

- Deployed to production: 2 October 2026 (PR #14, merge commit `65863705`)
- Switched on (`PUBLISH_ON_APPROVAL_ENABLED=true` on Render): 2 October 2026, by the `chore/publish-on-approval-on` change to `render.yaml`

## 29 September 2026 revision

These changes come with two features: campaigns run on behalf of a beneficiary, and donor thank-you messages.

- **Privacy Notice:** two new sections. *Thank-you messages from campaigns you support* covers how recipients are chosen and emailed through Resend; organizers see counts only; what the delivery records hold; and unsubscribing by link or in Settings. *Campaigns run for someone else* covers the beneficiary's name, email, relationship and reason; that the email is used only for the invitation and deleted once they decide; and the consent evidence we record (decision, time, terms version, a fingerprint of what they saw, and the IP and browser of the person deciding). The automated-screening section now lists thank-you messages among the texts that can be screened.
- **Campaign Organizer Agreement:** new section 12 (campaigns run on behalf of a beneficiary). It covers permission and accuracy, the beneficiary's acceptance as a gate, managing a campaign giving no right to its funds, organizations that receive funds for a beneficiary, beneficiary changes, and the on-behalf platform fee. New section 13 sets content rules for thank-you messages to donors.
- **Contributor & Donor Terms:** new section 11 (what the page shows about a beneficiary, when contributions open, and where funds go) and section 12 (thank-you messages and how to stop them).
- **Cookie Notice:** discloses `uf_beneficiary_invitation` (session storage), which keeps an invitation open across sign-in.

`LEGAL_ACCEPTANCE_VERSION` does not change. The Organizer Agreement is accepted each time a campaign is submitted, so the new text applies to campaigns submitted after the deploy.

- Deployed to production: _not yet recorded_

## 25 September 2026 revision

- **Terms of Use:** section 4 now says campaign organizers must also follow the Campaign Organizer Agreement, which they accept by submitting a campaign. Complaints (section 14) can be escalated to legal@ujimora.com. Section 15 says earlier versions are available on request, instead of saying they "remain available".
- **Privacy Notice:** the notice now names internal, aggregated reports as a purpose (section 3) and says the web properties use no cookies and no third-party analytics, tracking or advertising technologies (section 10). It also adds staff-decision notices in the activity inbox, and removes the references to a retention schedule, which does not exist.
- **Campaign Organizer Agreement:** section 10 now explains that you accept the agreement by submitting a campaign, after the campaign form shows a notice and a link to the agreement. Before this change, section 10 described acceptance records that did not exist.
- **Cookie Notice:** the notice was rewritten. It no longer describes consent-managed cookie categories. It now lists the actual local-storage and session-storage entries and how long each one is kept.
- **Subscription & Billing Terms:** plans bought on the website are paid for one period at a time and **do not renew automatically**. Store purchases renew under the store's terms. Before this change, the terms said subscriptions renew according to the selected billing cycle. Upgrade and replacement rules are also spelled out.

## Acceptance version

`LEGAL_ACCEPTANCE_VERSION` stays at `2026-09-12`, so the new dates do not ask anyone to accept the terms again. Before deciding whether this revision needs re-acceptance, the owner should consider two changes in particular: the billing change from automatic renewal to no automatic renewal, and the Terms now bringing in the Organizer Agreement. If re-acceptance is required, bump the version as a separate change.

Until then, an acceptance recorded with version `2026-09-12` refers to the 8 September 2026 text when its `acceptedAt` falls before the production deploy of this revision, and to the 25 September 2026 text after it. Record the production deploy time here when it happens:

- Deployed to production: _not yet recorded_
