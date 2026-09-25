# Live fundraising (90 cases)

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

## LIVE-003 · P0 · LIVE deployment preflight: index, single instance, readiness, URLs, unbuffered SSE

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Production-like environment (Atlas replica set, Render service ujimora-api, deployed web). DB read access and Render dashboard access.

**Steps:**

1. Run the duplicate-active-session aggregation from docs/live-broadcasting.md against livesessions and confirm zero results.
2. Run db.livesessions.getIndexes() and confirm a partial unique index named one_active_session_per_campaign on {campaignId:1} with partialFilterExpression {status:'active'}.
3. In Render confirm ujimora-api runs exactly one instance. Note the instance plan (render.yaml has plan: free), healthCheckPath /health/ready and autoDeployTrigger: checksPass. Agree who pauses auto-deploy during a scheduled live event.
4. curl https://api.ujimora.com/health and https://api.ujimora.com/health/ready.
5. Confirm CORS_ORIGINS includes https://app.ujimora.com (and the admin origin), PUBLIC_WEB_URL=https://app.ujimora.com and PUBLIC_API_URL=https://api.ujimora.com.
6. In the deployed web app, open the DevTools Network tab and confirm API calls go directly to https://api.ujimora.com/api/v1 (VITE_API_URL in apps/web/.env.production; check that no Vercel Production env var overrides it to /api/v1). Note whether VITE_SSE_ENABLED is 'true'.
7. curl -N https://api.ujimora.com/api/v1/campaigns/<activeCampaignId>/events and watch for 25s.
8. In an active studio, copy the OBS overlay link.

**Expect:** No duplicates, and the index exists. Exactly one instance is running. /health returns 200 {status:'ok'}. /health/ready returns 200 {status:'ok'} with Cache-Control no-store; it returns 503 {status:'unavailable'} if MongoDB cannot be reached. With an empty CORS_ORIGINS the production API refuses to boot with 'CORS_ORIGINS is required in production (comma-separated browser origins)'. The web bundle calls the API origin directly. curl prints 'retry: 3000' at once, then ': heartbeat <ts>' about every 20s, with no proxy buffering. The copied overlay link starts with https://api.ujimora.com/api/v1/live-sessions/. Known open issue I003: render.yaml still deploys ujimora-api on plan: free. That instance spins down after 15 idle minutes, and every restart drops SSE streams and the in-memory rate-limit and event state. Moving to an always-on plan is an owner billing decision that must be made before live events.

**Needs:** Render dashboard, MongoDB Atlas

**Source:** `docs/live-broadcasting.md`, `apps/api/src/infrastructure/database/models/LiveSessionModel.ts`, `render.yaml`, `DEPLOYMENT.md`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/web/.env.production`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/web/src/lib/fundraising.ts`

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

1. In Broadcast studio tap 'Start camera and microphone', then 'Camera on'.
2. Read the system prompt text, then choose Don't Allow.
3. Tap 'Unmute' and deny the microphone prompt.
4. Tap the 'Open Settings' button shown under the error.
5. In iOS Settings > Ujimora enable Camera and Microphone, return to the app, and tap 'Camera on' and 'Unmute'.
6. A viewer on web confirms video and audio.

**Expect:** The prompts read 'Use the camera to … broadcast video in live campaign sessions you start.' and 'Use the microphone to broadcast your voice in live campaign sessions you start.' After a denial the host card shows the red message 'Camera or microphone access is off. Open Settings to allow it, then turn the device on.' and an 'Open Settings' button. The app does not crash. 'Open Settings' opens the Ujimora page in iOS Settings. After access is enabled there and the devices are turned on, the message and button clear and video and audio reach viewers. No notification permission prompt ever appears.

**Needs:** LiveKit, signed iOS build

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/src/components/OpenSettingsButton.tsx`, `apps/mobile/app.json`, `apps/mobile/STORE_SUBMISSION.md`

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

**Before:** Production-like API on the launch Render plan, with the web build calling https://api.ujimora.com directly (see LIVE-003). LiveKit plan quota confirmed. 25 to 50 viewers, at least 10 of them on one Wi-Fi or mobile hotspot (same public IP) and at least one on separate mobile data. Host with the OBS overlay.

**Steps:**

1. All viewers open the watch page and click 'Watch broadcast' for 30 minutes while 10 donations are made.
2. On one viewer on the shared Wi-Fi and one on mobile data, inspect the X-RateLimit-Limit and X-RateLimit-Remaining headers on GET /live-sessions/<sid>/public, and compare them with POST /live-sessions/<sid>/video/viewer-token.
3. Monitor the API logs for HTTP 429, plus CPU, memory and the LiveKit dashboard participant count.

**Expect:** No viewer or host sees 'Too many requests, please try again later'. Live reads (/public, /overlay, /events, /active-live, /video/config) report X-RateLimit-Limit 1800 per 15 minutes in their own bucket. Other calls (viewer-token, donations) report 300 and are not drained by polling. Buckets follow each client's real address (Cloudflare CF-Connecting-IP). The shared-Wi-Fi viewers share one live-read count: each watch tab uses about 90 requests per 15 minutes, so 10 tabs use about 900. The mobile-data viewer has its own count. Video is stable and within quota. Any 429 is a launch blocker. If a venue needs more than about 20 watch tabs behind one address, raise the live-read budget. Known open issue I099: limiter counts are held in memory per instance and reset on restart, so the API must stay on a single instance.

**Needs:** LiveKit quota, Render

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/app.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/web/.env.production`

## LIVE-037 · P0 · Host request budget during a 45-minute broadcast

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Host on one network running the web studio (active-session poll every 10s, embedded overlay iframe polling every 10s plus SSE, donor feeds polling every 30s) and OBS with the overlay Browser Source on the same public IP.

**Steps:**

1. Run for 45 minutes with a donation every 5 minutes.
2. Watch the studio for error alerts and the overlay for 'Could not load overlay (429).'
3. Record X-RateLimit-Limit and X-RateLimit-Remaining on /live-sessions/<sid>/overlay and /campaigns/<id>/live-sessions/active responses, and on the donor-feed /campaigns/<id>/donations responses.

**Expect:** No 429 at any point. The studio, the embedded overlay and the OBS overlay all keep updating. Overlay, events and active-session polls report X-RateLimit-Limit 1800, and Remaining stays well above 0: the studio poll and two overlays use roughly 300 to 400 requests per 15 minutes. Donor-feed and other requests use the separate 300 bucket, which also stays above 0.

**Needs:** OBS Studio

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/web/src/components/live/LiveBroadcastPreview.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-038 · P0 · Card donation from the live viewer link is attributed exactly once (money accuracy)

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Paystack test keys, and the webhook set to {API}/…/webhooks/paystack. Active session with showAmounts on. Baseline recorded: campaign raisedAmount, session stats (including checkoutStarts) and campaign balance. OBS overlay open.

**Steps:**

1. As a guest on /live/<sid>, click 'Support this campaign' and confirm the URL has ?liveSessionId=<sid>.
2. Donate GHS 50.00 with no tip, name 'QA Donor' and message 'Go team', using a Paystack test card, and accept the terms.
3. Complete the payment and land on /donate/callback.
4. Check the overlay, the watch page, the host studio 'Raised' and 'Latest:', and the donor's email inbox.
5. DB: check donationintents (status, liveSessionId, settlement financials), donations (liveStatsAppliedAt), livesessions.stats, campaign raisedAmount, and the ledger journal for the donation.

**Expect:** The intent is SUCCEEDED with liveSessionId. Campaign raised increases by 50.00. Session stats: checkoutStarts +1 when the checkout opened, then successfulDonations +1 and amountRaised +50, counted once; the donation has liveStatsAppliedAt set. The overlay alert 'QA Donor · GH₵ 50.00' with 'Go team' appears within about 2s (after message approval, if required). The watch page shows +50 within 10s. The ledger platform fee, processor fee and beneficiary net match the fee configuration and sum to the gross. A receipt email arrives. Known open issue I051: Ujimora sends no donation receipt email. Guests never get one, and signed-in donors only get an activity alert if they opted in, so today the only receipt is Paystack's own email.

**Needs:** Paystack test keys and webhook, email provider

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/OutboxDispatcher.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/api/src/application/services/CampaignLedgerProjector.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## LIVE-039 · P0 · Mobile money donation stays pending, then settles once via webhook

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Paystack test MoMo number; active session with baseline stats.

**Steps:**

1. From the live link, donate GHS 20 via mobile money.
2. While the charge is pending, check the overlay, session stats (GET /live-sessions/<sid>/overlay?token=<t>) and campaign raised.
3. Approve the test charge, or let it succeed, so Paystack sends charge.success.

**Expect:** While pending there is no alert, and successfulDonations, amountRaised and campaign raised are unchanged. Only totals.checkoutStarts has gone up by 1, from when the checkout opened. On success there is exactly one +20 to session amountRaised, +1 to successfulDonations, +20 to campaign raised, and one overlay alert ('… · GH₵ 20.00').

**Needs:** Paystack test MoMo, webhook

**Source:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`

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

## LIVE-041 · P0 · iOS viewer donation hands off to Safari (no in-app payment), including legacy campaigns without a slug

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iOS signed build. Active sessions on (a) a campaign with a vanity slug and (b) a legacy campaign with no slug.

**Steps:**

1. In the native viewer tap 'Support this campaign'. The 'Support this campaign' screen appears; read the copy and tap 'Continue in browser'.
2. Confirm Safari opens https://app.ujimora.com/c/<slug>/donate?liveSessionId=<sid>.
3. Complete a Paystack test donation in Safari and return to the app.
4. Repeat for the legacy campaign with no slug and confirm Safari opens https://app.ujimora.com/c/<campaignId>/donate?liveSessionId=<sid>, then donate.
5. Repeat once on a campaign whose end date has passed.

**Expect:** No amount, payment or wallet form appears inside the iOS app. The screen reads 'Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.' and 'Returning to the app does not confirm payment. Check the payment status on the website before trying again.' Both campaigns show 'Continue in browser'. The legacy campaign opens by its 24-hex id, and Safari receives the 24-hex liveSessionId. Both donations are attributed to their sessions. 'This campaign is not accepting donations right now.' appears only for the closed campaign.

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

**Before:** Active session with a Session goal. OBS overlay, guest watch page and GET /live-sessions/<sid>/public open. A donor ready with a name and message.

**Steps:**

1. Read the helper text under 'Donor privacy' in the web studio.
2. Turn 'Show donor names' off, then donate (name 'Ama', message 'Hi').
3. Turn names back on and 'Show donor messages' off, then donate.
4. Turn 'Show donation amounts' off, then donate.
5. With the names and messages switches on, turn 'Privacy mode' on (the names and messages switches become disabled on web), then donate.
6. After each step, GET /live-sessions/<sid>/overlay?token=<t> and check config and recentDonors.
7. Repeat the toggles from the mobile studio switches.

**Expect:** The helper text reads 'Changes apply live to the overlay and donor feed. Hiding amounts hides each gift’s amount and this broadcast’s total; your campaign’s overall progress stays visible, as it is on your campaign page.' With names off, alerts and recent donors show 'Anonymous'. With messages off, no message is shown. With amounts off, alerts have no amount, the overlay 'Raised live' shows 'hidden', /public amountRaised is null, the watch page shows no total, and the session goal shows its amount without a percentage or bar. Privacy mode hides names and messages whatever their switches say. The overlay clears its alert stack when the config changes. The campaign raised/goal bar stays visible, as the helper text states. Known open issue I098: hiding the campaign progress bar as well (option B) is waiting for an owner decision.

**Needs:** Paystack test keys

**Source:** `apps/api/src/domain/entities/LiveSession.ts`, `apps/api/src/application/use-cases/UpdateLiveSessionPrivacyUseCase.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/api/src/application/use-cases/mappers/liveSessionDto.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`

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

**Before:** Active broadcast with host video, 2 web viewers and 1 native viewer, the OBS overlay, and the LiveKit dashboard open. LiveKit CLI available.

**Steps:**

1. Web: click 'End session', then click Cancel in the 'End broadcast?' dialog and confirm the broadcast is still live.
2. Capture a host token (POST /live-sessions/<sid>/video/host-token).
3. Click 'End session' again and confirm with 'End broadcast'. On mobile, alternatively tap 'End broadcast' and confirm 'End broadcast'.
4. Watch the viewers, the overlay, the campaign detail, and the LiveKit room and participant lists.
5. POST viewer-token and host-token for the ended session, and try to join with the captured host token.
6. Click 'Go LIVE' again.

**Expect:** The dialog reads 'End broadcast?' / 'This closes the live session for viewers.' Cancel leaves the session live. After confirming, the button shows 'Ending…' and the studio returns to 'Session setup'. PATCH returns 200 'Live session ended'. The session document has status ended, endedAt set, providerStopPending false and an unchanged overlay token, with no moderationStoppedAt. In LiveKit, host-<userId> is removed, room ujimora-<sid> is deleted and viewers are disconnected. Within 10s the watch pages show 'This broadcast has ended. You can still support the campaign.' and the overlay shows 'This broadcast has ended'. The session SSE closes within 20s. 'Watch live broadcast' disappears within 15s. Tokens return 409 'This broadcast has ended or is unavailable', and LiveKit refuses the captured host token. A new start creates a new session id and token, and the old overlay URL stays ended.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/application/use-cases/EndLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/api/src/app.ts`

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

**Before:** An admin (role admin) who did not file the report, is not the host and does not own the campaign. A pending live report filed by a signed-in viewer. Host broadcasting, viewers connected, OBS overlay on, LiveKit dashboard open.

**Steps:**

1. Admin console /safety-reports: on the live report, enter notes of at least 20 characters and click 'End broadcast at provider'.
2. Watch the host studio, the viewers, the overlay and LiveKit.
3. GET /live-sessions/<sid>/public and /campaigns/<cid>/active-live, and POST viewer-token.
4. Inspect the livesessions document, the audit logs, and the reporter's and host's in-app notifications.

**Expect:** 'Review saved.' and the report is resolved. The session is ended with moderationStoppedAt, overlayToken '', privacyMode true and providerStopPending false. The host participant is removed with revocation, the room is deleted and viewers are disconnected. Public reads return 404 'Broadcast unavailable'. The overlay shows 'This overlay link is invalid or was revoked.' The host studio returns to setup within 10s. The audit log has safety.stop_live. The reporter gets 'We reviewed your report' and the host gets 'Your live broadcast was stopped' (see LIVE-N007). An admin who filed the report or owns the campaign gets 403 'Another administrator must review this report.' instead.

**Needs:** LiveKit

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`

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

**Before:** Android 13, 14 and 15 devices; signed release build; fresh install; Pro host with an active session.

**Steps:**

1. Tap 'Start camera and microphone', then 'Camera on', and choose Don't allow.
2. Tap 'Camera on' again and choose 'Only this time'.
3. Deny twice so Android stops asking, then tap 'Camera on' and use the 'Open Settings' button. Enable Camera and Microphone under Permissions and return to the app.
4. Check that the app never asks for notification permission.

**Expect:** A denial shows 'Camera or microphone access is off. Open Settings to allow it, then turn the device on.' with an 'Open Settings' button, and the app stays usable. 'Only this time' works for the session, and the message clears on the next attempt. After a permanent denial, 'Open Settings' opens the Ujimora app settings page, and permissions granted there take effect on return. POST_NOTIFICATIONS is never requested (it is blocked in app.json).

**Needs:** LiveKit

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/src/components/OpenSettingsButton.tsx`, `apps/mobile/app.json`

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

**Before:** Campaign with slug <slug>. The host starts, then ends, a session.

**Steps:**

1. After the start, open /campaigns/<id> as a guest and wait up to 15s.
2. Open /c/<slug> (the public campaign page used by shared links and QR codes) and wait up to 15s.
3. Open /c/<slug>/live/<sid>.
4. Open the mobile campaign detail and wait up to 15s.
5. End the session and watch all pages for 15s.

**Expect:** Within 15s, 'Watch live broadcast' appears on /campaigns/<id>, on /c/<slug> (above the donate button) and on the mobile detail, and it links to /live/<sid>. It disappears from all three within 15s of the end. /c/<slug>/live/<sid> renders the same watch page.

**Needs:** LiveKit

**Source:** `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/router.tsx`, `apps/mobile/app/campaign/[id].tsx`, `apps/api/src/application/use-cases/GetActiveLiveSessionUseCase.ts`

## LIVE-034 · P1 · Native viewer and link handling

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** Active broadcast. iOS and Android app installed (production build, plus a staging build if available).

**Steps:**

1. In the app, open the campaign detail, tap 'Watch live broadcast', then 'Watch broadcast'.
2. Rotate the device, background the app for 30s and return.
3. Tap 'Share broadcast' and inspect the shared text. Repeat on the staging build and in the host Broadcast studio ('Share viewer link').
4. From Notes, open ujimora://live/<sid> and ujimora://c/<slug>/live/<sid>.
5. Open https://app.ujimora.com/live/<sid> from Messages.

**Expect:** Video and audio play. Rotation and backgrounding do not crash, and on return the viewer resumes or is offered a rejoin. The shared link uses the build's configured web origin plus /live/<sid>: https://app.ujimora.com/live/<sid> on production builds, and the staging build's own EXPO_PUBLIC_WEB_URL origin on staging (never a hard-coded production link). The studio share text reads 'Watch <title> live on Ujimora: <that link>'. Custom-scheme links open the native viewer. The https link opens the website. Known open issue I152: no Universal Links or Android App Links are configured, so https live links never open the app.

**Needs:** LiveKit

**Source:** `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app.json`

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

## LIVE-045 · P1 · Failed, abandoned or declined checkouts leave live totals untouched but count as checkout starts

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Active session with baseline stats, including overlay totals.checkoutStarts.

**Steps:**

1. Open the donate page from the live link, start the Paystack checkout and close it.
2. Use a Paystack declined test card.
3. Let a MoMo test charge time out.
4. After each step, GET /live-sessions/<sid>/overlay?token=<t> and note the totals.

**Expect:** No alert, and no change to successfulDonations, amountRaised or campaign raised. totals.checkoutStarts increases by 1 for each new checkout opened from the live link (3 in total here). Reopening the same unchanged checkout does not add another. The overlay page itself does not display checkout starts.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/web/src/lib/checkoutAttempt.ts`

## LIVE-046 · P1 · Tampered, foreign or stale liveSessionId on the donate URL never blocks the gift

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Session A on campaign X (active); session B on campaign Y (active); session C on campaign X that ended more than 30 minutes ago; session D on campaign X that ended less than 30 minutes ago. Baseline stats recorded for all four. Paystack test keys.

**Steps:**

1. Open /c/<X slug>/donate?liveSessionId=<B> and donate GHS 10.
2. Open ?liveSessionId=abc and donate GHS 10.
3. Open ?liveSessionId=<C> and donate GHS 10.
4. Open ?liveSessionId=<D> and donate GHS 10.
5. DB: check each intent's liveSessionId and the stats of sessions A to D, and read the API info logs.

**Expect:** All four donations go through; there is no 400 and no 'Invalid ID format'. B: the intent has no liveSessionId, and sessions A and B are unchanged. 'abc': no attribution and no error. C (ended more than 30 minutes ago): no attribution, and C's stats are unchanged. D (ended less than 30 minutes ago): attributed to D, and D's checkoutStarts, successfulDonations and amountRaised increase. For each dropped id the API logs the info line 'dropped live-session attribution that is not this campaign’s current broadcast'. The 30-minute grace period (LIVE_ATTRIBUTION_GRACE_MS) is a constant the owner can adjust.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`

## LIVE-048 · P1 · Outbox re-dispatch after a crash does not double-count session stats

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Staging with DB access; ability to restart the API; OBS overlay and a curl -N session SSE stream open.

**Steps:**

1. Complete a live donation. Note the session stats, the overlay alert and the donation's liveStatsAppliedAt.
2. Set that donation's outbox row back to {status:'pending'} and unset dispatchedAt, leaseToken and leaseUntil (simulating a crash before markDispatched). Wait at least 30s so the row is old enough for the sweep, then restart the API (boot sweep) or wait for the 60s production sweep.
3. Compare session stats, overlay alerts and the SSE events.
4. Repeat with two API restarts in quick succession.

**Expect:** Session successfulDonations and amountRaised are unchanged after every re-dispatch, and liveStatsAppliedAt keeps its first value. A re-dispatch sends only a refreshed 'total' event, with no second 'donation' event, no repeated milestone and no second overlay alert. The outbox row ends in status dispatched.

**Needs:** None

**Source:** `apps/api/src/application/services/OutboxDispatcher.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoOutboxRepository.ts`, `apps/api/src/infrastructure/database/models/OutboxModel.ts`, `apps/api/src/main.ts`

## LIVE-049 · P1 · Refund of a live-attributed donation reverses the broadcast's totals

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** A settled live-attributed card donation of GHS 40, with baseline session stats. Admin with DONATIONS permission. Paystack test refunds.

**Steps:**

1. Admin console /payments: find the payment by its provider reference and open it.
2. Click Refund, enter 15 (helper text 'Partial refund'), tick 'I have checked this refund is approved and the amount is correct.' and submit.
3. When the refund completes, check session stats (GET /live-sessions/<sid>/overlay?token=<t>), the overlay 'Raised live', the watch page and campaign raisedAmount.
4. Refund the remaining 25 the same way and check again, including overlay recentDonors.
5. Replay the refund webhook, or re-run refund accounting, and check again.

**Expect:** After the partial refund, session amountRaised drops by 15 and successfulDonations is unchanged; campaign raised drops by 15. The overlay and the watch page reflect this within 10s. After the rest is refunded, amountRaised drops by a further 25 and successfulDonations drops by 1. The counters never go below 0, and replays do not reverse anything a second time. Known open issue I143: overlay recentDonors (JSON only, not rendered on the overlay) still lists the refunded donation.

**Needs:** Paystack refunds (test)

**Source:** `apps/api/src/application/use-cases/ProcessRefundUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/admin/src/pages/PaymentsPage.tsx`, `apps/admin/src/components/payments/RefundDialog.tsx`, `apps/api/src/application/services/CampaignLedgerProjector.ts`

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

**Before:** Active broadcast with an OBS overlay, the host studio and 3 viewers. A curl -N session SSE stream open, with its last 'id:' noted.

**Steps:**

1. Trigger a Render redeploy or restart of ujimora-api.
2. Make one donation during the restart window and another after it.
3. Watch the video, overlay, studio and watch pages.
4. Reconnect the curl stream with -H 'Last-Event-ID: <id from before the restart>'.

**Expect:** LiveKit video continues, because it runs on a separate provider. Render sends traffic only after /health/ready returns 200. SSE clients reconnect after about 3s, and the overlay shows 'Reconnecting…' then 'Live'. Event ids after the restart are higher than before, because they start at the boot time. A client reconnecting with the old Last-Event-ID therefore receives every event the new process has published, including alerts for donations settled after it started. Within 10s the overlay REST refresh restores the correct totals and 'Raised'. Events that the old process published just before it stopped, and had not yet delivered, are lost. The session stays active, and the studio and viewers recover without a manual reload. Known open issue I003: on the free plan, idle spin-downs cause these restarts.

**Needs:** Render

**Source:** `apps/api/src/infrastructure/realtime/EventBus.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/api/src/app.ts`, `render.yaml`, `docs/live-broadcasting.md`

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

**Before:** Pro host on /campaigns/<id>/live with no active session. Deployed web app calling the API origin directly (https://api.ujimora.com/api/v1).

**Steps:**

1. Look at 'Your broadcast canvas' ('Preview before you go live').
2. Type a Session title and a Session goal of 2000 and watch the preview.
3. In the DevTools Network tab, inspect the iframe request to https://api.ujimora.com/api/v1/live-sessions/preview/overlay/view?token=&preview=1&title=…&raised=…&goal=…&target=2000: status, content type, X-Frame-Options and Content-Security-Policy.
4. Go live and check the canvas again ('Live overlay').

**Expect:** The iframe request returns 200 text/html with no X-Frame-Options header. Its CSP frame-ancestors lists 'self' and the web origins (including https://app.ujimora.com), so the page renders cross-origin. The frame shows the typed title (the campaign title when the field is empty), the campaign raised/goal bar and percentage, 'Raised live GH₵ 0.00', '0 donations' and 'Session goal GH₵ 2,000.00 · 0%'. No JSON error text appears. After go-live the iframe loads /live-sessions/<sid>/overlay/view?token=<48hex> and shows the live overlay.

**Needs:** None

**Source:** `apps/web/src/components/live/LiveBroadcastPreview.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/LiveSessionController.ts`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/web/src/lib/fundraising.ts`

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

## LIVE-065 · P1 · Public campaign SSE feed does not leak the broadcast's hidden total

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** Active session with Privacy mode on and 'Show donation amounts' off. Overlay token <t>.

**Steps:**

1. curl -N {API}/api/v1/campaigns/<cid>/events (public, no token).
2. In a second terminal, curl -N '{API}/api/v1/live-sessions/<sid>/events?token=<t>'.
3. Make a named donation with a message from the live link.

**Expect:** On the campaign feed, the 'total' event contains only campaignId, raisedAmount, goalAmount and currency, with no sessionAmountRaised and no liveSessionId. Its 'donation' event carries the donor's public name ('Anonymous' for anonymous donors), the amount and the approved message, the same fields as the public donations list. On the session feed, the donation has name 'Anonymous', no message and amount null, and the 'total' has sessionAmountRaised null. Known open issue I098: the session privacy toggles apply only to the overlay, the watch page and the session feed. Campaign-level surfaces stay public by design until the owner decides otherwise.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/web/src/pages/CampaignLivePage.tsx`

## LIVE-067 · P1 · End during a provider outage: session ends at once, cleanup retries

*Surfaces:* admin, api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Staging where the LiveKit credentials can be broken temporarily after a session is running (a wrong LIVEKIT_API_SECRET, or blocked egress). A viewer watching. Mobile studio open. Admin console.

**Steps:**

1. Break the provider credentials, then click 'End session' and confirm 'End broadcast'.
2. Check the studio, the viewer's watch page, the livesessions document and admin /safety-reports.
3. POST viewer-token for the session.
4. Send PATCH {status:'ended'} again, and watch the mobile studio.
5. Restore the credentials, then wait up to 30s or click 'Retry cleanup' in admin.

**Expect:** PATCH returns 200 'Live session ended', and the studio returns to 'Session setup' without an error alert. The session has status ended and providerStopPending true. Within 10s the viewer sees 'This broadcast has ended…', and viewer tokens return 409 'This broadcast has ended or is unavailable'. Admin shows 'Live cleanup pending' 1 and '1 live safety operations still need provider cleanup. These are not complete.' A repeated end returns 200 with the ended session. The mobile studio returns to the create form within 10s. After recovery, the host identity is removed, room ujimora-<sid> is deleted, providerStopPending becomes false and the pending count returns to 0.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/application/use-cases/EndLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## LIVE-068 · P1 · Abandoned sessions, campaign expiry mid-live and token reuse after end

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging with DB access. LiveKit CLI. LiveKit Cloud (token revocation works only there). A viewer and the OBS overlay available.

**Steps:**

1. Start a session, close all host devices, wait 1 hour and confirm it is still active. Then set its startedAt to 13 hours ago and wait up to 30s.
2. Start another session with a viewer and the OBS overlay open, then set the campaign endDate to the past.
3. Immediately check /campaigns/<id>/active-live, /live-sessions/<sid>/public, /overlay?token=<t>, /events?token=<t>, viewer-token and host-token. Watch the overlay, the watch page and the studio for 30s, then click 'Go LIVE'.
4. Capture a host token, end a fresh session within 60s, and try to join with the captured token (lk room join).

**Expect:** Step 1: the session is still active after 1 hour. Once it is more than 12 hours old (MAX_LIVE_SESSION_MS), the 30s sweep ends it the normal way: status ended, endedAt set, no moderationStoppedAt, overlay token kept, host removed and room deleted. The watch page and overlay show the ended state. Steps 2 and 3: once the end date has passed, /public and /overlay report status 'ended' and /events returns 409 'This live session has ended'. Open streams close within 20s. active-live is null. Tokens return 409 'This campaign is not available to broadcast' until the sweep runs, then 'This broadcast has ended or is unavailable'. The sweep ends the session within about 30s, and the studio returns to 'Session setup' within 10s after that. 'Go LIVE' returns 409 'Only an active campaign can go live'. Within 5 minutes the campaign is relabelled expired. Step 4: LiveKit refuses the captured host token because the identity was revoked, and no usable room is recreated. The 12-hour limit is a constant the owner can adjust.

**Needs:** LiveKit CLI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/application/use-cases/GetLiveSessionPublicUseCase.ts`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/RealtimeController.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/application/use-cases/ExpireEndedCampaignsUseCase.ts`, `apps/api/src/app.ts`, `apps/api/src/main.ts`

## LIVE-071 · P1 · Moderation stop provider failure, cleanup queue and retry

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with LiveKit credentials that can be broken. A pending live report on a running session, filed by an account other than the reviewing admin, whose campaign that admin does not own.

**Steps:**

1. Break the credentials, then click 'End broadcast at provider'.
2. Reload the queue and check the 'Live cleanup pending' stat, the warning alert and the report banner.
3. Try 'Dismiss' on the same report.
4. Restore the credentials and click 'Retry cleanup' (or wait 30s for reconciliation).
5. Retry 'End broadcast at provider'.

**Expect:** The first attempt errors, but public access is already cut: 404, and the overlay is revoked. The pending count is 1 with '1 live safety operations still need provider cleanup. These are not complete.' The banner reads 'Review started: stop live…' and the notes are locked. Dismiss returns 409 'A different review has already started. Refresh the queue.' After recovery the count returns to 0, the room is deleted, and the retried action resolves the report.

**Needs:** LiveKit

**Source:** `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/app.ts`

## LIVE-072 · P1 · Restricting a host stops all their broadcasts and blocks new ones

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Host with two campaigns, one of them live. A pending report about the host, filed by another account. A reviewing admin who is not the reporter and does not own the campaigns.

**Steps:**

1. Admin: 'Restrict publishing' with notes of at least 20 characters.
2. The host clicks 'Go LIVE' on the other campaign, then POSTs host-token on the old session.
3. Admin: switch the status filter to resolved and click 'Restore publishing after appeal' with notes.
4. The host goes live again.

**Expect:** The active session is stopped, as in LIVE-070. The new start returns 403 'Publishing is restricted…', and the old session's host token returns 409 'This broadcast has ended or is unavailable'. The host gets an in-app 'Publishing is restricted on your account' notice. The restore shows 'Publishing restriction removed. Previously hidden comments and messages remain hidden.', after which the host can start. Previously hidden content stays hidden.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionCreation.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## LIVE-073 · P1 · Live moderation endpoints: administrator accounts only

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Accounts: an admin (role admin), a regular member and an organization account. No Moderator role can be assigned: account roles are only user, organization and admin.

**Steps:**

1. The regular member signs in on the admin console login page.
2. With the member's API token, call GET /admin/safety-reports, PUT /admin/safety-reports/<id>/review {action:'stop_live', notes:'<20+ characters>'}, POST /admin/safety-reports/live-cleanup/retry and POST /admin/safety-reports/restrictions/<userId>.
3. GET /rbac/me with the member token and with the organization token.
4. The admin signs in, opens /safety-reports, and confirms that 'End broadcast at provider' and 'Retry cleanup' work.

**Expect:** The console sign-in is refused with 'This account does not have staff access.' (403) before any token is issued. Nothing is stored, and an 'auth.admin_console.refused' audit row is written. Every admin safety call returns 403 'Insufficient permissions'. /rbac/me returns permissions [] and roleName ''. The admin can stop broadcasts. Known open issue I028: no staff roles can be assigned, so only full administrators can stop broadcasts, and admin MFA is optional.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts`, `apps/admin/src/context/AuthContext.tsx`, `packages/types/src/user.ts`

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

**Before:** Live sessions on three campaigns, and admin access. Host 2's live campaign has received no donations, and host 2 has no wallet, campaign, tip or affiliate balance and no pending payouts (otherwise deletion is refused). Host 3's live campaign has raised money.

**Steps:**

1. Admin blocks campaign 1 through the campaign review flow while it is live.
2. Host 2 deletes their account (Settings, Delete account) while live.
3. Host 3 opens Delete account while live, then sends DELETE /profile directly.
4. For 60s, watch the viewers, the overlays, the LiveKit rooms and the admin 'Live cleanup pending' count.

**Expect:** Sessions 1 and 2 end with moderationStoppedAt, a blank overlay token and privacyMode true. Their viewers get 'Broadcast unavailable', and their overlays show 'This overlay link is invalid or was revoked.' providerStopPending is reconciled within about 30s, the rooms are deleted, and the pending count returns to 0. Host 2's campaign moves to 'expired'. Host 3 sees the closure-check explanation naming the balance (and support@ujimora.com) with no delete action, and the direct DELETE returns 409. Host 3's broadcast keeps running. Donation records and totals are preserved.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`

## LIVE-N001 · P1 · Lapsed plan cannot resume an existing broadcast or mint a new host token

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Pro host with an active session on campaign <cid>, connected on web. Staging DB access to expire the subscription (or a sandbox subscription about to lapse). Admin account. A guest viewer watching.

**Steps:**

1. Expire the host's Pro subscription (status expired, or period end in the past) so the resolved plan has liveStreaming false.
2. Web studio: click 'Disconnect camera', then 'Start camera & microphone'.
3. As the host, then as the admin, POST /campaigns/<cid>/live-sessions.
4. iOS or Android Broadcast studio: tap 'Start camera and microphone'.
5. The guest viewer clicks 'Watch broadcast' again.
6. The host ends the session.

**Expect:** Host-token requests return 403 'Your <Plan name> plan does not include LIVE streaming. Upgrade to unlock it.' The message appears in the web video panel and as red text on native. The start call, from the host or the admin, returns the same 403 instead of the existing session. Viewer tokens still work, because viewers are never plan-gated. The owner can still end the session (200). Gap not covered by the I070 fix: a host who is already connected when the plan lapses is not disconnected. The session ends only when the host ends it or it passes the 12-hour stale limit.

**Needs:** LiveKit; subscription test data

**Source:** `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/api/src/app.ts`, `apps/api/src/application/services/PlanLimitsService.ts`, `apps/web/src/components/live/LiveVideoPanel.tsx`, `apps/mobile/src/components/LiveVideo.tsx`

## LIVE-N005 · P1 · Ending on one device disconnects the host camera on the other

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Active session. The host is connected with camera on in the iOS (or Android) Broadcast studio and has the web studio open. A web viewer is watching. LiveKit dashboard open.

**Steps:**

1. On web, click 'End session' and confirm 'End broadcast'.
2. For 10s, watch the phone's host card, the viewer and the LiveKit participant list.
3. On the phone, tap 'Start camera and microphone' before the studio refreshes.
4. Wait 10s and look at the phone's studio.

**Expect:** host-<userId> is removed from the room right after the end, and the room is deleted. The phone's host card drops back to 'Ready to broadcast' without an error loop, and the viewer's video stops. The rejoin attempt returns 409 'This broadcast has ended or is unavailable'. Within 10s the phone's studio returns to the create form.

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/application/use-cases/EndLiveSessionUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/app/campaign/live.tsx`

## LIVE-N006 · P1 · Live polling has its own rate-limit bucket keyed on the real client address

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Render-hosted staging reached through its public hostname (Cloudflare in front), not localhost. Active session <sid> on campaign <cid>. curl. A second network (phone hotspot).

**Steps:**

1. curl -si {API}/api/v1/live-sessions/<sid>/public twice and note X-RateLimit-Limit and X-RateLimit-Remaining.
2. curl -si {API}/api/v1/campaigns/<cid> and note the same headers.
3. Repeat step 1 with -H 'X-Forwarded-For: 203.0.113.9', then -H 'X-Real-IP: 203.0.113.10', then -H 'CF-Connecting-IP: 203.0.113.11'.
4. Repeat step 1 from the second network.
5. From one address, send 1801 GETs to /live-sessions/<sid>/public, then GET /campaigns/<cid> and POST /live-sessions/<sid>/video/viewer-token.

**Expect:** /public reports X-RateLimit-Limit 1800, and Remaining falls by 1 per call. /campaigns/<cid> reports 300 with its own count, which the live reads do not affect. Forged X-Forwarded-For, X-Real-IP or CF-Connecting-IP headers do not reset or move the count, because Cloudflare overwrites CF-Connecting-IP. The second network starts with its own full budget. After 1800 calls, /public returns 429 'Too many requests, please try again later' with Retry-After, while /campaigns/<cid> and viewer-token still succeed. Known open issue I099: the counts live in process memory, reset on restart and need a single API instance.

**Needs:** Render staging behind Cloudflare

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/app.ts`, `DEPLOYMENT.md`

## LIVE-N008 · P1 · An administrator with a stake in a live report cannot review it

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Two admin accounts, A and B. A non-admin host broadcasting. Admin A, signed in on web as a viewer, reports the live session. Optionally, an admin who owns a live campaign on a Pro plan.

**Steps:**

1. Admin A opens admin /safety-reports and clicks 'End broadcast at provider' on that report, with notes of at least 20 characters.
2. Check the broadcast and the report status.
3. Admin B takes the same action.
4. If available: another user reports the admin-owned broadcast, and the owning admin tries to review it.

**Expect:** Admin A gets 403 'Another administrator must review this report.'. The report stays pending and the broadcast continues. Admin B's action succeeds ('Review saved.') and stops the broadcast. The owning admin in step 4 also gets 403 'Another administrator must review this report.'

**Needs:** LiveKit

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## LIVE-N009 · P1 · Directly restricting a host from 'Restricted users' stops their broadcast

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Host broadcasting with viewers and the OBS overlay. An admin. The host's 24-hex account ID.

**Steps:**

1. Admin /safety-reports: switch to 'Restricted users'. Under 'Restrict an account', enter the host's Account ID and notes of at least 20 characters, then click 'Restrict publishing'.
2. For 30s, watch the viewers, the overlay, the LiveKit room and the host studio.
3. The host clicks 'Go LIVE' on another campaign.
4. The admin tries to restrict their own account ID.
5. In the restricted list find the host, enter lifting notes of at least 20 characters and click 'Lift restriction'. The host then goes live again.

**Expect:** 'Publishing restricted.' appears, and the host is listed with '· direct restriction'. The active session is stopped as a moderation stop: watch pages show 'Broadcast unavailable', the overlay shows 'This overlay link is invalid or was revoked.', and the room is deleted. 'Go LIVE' returns 403 'Publishing is restricted…'. Restricting their own account returns 403 'Another administrator must restrict your account.' Lifting shows 'Publishing restriction lifted. Previously hidden content stays hidden.', and the host can start a new session. The audit log has safety.restrict_user and safety.restore_public_content.

**Needs:** LiveKit

**Source:** `apps/admin/src/components/RestrictedUsersPanel.tsx`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## LIVE-013 · P2 · Declined, flagged, screening-unavailable and expired approvals for live titles

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Staging with an OpenAI key and DB access. Pro host with an active campaign. Admin account with Publication reviews.

**Steps:**

1. With consent ticked, submit a title that OpenAI moderation should flag (for example an explicit violent threat). Admin declines it in /publication-reviews with notes. The host retries the same title.
2. Temporarily unset OPENAI_API_KEY (or block egress to OpenAI), submit a new title with consent, and check the API logs.
3. For an approved live.start review, set approvalExpiresAt in the past (simulating 7 days). End any active session, then click 'Go LIVE' again with the same title and goal and the consent ticked.
4. Repeat step 3 for another expired approval with the consent unticked. Then approve the re-queued review in admin and click 'Go LIVE' again.

**Expect:** Flagged content is held: 409 'Saved privately for safety review. Your content has not been published…' and no session is created. After the decline, the retry returns 422 'This version was declined in safety review…'. A screening outage fails closed: the title is held for staff, no session is created, and the API logs the warning 'Publication screener unavailable; routed to staff review'. Expired approval with consent: the same version is screened again in place and, when allowed, the session starts (201) with a fresh approval by automated:openai valid for 7 days. Expired approval without consent: the review goes back to pending for staff, and the start returns 409 'Saved privately for safety review…'. After staff approval the identical title and goal start. The old 409 'This safety approval expired…' no longer appears. Known open issue I073: an approval still covers only the exact title and goal and expires after 7 days (no drafts or auto-publish).

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.ts`, `apps/api/src/application/use-cases/StartLiveSessionUseCase.ts`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

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

**Before:** An ended session; sessions on campaigns moved to pending_review or blocked; a session whose campaign end date has just passed; invalid ids.

**Steps:**

1. Open /live/000000000000000000000000.
2. Open /live/not-an-id.
3. Open an ended session.
4. Open a session whose campaign is pending_review or blocked.
5. Open a session whose campaign end date passed moments ago, before the 30s stale sweep runs.
6. Repeat the unknown, malformed and ended cases in the native viewer (ujimora://live/<id>).

**Expect:** Unknown and malformed ids both show the error 'Broadcast unavailable' (API 404), with no 'Invalid ID format' message and no crash. An ended session shows 'This broadcast has ended. You can still support the campaign.' with a Support link that has no liveSessionId. A pending_review or blocked campaign shows 'Broadcast unavailable'. A session whose campaign end date has passed reads as ended straight away ('This broadcast has ended…', no video player). Native shows the same messages as red text.

**Needs:** None

**Source:** `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/application/use-cases/GetLiveSessionPublicUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`

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

**Before:** Active session with Session goal 2000. Donations of 10.5, 1234.56 and 1000000 in staging. A non-GHS campaign, if the product allows one.

**Steps:**

1. Check the amounts on the OBS overlay, the web watch page, the native watch page and the mobile studio stats line, and the adornment on the web Session goal field.
2. Look for the session goal (2000) on the overlay ('Session goal'), the web watch page, the native watch page and the pre-live preview.
3. Turn 'Show donation amounts' off and check the goal displays again.
4. Repeat on a non-GHS campaign.

**Expect:** Overlay amounts always have two decimals and en-GH grouping ('GH₵ 10.50', 'GH₵ 1,234.56', 'GH₵ 1,000,000.00'), and no float tails appear anywhere. The overlay shows 'Session goal GH₵ 2,000.00 · N%'. The web watch page shows 'Session goal: <amount> · N% reached' with a progress bar. The native watch page shows 'Session goal: GHS 2,000 · N% reached'. The pre-live preview shows the goal typed into Session goal. With amounts hidden, the goal amount stays but the percentage and the bar disappear. The native watch total uses the session's currency with two decimals (for example GH₵1,234.56). Known open issue I144 (the fix did not cover the web and overlay parts): the overlay always prints 'GH₵', the web setup field adornment says 'GHS', and the mobile studio line formats as GHS, whatever the campaign currency.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/lib/money.ts`, `apps/web/src/pages/CampaignLivePage.tsx`, `apps/web/src/components/live/LiveBroadcastPreview.tsx`

## LIVE-077 · P2 · Live QR codes, scan attribution and session validation

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Active session <sid> on campaign <cid>. Another campaign's active session <otherSid>. An ended session of <cid>. A phone camera for scanning.

**Steps:**

1. Web studio, Dynamic QR codes: click 'Live'. Check the QR image and short URL, and that 'Live' is disabled when no session exists.
2. Scan the QR twice with a phone camera and open it in the browser.
3. Check the code's scan count ('N scans') and totals.scans in GET /live-sessions/<sid>/overlay?token=<t>.
4. Mobile Manage, QR: select 'Current broadcast' (only listed while live) and tap 'Create QR code'.
5. As a non-owner, POST /campaigns/<cid>/qr-codes {kind:'live', liveSessionId:<sid>}.
6. As the owner, POST /campaigns/<cid>/qr-codes with kind 'live' and liveSessionId set to <otherSid>, then to the ended session, then to 'abc'. Then POST kind 'campaign' with liveSessionId <sid>.
7. End the session and scan again.

**Expect:** The short URL {PUBLIC_API_URL}/r/<code> redirects (302) to https://app.ujimora.com/c/<current slug>/live/<sid>. The scan count and the session's scans each rise by 2. The non-owner gets 403. The owner's live QR with the other campaign's session, the ended session or 'abc' returns 400 'A live QR code can only point to this campaign’s current broadcast'. The 'campaign' code is created without a session. After the end, the QR opens the ended watch page.

**Needs:** None

**Source:** `apps/web/src/components/live/QrCodeManager.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `apps/api/src/application/use-cases/CreateShortLinkUseCase.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`, `apps/api/src/application/utils/shortLinkTarget.ts`

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

## LIVE-N002 · P2 · Gift paid shortly after the broadcast ends still counts for that broadcast (30-minute grace)

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Active session <sid> with baseline stats. Paystack test keys. DB access.

**Steps:**

1. As a guest, open /live/<sid>, click 'Support this campaign' (the URL has ?liveSessionId=<sid>) and fill the form without submitting.
2. The host ends the session.
3. Within 10 minutes, the guest submits and pays GHS 30 by test card.
4. Check the intent's liveSessionId, the ended session's stats and the ended watch page.
5. Set this session's endedAt to 31 minutes ago, then donate again from the same donate URL.

**Expect:** Step 3: the donation succeeds and is attributed to <sid>. On the ended session, checkoutStarts and successfulDonations each rise by 1 and amountRaised by 30. The ended watch page ('This broadcast has ended…') shows the new session total within 10s. Step 5: the donation succeeds without a liveSessionId, the session's stats do not change, and the API logs 'dropped live-session attribution that is not this campaign’s current broadcast'. The 30-minute window is LIVE_ATTRIBUTION_GRACE_MS, a constant the owner can adjust.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/services/RealtimeDonationProjector.ts`, `apps/web/src/pages/WatchLivePage.tsx`, `apps/web/src/pages/DonatePage.tsx`

## LIVE-N003 · P2 · Retrying the same live checkout reuses it and counts one checkout start

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** Active session. Paystack test keys. DB access. An API client.

**Steps:**

1. From the live link, fill the donate form (GHS 25) and continue to Paystack. Close the Paystack tab without paying.
2. Back on the donate page, submit again with identical details.
3. Change the amount to GHS 30 and submit.
4. API: POST /donation-intents twice with the same Idempotency-Key and the same body including liveSessionId. Then send the same key with a different amount.
5. After each step, check donationintents for the session and totals.checkoutStarts in GET /live-sessions/<sid>/overlay?token=<t>.

**Expect:** Step 2 reopens the same Paystack checkout (same intent and reference), so steps 1 and 2 together add 1 checkout start. Step 3 creates a new intent and adds 1 more. API: the second identical call returns the same intent and adds no checkout start. The changed amount returns 409 'This checkout request key was already used for different details.'

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/web/src/lib/checkoutAttempt.ts`, `apps/web/src/lib/fundraising.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/api/src/application/use-cases/GetLiveSessionOverlayUseCase.ts`

## LIVE-N004 · P2 · Link previews and HEAD requests are not counted as live QR scans

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Active session with a 'Live' QR code created in the web studio. Its 'N scans' count and overlay totals.scans noted. A chat app (WhatsApp, Slack or Telegram).

**Steps:**

1. Paste the short URL {PUBLIC_API_URL}/r/<code> into a chat so the app builds a link preview.
2. curl -I {PUBLIC_API_URL}/r/<code>.
3. curl -A 'facebookexternalhit/1.1' -o /dev/null -w '%{http_code} %{redirect_url}' {PUBLIC_API_URL}/r/<code>, then repeat with the user agents 'WhatsApp/2.23' and 'Googlebot/2.1'.
4. Open the short URL once in a phone browser.
5. Download the QR PNG from the studio and check its response headers.

**Expect:** Steps 1 to 3 get a 302 to https://app.ujimora.com/c/<slug>/live/<sid>, but neither the code's scan count nor totals.scans changes. Step 4 adds exactly 1 to both. The QR image is served with Cache-Control 'public, max-age=86400, immutable'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/ShortLinkController.ts`, `apps/api/src/application/use-cases/ResolveShortLinkUseCase.ts`, `apps/web/src/components/live/QrCodeManager.tsx`

## LIVE-N007 · P2 · Reporter and host get in-app notices after a broadcast is stopped

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Active session. A signed-in viewer who reports it (as in LIVE-069). A reviewing admin who is not the reporter or the campaign owner. The host signed in on web and mobile.

**Steps:**

1. The viewer reports the live session.
2. Admin: 'End broadcast at provider' on the report, with notes of at least 20 characters.
3. The viewer opens the notification bell on web.
4. The host opens notifications on web (header bell) and on mobile (notification bell).
5. Repeat with another live report on which the admin chooses 'Dismiss'.
6. Repeat with a report on which the admin chooses 'Restrict publishing'.

**Expect:** The viewer gets 'We reviewed your report': 'Thank you for your report. Our team has reviewed it and taken the action it considers appropriate.' The host gets 'Your live broadcast was stopped': 'Your live broadcast was stopped after a safety review. For details or to appeal, contact support@ujimora.com.' Staff review notes never appear. Each notice appears once, in-app only, with no email. On Dismiss the reporter gets the acknowledgement and the host gets nothing. On Restrict publishing the host gets 'Publishing is restricted on your account'.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/web/src/components/layout/Header.tsx`, `apps/mobile/src/components/NotificationBell.tsx`

## LIVE-N010 · P2 · OBS overlay keeps right-to-left names and messages isolated

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Active session with names, messages and amounts shown. OBS overlay, or a browser tab on the overlay link.

**Steps:**

1. Donate GHS 20 with the name 'عبد الله' and the message 'شكرا لكم'.
2. Donate GHS 15 with a name containing a right-to-left override character, for example 'Ama' + U+202E + 'evil'.
3. Start a new session with an Arabic title (after approval) and view the overlay panel.

**Expect:** Each alert shows the name followed by ' · GH₵ 20.00' (or ' · GH₵ 15.00') in normal order. The amount is never mirrored or pulled into the name. The override in step 2 affects only the name, not the amount or any other alert. Arabic messages and titles run right-to-left in their own box without reordering the text around them.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`, `apps/api/__tests__/infrastructure/views/overlayBidi.test.ts`

## LIVE-N011 · P2 · Malformed live ids return 404 'Broadcast unavailable' on public live endpoints

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** An API client. A host bearer token for step 3.

**Steps:**

1. Call GET /live-sessions/not-an-id/public, /live-sessions/not-an-id/overlay?token=x, /live-sessions/not-an-id/overlay/view and /live-sessions/not-an-id/events?token=x, and POST /live-sessions/not-an-id/video/viewer-token.
2. GET /campaigns/not-an-id/active-live.
3. As a host, POST /live-sessions/not-an-id/video/host-token.
4. GET /live-sessions/preview/public and /live-sessions/preview/overlay/view?preview=1.

**Expect:** Steps 1 and 2, and /live-sessions/preview/public, return 404 {message:'Broadcast unavailable'}, never 400 'Invalid ID format' or 500. host-token returns 409 'This broadcast has ended or is unavailable'. /live-sessions/preview/overlay/view returns 200 HTML (the static preview page).

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/liveSessionRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/video/LiveVideoService.ts`

## LIVE-N012 · P2 · Watch-live link and organiser block on the public /c/:slug page during a broadcast

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Active session on campaign <slug>. A signed-in viewer watching /live/<sid> in one tab. A guest browser. LiveKit dashboard open.

**Steps:**

1. In a second tab, the viewer opens /c/<slug> and clicks 'Watch live broadcast'.
2. On /c/<slug>, the viewer uses the organiser's 'Block user' control.
3. Watch the first tab and the LiveKit participants for 10s.
4. As a guest on /c/<slug>, click 'Report campaign'.

**Expect:** 'Watch live broadcast' opens /live/<sid>. After the block, /c/<slug> shows 'You blocked this organiser, so their campaign is hidden from you.' viewer-<viewerId> is removed from the room, and the first tab shows 'Broadcast unavailable' on its next poll. The guest is sent to sign-in and returns to /c/<slug> afterwards.

**Needs:** LiveKit

**Source:** `apps/web/src/pages/CampaignPublicPage.tsx`, `apps/web/src/components/safety/UserSafetyControls.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`
