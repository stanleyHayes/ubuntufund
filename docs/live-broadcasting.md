# Ujimora in-app broadcasting

## Current delivery

Hosts can prepare a live campaign, recover the active session from the server, join a LiveKit room with camera/microphone/screen sharing, share a public viewer link, and end the session. Viewers join without camera or microphone publishing permissions and can donate through a link that attributes their Paystack contribution to the session. Both `/live/:sessionId` and existing live QR destinations `/c/:slug/live/:sessionId` render the viewer page. Campaign details expose a Watch live broadcast link when an active session exists.

The live workspace and mobile menu use the appearance chosen in Settings: neumorphism, claymorphism, glassmorphism or minimal, including light/dark surface tokens. The mobile menu includes decorative SVG icon watermarks and a chain illustration. Appearance choices are separate from the optional OBS overlay, which retains Ujimora's broadcast branding.

The existing live APIs were functional for fundraising tracking; they did not transmit video. The new video integration is **engineering implemented, provider acceptance pending**. Automated tests verify permissions and contracts with signed tokens and mocked room management; no LiveKit Cloud credentials, actual camera broadcast, viewer media transport or production payment were exercised.

## Required account and credentials

Create a LiveKit Cloud project and place these values in the **API deployment's secret settings**:

```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

`render.yaml` declares all three variables with `sync: false`. For the existing `ujimora-api` service, open **Environment**, manually add these keys, then select **Save, rebuild, and deploy** (or save and deploy the latest build). Render does not create newly declared `sync: false` variables when updating an existing Blueprint. The service reads the values at startup, so a deployment/restart is required.

Never put the API secret in Vite variables, client code, git or chat. The server mints room-scoped, one-minute join tokens. Only authenticated campaign owners receive publishing permission; guests receive subscribe-only tokens. API keys themselves are never returned. The existing campaign-owner plan must include `liveStreaming` (the shipped Pro/Organization/Enterprise defaults enable it; Free/Starter defaults do not; verify the deployed plan configuration).

The UI disables new broadcasts while the video service is not configured. Browser camera/microphone access requires HTTPS (localhost is suitable for development) and permission from the host. Screen sharing depends on browser support. A viewer may need to select Enable broadcast audio because of browser autoplay rules.

## Deployment preflight

- Deploy API and web changes together. Include `https://app.ujimora.com` in `CORS_ORIGINS`; static overlay framing is limited to self and configured web origins.
- Confirm the `one_active_session_per_campaign` partial unique index exists on `livesessions`. On an older database, first audit duplicate active sessions. Resolve any duplicates deliberately before creating the index; this change does not silently end existing broadcasts.
- Keep one API process/instance for the current in-process fundraising SSE event bus. A shared event broker is required before scaling the API across instances. LiveKit handles video transport separately.
- Confirm the provider project's quota/billing supports the intended number of concurrent viewers.
- Confirm Paystack credentials and webhook configuration independently. Paystack test keys do not accept real donations.

The duplicate audit is read-only:

```javascript
db.livesessions.aggregate([
  { $match: { status: 'active' } },
  { $group: { _id: '$campaignId', count: { $sum: 1 }, sessionIds: { $push: '$_id' } } },
  { $match: { count: { $gt: 1 } } }
])
```

## Acceptance with credentials

1. An eligible owner opens an active campaign's Go live page and creates a session. Verify that repeating Start and reloading recover the same session.
2. Select Start camera & microphone and grant permissions. Verify actual camera/audio and screen-share tracks from a separate guest browser on the public viewer link. Guests must not be able to publish.
3. Test denied device permissions, audio autoplay, host reconnect, mobile playback and a second network (Wi-Fi/mobile data).
4. Use the live QR/viewer donation link, complete a Paystack test donation, and verify campaign totals, session totals and donation attribution. Payment settlement must be independently verified before any balance changes.
5. Change privacy settings; test initial overlays and reconnect/replayed SSE events. Rotate the overlay token; old streams are revalidated before events and on the 20-second heartbeat. The overlay refreshes authoritative state every 10 seconds.
6. End the session. The API requests LiveKit room deletion before marking the session ended. Provider failures remain visible and retryable. Confirm remote viewers disconnect and the viewer page changes to Ended. Existing issued join tokens have a short expiry, so verify provider revocation/reconnect behavior within that window before release.

No recording/archive pipeline is included in this first broadcast implementation.

## Evidence

17 API tests passed for live-session lifecycle, realtime feeds, host/viewer grants and provider-room error handling. Seven frontend tests passed for selected appearance, provider-disabled starts, session recovery, viewer links and ended broadcasts. The static preview contract also passed. Browser inspection verified desktop/mobile studio surfaces, claymorphism selection and mobile menu SVG watermarks. Real media transport remains externally unverified.

Official references:
- https://docs.livekit.io/reference/components/react/component/livekitroom/
- https://docs.livekit.io/reference/server-sdk-js/
- https://docs.livekit.io/home/server/generating-tokens
