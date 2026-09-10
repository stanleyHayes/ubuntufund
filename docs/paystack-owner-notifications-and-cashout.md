# Owner notifications and Paystack cashout

Reviewed 10 September 2026.

## What was repaired

- `donation.succeeded` previously published realtime events and logged a receipt hook, but created no owner notification. It now writes a deterministic-ID owner inbox item and calls Resend when configured. Guest gifts are supported; anonymous names are never included. The web Dashboard shows the inbox and refreshes every 30 seconds/on focus.
- Resend respects the owner's email/campaign-update preferences. A delivery marker prevents resending completed emails, and a stable Resend idempotency key protects immediate retries. Provider idempotency expires after 24 hours; an ambiguous send followed by a database failure across that window can still duplicate an email. Inbox creation itself is an atomic upsert that preserves read state.
- Pending outbox events retry each minute in production, independent of the payment reconciliation flag. Old events already marked dispatched are not automatically backfilled or emailed.
- Campaign owners now have a Cashout & payout history panel on their campaign. It loads owner-only net eligible balances, masked recipient details and current fee settings; supports bank/MoMo recipient setup, estimated service fees, payout requests and history.
- Transfer network failures, unreadable replies, malformed success replies and provider 5xx outcomes are treated as unconfirmed. Campaign, beneficiary and affiliate payouts keep funds reserved for reconciliation instead of releasing potentially transferred funds. Ambiguous batch legs retain their existing references/reservations. Creator withdrawals already retained reservations after attempted transfers.

## How cashout works

1. Open your own campaign and expand **Cashout & payout history**.
2. Save the verified beneficiary name, bank/mobile network and account/phone number.
3. Choose a cashout service and amount; inspect estimated fees/net proceeds.
4. Submit the request. It remains PENDING; this action does not send money.
5. An admin reviews it under **Payouts**, verifies beneficiary/eligibility and approves.
6. The app checks Paystack balance and atomically reserves campaign funds, then initiates the transfer. Signed `transfer.success`, `transfer.failed`, and `transfer.reversed` events settle or restore the balance. Scheduled reconciliation checks stale transfers every 30 minutes when enabled, with a 30-minute stale cutoff.

Campaign proceeds are distinct from personal wallet deposits, creator withdrawals and affiliate commission. Never use total campaign donations as the amount payable: settlement fees and prior payouts affect the net balance. Split campaigns remain blocked from ordinary campaign cashout and use their separate beneficiary payout path.

## Current fee defaults (admin commercial settings can override)

| Service | Ujimora fee | Limit |
| --- | --- | --- |
| Standard | 0 | Eligible campaign proceeds |
| Priority | 0.5%, minimum GHS 10 | Eligible campaign proceeds |
| Early | 1%, minimum GHS 20 | 80% of current eligible proceeds |
| Urgent | 1.5%, minimum GHS 30 | 80% of current eligible proceeds |
| Assisted | 1.5% + GHS 50 | Eligible campaign proceeds |

**Confirmed early-cashout policy:** while a campaign is before its end date and below its goal, standard/priority/assisted requests are rejected. Owners must choose early or urgent cashout. Approval repeats this check so old pending requests cannot bypass it. Admin → Platform Settings → Early cashout surcharge controls `earlyFeePercent`; this is additional to the plan fee already taken during donation settlement, not a second charge of that plan fee. Urgent fees cannot undercut the configured early surcharge. The reserve remains per current eligible balance; a permanent lifetime reserve is not introduced by this change.

## Paystack dashboard steps

1. Select the correct environment in Paystack. Test keys/test payments/test transfers simulate outcomes; they cannot pay real money to a bank or MoMo wallet. Keep both public and secret keys in the same environment.
2. Under **Settings → API Keys & Webhooks**, set the webhook URL to:
   `https://api.ujimora.com/api/v1/webhooks/paystack`
   This is the signed payment/transfer webhook, not `/donate/callback`.
3. Confirm your Ghana business is activated and Transfers are enabled before live cashout. Ghana recipients use `ghipss` for bank accounts and `mobile_money` for MoMo.
4. Keep sufficient **Paystack transfer balance** for the outgoing net amounts **plus Paystack transfer fees**. A successful collection or a Ujimora balance is not proof of available transfer liquidity. Coordinate automatic settlements/top-ups in the Paystack dashboard.
5. Check the transfer approval configuration. Ujimora has no Paystack OTP-entry/finalization UI yet. Transfers returning `otp` stay processing until finalized through Paystack's supported process/API. Do not assume an admin approval in Ujimora also satisfies Paystack OTP. Do not disable OTP casually; automated server approval requires a reviewed implementation (not currently provided by this app).
6. Follow each transfer's existing reference in Paystack. A timeout is not proof of failure. Do not create another dashboard/API transfer to retry an unconfirmed reference; reconcile the existing one first.
7. Keep `PAYMENTS_RECONCILIATION_ENABLED=true` on the production API. For immediate investigation, use the admin reconciliation tools, not manual balance edits.

The app's preflight balance check compares the beneficiary net amount; Paystack remains authoritative for its own additional transfer fee. An insufficient provider balance/fee failure must be resolved by funding the transfer balance.

## Owner email setup

On the API deployment, configure `RESEND_API_KEY` and `FROM_EMAIL=Ujimora <no-reply@ujimora.com>`, plus `PUBLIC_WEB_URL=https://app.ujimora.com`. Do not include comments as part of a dashboard environment value. The checked credential can read Resend and `ujimora.com` is verified. This does not establish that the same environment variables are set on Render or prove delivery to a mailbox.

A Paystack merchant receipt goes to the Paystack business contact; it is separate from the campaign owner's Ujimora notification. Device push/SMS delivery is not implemented by this repair. No real transfer, test payout or historical email was sent during this audit.

## Validation and limits

39 focused backend tests cover notification/Resend behavior, owner-only options, unconfirmed transfer reservations, fee calculations, batching and reconciliation; three owner-screen tests cover explicit cashout submission, balance bounds and inbox read actions. API/web type checks and focused lint pass. Desktop/mobile browser checks used mocked account/balance data. Local database integration tests require MongoDB and were not run; this is not a live-money end-to-end sign-off.

Sources: [Paystack single transfers](https://paystack.com/docs/transfers/single-transfers/), [managing transfers](https://paystack.com/docs/transfers/managing-transfers/), [transfer API](https://paystack.com/docs/api/transfer/), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
