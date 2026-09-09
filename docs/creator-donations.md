# Creator donations: entitlement and withdrawal fees

Updated: 9 September 2026

## Product policy

Creator profile donations require an active, unexpired paid subscription. Free plans and trials cannot enable a creator page or accept new tips. If your paid entitlement ends, new tip checkouts are disabled; existing balances remain withdrawable. Each creator withdrawal deducts the current effective plan’s platform-fee percentage from the requested amount. The fee and net transfer are shown before confirmation and fixed for that withdrawal. The same platform fee is not also deducted when a new tip is received. A failed or reversed transfer restores the full requested amount, including the Ujimora fee. Existing withdrawals keep their original fee terms.

Owners manage `/creator`; their public donation page is `/creators/:handle`. The private `/profile` account-settings page is not a public donation page. Guests can donate to an eligible creator without buying a subscription themselves. Previously issued checkout references may still settle after the creator downgrades; the API prevents starting new checkouts. An existing public profile remains readable with donations disabled.

## Plan fee source

The live admin-managed plan `platformFeePercent` determines the fee, not an environment variable or a separate creator rate. Eligibility requires an active catalog plan with a non-Free tier and a nonzero monthly or annual price, plus an active, unexpired subscription. Trials do not qualify.

| Plan | Default creator withdrawal fee | New creator donations |
|---|---:|---|
| Community (Free) | 3.5% on existing balances only | No |
| Plus (starter) | 3% | Yes |
| Pro | 2.5% | Yes |
| Organization | 2% | Yes |
| Enterprise | 1.25% | Yes |

These are seed defaults, not guaranteed production prices. Admin-managed values override them. For example, a GHS 100 Plus withdrawal reserves GHS 100, records a GHS 3 fee and transfers GHS 97. Fees round to two decimal places. No additional campaign priority/early payout fee is applied to this creator withdrawal flow.

## API and settlement

- `GET /creators/me` returns `policy: { eligible, planName, feePercent }` alongside the profile and balance.
- `POST /creators/profile` and `POST /creators/:handle/tips` enforce eligibility server-side. The public profile exposes effective `tipsEnabled: false` when entitlement ends.
- `POST /creators/withdraw` requires `expectedFeePercent` alongside the amount and recipient. A stale or absent rate returns 409 before reserving money. Refresh and reconfirm the quote.
- The payout stores gross `amount`, `feePercent`, `fee` and `netAmount`; webhooks and reconciliation use that snapshot even if the plan changes later.
- New tips record zero platform fee at receipt. Historical tips and payouts retain their stored financial terms; legacy payouts without fee fields resolve to fee zero and net equal to gross. No retrospective fee recalculation or balance migration runs.
- Successful payouts add net to `paidOutBalance` and fee to `payoutFees`. Failures restore gross; reversals undo both net and fee once. Ambiguous transfer-initiation errors remain reserved in PROCESSING until provider verification, avoiding a second spend while money may be in flight.
- Existing balances can be withdrawn after downgrade or expiry at the current effective plan rate, including the Free rate. Entitlement loss does not confiscate accrued funds.

## Deployment and verification

No new secret or database migration is required. `TIP_PLATFORM_FEE_PERCENT` is obsolete and ignored; it has been removed from `render.yaml`. Paystack checkout, Transfers and signed webhooks still require the existing provider configuration. Deploy API and web together because withdrawals now require explicit fee consent.

Targeted integration coverage includes Free/expired/trial restrictions, public eligibility, duplicate tip credits, fee preview rejection, net transfer amounts, withdrawal after downgrade, duplicate settlement/reversal, recipient failure and ambiguous transfer errors. Providers are mocked; no real-money transaction is claimed.

This change completes the paid entitlement and transfer-fee policy. It does not resolve the separate checkout callback, tip amount/currency validation or creator KYC gaps listed in [the implementation review](reviews/pricing-and-creator-donations-2026-09-09.md). Those remain launch requirements.
