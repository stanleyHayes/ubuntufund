# Staff access audit — 12 September 2026

Current source evidence: `UserRole` supports user, organization and admin. Authenticated requests reload the current stored account role; administrative endpoints require admin. `/rbac/me` derives a static permission set from that role. The current admin baseline has full access. The Roles page displays system definitions and offers no persisted role assignment or permission editor.

Consequently, a read-only administrator in a mocked UI test is not an available production account configuration. The refund API's administrator guard is consistent with the current full-access role. Do not describe the UI's mocked permission restriction as evidence of per-staff server enforcement, or imply that users can configure a read-only staff account today. Additional default role definitions such as moderator/super-admin are not assignable through the current `UserRole` model.

Conditional delegation requirement: if the owner needs restricted staff accounts, first implement assignable scopes with authoritative server enforcement, revocation, management authorization and audit evidence. Such accounts are not currently supported; staff who are not authorized for full administration must not receive the full admin role. A new custom-role system is not itself evidence of legal compliance or an unconditional requirement to use the existing full-admin model. Do not enable a new role by expanding a frontend allowlist alone. The owner must establish the actual staff authorization matrix and access-review responsibilities; no production role or user was changed during this audit.

## Payout maker-checker — accepted risk, 25 September 2026

Production sets `PAYOUT_DUAL_APPROVAL_AMOUNT` to `"0"` in `render.yaml` (the Blueprint syncs it; confirm no manual override in the Render dashboard for `ujimora-api`). Every campaign and beneficiary payout therefore needs only one administrator approval. Administrators cannot change this at runtime: the commercial-config store deliberately excludes it. A non-zero threshold on a single-admin platform would freeze every payout at or above it until a second approver exists, so this is recorded as an accepted risk, and the API logs a warning at production startup while it is in force.

Compensating controls in code: approval only pays the owner-registered, reviewed destination bound to the payout; every approval needs a recorded review note; the campaign must be payable (not blocked or disputed) and the owner's KYC/KYB current at the reservation write; no administrator can approve a payout from their own campaign or one they requested; approvals and rejections are audited. Still required operationally: enforce administrator MFA, and review payout approvals in the audit log after the fact.

To enable maker-checker once a second approving administrator exists, set `PAYOUT_DUAL_APPROVAL_AMOUNT` in `render.yaml` to the owner-chosen GHS threshold (for example `"5000"`) and redeploy the Blueprint.
