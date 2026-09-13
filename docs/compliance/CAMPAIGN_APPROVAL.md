# Campaign approval — 12 September 2026

User instruction: goals above 250k require staff approval, except verified individuals/organizations with an earlier campaign. Campaign creation currently accepts GHS only.

## Applied rule

- Strictly above GHS 250,000: new campaigns start in `pending_review` unless the organizer has current approved verification and a prior published campaign. The generic tier auto-approval setting cannot waive this gate.
- Individuals need at least National ID verification level plus the latest identity verification record approved with a valid future expiry. Organizations need at least Institutional level plus the latest business verification record approved with a valid future expiry. Email verification, a stale profile badge or an older approval superseded by a newer pending/rejected/expired record is insufficient.
- Prior published history means an existing non-deleted campaign in active, funded or expired state. Draft, pending and blocked campaigns do not qualify. The implementation does not assume a first pending campaign was approved merely because another request is submitted.
- Exactly GHS 250,000 and lower continue to follow the existing configurable tier policy. For higher goals, an eligible verified returning organizer auto-approves independently of the base tier setting.
- Verification-based campaign count, subscription limits, compliance-approved goal caps and existing publication restrictions still apply. This approval rule is separate from preventive content screening, AML/KYB obligations, payout approval and financial licensing.
- Existing campaigns are not bulk-approved or reclassified. Pending-review campaigns continue through staff review. Current KYC/history lookup failures do not create an auto-approved high-goal campaign.

API wiring uses the real KYC repository. Admin review settings, web/native campaign creation and the shared terms explain the rule. Versioned tier settings still classify campaigns and govern the lower-goal policy; their label/copy now states the scope.

## Evidence and remaining audit

Fifteen focused integration/domain/use-case tests pass, covering individuals and organizations, first and pending-only history, current/expired/newer verification, the exact threshold, compliance caps and existing creation/plan behavior. Test data and approvals are isolated fixtures; no production campaign was approved. Final source verification and release sweep remain required.

Campaign history currently relies on persisted status, because legacy records lack immutable first-publication evidence. Preserve/inspect provenance when migrating legacy data; arbitrary imported statuses must not be treated as proven review history. Add durable approval-decision evidence and complete the broader content-safety/retention audit before release. Staff capacity and actual KYC/KYB review evidence remain operator requirements.
