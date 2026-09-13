# Campaign publication visibility

Implemented on 2026-09-12. This closes the identified public-read gap for draft, pending-review and blocked campaigns; it does not complete the broader compliance goal.

## Access rules

- Only `active`, `funded` and `expired` campaigns qualify for public reads. The shared domain predicate is also used by persistence filtering.
- Public discovery filters status before pagination and counts. Query parameters cannot opt into private records. Current server-authorized administrators retain their review list; authenticated owners retain their own campaign list.
- Nonpublic detail and campaign donation/collaborator/comment/update reads require the current owner or administrator. Guests and unrelated accounts receive 404. Deleted records remain unavailable, including to these readers. Middleware reloads the account, so a demoted administrator cannot rely on a stale role claim.
- Slug and legacy-ID share previews are always public projections, including when an owner is signed in. Organization cards, campaign lists, categories and displayed totals exclude private campaigns. This changes displayed public aggregates, not stored balances.
- The public recent-donation feed omits private campaign references; donation records remain intact. Filtering can produce fewer feed entries than the requested maximum.
- Public campaign SSE validates publication status before replay, every event delivery and each heartbeat. Blocking a campaign stops delivery to an existing stream and prevents reconnection.
- Live discovery, public donor sheets, overlays (including the HTML route), live SSE and new viewer tokens require a published campaign. Previously valid overlay tokens do not bypass this rule. Live/campaign/organization responses use private/no-store cache controls.
- Web/native campaign hooks fence state by viewer/account role and resource; late responses cannot restore another viewer's content. Failed refreshes clear it. Public web share and checkout pages also clear campaign content and SEO state on denied focus refreshes. Native detail retains its existing polling and app/navigation focus refreshes.

## Verification

- Stable pre-change full API baseline: **123 files / 836 tests**, completed without concurrent API/shared-source edits.
- Initial campaign/short-link checks: **30 tests**, including public/private statuses, owner/admin access, current-role enforcement, pagination/counts and preserved financial records.
- Expanded visibility/donation/realtime checks: **22 tests**. A real SSE connection closes after a campaign is blocked and does not deliver the next event or permit replay.
- Final visibility/live-safety/live-session/live-video run: **4 files / 21 tests**, including active-to-blocked live reads, valid overlay-token denial and cache headers. API types and lint pass.
- Full web suite: **36 files / 129 tests**, including four new viewer/share cache regressions. Web types/lint and final production build pass. The build retains its large-chunk advisory.
- Native suite: **45 tests**, including account/resource cache isolation; native types/lint and iOS/Android/web export pass.
- Two mocked 390px browser flows pass for share and checkout, including active-to-404 focus refresh, removed campaign title/content, no horizontal overflow and no page errors. Both screenshots were visually inspected.
- Legacy-ID public preview Node contract passes. Diff whitespace checks pass.

## Remaining limits and related work

This is an application read-access boundary. It cannot erase previously downloaded content, externally cached previews or already-public media URLs. Existing provider video connections require the separate durable moderation-stop workflow; denying API reads/new tokens does not itself prove that a previously joined provider room has been terminated. No live provider termination was exercised for this slice.

Preventive campaign/profile/payment/live/media admission, immutable campaign decision/version evidence, legacy content handling and operator/provider/store evidence remain in the compliance ledger. Optional post-login MFA and supported-device biometrics are queued after this user-prioritized correction. Compliance commit and main push remain pending; this document does not claim a deployment or legal/store approval.
