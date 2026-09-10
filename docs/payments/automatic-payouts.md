# Automatic campaign payouts and Paystack recovery

Admin → Settings → Automatic payouts controls new campaign requests. Disabled by default. Existing pending requests are not automatically swept or re-approved. The policy and the last 100 changes record the editing admin, revision and time.

Defaults: maximum GHS 500/request, GHS 1,000/owner/day, GHS 5,000/platform/day, bank review validity 30 days. MoMo has a separate GHS 250/request ceiling and 24-hour capacity-review validity. Set its limit to zero to keep all MoMo manual. Daily budgets reset at UTC midnight and count attempts even if the provider fails; retries cannot evade limits.

Eligibility: standard GHS Paystack request with a retry key; verified email and identity level 2+; undeleted owner/campaign; no open dispute; immutable destination owned by that requester; current recorded human ownership review with a provider-resolved name; and an earlier successful, settled, manually approved payout to exactly that destination. First-time destinations and new recipient records require review. Early/urgent/assisted requests and dual-approval amounts remain manual. Existing request and approval fee/reserve checks still apply. MoMo capacity is not queryable through this integration: provider rejection is possible despite these controls.

A transactional budget claim prevents duplicate automatic attempts and races around daily limits. Existing payout balance reservations and ledger transitions protect transfer execution. Failed/unknown automatic attempts are not automatically resubmitted. Review their current provider state first.

## Paystack setup

Ujimora policy settings do not modify Paystack preferences. To eliminate per-transfer OTP prompts, disable **Confirm transfers before sending** in Paystack Settings → Preferences for the intended environment. The business owner must complete any Paystack security confirmation. Do not assume this finalizes an existing OTP transfer; authorize or reconcile that existing transfer separately.

After this API is deployed, test the optional server approval URL:
`https://api.ujimora.com/api/v1/payouts/paystack-approval`

It checks a stored PROCESSING payout and its exact reference, recipient code, GHS currency and minor-unit amount. It supports campaign single transfers/legs, creator, beneficiary and affiliate records; unknown or changed details fail closed. It initiates no transfer. Configure it in Paystack's Transfer Approval section only after a provider sandbox acceptance test confirms the request payload. This endpoint is not a webhook URL. The existing signed webhook remains `/api/v1/webhooks/paystack` and must be configured separately in Paystack for success/failure/reversal delivery. Transfers created directly in Paystack without a corresponding Ujimora record will be rejected when this approval URL is enabled.

Official references: https://paystack.com/docs/transfers/managing-transfers/ and https://paystack.com/docs/transfers/how-transfers-work/.

## Status and recovery

PROCESSING plus provider status `otp` is displayed as awaiting Paystack authorization. Admin payout cards offer **Check Paystack status**, **Resend OTP**, and **Authorize existing transfer**. OTP values are neither stored nor logged. These controls do not create a new transfer.

A verified `success` settles PAID. `failed`, `abandoned`, `blocked`, and `rejected` use existing failure settlement to restore the reserved funds exactly once. `reversed` uses the reversal handler. Pending/unknown results retain the reservation. Do not create a duplicate while a provider result is unresolved. After confirmed failure and restored balance, the owner can submit a fresh request with a new request key.

Admin/owner payout-list reads verify up to five in-flight single campaign payouts. Owner UI reloads history before fetching balances so a newly settled transfer and available amount agree. Web/admin refresh visible pages every 30 seconds and on focus. Production scheduled payout reconciliation runs every five minutes for records older than one minute. Missing provider responses never imply success or failure.

`apps/api/scripts/reconcile-campaign-transfer.ts <payout-id>` is a dry-run by default. `--apply` verifies reference/amount/currency and invokes existing idempotent settlement, including incomplete terminal-effect repair. It cannot initiate a transfer.

## Acceptance limits

Automated tests use a local Mongo replica set and mock Paystack. Enable automation only after choosing limits in admin and confirming Paystack settings in the desired environment. No live Paystack preference has been changed by this implementation. Native source changes need a new app build.
