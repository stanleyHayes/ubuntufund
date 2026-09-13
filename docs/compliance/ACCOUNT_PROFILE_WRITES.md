# Atomic account profile writes — 13 September 2026

This is the persistence prerequisite for general profile publication review. It fixes stale/concurrent profile writes; it does not yet screen account identity or private-to-public changes.

## Verified API behavior

`UpdateProfileUseCase` now delegates to `AccountProfileWritePort`. The Mongo adapter updates only submitted account identity fields and submitted profile/settings fields in one transaction. Nested notification preferences use individual field patches, preserving omitted choices. It does not load and rewrite a stale settings snapshot. A real account write checks the authenticated credential version and closed-account flag before profile persistence, preventing an already-authorized request from recreating a profile after closure. Account/profile writes roll back together if persistence fails.

General user repository saves no longer write name, avatar, cover or country. They already exclude reviewed organization name/website. Older password/KYC/account snapshots therefore cannot restore stale public identity after a profile change. Dedicated registration and profile mutation paths retain their explicit responsibilities. No financial records are deleted or rewritten by these changes.

Six new integration cases cover simultaneous first-time privacy/contact/appearance/nested-notification writes, omitted fields and explicit clearing, private-profile read denial, stale generic identity saves, transactional rollback, rotated/closed credentials and protected account attributes. Together with existing profile-image, authentication, website-consent and organization-admission regressions, 27 API tests pass. API type check and lint pass. No API/shared source changed during that test invocation.

## Web Settings changes

Settings writes now send only the selected field and execute in selection order. The old payload included unrelated privacy and legacy notification values from the page's initial snapshot. Writes no longer use a delayed timer that could fire after leaving the page. Account-keyed form state and an unmount guard discard unstarted work from the old account.

The client tracks server-confirmed values independently of optimistic switch positions. If a request fails and no newer change supersedes that field, it restores the confirmed value, including when two opposite optimistic changes both fail. Controls have accessible switch names and explicit save/error feedback. Dedicated opt-in activity and newsletter endpoints retain their own consent workflows.

Web type/lint and production build pass; the full web suite passes 137 tests. The mocked 390px flow passes for queued disjoint settings, field-only payloads, a rejected visibility change and two opposite failed choices restoring the server-confirmed value. Switch roles/names are explicit. Screenshot inspected. No real account settings, provider calls or production data were changed.

## Next requirements

Add complete proposed-version admission for actual public account identity and private-to-public profile transitions, with a version-bound final write. Keep private contact information and nonpublic biography fields out of automated screening. Trace initial registration/legacy identity and all public author/name/image/country projections. Review native setting request ordering and account-switch behavior separately; the shared API patch guarantee does not prove native optimistic-UI behavior. Overall compliance and final commit/push remain pending.
