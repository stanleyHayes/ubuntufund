# Legal policy revisions

The legal pack is defined in `packages/types/src/legal.ts` and rendered on the marketing site, the web app and the mobile app. Each policy shows its own effective date. Terms of Use section 15 says earlier versions are available on request from legal@ujimora.com; this record says where each earlier text is kept.

## Current effective dates

| Policy | Effective | Earlier text |
| --- | --- | --- |
| Terms of Use | 25 September 2026 | 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Privacy Notice | 25 September 2026 | 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Campaign Organizer Agreement | 25 September 2026 | 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Cookie Notice | 25 September 2026 | 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Subscription & Billing Terms | 25 September 2026 | 8 September 2026 text: `git show 01ccfaa4:packages/types/src/legal.ts` |
| Contributor & Donor Terms | 8 September 2026 | None. Unchanged since first published. |
| Payout, Refund & Failed Campaign Policy | 8 September 2026 | None. Unchanged since first published. |
| Acceptable Use & Prohibited Campaigns | 8 September 2026 | None. Unchanged since first published. |
| Delete your Ujimora account | 12 September 2026 | None. Unchanged since first published. |

Commit `01ccfaa4` is `main` as it stood before the launch fixes were merged. Its policy text is the text dated 8 September 2026. `apps/marketing/__tests__/legalClaims.test.ts` stores a fingerprint of each policy's text. The test fails when a policy's text changes but its date stays the same, and when this table does not list a policy's current date.

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
