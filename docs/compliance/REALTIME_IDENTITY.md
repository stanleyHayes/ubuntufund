# Current donor identity in replay and overlays — 13 September 2026

Donation SSE delivery now treats the buffered event as a notification, not as authority for its name, message, amount or ownership. Each live or replayed donation resolves the current stored donation within the stream's campaign. Missing/malformed IDs and records belonging to another campaign are dropped. The output is rebuilt from an allowlist: donation ID, current eligible name, stored amount and timestamp, and current permitted message. Injected account IDs, email and other unexpected fields are not copied.

Current anonymity, closed/restricted accounts and bilateral viewer blocks suppress names and messages as applicable. Guest identity uses the generic Guest donor label until a separate public-attribution admission exists. Registered names come from the current user record rather than the buffered event. Deleted/hidden messages stay absent. Live-session name/message/amount toggles are still applied after reconstruction, including replay. The campaign owner must remain publicly eligible under account closure/restriction/block rules before stream setup and at delivery/heartbeat. Eligibility-store failures close the stream without delivering unchecked identity. SSE responses remain private/no-store.

Overlay REST snapshots apply the same closed/restricted/blocked donor visibility while preserving session/campaign totals and donation amounts subject to the host's amount toggle. Authenticated overlay requests pass the viewer to the visibility policy; token-only overlays remain guest views. This does not delete donation records or financially reverse a donation.

The live host's EventSource cannot attach the account bearer header. Its donor-name buffer therefore now comes from authenticated REST donation reads, scoped by viewer/campaign/enabled state, refreshed on donation events, focus and every 30 seconds while visible. EventSource continues to update public totals. Raw guest-event names never populate this buffer. Denied REST loads clear identity. The optional `useSSE` hook's campaign route was corrected to the implemented `/campaigns/:id/events`; it no longer attempts nonexistent global routes. Global activity continues with authoritative REST polling.

## Evidence

- Nineteen API tests across real HTTP SSE/replay, guest feeds and live safety pass; API type/lint pass. New cases prove current-name replacement, amount reconstruction, stripping unexpected fields, blocked-viewer and restricted-author replay, wrong-campaign/malformed event rejection, and overlay redaction with retained totals/records. Existing anonymity, hidden-message, host privacy toggles, token gating and blocked-campaign stream closure regressions pass.
- Eleven web hook/live-workspace tests pass, including guest payload rejection, denied refresh, disabled state and viewer races. Final route-contract/live-identity tests pass five tests, and final web type/lint/build pass after correcting the optional hook URL.
- No native source changed in this slice. No provider broadcast, real donation, external email or store transaction was performed.

## Remaining

Creator supporter projections and independent public attribution admission; initial registration/legacy names; live title/media publication admission and actual live monitoring; physical-device and real-provider checks. Polling clears already displayed identity within a bounded interval; the server does not remotely erase content already delivered. Raw names can remain temporarily in the internal in-memory event buffer until eviction, but public donation delivery reconstructs them. No global SSE endpoint exists. Direct OBS/native overlay rendering and all retained operational evidence remain subject to the release ledger.
