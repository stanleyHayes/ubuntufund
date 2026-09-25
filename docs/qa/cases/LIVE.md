# Live fundraising (78 cases)

Go-live studio, LiveKit video and screen share, overlays, realtime totals, privacy toggles, viewers, moderation stops.

[Back to the QA plan](../README.md)

## LIVE-002 · P0 · LiveKit configured: correct grants in tokens and no secret leakage

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** LIVEKIT_URL=wss://<project>.livekit.cloud, key and secret set on ujimora-api, service redeployed. Host with an active session. A second browser signed out and a third signed in as another user.

**Steps:**

1. GET /api/v1/live-sessions/video/config and confirm enabled:true.
2. As host, POST /live-sessions/<sid>/video/host-token. Inspect the JSON body and response headers.
3. Decode the JWT offline (do not paste production tokens into online tools). Check identity, room grant, canPublish, canPublishData and exp.
4. As a guest, then as a signed-in non-owner, POST /live-sessions/<sid>/video/viewer-token and decode.
5. Search the built web assets (dist/*.js) and the exported mobile bundle for the LiveKit API key and secret strings, and any VITE_/EXPO_PUBLIC_ LiveKit variables.

**Expect:** Host token body has only serverUrl, token and role:'host'; Cache-Control no-store. JWT: identity host-<userId>, room ujimora-<sid>, roomJoin, canSubscribe true, canPublish true, canPublishData false, TTL about 60s. Guest: identity viewer-<uuid>, canPublish false. Signed-in: viewer-<userId>. The API key and secret appear in no client bundle or response.

**Needs:** LiveKit Cloud project credentials

**Source:** `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/infrastructure/config/index.ts`, `render.yaml`, `docs/live-broadcasting.md`

## LIVE-003 · P0 · LIVE deployment preflight: index, single instance, URLs, unbuffered SSE

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Production-like environment (Atlas replica set, Render service, deployed web). DB read access.

**Steps:**

1. Run the duplicate-active-session aggregation from docs/live-broadcasting.md against livesessions and confirm zero results.
2. Run db.livesessions.getIndexes() and confirm a partial unique index named one_active_session_per_campaign on {campaignId:1} with partialFilterExpression {status:'active'}.
3. In Render confirm ujimora-api runs exactly one instance on a plan that does not spin down (render.yaml currently says plan: free) and that autoDeploy will not fire during a scheduled live event.
4. Confirm CORS_ORIGINS includes https://app.ujimora.com, PUBLIC_WEB_URL=https://app.ujimora.com and PUBLIC_API_URL=https://api.ujimora.com.
5. Confirm the web build's VITE_API_URL is absolute (https://api.ujimora.com/api/v1) so copied OBS overlay URLs point at the API host. Note whether VITE_SSE_ENABLED is 'true'.
6. curl -N https://api.ujimora.com/api/v1/campaigns/<activeCampaignId>/events and watch for 25s.

**Expect:** No duplicates; the index exists. One non-sleeping instance (the in-process EventBus and rate limiter need one process). curl prints 'retry: 3000' at once and ': heartbeat <ts>' about every 20s without proxy buffering. The overlay link copied in the studio starts with https://api.ujimora.com/api/v1/live-sessions/.

**Needs:** Render dashboard, MongoDB Atlas

**Source:** `docs/live-broadcasting.md`, `apps/api/src/infrastructure/database/models/LiveSessionModel.ts`, `apps/api/src/infrastructure/realtime/EventBus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/web/src/lib/fundraising.ts`, `render.yaml`

## LIVE-006 · P0 · API authorization matrix for owner-only live endpoints

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Active session <sid> on campaign <cid> owned by Host. Bearer tokens for Host, another user and an admin (role admin). An API client such as curl or Postman.

**Steps:**

1. For each identity (Host, other user, admin, no token) call: POST /campaigns/<cid>/live-sessions; GET /campaigns/<cid>/live-sessions/active; PATCH /live-sessions/<sid> {showAmounts:false}; POST /live-sessions/<sid>/overlay-token/rotate; POST /live-sessions/<sid>/video/host-token.
2. Call GET /live-sessions/<sid>/public as a guest and inspect the body.
3. As the other user, PATCH /live-sessions/<sid> {status:'ended'}.

**Expect:** No token: 401 everywhere except /public. Other user: 403 ('Only the campaign owner can …'); the session is not ended. Admin: active, PATCH and rotate succeed, start returns the existing session, but host-token returns 403 'Only the campaign owner can broadcast'. Host: 200/201. /public never includes overlayToken.

**Needs:** LiveKit for host-token

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`, `apps/api/src/application/use-cases/liveSessionAccess.ts`, `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/application/use-cases/mappers/liveSessionDto.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## LIVE-007 · P0 · Plan gating: only plans with liveStreaming can go live

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Four hosts, each with an active campaign: Community (free), Plus (starter), Pro (active) and a Pro subscription that is cancelled or expired. Check in admin Plans (or the DB) that liveStreaming is false for Community and Plus and true for Pro, Organization and Enterprise.

**Steps:**

1. Each host opens /campaigns/<id>/live, ticks the publication consent and clicks 'Go LIVE'.
2. Admin: toggle liveStreaming on for Plus in the plans configuration; the Plus host retries.
3. Revert the plan change.

**Expect:** Community, Plus and the lapsed Pro host get 403 'Your <Plan name> plan does not include LIVE streaming. Upgrade to unlock it.' and no livesessions document is created. Active Pro starts. After the admin plan edit, Plus can start.

**Needs:** OpenAI key (automated screening), LiveKit

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `packages/types/src/subscription.ts`

## LIVE-011 · P0 · Happy path: start a session with automated screening consent

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** OPENAI_API_KEY set; LiveKit configured; Pro host with current agreement and an active campaign (goal GHS 10,000).

**Steps:**

1. Web: /campaigns/<id>/live. Enter Session title 'Friday night charity stream', Session goal 2000, leave the privacy switches on, tick the publication consent and click 'Go LIVE'.
2. Observe the page layout.
3. DB: inspect the livesessions document and the publicationreviews document.
4. In a guest browser, open /campaigns/<id> within 15s.
5. Repeat on iOS and Android with 'Create live session' on a second campaign.

**Expect:** 201. The 'LIVE' badge appears next to 'Go live'. The video panel shows 'You’re ready to broadcast'. 'Viewer link' shows https://app.ujimora.com/live/<sid>. Also shown: Live totals, OBS overlay (URL with a 48-hex token), Donor privacy, Dynamic QR codes and Donor feed. The session document has status active, zeroed stats and the targetAmount. The review is approved by automated:openai. The guest sees 'Watch live broadcast'. Native shows the host video card, QR manager, overlay card, stats line and privacy switches.

**Needs:** OpenAI moderation, LiveKit

**Source:** `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## LIVE-015 · P0 · One active session per campaign under double taps and parallel starts

*Surfaces:* android, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Pro host, active campaign with no active session, approved title (consent on).

**Steps:**

1. Web: double-click 'Go LIVE' as fast as possible.
2. End the session. Open the studio in two tabs and click 'Go LIVE' in both within one second.
3. End the session. Tap 'Create live session' on iOS and click 'Go LIVE' on web at the same moment.
4. End the session. Fire 5 parallel curl POST /campaigns/<id>/live-sessions.

**Expect:** Every response returns the same session id and overlay token. db.livesessions.countDocuments({campaignId:<id>,status:'active'}) is 1 each time. No 500 or duplicate-key error reaches the UI.

**Needs:** LiveKit, OpenAI

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/infrastructure/database/models/LiveSessionModel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionCreation.ts`

## LIVE-018 · P0 · Web host camera and microphone broadcast reaches a guest viewer

*Surfaces:* web  ·  *Type:* functional

**Before:** Active session. Host on Chrome desktop over HTTPS with camera and mic. Guest viewer on another device.

**Steps:**

1. Host clicks 'Start camera & microphone' and allows both browser prompts.
2. Viewer opens https://app.ujimora.com/live/<sid> and clicks 'Watch broadcast', then 'Enable broadcast audio' if shown.
3. Host mutes, then unmutes, the mic from the control bar; turns the camera off, then on.
4. Host uses the control bar Leave button.

**Expect:** Host status reads 'Connected · Your enabled camera and microphone are live' with a self-view tile. Viewer status reads 'Connected to broadcast' and shows video with audio after enabling it, with no permission prompts on the viewer. Mute and camera-off are reflected within a few seconds ('Waiting for the host’s video…' when no tracks). Leave returns the host to 'Start camera & microphone' and the session stays LIVE.

**Needs:** LiveKit Cloud

**Source:** `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/web/src/pages/WatchLivePage.tsx`

## LIVE-023 · P0 · iOS host camera and microphone: permission prompts, denial and recovery

*Surfaces:* ios  ·  *Type:* compliance

**Before:** Physical iPhone (iOS 17 or 18), EAS production or release-profile build (not Expo Go), fresh install, Pro host with an active session.

**Steps:**

1. Broadcast studio, 'Start camera and microphone', then 'Camera on'.
2. Read the system prompt text, then choose Don't Allow.
3. Tap 'Unmute' and deny the microphone prompt.
4. iOS Settings > Ujimora: enable Camera and Microphone, return and tap 'Camera on' and 'Unmute'.
5. Viewer on web confirms video and audio.

**Expect:** Prompts show 'Use the camera to … broadcast video in live campaign sessions you start.' and 'Use the microphone to broadcast your voice in live campaign sessions you start.' Denial shows 'Camera or microphone access failed. Allow access in Settings, then enable the device.' (or a media error) with no crash. After enabling in Settings, video and audio reach viewers. No notification permission prompt ever appears.

**Needs:** LiveKit, signed iOS build

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/app.json`, `apps/mobile/STORE_SUBMISSION.md`

## LIVE-027 · P0 · Android screen sharing with the media-projection foreground service (Play policy)

*Surfaces:* android  ·  *Type:* compliance

**Before:** Android 14 or later signed build. Host connected in the studio. Web viewer watching. Screen recorder available to capture Play review evidence.

**Steps:**

1. Tap 'Share screen'. In the system dialog choose 'A single app' and then 'Entire screen' on separate runs, then Start.
2. Confirm a persistent foreground-service notification or status chip while sharing, and switch between apps.
3. Stop via 'Stop sharing' in the app; start again and stop via the notification or system chip; start again and revoke from Quick Settings.
4. Tap 'Share screen' and Cancel the system dialog.
5. Repeat 3 sessions. Record the video Go live, Share screen, system prompt, notification, Stop.

**Expect:** Capture starts only after explicit consent. The notification is visible for the whole capture and removed when it stops. Viewers see the screen. Cancelling produces no capture and no service. No SecurityException or crash on repeats. The evidence video is ready for the Play Console FOREGROUND_SERVICE_MEDIA_PROJECTION declaration.

**Needs:** LiveKit, Play Console

**Source:** `apps/mobile/app.json`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/STORE_SUBMISSION.md`, `apps/mobile/APP_REVIEW_NOTES.md`

## LIVE-031 · P0 · Guest viewer on desktop and mobile browsers

*Surfaces:* web  ·  *Type:* functional

**Before:** Active broadcast with host video. Logged-out browsers: Chrome desktop, Safari desktop, iOS Safari, Android Chrome.

**Steps:**

1. Open https://app.ujimora.com/live/<sid>.
2. Click 'Watch broadcast'; if needed click 'Enable broadcast audio'.
3. Watch the 'Together, during this broadcast' box while a donation completes elsewhere.
4. Check 'Support this campaign' and 'View campaign' targets.
5. View page source and meta.

**Expect:** Title shows the session title, or 'Live on Ujimora' when it has none. No camera or mic prompt. 'Connected to broadcast' with video and audio after the autoplay gesture. The total and donation count update within about 10s ('Updates every few seconds'). Support links to /c/<campaignId>/donate?liveSessionId=<sid>. Robots meta is 'noindex, follow'. No Report or Block controls for guests.

**Needs:** LiveKit

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/components/live/LiveVideoPanel.tsx`

## LIVE-032 · P0 · Viewer tokens cannot publish media or data

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Active session. LiveKit CLI or the livekit-client console available.

**Steps:**

1. As a guest, capture the viewer-token response on the watch page.
2. Try to join and publish a camera track with that token (for example 'lk room join --publish' or localParticipant.setCameraEnabled(true) in the console).
3. Try to publish a data message.
4. As a signed-in non-owner, POST /live-sessions/<sid>/video/host-token.

**Expect:** Publishing media and data is rejected by LiveKit (permission denied). host-token for a non-owner returns 403 'Only the campaign owner can broadcast'. Only the owner's host token carries canPublish.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## LIVE-036 · P0 · Viewer scale and shared-IP load (venue Wi-Fi or carrier NAT)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Production-like API on the launch Render plan. LiveKit plan quota confirmed. 25 to 50 viewers, with at least 10 on one Wi-Fi or mobile hotspot (same public IP). Host with OBS overlay.

**Steps:**

1. All viewers open the watch page and 'Watch broadcast' for 30 minutes while 10 donations are made.
2. Monitor API logs for HTTP 429 and the X-RateLimit-Remaining header, plus CPU, memory and the LiveKit dashboard participant count.
3. In the logs, check whether req.ip differs per client or is the proxy address.

**Expect:** No viewer or host gets 'Too many requests'. Each watch page polls /public every 10s (about 90 requests per 15 min), and the limiter allows 300 per 15 min per req.ip; no app.set('trust proxy') exists, so behind Render all clients may share one bucket. Video is stable and within quota. Launch blocker if 429s appear.

**Needs:** LiveKit quota, Render

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/app.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/live/[sessionId].tsx`

## LIVE-037 · P0 · Host request budget during a 45-minute broadcast

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Host on one network running the web studio (active-session poll every 10s, embedded overlay iframe polling every 10s plus SSE, donor feeds polling every 30s) and OBS with the overlay Browser Source on the same public IP.

**Steps:**

1. Run for 45 minutes with a donation every 5 minutes.
2. Watch the studio for error alerts and the overlay for 'Could not load overlay (429)'.
3. Record X-RateLimit-Remaining on /live-sessions/<sid>/overlay responses.

**Expect:** No 429 at any point. The studio, embedded overlay and OBS overlay all keep updating. If remaining drops toward 0, raise the limits or exempt live endpoints before launch.

**Needs:** OBS Studio

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/web/src/components/live/LiveBroadcastPreview.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-038 · P0 · Card donation from the live viewer link is attributed exactly once (money accuracy)

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Paystack test keys, webhook set to {API}/…/webhooks/paystack. Active session with showAmounts on. Baseline recorded: campaign raisedAmount, session stats, campaign balance. OBS overlay open.

**Steps:**

1. Guest on /live/<sid> clicks 'Support this campaign' and confirms the URL has ?liveSessionId=<sid>.
2. Donate GHS 50.00, no tip, name 'QA Donor', message 'Go team', using a Paystack test card, and accept the terms.
3. Complete payment and land on /donate/callback.
4. Check the overlay, watch page, host studio 'Raised' and 'Latest:', and the donor email inbox.
5. DB: donationintents (status, liveSessionId, settlement financials), donations, livesessions.stats, campaign raisedAmount, and the ledger journal for the donation.

**Expect:** Intent SUCCEEDED with liveSessionId. Campaign raised +50.00. session.stats successfulDonations +1 and amountRaised +50. The overlay alert 'QA Donor · GH₵ 50' with 'Go team' appears within about 2s (after message approval, if required). The watch page shows +50 within 10s. The ledger platform fee, processor fee and beneficiary net match the fee configuration and sum to the gross. A receipt email arrives.

**Needs:** Paystack test keys and webhook, email provider

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/OutboxDispatcher.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`

## LIVE-039 · P0 · Mobile money donation stays pending, then settles once via webhook

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Paystack test MoMo number; active session.

**Steps:**

1. From the live link, donate GHS 20 via mobile money.
2. While the charge is pending, check the overlay, session stats and campaign raised.
3. Approve or let the test charge succeed so Paystack sends charge.success.

**Expect:** Nothing changes while pending: no alert, stats unchanged. On success, exactly one +20 to session stats and campaign raised, and one overlay alert.

**Needs:** Paystack test MoMo, webhook

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`

## LIVE-040 · P0 · Tip, fee and rounding accuracy for live donations

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Active session; fee configuration known; tip option enabled on the donate page.

**Steps:**

1. Donate GHS 100 plus a GHS 5 platform tip via the live link.
2. Donate GHS 33.33 with no tip.
3. Compare Paystack charged amounts, intent settlement minor units, session amountRaised, campaign raisedAmount, campaign balance (beneficiaryNet, platformFee, processorFee, tip) and the overlay amounts.

**Expect:** Paystack charges 105.00 and 33.33. Session amountRaised and campaign raised increase by 100 and 33.33 (tip excluded) to the pesewa. Fee lines round to 2 decimals and net plus fees plus tip equals gross exactly. The overlay shows 'GH₵ 33.33' (en-GH grouping) with no float artefacts.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-041 · P0 · iOS viewer donation hands off to Safari (no in-app payment)

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iOS signed build; active session on (a) a campaign with a vanity slug and (b) a legacy campaign with no slug.

**Steps:**

1. In the native viewer tap 'Support this campaign'. The 'Support this campaign' screen appears; tap 'Continue in browser'.
2. Confirm Safari opens https://app.ujimora.com/c/<slug>/donate?liveSessionId=<sid>.
3. Complete a Paystack test donation in Safari and return to the app.
4. Repeat for the legacy campaign with no slug.

**Expect:** No amount, payment or wallet form is shown inside the iOS app. Safari receives the 24-hex liveSessionId and the donation is attributed to the session. The app shows 'Returning to the app does not confirm payment…'. For the campaign with no slug, source shows 'This campaign is not accepting donations right now.' instead of the button; log as a defect unless intended.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## LIVE-042 · P0 · Android native viewer donation with live attribution

*Surfaces:* android, api  ·  *Type:* functional

**Before:** Android signed build; active session; Paystack test keys.

**Steps:**

1. Native viewer, 'Support this campaign': the in-app donate screen opens with the liveSessionId parameter.
2. Enter GHS 25, pay by card via Paystack hosted checkout in the browser tab, and return to the app callback.
3. Check session stats and the overlay.

**Expect:** The intent carries liveSessionId. Session +1 donation and +25. The overlay alert appears. No duplicate if the callback screen is reopened.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

## LIVE-044 · P0 · Webhook replay and callback/webhook race do not double-count

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** A completed live-attributed Paystack donation. Access to the Paystack dashboard 'Resend webhook' or the captured signed payload.

**Steps:**

1. Resend the charge.success webhook 3 times.
2. Reload /donate/callback?reference=… several times.
3. Compare DB counts and the overlay.

**Expect:** Every call returns 200 or no-op. There is exactly one donation record and one outbox row. Session successfulDonations and amountRaised, and campaign raised, are unchanged. No repeat overlay alert.

**Needs:** Paystack test webhooks

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/OutboxDispatcher.ts`

## LIVE-047 · P0 · Concurrent donation burst and session reconciliation

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Active session with a baseline. Five testers ready (card, MoMo, wallet mix).

**Steps:**

1. All five complete donations within 30 seconds.
2. Watch the overlay total and alerts for out-of-order totals.
3. DB: aggregate donationintents {liveSessionId:<sid>, status:'SUCCEEDED'} and sum amount and count. Compare with livesessions.stats.amountRaised and successfulDonations, and the campaign raisedAmount delta.

**Expect:** Aggregates exactly equal session stats and the campaign delta. Totals may briefly arrive out of order over SSE, but the overlay settles on the correct DB total within 10s through its REST refresh. Five alerts show (at most 4 stacked).

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-055 · P0 · SSE and overlay endpoint security

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Active session <sid> with token <t>; a pending_review campaign; a scratch page on another origin.

**Steps:**

1. GET /live-sessions/<sid>/events with no token, a wrong token and ?token=<t>&token=x.
2. GET /live-sessions/<sid>/overlay with no token and a wrong token.
3. End the session, then GET /live-sessions/<sid>/events?token=<t>.
4. GET /campaigns/<pendingCampaign>/events.
5. Check response headers on overlay, public and events.
6. On https://example.test, embed an iframe of /overlay/view?token=<t>.

**Expect:** Missing or wrong token: 403 'Invalid overlay token'. A duplicate query takes the first value. An ended session's events return 409 'This live session has ended'. A non-public campaign feed returns 404. Headers are Cache-Control private, no-store (events: private, no-store, no-transform). The overlay CSP frame-ancestors lists only self and the CORS origins, so the foreign iframe is blocked.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/LiveSessionController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`

## LIVE-057 · P0 · Overlay and feeds resist HTML and script injection

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Active session with the OBS overlay and a browser overlay tab (DevTools open).

**Steps:**

1. Donate with name '<img src=x onerror=alert(1)>' and message '<script>alert(1)</script>'. Have a moderator approve the message if review is required.
2. Start a new session titled '<b>bold</b><script>x()</script>' after approval.
3. Donate with a 500-character message, emoji and Arabic RTL text.

**Expect:** All values render as literal text. No script runs and no DOM elements are injected (textContent). Long text wraps within the alert. Messages pending review never appear until approved.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/api/__tests__/contracts/overlay-preview.node-test.cts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`

## LIVE-058 · P0 · Overlay token rotation revokes old links (web and native)

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** OBS Browser Source A using the current token; a curl -N SSE session with the same token.

**Steps:**

1. Web: click 'Rotate token'.
2. Watch OBS source A for 20s and the curl stream.
3. Put the new URL into OBS source B.
4. Mobile: tap 'Replace overlay link'. Choose Cancel once, then 'Replace link'.
5. Click 'Rotate token' twice quickly.

**Expect:** Web shows 'A new overlay URL has been generated. Re-copy it into OBS.' Within 10s source A shows 'This overlay link is invalid or was revoked.' and stops. The old SSE stream closes at the next event or heartbeat (up to 20s). Source B works. Cancel changes nothing. The mobile confirm replaces the token and resets 'Overlay link copied'. Rapid rotation ends on one valid token and the studio preview uses it.

**Needs:** OBS Studio

**Source:** `apps/api/src/application/use-cases/RotateOverlayTokenUseCase.ts`, `apps/web/src/components/live/OverlayLinkCard.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`

## LIVE-062 · P0 · Privacy toggle matrix on overlay, watch page and public sheet

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Active session. OBS overlay, guest watch page and GET /live-sessions/<sid>/public open. A donor ready with a name and message.

**Steps:**

1. Turn 'Show donor names' off, then donate (name 'Ama', message 'Hi').
2. Turn names on and 'Show donor messages' off, then donate.
3. Turn 'Show donation amounts' off, then donate.
4. Turn 'Privacy mode' on (the names and messages switches disable on web) with names and messages switched on, then donate.
5. After each step, GET /live-sessions/<sid>/overlay?token=<t> and check config and recentDonors.
6. Repeat the toggles from the mobile studio switches.

**Expect:** Names off shows 'Anonymous' in alerts and recent donors. Messages off shows no message. Amounts off shows alerts without an amount, overlay 'Session raised' 'hidden', /public amountRaised null, and no total on the watch page. Privacy mode hides names and messages regardless of their switches. The overlay clears its alert stack when config changes. The campaign raised/goal bar stays visible (confirm this is intended).

**Needs:** Paystack test keys

**Source:** `apps/api/src/domain/entities/LiveSession.ts`, `apps/api/src/application/use-cases/UpdateLiveSessionPrivacyUseCase.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/api/src/application/use-cases/mappers/liveSessionDto.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`

## LIVE-064 · P0 · Donor anonymity, guest labels and moderated messages across live surfaces

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Active session with names and messages on. Admin account. Donors: registered anonymous, registered named, guest named, guest unnamed.

**Steps:**

1. Each donor donates with a message.
2. Admin hides one approved donor message via Safety reports 'Hide message' after it has shown on the overlay.
3. Admin restricts one registered donor.
4. Reload the overlay, reconnect SSE with an old Last-Event-ID, and check /campaigns/<id>/donations on the host studio.

**Expect:** Anonymous donors show 'Anonymous' everywhere. Guest names show only if approved, otherwise 'Guest donor' or 'Anonymous'. Unapproved or hidden messages never appear in overlay snapshots or replay. The restricted donor is redacted. Totals and amounts are unchanged.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `docs/compliance/REALTIME_IDENTITY.md`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`

## LIVE-066 · P0 · End session happy path and cleanup (web and native)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Active broadcast with host video, 2 web viewers and 1 native viewer, the OBS overlay, and the LiveKit dashboard open.

**Steps:**

1. Web: click 'End session'. There is no confirmation dialog; note this. Or mobile: 'End broadcast', then 'End broadcast' in the confirm dialog.
2. Watch the viewers, overlay, campaign detail and the LiveKit room list.
3. POST viewer-token and host-token for the ended session.
4. Click 'Go LIVE' again.

**Expect:** 'Ending…', then the studio returns to 'Session setup'. LiveKit room ujimora-<sid> is deleted and viewers are disconnected. Watch pages show 'This broadcast has ended…' within 10s. The overlay shows 'This broadcast has ended' within 10s. The session SSE closes within 20s. 'Watch live broadcast' disappears within 15s. Tokens return 409 'This broadcast has ended or is unavailable'. A new start creates a new session id and token, and the old overlay URL stays ended.

**Needs:** LiveKit

**Source:** `apps/api/src/application/use-cases/EndLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-069 · P0 · Viewer reports a live broadcast (web and native)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Active session; signed-in viewer (not host); guest browser.

**Steps:**

1. Web watch page: click 'Report' under the title, choose 'violence', enter at least 10 characters, then 'Send report'.
2. Submit the same report again.
3. Native viewer: Report with 'child_safety'.
4. Guest: look for a Report control.
5. As host via API: POST /safety/reports {targetType:'live', targetId:<sid>, …}.
6. Submit 21 reports within 15 minutes from one account.

**Expect:** 'Report received for moderation review.' The repeat does not create a second pending report. child_safety is prioritised 'urgent'. Guests see no Report. Host self-report returns 400 'You cannot report your own account or comment'. The 21st report returns 429. Admin Safety reports shows a 'live' card with the snapshot 'Live session: <title> Status: active Started: …'.

**Needs:** None

**Source:** `apps/web/src/components/safety/ReportContent.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/mobile/src/components/UserSafetyControls.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## LIVE-070 · P0 · Admin ends a reported broadcast at the provider

*Surfaces:* admin, api, ios, web  ·  *Type:* compliance

**Before:** Admin (role admin). Pending live report. Host broadcasting, viewers connected, OBS overlay on, LiveKit dashboard open.

**Steps:**

1. Admin console /safety-reports: on the live report enter notes of at least 20 characters and click 'End broadcast at provider'.
2. Watch the host studio, viewers, overlay and LiveKit.
3. GET /live-sessions/<sid>/public, /campaigns/<cid>/active-live and POST viewer-token.
4. Inspect the livesessions document and audit logs.

**Expect:** 'Review saved.' and the report is resolved. The session is ended with moderationStoppedAt, overlayToken '', privacyMode true and providerStopPending false. The host participant is removed with revocation, the room is deleted and viewers are disconnected. Public reads return 404 'Broadcast unavailable'. The overlay shows 'invalid or was revoked'. The host studio returns to setup within 10s. Audit log has safety.stop_live.

**Needs:** LiveKit

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## LIVE-074 · P0 · Viewer blocks the host during a live broadcast (web and native)

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Signed-in viewer watching with video connected; LiveKit dashboard open.

**Steps:**

1. Web watch page: click 'Block user'.
2. Check the response of PUT /safety/blocks/<hostId> (providerCleanupPending) and the LiveKit participants.
3. Reload /live/<sid> and open /campaigns/<id>.
4. Settings, Blocked users: unblock the host and reopen the watch page.
5. Repeat on iOS and Android.

**Expect:** The page shows 'User blocked. Manage blocked users in Settings.' and the video panel is removed. The server evicts viewer-<viewerId> (providerCleanupPending false). Reloads show 'Broadcast unavailable' and no 'Watch live broadcast'. Viewer and active-live tokens return 404. After unblocking, watching works again.

**Needs:** LiveKit

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/web/src/components/safety/BlockedUsers.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`

## LIVE-001 · P1 · Video provider not configured: going live is disabled cleanly on web and native

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Staging API with LIVEKIT_URL, LIVEKIT_API_KEY or LIVEKIT_API_SECRET unset (or LIVEKIT_URL not starting with wss://). Host on Pro plan with an active campaign.

**Steps:**

1. GET {API}/api/v1/live-sessions/video/config without auth.
2. Web: sign in as host, open /campaigns/<id>, click 'Go LIVE' to reach /campaigns/<id>/live.
3. iOS and Android: open the campaign, tap 'Go live' to reach 'Broadcast studio'.
4. With the host bearer token, POST /api/v1/live-sessions/<any active session id>/video/host-token.

**Expect:** Config returns {data:{enabled:false}}. Web shows the info alert 'In-app broadcasting is awaiting video-service setup…' and the 'Go LIVE' button is disabled. Native shows 'Live broadcasting is not configured yet.' and 'Create live session' is disabled. Token call returns 503 'Live video is not configured yet'. No crash or blank screen.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/LiveSessionController.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`

## LIVE-004 · P1 · Go-live entry point is visible only to the campaign creator

*Surfaces:* android, ios, web  ·  *Type:* security/permission

**Before:** Campaign owned by Host. Accounts: Host, a collaborator invited to the campaign, another signed-in user, and a guest.

**Steps:**

1. Web: open /campaigns/<id> as each account and look for the 'Go LIVE' button beside Share.
2. Mobile: open the campaign detail as each account and look for 'Go live' and 'Manage campaign'.

**Expect:** Only the creator sees 'Go LIVE' (web) and 'Go live' plus 'Manage campaign' (mobile). The collaborator, other user and guest see neither.

**Needs:** None

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/mobile/app/campaign/[id].tsx`

## LIVE-005 · P1 · Direct navigation to the control room by the wrong user or when logged out

*Surfaces:* android, ios, web  ·  *Type:* security/permission

**Before:** Active campaign <id> owned by Host. A non-owner account.

**Steps:**

1. Logged out, open https://app.ujimora.com/campaigns/<id>/live.
2. Sign in as non-owner and open the same URL.
3. Open /campaigns/000000000000000000000000/live as the Host.
4. Mobile, logged out: open ujimora://campaigns/<id>/live.
5. Mobile as non-owner: open the same deep link.

**Expect:** Logged out web goes to sign-in and returns after login. Non-owner web sees 'The LIVE control room is only available to the campaign owner.' with 'View campaign'. Unknown id shows 'We couldn't find that campaign.' with 'My campaigns'. Mobile logged out shows the SignInRequired screen for 'broadcast studio'. Mobile non-owner sees the API error ('Only the campaign owner can view live controls') with 'Reload studio' and no start form.

**Needs:** None

**Source:** `apps/web/src/router.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/api/src/application/use-cases/GetActiveLiveSessionUseCase.ts`

## LIVE-008 · P1 · Native in-app purchase upgrade unlocks going live; web checkout not linked in app

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Community-plan host with an active campaign. App Store sandbox tester and Play license tester. Store billing configured on the API.

**Steps:**

1. iOS: Broadcast studio, 'Create live session': expect the plan error.
2. Settings, Subscription: buy Pro through the App Store sandbox and wait for server confirmation.
3. Return to Broadcast studio and 'Create live session'.
4. Repeat on Android with Google Play test billing.
5. Let the sandbox subscription lapse, end the session, and try to create a new one.

**Expect:** Before purchase: 403 plan message and no session. After purchase: a session is created. No web or Paystack subscription link appears anywhere in the native flow. After lapse, new sessions are refused with 403.

**Needs:** App Store sandbox, Google Play test billing, LiveKit

**Source:** `apps/mobile/app/campaign/live.tsx`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## LIVE-009 · P1 · Campaign state gating for starting a session

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Pro host owning campaigns in each state: pending_review, blocked, rejected or draft, status active with endDate in the past, and funded (goal met, end date in future).

**Steps:**

1. For each campaign, open /campaigns/<id>/live and click 'Go LIVE' with consent, or POST /campaigns/<id>/live-sessions.
2. For the funded campaign, confirm the session starts and that a viewer donation can still be made.

**Expect:** Non-active or date-expired campaigns return 409 'Only an active campaign can go live' (or 'The campaign is no longer available to go live.'), shown in the red alert, with no session created. Funded campaigns can go live and accept donations.

**Needs:** LiveKit, OpenAI

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionCreation.ts`, `apps/api/src/domain/entities/Campaign.ts`

## LIVE-010 · P1 · Account-state gating: outdated agreement, restriction, stale credentials

*Surfaces:* api, ios, web  ·  *Type:* security/permission

**Before:** Pro host with an active campaign. Admin access. Two devices signed in as the host.

**Steps:**

1. Publish a new account-agreement version (or set the host's legalAcceptance to an old version in staging), then click 'Go LIVE'.
2. Admin restricts the host (Safety reports, 'Restrict publishing' on any report about them), then the host clicks 'Go LIVE'.
3. Restore the host. Change the password on device 1, then on device 2 (old token) try 'Create live session'.

**Expect:** Outdated agreement: 428 'Accept the current account agreement before broadcasting/publishing'. Restricted: 403 'Publishing is restricted…'. Stale credentials: 401 'Account authorization changed. Sign in again.' (or a forced re-login). No session is created in any case.

**Needs:** Admin console

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionCreation.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## LIVE-012 · P1 · Start without consent is held for staff review, then goes live after approval

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Pro host, active campaign, admin account with the Publication reviews page.

**Steps:**

1. In the studio leave the publication consent unticked, enter title 'QA held title' and goal 500, click 'Go LIVE'.
2. Check the PublicationReviews list on the studio page.
3. Admin: /publication-reviews, find the pending live.start item, enter notes of at least 20 characters, click 'Approve this version'.
4. Host clicks 'Go LIVE' again with the identical title and goal.
5. End the session, change the goal to 600 and click 'Go LIVE'.

**Expect:** First attempt shows the alert 'Saved privately for safety review. Your content has not been published…' and creates no session or overlay token. The held item is listed for the host. After approval the identical submission starts within 7 days. A changed goal creates a new pending review.

**Needs:** Admin console

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/web/src/components/account/PublicationReviews.tsx`, `apps/admin/src/pages/PublicationReviewsPage.tsx`, `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`

## LIVE-016 · P1 · Session recovery across reloads, app restarts and devices

*Surfaces:* android, ios, web  ·  *Type:* recovery/idempotency

**Before:** Active session started on web.

**Steps:**

1. Reload /campaigns/<id>/live.
2. Open Broadcast studio on iOS for the same campaign.
3. Force-quit and relaunch the iOS app and reopen the studio.
4. End the session from iOS ('End broadcast', confirm).
5. Watch the web tab without reloading.

**Expect:** Web shows 'Checking session…' and then restores the same session. iOS shows the same title, stats and overlay link. After the iOS end, the web studio returns to 'Session setup' within about 10s. No stale session comes back from browser storage.

**Needs:** LiveKit

**Source:** `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/application/use-cases/GetActiveLiveSessionUseCase.ts`

## LIVE-019 · P1 · Web host device and permission failures

*Surfaces:* web  ·  *Type:* negative/edge

**Before:** Active session; desktop browser.

**Steps:**

1. Block camera and mic in the browser site settings, then click 'Start camera & microphone'.
2. Allow the permissions in site settings and re-enable the devices with the control bar.
3. Repeat with no camera attached, and with the camera held by another app (Zoom).
4. Open the studio over plain HTTP on a LAN IP (non-localhost dev) and try to start.

**Expect:** Error 'Camera or microphone access failed. Allow access in your browser, then enable the device below.' shows without crashing. The host can recover without reloading. Viewers keep 'Waiting for the host’s video…'. The session stays active.

**Needs:** LiveKit

**Source:** `apps/web/src/components/live/LiveVideoPanel.tsx`, `docs/live-broadcasting.md`

## LIVE-020 · P1 · Web screen sharing across browsers

*Surfaces:* web  ·  *Type:* cross-platform

**Before:** Active session, host connected. Chrome, Edge, Firefox and Safari (macOS). A mobile browser host (iOS Safari, Android Chrome).

**Steps:**

1. In each desktop browser, use the control bar Share screen and pick a tab, window or whole screen.
2. Viewer confirms a ScreenShare tile beside the camera tile.
3. Stop sharing from the browser's own 'Stop sharing' bar.
4. Try Share screen from a mobile browser host.

**Expect:** Desktop browsers publish the screen track and viewers see it. Stopping removes it cleanly. On mobile browsers without getDisplayMedia the control fails gracefully with no crash and the camera keeps working.

**Needs:** LiveKit

**Source:** `apps/web/src/components/live/LiveVideoPanel.tsx`

## LIVE-021 · P1 · Host 'Disconnect camera' keeps the session; rejoin after closing the tab

*Surfaces:* web  ·  *Type:* recovery/idempotency

**Before:** Active session with a viewer watching.

**Steps:**

1. Host clicks 'Disconnect camera'.
2. Check the viewer and the studio LIVE badge.
3. Host clicks 'Start camera & microphone' again.
4. Host closes the tab for 2 minutes, reopens /campaigns/<id>/live and starts the camera.

**Expect:** After disconnect the session stays active (LIVE badge, overlay live) and the viewer sees 'Waiting for the host’s video…'. Rejoining mints a new host token and the viewer resumes without reloading. The session is recovered after the tab is reopened.

**Needs:** LiveKit

**Source:** `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`

## LIVE-022 · P1 · Same host connected from web and native at once (duplicate identity)

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** Active session; host connected on web.

**Steps:**

1. On iOS Broadcast studio tap 'Start camera and microphone'.
2. Watch the web host panel and the viewer grid.
3. Switch back: reconnect on web.

**Expect:** LiveKit keeps one host-<userId> participant. The earlier device is disconnected and returns to its join button without an error loop. Viewers never see duplicate host tiles. Switching back works.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/mobile/src/components/LiveVideo.tsx`

## LIVE-024 · P1 · iOS screen sharing through the ReplayKit broadcast extension

*Surfaces:* ios  ·  *Type:* cross-platform

**Before:** Signed build whose provisioning includes the extension com.ujimora.app.broadcast and App Group group.com.ujimora.app.broadcast. Host connected in the studio.

**Steps:**

1. Tap 'Share screen'. In the system broadcast picker choose 'Ujimora screen broadcast', then Start Broadcast.
2. After the countdown, switch to Photos and Safari while a web viewer watches.
3. Stop from the red status indicator or Control Center, then start again and stop with 'Stop sharing'.
4. Open the picker and dismiss it without starting.
5. Repeat the start and stop cycle 3 times.

**Expect:** Viewers see the screen track. The studio shows 'Your screen and enabled microphone are shared. Other apps’ audio is not included.' Stopping from the system or the app ends sharing and the button returns to 'Share screen'. Dismissing the picker leaves no stuck busy state or error loop. No crash across repeats.

**Needs:** LiveKit, Apple provisioning with App Group

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/plugins/withBroadcastExtension.js`, `apps/mobile/ios/UjimoraBroadcast/SampleHandler.swift`, `docs/reviews/mobile-parity-implementation-2026-09-09.md`

## LIVE-025 · P1 · iOS host backgrounding, interruption and lock

*Surfaces:* ios  ·  *Type:* cross-platform

**Before:** iOS host connected with camera and mic on (not sharing). Web viewer watching.

**Steps:**

1. Press Home for 30s, then return.
2. Start the screen share, then press Home and use another app for 60s.
3. During the broadcast, place an incoming phone call to the device, decline it, then accept a second one.
4. Lock the screen for 30s.

**Expect:** Backgrounding without sharing turns camera and mic off (viewer sees 'Waiting…'). On return the controls show 'Camera on' and 'Unmute' and the host must re-enable them. While sharing, screen and mic continue in the background (audio background mode). Call interruptions pause audio, which recovers after the host unmutes. No crash, and the session stays active.

**Needs:** LiveKit

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/plugins/withBroadcastExtension.js`, `apps/mobile/APP_REVIEW_NOTES.md`

## LIVE-026 · P1 · Android host camera and microphone runtime permissions

*Surfaces:* android  ·  *Type:* cross-platform

**Before:** Android 13, 14 and 15 devices; signed release build; fresh install.

**Steps:**

1. 'Start camera and microphone', then 'Camera on': choose Don't allow.
2. Retry and choose 'Only this time'.
3. Deny twice (don't ask again), then enable in system Settings > Apps > Ujimora > Permissions and return.
4. Check that the app never asks for notification permission.

**Expect:** Denial shows the media error and the app stays usable. 'Only this time' works for the session. Permissions granted in Settings take effect on return. POST_NOTIFICATIONS is never requested (it is blocked in app.json).

**Needs:** LiveKit

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/app.json`

## LIVE-028 · P1 · Android host background, call interruption and app kill

*Surfaces:* android  ·  *Type:* recovery/idempotency

**Before:** Android host connected with camera on; web viewer.

**Steps:**

1. Press Home for 30s and return (not sharing).
2. While screen sharing, press Home for 60s.
3. Receive a phone call mid-broadcast.
4. Swipe the app away from Recents during the broadcast, relaunch and open Broadcast studio.

**Expect:** Camera and mic are disabled while in the background when not sharing, and continue while sharing. The call pauses audio, which recovers. After the app is killed the host leaves the room but the session stays active server-side; after relaunch the studio recovers the session and 'Start camera and microphone' rejoins.

**Needs:** LiveKit

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/app/campaign/live.tsx`

## LIVE-029 · P1 · Network change and reconnection for host and viewers

*Surfaces:* android, ios, web  ·  *Type:* recovery/idempotency

**Before:** Active broadcast with a host and viewers on web, iOS and Android. Network conditioner available.

**Steps:**

1. Switch the host from Wi-Fi to mobile data mid-broadcast.
2. Airplane mode for 10s on a viewer, then off.
3. Cut the host network for 90s, then restore.
4. Throttle to 3G with 5% loss for 5 minutes.

**Expect:** Short drops show a reconnecting state and then connected without user action. After a long drop the UI returns to its join button ('Start camera…' or 'Watch broadcast') and rejoining works with a freshly minted token. The server session stays active and viewers never see duplicate host tiles. Degraded networks lower quality without a disconnect loop.

**Needs:** LiveKit

**Source:** `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/mobile/src/components/LiveVideo.tsx`, `docs/live-broadcasting.md`

## LIVE-033 · P1 · Viewer discovery entry points appear and disappear with the session

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Campaign with slug <slug>; the host starts, then ends, a session.

**Steps:**

1. After start, open /campaigns/<id> as a guest and wait up to 15s.
2. Open /c/<slug> (public campaign page).
3. Open /c/<slug>/live/<sid>.
4. Mobile campaign detail: wait up to 15s.
5. End the session and watch all pages for 15s.

**Expect:** 'Watch live broadcast' appears on /campaigns/<id> and on mobile detail within 15s and disappears within 15s of the end. /c/<slug>/live/<sid> renders the same watch page. Note: /c/<slug> has no live link in source, so the product owner should confirm whether that is acceptable, because shared campaign links use /c/<slug>.

**Needs:** LiveKit

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/router.tsx`, `apps/mobile/app/campaign/[id].tsx`, `apps/api/src/application/use-cases/GetActiveLiveSessionUseCase.ts`

## LIVE-034 · P1 · Native viewer and link handling

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** Active broadcast; iOS and Android app installed.

**Steps:**

1. In the app, campaign detail, 'Watch live broadcast', then 'Watch broadcast'.
2. Rotate the device, background for 30s and return.
3. Tap 'Share broadcast' and inspect the shared text.
4. From Notes, open ujimora://live/<sid> and ujimora://c/<slug>/live/<sid>.
5. Open https://app.ujimora.com/live/<sid> from Messages.

**Expect:** Video and audio play; rotation and background do not crash; returning resumes or offers rejoin. The shared text is https://app.ujimora.com/live/<sid>. Custom-scheme links open the native viewer. The https link opens the website, since no universal links are configured. Confirm this is acceptable.

**Needs:** LiveKit

**Source:** `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app.json`

## LIVE-043 · P1 · Wallet donation during a live session, including insufficient balance

*Surfaces:* android, api, web  ·  *Type:* functional

**Before:** Signed-in viewer with a GHS wallet balance of 60. Active session.

**Steps:**

1. From the live link, donate GHS 50 plus a GHS 2 tip with Wallet.
2. Try another GHS 50 wallet donation.
3. Repeat the first step on Android in-app.

**Expect:** First: wallet debited 52 (gross), session +50, campaign +50, wallet transaction reference donation-intent:<id>. Second: 'Insufficient wallet balance', intent FAILED, no stats change, no alert.

**Needs:** None

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`

## LIVE-045 · P1 · Failed, abandoned or declined checkouts leave live totals untouched

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Active session with baseline stats.

**Steps:**

1. Open the donate page from the live link, start Paystack checkout and close it.
2. Use a Paystack declined test card.
3. Let a MoMo test charge time out.

**Expect:** No alert, no stats or campaign change. overlay totals.checkoutStarts stays 0; nothing increments it in source, so the product owner should confirm whether this is a known gap.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`

## LIVE-046 · P1 · Tampered or stale liveSessionId on the donate URL

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Session A on campaign X (active), session B on campaign Y, and an ended session C on campaign X.

**Steps:**

1. Open /c/<X slug>/donate?liveSessionId=<B> and complete the form.
2. Open ?liveSessionId=abc.
3. Open ?liveSessionId=<C> and donate.

**Expect:** B: 400 'Live session does not belong to this campaign' and no charge. 'abc': currently 400 'Invalid ID format', which blocks the donation; log as a UX defect and decide whether to ignore bad ids. C: the donation succeeds and increments ended session C's stats; product owner to confirm this policy.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`

## LIVE-048 · P1 · Outbox re-dispatch after a crash must not double-count session stats

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Staging with DB access; ability to restart the API.

**Steps:**

1. Complete a live donation and note session stats.
2. Set that donation's outbox row back to status pending (simulating a crash before markDispatched) and restart the API so the boot sweep re-dispatches.
3. Compare session stats.

**Expect:** Session stats should increment only once. Source increments stats on every dispatch (the OutboxDispatcher documents at-least-once), so a double count is likely. Record the result and fix before launch if it doubles.

**Needs:** None

**Source:** `apps/api/src/application/services/OutboxDispatcher.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`

## LIVE-049 · P1 · Refund of a live-attributed donation

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** A settled live-attributed donation of GHS 40 and the refund flow available.

**Steps:**

1. Refund the donation through the normal refund process.
2. Check campaign raisedAmount, session stats, the overlay total, overlay recent donors and the watch page.

**Expect:** Campaign raised decreases by 40 and the overlay campaign total reflects it within 10s. Source does not reverse session stats or remove the refunded donation from overlay recentDonors. The product owner decides whether session totals must exclude refunds.

**Needs:** Paystack refunds (test)

**Source:** `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`

## LIVE-050 · P1 · Multi-currency or international card donation during a live session

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Multi-currency and international cards enabled in payments config; Paystack test supports USD; GHS campaign live.

**Steps:**

1. From the live link donate USD 10 by card.
2. Compare the settlement amount and currency, the session amountRaised increment, campaign raised, overlay alert amount and currency label.

**Expect:** Session and campaign increments equal the settlement amount in the campaign currency (not '10'). An FX rate is recorded. The overlay labels are GH₵; check they match the stored currency.

**Needs:** Paystack USD test, payments flags

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-052 · P1 · Host studio live totals, latest donor and donor feed

*Surfaces:* web  ·  *Type:* functional

**Before:** Active session; note whether the web build sets VITE_SSE_ENABLED.

**Steps:**

1. Check the 'Live totals' indicator reads 'Streaming live' (green).
2. Make a donation and watch 'Raised', the progress bar, 'Latest:' and 'Donor feed' without reloading.
3. Disable the host network for 20s, then restore.

**Expect:** 'Raised' and the bar update within seconds. 'Latest:' shows the donor's name and amount from the authenticated REST read (Anonymous for anonymous donors). The donor feed updates within 300ms of the event when SSE is enabled, otherwise within 30s. During the outage the indicator reads 'Reconnecting…', then 'Streaming live'. Note: 'Raised' is the campaign total, not the session total.

**Needs:** Paystack test keys

**Source:** `apps/web/src/hooks/useLiveTotals.ts`, `apps/web/src/components/LiveDonationFeed.tsx`, `apps/web/src/hooks/usePublicFeed.ts`, `apps/web/src/hooks/useSSE.ts`, `apps/web/src/pages/CampaignLivePage.tsx`

## LIVE-053 · P1 · SSE resume with Last-Event-ID and the overlay after a network gap

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Active session with overlay token; terminal with curl.

**Steps:**

1. curl -N '{API}/api/v1/live-sessions/<sid>/events?token=<t>' and note the last 'id:'.
2. Stop curl, make a donation, then reconnect with -H 'Last-Event-ID: <last id>'.
3. OBS overlay: disconnect the PC network for 30s, make a donation, reconnect.
4. Inspect replayed donation payloads.

**Expect:** Missed donation, total and milestone events replay in order. The OBS overlay shows 'Reconnecting…', then 'Live', with the missed alert. The payload has only donationId, name, amount, createdAt and an optional message, with no email, userId or donorId. Only the last 50 events per channel are replayable.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/realtime/EventBus.ts`, `docs/compliance/REALTIME_IDENTITY.md`

## LIVE-054 · P1 · API restart or redeploy mid-broadcast

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Active broadcast with an OBS overlay, the host studio and 3 viewers.

**Steps:**

1. Trigger a Render redeploy or restart of ujimora-api.
2. Make a donation during the restart window, and another after.
3. Watch video, overlay, studio and watch pages.

**Expect:** LiveKit video continues (separate provider). SSE clients reconnect (retry 3s). Within 10s the overlay REST refresh restores correct totals and 'Raised'. Donations that settled during the restart appear in totals but may miss their alert, because the in-memory buffer is lost. The session remains active, and the studio and viewers recover without manual reload.

**Needs:** Render

**Source:** `apps/api/src/infrastructure/realtime/EventBus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `docs/live-broadcasting.md`, `render.yaml`

## LIVE-056 · P1 · OBS overlay set-up end to end (web and native copy)

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** OBS Studio 30 or later on desktop; active session.

**Steps:**

1. Web studio, OBS overlay card: click the copy icon (tooltip 'Copied').
2. OBS: Sources, +, Browser. Paste the URL, set width 1920 and height 1080, confirm.
3. Confirm a transparent background with a panel showing title, raised/goal, %, session raised and donation count.
4. Make 6 donations quickly.
5. In the mobile studio tap 'Copy private overlay link', paste into a second Browser Source and compare.

**Expect:** The URL is https://api.ujimora.com/api/v1/live-sessions/<sid>/overlay/view?token=<48hex>. The overlay loads with status 'Live'. Alerts slide in top-left, at most 4 visible, each leaving after about 6.5s. The mobile link is identical and works. If the clipboard fails on web: 'Clipboard is unavailable — select the link and copy it manually.'

**Needs:** OBS Studio, Paystack test keys

**Source:** `apps/web/src/components/live/OverlayLinkCard.tsx`, `apps/web/src/lib/fundraising.ts`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-061 · P1 · Pre-live 'Your broadcast canvas' preview renders

*Surfaces:* web  ·  *Type:* functional

**Before:** Pro host on /campaigns/<id>/live with no active session; production-like cross-origin web and API.

**Steps:**

1. Look at 'Your broadcast canvas' ('Preview before you go live').
2. Type a Session title and watch the preview.
3. DevTools Network: inspect the iframe request to /live-sessions/preview/overlay/view?token=&preview=1&title=…&raised=…&goal=… (status, body, X-Frame-Options).
4. Go live and re-check the canvas ('Live overlay').

**Expect:** The preview panel should show the typed title and campaign raised/goal. Source suggests the route guard casts the id 'preview' to an ObjectId (400 'Invalid ID format'), and helmet's X-Frame-Options may block cross-origin framing, so a blank or errored frame is likely; log a defect if so. After go-live the iframe shows the live overlay using the session token.

**Needs:** None

**Source:** `apps/web/src/components/live/LiveBroadcastPreview.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/LiveSessionController.ts`

## LIVE-063 · P1 · Privacy toggle failure, concurrency and replay

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Active session; web and mobile studios open.

**Steps:**

1. Web: go offline in DevTools and flip 'Show donation amounts'.
2. Flip the same switch on web and mobile within one second.
3. Tap mobile switches rapidly.
4. With amounts hidden, reconnect an overlay SSE using a Last-Event-ID from before a donation that was made while amounts were visible.

**Expect:** Offline: the switch reverts and shows 'Could not update privacy settings.' Concurrent edits settle on the last successful PATCH, and both UIs match the server within 10s. Mobile switches disable while busy. Replayed events follow the current settings (amount null).

**Needs:** None

**Source:** `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`

## LIVE-065 · P1 · Public campaign SSE feed versus session privacy settings

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Active session with Privacy mode on and 'Show donation amounts' off.

**Steps:**

1. curl -N {API}/api/v1/campaigns/<cid>/events (public, no token).
2. Make a named donation with a message.

**Expect:** Record what the public campaign feed carries. Source rebuilds donor identity at campaign level (the name unless the donor is anonymous, the amount and the message) and passes sessionAmountRaised in 'total' without applying session privacy. The product owner and legal must confirm this is acceptable, since the studio says 'Changes apply live to the overlay and donor feed'.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/web/src/pages/CampaignLivePage.tsx`

## LIVE-067 · P1 · End fails at the provider; retry and idempotent end

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Staging where LiveKit credentials can be broken temporarily (a wrong LIVEKIT_API_SECRET, or blocked egress) after a session is running.

**Steps:**

1. Break the provider credentials and click 'End session'.
2. Restore the credentials and click 'End session' again.
3. Double-click 'End session', or send PATCH {status:'ended'} twice.
4. End on web while the mobile studio is open.

**Expect:** First attempt: alert 'Could not stop the video broadcast. Please retry ending the session.' and the session stays active. The retry succeeds. A repeated end returns 200 with the ended session and no error. Mobile returns to the create form within 10s.

**Needs:** LiveKit

**Source:** `apps/api/src/application/use-cases/EndLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## LIVE-068 · P1 · Abandoned sessions, campaign expiry mid-live and token reuse after end

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging with DB access; LiveKit CLI.

**Steps:**

1. Start a session, close all host devices and wait 1 hour.
2. During a live session set the campaign endDate to the past.
3. Check /campaigns/<id>/active-live, /live-sessions/<sid>/public, viewer-token and host-token, then click 'End session'.
4. Capture a host token, end the session within 60s, and reconnect with the captured token.

**Expect:** The session stays active indefinitely: no timeout exists, so decide whether one is needed. After expiry: active-live null, tokens 409 'This campaign is not available to broadcast', /public still says active (inconsistent, so log it). The owner can still end. A token reused after end must not recreate a usable room; verify against LiveKit.

**Needs:** LiveKit CLI

**Source:** `apps/api/src/application/use-cases/GetActiveLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/application/use-cases/EndLiveSessionUseCase.ts`, `docs/live-broadcasting.md`

## LIVE-071 · P1 · Moderation stop provider failure, cleanup queue and retry

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with LiveKit credentials that can be broken; a pending live report on a running session.

**Steps:**

1. Break the credentials, then 'End broadcast at provider'.
2. Reload the queue: check the 'Live cleanup pending' stat, the warning alert and the report banner.
3. Try 'Dismiss' on the same report.
4. Restore the credentials, click 'Retry cleanup' (or wait 30s for reconciliation).
5. Retry 'End broadcast at provider'.

**Expect:** The first attempt errors, but public access is already cut (404, overlay revoked). Pending count 1 with '1 live safety operations still need provider cleanup.' The banner reads 'Review started: stop live…' with notes locked. Dismiss returns 409 'A different review has already started…'. After recovery the count returns to 0, the room is deleted, and the retried action resolves the report.

**Needs:** LiveKit

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/app.ts`

## LIVE-072 · P1 · Restricting a host stops all their broadcasts and blocks new ones

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Host with two campaigns, one live. A pending report about the host.

**Steps:**

1. Admin: 'Restrict publishing' with notes.
2. Host clicks 'Go LIVE' on the other campaign; POST host-token on the old session.
3. Admin: switch the status filter to resolved and click 'Restore publishing after appeal' with notes.
4. Host goes live again.

**Expect:** The active session is stopped (as in LIVE-070). The new start returns 403 'Publishing is restricted…' and the host token returns 404. After restore the host can start. Previously hidden content stays hidden.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## LIVE-073 · P1 · Live moderation endpoints: staff role and non-admin access

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Accounts: admin, a Moderator-role staff member (REPORTS permission in admin RBAC), a regular user.

**Steps:**

1. Moderator opens admin /safety-reports and tries 'End broadcast at provider'.
2. Regular user token: GET /admin/safety-reports, PUT /admin/safety-reports/<id>/review, POST /admin/safety-reports/live-cleanup/retry.

**Expect:** Regular user: 403 on all. Moderator: the API requires role 'admin', so expect 403 even though the UI route allows REPORTS. Record the result and align RBAC before launch if moderators must stop broadcasts.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/admin/src/router.tsx`, `packages/types/src/rbac.ts`

## LIVE-075 · P1 · Host blocks a signed-in viewer; cleanup retry when the provider fails

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Viewer V (signed in) watching; host can reach V's comment or profile; a guest also watching.

**Steps:**

1. Host blocks V from V's campaign comment or profile ('Block user').
2. Watch V's page for 10s and the LiveKit participants.
3. Break LiveKit credentials, have the host block another signed-in viewer, then restore and wait 30s.

**Expect:** V is removed from the room and V's next /public poll shows 'Broadcast unavailable'; V cannot rejoin. The guest is unaffected. With the provider down, the block still saves with 'User blocked. Live connection cleanup will retry.' and the admin pending-cleanup count goes up, then clears after reconciliation.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/app.ts`

## LIVE-076 · P1 · Campaign blocked by staff or host account deleted mid-broadcast

*Surfaces:* admin, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Two live sessions on different campaigns; admin access.

**Steps:**

1. Admin blocks campaign 1 through the campaign review flow while it is live.
2. Host 2 deletes their account (Settings, Delete account) while live.
3. Watch viewers, overlays, LiveKit rooms and the admin 'Live cleanup pending' count for 60s.

**Expect:** Both sessions end with moderationStoppedAt, a blank overlay token and privacyMode true. Viewers get 'Broadcast unavailable' and overlays show revoked. providerStopPending is reconciled within about 30s, rooms are deleted, and the pending count returns to 0. Donation records and totals are preserved.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`

## LIVE-013 · P2 · Declined, flagged, screening-unavailable and expired approvals for live titles

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Staging with OpenAI key and DB access.

**Steps:**

1. With consent, submit a title OpenAI moderation should flag (for example an explicit violent threat). Admin declines it with notes. Host retries the same title.
2. Temporarily unset OPENAI_API_KEY (or block egress), then submit a new title with consent.
3. For an approved fingerprint set approvalExpiresAt in the past (simulating 7 days), end any session and retry the same title and goal.

**Expect:** Flagged content is held, not auto-approved. After decline the retry returns 422 'This version was declined in safety review…'. Screening outage fails closed: held for staff, no session. Expired approval returns 409 'This safety approval expired…'; the host must change the title or goal to resubmit.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`

## LIVE-014 · P2 · Start-form input validation for title and session goal

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Pro host, active campaign.

**Steps:**

1. Web: paste a 201-character title and click 'Go LIVE'.
2. Web: type 'abc' and '1,000.50' into Session goal and observe the field.
3. Web: goal '0' then 'Go LIVE'.
4. API: POST targetAmount:-5, then targetAmount:'100' (string).
5. Mobile: Session goal 'abc', '0' and '1,000'.

**Expect:** 201 characters returns a 400 validation error shown in the alert. Web strips non-numeric characters ('1000.50'). Goal 0 is sent as no target. API rejects negative or string values with 400. Mobile keeps 'Create live session' disabled for invalid goals.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`

## LIVE-017 · P2 · Privacy settings chosen before start (web) and defaults (native)

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Pro host.

**Steps:**

1. Web setup: turn 'Show donor names' off, then turn 'Privacy mode' on and confirm the names and messages switches become disabled. Start.
2. Inspect the session document flags and the active privacy panel.
3. Native: start a session (no start-time switches) and inspect the flags.

**Expect:** Web session starts with showDonorNames false and privacyMode true, and the active panel matches. Native session starts with showDonorNames, showDonorMessages and showAmounts true and privacyMode false, and the switches appear after start.

**Needs:** LiveKit

**Source:** `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`

## LIVE-030 · P2 · Join token expiry (1-minute TTL)

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Active session; ability to capture a viewer-token response.

**Steps:**

1. Capture a POST /live-sessions/<sid>/video/viewer-token response.
2. After 90s, try to connect with that token (LiveKit CLI 'lk room join' or the livekit-client console).
3. With heavy throttling, click 'Watch broadcast' so the connection takes over 60s.

**Expect:** An expired token is refused by LiveKit. The UI shows an error and clicking 'Watch broadcast' again mints a new token that works.

**Needs:** LiveKit CLI

**Source:** `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## LIVE-035 · P2 · Watch page error and ended states

*Surfaces:* android, ios, web  ·  *Type:* negative/edge

**Before:** An ended session, a session on a campaign moved to pending_review or blocked, and invalid ids.

**Steps:**

1. Open /live/000000000000000000000000.
2. Open /live/not-an-id.
3. Open an ended session.
4. Open a session whose campaign is pending_review or blocked.
5. Repeat the ended and not-found cases in the native viewer.

**Expect:** Unknown id shows an error ('Live session not found' or 'This broadcast was not found.'). A malformed id shows a readable error ('Invalid ID format') without a crash. An ended session shows 'This broadcast has ended. You can still support the campaign.' with a Support link that has no liveSessionId. A non-public campaign shows 'Broadcast unavailable'.

**Needs:** None

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`

## LIVE-051 · P2 · Crypto donations during a live session

*Surfaces:* api, ios, web  ·  *Type:* functional

**Before:** CRYPTO_PAYMENTS_ENABLED on in staging (off in production unless approved); Bitnob sandbox.

**Steps:**

1. From the live link, choose crypto on the web donate page and complete a sandbox deposit.
2. Check session stats and the overlay.
3. Set CRYPTO_PAYMENTS_ENABLED off and confirm the crypto option disappears; confirm iOS never shows it.

**Expect:** Campaign totals update when the deposit settles. Session stats are not attributed (crypto does not carry liveSessionId); document as a known limitation. With the flag off, no crypto option appears anywhere.

**Needs:** Bitnob sandbox

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/cryptoRoutes.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## LIVE-059 · P2 · Goal milestone celebrations

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Campaign goal GHS 1,000 with 200 raised; active session; overlay open.

**Steps:**

1. Donate 60 (crosses 25%).
2. Donate 500 (crosses 50% and 75% at once).
3. Donate enough to reach 100%.
4. Reload the overlay.

**Expect:** Banners read '🎉 25% of goal!', then 50 and 75 (the last shown wins on screen), then '🎉 Goal reached!'. Each percent celebrates once per overlay load. The progress bar caps at 100%. Milestones follow the campaign goal, not the session goal.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-060 · P2 · Currency labels, number formatting and session-goal display

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Active session with Session goal 2000; donations of 10.5, 1234.56 and 1000000 in staging; a non-GHS campaign if the product allows it.

**Steps:**

1. Check the overlay, watch page, mobile studio stats line and web setup field labels.
2. Look for the session goal (2000) on the overlay, watch page and studio.
3. Repeat on a non-GHS campaign.

**Expect:** Amounts show with en-GH grouping and correct decimals. Known source gaps to confirm or fix: overlay money(), the mobile studio 'GH₵' and the web 'GHS' goal adornment are hard-coded regardless of campaign currency; the session goal is collected but shown nowhere.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/mobile/app/campaign/live.tsx`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/web/src/pages/WatchLivePage.tsx`

## LIVE-077 · P2 · Live QR codes and scan attribution

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Active session; phone camera for scanning.

**Steps:**

1. Web studio, Dynamic QR codes: click 'Live'. Check the QR image and short URL, and that 'Live' is disabled when no session exists.
2. Scan the QR twice with a phone.
3. Check the code's scan count and GET /live-sessions/<sid>/overlay?token=<t> totals.scans.
4. Mobile Manage, QR: select 'Current broadcast' (only listed while live) and 'Create QR code'.
5. As a non-owner, POST /campaigns/<cid>/qr-codes {kind:'live', liveSessionId:<sid>}.
6. End the session and scan again.

**Expect:** The short URL {PUBLIC_API_URL}/r/<code> redirects to https://app.ujimora.com/c/<slug>/live/<sid>. Scan count and session scans each +2. The non-owner gets 403. After the end, the QR opens the ended watch page. Note: the server does not check that liveSessionId belongs to the campaign.

**Needs:** None

**Source:** `apps/web/src/components/live/QrCodeManager.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`

## LIVE-078 · P2 · Accessibility, appearance themes and reduced motion on live surfaces

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** Active session; screen reader (VoiceOver or NVDA); OS reduced-motion setting.

**Steps:**

1. Keyboard only: reach 'Go LIVE', the privacy switches, copy and 'Rotate token', 'End session' and 'Watch broadcast'.
2. Screen reader: check the connection status role=status, overlay alerts aria-live and progress bar values.
3. Turn on reduced motion and view the studio and overlay.
4. Switch Settings appearance (neumorphism, claymorphism, glassmorphism, minimal; light and dark) on web and mobile.
5. View the overlay at 600px width.

**Expect:** All controls are focusable with visible labels. Status and alerts are announced. Animations are suppressed under reduced motion. Themes apply to the studio and watch pages, while the OBS overlay keeps its broadcast branding. The narrow overlay layout does not overflow.

**Needs:** None

**Source:** `apps/web/src/pages/CampaignLivePage.tsx`, `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `docs/live-broadcasting.md`
