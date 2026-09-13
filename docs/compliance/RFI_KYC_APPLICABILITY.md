# Ghana identity-verification applicability gate

Checked against primary sources on 13 September 2026. Status: applicability/provider evidence required; no regulated onboarding certification.

Bank of Ghana [Notice BG/GOV/SEC/2025/36](https://www.bog.gov.gh/wp-content/uploads/2025/11/NOTICE-NO.-BG-GOV-SEC-2025-36-NOTICE-Revised-Ghana-Card-for-Finantial-Transactions.pdf), effective 1 December 2025, addresses regulated financial institutions. It requires biometric verification, remote-onboarding liveness and MFA for digital products/services/channels, alongside Ghana Card identification and transaction verification duties.

The [November 2025 supervisory guidance](https://www.bog.gov.gh/wp-content/uploads/2026/01/SUPERVISORY-GUIDANCE-NOTE-2025-2.pdf), sections 2–7, specifies NIA-linked onboarding, applicable identity cards and limited alternative-document cases, including particular nonresident one-off transactions and diplomats. A general passport-upload option must not be treated as proof of meeting every applicable case. The guidance replaces the June 2022 version.

## Mapping to current code

- Ujimora's staff KYC record review, adult-date validation, private uploads, information exchanges and version-bound decisions establish application integrity. They do not establish NIA biometric matching, liveness or provider acceptance.
- Device fingerprint/face unlock protects a local session. It is not the regulated identity-verification procedure described by these sources.
- The user explicitly requires opt-in account MFA. Preserve that preference. If the actual regulated arrangement requires mandatory controls on financial activity, the release design must resolve that requirement explicitly rather than representing optional login MFA as sufficient.
- Identity approval now requires a full name, adult date of birth and an owned, available ID-document reference. New web/native selfies use a separate type and cannot satisfy that prerequisite. This is a structural product gate, not provider verification. Historical passport/selfie classification and the applicability of accepted ID types still require review; see `KYC_REVIEW_INTEGRITY.md`.

## Evidence needed before a regulated-flow readiness claim

The operator and qualified reviewer must establish Ujimora's and each partner's regulatory roles, approved crowdfunding/payment arrangement, customer population and responsibility for identity verification. Obtain the applicable partner onboarding and transaction-control contracts, a documented identity/liveness integration, permitted exceptions, failure/escalation handling, audit/retention rules and production acceptance evidence. Identify which financial actions must be prevented when verification or required authentication is absent. Record the decision in the release ledger; do not infer authorization from an API key or successful charge.

Engineering can continue with evidence integrity, truthful states and integration contracts while these gates remain open. No production NIA/provider verification, legal classification, new mandatory MFA policy or external approval was performed in this checkpoint.
