# Pricing and direct creator donations review

## Pricing mismatch

Public marketing pricing was built from `SUBSCRIPTION_PLANS`, where Free is GHS 10,000. Campaign creation resolves the database plan and applies `min(plan.maxCampaignGoal, user.complianceApprovedCampaignLimit)` when a compliance cap exists. Seed initialization only inserts missing plans; it deliberately preserves existing database values.

Changes: added anonymous `GET /plans/public`, returning active/public plans from the same service used by campaign enforcement; marketing now loads this endpoint with skeleton and retry states instead of static pricing. Database read failures do not silently show default commercial values on this endpoint. Campaign creation explains when an account compliance cap is below the plan cap. Authenticated plan editing remains protected.

No production plan or account limit was modified. The production database could not be reached from this workspace. Therefore a stale Free plan at GHS 5,000 versus a specific account cap at GHS 5,000 cannot be distinguished yet. Check Admin → Plans → Free and the affected user's compliance limit. The code default already permits GHS 10,000; changing a subscription tier must never silently remove a compliance cap.

## Direct profile donations: current implementation

- Owners use `/creator` (Creator page in the account menu) to claim a handle and enable tips. Shareable public URL: `/creators/:handle`. Ordinary `/profile` is authenticated account management and is not the public donation page.
- Guests can view a creator and initiate a hosted Paystack charge without an account or campaign. The shared charge initializes in GHS; actual card/MoMo availability depends on Paystack merchant configuration. This flow has no Ujimora-wallet or crypto selector.
- Signed Paystack `tip-` webhooks mark tips succeeded and credit a separate creator balance. Duplicate credits are guarded; reconciliation repairs succeeded tips whose balance credit was interrupted. This is distinct from the member wallet.
- Creators can request withdrawals to a bank or mobile-money destination through Paystack Transfers. The UI currently asks users to type bank/network codes.
- Public totals/recent tips use succeeded records. The “Supporters” count counts successful tips, not unique people.

## Gaps before public launch

1. Checkout requests `/tip/callback`, but the web router has no route for it. Donors return to a missing page; there is no dedicated tip status/confirmation screen.
2. Tip routes lack request schemas for bounded decimal amounts/email/currency. Profile currency can be supplied while generic checkout is GHS. These contracts need to be aligned and validated.
3. The tip success webhook path checks its signature globally but then passes only the reference to tip settlement. It does not compare the event's amount/currency with the stored tip before crediting. Failed/missing pending-tip webhooks are not recovered by the succeeded-credit repair loop.
4. Creator withdrawal has no explicit KYC/beneficiary-verification gate in this use case. The ambiguous-transfer rollback gap was fixed in the paid-creator follow-up: funds now remain reserved for reconciliation after initiation has been attempted.
5. Public-profile discoverability, donor confirmation, unique supporter counting and payout bank/network selection need completion.

## Paid-creator follow-up

Active paid subscriptions are now required for profile setup and new tip checkouts. Free, trial and expired accounts cannot receive new tips. Withdrawals use the current plan fee, shown before confirmation and stored on the payout; historical payouts retain their original terms. Existing balances remain withdrawable after downgrade. See [the canonical policy](../creator-donations.md).

## Evidence

15 API integration tests passed across campaign plan enforcement, creator tips and creator withdrawals, using a local test database and mocked Paystack responses. Added coverage verifies public pricing matches the live Free plan, private plans remain hidden, anonymous mutation is rejected, GHS 10,000 creation is accepted, and an explicit GHS 5,000 account cap is preserved.

This is code/test verification, not a live-money checkout or production-provider verification. Creator gaps are documented, not silently declared fixed. Pricing and paid-creator changes are local pending publication. Two creator browser regressions and 39 web tests also passed.
