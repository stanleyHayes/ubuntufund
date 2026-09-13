# Crypto availability and recovery audit

## Current checkpoint — 13 September 2026

Recovery intake independence, per-deposit isolation, persisted outcome summaries and retry rotation are implemented and tested below. Manual recovery now validates its request shape and nonnegative finite age; the use case rejects invalid date ranges and limits outside integer 1–100 before querying. This prevents malformed requests becoming database errors and protects direct callers from MongoDB's unbounded limit=0 semantics. Omitted age remains 30 minutes; zero age remains supported; clients cannot supply arbitrary batch sizes.

Eleven integration tests across both crypto files pass, including unauthenticated/non-admin rejection, invalid HTTP requests causing no scan, defaults/zero age, direct invalid scheduling controls and prior settlement/recovery regressions. API types/lint pass. Logs `/tmp/ujimora-crypto-controls-{tests,types,lint}.log`; sessions 82055/88336/76867 terminal exit 0. Missing-reference/provider operations, disclosures and external permissions remain unresolved. Historical entries below preserve audit chronology and are superseded by their implementation checkpoints.

13 September 2026 — IN PROGRESS. Read-only inspection while full API regression session 5623 runs. No production configuration, funds or provider settings changed.

| Surface | Current code evidence | Acceptance / next action |
| --- | --- | --- |
| Feature availability | `infrastructure/config/index.ts` sets crypto.enabled only when CRYPTO_PAYMENTS_ENABLED is true. | Default-off capability, not evidence of regulatory approval. Confirm operator/provider authorizations before production activation. |
| Discovery / quote / deposit | GetCryptoAssetsUseCase returns disabled/empty; CreateCryptoQuoteUseCase and CreateCryptoDepositUseCase reject when disabled. | Test that new intake remains disabled while existing obligations can settle. |
| Production provider | app.ts excludes mock provider in production and rejects unknown enabled primary/fallback providers. | Provider credentials and supported assets/networks are technical capability; review actual contracts, jurisdictions and approved activity. |
| Scheduled recovery | app.ts production reconciliation job additionally wraps crypto recovery in `if (config.crypto.enabled)`. | **Engineering gap:** turning off intake also stops scheduled recovery of existing deposits. Separate recovery from new-intake availability without creating new quotes/deposits. Keep explicit global reconciliation control. |
| Manual recovery | POST /admin/crypto/reconcile uses authentication/current admin guard and ReconcileCryptoUseCase directly. | Preserve this control when intake is off; verify access and retry behavior. |
| Webhook settlement | HandleCryptoWebhookUseCase is constructed independently of intake enabled flag and routes remain wired. | Retain signed/idempotent handling for existing obligations. Confirm with disabled-intake regression. |
| Recovery implementation | ReconcileCryptoUseCase scans stale crypto intents, selects original provider, polls getDeposit and reuses applyEvent. | Check per-record failures, provider removal and safe handling of pending obligations. Do not equate a configuration change with completed settlement. |

Regulatory evidence: [Bank of Ghana virtual-assets framework](https://www.bog.gov.gh/virtual-assets/) identifies the registration/licensing framework under Act 1154. The [16 April 2026 policy-position page](https://www.bog.gov.gh/virtual-assets-posts/ghanas-policy-position-on-virtual-assets-and-service-providers/) identifies joint BoG/SEC/FIC regulatory oversight. These pages do not establish Ujimora's classification, registration, licence or partner authorization. Required operator deliverables remain legal classification, covered services/jurisdictions, partner contracts/permissions, custody/settlement/refund responsibilities and documented production approval evidence.

Next engineering action after session 5623 is terminal: decouple scheduled recovery from the intake flag and verify disabled discovery/quote/deposit alongside continued existing-deposit reconciliation. Do not edit API/shared source during the full regression. All broader C12 disclosures and approval gates remain open.

## Recovery correction and verification

Full API session 5623 is terminal; source freeze lifted. app.ts scheduled crypto reconciliation now runs under the existing production/global reconciliation controls independently of config.crypto.enabled. No new quotes/deposits are enabled by this change. The original configured provider map remains available to resolve in-flight obligations.

Six crypto integration tests pass. The recovery test creates a real isolated deposit, disables intake, verifies disabled/empty discovery and rejected quote/deposit requests, then reconciles through authenticated admin HTTP and observes the campaign credited once; a second sweep does not increase it. Source inspection confirms the scheduled path calls the same reconciliation use case without the intake conditional. This is not a timed production-scheduler or live-provider test. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-crypto-disabled-recovery-{tests,types,lint}.log`; sessions 50317/98809/79482 terminal exit 0.

Remaining: per-record applyEvent failures currently escape the crypto sweep, provider-removal/missing-reference recovery operations, production authorization and the broader C12 disclosures. Earlier table describes the pre-correction finding; this checkpoint supersedes its scheduled-recovery engineering gap.

## Per-deposit recovery and truthful summaries

ReconcileCryptoUseCase now catches applyEvent/status-read failures per deposit, increments errored and continues the batch. A subsequent sweep can retry the remaining intent; already settled intents are excluded by the stale query. Summary counts use persisted intent status: SUCCEEDED is settled, PROCESSING is detected, FAILED/EXPIRED is failed, and other states remain pending. Provider-confirmed events below required confirmation count no longer inflate settled.

Eight real HTTP crypto integration tests pass, including one deposit whose application throws while a second settles, later recovery without duplicate credit, and a provider confirmation with insufficient finality remaining PROCESSING with zero campaign credit and settled=0. Disabled-intake recovery remains passing. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-crypto-recovery-isolation-{tests,types,lint}.log`; sessions 15424/60548/47066 terminal exit 0. All provider responses are test doubles, not live money.

The earlier per-record application failure finding is resolved for a returned batch. Provider removal/missing-reference handling, retry scheduling across a large failing backlog, production authorization and full release evidence remain open.

## Recovery batch fairness finding

Read-only follow-up confirms MongoDonationIntentRepository.findStaleCrypto selects PENDING/PROCESSING deposits by oldest updatedAt with a fixed limit. Provider/apply failures do not change scheduling metadata. A full oldest batch of persistently failing or unavailable-provider deposits can therefore recur indefinitely and postpone newer eligible deposits. Add durable attempt scheduling/rotation that preserves financial timestamps and does not lose retryability; verify a batch-boundary scenario with more than the requested limit and repeated failures. This finding is not yet implemented. Source remains unchanged while local regression session 48519 runs.

## Recovery batch fairness implementation

MongoDonationIntentRepository now orders stale crypto intents by cryptoReconciledAt, then original updatedAt and ID. Before polling/applying, the reconciler records a monotonic attempt timestamp only for still-pending/processing crypto intents. It uses timestamps:false so financial updatedAt remains intact. Failed, pending and unavailable-provider attempts rotate behind less recently checked deposits while staying retryable. A crash after recording the attempt does not delete or terminalize an obligation. Concurrent sweeps can still poll the same provider reference; existing settlement idempotency remains required.

Nine crypto integration tests pass. A real MongoDB test with three stale deposits and a batch limit of one proves all three are attempted despite persistent provider errors, the oldest attempt is retried on the fourth sweep, amount/status/financial timestamps remain unchanged, and terminal intents reject scheduling writes. Existing failed-application isolation, finality and disabled-intake recovery tests remain passing. API types/lint and whitespace checks pass. Logs `/tmp/ujimora-crypto-fairness-{tests,types,lint}.log`; sessions 18552/8223/59151 terminal exit 0. This follow-up supersedes the prior batch-starvation finding; missing-reference/provider operations, production permissions and broader C12 gates remain open.
