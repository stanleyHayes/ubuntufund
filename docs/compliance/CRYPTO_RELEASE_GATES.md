# Crypto availability and recovery audit

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
