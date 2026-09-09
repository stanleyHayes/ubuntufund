# Wallet funding and crypto provider setup

## Delivered and external acceptance

Paystack wallet funding and a Bitnob stablecoin receipt adapter are implemented. Tests use a disposable Mongo replica set and mocked provider HTTP responses; no Bitnob/Yellow Card credentialed sandbox session has been completed. Do not describe the second provider as integrated: Yellow Card is a candidate requiring a receipt-contract spike. Paychant is a third candidate for a hosted on/off-ramp experience.

The supplied `Ujimora_Crypto_Donations_Implementation_Plan.docx` names Yellow Card, Paychant and Bitnob. Its provider selection and sandbox acceptance requirements remain relevant.

## Wallet funding

1. Sign in, open Wallet, enter GHS 1–10,000 and select Fund wallet.
2. Checkout opens Paystack (card/MoMo). Current test keys display a test-mode notice.
3. A signed `charge.success` webhook or authenticated return-page verification triggers a fresh server-to-server Paystack verification.
4. Only matching reference, currency and gross amount can settle. Top-up completion, wallet credit, history entry and balanced journal commit in one Mongo transaction. Concurrent callbacks/webhooks cannot credit twice.
5. The wallet receives the full requested amount. Ujimora absorbs the separately recorded processor fee. This policy can be changed later through an explicit fee design.

Endpoints (authenticated):
- `GET /api/v1/wallets/topups/config`: availability and test/live mode, no keys.
- `POST /api/v1/wallets/topups`: `{ walletId, amount }` plus `Idempotency-Key`.
- `GET /api/v1/wallets/topups/:reference`: owner-only server verification/status.

Callback: `https://app.ujimora.com/wallet`; webhook uses the existing `https://api.ujimora.com/api/v1/webhooks/paystack` endpoint. The existing production reconciliation sweep also checks pending wallet top-ups. An interrupted initialization retains its pre-persisted reference and never generates a second charge for the same key. Definitively failed/abandoned payments can be retried as a new top-up.

Mongo must support transactions (Atlas or a replica set); no non-transactional balance-credit fallback is provided. Keep sandbox tests in a separate database from real balances. Before live launch, replace `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` in the deployment secret store after approval, verify the webhook, and complete a controlled live settlement check. A live key is not committed to the repository.

## Bitnob — implemented adapter, externally unverified

Current API base: `https://api.bitnob.com`. Testnet/production are selected by account keys. Current API authentication is HMAC with client ID/secret, not the older Bearer-token contract.

Required server variables:

```dotenv
CRYPTO_PRIMARY_PROVIDER=bitnob
CRYPTO_PAYMENTS_ENABLED=false
CRYPTO_ALLOWED_ASSETS=USDT,USDC
BITNOB_CLIENT_ID=
BITNOB_CLIENT_SECRET=
BITNOB_WEBHOOK_SECRET=
BITNOB_ALLOWED_NETWORKS=
CRYPTO_FALLBACK_PROVIDERS=
```

Populate an explicitly approved comma-separated network allowlist, e.g. `solana`, after confirming it appears in the account's supported-chain response. The adapter intersects this allowlist with `/api/stablecoins/supported-chains`. Stellar is excluded because Bitnob documents shared-address/memo attribution there. BTC remains outside this adapter's first release.

Webhook: `https://api.ujimora.com/api/v1/webhooks/crypto/bitnob`. Verify `x-bitnob-signature` using the account's webhook signing secret. Authenticated transaction reconciliation is also required before the campaign receives credit; a signed webhook alone does not supply the settlement amount.

Receipt flow:
- Fetch authenticated GHS-to-USDT/USDC conversion data and issue a short-lived internally locked quote using decimal arithmetic. This is valuation, not an executed FX trade.
- Generate a provider-managed receiving address with an idempotent reference. Persist its quote, asset/network, chain decimals and expected integer amount before showing it.
- Reject reuse of a receiving address for an independent contribution.
- Match the confirmed provider transaction to address, asset, network, exact amount and zero incoming fee. Underpayments, overpayments and nonzero incoming fees stay pending for manual review; they must not credit the full campaign amount automatically.
- Normalize confirmed receipts into the existing campaign settlement flow. Receiving stablecoins does not implement automatic conversion to GHS or beneficiary payouts. Those remain separate acceptance work.

Reconciliation scans up to 20 pages of 100 settled deposit transactions per pending contribution. High-volume accounts need indexed/reference-based retrieval confirmed with Bitnob before increasing scale. Unknown or mismatched receipts stay pending. Repeated or multiple transfers to one contribution address require operator review; automated partial-payment aggregation/refunds are not implemented.

Production never registers the mock provider. Explicitly selecting mock/unknown providers while crypto is enabled fails startup. Disabled legacy configuration can start without exposing any mock payment capability.

## Fallback policy

`CRYPTO_FALLBACK_PROVIDERS` defines an ordered list of registered adapters. Asset discovery and quote generation may try the next configured provider. Every accepted quote stores the chosen provider; deposit creation, webhook processing and reconciliation remain pinned to it. Never switch provider/address after the donor has accepted payment instructions. Contract tests cover fallback selection and pinned deposit routing using provider doubles.

Only Bitnob is currently a real registered adapter. Yellow Card and Paychant must not be added to this setting until their adapters and sandbox acceptance are complete. Missing/unimplemented names fail configuration rather than silently using mock.

## Yellow Card — planned fallback

Official docs expose custody vault creation, token/network configuration and receiving-address issuance. The currently published `Get Transactions` custody reference describes `/custody/sends` with send examples, while the stablecoin acceptance guide discusses receiving deposits. Before implementing a fallback, obtain the authoritative custody-receive query, webhook payload, finality, amount units, reference mapping and idempotency contracts from Yellow Card's sandbox onboarding. Do not infer that a send record is an incoming deposit.

Potential role: stablecoin receipt/custody plus Ghana fiat settlement. No automatic GHS settlement, Ghana onboarding approval or tested receipt adapter is claimed here.

## Paychant — alternative ramp

Paychant documents an embedded/redirect on/off-ramp, including Ghana payment methods. Its hosted user/KYC workflow is different from Ujimora's provider-issued address flow. Consider it as a separate checkout option rather than pretending it is a drop-in address fallback.

## Official sources checked 2026-09-09

- https://bitnob.dev/api-reference/authentication
- https://bitnob.dev/api-reference/addresses
- https://bitnob.dev/api-reference/addresses/webhooks
- https://bitnob.dev/api-reference/transactions
- https://bitnob.dev/api-reference/exchange-rates
- https://bitnob.dev/docs/stablecoins/getting-started-with-stablecoins
- https://docs.yellowcard.engineering/docs/accept-stablecoin-payments
- https://docs.yellowcard.engineering/reference/get-transactions
- https://docs.yellowcard.engineering/reference/post_addresses
- https://developer.paychant.com/integrations/redirect-integration
