# Crypto contribution UI and legal review

Date: 8 September 2026. Scope: web contribution flow, admin payment providers, marketing guide and current legal pages. Source: checked-out implementation and the retained Crypto Donations Implementation Plan and Legal and Policy Draft Pack v2.

## Delivered UI

- Web: Choose → Review → Transfer; currency cards, explicit network selection, exact send/campaign credit summary, quoted fees when provided, required memo/tag, copy feedback, expiry treatment, confirmation and failure states. Expired or changed-amount quotes cannot create a deposit. Server availability still gates the option; fiat remains the default.
- Admin: live currency/network availability and an administrator-only reconciliation control within Payment Providers. Uses GET /payments/crypto/assets and POST /admin/crypto/reconcile. Results describe the latest check, not lifetime totals. No invented provider configuration endpoint or transaction list.
- Marketing: /crypto contribution guide, footer discovery, and a payment-feature entry. Copy explains optional availability, network matching, confirmation and privacy rather than promising live asset support.
- Public legal copy: crypto sections in terms, contributor terms, organizer agreement, privacy, refund and acceptable-use pages. Web terms/privacy carry the relevant payment/privacy disclosures.

## Draft pack review

The retained Word documents are source drafts, not replaced or treated as approved agreements. Their text was extracted and checked. Update these before the next approved pack is issued:

| Source document | Required change |
| --- | --- |
| 00 Index | Add crypto launch dependencies and cross-reference revised policies. |
| 01 Terms of Use | Describe optional crypto contributions, confirmation and no investment/return promise. |
| 02 Privacy Notice | Addresses, transaction hashes, network, provider references, public blockchain persistence and limits of anonymous giving. |
| 03 Organizer Agreement | Campaign-currency credit after confirmation; no implied crypto payout entitlement. |
| 04 Contributor Terms | Exact asset/network/address/tag, rate and fees, expiry, transfer risks and delayed-payment support. |
| 05 Payout/Refund Policy | Provider-specific crypto refund capability, destination verification, conversion basis and fees; no automatic reversal or same-token refund promise. |
| 06 Acceptable Use | Address substitution, sanctions evasion, source-of-funds concealment and key/seed requests. |
| 07 Cookie Notice | No new browser cookie or tracking provider added by this UI. Reassess if a provider SDK/widget is introduced. |
| 08 KYC/AML | Confirm provider responsibilities for wallet screening, source-of-funds checks, escalation, holds, reporting and records before activation. Do not claim these controls exist merely because this policy describes them. |
| 09 Subscription/Billing | No crypto subscription checkout introduced; retain separation from campaign contributions. |

The implemented public clauses are product-grounded draft revisions. Ghana-qualified legal/compliance review remains required for the final agreements and production launch. Existing draft-pack placeholders and unrelated legal provisions were not certified in this review.

## Evidence and unresolved launch questions

- The backend currently includes a MockCryptoProvider. UI availability is not proof that a production provider is commercially onboarded or approved. Confirm actual deployment settings and provider readiness independently.
- Refund currency, conversion date, fees, wallet ownership checks and responsibility for failed transfers must be agreed with the production provider before publishing a specific refund promise.
- Confirm applicable Ghana virtual-asset authorization, partner arrangements, AML responsibilities and marketing permission. The BoG/SEC notice dated 20 February 2026 directs VASPs to avoid mass marketing/public promotion without express authorization. Applicability to this operator and factual guide needs qualified review; no approval is inferred from a working checkout.
- Source: [BoG/SEC advertising notice, 20 February 2026](https://www.bog.gov.gh/wp-content/uploads/2026/02/PRESS-RELEASE-PUBLIC-NOTICE-ON-UNAUTHORISED-ADVERTISING-OF-VIRTUAL-ASSET-AND-STABLECOIN-PRODUCTS-200226.pdf).
- Source: [SEC virtual asset sandbox participants notice](https://sec.gov.gh/public-notice-full-list-of-virtual-asset-sandbox-participants/). Presence of a framework or sandbox is not evidence of Ujimora authorization.

## Verification

Web/admin/marketing type-check and lint passed. Build and browser results are recorded in agent_plan.md. Browser payment verification uses mocked API responses; no real crypto was sent and no production reconciliation was run.
