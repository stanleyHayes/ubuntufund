# Leaderboard privacy and amount accuracy — 13 September 2026

The leaderboard is a public recognition view, not a financial ledger. It now counts explicitly nonanonymous GHS donations to active/funded/expired campaigns. Anonymous gifts are excluded before grouping, so a named gift cannot reveal the same donor's anonymous amounts, campaign count or donation count. Anonymous-only donors do not expose a stable account ID. Other currencies are excluded rather than added together under a GHS label; their donation/accounting records remain unchanged.

Current account eligibility is applied before ranking/limiting and consistently to list, featured and stats. `showLeaderboards: false`, account closure, staff restriction and bilateral viewer blocks exclude an account. Only individual and organization roles participate. The separate profile-page privacy setting does not override an enabled leaderboard setting. Missing legacy settings retain their existing enabled default; this is not new explicit publication consent. Organization entries use the organization name when present. Public guest GHS gifts remain in all-category amount/donation totals, with no guest rank or registered-donor count. Opted-out/restricted accounts and anonymous gifts are excluded from these recognition totals; this changes displayed totals, not payment balances or journal entries.

All endpoints use optional viewer authentication and `private, no-store`, including featured donors and failures. Web main/featured hooks isolate viewer/filter results, clear denied reads and refresh on focus/periodically. Native uses the shared scoped public-read hook with screen focus/app activation and active polling. Both screens explain the GHS/public-contribution scope. Invalid paragraph/block nesting in the empty web view was corrected after the browser check surfaced it.

## Evidence

- Replaced the old aggregation-only mocks with real Mongo/API regression tests. Eight leaderboard/organization tests pass, including anonymous/nonanonymous mixed histories, USD exclusion, guest totals, opt-out before limit/featured selection, separate profile-page privacy, blocked/restricted/closed/admin exclusion, unpublished campaigns and unchanged funds/records.
- API type/lint pass. Web/native type/lint pass. Five web hook tests pass, including viewer-change late-response races and featured-donor focus removal. Native suite passes 62 tests.
- Web production build and native iOS/Android/web exports pass. Final web rebuild and strengthened phone test (empty-state/zero-total/console checks) pass after the HTML correction; the phone screenshot was inspected.

## Remaining scope

Initial-registration names and legacy identity still require publication-admission rollout. Explicit leaderboard enrollment policy remains a product/legal review of the existing default, not inferred consent. Separate currency leaderboards/FX conversion are not implemented; this board is explicitly GHS-only. Provider/financial reconciliation and refunds remain under their separate ledgers. Viewer-dependent results refresh within the client polling interval rather than by immediate push. Native screen/device interaction and real operational/store approvals remain release gates.
