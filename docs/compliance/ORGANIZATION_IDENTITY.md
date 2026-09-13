# Organization identity publication — 13 September 2026

Engineering implementation covers edits to the organization name and website through the owner/delegated-admin workspace. Registration-derived identity, general account/member profile fields and public identity projections remain open; this is not a claim that all organization UGC has been screened.

## Controls

- The organization identity route validates both proposed public fields and only accepts HTTP(S) website URLs. Unknown fields are rejected. A complete proposed version uses the existing private publication-review service with an `organization.profile` action, actor/organization identifiers and a digest of the original identity and stored revision.
- Automated text screening is optional and unchecked. Without consent, with flagged content or when screening fails, the draft remains private and the current organization identity stays unchanged. Staff approval applies only to the same author, organization, proposed fields and original stored version. Reusing a decision across organizations, authors or subsequent revisions cannot publish.
- After admission, a transaction writes the actor credential fence, current admin membership fence, organization identity/revision and audit together. Current account/organization existence, role, publishing restrictions and agreement acceptance are checked again. Concurrent membership revocation/demotion, credential changes, closure or identity edits cannot slip through the final write. Audit failure rolls back every write. Financial, verification, website-contact consent and unrelated account fields are not included in the identity update.
- General `MongoUserRepository.update` no longer writes organization name or website. A stale password/profile/account save cannot restore an earlier identity outside its reviewed path. Registration still initializes these fields; preventive admission for registration and legacy/public projections remains open.
- All authenticated organization-team responses use `Cache-Control: private, no-store`.
- Web provides separate identity screening consent and review responses while retaining a held draft. Workspace changes clear consent and draft context, and workspace selection is disabled during a write. Account-keyed forms ignore late saves from the previous account. A redundant initial detail load that could reset newly typed fields was removed.
- Native organization owners have a separate identity editor within profile settings, with unchecked consent, preserved held drafts, inline review history, load retry and account-keyed state. Delegated-team administration remains the existing web workflow; this change does not claim new native team-management parity.

## Account closure

Organization erasure removes `organization.profile` review records by resource ID as well as all review records authored by the closing account. This covers organization drafts submitted by teammates. Review insertion now performs short transactional account writes before saving any new private review record; organization identity drafts fence both author and organization. A request authorized before closure cannot enqueue a new record after the closed-account check. External screening runs after that short transaction, never while holding its database locks. Existing review TTL and separate minimal audit retention still apply.

## Verification

- Initial organization admission/team suites: 9 tests pass. Separate auth/profile-image/website-consent regressions: 12 tests pass. This covers exact-version decisions, delegation revocation/demotion, credentials, stale revisions, organization/actor restrictions and agreements, closure, transaction rollback, stale general saves, provider failure and website validation.
- Web identity/review suites: 10 tests pass, including held draft/unchecked consent and a delayed save across account changes. Admin review evidence: 4 tests pass.
- Mocked 390px organization flow passes: private hold, retained draft, staff-decision refresh, exact resubmission and fresh consent after changing workspaces. Screenshot inspected; no horizontal overflow or page errors. No external message, real provider moderation or production publication occurred.
- Final shared-admission/erasure regression: 31 tests across five API files pass, covering organization/member closure and campaign/creator admission. API type/lint pass; no API/shared source changed during that invocation.
- Web/admin/native type/lint and web/admin production builds pass. Native logic suite passes 59 tests; iOS, Android and Expo web exports pass, including the updated privacy disclosure. Existing bundle-size advisories remain. The new native identity form has compilation/export evidence; physical-device interaction remains part of the final device release gate. No full-repository release sweep or store acceptance is claimed.

## Remaining scope

General member/account profile edits and private-to-public transitions; initial registration and legacy organization identity; organization bio/photo/country and all public author/name projections; immutable media inspection, real provider/language behavior and staffed response; complete processor/retention evidence. Those requirements remain in `READINESS.md` and `PUBLICATION_SCREENING_AUDIT.md`.
