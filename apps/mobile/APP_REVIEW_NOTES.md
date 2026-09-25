# Ujimora — store review notes and console answers

Draft for the owner to paste into App Store Connect (App Review Information → Notes)
and Google Play Console. Replace every `<…>` before submitting. Everything here
describes the current source; re-check it against the final signed build.

## Reviewer notes (both stores)

Ujimora is a crowdfunding app for Ghana. Organizers create campaigns; supporters
browse campaigns and donate. It is operated by DevTrack (Ghana business name
BN843072020), UNN House, Nii Osae Ntifu Avenue, East Legon, Accra.

- **Demo account:** `<reviewer email>` / `<password>` — an ordinary member (not staff),
  with identity verification already approved so campaign tools are visible.
  MFA and biometric lock are off for this account.
- **Browsing** campaigns, organizations, creators, live sessions and all legal
  pages works without signing in.
- **Donations**
  - iOS: tapping Donate (or Fund wallet) opens the campaign page on
    `app.ujimora.com` in Safari. No payment is taken inside the iOS app
    (App Review Guidelines 3.2.1(vi) / 3.2.2(iv)).
  - Android: donations use Paystack's hosted checkout (card / mobile money) in a
    browser tab. They are payments to campaigns, not digital goods.
  - Creator tips are unavailable inside both apps.
- **Subscriptions** (organizer plans with higher campaign limits, live streaming and
  collaboration) are sold only through App Store / Google Play in-app purchase.
  Settings → Subscription has Restore purchases and a link to manage the store
  subscription. Web subscriptions are not offered or linked inside the app.
- **User-generated content:** comments, campaign updates, donor messages, creator
  pages and live sessions. Users accept the Terms and confirm they are 18+ before
  posting. Signed-in users see Report on every content surface, and profiles/creators/live sessions have
  Block user (Settings lists blocked users). Reports go to a staffed moderation queue;
  new comments/updates/campaigns are held for review before publication.
- **Account deletion:** Settings → Delete account (in-app), or the public page
  `<https://app.ujimora.com/delete-account>`. The user confirms with their current
  password (plus an authenticator code if they turned MFA on). Because Ujimora holds
  funds, an account with an unpaid balance or a payout in progress is asked to
  withdraw it first or contact support, who complete the closure. Keep the reviewer
  account free of balances so deletion can be tested end to end.
- **Identity verification (KYC)** is only needed to create campaigns or withdraw
  funds. It collects ID images, a selfie and an address; the notice on the form
  explains the purpose. Location is read only when the user taps "Use my location".
- **Live broadcasting** (organizers): camera and microphone stream to viewers via
  LiveKit. iOS uses the `audio` background mode only so a live broadcast's audio is
  not cut off when the host briefly leaves the app. Android screen sharing uses a
  `mediaProjection` foreground service that starts only after the host taps Share
  screen and accepts the system capture prompt.
- **AI writing help** is optional. Each request asks for consent before text is
  sent to OpenAI.
- **Crypto donations** are switched off on the server and are not shown in the app.
- **Push notifications** are not used; the app never asks for notification permission.

## Apple App Store Connect

- Account type: financial/crowdfunding apps must come from an **Organization**
  developer account (Guideline 5.1.1(ix), 3.2.1(viii)). Enrol DevTrack with its D-U-N-S number.
- Age rating: 18+ (user-generated content, unrestricted web access to campaign pages,
  real-money donations handled outside the app on iOS).
- Encryption: the build sets `ITSAppUsesNonExemptEncryption = false` (HTTPS and
  OS keychain only).
- App Privacy: answer from `docs/compliance/STORE_DATA_INVENTORY.md`. Tracking: No.
- Subscriptions: create the products listed by `GET /store-billing/catalog/apple`
  in one subscription group; add the App Store Server Notifications V2 URL
  `<https://api.ujimora.com>/api/v1/webhooks/store/apple`.
- Provide a Terms of Use (EULA) link in the app description or use Apple's standard EULA.
- Privacy Policy URL: `<https://ujimora.com/privacy>`. Support URL: `<https://ujimora.com/contact>`.

## Google Play Console

- Target API 36 (Android 16) and 16 KB page alignment: see "Android 16 KB" below.
- Data safety: answer from `docs/compliance/STORE_DATA_INVENTORY.md`; data is
  encrypted in transit; users can request deletion (in-app and web URL above).
- Account deletion URL: `<https://app.ujimora.com/delete-account>`.
- Financial features declaration: crowdfunding/donations via Paystack (a licensed
  Ghanaian payment service provider); no loans, no investment products, no
  crypto exchange or wallet.
- Foreground service declaration: `FOREGROUND_SERVICE_MEDIA_PROJECTION` — "User-initiated
  screen sharing during a live fundraising broadcast". Attach a short video of
  Go live → Share screen → system prompt → notification → Stop.
- Target audience: 18+ only. Content rating questionnaire: user-generated content,
  users can interact, digital purchases.
- Subscriptions: create the products and base plans listed by
  `GET /store-billing/catalog/google`; configure Real-time developer notifications
  (Pub/Sub push) to `<https://api.ujimora.com>/api/v1/webhooks/store/google`.
- App access: provide the demo account above.

## Android 16 KB page size

Google's [page-size guide](https://developer.android.com/guide/practices/page-sizes) requires
16 KB support for apps targeting Android 15+, and from 1 February 2027 Play blocks updates without it.
It checks 16 KB `LOAD` alignment and a 16 KB-aligned RELRO end (`(VirtAddr + MemSiz) % 0x4000 == 0`).

**Status: all 48 64-bit native libraries pass both checks** (release APK and App Bundle, 25 September 2026).
Twenty-seven prebuilt libraries (React Native/Hermes/JSI, libc++, fbjni, Fresco, expo-image decoders,
AndroidX graphics-path, WebRTC, LiveKit noise) ship with a RELRO end that isn't 16 KB aligned. No published version of any of them
fixes this yet. `plugins/relro16k.gradle`, applied by `plugins/withPrebuiltRelroAlignment.js`, runs after
the strip step. It rounds each RELRO end up to 16 KB and grows the containing writable segment by the same
zero-filled amount. Only header size fields change. This is the layout lld itself produces with
`-z common-page-size=16384`, and bionic already protects exactly that range on 16 KB devices. The build fails
if a library's layout can't be aligned safely.

Release gate: `python3 scripts/compliance/inspect-android-native.py --readelf <llvm-readelf> app-release.apk`
must report 48/48, and `zipalign -c -P 16 4` must pass. Remove a library's patch once upstream ships a
correctly linked build (the hook then reports it as "already aligned"). Evidence: `docs/compliance/NATIVE_PERMISSIONS.md`.
